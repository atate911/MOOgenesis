"""Shared helpers for the race base models: station lofting with sculpt features, export, and a clay contact sheet (Cycles)."""
import math, os
import bpy, bmesh
from mathutils import Vector, Matrix

K = 12
sc = None
def new_scene():
    global sc
    bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene; return sc

def spow(v, e): return math.copysign(abs(v) ** e, v)

def densify(stations, n_uniform):
    """Insert n_uniform evenly spaced stations (linearly interpolated) while keeping every authored station as a hard edge."""
    ts = sorted({st[0] for st in stations} | {stations[0][0] + (stations[-1][0] - stations[0][0]) * i / (n_uniform + 1) for i in range(1, n_uniform + 1)})
    out = []
    for t in ts:
        for i in range(len(stations) - 1):
            a_, b_ = stations[i], stations[i + 1]
            if a_[0] - 1e-9 <= t <= b_[0] + 1e-9:
                f = 0 if b_[0] == a_[0] else (t - a_[0]) / (b_[0] - a_[0]); lerp = lambda p, q: p + (q - p) * f
                out.append((t, lerp(a_[1], b_[1]), lerp(a_[2], b_[2]), lerp(a_[3], b_[3]), lerp(a_[4], b_[4]), (lerp(a_[5][0], b_[5][0]), lerp(a_[5][1], b_[5][1])))); break
    return out

def loft(name, origin, u, v, stations, k=K, features=(), dens=0, cap_end=True, cap_start=True):
    """stations: [(t_along_axis, rx, ryf, ryb, n, (cu, cv))]; axis w = u x v.
    features: [(t_centre, t_width, angle_deg, angle_width, radial, axial)] — Gaussian relief, mirrored left/right (angle 0 = front, 180 = back);
    radial moves the surface along its outward normal (+ out / - in), axial along the axis."""
    w = u.cross(v).normalized()
    if dens: stations = densify(stations, dens)
    bm = bmesh.new(); rings = []
    for si, (t, rx, ryf, ryb, n, c) in enumerate(stations):
        ring = []
        for i in range(k):
            th = 2 * math.pi * i / k; s_, cc = math.sin(th), math.cos(th)
            x = rx * spow(s_, 2 / n); ry = ryf if cc >= 0 else ryb; y = ry * spow(cc, 2 / n)
            nx, ny = x / (rx * rx), y / (ry * ry); nl = math.hypot(nx, ny) or 1.0; nx, ny = nx / nl, ny / nl
            ang = abs(((math.degrees(th) + 180) % 360) - 180); rad = axl = 0.0
            for tc, tw, fa, fw, fr, fx in features:
                wgt = math.exp(-((t - tc) / tw) ** 2) * math.exp(-((ang - fa) / fw) ** 2)
                rad += fr * wgt; axl += fx * wgt
            ring.append(bm.verts.new(origin + w * (t + axl) + u * (x + c[0] + nx * rad) + v * (y + c[1] + ny * rad)))
        rings.append(ring)
    for si in range(len(rings) - 1):
        for i in range(k):
            j = (i + 1) % k; bm.faces.new((rings[si][i], rings[si][j], rings[si + 1][j], rings[si + 1][i]))
    for ring, flag, flip in ((rings[0], cap_start, True), (rings[-1], cap_end, False)):
        if flag:
            cen = bm.verts.new(sum((vv.co for vv in ring), Vector()) / len(ring))
            for i in range(k):
                j = (i + 1) % k; bm.faces.new((cen, ring[j], ring[i]) if flip else (cen, ring[i], ring[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob)
    for p in me.polygons: p.use_smooth = False
    return ob



def tri_count(parts, obj=None):
    return sum(len(p.vertices) - 2 for ob in ([obj] if obj else parts) for p in ob.data.polygons)

def finish(parts, bevel=0.008):
    for ob in parts:
        bv = ob.modifiers.new('bevel', 'BEVEL'); bv.width = bevel; bv.segments = 1; bv.limit_method = 'ANGLE'

def export(path):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    for ob in sc.objects: ob.select_set(True)
    bpy.ops.wm.obj_export(filepath=path + '.obj', export_materials=False, apply_modifiers=True)
    try: bpy.ops.export_scene.gltf(filepath=path + '.glb', export_format='GLB', use_selection=False)
    except Exception as e: print('glb export skipped:', e)
    print('exported', path)

def sheet(parts, out, body_target=(0, 0, 0.7), head_target=(0, 0, 1.3), dist=11.0, head_dist=5.2):
    """front / 3-4 / profile of the whole bust + a wireframe close-up of the head."""
    from PIL import Image
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 24; sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = 600, 800; sc.view_settings.view_transform = 'Standard'
    def flat(name, col, rough=0.55):
        m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
        b.inputs['Base Color'].default_value = col; b.inputs['Roughness'].default_value = rough; return m
    clay, dark = flat('clay', (0.75, 0.75, 0.78, 1)), flat('dark', (0.01, 0.01, 0.015, 1))
    for ob in parts: ob.data.materials.append(clay); ob.data.materials.append(dark)
    sc.world = bpy.data.worlds.new('w'); sc.world.use_nodes = True; sc.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.05, 0.06, 0.09, 1)
    def lamp(loc, energy, size, col=(1, 1, 1)):
        ld = bpy.data.lights.new('l', 'AREA'); ld.energy = energy; ld.size = size; ld.color = col
        ob = bpy.data.objects.new('l', ld); sc.collection.objects.link(ob); ob.location = loc
        ob.rotation_euler = (Vector((0, 0, 0.7)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    lamp((-5, -7, 6), 1800, 5); lamp((6, -5, 1.5), 500, 5, (0.8, 0.9, 1)); lamp((0, 6, 4), 900, 4, (1, 0.85, 0.7))
    cam = bpy.data.cameras.new('c'); cam.lens = 70; co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
    def shot(az, el, d, tgt, path, wire=False):
        tgt = Vector(tgt); az, el = math.radians(az), math.radians(el)
        co.location = tgt + Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))) * d
        co.rotation_euler = (tgt - co.location).to_track_quat('-Z', 'Y').to_euler()
        for ob in parts:
            for m in list(ob.modifiers):
                if m.name == 'wire': ob.modifiers.remove(m)
            if wire:
                wm = ob.modifiers.new('wire', 'WIREFRAME'); wm.thickness = 0.005; wm.use_replace = False; wm.material_offset = 1
        sc.render.filepath = path; bpy.ops.render.render(write_still=True)
    base = os.path.splitext(out)[0]
    shot(0, 8, dist, body_target, base + '_1.png'); shot(38, 14, dist, body_target, base + '_2.png'); shot(90, 6, dist, body_target, base + '_3.png')
    shot(0, 4, head_dist, head_target, base + '_4.png', wire=True)
    W = Image.new('RGB', (1200, 1600))
    for i in range(4): W.paste(Image.open(f'{base}_{i + 1}.png'), ((i % 2) * 600, (i // 2) * 800))
    W.save(out); print('sheet', out)

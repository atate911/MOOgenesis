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


def guides(parts, outdir, tgt=(0, 0, 0.95), dist=9.0, size=(1024, 1280), lens=75, az_list=(0, 24)):
    """Render ControlNet-style guide images at card framing: depth (near = white), camera-space normals, edge lines, silhouette mask, clay shading.
    Written as <outdir>/<view>_{depth,normal,lines,mask,clay}.png"""
    import numpy as np
    from PIL import Image
    os.makedirs(outdir, exist_ok=True)
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.use_denoising = False; sc.cycles.samples = 12
    sc.render.resolution_x, sc.render.resolution_y = size; sc.view_settings.view_transform = 'Standard'; sc.render.film_transparent = True
    sc.render.image_settings.color_mode = 'RGBA'
    cam = bpy.data.cameras.new('gc'); cam.lens = lens; co = bpy.data.objects.new('gc', cam); sc.collection.objects.link(co); sc.camera = co
    tgt = Vector(tgt)
    def place(az):
        az = math.radians(az); co.location = tgt + Vector((math.sin(az), -math.cos(az), 0.09)) * dist
        co.rotation_euler = (tgt - co.location).to_track_quat('-Z', 'Y').to_euler()
    def emit(name, build):
        m = bpy.data.materials.new(name); m.use_nodes = True; n = m.node_tree.nodes; l = m.node_tree.links; n.clear()
        out = n.new('ShaderNodeOutputMaterial'); em = n.new('ShaderNodeEmission'); em.inputs['Strength'].default_value = 1.0
        l.new(build(n, l), em.inputs['Color']); l.new(em.outputs['Emission'], out.inputs['Surface']); return m
    def depth_build(n, l):
        cd = n.new('ShaderNodeCameraData'); mr = n.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = dist - 2.6; mr.inputs['From Max'].default_value = dist + 2.6
        mr.inputs['To Min'].default_value = 1.0; mr.inputs['To Max'].default_value = 0.0; mr.clamp = True
        l.new(cd.outputs['View Z Depth'], mr.inputs['Value']); return mr.outputs['Result']
    def normal_build(n, l):
        g = n.new('ShaderNodeNewGeometry'); vt = n.new('ShaderNodeVectorTransform'); vt.vector_type = 'NORMAL'; vt.convert_from = 'WORLD'; vt.convert_to = 'CAMERA'
        vm = n.new('ShaderNodeVectorMath'); vm.operation = 'MULTIPLY_ADD'; vm.inputs[1].default_value = (0.5, 0.5, 0.5); vm.inputs[2].default_value = (0.5, 0.5, 0.5)
        l.new(g.outputs['Normal'], vt.inputs['Vector']); l.new(vt.outputs['Vector'], vm.inputs[0]); return vm.outputs['Vector']
    def white_build(n, l):
        rgb = n.new('ShaderNodeRGB'); rgb.outputs[0].default_value = (1, 1, 1, 1); return rgb.outputs[0]
    mats = {'depth': emit('depth', depth_build), 'normal': emit('normal', normal_build), 'mask': emit('mask', white_build)}
    def rd(path, override=None):
        sc.view_layers[0].material_override = override; sc.render.filepath = path; bpy.ops.render.render(write_still=True)
    for az in az_list:
        place(az); tag = 'front' if az == 0 else 'three_quarter'; base = os.path.join(outdir, tag)
        for k, m in mats.items(): rd(f'{base}_{k}.png', m)
        # clay: normal materials, soft key light
        sc.view_layers[0].material_override = None
        lds = []
        for loc, e in (((-5, -7, 6), 1800), ((6, -5, 1.5), 500)):
            ld = bpy.data.lights.new('g', 'AREA'); ld.energy = e; ld.size = 5; ob = bpy.data.objects.new('g', ld); sc.collection.objects.link(ob); ob.location = loc
            ob.rotation_euler = (Vector((0, 0, 0.7)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler(); lds.append(ob)
        gm = bpy.data.materials.new('gclay'); gm.use_nodes = True; gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.75, 0.75, 0.78, 1)
        rd(f'{base}_clay.png', gm)
        for ob in lds: bpy.data.objects.remove(ob)
        # lines: edges of depth + normal discontinuities, white on black
        d = np.asarray(Image.open(f'{base}_depth.png').convert('RGBA'), dtype=np.float32) / 255; nrm = np.asarray(Image.open(f'{base}_normal.png').convert('RGBA'), dtype=np.float32) / 255
        mk = d[..., 3]
        def grad(g): gy, gx = np.gradient(g); return np.hypot(gx, gy)
        e = grad(d[..., 0]) * 6 + sum(grad(nrm[..., c]) for c in range(3)) * 1.2 + grad(mk) * 4
        ln = (np.clip((e - 0.12) / 0.25, 0, 1) * 255).astype(np.uint8)
        Image.fromarray(ln).save(f'{base}_lines.png')
        # depth/normal on black, mask as luminance (alpha flattened)
        for k in ('depth', 'normal', 'mask'):
            im = Image.open(f'{base}_{k}.png').convert('RGBA'); bg = Image.new('RGBA', im.size, (0, 0, 0, 255)); bg.alpha_composite(im); bg.convert('RGB').save(f'{base}_{k}.png')
        cl = Image.open(f'{base}_clay.png').convert('RGBA'); bg = Image.new('RGBA', cl.size, (20, 24, 34, 255)); bg.alpha_composite(cl); bg.convert('RGB').save(f'{base}_clay.png')
    print('guides ->', outdir)

"""Silicoid portrait v2 — skeleton-driven base mesh (Skin modifier) -> decimated to a faceted gem body -> crystals grown from
the surface along its normals -> glowing lava core seen through glass. Low poly (~100-250k tris), 2K bitmaps.
   python3 tools/render/silicoid_v2.py --out out.png [--w 900 --h 1200 --samples 128 --textures DIR --clay]
--clay renders the bare base mesh (grey, soft light) so you can judge the model before materials."""
import argparse, math, os, random, sys
import bpy, bmesh
from mathutils import Vector, Matrix

ap = argparse.ArgumentParser()
ap.add_argument('--out', default='silicoid_v2.png'); ap.add_argument('--w', type=int, default=900); ap.add_argument('--h', type=int, default=1200)
ap.add_argument('--samples', type=int, default=128); ap.add_argument('--seed', type=int, default=5); ap.add_argument('--textures', default=None)
ap.add_argument('--facets', type=float, default=0.03, help='decimate ratio of the smooth body: lower = chunkier facets')
ap.add_argument('--clay', action='store_true')
a = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])
rnd = random.Random(a.seed)
HERE = os.path.dirname(os.path.abspath(__file__)); TEXDIR = a.textures or os.path.join(HERE, 'textures')
HAVE_TEX = os.path.exists(os.path.join(TEXDIR, 'lava_color.png')) and not a.clay

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; cy = sc.cycles
cy.device = 'CPU'; cy.samples = a.samples; cy.use_denoising = True
cy.max_bounces = 14; cy.transmission_bounces = 12; cy.glossy_bounces = 6; cy.volume_bounces = 2
cy.caustics_reflective = False; cy.caustics_refractive = False; cy.sample_clamp_indirect = 8.0
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = a.w, a.h, 100
sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
sc.render.image_settings.file_format = 'PNG'; sc.render.filepath = a.out

# ------------------------------------------------------------------ materials
def mat(name):
    m = bpy.data.materials.new(name); m.use_nodes = True; n = m.node_tree.nodes; n.clear(); return m, n, m.node_tree.links
_imgs = {}
def bitmap(n, l, name, scale, data=False):
    if name not in _imgs:
        im = bpy.data.images.load(os.path.join(TEXDIR, name + '.png')); im.colorspace_settings.name = 'Non-Color' if data else 'sRGB'; _imgs[name] = im
    t = n.new('ShaderNodeTexImage'); t.image = _imgs[name]; t.projection = 'BOX'; t.projection_blend = 0.3; t.interpolation = 'Cubic'
    tc = n.new('ShaderNodeTexCoord'); mp = n.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (scale,) * 3
    l.new(tc.outputs['Object'], mp.inputs['Vector']); l.new(mp.outputs['Vector'], t.inputs['Vector']); return t
def normal_from(n, l, name, scale, strength):
    t = bitmap(n, l, name, scale, True); nm = n.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = strength
    l.new(t.outputs['Color'], nm.inputs['Color']); return nm

def glass(name, color, rough=0.03):
    m, n, l = mat(name); out = n.new('ShaderNodeOutputMaterial'); b = n.new('ShaderNodeBsdfPrincipled')
    b.inputs['Base Color'].default_value = color; b.inputs['Roughness'].default_value = rough; b.inputs['IOR'].default_value = 1.58
    b.inputs['Transmission Weight'].default_value = 1.0; b.inputs['Specular IOR Level'].default_value = 0.9
    if HAVE_TEX:
        t = bitmap(n, l, 'crystal_tint', 0.6); mx = n.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1
        mx.inputs[6].default_value = color; l.new(t.outputs['Color'], mx.inputs[7]); l.new(mx.outputs[2], b.inputs['Base Color'])
        r = bitmap(n, l, 'crystal_rough', 0.6, True); mm = n.new('ShaderNodeMath'); mm.operation = 'MULTIPLY_ADD'; mm.inputs[1].default_value = 0.14; mm.inputs[2].default_value = rough
        l.new(r.outputs['Color'], mm.inputs[0]); l.new(mm.outputs['Value'], b.inputs['Roughness'])
        l.new(normal_from(n, l, 'crystal_normal', 0.6, 0.3).outputs['Normal'], b.inputs['Normal'])
    l.new(b.outputs['BSDF'], out.inputs['Surface']); return m
def emissive(name, color, strength):
    m, n, l = mat(name); out = n.new('ShaderNodeOutputMaterial'); e = n.new('ShaderNodeEmission')
    e.inputs['Color'].default_value = color; e.inputs['Strength'].default_value = strength; l.new(e.outputs['Emission'], out.inputs['Surface']); return m
def lava(name, strength, scale):
    m, n, l = mat(name); out = n.new('ShaderNodeOutputMaterial'); b = n.new('ShaderNodeBsdfPrincipled')
    if HAVE_TEX:
        l.new(bitmap(n, l, 'lava_color', scale).outputs['Color'], b.inputs['Base Color'])
        l.new(bitmap(n, l, 'lava_rough', scale, True).outputs['Color'], b.inputs['Roughness'])
        l.new(normal_from(n, l, 'lava_normal', scale, 0.8).outputs['Normal'], b.inputs['Normal'])
        l.new(bitmap(n, l, 'lava_emit', scale).outputs['Color'], b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value = strength
    else:
        b.inputs['Base Color'].default_value = (1.0, 0.35, 0.05, 1); b.inputs['Emission Color'].default_value = (1, .3, .03, 1); b.inputs['Emission Strength'].default_value = strength * .3
    l.new(b.outputs['BSDF'], out.inputs['Surface']); return m
def clay_mat():
    m, n, l = mat('clay'); out = n.new('ShaderNodeOutputMaterial'); b = n.new('ShaderNodeBsdfPrincipled'); b.inputs['Base Color'].default_value = (.6, .6, .6, 1); b.inputs['Roughness'].default_value = .6
    l.new(b.outputs['BSDF'], out.inputs['Surface']); return m

BODY = glass('body', (0.07, 0.42, 0.62, 1)); TEAL = glass('teal', (0.08, 0.55, 0.8, 1)); VIOLET = glass('violet', (0.40, 0.2, 0.8, 1))
CORE = lava('core', 9.0, 0.7); EYE = emissive('eye', (1.0, 0.55, 0.1, 1), 160)
if a.clay: BODY = TEAL = VIOLET = CORE = clay_mat()

# ------------------------------------------------------------------ base mesh: a proper humanoid bust from a skeleton + Skin modifier
#   (index, x, y, z, rx, ry, parent)       x = right, y = back (camera looks along +y), z = up
J = [
 (0,  0.00,  0.05, -0.80, 0.44, 0.30, None),   # lower torso (root)
 (1,  0.00,  0.05, -0.20, 0.48, 0.32, 0),      # chest
 (2,  0.00,  0.00,  0.36, 0.38, 0.28, 1),      # upper chest / base of neck
 (3,  0.00,  0.02,  0.72, 0.20, 0.20, 2),      # neck
 (4,  0.00,  0.00,  1.00, 0.38, 0.36, 3),      # jaw hinge
 (5,  0.00, -0.04,  1.34, 0.44, 0.42, 4),      # skull mid
 (6,  0.00,  0.00,  1.70, 0.36, 0.37, 5),      # skull top
 (7,  0.00, -0.28,  0.90, 0.17, 0.15, 4),      # chin
 (8,  0.00, -0.30,  1.48, 0.24, 0.12, 5),      # heavy brow ridge
 (9,  0.00, -0.32,  1.22, 0.13, 0.11, 5),      # nose-bridge / midface
 (10,  0.38, -0.22,  1.08, 0.14, 0.12, 4), (11, -0.38, -0.22, 1.08, 0.14, 0.12, 4),   # cheekbones
 (12,  0.70,  0.00,  0.30, 0.30, 0.27, 1), (13, -0.70, 0.00, 0.30, 0.30, 0.27, 1),   # shoulders
 (14,  1.02,  0.02, -0.08, 0.21, 0.21, 12), (15, -1.02, 0.02, -0.08, 0.21, 0.21, 13), # upper arms
 (16,  1.12, -0.10, -0.60, 0.17, 0.17, 14), (17, -1.12, -0.10, -0.60, 0.17, 0.17, 15),# elbows
]
bm = bmesh.new()
vs = {j[0]: bm.verts.new((j[1], j[2], j[3])) for j in J}
for j in J:
    if j[6] is not None: bm.edges.new((vs[j[6]], vs[j[0]]))
me = bpy.data.meshes.new('skel'); bm.to_mesh(me); bm.free()
skel = bpy.data.objects.new('skel', me); sc.collection.objects.link(skel)
skin_mod = skel.modifiers.new('skin', 'SKIN'); skin_mod.use_smooth_shade = True
bpy.context.view_layer.objects.active = skel; skel.select_set(True)
if not me.skin_vertices: bpy.ops.mesh.customdata_skin_add()
sk = me.skin_vertices[0]
for j in J:
    k = 1.14 if 4 <= j[0] <= 11 else 1.0   # slightly heroic head
    sk.data[j[0]].radius = (j[4] * k, j[5] * k)
sk.data[0].use_root = True
ss = skel.modifiers.new('sub', 'SUBSURF'); ss.levels = ss.render_levels = 2
rm_ = skel.modifiers.new('remesh', 'REMESH'); rm_.mode = 'VOXEL'; rm_.voxel_size = 0.03   # one clean watertight shell, no skin-modifier slivers
dc = skel.modifiers.new('facet', 'DECIMATE'); dc.ratio = a.facets
dg = bpy.context.evaluated_depsgraph_get()
ev = skel.evaluated_get(dg); fm = bpy.data.meshes.new_from_object(ev)
bpy.data.objects.remove(skel)
body = bpy.data.objects.new('body', fm); sc.collection.objects.link(body)
for p in body.data.polygons: p.use_smooth = False
body.data.materials.append(BODY)
bv = body.modifiers.new('bevel', 'BEVEL'); bv.width = 0.012; bv.segments = 2; bv.limit_method = 'ANGLE'; bv.angle_limit = math.radians(25)
print('body tris:', sum(len(p.vertices) - 2 for p in body.data.polygons))

# inner lava core: same silhouette, shrunk, so it glows through the glass body
bm2 = bmesh.new(); bm2.from_mesh(fm)
for v in bm2.verts: v.co = Vector((v.co.x * 0.72, v.co.y * 0.72, v.co.z * 0.78 + 0.06))
core_me = bpy.data.meshes.new('core'); bm2.to_mesh(core_me); bm2.free()
core = bpy.data.objects.new('core', core_me); sc.collection.objects.link(core); core.data.materials.append(CORE)
for p in core.data.polygons: p.use_smooth = True

# ------------------------------------------------------------------ crystals grown along the body's surface normals
def crystal(pos, direction, length, radius, material, sides=6, name='crystal'):
    """Quartz-like: hexagonal prism, slight waist, steep 6-facet termination."""
    b_ = bmesh.new(); rings = []
    for z, r, rot in ((0, radius, 0), (length * 0.55, radius * 1.03, 0.04), (length * 0.86, radius * 0.97, 0.05)):
        rings.append([b_.verts.new((math.cos(2 * math.pi * i / sides + rot) * r, math.sin(2 * math.pi * i / sides + rot) * r * 0.9, z)) for i in range(sides)])
    apex = b_.verts.new((0, 0, length)); b_.faces.new(rings[0][::-1])
    for k in range(2):
        for i in range(sides):
            j = (i + 1) % sides; b_.faces.new((rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]))
    for i in range(sides): b_.faces.new((rings[2][i], rings[2][(i + 1) % sides], apex))
    bmesh.ops.recalc_face_normals(b_, faces=b_.faces[:])
    me_ = bpy.data.meshes.new(name); b_.to_mesh(me_); b_.free(); ob = bpy.data.objects.new(name, me_); sc.collection.objects.link(ob)
    d = Vector(direction).normalized(); ob.matrix_world = Matrix.Translation(pos) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    bw = ob.modifiers.new('bevel', 'BEVEL'); bw.width = radius * 0.04; bw.segments = 2; bw.limit_method = 'ANGLE'
    for p in me_.polygons: p.use_smooth = False
    me_.materials.append(material); return ob

polys = [(p.center.copy(), p.normal.copy(), p.area) for p in body.data.polygons]
def pick(pred, k, min_dist=0.0, taken=None):
    taken = taken if taken is not None else []
    pool = [q for q in polys if pred(q[0], q[1])]; rnd.shuffle(pool); out = []
    for c, nrm, ar in pool:
        if len(out) >= k: break
        if all((c - t).length >= min_dist for t in taken):
            out.append((c, nrm)); taken.append(c)
    return out
taken = []
mats = [TEAL, TEAL, BODY, VIOLET]
# shoulder clusters (big), upper back/spine, crown, jaw/cheek (small, swept back) — direction = surface normal biased outward/up
for c, n in pick(lambda c, n: abs(c.x) > 0.55 and c.z > 0.1 and n.z > 0.1, 8, 0.38, taken):
    d = (n * 1.0 + Vector((math.copysign(0.7, c.x), 0, 0.9))).normalized(); crystal(c - n * 0.05, d, rnd.uniform(0.8, 1.3), rnd.uniform(0.14, 0.26), rnd.choice(mats), name='shoulder')
for c, n in pick(lambda c, n: c.z > 1.45 and n.z > 0.25 and c.y > -0.1, 4, 0.3, taken):
    d = (n + Vector((0, 0.9, 0.9))).normalized(); crystal(c - n * 0.04, d, rnd.uniform(0.55, 0.85), rnd.uniform(0.08, 0.13), rnd.choice(mats), name='crown')
for c, n in pick(lambda c, n: c.y > 0.15 and 0.0 < c.z < 1.1, 6, 0.3, taken):
    d = (n + Vector((0, 0.2, 0.7))).normalized(); crystal(c - n * 0.04, d, rnd.uniform(0.6, 1.1), rnd.uniform(0.1, 0.2), rnd.choice(mats), name='back')
for c, n in pick(lambda c, n: abs(c.x) > 0.3 and 0.85 < c.z < 1.2 and c.y > -0.05 and n.z < 0.2, 2, 0.3, taken):
    d = (n + Vector((math.copysign(0.4, c.x), 0.6, -0.6))).normalized(); crystal(c - n * 0.03, d, rnd.uniform(0.3, 0.5), 0.07, VIOLET, name='jaw')

# eyes: find the front surface by raycasting, seat a narrow glowing slit there
def surf(x, z):
    ok, loc, nrm, idx = body.ray_cast(Vector((x, -3, z)), Vector((0, 1, 0))); return (loc, nrm) if ok else (None, None)
for sgn in (1, -1):
    loc, nrm = surf(sgn * 0.13, 1.40)
    if loc is not None:
        bpy.ops.mesh.primitive_cube_add(location=loc - nrm * 0.015); eo = bpy.context.active_object
        eo.scale = (0.065, 0.02, 0.011); eo.rotation_euler = (0, 0.0, -sgn * 0.22); eo.data.materials.append(EYE)
        print('eye at', tuple(round(v, 2) for v in loc))

# ------------------------------------------------------------------ world, lights, camera
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; wn, wl = w.node_tree.nodes, w.node_tree.links; wn.clear()
wo = wn.new('ShaderNodeOutputWorld'); bg = wn.new('ShaderNodeBackground'); bg.inputs['Strength'].default_value = 0.1
tc = wn.new('ShaderNodeTexCoord'); nz = wn.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.6; nz.inputs['Detail'].default_value = 8
cr = wn.new('ShaderNodeValToRGB'); cr.color_ramp.elements[0].position = 0.42; cr.color_ramp.elements[0].color = (0.004, 0.006, 0.02, 1)
cr.color_ramp.elements[1].position = 0.72; cr.color_ramp.elements[1].color = (0.06, 0.02, 0.16, 1)
vo = wn.new('ShaderNodeTexVoronoi'); vo.inputs['Scale'].default_value = 420
sr = wn.new('ShaderNodeMath'); sr.operation = 'LESS_THAN'; sr.inputs[1].default_value = 0.018
sm = wn.new('ShaderNodeMath'); sm.operation = 'MULTIPLY'; sm.inputs[1].default_value = 9
ad = wn.new('ShaderNodeMix'); ad.data_type = 'RGBA'; ad.blend_type = 'ADD'; ad.inputs['Factor'].default_value = 1
wl.new(tc.outputs['Generated'], nz.inputs['Vector']); wl.new(tc.outputs['Generated'], vo.inputs['Vector']); wl.new(nz.outputs['Fac'], cr.inputs['Fac'])
wl.new(vo.outputs['Distance'], sr.inputs[0]); wl.new(sr.outputs['Value'], sm.inputs[0]); wl.new(cr.outputs['Color'], ad.inputs[6]); wl.new(sm.outputs['Value'], ad.inputs[7])
wl.new(ad.outputs[2], bg.inputs['Color']); wl.new(bg.outputs['Background'], wo.inputs['Surface'])
if a.clay: bg.inputs['Strength'].default_value = 1.0

def area(loc, target, color, energy, size, size_y=None):
    ld = bpy.data.lights.new('a', 'AREA'); ld.energy = energy; ld.color = color; ld.shape = 'RECTANGLE'; ld.size = size; ld.size_y = size_y or size
    ob = bpy.data.objects.new('a', ld); sc.collection.objects.link(ob); ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
def spot(loc, target, color, energy, cone, blend):
    ld = bpy.data.lights.new('s', 'SPOT'); ld.energy = energy; ld.color = color; ld.spot_size = math.radians(cone); ld.spot_blend = blend; ld.shadow_soft_size = 0.05
    ob = bpy.data.objects.new('s', ld); sc.collection.objects.link(ob); ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
if a.clay:
    area((-4, -6, 4), (0, 0, 0.6), (1, 1, 1), 2500, 5); area((5, -3, 2), (0, 0, 0.6), (0.8, 0.9, 1), 900, 5)
else:   # low ambient + five sources: cyan bar, violet bar, hard overhead spot, lava under-glow, magenta wash on the backdrop
    area((-4.4, 1.2, 1.4), (0, 0, 0.9), (0.25, 0.95, 1.0), 2600, 0.45, 7.5)
    area((4.8, 1.6, 1.6), (0, 0, 0.9), (0.65, 0.3, 1.0), 3200, 0.45, 7.5)
    spot((1.0, -2.0, 8.0), (0, -0.1, 1.5), (0.85, 0.95, 1.0), 60000, 18, 0.35)
    area((0.2, -3.5, -2.4), (0, 0, 0.1), (1.0, 0.42, 0.12), 520, 3.5)
    area((0.0, 14.0, 3.0), (0, 30.0, 0.0), (0.75, 0.2, 0.7), 7000, 26, 18)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.8)); fog = bpy.context.active_object; fog.scale = (14, 16, 8)
    fmx, fn, fl = mat('haze'); fo = fn.new('ShaderNodeOutputMaterial'); pv = fn.new('ShaderNodeVolumePrincipled')
    pv.inputs['Density'].default_value = 0.0009; pv.inputs['Color'].default_value = (0.6, 0.7, 1.0, 1); pv.inputs['Anisotropy'].default_value = 0.5
    fl.new(pv.outputs['Volume'], fo.inputs['Volume']); fog.data.materials.append(fmx); fog.display_type = 'WIRE'

# turn the figure slightly (3/4 view) by parenting everything to an empty
root = bpy.data.objects.new('fig', None); sc.collection.objects.link(root)
for ob in list(sc.objects):
    if ob.type in {'MESH'} and ob.name != 'Cube' or ob.name.startswith('Cube'):
        if not (ob.display_type == 'WIRE'): ob.parent = root
root.rotation_euler = (0, 0, math.radians(-22))
cam = bpy.data.cameras.new('c'); cam.lens = 90; cam.dof.use_dof = True; cam.dof.aperture_fstop = 6.3
co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
co.location = (-0.3, -10.8, 1.05); tgt = Vector((0, 0, 0.95))
co.rotation_euler = (tgt - co.location).to_track_quat('-Z', 'Y').to_euler(); cam.dof.focus_distance = (tgt - co.location).length - 0.4
print('POLYS', sum(len(o.evaluated_get(bpy.context.evaluated_depsgraph_get()).data.polygons) for o in sc.objects if o.type == 'MESH'))
bpy.ops.render.render(write_still=True)

"""Silicoid race portrait — Blender/Cycles scene, fully procedural (no external assets).
Run:  python3 tools/render/silicoid_portrait.py --out out.png [--w 900 --h 1200 --samples 128]
Needs: pip install bpy   (Blender as a Python module)."""
import argparse, math, random, sys
import bpy, bmesh
from mathutils import Vector, Matrix

ap = argparse.ArgumentParser()
ap.add_argument('--out', default='silicoid.png'); ap.add_argument('--w', type=int, default=900); ap.add_argument('--h', type=int, default=1200)
ap.add_argument('--samples', type=int, default=128); ap.add_argument('--detail', type=int, default=2)  # 0 = original low-poly
ap.add_argument('--textures', default=None, help='dir with maps from make_textures.py (default tools/render/textures if present)'); ap.add_argument('--seed', type=int, default=7); ap.add_argument('--no-atmo', dest='no_atmo', action='store_true')
a = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])
rnd = random.Random(a.seed)
import os
TEXDIR = a.textures or os.path.join(os.path.dirname(os.path.abspath(__file__)), 'textures')
HAVE_TEX = os.path.exists(os.path.join(TEXDIR, 'lava_color.png'))
print('bitmap textures:', TEXDIR if HAVE_TEX else 'none (procedural fallback)')

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
cy = sc.cycles
cy.device = 'CPU'; cy.samples = a.samples; cy.use_denoising = True
cy.volume_bounces = 2; cy.max_bounces = 14; cy.transmission_bounces = 12; cy.glossy_bounces = 6; cy.caustics_reflective = False; cy.caustics_refractive = False
cy.sample_clamp_indirect = 8.0
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = a.w, a.h, 100
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_depth = '8'
sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
sc.render.filepath = a.out

# ---------------------------------------------------------------- materials
_imgs = {}
def bitmap(n, l, name, scale, data=False):
    """Image-texture node, box-projected from object coordinates (seamless maps => no UV unwrap needed)."""
    if name not in _imgs:
        im = bpy.data.images.load(os.path.join(TEXDIR, name + '.png')); im.colorspace_settings.name = 'Non-Color' if data else 'sRGB'; _imgs[name] = im
    t = n.new('ShaderNodeTexImage'); t.image = _imgs[name]; t.projection = 'BOX'; t.projection_blend = 0.25; t.interpolation = 'Cubic'
    tc = n.new('ShaderNodeTexCoord'); mp = n.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (scale,) * 3
    l.new(tc.outputs['Object'], mp.inputs['Vector']); l.new(mp.outputs['Vector'], t.inputs['Vector']); return t
def normal_from(n, l, name, scale, strength):
    t = bitmap(n, l, name, scale, data=True); nm = n.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = strength
    l.new(t.outputs['Color'], nm.inputs['Color']); return nm
def mat(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    n = m.node_tree.nodes; n.clear(); return m, n, m.node_tree.links

def crystal_mat(name, color, rough=0.04, ior=1.6, absorb=0.0):
    m, n, l = mat(name)
    out = n.new('ShaderNodeOutputMaterial'); b = n.new('ShaderNodeBsdfPrincipled')
    b.inputs['Base Color'].default_value = color
    b.inputs['Roughness'].default_value = rough
    b.inputs['IOR'].default_value = ior
    b.inputs['Transmission Weight'].default_value = 1.0
    b.inputs['Specular IOR Level'].default_value = 0.8
    if HAVE_TEX:   # 4K bitmaps: colour zoning + frosted inclusions (tint), per-pixel roughness, micro-fracture normals
        tint = bitmap(n, l, 'crystal_tint', 0.55); mx = n.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1.0
        mx.inputs[6].default_value = color; l.new(tint.outputs['Color'], mx.inputs[7]); l.new(mx.outputs[2], b.inputs['Base Color'])
        rg = bitmap(n, l, 'crystal_rough', 0.55, data=True); rm = n.new('ShaderNodeMath'); rm.operation = 'MULTIPLY_ADD'; rm.inputs[1].default_value = 0.4; rm.inputs[2].default_value = rough
        l.new(rg.outputs['Color'], rm.inputs[0]); l.new(rm.outputs['Value'], b.inputs['Roughness'])
        l.new(normal_from(n, l, 'crystal_normal', 0.55, 0.8).outputs['Normal'], b.inputs['Normal'])
    else:
        nz = n.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 40; nz.inputs['Detail'].default_value = 6
        bm = n.new('ShaderNodeBump'); bm.inputs['Strength'].default_value = 0.04
        l.new(nz.outputs['Fac'], bm.inputs['Height']); l.new(bm.outputs['Normal'], b.inputs['Normal'])
    l.new(b.outputs['BSDF'], out.inputs['Surface'])
    return m

def obsidian_mat(name, tint):
    m, n, l = mat(name)
    out = n.new('ShaderNodeOutputMaterial'); b = n.new('ShaderNodeBsdfPrincipled')
    b.inputs['Base Color'].default_value = tint; b.inputs['Metallic'].default_value = 0.35
    b.inputs['Roughness'].default_value = 0.12; b.inputs['Coat Weight'].default_value = 0.6
    if HAVE_TEX:
        c = bitmap(n, l, 'obsidian_color', 0.4); mx = n.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'ADD'; mx.inputs['Factor'].default_value = 1.0
        mx.inputs[6].default_value = tint; l.new(c.outputs['Color'], mx.inputs[7]); l.new(mx.outputs[2], b.inputs['Base Color'])
        l.new(bitmap(n, l, 'obsidian_rough', 0.4, data=True).outputs['Color'], b.inputs['Roughness'])
        l.new(normal_from(n, l, 'obsidian_normal', 0.4, 0.9).outputs['Normal'], b.inputs['Normal'])
    l.new(b.outputs['BSDF'], out.inputs['Surface']); return m

def emissive_mat(name, color, strength):
    m, n, l = mat(name)
    out = n.new('ShaderNodeOutputMaterial'); e = n.new('ShaderNodeEmission')
    e.inputs['Color'].default_value = color; e.inputs['Strength'].default_value = strength
    l.new(e.outputs['Emission'], out.inputs['Surface']); return m

def lava_mat(name, strength=9.0, lo=0.45, hi=0.51, scale=3.2, tex_scale=0.45):
    """Cooling-lava skin: bright orange in cracks, near-black basalt crust elsewhere."""
    m, n, l = mat(name)
    if HAVE_TEX:
        out = n.new('ShaderNodeOutputMaterial'); b = n.new('ShaderNodeBsdfPrincipled'); sc_ = tex_scale
        l.new(bitmap(n, l, 'lava_color', sc_).outputs['Color'], b.inputs['Base Color'])
        l.new(bitmap(n, l, 'lava_rough', sc_, data=True).outputs['Color'], b.inputs['Roughness'])
        l.new(normal_from(n, l, 'lava_normal', sc_, 1.0).outputs['Normal'], b.inputs['Normal'])
        l.new(bitmap(n, l, 'lava_emit', sc_).outputs['Color'], b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value = strength * 1.6
        l.new(b.outputs['BSDF'], out.inputs['Surface']); return m
    out = n.new('ShaderNodeOutputMaterial'); tc = n.new('ShaderNodeTexCoord')
    nz = n.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = scale; nz.inputs['Detail'].default_value = 12; nz.inputs['Roughness'].default_value = 0.62
    ramp = n.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = lo; ramp.color_ramp.elements[0].color = (1, 0.38, 0.03, 1)
    ramp.color_ramp.elements[1].position = hi; ramp.color_ramp.elements[1].color = (0.01, 0.008, 0.008, 1)
    em = n.new('ShaderNodeEmission'); em.inputs['Strength'].default_value = strength
    pr = n.new('ShaderNodeBsdfPrincipled'); pr.inputs['Roughness'].default_value = 0.8; pr.inputs['Base Color'].default_value = (0.045, 0.04, 0.045, 1)
    mix = n.new('ShaderNodeMixShader')
    inv = n.new('ShaderNodeMath'); inv.operation = 'GREATER_THAN'; inv.inputs[1].default_value = 0.5
    # crack mask = how "orange" the ramp is (red channel > threshold)
    sep = n.new('ShaderNodeSeparateColor')
    l.new(tc.outputs['Object'], nz.inputs['Vector']); l.new(nz.outputs['Fac'], ramp.inputs['Fac'])
    l.new(ramp.outputs['Color'], em.inputs['Color']); l.new(ramp.outputs['Color'], sep.inputs['Color'])
    l.new(sep.outputs['Red'], inv.inputs[0]); l.new(inv.outputs['Value'], mix.inputs['Fac'])
    l.new(pr.outputs['BSDF'], mix.inputs[1]); l.new(em.outputs['Emission'], mix.inputs[2])
    l.new(mix.outputs['Shader'], out.inputs['Surface']); return m

TEAL = crystal_mat('teal', (0.08, 0.55, 0.85, 1))
DEEP = crystal_mat('deep', (0.03, 0.22, 0.6, 1), rough=0.02)
VIOLET = crystal_mat('violet', (0.42, 0.22, 0.85, 1), rough=0.03)
OBS = obsidian_mat('obsidian', (0.025, 0.03, 0.04, 1))
OBS2 = obsidian_mat('obsidian2', (0.05, 0.02, 0.08, 1))
CORE = emissive_mat('core', (1.0, 0.25, 0.03, 1), 3.2)
EYE = emissive_mat('eye', (1.0, 0.65, 0.15, 1), 35)
LAVA = lava_mat('lava', 3.2)
PLANET_LAVA = lava_mat('planet_lava', 1.8, 0.42, 0.47, 1.3, tex_scale=0.05)

# ---------------------------------------------------------------- geometry
def collection_obj(name, bm_):
    me = bpy.data.meshes.new(name); bm_.to_mesh(me); bm_.free()
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob); return ob

def shade_flat(ob, mats):
    for m_ in mats: ob.data.materials.append(m_)
    for p in ob.data.polygons: p.use_smooth = False

def crystal(pos, direction, length, radius, material, sides=6, taper=0.85, tip=0.28, twist=0.0, squash=1.0, name='crystal'):
    """Hexagonal-ish prism with a faceted pointed tip, slightly irregular, along `direction`."""
    bm_ = bmesh.new()
    def ring(z, r, rot):
        vs = []
        for i in range(sides):
            ang = 2 * math.pi * i / sides + rot
            rr = r * (1 + rnd.uniform(-0.09, 0.09))
            vs.append(bm_.verts.new((math.cos(ang) * rr, math.sin(ang) * rr * squash, z + rnd.uniform(-0.01, 0.01) * length)))
        return vs
    r0 = ring(0, radius, 0.0); r1 = ring(length * (1 - tip), radius * taper, twist)
    apex = bm_.verts.new((rnd.uniform(-.1, .1) * radius, rnd.uniform(-.1, .1) * radius, length))
    cap = bm_.faces.new(r0[::-1])
    for i in range(sides):
        j = (i + 1) % sides
        bm_.faces.new((r0[i], r0[j], r1[j], r1[i]))
        bm_.faces.new((r1[i], r1[j], apex))
    bmesh.ops.recalc_face_normals(bm_, faces=bm_.faces[:])
    ob = collection_obj(name, bm_)
    d = Vector(direction).normalized()
    ob.matrix_world = Matrix.Translation(pos) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    bv = ob.modifiers.new('bevel', 'BEVEL'); bv.width = radius * 0.035; bv.segments = 2 + a.detail; bv.limit_method = 'ANGLE'
    if a.detail:
        sd = ob.modifiers.new('sub', 'SUBSURF'); sd.subdivision_type = 'SIMPLE'; sd.levels = sd.render_levels = a.detail   # x4 faces per level
        tx = bpy.data.textures.new('chip', 'VORONOI'); tx.noise_scale = 0.22 * max(radius, 0.1) * 6
        dm = ob.modifiers.new('chip', 'DISPLACE'); dm.texture = tx; dm.strength = radius * 0.035; dm.mid_level = 0.5
    shade_flat(ob, [material]); return ob

def blob(pos, scale, material, seed=0, subdiv=None, name='core'):
    subdiv = subdiv or min(3 + 2 * a.detail, 8)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=1, location=pos)
    ob = bpy.context.active_object; ob.name = name; ob.scale = scale
    t = bpy.data.textures.new('d' + name, 'CLOUDS'); t.noise_scale = 0.9
    dm = ob.modifiers.new('disp', 'DISPLACE'); dm.texture = t; dm.strength = 0.22
    t2 = bpy.data.textures.new('r' + name, 'MUSGRAVE' if hasattr(bpy.types, 'MusgraveTexture') else 'CLOUDS'); t2.noise_scale = 0.12
    d2 = ob.modifiers.new('rough', 'DISPLACE'); d2.texture = t2; d2.strength = 0.05 if a.detail else 0.0
    for p in ob.data.polygons: p.use_smooth = True
    ob.data.materials.append(material); return ob

def emissive_slit(pos, size, rot_z):
    bpy.ops.mesh.primitive_cube_add(location=pos)
    ob = bpy.context.active_object; ob.scale = size; ob.rotation_euler = (0, 0, rot_z)
    ob.data.materials.append(EYE); return ob

mats = [TEAL, TEAL, DEEP, VIOLET, OBS, OBS2]
# --- Head: one large crystal (the "face"), a smaller offset crystal as brow/crown, glowing core inside
head = crystal((0, 0, 1.0), (0.02, 0, 1), 1.45, 0.55, TEAL, sides=6, taper=0.9, tip=0.30, squash=0.82, name='head')
crystal((0.25, 0.05, 1.45), (0.35, 0.05, 1), 1.15, 0.22, DEEP, name='crown_r')
crystal((-0.32, -0.02, 1.4), (-0.5, 0, 1), 1.0, 0.20, VIOLET, name='crown_l')
crystal((0.0, 0.18, 1.62), (0.0, 0.1, 1), 0.8, 0.16, TEAL, name='crown_c')
crystal((-0.12, -0.05, 1.25), (-0.2, 0.2, 1), 0.9, 0.14, DEEP, name='crown_back')
blob((0, 0.12, 1.55), (0.12, 0.09, 0.5), CORE, name='head_core')
# --- Face reading: brow ridge, cheek crystals and a pointed chin
crystal((0.0, -0.36, 1.92), (0, -1, 0.12), 0.42, 0.2, OBS, sides=5, taper=0.7, tip=0.5, name='brow')
for sgn in (1, -1):
    crystal((sgn * 0.34, -0.3, 1.25), (sgn * 0.6, -0.5, -0.55), 0.6, 0.12, DEEP, taper=0.7, name='cheek')
crystal((0.0, -0.33, 1.1), (0, -0.4, -1), 0.7, 0.15, TEAL, taper=0.7, name='chin')
# --- Eyes: two narrow glowing amber slits set into a front facet
emissive_slit((-0.19, -0.37, 1.74), (0.115, 0.02, 0.026), 0.12)
emissive_slit((0.19, -0.37, 1.74), (0.115, 0.02, 0.026), -0.12)
# --- Neck + chest mass: lava-crusted core with crystals growing out of it
blob((0, 0.02, 0.62), (0.52, 0.34, 0.55), LAVA, name='neck')
blob((0, 0.08, -0.15), (1.05, 0.55, 0.85), LAVA, name='chest')
blob((0, -0.02, -0.05), (0.62, 0.34, 0.62), CORE, name='chest_core')
# --- Shoulders: big crystals sweeping up/out, plus a ring of spikes down the chest
for sgn, m_ in ((1, TEAL), (-1, DEEP)):
    crystal((sgn * 0.95, 0.05, 0.15), (sgn * 0.55, 0.0, 1), 1.55, 0.34, m_, taper=0.8, tip=0.35, name='shoulder')
    crystal((sgn * 1.25, 0.1, -0.05), (sgn * 1.0, -0.05, 0.55), 1.15, 0.26, VIOLET if sgn > 0 else TEAL, name='shoulder2')
    crystal((sgn * 0.6, -0.1, 0.45), (sgn * 0.35, -0.2, 1), 0.85, 0.2, OBS if sgn > 0 else OBS2, name='trap')
    crystal((sgn * 1.55, 0.0, -0.3), (sgn * 1.0, 0, 0.25), 0.95, 0.22, OBS2 if sgn > 0 else OBS, name='arm')
for i in range(9):
    x = rnd.uniform(-0.9, 0.9); z = rnd.uniform(-0.8, 0.0)
    crystal((x, -0.42 + abs(x) * 0.1, z), (x * 0.4, -1, 0.5 + rnd.uniform(-.2, .3)), rnd.uniform(0.5, 0.95), rnd.uniform(0.09, 0.17),
            rnd.choice(mats), taper=0.8, name='chest_spike')
for i in range(7):
    ang = rnd.uniform(0, 2 * math.pi); z = rnd.uniform(0.7, 1.2)
    crystal((math.cos(ang) * 0.25, 0.1 + math.sin(ang) * 0.1, z), (math.cos(ang) * 0.7, 0.3, 1), rnd.uniform(0.35, 0.65), rnd.uniform(0.06, 0.1), rnd.choice(mats), name='neck_spike')

# --- Background: volcanic planet, glow rim, stars + nebula world
bpy.ops.mesh.primitive_uv_sphere_add(radius=9, segments=96 * (1 + a.detail), ring_count=64 * (1 + a.detail), location=(-9, 34, -6.5))
planet = bpy.context.active_object
for p in planet.data.polygons: p.use_smooth = True
planet.data.materials.append(PLANET_LAVA)
bpy.ops.mesh.primitive_uv_sphere_add(radius=9.25, segments=64, ring_count=32, location=(-9, 34, -6.5))
atm = bpy.context.active_object
am, an, al = mat('atmo')
ao = an.new('ShaderNodeOutputMaterial'); fr = an.new('ShaderNodeLayerWeight'); fr.inputs['Blend'].default_value = 0.5
em = an.new('ShaderNodeEmission'); em.inputs['Color'].default_value = (1.0, 0.45, 0.12, 1); em.inputs['Strength'].default_value = 8
tr = an.new('ShaderNodeBsdfTransparent'); mx = an.new('ShaderNodeMixShader')
gm = an.new('ShaderNodeNewGeometry'); dt = an.new('ShaderNodeVectorMath'); dt.operation = 'DOT_PRODUCT'
ab = an.new('ShaderNodeMath'); ab.operation = 'ABSOLUTE'; om = an.new('ShaderNodeMath'); om.operation = 'SUBTRACT'; om.inputs[0].default_value = 1.0
pw = an.new('ShaderNodeMath'); pw.operation = 'POWER'; pw.inputs[1].default_value = 7
al.new(gm.outputs['Normal'], dt.inputs[0]); al.new(gm.outputs['Incoming'], dt.inputs[1]); al.new(dt.outputs['Value'], ab.inputs[0])
al.new(ab.outputs['Value'], om.inputs[1]); al.new(om.outputs['Value'], pw.inputs[0]); al.new(pw.outputs['Value'], mx.inputs['Fac']); al.new(em.outputs['Emission'], mx.inputs[2]); al.new(tr.outputs['BSDF'], mx.inputs[1]); al.new(mx.outputs['Shader'], ao.inputs['Surface'])
atm.data.materials.append(am)
atm.visible_shadow = False
atm.hide_render = bool(a.no_atmo)

w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
wn, wl = w.node_tree.nodes, w.node_tree.links; wn.clear()
wo = wn.new('ShaderNodeOutputWorld'); bg = wn.new('ShaderNodeBackground'); bg.inputs['Strength'].default_value = 0.12
tc = wn.new('ShaderNodeTexCoord'); nz = wn.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.6; nz.inputs['Detail'].default_value = 8
cr = wn.new('ShaderNodeValToRGB'); cr.color_ramp.elements[0].position = 0.42; cr.color_ramp.elements[0].color = (0.004, 0.006, 0.02, 1)
cr.color_ramp.elements[1].position = 0.72; cr.color_ramp.elements[1].color = (0.06, 0.02, 0.16, 1)
vo = wn.new('ShaderNodeTexVoronoi'); vo.inputs['Scale'].default_value = 420; vo.feature = 'F1'
sr = wn.new('ShaderNodeMath'); sr.operation = 'LESS_THAN'; sr.inputs[1].default_value = 0.018
sm = wn.new('ShaderNodeMath'); sm.operation = 'MULTIPLY'; sm.inputs[1].default_value = 9
add = wn.new('ShaderNodeMix'); add.data_type = 'RGBA'; add.blend_type = 'ADD'; add.inputs['Factor'].default_value = 1
wl.new(tc.outputs['Generated'], nz.inputs['Vector']); wl.new(tc.outputs['Generated'], vo.inputs['Vector'])
wl.new(nz.outputs['Fac'], cr.inputs['Fac']); wl.new(vo.outputs['Distance'], sr.inputs[0]); wl.new(sr.outputs['Value'], sm.inputs[0])
wl.new(cr.outputs['Color'], add.inputs[6]); wl.new(sm.outputs['Value'], add.inputs[7])
wl.new(add.outputs[2], bg.inputs['Color']); wl.new(bg.outputs['Background'], wo.inputs['Surface'])

# --- Lights: dim cold ambient (world + faint fill) plus hard, dramatic sci-fi sources:
#     cyan & violet light-bars as rim strips, a tight cool-white overhead spot, a hot orange under-glow, small accent points.
def area(loc, target, color, energy, size, shape='RECTANGLE', size_y=None):
    ld = bpy.data.lights.new('a', 'AREA'); ld.energy = energy; ld.color = color; ld.shape = shape; ld.size = size
    if shape == 'RECTANGLE': ld.size_y = size_y or size
    ob = bpy.data.objects.new('a', ld); sc.collection.objects.link(ob); ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler(); return ob
def spot(loc, target, color, energy, cone, blend=0.25):
    ld = bpy.data.lights.new('s', 'SPOT'); ld.energy = energy; ld.color = color; ld.spot_size = math.radians(cone); ld.spot_blend = blend; ld.shadow_soft_size = 0.05
    ob = bpy.data.objects.new('s', ld); sc.collection.objects.link(ob); ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler(); return ob
def point(loc, color, energy, r=0.05):
    ld = bpy.data.lights.new('p', 'POINT'); ld.energy = energy; ld.color = color; ld.shadow_soft_size = r
    ob = bpy.data.objects.new('p', ld); sc.collection.objects.link(ob); ob.location = loc; return ob
# Low ambient (world strength 0.12, no fill lights) + exactly five sources:
area((-4.2, 1.0, 1.6), (0, 0, 1.2), (0.25, 0.95, 1.0), 2600, 0.45, size_y=7.5)                 # 1 cyan light-bar, left rim
area((4.6, 1.8, 1.8), (0, 0, 1.2), (0.65, 0.3, 1.0), 3200, 0.45, size_y=7.5)                   # 2 violet light-bar, right rim
spot((1.2, -1.5, 8.5), (0, -0.1, 2.0), (0.85, 0.95, 1.0), 60000, 17, 0.35)                     # 3 hard overhead spot on the head
area((0.2, -3.5, -2.6), (0, 0, 0.4), (1.0, 0.42, 0.12), 520, 3.5)                              # 4 hot lava under-glow
area((0.0, 14.0, 3.0), (0, 30.0, 0.0), (0.75, 0.2, 0.7), 22000, 26, size_y=18)               # 5 wash: broad magenta wall-wash over the backdrop
# thin haze so the beams read
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 1.0)); fog = bpy.context.active_object; fog.scale = (14, 16, 8)
fm, fn, fl = mat('haze'); fo = fn.new('ShaderNodeOutputMaterial'); pv = fn.new('ShaderNodeVolumePrincipled')
pv.inputs['Density'].default_value = 0.0022; pv.inputs['Color'].default_value = (0.6, 0.7, 1.0, 1); pv.inputs['Anisotropy'].default_value = 0.5
fl.new(pv.outputs['Volume'], fo.inputs['Volume']); fog.data.materials.append(fm); fog.display_type = 'WIRE'

# --- Camera: 85mm portrait, slightly low angle for a heroic read
cam = bpy.data.cameras.new('c'); cam.lens = 100; cam.dof.use_dof = True; cam.dof.aperture_fstop = 5.6
co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
co.location = (0.8, -15.0, 1.3)
tgt = Vector((0.0, 0.0, 0.95))
co.rotation_euler = (tgt - co.location).to_track_quat('-Z', 'Y').to_euler()
cam.dof.focus_distance = (tgt - co.location).length - 0.3

print('POLYS', sum(len(o.evaluated_get(bpy.context.evaluated_depsgraph_get()).data.polygons) for o in sc.objects if o.type == 'MESH'))
bpy.ops.render.render(write_still=True)
print('rendered', a.out)

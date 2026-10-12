"""Silicoid — hand-designed base model (no materials). Every vertex is placed deliberately:
  * HEAD  = a cut-gem skull: kite-shaped face that tapers to a pointed chin, overhanging brow, recessed eye sockets, cheek planes
            (most vertices live here — it is the focal point)
  * TORSO = broad inverted-trapezoid of a few big plates (few vertices), short thick neck, heavy angular pauldrons
  * MANE  = crystals in swept-back clusters along the spine/shoulders, graded in size, all flowing the same way (no starburst)
Build = lofting superellipse cross-sections ("stations") along an axis; exponent n: 1 = diamond (sharp facets), 2 = ellipse.
   python3 tools/render/silicoid_model.py --sheet out.png     # front / 3/4 / profile / wireframe contact sheet (Workbench, ~5 s)
   python3 tools/render/silicoid_model.py --export models/silicoid   # writes .obj and .glb"""
import argparse, math, os, random, sys
import bpy, bmesh
from mathutils import Vector, Matrix

ap = argparse.ArgumentParser(); ap.add_argument('--sheet', default=None); ap.add_argument('--export', default=None)
ap.add_argument('--seed', type=int, default=3); ap.add_argument('--pitch', type=float, default=9.0, help='head pitch down, degrees')
a = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])
rnd = random.Random(a.seed)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import modeltools as mt
from modeltools import loft, spow
sc = mt.new_scene()
K = 12

X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
U = -X   # with v = FRONT (-Y):  u x v = +Z, so stations rise along +Z
FRONT = -Y
parts = []

# ---------------------------------------------------------------- HEAD (cut gem). stations bottom -> top, t = height above head origin z=0.92
#            t      rx    ryf   ryb   n    centre(du,dv)   (dv>0 = toward the front)
H = [
 (0.00, 0.11, 0.30, 0.16, 1.0, (0, 0.00)),   # 0 chin point
 (0.14, 0.26, 0.30, 0.26, 1.15, (0, 0.00)),  # 1 jaw
 (0.31, 0.37, 0.31, 0.30, 1.2, (0, 0.00)),   # 2 cheek planes
 (0.41, 0.41, 0.31, 0.32, 1.25, (0, 0.00)),  # 3 cheek shelf (under the eye)
 (0.51, 0.43, 0.29, 0.34, 1.3, (0, 0.00)),   # 4 eye trough (recessed)
 (0.62, 0.45, 0.38, 0.37, 1.35, (0, 0.00)),  # 5 brow ridge (overhangs the trough)
 (0.77, 0.40, 0.30, 0.38, 1.3, (0, 0.00)),   # 6 forehead
 (0.93, 0.31, 0.22, 0.33, 1.5, (0, 0.00)),   # 7 crown edge
 (1.02, 0.18, 0.13, 0.21, 1.8, (0, 0.00)),   # 8 table
]
HF = [   # (t, t_width, angle, angle_width, radial, axial)
 (0.62, 0.045, 0, 60, 0.09, 0),      # brow ridge: one heavy band across the front
 (0.505, 0.04, 30, 14, -0.14, 0),    # eye sockets
 (0.525, 0.03, 0, 8, 0.03, 0),       # nose bridge between the eyes
 (0.30, 0.16, 0, 7, 0.07, 0),        # nose keel running down to the chin
 (0.38, 0.06, 62, 14, 0.05, 0),      # cheekbones
 (0.41, 0.025, 36, 20, 0.05, 0),     # cheek shelf lip under each eye
 (0.72, 0.07, 76, 12, -0.04, 0),     # temple hollows
 (0.14, 0.05, 78, 16, 0.04, 0),      # jaw angles
 (0.20, 0.018, 0, 26, -0.06, 0),     # mouth groove
 (0.09, 0.03, 0, 10, 0.03, 0),       # chin
 (0.80, 0.12, 0, 9, 0.035, 0),       # forehead centre ridge
 (0.55, 0.05, 84, 10, -0.03, 0),     # ear-side plate
]
head = loft('head', Vector((0, 0, 0.92)), U, FRONT, H, k=48, features=HF, dens=34)
pivot = Vector((0, 0.05, 0.92)); R = Matrix.Translation(pivot) @ Matrix.Rotation(math.radians(a.pitch), 4, 'X') @ Matrix.Scale(1.28, 4) @ Matrix.Translation(-pivot)
R3 = Matrix.Rotation(math.radians(a.pitch), 3, 'X')
head.data.transform(R); parts.append(head)

# ---------------------------------------------------------------- NECK + TORSO (few big plates)
neck = loft('neck', Vector((0, 0.02, 0.38)), U, FRONT, [(0, 0.40, 0.26, 0.26, 1.6, (0, 0)), (0.30, 0.25, 0.22, 0.24, 1.6, (0, 0)), (0.58, 0.24, 0.22, 0.24, 1.6, (0, 0))], k=24, dens=5, cap_start=False)
T = [
 (0.00, 0.52, 0.34, 0.30, 1.5, (0, 0)),    # waist
 (0.55, 0.74, 0.40, 0.34, 1.15, (0, 0)),   # ribs
 (0.95, 0.90, 0.42, 0.36, 1.1, (0, 0)),    # chest / shoulder line
 (1.22, 0.70, 0.36, 0.34, 1.3, (0, 0.02)), # trapezius slope
 (1.34, 0.36, 0.28, 0.28, 1.5, (0, 0.0)),  # base of neck
]
TF = [
 (0.70, 0.45, 0, 9, 0.07, 0),        # sternum ridge
 (0.88, 0.10, 36, 22, 0.06, 0),      # pectoral plates
 (0.70, 0.02, 40, 26, -0.05, 0),     # groove under the pecs
 (1.12, 0.03, 32, 30, 0.05, 0),      # collar-bone ridges
 (0.50, 0.02, 0, 55, -0.04, 0), (0.38, 0.02, 0, 55, -0.04, 0), (0.26, 0.02, 0, 55, -0.04, 0), (0.14, 0.02, 0, 55, -0.04, 0),   # armour-segment grooves
 (0.30, 0.20, 90, 14, 0.04, 0),      # flank ridges
]
torso = loft('torso', Vector((0, 0.04, -0.88)), U, FRONT, T, k=48, features=TF, dens=38, cap_end=True)
parts += [neck, torso]

# ---------------------------------------------------------------- PAULDRONS: stacked diamond-section plates, heavier than the head, tilted down and out
def pauldron(sgn, scale=1.0, drop=0.0, name='pauldron'):
    axis = Vector((sgn * 1.0, 0.05, -0.38)).normalized(); up = Vector((0, 0, 1))
    u = axis.cross(up).normalized(); v = axis.cross(u).normalized()            # u ~ front/back, v ~ up
    S = [(0.00, 0.30 * scale, 0.20 * scale, 0.20 * scale, 1.0, (0, 0)), (0.28, 0.46 * scale, 0.28 * scale, 0.24 * scale, 1.05, (0, 0)),
         (0.60, 0.42 * scale, 0.26 * scale, 0.22 * scale, 1.0, (0, 0)), (0.92, 0.26 * scale, 0.16 * scale, 0.14 * scale, 1.0, (0, 0))]
    return loft(name, Vector((sgn * 0.62, 0.0, 0.28 + drop)), u, v, S, k=20, dens=5)
parts += [pauldron(1), pauldron(-1, 1.12), pauldron(1, 0.7, -0.22, 'pauldron_low'), pauldron(-1, 0.78, -0.24, 'pauldron_low')]

# ---------------------------------------------------------------- CRYSTAL MANE: clusters that all sweep back/up in one flow
def crystal(pos, d, length, radius, sides=6, name='crystal'):
    b = bmesh.new(); rings = []
    for z, r, rot in ((0, radius, 0.0), (length * 0.6, radius * 1.02, 0.05), (length * 0.88, radius * 0.96, 0.05)):
        rings.append([b.verts.new((math.cos(2 * math.pi * i / sides + rot) * r, math.sin(2 * math.pi * i / sides + rot) * r * 0.86, z)) for i in range(sides)])
    apex = b.verts.new((radius * 0.05, 0, length)); b.faces.new(rings[0][::-1])
    for kk in range(2):
        for i in range(sides):
            j = (i + 1) % sides; b.faces.new((rings[kk][i], rings[kk][j], rings[kk + 1][j], rings[kk + 1][i]))
    for i in range(sides): b.faces.new((rings[2][i], rings[2][(i + 1) % sides], apex))
    bmesh.ops.recalc_face_normals(b, faces=b.faces[:])
    me = bpy.data.meshes.new(name); b.to_mesh(me); b.free()
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob)
    ob.matrix_world = Matrix.Translation(pos) @ Vector(d).normalized().to_track_quat('Z', 'Y').to_matrix().to_4x4()
    for p in me.polygons: p.use_smooth = False
    return ob

def cluster(pos, d, length, radius, side=1.0, name='cluster'):
    d = Vector(d).normalized(); out = [crystal(pos, d, length, radius, name=name)]
    tw = d.cross(Y if abs(d.dot(Y)) < 0.9 else X).normalized()
    for sg, f, spread in ((1, 0.55, 0.42), (-1, 0.40, 0.55), (1, 0.28, 0.9)):
        dd = (d + tw * sg * spread + Vector((0, 0.1, 0.0))).normalized()
        out.append(crystal(pos + d * radius * 0.2 + tw * sg * radius * 0.7, dd, length * f * rnd.uniform(0.9, 1.1), radius * (0.6 if f > .3 else .45), name=name + '_s'))
    return out
SWEEP = Vector((0, 0.9, 0.5))     # shared flow direction (back and up)
mane = []
for x, z, L, r in ((-0.20, 1.86, 0.9, 0.09), (0.0, 1.9, 1.25, 0.11), (0.2, 1.84, 0.85, 0.085)):     # crown (follows the head's tilt + scale)
    mane += cluster(R @ Vector((x, 0.12, z - 0.12)), R3 @ Vector((x * 1.4, 0.55, 1.0)), L, r, name='crown')
for x, z, L, r in ((-0.22, 1.35, 1.0, 0.1), (0.22, 1.3, 0.9, 0.09)):                                   # nape
    mane += cluster(Vector((x, 0.36, z + 0.1)), (x * 1.2, 0.8, 0.8), L, r, name='nape')
for sgn, k in ((1, 1.0), (-1, 1.25)):                                                                    # shoulder tops: the big drama, left larger
    mane += cluster(Vector((sgn * 0.52, 0.12, 0.62)), (sgn * 0.45, 0.45, 1.0), 1.5 * k, 0.16 * k, name='shoulder')
    mane += cluster(Vector((sgn * 0.88, 0.14, 0.42)), (sgn * 0.8, 0.5, 0.9), 1.15 * k, 0.13 * k, name='shoulder')
    mane += cluster(Vector((sgn * 0.30, 0.34, 0.60)), (sgn * 0.3, 0.9, 0.8), 1.3 * k, 0.12 * k, name='back')
    mane += cluster(Vector((sgn * 0.55, 0.38, 0.1)), (sgn * 0.5, 1.0, 0.45), 0.95 * k, 0.1 * k, name='back')
parts += mane

# ---------------------------------------------------------------- views
mt.finish(parts)
print('parts', len(parts), 'triangles', mt.tri_count(parts), ' head tris', mt.tri_count(parts, head), ' torso tris', mt.tri_count(parts, torso))
if a.export: mt.export(a.export)
if a.sheet: mt.sheet(parts, a.sheet)

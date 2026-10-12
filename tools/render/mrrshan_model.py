"""Mrrshan — hand-designed base model (no materials): a feline warrior bust.
  * SKULL  = broad rounded cranium, wide cheek ruff, heavy brow, slanted eye sockets, sagittal crest
  * MUZZLE = separate tapering loft along the facing axis: nose bridge, nose pad, whisker pads, upper-lip line; fangs; chin
  * EARS   = tall flattened cones with an inner hollow; cheek fur-locks sweep back; whiskers are thin tapered rods
  * BODY   = round-section muscular torso (pecs, sternum groove, abs, traps, lats) with large round deltoids
Rounded form language on purpose (n ~ 2): the opposite of the Silicoid's faceting.
   python3 tools/render/mrrshan_model.py --sheet out.png | --export tools/render/models/mrrshan"""
import argparse, math, os, sys
import bpy, bmesh
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import modeltools as mt
from modeltools import loft

ap = argparse.ArgumentParser(); ap.add_argument('--sheet', default=None); ap.add_argument('--export', default=None)
a = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])
sc = mt.new_scene()
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
U, FRONT = -X, -Y                       # u x v = +Z: stations rise along +Z
parts = []

def basis(axis, hint=Z):
    axis = Vector(axis).normalized(); u = axis.cross(hint if abs(axis.dot(hint)) < 0.95 else X).normalized(); return u, axis.cross(u).normalized()
def S(*rows): return [(r[0], r[1], r[2], r[3], r[4], (0, 0)) for r in rows]

# ---------------------------------------------------------------- SKULL (origin = underside of the jaw)
H = S((0.00, 0.30, 0.31, 0.26, 2.0), (0.22, 0.52, 0.36, 0.34, 2.0), (0.45, 0.56, 0.38, 0.38, 2.1),
      (0.62, 0.50, 0.38, 0.40, 2.1), (0.76, 0.45, 0.40, 0.40, 2.1), (0.92, 0.40, 0.34, 0.38, 2.1), (1.06, 0.30, 0.24, 0.30, 2.1), (1.14, 0.15, 0.12, 0.16, 2.0))
HF = [(0.73, 0.04, 0, 45, 0.045, 0),      # brow (kept low and short so it frames the eyes instead of banding the forehead)
      (0.63, 0.06, 32, 19, -0.13, 0),     # large slanted eye sockets
      (0.70, 0.03, 36, 12, 0.03, 0),      # upper lid ridge, slanting outward
      (0.42, 0.06, 70, 20, 0.05, 0),      # cheek ruff
      (0.95, 0.15, 0, 6, 0.035, 0),       # sagittal crest
      (0.82, 0.08, 80, 10, -0.03, 0),     # temples
      (0.20, 0.06, 80, 18, 0.05, 0),      # jaw hinge
      (0.60, 0.04, 0, 9, 0.03, 0)]        # bridge between the eyes
head = loft('skull', Vector((0, 0.0, 0.95)), U, FRONT, H, k=48, features=HF, dens=30); parts.append(head)

# ---------------------------------------------------------------- MUZZLE (loft along the facing axis, -Y; ring angle 0 = up)
mu_u, mu_v = basis((0, -1, 0), Z)
M = S((0.00, 0.27, 0.21, 0.22, 2.0), (0.16, 0.25, 0.18, 0.21, 2.0), (0.28, 0.22, 0.15, 0.19, 2.0), (0.38, 0.17, 0.11, 0.14, 2.0), (0.44, 0.11, 0.07, 0.09, 2.0))
MF = [(0.14, 0.12, 0, 9, 0.035, 0),       # nose bridge ridge
      (0.22, 0.07, 62, 18, 0.045, 0),     # whisker pads
      (0.20, 0.17, 100, 9, -0.045, 0),    # upper-lip line (sides, low)
      (0.41, 0.04, 0, 70, 0.03, 0),       # nose pad
      (0.43, 0.02, 40, 14, -0.04, 0)]     # nostrils
muzzle = loft('muzzle', Vector((0, -0.31, 1.40)), mu_u, mu_v, M, k=32, features=MF, dens=10); parts.append(muzzle)
chin = loft('chin', Vector((0, -0.25, 1.17)), mu_u, mu_v, S((0.0, 0.17, 0.08, 0.10, 2.0), (0.14, 0.15, 0.07, 0.10, 2.0), (0.26, 0.09, 0.05, 0.07, 2.0)), k=24, dens=4); parts.append(chin)
for sgn in (1, -1):                       # fangs
    fu, fv = basis((sgn * 0.05, -0.18, -1), Z)
    parts.append(loft('fang', Vector((sgn * 0.10, -0.59, 1.32)), fu, fv, S((0, 0.028, 0.028, 0.028, 2), (0.07, 0.022, 0.022, 0.022, 2), (0.14, 0.004, 0.004, 0.004, 2)), k=10, dens=2))

# ---------------------------------------------------------------- EARS, cheek fur-locks, whiskers
for sgn in (1, -1):
    eu, ev = basis((sgn * 0.45, 0.15, 1.0), Z)
    EF = [(0.15, 0.12, 0, 40, -0.035, 0)]
    parts.append(loft('ear', Vector((sgn * 0.34, 0.06, 1.96)), eu, ev, S((0, 0.26, 0.09, 0.09, 1.6), (0.22, 0.23, 0.075, 0.075, 1.6), (0.44, 0.14, 0.05, 0.05, 1.5), (0.60, 0.02, 0.015, 0.015, 1.3)), k=24, features=EF, dens=6))
    for i, (z, ln) in enumerate(((1.34, 0.30), (1.20, 0.28), (1.06, 0.24))):     # fur locks flaring from the cheek ruff
        lu, lv = basis((sgn * 0.55, 0.30 + 0.05 * i, -0.65), Z)
        parts.append(loft('lock', Vector((sgn * (0.50 - 0.03 * i), -0.02 + 0.04 * i, z - 0.0)), lu, lv, S((0, 0.12, 0.05, 0.05, 1.5), (ln * 0.5, 0.10, 0.045, 0.045, 1.5), (ln, 0.015, 0.012, 0.012, 1.3)), k=12, dens=2))
    for i, dz in enumerate((0.07, 0.0, -0.07)):                                   # whiskers
        wu, wv = basis((sgn * 1.0, -0.2 - 0.12 * i, 0.12 + dz * 2), Z)
        parts.append(loft('whisker', Vector((sgn * 0.20, -0.53, 1.36 + dz * 0.6)), wu, wv, S((0, 0.012, 0.012, 0.012, 2), (0.3, 0.008, 0.008, 0.008, 2), (0.62, 0.002, 0.002, 0.002, 2)), k=6, dens=1))

for sgn in (1, -1):            # slanted almond eyeballs seated in the sockets
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1, location=(sgn * 0.26, -0.31, 1.55)); eye = bpy.context.active_object; eye.name = 'eye'
    eye.scale = (0.15, 0.10, 0.095); eye.rotation_euler = (0, math.radians(-sgn * 22), 0)
    for p_ in eye.data.polygons: p_.use_smooth = True
    parts.append(eye)
HEAD_PARTS = list(parts)       # everything built so far belongs to the head
pv = Vector((0, 0, 0.95)); Hx = Matrix.Translation(Vector((0, 0, -0.20))) @ Matrix.Translation(pv) @ Matrix.Scale(1.30, 4) @ Matrix.Translation(-pv)
for ob in HEAD_PARTS: ob.data.transform(Hx)

# ---------------------------------------------------------------- BODY
neck = loft('neck', Vector((0, 0.02, 0.36)), U, FRONT, S((0, 0.50, 0.38, 0.38, 2.0), (0.32, 0.46, 0.35, 0.36, 2.0), (0.62, 0.46, 0.35, 0.36, 2.0)), k=32, dens=5, cap_start=False)
T = S((0.00, 0.50, 0.34, 0.30, 2.0), (0.55, 0.74, 0.40, 0.34, 1.9), (0.95, 0.92, 0.42, 0.36, 1.9), (1.20, 0.76, 0.38, 0.34, 1.9), (1.34, 0.42, 0.32, 0.30, 2.0))
TF = [(0.86, 0.12, 32, 20, 0.08, 0),      # pecs
      (0.80, 0.30, 0, 6, -0.035, 0),      # sternum groove
      (0.70, 0.03, 38, 22, -0.05, 0),     # under-pec line
      (0.46, 0.04, 22, 14, 0.035, 0), (0.30, 0.04, 22, 14, 0.035, 0), (0.14, 0.04, 22, 14, 0.035, 0),   # abdominal blocks
      (0.50, 0.30, 0, 5, -0.03, 0),       # linea alba
      (1.14, 0.10, 20, 40, 0.05, 0),      # traps
      (0.55, 0.35, 100, 16, 0.05, 0)]     # lats
torso = loft('torso', Vector((0, 0.04, -0.88)), U, FRONT, T, k=48, features=TF, dens=38); parts += [neck, torso]
for sgn in (1, -1):                       # round deltoids
    du, dv = basis((sgn * 1.0, 0.0, -0.45), Z)
    parts.append(loft('deltoid', Vector((sgn * 0.62, 0.0, 0.36)), du, dv, S((0, 0.30, 0.26, 0.26, 2.1), (0.25, 0.42, 0.32, 0.32, 2.1), (0.55, 0.44, 0.33, 0.33, 2.1), (0.80, 0.34, 0.27, 0.27, 2.1), (0.92, 0.20, 0.16, 0.16, 2.0)),
                      k=32, features=[(0.35, 0.12, 0, 50, 0.04, 0)], dens=8))

mt.finish(parts, 0.004)
print('parts', len(parts), 'triangles', mt.tri_count(parts), ' skull', mt.tri_count(parts, head), ' torso', mt.tri_count(parts, torso))
if a.export: mt.export(a.export)
if a.sheet: mt.sheet(parts, a.sheet, head_target=(0, -0.2, 1.3), head_dist=5.6)

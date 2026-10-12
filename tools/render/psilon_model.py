"""Psilon — hand-designed base model (no materials): a hairless scholar with an enormous veined cranium over a small, delicate face,
large almond eyes, a thin neck, and a robed torso with a tall flared stand-collar.
   python3 tools/render/psilon_model.py --sheet out.png | --export tools/render/models/psilon | --guides DIR"""
import argparse, math, os, sys
import bpy, bmesh
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import modeltools as mt
from modeltools import loft

ap = argparse.ArgumentParser(); ap.add_argument('--sheet', default=None); ap.add_argument('--export', default=None); ap.add_argument('--guides', default=None)
a = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])
sc = mt.new_scene()
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)); U, FRONT = -X, -Y
parts = []
def basis(axis, hint=Z):
    axis = Vector(axis).normalized(); u = axis.cross(hint if abs(axis.dot(hint)) < 0.95 else X).normalized(); return u, axis.cross(u).normalized()
def S(*rows): return [(r[0], r[1], r[2], r[3], r[4], (0, 0)) for r in rows]

# ---------------------------------------------------------------- HEAD: delicate face, enormous cranium (origin = underside of the chin)
H = S((0.00, 0.10, 0.20, 0.12, 2.0), (0.12, 0.20, 0.24, 0.22, 2.0), (0.28, 0.30, 0.26, 0.28, 2.0), (0.42, 0.38, 0.28, 0.34, 2.0),
      (0.54, 0.44, 0.30, 0.40, 2.0), (0.74, 0.52, 0.34, 0.48, 2.1), (0.98, 0.58, 0.37, 0.58, 2.1), (1.24, 0.54, 0.34, 0.56, 2.1),
      (1.46, 0.42, 0.26, 0.46, 2.1), (1.62, 0.26, 0.15, 0.28, 2.0), (1.70, 0.12, 0.07, 0.14, 2.0))
HF = [(0.43, 0.065, 30, 17, -0.075, 0),     # large eye sockets
      (0.47, 0.05, 0, 9, 0.02, 0),          # nasal bridge
      (0.31, 0.03, 0, 4.5, -0.025, 0),      # nostril slits
      (0.17, 0.016, 0, 15, -0.025, 0),      # small mouth line
      (0.08, 0.04, 0, 14, 0.02, 0),         # delicate chin
      (0.57, 0.04, 0, 55, 0.035, 0),        # smooth brow shelf
      (0.52, 0.06, 78, 11, -0.03, 0),       # temples
      (1.00, 0.34, 28, 5, 0.022, 0), (1.00, 0.34, 56, 5, 0.022, 0), (1.05, 0.30, 84, 5, 0.020, 0), (1.12, 0.26, 0, 4, 0.022, 0),   # cranial vein ridges running up the dome
      (1.20, 0.30, 140, 14, 0.02, 0)]       # occipital bulge
head = loft('head', Vector((0, 0, 0.95)), U, FRONT, H, k=48, features=HF, dens=36); parts.append(head)
for sgn in (1, -1):                         # large dark almond eyes, slanting up and out
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1, location=(sgn * 0.19, -0.255, 1.375)); eye = bpy.context.active_object; eye.name = 'eye'
    eye.scale = (0.125, 0.06, 0.075); eye.rotation_euler = (0, math.radians(-sgn * 24), 0)
    for p_ in eye.data.polygons: p_.use_smooth = True
    parts.append(eye)
HEAD_PARTS = list(parts)
pv = Vector((0, 0.05, 0.95)); Hx = Matrix.Translation(Vector((0, 0, -0.06))) @ Matrix.Translation(pv) @ Matrix.Rotation(math.radians(4), 4, 'X') @ Matrix.Translation(-pv)
for ob in HEAD_PARTS: ob.data.transform(Hx)

# ---------------------------------------------------------------- NECK, ROBED TORSO, STAND-COLLAR, SHOULDERS
neck = loft('neck', Vector((0, 0.03, 0.42)), U, FRONT, S((0, 0.30, 0.22, 0.22, 2.0), (0.25, 0.20, 0.17, 0.18, 2.0), (0.5, 0.19, 0.16, 0.17, 2.0)), k=24, dens=5, cap_start=False)
T = S((0.00, 0.40, 0.30, 0.26, 1.9), (0.55, 0.52, 0.34, 0.30, 1.9), (0.95, 0.64, 0.36, 0.32, 1.8), (1.18, 0.58, 0.32, 0.30, 1.8), (1.34, 0.34, 0.24, 0.24, 2.0))
TF = [(0.35, 0.40, 0, 4, -0.02, 0),         # robe centre seam
      (0.45, 0.30, 62, 8, 0.045, 0), (0.25, 0.28, 74, 8, 0.05, 0), (0.60, 0.25, 50, 8, 0.03, 0),   # drape folds
      (1.10, 0.10, 40, 24, 0.03, 0)]        # yoke over the shoulders
torso = loft('robe', Vector((0, 0.04, -0.88)), U, FRONT, T, k=48, features=TF, dens=30); parts += [neck, torso]
collar = loft('collar', Vector((0, 0.04, 0.38)), U, FRONT, S((0, 0.36, 0.28, 0.30, 1.8), (0.16, 0.38, 0.30, 0.32, 1.8), (0.34, 0.50, 0.34, 0.38, 1.7), (0.50, 0.62, 0.36, 0.42, 1.7)), k=36,
              features=[(0.30, 0.2, 180, 40, 0.06, 0.12), (0.40, 0.12, 0, 30, -0.04, 0)], dens=8, cap_start=False, cap_end=False)   # tall flared collar, higher at the back, open at the front
parts.append(collar)
for sgn in (1, -1):
    du, dv = basis((sgn * 1.0, 0.0, -0.5), Z)
    parts.append(loft('shoulder', Vector((sgn * 0.52, 0.0, 0.30)), du, dv, S((0, 0.20, 0.17, 0.17, 2.1), (0.2, 0.26, 0.21, 0.21, 2.1), (0.42, 0.24, 0.19, 0.19, 2.1), (0.58, 0.12, 0.10, 0.10, 2.0)), k=24, dens=5))

mt.finish(parts, 0.004)
print('parts', len(parts), 'triangles', mt.tri_count(parts), ' head', mt.tri_count(parts, head), ' robe', mt.tri_count(parts, torso))
if a.export: mt.export(a.export)
if a.guides: mt.guides(parts, a.guides)
if a.sheet: mt.sheet(parts, a.sheet, head_target=(0, -0.1, 1.55), head_dist=6.0)

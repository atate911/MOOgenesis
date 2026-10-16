#!/usr/bin/env python3
"""Build the game's photo ship sprites from the Fleet AI candidate PNGs.

    python3 -I tools/build-ship-art.py            (run from the repo root)

For each hull class one candidate (PICKS below) is
  * cropped to its visible bounds (+ a small margin) and downscaled,
  * split into a neutral BASE image (the #FF00FF livery replaced by its own brightness, so it stays shaded grey) and a
    TEAM mask (white, alpha = how "livery" a pixel is).  At runtime Gfx.Ships multiplies the empire colour through the mask,
  * analysed for engine glows (white-cyan blobs at the stern), damage sites, hardpoints and nav-light spots.
Output: assets/ships/ship-<key>.webp, assets/ships/ship-<key>-team.webp, assets/ships/ship-art.json, and the generated
SHIP_ART block inside js/gfx/ships.js (between the @@SHIP_ART@@ markers).  Coordinates are in ship units: the visible hull
spans x = -0.5..0.5 (nose at +x), y has the same scale.
"""
import json, os, re, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'MOOg images', 'fleet-ai-evaluation')
OUT = os.path.join(ROOT, 'assets', 'ships')
JS = os.path.join(ROOT, 'js', 'gfx', 'ships.js')

# one design per class (see tools/handoff/ship-art.md for why)
PICKS = [
    ('frigate', 'original--01-frigate.png'),
    ('destroyer', 'revised--02-destroyer.png'),
    ('cruiser', 'revised--03-cruiser.png'),
    ('battleship', 'revised--04-battleship.png'),
    ('doomstar', 'alternatives--05-doomstar-eclipse.png'),
    ('starbase', 'original--06-starbase.png'),
    ('battlestation', 'revised--07-battlestation.png'),
    ('starfortress', 'alternatives--08-star-fortress-crown.png'),
    ('stargate', 'original--09-stargate.png'),
]
LONG_SIDE = 1024      # px of the visible long side in the shipped image
PAD = 0.03            # margin around the visible bounds (fraction of the long side)


def sstep(a, b, v):
    t = np.clip((v - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def hsv(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    d = mx - mn
    s = np.where(mx > 1e-4, d / np.maximum(mx, 1e-4), 0)
    dd = np.maximum(d, 1e-4)
    h = np.where(mx == r, ((g - b) / dd) % 6, np.where(mx == g, (b - r) / dd + 2, (r - g) / dd + 4)) * 60
    return h, s, mx


def components(mask):
    """4-connected components of a small boolean grid -> list of (ys, xs) arrays."""
    H, W = mask.shape
    seen = np.zeros_like(mask, bool)
    out = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]:
            continue
        stack = [(y0, x0)]
        seen[y0, x0] = True
        ys, xs = [], []
        while stack:
            y, x = stack.pop()
            ys.append(y); xs.append(x)
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        out.append((np.array(ys), np.array(xs)))
    return out


def farthest(points, n, seed_pt):
    """farthest-point sampling (spread-out picks) of n points from an (N, 2) array."""
    if len(points) == 0:
        return []
    picks = [points[np.argmin(((points - seed_pt) ** 2).sum(1))]]
    d = ((points - picks[0]) ** 2).sum(1)
    while len(picks) < min(n, len(points)):
        i = int(np.argmax(d))
        picks.append(points[i])
        d = np.minimum(d, ((points - points[i]) ** 2).sum(1))
    return picks


def r4(v):
    return round(float(v), 4)


def build(key, fname, structure):
    im = Image.open(os.path.join(SRC, fname)).convert('RGBA')
    a = np.asarray(im).astype(np.float32) / 255.0
    alpha = a[..., 3]
    ys, xs = np.nonzero(alpha > 0.5)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    vw, vh = x1 - x0, y1 - y0
    L = max(vw, vh) if structure else vw            # px per ship unit
    pad = int(round(PAD * max(vw, vh)))
    cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0
    hw_px, hh_px = vw / 2.0 + pad, vh / 2.0 + pad
    box = (int(round(cx - hw_px)), int(round(cy - hh_px)), int(round(cx + hw_px)), int(round(cy + hh_px)))
    crop = im.crop(box)                             # out-of-range areas come back transparent
    scale = LONG_SIDE / float(max(vw, vh))
    size = (max(1, int(round(crop.width * scale))), max(1, int(round(crop.height * scale))))
    crop = crop.resize(size, Image.LANCZOS)

    c = np.asarray(crop).astype(np.float32) / 255.0
    rgb, A = c[..., :3], c[..., 3]
    h, s, v = hsv(rgb)
    hd = np.abs(((h - 300) + 180) % 360 - 180)       # hue distance from magenta
    team = sstep(0.16, 0.38, s) * (1 - sstep(24, 42, hd)) * sstep(0.05, 0.16, v)
    tint = sstep(0.08, 0.25, s) * (1 - sstep(40, 70, hd))   # wider band: pink/purple fringes are greyed too
    grey = np.repeat(v[..., None], 3, -1) * 0.94
    lum = (rgb * np.array([0.299, 0.587, 0.114])).sum(-1, keepdims=True)
    base = rgb * (1 - tint[..., None]) + np.repeat(lum, 3, -1) * tint[..., None]
    base = base * (1 - team[..., None]) + grey * team[..., None]
    base_img = Image.fromarray((np.dstack([base, A]).clip(0, 1) * 255).round().astype(np.uint8), 'RGBA')
    team_a = (team * A).clip(0, 1)
    team_img = Image.fromarray((np.dstack([np.ones_like(rgb), team_a]) * 255).round().astype(np.uint8), 'RGBA')
    os.makedirs(OUT, exist_ok=True)
    base_img.save(os.path.join(OUT, 'ship-%s.webp' % key), 'WEBP', quality=88, method=6, alpha_quality=100)
    team_img.save(os.path.join(OUT, 'ship-%s-team.webp' % key), 'WEBP', quality=80, method=6, alpha_quality=90)

    # ---- analysis in ship units (on the shipped image) ----
    Lp = L * scale                                  # px per unit in the shipped image
    H, W = A.shape
    def unit(px, py):
        return (px - W / 2.0) / Lp, (py - H / 2.0) / Lp
    # a coarse grid for sampling
    step = max(1, int(round(W / 220.0)))
    gA = A[::step, ::step]
    gy, gx = np.nonzero(gA > 0.9)
    pts = np.stack([(gx * step - W / 2.0) / Lp, (gy * step - H / 2.0) / Lp], 1) if len(gx) else np.zeros((0, 2))

    eng = []
    if not structure:
        cyan = (A > 0.5) & (v > 0.72) & (((h > 165) & (h < 215) & (s > 0.12)) | ((s < 0.1) & (v > 0.93)))
        cg = cyan[::step, ::step]
        for cys, cxs in components(cg):
            if len(cys) < 3:
                continue
            ux, uy = unit(cxs.mean() * step, cys.mean() * step)
            if ux > -0.2:                            # engines live at the stern (left)
                continue
            r = np.sqrt(len(cys) / np.pi) * step / Lp
            eng.append((ux, uy, r, len(cys)))
        eng.sort(key=lambda e: -e[3])
        eng = eng[:8]
        # nozzle = rear edge of the blob
        eng = [{'x': r4(e[0] - e[2] * 0.5), 'y': r4(e[1]), 'r': r4(min(max(e[2] * 0.9, 0.012), 0.06))} for e in eng]

    hy = vh / 2.0 / L                                # visible half-height (units)
    hx = vw / 2.0 / L
    rr = np.random.default_rng(sum(map(ord, key)))   # deterministic per class
    sites = []
    if len(pts):
        for i in rr.choice(len(pts), size=min(6, len(pts)), replace=False):
            sites.append({'x': r4(pts[i][0]), 'y': r4(pts[i][1]), 's': r4(0.035 + rr.random() * 0.04)})
    tr = 0.018 if structure else max(0.012, min(0.028, hy * 0.12))
    fore = pts[pts[:, 0] > -0.15] if len(pts) else pts
    turrets = [{'x': r4(p[0]), 'y': r4(p[1]), 'r': r4(tr)} for p in farthest(fore, 8, np.array([0.5, 0]))]
    flank = pts[np.abs(pts[:, 1]) > hy * 0.45] if len(pts) else pts
    racks = [{'x': r4(p[0]), 'y': r4(p[1]), 'r': r4(tr * 1.2)} for p in farthest(flank if len(flank) else pts, 4, np.array([0, hy]))]
    def nearest(x, y):
        if not len(pts):
            return {'x': x, 'y': y}
        p = pts[np.argmin(((pts - [x, y]) ** 2).sum(1))]
        return {'x': r4(p[0]), 'y': r4(p[1])}
    pod = dict(nearest(0.02, 0), r=r4(max(0.03, min(0.07, hy * 0.35))))
    bay = dict(nearest(-0.12, 0), r=r4(max(0.04, min(0.09, hx * 0.18))), w=r4(max(0.02, min(0.05, hy * 0.25))))
    troop = [dict(nearest(x, y), r=r4(max(0.02, min(0.04, hy * 0.2)))) for x, y in ((0.12, -hy * 0.45), (0.12, hy * 0.45), (-0.22, -hy * 0.45), (-0.22, hy * 0.45))]
    lights = []
    if len(pts):
        top, bot = pts[np.argmin(pts[:, 1])], pts[np.argmax(pts[:, 1])]
        lights = [{'x': r4(top[0]), 'y': r4(top[1]), 'r': 0.008, 'c': [255, 80, 70], 'kind': 'blink', 'per': 1.6, 'ph': 0.0},
                  {'x': r4(bot[0]), 'y': r4(bot[1]), 'r': 0.008, 'c': [90, 255, 140], 'kind': 'blink', 'per': 1.6, 'ph': 0.5}]
    hole = 0
    if structure and A[H // 2, W // 2] < 0.5:      # open centre (gate / ring): radius of the clear aperture
        rs = []
        for t in np.linspace(0, 2 * np.pi, 48, endpoint=False):
            for rpx in range(1, min(W, H) // 2):
                px, py = int(W / 2 + np.cos(t) * rpx), int(H / 2 + np.sin(t) * rpx)
                if A[py, px] > 0.5:
                    rs.append(rpx)
                    break
        hole = r4(min(rs) / Lp) if rs else 0
    return {
        'src': fname, 'hole': hole,
        'ext': [r4(W / 2.0 / Lp), r4(H / 2.0 / Lp)],   # half extents of the image, units
        'hw': r4(hy), 'hl': r4(hx),                    # visible half height / half length, units
        'team': r4(float((team * (A > 0.5)).sum() / max(1, (A > 0.5).sum()))),
        'eng': eng, 'sites': sites, 'lights': lights,
        'hard': {'turret': turrets, 'rack': racks, 'pod': [pod], 'bay': [bay], 'troop': troop},
    }


def main():
    meta = {}
    for key, fname in PICKS:
        structure = key in ('starbase', 'battlestation', 'starfortress', 'stargate')
        meta[key] = build(key, fname, structure)
        m = meta[key]
        print('%-14s ext=%s hw=%.3f team=%.1f%% engines=%d' % (key, m['ext'], m['hw'], m['team'] * 100, len(m['eng'])))
    with open(os.path.join(OUT, 'ship-art.json'), 'w') as f:
        json.dump(meta, f, indent=1)
    js = open(JS).read()
    block = '/* @@SHIP_ART@@ generated by tools/build-ship-art.py — do not edit by hand */\n  const SHIP_ART = ' + \
        json.dumps(meta, separators=(',', ':')) + ';\n  /* @@/SHIP_ART@@ */'
    new, n = re.subn(r'/\* @@SHIP_ART@@.*?/\* @@/SHIP_ART@@ \*/', lambda _: block, js, flags=re.S)
    if n != 1:
        sys.exit('SHIP_ART markers not found in js/gfx/ships.js')
    open(JS, 'w').write(new)


if __name__ == '__main__':
    main()

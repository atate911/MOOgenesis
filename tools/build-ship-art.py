#!/usr/bin/env python3
"""Build the game's photo ship sprites (several image variants per hull class).

    python3 -I tools/build-ship-art.py [SOURCE_DIR ...]          (run from the repo root)

Sources: every .png/.webp in the given folders (default: "MOOg images/fleet-ai-evaluation" + "MOOg images/ship-variants")
whose filename names a hull class (frigate, destroyer, cruiser, battleship, doomstar, starbase, battlestation, star-fortress,
stargate) becomes one variant of that class, in filename order; near-duplicates are skipped.  The class's DEFAULT_PICKS
image is always variant 1 when present (structures and screens without a design use variant 1).  With explicit folders,
a class with no images there keeps its DEFAULT_PICKS image; --with-defaults adds it even when it has images.
In-game, each ship design gets a stable pseudo-random variant of its class (hash of empire + slot + name).

Each variant is
  * keyed out of a flat #00FF00 background if the image has no transparency, cropped to its visible bounds (+ margin), downscaled,
  * split into a neutral BASE image (the #FF00FF livery replaced by its own brightness, so it stays shaded grey) and a
    TEAM mask (white, alpha = how "livery" a pixel is).  At runtime Gfx.Ships multiplies the empire colour through the mask,
  * analysed for engine glows (white-cyan blobs at the stern), damage sites, hardpoints and nav-light spots.
Art rules: top-down, nose pointing RIGHT (+x) for mobile ships, grey hull, #FF00FF livery, white-cyan engines.
Output: assets/ships/ship-<class>-<n>.webp + ship-<class>-<n>-team.webp (n from 1), assets/ships/ship-art.json, and the
generated SHIP_ART block inside js/gfx/ships.js (between the @@SHIP_ART@@ markers).  Stale ship-*.webp files are removed.
Coordinates are in ship units: the visible hull spans x = -0.5..0.5 (nose at +x), y has the same scale.

Second view ("3q", the 3/4 beauty angle; docs/IMAGE-GEN-SPRITES.md): a source whose filename names the class AND contains
the token `3q` (e.g. frigate-3q.png, 02-destroyer-3q.png, frigate-2-3q.png) is the 3/4 view of that class.  It pairs with
the top-down variant of the same number (`<class>-<n>-3q`; no number = variant 1); a class with a single 3q image lends
it to every variant.  Same keying / crop / livery split; written as ship-<class>-<n>-3q.webp + -3q-team.webp and recorded
under the variant's `q` key (ext, hw, hl, eng, lights, sites, dir).  Units for the 3q view: the longer visible side = 1.
Nothing changes when no 3q image exists (today): `q` is simply absent and Gfx.Ships falls back to the top view.
"""
import glob, json, os, re, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FLEET_AI = os.path.join(ROOT, 'MOOg images', 'fleet-ai-evaluation')
VARIANTS = os.path.join(ROOT, 'MOOg images', 'ship-variants')
OUT = os.path.join(ROOT, 'assets', 'ships')
JS = os.path.join(ROOT, 'js', 'gfx', 'ships.js')

CLASSES = ['frigate', 'destroyer', 'cruiser', 'battleship', 'doomstar', 'starbase', 'battlestation', 'starfortress', 'stargate']
STRUCTURES = ('starbase', 'battlestation', 'starfortress', 'stargate')
# filename -> class (first match wins; battlestation before battleship is not needed but kept explicit)
CLASS_RE = [(k, re.compile(r)) for k, r in [
    ('battlestation', r'battle[-_ ]?station'), ('battleship', r'battle[-_ ]?ship'), ('starfortress', r'star[-_ ]?fortress|fortress'),
    ('stargate', r'star[-_ ]?gate'), ('starbase', r'star[-_ ]?base'), ('doomstar', r'doom[-_ ]?star'),
    ('frigate', r'frigate'), ('destroyer', r'destroyer'), ('cruiser', r'cruiser')]]
# Fleet AI picks (see tools/handoff/ship-art.md for why)
DEFAULT_PICKS = {
    'frigate': 'original--01-frigate.png',
    'destroyer': 'revised--02-destroyer.png',
    'cruiser': 'revised--03-cruiser.png',
    'battleship': 'revised--04-battleship.png',
    'doomstar': 'alternatives--05-doomstar-eclipse.png',
    'starbase': 'original--06-starbase.png',
    'battlestation': 'revised--07-battlestation.png',
    'starfortress': 'alternatives--08-star-fortress-crown.png',
    'stargate': 'original--09-stargate.png',
}
LONG_SIDE = 1024      # px of the visible long side in the shipped image
PAD = 0.03            # margin around the visible bounds (fraction of the long side)
Q_RE = re.compile(r'(^|[-_ .])3q([-_ .]|$)')            # the 3/4-view token in a filename
Q_NUM_RE = re.compile(r'[-_ ](\d+)[-_ ]3q')               # <class>-<n>-3q -> pairs with top-down variant n
Q_AXIS_DEG = 30.0     # the 3/4 view's ship axis: nose points to the lower right, this many degrees below the horizontal
FX_DIR = os.path.join(ROOT, 'MOOg images', 'fx')


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


def key_green(im):
    """images without transparency: remove a flat #00FF00 background (with soft edges and green-spill suppression)"""
    a = np.asarray(im).astype(np.float32) / 255.0
    if a[..., 3].min() < 0.99:
        return im
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    gk = g - np.maximum(r, b)                      # how much greener than the other channels
    alpha = 1 - sstep(0.18, 0.45, gk) * sstep(0.35, 0.6, g)
    g2 = np.minimum(g, np.maximum(r, b) + 0.06)    # despill the fringe
    out = np.dstack([r, np.where(alpha < 1, g2, g), b, alpha])
    return Image.fromarray((out.clip(0, 1) * 255).round().astype(np.uint8), 'RGBA')


def build(key, path, stem, structure, view='top'):
    im = key_green(Image.open(path).convert('RGBA'))
    a = np.asarray(im).astype(np.float32) / 255.0
    alpha = a[..., 3]
    ys, xs = np.nonzero(alpha > 0.5)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    vw, vh = x1 - x0, y1 - y0
    q = view == '3q'
    L = max(vw, vh) if (structure or q) else vw      # px per ship unit (3/4 view: the longer visible side)
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
    base_img.save(os.path.join(OUT, stem + '.webp'), 'WEBP', quality=88, method=4, alpha_quality=100)
    team_img.save(os.path.join(OUT, stem + '-team.webp'), 'WEBP', quality=80, method=4, alpha_quality=90)

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
    # 3/4 view: the ship axis runs from the stern (upper left) to the nose (lower right) at Q_AXIS_DEG below the horizontal;
    # engines are the white-cyan blobs whose projection on that axis lies in the rear 40 %, nozzle = the blob's rear edge
    ax, ay = np.cos(np.radians(Q_AXIS_DEG)), np.sin(np.radians(Q_AXIS_DEG))
    if not structure:
        cyan = (A > 0.5) & (v > 0.72) & (((h > 165) & (h < 215) & (s > 0.12)) | ((s < 0.1) & (v > 0.93)))
        cg = cyan[::step, ::step]
        for cys, cxs in components(cg):
            if len(cys) < 3:
                continue
            ux, uy = unit(cxs.mean() * step, cys.mean() * step)
            if (ux * ax + uy * ay if q else ux) > -0.2:   # engines live at the stern
                continue
            r = np.sqrt(len(cys) / np.pi) * step / Lp
            eng.append((ux, uy, r, len(cys)))
        eng.sort(key=lambda e: -e[3])
        eng = eng[:8]
        # nozzle = rear edge of the blob
        if q:
            eng = [{'x': r4(e[0] - e[2] * 0.5 * ax), 'y': r4(e[1] - e[2] * 0.5 * ay), 'r': r4(min(max(e[2] * 0.9, 0.012), 0.06))} for e in eng]
        else:
            eng = [{'x': r4(e[0] - e[2] * 0.5), 'y': r4(e[1]), 'r': r4(min(max(e[2] * 0.9, 0.012), 0.06))} for e in eng]

    hy = vh / 2.0 / L                                # visible half-height (units)
    hx = vw / 2.0 / L
    rr = np.random.default_rng(sum(map(ord, stem)))  # deterministic per variant
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
    if q:
        return {
            'file': stem, 'src': os.path.relpath(path, ROOT),
            'ext': [r4(W / 2.0 / Lp), r4(H / 2.0 / Lp)], 'hw': r4(hy), 'hl': r4(hx),
            'team': r4(float((team * (A > 0.5)).sum() / max(1, (A > 0.5).sum()))),
            'eng': eng, 'sites': sites, 'lights': lights,
            'dir': r4(np.radians(180 + Q_AXIS_DEG)),   # direction the engine flames point (towards the stern), radians, image frame
        }
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
        'file': stem, 'src': os.path.relpath(path, ROOT), 'hole': hole,
        'ext': [r4(W / 2.0 / Lp), r4(H / 2.0 / Lp)],   # half extents of the image, units
        'hw': r4(hy), 'hl': r4(hx),                    # visible half height / half length, units
        'team': r4(float((team * (A > 0.5)).sum() / max(1, (A > 0.5).sum()))),
        'eng': eng, 'sites': sites, 'lights': lights,
        'hard': {'turret': turrets, 'rack': racks, 'pod': [pod], 'bay': [bay], 'troop': troop},
    }


def thumb(path):
    """small grey silhouette+shading fingerprint of the visible ship (catches re-uploads and re-framed copies)"""
    im = key_green(Image.open(path).convert('RGBA'))
    bb = im.getchannel('A').point(lambda a: 255 if a > 128 else 0).getbbox()
    g = im.crop(bb).convert('LA').resize((48, 24), Image.BILINEAR)
    return np.asarray(g).astype(np.float32) / 255.0


def sources(argv):
    """class -> image paths.  Default folders: the Fleet AI set + MOOg images/ship-variants.  Near-identical images (the
    Fleet AI 'revised' set reuses four originals) are kept once; the class's DEFAULT_PICK comes first, so it is variant 1."""
    dirs = [a for a in argv if not a.startswith('--')] or [FLEET_AI] + ([VARIANTS] if os.path.isdir(VARIANTS) else [])
    found = {k: [] for k in CLASSES}
    for d in dirs:
        for f in sorted(glob.glob(os.path.join(d, '**', '*'), recursive=True)):
            name = os.path.basename(f).lower()
            if not name.endswith(('.png', '.webp')) or name.endswith(('-team.webp', '-team.png')) or Q_RE.search(name):
                continue
            for k, rx in CLASS_RE:
                if rx.search(name):
                    found[k].append(f)
                    break
    out = {}
    for k in CLASSES:
        dflt = os.path.join(FLEET_AI, DEFAULT_PICKS[k])
        cand = found[k][:]
        if dflt in cand:
            cand.remove(dflt)
            cand.insert(0, dflt)
        elif not cand or '--with-defaults' in argv:
            cand.insert(0, dflt)
        keep, prints = [], []
        for f in cand:
            t = thumb(f)
            if any(np.abs(t - q).mean() < 0.035 for q in prints):
                print('  skip duplicate %s' % os.path.relpath(f, ROOT))
                continue
            keep.append(f); prints.append(t)
        out[k] = keep
    return out


def q_sources(argv):
    """class -> {variant number: 3/4-view image path}.  Default folders: ship-variants + fx (explicit folders: those)."""
    dirs = [a for a in argv if not a.startswith('--')] or [d for d in (VARIANTS, FX_DIR) if os.path.isdir(d)]
    out = {k: {} for k in CLASSES}
    for d in dirs:
        for f in sorted(glob.glob(os.path.join(d, '**', '*'), recursive=True)):
            name = os.path.basename(f).lower()
            if not name.endswith(('.png', '.webp')) or name.endswith(('-team.webp', '-team.png')) or not Q_RE.search(name):
                continue
            for k, rx in CLASS_RE:
                if rx.search(name):
                    m = Q_NUM_RE.search(name)
                    n = int(m.group(1)) if m else 1
                    out[k].setdefault(n, f)
                    break
    return out


def main():
    src = sources(sys.argv[1:])
    qsrc = q_sources(sys.argv[1:])
    os.makedirs(OUT, exist_ok=True)
    for f in glob.glob(os.path.join(OUT, 'ship-*.webp')):   # drop stale variants
        os.remove(f)
    meta = {}
    for key in CLASSES:
        meta[key] = []
        for i, path in enumerate(src[key]):
            m = build(key, path, 'ship-%s-%d' % (key, i + 1), key in STRUCTURES)
            meta[key].append(m)
            print('%-14s #%d %-48s ext=%s hw=%.3f team=%.1f%% engines=%d' % (key, i + 1, os.path.basename(path)[:48], m['ext'], m['hw'], m['team'] * 100, len(m['eng'])))
        # 3/4 view: variant n takes <class>-<n>-3q, else the class's first 3q image (a single image serves every variant)
        qs = qsrc[key]
        if qs:
            built = {}
            for i in range(len(meta[key])):
                n = i + 1 if (i + 1) in qs else sorted(qs)[0]
                if n not in built:
                    built[n] = build(key, qs[n], 'ship-%s-%d-3q' % (key, n), key in STRUCTURES, '3q')
                    print('%-14s #%d 3q %-45s ext=%s engines=%d' % (key, n, os.path.basename(qs[n])[:45], built[n]['ext'], len(built[n]['eng'])))
                meta[key][i]['q'] = built[n]
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

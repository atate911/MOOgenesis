# python3 -I histo.py  — RGB histogram statistics of every raster in assets/art (+ race portraits), grouped by category, with outliers,
# and the same statistics for the interface's own tones (sampled from the audit screenshots) so the two can be compared.
import os, glob, math, collections, sys
from PIL import Image
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
def luma(r, g, b): return 0.2126 * r + 0.7152 * g + 0.0722 * b
def stats(im, mask=None):
    im = im.convert('RGBA'); w, h = im.size; s = max(1, int(math.sqrt(w * h / 40000)))
    sm = im.resize((max(1, w // s), max(1, h // s)))
    px = [p for p in sm.getdata() if p[3] > 128]
    if len(px) < 50: return None
    n = len(px); R = sum(p[0] for p in px) / n; G = sum(p[1] for p in px) / n; B = sum(p[2] for p in px) / n
    L = sorted(luma(*p[:3]) for p in px)
    p1, p50, p99 = L[int(n * .01)], L[n // 2], L[int(n * .99)]
    meanL = sum(L) / n; sd = math.sqrt(sum((v - meanL) ** 2 for v in L) / n)
    sat = sum((max(p[:3]) - min(p[:3])) / max(1, max(p[:3])) for p in px) / n
    black = sum(1 for v in L if v < 8) / n; white = sum(1 for v in L if v > 248) / n
    # colour cast: warm (R-B) and tint (G vs mean of R,B) in mean-channel space
    return dict(n=n, R=R, G=G, B=B, meanL=meanL, p1=p1, p50=p50, p99=p99, sd=sd, sat=sat, black=black, white=white, warm=R - B, tint=G - (R + B) / 2)
def fmt(s): return '%5.0f %5.0f %5.0f | L %5.1f  p1 %3.0f p50 %3.0f p99 %3.0f  sd %4.1f | sat %.2f  blk %4.1f%% wht %4.1f%% | warm %+5.1f tint %+5.1f' % (s['R'], s['G'], s['B'], s['meanL'], s['p1'], s['p50'], s['p99'], s['sd'], s['sat'], 100 * s['black'], 100 * s['white'], s['warm'], s['tint'])
cats = collections.OrderedDict()
files = sorted(glob.glob(ROOT + '/assets/art/*/*.webp')) + sorted(glob.glob(ROOT + '/assets/races/*-portrait.webp'))
for f in files:
    cat = os.path.basename(os.path.dirname(f)) if '/art/' in f else 'portrait'
    if cat == 'races':
        base = os.path.basename(f); cat = 'races-' + base.split('-')[-1].replace('.webp', '')
    if cat == 'fx': continue                                     # alpha cutouts (rocks, debris): not a backdrop
    try: s = stats(Image.open(f))
    except Exception as e: print('skip', f, e); continue
    if s: cats.setdefault(cat, []).append((os.path.basename(f), s))
print('%-22s %4s  %s' % ('category', 'n', 'R     G     B   | luma stats                            | sat  black  white  | cast'))
agg = {}
for cat, rows in cats.items():
    keys = ['R', 'G', 'B', 'meanL', 'p1', 'p50', 'p99', 'sd', 'sat', 'black', 'white', 'warm', 'tint']
    m = {k: sum(r[1][k] for r in rows) / len(rows) for k in keys}; agg[cat] = (m, rows)
    print('%-22s %4d  %s' % (cat, len(rows), fmt(m)))
print()
print('== outliers inside a category (luma or warmth more than 1.6 sd from the category mean; categories with 4+ files) ==')
for cat, (m, rows) in agg.items():
    if len(rows) < 4: continue
    for k in ('meanL', 'warm', 'sat'):
        vals = [r[1][k] for r in rows]; mu = sum(vals) / len(vals); sd = math.sqrt(sum((v - mu) ** 2 for v in vals) / len(vals)) or 1e-9
        for name, s in rows:
            z = (s[k] - mu) / sd
            if abs(z) > 1.6 and sd > (3 if k != 'sat' else 0.04): print('  %-14s %-40s %-5s %7.1f  (cat %6.1f, z %+.1f)' % (cat, name, k, s[k], mu, z))
print()
print('== the interface (regions of the audit screenshots) ==')
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'out', 'audit')
regions = { 'sky (map, no panel)': ('desktop-galaxy.png', (40, 120, 1300, 1000)), 'colony panel (steel)': ('desktop-galaxy.png', (1440, 280, 1900, 520)),
            'leather frame (planets head)': ('desktop-planets.png', (40, 20, 1880, 80)), 'leather boxes (planets foot)': ('desktop-planets.png', (40, 840, 1880, 1050)),
            'research (whole)': ('desktop-tech.png', (0, 0, 1920, 1080)), 'options (indigo cards)': ('desktop-options.png', (400, 150, 1520, 980)),
            'design (grey metal)': ('desktop-design.png', (370, 60, 1300, 1060)), 'system view (whole)': ('desktop-system.png', (0, 0, 1920, 1080)) }
for name, (f, box) in regions.items():
    p = os.path.join(D, f)
    if not os.path.exists(p): continue
    s = stats(Image.open(p).crop(box))
    print('%-30s %s' % (name, fmt(s)))

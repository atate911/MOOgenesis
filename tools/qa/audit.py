# python3 -I audit.py [desktop|phone]  — scores each audit screenshot: text contrast against the pixels behind it, luminosity /
# saturation / highlight balance, and the spacing rhythm (distinct padding and gap values in rem).
import json, sys, os, glob, collections
from PIL import Image
import os
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'out', 'audit')
prof = sys.argv[1] if len(sys.argv) > 1 else 'desktop'
only = sys.argv[2] if len(sys.argv) > 2 else None
NF = 60 if only else 8
def lum(rgb):
    r, g, b = (c / 255 for c in rgb[:3])
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
def cr(a, b):
    la, lb = lum(a), lum(b); hi, lo = max(la, lb), min(la, lb); return (hi + 0.05) / (lo + 0.05)
def parse_css_color(s):
    s = s.strip()
    if s.startswith('rgb'):
        v = [float(x) for x in s[s.index('(') + 1:s.index(')')].replace('/', ',').split(',')]
        return (int(v[0]), int(v[1]), int(v[2]), v[3] if len(v) > 3 else 1.0)
    return (255, 255, 255, 1.0)
def blend(fg, bg, a): return tuple(int(fg[i] * a + bg[i] * (1 - a)) for i in range(3))
def bg_of(im, x, y, w, h, text_rgb):
    # the most common colour in the box (plus a 2px ring), excluding colours near the text colour
    x0, y0 = max(0, int(x) - 2), max(0, int(y) - 2); x1, y1 = min(im.width, int(x + w) + 2), min(im.height, int(y + h) + 2)
    if x1 <= x0 or y1 <= y0: return None
    px = im.crop((x0, y0, x1, y1)).getdata()
    cnt = collections.Counter()
    for p in px:
        if sum(abs(p[i] - text_rgb[i]) for i in range(3)) < 90: continue
        cnt[(p[0] >> 3 << 3, p[1] >> 3 << 3, p[2] >> 3 << 3)] += 1
    if not cnt: return None
    return cnt.most_common(1)[0][0]
def hsv_sat(p):
    mx, mn = max(p[:3]), min(p[:3]); return 0 if mx == 0 else (mx - mn) / mx
rows = []
for jf in sorted(glob.glob(os.path.join(D, prof + '-*.json'))):
    name = os.path.basename(jf)[len(prof) + 1:-5]
    if only and name != only: continue
    data = json.load(open(jf)); im = Image.open(jf[:-5] + '.png').convert('RGB')
    # ---- luminosity / saturation / highlight share (on a 1/4 scale copy)
    sm = im.resize((im.width // 4, im.height // 4)); px = list(sm.getdata()); n = len(px)
    L = [0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2] for p in px]
    meanL = sum(L) / n; black = sum(1 for v in L if v < 12) / n; hi = sum(1 for v in L if v > 235) / n
    sat = sum(hsv_sat(p) for p in px if (0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) > 30) / max(1, sum(1 for p in px if (0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) > 30))
    # ---- text contrast
    fails = []
    for t in data['texts']:
        c = parse_css_color(t['color']); rgb = c[:3]
        bg = bg_of(im, t['x'], t['y'], t['w'], t['h'], rgb)
        if bg is None: continue
        fg = blend(rgb, bg, c[3] * t['op'])
        ratio = cr(fg, bg)
        large = t['fs'] >= 24 or (t['fs'] >= 18.66 and int(t['fw'] if str(t['fw']).isdigit() else 400) >= 700)
        need = 3.0 if large else 4.5
        if ratio < need: fails.append((ratio, t['fs'], t['s'], t['sel'], '#%02x%02x%02x' % fg, '#%02x%02x%02x' % bg))
    fails.sort()
    # ---- spacing rhythm
    rem = data['rem']; vals = collections.Counter()
    for b in data['boxes']:
        for v in b['pad'] + (b['gap'] or []):
            if v > 0: vals[round(v / rem, 2)] += 1
    distinct = len(vals); offgrid = sum(c for v, c in vals.items() if abs(v * 8 - round(v * 8)) > 0.02)   # not on a 1/8 rem step
    rows.append((name, meanL, black, hi, sat, len(data['texts']), len(fails), distinct, offgrid, sum(vals.values()), fails[:NF], vals.most_common(6)))
print('%-12s %6s %6s %6s %5s %5s %5s %7s %8s' % ('screen', 'meanL', 'black%', 'hi%', 'sat', 'texts', 'fail', 'spacing', 'offgrid%'))
for r in rows:
    print('%-12s %6.1f %6.1f %6.2f %5.2f %5d %5d %7d %8.0f' % (r[0], r[1], r[2] * 100, r[3] * 100, r[4], r[5], r[6], r[7], 100 * r[8] / max(1, r[9])))
print()
for r in rows:
    if not r[10]: continue
    print('== %s: worst text contrast (ratio, px, text, selector, fg on bg)' % r[0])
    for f in r[10]: print('   %4.1f  %4.1fpx  %-28s  %-60s  %s on %s' % (f[0], f[1], f[2][:28], f[3][-60:], f[4], f[5]))
    print('   spacing values (rem: count):', ', '.join('%s:%d' % (v, c) for v, c in r[11]))

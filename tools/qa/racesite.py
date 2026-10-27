# python3 -I racesite.py <tag> [<tag2>]  — scores the race photos in situ: for each race and site, the art rectangle's luma (mean, p10, p50,
# p90, p99, black and white shares) and the surround's mean luma; with a second tag, a before → after table.
import json, os, sys, glob, collections
from PIL import Image
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'out', 'racesite')
RACES = ['human', 'mrrshan', 'silicoid', 'sakkra', 'psilon', 'alkari', 'klackon', 'bulrathi', 'meklar', 'darlok']
def lum(p): return .2126 * p[0] + .7152 * p[1] + .0722 * p[2]
def st(im, box):
    x0, y0, x1, y1 = (int(round(v)) for v in box); x0, y0 = max(0, x0), max(0, y0); x1, y1 = min(im.width, x1), min(im.height, y1)
    if x1 - x0 < 2 or y1 - y0 < 2: return None
    c = im.crop((x0, y0, x1, y1)); w, h = c.size; s = max(1, int((w * h / 30000) ** .5)); c = c.resize((max(1, w // s), max(1, h // s)))
    L = sorted(lum(p) for p in c.getdata()); n = len(L)
    return dict(L=sum(L) / n, p10=L[int(n * .1)], p50=L[n // 2], p90=L[int(n * .9)], p99=L[int(n * .99)], blk=100 * sum(1 for v in L if v < 8) / n, wht=100 * sum(1 for v in L if v > 245) / n)
def ring(im, r, pad=18):
    # the surround: a band outside the rect
    boxes = [(r['x'] - pad, r['y'] - pad, r['x'] + r['w'] + pad, r['y']), (r['x'] - pad, r['y'] + r['h'], r['x'] + r['w'] + pad, r['y'] + r['h'] + pad),
             (r['x'] - pad, r['y'], r['x'], r['y'] + r['h']), (r['x'] + r['w'], r['y'], r['x'] + r['w'] + pad, r['y'] + r['h'])]
    vals = []
    for b in boxes:
        s = st(im, b)
        if s: vals.append(s['L'])
    return sum(vals) / len(vals) if vals else None
def collect(tag):
    out = {}   # (race, site) -> {art: stats, sur: L}
    f = os.path.join(D, tag + '-all-almanac.json')
    if os.path.exists(f):
        im = Image.open(f[:-5] + '.png').convert('RGB')
        for r in json.load(open(f)):
            race = next((x for x in RACES if r['race'].startswith(x)), r['race'])
            out[(race, 'almanac')] = dict(art=st(im, (r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h'])), sur=ring(im, r))
    for race in RACES:
        f = os.path.join(D, '%s-%s-races.json' % (tag, race))
        if os.path.exists(f):
            im = Image.open(f[:-5] + '.png').convert('RGB'); d = json.load(open(f))
            for r in d['pics']:
                if r['race']: out[(r['race'], 'races card')] = dict(art=st(im, (r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h'])), sur=st(im, (r['fx'], r['fy'], r['fx'] + r['fw'], r['fy'] + r['fh']))['L'])
        f = os.path.join(D, '%s-%s-report.json' % (tag, race))
        if os.path.exists(f):
            im = Image.open(f[:-5] + '.png').convert('RGB'); d = json.load(open(f))
            if d.get('pic'): r = d['pic']; out[(race, 'report pic')] = dict(art=st(im, (r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h'])), sur=st(im, (d['left']['x'], d['left']['y'], d['left']['x'] + d['left']['w'], d['left']['y'] + d['left']['h']))['L'] if d.get('left') else None)
            if d.get('doss'): r = d['doss']; out[(race, 'report dossier')] = dict(art=st(im, (r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h'] * .7)), sur=None)
        f = os.path.join(D, '%s-%s-audience.png' % (tag, race))
        if os.path.exists(f):
            im = Image.open(f).convert('RGB'); W, H = im.size
            out[(race, 'audience hall')] = dict(art=st(im, (W * .78, H * .06, W * .98, H * .55)), sur=None)
            out[(race, 'audience leader')] = dict(art=st(im, (W * .45, H * .12, W * .75, H * .7)), sur=None)
            out[('human', 'audience envoy in ' + race)] = dict(art=st(im, (W * .04, H * .08, W * .28, H * .6)), sur=None)
    return out
def fmt(s): return '%4.0f %4.0f %4.0f %4.0f %4.0f %5.1f %4.1f' % (s['L'], s['p10'], s['p50'], s['p90'], s['p99'], s['blk'], s['wht']) if s else ' ' * 33
tags = sys.argv[1:3]
A = collect(tags[0]); B = collect(tags[1]) if len(tags) > 1 else None
sites = ['almanac', 'races card', 'report pic', 'report dossier', 'audience hall', 'audience leader']
print('%-9s %-16s | %s%s | sur' % ('race', 'site', 'L  p10  p50  p90  p99   blk  wht', '   →   L  p10  p50  p90  p99   blk  wht' if B else ''))
for site in sites:
    for race in RACES:
        k = (race, site); a = A.get(k)
        if not a or not a['art']: continue
        b = B.get(k) if B else None
        print('%-9s %-16s | %s%s | %s' % (race, site, fmt(a['art']), ('   →  ' + fmt(b['art'])) if b and b['art'] else '', '%4.0f' % a['sur'] if a['sur'] is not None else '  - '))
    print()
print('envoy (the human figure) in each hall:')
for race in RACES:
    k = ('human', 'audience envoy in ' + race); a = A.get(k)
    if a and a['art']: b = B.get(k) if B else None; print('  in %-9s | %s%s' % (race, fmt(a['art']), ('   →  ' + fmt(b['art'])) if b and b['art'] else ''))

# Builds the A/B review page (tools/concert/review-page.html) from the renders of tools/concert/review.js:
#   python3 tools/concert/review-build.py        -> tools/concert/out/review/index.html (audio beside it in a/ and b/)
# A switch between the two versions lands on the same moment in the music where both follow the same bars ("in step": a map through every
# bar line), and on the same clock time where the forms differ.
import json, os, re
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, 'out', 'review')
REWRITTEN = {'title', 'galaxy1', 'galaxy2', 'galaxy3', 'galaxy4', 'galaxy5', 'galaxy12', 'galaxy14', 'procession', 'council2'}
TITLES = {
  'title': 'Main Theme', 'galaxy1': 'Wonder', 'galaxy2': 'Patience', 'galaxy3': 'Determination', 'galaxy4': 'Deep Field', 'galaxy5': 'The Veil (waltz)',
  'galaxy6': 'The Abyss', 'galaxy7': 'The Cradle (lullaby in six)', 'galaxy8': 'The Beacon', 'galaxy9': 'The Tide', 'galaxy10': 'The Chorale',
  'galaxy11': 'The Nebula', 'galaxy12': 'The Long Night (passacaglia)', 'galaxy13': 'The Watch (nocturne)', 'galaxy14': 'First Light',
  'galaxy15': 'The Lantern', 'galaxy16': 'The Survey', 'galaxy17': 'The Commonwealth', 'galaxy18': 'The Lanes', 'galaxy19': 'Noon (brass chorale)',
  'galaxy20': 'The Frontier (slow march)', 'galaxy21': 'The Embers (sarabande)', 'galaxy22': 'The Vigil (sung chorale)', 'galaxy23': 'The Weaver',
  'procession': 'The Procession', 'council2': 'Council in State',
  'drift': 'Drift', 'drift2': 'Drift, the harp', 'drift3': 'Drift, voices', 'drift4': 'Drift, horizon', 'drift5': 'Drift, the held note',
  'drift6': 'Drift, the choir', 'drift7': 'Drift, the violas',
  'bridge:tense': 'Bridge, tense', 'bridge:dark': 'Bridge, dark', 'bridge:bright': 'Bridge, bright', 'bridge:calm': 'Bridge, calm',
}
GROUPS = [
  ('The Main Theme', ['title']),
  ('The Galaxy', ['galaxy%d' % i for i in range(1, 24)]),
  ('Ceremony', ['procession', 'council2']),
  ('Drifts between pieces', ['drift'] + ['drift%d' % i for i in range(2, 8)]),
  ('Bridges into cues', ['bridge:tense', 'bridge:dark', 'bridge:bright', 'bridge:calm']),
]
fname = lambda i: re.sub(r'[^a-z0-9]+', '-', i, flags=re.I)
def tidy(desc):   # the description without its leading label ("The procession: ...", "Calm exploration, the abyss: ...")
  d = re.sub(r'^[^:—]{0,60}[:—]\s*', '', desc.strip()); return d[:1].upper() + d[1:] if d else desc
def bars_map(a, b):
  sa, sb = [s['n'] for s in a['sections']], [s['n'] for s in b['sections']]
  if sa != sb: return None
  pts = []
  ba, bb = a.get('beats') or [], b.get('beats') or []
  same_bars = [s['bars'] for s in a['sections']] == [s['bars'] for s in b['sections']]
  if same_bars and ba and len(ba) == len(bb):
    step = max(1, len(ba) // 400)
    pts = [[ba[k], bb[k]] for k in range(0, len(ba), step)]
  else:
    pts = [[x['t'], y['t']] for x, y in zip(a['sections'], b['sections'])]
  pts.append([a['first'], b['first']])
  return [[round(p, 3), round(q, 3)] for p, q in pts]
tracks, groups, files = [], [], {}
DESCS = json.load(open(os.path.join(OUT, 'descs.json'))) if os.path.exists(os.path.join(OUT, 'descs.json')) else {'a': {}, 'b': {}}
for gname, ids in GROUPS:
  for i in ids:
    side = {}
    for s in ('a', 'b'):
      pj = os.path.join(OUT, s, fname(i) + '.json')
      side[s] = json.load(open(pj)) if os.path.exists(pj) else None   # not rendered yet: the row says so
    da, db = DESCS['a'].get(i, ''), DESCS['b'].get(i, '')
    t = {'id': i, 'title': TITLES.get(i, i), 'kind': 'rewritten' if i in REWRITTEN else 'ported', 'line': tidy(db),
         'was': tidy(da) if i in REWRITTEN and da and da != db else '', 'map': bars_map(side['a'], side['b']) if side['a'] and side['b'] else None}
    for s in ('a', 'b'):
      d = side[s]
      if not d: t[s] = None; continue
      t[s] = {'src': 'audio/%s/%s.webm' % (s, fname(i)), 'secs': round(d['secs'], 2), 'lufs': round(d['lufs'], 2), 'sections': d['sections']}
      files['audio/%s/%s.webm' % (s, fname(i))] = os.path.join(OUT, s, fname(i) + '.webm')
    tracks.append(t)
  groups.append({'name': gname, 'ids': ids})
page = open(os.path.join(HERE, 'review-page.html')).read().replace('/*DATA*/null', json.dumps({'groups': groups, 'tracks': tracks}, separators=(',', ':')))
open(os.path.join(OUT, 'index.html'), 'w').write(page)
json.dump(files, open(os.path.join(OUT, 'files.json'), 'w'), indent=0)
print('%d pieces, %d ready, %d in step; page %d KB; audio %.0f MB' % (len(tracks), sum(1 for t in tracks if t['a'] and t['b']), sum(1 for t in tracks if t['map']), len(page) // 1024, sum(os.path.getsize(f) for f in files.values()) / 1e6))

// Lints the score against its schema and the engine's own analysis, without a browser:
//   node tools/score-lint.js [--strict] [id ...]
// Loads the engine and the score (js/audio/music.js + js/audio/score/*.js) in a bare VM, then for every piece checks: the required and
// the allowed fields; every instrument, drum kit, bass and arp preset named exists; every section's layers and modifiers are known; forms
// and loopFrom name real sections; phrases parse and are bar-aligned; theme references resolve; tags (map pieces) sit in 0..1 on the known
// axes; era windows are sane; every form x instrumentation x take x era compiles and the composition is deterministic; melodic snaps
// stay under a ceiling. Then the programme: every id in the rotations, moods, interludes and rare lists exists, the early list is a subset
// of the full one, hidden pieces are not in any list. --strict also fails on lint warnings and on more than 12 snaps per pass.
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2), strict = args.includes('--strict'), only = args.filter(a => !a.startsWith('--'));
const ctx = vm.createContext({ console, setInterval: () => 0, clearInterval: () => 0, setTimeout: () => 0, performance: { now: () => 0 }, navigator: { hardwareConcurrency: 4, userAgent: 'node' }, location: { protocol: 'http:', search: '' } });
ctx.window = ctx; ctx.globalThis = ctx;
const mctx = vm.createContext({}); mctx.window = mctx; vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/manifest.js'), 'utf8'), mctx); const man = mctx.MOO_MANIFEST;
const files = ['js/core/ns.js'].concat(man.js.filter(f => /^js\/audio\/(audio|sampler|music)\.js$|^js\/audio\/score\//.test(f)));
for (const f of files) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const Music = ctx.MOO.Audio.Music, T = Music._tracks, INST = Music._INST, R = Music._rotation;
const problems = [], warns = [];
const bad = (id, msg) => problems.push(id + ': ' + msg), warn = (id, msg) => warns.push(id + ': ' + msg);
const TOP = new Set(['id', 'desc', 'bpm', 'meter', 'root', 'mode', 'tonic', 'oct', 'bassC', 'trim', 'tone', 'mix', 'fx', 'sends', 'tens', 'gate', 'gentle', 'eraSens', 'rubato', 'loopFrom', 'forms', 'alts', 'eraAlts', 'inst', 'ph', 'base', 'variantOf', 'sec', 'strong', 'lintMin', 'hidden', 'interlude', 'bridge', 'tags', 'eraWin', 'motif', 'motifInst', 'quotes', 'tomTune', '_p']);
const LAYERS = ['pad', 'pad2', 'bass', 'arp', 'arp2', 'drums', 'perc', 'timp', 'lead', 'lead2', 'bell', 'bell2', 'choir', 'choir2'];
const SEC = new Set(['n', 'bars', 'barsVar', 'lv', 'cres', 'prog', 'fill', 'cr', 'rise', 'hit', 'tens'].concat(LAYERS));
const AXES = ['solitude', 'contact', 'tension', 'war', 'grief', 'grandeur', 'energy', 'dark', 'ceremony'];
const instOk = v => v === undefined || v === false || (typeof v === 'string' ? !!INST[v] : typeof v === 'object' && (v.p === undefined || !!INST[v.p]));
const ids = only.length ? only : Object.keys(T);
for (const id of ids) {
  const d = T[id]; if (!d) { bad(id, 'unknown piece'); continue; }
  for (const k in d) if (!TOP.has(k)) bad(id, 'unknown field "' + k + '"');
  for (const k of ['desc', 'bpm', 'root', 'mode', 'sec']) if (d[k] === undefined) bad(id, 'missing "' + k + '"');
  if (!Array.isArray(d.sec) || !d.sec.length) { bad(id, 'no sections'); continue; }
  if (d.trim === undefined && !d.hidden) warn(id, 'no trim (level not measured)');
  for (const k in d.inst || {}) if (!instOk(d.inst[k])) bad(id, 'unknown instrument "' + d.inst[k] + '" for ' + k);
  for (const alt of d.alts || []) for (const k in alt) if (!instOk(alt[k])) bad(id, 'unknown instrument "' + alt[k] + '" in alts.' + k);
  for (const k in d.eraAlts || {}) if (!instOk(d.eraAlts[k])) bad(id, 'unknown instrument "' + d.eraAlts[k] + '" in eraAlts.' + k);
  if (d.tags) for (const a in d.tags) { if (AXES.indexOf(a) < 0) bad(id, 'unknown tag axis "' + a + '"'); const v = d.tags[a]; if (typeof v !== 'number' || v < 0 || v > 1) bad(id, 'tag ' + a + ' out of 0..1'); }
  if (d.eraWin && !(Array.isArray(d.eraWin) && d.eraWin.length === 2 && d.eraWin[0] >= 0 && d.eraWin[1] <= 1 && d.eraWin[0] < d.eraWin[1])) bad(id, 'bad eraWin');
  if (d.motif && !Music.setMotif(id)) bad(id, 'motif does not resolve'); Music.setMotif(null);
  const names = new Set(d.sec.map(x => x.n));
  if (d.loopFrom && !names.has(d.loopFrom)) bad(id, 'loopFrom "' + d.loopFrom + '" is not a section');
  for (const f of d.forms || []) for (const n of f) if (!names.has(n)) bad(id, 'form names unknown section "' + n + '"');
  d.sec.forEach((x, i) => { for (const k in x) if (!SEC.has(k)) bad(id, 'section ' + (x.n || i) + ': unknown field "' + k + '"'); if (!(x.bars > 0)) bad(id, 'section ' + (x.n || i) + ': bars'); if (!x.prog) bad(id, 'section ' + (x.n || i) + ': no prog'); for (const k of LAYERS) { const v = x[k]; if (v && typeof v === 'object' && v.inst !== undefined && !instOk(v.inst)) bad(id, 'section ' + (x.n || i) + ': unknown instrument "' + JSON.stringify(v.inst) + '" in ' + k); } });
  let a; try { a = Music.analyze(id); } catch (e) { bad(id, 'does not compile: ' + e.message); continue; }
  for (const w of a.warnings) (strict ? bad : warn)(id, w);
  if (!a.deterministic) bad(id, 'not deterministic');
  if (a.snaps > (strict ? 12 : 40)) (strict ? bad : warn)(id, a.snaps + ' melodic snaps in the first pass');
  if (a.lead.notes && a.lead.strongOK !== null && a.lead.strongOK < 0.97) warn(id, 'strong beats clash-free only ' + Math.round(a.lead.strongOK * 100) + '%');
  try { const nf = Math.max(1, (d.forms || []).length), na = Math.max(1, (d.alts || []).length); for (let f = 0; f < nf; f++) for (let al = 0; al < na; al++) for (let t = 0; t < 8; t += (strict ? 1 : 7)) { Music._compile(id, 0, f, al, t, 0); Music._compile(id, 1, f, al, t, 1); } } catch (e) { bad(id, 'a performance fails to compile: ' + e.message); }
}
// the programme
if (!only.length) {
  const known = id => !!T[id], lists = { GALAXY: R.GALAXY, GALAXY_EARLY: R.GALAXY_EARLY, INTERLUDES: R.INTERLUDES };
  for (const k in lists) for (const id of lists[k]) { if (!known(id)) bad('programme', k + ' names unknown piece "' + id + '"'); else if (T[id].hidden && k !== 'INTERLUDES') bad('programme', k + ' lists hidden piece "' + id + '"'); }
  for (const id of R.GALAXY_EARLY) if (R.GALAXY.indexOf(id) < 0) bad('programme', 'early programme piece "' + id + '" is not in the full programme');
  const moods = R.MOODS; for (const m in moods) for (const id of [].concat(moods[m])) if (!known(id)) bad('programme', 'mood "' + m + '" names unknown piece "' + id + '"');
  for (const id of R.GALAXY) if (!T[id].tags) bad('programme', 'map piece "' + id + '" has no tags for the director');
  const ix = Music.themeIndex(), quoted = Object.values(ix).flat(); for (const id of R.GALAXY) if (quoted.indexOf(id) < 0) warn(id, 'quotes no shared theme');
  // the seams: an interlude from every map piece into every other compiles (its opening bars in the outgoing meter and pulse, the pivot chords, the new tempo)
  let pairs = 0; const seamIds = R.GALAXY.concat(['procession']);
  for (const a of seamIds) for (const b of seamIds) { if (a === b) continue; for (const tpl of ['drift', 'drift5']) { try { Music._compile(R.interludeFor(tpl, b, { from: T[a] }), 0); pairs++; } catch (e) { bad('programme', 'interlude ' + tpl + ' from ' + a + ' into ' + b + ' fails: ' + e.message); } } }
  console.log('  seams: ' + pairs + ' interludes between map pieces compile');
}
for (const w of warns) console.log('  warn  ' + w);
for (const p of problems) console.log('  FAIL  ' + p);
console.log((only.length ? only.length : Object.keys(T).length) + ' pieces checked: ' + problems.length + ' problems, ' + warns.length + ' warnings' + (only.length ? '' : '; themes quoted: ' + Object.entries(Music.themeIndex()).map(([t, l]) => t + ' ' + l.length).join(', ')));
process.exit(problems.length ? 1 : 0);

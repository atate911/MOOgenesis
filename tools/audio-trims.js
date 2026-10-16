// Per-cue loudness pass: read a report JSON (node tools/audio-report.js --json FILE) and print the `trim:` each track needs to land on
// its target (integrated LUFS of the loop window). Targets by role: underscore -16.5, battle / war variants / ground -14.5, title, council,
// victory, GNN -15, event cues -16. With --apply the trims are written into js/audio/music.js (war variants derive from their base theme
// and are left alone). Keeps a track within +-0.3 dB of target; changes under 0.3 dB are skipped.
const fs = require('fs');
const args = process.argv.slice(2), file = args.find(a => !a.startsWith('--')), apply = args.includes('--apply');
const onlyRe = (args.find(a => a.startsWith('--only=')) || '').slice(7), skipRe = (args.find(a => a.startsWith('--skip=')) || '').slice(7);
// battle cues are gated by intensity: measure them with `--intensity 0.8` and pass --only=^combat|^ground|:war$ ; measure the rest at 0 and --skip the same
if (!file) { console.error('usage: node tools/audio-trims.js report.json [--apply]'); process.exit(1); }
const rep = JSON.parse(fs.readFileSync(file, 'utf8'));
const music = rep.music || {};
const target = id => /^combat|^ground|:war$/.test(id) ? -14.5 : /^(title|council|victory|gnn)$/.test(id) ? -15 : /^(orion|antarans|defeat)$/.test(id) ? -16 : -16.5;
const src = fs.readFileSync('js/audio/music.js', 'utf8');
const trimOf = id => { const i = src.indexOf("Track('" + id + "'"); if (i < 0) return null; const m = src.slice(i, i + 600).match(/trim: ([0-9.]+)/); return m ? +m[1] : 1; };
const rows = [];
for (const key of Object.keys(music)) {
  const [id, part] = key.split(':').length > 2 ? [key.slice(0, key.lastIndexOf(':')), key.slice(key.lastIndexOf(':') + 1)] : key.split(':');
  if (part.replace(/@.*$/, '') !== 'loop') continue;
  if (onlyRe && !new RegExp(onlyRe).test(id)) continue;
  if (skipRe && new RegExp(skipRe).test(id)) continue;
  const it = music[key], lufs = it.lufs !== undefined ? it.lufs : it.lufsI !== undefined ? it.lufsI : it.loudness;
  if (!(lufs > -70)) continue;
  const cur = trimOf(id); if (cur === null) continue;
  const delta = target(id) - lufs, next = Math.round(cur * Math.pow(10, delta / 20) * 100) / 100;
  rows.push({ id, lufs, target: target(id), cur, next, delta });
}
rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
for (const r of rows) console.log(`${r.id.padEnd(20)} ${r.lufs.toFixed(1).padStart(6)} LUFS  target ${r.target}  trim ${r.cur} -> ${r.next}  (${r.delta >= 0 ? '+' : ''}${r.delta.toFixed(1)} dB)${Math.abs(r.delta) < 0.3 ? '  keep' : ''}`);
if (apply) {
  let out = src, n = 0;
  for (const r of rows) {
    if (Math.abs(r.delta) < 0.3 || /:war$/.test(r.id)) continue;
    const i = out.indexOf("Track('" + r.id + "'"); const head = out.slice(i, i + 600);
    const m = head.match(/trim: ([0-9.]+)/);
    if (m) { out = out.slice(0, i) + head.replace(m[0], 'trim: ' + r.next) + out.slice(i + 600); n++; }
    else { const k = out.indexOf('{', i); out = out.slice(0, k + 1) + ' trim: ' + r.next + ',' + out.slice(k + 1); n++; }
  }
  fs.writeFileSync('js/audio/music.js', out); console.log('applied', n, 'trims');
}

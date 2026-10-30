// The music engine's seams, driven in real time in headless Chromium: a directed programme of short test pieces with the real interludes,
// a soft programme change at a section line, a tense bridge into a fight cue and a calm one back, a motif carried by an interlude, and a
// snapshot / restore — never a silence, every switch where it was promised. Prints PASS / FAIL lines; exits 1 on any FAIL.
//   node tools/qa/music.js
const { serve, open } = require('./lib');
(async () => {
  const PORT = +process.env.PORT || 8797, srv = await serve(PORT); const { browser, page, errors } = await open();
  await page.goto('http://localhost:' + PORT + '/tools/test-audio.html');
  await page.waitForFunction(() => window.MOO && MOO.Audio && MOO.Audio.Music);
  const res = await page.evaluate(async () => {
    const A = MOO.Audio, M = A.Music, R = M._rotation, S = R.S, D = M._director.DIR, sleep = ms => new Promise(r => setTimeout(r, ms)), out = [];
    const check = (name, ok, note) => out.push({ name, ok: !!ok, note: note || '' });
    A.init(); await sleep(500); if (!A.isReady()) { check('audio context running', false, A.ctx && A.ctx.state); return out; }
    await A.Samples.preload();
    const mk = (id, root, mode, tags) => M._define(id, { bpm: 240, root, mode, loopFrom: 'A', trim: 1, tens: false, gentle: true, hidden: true, tags,
      inst: { pad: 'warm', bass: 'deep', lead: 'flute' }, ph: { X: '1:2 3:2 | 5:2 3:2' },
      sec: [{ n: 'intro', bars: 2, lv: 0.5, prog: 'I', pad: 'sus' }, { n: 'A', bars: 8, lv: 0.7, prog: 'I IV vi V', pad: 'sus', bass: 'whole', lead: 'X X' }, { n: 'breath', bars: 2, lv: 0.3, prog: 'I:2', pad: 'sus' }, { n: 'B', bars: 8, lv: 0.7, prog: 'IV I V I', pad: 'sus', bass: 'whole', lead: 'X X' }, { n: 'E', bars: 4, lv: 0.5, prog: 'I V I I', pad: 'sus' }] });
    mk('qaA', 'C', 'major', { solitude: 1, war: 0, energy: 0.2, dark: 0 }); mk('qaB', 'G', 'major', { solitude: 0.8, war: 0, energy: 0.3, dark: 0.1 }); mk('qaC', 'Eb', 'minor', { solitude: 0, war: 1, energy: 0.9, dark: 1 }); mk('qaD', 'D', 'major', { solitude: 0.9, war: 0, energy: 0.2, dark: 0 });
    M._define('qaFight', { bpm: 240, root: 'D', mode: 'minor', loopFrom: 'A', trim: 1, tens: false, hidden: true, inst: { pad: 'warm', bass: 'deep' }, sec: [{ n: 'A', bars: 8, lv: 0.9, prog: 'i bVI bVII i', pad: 'sus', bass: 'oct8' }] });
    const t0 = A.ctx.currentTime, trace = []; let last = null, silent = 0;
    const snap = () => { const cur = S.cur && S.cur.id; if (!S.cur && !S.old.length && !S.plWait && !S.switchAt) silent++; if (cur !== last) { trace.push({ t: +(A.ctx.currentTime - t0).toFixed(2), cur, armed: S.switchAt ? S.switchAt.id + (S.switchAt.then ? '>' + S.switchAt.then.id : '') : null }); last = cur; } };
    const run = async secs => { const end = A.ctx.currentTime + secs; while (A.ctx.currentTime < end) { snap(); await sleep(100); } };
    const ROT = { director: true, shuffle: true, gap: 0, gapIn: 0, fade: 3, between: ['drift', 'drift6'], betweenP: 1 };
    // 1. a directed programme opens with the piece that fits
    M.setSituation({ solitude: 1, contact: 0, tension: 0, war: 0, grief: 0, grandeur: 0.1, energy: 0.3, dark: 0 });
    M.playlist(['qaA', 'qaB', 'qaC', 'qaD'], Object.assign({ firstFade: 0.5 }, ROT));
    check('director opens with a fitting piece', S.cur && S.cur.id !== 'qaC', S.cur && S.cur.id);
    await run(3);
    // 2. a soft change lands on a section line (a breath when near) and goes through an interlude
    const p = S.cur, base = p.pass.start - p.shift, spb = p.P.spb * p.stretch, lines = p.pass.wraps.map(w => +(base + w.start * spb).toFixed(2)).concat([+(base + p.pass.len).toFixed(2)]);
    M.setMotif({ ph: '5:2 8:2 | 7:2 6:2', inst: 'flute' });
    const first = R.softSwitch(['qaB', 'qaD'], ROT, { fade: 3, within: 60 });
    const sw = S.switchAt;
    check('soft switch armed on a section line', sw && lines.some(x => Math.abs(x - sw.at) < 0.06), sw ? 'at ' + (sw.at - t0).toFixed(2) : 'not armed');
    check('soft switch goes through an interlude in the new key', sw && /^drift/.test(sw.id) && S.playlist && S.playlist.queued === first, sw && sw.id);
    check('the motif rides the interlude', sw && /:m/.test(sw.id) && !D.motif, sw && sw.id);
    await run(10);
    check('interlude became current', trace.some(x => x.cur && /^drift/.test(x.cur)), trace.map(x => x.cur).join(' > '));
    // 3. a tense bridge into a cue that cannot wait, asked twice
    const beat = S.cur.P.spb * S.cur.stretch;   // the bridge starts on the next beat of whatever is playing (an interlude's beat is over a second)
    M.play('qaFight', { fade: 1.5, quantize: 'beat', bridge: 'tense' });
    const b1 = S.switchAt; const again = M.play('qaFight', { fade: 1.5, quantize: 'beat', bridge: 'tense' });
    check('bridge armed on the next beat with the cue behind it', b1 && /^bridge:tense/.test(b1.id) && b1.then && b1.then.id === 'qaFight' && b1.at - A.ctx.currentTime < beat + 0.15, b1 && b1.id + ' in ' + (b1 ? (b1.at - A.ctx.currentTime).toFixed(2) : '?') + ' s');
    check('a second request does not restart the chain', again === true && S.switchAt === b1);
    await run(8);
    check('the cue arrived after the bridge', trace.some(x => x.cur === 'qaFight') && trace.findIndex(x => x.cur === 'qaFight') > trace.findIndex(x => /^bridge:tense/.test(x.cur || '')), trace.map(x => x.cur).join(' > '));
    // 4. a calm bridge back onto a directed programme, now war-coloured: the director should take the war-tagged piece
    M.setSituation({ solitude: 0, contact: 0.3, tension: 0.9, war: 1, grief: 0.2, grandeur: 0.5, energy: 0.6, dark: 0.9 });
    M.playlist(['qaA', 'qaB', 'qaC', 'qaD'], Object.assign({ firstFade: 3, bridge: 'calm' }, ROT));
    const b2 = S.switchAt;
    check('calm bridge armed back onto the map', b2 && /^bridge:calm/.test(b2.id) && b2.then, b2 && b2.id + '>' + (b2.then && b2.then.id));
    check('the director chose the war-tagged piece', b2 && b2.then && b2.then.id === 'qaC', b2 && b2.then && b2.then.id);
    check('the level tilted up at war, within a decibel', D.gainDb > 0.5 && D.gainDb <= 1.2, D.gainDb.toFixed(2) + ' dB');
    await run(9);
    // 5. snapshot and restore keep the programme and the director
    const snapshot = M.snapshot();
    check('snapshot keeps the directed programme', snapshot.playlist && snapshot.playlist.director && snapshot.playlist.ids.length === 4);
    M.play('qaFight', { fade: 0.5, quantize: false }); await run(2);
    M.restore(snapshot, { fade: 1 }); await run(3);
    check('restore brings the programme back', S.playlist && S.playlist.director && S.cur && /^qa[ABCD]$|^drift/.test(S.cur.id), S.cur && S.cur.id);
    check('never a silence', silent === 0, silent + ' silent polls');
    M.stop({ fade: 0.3 }); M.setSituation(null); M.setMotif(null);
    return out;
  });
  let fail = 0;
  for (const r of res) { console.log((r.ok ? 'PASS  ' : 'FAIL  ') + r.name + (r.note ? '   (' + r.note + ')' : '')); if (!r.ok) fail++; }
  const errs = errors.filter(e => !/favicon|ScriptProcessor/.test(e)); if (errs.length) { console.log('console:'); errs.forEach(e => console.log('  ' + e)); fail++; }
  console.log(fail ? fail + ' FAILED' : 'all passed');
  await browser.close(); srv.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

// The concert suite as MIDI: one Standard MIDI File per movement (format 1), one track per part, on the written beat grid with the
// movement's tempo map (accelerandos and ritardandos included), so it imports into a notation program or a DAW with a better orchestral
// library than the game's, or can be engraved for players. General MIDI programs are set as a starting point.
//   node tools/concert/midi.js            → tools/concert/out/*.mid
const fs = require('fs'), path = require('path');
const { serve, open } = require('../qa/lib');
const OUT = path.join(__dirname, 'out'), PPQ = 480;

// recording → [part name, GM program (0-based), order on the score]
const GM = {
  fluteIowa: ['Flute', 73, 1], flute: ['Flute', 73, 1], fluteSus: ['Flutes', 73, 1], altoFlute: ['Alto Flute', 73, 2], altoFluteIowa: ['Alto Flute', 73, 2],
  oboe: ['Oboe', 68, 3], oboeIowa: ['Oboe', 68, 3], corAnglais: ['Cor Anglais', 69, 4], clarinet: ['Clarinet in B♭', 71, 5], clarIowa: ['Clarinet in B♭', 71, 5],
  bassClar: ['Bass Clarinet', 71, 6], bassoon: ['Bassoon', 70, 7], bassoonIowa: ['Bassoon', 70, 7],
  hornSus: ['Horns', 60, 10], hornSolo: ['Horn (solo)', 60, 11], hornIowa: ['Horn (solo)', 60, 11], tptSus: ['Trumpets', 56, 12], tptSolo: ['Trumpet (solo)', 56, 13], tptIowa: ['Trumpet (solo)', 56, 13],
  brassEns: ['Brass', 61, 14], tbnSus: ['Trombones', 57, 15], lowBrass: ['Low Brass', 57, 16], tubaSus: ['Tuba', 58, 17], tubaIowa: ['Tuba', 58, 17],
  timpani: ['Timpani', 47, 20], timpRoll: ['Timpani', 47, 20], perc: ['Percussion', 0, 21],
  harp: ['Harp', 46, 25], celeste: ['Celesta', 8, 26], glock: ['Glockenspiel', 9, 27], chimes: ['Tubular Bells', 14, 28], crotales: ['Crotales', 9, 29], marimba: ['Marimba', 12, 29],
  organ: ['Organ', 19, 30], organSoft: ['Organ', 19, 30],
  chorusWomen: ['Choir (women)', 52, 32], choirOoh: ['Choir', 53, 33], choirHum: ['Choir (humming)', 53, 33], chorus: ['Choir', 52, 33], chorusMen: ['Choir (men)', 52, 34], cantor: ['Cantor', 52, 35],
  vlnSolo: ['Violin (solo)', 40, 40], strEns: ['Strings', 48, 41], strEnsTrem: ['Strings (tremolo)', 44, 42], vln1Trem: ['Violins (tremolo)', 44, 42], strEnsSpic: ['Strings (spiccato)', 48, 43], strEnsPizz: ['Strings (pizzicato)', 45, 44],
  vlaSus: ['Violas', 41, 45], vlaSolo: ['Viola (solo)', 41, 45], vcSus: ['Cellos', 42, 46], vcTrem: ['Cellos (tremolo)', 44, 47], vcSolo: ['Cello (solo)', 42, 46], cbSus: ['Double Basses', 43, 48], cbPizz: ['Double Basses (pizz.)', 45, 49], cbSolo: ['Double Bass (solo)', 43, 48],
  padSerrie: ['Synth Pad', 89, 50], padAir: ['Synth Pad (air)', 91, 51], padGlass: ['Synth Pad (glass)', 92, 51], subBass: ['Sub Bass', 38, 52],
};
const DRUM = { crash: 49, gong: 52, bassDrum: 36, snare: 38, snareRoll: 38, claves: 75, woodBlock: 76, triangle: 81, tamb: 54, anvil: 56, taps: 37 };

const vlq = n => { const b = [n & 0x7f]; while ((n >>= 7)) b.unshift((n & 0x7f) | 0x80); return b; };
const str = s => Array.from(Buffer.from(s, 'utf8'));
function track(events) {   // events: [tick, bytes[]] — sorted, delta-encoded, end-of-track appended
  events.sort((a, b) => a[0] - b[0] || a[2] - b[2]);
  const out = []; let last = 0;
  for (const [t, bytes] of events) { out.push(...vlq(Math.max(0, t - last)), ...bytes); last = Math.max(last, t); }
  out.push(0, 0xff, 0x2f, 0);
  return Buffer.concat([Buffer.from('MTrk'), Buffer.from([out.length >>> 24, (out.length >> 16) & 255, (out.length >> 8) & 255, out.length & 255]), Buffer.from(out)]);
}

(async () => {
  const srv = await serve(8793), { browser, page } = await open();
  await page.goto('http://localhost:8793/tools/test-audio.html');
  await page.waitForFunction(() => window.MOO && MOO.Audio && MOO.Audio.Music);
  await page.addScriptTag({ url: 'http://localhost:8793/tools/concert/suite.js?' + Date.now() });
  const suite = await page.evaluate(() => window.CONCERT_SUITE);
  fs.mkdirSync(OUT, { recursive: true });
  for (const mv of suite.movements) {
    const d = await page.evaluate(id => {
      const c = MOO.Audio.Music._compile(id, 0), ftom = f => Math.round(69 + 12 * Math.log2(f / 440));
      const notes = [];
      for (const e of c.events) {
        if (!e.o || e.v === 'expr' || e.v === 'fx' || e.b === undefined) continue;
        const smp = e.o.smp || (e.v === 'boom' ? 'bassDrum' : null); if (!smp) continue;
        const pitch = e.m || (e.o.f ? ftom(e.o.f) : 0);
        notes.push({ smp, b: e.b, bt: e.bt || (smp === 'timpRoll' ? 4 : 0.5), m: pitch, dyn: e.o.ldyn !== undefined ? e.o.ldyn : (e.o.dyn !== undefined ? e.o.dyn : 0.7), part: e.k });
      }
      return { notes, beatsT: c.beatsT, meters: c.wraps.map(w => [w.start, w.R.meter]) };
    }, mv.id);
    // the tempo map: one tempo per beat from the beat times (the conductor's tempo, accelerandos and ritardandos included)
    const conductor = [[0, [0xff, 0x03, ...vlq(str(mv.title).length), ...str(mv.title)], 0]];
    let lastUs = -1;
    for (let k = 0; k + 1 < d.beatsT.length; k++) {
      const us = Math.round((d.beatsT[k + 1] - d.beatsT[k]) * 1e6);
      if (Math.abs(us - lastUs) > 2000) { conductor.push([k * PPQ, [0xff, 0x51, 0x03, (us >> 16) & 255, (us >> 8) & 255, us & 255], 1]); lastUs = us; }
    }
    for (const [b, m] of d.meters) conductor.push([Math.round(b * PPQ), [0xff, 0x58, 0x04, m, 2, 24, 8], 0]);
    // the parts, by instrument (a recording played in two layers is one part); drums share channel 10
    const parts = new Map();
    for (const n of d.notes) {
      const drum = DRUM[n.smp] !== undefined, key = drum ? 'perc' : (GM[n.smp] ? GM[n.smp][0] : n.smp);   // one part per instrument (two recordings of the solo horn are one horn)
      if (!parts.has(key)) parts.set(key, []); parts.get(key).push(n);
    }
    const BYNAME = {}; for (const k in GM) if (!BYNAME[GM[k][0]]) BYNAME[GM[k][0]] = GM[k]; BYNAME.perc = GM.perc;
    const order = [...parts.keys()].sort((a, b) => ((BYNAME[a] || [a, 0, 99])[2]) - ((BYNAME[b] || [b, 0, 99])[2]));
    const tracks = [track(conductor)]; let ch = 0;
    for (const key of order) {
      const [name, prog] = BYNAME[key] || [key, 48], drum = key === 'perc', c = drum ? 9 : ch;
      if (!drum) { ch = (ch + 1) % 16; if (ch === 9) ch = 10; }
      const ev = [[0, [0xff, 0x03, ...vlq(str(name).length), ...str(name)], 0]];
      if (!drum) ev.push([0, [0xc0 | c, prog], 0]);
      for (const n of parts.get(key)) {
        const pitch = drum ? DRUM[n.smp] : n.m; if (!pitch) continue;
        const t0 = Math.round(n.b * PPQ), t1 = Math.max(t0 + 30, Math.round((n.b + n.bt) * PPQ) - 4), vel = Math.max(12, Math.min(127, Math.round(20 + 107 * n.dyn)));
        ev.push([t0, [0x90 | c, pitch, vel], 2], [t1, [0x80 | c, pitch, 0], 1]);
      }
      tracks.push(track(ev));
    }
    const head = Buffer.from([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, (tracks.length >> 8) & 255, tracks.length & 255, (PPQ >> 8) & 255, PPQ & 255]);
    const f = path.join(OUT, mv.file + '.mid'); fs.writeFileSync(f, Buffer.concat([head, ...tracks]));
    console.log(`${f}: ${tracks.length - 1} parts (${order.map(k => (BYNAME[k] || [k])[0]).join(', ')})`);
  }
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });

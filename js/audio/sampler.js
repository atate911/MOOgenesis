// Master of Orion — Reborn · sampled instruments for the music engine (optional layer on top of the synth voices).
// Loads assets/audio/instruments.json + the MP3 multisamples it lists (lazily, after the first user gesture; never from file://, where
// fetch is blocked: everything then stays on the procedural voices). Exposes
//   MOO.Audio.Samples.{enabled, base, load(), preload(), ready(name), has(name), status(), zones(name)}
//   MOO.Audio.Voices.sample(eng, dest, t, o)   o = {smp, f, dur, vel, dyn, swell, att, rel, pan, prio, send, vib, ens, cut, leg, hum, fb, fbo, oneShot}
// A sample voice is one AudioBufferSourceNode per sounding dynamic layer (pitched by playbackRate, looped on the library's loop points,
// vibrato on `detune`; instruments recorded in layers crossfade between them with the asked dynamic, and a `swell` moves through them
// over the note), an optional second detuned copy ("ens" — ensemble thickening), a velocity-tracked lowpass and an ADSR gain. Legato
// notes start past the attack transient; every note gets a few milliseconds of timing spread and a few cents of drift (hum). Zones carry
// their section's seat on the stage (pan). When the instrument is
// not loaded (yet), the voice silently plays its fallback synth voice (`fb`, e.g. 'pad', with `fbo` parameters), so a track sounds the
// same way it always did until the samples arrive. MP3 decoders add a few hundred samples of encoder delay that differ per browser:
// the loader decodes a tiny calibration file with an impulse at a known position and shifts every loop point by the measured offset.
(function (M) {
  'use strict';
  const A = M.Audio;
  const K = A.kit, V = A.Voices;
  const clamp = K.clamp, num = K.num, ftom = K.ftom, dbtoa = K.dbtoa;
  const S = A.Samples = { enabled: true, base: 'assets/audio/', state: 'idle', inst: Object.create(null), manifest: null, offset: 0, bytes: 0, errors: 0, pending: null, rr: Object.create(null) };

  (function () {
    try { const cs = document.currentScript; S.base = new URL('../../assets/audio/', cs && cs.src ? cs.src : location.href).href; } catch (e) { /* relative fallback */ }
    try { if (/[?&]samples=0\b/.test(location.search)) S.enabled = false; } catch (e) { /* ignore */ }
    try { if (location.protocol === 'file:') S.enabled = false; } catch (e) { /* ignore */ }   // fetch() cannot read file:// URLs
  })();

  // ------------------------------------------------------------------ loading
  function decodeCtx() {
    if (A.ctx) return A.ctx;
    const AC = window.AudioContext || window.webkitAudioContext, OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (OAC) { if (!S.dctx) S.dctx = new OAC(1, 128, 44100); return S.dctx; }
    return AC ? new AC() : null;
  }
  function decode(ab) {
    const ctx = decodeCtx();
    return new Promise((res, rej) => { try { const p = ctx.decodeAudioData(ab, res, rej); if (p && p.catch) p.catch(rej); } catch (e) { rej(e); } });
  }
  function fetchBuf(url) { return fetch(url).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url); return r.arrayBuffer(); }); }
  const bufCache = Object.create(null);                    // file -> Promise<AudioBuffer> (composite instruments share their members' files)
  function loadBuf(file) { return bufCache[file] || (bufCache[file] = fetchBuf(S.base + file).then(decode).then(buf => { S.bytes += buf.length * buf.numberOfChannels * 4; return buf; })); }

  // the calibration file holds one positive impulse at manifest.calib.at seconds; the decoded position tells us the decoder delay
  function calibrate(man) {
    if (!man.calib || !man.calib.file) return Promise.resolve(0);
    return fetchBuf(S.base + man.calib.file).then(decode).then(buf => {
      const d = buf.getChannelData(0); let best = 0, bi = 0;
      for (let i = 0; i < d.length; i++) if (d[i] > best) { best = d[i]; bi = i; }
      const off = bi / buf.sampleRate - man.calib.at;
      return Math.abs(off) < 0.2 ? off : 0;
    }).catch(() => 0);
  }

  function loadInstrument(name, def) {
    const inst = { name, kind: def.kind || 'sustain', pitched: def.pitched !== false, attack: num(def.attack, 0.01), release: num(def.release, 0.3), gain: dbtoa(num(def.gain, 0)),
      loop: def.kind === 'sustain', vib: num(def.vib, 0), cutK: num(def.cutK, 0), xf: !!def.xf, pan: def.pan !== undefined ? num(def.pan, 0) : undefined, legOff: num(def.legOff, 0.22), zones: [], ready: false, failed: 0 };
    S.inst[name] = inst;
    const jobs = (def.zones || []).map(z => loadBuf(z.file).then(buf => {
      inst.zones.push({ buf, root: num(z.root, 60), lo: num(z.lo, 0), hi: num(z.hi, 127), loop: z.loop ? [z.loop[0] + S.offset, z.loop[1] + S.offset] : null, vel: z.vel || [0, 1], rr: z.rr || 0, gain: dbtoa(num(z.gain, 0)), pan: z.pan !== undefined ? num(z.pan, 0) : undefined });
    }).catch(e => { inst.failed++; S.errors++; if (S.errors < 4) console.warn('[samples] ' + z.file + ' failed', e && e.message); }));
    return Promise.all(jobs).then(() => { inst.zones.sort((a, b) => a.root - b.root || a.vel[0] - b.vel[0] || a.rr - b.rr); inst.ready = inst.zones.length > 0; return inst; });
  }

  // load everything (idempotent). Resolves when every instrument has been tried; partial sets are fine.
  S.load = function () {
    if (S.pending) return S.pending;
    if (!S.enabled || typeof fetch !== 'function') { S.state = 'disabled'; return (S.pending = Promise.resolve(false)); }
    S.state = 'loading';
    S.pending = fetchBuf(S.base + 'instruments.json').then(ab => JSON.parse(new TextDecoder().decode(ab))).then(man => {
      S.manifest = man;
      return calibrate(man).then(off => {
        S.offset = off;
        const names = Object.keys(man.instruments || {});
        return Promise.all(names.map(n => loadInstrument(n, man.instruments[n])));
      });
    }).then(() => {
      S.state = 'ready';
      try { if (A.Music && A.Music.onSamplesReady) A.Music.onSamplesReady(); } catch (e) { console.warn('[samples] ready hook failed', e); }
      try { window.dispatchEvent(new CustomEvent('moo-samples-loaded')); } catch (e) { /* ignore */ }
      return true;
    }).catch(e => { S.state = 'failed'; console.warn('[samples] manifest failed', e && e.message); return false; });
    return S.pending;
  };
  S.preload = S.load;
  S.ready = name => { const i = S.inst[name]; return !!(i && i.ready); };
  S.has = name => !!(S.manifest && S.manifest.instruments && S.manifest.instruments[name]);
  S.status = () => ({ state: S.state, enabled: S.enabled, offsetMs: Math.round(S.offset * 1000), instruments: Object.keys(S.inst).filter(n => S.inst[n].ready).length, total: Object.keys(S.inst).length, mb: Math.round(S.bytes / 1048576), errors: S.errors });
  S.zones = name => (S.inst[name] ? S.inst[name].zones.map(z => ({ root: z.root, lo: z.lo, hi: z.hi, vel: z.vel, rr: z.rr, secs: Math.round(z.buf.duration * 100) / 100, loop: z.loop })) : null);
  // the real-time engine loads as soon as audio is unlocked
  A.onReady(() => { S.load(); });

  // ------------------------------------------------------------------ zone choice
  // the zones that should sound for (midi, dyn): one zone, or — for instruments recorded in dynamic layers (inst.xf) — the two layers
  // around the asked dynamic with equal-power weights, so a swell moves through the real timbres (mp -> ff) instead of a lowpass.
  function layersAt(inst, midi) {
    const zs = inst.zones; if (!zs.length) return [];
    let cands = inst.pitched ? zs.filter(z => midi >= z.lo && midi <= z.hi) : zs;
    if (!cands.length) { let best = zs[0], bd = 1e9; for (const z of zs) { const d = Math.abs(z.root - midi); if (d < bd) { bd = d; best = z; } } cands = zs.filter(z => z.root === best.root); }
    const byLayer = new Map();
    for (const z of cands) { const k = z.vel[0]; if (!byLayer.has(k)) byLayer.set(k, []); byLayer.get(k).push(z); }
    return [...byLayer.entries()].sort((a, b) => a[0] - b[0]).map(([k, list]) => ({ c: (list[0].vel[0] + list[0].vel[1]) / 2, list }));
  }
  function rrPick(inst, list) {
    if (list.length === 1) return list[0];
    const k = inst.name + ':' + list[0].root + ':' + list[0].vel[0], i = (S.rr[k] = ((S.rr[k] || 0) + 1) % list.length);
    return list[i];
  }
  // -> [{ z, g0, g1 }] : zones with their gain at the start (dyn0) and the end (dyn1) of the note
  function pickZones(inst, midi, dyn0, dyn1) {
    const L = layersAt(inst, midi); if (!L.length) return [];
    if (L.length === 1 || !inst.xf) {
      // single layer, or hard-switched layers: the layer whose velocity window holds the dynamic
      const at = d => { let best = L[0], bd = 1e9; for (const l of L) { const dd = Math.abs(l.c - d); if (dd < bd) { bd = dd; best = l; } } return best; };
      const l0 = at(dyn0), l1 = at(dyn1);
      if (l0 === l1 || !inst.xf) return [{ z: rrPick(inst, l0.list), g0: 1, g1: 1 }];
    }
    const w = d => {                                   // weights per layer at dynamic d (equal-power between the two nearest centres)
      const out = new Array(L.length).fill(0);
      if (d <= L[0].c) { out[0] = 1; return out; }
      if (d >= L[L.length - 1].c) { out[L.length - 1] = 1; return out; }
      for (let i = 0; i + 1 < L.length; i++) if (d >= L[i].c && d <= L[i + 1].c) { const x = (d - L[i].c) / Math.max(1e-6, L[i + 1].c - L[i].c); out[i] = Math.cos(x * Math.PI / 2); out[i + 1] = Math.sin(x * Math.PI / 2); return out; }
      return out;
    };
    const w0 = w(dyn0), w1 = w(dyn1), out = [];
    for (let i = 0; i < L.length; i++) if (w0[i] > 0.001 || w1[i] > 0.001) out.push({ z: rrPick(inst, L[i].list), g0: w0[i], g1: w1[i] });
    return out;
  }

  // ------------------------------------------------------------------ the voice
  // o: smp (instrument), f (Hz; ignored for unpitched kits unless o.tune semitones), dur, vel 0..1+ (level), dyn 0..1 (which dynamic
  //    layer; defaults to vel), swell (dyn at the end of the note: a crescendo / diminuendo through the recorded layers), att/rel
  //    (override the instrument's), pan (else the zone's / instrument's seat on the stage), prio, send, vib (cents), ens (0..1 second
  //    detuned copy), cut (lowpass Hz), gain, leg (legato: start past the attack transient, short fade-in), hum (humanize: timing /
  //    pitch spread in ms / cents, 0 = none), fb / fbo (fallback synth voice + its params), oneShot (play the whole sample),
  //    alignEnd (one-shots that must end on the downbeat: swells, rolls), hold (shorts: extra ring after the written length)
  V.sample = function (eng, dest, t, o) {
    const inst = S.inst[o.smp];
    if (!inst || !inst.ready) {
      if (o.fb === 'none') return null;             // a pure sweetener layer: nothing plays until the samples are in
      const fb = V[o.fb || 'pad']; if (!fb || fb === V.sample) return null;
      const fo = Object.assign({}, o.fbo || {});
      for (const k of ['f', 'dur', 'vel', 'pan', 'prio', 'send']) if (o[k] !== undefined) fo[k] = o[k];
      return fb(eng, dest, t, fo);
    }
    const vel = clamp(num(o.vel, 0.6), 0, 1.5), dyn = clamp(num(o.dyn, Math.min(1, vel)), 0, 1), dyn1 = o.swell !== undefined ? clamp(num(o.swell, dyn), 0, 1) : dyn;
    let midi = inst.pitched ? ftom(Math.max(8, o.f || 261.6)) : 60 + num(o.tune, 0);
    if (inst.pitched && inst.zones.length) {        // far outside the recorded range: fold by octaves (timpani asked for a bass note, choir for a high one)
      const lo = inst.zones[0].lo, hi = inst.zones[inst.zones.length - 1].hi;
      while (midi < lo - 2 && midi + 12 <= hi) midi += 12;
      while (midi > hi + 2 && midi - 12 >= lo) midi -= 12;
    }
    const picks = pickZones(inst, midi, dyn, dyn1); if (!picks.length) return null;
    const z0 = picks[0].z;
    const pan = o.pan !== undefined ? o.pan : (z0.pan !== undefined ? z0.pan : inst.pan);
    const v = eng.voice(dest, t, o.prio || (inst.kind === 'sustain' ? 1 : 2), pan, o.send); if (!v) return null;
    const ctx = eng.ctx;
    const oneShot = o.oneShot || (inst.kind !== 'sustain' && (o.dur === undefined || o.ring));
    const hum = o.hum !== undefined ? num(o.hum, 0) : (oneShot ? 0.5 : 1);
    if (hum > 0) t += eng.rand() * 0.009 * hum;    // nobody in an orchestra starts on the same sample
    const rate0 = Math.pow(2, (midi - z0.root) / 12);
    if (oneShot && o.alignEnd && o.dur) {           // swells and rolls that must peak on the downbeat: start early so the sample ends there
      t = t + o.dur - z0.buf.duration / rate0;
      if (t < eng.now() - 0.05) return null;
    }
    const leg = !!o.leg && inst.kind === 'sustain' && !oneShot;
    const att = Math.max(0.002, leg ? num(o.legAtt, 0.06) : num(o.att, inst.attack)), rel = Math.max(0.02, num(o.rel, inst.release));
    const minDur = Math.min(...picks.map(p => p.z.buf.duration / Math.pow(2, (midi - p.z.root) / 12)));
    const looped = !oneShot && picks.every(p => p.z.loop);          // a looped sustain holds as long as the score asks
    const want = Math.max(0.03, num(o.dur, 1)) + (inst.kind !== 'sustain' ? num(o.hold, 0.12) : 0);
    const dur = oneShot ? Math.max(0.05, minDur - rel) : (looped ? want : Math.min(want, minDur));
    const end = t + dur + rel + 0.12;
    const env = v.gain(0.0001), mix = v.gain(1);
    // velocity-tracked lowpass: soft notes are darker (the sample layers do most of the work; this is the glue between them)
    let node = mix;
    const cut = o.cut !== undefined ? o.cut : (inst.cutK ? inst.cutK * (0.35 + 0.65 * dyn) : 0);
    if (cut > 0 && cut < 16000) { const lp = v.filter('lowpass', cut, 0.5); mix.connect(lp); node = lp; }
    node.connect(env); env.connect(v.out);
    const vib = o.vib !== undefined ? o.vib : inst.vib;
    const detHum = hum > 0 ? (eng.rand() * 2 - 1) * 3 * hum : 0;
    const makeSrc = (z, det, delay, g0, g1) => {
      const src = v.add(ctx.createBufferSource());
      const rate = Math.pow(2, (midi - z.root) / 12);
      src.buffer = z.buf; src.playbackRate.value = rate;
      if (z.loop && !oneShot) { src.loop = true; src.loopStart = z.loop[0]; src.loopEnd = Math.min(z.loop[1], z.buf.duration - 0.001); }
      if (det) src.detune.value = det;
      const sg = v.gain(g0); src.connect(sg); sg.connect(mix);
      if (g1 !== g0) { sg.gain.setValueAtTime(g0, t + delay); sg.gain.linearRampToValueAtTime(g1, t + delay + dur); }
      const t0 = t + delay;
      // legato: skip the bow / breath attack already heard on the previous note (but stay well before the loop)
      const off = leg ? Math.min(num(inst.legOff, 0.22), z.loop ? Math.max(0, z.loop[0] - 0.4) : 0.2) : 0;
      src.start(t0, off); src.stop(end); v.srcs.push(src);
      if (end > v.t1) v.t1 = end;
      if (vib > 0 && !oneShot) { const lf = v.osc('sine', 4.6 + eng.rand() * 1.1, t0, end), lg = v.gain(0.0001); lg.gain.setValueAtTime(0.0001, t0 + 0.1); lg.gain.linearRampToValueAtTime(vib, t0 + 0.6); lf.connect(lg); lg.connect(src.detune); }
      return src;
    };
    const ens = oneShot ? 0 : num(o.ens, 0);
    for (const p of picks) {
      if (ens > 0) { makeSrc(p.z, -4 - ens * 6 + detHum, 0, 0.75 * p.g0, 0.75 * p.g1); makeSrc(p.z, 4 + ens * 6 + detHum, 0.012 + eng.rand() * 0.01, (0.75 * ens + 0.25 * (1 - ens)) * p.g0, (0.75 * ens + 0.25 * (1 - ens)) * p.g1); }
      else makeSrc(p.z, detHum, 0, p.g0, p.g1);
    }
    const lvl0 = d => oneShot ? 1 : 0.5 + 0.5 * d;
    // sub layer (o.sub = gain): a sine an octave below the note (at the note itself when it is already deep) through the same envelope,
    // the weight a bass section recorded at a distance does not carry on its own
    if (num(o.sub, 0) > 0 && inst.pitched) {
      // the samples sit at about -16 dBFS RMS; the sub is scaled so sub=1 is roughly their level, and it never goes below 30 Hz
      const f = o.f || 110, fs = f > 60 ? f / 2 : f;
      if (fs >= 30) { const so = v.osc('sine', fs, t, end), sg = v.gain(num(o.sub, 0) * 0.16 * lvl0(dyn)); const lp = v.filter('lowpass', Math.min(180, fs * 2.5), 0.7); so.connect(lp); lp.connect(sg); sg.connect(mix); }
    }
    const lvl = lvl0;
    const peak = vel * num(o.gain, 1) * inst.gain * z0.gain * lvl(dyn);
    if (oneShot) K.envPerc(env.gain, t, peak, att, dur + rel);
    else {
      K.envAdsr(env.gain, t, peak, att, 0, 1, dur, rel);
      if (dyn1 !== dyn) { mix.gain.setValueAtTime(1, t); mix.gain.linearRampToValueAtTime(lvl(dyn1) / lvl(dyn), t + dur); }   // the swell also gets louder / softer
    }
    return v.end();
  };
})(window.MOO);

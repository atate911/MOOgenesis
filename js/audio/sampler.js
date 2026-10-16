// Master of Orion — Reborn · sampled instruments for the music engine (optional layer on top of the synth voices).
// Loads assets/audio/instruments.json + the MP3 multisamples it lists (lazily, after the first user gesture; never from file://, where
// fetch is blocked: everything then stays on the procedural voices). Exposes
//   MOO.Audio.Samples.{enabled, base, load(), preload(), ready(name), has(name), status(), zones(name)}
//   MOO.Audio.Voices.sample(eng, dest, t, o)   o = {smp, f, dur, vel, att, rel, pan, prio, send, vib, ens, cut, fb, fbo, oneShot}
// A sample voice is an AudioBufferSourceNode (pitched by playbackRate, looped on the baked loop points, vibrato on `detune`), an
// optional second detuned copy ("ens" — the ensemble thickening), a velocity-tracked lowpass and an ADSR gain. When the instrument is
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
      loop: def.kind === 'sustain', vib: num(def.vib, 0), cutK: num(def.cutK, 0), zones: [], ready: false, failed: 0 };
    S.inst[name] = inst;
    const jobs = (def.zones || []).map(z => loadBuf(z.file).then(buf => {
      inst.zones.push({ buf, root: num(z.root, 60), lo: num(z.lo, 0), hi: num(z.hi, 127), loop: z.loop ? [z.loop[0] + S.offset, z.loop[1] + S.offset] : null, vel: z.vel || [0, 1], rr: z.rr || 0, gain: dbtoa(num(z.gain, 0)) });
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
  function pickZone(inst, midi, vel) {
    const zs = inst.zones; if (!zs.length) return null;
    let cands = inst.pitched ? zs.filter(z => midi >= z.lo && midi <= z.hi) : zs;
    if (!cands.length) { let best = zs[0], bd = 1e9; for (const z of zs) { const d = Math.abs(z.root - midi); if (d < bd) { bd = d; best = z; } } cands = zs.filter(z => z.root === best.root); }
    let dyn = cands.filter(z => vel >= z.vel[0] && vel <= z.vel[1]);
    if (!dyn.length) { let best = cands[0], bd = 1e9; for (const z of cands) { const c = (z.vel[0] + z.vel[1]) / 2, d = Math.abs(c - vel); if (d < bd) { bd = d; best = z; } } dyn = cands.filter(z => z.vel[0] === best.vel[0]); }
    if (dyn.length === 1) return dyn[0];
    const k = inst.name + ':' + dyn[0].root + ':' + dyn[0].vel[0], i = (S.rr[k] = ((S.rr[k] || 0) + 1) % dyn.length);
    return dyn[i];
  }

  // ------------------------------------------------------------------ the voice
  // o: smp (instrument), f (Hz; ignored for unpitched kits unless o.tune semitones), dur, vel 0..1+, att/rel (override the instrument's),
  //    pan, prio, send, vib (cents; 0 = instrument default), ens (0..1 second detuned copy), cut (lowpass Hz; default tracks velocity), gain,
  //    fb / fbo (fallback synth voice + its params), oneShot (ignore dur, play the whole sample: hits, cymbals, rolls)
  V.sample = function (eng, dest, t, o) {
    const inst = S.inst[o.smp];
    if (!inst || !inst.ready) {
      if (o.fb === 'none') return null;             // a pure sweetener layer: nothing plays until the samples are in
      const fb = V[o.fb || 'pad']; if (!fb || fb === V.sample) return null;
      const fo = Object.assign({}, o.fbo || {});
      for (const k of ['f', 'dur', 'vel', 'pan', 'prio', 'send']) if (o[k] !== undefined) fo[k] = o[k];
      return fb(eng, dest, t, fo);
    }
    const vel = clamp(num(o.vel, 0.6), 0, 1.5), dyn = clamp(num(o.dyn, Math.min(1, vel)), 0, 1);
    let midi = inst.pitched ? ftom(Math.max(8, o.f || 261.6)) : 60 + num(o.tune, 0);
    if (inst.pitched && inst.zones.length) {        // far outside the recorded range: fold by octaves (timpani asked for a bass note, choir for a high one)
      const lo = inst.zones[0].lo, hi = inst.zones[inst.zones.length - 1].hi;
      while (midi < lo - 2 && midi + 12 <= hi) midi += 12;
      while (midi > hi + 2 && midi - 12 >= lo) midi -= 12;
    }
    const z = pickZone(inst, midi, dyn); if (!z) return null;
    const v = eng.voice(dest, t, o.prio || (inst.kind === 'sustain' ? 1 : 2), o.pan, o.send); if (!v) return null;
    const ctx = eng.ctx, rate = Math.pow(2, (midi - z.root) / 12);
    const att = Math.max(0.002, num(o.att, inst.attack)), rel = Math.max(0.02, num(o.rel, inst.release));
    const oneShot = o.oneShot || inst.kind !== 'sustain';
    if (oneShot && o.alignEnd && o.dur) {           // swells and rolls that must peak on the downbeat: start early so the sample ends there
      t = t + o.dur - z.buf.duration / rate;
      if (t < eng.now() - 0.05) return null;
    }
    const dur = oneShot ? Math.max(0.05, z.buf.duration / rate - rel) : Math.max(0.03, num(o.dur, 1));
    const end = t + dur + rel + 0.12;
    const env = v.gain(0.0001), mix = v.gain(1);
    // velocity-tracked lowpass: soft notes are darker (the sample layers do most of the work; this is the glue between them)
    let node = mix;
    const cut = o.cut !== undefined ? o.cut : (inst.cutK ? inst.cutK * (0.35 + 0.65 * dyn) : 0);
    if (cut > 0 && cut < 16000) { const lp = v.filter('lowpass', cut, 0.5); mix.connect(lp); node = lp; }
    node.connect(env); env.connect(v.out);
    const vib = o.vib !== undefined ? o.vib : inst.vib;
    const makeSrc = (det, delay, g) => {
      const src = v.add(ctx.createBufferSource());
      src.buffer = z.buf; src.playbackRate.value = rate;
      if (z.loop && !oneShot) { src.loop = true; src.loopStart = z.loop[0]; src.loopEnd = Math.min(z.loop[1], z.buf.duration - 0.001); }
      if (det) src.detune.value = det;
      const sg = v.gain(g); src.connect(sg); sg.connect(mix);
      const t0 = t + delay;
      src.start(t0, 0); src.stop(end); v.srcs.push(src);
      if (end > v.t1) v.t1 = end;
      if (vib > 0 && !oneShot) { const lf = v.osc('sine', 4.6 + eng.rand() * 1.1, t0, end), lg = v.gain(0.0001); lg.gain.setValueAtTime(0.0001, t0 + 0.1); lg.gain.linearRampToValueAtTime(vib, t0 + 0.6); lf.connect(lg); lg.connect(src.detune); }
      return src;
    };
    const ens = oneShot ? 0 : num(o.ens, 0);
    if (ens > 0) { makeSrc(-4 - ens * 6, 0, 0.75); makeSrc(4 + ens * 6, 0.012 + eng.rand() * 0.01, 0.75 * ens + 0.25 * (1 - ens)); }
    else makeSrc(0, 0, 1);
    const peak = vel * num(o.gain, 1) * inst.gain * z.gain * (oneShot ? 1 : 0.5 + 0.5 * dyn);
    if (oneShot) K.envPerc(env.gain, t, peak, att, dur + rel); else K.envAdsr(env.gain, t, peak, att, 0, 1, dur, rel);
    return v.end();
  };
})(window.MOO);

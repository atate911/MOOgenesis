// Master of Orion — Reborn · sampled instruments for the music engine (optional layer on top of the synth voices).
// Loads assets/audio/instruments.json + the MP3 multisamples it lists (lazily, after the first user gesture; never from file://, where
// fetch is blocked: everything then stays on the procedural voices). Exposes
//   MOO.Audio.Samples.{enabled, base, load(), preload(), ready(name), has(name), status(), zones(name)}
//   MOO.Audio.Voices.sample(eng, dest, t, o)   o = {smp, f, dur, vel, dyn, swell, att, rel, pan, prio, send, vib, ens, cut, hp, eq, sub, leg, hum, alt, fb, fbo, oneShot}
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
    try { if (M.Phone && M.Phone.active()) S.enabled = false; } catch (e) { /* ignore */ }   // phones: the orchestra decodes to hundreds of MB; the synth voices play
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
  // Loop seams. A sustained note is a short recording looped by the browser, and Web Audio loops with no crossfade: where the loop points do
  // not meet in phase (a third of the string, chorus and solo-brass zones; the short oboe and clarinet loops worst of all) every wrap is a
  // click or a flutter at the loop rate. So the tail of each loop is blended into the audio that leads into its start: over the last `n`
  // samples before loopEnd the recording fades out while the `n` samples before loopStart fade in, so the wrap lands on the very sound the
  // loop start continues. A quarter of the loop, at most 300 ms, never more than the lead-in the file has; linear, since both sides are the
  // same note. Done once per buffer, in the decoded audio, so every voice and every browser plays the smoothed loop.
  S.loopXf = true; S.loopXfFrac = 0.25; S.loopXfMax = 0.3;   // the blend: a quarter of the loop, at most 300 ms (a listening test may set these before preload)
  try { if (/[?&]loopxf=0\b/.test(location.search)) S.loopXf = false; } catch (e) { /* ignore */ }
  function smoothLoop(buf, ls, le) {
    if (!S.loopXf || !buf || !(le > ls)) return;
    const sr = buf.sampleRate, a = Math.round(ls * sr), b = Math.min(Math.round(le * sr), buf.length);
    const n = Math.floor(Math.min(S.loopXfFrac * (b - a), S.loopXfMax * sr, a - 0.02 * sr));
    if (n < 64) return;
    const key = a + ':' + b; buf._xf = buf._xf || {}; if (buf._xf[key]) return; buf._xf[key] = 1;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c), seg = new Float32Array(n);
      for (let i = 0; i < n; i++) { const w = (i + 1) / (n + 1); seg[i] = d[b - n + i] * (1 - w) + d[a - n + i] * w; }
      if (buf.copyToChannel) buf.copyToChannel(seg, c, b - n); else d.set(seg, b - n);
    }
  }
  S._smoothLoop = smoothLoop;
  // Loop breathing. Beyond the seam, a loop of a second or so carries one cycle of the player's vibrato and breath — a swell of four to
  // six decibels in the winds (measured: the alto flute 4.2 to 6.5 dB across its loops, the flute up to 13) — and a held note repeats it at
  // the loop rate: the "looping" heard on a long solo note. So the level across the loop is evened when the file is decoded: the RMS
  // envelope over the loop (a window of a few cycles of the note) is measured and the audio scaled towards its mean, within ±6 dB, from a
  // tenth of a second before the crossfade's lead-in (ramped in over that tenth, so the attack keeps its shape) to the loop's end. The
  // timbre and the pitch still move as the player's did; the pulse does not. A long loop (the string sections and the choirs run to four
  // seconds and swell ten decibels or more) is evened by half only, since its slow swell is a breath rather than a pulse and the section's
  // voices mask one another. `?loopflat=0` plays the loops as recorded.
  S.loopFlat = true;
  try { if (/[?&]loopflat=0\b/.test(location.search)) S.loopFlat = false; } catch (e) { /* ignore */ }
  function flattenLoop(buf, ls, le, root) {
    if (!S.loopFlat || !buf || !(le > ls)) return;
    const sr = buf.sampleRate, a = Math.round(ls * sr), b = Math.min(Math.round(le * sr), buf.length);
    if (b - a < 0.2 * sr) return;                                                      // a short loop is a few cycles of the note: nothing to even
    const key = 'f' + a + ':' + b; buf._xf = buf._xf || {}; if (buf._xf[key]) return; buf._xf[key] = 1;
    const f = 440 * Math.pow(2, ((root || 60) - 69) / 12), win = Math.max(Math.round(0.03 * sr), Math.round(6 * sr / f)), hop = Math.max(1, win >> 1);
    const strength = 1 - 0.5 * Math.min(1, Math.max(0, ((b - a) / sr - 1.5) / 2.5));     // whole up to a second and a half of loop, half from four seconds
    const n = Math.floor(Math.min(0.25 * (b - a), 0.3 * sr, a - 0.02 * sr)), pre = Math.max(0, a - Math.max(n, 0) - Math.round(0.1 * sr)), ramp = Math.max(1, a - Math.max(n, 0) - pre);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c), seg = d.slice(pre, b), pts = [];
      for (let i = pre; i < b; i += hop) { let q = 0, m = 0; for (let k = i; k < Math.min(i + win, b); k++) { q += d[k] * d[k]; m++; } pts.push(Math.sqrt(q / (m || 1))); }
      let mean = 0, cnt = 0; for (let i = a; i < b; i += hop) { mean += pts[Math.floor((i - pre) / hop)]; cnt++; }
      mean = cnt ? mean / cnt : 0; if (!(mean > 1e-5)) continue;
      const gAt = i => { const x = (i - pre - win / 2) / hop, j = Math.max(0, Math.floor(x)), t = Math.min(1, Math.max(0, x - j)), p0 = pts[Math.min(j, pts.length - 1)], p1 = pts[Math.min(j + 1, pts.length - 1)], e = p0 + (p1 - p0) * t; return Math.min(2, Math.max(0.5, mean / (e > 1e-6 ? e : mean))); };
      for (let i = pre; i < b; i++) { let g = 1 + (gAt(i) - 1) * strength; if (i < pre + ramp) g = 1 + (g - 1) * ((i - pre) / ramp); seg[i - pre] *= g; }
      if (buf.copyToChannel) buf.copyToChannel(seg, c, pre); else d.set(seg, pre);
    }
  }
  S._flattenLoop = flattenLoop;
  // Loop breathing, by band. The level evening above holds the loop's overall level; what a solo wind or brass loop still carries is a slow
  // cycle in its timbre (the breath: the harmonics rising and falling against the fundamental, the overall level held), and the hall's
  // early reflections turn that into a pulse of two or three decibels at the pitches whose fundamental they thin — heard as "looping" on a
  // long solo note. So for the solo instruments each band is evened on its own: a short-time spectrum of the loop (46 ms frames, 75%
  // overlap), each bin's magnitude divided by its own slow trend (a 300 ms average) towards its mean over the loop, within ±12 dB, the
  // quiet bins between the partials left alone, then overlap-added back. Vibrato at five hertz is faster than the trend and stays; the
  // breath cycle does not. The sections and the choirs mask one another and keep their slow swell. `?loopeven=0` turns it off.
  S.loopEven = true;
  try { if (/[?&]loopeven=0\b/.test(location.search)) S.loopEven = false; } catch (e) { /* ignore */ }
  const EVEN = { altoFlute: 1, flute: 1, oboe: 1, corAnglais: 1, clarinet: 1, bassoon: 1, hornSolo: 1, tptSolo: 1 };   // the instruments heard alone on long notes
  const hannWin = n => { const w = new Float32Array(n); for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n); return w; };
  function fft(re, im) {                                                  // in place, radix 2, n a power of two
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
          re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
          const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
  }
  function evenLoop(buf, ls, le, root) {
    if (!S.loopEven || !buf || !(le > ls)) return;
    const sr = buf.sampleRate, a = Math.round(ls * sr), b = Math.min(Math.round(le * sr), buf.length);
    if (b - a < 0.3 * sr) return;
    const key = 'e' + a + ':' + b; buf._xf = buf._xf || {}; if (buf._xf[key]) return; buf._xf[key] = 1;
    const N = 2048, H = N / 4, win = hannWin(N), R = Math.max(1, Math.round(0.15 * sr / H));
    const n = Math.floor(Math.min(S.loopXfFrac * (b - a), S.loopXfMax * sr, a - 0.02 * sr)), p0 = Math.max(0, a - Math.max(n, 0) - Math.round(0.1 * sr)), ramp = Math.max(1, Math.round(0.1 * sr));
    const strength = 1 - 0.5 * Math.min(1, Math.max(0, ((b - a) / sr - 1.5) / 2.5));
    const f0 = Math.floor((p0 - N) / H) + 1, f1 = Math.floor((b - 1) / H), F = f1 - f0 + 1;   // every frame that touches [p0, b)
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c), RE = [], IM = [], MAG = [];
      for (let f = 0; f < F; f++) {
        const st = (f0 + f) * H, re = new Float64Array(N), im = new Float64Array(N);
        for (let i = 0; i < N; i++) { const k = st + i; re[i] = (k >= 0 && k < d.length ? d[k] : 0) * win[i]; }
        fft(re, im); RE.push(re); IM.push(im);
        const m = new Float32Array(N / 2 + 1); for (let k = 0; k <= N / 2; k++) m[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]); MAG.push(m);
      }
      // each bin: its slow trend (a running mean over ±R frames) and its mean over the loop proper
      const inLoop = f => { const ctr = (f0 + f) * H + N / 2; return ctr >= a && ctr < b; };
      let gmax = 0; const mu = new Float32Array(N / 2 + 1);
      for (let k = 0; k <= N / 2; k++) { let q = 0, cnt = 0; for (let f = 0; f < F; f++) if (inLoop(f)) { q += MAG[f][k]; cnt++; } mu[k] = cnt ? q / cnt : 0; if (mu[k] > gmax) gmax = mu[k]; }
      if (!(gmax > 1e-6)) continue;
      const out = new Float64Array(b - p0 + N), wsum = new Float64Array(b - p0 + N);
      for (let f = 0; f < F; f++) {
        const re = RE[f], im = IM[f], st = (f0 + f) * H, lo = Math.max(0, f - R), hi = Math.min(F - 1, f + R);
        const ctr = st + N / 2, rampW = Math.min(1, Math.max(0, (ctr - p0) / ramp));
        for (let k = 0; k <= N / 2; k++) {
          let tr = 0; for (let g = lo; g <= hi; g++) tr += MAG[g][k]; tr /= (hi - lo + 1);
          const w = Math.min(1, mu[k] / (0.005 * gmax)) * strength * rampW;   // every partial above the noise, the bins between them left alone
          let gn = tr > 1e-9 ? Math.min(4, Math.max(0.25, mu[k] / tr)) : 1; gn = 1 + (gn - 1) * w;   // within ±12 dB: the clarinet's even harmonics swing that far
          re[k] *= gn; im[k] *= gn; if (k > 0 && k < N / 2) { re[N - k] = re[k]; im[N - k] = -im[k]; }
        }
        // inverse: conjugate trick
        for (let i = 0; i < N; i++) im[i] = -im[i];
        fft(re, im);
        for (let i = 0; i < N; i++) { const k = st + i - p0; if (k >= 0 && k < out.length) { out[k] += (re[i] / N) * win[i]; wsum[k] += win[i] * win[i]; } }
      }
      const seg = d.slice(p0, b);
      for (let k = 0; k < b - p0; k++) if (wsum[k] > 1e-3) seg[k] = out[k] / wsum[k];
      if (buf.copyToChannel) buf.copyToChannel(seg, c, p0); else d.set(seg, p0);
    }
  }
  S._evenLoop = evenLoop;
  // Loop length. A loop whose length is not a whole number of periods of the note wraps with a phase step, and the seam blend above then
  // slides the phase through that step once a cycle: alone that is a small dip, but against the hall's early reflections and the delay (a
  // copy of the same note a few milliseconds behind) the slide swings the level by several decibels once per loop — the pulse heard on a
  // long solo note at some pitches and not others. So the loop end is moved, within one period, to where the waveform best matches the
  // loop start (normalised correlation over a few periods, refined between samples), and the loop runs in phase. `?looptune=0` keeps the
  // file's own loop points.
  S.loopTune = true;
  try { if (/[?&]looptune=0\b/.test(location.search)) S.loopTune = false; } catch (e) { /* ignore */ }
  function tuneLoop(buf, ls, le, root) {
    if (!S.loopTune || !buf || !(le > ls)) return le;
    const sr = buf.sampleRate, d = buf.getChannelData(0), a = Math.round(ls * sr), b = Math.round(le * sr);
    const f = 440 * Math.pow(2, ((root || 60) - 69) / 12), P = sr / f, L = Math.round(Math.max(4 * P, 0.02 * sr)), R = Math.ceil(P);
    if (a + L >= b - R - 1 || b + R + L > buf.length) return le;
    let ea = 0; for (let i = 0; i < L; i++) ea += d[a + i] * d[a + i]; if (!(ea > 1e-9)) return le;
    const corr = k => { let c = 0, e = 0; for (let i = 0; i < L; i++) { c += d[a + i] * d[k + i]; e += d[k + i] * d[k + i]; } return e > 1e-9 ? c / Math.sqrt(ea * e) : 0; };
    let best = -2, bk = b; for (let k = b - R; k <= b + R; k++) { const c = corr(k); if (c > best) { best = c; bk = k; } }
    if (best < 0.5) return le;                                                        // not a periodic wave at this window: leave it
    const c0 = corr(bk - 1), c1 = best, c2 = corr(bk + 1), den = c0 - 2 * c1 + c2, frac = den < 0 ? Math.max(-0.5, Math.min(0.5, 0.5 * (c0 - c2) / den)) : 0;   // parabolic refinement between samples
    return (bk + frac) / sr;
  }
  S._tuneLoop = tuneLoop;
  // Loop length, again: a loop of a fifth of a second (the oboe's run from 0.18 to 0.37 s, half the clarinet's) repeats three to five times
  // a second, which is heard as a flutter whatever is done at its seam. Where the recording holds a longer steady stretch, the loop is
  // moved there when the file is decoded: the RMS envelope (20 ms) is taken, the sustain level is the median over the middle half of the
  // file, and the longest run within -6 / +3 dB of it, trimmed by 50 ms at its start and 30 ms at its end, becomes the loop when it is
  // longer than 0.45 s and longer than the loop the file had; the end is then tuned to whole periods as above. `?looplong=0` keeps the
  // file's own loop points.
  S.loopLong = true;
  try { if (/[?&]looplong=0\b/.test(location.search)) S.loopLong = false; } catch (e) { /* ignore */ }
  function relocateLoop(buf, ls, le) {
    if (!S.loopLong || !buf || !(le > ls) || le - ls >= 0.5) return [ls, le];
    const sr = buf.sampleRate, d = buf.getChannelData(0), W = Math.round(0.02 * sr), n = Math.floor(d.length / W), env = new Float32Array(n);
    for (let i = 0; i < n; i++) { let q = 0; for (let k = i * W; k < (i + 1) * W; k++) q += d[k] * d[k]; env[i] = Math.sqrt(q / W); }
    const mid = Array.from(env.slice(Math.floor(n * 0.25), Math.floor(n * 0.75))).sort((p, q) => p - q), lvl = mid[Math.floor(mid.length / 2)];
    if (!(lvl > 1e-5)) return [ls, le];
    let best = [0, 0], run = 0;
    for (let i = 0; i < n; i++) { const db = 20 * Math.log10(env[i] / lvl); if (db > -6 && db < 3) { run++; if (run > best[1] - best[0]) best = [i - run + 1, i + 1]; } else run = 0; }
    const s0 = best[0] * W / sr + 0.05, e0 = best[1] * W / sr - 0.03;
    if (e0 - s0 < 0.45 || e0 - s0 <= le - ls) return [ls, le];
    return [Math.max(s0, 0.03), Math.min(e0, buf.duration - 0.002)];
  }
  S._relocateLoop = relocateLoop;
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
      let loop = z.loop ? [z.loop[0] + S.offset, z.loop[1] + S.offset] : null;
      if (loop && inst.loop) { const rl = relocateLoop(buf, loop[0], Math.min(loop[1], buf.duration - 0.001)), ls = rl[0], le = tuneLoop(buf, ls, rl[1], num(z.root, 60)); loop = [ls, le]; if (EVEN[name]) evenLoop(buf, ls, le, num(z.root, 60)); flattenLoop(buf, ls, le, num(z.root, 60)); smoothLoop(buf, ls, le); }   // the loop a whole number of periods, its bands and its level even, its seam blended
      inst.zones.push({ buf, root: num(z.root, 60), lo: num(z.lo, 0), hi: num(z.hi, 127), loop, vel: z.vel || [0, 1], rr: z.rr || 0, gain: dbtoa(num(z.gain, 0)), pan: z.pan !== undefined ? num(z.pan, 0) : undefined });
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
  const altCount = Object.create(null);
  function layersAt(inst, midi, alt) {
    const zs = inst.zones; if (!zs.length) return [];
    let cands = inst.pitched ? zs.filter(z => midi >= z.lo && midi <= z.hi) : zs;
    if (alt && inst.pitched && cands.length) {          // alternate between this note's take and a neighbour's (if the neighbour was recorded)
      const k = inst.name + ':' + midi, n = (altCount[k] = ((altCount[k] || 0) + 1) % 3);
      if (n) { const near = zs.filter(z => Math.abs(z.root - midi) >= 0.5 && Math.abs(z.root - midi) <= 1.5 && z.vel[0] === cands[0].vel[0]); if (near.length) cands = [near[(n - 1) % near.length]]; }
    }
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
  function pickZones(inst, midi, dyn0, dyn1, alt) {
    const L = layersAt(inst, midi, alt); if (!L.length) return [];
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
    const picks = pickZones(inst, midi, dyn, dyn1, !!o.alt); if (!picks.length) return null;
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
    if (num(o.hp, 0) > 20) { const hpf = v.filter('highpass', num(o.hp, 0), 0.7); node.connect(hpf); node = hpf; }
    // per-instrument EQ (o.eq = [[Hz, dB, Q | 'hs' | 'ls'], ...]): the mixer's channel EQ on this voice
    if (Array.isArray(o.eq)) for (const e of o.eq) {
      const f = v.filter(e[2] === 'hs' ? 'highshelf' : e[2] === 'ls' ? 'lowshelf' : 'peaking', e[0], typeof e[2] === 'number' ? e[2] : undefined);
      f.gain.value = e[1]; node.connect(f); node = f;
    }
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
      const f = o.f || 110, fs = f >= 64 ? f / 2 : (f < 45 ? f : 0);
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

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
  // At most S.fetchMax requests in flight: the library is some 1,800 files, and a browser asked for all of them at once refuses the
  // overflow (Chromium: net::ERR_INSUFFICIENT_RESOURCES), which left whole instruments silent. A failed fetch is tried once more.
  S.fetchMax = 16; let inFlight = 0; const waiting = [];
  function fetchBuf(url) {
    return new Promise((res, rej) => {
      const go = tries => { inFlight++;
        fetch(url).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url); return r.arrayBuffer(); })
          .then(ab => { done(); res(ab); }, e => { done(); if (tries > 0 && !/^HTTP 4/.test(e && e.message)) waiting.push(() => go(tries - 1)); else rej(e); pump(); }); };
      waiting.push(() => go(1)); pump();
    });
  }
  function done() { inFlight--; pump(); }
  function pump() { while (inFlight < S.fetchMax && waiting.length) waiting.shift()(); }
  // Loop seams. A sustained note is a short recording looped by the browser, and Web Audio loops with no crossfade: where the loop points do
  // not meet in phase (a third of the string, chorus and solo-brass zones; the short oboe and clarinet loops worst of all) every wrap is a
  // click or a flutter at the loop rate. So the tail of each loop is blended into the audio that leads into its start: over the last `n`
  // samples before loopEnd the recording fades out while the `n` samples before loopStart fade in, so the wrap lands on the very sound the
  // loop start continues. A quarter of the loop, at most 300 ms, never more than the lead-in the file has; linear, since both sides are the
  // same note. Done once per buffer, in the decoded audio, so every voice and every browser plays the smoothed loop.
  S.loopXf = true; S.loopXfFrac = 0.25; S.loopXfMax = 0.3;   // the blend: a quarter of the loop, at most 300 ms (a listening test may set these before preload)
  try { if (/[?&]loopxf=0\b/.test(location.search)) S.loopXf = false; } catch (e) { /* ignore */ }
  S.loopXfAdapt = true; S.loopAlign = true;
  try { if (/[?&]loopalign=0\b/.test(location.search)) S.loopAlign = false; } catch (e) { /* ignore */ }
  try { if (/[?&]loopxfadapt=0\b/.test(location.search)) S.loopXfAdapt = false; } catch (e) { /* ignore */ }
  // Before the blend, the seam itself: when the stretch before the loop's end and the stretch before its start do not line up (their
  // correlation under 0.6: the loop is not a whole number of the note's cycles at that moment, as where the player's pitch moved inside
  // the loop), the end is moved within one cycle of the note to where they line up best. A blend of two stretches out of phase cancels
  // (the solo horn's C sharp, which also plays the theme's D, sank 9 dB before every wrap). Returns the loop end it used, in seconds.
  function alignSeam(buf, a, b, root) {
    const sr = buf.sampleRate, d = buf.getChannelData(0), P = Math.round(sr / (440 * Math.pow(2, ((root || 60) - 69) / 12))), N = Math.min(2048, a - 4);
    if (!(P > 4) || N < 256 || b + P >= buf.length) return b;
    const rhoAt = bb => { let xy = 0, xx = 0, yy = 0; for (let i = 0; i < N; i++) { const t = d[bb - N + i], l = d[a - N + i]; xy += t * l; xx += t * t; yy += l * l; } return xy / (Math.sqrt(xx * yy) + 1e-12); };
    const r0 = rhoAt(b); if (r0 >= 0.6) return b;
    let best = b, rb = r0;
    for (let s = -P; s <= P; s++) { const bb = b + s; if (bb - N <= a + N) continue; const r = rhoAt(bb); if (r > rb) { rb = r; best = bb; } }
    return rb > r0 + 0.05 ? best : b;
  }
  function smoothLoop(buf, ls, le, root) {
    if (!S.loopXf || !buf || !(le > ls)) return;
    const sr = buf.sampleRate, a = Math.round(ls * sr);
    let b = Math.min(Math.round(le * sr), buf.length);
    if (S.loopAlign && root) b = alignSeam(buf, a, b, root);
    const n = Math.floor(Math.min(S.loopXfFrac * (b - a), S.loopXfMax * sr, a - 0.02 * sr));
    if (n < 64) return b / sr;
    const key = a + ':' + b; buf._xf = buf._xf || {}; if (buf._xf[key]) return b / sr; buf._xf[key] = 1;
    // The blend's gain law follows how alike the two sides are. A single player's note is the same wave on both sides (correlation near
    // one) and a straight line keeps its level; a section or a choir is many players whose two sides do not line up (correlation 0.2 to
    // 0.6), and the same straight line sank there by up to 3 dB halfway through, a dip at every wrap, the repeat heard on a held chord.
    // So the correlation of the two sides is measured (in four stretches, interpolated) and both gains are divided by the root of the
    // blend's power at that correlation: the level holds whatever the material. `?loopxfadapt=0` restores the straight line.
    const K = 4, rho = new Float32Array(K);
    if (S.loopXfAdapt) {
      const d0 = buf.getChannelData(0), d1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : d0;
      for (let k = 0; k < K; k++) { const i0 = Math.floor(k * n / K), i1 = Math.floor((k + 1) * n / K); let xy = 0, xx = 0, yy = 0;
        for (let i = i0; i < i1; i++) { const t = 0.5 * (d0[b - n + i] + d1[b - n + i]), l = 0.5 * (d0[a - n + i] + d1[a - n + i]); xy += t * l; xx += t * t; yy += l * l; }
        rho[k] = Math.max(-0.3, Math.min(1, xy / (Math.sqrt(xx * yy) + 1e-12))); }
    }
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c), seg = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const w = (i + 1) / (n + 1); let g1 = 1 - w, g2 = w;
        if (S.loopXfAdapt) { const x = Math.min(K - 1, Math.max(0, (i / n) * K - 0.5)), k0 = Math.floor(x), k1 = Math.min(K - 1, k0 + 1), r = rho[k0] + (rho[k1] - rho[k0]) * (x - k0);
          const P = g1 * g1 + g2 * g2 + 2 * r * g1 * g2, q = 1 / Math.sqrt(Math.max(P, 0.25)); g1 *= q; g2 *= q; }
        seg[i] = d[b - n + i] * g1 + d[a - n + i] * g2;
      }
      if (buf.copyToChannel) buf.copyToChannel(seg, c, b - n); else d.set(seg, b - n);
    }
    return b / sr;
  }
  S._smoothLoop = smoothLoop;
  // Loop breathing. Beyond the seam, a loop of a second or so carries one cycle of the player's vibrato and breath — a swell of four to
  // six decibels in the winds (measured: the alto flute 4.2 to 6.5 dB across its loops, the flute up to 13) — and a held note repeats it at
  // the loop rate: the "looping" heard on a long solo note. So the level across the loop is evened when the file is decoded: the RMS
  // envelope over the loop (a window of a few cycles of the note) is measured and the audio scaled towards its mean, within ±12 dB, from a
  // tenth of a second before the crossfade's lead-in (ramped in over that tenth, so the attack keeps its shape) to the loop's end. The
  // timbre and the pitch still move as the player's did; the pulse does not. The sections and the choirs (loops of two to four seconds that
  // swell ten to seventeen decibels) are evened whole as well: held through the bus their swell came back every cycle as a pulse of four to
  // ten decibels, and the swells the music wants come from the engine's own envelopes. `?loopflat=0` plays the loops as recorded.
  S.loopFlat = true;
  try { if (/[?&]loopflat=0\b/.test(location.search)) S.loopFlat = false; } catch (e) { /* ignore */ }
  function flattenLoop(buf, ls, le, root) {
    if (!S.loopFlat || !buf || !(le > ls)) return;
    const sr = buf.sampleRate, a = Math.round(ls * sr), b = Math.min(Math.round(le * sr), buf.length);
    if (b - a < 0.2 * sr) return;                                                      // a short loop is a few cycles of the note: nothing to even
    const key = 'f' + a + ':' + b; buf._xf = buf._xf || {}; if (buf._xf[key]) return; buf._xf[key] = 1;
    const f = 440 * Math.pow(2, ((root || 60) - 69) / 12), win = Math.max(Math.round(0.03 * sr), Math.round(6 * sr / f)), hop = Math.max(1, win >> 1);
    const strength = 1;
    const n = Math.floor(Math.min(0.25 * (b - a), 0.3 * sr, a - 0.02 * sr)), pre = Math.max(0, a - Math.max(n, 0) - Math.round(0.1 * sr)), ramp = Math.max(1, a - Math.max(n, 0) - pre);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c), seg = d.slice(pre, b), pts = [];
      for (let i = pre; i < b; i += hop) { let q = 0, m = 0; for (let k = i; k < Math.min(i + win, b); k++) { q += d[k] * d[k]; m++; } pts.push(Math.sqrt(q / (m || 1))); }
      let mean = 0, cnt = 0; for (let i = a; i < b; i += hop) { mean += pts[Math.floor((i - pre) / hop)]; cnt++; }
      mean = cnt ? mean / cnt : 0; if (!(mean > 1e-5)) continue;
      const gAt = i => { const x = (i - pre - win / 2) / hop, j = Math.max(0, Math.floor(x)), t = Math.min(1, Math.max(0, x - j)), p0 = pts[Math.min(j, pts.length - 1)], p1 = pts[Math.min(j + 1, pts.length - 1)], e = p0 + (p1 - p0) * t; return Math.min(4, Math.max(0.25, mean / (e > 1e-6 ? e : mean))); };
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
  // loop start (normalised correlation over a few periods, refined between samples, summed over both channels of a stereo recording so
  // that neither channel wraps with a phase step of its own: a held cello showed left and right swinging two decibels in antiphase once a
  // loop when only the left was matched), and the loop runs in phase. `?looptune=0` keeps the file's own loop points.
  S.loopTune = true;
  try { if (/[?&]looptune=0\b/.test(location.search)) S.loopTune = false; } catch (e) { /* ignore */ }
  function tuneLoop(buf, ls, le, root) {
    if (!S.loopTune || !buf || !(le > ls)) return le;
    const sr = buf.sampleRate, chans = []; for (let c = 0; c < buf.numberOfChannels; c++) chans.push(buf.getChannelData(c));
    const a = Math.round(ls * sr), b = Math.round(le * sr);
    const f = 440 * Math.pow(2, ((root || 60) - 69) / 12), P = sr / f, L = Math.round(Math.max(4 * P, 0.02 * sr)), R = Math.ceil(P);
    if (a + L >= b - R - 1 || b + R + L > buf.length) return le;
    const eas = chans.map(d => { let ea = 0; for (let i = 0; i < L; i++) ea += d[a + i] * d[a + i]; return ea; }); if (!(eas[0] > 1e-9)) return le;
    const corr = k => { let sum = 0; for (let c = 0; c < chans.length; c++) { const d = chans[c]; let cc = 0, e = 0; for (let i = 0; i < L; i++) { cc += d[a + i] * d[k + i]; e += d[k + i] * d[k + i]; } sum += e > 1e-9 && eas[c] > 1e-9 ? cc / Math.sqrt(eas[c] * e) : 0; } return sum / chans.length; };
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
  // The zone's true pitch. The manifest's roots are good to about a cent, and a cent between two recordings of one note (a sustain's soft
  // and loud layers, blended) is a beat every one to three seconds — held through the bus a horn-section note at the blend swung by nine
  // decibels while either layer alone was flat. So each looped zone's fundamental is measured when its file is decoded (the period by
  // autocorrelation around the nominal, refined between samples, the median over the loop) and the zone is played from that root, to a
  // fraction of a cent. `?looptune=0` keeps the manifest's roots as well as its loop ends.
  function refineRoot(buf, ls, le, root) {
    if (!S.loopTune || !buf || !(le > ls)) return root;
    const sr = buf.sampleRate, d = buf.getChannelData(0), a = Math.round(ls * sr), b = Math.min(Math.round(le * sr), buf.length);
    const f = 440 * Math.pow(2, (root - 69) / 12), P0 = sr / f; if (P0 < 8 || P0 > sr / 25) return root;
    const L = Math.round(Math.max(6 * P0, 0.02 * sr)), lo = Math.floor(P0 * 0.97), hi = Math.ceil(P0 * 1.03), hop = Math.round(0.025 * sr), ps = [];
    for (let at = a; at + L + hi < b; at += hop) {
      let best = -2, bk = Math.round(P0); const cs = {};
      const c = k => { let s = 0, e1 = 0, e2 = 0; for (let i = 0; i < L; i++) { s += d[at + i] * d[at + k + i]; e1 += d[at + i] * d[at + i]; e2 += d[at + k + i] * d[at + k + i]; } return s / Math.sqrt(e1 * e2 + 1e-12); };
      for (let k = lo; k <= hi; k++) { cs[k] = c(k); if (cs[k] > best) { best = cs[k]; bk = k; } }
      if (best < 0.6) continue;
      const c0 = cs[bk - 1] !== undefined ? cs[bk - 1] : c(bk - 1), c2 = cs[bk + 1] !== undefined ? cs[bk + 1] : c(bk + 1), den = c0 - 2 * best + c2;
      ps.push(bk + (den < 0 ? 0.5 * (c0 - c2) / den : 0));
    }
    if (ps.length < 4) return root;
    ps.sort((p, q) => p - q); const P = ps[ps.length >> 1], r = 69 + 12 * Math.log2(sr / P / 440);
    return Math.abs(r - root) <= 0.5 ? r : root;                                      // within a quarter tone of the manifest's root, else leave it
  }
  S._refineRoot = refineRoot;
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
      let loop = z.loop ? [z.loop[0] + S.offset, z.loop[1] + S.offset] : null, root = num(z.root, 60);
      if (loop && inst.loop) { const rl = relocateLoop(buf, loop[0], Math.min(loop[1], loop[1] - loop[0] > 0.5 ? buf.duration - 0.065 : buf.duration - 0.001)), ls = rl[0]; root = inst.pitched ? refineRoot(buf, ls, rl[1], root) : root; const le = tuneLoop(buf, ls, rl[1], root); loop = [ls, le]; if (EVEN[name]) evenLoop(buf, ls, le, root); flattenLoop(buf, ls, le, root); { const le2 = smoothLoop(buf, ls, le, inst.pitched ? root : 0); if (le2 > ls) loop = [ls, le2]; }; }   // the zone's true pitch; the loop a whole number of periods, its bands and its level even, its seam blended
      inst.zones.push({ buf, root, lo: num(z.lo, 0), hi: num(z.hi, 127), loop, vel: z.vel || [0, 1], rr: z.rr || 0, gain: dbtoa(num(z.gain, 0)), pan: z.pan !== undefined ? num(z.pan, 0) : undefined });
    }).catch(e => { inst.failed++; S.errors++; if (S.errors < 4) console.warn('[samples] ' + z.file + ' failed', e && e.message); }));
    return Promise.all(jobs).then(() => { inst.zones.sort((a, b) => a.root - b.root || a.vel[0] - b.vel[0] || a.rr - b.rr); alignLayers(inst); inst.ready = inst.zones.length > 0; return inst; });
  }

  // The dynamic layers of a sampled section are recorded at their own levels: the soft layer of the strings, the trumpets, the trombones,
  // the low brass and the cellos sits eighteen to twenty decibels under the loud one, so a written crescendo lurched by that much at the
  // hand-over, a pad at a soft dynamic all but vanished against a single-layer voice (the choirs, the solo winds), and a solo line written
  // soft sat under its bed. The level of a note is the engine's business (its velocity law and the section's level), the layer's job is
  // the timbre: so at decode time each layer of a pitched sustain is measured (the RMS of its loops, the median over the layer's zones)
  // and set against the loudest layer at four decibels per half of the dynamic range (a soft layer under a loud one: -4 dB; a full-range
  // layer beside both: -2 dB); the engine's velocity law adds its own three decibels across the hand-over, so a written crescendo now
  // steps seven to ten decibels where it stepped twenty. Percussion keeps its recorded dynamics. `?layeralign=0` plays the layers as recorded.
  S.layerAlign = true; S.align = {};
  try { if (/[?&]layeralign=0\b/.test(location.search)) S.layerAlign = false; } catch (e) { /* ignore */ }
  // the loudness of a zone's steady part (its loop, else its middle half): K-weighted as BS.1770 hears it (the shelf above 1.5 kHz and
  // the high-pass at 38 Hz, with the 48 kHz coefficients, near enough at any rate), because a soft layer is darker than a loud one and
  // plain RMS understates how much quieter it sounds
  function zoneDb(z) {
    const sr = z.buf.sampleRate, n = z.buf.length, a = z.loop ? Math.floor(z.loop[0] * sr) : Math.floor(n * 0.25), b = z.loop ? Math.min(n, Math.ceil(z.loop[1] * sr)) : Math.floor(n * 0.75);
    if (b - a < 64) return null; let acc = 0;
    for (let c = 0; c < z.buf.numberOfChannels; c++) {
      const d = z.buf.getChannelData(c); let x1 = 0, x2 = 0, y1 = 0, y2 = 0, u1 = 0, u2 = 0, w1 = 0, w2 = 0;
      for (let i = a; i < b; i++) {
        const x = d[i], y = 1.53512485958697 * x - 2.69169618940638 * x1 + 1.19839281085285 * x2 + 1.69065929318241 * y1 - 0.73248077421585 * y2; x2 = x1; x1 = x;
        const w = y - 2 * u1 + u2 + 1.99004745483398 * w1 - 0.99007225036621 * w2; u2 = u1; u1 = y; y2 = y1; y1 = y; w2 = w1; w1 = w;
        acc += w * w;
      }
    }
    const rms = Math.sqrt(acc / ((b - a) * z.buf.numberOfChannels)); return rms > 1e-6 ? 20 * Math.log10(rms) : null;
  }
  function alignLayers(inst) {
    if (!S.layerAlign || inst.kind !== 'sustain' || !inst.pitched) return;
    const byLayer = new Map();
    for (const z of inst.zones) { const k = z.vel[0] + '-' + z.vel[1]; if (!byLayer.has(k)) byLayer.set(k, { c: (z.vel[0] + z.vel[1]) / 2, dbs: [], zones: [] }); const L = byLayer.get(k); L.zones.push(z); const db = zoneDb(z); if (db !== null) L.dbs.push(db); }
    if (byLayer.size < 2) return;
    const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
    const layers = [...byLayer.values()].map(L => Object.assign(L, { db: med(L.dbs) })).filter(L => L.db !== null); if (layers.length < 2) return;
    const loud = layers.reduce((a, b) => b.c > a.c ? b : a), log = {};
    for (const L of layers) { const target = loud.db - 8 * (loud.c - L.c), g = target - L.db; for (const z of L.zones) z.gain *= dbtoa(g); log[L.zones[0].vel.join('-')] = { db: Math.round(L.db * 10) / 10, gainDb: Math.round(g * 10) / 10, zones: L.zones.length }; }
    S.align[inst.name] = log;
  }

  // (a loop stays 65 ms clear of the file's end: the build fades a file's last 30 ms, and a loop run into that fade sank at every wrap)
  // load everything (idempotent). Resolves when every instrument has been tried; partial sets are fine. S.loadSome(names) loads just those
  // instruments (a player page that starts one piece needs a fifth of the library, and a phone cannot hold all of it decoded); either can
  // follow the other, nothing loads twice. S.autoLoad = false (set before the engine is unlocked) keeps the unlock from loading everything.
  S.autoLoad = true; const jobs = Object.create(null); let manP = null;
  function manifestP() {
    return manP || (manP = fetchBuf(S.base + 'instruments.json').then(ab => JSON.parse(new TextDecoder().decode(ab))).then(man => {
      S.manifest = man; return calibrate(man).then(off => { S.offset = off; return man; });
    }));
  }
  function loadNames(man, names) { const I = man.instruments || {}; return Promise.all(names.filter(n => I[n]).map(n => jobs[n] || (jobs[n] = loadInstrument(n, I[n])))); }
  S.load = function () {
    if (S.pending) return S.pending;
    if (!S.enabled || typeof fetch !== 'function') { S.state = 'disabled'; return (S.pending = Promise.resolve(false)); }
    S.state = 'loading';
    S.pending = manifestP().then(man => loadNames(man, Object.keys(man.instruments || {}))).then(() => {
      S.state = 'ready';
      try { if (A.Music && A.Music.onSamplesReady) A.Music.onSamplesReady(); } catch (e) { console.warn('[samples] ready hook failed', e); }
      try { window.dispatchEvent(new CustomEvent('moo-samples-loaded')); } catch (e) { /* ignore */ }
      return true;
    }).catch(e => { S.state = 'failed'; console.warn('[samples] manifest failed', e && e.message); return false; });
    return S.pending;
  };
  S.loadSome = function (names) {
    if (!S.enabled || typeof fetch !== 'function') return Promise.resolve(false);
    if (S.state === 'idle' || S.state === undefined || S.state === 'disabled') S.state = 'partial';
    return manifestP().then(man => loadNames(man, [].concat(names || []))).then(() => true).catch(e => { console.warn('[samples] manifest failed', e && e.message); return false; });
  };
  S.preload = S.load;
  S.ready = name => { const i = S.inst[name]; return !!(i && i.ready); };
  S.has = name => !!(S.manifest && S.manifest.instruments && S.manifest.instruments[name]);
  S.status = () => ({ state: S.state, enabled: S.enabled, offsetMs: Math.round(S.offset * 1000), instruments: Object.keys(S.inst).filter(n => S.inst[n].ready).length, total: Object.keys(S.inst).length, mb: Math.round(S.bytes / 1048576), errors: S.errors });
  S.zones = name => (S.inst[name] ? S.inst[name].zones.map(z => ({ root: z.root, lo: z.lo, hi: z.hi, vel: z.vel, rr: z.rr, secs: Math.round(z.buf.duration * 100) / 100, loop: z.loop })) : null);
  // the real-time engine loads as soon as audio is unlocked
  A.onReady(() => { if (S.autoLoad !== false) S.load(); });

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
    // Two recordings of one note never sound together for long: their pitches drift against each other (a few cents inside each loop, each
    // its own way) and the sum beats by eight to sixteen decibels, however exactly the zones are tuned. So a swell that crosses from one
    // layer to the next plays the first layer alone, then hands over to the next in a quarter of a second at the moment the written
    // dynamic crosses the midpoint between the two, and so on up through the layers; a note that stays within one layer plays that
    // layer alone. (It was an equal-power blend across the whole span, both layers sounding for most of a swell.)
    const at = d => { let best = L[0], bd = 1e9; for (const l of L) { const dd = Math.abs(l.c - d); if (dd < bd) { bd = dd; best = l; } } return best; };
    const i0 = L.indexOf(at(dyn0)), i1 = L.indexOf(at(dyn1));
    if (i0 === i1) return [{ z: rrPick(inst, L[i0].list), g0: 1, g1: 1 }];
    const step = i1 > i0 ? 1 : -1, out = [], span = dyn1 - dyn0 || 1e-6;
    for (let i = i0; i !== i1 + step; i += step) {
      const mIn = i === i0 ? null : (L[i].c + L[i - step].c) / 2, mOut = i === i1 ? null : (L[i].c + L[i + step].c) / 2;   // the dynamics at which this layer takes over and hands on
      const fIn = mIn === null ? 0 : Math.min(0.97, Math.max(0.03, (mIn - dyn0) / span)), fOut = mOut === null ? 1 : Math.min(0.97, Math.max(0.03, (mOut - dyn0) / span));
      out.push({ z: rrPick(inst, L[i].list), g0: mIn === null ? 1 : 0, g1: mOut === null ? 1 : 0, fIn: mIn === null ? null : fIn, fOut: mOut === null ? null : fOut });   // fractions of the note at which it fades in / out
    }
    return out;
  }

  // ------------------------------------------------------------------ the voice
  // o: smp (instrument), f (Hz; ignored for unpitched kits unless o.tune semitones), dur, vel 0..1+ (level), dyn 0..1 (which dynamic
  //    layer; defaults to vel), swell (dyn at the end of the note: a crescendo / diminuendo through the recorded layers), att/rel
  //    (override the instrument's), pan (else the zone's / instrument's seat on the stage), prio, send, vib (cents), vibRate (Hz: the piece's tempo-locked rate, else 4.6-5.7 at random), ens (0..1 second
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
    const cutK = num(o.cutK, inst.cutK), cut = o.cut !== undefined ? o.cut : (cutK ? cutK * (0.35 + 0.65 * dyn) : 0);   // the voice may bring its own cutK (a solo horn darker when soft)
    if (cut > 0 && cut < 16000) { const lp = v.filter('lowpass', cut, 0.5); mix.connect(lp); node = lp; }
    if (num(o.hp, 0) > 20) { const hpf = v.filter('highpass', num(o.hp, 0), 0.7); node.connect(hpf); node = hpf; }
    // per-instrument EQ (o.eq = [[Hz, dB, Q | 'hs' | 'ls'], ...]): the mixer's channel EQ on this voice
    if (Array.isArray(o.eq)) for (const e of o.eq) {
      const f = v.filter(e[2] === 'hs' ? 'highshelf' : e[2] === 'ls' ? 'lowshelf' : 'peaking', e[0], typeof e[2] === 'number' ? e[2] : undefined);
      f.gain.value = e[1]; node.connect(f); node = f;
    }
    // the voice's width (o.width, 0..1; 1 as recorded): a wide stereo recording (the choirs, the sections) narrowed toward one place by
    // scaling its side against its mid, so a sung line can stand at the centre as one voice while the recording's room stays around it
    const width = o.width !== undefined ? clamp(num(o.width, 1), 0, 1) : 1;
    if (width < 1) {
      const sp = v.add(ctx.createChannelSplitter(2)), mg = v.add(ctx.createChannelMerger(2)), a = (1 + width) / 2, b = (1 - width) / 2;
      const ll = v.gain(a), lr = v.gain(b), rl = v.gain(b), rr = v.gain(a);
      node.connect(sp); sp.connect(ll, 0); sp.connect(lr, 0); sp.connect(rl, 1); sp.connect(rr, 1);
      ll.connect(mg, 0, 0); rl.connect(mg, 0, 0); lr.connect(mg, 0, 1); rr.connect(mg, 0, 1); node = mg;
    }
    node.connect(env); env.connect(v.out);
    const vib = o.vib !== undefined ? o.vib : inst.vib;
    const detHum = hum > 0 ? (eng.rand() * 2 - 1) * 3 * hum : 0;
    const makeSrc = (z, det, delay, g0, g1, fx) => {
      const src = v.add(ctx.createBufferSource());
      const rate = Math.pow(2, (midi - z.root) / 12);
      src.buffer = z.buf; src.playbackRate.value = rate;
      if (z.loop && !oneShot) { src.loop = true; src.loopStart = z.loop[0]; src.loopEnd = Math.min(z.loop[1], z.buf.duration - 0.001); }
      if (det) src.detune.value = det;
      const sg = v.gain(g0); src.connect(sg); sg.connect(mix);
      if (fx) {                                        // a layer of a swell: in and out in a quarter of a second at the handover points
        const XF = Math.min(0.25, dur * 0.3), t0 = t + delay; sg.gain.setValueAtTime(g0, t0);
        if (fx.fIn !== null) { const a = t0 + fx.fIn * dur - XF / 2; sg.gain.setValueAtTime(0, Math.max(t0, a)); sg.gain.linearRampToValueAtTime(1, Math.max(t0, a) + XF); }
        if (fx.fOut !== null) { const a = t0 + fx.fOut * dur - XF / 2; sg.gain.setValueAtTime(1, Math.max(t0, a)); sg.gain.linearRampToValueAtTime(0, Math.max(t0, a) + XF); }
      } else if (g1 !== g0) { sg.gain.setValueAtTime(g0, t + delay); sg.gain.linearRampToValueAtTime(g1, t + delay + dur); }
      const t0 = t + delay;
      // legato: skip the bow / breath attack already heard on the previous note (but stay well before the loop)
      const off = leg ? Math.min(num(inst.legOff, 0.22), z.loop ? Math.max(0, z.loop[0] - 0.4) : 0.2) : 0;
      src.start(t0, off); src.stop(end); v.srcs.push(src);
      if (end > v.t1) v.t1 = end;
      if (vib > 0 && !oneShot) { const vr = o.vibRate > 0 ? o.vibRate * (0.99 + eng.rand() * 0.02) : 4.6 + eng.rand() * 1.1, lf = v.osc('sine', vr, t0, end), lg = v.gain(0.0001); lg.gain.setValueAtTime(0.0001, t0 + 0.1); lg.gain.linearRampToValueAtTime(vib, t0 + 0.6); lf.connect(lg); lg.connect(src.detune); }
      return src;
    };
    const ens = oneShot ? 0 : num(o.ens, 0);
    for (const p of picks) {
      const fx = p.fIn !== undefined ? { fIn: p.fIn, fOut: p.fOut } : null;
      if (ens > 0) { makeSrc(p.z, -4 - ens * 6 + detHum, 0, 0.75 * p.g0, 0.75 * p.g1, fx); makeSrc(p.z, 4 + ens * 6 + detHum, 0.012 + eng.rand() * 0.01, (0.75 * ens + 0.25 * (1 - ens)) * p.g0, (0.75 * ens + 0.25 * (1 - ens)) * p.g1, fx); }
      else makeSrc(p.z, detHum, 0, p.g0, p.g1, fx);
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

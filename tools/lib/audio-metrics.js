// Audio measurement helpers shared by tools/test-audio.html (browser) and tools/audio-report.js (headless Chromium).
// Pure functions over AudioBuffers / Float32Arrays: BS.1770 loudness (K-weighted, gated), peak / RMS / crest, limiter engagement
// (how much of the signal sits in the master soft-clipper's knee), spectral balance + tilt, stereo correlation, silence windows,
// head / tail clicks, and a 16-bit WAV encoder for exporting renders.  No dependencies; loads as a plain <script> or via require().
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AudioMetrics = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const db = x => 20 * Math.log10(Math.max(x, 1e-10));

  // ---- RBJ biquad design + zero-state filtering -----------------------------------------------------------------------
  function shelfHi(fs, f0, Q, gainDb) {
    const A = Math.pow(10, gainDb / 40), w0 = 2 * Math.PI * f0 / fs, cw = Math.cos(w0), al = Math.sin(w0) / (2 * Q), sA = Math.sqrt(A);
    const b0 = A * ((A + 1) + (A - 1) * cw + 2 * sA * al), b1 = -2 * A * ((A - 1) + (A + 1) * cw), b2 = A * ((A + 1) + (A - 1) * cw - 2 * sA * al);
    const a0 = (A + 1) - (A - 1) * cw + 2 * sA * al, a1 = 2 * ((A - 1) - (A + 1) * cw), a2 = (A + 1) - (A - 1) * cw - 2 * sA * al;
    return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  }
  function highpass(fs, f0, Q) {
    const w0 = 2 * Math.PI * f0 / fs, cw = Math.cos(w0), al = Math.sin(w0) / (2 * Q);
    const b0 = (1 + cw) / 2, b1 = -(1 + cw), b2 = (1 + cw) / 2, a0 = 1 + al, a1 = -2 * cw, a2 = 1 - al;
    return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  }
  function filt(x, c) {
    const y = new Float32Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) { const xi = x[i], yi = c[0] * xi + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2; x2 = x1; x1 = xi; y2 = y1; y1 = yi; y[i] = yi; }
    return y;
  }

  // ---- ITU-R BS.1770-4 loudness: integrated (gated), max momentary (400 ms), max short-term (3 s), EBU loudness range ----
  function loudness(L, R, sr) {
    const s1 = shelfHi(sr, 1681.974450955533, 0.7071752369554196, 3.999843853973347), s2 = highpass(sr, 38.13547087602444, 0.5003270373238773);
    const kl = filt(filt(L, s1), s2), kr = filt(filt(R, s1), s2), n = L.length;
    const pl = new Float64Array(n + 1), pr = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) { pl[i + 1] = pl[i] + kl[i] * kl[i]; pr[i + 1] = pr[i] + kr[i] * kr[i]; }
    const lk = (s, len) => -0.691 + 10 * Math.log10(Math.max(((pl[s + len] - pl[s]) + (pr[s + len] - pr[s])) / len, 1e-12));
    const mean = arr => { let e = 0; for (const b of arr) e += Math.pow(10, (b + 0.691) / 10); return -0.691 + 10 * Math.log10(e / arr.length); };
    const blk = Math.round(sr * 0.4), hop = Math.round(sr * 0.1), mom = [];
    for (let s = 0; s + blk <= n; s += hop) mom.push(lk(s, blk));
    if (!mom.length && n) mom.push(lk(0, n));
    let momentMax = -Infinity; for (const b of mom) if (b > momentMax) momentMax = b;
    const abs = mom.filter(b => b > -70);
    let integrated = -Infinity;
    if (abs.length) { const rel = mean(abs) - 10, g = abs.filter(b => b > rel); if (g.length) integrated = mean(g); }
    const sblk = Math.min(n, Math.round(sr * 3)), shop = Math.max(1, Math.round(sr * 1)), st = [];
    for (let s = 0; s + sblk <= n; s += shop) st.push(lk(s, sblk));
    let shortMax = -Infinity; for (const b of st) if (b > shortMax) shortMax = b;
    let lra = 0;
    const sa = st.filter(b => b > -70);
    if (sa.length >= 2) { const r2 = mean(sa) - 20, g2 = sa.filter(b => b > r2).sort((a, b) => a - b); if (g2.length >= 2) lra = g2[Math.floor(0.95 * (g2.length - 1))] - g2[Math.floor(0.10 * (g2.length - 1))]; }
    return { integrated, momentMax, shortMax, lra };
  }

  // ---- FFT (radix-2, in place) -------------------------------------------------------------------------------------------
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const a = i + k, b = a + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
          const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
  }

  // ---- the full measurement -------------------------------------------------------------------------------------------
  // opts: { knee: 0.6 (where the master soft clipper starts bending), hot: 0.9, silentDb: -55 }
  function analyze(buf, opts) {
    opts = opts || {};
    const KNEE = opts.knee === undefined ? 0.6 : opts.knee, HOT = opts.hot === undefined ? 0.9 : opts.hot, SIL = opts.silentDb === undefined ? -55 : opts.silentDb;
    const sr = buf.sampleRate, n = buf.length, L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
    let peak = 0, sumsq = 0, nan = 0, dc = 0, clip = 0, knee = 0, hot = 0, sl = 0, sr2 = 0, slr = 0;
    for (let i = 0; i < n; i++) {
      const l = L[i], r = R[i];
      if (l !== l || r !== r || l === Infinity || r === Infinity || l === -Infinity || r === -Infinity) { nan++; continue; }
      const al = l < 0 ? -l : l, ar = r < 0 ? -r : r, a = al > ar ? al : ar;
      if (a > peak) peak = a; if (a > 0.99) clip++; if (a > HOT) hot++; if (a > KNEE) knee++;
      sumsq += (l * l + r * r) * 0.5; dc += (l + r) * 0.5; sl += l * l; sr2 += r * r; slr += l * r;
    }
    const N1 = Math.max(1, n), rms = Math.sqrt(sumsq / N1);
    const out = {
      secs: n / sr, sr, peak, peakDb: db(peak), rms, rmsDb: db(rms), crestDb: db(peak) - db(rms), dc: dc / N1, nan, clip,
      kneePct: 100 * knee / N1, hotPct: 100 * hot / N1,
      corr: sl > 0 && sr2 > 0 ? slr / Math.sqrt(sl * sr2) : 1, balanceDb: db(Math.sqrt(sl / N1)) - db(Math.sqrt(sr2 / N1)),
    };
    // 1-second windows: silence share, quietest / loudest second
    const w = Math.floor(sr); let silent = 0, wins = 0, winMin = 0, winMax = -200;
    for (let s = 0; s + w <= n; s += w) {
      let e = 0; for (let i = s; i < s + w; i++) { const m = (L[i] + R[i]) * 0.5; e += m * m; }
      const d = db(Math.sqrt(e / w)); wins++; if (d < SIL) silent++; if (d > winMax) winMax = d; if (wins === 1 || d < winMin) winMin = d;
    }
    out.silentPct = wins ? 100 * silent / wins : 0; out.winMin = winMin; out.winMax = winMax;
    // RMS over the half-second windows that contain sound (level of the *active* part: fair for short effects)
    { const hw = Math.floor(sr * 0.5); let pw = 0, cnt = 0;
      for (let s0 = 0; s0 + hw <= n; s0 += hw) { let e = 0; for (let i = s0; i < s0 + hw; i++) { const m = (L[i] + R[i]) * 0.5; e += m * m; } e /= hw; if (db(Math.sqrt(e)) > -65) { pw += e; cnt++; } }
      out.actDb = cnt ? db(Math.sqrt(pw / cnt)) : -200; }
    // averaged power spectrum (mono sum, Hann, 4096)
    const N = 4096, hop = Math.max(N, Math.floor(n / 160)), re = new Float64Array(N), im = new Float64Array(N), P = new Float64Array(N / 2), win = new Float64Array(N);
    for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
    let frames = 0;
    for (let s = 0; s + N <= n; s += hop) {
      for (let i = 0; i < N; i++) { re[i] = (L[s + i] + R[s + i]) * 0.5 * win[i]; im[i] = 0; }
      fft(re, im);
      for (let k = 0; k < N / 2; k++) P[k] += re[k] * re[k] + im[k] * im[k];
      frames++;
    }
    const bw = sr / N, edges = [0, 60, 250, 1000, 4000, 10000, 1e9], be = [0, 0, 0, 0, 0, 0];
    let tot = 0, cen = 0, eLo = 0, eMid = 0, eHi = 0;
    for (let k = 1; k < N / 2; k++) {
      const f = k * bw, e = P[k]; tot += e; cen += e * f;
      if (f < 200) eLo += e; else if (f < 2000) eMid += e; else eHi += e;
      for (let b = 0; b < 6; b++) if (f >= edges[b] && f < edges[b + 1]) { be[b] += e; break; }
    }
    out.bands = be.map(e => (tot ? 100 * e / tot : 0));       // sub <60 | low 60-250 | lowmid 250-1k | mid 1k-4k | high 4k-10k | air >10k (% of power)
    out.low = tot ? 100 * eLo / tot : 0; out.mid = tot ? 100 * eMid / tot : 0; out.high = tot ? 100 * eHi / tot : 0;   // <200 | 200-2k | >2k
    out.centroid = tot ? cen / tot : 0;
    // spectral tilt in dB per octave: regression of third-octave band power (dB) against octave number, 100 Hz .. 10 kHz
    { const xs = [], ys = []; let f0 = 100;
      while (f0 * Math.pow(2, 1 / 3) <= 10000) {
        const f1 = f0 * Math.pow(2, 1 / 3); let e = 0, c = 0;
        for (let k = Math.ceil(f0 / bw); k < f1 / bw && k < N / 2; k++) { e += P[k]; c++; }
        if (c) { xs.push(Math.log2(f0)); ys.push(10 * Math.log10(e / c + 1e-20)); }
        f0 = f1;
      }
      let mx = 0, my = 0; for (let i = 0; i < xs.length; i++) { mx += xs[i]; my += ys[i]; } mx /= xs.length; my /= xs.length;
      let sxy = 0, sxx = 0; for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); }
      out.tiltDbOct = sxx ? sxy / sxx : 0; }
    // head / tail (clicks at the edges) and effective length (last 20 ms window above the silence floor)
    let head = 0; for (let i = 0; i < Math.min(8, n); i++) head = Math.max(head, Math.abs(L[i]), Math.abs(R[i]));
    let tail = 0; for (let i = Math.max(0, n - 256); i < n; i++) tail = Math.max(tail, Math.abs(L[i]), Math.abs(R[i]));
    out.head = head; out.tail = tail;
    const wlen = Math.max(1, Math.floor(sr * 0.02)); let eff = 0;
    for (let s = Math.floor((n - wlen) / wlen) * wlen; s >= 0; s -= wlen) { let e = 0; for (let i = s; i < s + wlen; i++) { const m = (L[i] + R[i]) * 0.5; e += m * m; } if (db(Math.sqrt(e / wlen)) > SIL) { eff = (s + wlen) / sr; break; } }
    out.effSecs = eff;
    // envelope (16 bins) + log band feature vector (for nearest-neighbour similarity between effects)
    const eb = 16, env = [], seg = Math.max(1, Math.floor(n / eb));
    for (let b = 0; b < eb; b++) { let e = 0; for (let i = b * seg; i < Math.min(n, (b + 1) * seg); i++) { const m = (L[i] + R[i]) * 0.5; e += m * m; } env.push(Math.sqrt(e / seg)); }
    out.env = env;
    const fe = [60, 120, 250, 500, 1000, 2000, 4000, 8000, 16000], feat = [0, 0, 0, 0, 0, 0, 0, 0];
    for (let k = 1; k < N / 2; k++) { const f = k * bw; for (let b = 0; b < 8; b++) if (f >= fe[b] && f < fe[b + 1]) { feat[b] += P[k]; break; } }
    out.feat = feat.map(x => Math.log10(x + 1e-12));
    // loudness
    const lu = loudness(L, R, sr);
    out.lufs = lu.integrated; out.lufsMoment = lu.momentMax; out.lufsShort = lu.shortMax; out.lra = lu.lra;
    return out;
  }

  // ---- 16-bit PCM WAV -----------------------------------------------------------------------------------------------------
  function toWav16(buf) {
    const ch = buf.numberOfChannels, n = buf.length, sr = buf.sampleRate, bytes = 44 + n * ch * 2, ab = new ArrayBuffer(bytes), v = new DataView(ab);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, bytes - 8, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * ch * 2, true);
    const data = []; for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
    let o = 44;
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { let s = data[c][i]; s = s < -1 ? -1 : s > 1 ? 1 : s; v.setInt16(o, s < 0 ? s * 32768 : s * 32767, true); o += 2; }
    return ab;
  }
  function wavBase64(buf) {
    const u8 = new Uint8Array(toWav16(buf)); let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function cosine(a, b) { let d = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return d / Math.sqrt(na * nb || 1); }

  return { analyze, loudness, toWav16, wavBase64, cosine, db, shelfHi, highpass, filt };
});

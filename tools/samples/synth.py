#!/usr/bin/env python3
"""Offline synthesis of the instruments no CC0 recording covers: a male choir (oh / ah), a mixed upper choir, analogue ensemble
pads and a deep sub layer. Rendered with far more voices and care than the real-time engine could afford, then multisampled every
few semitones and encoded by build.py like the recorded instruments.  Pure numpy; no scipy.

    python3 tools/samples/synth.py OUT_DIR          # writes OUT_DIR/<inst>-<note>.wav (stereo float32, 44.1 kHz) + OUT_DIR/synth.json

Choir: every singer is an additive glottal source (harmonics falling 12 dB/oct above 800 Hz) shaped by five vowel formants, with its own
vibrato rate / depth / onset, pitch drift, breath noise and stereo position; 14 (bass) .. 18 (upper) singers per note.
Pads: a nine-voice stereo unison (each voice with its own drift and seat in the field) through a slowly breathing 4-pole lowpass, tape-like
saturation and a wide three-tap chorus, Jonn Serrie style. The choir renderers are kept for reference; the game now uses the recorded chorus.
"""
import json, math, os, sys
import numpy as np

SR = 44100
rng = np.random.default_rng(20261016)

def midi_f(m): return 440.0 * 2 ** ((m - 69) / 12)
NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
def note_name(m): return NOTE_NAMES[m % 12] + str(m // 12 - 1)

# vowel formants (Hz, bandwidth Hz, relative dB) for low male voices and for a mixed upper choir
FORMANTS = {
    'oh_male':  [(400, 60, 0), (750, 80, -6), (2400, 110, -12), (2700, 130, -14), (3300, 160, -19)],
    'ah_male':  [(650, 70, 0), (1080, 90, -4), (2650, 120, -10), (2900, 140, -12), (3400, 170, -17)],
    'ah_upper': [(800, 80, 0), (1150, 100, -3), (2900, 130, -9), (3300, 150, -12), (4200, 200, -19)],
    'oo_upper': [(380, 60, 0), (900, 90, -10), (2600, 120, -16), (3000, 140, -18), (3600, 180, -23)],
}

def formant_gain(freqs, formants):
    """|H(f)| of parallel two-pole resonators (magnitude only; phase does not matter for an additive source)."""
    g = np.zeros_like(freqs, dtype=np.float64)
    for f0, bw, db in formants:
        a = 10 ** (db / 20)
        g += a / np.sqrt(1 + ((freqs ** 2 - f0 ** 2) / (freqs * bw + 1e-9)) ** 2)
    return g

def singer(f0, formants, secs, bright=1.0):
    n = int(secs * SR); t = np.arange(n) / SR
    # pitch: slow drift + vibrato that starts after an onset, with a rate wobble of its own
    vrate = rng.uniform(4.7, 6.1); vdepth = rng.uniform(14, 28) * (1 + 0.15 * np.sin(2 * np.pi * rng.uniform(0.05, 0.12) * t))
    onset = rng.uniform(0.25, 0.7)
    vib_env = np.clip((t - onset) / 0.8, 0, 1)
    drift = rng.uniform(-9, 9) + 4 * np.sin(2 * np.pi * rng.uniform(0.07, 0.19) * t + rng.uniform(0, 6.28))
    cents = drift + vdepth * vib_env * np.sin(2 * np.pi * vrate * t + rng.uniform(0, 6.28))
    freq = f0 * 2 ** (cents / 1200)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    nh = int(min(60, 9000 / f0)); h = np.arange(1, nh + 1)
    # glottal spectrum: -6 dB/oct overall, -12 dB/oct above 800 Hz, plus the formants evaluated at the nominal pitch
    src_amp = 1 / h ** 0.9 * np.where(h * f0 > 1200, (1200 / (h * f0)) ** 0.8, 1.0) * bright ** np.log2(h)
    amp = src_amp * formant_gain(h * f0, formants)
    amp /= amp.max()
    out = np.zeros(n)
    shimmer = 1 + 0.03 * np.sin(2 * np.pi * rng.uniform(0.3, 0.9) * t + rng.uniform(0, 6.28))
    for k in range(nh):
        out += amp[k] * np.sin(h[k] * phase + rng.uniform(0, 6.28))
    out *= shimmer
    # breath: pink-ish noise through the same formants (FFT shaped), a few percent
    nz = rng.standard_normal(n)
    spec = np.fft.rfft(nz); fr = np.fft.rfftfreq(n, 1 / SR)
    spec *= formant_gain(np.maximum(fr, 20), formants) / np.sqrt(np.maximum(fr, 60) / 60)
    breath = np.fft.irfft(spec, n); breath /= (np.abs(breath).max() + 1e-9)
    out += 0.045 * breath * (0.6 + 0.4 * vib_env)
    # onset / release shape of one singer (the sample keeps a natural swell; the engine adds its own envelope on top)
    env = np.minimum(1, t / rng.uniform(0.35, 0.8)) * np.minimum(1, (secs - t) / 0.25)
    return out * env

def choir(midi, vowel, voices, secs, spread=1.0, bright=1.0):
    f0 = midi_f(midi); L = np.zeros(int(secs * SR)); R = np.zeros_like(L)
    for i in range(voices):
        det = rng.uniform(-13, 13) * spread
        s = singer(f0 * 2 ** (det / 1200), FORMANTS[vowel], secs, bright)
        pan = rng.uniform(-0.9, 0.9); gl = math.cos((pan + 1) * math.pi / 4); gr = math.sin((pan + 1) * math.pi / 4)
        off = int(rng.uniform(0, 0.06) * SR)
        s = np.concatenate([np.zeros(off), s[:len(s) - off]])
        L += s * gl; R += s * gr
    return np.stack([L, R], axis=1) / voices

# ---- pads --------------------------------------------------------------------------------------------------------------------
# A good analogue ensemble pad is mostly about what is *not* there: no aliasing, no static spectrum, no two oscillators locked in phase.
# Each voice of the unison has its own slow pitch drift, its own position in the stereo field and its own filter breathing; the bank goes
# through a 4-pole lowpass whose cutoff moves slowly, a touch of tape-like saturation and a wide three-tap chorus.
def saw_bank(f0, secs, voices=7, det_cents=11.0, stereo=True, drift=0.0006, wave='saw'):
    n = int(secs * SR); t = np.arange(n) / SR
    L = np.zeros(n); R = np.zeros(n)
    nh = int(min(160, 15000 / f0)); h = np.arange(1, nh + 1)
    if wave == 'saw': amp = 1 / h
    elif wave == 'square': amp = np.where(h % 2 == 1, 1 / h, 0.0)
    else: amp = np.where(h % 2 == 1, 1 / h ** 2, 0.0)                               # triangle
    amp = amp * np.minimum(1, (9000 / (h * f0)) ** 3)                              # gentle anti-alias roll-off well below Nyquist
    for i in range(voices):
        d = (i - (voices - 1) / 2) / max(1, (voices - 1) / 2) * det_cents
        f = f0 * 2 ** (d / 1200) * (1 + drift * np.sin(2 * np.pi * rng.uniform(0.04, 0.13) * t + rng.uniform(0, 6.28)))
        ph = 2 * np.pi * np.cumsum(f) / SR
        v = np.zeros(n)
        for k in range(nh): v += amp[k] * np.sin(h[k] * ph + rng.uniform(0, 6.28))
        pan = (i - (voices - 1) / 2) / max(1, (voices - 1) / 2) * 0.85 if stereo else 0.0
        gl = math.cos((pan + 1) * math.pi / 4); gr = math.sin((pan + 1) * math.pi / 4)
        L += v * gl / voices; R += v * gr / voices
    return np.stack([L, R], axis=1)

def lowpass_moving(x, cut0, cut1, rate=0.09, reso=1.5, slope=4):
    """4-pole lowpass whose cutoff breathes slowly between cut0 and cut1 (short-time FFT, overlapping Hann windows)."""
    n = len(x); W = 4096; H = W // 4
    out = np.zeros_like(x); win = np.hanning(W); norm = np.zeros(n)
    fr = np.fft.rfftfreq(W, 1 / SR)
    for s0 in range(0, n - W, H):
        tt = (s0 + W / 2) / SR
        cut = cut0 + (cut1 - cut0) * (0.5 + 0.5 * math.sin(2 * math.pi * rate * tt - math.pi / 2))
        g = 1 / np.sqrt(1 + (fr / cut) ** (2 * slope)) * (1 + (reso - 1) * np.exp(-((fr - cut * 0.85) / (cut * 0.18)) ** 2))
        for c in range(x.shape[1]):
            seg = x[s0:s0 + W, c] * win
            out[s0:s0 + W, c] += np.fft.irfft(np.fft.rfft(seg) * g, W) * win
        norm[s0:s0 + W] += win * win
    norm[norm < 1e-6] = 1
    return out / norm[:, None]

def saturate(x, drive=1.6):
    """soft tape-like saturation, level-compensated."""
    y = np.tanh(drive * x) / math.tanh(drive)
    return y * (np.sqrt(np.mean(x * x)) / (np.sqrt(np.mean(y * y)) + 1e-9))

def chorus(x, rate=0.35, depth_ms=3.5, base_ms=14.0, taps=3, mix=0.6):
    """stereo in, stereo out: each tap is a modulated delay panned across the field."""
    n = len(x); t = np.arange(n) / SR; out = np.zeros((n, 2))
    mono = x.mean(axis=1) if x.ndim == 2 else x
    for k in range(taps):
        lfo = np.sin(2 * np.pi * (rate * (1 + 0.23 * k)) * t + k * 2.1)
        delay = (base_ms + depth_ms * lfo + 2.5 * k) / 1000 * SR
        idx = np.arange(n) - delay
        y = np.interp(idx, np.arange(n), mono, left=0.0)
        pan = -0.8 + 1.6 * k / max(1, taps - 1); gl = math.cos((pan + 1) * math.pi / 4); gr = math.sin((pan + 1) * math.pi / 4)
        out[:, 0] += y * gl / taps; out[:, 1] += y * gr / taps
    dry = x if x.ndim == 2 else np.stack([x, x], axis=1)
    return dry * (1 - mix * 0.5) + out * mix * 1.2

def pad(midi, secs, kind):
    f0 = midi_f(midi); t = np.arange(int(secs * SR)) / SR
    if kind == 'serrie':                       # warm analogue strings-pad: 9 saws spread across the field, breathing 4-pole lowpass
        x = saw_bank(f0, secs, 9, 13.0)
        hi = min(12000, f0 * 8 + 1500); x = lowpass_moving(x, hi * 0.55, hi, 0.08, 1.4)
        subo = 0.3 * np.sin(2 * np.pi * f0 * 0.5 * t) * np.minimum(1, t / 0.5); x[:, 0] += subo; x[:, 1] += subo
        x = saturate(x, 1.5)
        y = chorus(x, 0.29, 2.6, 15.0, 3, 0.55)
    elif kind == 'glass':                      # glassy, airy: triangle + saw mix, high cutoff, slow shimmer
        x = 0.6 * saw_bank(f0, secs, 7, 8.0, wave='tri') + 0.5 * saw_bank(f0 * 2, secs, 5, 6.0)
        hi = min(14000, f0 * 12 + 2000); x = lowpass_moving(x, hi * 0.6, hi, 0.13, 1.2, 3)
        x *= (1 + 0.1 * np.sin(2 * np.pi * 0.17 * t))[:, None]
        x = saturate(x, 1.2)
        y = chorus(x, 0.41, 2.0, 11.0, 3, 0.45)
    else:                                      # 'dark': low, filtered, ominous
        x = saw_bank(f0, secs, 9, 9.0)
        hi = min(6500, f0 * 3.5 + 500); x = lowpass_moving(x, hi * 0.5, hi, 0.06, 2.0)
        subo = 0.45 * np.sin(2 * np.pi * f0 * 0.5 * t) * np.minimum(1, t / 0.5); x[:, 0] += subo; x[:, 1] += subo
        x = saturate(x, 1.8)
        y = chorus(x, 0.22, 4.0, 18.0, 3, 0.5)
    env = np.minimum(1, t / 0.25)[:, None] * np.minimum(1, (secs - t) / 0.2)[:, None]
    return y * env

def sub(midi, secs):
    f0 = midi_f(midi); t = np.arange(int(secs * SR)) / SR
    x = np.sin(2 * np.pi * f0 * t) + 0.18 * np.sin(2 * np.pi * 2 * f0 * t) + 0.06 * np.sin(2 * np.pi * 3 * f0 * t)
    x = np.tanh(1.4 * x) / math.tanh(1.4)
    env = np.minimum(1, t / 0.02) * np.minimum(1, (secs - t) / 0.2)
    y = x * env
    return np.stack([y, y], axis=1)

def write_wav(path, y):
    y = np.clip(y, -1, 1).astype(np.float32)
    import struct, wave
    with wave.open(path, 'wb') as w:
        w.setnchannels(y.shape[1]); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((y * 32767).astype('<i2').tobytes())

INSTRUMENTS = {
    # name: (kind, zones (midi), seconds, renderer)
    'choirOh':   dict(notes=list(range(40, 65, 4)), secs=4.6, fn=lambda m: choir(m, 'oh_male', 14, 4.6, 1.0, 0.95)),   # E2..C4  men "oh"
    'choirAh':   dict(notes=list(range(40, 65, 4)), secs=4.6, fn=lambda m: choir(m, 'ah_male', 14, 4.6, 1.0, 1.0)),    # men "ah"
    'choirHiAh': dict(notes=list(range(60, 85, 4)), secs=4.6, fn=lambda m: choir(m, 'ah_upper', 18, 4.6, 1.1, 1.05)),  # C4..C6 mixed "ah"
    'choirHiOo': dict(notes=list(range(60, 85, 4)), secs=4.6, fn=lambda m: choir(m, 'oo_upper', 18, 4.6, 1.0, 0.9)),
    'padSerrie': dict(notes=list(range(36, 85, 6)), secs=4.2, fn=lambda m: pad(m, 4.2, 'serrie')),
    'padGlass':  dict(notes=list(range(48, 97, 6)), secs=4.2, fn=lambda m: pad(m, 4.2, 'glass')),
    'padDark':   dict(notes=list(range(31, 68, 6)), secs=4.2, fn=lambda m: pad(m, 4.2, 'dark')),
    'subBass':   dict(notes=[29, 36, 43], secs=3.0, fn=lambda m: sub(m, 3.0)),
}

def main(out):
    os.makedirs(out, exist_ok=True)
    meta = {}
    for name, spec in INSTRUMENTS.items():
        meta[name] = []
        for m in spec['notes']:
            y = spec['fn'](m)
            y /= (np.abs(y).max() + 1e-9) * 1.05
            f = f'{name}-{note_name(m).replace("#", "s")}.wav'
            write_wav(os.path.join(out, f), y)
            meta[name].append({'file': f, 'root': m, 'secs': spec['secs']})
            print(f'  {name} {note_name(m)} ({midi_f(m):.1f} Hz) -> {f}', flush=True)
    json.dump(meta, open(os.path.join(out, 'synth.json'), 'w'), indent=1)

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'synth-out')

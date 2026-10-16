#!/usr/bin/env python3
"""Build assets/audio/ (the sampled instruments the music engine plays) from Sonatina Symphonic Orchestra 2.0 (CC Sampling Plus 1.0; the
orchestra, chorus and percussion), the VSCO 2 Community Edition recordings (CC0; the few instruments Sonatina lacks) and the synthesized
pads from synth.py.  Reproducible; the raw recordings are not committed.

    python3 tools/samples/build.py --sso "/path/to/sso/Sonatina Symphonic Orchestra" --vsco /path/to/VSCO-2-CE --out assets/audio
                                   [--synth-cache DIR] [--only strSus,hornSus]

Sonatina instruments are read through their own SFZ definitions (tools/samples/sfz.py): which samples make up an instrument, key ranges,
root pitch, per-sample tuning and volume corrections, start offsets, loop points (SFZ opcodes or the WAV smpl chunk), round robins and the
dynamic layers (mod-wheel crossfade groups or velocity splits) all come from the library, not from guesswork.

Per instrument: pick zones every N semitones from the available notes (one or two dynamic layers, round robins where they matter),
decode with ffmpeg, trim leading silence, level-match the instrument (one gain for all its zones so the dynamic layers keep their
relationship), find a seamless loop in the sustain (normalized cross-correlation) and bake an equal-power crossfade into it, cut the
sample right after the loop, encode MP3 (libmp3lame, VBR q0; mono for recordings, stereo for the synthesized ensembles) and write
instruments.json (zones: file, root, lo, hi, loop seconds, velocity range, round-robin index).  A 0.4 s calibration file with one impulse
at 0.1 s lets the browser measure its MP3 decoder delay and shift the loop points (see js/audio/sampler.js).
"""
import argparse, json, math, os, re, subprocess, sys, tempfile
import numpy as np

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import synth  # noqa: E402
import sfz  # noqa: E402

NOTE_RE = re.compile(r'(?<![A-Za-z])([A-G]#?)(-?\d)(?![0-9])')
NOTES = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
def note_midi(name, octv): return 12 * (int(octv) + 1) + NOTES[name]
def midi_name(m): return synth.note_name(m).replace('#', 's')
def db(x): return 20 * math.log10(max(x, 1e-9))

def decode(path, stereo=False, chan=None):
    """ffmpeg -> float64 mono (n,) or stereo (n, 2) at 44.1 kHz.  Mono from a stereo recording takes ONE channel (chan 'L' | 'R'),
    never the average: these recordings are wide and largely uncorrelated (the horns partly anti-phase), and summing them comb-filters
    the tone with 4-8 dB notches across the midrange -- the hollow, phasey colour that reads as "digital".  One microphone is a
    natural mono signal; the section is then seated on the stage by its pan."""
    af = [] if stereo else ['-af', 'pan=mono|c0=c1' if chan == 'R' else 'pan=mono|c0=c0']
    out = subprocess.run(['ffmpeg', '-v', 'error', '-i', path] + af + ['-f', 'f32le', '-ac', '2' if stereo else '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    y = np.frombuffer(out, dtype='<f4').astype(np.float64)
    return y.reshape(-1, 2) if stereo else y

def read_wav_stereo(path):
    import wave
    with wave.open(path, 'rb') as w:
        n = w.getnframes(); ch = w.getnchannels(); raw = w.readframes(n)
    y = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    return y.reshape(-1, ch)

def trim_head(x, thresh_db=-50, pre=0.004):
    a = np.abs(x if x.ndim == 1 else x.mean(axis=1)); th = 10 ** (thresh_db / 20) * max(a.max(), 1e-9)
    idx = np.argmax(a > th); start = max(0, int(idx) - int(pre * SR))
    y = x[start:]
    fade = np.minimum(1, np.arange(len(y)) / (0.002 * SR))
    return y * (fade if y.ndim == 1 else fade[:, None])

def trim_tail(x, thresh_db=-60, hold=0.08):
    a = np.abs(x if x.ndim == 1 else x.mean(axis=1)); th = 10 ** (thresh_db / 20) * max(a.max(), 1e-9)
    nz = np.nonzero(a > th)[0]
    end = min(len(a), (int(nz[-1]) if len(nz) else len(a)) + int(hold * SR))
    y = x[:end].copy(); f = int(min(0.03 * SR, len(y) // 4)); 
    if f > 0:
        ramp = np.linspace(1, 0, f)
        if y.ndim == 1: y[-f:] *= ramp
        else: y[-f:] *= ramp[:, None]
    return y

def detect_pitch(x, lo=35.0, hi=1400.0):
    """autocorrelation pitch of the loudest 1 s window; returns midi (float)."""
    m = x if x.ndim == 1 else x.mean(axis=1)
    n = min(len(m), SR); s = int(min(max(0, 0.3 * SR), max(0, len(m) - n)))
    seg = m[s:s + n] * np.hanning(n)
    spec = np.fft.rfft(seg, 2 * n); ac = np.fft.irfft(spec * np.conj(spec))[:n]
    lmin, lmax = int(SR / hi), int(SR / lo)
    ac[:lmin] = 0; r = ac[lmin:lmax]
    k = int(np.argmax(r)) + lmin
    # prefer the lowest lag whose peak is at least 80 % of the max (sub-harmonic safety)
    peaks = [i + lmin for i in range(1, len(r) - 1) if r[i] > r[i - 1] and r[i] >= r[i + 1] and r[i] > 0.8 * r.max()]
    if peaks: k = peaks[0]
    if 1 <= k < len(ac) - 1:
        a, b, c = ac[k - 1], ac[k], ac[k + 1]; k += 0.5 * (a - c) / (a - 2 * b + c + 1e-12)
    return 69 + 12 * math.log2(SR / k / 440.0)

def find_loop(x, ls_sec, lmin_sec, lmax_sec, win=8192):
    """best loop [ls, le] inside a sustain (le-ls in [lmin, lmax]): several candidate start points, the seam with the highest
    normalized cross-correlation between the window at ls and the window at le wins."""
    best = None
    for ls_try in (ls_sec, ls_sec + 0.2, ls_sec + 0.45, ls_sec + 0.7, ls_sec - 0.2, ls_sec + 1.0, ls_sec + 1.4):
        if ls_try < 0.3: continue
        r = find_loop_at(x, ls_try, lmin_sec, lmax_sec, win)
        if r and (best is None or r[2] > best[2]): best = r
    return best

def find_loop_at(x, ls_sec, lmin_sec, lmax_sec, win):
    m = x if x.ndim == 1 else x.mean(axis=1)
    ls = int(ls_sec * SR); W = win
    A = m[ls:ls + W]
    lo, hi = ls + int(lmin_sec * SR), ls + int(lmax_sec * SR)
    if hi + W > len(m): hi = len(m) - W - 1
    if hi <= lo + 10: return None
    B = m[lo:hi + W]
    # normalized cross-correlation via FFT
    n = len(B); L = 1 << int(np.ceil(np.log2(n + W)))
    corr = np.fft.irfft(np.fft.rfft(B, L) * np.conj(np.fft.rfft(A, L)), L)[:n - W + 1]
    e = np.cumsum(np.concatenate([[0.0], B * B])); eng = e[W:n + 1] - e[:n - W + 1]
    ncc = corr / (np.sqrt(eng * np.sum(A * A)) + 1e-9)
    k = int(np.argmax(ncc)); le = lo + k
    return ls, le, float(ncc[k])

def find_start(x, le, lo_len, hi_len, win=8192):
    """best loop start for a fixed loop end: the window just before `le` is matched against windows ending in [le-hi_len, le-lo_len]."""
    m = x if x.ndim == 1 else x.mean(axis=1); W = win
    if le - hi_len - W < 0 or le > len(m): return None
    A = m[le - W:le]
    lo, hi = le - hi_len, le - lo_len
    B = m[lo - W:hi]
    n = len(B); L = 1 << int(np.ceil(np.log2(n + W)))
    corr = np.fft.irfft(np.fft.rfft(B, L) * np.conj(np.fft.rfft(A, L)), L)[:n - W + 1]
    e = np.cumsum(np.concatenate([[0.0], B * B])); eng = e[W:n + 1] - e[:n - W + 1]
    ncc = corr / (np.sqrt(eng * np.sum(A * A)) + 1e-9)
    k = int(np.argmax(ncc))
    return (lo - W) + k + W, float(ncc[k])          # start = index right after the matched window

def bake_loop(x, ls, le, xf_sec=0.25):
    """make the jump le -> ls seamless: crossfade the material before le with the material before ls; cut just after le."""
    xf = int(min(xf_sec * SR, (le - ls) // 3, ls))
    y = x.copy()
    k = np.arange(xf) / xf; fo = np.cos(k * math.pi / 2); fi = np.sin(k * math.pi / 2)
    if y.ndim == 1: y[le - xf:le] = y[le - xf:le] * fo + x[ls - xf:ls] * fi
    else: y[le - xf:le] = y[le - xf:le] * fo[:, None] + x[ls - xf:ls] * fi[:, None]
    end = min(len(y), le + int(0.06 * SR))
    y = y[:end]
    f = int(0.03 * SR)
    if y.ndim == 1: y[-f:] *= np.linspace(1, 0, f)
    else: y[-f:] *= np.linspace(1, 0, f)[:, None]
    return y

def brighten(x, f0=2500.0, db_hi=3.0, f1=7000.0, db_air=1.5):
    """gentle presence: a +db_hi high shelf from f0 and a +db_air shelf from f1 (FFT domain, zero phase)."""
    mono = x.ndim == 1
    cols = [x] if mono else [x[:, c] for c in range(x.shape[1])]
    out = []
    for col in cols:
        spec = np.fft.rfft(col); fr = np.fft.rfftfreq(len(col), 1 / SR)
        g = 1 + (10 ** (db_hi / 20) - 1) / (1 + (f0 / np.maximum(fr, 1)) ** 4) + (10 ** (db_air / 20) - 1) / (1 + (f1 / np.maximum(fr, 1)) ** 4)
        out.append(np.fft.irfft(spec * g, len(col)))
    return out[0] if mono else np.stack(out, axis=1)

def rms(x, a=0, b=None):
    m = x if x.ndim == 1 else x.mean(axis=1); seg = m[a:b]
    return math.sqrt(float(np.mean(seg * seg))) if len(seg) else 0.0

def encode_mp3(y, path, stereo):
    import wave
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tf: tmp = tf.name
    yy = np.clip(y, -1, 1); 
    if yy.ndim == 1: yy = yy[:, None]
    with wave.open(tmp, 'wb') as w:
        w.setnchannels(yy.shape[1]); w.setsampwidth(2); w.setframerate(SR); w.writeframes((yy * 32767).astype('<i2').tobytes())
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', tmp, '-ac', '2' if stereo else '1', '-codec:a', 'libmp3lame', '-q:a', '0', path], check=True)
    os.unlink(tmp)

# ---------------------------------------------------------------------------------------------------- instrument specs
# src: folder under the VSCO root; re: regex with named groups note (e.g. A#3), dyn (v-number), rr (optional); dyn: list of layer
# numbers to keep in soft..loud order (velocity ranges are split evenly); rr: max round robins per layer; step: zone spacing in
# semitones; kind: sustain (looped) | short (one-shot, played whole); keep: seconds to keep for sustains
R_STD = r'_(?P<note>[A-G]#?\d)_v(?P<dyn>\d)(?:_rr(?P<rr>\d)|_RR(?P<rr2>\d)|_(?P<rr3>\d))?'
SPECS = {
    # ---- strings: VSCO sections (stereo, two dynamic layers crossfaded), solo contrabass thickened to a section by the engine
    'vln1Sus':  dict(src='Strings/Violin Section/susVib', re=r'VlnEns_susVib' + R_STD, dyn=[1, 2], rr=1, step=0, kind='sustain', attack=0.1, release=0.6, ls=1.0, lmin=1.8, lmax=3.6, stereo=True, xf=True, pan=-0.6, xf_sec=0.7),
    'vlaSus':   dict(src='Strings/Viola Section/susvib', re=r'ViolaEns_susvib' + R_STD, dyn=[1, 2], rr=1, step=0, kind='sustain', attack=0.1, release=0.6, ls=1.0, lmin=1.8, lmax=3.6, stereo=True, xf=True, pan=0.18, xf_sec=0.7),
    'vcSus':    dict(src='Strings/Cello Section/susvib', re=r'susvib' + R_STD, dyn=[1, 3], rr=1, step=0, kind='sustain', attack=0.1, release=0.6, ls=1.0, lmin=1.8, lmax=3.6, stereo=True, xf=True, pan=0.45, xf_sec=0.7),
    'cbSus':    dict(src='Strings/Solo Contrabass/SusVib', re=r'BKCtbss_SusVib' + R_STD, dyn=[1, 3], rr=1, step=0, kind='sustain', attack=0.1, release=0.7, ls=1.0, lmin=1.8, lmax=3.6, stereo=True, xf=True, pan=0.6, xf_sec=0.7),
    'vln1Trem': dict(src='Strings/Violin Section/Trem', re=R_STD, dyn=[-1], rr=1, step=0, kind='sustain', attack=0.08, release=0.4, ls=0.8, lmin=1.5, lmax=3.0, stereo=True, pan=-0.6, xf_sec=0.5),
    'vlaTrem':  dict(src='Strings/Viola Section/trem', re=R_STD, dyn=[-1], rr=1, step=0, kind='sustain', attack=0.08, release=0.4, ls=0.8, lmin=1.5, lmax=3.0, stereo=True, pan=0.18, xf_sec=0.5),
    'vcTrem':   dict(src='Strings/Cello Section/trem', re=R_STD, dyn=[-1], rr=1, step=0, kind='sustain', attack=0.08, release=0.4, ls=0.8, lmin=1.5, lmax=3.0, stereo=True, pan=0.45, xf_sec=0.5),
    'cbTrem':   dict(src='Strings/Solo Contrabass/Trem', re=R_STD, dyn=[-1], rr=1, step=0, kind='sustain', attack=0.08, release=0.45, ls=0.8, lmin=1.5, lmax=3.0, stereo=True, pan=0.6, xf_sec=0.5),
    'vln1Stac': dict(src='Strings/Violin Section/Spic', re=r'VlnEns_Spic' + R_STD, dyn=[1, 2], rr=1, step=0, kind='short', attack=0.002, release=0.12, stereo=False, keep=1.2, pan=-0.6),
    'vlaStac':  dict(src='Strings/Viola Section/spic', re=r'Violas_spic' + R_STD, dyn=[1, 2], rr=1, step=0, kind='short', attack=0.002, release=0.12, stereo=False, keep=1.2, pan=0.18),
    'vcStac':   dict(src='Strings/Cello Section/spic', re=r'spic' + R_STD, dyn=[1, 2], rr=1, step=0, kind='short', attack=0.002, release=0.12, stereo=False, keep=1.2, pan=0.45),
    'cbStac':   dict(src='Strings/Solo Contrabass/Spic', re=r'BKCtbss_Spic' + R_STD, dyn=[1, 3], rr=1, step=0, kind='short', attack=0.002, release=0.14, stereo=False, keep=1.2, pan=0.6),
    'vln1Pizz': dict(src='Strings/Violin Section/Pizz', re=r'VlnEns_Pizz' + R_STD, dyn=[1, 2], rr=1, step=0, kind='short', attack=0.001, release=0.3, stereo=False, keep=2.0, pan=-0.6),
    'vlaPizz':  dict(src='Strings/Viola Section/pizz', re=r'ViolaEns_pizz' + R_STD, dyn=[1, 2], rr=1, step=0, kind='short', attack=0.001, release=0.3, stereo=False, keep=2.0, pan=0.18),
    'vcPizz':   dict(src='Strings/Cello Section/pizzT', re=r'pizzT' + R_STD, dyn=[1, 2], rr=1, step=0, kind='short', attack=0.001, release=0.35, stereo=False, keep=2.2, pan=0.45),
    'cbPizz':   dict(src='Strings/Solo Contrabass/Pizz', re=r'BKCtbss_Pizz' + R_STD, dyn=[1, 3], rr=1, step=0, kind='short', attack=0.001, release=0.4, stereo=False, keep=2.6, pan=0.6),
    # ---- brass: horn in two layers (mp / f), solo horn and trumpet for lines, trombone and tuba
    'tptSus':   dict(src='Brass/Trumpet/susvib', re=r'Sum_SHTrumpet_susvib' + R_STD, dyn=[1, 2], rr=1, step=0, kind='sustain', attack=0.05, release=0.35, ls=1.2, lmin=1.4, lmax=2.6, stereo=False, xf=True, pan=0.4, xf_sec=0.4),
    'tptSolo':  dict(src='Brass/Trumpet/susvib', re=r'Sum_SHTrumpet_susvib' + R_STD, dyn=[2], rr=1, step=0, kind='sustain', attack=0.05, release=0.35, ls=1.2, lmin=1.4, lmax=2.6, stereo=False, pan=0.35, xf_sec=0.4),
    'tptStac':  dict(src='Brass/Trumpet/stac', re=r'stac' + R_STD, dyn=[2, 3], rr=1, step=0, kind='short', attack=0.002, release=0.16, stereo=False, keep=1.4, pan=0.4),
    'tbnSus':   dict(src='Brass/Tenor Trombone/sus', re=r'tenortbn_sus' + R_STD, dyn=[1, 3], rr=1, step=0, kind='sustain', attack=0.06, release=0.4, ls=1.2, lmin=1.1, lmax=1.6, stereo=False, xf=True, pan=0.52),
    'tbnStac':  dict(src='Brass/Tenor Trombone/stac', re=r'stac' + R_STD, dyn=[2, 3], rr=1, step=0, kind='short', attack=0.002, release=0.18, stereo=False, keep=1.5, pan=0.52),
    'fluteSus': dict(src='Woodwinds/Flute/susNV', re=r'susNV' + R_STD, dyn=[1, 3], rr=1, step=0, kind='sustain', attack=0.06, release=0.3, ls=1.0, lmin=1.1, lmax=1.6, stereo=False, xf=True, pan=-0.15),
    'flute':    dict(src='Woodwinds/Flute/susvib', re=r'LDFlute_susvib' + R_STD, dyn=[-1], rr=1, step=0, kind='sustain', attack=0.05, release=0.3, ls=1.0, lmin=1.1, lmax=1.6, stereo=False, pan=-0.15),
    'altoFlute': dict(src='Woodwinds/Flute/susNV', re=r'susNV' + R_STD, dyn=[1], rr=1, step=0, kind='sustain', attack=0.06, release=0.3, ls=1.0, lmin=1.1, lmax=1.6, stereo=False, pan=-0.12),
    'bassoon':  dict(src='Woodwinds/Bassoon/vib', re=r'(?P<note>[A-G]#?\d)_v(?P<dyn>\d)', dyn=[1, 2], rr=1, step=0, kind='sustain', attack=0.05, release=0.3, ls=1.0, lmin=1.1, lmax=1.6, stereo=False, xf=True, pan=0.3),
    # ---- harp, keyboard percussion, drums, metals (VSCO percussion files are summed mono recordings)
    'marimba':  dict(src='Percussion/Marimba', re=r'Marimba_hit_Outrigger_(?P<note>[A-G]#?\d)_loud', dyn=['*'], rr=1, step=0, kind='short', attack=0.001, release=0.3, pitch='detect', range=(60.0, 2500.0), keep=2.0, stereo=False, pan=-0.3),
    'bassDrum': dict(src='Percussion', re=r'BDrumNewhit_v(?P<dyn>\d)_rr(?P<rr>\d)', dyn=[3, 5, 7], rr=2, step=0, kind='short', attack=0.001, release=0.3, pitched=False, top=True, keep=2.5, stereo=False, pan=0.25),
    'snare':    dict(src='Percussion', re=r'Snare2-HitSN_v(?P<dyn>\d)_rr(?P<rr>\d)', dyn=[3, 7], rr=2, step=0, kind='short', attack=0.001, release=0.2, pitched=False, top=True, keep=1.6, stereo=False, pan=-0.28),
    'snareRoll': dict(src='Percussion', re=r'Snare2-rollSN_v(?P<dyn>\d)_rr(?P<rr>\d)', dyn=[3, 5], rr=1, step=0, kind='short', attack=0.01, release=0.3, pitched=False, top=True, keep=3.5, stereo=False, pan=-0.28),
    'crash':    dict(src='Percussion', re=r'cymbal-crash1_(?P<dyn>pp|mp|mf|ff)_rr(?P<rr>\d)', dyn=['mf', 'ff'], rr=1, step=0, kind='short', attack=0.001, release=0.6, pitched=False, top=True, keep=4.0, stereo=False, pan=0.38),
    'cymSwell': dict(src='Percussion', re=r'susCymb1-cresc-(?P<dyn>Short|Median|Long)_v1', dyn=['Short', 'Median', 'Long'], rr=1, step=0, kind='short', attack=0.01, release=0.6, pitched=False, top=True, keep=5.5, stereo=False, pan=0.38),
    'gong':     dict(src='Percussion', re=r'gongHit_(?P<dyn>p|mf|f|fff)', dyn=['mf', 'fff'], rr=1, step=0, kind='short', attack=0.001, release=0.8, pitched=False, top=True, keep=5.0, stereo=False, pan=0.48),
    'tamb':     dict(src='Percussion', re=r'Tamb1-Hit_v(?P<dyn>\d)_rr(?P<rr>\d)', dyn=[1, 2], rr=2, step=0, kind='short', attack=0.001, release=0.2, pitched=False, top=True, keep=1.2, stereo=False, pan=0.45),
    'tambShake': dict(src='Percussion', re=r'Tamb1-Shake_v(?P<dyn>\d)_rr(?P<rr>\d)', dyn=[1], rr=2, step=0, kind='short', attack=0.005, release=0.2, pitched=False, top=True, keep=1.0, stereo=False, pan=0.45),
    'claves':   dict(src='Percussion', re=r'Claves1_Hit_v(?P<dyn>\d)_rr(?P<rr>\d)', dyn=[2, 3], rr=2, step=0, kind='short', attack=0.001, release=0.15, pitched=False, top=True, keep=0.8, stereo=False, pan=-0.3),
    'anvil':    dict(src='Percussion', re=r'Anvil_Hit1_v(?P<dyn>\d)_Sum', dyn=[2, 3], rr=1, step=0, kind='short', attack=0.001, release=0.5, pitched=False, top=True, keep=2.5, stereo=False, pan=0.3),
    'taps':     dict(src='Percussion', re=r'Snare2-taps_v(?P<dyn>\d)_rr(?P<rr>\d)', dyn=[1, 3], rr=2, step=0, kind='short', attack=0.001, release=0.15, pitched=False, top=True, keep=0.8, stereo=False, pan=-0.28),
    'tenorHi':  dict(src='VSCO 1 Percussion/drums/tenor/tenor_higher', re=r'tenorH_(?P<dyn>p{1,3}|mp|mf|f{1,3})_(?P<rr>\d)', dyn=['f', 'fff'], rr=2, step=0, kind='short', attack=0.001, release=0.3, pitched=False, keep=1.5, stereo=False, pan=0.2),
    'tenorLo':  dict(src='VSCO 1 Percussion/drums/tenor/tenor_lower', re=r'tenor_(?P<dyn>p{1,3}|mp|mf|f{1,3})_(?P<rr>\d)', dyn=['f', 'fff'], rr=2, step=0, kind='short', attack=0.001, release=0.3, pitched=False, keep=1.5, stereo=False, pan=0.2),
    'organ':    dict(src='Keys/Organ/Loud', re=r'Rode_Man3Open_(?P<key>\d\d)', dyn=['*'], rr=1, step=6, kind='sustain', attack=0.03, release=0.25, ls=1.0, lmin=1.4, lmax=2.6, pitch='detect', range=(30.0, 2500.0), stereo=False, pan=0, xf_sec=0.4),
}
SYNTH = {   # name -> (kind, attack, release); zones come from synth.py (stereo)
    'padSerrie': dict(kind='sustain', attack=0.3, release=0.9, cutK=0, ls=0.9, lmin=1.2, lmax=1.8, stereo=True),
    'padGlass': dict(kind='sustain', attack=0.3, release=0.9, cutK=0, ls=0.9, lmin=1.2, lmax=1.8, stereo=True),
    'padAir': dict(kind='sustain', attack=0.8, release=1.6, cutK=0, ls=1.4, lmin=1.4, lmax=2.2, stereo=True),
    'padDark': dict(kind='sustain', attack=0.3, release=0.9, cutK=0, ls=0.9, lmin=1.2, lmax=1.8, stereo=True),
    'subBass': dict(kind='sustain', attack=0.02, release=0.25, cutK=0, ls=0.5, lmin=0.8, lmax=1.4, stereo=False),
}
# composites: one playable instrument built from several recorded ones, each covering its natural range (midi, scientific)
COMPOSITES = {
    'strEns':     dict(kind='sustain', attack=0.12, release=0.7, members=[('cbSus', 0, 43), ('vcSus', 44, 59), ('vlaSus', 60, 66), ('vln1Sus', 67, 127)]),
    'strEnsSpic': dict(kind='short', attack=0.002, release=0.12, members=[('cbStac', 0, 43), ('vcStac', 44, 59), ('vlaStac', 60, 66), ('vln1Stac', 67, 127)]),
    'strEnsTrem': dict(kind='sustain', attack=0.08, release=0.45, members=[('cbTrem', 0, 43), ('vcTrem', 44, 59), ('vlaTrem', 60, 66), ('vln1Trem', 67, 127)]),
    'strEnsPizz': dict(kind='short', attack=0.001, release=0.3, members=[('cbPizz', 0, 43), ('vcPizz', 44, 59), ('vlaPizz', 60, 66), ('vln1Pizz', 67, 127)]),
    'brassEns':   dict(kind='sustain', attack=0.06, release=0.4, xf=True, members=[('tubaSus', 0, 46), ('tbnSus', 47, 58), ('hornSus', 59, 74), ('tptSus', 75, 127)]),
    'brassStac':  dict(kind='short', attack=0.002, release=0.2, members=[('tbnStac', 0, 56), ('hornStac', 57, 72), ('tptStac', 73, 127)]),
    'lowBrass':   dict(kind='sustain', attack=0.07, release=0.45, xf=True, members=[('tubaSus', 0, 48), ('tbnSus', 49, 127)]),
    'chorus':     dict(kind='sustain', attack=0.35, release=1.1, members=[('chorusMen', 0, 63), ('chorusWomen', 64, 127)]),
}
def composites(manifest, log):
    for name, c in COMPOSITES.items():
        zones = []
        for mem, lo, hi in c['members']:
            src = manifest['instruments'].get(mem)
            if not src: continue
            for z in src['zones']:
                zz = dict(z); zz['lo'] = max(z['lo'], lo); zz['hi'] = min(z['hi'], hi)
                if src.get('pan') and 'pan' not in zz: zz['pan'] = src['pan']
                if zz['lo'] <= zz['hi']: zones.append(zz)
        if zones:
            manifest['instruments'][name] = dict(kind=c['kind'], pitched=True, attack=c['attack'], release=c['release'], gain=0, cutK=c.get('cutK', 0), zones=sorted(zones, key=lambda z: (z['root'], z['vel'][0], z['rr'])))
            if c.get('xf'): manifest['instruments'][name]['xf'] = True
            log(f"  {name:10} {len(zones):3} zones (composite)")


# ---------------------------------------------------------------------------------------------------- Sonatina (SFZ-driven) specs
# sfz: instrument definition under the SSO root; kind: sustain | short; stereo: keep the recorded stereo image (sections, chorus,
# cymbals) or fold to mono (solo lines, plucks, drums); keep: max seconds; step: thin the zones to every N semitones (0 = all the
# library's zones); layers: 'cc1' (mod-wheel crossfade groups -> dynamic layers, soft..loud), 'vel' (lovel/hivel splits), a regex on
# the file name with the dynamic token in group 1 + 'order' soft..loud, or None (one layer); only: regex the file name must match;
# skip: regex it must not; xf: the engine crossfades adjacent layers (true for every multi-layer sustain); bright: presence shelf dB.
def _rx(s): return re.compile(s, re.IGNORECASE)
SSO_STR = dict(kind='sustain', attack=0.12, release=0.7, stereo=False, keep=3.5, bright=5.0, pan=0)
SSO_SHORT = dict(kind='short', attack=0.002, release=0.15, stereo=False, keep=1.6, bright=3.0)
SSO = {
    # ---- string sections (the heart of the score): sustain, tremolo, staccato, pizzicato per section
    'vln1Sus':  dict(SSO_STR, pan=-0.62, sfz='Strings - Performance/1st Violins Sustain.sfz', keep=6.0, loopq=0.9, stereo=True),
    'vlaSus':   dict(SSO_STR, pan=0.18, sfz='Strings - Performance/Violas Sustain.sfz'),
    'vcSus':    dict(SSO_STR, pan=0.45, sfz='Strings - Performance/Celli Sustain.sfz'),
    'cbSus':    dict(SSO_STR, pan=0.6, sfz='Strings - Performance/Basses Sustain.sfz', release=0.8),
    'vln1Trem': dict(SSO_STR, pan=-0.62, sfz='Strings - Performance/1st Violins Tremolo.sfz', attack=0.08, release=0.45, keep=3.0, loopq=0.7),
    'vlaTrem':  dict(SSO_STR, pan=0.18, sfz='Strings - Performance/Violas Tremolo.sfz', attack=0.08, release=0.45, keep=3.0, loopq=0.7),
    'vcTrem':   dict(SSO_STR, pan=0.45, sfz='Strings - Performance/Celli Tremolo.sfz', attack=0.08, release=0.45),
    'cbTrem':   dict(SSO_STR, pan=0.6, sfz='Strings - Performance/Basses Tremolo.sfz', attack=0.08, release=0.5, keep=3.0, loopq=0.7),
    'vln1Stac': dict(SSO_SHORT, pan=-0.62, sfz='Strings - Performance/1st Violins Staccato.sfz', release=0.12),
    'vlaStac':  dict(SSO_SHORT, pan=0.18, sfz='Strings - Performance/Violas Staccato.sfz', release=0.12),
    'vcStac':   dict(SSO_SHORT, pan=0.45, sfz='Strings - Performance/Celli Staccato.sfz', release=0.12),
    'cbStac':   dict(SSO_SHORT, pan=0.6, sfz='Strings - Performance/Basses Staccato.sfz', release=0.14),
    'vln1Pizz': dict(SSO_SHORT, pan=-0.62, sfz='Strings - Performance/1st Violins Pizzicato.sfz', release=0.3, keep=2.0),
    'vlaPizz':  dict(SSO_SHORT, pan=0.18, sfz='Strings - Performance/Violas Pizzicato.sfz', release=0.3, keep=2.0),
    'vcPizz':   dict(SSO_SHORT, pan=0.45, sfz='Strings - Performance/Celli Pizzicato.sfz', release=0.35, keep=2.2),
    'cbPizz':   dict(SSO_SHORT, pan=0.6, sfz='Strings - Performance/Basses Pizzicato.sfz', release=0.4, keep=2.6),
    # ---- brass: section horns in two real dynamic layers, section trumpets / trombones / tuba, solo horn and trumpet for lines
    'hornSus':  dict(SSO_STR, pan=-0.42, sfz='Brass - Performance/Horns Sustain.sfz', layers='cc1', xf=True, attack=0.06, release=0.45, keep=4.2),
    'hornStac': dict(SSO_SHORT, pan=-0.42, sfz='Brass - Performance/Horns Staccato.sfz', release=0.2, keep=1.8, stereo=True),
    'tptSus':   dict(SSO_STR, pan=0.4, sfz='Brass - Performance/Trumpets Sustain (looped).sfz', layers='cc1', xf=True, attack=0.05, release=0.35, keep=4.0),
    'tptStac':  dict(SSO_SHORT, pan=0.4, sfz='Brass - Performance/Trumpets Staccato.sfz', release=0.18),
    'tbnSus':   dict(SSO_STR, pan=0.52, sfz='Brass - Performance/Trombones Sustain (looped).sfz', layers='cc1', xf=True, attack=0.06, release=0.4, keep=4.0),
    'tbnStac':  dict(SSO_SHORT, pan=0.52, sfz='Brass - Performance/Trombones Staccato.sfz', release=0.2),
    'tubaSus':  dict(SSO_STR, pan=0.55, sfz='Brass - Performance/Tuba Sustain (looped).sfz', layers='cc1', xf=True, attack=0.07, release=0.45, keep=4.0),
    'hornSolo': dict(SSO_STR, pan=-0.35, sfz='Brass - Performance/Horn Solo Sustain (looped).sfz', stereo=False, attack=0.06, release=0.4, keep=3.2, loopq=0.85),
    'tptSolo':  dict(SSO_STR, pan=0.35, sfz='Brass - Performance/Trumpet Solo Sustain (looped).sfz', stereo=False, attack=0.05, release=0.35, keep=3.2, loopq=0.85), # ---- woodwinds: sections for colour, solos for lines
    'fluteSus': dict(SSO_STR, pan=-0.15, sfz='Woodwinds - Performance/Flutes Sustain (looped).sfz', attack=0.06, release=0.3, keep=4.0),
    'flute':    dict(SSO_STR, pan=-0.15, sfz='Woodwinds - Performance/Flute Solo 1 Sustain (looped).sfz', stereo=False, attack=0.05, release=0.3, keep=3.2, loopq=0.85),
    'altoFlute': dict(SSO_STR, pan=-0.12, sfz='Woodwinds - Performance/Alto Flute Solo Sustain (looped).sfz', stereo=False, attack=0.06, release=0.3, keep=3.2, loopq=0.85),
    'oboe':     dict(SSO_STR, pan=0.16, sfz='Woodwinds - Performance/Oboe Solo Sustain (looped).sfz', stereo=False, attack=0.05, release=0.3, keep=4.0),
    'corAnglais': dict(SSO_STR, pan=0.18, sfz='Woodwinds - Performance/Cor Anglais Solo Sustain (looped).sfz', stereo=False, attack=0.05, release=0.3, keep=3.2, loopq=0.85),
    'clarinet': dict(SSO_STR, pan=-0.24, sfz='Woodwinds - Performance/Clarinet Solo Sustain (looped).sfz', stereo=False, attack=0.05, release=0.3, keep=4.0),
    'bassoon':  dict(SSO_STR, pan=0.3, sfz='Woodwinds - Performance/Bassoon Solo Sustain (looped).sfz', stereo=False, attack=0.05, release=0.3, keep=4.0),
    # ---- the recorded chorus (men + women, every semitone; thinned to minor thirds)
    'chorusMen':   dict(SSO_STR, sfz='Chorus - Performance/Mixed Chorus.sfz', only=r'chorus-male', step=1, attack=0.35, release=1.1, keep=5.5, bright=6.0, stereo=True),
    'chorusWomen': dict(SSO_STR, sfz='Chorus - Performance/Mixed Chorus.sfz', only=r'chorus-female', step=1, attack=0.35, release=1.1, keep=5.5, bright=6.0, stereo=True), # ---- harp, keyboard percussion, bells
    'harp':     dict(SSO_SHORT, pan=-0.62, sfz='Concert Harp.sfz', release=0.6, keep=3.5, stereo=True),
    'glock':    dict(SSO_SHORT, pan=-0.45, sfz='Percussion/Glockenspiel.sfz', release=0.6, keep=3.0, stereo=True),
    'celeste':  dict(SSO_SHORT, pan=-0.4, sfz='Percussion/Celeste.sfz', only=r'celeste-.*-hard', step=3, release=0.6, keep=2.6),
    'crotales': dict(SSO_SHORT, pan=-0.4, sfz='Percussion/Crotales.sfz', only=r'crotale-.*-ff', step=3, release=0.8, keep=3.0, bright=1.0),
    'chimes':   dict(SSO_SHORT, pan=0.5, sfz='Percussion/Chimes.sfz', release=1.0, keep=4.0, stereo=False, step=4),
    # ---- timpani (hits in two layers with left/right-hand round robins; rolls and crescendo rolls), drums, metals
    'timpani':  dict(SSO_SHORT, pan=0.55, sfz='Percussion/Timpani.sfz', only=r'timpani-[fp]-', layers=(r'timpani-(f|p)-', ['p', 'f']), release=0.5, keep=2.4, stereo=False),
    'timpRoll': dict(SSO_STR, pan=0.55, sfz='Percussion/Timpani.sfz', only=r'timpani-roll-(?!crsc)', root_from_name=12, attack=0.05, release=0.6, keep=2.6, bright=0), # looped: a roll of any length
    'bassDrum': dict(SSO_SHORT, pan=0.25, sfz='Percussion/Bass Drum & Snare.sfz', only=r'bass_drum', layers=(r'bass_drum-(p|f)\.', ['p', 'f']), release=0.4, keep=2.2, pitched=False, stereo=True),
    'snare':    dict(SSO_SHORT, pan=-0.28, sfz='Percussion/Bass Drum & Snare.sfz', only=r'snare-[lr]h', layers=(r'snare-[lr]h-(p|mf|ff)\.', ['p', 'mf', 'ff']), release=0.25, keep=1.5, pitched=False),
    'snareRoll': dict(SSO_SHORT, pan=-0.28, sfz='Percussion/Bass Drum & Snare.sfz', only=r'snare-roll', release=0.3, keep=3.5, pitched=False),
    'crash':    dict(SSO_SHORT, pan=0.38, sfz='Percussion/Cymbals & Tamtam.sfz', only=r'piatti', release=0.8, keep=5.0, pitched=False, stereo=True),
    'cymSwell': dict(SSO_SHORT, pan=0.38, sfz='Percussion/Cymbals & Tamtam.sfz', only=r'cymbal_roll-a-(p|mf|f)\.', layers=(r'cymbal_roll-a-(p|mf|f)\.', ['p', 'mf', 'f']), release=0.8, keep=5.5, pitched=False, stereo=True),
    'gong':     dict(SSO_SHORT, pan=0.48, sfz='Percussion/Cymbals & Tamtam.sfz', only=r'tamtam', release=1.0, keep=6.0, pitched=False, stereo=True),
    'triangle': dict(SSO_SHORT, pan=-0.5, sfz='Percussion/Triangle.sfz', only=r'triangle-(opn|hlf)', release=0.6, keep=2.5, pitched=False, bright=1.0),
    'tamb':     dict(SSO_SHORT, pan=0.45, sfz='Percussion/All Unpitched Percussion.sfz', only=r'tambourine-hit', layers=(r'tambourine-hit-(mf|f)\.', ['mf', 'f']), release=0.25, keep=1.2, pitched=False),
    'tambShake': dict(SSO_SHORT, pan=0.45, sfz='Percussion/All Unpitched Percussion.sfz', only=r'tambourine-shake', release=0.25, keep=1.2, pitched=False),
    'bellTree': dict(SSO_SHORT, pan=-0.52, sfz='Percussion/All Unpitched Percussion.sfz', only=r'bell_tree|bar_chimes', release=1.0, keep=4.5, pitched=False, stereo=True, bright=1.0),
    'sleigh':   dict(SSO_SHORT, pan=0.4, sfz='Percussion/All Unpitched Percussion.sfz', only=r'sleigh_bells', release=0.4, keep=1.5, pitched=False),
    'woodBlock': dict(SSO_SHORT, pan=-0.38, sfz='Percussion/All Unpitched Percussion.sfz', only=r'wood_block', release=0.15, keep=0.8, pitched=False),
    'shaker':   dict(SSO_SHORT, pan=0.32, sfz='Percussion/All Unpitched Percussion.sfz', only=r'shaker-[abc]\.', release=0.15, keep=0.8, pitched=False),
    # ---- pipe organ: a soft string stop for planetarium beds, the full combination for the council hymn
    'organSoft': dict(SSO_STR, sfz='Organ/Swell - Gamba 8ft.sfz', step=6, attack=0.08, release=0.4, keep=3.0, loopq=0.75),
    'organ':    dict(SSO_STR, sfz='Organ/Great - Open Diapason 8ft.sfz', step=4, attack=0.05, release=0.35, keep=4.0),
}

# chosen per family by measuring the raw recordings' top end: VSCO is the closer, brighter take for strings, trumpet, trombone, flute,
# bassoon, drums and cymbals; Sonatina is the more natural one for horns, tuba, oboe, cor anglais, clarinet and harp, and the only
# recorded chorus, celeste, crotales, chimes, glockenspiel, bell tree and small percussion
SSO_KEEP = ['chorusMen', 'chorusWomen', 'celeste', 'crotales', 'chimes', 'glock', 'bellTree', 'sleigh', 'woodBlock', 'shaker', 'triangle', 'organSoft', 'timpRoll', 'timpani',
            'hornSus', 'hornStac', 'hornSolo', 'tubaSus', 'oboe', 'corAnglais', 'clarinet', 'harp']   # Sonatina covers only what VSCO has not recorded
SSO = {k: v for k, v in SSO.items() if k in SSO_KEEP}
SSO_REPLACES = set()

_RATES = {}
STATS = {}
def native_rate(path):
    if path not in _RATES:
        out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=sample_rate', '-of', 'csv=p=0', path], capture_output=True, text=True).stdout.strip()
        _RATES[path] = float(out.split(',')[0]) if out else float(SR)
    return _RATES[path]

def _layer_of(s, spec):
    """-> (layer key, sort position) for one region; None = region does not belong (release triggers etc.)."""
    lay = spec.get('layers')
    if lay == 'cc1':
        xi, xo = s['xfin'], s['xfout']
        if xi is None and xo is None: pos = 0.5
        else: pos = ((xi[1] if xi else 0) + (xo[0] if xo else 127)) / 254.0     # fades in at xi, out at xo: centre of its window
        return (round(pos, 3), pos)
    if lay == 'vel': return ((s['lovel'], s['hivel']), (s['lovel'] + s['hivel']) / 254.0)
    if isinstance(lay, tuple):
        m = re.search(lay[0], os.path.basename(s['path']), re.IGNORECASE)
        if not m: return None
        tok = m.group(1).lower(); return (tok, lay[1].index(tok) if tok in lay[1] else 99)
    return ('x', 0)

def build_sso(root, name, spec, out, log):
    path = os.path.join(root, spec['sfz'])
    if not os.path.exists(path): log(f'  !! {name}: missing {spec["sfz"]}'); return None
    regs = [sfz.region_summary(r) for r in sfz.load(path)]
    regs = [s for s in regs if s['trigger'] in ('attack', 'first') and os.path.exists(s['path'])]
    if spec.get('only'): regs = [s for s in regs if re.search(spec['only'], os.path.basename(s['path']), re.IGNORECASE)]
    if spec.get('skip'): regs = [s for s in regs if not re.search(spec['skip'], os.path.basename(s['path']), re.IGNORECASE)]
    # one region per (sample file, layer): the SFZ may list a sample twice (a filtered copy for the mod-wheel crossfade)
    seen = {}; items = []
    for s in regs:
        L = _layer_of(s, spec)
        if L is None: continue
        k = (s['path'], s['seq'])
        if k in seen: continue
        seen[k] = 1; items.append((s, L))
    if not items: log(f'  !! {name}: no regions'); return None
    pitched = spec.get('pitched', True)
    layer_keys = sorted({L[0] for _, L in items}, key=lambda k: [L[1] for _, L in items if L[0] == k][0])
    nL = len(layer_keys)
    # zone thinning: keep the library's zones, or every `step` semitones
    roots_all = sorted({round(s['root']) for s, _ in items})
    if pitched and spec.get('step', 0) > 0 and len(roots_all) > 1:
        chosen, target = [], roots_all[0]
        while target <= roots_all[-1] + spec['step'] / 2:
            near = min(roots_all, key=lambda r: abs(r - target))
            if near not in chosen: chosen.append(near)
            target += spec['step']
        items = [(s, L) for s, L in items if round(s['root']) in chosen]
    stereo = spec.get('stereo', False)
    zones, buffers = [], []
    rr_seen = {}
    for s, L in items:
        li = layer_keys.index(L[0])
        rk = (round(s['root']), li); ri = rr_seen.get(rk, 0); rr_seen[rk] = ri + 1
        x = decode(s['path'], stereo, 'R' if spec.get('pan', 0) > 0 else 'L')   # the microphone on the section's side of the stage
        k = SR / native_rate(s['path'])            # SFZ offsets / loop points are frames at the file's own rate
        off = int(s['offset'] * k)
        if off > 0: x = x[off:]
        loop = s['loop']
        if loop is None and spec['kind'] == 'sustain':
            wl = sfz.wav_loops(s['path'])
            if wl: loop = wl[0]
        if loop is not None: loop = (int(loop[0] * k) - off, int(loop[1] * k) - off)
        # trim leading silence (keeping loop points aligned)
        a = np.abs(x if x.ndim == 1 else x.mean(axis=1)); th = 10 ** (-50 / 20) * max(a.max(), 1e-9)
        cut = max(0, int(np.argmax(a > th)) - int(0.004 * SR))
        if cut > 0:
            x = x[cut:]
            if loop is not None: loop = (loop[0] - cut, loop[1] - cut)
        fade = np.minimum(1, np.arange(len(x)) / (0.003 * SR)); x = x * (fade if x.ndim == 1 else fade[:, None])
        x = x * 10 ** (s['volume'] / 20)
        if spec.get('bright', 0) > 0 and pitched: x = brighten(x, 2500.0, spec['bright'], 7000.0, spec['bright'] * 1.4)
        keep = spec.get('keep')
        if spec['kind'] == 'sustain':
            if loop is None or loop[1] <= loop[0] + SR * 0.04 or loop[1] > len(x):
                lp = find_loop(x, 1.0, 1.0, 1.8)
                if not lp: log(f'  !! {name} {os.path.basename(s["path"])}: no loop'); continue
                loop = (lp[0], lp[1]); q = lp[2]
            else: q = None
            ls, le = loop
            if keep and le > keep * SR and (le - ls) > 1.3 * SR:      # memory budget: shorten long loops, keeping the library's loop end
                le2 = int(keep * SR); lo_len = int(1.0 * SR); hi_len = min(le - ls, le2 - int(0.6 * SR))
                if hi_len > lo_len:
                    r = find_start(x, le2, lo_len, hi_len)
                    if r and r[1] >= spec.get('loopq', 0.8): ls, le, q = r[0], le2, r[1]
                    else:                                        # no good seam against the library's end: search freely inside the budget
                        lp = find_loop(x, ls / SR, 1.0, max(1.05, (le2 - ls) / SR))
                        if lp and lp[1] <= le2 and lp[2] >= spec.get('loopq', 0.8) - 0.05: ls, le, q = lp
                    STATS['short' if le < loop[1] else 'kept'] = STATS.get('short' if le < loop[1] else 'kept', 0) + 1
            x = bake_loop(x, ls, le, xf_sec=0.08 if q is None else 0.25)
            loop_s = [ls / SR, le / SR]
        else:
            x = trim_tail(x); loop_s = None; q = None
            if keep and len(x) > keep * SR:
                x = x[:int(keep * SR)]; f = int(0.08 * SR)
                if x.ndim == 1: x[-f:] *= np.linspace(1, 0, f)
                else: x[-f:] *= np.linspace(1, 0, f)[:, None]
        vel = [li / nL, (li + 1) / nL] if nL > 1 else [0, 1]
        root_eff = s['root'] - s['tune'] / 100.0 if pitched else 60
        lo, hi = (s['lo'], s['hi']) if pitched else (0, 127)
        if spec.get('root_from_name') is not None and pitched:      # keyboard-mapped articulations (rolls on high keys): the real pitch is in the file name
            m = re.search(r'-([a-g]#?)(-?\d)\.', os.path.basename(s['path']), re.IGNORECASE)
            if m:
                root_eff = sfz.key_to_midi(m.group(1) + m.group(2)) + spec['root_from_name']; lo, hi = int(root_eff) - 2, int(root_eff) + 2
        zones.append(dict(root=root_eff, lo=lo, hi=hi, li=li, rr=ri, loop=loop_s, vel=vel, q=q, dyn=str(L[0])))
        buffers.append(x)
    if not zones: return None
    loud = [i for i, z in enumerate(zones) if z['li'] == nL - 1]
    if spec['kind'] == 'sustain':
        ref = np.mean([rms(buffers[i], int(zones[i]['loop'][0] * SR), int(zones[i]['loop'][1] * SR)) for i in loud])
        gain = 10 ** (TARGET_RMS_DB / 20) / max(ref, 1e-9)
    else:
        ref = np.mean([np.abs(buffers[i]).max() for i in loud]); gain = 10 ** (TARGET_PEAK_DB / 20) / max(ref, 1e-9)
    pk = max(np.abs(b).max() for b in buffers) * gain
    if pk > 0.98: gain *= 0.98 / pk
    return finish_sso(name, spec, zones, buffers, gain, out, log, stereo, nL)

def finish_sso(name, spec, zones, buffers, gain, out, log, stereo, nL):
    pitched = spec.get('pitched', True)
    inst = dict(kind=spec['kind'], pitched=pitched, attack=spec['attack'], release=spec['release'], gain=0, cutK=spec.get('cutK', 0), zones=[], src='sso')
    if spec.get('xf') and nL > 1: inst['xf'] = True
    if spec.get('pan'): inst['pan'] = spec['pan']
    total = 0
    if not pitched:                      # unpitched kits: lay the samples out by layer / round robin only
        for z in zones: z['lo'], z['hi'] = 0, 127
    for z, b in zip(zones, buffers):
        y = b * gain
        tag = (midi_name(int(round(z['root']))) if pitched else 'x') + ('' if pitched else '')
        f = f"{name}-{tag}-l{z['li']}-r{z['rr']}.mp3"
        encode_mp3(y, os.path.join(out, f), stereo)
        total += os.path.getsize(os.path.join(out, f))
        zz = dict(file=f, root=round(z['root'], 2), lo=z['lo'], hi=z['hi'], vel=[round(z['vel'][0], 3), round(z['vel'][1], 3)], rr=z['rr'])
        if z['loop']: zz['loop'] = [round(z['loop'][0], 4), round(z['loop'][1], 4)]
        inst['zones'].append(zz)
    inst['zones'].sort(key=lambda z: (z['root'], z['vel'][0], z['rr']))
    if pitched and spec.get('step', 0) > 0:          # thinned: the library's one-note ranges no longer tile the keyboard
        roots = sorted({int(round(z['root'])) for z in inst['zones']}); step = spec['step']
        for z in inst['zones']:
            r = int(round(z['root'])); i = roots.index(r)
            z['lo'] = (roots[i - 1] + r) // 2 + 1 if i else r - step
            z['hi'] = (r + roots[i + 1]) // 2 if i + 1 < len(roots) else r + step
    secs = sum(len(b) for b in buffers) / SR
    qs = sorted(z['q'] for z in zones if z.get('q') is not None)
    log(f"  {name:11} {len(zones):3} zones {nL}L  {total / 1024:6.0f} KB  {secs:5.1f} s {'st' if stereo else 'mo'}  roots {inst['zones'][0]['root']}..{inst['zones'][-1]['root']}" + (f"  found-loop ncc min {qs[0]:.2f}" if qs else '') + (f"  loops shortened {STATS.get('short', 0)}/{STATS.get('short', 0) + STATS.get('kept', 0)}" if STATS else ''))
    STATS.clear()
    return inst

TARGET_RMS_DB = -16.0      # sustains: RMS of the loop region (loud layer)
TARGET_PEAK_DB = -2.0      # shorts / percussion: peak of the loudest layer

def collect(vsco, spec):
    folder = os.path.join(vsco, spec['src']); rx = re.compile(spec['re'], re.IGNORECASE)
    files = []
    for f in sorted(os.listdir(folder)):
        if not f.lower().endswith('.wav'): continue
        if spec.get('top') and spec['src'] == 'Percussion' and '/' in f: continue
        m = rx.search(f)
        if not m: continue
        g = m.groupdict(); rr = g.get('rr') or g.get('rr2') or g.get('rr3') or '1'
        files.append(dict(path=os.path.join(folder, f), note=g.get('note'), dyn=g.get('dyn') or '1', rr=int(rr), drum=g.get('drum'), key=g.get('key')))
    return files

def pick_dyn_layers(files, spec):
    """map the spec's dyn list to actual layer values present; -1 = the loudest present, '*' = all"""
    DYN_ORDER = ['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff']
    present = sorted({f['dyn'] for f in files}, key=lambda d: (0, int(d)) if d.isdigit() else (1, DYN_ORDER.index(d.lower()) if d.lower() in DYN_ORDER else 99))
    want = spec['dyn']
    if want == ['*']: return [present]
    out = []
    for d in want:
        if d == -1: out.append([present[-1]])
        elif str(d) in present: out.append([str(d)])
        else:   # nearest available numeric layer
            nums = [p for p in present if p.isdigit()]
            if nums: out.append([min(nums, key=lambda p: abs(int(p) - int(d)))])
    return out

def build_recorded(vsco, name, spec, out, log):
    files = collect(vsco, spec)
    if not files: log(f'  !! {name}: no files matched in {spec["src"]}'); return None
    layers = pick_dyn_layers(files, spec)
    # pitch per file: from the name, or detected from the audio (drums / organ keys): cache per source
    by_root = {}
    pitched = spec.get('pitched', True)
    for f in files:
        if not any(f['dyn'] in L for L in layers): continue
        if pitched and spec.get('pitch') == 'detect':
            key = f['drum'] or f['key']
            if key not in by_root:
                x = decode(f['path'], False, 'L'); x = trim_head(x)
                by_root[key] = detect_pitch(x[int(0.15 * SR):], *spec.get('range', (35.0, 1400.0)))
            f['midi'] = int(round(by_root[key]))
        elif pitched: f['midi'] = note_midi(*NOTE_RE.search(f['note']).groups()) + 12 * spec.get('octave', 1)
        else: f['midi'] = 60
    files = [f for f in files if 'midi' in f]
    roots = sorted({f['midi'] for f in files})
    if pitched and spec['step'] > 0 and len(roots) > 1:
        chosen, target = [], roots[0]
        while target <= roots[-1] + spec['step'] / 2:
            near = min(roots, key=lambda r: abs(r - target))
            if near not in chosen: chosen.append(near)
            target += spec['step']
        roots = chosen
    zones, buffers = [], []
    nL = len(layers)
    for root in roots:
        for li, L in enumerate(layers):
            cands = [f for f in files if f['midi'] == root and f['dyn'] in L]
            if not cands:                       # this note was not recorded at that layer: take the nearest recorded layer instead
                have = sorted({f['dyn'] for f in files if f['midi'] == root and f['dyn'].isdigit()}, key=int)
                if have and str(L[0]).isdigit(): near = min(have, key=lambda d: abs(int(d) - int(L[0]))); cands = [f for f in files if f['midi'] == root and f['dyn'] == near]
            cands.sort(key=lambda f: f['rr'])
            for ri, f in enumerate(cands[:spec['rr']]):
                x = decode(f['path'], spec.get('stereo', False), 'R' if spec.get('pan', 0) > 0 else 'L')
                x = trim_head(x)
                if spec.get('bright', 0) and pitched: x = brighten(x)
                keep = spec.get('keep')
                if spec['kind'] == 'sustain':
                    lp = find_loop(x, spec['ls'], spec['lmin'], spec['lmax'])
                    if not lp: log(f'  !! {name} {midi_name(root)}: no loop found'); continue
                    ls, le, q = lp; x = bake_loop(x, ls, le, xf_sec=spec.get('xf_sec', 0.25)); loop = [ls / SR, le / SR]
                else:
                    x = trim_tail(x); loop = None
                    if keep and len(x) > keep * SR: x = x[:int(keep * SR)]; x[-int(0.05 * SR):] *= np.linspace(1, 0, int(0.05 * SR))
                vel = [li / nL, (li + 1) / nL] if nL > 1 else [0, 1]
                zones.append(dict(root=root, dyn=f['dyn'], li=li, rr=ri, loop=loop, vel=vel, q=(lp[2] if spec['kind'] == 'sustain' else None)))
                buffers.append(x)
    if not zones: return None
    # level: one gain per instrument from the loudest layer (sustain: loop RMS; short: peak)
    loud = [i for i, z in enumerate(zones) if z['li'] == nL - 1]
    if spec['kind'] == 'sustain':
        ref = np.mean([rms(buffers[i], int(zones[i]['loop'][0] * SR), int(zones[i]['loop'][1] * SR)) for i in loud])
        gain = 10 ** (TARGET_RMS_DB / 20) / max(ref, 1e-9)
    else:
        ref = np.mean([np.abs(buffers[i]).max() for i in loud]); gain = 10 ** (TARGET_PEAK_DB / 20) / max(ref, 1e-9)
    pk = max(np.abs(b).max() for b in buffers) * gain
    if pk > 0.98: gain *= 0.98 / pk
    return finish(name, spec, zones, buffers, gain, out, log, stereo=spec.get('stereo', False))

def finish(name, spec, zones, buffers, gain, out, log, stereo):
    roots = sorted({z['root'] for z in zones}); step = spec.get('step', 5) or 4
    lohi = {}
    for i, r in enumerate(roots):
        lo = (roots[i - 1] + r) // 2 + 1 if i else r - step
        hi = (r + roots[i + 1]) // 2 if i + 1 < len(roots) else r + step
        lohi[r] = (lo, hi)
    inst = dict(kind=spec['kind'], pitched=spec.get('pitched', True), attack=spec['attack'], release=spec['release'], gain=0, cutK=spec.get('cutK', 0), zones=[])
    if spec.get('xf') and len({z['li'] for z in zones}) > 1: inst['xf'] = True
    if spec.get('pan'): inst['pan'] = spec['pan']
    total = 0
    for z, b in zip(zones, buffers):
        y = b * gain
        tag = midi_name(z['root']) if spec.get('pitched', True) else 'x'
        f = f"{name}-{tag}-l{z['li']}-r{z['rr']}.mp3"
        encode_mp3(y, os.path.join(out, f), stereo)
        total += os.path.getsize(os.path.join(out, f))
        zz = dict(file=f, root=z['root'], lo=lohi[z['root']][0], hi=lohi[z['root']][1], vel=[round(z['vel'][0], 3), round(z['vel'][1], 3)], rr=z['rr'])
        if z['loop']: zz['loop'] = [round(z['loop'][0], 4), round(z['loop'][1], 4)]
        inst['zones'].append(zz)
    qs = sorted(z['q'] for z in zones if z.get('q') is not None)
    log(f"  {name:10} {len(zones):3} zones  {total / 1024:6.0f} KB  roots {midi_name(roots[0])}..{midi_name(roots[-1])}" + (f"  loop ncc min {qs[0]:.2f} median {qs[len(qs) // 2]:.2f}" if qs else ''))
    return inst

def build_synth(name, spec, out, cache, log):
    import synth as S
    sdef = S.INSTRUMENTS[name]
    zones, buffers = [], []
    os.makedirs(cache, exist_ok=True)
    for m in sdef['notes']:
        wav = os.path.join(cache, f'{name}-{midi_name(m)}.wav')
        if not os.path.exists(wav):
            y = sdef['fn'](m); y = y / (np.abs(y).max() + 1e-9) / 1.05; S.write_wav(wav, y)
        x = read_wav_stereo(wav)
        if not spec.get('stereo'): x = x.mean(axis=1)
        x = trim_head(x)
        lp = find_loop(x, spec['ls'], spec['lmin'], spec['lmax'])
        if not lp: log(f'  !! {name} {midi_name(m)}: no loop'); continue
        ls, le, q = lp; x = bake_loop(x, ls, le, xf_sec=0.5)
        zones.append(dict(root=m, li=0, rr=0, loop=[ls / SR, le / SR], vel=[0, 1], q=q)); buffers.append(x)
    ref = np.mean([rms(buffers[i], int(z['loop'][0] * SR), int(z['loop'][1] * SR)) for i, z in enumerate(zones)])
    gain = 10 ** (TARGET_RMS_DB / 20) / max(ref, 1e-9)
    pk = max(np.abs(b).max() for b in buffers) * gain
    if pk > 0.98: gain *= 0.98 / pk
    return finish(name, dict(spec, step=sdef['notes'][1] - sdef['notes'][0] if len(sdef['notes']) > 1 else 6, pitched=True), zones, buffers, gain, out, log, stereo=spec.get('stereo', False))

def calibration(out):
    y = np.zeros(int(0.4 * SR)); y[int(0.1 * SR)] = 0.9
    y += np.random.default_rng(1).standard_normal(len(y)) * 1e-4
    encode_mp3(y, os.path.join(out, 'calib.mp3'), False)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sso', default=None); ap.add_argument('--vsco', default=None); ap.add_argument('--out', default='assets/audio'); ap.add_argument('--synth-cache', default=None)
    ap.add_argument('--only', default=None)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    only = set(a.only.split(',')) if a.only else None
    manifest = dict(version=3, license='Orchestra and percussion: VSCO 2 Community Edition (CC0 1.0). Chorus, celeste, crotales, chimes, bell tree, small percussion, timpani, soft organ: Sonatina Symphonic Orchestra 2.0 (CC Sampling Plus 1.0). Pads, sub: synthesized for this game (tools/samples/synth.py).',
                    calib=dict(file='calib.mp3', at=0.1), instruments={})
    mpath = os.path.join(a.out, 'instruments.json')
    if os.path.exists(mpath) and only:
        manifest = json.load(open(mpath))
    log = lambda s: print(s, flush=True)
    if a.sso:
        for name, spec in SSO.items():
            if only and name not in only: continue
            inst = build_sso(a.sso, name, spec, a.out, log)
            if inst: manifest['instruments'][name] = inst
    if a.vsco:
        for name, spec in SPECS.items():
            if only and name not in only: continue
            if name in SSO or name in SSO_REPLACES: continue        # Sonatina covers it
            inst = build_recorded(a.vsco, name, spec, a.out, log)
            if inst: manifest['instruments'][name] = inst
    cache = a.synth_cache or os.path.join(tempfile.gettempdir(), 'moo-synth-cache')
    for name, spec in SYNTH.items():
        if only and name not in only: continue
        inst = build_synth(name, spec, a.out, cache, log)
        if inst: manifest['instruments'][name] = inst
    composites(manifest, log)
    calibration(a.out)
    json.dump(manifest, open(mpath, 'w'), indent=1)
    total = sum(os.path.getsize(os.path.join(a.out, f)) for f in os.listdir(a.out))
    nz = sum(len(i['zones']) for i in manifest['instruments'].values())
    secs = 0.0
    for f in os.listdir(a.out):
        if not f.endswith('.mp3') or f == 'calib.mp3': continue
        pr = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=duration,channels', '-of', 'csv=p=0', os.path.join(a.out, f)], capture_output=True, text=True).stdout.strip().split(',')
        try: secs += float(pr[1]) * int(pr[0])
        except (ValueError, IndexError): pass
    log(f'wrote {mpath}: {len(manifest["instruments"])} instruments, {nz} zones, {total / 1048576:.1f} MB on disk, ~{secs * SR * 4 / 1048576:.0f} MB decoded (float32 at 44.1 kHz)')

if __name__ == '__main__':
    main()

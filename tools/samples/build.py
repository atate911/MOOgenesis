#!/usr/bin/env python3
"""Build assets/audio/ (the sampled instruments the music engine plays) from the VSCO 2 Community Edition recordings (CC0) plus the
synthesized choir / pads from synth.py.  Reproducible; the raw recordings are not committed.

    python3 tools/samples/build.py --vsco /path/to/VSCO-2-CE --out assets/audio [--synth-cache DIR] [--only strSus,hornSus]

Per instrument: pick zones every N semitones from the available notes (one or two dynamic layers, round robins where they matter),
decode with ffmpeg, trim leading silence, level-match the instrument (one gain for all its zones so the dynamic layers keep their
relationship), find a seamless loop in the sustain (normalized cross-correlation) and bake an equal-power crossfade into it, cut the
sample right after the loop, encode MP3 (libmp3lame, VBR q3; mono for recordings, stereo for the synthesized ensembles) and write
instruments.json (zones: file, root, lo, hi, loop seconds, velocity range, round-robin index).  A 0.4 s calibration file with one impulse
at 0.1 s lets the browser measure its MP3 decoder delay and shift the loop points (see js/audio/sampler.js).
"""
import argparse, json, math, os, re, subprocess, sys, tempfile
import numpy as np

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import synth  # noqa: E402

NOTE_RE = re.compile(r'(?<![A-Za-z])([A-G]#?)(-?\d)(?![0-9])')
NOTES = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
def note_midi(name, octv): return 12 * (int(octv) + 1) + NOTES[name]
def midi_name(m): return synth.note_name(m).replace('#', 's')
def db(x): return 20 * math.log10(max(x, 1e-9))

def decode(path):
    """ffmpeg -> float32 mono (or stereo for synth) at 44.1 kHz."""
    out = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(out, dtype='<f4').astype(np.float64)

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
    for ls_try in (ls_sec, ls_sec + 0.2, ls_sec + 0.45, ls_sec + 0.7, ls_sec - 0.2):
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
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', tmp, '-ac', '2' if stereo else '1', '-codec:a', 'libmp3lame', '-q:a', '3', path], check=True)
    os.unlink(tmp)

# ---------------------------------------------------------------------------------------------------- instrument specs
# src: folder under the VSCO root; re: regex with named groups note (e.g. A#3), dyn (v-number), rr (optional); dyn: list of layer
# numbers to keep in soft..loud order (velocity ranges are split evenly); rr: max round robins per layer; step: zone spacing in
# semitones; kind: sustain (looped) | short (one-shot, played whole); keep: seconds to keep for sustains
R_STD = r'_(?P<note>[A-G]#?\d)_v(?P<dyn>\d)(?:_rr(?P<rr>\d)|_RR(?P<rr2>\d)|_(?P<rr3>\d))?'
SPECS = {
    'strSus':   dict(src='Strings/Violin Section/susVib', re=r'VlnEns_susVib' + R_STD, dyn=[2], rr=1, step=5, kind='sustain', attack=0.09, release=0.55, cutK=9000, ls=1.1, lmin=1.1, lmax=1.6),
    'vlaSus':   dict(src='Strings/Viola Section/susvib', re=r'ViolaEns_susvib' + R_STD, dyn=[2], rr=1, step=5, kind='sustain', attack=0.09, release=0.55, cutK=8000, ls=1.1, lmin=1.1, lmax=1.6),
    'vcSus':    dict(src='Strings/Cello Section/susvib', re=r'susvib' + R_STD, dyn=[3], rr=1, step=5, kind='sustain', attack=0.1, release=0.6, cutK=7000, ls=1.1, lmin=1.1, lmax=1.6),
    'cbSus':    dict(src='Strings/Solo Contrabass/SusVib', re=r'BKCtbss_SusVib' + R_STD, dyn=[3], rr=1, step=5, kind='sustain', attack=0.1, release=0.6, cutK=4000, ls=1.0, lmin=1.0, lmax=1.5),
    'strSpic':  dict(src='Strings/Violin Section/Spic', re=r'VlnEns_Spic' + R_STD, dyn=[1, 2], rr=1, step=5, kind='short', attack=0.002, release=0.12),
    'vlaSpic':  dict(src='Strings/Viola Section/spic', re=r'Violas_spic' + R_STD, dyn=[2], rr=1, step=5, kind='short', attack=0.002, release=0.12),
    'vcSpic':   dict(src='Strings/Cello Section/spic', re=r'spic' + R_STD, dyn=[1, 2], rr=1, step=5, kind='short', attack=0.002, release=0.12),
    'cbSpic':   dict(src='Strings/Solo Contrabass/Spic', re=r'BKCtbss_Spic' + R_STD, dyn=[3], rr=1, step=5, kind='short', attack=0.002, release=0.12),
    'strTrem':  dict(src='Strings/Violin Section/Trem', re=R_STD, dyn=[-1], rr=1, step=5, kind='sustain', attack=0.08, release=0.4, cutK=9000, ls=0.9, lmin=1.0, lmax=1.5),
    'vcTrem':   dict(src='Strings/Cello Section/trem', re=R_STD, dyn=[-1], rr=1, step=5, kind='sustain', attack=0.08, release=0.4, cutK=7000, ls=0.9, lmin=1.0, lmax=1.5),
    'hornSus':  dict(src='Brass/F Horn/sus', re=r'MOHorn_sus' + R_STD, dyn=[1, 3], rr=1, step=5, kind='sustain', attack=0.07, release=0.35, cutK=0, ls=1.2, lmin=1.1, lmax=1.6),
    'hornStac': dict(src='Brass/F Horn/stac', re=r'MOHorn_stac' + R_STD, dyn=[2, 3], rr=1, step=5, kind='short', attack=0.002, release=0.15),
    'tptSus':   dict(src='Brass/Trumpet/susvib', re=r'Sum_SHTrumpet_susvib' + R_STD, dyn=[2], rr=1, step=5, kind='sustain', attack=0.06, release=0.3, cutK=0, ls=1.2, lmin=1.1, lmax=1.6),
    'tbnSus':   dict(src='Brass/Tenor Trombone/sus', re=r'tenortbn_sus' + R_STD, dyn=[1, 3], rr=1, step=5, kind='sustain', attack=0.07, release=0.35, cutK=0, ls=1.2, lmin=1.1, lmax=1.6),
    'tubaSus':  dict(src='Brass/Tuba/sus', re=r'Tuba3_sus' + R_STD, dyn=[1, 3], rr=1, step=5, kind='sustain', attack=0.08, release=0.4, cutK=0, ls=1.2, lmin=1.1, lmax=1.6),
    'fluteSus': dict(src='Woodwinds/Flute/susvib', re=r'LDFlute_susvib' + R_STD, dyn=[-1], rr=1, step=5, kind='sustain', attack=0.06, release=0.3, cutK=0, ls=1.0, lmin=1.0, lmax=1.5),
    'harp':     dict(src='Strings/Harp', re=r'KSHarp_(?P<note>[A-G]#?\d)_(?P<dyn>mf|f|mp)', dyn=['*'], rr=1, step=7, kind='short', attack=0.002, release=0.5, octave=0, keep=3.0),
    # (the recorded timpani were left out: their perceived pitch is ambiguous between the principal tone and its sub-octave, and a
    #  timpani a fifth off under a chord is worse than the in-tune synth timpani layered with the sampled bass drum)
    # 'timpani':  dict(src='Percussion/Timpani', re=r'Timpani(?P<drum>\d)_Hit_v(?P<dyn>\d)_rr(?P<rr>\d)', dyn=[1, 4], rr=2, step=0, kind='short', attack=0.002, release=0.3, pitch='detect', range=(55.0, 220.0), top=True),
    # 'timpRoll': dict(src='Percussion/Timpani/Rolls', re=r'Timpani(?P<drum>\d)_Roll_v(?P<dyn>\d)_rr(?P<rr>\d)', dyn=[5], rr=1, step=0, kind='short', attack=0.01, release=0.4, pitch='detect', range=(55.0, 220.0), top=True, keep=4.5),
    'bassDrum': dict(src='Percussion', re=r'BDrumNewhit_v(?P<dyn>\d)_rr(?P<rr>\d)', dyn=[3, 5, 7], rr=2, step=0, kind='short', attack=0.001, release=0.3, pitched=False, top=True, keep=2.5),
    'snare':    dict(src='Percussion', re=r'Snare2-HitSN_v(?P<dyn>\d)_rr(?P<rr>\d)', dyn=[3, 7], rr=2, step=0, kind='short', attack=0.001, release=0.2, pitched=False, top=True, keep=1.6),
    'snareRoll': dict(src='Percussion', re=r'Snare2-rollSN_v(?P<dyn>\d)_rr(?P<rr>\d)', dyn=[3, 5], rr=1, step=0, kind='short', attack=0.01, release=0.3, pitched=False, top=True, keep=3.5),
    'crash':    dict(src='Percussion', re=r'cymbal-crash1_(?P<dyn>pp|mp|mf|ff)_rr(?P<rr>\d)', dyn=['mf', 'ff'], rr=1, step=0, kind='short', attack=0.001, release=0.6, pitched=False, top=True, keep=4.0),
    'cymSwell': dict(src='Percussion', re=r'susCymb1-cresc-(?P<dyn>Short|Median|Long)_v1', dyn=['Short', 'Median', 'Long'], rr=1, step=0, kind='short', attack=0.01, release=0.6, pitched=False, top=True, keep=5.5),
    'gong':     dict(src='Percussion', re=r'gongHit_(?P<dyn>p|mf|f|fff)', dyn=['mf', 'fff'], rr=1, step=0, kind='short', attack=0.001, release=0.8, pitched=False, top=True, keep=5.0),
    'organ':    dict(src='Keys/Organ/Loud', re=r'Rode_Man3Open_(?P<key>\d\d)', dyn=['*'], rr=1, step=6, kind='sustain', attack=0.03, release=0.25, cutK=0, ls=1.0, lmin=1.0, lmax=1.8, pitch='detect', range=(30.0, 2500.0)),
}
SYNTH = {   # name -> (kind, attack, release); zones come from synth.py (stereo)
    'choirOh': dict(kind='sustain', attack=0.12, release=0.7, cutK=0, ls=1.0, lmin=1.2, lmax=1.6, stereo=True),
    'choirAh': dict(kind='sustain', attack=0.12, release=0.7, cutK=0, ls=1.0, lmin=1.2, lmax=1.6, stereo=True),
    'choirHiAh': dict(kind='sustain', attack=0.12, release=0.7, cutK=0, ls=1.0, lmin=1.2, lmax=1.6, stereo=True),
    'choirHiOo': dict(kind='sustain', attack=0.12, release=0.7, cutK=0, ls=1.0, lmin=1.2, lmax=1.6, stereo=True),
    'padSerrie': dict(kind='sustain', attack=0.3, release=0.9, cutK=0, ls=0.9, lmin=1.2, lmax=1.8, stereo=False),
    'padGlass': dict(kind='sustain', attack=0.3, release=0.9, cutK=0, ls=0.9, lmin=1.2, lmax=1.8, stereo=False),
    'padDark': dict(kind='sustain', attack=0.3, release=0.9, cutK=0, ls=0.9, lmin=1.2, lmax=1.8, stereo=False),
    'subBass': dict(kind='sustain', attack=0.02, release=0.25, cutK=0, ls=0.5, lmin=0.8, lmax=1.4, stereo=False),
}
# composites: one playable instrument built from several recorded ones, each covering its natural range (midi, scientific)
COMPOSITES = {
    'strEns':     dict(kind='sustain', attack=0.09, release=0.55, cutK=8000, members=[('cbSus', 0, 43), ('vcSus', 44, 59), ('vlaSus', 60, 66), ('strSus', 67, 127)]),
    'strEnsSpic': dict(kind='short', attack=0.002, release=0.12, members=[('cbSpic', 0, 43), ('vcSpic', 44, 59), ('vlaSpic', 60, 66), ('strSpic', 67, 127)]),
    'strEnsTrem': dict(kind='sustain', attack=0.08, release=0.4, cutK=8000, members=[('vcTrem', 0, 62), ('strTrem', 63, 127)]),
    'brassEns':   dict(kind='sustain', attack=0.07, release=0.35, members=[('tubaSus', 0, 46), ('tbnSus', 47, 58), ('hornSus', 59, 74), ('tptSus', 75, 127)]),
    'lowBrass':   dict(kind='sustain', attack=0.08, release=0.4, members=[('tubaSus', 0, 48), ('tbnSus', 49, 127)]),
    'choirOhAll': dict(kind='sustain', attack=0.12, release=0.7, members=[('choirOh', 0, 61), ('choirHiOo', 62, 127)]),
    'choirAhAll': dict(kind='sustain', attack=0.12, release=0.7, members=[('choirAh', 0, 61), ('choirHiAh', 62, 127)]),
}
def composites(manifest, log):
    for name, c in COMPOSITES.items():
        zones = []
        for mem, lo, hi in c['members']:
            src = manifest['instruments'].get(mem)
            if not src: continue
            for z in src['zones']:
                zz = dict(z); zz['lo'] = max(z['lo'], lo); zz['hi'] = min(z['hi'], hi)
                if zz['lo'] <= zz['hi']: zones.append(zz)
        if zones:
            manifest['instruments'][name] = dict(kind=c['kind'], pitched=True, attack=c['attack'], release=c['release'], gain=0, cutK=c.get('cutK', 0), zones=sorted(zones, key=lambda z: (z['root'], z['vel'][0], z['rr'])))
            log(f"  {name:10} {len(zones):3} zones (composite)")

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
    present = sorted({f['dyn'] for f in files}, key=lambda d: (len(d), d))
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
                x = decode(f['path']); x = trim_head(x)
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
                x = decode(f['path'])
                x = trim_head(x)
                if spec.get('bright', True) and pitched: x = brighten(x)
                keep = spec.get('keep')
                if spec['kind'] == 'sustain':
                    lp = find_loop(x, spec['ls'], spec['lmin'], spec['lmax'])
                    if not lp: log(f'  !! {name} {midi_name(root)}: no loop found'); continue
                    ls, le, q = lp; x = bake_loop(x, ls, le); loop = [ls / SR, le / SR]
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
    return finish(name, spec, zones, buffers, gain, out, log, stereo=False)

def finish(name, spec, zones, buffers, gain, out, log, stereo):
    roots = sorted({z['root'] for z in zones}); step = spec.get('step', 5) or 4
    lohi = {}
    for i, r in enumerate(roots):
        lo = (roots[i - 1] + r) // 2 + 1 if i else r - step
        hi = (r + roots[i + 1]) // 2 if i + 1 < len(roots) else r + step
        lohi[r] = (lo, hi)
    inst = dict(kind=spec['kind'], pitched=spec.get('pitched', True), attack=spec['attack'], release=spec['release'], gain=0, cutK=spec.get('cutK', 0), zones=[])
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
    ap.add_argument('--vsco', required=True); ap.add_argument('--out', default='assets/audio'); ap.add_argument('--synth-cache', default=None)
    ap.add_argument('--only', default=None)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    only = set(a.only.split(',')) if a.only else None
    manifest = dict(version=1, license='Recorded instruments: VSCO 2 Community Edition (CC0 1.0). Choir, pads, sub: synthesized for this game (tools/samples/synth.py).',
                    calib=dict(file='calib.mp3', at=0.1), instruments={})
    mpath = os.path.join(a.out, 'instruments.json')
    if os.path.exists(mpath) and only:
        manifest = json.load(open(mpath))
    log = lambda s: print(s, flush=True)
    for name, spec in SPECS.items():
        if only and name not in only: continue
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
    log(f'wrote {mpath}: {len(manifest["instruments"])} instruments, {nz} zones, {total / 1048576:.1f} MB')

if __name__ == '__main__':
    main()

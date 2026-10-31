#!/usr/bin/env python3
"""Split the University of Iowa Musical Instrument Samples into one note per file, laid out for tools/samples/build.py.

    python3 tools/samples/iowa.py RAW_DIR STAGING_DIR [--only violin,cello]

RAW_DIR holds one folder per instrument of the files as downloaded (Violin.arco.pp.sulG.G3B3.stereo.aif, Horn.mf.C4B4.aiff, ...):
each file is a chromatic run of notes, its range in the name, the notes separated by silence. The notes are cut at the silences,
checked against the range (by count, else by pitch), and written as 16-bit WAV at 44.1 kHz into STAGING_DIR/<Instrument>/
<Instrument>_<Note>_v<dyn>.wav (pp 1, mf 2, ff 3; sharps in the note names), one file per note and dynamic. A string instrument's
notes are taken from the string a player would use: the lowest string on which the note lies within an octave of the open string
(the warmer choice). The 2012 strings are stereo; the older winds and brass are mono.
The recordings may be used for any project without restriction (theremin.music.uiowa.edu/MIS.html)."""
import os, re, sys, json, subprocess, math, wave
import numpy as np

SR = 44100
NOTES = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
DYN = {'pp': 1, 'mf': 2, 'ff': 3}
OPEN = {'violin': ['G3', 'D4', 'A4', 'E5'], 'viola': ['C3', 'G3', 'D4', 'A4'], 'cello': ['C2', 'G2', 'D3', 'A3'], 'bass': ['C1', 'E1', 'A1', 'D2', 'G2']}

def midi(name):
    m = re.fullmatch(r'([A-G][b#]?)(\d)', name); return 12 * (int(m.group(2)) + 1) + NOTES[m.group(1)]
def nname(m): return SHARP[m % 12] + str(m // 12 - 1)

def decode(path, stereo):
    out = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2' if stereo else '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    y = np.frombuffer(out, dtype='<f4').astype(np.float64)
    return y.reshape(-1, 2) if stereo else y

def envelope_db(x, hop=441, win=1323):
    m = x if x.ndim == 1 else x.mean(axis=1)
    n = max(1, (len(m) - win) // hop + 1); e = np.empty(n)
    for i in range(n): seg = m[i * hop:i * hop + win]; e[i] = math.sqrt(float(np.mean(seg * seg)) + 1e-18)
    return 20 * np.log10(e / max(e.max(), 1e-9)), hop

def segments(x, expect_n=None, on_db=-44, min_len=0.25, bridge=0.45):
    """the notes of a file: regions above the threshold, short gaps bridged; when there are more regions than notes expected (a bow change
    or a breath dipping below the threshold), the closest neighbours are merged until the count matches"""
    e, hop = envelope_db(x); on = e > on_db
    segs, i = [], 0
    while i < len(on):
        if not on[i]: i += 1; continue
        j = i
        while j < len(on) and on[j]: j += 1
        segs.append([i, j]); i = j
    merged = []
    for sg in segs:
        if merged and (sg[0] - merged[-1][1]) * hop / SR < bridge: merged[-1][1] = sg[1]
        else: merged.append(sg)
    merged = [m for m in merged if (m[1] - m[0]) * hop / SR >= min_len]
    while expect_n and len(merged) > expect_n:
        gaps = [(merged[k + 1][0] - merged[k][1], k) for k in range(len(merged) - 1)]
        g, k = min(gaps)
        if g * hop / SR > 1.2: break
        merged[k][1] = merged[k + 1][1]; del merged[k + 1]
    return [(a * hop, b * hop) for a, b in merged], e, hop

def pitch(x, lo_midi, hi_midi):
    """the note of a segment, by autocorrelation searched only between the lowest and highest note expected (a semitone of margin)"""
    m = x if x.ndim == 1 else x.mean(axis=1); a0 = min(len(m) // 4, int(0.25 * SR)); m = m[a0:a0 + int(1.5 * SR)]
    if len(m) < SR // 3: return None
    m = m - m.mean(); spec = np.fft.rfft(m, 2 * len(m)); ac = np.fft.irfft(spec * np.conj(spec))[:len(m)]; ac /= max(ac[0], 1e-12)
    flo, fhi = 440 * 2 ** ((lo_midi - 1.5 - 69) / 12), 440 * 2 ** ((hi_midi + 1.5 - 69) / 12)
    a, b = max(2, int(SR / fhi)), min(len(ac) - 1, int(SR / flo))
    if b <= a: return None
    k = a + int(np.argmax(ac[a:b]))
    # a sub-harmonic (octave below) scores high too: prefer the half period when it is nearly as strong
    if k // 2 >= a and ac[k // 2] > 0.85 * ac[k]: k = k // 2
    return 69 + 12 * math.log2(SR / k / 440.0)

def segments_by_pitch(x, lo_midi, hi_midi, hop=0.05, win=0.12, min_len=0.4):
    """a legato run that never falls silent between its notes: the pitch is tracked frame by frame (within the expected range) and the
    file is cut where the semitone changes; returns [(midi, (a, b))] in order"""
    m = x if x.ndim == 1 else x.mean(axis=1); H, W = int(hop * SR), int(win * SR)
    flo, fhi = 440 * 2 ** ((lo_midi - 1.5 - 69) / 12), 440 * 2 ** ((hi_midi + 1.5 - 69) / 12)
    a, b = max(2, int(SR / fhi)), int(SR / flo)
    amax = np.abs(m).max() + 1e-9; frames = []
    for i in range(0, len(m) - W, H):
        seg = m[i:i + W]
        if np.abs(seg).max() < 0.02 * amax: frames.append(None); continue
        seg = seg - seg.mean(); spec = np.fft.rfft(seg, 2 * W); ac = np.fft.irfft(spec * np.conj(spec))[:W]
        if ac[0] <= 0 or b >= W: frames.append(None); continue
        k = a + int(np.argmax(ac[a:b]))
        if k // 2 >= a and ac[k // 2] > 0.85 * ac[k]: k = k // 2
        if ac[k] / ac[0] < 0.3: frames.append(None); continue
        frames.append(int(round(69 + 12 * math.log2(SR / k / 440.0))))
    runs, cur = [], None
    for idx, n in enumerate(frames):
        if cur and n == cur[0]: cur[2] = idx
        else:
            if cur: runs.append(cur)
            cur = [n, idx, idx] if n is not None else None
    if cur: runs.append(cur)
    out = []
    for n, i0, i1 in runs:
        if n is None or (i1 - i0 + 1) * hop < min_len or not (lo_midi <= n <= hi_midi): continue
        a0, b0 = i0 * H + int(0.03 * SR), min(len(m), (i1 + 1) * H + W - int(0.03 * SR))
        if out and out[-1][0] == n: out[-1] = (n, (out[-1][1][0], b0))
        else: out.append((n, (a0, b0)))
    return out

def cut(x, a, b):
    y = x[max(0, a - int(0.006 * SR)):b]
    mono = np.abs(y if y.ndim == 1 else y.mean(axis=1)); th = 10 ** (-50 / 20) * max(mono.max(), 1e-9)
    idx = np.where(mono > th)[0]
    if len(idx): y = y[:idx[-1] + int(0.05 * SR)]
    fade = np.minimum(1, np.arange(len(y)) / (0.003 * SR)); y = y * (fade if y.ndim == 1 else fade[:, None])
    tail = min(len(y), int(0.08 * SR)); ramp = np.linspace(1, 0, tail); y[-tail:] *= ramp if y.ndim == 1 else ramp[:, None]
    return y

def write_wav(path, y):
    yy = np.clip(y, -1, 1); yy = yy[:, None] if yy.ndim == 1 else yy
    with wave.open(path, 'wb') as w: w.setnchannels(yy.shape[1]); w.setsampwidth(2); w.setframerate(SR); w.writeframes((yy * 32767).astype('<i2').tobytes())

def parse(name):
    toks = name.split('.')
    inst = toks[0]; dyn = next((t for t in toks if t in DYN), None); sul = next((t[3:] for t in toks if t.startswith('sul')), None)
    rng = next((t for t in toks if re.fullmatch(r'[A-G][b#]?\d[A-G][b#]?\d', t)), None)
    stereo = 'stereo' in toks
    if not dyn or not rng: return None
    m = re.fullmatch(r'([A-G][b#]?\d)([A-G][b#]?\d)', rng); lo, hi = midi(m.group(1)), midi(m.group(2))
    if hi < lo: hi += 12
    return dict(inst=inst, dyn=DYN[dyn], sul=sul, lo=lo, hi=hi, stereo=stereo)

def string_for(folder, note):
    opens = [midi(o) for o in OPEN[folder]]
    for o in opens:
        if o <= note <= o + 12: return nname(o)[:-1] if False else nname(o)
    return nname(max([o for o in opens if o <= note] or [opens[0]]))

def main():
    raw, staging = sys.argv[1], sys.argv[2]; only = None
    if '--only' in sys.argv: only = set(sys.argv[sys.argv.index('--only') + 1].split(','))
    report = {}
    for folder in sorted(os.listdir(raw)):
        if only and folder not in only: continue
        files = sorted(f for f in os.listdir(os.path.join(raw, folder)) if f.lower().endswith(('.aif', '.aiff')))
        stereo_names = {f.replace('.stereo.', '.') for f in files if '.stereo.' in f}
        done, notes_out, problems = {}, 0, []
        for f in files:
            if '.mono.' in f and f.replace('.mono.', '.') in stereo_names: continue      # the stereo twin exists
            p = parse(f)
            if not p: problems.append('unparsed ' + f); continue
            try: x = decode(os.path.join(raw, folder, f), p['stereo'])
            except subprocess.CalledProcessError: problems.append('undecodable ' + f); continue
            expect = list(range(p['lo'], p['hi'] + 1))
            segs, env, hop = segments(x, len(expect))
            if len(segs) == len(expect): pairs = list(zip(expect, segs))
            else:
                pairs = []
                seen = {}; extra = ''
                for a, b in segs:
                    pm = pitch(x[a:b], expect[0], expect[-1])
                    if pm is None: continue
                    n = int(round(pm))
                    if abs(pm - n) < 0.45 and expect[0] <= n <= expect[-1] and (n not in seen or (b - a) > (seen[n][1] - seen[n][0])): seen[n] = (a, b)
                pairs = sorted(seen.items())
                if len(pairs) < len(expect) * 0.6:            # a run with no silences between its notes: cut it where the pitch changes
                    byp = segments_by_pitch(x, expect[0], expect[-1])
                    if len(byp) > len(pairs): pairs = byp; extra = f'; {len(byp)} by pitch tracking'
                problems.append(f'{f}: {len(segs)} segments for {len(expect)} notes, {len(pairs)} assigned by pitch' + extra)
            for n, (a, b) in pairs:
                if folder in OPEN and p['sul']:
                    want = string_for(folder, n)
                    if midi(p['sul'] + ('' if re.search(r'\d$', p['sul']) else '')) if False else None: pass
                    # the sul token has no octave: compare by letter
                    if want[0] != p['sul'][0] or (len(want) > 1 and want[1] == '#'): continue
                key = (n, p['dyn'])
                if key in done: continue
                y = cut(x, a, b)
                if len(y) < 0.8 * SR: problems.append(f'{f}: {nname(n)} too short ({len(y) / SR:.2f} s)'); continue
                out = os.path.join(staging, folder.capitalize()); os.makedirs(out, exist_ok=True)
                write_wav(os.path.join(out, f"{folder.capitalize()}_{nname(n)}_v{p['dyn']}.wav"), y); done[key] = f; notes_out += 1
        report[folder] = dict(files=len(files), notes=notes_out, problems=problems)
        print(f'{folder:14} {len(files):3} files -> {notes_out:3} notes' + (f'; {len(problems)} notes/files flagged' if problems else ''), flush=True)
        for pr in problems[:6]: print('     ', pr)
    json.dump(report, open(os.path.join(staging, 'iowa-report.json'), 'w'), indent=1)

if __name__ == '__main__': main()

#!/usr/bin/env python3
"""The University of Iowa Steinway (MIS piano: one file per note and dynamic, pp mf ff) into the library as `pianoIowa`.

    python3 tools/samples/piano.py OUT_DIR [--step 3] [--lo 21] [--hi 108]

Every `step` semitones from `lo` to `hi` (MIDI), each dynamic: downloaded, its attack found (the first moment within 40 dB of the
note's peak), trimmed to the note's singing length (12 s in the bass to 4 s at the top, the piano's own decay inside it), the last
third faded out, and encoded as mono MP3 from the stronger microphone (OUT_DIR/pianoIowa-<Note>-l<layer>-r0.mp3, layer 0 pp, 1 mf, 2 ff). One gain per note for
its three dynamics (the mf's peak at -6 dBFS), so the recorded difference between pp and ff stays. Prints the instruments.json entry.
The recordings may be used for any project without restriction (theremin.music.uiowa.edu/MIS.html)."""
import os, sys, json, subprocess, urllib.request, urllib.parse, tempfile
import numpy as np

SR = 44100
FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
SHARP = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B']
BASE = 'https://theremin.music.uiowa.edu/sound files/MIS/Piano_Other/piano/'
DYN = ['pp', 'mf', 'ff']

def arg(name, default):
    return int(sys.argv[sys.argv.index(name) + 1]) if name in sys.argv else default

def fetch(url, path):
    q = urllib.parse.quote(url, safe=':/')
    with urllib.request.urlopen(q, timeout=120) as r, open(path, 'wb') as f: f.write(r.read())

def decode(path):
    out = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(out, dtype='<f4').astype(np.float64).reshape(-1, 2)

def length_for(m):   # the note's singing length: long in the bass, short at the top
    return float(np.interp(m, [21, 48, 72, 96, 108], [12, 9, 6.5, 4.5, 3.5]))

def main():
    out = sys.argv[1]; step, lo, hi = arg('--step', 3), arg('--lo', 21), arg('--hi', 108)
    os.makedirs(out, exist_ok=True); zones = []; tmp = tempfile.mkdtemp()
    for m in range(lo, hi + 1, step):
        name = FLAT[m % 12] + str(m // 12 - 1); takes = {}
        for d in DYN:
            src = os.path.join(tmp, f'{d}.aiff')
            try: fetch(BASE + f'Piano.{d}.{name}.aiff', src)
            except Exception as e: print('missing', name, d, e, file=sys.stderr); continue
            x = decode(src); os.remove(src)
            env = np.abs(x).max(axis=1); peak = env.max()
            if peak < 1e-4: continue
            on = int(np.argmax(env > peak * 0.01)); on = max(0, on - int(0.004 * SR))   # 40 dB under the peak, 4 ms of lead-in
            n = int(length_for(m) * SR); y = x[on:on + n].copy()
            f0 = int(len(y) * 0.66); fade = np.linspace(1, 0, len(y) - f0) ** 2; y[f0:] *= fade[:, None]
            takes[d] = y
        if 'mf' not in takes: continue
        # mono, from the note's stronger microphone (the same for its three dynamics): the collection's two channels are spaced and in
        # places opposed in phase (C5 at -0.73), hollow and smeared when summed; the mix seats the piano like any other instrument
        ch = 0 if np.mean(takes['mf'][:, 0] ** 2) >= np.mean(takes['mf'][:, 1] ** 2) else 1
        for d in takes: takes[d] = np.repeat(takes[d][:, ch:ch + 1], 2, axis=1)
        g = 0.5 / max(np.abs(takes['mf']).max(), 1e-9)   # one gain for the note: its mf's peak at -6 dBFS
        for li, d in enumerate(DYN):
            if d not in takes: continue
            y = np.clip(takes[d] * g, -1, 1); f = f'pianoIowa-{SHARP[m % 12]}{m // 12 - 1}-l{li}-r0.mp3'
            pcm = (y * 32767).astype('<i2').tobytes()
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-', '-codec:a', 'libmp3lame', '-b:a', '160k', os.path.join(out, f)], input=pcm, check=True)
            zones.append({'file': f, 'root': m, 'lo': m - 1 if m > lo else m - 2, 'hi': m + 1 if m < hi else m + 3, 'vel': [round(li / 3, 3), round((li + 1) / 3, 3)], 'rr': 0})
        print('ok', name, sorted(takes), file=sys.stderr)
    entry = {'kind': 'short', 'pitched': True, 'attack': 0.002, 'release': 0.9, 'gain': 0, 'cutK': 0, 'zones': zones}
    print(json.dumps({'pianoIowa': entry}))

if __name__ == '__main__': main()

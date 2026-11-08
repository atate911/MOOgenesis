#!/usr/bin/env python3
"""Root audit: is every pitched sample the note its zone says? The sampler refines a zone's root only within a quarter tone, and the
tuning audit (tuning.js) measures the error from the nearest semitone, so a file labelled a semitone or two wrong passes both and plays
out of key (the harp's 'B3' was a C4). Here each file's fundamental is chosen by harmonic sum among the written root and the notes up
to two semitones either side, just after the attack (one-shots) or over the body (held notes).
    python3 tools/qa/roots.py [name,name,...]      exit 1 when any zone is a semitone or more from its written root"""
import json, subprocess, sys, numpy as np
SR, N = 44100, 1 << 17
SKIP = ('chimes', 'crotales', 'timp', 'gong', 'crash', 'cymSwell', 'anvil', 'bassDrum', 'snare', 'tenor', 'tamb', 'claves', 'shaker', 'taps', 'woodBlock', 'triangle', 'bellTree', 'sleigh')
I = json.load(open('assets/audio/instruments.json')); I = I.get('instruments', I)
names = sys.argv[1].split(',') if len(sys.argv) > 1 else [k for k, v in I.items() if isinstance(v, dict) and v.get('pitched') and 'zones' in v and not k.startswith(SKIP)]
def best_offset(path, root, short):
    x = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout, '<f4').astype(float)
    a = int((0.05 if short else 0.3) * SR); seg = x[a:a + 32768]
    if len(seg) < 4096 or np.abs(seg).max() < 1e-4: return None, 0
    S = np.abs(np.fft.rfft(seg * np.hanning(len(seg)), N)); bw = SR / N
    def hs(f):   # harmonic sum, each harmonic's peak within a quarter tone
        s = 0
        for k in range(1, 7):
            c = f * k
            if c >= SR / 2 - 200: break
            i0, i1 = int(c * 2 ** (-1 / 24) / bw), int(c * 2 ** (1 / 24) / bw) + 1; s += S[i0:i1].max() / k ** 0.5
        return s
    sc = {d: hs(440 * 2 ** ((root + d - 69) / 12)) for d in (-2, -1, 0, 1, 2)}
    b = max(sc, key=sc.get); return b, sc[b] / max(sc[0], 1e-12)
bad, weak = [], []   # sure: the other note's harmonics three times the written root's or more
for n in names:
    e = I[n]; short = e.get('kind') == 'short'; seen = set()
    for z in e['zones']:
        if z['file'] in seen: continue
        seen.add(z['file'])
        if z.get('fix'): continue
        r = z['root']
        if 440 * 2 ** ((r - 69) / 12) > 3000: continue      # too high to read its harmonics
        d, ratio = best_offset('assets/audio/' + z['file'], r, short)
        if d and ratio > 1.5:
            sure = ratio >= 3; (bad if sure else weak).append((n, z['file'], r, d, ratio))
            print(f'{n:16s} {z["file"]:34s} written {r:6.2f}  sounds {d:+d} semitone(s)  (x{ratio:.1f}){"" if sure else "  (weak: check by ear)"}')
print(f'{len(names)} instruments checked; {len(bad)} zone(s) a semitone or more from their written root, {len(weak)} weak reading(s)')
sys.exit(1 if bad else 0)

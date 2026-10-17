#!/usr/bin/env python3
"""Minimal SFZ reader for the sample build: enough of the format to lift the authoritative metadata out of a library's own instrument
definitions (which samples make up an instrument, their key ranges and root pitch, per-sample tuning and volume corrections, loop
points, start offsets, round-robin position, dynamic-layer crossfades). Supports #include, #define / $VAR substitution, // comments
and the <control> / <global> / <master> / <group> / <region> hierarchy (opcodes inherit downwards).

    regions = sfz.load('path/to/Instrument.sfz')      # -> list of dicts: every opcode merged, plus 'path' (absolute sample path)
"""
import os, re

NOTE = {'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11}
_TOK = re.compile(r'([A-Za-z_][\w$]*)=')

def key_to_midi(v):
    """'c4' -> 60, 'a#3' -> 57, 'db5' -> 73, '60' -> 60 (SFZ: middle C = c4 = 60)."""
    s = str(v).strip().lower()
    if re.fullmatch(r'-?\d+', s): return int(s)
    m = re.fullmatch(r'([a-g])([#b]?)(-?\d+)', s)
    if not m: raise ValueError('bad key ' + repr(v))
    n = NOTE[m.group(1)] + (1 if m.group(2) == '#' else -1 if m.group(2) == 'b' else 0)
    return 12 * (int(m.group(3)) + 1) + n

def _split_opcodes(line):
    """'sample=../a b.wav lokey=c4 hikey=d4' -> [('sample', '../a b.wav'), ('lokey', 'c4'), ...] (values may contain spaces)."""
    out = []
    ms = list(_TOK.finditer(line))
    for i, m in enumerate(ms):
        end = ms[i + 1].start() if i + 1 < len(ms) else len(line)
        out.append((m.group(1), line[m.end():end].strip()))
    return out

def _read(path, defines, depth=0):
    """-> list of (kind, text) items: ('header', 'region') | ('op', (k, v))."""
    if depth > 8: raise RuntimeError('include depth')
    items = []
    base = os.path.dirname(path)
    with open(path, encoding='utf-8', errors='replace') as fh:
        for raw in fh:
            line = raw.split('//', 1)[0].strip()
            if not line: continue
            if line.startswith('#define'):
                parts = line.split(None, 2)
                if len(parts) == 3: defines[parts[1]] = parts[2].strip()
                continue
            if line.startswith('#include'):
                inc = re.search(r'"([^"]+)"', line).group(1).replace('\\', '/')
                items += _read(os.path.normpath(os.path.join(base, inc)), defines, depth + 1)
                continue
            for var, val in sorted(defines.items(), key=lambda kv: -len(kv[0])):
                if var in line: line = line.replace(var, val)
            # headers and opcodes can share a line: "<region> sample=x.wav lokey=..."
            pos = 0
            for m in re.finditer(r'<(\w+)>', line):
                if m.start() > pos: items += [('op', kv) for kv in _split_opcodes(line[pos:m.start()])]
                items.append(('header', m.group(1).lower())); pos = m.end()
            if pos < len(line): items += [('op', kv) for kv in _split_opcodes(line[pos:])]
    return items

LEVELS = ['control', 'global', 'master', 'group', 'region']

def load(path, defines=None):
    items = _read(os.path.abspath(path), dict(defines or {}))
    scopes = {lv: {} for lv in LEVELS}
    cur = 'global'; regions = []
    base = os.path.dirname(os.path.abspath(path)); default_path = ''
    def flush():
        if cur != 'region': return
        r = {}
        for lv in LEVELS[1:]: r.update(scopes[lv])
        if 'sample' in r:
            sp = r['sample'].replace('\\', '/')
            r['path'] = os.path.normpath(os.path.join(base, default_path, sp))
            regions.append(r)
    for kind, val in items:
        if kind == 'header':
            flush()
            if val in scopes:
                cur = val
                scopes[val] = {}
                for lv in LEVELS[LEVELS.index(val) + 1:]: scopes[lv] = {}      # a new group resets the regions under it
            else: cur = val   # <curve>, <effect>: ignored
        else:
            k, v = val
            if cur == 'control':
                if k == 'default_path': default_path = v.replace('\\', '/')
                scopes['control'][k] = v
            elif cur in scopes: scopes[cur][k] = v
    flush()
    return regions

def num(r, k, d=0.0):
    try: return float(r[k])
    except (KeyError, ValueError): return d

def region_summary(r):
    """the fields the build cares about, typed."""
    key = r.get('key')
    lo = key_to_midi(r['lokey']) if 'lokey' in r else (key_to_midi(key) if key is not None else 0)
    hi = key_to_midi(r['hikey']) if 'hikey' in r else (key_to_midi(key) if key is not None else 127)
    root = key_to_midi(r['pitch_keycenter']) if 'pitch_keycenter' in r else (key_to_midi(key) if key is not None else lo)
    return dict(
        path=r['path'], lo=lo, hi=hi, root=root - num(r, 'transpose', 0),      # transpose=-1 plays a semitone lower: the sample behaves as if rooted a semitone higher
        tune=num(r, 'tune', 0), volume=num(r, 'volume', 0) + num(r, 'group_volume', 0) + num(r, 'master_volume', 0),
        offset=int(num(r, 'offset', 0)), loop=(int(num(r, 'loop_start')), int(num(r, 'loop_end'))) if 'loop_start' in r and 'loop_end' in r else None,
        loop_mode=r.get('loop_mode'), seq=int(num(r, 'seq_position', 1)), seq_len=int(num(r, 'seq_length', 1)),
        lovel=int(num(r, 'lovel', 0)), hivel=int(num(r, 'hivel', 127)), trigger=r.get('trigger', 'attack'),
        xfin=(num(r, 'xfin_locc1', -1), num(r, 'xfin_hicc1', -1)) if 'xfin_locc1' in r else None,
        xfout=(num(r, 'xfout_locc1', -1), num(r, 'xfout_hicc1', -1)) if 'xfout_locc1' in r else None,
        pan=num(r, 'pan', 0), raw=r)

if __name__ == '__main__':
    import sys
    for p in sys.argv[1:]:
        rs = load(p)
        print(f'{p}: {len(rs)} regions')
        for r in rs[:200]:
            s = region_summary(r)
            print(f"  {os.path.relpath(s['path'], os.path.dirname(p))!s:60} lo={s['lo']:3} hi={s['hi']:3} root={s['root']:6.2f} tune={s['tune']:+5.0f} vol={s['volume']:+6.1f} off={s['offset']:6} loop={s['loop']} seq={s['seq']}/{s['seq_len']} vel={s['lovel']}-{s['hivel']} trig={s['trigger']} xfin={s['xfin']} xfout={s['xfout']}")

# ---- loop points embedded in the audio file (RIFF 'smpl' chunk; SFZ players use them when the region sets none)
def wav_loops(path):
    """-> [(start, end)] sample frames from the WAV smpl chunk, or []."""
    import struct
    try:
        with open(path, 'rb') as fh:
            head = fh.read(12)
            if head[:4] != b'RIFF' or head[8:12] != b'WAVE': return []
            while True:
                h = fh.read(8)
                if len(h) < 8: return []
                cid, size = h[:4], struct.unpack('<I', h[4:])[0]
                if cid == b'smpl':
                    data = fh.read(size)
                    n = struct.unpack('<I', data[28:32])[0]; out = []
                    for i in range(n):
                        o = 36 + 24 * i
                        if o + 24 > len(data): break
                        _, _, start, end, _, _ = struct.unpack('<6I', data[o:o + 24])
                        out.append((start, end))
                    return out
                fh.seek(size + (size & 1), 1)
    except OSError:
        return []

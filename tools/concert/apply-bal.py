# Apply balance measurements (the output of tools/concert/balance.js, run in parallel without --write) to symphonic.js's BAL table
#   python3 tools/concert/apply-bal.py <id>=<balance output file> ...
import re, json, sys
p = 'js/audio/score/symphonic.js'; s = open(p).read()
m = re.search(r"  const BAL = \{\n([\s\S]*?)  \};", s); table = {}
for line in m.group(1).split('\n'):
    mm = re.match(r"^    '?([\w:]+)'?: (\{.*\}),?$", line)
    if mm: table[mm.group(1)] = json.loads(re.sub(r"(\w+):", r'"\1":', mm.group(2)).replace("'", '"'))
for arg in sys.argv[1:]:
    pid, f = arg.split('=', 1); cur = table.get(pid, {}); n = 0
    for line in open(f).read().split('\n'):
        mm = re.match(r"^  (\S+)\s+melody.*-> (\{.*\})$", line)
        if mm:
            sec = mm.group(1); cur.setdefault(sec, {}); n += 1
            for k, g in json.loads(mm.group(2)).items(): cur[sec][k] = round(min(1, max(0.03, cur[sec].get(k, 1) * g ** 2)), 3)   # squared: a velocity's gain reaches the level at about half its dB (the recording chosen by the dynamic, the velocity curve)
    table[pid] = cur; print(pid, n, 'sections corrected')
body = '\n'.join("    '%s': %s," % (k, re.sub(r'"(\w+)": ', r'\1: ', json.dumps(v))) for k, v in table.items())
s = s.replace(m.group(0), "  const BAL = {\n" + body + "\n  };"); open(p, 'w').write(s)

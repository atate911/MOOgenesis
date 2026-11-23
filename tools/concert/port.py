# Port a piece's original text (js/audio/score/*.js) into js/audio/score/symphonic.js as piece(id, ...), with edits:
#   python3 tools/concert/port.py <id> <src file> <edits.json>    edits: [[old, new, count?], ...] applied to the piece's text
import sys, json, re
pid, src, edits = sys.argv[1], sys.argv[2], json.load(open(sys.argv[3]))
t = open(src).read()
m = re.search(r"\n(  Track\('%s', \{.*?\n  \}\);\n)" % re.escape(pid), t, re.S)
assert m, 'no Track(' + pid + ') in ' + src
body = m.group(1).replace("  Track('%s', {" % pid, "  piece('%s', {" % pid, 1)
# the standard edits of a port (the symphonic profile does the mastering): the refresh's re-harmonisations; the old tone, effects and
# sends out; no rubato; the orchestral profile and the recorded hall; the women's soft parts on the softer vowel; no triangle pings
import os
rp = json.load(open(os.path.join(os.path.dirname(__file__), 'refresh-progs.json'))).get(pid, {})
for sec, prog in rp.items():
    body, n = re.subn(r"(\{ n: '%s',[^\n]*?prog: )'[^']*'" % re.escape(sec), lambda m: m.group(1) + "'" + prog + "'", body, count=1)
    if n: print('  carried the refresh progression of', sec)
hdr_end = body.index('    sec: [')
hdr, rest = body[:hdr_end], body[hdr_end:]
hdr = re.sub(r"tone: \{[^}]*\}, ", "", hdr); hdr = re.sub(r", tone: \{[^}]*\}", "", hdr)
hdr = re.sub(r"fx: \{[^}]*\}, ", "", hdr); hdr = re.sub(r", fx: \{[^}]*\}", "", hdr)
hdr = re.sub(r"sends: \{[^{}]*(\{[^}]*\}[^{}]*)*\}, ", "", hdr)
hdr = re.sub(r"rubato: [0-9.]+", "rubato: 0", hdr)
if 'orch:' not in hdr: hdr = hdr.replace("    bpm:", "    orch: true, holdLow: false, hall: 'musikverein', bpm:", 1)
body = hdr + rest
body = re.sub(r"inst: 'choirWomen'([^{}]*soft: true)", r"inst: 'choirOoh'\1", body)
body = re.sub(r",? ?drums: \{ tri: \[[^\]]*\](, vel: [0-9.]+)? \}", "", body)
for e in edits:
    a, b = e[0], e[1]; n = e[2] if len(e) > 2 else 1
    c = body.count(a); assert c == n, (a, c, n); body = body.replace(a, b)
p = 'js/audio/score/symphonic.js'; s = open(p).read()
if ("piece('%s'," % pid) in s:   # replace an earlier port
    i = s.index("  piece('%s'," % pid); j = s.index("\n  });\n", i) + 7; s = s[:i] + body + s[j:]
else:
    s = s.replace("})(window.MOO);\n", "\n" + body + "})(window.MOO);\n")
open(p, 'w').write(s)
print('ported', pid)

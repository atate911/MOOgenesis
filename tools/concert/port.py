# Port a piece's original text (js/audio/score/*.js) into js/audio/score/symphonic.js as piece(id, ...), with edits:
#   python3 tools/concert/port.py <id> <src file> <edits.json>    edits: [[old, new, count?], ...] applied to the piece's text
import sys, json, re
pid, src, edits = sys.argv[1], sys.argv[2], json.load(open(sys.argv[3]))
t = open(src).read()
m = re.search(r"\n(  Track\('%s', \{.*?\n  \}\);\n)" % re.escape(pid), t, re.S)
assert m, 'no Track(' + pid + ') in ' + src
body = m.group(1).replace("  Track('%s', {" % pid, "  piece('%s', {" % pid, 1)
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

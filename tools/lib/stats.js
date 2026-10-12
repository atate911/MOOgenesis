// Small dependency-free helpers shared by the soak tools: percentiles, number/duration formatting, aligned text tables,
// hashing and plain-JSON state scanning. Pure functions only, so the CLI and the worker threads can both require it.
'use strict';

const isNum = v => typeof v === 'number' && Number.isFinite(v);

// ---- statistics ---------------------------------------------------------------------------------------------------
function sortedNums(a) {                                  // finite numbers of an array/typed array, ascending (new array)
  const out = [];
  for (let i = 0; i < a.length; i++) if (isNum(a[i])) out.push(a[i]);
  return out.sort((x, y) => x - y);
}

function pctile(sorted, p) {                              // linear-interpolated percentile of an ascending array, p in 0..100
  const n = sorted.length;
  if (!n) return NaN;
  if (n === 1) return sorted[0];
  const k = (n - 1) * p / 100, lo = Math.floor(k), hi = Math.ceil(k);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (k - lo);
}

function summarize(a) {                                   // {n,min,p10,p25,p50,p75,p90,p95,p99,max,mean,sd,sum}; {n:0} if empty
  const s = sortedNums(a), n = s.length;
  if (!n) return { n: 0 };
  let sum = 0;
  for (let i = 0; i < n; i++) sum += s[i];
  const mean = sum / n;
  let ss = 0;
  for (let i = 0; i < n; i++) ss += (s[i] - mean) * (s[i] - mean);
  return {
    n, min: s[0], p10: pctile(s, 10), p25: pctile(s, 25), p50: pctile(s, 50), p75: pctile(s, 75), p90: pctile(s, 90),
    p95: pctile(s, 95), p99: pctile(s, 99), max: s[n - 1], mean, sd: n > 1 ? Math.sqrt(ss / (n - 1)) : 0, sum,
  };
}

const median = a => pctile(sortedNums(a), 50);
const mean = a => { const s = sortedNums(a); let t = 0; for (const v of s) t += v; return s.length ? t / s.length : NaN; };

function wilson(k, n, z) {                                // Wilson score interval for k successes in n trials -> [lo, hi]
  if (!n) return [0, 1];
  z = z || 1.96;
  const p = k / n, z2 = z * z, d = 1 + z2 / n;
  const c = (p + z2 / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

// ---- formatting ---------------------------------------------------------------------------------------------------
const fix = (v, d) => (isNum(v) ? v.toFixed(d === undefined ? 1 : d) : '-');
const int = v => (isNum(v) ? String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '-');
const pc = (frac, d) => (isNum(frac) ? (frac * 100).toFixed(d === undefined ? 0 : d) + '%' : '-');
const ms = v => (!isNum(v) ? '-' : v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v >= 1 ? v.toFixed(2) : v.toFixed(3));
const kb = bytes => (!isNum(bytes) ? '-' : bytes >= 1048576 ? (bytes / 1048576).toFixed(2) + 'MB' : (bytes / 1024).toFixed(bytes < 10240 ? 1 : 0) + 'KB');
function dur(t) {                                         // milliseconds -> "350ms" / "4.2s" / "1m05s" / "2h03m"
  if (!isNum(t)) return '-';
  if (t < 1000) return t.toFixed(0) + 'ms';
  const s = t / 1000;
  if (s < 60) return s.toFixed(s < 10 ? 1 : 0) + 's';
  const m = Math.floor(s / 60), r = Math.round(s - m * 60);
  if (m < 60) return m + 'm' + String(r).padStart(2, '0') + 's';
  return Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0') + 'm';
}
const bar = (frac, w) => { const n = Math.max(0, Math.min(w, Math.round(frac * w))); return '[' + '#'.repeat(n) + '-'.repeat(w - n) + ']'; };
const stamp = d => {                                      // 20261011-221021 (local time), for output file names
  d = d || new Date();
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
};

// Aligned plain-text table. cols: [{h:'title', k:'key' | get:row=>v, a:'l'|'r' (default r), f:(v,row)=>string, max:width}]
function table(cols, rows, o) {
  o = o || {};
  const gap = o.gap === undefined ? '  ' : o.gap, ind = ' '.repeat(o.indent || 0);
  const cells = rows.map(r => cols.map(c => {
    let v = c.get ? c.get(r) : r[c.k];
    let s = String(c.f ? c.f(v, r) : (v === undefined || v === null ? '' : v));
    if (c.max && s.length > c.max) s = s.slice(0, c.max - 1) + '~';
    return s;
  }));
  const w = cols.map((c, i) => { let m = String(c.h).length; for (const r of cells) if (r[i].length > m) m = r[i].length; return m; });
  const fit = (s, i) => (cols[i].a === 'l' ? s.padEnd(w[i]) : s.padStart(w[i]));
  const lines = [ind + cols.map((c, i) => fit(String(c.h), i)).join(gap).trimEnd(), ind + w.map(n => '-'.repeat(n)).join(gap)];
  for (const r of cells) lines.push(ind + r.map(fit).join(gap).trimEnd());
  return lines.join('\n');
}

// ---- hashing ------------------------------------------------------------------------------------------------------
function hash53(str) {                                    // cyrb53: fast 53-bit string hash
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
const hashStr = s => hash53(s).toString(16).padStart(14, '0');
const hashState = S => hashStr(JSON.stringify(S));

// ---- plain-JSON state scanning ------------------------------------------------------------------------------------
// Keys whose numeric value must never be negative in a healthy game state (counts / populations).
const NEG_KEY_RE = /^(pop|population|maxPop|factories|troops|farmers|workers|scientists|colonies|techs|ships)$/i;
// records that may legitimately hold negative deltas (whole-key words, or camelCase suffixes such as popGrowth)
const NEG_SKIP_WORD = /^(flows?|deltas?|diffs?|changes?|net|growth|rates?|income|balance)$/i;
const NEG_SKIP_CAMEL = /[a-z](Flow|Delta|Diff|Change|Growth|Rate|Income)$/;
const negSkip = k => typeof k === 'string' && (NEG_SKIP_WORD.test(k) || NEG_SKIP_CAMEL.test(k));

function pathOf(keys) {
  let s = 'S';
  for (const k of keys) s += typeof k === 'number' ? '[' + k + ']' : /^[A-Za-z_$][\w$]*$/.test(k) ? '.' + k : '[' + JSON.stringify(k) + ']';
  return s;
}
const ctorName = v => { try { return (v.constructor && v.constructor.name) || 'object'; } catch (e) { return 'object'; } };

// Walks a game state once and reports everything that does not belong in a JSON-serialisable sim state:
//   nan (NaN/Infinity), huge (|v| >= o.huge, default 1e14 = runaway growth; timestamps stay below), neg (negative value under a NEG_KEY_RE key),
//   nonPlain (undefined, functions, Map/Set/Date/typed arrays/class instances, array holes), cycle (back-reference),
//   shared (same object reachable twice: aliasing is lost after a save/load round trip).
// Returns {nodes, maxDepth, counts:{kind:n}, <kind>:[{path,...}] (first o.maxPer examples each)}. Iteration uses recursion
// (state depth is small) and only builds path strings when something is found.
function scanState(S, o) {
  o = o || {};
  const maxPer = o.maxPer || 5, negRe = o.negRe || NEG_KEY_RE, huge = o.huge || 1e14, wantShared = o.shared !== false;
  const out = { nodes: 0, maxDepth: 0, counts: { nan: 0, huge: 0, neg: 0, nonPlain: 0, cycle: 0, shared: 0 }, nan: [], huge: [], neg: [], nonPlain: [], cycle: [], shared: [] };
  const keys = [], seen = new Set(), stack = new Set(), negKey = new Map();
  const note = (kind, extra) => { out.counts[kind]++; if (out[kind].length < maxPer) out[kind].push(Object.assign({ path: pathOf(keys) }, extra)); };
  const isNegKey = k => {
    if (typeof k !== 'string') return false;
    let r = negKey.get(k);
    if (r === undefined) { r = negRe.test(k); negKey.set(k, r); }
    return r;
  };

  function walk(v, depth) {
    const t = typeof v;
    if (t === 'number') {
      if (v !== v || v === Infinity || v === -Infinity) note('nan', { value: String(v) });
      else if (v < 0 && isNegKey(keys[keys.length - 1]) && !keys.some(negSkip)) note('neg', { value: v });
      else if (v >= huge || v <= -huge) note('huge', { value: v });
      return;
    }
    if (t === 'string' || t === 'boolean' || v === null) return;
    if (t !== 'object') { note('nonPlain', { kind: t }); return; }          // undefined, function, symbol, bigint
    if (stack.has(v)) { note('cycle'); return; }
    if (seen.has(v)) { if (wantShared) note('shared'); return; }
    seen.add(v);
    out.nodes++;
    if (depth > out.maxDepth) out.maxDepth = depth;
    stack.add(v);
    if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) {
        keys.push(i);
        if (i in v) walk(v[i], depth + 1); else note('nonPlain', { kind: 'array hole' });
        keys.pop();
      }
    } else {
      const proto = Object.getPrototypeOf(v);
      if (proto !== null && Object.getPrototypeOf(proto) !== null) note('nonPlain', { kind: ctorName(v) });   // class instance, Map, Set, Date, typed array...
      else for (const k in v) { keys.push(k); walk(v[k], depth + 1); keys.pop(); }
    }
    stack.delete(v);
  }
  walk(S, 0);
  return out;
}

const describe = v => (v === undefined ? 'undefined' : v === null ? 'null' : typeof v === 'function' ? 'function' : Array.isArray(v) ? 'array[' + v.length + ']' :
  typeof v === 'object' ? 'object' : typeof v === 'string' ? JSON.stringify(v.length > 30 ? v.slice(0, 29) + '~' : v) : String(v));

// Structural diff of two values (e.g. a state vs JSON.parse(JSON.stringify(state)), or two replays). Returns up to `max`
// [{path, a, b}]. A non-finite number that became null is skipped (already reported by scanState as NaN/Infinity).
function plainDiff(a, b, max) {
  max = max || 5;
  const diffs = [], keys = [];
  const ABSENT = {};                                      // marker: the key does not exist on that side
  const add = (x, y) => { diffs.push({ path: pathOf(keys), a: x === ABSENT ? '(absent)' : describe(x), b: y === ABSENT ? '(absent)' : describe(y) }); };
  function rec(x, y) {
    if (diffs.length >= max || x === y) return;
    const tx = typeof x, ty = typeof y;
    if (tx === 'number' && !Number.isFinite(x) && y === null) return;
    if (tx !== 'object' || ty !== 'object' || x === null || y === null) { add(x, y); return; }
    const ax = Array.isArray(x), ay = Array.isArray(y);
    if (ax !== ay) { add(x, y); return; }
    if (ax) {
      if (x.length !== y.length) { add(x, y); return; }
      for (let i = 0; i < x.length && diffs.length < max; i++) { keys.push(i); rec(i in x ? x[i] : undefined, y[i]); keys.pop(); }
      return;
    }
    for (const k in x) {
      if (diffs.length >= max) return;
      keys.push(k);
      if (!(k in y)) add(x[k], ABSENT); else rec(x[k], y[k]);
      keys.pop();
    }
    for (const k in y) if (!(k in x) && diffs.length < max) { keys.push(k); add(ABSENT, y[k]); keys.pop(); }
  }
  rec(a, b);
  return diffs;
}

module.exports = {
  isNum, sortedNums, pctile, summarize, median, mean, wilson,
  fix, int, pc, ms, kb, dur, bar, stamp, table,
  hash53, hashStr, hashState,
  NEG_KEY_RE, pathOf, scanState, plainDiff, describe,
};

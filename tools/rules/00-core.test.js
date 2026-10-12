// Core infrastructure sanity (RNG determinism, util helpers).
module.exports = function (M, t) {
  t.test('rng: same seed -> same sequence', () => {
    const a = M.RNG.create('abc'), b = M.RNG.create('abc');
    for (let i = 0; i < 100; i++) t.eq(a.next(), b.next());
  });
  t.test('rng: bound state array advances and is JSON-safe', () => {
    const st = M.RNG.seedState('seed'); const r = M.RNG.bind(st); const before = st.join(',');
    r.next(); t.ok(st.join(',') !== before);
    const st2 = JSON.parse(JSON.stringify(st)); t.eq(M.RNG.bind(st2).next(), M.RNG.bind(st).next());
  });
  t.test('rng: int is inclusive and in range', () => {
    const r = M.RNG.create(5); let lo = 99, hi = -99;
    for (let i = 0; i < 2000; i++) { const v = r.int(1, 6); lo = Math.min(lo, v); hi = Math.max(hi, v); }
    t.eq(lo, 1); t.eq(hi, 6);
  });
  t.test('util: roman numerals', () => { t.eq(M.Util.roman(4), 'IV'); t.eq(M.Util.roman(9), 'IX'); t.eq(M.Util.roman(3), 'III'); });
  t.test('util: fmt groups thousands', () => { t.eq(M.Util.fmt(1234567), '1,234,567'); });
};

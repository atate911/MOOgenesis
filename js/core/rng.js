// Seeded, serialisable RNG (sfc32 seeded through xmur3). Used for ALL gameplay randomness so saves/replays are reproducible
// and worker threads can reproduce results.
//   Game state keeps the RNG state as a plain array:   S.rs = [a,b,c,d]
//   const R = MOO.RNG.bind(S.rs);   R.next(); R.int(1,6); …     // reads/writes S.rs in place — no hidden state, JSON-safe, cloneable
//   const R = MOO.RNG.create('seed')                              // free-standing generator (own state; R.state() to read it)
// Worker-safe module (see ns.js).
MOO.def(function (M) {
  'use strict';

  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }

  // st = 4-element array holding the generator state (mutated in place)
  function over(st) {
    const r = {
      next() { // [0,1)
        let a = st[0] >>> 0, b = st[1] >>> 0, c = st[2] >>> 0, d = st[3] >>> 0;
        let t = (a + b) | 0;
        a = b ^ (b >>> 9);
        b = (c + (c << 3)) | 0;
        c = (c << 21) | (c >>> 11);
        d = (d + 1) | 0;
        t = (t + d) | 0;
        c = (c + t) | 0;
        st[0] = a >>> 0; st[1] = b >>> 0; st[2] = c >>> 0; st[3] = d >>> 0;
        return (t >>> 0) / 4294967296;
      },
      state() { return [st[0] >>> 0, st[1] >>> 0, st[2] >>> 0, st[3] >>> 0]; },
      range(lo, hi) { return lo + r.next() * (hi - lo); },
      int(lo, hi) { return lo + Math.floor(r.next() * (hi - lo + 1)); },       // inclusive
      chance(p) { return r.next() < p; },
      pick(arr) { return arr[Math.floor(r.next() * arr.length)]; },
      shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r.next() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; },
      normal(mean, sd) { let u = 0, v = 0; while (!u) u = r.next(); while (!v) v = r.next(); return (mean || 0) + (sd === undefined ? 1 : sd) * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); },
      // pick from items using weight fn (or item.w); falls back to uniform if all weights are 0
      weighted(items, wfn) {
        let tot = 0; const w = items.map(it => { const x = Math.max(0, wfn ? wfn(it) : it.w); tot += x; return x; });
        if (tot <= 0) return r.pick(items);
        let t = r.next() * tot;
        for (let i = 0; i < items.length; i++) { t -= w[i]; if (t < 0) return items[i]; }
        return items[items.length - 1];
      },
      // roll n dice with `sides` sides (1..sides) and sum
      dice(n, sides) { let s = 0; for (let i = 0; i < n; i++) s += 1 + Math.floor(r.next() * sides); return s; },
      // independent child generator derived from this one (consumes one draw) — use for per-empire / per-battle streams
      fork(label) { return M.RNG.create(String(label) + ':' + Math.floor(r.next() * 4294967296)); },
    };
    return r;
  }

  function seedState(seed) {
    const s = xmur3(String(seed === undefined ? Date.now() + ':' + Math.random() : seed));
    return [s(), s(), s(), s()];
  }

  M.RNG = {
    // new state array from a seed (store it in the game state:  S.rs = MOO.RNG.seedState(seed))
    seedState(seed) { const st = seedState(seed); const r = over(st); for (let i = 0; i < 15; i++) r.next(); return st; },
    bind: over,                                              // generator operating directly on a state array
    create(seed) { return over(M.RNG.seedState(seed)); },    // free-standing generator
    fromState(st) { return over(st.slice()); },
  };
});

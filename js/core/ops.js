// Generic worker ops (worker-safe). Game-specific ops live next to the code they run (sim/*, ai/*, gfx-free texture builders…).
MOO.def(function (M) {
  'use strict';
  // CPU benchmark / smoke test for the pool:  Workers.map('burn', [{n:3e6}, …])
  M.Ops.burn = function (p) { let x = 0; const n = (p && p.n) || 2e6; for (let i = 1; i <= n; i++) x += Math.sqrt(i) * Math.sin(i); return Math.round(x * 1000) / 1000; };
  M.Ops.echo = function (p) { return p; };
  // proves the snapshot arrived: returns basic facts about MOO.snap
  M.Ops.snapInfo = function () { const s = M.snap; return s ? { turn: s.turn, stars: s.stars && s.stars.length, empires: s.empires && s.empires.length } : null; };
});

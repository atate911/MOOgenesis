// Master of Orion — Reborn · namespace bootstrap (must load first).
//
// Two module styles:
//   • WORKER-SAFE modules (core/util, core/rng, data/*, sim/*, ai/*) are written as   MOO.def(function (M) { ... });
//     MOO.def runs the function immediately AND remembers its source text so the worker pool (core/workers.js) can boot
//     identical code inside Web Workers — even from file:// — and Node's headless harness can load it too.
//     These modules must be self-contained (no references to outer variables) and DOM-free.
//   • Main-thread modules (gfx/, audio/, ui/, core/save|settings|workers) are classic IIFEs:  (function (M) { ... })(window.MOO);
(function () {
  'use strict';
  var g = typeof window !== 'undefined' ? window : globalThis;
  var M = g.MOO = g.MOO || {};
  ['Data', 'Sim', 'AI', 'Gfx', 'Audio', 'UI', 'Util'].forEach(function (k) { M[k] = M[k] || {}; });
  M.VERSION = '1.1.3';   // kept equal to the VERSION file (CI checks; moo_make_release re-stamps it per release)
  M.BUILD = typeof g.MOO_BUILD === 'string' ? g.MOO_BUILD : '';   // release name stamped into js/manifest.js, '' in a checkout
  M.SAVE_VERSION = 1;
  M.HEADLESS = typeof document === 'undefined';
  M.Ops = M.Ops || {};        // worker-callable operations:  MOO.Ops.aiPlan = function (payload) { return result; }
  M.__defs = M.__defs || [];  // sources of worker-safe modules (filled by MOO.def)
  M.def = function (fn, opts) {
    fn(M);
    if (!(opts && opts.worker === false)) M.__defs.push(fn.toString());
  };
  // Hardware snapshot (threads/memory); GPU info is filled in by Gfx when a WebGL context exists.
  M.HW = {
    threads: (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4,
    memoryGB: (typeof navigator !== 'undefined' && navigator.deviceMemory) || 0,
    gpu: '', webgl2: false, workers: 0,
  };
})();

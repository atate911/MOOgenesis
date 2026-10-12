// Web Worker pool — spreads pure, snapshot-based work (AI planning, battle resolution, texture generation, odds simulation…)
// across every available hardware thread.
//
//   await MOO.Workers.init();                              // spawns `size` workers (default: all logical threads - 1)
//   MOO.Workers.setSnapshot(S);                            // stringify the game state ONCE per turn (workers parse it in parallel on demand)
//   const plans = await MOO.Workers.map('aiPlan', empireIds.map(id => ({ empire: id })), { snap: true });
//   const r = await MOO.Workers.run('rollBattle', {battle, seed});
//
// An "op" is a function registered by a worker-safe module (MOO.def):   MOO.Ops.aiPlan = function (payload) { …MOO.snap… return result; }
// Inside a worker `MOO.snap` is the parsed snapshot (treat as READ-ONLY). If workers are unavailable (blocked, unsupported, size 0) every
// call transparently runs inline on the main thread, so game logic never depends on threading.
(function (M) {
  'use strict';

  let workers = [];            // {w, busy, snapVer, id, done, ms}
  let queue = [];
  let seq = 1, snapVer = 0, snapStr = '', snapObj = null;
  const pending = new Map();
  let initP = null, blobUrl = null, inlineOnly = false;
  const stat = { submitted: 0, completed: 0, inline: 0, errors: 0, busyMs: 0, since: 0, lastBatchMs: 0, lastBatchN: 0 };

  function preamble() {
    return [
      "'use strict';",
      'self.window = self;',
      'var MOO = self.MOO = { Data:{}, Sim:{}, AI:{}, Gfx:{}, Audio:{}, UI:{}, Util:{}, Ops:{}, __defs:[], HEADLESS:true, snap:null, snapVer:-1,',
      '  HW:{ threads:' + (M.HW.threads | 0) + ', memoryGB:0, gpu:"", webgl2:false, workers:0 } };',
      'MOO.def = function (fn) { fn(MOO); };',
      'self.onmessage = function (e) {',
      '  var m = e.data, t0 = performance.now();',
      '  try {',
      '    if (m.snapStr !== undefined) { MOO.snap = JSON.parse(m.snapStr); MOO.snapVer = m.snapVer; }',
      '    if (m.type === "ping") { postMessage({ id: m.id, ok: true, result: "pong" }); return; }',
      '    var fn = MOO.Ops[m.op]; if (!fn) throw new Error("Unknown worker op: " + m.op);',
      '    var r = fn(m.payload);',
      '    var done = function (v) { var x = v && v.__xfer; if (x) { delete v.__xfer; } postMessage({ id: m.id, ok: true, result: v, ms: performance.now() - t0 }, x || []); };',
      '    if (r && typeof r.then === "function") r.then(done, function (err) { postMessage({ id: m.id, ok: false, error: String(err && err.stack || err) }); });',
      '    else done(r);',
      '  } catch (err) { postMessage({ id: m.id, ok: false, error: String(err && err.stack || err) }); }',
      '};',
    ].join('\n');
  }
  function buildBlobUrl() {
    const src = preamble() + '\n' + M.__defs.map(s => ';(' + s + ')(MOO);').join('\n');
    return URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
  }

  function spawn() {
    const rec = { busy: false, snapVer: -1, done: 0, ms: 0, w: null };
    const w = new Worker(blobUrl);
    rec.w = w;
    w.onmessage = e => {
      const m = e.data, p = pending.get(m.id);
      rec.busy = false;
      if (p) {
        pending.delete(m.id);
        stat.completed++; rec.done++; const ms = m.ms || (performance.now() - p.t0); rec.ms += ms; stat.busyMs += ms;
        if (m.ok) p.res(m.result); else { stat.errors++; p.rej(new Error('[worker] ' + m.error)); }
      }
      pump();
    };
    w.onerror = e => {
      console.error('[worker error]', e.message || e);
      // fail the in-flight task of this worker, replace it
      for (const [id, p] of pending) if (p.rec === rec) { pending.delete(id); stat.errors++; p.rej(new Error('worker crashed: ' + (e.message || ''))); }
      try { w.terminate(); } catch (x) { /* ignore */ }
      const i = workers.indexOf(rec); if (i >= 0) { try { workers[i] = spawn(); } catch (x) { workers.splice(i, 1); } }
      pump();
    };
    return rec;
  }

  function pump() {
    while (queue.length) {
      const rec = workers.find(r => !r.busy);
      if (!rec) return;
      const job = queue.shift();
      rec.busy = true; job.rec = rec; job.t0 = performance.now();
      const msg = { id: job.id, op: job.op, payload: job.payload };
      if (job.snap && rec.snapVer !== snapVer) { msg.snapStr = snapStr; msg.snapVer = snapVer; rec.snapVer = snapVer; }
      pending.set(job.id, job);
      try { rec.w.postMessage(msg, job.transfer || []); }
      catch (err) { pending.delete(job.id); rec.busy = false; stat.errors++; job.rej(err); }
    }
  }

  function inline(op, payload, snap) {
    stat.inline++;
    return new Promise((res, rej) => {
      setTimeout(() => {
        try {
          const fn = M.Ops[op]; if (!fn) throw new Error('Unknown op: ' + op);
          const prev = M.snap; if (snap) M.snap = snapObj;
          let r; try { r = fn(payload); } finally { M.snap = prev; }
          Promise.resolve(r).then(v => { if (v && v.__xfer) delete v.__xfer; res(v); }, rej);
        } catch (e) { rej(e); }
      }, 0);
    });
  }

  M.Workers = {
    // size: number of workers; default = Settings 'threads' (0 = auto) else (logical threads - 1), at least 1, at most 32.
    init(size) {
      if (initP) return initP;
      initP = new Promise(resolve => {
        const pref = size !== undefined ? size : (M.Settings && M.Settings.get('threads')) || 0;
        const want = pref > 0 ? pref : Math.max(1, Math.min(32, (M.HW.threads | 0) - 1));
        if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || !M.__defs.length) { inlineOnly = true; M.HW.workers = 0; resolve(0); return; }
        try {
          blobUrl = buildBlobUrl();
          for (let i = 0; i < want; i++) workers.push(spawn());
          // handshake so we know the code booted
          const pings = workers.map(rec => new Promise(r => { const id = seq++; pending.set(id, { id, res: r, rej: r, rec, t0: performance.now() }); rec.busy = true; rec.w.postMessage({ id, type: 'ping' }); }));
          Promise.all(pings).then(() => { workers.forEach(r => { r.busy = false; }); stat.since = performance.now(); M.HW.workers = workers.length; if (M.Bus) M.Bus.emit('workers', workers.length); resolve(workers.length); pump(); });
          setTimeout(() => { if (!M.HW.workers) { console.warn('[workers] handshake timed out — using inline mode'); workers.forEach(r => { try { r.w.terminate(); } catch (e) { /* ignore */ } }); workers = []; inlineOnly = true; resolve(0); } }, 8000);
        } catch (e) {
          console.warn('[workers] unavailable, running inline:', e); inlineOnly = true; workers = []; M.HW.workers = 0; resolve(0);
        }
      });
      return initP;
    },
    size: () => workers.length,
    // stringify the game state once; ops called with {snap:true} see it as MOO.snap
    setSnapshot(S) { snapObj = S; snapStr = JSON.stringify(S); snapVer++; return snapVer; },
    run(op, payload, o) {
      o = o || {}; stat.submitted++;
      if (inlineOnly || !workers.length) return inline(op, payload, o.snap);
      return new Promise((res, rej) => { queue.push({ id: seq++, op, payload, snap: !!o.snap, transfer: o.transfer, res, rej }); pump(); });
    },
    map(op, payloads, o) {
      const t0 = performance.now();
      return Promise.all(payloads.map(p => M.Workers.run(op, p, o))).then(r => { stat.lastBatchMs = performance.now() - t0; stat.lastBatchN = payloads.length; return r; });
    },
    // results for many independent items, preserving order; chunks them so each worker gets ~equal share (less messaging overhead)
    mapChunked(op, items, o) {
      const n = Math.max(1, workers.length), size = Math.ceil(items.length / n), chunks = [];
      for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
      return M.Workers.map(op, chunks, o).then(rs => [].concat.apply([], rs));
    },
    stats() {
      const el = Math.max(1, performance.now() - (stat.since || performance.now()));
      return {
        size: workers.length, inline: inlineOnly || !workers.length, busy: workers.filter(r => r.busy).length, queued: queue.length,
        submitted: stat.submitted, completed: stat.completed, errors: stat.errors, inlineRuns: stat.inline,
        utilisation: workers.length ? stat.busyMs / (el * workers.length) : 0, lastBatchMs: stat.lastBatchMs, lastBatchN: stat.lastBatchN,
        perWorker: workers.map(r => ({ done: r.done, ms: Math.round(r.ms) })),
      };
    },
    terminate() { workers.forEach(r => { try { r.w.terminate(); } catch (e) { /* ignore */ } }); workers = []; queue = []; initP = null; M.HW.workers = 0; if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; } },
  };
})(window.MOO);

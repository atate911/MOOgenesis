// Save/load. serialize()/deserialize() are pure; slot storage uses localStorage when available.
// Game state is plain JSON (RNG state lives in S.rs), so serialisation is simply JSON.
(function (M) {
  'use strict';
  const PREFIX = 'moo.save.v1.';

  function serialize(S) { return JSON.stringify(S); }
  function deserialize(text) {
    const S = JSON.parse(text);
    if (!S || typeof S.turn !== 'number' || !S.stars) throw new Error('Not a valid save file');
    return S;
  }
  const store = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; } };

  // calendar year (Config.displayYear), not the S.year turn counter
  function calYear(S) { try { return M.Data.Config.displayYear(S); } catch (e) { return S.year; } }

  // The galaxy as the player knew it when the game was saved, for the save list's thumbnail (saveload.js): three bytes per star — x and y over the
  // galaxy (0..255) and what the player knows of it (0 unexplored, 1 explored and free, 2 + k an empire with banner colour k; +64 the player's
  // capital) — base64 in the slot metadata (~0.6 KB for 160 stars: it rides in the server's X-Save-Meta header, 4 KB at most). Fog of war
  // holds: live stars show their owner, remembered ones the last report, unexplored ones nothing.
  function b64(bytes) {
    let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    if (typeof btoa === 'function') return btoa(s);
    return typeof Buffer !== 'undefined' ? Buffer.from(bytes).toString('base64') : '';
  }
  function sketch(S) {
    try {
      const E = S.empires && S.empires[S.playerId], g = S.galaxy || {}, n = S.stars ? S.stars.length : 0;
      if (!E || !n || !(g.w > 0) || !(g.h > 0)) return null;
      const b = new Uint8Array(n * 3), q = (v, m) => Math.max(0, Math.min(255, Math.round(v / m * 255)));
      for (let i = 0; i < n; i++) {
        const st = S.stars[i], p = S.planets && S.planets[i], vis = E.vis ? E.vis[i] | 0 : 0, ex = (E.explored && E.explored[i]) || vis === 2;
        let own = -1;
        if (vis === 2) own = p ? p.owner : -1; else if (E.seen && E.seen[i]) own = E.seen[i].owner;
        if (p && p.owner === E.id) own = E.id;
        const O = own >= 0 ? S.empires[own] : null;
        b[i * 3] = q(st.x, g.w); b[i * 3 + 1] = q(st.y, g.h);
        b[i * 3 + 2] = (O ? 2 + ((O.color | 0) % 6) : ex ? 1 : 0) | (E.capital === i ? 64 : 0);
      }
      return { w: g.w, h: g.h, d: b64(b) };
    } catch (e) { return null; }
  }
  function meta(S) {
    const me = S.empires && S.empires[S.playerId];
    return {
      turn: S.turn, year: calYear(S), race: me && me.race, leader: me && me.leader, color: me && me.color,
      size: S.settings && S.settings.size, difficulty: S.settings && S.settings.difficulty, stars: S.stars ? S.stars.length : 0,
      planets: S.planets ? S.planets.filter(p => p.owner === S.playerId).length : 0, at: Date.now(), map: sketch(S),
    };
  }

  M.Save = {
    SLOTS: ['auto', '1', '2', '3', '4', '5', '6'],
    serialize, deserialize, meta,
    available: () => !!store(),
    save(slot, S) {
      const st = store(); if (!st) return false;
      try {
        st.setItem(PREFIX + slot, serialize(S));
        st.setItem(PREFIX + slot + '.meta', JSON.stringify(meta(S)));
        return true;
      } catch (e) { console.warn('save failed', e); return false; }
    },
    load(slot) {
      const st = store(); if (!st) return null;
      try { const t = st.getItem(PREFIX + slot); return t ? deserialize(t) : null; } catch (e) { console.warn('load failed', e); return null; }
    },
    remove(slot) { const st = store(); if (st) { st.removeItem(PREFIX + slot); st.removeItem(PREFIX + slot + '.meta'); } },
    list() {
      const st = store();
      return M.Save.SLOTS.map(slot => {
        let m = null;
        try { const t = st && st.getItem(PREFIX + slot + '.meta'); m = t ? JSON.parse(t) : null; } catch (e) { /* ignore */ }
        return { slot, meta: m };
      });
    },
    latest() { const l = M.Save.list().filter(x => x.meta); l.sort((a, b) => b.meta.at - a.meta.at); return l[0] || null; },
    // browser-only helpers (user-initiated file export/import)
    exportFile(S, name) {
      const blob = new Blob([serialize(S)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = (name || 'orion-save') + '.json';
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    },
    importFile(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => { try { res(deserialize(r.result)); } catch (e) { rej(e); } }; r.onerror = rej; r.readAsText(file); }); },
  };

  // Server slots (server/moo-saves.py, when the game is hosted with it). Browser-only and async: every call returns a Promise and
  // rejects with an Error whose message can be shown to the player. Saves travel gzipped when the browser can (CompressionStream).
  //   Server.probe() -> Promise<bool>   Server.list() -> [{slot, meta}]   Server.save(slot, S)   Server.load(slot) -> S   Server.remove(slot)
  const API = 'api/';                                     // relative: works when the game is hosted under a sub-path
  let probed = null, failedAt = 0;
  const hosted = () => typeof fetch === 'function' && typeof location !== 'undefined' && /^https?:$/.test(location.protocol);
  async function call(path, opts) {
    let res;
    try { res = await fetch(API + path, Object.assign({ credentials: 'same-origin', cache: 'no-store' }, opts)); } catch (e) { throw new Error('The save server could not be reached.'); }
    if (res.status === 401) throw new Error('Your login has expired. Reload the page and enter the password again.');
    if (!res.ok) { let msg = ''; try { msg = (await res.json()).error || ''; } catch (e) { /* not JSON */ } throw new Error('The save server refused (' + res.status + (msg ? ': ' + msg : '') + ').'); }
    return res;
  }
  const streamBytes = (data, tx) => new Response(new Blob([data]).stream().pipeThrough(tx)).arrayBuffer();
  M.Save.Server = {
    SLOTS: ['1', '2', '3', '4', '5', '6'],
    probe() {
      if (!hosted()) return Promise.resolve(false);
      if (probed && !(failedAt && Date.now() - failedAt > 30000)) return probed;      // a failed probe is retried after 30 s
      failedAt = 0;
      probed = fetch(API + 'status', { credentials: 'same-origin', cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null)).then(j => !!(j && j.saves)).catch(() => false)
        .then(ok => { if (!ok) failedAt = Date.now(); return ok; });
      return probed;
    },
    async list() {
      const j = await (await call('saves')).json();
      const by = {};
      (j.saves || []).forEach(s => { by[s.slot] = s.meta || {}; });
      return M.Save.Server.SLOTS.map(slot => ({ slot, meta: by[slot] || null }));
    },
    async save(slot, S) {
      const text = serialize(S), gz = typeof CompressionStream === 'function';     // serialise now: S keeps changing while we compress
      const body = gz ? await streamBytes(text, new CompressionStream('gzip')) : text;
      await call('saves/' + encodeURIComponent(slot), {
        method: 'PUT', body,
        headers: { 'Content-Type': 'application/octet-stream', 'X-Requested-With': 'moo', 'X-Save-Encoding': gz ? 'gzip' : 'identity', 'X-Save-Meta': encodeURIComponent(JSON.stringify(meta(S))) },
      });
      return true;
    },
    async load(slot) {
      const res = await call('saves/' + encodeURIComponent(slot));
      const buf = await res.arrayBuffer();
      let text;
      if (res.headers.get('X-Save-Encoding') === 'gzip') {
        if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot unpack server saves (it is too old).');
        text = new TextDecoder().decode(await streamBytes(buf, new DecompressionStream('gzip')));
      } else text = new TextDecoder().decode(buf);
      return deserialize(text);
    },
    async remove(slot) { await call('saves/' + encodeURIComponent(slot), { method: 'DELETE', headers: { 'X-Requested-With': 'moo' } }); return true; },
  };
})(window.MOO);

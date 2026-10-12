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

  function meta(S) {
    const me = S.empires && S.empires[S.playerId];
    return {
      turn: S.turn, year: S.year, race: me && me.race, leader: me && me.leader, color: me && me.color,
      size: S.settings && S.settings.size, difficulty: S.settings && S.settings.difficulty, stars: S.stars ? S.stars.length : 0,
      planets: S.planets ? S.planets.filter(p => p.owner === S.playerId).length : 0, at: Date.now(),
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
})(window.MOO);

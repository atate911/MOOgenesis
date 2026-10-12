// MOO.Game — the main-thread controller. Owns the game state S, applies orders, saves/loads, and drives the turn generator
// (Sim.Turn.run) answering its interrupts: UI handlers if installed, otherwise automatic defaults (so the same pipeline runs headless / in dev).
//   Game.S · Game.newGame(settings) · Game.order(o) · Game.endTurn() · Game.handlers.<interruptType> = async (it, S) => answer
(function (M) {
  'use strict';
  const G = M.Game = { S: null, sel: { star: -1, fleet: -1 }, busy: false, handlers: {}, last: null };
  const Sim = M.Sim;

  G.hasGame = () => !!G.S;
  G.player = () => (G.S ? G.S.empires[G.S.playerId] : null);
  G.displayYear = () => (G.S ? M.Data.Config.displayYear(G.S) : 0);
  G.changed = () => M.Bus.emit('state');

  G.newGame = async function (settings) {
    const st = Object.assign({}, settings);
    if (!st.seed) st.seed = String(Date.now());
    await new Promise(r => setTimeout(r, 30));                     // let the loading overlay paint
    G.S = Sim.Setup.create(st);
    const me = G.player();
    G.sel = { star: me.capital, fleet: -1 };
    G.history = [];
    M.Bus.emit('game:new', G.S);
    if (M.Settings && M.Settings.get('autosave')) G.autosave();
    return G.S;
  };

  G.order = function (o) {
    if (!G.S) return { ok: false, msg: 'no game' };
    const r = Sim.Orders.apply(G.S, G.S.playerId, o);
    if (r.ok) { Sim.Econ.refresh(G.S); M.Bus.emit('state', o); }
    return r;
  };

  // ---- persistence --------------------------------------------------------------------------------------------------------------
  G.saveSlot = slot => { if (!G.S) return false; const ok = M.Save.save(slot, G.S); if (ok) M.Bus.emit('saved', slot); return ok; };
  G.autosave = () => G.saveSlot('auto');
  G.loadSlot = function (slot) {
    const S = M.Save.load(slot); if (!S) return false;
    G.S = S; G.sel = { star: G.player().capital, fleet: -1 };
    Sim.Fleet.updateRange(S); Sim.Vis.update(S); Sim.Econ.refresh(S);
    M.Bus.emit('game:loaded', S);
    if (M.UI && M.UI.Screens && M.UI.Screens.has('galaxy')) M.UI.Screens.go('galaxy');
    return true;
  };
  G.quitToMenu = function () { if (G.S && M.Settings.get('autosave')) G.autosave(); G.S = null; M.Bus.emit('game:quit'); if (M.UI && M.UI.Screens) M.UI.Screens.go('menu'); };

  // ---- parallel helpers -----------------------------------------------------------------------------------------------------------
  async function planAI(S) {
    const ids = S.empires.filter(e => e.alive && !e.human).map(e => e.id);
    const out = {};
    if (!ids.length || !(M.AI && M.AI.plan)) return out;
    M.Workers.setSnapshot(S);
    const res = await M.Workers.map('aiPlan', ids.map(id => ({ empire: id, seed: M.AI.seedFor(S, id) })), { snap: true });
    ids.forEach((id, i) => { out[id] = res[i]; });
    return out;
  }
  async function resolveBattles(S, battles) {
    // human battles are handled by the UI handler (tactical or auto); everything else is resolved in parallel on the worker pool
    const results = new Array(battles.length);
    const jobs = [];
    for (let i = 0; i < battles.length; i++) {
      const b = battles[i];
      const humanInvolved = b.sides && b.sides.some(s => S.empires[s.empire] && S.empires[s.empire].human);
      if (humanInvolved && G.handlers.battle) results[i] = await G.handlers.battle(b, S);
      else jobs.push(i);
    }
    if (jobs.length) {
      const rs = await M.Workers.map('resolveBattle', jobs.map(i => ({ battle: battles[i], seed: S.seed + ':' + S.turn + ':' + battles[i].star })));
      jobs.forEach((i, k) => { results[i] = rs[k]; });
    }
    return { results };
  }

  // ---- the turn driver --------------------------------------------------------------------------------------------------------------
  const DEFAULTS = {
    aiPlan: (it, S) => planAI(S),
    battles: (it, S) => resolveBattles(S, it.battles),
    colonize: () => true,
    techChoice: it => (it.choices[0] ? it.choices[0].level : 0),
    council: (it, S) => (Sim.Council && Sim.Council.autoVote ? Sim.Council.autoVote(S, it.info) : 0),
  };
  G.endTurn = async function () {
    if (!G.S || G.busy) return null;
    G.busy = true; M.Bus.emit('turn:processing', true);
    const S = G.S, t0 = performance.now(), seen = [];
    let over = null;
    try {
      const gen = Sim.Turn.run(S);
      let r = gen.next();
      while (!r.done) {
        const it = r.value, h = G.handlers[it.type] || DEFAULTS[it.type];
        let ans;
        const wd = setTimeout(() => { console.warn('[turn] still waiting on the "' + it.type + '" interrupt after 10 s', it); M.Bus.emit('turn:waiting', it.type); }, 10000);   // diagnostic: a handler that never answers is what freezes a turn
        try { ans = h ? await h(it, S) : undefined; } catch (e) { console.error('[interrupt ' + it.type + ']', e); ans = undefined; }
        clearTimeout(wd);
        seen.push(it.type);
        r = gen.next(ans);
      }
      over = r.value || null;
    } finally {
      G.busy = false;
      G.last = { ms: performance.now() - t0, interrupts: seen, over };
      if (M.Settings.get('autosave')) G.autosave();
      M.Bus.emit('turn:processing', false); M.Bus.emit('turn:end', S, G.last); M.Bus.emit('state');
    }
    return G.last;
  };

  // development entry: ?dev=1&screen=galaxy&size=medium&opp=3&race=psilon&seed=abc
  G.devBoot = function (q) {
    if (G.S) return;
    G.S = Sim.Setup.create({ size: q.get('size') || 'medium', difficulty: q.get('diff') || 'average', opponents: +(q.get('opp') || 3), race: q.get('race') || 'human', banner: +(q.get('banner') || 0), seed: q.get('seed') || 'dev', playerAI: q.get('ai') === '1' });
    G.sel = { star: G.player().capital, fleet: -1 };
    const n = +(q.get('turns') || 0);
    if (n > 0) { try { Sim.autoPlay(G.S, n); } catch (e) { console.error('[devBoot autoplay]', e); } }
  };
})(window.MOO);

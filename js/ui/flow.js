// UI flow: answers the turn pipeline's interrupts (Game.handlers.*) with cards in the side panel, scenes and screens.
// Feature modules (written by other agents) plug in by exposing MOO.UI.<Name>.show(interrupt) → Promise; this file falls back to simple built-ins.
(function (M) {
  'use strict';
  const UI = M.UI, h = UI.h, G = M.Game, Q = M.Sim.Q;
  const Flow = UI.Flow = {};

  // show a card in the side panel and wait for a button; always returns the panel to the default selection afterwards
  Flow.card = function (opts) {
    return new Promise(resolve => {
      if (UI.Screens.current && UI.Screens.current.id !== 'galaxy') UI.Screens.go('galaxy');
      const done = v => { resolve(v); setTimeout(() => UI.Galaxy.showDefault(), 0); };
      if (opts.star !== undefined && UI.Galaxy.map) UI.Galaxy.map.centerOn(opts.star, { animate: true });
      UI.Side.show('card', Object.assign({}, opts, { resolve: done }));
    });
  };
  const planetOf = (S, id) => Q.planetCard(S, id);

  function install() {
    const H = G.handlers;

    H.explore = async it => {
      const S = G.S, c = planetOf(S, it.star), flags = [];
      if (c.growth === 'hostile') flags.push({ head: 'Hostile environment.', text: 'Population growth is halved.' });
      if (c.special === 'rich' || c.special === 'ultrarich') flags.push({ head: c.specialLabel + '.', text: 'Production from industry is ' + (c.special === 'rich' ? 'doubled' : 'tripled') + '.', good: true });
      if (c.special === 'poor' || c.special === 'ultrapoor') flags.push({ head: c.specialLabel + '.', text: 'Production from industry is ' + (c.special === 'poor' ? 'halved' : 'cut to a third') + '.' });
      if (c.special === 'artifacts') flags.push({ head: 'Ancient artifacts.', text: 'Research on this world is doubled.', good: true });
      if (c.special === 'orion') flags.push({ head: 'Orion!', text: 'The throne-world of the Ancients — research here is quadrupled.', good: true });
      UI.sfx('scan');
      await Flow.card({ star: it.star, ownerId: S.planets[it.star].owner, planetCard: c, title: 'Scout ships explore a new star system', body: [], flags });
    };

    H.colonize = async it => {
      const S = G.S, c = planetOf(S, it.planet);
      const ans = await Flow.card({ star: it.planet, planetCard: c, title: 'Build a new colony?', body: [], buttons: [{ label: 'No', value: false, kbd: 'N' }, { label: 'Yes', value: true, primary: true, kbd: 'Y' }] });
      if (ans) {
        UI.sfx('colonize');
        if (UI.Landing && UI.Landing.colony && M.Settings.get('animSpeed') > 0) { try { await UI.Landing.colony(it.planet); } catch (e) { console.warn('[landing]', e); } }   // the colony-ship landing vignette
      }
      return !!ans;
    };

    H.notice = async it => {
      const S = G.S, e = it; let text = null;
      const name = e.planet !== undefined ? S.planets[e.planet].name : '';
      if (e.kind === 'industryMax') text = name + ' has reached its industry maximum of ' + e.factories + ' factories. The extra spending went to the planetary reserve.';
      else if (e.kind === 'outOfFuel') text = 'Ships ran out of fuel at ' + S.stars[e.star].name + ' and were lost.';
      else if (e.kind === 'transportLost') text = 'Transports with ' + e.n + ' million colonists were lost at ' + name + '.';
      if (text) UI.Galaxy.message(text, 'bad');
    };

    H.built = async it => {
      const S = G.S, E = G.player();
      for (const b of it.items.slice(0, 5)) UI.Galaxy.message(b.count + ' × ' + (E.designs[b.design] ? E.designs[b.design].name : 'ship') + ' completed at ' + S.planets[b.planet].name, 'ok');
      UI.sfx('shipbuilt');
    };

    H.techChoice = async it => {
      if (UI.TechScenes && UI.TechScenes.choose) return UI.TechScenes.choose(it);
      return new Promise(res => {
        const rows = it.choices.map(c => UI.button((c.tech ? c.tech.name : 'Level ' + c.level) + ' — ' + M.Util.fmt(c.cost) + ' RP', () => pr.close(c.level), { block: true }));
        const pr = UI.modal({ title: 'Choose the next ' + Q.FIELD_NAMES[it.field] + ' research', body: h('div.col', rows), buttons: [], closable: false, width: '28rem' });
        pr.then(v => res(v));
      });
    };
    H.tech = async it => {
      if (UI.TechScenes && UI.TechScenes.breakthrough) return UI.TechScenes.breakthrough(it);
      const t = M.Sim.Research.techAt(it.field, it.level);
      UI.sfx('tech'); UI.Galaxy.message(G.player().plural + ' scientists achieve a ' + Q.FIELD_NAMES[it.field].toLowerCase() + ' breakthrough: ' + (t ? t.name : 'level ' + it.level), 'ok');
    };

    H.gnn = async it => { if (UI.GNN && UI.GNN.show) return UI.GNN.show(it); (it.items || []).slice(0, 3).forEach(i => UI.Galaxy.message(i.headline)); };
    H.council = async it => { if (UI.Council && UI.Council.show) return UI.Council.show(it); return M.Sim.Council && M.Sim.Council.autoVote ? M.Sim.Council.autoVote(G.S, it.info) : 0; };
    H.councilResult = async it => { if (UI.Council && UI.Council.result) return UI.Council.result(it); };
    H.diplomacy = async it => { if (UI.Audience && UI.Audience.show) return UI.Audience.show(it); };
    H.ground = async it => { if (UI.Ground && UI.Ground.show) return UI.Ground.show(it); };
    H.bombardPrompt = async it => { if (UI.Ground && UI.Ground.bombardPrompt) return UI.Ground.bombardPrompt({ planet: it.planet, preview: it.preview }); return true; };     // "Bomb?" → true/false
    H.bombard = async it => { if (UI.Ground && UI.Ground.bombardResult) return UI.Ground.bombardResult(it); };
    H.event = async it => { if (UI.Events && UI.Events.show) return UI.Events.show(it); if (it.text) UI.Galaxy.message(it.text); };
    H.spyStealChoice = async it => { if (UI.Spy && UI.Spy.steal) return UI.Spy.steal(it); return 0; };
    H.battle = async (b, S) => { if (UI.Combat && UI.Combat.fight) return UI.Combat.fight(b, S); return M.Sim.Combat.resolve(b, M.RNG.create(S.seed + ':' + S.turn + ':' + b.star)); };
    H.gameover = async it => { if (UI.Endings && UI.Endings.show) return UI.Endings.show(it); await UI.alert('The game is over: ' + it.reason + '.', { title: 'Game over' }); UI.Screens.go('menu'); };
  }
  M.Bus.on('game:new', install);
  M.Bus.on('game:loaded', install);
  install();
})(window.MOO);

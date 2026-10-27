// UI flow: answers the turn pipeline's interrupts (Game.handlers.*) with cards in the side panel, scenes and screens.
// Feature modules (written by other agents) plug in by exposing MOO.UI.<Name>.show(interrupt) → Promise; this file falls back to simple built-ins.
(function (M) {
  'use strict';
  const UI = M.UI, h = UI.h, G = M.Game, Q = M.Sim.Q;
  const Flow = UI.Flow = {};

  // show a card in the side panel and wait for a button; always returns the panel to the default selection afterwards
  // The card is the turn's pending question: UI.Side.hold keeps it on screen (re-shown on enter(), never replaced) until it is answered.
  Flow.card = function (opts) {
    return new Promise(resolve => {
      const params = Object.assign({}, opts);
      let settled = false, hd = null;
      const done = v => { if (settled) return; settled = true; UI.Side.release(hd); resolve(v); setTimeout(() => { if (!UI.Side.held) UI.Galaxy.showDefault(); }, 0); };
      params.resolve = done;
      hd = UI.Side.hold('card', params, () => done(undefined));
    });
  };
  const planetOf = (S, id) => Q.planetCard(S, id);
  // GNN in brief: the turn's headlines as one list in a modal, Space/Enter continues (the archive keeps every item; the studio scene is Options › Interface › News)
  Flow.newsBrief = function (it) {
    const items = (it.items || []).slice(0, 14);
    const rows = items.map(i => h('li.nb-item', h('b', i.headline || ''), i.sub ? h('span.dim', ' — ' + i.sub) : null));
    const body = h('div', h('div.dim.small', 'GNN · ' + (it.year !== undefined ? 'Year ' + it.year : 'This year')), h('ul.nb-list', rows), (it.items || []).length > items.length ? h('div.dim.small', (it.items.length - items.length) + ' more in the archive') : null);
    const pr = UI.modal({ title: 'Galactic News Network', body, buttons: [{ label: 'Continue', value: true, primary: true }], closable: true, width: '34rem', onOpen: m => { const b = m.querySelector('.btn.primary'); if (b) UI.attention(b); } });
    return pr.then(() => ({ skipped: false, shown: items.length, brief: true }));
  };
  UI.css && UI.css('flow-brief', `.nb-list { margin:.6rem 0 0; padding-left:1.1rem; } .nb-item { margin:.25rem 0; line-height:1.35; }`);

  function install() {
    const H = G.handlers;

    H.explore = async it => {
      const S = G.S, c = planetOf(S, it.star), flags = [];
      if (c.growth === 'hostile') flags.push({ head: 'Hostile environment.', text: 'Population growth is halved.' });
      if (c.special === 'rich' || c.special === 'ultrarich') flags.push({ head: c.specialLabel + '.', text: 'Production from industry is ' + (c.special === 'rich' ? 'doubled' : 'tripled') + '.', good: true });
      if (c.special === 'poor' || c.special === 'ultrapoor') flags.push({ head: c.specialLabel + '.', text: 'Production from industry is ' + (c.special === 'poor' ? 'halved' : 'cut to a third') + '.' });
      if (c.special === 'artifacts') flags.push({ head: 'Ancient artifacts.', text: 'Research on this world is doubled.', good: true });
      if (c.special === 'orion') flags.push({ head: 'Orion!', text: 'The throne-world of the Ancients — research here is quadrupled.', good: true });
      UI.sfx('discover');
      await Flow.card({ star: it.star, ownerId: S.planets[it.star].owner, planetCard: c, title: 'Scout ships explore a new star system', body: [], flags });
    };

    H.colonize = async it => {
      const S = G.S, c = planetOf(S, it.planet);
      const ans = await Flow.card({ star: it.planet, planetCard: c, scene: 'first-landing', title: 'Build a new colony?', body: [], buttons: [{ label: 'No', value: false, kbd: 'N' }, { label: 'Yes', value: true, primary: true, kbd: 'Y' }] });
      if (ans) {
        UI.sfx('colonize');
        if (UI.Landing && UI.Landing.colony && M.Settings.get('animSpeed') > 0 && M.Settings.get('landingScenes') !== false) { try { await UI.Landing.colony(it.planet); } catch (e) { console.warn('[landing]', e); } }   // the colony-ship landing vignette (Options › Gameplay)
      }
      return !!ans;
    };

    // End-of-turn planet notices (research/05 §11.5): the original showed each as a box on the map with the colony's sliders live underneath, so the
    // ratios could be re-adjusted at once. Here they are turn reports that stay until the next turn and select the colony when clicked.
    const ROMAN = { 5: 'V', 10: 'X', 15: 'XV', 20: 'XX' };
    H.notice = async it => {
      const S = G.S, e = it; let text = null, kind = 'bad';
      const p = e.planet !== undefined && e.planet >= 0 ? S.planets[e.planet] : null, name = p ? (p.name || S.stars[p.starId].name) : '';
      if (e.kind === 'industryMax') { text = name + ' has reached its industry maximum of ' + e.factories + ' factories. The surplus went to the reserve; its Ind share moves to Tech — the spending ratios may be changed now.'; kind = 'ok'; }
      else if (e.kind === 'popMax') { text = name + ' has reached its population maximum of ' + e.pop + ' million. Its Eco surplus moves to Tech — the spending ratios may be changed now.'; kind = 'ok'; }
      else if (e.kind === 'ecoDone') { text = name + ' has terraformed to a ' + (e.growth === 'gaia' ? 'Gaia' : 'fertile') + ' environment with ' + (e.growth === 'gaia' ? 'double' : 'half again') + ' the standard growth.'; kind = 'ok'; }
      else if (e.kind === 'atmosDone') { text = name + ' has terraformed to a standard atmosphere: its environment is no longer hostile.'; kind = 'ok'; }
      else if (e.kind === 'shieldDone') { text = name + ' has finished a Class ' + (ROMAN[e.shield] || e.shield) + ' planetary shield.'; kind = 'ok'; }
      else if (e.kind === 'stargate') { text = name + ' has finished a stargate. Ships sent between stargates arrive the next turn.'; kind = 'ok'; }
      else if (e.kind === 'outOfFuel') text = 'Ships ran out of fuel at ' + S.stars[e.star].name + ' and were lost.';
      else if (e.kind === 'transportLost') text = 'Transports with ' + e.n + ' million colonists were lost at ' + name + '.';
      else if (e.kind === 'salvage') { text = 'Salvage crews recover ' + e.bc + ' BC from the wrecks at ' + (S.stars[e.star] ? S.stars[e.star].name : 'the battlefield') + '.'; kind = 'ok'; }
      else if (e.kind === 'evacuated') { const fp = S.planets[e.from]; text = e.n + ' million colonists escaped from ' + (fp ? (fp.name || S.stars[fp.starId].name) : 'a lost colony') + ' to ' + name + '.'; kind = 'ok'; }
      else if (e.kind === 'contactLost') text = 'Contact with the ' + (e.other !== undefined && S.empires[e.other] ? S.empires[e.other].plural : 'other empire') + ' has been lost: no colony of theirs is within range any more.';
      if (text) UI.Galaxy.message(text, kind, { star: p ? p.starId : (e.star !== undefined ? e.star : -1), sticky: true });
    };

    // the original's "Fleet Production" report: one line per planet that finished ships this year (click = that colony)
    H.built = async it => {
      const S = G.S, E = G.player(), by = {};
      for (const b of it.items) { const k = b.planet; (by[k] = by[k] || []).push(b.count + ' × ' + (E.designs[b.design] ? E.designs[b.design].name : 'ship')); }
      const planets = Object.keys(by);
      for (const k of planets.slice(0, 5)) UI.Galaxy.message(by[k].join(', ') + ' completed at ' + (S.planets[k].name || S.stars[S.planets[k].starId].name), 'ok', { star: S.planets[k].starId, sticky: true });
      if (planets.length > 5) UI.Galaxy.message('… and ships at ' + (planets.length - 5) + ' more ' + (planets.length - 5 === 1 ? 'colony' : 'colonies') + ' (see Fleet)', 'ok', { sticky: true });
      UI.sfx('shipbuilt');
    };

    H.techChoice = async it => {
      if (UI.TechScenes && UI.TechScenes.choose) {
        const v = await UI.TechScenes.choose(it);
        if (!v && it.choices[0]) { const c = it.choices[0]; UI.Galaxy.message('No ' + Q.FIELD_NAMES[it.field].toLowerCase() + ' project chosen: the scientists start on ' + (c.tech ? c.tech.name : 'level ' + c.level) + '.'); }
        return v;
      }
      return new Promise(res => {
        const rows = it.choices.map(c => UI.button((c.tech ? c.tech.name : 'Level ' + c.level) + ' — ' + M.Util.fmt(c.cost) + ' RP', () => pr.close(c.level), { block: true }));
        const pr = UI.modal({ title: 'Choose the next ' + Q.FIELD_NAMES[it.field] + ' research', body: h('div.col', rows), buttons: [], closable: false, width: '28rem', choices: '.btn' });
        pr.then(v => res(v));
      });
    };
    H.tech = async it => {
      if (UI.TechScenes && UI.TechScenes.breakthrough) return UI.TechScenes.breakthrough(it);
      const t = M.Sim.Research.techAt(it.field, it.level);
      UI.sfx('tech'); UI.Galaxy.message(G.player().plural + ' scientists achieve a ' + Q.FIELD_NAMES[it.field].toLowerCase() + ' breakthrough: ' + (t ? t.name : 'level ' + it.level), 'ok');
    };

    H.gnn = async it => {
      if ((M.Settings.get('newsMode') === 'brief' || (M.Phone && M.Phone.active())) && it && it.items && it.items.length) return Flow.newsBrief(it);        // one page, one Continue (Options › Interface)
      if (UI.GNN && UI.GNN.show) return UI.GNN.show(it); (it.items || []).slice(0, 3).forEach(i => UI.Galaxy.message(i.headline));
    };
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

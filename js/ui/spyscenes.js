// Espionage scenes (research/06 §5.18, research/05 §5): the steal panel, the sabotage panel, victim notices and the Spies-Caught table.
//
//   MOO.UI.Spy.steal(it)        -> Promise<pick>   it = {type:'spyStealChoice', candidates:[{field,fieldName,level,id,name,desc}], target, race, n, cap, anyCaught, frame, frameChoices, answer(pick)}
//                                                  Six field buttons (only fields where they hold something you lack), the tech each would give, Esc aborts. Calls it.answer(pick) itself
//                                                  (turn.js does not), then plays the lab scene (UI.TechScenes.breakthrough) for the stolen tech. Resolves with the pick (candidate index | {index, frame} | null).
//   MOO.UI.Spy.sabotage(it)     -> Promise<pick>   it = {type:'spySabotageChoice', planets:[{planet,name,pop,factories,bases,unrest,canIncite}], units, n, frame, frameChoices, answer(pick)}
//                                                  pick a colony, then Destroy factories / Destroy missile bases / Incite revolt; result card. Resolves with {planet, action[, frame]} | null.
//   MOO.UI.Spy.victimNotice(ev) -> Promise         ev = {type:'notice', kind:'techStolen'|'sabotage'|'spiesCaught'|'spiesLost'|'spyNothing', by, …}
//   MOO.UI.Spy.caught()         -> Promise         the "Spies Caught  Yours / Theirs" table (Sim.Spy.reports). Key C is taken on the galaxy screen: ask the lead to bind another key / the Races screen.
// This module also wires Game.handlers.spySabotageChoice and the spy notices (guarded; flow.js may route them itself later).
(function (M) {
  'use strict';
  const UI = M.UI, h = UI.h, G = M.Game, doc = document;
  const Spy = (UI.Spy = {});
  const FIELDS = [
    { name: 'Computers', icon: 'computers', col: '#62d8ff' }, { name: 'Construction', icon: 'construction', col: '#ffb04a' }, { name: 'Force Fields', icon: 'forcefield', col: '#a98bff' },
    { name: 'Planetology', icon: 'planetology', col: '#5fdc8f' }, { name: 'Propulsion', icon: 'propulsion', col: '#5b8cff' }, { name: 'Weapons', icon: 'weapons', col: '#ff7a86' }];
  const emp = id => (G.S && G.S.empires[id]) || null;
  const bannerHex = e => { try { return getComputedStyle(doc.documentElement).getPropertyValue('--emp' + (e ? e.color : 0)).trim() || '#d6b36a'; } catch (er) { return '#d6b36a'; } };
  const nm = id => { const e = emp(id); return e ? e.name : 'Unknown'; };
  const who = (e, text) => h('b', { style: { color: bannerHex(e) } }, text);
  let opened = 0;
  // music: the panels play the 'spy' track (if the soundtrack has it) and hand back whatever was playing afterwards
  function spyMusicStart() {
    try {
      const Mu = M.Audio && M.Audio.Music; if (!Mu || !Mu.play || !Mu.has || !Mu.has('spy') || !spyMusicStart.enabled) return null;
      const snap = Mu.snapshot ? Mu.snapshot() : { id: Mu.current ? Mu.current() : null };
      if (snap && snap.id === 'spy') return null;
      Mu.play('spy', { fade: 0.8 });
      return snap || { id: null };
    } catch (e) { return null; }
  }
  spyMusicStart.enabled = false;        // off: the panels play their stingers over the underscore (set true to borrow the 'spy' cue again)
  function spyMusicEnd(snap) {
    try {
      const Mu = M.Audio && M.Audio.Music; if (!Mu || !snap || !Mu.current || Mu.current() !== 'spy') return;
      if (Mu.restore) Mu.restore(snap, { fade: 1.2 }); else if (snap.id) Mu.play(snap.id, { fade: 1.2 }); else if (Mu.stop) Mu.stop({ fade: 1.2 });
    } catch (e) { /* audio is optional */ }
  }

  UI.css('spyscenes', `
    .spy-hd { display:flex; align-items:center; gap:.8rem; margin-bottom:.7rem; }
    .spy-hd .race { font:400 1.7rem/1 var(--font-title); letter-spacing:.08em; text-transform:uppercase; color:var(--brass-hi); }
    .spy-hd small { display:block; margin-top:.2rem; font:400 .9rem var(--font-ui); color:var(--mist); letter-spacing:0; text-transform:none; }
    .spy-grid { display:grid; grid-template-columns:1fr 1fr; gap:.55rem; }
    .spy-fld { --c:var(--cyan); display:flex; align-items:center; gap:.65rem; padding:.55rem .75rem; text-align:left; cursor:pointer; color:var(--ivory); background:rgba(255,255,255,.04); border:1px solid color-mix(in srgb, var(--c) 55%, #000); font:inherit; }
    .spy-fld:hover, .spy-fld:focus-visible { background:color-mix(in srgb, var(--c) 18%, transparent); outline:none; box-shadow:0 0 14px color-mix(in srgb, var(--c) 35%, transparent); }
    .spy-fld .ico { width:1.7rem; height:1.7rem; color:var(--c); flex:none; }
    .spy-fld .t b { display:block; font:400 1.1rem/1.1 var(--font-display); color:var(--c); letter-spacing:.03em; }
    .spy-fld .t small { display:block; margin-top:.12rem; font:400 .85rem var(--font-ui); color:var(--mist); }
    .spy-fld.off { opacity:.4; cursor:default; filter:grayscale(.8); }
    .spy-info { min-height:4.2rem; margin-top:.7rem; padding:.55rem .75rem; background:rgba(0,0,0,.25); border-left:3px solid var(--brass); font-size:.95rem; line-height:1.35; }
    .spy-info b { color:var(--brass-hi); font-family:var(--font-display); font-weight:400; }
    .spy-warn { margin-top:.6rem; color:var(--ember); font-size:.9rem; }
    .spy-rows { max-height:46vh; overflow:auto; }
    .spy-act { display:flex; gap:.6rem; flex-wrap:wrap; margin-top:.8rem; }
    .spy-boom { position:relative; width:7rem; height:7rem; margin:0 auto .6rem; }
    .spy-boom i { position:absolute; inset:0; border-radius:50%; background:radial-gradient(circle, #fff6c8 0, #ffb040 30%, rgba(255,90,30,.6) 55%, rgba(255,60,20,0) 72%); animation:spy-boom 1.1s ease-out both; }
    .spy-boom i:nth-child(2) { animation-delay:.25s; opacity:.7; } .spy-boom i:nth-child(3) { animation-delay:.5s; opacity:.5; }
    @keyframes spy-boom { from { transform:scale(.1); opacity:1; } to { transform:scale(1.25); opacity:0; } }
  `);

  // keys while a modal is open (capture phase, like the tech follow-up dialogs)
  function modalKeys(map, close) {
    const on = e => {
      const f = map[e.key.toLowerCase()];
      if (!f) return;
      e.preventDefault(); e.stopPropagation(); f(close);
    };
    window.addEventListener('keydown', on, true);
    return () => window.removeEventListener('keydown', on, true);
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function askFrame(it) {                                         // second dialog: whom do you blame?
    const fc = it.frameChoices || [];
    let pm;
    const body = h('div', h('p', 'Your agents left a trail. Whom should the victim blame?'),
      h('div.col', fc.map(c => UI.button('Frame the ' + c.name, () => pm.close(c.empire), { block: true })), UI.button('Take no risks — blame no one', () => pm.close(-1), { block: true })));
    pm = UI.modal({ title: 'Frame a rival?', body, buttons: [], closable: true, width: '26rem' });
    return pm.then(v => (typeof v === 'number' && v >= 0 ? v : -1));
  }
  function techEventsOf(it, g) {                                  // the 'tech' event queued by Research.grant for this theft: play it now instead of later
    const S = G.S; if (!S || !M.Sim.Ev || !g) return [];
    return M.Sim.Ev.take(S, e => e.type === 'tech' && e.empire === it.empire && e.source === 'spy' && e.field === g.field && e.level === g.level);
  }

  // ---------------------------------------------------------------------------------------------------- steal
  Spy.steal = async function (it) {
    const T = emp(it.target), cands = it.candidates || [];
    opened++;
    const snap = spyMusicStart();
    let pick = null;
    try {
      const idx = await new Promise(resolve => {
        let pm, off = null;
        const info = h('div.spy-info', 'Choose the field to steal from. Hover a field to read what the plans contain.');
        const show = i => { const c = cands[i]; UI.clear(info); info.appendChild(h('div', h('b', c.name), ' — level ' + c.level + ' ' + c.fieldName)); info.appendChild(h('div', c.desc || '')); };
        const btns = FIELDS.map((F, f) => {
          const ci = cands.findIndex(c => c.field === f), c = ci >= 0 ? cands[ci] : null;
          return h('button.spy-fld' + (c ? '' : '.off'), { type: 'button', disabled: !c, style: { '--c': F.col }, onmouseenter: () => c && show(ci), onfocus: () => c && show(ci), onclick: () => { if (c) { UI.sfx('confirm'); pm.close(ci); } } },
            UI.icon(F.icon), h('span.t', h('b', F.name), h('small', c ? c.name + ' · level ' + c.level : 'nothing to steal')));
        });
        const body = h('div', h('div.spy-hd', h('div', h('div.race', T ? T.name : it.race), h('small', 'Your ' + it.n + (it.n === 1 ? ' spy steals' : ' spies steal') + ' the plans for:'))), h('div.spy-grid', btns), info,
          it.anyCaught ? h('div.spy-warn', 'One of your agents was spotted — they may learn who is behind this.') : null);
        pm = UI.modal({ title: 'Espionage', body, buttons: [{ label: 'Abort mission', value: null }], closable: true, width: '38rem', onOpen: () => { off = modalKeys({}, null); }, onClose: () => { if (off) off(); } });
        pm.then(v => resolve(typeof v === 'number' ? v : null));
      });
      if (idx === null || idx === undefined) pick = null;
      else if (it.frame && it.frameChoices && it.frameChoices.length >= 2) { const fr = await askFrame(it); pick = fr >= 0 ? { index: idx, frame: fr } : idx; }
      else pick = idx;
      let res = null;
      if (typeof it.answer === 'function') { try { res = it.answer(pick); } catch (e) { console.error('[spy] answer failed', e); } } else res = it.result || null;
      const g = res && res.granted;
      if (g && UI.TechScenes && UI.TechScenes.breakthrough) { for (const ev of techEventsOf(it, g)) { try { await UI.TechScenes.breakthrough(ev); } catch (e) { console.error(e); } } }
      if (res && !res.aborted && (res.blamed >= 0 || res.framed >= 0)) UI.toast(res.framed >= 0 ? nm(res.framed) + ' will be blamed for the theft.' : nm(it.target) + ' knows your agents were behind it.', 'warn', 5200);
    } catch (e) { console.error('[spy] steal failed', e); }
    spyMusicEnd(snap);
    return pick;
  };

  // ---------------------------------------------------------------------------------------------------- sabotage
  Spy.sabotage = async function (it) {
    const T = emp(it.target), planets = it.planets || [];
    opened++;
    const snap = spyMusicStart();
    let pick = null;
    try {
      const choice = await new Promise(resolve => {
        let pm, sel = planets.length ? planets.slice().sort((a, b) => b.factories - a.factories)[0].planet : -1;
        const rows = h('div.spy-rows'), acts = h('div.spy-act');
        const cur = () => planets.find(p => p.planet === sel);
        const go = action => { const p = cur(); if (!p) return; if (action === 'revolt' && !p.canIncite) return; UI.sfx('confirm'); pm.close({ planet: p.planet, action }); };
        function draw() {
          UI.mount(rows, UI.table([{ key: 'name', label: 'Colony' }, { key: 'pop', label: 'Pop', align: 'r' }, { key: 'factories', label: 'Factories', align: 'r' }, { key: 'bases', label: 'Missile bases', align: 'r' },
            { key: 'unrest', label: 'Mood', fmt: r => (r.unrest === 2 ? 'Rebelling' : r.unrest === 1 ? 'Unrest' : 'Calm') }], planets, { onRow: r => { sel = r.planet; draw(); }, selected: r => r.planet === sel }));
          const p = cur();
          UI.mount(acts, UI.button('Destroy factories', () => go('factories'), { kbd: 'F', disabled: !p || !p.factories }), UI.button('Destroy missile bases', () => go('bases'), { kbd: 'B', disabled: !p || !p.bases }),
            UI.button('Incite revolt', () => go('revolt'), { kbd: 'I', disabled: !p || !p.canIncite, tip: 'Only on colonies that are not already unstable' }));
        }
        draw();
        const body = h('div', h('div.spy-hd', h('div', h('div.race', T ? T.name : it.race), h('small', 'Your ' + it.n + (it.n === 1 ? ' saboteur is' : ' saboteurs are') + ' inside — sabotage strength ' + it.units + '. Pick a colony, then the damage.'))), rows, acts,
          it.anyCaught ? h('div.spy-warn', 'One of your agents was spotted — they may learn who is behind this.') : null);
        let off = null;
        pm = UI.modal({ title: 'Sabotage', body, buttons: [{ label: 'Abort mission', value: null }], closable: true, width: '44rem', onOpen: () => { off = modalKeys({ f: () => go('factories'), b: () => go('bases'), i: () => go('revolt') }, null); }, onClose: () => { if (off) off(); } });
        pm.then(v => resolve(v && typeof v === 'object' ? v : null));
      });
      if (!choice) pick = null;
      else { pick = choice; if (it.frame && it.frameChoices && it.frameChoices.length >= 2) { const fr = await askFrame(it); if (fr >= 0) pick = Object.assign({}, choice, { frame: fr }); } }
      let res = null;
      if (typeof it.answer === 'function') { try { res = it.answer(pick); } catch (e) { console.error('[spy] answer failed', e); } } else res = it.result || null;
      if (res && !res.aborted) await resultCard(it, res);
    } catch (e) { console.error('[spy] sabotage failed', e); }
    spyMusicEnd(snap);
    return pick;
  };
  function resultCard(it, r) {
    const S = G.S, p = S && S.planets[r.planet], name = p ? (p.name || S.stars[p.starId].name) : 'the colony';
    let line, good = true;
    if (r.action === 'factories') line = r.none ? 'The colony had no factories to destroy.' : 'Your saboteurs destroyed ' + r.destroyed + (r.destroyed === 1 ? ' factory' : ' factories') + ' on ' + name + '.';
    else if (r.action === 'bases') line = r.none ? 'The colony had no missile bases.' : r.destroyed ? 'Your saboteurs destroyed ' + r.destroyed + (r.destroyed === 1 ? ' missile base' : ' missile bases') + ' on ' + name + '.' : 'The charges failed — no missile base was destroyed.';
    else line = r.none ? 'No incitement was possible.' : r.rebellion ? 'Revolt! ' + name + ' erupts in open rebellion.' : 'Your agents incited ' + r.rebels + ' rebels on ' + name + '.';
    if (r.none) good = false;
    UI.sfx(good ? 'explosion_big' : 'click', 'explosion_small');
    const extra = r.blamed >= 0 ? h('p.spy-warn', nm(it.target) + ' knows who is behind it (relations −' + r.penalty + ').') : r.framed >= 0 ? h('p.spy-warn', nm(r.framed) + ' takes the blame (−' + r.penalty + ').') : null;
    return UI.modal({ title: 'Sabotage result', body: h('div', good ? h('div.spy-boom', h('i'), h('i'), h('i')) : null, h('p', line), extra), buttons: [{ label: 'Continue', value: true, primary: true, kbd: 'Space' }], width: '30rem' });
  }

  // ---------------------------------------------------------------------------------------------------- notices for the victim
  let caughtTurn = -1;
  Spy.victimNotice = async function (ev) {
    const S = G.S; if (!S) return;
    const by = ev.by >= 0 ? emp(ev.by) : null, who_ = by ? who(by, by.name + ' spies') : 'Unknown spies';
    if (ev.kind === 'spiesCaught' || ev.kind === 'spiesLost') {
      if (caughtTurn === S.turn) return;
      caughtTurn = S.turn; return Spy.caught();
    }
    if (ev.kind === 'spyNothing') { UI.Galaxy && UI.Galaxy.message('Your spies found nothing worth stealing in ' + nm(ev.target) + ' space.'); return; }
    let text;
    if (ev.kind === 'techStolen') text = h('p', who_, ' stole the plans for ', h('b', ev.tech || 'a technology'), '.');
    else if (ev.kind === 'sabotage') {
      const p = S.planets[ev.planet], pn = p ? (p.name || S.stars[p.starId].name) : 'a colony';
      text = h('p', who_, ev.action === 'revolt' ? (ev.rebellion ? ' incited a rebellion on ' : ' stirred up unrest on ') : ev.action === 'bases' ? ' destroyed ' + ev.n + ' missile base' + (ev.n === 1 ? '' : 's') + ' on ' : ' destroyed ' + ev.n + ' factor' + (ev.n === 1 ? 'y' : 'ies') + ' on ', h('b', pn), '.');
    } else return;
    UI.sfx('alert');
    await UI.modal({ title: ev.kind === 'techStolen' ? 'Espionage!' : 'Sabotage!', body: h('div', h('div.spy-hd', UI.icon('spy', 'big')), text), buttons: [{ label: 'Continue', value: true, primary: true, kbd: 'Space' }], width: '30rem' });
  };

  // ---------------------------------------------------------------------------------------------------- Spies Caught
  Spy.caught = function () {
    const S = G.S, E = G.player();
    if (!S || !E || !M.Sim.Spy || !M.Sim.Spy.reports) return Promise.resolve();
    const rep = M.Sim.Spy.reports(S, E);
    const rows = rep.rows.filter(r => r.alive && (r.contact || r.yours || r.theirs || r.spies));
    const body = rows.length
      ? UI.table([{ key: 'name', label: 'Empire', sort: false, fmt: r => h('span', h('span.empire-dot', { style: { '--c': bannerHex(emp(r.empire)) } }), r.name) },
        { key: 'yours', label: 'Yours', align: 'r', sort: false, fmt: r => h('b.t-rose', String(r.yours)) }, { key: 'theirs', label: 'Theirs', align: 'r', sort: false, fmt: r => h('b.t-leaf', String(r.theirs)) },
        { key: 'spies', label: 'Your spies there', align: 'r', sort: false }], rows)
      : h('p.dim', 'You have not met any other empire yet.');
    UI.sfx('open');
    return UI.modal({ title: 'Spies caught', body: h('div', body, h('p.dim.small', 'Yours: your spies caught by them this year. Theirs: their spies you caught.')), buttons: [{ label: 'OK', value: true, primary: true, kbd: 'Space' }], width: '34rem' });
  };
  Spy.isOpen = () => UI.modalOpen();

  // ---------------------------------------------------------------------------------------------------- wiring into the turn driver (guarded; harmless if flow.js routes these itself)
  const SPY_KINDS = { techStolen: 1, sabotage: 1, spiesCaught: 1, spiesLost: 1, spyNothing: 1 };
  function wire() {
    const H = G && G.handlers; if (!H) return;
    if (!H.spySabotageChoice) H.spySabotageChoice = async it => Spy.sabotage(it);
    if (!H.notice || !H.notice.__spy) {
      const prev = H.notice;
      const wrapped = async function (it, S) { if (it && SPY_KINDS[it.kind]) return Spy.victimNotice(it); return prev ? prev.call(this, it, S) : undefined; };
      wrapped.__spy = true; H.notice = wrapped;
    }
  }
  M.Bus.on('game:new', wire); M.Bus.on('game:loaded', wire); wire();
})(window.MOO);

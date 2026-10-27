// The audience (research/06 §5.17, research/05 §4.4/§4.6/§4.8): the diplomatic conversation. Your hooded emperor (from behind, in your banner colour) faces the alien ambassador
// in that race's hall; the ambassador speaks in the leader's personality voice (Data.text.diplomacy), and every action goes through the Diplo engine — this file never
// decides an outcome itself.
//   MOO.UI.Audience.open(aiId, {from, fromParams}) → Promise   player-initiated (Races screen "Audience"): the original's menus —
//        Propose Treaty (Non-Aggression Pact / Alliance / Peace Treaty / Declaration of War on Another Race / Break Alliance With Another Race) · Form Trade Agreement ·
//        Threaten / Break Treaty and Trade · Offer Tribute (BC or a technology) · Exchange Technology · Good Bye — with the counter-offers ("sweeteners": Agree / Forget It)
//   MOO.UI.Audience.show(interrupt) → Promise(answer id)       AI-initiated: Game.handlers.diplomacy (Diplo.turn interrupts: greeting + proposal / warning / war / thanks…); the
//        returned option id is passed to interrupt.answer() by Sim.Turn.  Follow-up interrupts of one audience are shown without leaving the scene.
//   Screen 'audience' (params {empire, from, fromParams, interrupt?}): Esc / right-click = Forget It / back / Good Bye · 1–9 pick a line · Space completes the typing / continues ·
//        Y / N answer Accept / Reject · ↑ ↓ Enter walk the lines.   Music: Audio.Music 'race:<id>'.
//   Engine API used: Diplo.audience / menu / propose / answerCounter / leave / techWanted / techOffers / status / isGone (+ Diplo.situation); Data.text.diplomacy.
(function (M) {
  'use strict';
  const UI = M.UI, h = UI.h, G = M.Game, U = M.Util;
  const clamp = U.clamp;
  const RX = () => UI.Races || {};

  // ================================================================ styles
  UI.css('audience', `
    .au { position:absolute; inset:0; overflow:hidden; background:#02030c; cursor:default; }
    .au canvas.au-scene { position:absolute; inset:0; width:100%; height:100%; display:block; }
    .au-top { position:absolute; left:1.3rem; right:1.3rem; top:1rem; display:flex; gap:1rem; align-items:flex-start; pointer-events:none; z-index:3; }
    .au-who { display:flex; align-items:center; gap:.7rem; padding:.35rem .8rem .35rem .45rem; background:rgba(5,9,26,.74); backdrop-filter:blur(3px); box-shadow:0 0 0 1px var(--brass-line-3); --ch:.5rem; clip-path:var(--poly); }
    .au-who .rx-plate { font-size:1.3rem; } .au-who .nm { color:var(--mist); font-size:.95rem; line-height:1.15; } .au-who .nm b { display:block; color:var(--ivory); font:400 1.05rem var(--font-title); letter-spacing:.03em; }
    .au-chips { margin-left:auto; display:flex; flex-direction:column; align-items:flex-end; gap:.35rem; }
    .au-bar { display:flex; align-items:center; gap:.8rem; padding:.35rem .8rem; background:rgba(5,9,26,.74); backdrop-filter:blur(3px); box-shadow:0 0 0 1px var(--brass-line-3); --ch:.5rem; clip-path:var(--poly); font-size:1rem; }
    .au-bar .k { color:var(--mist); font-size:.8rem; letter-spacing:.08em; text-transform:uppercase; margin-right:.35rem; } .au-bar b { font-weight:600; font-variant-numeric:tabular-nums; }
    .au-bar .rc-bar { width:7.5rem; flex:none; } .au-bar .rc-lab { font-size:.95rem; min-width:5.6rem; text-align:left; }
    .au-fx { display:flex; flex-direction:column; align-items:flex-end; gap:.3rem; margin-top:.2rem; }
    .au-fx .fx { padding:.22rem .7rem; font-size:1rem; color:var(--ivory); background:rgba(5,9,26,.82); border-right:3px solid var(--brass); animation:au-fx-in .35s var(--ease) both; }
    .au-fx .fx.good { border-right-color:var(--leaf); color:#d6ffe6; } .au-fx .fx.bad { border-right-color:var(--rose); color:#ffd9dd; } .au-fx .fx.info { border-right-color:var(--cyan); } .au-fx .fx.gold { border-right-color:var(--gold); color:#fff1b8; } .au-fx .fx.out { animation:au-fx-out .5s ease-in both; }
    @keyframes au-fx-in { from { opacity:0; transform:translateX(14px); } to { opacity:1; transform:none; } } @keyframes au-fx-out { to { opacity:0; transform:translateY(-6px); } }
    .au-panel { --ch:.8rem; position:absolute; left:3%; bottom:3.4%; width:min(57%, 54rem); max-height:70%; display:flex; flex-direction:column; z-index:4; padding:.8rem 1.7rem .85rem; isolation:isolate;
      background:linear-gradient(135deg, var(--brass-hi), var(--brass-lo) 22%, #3b7f86 50%, var(--brass-lo) 78%, var(--brass-hi)); clip-path:var(--poly); filter:drop-shadow(0 .6rem 1.4rem rgba(0,0,0,.65)); animation:au-pan-in .5s var(--ease) both; }
    .au-panel::before { content:""; position:absolute; inset:1px; z-index:-1; clip-path:var(--poly); background:linear-gradient(180deg, rgba(10,50,64,.95), rgba(5,24,36,.97)), #05121c; box-shadow:inset 0 0 2.2rem rgba(56,214,196,.12); }
    .au-panel::after { content:""; position:absolute; inset:0; z-index:-1; pointer-events:none; background:repeating-linear-gradient(0deg, rgba(120,255,240,.025) 0 1px, transparent 1px 3px); clip-path:var(--poly); }
    @keyframes au-pan-in { from { opacity:0; transform:translateY(1.2rem); } to { opacity:1; transform:none; } }
    .au-cap { position:absolute; top:.9rem; bottom:.9rem; width:.55rem; background:linear-gradient(180deg, var(--rose), var(--gold) 38%, var(--gold) 62%, var(--rose)); box-shadow:0 0 .8rem rgba(255,160,90,.35); }
    .au-cap.l { left:.55rem; clip-path:polygon(0 8%, 100% 0, 100% 100%, 0 92%); } .au-cap.r { right:.55rem; clip-path:polygon(0 0, 100% 8%, 100% 92%, 0 100%); }
    .au-speaker { display:flex; align-items:center; gap:.55rem; margin-bottom:.3rem; font:400 1rem var(--font-display); letter-spacing:.09em; text-transform:uppercase; color:var(--brass); }
    .au-speaker small { color:var(--mist); font:400 .85rem var(--font-ui); letter-spacing:.02em; text-transform:none; }
    .au-terms { display:flex; flex-wrap:wrap; gap:.4rem; margin:.1rem 0 .45rem; } .au-terms:empty { display:none; }
    .au-terms .tm { padding:.14rem .6rem; font-size:.95rem; color:#d9f6ff; background:rgba(98,216,255,.1); box-shadow:inset 0 0 0 1px rgba(98,216,255,.4); } .au-terms .tm.gold { color:#fff1b8; background:rgba(255,213,79,.1); box-shadow:inset 0 0 0 1px rgba(255,213,79,.45); } .au-terms .tm.bad { color:#ffd9dd; background:rgba(255,92,106,.1); box-shadow:inset 0 0 0 1px rgba(255,92,106,.45); }
    .au-text { min-height:3.9rem; font:400 1.3rem/1.42 var(--font-title); color:var(--ivory); text-shadow:0 1px 0 rgba(0,0,0,.6); overflow-y:auto; white-space:pre-wrap; }
    .au-text.dim { color:#a9bfc8; font-size:1.1rem; min-height:0; }
    .au-text.typing::after { content:"▌"; margin-left:.12em; color:var(--cyan); animation:au-caret .7s steps(1) infinite; } @keyframes au-caret { 50% { opacity:0; } }
    .au-note { min-height:0; margin-top:.15rem; color:var(--rose); font:400 1rem var(--font-title); letter-spacing:.02em; } .au-note:empty { display:none; }
    .au-menu { display:flex; flex-direction:column; gap:.05rem; margin-top:.55rem; padding-top:.5rem; border-top:1px solid var(--brass-line-2); min-height:0; overflow-y:auto; }
    .au-menu:empty { display:none; }
    .au-mh { margin:0 0 .15rem .15rem; color:var(--brass); font:400 .9rem var(--font-display); letter-spacing:.1em; text-transform:uppercase; }
    .au-item { position:relative; display:flex; align-items:baseline; gap:.75rem; width:100%; padding:.3rem .7rem .3rem .5rem; border:0; border-left:3px solid transparent; background:transparent; text-align:left; cursor:var(--hand); color:var(--ivory); font:400 1.15rem/1.25 var(--font-title); animation:au-item-in .3s var(--ease) both; animation-delay:calc(var(--i, 0) * 28ms); }
    @keyframes au-item-in { from { opacity:0; transform:translateX(-.5rem); } to { opacity:1; transform:none; } }
    .au-item kbd { flex:none; min-width:1.5rem; font:600 .8rem var(--font-ui); color:var(--brass); text-align:center; padding:.02rem .25rem; box-shadow:inset 0 0 0 1px var(--brass-line-3); }
    .au-item .d { margin-left:auto; padding-left:1rem; color:var(--mist); font:400 .9rem var(--font-ui); white-space:nowrap; }
    .au-item:hover:not(:disabled), .au-item.focus:not(:disabled) { background:linear-gradient(90deg, rgba(98,216,255,.2), rgba(98,216,255,0)); border-left-color:var(--cyan); color:#fff; }
    .au-item:disabled { color:#5d7a86; cursor:default; } .au-item:disabled kbd { color:#5d7a86; box-shadow:inset 0 0 0 1px rgba(93,122,134,.45); }
    .au-item.warn:not(:disabled) .l { color:#ffcf9a; } .au-item.bad:not(:disabled) .l { color:#ffb3bb; } .au-item.back .l { color:#c4d6dd; }
    .au-hint { margin-top:.35rem; color:#7fa0ab; font-size:.8rem; letter-spacing:.02em; }
    @media (max-aspect-ratio: 19/10) { .au-panel { width:min(50%, 54rem); } .au-text { font-size:1.15rem; } .au-item { font-size:1.05rem; } }
    @media (max-width: 62rem) { .au-panel { width:92%; left:4%; } .au-top { flex-wrap:wrap; } }
  `);

  // "original" restyle (research/ui-ref C 7c / B audience): teal-cyan text well, red-brown meander brackets either side, pale periwinkle copy, steel header plates.
  UI.css('audience-orig', `
    .au-who, .au-bar { background:linear-gradient(180deg,rgba(58,62,72,.9),rgba(26,28,34,.92)); clip-path:none; box-shadow:0 0 0 1px #000, inset 1px 1px 0 #9298a6, inset -1px -1px 0 #14161a; }
    .au-fx .fx { background:rgba(8,16,22,.86); }
    .au-panel { clip-path:none; background:linear-gradient(135deg,#7ec8c4,#2e7a80 24%,#1a4c58 60%,#0a2a34); padding-left:2.5rem; padding-right:2.5rem; }
    .au-panel::before { clip-path:none; inset:2px; background:linear-gradient(180deg,rgba(8,58,66,.97),rgba(3,30,38,.98)); box-shadow:inset 1px 1px 0 #000, inset -1px -1px 0 rgba(126,200,196,.45), inset 0 0 2rem rgba(56,214,196,.12); }
    .au-panel::after { clip-path:none; }
    .au-cap { top:.35rem; bottom:.35rem; width:1.15rem; box-shadow:inset 0 0 0 1px #2a0e06, inset 2px 2px 0 rgba(255,200,140,.35);
      background:repeating-linear-gradient(180deg,#b8582c 0 .3rem,#6a2c14 .3rem .42rem,#d88a48 .42rem .5rem,#6a2c14 .5rem .62rem); clip-path:none; }
    .au-cap.l { left:.4rem; } .au-cap.r { right:.4rem; }
    .au-cap::after { content:""; position:absolute; inset:.18rem .28rem; border:1px solid rgba(255,220,170,.55); border-left-color:rgba(80,30,10,.8); }
    .au-speaker { color:#e0b040; text-shadow:0 1px 0 #000; }
    .au-text { color:#bcdcf8; font-family:var(--font-ui); font-size:1.2rem; line-height:1.4; text-shadow:0 1px 0 #000; }
    .au-text.dim { color:#8fb0c8; }
    .au-terms .tm { background:rgba(0,0,0,.35); box-shadow:inset 1px 1px 0 #000, inset -1px -1px 0 rgba(126,200,196,.4); }
    .au-menu { border-top:1px solid rgba(126,200,196,.35); }
    .au-mh { color:#e0b040; } .au-item { color:#c8e4ff; text-transform:none; } .au-item kbd { color:#e0b040; box-shadow:inset 0 0 0 1px rgba(224,176,64,.5); }
    .au-item:hover:not(:disabled), .au-item.focus:not(:disabled) { background:#620b03; border-left-color:#e0b040; color:#fff; }
  `);

  // ================================================================ dialogue text
  const SAFE = { star: 'our border', tech: 'that technology', bc: '', treaty: 'treaty', race3: 'another empire', leader3: '' };
  const lastPick = {};
  function fill(str, vars) {
    return String(str).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null && vars[k] !== '' ? vars[k] : (SAFE[k] !== undefined ? SAFE[k] : ''))).replace(/\s+([.,;:!?])/g, '$1').replace(/ {2,}/g, ' ').trim();
  }
  // a say-spec from the engine {personality, situation, vars} → one of the three lines of that leader (never the same line twice in a row)
  // The speaker's RACE voice comes first (Data.diploRace[race][situation], js/data/diplo/*.js); the personality lines are the fallback.
  // An opening line is refined by the meeting: first contact, allied, a cool reception (the engine's type 23 or a poor attitude).
  function raceLines(spec) {
    const R = M.Data && M.Data.diploRace, S = G.S; if (!R || !S) return null;
    const from = spec && spec.from !== undefined ? spec.from : A.empire, E = from >= 0 ? S.empires[from] : null;
    return R[(spec && spec.race) || (E && E.race)] || null;
  }
  function openingOf(spec) {
    const S = G.S, mt = spec.msgType | 0, from = spec.from !== undefined ? spec.from : A.empire, h = S && S.playerId;
    if (mt >= 14 && mt <= 19) return 'firstContact';
    if (mt === 23) return 'greetingCool';
    let st = null; try { st = M.Sim.Diplo.status(S, from, h); } catch (e) { st = null; }
    return st && st.allied ? 'greetingAlly' : st && st.attitude <= -30 ? 'greetingCool' : 'greeting';
  }
  function line(spec, extra) {
    const T = M.Data && M.Data.text && M.Data.text.diplomacy, RL = raceLines(spec);
    const pers = spec && T && T[spec.personality] ? spec.personality : 'ruthless';
    let sit = spec && spec.situation ? spec.situation : 'proposalRejected', set = null, key = '';
    if (RL) {
      const fine = sit === 'greeting' ? openingOf(spec || {}) : sit;
      set = RL[fine] || RL[sit]; key = 'r/' + fine;
    }
    if (!set || !set.length) {
      set = T && T[pers] && T[pers][sit];
      if (!set || !set.length) { sit = 'proposalRejected'; set = (RL && RL[sit]) || (T && T[pers] && T[pers][sit]); }
      key = pers + '/' + sit;
    }
    if (!set || !set.length) return '…';
    // a line that names a third race ("I'd expect this from the Darloks") makes no sense said to that race: skip lines naming the player's people
    const me0 = G.player(), E0 = RL ? (G.S.empires[spec && spec.from !== undefined ? spec.from : A.empire] || null) : null;
    if (RL && me0 && E0 && me0.race !== E0.race) {
      const R0 = (M.Data.races && M.Data.races[me0.race]) || {}, names = [me0.plural, me0.name, R0.name, R0.adj, R0.plural, me0.race].filter(Boolean).map(x => String(x).toLowerCase());
      const kept = set.filter(x => { const l = x.toLowerCase(); return !names.some(n => n.length > 2 && new RegExp('\\b' + n + '\\b').test(l)); });
      if (kept.length) set = kept;
    }
    let i = Math.floor(Math.random() * set.length);
    if (set.length > 1 && lastPick[key] === i) i = (i + 1 + Math.floor(Math.random() * (set.length - 1))) % set.length;
    lastPick[key] = i;
    const me = G.player();
    return fill(set[i], Object.assign({ leader2: me ? me.leader : '', race2: me ? me.plural : '' }, spec && spec.vars || {}, extra || {}));
  }
  // lines the engine has no situation for: the AI's "what if we also gave you…" (incentive) in each leader's voice
  const INCENTIVE = {
    xenophobic: ['Hmph. Take {x} with it, then, and spare me the haggling.', 'Fine. {x} to sweeten it. Do not mistake this for generosity.'],
    ruthless: ['Let us improve the terms: {x} on top of the bargain. That should settle it.', 'I will add {x}. A final offer; weigh it carefully.'],
    aggressive: ['Enough dithering. I will throw in {x}. Take it or lose it.', 'Add {x} to my offer, then. Now decide.'],
    erratic: ['Ha! Why not? I shall add {x} as well. Surprised?', 'Oh, very well, {x} too, and let us see what you say now.'],
    honorable: ['Perhaps this will show my good faith: I will add {x} to the offer.', 'To honour the spirit of the agreement, accept {x} as well.'],
    pacifistic: ['I would so like to be friends. Please, take {x} as well.', 'Let me add {x} to it, if that helps us find peace.'],
  };
  const incentiveLine = (pers, what, spec) => { const RL = raceLines(spec), L = (RL && RL.incentive) || INCENTIVE[pers] || INCENTIVE.ruthless; const me = G.player(); return fill(L[Math.floor(Math.random() * L.length)].replace('{x}', what), { leader2: me ? me.leader : '', race2: me ? me.plural : '' }); };

  // ================================================================ state
  const A = {
    el: null, cv: null, ctx: null, w: 0, h: 0, built: false,
    race: '', color: '#d6b36a', myColor: '#4a90e8', mood: 'neutral', base: 'neutral', moodUntil: 0, talking: false,
    text: '', shown: 0, typing: false, typeRes: null, pending: null, focus: -1,
    token: 0, active: false, empire: -1, mode: '', from: 'galaxy', fromParams: null, openT: 0, now: 0, lastDraw: 0, recall: 0, resolve: null, exitTimer: 0, fx: [], ended: false,
  };
  class Abort extends Error {}
  const alive = tk => A.active && tk === A.token;
  const S_ = () => G.S, me = () => G.player(), D_ = () => M.Sim.Diplo;
  const raceOf = id => G.S.empires[id];
  const bannerOf = E => (RX().BANNER || ['#4a90e8', '#4ed17a', '#b45be8', '#e8504d', '#f1eee4', '#e8c94a'])[(E.color | 0) % 6];
  const fieldName = f => (RX().FIELD || ['Computers', 'Construction', 'Force Fields', 'Planetology', 'Propulsion', 'Weapons'])[f] || '';
  function sync() { try { if (!G.busy && M.Sim.Econ && M.Sim.Econ.refresh) M.Sim.Econ.refresh(G.S); } catch (e) { /* optional */ } try { M.Bus.emit('state'); } catch (e) { /* optional */ } }

  // ---- mood ---------------------------------------------------------------------------------------------------------------------------------------
  function baseMood() {
    const S = S_(), D = D_(); if (!S || !D || A.empire < 0) return 'neutral';
    try { const st = D.status(S, S.playerId, A.empire); return RX().moodOf ? RX().moodOf({ treaty: st.treaty, attitude: st.attitude }) : 'neutral'; } catch (e) { return 'neutral'; }
  }
  function setMood(m, secs) { A.mood = m; A.moodUntil = secs ? A.now + secs : 0; }

  // ---- panel text: typing -------------------------------------------------------------------------------------------------------------------------
  const CPS = 78;
  function speak(spec, o) {
    o = o || {};
    const tk = A.token;
    const str = typeof spec === 'string' ? spec : line(spec, o.vars);
    if (o.mood) setMood(o.mood, o.moodSecs === undefined ? 7 : o.moodSecs);
    if (o.speaker !== false) paintSpeaker(o.player ? 'you' : 'ai');
    A.textEl.className = 'au-text' + (o.dim ? ' dim' : '') + ' typing';
    A.full = str; A.shown = 0; A.typing = true; A.talking = !o.dim;
    UI.clear(A.menuEl); A.pending = null;
    A.note.textContent = o.note || '';
    if (!o.dim) UI.sfx('typing', { vol: 0.5 });
    return new Promise((res, rej) => {
      A.typeRes = () => { if (!alive(tk)) rej(new Abort()); else res(); };
      A.textEl.textContent = '';
      if (M.Settings.get('animSpeed') === 0 || M.Settings.get('reduceMotion')) finishTyping();       // instant text, like the other scenes honour the setting
    }).then(() => { if (o.hold) return pause(o.hold, tk); });
  }
  function finishTyping() {
    if (!A.typing) return;
    A.typing = false; A.talking = false; A.shown = A.full.length;
    A.textEl.textContent = A.full; A.textEl.classList.remove('typing');
    const r = A.typeRes; A.typeRes = null; if (r) r();
  }
  function pause(ms, tk) {
    tk = tk === undefined ? A.token : tk;
    return new Promise((res, rej) => { setTimeout(() => { if (alive(tk)) res(); else rej(new Abort()); }, ms); });
  }
  function paintSpeaker(who) {
    const S = S_(), E = S && S.empires[A.empire]; if (!E) return;
    UI.mount(A.speaker, who === 'you' ? [h('i.rx-dot', { style: { '--c': A.myColor } }), 'You — ', h('small', me().leader)]
      : [h('i.rx-dot', { style: { '--c': A.color } }), E.leader, h('small', 'of the ' + E.name)]);
  }
  function note(text) { A.note.textContent = text || ''; }
  function terms(list) {
    UI.mount(A.terms, (list || []).map(t => h('span.tm' + (t.kind ? '.' + t.kind : ''), t.text)));
  }

  // ---- menus ---------------------------------------------------------------------------------------------------------------------------------------
  // items: [{label, detail?, enabled?, tip?, kind?, key?, value}] → Promise(item | null); o.cancel = the item chosen by Esc / right-click (default null)
  function choose(items, o) {
    o = o || {};
    const tk = A.token;
    if (A.typing) finishTyping();
    return new Promise((res, rej) => {
      A.pending = { items, o, res: v => { A.pending = null; UI.clear(A.menuEl); if (!alive(tk)) rej(new Abort()); else res(v); } };
      A.focus = items.findIndex(it => it.enabled !== false);
      UI.clear(A.menuEl);
      if (o.header) A.menuEl.appendChild(h('div.au-mh', o.header));
      items.forEach((it, i) => {
        const b = h('button.au-item' + (it.kind ? '.' + it.kind : '') + (o.cancel === it ? '.back' : ''), { type: 'button', disabled: it.enabled === false, style: { '--i': i }, dataset: { i },
          onclick: () => pickItem(i), onmouseenter: () => { if (it.enabled !== false) setFocus(i); } },
        h('kbd', it.key || (o.cancel === it ? 'Esc' : String(i + 1))), h('span.l', it.label), it.detail ? h('span.d', it.detail) : null);
        if (it.tip) UI.setTip(b, it.tip);
        A.menuEl.appendChild(b);
      });
      setFocus(A.focus);
      // waiting-for-input light: a lone Continue / OK gets the gold light; an offer the turn is waiting on (an AI-initiated audience) lights
      // all its answers softly — accepting or refusing a treaty is the player's call, the light only says "the game waits here"
      const bs = Array.from(A.menuEl.querySelectorAll('.au-item'));
      if (items.length === 1 && bs[0]) UI.attention(bs[0], { focus: false });
      else if (A.mode === 'ai' && M.Game && M.Game.busy) UI.attentionGroup(bs);
    });
  }
  function setFocus(i) {
    A.focus = i;
    const bs = A.menuEl.querySelectorAll('.au-item');
    bs.forEach((b, k) => b.classList.toggle('focus', k === i));
  }
  function pickItem(i) {
    const p = A.pending; if (!p || A.typing) { if (A.typing) finishTyping(); return; }
    const it = p.items[i]; if (!it || it.enabled === false) { UI.sfx('error'); return; }
    UI.sfx(it === p.o.cancel ? 'cancel' : 'click');
    note('');                                                           // a remark such as "(They have nothing to trade…)" belongs to the menu it was said over
    p.res(it);
  }
  function cancelPick() {
    if (A.typing) { finishTyping(); return; }
    const p = A.pending; if (!p) return;
    UI.sfx('cancel'); p.res(p.o.cancel === undefined ? null : p.o.cancel);
  }
  function moveFocus(d) {
    const p = A.pending; if (!p) return;
    const n = p.items.length; let i = A.focus;
    for (let k = 0; k < n; k++) { i = (i + d + n) % n; if (p.items[i].enabled !== false) break; }
    setFocus(i);
  }
  const FORGET = () => ({ label: 'Forget It', key: 'Esc', kind: 'back', value: 'back' });
  const CONTINUE = () => ({ label: 'Continue', key: 'Space', value: 'ok' });
  const waitContinue = o => choose([CONTINUE()], Object.assign({ cancel: undefined }, o)).then(() => undefined);

  // ---- floating result chips ---------------------------------------------------------------------------------------------------------------------
  function fx(text, kind) {
    const el = h('div.fx' + (kind ? '.' + kind : ''), text); A.fxEl.appendChild(el);
    while (A.fxEl.children.length > 6) A.fxEl.firstChild.remove();
    const t = setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 520); }, 7500); A.fx.push(t);
  }
  function clearFx() { for (const t of A.fx) clearTimeout(t); A.fx = []; if (A.fxEl) UI.clear(A.fxEl); }

  // ---- top bar: who + treaty / trade / attitude / reserve -----------------------------------------------------------------------------------------
  function paintTop() {
    const S = S_(), E = S.empires[A.empire], D = D_(); if (!E) return;
    const meE = me(), RXh = RX();
    let st = null; try { st = D.status(S, meE.id, E.id); } catch (e) { st = null; }
    const li = st ? st.labelIndex : 8, att = st ? st.attitude : 0;
    const plate = h('span.rx-plate', E.name); plate.style.setProperty('--c', A.color); plate.style.setProperty('--ink', RXh.inkOn ? RXh.inkOn(A.color) : '#0a0e24');
    UI.mount(A.who, plate, h('div.nm', h('b', E.leader), A.mode === 'ai' ? 'calling you' : 'Audience'));
    const lab = RXh.LADDER ? RXh.LADDER[li] : (st ? st.label : '');
    const bar = h('div.rc-bar', h('i.rc-ptr', { style: { left: ((att + 100) / 2) + '%' } }));
    const tn = st ? st.treatyName : '';
    const trade = st && st.trade && st.trade.bc > 0 ? U.fmt(st.trade.bc) + ' BC / yr' : 'no trade';
    const tcls = !st ? '' : st.treaty >= 3 ? 't-rose' : st.treaty === 2 ? 't-leaf' : st.treaty === 1 ? 't-cyan' : 't-mist';
    UI.mount(A.bar, h('span', h('span.k', 'Treaty'), h('b.' + tcls, tn.replace(/^No Treaty$/, 'None'))), h('span', h('span.k', 'Trade'), h('b' + (st && st.trade.bc > 0 ? '.t-gold' : '.t-fog'), trade)),
      h('span', { style: { display: 'flex', alignItems: 'center', gap: '.6rem' } }, h('span.k', 'Attitude'), bar, h('span.rc-lab ' + (li >= 10 ? 'pos' : li <= 6 ? 'neg' : li === 8 ? '' : 'mid'), lab)),
      h('span', h('span.k', 'Reserve'), h('b.t-gold', U.fmt(meE.bc)), h('span.t-gold', ' BC')));
  }

  // ================================================================ the scene (canvas)
  function drawEmperor(g, W, H, t, col, talk) {
    const fh = H * 0.8, fw = Math.min(W * 0.27, fh * 0.6), ox = W * 0.03 + fw * 0.62, oy = H * 1.04;
    const br = 1 + Math.sin(t * 1.25) * 0.004, sw = Math.sin(t * 0.7) * fw * 0.006;
    const X = u => u * fw, Y = u => -u * fh;
    const dk = (c, k) => U.mix(c, '#04050e', k), lt = (c, k) => U.mix(c, '#ffffff', k);
    g.save(); g.translate(ox + sw, oy); g.scale(1, br);
    const cloak = new Path2D();
    cloak.moveTo(X(-0.17), Y(0.66)); cloak.bezierCurveTo(X(-0.40), Y(0.64), X(-0.50), Y(0.52), X(-0.55), Y(0.36)); cloak.lineTo(X(-0.64), Y(0)); cloak.lineTo(X(0.64), Y(0));
    cloak.lineTo(X(0.55), Y(0.36)); cloak.bezierCurveTo(X(0.50), Y(0.52), X(0.40), Y(0.64), X(0.17), Y(0.66)); cloak.closePath();
    const gr = g.createLinearGradient(0, Y(0.66), 0, Y(0)); gr.addColorStop(0, dk(col, 0.42)); gr.addColorStop(0.45, dk(col, 0.66)); gr.addColorStop(1, dk(col, 0.88));
    g.fillStyle = gr; g.fill(cloak);
    // folds
    g.save(); g.clip(cloak); g.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const x0 = -0.30 + i * 0.1, sh = Math.sin(t * 0.5 + i) * 0.006;
      g.strokeStyle = 'rgba(0,0,0,' + (0.16 + (i % 3) * 0.05) + ')'; g.lineWidth = fw * (0.012 + (i % 2) * 0.01);
      g.beginPath(); g.moveTo(X(x0 * 0.7), Y(0.6)); g.bezierCurveTo(X(x0 * 0.9 + sh), Y(0.4), X(x0 * 1.25), Y(0.2), X(x0 * 1.5), Y(0)); g.stroke();
    }
    // light from the ambassador (right): rim + a soft wash
    const lg = g.createLinearGradient(X(-0.6), 0, X(0.64), 0); lg.addColorStop(0, 'rgba(0,0,0,.5)'); lg.addColorStop(0.55, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(120,225,255,.26)');
    g.fillStyle = lg; g.fillRect(X(-0.7), Y(0.7), X(1.4), -Y(0.7));
    g.restore();
    // trim along the hem
    g.strokeStyle = U.mix('#d6b36a', col, 0.15); g.lineWidth = Math.max(1.2, fw * 0.014); g.globalAlpha = 0.75;
    g.beginPath(); g.moveTo(X(-0.55), Y(0.36)); g.lineTo(X(-0.64), Y(0)); g.moveTo(X(0.55), Y(0.36)); g.lineTo(X(0.64), Y(0)); g.stroke(); g.globalAlpha = 1;
    // sigil
    const sy = 0.34;
    g.save(); g.translate(0, Y(sy));
    const sg = g.createRadialGradient(0, 0, 0, 0, 0, fw * 0.16); sg.addColorStop(0, lt(col, 0.2) + 'aa'); sg.addColorStop(1, col + '00'); g.fillStyle = sg; g.fillRect(-fw * 0.2, -fw * 0.2, fw * 0.4, fw * 0.4);
    g.beginPath(); g.moveTo(0, -fw * 0.09); g.lineTo(fw * 0.065, 0); g.lineTo(0, fw * 0.09); g.lineTo(-fw * 0.065, 0); g.closePath();
    g.fillStyle = col; g.fill(); g.lineWidth = Math.max(1.2, fw * 0.012); g.strokeStyle = '#e9cf8a'; g.stroke();
    g.restore();
    // hood (tilts a little towards the speaker)
    g.save(); g.translate(0, Y(0.6)); g.rotate(0.035 + Math.sin(t * 2.3) * 0.006 * talk); g.translate(0, -Y(0.6));
    const hood = new Path2D();
    hood.moveTo(X(-0.205), Y(0.6)); hood.bezierCurveTo(X(-0.27), Y(0.80), X(-0.16), Y(0.975), X(0), Y(1.0)); hood.bezierCurveTo(X(0.16), Y(0.975), X(0.27), Y(0.80), X(0.205), Y(0.6));
    hood.bezierCurveTo(X(0.10), Y(0.645), X(-0.10), Y(0.645), X(-0.205), Y(0.6)); hood.closePath();
    const hg = g.createLinearGradient(X(-0.25), 0, X(0.27), 0); hg.addColorStop(0, dk(col, 0.7)); hg.addColorStop(0.55, dk(col, 0.42)); hg.addColorStop(1, lt(col, 0.18));
    g.fillStyle = hg; g.fill(hood);
    g.save(); g.clip(hood);
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = fw * 0.012; g.beginPath(); g.moveTo(X(0.004), Y(1.0)); g.bezierCurveTo(X(0.012), Y(0.85), X(0.0), Y(0.72), X(0.0), Y(0.62)); g.stroke();
    const hl = g.createRadialGradient(X(0.18), Y(0.82), 0, X(0.18), Y(0.82), fw * 0.28); hl.addColorStop(0, 'rgba(150,235,255,.42)'); hl.addColorStop(1, 'rgba(150,235,255,0)'); g.fillStyle = hl; g.fillRect(X(-0.3), Y(1.05), X(0.6), -Y(0.5));
    g.restore();
    g.strokeStyle = 'rgba(160,236,255,.55)'; g.lineWidth = Math.max(1.4, fw * 0.011); g.beginPath(); g.moveTo(X(0.04), Y(0.995)); g.bezierCurveTo(X(0.17), Y(0.975), X(0.27), Y(0.8), X(0.205), Y(0.6)); g.stroke();
    g.restore();
    // neck band
    g.strokeStyle = '#d6b36a'; g.lineWidth = Math.max(1.6, fw * 0.016); g.beginPath(); g.moveTo(X(-0.215), Y(0.615)); g.bezierCurveTo(X(-0.1), Y(0.572), X(0.1), Y(0.572), X(0.215), Y(0.615)); g.stroke();
    // shoulder rim
    g.strokeStyle = 'rgba(160,236,255,.42)'; g.lineWidth = Math.max(1.4, fw * 0.011); g.beginPath(); g.moveTo(X(0.19), Y(0.655)); g.bezierCurveTo(X(0.4), Y(0.64), X(0.5), Y(0.52), X(0.55), Y(0.36)); g.lineTo(X(0.64), Y(0)); g.stroke();
    g.restore();
  }
  // Your envoy as the full-length race illustration (assets/art/races/race-<id>-figure): head-and-shoulders crop at the left, lit by the hall
  // from the right, slightly out of focus and darkened so it sits in the plate with the ambassador. Falls back to the drawn silhouette.
  function drawEnvoyArt(g, W, H, t) {
    const WA = M.Gfx && M.Gfx.WorldArt; if (!WA || !WA.enabled) return false;
    const me0 = G.player(); const im = WA.get(WA.race(me0 ? me0.race : 'human', 'figure')); if (!im) return false;
    const iw = im.naturalWidth, ih = im.naturalHeight;
    const cw = Math.round(W * 0.4), ch = H;                                             // the envoy occupies the left 40 %, feathered into the hall
    const fh = H * 1.75, fw = fh * iw / ih;                                            // 2:3 figure plate: head at the upper left, cropped at the waist
    const sway = Math.sin(t * 0.35) * W * 0.0006, breathe = 1 + Math.sin(t * 0.5) * 0.0012;   // barely-there life: a photo that sways reads as jumping
    const x = -fw * 0.22 + sway, y = H * 0.05;
    if (!A.envoyCv || A.envoyCv.width !== cw || A.envoyCv.height !== ch) { A.envoyCv = document.createElement('canvas'); A.envoyCv.width = cw; A.envoyCv.height = ch; }
    const c = A.envoyCv, e = c.getContext('2d');
    e.clearRect(0, 0, cw, ch);
    try { e.filter = 'blur(1.4px) brightness(0.8) saturate(0.9)'; } catch (x2) { /* optional */ }
    e.drawImage(im, x, y, fw * breathe, fh * breathe);
    const tone = WA.raceTone ? WA.raceTone(me0 ? me0.race : 'human', 'figure') : null;   // the figure set's outliers toward its mean (the human figure is a dark one)
    if (tone && tone.k && WA.tonePass) WA.tonePass(e, tone.k, () => e.drawImage(im, x, y, fw * breathe, fh * breathe), { x: x, y: y, w: fw * breathe, h: fh * breathe });
    try { e.filter = 'none'; } catch (x2) { /* optional */ }
    // the plate's studio black must not cut a hard edge into the hall: feather the right side and the bottom
    e.globalCompositeOperation = 'destination-in';
    const fx = e.createLinearGradient(0, 0, cw, 0); fx.addColorStop(0, 'rgba(0,0,0,1)'); fx.addColorStop(0.62, 'rgba(0,0,0,1)'); fx.addColorStop(1, 'rgba(0,0,0,0)');
    e.fillStyle = fx; e.fillRect(0, 0, cw, ch);
    const fy = e.createLinearGradient(0, ch * 0.55, 0, ch); fy.addColorStop(0, 'rgba(0,0,0,1)'); fy.addColorStop(1, 'rgba(0,0,0,.35)');
    e.fillStyle = fy; e.fillRect(0, 0, cw, ch);
    // the hall lights the envoy from the right: darker towards the frame edge, cool rim on the lit edge
    e.globalCompositeOperation = 'source-atop';
    const sh = e.createLinearGradient(0, 0, cw, 0); sh.addColorStop(0, 'rgba(10,14,30,.55)'); sh.addColorStop(0.55, 'rgba(10,14,30,.12)'); sh.addColorStop(1, 'rgba(120,200,255,.16)');
    e.fillStyle = sh; e.fillRect(0, 0, cw, ch);
    e.globalCompositeOperation = 'source-over';
    g.drawImage(c, 0, 0);
    return true;
  }
  function fallbackScene(g, w, hh, t) {
    const gr = g.createRadialGradient(w * 0.62, hh * 0.45, 0, w * 0.62, hh * 0.45, Math.max(w, hh) * 0.7); gr.addColorStop(0, '#26347a'); gr.addColorStop(1, '#05071a');
    g.fillStyle = gr; g.fillRect(0, 0, w, hh);
    const P = M.Gfx && M.Gfx.Portraits; if (P && P.draw) { try { P.draw(g, A.race, w * 0.4, hh * 0.1, hh * 0.72, hh * 0.9, { t, mood: A.mood, color: A.color, talking: A.talking, key: 'au-fb', bg: false }); } catch (e) { /* ignore */ } }
  }
  function paint(t) {
    const g = A.ctx; if (!g || !A.w) return;
    const w = A.w, hh = A.h;
    const S = M.Gfx && M.Gfx.Scenes;
    let ok = false;
    if (S && S.audience && S.audience.draw && A.race) { try { S.audience.draw(g, w, hh, t, { race: A.race, mood: A.mood, talking: A.talking, color: A.color }); ok = true; } catch (e) { if (!A.warned) { A.warned = 1; console.warn('[audience] scene failed', e); } } }
    if (!ok) fallbackScene(g, w, hh, t);
    // your envoy stands at the left; a portrait screen (phones) has no room beside the leader, who is centred there (Scenes audGeo)
    if (w >= hh * 0.8 && !drawEnvoyArt(g, w, hh, t)) drawEmperor(g, w, hh, t, A.myColor, A.talking ? 1 : 0);
    // materialise: scan-lines clear and the room brightens when the audience opens; "signal lost" when the ambassador is recalled
    const k = clamp((t - A.openT) / 1.1, 0, 1);
    if (k < 1) {
      g.save(); g.fillStyle = 'rgba(2,6,18,' + Math.pow(1 - k, 1.6) * 0.92 + ')'; g.fillRect(0, 0, w, hh);
      g.fillStyle = 'rgba(98,216,255,' + (1 - k) * 0.22 + ')'; for (let y = (t * 90) % 6; y < hh; y += 6) g.fillRect(0, y, w, 1.5); g.restore();
    }
    if (A.recall > 0) {
      const r = clamp(A.recall, 0, 1);
      g.save(); g.fillStyle = 'rgba(2,4,12,' + r * 0.78 + ')'; g.fillRect(0, 0, w, hh);
      g.fillStyle = 'rgba(255,92,106,' + r * 0.18 + ')'; for (let y = (t * 140) % 5; y < hh; y += 5) g.fillRect(0, y, w, 1.2); g.restore();
    }
  }
  function fit() {
    if (!A.cv || !A.cv.isConnected) return;
    const f = UI.fitCanvas(A.cv, { maxDpr: M.Perf ? M.Perf.dpr() : 2 }); A.ctx = f.ctx; A.w = f.w; A.h = f.h;
  }

  // ================================================================ conversation: shared helpers
  const snap = () => {
    const S = S_(), D = D_(), E = me(); let st = null;
    try { st = D.status(S, E.id, A.empire); } catch (e) { st = null; }
    return { att: st ? st.attitude : 0, li: st ? st.labelIndex : 8, treaty: st ? st.treaty : 0, tname: st ? st.treatyName : '', trade: st ? st.trade.bc : 0, bc: E.bc, cease: st ? st.ceasefire : 0 };
  };
  function diffChips(a, b, res) {
    const L = RX().LADDER || [];
    if (b.treaty !== a.treaty) fx('Treaty: ' + (b.tname || ''), b.treaty >= 3 ? 'bad' : b.treaty > a.treaty ? 'good' : 'info');
    if (b.trade !== a.trade) fx(b.trade > 0 ? 'Trade agreement: ' + U.fmt(b.trade) + ' BC a year' : 'Trade agreement ended', b.trade > a.trade ? 'gold' : 'bad');
    if (b.bc !== a.bc) fx((b.bc > a.bc ? 'Reserve +' : 'Reserve −') + U.fmt(Math.abs(b.bc - a.bc)) + ' BC', 'gold');
    if (b.att !== a.att) fx('Attitude ' + (b.att > a.att ? '+' : '−') + Math.abs(b.att - a.att) + (b.li !== a.li ? ' — now ' + (L[b.li] || '').toLowerCase() : ''), b.att > a.att ? 'good' : 'bad');
    if (b.cease > 0 && b.cease !== a.cease) fx('Cease-fire for ' + b.cease + ' years', 'info');
    const ef = (res && res.effects) || {};
    if (ef.got && ef.got.name) fx('You receive ' + ef.got.name, 'good');
    if (ef.gave && ef.gave.name) fx('They receive ' + ef.gave.name, 'info');
    if (ef.techGiven && ef.techGiven.name) fx('They receive ' + ef.techGiven.name, 'info');
    if (ef.tech && ef.tech.name) fx('You receive ' + ef.tech.name, 'good');
    if (ef.war) fx('War declared on the ' + (S_().empires[ef.war[1]] ? S_().empires[ef.war[1]].name : 'other empire'), 'bad');
    if (ef.broke && Array.isArray(ef.broke)) fx('Alliance with the ' + (S_().empires[ef.broke[1]] ? S_().empires[ef.broke[1]].name : 'other empire') + ' broken', 'info');
  }
  function sfxFor(res) {
    const k = res.kind;
    if (res.outcome === 'war') return UI.sfx('war');
    if (!res.accepted) return UI.sfx('cancel');
    if (k === 'nap' || k === 'alliance' || k === 'peace') return UI.sfx('treaty');
    if (k === 'trade' || k === 'tributeBC') return UI.sfx('coins');
    if (k === 'tributeTech' || k === 'techExchange') return UI.sfx('tech');
    return UI.sfx('confirm');
  }
  function moodForResult(res) {
    if (res.outcome === 'war') return 'angry';
    if (res.outcome === 'defiant') return 'angry';
    if (res.outcome === 'cower' || res.outcome === 'bc' || res.outcome === 'tech') return 'worried';
    if (res.counter) return 'scheming';
    if (res.kind === 'breakTreaty' || res.kind === 'breakTrade') return 'angry';
    if (res.accepted) return 'pleased';
    return res.result === 0 && baseMood() === 'angry' ? 'angry' : 'neutral';
  }

  // the AI answers a proposal; counters are followed through (Agree / Forget It); returns {end?:true}
  async function present(res, before) {
    if (!res || res.ok === false) { UI.toast((res && res.msg) || 'That is not possible right now', 'warn'); UI.sfx('error'); return {}; }
    const tk = A.token;
    setMood(moodForResult(res), 8);
    if (res.counter && res.needsAnswer) {
      const c = res.counter;
      await speak(line(res.reply) + ' ' + c.text, { mood: 'scheming' });
      const ask = c.type === 'bc' ? U.fmt(c.bc) + ' BC' : (c.name + (c.field !== undefined ? ' — ' + fieldName(c.field) : ''));
      terms([{ text: 'They ask for: ' + ask, kind: 'gold' }]);
      const it = await choose([{ label: 'Agree', value: 'yes', tip: 'Give ' + ask + ' and the original proposal is accepted' }, FORGET()], { cancel: undefined });
      terms([]);
      const D = D_(), S = S_();
      const r2 = D.answerCounter(S, me().id, A.empire, it && it.value === 'yes');
      sync();
      if (!alive(tk)) throw new Abort();
      const after = snap(); const out = await present(r2, before); diffChips(before, after, r2); paintTop();
      return out;
    }
    sfxFor(res);
    const noteText = res.gate ? '(They will not even consider it while their opinion of you is this low.)' : '';
    await speak(res.reply, { mood: moodForResult(res), note: noteText });
    if (res.outcome === 'war') { await pause(450); await waitContinue(); return { end: true }; }
    return {};
  }

  async function doPropose(prop) {
    const S = S_(), D = D_(), before = snap();
    let res;
    try { res = D.propose(S, me().id, A.empire, prop); } catch (e) { console.error('[audience] propose', e); res = { ok: false, msg: 'The ambassador cannot answer that.' }; }
    sync();
    const out = await present(res, before);
    const after = snap();
    if (!(res && res.needsAnswer)) diffChips(before, after, res);
    paintTop();
    return out;
  }

  // ================================================================ conversation: player-initiated menus
  const TIPS = {
    nap: 'Neither side attacks the other away from their own colonies. Needs a friendly attitude (above +10).',
    alliance: 'Allies never fight each other, share fuel range and vote for each other in the Council. Needs a warm attitude (above +50).',
    peace: 'Ask to end the war.',
    askWar: 'Ask them to declare war on another empire.',
    askBreak: 'Ask them to break their alliance with another empire.',
  };
  async function treatyFlow(act) {
    for (;;) {
      const items = act.options.map(o => ({ label: o.label, enabled: o.enabled !== false, value: o, tip: TIPS[o.id] || null, detail: o.targets ? '▸' : '' }));
      items.push(FORGET());
      const it = await choose(items, { header: act.label, cancel: items[items.length - 1] });
      if (!it || it.value === 'back') return {};
      const o = it.value;
      if (o.targets) {                                                           // declare war on / break alliance with … → pick the empire
        const S = S_();
        const ti = o.targets.map(id => ({ label: 'The ' + S.empires[id].name, detail: S.empires[id].leader, value: id, enabled: true }));
        ti.push(FORGET());
        const tt = await choose(ti, { header: o.label, cancel: ti[ti.length - 1] });
        if (!tt || tt.value === 'back') continue;
        return doPropose({ kind: o.id, target: tt.value });
      }
      return doPropose({ kind: o.id });
    }
  }
  async function tradeFlow(act) {
    const D = D_(), S = S_();
    const items = act.options.map(o => ({ label: U.fmt(o.bc) + ' BC per year', value: o, enabled: o.enabled !== false, detail: act.current ? '+' + U.fmt(o.bc - act.current) : '' }));
    items.push(FORGET());
    const it = await choose(items, { header: 'Form Trade Agreement' + (act.current ? ' — now ' + U.fmt(act.current) + ' BC per year' : ''), cancel: items[items.length - 1] });
    if (!it || it.value === 'back') { D.leave(S, me().id, A.empire, 'trade'); sync(); return {}; }
    return doPropose({ kind: 'trade', bc: it.value.bc });
  }
  async function threatenFlow(act) {
    const D = D_(), S = S_();
    const info = { breakTreaty: 'Break the pact. You will be remembered as a treaty-breaker.', breakTrade: 'Cancel the trade agreement.', threat: 'Warn them that you will attack. They may submit, defy you — or go to war.' };
    const items = act.options.map(o => ({ label: o.label, enabled: o.enabled !== false, value: o, kind: o.id === 'threat' ? 'warn' : o.id === 'breakTreaty' ? 'bad' : '', tip: info[o.id] || null }));
    items.push(FORGET());
    const it = await choose(items, { header: 'Threaten / Break Treaty and Trade', cancel: items[items.length - 1] });
    if (!it || it.value === 'back') { D.leave(S, me().id, A.empire, 'threaten'); sync(); return {}; }
    const o = it.value;
    if (o.id === 'breakTreaty' && !(await UI.confirm('Break the ' + (o.treaty === 2 ? 'alliance' : 'non-aggression pact') + ' with the ' + S.empires[A.empire].name + '?', { title: 'Break the treaty' }))) { D.leave(S, me().id, A.empire, 'threaten'); sync(); return {}; }
    if (!alive(A.token)) throw new Abort();
    return doPropose({ kind: o.id });
  }
  async function tributeFlow(act) {
    const D = D_(), S = S_();
    for (;;) {
      const [gold, tech] = act.options;
      const items = [{ label: 'Gold', enabled: gold.enabled, value: 'gold', detail: gold.enabled ? '▸' : '', tip: 'Give BC from your reserve' }, { label: 'Technology', enabled: tech.enabled, value: 'tech', detail: tech.enabled ? '▸' : '', tip: 'Give a technology they do not have' }, FORGET()];
      const it = await choose(items, { header: 'Offer Tribute', cancel: items[2] });
      if (!it || it.value === 'back') return {};
      if (it.value === 'gold') {
        const gi = gold.amounts.map((bc, i) => ({ label: U.fmt(bc) + ' BC', value: { bc, i }, enabled: true })); gi.push(FORGET());
        const g2 = await choose(gi, { header: 'Offer Tribute — gold (reserve ' + U.fmt(me().bc) + ' BC)', cancel: gi[gi.length - 1] });
        if (!g2 || g2.value === 'back') continue;
        return doPropose({ kind: 'tributeBC', bc: g2.value.bc, index: g2.value.i });
      }
      const ti = tech.techs.map(t => ({ label: t.name, detail: fieldName(t.field), value: t, enabled: true })); ti.push(FORGET());
      const t2 = await choose(ti, { header: 'Offer Tribute — a technology', cancel: ti[ti.length - 1] });
      if (!t2 || t2.value === 'back') continue;
      return doPropose({ kind: 'tributeTech', field: t2.value.field, level: t2.value.level });
    }
  }
  async function techFlow() {
    const D = D_(), S = S_(), id = me().id;
    let market = [];
    try { market = D.techMarket ? D.techMarket(S, id, A.empire) : D.techWanted(S, id, A.empire); } catch (e) { console.error('[audience] techWanted', e); }
    sync();
    if (!market.length) {
      D.leave(S, id, A.empire, 'tech'); sync();
      await speak({ personality: S.empires[A.empire] && M.Sim.Diplo.PERSONALITIES[S.empires[A.empire].personality | 0], situation: 'proposalRejected', vars: {} }, { mood: 'neutral', note: '(They have nothing to trade that you can pay for.)' });
      return {};
    }
    for (;;) {
      const items = market.map(w => ({ label: w.name, detail: fieldName(w.field), value: w, enabled: true })); items.push(FORGET());
      const it = await choose(items, { header: 'Exchange Technology — which technology interests you?', cancel: items[items.length - 1] });
      if (!it || it.value === 'back') { D.leave(S, id, A.empire, 'tech'); sync(); return {}; }
      const want = it.value, offers = D.techOffers(S, id, A.empire, want);
      const oi = offers.map(o => ({ label: o.name, detail: fieldName(o.field), value: o, enabled: true })); oi.push(FORGET());
      const o2 = await choose(oi, { header: 'What will you trade for ' + want.name + '?', cancel: oi[oi.length - 1] });
      if (!o2 || o2.value === 'back') continue;
      return doPropose({ kind: 'techExchange', want: { field: want.field, level: want.level }, give: { field: o2.value.field, level: o2.value.level } });
    }
  }

  async function mainLoop() {
    const S = S_(), D = D_(), id = me().id, a = A.empire, tk = A.token;
    for (;;) {
      const menu = D.menu(S, id, a);
      if (!menu || !menu.ok) break;
      const tips = {
        treaty: 'Pacts, alliances, peace — or drag a third empire into it.', trade: menu.atWar ? 'Not while at war.' : 'Trade income depends on both economies: up to a quarter of the smaller one.',
        threaten: menu.atWar ? 'Not while at war.' : 'Break a treaty, or threaten to attack. Merely opening this menu offends the ambassador.', tribute: 'Gold or a technology as a gift: it can win favour.',
        techExchange: menu.atWar ? 'Not while at war.' : 'Swap a technology of yours for one of theirs.', goodbye: 'End the audience.',
      };
      const items = menu.actions.map(ac => ({ label: ac.label, enabled: ac.enabled !== false, value: ac, tip: tips[ac.id] || null, detail: ['treaty', 'trade', 'threaten', 'tribute'].indexOf(ac.id) >= 0 ? '▸' : '' }));
      const bye = items[items.length - 1];
      paintTop();
      const it = await choose(items, { header: null, cancel: bye });
      if (!alive(tk)) throw new Abort();
      const ac = it ? it.value : bye.value;
      if (ac.id === 'goodbye') { await speak({ personality: persOf(), situation: 'farewell', vars: {} }, { mood: baseMood() }); await pause(550); break; }
      let out = {};
      if (ac.id === 'treaty') out = await treatyFlow(ac);
      else if (ac.id === 'trade') out = await tradeFlow(ac);
      else if (ac.id === 'threaten') out = await threatenFlow(ac);
      else if (ac.id === 'tribute') out = await tributeFlow(ac);
      else if (ac.id === 'techExchange') out = await techFlow();
      if (!alive(tk)) throw new Abort();
      paintTop();
      if (out && out.end) break;
      // the ambassador may have had enough: "talk later" / refuses to speak → recalled
      const chk = D.audience(S, id, a);
      if (!chk.ok || chk.state !== 'open') { await recalled(chk); break; }
      // the next menu follows the AI's last words: keep them on screen (dimmed text is only used by sub-menus)
    }
  }
  const persOf = () => { const E = S_().empires[A.empire]; return M.Sim.Diplo.PERSONALITIES[(E && E.personality) | 0]; };
  async function recalled(au) {
    setMood('angry', 0);
    await speak(au.greeting || { personality: persOf(), situation: 'farewell', vars: {} }, { mood: 'angry', note: '(ambassador recalled)' });
    UI.sfx('cancel');
    A.recall = 0.0001;
    await waitContinue();
  }

  async function runPlayer() {
    const S = S_(), D = D_(), id = me().id, a = A.empire;
    let au;
    try { au = D.audience(S, id, a); } catch (e) { console.error('[audience] audience()', e); au = { ok: false }; }
    if (!au.ok) { UI.toast('The ' + S.empires[a].name + ' will not receive you.', 'warn'); UI.sfx('error'); return; }
    paintTop(); setMood(baseMood(), 0);
    if (au.state !== 'open') { await recalled(au); return; }
    await speak(au.greeting, { mood: au.cool ? 'neutral' : baseMood(), moodSecs: 0 });
    await mainLoop();
  }

  // ================================================================ conversation: AI-initiated
  const KIND_MOOD = { offerNap: 'pleased', offerAlliance: 'pleased', offerTrade: 'pleased', techSwap: 'pleased', askPeace: 'worried', bounty: 'scheming', bountyPaid: 'pleased', callToArms: 'worried',
    demandBreak: 'angry', allyThanks: 'pleased', allyBreaks: 'angry', firstContact: 'neutral', warDeclared: 'angry', treatyCancelled: 'angry', warning: 'angry', complaint: 'angry', message: 'neutral' };
  function offerText(o) { return o ? (o.bc ? U.fmt(o.bc) + ' BC' : o.tech ? o.tech.name : '') : ''; }
  function termsFor(it) {
    const S = S_(), inf = it.info || {}, t = [], emp = id => (S.empires[id] ? 'the ' + S.empires[id].name : 'another empire');
    switch (it.kind) {
      case 'offerNap': t.push({ text: 'Proposal: non-aggression pact' }); break;
      case 'offerAlliance': t.push({ text: 'Proposal: alliance' }); break;
      case 'offerTrade': t.push({ text: 'Proposal: a trade agreement worth ' + U.fmt(inf.bc | 0) + ' BC a year', kind: 'gold' }); break;
      case 'askPeace': t.push({ text: 'Proposal: end the war' }); break;
      case 'techSwap': if (inf.want) t.push({ text: 'They want: ' + inf.want.name + (inf.want.field !== undefined ? ' (' + fieldName(inf.want.field) + ')' : ''), kind: 'gold' }); break;
      case 'demandBreak': t.push({ text: 'They demand that you break your alliance with ' + emp(inf.target), kind: 'bad' }); break;
      case 'callToArms': t.push({ text: 'Your ally asks you to declare war on ' + emp(inf.target), kind: 'bad' }); break;
      case 'bounty': t.push({ text: 'Bounty for attacking ' + emp(inf.target) + ': ' + (inf.tech ? inf.tech.name : U.fmt(inf.bc | 0) + ' BC'), kind: 'gold' }); break;
      case 'bountyPaid': t.push({ text: inf.paid && inf.paid.tech ? 'Bounty paid: ' + inf.paid.tech : inf.paid && inf.paid.bc ? 'Bounty paid: ' + U.fmt(inf.paid.bc) + ' BC' : 'The bounty is acknowledged', kind: 'gold' }); break;
      case 'treatyCancelled': t.push({ text: 'Treaty cancelled', kind: 'bad' }); break;
      case 'warDeclared': t.push({ text: 'War!', kind: 'bad' }); break;
      case 'warning': t.push({ text: 'Warning: another offence and the treaty goes', kind: 'bad' }); break;
      default: break;
    }
    if (it.incentive) t.push({ text: 'Incentive: ' + offerText(it.incentive), kind: 'gold' });
    return t;
  }
  function optionsFor(it) {
    const opts = it.options && it.options.length ? it.options : [{ id: 'ok', label: 'OK' }];
    return opts.map(o => {
      const neg = ['reject', 'forget', 'refuse'].indexOf(o.id) >= 0, pos = ['accept', 'agree', 'yes'].indexOf(o.id) >= 0 || String(o.id).indexOf('swap:') === 0;
      let tip = null;
      if (it.kind === 'techSwap' && pos && o.field !== undefined) tip = 'You receive ' + o.label + ' (' + fieldName(o.field) + ') and give ' + (it.info && it.info.want ? it.info.want.name : 'the technology they asked for');
      return { label: String(o.id) === 'ok' ? 'Continue' : o.label, key: String(o.id) === 'ok' ? 'Space' : undefined, value: o.id, kind: neg ? 'back' : '', yes: pos, no: neg, tip, detail: o.field !== undefined ? fieldName(o.field) : '' };
    });
  }
  async function runAI(it) {
    A.mode = 'ai';
    const S = S_(), E = S.empires[it.from];
    setMood(KIND_MOOD[it.kind] || 'neutral', 0); A.base = A.mood;
    paintTop(); terms([]); note('');
    if (it.kind === 'warDeclared') UI.sfx('war'); else if (it.kind === 'firstContact') UI.sfx('contact'); else UI.sfx('alert');
    if (it.greeting) { await speak(it.greeting, { mood: A.mood, moodSecs: 0 }); await pause(650); }
    let text;
    if (it.incentive) {
      text = incentiveLine(it.text && it.text.personality, offerText(it.incentive), it.text);
    } else text = it.text;
    terms(termsFor(it));
    await speak(text, { mood: A.mood, moodSecs: 0 });
    const items = optionsFor(it);
    const cancel = items.find(x => x.no) || (items.length === 1 ? items[0] : null);
    const pick = await choose(items, { header: null, cancel: cancel || undefined });
    const v = pick ? pick.value : (cancel ? cancel.value : undefined);
    if (pick && pick.yes) { setMood('pleased', 4); UI.sfx(it.kind === 'offerTrade' ? 'coins' : it.kind === 'askPeace' || it.kind === 'offerNap' || it.kind === 'offerAlliance' ? 'treaty' : 'confirm'); }
    else if (pick && pick.no) { setMood(it.kind === 'demandBreak' ? 'angry' : 'neutral', 3); }
    terms([]);
    return v;
  }

  // ================================================================ screen / API
  function endAudience() {
    const wasTyping = A.typing, tr = A.typeRes, pend = A.pending;
    A.ended = true; A.active = false; A.token++;
    A.typing = false; A.talking = false; A.typeRes = null; A.pending = null;
    clearFx();
    if (tr) tr();                                                         // unwind any flow still waiting (they reject with Abort because the token changed)
    if (pend) pend.res(null);
    void wasTyping;
  }
  function enterParams(p) {
    const S = G.S, E = S.empires[p.empire]; if (!E) return false;
    A.empire = p.empire; A.race = E.race; A.color = bannerOf(E); A.myColor = bannerOf(me());
    A.mode = p.mode || 'player'; A.from = p.from || 'galaxy'; A.fromParams = p.fromParams || null;
    return true;
  }
  function musicFor(E) {
    const Mu = M.Audio && M.Audio.Music; if (!Mu || !Mu.play) return;
    try {
      let id = 'race:' + E.race;
      const hostile = baseMood() === 'angry' && Mu.list && Mu.list().some(t => t.id === id + ':war');
      if (hostile) id += ':war';
      Mu.play(id, { fade: 1.6 });
    } catch (e) { /* audio is optional */ }
  }
  function startScreen(p) {
    const S = G.S; if (!S) return false;
    if (!enterParams(p)) return false;
    A.ended = false; A.active = true; A.token++; A.recall = 0; A.warned = 0;
    A.text = ''; A.full = ''; A.typing = false; A.pending = null; A.shown = 0; A.talking = false; A.mood = 'neutral';
    A.openT = performance.now() / 1000;
    clearFx(); UI.clear(A.menuEl); UI.clear(A.terms); note(''); A.textEl.textContent = ''; A.textEl.className = 'au-text';
    paintTop(); paintSpeaker('ai'); setMood(baseMood(), 0);
    musicFor(S.empires[A.empire]);
    UI.sfx('open');
    return true;
  }

  UI.Screens.register('audience', {
    create(root) {
      A.cv = h('canvas.au-scene');
      A.who = h('div.au-who'); A.bar = h('div.au-bar'); A.fxEl = h('div.au-fx');
      A.speaker = h('div.au-speaker'); A.terms = h('div.au-terms'); A.textEl = h('div.au-text'); A.note = h('div.au-note'); A.menuEl = h('div.au-menu');
      A.panel = h('div.au-panel.ch', h('i.au-cap.l'), h('i.au-cap.r'), A.speaker, A.terms, A.textEl, A.note, A.menuEl);
      A.el = h('div.au', A.cv, h('div.au-top', A.who, h('div.au-chips', A.bar, A.fxEl)), A.panel);
      root.appendChild(A.el);
      A.built = true;
      const scr = { screen: 'audience' };
      UI.bindKey('space', () => { if (A.typing) finishTyping(); else if (A.pending && A.pending.items.length === 1 && A.pending.items[0].value === 'ok') pickItem(0); }, scr);
      UI.bindKey('enter', () => { if (A.typing) finishTyping(); else if (A.pending && A.focus >= 0) pickItem(A.focus); }, scr);
      UI.bindKey('escape', cancelPick, scr);
      UI.bindKey('arrowdown', () => moveFocus(1), scr); UI.bindKey('arrowup', () => moveFocus(-1), scr);
      for (let k = 1; k <= 9; k++) UI.bindKey(String(k), () => { if (A.pending) pickItem(k - 1); }, scr);
      UI.bindKey('y', () => { const p = A.pending; if (!p) return; const i = p.items.findIndex(x => x.yes); if (i >= 0) pickItem(i); }, scr);
      UI.bindKey('n', () => { const p = A.pending; if (!p) return; const i = p.items.findIndex(x => x.no); if (i >= 0) pickItem(i); }, scr);
      root.addEventListener('contextmenu', e => { e.preventDefault(); cancelPick(); });
      A.panel.addEventListener('click', e => { if (A.typing && e.target.closest('.au-text')) finishTyping(); });
    },
    enter(params) {
      if (!G.S) { UI.Screens.go('menu'); return; }
      params = params || {};
      if (params._audience) return;                                     // started by Audience.open/show: already prepared
      // direct navigation (UI.Screens.go('audience', {empire})): behave like Audience.open
      Audience.open(params.empire, { from: params.from, fromParams: params.fromParams, _entered: true });
    },
    leave() { endAudience(); },
    update(dt, t) {
      A.now = t;
      if (A.typing) {
        A.shown += dt * CPS;
        const n = Math.min(A.full.length, Math.floor(A.shown));
        if (n < A.full.length) { A.textEl.textContent = A.full.slice(0, n); } else finishTyping();
      }
      if (A.moodUntil && t > A.moodUntil) { A.mood = baseMood(); A.moodUntil = 0; }
      if (A.recall > 0) A.recall = Math.min(1, A.recall + dt * 1.1);
      const fps = Math.max(24, Math.min(60, M.Perf && M.Perf.q ? M.Perf.q.animFps : 60));
      if (UI.pace(A.pace || (A.pace = {}), fps, dt)) { A.lastDraw = t; paint(t); }
    },
    resize() { fit(); },
  });

  // ---- session management: one screen visit may host several consecutive conversations -----------------------------------------------------------
  let chain = Promise.resolve();
  function begin(p) {
    clearTimeout(A.exitTimer);
    if (UI.Screens.current && UI.Screens.current.id === 'audience' && A.active && A.empire === p.empire) return true;           // continue the same audience
    if (UI.Screens.current && UI.Screens.current.id === 'audience') endAudience();
    const prev = UI.Screens.current;
    const from = p.from || (prev && prev.id !== 'audience' ? prev.id : 'galaxy');
    const params = Object.assign({}, p, { from, _audience: true });
    UI.Screens.go('audience', params);
    return startScreen(params);
  }
  function leaveScreen() {
    clearTimeout(A.exitTimer);
    A.exitTimer = setTimeout(() => {
      if (A.busyFlow) return;
      if (!UI.Screens.current || UI.Screens.current.id !== 'audience') return;
      const to = A.from && UI.Screens.has(A.from) ? A.from : 'galaxy';
      const sn = M.UI.Soundscape;
      endAudience();
      if (sn && sn.onScreen && to !== 'galaxy') { try { sn.onScreen('galaxy', {}); } catch (e) { /* optional */ } }
      UI.Screens.go(to, A.fromParams || undefined);
    }, 140);
  }
  async function guarded(fn) {
    A.busyFlow = (A.busyFlow | 0) + 1;
    try { return await fn(); }
    catch (e) { if (!(e instanceof Abort)) console.error('[audience]', e); return undefined; }
    finally { A.busyFlow--; }
  }

  const Audience = UI.Audience = {
    line: (spec, extra) => line(spec, extra),            // a say-spec → the line the leader speaks (race voice, else personality); used by the QA scripts
    // player-initiated; resolves when the audience is over and the previous screen is back
    open(aiId, o) {
      o = o || {};
      const run = async () => {
        if (!G.S || !G.S.empires[aiId] || !M.Sim.Diplo) { UI.toast('No audience is possible right now', 'warn'); return false; }
        if (!begin({ empire: aiId, mode: 'player', from: o.from, fromParams: o.fromParams })) return false;
        await guarded(runPlayer);
        leaveScreen();
        return true;
      };
      const p = chain.then(run, run); chain = p.catch(() => {}); return p;
    },
    // AI-initiated (Game.handlers.diplomacy): resolves with the chosen option id for interrupt.answer()
    show(it) {
      const run = async () => {
        if (!G.S || !it || !M.Sim.Diplo) return undefined;
        if (!begin({ empire: it.from, mode: 'ai', from: undefined })) return undefined;
        const v = await guarded(() => runAI(it));
        leaveScreen();
        // an aborted audience (screen left, state gone, another audience begun) is left UNANSWERED: 'skip' makes Turn.run not call the answer,
        // so nothing is accepted (a call to arms would declare war) and nothing is refused either (refusing it would break the alliance)
        if (v === undefined) return 'skip';
        return v;
      };
      const p = chain.then(run, run); chain = p.catch(() => {}); return p;
    },
    isOpen: () => A.active,
  };
})(window.MOO);

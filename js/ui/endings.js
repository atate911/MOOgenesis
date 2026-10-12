// Endings (research/06 §8, research/05 §8): good (Council victory) · tyrant (conquest) · funeral (empire destroyed) · exile (rival elected, ruling accepted).
//
//   MOO.UI.Endings.show(interrupt) -> Promise<{action:'title'|'continue'}>   interrupt = {type:'gameover', reason:'council'|'conquest'|'defeat'|'exile', winner:empireId[, canContinue]}
//        (the interrupt turn.js yields; everything else is derived from Game.S). Plays the scene, the race-specific epilogue (Data.text.epilogue) and a closing GNN-style line,
//        then offers "Return to title" (and "Keep playing" when interrupt.canContinue is set). Space = next, Esc = skip to the last card.
//   screen 'endings'  (params {kind:'good'|'tyrant'|'funeral'|'exile', win, _run}) — the Soundscape glue picks victory/defeat music from kind / win.
// Scenes: good / tyrant = Gfx.Scenes.victory (throne room), funeral = Gfx.Scenes.defeat + a funeral procession, exile = a drifting ship over parallax stars.
(function (M) {
  'use strict';
  const UI = M.UI, U = M.Util, h = UI.h, G = M.Game, doc = document;
  const min = Math.min, max = Math.max, sin = Math.sin, PI = Math.PI, TAU = PI * 2, round = Math.round, floor = Math.floor;
  const Endings = (UI.Endings = {});
  const ENDING = { conquest: 'tyrant', council: 'good', exile: 'exile', defeat: 'funeral' };
  const clamp = U.clamp;
  const setting = (k, d) => { try { const v = M.Settings && M.Settings.get ? M.Settings.get(k) : undefined; return v === undefined ? d : v; } catch (e) { return d; } };
  const reduced = () => !!setting('reduceMotion', false) || !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const PQ = () => (M.Perf && M.Perf.q) || { dpr: 1.5, animFps: 60 };
  const hexOf = c => { try { return getComputedStyle(doc.documentElement).getPropertyValue('--emp' + clamp(round(+c || 0), 0, 5)).trim() || '#4a90e8'; } catch (e) { return '#4a90e8'; } };
  function h2(a, b) {
    let x = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x165667b1, 0x85ebca6b)) | 0;
    x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d); x = Math.imul(x ^ (x >>> 12), 0x297a2d39); x ^= x >>> 15;
    return (x >>> 0) / 4294967296;
  }
  function titleFor(S, winner) {                                    // same algorithm as UI.Council.titleFor
    if (UI.Council && UI.Council.titleFor) return UI.Council.titleFor(S, winner);
    const list = (M.Data && M.Data.names && M.Data.names.councilTitles) || ['High Master of the New Republic'];
    return list[U.hash(String(S && S.seed) + '|' + ((S && S.gameOver && S.gameOver.year) || (S && S.year) || 0) + '|' + winner) % list.length];
  }

  // ================================================================== the script of each ending
  function script(it) {
    const S = G.S, me = S ? S.empires[S.playerId] : null, race = me ? me.race : 'human', leader = me ? me.leader : 'The Emperor', rn = me ? (me.plural || me.name) : 'Humans';
    const W = S && it.winner >= 0 ? S.empires[it.winner] : null, ep = (M.Data && M.Data.text && M.Data.text.epilogue) || { victory: {}, defeat: {} };
    const year = S ? M.Data.Config.displayYear(S) : '';
    let kind = ENDING[it.reason] || it.ending || 'funeral';
    if (kind === 'tyrant' && W && S && W.id !== S.playerId) kind = 'funeral';          // somebody else conquered the galaxy
    if (kind === 'good' && W && S && W.id !== S.playerId) kind = 'exile';
    const win = kind === 'good' || kind === 'tyrant';
    const T = { kind, win, race, color: hexOf(me ? me.color : 0), me, W, S };
    if (kind === 'good') {
      T.heading = 'A new era'; T.beats = [
        { head: 'Year ' + year, text: 'The Galactic Council has spoken, and the galaxy listens.' },
        { head: leader + ' of the ' + rn, text: 'is raised to ' + titleFor(S, S ? S.playerId : 0) + ', and returns to Orion, throne-world of the Ancients, to the roar of a united galaxy.' },
        { head: 'The new millennium', text: (ep.victory.council && ep.victory.council[race]) || 'A new era has dawned. Old quarrels are set aside, and the stars greet a united galaxy.' }];
      T.gnn = 'GNN reports one throne, many worlds and a surprisingly polite parliament. Good night, galaxy.';
    } else if (kind === 'tyrant') {
      T.heading = 'The galaxy is yours'; T.beats = [
        { head: 'Year ' + year, text: 'The last rival banner has fallen.' },
        { head: leader + ' of the ' + rn, text: 'Every star in the galaxy now answers to a single name. Bow, or be remembered as one who did not.' },
        { head: 'Master of Orion', text: (ep.victory.conquest && ep.victory.conquest[race]) || 'The universe is yours and all shall bow before you.' }];
      T.gnn = 'GNN notes the galaxy now has one ruler, one opinion and a very short list of approved headlines.';
    } else if (kind === 'exile') {
      const wn = W ? W.leader + ' of the ' + (W.plural || W.name) : 'a rival';
      T.heading = 'Exile'; T.beats = [
        { head: 'Year ' + year, text: 'The Council has chosen ' + wn + ', and ' + leader + ' of the ' + rn + ' has accepted the ruling — and with it the long road out.' },
        { head: 'Beyond the Rim', text: 'Past the last charted star a lone ship runs dark and patient. Its captain remembers the throne-world of Orion, and Orion, one hopes, does not remember them.' }];
      T.gnn = '';
    } else {
      T.heading = 'The end'; T.beats = [
        { head: 'Year ' + year, text: 'The empire of ' + leader + ' is no more.' },
        { head: 'The funeral', text: (ep.defeat && ep.defeat[race]) || 'The last banner is lowered, and the galaxy moves on.' }];
      T.gnn = '';
    }
    return T;
  }

  // ================================================================== styles / DOM
  UI.css('endings', `
    .end { position:absolute; inset:0; overflow:hidden; background:#02040e; outline:none; user-select:none; }
    .end-cv { position:absolute; inset:0; width:100%; height:100%; }
    .end-shade { position:absolute; left:0; right:0; bottom:0; height:46%; pointer-events:none; background:linear-gradient(0deg, rgba(2,4,14,.92), rgba(2,4,14,.62) 55%, rgba(2,4,14,0)); }
    .end-cap { position:absolute; left:50%; bottom:7%; width:min(80%, 62rem); transform:translateX(-50%); text-align:center; text-shadow:0 2px 14px #000, 0 0 3px #000; }
    .end-cap .hd { font:400 clamp(1.5rem, 3.6vh, 2.5rem)/1.1 var(--font-title); color:var(--brass-hi); letter-spacing:.05em; margin-bottom:.5rem; }
    .end-cap p { margin:0; font:400 clamp(1.05rem, 2.5vh, 1.6rem)/1.4 var(--font-title); color:var(--ivory); }
    .end-cap.in > * { animation:end-in .9s var(--ease) both; } .end-cap.in p { animation-delay:.25s; }
    @keyframes end-in { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }
    .end-gnn { margin:1rem auto 0; max-width:50rem; padding:.55rem 1.1rem; font:500 1rem/1.35 var(--font-ui); color:var(--ivory); letter-spacing:.02em; background:linear-gradient(90deg, rgba(8,12,40,.92), rgba(24,34,90,.88)); border-left:.5rem solid var(--brass); text-align:left; }
    .end-gnn b { margin-right:.7rem; font:400 .95rem var(--font-display); color:var(--brass-hi); letter-spacing:.14em; }
    .end-act { margin-top:1.1rem; display:flex; gap:.8rem; justify-content:center; }
    .end-hint { position:absolute; left:1rem; bottom:.6rem; font:400 .8rem var(--font-ui); color:var(--mist); opacity:.85; pointer-events:none; }
    .end-hint kbd { padding:.04rem .38rem; margin-right:.3rem; font:600 .72rem var(--font-ui); color:var(--brass-hi); background:rgba(214,179,106,.14); box-shadow:inset 0 0 0 1px rgba(214,179,106,.4); }
  `);
  const EN = {};
  let RUN = null, chain = Promise.resolve();
  function build(root) {
    EN.cv = h('canvas.end-cv'); EN.cap = h('div.end-cap'); EN.hint = h('div.end-hint');
    EN.root = h('div.end', { tabindex: '-1' }, EN.cv, h('div.end-shade'), EN.cap, EN.hint);
    EN.root.addEventListener('contextmenu', e => { e.preventDefault(); act('skip'); });
    EN.root.addEventListener('pointerdown', e => { if (e.button === 0 && !e.target.closest('button')) act('next'); });
    root.appendChild(EN.root);
  }

  // ================================================================== painters
  function fitCv() {
    const cv = EN.cv, dpr = min(window.devicePixelRatio || 1, PQ().dpr || 1.5, 1.75), w = cv.clientWidth, hh = cv.clientHeight;
    if (w < 40 || hh < 40) return null;
    const bw = round(w * dpr), bh = round(hh * dpr);
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g, w, h: hh };
  }
  function paintExile(g, w, hh, t, R) {
    g.fillStyle = '#02030c'; g.fillRect(0, 0, w, hh);
    const gr = g.createRadialGradient(w * 0.72, hh * 0.38, 0, w * 0.72, hh * 0.38, w * 0.75); gr.addColorStop(0, 'rgba(70,46,150,.38)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, hh);
    for (let L = 0; L < 3; L++) {                                     // three parallax star layers
      const n = 60 + L * 45, sp = 6 + L * 20, sz = 1 + L * 0.8; g.fillStyle = L === 2 ? '#ffffff' : '#b8c4ff'; g.globalAlpha = 0.4 + L * 0.2;
      for (let i = 0; i < n; i++) g.fillRect((((h2(i, L * 7 + 1) * w - t * sp) % w) + w) % w, h2(i, L * 7 + 2) * hh, sz, sz);
    }
    g.globalAlpha = 1;
    const Pl = M.Gfx && M.Gfx.Planets, Sh = M.Gfx && M.Gfx.Ships;
    const k = clamp(t / 40, 0, 1), pr = hh * (0.2 - 0.15 * k);                                   // the throne-world of Orion recedes
    try { if (Pl && Pl.draw) { g.globalAlpha = 0.9 - 0.4 * k; Pl.draw(g, { look: 'terran', seed: 7, inhabited: true }, w * (0.82 - 0.06 * k), hh * 0.3, pr, t, { dpr: 1 }); g.globalAlpha = 1; } } catch (e) { g.globalAlpha = 1; }
    const sx = w * (0.42 + 0.06 * sin(t * 0.2)), sy = hh * 0.55 + sin(t * 0.7) * hh * 0.012;
    try { if (Sh && Sh.draw) Sh.draw(g, { race: R.T.race, hull: 'cruiser', x: sx, y: sy, size: hh * 0.2, angle: PI, color: R.T.color, t, thrust: 0.8 }); } catch (e) { /* no ship art */ }
  }
  function paintFuneral(g, w, hh, t, R) {
    const Sc = M.Gfx && M.Gfx.Scenes, ok = Sc && Sc.defeat;
    if (ok) { try { Sc.defeat.draw(g, w, hh, t, { race: R.T.race, kind: 'both' }); } catch (e) { g.fillStyle = '#12040a'; g.fillRect(0, 0, w, hh); } } else { g.fillStyle = '#12040a'; g.fillRect(0, 0, w, hh); }
    // the procession: flag bearer, four bearers with the coffin under the empire's banner, mourners with lanterns, marching down the slope
    const col = R.T.color, base = hh * 0.8, slope = 0.1, n = 12, sp = 22, gap = w * 0.055, u = hh * 0.05;
    g.save(); g.globalAlpha = 0.97;
    for (let i = 0; i < n; i++) {
      const x = ((i * gap + t * sp) % (w + gap * 2)) - gap, y = base + (x - w * 0.5) * slope;
      g.fillStyle = '#05060f'; g.fillRect(x - u * 0.28, y - u * 1.3, u * 0.56, u * 1.3); g.beginPath(); g.arc(x, y - u * 1.5, u * 0.22, 0, TAU); g.fill();
      if (i === 0) { g.fillRect(x + u * 0.3, y - u * 3.4, u * 0.06, u * 3.4); g.fillStyle = col; g.beginPath(); g.moveTo(x + u * 0.36, y - u * 3.4); g.lineTo(x + u * (1.5 + 0.12 * sin(t * 2)), y - u * 3.0); g.lineTo(x + u * 0.36, y - u * 2.5); g.closePath(); g.fill(); }
      else if (i === 5 || i === 6) { g.fillStyle = '#05060f'; g.fillRect(x - u * 0.6, y - u * 1.9, u * 1.2, u * 0.34); g.fillStyle = col; g.fillRect(x - u * 0.55, y - u * 1.94, u * 1.1, u * 0.2); }
      else if (i % 3 === 0) { g.globalCompositeOperation = 'lighter'; const lg = g.createRadialGradient(x + u * 0.45, y - u * 0.8, 0, x + u * 0.45, y - u * 0.8, u * 0.9); lg.addColorStop(0, 'rgba(255,190,90,.8)'); lg.addColorStop(1, 'rgba(255,120,30,0)'); g.fillStyle = lg; g.fillRect(x - u, y - u * 2, u * 2.4, u * 2.4); g.globalCompositeOperation = 'source-over'; }
    }
    g.restore();
  }
  function paint(R, dt) {
    const f = fitCv(); if (!f) return;
    const t = R.rm ? 3 : R.t, Sc = M.Gfx && M.Gfx.Scenes, g = f.g, k = R.T.kind;
    if (k === 'exile') paintExile(g, f.w, f.h, t, R);
    else if (k === 'funeral') paintFuneral(g, f.w, f.h, t, R);
    else {
      let ok = false;
      if (Sc && Sc.victory) { try { Sc.victory.draw(g, f.w, f.h, t, { race: R.T.race, color: k === 'tyrant' ? '#b0303a' : R.T.color }); ok = true; } catch (e) { ok = false; } }
      if (!ok) { g.fillStyle = '#0a0828'; g.fillRect(0, 0, f.w, f.h); }
      if (k === 'tyrant') { g.fillStyle = 'rgba(80,0,10,.22)'; g.fillRect(0, 0, f.w, f.h); }
    }
    void dt;
  }

  // ================================================================== sequencing
  function showBeat(R, i) {
    R.i = i; clearTimeout(R.timer);
    const b = R.T.beats[i];
    UI.clear(EN.cap); EN.cap.classList.remove('in'); void EN.cap.offsetWidth; EN.cap.classList.add('in');
    EN.cap.appendChild(h('div.hd', b.head)); EN.cap.appendChild(h('p', b.text));
    const last = i >= R.T.beats.length - 1;
    EN.hint.innerHTML = '<kbd>Space</kbd>next &nbsp; <kbd>Esc</kbd>skip';
    if (last) { R.timer = setTimeout(() => showFinal(R), R.rm ? 1500 : max(4500, b.text.length * 60)); }
    else R.timer = setTimeout(() => showBeat(R, i + 1), R.rm ? 1500 : max(3600, b.text.length * 55));
  }
  function showFinal(R) {
    if (R.final) return; R.final = true; clearTimeout(R.timer);
    const T = R.T, spec = R.spec, canKeep = !!(spec.it && spec.it.canContinue) && T.win;
    const finish = action => { if (R.done) return; R.done = true; spec.resolve({ action }); if (action === 'title') setTimeout(() => { if (G.quitToMenu) G.quitToMenu(); else if (UI.Screens.has('menu')) UI.Screens.go('menu'); }, 0); };
    const buttons = [UI.button('Return to title', () => finish('title'), { primary: true, big: true })];
    if (canKeep) buttons.unshift(UI.button('Keep playing', () => { finish('continue'); if (UI.Screens.has('galaxy')) UI.Screens.go('galaxy'); }, { big: true }));
    UI.clear(EN.cap); EN.cap.classList.remove('in'); void EN.cap.offsetWidth; EN.cap.classList.add('in');
    EN.cap.appendChild(h('div.hd', T.win ? (T.kind === 'good' ? 'Victory' : 'Conquest') : 'Defeat'));
    EN.cap.appendChild(h('p', T.beats[T.beats.length - 1].text));
    if (T.gnn) EN.cap.appendChild(h('div.end-gnn', h('b', 'GNN'), T.gnn));
    EN.cap.appendChild(h('div.end-act', buttons));
    EN.hint.innerHTML = '';
    if (T.win) UI.sfx('tech', 'confirm');
    setTimeout(() => { const b = EN.cap.querySelector('.btn.primary'); if (b) b.focus(); }, 60);
  }
  function act(a) {
    const R = RUN; if (!R || R.done) return;
    if (a === 'skip') { if (!R.final) showFinal(R); }
    else if (a === 'next') { if (R.final) return; if (R.i >= R.T.beats.length - 1) showFinal(R); else showBeat(R, R.i + 1); }
  }
  (function bindKeys() {
    const scr = { screen: 'endings' };
    UI.bindKey('space', e => { if (!e || !e.repeat) act('next'); }, scr); UI.bindKey('enter', e => { if (!e || !e.repeat) { if (RUN && RUN.final) return; act('next'); } }, scr);
    UI.bindKey('escape', () => act('skip'), scr);
  })();

  // ================================================================== screen + API
  function frame(dt) {
    const R = RUN; if (!R) return;
    dt = min(dt, 0.1); R.t += dt; R.acc += dt;
    const fps = R.rm ? 0 : (PQ().animFps || 60);
    if (R.rm ? !R.dirty : (fps < 59 && R.acc < 1 / fps - 0.002)) return;
    const d = R.acc; R.acc = 0; R.dirty = false;
    paint(R, d);
  }
  UI.Screens.register('endings', {
    create(el) { build(el); },
    enter(params) {
      const spec = params && params._run;
      if (RUN && spec && RUN.spec === spec) return;
      if (RUN && !RUN.done) { RUN.done = true; try { RUN.spec.resolve({ action: 'interrupted' }); } catch (e) { /* ignore */ } }
      const it = spec ? spec.it : { reason: (params && params.reason) || 'council', winner: G.S ? G.S.playerId : 0 };
      const T = script(it);
      const R = RUN = { spec: spec || { it, resolve: () => {} }, T, t: 0, acc: 0, rm: reduced(), dirty: true, i: 0, timer: 0, final: false, done: false };
      clearTimeout(R.timer);
      try { EN.root.focus({ preventScroll: true }); } catch (e) { /* not focusable yet */ }
      showBeat(R, 0);
    },
    leave() { const R = RUN; if (!R) return; clearTimeout(R.timer); RUN = null; if (!R.done) { R.done = true; try { R.spec.resolve({ action: 'interrupted' }); } catch (e) { /* ignore */ } } },
    update(dt) { frame(dt); },
    resize() { if (RUN) RUN.dirty = true; },
  });
  Endings.show = function (it) {
    it = it || {};
    const run = () => new Promise(resolve => {
      const T = script(it);
      try { UI.Screens.go('endings', { kind: T.kind, win: T.win, _run: { it, resolve } }); } catch (e) { console.error('[endings]', e); resolve({ action: 'error' }); }
    });
    const p = chain.then(run); chain = p.then(() => {}, () => {});
    return p;
  };
  Endings.kindOf = it => script(it || {}).kind;
})(window.MOO);

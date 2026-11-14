// The score player (modal): listen to any piece of the score from inside the game.
//   MOO.UI.scorePlayer() -> Promise resolved when the player is closed. Opened from the Game menu (gamemenu.js, 'Score player', hotkey M).
// The game's music is snapshotted when the player opens and restored when it closes (the interrupted piece resumes where it was, as the
// GNN broadcast does it). Pieces come from Music.catalogue() (the readings and interludes included, the bridges left out); the transport
// drives Music.play with { from, perf } so a seek or a resume keeps the same performance. 'Repeat' loops one piece as the game does;
// 'Play on' runs on through the list shown. Music volume is the game's own setting (Audio.setVolume). Esc / right-click close it.
// The (i) button (key I) opens a card from UI.ScoreNotes (scoreplayer-notes.js): where the game plays the piece, moments to listen for (each
// with a jump), the shared tunes (a chip filters the list to the pieces that share it), its other versions and the facts. The player also
// switches the track-name announcements (Settings 'trackNames', off by default): see the poller at the end.
(function (M) {
  'use strict';
  const UI = M.UI, h = UI.h;
  const C = () => UI.Controls;
  const A = () => M.Audio || null;
  const Mu = () => (A() && A().Music) || null;
  let open = null, cat = null;

  // names the listener knows the pieces by (MUSIC-REVIEW.md); anything unlisted falls back to the head of its description
  const NAMES = {
    title: 'Main theme', 'title:grand': 'Main theme — grand',
    galaxy1: 'Wonder', galaxy2: 'Patience', galaxy3: 'Determination', galaxy4: 'Deep Field', galaxy5: 'The Veil', galaxy6: 'The Abyss', galaxy7: 'The Cradle',
    galaxy8: 'The Beacon', galaxy9: 'The Tide', galaxy10: 'The Chorale', galaxy11: 'The Nebula', galaxy12: 'The Long Night', galaxy13: 'The Watch',
    galaxy14: 'First Light', galaxy15: 'The Lantern', galaxy16: 'The Survey', galaxy17: 'The Commonwealth', galaxy18: 'The Lanes', galaxy19: 'Noon',
    galaxy20: 'The Frontier', galaxy21: 'The Embers', galaxy22: 'The Vigil', galaxy23: 'The Weaver',
    combat3: 'Battle', combat1: 'Battle — the gallop', combat2: 'Battle — the assault', ground: 'Ground assault', council2: 'Council in state',
    procession: 'The Procession', gnn: 'Galactic News', lab1: 'The Laboratory', lab2: 'Discovery', lab3: 'The Instrument', spy: 'Espionage',
    orion: 'Orion', antarans: 'The Antarans', victory: 'Victory', defeat: 'Defeat',
    drift: 'Drift', drift2: 'Drift, the choir', drift3: 'Drift, the held note', drift4: 'Drift, horizon', drift5: 'Drift, harp', drift6: 'Drift, the violas', drift7: 'Drift, voices',
  };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function nameOf(e) {
    if (NAMES[e.id]) return NAMES[e.id];
    const race = /^race:([a-z]+)(:war)?$/.exec(e.id);
    if (race) return cap(race[1]) + (race[2] ? ' — at war' : '');
    const war = /^(.+):(war|hits)$/.exec(e.id);
    if (war && NAMES[war[1]]) return NAMES[war[1]] + ', at war';
    const head = String(e.desc || e.id).split(/[:—–,]/)[0].trim();
    return head ? cap(head) : e.id;
  }
  const GROUPS = [
    { id: 'all', label: 'All' },
    { id: 'theme', label: 'Main theme' },
    { id: 'map', label: 'Map' },
    { id: 'cue', label: 'Scenes' },
    { id: 'race', label: 'Races' },
    { id: 'drift', label: 'Interludes' },
  ];
  function groupOf(e) {
    if (e.id === 'title' || e.variantOf === 'title') return 'theme';
    if (/^race:/.test(e.id)) return 'race';
    if (e.interlude) return 'drift';
    if (/^galaxy\d+/.test(e.id)) return 'map';
    return 'cue';
  }
  const ORDER = { theme: 0, map: 1, cue: 2, race: 3, drift: 4 };
  const num = id => { const m = /(\d+)/.exec(id); return m ? +m[1] : 0; };

  function catalogue() {
    if (cat) return cat;
    const m = Mu(); if (!m || typeof m.catalogue !== 'function') return null;
    try {
      const ix = typeof m.themeIndex === 'function' ? m.themeIndex() : {}, N = UI.ScoreNotes;
      const themesOf = id => Object.keys(ix).filter(t => ix[t].indexOf(id) >= 0);
      // only what the game plays: the title screen's grand reading is listed; the main theme's other readings (cello, chamber, reed, symphony,
      // the undercurrent) were studies and are left out
      cat = m.catalogue(['title:grand']).filter(e => e.variantOf !== 'title').map(e => Object.assign(e, {
        name: nameOf(e), group: groupOf(e), notes: (N && N.get(e.id)) || null,
        themes: themesOf(e.variantOf || (/^title/.test(e.id) ? 'title' : e.id)),           // a reading shares its piece's tunes
      }));
      cat.sort((a, b) => ORDER[a.group] - ORDER[b.group] || (a.group === 'map' ? num(a.id) - num(b.id) : 0) || (a.variantOf ? 1 : 0) - (b.variantOf ? 1 : 0) || a.name.localeCompare(b.name));
    } catch (e) { console.warn('[scoreplayer] catalogue failed', e); cat = null; }
    return cat;
  }

  const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const MODES = { major: 'major', minor: 'minor', dorian: 'Dorian', lydian: 'Lydian', mixolydian: 'Mixolydian', phrygian: 'Phrygian', harmonic: 'harmonic minor',
    phrygDom: 'Phrygian dominant', dblHarm: 'double harmonic', octaH: 'octatonic', wholetone: 'whole-tone' };
  const keyOf = e => (e.interlude || !e.root ? '' : e.root.replace('b', '\u266d').replace('#', '\u266f') + ' ' + (MODES[e.mode] || e.mode || ''));   // an interlude takes the next piece's key
  const GROUP_LABEL = { theme: 'Main theme', map: 'The map', cue: 'Scene', race: 'Race theme', drift: 'Interlude' };
  const blurbOf = e => (e.notes && e.notes.blurb) || '';
  const trackNames = () => { try { return !!(M.Settings && M.Settings.get('trackNames')); } catch (e) { return false; } };

  UI.scorePlayer = function () {
    if (open) return open;
    const m = Mu(), list = catalogue(), ctl = C();
    if (!m || !list || !list.length) {
      open = UI.modal({ title: 'Score player', body: h('p', 'The music engine is not available.'), buttons: [{ label: 'Close', value: null, primary: true }] }).then(() => { open = null; });
      return open;
    }
    const snap = (() => { try { return m.snapshot(); } catch (e) { return null; } })();
    const st = { group: 'all', theme: null, sel: null, mode: 'repeat', paused: null, playing: null, seeking: false, raf: 0, info: false };
    const byId = {}; list.forEach(e => { byId[e.id] = e; });
    const shown = () => list.filter(e => (st.group === 'all' || e.group === st.group) && (!st.theme || e.themes.indexOf(st.theme) >= 0));
    const TH = (UI.ScoreNotes && UI.ScoreNotes.themes) || {};

    // ---- now playing
    const nTitle = h('div.sp-title', '—'), nSub = h('div.sp-sub'), nDesc = h('div.sp-desc'), infoBox = h('div.sp-info', { hidden: true });
    const infoBtn = h('button.sp-ibtn', { type: 'button', 'aria-label': 'About this piece', 'aria-expanded': 'false', tip: 'About this piece (I)', onclick: () => { UI.sfx('click'); st.info = !st.info; paint(); } }, 'i');
    const fill = h('i.sp-fill'), loopMark = h('b.sp-loop', { tip: 'Where the piece repeats from' }), knob = h('b.sp-knob');
    const seek = h('div.sp-seek', { tabindex: 0, role: 'slider', 'aria-label': 'Position' }, fill, loopMark, knob);
    const tNow = h('span.sp-t', '0:00'), tLen = h('span.sp-t', '0:00'), passTxt = h('span.sp-pass');
    const playBtn = h('button.btn.sp-play', { type: 'button', tip: 'Play / pause (Space)', onclick: () => toggle() });
    const prevBtn = h('button.btn.sp-ico', { type: 'button', tip: 'Previous piece', onclick: () => step(-1) }, ctl.icon('prev'));
    const nextBtn = h('button.btn.sp-ico', { type: 'button', tip: 'Next piece', onclick: () => step(1) }, ctl.icon('next'));
    const modeSeg = ctl.segmented([{ id: 'repeat', label: 'Repeat', tip: 'Loop this piece, as the game does' }, { id: 'on', label: 'Play on', tip: 'Run on through the list' }], st.mode, v => { st.mode = v; if (st.playing) restart(st.playing, here()); }, { label: 'At the end' });
    const getVol = () => { const a = A(); return a && a.settings ? a.settings.music : 0.5; };
    const vol = UI.slider({ label: 'Music', color: 'var(--violet)', min: 0, max: 100, step: 5, value: Math.round(getVol() * 100), fmt: v => v + '%', lockable: false, onChange: v => { const a = A(); if (a && a.setVolume) a.setVolume('music', v / 100); muteNote(); } });
    const note = h('div.sp-note');
    function muteNote() {
      const a = A(), s = a && a.settings;
      note.textContent = s && s.muted ? 'Sound is muted (Options → Sound).' : s && s.music <= 0 ? 'The music volume is at zero.' : '';
    }
    const tnToggle = ctl.toggle(trackNames(), v => { try { M.Settings.set('trackNames', v); } catch (e) { /* settings unavailable */ } }, { label: 'Show track names during play' });
    const now = h('div.sp-now', h('div.sp-head', nTitle, infoBtn), nSub, nDesc, infoBox,
      h('div.sp-bar', tNow, seek, tLen),
      h('div.sp-ctl', prevBtn, playBtn, nextBtn, h('span.sp-gap'), passTxt, modeSeg),
      h('div.sp-vol', vol),
      h('label.sp-opt', { tip: 'When the game moves on to a new piece, its name appears for a few seconds' }, h('span', 'Show track names during play'), tnToggle), note);

    // ---- the list
    const rows = h('div.sp-rows', { role: 'listbox' });
    const tabs = h('div.sp-chips', { role: 'tablist', 'aria-label': 'Show' }, GROUPS.map(g => h('button.sp-chip', { type: 'button', role: 'tab', 'data-g': g.id, onclick: () => { UI.sfx('click'); st.group = g.id; st.theme = null; renderRows(); } }, g.label)));
    const themeBar = h('div.sp-thbar', { hidden: true });
    function renderRows() {
      UI.clear(rows);
      tabs.querySelectorAll('.sp-chip').forEach(b => { const on = !st.theme && b.getAttribute('data-g') === st.group; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
      UI.clear(themeBar); themeBar.hidden = !st.theme;
      if (st.theme) themeBar.append(h('span', 'Pieces that share ', h('b', (TH[st.theme] || {}).name || st.theme)), h('button.sp-x', { type: 'button', 'aria-label': 'Show all pieces', tip: 'Show all pieces', onclick: () => { UI.sfx('click'); st.theme = null; renderRows(); } }, '\u2715'));
      shown().forEach(e => {
        const row = h('button.sp-row', { type: 'button', role: 'option', 'data-id': e.id, tip: blurbOf(e) || null, onclick: () => pick(e.id) },
          h('span.sp-r-n', e.name), h('span.sp-r-k', keyOf(e)), h('span.sp-r-t', fmt(e.seconds)));
        rows.appendChild(row);
      });
      mark();
    }
    function mark() {
      const cur = st.playing || st.sel;
      rows.querySelectorAll('.sp-row').forEach(r => { r.classList.toggle('on', r.getAttribute('data-id') === cur); r.setAttribute('aria-selected', r.getAttribute('data-id') === cur ? 'true' : 'false'); });
      const on = rows.querySelector('.sp-row.on');                    // scroll the list only (scrollIntoView would move the phone sheet too)
      if (on) { const top = on.offsetTop, bot = top + on.offsetHeight; if (top < rows.scrollTop) rows.scrollTop = top; else if (bot > rows.scrollTop + rows.clientHeight) rows.scrollTop = bot - rows.clientHeight; }
    }

    // ---- transport
    function pos() { try { return m.position(); } catch (e) { return null; } }
    function here() { const p = pos(); return p && st.playing === p.id ? { t: p.pass > 0 ? (byId[p.id] ? byId[p.id].loopAt : 0) + p.t : p.t, perf: p.perf } : { t: 0 }; }
    function restart(id, at) {
      const e = byId[id]; if (!e) return;
      at = at || {};
      const from = Math.max(0, Math.min(e.seconds - 1, at.t || 0));
      if (st.mode === 'on') {
        const ids = shown().map(x => x.id); if (ids.indexOf(id) < 0) ids.unshift(id);
        m.playlist(ids, { start: id, gap: 0, gapIn: 0, fade: 2, firstFade: 0.6, from: from > 0.5 ? from : undefined, perf: at.perf, quantize: false });
      } else {
        m.play(id, { restart: true, loop: true, from: from > 0.5 ? from : undefined, perf: at.perf, fade: 0.6, inFade: 0.6, oldFade: 0.8, quantize: false });
      }
      st.playing = id; st.sel = id; st.paused = null; paint();
    }
    function pick(id) { restart(id, { t: 0 }); }
    function toggle() {
      if (st.playing) { st.paused = Object.assign({ id: st.playing }, here()); m.stop({ fade: 0.5 }); st.playing = null; paint(); return; }
      if (st.paused) { const p = st.paused; restart(p.id, p); return; }
      pick(st.sel || shown()[0].id);
    }
    function step(d) {
      const ids = shown().map(x => x.id); if (!ids.length) return;
      const cur = st.playing || st.sel, i = ids.indexOf(cur);
      pick(ids[(i < 0 ? 0 : i + d + ids.length) % ids.length]);
    }
    function seekTo(f) {
      const id = st.playing || (st.paused && st.paused.id) || st.sel; const e = byId[id]; if (!e) return;
      const perf = st.playing ? (pos() || {}).perf : st.paused && st.paused.perf;
      restart(id, { t: f * e.seconds, perf });
    }

    // ---- the (i) card: where the game plays it, moments to listen for (a jump to each), the tunes it shares, its other readings, the facts
    function jump(id, t) { const p = pos(); restart(id, { t, perf: p && p.id === id ? p.perf : undefined }); }
    function card(e) {
      const n = e.notes || {}, out = h('div.sp-card');
      const secT = name => { const x = (e.sections || []).find(s => s.n === name); return x ? x.t : null; };
      const head = t => h('div.sp-i-h', t);
      if (n.where) out.appendChild(h('div.sp-i-s', head('Where you hear it'), h('p', n.where)));
      const L = n.listen || [];
      if (L.length) out.appendChild(h('div.sp-i-s', head('Listen for'), h('ul.sp-i-l', L.map(it => {
        const t = it[0] ? secT(it[0]) : null;
        return h('li', t !== null ? h('button.sp-jump', { type: 'button', tip: 'Play from ' + fmt(t), onclick: () => { UI.sfx('click'); jump(e.id, t); } }, ctl.icon('play'), fmt(t)) : h('span.sp-dot'), h('span', it[1]));
      }))));
      if (e.themes.length) out.appendChild(h('div.sp-i-s', head('Shares a tune'), h('div.sp-i-th', e.themes.map(t => {
        const T = TH[t] || { name: t, about: '' }, k = list.filter(x => x.themes.indexOf(t) >= 0).length;
        return h('button.sp-chip', { type: 'button', tip: (T.about ? T.about + ' ' : '') + 'Show the pieces that share it.', onclick: () => { UI.sfx('click'); st.theme = t; st.group = 'all'; renderRows(); } }, T.name + ' \u00b7 ' + k);
      }))));
      const kin = list.filter(x => x !== e && ((e.variantOf && (x.id === e.variantOf || x.variantOf === e.variantOf)) || x.variantOf === e.id));   // its other readings
      if (kin.length) out.appendChild(h('div.sp-i-s', head(e.group === 'race' ? (e.variantOf ? 'The peaceful version' : 'The hostile version') : 'Other versions'),
        h('div.sp-i-th', kin.map(x => h('button.sp-chip', { type: 'button', onclick: () => { UI.sfx('click'); const p = pos(); if (p && p.id === e.id && e.group === 'race') jump(x.id, Math.min(p.t * x.seconds / e.seconds, x.seconds - 2)); else pick(x.id); } }, x.name)))));
      const facts = [keyOf(e) && ['Key', keyOf(e)], e.interlude && ['Key', 'Changes to lead into the next piece'], e.bpm && ['Tempo', e.bpm + ' beats a minute'], ['Length', fmt(e.seconds)], e.loopAt > 1 && ['Repeats from', fmt(e.loopAt)]].filter(Boolean);
      out.appendChild(h('dl.sp-facts', facts.map(f => [h('dt', f[0]), h('dd', f[1])])));
      return out;
    }

    // ---- painting (the position is read every frame while open)
    function paint() {
      const id = st.playing || (st.paused && st.paused.id) || st.sel, e = byId[id];
      nTitle.textContent = e ? e.name : 'Choose a piece';
      nSub.textContent = e ? [GROUP_LABEL[e.group], keyOf(e)].filter(Boolean).join(' · ') : '';
      nDesc.textContent = e ? blurbOf(e) : 'Every piece of the score, played by the game\u2019s own engine. The game\u2019s music returns when you close the player.';
      infoBtn.classList.toggle('on', st.info); infoBtn.setAttribute('aria-expanded', st.info ? 'true' : 'false'); infoBtn.hidden = !e;
      infoBox.hidden = !(st.info && e);
      if (st.info && e) { UI.clear(infoBox); infoBox.appendChild(card(e)); }
      tLen.textContent = e ? fmt(e.seconds) : '0:00';
      loopMark.style.left = e && e.loopAt > 0 ? (100 * e.loopAt / e.seconds) + '%' : '';
      loopMark.style.display = e && e.loopAt > 0 ? '' : 'none';
      UI.clear(playBtn); playBtn.appendChild(ctl.icon(st.playing ? 'pause' : 'play')); playBtn.appendChild(document.createTextNode(st.playing ? 'Pause' : 'Play'));
      mark();
    }
    function tick() {
      st.raf = requestAnimationFrame(tick);
      const p = pos();
      if (st.playing && p && p.id !== st.playing && byId[p.id]) { st.playing = p.id; st.sel = p.id; paint(); }   // 'play on' moved to the next piece
      if (st.playing && !p && !(m.current && m.current())) { st.playing = null; paint(); }                         // ended (or stopped elsewhere)
      const e = byId[st.playing || (st.paused && st.paused.id) || st.sel];
      if (st.seeking || !e) return;
      let t = 0, label = '';
      if (st.playing && p && p.id === st.playing) {
        t = p.pass > 0 ? e.loopAt + p.t * (e.seconds - e.loopAt) / Math.max(1, p.len) : p.t;   // a repeat is drawn over the stretch it repeats
        label = p.pass > 0 ? 'repeat ' + p.pass : '';
      } else if (st.paused) t = st.paused.t;
      const f = Math.max(0, Math.min(1, t / e.seconds));
      fill.style.width = (f * 100) + '%'; knob.style.left = (f * 100) + '%';
      tNow.textContent = fmt(t); passTxt.textContent = label;
    }
    // drag to seek: the knob follows the pointer, the music jumps on release
    const fracAt = ev => { const r = seek.getBoundingClientRect(); return Math.max(0, Math.min(1, (ev.clientX - r.left) / Math.max(1, r.width))); };
    seek.addEventListener('pointerdown', ev => {
      st.seeking = true; seek.setPointerCapture(ev.pointerId);
      const show = e2 => { const f = fracAt(e2), e = byId[st.playing || (st.paused && st.paused.id) || st.sel]; fill.style.width = knob.style.left = (f * 100) + '%'; if (e) tNow.textContent = fmt(f * e.seconds); };
      show(ev); seek.onpointermove = show;
    });
    const endSeek = ev => { if (!st.seeking) return; seek.onpointermove = null; st.seeking = false; if (ev.type === 'pointerup') seekTo(fracAt(ev)); };
    seek.addEventListener('pointerup', endSeek); seek.addEventListener('pointercancel', endSeek);
    seek.addEventListener('keydown', ev => {
      const e = byId[st.playing || st.sel]; if (!e) return;
      const d = ev.key === 'ArrowRight' ? 10 : ev.key === 'ArrowLeft' ? -10 : 0; if (!d) return;
      ev.preventDefault(); ev.stopPropagation(); seekTo(Math.max(0, Math.min(1, (here().t + d) / e.seconds)));
    });

    const cur = (() => { try { return m.current(); } catch (e) { return null; } })();
    st.sel = byId[cur] ? cur : (byId[snap && snap.resume && snap.resume.id] ? snap.resume.id : list[0].id);   // open on what the game is playing
    renderRows(); muteNote(); paint();
    const body = h('div.sp', now, h('div.sp-list', h('div.sp-tabs', tabs), themeBar, rows));
    const pm = UI.modal({ title: 'Score player', body, buttons: [{ label: 'Close', value: null, primary: true }], width: '52rem', cls: 'sp-modal', autofocus: false });
    const inCtl = ev => !!(ev && ev.target && ev.target.closest && ev.target.closest('.s-track, .sp-seek'));   // the volume slider and the seek bar keep their arrows
    const keys = {
      i: () => { st.info = !st.info; paint(); return true; }, I: () => { st.info = !st.info; paint(); return true; },
      ' ': () => { toggle(); return true; }, ArrowDown: ev => { if (inCtl(ev)) return false; step(1); return true; }, ArrowUp: ev => { if (inCtl(ev)) return false; step(-1); return true; },
      ArrowRight: ev => { const e = byId[st.playing]; if (!e || inCtl(ev)) return false; seekTo(Math.min(1, (here().t + 10) / e.seconds)); return true; },
      ArrowLeft: ev => { const e = byId[st.playing]; if (!e || inCtl(ev)) return false; seekTo(Math.max(0, (here().t - 10) / e.seconds)); return true; },
    };
    const off = ctl.keyScope(pm.el, keys), off2 = ctl.trapFocus(pm.el);
    ctl.rightClick(pm.el.parentNode, () => pm.close(null));
    st.raf = requestAnimationFrame(tick);
    open = pm.then(() => {
      off(); off2(); cancelAnimationFrame(st.raf); open = null;
      applyPin();
      try { m.restore(snap, { resume: true, fade: 1.5 }); } catch (e) { /* audio is optional */ }    // the game's music comes back where it was
      ann.last = nowId();                                                                             // ... without announcing it
    });
    applyPin();                                                        // the pinned caption steps aside while the player is open
    return open;
  };

  // ---- track names during play (Settings 'trackNames', off by default; switched in the player): when the game moves on to a new piece its
  // name fades in as a quiet caption low on the map's left, holds about five seconds and fades out. Polled once a second (the engine has no event for it); interludes, bridges and the player's own choices are left out.
  const ann = { last: null };
  function nowId() { const m = Mu(); try { const p = m && m.position ? m.position() : null; return p ? p.id : null; } catch (e) { return null; } }
  // a caption, not a notice: no panel, low on the left over the map, fading in over a second, held five, fading out over a second and a half.
  // Pinned (Settings 'trackNamePin', the map's note button, only while track names are on): it stays on the galaxy map and changes with the music.
  const NP_IN = 1100, NP_HOLD = 5000, NP_OUT = 1600, NP_SWAP = 500;
  let np = null, npTimers = [], lastNamed = null, curScreen = null;
  const pinOn = () => trackNames() && !!(M.Settings && M.Settings.get('trackNamePin'));
  const pinShown = () => pinOn() && curScreen === 'galaxy' && !open;
  function capFill(e) {
    const ctl = C();
    if (!np) { np = h('div.sp-cap', { 'aria-live': 'polite', role: 'status' }); document.body.appendChild(np); }
    UI.clear(np);
    np.append(ctl ? ctl.icon('music') : '', h('span.sp-cap-n', e.name), h('span.sp-cap-g', GROUP_LABEL[e.group] || ''));
  }
  const clearTimers = () => { npTimers.forEach(clearTimeout); npTimers = []; };
  function announce(e) {
    lastNamed = e;
    clearTimers();
    if (pinShown() && np && np.classList.contains('on')) {            // pinned and showing: a short fade to the new name
      np.classList.add('swap');
      npTimers.push(setTimeout(() => { capFill(e); np.classList.add('on', 'pinned'); np.classList.remove('swap'); }, NP_SWAP));
      return;
    }
    capFill(e);
    np.classList.remove('on', 'swap'); np.classList.toggle('pinned', pinShown());
    void np.offsetWidth;                                                   // restart the fade from transparent
    npTimers.push(setTimeout(() => np.classList.add('on'), 20));
    if (!pinShown()) npTimers.push(setTimeout(() => np.classList.remove('on'), 20 + NP_IN + NP_HOLD));
  }
  // the pin switched, the screen changed, the player opened or closed: show or put away the pinned caption
  function applyPin() {
    if (pinShown()) {
      if (!lastNamed) { const id = nowId(), list = id && catalogue(), e = list && list.find(x => x.id === id && !x.interlude); if (e) lastNamed = e; }
      if (!lastNamed) return;
      clearTimers(); capFill(lastNamed); np.classList.add('pinned'); np.classList.remove('swap');
      npTimers.push(setTimeout(() => np.classList.add('on'), 20));
    } else if (np && np.classList.contains('pinned')) { clearTimers(); np.classList.remove('on', 'pinned', 'swap'); }
  }
  UI.TrackPin = {
    available: trackNames,
    on: () => !!(M.Settings && M.Settings.get('trackNamePin')),
    toggle() { try { M.Settings.set('trackNamePin', !UI.TrackPin.on()); } catch (e) { /* settings unavailable */ } },
  };
  if (M.Bus) {
    M.Bus.on('screen', id => { curScreen = id; applyPin(); });
    M.Bus.on('settings', k => { if (!k || k === 'trackNames' || k === 'trackNamePin') applyPin(); });
  }
  curScreen = UI.Screens && UI.Screens.current ? UI.Screens.current.id : null;
  setInterval(() => {
    if (open || !UI.toast) return;
    const id = nowId();
    if (id === ann.last) return;
    ann.last = id;
    if (!id || !trackNames()) return;
    const list = catalogue(), e = list && list.find(x => x.id === id);
    if (e && !e.interlude) announce(e);
  }, 1000);

  UI.css('scoreplayer', `
    .sp-modal { max-width:calc(100vw - 2rem); }
    .sp { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:1.1rem; min-height:24rem; }
    .sp-now { display:flex; flex-direction:column; gap:.55rem; min-width:0; }
    .sp-thbar[hidden], .sp-info[hidden], .sp-ibtn[hidden] { display:none; }
    .sp-head { display:flex; align-items:flex-start; gap:.6rem; }
    .sp-title { flex:1; min-width:0; font:400 1.55rem/1.15 var(--font-display); color:var(--brass-hi); }
    .sp-ibtn { flex:none; width:1.7rem; height:1.7rem; margin-top:.1rem; border-radius:50%; border:1px solid var(--brass); background:transparent; color:var(--brass-hi);
      font:italic 600 1rem/1 Georgia, 'Times New Roman', serif; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; }
    .sp-ibtn:hover, .sp-ibtn:focus-visible { background:rgba(214,179,106,.14); outline:none; }
    .sp-ibtn.on { background:var(--brass); color:#10131f; }
    .sp-info { border:1px solid rgba(214,179,106,.25); background:rgba(10,12,28,.5); padding:.6rem .75rem; max-height:15.5rem; overflow:auto; }
    .sp-card { display:flex; flex-direction:column; gap:.65rem; font-size:.9rem; }
    .sp-i-h { font:400 .78rem/1 var(--font-display); letter-spacing:.08em; text-transform:uppercase; color:var(--brass); margin-bottom:.3rem; }
    .sp-i-s p { margin:0; color:var(--ivory); }
    .sp-i-l { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:.3rem; }
    .sp-i-l li { display:flex; align-items:baseline; gap:.55rem; color:var(--ivory); }
    .sp-jump { flex:none; display:inline-flex; align-items:center; gap:.25em; min-width:3.6em; padding:.1rem .4rem; border:1px solid rgba(150,120,255,.5); background:rgba(150,120,255,.12);
      color:var(--ivory); font:inherit; font-size:.8rem; font-variant-numeric:tabular-nums; cursor:pointer; }
    .sp-jump:hover, .sp-jump:focus-visible { background:rgba(150,120,255,.3); outline:none; }
    .sp-jump .ico { width:.8em; height:.8em; }
    .sp-dot { flex:none; min-width:3.6em; text-align:center; color:var(--brass); }
    .sp-dot::before { content:'\u2022'; }
    .sp-i-th { display:flex; flex-wrap:wrap; gap:.3rem; }
    .sp-facts { display:grid; grid-template-columns:auto 1fr; gap:.15rem .8rem; margin:0; padding-top:.45rem; border-top:1px solid rgba(214,179,106,.15); font-size:.84rem; }
    .sp-facts dt { color:var(--mist); } .sp-facts dd { margin:0; color:var(--ivory); }
    .sp-opt { display:flex; align-items:center; justify-content:space-between; gap:.8rem; color:var(--ivory); font-size:.9rem; cursor:pointer; }
    .sp-thbar { display:flex; align-items:center; justify-content:space-between; gap:.5rem; padding:.3rem .55rem; background:rgba(150,120,255,.12); color:var(--ivory); font-size:.88rem; }
    .sp-thbar b { color:var(--brass-hi); font-weight:600; }
    .sp-x { background:none; border:0; color:var(--mist); cursor:pointer; font-size:1rem; padding:0 .2rem; } .sp-x:hover { color:var(--ivory); }
    .sp-cap { position:fixed; z-index:140; left:1.4rem; bottom:5.6rem; display:flex; align-items:baseline; gap:.5rem; max-width:min(26rem, 60vw);
      pointer-events:none; opacity:0; transform:translateY(.3rem); transition:opacity ${NP_OUT}ms ease-in-out, transform ${NP_OUT}ms ease-in-out;
      color:var(--ivory); text-shadow:0 1px 3px rgba(0,0,0,.9), 0 0 12px rgba(0,0,0,.7); }
    .sp-cap.on { opacity:.82; transform:none; transition-duration:${NP_IN}ms; }
    .sp-cap.pinned.on { opacity:.7; }
    .sp-cap.pinned.swap { opacity:0; transition-duration:${NP_SWAP}ms; }
    .sp-cap .ico { align-self:center; width:.95rem; height:.95rem; flex:none; color:var(--brass); filter:drop-shadow(0 1px 2px rgba(0,0,0,.9)); }
    .sp-cap-n { font:italic 400 1rem/1.2 var(--font-display); letter-spacing:.02em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .sp-cap-g { font-size:.78rem; color:var(--mist); white-space:nowrap; }
    @media (prefers-reduced-motion: reduce) { .sp-cap, .sp-cap.on { transform:none; } }
    html[data-phone] .sp-cap { left:.9rem; bottom:auto; top:calc(4.9rem + env(safe-area-inset-top)); max-width:75vw; transform:translateY(-.3rem); }   /* under the top bar: the bottom belongs to the sheet */
    html[data-phone] .sp-cap.on { transform:none; }
    .sp-sub { color:var(--cyan); font-size:.9rem; letter-spacing:.02em; }
    .sp-desc { color:var(--ivory); font-size:.98rem; line-height:1.45; }
    .sp-bar { display:flex; align-items:center; gap:.6rem; margin-top:auto; }
    .sp-t { font-variant-numeric:tabular-nums; color:var(--ivory); font-size:.9rem; min-width:2.6em; text-align:center; }
    .sp-seek { position:relative; flex:1; height:1.4rem; cursor:pointer; touch-action:none; }
    .sp-seek::before { content:''; position:absolute; left:0; right:0; top:50%; height:4px; margin-top:-2px; background:rgba(214,179,106,.18); }
    .sp-fill { position:absolute; left:0; top:50%; height:4px; margin-top:-2px; width:0; background:var(--violet); }
    .sp-loop { position:absolute; top:22%; bottom:22%; width:1px; background:var(--brass); opacity:.7; }
    .sp-knob { position:absolute; top:50%; width:.8rem; height:.8rem; margin:-.4rem 0 0 -.4rem; background:var(--ivory); transform:rotate(45deg); box-shadow:0 0 6px rgba(160,130,255,.6); }
    .sp-seek:focus-visible { outline:1px solid var(--brass); outline-offset:2px; }
    .sp-ctl { display:flex; align-items:center; gap:.45rem; flex-wrap:wrap; }
    .sp-ctl .btn { display:inline-flex; align-items:center; gap:.45em; }
    .sp-ico { padding:.45em .6em; }
    .sp-play { min-width:6.5em; justify-content:center; }
    .sp-ctl .ico { width:1.1em; height:1.1em; }
    .sp-gap { flex:1; }
    .sp-pass { color:var(--mist); font-size:.82rem; }
    .sp-vol .slider { margin:0; }
    .sp-note { color:var(--rose); font-size:.85rem; min-height:1.1em; }
    .sp-list { display:flex; flex-direction:column; gap:.5rem; min-width:0; min-height:0; }
    .sp-chips { display:flex; flex-wrap:wrap; gap:.3rem; }
    .sp-chip { padding:.28rem .7rem; background:rgba(214,179,106,.06); border:1px solid rgba(214,179,106,.28); color:var(--mist); font:inherit; font-size:.88rem; cursor:pointer; }
    .sp-chip:hover, .sp-chip:focus-visible { color:var(--ivory); border-color:var(--brass); outline:none; }
    .sp-chip.on { color:var(--ink, #10131f); background:var(--brass); border-color:var(--brass); }
    .sp-rows { position:relative; flex:1; overflow:auto; max-height:min(26rem, 52vh); border-top:1px solid var(--brass-line-1); }
    .sp-row { display:flex; align-items:baseline; gap:.6rem; width:100%; padding:.42rem .55rem; background:none; border:0; border-bottom:1px solid rgba(214,179,106,.08); color:var(--ivory); font:inherit; text-align:left; cursor:pointer; }
    .sp-row:hover, .sp-row:focus-visible { background:rgba(214,179,106,.08); outline:none; }
    .sp-row.on { background:rgba(150,120,255,.16); box-shadow:inset 2px 0 0 var(--violet); }
    .sp-r-n { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .sp-r-k { color:var(--mist); font-size:.8rem; white-space:nowrap; }
    .sp-r-t { color:var(--mist); font-size:.85rem; font-variant-numeric:tabular-nums; min-width:2.8em; text-align:right; }
    @media (max-width: 760px) { .sp { grid-template-columns:1fr; } .sp-rows { max-height:40vh; } }
    html[data-phone] .sp-row { min-height:var(--row); }
    html:root:root[data-phone] .sp-rows { max-height:none; overflow:visible; }   /* the sheet scrolls, not a list inside it */
    html[data-phone] .sp-ctl .btn { min-height:var(--tap); }
    html[data-phone] .sp-ibtn { width:var(--tap); height:var(--tap); margin-top:0; }
    html[data-phone] .sp-jump { min-height:2.2rem; }
    html:root:root[data-phone] .sp-info { max-height:none; }
  `);
})(window.MOO);

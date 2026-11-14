// The score player (modal): listen to any piece of the score from inside the game.
//   MOO.UI.scorePlayer() -> Promise resolved when the player is closed. Opened from the Game menu (gamemenu.js, 'Score player', hotkey M).
// The game's music is snapshotted when the player opens and restored when it closes (the interrupted piece resumes where it was, as the
// GNN broadcast does it). Pieces come from Music.catalogue() (the readings and interludes included, the bridges left out); the transport
// drives Music.play with { from, perf } so a seek or a resume keeps the same performance. 'Repeat' loops one piece as the game does;
// 'Play on' runs on through the list shown. Music volume is the game's own setting (Audio.setVolume). Esc / right-click close it.
(function (M) {
  'use strict';
  const UI = M.UI, h = UI.h;
  const C = () => UI.Controls;
  const A = () => M.Audio || null;
  const Mu = () => (A() && A().Music) || null;
  let open = null, cat = null;

  // names the listener knows the pieces by (MUSIC-REVIEW.md); anything unlisted falls back to the head of its description
  const NAMES = {
    title: 'Main theme', 'title:grand': 'Main theme — grand', 'title:classic': 'Main theme — the undercurrent', 'title:reed': 'Main theme — cor anglais',
    'title:cello': 'Main theme — cello', 'title:symphony': 'Main theme — symphony', 'title:chamber': 'Main theme — chamber', 'title:organ': 'Main theme — organ',
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
      cat = m.catalogue(['title:grand', 'title:classic']).map(e => Object.assign(e, { name: nameOf(e), group: groupOf(e) }));
      cat.sort((a, b) => ORDER[a.group] - ORDER[b.group] || (a.group === 'map' ? num(a.id) - num(b.id) : 0) || (a.variantOf ? 1 : 0) - (b.variantOf ? 1 : 0) || a.name.localeCompare(b.name));
    } catch (e) { console.warn('[scoreplayer] catalogue failed', e); cat = null; }
    return cat;
  }

  const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const keyOf = e => (e.root ? e.root + (e.mode ? ' ' + e.mode : '') : '');

  UI.scorePlayer = function () {
    if (open) return open;
    const m = Mu(), list = catalogue(), ctl = C();
    if (!m || !list || !list.length) {
      open = UI.modal({ title: 'Score player', body: h('p', 'The music engine is not available.'), buttons: [{ label: 'Close', value: null, primary: true }] }).then(() => { open = null; });
      return open;
    }
    const snap = (() => { try { return m.snapshot(); } catch (e) { return null; } })();
    const st = { group: 'all', sel: null, mode: 'repeat', paused: null, playing: null, seeking: false, raf: 0 };
    const byId = {}; list.forEach(e => { byId[e.id] = e; });
    const shown = () => list.filter(e => st.group === 'all' || e.group === st.group);

    // ---- now playing
    const nTitle = h('div.sp-title', '—'), nSub = h('div.sp-sub'), nDesc = h('div.sp-desc');
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
    const now = h('div.sp-now', nTitle, nSub, nDesc,
      h('div.sp-bar', tNow, seek, tLen),
      h('div.sp-ctl', prevBtn, playBtn, nextBtn, h('span.sp-gap'), passTxt, modeSeg),
      h('div.sp-vol', vol), note);

    // ---- the list
    const rows = h('div.sp-rows', { role: 'listbox' });
    const tabs = h('div.sp-chips', { role: 'tablist', 'aria-label': 'Show' }, GROUPS.map(g => h('button.sp-chip', { type: 'button', role: 'tab', 'data-g': g.id, onclick: () => { UI.sfx('click'); st.group = g.id; renderRows(); } }, g.label)));
    function renderRows() {
      UI.clear(rows);
      tabs.querySelectorAll('.sp-chip').forEach(b => { const on = b.getAttribute('data-g') === st.group; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
      shown().forEach(e => {
        const row = h('button.sp-row', { type: 'button', role: 'option', 'data-id': e.id, tip: e.desc || null, onclick: () => pick(e.id) },
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

    // ---- painting (the position is read every frame while open)
    function paint() {
      const id = st.playing || (st.paused && st.paused.id) || st.sel, e = byId[id];
      nTitle.textContent = e ? e.name : 'Choose a piece';
      nSub.textContent = e ? [{ theme: 'Main theme', map: 'The map', cue: 'Scene', race: 'Race theme', drift: 'Interlude' }[e.group], keyOf(e), e.bpm ? e.bpm + ' bpm' : ''].filter(Boolean).join(' · ') : '';
      nDesc.textContent = e ? e.desc : 'Every piece of the score, played by the game’s own engine. The game’s music returns when you close the player.';
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
    const body = h('div.sp', now, h('div.sp-list', h('div.sp-tabs', tabs), rows));
    const pm = UI.modal({ title: 'Score player', body, buttons: [{ label: 'Close', value: null, primary: true }], width: '52rem', cls: 'sp-modal', autofocus: false });
    const inCtl = ev => !!(ev && ev.target && ev.target.closest && ev.target.closest('.s-track, .sp-seek'));   // the volume slider and the seek bar keep their arrows
    const keys = {
      ' ': () => { toggle(); return true; }, ArrowDown: ev => { if (inCtl(ev)) return false; step(1); return true; }, ArrowUp: ev => { if (inCtl(ev)) return false; step(-1); return true; },
      ArrowRight: ev => { const e = byId[st.playing]; if (!e || inCtl(ev)) return false; seekTo(Math.min(1, (here().t + 10) / e.seconds)); return true; },
      ArrowLeft: ev => { const e = byId[st.playing]; if (!e || inCtl(ev)) return false; seekTo(Math.max(0, (here().t - 10) / e.seconds)); return true; },
    };
    const off = ctl.keyScope(pm.el, keys), off2 = ctl.trapFocus(pm.el);
    ctl.rightClick(pm.el.parentNode, () => pm.close(null));
    st.raf = requestAnimationFrame(tick);
    open = pm.then(() => {
      off(); off2(); cancelAnimationFrame(st.raf); open = null;
      try { m.restore(snap, { resume: true, fade: 1.5 }); } catch (e) { /* audio is optional */ }    // the game's music comes back where it was
    });
    return open;
  };

  UI.css('scoreplayer', `
    .sp-modal { max-width:calc(100vw - 2rem); }
    .sp { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:1.1rem; min-height:24rem; }
    .sp-now { display:flex; flex-direction:column; gap:.55rem; min-width:0; }
    .sp-title { font:400 1.55rem/1.15 var(--font-display); color:var(--brass-hi); }
    .sp-sub { color:var(--cyan); font-size:.9rem; letter-spacing:.02em; }
    .sp-desc { color:var(--mist); font-size:.92rem; line-height:1.4; max-height:9.8em; overflow:auto; padding-right:.3rem; }
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
  `);
})(window.MOO);

// Options: full screen ('options', params {from}) and modal (UI.openOptions()). Every control applies live through
// MOO.Settings.set / MOO.Audio. Also owns the display preferences that act on the page itself:
//   UI.applyUiScale()        scales the root font size by Settings 'uiScale' (0.85-1.3); formula-agnostic (measures the stylesheet value)
//   UI.applyDisplayPrefs()   uiScale + 'showTips' (html.no-tips) + 'reduceMotion' (html.reduce-motion); runs at load and on every change
//   UI.openOptions()         -> Promise that resolves (true / null) when the dialog is closed
// Needs UI.Controls from setup.js, resolved lazily at call time.
(function (M) {
  'use strict';
  const UI = M.UI, U = M.Util, h = UI.h, doc = document;
  const C = () => UI.Controls;
  const St = () => M.Settings;

  // ------------------------------------------------------------------ display preferences (applied to <html>)
  let scaleKey = '';
  const maxScale = () => (M.Phone && M.Phone.active() ? 1.1 : 1.3);         // a phone's base size is already large: past 110% screens overflow
  function applyUiScale() {
    const root = doc.documentElement;
    const s = U.clamp(Number(St().get('uiScale')) || 1, 0.85, maxScale());
    root.style.setProperty('--ui-scale', String(s));
    // measuring must not read a value that is mid-transition (prefers-reduced-motion forces a 1 ms `all` transition on every element)
    root.style.transition = 'none';
    root.style.fontSize = '';                                  // fall back to the stylesheet's fluid size, then scale that
    scaleKey = '';
    if (Math.abs(s - 1) >= 0.001) {
      const base = parseFloat(getComputedStyle(root).fontSize) || 16;
      root.style.fontSize = (base * s).toFixed(3) + 'px';
      scaleKey = String(s);
    }
    void root.offsetWidth;                                     // flush styles while transitions are still off
    root.style.removeProperty('transition');
  }
  function applyDisplayPrefs() {
    const root = doc.documentElement;
    applyUiScale();
    const tips = St().get('showTips') !== false;
    root.classList.toggle('no-tips', !tips);
    root.classList.toggle('reduce-motion', !!St().get('reduceMotion'));
    if (!tips && UI.hideTip) UI.hideTip();
  }
  UI.applyUiScale = applyUiScale;
  UI.applyDisplayPrefs = applyDisplayPrefs;

  UI.css('prefs', `
    html.no-tips #tip { display:none !important; }
    html.reduce-motion *, html.reduce-motion *::before, html.reduce-motion *::after {
      animation-duration:.001s !important; animation-delay:0s !important; transition-duration:.001s !important; scroll-behavior:auto !important; }
  `);
  applyDisplayPrefs();
  window.addEventListener('load', applyDisplayPrefs);
  window.addEventListener('resize', () => { if (scaleKey) applyUiScale(); });     // the fluid base size changes with the window
  if (M.Bus) M.Bus.on('settings', k => { if (!k || k === 'uiScale' || k === 'showTips' || k === 'reduceMotion') applyDisplayPrefs(); });

  // ------------------------------------------------------------------ audio plumbing (MOO.Audio may be absent)
  const DEFAULT_VOL = { music: 0.5, sfx: 0.8 };
  const aud = () => M.Audio || null;
  function getVol(kind) {
    const a = aud();
    let v = a && a.settings && typeof a.settings[kind] === 'number' ? a.settings[kind] : St().get(kind + 'Vol');
    if (typeof v !== 'number' || !isFinite(v)) v = DEFAULT_VOL[kind];
    return U.clamp(v, 0, 1);
  }
  function setVol(kind, v) {
    v = U.clamp(v, 0, 1);
    const a = aud();
    if (a && typeof a.setVolume === 'function') { try { a.setVolume(kind, v); } catch (e) { console.warn('[options] setVolume failed', e); } }
    else St().set(kind + 'Vol', v);                              // no audio engine yet: remember it for later
    St().set(kind === 'music' ? 'music' : 'sfx', v > 0);          // the on/off flags follow the volume
  }
  function getMuted() {
    const a = aud();
    if (a && a.settings && typeof a.settings.muted === 'boolean') return a.settings.muted;
    return !!St().get('muted');
  }
  function setMuted(b) {
    const a = aud();
    if (a && typeof a.setMuted === 'function') { try { a.setMuted(!!b); } catch (e) { console.warn('[options] setMuted failed', e); } }
    else St().set('muted', !!b);
  }

  // ------------------------------------------------------------------ the options form (shared by screen + modal)
  function buildOptions() {
    const ctl = C(), S = St();
    const row = (name, hint, control, cls) => h('div.op-row' + (cls ? '.' + cls : ''),
      h('div.op-lab', h('div.op-name', name), hint ? h('div.op-hint', hint) : null), h('div.op-ctl', control));
    const section = (title, ico, rows, cls) => {
      const p = UI.panel(null, h('div.op-rows', rows), { cls: cls || '' });
      p.insertBefore(h('div.panel-h', ctl.icon(ico), h('span', title)), p.firstChild);
      return p;
    };
    const sync = [];

    // ---- sound
    const mute = ctl.toggle(getMuted(), v => { setMuted(v); paintMute(); }, { label: 'Mute all sound', onText: 'Muted', offText: 'Off' });
    const music = UI.slider({ label: 'Music', color: 'var(--violet)', min: 0, max: 100, step: 5, value: Math.round(getVol('music') * 100), fmt: v => v + '%', lockable: false, onChange: v => setVol('music', v / 100) });
    let lastPing = 0;
    const sfx = UI.slider({
      label: 'Effects', color: 'var(--cyan)', min: 0, max: 100, step: 5, value: Math.round(getVol('sfx') * 100), fmt: v => v + '%', lockable: false,
      onChange: v => { setVol('sfx', v / 100); const now = performance.now(); if (now - lastPing > 150) { lastPing = now; UI.sfx('click'); } },
    });
    const sound = section('Sound', 'speaker', [
      row('Mute all sound', 'Silences music and effects. Your volumes are kept.', mute),
      h('div.op-row.slr', music), h('div.op-row.slr', sfx)], 'op-snd');
    function paintMute() { sound.classList.toggle('muted', mute.get()); }
    sync.push(() => { mute.set(getMuted()); music.api.set(Math.round(getVol('music') * 100)); sfx.api.set(Math.round(getVol('sfx') * 100)); paintMute(); });

    // ---- gameplay
    const bool = (key, label, hint, def) => {
      const t = ctl.toggle(S.get(key) === undefined ? def : !!S.get(key), v => S.set(key, v), { label });
      sync.push(() => t.set(S.get(key) === undefined ? def : !!S.get(key)));
      return row(label, hint, t);
    };
    const anim = ctl.segmented([{ id: 1, label: 'Normal' }, { id: 2, label: 'Fast' }, { id: 0, label: 'Instant' }], S.get('animSpeed'), v => S.set('animSpeed', Number(v)), { block: true, label: 'Animation speed' });
    sync.push(() => anim.set(S.get('animSpeed')));
    const battle = ctl.segmented([{ id: 'manual', label: 'Manual' }, { id: 'auto', label: 'Auto-resolve' }], S.get('tactical') !== false ? 'manual' : 'auto', v => S.set('tactical', v === 'manual'), { block: true, label: 'Default battle mode' });
    sync.push(() => battle.set(S.get('tactical') !== false ? 'manual' : 'auto'));
    const G = M.Game, live = !!(G && G.S);
    const gameAuto = live ? ctl.toggle(!!(G.S.settings.options && G.S.settings.options.autoBattle), v => { G.S.settings.options = G.S.settings.options || {}; G.S.settings.options.autoBattle = !!v; }, { label: 'Auto-resolve battles in this game' }) : null;
    if (gameAuto) sync.push(() => gameAuto.set(!!(G.S && G.S.settings.options && G.S.settings.options.autoBattle)));
    const news = ctl.segmented([{ id: 'broadcast', label: 'Broadcast' }, { id: 'brief', label: 'Brief' }], S.get('newsMode') || 'broadcast', v => S.set('newsMode', v), { block: true, label: 'News' });
    sync.push(() => news.set(S.get('newsMode') || 'broadcast'));
    const gameplay = section('Gameplay', 'compass', [
      M.Phone && M.Phone.active() ? null : row('Default battle mode', 'Manual: you command each ship battle. Auto-resolve: battles play out on their own.', battle, 'stack'),
      gameAuto && !(M.Phone && M.Phone.active()) ? row('Auto-resolve battles in this game', 'Set from the pre-battle card ("Auto-resolve every battle this game"); turn it off here.', gameAuto) : null,
      bool('landingScenes', 'Colony landing scene', 'Play the landing vignette when a colony is founded. Off: the card\'s Yes founds it at once.', true),
      M.Phone && M.Phone.active() ? null : row('News', 'Broadcast: the GNN studio scene. Brief: one list of the turn\'s headlines with a single Continue.', news, 'stack'),   // phones always get the brief list (flow.js)
      bool('autosave', 'Autosave each turn', 'Writes the Auto slot at the end of every turn.', true),
      bool('confirmEndTurn', 'Confirm end of turn', 'Ask first when a colony builds ships with no design, research has no funding, or a fleet order is still unaccepted.', false)]);

    // ---- interface
    const labels = ctl.segmented([{ id: 'auto', label: 'Auto' }, { id: 'all', label: 'All' }, { id: 'owned', label: 'Owned' }], S.get('mapLabels'), v => S.set('mapLabels', v), { block: true, label: 'Map labels' });
    sync.push(() => labels.set(S.get('mapLabels')));
    let pending = null, timer = 0;
    const flush = () => { clearTimeout(timer); if (pending !== null) { const v = pending; pending = null; S.set('uiScale', v); } };
    const scale = UI.slider({
      label: 'Scale', color: 'var(--gold)', min: 85, max: Math.round(maxScale() * 100), step: 5, value: Math.round(U.clamp(Number(S.get('uiScale')) || 1, .85, maxScale()) * 100), fmt: v => v + '%', lockable: false,
      onChange: v => { pending = v / 100; clearTimeout(timer); timer = setTimeout(flush, 1200); },
    });
    ['pointerup', 'keyup', 'click', 'focusout'].forEach(ev => scale.addEventListener(ev, flush));
    sync.push(() => { pending = null; scale.api.set(Math.round(U.clamp(Number(S.get('uiScale')) || 1, .85, maxScale()) * 100)); });
    const iface = section('Display & animation', 'monitor', [
      row('Animation speed', 'Fleet movement and battle playback.', anim, 'stack'),
      bool('showTips', 'Tooltips', UI.Phone.say('Hover hints on buttons, numbers and map objects.', 'Tap a number, label or chip to read about it (a long press always works, on buttons too).'), true),
      bool('reduceMotion', 'Reduce motion', 'Calmer screens: fewer sweeps, particles and twinkling.', false),
      row('Map labels', 'Which stars show their names on the galaxy map.', labels, 'stack'),
      bool('mapGrid', 'Star-chart grid', 'Draw the graticule behind the galaxy map.', true),
      M.Phone && M.Phone.active() ? bool('haptics', 'Haptics', 'A short vibration on Next turn, slider steps, switches and errors (Android; iPhones with iOS 18 or later tick).', true) : null,
      M.Phone && M.Phone.active() ? bool('perfOverlay', 'Performance overlay', 'Frame rate, graphics tier and worker load in the top corner.', false) : null,
      row('Interface scale', 'Resizes the whole interface. Applied when you let go of the slider.', null, 'stack'),
      h('div.op-row.slr', scale)]);

    const el = h('div.op-body', h('div.op-col', sound, gameplay), h('div.op-col', iface));
    return { el, sync: () => sync.forEach(fn => fn()) };
  }

  function resetFlow(view) {
    return UI.confirm('Restore every option to its default value? Your remembered new-game choices are kept.', { title: 'Reset options' }).then(ok => {
      if (!ok) return false;
      const last = St().get('lastSetup');
      St().reset();
      if (last) St().set('lastSetup', last);
      setVol('music', DEFAULT_VOL.music); setVol('sfx', DEFAULT_VOL.sfx); setMuted(false);
      applyDisplayPrefs();
      view.sync();
      UI.toast('Options restored to defaults', 'ok');
      return true;
    });
  }

  // ------------------------------------------------------------------ modal variant
  UI.openOptions = function () {
    const ctl = C(), view = buildOptions();
    let pm = null;
    const resetBtn = ctl.hotkey(UI.button('Reset to defaults', () => resetFlow(view)), 'r');
    const doneBtn = ctl.hotkey(UI.button('Done', () => pm && pm.close(true), { primary: true, kbd: 'Esc' }), 'd');
    const body = h('div.op-modal-body', view.el, h('div.op-foot', resetBtn, h('span.grow'), doneBtn));
    pm = UI.modal({ title: 'Options', body, buttons: [], width: 'min(94vw, 58rem)', cls: 'op-modal' });
    const off = ctl.hotkeys(pm.el, { r: resetBtn, d: doneBtn }), off2 = ctl.trapFocus(pm.el);
    ctl.rightClick(pm.el.parentNode, () => pm.close(null));
    pm.then(() => { off(); off2(); });
    return pm;
  };

  // ------------------------------------------------------------------ full-screen variant
  let bg = null, holder = null, view = null, from = 'menu', resetBtn = null;
  function goBack() {
    const target = UI.Screens.has(from) ? from : (UI.Screens.has('menu') ? 'menu' : null);
    if (target) UI.Screens.go(target); else UI.toast('Nowhere to go back to', 'warn');
  }
  UI.Screens.register('options', {
    create(el) {
      const ctl = C();
      bg = ctl.backdrop('ui');
      holder = h('div.op-scroll');
      resetBtn = ctl.hotkey(UI.button('Reset to defaults', () => view && resetFlow(view)), 'r');
      const doneBtn = ctl.hotkey(UI.button('Done', goBack, { primary: true, big: true, kbd: 'Space' }), 'd');
      el.appendChild(h('div.op-wrap', bg, h('div.ctl-shade'),
        h('div.op-frame', h('div.op-inner',
          h('header.op-head', h('div.ctl-eyebrow', 'Master of Orion'), h('h1.ctl-title', 'Options')),
          holder,
          h('footer.op-foot', resetBtn, h('span.op-foot-hint', 'Esc or right-click to go back'), h('span.grow'), doneBtn)))));
      ctl.rightClick(el, goBack);
      ctl.hotkeys(el, { r: resetBtn, d: doneBtn });
    },
    enter(params) {
      from = (params && params.from) || 'menu';
      bg.paint();
      view = buildOptions();
      UI.mount(holder, view.el);
    },
    resize() { if (bg) bg.paint(); },
  });
  UI.bindKey('Escape', goBack, { screen: 'options' });
  // Enter / Space = OK: a focused button acts on itself, a focused slider ignores it, anything else leaves the screen
  const okKey = () => { const a = doc.activeElement; if (a && a.tagName === 'BUTTON') a.click(); else if (!(a && a.classList.contains('s-track'))) goBack(); };
  UI.bindKey('Enter', okKey, { screen: 'options' });
  UI.bindKey('Space', okKey, { screen: 'options' });

  UI.css('options', `
    .op-wrap { position:absolute; inset:0; overflow:hidden; background:var(--void); }
    .op-frame { position:absolute; inset:0; display:flex; justify-content:center; padding: clamp(1rem, 5vh, 3.4rem) 1.5rem clamp(.8rem, 2.4vh, 1.4rem); }
    .op-inner { width:min(100%, 60rem); display:flex; flex-direction:column; gap:.9rem; min-height:0; }
    .op-head { flex:none; }
    .op-scroll { flex:1 1 auto; min-height:0; overflow-y:auto; overflow-x:hidden; padding:2px 6px 2px 2px; }
    .op-foot { flex:none; display:flex; align-items:center; gap:.7rem; padding-top:.75rem; border-top:1px solid rgba(214,179,106,.28); }
    .op-modal .op-foot { margin-top:.9rem; }
    .op-foot-hint { color:var(--fog); font-size:.85rem; margin-left:.5rem; }
    .op-body { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:.9rem; align-items:start; }
    .op-col { display:flex; flex-direction:column; gap:.9rem; min-width:0; }
    .op-body .panel-h .ico { width:1.15rem; height:1.15rem; color:var(--brass); }
    .op-rows { display:flex; flex-direction:column; }
    .op-row { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:.2rem 1rem; padding:.55rem 0; border-bottom:1px solid rgba(255,255,255,.055); }
    .op-row:last-child { border-bottom:0; }
    .op-row.stack { grid-template-columns:minmax(0,1fr); gap:.5rem; }
    .op-row.stack .op-ctl { grid-row:2; }
    .op-row.slr { grid-template-columns:minmax(0,1fr); padding:.3rem 0; }
    .op-row.slr .slider { margin:.15rem 0; }
    .op-name { color:var(--ivory); font-size:1.02rem; }
    .op-hint { margin-top:.1rem; color:var(--mist); font-size:.84rem; line-height:1.28; }
    .op-ctl:empty { display:none; }
    .op-body .slider { grid-template-columns:4.4rem 1.45rem minmax(3rem, 1fr) 1.45rem 3rem; }
    .op-body .slider > :last-child { display:none; }
    .op-snd .slider { transition:opacity .2s; }
    .op-snd.muted .slider { opacity:.4; }
    @media (max-width: 760px) { .op-body { grid-template-columns:minmax(0,1fr); } }
  `);
})(window.MOO);

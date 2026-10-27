// Loads css + js from MOO_MANIFEST in order (works from file:// — no ES modules), then calls MOO.boot().
(function () {
  'use strict';
  var man = window.MOO_MANIFEST;
  // Cache busting. A release built by scripts/lib.sh (moo_make_release) stamps
  // `window.MOO_BUILD = '<release name>'` into js/manifest.js, and every css/js
  // URL gets ?v=<build>: the web server caches those for a year, a new release
  // means new URLs, and index.html / manifest.js stay no-cache. An unstamped
  // tree (a dev checkout served by any static server, or file://) has no build
  // id, so it keeps the per-load timestamp — nothing may be cached there.
  var build = typeof window.MOO_BUILD === 'string' && /^[A-Za-z0-9._+-]{1,80}$/.test(window.MOO_BUILD) ? window.MOO_BUILD : '';
  var bust = build ? '?v=' + build : '?_=' + Date.now();
  // One automatic retry. A file that failed to load or to run (a dropped connection, or a truncated
  // copy the browser cached as immutable) leaves a module missing, and the game would only break much
  // later (e.g. at Begin: "M.Sim.Research.init"). So: reload the page once with a fresh token on every
  // URL, which goes past the cache, and if that load fails too, stop with a message instead of booting.
  var RETRY_KEY = 'moo.loadRetry', retried = false;
  try { var t = +sessionStorage.getItem(RETRY_KEY) || 0; retried = Date.now() - t < 60000; } catch (e) { /* no storage: no retry */ }
  if (retried) bust += '&r=' + Date.now();
  window.MOO_BUST = bust;
  var fill = document.getElementById('boot-fill');
  var errBox = document.getElementById('boot-err');
  var errors = [];
  window.MOO_LOAD_ERRORS = errors;

  man.css.forEach(function (href) {
    var l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href + bust;
    l.onerror = function () { errors.push('css: ' + href); };
    document.head.appendChild(l);
  });

  // A tip while it loads (Data.text.tips, the Almanac's list), never the same one twice running; kept in MOO_BOOT_TIP so the first turn of an
  // easy game can show it again (help.js). Shown once the text module has run (about a fifth of the way in).
  var tipEl = document.getElementById('boot-tip'), tipShown = false;
  function bootTip() {
    if (tipShown || !tipEl) return;
    var T = window.MOO && window.MOO.Data && window.MOO.Data.text && window.MOO.Data.text.tips; if (!T || !T.length) return;
    tipShown = true;
    var last = -1; try { last = +localStorage.getItem('moo.bootTip'); } catch (e) { /* no storage */ }
    var i = Math.floor(Math.random() * T.length); if (i === last && T.length > 1) i = (i + 1) % T.length;
    try { localStorage.setItem('moo.bootTip', String(i)); } catch (e) { /* no storage */ }
    window.MOO_BOOT_TIP = T[i];
    tipEl.innerHTML = '<b>Tip</b>'; tipEl.appendChild(document.createTextNode(T[i])); tipEl.className = 'boot-tip on';
  }
  var total = man.js.length, done = 0;
  function step() {
    done++;
    if (fill) fill.style.width = Math.round(done / total * 100) + '%';
    bootTip();
    if (done === total) finish();
  }
  function finish() {
    window.removeEventListener('error', onScriptError);
    if (errors.length) { errBox.textContent = 'Failed to load:\n' + errors.join('\n'); console.warn('Missing files:', errors); }
    if (jsFailed) {
      if (!retried) {
        try { sessionStorage.setItem(RETRY_KEY, String(Date.now())); location.reload(); return; } catch (e) { /* fall through to the message */ }
      }
      errBox.textContent += '\n\nThe game could not finish loading. Check your connection and reload the page.';
      return;
    }
    try { sessionStorage.removeItem(RETRY_KEY); } catch (e) { /* ignore */ }
    try {
      if (window.MOO && typeof window.MOO.boot === 'function') window.MOO.boot();
      else throw new Error('MOO.boot is not defined (js/main.js missing?)');
    } catch (e) {
      errBox.textContent += '\n' + (e && e.stack || e);
      console.error(e);
    }
  }
  // A script that loads but throws while running (or does not parse) only shows up as a window error whose filename is that
  // script's URL. Scripts run in manifest order (async=false), so the one executing is man.js[done]: only ITS errors count —
  // a callback of an earlier script firing in between (a timer, an event) is that script's bug, not a failed load.
  var jsFailed = false;
  function onScriptError(ev) {
    var f = ev && ev.filename || '', cur = man.js[done];
    if (cur && f.indexOf(cur + bust) >= 0) { jsFailed = true; errors.push('js (error): ' + cur + ': ' + (ev.message || 'script error')); }
  }
  window.addEventListener('error', onScriptError);
  man.js.forEach(function (src) {
    var s = document.createElement('script');
    s.src = src + bust;
    s.async = false;                       // preserves execution order
    s.onload = step;
    s.onerror = function () { jsFailed = true; errors.push('js: ' + src); step(); };
    document.head.appendChild(s);
  });
})();

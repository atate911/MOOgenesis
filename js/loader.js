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

  var total = man.js.length, done = 0;
  function step() {
    done++;
    if (fill) fill.style.width = Math.round(done / total * 100) + '%';
    if (done === total) finish();
  }
  function finish() {
    if (errors.length) { errBox.textContent = 'Failed to load:\n' + errors.join('\n'); console.warn('Missing files:', errors); }
    try {
      if (window.MOO && typeof window.MOO.boot === 'function') window.MOO.boot();
      else throw new Error('MOO.boot is not defined (js/main.js missing?)');
    } catch (e) {
      errBox.textContent += '\n' + (e && e.stack || e);
      console.error(e);
    }
  }
  man.js.forEach(function (src) {
    var s = document.createElement('script');
    s.src = src + bust;
    s.async = false;                       // preserves execution order
    s.onload = step;
    s.onerror = function () { errors.push('js: ' + src); step(); };
    document.head.appendChild(s);
  });
})();

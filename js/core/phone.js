// Phone layout layer — the gate. index.html decides before any stylesheet loads (window.MOO_PHONE + <html data-phone>: a coarse-pointer
// device whose shorter screen side is 600px or less, or ?phone=1; ?phone=0 forces it off). This file only exposes that decision:
//   MOO.Phone.boot      the load-time value — perf tier, worker pool and audio samples read it ONCE at start-up and never re-decide
//   MOO.Phone.active()  the live value — js/ui/phone.js updates it when a coarse pointer appears or disappears (dock, mouse)
//   MOO.Phone.forced    true when ?phone= pinned it for this page load
// DOM-free (also loaded by tools/headless.js, where it is simply off). UI behaviour lives in js/ui/phone.js, rules in css/phone.css.
(function (M) {
  'use strict';
  const W = typeof window !== 'undefined' ? window : null;
  const boot = !!(W && W.MOO_PHONE === true);
  let on = boot;
  M.Phone = {
    boot,
    forced: !!(W && W.MOO_PHONE_FORCED === true),
    active: () => on,
    set(v) { on = !!v; },
  };
})(window.MOO);

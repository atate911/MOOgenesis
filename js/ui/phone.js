// Phone prototype: sets <html data-phone> on touch devices under 900px wide (or ?phone=1; ?phone=0 forces it off),
// and gives the galaxy screen's side panel a tap-to-toggle handle so it works as a bottom sheet. See css/phone.css.
(function (M) {
  'use strict';
  const root = document.documentElement, q = new URLSearchParams(location.search);
  const mq = window.matchMedia ? window.matchMedia('(pointer: coarse) and (max-width: 900px)') : null;
  const force = q.get('phone');
  const on = () => force === '1' || (force !== '0' && !!(mq && mq.matches));
  function apply() {
    if (on()) root.setAttribute('data-phone', ''); else { root.removeAttribute('data-phone'); root.removeAttribute('data-sheet'); }
  }
  apply();
  if (mq && mq.addEventListener) mq.addEventListener('change', apply);

  function addGrips() {
    if (!root.hasAttribute('data-phone')) return;
    document.querySelectorAll('.gx-side:not(.gx-float)').forEach(side => {
      if (side.querySelector(':scope > .ph-grip')) return;
      const g = document.createElement('div'); g.className = 'ph-grip';
      g.addEventListener('click', () => { if (root.dataset.sheet === 'open') root.removeAttribute('data-sheet'); else root.dataset.sheet = 'open'; });
      side.insertBefore(g, side.firstChild);
    });
  }
  new MutationObserver(addGrips).observe(document.getElementById('screens') || document.body, { childList: true, subtree: true });
  addGrips();
  M.Phone = { active: () => root.hasAttribute('data-phone') };
})(window.MOO);

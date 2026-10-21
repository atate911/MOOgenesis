// Phone layout layer — the research screen (js/ui/tech.js). Inert unless <html data-phone> is set; css/phone.css holds the rules.
// In one column the screen is three screens long, so a segmented control under the header splits it (data-ph-seg on .tch):
//   Allocation   the six field sliders and Equalise
//   Project      the field tabs and the selected field's project card
//   Techs        the field tabs, the researched list and the detail — or the tech tree under the Overview tab
// Overview lives under Techs only: leaving Techs from it goes back to the field view. Entering with params.view 'overview' opens Techs, and
// so does a tap on the Overview tab or on an "available next" link (they show their answer in Techs). tech.js exposes UI.Tech._phone.
(function (M) {
  'use strict';
  const UI = M.UI;
  const active = () => !!(UI.Phone && UI.Phone.active());
  const X = () => UI.Tech && UI.Tech._phone;
  const SEGS = [{ id: 'alloc', label: 'Allocation' }, { id: 'proj', label: 'Project' }, { id: 'techs', label: 'Techs' }];
  let seg = null, root = null, cur = 'alloc';

  function setSeg(v, fromCtl) {
    cur = v;
    if (root) root.dataset.phSeg = v;
    if (seg && !fromCtl) seg.set(v);
    const x = X();
    if (x && v !== 'techs' && x.st.view === 'overview') x.selectField(x.st.field);
    if (root) root.scrollTop = 0;
  }

  function install() {
    const scr = UI.Screens.el('tech'); root = scr && scr.querySelector('.tch');
    if (!root || seg) return;
    const C = UI.Controls; if (!C || !C.segmented) return;                                   // setup.js loads after tech.js: looked up here, at first entry
    seg = C.segmented(SEGS, cur, v => setSeg(v, true), { block: true, label: 'Research view' });
    seg.classList.add('ph-tseg');
    root.insertBefore(seg, root.querySelector('.tch-tabs'));
    root.dataset.phSeg = cur;
    root.addEventListener('click', e => {
      if (!e.target.closest || cur === 'techs') return;
      if (e.target.closest('.tch-tab.ovw, .tch-nx')) setSeg('techs');
    });
  }

  if (M.Bus) M.Bus.on('screen', (id, params) => {
    if (id !== 'tech' || !active()) return;
    install();
    if (params && params.view === 'overview') setSeg('techs');
  });
})(window.MOO);

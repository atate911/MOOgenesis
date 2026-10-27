// Phone fit survey: every screen, scene and dialog of the phone layout at iPhone sizes, with the iPhone safe areas emulated (headless
// Chromium reports env(safe-area-inset-*) as 0, so every CSS and JS response has those values rewritten to the device's real insets).
// Per view it lists what a player cannot see: text cut by its own box or by a box that does not scroll, text off the screen, text
// buried in a small inner scroll box (iOS shows no scrollbar there), keyboard hints shown on a touch screen, controls covered by
// another element, and text or controls under the notch / Dynamic Island / home indicator (at the top, and at the end of each scroll).
//   node tools/qa/phone-fit.js [size,size…] [view,view…]    sizes: se-safari se-home i15-safari i15-home max-home land-safari land-home
//   → tools/out/phone-fit/<size>-<view>.png and phone-fit.json; a summary table on stdout. Exit code 1 when anything is found.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { serve, sleep } = require('./lib');
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, '..', 'out', 'phone-fit'); fs.mkdirSync(OUT, { recursive: true });
const PORT = +(process.env.PORT || 8790);
const SIZES = {
  'se-safari': { w: 375, h: 548, ins: { t: 0, b: 0, l: 0, r: 0 } },        // iPhone SE in Safari (toolbars showing)
  'se-home': { w: 375, h: 667, ins: { t: 20, b: 0, l: 0, r: 0 } },         // iPhone SE from the home screen
  'i15-safari': { w: 393, h: 659, ins: { t: 0, b: 0, l: 0, r: 0 } },       // iPhone 15 in Safari
  'i15-home': { w: 393, h: 852, ins: { t: 59, b: 34, l: 0, r: 0 } },       // iPhone 15 from the home screen (Dynamic Island, home indicator)
  'max-home': { w: 430, h: 932, ins: { t: 59, b: 34, l: 0, r: 0 } },       // iPhone 15 Pro Max from the home screen
  'land-safari': { w: 852, h: 342, ins: { t: 0, b: 21, l: 59, r: 59 } },   // iPhone 15 on its side in Safari
  'land-home': { w: 852, h: 393, ins: { t: 0, b: 21, l: 59, r: 59 } },     // iPhone 15 on its side from the home screen
};
const BOOT = `http://localhost:${PORT}/index.html?dev=1&screen=galaxy&race=human&size=medium&opp=3&seed=abc&turns=10`;
const go = (id, p) => `MOO.UI.Screens.go(${JSON.stringify(id)}, Object.assign({ from: 'galaxy' }, ${JSON.stringify(p || {})}))`;
const seg = name => `(()=>{ const b=[...document.querySelectorAll('.screen.active .ph-tseg button')].find(x=>x.textContent.trim()===${JSON.stringify(name)}); if (b) b.click(); })()`;
const VIEWS = [
  ['galaxy', [go('galaxy')]], ['galaxy-half', [go('galaxy'), `document.querySelector('.gx-side.ph-sheet').phSheet.set('half')`]],
  ['galaxy-full', [go('galaxy'), `document.querySelector('.gx-side.ph-sheet').phSheet.set('full')`]],
  ['system', [go('system')]], ['planets', [go('planets')]], ['fleets', [go('fleets')]], ['specs', [go('specs')]], ['races', [go('races')]],
  ['report', [go('report', { empire: 1 })]], ['status', [go('status')]], ['mapoverview', [go('mapoverview')]], ['almanac', [go('help')]],
  ['saveload', [go('saveload', { mode: 'save' })]], ['options', [go('options')]], ['design', [go('design')]],
  ['research-alloc', [go('tech'), seg('Allocation')]], ['research-project', [go('tech'), seg('Project')]],
  ['research-techs', [go('tech'), seg('Techs'), `(()=>{ const t=document.querySelector('.screen.active .tch-trow'); if (t) t.click(); })()`]],
  ['research-overview', [go('tech', { view: 'overview' }), `(()=>{ const c=document.querySelector('.screen.active .tt-chip'); if (c) c.click(); })()`]],
  ['techtree', [go('techtree'), `(()=>{ const c=document.querySelector('.screen.active .tt-chip'); if (c) c.click(); })()`]],
  ['tech-choose', [`(()=>{ const R=MOO.Sim.Research; let f=0, lv=[]; for (f=0; f<6 && lv.length<2; f++) { lv=[]; for (let l=1; l<=12 && lv.length<3; l++) if (R.techAt(f,l)) lv.push(l); if (lv.length>=2) break; } window.__tc = MOO.UI.TechScenes.choose({ field: f, choices: lv.map(l => ({ level: l, cost: R.techAt(f, l).cost || l * 90 })), manual: true }); })()`], 2600],
  ['tech-break', [`(()=>{ const S=MOO.Game.S; void MOO.UI.TechScenes.breakthrough({ empire: S.playerId, field: 0, level: 2 }); })()`], 3200],
  ['audience', [go('audience', { empire: 1 })], 3500], ['council', [go('council')], 4500], ['landing', [go('landing')], 2500], ['endings', [go('endings')], 2500],
  ['battle-card', [`(()=>{ const d=MOO.UI.Combat.demo({ scn: 'planet' }); window.__fight = MOO.UI.Combat.fight(d.battle, d.S); })()`], 1500],
  ['game-menu', [`MOO.UI.gameMenu()`]], ['news', [`MOO.UI.Flow && MOO.UI.Flow.newsBrief && MOO.UI.Flow.newsBrief({ year: 2310, items: [{ headline: 'Alkari and Mrrshan sign a treaty of friendship after decades of feud' }, { headline: 'Plague on Fierias', sub: 'A third of the colony lost' }] })`]],
  ['archive', [`MOO.UI.GNN.archive(MOO.Game.S)`]],
  ['menu', [`MOO.UI.Screens.go('menu')`], 2000], ['setup-1', [`MOO.UI.Screens.go('setup', { step: 0, from: 'menu' })`], 1800],
  ['setup-2', [`MOO.UI.Screens.go('setup', { step: 1, from: 'menu' })`], 1800], ['setup-3', [`MOO.UI.Screens.go('setup', { step: 2, from: 'menu' })`], 1800],
];
// what a player cannot see (runs in the page; ins = the emulated safe-area insets)
const PROBE = `((ins, atEnd, recheck) => {
  const vw = innerWidth, vh = innerHeight, out = [];
  const sel = el => { const p = []; let e = el; while (e && e !== document.body && p.length < 3) { p.unshift(e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\\s+/).slice(0, 2).join('.') : '')); e = e.parentElement; } return p.join(' > '); };
  const shown = el => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return null; for (let a = el; a; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity === 0) return null; } return r; };
  const scroller = a => { const c = getComputedStyle(a); return (/auto|scroll/.test(c.overflowY) && a.scrollHeight > a.clientHeight + 1) || (/auto|scroll/.test(c.overflowX) && a.scrollWidth > a.clientWidth + 1); };
  const topmost = (el, x, y) => { const t = document.elementFromPoint(x, y); return !t || t === el || el.contains(t) || t.contains(el); };
  const painted = (el, x, y) => { const t = document.elementFromPoint(x, y); return !t || t === el || el.contains(t); };   // the element itself is what shows at that point
  const clipRect = (el, r) => {                                                        // the part of the element its clipping boxes let through
    let L = r.left, T = r.top, R = r.right, B = r.bottom;
    for (let a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      const c = getComputedStyle(a); if (c.overflowX === 'visible' && c.overflowY === 'visible') continue;
      const ar = a.getBoundingClientRect(); if (ar.width < 1 || ar.height < 1) continue;
      L = Math.max(L, ar.left); T = Math.max(T, ar.top); R = Math.min(R, ar.right); B = Math.min(B, ar.bottom);
    }
    return R - L > 1 && B - T > 1 ? { left: L, top: T, right: R, bottom: B, width: R - L, height: B - T } : null;
  };
  if (recheck) return [...document.querySelectorAll('[data-pf-cov]')].filter(el => {   // bring it to the middle of whatever scrolls it: still covered there is covered for good
    try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) { /* ignore */ }
    const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; return x >= 0 && y >= 0 && x < vw && y < vh && !topmost(el, x, y); }).map(el => el.dataset.pfCov);
  const overlay = el => el && el.closest('.scrim, .modal, .ph-sheet, .ph-appbar, .tsc-panel, #tip, .toast');
  let covN = 0;
  const inner = new Map();
  const nodes = [...document.body.querySelectorAll('*')].filter(el => !el.closest('#boot, script, style, svg, .rest, #tip'));
  for (const el of nodes) {
    const txt = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    const ctl = el.matches('button, .btn, [role=button], a[href], input, select');
    if (!txt && !ctl) continue;
    const r = shown(el); if (!r) continue; const cs = getComputedStyle(el);
    if (el.closest('.ph-sheet[data-sheet="strip"]')) continue;                       // a collapsed sheet shows its first lines by design
    const rec = { s: (txt || el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40), sel: sel(el) };
    if (txt && /hidden|clip/.test(cs.overflow + cs.overflowX + cs.overflowY) && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2)) {
      const nowrap = cs.whiteSpace === 'nowrap' && cs.textOverflow === 'ellipsis', clamp = cs.webkitLineClamp && cs.webkitLineClamp !== 'none';
      if (!nowrap && !clamp) out.push(Object.assign({ k: 'cut', px: Math.max(el.scrollWidth - el.clientWidth, el.scrollHeight - el.clientHeight) }, rec));
      else if (clamp && el.scrollWidth > el.clientWidth + 1) out.push(Object.assign({ k: 'cut', px: el.scrollWidth - el.clientWidth, why: 'word wider than its clamped box' }, rec));
    }
    let hit = null, firstScroller = null;
    for (let a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      const c = getComputedStyle(a); if (c.overflowX === 'visible' && c.overflowY === 'visible') continue;
      const ar = a.getBoundingClientRect(); if (ar.width < 1 || ar.height < 1) continue;
      const isS = scroller(a); if (isS && !firstScroller) firstScroller = a;
      const cut = Math.max(ar.top - r.top, r.bottom - ar.bottom, ar.left - r.left, r.right - ar.right);
      if (cut > 2 && !isS && !firstScroller) { hit = { k: 'cut-by-box', px: Math.round(cut), by: sel(a) }; break; }
    }
    if (hit) out.push(Object.assign(hit, rec));
    else if (!firstScroller && (r.bottom > vh + 1 || r.top < -1 || r.right > vw + 1 || r.left < -1)) out.push(Object.assign({ k: 'off-screen' }, rec));
    if (firstScroller && txt) {   // a small box that scrolls on its own: iOS shows no scrollbar, so what is below its edge reads as missing
      const sr = firstScroller.getBoundingClientRect(), vertical = firstScroller.scrollHeight > firstScroller.clientHeight + 1;
      if (vertical && sr.height < vh * 0.45 && firstScroller.scrollHeight - firstScroller.clientHeight > 12 && (r.top >= sr.bottom - 2 || r.bottom <= sr.top + 2)) {
        const key = sel(firstScroller); const e = inner.get(key) || { k: 'hidden-in-small-scroll', sel: key, box: Math.round(sr.height), content: firstScroller.scrollHeight, s: rec.s, n: 0 }; e.n++; inner.set(key, e);
      }
    }
    if (el.matches('kbd, .kbd, .kb') && /^(space|esc|enter|return|tab|shift|ctrl|alt|del|delete|backspace|pgup|pgdn|home|end|f\d+|[a-z0-9=+\-−↑↓←→]|[↑↓←→]+)$/i.test(txt)) out.push(Object.assign({ k: 'keyboard-hint' }, rec));
    if (cs.pointerEvents !== 'none' && (ctl ? !el.disabled : !!txt) && r.width > 6 && r.height > 6) {   // a control or a text with something on top of it (a hit test cannot see what ignores the pointer)
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (cx >= 0 && cy >= 0 && cx < vw && cy < vh && !topmost(el, cx, cy)) {
        const t = document.elementFromPoint(cx, cy), ov = overlay(t);
        if (!(ov && !ov.contains(el)) && !el.closest('.gmap')) { el.dataset.pfCov = String(++covN); out.push(Object.assign({ k: ctl ? 'covered' : 'text-covered', id: el.dataset.pfCov, by: t ? sel(t) : '?' }, rec)); }
      }
    }
    // the safe areas: the top band and the sides always; the bottom band at the end of a scroll, or always for what does not scroll
    const zones = [], v = clipRect(el, r) || { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
    if (ins.t && v.height && v.top < ins.t - 1 && v.bottom > 1 && !atEnd) zones.push('top');
    if (ins.l && v.width && v.left < ins.l - 1 && v.right > 1) zones.push('left');
    if (ins.r && v.width && v.right > vw - ins.r + 1 && v.left < vw - 1) zones.push('right');
    if (ins.b && v.height && v.bottom > vh - ins.b + 1 && v.top < vh - 1 && (atEnd || !firstScroller)) zones.push('bottom');
    for (const z of zones) {
      const px = z === 'top' ? Math.min(v.right, vw) - 4 : z === 'left' ? Math.max(v.left, 0) + 2 : z === 'right' ? Math.min(v.right, vw) - 2 : Math.max(v.left, 0) + 4;
      const py = z === 'top' ? Math.max(v.top, 0) + 2 : z === 'bottom' ? Math.min(v.bottom, vh) - 2 : v.top + v.height / 2;
      if (px >= 0 && px < vw && py >= 0 && py < vh && (cs.pointerEvents === 'none' || painted(el, px, py))) out.push(Object.assign({ k: 'under-' + z + (z === 'top' ? (ins.t > 30 ? ' (island)' : ' (status bar)') : z === 'bottom' ? ' (home bar)' : ' (notch)') }, rec));
    }
  }
  for (const e of inner.values()) out.push(e);
  return out;
})`;
(async () => {
  const want = (process.argv[2] || Object.keys(SIZES).join(',')).split(','), only = process.argv[3] ? process.argv[3].split(',') : null;
  const srv = await serve(PORT);
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
  const all = {}; let found = 0;
  for (const name of want) {
    const Z = SIZES[name]; if (!Z) { console.log('unknown size', name); continue; }
    const ctx = await browser.newContext({ viewport: { width: Z.w, height: Z.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.addInitScript(() => { try { const k = 'moo.settings.v1', s = JSON.parse(localStorage.getItem(k) || '{}'); s.phoneHints = true; s.installHint = true; s.reduceMotion = true; localStorage.setItem(k, JSON.stringify(s)); } catch (e) { /* ignore */ } });
    const INS = { top: Z.ins.t, bottom: Z.ins.b, left: Z.ins.l, right: Z.ins.r };
    await ctx.route(/\.(css|js)(\?.*)?$/, async route => {
      for (let tries = 0; tries < 3; tries++) {                                   // the local server can drop a connection under load: retry, then let it through
        try {
          const res = await route.fetch(); let body = await res.text();
          body = body.replace(/env\(\s*safe-area-inset-(top|bottom|left|right)\s*(,[^)]*)?\)/g, (m, side) => INS[side] + 'px');
          await route.fulfill({ response: res, body }); return;
        } catch (e) { await sleep(150); }
      }
      try { await route.continue(); } catch (e) { /* the page moved on */ }
    });
    const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    all[name] = {};
    for (const [view, steps, wait] of VIEWS) {
      if (only && !only.includes(view)) continue;
      await page.goto(BOOT); for (let i = 0; i < 120; i++) { if (await page.evaluate(() => !!(window.MOO && MOO.Game && MOO.Game.S && MOO.UI.Screens.current))) break; await sleep(250); }
      await page.evaluate(`(()=>{ const S=MOO.Game.S; for (const E of S.empires) for (const o of S.empires) if (E.id!==o.id) MOO.Sim.Diplo.rec(S,E.id,o.id).contact=true; })()`);
      await sleep(900);
      try { for (const s of steps) { await page.evaluate(s); await sleep(600); } } catch (e) { all[name][view] = { error: e.message }; continue; }
      await sleep(wait || 1300);
      const a = await page.evaluate(`${PROBE}(${JSON.stringify(Z.ins)}, false)`);
      await page.screenshot({ path: path.join(OUT, `${name}-${view}.png`) });
      await page.evaluate(`document.querySelectorAll('*').forEach(e => { const c = getComputedStyle(e); if (/auto|scroll/.test(c.overflowY) && e.scrollHeight > e.clientHeight + 1) e.scrollTop = e.scrollHeight; })`); await sleep(350);
      const b = (await page.evaluate(`${PROBE}(${JSON.stringify(Z.ins)}, true)`)).filter(x => /^under-bottom/.test(x.k));
      const still = new Set(await page.evaluate(`${PROBE}(${JSON.stringify(Z.ins)}, true, true)`));
      for (let i = a.length - 1; i >= 0; i--) if (/covered/.test(a[i].k) && !still.has(a[i].id)) a.splice(i, 1);
      await page.screenshot({ path: path.join(OUT, `${name}-${view}-end.png`) });
      const seen = new Set(), items = [...a, ...b].filter(x => { const key = x.k + '|' + x.sel + '|' + x.s; if (seen.has(key)) return false; seen.add(key); return true; });
      all[name][view] = { items }; found += items.length;
      const by = {}; for (const x of items) by[x.k] = (by[x.k] || 0) + 1;
      console.log('%s %s %s', name.padEnd(11), view.padEnd(17), Object.keys(by).length ? Object.entries(by).map(([k, n]) => k + ' ' + n).join(' · ') : 'clean');
    }
    if (errors.length) console.log(name, 'page errors', JSON.stringify([...new Set(errors)].slice(0, 4)));
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'phone-fit.json'), JSON.stringify(all, null, 1));
  await browser.close(); srv.close();
  process.exitCode = found ? 1 : 0;
})();

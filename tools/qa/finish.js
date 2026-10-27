// "Finished game" sweep: per screen, the tells of an unfinished interface, measured in the DOM.
//   clipped text (overflow hidden, scrollWidth > clientWidth, no ellipsis), sibling buttons of unequal height, distinct font sizes,
//   distinct 1px edge colours, distinct drop shadows, clip-path chamfers, icon sizes, mixed capitalisation inside one container,
//   three-dot truncations, and the light direction of every inset bevel.
// node finish.js [desktop|phone]   → tools/out/audit/finish-<prof>.json + a console summary
const { serve, open, sleep } = require('./lib');
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, '..', 'out', 'audit'); fs.mkdirSync(OUT, { recursive: true });
const prof = process.argv[2] || 'desktop';
const PORT = 8000 + (process.pid % 700);
const BOOT = `http://localhost:${PORT}/index.html?dev=1&screen=galaxy&race=human&size=medium&opp=3&seed=abc&turns=10`;
const contact = `(()=>{const S=MOO.Game.S; for (const E of S.empires) for (const o of S.empires) if (E.id!==o.id) MOO.Sim.Diplo.rec(S,E.id,o.id).contact=true;})()`;
const SCREENS = {
  galaxy: `MOO.UI.Screens.go('galaxy', {})`, system: `MOO.UI.Screens.go('system', { from: 'galaxy' })`, tech: `MOO.UI.Screens.go('tech', { from: 'galaxy' })`,
  techtree: `MOO.UI.Screens.go('techtree', { from: 'galaxy' })`, races: `${contact}; MOO.UI.Screens.go('races', { from: 'galaxy' })`,
  report: `${contact}; MOO.UI.Screens.go('report', { from: 'galaxy' })`, fleets: `MOO.UI.Screens.go('fleets', { from: 'galaxy' })`,
  planets: `MOO.UI.Screens.go('planets', { from: 'galaxy' })`, mapoverview: `MOO.UI.Screens.go('mapoverview', { from: 'galaxy' })`,
  design: `MOO.UI.Screens.go('design', { from: 'galaxy' })`, options: `MOO.UI.Screens.go('options', { from: 'galaxy' })`,
  saveload: `MOO.UI.Screens.go('saveload', { from: 'galaxy', mode: 'save' })`, help: `MOO.UI.Screens.go('help', { from: 'galaxy' })`,
  status: `${contact}; MOO.UI.Screens.go('status', { from: 'galaxy' })`, specs: `MOO.UI.Screens.go('fleets', { from: 'galaxy', mode: 'specs' })`,
};
const COLLECT = `(() => {
  const vw = innerWidth, vh = innerHeight, rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const sel = el => { const p = []; let e = el; while (e && e !== document.body && p.length < 4) { p.unshift(e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/).slice(0, 2).join('.') : '')); e = e.parentElement; } return p.join(' > '); };
  const visible = el => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.right < 0 || r.top > vh || r.left > vw) return null; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return null; return r; };
  const out = { clipped: [], btnH: [], fonts: {}, edges: {}, shadows: {}, chamfers: 0, icons: {}, caseMix: [], dots: [], bevels: { tl: 0, tr: 0, bl: 0, br: 0, top: 0 } };
  const all = [...document.body.querySelectorAll('*')].filter(el => !el.closest('#boot, #tip, script, style, svg'));
  for (const el of all) {
    const r = visible(el); if (!r) continue; const cs = getComputedStyle(el);
    // clipped text
    if ((cs.overflow === 'hidden' || cs.overflowX === 'hidden') && el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== 'ellipsis' && el.children.length === 0 && el.textContent.trim()) out.clipped.push({ sel: sel(el), s: el.textContent.trim().slice(0, 30), over: el.scrollWidth - el.clientWidth });
    // fonts, edges, shadows, chamfers, icons
    if (el.childNodes.length && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) { const k = (parseFloat(cs.fontSize) / rem).toFixed(2); out.fonts[k] = (out.fonts[k] || 0) + 1; }
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) { const w = parseFloat(cs['border' + side + 'Width']); if (w > 0 && w <= 1.5 && cs['border' + side + 'Style'] !== 'none') { const c = cs['border' + side + 'Color']; out.edges[c] = (out.edges[c] || 0) + 1; } }
    if (cs.boxShadow && cs.boxShadow !== 'none') {
      for (const part of cs.boxShadow.split(/,(?![^(]*\\))/)) {
        const p = part.trim(); const m = p.match(/rgba?\\([^)]*\\)/); const nums = p.replace(/rgba?\\([^)]*\\)/, '').trim().split(/\\s+/).filter(x => /px|em|rem|^0$/.test(x) || /^-?[\\d.]+/.test(x));
        if (p.startsWith('inset')) { const x = parseFloat(nums[1] || 0), y = parseFloat(nums[2] || 0), col = m ? m[0] : ''; const light = /255, ?2[0-9]{2}, ?[0-9]{2,3}/.test(col) && !/, 0\\)/.test(col);
          if (light) { if (x > 0 && y > 0) out.bevels.tl++; else if (x < 0 && y > 0) out.bevels.tr++; else if (x > 0 && y < 0) out.bevels.bl++; else if (x < 0 && y < 0) out.bevels.br++; else if (x === 0 && y > 0) out.bevels.top++; } }
        else { const x = parseFloat(nums[0] || 0), y = parseFloat(nums[1] || 0), b = parseFloat(nums[2] || 0); if (b > 2 || Math.abs(y) > 1) { const k = y.toFixed(0) + '/' + b.toFixed(0); out.shadows[k] = (out.shadows[k] || 0) + 1; } }
      }
    }
    if (cs.clipPath && cs.clipPath !== 'none' && cs.clipPath.includes('polygon')) out.chamfers++;
    if (el.classList.contains('ico') || el.tagName === 'svg' && el.closest('.ico')) { const k = Math.round(r.width) + 'x' + Math.round(r.height); out.icons[k] = (out.icons[k] || 0) + 1; }
  }
  // sibling buttons of unequal height
  const parents = new Set([...document.body.querySelectorAll('.btn')].map(b => b.parentElement));
  for (const p of parents) { const bs = [...p.children].filter(c => c.classList.contains('btn') && visible(c)); if (bs.length < 2) continue; const hs = bs.map(b => Math.round(b.getBoundingClientRect().height)); const mn = Math.min(...hs), mx = Math.max(...hs); if (mx - mn > 2) out.btnH.push({ sel: sel(p), hs }); }
  // mixed capitalisation inside one container of labels
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; const byParent = new Map();
  while ((n = walker.nextNode())) { const s = n.textContent.trim(); if (!s || s.length < 3 || /^[\\d.,%+\\-–—/ ]+$/.test(s)) continue; const el = n.parentElement; if (!el || el.closest('#boot, #tip, script, style')) continue; if (!visible(el)) continue; const cs = getComputedStyle(el); const shown = cs.textTransform === 'uppercase' ? s.toUpperCase() : s; const kind = shown === shown.toUpperCase() && /[A-Z]/.test(shown) ? 'CAPS' : /^[A-Z][a-z]/.test(shown) ? 'Title' : /^[a-z]/.test(shown) ? 'lower' : 'other'; const gp = el.parentElement && el.parentElement.parentElement; if (!gp) continue; if (!byParent.has(gp)) byParent.set(gp, {}); const m = byParent.get(gp); (m[kind] = m[kind] || []).push(s.slice(0, 18)); if (/\\.\\.\\./.test(s)) out.dots.push({ sel: sel(el), s: s.slice(0, 40) }); }
  for (const [gp, m] of byParent) { const kinds = Object.keys(m).filter(k => k !== 'other'); if (kinds.includes('CAPS') && (kinds.includes('Title') || kinds.includes('lower')) && Object.values(m).reduce((a, b) => a + b.length, 0) >= 3) out.caseMix.push({ sel: sel(gp), caps: m.CAPS.slice(0, 3), mixed: (m.Title || []).concat(m.lower || []).slice(0, 3) }); }
  return out;
})()`;
(async () => {
  const srv = await serve(PORT);
  const o = prof === 'desktop' ? { viewport: { width: 1920, height: 1080 } } : { phone: true };
  const { browser, page } = await open(o);
  await page.goto(BOOT); await sleep(6000);
  const res = {};
  for (const [name, js] of Object.entries(SCREENS)) {
    try { await page.evaluate(js); } catch (e) { console.log('skip', name, e.message); continue; }
    await sleep(2000);
    res[name] = await page.evaluate(COLLECT);
    const r = res[name];
    console.log('%s: clipped %d · unequal btn groups %d · font sizes %d · edge colours %d · drop shadows %d · chamfers %d · icon sizes %d · case-mix %d · "..." %d · bevels tl %d tr %d bl %d br %d top %d',
      name.padEnd(12), r.clipped.length, r.btnH.length, Object.keys(r.fonts).length, Object.keys(r.edges).length, Object.keys(r.shadows).length, r.chamfers, Object.keys(r.icons).length, r.caseMix.length, r.dots.length, r.bevels.tl, r.bevels.tr, r.bevels.bl, r.bevels.br, r.bevels.top);
  }
  fs.writeFileSync(path.join(OUT, 'finish-' + prof + '.json'), JSON.stringify(res, null, 1));
  await browser.close(); srv.close();
})();

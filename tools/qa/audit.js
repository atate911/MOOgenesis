// Polish audit: for each screen, a screenshot + a JSON of every visible text element (rect, colour, size, weight, selector) and of every
// visible box's padding / gap / margin (px) so audit.py can score text contrast against the real pixels behind it and the spacing rhythm.
// node audit.js [desktop|phone]     env TIER=high for the GL look.   Output: tools/out/audit/<prof>-<screen>.{png,json}
const { serve, open, sleep } = require('./lib');
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, '..', 'out', 'audit'); fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
const prof = process.argv[2] || 'desktop';
const PORT = 8000 + (process.pid % 700);
const BOOT = `http://localhost:${PORT}/index.html?dev=1&screen=galaxy&race=human&size=medium&opp=3&seed=abc&turns=10`;
const contact = `(()=>{const S=MOO.Game.S; for (const E of S.empires) for (const o of S.empires) if (E.id!==o.id) MOO.Sim.Diplo.rec(S,E.id,o.id).contact=true;})()`;
const SCREENS = {
  galaxy: `MOO.UI.Screens.go('galaxy', {})`,
  system: `MOO.UI.Screens.go('system', { from: 'galaxy' })`,
  tech: `MOO.UI.Screens.go('tech', { from: 'galaxy' })`,
  techtree: `MOO.UI.Screens.go('techtree', { from: 'galaxy' })`,
  races: `${contact}; MOO.UI.Screens.go('races', { from: 'galaxy' })`,
  report: `${contact}; MOO.UI.Screens.go('report', { from: 'galaxy' })`,
  fleets: `MOO.UI.Screens.go('fleets', { from: 'galaxy' })`,
  planets: `MOO.UI.Screens.go('planets', { from: 'galaxy' })`,
  mapoverview: `MOO.UI.Screens.go('mapoverview', { from: 'galaxy' })`,
  design: `MOO.UI.Screens.go('design', { from: 'galaxy' })`,
  options: `MOO.UI.Screens.go('options', { from: 'galaxy' })`,
  saveload: `MOO.UI.Screens.go('saveload', { from: 'galaxy', mode: 'save' })`,
  help: `MOO.UI.Screens.go('help', { from: 'galaxy' })`,
  status: `${contact}; MOO.UI.Screens.go('status', { from: 'galaxy' })`,
  specs: `MOO.UI.Screens.go('fleets', { from: 'galaxy', mode: 'specs' })`,
};
const COLLECT = `(() => {
  const vw = innerWidth, vh = innerHeight, rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const vis = el => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.right < 0 || r.top > vh || r.left > vw) return null; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return null; return r; };
  const sel = el => { const p = []; let e = el; while (e && e !== document.body && p.length < 4) { p.unshift(e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/).slice(0, 2).join('.') : '')); e = e.parentElement; } return p.join(' > '); };
  const texts = [], boxes = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const s = n.textContent.replace(/\\s+/g, ' ').trim(); if (!s) continue;
    const el = n.parentElement; if (!el || el.closest('#boot, #tip, script, style')) continue;
    const range = document.createRange(); range.selectNodeContents(n); const r = range.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    let op = 1, e = el; while (e && e !== document.body) { op *= +getComputedStyle(e).opacity || 1; e = e.parentElement; }
    if (op < 0.05) continue;
    texts.push({ s: s.slice(0, 40), x: r.left, y: r.top, w: r.width, h: r.height, color: cs.color, fs: parseFloat(cs.fontSize), fw: cs.fontWeight, op, shadow: cs.textShadow !== 'none', sel: sel(el) });
  }
  for (const el of document.body.querySelectorAll('div, section, header, footer, main, nav, ul, li, button, span, label, h1, h2, h3, h4, td, th, p')) {
    const r = vis(el); if (!r) continue; const cs = getComputedStyle(el);
    const px = v => Math.round(parseFloat(v) * 100) / 100;
    const pad = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map(px), mar = [cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft].map(px);
    const gap = cs.display.includes('flex') || cs.display.includes('grid') ? [px(cs.rowGap === 'normal' ? '0' : cs.rowGap), px(cs.columnGap === 'normal' ? '0' : cs.columnGap)] : null;
    if (pad.some(v => v) || (gap && gap.some(v => v))) boxes.push({ sel: sel(el), pad, mar, gap, w: Math.round(r.width), h: Math.round(r.height) });
  }
  return { vw, vh, rem, texts, boxes };
})()`;
(async () => {
  const srv = await serve(PORT);
  const o = prof === 'desktop' ? { viewport: { width: 1920, height: 1080 } } : { phone: true };
  const { browser, page, errors } = await open(o);
  await page.goto(BOOT); await sleep(6000);
  const slow = process.env.TIER ? 4000 : 0;
  for (const [name, js] of Object.entries(SCREENS)) {
    try { await page.evaluate(js); } catch (e) { console.log('skip', name, e.message); continue; }
    await sleep(2200 + slow);
    const f = path.join(OUT, prof + '-' + name);
    await page.screenshot({ path: f + '.png' });
    const data = await page.evaluate(COLLECT);
    fs.writeFileSync(f + '.json', JSON.stringify(data));
    console.log('audit', name, data.texts.length, 'texts', data.boxes.length, 'boxes');
  }
  console.log('errors', JSON.stringify([...new Set(errors)].filter(x => !/fonts\.g|swiftshader|GPU stall|willReadFrequently|inst-spaceport|api\/status/i.test(x)).slice(0, 6)));
  await browser.close(); srv.close();
})();

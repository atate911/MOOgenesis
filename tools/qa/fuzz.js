// Monkey test: random clicks on visible buttons / canvases and random hotkeys across screens; reports console errors with the last actions. usage: node fuzz.js [seconds] [seed]
const { serve, open, sleep } = require('./lib');
(async () => {
  const secs = +process.argv[2] || 60; let seed = +process.argv[3] || 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const PORT = +process.env.PORT || 8818; const srv = await serve(PORT);
  const { browser, page, errors } = await open();
  await page.goto(`http://localhost:${PORT}/index.html?dev=1&screen=galaxy&race=human&size=medium&opp=3&seed=fz&turns=25`); await sleep(1500);
  await page.evaluate(() => { const S = MOO.Game.S; for (const E of S.empires) for (const o of S.empires) if (E.id !== o.id) MOO.Sim.Diplo.rec(S, E.id, o.id).contact = true; });
  const keys = ['g', 'd', 'f', 'm', 'r', 'p', 't', 'n', 'Escape', 'Space', 'Enter', 'a', 'b', 'c', 's', 'x', 'F1', 'F2', 'F3', 'F4', 'F5', 'Home', '1', '2', '3', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', '='];
  const t0 = Date.now(); const acts = []; let n = 0, lastErr = 0;
  while (Date.now() - t0 < secs * 1000) {
    n++;
    const r = rnd(); let a;
    let hung = false; const wd = setTimeout(() => { hung = true; console.log('HANG after', acts.join(' > '), 'n=', n); process.exit(3); }, 15000);
    try {
      if (r < 0.5) {
        a = await page.evaluate(v => { const bs = [...document.querySelectorAll('button, .au-item, .tbl tr.clickable, .dz-card, .dz-slot, select')].filter(b => b.offsetParent && !b.disabled && !/Quit to title|Next turn|^New game/i.test(b.textContent)); if (!bs.length) return 'none'; const b = bs[Math.floor(v * bs.length)]; b.click(); return 'click:' + (b.textContent || b.className).trim().replace(/\s+/g, ' ').slice(0, 24); }, rnd());
      } else if (r < 0.62) {
        const box = await page.evaluate(() => { const c = [...document.querySelectorAll('canvas')].filter(c => c.offsetParent && c.width > 200)[0]; if (!c) return null; const b = c.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
        if (box) { const x = box.x + rnd() * box.w, y = box.y + rnd() * box.h, right = rnd() < 0.2; await page.mouse.move(x, y); if (rnd() < 0.15) await page.mouse.wheel(0, (rnd() - 0.5) * 600); else await page.mouse.click(x, y, { button: right ? 'right' : 'left', clickCount: rnd() < 0.15 ? 2 : 1 }); a = 'canvas' + (right ? 'R' : ''); } else a = 'nocanvas';
      } else { const k = keys[Math.floor(rnd() * keys.length)]; await page.keyboard.press(k); a = 'key:' + k; }
    } catch (e) { a = 'ERR ' + e.message.slice(0, 50); }
    clearTimeout(wd);
    acts.push(a); if (acts.length > 8) acts.shift();
    if (errors.length > lastErr) { console.log('ERRORS after', acts.join(' > '), JSON.stringify(errors.slice(lastErr))); lastErr = errors.length; }
    // keep the run out of dead ends
    if (n % 40 === 0) { const s = await page.evaluate(() => ({ scr: MOO.UI.Screens.current.id, g: MOO.Game.hasGame() })); if (!s.g) { await page.goto(`http://localhost:${PORT}/index.html?dev=1&screen=galaxy&race=human&size=medium&opp=3&seed=fz&turns=25`); await sleep(1200); } else if (['menu', 'setup'].includes(s.scr)) await page.evaluate(() => MOO.UI.Screens.go('galaxy')); }
    if (n % 15 === 0) await page.evaluate(() => document.querySelectorAll('.scrim').length > 3 && document.querySelectorAll('.scrim').forEach(s => s.remove()));
    await sleep(40);
  }
  console.log('actions', n, 'errors', JSON.stringify([...new Set(errors)].slice(0, 20)));
  await browser.close(); srv.close();
})();

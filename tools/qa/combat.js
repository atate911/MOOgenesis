// Tactical combat QA: war scenario at the player's capital (enemy fleet + player fleet), real Game.endTurn, prebattle card -> tactical screen driven with real mouse clicks.
// usage: node combat.js [mode=tactical|auto|retreat] [W H]   screenshots -> /tmp/claude-0/cb-*.png
const { serve, open, sleep } = require('./lib');
(async () => {
  const mode = process.argv[2] || 'tactical';
  const W = +process.argv[3] || 1280, H = +process.argv[4] || 720;
  const PORT = +process.env.PORT || 8791;
  const srv = await serve(PORT);
  const { browser, page, errors } = await open({ viewport: { width: W, height: H } });
  await page.goto(`http://localhost:${PORT}/index.html?dev=1&screen=galaxy&race=human&size=medium&opp=3&seed=abc&turns=12`);
  await sleep(1200);
  const setup = await page.evaluate(() => {
    const G = MOO.Game, S = G.S, Sim = MOO.Sim, me = G.player(), cap = me.capital;
    Sim.Diplo.startWar(S, 0, 1, 'qa'); Sim.Diplo.rec(S, 0, 1).contact = Sim.Diplo.rec(S, 1, 0).contact = true;
    const en = S.empires[1];
    // enemy ships: use designs 2 (Destroyer) and 3 (Bomber) if present
    Sim.Fleet.addShips(S, 1, cap, 2, 5); Sim.Fleet.addShips(S, 1, cap, 3, 2);
    Sim.Fleet.addShips(S, 0, cap, 2, 4);
    me.bc = 5000; G.handlers.aiPlan = async () => ({});
    return { cap, mine: S.fleets.filter(f => f.owner === 0 && f.star === cap).map(f => f.ships), theirs: S.fleets.filter(f => f.owner === 1 && f.star === cap).map(f => f.ships) };
  });
  console.log('setup', JSON.stringify(setup));
  await page.evaluate(() => { const H = MOO.Game.handlers; window.__int = []; for (const k of Object.keys(H)) { const f = H[k]; H[k] = async function (it) { window.__int.push(k); window.__cur = k; const r = await f.apply(this, arguments); window.__cur = null; return r; }; } });
  const turnP = page.evaluate(() => MOO.Game.endTurn().then(r => ({ ints: r.interrupts, over: r.over })));
  let done = false; turnP.then(() => { done = true; });
  let shot = 0, steps = 0;
  const snap = async n => { await page.screenshot({ path: `/tmp/claude-0/cb-${mode}-${n}-${W}x${H}.png` }); };
  while (!done && steps++ < 400) {
    if (process.env.V) console.log('step', steps);
    const st = await page.evaluate(() => {
      const scr = MOO.UI.Screens.current.id, o = { scr };
      if (scr === 'galaxy') { const b = [...document.querySelectorAll('.pb-acts button')].map(b => b.textContent.trim()); o.btns = b.slice(0, 8); }
      if (scr === 'combat') { const s = MOO.UI.Combat.session(); if (s) { const B = s.B; o.over = B.over; o.active = B.active; o.round = B.round; } }
      return o;
    });
    if (process.env.V) console.log(JSON.stringify(st), await page.evaluate(() => [window.__cur, window.__int.join(','), MOO.UI.Side.current()]));
    if (st.scr === 'galaxy' && st.btns && st.btns.length) {
      if (!shot++) await snap('prebattle');
      const want = mode === 'auto' ? /^Auto/i : mode === 'retreat' ? /^Retreat/i : /^Continue/i;
      await page.evaluate(re => { const b = [...document.querySelectorAll('.pb-acts button')].find(b => new RegExp(re, 'i').test(b.textContent.trim())); if (b) b.click(); }, want.source);
      await sleep(600); continue;
    }
    if (st.scr === 'combat') {
      if (st.over !== undefined && st.over) { await sleep(500); await snap('over'); await page.keyboard.press('Space'); await sleep(400); continue; }
      const plan = await page.evaluate(() => {
        const s = MOO.UI.Combat.session(); if (!s) return null; const B = s.B, C = MOO.Sim.Combat, v = s.view;
        if (B.active === null || B.active === undefined) return null;
        const u = B.units[B.active]; if (!u || B.sides[u.side].ctl !== 'human') return { key: 'none' };
        if (document.querySelector('.cb-canvas.wait')) return null;
        const cv = document.querySelector('.cb-canvas').getBoundingClientRect();
        const pt = (x, y) => { const r = v.cellRect(x, y); return { x: cv.left + r.x + r.w / 2, y: cv.top + r.y + r.h / 2 }; };
        const tg = C.targets(B, u.id, 'all');
        if (tg.length) { const t = C.unit(B, tg[0].id); return { click: pt(t.x, t.y), what: 'fire ' + t.name }; }
        const foes = B.units.filter(q => q.side !== u.side && !q.gone && q.count > 0);
        const mv = C.legalMoves(B, u.id);
        if (foes.length && mv.length) { const f = foes[0]; mv.sort((a, b) => Math.max(Math.abs(a.x - f.x), Math.abs(a.y - f.y)) - Math.max(Math.abs(b.x - f.x), Math.abs(b.y - f.y))); return { click: pt(mv[0].x, mv[0].y), what: 'move' }; }
        return { key: 'd', what: 'done' };
      });
      if (plan && plan.click) { await page.mouse.move(plan.click.x, plan.click.y); await page.mouse.click(plan.click.x, plan.click.y); }
      else if (plan && plan.key && plan.key !== 'none') await page.keyboard.press(plan.key);
      else if (plan && plan.key === 'none') await sleep(100);
      if (steps === 12 || steps === 40) { await snap('mid' + steps); }
      if (steps === 20) { for (const k of ['s', 'p']) { await page.keyboard.press(k); await sleep(600); await snap('ov-' + k); await page.keyboard.press('Escape'); await sleep(200); } }
      await sleep(250); continue;
    }
    if (st.scr !== 'galaxy') await page.keyboard.press('Space');
    await page.evaluate(() => { const m = [...document.querySelectorAll('.scrim .modal')].pop(); if (m) { const b = [...m.querySelectorAll('.modal-f button')]; (b.find(x => x.classList.contains('primary')) || b[b.length - 1]).click(); } });
    await sleep(300);
  }
  const res = await Promise.race([turnP, sleep(5000).then(() => 'unfinished')]);
  console.log('result', JSON.stringify(res), 'steps', steps);
  const after = await page.evaluate(() => { const S = MOO.Game.S; return { turn: S.turn, mine: S.fleets.filter(f => f.owner === 0).map(f => f.ships.join('/') + '@' + f.star), theirs: S.fleets.filter(f => f.owner === 1).map(f => f.ships.join('/') + '@' + f.star), scr: MOO.UI.Screens.current.id }; });
  console.log('after', JSON.stringify(after));
  await snap('end');
  console.log([...new Set(errors)]);
  await browser.close(); srv.close();
})();

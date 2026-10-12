// A UI "player bot": polls the DOM and answers whatever the real turn pipeline put on screen (side-panel cards, modals, audience menus, council, GNN, scenes, tactical battles).
const { sleep } = require('./lib');
// returns a controller { stop(), stats }
function start(page, o = {}) {
  const stats = { clicks: 0, screens: {}, seen: [] }; let on = true;
  const rnd = (() => { let s = o.seed || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; })();
  (async () => {
    while (on) {
      try {
        const r = await page.evaluate(({ rv, opts }) => {
          const UI = MOO.UI, cur = UI.Screens.current && UI.Screens.current.id, vis = e => e && e.offsetParent !== null && !e.disabled;
          const out = { screen: cur, did: null };
          const press = k => { out.key = k; };
          const modal = [...document.querySelectorAll('.scrim .modal')].pop();
          if (modal) { const b = [...modal.querySelectorAll('.modal-f button')].filter(vis); const t = modal.textContent.slice(0, 80); const pick = b.find(x => x.classList.contains('primary')) || b[b.length - 1]; if (pick) { out.did = 'modal:' + t + ' -> ' + pick.textContent; pick.click(); } return out; }
          if (cur === 'audience') {
            const items = [...document.querySelectorAll('.au-item')].filter(vis);
            if (items.length) {
              const yes = items.filter(b => /accept|agree|yes|ok|continue|continue/i.test(b.textContent));
              const pool = opts.audiencePick === 'random' ? items : (yes.length ? yes : items);
              const b = pool[Math.floor(rv * pool.length)]; out.did = 'au:' + b.textContent.trim().replace(/\s+/g, ' ').slice(0, 40); b.click();
            } else press('Space');
            return out;
          }
          if (cur === 'combat') { out.did = 'combat'; return out; }
          if (cur === 'galaxy') {
            if (UI.Side.current() === 'combatResult') { press('Space'); out.did = 'combatResult'; return out; }
            const pbA = document.querySelector('.pb-acts');
            if (pbA) { const b = [...pbA.querySelectorAll('button')].find(x => new RegExp(opts.battle || 'Auto').test(x.textContent.trim())); if (b) { out.did = 'prebattle -> ' + b.textContent.trim(); b.click(); } return out; }
            const card = document.querySelector('.sm-actions');
            if (card) { const bs = [...card.querySelectorAll('button')].filter(vis); if (bs.length) { const b = bs.find(x => /^(yes|continue|accept)/i.test(x.textContent.trim())) || bs.find(x => x.classList.contains('primary')) || bs[0]; out.did = 'card:' + (document.querySelector('.sm-event h4') || {}).textContent + ' -> ' + b.textContent.trim(); b.click(); } return out; }
            const pb = document.querySelector('.pb-btns button, .prebattle button'); void pb;
            return out;
          }
          if (cur === 'council') { const ks = opts.councilKeys || ['Space', '1', '2', '0', 'y', 'n']; press(ks[Math.floor(rv * ks.length)]); out.did = 'council'; return out; }
          if (cur !== 'galaxy') { press(cur === 'landing' ? 'Enter' : 'Space'); out.did = 'space@' + cur; return out; }
          return out;
        }, { rv: rnd(), opts: o });
        if (r.key) await page.keyboard.press(r.key);
        stats.screens[r.screen] = (stats.screens[r.screen] || 0) + 1;
        if (r.did) { stats.clicks++; if (o.verbose) console.log('   bot:', r.did); stats.seen.push(r.did); }
        if (o.onTick) await o.onTick(r);
      } catch (e) { if (/closed|destroyed|Target/.test(e.message)) break; }
      await sleep(o.interval || 150);
    }
  })();
  return { stats, stop() { on = false; } };
}
module.exports = { start };

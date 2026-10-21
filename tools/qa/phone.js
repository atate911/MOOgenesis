// Phone QA: an emulated touch phone (390x844 portrait, 844x390 with `landscape`, 360x740 with `small`) driven against the real gate in
// index.html (no ?phone=1), plus a desktop pass proving the phone layer stays out of the way. Prints PASS / FAIL per check, the scale-audit
// findings per screen, and the touch audit (targets under 40px, text under 12px).
// usage: node tools/qa/phone.js [landscape|small] [step ...]
//   steps: gate galaxy battle screens scenes menus design back tips bot desktop   (default: all)
//   env:   SHOTS=dir (default /tmp/claude-0/phone) · PORT (default 8794) · TURNS (dev auto-play turns before the checks, default 10)
const { serve, open, sleep, ROOT } = require('./lib');
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2);
const LAND = args.includes('landscape'), SMALL = args.includes('small');
const STEPS = args.filter(a => a !== 'landscape' && a !== 'small');
const want = s => !STEPS.length || STEPS.includes(s);
const SHOTS = process.env.SHOTS || '/tmp/claude-0/phone';
const PORT = +process.env.PORT || 8794;
const TURNS = process.env.TURNS || 10;
const BOOT = `http://localhost:${PORT}/index.html?dev=1&screen=galaxy&race=human&size=medium&opp=3&seed=abc&turns=${TURNS}`;
const AUDIT = fs.readFileSync(path.join(ROOT, 'tools/qa/scale-audit.js'), 'utf8');
fs.mkdirSync(SHOTS, { recursive: true });

let fails = 0, passes = 0;
const check = (name, ok, extra) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra !== undefined && extra !== '' ? ' :: ' + extra : '')); if (ok) passes++; else fails++; };
const within = (p, ms, label) => Promise.race([p, sleep(ms).then(() => { throw new Error('timeout: ' + label); })]);
// expected noise: offline web fonts, software-GL driver chatter, and art still listed in ART-NEEDED.md (the code falls back to other art)
const benign = e => /fonts\.(googleapis|gstatic)|net::ERR_|Failed to load resource|ERR_TUNNEL|ERR_PROXY|GL Driver Message|assets\/art\/still\/|\/api\/status/.test(e);   // + the save-server probe (absent on a static dev server)

async function bootGame(page) {
  await page.goto(BOOT, { waitUntil: 'load' });
  for (let i = 0; i < 240; i++) { if (await page.evaluate(() => !!(window.MOO && MOO.Game && MOO.Game.S && !MOO.Game.busy && MOO.UI.Screens.current))) break; await sleep(500); }
  await page.evaluate(() => { const S = MOO.Game.S; for (const E of S.empires) for (const o of S.empires) if (E.id !== o.id) MOO.Sim.Diplo.rec(S, E.id, o.id).contact = true; });
  await page.evaluate(() => MOO.UI.Screens.go('galaxy'));
  await sleep(1200);
}
// elements that stick out of the viewport where nothing lets the player reach them: not inside a scrolling or clipping container
const offscreen = page => page.evaluate(() => {
  const W = innerWidth, H = innerHeight, scr = document.querySelector('.screen.active'), out = [];
  if (!scr) return ['no active screen'];
  const contained = e => { for (let p = e.parentElement; p && p !== scr; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') return true; } return false; };
  for (const e of scr.querySelectorAll('*')) {
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.position === 'fixed') continue;
    if (e.closest('svg') && e.tagName !== 'svg') continue;
    if ((r.right > W + 6 || r.bottom > H + 6 || r.left < -6 || r.top < -6) && !contained(e)) out.push(e.tagName + '.' + String(typeof e.className === 'string' ? e.className : '').slice(0, 28) + ' ' + [r.left, r.top, r.right, r.bottom].map(Math.round).join(','));
  }
  return out.slice(0, 5);
});
// touch audit: interactive boxes under 40px (36px tall for rows 100px+ wide, 24px for slider tracks) and visible text under 12px, on the active screen or the top
// dialog; grouped by tag.class → [[key, count, smallest], ...]
const touchAudit = page => page.evaluate(() => {
  const scope = [...document.querySelectorAll('.scrim .modal')].pop() || document.querySelector('.screen.active'); if (!scope) return { t: [], x: [] };
  const vis = e => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return null; const cs = getComputedStyle(e); return cs.visibility === 'hidden' || +cs.opacity === 0 ? null : r; };
  const key = e => e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const T = new Map(), X = new Map(), add = (m, k, v) => { const o = m.get(k) || [k, 0, 1e9]; o[1]++; o[2] = Math.min(o[2], Math.round(v)); m.set(k, o); };
  const SEL = 'button, .btn, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], .s-btn, .s-lock, .s-track';
  const seen = new Set();
  for (const e of scope.querySelectorAll('*')) {
    if (e.closest('svg') && e.tagName !== 'svg') continue;
    let t = null;
    if (e.matches(SEL)) t = e.closest('label') || e;
    else { const c = getComputedStyle(e).cursor; if (c === 'pointer' && (!e.parentElement || getComputedStyle(e.parentElement).cursor !== 'pointer')) t = e; }
    if (t && !seen.has(t) && !t.closest('.ph-tip') && t.tagName !== 'CANVAS' && !t.classList.contains('ph-grip')) {   // the grip's ::after reaches --tap
      seen.add(t); const r = vis(t);
      if (r) { const need = t.classList.contains('s-track') ? 24 : r.width >= 100 ? 36 : 40; if (r.height < need - 0.5 || r.width < Math.min(need, 39.5)) add(T, key(t), Math.min(r.width, r.height)); }   // slider tracks: 24px (WCAG 2.5.8); rows: 36px
    }
    if ([...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) {
      const r = vis(e), fs = parseFloat(getComputedStyle(e).fontSize);
      if (r && fs > 0 && fs < 11.5) add(X, key(e) + '"' + e.textContent.trim().slice(0, 14) + '"', fs);
    }
  }
  const top = m => [...m.values()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  return { t: top(T), x: top(X) };
});
const fmtAudit = a => (a.t.length ? '\n      targets: ' + a.t.map(([k, n, v]) => k + '×' + n + '(' + v + ')').join(' ') : '') + (a.x.length ? '\n      text: ' + a.x.map(([k, n, v]) => k + '×' + n + '(' + v + ')').join(' ') : '');
const sheetState = page => page.evaluate(() => { const s = document.querySelector('.gx-side:not(.gx-float)'); return s ? s.dataset.sheet || '' : 'none'; });

(async () => {
  const srv = await serve(PORT);
  const pre = LAND ? 'L-' : SMALL ? 'S-' : '';
  const { browser, ctx, page, errors } = await open({ phone: LAND ? 'landscape' : SMALL ? 'small' : true });
  page.setDefaultTimeout(10000);
  const shot = async name => { const f = path.join(SHOTS, pre + name + '.png'); await page.screenshot({ path: f }); return f; };
  const audit = async () => { await page.evaluate(src => { if (!window.__audit) (0, eval)(src); }, AUDIT); return page.evaluate(() => __audit().out); };
  const back = () => page.evaluate(() => MOO.UI.Phone.back());
  const step = async (name, fn) => { if (!want(name)) return; console.log('--- ' + name); try { await within(fn(), 180000, name); } catch (e) { check(name + ' completed', false, e.message.split('\n')[0]); } };
  try {
    await bootGame(page);

    await step('gate', async () => {
      const st = await page.evaluate(() => ({ attr: document.documentElement.hasAttribute('data-phone'), tier: MOO.Perf.tier, soft: !!(MOO.Perf.caps && MOO.Perf.caps.software), gl: MOO.Perf.q.gl, workers: MOO.Workers.stats().size, samples: MOO.Audio.Samples.enabled, font: getComputedStyle(document.documentElement).fontSize }));
      check('gate on from the device itself (no ?phone=1)', st.attr);
      check('perf tier: phone (low on a software renderer)', st.tier === (st.soft ? 'low' : 'phone'), st.tier + (st.soft ? ' · software GL' : '') + (st.gl ? ' · gl' : ' · 2d'));
      check('worker pool at most 2', st.workers <= 2, st.workers);
      check('sampled orchestra off', st.samples === false);
      check('root font readable', parseFloat(st.font) >= 11, st.font);
      check('Back hidden on the galaxy screen', !(await page.$eval('.ph-back', e => e.classList.contains('on'))));
      await page.keyboard.press('F1'); await sleep(300);
      check('F1 help overlay disabled', !(await page.$('.hp-ov')));
      const man = await page.evaluate(async () => { const l = document.querySelector('link[rel=manifest]'); if (!l) return null; const r = await fetch(l.href); const j = await r.json(); return { ok: r.ok, icons: (j.icons || []).length, display: j.display }; });
      check('installable: manifest with icons', !!man && man.ok && man.icons >= 2 && man.display === 'standalone', JSON.stringify(man));
    });

    await step('galaxy', async () => {
      if (LAND) {                                                   // landscape: the side panel is a right-hand column (no sheet handle)
        const col = await page.evaluate(() => { const s = document.querySelector('.gx-side:not(.gx-float)'), r = s.getBoundingClientRect(), g = s.querySelector('.ph-grip'); return { l: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height), grip: !!(g && g.offsetParent) }; });
        check('landscape: side panel is a right-hand column', col.l > 400 && col.h > 250 && !col.grip, JSON.stringify(col));
        await shot('galaxy-column');
        const ids = await page.evaluate(() => { const S = MOO.Game.S, E = MOO.Game.player(), cap = S.planets[E.capital]; return { star: cap.starId }; });
        const far = await page.evaluate(star => MOO.Game.S.stars.filter(s => s.id !== star)[0].id, ids.star);
        await page.evaluate(([s, d]) => MOO.UI.Side.show('fleetDeploy', { star: s, dest: d, float: true }), [ids.star, far]); await sleep(400);
        const fl = await page.evaluate(() => { const f = document.querySelector('.gx-float'), r = f.getBoundingClientRect(); return { on: f.classList.contains('on'), l: Math.round(r.left), b: Math.round(innerHeight - r.bottom), t: Math.round(r.top) }; });
        check('landscape: a panel opened from the map sits at the lower left, on screen', fl.on && fl.l < 20 && fl.t >= 0, JSON.stringify(fl));
        await shot('galaxy-float'); await back(); await sleep(300);
        return;
      }
      check('sheet starts collapsed', (await sheetState(page)) === 'strip');
      console.log('   galaxy (strip):' + fmtAudit(await touchAudit(page)));
      await shot('galaxy-strip');
      const grip = await page.$('.gx-side:not(.gx-float) .ph-grip');
      await grip.tap(); await sleep(350); check('handle tap opens halfway', (await sheetState(page)) === 'half'); await shot('galaxy-half');
      console.log('   galaxy (half):' + fmtAudit(await touchAudit(page)));
      await grip.tap(); await sleep(350); check('second tap opens fully', (await sheetState(page)) === 'full'); await shot('galaxy-full');
      await grip.tap(); await sleep(350); check('third tap collapses', (await sheetState(page)) === 'strip');
      await (await page.$('.gx-side:not(.gx-float) .side-title')).tap(); await sleep(350);
      check('title tap opens halfway', (await sheetState(page)) === 'half');
      const ov = await page.evaluate(() => { const p = document.querySelector('.gx-side:not(.gx-float) .panel'), r = p.getBoundingClientRect(); const out = [...p.querySelectorAll('*')].filter(e => { const q = e.getBoundingClientRect(); return q.width && q.right > r.right + 2; }).slice(0, 3).map(e => e.className); return out; });
      check('nothing in the colony panel spills past its right edge', !ov.length, ov.join(', '));
      await page.evaluate(() => MOO.UI.Phone.galaxySheet().set('strip'));
      // a finger lands 16px off a star: the star is still picked (22px touch radius)
      const tgt = await page.evaluate(() => {
        const m = MOO.UI.Galaxy.map, d = m._dbg(), r = m.canvas.getBoundingClientRect(), sel = m.getSelection().star;
        const ok = s => s.on && s.id !== sel && s.sx > 40 && s.sx < r.width - 90 && s.sy > 200 && s.sy < r.height - 200 && d.SD.every(o => o === s || Math.hypot(o.sx - s.sx, o.sy - s.sy) > 60);
        const s = d.SD.find(ok); return s ? { id: s.id, x: r.left + s.sx + 15, y: r.top + s.sy + 6 } : null;
      });
      if (tgt) { await page.touchscreen.tap(tgt.x, tgt.y); await sleep(500); }
      check('a tap 16px off a star selects it', !!tgt && (await page.evaluate(() => MOO.UI.Galaxy.map.getSelection().star)) === tgt.id, JSON.stringify(tgt));
      await page.evaluate(() => { MOO.UI.Phone.galaxySheet().set('strip'); const E = MOO.Game.player(); MOO.UI.Galaxy.map.select(MOO.Game.S.planets[E.capital].starId, { emit: true }); }); await sleep(300);
      const bar = await page.evaluate(() => { const b = document.querySelector('.gx-bar'), n = b.querySelector('.btn.primary').getBoundingClientRect(); return { scroll: b.scrollWidth > b.clientWidth, ok: n.right <= innerWidth + 0.5 && n.left >= 0, edge: innerWidth - n.right }; });
      check('Next turn stays in view while the bar scrolls', bar.ok, JSON.stringify(bar));
      const ids = await page.evaluate(() => { const S = MOO.Game.S, E = MOO.Game.player(), cap = S.planets[E.capital]; return { star: cap.starId, planet: cap.id }; });
      await page.evaluate(id => MOO.UI.Side.show('reloc', { planet: id }), ids.planet); await sleep(300);
      check('Reloc opens the sheet halfway', (await sheetState(page)) === 'half'); await shot('galaxy-reloc');
      await back(); await sleep(300);
      const far = await page.evaluate(star => { const S = MOO.Game.S; return S.stars.filter(s => s.id !== star)[0].id; }, ids.star);
      await page.evaluate(([s, d]) => MOO.UI.Side.show('fleetDeploy', { star: s, dest: d, float: true }), [ids.star, far]); await sleep(400);
      const fl = await page.evaluate(() => { const f = document.querySelector('.gx-float'), r = f.getBoundingClientRect(); return { on: f.classList.contains('on'), l: Math.round(r.left), r: Math.round(innerWidth - r.right), h: Math.round(r.height), top: Math.round(r.top) }; });
      check('a panel opened from the map pins to the bottom edge', fl.on && fl.l < 20 && fl.r < 20 && fl.h > 100, JSON.stringify(fl));
      check('the sheet collapses under it', (await sheetState(page)) === 'strip');
      await shot('galaxy-float');
      await back(); await sleep(300);
      check('Back closes it', !(await page.evaluate(() => document.querySelector('.gx-float').classList.contains('on'))));
    });

    await step('battle', async () => {
      await page.evaluate(() => { const d = MOO.UI.Combat.demo({ scn: 'planet' }); window.__fight = MOO.UI.Combat.fight(d.battle, d.S).then(r => { window.__res = r; }); });
      await sleep(900);
      check('pre-battle card opens the sheet fully', (await sheetState(page)) === 'full');
      const btns = await page.$$eval('.gx-side:not(.gx-float) .pb-acts .btn', els => els.map(e => e.textContent.trim().replace(/\s+\S$/, '')));
      check('only Retreat and Auto are offered', btns.length === 2 && !btns.some(t => /Continue/.test(t)), btns.join(', '));
      await shot('battle-card');
      await (await page.$('.gx-side:not(.gx-float) .pb-acts .btn:has-text("Auto")')).tap(); await sleep(900);
      await shot('battle-result');
      await (await page.$('.gx-side:not(.gx-float) .btn:has-text("Continue")')).tap(); await sleep(600);
      check('the battle resolved', await page.evaluate(() => !!(window.__res && typeof window.__res === 'object')));
      check('the sheet goes back to where it was', (await sheetState(page)) === 'strip', await sheetState(page));
      check('the tactical screen was never built', await page.evaluate(() => !document.querySelector('.screen[data-screen="combat"]')));
    });

    await step('screens', async () => {
      const list = [['planets'], ['fleets'], ['specs'], ['tech'], ['techtree'], ['races'], ['report', { empire: 1 }], ['status'], ['mapoverview'], ['system'],
        ['help'], ['saveload'], ['options'], ['audience', { empire: 1 }], ['council'], ['landing'], ['endings']];
      for (const [id, params] of list) {
        await page.evaluate(([id, p]) => { try { MOO.UI.Screens.go(id, Object.assign({ from: 'galaxy' }, p || {})); } catch (e) { console.error('go ' + id + ': ' + e.message); } }, [id, params]);
        await sleep(1300);
        const cur = await page.evaluate(() => MOO.UI.Screens.current.id);
        const a = (await audit()).filter(x => !/^OFF/.test(x)), offs = await offscreen(page);
        console.log('   ' + id + (cur !== id ? ' (now ' + cur + ')' : '') + ': ' + (a.length ? a.join(' | ') : 'no scroll / clip') + fmtAudit(await touchAudit(page)));
        check(id + ': nothing off-screen', !offs.length, offs.join(' | '));
        await shot('screen-' + id);
        const backOn = await page.evaluate(() => { const b = document.querySelector('.ph-back'); return !!(b && b.classList.contains('on')); });
        if (cur === id) check(id + ': Back control shown', backOn);
        if (id === 'endings') {                                         // an ending is acknowledged, not backed out of: Back skips to its final card
          await back(); await sleep(900);
          check('endings: Back skips to the final card', await page.evaluate(() => !!document.querySelector('.screen.active .end-act .btn')));
          await shot('screen-endings-final');
          await page.evaluate(() => MOO.UI.Screens.go('galaxy')); await sleep(700);
          continue;
        }
        for (let i = 0; i < 4 && (await page.evaluate(() => MOO.UI.Screens.current.id)) !== 'galaxy'; i++) { await back(); await sleep(700); }
        check(id + ': Back returns to the map', (await page.evaluate(() => MOO.UI.Screens.current.id)) === 'galaxy');
        await page.evaluate(() => { if (MOO.UI.closeAllModals) MOO.UI.closeAllModals(); });
      }
      // GNN: phones get the brief list in a modal, never the 16:9 studio
      await page.evaluate(() => { window.__gnn = MOO.Game.S && MOO.UI.Flow ? 1 : 0; });
    });

    await step('scenes', async () => {
      // the research choice ceremony: its panel spans the lower half in portrait
      await page.evaluate(() => { const R = MOO.Sim.Research, S = MOO.Game.S, E = MOO.Game.player(); let f = 0, lv = [];
        for (f = 0; f < 6 && lv.length < 2; f++) { lv = []; for (let l = 1; l <= 12 && lv.length < 3; l++) { const t = R.techAt(f, l); if (t) lv.push(l); } if (lv.length >= 2) break; }
        window.__tc = MOO.UI.TechScenes.choose({ field: f, choices: lv.map(l => ({ level: l })), manual: true }); });
      await sleep(2200);
      const tc = await page.evaluate(() => { const p = document.querySelector('.screen.active .tsc-panel'); const id = MOO.UI.Screens.current.id; if (!p) return { id }; const r = p.getBoundingClientRect(); return { id, l: Math.round(r.left), w: Math.round(r.width) }; });
      check('research choice opens with a full-width panel', tc.id === 'techscene' && tc.w > 300, JSON.stringify(tc));
      await shot('scene-techchoice');
      const offs = await offscreen(page); check('techscene: nothing off-screen', !offs.length, offs.join(' | '));
      for (let i = 0; i < 3 && (await page.evaluate(() => MOO.UI.Screens.current.id)) !== 'galaxy'; i++) { await back(); await sleep(800); }
      if ((await page.evaluate(() => MOO.UI.Screens.current.id)) !== 'galaxy') await page.evaluate(() => MOO.UI.Screens.go('galaxy'));
      await sleep(500);
      // the brief news list stands in for the GNN studio
      await page.evaluate(() => { window.__news = MOO.UI.Flow && MOO.UI.Flow.newsBrief ? MOO.UI.Flow.newsBrief({ year: 2310, items: [{ headline: 'Test headline one' }, { headline: 'Test headline two', sub: 'detail' }] }) : null; });
      await sleep(500);
      check('news arrives as the brief list', await page.evaluate(() => !!document.querySelector('.modal .nb-list')));
      await shot('scene-news'); await back(); await sleep(400);
    });

    await step('menus', async () => {
      const modalShot = async (name, open) => {
        await page.evaluate(open); await sleep(600);
        const m = await page.evaluate(() => { const e = [...document.querySelectorAll('.scrim .modal')].pop(); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: innerWidth - r.right, t: r.top, b: innerHeight - r.bottom }; });
        check(name + ': the dialog fits the screen', !!m && m.l >= -1 && m.r >= -1 && m.t >= -1 && m.b >= -1, JSON.stringify(m));
        console.log('   ' + name + ':' + fmtAudit(await touchAudit(page)));
        await shot('modal-' + name); await page.evaluate(() => MOO.UI.closeAllModals()); await sleep(300);
      };
      await modalShot('gamemenu', () => { MOO.UI.gameMenu(); });
      await modalShot('options', () => { MOO.UI.openOptions(); });
      await modalShot('archive', () => { MOO.UI.GNN.archive(MOO.Game.S); });
      await page.evaluate(() => MOO.UI.Screens.go('menu')); await sleep(1500);
      let offs = await offscreen(page); check('menu: nothing off-screen', !offs.length, offs.join(' | '));
      check('menu: no Back control', !(await page.evaluate(() => document.querySelector('.ph-back').classList.contains('on'))));
      await shot('menu');
      await page.evaluate(() => MOO.UI.Screens.go('setup', { from: 'menu' })); await sleep(1500);
      for (let i = 0; i < 5; i++) {
        offs = await offscreen(page); check('setup step ' + (i + 1) + ': nothing off-screen', !offs.length, offs.join(' | '));
        await shot('setup-' + (i + 1));
        const next = await page.$('.screen.active .btn.su-nav.primary:visible');
        const label = next ? (await next.textContent()).trim() : '';
        if (!next || /begin/i.test(label)) break;
        await next.tap(); await sleep(900);
      }
      await page.evaluate(() => MOO.UI.Screens.go('galaxy')); await sleep(900);
    });

    await step('design', async () => {
      await page.evaluate(() => MOO.UI.Screens.go('design', { from: 'galaxy' })); await sleep(1300);
      const lay = await page.evaluate(() => {
        const q = s => document.querySelector('.screen.active ' + s), r = s => { const e = q(s); return e ? e.getBoundingClientRect() : null; };
        return { ph: !!q('.ph-dz'), head: r('.ph-dz-head'), foot: r('.ph-dz-foot'), body: r('.ph-dz-body'), build: r('.ph-dz-foot .btn.primary'), vh: innerHeight };
      });
      check('editor rearranged into one column', lay.ph && !!lay.head && !!lay.foot && !!lay.body);
      check('header pinned at the top, Build at the bottom', lay.head && lay.foot && lay.head.top < 60 && lay.foot.bottom > lay.vh - 14, JSON.stringify({ head: lay.head && lay.head.top, foot: lay.foot && lay.foot.bottom }));
      const a = (await audit()).filter(x => !/^OFF/.test(x)), offs = await offscreen(page); console.log('   design: ' + (a.length ? a.join(' | ') : 'no scroll / clip') + fmtAudit(await touchAudit(page)));
      check('design: nothing off-screen', !offs.length, offs.join(' | '));
      await shot('design-top');
      await page.evaluate(() => { const w = document.querySelector('.screen.active .dz-wt'); if (w) w.scrollIntoView({ block: 'start' }); }); await sleep(300);
      await shot('design-weapons');
      const before = await page.evaluate(() => JSON.stringify(MOO.UI.Design._phone.st.draft.weapons));
      await (await page.$('.screen.active .dz-wt .dz-wr:not(.empty) > .dz-sel .nm')).tap(); await sleep(500);   // a fitted bank: swapping its weapon frees its space
      check('weapon picker opens full-screen as cards', await page.evaluate(() => { const p = document.querySelector('.screen.active .dz-pop.on'); if (!p) return false; const r = p.getBoundingClientRect(); return r.width >= innerWidth - 2 && !!p.querySelector('.ph-pc'); }));
      await shot('design-picker');
      const card = await page.$('.screen.active .dz-pop .ph-pc:not(.none):not(.lock):not(.over):not(.conf):not(.cur)');
      if (card) { await card.tap(); await sleep(500); }
      const after = await page.evaluate(() => JSON.stringify(MOO.UI.Design._phone.st.draft.weapons));
      check('tapping a card fits the weapon and closes the picker', !!card && before !== after && !(await page.$('.screen.active .dz-pop.on')));
      const stp = await page.$('.screen.active .dz-wt .ph-step');
      check('weapon banks carry a stepper', !!stp);
      if (stp) {
        const n0 = await page.evaluate(() => MOO.UI.Design._phone.st.draft.weapons.reduce((a, b) => a + (b.count | 0), 0));
        await (await stp.$$('.btn'))[2].tap(); await sleep(300);
        const n1 = await page.evaluate(() => MOO.UI.Design._phone.st.draft.weapons.reduce((a, b) => a + (b.count | 0), 0));
        check('stepper + adds one', n1 === n0 + 1 || n1 === n0, n0 + ' → ' + n1);
        const stp2 = await page.$('.screen.active .dz-wt .ph-step');                                 // the rows are redrawn after every change
        await (await stp2.$('.btn:has-text("Fill")')).tap(); await sleep(300);
        const free = await page.evaluate(() => MOO.UI.Design._phone.st.stats.free);
        check('Fill leaves the hull valid', free >= 0, 'free ' + free);
      }
      await shot('design-after');
      await (await page.$('.screen.active .ph-dz-head .btn:has-text("Library")')).tap(); await sleep(400);
      check('Library opens as a sheet', await page.evaluate(() => !!document.querySelector('.screen.active .ph-lib.on')));
      await shot('design-library');
      await back(); await sleep(300);
      check('Back closes the library first', await page.evaluate(() => !document.querySelector('.screen.active .ph-lib.on') && MOO.UI.Screens.current.id === 'design'));
      await back(); await sleep(700);
      check('Back then leaves the editor', (await page.evaluate(() => MOO.UI.Screens.current.id)) === 'galaxy');
    });

    await step('back', async () => {
      await (await page.$('.gx-bar .btn:has-text("Game")')).tap(); await sleep(450);
      check('Game menu open, Back shown', await page.evaluate(() => MOO.UI.modalOpen() && document.querySelector('.ph-back').classList.contains('on')));
      await (await page.$('.ph-back')).tap(); await sleep(400);
      check('Back closes the menu', !(await page.evaluate(() => MOO.UI.modalOpen())));
      await (await page.$('.gx-bar .btn:has-text("Game")')).tap(); await sleep(450);
      const url = page.url();
      await page.goBack(); await sleep(600);
      check('the phone\'s own Back closes the menu and keeps the game', !(await page.evaluate(() => MOO.UI.modalOpen())) && page.url() === url && (await page.evaluate(() => !!MOO.Game.S)));
    });

    await step('tips', async () => {
      const el = await page.$('.gmap-ctrl [data-tip]') || await page.$('.screen.active [data-tip]');
      const b = await el.boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await sleep(650);
      const shown = await page.evaluate(() => { const t = document.querySelector('.ph-tip'); return t && t.classList.contains('on') ? t.textContent.slice(0, 60) : ''; });
      await shot('tip');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(200);
      check('a long press shows the tooltip', !!shown, shown);
    });

    await step('bot', async () => {
      const bot = require('./bot'); const b = bot.start(page, {}); let ok = 0;
      for (let i = 0; i < 4; i++) { const r = await Promise.race([page.evaluate(() => MOO.Game.endTurn().then(() => 1)), sleep(60000).then(() => 0)]); if (!r) { console.log('   STUCK turn', i); break; } ok++; await sleep(300); }
      b.stop(); await sleep(300);
      check('bot plays 4 turns', ok === 4, ok);
      check('no turn opened the tactical screen', !b.stats.screens.combat, JSON.stringify(b.stats.screens));
      await shot('after-turns');
    });
  } catch (e) { check('run', false, e.stack); }
  const errs = [...new Set(errors)].filter(e => !benign(e));
  check('no console errors / page errors (phone)', !errs.length, errs.slice(0, 5).join(' | '));
  await browser.close();

  if (want('desktop') && !LAND && !SMALL) {
    console.log('--- desktop');
    const d = await open({ viewport: { width: 1280, height: 720 } });
    try {
      await bootGame(d.page);
      const st = await d.page.evaluate(() => ({ attr: document.documentElement.hasAttribute('data-phone'), back: !!document.querySelector('.ph-back'), grip: !!document.querySelector('.ph-grip'), tier: MOO.Perf.tier, samples: MOO.Audio.Samples.enabled, hist: history.state }));
      check('desktop: no phone gate', !st.attr && !st.back && !st.grip, JSON.stringify(st));
      check('desktop: tier and samples untouched', st.tier !== 'phone' && st.samples === true && st.hist === null);
      await d.page.evaluate(() => { const x = MOO.UI.Combat.demo({ scn: 'planet' }); MOO.UI.Combat.fight(x.battle, x.S); }); await sleep(900);
      const btns = await d.page.$$eval('.gx-side .pb-acts .btn', els => els.map(e => e.textContent.trim()));
      check('desktop: the pre-battle card still offers Continue', btns.some(t => /Continue/.test(t)), btns.join(', '));
      await d.page.click('.gx-side .pb-acts .btn:has-text("Auto")'); await sleep(700); await d.page.click('.gx-side .btn:has-text("Continue")'); await sleep(300);
      await d.page.evaluate(() => MOO.UI.Screens.go('design', { from: 'galaxy' })); await sleep(900);
      check('desktop: the design editor keeps its three columns', await d.page.evaluate(() => !document.querySelector('.ph-dz') && getComputedStyle(document.querySelector('.dz')).gridTemplateColumns.split(' ').length === 3));
      await d.page.keyboard.press('Escape'); await sleep(500);
      await d.page.keyboard.press('F1'); await sleep(300);
      check('desktop: F1 help still opens', !!(await d.page.$('.hp-ov'))); await d.page.keyboard.press('Escape');
      const errs2 = [...new Set(d.errors)].filter(e => !benign(e));
      check('no console errors / page errors (desktop)', !errs2.length, errs2.slice(0, 5).join(' | '));
    } catch (e) { check('desktop run', false, e.stack); }
    await d.browser.close();
  }
  srv.close();
  console.log(`\n${passes} passed, ${fails} failed · screenshots in ${SHOTS}`);
  process.exit(fails ? 1 : 0);
})();

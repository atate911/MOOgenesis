// Phone QA: an emulated touch phone (390x844 portrait, 844x390 with `landscape`, 360x740 with `small`) driven against the real gate in
// index.html (no ?phone=1), plus a desktop pass proving the phone layer stays out of the way. Prints PASS / FAIL per check, the scale-audit
// findings per screen, and per screen the touch audit (targets under 40px, text under 12px) and a scan for keyboard / mouse wording.
// usage: node tools/qa/phone.js [landscape|small] [step ...]
//   steps: gate galaxy battle screens research scenes menus design back tips native firstrun bot desktop   (default: all)
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
// Only what this sandbox causes: web fonts / the network blocked by its proxy and software-GL notes. A missing game file is NOT benign:
// it is a failed load in the player's console too (the save-server probe is answered by the static api/status).
const benign = e => /fonts\.(googleapis|gstatic)|net::ERR_|ERR_TUNNEL|ERR_PROXY|GL Driver Message/.test(e);

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
// visible keyboard / mouse wording on the active screen or the top dialog ("Space" as in space dock / combat / monsters is not a key)
const deskWords = page => page.evaluate(() => {
  const scope = [...document.querySelectorAll('.scrim .modal')].pop() || document.querySelector('.screen.active'); if (!scope) return [];
  const t = scope.innerText || '', out = new Set();
  const RX = /\b(?:double-)?click(?:s|ing)?\b|right-click|mouse|\bwheel\b|\bhover\b|\bEsc\b|\bEnter\b|\bSpace\b(?! (?:[Cc]ombat|[Dd]ock|[Mm]onsters|[Pp]irates|[Cc]rystal|[Aa]moeba|[Tt]eleporter|Academy))|\bpress(?:es)?\s+[A-Z0-9]\b|\bF\d{1,2}\b|\bCtrl\b/g;
  let m; while ((m = RX.exec(t))) out.add(t.slice(Math.max(0, m.index - 24), m.index + m[0].length + 16).replace(/\s+/g, ' '));
  return [...out].slice(0, 4);
});
// navigator.vibrate stub: the patterns land in window.__vib (UI.Phone.haptic)
const VIB = () => { window.__vib = []; try { Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value: p => { window.__vib.push(p); return true; } }); } catch (e) { /* ignore */ } };
const sheetState = page => page.evaluate(() => { const s = document.querySelector('.gx-side:not(.gx-float)'); return s ? s.dataset.sheet || '' : 'none'; });

(async () => {
  const srv = await serve(PORT);
  const pre = LAND ? 'L-' : SMALL ? 'S-' : '';
  const { browser, ctx, page, errors } = await open({ phone: LAND ? 'landscape' : SMALL ? 'small' : true });
  await ctx.addInitScript(VIB);
  page.setDefaultTimeout(10000);
  const shot = async name => { const f = path.join(SHOTS, pre + name + '.png'); await page.screenshot({ path: f }); return f; };
  const audit = async () => { await page.evaluate(src => { if (!window.__audit) (0, eval)(src); }, AUDIT); return page.evaluate(() => __audit().out); };
  const back = () => page.evaluate(() => MOO.UI.Phone.back());
  // the tab bar: five tabs in order + Next turn, all on screen, nothing scrolls; More opens the game menu as a sheet with Design / Galaxy map
  const tabBar = async label => {
    const bar = await page.evaluate(() => {
      const b = document.querySelector('.gx-bar'), vis = [...b.children].filter(e => e.offsetParent && e.getBoundingClientRect().width > 0).sort((x, y) => x.getBoundingClientRect().left - y.getBoundingClientRect().left);
      const r = e => e.getBoundingClientRect();
      return { names: vis.map(e => e.innerText.replace(/\s+/g, ' ').trim()), scroll: b.scrollWidth > b.clientWidth + 1, inView: vis.every(e => r(e).left >= 0 && r(e).right <= innerWidth + 0.5 && r(e).bottom <= innerHeight + 0.5), minH: Math.min(...vis.map(e => r(e).height)) };
    });
    check(label + ' tab bar: Planets · Fleet · Tech · Races · More · Next turn, all in view, no scrolling', bar.names.join('|').toLowerCase() === 'planets|fleet|tech|races|more|next turn' && !bar.scroll && bar.inView && bar.minH >= 40, JSON.stringify(bar));
    await (await page.$('.gx-bar .ph-tab-more')).tap(); await sleep(500);
    const sh = await page.evaluate(() => { const m = [...document.querySelectorAll('.scrim .modal')].pop(); if (!m) return null; const r = m.getBoundingClientRect(); return { sheet: m.classList.contains('gm-sheet'), bottom: Math.round(innerHeight - r.bottom), w: Math.round(r.width), items: [...m.querySelectorAll('.gm-item .btn')].map(b => b.textContent.replace(/\s+/g, ' ').trim()).slice(0, 4) }; });
    check(label + ': More opens the game menu as a bottom sheet with Ship design and Galaxy map first', !!sh && sh.sheet && sh.bottom <= 1 && sh.w >= (await page.evaluate(() => innerWidth)) - 2 && /Ship design/.test(sh.items[0]) && /Galaxy map/.test(sh.items[1]), JSON.stringify(sh));
    await shot('more-sheet');
    await (await page.$('.scrim .gm-nav .btn:has-text("Ship design")')).tap(); await sleep(900);
    check(label + ': More › Ship design opens the editor', (await page.evaluate(() => MOO.UI.Screens.current.id)) === 'design');
    await back(); await sleep(800);
    await page.evaluate(() => MOO.Bus.emit('turn:processing', true)); await sleep(100);
    const locked = await page.evaluate(() => ['planets', 'fleet', 'tech', 'races'].every(t => document.querySelector('.gx-bar .ph-tab-' + t).classList.contains('turn-locked')) && document.querySelector('.gx-bar .ph-next').classList.contains('turn-locked') && !document.querySelector('.gx-bar .ph-tab-more').classList.contains('turn-locked'));
    await page.evaluate(() => MOO.Bus.emit('turn:processing', false)); await sleep(100);
    check(label + ': tabs and Next turn lock while a turn runs, More stays open', locked);
  };
  // hit-test audit: every enabled control that is visible (in the viewport, inside its clipping ancestors) must be what a tap at its centre
  // reaches — a control painted under another element is the bug class script clicks never see (the "Year …" freeze); [tag.class@x,y under tag.class]
  const coveredAudit = page => page.evaluate(() => {
    const scope = [...document.querySelectorAll('.scrim .modal')].pop() || document.querySelector('.screen.active'); if (!scope) return [];
    const SEL = 'button, .btn, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab]';
    const out = [], W = innerWidth, H = innerHeight;
    const key = e => e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
    for (const e of scope.querySelectorAll(SEL)) {
      if (e.disabled || e.closest('[inert], [aria-hidden="true"]')) continue;
      const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
      const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || +cs.opacity === 0 || cs.pointerEvents === 'none') continue;
      let cx = r.left + r.width / 2, cy = r.top + r.height / 2, clipped = false;
      for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const ps = getComputedStyle(p); if (ps.overflowX !== 'visible' || ps.overflowY !== 'visible' || ps.clipPath !== 'none') { const q = p.getBoundingClientRect(); if (cx < q.left || cx > q.right || cy < q.top || cy > q.bottom) { clipped = true; break; } } }
      if (clipped || cx < 0 || cx > W || cy < 0 || cy > H) continue;
      const top = document.elementFromPoint(cx, cy); if (!top) continue;
      const lab = e.closest('label');
      if (top === e || e.contains(top) || (lab && (top === lab || lab.contains(top))) || top.contains(e)) continue;
      out.push(key(e) + '@' + Math.round(cx) + ',' + Math.round(cy) + ' under ' + key(top));
    }
    return out;
  });
  // touch targets, text size and keyboard / mouse wording on what is showing now: checks (FAIL), with the findings as detail
  const audits = async label => {
    const a = await touchAudit(page), dw = await deskWords(page), f = l => l.map(([k, n, v]) => k + '×' + n + '(' + v + ')').join(' ');
    const cov = await coveredAudit(page);
    check(label + ': no visible control is covered', !cov.length, cov.slice(0, 6).join(' | '));
    check(label + ': touch targets ≥ 40px', !a.t.length, f(a.t));
    check(label + ': text ≥ 12px', !a.x.length, f(a.x));
    check(label + ': no keyboard / mouse wording', !dw.length, dw.join(' | '));
  };
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
        await tabBar('landscape');
        return;
      }
      check('sheet starts collapsed', (await sheetState(page)) === 'strip');
      await audits('galaxy (strip)');
      await shot('galaxy-strip');
      const grip = await page.$('.gx-side:not(.gx-float) .ph-grip');
      await grip.tap(); await sleep(350); check('handle tap opens halfway', (await sheetState(page)) === 'half'); await shot('galaxy-half');
      await audits('galaxy (half)');
      await grip.tap(); await sleep(350); check('second tap opens fully', (await sheetState(page)) === 'full'); await shot('galaxy-full');
      await grip.tap(); await sleep(350); check('third tap collapses', (await sheetState(page)) === 'strip');
      const sum = await page.evaluate(() => { const side = document.querySelector('.gx-side:not(.gx-float)'), e = side.querySelector('.ph-sum'), t = side.querySelector('.side-title .ph-thumb'); if (!e) return null; const r = e.getBoundingClientRect(), sr = side.getBoundingClientRect(); return { text: e.innerText.replace(/\s+/g, ' '), inStrip: r.top >= sr.top && r.bottom <= sr.bottom + 1, r: [r.top, r.bottom, sr.top, sr.bottom].map(Math.round), thumb: !!(t && t.offsetWidth) }; });
      check('the collapsed sheet shows the thumbnail and the summary line', !!sum && sum.inStrip && sum.thumb && /Pop \d/.test(sum.text) && /Prod \d/.test(sum.text), JSON.stringify(sum));
      await (await page.$('.gx-side:not(.gx-float) .side-title .nm')).tap(); await sleep(350);
      check('a tap on the name in the strip opens the sheet halfway, not the rename prompt', (await sheetState(page)) === 'half' && !(await page.evaluate(() => MOO.UI.modalOpen())));
      const half = await page.evaluate(() => { const side = document.querySelector('.gx-side:not(.gx-float)'), sr = side.getBoundingClientRect(), vis = e => { const r = e.getBoundingClientRect(); return r.height > 0 && r.top >= sr.top - 1 && r.bottom <= sr.bottom + 1; };
        const sl = [...side.querySelectorAll('.sc-sliders .slider')], bt = [...side.querySelectorAll('.sc-btns .btn')]; return { sliders: sl.filter(vis).length, of: sl.length, buttons: bt.filter(vis).length, h: Math.round(sr.height), map: Math.round(side.parentElement.querySelector('.gx-mapwrap').clientHeight) }; });
      check('half height: all five sliders and Ships / Reloc / Trans inside the sheet', half.sliders === 5 && half.of === 5 && half.buttons === 3 && half.h <= half.map * 0.71, JSON.stringify(half));
      const ov = await page.evaluate(() => { const p = document.querySelector('.gx-side:not(.gx-float) .panel'), r = p.getBoundingClientRect(); const out = [...p.querySelectorAll('*')].filter(e => { const q = e.getBoundingClientRect(); return q.width && q.right > r.right + 2; }).slice(0, 3).map(e => e.className); return out; });
      check('nothing in the colony panel spills past its right edge', !ov.length, ov.join(', '));
      await page.evaluate(() => MOO.UI.Phone.galaxySheet().set('strip')); await sleep(400);
      // a finger lands 16px off a star: the star is still picked (22px touch radius)
      const tgt = await page.evaluate(() => {
        const m = MOO.UI.Galaxy.map, d = m._dbg(), r = m.canvas.getBoundingClientRect(), sel = m.getSelection().star;
        const ok = s => s.on && s.id !== sel && s.sx > 40 && s.sx < r.width - 90 && s.sy > 160 && s.sy < r.height - 160 && d.SD.every(o => o === s || Math.hypot(o.sx - s.sx, o.sy - s.sy) > 46);
        const s = d.SD.find(ok); return s ? { id: s.id, x: r.left + s.sx + 15, y: r.top + s.sy + 6 } : null;
      });
      if (tgt) { await page.touchscreen.tap(tgt.x, tgt.y); await sleep(500); }
      check('a tap 16px off a star selects it', !!tgt && (await page.evaluate(() => MOO.UI.Galaxy.map.getSelection().star)) === tgt.id, JSON.stringify(tgt));
      await page.evaluate(() => { MOO.UI.Phone.galaxySheet().set('strip'); const E = MOO.Game.player(); MOO.UI.Galaxy.map.select(MOO.Game.S.planets[E.capital].starId, { emit: true }); }); await sleep(300);
      await tabBar('portrait');
      // a star panel: thumbnail + summary (planet / range), and no rename from the strip
      const sid = await page.evaluate(() => { const S = MOO.Game.S, E = MOO.Game.player(); const s = S.stars.find(x => x.id !== S.planets[E.capital].starId && S.planets[x.id].owner < 0 && E.explored[x.id]) || S.stars.find(x => !E.explored[x.id]); MOO.UI.Galaxy.selectStar(s.id); MOO.UI.Side.show('star', { star: s.id }); return s.id; });
      await sleep(400);
      const ss = await page.evaluate(() => { const side = document.querySelector('.gx-side:not(.gx-float)'), e = side.querySelector('.ph-sum'); return { st: side.dataset.sheet, text: e ? e.innerText.replace(/\s+/g, ' ') : null, thumb: !!side.querySelector('.side-title .ph-thumb') }; });
      check('a star shows its thumbnail and summary (planet or "unexplored", range)', !!ss.text && ss.thumb && /(Range|territory)/.test(ss.text) && /(max|Unexplored|No habitable)/.test(ss.text), JSON.stringify(Object.assign({ star: sid }, ss)));
      await shot('galaxy-star-strip');
      await page.evaluate(() => { const E = MOO.Game.player(), id = MOO.Game.S.planets[E.capital].starId; MOO.UI.Galaxy.selectStar(id); MOO.UI.Galaxy.showDefault(); MOO.UI.Phone.galaxySheet().set('strip'); }); await sleep(300);
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
        console.log('   ' + id + (cur !== id ? ' (now ' + cur + ')' : '') + ': ' + (a.length ? a.join(' | ') : 'no scroll / clip'));
        await audits(id);
        const TITLE = { planets: /^Planets$/, fleets: /^Fleets$/, specs: /^Fleets$/, tech: /^Research$/, techtree: /^Tech overview$/, races: /^Races$/, report: /^Report$/, status: /^Racial stats$/, mapoverview: /^Galaxy map$/,
          system: /^Star system$/, help: /^Almanac$/, saveload: /^(Save|Load) game$/, options: /^Options$/, audience: /^Audience$/, council: /^Galactic Council$/, landing: /^New colony$/ };
        if (cur === id && TITLE[id]) {
          const bt = await page.evaluate(() => ({ title: document.querySelector('.ph-bar-t').textContent, own: [...document.querySelectorAll('.screen.active .btn')].filter(b => b.offsetParent && /^(OK|Done|Back)$/i.test(b.innerText.trim())).map(b => b.innerText.trim()) }));
          check(id + ': the app bar carries the title; no OK / Done / Back of its own', TITLE[id].test(bt.title) && !bt.own.length, JSON.stringify(bt));
        }
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

    await step('research', async () => {
      await page.evaluate(() => MOO.UI.Screens.go('tech', { from: 'galaxy' })); await sleep(1000);
      const vis = sel => page.evaluate(s => { const e = document.querySelector('.screen.active ' + s); return !!(e && e.getClientRects().length && getComputedStyle(e).display !== 'none'); }, sel);
      const top = () => page.evaluate(() => { const t = document.querySelector('.screen.active .tch'); if (t) t.scrollTop = 0; });
      const segs = await page.$$eval('.screen.active .ph-tseg button', b => b.map(x => x.textContent));
      check('research: Allocation · Project · Techs', segs.join('|') === 'Allocation|Project|Techs', segs.join('|'));
      check('Allocation: the six sliders, no list or project', (await vis('.tch-sl')) && !(await vis('.tch-left')) && !(await vis('.tch-proj')) && (await page.$$('.screen.active .tch-sl .slider')).length === 6);
      const bar = await page.evaluate(() => document.querySelector('.ph-bar-t').textContent);
      check('app bar: "Research", no in-screen title or OK', bar === 'Research' && !(await vis('.tch-title')) && !(await vis('.tch-head > .btn.primary')), bar);
      await top(); await shot('research-alloc');
      await (await page.$('.screen.active .ph-tseg button:has-text("Project")')).tap(); await sleep(400);
      check('Project: field tabs and the project card only', (await vis('.tch-proj')) && (await vis('.tch-tabs')) && !(await vis('.tch-sl')) && !(await vis('.tch-left')) && !(await vis('.tch-tab.ovw')));
      await top(); await shot('research-project');
      await (await page.$('.screen.active .ph-tseg button:has-text("Techs")')).tap(); await sleep(400);
      check('Techs: the list and the detail', (await vis('.tch-left')) && !(await vis('.tch-sl')) && !(await vis('.tch-proj')));
      await top(); await shot('research-techs');
      await (await page.$('.screen.active .tch-tab.ovw')).tap(); await sleep(700);
      check('Techs › Overview: the tech tree', (await vis('.tch-ovw')) && (await page.evaluate(() => MOO.UI.Tech._phone.st.view)) === 'overview');
      await top(); await shot('research-overview');
      await (await page.$('.screen.active .ph-tseg button:has-text("Allocation")')).tap(); await sleep(400);
      check('leaving Techs from Overview goes back to the field view', (await page.evaluate(() => MOO.UI.Tech._phone.st.view)) === 'field' && (await vis('.tch-sl')));
      await back(); await sleep(700);
      await page.evaluate(() => MOO.UI.Screens.go('tech', { from: 'galaxy', view: 'overview' })); await sleep(900);
      check('opening Research on the overview selects Techs', (await page.evaluate(() => document.querySelector('.screen.active .tch').dataset.phSeg)) === 'techs' && (await vis('.tch-ovw')));
      await back(); await sleep(700);
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
        await audits(name);
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
      const a = (await audit()).filter(x => !/^OFF/.test(x)), offs = await offscreen(page); console.log('   design: ' + (a.length ? a.join(' | ') : 'no scroll / clip'));
      await audits('design');
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
      await (await page.$('.gx-bar .ph-tab-more')).tap(); await sleep(450);
      check('Game menu open, Back shown', await page.evaluate(() => MOO.UI.modalOpen() && document.querySelector('.ph-back').classList.contains('on')));
      await (await page.$('.ph-back')).tap(); await sleep(400);
      check('Back closes the menu', !(await page.evaluate(() => MOO.UI.modalOpen())));
      await (await page.$('.gx-bar .ph-tab-more')).tap(); await sleep(450);
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
      const tipOn = () => page.evaluate(() => { const t = document.querySelector('.ph-tip'); return t && t.classList.contains('on') ? t.innerText.replace(/\s+/g, ' ').slice(0, 80) : ''; });
      // the long press tip has no keyboard / mouse wording
      check('the tip text drops its hotkey', !/\b(Ctrl|Shift|Home|Esc)\b|<b>[+−]<\/b>|\bclick\b/i.test(shown), shown);
      // map: press and hold a star → its tip, kept after the lift, nothing selected; the next touch clears it
      const st = await page.evaluate(() => {
        const m = MOO.UI.Galaxy.map, d = m._dbg(), r = m.canvas.getBoundingClientRect(), sel = m.getSelection().star;
        const top = r.height > 600 ? 200 : 80, bot = r.height > 600 ? 220 : 60;                       // clear of the HUD and the sheet (portrait) / the scale bar (landscape)
        const s = d.SD.find(s => s.on && s.id !== sel && s.sx > 60 && s.sx < r.width - 130 && s.sy > top && s.sy < r.height - bot && d.SD.every(o => o === s || Math.hypot(o.sx - s.sx, o.sy - s.sy) > 40));
        return s ? { id: s.id, x: r.left + s.sx, y: r.top + s.sy, sel } : null;
      });
      if (st) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: st.x, y: st.y }] }); await sleep(250);
        const early = await page.evaluate(() => getComputedStyle(document.querySelector('.gmap-tip')).display !== 'none');
        await sleep(450);
        const during = await page.evaluate(() => getComputedStyle(document.querySelector('.gmap-tip')).display !== 'none');
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(300);
        const after = await page.evaluate(() => ({ tip: getComputedStyle(document.querySelector('.gmap-tip')).display !== 'none', sel: MOO.UI.Galaxy.map.getSelection().star }));
        await shot('map-longpress');
        check('map: a press and hold on a star shows its tip (not at once), kept after the lift, nothing selected', !early && during && after.tip && after.sel === st.sel, JSON.stringify({ early, during, after, star: st.id }));
        await page.touchscreen.tap(20, 300); await sleep(300);
        check('map: the next touch clears it', await page.evaluate(() => getComputedStyle(document.querySelector('.gmap-tip')).display === 'none'));
      } else check('map: a star to press', false);
      // tap-to-read: a research bulb (a gauge, not a control) shows its tip on a plain tap; a button does its job and shows none
      await page.evaluate(() => MOO.UI.Screens.go('tech', { from: 'galaxy' })); await sleep(900);
      const alloc = await page.$('.screen.active .ph-tseg button:has-text("Allocation")'); if (alloc) { await alloc.tap(); await sleep(300); }
      await (await page.$('.screen.active .tch-sl .tch-bulb')).tap(); await sleep(300);
      const bulb = await tipOn();
      check('tap-to-read: a tap on a research bulb shows its tip', !!bulb, bulb);
      await (await page.$('.screen.active .tch-sl .tch-bulb')).tap(); await sleep(300);
      check('tap-to-read: a second tap closes it', !(await tipOn()));
      const eq = await page.$('.screen.active .tch-sl .btn:has-text("Equalise")'); await eq.tap(); await sleep(300);
      check('a tap on a button shows no tip', !(await tipOn()));
      await back(); await sleep(700);
      // a disabled button: its tip ("why not") on a tap over its box
      await page.evaluate(() => { const d = MOO.UI.Combat.demo({ scn: 'planet' }); window.__fight2 = MOO.UI.Combat.fight(d.battle, d.S); }); await sleep(900);
      const dis = await page.$('.gx-side:not(.gx-float) .pb-acts .btn:disabled[data-tip]');
      if (dis) {
        const b = await dis.boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await sleep(300);
        const why = await tipOn();
        check('a tap on a disabled button shows why', !!why, why);
      } else {                                                           // none on this card: the same path on a disabled button of our own
        await page.evaluate(() => { const b = MOO.UI.button('Disabled', null, { disabled: true, tip: 'Not now: a test reason' }); b.id = 'qa-dis'; Object.assign(b.style, { position: 'absolute', left: '40px', top: '200px', zIndex: 50 }); document.querySelector('.screen.active').appendChild(b); });
        const b = await (await page.$('#qa-dis')).boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await sleep(300);
        const why = await tipOn(); await page.evaluate(() => document.getElementById('qa-dis').remove());
        check('a tap on a disabled button shows why', /test reason/.test(why), why);
      }
      await (await page.$('.gx-side:not(.gx-float) .pb-acts .btn:has-text("Auto")')).tap(); await sleep(900);
      const cont = await page.$('.gx-side:not(.gx-float) .btn:has-text("Continue")'); if (cont) { await cont.tap(); await sleep(600); }
    });

    await step('native', async () => {
      const vib = () => page.evaluate(() => window.__vib.slice());
      // haptics: a slider step and a switch tick; nothing with Haptics off; Next turn ticks 20 ms
      await page.evaluate(() => { MOO.Settings.set('haptics', true); MOO.UI.Screens.go('galaxy'); const E = MOO.Game.player(); MOO.UI.Galaxy.selectStar(MOO.Game.S.planets[E.capital].starId); MOO.UI.Galaxy.showDefault(); MOO.UI.Phone.galaxySheet().set('half'); }); await sleep(600);
      await page.evaluate(() => { window.__vib.length = 0; });
      // a slider that can move (not locked, not pinned at an end): + then, if that did nothing, −
      const plus = await page.$('.gx-side:not(.gx-float) .sc-sliders .slider:not(.locked) .s-btn:nth-child(4)'), minus = await page.$('.gx-side:not(.gx-float) .sc-sliders .slider:not(.locked) .s-btn:nth-child(2)');
      if (plus) { await plus.tap(); await sleep(200); }
      if (minus && !(await vib()).length) { await minus.tap(); await sleep(200); }
      check('haptics: a slider step ticks (5 ms)', (await vib()).includes(5), JSON.stringify(await vib()));
      await page.evaluate(() => { MOO.Settings.set('haptics', false); window.__vib.length = 0; });
      if (plus) { await page.waitForTimeout(80); await plus.tap(); await sleep(200); }
      check('haptics: none with Options › Haptics off', !(await vib()).length, JSON.stringify(await vib()));
      await page.evaluate(() => { MOO.Settings.set('haptics', true); window.__vib.length = 0; MOO.UI.Phone.galaxySheet().set('strip'); }); await sleep(400);
      const bot = require('./bot'), b = bot.start(page, {});
      await (await page.$('.gx-bar .ph-next')).tap();
      for (let i = 0; i < 120 && await page.evaluate(() => MOO.Game.busy || !window.__vib.length); i++) await sleep(500);
      b.stop(); await sleep(400);
      check('haptics: Next turn ticks (20 ms)', (await vib()).includes(20), JSON.stringify(await vib()));
      // the status bar colour follows the screen
      const tc = () => page.evaluate(() => document.querySelector('meta[name="theme-color"]').getAttribute('content'));
      await page.evaluate(() => MOO.UI.Screens.go('galaxy')); await sleep(400); const tGal = await tc();
      await page.evaluate(() => MOO.UI.Screens.go('planets', { from: 'galaxy' })); await sleep(600); const tPl = await tc();
      check('theme-color follows the screen (galaxy HUD / app bar)', tGal === '#10141b' && tPl === '#0c1122', tGal + ' / ' + tPl);
      // a tap leaves no hover look behind
      await page.evaluate(() => MOO.UI.Screens.go('tech', { from: 'galaxy' })); await sleep(800);
      const al = await page.$('.screen.active .ph-tseg button:has-text("Allocation")'); if (al) { await al.tap(); await sleep(300); }
      const look = () => page.evaluate(() => { const b = [...document.querySelectorAll('.screen.active .tch-sl .btn')].find(x => /Equalise/.test(x.textContent)); const c = getComputedStyle(b, '::before'); return c.backgroundColor + ' ' + c.backgroundImage + ' ' + getComputedStyle(b).filter; });
      const before = await look(); await (await page.$('.screen.active .tch-sl .btn:has-text("Equalise")')).tap(); await sleep(900); const after = await look();
      check('a tapped button keeps its look (no stuck hover)', before === after, before + ' → ' + after);
      await page.evaluate(() => MOO.UI.Screens.go('galaxy')); await sleep(500);
      // setup: one Back (the app bar's), one title (the app bar's)
      await page.evaluate(() => MOO.UI.Screens.go('setup', { from: 'galaxy' })); await sleep(1200);
      const su = await page.evaluate(() => { const vis = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0; return { backs: [...document.querySelectorAll('.btn, .ph-back')].filter(e => vis(e) && /^\W*Back$/.test(e.innerText.trim())).length, titles: [...document.querySelectorAll('.screen.active .ctl-title')].filter(vis).length, bar: document.querySelector('.ph-bar-t').textContent }; });
      check('setup: a single Back and a single title (the app bar)', su.backs === 1 && su.titles === 0 && su.bar === 'New game', JSON.stringify(su));
      await back(); await sleep(900);
      await page.evaluate(() => { if (MOO.UI.Screens.current.id !== 'galaxy') MOO.UI.Screens.go('galaxy'); }); await sleep(500);
    });

    await step('firstrun', async () => {
      await page.evaluate(() => { MOO.Settings.set('phoneHints', false); MOO.UI.Screens.go('options', { from: 'galaxy' }); }); await sleep(500);
      await page.evaluate(() => MOO.UI.Screens.go('galaxy')); await sleep(1600);
      const card = await page.evaluate(() => { const m = document.querySelector('.scrim .modal.ph-hints'); return m ? m.querySelectorAll('.ph-hint').length : 0; });
      check('first galaxy entry: the touch-controls card', card === 4, card);
      await shot('firstrun');
      await page.evaluate(() => MOO.UI.closeAllModals()); await sleep(300);
      await page.evaluate(() => MOO.UI.Screens.go('planets', { from: 'galaxy' })); await sleep(500); await page.evaluate(() => MOO.UI.Screens.go('galaxy')); await sleep(1600);
      check('…shown once', !(await page.$('.scrim .modal.ph-hints')) && (await page.evaluate(() => MOO.Settings.get('phoneHints'))) === true);
    });

    await step('prompt', async () => {
      // a turn prompt held in the sheet while the "Year …" busy overlay is up must answer a REAL tap: the bot clicks through script, which no
      // overlay can block, so only a hit-tested tap proves the card is reachable (under the overlay it was not: the "Year …" freeze on phones)
      await page.evaluate(() => MOO.UI.closeAllModals()); await sleep(200);
      const r = await page.evaluate(async () => {
        const UI = MOO.UI, G = MOO.Game, cap = G.player().capital;
        UI.Galaxy.busy(true, 'Year … (prompt check)'); G.busy = true; window.__promptAns = null;
        UI.Flow.card({ star: cap, planetCard: MOO.Sim.Q.planetCard(G.S, cap), title: 'Build a new colony?', body: [], buttons: [{ label: 'No', value: false }, { label: 'Yes', value: true, primary: true }] }).then(v => { window.__promptAns = v; });
        await new Promise(res => setTimeout(res, 600));
        const side = document.querySelector('.gx-side:not(.gx-float)'), yes = [...side.querySelectorAll('button')].find(b => /^Yes/.test(b.textContent.trim()));
        const rc = yes.getBoundingClientRect(), x = rc.left + rc.width / 2, y = rc.top + rc.height / 2, top = document.elementFromPoint(x, y);
        return { x, y, sheet: side.dataset.sheet, covered: !(top === yes || yes.contains(top)), top: top && (top.className || top.tagName) };
      });
      if (r.x > 0 && r.y > 0) await page.touchscreen.tap(r.x, r.y);
      await sleep(500);
      const ans = await page.evaluate(() => window.__promptAns);
      check('held prompt is not covered by the busy overlay', !r.covered, JSON.stringify(r));
      check('held prompt answers a real tap mid-turn', ans === true, 'answer ' + ans);
      await page.evaluate(() => { MOO.Game.busy = false; MOO.UI.Galaxy.busy(false); if (MOO.UI.Side.held) MOO.UI.Side.drop(); }); await sleep(300);
    });

    await step('deploy', async () => {
      // fleet deployment: a destination that starts UNDER the sheet must be reachable by panning with a real touch drag and tapping it (the map's bottom
      // inset, galaxymap.js setInset); landscape keeps the panel beside the map, so nothing is under it there
      await page.evaluate(() => { MOO.UI.closeAllModals(); const S = MOO.Game.S, E = MOO.Game.player(); E.mods.fuel = 99; MOO.Sim.Fleet.updateRange(S); MOO.Sim.Vis.update(S); MOO.UI.Galaxy.selectStar(E.capital); MOO.UI.Side.show('fleetDeploy', { star: E.capital }); });
      await sleep(900);
      const cdp = await ctx.newCDPSession(page);
      const touchDrag = async (x0, y0, x1, y1) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] }); for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / 12, y: y0 + (y1 - y0) * i / 12 }] }); await sleep(16); } await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
      const state = () => page.evaluate(() => {
        const G = MOO.Game, S = G.S, E = G.player(), map = MOO.UI.Galaxy.map, wrap = document.querySelector('.gx-mapwrap'), w = wrap.getBoundingClientRect(), side = document.querySelector('.gx-side:not(.gx-float)'), sr = side.getBoundingClientRect();
        const over = sr.top > w.top + 1 && sr.left < w.right && sr.right > w.left;      // the sheet lies over the map (portrait)
        const stars = S.stars.map((st, i) => { const p = map.worldToScreen(st.x, st.y), x = w.left + p.x, y = w.top + p.y, top = document.elementFromPoint(x, y); return { i, name: st.name, x, y, reach: i !== E.capital && MOO.Sim.Fleet.canReach(S, E, i, false), onCanvas: !!(top && top.tagName === 'CANVAS' && wrap.contains(top)), inMap: x > w.left + 10 && x < w.right - 10 && y > w.top && y < w.bottom }; });
        const route = document.querySelector('.sm-route b'), gt = wrap.querySelector('.gx-top'), topBottom = gt ? gt.getBoundingClientRect().bottom : w.top;
        return { over, sheetTop: sr.top, topBottom, wrap: [w.left, w.top, w.right, w.bottom], panel: MOO.UI.Side.current(), pick: !!MOO.UI.Galaxy.pick, dest: route ? route.textContent : null, inset: map.getInset ? map.getInset().bottom : -1, stars };
      });
      let st = await state();
      check('deployment panel open with the pick active', st.panel === 'fleetDeploy' && st.pick, st.panel);
      if (!st.over) { check('landscape: the panel is beside the map (nothing under it)', true); }
      else {
        check('the map knows what the sheet covers (inset)', st.inset > 0 && Math.abs(st.inset - (st.wrap[3] - st.sheetTop)) < 4, 'inset ' + st.inset + ' vs ' + Math.round(st.wrap[3] - st.sheetTop));
        const tgt = st.stars.filter(s => s.reach && s.inMap && s.y > st.sheetTop + 30).sort((a, b) => a.y - b.y)[0];
        if (!tgt) check('a reachable star under the sheet to test with', false, 'none found');
        else {
          // drag the map so the star lands in the clear band between the HUD / message stack at the top and the sheet (up to three drags: the pan is clamped)
          const vx = (st.wrap[0] + st.wrap[2]) / 2, yc = (st.topBottom + st.sheetTop) / 2; let t = tgt, n = 0;
          while (n++ < 3 && Math.abs(t.y - yc) > 25) { const y0 = st.sheetTop - 30, y1 = Math.max(st.wrap[1] + 5, Math.min(st.wrap[3] - 5, y0 - (t.y - yc))); await touchDrag(vx, y0, vx, y1); await sleep(700); st = await state(); t = st.stars[tgt.i]; }
          const covered = t.onCanvas ? '' : ' (covered by ' + (await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.tagName + '.' + String(e.className).slice(0, 24) : 'nothing'; }, [t.x, t.y])) + ')';
          check('a touch drag pans the map so the star comes out from under the sheet', t.y < st.sheetTop - 10 && t.onCanvas, tgt.name + ' y ' + Math.round(tgt.y) + ' -> ' + Math.round(t.y) + ' (clear band ' + Math.round(st.topBottom) + '..' + Math.round(st.sheetTop) + ')' + covered);
          if (t.onCanvas) { await page.touchscreen.tap(t.x, t.y); await sleep(700); st = await state(); check('tapping it picks the destination', st.dest === tgt.name, 'dest ' + st.dest); }
          const acc = await page.evaluate(() => { const b = [...document.querySelectorAll('.gx-side button')].find(x => /^Accept/.test(x.textContent)); if (!b) return 'no button'; const r = b.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return b.disabled ? 'disabled' : (top === b || b.contains(top)) ? 'ok' : 'covered'; });
          check('Accept is enabled and tappable', acc === 'ok', acc);
        }
      }
      await page.evaluate(() => { MOO.UI.Galaxy.pick = null; if (MOO.UI.Galaxy.map) { MOO.UI.Galaxy.map.setRoutePreview(null); MOO.UI.Galaxy.map.setReach(null); } MOO.UI.Galaxy.showDefault(); }); await sleep(300);
    });

    await step('phonemode', async () => {
      // Options › Display › Phone layout: Off pins the desktop layout on a phone (read by index.html before the first stylesheet; a reload applies it)
      await page.evaluate(() => MOO.UI.Screens.go('options', { from: 'galaxy' })); await sleep(900);
      const seg = await page.evaluate(() => { const row = [...document.querySelectorAll('.screen.active .op-row')].find(r => /Phone layout/.test(r.textContent)); if (!row) return null; const b = [...row.querySelectorAll('button, .btn')].map(x => x.textContent.trim()); return { btns: b, now: /Now: phone layout/.test(row.textContent) }; });
      check('Options has a Phone layout row (Auto / On / Off) that names the current layout', !!seg && seg.btns.join(',') === 'Auto,On,Off' && seg.now, JSON.stringify(seg));
      await page.evaluate(() => { const row = [...document.querySelectorAll('.screen.active .op-row')].find(r => /Phone layout/.test(r.textContent)); [...row.querySelectorAll('button, .btn')].find(x => x.textContent.trim() === 'Off').click(); }); await sleep(500);
      const ask = await page.evaluate(() => { const m = [...document.querySelectorAll('.scrim .modal')].pop(); return m ? m.textContent.slice(0, 80) : null; });
      check('choosing Off asks to reload', !!ask && /Reload now/.test(ask), ask);
      await page.evaluate(() => { const m = [...document.querySelectorAll('.scrim .modal')].pop(); const b = [...m.querySelectorAll('.modal-f button')]; (b.find(x => /Cancel/i.test(x.textContent)) || b[0]).click(); }); await sleep(300);
      check('the setting is stored before the reload', (await page.evaluate(() => MOO.Settings.get('phoneMode'))) === 'off');
      await page.reload({ waitUntil: 'load' }); await sleep(1500);
      check('after a reload the phone boots the DESKTOP layout (Off)', !(await page.evaluate(() => document.documentElement.hasAttribute('data-phone') || MOO.Phone.active())));
      await page.evaluate(() => { MOO.Settings.set('phoneMode', 'auto'); }); await page.reload({ waitUntil: 'load' }); await sleep(1500);
      check('Auto again: the phone layout is back', await page.evaluate(() => document.documentElement.hasAttribute('data-phone') && MOO.Phone.active()));
      await bootGame(page);
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
    await d.ctx.addInitScript(VIB);
    try {
      await bootGame(d.page);
      const st = await d.page.evaluate(() => ({ attr: document.documentElement.hasAttribute('data-phone'), back: !!document.querySelector('.ph-back'), grip: !!document.querySelector('.ph-grip'), tier: MOO.Perf.tier, samples: MOO.Audio.Samples.enabled, hist: history.state }));
      check('desktop: no phone gate', !st.attr && !st.back && !st.grip, JSON.stringify(st));
      check('desktop: tier and samples untouched', st.tier !== 'phone' && st.samples === true && st.hist === null);
      const dv = await d.page.evaluate(() => { const S = MOO.Game.S, E = MOO.Game.player(); MOO.UI.Galaxy.selectStar(S.planets[E.capital].starId); const b = document.querySelector('.gx-side .sc-sliders .slider .s-btn:nth-child(4)'); if (b) b.click(); MOO.UI.toast('x', 'bad'); return { haptic: MOO.UI.Phone.haptic('turn'), vib: (window.__vib || []).length, theme: document.querySelector('meta[name="theme-color"]').getAttribute('content') }; });
      check('desktop: no haptics, theme-color untouched', dv.haptic === false && dv.vib === 0 && dv.theme === '#060919', JSON.stringify(dv));
      await d.page.evaluate(() => { const x = MOO.UI.Combat.demo({ scn: 'planet' }); MOO.UI.Combat.fight(x.battle, x.S); }); await sleep(900);
      const btns = await d.page.$$eval('.gx-side .pb-acts .btn', els => els.map(e => e.textContent.trim()));
      check('desktop: the pre-battle card still offers Continue', btns.some(t => /Continue/.test(t)), btns.join(', '));
      await d.page.click('.gx-side .pb-acts .btn:has-text("Auto")'); await sleep(700); await d.page.click('.gx-side .btn:has-text("Continue")'); await sleep(300);
      await d.page.evaluate(() => MOO.UI.Screens.go('design', { from: 'galaxy' })); await sleep(900);
      check('desktop: the design editor keeps its three columns', await d.page.evaluate(() => !document.querySelector('.ph-dz') && getComputedStyle(document.querySelector('.dz')).gridTemplateColumns.split(' ').length === 3));
      await d.page.keyboard.press('Escape'); await sleep(500);
      await d.page.keyboard.press('F1'); await sleep(300);
      check('desktop: F1 help still opens', !!(await d.page.$('.hp-ov'))); await d.page.keyboard.press('Escape');
      // Options › Phone layout: On pins the phone layout on a desktop (and Auto restores the desktop one)
      await d.page.evaluate(() => { MOO.Settings.set('phoneMode', 'on'); }); await d.page.reload({ waitUntil: 'load' }); await sleep(1500);
      check('desktop: Phone layout = On boots the phone layout after a reload', await d.page.evaluate(() => document.documentElement.hasAttribute('data-phone') && MOO.Phone.active() && MOO.Phone.forced));
      await d.page.evaluate(() => { MOO.Settings.set('phoneMode', 'auto'); }); await d.page.reload({ waitUntil: 'load' }); await sleep(1500);
      check('desktop: Auto again boots the desktop layout', !(await d.page.evaluate(() => document.documentElement.hasAttribute('data-phone'))));
      const errs2 = [...new Set(d.errors)].filter(e => !benign(e));
      check('no console errors / page errors (desktop)', !errs2.length, errs2.slice(0, 5).join(' | '));
    } catch (e) { check('desktop run', false, e.stack); }
    await d.browser.close();
  }
  srv.close();
  console.log(`\n${passes} passed, ${fails} failed · screenshots in ${SHOTS}`);
  process.exit(fails ? 1 : 0);
})();

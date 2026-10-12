// Composites a rendered portrait into a race card (HTML/CSS -> PNG via Playwright).
//   NODE_PATH=$(npm root -g) node tools/render/race-card.js <portrait.png> <out.png> [raceId=silicoid]
// Text comes from js/data/races.js so the card always matches the game data.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const [, , portrait, out, raceId = 'silicoid'] = process.argv;
global.window = global; require(path.join(__dirname, '../../js/core/ns.js')); require(path.join(__dirname, '../../js/data/races.js'));
const race = (global.MOO.Data.Races || global.MOO.Data).races[raceId];
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const img = 'data:image/png;base64,' + fs.readFileSync(portrait).toString('base64');
const html = `<!doctype html><meta charset=utf-8><style>
:root{--a:${race.art.primary};--b:${race.art.secondary}}
*{box-sizing:border-box}body{margin:0;background:#04060f;width:900px;height:1370px;font-family:'IBM Plex Sans Condensed','Liberation Sans',sans-serif;color:#dfe9f2}
.card{position:absolute;inset:24px;border-radius:26px;overflow:hidden;background:linear-gradient(180deg,#0a1024,#060a18);
 box-shadow:0 0 0 2px color-mix(in srgb,var(--a) 70%,#000),0 0 0 6px #04060f,0 0 0 8px color-mix(in srgb,var(--b) 60%,#000),0 0 60px color-mix(in srgb,var(--a) 35%,transparent)}
.art{height:900px;background:url(${img}) center/cover;position:relative}
.art:after{content:'';position:absolute;inset:auto 0 0 0;height:260px;background:linear-gradient(180deg,transparent,#0a1024)}
.plate{position:absolute;left:36px;right:36px;top:812px;z-index:2}
h1{margin:0;font:600 64px/1 'Marcellus','DejaVu Serif',serif;letter-spacing:.14em;text-transform:uppercase;color:#fff;text-shadow:0 0 24px var(--a)}
.tag{margin-top:8px;font-size:22px;letter-spacing:.3em;text-transform:uppercase;color:var(--a)}
.body{position:absolute;top:960px;left:36px;right:36px}
.desc{font-size:21px;line-height:1.45;color:#b9c8d8;margin:0 0 20px;border-left:3px solid var(--b);padding-left:16px}
.traits{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.t{border-radius:10px;padding:10px 14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}
.t b{display:block;font-size:17px;letter-spacing:.04em;margin-bottom:3px}.t span{font-size:14.5px;line-height:1.3;color:#9db0c4}
.t.good b{color:#6fe3b0}.t.bad b{color:#ff8a6b}
.foot{position:absolute;bottom:14px;left:36px;right:36px;display:flex;justify-content:space-between;font-size:16px;letter-spacing:.18em;text-transform:uppercase;color:#6f86a0}
</style><div class=card><div class=art></div>
<div class=plate><h1>${esc(race.name)}</h1><div class=tag>${esc(race.tagline)}</div></div>
<div class=body><p class=desc>${esc(race.desc)}</p><div class=traits>
${race.traits.map(t => `<div class="t ${t.good ? 'good' : 'bad'}"><b>${t.good ? '＋' : '－'} ${esc(t.label)}</b><span>${esc(t.text)}</span></div>`).join('')}
</div></div><div class=foot><span>Homeworld · ${esc(race.homeworld)}</span><span>Master of Orion — Reborn</span></div></div>`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 1370 } });
  await p.setContent(html, { waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.screenshot({ path: out }); await b.close(); console.log('wrote', out);
})();

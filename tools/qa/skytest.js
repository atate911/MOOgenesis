// Contact sheet of sky variants: node skytest.js <name>   (env TIER=high for the GL path; CPU=1 to render the Canvas2D path instead)
// Each cell: GLSpace/Space.makeBackdrop(640x360, 'galaxymap', opts) with the variant's opts over Space.SKY.
const { serve, open, sleep } = require('./lib');
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, '..', 'out', 'sky'); fs.mkdirSync(OUT, { recursive: true });
const name = process.argv[2] || 'sky-sheet';
const PORT = 8000 + (process.pid % 700);
const VARIANTS = JSON.parse(process.env.VARIANTS || '[]');
(async () => {
  const srv = await serve(PORT);
  const { browser, page, errors } = await open({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`http://localhost:${PORT}/index.html?dev=1&screen=galaxy&race=human&size=medium&opp=3&seed=abc&turns=2`);
  await sleep(6000);
  const info = await page.evaluate(({ variants, cpu }) => {
    const Sp = cpu ? MOO.Gfx.Space : (MOO.Gfx.GLSpace && MOO.Gfx.GLSpace.supported() ? MOO.Gfx.GLSpace : MOO.Gfx.Space);
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000;display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:4px;box-sizing:border-box;';
    for (const v of variants) {
      const o = MOO.Gfx.Space.sky(v.opts || {});
      const c = Sp.makeBackdrop(632, 352, v.seed || 'galaxymap', o);
      const cell = document.createElement('div'); cell.style.cssText = 'position:relative;overflow:hidden;';
      c.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover;';
      const lab = document.createElement('div'); lab.textContent = v.label; lab.style.cssText = 'position:absolute;left:6px;top:4px;font:12px monospace;color:#fff;text-shadow:0 1px 2px #000;';
      cell.appendChild(c); cell.appendChild(lab); host.appendChild(cell);
    }
    document.body.appendChild(host);
    return { mod: Sp === MOO.Gfx.GLSpace ? 'gl' : 'cpu', tier: MOO.Perf.tier };
  }, { variants: VARIANTS, cpu: !!process.env.CPU });
  await sleep(800);
  const f = path.join(OUT, name + '.png'); await page.screenshot({ path: f });
  console.log('sheet', f, JSON.stringify(info));
  console.log('errors', JSON.stringify([...new Set(errors)].filter(x => !/fonts\.g|swiftshader|GPU stall|willReadFrequently|inst-spaceport|api\/status/i.test(x)).slice(0, 6)));
  await browser.close(); srv.close();
})();

// Desktop layout fingerprint: proves a change left the desktop layout alone. Visits the main screens at desktop sizes and prints, per
// screen, the computed layout (display, grid columns, position, size) of the key containers as JSON. Run it on two trees and diff:
//   node tools/qa/layout-fingerprint.js > /tmp/a.json                         (this checkout)
//   node tools/qa/layout-fingerprint.js /path/to/other/checkout > /tmp/b.json  (e.g. a `git worktree` of main)
//   diff /tmp/a.json /tmp/b.json && echo identical
// env: PORT (default 8796)
const { open, sleep } = require('./lib');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '../..'));
const PORT = +process.env.PORT || 8796;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const SIZES = [[1280, 720], [1920, 1080], [1024, 600]];
const SCREENS = ['galaxy', 'design', 'planets', 'fleets', 'specs', 'tech', 'techtree', 'races', 'report', 'status', 'mapoverview', 'system', 'help', 'options', 'saveload', 'menu', 'setup'];
const SEL = ['.gx', '.gx-side', '.gx-bar', '.gx-bar .btn', '.gx-top', '.gmap-mini', '.dz', '.dz-main', '.dz-right', '.dz-wr', '.dz-pop', '.lp', '.lp-sheet', '.lp-foot', '.lf', '.lf-grid', '.lf-srow',
  '.tch', '.tch-body', '.tch-r1', '.tch-row .slider', '.ttp', '.tt', '.rx', '.rc-grid', '.rp-body', '.sx-grid', '.ov', '.ov-side', '.sv-info', '.sv-fleets', '.al', '.al-grid', '.op-body', '.sl-row',
  '.menu-col', '.su-head', '.su-body', '.su-sizes', '.sc-sliders .slider', '#screens'];
const PROPS = ['display', 'gridTemplateColumns', 'position', 'width', 'height', 'top', 'left', 'flexDirection', 'overflowY'];

function serve() {
  return new Promise(res => {
    const s = http.createServer((q, r) => {
      const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
      fs.readFile(p.endsWith('/') ? p + 'index.html' : p, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d); } });
    }).listen(PORT, () => res(s));
  });
}

(async () => {
  const srv = await serve(), out = {};
  for (const [W, H] of SIZES) {
    const { browser, page } = await open({ viewport: { width: W, height: H } });
    await page.goto(`http://localhost:${PORT}/index.html?dev=1&screen=galaxy&race=human&size=medium&opp=3&seed=fp&turns=2&art=0`);   // art=0: no painted backdrops arriving mid-measure
    for (let i = 0; i < 120; i++) { if (await page.evaluate(() => !!(window.MOO && MOO.Game && MOO.Game.S && !MOO.Game.busy))) break; await sleep(500); }
    await sleep(800);
    out[W + 'x' + H] = { phone: await page.evaluate(() => document.documentElement.hasAttribute('data-phone') || !!document.querySelector('.ph-back, .ph-grip, .ph-appbar')) };
    for (const id of SCREENS) {
      await page.evaluate(id => { try { MOO.UI.closeAllModals(); MOO.UI.Screens.go(id, { from: 'galaxy', empire: 1 }); } catch (e) { /* screen missing */ } }, id); await sleep(700);
      out[W + 'x' + H][id] = await page.evaluate(([SEL, PROPS]) => {
        document.querySelectorAll('.screen.fade-in').forEach(e => e.classList.remove('fade-in'));       // the entry slide (theme v2: 4px) is not layout
        const scr = document.querySelector('.screen.active'), r = {};
        for (const s of SEL) {
          const e = (s === '#screens' ? document : scr || document).querySelector(s); if (!e) continue;
          const cs = getComputedStyle(e), b = e.getBoundingClientRect();
          r[s] = PROPS.map(p => cs[p]).join(' | ') + ' @ ' + [b.left, b.top, b.width, b.height].map(Math.round).join(',');
        }
        return r;
      }, [SEL, PROPS]);
    }
    await browser.close();
  }
  srv.close();
  process.stdout.write(JSON.stringify(out, null, 1) + '\n');
})();

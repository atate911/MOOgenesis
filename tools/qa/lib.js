// Shared QA harness: static server + Playwright Chromium with console capture.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg' };
function serve(port = 8765) {
  return new Promise(res => {
    const s = http.createServer((q, r) => {
      const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
      fs.readFile(p.endsWith('/') ? p + 'index.html' : p, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d); } });
    }).listen(port, () => res(s));
  });
}
async function open(opts = {}) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required'].concat(opts.args || []) });
  // opts.phone: true (390x844 portrait) | 'landscape' (844x390) — an emulated touch phone (coarse pointer, DPR 2), so index.html's own gate
  // switches the phone layout layer on exactly as on a device (no ?phone=1)
  const phone = opts.phone ? { viewport: opts.phone === 'landscape' ? { width: 844, height: 390 } : { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : null;
  const ctx = await browser.newContext(phone || { viewport: opts.viewport || { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  if (process.env.TIER) { const go = page.goto.bind(page); page.goto = (u, o) => go(u + (u.includes('?') ? '&' : '?') + 'tier=' + process.env.TIER, o); }   // TIER=low|medium|high|ultra forces a perf tier (software GL is detected as 'low')
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push('HTTP ' + r.status() + ' ' + r.url()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message + ' @ ' + (e.stack || '').split('\n')[1]));
  return { browser, ctx, page, errors };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
module.exports = { serve, open, sleep, ROOT };

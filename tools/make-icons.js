// Renders the home-screen / install icons (assets/icons/*.png) from one inline SVG with the bundled Playwright Chromium, and the iOS
// launch images (assets/icons/launch-WxH.png: the emblem on the game's background, one per iPhone screen size, linked from index.html
// with media queries; without them an installed app opens on a white screen).
// usage: node tools/make-icons.js      (re-run after changing the artwork below)
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path');
const OUT = path.resolve(__dirname, '../assets/icons');
// indigo void, a gold world with a brass orbit and a small cyan moon: the game's palette (--void, --gold, --brass, --cyan)
const art = pad => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#1a2672"/><stop offset=".62" stop-color="#0a1030"/><stop offset="1" stop-color="#060919"/></radialGradient>
    <radialGradient id="pl" cx="38%" cy="34%" r="70%"><stop offset="0" stop-color="#fff3c4"/><stop offset=".35" stop-color="#ffd54f"/><stop offset=".78" stop-color="#b8862c"/><stop offset="1" stop-color="#5a3c10"/></radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g transform="translate(256 256) scale(${pad})">
    <circle r="8" cx="-170" cy="-150" fill="#ece6d3" opacity=".8"/><circle r="5" cx="150" cy="-175" fill="#ece6d3" opacity=".6"/><circle r="6" cx="185" cy="140" fill="#ece6d3" opacity=".5"/>
    <ellipse rx="190" ry="62" fill="none" stroke="#d6b36a" stroke-width="14" transform="rotate(-18)" opacity=".55"/>
    <circle r="112" fill="url(#pl)"/>
    <path d="M -186 30 A 190 62 0 0 0 186 -30" fill="none" stroke="#f3dca0" stroke-width="14" transform="rotate(-18)" stroke-linecap="round"/>
    <circle r="22" cx="150" cy="-92" fill="#62d8ff"/>
  </g>
</svg>`;
const LAUNCH = [[430, 932, 3], [393, 852, 3], [402, 874, 3], [440, 956, 3], [390, 844, 3], [428, 926, 3], [375, 812, 3], [414, 896, 3], [414, 896, 2], [375, 667, 2]];
module.exports = { LAUNCH };
if (require.main === module) (async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 512, height: 512 } });
  const shots = [['icon-512.png', 512, 1], ['icon-192.png', 192, 1], ['icon-180.png', 180, 1], ['icon-maskable-512.png', 512, 0.78]];
  for (const [name, size, pad] of shots) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<html><body style="margin:0;background:#060919">${art(pad).replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`);
    await p.screenshot({ path: path.join(OUT, name), clip: { x: 0, y: 0, width: size, height: size } });
    console.log('wrote', name);
  }
  // launch images: [css width, css height, dpr] of the iPhone screens (portrait); index.html lists the same set
  for (const [w, hh, dpr] of LAUNCH) {
    const W = w * dpr, H = hh * dpr, em = Math.round(W * 0.26), name = `launch-${W}x${H}.png`;   // a flat background keeps each file small
    await p.setViewportSize({ width: W, height: H });
    await p.setContent(`<html><body style="margin:0;width:${W}px;height:${H}px;background:#05080c;display:grid;place-items:center">` +
      `<div style="width:${em}px;height:${em}px;border-radius:22%;overflow:hidden">${art(1).replace('width="512" height="512"', `width="${em}" height="${em}"`)}</div></body></html>`);
    await p.screenshot({ path: path.join(OUT, name), clip: { x: 0, y: 0, width: W, height: H } });
    console.log('wrote', name);
  }
  await b.close();
})();

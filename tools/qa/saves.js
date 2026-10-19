// Server saves + password gate, end to end: server/moo-saves.py --dev serves the game, Chromium logs in, saves to a server slot,
// reloads, continues from the title screen, and checks the browser slots still work.   node tools/qa/saves.js [--shots DIR]
const { open, sleep, ROOT } = require('./lib');
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');

const PORT = 8797, BASE = 'http://127.0.0.1:' + PORT;
const shots = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'moo-saves-'));
let failed = 0;
const check = (ok, what) => { console.log((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) failed++; };

(async () => {
  const srv = spawn('python3', [path.join(ROOT, 'server/moo-saves.py'), '--dev', '--listen', '127.0.0.1:' + PORT, '--data-dir', data, '--password', 'letmein', '--config', '/nonexistent'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let log = ''; srv.stderr.on('data', d => { log += d; });
  for (let i = 0; i < 50 && !log.includes('listening'); i++) await sleep(100);
  const { browser, page, errors } = await open();
  const shot = async n => { if (shots) await page.screenshot({ path: path.join(shots, n + '.png') }); };
  try {
    await page.goto(BASE + '/index.html?dev=1&screen=galaxy&race=human&size=small&opp=2&seed=saves&turns=3');
    check(await page.locator('input[name=password]').count() === 1, 'the game is behind the password page');
    await shot('1-login');
    await page.fill('input[name=password]', 'wrong'); await page.click('button[type=submit]');
    check((await page.textContent('.err')).includes('not the password'), 'a wrong password is refused');
    await page.fill('input[name=password]', 'letmein'); await page.click('button[type=submit]');
    await page.waitForFunction(() => window.MOO && MOO.Game && MOO.Game.S, null, { timeout: 30000 });
    check(new URL(page.url()).searchParams.get('dev') === '1', 'login returns to the URL that was asked for');
    const turn = await page.evaluate(() => MOO.Game.S.turn);

    // save to server slot 2
    await page.evaluate(() => { MOO.UI.openSaveLoad('save'); });
    await page.waitForSelector('.sl-where:not(.hide)');
    check(await page.evaluate(() => document.querySelector('.sl-where [aria-checked=true]') && document.querySelector('.sl-where [aria-checked=true]').textContent) === 'Server', 'the save screen defaults to the server');
    await shot('2-save-screen');
    await page.click('.sl-row[data-slot="2"] .sl-act button');
    await page.waitForFunction(() => !document.querySelector('.sl-modal'), null, { timeout: 10000 });
    const files = fs.readdirSync(path.join(data, 'saves')).sort();
    check(files.join(',') === '2.json,2.save', 'slot 2 is on the server: ' + files.join(','));
    const blob = fs.readFileSync(path.join(data, 'saves', '2.save'));
    check(blob[0] === 0x1f && blob[1] === 0x8b, 'the save is gzipped (' + Math.round(blob.length / 1024) + ' KB)');
    check(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('moo.save.v1.2')).length) === 0, 'nothing was written to browser slot 2');

    // a new page: Continue picks the server save
    await page.evaluate(() => localStorage.clear());
    await page.goto(BASE + '/index.html');
    await page.waitForFunction(() => [...document.querySelectorAll('.menu-list button')].some(b => b.textContent.includes('Continue')), null, { timeout: 30000 });
    await shot('3-menu');
    await page.click('.menu-list button:has-text("Continue")');
    await page.waitForFunction(() => MOO.Game && MOO.Game.S, null, { timeout: 15000 });
    check(await page.evaluate(() => MOO.Game.S.turn) === turn, 'Continue loaded the server save (turn ' + turn + ')');

    // browser slots still work, and delete on the server
    await page.evaluate(() => { MOO.UI.openSaveLoad('save'); });
    await page.waitForSelector('.sl-where:not(.hide)');
    await page.click('.sl-where button:has-text("This browser")');
    await page.waitForSelector('.sl-row[data-slot="auto"]');
    await page.click('.sl-row[data-slot="4"] .sl-act button');
    await page.waitForFunction(() => !document.querySelector('.sl-modal'), null, { timeout: 10000 });
    check(await page.evaluate(() => !!localStorage.getItem('moo.save.v1.4')), 'a browser slot still saves locally');
    await page.evaluate(() => { MOO.UI.openSaveLoad('load'); });
    await page.waitForSelector('.sl-row[data-slot="auto"]');
    check(true, 'the screen remembers "This browser" for the session');
    await page.click('.sl-where button:has-text("Server")');
    await page.waitForSelector('.sl-row[data-slot="2"]:not(.empty)');
    await page.click('.sl-row[data-slot="2"] .sl-ib.del');
    await page.click('.modal button:has-text("Delete")');
    await page.waitForSelector('.sl-row[data-slot="2"].empty');
    check(!fs.existsSync(path.join(data, 'saves', '2.save')), 'delete removes the server save');
    await shot('4-deleted');

    // logged out: the API refuses, the page asks for the password again
    await page.goto(BASE + '/api/logout');
    check(await page.locator('input[name=password]').count() === 1, 'logout returns to the password page');
    // resource 401s (the password page) / 404s (art still to be made, ART-NEEDED.md) and audio fetches cut off by navigation are expected
    const real = errors.filter(e => !/^HTTP \d|Failed to load resource|\[samples\]/.test(e));
    check(real.length === 0, 'no script errors' + (real.length ? ': ' + real.join(' | ') : ''));
  } catch (e) {
    console.error(e); failed++;
    await shot('error');
  } finally {
    await browser.close(); srv.kill();
    fs.rmSync(data, { recursive: true, force: true });
  }
  console.log(failed ? failed + ' check(s) failed' : 'all checks passed');
  process.exit(failed ? 1 : 0);
})();

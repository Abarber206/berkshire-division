/* Traffic, run for real. The built page runs in headless Chromium with the game loop stopped, and the game's own
   simStep runs the timetable trains for 40 minutes of game time on the Berkshire Division and over Laurel Mountain
   while your engine stands in the yard. Every train has to keep moving: no train knocked off the rails by another,
   none stuck at a red signal for good. Needs Playwright with Chromium (CI installs it) and tests/vendor/three.min.js.
   Run with: node --test tests/trafficrun.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const THREE_JS = path.join(__dirname, 'vendor', 'three.min.js');
let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* not installed: skipped below (CI installs it) */ }
const SKIP = !process.env.CI && (!chromium ? 'playwright not installed' : !fs.existsSync(THREE_JS) && 'tests/vendor/three.min.js missing (npm pack three@0.128.0)');

/* the page as built, with three.js served from tests/vendor (the cloud CI can't always reach the CDN) */
function serve() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<script src="https:\/\/cdnjs[^"]*three\.min\.js"><\/script>/, '<script src="three.min.js"></script>');
  const three = fs.readFileSync(THREE_JS);
  const srv = http.createServer((req, res) => {
    if (req.url.startsWith('/three.min.js')) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(three); }
    if (req.url.startsWith('/index.html')) { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html); }
    res.writeHead(404); res.end();
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok(srv)));
}

/* ----- runs in the page: the timetable trains run for secs of game time while your engine stands in the yard ----- */
function trafficRun(secs) {
  const out = { errs: [], n: 0, trains: [] };
  window.toast = () => {};
  Object.assign(GAME.settings, { loco: '765', consist: 'light', job: '', traffic: 'on', fire: 'easy' });
  TUT.want = false;
  GAME.start(); AI.flush();
  const T = GAME.train, dt = 0.1;
  const st = AI.trains.map(a => ({ id: a.id, loco: a.def.loco, push: a.def.push ? a.def.push.loco : '', cars: a.train.vehicles.length, odo: 0, held: 0, why: '', knk: false, climb: 0 }));
  out.n = AI.trains.length;
  for (let i = 0; i < secs / dt; i++) {
    try { simStep(dt, T); } catch (e) { out.errs.push(String(e.stack).slice(0, 400)); break; }
    if (i % 10) continue;
    AI.trains.forEach((a, k) => {
      const s = st[k]; if (!s || a.id !== s.id) return;
      s.odo = Math.round(a.odo); s.held = Math.max(s.held, Math.round(a.held)); if (a.held > 30) s.why = a.heldWhy;
      if (a.train.knk) s.knk = true;
      if ((a.grade || 0) > 0.015) s.climb = Math.max(s.climb, Math.round(a.v / MPH));
    });
  }
  out.trains = st; out.derailed = S.derailed;
  return out;
}

let srv = null, browser = null, base = '';
async function run(route, secs) {
  const page = await browser.newPage({ viewport: { width: 480, height: 320 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message || e)));
  await page.addInitScript(seed => { let s = seed; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647; }, 4242);
  await page.goto(`${base}?route=${route}`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForFunction(() => typeof GAME !== 'undefined' && GAME.ready, null, { timeout: 240000 });
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
  const r = await page.evaluate(trafficRun, secs);
  r.errs.push(...errs);
  await page.close();
  return r;
}
/* every train kept moving: none wrecked into another, none stuck for good at a signal */
function flowed(r, n, label) {
  assert.deepEqual(r.errs, [], `${label}: page errors`);
  assert.equal(r.n, n, `${label}: ${r.n} trains made up`);
  assert.ok(!r.derailed, `${label}: your standing engine was hit`);
  for (const t of r.trains) {
    assert.ok(!t.knk, `${label}: ${t.id} was knocked off the rails`);
    assert.ok(t.odo > 8000, `${label}: ${t.id} only ran ${t.odo} m (held for ${t.why})`);
    assert.ok(t.held < 600, `${label}: ${t.id} stood ${t.held} s at a signal (${t.why})`);
  }
}

test.describe('the timetable trains, run in the real game', { skip: SKIP, concurrency: 2, timeout: 10 * 60000 }, () => {
  test.before(async () => {
    srv = await serve(); base = `http://127.0.0.1:${srv.address().port}/index.html`;
    browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  });
  test.after(async () => { if (browser) await browser.close(); if (srv) srv.close(); });

  test('seven trains on the Berkshire Division run 40 minutes without a wreck or a deadlock', async () => {
    flowed(await run('ohio', 2400), 7, 'Berkshire Division');
  });
  test('five over Laurel Mountain, the coal drag with its pusher, run 40 minutes', async () => {
    const r = await run('laurel', 2400);
    flowed(r, 5, 'Laurel Mountain');
    const coal = r.trains.find(t => t.id === 'm92');
    assert.ok(coal.push && coal.cars >= 28, `the coal drag has its pusher: ${JSON.stringify(coal)}`);
    assert.ok(coal.climb > 0 && coal.climb <= 30, `climbs the 1.9 per cent at ${coal.climb} mph`);
  });
});

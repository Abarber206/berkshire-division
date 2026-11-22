/* Raven Lake, driven for real. The built page (index.html) runs in headless Chromium with the game loop stopped,
   and each run steps the game's own simulation (simStep, the wreck, the ice) frame by frame: real engines, real
   cars, real brakes and slack, nothing faked. Every frame it checks the things Austin kept seeing go wrong out on
   the ice: cars pulled apart, a car jumping somewhere in one frame, a train snapping onto the rails, cars flung
   into the air, NaNs. Runs:
     - safe: down the 4 per cent cliff at about 20 mph and across the lake, steered back onto the far rails, for
       several engines and train lengths (a long one set going at the foot of the cliff, since air alone can't
       hold 2,700 tons on 4 per cent), plus a stop and back-up halfway across;
     - too fast or braking hard: an emergency at 38 mph on the ice folds the train up (and at 24 mph it doesn't),
       a runaway off the cliff wrecks; the wreck stays sane, and after the re-rail on the far shore the whole train
       pulls away again.
   Needs Playwright with Chromium (CI installs it) and tests/vendor/three.min.js. ~1-2 min.
   Run with: node --test tests/frostrun.test.js */
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

/* ----- runs in the page: one drive, every frame checked; returns what it saw ----- */
function frostDrive(o) {
  const out = { bad: [], toasts: [], skated: 0, caught: false, why: null, n0: 0, n1: 0, maxV: 0, maxVy: 0, v0: 0, far: 0, reran: false, stopped: false, backed: false };
  const bad = m => { if (out.bad.length < 12) out.bad.push(m); };
  window.toast = m => { if (out.toasts.length < 40 && !out.toasts.includes(m)) out.toasts.push(m); };
  Object.assign(GAME.settings, { loco: o.loco, consist: o.consist, job: '', traffic: 'off', fire: 'easy' });
  TUT.want = false;
  GAME.start();
  const T = GAME.train, M = FROST.main, sk = ICE.sk, dt = 1 / 30;
  const loc = M.locate(o.at === 'foot' ? FROST.sIce[0] - 30 : FROST.cliff[0] + 20);
  T.place(new TrackPos(loc.edge, loc.s, 1));
  const elec = T.diesel || T.elec;
  Object.assign(S, { v: o.v0 || 0, vw: o.v0 || 0, brakeH: 0.12, indH: 0, throttle: 0, dyn: 0, reverser: elec ? 1 : 0.5 });
  out.n0 = T.vehicles.length;
  const posOf = v => new THREE.Vector3().setFromMatrixPosition(v.root.matrix);
  let last = T.vehicles.map(posOf), gap0 = [], I = 0, t = 0, st = 0, d0 = 0, rer = -1, wreckAt = null, v0 = 0;
  for (let i = 0; i < o.secs / dt; i++) {
    t += dt;
    const v = Math.abs(S.v);
    // the driver: hold the speed with the air (and the dynamic brake on a diesel), steer for the far rails
    if (!S.derailed) {
      const tg = (sk.on && o.iceMph ? o.iceMph : o.mph) * MPH, e = tg - v;
      if (o.brakeOnIce && sk.on && !sk.cap) { S.brakeH = 1; S.throttle = 0; }
      else if (o.runaway && !sk.on && rer < 0) { S.brakeH = 0.12; S.throttle = 0.3; }
      else {
        I = Math.min(0.5, Math.max(0, I + dt * 0.02 * (-e - 0.3)));
        if (elec && !sk.on) S.dyn = e < 1.5 ? Math.min(1, 0.3 + 0.15 * -e + 2 * I) : 0;
        if (e < 1.5 || I > 0.02) { S.throttle = 0; S.brakeH = Math.min(0.88, Math.max(0.29, 0.3 + 0.05 * -e + I)); if (e > 3) I = 0; }
        else { S.brakeH = 0.12; S.throttle = e > 0.5 ? Math.min(1, S.throttle + dt * 0.5) : Math.max(0, S.throttle - dt * 0.3); }
      }
      if (elec) S.notch = Math.round(S.throttle * GAME.notches());
      if (o.stopGo && sk.on && !sk.cap) {   // halfway over: stop, back up 40 m, stop, carry on
        const A = iceSkateAim(T), fw = Math.abs(S.reverser) || 1;
        if (st === 0 && A.dist < 1300) st = 1;
        if (st === 1) { S.throttle = 0; S.brakeH = 0.6; if (v < 0.01) { st = 2; out.stopped = true; } }
        else if (st === 2) { S.brakeH = 0.12; S.reverser = -fw; S.throttle = 0.5; if (S.v < -3) { st = 3; d0 = A.dist; } }
        else if (st === 3) { S.throttle = 0; S.brakeH = A.dist > d0 + 40 ? 0.6 : 0.12; if (A.dist > d0 + 40 && v < 0.01) { st = 4; out.backed = true; } }
        else if (st === 4) { S.brakeH = 0.12; S.reverser = fw; S.throttle = 0.5; if (S.v > 3) st = 5; }
        if (elec) S.notch = Math.round(S.throttle * GAME.notches());
      }
      if (sk.on && !sk.cap && !(st >= 1 && st <= 4)) {
        const A = iceSkateAim(T), want = Math.atan2(A.off, Math.max(A.dist * 0.5, 80)), e2 = want - A.ang - sk.w * 3;
        sk.steer = e2 > 0.003 ? 1 : e2 < -0.003 ? -1 : 0;
      }
    }
    // one frame of the game, as loop() runs it (the drawing left out)
    try {
      if (!S.derailed) simStep(dt, T); else { stepSwitches(dt); GAME.wreckStep(dt, T); }
      T.update(dt, S.theta, S.reverser);
    } catch (err) { bad(`threw at ${t.toFixed(1)} s: ${err.stack}`); break; }
    if (sk.on) out.skated += dt;
    if (sk.cap) out.caught = true;
    if (S.derailed && !wreckAt) { out.wt = t; wreckAt = T.lead.pos.clone(); v0 = out.v0 = Math.max(v, Math.abs(GAME.wrecking.kin.v)); }
    T.vehicles.forEach((x, q) => {
      const P = posOf(x), m = P.distanceTo(last[q] || P);
      if (!isFinite(P.x + P.y + P.z)) bad(`vehicle ${q} position not a number at ${t.toFixed(1)} s`);
      if (!S.derailed) {
        // on the rails or skating, a car moves just as far as the train does
        if (m > v * dt * 1.1 + 0.03) bad(`vehicle ${q} (${x.kind}) jumped ${m.toFixed(2)} m in one frame at ${t.toFixed(1)} s, train ${v.toFixed(1)} m/s${sk.on ? ', skating' : ''}${sk.cap ? ', back on the rails' : ''}`);
      } else {
        out.maxV = Math.max(out.maxV, m / dt);
        if (x.rb) { if (x.rb.lv.y > out.maxVy) { out.maxVy = x.rb.lv.y; out.vyAt = `${x.kind} ${q}, ${(t - out.wt).toFixed(1)} s into the wreck`; } }   // thrown upward: what a car flying away does
        if (wreckAt) out.far = Math.max(out.far, P.distanceTo(wreckAt));
      }
      last[q] = P;
    });
    if (!S.derailed) for (let q = 0; q + 1 < T.vehicles.length; q++) {
      const d = T.vehicles[q].pos.distanceTo(T.vehicles[q + 1].pos);
      if (gap0[q] === undefined) gap0[q] = d;
      else if (Math.abs(d - gap0[q]) > 1.5) bad(`vehicles ${q} and ${q + 1} pulled ${(d - gap0[q]).toFixed(2)} m apart at ${t.toFixed(1)} s${sk.on ? ' on the ice' : ''}`);
    }
    // the wreck has settled: put her back on the far shore (the button on the wreck bar) and pull away
    if (S.derailed && GAME.wrecking && GAME.wrecking.done && rer < 0) {
      out.why = GAME.wrecking.why; rer = t; iceRerailFar(); out.reran = true;
      last = T.vehicles.map(posOf); gap0 = []; I = 0; S.reverser = elec ? 1 : 0.5; o.mph = 20; o.iceMph = 0; o.brakeOnIce = false;
    }
    if (rer >= 0 && t - rer > 30) break;
    if (out.caught && !sk.on && !S.derailed && rer < 0) { if (!o._end) o._end = t; if (t - o._end > 8) break; }
  }
  out.n1 = T.vehicles.length;
  out.derailed = S.derailed;
  out.skating = sk.on;
  // every truck on the rails where it says it is: nothing left on a skated path
  out.offRails = 0;
  if (!sk.on) for (const p of T.pts) { const F = { p: new THREE.Vector3(), f: new THREE.Vector3(), u: new THREE.Vector3(), r: new THREE.Vector3() }; p.tp.pose(F); const y = p.tp.e.elev(p.tp.s); if (Math.abs(F.p.y - y) > 0.05) out.offRails++; }
  return out;
}

let srv = null, browser = null, url = '';
const runs = new Map();
function drive(name, o) {
  if (!runs.has(name)) runs.set(name, (async () => {
    const page = await browser.newPage({ viewport: { width: 480, height: 320 } });
    const errs = [];
    page.on('pageerror', e => errs.push(String(e.message || e)));
    // the dice seeded from the very start (weather, consist, wreck), so a run plays out the same every time
    await page.addInitScript(seed => { let s = seed; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647; },
      [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 2147483646, 7) + 1);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 240000 });
    await page.waitForFunction(() => typeof GAME !== 'undefined' && GAME.ready, null, { timeout: 240000 });
    await page.evaluate(() => { window.requestAnimationFrame = () => 0; });   // stop the game's own loop: the test steps it
    const r = await page.evaluate(frostDrive, o);
    r.errs = errs;
    await page.close();
    return r;
  })());
  return runs.get(name);
}
const sane = (r, label) => {
  assert.deepEqual(r.bad, [], `${label}: ${r.bad.join('; ')}`);
  assert.deepEqual(r.errs, [], `${label}: page errors`);
};
/* a crossing that went right: on the far rails, every car still on, no wreck */
const crossed = (r, label) => {
  sane(r, label);
  assert.equal(r.why, null, `${label} wrecked: ${r.why}`);
  assert.ok(r.skated > 20, `${label}: skated only ${r.skated.toFixed(0)} s`);
  assert.ok(r.caught && !r.skating && !r.derailed, `${label}: did not get back onto the far rails`);
  assert.equal(r.n1, r.n0, `${label}: lost cars`);
  assert.equal(r.offRails, 0, `${label}: ${r.offRails} trucks off the rails at the end`);
  assert.ok(!r.toasts.some(m => /knuckle broke/i.test(m)), `${label}: the train parted`);
};
/* a wreck that went right: it happened through the wreck physics, nothing flew or teleported, and the re-rail
   brought the whole train back to pull away */
const wrecked = (r, label, re) => {
  sane(r, label);
  assert.ok(r.why, `${label}: no wreck`);
  if (re) assert.match(r.why, re, label);
  assert.ok(r.maxV <= r.v0 * 1.3 + 3, `${label}: a car flew off at ${r.maxV.toFixed(1)} m/s after a wreck at ${r.v0.toFixed(1)} m/s`);
  // a car shoved up over the pile by the ones behind rises at 6 to 10 m/s and comes down on it; one flying away goes faster
  assert.ok(r.maxVy < 12, `${label}: the ${r.vyAt} was thrown upward at ${r.maxVy.toFixed(1)} m/s`);
  assert.ok(r.far < 700 + r.v0 * r.v0 / (2 * 0.05 * 9.81), `${label}: a car ended up ${r.far.toFixed(0)} m from the wreck`);
  assert.ok(r.reran && !r.derailed, `${label}: not re-railed`);
  assert.equal(r.n1, r.n0, `${label}: cars left behind after the re-rail`);
  assert.ok(!r.toasts.some(m => /knuckle broke/i.test(m)), `${label}: a knuckle broke pulling away after the re-rail`);
};

test.describe('Raven Lake, driven in the real game', { skip: SKIP, concurrency: 4, timeout: 15 * 60000 }, () => {
  test.before(async () => {
    srv = await serve(); url = `http://127.0.0.1:${srv.address().port}/index.html?route=frost`;
    browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  });
  test.after(async () => { if (browser) await browser.close(); if (srv) srv.close(); });

  test('765 with the lake mail comes down the cliff at 20 mph, skates the lake and drops back onto the far rails', async () => {
    crossed(await drive('765 mail', { loco: '765', consist: 'lakemail', mph: 20, secs: 700 }), '765 + 4 coaches');
  });
  test('the diesel with the 11-car ice freight, from the foot of the cliff', async () => {
    crossed(await drive('diesel freight', { loco: 'diesel', consist: 'lakefreight', at: 'foot', v0: 9, mph: 20, secs: 400 }), 'diesel + 11 cars');
  });
  test('the Big Boy with 26 loads, articulated and 330 m long', async () => {
    crossed(await drive('4014 coal', { loco: '4014', consist: 'coal', at: 'foot', v0: 9, mph: 20, secs: 400 }), '4014 + 26 hoppers');
  });
  test('the gas turbine with 36 cars, half a kilometre of train', async () => {
    crossed(await drive('18 freight', { loco: '18', consist: 'freight', at: 'foot', v0: 9, mph: 20, secs: 400 }), '18 + 36 cars');
  });
  test('the 1225 with eight coaches stops halfway over, backs up and carries on', async () => {
    const r = await drive('1225 stop', { loco: '1225', consist: 'passenger', at: 'foot', v0: 9, mph: 20, stopGo: true, secs: 500 });
    crossed(r, '1225 + 8 coaches');
    assert.ok(r.stopped && r.backed, 'stopped and backed up on the ice');
  });
  test('the 1308 light engine skates over at 44 mph and still makes the far rails', async () => {
    crossed(await drive('1308 fast', { loco: '1308', consist: 'light', at: 'foot', v0: 13, mph: 30, iceMph: 44, secs: 300 }), '1308 light at 44 mph');
  });
  test('an emergency stop on the ice at 24 mph just stops her', async () => {
    const r = await drive('765 brake 24', { loco: '765', consist: 'lakemail', at: 'foot', v0: 10.7, mph: 24, brakeOnIce: true, secs: 120 });
    sane(r, 'brake at 24');
    assert.equal(r.why, null, `wrecked: ${r.why}`);
    assert.ok(r.skating && !r.derailed, 'stopped out on the ice');
  });
  test('an emergency at 38 mph on the ice folds the train up, and it comes back together on the far shore', async () => {
    wrecked(await drive('765 brake 38', { loco: '765', consist: 'lakemail', at: 'foot', v0: 17, mph: 38, brakeOnIce: true, secs: 200 }), '765 + 4 coaches, brake at 38', /braked too hard/);
  });
  test('a 36-car freight braked hard at 38 mph jackknifes, and after the re-rail pulls away in one piece', async () => {
    wrecked(await drive('18 brake 38', { loco: '18', consist: 'freight', at: 'foot', v0: 17, mph: 38, brakeOnIce: true, secs: 260 }), '18 + 36 cars, brake at 38', /braked too hard/);
  });
  test('a runaway down the cliff wrecks out on the ice, and the wreck stays on the ground', async () => {
    wrecked(await drive('diesel runaway', { loco: 'diesel', consist: 'lakefreight', runaway: true, mph: 99, secs: 260 }), 'diesel + 11 cars, runaway');
  });
});

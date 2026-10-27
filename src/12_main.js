/* ============================================================================
   Game: boot, world loading, main loop, rules, HUD
   ========================================================================== */
const GAME = {
  settings: { loco: '765', consist: 'passenger', time: 'morning', weather: 'clear', fire: 'auto' },
  train: null, running: false, ready: false, stats: { runThrough: 0 },
  events: {}, stopped: 0, lastStation: null, filling: null,
};
let renderer, scene, camera, clock;

function boot() {
  const canvas = $('gl');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
  const mobile = Math.min(screen.width, screen.height) < 600;
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.6 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.3, 30000);
  clock = new THREE.Clock();
  addEventListener('resize', onResize);
  buildMenu();
  loadWorld().catch(err => { console.error(err); $('loadText').textContent = 'Could not build the world: ' + err.message; });
}
function onResize() {
  renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  drawLeverTicks(); if (MAP.visible) MAP.draw();
}
const frame = () => new Promise(r => requestAnimationFrame(() => r()));
async function loadWorld() {
  const prog = (p, t) => { $('loadBar').firstElementChild.style.width = Math.round(p * 100) + '%'; $('loadText').textContent = t; };
  prog(0.02, 'Surveying the line…'); await frame();
  makeMaterials(); sceneryMaterials(); rollingMaterials();
  buildRoute(); mapPrepare();
  prog(0.06, 'Grading the right of way…'); await frame();
  buildLattice();
  detailTextures(); planTowns();
  const T = 1500; let k = 0; const tot = ((INNER.x1 - INNER.x0) / T) * ((INNER.n1 - INNER.n0) / T);
  for (let x = INNER.x0; x < INNER.x1; x += T) for (let n = INNER.n0; n < INNER.n1; n += T) {
    buildTerrainTile(x, n, T, INNER.step, scene); k++;
    if (k % 3 === 0) { prog(0.08 + 0.42 * k / tot, `Shaping farm country… ${k}/${tot}`); await frame(); }
  }
  WORLD.hgrid.ready = true;
  buildFarTerrain(scene); buildWater(scene);
  prog(0.52, 'Laying 13.8 miles of jointed rail…'); await frame();
  buildTrack(scene); buildTrackHash();
  prog(0.68, 'Raising depots, towers and the river bridge…'); await frame();
  buildStations(); buildBridge(scene); buildRoads(scene); buildSignals(scene); buildSigns();
  prog(0.78, 'Stringing the pole line…'); await frame();
  buildFarms(); buildTowns(scene); buildPoleLine(scene);
  prog(0.82, 'Planting corn and fencing pastures…'); await frame();
  buildCorn(scene); buildPastureLife(scene);
  prog(0.86, 'Planting woodlots…'); await frame();
  buildTrees(scene); finalizeScenery(scene);
  prog(0.92, 'Lighting the fire…'); await frame();
  buildSky(scene, renderer); buildFX(scene);
  for (const st of ROUTE.stations) { st.edge.pose(st.s, FR); st.p = FR.p.clone(); }
  for (const w of ROUTE.water) { w.edge.pose(w.s, FR); w.p = FR.p.clone(); }
  { const c = ROUTE.coal; c.edge.pose(c.s, FR); c.p = FR.p.clone(); }
  setupViewInput($('gl'), camera); setupLevers(); setupButtons(); setupMap();
  linearizeObject(scene);
  makeTrain();
  applyLook(GAME.settings.time, GAME.settings.weather, renderer, scene);
  prog(1, `${(ROUTE.mainLen / MILE).toFixed(1)} mi mainline · ${NET.switches.length} switches · ${WORLD.treeCount.toLocaleString()} trees`);
  GAME.ready = true;
  $('btnStart').disabled = false;
  const hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) hot.snapshot(() => GAME.snapshot());
  const resume = data => { if (data && data.running) GAME.restore(data); };
  if (hot && hot.ready) hot.ready(resume); else resume(hot && hot.data ? hot.data : {});
  requestAnimationFrame(loop);
}

function resetState() {
  Object.assign(S, { throttle: 0, reverser: 0, brakeH: 0.12, indH: 0.6, sander: false, cocks: true, bell: false, light: SKY.night ? 2 : 1, injector: false, blower: 0.35, stoker: 0.45, whistle: 0,
    v: 0, vw: 0, slip: false, theta: 0, odo: 0, P: 238, Psc: 0, W: 0.62, fire: 0.55, coal: 19958, water: 83280, sand: 1800, MR: 140, ER: 90, pumping: false,
    safety: false, lowWater: false, priming: false, dead: false, derailed: false, paused: false });
  S.autoFire = GAME.settings.fire === 'auto';
  Object.assign(S, { notch: 0, dyn: 0, dbLoad: 0, DBF: 0, rpm: 200, engineRun: true, crank: 0, load: 0, fuel: 18927, turbo: 0.15, ditch: true, ditchFlash: 0, slipCtl: false, amps: 0 });
  if (LOCO_SPEC[GAME.settings.loco].diesel) { S.cocks = false; S.light = SKY.night ? 2 : 2; }
}
function makeTrain() {
  if (GAME.train) GAME.train.dispose();
  const t = new Train(scene, GAME.settings.loco, GAME.settings.consist);
  GAME.train = t;
  const sw = name => NET.switches.find(s => s.name === name);
  for (const s of NET.switches) { s.state = 0; s.anim = 0; }
  sw('Yard ladder E2').state = sw('Yard ladder E2').anim = 1;
  sw('Bellevue East').state = sw('Bellevue East').anim = 1;
  const line = ROUTE.lines['Yard 2'];
  const loc = line.locate(line.len - 175);
  const tp = new TrackPos(loc.edge, loc.s, 1);
  t.place(tp);
  for (const v of t.vehicles) linearizeObject(v.root);
  if (t.diesel) t.loco.trucks.forEach(linearizeObject); else linearizeObject(t.loco.leadTruck);
  for (const im of [t.tSix, t.tFour, ...(t.ax6 || []), ...(t.ax4 || [])]) if (im) linearizeObject(im);
  for (const v of t.vehicles) v.brake = { AR: 90, BC: 0, BP: 90, emerg: false, released: true };
  resetState();
  S.limit = Math.min(...t.pts.map(p => p.tp.e.limit));
  buildWhistleIfReady();
  CAM.init = false;
  GAME.jointMem = new Map();
}
function buildWhistleIfReady() { if (!AU.on) return; const sp = LOCO_SPEC[GAME.settings.loco]; buildWhistle(sp.diesel ? sp.horn : sp.whistle, sp.diesel ? 'horn' : 'steam'); }

/* ---------------- menu ---------------- */
function segButtons(id, opts, key, onPick) {
  const host = $(id); host.innerHTML = '';
  for (const k in opts) {
    const b = document.createElement('button'); b.type = 'button'; b.id = id + '_' + k;
    b.innerHTML = `${opts[k].name}<small>${opts[k].sub}</small>`;
    b.setAttribute('aria-pressed', String(GAME.settings[key] === k));
    b.addEventListener('click', () => { GAME.settings[key] = k; [...host.children].forEach(c => c.setAttribute('aria-pressed', String(c === b))); onPick && onPick(k); });
    host.appendChild(b);
  }
}
function buildMenu() {
  const locoOpts = { '765': { name: 'NKP 765', sub: 'S-2 · Lima 1944' }, '1225': { name: 'PM 1225', sub: 'N-1 · Lima 1941' }, 'diesel': { name: 'S&S 4401', sub: 'AC diesel · 4,400 hp' } };
  segButtons('optLoco', locoOpts, 'loco', () => { specGrid(); startLabel(); });
  segButtons('optTrain', CONSISTS, 'consist', startLabel);
  segButtons('optTime', PRESETS, 'time', k => { if (GAME.ready) applyLook(k, GAME.settings.weather, renderer, scene); });
  segButtons('optWeather', WEATHER, 'weather', k => { if (GAME.ready) { applyLook(GAME.settings.time, k, renderer, scene); FX.snow.visible = SKY.snow; } });
  segButtons('optFire', { auto: { name: 'Fireman', sub: 'Stoker & water handled' }, hand: { name: 'Hand fired', sub: 'You run the boiler' } }, 'fire', k => { S.autoFire = k === 'auto'; GAME.refreshKeys(); });
  specGrid();
  $('btnStart').addEventListener('click', () => GAME.start());
  $('bigRetry').addEventListener('click', () => GAME.rerail());
  $('bigMenu').addEventListener('click', () => { $('bigMsg').hidden = true; GAME.pause(true); });
}
function specGrid() {
  const s = LOCO_SPEC[GAME.settings.loco];
  const items = s.diesel
    ? [['C-C', 'Wheel arrangement'], ['42 in', 'Wheels'], ['4,400 hp', 'Prime mover'], ['AC', 'Traction motors'], ['183k lbf', 'Starting effort'], ['5,000 gal', 'Fuel']]
    : [['2-8-4', 'Wheel arrangement'], ['69 in', 'Drivers'], ['25×34 in', 'Cylinders'], ['245 psi', 'Boiler'], [(s.te / 1000).toFixed(1) + 'k lbf', 'Tractive effort'], [s.cls + ' · ' + s.short, 'Class']];
  $('specGrid').innerHTML = items.map(([b, l]) => `<div><b>${b}</b><span>${l}</span></div>`).join('');
  const fg = $('optFire').parentElement; fg.hidden = !!s.diesel;
  const ey = document.querySelector('.brandmark .eyebrow'); if (ey) ey.textContent = s.diesel ? 'Sandusky & Scioto · AC6 diesel' : 'Lima Super Power · 2-8-4';
}
function startLabel() {
  const b = $('btnStart');
  if (!GAME.running) { b.textContent = 'Highball'; return; }
  const t = GAME.train;
  b.textContent = (t.locoKey !== GAME.settings.loco || t.consistKey !== GAME.settings.consist) ? 'New train' : 'Resume';
}

GAME.start = function () {
  audioInit(); buildWhistleIfReady();
  const t = GAME.train;
  if (!GAME.running || t.locoKey !== GAME.settings.loco || t.consistKey !== GAME.settings.consist) {
    makeTrain(); GAME.train.consistKey = GAME.settings.consist;
    if (GAME.running) toast('New train made up on Yard 2.', 'good');
    GAME.intro();
  }
  GAME.running = true; S.paused = false; S.autoFire = GAME.settings.fire === 'auto';
  $('menu').hidden = true; $('hud').hidden = false;
  FX.snow.visible = SKY.snow;
  if (SKY.snow) { const a = FX.snow.geometry.attributes.position.array; for (let i = 0; i < a.length; i += 3) { a[i] += camera.position.x; a[i + 1] += camera.position.y - 20; a[i + 2] += camera.position.z; } }
  GAME.refreshKeys();
  setTimeout(drawLeverTicks, 50);
  try { navigator.wakeLock && navigator.wakeLock.request('screen').catch(() => {}); } catch (e) {}
};
GAME.intro = function () {
  setTimeout(() => toast('Yard 2, Bellevue. The ladder is lined out to the main.', '', 5000), 600);
  if (GAME.train && GAME.train.diesel) setTimeout(() => toast('Reverser to forward, engine brake off, then notch out the throttle.', '', 6000), 5200);
  else setTimeout(() => toast('Reverser forward, engine brake off, then ease the throttle open.', '', 6000), 5200);
};
GAME.pause = function (p) {
  S.paused = p;
  if (p) { $('menu').hidden = false; startLabel(); }
};
GAME.fail = function (title, body) { $('bigTitle').textContent = title; $('bigBody').textContent = body; $('bigMsg').hidden = false; S.throttle = 0; };
GAME.derail = function (why, title = 'Derailed') {
  if (S.derailed) return;
  S.derailed = true; S.v = 0; S.vw = 0; S.throttle = 0;
  if (AU.on) for (let i = 0; i < 8; i++) sndClunk(1, i * 0.07);
  CAM.shakeHit = 1;
  GAME.fail(title, why);
};
GAME.rerail = function () {
  $('bigMsg').hidden = true; S.derailed = false; S.v = 0; S.vw = 0; S.brakeH = 0.12;
  if (S.dead) { S.dead = false; S.W = 0.6; S.fire = 0.4; S.P = 180; }
  for (const v of GAME.train.vehicles) { v.brake.BP = 90; v.brake.AR = 90; v.brake.BC = 0; v.brake.emerg = false; }
  S.ER = 90;
  toast('Re-railed. Mind the speed boards.', 'good');
};
GAME.event = function (k) {
  if (k === 'slip') toast('Drivers slipping! Ease the throttle or use sand.', 'warn', 2600, 'slip');
  else if (k === 'slipCtl') toast('Wheel slip control is trimming power. Sand helps on a wet rail.', 'warn', 3000, 'slipCtl');
  else if (k === 'started') { toast('Prime mover running.', 'good', 2200, 'start'); GAME.refreshKeys(); }
  else if (k === 'noFuel') { toast('Out of fuel. The engine has shut down.', 'bad', 4000, 'fuel'); GAME.refreshKeys(); }
  else if (k === 'dynInterlock') toast('Throttle must be in idle while the dynamic brake is set up.', 'warn', 2800, 'dyn');
};
GAME.controlTouched = function () { };
GAME.manualFire = function (what) {
  if (S.autoFire) { S.autoFire = false; GAME.settings.fire = 'hand'; toast('You have the fire now: watch the pressure and the water glass.', 'warn', 4500); const b = $('optFire_hand'); if (b) b.click(); }
};
GAME.isDiesel = () => !!(GAME.train && GAME.train.diesel);
GAME.refreshKeys = function () {
  const on = (id, v) => $(id).classList.toggle('on', !!v);
  const D = GAME.isDiesel();
  on('btnBell', S.bell); on('btnSand', S.sander); on('btnLight', S.light > 0);
  $('btnLight').firstChild.textContent = ['Light off', 'Light dim', 'Light bright'][S.light];
  $('btnWhistle').firstChild.textContent = D ? 'Horn' : 'Whistle';
  if (D) {
    on('btnCocks', S.ditch); $('btnCocks').firstChild.textContent = 'Ditch lights';
    on('btnInj', S.engineRun || S.crank > 0); $('btnInj').firstChild.textContent = S.crank > 0 ? 'Starting' : (S.engineRun ? 'Engine run' : 'Engine off');
  } else {
    on('btnCocks', S.cocks); $('btnCocks').firstChild.textContent = 'Cyl cocks';
    on('btnInj', S.injector); $('btnInj').firstChild.textContent = 'Inject';
    on('btnFire', S.stoker > 0.05); on('btnBlower', S.blower > 0.3);
    $('btnFire').firstChild.textContent = 'Stoker ' + Math.round(S.stoker * 100);
  }
  $('btnFire').hidden = D; $('btnBlower').hidden = D; $('lvDyn').hidden = !D;
};
GAME.occupied = function (sw) {
  for (const p of GAME.train.pts) {
    for (const att of sw.node.att) { if (p.tp.e !== att.edge) continue; const d = att.end === 0 ? p.tp.s : att.edge.len - p.tp.s; if (d < 38) return true; }
  }
  return false;
};
GAME.throwSwitch = function (sw) {
  if (GAME.occupied(sw)) { toast(`${sw.name} is occupied by your train. Clear it before throwing.`, 'bad', 3200, 'occ'); return; }
  sw.state = 1 - sw.state; sndThrow();
  toast(`${sw.name} lined for ${sw.lined}.`, sw.state ? 'warn' : 'good', 2600);
  if (MAP.visible) MAP.draw();
};
GAME.throwAhead = function () { const a = GAME.scan; if (a && a.sw) GAME.throwSwitch(a.sw.sw); else toast('No facing switch ahead.', '', 2000, 'nosw'); };

/* scan the route ahead in the direction of travel */
function scanAhead(train, dir, maxD = 4000) {
  const tp = dir > 0 ? train.frontTP() : train.rearTP();
  const out = { sw: null, trail: null, signal: null, station: null, water: null, end: null };
  let e = tp.e, s = tp.s, o = tp.o * dir, d = 0;
  const onEdge = (e, s0, o, d0) => {
    if (!out.signal) for (const sg of SCN.signals) {
      const loc = sg.loc || (sg.loc = sg.sg.line.locate(sg.sg.sLine)); if (loc.edge !== e) continue;
      const ds = (loc.s - s0) * o; if (ds <= 0) continue;
      if ((o > 0) === (sg.sg.dir > 0)) { out.signal = { sg, d: d0 + ds }; break; }
    }
    if (!out.station) for (const st of ROUTE.stations) { if (st.edge !== e) continue; const ds = (st.s - s0) * o; if (ds > -30) { out.station = { st, d: d0 + ds }; break; } }
  };
  for (let g = 0; g < 60 && d < maxD; g++) {
    onEdge(e, s, o, d);
    d += o > 0 ? e.len - s : s;
    const end = o > 0 ? 1 : 0, node = end ? e.b : e.a;
    if (!node) break;
    if (node.sw) {
      const sw = node.sw, isTrunk = sw.trunk.edge === e && sw.trunk.end === end;
      if (isTrunk && !out.sw) out.sw = { sw, d };
      if (!isTrunk && !out.trail) { const li = sw.legs[0].edge === e && sw.legs[0].end === end ? 0 : 1; if (li !== sw.state) out.trail = { sw, d }; }
    }
    const nx = node.next(e, end, null);
    if (!nx) { out.end = { d }; break; }
    e = nx.edge; o = nx.end === 0 ? 1 : -1; s = nx.end === 0 ? 0 : e.len;
  }
  return out;
}

/* ---------------- HUD ---------------- */
let hudT = 0, mapT = 0, gaugeT = 0;
function updateHUD(dt) {
  hudT += dt; mapT += dt; gaugeT += dt;
  updateLevers();
  if (gaugeT > 0.066) { gaugeT = 0; if ($('gaugeWrap').classList.contains('min')) { const m = $('gaugeMini'); const bp = Math.round(GAME.train.vehicles[0].brake.BP); const t = GAME.isDiesel() ? `<span><b>${S.notch ? 'N' + S.notch : 'IDLE'}</b></span><span>${S.DBF > 1000 ? 'DB' : 'TE'} <b>${Math.round((S.DBF > 1000 ? S.DBF : Math.abs(S.TE)) / LBF / 1000)}k</b></span><span>BP <b>${bp}</b></span>` : `<span><b>${Math.round(S.P)}</b> psi</span><span>glass <b>${Math.round(clamp((S.W + 0.1) / 1.2, 0, 1) * 100)}%</b></span><span>BP <b>${bp}</b></span>`; if (m.innerHTML !== t) m.innerHTML = t; } else drawGauges(); }
  if (mapT > 0.18) { mapT = 0; drawMinimap(); if (MAP.visible) MAP.draw(); }
  if (hudT < 0.1) return; hudT = 0;
  const mph = Math.abs(S.v) / MPH;
  $('speedNum').firstChild.textContent = Math.round(mph);
  const lb = $('limitBadge'); lb.textContent = S.limit; lb.classList.toggle('over', mph > S.limit + 2);
  const dir = Math.abs(S.v) > 0.2 ? Math.sign(S.v) : (Math.sign(S.reverser) || 1);
  const gp = S.grade * dir * 100;
  $('gradeTxt').textContent = Math.abs(gp) < 0.1 ? 'Level' : (gp > 0 ? '▲ ' : '▼ ') + Math.abs(gp).toFixed(1) + '%';
  const sc = scanAhead(GAME.train, dir); GAME.scan = sc;
  const lamp = $('swLamp'), txt = $('swText'), lm = $('swLampMini');
  if (sc.sw && sc.sw.d < 3500) {
    const sw = sc.sw.sw;
    lamp.className = sw.state ? 'rev' : '';
    lm.style.background = sw.state ? 'var(--approach)' : 'var(--clear)';
    const near = sc.sw.d < 38;
    txt.innerHTML = `<b>${sw.name}</b> · ${fmtMi(sc.sw.d)}<br><span class="sub">Lined for ${sw.lined}${sw.state ? ' · ' + sw.divLimit + ' mph' : ''}</span>`;
    $('swMiniTxt').textContent = `${sw.name} ${fmtMi(sc.sw.d)} → ${sw.lined}`;
    $('btnThrow').disabled = near; $('btnThrowMini').disabled = near;
  } else { lamp.className = 'none'; lm.style.background = '#445'; txt.innerHTML = '<b>No facing switch ahead</b>'; $('swMiniTxt').textContent = 'No switch ahead'; $('btnThrow').disabled = true; $('btnThrowMini').disabled = true; }
  if (sc.trail && sc.trail.d < 1200 && (!sc.sw || sc.trail.d < sc.sw.d)) txt.innerHTML += `<br><span class="sub" style="color:var(--approach)">Trailing ${sc.trail.sw.name} set against you in ${fmtMi(sc.trail.d)}</span>`;
  // signal
  const sl = $('sigLine');
  if (sc.signal && sc.signal.d < 3200) {
    const rev = sc.signal.sg.sg.sw.state === 1;
    sl.innerHTML = `<span class="aspect"><i style="background:${rev ? 'var(--stop)' : 'var(--clear)'}"></i><i style="background:${rev ? 'var(--clear)' : 'var(--stop)'}"></i></span> Signal ${fmtMi(sc.signal.d)}: <b style="color:var(--ink)">${rev ? 'Diverging Clear' : 'Clear'}</b>`;
  } else sl.innerHTML = '';
  // stop / water / coal
  const stl = $('stopLine');
  const act = nearbyService();
  if (act) stl.innerHTML = `<b>${act.label}</b> <button class="btn" id="btnService" style="padding:5px 8px;font-size:10px">${act.btn}</button>`;
  else if (sc.end && sc.end.d < 400) stl.innerHTML = `<span style="color:var(--stop)">End of track in <b style="color:var(--stop)">${fmtMi(sc.end.d)}</b></span>`;
  else if (sc.station && sc.station.d < 6000) stl.innerHTML = `Next: <b>${sc.station.st.name}</b> ${fmtMi(Math.max(0, sc.station.d))}`;
  else stl.innerHTML = '';
  const bs = $('btnService'); if (bs) bs.onclick = () => act.go();
}
function nearbyService() {
  const T = GAME.train; if (!T || !T.tender || Math.abs(S.v) > 0.3) return null;
  const tm = T.tender.root.matrixWorld;
  const hatch = new THREE.Vector3(6.675 - 10.6, 4, 0).applyMatrix4(tm), bunker = new THREE.Vector3(6.675 - 3.6, 4, 0).applyMatrix4(tm);
  for (const w of ROUTE.water) { const d = Math.hypot(hatch.x - w.p.x, hatch.z - w.p.z) - (w.kind === 'tower' ? 0 : 0); if (d < 6.5) { if (GAME.filling === 'water') return { label: 'Taking water…', btn: 'Stop', go: () => { GAME.filling = null; } }; return { label: 'Water spout over the hatch', btn: 'Take water', go: () => { GAME.filling = 'water'; } }; } }
  const c = ROUTE.coal; if (Math.hypot(bunker.x - c.p.x, bunker.z - c.p.z) < 6) { if (GAME.filling === 'coal') return { label: 'Coaling…', btn: 'Stop', go: () => { GAME.filling = null; } }; return { label: 'Under the coal chute', btn: 'Take coal', go: () => { GAME.filling = 'coal'; } }; }
  return null;
}

/* ---------------- main loop ---------------- */
let chuffQ = 0, pumpT = 0, bellT = 0, idleT = 0, chirpT = 2, prevV = 0, stopT = 0;
function loop() {
  requestAnimationFrame(loop);
  let dt = Math.min(clock.getDelta(), 0.05);
  const T = GAME.train; if (!T) return;
  const active = GAME.running && !S.paused && !S.derailed;
  if (active) simStep(dt, T);
  renderStep(dt, T);
}
function simStep(dt, T) {
  {
    const n = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / n;
    for (let i = 0; i < n; i++) {
      S.time += h;
      const d = physicsStep(h, T);
      if (d !== 0) {
        const mph = Math.abs(S.v) / MPH;
        const moved = T.move(d, {
          onNode: (node, from, to) => {
            const sw = node.sw; if (!sw) return;
            const div = from === sw.legs[1].edge || to === sw.legs[1].edge;
            if (div && mph > sw.divLimit * 1.75) GAME.derail(`Took the ${sw.name} turnout at ${Math.round(mph)} mph. The diverging route is good for ${sw.divLimit} mph.`);
            else if (div && mph > sw.divLimit + 4) toast(`Over turnout speed at ${sw.name}: ${Math.round(mph)} mph (limit ${sw.divLimit}).`, 'warn', 3000, 'tov');
          },
          onRunThrough: sw => { GAME.stats.runThrough++; toast(`Ran through ${sw.name}. The points were forced over.`, 'bad', 3800, 'rt' + sw.id); },
          onBlocked: () => {
            const mph2 = Math.abs(S.v) / MPH;
            if (mph2 > 7) GAME.derail(`Hit the bumping post at ${Math.round(mph2)} mph. Bumpers are rated for a gentle shove, about 5 mph.`, 'Collision');
            else { if (mph2 > 1) sndClunk(1, 0); S.v = 0; S.vw = 0; toast('Stopped against the bumping post.', 'warn', 2500, 'bump'); }
          },
        });
        T.dist += moved; S.odo += Math.abs(moved);
      }
    }
    // curve overspeed (lateral acceleration at the lead truck)
    const lead = T.vehicles[0].leadPt.tp, k = Math.abs(lead.e.curv(lead.s));
    const lat = S.v * S.v * k;
    if (lat > 2.7) GAME.derail(`Overturned on the curve at ${Math.round(Math.abs(S.v) / MPH)} mph.`);
    else if (lat > 1.75) toast('Too fast for this curve!', 'warn', 2000, 'curve');
    // filling at water column / coal chute
    if (GAME.filling) {
      if (!nearbyService()) GAME.filling = null;
      else if (GAME.filling === 'water') { S.water = Math.min(83280, S.water + 240 * dt); if (S.water >= 83279) { GAME.filling = null; toast('Tender full: 22,000 gallons.', 'good'); } }
      else { S.coal = Math.min(19958, S.coal + 300 * dt); if (S.coal >= 19957) { GAME.filling = null; toast('Coal bunker full: 22 tons.', 'good'); } }
    }
    // station stop detection
    if (Math.abs(S.v) < 0.05) { stopT += dt; if (stopT > 1.2) stationStop(T); } else stopT = 0;
    // start-up slack
    if (Math.abs(prevV) < 0.02 && Math.abs(S.v) >= 0.02 && AU.on) { const cp = camera.position; T.vehicles.forEach((v, i) => { if (i < 2) return; const dd = v.pos.distanceTo(cp); sndClunk(0.7 / (1 + (dd / 25) ** 1.3), (i - 2) * 0.07); }); }
    prevV = S.v;
    if (S.MR < 60 && S.brakeH < 0.18) toast('Main reservoir low: let the pump catch up.', 'warn', 3000, 'mr');
    if (S.lowWater) toast('Water low in the glass! Work the injector.', 'bad', 2500, 'lw');
    if (S.P < 150 && Math.abs(S.v) > 1) toast('Steam pressure falling. Shorten the cutoff or ease off.', 'warn', 3000, 'lp');
  }
}
function renderStep(dt, T) {
  // visuals
  updateSwitchVisuals(dt); updateSignals();
  T.update(dt, S.theta, S.reverser);
  // headlight & glows
  const night = SKY.night;
  T.head.intensity = S.light === 0 ? 0 : (S.light === 1 ? (night ? 1.6 : 0.4) : (night ? 6 : 1.4));
  RMAT.lens.color.setScalar(S.light === 0 ? 0.25 : (S.light === 1 ? 0.75 : 1.0));
  const flick = 0.85 + 0.15 * Math.sin(S.time * 23) * Math.sin(S.time * 7.3);
  if (T.diesel) {
    T.fireLight.intensity = 0;
    if (S.whistle > 0.05 || S.bell) S.ditchFlash = 15;
    S.ditchFlash = Math.max(0, S.ditchFlash - dt);
    const ph = Math.floor(S.time * 2.6) % 2, on = S.ditch && S.light > 0;
    const lv = (k) => !on ? 0.12 : (S.ditchFlash > 0 ? (ph === k ? 1 : 0.15) : 0.85);
    T.loco.ditch.forEach((d, k) => { const b = lv(k); d.lens.material.color.setScalar(0.25 + 0.75 * b); d.halo.material.opacity = b * (night ? 1 : 0.45); });
  } else T.fireLight.intensity = S.fire * (night ? 2.4 : 0.18) * flick * (CAM.mode === 'cab' ? 1 : 0.6);
  T.loco.beam.material.opacity = S.light === 0 ? 0 : (night ? (S.light === 2 ? 0.075 : 0.035) : (SKY.weather !== 'clear' ? 0.02 : 0));
  T.loco.halo.material.opacity = S.light === 0 ? 0 : (night ? 1 : 0.35) * (S.light === 2 ? 1 : 0.6);
  if (!T.diesel) {
    T.loco.fire.material.color.setRGB(1 * flick, 0.45 * S.fire * flick + 0.1, 0.1);
    T.loco.ash.material.opacity = night ? 0.35 * S.fire * flick : 0;
  }
  const pb = $('btnWhistle').querySelector('.pull i'), pw = Math.round(S.whistle * 100) + '%'; if (pb.style.width !== pw) pb.style.width = pw;
  T.cabLight.intensity = night ? 0.6 : 0;
  // camera
  updateCamera(camera, T, dt);
  if (CAM.shakeHit) { camera.position.x += (Math.random() - 0.5) * CAM.shakeHit; camera.position.y += (Math.random() - 0.5) * CAM.shakeHit; CAM.shakeHit = Math.max(0, CAM.shakeHit - dt * 1.5); }
  if (!GAME.running) { // attract mode orbit while the menu is up
    CAM.yaw = -0.95 + Math.sin(S.time * 0.05 + performance.now() * 0.00005) * 0.55; CAM.mode = 'chase'; CAM.dist = 21; CAM.pitch = 0.09;
  }
  // sky follows camera
  SKY.dome.position.copy(camera.position); SKY.stars.position.copy(camera.position);
  SKY.clouds.position.set(camera.position.x, camera.position.y + 1600, camera.position.z);
  SKY.clouds.material.map.offset.x += dt * 0.0006; SKY.clouds.material.map.offset.y += dt * 0.0003;
  SKY.moon.position.copy(SKY.sunDir).multiplyScalar(7000).add(camera.position);
  const lp = T.vehicles[0].pos;
  SKY.sun.target.position.copy(lp); SKY.sun.position.copy(lp).addScaledVector(SKY.sunDir, 300);
  updateTrackLOD(camera); updateDetailLOD(camera, scene, dt);
  // effects & sound
  effectsAndSound(dt, T);
  updateFX(dt, camera);
  if (GAME.running) updateHUD(dt);
  renderer.render(scene, camera);
}

function stationStop(T) {
  const cab = T.worldOf(new THREE.Vector3(T.loco.cabEye.x, 0, 0));
  for (const st of ROUTE.stations) {
    const d = cab.distanceTo(st.p); if (d > 120) continue;
    if (GAME.lastStation === st.name) return;
    GAME.lastStation = st.name;
    const along = _v1.subVectors(cab, st.p).dot(T.vehicles[0].fwd);
    const ft = Math.round(Math.abs(along) / FT);
    const grade = ft < 25 ? 'right on the mark' : ft < 80 ? `${ft} ft ${along > 0 ? 'past' : 'short of'} the mark` : `${ft} ft ${along > 0 ? 'past' : 'short of'} the platform`;
    toast(`Stopped at ${st.name}: ${grade}.`, ft < 80 ? 'good' : 'warn', 4500);
    return;
  }
  GAME.lastStation = null;
}

function steamFX(dt, T, tv) {
  const L = T.loco;
  const n = Math.abs(S.vw) / DRIVER_C;
  const stack = T.worldOf(L.stackPos);
  const working = S.Psc > 6 && S.cut > 0 && S.throttle > 0.02;
  const intensity = clamp((S.Psc / 245) * (0.35 + S.cut * 1.25), 0, 1.3);
  // exhaust beats: four per driver revolution
  const q = Math.floor(-S.theta / (Math.PI / 2));
  if (q !== chuffQ) {
    const steps = Math.min(6, Math.abs(q - chuffQ));
    for (let i = 0; i < steps; i++) {
      const k = q - i;
      if (working) {
        sndChuff(k, n, intensity * (0.6 + 0.4 * Math.min(1, n * 1.2)) * (S.priming ? 0.7 : 1));
        const smokiness = clamp(0.25 + (S.stoker - S.fire * 0.75) * 1.4 + intensity * 0.2, 0.08, 0.85), gv = lerp(0.9, 0.24, smokiness);
        for (let j = 0; j < 3; j++) emit(stack, new THREE.Vector3(tv.x + (Math.random() - 0.5) * 1.5, 7 + 13 * intensity + Math.random() * 3, tv.z + (Math.random() - 0.5) * 1.5), 4 + Math.random() * 3 + intensity * 2, 1.1, 7 + intensity * 7, 0.55 + 0.25 * intensity, [gv, gv * 0.98, gv * 0.95], 0.9, 1.1);
        if (S.priming) emit(stack, new THREE.Vector3(tv.x, 9, tv.z), 2.5, 0.8, 5, 0.6, [0.95, 0.96, 0.98], 0.2, 1.2);
        if (S.cocks) for (const cp of L.cockPos) { const p = T.worldOf(cp); const side = new THREE.Vector3(0, 0, Math.sign(cp.z) * (4 + Math.random() * 3)).applyQuaternion(_cq.setFromRotationMatrix(_cm.extractRotation(L.root.matrixWorld))); emit(p, new THREE.Vector3(tv.x + side.x + T.vehicles[0].fwd.x * 3, -0.6, tv.z + side.z + T.vehicles[0].fwd.z * 3), 1.1 + Math.random() * 0.4, 0.4, 3.2, 0.7, [0.95, 0.95, 0.97], 0.4, 1.6); }
      } else if (k % 2 === 0 && n > 0.15) sndClank(n);
    }
    chuffQ = q;
  }
  idleT += dt;
  if (idleT > 0.09) {
    idleT = 0;
    const a = 0.18 * (S.fire + S.blower * 0.8) * (working ? 0.4 : 1);
    if (a > 0.02) emit(stack, new THREE.Vector3(tv.x, 2.5 + S.blower * 6, tv.z), 5 + Math.random() * 2, 1.0, 5.5, a, [0.55, 0.53, 0.5], 0.7, 0.9);
    if (S.injector && Math.random() < 0.6) emit(T.worldOf(L.injPos), new THREE.Vector3(tv.x, -0.4, tv.z), 0.9, 0.3, 1.5, 0.35, [0.95, 0.95, 0.97], 0.3, 1.5);
  }
  if (S.safety) for (let j = 0; j < 2; j++) emit(T.worldOf(L.safetyPos), new THREE.Vector3(tv.x + (Math.random() - 0.5), 16 + Math.random() * 6, tv.z), 2.2, 0.5, 5, 0.7, [0.97, 0.97, 0.99], 0.3, 1.4);
  if (S.whistle > 0.05 && Math.random() < 0.8) emit(T.worldOf(L.whistlePos), new THREE.Vector3(tv.x * 0.8, 6 + S.whistle * 6, tv.z * 0.8), 1.6, 0.35, 3.2, 0.55 * S.whistle, [0.97, 0.97, 0.99], 0.4, 1.4);
  if (S.pumping && S.P > 50) { pumpT += dt; if (pumpT > 0.52) { pumpT = 0; GAME.pumpPh = (GAME.pumpPh || 0) + 1; sndPump(GAME.pumpPh); if (GAME.pumpPh % 2) emit(T.worldOf(L.pumpPos), new THREE.Vector3(tv.x, 2.5, tv.z), 1.2, 0.3, 1.6, 0.35, [0.93, 0.93, 0.95], 0.6, 1.2); } }
  return { src: stack, working };
}
let dslPuff = 0, dslNotch = 0, crankT = 0;
function dieselFX(dt, T, tv) {
  const L = T.loco;
  const stack = T.worldOf(L.stackPos);
  if (S.notch > dslNotch && S.engineRun) dslPuff = Math.min(2.2, dslPuff + 0.9);
  dslNotch = S.notch;
  dslPuff = Math.max(0, dslPuff - dt);
  idleT += dt;
  const rf = clamp((S.rpm - 200) / 704, 0, 1);
  if (idleT > 0.07 && S.rpm > 60) {
    idleT = 0;
    const dark = Math.min(1, dslPuff * 0.6 + (S.crank > 0 ? 0.8 : 0)), gv = lerp(0.62, 0.16, dark);
    const a = 0.12 + 0.25 * rf * S.load + 0.45 * dark;
    emit(stack, new THREE.Vector3(tv.x + (Math.random() - 0.5) * 0.6, 4 + 9 * rf + 6 * dark, tv.z + (Math.random() - 0.5) * 0.6), 2.5 + Math.random() * 1.5 + dark * 2, 0.7, 3.5 + 3 * rf + 3 * dark, a, [gv, gv, gv * 1.02], 0.5, 1.1);
  }
  if (S.crank > 0) { crankT += dt; if (crankT > 0.32) { crankT = 0; sndCrank(); } }
  if (S.pumping && S.engineRun) { pumpT += dt; if (pumpT > 0.4) { pumpT = 0; GAME.pumpPh = (GAME.pumpPh || 0) + 1; if (GAME.pumpPh % 2) sndPump(GAME.pumpPh); } }
  return { src: T.worldOf(L.enginePos), working: S.load > 0.05 };
}
function effectsAndSound(dt, T) {
  const L = T.loco, DSL = T.diesel;
  const tv = new THREE.Vector3().copy(T.vehicles[0].fwd).multiplyScalar(S.v);
  const fx = DSL ? dieselFX(dt, T, tv) : steamFX(dt, T, tv);
  const working = fx.working;
  if (S.bell) { bellT += dt; if (bellT > (DSL ? 1.05 : 0.86)) { bellT = 0; sndBell(DSL); } } else bellT = 0.8;
  if (!AU.on) return;
  // mix
  const cp = camera.position, dLoco = cp.distanceTo(fx.src), inCab = CAM.mode === 'cab';
  const gL = inCab ? 0.85 : 1 / (1 + Math.pow(dLoco / 26, 1.25));
  setG(AU.loco, gL, 0.08); AU.locoLP.frequency.setTargetAtTime(inCab ? 7000 : clamp(16000 / (1 + dLoco / 80), 1200, 16000), AU.ctx.currentTime, 0.1);
  setG(AU.blower.g, DSL ? 0 : S.blower * 0.22); setG(AU.safety.g, !DSL && S.safety ? 0.5 : 0, 0.15); setG(AU.injector.g, !DSL && S.injector ? 0.1 : 0, 0.2);
  setG(AU.cocks.g, !DSL && S.cocks && Math.abs(S.v) < 0.5 && S.throttle > 0.02 ? 0.25 * S.throttle : 0);
  setG(AU.roar.g, 0.32 * Math.min(1, Math.abs(S.v) / 22));
  setG(AU.drift.g, !DSL && !working && Math.abs(S.v) > 1 ? 0.08 * Math.min(1, Math.abs(S.v) / 12) : 0);
  setG(AU.wind.g, inCab ? 0.32 * Math.min(1, (Math.abs(S.v) / 30) ** 2) + 0.02 : 0.03);
  setG(AU.firedoor.g, !DSL && inCab ? 0.14 * S.fire : 0);
  updateDieselAudio(DSL, inCab);
  const b0 = T.vehicles[0].brake;
  setG(AU.bpExhaust.g, b0.dBP < -0.3 ? Math.min(0.5, -b0.dBP * 0.06) : 0, 0.05);
  const lead = T.vehicles[0].leadPt.tp, kk = Math.abs(lead.e.curv(lead.s));
  const gw = 1 / (1 + Math.pow(cp.distanceTo(T.vehicles[0].pos) / 30, 1.3));
  setG(AU.flange.g, kk > 1 / 320 && Math.abs(S.v) > 1.5 ? 0.05 * Math.min(1, Math.abs(S.v) / 8) * gw : 0, 0.2);
  const bcAvg = T.vehicles.reduce((a, v) => a + v.brake.BC, 0) / T.vehicles.length;
  setG(AU.bsq.g, bcAvg > 15 && Math.abs(S.v) > 0.3 && Math.abs(S.v) < 9 ? 0.035 * gw : 0, 0.15);
  // whistle / horn with doppler
  if (AU.whistle) {
    const src = T.worldOf(DSL ? L.hornPos : L.whistlePos);
    const toCam = new THREE.Vector3().subVectors(cp, src); const dist = toCam.length(); toCam.normalize();
    const vr = inCab ? 0 : tv.dot(toCam);
    const dop = 343 / (343 - clamp(vr, -60, 60));
    const pull = S.whistle;
    const gwh = (inCab ? 0.55 : 1 / (1 + Math.pow(dist / 90, 1.1))) * Math.pow(pull, DSL ? 0.5 : 0.8) * 0.95;
    setG(AU.whistle.out, gwh, DSL ? 0.02 : 0.035);
    const bend = DSL ? 1 : (0.94 + 0.06 * pull);
    for (const v of AU.whistle.voices) { const f = v.f * bend * dop; v.o1.frequency.setTargetAtTime(f, AU.ctx.currentTime, 0.04); v.o2.frequency.setTargetAtTime(f * v.ratio2, AU.ctx.currentTime, 0.04); }
    AU.whistle.lp.frequency.setTargetAtTime(inCab ? 3200 : clamp(11000 / (1 + dist / 160), 1800, 7000), AU.ctx.currentTime, 0.1);
  }
  // rail joints for nearby trucks
  if (Math.abs(S.v) > 0.6) {
    const mem = GAME.jointMem;
    for (const v of T.vehicles) {
      const dv = v.pos.distanceTo(cp); if (dv > 110 && !(inCab && v.kind === 'loco')) continue;
      const g = Math.min(1, Math.abs(S.v) / 7) / (1 + Math.pow((inCab ? Math.max(4, dv) : dv) / 13, 1.4));
      const pts = v.kind === 'loco' ? (DSL ? [[v.fp[0], 3, DG.axle], [v.fp[1], 3, DG.axle]] : [[v.leadPt, 1, 0], [v.fp[0], 4, 1.855]]) : v.tp.map((p, i) => [p, v.trucks[i].type === 'six' ? 3 : 2, v.trucks[i].type === 'six' ? 1.676 : 1.73]);
      for (const [p, axles, sp] of pts) {
        const j = Math.floor(p.tp.s / 11.89), key = p, prev = mem.get(key);
        if (prev && prev.e === p.tp.e && prev.j !== j) { for (let a = 0; a < axles; a++) sndJoint(g * (a === 0 ? 1 : 0.8), a * sp / Math.abs(S.v)); }
        mem.set(key, { e: p.tp.e, j });
      }
    }
  }
  chirpT -= dt; if (chirpT < 0) { chirpT = 1.5 + Math.random() * (SKY.night ? 2 : 5); if (!inCab && !SKY.snow) sndChirp(SKY.night); }
}

GAME.snapshot = function () {
  const T = GAME.train; if (!T) return {};
  const f = T.frontTP();
  return { running: GAME.running, settings: { ...GAME.settings }, sw: NET.switches.map(s => s.state), front: { e: f.e.id, s: f.s, o: f.o }, S: { v: S.v, P: S.P, W: S.W, water: S.water, coal: S.coal, throttle: S.throttle, reverser: S.reverser, brakeH: S.brakeH, indH: S.indH }, cam: CAM.mode };
};
GAME.restore = function (d) {
  try {
    Object.assign(GAME.settings, d.settings);
    makeTrain(); GAME.train.consistKey = GAME.settings.consist;
    NET.switches.forEach((s, i) => { s.state = s.anim = d.sw[i] || 0; });
    const e = NET.edges.find(x => x.id === d.front.e);
    if (e) GAME.train.place(new TrackPos(e, d.front.s, d.front.o));
    Object.assign(S, d.S); S.vw = S.v;
    applyLook(GAME.settings.time, GAME.settings.weather, renderer, scene);
    cycleCamera(d.cam);
    GAME.running = true; $('menu').hidden = true; $('hud').hidden = false;
    for (const k of ['optLoco', 'optTrain', 'optTime', 'optWeather', 'optFire']) { const key = { optLoco: 'loco', optTrain: 'consist', optTime: 'time', optWeather: 'weather', optFire: 'fire' }[k]; [...$(k).children].forEach(c => c.setAttribute('aria-pressed', String(c.id === k + '_' + GAME.settings[key]))); }
    setTimeout(drawLeverTicks, 50);
  } catch (err) { console.warn('restore failed', err); }
};
boot();

/* ============================================================================
   Game: boot, world loading, main loop, rules, HUD
   ========================================================================== */
const GAME = {
  settings: { traffic: 'on', loco: '765', consist: 'passenger', time: 'morning', cycle: 'x30', weather: 'clear', fire: 'auto', units: 1, livery: 'ss', mix: false, finish: 'standard', job: '', custom: { body: 0x2c5f8a, roof: 0x24384a, accent: 0xf0f0ea, letter: 0xf0f0ea, rail: 0xf0f0ea }, number: 4401, coach: 'pullman', coachColor: 0x2a3a2a },
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
  WORLD.custom = !!PLAY_LAYOUT;
  if (WORLD.custom) { WORLD.roadsX = []; WORLD.roadN = 1e7; buildLayoutRoute(PLAY_LAYOUT); }
  else if (ROUTE_KEY === 'laurel') { WORLD.roadsX = []; WORLD.roadN = 1e7; buildMountainRoute(); mtPrepare(); }
  else buildRoute();
  mapPrepare();
  prog(0.06, 'Grading the right of way…'); await frame();
  buildLattice();
  detailTextures(); planTowns();
  const T = 1500; let k = 0; const tot = ((INNER.x1 - INNER.x0) / T) * ((INNER.n1 - INNER.n0) / T);
  for (let x = INNER.x0; x < INNER.x1; x += T) for (let n = INNER.n0; n < INNER.n1; n += T) {
    buildTerrainTile(x, n, T, INNER.step, scene, !!WORLD.mtn); k++;
    if (k % (WORLD.mtn ? 24 : 3) === 0) { prog(0.08 + 0.42 * k / tot, WORLD.mtn ? `Raising the mountains… ${k}/${tot}` : `Shaping farm country… ${k}/${tot}`); await frame(); }
  }
  WORLD.hgrid.ready = true;
  buildFarTerrain(scene); if (!WORLD.custom) buildWater(scene);
  prog(0.52, WORLD.custom ? `Laying ${fmtMi(ROUTE.mainLen)} of track on ${PLAY_LAYOUT.name || 'your layout'}…` : `Laying ${(ROUTE.mainLen / MILE).toFixed(1)} miles of jointed rail…`); await frame();
  buildTrack(scene); buildTrackHash();
  prog(0.68, WORLD.mtn ? 'Boring Summit tunnel and raising the Bear Run trestle…' : 'Raising depots, towers and the river bridge…'); await frame();
  if (WORLD.custom) { buildStations(); buildSignals(scene); }
  else if (WORLD.mtn) { buildStations(); buildBridge(scene); mtBuildViaduct(scene); mtBuildTunnels(scene); buildSignals(scene); buildSigns(); }
  else { buildStations(); buildBridge(scene); buildRoads(scene); buildSignals(scene); buildSigns(); }
  prog(0.78, 'Stringing the pole line…'); await frame();
  if (WORLD.custom) { SCN.farms = []; buildTowns(scene); }
  else if (WORLD.mtn) { SCN.farms = []; buildTowns(scene); buildPoleLine(scene); }
  else { buildFarms(); buildTowns(scene); buildPoleLine(scene); }
  if (!WORLD.mtn) {
    prog(0.82, 'Planting corn and fencing pastures…'); await frame();
    buildCorn(scene); buildPastureLife(scene);
  }
  prog(0.86, WORLD.mtn ? 'Growing the forest…' : 'Planting woodlots…'); await frame();
  if (WORLD.mtn) mtBuildForest(scene); else buildTrees(scene);
  finalizeScenery(scene);
  prog(0.92, 'Lighting the fire…'); await frame();
  buildSky(scene, renderer); buildFX(scene); buildSparks(scene); buildLamps(scene);
  for (const st of ROUTE.stations) { st.edge.pose(st.s, FR); st.p = FR.p.clone(); }
  for (const w of ROUTE.water) { w.edge.pose(w.s, FR); w.p = FR.p.clone(); }
  if (ROUTE.coal) { const c = ROUTE.coal; c.edge.pose(c.s, FR); c.p = FR.p.clone(); }
  setupViewInput($('gl'), camera); PLACE.setup($('gl')); setupLevers(); setupButtons(); setupMap();
  linearizeObject(scene);
  makeTrain();
  applyLook(GAME.settings.time, GAME.settings.weather, renderer, scene);
  prog(1, WORLD.custom ? `${PLAY_LAYOUT.name || 'Your layout'} · ${fmtMi(ROUTE.mainLen)} of track · ${NET.switches.length} switches` : `${(ROUTE.mainLen / MILE).toFixed(1)} mi mainline · ${NET.switches.length} switches · ${WORLD.treeCount.toLocaleString()} trees`);
  GAME.ready = true;
  $('btnStart').disabled = false;
  MP.worldReady();
  SAVE.setup(); SAVE.ready();
  const hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) hot.snapshot(() => GAME.snapshot());
  const resume = data => { if (data && data.running) GAME.restore(data); };
  if (hot && hot.ready) hot.ready(resume); else resume(hot && hot.data ? hot.data : {});
  requestAnimationFrame(loop);
}

function resetState() {
  Object.assign(S, { throttle: 0, reverser: 0, brakeH: 0.12, indH: 0.6, sander: false, cocks: true, bell: false, light: SKY.night ? 2 : 1, injector: false, blower: 0.35, stoker: 0.45, whistle: 0,
    v: 0, vw: 0, slip: false, slide: false, slideN: 0, theta: 0, odo: 0, P: 238, Psc: 0, W: 0.62, fire: 0.55, coal: 19958, water: 83280, sand: 1800, MR: 140, ER: 90, pumping: false,
    safety: false, lowWater: false, priming: false, dead: false, derailed: false, paused: false });
  S.autoFire = GAME.settings.fire === 'auto';
  Object.assign(S, { notch: 0, dyn: 0, dbLoad: 0, DBF: 0, rpm: 300, engineRun: true, crank: 0, load: 0, fuel: 18927, turbo: 0.15, ditch: true, ditchFlash: 0, slipCtl: false, amps: 0 });
  Object.assign(S, { pan: 1, panUp: true, vcb: true, vcbT: 0, kW: 0, kWh: 0, rbMax: 0, blend: 0 });   // a trainset comes with its pantograph up and the breaker in
  if (LOCO_SPEC[GAME.settings.loco].diesel) { S.cocks = false; S.light = SKY.night ? 2 : 2; }
}
function makeTrain() {
  CARS.clear(GAME.train);
  if (GAME.train) GAME.train.dispose();
  const t = new Train(scene, GAME.settings.loco, JOB.consist(), dieselOpts());
  GAME.train = t;
  if (WORLD.custom) { placeOnLayout(t); return; }
  let line = ROUTE.startLine, sFront = line.len - 175, o = 1;
  GAME.spawnName = WORLD.mtn ? 'Riverton 2, Riverton Yard' : 'Yard 2, Bellevue';
  const job = JOB.wanted(), sp = job && JOB.spawn(job);
  if (MP.on) {
    // in a room the switches belong to everyone, so leave them alone and find an empty track
    const slot = MP.spawnSlot(t);
    if (slot) { line = slot.line; sFront = slot.s; GAME.spawnName = slot.name; }
    MP.spawned = true; MP.needSpawn = false; MP.dirty = true;
  } else {
    const sw = name => NET.switches.find(s => s.name === name);
    for (const s of NET.switches) { s.state = 0; s.anim = 0; }
    // a job says where its train is made up and how the switches are lined
    for (const n of sp ? sp.lined : WORLD.mtn ? ['Riverton ladder E2', 'Riverton East'] : ['Yard ladder E2', 'Bellevue East']) sw(n).state = sw(n).anim = 1;
    if (sp) { line = sp.line; sFront = sp.s; o = sp.o; GAME.spawnName = sp.name; }
  }
  const loc = line.locate(sFront);
  t.place(new TrackPos(loc.edge, loc.s, o));
  if (sp && sp.cabAt) JOB.alignCab(t, sp.cabAt);
  finishTrain(t);
}
/* custom layout: the start marker, slid forward until the whole train is on the rails */
function placeOnLayout(t, light) {
  if (!MP.on) for (const s of NET.switches) { s.state = 0; s.anim = 0; }
  const st = layoutStart(PLAY_LAYOUT), need = t.length + 4;
  let tp = layoutFit(new TrackPos(st.edge, st.s, st.o), need);
  GAME.spawnName = PLAY_LAYOUT.name || 'your layout';
  if (!tp && !light && GAME.settings.consist !== 'light') {
    t.dispose();
    toast('That train is longer than the track, so you have a light engine.', 'warn', 5200);
    const t2 = new Train(scene, GAME.settings.loco, 'light', dieselOpts()); GAME.train = t2; placeOnLayout(t2, true); return;
  }
  if (MP.on) {
    // in a room, find a stretch of track no other train is on
    const slot = MP.layoutSlot(need); if (slot) tp = slot;
    MP.spawned = true; MP.needSpawn = false; MP.dirty = true;
  }
  t.place(tp || new TrackPos(st.edge, st.s, st.o));
  finishTrain(t);
}
/* slide a front position forward until `need` metres of track lie behind it; null if the track is too short */
function layoutFit(tp, need) {
  const room = dir => { let d = Infinity; peekPath(tp, dir, 20000, (node, dd) => { if (!node) { d = dd; return true; } }); return d; };
  const behind = room(-1), ahead = room(1);
  if (behind + ahead < need + 8) return null;
  if (behind < need) tp.advance(Math.min(need - behind, Math.max(0, ahead - 6)), null);
  return tp;
}
function finishTrain(t) {
  prepareTrain(t);
  CARS.setup();
  AI.setup();
  if (!t.diesel) applySteamFinish(GAME.settings.finish);
  applyCoachPaint(GAME.settings.coach, GAME.settings.coachColor);
  resetState();
  S.limit = Math.min(...t.pts.map(p => p.tp.e.limit));
  buildWhistleIfReady();
  CAM.init = false;
  GAME.jointMem = new Map();
  GAME.spawnAt = performance.now();
}
/* colour-space fix-up and fresh brakes for a newly built train (ours or another player's) */
function prepareTrain(t, keepBrakes) {
  for (const v of t.vehicles) linearizeObject(v.root);
  if (t.diesel) t.units.forEach(m => m.trucks.forEach(linearizeObject)); else linearizeObject(t.loco.leadTruck);
  for (const im of t.inst) linearizeObject(im);
  if (!keepBrakes) for (const v of t.vehicles) v.brake = { AR: 90, BC: 0, BP: 90, emerg: false, released: true };
}
/* Change the engine or the train from the menu without making up a new train in the yard. The coupler
   between the engine and its train stays where it is (the train slides a little if the new one would
   run into cars or the end of the track), cars picked up in the yard stay coupled, and the speed, air
   and switches carry on. Returns false when there is no room, so New train makes it up in the yard. */
GAME.swapLive = function () {
  const old = GAME.train, g = GAME.settings, j = JOB.wanted();
  if (!GAME.ready || !old) return false;
  if (!GAME.running) { if (!MP.on) makeTrain(); return true; }   // the train on show behind the menu
  if (LOCO_SPEC[g.loco].set && JOB.activeId()) toast('A trainset cannot work this job. Resume makes up the trainset and ends the job, or pick a steam or diesel engine to stay on it.', 'warn', 6000, 'swap');
  if (MP.needSpawn || (j ? j.id : '') !== JOB.activeId()) return false;
  const ck = JOB.consist(), units = +g.units || 1, setNew = !!LOCO_SPEC[g.loco].set;
  const tw = LOCO_SPEC[g.loco].diesel ? '' : trimWanted(), newTrim = !LOCO_SPEC[g.loco].diesel && (old.trim || '') !== tw;
  const newLoco = old.locoKey !== g.loco || (old.diesel && !old.elec && old.nUnits !== units) || newTrim;
  // a trainset is the whole train: it drops the cars it replaces, and the cars come back when an engine replaces it
  const newCars = setNew ? newLoco : old.elec ? ck !== 'light' || newLoco : old.consistKey !== ck;
  if (!newLoco && !newCars) return true;
  if (setNew && old.vehicles.some(v => v.yard)) { toast('Set out the cars you picked up first: a trainset cannot haul them. Or press New train.', 'warn', 5200, 'swap'); return false; }
  const t = new Train(scene, g.loco, ck, dieselOpts());
  const power = t.vehicles.filter(isPower), built = t.vehicles.filter(v => !isPower(v));
  // a new road reletters the cars that came with the train
  const road = LOCO_SPEC[g.loco].short !== LOCO_SPEC[old.locoKey].short || newTrim;
  const V = newCars || !road ? old.vehicles : old.vehicles.map(v => v.made && !v.yard ? relettered(t, old, v) : v);
  const plan = CARS.swapPlan(V, power, newCars ? built : null);
  // room around the joint that stays put: the end of the track, standing cars, other players' trains
  const anchor = old.endTP('front'); anchor.advance(-plan.a0, null);
  const room = dir => { const max = plan.length + 60, a = anchor.clone(), left = Math.abs(a.advance(dir * max, null)); return Math.min(max - left, CARS.clearance(anchor, dir, max, old) - 0.5); };
  const lo = plan.length - plan.a1 - room(-1), hi = room(1) - plan.a1;
  const front = anchor.clone(); front.advance(plan.a1 + clamp(0, lo, hi), null);
  if (lo > hi || !MP.clearOf(front, plan.length)) {
    for (const v of V) if (!old.vehicles.includes(v)) { scene.remove(v.root); freeVehicle(v); }
    t.disposeDeep(); ROAD_SHORT = LOCO_SPEC[old.locoKey].short;
    toast(`${lo > hi ? (plan.length > old.length ? 'No room here for a longer train.' : 'No room here to make the change.') : 'Another train is in the way.'} Press New train to make it up in the yard.`, 'warn', 5200, 'swap');
    return false;
  }
  // build the new train out of the old one
  for (const v of built) if (!plan.vehicles.includes(v)) scene.remove(v.root);
  const kept = plan.vehicles.filter(v => old.vehicles.includes(v)), lb = old.lead.brake;
  old.dispose();
  for (const v of kept) { scene.add(v.root); old.release(v); }
  for (const v of plan.vehicles) {
    if (!v.ptsAll) t.track(v);
    // the new engine and cars come on with the train's air
    if (t.vehicles.includes(v)) v.brake = { AR: lb.AR, BC: lb.BC, BP: lb.BP, emerg: lb.emerg, released: lb.released };
    t.markerLamps(v);
  }
  t.vehicles = plan.vehicles; t.consistKey = newCars || setNew ? ck : old.consistKey;
  t.layout(); t.buildInstances();
  t.place(front);
  prepareTrain(t, true);
  GAME.train = t;
  if (old.diesel !== t.diesel) carryOver();
  else if (old.locoKey !== t.locoKey) {
    S.throttle = 0; S.notch = 0; S.dyn = 0;
    // between a diesel and an electric set: the new power comes up running
    if (old.elec !== t.elec) Object.assign(S, { engineRun: true, crank: 0, rpm: 300, panUp: true, pan: 1, vcb: true, vcbT: 0 });
  }
  if (!t.diesel) applySteamFinish(g.finish);
  S.limit = Math.min(...t.pts.map(p => p.tp.e.limit));
  buildWhistleIfReady(); GAME.jointMem = new Map(); GAME.filling = null;
  t.update(0, S.theta, S.reverser);
  CARS.gen++; if (CARS.onChange) CARS.onChange();
  if (MP.on) MP.dirty = true;
  const what = t.elec ? `the ${HSR[LOCO_SPEC[g.loco].set].name}` : t.diesel ? (t.nUnits > 1 ? `${t.nUnits} diesels` : 'the diesel') : `${LOCO_SPEC[g.loco].short} ${g.loco}`, cars = { passenger: 'the passenger train', freight: 'the manifest freight' }[ck] || 'the train';
  if (newTrim && old.locoKey === g.loco && !newCars) toast(tw ? 'Dressed for the Polar Limited: wreaths, garland and snow on the roofs.' : 'Holiday trim taken down.', 'good', 3600, 'swap');
  else if (t.elec) toast(`Now running ${what}.`, 'good', 3200, 'swap');
  else if (old.elec) toast(`Now ${what} on ${cars}.`, 'good', 3200, 'swap');
  else toast(newLoco && newCars ? `Now ${what} on ${cars}.` : newLoco ? `${what[0].toUpperCase() + what.slice(1)} coupled on.` : ck === 'light' ? 'Cut off from the train: running light.' : `Now running ${cars}.`, 'good', 3200, 'swap');
  return true;
};
/* the same car, lettered for the road of train t */
function relettered(t, old, v) {
  const { type, num, flag } = v.made;
  const m = type === 'coach' ? coachModel(LOCO_SPEC[t.locoKey], num, flag, t.trim) : freightModel(type, num, rng(num));
  scene.add(m.root);
  const made = { ...v.made, rk: t.locoKey, rs: LOCO_SPEC[t.locoKey].short }; delete made.tr; if (type === 'coach' && t.trim) made.tr = t.trim;
  return Object.assign(carVehicle(m), { made, flip: v.flip, hb: v.hb, brake: v.brake, roll: old.dist * (v.flip ? -1 : 1) + (v.roll || 0) });
}
/* steam to diesel or back: the run keeps its speed, air and lights; the new engine comes with full
   supplies and its throttle shut, and the reverser keeps its direction */
function carryOver() {
  const keep = {}; for (const k of ['v', 'vw', 'odo', 'brakeH', 'indH', 'ER', 'MR', 'light', 'bell', 'sander', 'paused', 'derailed', 'theta']) keep[k] = S[k];
  const dir = Math.abs(S.reverser) > 0.03 ? Math.sign(S.reverser) : 0;
  resetState(); Object.assign(S, keep);
  S.reverser = GAME.isDiesel() ? dir : dir * 0.75;
}
function dieselOpts() {
  const g = GAME.settings, custom = g.livery === 'custom';
  return { units: +g.units || 1, livery: g.livery, mix: !!g.mix, custom: g.custom, number: custom ? (+g.number || 4401) : null, trim: trimWanted() };
}
function applyLiveriesLive() {
  const t = GAME.train; if (!t || !t.diesel) return;
  const o = dieselOpts();
  t.units.forEach((m, u) => { const lv = dieselLiveryFor(o, u); applyLivery(m, lv, (o.number || lv.num) + u); });
}
const SAVE_KEYS = ['job', 'traffic', 'loco', 'consist', 'time', 'cycle', 'weather', 'fire', 'units', 'livery', 'mix', 'finish', 'custom', 'number', 'coach', 'coachColor'];
function saveSettings() { try { const o = {}; for (const k of SAVE_KEYS) o[k] = GAME.settings[k]; localStorage.setItem('bd_settings', JSON.stringify(o)); } catch (e) {} }
function loadSettings() { try { const o = JSON.parse(localStorage.getItem('bd_settings') || 'null'); if (o) for (const k of SAVE_KEYS) if (o[k] !== undefined) GAME.settings[k] = o[k]; } catch (e) {} if (!LOCO_SPEC[GAME.settings.loco]) GAME.settings.loco = '765'; if (!LIVERIES[GAME.settings.livery]) GAME.settings.livery = 'ss'; if (!DN.starts[GAME.settings.time]) GAME.settings.time = 'morning'; if (!DN.rates[GAME.settings.cycle]) GAME.settings.cycle = 'x30'; if (!COACH_PAINT[GAME.settings.coach]) GAME.settings.coach = 'pullman'; }
GAME.needNewTrain = function () { const t = GAME.train, g = GAME.settings, j = JOB.wanted(); return !t || MP.needSpawn || t.locoKey !== g.loco || (!t.elec && t.consistKey !== JOB.consist()) || (j ? j.id : '') !== JOB.activeId() || (t.diesel && !t.elec && t.nUnits !== (+g.units || 1)) || (!t.diesel && (t.trim || '') !== trimWanted()); };
function buildWhistleIfReady() { if (!AU.on) return; buildWhistle(WHISTLES[LOCO_SPEC[GAME.settings.loco].whistle]); }

/* ---------------- menu ---------------- */
function segButtons(id, opts, key, onPick) {
  const host = $(id); host.innerHTML = '';
  for (const k in opts) {
    const b = document.createElement('button'); b.type = 'button'; b.id = id + '_' + k;
    b.innerHTML = (opts[k].swatch ? `<span class="sw" style="background:${opts[k].swatch}"></span>` : '') + `${opts[k].name}<small>${opts[k].sub}</small>`;
    b.setAttribute('aria-pressed', String(String(GAME.settings[key]) === k));
    b.addEventListener('click', () => { GAME.settings[key] = k; [...host.children].forEach(c => c.setAttribute('aria-pressed', String(c === b))); onPick && onPick(k); });
    host.appendChild(b);
  }
}
function buildMenu() {
  loadSettings();
  MP.init();
  const locoOpts = { '765': { name: 'NKP 765', sub: 'S-2 · Lima 1944' }, '1225': { name: 'PM 1225', sub: 'N-1 · Lima 1941' }, 'diesel': { name: 'Wide-cab diesel', sub: 'AC · 4,400 hp' },
    'e5': { name: 'E5 Shinkansen', sub: 'Bullet train · 200 mph' }, 'acela': { name: 'Acela Express', sub: 'High speed · 150 mph' } };
  // the mountain has no wires up for the high-speed sets
  if (ROUTE_KEY === 'laurel' && !PLAY_LAYOUT) { delete locoOpts.e5; delete locoOpts.acela; if (LOCO_SPEC[GAME.settings.loco].hs) GAME.settings.loco = '765'; }
  segButtons('optLoco', locoOpts, 'loco', () => { GAME.swapLive(); jobMenu(); specGrid(); startLabel(); refreshMenuGroups(); saveSettings(); });
  const livOpts = {}; for (const k in LIVERIES) { const L = LIVERIES[k]; livOpts[k] = { name: L.name, sub: L.sub, swatch: `linear-gradient(90deg, ${hexCss(k === 'custom' ? GAME.settings.custom.body : L.body)} 0 64%, ${hexCss(k === 'custom' ? GAME.settings.custom.accent : L.accent)} 64% 100%)` }; }
  segButtons('optLivery', livOpts, 'livery', () => { applyLiveriesLive(); refreshMenuGroups(); specGrid(); saveSettings(); });
  segButtons('optUnits', { 1: { name: '1 unit', sub: '4,400 hp' }, 2: { name: '2 units', sub: '8,800 hp' }, 3: { name: '3 units', sub: '13,200 hp' } }, 'units', k => { GAME.settings.units = +k; GAME.swapLive(); startLabel(); refreshMenuGroups(); saveSettings(); });
  segButtons('optMix', { matched: { name: 'Matched', sub: 'All one scheme' }, mixed: { name: 'Mixed', sub: 'Run-through power' } }, 'mixKey', k => { GAME.settings.mix = k === 'mixed'; applyLiveriesLive(); saveSettings(); });
  [...$('optMix').children].forEach(c => c.setAttribute('aria-pressed', String(c.id === 'optMix_' + (GAME.settings.mix ? 'mixed' : 'matched'))));
  segButtons('optFinish', { standard: { name: 'As delivered', sub: 'Graphite smokebox' }, white: { name: 'White trim', sub: 'Excursion style' }, black: { name: 'All black', sub: 'Plain' }, polar: { name: 'Polar Limited', sub: 'Holiday trim · wreaths & snow' } }, 'finish', k => { applySteamFinish(k); GAME.swapLive(); startLabel(); saveSettings(); });
  const coachSw = k => hexCss(coachPaintHex(k, GAME.settings.coachColor));
  const coachOpts = {}; for (const k in COACH_PAINT) coachOpts[k] = { name: COACH_PAINT[k].name, sub: COACH_PAINT[k].sub, swatch: coachSw(k) };
  segButtons('optCoach', coachOpts, 'coach', k => { applyCoachPaint(k, GAME.settings.coachColor); refreshMenuGroups(); saveSettings(); });
  $('cCoach').value = hexCss(GAME.settings.coachColor);
  $('cCoach').addEventListener('input', () => {
    GAME.settings.coachColor = parseInt($('cCoach').value.slice(1), 16);
    const sw = $('optCoach_custom').querySelector('.sw'); if (sw) sw.style.background = coachSw('custom');
    applyCoachPaint(GAME.settings.coach, GAME.settings.coachColor); saveSettings();
  });
  const cc = GAME.settings.custom;
  $('cBody').value = hexCss(cc.body); $('cAccent').value = hexCss(cc.accent); $('cLetter').value = hexCss(cc.letter); $('cNum').value = GAME.settings.number;
  const onCustom = () => {
    const c = GAME.settings.custom, v = id => parseInt($(id).value.slice(1), 16);
    c.body = v('cBody'); c.accent = v('cAccent'); c.letter = v('cLetter'); c.rail = c.accent;
    const shade = (h, k) => { const r = (h >> 16) & 255, g = (h >> 8) & 255, b = h & 255; return (Math.round(r * k) << 16) | (Math.round(g * k) << 8) | Math.round(b * k); };
    c.roof = shade(c.body, 0.78);
    const n = parseInt($('cNum').value, 10); if (n > 0 && n < 10000) GAME.settings.number = n;
    const sw = $('optLivery_custom').querySelector('.sw'); if (sw) sw.style.background = `linear-gradient(90deg, ${hexCss(c.body)} 0 64%, ${hexCss(c.accent)} 64% 100%)`;
    applyLiveriesLive(); saveSettings();
  };
  for (const id of ['cBody', 'cAccent', 'cLetter', 'cNum']) $(id).addEventListener('input', onCustom);
  refreshMenuGroups();
  segButtons('optTrain', Object.fromEntries(Object.entries(CONSISTS).filter(([, c]) => !c.hidden)), 'consist', () => { GAME.swapLive(); startLabel(); saveSettings(); });
  segButtons('optTime', DN.starts, 'time', k => { if (GAME.ready) applyLook(k, null); saveSettings(); });
  segButtons('optCycle', DN.rates, 'cycle', () => saveSettings());
  segButtons('optWeather', WEATHER, 'weather', k => { if (GAME.ready) { applyLook(null, k); FX.snow.visible = SKY.snow; } });
  segButtons('optFire', { auto: { name: 'Fireman', sub: 'Stoker & water handled' }, hand: { name: 'Hand fired', sub: 'You run the boiler' } }, 'fire', k => { S.autoFire = k === 'auto'; GAME.refreshKeys(); saveSettings(); });
  segButtons('optTraffic', { on: { name: 'Timetable', sub: ROUTE_KEY === 'laurel' ? 'No. 21, No. 22 and coal trains on the mountain' : 'No. 5, No. 12 and freights on the road' }, off: { name: 'Clear road', sub: 'Just you and the signals' } }, 'traffic', () => { if (GAME.ready && GAME.train) AI.setup(); saveSettings(); });
  specGrid();
  jobSetup();
  $('btnStart').addEventListener('click', () => GAME.start());
  $('bigRetry').addEventListener('click', () => GAME.rerail());
  $('bigMenu').addEventListener('click', () => { $('bigMsg').hidden = true; GAME.pause(true); });
}
function specGrid() {
  const s = LOCO_SPEC[GAME.settings.loco];
  const items = s.set === 'e5'
    ? [['10 cars', '8 motored, 2 trailers'], ['9,600 kW', '32 AC motors'], ['320 km/h', '199 mph'], ['253 m', 'Length'], ['454 t', 'Empty'], ['25 kV', 'Pantograph']]
    : s.set === 'acela' ? [['2 + 6', 'Power cars + coaches'], ['9,200 kW', '12,400 hp'], ['150 mph', 'In service'], ['664 ft', 'Length'], ['4.2°', 'Coach tilt'], ['99k lbf', 'Starting effort']]
    : s.diesel
    ? [['C-C', 'Wheel arrangement'], ['42 in', 'Wheels'], ['4,400 hp', 'V12 four-stroke'], ['73 ft 2 in', 'Length'], ['183k lbf', 'Starting effort'], ['5,000 gal', 'Fuel']]
    : [['2-8-4', 'Wheel arrangement'], ['69 in', 'Drivers'], ['25×34 in', 'Cylinders'], ['245 psi', 'Boiler'], [(s.te / 1000).toFixed(1) + 'k lbf', 'Tractive effort'], [s.cls + ' · ' + s.short, 'Class']];
  $('specGrid').innerHTML = items.map(([b, l]) => `<div><b>${b}</b><span>${l}</span></div>`).join('');
  const ht = $('helpText');
  if (ht) { if (!ht.dataset.steam) ht.dataset.steam = ht.innerHTML; ht.innerHTML = s.elec ? 'Release the <b>brake</b>, set the <b>reverser</b> forward and notch the <b>power</b> controller. The pantograph is up and the main breaker is in; <b>Pantograph</b> (I) drops it. Slow with the <b>regenerative brake</b>, which also blends in under the train brake. Out on the main a high-speed set runs at its own top speed, and each curve has its own posted limit: watch for it ahead.' : s.diesel ? 'Set the <b>reverser</b> forward, release the <b>engine brake</b>, then notch out the <b>throttle</b>. Every unit in the lashup answers the lead cab. Hold speed down the grades with the <b>dynamic brake</b>, and check the switch card before every turnout: diverging routes are 30 mph.' : ht.dataset.steam; }
  const ey = document.querySelector('.brandmark .eyebrow'); if (ey) ey.textContent = s.elec ? (s.set === 'e5' ? 'JR East · Shinkansen E5 series' : 'Amtrak · Acela Express') : s.diesel ? (GAME.settings.livery === 'custom' ? 'Custom paint' : LIVERIES[GAME.settings.livery].name) + ' · C-C diesel' : 'Lima Super Power · 2-8-4';
}
function startLabel() {
  const b = $('btnStart');
  if (!GAME.running) { b.textContent = 'Highball'; return; }
  b.textContent = GAME.needNewTrain() ? 'New train' : 'Resume';
}
function refreshMenuGroups() {
  const sp = LOCO_SPEC[GAME.settings.loco], d = !!sp.diesel && !sp.set;
  $('grpLivery').hidden = !d; $('grpUnits').hidden = !d; $('grpMix').hidden = !d || (+GAME.settings.units || 1) < 2;
  $('customPaint').hidden = !d || GAME.settings.livery !== 'custom';
  $('grpFinish').hidden = !!sp.diesel; $('optFire').parentElement.hidden = !!sp.diesel;
  $('optTrain').parentElement.hidden = !!sp.set;   // a trainset is its own train
  $('grpCoach').hidden = !!sp.set; $('coachPaint').hidden = GAME.settings.coach !== 'custom';
}

GAME.start = function () {
  // just joined a room: give the others a moment to report where their trains are before ours is made up
  const wait = MP.spawnWait();
  if (wait > 0) { $('btnStart').disabled = true; $('btnStart').textContent = 'Joining…'; setTimeout(() => { $('btnStart').disabled = false; GAME.start(); }, wait); return; }
  audioInit(); buildWhistleIfReady();
  if (!GAME.running || GAME.needNewTrain()) {
    const job = JOB.wanted();
    if (JOB.run) JOB.end();
    makeTrain();
    if (job) JOB.begin(job);
    else if (GAME.running) toast(`New train made up on ${WORLD.custom || WORLD.mtn ? GAME.spawnName : 'Yard 2'}.`, 'good');
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
  if (JOB.run) JOB.intro();
  else if (MP.on) setTimeout(() => toast(`Made up on ${GAME.spawnName}. The switches and the cars standing about are shared with everyone in the room.`, '', 5600), 600);
  else if (WORLD.custom) setTimeout(() => toast(`On ${GAME.spawnName}. Every switch is lined straight: tap one or use Throw to change it.`, '', 5000), 600);
  else if (WORLD.mtn) setTimeout(() => toast('Riverton Yard, at the foot of Laurel Mountain. The ladder is lined out to the main; the climb starts past Hollins and runs 1.9 per cent to Summit.', '', 6500), 600);
  else setTimeout(() => toast('Yard 2, Bellevue. The ladder is lined out to the main.', '', 5000), 600);
  if (!MP.on && !JOB.run && CARS.cuts.length) setTimeout(() => toast('Cars are waiting on Yard 3, Yard 4, the elevator track and quarry storage. Back in gently to couple; tap a coupler on the cars, or open Couplers (U), to work the knuckles and cut them off.', '', 7000, 'carsIntro'), 11500);
  if (GAME.train && GAME.train.elec) setTimeout(() => toast('Brake off, reverser forward, then notch the power controller. The set stays together: it cannot pick up cars.', '', 6500), 5200);
  else if (GAME.train && GAME.train.diesel) setTimeout(() => toast((GAME.train.nUnits > 1 ? GAME.train.nUnits + ' units in multiple: they all answer the lead cab. ' : '') + 'Reverser to forward, engine brake off, then notch out the throttle.', '', 6500), 5200);
  else setTimeout(() => toast('Reverser forward, engine brake off, then ease the throttle open.', '', 6000), 5200);
};
GAME.pause = function (p) {
  S.paused = p;
  if (p) { SAVE.auto(); $('menu').hidden = false; startLabel(); SAVE.menu(); }
};
GAME.fail = function (title, body) { S.throttle = 0; if (JOB.fail(title, body)) return; $('bigMsg').classList.remove('wreck'); $('bigTitle').textContent = title; $('bigBody').textContent = body; $('bigMsg').hidden = false; };
/* A derailment plays out. The cars come off the rails as rigid bodies (WreckSim, 07d_wreck.js) with the
   speed the train had, starting with the one at the point of impact; the rest keep running on the
   rails into the pile until they are dragged off or hit it hard, and only once it has all come to rest
   does the game offer to put it back (a job's results sheet still says what went wrong). wk says where and how hard: { a: metres back from the front coupler,
   side, k: 0..1 }; left out, the leading end goes, as hard as the speed it was doing. A collision (hit)
   has met something solid: the car that hit stops almost dead and the train behind runs into it. */
GAME.derail = function (why, title = 'Derailed', wk, hit) {
  if (S.derailed) return;
  const T = GAME.train, v0 = Math.abs(S.v), mph = v0 / MPH;
  if (hit === undefined) hit = title === 'Collision';
  if (T) T.wreck(Object.assign({ a: S.v < 0 ? T.length : 0, side: Math.random() < 0.5 ? -1 : 1, k: clamp((mph - 4) / 40, 0.15, 1), v0 }, wk, { vs: S.v, hit, seed: 1 + ((Math.random() * 1e9) | 0) }));
  S.derailed = true; S.throttle = 0; S.vw = S.v; MP.dirty = true;
  GAME.wrecking = { title, why, clunkT: 0, done: false, kin: { v: S.v, mass: 0, force: 0 } };
  if (AU.on) for (let i = 0; i < 8; i++) sndClunk(1, i * 0.07);
  CAM.shakeHit = 1;   // no caption: the pile-up, the shake and the noise say it
};
GAME.wreckStep = function (dt, T) {
  const W = GAME.wrecking; if (!W) return;
  const R = T.rb, kin = W.kin;
  kin.v = S.v; kin.mass = 0; for (const v of T.vehicles) if (!v.rb) kin.mass += v.mass || 40000;
  // a fault in the wreck physics must never freeze the game: the pile just stays where it is
  if (R && !R.asleep) { try { R.step(dt, kin); } catch (e) { console.warn('wreck', e); R.asleep = true; kin.v = 0; } }
  S.v = S.vw = kin.mass > 0 ? kin.v : 0;
  if (S.v !== 0) {
    // the cars still on the rails run on
    const d = S.v * dt, lim = CARS.limit(T, d);
    const moved = T.move(lim.d, { onBlocked: () => { S.v = S.vw = 0; } });
    S.odo += Math.abs(moved);
    if (lim.hit) { S.v = S.vw = 0; sndClunk(1.2, 0); }   // ploughed into standing cars
  }
  const moving = Math.abs(S.v) > 0.05 || (R && !R.asleep);
  if (moving) {
    CAM.shakeHit = Math.max(CAM.shakeHit, clamp(Math.abs(S.v) / 20, 0, 0.5));
    W.clunkT -= dt;
    if (W.clunkT <= 0 && AU.on) { W.clunkT = 0.12 + Math.random() * 0.3; sndClunk(clamp(Math.abs(S.v) / 6, 0.3, 1.5), 0); }
  } else if (!W.done) {
    // the dust has settled: a job is over; otherwise offer to put it back on the rails
    W.done = true; S.v = S.vw = 0;
    if (!JOB.fail(W.title, W.why)) GAME.wreckBar();
  }
};
GAME.wreckBar = function () {
  const W = GAME.wrecking; if (!W || !W.done || PLACE.on) return;
  // just the way out: re-rail or the menu. The wreck itself shows what happened
  $('bigTitle').textContent = ''; $('bigBody').textContent = '';
  $('bigMsg').classList.add('wreck'); $('bigMsg').hidden = false;
};
GAME.rerail = function () {
  $('bigMsg').hidden = true; $('bigMsg').classList.remove('wreck'); S.derailed = false; S.v = 0; S.vw = 0; S.brakeH = 0.12; MP.dirty = true;
  GAME.train.wreck(null); GAME.wrecking = null;
  if (S.dead) { S.dead = false; S.W = 0.6; S.fire = 0.4; S.P = 180; }
  for (const v of GAME.train.vehicles) { v.brake.BP = 90; v.brake.AR = 90; v.brake.BC = 0; v.brake.emerg = false; }
  S.ER = 90;
};
GAME.event = function (k) {
  if (k === 'slip') toast('Drivers slipping! Ease the throttle or use sand.', 'warn', 2600, 'slip');
  else if (k === 'slipCtl') toast('Wheel slip control is trimming power. Sand helps on a wet rail.', 'warn', 3000, 'slipCtl');
  else if (k === 'started') { toast('Prime mover running.', 'good', 2200, 'start'); GAME.refreshKeys(); }
  else if (k === 'noFuel') { toast('Out of fuel. The engine has shut down.', 'bad', 4000, 'fuel'); GAME.refreshKeys(); }
  else if (k === 'dynInterlock') toast(GAME.train && GAME.train.elec ? 'Power controller must be off while the regenerative brake is applied.' : 'Throttle must be in idle while the dynamic brake is set up.', 'warn', 2800, 'dyn');
  else if (k === 'vcb') { toast('On the wire: main breaker closed.', 'good', 2200, 'vcb'); GAME.refreshKeys(); }
  else if (k === 'vcbOpen') { toast('Main breaker open: no power and no regenerative brake.', 'warn', 3000, 'vcb'); GAME.refreshKeys(); }
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
  const sp = GAME.train ? LOCO_SPEC[GAME.train.locoKey] : null, E = !!(GAME.train && GAME.train.elec);
  $('btnCocks').hidden = E && !sp.ditch; $('btnBell').hidden = E && !sp.bell;
  if (E) {
    on('btnCocks', S.ditch); $('btnCocks').firstChild.textContent = 'Ditch lights';
    on('btnInj', S.panUp); $('btnInj').firstChild.textContent = S.panUp ? (S.vcb ? 'Pantograph' : 'Raising') : 'Pan down';
  } else if (D) {
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
GAME.occupied = sw => GAME.train.fouls(sw);
GAME.throwSwitch = function (sw) {
  // both switches of a crossover go over together, so both have to be clear
  for (const s of swPair(sw)) {
    if (GAME.occupied(s)) { toast(`${sw.name} is occupied by your train. Clear it before throwing.`, 'bad', 3200, 'occ'); return; }
    if (CARS.occupied(s)) { toast(`Cars are standing over ${sw.name}. Pull them clear before throwing.`, 'bad', 3200, 'occ'); return; }
    const who = MP.occupant(s);
    if (who) { toast(`${who}'s train is on ${sw.name}. Wait until it clears.`, 'bad', 3200, 'occ'); return; }
  }
  const ai = AI.holding(sw);
  if (ai) { toast(ai + ' Wait until it has gone by.', 'bad', 3200, 'occ'); return; }
  const to = 1 - sw.state;
  for (const s of swPair(sw)) { s.state = to; MP.noteThrow(s); }
  sndThrow();
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
  if (gaugeT > 0.066) { gaugeT = 0; if ($('gaugeWrap').classList.contains('min')) { const m = $('gaugeMini'); const bp = Math.round(GAME.train.lead.brake.BP); const t = GAME.isDiesel() ? `<span><b>${S.notch ? 'N' + S.notch : 'IDLE'}</b></span><span>${S.DBF > 1000 ? 'DB' : 'TE'} <b>${Math.round((S.DBF > 1000 ? S.DBF * (GAME.train.nUnits || 1) : Math.abs(S.TE)) / LBF / 1000)}k</b></span><span>BP <b>${bp}</b></span>` : `<span><b>${Math.round(S.P)}</b> psi</span><span>glass <b>${Math.round(clamp((S.W + 0.1) / 1.2, 0, 1) * 100)}%</b></span><span>BP <b>${bp}</b></span>`; if (m.innerHTML !== t) m.innerHTML = t; } else drawGauges(); }
  if (mapT > 0.18) { mapT = 0; drawMinimap(); if (MAP.visible) MAP.draw(); }
  if (hudT < 0.1) return; hudT = 0;
  JOB.hud();
  const mph = Math.abs(S.v) / MPH;
  $('speedNum').firstChild.textContent = Math.round(mph);
  const lb = $('limitBadge'); lb.textContent = S.limit; lb.classList.toggle('over', mph > S.limit + 2);
  const dir = Math.abs(S.v) > 0.2 ? Math.sign(S.v) : (Math.sign(S.reverser) || 1);
  const gp = S.grade * dir * 100;
  $('gradeTxt').textContent = Math.abs(gp) < 0.1 ? 'Level' : (gp > 0 ? '▲ ' : '▼ ') + Math.abs(gp).toFixed(1) + '%';
  const tod = JOB.run ? '' : dnFmt(SKY.hour), te = $('todTxt'); if (te.textContent !== tod) te.textContent = tod;
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
    const a = sc.signal.sg.aspect || 'Stop', L = ASPECT_LAMPS[a], css = { lampG: 'var(--clear)', lampR: 'var(--stop)', lampY: 'var(--approach)', lampL: '#dfe6ff' };
    sl.innerHTML = `<span class="aspect"><i style="background:${css[L[0]]}"></i><i style="background:${css[L[1]]}"></i></span> Signal ${fmtMi(sc.signal.d)}: <b style="color:${a === 'Stop' ? 'var(--stop)' : 'var(--ink)'}">${a}</b>${a === 'Stop' && sc.signal.sg.why ? ` · ${sc.signal.sg.why}` : ''}`;
  } else sl.innerHTML = '';
  // stop / water / coal
  const stl = $('stopLine');
  const act = nearbyService();
  const cars = CARS.ahead(GAME.train, dir, 500);
  if (cars) $('swMiniTxt').textContent += ` · cars ${fmtFt(cars.d)}`;
  if (act) stl.innerHTML = `<b>${act.label}</b> <button class="btn" id="btnService" style="padding:5px 8px;font-size:10px">${act.btn}</button>`;
  else if (cars && cars.c.ai) stl.innerHTML = `<span style="color:var(--approach)">${cars.c.ai.name} ahead in <b>${fmtFt(cars.d)}</b></span>`;
  else if (cars) stl.innerHTML = cars.facing ? `Coupling in <b>${fmtFt(cars.d)}</b>${cars.d < 60 ? ` · ${Math.round(Math.abs(S.v) / MPH * 10) / 10} mph` : ''}` : `<span style="color:var(--stop)">Cars foul of the route in <b style="color:var(--stop)">${fmtFt(cars.d)}</b></span>`;
  else if (sc.end && sc.end.d < 400) stl.innerHTML = `<span style="color:var(--stop)">End of track in <b style="color:var(--stop)">${fmtMi(sc.end.d)}</b></span>`;
  else if (sc.station && sc.station.d < 6000) stl.innerHTML = `Next: <b>${sc.station.st.name}</b> ${fmtMi(Math.max(0, sc.station.d))}`;
  else stl.innerHTML = '';
  stl.classList.toggle('cars', !act && !!cars);
  const bs = $('btnService'); if (bs) bs.onclick = () => act.go();
  carPanel();
}
/* feet to the nearest foot up close, then tens and miles */
function fmtFt(m) { const ft = m / FT; return ft < 100 ? Math.max(0, Math.round(ft)) + ' ft' : fmtMi(m); }
function nearbyService() {
  const T = GAME.train; if (!T || !T.tender || Math.abs(S.v) > 0.3) return null;
  const tm = T.tender.root.matrixWorld;
  const hatch = new THREE.Vector3(6.675 - 10.6, 4, 0).applyMatrix4(tm), bunker = new THREE.Vector3(6.675 - 3.6, 4, 0).applyMatrix4(tm);
  for (const w of ROUTE.water) { const d = Math.hypot(hatch.x - w.p.x, hatch.z - w.p.z) - (w.kind === 'tower' ? 0 : 0); if (d < 6.5) { if (GAME.filling === 'water') return { label: 'Taking water…', btn: 'Stop', go: () => { GAME.filling = null; } }; return { label: 'Water spout over the hatch', btn: 'Take water', go: () => { GAME.filling = 'water'; } }; } }
  const c = ROUTE.coal; if (c && Math.hypot(bunker.x - c.p.x, bunker.z - c.p.z) < 6) { if (GAME.filling === 'coal') return { label: 'Coaling…', btn: 'Stop', go: () => { GAME.filling = null; } }; return { label: 'Under the coal chute', btn: 'Take coal', go: () => { GAME.filling = 'coal'; } }; }
  return null;
}

/* ---------------- main loop ---------------- */
let chuffQ = 0, pumpT = 0, bellT = 0, idleT = 0, prevV = 0, stopT = 0, tipT = 0;
function loop() {
  requestAnimationFrame(loop);
  let dt = Math.min(clock.getDelta(), 0.05);
  const T = GAME.train; if (!T) return;
  const active = GAME.running && !S.paused && !S.derailed && !PLACE.on;
  if (active) { simStep(dt, T); SAVE.tick(dt); } else { stepSwitches(dt); if (S.derailed && GAME.running && !S.paused && !PLACE.on) GAME.wreckStep(dt, T); }
  renderStep(dt, T);
}
function simStep(dt, T) {
  stepSwitches(dt);
  {
    const n = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / n;
    for (let i = 0; i < n; i++) {
      S.time += h;
      const d = physicsStep(h, T);
      CARS.step(h);
      if (d !== 0 && !S.derailed) {
        const mph = Math.abs(S.v) / MPH;
        const lim = CARS.limit(T, d);
        const moved = T.move(lim.d, {
          onNode: (node, from, to) => {
            const sw = node.sw; if (!sw) return;
            const div = from === sw.legs[1].edge || to === sw.legs[1].edge;
            if (div && mph > turnoutDerailMph(sw.divLimit)) GAME.derail(`Took the ${sw.name} turnout at ${Math.round(mph)} mph. The diverging route is good for ${sw.divLimit} mph.`);
            else if (div && mph > sw.divLimit + TURNOUT_WARN_OVER) { toast(`Over turnout speed at ${sw.name}: ${Math.round(mph)} mph (limit ${sw.divLimit}).`, 'warn', 3000, 'tov'); JOB.note('turnout', { name: sw.name, mph, limit: sw.divLimit }); }
          },
          onRunThrough: sw => { GAME.stats.runThrough++; MP.noteThrow(sw); JOB.note('runThrough', { name: sw.name }); toast(`Ran through ${sw.name}. The points were forced over.`, 'bad', 3800, 'rt' + sw.id); },
          onBlocked: () => {
            const mph2 = Math.abs(S.v) / MPH;
            if (mph2 > 7) GAME.derail(`Hit the bumping post at ${Math.round(mph2)} mph. Bumpers are rated for a gentle shove, about 5 mph.`, 'Collision');
            else { if (mph2 > 1) { sndClunk(1, 0); JOB.note('bumper', { mph: mph2 }); } S.v = 0; S.vw = 0; toast('Stopped against the bumping post.', 'warn', 2500, 'bump'); }
          },
        });
        S.odo += Math.abs(moved);
        if (lim.hit && !S.derailed) CARS.contact(T, Math.sign(d), lim.hit);
      }
    }
    // curve overspeed (unbalanced lateral acceleration at the lead truck)
    const ub = curveUnbalanced(T.lead.leadPt.tp, S.v);
    tipT = ub > CURVE_TIP && !S.derailed ? tipT + dt : 0;
    if (tipT > CURVE_HOLD) GAME.derail(`Overturned on the curve at ${Math.round(Math.abs(S.v) / MPH)} mph.`);
    else if (ub > CURVE_WARN) { toast('Too fast for this curve!', 'warn', 2000, 'curve'); JOB.note('curve', { mph: Math.abs(S.v) / MPH }); }
    // filling at water column / coal chute
    if (GAME.filling) {
      if (!nearbyService()) GAME.filling = null;
      else if (GAME.filling === 'water') { S.water = Math.min(83280, S.water + 240 * dt); if (S.water >= 83279) { GAME.filling = null; toast('Tender full: 22,000 gallons.', 'good'); } }
      else { S.coal = Math.min(19958, S.coal + 300 * dt); if (S.coal >= 19957) { GAME.filling = null; toast('Coal bunker full: 22 tons.', 'good'); } }
    }
    JOB.tick(dt);
    AI.tick(dt);
    // station stop detection
    if (Math.abs(S.v) < 0.05) { stopT += dt; if (stopT > 1.2) stationStop(T); } else stopT = 0;
    // start-up slack
    if (Math.abs(prevV) < 0.02 && Math.abs(S.v) >= 0.02 && AU.on) { const cp = camera.position; let k = 0; T.vehicles.forEach(v => { if (v.kind === 'loco' || v.kind === 'loco2' || v.kind === 'tender') return; const dd = v.pos.distanceTo(cp); sndClunk(0.7 / (1 + (dd / 25) ** 1.3), (k++) * 0.07); }); }
    prevV = S.v;
    if (S.MR < 60 && S.brakeH < 0.18) toast('Main reservoir low: let the pump catch up.', 'warn', 3000, 'mr');
    if (S.lowWater) toast('Water low in the glass! Work the injector.', 'bad', 2500, 'lw');
    if (S.P < 150 && Math.abs(S.v) > 1) toast('Steam pressure falling. Shorten the cutoff or ease off.', 'warn', 3000, 'lp');
  }
}
function renderStep(dt, T) {
  // visuals
  updateSwitchVisuals(); updateSignals(dt);
  T.update(dt, S.theta, S.reverser);
  CARS.render();
  CPL.frame(dt);
  CAB.frame(dt, T);
  AI.render(dt);
  MP.frame(dt);
  if (GAME.running && !S.paused && !S.derailed && !PLACE.on) MP.contact(T);
  // headlight & glows, brightening through dusk
  const night = SKY.dark, darkH = Math.max(night, smooth(0.3, 0.7, SKY.boreK || 0));   // in a tunnel the headlight works as it does at night
  T.head.intensity = S.light === 0 ? 0 : (S.light === 1 ? lerp(0.4, 5, darkH) : lerp(1.4, 16, darkH));
  RMAT.lens.color.setScalar(S.light === 0 ? 0.25 : (S.light === 1 ? 0.75 : 1.0)); RMAT.hlLens.color.copy(RMAT.lens.color);
  const flick = 0.85 + 0.15 * Math.sin(S.time * 23) * Math.sin(S.time * 7.3);
  if (T.diesel) {
    T.fireLight.intensity = 0;
    if (S.whistle > 0.05 || S.bell) S.ditchFlash = 15;
    S.ditchFlash = Math.max(0, S.ditchFlash - dt);
    const ph = Math.floor(S.time * 2.6) % 2, on = S.ditch && S.light > 0;
    const lv = (k) => !on ? 0.12 : (S.ditchFlash > 0 ? (ph === k ? 1 : 0.15) : 0.85);
    T.loco.ditch.forEach((d, k) => { const b = lv(k); d.lens.material.color.setScalar(0.25 + 0.75 * b); d.halo.material.opacity = b * lerp(0.45, 1, night); });
  } else T.fireLight.intensity = S.fire * lerp(0.18, 2.4, night) * flick * (CAM.mode === 'cab' ? 1 : 0.6);
  T.loco.beam.material.opacity = S.light === 0 ? 0 : Math.max(night * (S.light === 2 ? 0.075 : 0.035), SKY.weather !== 'clear' ? 0.02 : 0);
  T.loco.halo.material.opacity = S.light === 0 ? 0 : lerp(0.35, 1, night) * (S.light === 2 ? 1 : 0.6) * lampFacing(T.loco, camera);
  if (!T.diesel) {
    T.loco.fire.material.color.setRGB(1 * flick, 0.45 * S.fire * flick + 0.1, 0.1);
    T.loco.ash.material.opacity = night * 0.35 * S.fire * flick;
  }
  const pb = $('btnWhistle').querySelector('.pull i'), pw = Math.round(S.whistle * 100) + '%'; if (pb.style.width !== pw) pb.style.width = pw;
  T.cabLight.intensity = night * 0.6;
  // camera
  slideFeel(dt, T);
  if (PLACE.on) PLACE.camera(camera, dt); else updateCamera(camera, MP.view() || T, dt);
  if (CAM.shakeHit) { camera.position.x += (Math.random() - 0.5) * CAM.shakeHit; camera.position.y += (Math.random() - 0.5) * CAM.shakeHit; CAM.shakeHit = Math.max(0, CAM.shakeHit - dt * 1.5); }
  if (!GAME.running) { // attract mode orbit while the menu is up
    CAM.yaw = -0.95 + Math.sin(S.time * 0.05 + performance.now() * 0.00005) * 0.55; CAM.mode = 'chase'; CAM.dist = 21; CAM.pitch = 0.09;
  }
  // sky follows camera
  skyTick(dt);
  SKY.clouds.material.map.offset.x += dt * 0.0006; SKY.clouds.material.map.offset.y += dt * 0.0003;
  skyFollow(camera, PLACE.on ? PLACE.focus() : (MP.view() || T).lead.pos);
  lampsFrame(camera, dt);
  updateTrackLOD(camera); updateDetailLOD(camera, scene, dt); mtUpdate(camera, scene);
  WORLD.waterT.value += dt;
  // effects & sound
  effectsAndSound(dt, T);
  MP.post(dt);
  updateFX(dt, camera);
  updateSparks(dt, T, camera);
  if (GAME.running) updateHUD(dt);
  renderer.render(scene, camera);
}

function stationStop(T) {
  if (JOB.run && !JOB.run.over) return;   // a job calls its own stops
  const cab = T.worldOf(new THREE.Vector3(T.loco.cabEye.x, 0, 0));
  for (const st of ROUTE.stations) {
    const d = cab.distanceTo(st.p); if (d > 120) continue;
    if (GAME.lastStation === st.name) return;
    GAME.lastStation = st.name;
    const along = _v1.subVectors(cab, st.p).dot(T.lead.fwd);
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
        if (S.cocks) for (const cp of L.cockPos) { const p = T.worldOf(cp); const side = new THREE.Vector3(0, 0, Math.sign(cp.z) * (4 + Math.random() * 3)).applyQuaternion(_cq.setFromRotationMatrix(_cm.extractRotation(L.root.matrixWorld))); emit(p, new THREE.Vector3(tv.x + side.x + T.lead.fwd.x * 3, -0.6, tv.z + side.z + T.lead.fwd.z * 3), 1.1 + Math.random() * 0.4, 0.4, 3.2, 0.7, [0.95, 0.95, 0.97], 0.4, 1.6); }
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
  if (S.notch > dslNotch && S.engineRun) dslPuff = Math.min(2.2, dslPuff + 0.9);
  dslNotch = S.notch;
  dslPuff = Math.max(0, dslPuff - dt);
  idleT += dt;
  const rf = clamp((S.rpm - 300) / 750, 0, 1);
  if (idleT > 0.07 && S.rpm > 60) {
    idleT = 0;
    const dark = Math.min(1, dslPuff * 0.6 + (S.crank > 0 ? 0.8 : 0)), gv = lerp(0.62, 0.16, dark);
    const a = 0.12 + 0.25 * rf * S.load + 0.45 * dark;
    for (const m of T.units) { const stack = T.unitWorld(m, m.stackPos); emit(stack, new THREE.Vector3(tv.x + (Math.random() - 0.5) * 0.6, 4 + 9 * rf + 6 * dark, tv.z + (Math.random() - 0.5) * 0.6), 2.5 + Math.random() * 1.5 + dark * 2, 0.7, 3.5 + 3 * rf + 3 * dark, a, [gv, gv, gv * 1.02], 0.5, 1.1); }
  }
  if (S.crank > 0) { crankT += dt; if (crankT > 0.32) { crankT = 0; sndCrank(); } }
  if (S.pumping && S.engineRun) { pumpT += dt; if (pumpT > 0.4) { pumpT = 0; GAME.pumpPh = (GAME.pumpPh || 0) + 1; if (GAME.pumpPh % 2) sndPump(GAME.pumpPh); } }
  let src = null, best = 1e9;
  for (const m of T.units) { const p = T.unitWorld(m, m.enginePos); const d = p.distanceTo(camera.position); if (d < best) { best = d; src = p; } }
  return { src, working: S.load > 0.05 };
}
/* an electric set: no exhaust, the compressor on the auxiliary supply, and a spark at the pantograph now and then */
function electricFX(dt, T, tv) {
  if (S.pumping && S.vcb) { pumpT += dt; if (pumpT > 0.4) { pumpT = 0; GAME.pumpPh = (GAME.pumpPh || 0) + 1; if (GAME.pumpPh % 2) sndPump(GAME.pumpPh); } }
  const src = T.unitWorld(T.loco, T.loco.enginePos);
  return { src, working: S.load > 0.05 };
}
function effectsAndSound(dt, T) {
  const DSL = T.diesel;
  const tv = new THREE.Vector3().copy(T.lead.fwd).multiplyScalar(S.v);
  const fx = T.elec ? electricFX(dt, T, tv) : DSL ? dieselFX(dt, T, tv) : steamFX(dt, T, tv);
  if (S.bell) { bellT += dt; if (bellT > (DSL ? 1.05 : 0.86)) { bellT = 0; sndBell(DSL); } } else bellT = 0.8;
  if (!AU.on) return;
  soundMix(dt, T, fx, tv);
}

GAME.snapshot = function () {
  const T = GAME.train; if (!T) return {};
  const f = T.frontTP();
  return { running: GAME.running, settings: { ...GAME.settings }, sw: NET.switches.map(s => s.state), front: { e: f.e.id, s: f.s, o: f.o }, S: { v: S.v, P: S.P, W: S.W, water: S.water, coal: S.coal, throttle: S.throttle, reverser: S.reverser, brakeH: S.brakeH, indH: S.indH }, cam: CAM.mode, hour: SKY.hour };
};
GAME.restore = function (d) {
  try {
    Object.assign(GAME.settings, d.settings);
    makeTrain(); GAME.train.consistKey = GAME.settings.consist;
    NET.switches.forEach((s, i) => { s.state = s.anim = d.sw[i] || 0; });
    const e = NET.edges.find(x => x.id === d.front.e);
    if (e) GAME.train.place(new TrackPos(e, d.front.s, d.front.o));
    Object.assign(S, d.S); S.vw = S.v;
    applyLook(null, GAME.settings.weather); if (d.hour !== undefined) { SKY.hour = d.hour; skyLight(true); }
    cycleCamera(d.cam);
    GAME.running = true; $('menu').hidden = true; $('hud').hidden = false;
    const keyOf = { optLoco: 'loco', optTrain: 'consist', optTime: 'time', optCycle: 'cycle', optWeather: 'weather', optFire: 'fire', optTraffic: 'traffic', optLivery: 'livery', optUnits: 'units', optFinish: 'finish', optCoach: 'coach' };
    for (const k in keyOf) [...$(k).children].forEach(c => c.setAttribute('aria-pressed', String(c.id === k + '_' + GAME.settings[keyOf[k]])));
    [...$('optMix').children].forEach(c => c.setAttribute('aria-pressed', String(c.id === 'optMix_' + (GAME.settings.mix ? 'mixed' : 'matched'))));
    refreshMenuGroups(); specGrid();
    setTimeout(drawLeverTicks, 50);
  } catch (err) { console.warn('restore failed', err); }
};
boot();

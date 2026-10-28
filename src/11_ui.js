/* ============================================================================
   Cameras, input, control stand, gauges, minimap, track map, toasts
   ========================================================================== */
const CAM = { mode: 'chase', modes: ['chase', 'cab', 'side', 'drone', 'rear', 'cine'], names: { chase: 'Chase', cab: 'Cab', side: 'Trackside', drone: 'Overhead', rear: 'Rear car', cine: 'Cinematic' },
  yaw: -0.95, pitch: 0.14, dist: 24, cabYaw: 0, cabPitch: -0.06, droneYaw: 0.8, side: null, sideT: 0, fov: 52, shake: 0 };
const CAM_HOME = { chase: { yaw: -0.95, pitch: 0.14, dist: 24 }, drone: { droneYaw: 0.8, dronePitch: 0.85, dist: 24 }, cab: { cabYaw: 0, cabPitch: -0.06 } };
const _cq = new THREE.Quaternion(), _cm = new THREE.Matrix4(), _ce = new THREE.Euler();
function updateCamera(cam, train, dt) {
  const L = train.loco, body = L.root;
  cam.near = 0.3; let fov = 52;
  camTrack(train, dt);
  if (CAM.mode === 'cab') {
    cam.near = 0.05;
    const eye = L.cabEye.clone().applyMatrix4(body.matrixWorld);
    const sp = Math.abs(S.v);
    CAM.shake += dt * (7 + sp * 0.6);
    const jit = Math.min(1, sp / 25) * 0.012;
    eye.y += Math.sin(CAM.shake * 1.7) * jit + Math.sin(CAM.shake * 3.1) * jit * 0.5;
    cam.position.copy(eye);
    _cq.setFromRotationMatrix(_cm.extractRotation(body.matrixWorld));
    _ce.set(CAM.cabPitch + Math.sin(CAM.shake * 0.9) * jit * 0.4, -Math.PI / 2 + CAM.cabYaw, 0, 'YXZ');
    cam.quaternion.copy(_cq).multiply(new THREE.Quaternion().setFromEuler(_ce));
    fov = 62;
    if (cam.aspect < 1) fov = Math.min(80, fov * 1.25);
  } else fov = outsideCamera(cam, train, dt);
  CAM.fov += (fov - CAM.fov) * (CAM.fovCut ? 1 : Math.min(1, dt * 4)); CAM.fovCut = false;
  cam.fov = CAM.fov; cam.updateProjectionMatrix();
}
function cycleCamera(to) {
  const i = CAM.modes.indexOf(CAM.mode), from = CAM.mode;
  CAM.mode = to || CAM.modes[(i + 1) % CAM.modes.length];
  // asking again for the view already up puts it back where it started (or, cinematic, cuts to the next shot)
  if (to && to === from) { Object.assign(CAM, CAM_HOME[to] || {}); CAM.fling = 0; if (to === 'cine' || to === 'side') CAM.nextShot(); return; }
  CAM.side = null; CAM.shot = null; CAM.fling = 0;
  // outside views glide from one to the next; the cab, trackside and cinematic cut, as a film would
  const glide = ['chase', 'drone', 'rear'];
  CAM.blend = null;
  if (glide.includes(from) && glide.includes(CAM.mode) && GAME.train && camera) { camBlendFrom(camera, MP.view() || GAME.train, 0.85); CAM.init = false; CAM.ready = false; }
  else CAM.init = false;
  CAM.fovCut = !glide.includes(CAM.mode) || !glide.includes(from);
  CAM.label = ''; $('camName').textContent = CAM.names[CAM.mode];
}

/* ---------------- pointer input on the 3D view ---------------- */
function setupViewInput(canvas, camera) {
  const ptrs = new Map(); let pinch0 = 0, dist0 = 0, ang0 = 0, tapStart = null, flick = 0, flickT = 0;
  const zoom = d => { CAM.dist = clamp(d, 7, 140); };
  canvas.addEventListener('pointerdown', e => { if (PLACE.on) return; canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); CAM.fling = 0; flick = 0; if (ptrs.size === 1) tapStart = { x: e.clientX, y: e.clientY, t: performance.now() }; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); ang0 = Math.atan2(b.y - a.y, b.x - a.x); dist0 = CAM.dist; tapStart = null; } });
  canvas.addEventListener('pointermove', e => {
    if (PLACE.on) return;
    if (!ptrs.size && e.pointerType === 'mouse') { CPL.point(e.clientX, e.clientY); return; }
    if (!ptrs.has(e.pointerId)) return;
    const p = ptrs.get(e.pointerId), dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (tapStart && Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) > 8) tapStart = null;
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
      if (pinch0 > 0) zoom(dist0 * pinch0 / d);
      // a two-finger twist turns the view round the train
      const tw = angWrap(ang - ang0); ang0 = ang;
      if (CAM.mode === 'chase') CAM.yaw -= tw; else if (CAM.mode === 'drone') CAM.droneYaw -= tw;
      return;
    }
    const k = 0.006, now = performance.now();
    if (CAM.mode === 'chase') { CAM.yaw -= dx * k; CAM.pitch = clamp(CAM.pitch + dy * k * 0.8, -0.16, 1.35); }
    else if (CAM.mode === 'cab') { CAM.cabYaw = clamp(CAM.cabYaw - dx * k * 0.7, -2.2, 2.2); CAM.cabPitch = clamp(CAM.cabPitch - dy * k * 0.7, -0.8, 0.6); }
    else if (CAM.mode === 'drone') { CAM.droneYaw -= dx * k; CAM.dronePitch = clamp(CAM.dronePitch + dy * k * 0.6, 0.35, 1.5); }
    // how fast the drag is going, so letting go mid-swing keeps the view turning and easing to a stop
    const vt = Math.max(8, now - flickT); flick = flick * 0.4 + (-dx * k / vt * 1000) * 0.6; flickT = now;
  });
  const up = e => {
    if (PLACE.on) { ptrs.delete(e.pointerId); tapStart = null; return; }
    if (tapStart && ptrs.size === 1 && performance.now() - tapStart.t < 400) handleTap(e.clientX, e.clientY, camera);
    else if (ptrs.size === 1 && performance.now() - flickT < 70 && (CAM.mode === 'chase' || CAM.mode === 'drone')) CAM.fling = clamp(flick, -4, 4);
    ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = 0; tapStart = null;
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointerleave', () => { if (!PLACE.on) CPL.point(null); }); canvas.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); tapStart = null; });
  canvas.addEventListener('wheel', e => { if (PLACE.on) return; e.preventDefault(); zoom(CAM.dist * (1 + clamp(e.deltaY * (e.deltaMode ? 33 : 1), -120, 120) * 0.0012)); }, { passive: false });
  document.addEventListener('gesturestart', e => e.preventDefault());
}
const _ray = new THREE.Raycaster();
function handleTap(x, y, camera) {
  const v = new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
  if (CPL.tap(x, y)) return;
  _ray.setFromCamera(v, camera);
  const hits = _ray.intersectObjects(NET.switches.map(s => s.vis.hit), false);
  if (hits.length) { GAME.throwSwitch(hits[0].object.userData.sw); return; }
  // tapping the scene in cinematic mode cuts to the next shot
  if (CAM.mode === 'cine') CAM.nextShot();
}

/* ---------------- levers ---------------- */
const LEVERS = {};
function setupLevers() {
  const defs = {
    lvThrottle: { get: () => S.throttle, set: v => { S.throttle = v; }, fromY: t => GAME.isDiesel() ? Math.round((1 - t) * 8) / 8 : 1 - t, toY: v => 1 - v,
      label: v => GAME.isDiesel() ? (Math.round(v * 8) ? (GAME.train.elec ? 'P' : 'N') + Math.round(v * 8) : (GAME.train.elec ? 'OFF' : 'IDLE')) : Math.round(v * 100) + '%',
      ticks: () => GAME.isDiesel() ? [...Array(9)].map((_, i) => [i / 8, '']) : [[0, ''], [0.25, ''], [0.5, ''], [0.75, ''], [1, '']] },
    lvReverser: { get: () => S.reverser, set: v => { S.reverser = v; },
      fromY: t => { if (GAME.isDiesel()) return t < 0.34 ? 1 : (t > 0.66 ? -1 : 0); let r = 1 - 2 * t; if (Math.abs(r) < 0.06) r = 0; return Math.round(r * 17) / 17; }, toY: v => (1 - v) / 2,
      label: v => GAME.isDiesel() ? (v > 0.5 ? 'FWD' : v < -0.5 ? 'REV' : 'N') : (v === 0 ? 'N' : (v > 0 ? 'F ' : 'R ') + Math.round(Math.abs(v) * 85) + '%'), ticks: [[0, 'F'], [0.5, 'N'], [1, 'R']] },
    lvDyn: { get: () => S.dyn, set: v => { S.dyn = v; }, fromY: t => t < 0.04 ? 0 : t, toY: v => v, label: v => v < 0.03 ? 'OFF' : v < 0.06 ? 'SETUP' : (GAME.train && GAME.train.elec ? 'RB ' : 'DB ') + Math.round((v - 0.06) / 0.94 * 100) + '%', ticks: [[0, ''], [0.06, ''], [1, '']] },
    lvBrake: { get: () => S.brakeH, set: v => { S.brakeH = v; }, fromY: t => { if (Math.abs(t - 0.12) < 0.04) return 0.12; if (Math.abs(t - 0.23) < 0.035) return 0.23; return t; }, toY: v => v, label: v => brakeLabel(v), ticks: [[0.03, 'REL'], [0.12, 'RUN'], [0.23, 'LAP'], [0.3, 'SVC'], [0.95, 'EMG']] },
    lvInd: { get: () => S.indH, set: v => { S.indH = v; }, fromY: t => t < 0.08 ? 0 : t, toY: v => v, label: v => Math.round(clamp((v - 0.1) / 0.9, 0, 1) * 45) + ' psi', ticks: [[0, 'REL'], [1, 'FULL']] },
  };
  for (const id in defs) {
    const el = $(id), d = defs[id], track = el.querySelector('.track'), knob = el.querySelector('.knob'), lv = el.querySelector('.lv'), tc = el.querySelector('.ticks');
    const L = { el, d, track, knob, lv, tc }; LEVERS[id] = L;
    const setFromEvent = e => { const r = track.getBoundingClientRect(); const t = clamp((e.clientY - r.top) / r.height, 0, 1); d.set(d.fromY(t)); GAME.controlTouched(id); };
    el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); L.drag = true; setFromEvent(e); e.preventDefault(); });
    el.addEventListener('pointermove', e => { if (L.drag) setFromEvent(e); });
    el.addEventListener('pointerup', () => { L.drag = false; }); el.addEventListener('pointercancel', () => { L.drag = false; });
    el.addEventListener('keydown', e => { const step = e.shiftKey ? 0.1 : 0.03; if (e.key === 'ArrowUp') { nudgeLever(id, -step); e.preventDefault(); } if (e.key === 'ArrowDown') { nudgeLever(id, step); e.preventDefault(); } });
  }
  drawLeverTicks();
}
function nudgeLever(id, dt) { const L = LEVERS[id]; const y = L.d.toY(L.d.get()); L.d.set(L.d.fromY(clamp(y + dt, 0, 1))); GAME.controlTouched(id); }
function drawLeverTicks() {
  for (const id in LEVERS) {
    const L = LEVERS[id], c = L.tc, r = L.track.getBoundingClientRect(); if (!r.height) continue;
    const dpr = Math.min(2, devicePixelRatio); c.width = (r.width + 28) * dpr; c.height = r.height * dpr; c.style.width = (r.width + 28) + 'px'; c.style.height = r.height + 'px';
    const g = c.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = '#6f7d86'; g.font = '600 7px "IBM Plex Sans Condensed", sans-serif'; g.textBaseline = 'middle';
    for (const [t, lab] of (typeof L.d.ticks === 'function' ? L.d.ticks() : L.d.ticks)) { const y = clamp(t * r.height, 3, r.height - 3); g.fillRect(0, y - 0.5, 5, 1); g.fillRect(r.width + 23, y - 0.5, 5, 1);  }
  }
}
function updateLevers() {
  for (const id in LEVERS) { const L = LEVERS[id], v = L.d.get(); L.knob.style.top = (L.d.toY(v) * 100) + '%'; const t = L.d.label(v); if (L.lv.textContent !== t) L.lv.textContent = t; }
}

/* ---------------- keys / buttons ---------------- */
function setupButtons() {
  const wb = $('btnWhistle'); let wStart = null;
  wb.addEventListener('pointerdown', e => { wb.setPointerCapture(e.pointerId); wStart = e.clientY; S.whistle = 0.62; wb.classList.add('on'); e.preventDefault(); });
  wb.addEventListener('pointermove', e => { if (wStart !== null) S.whistle = clamp(0.62 + (wStart - e.clientY) / 70, 0.25, 1); });
  const wEnd = () => { wStart = null; S.whistle = 0; wb.classList.remove('on'); };
  wb.addEventListener('pointerup', wEnd); wb.addEventListener('pointercancel', wEnd);
  const tog = (id, fn) => $(id).addEventListener('click', () => { fn(); GAME.refreshKeys(); });
  tog('btnBell', () => { S.bell = !S.bell; });
  tog('btnSand', () => { S.sander = !S.sander; });
  tog('btnCocks', () => { if (GAME.isDiesel()) S.ditch = !S.ditch; else S.cocks = !S.cocks; });
  tog('btnLight', () => { S.light = (S.light + 1) % 3; });
  tog('btnInj', () => { if (GAME.train && GAME.train.elec) { S.panUp = !S.panUp; toast(S.panUp ? 'Raising the pantograph…' : 'Pantograph down: main breaker open.', S.panUp ? '' : 'warn', 2200, 'eng'); } else if (GAME.isDiesel()) { if (S.engineRun) { S.engineRun = false; toast('Engine shut down.', 'warn', 2200, 'eng'); } else if (S.crank <= 0 && S.fuel > 0) { S.crank = 6.5; toast('Cranking the prime mover…', '', 2200, 'eng'); } } else { GAME.manualFire('injector'); S.injector = !S.injector; } });
  tog('btnFire', () => { GAME.manualFire('stoker'); const steps = [0, 0.25, 0.5, 0.75, 1]; let i = steps.findIndex(s => s > S.stoker + 0.05); S.stoker = i < 0 ? 0 : steps[i]; });
  tog('btnBlower', () => { GAME.manualFire('blower'); S.blower = S.blower > 0.3 ? 0 : 0.65; });
  $('gaugeWrap').addEventListener('click', () => { const g = $('gaugeWrap'); g.classList.toggle('min'); try { localStorage.setItem('bd_gmin', g.classList.contains('min') ? '1' : ''); } catch (e) {} });
  try { if (localStorage.getItem('bd_gmin')) $('gaugeWrap').classList.add('min'); } catch (e) {}
  $('btnCam').addEventListener('click', () => cycleCamera());
  $('btnCars').addEventListener('click', () => carPanelToggle());
  $('carClose').addEventListener('click', () => carPanelToggle(false));
  $('carStrip').addEventListener('click', e => { const b = e.target.closest('.cj'); if (b) CARS.uncouple(+b.dataset.j); });
  $('btnMap').addEventListener('click', () => MAP.open());
  $('minimap').addEventListener('click', () => MAP.open());
  $('btnCine').addEventListener('click', () => { $('hud').classList.add('cine'); });
  $('standToggle').addEventListener('click', () => { $('hud').classList.remove('cine'); setTimeout(drawLeverTicks, 30); });
  $('btnMenu').addEventListener('click', () => GAME.pause(true));
  $('btnThrow').addEventListener('click', () => GAME.throwAhead());
  $('btnThrowMini').addEventListener('click', () => GAME.throwAhead());
  const keys = {};
  addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (PLACE.on) { PLACE.key(e); return; }
    if (e.repeat && !['KeyW', 'KeyS', 'KeyQ', 'KeyE', 'KeyZ', 'KeyC', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Minus', 'Equal', 'NumpadSubtract', 'NumpadAdd'].includes(e.code)) return;
    if ($('menu').hidden === false) return;
    keys[e.code] = true;
    switch (e.code) {
      case 'KeyW': S.throttle = GAME.isDiesel() ? clamp(Math.round(S.throttle * 8 + 1) / 8, 0, 1) : clamp(S.throttle + 0.04, 0, 1); break;
      case 'KeyS': S.throttle = GAME.isDiesel() ? clamp(Math.round(S.throttle * 8 - 1) / 8, 0, 1) : clamp(S.throttle - 0.06, 0, 1); break;
      case 'KeyD': if (GAME.isDiesel()) S.dyn = clamp(S.dyn < 0.06 ? 0.06 : S.dyn + 0.1, 0, 1); break;
      case 'KeyA': if (GAME.isDiesel()) S.dyn = S.dyn <= 0.07 ? 0 : clamp(S.dyn - 0.1, 0.06, 1); break;
      case 'ArrowUp': S.reverser = GAME.isDiesel() ? clamp(Math.round(S.reverser) + 1, -1, 1) : clamp(Math.round((S.reverser + 1 / 17) * 17) / 17, -1, 1); e.preventDefault(); break;
      case 'ArrowDown': S.reverser = GAME.isDiesel() ? clamp(Math.round(S.reverser) - 1, -1, 1) : clamp(Math.round((S.reverser - 1 / 17) * 17) / 17, -1, 1); e.preventDefault(); break;
      case 'KeyQ': S.brakeH = clamp(S.brakeH - 0.03, 0, 1); break;
      case 'KeyE': S.brakeH = clamp(S.brakeH + 0.03, 0, 1); break;
      case 'KeyZ': S.indH = clamp(S.indH - 0.05, 0, 1); break;
      case 'KeyC': S.indH = clamp(S.indH + 0.05, 0, 1); break;
      case 'Space': S.whistle = e.shiftKey ? 1 : 0.7; e.preventDefault(); break;
      case 'KeyB': S.bell = !S.bell; break;
      case 'KeyX': S.sander = !S.sander; break;
      case 'KeyK': if (GAME.isDiesel()) S.ditch = !S.ditch; else S.cocks = !S.cocks; break;
      case 'KeyH': S.light = (S.light + 1) % 3; break;
      case 'KeyI': $('btnInj').click(); break;
      case 'KeyF': if (GAME.isDiesel()) break; GAME.manualFire('stoker'); S.stoker = clamp(S.stoker + 0.25, 0, 1.0001) > 1 ? 0 : S.stoker + 0.25; break;
      case 'KeyL': if (GAME.isDiesel()) break; GAME.manualFire('blower'); S.blower = S.blower > 0.3 ? 0 : 0.65; break;
      case 'KeyT': GAME.throwAhead(); break;
      case 'KeyU': carPanelToggle(); break;
      case 'KeyG': PLACE.enter(); break;
      case 'KeyM': MAP.visible ? MAP.close() : MAP.open(); break;
      case 'KeyP': GAME.pause(!S.paused); break;
      case 'Digit1': cycleCamera('chase'); break; case 'Digit2': cycleCamera('cab'); break; case 'Digit3': cycleCamera('side'); break; case 'Digit4': cycleCamera('drone'); break; case 'Digit5': cycleCamera('rear'); break; case 'Digit6': cycleCamera('cine'); break;
      case 'KeyV': cycleCamera(); break;
      case 'ArrowLeft': case 'ArrowRight': { const d = (e.code === 'ArrowLeft' ? 1 : -1) * 0.07; if (CAM.mode === 'drone') CAM.droneYaw += d; else if (CAM.mode === 'chase') CAM.yaw += d; else if (CAM.mode === 'cab') CAM.cabYaw = clamp(CAM.cabYaw + d, -2.2, 2.2); e.preventDefault(); break; }
      case 'Minus': case 'NumpadSubtract': CAM.dist = clamp(CAM.dist * 1.12, 7, 140); break;
      case 'Equal': case 'NumpadAdd': CAM.dist = clamp(CAM.dist / 1.12, 7, 140); break;
    }
    GAME.refreshKeys();
  });
  addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'Space') S.whistle = 0; });
}

/* ---------------- gauges ---------------- */
function drawGauges() {
  const c = $('gauges'), g = c.getContext('2d'), W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  const dial = (x, y, r, max, label, hands, red, ticksStep, minor) => {
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r * 1.05);
    gr.addColorStop(0, '#f6e7b8'); gr.addColorStop(0.7, '#c9a24f'); gr.addColorStop(1, '#6d531f');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r + 6, 0, TAU); g.fill();
    g.fillStyle = '#efe9d6'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    if (red) { g.strokeStyle = 'rgba(205,40,30,0.85)'; g.lineWidth = r * 0.09; g.beginPath(); g.arc(x, y, r * 0.86, a0 + (a1 - a0) * red[0] / max, a0 + (a1 - a0) * red[1] / max); g.stroke(); }
    g.strokeStyle = '#1c1c1c'; g.fillStyle = '#1c1c1c';
    for (let v = 0; v <= max + 1e-6; v += minor) { const a = a0 + (a1 - a0) * v / max; const major = Math.abs(v / ticksStep - Math.round(v / ticksStep)) < 1e-6; g.lineWidth = major ? 2.2 : 1; g.beginPath(); g.moveTo(x + Math.cos(a) * r * (major ? 0.74 : 0.82), y + Math.sin(a) * r * (major ? 0.74 : 0.82)); g.lineTo(x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92); g.stroke();
      if (major) { g.font = `600 ${Math.round(r * 0.17)}px "IBM Plex Mono", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(v), x + Math.cos(a) * r * 0.57, y + Math.sin(a) * r * 0.57); } }
    g.font = `600 ${Math.round(r * 0.15)}px "IBM Plex Sans Condensed", sans-serif`; g.fillStyle = '#3a3a3a'; g.fillText(label, x, y + r * 0.42);
    for (const [v, col] of hands) { const a = a0 + (a1 - a0) * clamp(v, 0, max) / max; g.strokeStyle = col; g.lineWidth = r * 0.055; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - Math.cos(a) * r * 0.15, y - Math.sin(a) * r * 0.15); g.lineTo(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82); g.stroke(); }
    g.fillStyle = '#222'; g.beginPath(); g.arc(x, y, r * 0.07, 0, TAU); g.fill();
  };
  const T = GAME.train, b = T ? T.vehicles : null;
  // the end car farthest from the engine, which may be ahead of it when shoving
  const lastBP = b ? (T.li > b.length - 1 - T.li ? b[0] : b[b.length - 1]).brake.BP : 90;
  if (T && T.elec) { drawElectricGauges(g, dial, b, lastBP); return; }
  if (GAME.isDiesel()) { drawDieselGauges(g, dial, b, lastBP); return; }
  dial(108, 112, 96, 300, 'BOILER PSI', [[S.P, '#151515']], [245, 300], 50, 10);
  g.font = '600 18px "IBM Plex Mono", monospace'; g.fillStyle = S.safety ? '#ee4b3d' : '#cfa651'; g.textAlign = 'center'; g.fillText(S.safety ? 'POPPING' : 'CHEST ' + Math.round(S.Psc), 108, 224);
  dial(296, 86, 70, 160, 'MR · EQ', [[S.MR, '#c0281e'], [S.ER, '#151515']], null, 40, 10);
  dial(458, 86, 70, 160, 'BP · BC', [[b ? GAME.train.lead.brake.BP : 90, '#151515'], [S.BCloco || 0, '#c0281e']], null, 40, 10);
  g.font = '600 17px "IBM Plex Mono", monospace'; g.fillStyle = '#8d9aa2'; g.textAlign = 'center';
  g.fillText('CUT ' + Math.round(S.cut * 100) + '%', 296, 186); g.fillText('REAR ' + Math.round(lastBP), 458, 186);
  g.fillStyle = S.slip ? '#ee4b3d' : '#8d9aa2'; g.fillText(S.slip ? 'SLIPPING' : 'TE ' + Math.round(Math.abs(S.TE) / LBF / 1000) + 'k lb', 296, 212);
  g.fillStyle = '#8d9aa2'; g.fillText('FIRE ' + Math.round(S.fire * 100) + '%', 458, 212);
  // water glass
  const gx = 560, gy0 = 26, gy1 = 200, gw = 26;
  g.fillStyle = '#6d531f'; g.fillRect(gx - 6, gy0 - 14, gw + 12, 12); g.fillRect(gx - 6, gy1 + 2, gw + 12, 12);
  g.fillStyle = '#0d1418'; g.fillRect(gx, gy0, gw, gy1 - gy0);
  const lvl = clamp((S.W + 0.1) / 1.2, 0, 1), wy = gy1 - lvl * (gy1 - gy0);
  const wg = g.createLinearGradient(gx, 0, gx + gw, 0); wg.addColorStop(0, '#2e5c74'); wg.addColorStop(0.5, '#7fb6cf'); wg.addColorStop(1, '#2e5c74');
  g.fillStyle = wg; g.fillRect(gx, wy, gw, gy1 - wy);
  g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(gx, wy + i * 4); g.lineTo(gx + gw, wy + i * 4 + 3); g.stroke(); }
  g.strokeStyle = S.lowWater ? '#ee4b3d' : '#cfa651'; g.lineWidth = 2; g.strokeRect(gx, gy0, gw, gy1 - gy0);
  g.font = '600 15px "IBM Plex Sans Condensed", sans-serif'; g.fillStyle = '#8d9aa2'; g.textAlign = 'center'; g.fillText('WATER', gx + gw / 2, 226);
  // tender
  g.textAlign = 'left'; g.font = '600 16px "IBM Plex Mono", monospace';
  g.fillStyle = '#8d9aa2'; g.fillText('TENDER', 604, 40);
  g.fillStyle = '#dfe4e6'; g.fillText(Math.round(S.water / 3.785 / 100) / 10 + 'k', 604, 66); g.fillStyle = '#8d9aa2'; g.fillText('gal', 604, 86);
  g.fillStyle = '#dfe4e6'; g.fillText((S.coal / 907.2).toFixed(1), 604, 118); g.fillStyle = '#8d9aa2'; g.fillText('tons', 604, 138);
  g.fillStyle = S.autoFire ? '#52d483' : '#cfa651'; g.fillText(S.autoFire ? 'AUTO' : 'HAND', 604, 176); g.fillStyle = '#8d9aa2'; g.fillText('fire', 604, 196);
  g.fillStyle = '#8d9aa2'; g.fillText('STK ' + Math.round(S.stoker * 100), 604, 222);
}

/* ---------------- minimap & full map ---------------- */
const MAP = { visible: false, scale: 0.08, cx: 0, cn: 2400, lines: null };
function mapPrepare() {
  MAP.lines = NET.edges.map(e => { const pts = []; for (let s = 0; s <= e.len; s += Math.max(4, e.len / 400)) pts.push(e.xz(s)); pts.push(e.xz(e.len)); return { e, pts }; });
}
function drawNet(g, W, H, cx, cn, sc, opt) {
  const tx = X => W / 2 + (X - cx) * sc, ty = N => H / 2 - (N - cn) * sc;
  g.lineCap = 'round';
  for (const pass of [0, 1]) for (const L of MAP.lines) {
    const main = L.e.kind === 'main';
    if (pass === 0) { g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = (main ? 4.5 : 3) * opt.w; } else { g.strokeStyle = main ? '#c9d2d6' : (L.e.kind === 'branch' ? '#a9a089' : '#7d8a91'); g.lineWidth = (main ? 2.2 : 1.4) * opt.w; }
    g.beginPath(); L.pts.forEach((p, i) => { const x = tx(p[0]), y = ty(p[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
  }
  // river
  if (opt.river) { g.strokeStyle = 'rgba(70,120,140,0.55)'; g.lineWidth = Math.max(2, 50 * sc); g.beginPath(); WORLD.riverPts.forEach((p, i) => { const x = tx(p[0]), y = ty(p[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); g.fillStyle = 'rgba(70,120,140,0.55)'; g.beginPath(); g.arc(tx(WORLD.lake.X), ty(WORLD.lake.N), WORLD.lake.r * sc, 0, TAU); g.fill(); }
  // stations
  if (opt.labels) {
    g.font = `600 ${opt.fs}px "IBM Plex Sans Condensed", sans-serif`; g.textAlign = 'center';
    for (const st of ROUTE.stations) { const [X, N] = st.edge.xz(st.s); g.fillStyle = '#cfa651'; g.fillRect(tx(X) - 3, ty(N) - 3, 6, 6); g.fillStyle = '#dfe4e6'; g.fillText(st.name.toUpperCase(), tx(X), ty(N) + (st.side > 0 ? 1 : -1) * -14 * opt.w + 4); }
  }
  // switches
  for (const sw of NET.switches) {
    const x = tx(sw.node.X), y = ty(sw.node.N);
    if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
    g.fillStyle = sw.state ? '#f2b33d' : '#52d483'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(x, y, opt.sr, 0, TAU); g.fill(); g.stroke();
    if (opt.swLabels) { g.fillStyle = '#dfe4e6'; g.font = `500 ${opt.fs * 0.85}px "IBM Plex Sans Condensed", sans-serif`; g.textAlign = 'left'; g.fillText(sw.name + ' → ' + sw.lined, x + opt.sr + 4, y + 4); }
  }
  // cuts of cars standing or rolling
  g.strokeStyle = '#b5895a'; g.lineWidth = 3.4 * opt.w;
  for (const c of CARS.cuts) { if (!c.vehicles[0].pos) continue; g.beginPath(); c.vehicles.forEach((v, i) => { const x = tx(v.pos.x), y = ty(-v.pos.z); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); }
  // train
  const T = GAME.train;
  if (T) {
    g.strokeStyle = '#ffe08a'; g.lineWidth = 4 * opt.w; g.beginPath();
    T.vehicles.forEach((v, i) => { const x = tx(v.pos.x), y = ty(-v.pos.z); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    const p = T.lead.pos; g.fillStyle = '#ffffff'; g.beginPath(); g.arc(tx(p.x), ty(-p.z), 3.5 * opt.w, 0, TAU); g.fill();
  }
  JOB.drawMap(g, tx, ty, opt);
  AI.drawMap(g, tx, ty, opt);
  MP.drawMap(g, tx, ty, opt);
  return { tx, ty };
}
function drawMinimap() {
  const c = $('minimap'), g = c.getContext('2d'), W = c.width, H = c.height;
  g.fillStyle = 'rgba(10,14,17,0.92)'; g.fillRect(0, 0, W, H);
  const p = GAME.train.lead.pos;
  drawNet(g, W, H, p.x, -p.z, 0.11, { w: 1.6, sr: 5, labels: true, fs: 15, river: !WORLD.custom });
  g.fillStyle = '#8d9aa2'; g.font = '600 14px "IBM Plex Sans Condensed", sans-serif'; g.textAlign = 'right'; g.fillText('MAP', W - 10, H - 10);
}
MAP.open = function () {
  MAP.visible = true; $('mapView').hidden = false;
  const p = GAME.train ? GAME.train.lead.pos : { x: 0, z: -2400 };
  MAP.cx = 0; MAP.cn = 2700; MAP.scale = Math.min(innerWidth / 11000, innerHeight / 7600);
  if (WORLD.custom) { // frame the whole layout
    let x0 = Infinity, x1 = -Infinity, n0 = Infinity, n1 = -Infinity;
    for (const L of MAP.lines) for (const q of L.pts) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); n0 = Math.min(n0, q[1]); n1 = Math.max(n1, q[1]); }
    MAP.cx = (x0 + x1) / 2; MAP.cn = (n0 + n1) / 2; MAP.scale = clamp(Math.min(innerWidth / (x1 - x0 + 200), innerHeight / (n1 - n0 + 200)) * 0.85, 0.04, 3);
  }
  MAP.draw();
};
MAP.close = function () { MAP.visible = false; $('mapView').hidden = true; };
MAP.draw = function () {
  const c = $('mapCanvas'), dpr = Math.min(2, devicePixelRatio);
  if (c.width !== innerWidth * dpr) { c.width = innerWidth * dpr; c.height = innerHeight * dpr; }
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#0b1013'; g.fillRect(0, 0, innerWidth, innerHeight);
  // grid
  g.strokeStyle = 'rgba(255,255,255,0.04)'; g.lineWidth = 1;
  const step = 1000 * MAP.scale; const ox = (innerWidth / 2 - MAP.cx * MAP.scale) % step, oy = (innerHeight / 2 + MAP.cn * MAP.scale) % step;
  for (let x = ox; x < innerWidth; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, innerHeight); g.stroke(); }
  for (let y = oy; y < innerHeight; y += step) { g.beginPath(); g.moveTo(0, y); g.lineTo(innerWidth, y); g.stroke(); }
  MAP.t = drawNet(g, innerWidth, innerHeight, MAP.cx, MAP.cn, MAP.scale, { w: 1, sr: clamp(MAP.scale * 60, 6, 11), labels: true, fs: 13, swLabels: MAP.scale > 0.35, river: !WORLD.custom });
  g.fillStyle = '#8d9aa2'; g.font = '500 12px "IBM Plex Mono", monospace'; g.textAlign = 'left'; g.fillText('1 km grid', 14, innerHeight - 14);
};
function setupMap() {
  const c = $('mapCanvas'); const ptrs = new Map(); let pinch0 = 0, sc0 = 0, tap = null;
  c.addEventListener('pointerdown', e => { c.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); tap = ptrs.size === 1 ? { x: e.clientX, y: e.clientY } : null; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); sc0 = MAP.scale; } });
  c.addEventListener('pointermove', e => { if (!ptrs.has(e.pointerId)) return; const p = ptrs.get(e.pointerId); const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 8) tap = null;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; MAP.scale = clamp(sc0 * Math.hypot(a.x - b.x, a.y - b.y) / pinch0, 0.04, 3); }
    else { MAP.cx -= dx / MAP.scale; MAP.cn += dy / MAP.scale; }
    MAP.draw(); });
  c.addEventListener('pointerup', e => {
    if (tap && ptrs.size === 1) {
      let best = null, bd = 26;
      for (const sw of NET.switches) { const d = Math.hypot(MAP.t.tx(sw.node.X) - e.clientX, MAP.t.ty(sw.node.N) - e.clientY); if (d < bd) { bd = d; best = sw; } }
      if (best) { GAME.throwSwitch(best); MAP.draw(); }
    }
    ptrs.delete(e.pointerId); tap = null; });
  c.addEventListener('wheel', e => { e.preventDefault(); MAP.scale = clamp(MAP.scale * (1 - e.deltaY * 0.0015), 0.04, 3); MAP.draw(); }, { passive: false });
  $('mapClose').addEventListener('click', () => MAP.close());
}

/* ---------------- couplers panel ---------------- */
const KNUCKLE = '<svg viewBox="0 0 24 24"><path d="M2 12h6.5M15.5 12H22"/><path d="M8.5 8.5v7M15.5 8.5v7"/><path d="M12 3v3.5M12 17.5V21"/></svg>';
const carPanelState = { key: '', t: 0 };
function carPanelToggle(open) {
  const p = $('carPanel'); open = open === undefined ? p.hidden : open;
  p.hidden = !open;
  $('btnCars').classList.toggle('on', open);
  if (open) { $('mpPanel').hidden = true; carPanelState.key = ''; carPanel(); }
}
function carName(T, v) {
  if (v.kind === 'loco') return T.diesel ? 'Lead' : T.locoKey;
  if (v.kind === 'loco2') return 'Unit';
  return CAR_NAMES[v.kind] || v.kind;
}
function carPanel() {
  const T = GAME.train; if (!T || $('carPanel').hidden) return;
  const V = T.vehicles, strip = $('carStrip');
  const key = CARS.gen + ':' + V.length;
  if (key !== carPanelState.key) {
    carPanelState.key = key;
    let h = '';
    V.forEach((v, i) => {
      if (i > 0) h += CARS.canCut(T, i) && !MP.on ? `<button class="cj" type="button" data-j="${i}" aria-label="Pull the pin between ${carName(T, V[i - 1])} ${i} and ${carName(T, v)} ${i + 1}">${KNUCKLE}</button>` : '<span class="cjx"></span>';
      h += `<div class="cv ${isPower(v) ? 'pw' : v.kind}${v.job ? ' wb' : ''}">${v.job ? `<i title="Waybilled to ${v.job.to}">${v.job.tag}</i>` : ''}<b>${carName(T, v)}</b></div>`;
    });
    strip.innerHTML = h;
    const pw = strip.querySelector('.pw'); if (pw) strip.scrollLeft = pw.offsetLeft - strip.clientWidth / 2 + pw.offsetWidth;
  }
  // amber dot: a car whose brakes have not charged yet
  [...strip.querySelectorAll('.cv')].forEach((el, i) => { const v = V[i]; el.classList.toggle('air', !!v && !isPower(v) && v.brake.AR < 62); });
  const cars = V.filter(v => !isPower(v)), ahead = V.slice(0, T.li).filter(v => !isPower(v)).length;
  const tons = Math.round(consistMass(T) / STON).toLocaleString();
  $('carSum').innerHTML = `<b>${cars.length ? cars.length + ' car' + (cars.length > 1 ? 's' : '') : 'Light engine'}</b>${ahead ? ` · ${ahead} ahead of the engine` : ''} · ${tons} tons · front on the left`;
  const charging = cars.filter(v => v.brake.AR < 62).length;
  const moving = Math.abs(S.v) > 0.6;
  $('carHint').innerHTML = MP.on ? 'Car work is single player for now: couplers stay locked in a room.'
    : !cars.length ? 'Back gently into a cut of cars to couple: one knuckle has to be open, or the cars are only shoved. Tap a coupler on the cars to open or close it.'
    : (moving ? '<b>Moving:</b> pulling a pin kicks the cars. Brake right after and they roll free.' : '<b>Stopped:</b> tap a coupler here, or the cut lever on the cars themselves, to cut cars off. They are set out and tied down where they stand.')
      + (charging ? ` <b>${charging}</b> car${charging > 1 ? 's' : ''} still charging air (amber).` : '');
}
CARS.onChange = () => carPanel();

/* ---------------- toasts ---------------- */
const TOASTS = [];
function toast(msg, kind = '', ms = 3600, key) {
  const now = performance.now();
  if (key) { const prev = TOASTS.find(t => t.key === key && now - t.t < ms + 1500); if (prev) return; }
  const box = $('toast'); const el = document.createElement('div'); el.className = 'toast ' + kind; el.textContent = msg; box.appendChild(el);
  const t = { el, t: now, key }; TOASTS.push(t);
  while (box.children.length > 3) box.removeChild(box.firstChild);
  setTimeout(() => { el.remove(); }, ms);
}

function drawDieselGauges(g, dial, b, lastBP) {
  const nU = (GAME.train && GAME.train.nUnits) || 1, mx = 200 * nU;
  const te = Math.abs(S.TE) / LBF / 1000, db = S.DBF * nU / LBF / 1000;
  dial(108, 112, 96, mx, nU > 1 ? `TE · DB  klbf ×${nU}` : 'TE · DB  klbf', [[te, '#151515'], [db, '#c0281e']], [170 * nU, mx], 50 * nU, 10 * nU);
  g.font = '600 18px "IBM Plex Mono", monospace'; g.textAlign = 'center';
  g.fillStyle = S.slipCtl ? '#ee4b3d' : '#cfa651'; g.fillText(S.slipCtl ? 'WHEEL SLIP' : (S.notch ? 'N' + S.notch : (S.dyn > 0.06 ? 'DYN BRAKE' : 'IDLE')) + ' · ' + Math.round(S.rpm) + ' rpm', 108, 224);
  dial(296, 86, 70, 160, 'MR · EQ', [[S.MR, '#c0281e'], [S.ER, '#151515']], null, 40, 10);
  dial(458, 86, 70, 160, 'BP · BC', [[b ? GAME.train.lead.brake.BP : 90, '#151515'], [S.BCloco || 0, '#c0281e']], null, 40, 10);
  g.font = '600 17px "IBM Plex Mono", monospace'; g.fillStyle = '#8d9aa2';
  g.fillText('LOAD ' + Math.round(S.amps) + ' A', 296, 186); g.fillText('REAR ' + Math.round(lastBP), 458, 186);
  g.fillText('TURBO ' + Math.round(S.turbo * 100) + '%', 296, 212);
  g.fillStyle = S.engineRun ? '#52d483' : (S.crank > 0 ? '#f2b33d' : '#ee4b3d'); g.fillText(S.engineRun ? 'ENGINE RUN' : (S.crank > 0 ? 'CRANKING' : 'ENGINE OFF'), 458, 212);
  // fuel gauge (vertical bar like the steam water glass)
  const gx = 560, gy0 = 26, gy1 = 200, gw = 26;
  g.fillStyle = '#6d531f'; g.fillRect(gx - 6, gy0 - 14, gw + 12, 12); g.fillRect(gx - 6, gy1 + 2, gw + 12, 12);
  g.fillStyle = '#0d1418'; g.fillRect(gx, gy0, gw, gy1 - gy0);
  const lvl = clamp(S.fuel / 18927, 0, 1), fy = gy1 - lvl * (gy1 - gy0);
  const fg = g.createLinearGradient(gx, 0, gx + gw, 0); fg.addColorStop(0, '#6b4e16'); fg.addColorStop(0.5, '#d8a646'); fg.addColorStop(1, '#6b4e16');
  g.fillStyle = fg; g.fillRect(gx, fy, gw, gy1 - fy);
  g.strokeStyle = lvl < 0.1 ? '#ee4b3d' : '#cfa651'; g.lineWidth = 2; g.strokeRect(gx, gy0, gw, gy1 - gy0);
  g.font = '600 15px "IBM Plex Sans Condensed", sans-serif'; g.fillStyle = '#8d9aa2'; g.textAlign = 'center'; g.fillText('FUEL', gx + gw / 2, 226);
  g.textAlign = 'left'; g.font = '600 16px "IBM Plex Mono", monospace';
  g.fillStyle = '#8d9aa2'; g.fillText('FUEL', 604, 40);
  g.fillStyle = '#dfe4e6'; g.fillText(Math.round(S.fuel / 3.785).toLocaleString(), 604, 66); g.fillStyle = '#8d9aa2'; g.fillText('gal', 604, 86);
  g.fillStyle = '#dfe4e6'; g.fillText(S.notch ? 'N' + S.notch : 'IDLE', 604, 118); g.fillStyle = '#8d9aa2'; g.fillText('notch', 604, 138);
  g.fillStyle = S.dyn > 0.06 ? '#f2b33d' : '#dfe4e6'; g.fillText(S.dyn > 0.06 ? Math.round(S.dbLoad * 100) + '%' : 'OFF', 604, 176); g.fillStyle = '#8d9aa2'; g.fillText('dyn brk', 604, 196);
  g.fillStyle = S.sander ? '#cfa651' : '#8d9aa2'; g.fillText(S.sander ? 'SAND ON' : 'SAND', 604, 222);
}

/* electric set: tractive and regenerative effort, air, line and power from the wire */
function drawElectricGauges(g, dial, b, lastBP) {
  const sp = LOCO_SPEC[GAME.train.locoKey], mx = Math.ceil(sp.TEmax / 1000 / 100) * 100 + 100;
  const te = Math.abs(S.TE) / 1000, rb = (S.DBF + S.blend) / 1000;
  dial(108, 112, 96, mx, 'TE · REGEN  kN', [[te, '#151515'], [rb, '#2a7fd0']], null, 100, 20);
  g.font = '600 18px "IBM Plex Mono", monospace'; g.textAlign = 'center';
  g.fillStyle = S.slipCtl ? '#ee4b3d' : '#cfa651'; g.fillText(S.slipCtl ? 'WHEEL SLIP' : (S.notch ? 'P' + S.notch : (S.dyn > 0.06 ? 'REGEN' : 'OFF')) + ' · ' + Math.round(Math.abs(S.v) * 3.6) + ' km/h', 108, 224);
  dial(296, 86, 70, 160, 'MR · EQ', [[S.MR, '#c0281e'], [S.ER, '#151515']], null, 40, 10);
  dial(458, 86, 70, 160, 'BP · BC', [[b ? GAME.train.lead.brake.BP : 90, '#151515'], [S.BCloco || 0, '#c0281e']], null, 40, 10);
  g.font = '600 17px "IBM Plex Mono", monospace'; g.fillStyle = '#8d9aa2';
  g.fillText((S.kW < 0 ? 'RETURN ' : 'DRAW ') + Math.abs(Math.round(S.kW)).toLocaleString() + ' kW', 296, 186); g.fillText('REAR ' + Math.round(lastBP), 458, 186);
  g.fillText('LINE ' + (S.vcb ? '25.0 kV' : '—'), 296, 212);
  g.fillStyle = S.vcb ? '#52d483' : (S.panUp ? '#f2b33d' : '#ee4b3d'); g.fillText(S.vcb ? 'BREAKER IN' : (S.panUp ? 'PAN RISING' : 'PAN DOWN'), 458, 212);
  // pantograph height, where the diesel has its fuel gauge
  const gx = 560, gy0 = 26, gy1 = 200, gw = 26;
  g.fillStyle = '#6d531f'; g.fillRect(gx - 6, gy0 - 14, gw + 12, 12); g.fillRect(gx - 6, gy1 + 2, gw + 12, 12);
  g.fillStyle = '#0d1418'; g.fillRect(gx, gy0, gw, gy1 - gy0);
  const py = gy1 - S.pan * (gy1 - gy0);
  g.fillStyle = '#9ea3a8'; g.fillRect(gx, py, gw, 4); g.fillStyle = 'rgba(158,163,168,0.25)'; g.fillRect(gx, py + 4, gw, gy1 - py - 4);
  g.strokeStyle = '#cfa651'; g.lineWidth = 2; g.strokeRect(gx, gy0, gw, gy1 - gy0);
  g.font = '600 15px "IBM Plex Sans Condensed", sans-serif'; g.fillStyle = '#8d9aa2'; g.textAlign = 'center'; g.fillText('PAN', gx + gw / 2, 226);
  g.textAlign = 'left'; g.font = '600 16px "IBM Plex Mono", monospace';
  g.fillStyle = '#8d9aa2'; g.fillText('ENERGY', 604, 40);
  g.fillStyle = '#dfe4e6'; g.fillText(Math.round(S.kWh).toLocaleString(), 604, 66); g.fillStyle = '#8d9aa2'; g.fillText('kWh', 604, 86);
  g.fillStyle = '#dfe4e6'; g.fillText(S.notch ? 'P' + S.notch : 'OFF', 604, 118); g.fillStyle = '#8d9aa2'; g.fillText('power', 604, 138);
  g.fillStyle = S.dyn > 0.06 ? '#2a7fd0' : '#dfe4e6'; g.fillText(S.dyn > 0.06 ? Math.round(S.dbLoad * 100) + '%' : 'OFF', 604, 176); g.fillStyle = '#8d9aa2'; g.fillText('regen', 604, 196);
  g.fillStyle = S.sander ? '#cfa651' : '#8d9aa2'; g.fillText(S.sander ? 'SAND ON' : 'SAND', 604, 222);
}

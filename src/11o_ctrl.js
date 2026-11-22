/* ============================================================================
   Controls: every driving key goes through a table of actions, so a key or a
   gamepad button can be moved to another one from the Controls list under
   Driving in the menu (saved in localStorage bd_ctrl, only what differs from
   the defaults). The default keys are the ones the game always had.
   Gamepads use the browser Gamepad API with the standard layout: triggers work
   the throttle, bumpers the train brake, the D-pad the reverser and engine
   brake, A the whistle, the right stick looks round and the left stick zooms
   (or walks, on foot). In the menu the D-pad or stick moves between buttons,
   A presses, LB and RB change tab and B or Menu goes back to the railroad.
   Walking and placing cars keep their own fixed keys (11j_walk.js, 11f_place.js).
   ========================================================================== */
const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'L3', 'R3', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →', 'Home'];
const PAD_TRIG = [6, 7];   // analog buttons: how hard they are pulled sets how fast they repeat
/* id, label, group, default keys (up to two), default pad button (-1 none), rep: keyboard auto-repeat is allowed,
   pr: [steam, diesel] seconds between repeats while a pad button is held (0: once per press), hold: let go matters */
const CTRL_ACTIONS = [
  { id: 'throttleUp', label: 'Throttle open', g: 'Driving', keys: ['KeyW'], pad: 7, rep: 1, pr: [0.05, 0.32] },
  { id: 'throttleDown', label: 'Throttle close', g: 'Driving', keys: ['KeyS'], pad: 6, rep: 1, pr: [0.04, 0.28] },
  { id: 'revFwd', label: 'Reverser forward', g: 'Driving', keys: ['ArrowUp'], pad: 12, rep: 1, pr: [0.07, 0] },
  { id: 'revBack', label: 'Reverser back', g: 'Driving', keys: ['ArrowDown'], pad: 13, rep: 1, pr: [0.07, 0] },
  { id: 'brakeRel', label: 'Train brake release', g: 'Driving', keys: ['KeyQ'], pad: 4, rep: 1, pr: [0.05, 0.05] },
  { id: 'brakeApp', label: 'Train brake apply', g: 'Driving', keys: ['KeyE'], pad: 5, rep: 1, pr: [0.05, 0.05] },
  { id: 'indRel', label: 'Engine brake release', g: 'Driving', keys: ['KeyZ'], pad: 14, rep: 1, pr: [0.05, 0.05] },
  { id: 'indApp', label: 'Engine brake apply', g: 'Driving', keys: ['KeyC'], pad: 15, rep: 1, pr: [0.05, 0.05] },
  { id: 'dynUp', label: 'Dynamic brake up (diesel)', g: 'Driving', keys: ['KeyD'], pad: -1, rep: 1, pr: [0.15, 0.15], hold: 1 },
  { id: 'dynDown', label: 'Dynamic brake down (diesel)', g: 'Driving', keys: ['KeyA'], pad: -1, rep: 1, pr: [0.15, 0.15], hold: 1 },
  { id: 'whistle', label: 'Whistle / horn (hold)', g: 'Driving', keys: ['Space'], pad: 0, hold: 1 },
  { id: 'bell', label: 'Bell', g: 'Driving', keys: ['KeyB'], pad: 1 },
  { id: 'throwSwitch', label: 'Throw next switch ahead', g: 'Driving', keys: ['KeyT'], pad: 2 },
  { id: 'sander', label: 'Sand', g: 'Engine', keys: ['KeyX'], pad: 10 },
  { id: 'light', label: 'Headlight', g: 'Engine', keys: ['KeyH'], pad: 11 },
  { id: 'cocks', label: 'Cylinder cocks / ditch lights', g: 'Engine', keys: ['KeyK'], pad: -1 },
  { id: 'classLamps', label: 'Green class lamps', g: 'Engine', keys: ['KeyJ'], pad: -1 },
  { id: 'injector', label: 'Injector / engine start', g: 'Engine', keys: ['KeyI'], pad: -1 },
  { id: 'stoker', label: 'Stoker', g: 'Engine', keys: ['KeyF'], pad: -1 },
  { id: 'blower', label: 'Blower', g: 'Engine', keys: ['KeyL'], pad: -1 },
  { id: 'camCycle', label: 'Next camera', g: 'Camera', keys: ['KeyV'], pad: 3 },
  { id: 'cam1', label: 'Chase camera', g: 'Camera', keys: ['Digit1'], pad: -1 },
  { id: 'cam2', label: 'Cab camera', g: 'Camera', keys: ['Digit2'], pad: -1 },
  { id: 'cam3', label: 'Lineside camera', g: 'Camera', keys: ['Digit3'], pad: -1 },
  { id: 'cam4', label: 'Drone camera', g: 'Camera', keys: ['Digit4'], pad: -1 },
  { id: 'cam5', label: 'Rear camera', g: 'Camera', keys: ['Digit5'], pad: -1 },
  { id: 'cam6', label: 'Cinematic camera', g: 'Camera', keys: ['Digit6'], pad: -1 },
  { id: 'camLeft', label: 'Turn camera left', g: 'Camera', keys: ['ArrowLeft'], pad: -1, rep: 1, pr: [0.04, 0.04] },
  { id: 'camRight', label: 'Turn camera right', g: 'Camera', keys: ['ArrowRight'], pad: -1, rep: 1, pr: [0.04, 0.04] },
  { id: 'zoomOut', label: 'Zoom out', g: 'Camera', keys: ['Minus', 'NumpadSubtract'], pad: -1, rep: 1, pr: [0.05, 0.05] },
  { id: 'zoomIn', label: 'Zoom in', g: 'Camera', keys: ['Equal', 'NumpadAdd'], pad: -1, rep: 1, pr: [0.05, 0.05] },
  { id: 'cabLook', label: 'Cab: look at the next gauge', g: 'Camera', keys: ['KeyN'], pad: -1 },
  { id: 'cars', label: 'Couplers panel', g: 'Other', keys: ['KeyU'], pad: -1 },
  { id: 'place', label: 'Place engines and cars', g: 'Other', keys: ['KeyG'], pad: -1 },
  { id: 'fleet', label: 'Trains panel', g: 'Other', keys: ['KeyO'], pad: -1 },
  { id: 'fleetPrev', label: 'Previous train', g: 'Other', keys: ['BracketLeft'], pad: -1 },
  { id: 'fleetNext', label: 'Next train', g: 'Other', keys: ['BracketRight'], pad: -1 },
  { id: 'leaveCab', label: 'Get down from the cab', g: 'Other', keys: ['Enter', 'NumpadEnter'], pad: -1 },
  { id: 'map', label: 'Map', g: 'Other', keys: ['KeyM'], pad: 8 },
  { id: 'pause', label: 'Menu / pause', g: 'Other', keys: ['KeyP'], pad: 9 },
];
const CTRL_A = {}; for (const a of CTRL_ACTIONS) CTRL_A[a.id] = a;
/* keys the list will not take: Escape cancels, Backspace and Delete clear */
const CTRL_RESERVED = ['Escape', 'Backspace', 'Delete', 'Tab', 'MetaLeft', 'MetaRight', 'ContextMenu'];

const CTRL = { keys: {}, pad: {}, byCode: {}, byBtn: {}, listen: null, note: '' };
CTRL.defaults = function () { for (const a of CTRL_ACTIONS) { CTRL.keys[a.id] = a.keys.slice(); CTRL.pad[a.id] = a.pad; } };
CTRL.index = function () {
  CTRL.byCode = {}; CTRL.byBtn = {};
  for (const a of CTRL_ACTIONS) { for (const c of CTRL.keys[a.id]) if (c) CTRL.byCode[c] = a.id; const b = CTRL.pad[a.id]; if (b >= 0) CTRL.byBtn[b] = a.id; }
};
/* saved: only the actions that differ from the defaults; a key a saved action took is taken off the default it had */
CTRL.load = function () {
  CTRL.defaults();
  let o = null; try { o = JSON.parse(localStorage.getItem('bd_ctrl') || 'null'); } catch (e) {}
  if (o && typeof o === 'object') {
    const k = o.k || {}, p = o.p || {};
    for (const id in k) if (CTRL_A[id] && Array.isArray(k[id])) CTRL.keys[id] = k[id].filter(c => typeof c === 'string' && c && !CTRL_RESERVED.includes(c)).slice(0, 2);
    for (const id in p) if (CTRL_A[id] && Number.isInteger(p[id]) && p[id] >= -1 && p[id] < PAD_NAMES.length) CTRL.pad[id] = p[id];
    for (const id in k) if (CTRL_A[id]) for (const c of CTRL.keys[id]) for (const a of CTRL_ACTIONS) if (a.id !== id && !(a.id in k)) CTRL.keys[a.id] = CTRL.keys[a.id].filter(x => x !== c);
    for (const id in p) if (CTRL_A[id] && CTRL.pad[id] >= 0) for (const a of CTRL_ACTIONS) if (a.id !== id && !(a.id in p) && CTRL.pad[a.id] === CTRL.pad[id]) CTRL.pad[a.id] = -1;
  }
  CTRL.index();
};
CTRL.save = function () {
  const k = {}, p = {};
  for (const a of CTRL_ACTIONS) {
    if (CTRL.keys[a.id].join() !== a.keys.join()) k[a.id] = CTRL.keys[a.id].slice();
    if (CTRL.pad[a.id] !== a.pad) p[a.id] = CTRL.pad[a.id];
  }
  try { if (Object.keys(k).length || Object.keys(p).length) localStorage.setItem('bd_ctrl', JSON.stringify({ k, p })); else localStorage.removeItem('bd_ctrl'); } catch (e) {}
};
CTRL.keyAct = code => CTRL.byCode[code] || null;
/* put a key in an action's slot (0 or 1), or a pad button on it; whatever else had it lets it go. Returns what lost it. */
CTRL.bindKey = function (id, slot, code) {
  let lost = null;
  for (const a of CTRL_ACTIONS) { const ks = CTRL.keys[a.id]; const i = ks.indexOf(code); if (i >= 0 && !(a.id === id && i === slot)) { ks.splice(i, 1); if (a.id !== id) lost = a.id; } }
  const ks = CTRL.keys[id]; if (code) { if (slot < ks.length) ks[slot] = code; else ks.push(code); } else ks.splice(slot, 1);
  CTRL.keys[id] = ks.filter(Boolean).slice(0, 2);
  CTRL.index(); CTRL.save(); return lost;
};
CTRL.bindPad = function (id, btn) {
  let lost = null;
  if (btn >= 0) for (const a of CTRL_ACTIONS) if (a.id !== id && CTRL.pad[a.id] === btn) { CTRL.pad[a.id] = -1; lost = a.id; }
  CTRL.pad[id] = btn; CTRL.index(); CTRL.save(); return lost;
};
CTRL.reset = function () { CTRL.defaults(); CTRL.index(); CTRL.save(); };

/* ---------------- names ---------------- */
const CTRL_KEYNAME = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Minus: '−', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Backquote: '`',
  ShiftLeft: 'L Shift', ShiftRight: 'R Shift', ControlLeft: 'L Ctrl', ControlRight: 'R Ctrl', AltLeft: 'L Alt', AltRight: 'R Alt', NumpadAdd: 'Num +', NumpadSubtract: 'Num −', NumpadMultiply: 'Num *', NumpadDivide: 'Num /', NumpadEnter: 'Num Enter', NumpadDecimal: 'Num .', CapsLock: 'Caps', PageUp: 'PgUp', PageDown: 'PgDn' };
CTRL.keyName = code => !code ? '' : CTRL_KEYNAME[code] || code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ');
CTRL.padName = b => b >= 0 && b < PAD_NAMES.length ? PAD_NAMES[b] : '';
/* the first key on an action, and its pad button while a pad is plugged in, as <kbd>s (the guided first run uses this) */
CTRL.hint = function (id) {
  const a = CTRL_A[id]; if (!a) return `<kbd>${id}</kbd>`;
  const k = CTRL.keys[id][0], b = CTRL.pad[id];
  const parts = [];
  if (k) parts.push(`<kbd>${CTRL.keyName(k)}</kbd>`);
  if (PAD.connected() && b >= 0) parts.push(`<kbd>${CTRL.padName(b)}</kbd>`);
  return parts.length ? parts.join(' / ') : `<kbd>${a.label} (no key set)</kbd>`;
};

/* ---------------- what each action does ---------------- */
CTRL.ice = () => typeof iceSkating === 'function' && iceSkating();
/* o: { shift, v (0..1 how hard a pad button is pulled), pad } */
CTRL.act = function (id, o = {}) {
  // skating across the frozen lake: the dynamic brake keys sand the left or right drivers to swing her (10n_ice.js)
  if ((id === 'dynUp' || id === 'dynDown') && CTRL.ice()) { ICE.sk.steer = id === 'dynDown' ? 1 : -1; return; }
  const dsl = GAME.isDiesel();
  switch (id) {
    case 'throttleUp': S.throttle = dsl ? clamp(Math.round(S.throttle * GAME.notches() + 1) / GAME.notches(), 0, 1) : clamp(S.throttle + 0.04, 0, 1); break;
    case 'throttleDown': S.throttle = dsl ? clamp(Math.round(S.throttle * GAME.notches() - 1) / GAME.notches(), 0, 1) : clamp(S.throttle - 0.06, 0, 1); break;
    case 'dynUp': if (dsl) S.dyn = clamp(S.dyn < 0.06 ? 0.06 : S.dyn + 0.1, 0, 1); break;
    case 'dynDown': if (dsl) S.dyn = S.dyn <= 0.07 ? 0 : clamp(S.dyn - 0.1, 0.06, 1); break;
    case 'revFwd': S.reverser = dsl ? clamp(Math.round(S.reverser) + 1, -1, 1) : clamp(Math.round((S.reverser + 1 / 17) * 17) / 17, -1, 1); break;
    case 'revBack': S.reverser = dsl ? clamp(Math.round(S.reverser) - 1, -1, 1) : clamp(Math.round((S.reverser - 1 / 17) * 17) / 17, -1, 1); break;
    case 'brakeRel': S.brakeH = clamp(S.brakeH - 0.03, 0, 1); break;
    case 'brakeApp': S.brakeH = clamp(S.brakeH + 0.03, 0, 1); break;
    case 'indRel': S.indH = clamp(S.indH - 0.05, 0, 1); break;
    case 'indApp': S.indH = clamp(S.indH + 0.05, 0, 1); break;
    case 'whistle': S.whistle = o.pad ? (o.trig ? 0.3 + 0.7 * (o.v || 1) : 0.7) : o.shift ? 1 : 0.7; break;
    case 'bell': S.bell = !S.bell; break;
    case 'classLamps': if (!dsl && !(GAME.train && GAME.train.elec)) S.classLamps = !S.classLamps; break;
    case 'sander': S.sander = !S.sander; break;
    case 'cocks': if (GAME.isTurbine()) turbineSwitch(); else if (dsl) S.ditch = !S.ditch; else S.cocks = !S.cocks; break;
    case 'light': S.light = (S.light + 1) % 3; break;
    case 'injector': $('btnInj').click(); break;
    case 'stoker': if (dsl) break; GAME.manualFire('stoker'); S.stoker = clamp(S.stoker + 0.25, 0, 1.0001) > 1 ? 0 : S.stoker + 0.25; break;
    case 'blower': if (dsl) break; GAME.manualFire('blower'); S.blower = S.blower > 0.3 ? 0 : 0.65; break;
    case 'throwSwitch': GAME.throwAhead(); break;
    case 'cabLook': CAB.nextLook(); break;
    case 'cars': carPanelToggle(); break;
    case 'place': PLACE.enter(); break;
    case 'fleet': FLEET.toggle(); break;
    case 'fleetPrev': FLEET.cycle(-1); break;
    case 'fleetNext': FLEET.cycle(1); break;
    case 'map': MAP.visible ? MAP.close() : MAP.open(); break;
    case 'pause': GAME.pause(!S.paused); break;
    case 'leaveCab': WALK.leaveCab(); return;
    case 'cam1': cycleCamera('chase'); break; case 'cam2': cycleCamera('cab'); break; case 'cam3': cycleCamera('side'); break;
    case 'cam4': cycleCamera('drone'); break; case 'cam5': cycleCamera('rear'); break; case 'cam6': cycleCamera('cine'); break;
    case 'camCycle': cycleCamera(); break;
    case 'camLeft': case 'camRight': { const d = (id === 'camLeft' ? 1 : -1) * 0.07; if (CAM.mode === 'drone') CAM.droneYaw += d; else if (CAM.mode === 'chase') CAM.yaw += d; else if (CAM.mode === 'cab') CAM.cabYaw = clamp(CAM.cabYaw + d, -2.2, 2.2); break; }
    case 'zoomOut': CAM.dist = clamp(CAM.dist * 1.12, 7, 140); break;
    case 'zoomIn': CAM.dist = clamp(CAM.dist / 1.12, 7, 140); break;
  }
  GAME.refreshKeys();
};
/* letting go: the whistle stops, and on the ice the drivers stop being sanded */
CTRL.release = function (id) {
  if (id === 'dynUp' || id === 'dynDown') { if (typeof ICE !== 'undefined' && ICE.sk) ICE.sk.steer = 0; }
  if (id === 'whistle') S.whistle = 0;
};
/* keys the browser would act on (scroll, find), held back when they drive something */
CTRL.ownKey = code => /^(Arrow|Space$|Tab$|Slash$|Quote$|Backquote$|F\d+$|PageUp$|PageDown$|Home$|End$)/.test(code);

/* ---------------- gamepad ---------------- */
const PAD = { seen: false, idx: -1, name: '', prev: [], held: {}, nav: { t: 0, dir: '' }, stickT: 0 };
PAD.DEAD = 0.18;
PAD.list = () => { try { return navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : []; } catch (e) { return []; } };
PAD.connected = () => PAD.seen && PAD.idx >= 0;
PAD.get = function () {
  const all = PAD.list();
  const p = all.find(g => g.index === PAD.idx && g.connected) || all.find(g => g.connected && g.buttons && g.buttons.length >= 10) || null;
  const was = PAD.idx; PAD.idx = p ? p.index : -1; PAD.name = p ? p.id : '';
  if (PAD.idx !== was) CTRL.refreshUI();
  return p;
};
PAD.val = (p, i) => { const b = p.buttons[i]; return !b ? 0 : typeof b === 'object' ? (b.pressed ? Math.max(b.value, 0.5) : b.value > 0.15 ? b.value : 0) : b; };
PAD.down = (p, i) => PAD.val(p, i) > 0.3;
PAD.axis = (p, i) => { const v = p.axes[i] || 0; return Math.abs(v) < PAD.DEAD ? 0 : (v - Math.sign(v) * PAD.DEAD) / (1 - PAD.DEAD); };
PAD.setup = function () {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
  addEventListener('gamepadconnected', e => { PAD.seen = true; PAD.idx = e.gamepad.index; PAD.prev = []; PAD.held = {}; CTRL.refreshUI(); if (e.gamepad.buttons.length >= 10) toast('Controller connected: triggers work the throttle, bumpers the train brake, A the whistle. Rebind it under Driving in the menu.', '', 5000, 'pad'); });
  addEventListener('gamepaddisconnected', e => { if (e.gamepad.index === PAD.idx) { PAD.idx = -1; for (const id in PAD.held) CTRL.release(id); PAD.held = {}; if (WALK.stick.pad) { WALK.stick.on = false; WALK.stick.pad = false; WALK.stick.x = WALK.stick.y = 0; } CTRL.refreshUI(); } });
};
/* once a frame from the main loop */
PAD.poll = function (dt) {
  if (!PAD.seen) return;
  const p = PAD.get(); if (!p) return;
  const n = Math.min(p.buttons.length, PAD_NAMES.length), now = [];
  for (let i = 0; i < n; i++) now[i] = PAD.down(p, i);
  const pressed = i => now[i] && !PAD.prev[i];
  const menuOpen = $('menu').hidden === false;
  // a button for the Controls list
  if (CTRL.listen && CTRL.listen.kind === 'pad') {
    for (let i = 0; i < n; i++) if (pressed(i) && !CTRL.listen.ignore[i]) { CTRL.finishPad(i); break; }
    for (let i = 0; i < n; i++) if (!now[i]) CTRL.listen && (CTRL.listen.ignore[i] = false);
  } else if (menuOpen) PAD.menu(p, now, pressed, dt);
  else if (!PLACE.on) PAD.drive(p, now, pressed, dt);
  PAD.prev = now;
};
/* driving: the bound buttons, and the sticks for looking round and zooming (or walking) */
PAD.drive = function (p, now, pressed, dt) {
  if (WALK.on) { PAD.walk(p, now, pressed, dt); return; }
  if (MAP.visible && pressed(1)) { MAP.close(); return; }
  const dsl = GAME.isDiesel() ? 1 : 0;
  for (let i = 0; i < now.length; i++) {
    const id = CTRL.byBtn[i]; if (!id) continue;
    const a = CTRL_A[id], trig = PAD_TRIG.includes(i), v = PAD.val(p, i);
    if (pressed(i)) { PAD.held[id] = { t: 0.28, b: i }; CTRL.act(id, { pad: true, trig, v }); }
    else if (now[i] && PAD.held[id]) {
      const h = PAD.held[id], every = a.pr ? a.pr[dsl] : 0;
      if (id === 'whistle' && trig) S.whistle = 0.3 + 0.7 * v;   // a trigger feathers the whistle
      if (every > 0) { h.t -= dt * (trig ? Math.max(0.3, v) : 1); if (h.t <= 0) { h.t += every; CTRL.act(id, { pad: true, trig, v }); } }
    } else if (!now[i] && PAD.held[id] && PAD.held[id].b === i) { delete PAD.held[id]; if (a.hold) CTRL.release(id); }
  }
  // right stick looks round, as a drag would
  const rx = PAD.axis(p, 2), ry = PAD.axis(p, 3);
  if (rx || ry) PAD.look(rx * 700 * dt, ry * 500 * dt);
  // left stick: up and down zooms the outside cameras
  const ly = PAD.axis(p, 1);
  if (ly && CAM.mode !== 'cab') CAM.dist = clamp(CAM.dist * Math.pow(1.9, ly * dt), 7, 140);
};
PAD.look = function (dx, dy) {
  if (WALK.on) { WALK.look(dx, dy); return; }
  const k = 0.006;
  if (CAM.mode === 'chase') { CAM.yaw -= dx * k; CAM.pitch = clamp(CAM.pitch + dy * k * 0.8, -0.16, 1.35); }
  else if (CAM.mode === 'cab') { CAB.lookTo = null; CAM.cabYaw = clamp(CAM.cabYaw - dx * k * 0.7, -2.2, 2.2); CAM.cabPitch = clamp(CAM.cabPitch - dy * k * 0.7, -0.8, 0.6); }
  else if (CAM.mode === 'drone') { CAM.droneYaw -= dx * k; CAM.dronePitch = clamp(CAM.dronePitch + dy * k * 0.6, 0.35, 1.5); }
};
/* on foot: left stick walks (pushed all the way, he runs), right stick looks, A boards or sits, B back to the cab, Y the view */
PAD.walk = function (p, now, pressed, dt) {
  const lx = PAD.axis(p, 0), ly = PAD.axis(p, 1), st = WALK.stick;
  if (lx || ly) { st.on = true; st.pad = true; st.x = lx; st.y = ly; }
  else if (st.pad) { st.on = false; st.pad = false; st.x = st.y = 0; }
  const rx = PAD.axis(p, 2), ry = PAD.axis(p, 3);
  if (rx || ry) WALK.look(rx * 700 * dt, ry * 500 * dt);
  if (pressed(0)) WALK.doAction();
  if (pressed(1)) WALK.toCab();
  if (pressed(3)) WALK.toggleView();
  if (pressed(CTRL.pad.map)) { MAP.visible ? MAP.close() : MAP.open(); }
  if (pressed(CTRL.pad.pause)) GAME.pause(true);
};

/* ---------------- the menu with a gamepad ---------------- */
PAD.focusables = function () {
  const root = $('menu');
  return [...root.querySelectorAll('button, summary, input, select, a[href], [tabindex]:not([tabindex="-1"])')]
    .filter(el => !el.disabled && el.type !== 'hidden' && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
};
PAD.focus = function (el) {
  if (!el) return;
  const old = document.querySelector('.padFocus'); if (old) old.classList.remove('padFocus');
  el.classList.add('padFocus');
  try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
};
/* the nearest control that way, favouring ones straight in line */
PAD.step = function (dir) {
  const els = PAD.focusables(); if (!els.length) return;
  let cur = document.activeElement; if (!els.includes(cur)) { PAD.focus($('btnStart') && els.includes($('btnStart')) ? $('btnStart') : els[0]); return; }
  const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const [ux, uy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
  let best = null, bs = Infinity;
  for (const el of els) {
    if (el === cur) continue;
    const q = el.getBoundingClientRect();
    // the gap along the way we are going, edge to edge, and how far off the line it is
    const along = ux ? (ux > 0 ? q.left - r.right : r.left - q.right) : (uy > 0 ? q.top - r.bottom : r.top - q.bottom);
    const qx = q.left + q.width / 2, qy = q.top + q.height / 2;
    const ctr = ux ? (qx - cx) * ux : (qy - cy) * uy;
    if (ctr <= Math.max(2, (ux ? r.width : r.height) * 0.5)) continue;   // its middle has to lie well past ours that way
    const off = ux ? Math.max(0, Math.abs(qy - cy) - (r.height + q.height) / 2) : Math.max(0, Math.abs(qx - cx) - (r.width + q.width) / 2);
    const s = Math.max(0, along) + off * 3 + Math.abs(ux ? qy - cy : qx - cx) * 0.2;
    if (s < bs) { bs = s; best = el; }
  }
  if (best) PAD.focus(best);
};
PAD.menu = function (p, now, pressed, dt) {
  const lx = PAD.axis(p, 0), ly = PAD.axis(p, 1);
  const dir = now[12] || ly < -0.5 ? 'up' : now[13] || ly > 0.5 ? 'down' : now[14] || lx < -0.5 ? 'left' : now[15] || lx > 0.5 ? 'right' : '';
  const N = PAD.nav;
  if (dir && dir !== N.dir) { N.t = 0.38; PAD.navGo(dir); }
  else if (dir) { N.t -= dt; if (N.t <= 0) { N.t = 0.11; PAD.navGo(dir); } }
  N.dir = dir;
  // the right stick scrolls the pane
  const ry = PAD.axis(p, 3), panes = $('menuPanes'); if (ry && panes) panes.scrollTop += ry * 900 * dt;
  if (pressed(0)) { const el = document.activeElement; if (el && PAD.focusables().includes(el) && !(el.tagName === 'INPUT' && el.type === 'range')) el.click(); else PAD.step('down'); }
  if (pressed(4) || pressed(5)) PAD.tab(pressed(5) ? 1 : -1);
  if (pressed(9) || pressed(1)) {
    const m = $('menu');
    if (pressed(1) && m.classList.contains('mini')) menuMini(false);
    else if (GAME.running && $('btnStart').textContent === 'Resume') $('btnStart').click();
    else if (pressed(9) && !$('btnStart').disabled) $('btnStart').click();
  }
};
/* left and right on a slider moves it; otherwise the focus moves */
PAD.navGo = function (dir) {
  const el = document.activeElement;
  if (el && el.tagName === 'INPUT' && el.type === 'range' && (dir === 'left' || dir === 'right') && el.classList.contains('padFocus')) {
    if (dir === 'right') el.stepUp(); else el.stepDown();
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  PAD.step(dir);
};
PAD.tab = function (d) {
  const row = $('menuTabs'); if (!row) return;
  const live = [...row.children].filter(b => !b.hidden); if (!live.length) return;
  const i = live.findIndex(b => b.getAttribute('aria-selected') === 'true');
  const b = live[(i + d + live.length) % live.length]; b.click(); PAD.focus(b);
};

/* ---------------- the Controls list (Driving tab) ---------------- */
CTRL.startListen = function (id, kind, slot, el) {
  CTRL.stopListen();
  const ignore = {}; if (kind === 'pad') { const p = PAD.get(); if (p) for (let i = 0; i < p.buttons.length; i++) ignore[i] = PAD.down(p, i); }
  CTRL.listen = { id, kind, slot, el, ignore };
  el.classList.add('listen'); el.textContent = kind === 'pad' ? 'Press a button…' : 'Press a key…';
  CTRL.setNote(kind === 'pad' ? 'Press a controller button for ' + CTRL_A[id].label.toLowerCase() + '. Esc or click elsewhere to cancel.' : 'Press a key for ' + CTRL_A[id].label.toLowerCase() + '. Esc cancels, Backspace clears it.');
};
CTRL.stopListen = function () { if (!CTRL.listen) return; CTRL.listen = null; CTRL.refreshUI(); };
CTRL.finishKey = function (code) {
  const L = CTRL.listen; if (!L) return;
  let lost = null;
  if (code === 'Escape') { CTRL.stopListen(); CTRL.setNote(''); return; }
  if (code === 'Backspace' || code === 'Delete') { CTRL.bindKey(L.id, L.slot, ''); CTRL.listen = null; CTRL.refreshUI(); CTRL.setNote(CTRL_A[L.id].label + ': key cleared.'); return; }
  if (CTRL_RESERVED.includes(code)) { CTRL.setNote(CTRL.keyName(code) + ' is kept for the menu. Pick another key.'); return; }
  lost = CTRL.bindKey(L.id, L.slot, code);
  CTRL.listen = null; CTRL.refreshUI();
  CTRL.setNote(lost ? `${CTRL.keyName(code)} was on ${CTRL_A[lost].label.toLowerCase()}; that is now on ${CTRL.keys[lost].length ? CTRL.keys[lost].map(CTRL.keyName).join(' / ') : 'no key'}.` : `${CTRL_A[L.id].label}: ${CTRL.keyName(code)}.`);
};
CTRL.finishPad = function (btn) {
  const L = CTRL.listen; if (!L) return;
  const lost = CTRL.bindPad(L.id, btn);
  CTRL.listen = null; CTRL.refreshUI();
  CTRL.setNote(lost ? `${CTRL.padName(btn)} was on ${CTRL_A[lost].label.toLowerCase()}; that has no button now.` : `${CTRL_A[L.id].label}: ${CTRL.padName(btn)}.`);
};
CTRL.setNote = function (t) { CTRL.note = t; const n = $('ctrlNote'); if (n) n.textContent = t; };
CTRL.buildUI = function () {
  const box = $('ctrlList'); if (!box) return;
  let h = '<div class="ctrlHead"><span></span><span>Key</span><span>Alt key</span><span>Gamepad</span></div>', g = '';
  for (const a of CTRL_ACTIONS) {
    if (a.g !== g) { g = a.g; h += `<div class="ctrlGrp">${g}</div>`; }
    h += `<div class="ctrlRow" data-id="${a.id}"><span>${a.label}</span>`
      + `<button type="button" class="kb" data-kind="key" data-slot="0"></button><button type="button" class="kb" data-kind="key" data-slot="1"></button>`
      + `<button type="button" class="kb pad" data-kind="pad"></button></div>`;
  }
  box.innerHTML = h;
  box.addEventListener('click', e => {
    const b = e.target.closest('button.kb'); if (!b) return;
    const id = b.parentElement.dataset.id;
    if (CTRL.listen && CTRL.listen.el === b) { CTRL.stopListen(); CTRL.setNote(''); return; }
    CTRL.startListen(id, b.dataset.kind, +(b.dataset.slot || 0), b);
  });
  box.addEventListener('contextmenu', e => {   // right click clears a slot
    const b = e.target.closest('button.kb'); if (!b) return; e.preventDefault();
    const id = b.parentElement.dataset.id; CTRL.stopListen();
    if (b.dataset.kind === 'pad') CTRL.bindPad(id, -1); else CTRL.bindKey(id, +b.dataset.slot, '');
    CTRL.refreshUI(); CTRL.setNote(CTRL_A[id].label + ': cleared.');
  });
  $('ctrlReset').addEventListener('click', () => { CTRL.stopListen(); CTRL.reset(); CTRL.refreshUI(); CTRL.setNote('Back to the standard keys and buttons.'); });
  // clicking anywhere else gives up listening
  addEventListener('pointerdown', e => { if (CTRL.listen && e.target !== CTRL.listen.el) { CTRL.stopListen(); CTRL.setNote(''); } }, true);
  // a key for the list is taken before anything else sees it
  addEventListener('keydown', e => { if (!CTRL.listen || CTRL.listen.kind !== 'key') { if (CTRL.listen && e.code === 'Escape') { CTRL.stopListen(); CTRL.setNote(''); e.preventDefault(); e.stopImmediatePropagation(); } return; } e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) CTRL.finishKey(e.code); }, true);
  CTRL.refreshUI();
};
CTRL.refreshUI = function () {
  const box = typeof document !== 'undefined' && document.getElementById && $('ctrlList'); if (!box || !box.querySelectorAll) return;
  for (const row of box.querySelectorAll('.ctrlRow')) {
    const id = row.dataset.id, ks = CTRL.keys[id] || [];
    for (const b of row.querySelectorAll('button.kb')) {
      if (CTRL.listen && CTRL.listen.el === b) continue;
      b.classList.remove('listen');
      const t = b.dataset.kind === 'pad' ? CTRL.padName(CTRL.pad[id]) : CTRL.keyName(ks[+b.dataset.slot]);
      b.textContent = t || '—'; b.classList.toggle('none', !t);
    }
  }
  const st = $('ctrlPad');
  if (st) st.textContent = PAD.connected() ? `Controller: ${PAD.name.replace(/\s*\(.*?\)\s*/g, ' ').trim() || 'connected'}. In the menu the D-pad or left stick moves, A presses, LB / RB change tab, B or Menu goes back.` : 'No controller found. Plug one in (Xbox, PlayStation or any standard pad) and press a button.';
  const cl = $('btnClass'); if (cl) cl.title = 'Green class lamps' + (CTRL.keys.classLamps[0] ? ` (${CTRL.keyName(CTRL.keys.classLamps[0])})` : '');
};
CTRL.setup = function () { CTRL.buildUI(); PAD.setup(); };

CTRL.load();

/* Controls (src/11o_ctrl.js): the default keys are the ones the game always had, a key moved to another action
   leaves the one it was on, saved bindings come back, and a gamepad drives the throttle, brakes, reverser and whistle.
   Run with: node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./harness');

/* the keys the old hard-wired handler in 11_ui.js answered to */
const OLD = { throttleUp: 'KeyW', throttleDown: 'KeyS', dynUp: 'KeyD', dynDown: 'KeyA', revFwd: 'ArrowUp', revBack: 'ArrowDown', brakeRel: 'KeyQ', brakeApp: 'KeyE',
  indRel: 'KeyZ', indApp: 'KeyC', whistle: 'Space', bell: 'KeyB', classLamps: 'KeyJ', sander: 'KeyX', cocks: 'KeyK', light: 'KeyH', injector: 'KeyI', stoker: 'KeyF',
  blower: 'KeyL', throwSwitch: 'KeyT', cabLook: 'KeyN', cars: 'KeyU', place: 'KeyG', fleet: 'KeyO', fleetPrev: 'BracketLeft', fleetNext: 'BracketRight', map: 'KeyM',
  pause: 'KeyP', cam1: 'Digit1', cam2: 'Digit2', cam3: 'Digit3', cam4: 'Digit4', cam5: 'Digit5', cam6: 'Digit6', camCycle: 'KeyV', camLeft: 'ArrowLeft',
  camRight: 'ArrowRight', zoomOut: 'Minus', zoomIn: 'Equal', leaveCab: 'Enter' };

function sim(diesel) {
  const s = h.load();
  s.GAME.isDiesel = () => !!diesel; s.GAME.isTurbine = () => false; s.GAME.notches = () => 8; s.GAME.refreshKeys = () => {};
  s.S.throttle = 0; s.S.brakeH = 0.2; s.S.indH = 1; s.S.reverser = 0; s.S.whistle = 0; s.S.bell = false;
  s.ctx.WALK = { on: false, stick: {} }; s.ctx.MAP = { visible: false }; s.ctx.CAM = { mode: 'chase', dist: 24, yaw: 0, pitch: 0.1 };
  return s;
}

test('every old key still does what it did, and no key is on two actions', () => {
  const s = sim();
  for (const [id, code] of Object.entries(OLD)) assert.equal(s.CTRL.keyAct(code), id, `${code} -> ${id}`);
  assert.equal(s.CTRL.keyAct('NumpadAdd'), 'zoomIn'); assert.equal(s.CTRL.keyAct('NumpadEnter'), 'leaveCab');
  const seen = {};
  for (const a of s.CTRL_ACTIONS) for (const c of s.CTRL.keys[a.id]) { assert.ok(!seen[c], `${c} twice`); seen[c] = 1; }
  const pads = s.CTRL_ACTIONS.map(a => s.CTRL.pad[a.id]).filter(b => b >= 0);
  assert.equal(new Set(pads).size, pads.length, 'no pad button twice');
  for (const b of pads) assert.ok(b < s.PAD_NAMES.length);
});

test('moving a key takes it off the action that had it, and the bindings save and come back', () => {
  const s = sim();
  let saved = null;
  s.ctx.localStorage = { getItem: k => k === 'bd_ctrl' ? saved : null, setItem: (k, v) => { if (k === 'bd_ctrl') saved = v; }, removeItem: k => { if (k === 'bd_ctrl') saved = null; } };
  const lost = s.CTRL.bindKey('throttleUp', 0, 'KeyB');
  assert.equal(lost, 'bell');
  assert.equal(s.CTRL.keyAct('KeyB'), 'throttleUp');
  assert.equal(s.CTRL.keyAct('KeyW'), null, 'W does nothing now');
  assert.deepEqual(Array.from(s.CTRL.keys.bell), []);
  assert.equal(s.CTRL.bindPad('bell', 7), 'throttleUp');
  assert.equal(s.CTRL.pad.throttleUp, -1);
  assert.ok(saved, 'saved');
  // a fresh load puts them back
  s.CTRL.defaults(); s.CTRL.index(); assert.equal(s.CTRL.keyAct('KeyW'), 'throttleUp');
  s.CTRL.load();
  assert.equal(s.CTRL.keyAct('KeyB'), 'throttleUp'); assert.equal(s.CTRL.keyAct('KeyW'), null); assert.equal(s.CTRL.pad.bell, 7);
  // reset clears the save
  s.CTRL.reset(); assert.equal(saved, null); assert.equal(s.CTRL.keyAct('KeyW'), 'throttleUp'); assert.equal(s.CTRL.keyAct('KeyB'), 'bell');
  // junk in storage never breaks loading
  saved = '{"k":{"bell":["Escape",5,"KeyY"]},"p":{"bell":99,"nope":1}}'; s.CTRL.load();
  assert.deepEqual(Array.from(s.CTRL.keys.bell), ['KeyY']); assert.equal(s.CTRL.pad.bell, 1);
  saved = 'not json'; s.CTRL.load(); assert.equal(s.CTRL.keyAct('KeyB'), 'bell');
});

test('actions work the controls the same way the old keys did', () => {
  const s = sim();
  s.CTRL.act('throttleUp'); assert.ok(Math.abs(s.S.throttle - 0.04) < 1e-9);
  s.CTRL.act('revFwd'); assert.ok(Math.abs(s.S.reverser - 1 / 17) < 1e-9);
  s.CTRL.act('brakeApp'); assert.ok(Math.abs(s.S.brakeH - 0.23) < 1e-9);
  s.CTRL.act('indRel'); assert.ok(Math.abs(s.S.indH - 0.95) < 1e-9);
  s.CTRL.act('whistle', { shift: true }); assert.equal(s.S.whistle, 1); s.CTRL.release('whistle'); assert.equal(s.S.whistle, 0);
  s.CTRL.act('bell'); assert.equal(s.S.bell, true);
  const d = sim(true);
  d.CTRL.act('throttleUp'); d.CTRL.act('throttleUp'); assert.ok(Math.abs(d.S.throttle - 2 / 8) < 1e-9, 'diesel notches');
  d.CTRL.act('revFwd'); assert.equal(d.S.reverser, 1);
});

/* a standard-mapping pad the test holds buttons on */
function fakePad(s) {
  const pad = { index: 0, id: 'Test pad (STANDARD GAMEPAD)', connected: true, buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
  s.ctx.navigator = { getGamepads: () => [pad] };
  s.PAD.seen = true; s.PAD.idx = 0;
  const set = (i, v) => { pad.buttons[i].value = v; pad.buttons[i].pressed = v > 0.5; };
  return { pad, set };
}

test('a gamepad drives: triggers the throttle, bumpers the train brake, D-pad the reverser, A the whistle', () => {
  const s = sim(); const { set } = fakePad(s);
  set(7, 1); s.PAD.poll(1 / 60);
  assert.ok(Math.abs(s.S.throttle - 0.04) < 1e-9, 'one step on the pull');
  for (let i = 0; i < 60; i++) s.PAD.poll(1 / 60);
  assert.ok(s.S.throttle > 0.3, `held trigger keeps opening it (${s.S.throttle})`);
  set(7, 0); s.PAD.poll(1 / 60); const th = s.S.throttle;
  for (let i = 0; i < 30; i++) s.PAD.poll(1 / 60); assert.equal(s.S.throttle, th, 'let go, it stays');
  set(5, 1); s.PAD.poll(1 / 60); set(5, 0); s.PAD.poll(1 / 60); assert.ok(Math.abs(s.S.brakeH - 0.23) < 1e-9, 'RB applies');
  set(12, 1); s.PAD.poll(1 / 60); set(12, 0); s.PAD.poll(1 / 60); assert.ok(s.S.reverser > 0, 'D-pad up: forward');
  set(0, 1); s.PAD.poll(1 / 60); assert.equal(s.S.whistle, 0.7); set(0, 0); s.PAD.poll(1 / 60); assert.equal(s.S.whistle, 0, 'whistle stops on release');
  set(1, 1); s.PAD.poll(1 / 60); assert.equal(s.S.bell, true);
});

test('a light pull on the trigger opens the throttle slower than a full one', () => {
  const run = v => { const s = sim(); const { set } = fakePad(s); set(7, v); for (let i = 0; i < 90; i++) s.PAD.poll(1 / 60); return s.S.throttle; };
  assert.ok(run(0.4) < run(1) * 0.75, `${run(0.4)} vs ${run(1)}`);
});

test('a diesel throttle notches out one at a time on the pad, not a notch a frame', () => {
  const s = sim(true); const { set } = fakePad(s);
  set(7, 1); for (let i = 0; i < 30; i++) s.PAD.poll(1 / 60);   // half a second
  const n = Math.round(s.S.throttle * 8);
  assert.ok(n >= 1 && n <= 2, `notch ${n}`);
});

test('the lesson names the keys the player has bound', () => {
  const s = sim();
  s.ctx.document.querySelectorAll = () => [];
  s.CTRL.bindKey('bell', 0, 'KeyY');
  const st = s.TUT_STEPS.find(x => x.id === 'bell');
  const body = st.body({}, {});
  assert.ok(body.includes('<kbd>Y</kbd>'), body);
  assert.ok(body.includes('<kbd>Space</kbd>'), body);
  fakePad(s);
  assert.ok(s.TUT_STEPS.find(x => x.id === 'bell').body({}, {}).includes('<kbd>A</kbd>'), 'and the pad button with a pad in');
});

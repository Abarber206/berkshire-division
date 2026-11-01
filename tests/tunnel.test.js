/* Tunnel and cut acoustics: the room every train sound is sent to (09b_sound.js), run against a stand-in
   audio graph. Run with: node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');

/* a web-audio stand-in: every node connects anywhere, every param remembers where it was steered to */
function fakeAudio() {
  const param = v => ({ value: v, setTargetAtTime(x) { this.value = x; }, setValueAtTime(x) { this.value = x; }, cancelScheduledValues() {}, linearRampToValueAtTime(x) { this.value = x; }, setValueCurveAtTime() {} });
  const node = extra => Object.assign({ connect() {}, disconnect() {}, gain: param(1), delayTime: param(0), frequency: param(1000), Q: param(1), pan: param(0) }, extra);
  return {
    sampleRate: 8000, currentTime: 0,
    createGain: () => node(), createDelay: () => node(), createBiquadFilter: () => node(), createStereoPanner: () => node(), createConvolver: () => node(),
    createBuffer: (c, n) => { const d = Array.from({ length: c }, () => new Float32Array(n)); return { getChannelData: i => d[i] }; },
  };
}

/* 01_util and 09b_sound with a bore along +x from x = 0 to 1000 (its middle line at z = 0) and flat ground,
   or the ground fn given */
function room(ground = () => 0) {
  class V3 { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } applyQuaternion() { return this.set(0, 0, 1); }   // the camera looks along -x, down the bore: its right hand is +z
    subVectors(a, b) { return this.set(a.x - b.x, a.y - b.y, a.z - b.z); } normalize() { const l = Math.hypot(this.x, this.y, this.z) || 1; return this.set(this.x / l, this.y / l, this.z / l); }
    dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; } distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); } }
  const THREE = new Proxy({ Vector3: V3 }, { get: (t, k) => (k in t ? t[k] : (t[k] = class { constructor() { return new Proxy(this, { get: (o, q) => (q in o ? o[q] : () => o) }); } })) });
  const ctx = { Math, console, THREE, camera: { position: new V3(), quaternion: {} }, WORLD: { mtn: true }, BORE: { half: 5.3 },
    location: { protocol: 'file:' } };
  ctx.AU = { ctx: fakeAudio(), master: {}, verbIn: {}, world: { connect() {} } };
  ctx.groundAt = ground;
  ctx.mtInBore = (x, z) => (x >= 0 && x <= 1000 && Math.abs(z) < 5.3 ? { rail: 0, depth: Math.min(x, 1000 - x), l: -z, top: 7, P: { sn: 0, c: 1 } } : null);
  vm.createContext(ctx);
  vm.runInContext(['01_util.js', '09b_sound.js'].map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n')
    + ';this.SND = SND; this.ROOM = ROOM; this.Emitter = Emitter; this.makeRoom = makeRoom; this.roomTick = roomTick; this.sndEnclosure = sndEnclosure; this.tunnelTail = tunnelTail;', ctx);
  ctx.SND.room = ctx.makeRoom();
  return ctx;
}
const listen = (c, x, y, z) => { c.camera.position.set(x, y, z); c.SND.encl.t = 0; c.roomTick(0.016); return c.SND.encl; };

test('deep in the bore the listener is shut in, between walls a few metres away', () => {
  const c = room(), e = listen(c, 500, 3.5, 2.25);
  assert.ok(e.bore > 0.99, `bore ${e.bore}`);
  assert.ok(e.wl < 8 && e.wr < 8 && e.wl > 2 && e.wr > 2, `walls ${e.wl} / ${e.wr} m`);
  assert.ok(Math.abs(e.wl - e.wr) > 3, 'off the middle line, one wall is nearer than the other');
  // the mouth lets the daylight sound in
  assert.ok(listen(c, 3, 3.5, 2.25).bore < 0.2);
});

test('open country is dry; a hillside gives a slap from one hand, a deep cut from both', () => {
  const right = { x: 0, y: 0, z: 1 };   // facing along -x... the right hand is +z
  const flat = room().sndEnclosure({ x: 0, y: 3.5, z: 0 }, right, () => 0, null);
  assert.equal(flat.cut, 0); assert.equal(flat.wl, 30); assert.equal(flat.wr, 30);
  // cut walls rising 1.5 : 1 from 6.8 m either side of the line (the portal approach cuts), 20 m deep
  const cut = (X, N) => Math.min(20, Math.max(0, Math.abs(N) - 6.8) * 1.5);
  const c = room().sndEnclosure({ x: 0, y: 3.5, z: 0 }, right, cut, null);
  assert.ok(c.cut > 0.8, `cut ${c.cut}`);
  assert.ok(c.wl < 15 && c.wr < 15, `walls ${c.wl} / ${c.wr} m`);
  const hill = (X, N) => Math.max(0, -N - 6.8) * 0.6;   // the valley wall on one side only (N < 0 is +z, the right hand)
  const h = room().sndEnclosure({ x: 0, y: 3.5, z: 0 }, right, hill, null);
  assert.ok(h.cut > 0 && h.cut < c.cut, `hillside ${h.cut}`);
  assert.ok(h.wr < 30 && h.wl === 30, `hillside walls ${h.wl} / ${h.wr}`);
});

test('a train in the bore rings with a listener inside, and booms out of the portal to one outside', () => {
  const c = room(), R = c.ROOM;
  // in the field: no room at all
  listen(c, -2000, 3.5, 300);
  const open = new c.Emitter(); open.place(new c.THREE.Vector3(-2160, 3, 300));
  assert.equal(open.rt.gain.value, 0); assert.equal(open.rw.gain.value, 0);
  const dryGain = open.g.gain.value, drySend = open.send.gain.value;
  // both in the bore, 160 m apart: the tail and the wall flutter, louder direct sound, no open-country reverb
  listen(c, 500, 3.5, 2.25);
  const e = new c.Emitter(); e.place(new c.THREE.Vector3(660, 3, 2.25));
  assert.ok(e.rt.gain.value > 0.3 * R.tail, `tail ${e.rt.gain.value}`);
  assert.ok(e.rw.gain.value > 0.9 * R.wall, `walls ${e.rw.gain.value}`);
  assert.ok(e.g.gain.value > dryGain * 1.8, `the tube carries it: ${e.g.gain.value} vs ${dryGain}`);
  assert.ok(e.send.gain.value < drySend * 0.3);
  // listener in the cab of a train deep in the bore: the full tail, and the cab louder
  const cab = new c.Emitter(); cab.place(null, { cab: true, cabGain: 0.85 });
  assert.ok(cab.rt.gain.value > 0.9 * R.tail && cab.g.gain.value > 0.85 * 1.3);
  // listener in the field 60 m off the portal, train 80 m in: its roar comes out of the mouth
  listen(c, -60, 3.5, 2);
  const out = new c.Emitter(); out.place(new c.THREE.Vector3(80, 3, 2.25));
  assert.ok(out.rt.gain.value > 0.1 * R.tail, `portal boom ${out.rt.gain.value}`);
  assert.equal(c.SND.encl.bore, 0);
});

test("the bore's tail decays, and its low notes outlast the highs", () => {
  const c = room(), rate = 44100, [L, Rt] = c.tunnelTail(rate);
  assert.notDeepEqual(L.slice(100, 200), Rt.slice(100, 200), 'each ear hears its own tail');
  const win = (d, t0, t1, f) => { let s = 0; for (let i = Math.floor(t0 * rate); i < t1 * rate; i++) s += f(d, i) ** 2; return s; };
  const raw = (d, i) => d[i], hi = (d, i) => d[i] - d[i - 1];   // a first difference stands in for the top end
  assert.equal(win(L, 0, 0.005, raw), 0, 'a few milliseconds of flight before the first reflection');
  assert.ok(win(L, 2.4, 2.6, raw) < 0.01 * win(L, 0.1, 0.3, raw), 'the tail dies away');
  const lowDrop = win(L, 1.2, 1.4, raw) / win(L, 0.1, 0.3, raw), hiDrop = win(L, 1.2, 1.4, hi) / win(L, 0.1, 0.3, hi);
  assert.ok(hiDrop < lowDrop * 0.5, `highs fall ${hiDrop.toFixed(4)}, lows ${lowDrop.toFixed(4)}`);
});

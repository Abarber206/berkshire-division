/* The travellers on the platforms and in the coaches (src/06m_folk.js), and the coach doors they climb in by
   (06_models.js coachDoorSet). Each traveller is one skinned mesh: every part has to touch the rest in every pose
   (no floating hat, bag or hand), stand on its soles at y = 0 walking or standing (never floating or sunk), be a
   grown-up's or a child's height, and sit on a coach seat with its shoes on the floor. A suitcase has to clear the
   legs that walk beside it. An open vestibule door and its trap have to leave the doorway and the steps clear, and a
   shut one has to give the car back its shared geometry. Run with: node --test tests/crowd.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const THREE_JS = path.join(__dirname, 'vendor', 'three.min.js');
const skip = !fs.existsSync(THREE_JS) && 'no tests/vendor/three.min.js';
let W = null;
function world() {
  if (W) return W;
  const Anything = () => { const fn = function () { return p; }; const p = new Proxy(fn, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : (k in t ? t[k] : (t[k] = Anything()))), set: (t, k, v) => { t[k] = v; return true; }, apply: () => p }); return p; };
  const ctx = { console, Math, performance: { now: () => 0 }, self: {}, window: {}, Error, document: { createElement: () => ({ width: 0, height: 0, getContext: () => Anything(), style: {} }), getElementById: () => Anything() }, localStorage: { getItem: () => null, setItem() {} } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(THREE_JS, 'utf8'), ctx);
  vm.runInContext('var SCN = { winMats: [] }, SKY = { night: false }, TEX = {}, GAME = { isDiesel: () => false, train: null, settings: { finish: "standard" } }, S = {};', ctx);
  const code = ['01_util.js', '06_models.js', '06b_diesel.js', '06c_couplers.js', '06d_cab.js', '06g_person.js', '06m_folk.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');
  vm.runInContext(code + '\nrollingMaterials(); globalThis.__W = { THREE, folkMesh, folkPose, folkBase, folkPick, FOLK_KINDS, FOLK_BONES, COACH_IN, PD, CH, coachModel, coachDoorSet, coachSeats, LOCO_SPEC, rng };', ctx);
  return (W = ctx.__W);
}
/* the skinned vertices of each part, posed, scaled by sc */
function posedParts(w, f, sc = 1) {
  const m = f.mesh; m.scale.setScalar(sc); m.matrixAutoUpdate = true; m.updateMatrixWorld(true);
  const B = w.folkBase(f.kind, f.carry), g = m.geometry, P = g.attributes.position, I = g.attributes.skinIndex, M = new w.THREE.Matrix4(), v = new w.THREE.Vector3();
  const mats = m.skeleton.bones.map((b, i) => new w.THREE.Matrix4().multiplyMatrices(b.matrixWorld, m.skeleton.boneInverses[i]));
  const parts = []; let at = 0;
  // folkBase lays the parts down in order: recount each part's vertices from its own geometry sizes
  const sizes = partSizes(w, f.kind, f.carry);
  for (let p = 0; p < sizes.length; p++) {
    const box = new w.THREE.Box3(), pts = [];
    for (let i = at; i < at + sizes[p]; i++) { M.copy(mats[I.getX(i)]); v.fromBufferAttribute(P, i).applyMatrix4(M); box.expandByPoint(v); pts.push(v.clone()); }
    parts.push({ box, pts, slot: B.slot[at], bone: I.getX(at) }); at += sizes[p];
  }
  return parts;
}
const SIZES = {};
function partSizes(w, kind, carry) { const k = kind + '|' + carry; return SIZES[k] || (SIZES[k] = w.__sizes(kind, carry)); }
/* every part touches another, and they all join up into one body */
function onePiece(parts, tol = 0.012) {
  const n = parts.length, seen = new Array(n).fill(false), stack = [0]; seen[0] = true;
  const boxes = parts.map(p => p.box.clone().expandByScalar(tol));
  while (stack.length) { const i = stack.pop(); for (let j = 0; j < n; j++) if (!seen[j] && boxes[i].intersectsBox(boxes[j])) { seen[j] = true; stack.push(j); } }
  return seen.map((s, i) => s ? -1 : i).filter(i => i >= 0);
}
const POSES = { standing: {}, walking: { phase: 0.9, speed: 1.35 }, 'mid-stride': { phase: 2.4, speed: 1.35 }, 'other foot': { phase: 4.1, speed: 1.35 }, 'watch': { watch: 1 }, 'turned': { turn: 0.9 } };
const KINDS = ['suit', 'coat', 'dress', 'wcoat', 'soldier', 'boy', 'girl'];
const CARRY = { suit: [null, 'case'], coat: [null, 'case'], dress: [null, 'bag'], wcoat: [null, 'case', 'bag'], soldier: [null, 'case'], boy: [null], girl: [null] };

function setup() {
  const w = world();
  if (!w.__sizes) {
    // a second context with the same sources, to count each part's vertices
    const fsrc = ['01_util.js', '06_models.js', '06b_diesel.js', '06c_couplers.js', '06d_cab.js', '06g_person.js', '06m_folk.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');
    const Anything = () => { const fn = function () { return p; }; const p = new Proxy(fn, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : (k in t ? t[k] : (t[k] = Anything()))), set: (t, k, v) => { t[k] = v; return true; }, apply: () => p }); return p; };
    const c2 = { console, Math, performance: { now: () => 0 }, self: {}, window: {}, Error, document: { createElement: () => ({ width: 0, height: 0, getContext: () => Anything(), style: {} }), getElementById: () => Anything() }, localStorage: { getItem: () => null, setItem() {} } };
    vm.createContext(c2); vm.runInContext(fs.readFileSync(THREE_JS, 'utf8'), c2);
    vm.runInContext('var SCN = { winMats: [] }, SKY = { night: false }, TEX = {}, GAME = { isDiesel: () => false, train: null, settings: { finish: "standard" } }, S = {};', c2);
    vm.runInContext(fsrc, c2);
    w.__sizes = (kind, carry) => vm.runInContext(`folkParts(${JSON.stringify(kind)}, ${JSON.stringify(carry)}).map(p => p[2].attributes.position.count)`, c2);
  }
  return w;
}

test('every traveller is one piece in every pose', { skip }, () => {
  const w = setup();
  for (const kind of KINDS) for (const carry of CARRY[kind]) {
    const f = w.folkMesh(kind, 0, carry);
    for (const [name, st] of Object.entries({ ...POSES, seated: { sit: w.COACH_IN.seatH } })) {
      w.folkPose(f, st);
      const loose = onePiece(posedParts(w, f));
      assert.deepEqual(loose, [], `${kind}${carry ? ' with a ' + carry : ''}, ${name}: part(s) ${loose.join(', ')} touch nothing`);
    }
  }
});

test('they stand on their soles: nothing floats or sinks, walking or standing', { skip }, () => {
  const w = setup();
  for (const kind of KINDS) for (const carry of CARRY[kind]) for (const sc of [w.FOLK_KINDS[kind].h[0], w.FOLK_KINDS[kind].h[1]]) {
    const f = w.folkMesh(kind, 1, carry);
    for (const [name, st] of Object.entries(POSES)) {
      w.folkPose(f, { ...st, scale: sc });
      const parts = posedParts(w, f, sc), lo = Math.min(...parts.map(p => p.box.min.y));
      assert.ok(lo > -0.006 && lo < 0.006, `${kind} ${carry || ''} x${sc.toFixed(2)}, ${name}: lowest point at ${(lo * 100).toFixed(1)} cm`);
    }
  }
});

test('grown-ups and children are their real heights', { skip }, () => {
  const w = setup();
  const H = { suit: [1.62, 1.95], coat: [1.62, 1.95], soldier: [1.62, 1.92], dress: [1.52, 1.8], wcoat: [1.52, 1.8], boy: [1.1, 1.4], girl: [1.05, 1.35] };
  for (const kind of KINDS) for (const sc of w.FOLK_KINDS[kind].h) {
    const f = w.folkMesh(kind, 2, null); w.folkPose(f, { scale: sc });
    const parts = posedParts(w, f, sc), top = Math.max(...parts.map(p => p.box.max.y));
    assert.ok(top > H[kind][0] && top < H[kind][1], `${kind} at x${sc}: ${top.toFixed(2)} m to the top of the head or hat`);
  }
});

test('seated on a coach seat, they sit on the cushion with their shoes on the floor', { skip }, () => {
  const w = setup(), h = w.COACH_IN.seatH;
  for (const kind of KINDS) {
    const K = w.FOLK_KINDS[kind];
    for (const sc of K.h) {
      const f = w.folkMesh(kind, 3, null); w.folkPose(f, { sit: h, scale: sc });
      const parts = posedParts(w, f, sc), lo = Math.min(...parts.map(p => p.box.min.y));
      // the shoes on the floor (a child's dangle above it), never through it
      assert.ok(lo > -0.012, `${kind} x${sc}: ${(lo * 100).toFixed(1)} cm through the floor`);
      if (!K.kid) assert.ok(lo < 0.05, `${kind} x${sc}: feet ${(lo * 100).toFixed(1)} cm off the floor`);
      // the seat of the pelvis on the cushion
      const pelvis = parts.filter(p => p.bone === 0).reduce((a, p) => Math.min(a, p.box.min.y), Infinity);
      assert.ok(Math.abs(pelvis - h) < 0.045, `${kind} x${sc}: pelvis bottom ${pelvis.toFixed(3)} vs cushion ${h}`);
    }
  }
});

test('a suitcase carried beside the legs never passes through them', { skip }, () => {
  const w = setup();
  for (const kind of ['suit', 'coat', 'wcoat', 'soldier']) {
    const f = w.folkMesh(kind, 4, 'case');
    for (let ph = 0; ph < 6.3; ph += 0.35) {
      w.folkPose(f, { phase: ph, speed: 1.35 });
      const parts = posedParts(w, f), bag = parts.filter(p => p.slot === 8 && p.bone === 9);
      const legs = parts.filter(p => p.bone >= 10);
      for (const b of bag) for (const l of legs) {
        const hit = l.pts.some(v => b.box.containsPoint(v));
        assert.ok(!hit, `${kind}: the case is in a leg at phase ${ph.toFixed(2)}`);
      }
    }
  }
});

test('an open vestibule door and its trap leave the doorway and the steps clear; shut, the car shares its doors again', { skip }, () => {
  const w = setup(), { THREE, CH } = w;
  const a = w.coachModel(w.LOCO_SPEC['765'], 1, false), b = w.coachModel(w.LOCO_SPEC['765'], 2, false);
  const D = a.root.userData.doors; assert.ok(D && D.grp.children.length >= 3, 'the doors are a group of their own');
  const shared = a.root.userData.doors.grp.children.map(m => m.geometry);
  b.root.userData.doors.grp.children.forEach((m, i) => assert.equal(m.geometry, shared[i], 'two cars share their door geometry'));
  const xd = (CH.xb + CH.xv) / 2;
  for (const e of [1, -1]) for (const s of [1, -1]) {
    w.coachDoorSet(a.root, e, s, 1);
    // the way in: a person 0.48 m wide up the steps and through the trap to the floor, and the doorway above
    const lane = new THREE.Box3(new THREE.Vector3(e * (xd - 0.05) - 0.24, 0.42, Math.min(s * 1.14, s * 1.52)), new THREE.Vector3(e * (xd - 0.05) + 0.24, 2.9, Math.max(s * 1.14, s * 1.52)));
    lane.min.x = Math.min(lane.min.x, e * (xd - 0.05) - 0.24); lane.max.x = Math.max(lane.max.x, e * (xd - 0.05) + 0.24);
    for (const m of D.grp.children) {
      const P = m.geometry.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); assert.ok(!lane.containsPoint(v), `door ${e},${s}: the ${m.name} still in the doorway at ${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}`); }
    }
    // and swung clear of the car's end wall and its inside
    for (const m of D.grp.children) { const bb = new THREE.Box3().setFromBufferAttribute(m.geometry.attributes.position); assert.ok(Math.abs(bb.max.x) <= CH.xv + 0.03 && Math.abs(bb.min.x) <= CH.xv + 0.03, `${m.name} past the end wall`); }
    w.coachDoorSet(a.root, e, s, 0);
  }
  D.grp.children.forEach((m, i) => assert.equal(m.geometry, shared[i], 'all shut: the shared doors are back'));
});

test('the climb keyframes put the soles on the treads (tops at 0.42, 0.74, 1.04 m) and then the vestibule floor', { skip }, () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', '11q_crowd.js'), 'utf8');
  for (const y of ['0.42', '0.74', '1.04']) assert.ok(src.includes(`[xp, ${y}, s *`), `a keyframe on the tread at ${y}`);
  const m = fs.readFileSync(path.join(__dirname, '..', 'src', '06_models.js'), 'utf8');
  assert.ok(m.includes('for (const y of [0.4, 0.72, 1.02]) gb.box(G, dw - 0.06, 0.04,'), 'treads 4 cm thick at 0.4, 0.72, 1.02');
});

test('a crowd is mostly grown-ups, in every kind', { skip }, () => {
  const w = setup(), r = w.rng(99), n = {};
  for (let i = 0; i < 2000; i++) { const p = w.folkPick(r, {}); n[p.kind] = (n[p.kind] || 0) + 1; }
  for (const k of KINDS) assert.ok(n[k] > 40, `${k}: only ${n[k] || 0} of 2000`);
  assert.ok((n.boy + n.girl) / 2000 < 0.22, 'children are a minority');
  const winter = {}; for (let i = 0; i < 1000; i++) { const p = w.folkPick(r, { winter: true }); winter[p.kind] = (winter[p.kind] || 0) + 1; }
  assert.ok(!winter.dress, 'nobody in a summer dress on a winter night');
});

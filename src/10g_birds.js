/* ============================================================================
   Birds: red and blue songbirds in small flocks overhead, sitting on the pole line wires, and
   pecking in the grass beside the track until a train (or you, on foot) comes close and flushes
   them. Some of a flushed group fly up to the wires and settle there.
   One instanced mesh of tiny low-poly birds, one draw call; the wings fold and flap in the
   vertex shader from two numbers per bird. Out by day, gone at night and in the rain, like the
   bird sounds in 09b_sound.js.
   ========================================================================== */
const BIRDS = { built: false, mesh: null, list: [], flocks: [], perch: new Map(), spans: [], spots: null, pool: 0,
  t: 0, tick: 0, on: false, leave: 0, cam: new THREE.Vector3(), fr: new THREE.Frustum(), spd: new WeakMap(),
  R_PERCH: 230, R_GROUND: 170 };
// sRGB; linearizeObject turns them linear with the rest of the scene. Mostly cardinals and bluebirds, a few sparrows
const BIRD_COL = [0xc8241c, 0xb81f19, 0xd22a20, 0x2f5fbf, 0x3a70d2, 0x28509e, 0x8c6c4c];
// belly to origin: a bird sits with its origin this far above the wire or the ground (times its scale)
const BIRD_SIT = 0.03;

/* the bird, facing +z, wings along x: a plump low-poly body and head, a short beak, a fan tail and two flat
   wings hinged 2 cm off the centre line. Songbird size: about 22 cm long, 30 cm across the wings.
   aSide marks wing vertices (-1 left, +1 right, 0 body) for the flap in the shader. */
function birdGeo() {
  const pos = [], side = [], col = [];
  const tri = (a, b, c, s, k) => { pos.push(...a, ...b, ...c); side.push(s, s, s); for (let i = 0; i < 3; i++) col.push(k, k, k); };
  const blob = (sx, sy, sz, cx, cy, cz, k, kDown) => {
    const g = new THREE.SphereGeometry(1, 7, 5).toNonIndexed(), a = g.attributes.position.array;
    for (let i = 0; i < a.length; i += 9) {
      const v = [0, 1, 2].map(j => [a[i + j * 3] * sx + cx, a[i + j * 3 + 1] * sy + cy, a[i + j * 3 + 2] * sz + cz]);
      const low = (a[i + 1] + a[i + 4] + a[i + 7]) / 3 < -0.2;
      tri(v[0], v[1], v[2], 0, low ? kDown : k);
    }
  };
  blob(0.03, 0.03, 0.068, 0, 0, 0, 1, 0.88);              // body
  blob(0.022, 0.022, 0.024, 0, 0.026, 0.062, 1, 0.9);     // head
  tri([0, 0.03, 0.082], [-0.007, 0.022, 0.084], [0, 0.026, 0.104], 0, 0.6); tri([0, 0.03, 0.082], [0.007, 0.022, 0.084], [0, 0.026, 0.104], 0, 0.6);   // beak
  tri([-0.007, 0.022, 0.084], [0.007, 0.022, 0.084], [0, 0.026, 0.104], 0, 0.6);
  tri([0, 0.012, -0.05], [-0.03, 0.004, -0.13], [0.03, 0.004, -0.13], 0, 0.85);     // tail
  for (const s of [-1, 1]) {
    const rf = [0.02 * s, 0.016, 0.04], rb = [0.02 * s, 0.016, -0.035], tb = [0.15 * s, 0.016, -0.028], tf = [0.135 * s, 0.016, 0.012];
    tri(rf, rb, tb, s, 0.85); tri(rf, tb, tf, s, 0.85);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function buildBirds(scene) {
  const lite = typeof GFX !== 'undefined' && GFX.lite;
  const nFlock = lite ? 20 : 40, nPool = lite ? 40 : 80, n = nFlock + nPool;
  const g = birdGeo();
  const wing = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2); wing.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('aWing', wing);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide });
  // aWing.x: the wing's angle up (+) or down (-) about its hinge; aWing.y: how far the wing is spread (1) or folded (~0.3)
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSide; attribute vec2 aWing;')
      .replace('#include <beginnormal_vertex>', `vec3 objectNormal = vec3( normal );
        float wA = aWing.x * aSide, wC = cos( wA ), wS = sin( wA );
        if ( abs( aSide ) > 0.5 ) objectNormal.xy = vec2( wC * objectNormal.x - wS * objectNormal.y, wS * objectNormal.x + wC * objectNormal.y );`)
      .replace('#include <begin_vertex>', `vec3 transformed = vec3( position );
        if ( abs( aSide ) > 0.5 ) { float hx = 0.02 * aSide; vec2 r = vec2( ( transformed.x - hx ) * aWing.y, transformed.y - 0.016 );
          transformed.xy = vec2( hx + wC * r.x - wS * r.y, 0.016 + wS * r.x + wC * r.y ); }`);
  };
  const mesh = new THREE.InstancedMesh(g, mat, n);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false; mesh.name = 'birds';
  const r = rng(4417), c = new THREE.Color(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < n; i++) {
    c.setHex(BIRD_COL[Math.floor(r() * BIRD_COL.length)]); mesh.setColorAt(i, c); mesh.setMatrixAt(i, zero);
    BIRDS.list.push({ i, mode: i < nFlock ? 'flock' : 'free', p: new THREE.Vector3(), v: new THREE.Vector3(), yaw: r() * 6.283, pitch: 0, roll: 0,
      sc: 0.9 + r() * 0.16, ph: r() * 100, rate: 0.8 + r() * 0.4, o: new THREE.Vector3(), wob: [r() * 6.3, r() * 6.3, 0.3 + r() * 0.4, 0.2 + r() * 0.3],
      t: 0, slot: null, spot: null, target: null, delay: 0, hop: 0, peck: 0, base: new THREE.Vector3() });
  }
  mesh.instanceColor.setUsage(THREE.StaticDrawUsage);
  scene.add(mesh);
  BIRDS.mesh = mesh; BIRDS.wing = wing; BIRDS.nFlock = nFlock; BIRDS.pool = nPool; BIRDS.built = true;
  // three flocks of a dozen or so (fewer on a phone); each bird holds its own place in the loose cloud
  const nf = lite ? 2 : 3;
  for (let f = 0; f < nf; f++) BIRDS.flocks.push({ c: new THREE.Vector3(), v: new THREE.Vector3(), goal: new THREE.Vector3(), next: 0, live: false, members: [] });
  for (let i = 0; i < nFlock; i++) {
    const b = BIRDS.list[i], F = BIRDS.flocks[i % nf]; F.members.push(b);
    b.o.set((r() - 0.5) * 9, (r() - 0.5) * 3.5, (r() - 0.5) * 9);
  }
  BIRDS.spans = WORLD.birdWires || [];
}

/* ---------- where birds can be: points on the pole line wires, and grassy spots beside the track ---------- */
/* a point on wire wi of a pole span at t along it, on the same 8-piece sagging polyline the wire is drawn with */
function birdWirePt(sp, wi, t, out) {
  const [wy, wz] = POLE_WIRE_Y[wi], a = sp.a, b = sp.b;
  const ax = a.p.x + Math.sin(a.yaw) * wz, ay = a.p.y + wy + 0.1, az = a.p.z + Math.cos(a.yaw) * wz;
  const bx = b.p.x + Math.sin(b.yaw) * wz, by = b.p.y + wy + 0.1, bz = b.p.z + Math.cos(b.yaw) * wz;
  const k = Math.min(7, Math.floor(t * 8)), t0 = k / 8, t1 = (k + 1) / 8, f = (t - t0) * 8;
  const sag = lerp(POLE_SAG * 4 * t0 * (1 - t0), POLE_SAG * 4 * t1 * (1 - t1), f);
  return out.set(lerp(ax, bx, t), lerp(ay, by, t) - sag, lerp(az, bz, t));
}
/* a span's perch slots, made once from its own seed: about one span in five has a few birds on one wire */
function birdSpanSlots(si) {
  const sp = BIRDS.spans[si];
  if (sp.slots) return sp.slots;
  const r = rng(si * 7919 + 13); sp.slots = [];
  if (r() > 0.22) return sp.slots;
  const wi = Math.floor(r() * POLE_WIRE_Y.length), len = sp.a.p.distanceTo(sp.b.p), n = 1 + Math.floor(r() * 5);
  let t = 0.12 + r() * 0.5;
  const dir = new THREE.Vector3().subVectors(sp.b.p, sp.a.p), wyaw = Math.atan2(dir.x, dir.z);
  for (let k = 0; k < n && t < 0.9; k++) {
    const p = birdWirePt(sp, wi, t, new THREE.Vector3());
    // perched across the wire, facing one way or the other, a little nose up
    sp.slots.push({ key: si * 8 + k, p, yaw: wyaw + (r() < 0.5 ? 1 : -1) * Math.PI / 2 + (r() - 0.5) * 0.5, bird: null });
    t += (0.22 + r() * 0.7) / len;
  }
  return sp.slots;
}
/* grassy spots beside the track every 55 m or so, made once: 3.5 to 7 m from the nearest rail centre, on ground
   level with the track (not under a bridge or over a tunnel), clear of water, structures and roads */
function birdSpots() {
  if (BIRDS.spots) return BIRDS.spots;
  if (!SCN.boxes && typeof sceneryBoxes === 'function' && SCN.bins) sceneryBoxes();
  const out = [], r = rng(9091), _f = newFrame();
  for (const e of NET.edges) for (let s = 20 + r() * 40; s < e.len - 20; s += 45 + r() * 30) {
    if (r() > 0.32) continue;
    e.pose(s, _f);
    const yaw = Math.atan2(-_f.f.z, _f.f.x), lat = (r() < 0.5 ? -1 : 1) * (3.8 + r() * 3.2);
    const X = _f.p.x + Math.sin(yaw) * lat, N = -(_f.p.z + Math.cos(yaw) * lat);
    if (typeof distToTrack === 'function' && distToTrack(X, N) < 3.5) continue;
    if (kept(X, N, 1.5) || (typeof riverDist === 'function' && riverDist(X, N) < 12)) continue;
    if (WORLD.roadsX && typeof onRoad === 'function' && onRoad(X, N, 6)) continue;
    const y = groundAt(X, N);
    if (Math.abs(y - (_f.p.y - 0.6)) > 1.6) continue;   // the track's on a fill, a bridge or under the hill here
    if (typeof inScenery === 'function' && inScenery(X, y + 0.3, -N, 1.2)) continue;
    out.push({ X, N, y, p: new THREE.Vector3(X, y, -N), n: 2 + Math.floor(r() * 4), seed: Math.floor(r() * 1e6), cool: 0, birds: [] });
  }
  return (BIRDS.spots = out);
}

/* ---------- trains: every consist on the map, and how fast each is going ---------- */
function birdTrains() {
  const a = [];
  if (typeof GAME !== 'undefined' && GAME.train) a.push(GAME.train);
  if (typeof AI !== 'undefined') for (const t of AI.trains) if (t.train) a.push(t.train);
  if (typeof FLEET !== 'undefined' && FLEET.parked) for (const c of FLEET.parked()) if (!a.includes(c)) a.push(c);
  return a;
}
function birdTrainSpeeds(trains, dt) {
  for (const T of trains) {
    const L = T.lead && T.lead.pos; if (!L) continue;
    let m = BIRDS.spd.get(T); if (!m) BIRDS.spd.set(T, m = { p: L.clone(), v: 0 });
    if (dt > 0) m.v = lerp(m.v, m.p.distanceTo(L) / dt, Math.min(1, dt * 4));
    m.p.copy(L);
  }
}
/* the nearest vehicle to p: distance and that train's speed */
function birdThreat(p, trains, out) {
  out.d = Infinity; out.v = 0; out.q = null;
  for (const T of trains) {
    const L = T.lead && T.lead.pos; if (!L) continue;
    if (Math.abs(L.x - p.x) + Math.abs(L.z - p.z) > (T.length || 0) + 160) continue;
    const sp = (BIRDS.spd.get(T) || { v: 0 }).v;
    for (const v of T.vehicles) {
      if (!v.pos) continue;
      const d = Math.hypot(v.pos.x - p.x, v.pos.z - p.z) - 1.6;   // from the side of the car, not its centre line
      if (d < out.d) { out.d = d; out.v = sp; out.q = v.pos; }
    }
  }
  return out;
}

/* ---------- the frame ---------- */
const _bq = new THREE.Quaternion(), _be = new THREE.Euler(0, 0, 0, 'YXZ'), _bs = new THREE.Vector3(), _bm = new THREE.Matrix4(), _bv = new THREE.Vector3(), _bw = new THREE.Vector3();
const _bthreat = { d: 0, v: 0, q: null };
const birdSeen = (p, far) => BIRDS.cam.distanceTo(p) < far && BIRDS.fr.containsPoint(p);

function birdsFrame(dt, cam) {
  if (!BIRDS.built) return;
  dt = Math.min(dt, 0.1); BIRDS.t += dt;
  const P = (typeof WX !== 'undefined' && WX.P) || {}, dark = (typeof SKY !== 'undefined' && SKY.dark) || 0;
  const want = dark < 0.55 && (P.rain || 0) < 0.45;
  BIRDS.cam.copy(cam.position);
  cam.updateMatrixWorld(); _bm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); BIRDS.fr.setFromProjectionMatrix(_bm);
  if (want && !BIRDS.on) { BIRDS.on = true; BIRDS.leave = 0; BIRDS.mesh.visible = true; }
  if (!want && BIRDS.on) birdsLeave();
  if (!BIRDS.on) {
    if (BIRDS.leave > 0 && (BIRDS.leave -= dt) <= 0) birdsReset();
    else if (BIRDS.leave <= 0) { BIRDS.mesh.visible = false; return; }
  }
  const trains = birdTrains(); birdTrainSpeeds(trains, dt);
  if ((BIRDS.tick -= dt) <= 0 && BIRDS.on) { BIRDS.tick = 0.5; birdsPlace(trains); }
  birdsFlush(trains);
  for (const F of BIRDS.flocks) birdFlockMove(F, dt);
  const M = BIRDS.mesh, W = BIRDS.wing.array;
  for (const b of BIRDS.list) {
    if (b.mode === 'free') { M.setMatrixAt(b.i, _bm.makeScale(0, 0, 0)); continue; }
    if (b.mode === 'flock') birdFlockBird(b, dt);
    else if (b.mode === 'perch') birdPerched(b, dt);
    else if (b.mode === 'ground') birdGround(b, dt);
    else birdFlying(b, dt);
    if (b.mode === 'free') { M.setMatrixAt(b.i, _bm.makeScale(0, 0, 0)); continue; }
    _be.set(b.pitch, b.yaw, b.roll); _bq.setFromEuler(_be); _bs.setScalar(b.sc);
    M.setMatrixAt(b.i, _bm.compose(b.p, _bq, _bs));
    W[b.i * 2] = b.wa; W[b.i * 2 + 1] = b.ws;
  }
  M.instanceMatrix.needsUpdate = true; BIRDS.wing.needsUpdate = true;
}

/* wings: bounding flight, a burst of flaps then a short swoop with them folded; hard flapping when flushed */
function birdFlap(b, dt, hard) {
  b.ph += dt * b.rate;
  if (hard) { const a = Math.sin(BIRDS.t * 90 * b.rate + b.wob[0]); b.wa = 0.25 + a * 0.85; b.ws = 1; return; }
  const cyc = (b.ph * 0.9) % 1;
  if (cyc < 0.62) { b.wa = 0.2 + Math.sin(b.ph * 70) * 0.8; b.ws = 1; }
  else { b.wa = -0.15; b.ws = 0.32; }
}
const birdFold = b => { b.wa = -0.4; b.ws = 0.28; };

/* point a flying bird along its velocity, banking a little into turns */
function birdFace(b, dt) {
  const v = b.v, h = Math.hypot(v.x, v.z);
  if (h < 0.05) return;
  const yaw = Math.atan2(v.x, v.z); let dy = yaw - b.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  b.yaw += dy * Math.min(1, dt * 8);
  b.pitch = lerp(b.pitch, -Math.atan2(v.y, h) * 0.8, Math.min(1, dt * 6));
  b.roll = lerp(b.roll, clamp(-dy * 2.5, -0.7, 0.7), Math.min(1, dt * 4));
}

/* ---------- flocks overhead ---------- */
function birdFlockSpawn(F) {
  // somewhere off to the side or ahead, out of the picture, 30 to 55 m over the ground
  const c = BIRDS.cam;
  for (let k = 0; k < 12; k++) {
    const a = Math.random() * 6.283, d = 160 + Math.random() * 160;
    F.c.set(c.x + Math.cos(a) * d, 0, c.z + Math.sin(a) * d);
    F.c.y = groundAt(F.c.x, -F.c.z) + 30 + Math.random() * 25;
    if (!BIRDS.fr.containsPoint(F.c)) break;
  }
  F.v.set(Math.random() - 0.5, 0, Math.random() - 0.5).setLength(9); F.next = 0; F.live = true;
  for (const b of F.members) { b.p.copy(F.c).add(b.o); b.v.copy(F.v); b.yaw = Math.atan2(F.v.x, F.v.z); }
}
function birdFlockMove(F, dt) {
  const c = BIRDS.cam;
  if (BIRDS.on && (!F.live || Math.hypot(F.c.x - c.x, F.c.z - c.z) > 520)) birdFlockSpawn(F);
  if (!F.live) return;
  if ((F.next -= dt) <= 0) {
    // a new place to make for: round the camera, or far away when they are leaving for the night
    F.next = 7 + Math.random() * 9;
    const a = Math.random() * 6.283, d = BIRDS.on ? 50 + Math.random() * 170 : 900;
    F.goal.set(c.x + Math.cos(a) * d, 0, c.z + Math.sin(a) * d);
  }
  const gy = groundAt(F.c.x, -F.c.z), lo = gy + 28, hi = gy + 60;
  F.goal.y = clamp(F.goal.y || lo + 10, lo, hi);
  _bv.subVectors(F.goal, F.c); _bv.y = 0;
  const want = _bv.lengthSq() > 1 ? _bv.setLength(11) : _bv.set(0, 0, 0);
  want.y = (F.c.y < lo ? (lo - F.c.y) * 0.8 : F.c.y > hi ? (hi - F.c.y) * 0.5 : 0) + Math.sin(BIRDS.t * 0.4 + F.members.length) * 1.2;
  F.v.lerp(want, Math.min(1, dt * 0.6));
  F.c.addScaledVector(F.v, dt);
}
function birdFlockBird(b, dt) {
  const F = BIRDS.flocks.find(f => f.members.includes(b));
  if (!F || !F.live) { b.mode = 'flock'; b.p.set(0, -1e4, 0); b.wa = 0; b.ws = 0; return; }
  const t = BIRDS.t, w = b.wob;
  _bw.set(b.o.x + Math.sin(t * w[2] + w[0]) * 2.2, b.o.y + Math.sin(t * w[3] + w[1]) * 1.1, b.o.z + Math.cos(t * w[2] + w[0]) * 2.2);
  _bv.copy(F.c).add(_bw);
  // follow the place in the cloud with a little lag, so the flock stretches and bunches on its turns
  const k = Math.min(1, dt * 2.5);
  b.v.lerp(_bv.sub(b.p).divideScalar(Math.max(dt, 1e-3)).clampLength(0, 18), k);
  b.p.addScaledVector(b.v, dt);
  birdFace(b, dt); birdFlap(b, dt, false);
}

/* ---------- sitting birds ---------- */
function birdPerched(b, dt) {
  const s = b.slot; b.p.copy(s.p); b.p.y += BIRD_SIT * b.sc;
  b.pitch = -0.22; b.roll = 0;
  // a look round now and then: the body turns a little on the wire
  if ((b.t -= dt) <= 0) { b.t = 1.5 + Math.random() * 5; b.peck = (Math.random() - 0.5) * 0.6; }
  b.yaw = lerp(b.yaw, s.yaw + b.peck, Math.min(1, dt * 10));
  birdFold(b);
  if (b.hop > 0) { b.hop -= dt; b.wa = 0.3 + Math.sin(b.hop * 60) * 0.6; b.ws = 0.8; }   // a quick wing stretch
  else if (Math.random() < dt * 0.02) b.hop = 0.35;
}
function birdGround(b, dt) {
  // peck at the grass, look up, hop a step or two
  if ((b.t -= dt) <= 0) {
    const r = Math.random();
    if (r < 0.3) { b.hop = 0.18; const a = b.yaw + (Math.random() - 0.5) * 1.5; b.v.set(Math.sin(a) * 0.9, 0, Math.cos(a) * 0.9); b.yaw = a; }
    b.t = 0.4 + Math.random() * 1.6; b.peck = Math.random() < 0.6 ? 0.6 : 0;
  }
  if (b.hop > 0) {
    b.hop -= dt; b.p.addScaledVector(b.v, dt);
    // stay within a couple of metres of the group's spot
    if (b.p.distanceTo(b.spot.p) > 2.2) { b.p.sub(b.spot.p).setLength(2.2).add(b.spot.p); }
  }
  const g = groundAt(b.p.x, -b.p.z);
  b.p.y = g + BIRD_SIT * b.sc + (b.hop > 0 ? Math.sin((0.18 - b.hop) / 0.18 * Math.PI) * 0.06 : 0);
  const pk = b.peck && (b.t % 0.5) < 0.18 ? b.peck : -0.15;
  b.pitch = lerp(b.pitch, pk, Math.min(1, dt * 14)); b.roll = 0;
  birdFold(b);
}
/* flushed, landing, or leaving */
function birdFlying(b, dt) {
  if (b.delay > 0) { b.delay -= dt; if (b.mode === 'flee') { birdFold(b); return; } }
  b.t += dt;
  const gy = groundAt(b.p.x, -b.p.z);
  if (b.mode === 'land') {
    const s = b.slot; _bv.copy(s.p); _bv.y += BIRD_SIT * b.sc;
    const d = _bv.distanceTo(b.p);
    if (d < 0.12 || b.t > 25) { b.mode = 'perch'; b.p.copy(_bv); b.yaw = s.yaw; b.t = 1; return; }
    // fly over to the wire, slowing and dropping onto it from a little above
    const above = d > 3 ? Math.min(2, d * 0.15) : 0;
    _bv.y += above; _bv.sub(b.p).setLength(Math.min(9, 0.6 + d * 1.4));
    b.v.lerp(_bv, Math.min(1, dt * 3));
    b.p.addScaledVector(b.v, dt);
    birdFace(b, dt);
    if (d < 1.2) { b.wa = 0.6 + Math.sin(BIRDS.t * 80) * 0.7; b.ws = 1; b.pitch = lerp(b.pitch, -0.6, Math.min(1, dt * 6)); }   // flaring
    else birdFlap(b, dt, d > 6);
    return;
  }
  // flushed: up and away, then a long gentle climb off out of sight
  const up = b.t < 1.4 ? 5 : 1.5;
  b.v.y = lerp(b.v.y, up, Math.min(1, dt * 2));
  _bv.set(b.v.x, 0, b.v.z); const h = _bv.length();
  if (h < 9) { _bv.setLength(lerp(h, 9, Math.min(1, dt))); b.v.x = _bv.x; b.v.z = _bv.z; }
  const turn = Math.sin(b.t * 0.8 + b.wob[0]) * 0.5 * dt, cs = Math.cos(turn), sn = Math.sin(turn), vx = b.v.x;
  b.v.x = vx * cs - b.v.z * sn; b.v.z = vx * sn + b.v.z * cs;
  b.p.addScaledVector(b.v, dt);
  if (b.p.y < gy + 0.5) { b.p.y = gy + 0.5; b.v.y = Math.max(b.v.y, 3); }
  birdFace(b, dt); birdFlap(b, dt, b.t < 2.5);
  if (b.t > 6 && (b.p.distanceTo(BIRDS.cam) > 150 || !BIRDS.fr.containsPoint(b.p) || b.t > 40)) birdFree(b);
}
function birdFree(b) {
  if (b.slot && b.slot.bird === b) b.slot.bird = null;
  if (b.spot) { const k = b.spot.birds.indexOf(b); if (k >= 0) b.spot.birds.splice(k, 1); }
  b.mode = 'free'; b.slot = null; b.spot = null;
}
/* send a sitting bird off: away from what flushed it (from), and maybe on to a wire nearby */
function birdFlush(b, from, delay, toWire) {
  const spot = b.spot;
  if (b.slot && b.mode === 'perch') { b.slot.bird = null; b.slot = null; }
  if (spot) { const k = spot.birds.indexOf(b); if (k >= 0) spot.birds.splice(k, 1); b.spot = null; }
  _bv.set(b.p.x - (from ? from.x : b.p.x - Math.sin(b.yaw)), 0, b.p.z - (from ? from.z : b.p.z - Math.cos(b.yaw)));
  if (_bv.lengthSq() < 1e-4) _bv.set(Math.random() - 0.5, 0, Math.random() - 0.5);
  _bv.setLength(5 + Math.random() * 3); _bv.applyAxisAngle(THREE.Object3D.DefaultUp, (Math.random() - 0.5) * 1.2);
  b.v.set(_bv.x, 3.5 + Math.random() * 2, _bv.z);
  b.mode = 'flee'; b.t = 0; b.delay = delay;
  if (toWire) { b.mode = 'land'; b.slot = toWire; toWire.bird = b; }
}
function birdsLeave() {
  BIRDS.on = false; BIRDS.leave = 30;
  for (const b of BIRDS.list) if (b.mode === 'perch' || b.mode === 'ground' || b.mode === 'land') birdFlush(b, null, Math.random() * 3, null);
  for (const F of BIRDS.flocks) F.next = 0;
}
function birdsReset() {
  for (const b of BIRDS.list) if (b.mode !== 'flock') birdFree(b);
  for (const F of BIRDS.flocks) F.live = false;
  BIRDS.mesh.visible = false; BIRDS.leave = 0;
}

/* ---------- filling the places near the camera (twice a second) ---------- */
function birdTake() { for (const b of BIRDS.list) if (b.mode === 'free') return b; return null; }
function birdsPlace(trains) {
  const c = BIRDS.cam;
  // wires: the span slots within reach, nearest first; birds on slots now out of reach go
  const near = [];
  for (let si = 0; si < BIRDS.spans.length; si++) {
    const sp = BIRDS.spans[si], m = sp.a.p;
    if (Math.abs(m.x - c.x) > BIRDS.R_PERCH + 50 || Math.abs(m.z - c.z) > BIRDS.R_PERCH + 50) continue;
    for (const s of birdSpanSlots(si)) { const d = s.p.distanceTo(c); if (d < BIRDS.R_PERCH) near.push([d, s]); }
  }
  near.sort((a, b) => a[0] - b[0]);
  const cap = Math.floor(BIRDS.pool * 0.6), keep = new Set(near.slice(0, cap).map(x => x[1]));
  for (const b of BIRDS.list) if (b.mode === 'perch' && !keep.has(b.slot)) {
    if (birdSeen(b.p, 120)) birdFlush(b, null, 0, null); else birdFree(b);
  }
  BIRDS.near = near;
  for (const [d, s] of near.slice(0, cap)) {
    if (s.bird) continue;
    if (birdSeen(s.p, 110) && d < 110) continue;   // don't pop one in where you're looking
    const b = birdTake(); if (!b) break;
    b.mode = 'perch'; b.slot = s; s.bird = b; b.yaw = s.yaw; b.t = Math.random() * 3; b.hop = 0;
    b.p.copy(s.p);
  }
  // ground: groups in the grass by the line, not where a train stands or is coming
  const spots = birdSpots();
  for (const sp of spots) {
    const d = Math.hypot(sp.p.x - c.x, sp.p.z - c.z);
    if (d > BIRDS.R_GROUND) { if (sp.birds.length) for (const b of [...sp.birds]) birdFree(b); continue; }
    if (sp.birds.length || sp.cool > BIRDS.t) continue;
    if (birdSeen(sp.p, 90)) continue;
    birdThreat(sp.p, trains, _bthreat);
    if (_bthreat.d < 90) continue;
    const r = rng(sp.seed + Math.floor(BIRDS.t / 60));
    for (let k = 0; k < sp.n; k++) {
      const b = birdTake(); if (!b) break;
      const a = r() * 6.283, rr = 0.3 + r() * 1.3;
      b.mode = 'ground'; b.spot = sp; sp.birds.push(b);
      b.p.set(sp.p.x + Math.cos(a) * rr, 0, sp.p.z + Math.sin(a) * rr);
      b.p.y = groundAt(b.p.x, -b.p.z) + BIRD_SIT * b.sc;
      b.yaw = r() * 6.283; b.t = r(); b.hop = 0; b.pitch = 0;
    }
  }
}

/* ---------- flushing: a train coming (sooner the faster it comes), or you walking up ---------- */
function birdsFlush(trains) {
  const walk = typeof WALK !== 'undefined' && WALK.on;
  for (const sp of BIRDS.spots || []) {
    if (!sp.birds.length) continue;
    birdThreat(sp.p, trains, _bthreat);
    const reach = 14 + Math.min(70, _bthreat.v * 2.4);
    const scared = (_bthreat.d < reach && _bthreat.v > 0.8) || _bthreat.d < 8;
    const byFoot = walk && Math.hypot(BIRDS.cam.x - sp.p.x, BIRDS.cam.z - sp.p.z) < 7;
    if (!scared && !byFoot) continue;
    const from = byFoot ? BIRDS.cam : _bthreat.q;
    sp.cool = BIRDS.t + 60 + Math.random() * 60;
    // about half the group heads for an empty spot on a wire close by, the rest fly off
    const wires = (BIRDS.near || []).filter(([, s]) => !s.bird && s.p.distanceTo(sp.p) < 90).map(x => x[1]);
    for (const b of [...sp.birds]) {
      const w = wires.length && Math.random() < 0.5 ? wires.splice(Math.floor(Math.random() * wires.length), 1)[0] : null;
      birdFlush(b, from, Math.random() * 0.35, w);
    }
  }
}

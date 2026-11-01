/* ============================================================================
   On foot: climb down from the cab and walk about the railroad, board a coach
   (yours, an AI train's or a friend's) and ride it, sit by a window, walk the
   aisle and through the diaphragms from car to car, step off at a station,
   wait on a platform to be picked up, and climb back into your own cab.
   The man is a jointed figure (06g_person.js). He walks on the ground, the
   platforms and the track bed (over bridges and through tunnels), and is kept
   out of buildings, trees, poles, benches and rolling stock. Riding, he is
   held in the coach's own frame, so he goes where the coach goes.
   In a room everyone sees everyone else walking or riding.
   ========================================================================== */
const WALK = {
  on: false, mode: 'drive', p: new THREE.Vector3(), vy: 0, yaw: 0, lookYaw: 0, lookPitch: -0.18, fp: false, dist: 3.6,
  keys: {}, stick: { x: 0, y: 0, on: false }, runT: false, speed: 0, phase: 0, t: 0, wave: -1, ride: null, rig: null,
  act: null, actT: 0, interiors: new Map(), inT: 0, holds: new Map(), infoT: 0, peers: new Map(), seen: new Map(),
};
const WALK_R = 0.27, WALK_STEP = 0.55, WALK_V = 1.45, RUN_V = 3.9;
const _kA = new THREE.Vector3(), _kB = new THREE.Vector3(), _kC = new THREE.Vector3(), _kD = new THREE.Vector3(), _kM = new THREE.Matrix4(), _kQ = new THREE.Vector3();
const yawDir = (th, out) => out.set(Math.sin(th), 0, Math.cos(th));
const yawOf = d => Math.atan2(d.x, d.z);

/* ---------------- what is underfoot ---------------- */
/* the track, sampled every 2 m: world x, z, rail-top y and the heading, in 8 m cells */
WALK.trackGrid = function () {
  if (WALK.tg) return WALK.tg;
  const G = new Map(), F = newFrame();
  for (const e of NET.edges) for (let s = 0; s <= e.len + 0.01; s += 2) {
    e.pose(Math.min(s, e.len), F);
    const k = Math.floor(F.p.x / 8) + ',' + Math.floor(F.p.z / 8); let l = G.get(k); if (!l) G.set(k, l = []);
    const fl = Math.hypot(F.f.x, F.f.z) || 1; l.push(F.p.x, F.p.z, F.p.y, F.f.x / fl, F.f.z / fl);
  }
  return (WALK.tg = G);
};
/* top of the ties under (x, z), falling off down the ballast shoulder; -Infinity away from the track */
function bedAt(x, z) {
  const G = WALK.trackGrid(), i = Math.floor(x / 8), j = Math.floor(z / 8); let best = -Infinity;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const l = G.get((i + a) + ',' + (j + b)); if (!l) continue;
    for (let q = 0; q < l.length; q += 5) {
      const dx = x - l[q], dz = z - l[q + 1]; if (dx * dx + dz * dz > 9) continue;
      const along = dx * l[q + 3] + dz * l[q + 4]; if (Math.abs(along) > 1.15) continue;
      const lat = Math.abs(dx * l[q + 4] - dz * l[q + 3]); if (lat > 2.4) continue;
      const h = l[q + 2] - 0.17 - Math.max(0, lat - 1.4) * 0.55;
      if (h > best) best = h;
    }
  }
  return best;
}
/* the surface to stand on at (x, z) for feet now at y: the highest of the ground, the track bed and the
   platforms that is no more than a step up. wall: the ground there is a cliff, not a step. */
function floorAt(x, z, y) {
  const bore = WORLD.mtn && typeof mtInBore === 'function' ? mtInBore(x, z, 0) : null;
  const g = bore ? -Infinity : groundAt(x, -z), cands = [g, bedAt(x, z)];
  if (bore) cands.push(bore.rail - 0.3);
  for (const d of SCN.decks) if (Math.abs(d[0] - x) < d[6] + d[7] + 1 && Math.abs(d[1] - z) < d[6] + d[7] + 1 && inFootXZ(d, x, z, 0)) cands.push(d[8]);
  let best = -Infinity;
  for (const c of cands) if (c <= y + WALK_STEP && c > best) best = c;
  if (best === -Infinity) return { y: Math.min(...cands.filter(isFinite)), wall: true };
  return { y: best, wall: false, bore };
}
/* push p out of an oriented box f ([cx, cz, ax, az, bx, bz, half a, half b]) by radius r */
function pushOut(p, f, r) {
  const dx = p.x - f[0], dz = p.z - f[1]; let u = dx * f[2] + dz * f[3], w = dx * f[4] + dz * f[5];
  const pu = f[6] + r - Math.abs(u), pw = f[7] + r - Math.abs(w);
  if (pu <= 0 || pw <= 0) return false;
  if (pu < pw) u = Math.sign(u || 1) * (f[6] + r); else w = Math.sign(w || 1) * (f[7] + r);
  p.x = f[0] + u * f[2] + w * f[4]; p.z = f[1] + u * f[3] + w * f[5];
  return true;
}
/* keep a man standing at p (feet) out of buildings, benches, trees and poles, and rolling stock */
function walkSolid(p, skip) {
  for (let pass = 0; pass < 2; pass++) {
    for (const f of SCN.foot) {
      if (Math.abs(f[0] - p.x) > f[6] + f[7] + 1 || Math.abs(f[1] - p.z) > f[6] + f[7] + 1) continue;
      if (inFootXZ(f, p.x, p.z, WALK_R) && p.y < footTop(f) - 0.4) pushOut(p, f, WALK_R);
    }
    for (const f of SCN.blocks) {
      if (Math.abs(f[0] - p.x) > f[6] + f[7] + 1 || Math.abs(f[1] - p.z) > f[6] + f[7] + 1) continue;
      if (p.y < f[9] - 0.05 && p.y + 1.75 > f[8]) pushOut(p, f, WALK_R);
    }
    for (const t of treesNear(p.x, p.z)) {
      if (p.y + 1.8 < t[3] || p.y > t[4]) continue;
      const dx = p.x - t[0], dz = p.z - t[1], h = Math.hypot(dx, dz), r = Math.min(t[2], 1.2) + WALK_R;
      if (h < r) { const k = h > 1e-3 ? r / h : 0; if (k) { p.x = t[0] + dx * k; p.z = t[1] + dz * k; } else p.x = t[0] + r; }
    }
    for (const c of camConsists()) for (const v of c.vehicles) {
      if (v === skip || !v.pos || Math.abs(v.pos.x - p.x) > v.len || Math.abs(v.pos.z - p.z) > v.len) continue;
      if (p.y + 1.8 < v.pos.y - 0.3 || p.y > v.pos.y + 4.6) continue;
      const fl = Math.hypot(v.fwd.x, v.fwd.z) || 1, ax = v.fwd.x / fl, az = v.fwd.z / fl;
      pushOut(p, [v.pos.x, v.pos.z, ax, az, -az, ax, v.len / 2 + 0.05, 1.62], WALK_R);
    }
  }
}

/* ---------------- the trains about him ---------------- */
function walkSpeedOf(c) {
  if (c === GAME.train) return S.v;
  if (c.ai) return c.ai.v;
  if (MP.on) for (const p of MP.peers.values()) if (p.rt && p.rt.train === c) return p.rt.v || 0;
  return c.v || 0;
}
const isCoach = v => v.kind === 'coach' && v.model && v.model.root;
const isObs = v => !!(v.model && v.model.root.userData.markers);
/* the vestibule doors of a coach, in its own frame: [x, side] */
const coachDoors = v => { const xd = (CH.xb + CH.xv) / 2, out = []; for (const e of isObs(v) ? [1] : [1, -1]) for (const s of [-1, 1]) out.push([e * xd, s]); return out; };
function trainName(c) {
  if (c === GAME.train) return 'your train';
  if (c.ai) return c.ai.name;
  if (MP.on) for (const p of MP.peers.values()) if (p.rt && p.rt.train === c) return `${p.st.nm}'s train`;
  return 'the cars';
}
const local2world = (v, l, out) => out.copy(l).applyMatrix4(v.root.matrixWorld);
const world2local = (v, w, out) => out.copy(w).applyMatrix4(_kM.copy(v.root.matrixWorld).invert());
/* a direction's yaw between the world and a vehicle's frame (whose +X is ahead and +Z to the right) */
function yawToLocal(v, th) { yawDir(th, _kA); _kB.copy(_kA).transformDirection(_kM.copy(v.root.matrixWorld).invert()); return Math.atan2(_kB.x, _kB.z); }
function yawToWorld(v, th) { yawDir(th, _kA); _kA.transformDirection(v.root.matrixWorld); return Math.atan2(_kA.x, _kA.z); }

/* ---------------- getting on and off ---------------- */
WALK.rigReady = function () {
  if (!WALK.rig) { WALK.rig = buildPerson({ shirt: 0x5f7896 }); linearizeObject(WALK.rig.root); scene.add(WALK.rig.root); }
  WALK.rig.root.visible = true;
  return WALK.rig;
};
WALK.setOn = function (on) {
  WALK.on = on; $('hud').classList.toggle('walk', on);
  if (!on) { WALK.mode = 'drive'; WALK.ride = null; if (WALK.rig) WALK.rig.root.visible = false; WALK.keys = {}; WALK.stick.on = false; }
  $('btnWalk').setAttribute('aria-label', on ? 'Back to your cab' : 'Climb down and walk');
  WALK.ui();
};
/* climb down from the cab, on the side with a platform if there is one (else the engineer's side) */
WALK.leaveCab = function () {
  const T = GAME.train; if (!T || !GAME.running || S.paused || PLACE.on) return;
  if (S.derailed) { toast('Not until the train is back on the rails.', 'warn', 2400, 'walk'); return; }
  if (Math.abs(S.v) > 0.3) { toast('Stop the train before you climb down.', 'warn', 2400, 'walk'); return; }
  if (MP.watching) MP.unwatch();
  const L = T.loco, x = (L.cabEye ? L.cabEye.x : 0) - 0.4;
  let best = null;
  for (const s of [1, -1]) {
    const w = _kA.set(x, 0, s * 2.35).applyMatrix4(L.root.matrixWorld), f = floorAt(w.x, w.z, w.y + 0.6);
    if (!best || f.y > best.y + 0.15) best = { s, y: f.y, x: w.x, z: w.z };
  }
  S.throttle = 0; S.indH = 1;
  if (T.diesel) S.notch = 0;
  WALK.rigReady();
  WALK.p.set(best.x, best.y, best.z); WALK.vy = 0;
  _kB.set(0, 0, best.s).transformDirection(L.root.matrixWorld);
  WALK.yaw = WALK.lookYaw = Math.atan2(_kB.x, _kB.z); WALK.lookPitch = -0.15;
  WALK.mode = 'foot'; WALK.setOn(true);
  toast('Throttle closed and the independent brake set. You climb down from the cab.', '', 3200, 'walk');
};
WALK.toCab = function (quiet) {
  if (!WALK.on) return;
  WALK.setOn(false);
  cycleCamera('cab');
  if (!quiet) toast('Back in the cab.', '', 1800, 'walk');
};
WALK.board = function (c, v, door) {
  const [x, s] = door, sp = Math.abs(walkSpeedOf(c));
  if (sp > 0.4) { toast('Wait for it to stop.', 'warn', 1800, 'walk'); return; }
  WALK.ride = { c, v, l: new THREE.Vector3(x, COACH_IN.yF, s * (CH.hw - 0.45)), seat: null, yaw: s > 0 ? Math.PI : 0 };
  WALK.lookYaw = WALK.ride.yaw; WALK.mode = 'ride'; WALK.vy = 0;
  WALK.showInterior(v, true);
  toast(`You climb aboard ${trainName(c)}.`, 'good', 2600, 'walk');
  WALK.ui();
};
/* off a coach by the nearest vestibule door, onto whatever is outside it */
WALK.alight = function () {
  const r = WALK.ride; if (!r) return;
  if (Math.abs(walkSpeedOf(r.c)) > 0.3) { toast('Not while the train is moving.', 'warn', 2000, 'walk'); return; }
  let best = null;
  for (const [x, s] of coachDoors(r.v)) {
    const w = local2world(r.v, _kA.set(x, 0, s * (CH.hw + 0.75)), new THREE.Vector3()), f = floorAt(w.x, w.z, w.y + 0.4);
    const d = Math.hypot(r.l.x - x, r.l.z - s * CH.hw) - (f.y > w.y - 0.6 ? 6 : 0);   // a platform beats walking a little further
    if (!best || d < best.d) best = { d, w, f, s };
  }
  WALK.p.set(best.w.x, best.f.y, best.w.z); WALK.vy = 0;
  const yl = best.s > 0 ? 0 : Math.PI;   // facing out of the door
  WALK.yaw = WALK.lookYaw = yawToWorld(r.v, yl);
  WALK.ride = null; WALK.mode = 'foot';
  toast('You step down.', '', 1800, 'walk');
  WALK.ui();
};
WALK.reset = function () { if (WALK.on) WALK.setOn(false); for (const [v] of WALK.interiors) WALK.showInterior(v, false); WALK.tg = null; };

/* ---------------- what he can do where he is ---------------- */
WALK.findAction = function () {
  const T = GAME.train;
  if (WALK.mode === 'ride') {
    const r = WALK.ride, l = r.l, moving = Math.abs(walkSpeedOf(r.c)) > 0.3;
    if (r.seat) return { label: 'Stand up', sub: 'Take a walk through the train', go: () => WALK.stand() };
    const inVest = Math.abs(l.x) > CH.xb + 0.2;
    if (inVest && Math.abs(l.z) > CH.hw - 0.7) return moving ? { label: 'Get off', sub: 'Wait for a stop', off: true } : { label: 'Get off', sub: 'Step down here', go: () => WALK.alight() };
    let near = null;
    if (!inVest) for (const s of coachSeats()) { const d = Math.abs(s.x + 0.35 - l.x); if (d < 0.75 && (!near || d < near.d || (d === near.d && Math.abs(s.z) < Math.abs(near.s.z)))) near = { s, d }; }
    if (near) { const taken = WALK.seatTaken(r.v, near.s); return { label: 'Sit down', sub: taken ? 'Next seat over is free' : 'Window seat', go: () => WALK.sit(near.s) }; }
    return moving ? { label: 'Riding', sub: 'Find a seat', off: true } : { label: 'Get off', sub: 'By the nearest door', go: () => WALK.alight() };
  }
  // on the ground: a coach door or your own cab within reach
  let best = null;
  for (const c of camConsists()) {
    const sp = Math.abs(walkSpeedOf(c));
    for (const v of c.vehicles) {
      if (!v.pos || Math.abs(v.pos.x - WALK.p.x) > v.len || Math.abs(v.pos.z - WALK.p.z) > v.len) continue;
      if (isCoach(v)) for (const d of coachDoors(v)) {
        const w = local2world(v, _kA.set(d[0], 0.6, d[1] * (CH.hw + 0.3)), _kC), dd = Math.hypot(w.x - WALK.p.x, w.z - WALK.p.z);
        if (dd < 1.9 && Math.abs(WALK.p.y - w.y) < 2.2 && (!best || dd < best.dd)) best = { dd, label: 'Board', sub: trainName(c), wait: sp > 0.4, go: () => WALK.board(c, v, d) };
      }
      if (c === T && v === T.lead && T.loco.cabEye) {
        for (const s of [-1, 1]) {
          const w = _kA.set(T.loco.cabEye.x - 0.4, 0, s * 2.0).applyMatrix4(T.loco.root.matrixWorld), dd = Math.hypot(w.x - WALK.p.x, w.z - WALK.p.z);
          if (dd < 2.2 && (!best || dd < best.dd)) best = { dd, label: 'Climb up', sub: 'Into your cab', wait: sp > 0.4, go: () => WALK.toCab() };
        }
      }
    }
  }
  if (best) return best.wait ? { label: best.label, sub: 'Wait for it to stop', off: true } : best;
  return null;
};
WALK.seatTaken = function (v, s) { for (const p of WALK.peers.values()) if (p.seatOf === v && p.seat && Math.abs(p.seat.x - s.x) < 0.1 && Math.abs(p.seat.z - s.z) < 0.1) return true; return false; };
WALK.sit = function (s) {
  const r = WALK.ride; if (!r) return;
  // the window seat if it is free, else the one by the aisle
  const row = coachSeats().filter(q => Math.abs(q.x - s.x) < 0.01 && Math.sign(q.z) === Math.sign(s.z)).sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
  const free = row.find(q => !WALK.seatTaken(r.v, q)) || row[0];
  r.seat = free; r.l.set(free.x, COACH_IN.yF, free.z); r.yaw = Math.PI / 2; WALK.lookYaw = Math.PI / 2 + (free.z > 0 ? 0.55 : -0.55); WALK.lookPitch = -0.05;
  WALK.ui();
};
WALK.stand = function () { const r = WALK.ride; if (!r || !r.seat) return; r.l.set(r.seat.x + 0.42, COACH_IN.yF, 0); r.seat = null; WALK.ui(); };
WALK.doAction = function () { const a = WALK.act; if (a && a.go) a.go(); };

/* ---------------- each frame ---------------- */
WALK.frame = function (dt) {
  WALK.peersFrame(dt);
  WALK.interiorsFrame(dt);
  if (!WALK.on) return;
  WALK.t += dt;
  const live = GAME.running && !S.paused && !PLACE.on;
  if (!live) dt = 0;
  if (WALK.ride) WALK.ride.v.root.updateMatrixWorld();   // the coach was moved this frame: carry him with it now, not a frame late
  if (WALK.wave >= 0) { WALK.wave += dt; if (WALK.wave > 2.8) WALK.wave = -1; }
  // what he wants: keys or the stick, relative to the way he looks
  let f = 0, s = 0;
  const k = WALK.keys;
  if (k.KeyW || k.ArrowUp) f += 1; if (k.KeyS || k.ArrowDown) f -= 1; if (k.KeyD || k.ArrowRight) s += 1; if (k.KeyA || k.ArrowLeft) s -= 1;
  if (WALK.stick.on) { f += -WALK.stick.y; s += WALK.stick.x; }
  let m = Math.hypot(f, s); if (m > 1) { f /= m; s /= m; m = 1; }
  const run = WALK.runT !== !!(k.ShiftLeft || k.ShiftRight) || (WALK.stick.on && m > 0.92);
  const want = m * (run ? RUN_V : WALK_V);
  WALK.speed += clamp(want - WALK.speed, -6 * dt, 4 * dt);
  if (WALK.mode === 'ride') WALK.rideStep(dt, f, s, m); else WALK.footStep(dt, f, s, m);
  // the stride
  const cyc = lerp(1.5, 2.9, smooth(1.9, 3.4, WALK.speed));
  WALK.phase = (WALK.phase + TAU * WALK.speed / cyc * dt) % (TAU * 1000);
  WALK.place();
  // a train standing at a platform waits for a man walking up to it or stepping off it
  WALK.holdTrains(dt);
  WALK.actT -= dt;
  if (WALK.actT <= 0) { WALK.actT = 0.15; WALK.act = WALK.findAction(); WALK.ui(); }
  WALK.infoT -= dt; if (WALK.infoT <= 0) { WALK.infoT = 0.5; WALK.info(); }
};
WALK.footStep = function (dt, f, s, m) {
  const p = WALK.p, q = _kQ.copy(p);
  if (m > 0.01) {
    const fw = yawDir(WALK.lookYaw, _kA), rt = _kB.set(-fw.z, 0, fw.x);
    _kC.copy(fw).multiplyScalar(f).addScaledVector(rt, s).normalize();
    q.addScaledVector(_kC, WALK.speed * dt);
    // he turns to the way he is going; in first person he faces where he looks
    const ty = WALK.fp ? WALK.lookYaw : yawOf(_kC);
    WALK.yaw += angWrap(ty - WALK.yaw) * Math.min(1, dt * 10);
  } else if (WALK.fp) WALK.yaw = WALK.lookYaw;
  q.x = clamp(q.x, INNER.x0 + 20, INNER.x1 - 20); q.z = clamp(q.z, -INNER.n1 + 20, -INNER.n0 - 20);
  walkSolid(q, null);
  let fl = floorAt(q.x, q.z, p.y);
  // a cliff, or water too deep to wade, turns him back
  const deep = !WORLD.mtn && !WORLD.custom && fl.y < -4.7;
  if (fl.wall || deep) { q.x = p.x; q.z = p.z; walkSolid(q, null); fl = floorAt(q.x, q.z, p.y); }
  p.x = q.x; p.z = q.z;
  if (p.y > fl.y + 0.03) { WALK.vy -= 9.81 * dt; p.y += WALK.vy * dt; if (p.y <= fl.y) { p.y = fl.y; WALK.vy = 0; } }
  else { p.y = fl.y > p.y ? p.y + Math.min(fl.y - p.y, Math.max(0.04, dt * 4)) : fl.y; WALK.vy = 0; }
};
/* in a coach: the aisle between the seats, the open ends, the bulkhead doors, the vestibule, and through the
   diaphragm into the next coach */
function coachRoom(l, prev, obs) {
  const xb = CH.xb, xv = CH.xv, R = 0.2, rows = 9.86, ax = Math.abs(l.x), sx = Math.sign(l.x) || 1;
  if (obs && l.x < -(xb - 0.3)) l.x = -(xb - 0.3);
  const zIn = x => { const a = Math.abs(x); return a <= rows ? COACH_IN.aisle - R - 0.02 : a <= xb - 0.25 ? COACH_IN.hi - R : a < xb + 0.25 ? 0.42 - R : CH.hw - 0.3; };
  if (ax > xv - 0.2) l.x = sx * (xv - 0.2);
  const lim = zIn(l.x);
  if (Math.abs(l.z) > lim) {
    // stepping into a narrower part sideways on is not allowed: hold him where he was along the car
    // he is steered along the narrower part toward its middle instead, as a man edges to a door
    if (Math.abs(prev.z) > lim + 0.01 && zIn(prev.x) > lim) { const st = Math.hypot(l.x - prev.x, l.z - prev.z); l.x = prev.x; l.z = prev.z - Math.sign(prev.z) * Math.min(st, Math.abs(prev.z) - lim); }
    else l.z = Math.sign(l.z) * lim;
  }
  return l;
}
WALK.rideStep = function (dt, f, s, m) {
  const r = WALK.ride;
  // the coach is gone (a train made up again, a player left): he is left standing beside where it was
  if (!camConsists().includes(r.c) || !r.c.vehicles.includes(r.v)) { const w = local2world(r.v, r.l, _kA); WALK.ride = null; WALK.mode = 'foot'; WALK.p.copy(w); WALK.p.y = floorAt(w.x, w.z, w.y + 2).y; WALK.ui(); return; }
  if (r.seat) { WALK.speed = 0; return; }
  if (m < 0.01) return;
  const prev = _kD.copy(r.l), fw = yawDir(WALK.lookYaw, _kA), rt = _kB.set(-fw.z, 0, fw.x);
  _kC.copy(fw).multiplyScalar(f).addScaledVector(rt, s).normalize();
  const sp = Math.min(WALK.speed, WALK_V);   // nobody runs down a coach aisle
  WALK.speed = Math.min(WALK.speed, WALK_V);
  r.l.addScaledVector(_kC, sp * dt);
  r.yaw += angWrap((WALK.fp ? WALK.lookYaw : yawOf(_kC)) - r.yaw) * Math.min(1, dt * 10);
  // through the end door to the next car: the one coupled on at this end
  if (Math.abs(r.l.x) > CH.xv - 0.22 && Math.abs(r.l.z) < 0.3) {
    const i = r.c.vehicles.indexOf(r.v), n = r.c.vehicles[i + ((r.l.x > 0) !== !!r.v.flip ? -1 : 1)];
    if (n && isCoach(n) && n.pos && n.pos.distanceTo(r.v.pos) < (n.len + r.v.len) / 2 + 1.5) {
      const w = local2world(r.v, r.l, _kA), wy = yawToWorld(r.v, r.yaw), wl = yawToWorld(r.v, WALK.lookYaw);
      world2local(n, w, r.l); r.l.y = COACH_IN.yF; r.l.x = Math.sign(r.l.x) * (CH.xv - 0.3);
      WALK.showInterior(n, true);
      r.v = n; r.yaw = yawToLocal(n, wy); WALK.lookYaw = yawToLocal(n, wl);
      return;
    }
  }
  coachRoom(r.l, prev, isObs(r.v));
};
/* put the figure where he is and pose him */
WALK.place = function () {
  const rig = WALK.rigReady(), R = rig.root, r = WALK.ride;
  if (r) {
    local2world(r.v, r.l, R.position);
    R.quaternion.setFromRotationMatrix(_kM.extractRotation(r.v.root.matrixWorld)).multiply(_kQQ.setFromAxisAngle(_kU, r.yaw));
  } else { R.position.copy(WALK.p); R.quaternion.setFromAxisAngle(_kU, WALK.yaw); }
  rig.pose({ phase: WALK.phase, speed: WALK.speed, sit: r && r.seat ? r.seat.h : 0, wave: WALK.wave, look: WALK.lookPitch, t: WALK.t });
  R.visible = !WALK.fp;
};
const _kU = new THREE.Vector3(0, 1, 0), _kQQ = new THREE.Quaternion();

/* hold an AI train's doors while he walks up to it or is getting off */
WALK.holdTrains = function (dt) {
  for (const a of AI.trains) {
    if (!(a.dwell > 0) || !a.train.lead.pos) { WALK.holds.delete(a); continue; }
    let h = WALK.holds.get(a); if (!h) WALK.holds.set(a, h = { t: 0 });
    let near = false;
    if (WALK.mode === 'ride' && WALK.ride.c === a.train) near = !WALK.ride.seat && Math.abs(WALK.ride.l.x) > CH.xb - 2;
    else if (WALK.mode === 'foot') for (const v of a.train.vehicles) if (isCoach(v) && v.pos.distanceTo(WALK.p) < 26) { near = true; break; }
    if (near && a.dwell < 6 && h.t < 45) { h.t += dt; a.dwell = 6; }
  }
};

/* ---------------- the camera ---------------- */
WALK.camera = function (cam, dt) {
  cam.near = 0.05;
  const r = WALK.ride, P = WALK.lookPitch;
  let fov = WALK.fp ? 66 : 56;
  if (cam.aspect < 1) fov = Math.min(84, fov * 1.25);
  if (r) {
    const M4 = r.v.root.matrixWorld, sitH = r.seat ? r.seat.h + PD.seatHip + 0.7 : PD.eye;
    const head = _kA.copy(r.l); head.y += WALK.fp ? sitH : (r.seat ? sitH - 0.1 : 1.55);
    const d = _kB.set(Math.sin(WALK.lookYaw) * Math.cos(P), Math.sin(P), Math.cos(WALK.lookYaw) * Math.cos(P));
    if (WALK.fp) { _kC.copy(head).addScaledVector(d, 0.1); head.addScaledVector(d, 0.1); }
    else {
      _kC.copy(head).addScaledVector(d, -Math.min(WALK.dist, 2.2));
      const vest = Math.abs(_kC.x) > CH.xb - 0.1, zl = (vest ? CH.hw - 0.12 : COACH_IN.hi - 0.08);
      _kC.x = clamp(_kC.x, -(CH.xv - 0.1), CH.xv - 0.1); _kC.z = clamp(_kC.z, -zl, zl); _kC.y = clamp(_kC.y, COACH_IN.yF + 0.3, CH.eave + 0.45);
    }
    const tgt = head.addScaledVector(d, WALK.fp ? 1 : 0.0);
    cam.position.copy(_kC).applyMatrix4(M4);
    tgt.applyMatrix4(M4);
    cam.up.set(0, 1, 0); cam.lookAt(tgt);
  } else {
    const p = WALK.p, d = _kB.set(Math.sin(WALK.lookYaw) * Math.cos(P), Math.sin(P), Math.cos(WALK.lookYaw) * Math.cos(P));
    if (WALK.fp) {
      cam.position.set(p.x, p.y + PD.eye, p.z).addScaledVector(yawDir(WALK.yaw, _kC), 0.09);
      cam.lookAt(_kA.copy(cam.position).add(d));
    } else {
      const tgt = _kA.set(p.x, p.y + 1.5, p.z), back = _kC.copy(d).negate();
      const dd = camClear(tgt, back, WALK.dist, 0.5);
      cam.position.copy(tgt).addScaledVector(back, dd);
      const g = groundAt(cam.position.x, -cam.position.z), b = WORLD.mtn ? mtInBore(cam.position.x, cam.position.z, 0) : null;
      if (!b && cam.position.y < g + 0.3) cam.position.y = g + 0.3;
      cam.lookAt(tgt);
    }
  }
  CAM.fov += (fov - CAM.fov) * Math.min(1, dt * 4);
  cam.fov = CAM.fov; cam.updateProjectionMatrix();
};
WALK.look = function (dx, dy) {
  const k = 0.0055;
  WALK.lookYaw -= dx * k;
  WALK.lookPitch = clamp(WALK.lookPitch - dy * k, -1.35, 1.25);
};
WALK.zoom = function (f) { WALK.dist = clamp(WALK.dist * f, 1.6, 9); };
WALK.toggleView = function () { WALK.fp = !WALK.fp; if (WALK.fp && !WALK.ride) WALK.yaw = WALK.lookYaw; WALK.ui(); };

/* ---------------- coach interiors near the camera ---------------- */
WALK.showInterior = function (v, on) {
  const have = WALK.interiors.get(v);
  if (on && !have) {
    const g = coachInterior(isObs(v)); linearizeObject(g); v.model.root.add(g);
    const wins = []; v.model.root.traverse(o => { if (o.isMesh && (o.name === 'win' || o.name === 'holWin')) { wins.push([o, o.material]); o.material = RMAT.ciGlass; } });
    WALK.interiors.set(v, { g, wins });
  } else if (!on && have) {
    have.g.parent && have.g.parent.remove(have.g);
    have.g.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
    for (const [o, m] of have.wins) o.material = m;
    WALK.interiors.delete(v);
  }
};
WALK.interiorsFrame = function (dt) {
  coachInLight(SKY.dark);
  WALK.inT -= dt; if (WALK.inT > 0) return; WALK.inT = 0.4;
  const cam = camera.position, keep = new Set(), near = [];
  if (WALK.ride) keep.add(WALK.ride.v);
  for (const c of camConsists()) for (const v of c.vehicles) if (isCoach(v) && v.pos) { const d = v.pos.distanceTo(cam); if (d < 40) near.push([d, v]); }
  near.sort((a, b) => a[0] - b[0]);
  for (const [, v] of near.slice(0, 5)) keep.add(v);
  for (const p of WALK.peers.values()) if (p.seatOf && p.seatOf.pos && p.seatOf.pos.distanceTo(cam) < 60) keep.add(p.seatOf);
  for (const v of [...WALK.interiors.keys()]) {
    const live = camConsists().some(c => c.vehicles.includes(v));
    if (!live || (!keep.has(v) && (!v.pos || v.pos.distanceTo(cam) > 60))) WALK.showInterior(v, false);
  }
  for (const v of keep) if (!WALK.interiors.has(v)) WALK.showInterior(v, true);
};

/* ---------------- the panel ---------------- */
WALK.ui = function () {
  const b = $('walkAct'); if (!b) return;
  const a = WALK.act;
  const txt = a ? a.label : (WALK.mode === 'ride' ? 'Riding' : 'Walking'), sub = a ? a.sub || '' : '';
  if (b.dataset.t !== txt + '|' + sub) { b.dataset.t = txt + '|' + sub; b.textContent = txt; if (sub) { const sm = document.createElement('small'); sm.textContent = sub; b.appendChild(sm); } }
  b.disabled = !(a && a.go);
  $('walkView').textContent = WALK.fp ? '3rd' : '1st';
  $('walkRun').classList.toggle('on', WALK.runT);
  $('walkRun').hidden = WALK.mode === 'ride';
  $('camName').textContent = WALK.on ? (WALK.mode === 'ride' ? 'Riding' : 'On foot') + (WALK.fp ? ' · 1st person' : '') : CAM.names[CAM.mode];
};
/* where he is and what is coming: the next trains due at the station he is standing at, or where the train he
   is riding stops next */
WALK.info = function () {
  let title = 'On foot', sub = '';
  if (WALK.mode === 'ride') {
    const c = WALK.ride.c, mph = Math.round(Math.abs(walkSpeedOf(c)) / MPH);
    title = `Riding ${trainName(c)} · ${mph} mph`;
    if (c.ai) { const ev = c.ai.events.find(e => e.stop && !e.done); sub = c.ai.dwell > 0 ? `Standing at ${WALK.stationNear(WALK.ride.v.pos, 200) || 'the station'}. ${WALK.ride.seat ? 'Stand up and walk to a door to get off.' : 'Get off at a door.'}` : ev ? `Next stop <em>${ev.stop}</em>` : 'Running to its next stop'; }
    else if (c === GAME.train) sub = 'Nobody is at the throttle.';
    else sub = mph < 1 ? 'Stopped. Get off at a door.' : '';
  } else {
    const st = WALK.station(WALK.p, 90);
    if (st) { title = `On foot · ${st.name}`; sub = WALK.due(st); }
    const T = GAME.train;
    if (T && T.lead.pos) { const d = T.lead.pos.distanceTo(WALK.p); if (d > 60) sub += (sub ? '<br>' : '') + `Your engine is ${fmtFt(d)} away.`; }
  }
  if ($('walkTitle').textContent !== title) $('walkTitle').textContent = title;
  if ($('walkSub').innerHTML !== sub) $('walkSub').innerHTML = sub;
};
WALK.station = function (p, r) { let best = null; for (const st of ROUTE.stations) { if (!st.p || st.kind === 'quarry') continue; const d = Math.hypot(st.p.x - p.x, st.p.z - p.z); if (d < r && (!best || d < best.d)) best = { st, d }; } return best && best.st; };
WALK.stationNear = function (p, r) { const s = WALK.station(p, r); return s && s.name; };
/* the AI passenger trains still to call at station st, soonest first */
WALK.due = function (st) {
  if (!AI.trains.length) return MP.on ? 'Waiting for a ride. Your friends can see you on the platform.' : 'No trains are running (Other trains is off in the menu).';
  const L = ROUTE.mainLen, rows = [];
  for (const a of AI.trains) {
    if (!a.def.stops || !a.train.lead.pos) continue;
    const f = AI.along(a.train.endTP('front'), a.dir); if (f === null || st.line !== ROUTE.main) continue;
    const to = (((a.dir > 0 ? st.sLine : -st.sLine) - f) % L + L) % L;
    const here = a.train.lead.pos.distanceTo(st.p) < 260 && a.dwell > 0;
    const eta = here ? 0 : (to + 40) / (a.def.vmax * MPH * 0.7) + (a.dwell > 0 ? a.dwell : 0);
    rows.push({ a, eta, here, to });
  }
  rows.sort((x, y) => x.eta - y.eta);
  if (!rows.length) return 'No passenger trains call here.';
  return rows.slice(0, 2).map(r => r.here ? `<em>${r.a.name}</em> ${r.a.def.sub.toLowerCase()} is standing here. Board it!` : `<em>${r.a.name}</em> ${r.a.def.sub.toLowerCase()}, about ${Math.max(1, Math.round(r.eta / 60))} min (${fmtMi(r.to)} off)`).join('<br>');
};

/* ---------------- input ---------------- */
const WALK_PASS = ['KeyM', 'KeyP', 'Escape', 'Tab'];
WALK.key = function (e) {
  if (WALK_PASS.includes(e.code)) return false;
  WALK.keys[e.code] = true;
  if (!e.repeat) switch (e.code) {
    case 'KeyF': case 'KeyE': case 'Space': WALK.doAction(); break;
    case 'Enter': case 'NumpadEnter': WALK.toCab(); break;
    case 'KeyV': case 'KeyC': WALK.toggleView(); break;
    case 'KeyG': WALK.waveNow(); break;
    case 'KeyR': WALK.runT = !WALK.runT; WALK.ui(); break;
    case 'Minus': case 'NumpadSubtract': WALK.zoom(1.15); break;
    case 'Equal': case 'NumpadAdd': WALK.zoom(1 / 1.15); break;
  }
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  return true;
};
WALK.keyup = function (e) { WALK.keys[e.code] = false; };
WALK.waveNow = function () { if (!(WALK.ride && WALK.ride.seat)) WALK.wave = 0; else WALK.wave = 0; };
WALK.setup = function () {
  // on foot the camera button swaps first and third person
  $('btnCam').addEventListener('click', e => { if (WALK.on) { e.stopImmediatePropagation(); WALK.toggleView(); } }, true);
  $('btnWalk').addEventListener('click', () => { if (WALK.on) WALK.toCab(); else WALK.leaveCab(); });
  $('walkAct').addEventListener('click', () => WALK.doAction());
  $('walkView').addEventListener('click', () => WALK.toggleView());
  $('walkRun').addEventListener('click', () => { WALK.runT = !WALK.runT; WALK.ui(); });
  $('walkWave').addEventListener('click', () => WALK.waveNow());
  const st = $('walkStick'), knob = st.querySelector('i');
  let pid = null;
  const set = e => { const r = st.getBoundingClientRect(), R = r.width / 2; let x = (e.clientX - r.left - R) / R, y = (e.clientY - r.top - R) / R; const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; } WALK.stick.x = x; WALK.stick.y = y; knob.style.transform = `translate(${x * R * 0.62}px,${y * R * 0.62}px)`; };
  st.addEventListener('pointerdown', e => { pid = e.pointerId; st.setPointerCapture(pid); WALK.stick.on = true; set(e); e.preventDefault(); e.stopPropagation(); });
  st.addEventListener('pointermove', e => { if (e.pointerId === pid) set(e); });
  const end = e => { if (e.pointerId !== pid) return; pid = null; WALK.stick.on = false; WALK.stick.x = WALK.stick.y = 0; knob.style.transform = ''; };
  st.addEventListener('pointerup', end); st.addEventListener('pointercancel', end);
  addEventListener('blur', () => { WALK.keys = {}; });
  addEventListener('keyup', e => WALK.keyup(e));
};

/* sound: the listener rides with our train only while riding it */
{ const was = CAM.riding; CAM.riding = () => WALK.on ? !!(WALK.ride && WALK.ride.c === GAME.train) : was(); }

/* ---------------- other players ----------------
   Sent with the room state as av: [1, x, y, z, yaw, speed, flags] on foot, or [2, owner, car, x, z, yaw, speed,
   flags, seat] riding, the car counted in the owner's train ('' for the owner's own id when it is ours).
   flags: 1 waving. */
WALK.net = function () {
  if (!WALK.on) return null;
  const fl = WALK.wave >= 0 ? 1 : 0, sp = +WALK.speed.toFixed(2);
  if (WALK.mode === 'ride') {
    const r = WALK.ride, c = r.c; let owner = null;
    if (c === GAME.train) owner = MP.id; else for (const p of MP.peers.values()) if (p.rt && p.rt.train === c) owner = p.id;
    if (!owner) return null;
    const si = r.seat ? coachSeats().findIndex(s => s === r.seat || (Math.abs(s.x - r.seat.x) < 0.01 && Math.abs(s.z - r.seat.z) < 0.01)) : -1;
    return [2, owner, c.vehicles.indexOf(r.v), +r.l.x.toFixed(2), +r.l.z.toFixed(2), +r.yaw.toFixed(2), sp, fl, si];
  }
  return [1, +WALK.p.x.toFixed(2), +WALK.p.y.toFixed(2), +WALK.p.z.toFixed(2), +WALK.yaw.toFixed(2), sp, fl];
};
function walkClean(a) {
  if (!Array.isArray(a)) return null;
  const n = (x, lo, hi) => (typeof x === 'number' && isFinite(x)) ? clamp(x, lo, hi) : 0;
  if (a[0] === 1 && a.length >= 7) return [1, n(a[1], -1e5, 1e5), n(a[2], -2000, 5000), n(a[3], -1e5, 1e5), n(a[4], -10, 10), n(a[5], 0, 6), a[6] ? 1 : 0];
  if (a[0] === 2 && a.length >= 9 && typeof a[1] === 'string' && /^[a-z0-9]{6,16}$/.test(a[1])) return [2, a[1], Math.round(n(a[2], 0, 200)), n(a[3], -13, 13), n(a[4], -2, 2), n(a[5], -10, 10), n(a[6], 0, 6), a[7] ? 1 : 0, Math.round(n(a[8], -1, 200))];
  return null;
}
WALK.peersFrame = function (dt) {
  const live = new Set();
  if (MP.on) for (const p of MP.peers.values()) {
    const av = p.st.av; if (!av) continue;
    live.add(p.id);
    let w = WALK.peers.get(p.id);
    if (!w) { const rig = buildPerson({ shirt: p.color ? parseInt(String(p.color).replace('#', ''), 16) || 0x8a4b3a : 0x8a4b3a }); linearizeObject(rig.root); scene.add(rig.root); w = { rig, phase: 0, pos: new THREE.Vector3(), yaw: 0, init: false, wave: -1, tag: null, waitT: 0, toldAt: '' }; WALK.peers.set(p.id, w); }
    w.seatOf = null; w.seat = null;
    const R = w.rig.root;
    if (av[0] === 1) {
      _kA.set(av[1], av[2], av[3]);
      if (!w.init || w.pos.distanceTo(_kA) > 20) w.pos.copy(_kA); else w.pos.lerp(_kA, Math.min(1, dt * 8));
      w.yaw += angWrap(av[4] - w.yaw) * Math.min(1, dt * 10); w.init = true;
      R.position.copy(w.pos); R.quaternion.setFromAxisAngle(_kU, w.yaw);
      // tell the room's drivers when a friend is waiting on a platform
      const st = av[5] < 0.2 ? WALK.station(w.pos, 60) : null;
      w.waitT = st ? w.waitT + dt : 0;
      if (st && w.waitT > 6 && w.toldAt !== st.name) { w.toldAt = st.name; toast(`${p.st.nm} is waiting on the platform at ${st.name}.`, 'good', 5000, 'wait' + p.id); }
      if (!st && w.waitT === 0 && w.pos.distanceTo(_kA) < 1) { /* still walking */ }
    } else {
      const owner = av[1] === MP.id ? GAME.train : (MP.peers.get(av[1]) && MP.peers.get(av[1]).rt ? MP.peers.get(av[1]).rt.train : null);
      const v = owner && owner.vehicles[av[2]];
      if (!v || !isCoach(v)) { R.visible = false; continue; }
      v.root.updateMatrixWorld();
      w.seatOf = v; w.seat = av[8] >= 0 ? coachSeats()[av[8]] || null : null;
      local2world(v, _kA.set(av[3], COACH_IN.yF, av[4]), R.position);
      R.quaternion.setFromRotationMatrix(_kM.extractRotation(v.root.matrixWorld)).multiply(_kQQ.setFromAxisAngle(_kU, av[5]));
      w.pos.copy(R.position); w.init = true; w.toldAt = '';
    }
    if (av[6] > 0.05) w.phase = (w.phase + TAU * av[6] / lerp(1.5, 2.9, smooth(1.9, 3.4, av[6])) * dt) % (TAU * 1000);
    if (av[7]) w.wave = w.wave < 0 ? 0 : w.wave + dt; else w.wave = -1;
    R.visible = true;
    w.rig.pose({ phase: w.phase, speed: av[0] === 2 && w.seat ? 0 : av[6], sit: w.seat ? w.seat.h : 0, wave: w.wave, t: WALK.t });
    WALK.peerTag(p, w);
  }
  for (const [id, w] of [...WALK.peers]) if (!live.has(id)) { scene.remove(w.rig.root); w.rig.root.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); if (w.tag) w.tag.remove(); WALK.peers.delete(id); }
};
WALK.peerTag = function (p, w) {
  let el = w.tag;
  if (!el) { el = w.tag = document.createElement('div'); el.className = 'mpTag'; const dot = document.createElement('i'); dot.style.background = p.color; el.appendChild(dot); el.appendChild(document.createElement('span')); $('mpTags').appendChild(el); }
  _kA.copy(w.pos); _kA.y += w.seat ? 1.5 : 2.05;
  const d = _kA.distanceTo(camera.position); _kB.copy(_kA).project(camera);
  if (d > 400 || _kB.z > 1 || Math.abs(_kB.x) > 1.1 || Math.abs(_kB.y) > 1.1) { el.style.display = 'none'; return; }
  el.style.display = '';
  el.style.transform = `translate(${Math.round((_kB.x * 0.5 + 0.5) * innerWidth)}px,${Math.round((-_kB.y * 0.5 + 0.5) * innerHeight)}px) translate(-50%,-100%)`;
  if (el.children[1].textContent !== p.st.nm) el.children[1].textContent = p.st.nm;
};

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
  fall: null, fv: new THREE.Vector3(), fp0: new THREE.Vector3(), cv: new Map(),
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
    const fl = Math.hypot(F.f.x, F.f.z) || 1; l.push(F.p.x, F.p.z, F.p.y, F.f.x / fl, F.f.z / fl, e.isBridge(Math.min(s, e.len)) ? 1 : 0);
  }
  return (WALK.tg = G);
};
/* the top of whatever is underfoot on the railroad at (x, z): the rail heads (he steps up onto a rail rather
   than through it), the ties, and the ballast section as 04_world.js lays it (flat to 1.9 m out, then the
   shoulder and the slope); on a bridge only the deck between the guard timbers. -Infinity away from the track */
const BALLAST_U = [1.3, 1.9, 3.15, 7.6], BALLAST_V = [-0.2, -0.205, -0.95, -3.4];
function ballastV(u) {
  if (u <= BALLAST_U[0]) return -0.17;   // the ties (their tops are the rails' base)
  for (let i = 1; i < BALLAST_U.length; i++) if (u <= BALLAST_U[i]) return lerp(BALLAST_V[i - 1], BALLAST_V[i], (u - BALLAST_U[i - 1]) / (BALLAST_U[i] - BALLAST_U[i - 1]));
  return -Infinity;
}
function bedAt(x, z) {
  const G = WALK.trackGrid(), i = Math.floor(x / 8), j = Math.floor(z / 8); let best = -Infinity;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const l = G.get((i + a) + ',' + (j + b)); if (!l) continue;
    for (let q = 0; q < l.length; q += 6) {
      const dx = x - l[q], dz = z - l[q + 1]; if (dx * dx + dz * dz > 64) continue;
      const along = dx * l[q + 3] + dz * l[q + 4]; if (Math.abs(along) > 1.05) continue;
      const lat = Math.abs(dx * l[q + 4] - dz * l[q + 3]);
      if (l[q + 5] && lat > 1.4) continue;
      let v = ballastV(lat);
      // a boot (11 cm wide) over a rail head stands on the rail
      if (Math.abs(lat - RAIL_OFF) < 0.09) v = 0;
      if (l[q + 2] + v > best) best = l[q + 2] + v;
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
/* benches, carts and fence runs, in 16 m cells by their centres (none is longer than about 6 m) */
function blocksNear(x, z) {
  if (!WALK.bg || WALK.bgN !== SCN.blocks.length) {
    const G = new Map(); for (const f of SCN.blocks) { const k = Math.floor(f[0] / 16) + ',' + Math.floor(f[1] / 16); let l = G.get(k); if (!l) G.set(k, l = []); l.push(f); }
    WALK.bg = G; WALK.bgN = SCN.blocks.length;
  }
  const i = Math.floor(x / 16), j = Math.floor(z / 16), out = [];
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = WALK.bg.get((i + a) + ',' + (j + b)); if (l) out.push(...l); }
  return out;
}
/* keep a man standing at p (feet) out of buildings, benches, trees and poles, and rolling stock */
function walkSolid(p, skip) {
  for (let pass = 0; pass < 2; pass++) {
    for (const f of SCN.foot) {
      if (Math.abs(f[0] - p.x) > f[6] + f[7] + 1 || Math.abs(f[1] - p.z) > f[6] + f[7] + 1) continue;
      if (inFootXZ(f, p.x, p.z, WALK_R) && p.y < footTop(f) - 0.4) pushOut(p, f, WALK_R);
    }
    for (const f of blocksNear(p.x, p.z)) if (p.y < f[9] - 0.05 && p.y + 1.75 > f[8]) pushOut(p, f, WALK_R);
    for (const t of treesNear(p.x, p.z)) {
      if (p.y > t[4]) continue;
      // under a high canopy he still meets the trunk
      const trunk = p.y + 1.8 < t[3], dx = p.x - t[0], dz = p.z - t[1], h = Math.hypot(dx, dz);
      if (trunk && (t[2] < 1.2 || p.y + 1.8 < t[3] - 30)) continue;   // a pole or a mast is its own solid; nothing grows 30 m above him
      const r = (trunk ? clamp(t[2] * 0.09, 0.14, 0.45) : Math.min(t[2], 1.2)) + WALK_R;
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
  if (MP.on) for (const x of MP.trains()) if (x.rt.train === c) return x.rt.v || 0;
  return c.v || 0;
}
const isCoach = v => v.kind === 'coach' && v.model && v.model.root;
const isObs = v => !!(v.model && v.model.root.userData.markers);
/* the vestibule doors of a coach, in its own frame: [x, side] */
const coachDoors = v => { const xd = (CH.xb + CH.xv) / 2, out = []; for (const e of isObs(v) ? [1] : [1, -1]) for (const s of [-1, 1]) out.push([e * xd, s]); return out; };

/* ---------------- the cars he can ride in ----------------
   A plan of each: the frame it is laid out in (a coach's own; a trainset car's body, which turns with a reversed
   car and leans with the Acela's tilt), floor height, outside half width, doors [x, side, inside z], seats (cushion
   centre, height, the way it faces, where in the aisle you stand to take it), the room to walk, the open ends. */
function walkPlan(v) {
  const m = v && v.model; if (!m || !m.root) return null;
  if (m._wp !== undefined) return m._wp;
  return (m._wp = v.kind === 'coach' ? coachPlan(v) : m.set && m.walk ? hsPlan(m) : null);
}
const walkable = v => !!walkPlan(v);
function coachPlan(v) {
  const obs = isObs(v), xr = [-CH.xv + 0.2, CH.xv - 0.2];
  const seats = coachSeats().map(q => Object.assign(q, { yaw: Math.PI / 2, ax: q.x + 0.35, sx: q.x + 0.42, look: Math.PI / 2 + (q.z > 0 ? 0.55 : -0.55) }));
  return {
    coach: true, obs, yF: COACH_IN.yF, hw: CH.hw, mid: 0, seats, xr, ends: [!obs, true], frame: v.root,
    doors: coachDoors(v).map(([x, s]) => [x, s, CH.hw - 0.45]),
    atDoor: l => Math.abs(l.x) > CH.xb + 0.2 && Math.abs(l.z) > CH.hw - 0.7,
    inVest: l => Math.abs(l.x) > CH.xb + 0.2,
    nearDoor: l => Math.abs(l.x) > CH.xb - 2,
    atEnd: l => Math.abs(l.x) > CH.xv - 0.22 && Math.abs(l.z) < 0.3,
    room: (l, prev) => coachRoom(l, prev, obs),
    cam: c => {
      const vest = Math.abs(c.x) > CH.xb - 0.1, zl = (vest ? CH.hw - 0.12 : COACH_IN.hi - 0.08);
      c.x = clamp(c.x, -(CH.xv - 0.1), CH.xv - 0.1); c.z = clamp(c.z, -zl, zl); c.y = clamp(c.y, COACH_IN.yF + 0.3, CH.eave + 0.45);
    },
  };
}
/* a trainset car (06e_hsr, 06f_hsint): the aisle down the saloon, a doorway at each end wall, the vestibules with the
   side doors, and the doorway through the gangway to the next car */
function hsPlan(m) {
  const W = m.walk, S = W.saloon, [vf, vb] = W.vest, R = 0.2, dz = HS_DOOR.w / 2 - 0.16;
  const ra = Math.min(R, (S.aisle[1] - S.aisle[0]) / 2 - 0.02), A = [S.aisle[0] + ra, S.aisle[1] - ra], mid = (S.aisle[0] + S.aisle[1]) / 2;
  const xr = [vb ? vb.xEnd + 0.02 : S.x1 + 0.3, vf ? vf.xEnd - 0.02 : S.x0 - 0.3];
  const door = [-dz, dz], vestOf = x => (vf && x > S.x0 ? vf : vb && x < S.x1 ? vb : null);
  const zr = x => {
    const v = vestOf(x + 0.25) || vestOf(x - 0.25);
    if (!v) return A;
    if (Math.abs(x - (v === vf ? S.x0 : S.x1)) < 0.25 || Math.abs(x - v.xa) < 0.25 || (v === vf ? x > v.xa : x < v.xa)) return door;
    return [-(v.zw - R), v.zw - R];
  };
  const seats = S.seats.map(q => Object.assign({}, q, { sx: q.ax, look: q.yaw + 0.3 * Math.sign(q.z - mid) * -Math.sign(Math.sin(q.yaw)) }));
  const doors = [];
  for (const v of [vf, vb]) if (v) for (const x of v.doors) for (const s of [-1, 1]) doors.push([x, s, v.zw - 0.35]);
  const slide = []; m.inner.traverse(o => { if (o.isMesh && (o.name === 'hsSlide' || o.name === 'hsSlidePane')) slide.push(o); });
  return {
    hs: true, yF: W.yF, hw: W.hw, mid, seats, xr, ends: [!!vb, !!vf], frame: m.body, doors, slide, open: 0, A,
    atDoor: l => { const v = vestOf(l.x); return !!v && Math.abs(l.z) > v.zw - 0.6 && v.doors.some(x => Math.abs(l.x - x) < 0.65); },
    inVest: l => !!vestOf(l.x),
    nearDoor: l => l.x > S.x0 - 2 || l.x < S.x1 + 2,
    nearEndDoor: l => l.x > S.x0 - 3 || l.x < S.x1 + 3,
    atEnd: l => (l.x > xr[1] - 0.15 || l.x < xr[0] + 0.15) && Math.abs(l.z) < 0.3,
    inSaloon: l => l.x < S.x0 && l.x > S.x1,
    room: (l, prev) => {
      l.x = clamp(l.x, xr[0], xr[1]);
      const [lo, hi] = zr(l.x);
      if (l.z < lo || l.z > hi) {
        // into a narrower part (a doorway, the aisle) off its line: hold him there and edge him across to it
        if (prev.z < lo - 0.01 || prev.z > hi + 0.01) { const st = Math.hypot(l.x - prev.x, l.z - prev.z), t = clamp(prev.z, lo, hi); l.x = prev.x; l.z = prev.z + Math.sign(t - prev.z) * Math.min(st, Math.abs(t - prev.z)); }
        else l.z = clamp(l.z, lo, hi);
      }
      return l;
    },
    cam: c => {
      c.x = clamp(c.x, xr[0] + 0.1, xr[1] - 0.1);
      const v = vestOf(c.x), zl = v ? v.zw - 0.1 : S.zWall - 0.2;
      // in the saloon, under the luggage racks along the walls
      c.z = clamp(c.z, -zl, zl); c.y = clamp(c.y, W.yF + 0.3, v ? v.ceil - 0.1 : Math.abs(c.z) > S.zWall - 0.55 ? W.yF + 1.45 : W.yF + 1.95);
    },
  };
}
/* the trainset cars' sliding doors open while he is near an end of the car he is in */
function hsSlideFrame(dt) {
  const r = WALK.on && WALK.ride;
  for (const c of camConsists()) for (const v of c.vehicles) {
    const P = v.model && v.model._wp; if (!P || !P.hs) continue;
    const want = r && r.v === v && !r.seat && P.nearEndDoor(r.l) ? 1 : 0;
    if (P.open === want) continue;
    P.open = clamp(P.open + Math.sign(want - P.open) * dt * 1.6, 0, 1);
    const k = smooth(0, 1, P.open) * 0.84;
    for (const o of P.slide) o.position.z = k;
  }
}
function trainName(c) {
  if (c === GAME.train) return 'your train';
  if (c.parkS) return FLEET.name(c);
  if (c.ai) return c.ai.name;
  if (MP.on) for (const x of MP.trains()) if (x.rt.train === c) return `${x.p.st.nm}'s ${x.main ? 'train' : LOCO_SPEC[x.h.st.lk].short || 'train'}`;
  return 'the cars';
}
/* a car's walking frame: a coach's own, a trainset car's body */
const vFrame = v => { const P = walkPlan(v); return (P ? P.frame : v.root).matrixWorld; };
const local2world = (v, l, out) => out.copy(l).applyMatrix4(vFrame(v));
const world2local = (v, w, out) => out.copy(w).applyMatrix4(_kM.copy(vFrame(v)).invert());
/* a direction's yaw between the world and a vehicle's frame (whose +X is ahead and +Z to the right) */
function yawToLocal(v, th) { yawDir(th, _kA); _kB.copy(_kA).transformDirection(_kM.copy(vFrame(v)).invert()); return Math.atan2(_kB.x, _kB.z); }
function yawToWorld(v, th) { yawDir(th, _kA); _kA.transformDirection(vFrame(v)); return Math.atan2(_kA.x, _kA.z); }

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
  if (MP.watching) MP.unwatch();
  const L = T.loco, x = (L.cabEye ? L.cabEye.x : 0) - 0.4;
  L.root.updateMatrixWorld();
  if (Math.abs(S.v) > 0.3) {
    // moving: hang off the bottom step on one side and jump, with the train's speed
    const vel = _kD.copy(T.lead.fwd).multiplyScalar(S.v); vel.y = 0;
    let pick = null, why = '';
    for (const s of [1, -1]) {
      const w = new THREE.Vector3(x, 0.9, s * 1.95).applyMatrix4(L.root.matrixWorld), out = new THREE.Vector3(0, 0, s).transformDirection(L.root.matrixWorld);
      out.y = 0; out.normalize();
      const ok = walkLandCheck(w, out, vel);
      if (ok === true) { if (!pick || ok === true && pick.platform < walkPlatformness(w, out)) pick = { w, out, platform: walkPlatformness(w, out) }; }
      else why = why || ok;
    }
    if (!pick) { toast(why || 'Nowhere to jump to here.', 'warn', 2400, 'walk'); return; }
    WALK.rigReady();
    WALK.jump(pick.w, vel, pick.out);
    WALK.mode = 'foot'; WALK.setOn(true);
    toast(`You jump from the cab at ${Math.round(Math.abs(S.v) / MPH)} mph. Nobody is at the throttle now.`, 'warn', 3600, 'walk');
    return;
  }
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
  if (WALK.fall) return;   // get up first
  WALK.setOn(false);
  cycleCamera('cab');
  if (!quiet) toast('Back in the cab.', '', 1800, 'walk');
};
WALK.board = function (c, v, door) {
  const [x, s, zi] = door;
  if (walkRel(c) > WALK_HOP) { toast('Too fast to catch. Wait for it to stop, or run alongside.', 'warn', 1800, 'walk'); return; }
  WALK.ride = { c, v, l: new THREE.Vector3(x, walkPlan(v).yF, s * zi), seat: null, yaw: s > 0 ? Math.PI : 0 };
  WALK.lookYaw = WALK.ride.yaw; WALK.mode = 'ride'; WALK.vy = 0; WALK.fall = null;
  WALK.showInterior(v, true);
  toast(`You climb aboard ${trainName(c)}.`, 'good', 2600, 'walk');
  WALK.ui();
};
/* off a coach by the nearest vestibule door, onto whatever is outside it */
WALK.alight = function () {
  const r = WALK.ride; if (!r) return;
  let best = null; const P = walkPlan(r.v);
  if (Math.abs(walkSpeedOf(r.c)) > 0.3) {
    // moving: down onto the bottom step of the nearest door and jump, with the car's speed
    const vel = _kD.copy(r.vel || walkVel(r.c, _kD)); vel.y = 0;
    let why = '';
    for (const [x, s] of P.doors) {
      const w = local2world(r.v, _kA.set(x, 0.75, s * Math.max(P.hw + 0.3, 1.95)), new THREE.Vector3());
      const out = new THREE.Vector3(0, 0, s).transformDirection(vFrame(r.v)); out.y = 0; out.normalize();
      const ok = walkLandCheck(w, out, vel);
      if (ok !== true) { why = why || ok; continue; }
      const d = Math.hypot(r.l.x - x, r.l.z - s * P.hw) - walkPlatformness(w, out) * 6;
      if (!best || d < best.d) best = { d, w, out };
    }
    if (!best) { toast(why || 'Nowhere to jump to here.', 'warn', 2400, 'walk'); return; }
    const mph = Math.round(Math.hypot(vel.x, vel.z) / MPH);
    WALK.ride = null; WALK.mode = 'foot';
    WALK.jump(best.w, vel, best.out);
    toast(mph >= 12 ? `You jump off at ${mph} mph. Tuck and roll!` : `You hop off at ${mph} mph.`, mph >= 12 ? 'warn' : '', 2600, 'walk');
    WALK.ui();
    return;
  }
  for (const [x, s] of P.doors) {
    const w = local2world(r.v, _kA.set(x, 0, s * (P.hw + 0.75)), new THREE.Vector3()), f = floorAt(w.x, w.z, w.y + 0.4);
    const d = Math.hypot(r.l.x - x, r.l.z - s * P.hw) - (f.y > w.y - 0.6 ? 6 : 0);   // a platform beats walking a little further
    if (!best || d < best.d) best = { d, w, f, s };
  }
  WALK.p.set(best.w.x, best.f.y, best.w.z); WALK.vy = 0;
  const yl = best.s > 0 ? 0 : Math.PI;   // facing out of the door
  WALK.yaw = WALK.lookYaw = yawToWorld(r.v, yl);
  WALK.ride = null; WALK.mode = 'foot';
  toast('You step down.', '', 1800, 'walk');
  WALK.ui();
};
WALK.reset = function () { WALK.fall = null; if (WALK.on) WALK.setOn(false); for (const [v] of WALK.interiors) WALK.showInterior(v, false); WALK.tg = null; };

/* ---------------- what he can do where he is ---------------- */
WALK.findAction = function () {
  const T = GAME.train;
  if (WALK.mode === 'ride') {
    const r = WALK.ride, l = r.l, P = walkPlan(r.v), moving = Math.abs(walkSpeedOf(r.c)) > 0.3;
    if (r.seat) return { label: 'Stand up', sub: 'Take a walk through the train', go: () => WALK.stand() };
    const inVest = P.inVest(l);
    if (P.atDoor(l)) return moving ? { label: 'Jump off', sub: `At ${Math.round(Math.abs(walkSpeedOf(r.c)) / MPH)} mph`, go: () => WALK.alight() } : { label: 'Get off', sub: 'Step down here', go: () => WALK.alight() };
    let near = null;
    if (!inVest) for (const s of P.seats) { const d = Math.abs(s.ax - l.x), dm = Math.abs(s.z - P.mid); if (d < (P.hs ? 0.5 : 0.75) && (!near || d < near.d - 0.01 || (Math.abs(d - near.d) <= 0.01 && dm < near.dm))) near = { s, d, dm }; }
    if (near) { const taken = WALK.seatTaken(r.v, near.s); return { label: 'Sit down', sub: taken ? 'Next seat over is free' : 'Window seat', go: () => WALK.sit(near.s) }; }
    return moving ? { label: 'Riding', sub: 'Find a seat', off: true } : { label: 'Get off', sub: 'By the nearest door', go: () => WALK.alight() };
  }
  // on the ground: a coach door or your own cab within reach
  if (WALK.fall) return { label: WALK.fall.ph === 'air' ? 'Jumping' : 'Down', sub: WALK.fall.ph === 'lie' || WALK.fall.ph === 'up' ? 'Getting up' : '', off: true };
  let best = null;
  for (const c of camConsists()) {
    const sp = walkRel(c) > WALK_HOP ? 1 : 0;
    for (const v of c.vehicles) {
      if (!v.pos || Math.abs(v.pos.x - WALK.p.x) > v.len || Math.abs(v.pos.z - WALK.p.z) > v.len) continue;
      const P = walkPlan(v);
      if (P) for (const d of P.doors) {
        const w = local2world(v, _kA.set(d[0], 0.6, d[1] * (P.hw + 0.3)), _kC), dd = Math.hypot(w.x - WALK.p.x, w.z - WALK.p.z);
        if (dd < 1.9 && Math.abs(WALK.p.y - w.y) < 2.2 && (!best || dd < best.dd)) best = { dd, label: 'Board', sub: trainName(c), wait: sp > 0.4, go: () => WALK.board(c, v, d) };
      }
      // your own cab, or the cab of one of your other trains standing about: climbing in takes it over
      if ((c === T || c.parkS) && v === c.lead && c.loco.cabEye) {
        for (const s of [-1, 1]) {
          const w = _kA.set(c.loco.cabEye.x - 0.4, 0, s * 2.0).applyMatrix4(c.loco.root.matrixWorld), dd = Math.hypot(w.x - WALK.p.x, w.z - WALK.p.z);
          if (dd < 2.2 && (!best || dd < best.dd)) best = c === T ? { dd, label: 'Climb up', sub: 'Into your cab', wait: sp > 0.4, go: () => WALK.toCab() }
            : { dd, label: 'Climb up', sub: `Take over ${FLEET.name(c)}`, wait: sp > 0.4, go: () => { if (FLEET.select(c, { walk: true })) WALK.toCab(true); } };
        }
      }
    }
  }
  if (best) return best.wait ? { label: best.label, sub: 'Too fast · run alongside', off: true } : best;
  return null;
};
WALK.seatTaken = function (v, s) { for (const p of WALK.peers.values()) if (p.seatOf === v && p.seat && Math.abs(p.seat.x - s.x) < 0.1 && Math.abs(p.seat.z - s.z) < 0.1) return true; return false; };
WALK.sit = function (s) {
  const r = WALK.ride; if (!r) return;
  // the window seat if it is free, else the one by the aisle
  const P = walkPlan(r.v), side = q => Math.sign(q.z - P.mid);
  const row = P.seats.filter(q => Math.abs(q.x - s.x) < 0.01 && side(q) === side(s)).sort((a, b) => Math.abs(b.z - P.mid) - Math.abs(a.z - P.mid));
  const free = row.find(q => !WALK.seatTaken(r.v, q)) || row[0];
  r.seat = free; r.l.set(free.x, P.yF, free.z); r.yaw = free.yaw; WALK.lookYaw = free.look; WALK.lookPitch = -0.05;
  WALK.ui();
};
WALK.stand = function () { const r = WALK.ride; if (!r || !r.seat) return; const P = walkPlan(r.v); r.l.set(r.seat.sx, P.yF, P.hs ? clamp(P.mid, P.A[0], P.A[1]) : 0); r.seat = null; WALK.ui(); };
WALK.doAction = function () { const a = WALK.act; if (a && a.go) a.go(); };

/* ---------------- each frame ---------------- */
WALK.frame = function (dt) {
  WALK.peersFrame(dt);
  WALK.interiorsFrame(dt);
  hsSlideFrame(dt);
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
  if (WALK.fall) f = s = 0;   // no say in where he goes until he has his feet
  let m = Math.hypot(f, s); if (m > 1) { f /= m; s /= m; m = 1; }
  const run = WALK.runT !== !!(k.ShiftLeft || k.ShiftRight) || (WALK.stick.on && m > 0.92);
  const want = m * (run ? RUN_V : WALK_V);
  WALK.speed += clamp(want - WALK.speed, -6 * dt, 4 * dt);
  if (dt > 0) WALK.trackVel(dt);
  if (WALK.mode === 'ride') WALK.rideStep(dt, f, s, m); else if (WALK.fall) WALK.fallMove(dt); else WALK.footStep(dt, f, s, m);
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

/* ---------------- off a moving train ----------------
   How fast things go: the trains (their leads, differenced each frame, or our own train's speed) and him. */
const WALK_HOP = 1.8;   // m/s: the most a man can match to swing up onto a step or into a cab
WALK.trackVel = function (dt) {
  const keep = new Set();
  for (const c of camConsists()) {
    const v = c.lead; if (!v || !v.pos) continue; keep.add(c);
    let e = WALK.cv.get(c); if (!e) { WALK.cv.set(c, e = { p: v.pos.clone(), v: new THREE.Vector3() }); continue; }
    _kA.subVectors(v.pos, e.p).divideScalar(dt);
    if (_kA.lengthSq() > 120 * 120) _kA.set(0, 0, 0);   // put somewhere new, not moved
    e.v.lerp(_kA, Math.min(1, dt * 8)); e.p.copy(v.pos);
  }
  for (const c of [...WALK.cv.keys()]) if (!keep.has(c)) WALK.cv.delete(c);
  // him: on foot, or the car under him while riding
  const r = WALK.ride;
  if (r) {
    if (!r.vp || r.vpv !== r.v) { r.vp = r.v.pos.clone(); r.vpv = r.v; r.vel = walkVel(r.c, new THREE.Vector3()); }
    else { _kA.subVectors(r.v.pos, r.vp).divideScalar(dt); if (_kA.lengthSq() < 120 * 120) r.vel.lerp(_kA, Math.min(1, dt * 8)); r.vp.copy(r.v.pos); }
  } else {
    _kA.subVectors(WALK.p, WALK.fp0).divideScalar(dt); _kA.y = 0;
    if (_kA.lengthSq() > 60 * 60) _kA.set(0, 0, 0);
    WALK.fv.lerp(_kA, Math.min(1, dt * 10));
  }
  WALK.fp0.copy(WALK.p);
};
function walkVel(c, out) {
  if (c === GAME.train) return out.copy(c.lead.fwd).multiplyScalar(S.v);
  const e = WALK.cv.get(c); return e ? out.copy(e.v) : out.set(0, 0, 0);
}
/* how fast a train goes past him: what he has to match to get on */
function walkRel(c) {
  const sp = Math.abs(walkSpeedOf(c)); if (sp < 0.4) return sp;
  walkVel(c, _kQ); _kQ.y = 0;
  if (_kQ.lengthSq() < 0.01) return sp;   // not tracked yet
  return Math.hypot(_kQ.x - WALK.fv.x, _kQ.z - WALK.fv.z);
}
/* is there somewhere to land beside the step at w, jumping out along out while carried along at vel?
   true, or why not */
function walkLandCheck(w, out, vel) {
  const sp = Math.hypot(vel.x, vel.z), ax = sp > 0.1 ? vel.x / sp : 0, az = sp > 0.1 ? vel.z / sp : 0;
  for (const [o, a] of [[1.2, 0], [1.2, 0.5], [2.4, 0.9]]) {
    const x = w.x + out.x * o + ax * a * Math.min(sp, 30) * 0.5, z = w.z + out.z * o + az * a * Math.min(sp, 30) * 0.5;
    const f = floorAt(x, z, w.y);
    if (f.wall) return 'No room to jump on this side.';
    if (!WORLD.mtn && !WORLD.custom && f.y < -4.7) return 'Not into the water.';
    if (w.y - f.y > 6.5) return 'Too far down to jump here.';
    const tp = new THREE.Vector3(x, f.y, z); walkSolid(tp, null);
    if (Math.hypot(tp.x - x, tp.z - z) > 0.6) return 'Something in the way on this side.';
  }
  return true;
}
/* a platform beside the step (land on that rather than the ballast) */
function walkPlatformness(w, out) { const f = floorAt(w.x + out.x * 1.6, w.z + out.z * 1.6, w.y); return f.y > w.y - 0.6 ? 1 : 0; }
/* off the bottom step at w: pushed out along out, up a little, with the train's velocity vel */
WALK.jump = function (w, vel, out) {
  const B = WALK.fall = { ph: 'air', v: { x: vel.x + out.x * 1.7, z: vel.z + out.z * 1.7 }, th: 0, tuck: 0, t: 0, hit: 0, air: 0 };
  WALK.p.copy(w); WALK.vy = 1.0; WALK.fv.set(B.v.x, 0, B.v.z); WALK.fp0.copy(w);
  // he faces the way the ground is going under him, as a railroader is taught, and looks there too
  const sp = Math.hypot(vel.x, vel.z);
  _kA.set(sp > 1 ? vel.x : out.x, 0, sp > 1 ? vel.z : out.z);
  WALK.yaw = yawOf(_kA);
  WALK.lookYaw = yawOf(_kB.set(B.v.x, 0, B.v.z)); WALK.lookPitch = -0.2;
  WALK.speed = 0;
  WALK.ui();
};
/* in the air, then running it out or rolling, carried by his momentum; walls and cars stop him dead */
WALK.fallMove = function (dt) {
  const B = WALK.fall, p = WALK.p, q = _kQ.copy(p);
  q.x += B.v.x * dt; q.z += B.v.z * dt;
  q.x = clamp(q.x, INNER.x0 + 20, INNER.x1 - 20); q.z = clamp(q.z, -INNER.n1 + 20, -INNER.n0 - 20);
  const want = Math.hypot(q.x - p.x, q.z - p.z);
  walkSolid(q, null);
  let fl = floorAt(q.x, q.z, p.y);
  const deep = !WORLD.mtn && !WORLD.custom && fl.y < -4.7;
  if (fl.wall || deep) { q.x = p.x; q.z = p.z; walkSolid(q, null); fl = floorAt(q.x, q.z, p.y); }
  const got = Math.hypot(q.x - p.x, q.z - p.z);
  if (want > 1e-4 && got < want * 0.6) {
    // run into something: he stops against it (what is left goes along it)
    const k = got / want; B.v.x *= k; B.v.z *= k;
    if (want / dt > 4 && B.ph !== 'air') walkThud(Math.min(1, want / dt / 12), false);
  }
  p.x = q.x; p.z = q.z;
  if (B.ph === 'air' || p.y > fl.y + 0.05) {
    B.air = Math.min(1, (B.air || 0) + dt * 5);
    WALK.vy -= 9.81 * dt; p.y += WALK.vy * dt;
    if (p.y <= fl.y) {
      p.y = fl.y;
      if (B.ph === 'air') {
        const ph = fallLand(B, WALK.vy);
        walkThud(clamp(B.hit / 14, 0.25, 1), ph === 'roll');
        walkDust(p, B, ph === 'roll' ? 1 : ph === 'stumble' ? 0.45 : 0.15);
        if (ph === 'roll' && B.hit > 9) toast(`You hit the ground at ${Math.round(B.hit / MPH)} mph.`, 'warn', 2400, 'walk');
      }
      WALK.vy = 0;
    }
  } else {
    p.y = fl.y; WALK.vy = 0;
    B.air = Math.max(0, (B.air || 0) - dt * 6);
    const u0 = Math.hypot(B.v.x, B.v.z), th0 = B.th;
    if (fallStep(B, dt)) {
      // on his feet again: what speed he has left he walks off
      WALK.fall = null; WALK.speed = Math.min(Math.hypot(B.v.x, B.v.z), RUN_V);
      WALK.ui(); return;
    }
    // the ground he goes over: puffs of dust and ballast as he rolls, a scuff each time he comes round
    if (B.ph === 'roll' && Math.floor(B.th / Math.PI) !== Math.floor(th0 / Math.PI)) { walkThud(clamp(u0 / 14, 0.15, 0.8), true); walkDust(p, B, clamp(u0 / 10, 0.2, 1)); }
  }
  // he faces the way he is going while he can, and the camera swings round to follow him
  const u = Math.hypot(B.v.x, B.v.z);
  if (u > 1 && B.ph !== 'lie' && B.ph !== 'up' && B.ph !== 'flop') {
    const ty = Math.atan2(B.v.x, B.v.z);
    WALK.yaw += angWrap(ty - WALK.yaw) * Math.min(1, dt * (B.ph === 'air' ? 4 : 8));
    if (!WALK.fp) WALK.lookYaw += angWrap(ty - WALK.lookYaw) * Math.min(1, dt * 1.5);
  }
  WALK.speed = B.ph === 'stumble' ? Math.min(u, 5) : 0;
};
function walkThud(g, scrape) {
  if (typeof AU === 'undefined' || !AU.on || !AU.world) return;
  try {
    const t = AU.ctx.currentTime + 0.005;
    envNoise(t, 0.16, 260, 1.1, 0.75 * g, AU.world, 'lowpass', AU.noise, 0.003);
    envTone(t, 0.13, 90, 0.45 * g, AU.world, 'sine', 48);
    if (scrape) envNoise(t + 0.02, 0.28, 2400, 1.4, 0.22 * g, AU.world, 'bandpass', AU.white, 0.01);
  } catch (e) { }
}
/* a puff where he hits: dust, and a few stones kicked out of the ballast */
function walkDust(p, B, k) {
  if (typeof DIG === 'undefined' || !DIG.dust) return;
  const n = Math.round(k * 7 * (DIG.q || 1)), u = Math.hypot(B.v.x, B.v.z);
  const bal = bedAt(p.x, p.z) > groundAt(p.x, -p.z) + 0.05;
  for (let i = 0; i < n; i++) {
    const t = Math.random();
    digEmit(DIG.dust, p.x + (Math.random() - 0.5) * 0.8, p.y + 0.25, p.z + (Math.random() - 0.5) * 0.8,
      B.v.x * 0.3 + (Math.random() - 0.5) * 1.4, 0.3 + 0.8 * Math.random(), B.v.z * 0.3 + (Math.random() - 0.5) * 1.4,
      0.5 + 0.7 * k * Math.random(), 1.6 + 1.6 * Math.random(), bal ? 0.6 + 0.05 * t : 0.6 + 0.06 * t, bal ? 0.58 + 0.05 * t : 0.52 + 0.05 * t, bal ? 0.55 + 0.05 * t : 0.42 + 0.05 * t, p.y, null);
  }
  if (bal && u > 3) for (let i = 0; i < Math.round(k * 6 * (DIG.q || 1)); i++) {
    const sh = 0.42 + 0.12 * Math.random();
    digEmit(DIG.clods, p.x + (Math.random() - 0.5) * 0.5, p.y + 0.1, p.z + (Math.random() - 0.5) * 0.5,
      B.v.x * 0.5 + (Math.random() - 0.5) * 2, 1 + 2 * Math.random(), B.v.z * 0.5 + (Math.random() - 0.5) * 2,
      0.035 + 0.035 * Math.random(), 1.2 + Math.random(), sh, sh * 0.98, sh * 0.94, p.y, null);
  }
}
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
  // through the end door to the next car: whichever car coupled on next to this one has an open end right here
  const P = walkPlan(r.v);
  if (P.atEnd(r.l)) {
    const i = r.c.vehicles.indexOf(r.v), w = local2world(r.v, r.l, _kA);
    for (const n of [r.c.vehicles[i - 1], r.c.vehicles[i + 1]]) {
      const N = walkPlan(n); if (!N || !n.pos || n.pos.distanceTo(r.v.pos) > (n.len + r.v.len) / 2 + 1.5) continue;
      n.root.updateMatrixWorld();
      const q = world2local(n, w, _kB);
      if (Math.abs(q.x) > n.len / 2 + 1.5 || Math.abs(q.x) < n.len / 2 - 3 || Math.abs(q.z) > 1.2 || !N.ends[q.x > 0 ? 1 : 0]) continue;
      const wy = yawToWorld(r.v, r.yaw), wl = yawToWorld(r.v, WALK.lookYaw);
      r.l.set(clamp(q.x, N.xr[0] + 0.3, N.xr[1] - 0.3), N.yF, clamp(q.z, -0.2, 0.2));
      WALK.showInterior(n, true);
      r.v = n; r.yaw = yawToLocal(n, wy); WALK.lookYaw = yawToLocal(n, wl);
      return;
    }
  }
  P.room(r.l, prev);
};
/* put the figure where he is and pose him */
WALK.place = function () {
  const rig = WALK.rigReady(), R = rig.root, r = WALK.ride;
  if (r) {
    local2world(r.v, r.l, R.position);
    R.quaternion.setFromRotationMatrix(_kM.extractRotation(vFrame(r.v))).multiply(_kQQ.setFromAxisAngle(_kU, r.yaw));
  } else if (WALK.fall) { walkPoseFall(rig, WALK.p, WALK.yaw, WALK.fall, WALK.phase, WALK.t); R.visible = !WALK.fp; return; }
  else { R.position.copy(WALK.p); R.quaternion.setFromAxisAngle(_kU, WALK.yaw); }
  rig.pose({ phase: WALK.phase, speed: WALK.speed, sit: r && r.seat ? r.seat.h : 0, wave: WALK.wave, look: WALK.lookPitch, t: WALK.t });
  R.visible = !WALK.fp;
};
/* a man in the air, running it out, rolling or lying, with his feet (or whatever is lowest) at p.y.
   B: { ph, th, tuck, air } (see fallStep in 06g_person.js) */
const _kR = new THREE.Vector3(1, 0, 0), _kQ2 = new THREE.Quaternion();
function walkPoseFall(rig, p, yaw, B, phase, t) {
  const R = rig.root, down = B.ph !== 'air' && B.ph !== 'land' && B.ph !== 'stumble';
  rig.pose({ phase, speed: B.ph === 'stumble' ? Math.min(Math.hypot(B.v ? B.v.x : 0, B.v ? B.v.z : 0), 5) : 0, air: B.air || 0, flail: B.ph === 'stumble' ? 1 : 0, tuck: B.tuck || 0, free: down, t });
  R.quaternion.setFromAxisAngle(_kU, yaw);
  if (!down) { R.position.copy(p); return; }
  // rolled forward about his middle, then put down by the lowest of him
  R.quaternion.multiply(_kQ2.setFromAxisAngle(_kR, B.th || 0));
  const ch = lerp(0.95, 0.5, B.tuck || 0);
  _kC.set(0, ch, 0).applyQuaternion(R.quaternion);
  R.position.set(p.x - _kC.x, p.y + ch - _kC.y, p.z - _kC.z);
  R.updateMatrixWorld(true);
  R.position.y += p.y - personLow(rig);
}
const _kU = new THREE.Vector3(0, 1, 0), _kQQ = new THREE.Quaternion();

/* hold an AI train's doors while he walks up to it or is getting off */
WALK.holdTrains = function (dt) {
  for (const a of AI.trains) {
    if (!(a.dwell > 0) || !a.train.lead.pos) { WALK.holds.delete(a); continue; }
    let h = WALK.holds.get(a); if (!h) WALK.holds.set(a, h = { t: 0 });
    let near = false;
    if (WALK.mode === 'ride' && WALK.ride.c === a.train) near = !WALK.ride.seat && walkPlan(WALK.ride.v).nearDoor(WALK.ride.l);
    else if (WALK.mode === 'foot') for (const v of a.train.vehicles) if (walkable(v) && v.pos && v.pos.distanceTo(WALK.p) < 26) { near = true; break; }
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
    const M4 = vFrame(r.v), sitH = r.seat ? r.seat.h + PD.seatHip + 0.7 : PD.eye;
    const head = _kA.copy(r.l); head.y += WALK.fp ? sitH : (r.seat ? sitH - 0.1 : 1.55);
    const d = _kB.set(Math.sin(WALK.lookYaw) * Math.cos(P), Math.sin(P), Math.cos(WALK.lookYaw) * Math.cos(P));
    if (WALK.fp) { _kC.copy(head).addScaledVector(d, 0.1); head.addScaledVector(d, 0.1); }
    else {
      _kC.copy(head).addScaledVector(d, -Math.min(WALK.dist, 2.2));
      walkPlan(r.v).cam(_kC);
    }
    const tgt = head.addScaledVector(d, WALK.fp ? 1 : 0.0);
    cam.position.copy(_kC).applyMatrix4(M4);
    tgt.applyMatrix4(M4);
    cam.up.set(0, 1, 0); cam.lookAt(tgt);
  } else {
    const p = WALK.p, d = _kB.set(Math.sin(WALK.lookYaw) * Math.cos(P), Math.sin(P), Math.cos(WALK.lookYaw) * Math.cos(P));
    const B = WALK.fall, downB = B && B.ph !== 'air' && B.ph !== 'land' && B.ph !== 'stumble';
    if (WALK.fp && downB && WALK.rig) {
      // through his own eyes as he goes over: from his head, looking half where he looks and half where his face is
      WALK.rig.j.head.updateMatrixWorld();
      cam.position.setFromMatrixPosition(WALK.rig.j.head.matrixWorld);
      _kC.set(0, 0, 1).transformDirection(WALK.rig.j.head.matrixWorld).lerp(d, 0.45).normalize();
      cam.position.y = Math.max(cam.position.y, p.y + 0.18);
      cam.up.set(0, 1, 0); cam.lookAt(_kA.copy(cam.position).add(_kC));
    } else if (WALK.fp) {
      cam.position.set(p.x, p.y + PD.eye, p.z).addScaledVector(yawDir(WALK.yaw, _kC), 0.09);
      cam.lookAt(_kA.copy(cam.position).add(d));
    } else {
      WALK.camH = lerp(WALK.camH || 1.5, downB ? 0.75 : 1.5, Math.min(1, dt * 3));
      const tgt = _kA.set(p.x, p.y + WALK.camH, p.z), back = _kC.copy(d).negate();
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
  if (on && !have && !(walkPlan(v) || {}).coach) return;   // a trainset car has its inside built in
  if (on && !have && v.model && v.model.root.userData.saloon) return;   // and so does every coach now (coachModel)
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
    const si = r.seat ? walkPlan(r.v).seats.findIndex(s => s === r.seat || (Math.abs(s.x - r.seat.x) < 0.01 && Math.abs(s.z - r.seat.z) < 0.01)) : -1;
    return [2, owner, c.vehicles.indexOf(r.v), +r.l.x.toFixed(2), +r.l.z.toFixed(2), +r.yaw.toFixed(2), sp, fl, si];
  }
  const B = WALK.fall;
  if (B) return [1, +WALK.p.x.toFixed(2), +WALK.p.y.toFixed(2), +WALK.p.z.toFixed(2), +WALK.yaw.toFixed(2), sp, fl, FALL_PH.indexOf(B.ph), +(B.th || 0).toFixed(2), +(B.tuck || 0).toFixed(2), +(B.air || 0).toFixed(2)];
  return [1, +WALK.p.x.toFixed(2), +WALK.p.y.toFixed(2), +WALK.p.z.toFixed(2), +WALK.yaw.toFixed(2), sp, fl];
};
const FALL_PH = ['air', 'land', 'stumble', 'roll', 'flop', 'lie', 'up'];
function walkClean(a) {
  if (!Array.isArray(a)) return null;
  const n = (x, lo, hi) => (typeof x === 'number' && isFinite(x)) ? clamp(x, lo, hi) : 0;
  if (a[0] === 1 && a.length >= 11) return [1, n(a[1], -1e5, 1e5), n(a[2], -2000, 5000), n(a[3], -1e5, 1e5), n(a[4], -10, 10), n(a[5], 0, 6), a[6] ? 1 : 0, Math.round(n(a[7], -1, 6)), n(a[8], -1e4, 1e4), n(a[9], 0, 1), n(a[10], 0, 1)];
  if (a[0] === 1 && a.length >= 7) return [1, n(a[1], -1e5, 1e5), n(a[2], -2000, 5000), n(a[3], -1e5, 1e5), n(a[4], -10, 10), n(a[5], 0, 6), a[6] ? 1 : 0];
  if (a[0] === 2 && a.length >= 9 && typeof a[1] === 'string' && /^[a-z0-9]{6,16}$/.test(a[1])) return [2, a[1], Math.round(n(a[2], 0, 200)), n(a[3], -14, 14), n(a[4], -2, 2), n(a[5], -10, 10), n(a[6], 0, 6), a[7] ? 1 : 0, Math.round(n(a[8], -1, 200))];
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
      const P = walkPlan(v);
      if (!P) { R.visible = false; continue; }
      v.root.updateMatrixWorld();
      w.seatOf = v; w.seat = av[8] >= 0 ? P.seats[av[8]] || null : null;
      local2world(v, _kA.set(av[3], P.yF, av[4]), R.position);
      R.quaternion.setFromRotationMatrix(_kM.extractRotation(vFrame(v))).multiply(_kQQ.setFromAxisAngle(_kU, av[5]));
      w.pos.copy(R.position); w.init = true; w.toldAt = '';
    }
    // on foot the speed and flags are a place earlier than riding
    const sp = av[0] === 1 ? av[5] : av[6], wav = av[0] === 1 ? av[6] : av[7];
    if (sp > 0.05) w.phase = (w.phase + TAU * sp / lerp(1.5, 2.9, smooth(1.9, 3.4, sp)) * dt) % (TAU * 1000);
    if (wav) w.wave = w.wave < 0 ? 0 : w.wave + dt; else w.wave = -1;
    R.visible = true;
    if (av[0] === 1 && av.length >= 11 && av[7] >= 0) {
      // jumping, running it out, rolling or getting up
      const fb = w.fb || (w.fb = { v: { x: 0, z: 0 } });
      fb.ph = FALL_PH[av[7]] || 'land'; fb.th = av[8]; fb.tuck = av[9]; fb.air = av[10]; fb.v.x = sp; fb.v.z = 0;
      walkPoseFall(w.rig, w.pos, w.yaw, fb, w.phase, WALK.t);
      WALK.peerTag(p, w);
      continue;
    }
    w.rig.pose({ phase: w.phase, speed: av[0] === 2 && w.seat ? 0 : sp, sit: w.seat ? w.seat.h : 0, wave: w.wave, t: WALK.t });
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

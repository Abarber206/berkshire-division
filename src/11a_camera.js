/* ============================================================================
   Outside cameras: chase, trackside, overhead, rear and the cinematic director.
   Every outside view is kept out of the ground, buildings, trees and trains,
   orbits ease toward where the player points them, and switching views blends
   instead of jumping.
   ========================================================================== */
Object.assign(CAM, { sm: null, fling: 0, vs: 0, prev: null, dAct: 0, blend: null, shot: null, shotN: 0, recent: [], fovCut: false, label: '', dronePitch: 0.85, shotRetry: 0 });
const _ca = new THREE.Vector3(), _cb = new THREE.Vector3(), _cc = new THREE.Vector3(), _cd = new THREE.Vector3(), _cU = new THREE.Vector3(0, 1, 0);
const _cqa = new THREE.Quaternion(), _cqb = new THREE.Quaternion(), _cMat = new THREE.Matrix4(), _cRay = new THREE.Raycaster(), _cF = newFrame();
const angWrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const ease = t => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
const camK = (rate, dt) => 1 - Math.exp(-rate * dt);

/* ---------------- what the camera can't go into ---------------- */
/* roof height over a building footprint, found once by looking down on it */
function footTop(f) {
  if (f[8] !== undefined) return f[8];
  let top = -Infinity;
  const groups = (WORLD.binGroups || []).filter(g => Math.hypot(g.userData.c.x - f[0], g.userData.c.z - f[1]) < g.userData.r + 30);
  for (const [u, w] of [[0, 0], [0.6, 0.6], [-0.6, 0.6], [0.6, -0.6], [-0.6, -0.6]]) {
    const x = f[0] + f[2] * u * f[6] + f[4] * w * f[7], z = f[1] + f[3] * u * f[6] + f[5] * w * f[7];
    _cRay.set(_ca.set(x, 600, z), _cb.set(0, -1, 0)); _cRay.far = 700;
    const hit = _cRay.intersectObjects(groups, true)[0];
    if (hit) top = Math.max(top, hit.point.y);
  }
  const g = groundAt(f[0], -f[1]);
  return (f[8] = isFinite(top) && top > g + 0.5 ? top : g + 6);
}
/* footprints near a point, so the per-frame checks only look at a handful */
function footsNear(x, z, r) {
  const out = [];
  for (const f of SCN.foot) if (Math.abs(f[0] - x) < r + f[6] + f[7] && Math.abs(f[1] - z) < r + f[6] + f[7]) out.push(f);
  return out;
}
const inFootXZ = (f, x, z, pad) => { const dx = x - f[0], dz = z - f[1]; return Math.abs(dx * f[2] + dz * f[3]) < f[6] + pad && Math.abs(dx * f[4] + dz * f[5]) < f[7] + pad; };
/* inside the ground, or inside the rock round a tunnel bore (the bore itself is open) */
function camRock(x, y, z) {
  const g = groundAt(x, -z);
  if (WORLD.mtn && y < g) { const b = mtInBore(x, z, 0); if (b) return y < b.rail + 0.45 || y > b.rail + b.top - 0.45; }
  return y < g + 0.45;
}
/* how far along tgt + dir*d the view is clear of the ground and buildings (trees are left to the push-out) */
function camClear(tgt, dir, d, minD = 3, feet = null) {
  const n = Math.max(8, Math.ceil(d / 4));
  feet = feet || footsNear(tgt.x, tgt.z, d).filter(f => !inFootXZ(f, tgt.x, tgt.z, 0.3));
  for (let k = 1; k <= n; k++) {
    const f = k / n, x = tgt.x + dir.x * d * f, y = tgt.y + dir.y * d * f, z = tgt.z + dir.z * d * f;
    let hit = camRock(x, y, z);
    if (!hit) for (const fp of feet) if (inFootXZ(fp, x, z, 0.6) && y < footTop(fp) + 0.6) { hit = true; break; }
    if (hit) return Math.max(minD, d * (k - 1) / n);
  }
  return d;
}
/* a clear line of sight between two points (ground and buildings) */
function camSees(a, b) {
  _cd.subVectors(b, a); const d = _cd.length(); _cd.multiplyScalar(1 / d);
  if (camClear(a, _cd, d, 0) < d - 0.01) return false;
  // a pole or a tree close to the lens would fill the frame; far off they are just scenery
  for (let t = 1; t < Math.min(d, 60); t += 1) {
    const x = a.x + _cd.x * t, y = a.y + _cd.y * t, z = a.z + _cd.z * t;
    if (treesNear(x, z).some(q => Math.hypot(x - q[0], z - q[1]) < q[2] + 0.25 + t * 0.012 && y > q[3] - 0.3 && y < q[4] + 0.3)) return false;
  }
  return true;
}
/* every consist the camera has to stay out of */
const camConsists = () => typeof IX !== 'undefined' && IX.consists ? IX.consists() : (GAME.train ? [GAME.train] : []);
/* pushes p out of the ground, trees, buildings and rolling stock; returns how far it moved */
function camSolid(p, lift = 0.9) {
  const x0 = p.x, y0 = p.y, z0 = p.z;
  for (const f of footsNear(p.x, p.z, 1)) {
    if (!inFootXZ(f, p.x, p.z, 0.5)) continue;
    const top = footTop(f) + 0.6; if (p.y < top) p.y = top;
  }
  for (let pass = 0; pass < 2; pass++) for (const t of treesNear(p.x, p.z)) {
    const dx = p.x - t[0], dz = p.z - t[1], r = t[2] + 0.35, h = Math.hypot(dx, dz);
    if (h >= r || p.y < t[3] - 0.3 || p.y > t[4] + 0.3) continue;
    const k = h > 1e-3 ? r / h : 0; if (k) { p.x = t[0] + dx * k; p.z = t[1] + dz * k; } else p.x = t[0] + r;
  }
  for (const c of camConsists()) for (const v of c.vehicles) {
    if (!v.pos || Math.abs(v.pos.x - p.x) > v.len + 4 || Math.abs(v.pos.z - p.z) > v.len + 4) continue;
    const dx = p.x - v.pos.x, dy = p.y - v.pos.y, dz = p.z - v.pos.z, fx = v.fwd.x, fz = v.fwd.z, fl = Math.hypot(fx, fz) || 1;
    const along = (dx * fx + dz * fz) / fl, lat = (dx * fz - dz * fx) / fl, hl = v.len / 2 + 0.45, hw = 1.95, top = 5.25;
    if (Math.abs(along) > hl || Math.abs(lat) > hw || dy > top || dy < -0.6) continue;
    const pTop = top - dy, pSide = hw - Math.abs(lat), pEnd = hl - Math.abs(along);
    if (pTop <= pSide && pTop <= pEnd) p.y += pTop;
    else if (pSide <= pEnd) { const s = Math.sign(lat) || 1, m = s * pSide / fl; p.x += fz * m; p.z -= fx * m; }
    else { const s = Math.sign(along) || 1, m = s * pEnd / fl; p.x += fx * m; p.z += fz * m; }
  }
  const g = groundAt(p.x, -p.z) + lift, b = WORLD.mtn && p.y < g - lift ? mtInBore(p.x, p.z, 1.2) : null;
  if (b) {   // in the bore: kept off the lining, under the arch and above the rails
    const w = BORE.half - 0.5, dl = clamp(b.l, -w, w) - b.l; p.x -= b.P.sn * dl; p.z -= b.P.c * dl;
    const top = BORE.spring + Math.sqrt(Math.max(0, BORE.half * BORE.half - (b.l + dl) ** 2));
    p.y = clamp(p.y, b.rail + Math.min(lift, 1.2), b.rail + top - 0.5);
  } else if (isFinite(g) && p.y < g) p.y = g;
  return Math.hypot(p.x - x0, p.y - y0, p.z - z0);
}
const treesNear = (x, z) => {
  const G = SCN.solids; if (!G) return [];
  const i = Math.floor(x / 40), j = Math.floor(z / 40), out = [];
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = G.get((i + a) + ',' + (j + b)); if (l) out.push(...l); }
  return out;
};
/* portrait screens see less sideways: widen a landscape field of view to keep the framing */
const fitFov = (f, cam) => cam.aspect >= 1 ? f : Math.min(82, 2 * Math.atan(Math.tan(f * Math.PI / 360) * Math.pow(1 / cam.aspect, 0.6)) * 180 / Math.PI);

/* ---------------- the train being watched ---------------- */
function camTrack(train, dt) {
  const pos = train.lead.pos;
  if (!CAM.prev || CAM.prev.t !== train || CAM.prev.p.distanceTo(pos) > 60) { CAM.prev = { t: train, p: pos.clone() }; CAM.vs = train === GAME.train ? S.v : 0; return; }
  if (dt > 0) {
    const v = _ca.subVectors(pos, CAM.prev.p).dot(train.lead.fwd) / dt;
    CAM.vs += (v - CAM.vs) * camK(3, dt);
  }
  CAM.prev.p.copy(pos);
}
/* the track frame d metres ahead of the train in the way it is moving (or facing, when stood) */
function camAhead(train, d, out) {
  const dir = Math.abs(CAM.vs) > 0.3 ? Math.sign(CAM.vs) : 1;
  const tp = (dir > 0 ? train.frontTP() : train.rearTP()).clone();
  tp.advance(dir * d, null);
  return tp.pose(out);
}
/* plan-view clearance of a spot from every track, optionally leaving out the track it was measured from */
const camGap = (p, skip) => trackGap(p.x, -p.z, skip);
/* nor right up against a tree or pole, which would loom in the corner of the frame */
const camSpotFree = (p, gap) => camGap(p) >= gap && !inFoot(p.x, -p.z, 1.5) && !treesNear(p.x, p.z).some(t => Math.hypot(p.x - t[0], p.z - t[1]) < t[2] + 7);

/* ---------------- views that follow the train ---------------- */
function orbitView(cam, train, dt, drone) {
  const fwd = train.lead.fwd, pos = train.lead.pos, hdg = Math.atan2(fwd.x, fwd.z);
  if (!CAM.sm) CAM.sm = { yaw: CAM.yaw, pitch: CAM.pitch, dist: CAM.dist, hdg, dyaw: CAM.droneYaw, dpitch: CAM.dronePitch };
  const s = CAM.sm, k = camK(9, dt);
  if (!CAM.init) s.hdg = hdg;
  if (CAM.fling) { if (drone) CAM.droneYaw += CAM.fling * dt; else CAM.yaw += CAM.fling * dt; CAM.fling *= Math.exp(-dt * 3.2); if (Math.abs(CAM.fling) < 0.02) CAM.fling = 0; }
  s.yaw += angWrap(CAM.yaw - s.yaw) * k; s.pitch += (CAM.pitch - s.pitch) * k; s.dist += (CAM.dist - s.dist) * camK(7, dt);
  s.dyaw += angWrap(CAM.droneYaw - s.dyaw) * k; s.dpitch += (CAM.dronePitch - s.dpitch) * k;
  // the view swings round curves a beat behind the engine, not locked to it
  s.hdg += angWrap(hdg - s.hdg) * camK(drone ? 2 : 3.5, dt);
  const portrait = cam.aspect < 1 ? clamp(1.25 / cam.aspect, 1, 2.2) : 1;
  const lead = clamp(CAM.vs * 0.3, -9, 9);
  const tgt = _cc.copy(pos).addScaledVector(fwd, drone ? lead - 10 : lead); tgt.y += drone ? 1 : 2.6;
  const yaw = s.hdg + (drone ? s.dyaw : s.yaw), pitch = drone ? s.dpitch : s.pitch, dist = (drone ? s.dist * 3.2 + 40 : s.dist) * portrait;
  const dir = _cb.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  // pull in at once when something gets between the camera and the engine, ease back out after
  const allowed = camClear(tgt, dir, dist, 4);
  if (!CAM.init || allowed < CAM.dAct) CAM.dAct = allowed; else CAM.dAct += (allowed - CAM.dAct) * camK(1.6, dt);
  cam.position.copy(tgt).addScaledVector(dir, CAM.dAct);
  camSolid(cam.position, 0.9);
  CAM.init = true;
  const lk = _cd.copy(tgt); if (!drone) lk.y -= Math.min(3.2, CAM.dAct * 0.09);
  cam.lookAt(lk);
  return fitFov(52, cam);
}
function rearView(cam, train, dt) {
  const v = train.last, out = -1;
  const back = _cc.copy(v.pos).addScaledVector(v.fwd, out * (v.len / 2 + 7)); back.y += 6.5;
  back.x += v.fwd.z * 3.2; back.z -= v.fwd.x * 3.2;
  if (!CAM.init) cam.position.copy(back); else cam.position.lerp(back, camK(6, dt));
  CAM.init = true;
  camSolid(cam.position, 1.2);
  const look = _cd.copy(v.pos).addScaledVector(v.fwd, -out * 40); look.y += 2;
  cam.lookAt(look);
  return fitFov(52, cam);
}

/* ---------------- shots: trackside and the cinematic director ---------------- */
/* each shot: pick() sets it up or returns null when there is no good spot, run() places the camera
   and returns false once it has nothing more to show. moving = the camera travels with the train */
const SHOTS = {
  trackside: {
    label: 'Trackside', moving: false, w: v => Math.abs(v) > 2 ? 3 : 0,
    pick(train) {
      for (let i = 0; i < 10; i++) {
        const F = camAhead(train, 170 + Math.random() * 230, _cF), side = Math.random() < 0.5 ? -1 : 1;
        const p = F.p.clone().addScaledVector(F.r, side * (8 + Math.random() * 14));
        const g = groundAt(p.x, -p.z); p.y = Math.max(g + 1.5 + Math.random() * 2.5, F.p.y + 0.8);
        if (!camSpotFree(p, 6) || !camSees(p, _ca.copy(F.p).setY(F.p.y + 2.5))) continue;
        return { p, look: train.lead.pos.clone(), passT: -1 };
      }
      return null;
    },
    run(st, cam, train, dt) {
      const pos = train.lead.pos, fwd = train.lead.fwd;
      const want = _ca.copy(pos).addScaledVector(fwd, 4); want.y += 2.2;
      // a camera operator panning by hand: the frame trails the engine a touch
      st.look.lerp(want, st.t ? camK(5, dt) : 1);
      cam.position.copy(st.p); cam.lookAt(st.look);
      const d = st.p.distanceTo(st.look), ahead = _cb.subVectors(st.p, pos).dot(fwd) * (Math.sign(CAM.vs) || 1);
      if (ahead < -10 && st.passT < 0) st.passT = st.t;
      if (st.passT >= 0 && st.t - st.passT > 3.5) return false;
      return d < 900 && st.t < 60 ? fitFov(clamp(2 * Math.atan(15 / d) * 180 / Math.PI, 9, 56), cam) : false;
    },
  },
  rail: {
    label: 'Rail level', moving: false, w: v => Math.abs(v) > 4 ? 2 : 0,
    pick(train) {
      for (let i = 0; i < 8; i++) {
        const F = camAhead(train, 110 + Math.random() * 110, _cF), side = Math.random() < 0.5 ? -1 : 1;
        const p = F.p.clone().addScaledVector(F.r, side * 3.05); p.y = F.p.y + 0.42;
        // clear of every other track, nothing in the way, and not down in a cutting
        if (camGap(p) < 2.95 || !camOtherClear(p, F.p, 3.2) || inFoot(p.x, -p.z, 1) || groundAt(p.x, -p.z) > p.y - 0.1) continue;
        const dir = Math.sign(CAM.vs) || 1, look = F.p.clone().addScaledVector(F.f, -dir * 70); look.y += 1.3;
        if (!camSees(p, look)) continue;
        return { p, look, dir, passT: -1 };
      }
      return null;
    },
    run(st, cam, train, dt) {
      // a locked-off camera down at the rail, aimed up the line: the train fills the frame and roars past
      cam.position.copy(st.p); cam.lookAt(st.look);
      const d = st.p.distanceTo(train.lead.pos), ahead = _cb.subVectors(st.p, train.lead.pos).dot(train.lead.fwd) * st.dir;
      if (ahead < -8 && st.passT < 0) st.passT = st.t;
      if (st.passT >= 0 && st.t - st.passT > 2.5) return false;
      return d < 400 && st.t < 45 && CAM.vs * st.dir > 0 ? fitFov(44, cam) : false;
    },
  },
  longlens: {
    label: 'Long lens', moving: false, w: v => Math.abs(v) > 8 ? 2 : 0,
    pick(train) {
      for (let i = 0; i < 6; i++) {
        const F = camAhead(train, 480 + Math.random() * 320, _cF), side = Math.random() < 0.5 ? -1 : 1;
        const p = F.p.clone().addScaledVector(F.r, side * 4.6); p.y = F.p.y + 2.1;
        if (camGap(p) < 3.4 || !camOtherClear(p, F.p, 3.6) || inFoot(p.x, -p.z, 1)) continue;
        const loco = _ca.copy(train.lead.pos); loco.y += 2.5;
        if (!camSees(p, loco)) continue;
        return { p, blocked: 0 };
      }
      return null;
    },
    run(st, cam, train, dt) {
      const look = _ca.copy(train.lead.pos).addScaledVector(train.lead.fwd, 3); look.y += 2.4;
      cam.position.copy(st.p); cam.lookAt(look);
      const d = st.p.distanceTo(look);
      st.chk = (st.chk || 0) - dt;
      if (st.chk < 0) { st.chk = 0.25; st.blocked = camSees(st.p, look) ? 0 : st.blocked + 0.25; }
      return d > 80 && st.blocked < 0.8 && st.t < 50 ? fitFov(clamp(2 * Math.atan(9 / d) * 180 / Math.PI, 2.5, 40), cam) : false;
    },
  },
  pace: {
    label: 'Tracking', moving: true, w: v => 3,
    pick(train) {
      const L = train.lead, side = camPaceSide(train, 8);
      if (!side) return null;
      return { side, a0: (Math.random() < 0.5 ? 0.35 : -0.1) * L.len, drift: -(1.2 + Math.random() * 1.4), lat0: 11, lat1: 7, h: 1.4 + Math.random() * 1.4, check: 0 };
    },
    run(st, cam, train, dt) { return paceRun(st, cam, train, dt, 40, 15); },
  },
  wheels: {
    label: 'Running gear', moving: true, w: v => Math.abs(v) > 2 ? 2 : 0.5,
    pick(train) {
      const L = train.lead, side = camPaceSide(train, 4.6);
      if (!side) return null;
      return { side, a0: 0.12 * L.len, drift: -0.5, lat0: 5, lat1: 4.3, h: 0.75, check: 0, aim: 1.1 };
    },
    run(st, cam, train, dt) { return paceRun(st, cam, train, dt, 52, 11); },
  },
  heli: {
    label: 'Helicopter', moving: true, w: v => 2.5,
    pick(train) {
      return { th: Math.random() * TAU, w: (Math.random() < 0.5 ? -1 : 1) * (0.07 + Math.random() * 0.05), R0: 120 + Math.random() * 40, R1: 75 + Math.random() * 20, H: 30 + Math.random() * 25, c: null };
    },
    run(st, cam, train, dt) {
      const pos = train.lead.pos, fwd = train.lead.fwd;
      const c = _ca.copy(pos).addScaledVector(fwd, clamp(CAM.vs * 1.2, -25, 25));
      if (!st.c) st.c = c.clone(); else st.c.lerp(c, camK(2, dt));
      st.th += st.w * dt;
      const e = ease(st.t / 16), R = lerp(st.R0, st.R1, e);
      const want = _cb.set(st.c.x + Math.sin(st.th) * R, 0, st.c.z + Math.cos(st.th) * R);
      // stay a steady height over the train, and climb over any hill in the way
      want.y = Math.max(st.c.y + st.H, groundAt(want.x, -want.z) + 12);
      const from = _cd.copy(st.c).setY(st.c.y + 3), dir = _cc.subVectors(want, from), d = dir.length(); dir.multiplyScalar(1 / d);
      cam.position.copy(from).addScaledVector(dir, camClear(from, dir, d, 20));
      camSolid(cam.position, 3);
      cam.lookAt(_cd.copy(st.c).setY(st.c.y + 1.5));
      return st.t < 16 ? fitFov(38, cam) : false;
    },
  },
  flyby: {
    label: 'Drone flyby', moving: true, w: v => 2,
    pick(train) {
      const L = train.lead, n = train.vehicles.length;
      return { side: Math.random() < 0.5 ? -1 : 1, a0: L.len / 2 + 45, a1: -Math.min(140, L.len * 2 + n * 8), H0: 22, H1: 9 + Math.random() * 6, lat: 14 };
    },
    run(st, cam, train, dt) {
      const L = train.lead, pos = L.pos, fwd = L.fwd, e = ease(st.t / 11);
      const rx = fwd.z, rz = -fwd.x, rl = Math.hypot(rx, rz) || 1;
      const a = lerp(st.a0, st.a1, e), lat = st.side * st.lat * Math.cos(e * Math.PI * 0.9);
      const want = _cb.copy(pos).addScaledVector(fwd, a); want.x += rx / rl * lat; want.z += rz / rl * lat;
      want.y = Math.max(pos.y + lerp(st.H0, st.H1, e), groundAt(want.x, -want.z) + 6);
      cam.position.copy(want); camSolid(cam.position, 4);
      // look down at the engine, easing toward the train behind it as it sweeps over
      const look = _ca.copy(pos).addScaledVector(fwd, lerp(0, -L.len, e)); look.y += 1.5;
      cam.lookAt(look);
      return st.t < 11 ? fitFov(48, cam) : false;
    },
  },
};
/* nothing but the train's own track within gap of p */
function camOtherClear(p, own, gap) {
  for (const e of NET.edges) {
    if (!e.bb) trackGap(0, 0);
    const X = p.x, N = -p.z, r = gap + 2;
    if (X < e.bb[0] - r || X > e.bb[1] + r || N < e.bb[2] - r || N > e.bb[3] + r) continue;
    for (let i = 0; i < e.n; i++) {
      const d = Math.hypot(e.X[i] - X, e.N[i] - N);
      // a sample on our own line sits about as far from the spot as the spot does from the line
      if (d < gap && Math.hypot(e.X[i] - own.x, e.N[i] + own.z) > d + 1.5) return false;
    }
  }
  return true;
}
/* the side of the train with room for a camera running alongside, or 0 */
function camPaceSide(train, lat) {
  const L = train.lead, rx = L.fwd.z, rz = -L.fwd.x, rl = Math.hypot(rx, rz) || 1;
  const sides = Math.random() < 0.5 ? [1, -1] : [-1, 1];
  for (const s of sides) {
    let ok = true;
    for (const a of [-20, 0, 20, 45, 70]) {
      const p = _ca.copy(L.pos).addScaledVector(L.fwd, a); p.x += rx / rl * s * lat; p.z += rz / rl * s * lat; p.y += 1.5;
      if (!camOtherClear(p, _cb.copy(L.pos).addScaledVector(L.fwd, a), lat - 0.8) || inFoot(p.x, -p.z, 2)) { ok = false; break; }
    }
    if (ok) return s;
  }
  return 0;
}
function paceRun(st, cam, train, dt, fov, dur) {
  const L = train.lead, pos = L.pos, fwd = L.fwd, e = ease(st.t / dur);
  const rx = fwd.z, rz = -fwd.x, rl = Math.hypot(rx, rz) || 1;
  const a = st.a0 + st.drift * st.t, lat = st.side * lerp(st.lat0, st.lat1, e);
  const want = _cb.copy(pos).addScaledVector(fwd, a); want.x += rx / rl * lat; want.z += rz / rl * lat; want.y = pos.y + st.h;
  cam.position.copy(want);
  const moved = camSolid(cam.position, 0.5);
  // three-quarter on: the lens looks back across the engine rather than off into the field ahead of it
  const look = _ca.copy(pos).addScaledVector(fwd, a - (st.aim ? 1.5 : 9)); look.y += st.aim || 2.2;
  cam.lookAt(look);
  // something in the way (a building, a train on the next track): cut away rather than climb over it
  st.check -= dt;
  if (st.check < 0) { st.check = 0.5; if (!camOtherClear(want, _ca.copy(pos).addScaledVector(fwd, a), Math.abs(lat) - 0.8)) return false; }
  return moved < 0.4 && st.t < dur ? fitFov(fov, cam) : false;
}
/* runs the shot list: trackside mode keeps to trackside shots, cinematic picks a varied one each cut */
function shotView(cam, train, dt, pool, varied) {
  let st = CAM.shot;
  const w = n => varied ? SHOTS[n].w(CAM.vs) : 1;
  if (!st && CAM.shotRetry > 0) { CAM.shotRetry -= dt; return orbitView(cam, train, dt, false); }
  for (let tries = 0; !st && tries < 6; tries++) {
    let names = pool.filter(n => w(n) > 0 && !(varied && CAM.recent.includes(n)));
    if (!names.length) names = pool.filter(n => w(n) > 0);
    let r = Math.random() * names.reduce((a, n) => a + w(n), 0), name = names[names.length - 1];
    for (const n of names) { r -= w(n); if (r <= 0) { name = n; break; } }
    const s = SHOTS[name].pick(train);
    CAM.recent = [name, ...CAM.recent].slice(0, 2);
    if (s) { st = CAM.shot = Object.assign(s, { name, t: 0 }); CAM.fovCut = true; CAM.shotN++; }
  }
  // nowhere to stand (a cutting, a crowded yard): ride along until the next try
  if (!st) { CAM.shotRetry = 1.5; return orbitView(cam, train, dt, false); }
  const fov = SHOTS[st.name].run(st, cam, train, dt);
  st.t += dt;
  if (fov === false) { CAM.shot = null; return dt > 0 ? shotView(cam, train, 0, pool, varied) : orbitView(cam, train, 0, false); }
  return fov;
}
CAM.nextShot = function () { CAM.shot = null; };
CAM.riding = () => CAM.mode === 'cine' ? !!(CAM.shot && SHOTS[CAM.shot.name].moving) : CAM.mode !== 'side';

/* ---------------- every view but the cab ---------------- */
function outsideCamera(cam, train, dt) {
  // a fresh start (placing, watching another train, a new train): blend over if it is not far
  if (!CAM.init && CAM.mode !== 'side' && CAM.mode !== 'cine' && !CAM.blend && CAM.ready && cam.position.distanceTo(train.lead.pos) < 200) camBlendFrom(cam, train, 0.9);
  if (!CAM.init) CAM.shot = null;
  let fov;
  if (CAM.mode === 'chase' || CAM.mode === 'drone') fov = orbitView(cam, train, dt, CAM.mode === 'drone');
  else if (CAM.mode === 'rear') fov = rearView(cam, train, dt);
  else if (CAM.mode === 'side') { fov = shotView(cam, train, dt, ['trackside', 'trackside', 'trackside', 'rail'], false); CAM.init = true; }
  else { fov = shotView(cam, train, dt, Object.keys(SHOTS), true); CAM.init = true; }
  CAM.ready = true;
  const B = CAM.blend;
  if (B) {
    B.t += dt; const e = ease(B.t / B.dur);
    _cqb.copy(cam.quaternion);
    cam.position.lerpVectors(_ca.copy(train.lead.pos).add(B.off), cam.position, e);
    cam.quaternion.copy(B.q).slerp(_cqb, e);
    camSolid(cam.position, 0.9);
    fov = lerp(B.fov, fov, e);
    if (B.t >= B.dur) CAM.blend = null;
  }
  const label = CAM.mode === 'cine' && CAM.shot ? 'Cinematic · ' + SHOTS[CAM.shot.name].label : CAM.names[CAM.mode];
  if (label !== CAM.label) { CAM.label = label; const n = $('camName'); if (n) n.textContent = label; }
  return fov;
}
/* start a blend from wherever the camera is now; the start pose rides along with the train */
function camBlendFrom(cam, train, dur) {
  CAM.blend = { off: cam.position.clone().sub(train.lead.pos), q: cam.quaternion.clone(), fov: cam.fov, t: 0, dur };
}

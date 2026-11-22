/* ============================================================================
   Crowds at the stations: travellers (06m_folk.js) wait on the platforms near
   the camera, chatting in twos and threes, sitting on the benches, checking
   their watches and looking down the line. When a passenger train stops they
   let the riders off first, then walk to the nearest vestibule door (across the
   plank walk to a train on the far main, or along the ballast past the end of
   the platform), queue, climb the steps, walk down the aisle and take a seat.
   Riders get up at their stations, step down and go in by the depot's door.
   Every coach keeps who is in its seats (CROWD.C) wherever it is; the people
   in them are drawn only near the camera, a few hundred at most on a PC and a
   few dozen on a phone (CROWD.max), so nothing big is ever held for long.
   ========================================================================== */
const CROWD = {
  on: true, S: new Map(), C: new Map(), T: new Map(), live: new Set(), pool: [], grp: null, t: 0, scanT: 0, rideT: 0, pruneT: 0,
  max: GFX.lite ? 48 : 230, rSt: GFX.lite ? 170 : 380, rRide: GFX.lite ? 42 : 100, shadowR: GFX.lite ? 0 : 50, poseR: GFX.lite ? 35 : 70,
};
const CROWD_V = 1.35;              // m/s: an unhurried walk along the platform
const CROWD_R = 0.26;              // m: how close two of them stand
const _qA = new THREE.Vector3(), _qB = new THREE.Vector3(), _qM = new THREE.Matrix4(), _qQ = new THREE.Quaternion(), _qS = new THREE.Vector3(), _qU = new THREE.Vector3(0, 1, 0);
const crowdRnd = (a, b) => a + Math.random() * (b - a);
const CROWD_XD = (CH.xb + CH.xv) / 2;   // a coach's vestibule doors, either end

/* ---------------- a station's platform ---------------- */
/* base-local (the depot's frame: x along the platform, z out to the track) to world and back */
function crowdW(S, x, z, y, out) { return (out || new THREE.Vector3()).set(x, y === undefined ? S.pl.top : y, z).applyMatrix4(S.pl.base); }
function crowdL(S, w, out) { return (out || new THREE.Vector3()).copy(w).applyMatrix4(S.Bi); }
/* the height of what is underfoot at base-local (x, z): the platform, the door steps, or (off them) the railroad's own floorAt */
function crowdFloor(S, F) {
  const q = crowdL(S, F.p, _qA), pl = S.pl, by = pl.base.elements[13], d = pl.door;
  if (Math.abs(q.x - d.x) < d.w / 2 + 0.2 && q.z < pl.W / 2 + 0.9 && q.z > pl.W / 2 - 1.2) {
    if (q.z < pl.W / 2) return by + pl.floor;
    for (const [z1, top] of d.steps) if (q.z < pl.W / 2 + z1) return by + top;
  }
  if (Math.abs(q.x) <= pl.PL / 2 && q.z >= pl.z0 - 0.05 && q.z <= pl.zE) return by + pl.top;
  return floorAt(F.p.x, F.p.z, F.p.y + 0.3).y;
}
/* a free place to stand and wait, toward the middle of the platform, clear of the benches, lamps and the bay */
function crowdSpot(S, near) {
  const pl = S.pl;
  for (let k = 0; k < 30; k++) {
    const x = near ? near.x + crowdRnd(-1.4, 1.4) : (Math.random() + Math.random() + Math.random() - 1.5) / 1.5 * (pl.PL / 2 - 4);
    const z = near ? near.z + crowdRnd(-1.0, 1.0) : crowdRnd(pl.W / 2 + 1.6, pl.zE - 1.0);
    if (Math.abs(x) > pl.PL / 2 - 1.5 || z < pl.W / 2 + 1.0 || z > pl.zE - 0.9) continue;
    if (pl.obs.some(o => Math.abs(x - o[0]) < o[2] + 0.45 && Math.abs(z - o[1]) < o[3] + 0.45)) continue;
    if (Math.abs(x - pl.door.x) < 1.3 && z < pl.W / 2 + 2.0) continue;
    let ok = true;
    for (const F of S.people) { if (F.mode !== 'world' || !F.q) continue; if (Math.hypot(F.q.x - x, F.q.z - z) < (near ? 0.62 : 0.9)) { ok = false; break; } }
    if (ok) return { x, z };
  }
  return null;
}
/* how many wait at a station now: busier in the morning and evening, few late at night, fewer on a phone */
function crowdWant(S) {
  const h = ((SKY.hour % 24) + 24) % 24;
  const k = h < 5 ? 0.2 : h < 6.5 ? 0.5 : h < 9.5 ? 1.25 : h < 16 ? 1 : h < 19 ? 1.25 : h < 22 ? 0.7 : 0.35;
  const n = (S.pl.big ? 12 : 6) * k * (WORLD.frost ? 0.7 : 1) * (GFX.lite ? 0.45 : 1);
  return Math.max(1, Math.round(n * S.mood));
}
CROWD.activate = function (st) {
  const pl = st.plat, S = { st, pl, Bi: new THREE.Matrix4().copy(pl.base).invert(), people: [], doors: [], spawnT: crowdRnd(4, 10), mood: crowdRnd(0.7, 1.3), y: pl.base.elements[13] + pl.top };
  S.cross = !!(st.line === ROUTE.main && ROUTE.main2 && (!ROUTE.span2 || (st.sLine > ROUTE.span2[0] && st.sLine < ROUTE.span2[1])));
  CROWD.S.set(st, S);
  // the ones already waiting: some in twos and threes, some alone, one or two on the benches
  const want = crowdWant(S); let n = 0;
  const benchSeats = []; for (const bx of pl.benches) for (const e of [-0.45, 0.45]) benchSeats.push(bx + e);
  for (const x of benchSeats) if (n < want && Math.random() < 0.3) { crowdSpawn(S, { bench: x }); n++; }
  while (n < want) {
    const g = Math.random() < 0.4 ? (Math.random() < 0.7 ? 2 : 3) : 1, at = crowdSpot(S); if (!at) break;
    let lead = null;
    for (let i = 0; i < g && n < want; i++) {
      const spot = i === 0 ? at : crowdSpot(S, at); if (!spot) break;
      const kid = lead && Math.random() < 0.45;
      const F = crowdSpawn(S, { spot, group: lead, kid }); if (!lead) lead = F; n++;
    }
  }
  return S;
};
CROWD.deactivate = function (S) {
  for (const F of [...S.people]) {
    if (F.mode === 'car' && F.alight) { crowdReseat(F); F.S = null; continue; }   // on the way off: back to a seat after all
    if (F.mode === 'car') { F.S = null; continue; }          // already aboard: it is the coach's now
    if (F.door && F.after === 'board') crowdSeatAbstract(F);  // on the way to a train: let them have got on
    crowdDrop(F);
  }
  S.people.length = 0;
  CROWD.S.delete(S.st);
};
/* a new traveller on the platform: at a spot (waiting), on a bench, or out of the depot's door (o.fromDoor) */
function crowdSpawn(S, o = {}) {
  const pl = S.pl, spec = o.spec || folkPick(Math.random, { winter: !!WORLD.frost || (typeof SKY !== 'undefined' && SKY.weather === 'snow'), noKids: !o.kid && false });
  if (o.kid) { const kd = folkPick(Math.random, { winter: !!WORLD.frost }); if (!FOLK_KINDS[kd.kind].kid) { const K = Math.random() < 0.5 ? 'boy' : 'girl'; Object.assign(spec, { kind: K, carry: null, scale: lerp(FOLK_KINDS[K].h[0], FOLK_KINDS[K].h[1], Math.random()) }); } }
  if (!o.kid && FOLK_KINDS[spec.kind].kid && !o.group) { spec.kind = Math.random() < 0.5 ? 'suit' : 'wcoat'; spec.scale = lerp(FOLK_KINDS[spec.kind].h[0], FOLK_KINDS[spec.kind].h[1], Math.random()); spec.carry = Math.random() < 0.4 ? 'case' : null; }
  const F = { spec, S, mode: 'world', p: new THREE.Vector3(), l: null, v: null, yaw: 0, ph: Math.random() * TAU, spd: CROWD_V * crowdRnd(0.9, 1.1) * (FOLK_KINDS[spec.kind].kid ? 1.12 : 1), st: 'idle', t: 0, path: [], turn: 0, turnTo: 0, turnT: crowdRnd(1, 5), watch: 0, watchT: crowdRnd(8, 30), poseT: 0, group: o.group || null, q: null, stay: Math.random() < 0.12 };
  if (o.bench !== undefined) {
    F.st = 'bench'; F.q = new THREE.Vector3(o.bench, 0, pl.W / 2 + 0.72); crowdW(S, F.q.x, F.q.z, 0.63, F.p);
    F.yaw = crowdYaw(S, 0); F.benchH = 0.63 - pl.top;
  } else if (o.fromDoor) {
    const d = pl.door; F.q = new THREE.Vector3(d.x, 0, pl.W / 2 - 0.45); crowdW(S, F.q.x, F.q.z, pl.floor, F.p);
    const at = crowdSpot(S) || { x: d.x + 3, z: pl.W / 2 + 2.5 };
    F.st = 'walk'; F.after = 'idle'; F.path = [crowdW(S, d.x, pl.W / 2 + 1.3), crowdW(S, at.x, at.z)]; F.yaw = crowdYaw(S, 0);
  } else {
    F.q = new THREE.Vector3(o.spot.x, 0, o.spot.z); crowdW(S, F.q.x, F.q.z, pl.top, F.p);
    F.yaw = crowdYaw(S, crowdRnd(-0.7, 0.7));
  }
  if (F.group) {
    // a group stands facing each other, talking
    const L = F.group; L.talk = true; F.talk = true;
    F.yaw = Math.atan2(L.p.x - F.p.x, L.p.z - F.p.z);
    if (!L.faced) { L.yaw = Math.atan2(F.p.x - L.p.x, F.p.z - L.p.z); L.faced = true; }
  }
  S.people.push(F);
  crowdShow(F, true);
  return F;
}
/* world yaw facing the track (base +z), turned by a */
function crowdYaw(S, a) { const e = S.pl.base.elements; return Math.atan2(e[8], e[10]) + a; }

/* ---------------- meshes ---------------- */
function crowdShow(F, on) {
  if (on && !F.f) {
    if (CROWD.live.size >= CROWD.max) return false;
    if (!CROWD.grp) { CROWD.grp = new THREE.Group(); CROWD.grp.name = 'crowd'; scene.add(CROWD.grp); }
    const sp = F.spec, carry = F.mode === 'car' && sp.carry === 'case' ? null : sp.carry;
    let f = CROWD.pool.pop();
    if (f) folkDress(f, sp.kind, sp.way, carry); else f = folkMesh(sp.kind, sp.way, carry);
    F.f = f; F.poseT = 0; f.mesh.material = F.mode === 'car' ? FOLK.matIn : FOLK.mat;
    CROWD.grp.add(f.mesh); CROWD.live.add(F);
    crowdPlace(F); crowdPose(F, 0, true);
  } else if (!on && F.f) {
    const f = F.f; F.f = null; CROWD.live.delete(F);
    if (f.mesh.parent) f.mesh.parent.remove(f.mesh);
    if (CROWD.pool.length < 40) CROWD.pool.push(f); else f.mesh.skeleton.dispose();
  }
  return !!F.f;
}
function crowdDrop(F) {
  crowdShow(F, false);
  if (F.S) { const i = F.S.people.indexOf(F); if (i >= 0) F.S.people.splice(i, 1); }
  if (F.door) { const D = F.door; const i = D.q.indexOf(F); if (i >= 0) D.q.splice(i, 1); if (F.alight && !F.outDone) { D.out = Math.max(0, D.out - 1); F.outDone = true; } }
  if (F.v && F.seat !== undefined && F.seat !== null) { const C = CROWD.C.get(F.v); if (C) { if (C.vis.get(F.seat) === F) C.vis.delete(F.seat); C.res.delete(F.seat); } }
  F.dead = true;
}
/* the mesh where the traveller is: in the world, or in the coach's own frame */
function crowdPlace(F) {
  const f = F.f; if (!f) return;
  const m = f.mesh, s = F.spec.scale;
  _qQ.setFromAxisAngle(_qU, F.yaw); _qS.set(s, s, s);
  if (F.mode === 'car') {
    m.visible = crowdSeen(F.v);   // a car hidden far off (11e_traffic) hides its riders with it
    const fr = walkPlan(F.v).frame; fr.updateWorldMatrix(true, false);
    m.matrix.compose(F.l, _qQ, _qS).premultiply(fr.matrixWorld);
  } else { m.matrix.compose(F.p, _qQ, _qS); m.visible = true; }
  m.matrixWorldNeedsUpdate = true;
  const want = F.mode === 'car' ? FOLK.matIn : FOLK.mat; if (m.material !== want) m.material = want;
  m.castShadow = F.mode === 'world' && CROWD.shadowR > 0 && F.p.distanceToSquared(camera.position) < CROWD.shadowR * CROWD.shadowR;
}
function crowdSeen(v) { for (let o = v.model && v.model.root; o; o = o.parent) if (!o.visible) return false; return !!(v.model && v.model.root); }
/* pose for the state. Far away a traveller is posed only now and then. */
const _qQA = FOLK_BONES.map(() => new THREE.Quaternion());
function crowdPose(F, dt, force) {
  const f = F.f; if (!f) return;
  const sc = F.spec.scale, at = F.mode === 'car' ? F.v.pos : F.p;
  const far = at && at.distanceToSquared(camera.position) > CROWD.poseR * CROWD.poseR;
  F.poseT -= dt;
  const moving = F.st === 'walk' || F.st === 'inwalk' || F.st === 'climb' || F.st === 'climbdown' || F.st === 'sitdown' || F.st === 'rise';
  if (!force && F.poseT > 0 && (!moving || far)) return;
  F.poseT = moving ? (far ? 0.12 : 0) : far ? 0.6 : 0.18;
  f.mesh.updateMatrixWorld(true);
  const sitH = F.st === 'bench' ? F.benchH : F.seatH || 0.43;
  switch (F.st) {
    case 'walk': case 'inwalk': folkPose(f, { phase: F.ph, speed: F.held ? 0 : F.spd, t: CROWD.t + F.ph, scale: sc, turn: F.held ? F.turn * 0.6 : 0 }); break;
    case 'climb': case 'climbdown': folkPose(f, { phase: F.ph, speed: 0.95, t: CROWD.t, scale: sc }); break;
    case 'bench': case 'seated': folkPose(f, { sit: sitH, scale: sc, turn: F.turn, look: F.st === 'seated' ? -0.1 : 0 }); break;
    case 'sitdown': case 'rise': {
      const k = F.st === 'sitdown' ? smooth(0, 1, F.t / F.dur) : 1 - smooth(0, 1, F.t / F.dur);
      folkPose(f, { scale: sc, t: CROWD.t });
      const bs = f.mesh.skeleton.bones; bs.forEach((b, i) => _qQA[i].copy(b.quaternion)); const hy = bs[0].position.y;
      folkPose(f, { sit: sitH, scale: sc });
      bs.forEach((b, i) => { _qQT.copy(b.quaternion); b.quaternion.copy(_qQA[i]).slerp(_qQT, k); }); bs[0].position.y = lerp(hy, bs[0].position.y, k);
      break;
    }
    default: folkPose(f, { t: CROWD.t + F.ph * 3, scale: sc, turn: F.turn, watch: F.watch });
  }
}
const _qQT = new THREE.Quaternion();

/* ---------------- moving ---------------- */
/* one step along the path (world points in the world, coach-local ones aboard); true once at its end */
function crowdWalk(F, dt) {
  const P = F.mode === 'car' ? F.l : F.p, tg = F.path[0];
  if (!tg) return true;
  const dx = tg.x - P.x, dz = tg.z - P.z, d = Math.hypot(dx, dz);
  // queued for a door: stop short behind the ones ahead
  let hold = 0;
  if (F.after === 'board' && F.door && F.path.length === 1) {
    const i = F.door.q.indexOf(F);
    if (i < 0 && d < 2.6) F.door.q.push(F);
    const ahead = F.door.q.indexOf(F);
    if (ahead > 0 || F.door.out > 0 || F.door.busy > CROWD.t) hold = 0.62 * Math.max(ahead, F.door.out > 0 || F.door.busy > CROWD.t ? 1 : 0);
  }
  if (F.delay > 0) { F.delay -= dt; F.held = true; return false; }
  if (d <= hold + (F.path.length > 1 ? 0.45 : 0.06)) {
    if (hold > 0) { F.held = true; return false; }
    F.path.shift(); F.held = false;
    return !F.path.length;
  }
  F.held = false;
  const step = Math.min(d - hold, F.spd * (F.mode === 'car' ? 0.75 : 1) * dt);
  P.x += dx / d * step; P.z += dz / d * step;
  F.ph = (F.ph + TAU * step / (1.5 * F.spec.scale)) % (TAU * 1000);
  const want = Math.atan2(dx, dz); let dy = ((want - F.yaw) % TAU + TAU * 1.5) % TAU - Math.PI;
  F.yaw += clamp(dy, -7 * dt, 7 * dt);
  return false;
}
/* keep standing and walking travellers out of each other, the benches and the bay, and you */
function crowdSpace(S, dt) {
  const L = S.people, pl = S.pl;
  for (const F of L) { if (F.mode !== 'world' || F.st === 'bench') continue; F.q = crowdL(S, F.p, F.q || new THREE.Vector3()); }
  for (const F of L) {
    if (F.mode !== 'world' || F.st === 'bench' || !F.q) continue;
    const q = F.q, onPl = Math.abs(q.x) < pl.PL / 2 && q.z > pl.z0 && q.z < pl.zE;
    let mx = 0, mz = 0;
    if (F.st === 'walk' || F.st === 'idle') for (const G of L) {
      if (G === F || G.mode !== 'world' || !G.q) continue;
      const dx = q.x - G.q.x, dz = q.z - G.q.z, d2 = dx * dx + dz * dz, R = 2 * CROWD_R + 0.08;
      if (d2 > R * R || d2 < 1e-8) continue;
      const d = Math.sqrt(d2), k = (R - d) / d * (F.st === 'idle' && G.st === 'walk' ? 0.25 : F.st === 'walk' && G.st === 'walk' ? 0.2 : 0.5);
      mx += dx * k; mz += dz * k;
    }
    if (onPl && F.st !== 'idle') for (const o of pl.obs) {
      const ux = q.x - o[0], uz = q.z - o[1], pu = o[2] + CROWD_R - Math.abs(ux), pw = o[3] + CROWD_R - Math.abs(uz);
      if (pu > 0 && pw > 0) { if (pu < pw) mx += Math.sign(ux || 1) * pu; else mz += Math.sign(uz || 1) * pw; }
    }
    if (WALK.on && WALK.mode === 'foot') {
      const w = crowdL(S, WALK.p, _qB), dx = q.x - w.x, dz = q.z - w.z, d = Math.hypot(dx, dz), R = CROWD_R + 0.3;
      if (d < R && d > 1e-4) { mx += dx / d * (R - d) * 0.6; mz += dz / d * (R - d) * 0.6; }
    }
    if (mx || mz) {
      const m = Math.hypot(mx, mz), lim = 1.2 * dt; if (m > lim) { mx *= lim / m; mz *= lim / m; }
      q.x += mx; q.z += mz;
      if (onPl && F.st === 'idle') q.z = clamp(q.z, pl.W / 2 + 0.35, pl.zE - 0.35);   // walkers may be stepping off to a train
      const y = F.p.y; crowdW(S, q.x, q.z, 0, F.p); F.p.y = y;
    }
  }
}
/* the player on foot can't walk through anyone waiting (called from walkSolid) */
CROWD.push = function (p) {
  for (const S of CROWD.S.values()) {
    if (Math.abs(S.y - p.y) > 2 || S.st.p && (Math.abs(S.st.p.x - p.x) > 200 || Math.abs(S.st.p.z - p.z) > 200)) continue;
    for (const F of S.people) {
      if (F.mode !== 'world') continue;
      const dx = p.x - F.p.x, dz = p.z - F.p.z, d = Math.hypot(dx, dz), R = WALK_R + CROWD_R * F.spec.scale;
      if (d < R && d > 1e-4 && Math.abs(p.y - F.p.y) < 1.5) { p.x = F.p.x + dx / d * R; p.z = F.p.z + dz / d * R; }
    }
  }
};

/* ---------------- the coaches and who sits in them ---------------- */
const crowdCar = v => { const P = walkPlan(v); return P && P.seats && P.seats.length && (P.coach || P.hs) ? P : null; };
const crowdBoardable = v => { const P = walkPlan(v); return !!(P && P.coach); };
CROWD.car = function (v, c) {
  let C = CROWD.C.get(v);
  if (C) return C;
  const P = crowdCar(v); if (!P) return null;
  C = { v, occ: new Array(P.seats.length).fill(null), res: new Set(), vis: new Map() };
  const h = ((SKY.hour % 24) + 24) % 24, late = h < 5.5 || h > 22.5 ? 0.45 : 1;
  const frac = !c ? 0.3 : c.parkS ? 0 : c.ai ? crowdRnd(0.22, 0.6) : c === GAME.train ? crowdRnd(0.15, 0.45) : crowdRnd(0.1, 0.35);
  const n = Math.round(P.seats.length * frac * late);
  for (let i = 0; i < n; i++) { const k = crowdFreeSeat(v, C, P, null); if (k >= 0) C.occ[k] = folkPick(Math.random, { winter: !!WORLD.frost }); }
  CROWD.C.set(v, C);
  return C;
};
/* a free seat in the car: window seats first, near door x (coach-local) if given */
function crowdFreeSeat(v, C, P, x, near) {
  let best = -1, bd = Infinity;
  const mine = WALK.ride && WALK.ride.v === v && WALK.ride.seat;
  for (let i = 0; i < P.seats.length; i++) {
    const q = P.seats[i];
    if (C.occ[i] || C.res.has(i) || q === mine) continue;
    if (typeof WALK !== 'undefined' && WALK.peers.size && WALK.seatTaken(v, q)) continue;
    const win = Math.abs(q.z - P.mid) > (P.hs ? 0.45 : 0.6) ? 0 : 1.8;
    const d = (near ? Math.hypot(q.x - near.x, q.z - near.z) * 3 : x === null ? Math.random() * 30 : Math.abs(q.x - x) + Math.random() * 6) + win;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
/* someone on the way to a train that pulled out of sight of the camera: count them aboard */
function crowdSeatAbstract(F) {
  const v = F.door && F.door.v, C = v && CROWD.car(v), P = v && crowdCar(v); if (!C || !P) return;
  const k = crowdFreeSeat(v, C, P, null); if (k >= 0) C.occ[k] = F.spec;
}
CROWD.seatTaken = function (v, q) {
  const C = CROWD.C.get(v), P = walkPlan(v); if (!C || !P) return false;
  const i = P.seats.indexOf(q); return i >= 0 && (!!C.occ[i] || C.res.has(i));
};
/* the people in the coaches near the camera: drawn (seated, looking about) out to rRide, dropped beyond */
CROWD.ridersFrame = function () {
  const cam = camera.position, cars = [];
  for (const c of camConsists()) for (const v of c.vehicles) {
    if (!v.pos || !crowdCar(v)) continue;
    const d = v.pos.distanceTo(cam), C = CROWD.car(v, c);
    if (C) cars.push([d, v, C]);
  }
  cars.sort((a, b) => a[0] - b[0]);
  for (const [d, v, C] of cars) {
    if (d > CROWD.rRide + 15) { for (const F of [...C.vis.values()]) if (F.st === 'seated') { crowdShow(F, false); C.vis.delete(F.seat); CROWD.riders.delete(F); } continue; }
    if (d > CROWD.rRide || !crowdSeen(v)) continue;
    const P = crowdCar(v);
    for (let i = 0; i < C.occ.length; i++) {
      if (!C.occ[i] || C.vis.has(i)) continue;
      if (CROWD.live.size >= CROWD.max) return;
      const q = P.seats[i], F = { spec: C.occ[i], S: null, mode: 'car', v, p: new THREE.Vector3(), l: new THREE.Vector3(q.x, P.yF, q.z), yaw: q.yaw, ph: 0, spd: CROWD_V, st: 'seated', t: 0, path: [], seat: i, seatH: q.h, turn: crowdRideTurn(P, q), turnT: crowdRnd(3, 12), poseT: 0 };
      C.vis.set(i, F); CROWD.riders.add(F);
      if (!crowdShow(F, true)) { C.vis.delete(i); CROWD.riders.delete(F); return; }
    }
  }
};
CROWD.riders = new Set();
/* a rider's head: mostly out of the window, now and then down the car or across the aisle */
function crowdRideTurn(P, q) { const r = Math.random(), out = -Math.sign((q.z - P.mid) || 1) * Math.sign(Math.sin(q.yaw) || 1); return r < 0.55 ? out * crowdRnd(0.35, 0.8) : r < 0.8 ? crowdRnd(-0.25, 0.25) : -out * crowdRnd(0.2, 0.5); }
/* coaches gone from the world (a train made up again, a swap): forget them and their riders */
CROWD.prune = function () {
  const live = new Set(); for (const c of camConsists()) for (const v of c.vehicles) live.add(v);
  for (const [v, C] of CROWD.C) if (!live.has(v)) { for (const F of C.vis.values()) { crowdShow(F, false); CROWD.riders.delete(F); F.dead = true; } CROWD.C.delete(v); }
  for (const F of [...CROWD.live]) if (F.mode === 'car' && !live.has(F.v)) crowdDrop(F);
  for (const c of [...CROWD.T.keys()]) if (!camConsists().includes(c)) CROWD.T.delete(c);
  for (const v of [...CROWD.doorA.keys()]) if (!live.has(v)) CROWD.doorA.delete(v);
};

/* ---------------- trains calling at the stations ---------------- */
/* the doors of a stopped train that people on this platform can reach, each with the ground point beside it */
function crowdDoors(S, c) {
  const pl = S.pl, out = [];
  // a train standing on the near track blocks the plank walk to the far one
  let nearBlocked = false;
  for (const o of camConsists()) for (const v of o.vehicles) { if (!v.pos) continue; const q = crowdL(S, v.pos, _qA); if (Math.abs(q.z - 12) < 1.2 && Math.abs(q.x) < v.len / 2 + 2.5) nearBlocked = true; }
  for (const v of c.vehicles) {
    if (!v.pos || !crowdBoardable(v)) continue;
    const P = walkPlan(v), qc = crowdL(S, v.pos, _qB);
    if (Math.abs(qc.x) > pl.PL / 2 + 40) continue;
    const near = Math.abs(qc.z - 12) < 1.3, far = S.cross && !near && qc.z > pl.zE + 3 && qc.z < 12 + 2 * (ROUTE.spacing || 4.5) + 1;
    if (!near && !(far && !nearBlocked)) continue;
    for (const [x, s, zi] of P.doors) {
      const e = Math.sign(x), xp = e * (CROWD_XD - 0.05);
      const O = local2world(v, _qA.set(xp, 0, s * (P.hw + 0.35)), new THREE.Vector3()), q = crowdL(S, O, new THREE.Vector3());
      if (q.z > qc.z) continue;                                 // the door on the platform side only
      if (near && Math.abs(q.x) > pl.PL / 2 + 25) continue;      // too far past the platform's end
      if (far && Math.abs(q.x) > pl.PL / 2) continue;
      O.y = floorAt(O.x, O.z, O.y + 1).y;
      out.push({ v, c, x, e, xp, s, zi, P, O, bx: q.x, bz: q.z, far, q: [], out: 0, busy: 0, n: 0 });
    }
  }
  return out;
}
/* platform waypoints (world) from base-local (x, z) to door D: along the edge, past the platform's end or over the planks */
function crowdPathTo(S, x, z, D) {
  const pl = S.pl, lane = pl.zE - 0.45, end = pl.PL / 2 - 0.6, pts = [];
  if (D.far) {
    const xc = (D.bx >= 0 ? 0.9 : -0.9) + crowdRnd(-0.35, 0.35);
    if (z < pl.W / 2 + 1.5) pts.push(crowdW(S, x, pl.W / 2 + 1.6));
    pts.push(crowdW(S, xc, lane), crowdW(S, xc, D.bz), D.O.clone());   // over the planks, then between the tracks
  } else {
    const lx = clamp(D.bx, -end, end);
    if (z < pl.W / 2 + 1.5) pts.push(crowdW(S, x, pl.W / 2 + 1.6));
    pts.push(crowdW(S, lx, lane));
    if (Math.abs(D.bx) > end) pts.push(crowdW(S, Math.sign(D.bx) * (end + 0.3), lane));
    pts.push(D.O.clone());
  }
  return pts;
}
/* from a door's ground point back onto the platform and in at the depot's door */
function crowdPathOut(S, D) {
  const pl = S.pl, lane = pl.zE - 0.45, end = pl.PL / 2 - 0.6, d = pl.door, pts = [];
  if (D.far) { const xc = (D.bx >= 0 ? 0.9 : -0.9) + crowdRnd(-0.35, 0.35); pts.push(crowdW(S, xc, D.bz), crowdW(S, xc, lane)); }
  else if (Math.abs(D.bx) > end) pts.push(crowdW(S, Math.sign(D.bx) * (end + 0.3), lane));
  else pts.push(crowdW(S, D.bx + crowdRnd(-0.4, 0.4), lane - 0.6));
  pts.push(crowdW(S, d.x + crowdRnd(-0.3, 0.3), pl.W / 2 + 1.45), crowdW(S, d.x, pl.W / 2 + 0.95), crowdW(S, d.x, pl.W / 2 - 0.6));
  return pts;
}
/* a train has stood a moment at a station: riders off, then the waiting travellers on */
CROWD.serve = function (c, st) {
  const S = CROWD.S.get(st), Tn = CROWD.T.get(c);
  const coaches = c.vehicles.filter(v => crowdCar(v));
  if (!coaches.length) return;
  if (!S) {
    // out of sight: some get off, a few get on
    for (const v of coaches) {
      const C = CROWD.car(v, c), P = crowdCar(v); if (!C) continue;
      for (let i = 0; i < C.occ.length; i++) if (C.occ[i] && !C.vis.has(i) && Math.random() < 0.25) C.occ[i] = null;
      const add = Math.floor(Math.random() * (st.kind === 'depot' ? 6 : 3));
      for (let k = 0; k < add; k++) { const i = crowdFreeSeat(v, C, P, null); if (i >= 0) C.occ[i] = folkPick(Math.random, { winter: !!WORLD.frost }); }
    }
    return;
  }
  const doors = crowdDoors(S, c);
  Tn.doors = doors; S.doors.push(...doors);
  if (!doors.length) return;
  // getting off: a share of each coach that has a door here
  for (const v of new Set(doors.map(D => D.v))) {
    const C = CROWD.car(v, c), P = walkPlan(v); if (!C) continue;
    const mine = doors.filter(D => D.v === v);
    let n = 0; for (const o of C.occ) if (o) n++;
    const k = Math.min(GFX.lite ? 3 : 7, Math.round(n * crowdRnd(0.12, 0.35)));
    const vis = [...C.vis.values()].filter(F => F.st === 'seated').sort(() => Math.random() - 0.5);
    for (let i = 0; i < k; i++) {
      const F = vis[i];
      if (!F) { const idx = C.occ.findIndex((o, j) => o && !C.vis.has(j)); if (idx >= 0) C.occ[idx] = null; continue; }
      const q = P.seats[F.seat], D = mine.reduce((a, b) => Math.abs(b.x - q.x) < Math.abs(a.x - q.x) ? b : a);
      C.occ[F.seat] = null; C.vis.delete(F.seat); CROWD.riders.delete(F); F.seat = null;
      F.S = S; F.door = D; F.alight = true; F.train = c; D.out++; S.people.push(F);
      F.st = 'rise'; F.t = 0; F.dur = 0.8; F.delay = crowdRnd(0, 2.5); F.aisle = new THREE.Vector3(q.sx !== undefined ? q.sx : q.ax, P.yF, P.mid);
      F.path = [new THREE.Vector3(D.xp, P.yF, P.mid), new THREE.Vector3(D.xp, P.yF, D.s * 0.95)]; F.after = 'climbdown';
      F.seatQ = q;
    }
  }
  // getting on: everyone waiting but a few who are waiting for another train, families together
  const waiting = S.people.filter(F => F.mode === 'world' && (F.st === 'idle' || F.st === 'bench') && !F.stay);
  for (const F of waiting) {
    if (F.group && waiting.includes(F.group) && F.group.door) continue;   // follows the one they came with (below)
    const q = F.q || crowdL(S, F.p, new THREE.Vector3());
    let best = null, bd = Infinity;
    for (const D of doors) { const d = Math.abs(D.bx - q.x) + (D.far ? 8 : 0) + D.n * 2.5 + Math.random() * 6; if (d < bd) { bd = d; best = D; } }
    if (!best || bd > 120) continue;
    crowdGo(S, F, best, crowdRnd(1.0, 4.5));
    for (const G of waiting) if (G.group === F && !G.door) crowdGo(S, G, best, F.delay + crowdRnd(0.4, 1.0), F);
  }
};
function crowdGo(S, F, D, delay, with_) {
  const q = F.q || crowdL(S, F.p, new THREE.Vector3());
  if (F.st === 'bench') { F.st = 'walk'; crowdW(S, q.x, S.pl.W / 2 + 1.15, S.pl.top, F.p); F.q = crowdL(S, F.p, F.q); }
  F.st = 'walk'; F.after = 'board'; F.door = D; F.train = D.c; F.delay = delay; F.with = with_ || null; D.n++;
  F.path = crowdPathTo(S, q.x, q.z, D);
}
/* the train is leaving: whoever is still on the platform side of the door goes back to waiting */
CROWD.depart = function (c) {
  const Tn = CROWD.T.get(c);
  for (const S of CROWD.S.values()) {
    for (const F of [...S.people]) {
      if (F.train !== c) continue;
      if (F.mode === 'world' && F.after === 'board') {
        const D = F.door, i = D.q.indexOf(F); if (i >= 0) D.q.splice(i, 1);
        F.door = null; F.train = null; F.after = 'idle';
        const at = crowdSpot(S); F.path = at ? [crowdW(S, at.x, at.z)] : []; if (!at) F.st = 'idle';
      } else if (F.st === 'climb') { F.t = F.dur; }   // already on the steps: aboard
      else if (F.st === 'climbdown') { F.t = F.dur; }
      else if (F.alight && F.mode === 'car') crowdReseat(F);   // still in the aisle: sit down again
    }
    if (Tn && Tn.doors) S.doors = S.doors.filter(D => !Tn.doors.includes(D));
  }
  for (const v of c.vehicles) { const M = CROWD.doorA.get(v); if (M) for (const id in M) M[id].until = 0; }
  if (Tn) Tn.doors = null;
};
/* someone who meant to get off sits down again (the train left, or the platform went out of sight) */
function crowdReseat(F) {
  const C = CROWD.car(F.v), P = walkPlan(F.v), k = C ? crowdFreeSeat(F.v, C, P, null, F.l) : -1;
  if (F.door && !F.outDone) { F.door.out = Math.max(0, F.door.out - 1); F.outDone = true; }
  F.alight = false; F.door = null; F.train = null; F.delay = 0;
  if (k < 0) { crowdDrop(F); return; }
  if (F.st === 'rise') F.l.copy(F.aisle);
  crowdTakeSeat(F, C, P, k);
}
/* walk to seat k and sit down */
function crowdTakeSeat(F, C, P, k) {
  const q = P.seats[k]; C.res.add(k); F.seat = k; F.seatH = q.h;
  const ax = q.sx !== undefined ? q.sx : q.ax;
  F.aisle = new THREE.Vector3(ax, P.yF, P.mid);
  F.path = [new THREE.Vector3(F.l.x, P.yF, P.mid), F.aisle.clone()]; F.st = 'inwalk'; F.after = 'sitdown';
  if (Math.abs(F.l.z - P.mid) < 0.05) F.path.shift();
}

/* ---------------- the vestibule steps and doors ---------------- */
/* Up the steps into a coach (or down them): from the ground beside the car onto the three treads under the door,
   up through the open trap onto the vestibule floor, and in. Keyframes [x, y, z, seconds to get there], coach-local,
   the soles on each tread's top (06_models.js coachModel: treads at 0.4, 0.72, 1.02 above the rail, 4 cm thick). */
function crowdKeys(D, P, g, down) {
  const xp = D.xp, s = D.s, T = [0.6, 0.42, 0.42, 0.45, 0.4];
  const pts = [[g.x, g.y, g.z], [xp, 0.42, s * 1.4], [xp, 0.74, s * 1.37], [xp, 1.04, s * 1.35], [xp, P.yF, s * 1.17], [xp, P.yF, s * 0.95]];
  if (down) { pts.reverse(); T.reverse(); }
  const K = [{ p: new THREE.Vector3(...pts[0]), t: 0 }]; let t = 0;
  for (let i = 1; i < pts.length; i++) { t += T[i - 1]; K.push({ p: new THREE.Vector3(...pts[i]), t }); }
  K.T = t; return K;
}
function crowdKeyAt(K, t, out, down) {
  let i = 1; while (i < K.length - 1 && K[i].t < t) i++;
  const a = K[i - 1], b = K[i], u = clamp((t - a.t) / Math.max(1e-3, b.t - a.t), 0, 1);
  out.x = lerp(a.p.x, b.p.x, smooth(0, 1, u)); out.z = lerp(a.p.z, b.p.z, smooth(0, 1, u));
  out.y = lerp(a.p.y, b.p.y, b.p.y > a.p.y ? smooth(0, 0.6, u) : smooth(0.4, 1, u));
  return out;
}
/* each door's swing: open while anyone is coming or going by it, shut a few seconds after */
CROWD.doorA = new Map();
function crowdDoorA(v, e, s) { let M = CROWD.doorA.get(v); if (!M) CROWD.doorA.set(v, M = {}); const id = e + ',' + s; return M[id] || (M[id] = { e, s, k: 0, until: 0 }); }
function crowdDoorWant(D, sec) { const A = crowdDoorA(D.v, D.e, D.s); A.until = Math.max(A.until, CROWD.t + sec); }
function crowdDoorsFrame(dt) {
  for (const [v, M] of CROWD.doorA) {
    let any = false;
    for (const id in M) {
      const A = M[id], want = CROWD.t < A.until ? 1 : 0;
      if (A.k !== want) { A.k = want > A.k ? Math.min(1, A.k + dt * 1.25) : Math.max(0, A.k - dt * 0.9); if (v.model) coachDoorSet(v.model.root, A.e, A.s, A.k); }
      if (A.k > 0 || want) any = true;
    }
    if (!any) CROWD.doorA.delete(v);
  }
}

/* ---------------- the states ---------------- */
function crowdStep(F, dt) {
  F.t += dt;
  switch (F.st) {
    case 'idle': {
      // looking about, now and then at a watch; a group keeps talking
      F.turnT -= dt; if (F.turnT <= 0) { F.turnTo = F.talk ? crowdRnd(-0.35, 0.35) : crowdRnd(-1.0, 1.0); F.turnT = crowdRnd(2.5, 8); }
      F.turn += clamp(F.turnTo - F.turn, -1.5 * dt, 1.5 * dt);
      F.watchT -= dt; if (F.watchT <= 0) { F.watchOn = !F.watchOn; F.watchT = F.watchOn ? crowdRnd(1.8, 3) : crowdRnd(15, 45); }
      F.watch = clamp(F.watch + (F.watchOn ? 2.5 : -2.5) * dt, 0, 1);
      break;
    }
    case 'bench': case 'seated': {
      F.turnT -= dt;
      if (F.turnT <= 0) { F.turnT = crowdRnd(4, 14); F.turn = F.st === 'seated' ? crowdRideTurn(walkPlan(F.v), walkPlan(F.v).seats[F.seat]) : crowdRnd(-0.8, 0.8); F.poseT = 0; }
      break;
    }
    case 'walk': case 'inwalk': {
      if (!crowdWalk(F, dt)) break;
      crowdArrive(F);
      break;
    }
    case 'climb': {
      // up the vestibule steps from the platform or the ballast into the car
      crowdKeyAt(F.keys, F.t, F.l, false); F.ph += TAU * dt * 1.1;
      if (F.t >= F.dur) {
        const D = F.door, C = CROWD.car(D.v, D.c), P = walkPlan(D.v);
        const sib = F.with && F.with.v === D.v && F.with.seat !== null && F.with.seat !== undefined ? P.seats[F.with.seat] : null;
        const kk = C ? crowdFreeSeat(D.v, C, P, D.x, sib) : -1;
        F.door = null; F.train = null; F.after = null;
        if (kk < 0) { crowdDrop(F); break; }
        crowdTakeSeat(F, C, P, kk);
      }
      break;
    }
    case 'climbdown': {
      crowdKeyAt(F.keys, F.t, F.l, true); F.ph += TAU * dt * 1.1;
      if (F.t >= F.dur) {
        const D = F.door; D.out = Math.max(0, D.out - 1); F.outDone = true;
        local2world(F.v, F.l, F.p); F.yaw = yawToWorld(F.v, F.yaw); F.mode = 'world'; F.v = null; F.l = null;
        F.st = 'walk'; F.after = 'exit'; F.path = crowdPathOut(F.S, D); F.train = null;
        if (F.spec.carry === 'case' && F.f) folkDress(F.f, F.spec.kind, F.spec.way, 'case');
      }
      break;
    }
    case 'sitdown': case 'rise': {
      const k = Math.min(1, F.t / F.dur), P = walkPlan(F.v), q = F.seatQ;
      if (F.st === 'sitdown') { F.l.lerpVectors(F.aisle, _qA.set(q.x, P.yF, q.z), smooth(0, 1, k)); F.yaw = lerpAngle(F.yaw0, q.yaw, smooth(0, 0.7, k)); }
      else { F.l.lerpVectors(_qA.set(q.x, P.yF, q.z), F.aisle, smooth(0.3, 1, k)); }
      if (F.delay > 0 && F.st === 'rise') { F.delay -= dt; F.t = 0; break; }
      if (k >= 1) {
        if (F.st === 'sitdown') {
          const C = CROWD.car(F.v); if (!C) { crowdDrop(F); break; }
          C.res.delete(F.seat); C.occ[F.seat] = F.spec; C.vis.set(F.seat, F); CROWD.riders.add(F);
          const i = F.S ? F.S.people.indexOf(F) : -1; if (i >= 0) F.S.people.splice(i, 1);
          F.S = null; F.st = 'seated'; F.turn = crowdRideTurn(P, q); F.turnT = crowdRnd(4, 12); F.poseT = 0;
        } else { F.st = 'inwalk'; F.t = 0; }
      }
      break;
    }
  }
}
const lerpAngle = (a, b, k) => a + (((b - a) % TAU + TAU * 1.5) % TAU - Math.PI) * k;
/* the end of a walk */
function crowdArrive(F) {
  const S = F.S;
  switch (F.after) {
    case 'idle': F.st = 'idle'; F.after = null; if (S) F.yaw = crowdYaw(S, crowdRnd(-0.6, 0.6)); break;
    case 'board': {
      const D = F.door;
      crowdDoorWant(D, 3);
      if (D.q[0] !== F || D.out > 0 || D.busy > CROWD.t || crowdDoorA(D.v, D.e, D.s).k < 0.97) { F.path = [D.O.clone()]; F.held = true; break; }
      D.q.shift();
      const P = walkPlan(D.v);
      F.mode = 'car'; F.v = D.v; F.l = world2local(D.v, F.p, new THREE.Vector3());
      F.keys = crowdKeys(D, P, F.l, false); F.dur = F.keys.T; D.busy = CROWD.t + F.dur * 0.62;
      F.yaw = D.s > 0 ? Math.PI : 0; F.st = 'climb'; F.t = 0;
      if (F.f) { F.f.mesh.material = FOLK.matIn; if (F.spec.carry === 'case') folkDress(F.f, F.spec.kind, F.spec.way, null); }
      break;
    }
    case 'climbdown': {
      const D = F.door, P = walkPlan(F.v);
      crowdDoorWant(D, 3);
      if (D.busy > CROWD.t || crowdDoorA(D.v, D.e, D.s).k < 0.97) { F.path = [F.l.clone()]; break; }
      F.keys = crowdKeys(D, P, world2local(F.v, D.O, new THREE.Vector3()), true); F.dur = F.keys.T; D.busy = CROWD.t + F.dur * 0.8;
      F.yaw = D.s > 0 ? 0 : Math.PI; F.st = 'climbdown'; F.t = 0;
      break;
    }
    case 'sitdown': {
      const P = walkPlan(F.v); F.seatQ = P.seats[F.seat]; F.yaw0 = F.yaw; F.st = 'sitdown'; F.t = 0; F.dur = 0.9;
      break;
    }
    case 'exit': crowdDrop(F); break;
    default: F.st = 'idle';
  }
}

/* ---------------- each frame ---------------- */
CROWD.frame = function (dt) {
  if (!CROWD.on || typeof camera === 'undefined' || !ROUTE.stations) return;
  if (S && S.paused) dt = 0;
  CROWD.t += dt;
  FOLK.inK.value = typeof SAL !== 'undefined' ? SAL.I.value * 0.32 : 0.15;
  // which stations are near enough to people
  CROWD.scanT -= dt;
  if (CROWD.scanT <= 0) {
    CROWD.scanT = 0.5;
    const cam = camera.position;
    for (const st of ROUTE.stations) {
      if (!st.plat || !st.p) continue;
      const d = Math.hypot(st.p.x - cam.x, st.p.z - cam.z), A = CROWD.S.get(st);
      if (!A && d < CROWD.rSt) CROWD.activate(st);
      else if (A && d > CROWD.rSt + 60) CROWD.deactivate(A);
    }
  }
  // trains standing at a station
  for (const c of camConsists()) {
    let Tn = CROWD.T.get(c); if (!Tn) CROWD.T.set(c, Tn = { stopT: 0, served: null, hold: 0, doors: null });
    if (!c.vehicles.some(v => crowdCar(v))) continue;
    const sp = Math.abs(walkSpeedOf(c));
    if (sp < 0.05) Tn.stopT += dt; else if (sp > 0.25) { if (Tn.served) CROWD.depart(c); Tn.stopT = 0; Tn.served = null; Tn.hold = 0; }
    if (Tn.stopT > 1.5 && Tn.served === null && !c.parkS) {
      Tn.served = false;
      let best = null, bd = 300;
      for (const st of ROUTE.stations) { if (!st.plat || !st.p || !c.lead.pos) continue; for (const v of c.vehicles) { if (!v.pos) continue; const d = v.pos.distanceTo(st.p); if (d < bd) { bd = d; best = st; } } }
      if (best && bd < 160) { Tn.served = best; CROWD.serve(c, best); }
    }
    // a timetable train waits for its passengers (a minute more at most)
    if (c.ai && c.ai.dwell > 0 && c.ai.dwell < 3 && Tn.served && Tn.hold < 60) {
      let busy = false;
      for (const F of CROWD.live) if (F.train === c && (F.st !== 'walk' || F.mode === 'car' || F.door && F.door.O.distanceTo(F.p) < 40)) { busy = true; break; }
      if (!busy) for (const S of CROWD.S.values()) for (const F of S.people) if (F.train === c) { busy = true; break; }
      if (busy) { Tn.hold += dt; c.ai.dwell = 3; }
    }
  }
  // the people on the platforms
  for (const S of CROWD.S.values()) {
    S.spawnT -= dt;
    if (S.spawnT <= 0) {
      S.spawnT = crowdRnd(8, 26);
      const waiting = S.people.filter(F => F.mode === 'world' && F.after !== 'exit' && F.after !== 'board').length;
      if (waiting < crowdWant(S) && !(S.doors && S.doors.length)) crowdSpawn(S, { fromDoor: true });
    }
    for (const F of [...S.people]) if (!F.dead && !(F.mode === 'car' && CROWD.riders.has(F))) {
      crowdStep(F, dt);
      if (!F.dead && F.mode === 'world' && F.st === 'walk') { const y = crowdFloor(S, F); F.p.y += clamp(y - F.p.y, -7 * dt, 3 * dt) || 0; if (Math.abs(y - F.p.y) > 0.6) F.p.y = y; }
    }
    crowdSpace(S, dt);
    for (const F of S.people) if (F.door && (F.alight || F.st === 'climb' || (F.mode === 'world' && F.p.distanceTo(F.door.O) < 9))) crowdDoorWant(F.door, 2.5);
  }
  crowdDoorsFrame(dt);
  // the riders
  for (const F of CROWD.riders) crowdStep(F, dt);
  // aboard but no longer at a platform the camera can see (the station went out of range): carry on to the seat
  for (const F of [...CROWD.live]) if (!F.dead && F.mode === 'car' && !F.S && !CROWD.riders.has(F)) crowdStep(F, dt);
  CROWD.rideT -= dt; if (CROWD.rideT <= 0) { CROWD.rideT = 0.5; CROWD.ridersFrame(); }
  CROWD.pruneT -= dt; if (CROWD.pruneT <= 0) { CROWD.pruneT = 2; CROWD.prune(); }
  for (const F of CROWD.live) { crowdPlace(F); crowdPose(F, dt); }
};
/* drop everyone (a new world) */
CROWD.reset = function () {
  for (const S of [...CROWD.S.values()]) CROWD.deactivate(S);
  for (const F of [...CROWD.live]) crowdDrop(F);
  CROWD.C.clear(); CROWD.T.clear(); CROWD.riders.clear();
};
/* how many of each, for the tests and the console */
CROWD.count = function () {
  let wait = 0, walk = 0, seated = 0, occ = 0;
  for (const S of CROWD.S.values()) for (const F of S.people) { if (F.mode === 'world' && (F.st === 'idle' || F.st === 'bench')) wait++; else walk++; }
  for (const C of CROWD.C.values()) for (const o of C.occ) if (o) occ++;
  for (const F of CROWD.riders) if (F.st === 'seated') seated++;
  return { stations: CROWD.S.size, wait, walk, seated, occ, drawn: CROWD.live.size };
};

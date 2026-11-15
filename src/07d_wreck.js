/* ============================================================================
   Wreck physics. When a train comes off the rails its cars stop following the track one by one and
   become rigid bodies: a box the size of the car body with the car's own weight, carrying the speed it
   had. They fall, slide and dig into the ground and the ballast, roll over, slam into each other, and
   pull or shove the cars still coupled to them until a coupler lets go. The cars still on the rails
   run on into the pile (their brakes go into emergency when the train line parts) and come off in turn
   when the car ahead drags them off the rails or they hit it hard.

   Contacts are points over each box (ground, ballast and other cars) solved as impulses with Coulomb
   friction, stepped at 240 Hz: nothing is pushed apart faster than it came together, so no car is ever
   flung. Couplers are ball joints that break above about 2.5 MN or when the cars fold too far.
   ========================================================================== */
const WK = {
  H: 1 / 240, G: 9.81, MAXB: 40, ITER: 8,
  MU: 0.5, E_G: 0.08, TRIP: 0.6,   // + friction for a car going sideways, which digs its edge in         // steel dragged over ballast and dirt; a car dropped on the ground barely bounces
  MU_C: 0.35, E_C: 0.1,       // steel on steel, car against car
  SLOP: 0.03, BETA: 0.2, BIAS_V: 1.2,   // overlap left alone, and how gently what is already inside is pushed out (m/s at most)
  WAKE: 1.0,                  // a car at rest is woken by anything hitting it faster than this (m/s)
  HEAD: 0.6,                  // coupler face to body end, m
  SWING: 0.3,                 // m the knuckle can move sideways as the coupler swings in its striker
  CPL_K: 4e7, CPL_C: 1.5e6, CPL_BREAK: 2.5e6, CPL_Y: 0.88,   // knuckle and draft gear: N/m, N s/m; tension that breaks it
  CPL_FOLD: Math.cos(70 * Math.PI / 180),   // folded further than this, the knuckle or the shank tears off
  LV: 0.55, LIFT: 0.35,       // coupler pull sideways (L/V) or up, over the car's weight, that takes a car on the rails off them
  SPIN: 5,                    // rad/s, the most a wrecked car tumbles
  SPARK_V: 2.5,               // m/s of steel sliding on steel or ballast that strikes sparks
  DENT_V: 3, DENT_G: 6,       // closing speed (m/s) that dents a car body hitting another car, or the ground
  TRUCK_V: 5, TRUCK_G: 4, TRUCK_TIP: 0.8,   // a hit, a slam down onto the ground, or a tilt (cos) that knocks the trucks out from under
  NSPK: 10, NDENT: 6, DENT_MAX: 0.4, FRAME_Y: 0.85,   // sparks kept per frame, dents per car, deepest dent (m), underframe over the rail (m)
  RAM: 2.5,                   // closing speed (m/s) at which a car on the rails ramming the pile comes off
  EMERG: 1.3, EMERG_F: 0.75,  // brakes in emergency on the cars still on the rails, m/s²: a passenger train, a freight
};
const _wa = new THREE.Vector3(), _wb = new THREE.Vector3(), _wc = new THREE.Vector3(), _wd = new THREE.Vector3(), _we = new THREE.Vector3(), _wf = new THREE.Vector3();
const _wq = new THREE.Quaternion(), _wqi = new THREE.Quaternion(), _wM = new THREE.Matrix4(), _wN = new THREE.Matrix4();

/* the box of a car body in its own coordinates, leaving out lamp beams and glows */
function bodyBox(v) {
  v.root.updateMatrixWorld(true);
  _wN.copy(v.root.matrix).invert();
  const box = new THREE.Box3(), b = new THREE.Box3();
  v.root.traverse(o => {
    if (!o.geometry || o.isInstancedMesh || !o.visible || (o.material && o.material.transparent)) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    box.union(b.copy(o.geometry.boundingBox).applyMatrix4(_wM.multiplyMatrices(_wN, o.matrixWorld)));
  });
  if (box.isEmpty() || box.max.x - box.min.x < 2) box.set(new THREE.Vector3(-v.len / 2, 0.8, -1.55), new THREE.Vector3(v.len / 2, 4.3, 1.55));
  // the trucks ride under the body: count them in, down to the rail
  box.min.y = Math.min(box.min.y, 0.05);
  // the couplers stick out past the body ends to meet the next car's: leave them out, the body ends ~0.6 m short of the faces
  if (v._cf && v._cr) {
    const a = Math.min(v._cf.x, v._cr.x) + WK.HEAD, b = Math.max(v._cf.x, v._cr.x) - WK.HEAD;
    if (b - a > 2) { box.min.x = Math.max(box.min.x, a); box.max.x = Math.min(box.max.x, b); }
  }
  return box;
}

class WreckSim {
  /* spec = { a: metres back from the front coupler, side: ±1, seed, k: 0..1, v0: m/s, hit } */
  constructor(T, spec) {
    this.T = T; this.spec = spec; this.r = rng(spec.seed || 1);
    this.bodies = []; this.t = 0; this.still = 0; this.asleep = false; this.acc = 0;
    this.kin = { v: spec.vs || 0, mass: 0, force: 0 };
    this.broken = new Set();   // coupler i joins vehicle i (rear) and i + 1 (front)
    // a freight train's brakes, braked light for its loaded weight, stop it at little over half a passenger train's rate
    this.emerg = T.vehicles.every(v => v.kind === 'coach' || v.kind === 'loco' || v.kind === 'loco2' || v.kind === 'tender' || v.emu) ? WK.EMERG : WK.EMERG_F;
    WreckSim.couplers(T);
    // the car at the point of impact comes off first
    let first = 0, best = Infinity;
    T.vehicles.forEach((v, i) => { const d = Math.abs(v.a0 + v.len / 2 - spec.a); if (d < best) { best = d; first = i; } });
    const k = spec.k, side = spec.side, r = this.r;
    const b = this.derail(first, spec.hit ? 0.15 : 1);
    if (b) {
      // thrown toward the outside, rolling that way
      b.lv.addScaledVector(b.ax[2], side * (0.6 + 3.2 * k * (0.6 + 0.4 * r())));
      b.lv.y += 0.3 + 0.8 * k;
      b.av.addScaledVector(b.ax[0], side * (0.3 + 1.6 * k * r()));
      b.av.y += (r() - 0.5) * 0.6 * k;
    }
  }
  /* a vehicle's weight in kg: the engine's own tender carries the water and coal left in it */
  massOf(v) {
    if (v.rb) return v.rb.m;
    if (v.kind === 'tender' && !v.helper && this.T.tenderEmpty && typeof S !== 'undefined') return this.T.tenderEmpty + (S.water || 0) + (S.coal || 0);
    return v.mass > 0 ? v.mass : 40000;
  }
  /* which way along the car's own x axis the front of the train is */
  static sF(v) { return v._sF || (v.flip ? -1 : 1); }
  /* both couplers of every car in its own coordinates, found from the track while it is still on it */
  static couplers(T) {
    const F = newFrame(), inv = new THREE.Matrix4();
    for (const v of T.vehicles) {
      const q = v.ptsAll[0]; if (!q || !q.tp) continue;
      inv.copy(v.root.matrix).invert();
      const at = d => { const tp = q.tp.clone(); tp.advance(d, null); tp.pose(F); return F.p.clone().addScaledVector(F.u, WK.CPL_Y).applyMatrix4(inv); };
      v._cf = at(q.a - v.a0); v._cr = at(-(v.a0 + v.len - q.a));
      v._sF = Math.sign(v._cf.x - v._cr.x) || 1;
    }
    // coupled knuckles meet at one point: put each pair exactly together (where the track puts them a few cm apart or
    // overlapping, that gap would be a coupler already stretched or crushed, and it would fling the cars apart)
    const V = T.vehicles, PA = new THREE.Vector3(), PB = new THREE.Vector3();
    for (let i = 0; i < V.length - 1; i++) {
      const A = V[i], B = V[i + 1]; if (!A._cr || !B._cf) continue;
      PA.copy(A._cr).applyMatrix4(A.root.matrix); PB.copy(B._cf).applyMatrix4(B.root.matrix);
      if (PA.distanceTo(PB) > 1.5) continue;   // not really coupled
      PA.add(PB).multiplyScalar(0.5);
      A._cr.copy(PA).applyMatrix4(inv.copy(A.root.matrix).invert());
      B._cf.copy(PA).applyMatrix4(inv.copy(B.root.matrix).invert());
    }
  }
  /* take vehicle i off the rails: a rigid body with the speed the train had (times keep) */
  derail(i, keep = 1) {
    const v = this.T.vehicles[i]; if (!v || v.rb || this.bodies.length - (this.nTruck || 0) >= WK.MAXB) return null;
    // part way through a step the train has run on kx metres from where it is drawn: it comes off from there
    const kx = this.kx || 0, sh = new THREE.Matrix4();
    if (kx) { sh.makeTranslation(...new THREE.Vector3().setFromMatrixColumn(v.root.matrix, 0).normalize().multiplyScalar(WreckSim.sF(v) * kx).toArray()); v.root.matrix.premultiply(sh); }
    const M = v.root.matrix.clone(), box = bodyBox(v);
    const c = box.getCenter(new THREE.Vector3()), h = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    const m = Math.max(8000, this.massOf(v));
    const p = c.clone().applyMatrix4(M), q = new THREE.Quaternion().setFromRotationMatrix(M);
    const ax = [0, 1, 2].map(j => new THREE.Vector3().setFromMatrixColumn(M, j).normalize());
    const sF = WreckSim.sF(v), sp = this.kinV() * keep;
    const b = {
      v, i, m, c, h, p, q, ax, M0: M,
      lv: ax[0].clone().multiplyScalar(sF * sp), av: new THREE.Vector3(), pv: new THREE.Vector3(), pw: new THREE.Vector3(),
      I: new THREE.Vector3(m / 3 * (h.y * h.y + h.z * h.z), m / 3 * (h.x * h.x + h.z * h.z), m / 3 * (h.x * h.x + h.y * h.y)),
      // sample points over the box, from its centre
      pts: [], bed: { o: _wa.set(0, 0, 0).applyMatrix4(M).clone(), r: ax[2].clone(), f: ax[0].clone(), len: v.len },
      W: new THREE.Matrix4(), D: new THREE.Matrix4(), F: new THREE.Vector3(), tq: new THREE.Vector3(),
    };
    // sample points over the box, closer along a long car so another can't slip in between them
    const xs = h.x > 6 ? [-1, -0.5, 0, 0.5, 1] : [-1, 0, 1];
    for (const x of xs) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) if (x || y || z) b.pts.push(new THREE.Vector3(x * h.x, y * h.y, z * h.z));
    // where the trucks were when it came off, so they stay with it
    b.t0 = v.tp.map(t => { const m4 = frameMatrix(t.F, new THREE.Matrix4()); if (v.flip) m4.multiply(new THREE.Matrix4().makeRotationY(Math.PI)); return m4; });
    // each engine's own model: a helper MU'd in behind can be a different kind of engine
    const U = v.helper ? v.model : (v.kind === 'loco' ? this.T.loco : null) || v.model;
    if ((v.kind === 'loco' || v.kind === 'loco2') && U && U.trucks && U.wheels) b.u0 = U.trucks.map(tg => tg.matrix.clone());
    else if (v.kind === 'loco' && U && U.leadTruck) b.l0 = U.leadTruck.matrix.clone();
    if (v.kind === 'loco' && U && U.front) b.f0 = U.front.matrix.clone();
    if (v.model && v.model.truck) b.s0 = v.model.truck.matrix.clone();
    if (kx) for (const m4 of [...b.t0, ...(b.u0 || []), b.l0, b.f0, b.s0]) if (m4) m4.premultiply(sh);
    // its own trucks (the instanced ones under freight cars, coaches and tenders): with it until knocked out from under
    b.tk = v.trucks && v.trucks.length ? v.trucks.map(() => null) : null;
    b.dents = [];
    v.rb = b; this.bodies.push(b);
    this.pose(b);
    if (typeof sndClunk === 'function' && AU.on) sndClunk(clamp(Math.abs(sp) / 8, 0.4, 1.5), 0);
    return b;
  }
  /* steel scraping at P with velocity v (speed sp along the surface): the fastest few this frame strike sparks */
  spark(P, v, sp, b) {
    const L = this.spk || (this.spk = []);
    let i = this.nSpk;
    if (i >= WK.NSPK) { i = 0; for (let k = 1; k < WK.NSPK; k++) if (L[k].sp < L[i].sp) i = k; if (L[i].sp >= sp) return; }
    else this.nSpk++;
    const o = L[i] || (L[i] = { P: new THREE.Vector3(), v: new THREE.Vector3(), sp: 0 });
    o.P.copy(P); o.v.copy(v); o.sp = sp; o.b = b;
  }
  /* a dent in car body b at world point P, pushed in along n, from a hit at closing speed vn (the effects file presses it) */
  dent(b, P, n, vn) {
    if (!b || !b.v || !b.dents) return;
    const p = _wkch.subVectors(P, b.p).applyQuaternion(_wq.copy(b.q).invert()).add(b.c);   // into the car's own coordinates
    const d = Math.min(WK.DENT_MAX, 0.035 * (vn - WK.DENT_V * 0.5));
    if (d < 0.03) return;
    for (const o of b.dents) if (o.p.distanceToSquared(p) < 1.2) { if (d > o.d + 0.02) { o.d = d; o.done = false; } return; }
    if (b.dents.length >= WK.NDENT) return;
    b.dents.push({ p: p.clone(), n: n.clone().applyQuaternion(_wq), d, done: false });
  }
  /* the trucks sit on the body's centre plates on nothing but their weight and a pin: knocked hard, or the body tipped
     over, they come out from under and go their own way */
  loseTrucks(b) {
    if (!b.tk || !b.v) return;
    const v = b.v;
    for (let k = 0; k < b.tk.length; k++) {
      if (b.tk[k]) continue;
      const t = v.trucks[k], six = t.type === 'six' || t.type === 'buck';
      const Mt = new THREE.Matrix4().multiplyMatrices(b.D, b.t0[k]);
      const h = new THREE.Vector3(six ? 2.5 : 1.45, 0.5, 1.35), c = new THREE.Vector3(0, 0.5, 0), m = six ? 9500 : 4800;
      const p = c.clone().applyMatrix4(Mt), q = new THREE.Quaternion().setFromRotationMatrix(Mt);
      const r = _wkch.subVectors(p, b.p);
      const tb = {
        truck: true, m, h, c, p, q, ax: [0, 1, 2].map(j => new THREE.Vector3().setFromMatrixColumn(Mt, j).normalize()), M0: new THREE.Matrix4(),
        lv: b.av.clone().cross(r).add(b.lv), av: b.av.clone().multiplyScalar(0.5).add(new THREE.Vector3((this.r() - 0.5) * 2, (this.r() - 0.5) * 2, (this.r() - 0.5) * 2)),
        pv: new THREE.Vector3(), pw: new THREE.Vector3(),
        I: new THREE.Vector3(m / 3 * (h.y * h.y + h.z * h.z), m / 3 * (h.x * h.x + h.z * h.z), m / 3 * (h.x * h.x + h.y * h.y)),
        pts: [], bed: b.bed, W: new THREE.Matrix4(), D: new THREE.Matrix4(),
      };
      for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) tb.pts.push(new THREE.Vector3(x * h.x, y * h.y, z * h.z));
      tb.pts.push(new THREE.Vector3(0, -h.y, 0));
      b.tk[k] = tb; this.bodies.push(tb); this.nTruck = (this.nTruck || 0) + 1;
      this.pose(tb);
    }
    // the body comes down on its underframe, the height of the trucks lower than its box went
    for (const s of b.pts) if (s.y < 0) s.y = Math.max(s.y, -b.h.y + WK.FRAME_Y);
    b.tkGone = true;
  }
  /* speed of the cars still on the rails, along the train */
  kinV() { return this.kin ? this.kin.v : 0; }
  /* root and truck matrices of a body for drawing */
  pose(b) {
    b.W.compose(b.p, b.q, _wf.set(1, 1, 1)).multiply(_wM.makeTranslation(-b.c.x, -b.c.y, -b.c.z));
    b.D.copy(b.W).multiply(_wN.copy(b.M0).invert());
    for (let j = 0; j < 3; j++) b.ax[j].setFromMatrixColumn(b.W, j).normalize();
  }
  /* world point and velocity of a car-local point (in the root's coordinates) on vehicle v */
  pointOf(v, local, outP, outV) {
    if (v.rb) {
      const b = v.rb; outP.copy(local).sub(b.c).applyQuaternion(b.q);
      outV.copy(b.av).cross(outP).add(b.lv); outP.add(b.p);
    } else {
      // on the rails: where the frame began, plus how far the train has run on since (this.kx)
      outV.setFromMatrixColumn(v.root.matrix, 0).normalize().multiplyScalar(WreckSim.sF(v));
      outP.copy(local).applyMatrix4(v.root.matrix).addScaledVector(outV, this.kx || 0);
      outV.multiplyScalar(this.kinV());
    }
  }
  /* height of whatever a point is resting on: the ground, or the roadbed the car came off */
  ground(b, P) {
    this.onBed = false;
    let g = groundAt(P.x, -P.z);
    if (WORLD.mtn && P.y < g) { const t = mtInBore(P.x, P.z, 0.5); if (t) g = t.rail - 0.3; }   // in a tunnel: the bore's floor, not the hill over it
    const B = b.bed; _we.subVectors(P, B.o);
    if (Math.abs(_we.dot(B.f)) < B.len * 1.5) {
      const lat = Math.abs(_we.dot(B.r));
      const bed = lat < 1.8 ? -0.2 : -0.2 - (lat - 1.8) * 0.66;
      if (bed > -0.95 && B.o.y + bed >= g) { this.onBed = true; return B.o.y + bed; }
    }
    this.onBed = false;
    return g;
  }
  /* world inverse inertia times x, from the body's own axes */
  static iInv(b, x, out) {
    out.set(0, 0, 0);
    for (let j = 0; j < 3; j++) out.addScaledVector(b.ax[j], x.dot(b.ax[j]) / b.I.getComponent(j));
    return out;
  }
  /* 1 / effective mass of a body at offset r along unit direction n (0 for a body that is asleep or absent) */
  static kOf(b, r, n) {
    if (!b || b.sleep) return 0;
    const rn = _wd.crossVectors(r, n);
    return 1 / b.m + WreckSim.iInv(b, rn, _we).cross(r).dot(n);
  }
  static push(b, r, j, pseudo) {
    if (!b || b.sleep) return;
    (pseudo ? b.pv : b.lv).addScaledVector(j, 1 / b.m);
    (pseudo ? b.pw : b.av).add(WreckSim.iInv(b, _wd.crossVectors(r, j), _we));
  }
  /* velocity of contact c's point on its first body minus on the other (a car on the rails runs along its track) */
  relV(c, out) {
    const A = c.A; out.copy(A.av).cross(c.rA).add(A.lv);
    if (c.B) { if (!c.B.sleep) out.sub(_wc.copy(c.B.av).cross(c.rB).add(c.B.lv)); }
    else if (c.kv) out.addScaledVector(c.dk, -this.kin.v);
    return out;
  }
  /* a contact from the pool: point P on body A, normal n pushing A out of what it hit (B, a car on the rails kv, or the ground) */
  contact(A, B, kv, P, n, pen, mu, e) {
    const C = this.C, c = C[this.nc] || (C[this.nc] = { P: new THREE.Vector3(), n: new THREE.Vector3(), rA: new THREE.Vector3(), rB: new THREE.Vector3(), dk: new THREE.Vector3(), jt: new THREE.Vector3(), v0: new THREE.Vector3() });
    this.nc++;
    c.A = A; c.B = B; c.kv = kv; c.bed = false; c.P.copy(P); c.n.copy(n); c.pen = pen; c.mu = mu; c.e = e; c.jn = 0; c.jt.set(0, 0, 0);
    c.rA.subVectors(P, A.p); if (B) c.rB.subVectors(P, B.p);
    if (kv) c.dk.setFromMatrixColumn(kv.root.matrix, 0).normalize().multiplyScalar(WreckSim.sF(kv));
    // something hitting a car at rest wakes it
    this.relV(c, c.v0);
    if (B && B.sleep && c.v0.dot(n) < -WK.WAKE) { B.sleep = false; B.restT = 0; }
    return c;
  }
  /* an impulse j on contact c: + on A, - on what it hit */
  applyC(c, j) {
    j = _wkcj.copy(j);
    WreckSim.push(c.A, c.rA, j);
    if (c.B) WreckSim.push(c.B, c.rB, _wf.copy(j).negate());
    else if (c.kv && this.kin.mass > 0) this.kin.v -= j.dot(c.dk) / this.kin.mass;
  }
  /* kin: the part of the train still on the rails = { v: m/s along the train, mass: kg, x0: m it is drawn ahead of where
     this step starts (a remote train already moved); out: dx, how far it ran during the step } */
  step(dt, kin) {
    this.kin = kin; kin.dx = 0;
    if (this.asleep) return;
    // the cars on the rails are drawn where they were when this frame began (or kin.x0 metres on); kx is how far they have run since
    this.kx = kin.x0 || 0;
    const T = this.T, V = T.vehicles;
    if (!this.C) this.C = [];
    for (const b of this.bodies) b.dgS = 0;   // hardest dig-in this frame, for the dirt and gouges (10h_dig.js)
    this.nSpk = 0;   // steel scraping on steel or stone this frame, for the sparks and the screech (10l_wreckfx.js)
    this.acc = Math.min(this.acc + dt, 0.06);
    while (this.acc >= WK.H) {
      this.acc -= WK.H; this.t += WK.H;
      const h = WK.H;
      for (const b of this.bodies) if (!b.sleep) b.lv.y -= WK.G * h;
      // gather what is touching what
      this.nc = 0; this.off = null;
      for (const b of this.bodies) {
        if (b.sleep) continue;
        for (const s of b.pts) {
          const P = _wa.copy(s).applyQuaternion(b.q).add(b.p);
          const pen = this.ground(b, P) - P.y; if (pen <= 0) continue;
          // a car skidding sideways digs its edge in (into dirt most of all) and trips: friction grows with how sideways it goes
          const c = this.contact(b, null, null, P, _wb.set(0, 1, 0), pen, WK.MU, WK.E_G); c.bed = this.onBed;
          const vh = Math.hypot(c.v0.x, c.v0.z);
          if (vh > 0.3) c.mu = WK.MU + WK.TRIP * (this.onBed ? 0.5 : 1) * Math.abs(c.v0.x * b.ax[2].x + c.v0.z * b.ax[2].z) / vh;
        }
      }
      // trucks knocked out from under are squeezed out from beneath the body that drops onto them
      for (const b of this.bodies) {
        if (!b.tkGone) continue;
        const hb = _wkcy.set(b.h.x, b.h.y - WK.FRAME_Y / 2, b.h.z), pb = _wkcx.copy(b.p).addScaledVector(b.ax[1], WK.FRAME_Y / 2);
        for (const tb of b.tk) if (tb && !(tb.sleep && b.sleep)) this.inside(tb, pb, b.q, hb, b.sleep ? null : b, null, true, true);
      }
      for (let x = 0; x < V.length; x++) {
        const A = V[x]; if (!A.rb) continue;
        for (let y = Math.max(0, x - 6); y < Math.min(V.length, x + 7); y++) {
          if (y === x || (V[y].rb && y < x)) continue;
          if (A.rb.sleep && (V[y].rb ? V[y].rb.sleep : Math.abs(kin.v) < 0.05)) continue;
          this.touch(A, V[y], x, y);
        }
      }
      this.joints();
      // with every car that was hit awake: how hard each contact is to move, and how fast to close it
      const C = this.C, n = this.nc, vr = _wa, j = _wb;
      for (let k = 0; k < n; k++) {
        const c = C[k], vn = this.relV(c, c.v0).dot(c.n);
        c.kn = WreckSim.kOf(c.A, c.rA, c.n) + WreckSim.kOf(c.B, c.rB, c.n) + (c.kv && kin.mass > 0 ? (c.n.dot(c.dk) ** 2) / kin.mass : 0);
        // a little rebound on a hard hit; what is already inside is pushed out separately below, without adding any speed
        c.bias = Math.max(0, -c.e * vn);
        c.ps = Math.min(WK.BIAS_V, WK.BETA * Math.max(0, c.pen - WK.SLOP) / h); c.jp = 0;
      }
      // sequential impulses: push apart, then rub, each clamped the way real contact is (no pulling, no more friction than mu allows)
      for (let it = 0; it < WK.ITER; it++) {
        this.solveJoints(h);
        for (let k = 0; k < n; k++) {
          const c = C[k];
          if (c.kn <= 0) continue;
          this.relV(c, vr);
          const vn = vr.dot(c.n);
          const d = (c.bias - vn) / c.kn, jn = Math.max(0, c.jn + d), dj = jn - c.jn; c.jn = jn;
          if (dj) this.applyC(c, j.copy(c.n).multiplyScalar(dj));
          // friction against the sliding, up to mu times the push
          this.relV(c, vr); vr.addScaledVector(c.n, -vr.dot(c.n));
          const sp = vr.length(); if (sp < 1e-6) continue;
          const t = _wc.copy(vr).multiplyScalar(1 / sp);
          const kt = WreckSim.kOf(c.A, c.rA, t) + WreckSim.kOf(c.B, c.rB, t) + (c.kv && kin.mass > 0 ? (t.dot(c.dk) ** 2) / kin.mass : 0);
          if (kt <= 0) continue;
          const old = _wd.copy(c.jt);
          c.jt.addScaledVector(t, -sp / kt);
          const lim = c.mu * c.jn, l = c.jt.length(); if (l > lim) c.jt.multiplyScalar(lim / l);
          this.applyC(c, _we.subVectors(c.jt, old));
        }
      }
      // overlap left over is pushed out by moving the cars, not by speeding them up (so a car wedged in the pile can come to rest)
      for (let it = 0; it < WK.ITER / 2; it++) {
        for (let k = 0; k < n; k++) {
          const c = C[k]; if (c.kn <= 0 || !c.ps) continue;
          const A = c.A; vr.copy(A.pw).cross(c.rA).add(A.pv);
          if (c.B && !c.B.sleep) vr.sub(_wc.copy(c.B.pw).cross(c.rB).add(c.B.pv));
          const d = (c.ps - vr.dot(c.n)) / c.kn, jp = Math.max(0, c.jp + d), dj = jp - c.jp; c.jp = jp;
          if (!dj) continue;
          j.copy(c.n).multiplyScalar(dj);
          WreckSim.push(A, c.rA, j, true);
          if (c.B) WreckSim.push(c.B, c.rB, j.negate(), true);
        }
      }
      // what the contacts did: dirt thrown where a car dug in, sparks where steel scraped, dents where it hit hard,
      // trucks knocked out from under, and cars on the rails forced off by the pile
      for (let k = 0; k < n; k++) {
        const c = C[k];
        const vn0 = c.v0.dot(c.n), vt0 = Math.sqrt(Math.max(0, c.v0.lengthSq() - vn0 * vn0));
        if (c.jn > 0 && (c.B || c.kv || c.bed) && vt0 > WK.SPARK_V) this.spark(c.P, c.v0, vt0, !c.B && !c.kv ? c.A : null);
        if (c.B || c.kv) {
          if (-vn0 > WK.DENT_V) { this.dent(c.A, c.P, c.n, -vn0); if (c.B) this.dent(c.B, c.P, _wkcj.copy(c.n).negate(), -vn0); }
          if (-vn0 > WK.TRUCK_V) { this.loseTrucks(c.A); if (c.B) this.loseTrucks(c.B); }
        } else if (-vn0 > WK.DENT_G && c.A.v) this.dent(c.A, c.P, c.n, -vn0 * 0.6);
        if (!c.B && !c.kv) {
          const b = c.A, vp = c.v0, fn = c.jn / h, sp = Math.hypot(vp.x, vp.z);
          const im = Math.max(sp, -vp.y * 1.5);
          if (-vp.y > WK.TRUCK_G) this.loseTrucks(b);
          if (im > 1.2 && im * fn > b.dgS) { b.dgS = im * fn; b.dgI = im; b.dgN = Math.min(2, fn / (WK.G * b.m)); (b.dgP || (b.dgP = new THREE.Vector3())).copy(c.P); (b.dgV || (b.dgV = new THREE.Vector3())).copy(vp); }
        } else if (c.kv) {
          // rammed hard, or shoved sideways harder than the flanges hold (L/V), it comes off too
          const w = this.massOf(c.kv) * WK.G, lat = Math.abs(c.n.dot(_wd.setFromMatrixColumn(c.kv.root.matrix, 2).normalize())) * c.jn / h;
          if (-c.v0.dot(c.n) > WK.RAM || lat > WK.LV * w) (this.off || (this.off = new Set())).add(c.kv);
        }
      }
      this.jointsAfter(h);
      if (this.off) for (const v of this.off) this.derail(V.indexOf(v));
      // integrate
      let moving = false;
      for (const b of this.bodies) {
        if (b.sleep) continue;
        b.av.multiplyScalar(0.9995);
        // never faster than the train was going (plus a margin for the throw), never spinning like a top
        const vm = Math.abs(this.spec.v0 || 0) + 8;
        if (b.lv.lengthSq() > vm * vm) b.lv.setLength(vm);
        if (b.av.lengthSq() > WK.SPIN * WK.SPIN) b.av.setLength(WK.SPIN);
        b.p.addScaledVector(b.lv, h).addScaledVector(b.pv, h);
        const w = b.pw.add(b.av); _wq.set(w.x * h * 0.5, w.y * h * 0.5, w.z * h * 0.5, 0).multiply(b.q);
        b.q.set(b.q.x + _wq.x, b.q.y + _wq.y, b.q.z + _wq.z, b.q.w + _wq.w).normalize();
        this.pose(b); b.pv.set(0, 0, 0); b.pw.set(0, 0, 0);
        if (b.tk && b.ax[1].y < WK.TRUCK_TIP) this.loseTrucks(b);
        // settled: slow for half a second puts it to sleep
        if (b.lv.lengthSq() < 0.04 && b.av.lengthSq() < 0.04) { if ((b.restT = (b.restT || 0) + h) > 0.5) { b.sleep = true; b.lv.set(0, 0, 0); b.av.set(0, 0, 0); continue; } }
        else b.restT = 0;
        moving = true;
      }
      // the cars still on the rails: brakes in emergency, plus whatever the wreck did to them above
      if (kin.mass > 0 && kin.v !== 0) {
        const s = Math.sign(kin.v), nv = kin.v - s * this.emerg * h;
        kin.v = Math.sign(nv) !== s ? 0 : nv;
      }
      this.kx += kin.v * h; kin.dx += kin.v * h;
      if (!moving && Math.abs(kin.v) < 0.05) { this.still += h; if (this.still > 1) { this.asleep = true; break; } } else this.still = 0;
    }
    for (const b of this.bodies) if (b.v) { b.v.pos.copy(b.p); b.v.fwd.copy(b.ax[0]).multiplyScalar(WreckSim.sF(b.v)); }
    if (typeof digWreck === 'function') digWreck(this, dt);
    if (typeof wfxWreck === 'function') wfxWreck(this, dt);
  }
  /* The couplers: a knuckle is a ball joint at the coupler faces that lets the cars swing about it but not part. A car
     on the rails is pulled off when the wreck drags its coupler sideways or lifts it harder than the flanges hold (L/V);
     the knuckle itself fails in tension (about 2.5 MN), or is torn off when the cars fold past what it can swing. */
  joints() {
    const V = this.T.vehicles, kin = this.kin, J = this.J || (this.J = []);
    this.nj = 0;
    for (let i = 0; i < V.length - 1; i++) {
      if (this.broken.has(i)) continue;
      const A = V[i], B = V[i + 1]; if (!A.rb && !B.rb) continue;
      if (!A._cr || !B._cf) continue;
      const fA = _wkcx.setFromMatrixColumn(A.root.matrix, 0).normalize().multiplyScalar(WreckSim.sF(A));
      const fB = _wkcy.setFromMatrixColumn(B.root.matrix, 0).normalize().multiplyScalar(WreckSim.sF(B));
      if (fA.dot(fB) < WK.CPL_FOLD) { this.part(i); continue; }
      const j = J[this.nj] || (J[this.nj] = { rA: new THREE.Vector3(), rB: new THREE.Vector3(), dA: new THREE.Vector3(), dB: new THREE.Vector3(), d: new THREE.Vector3(), J: new THREE.Vector3(), fA: new THREE.Vector3(), k: [0, 0, 0], e: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] });
      this.nj++;
      j.i = i; j.A = A; j.B = B; j.a = A.rb && !A.rb.sleep ? A.rb : null; j.b = B.rb && !B.rb.sleep ? B.rb : null; j.J.set(0, 0, 0); j.fA.copy(fA); j.Jx = [0, 0, 0];
      this.pointOf(A, A._cr, _wkcd, _wkcs); this.pointOf(B, B._cf, _wkcf, _wkcs);
      j.d.subVectors(_wkcf, _wkcd);
      if (A.rb) j.rA.subVectors(_wkcd, A.rb.p); else j.dA.copy(fA);
      if (B.rb) j.rB.subVectors(_wkcf, B.rb.p); else j.dB.copy(fB);
      // the joint's axes: along car A, up, and across it (where the coupler can swing in its striker before it pulls)
      const M = A.rb ? A.rb.W : A.root.matrix;
      j.e[0].copy(fA); j.e[1].setFromMatrixColumn(M, 1).normalize(); j.e[2].crossVectors(j.e[0], j.e[1]).normalize();
      for (let x = 0; x < 3; x++) {
        const e = j.e[x];
        j.k[x] = WreckSim.kOf(j.a, j.rA, e) + WreckSim.kOf(j.b, j.rB, e) + (kin.mass > 0 ? ((A.rb ? 0 : e.dot(j.dA) ** 2) + (B.rb ? 0 : e.dot(j.dB) ** 2)) / kin.mass : 0);
      }
    }
  }
  /* velocity of joint j's B side minus its A side */
  jointV(j, out) {
    const a = j.a, b = j.b, v = this.kin.v;
    if (b) out.copy(b.av).cross(j.rB).add(b.lv); else out.copy(j.dB).multiplyScalar(j.B.rb ? 0 : v);
    if (a) out.sub(_wkch.copy(a.av).cross(j.rA).add(a.lv)); else if (!j.A.rb) out.addScaledVector(j.dA, -v);
    return out;
  }
  /* impulse e * l on joint j: + on its B side, - on its A side (a car on the rails takes it along its track) */
  jointPush(j, e, l) {
    const kin = this.kin;
    if (j.b) WreckSim.push(j.b, j.rB, _wkcg.copy(e).multiplyScalar(l));
    else if (!j.B.rb && kin.mass > 0) kin.v += l * e.dot(j.dB) / kin.mass;
    if (j.a) WreckSim.push(j.a, j.rA, _wkcg.copy(e).multiplyScalar(-l));
    else if (!j.A.rb && kin.mass > 0) kin.v -= l * e.dot(j.dA) / kin.mass;
  }
  /* The knuckle and draft gear give a little (a stiff spring and damper, solved implicitly so it can never ring):
     a hard yank shows up as the force it really is, not as the infinite one a rigid joint would take. */
  solveJoints(h) {
    const K = WK.CPL_K, Cd = WK.CPL_C, g = 1 / (h * (Cd + h * K)), bh = K / (Cd + h * K);
    for (let n = 0; n < this.nj; n++) {
      const j = this.J[n];
      for (let x = 0; x < 3; x++) {
        const k = j.k[x]; if (k <= 0) continue;
        const e = j.e[x];
        let C = j.d.dot(e);
        // sideways the coupler swings freely in its striker until it fetches up against the side
        if (x === 2) { const a = Math.abs(C) - WK.SWING; if (a <= 0 && !j.Jx[2]) continue; C = Math.sign(C) * Math.max(0, a); }
        const rel = this.jointV(j, _wkci).dot(e);
        const l = -(rel + bh * C + g * j.Jx[x]) / (k + g);
        j.Jx[x] += l; j.J.addScaledVector(e, l);
        this.jointPush(j, e, l);
      }
    }
  }
  /* after the push: knuckles pulled apart too hard break; cars on the rails dragged or lifted off come off */
  jointsAfter(h) {
    for (let n = 0; n < this.nj; n++) {
      const j = this.J[n], F = _wkcs.copy(j.J).multiplyScalar(1 / h);   // force on the B side
      if (F.dot(j.fA) > WK.CPL_BREAK) { this.part(j.i); continue; }
      const kv = j.A.rb ? (j.B.rb ? null : j.B) : j.A;
      if (kv) {
        if (kv === j.A) F.negate();
        const M = kv.root.matrix, w = this.massOf(kv) * WK.G;
        const lat = Math.abs(F.dot(_wkce.setFromMatrixColumn(M, 2).normalize())), up = F.dot(_wkce.setFromMatrixColumn(M, 1).normalize());   // pulled down, it just bears harder on the rails
        if (lat > WK.LV * w || up > WK.LIFT * w) (this.off || (this.off = new Set())).add(kv);
      }
    }
  }
  part(i) { this.broken.add(i); if (AU.on) sndClunk(1.4, 0); }
  /* contacts where rigid car A and car B overlap: the points of each box inside the other, pushed out along its shallowest face */
  touch(A, B, ia, ib) {
    const a = A.rb;
    const bb = B.rb, cB = bb ? bb.p : _wf.copy(B.pos || _wf.setFromMatrixPosition(B.root.matrix));
    if (a.p.distanceTo(cB) > (A.len + B.len) / 2 + 2) return;
    let hB, pB, qB;
    if (bb) { hB = bb.h; pB = bb.p; qB = bb.q; }
    else {
      if (!B._box) { B._box = bodyBox(B); B._c = B._box.getCenter(new THREE.Vector3()); B._h = B._box.getSize(new THREE.Vector3()).multiplyScalar(0.5); }
      hB = B._h; pB = _wkch.copy(B._c).applyMatrix4(B.root.matrix).addScaledVector(_wkcx.setFromMatrixColumn(B.root.matrix, 0).normalize(), WreckSim.sF(B) * (this.kx || 0)); qB = _wqi.setFromRotationMatrix(B.root.matrix);
    }
    // cars still coupled together meet at the knuckles, not end to end: their boxes (which take in the couplers) only
    // touch where a corner swings into the other's side as they fold
    const lo = Math.min(ia, ib);
    const ends = Math.abs(ia - ib) !== 1 || this.broken.has(lo);
    this.inside(a, pB, qB, hB, bb, bb ? null : B, ends);
    if (bb) this.inside(bb, a.p, a.q, a.h, a, null, ends);
  }
  /* points of body src inside the box (pO, qO, hO) of body o (or car kv on the rails); ends false leaves out pushes
     through the box's ends */
  inside(src, pO, qO, hO, o, kv, ends = true, flat = false) {
    const qi = _wqi2.copy(qO).invert(), n = _wkci;
    for (const s of src.pts) {
      const P = _wa.copy(s).applyQuaternion(src.q).add(src.p);
      const u = _wb.subVectors(P, pO).applyQuaternion(qi);
      const dx = hO.x - Math.abs(u.x), dy = hO.y - Math.abs(u.y), dz = hO.z - Math.abs(u.z);
      if (dx <= 0 || dy <= 0 || dz <= 0) continue;
      const pen = flat ? Math.min(dx, dz) : Math.min(dx, dy, dz);   // flat: only out the sides or ends, never down into the ground
      if (pen === dx) { if (!ends) continue; n.set(Math.sign(u.x) || 1, 0, 0); } else if (pen === dy) n.set(0, Math.sign(u.y) || 1, 0); else n.set(0, 0, Math.sign(u.z) || 1);
      n.applyQuaternion(qO);
      this.contact(src, o, kv, P, n, pen, WK.MU_C, WK.E_C);
    }
  }
}
const _wkcd = new THREE.Vector3(), _wkcs = new THREE.Vector3(), _wkcf = new THREE.Vector3(), _wkcx = new THREE.Vector3(), _wkcy = new THREE.Vector3(), _wkce = new THREE.Vector3(), _wkcg = new THREE.Vector3(), _wkch = new THREE.Vector3(), _wkci = new THREE.Vector3();
const _wqi2 = new THREE.Quaternion(), _wkcj = new THREE.Vector3();
WreckSim.AX = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];

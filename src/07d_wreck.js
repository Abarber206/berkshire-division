/* ============================================================================
   Wreck physics. When a train comes off the rails its cars stop following the track one by one and
   become rigid bodies: a box the size of the car body with the car's own weight, carrying the speed it
   had. They fall, slide and dig into the ground and the ballast, roll over, slam into each other, and
   pull or shove the cars still coupled to them until a coupler lets go. The cars still on the rails
   run on into the pile (their brakes go into emergency when the train line parts) and come off in turn
   when the car ahead drags them off the rails or they hit it hard.

   Contacts are springs and dampers at points over each box (ground, ballast and other cars) with
   Coulomb friction, stepped at 240 Hz. Couplers are stiff springs that break above about 2.5 MN.
   ========================================================================== */
const WK = {
  H: 1 / 240, G: 9.81, MU: 0.5, MAXB: 40,
  KG: 400, CG: 8,             // ground contact, per point, per kg of the car
  KC: 900, CC: 24,            // car against car
  CPL_K: 4e7, CPL_C: 1.6e6, CPL_BREAK: 2.5e6, CPL_Y: 0.88,
  OFF: 0.45, UP: 0.35,        // how far a coupler can be dragged off line before the next car comes off too
  RAM: 2.5,                   // closing speed (m/s) at which a car on the rails ramming the pile comes off
  EMERG: 1.2,                 // brakes in emergency on the cars still on the rails, m/s²
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
  return box;
}

class WreckSim {
  /* spec = { a: metres back from the front coupler, side: ±1, seed, k: 0..1, v0: m/s, hit } */
  constructor(T, spec) {
    this.T = T; this.spec = spec; this.r = rng(spec.seed || 1);
    this.bodies = []; this.t = 0; this.still = 0; this.asleep = false; this.acc = 0;
    this.kin = { v: spec.vs || 0, mass: 0, force: 0 };
    this.broken = new Set();   // coupler i joins vehicle i (rear) and i + 1 (front)
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
  }
  /* take vehicle i off the rails: a rigid body with the speed the train had (times keep) */
  derail(i, keep = 1) {
    const v = this.T.vehicles[i]; if (!v || v.rb || this.bodies.length >= WK.MAXB) return null;
    const M = v.root.matrix.clone(), box = bodyBox(v);
    const c = box.getCenter(new THREE.Vector3()), h = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    const m = Math.max(8000, v.mass || 40000);
    const p = c.clone().applyMatrix4(M), q = new THREE.Quaternion().setFromRotationMatrix(M);
    const ax = [0, 1, 2].map(j => new THREE.Vector3().setFromMatrixColumn(M, j).normalize());
    const sF = WreckSim.sF(v), sp = this.kinV() * keep;
    const b = {
      v, i, m, c, h, p, q, ax, M0: M,
      lv: ax[0].clone().multiplyScalar(sF * sp), av: new THREE.Vector3(),
      I: new THREE.Vector3(m / 3 * (h.y * h.y + h.z * h.z), m / 3 * (h.x * h.x + h.z * h.z), m / 3 * (h.x * h.x + h.y * h.y)),
      // sample points over the box, from its centre
      pts: [], bed: { o: _wa.set(0, 0, 0).applyMatrix4(M).clone(), r: ax[2].clone(), f: ax[0].clone(), len: v.len },
      W: new THREE.Matrix4(), D: new THREE.Matrix4(), F: new THREE.Vector3(), tq: new THREE.Vector3(),
    };
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) if (x || y || z) b.pts.push(new THREE.Vector3(x * h.x, y * h.y, z * h.z));
    // where the trucks were when it came off, so they stay with it
    b.t0 = v.tp.map(t => { const m4 = frameMatrix(t.F, new THREE.Matrix4()); if (v.flip) m4.multiply(new THREE.Matrix4().makeRotationY(Math.PI)); return m4; });
    if ((v.kind === 'loco' || v.kind === 'loco2') && this.T.diesel) b.u0 = v.model.trucks.map(tg => tg.matrix.clone());
    else if (v.kind === 'loco' && this.T.loco && this.T.loco.leadTruck) b.l0 = this.T.loco.leadTruck.matrix.clone();
    v.rb = b; this.bodies.push(b);
    this.pose(b);
    if (typeof sndClunk === 'function' && AU.on) sndClunk(clamp(Math.abs(sp) / 8, 0.4, 1.5), 0);
    return b;
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
      outP.copy(local).applyMatrix4(v.root.matrix);
      outV.setFromMatrixColumn(v.root.matrix, 0).normalize().multiplyScalar(WreckSim.sF(v) * this.kinV());
    }
  }
  /* height of whatever a point is resting on: the ground, or the roadbed the car came off */
  ground(b, P) {
    let g = groundAt(P.x, -P.z);
    if (WORLD.mtn && P.y < g) { const t = mtInBore(P.x, P.z, 0.5); if (t) g = t.rail - 0.3; }   // in a tunnel: the bore's floor, not the hill over it
    const B = b.bed; _we.subVectors(P, B.o);
    if (Math.abs(_we.dot(B.f)) < B.len * 1.5) {
      const lat = Math.abs(_we.dot(B.r));
      const bed = lat < 1.8 ? -0.2 : -0.2 - (lat - 1.8) * 0.66;
      if (bed > -0.95) g = Math.max(g, B.o.y + bed);
    }
    return g;
  }
  force(b, P, F) {
    // linear and angular impulse over one step, applied to the body's accumulators
    // a car that has come to rest stays put unless something hits it properly
    if (b.sleep) { if (F.lengthSq() < 9 * (WK.G * b.m) ** 2) return; b.sleep = false; b.restT = 0; }
    b.F.add(F); b.tq.add(_wd.subVectors(P, b.p).cross(F));
  }
  /* kin: the part of the train still on the rails = { v: m/s along the train, mass: kg, force: N along the train } */
  step(dt, kin) {
    this.kin = kin;
    if (this.asleep) return;
    const T = this.T, V = T.vehicles;
    this.acc = Math.min(this.acc + dt, 0.06);
    while (this.acc >= WK.H) {
      this.acc -= WK.H; this.t += WK.H;
      const h = WK.H;
      for (const b of this.bodies) { b.F.set(0, -WK.G * b.m, 0); b.tq.set(0, 0, 0); }
      kin.force = 0;
      // ground and roadbed
      for (const b of this.bodies) {
        if (b.sleep) continue;
        for (const s of b.pts) {
          const P = _wa.copy(s).applyQuaternion(b.q), r = P.clone(); P.add(b.p);
          const pen = this.ground(b, P) - P.y; if (pen <= 0) continue;
          const vp = _wb.copy(b.av).cross(r).add(b.lv);
          const fn = Math.max(0, WK.KG * b.m * Math.min(pen, 0.5) - WK.CG * b.m * vp.y);
          const vt = _wc.set(vp.x, 0, vp.z), sp = vt.length();
          const F = new THREE.Vector3(0, fn, 0);
          if (sp > 1e-4) F.addScaledVector(vt, -WK.MU * fn / Math.max(sp, 0.25));
          this.force(b, P, F);
        }
      }
      // car against car: points of one box inside another (cars still on the rails count as immovable)
      for (let x = 0; x < V.length; x++) {
        const A = V[x]; if (!A.rb) continue;
        for (let y = Math.max(0, x - 6); y < Math.min(V.length, x + 7); y++) {
          if (y === x || (V[y].rb && y < x)) continue;
          if (A.rb.sleep && (V[y].rb ? V[y].rb.sleep : Math.abs(this.kinV()) < 0.05)) continue;
          this.touch(A, V[y], kin);
        }
      }
      // couplers
      for (let i = 0; i < V.length - 1; i++) {
        if (this.broken.has(i)) continue;
        const A = V[i], B = V[i + 1]; if (!A.rb && !B.rb) continue;
        const la = A._cr, lb = B._cf; if (!la || !lb) continue;
        const PA = new THREE.Vector3(), VA = new THREE.Vector3(), PB = new THREE.Vector3(), VB = new THREE.Vector3();
        this.pointOf(A, la, PA, VA); this.pointOf(B, lb, PB, VB);
        const d = _wb.subVectors(PB, PA), F = d.clone().multiplyScalar(WK.CPL_K).addScaledVector(_wc.subVectors(VB, VA), WK.CPL_C);
        if (F.length() > WK.CPL_BREAK) { this.broken.add(i); if (AU.on) sndClunk(1.4, 0); continue; }
        if (A.rb) this.force(A.rb, PA, F); else kin.force += F.dot(_we.setFromMatrixColumn(A.root.matrix, 0).normalize()) * WreckSim.sF(A);
        if (B.rb) this.force(B.rb, PB, F.clone().negate()); else kin.force -= F.dot(_we.setFromMatrixColumn(B.root.matrix, 0).normalize()) * WreckSim.sF(B);
        // dragged off line: the car still on the rails comes off too
        const kv = A.rb ? (B.rb ? null : B) : A;
        if (kv) {
          const M = kv.root.matrix, off = _wd.subVectors(kv === A ? PB : PA, kv === A ? PA : PB);
          const lat = Math.abs(off.dot(_we.setFromMatrixColumn(M, 2).normalize())), up = Math.abs(off.dot(_wf.setFromMatrixColumn(M, 1).normalize()));
          if (lat > WK.OFF || up > WK.UP) this.derail(kv === A ? i : i + 1);
        }
      }
      // integrate
      let moving = false;
      for (const b of this.bodies) {
        if (b.sleep) continue;
        b.lv.addScaledVector(b.F, h / b.m);
        // angular: world inverse inertia from the body axes
        const tq = b.tq, ax = b.ax;
        for (let j = 0; j < 3; j++) b.av.addScaledVector(ax[j], tq.dot(ax[j]) / b.I.getComponent(j) * h);
        b.av.multiplyScalar(0.9995);
        b.p.addScaledVector(b.lv, h);
        const w = b.av; _wq.set(w.x * h * 0.5, w.y * h * 0.5, w.z * h * 0.5, 0).multiply(b.q);
        b.q.set(b.q.x + _wq.x, b.q.y + _wq.y, b.q.z + _wq.z, b.q.w + _wq.w).normalize();
        this.pose(b);
        // settled: slow for half a second puts it to sleep
        if (b.lv.lengthSq() < 0.04 && b.av.lengthSq() < 0.04) { if ((b.restT = (b.restT || 0) + h) > 0.5) { b.sleep = true; b.lv.set(0, 0, 0); b.av.set(0, 0, 0); continue; } }
        else b.restT = 0;
        moving = true;
      }
      // the cars still on the rails: emergency brakes plus whatever the wreck pushes or pulls on them
      if (kin.mass > 0 && kin.v !== 0) {
        const s = Math.sign(kin.v), nv = kin.v + (kin.force / kin.mass) * h - s * WK.EMERG * h;
        kin.v = Math.sign(nv) !== s ? 0 : nv;
      } else if (kin.mass > 0 && kin.force) kin.v += (kin.force / kin.mass) * h * 0.5;
      if (!moving && Math.abs(kin.v) < 0.05) { this.still += h; if (this.still > 1) { this.asleep = true; break; } } else this.still = 0;
    }
    for (const b of this.bodies) { b.v.pos.copy(b.p); b.v.fwd.copy(b.ax[0]).multiplyScalar(WreckSim.sF(b.v)); }
  }
  /* push apart rigid car A and car B where their boxes overlap */
  touch(A, B, kin) {
    const a = A.rb;
    const bb = B.rb, cB = bb ? bb.p : _wf.copy(B.pos || _wf.setFromMatrixPosition(B.root.matrix));
    if (a.p.distanceTo(cB) > (A.len + B.len) / 2 + 2) return;
    // B as a box: centre, axes and half sizes
    let hB, pB, qB;
    if (bb) { hB = bb.h; pB = bb.p; qB = bb.q; }
    else {
      if (!B._box) { B._box = bodyBox(B); B._c = B._box.getCenter(new THREE.Vector3()); B._h = B._box.getSize(new THREE.Vector3()).multiplyScalar(0.5); }
      hB = B._h; pB = B._c.clone().applyMatrix4(B.root.matrix); qB = _wqi.setFromRotationMatrix(B.root.matrix).clone();
    }
    const qi = qB.clone().invert();
    const both = [[a, pB, qB, qi, hB, 1]];
    if (bb) both.push([bb, a.p, a.q, a.q.clone().invert(), a.h, -1]);
    for (const [src, pO, qO, qOi, hO, sg] of both) {
      for (const s of src.pts) {
        const P = _wa.copy(s).applyQuaternion(src.q).add(src.p);
        const u = _wb.subVectors(P, pO).applyQuaternion(qOi);
        const dx = hO.x - Math.abs(u.x), dy = hO.y - Math.abs(u.y), dz = hO.z - Math.abs(u.z);
        if (dx <= 0 || dy <= 0 || dz <= 0) continue;
        // out along the shallowest face
        const n = new THREE.Vector3(), pen = Math.min(dx, dy, dz);
        if (pen === dx) n.set(Math.sign(u.x) || 1, 0, 0); else if (pen === dy) n.set(0, Math.sign(u.y) || 1, 0); else n.set(0, 0, Math.sign(u.z) || 1);
        n.applyQuaternion(qO);
        const PP = P.clone(), VS = new THREE.Vector3(), VO = new THREE.Vector3();
        VS.copy(src.av).cross(_wc.subVectors(PP, src.p)).add(src.lv);
        if (bb) { const o = sg > 0 ? bb : a; VO.copy(o.av).cross(_wc.subVectors(PP, o.p)).add(o.lv); }
        else VO.setFromMatrixColumn(B.root.matrix, 0).normalize().multiplyScalar(WreckSim.sF(B) * this.kinV());
        const vn = _wd.subVectors(VS, VO).dot(n), mm = bb ? Math.min(a.m, bb.m) : a.m;
        const fn = Math.max(0, WK.KC * mm * Math.min(pen, 0.6) - WK.CC * mm * vn);
        const vt = _we.subVectors(VS, VO).addScaledVector(n, -vn), sp = vt.length();
        const F = n.clone().multiplyScalar(fn); if (sp > 1e-4) F.addScaledVector(vt, -WK.MU * fn / Math.max(sp, 0.25));
        this.force(src, PP, F);
        if (bb) this.force(sg > 0 ? bb : a, PP, F.clone().negate());
        else {
          kin.force -= F.dot(_wf.setFromMatrixColumn(B.root.matrix, 0).normalize()) * WreckSim.sF(B);
          // a car on the rails running hard into the pile comes off too
          if (-vn > WK.RAM) this.derail(this.T.vehicles.indexOf(B));
        }
      }
    }
  }
}

/* ============================================================================
   Train: consist, track-following, poses, wheel & rod animation
   ========================================================================== */
const CONSISTS = {
  passenger: { name: 'Passenger', sub: '8 heavyweights · 660 tons', build: () => { const a = []; for (let i = 0; i < 7; i++) a.push(['coach', 0]); a.push(['coach', 1]); return a; } },
  freight: { name: 'Manifest freight', sub: '36 cars · 2,700 tons', build: (r) => { const a = []; const t = ['box', 'box', 'hopper', 'hopper', 'tank', 'gon', 'box', 'hopper']; for (let i = 0; i < 35; i++) a.push([t[(r() * t.length) | 0], 0]); a.push(['caboose', 0]); return a; } },
  light: { name: 'Light engine', sub: 'Pick up cars in the yard', build: () => [] },
};

/* A string of coupled vehicles following the track: the player's train, or a cut of cars standing in
   a yard. Vehicles can move between consists when they are coupled or cut off, so everything that
   depends on the order (offsets, tracked points, instanced trucks) is rebuilt by layout(). */
class Consist {
  constructor(scene) { this.scene = scene; this.vehicles = []; this.dist = 0; this.li = 0; this.pts = []; this.length = 0; this.inst = []; }
  get last() { return this.vehicles[this.vehicles.length - 1]; }
  get first() { return this.vehicles[0]; }
  /* the lead locomotive (front of a cut of cars) */
  get lead() { return this.vehicles[this.li]; }
  /* tracked points for a vehicle: its two body pivots, its trucks, and the steam engine's lead truck */
  track(v) {
    const pt = loc => ({ loc, a: 0, tp: null, F: newFrame(), v });
    v.fp = v.frame.map(pt);
    v.tp = v.trucks.map(t => pt(t.a));
    if (v.kind === 'loco' && !this.diesel) v.leadPt = pt(LG.aL); else if (v.kind === 'loco') v.leadPt = v.fp[0];
    v.ptsAll = [...v.fp, ...v.tp]; if (v.leadPt && !v.ptsAll.includes(v.leadPt)) v.ptsAll.push(v.leadPt);
  }
  /* offsets from the front coupler, front to back. A vehicle with flip set stands turned in this consist. */
  layout() {
    let a = 0;
    this.pts = [];
    this.li = 0;
    this.vehicles.forEach((v, i) => {
      v.a0 = a;
      for (const p of v.ptsAll) { p.a = a + (v.flip ? v.len - p.loc : p.loc); this.pts.push(p); }
      if (v.kind === 'loco') this.li = i;
      a += v.len;
    });
    this.length = a;
    this.pts.sort((p, q) => p.a - q.a);
  }
  /* instanced truck frames and axles for every car in the consist */
  buildInstances(geo) {
    for (const im of this.inst) this.scene.remove(im);
    this.geo = geo || this.geo;
    let nSix = 0, nFour = 0;
    for (const v of this.vehicles) for (const t of v.trucks) { if (t.type === 'six') nSix++; else nFour++; }
    const { tg, a6, a4 } = this.geo;
    this.tSix = nSix ? new THREE.InstancedMesh(tg.six, RMAT.dark, nSix) : null;
    this.tFour = nFour ? new THREE.InstancedMesh(tg.four, RMAT.dark, nFour) : null;
    this.ax6 = nSix ? [new THREE.InstancedMesh(a6.black, RMAT.black, nSix * 3), new THREE.InstancedMesh(a6.tire, RMAT.tire, nSix * 3)] : null;
    this.ax4 = nFour ? [new THREE.InstancedMesh(a4.black, RMAT.black, nFour * 2), new THREE.InstancedMesh(a4.tire, RMAT.tire, nFour * 2)] : null;
    this.inst = [this.tSix, this.tFour, ...(this.ax6 || []), ...(this.ax4 || [])].filter(Boolean);
    for (const im of this.inst) { im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true; this.scene.add(im); }
    this.hidden = false;
  }
  /* place with the front coupler at tp (o = facing direction) */
  place(tp) {
    for (const p of this.pts) { p.tp = tp.clone(); if (p.a) p.tp.advance(-p.a, null); }
    this.update(0);
  }
  frontTP() { return this.pts[0].tp; }
  rearTP() { return this.pts[this.pts.length - 1].tp; }
  /* the coupler face at one end ('front' or 'rear'), as a track position */
  endTP(end) {
    if (end === 'front') { const p = this.pts[0], t = p.tp.clone(); t.advance(p.a, null); return t; }
    const p = this.pts[this.pts.length - 1], t = p.tp.clone(); t.advance(-(this.length - p.a), null); return t;
  }
  /* move the whole consist by d metres; returns actually moved distance and node events */
  move(d, ctx) {
    if (d === 0) return 0;
    const order = d > 0 ? this.pts : [...this.pts].reverse();
    const lead = order[0];
    const lctx = { commit: true, onRunThrough: ctx.onRunThrough, onNode: ctx.onNode };
    const left = lead.tp.advance(d, lctx);
    const actual = d - left;
    const fctx = { commit: true, onRunThrough: ctx.onRunThrough };
    for (let i = 1; i < order.length; i++) order[i].tp.advance(actual, fctx);
    if (left !== 0 && ctx.onBlocked) ctx.onBlocked(left);
    this.dist += actual;
    return actual;
  }
  update(dt, theta = 0, rev = 0) {
    for (const p of this.pts) p.tp.pose(p.F);
    let i6 = 0, i4 = 0, a6 = 0, a4 = 0;
    for (const v of this.vehicles) {
      const A = v.fp[0].F, B = v.fp[1].F;
      _v1.addVectors(A.p, B.p).multiplyScalar(0.5);
      _v2.subVectors(A.p, B.p).normalize();
      _v3.addVectors(A.u, B.u).normalize();
      const r = new THREE.Vector3().crossVectors(_v2, _v3).normalize();
      const u = new THREE.Vector3().crossVectors(r, _v2).normalize();
      v.root.matrixAutoUpdate = false;
      v.root.matrix.makeBasis(_v2, u, r).setPosition(_v1);
      v.root.matrixWorldNeedsUpdate = true;
      v.pos = v.pos || new THREE.Vector3(); v.pos.copy(_v1);
      v.fwd = v.fwd || new THREE.Vector3(); v.fwd.copy(_v2);
      // wheels keep turning the same way when a car changes hands or ends
      const roll = this.dist * (v.flip ? -1 : 1) + (v.roll || 0), wAng6 = -roll / 0.457, wAng4 = -roll / 0.419;
      for (let k = 0; k < v.trucks.length; k++) {
        const t = v.trucks[k], Fp = v.tp[k].F;
        frameMatrix(Fp, _tm);
        if (v.flip) _tm.multiply(_m4.makeRotationY(Math.PI));
        if (t.type === 'six') {
          this.tSix.setMatrixAt(i6++, _tm);
          for (const x of [-1.676, 0, 1.676]) { _m4.copy(_tm).multiply(new THREE.Matrix4().makeTranslation(x, t.R, 0)).multiply(new THREE.Matrix4().makeRotationZ(wAng6)); this.ax6[0].setMatrixAt(a6, _m4); this.ax6[1].setMatrixAt(a6, _m4); a6++; }
        } else {
          this.tFour.setMatrixAt(i4++, _tm);
          for (const x of [-0.865, 0.865]) { _m4.copy(_tm).multiply(new THREE.Matrix4().makeTranslation(x, t.R, 0)).multiply(new THREE.Matrix4().makeRotationZ(wAng4)); this.ax4[0].setMatrixAt(a4, _m4); this.ax4[1].setMatrixAt(a4, _m4); a4++; }
        }
      }
      if ((v.kind === 'loco' || v.kind === 'loco2') && this.diesel) {
        const U = v.model;
        U.trucks.forEach((tg, k) => { tg.matrixAutoUpdate = false; frameMatrix(v.fp[k].F, tg.matrix); if (v.reversed) tg.matrix.multiply(_m4.makeRotationY(Math.PI)); tg.matrixWorldNeedsUpdate = true; });
        const wa = (v.reversed ? 1 : -1) * this.dist / DG.rW; for (const w of U.wheels) w.rotation.z = wa;
        v.root.updateMatrixWorld(true);
      } else if (v.kind === 'loco') {
        const lf = v.leadPt.F;
        const lt = this.loco.leadTruck; lt.matrixAutoUpdate = false; frameMatrix(lf, lt.matrix); lt.matrixWorldNeedsUpdate = true;
        this.loco.parts.lead.rotation.z = -this.dist / LG.rL;
        this.loco.parts.trail[0].rotation.z = -this.dist / LG.rT1;
        this.loco.parts.trail[1].rotation.z = -this.dist / LG.rT2;
        animateBerkshire(this.loco, theta, rev);
      }
    }
    for (const im of this.inst) im.instanceMatrix.needsUpdate = true;
  }
  /* hand vehicles over to another consist without a jump in their wheel rotation */
  release(v) { v.roll = this.dist * (v.flip ? -1 : 1) + (v.roll || 0); }
  adopt(v) { v.roll -= this.dist * (v.flip ? -1 : 1); }
  setVisible(on) {
    for (const x of this.vehicles) x.root.visible = on;
    for (const im of this.inst) im.visible = on;
  }
}

/* a freight car or coach as a vehicle record */
function carVehicle(m) {
  return { kind: m.kind, model: m, root: m.root, len: m.len, frame: m.frame, trucks: m.trucks, mass: m.weight, axles: m.axles, area: m.area, brakeA: m.kind === 'coach' ? 0.95 : 0.5, markers: m.root.userData.markers,
    brake: { AR: 90, BC: 0, BP: 90, emerg: false, released: true } };
}

class Train extends Consist {
  constructor(scene, locoKey, consistKey, opts = {}) {
    super(scene);
    this.locoKey = locoKey; this.consistKey = consistKey;
    this.driverDist = 0;
    const r = rng(1944);
    // locomotive
    const spec = LOCO_SPEC[locoKey];
    ROAD_SHORT = spec.short;
    this.diesel = !!spec.diesel;
    const engMass = spec.weight * 0.4536; // engine only (lb → kg)
    let L;
    if (this.diesel) {
      // a lashup of one to three units; the last unit runs backward so there is a cab at each end
      const n = clamp(opts.units || 1, 1, 3);
      this.units = []; this.nUnits = n;
      for (let u = 0; u < n; u++) {
        const lv = dieselLiveryFor(opts, u), num = (opts.number && u === 0 ? opts.number : (opts.number ? opts.number : lv.num)) + u;
        const m = buildDiesel({ livery: lv, number: num, lead: u === 0 });
        const wrap = new THREE.Group(); wrap.add(m.root);
        const reversed = n > 1 && u === n - 1; if (reversed) m.root.rotation.y = Math.PI;
        scene.add(wrap); m.trucks.forEach(t => scene.add(t));
        this.vehicles.push({ kind: u === 0 ? 'loco' : 'loco2', model: m, root: wrap, len: m.len, frame: m.frame, trucks: [], mass: engMass, axles: 6, area: u === 0 ? 125 : 0, brakeA: 0.6, reversed });
        this.units.push(m); m.vehicle = this.vehicles[this.vehicles.length - 1];
      }
      L = this.units[0];
      this.tender = null;
    } else {
      L = buildBerkshire(locoKey);
      scene.add(L.root); scene.add(L.leadTruck);
      this.vehicles.push({ kind: 'loco', model: L, root: L.root, len: LG.len, frame: [LG.aD[0], LG.aD[3]], trucks: [], mass: engMass, axles: 10, area: 125, brakeA: 0.55 });
      const T = buildTender(locoKey);
      scene.add(T.root);
      this.tender = T;
      this.vehicles.push({ kind: 'tender', model: T, root: T.root, len: T.len, frame: T.frame, trucks: T.trucks, mass: 0, axles: 6, area: 0, brakeA: 0.6 });
    }
    this.loco = L;
    // cars
    const list = CONSISTS[consistKey].build(r);
    let n = 0;
    for (const [type, flag] of list) {
      const m = type === 'coach' ? coachModel(spec, 3010 + (n++) * 7, !!flag) : freightModel(type, 10000 + ((r() * 89999) | 0), r);
      scene.add(m.root);
      this.vehicles.push(carVehicle(m));
    }
    // tender mass varies with water & coal
    this.tenderEmpty = 92000;
    for (const v of this.vehicles) { v.brake = v.brake || { AR: 90, BC: 0, BP: 90, emerg: false, released: true }; this.track(v); }
    this.layout();
    this.buildInstances({ tg: truckGeos(), a6: plainAxle(0.457), a4: plainAxle(0.419) });
    // headlight. Another player's train (opts.remote) gets no real lights: adding lights
    // to the scene would recompile every shader, and its lamp glow is drawn without them.
    this.remote = !!opts.remote;
    if (!this.remote) {
      this.head = new THREE.SpotLight(0xfff0d0, 0, 420, 0.2, 0.55, 1.3);
      this.head.castShadow = false;
      scene.add(this.head); scene.add(this.head.target);
      this.fireLight = new THREE.PointLight(0xff7a2a, 0, 7, 2);
      L.body.add(this.fireLight); this.fireLight.position.set(ax(15.0), 2.55, 0.1);
      this.cabLight = new THREE.PointLight(0xffd09a, 0, 5, 2); L.body.add(this.cabLight); if (L.cabLightPos) this.cabLight.position.copy(L.cabLightPos); else this.cabLight.position.set(ax(15.8), 4.1, 0);
    } else { this.head = null; this.fireLight = null; this.cabLight = null; }
    this.markerMats = [];
    for (const v of this.vehicles) if (v.markers) for (const p of v.markers) { const m = new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), new THREE.MeshBasicMaterial({ color: 0xff2a1e })); m.position.copy(p); m.rotation.y = -Math.PI / 2; v.root.add(m); this.markerMats.push(m); }
  }
  update(dt, theta = 0, rev = 0) {
    super.update(dt, theta, rev);
    // headlight follows the lamp
    const L = this.loco;
    L.root.updateMatrixWorld(true);
    if (this.head) {
      this.head.position.copy(L.headlightPos).applyMatrix4(L.root.matrixWorld);
      this.head.target.position.copy(L.headlightPos).add(new THREE.Vector3(60, -3.2, 0)).applyMatrix4(L.root.matrixWorld);
    }
  }
  worldOf(local, out = new THREE.Vector3()) { return out.copy(local).applyMatrix4(this.loco.root.matrixWorld); }
  unitWorld(m, local, out = new THREE.Vector3()) { return out.copy(local).applyMatrix4(m.root.matrixWorld); }
  dispose() {
    for (const v of this.vehicles) { this.scene.remove(v.root); }
    if (this.diesel) this.units.forEach(m => m.trucks.forEach(t => this.scene.remove(t))); else this.scene.remove(this.loco.leadTruck);
    for (const im of this.inst) this.scene.remove(im);
    if (this.head) { this.scene.remove(this.head); this.scene.remove(this.head.target); }
  }
  /* free GPU memory for a train that is going away for good (another player's) */
  disposeDeep() {
    this.dispose();
    const seen = new Set(), roots = [...this.vehicles.map(v => v.root), ...this.inst];
    if (this.diesel) this.units.forEach(m => roots.push(...m.trucks)); else roots.push(this.loco.leadTruck);
    for (const r of roots) if (r) r.traverse(o => { if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); } });
    if (this.diesel) for (const m of this.units) for (const k in m.skin) { const mt = m.skin[k]; if (mt.map) mt.map.dispose(); mt.dispose(); }
  }
  setVisible(v) {
    super.setVisible(v);
    if (this.diesel) this.units.forEach(m => m.trucks.forEach(t => { t.visible = v; })); else this.loco.leadTruck.visible = v;
  }
}

/* Paint for unit u of a diesel lashup: matched, or each unit in a different scheme. */
function dieselLiveryFor(opts, u) {
  const base = opts.livery || 'ss';
  let key = base;
  if (opts.mix && u > 0) { const order = LIVERY_ORDER.filter(k => k !== base); key = order[(u - 1) % order.length]; }
  if (key === 'custom') return Object.assign({}, LIVERIES.custom, opts.custom || {});
  return LIVERIES[key];
}

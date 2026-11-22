/* ============================================================================
   People: the railroader you walk about as (and the other players in a room),
   built to a 5 ft 10 in man's proportions and jointed like one, and the inside
   of the heavyweight coaches you ride in.
   Person frame: the soles on y = 0, facing +Z, +X to his left.
   Every piece of him overlaps the piece it hangs from, so however he is posed
   nothing comes apart, and the pose is put down so the lowest sole is on the
   ground: he never floats or sinks.
   ========================================================================== */
/* a 1.78 m man. Joint heights: ankle 0.085, knee 0.515, hip 0.945, shoulder 1.44, crown 1.78 */
const PD = { ankle: 0.085, shin: 0.43, thigh: 0.43, hipX: 0.095, hips: 0.95, spine: 0.08, shY: 0.41, shX: 0.195, upper: 0.29, fore: 0.255, neck: 0.49, head: 0.145, eye: 1.66, seatHip: 0.12, r: 0.27 };
const PMAT = {};
function personMaterials(shirt) {
  const key = 'p' + shirt;
  if (PMAT[key]) return PMAT[key];
  const std = (c, r = 0.85, m = 0, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...extra });
  if (!PMAT.hickory) {
    // hickory stripe: the ticking railroaders' caps and jackets were made of, thin navy stripes on off-white
    PMAT.hickory = canvasTex(64, 16, (g, w, h) => { g.fillStyle = '#d9dcdf'; g.fillRect(0, 0, w, h); g.fillStyle = '#26354f'; for (let x = 0; x < w; x += 8) g.fillRect(x, 0, 3, h); }, { repeat: true });
    PMAT.hickory.repeat.set(9, 1);
    PMAT.denim = canvasTex(64, 64, (g, w, h) => { const r = rng(1873); g.fillStyle = '#34496b'; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { const v = r(); g.fillStyle = v < 0.5 ? 'rgba(20,30,50,0.25)' : 'rgba(140,160,190,0.18)'; g.fillRect(r() * w, r() * h, 1, 2 + r() * 3); } }, { repeat: true });
    PMAT.denim.repeat.set(3, 3);
  }
  const M0 = {
    skin: std(0xc99878, 0.62), shirt: std(shirt, 0.9), denim: std(0xffffff, 0.92, 0, { map: PMAT.denim }), cap: std(0xffffff, 0.88, 0, { map: PMAT.hickory }),
    boot: std(0x2b1e15, 0.55, 0.05), sole: std(0x15110e, 0.8), glove: std(0x8d6a43, 0.7), hair: std(0x3a2a1e, 0.8), eye: std(0x1c1a18, 0.3),
    lip: std(0xa9705e, 0.6), red: std(0xa3231d, 0.85), brass: std(0xc9a24e, 0.4, 0.8),
  };
  for (const k in M0) M0[k].userData.person = true;
  return (PMAT[key] = M0);
}
/* a rounded limb hanging from its joint at the origin down to -len: r0 at the joint, r1 at the far end */
function limbGeo(r0, r1, len, seg = 12) {
  const pts = [], n = 4;
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + i / n * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(0, Math.cos(a) * r1), -len + Math.sin(a) * r1)); }
  for (let i = 1; i <= n; i++) { const a = i / n * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(0, Math.cos(a) * r0), Math.sin(a) * r0)); }
  return new THREE.LatheGeometry(pts, seg);
}
/* a body section turned from a profile of [radius, y], flattened front to back by zs */
function turned(prof, zs, seg = 18, phi0 = 0, phiL = TAU) {
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), seg, phi0, phiL);
  g.scale(1, 1, zs);
  return g;
}
const TORSO = [[0.0, -0.11], [0.12, -0.105], [0.142, -0.06], [0.146, 0.04], [0.143, 0.12], [0.156, 0.2], [0.174, 0.29], [0.181, 0.35], [0.172, 0.41], [0.14, 0.455], [0.085, 0.485], [0.0, 0.5]];
const TORSO_ZS = 0.64;
const torsoR = y => { for (let i = 1; i < TORSO.length; i++) if (y <= TORSO[i][1]) { const [r0, y0] = TORSO[i - 1], [r1, y1] = TORSO[i]; return lerp(r0, r1, (y - y0) / (y1 - y0)); } return 0; };
/* a point on the torso's surface at height y, x across, on the front (side 1) or back (-1), lifted out by lift */
const torsoAt = (x, y, side, lift = 0.006) => { const r = torsoR(y) + lift; return [x, y, side * TORSO_ZS * Math.sqrt(Math.max(0, r * r - x * x))]; };

/* Build a person. opts.shirt: shirt colour (other players wear their own colour). Returns the rig:
   { root, j: joints, soles, pose(state) } */
function buildPerson(opts = {}) {
  const mt = personMaterials(opts.shirt || 0x5f7896);
  const root = new THREE.Group(); root.name = 'person';
  const joint = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const hull = [];
  const put = (parent, bin) => { const g = bin.build(mt); g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); parent.add(g); hull.push([parent, personHull(g)]); return g; };
  const hips = joint(root, 0, PD.hips, 0), spine = joint(hips, 0, PD.spine, 0), neck = joint(spine, 0, PD.neck, 0), head = joint(neck, 0, PD.head, 0);
  const j = { hips, spine, neck, head, sh: [], el: [], wr: [], hip: [], kn: [], an: [] };
  // pelvis, in the overalls
  { const b = new GeoBin(); b.add('denim', turned([[0.0, -0.14], [0.1, -0.135], [0.152, -0.09], [0.165, -0.01], [0.158, 0.06], [0.14, 0.11]], 0.72)); put(hips, b); }
  // the torso: a chambray shirt, the overalls up to the waist and the bib over the chest, braces over the shoulders
  {
    const b = new GeoBin();
    b.add('shirt', turned(TORSO, TORSO_ZS));
    b.add('denim', turned(TORSO.filter(p => p[1] <= 0.24).concat([[torsoR(0.24), 0.24]]).map(([r, y]) => [r && r * 1.035, y]), TORSO_ZS));
    b.add('denim', turned([[torsoR(0.2) * 1.04, 0.2], [torsoR(0.3) * 1.04, 0.3], [torsoR(0.37) * 1.035, 0.37]], TORSO_ZS, 12, -0.62, 1.24));
    b.add('denim', turned([[torsoR(0.2) * 1.04, 0.2], [torsoR(0.27) * 1.04, 0.27]], TORSO_ZS, 12, Math.PI - 0.7, 1.4));
    for (const s of [-1, 1]) {
      const x0 = s * 0.075, pts = [torsoAt(x0, 0.365, 1, 0.012), torsoAt(s * 0.1, 0.43, 1, 0.012), [s * 0.11, 0.495, 0.0], torsoAt(s * 0.1, 0.43, -1, 0.012), torsoAt(s * 0.06, 0.3, -1, 0.012), torsoAt(s * 0.02, 0.24, -1, 0.012)];
      b.tube('denim', pts, 0.008, 18, 4);
      b.add('brass', new THREE.SphereGeometry(0.011, 8, 6).translate(...torsoAt(x0, 0.355, 1, 0.014)));
    }
    // the shoulders' round, so an arm swung any way still meets the body
    for (const s of [-1, 1]) b.add('shirt', new THREE.SphereGeometry(0.068, 14, 10).translate(s * PD.shX, PD.shY, 0));
    // a red bandana round the neck, knotted at the front
    b.add('red', new THREE.TorusGeometry(0.058, 0.017, 6, 18).rotateX(Math.PI / 2).translate(0, 0.475, 0));
    b.add('red', new THREE.ConeGeometry(0.03, 0.07, 4).rotateX(Math.PI).translate(0, 0.43, 0.06));
    put(spine, b);
  }
  // neck and head: face, ears, hair under an engineer's cap of hickory stripe
  { const b = new GeoBin(); b.add('skin', new THREE.CylinderGeometry(0.05, 0.055, 0.15, 12).translate(0, 0.045, 0)); put(neck, b); }
  {
    const b = new GeoBin(), sx = 0.78, sy = 1.15, sz = 0.98;
    b.add('skin', new THREE.SphereGeometry(0.1, 22, 16).scale(sx, sy, sz));
    b.add('skin', new THREE.SphereGeometry(0.019, 8, 6).scale(0.8, 1.3, 1).translate(0, -0.012, 0.096));         // nose
    for (const s of [-1, 1]) {
      b.add('skin', new THREE.SphereGeometry(0.026, 8, 6).scale(0.35, 1, 0.7).translate(s * 0.077, -0.005, -0.005));   // ears
      b.add('eye', new THREE.SphereGeometry(0.011, 8, 6).translate(s * 0.032, 0.018, 0.083));                        // eyes
      b.add('hair', new THREE.BoxGeometry(0.03, 0.007, 0.012).translate(s * 0.033, 0.038, 0.088));                  // brows
    }
    b.add('lip', new THREE.BoxGeometry(0.036, 0.008, 0.012).translate(0, -0.05, 0.085));
    b.add('hair', new THREE.SphereGeometry(0.103, 18, 8, Math.PI, Math.PI, 0.3 * Math.PI, 0.32 * Math.PI).scale(sx, sy, sz));   // back of the head under the cap
    // the cap: a soft crown, a puffed top and a short peak
    b.add('cap', new THREE.CylinderGeometry(0.094, 0.088, 0.075, 22).scale(1, 1, 1.13).translate(0, 0.098, 0));
    b.add('cap', new THREE.SphereGeometry(0.095, 22, 6, 0, TAU, 0, Math.PI / 2).scale(1, 0.38, 1.13).translate(0, 0.133, 0));
    b.add('cap', new THREE.CylinderGeometry(0.105, 0.105, 0.008, 22, 1, false, -1.15, 2.3).scale(1, 1, 0.82).rotateX(0.16).translate(0, 0.066, 0.035));
    put(head, b);
  }
  // arms: shirt sleeves to the leather work gloves
  for (const s of [1, -1]) {
    const sh = joint(spine, s * PD.shX, PD.shY, 0), el = joint(sh, 0, -PD.upper, 0), wr = joint(el, 0, -PD.fore, 0);
    { const b = new GeoBin(); b.add('shirt', limbGeo(0.056, 0.047, PD.upper)); put(sh, b); }
    { const b = new GeoBin(); b.add('shirt', limbGeo(0.047, 0.038, PD.fore)); put(el, b); }
    {
      const b = new GeoBin();
      b.add('glove', new THREE.CylinderGeometry(0.044, 0.04, 0.06, 12).translate(0, -0.005, 0));                    // gauntlet over the cuff
      b.add('glove', new THREE.SphereGeometry(0.05, 12, 10).scale(0.6, 1.75, 1.0).translate(0, -0.085, 0.005));      // hand and fingers
      b.add('glove', limbGeo(0.016, 0.014, 0.05, 8).rotateX(-0.6).rotateZ(-s * 0.35).translate(0, -0.05, 0.035));  // thumb
      put(wr, b);
    }
    j.sh.push(sh); j.el.push(el); j.wr.push(wr);
  }
  // legs: overalls to the boots
  const soles = [];
  for (const s of [1, -1]) {
    const hp = joint(hips, s * PD.hipX, -0.005, 0), kn = joint(hp, 0, -PD.thigh, 0), an = joint(kn, 0, -PD.shin, 0);
    { const b = new GeoBin(); b.add('denim', limbGeo(0.086, 0.063, PD.thigh)); put(hp, b); }
    { const b = new GeoBin(); b.add('denim', limbGeo(0.063, 0.05, PD.shin)); b.add('denim', new THREE.CylinderGeometry(0.066, 0.064, 0.05, 14).translate(0, -PD.shin + 0.08, 0)); put(kn, b); }
    {
      const b = new GeoBin(), y0 = -PD.ankle;
      b.add('boot', new THREE.CylinderGeometry(0.058, 0.062, 0.15, 14).translate(0, 0.02, -0.005));              // the shaft round the ankle
      b.add('boot', new THREE.BoxGeometry(0.1, 0.07, 0.2).translate(0, y0 + 0.022 + 0.035, 0.045));               // the vamp
      b.add('boot', new THREE.SphereGeometry(0.05, 12, 8, 0, TAU, 0, Math.PI / 2).scale(1, 0.9, 1.15).translate(0, y0 + 0.022, 0.145));   // toe cap
      b.add('sole', new THREE.BoxGeometry(0.108, 0.022, 0.29).translate(0, y0 + 0.011, 0.045));                   // sole and heel
      put(an, b);
      for (const z of [-0.1, 0.19]) for (const x of [-0.05, 0.05]) { const o = new THREE.Object3D(); o.position.set(x, y0, z); an.add(o); soles.push(o); }
    }
    j.hip.push(hp); j.kn.push(kn); j.an.push(an);
  }
  const rig = { root, j, soles, hull, shirt: opts.shirt, _inv: new THREE.Matrix4(), _p: new THREE.Vector3() };
  rig.pose = st => posePerson(rig, st);
  posePerson(rig, {});
  return rig;
}
/* Pose the rig. st: { phase (radians through the two-step cycle), speed m/s, sit (seat height over the
   floor, or 0), wave (seconds since the wave began, or <0), look (head pitch) } */
function posePerson(rig, st) {
  const j = rig.j, sp = st.speed || 0, a = clamp(sp / 1.3, 0, 1), rk = smooth(1.9, 3.4, sp), ph = st.phase || 0;
  const zero = o => o.rotation.set(0, 0, 0);
  for (const k of ['sh', 'el', 'wr', 'hip', 'kn', 'an']) j[k].forEach(zero);
  zero(j.hips); zero(j.spine); zero(j.neck); zero(j.head);
  if (st.sit) {
    for (let s = 0; s < 2; s++) {
      j.hip[s].rotation.set(-1.56, 0, (s ? -1 : 1) * 0.04); j.kn[s].rotation.x = 1.56; j.an[s].rotation.x = -0.02;
      j.sh[s].rotation.set(-0.3, 0, (s ? -1 : 1) * 0.1); j.el[s].rotation.x = -1.0;
    }
    j.spine.rotation.x = -0.06; j.neck.rotation.x = 0.06 + (st.look || 0) * 0.4;
    j.hips.position.y = st.sit + PD.seatHip;
  } else {
    const A = lerp(0.4, 0.74, rk) * a;
    for (let s = 0; s < 2; s++) {
      const p = ph + s * Math.PI, th = A * Math.sin(p), sw = Math.max(0, Math.cos(p));
      const kn = a * (0.07 + lerp(0.9, 1.75, rk) * Math.pow(sw, 1.6)) + a * 0.1 * Math.max(0, -Math.cos(p)) * (1 - rk);
      j.hip[s].rotation.set(-th, 0, (s ? -1 : 1) * 0.02);
      j.kn[s].rotation.x = kn;
      j.an[s].rotation.x = (th - kn) * 0.8;
      const arm = -0.8 * A * Math.sin(p);
      j.sh[s].rotation.set(-arm, 0, (s ? -1 : 1) * (0.07 + 0.05 * rk));
      j.el[s].rotation.x = -(0.12 + 0.25 * a + 1.15 * rk);
    }
    j.hips.rotation.y = 0.08 * a * Math.sin(ph);
    j.spine.rotation.y = -0.13 * a * Math.sin(ph);
    j.spine.rotation.x = 0.04 * a + 0.14 * rk;
    // breathing while he stands
    j.spine.rotation.x += (1 - a) * 0.012 * Math.sin((st.t || 0) * 1.7);
    j.neck.rotation.x = -j.spine.rotation.x * 0.7 + (st.look || 0) * 0.35;
    j.hips.position.y = PD.hips;
  }
  // in the air off a moving train: knees up to take the landing, arms out for balance
  if (st.air > 0) {
    const k = st.air;
    for (let s = 0; s < 2; s++) {
      const sg = s ? -1 : 1;
      j.hip[s].rotation.x = lerp(j.hip[s].rotation.x, -0.55 + (s ? 0.25 : -0.1), k); j.kn[s].rotation.x = lerp(j.kn[s].rotation.x, 0.85 + (s ? 0.2 : 0), k);
      j.an[s].rotation.x = lerp(j.an[s].rotation.x, -0.2, k);
      j.sh[s].rotation.set(lerp(j.sh[s].rotation.x, -0.5, k), 0, lerp(j.sh[s].rotation.z, sg * 1.15, k)); j.el[s].rotation.x = lerp(j.el[s].rotation.x, -0.5, k);
    }
    j.spine.rotation.x = lerp(j.spine.rotation.x, 0.18, k);
  }
  // running it out after a jump: thrown forward, arms flung out ahead
  if (st.flail > 0) {
    const k = st.flail, ph = st.phase || 0;
    for (let s = 0; s < 2; s++) { const sg = s ? -1 : 1; j.sh[s].rotation.set(lerp(j.sh[s].rotation.x, -1.3 - 0.45 * Math.sin(ph * 1.7 + s * 2), k), 0, lerp(j.sh[s].rotation.z, sg * 0.75, k)); j.el[s].rotation.x = lerp(j.el[s].rotation.x, -0.35, k); }
    j.spine.rotation.x += 0.3 * k; j.neck.rotation.x -= 0.25 * k;
  }
  // tucked into a ball to roll: knees to the chest, chin down, arms wrapped round the shins
  if (st.tuck > 0) {
    const k = st.tuck;
    for (let s = 0; s < 2; s++) {
      const sg = s ? -1 : 1;
      j.hip[s].rotation.set(lerp(j.hip[s].rotation.x, -2.05, k), 0, lerp(j.hip[s].rotation.z, sg * 0.12, k));
      j.kn[s].rotation.x = lerp(j.kn[s].rotation.x, 2.3, k); j.an[s].rotation.x = lerp(j.an[s].rotation.x, 0.35, k);
      j.sh[s].rotation.set(lerp(j.sh[s].rotation.x, -1.15, k), 0, lerp(j.sh[s].rotation.z, sg * 0.25, k)); j.el[s].rotation.x = lerp(j.el[s].rotation.x, -1.75, k);
    }
    j.spine.rotation.x = lerp(j.spine.rotation.x, 0.62, k); j.neck.rotation.x = lerp(j.neck.rotation.x, 0.5, k);
  }
  if (st.wave !== undefined && st.wave >= 0) {
    const w = st.wave, up = smooth(0, 0.35, w) * (1 - smooth(2.2, 2.7, w));
    j.sh[1].rotation.set(-0.35 * up, 0, -2.55 * up - 0.07);
    j.el[1].rotation.set(0, 0, -(0.25 + 0.45 * Math.sin(w * 9)) * up);
  }
  // stand him on his lowest sole (a man tumbling is put down by the whole of him instead: personLow)
  if (!st.sit && !st.free) {
    rig.root.updateMatrixWorld(true);
    rig._inv.copy(rig.root.matrixWorld).invert();
    let lo = Infinity;
    for (const o of rig.soles) { rig._p.setFromMatrixPosition(o.matrixWorld).applyMatrix4(rig._inv); if (rig._p.y < lo) lo = rig._p.y; }
    j.hips.position.y -= lo;
  }
}

/* the outermost points of a piece of him, in its joint's frame: the farthest vertex each way of 96 directions,
   so the lowest of him however he lies can be found from a few hundred points, not every vertex */
const PHULL_D = (() => { const d = [], n = 96, ga = Math.PI * (3 - Math.sqrt(5)); for (let i = 0; i < n; i++) { const y = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(1 - y * y); d.push([Math.cos(ga * i) * r, y, Math.sin(ga * i) * r]); } return d; })();
function personHull(g) {
  const best = PHULL_D.map(() => [-Infinity, 0, 0, 0]), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), m = new THREE.Matrix4();
  g.traverse(o => {
    if (!o.isMesh) return;
    m.multiplyMatrices(inv, o.matrixWorld).premultiply(g.matrix);
    const a = o.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) {
      v.set(a.getX(i), a.getY(i), a.getZ(i)).applyMatrix4(m);
      for (let k = 0; k < PHULL_D.length; k++) { const d = PHULL_D[k], e = v.x * d[0] + v.y * d[1] + v.z * d[2]; if (e > best[k][0]) best[k] = [e, v.x, v.y, v.z]; }
    }
  });
  const out = []; for (const b of best) if (b[0] > -Infinity) out.push(b[1], b[2], b[3]);
  return new Float32Array(out);
}
/* the lowest point of the posed man in the world. The rig's matrices must be up to date. */
function personLow(rig) {
  let lo = Infinity;
  for (const [o, P] of rig.hull) {
    const e = o.matrixWorld.elements;
    for (let i = 0; i < P.length; i += 3) { const y = e[1] * P[i] + e[5] * P[i + 1] + e[9] * P[i + 2] + e[13]; if (y < lo) lo = y; }
  }
  return lo;
}

/* ======== off a moving train ========
   He leaves the step with the train's speed. Landing slower than a brisk walk he just steps down; up to a fast
   run he runs it out, arms flung forward, until he has his feet; faster than that (or dropping hard) he goes down,
   tucks and rolls along the way he was going, ends up sprawled on his front or his back, lies a moment, and gets
   up. On the ground he is slowed by his feet or by the ground he rolls over (FALL.mu* in g). B is
   { ph: 'air'|'land'|'stumble'|'roll'|'lie'|'up', v: horizontal velocity {x, z}, th: forward roll angle (0 on his
   feet, pi/2 face down, 3pi/2 on his back), tuck, t: time in this phase, hit: speed he hit the ground at }. */
const FALL = { run: 2.4, roll: 5.4, hard: -7.5, muRun: 0.42, muRoll: 0.58, R: 0.5, lie: 0.9, up: 1.35, free: 1.25 };
function fallLand(B, vy) {
  const u = Math.hypot(B.v.x, B.v.z);
  B.hit = Math.hypot(u, vy); B.t = 0;
  B.ph = u >= FALL.roll || vy < FALL.hard ? 'roll' : u >= FALL.run ? 'stumble' : 'land';
  return B.ph;
}
/* one step on the ground; returns true once he has his feet again and is his own man */
function fallStep(B, dt) {
  B.t += dt;
  const u = Math.hypot(B.v.x, B.v.z), slow = (mu) => { const k = u > 1e-6 ? Math.max(0, u - mu * 9.81 * dt) / u : 0; B.v.x *= k; B.v.z *= k; };
  switch (B.ph) {
    case 'air': return false;
    case 'land': slow(0.8); B.tuck = Math.max(0, B.tuck - dt * 4); return B.t > 0.3;
    case 'stumble': slow(FALL.muRun); B.tuck = 0; return u < FALL.free;
    case 'roll': {
      // the roll turns over at the speed he goes along the ground, as a ball of his size would
      B.tuck = Math.min(1, B.tuck + dt * 6);
      slow(FALL.muRoll);
      B.th += Math.max(u, 2.2) / FALL.R * dt;
      if (u < 1.0) {
        // the roll runs out: he goes down flat on whichever is next, front or back
        B.ph = 'flop'; B.t = 0; B.th0 = B.th; B.th1 = Math.PI / 2 + Math.ceil((B.th - Math.PI / 2) / Math.PI) * Math.PI;
      }
      return false;
    }
    case 'flop': {
      slow(1.2);
      const k = Math.min(1, B.t / 0.35);
      B.th = lerp(B.th0, B.th1, 1 - (1 - k) * (1 - k)); B.tuck = Math.max(0, B.tuck - dt * 4);
      if (k >= 1) { B.ph = 'lie'; B.t = 0; B.v.x = B.v.z = 0; }
      return false;
    }
    case 'lie': {
      B.tuck = Math.max(0, B.tuck - dt * 3);
      if (B.t > FALL.lie + clamp((B.hit - 8) * 0.05, 0, 1.2)) {
        // up from his front by pushing back onto his knees; from his back by sitting up and coming forward
        B.ph = 'up'; B.t = 0; B.th0 = B.th; const back = ((B.th % TAU) + TAU) % TAU > Math.PI;
        B.th1 = back ? Math.ceil(B.th / TAU - 1e-6) * TAU : Math.floor(B.th / TAU + 1e-6) * TAU;
      }
      return false;
    }
    case 'up': {
      const k = Math.min(1, B.t / FALL.up), e = k * k * (3 - 2 * k);
      B.th = lerp(B.th0, B.th1, e); B.tuck = 0.85 * Math.sin(Math.PI * Math.min(1, k * 1.1));
      if (k >= 1) { B.th = 0; B.tuck = 0; return true; }
      return false;
    }
  }
  return true;
}

/* ======== inside a heavyweight coach ========
   Mahogany panelling below the windows with raised panels and a heater duct along the floor, piers between the
   windows, a cream frieze, and a cream ceiling following the lower deck and the clerestory, ribbed at every window
   pair, with the frosted deck sash along the clerestory. A patterned carpet with a runner down the aisle. 13 rows
   of green plush walkover seats two and two with the aisle between (52 seats, one row to each pair of windows):
   cast end standards, a cushion and a channel-tufted back for each passenger with a head roll and a small linen
   cover, padded armrests and a brass grab handle at the aisle. Cased windows with roller shades, brass parcel racks
   with a few bags on them, glass bowl lamps down the clerestory that really light the car (saloonLight below), and
   a bulkhead at each end with a doorway into the lit vestibule, a mirror and a water cooler.
   Built in the coach's own frame (06_models.js CH). Every coach carries one (coachModel). */
const COACH_IN = { hi: CH.hw - 0.085, aisle: 0.34, seatH: 0.43, seatW: 1.02, rowFwd: 1 };
COACH_IN.yF = CH.yT + 0.03;
/* the lamps: one bowl over every other window pair down the clerestory, and one in each vestibule's ceiling */
const SAL = (() => {
  const yL = CH.eave + 0.5, L = coachPairs().filter((x, i) => i % 2 === 0).map(x => new THREE.Vector3(x + 0.04, yL, 0));
  const xv = (CH.xb + CH.xv) / 2;
  L.push(new THREE.Vector3(xv, CH.eave - 0.12, 0), new THREE.Vector3(-xv, CH.eave - 0.12, 0));
  return { yL, L, n: L.length, I: { value: 1 }, C: { value: new THREE.Color(0xffd7a3).convertSRGBToLinear() }, amb: { value: 0.1 }, glow: { value: 0 } };
})();
/* Lit from the coach's own lamps, worked out per pixel in the coach's frame (the saloon's geometry is in it, so
   position is coach-local): each lamp lights what faces it, falling off with distance, a little less low down where
   the seats shade the floor, plus a warm bounce off the cream ceiling. No wrap round edges, so the outside of the
   car (facing away from every lamp) is never lit from in here. */
function saloonLight(m) {
  m.onBeforeCompile = sh => {
    sh.uniforms.salL = { value: SAL.L }; sh.uniforms.salI = SAL.I; sh.uniforms.salC = SAL.C; sh.uniforms.salAmb = SAL.amb;
    sh.vertexShader = 'varying vec3 vSalP;\nvarying vec3 vSalN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vSalP = position; vSalN = objectNormal;');
    sh.fragmentShader = `#define SAL_N ${SAL.n}\nvarying vec3 vSalP;\nvarying vec3 vSalN;\nuniform vec3 salL[ SAL_N ];\nuniform float salI;\nuniform vec3 salC;\nuniform float salAmb;\n` +
      sh.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  {
    vec3 sn = normalize( vSalN );
    #ifdef FLIP_SIDED
      sn = - sn;
    #endif
    #ifdef DOUBLE_SIDED
      sn *= gl_FrontFacing ? 1.0 : - 1.0;
    #endif
    float sal = 0.0;
    for ( int i = 0; i < SAL_N; i ++ ) {
      vec3 lv = salL[ i ] - vSalP; float d2 = dot( lv, lv );
      sal += max( dot( sn, lv ) * inversesqrt( d2 ), 0.0 ) / ( 0.35 + d2 * 0.5 );
    }
    float low = smoothstep( ${(COACH_IN.yF + 0.05).toFixed(3)}, ${(COACH_IN.yF + 1.0).toFixed(3)}, vSalP.y );
    float up = 0.5 + 0.5 * max( sn.y, 0.0 ) + 0.35 * max( - sn.y, 0.0 );
    vec3 salLit = salC * salI * ( sal * mix( 0.55, 1.0, low ) + salAmb * up * mix( 0.6, 1.0, low ) );
    reflectedLight.indirectDiffuse += salLit * material.diffuseColor;
    reflectedLight.indirectSpecular += salLit * material.specularColor * 0.3;
  }`);
  };
  m.customProgramCacheKey = () => 'saloon';
  return m;
}
/* fine repeating textures, drawn once: wood grain, plush pile, the carpet and runner, the heater grille */
function ciTex(name, w, h, draw, rx, ry) {
  const t = canvasTex(w, h, draw, { repeat: true }); t.repeat.set(rx, ry); return t;
}
function coachInMaterials() {
  if (RMAT.ciWood) return;
  const lit = (c, r = 0.7, m = 0, extra = {}) => { const x = saloonLight(new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...extra })); x.userData.noSnow = true; (RMAT.ciLit || (RMAT.ciLit = [])).push(x); return x; };
  const r = rng(7710);
  const grain = ciTex('grain', 256, 256, (g, w, h) => {
    g.fillStyle = '#b07a52'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { const y = r() * h, a = 0.05 + r() * 0.12, dk = r() < 0.6; g.strokeStyle = dk ? `rgba(60,25,10,${a})` : `rgba(230,170,120,${a})`; g.lineWidth = 0.6 + r() * 2.2; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.03 + i) * 2.5 + (r() - 0.5)); g.stroke(); }
  }, 1, 1);
  const pile = ciTex('pile', 128, 128, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const v = 200 + r() * 55 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
  }, 6, 6);
  const carpet = ciTex('carpet', 128, 128, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(70,40,20,0.35)'; g.lineWidth = 3;
    for (const [x, y] of [[32, 32], [96, 96]]) { g.beginPath(); g.moveTo(x, y - 18); g.lineTo(x + 18, y); g.lineTo(x, y + 18); g.lineTo(x - 18, y); g.closePath(); g.stroke(); g.fillStyle = 'rgba(200,150,80,0.45)'; g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill(); }
    for (let i = 0; i < 1400; i++) { const v = 205 + r() * 50 | 0; g.fillStyle = `rgba(${v},${v},${v},0.6)`; g.fillRect(r() * w, r() * h, 1, 1); }
  }, 60, 8);
  const runner = ciTex('runner', 64, 128, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(200,160,90,0.8)'; g.fillRect(0, 6, w, 5); g.fillRect(0, h - 11, w, 5);
    g.fillStyle = 'rgba(40,20,10,0.35)'; for (let x = 0; x < w; x += 16) { g.beginPath(); g.moveTo(x, 40); g.lineTo(x + 8, 64); g.lineTo(x, 88); g.lineTo(x - 8, 64); g.closePath(); g.fill(); }
  }, 30, 1);
  const grille = ciTex('grille', 64, 32, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#202020'; for (let x = 2; x < w; x += 6) g.fillRect(x, 6, 3, h - 12);
  }, 80, 1);
  RMAT.ciWood = lit(0x6a3a22, 0.42, 0, { map: grain });
  RMAT.ciWoodDk = lit(0x3e2114, 0.38, 0, { map: grain });
  RMAT.ciCeil = lit(0xeee3c6, 0.85, 0, { side: THREE.BackSide });
  RMAT.ciCream = lit(0xe6dbbd, 0.8);
  RMAT.ciRib = lit(0xc8b88e, 0.5, 0.35);
  RMAT.ciCarpet = lit(0x6a2020, 0.97, 0, { map: carpet });
  RMAT.ciRunner = lit(0x4a1414, 0.97, 0, { map: runner });
  RMAT.ciPlush = lit(0x2f5a3c, 0.93, 0, { map: pile });
  RMAT.ciPlushDk = lit(0x1f3d29, 0.95, 0, { map: pile });
  RMAT.ciCover = lit(0xd9cfb4, 0.95);
  RMAT.ciLeather = lit(0x3b2416, 0.5);
  RMAT.ciFrame = lit(0x2c2724, 0.45, 0.5);
  RMAT.ciBrass = lit(0xc9a252, 0.3, 0.85);
  RMAT.ciHeat = lit(0x8a8378, 0.6, 0.4, { map: grille });
  RMAT.ciShade = lit(0xcdb88c, 0.9, 0, { side: THREE.DoubleSide, emissive: 0xffc88a, emissiveIntensity: 0 });
  RMAT.ciMirror = lit(0xaab4b8, 0.08, 0.6);
  RMAT.ciCase = lit(0x5a3a22, 0.55);
  RMAT.ciCase2 = lit(0x8a6a44, 0.6);
  RMAT.ciCase3 = lit(0x24324a, 0.6);
  RMAT.ciDeck = lit(0xc9b98e, 0.5, 0, { emissive: 0xfff0d0, emissiveIntensity: 0.3 });
  RMAT.ciPane = lit(0x1c252b, 0.12, 0.4);
  // the lamps' frosted bowls and the bulbs glowing through them
  RMAT.ciLamp = new THREE.MeshStandardMaterial({ color: 0xfff3dc, emissive: 0xffd9a0, emissiveIntensity: 1.6, roughness: 0.4 });
  RMAT.ciLamp.userData.noSnow = true;
  // the glass of a coach you can see into: clear, a little tinted, still catching the light
  RMAT.ciGlass = new THREE.MeshStandardMaterial({ color: 0x9fb2b8, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.2, depthWrite: false });
  for (const k of ['ciLamp', 'ciGlass']) RMAT[k].userData.noShadow = true;
}
/* the seats in a coach: centre of each place on its cushion, in the coach's frame (all face +X) */
function coachSeats() {
  const out = [], z0 = COACH_IN.aisle + COACH_IN.seatW / 4, z1 = COACH_IN.aisle + COACH_IN.seatW * 3 / 4;
  for (const x of coachPairs()) for (const z of [-z1, -z0, z0, z1]) out.push({ x: x + 0.04, z, h: COACH_IN.seatH });
  return out;
}
/* the side of a seat's cast end standard, in x (forward) and y (up from the floor) */
function seatStandardGeo(sh) {
  const s = new THREE.Shape(), t = sh - 0.13, a = sh + 0.19;
  s.moveTo(-0.26, 0); s.lineTo(0.25, 0); s.lineTo(0.25, 0.03); s.quadraticCurveTo(0.08, 0.05, 0.055, 0.16); s.lineTo(0.055, t);
  s.lineTo(0.2, t); s.quadraticCurveTo(0.235, t + 0.03, 0.225, a); s.lineTo(0.165, a); s.lineTo(0.165, t + 0.06); s.lineTo(-0.12, t + 0.06);
  s.lineTo(-0.15, a); s.lineTo(-0.205, a); s.lineTo(-0.18, t); s.lineTo(-0.055, t); s.lineTo(-0.055, 0.16); s.quadraticCurveTo(-0.08, 0.05, -0.26, 0.03); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: false, curveSegments: 4 }); g.translate(0, 0, -0.0175);
  return g;
}
/* a walkover seat for two at (xs, zc) facing +x, the aisle on side -s (toward z = 0) */
function walkoverSeat(b, xs, zc, s, yF) {
  const sw = COACH_IN.seatW, sh = COACH_IN.seatH, ze = sw / 2 - 0.025, half = (sw - 0.08) / 2;
  const std = seatStandardGeo(sh);
  for (const e of [-1, 1]) {
    const z = zc + e * ze;
    b.add('ciFrame', std.clone(), M(xs, yF, z));
    b.add('ciLeather', cushionGeo(0.44, 0.05, 0.075, 0.022), M(xs + 0.01, yF + sh + 0.19 + 0.022, z));       // padded armrest
  }
  b.box('ciFrame', 0.05, 0.05, 2 * ze, xs + 0.18, yF + sh - 0.13 + 0.025, zc);                                    // front rail
  b.box('ciFrame', 0.05, 0.05, 2 * ze, xs - 0.13, yF + sh - 0.13 + 0.025, zc);                                    // back rail
  b.box('ciFrame', 0.04, 0.04, 2 * ze, xs + 0.03, yF + 0.11, zc);                                                 // stretcher between the legs
  // the cushions, one each, with a rolled front edge
  for (const e of [-1, 1]) {
    const z = zc + e * (half / 2 + 0.004);
    b.add('ciPlush', cushionGeo(0.5, 0.13, half, 0.05), M(xs + 0.02, yF + sh - 0.065, z));
    b.add('ciPlushDk', new THREE.CylinderGeometry(0.035, 0.035, half - 0.06, 10).rotateX(Math.PI / 2), M(xs + 0.245, yF + sh - 0.05, z));
  }
  // the backs: leaning 11 degrees on their walkover arms, channel tufted, a head roll and a linen cover on each
  const lean = 0.2, P = (lx, ly) => [xs - 0.2 + lx * Math.cos(lean) - ly * Math.sin(lean), yF + sh - 0.05 + lx * Math.sin(lean) + ly * Math.cos(lean)];
  const B = (k, geo, lx, ly, z) => { const [x, y] = P(lx, ly); b.add(k, geo, M(x, y, z, 0, 0, lean)); };
  for (const e of [-1, 1]) {
    const z = zc + e * (half / 2 + 0.004);
    B('ciPlush', cushionGeo(0.13, 0.6, half, 0.05), 0, 0.3, z);
    for (const d of [-0.13, -0.045, 0.045, 0.13]) B('ciPlushDk', new THREE.BoxGeometry(0.012, 0.46, 0.012), 0.064, 0.29, z + d);   // channels
    B('ciPlush', cushionGeo(0.17, 0.14, half - 0.01, 0.06), 0.015, 0.62, z);                                                    // head roll
    B('ciCover', cushionGeo(0.012, 0.17, half - 0.12, 0.005), 0.104, 0.61, z);                                                  // its cover, in front
    B('ciCover', cushionGeo(0.07, 0.012, half - 0.12, 0.005), 0.07, 0.695, z);                                                  // and folded over the top
  }
  // walkover arms from the standards up to the backs
  for (const e of [-1, 1]) { const z = zc + e * (ze - 0.035), [x1, y1] = P(-0.02, 0.32); b.add('ciFrame', barGeo(0.016, [xs - 0.16, yF + sh - 0.1, z], [x1, y1, z], 6)); }
  // a brass grab handle on the aisle corner of the back
  { const za = zc - s * (sw / 2 - 0.07), [x0, y0] = P(-0.07, 0.62), [x1, y1] = P(-0.07, 0.48), [xm, ym] = P(-0.14, 0.55);
    b.tube('ciBrass', [[x0, y0, za], [xm, ym, za], [x1, y1, za]], 0.011, 8, 6); }
}
/* Every coach's saloon is the same shape (one kind for an observation car), so it is built once and its merged
   geometry shared by every car after that: making up a train or the traffic no longer rebuilds hundreds of seats */
const CI_GEO = {};
function coachInterior(observation) {
  coachInMaterials();
  const key = observation ? 'obs' : 'coach';
  const geos = CI_GEO[key] || (CI_GEO[key] = coachInteriorBin(observation).merge());
  const grp = GeoBin.of(geos).build(RMAT, { cast: false });
  grp.name = 'coachInterior'; grp.userData.shared = true;
  grp.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  return grp;
}
function coachInteriorBin(observation) {
  const b = new GeoBin(), yF = COACH_IN.yF, yT = CH.yT, hi = COACH_IN.hi, xb = CH.xb, [w0, w1] = CH.win, yE = CH.eave, th = 0.03;
  const zw = hi + th / 2;   // the lining's middle; its inside face is at hi
  // floor: carpet wall to wall, the runner down the aisle
  b.box('ciCarpet', 2 * xb - 0.02, yF - yT, 2 * hi, 0, (yF + yT) / 2, 0);
  b.box('ciRunner', 2 * xb - 0.3, 0.006, 2 * COACH_IN.aisle - 0.02, 0, yF + 0.003, 0);
  // walls: panelled below the sills, piers between the windows, a frieze over them; sills, casings and sashes
  const opens = coachOpens(), x0 = -xb + 0.01, x1 = xb - 0.01, pairs = coachPairs();
  const shade = [0.06, 0.32, 0.06, 0.18, 0.5, 0.06, 0.25, 0.06, 0.06, 0.4, 0.12, 0.06, 0.3];
  for (const s of [-1, 1]) {
    b.box('ciWood', x1 - x0, w0 - yF, th, 0, (w0 + yF) / 2, s * zw);
    b.box('ciCream', x1 - x0, yE - w1, th, 0, (yE + w1) / 2, s * zw);
    let x = x0;
    for (const [a, c] of opens) { b.box('ciWood', a - x, w1 - w0, th, (a + x) / 2, (w0 + w1) / 2, s * zw); x = c; }
    b.box('ciWood', x1 - x, w1 - w0, th, (x1 + x) / 2, (w0 + w1) / 2, s * zw);
    opens.forEach(([a, c], i) => {
      const xm = (a + c) / 2, zi = s * (hi - 0.01);
      b.box('ciWoodDk', c - a + 0.08, 0.035, 0.08, xm, w0 + 0.0175, s * (hi - 0.04 + th));                    // sill
      b.box('ciWoodDk', c - a + 0.08, 0.05, 0.03, xm, w1 + 0.01, zi);                                          // head casing
      for (const e of [-1, 1]) b.box('ciWoodDk', 0.045, w1 - w0 + 0.03, 0.03, xm + e * ((c - a) / 2 + 0.0175), (w0 + w1) / 2, zi);   // side casings
      b.box('ciWoodDk', c - a, 0.03, 0.025, xm, w0 + (w1 - w0) * 0.62, s * (hi + 0.0));                       // meeting rail of the sash
      for (const e of [-1, 1]) b.box('ciBrass', 0.03, 0.025, 0.02, xm + e * 0.15, w0 + (w1 - w0) * 0.62 - 0.02, s * (hi - 0.02));   // sash lifts
      // the roller shade: its roll under the head, drawn down a little way on some windows, with a pull ring
      const roll = w1 - 0.04, Ls = shade[(i * 7 + (s > 0 ? 3 : 0)) % shade.length];
      b.add('ciWoodDk', new THREE.CylinderGeometry(0.022, 0.022, c - a + 0.02, 10).rotateZ(Math.PI / 2), M(xm, roll, s * (hi - 0.03)));
      b.box('ciShade', c - a - 0.01, Ls, 0.004, xm, roll - Ls / 2, s * (hi - 0.045));
      b.box('ciWoodDk', c - a - 0.02, 0.018, 0.014, xm, roll - Ls, s * (hi - 0.045));
      b.add('ciBrass', new THREE.TorusGeometry(0.018, 0.004, 5, 12), M(xm, roll - Ls - 0.026, s * (hi - 0.045)));
    });
    // raised panels below each window pair, and a heater duct with its grille along the floor
    for (const xp of pairs) {
      const pw = 1.08, y0 = yF + 0.22, y1 = w0 - 0.1, zp = s * (hi - 0.01);
      for (const y of [y0, y1]) b.box('ciWoodDk', pw, 0.035, 0.022, xp, y, zp);
      for (const e of [-1, 1]) b.box('ciWoodDk', 0.035, y1 - y0 + 0.035, 0.022, xp + e * pw / 2, (y0 + y1) / 2, zp);
    }
    b.box('ciHeat', x1 - x0 - 0.02, 0.15, 0.05, 0, yF + 0.075, s * (hi - 0.025));
    b.box('ciWoodDk', x1 - x0, 0.03, 0.07, 0, yF + 0.165, s * (hi - 0.035));                                       // its cap
    // coat hooks on the piers between the pairs
    for (let i = 0; i < pairs.length - 1; i++) { const xh = (pairs[i] + pairs[i + 1]) / 2; b.add('ciBrass', barGeo(0.008, [xh, w1 - 0.1, s * (hi + 0.0)], [xh, w1 - 0.16, s * (hi - 0.06)], 5)); b.add('ciBrass', new THREE.SphereGeometry(0.014, 8, 6), M(xh, w1 - 0.16, s * (hi - 0.06))); }
    // parcel rack: brass rails on brackets over the windows
    for (const z of [hi - 0.08, hi - 0.2, hi - 0.32]) b.add('ciBrass', barGeo(0.009, [x0 + 0.4, yE - 0.12, s * z], [x1 - 0.4, yE - 0.12, s * z], 6));
    b.add('ciBrass', barGeo(0.012, [x0 + 0.4, yE - 0.06, s * (hi - 0.36)], [x1 - 0.4, yE - 0.06, s * (hi - 0.36)], 6));
    for (let x = x0 + 0.5; x < x1 - 0.4; x += 1.58) {
      b.add('ciBrass', barGeo(0.01, [x, yE - 0.12, s * (hi + 0.005)], [x, yE - 0.12, s * (hi - 0.36)], 5));
      b.add('ciBrass', barGeo(0.01, [x, yE - 0.06, s * (hi - 0.36)], [x, yE - 0.12, s * (hi - 0.36)], 5));
      b.add('ciBrass', barGeo(0.01, [x, yE - 0.3, s * (hi + 0.005)], [x, yE - 0.12, s * (hi - 0.2)], 5));
    }
    // a few bags up on the rack
    const bags = s > 0 ? [[-7.2, 0.55, 0.16, 'ciCase'], [-2.9, 0.42, 0.2, 'ciCase2'], [3.4, 0.6, 0.15, 'ciCase3'], [7.9, 0.38, 0.22, 'ciCase']] : [[-5.6, 0.5, 0.17, 'ciCase2'], [0.6, 0.62, 0.15, 'ciCase'], [5.1, 0.4, 0.2, 'ciCase3']];
    for (const [xc, Lb, hb, k] of bags) {
      b.add(k, cushionGeo(Lb, hb, 0.3, 0.025), M(xc, yE - 0.111 + hb / 2, s * (hi - 0.22)));
      b.add('ciBrass', barGeo(0.007, [xc - 0.07, yE - 0.111 + hb, s * (hi - 0.37)], [xc + 0.07, yE - 0.111 + hb, s * (hi - 0.37)], 5));
    }
  }
  // the ceiling: the lower deck curving up from the wall tops to the clerestory, and its arched top (seen from below)
  const cp = coachCeilingProfile();
  {
    const sh = new THREE.Shape();
    sh.moveTo(-hi - 0.005, -0.004); sh.quadraticCurveTo(-cp.ctl, 0.2, -cp.rD, cp.hD); sh.lineTo(-cp.rD, cp.hC);
    sh.quadraticCurveTo(0, cp.cr, cp.rD, cp.hC); sh.lineTo(cp.rD, cp.hD); sh.quadraticCurveTo(cp.ctl, 0.2, hi + 0.005, -0.004); sh.closePath();
    const xe0 = -xb + 0.01, len = (xb - 0.01) - xe0;
    b.add('ciCeil', new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false, curveSegments: 12 }).rotateY(Math.PI / 2).translate(xe0, yE, 0));
    // ribs across it between the window pairs, just proud of the ceiling
    const prof = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8, q = 1 - t; prof.push([-(q * q * (hi + 0.005) + 2 * q * t * cp.ctl + t * t * cp.rD), q * q * -0.004 + 2 * q * t * 0.2 + t * t * cp.hD]); }
    prof.push([-cp.rD, cp.hC]);
    for (let i = 1; i < 12; i++) { const t = i / 12, q = 1 - t; prof.push([lerp(-cp.rD, cp.rD, t), q * q * cp.hC + 2 * q * t * cp.cr + t * t * cp.hC]); }
    for (const p of prof.slice(0, 10).reverse()) prof.push([-p[0], p[1]]);
    const inset = prof.map(([z, y]) => [z * 0.985, y - 0.012 * (1 - Math.abs(z) / (hi + 0.1))]);
    for (let i = 0; i < pairs.length - 1; i++) { const xr = (pairs[i] + pairs[i + 1]) / 2; b.tube('ciRib', inset.map(([z, y]) => [xr, yE + y, z]), 0.014, 40, 4); }
    // the deck sash: frosted panes down both clerestory walls, in their muntins
    for (const s of [-1, 1]) {
      const zd = s * (cp.rD - 0.006), y0 = yE + cp.hD + 0.03, y1 = yE + cp.hC - 0.03;
      for (let x = -xb + 0.6; x < xb - 0.5; x += 0.86) {
        b.box('ciDeck', 0.7, y1 - y0, 0.006, x + 0.35, (y0 + y1) / 2, zd);
        b.box('ciWoodDk', 0.04, y1 - y0 + 0.04, 0.02, x - 0.04, (y0 + y1) / 2, s * (cp.rD - 0.01));
      }
      b.box('ciWoodDk', 2 * xb - 0.4, 0.03, 0.02, 0, y0 - 0.015, s * (cp.rD - 0.01));
      b.box('ciWoodDk', 2 * xb - 0.4, 0.03, 0.02, 0, y1 + 0.015, s * (cp.rD - 0.01));
    }
    // the lamps: a brass ceiling rose, a short stem, a gallery and a frosted glass bowl with the bulb glowing in it
    const top = yE + 0.25 * cp.hC + 0.5 * cp.cr + 0.25 * cp.hC;
    const bowl = new THREE.LatheGeometry([[0.001, -0.2], [0.07, -0.19], [0.13, -0.15], [0.16, -0.09], [0.15, -0.03], [0.1, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 18);
    for (let i = 0; i < SAL.n - 2; i++) {
      const x = SAL.L[i].x, yb = SAL.yL + 0.1;
      b.add('ciBrass', new THREE.CylinderGeometry(0.085, 0.06, 0.03, 18), M(x, top - 0.012, 0));
      b.add('ciBrass', barGeo(0.012, [x, top - 0.02, 0], [x, yb - 0.01, 0], 8));
      b.add('ciBrass', new THREE.TorusGeometry(0.1, 0.012, 6, 18).rotateX(Math.PI / 2), M(x, yb, 0));
      b.add('ciBrass', new THREE.CylinderGeometry(0.03, 0.1, 0.04, 18), M(x, yb + 0.015, 0));
      b.add('ciLamp', bowl.clone(), M(x, yb, 0));
    }
  }
  // bulkheads: a doorway at each end into the vestibule (the observation car's lounge end is the car's own wall),
  // cased, with a mirror one side and a water cooler the other
  const dw = 0.42, dh = 2.0;
  for (const e of observation ? [1] : [1, -1]) {
    const x = e * (xb - 0.025), xf = e * (xb - 0.05);
    for (const s of [-1, 1]) b.box('ciWood', 0.05, yE - yF, hi - dw, x, (yE + yF) / 2, s * (hi + dw) / 2);
    b.box('ciWood', 0.05, yE - yF - dh, 2 * dw, x, (yE + yF + dh) / 2, 0);
    for (const s of [-1, 1]) b.box('ciWoodDk', 0.03, dh + 0.06, 0.07, xf - e * 0.01, yF + dh / 2 + 0.03, s * (dw + 0.035));   // casing
    b.box('ciWoodDk', 0.03, 0.07, 2 * dw + 0.14, xf - e * 0.01, yF + dh + 0.035, 0);
    b.box('ciBrass', 0.02, 0.18, 2 * dw, x, yF + 0.09, 0);                                                     // kick plate on the sill
    // the mirror, on the side where e and s agree, in a moulded frame
    const sm = e, zm = sm * (dw + 0.08 + (hi - dw - 0.16) / 2), wm = hi - dw - 0.24;
    b.box('ciWoodDk', 0.03, 1.0, wm + 0.08, xf - e * 0.01, yF + 1.55, zm);
    b.box('ciMirror', 0.01, 0.92, wm, xf - e * 0.03, yF + 1.55, zm);
    // the water cooler on the other side: a cabinet, the tank, the tap and a cup dispenser
    const zc = -sm * (dw + 0.08 + 0.2), xc = xf - e * 0.13;
    b.box('ciWoodDk', 0.24, 0.95, 0.36, xc, yF + 0.475, zc);
    b.box('ciBrass', 0.25, 0.03, 0.37, xc, yF + 0.965, zc);
    b.add('ciMirror', new THREE.CylinderGeometry(0.12, 0.12, 0.42, 16), M(xc + e * 0.01, yF + 0.98 + 0.21, zc));
    b.add('ciBrass', new THREE.CylinderGeometry(0.12, 0.1, 0.05, 16), M(xc + e * 0.01, yF + 1.425, zc));
    b.add('ciBrass', barGeo(0.012, [xc - e * 0.12, yF + 1.12, zc], [xc - e * 0.17, yF + 1.08, zc], 6));
    b.add('ciMirror', new THREE.CylinderGeometry(0.035, 0.035, 0.3, 10), M(xf - e * 0.03, yF + 1.32, zc - sm * 0.26));
    // the vestibule beyond: a ceiling with its lamp, the end wall lined round the end door, a tread plate floor
    const xa = e * xb, xz = e * (CH.xv - 0.035), xm = (xa + xz) / 2, lv = Math.abs(xz - xa);
    b.box('ciCream', lv, 0.012, 2 * (CH.hw - 0.07), xm, yE - 0.016, 0);
    b.add('ciLamp', new THREE.SphereGeometry(0.075, 14, 6, 0, TAU, Math.PI / 2, Math.PI / 2), M(SAL.L[SAL.n - (e > 0 ? 2 : 1)].x, yE - 0.022, 0));
    b.add('ciBrass', new THREE.TorusGeometry(0.075, 0.01, 6, 16).rotateX(Math.PI / 2), M(SAL.L[SAL.n - (e > 0 ? 2 : 1)].x, yE - 0.024, 0));
    for (const s of [-1, 1]) b.box('ciWood', 0.012, yE - yT - 0.02, CH.hw - 0.07 - 0.43, xz - e * 0.006, (yE - 0.02 + yT) / 2, s * (0.43 + (CH.hw - 0.07 - 0.43) / 2));
    b.box('ciWood', 0.012, yE - 3.1 - 0.02, 0.86, xz - e * 0.006, (yE - 0.02 + 3.1) / 2, 0);
    // the end door's inside face: panelled, with a window and a brass handle and kick plate
    const xd = xz - e * 0.018, yd0 = yT + 0.01, yd1 = 3.08;
    b.box('ciWood', 0.012, 2.15 - yd0, 0.8, xd, (2.15 + yd0) / 2, 0);
    b.box('ciWood', 0.012, yd1 - 2.85, 0.8, xd, (yd1 + 2.85) / 2, 0);
    for (const s of [-1, 1]) b.box('ciWood', 0.012, 0.7, 0.16, xd, 2.5, s * 0.32);
    b.box('ciPane', 0.006, 0.7, 0.48, xd + e * 0.004, 2.5, 0);
    b.box('ciBrass', 0.014, 0.2, 0.76, xd - e * 0.006, yd0 + 0.12, 0);
    b.add('ciBrass', barGeo(0.012, [xd - e * 0.01, 1.95, 0.3], [xd - e * 0.07, 1.95, 0.3], 6));
    b.box('ciFrame', lv, 0.01, 2 * (CH.hw - 0.42), xm, yT + 0.005, 0);
  }
  // seats: a walkover seat for two each side of the aisle at every window pair
  const sw = COACH_IN.seatW, za = COACH_IN.aisle;
  for (const x of pairs) for (const s of [-1, 1]) walkoverSeat(b, x + 0.04, s * (za + sw / 2), s, yF);
  return b;
}
/* the coach lamps are always on; they matter most after dark. Drawn shades glow from behind. */
function coachInLight(dark) {
  if (!RMAT.ciLit) return;
  const d = smooth(0.15, 0.6, dark || 0);
  SAL.I.value = lerp(0.35, 0.85, d);
  SAL.amb.value = lerp(0.12, 0.16, d);
  RMAT.ciShade.emissiveIntensity = lerp(0.0, 0.18, d);
  RMAT.ciDeck.emissiveIntensity = lerp(0.6, 0.04, d);
  RMAT.ciLamp.emissiveIntensity = lerp(0.9, 2.2, d);
}
/* the lamps of the coach the camera is in, as two of the railroad's lamps (10c_lamps.js), so they light you and
   anyone else in the aisle as well as the saloon's own surfaces */
const _salM = new THREE.Matrix4(), _salI = new THREE.Matrix4(), _salV = new THREE.Vector3(), _salPool = [];
function saloonLamps(list, cam, cars, dark) {
  if (!cam) return;
  let best = null, bl = null;
  for (const v of cars) {
    const root = v.model && v.model.root; if (!root || !root.userData.saloon || !root.visible) continue;
    if (v.pos && v.pos.distanceToSquared(cam) > 16 * 16) continue;
    root.updateMatrixWorld();
    _salI.copy(root.matrixWorld).invert(); _salV.copy(cam).applyMatrix4(_salI);
    if (Math.abs(_salV.x) < CH.xv && Math.abs(_salV.z) < CH.hw && _salV.y > CH.yT && _salV.y < CH.eave + 1.2) { best = root; bl = _salV.clone(); break; }
  }
  if (!best) return;
  const near = SAL.L.slice(0, SAL.n - 2).map(p => [Math.abs(p.x - bl.x), p]).sort((a, b) => a[0] - b[0]).slice(0, 2);
  const lv = lerp(0.35, 1.0, smooth(0.15, 0.6, dark || 0));
  near.forEach(([, p], i) => {
    const l = _salPool[i] || (_salPool[i] = { kind: 'saloon', p: new THREE.Vector3(), dyn: true, lv: 0 });
    l.p.copy(p).applyMatrix4(best.matrixWorld); l.lv = lv; list.push(l);
  });
}

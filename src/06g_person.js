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
  const put = (parent, bin) => { const g = bin.build(mt); g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); parent.add(g); return g; };
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
  const rig = { root, j, soles, shirt: opts.shirt, _inv: new THREE.Matrix4(), _p: new THREE.Vector3() };
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
  if (st.wave !== undefined && st.wave >= 0) {
    const w = st.wave, up = smooth(0, 0.35, w) * (1 - smooth(2.2, 2.7, w));
    j.sh[1].rotation.set(-0.35 * up, 0, -2.55 * up - 0.07);
    j.el[1].rotation.set(0, 0, -(0.25 + 0.45 * Math.sin(w * 9)) * up);
  }
  // stand him on his lowest sole
  if (!st.sit) {
    rig.root.updateMatrixWorld(true);
    rig._inv.copy(rig.root.matrixWorld).invert();
    let lo = Infinity;
    for (const o of rig.soles) { rig._p.setFromMatrixPosition(o.matrixWorld).applyMatrix4(rig._inv); if (rig._p.y < lo) lo = rig._p.y; }
    j.hips.position.y -= lo;
  }
}

/* ======== inside a heavyweight coach ========
   Mahogany below the windows and between them, a cream ceiling following the lower deck and the clerestory,
   a red carpet, 13 rows of green plush walkover seats two and two with the aisle between (52 seats, one row to
   each pair of windows), brass parcel racks over the windows, ceiling lamps, and a bulkhead with a door at each
   end into the vestibule. Built in the coach's own frame (06_models.js CH), and only for coaches near you. */
const COACH_IN = { hi: CH.hw - 0.085, aisle: 0.34, seatH: 0.43, seatW: 1.02, rowFwd: 1 };
COACH_IN.yF = CH.yT + 0.03;
function coachInMaterials() {
  if (RMAT.ciWood) return;
  const lit = (c, r = 0.7, m = 0, extra = {}) => { const x = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, emissive: c, emissiveIntensity: 0.1, ...extra }); (RMAT.ciLit || (RMAT.ciLit = [])).push(x); return x; };
  RMAT.ciWood = lit(0x5c3220, 0.45);
  RMAT.ciCeil = lit(0xe2d8bd, 0.8, 0, { side: THREE.BackSide });
  RMAT.ciCream = lit(0xe2d8bd, 0.8);
  RMAT.ciCarpet = lit(0x5e1d1d, 0.95);
  RMAT.ciPlush = lit(0x2e4a36, 0.95);
  RMAT.ciCover = lit(0xefeadc, 0.9);
  RMAT.ciFrame = lit(0x2a2522, 0.5, 0.3);
  RMAT.ciBrass = lit(0xbf9a4a, 0.35, 0.8);
  RMAT.ciLamp = new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xffe2a8, emissiveIntensity: 0.6, roughness: 0.4 });
  // the glass of a coach you can see into: clear, a little tinted, still catching the light
  RMAT.ciGlass = new THREE.MeshStandardMaterial({ color: 0x9fb2b8, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.2, depthWrite: false });
}
/* the seats in a coach: centre of each place on its cushion, in the coach's frame (all face +X) */
function coachSeats() {
  const out = [], z0 = COACH_IN.aisle + COACH_IN.seatW / 4, z1 = COACH_IN.aisle + COACH_IN.seatW * 3 / 4;
  for (const x of coachPairs()) for (const z of [-z1, -z0, z0, z1]) out.push({ x: x + 0.04, z, h: COACH_IN.seatH });
  return out;
}
function coachInterior(observation) {
  coachInMaterials();
  const b = new GeoBin(), yF = COACH_IN.yF, yT = CH.yT, hi = COACH_IN.hi, xb = CH.xb, [w0, w1] = CH.win, yE = CH.eave, th = 0.03;
  const zw = hi + th / 2;   // the lining's middle; its inside face is at hi
  // floor
  b.box('ciCarpet', 2 * xb - 0.02, yF - yT, 2 * hi, 0, (yF + yT) / 2, 0);
  // walls: panelled below the sills, piers between the windows, a frieze over them; sills and window frames
  const opens = coachOpens(), x0 = -xb + 0.01, x1 = xb - 0.01;
  for (const s of [-1, 1]) {
    b.box('ciWood', x1 - x0, w0 - yF, th, 0, (w0 + yF) / 2, s * zw);
    b.box('ciCream', x1 - x0, yE - w1, th, 0, (yE + w1) / 2, s * zw);
    let x = x0;
    for (const [a, c] of opens) { b.box('ciWood', a - x, w1 - w0, th, (a + x) / 2, (w0 + w1) / 2, s * zw); x = c; }
    b.box('ciWood', x1 - x, w1 - w0, th, (x1 + x) / 2, (w0 + w1) / 2, s * zw);
    for (const [a, c] of opens) {
      b.box('ciWood', c - a + 0.04, 0.035, 0.07, (a + c) / 2, w0 + 0.0175, s * (hi - 0.035 + th));         // sill
      b.box('ciWood', c - a + 0.04, 0.03, 0.035, (a + c) / 2, w1 - 0.015, s * (hi - 0.0175 + th));          // head
    }
    b.box('ciWood', x1 - x0, 0.1, 0.02, 0, yF + 0.05, s * (hi - 0.01));                                       // skirting
    // parcel rack: brass rails on brackets over the windows
    for (const z of [hi - 0.08, hi - 0.2, hi - 0.32]) b.add('ciBrass', barGeo(0.009, [x0 + 0.4, yE - 0.12, s * z], [x1 - 0.4, yE - 0.12, s * z], 6));
    b.add('ciBrass', barGeo(0.012, [x0 + 0.4, yE - 0.06, s * (hi - 0.36)], [x1 - 0.4, yE - 0.06, s * (hi - 0.36)], 6));
    for (let x = x0 + 0.5; x < x1 - 0.4; x += 1.58) {
      b.add('ciBrass', barGeo(0.01, [x, yE - 0.12, s * (hi + 0.005)], [x, yE - 0.12, s * (hi - 0.36)], 5));
      b.add('ciBrass', barGeo(0.01, [x, yE - 0.06, s * (hi - 0.36)], [x, yE - 0.12, s * (hi - 0.36)], 5));
      b.add('ciBrass', barGeo(0.01, [x, yE - 0.3, s * (hi + 0.005)], [x, yE - 0.12, s * (hi - 0.2)], 5));
    }
  }
  // the ceiling: the lower deck curving up from the wall tops to the clerestory, and its arched top (seen from below)
  {
    const rD = 0.8, hD = 0.29, hC = 0.53, cr = 0.95, sh = new THREE.Shape();
    sh.moveTo(-hi - 0.005, -0.004); sh.quadraticCurveTo(-hi * 0.85, 0.2, -rD, hD); sh.lineTo(-rD, hC);
    sh.quadraticCurveTo(0, cr, rD, hC); sh.lineTo(rD, hD); sh.quadraticCurveTo(hi * 0.85, 0.2, hi + 0.005, -0.004); sh.closePath();
    const xe0 = observation ? -xb + 0.01 : -xb + 0.01, len = (xb - 0.01) - xe0;
    b.add('ciCeil', new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false, curveSegments: 12 }).rotateY(Math.PI / 2).translate(xe0, yE, 0));
    // lamps down the clerestory, and the clerestory's deck lights as a band of cream glass
    for (let x = -9.0; x <= 9.01; x += 3.0) { b.add('ciLamp', new THREE.SphereGeometry(0.11, 14, 8, 0, TAU, Math.PI / 2, Math.PI / 2).translate(x, yE + 0.66, 0)); b.add('ciBrass', new THREE.CylinderGeometry(0.03, 0.03, 0.12, 8).translate(x, yE + 0.71, 0)); }
  }
  // bulkheads: a door at each end into the vestibule (the observation car's lounge end is the car's own wall)
  const dw = 0.42, dh = 2.0;
  for (const e of observation ? [1] : [1, -1]) {
    const x = e * (xb - 0.025);
    for (const s of [-1, 1]) b.box('ciWood', 0.05, yE - yF, hi - dw, x, (yE + yF) / 2, s * (hi + dw) / 2);
    b.box('ciWood', 0.05, yE - yF - dh, 2 * dw, x, (yE + yF + dh) / 2, 0);
    b.box('ciBrass', 0.06, 0.04, 2 * dw + 0.08, x, yF + dh + 0.02, 0);
  }
  // seats: a walkover seat for two each side of the aisle at every window pair, plush cushion and back, white
  // covers on the headrests, a cast frame on a pedestal, armrests at the aisle and against the wall
  const sw = COACH_IN.seatW, sh = COACH_IN.seatH, za = COACH_IN.aisle;
  for (const x of coachPairs()) for (const s of [-1, 1]) {
    const zc = s * (za + sw / 2), xs = x + 0.04;
    b.box('ciFrame', 0.12, sh - 0.12, 0.12, xs, yF + (sh - 0.12) / 2, zc);                                      // pedestal
    b.box('ciFrame', 0.44, 0.03, 0.34, xs, yF + 0.015, zc);                                                      // its foot
    b.box('ciFrame', 0.5, 0.06, sw - 0.04, xs, yF + sh - 0.12 + 0.03, zc);                                       // seat frame
    b.box('ciPlush', 0.52, 0.12, sw - 0.06, xs + 0.01, yF + sh - 0.06 + 0.0, zc);                                // cushion (top at seatH)
    const back = new THREE.BoxGeometry(0.12, 0.66, sw - 0.06); back.translate(0, 0.33, 0); back.rotateZ(0.2);    // back, leaning 11 degrees
    b.add('ciPlush', back, M(xs - 0.21, yF + sh - 0.05, zc));
    const cover = new THREE.BoxGeometry(0.02, 0.2, sw - 0.2); cover.translate(0.07, 0.56, 0); cover.rotateZ(0.2);
    b.add('ciCover', cover, M(xs - 0.21, yF + sh - 0.05, zc));
    for (const z of [zc - s * (sw / 2 - 0.03), zc + s * (sw / 2 - 0.03)]) {
      b.box('ciFrame', 0.42, 0.05, 0.07, xs - 0.02, yF + sh + 0.2, z);                                           // armrest
      b.box('ciFrame', 0.06, 0.2, 0.05, xs + 0.12, yF + sh + 0.1, z);                                            // and its post
    }
  }
  const grp = b.build(RMAT, { cast: false });
  grp.name = 'coachInterior';
  grp.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  return grp;
}
/* the interior surfaces glow a little by day and more at night, as the coach's own lamps would light them */
function coachInLight(dark) {
  if (!RMAT.ciLit) return;
  const d = smooth(0.2, 0.6, dark || 0);
  for (const m of RMAT.ciLit) m.emissiveIntensity = lerp(0.1, 0.38, d);
  RMAT.ciLamp.emissiveIntensity = lerp(0.5, 1.4, d);
}

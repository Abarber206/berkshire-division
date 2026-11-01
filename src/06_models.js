/* ============================================================================
   Rolling stock models.
   Lima Super Power 2-8-4 (NKP S-2 765 / PM N-1 1225), drawn to an NKP Berkshire
   erecting drawing whose wheelbases match the published figures: 69 in drivers on
   73 in centres, 42 ft engine wheelbase, 15 ft 8 in over the stack, about 100 ft 8 in
   over couplers. Baker valve gear, Worthington feedwater heater, Delta trailing truck.
   The NKP carries its headlight on top of the smokebox with number-board wings and
   the bell on the door; the PM its lamp in the door, the bell on top and the air
   pumps on the pilot deck. Tender: 22,000 gal / 22 t on two six-wheel trucks.
   ========================================================================== */
const RMAT = {};
function rollingMaterials() {
  const S = (c, m, r, extra = {}) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r, ...extra });
  RMAT.black = S(0x141516, 0.25, 0.48); RMAT.black.envMapIntensity = 0.8;
  RMAT.blackMatte = S(0x151617, 0.3, 0.7);
  RMAT.graphite = S(0x45474a, 0.3, 0.66);
  RMAT.rod = S(0xc9cdd1, 1.0, 0.22);
  RMAT.steel = S(0x5c6064, 0.8, 0.42);
  RMAT.dark = S(0x202123, 0.65, 0.55);
  RMAT.brass = S(0xd4a24a, 1.0, 0.26);
  RMAT.copper = S(0xb5703f, 1.0, 0.35);
  RMAT.glass = S(0x0a1216, 0.2, 0.06);
  RMAT.white = S(0xe9e7df, 0.1, 0.6);
  RMAT.tire = S(0x9fa3a6, 1.0, 0.3);
  RMAT.coal = S(0x161618, 0.15, 0.55, { map: TEX.ballast });
  RMAT.lens = new THREE.MeshBasicMaterial({ color: 0xfff1cf });
  RMAT.lensOff = S(0x99928a, 0.6, 0.15);
  // a steam headlight's lens: a Fresnel glass, its rings faintly visible, the bulb's hot spot in the middle
  RMAT.hlLens = new THREE.MeshBasicMaterial({ color: 0xfff1cf, map: canvasTex(128, 128, (g, w, h) => {
    const c = w / 2, gr = g.createRadialGradient(c, c, 0, c, c, c);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.18, '#fffdf4'); gr.addColorStop(0.7, '#f4ead2'); gr.addColorStop(1, '#d9c9a2');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.lineWidth = 1.5; for (let r = 10; r < c; r += 7) { g.strokeStyle = `rgba(150,128,90,${0.12 + 0.25 * r / c})`; g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.stroke(); }
  }) });
  RMAT.glow = new THREE.MeshBasicMaterial({ color: 0xff7a26 });
  RMAT.green = S(0x2a3a2a, 0.3, 0.5);
  RMAT.roof = S(0x1d1e1f, 0.2, 0.8);
  RMAT.coachWin = new THREE.MeshStandardMaterial({ color: 0x1a2024, metalness: 0.3, roughness: 0.15, emissive: 0xffc77a, emissiveIntensity: 0 });
  RMAT.win = RMAT.coachWin;   // car windows (lit at night)
  RMAT.oxide = S(0x6b2b1e, 0.15, 0.78);
  RMAT.oxide2 = S(0x5a3326, 0.15, 0.8);
  RMAT.caboose = S(0x8e2c1f, 0.15, 0.62);
  RMAT.tank = S(0x121314, 0.35, 0.5);
  RMAT.wood = S(0x6a5847, 0.05, 0.85, { map: TEX.wood });
  RMAT.diaphragm = S(0x141414, 0.0, 0.95);
  RMAT.red = S(0xa1261c, 0.2, 0.6);
  RMAT.stoneLoad = S(0x9a958a, 0.05, 0.95, { map: TEX.ballast });
  RMAT.backhead = S(0x262729, 0.55, 0.55);
  RMAT.cabInt = S(0x2f3a30, 0.15, 0.75);
  RMAT.hit = new THREE.MeshBasicMaterial({ visible: false });
  RMAT.rbEdge = S(0x141516, 0.25, 0.48);   // running-board edge (white on excursion finish)
  RMAT.dWall = S(0x141516, 0.25, 0.5);     // outer face of driver & engine-truck tires
  for (const k of ['black', 'blackMatte', 'graphite', 'dark', 'tire', 'rod', 'brass', 'green', 'roof', 'oxide', 'oxide2', 'caboose', 'tank', 'steel', 'backhead', 'cabInt', 'wood']) RMAT[k].side = THREE.DoubleSide;
  trimMaterials();
  // worn paint on the engines' black, the smokebox's heat-dulled graphite, oily running gear, dirty frames and trucks
  wear(RMAT.black); wear(RMAT.blackMatte, 0.6, 21); wear(RMAT.graphite, 0.35, 22); wear(RMAT.dark, 0.5, 23); wear(RMAT.rod); wear(RMAT.steel, 0.35, 24);
  wear(RMAT.tire, 0.7, 25); wear(RMAT.backhead, 0.6, 26); wear(RMAT.rbEdge); wear(RMAT.dWall); wear(RMAT.roof, 0.5, 27); wear(RMAT.tank); wear(RMAT.green); wear(RMAT.caboose); wear(RMAT.oxide); wear(RMAT.oxide2);
}
function decalMat(w, h, draw) { return new THREE.MeshStandardMaterial({ map: canvasTex(w, h, draw), transparent: true, alphaTest: 0.35, metalness: 0.2, roughness: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }); }
function romanText(g, txt, x, y, size, color = '#efede4', spacing = 0.06) {
  g.font = `600 ${size}px "Times New Roman", Georgia, serif`; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (g.letterSpacing !== undefined) g.letterSpacing = (size * spacing) + 'px';
  g.fillText(txt, x, y);
}

/* -------- wheel sets -------- */
function driverWheel(R, main, rightCrankAngle, centre = boxpokCentre) {
  // geometry in wheel-local: xy = wheel face plane, +z outward (toward the rod side)
  const parts = { black: [], tire: [], rod: [], wall: [] };
  const tire = new THREE.LatheGeometry([new THREE.Vector2(R - 0.075, -0.07), new THREE.Vector2(R, -0.07), new THREE.Vector2(R, 0.065), new THREE.Vector2(R + 0.032, 0.07), new THREE.Vector2(R + 0.03, 0.09), new THREE.Vector2(R - 0.075, 0.09)].map(v => new THREE.Vector2(v.x, -v.y)), 40);
  tire.rotateX(Math.PI / 2); parts.tire.push(tire);
  parts.wall = [new THREE.RingGeometry(R - 0.074, R + 0.001, 48).translate(0, 0, 0.0715)];
  centre(R, main, parts);
  // crank pin boss + pin
  const cr = 0.432;
  parts.black.push(new THREE.CylinderGeometry(0.15, 0.17, 0.12, 16).rotateX(Math.PI / 2).translate(cr, 0, 0.1));
  parts.rod.push(new THREE.CylinderGeometry(0.075, 0.075, main ? 0.42 : 0.26, 12).rotateX(Math.PI / 2).translate(cr, 0, main ? 0.3 : 0.22));
  const out = {};
  const rot = new THREE.Matrix4().makeRotationZ(rightCrankAngle);
  for (const k in parts) { const g = mergeGeos(parts[k]); g.applyMatrix4(rot); out[k] = g; }
  return out;
}
/* full axle: right wheel at +z with crank at 0, left wheel at -z with crank at +90° */
function driverAxle(R, main, centre) {
  const right = driverWheel(R, main, 0, centre), left = driverWheel(R, main, Math.PI / 2, centre);
  const res = {};
  for (const k of ['black', 'tire', 'rod', 'wall']) {
    const r = right[k].clone().translate(0, 0, RAIL_OFF);
    const l = left[k].clone(); l.rotateY(Math.PI); l.translate(0, 0, -RAIL_OFF);
    res[k] = mergeGeos([r, l]);
  }
  res.black = mergeGeos([res.black, new THREE.CylinderGeometry(0.11, 0.11, 1.5, 10).rotateX(Math.PI / 2)]);
  return res;
}
function flipWinding(g) {
  const gg = g.index ? g : null;
  if (gg) { const a = gg.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } }
  else { const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i += 3) { for (const att of [p, n, g.attributes.uv].filter(Boolean)) { const sz = att.itemSize; for (let c = 0; c < sz; c++) { const t = att.array[(i + 1) * sz + c]; att.array[(i + 1) * sz + c] = att.array[(i + 2) * sz + c]; att.array[(i + 2) * sz + c] = t; } } } }
  if (g.attributes.normal) { const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setZ(i, -n.getZ(i)); }
}
function plainAxle(R, disc = true, tread = RAIL_OFF, jz = 0) {
  const parts = { black: [], tire: [] };
  for (const s of [-1, 1]) {
    const lathe = new THREE.LatheGeometry([new THREE.Vector2(0.12, 0.06), new THREE.Vector2(R - 0.05, 0.05), new THREE.Vector2(R, 0.065), new THREE.Vector2(R, -0.065), new THREE.Vector2(R + 0.028, -0.07), new THREE.Vector2(R + 0.026, -0.09), new THREE.Vector2(R - 0.07, -0.09), new THREE.Vector2(R * 0.55, -0.04), new THREE.Vector2(0.14, -0.08)], 16);
    lathe.rotateX(s * Math.PI / 2); lathe.translate(0, 0, s * tread);
    if (s < 0) {}
    parts.tire.push(lathe);
    if (disc) parts.black.push(new THREE.CylinderGeometry(0.16, 0.16, 0.18, 10).rotateX(Math.PI / 2).translate(0, 0, s * (tread + 0.02)));
    for (let i = 0; i < 3; i++) parts.black.push(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 8).rotateX(Math.PI / 2).translate(Math.cos(i * 2.1) * R * 0.5, Math.sin(i * 2.1) * R * 0.5, s * (tread + 0.065)));
  }
  parts.black.push(new THREE.CylinderGeometry(0.075, 0.075, 1.5, 8).rotateX(Math.PI / 2));
  // journals out through the hubs into the journal boxes
  if (jz) for (const s of [-1, 1]) parts.black.push(new THREE.CylinderGeometry(0.068, 0.068, jz - tread, 10).rotateX(Math.PI / 2).translate(0, 0, s * (jz + tread) / 2));
  return { black: mergeGeos(parts.black), tire: mergeGeos(parts.tire) };
}

/* -------- rod geometries (built along +x from pivot) -------- */
function rodGeo(L, h0, h1, t, boss0, boss1) {
  const parts = [];
  const shp = new THREE.Shape(); shp.moveTo(0, -h0 / 2); shp.lineTo(L, -h1 / 2); shp.lineTo(L, h1 / 2); shp.lineTo(0, h0 / 2); shp.closePath();
  const g = new THREE.ExtrudeGeometry(shp, { depth: t, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.01, bevelSegments: 1 }); g.translate(0, 0, -t / 2); parts.push(g);
  if (boss0) parts.push(new THREE.CylinderGeometry(boss0, boss0, t + 0.03, 16).rotateX(Math.PI / 2));
  if (boss1) parts.push(new THREE.CylinderGeometry(boss1, boss1, t + 0.03, 16).rotateX(Math.PI / 2).translate(L, 0, 0));
  return mergeGeos(parts);
}

/* ---- headlight beam and glow, shared by every engine ----
   The beam is the light seen in the air ahead (haze, rain, night). An evenly lit cone shows hard edges and,
   seen nose-on, a flat disc; this one is brightest along its axis and fades to nothing at its silhouette
   (where the eye looks through little of it) and along its length, so it reads as light, not a solid.
   Its material keeps an opacity property so callers can set it like any other material's. */
function headBeam(x, y, tilt = -0.03, len = 80, rad = 8) {
  const g = new THREE.ConeGeometry(rad, len, 32, 8, true); g.translate(0, -len / 2, 0); g.rotateZ(Math.PI / 2);
  const m = new THREE.ShaderMaterial({
    uniforms: { uOp: { value: 0 }, uLen: { value: len }, uCol: { value: new THREE.Color(0xfff0cc) } },
    vertexShader: `uniform float uLen; varying vec3 vN; varying vec3 vV; varying float vT;
      void main() { vT = position.x / uLen; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalMatrix * normal; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uOp; uniform vec3 uCol; varying vec3 vN; varying vec3 vV; varying float vT;
      void main() {
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), 2.2);
        float along = smoothstep(0.0, 0.04, vT) * pow(1.0 - clamp(vT, 0.0, 1.0), 1.6);
        float a = uOp * 4.5 * edge * along;
        gl_FragColor = vec4(uCol * a, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  Object.defineProperty(m, 'opacity', { get() { return this.uniforms ? this.uniforms.uOp.value : 1; }, set(v) { if (this.uniforms) this.uniforms.uOp.value = v; }, configurable: true });
  const beam = new THREE.Mesh(g, m); beam.position.set(x, y, 0); beam.rotation.z = tilt; beam.castShadow = false; beam.renderOrder = 2;
  return beam;
}
/* the glow round a lit lamp: a hot core, a soft bloom and a faint horizontal streak */
let _haloTex = null;
function haloTex() {
  return _haloTex || (_haloTex = canvasTex(128, 128, g => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,252,240,1)'); gr.addColorStop(0.1, 'rgba(255,246,222,0.9)'); gr.addColorStop(0.3, 'rgba(255,232,186,0.32)'); gr.addColorStop(0.62, 'rgba(255,220,160,0.08)'); gr.addColorStop(1, 'rgba(255,214,150,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const st = g.createLinearGradient(0, 0, 128, 0); st.addColorStop(0, 'rgba(255,236,200,0)'); st.addColorStop(0.5, 'rgba(255,240,210,0.35)'); st.addColorStop(1, 'rgba(255,236,200,0)');
    g.fillStyle = st; g.fillRect(0, 62, 128, 4);
  }));
}
/* how squarely a lamp on L faces the camera, 0..1: a headlight's glow is seen from ahead, not from behind */
const _lfA = new THREE.Vector3(), _lfB = new THREE.Vector3();
function lampFacing(L, cam) {
  if (!L.headlightPos) return 1;
  _lfA.copy(L.headlightPos).applyMatrix4(L.root.matrixWorld);
  _lfB.set(1, 0, 0).transformDirection(L.root.matrixWorld);
  const d = _lfA.sub(cam.isObject3D ? cam.position : cam).multiplyScalar(-1).normalize().dot(_lfB);
  return smooth(-0.15, 0.55, d);
}

/* =================== THE BERKSHIRE =================== */
const LOCO_SPEC = {   // front: 'nkp' headlight on top with number-board wings, bell on the door; 'pm' lamp in the door, bell on top, pumps on the pilot
  '765': { road: 'NICKEL PLATE ROAD', num: '765', short: 'NKP', cls: 'S-2', built: 'Lima, Sept 1944', weight: 440800, adhesive: 264300, te: 64135, fw: 'Worthington', whistle: 'deep6', front: 'nkp', leadR: 0.457, cylR: 0.3175, wheels: 'spoked' },
  'diesel': { road: 'SANDUSKY & SCIOTO', num: '4401', short: 'S&S', cls: 'AC44', built: '2026', weight: 420000, adhesive: 420000, te: 183000, diesel: true, whistle: 'k5' },
  '1225': { road: 'PERE MARQUETTE', num: '1225', short: 'PM', cls: 'N-1', built: 'Lima, Oct 1941', weight: 442500, adhesive: 277600, te: 69350, fw: 'Worthington', whistle: 'chime6', front: 'pm', leadR: 0.419, cylR: 0.330, wheels: 'boxpok' },
};
/* Engine geometry, a = metres back from the front coupler face, heights above the rail. Taken from an NKP
   Berkshire erecting drawing whose wheelbases match the published figures: 42 ft engine wheelbase, 18 ft 3 in
   driving wheelbase (four 73 in spaces), 88 ft 2-1/2 in engine and tender, 100 ft 8 in over couplers. */
const LG = {
  ref: 7.615, rD: 0.8763, rL: 0.457, rT1: 0.457, rT2: 0.546, cr: 0.432,
  aD: [4.834, 6.688, 8.542, 10.396], aL: 1.864, aT: [12.682, 14.663], len: 16.987,
  yC: 0.94, zC: 1.25, Lm: 3.55, yV: 1.55, yR: 1.41, a: 0.14, b: 0.79, Lu: 0.75,
  yB: 3.16,
};
const ax = a => LG.ref - a;
/* The cab, in one place so the interior (06d_cab.js) can follow it. Local x = ax(a). The roof is an arch from the
   eaves (roofY at |z| = hw) up to the crown on the centre line; ceil(z) is the underside of the roof sheet. */
const CABDIM = (() => {
  const C = { a0: 14.79, a1: 16.98, fl: 2.06, bottom: 1.98, roofY: 4.32, crown: 4.72, hw: 1.60, roofT: 0.05, aBh: 15.05,
    FB: { cy: 3.23, r: 1.15, base: 1.72, wb: 1.32 },            // firebox wrapper: round top over sides flaring to the mud ring
    side: { a0: 15.29, a1: 16.66, y0: 2.82, y1: 3.60 },           // side window pair (two 2 x 2 sashes)
    front: { y0: 3.35, y1: 4.12, zi: 1.22, zo: 1.50 } };           // front windows either side of the firebox
  C.x0 = ax(C.a0); C.x1 = ax(C.a1); C.bh = ax(C.aBh);
  C.arch = z => C.crown - (C.crown - C.roofY) * (z / C.hw) ** 2;   // top of the roof sheet at z (inside the eaves)
  C.ceil = z => C.arch(z) - C.roofT;
  C.fbHalf = y => y >= C.FB.cy ? Math.sqrt(Math.max(0, C.FB.r ** 2 - (y - C.FB.cy) ** 2)) : C.FB.r + (C.FB.wb - C.FB.r) * (C.FB.cy - y) / (C.FB.cy - C.FB.base);
  return C;
})();
let ROAD_SHORT = 'NKP';
/* Baker valve gear, as both engines carry it. An eccentric crank on the main pin drives the eccentric rod
   forward to the foot of the gear connecting rod. That rod hangs from radius bars on the reverse yoke and
   works a bell crank in the gear frame; the bell crank's vertical arm drives the valve rod forward to the
   combination lever. With the yoke upright (mid gear) the eccentric's motion never reaches the bell crank;
   tipping the yoke one way or the other sets forward or back motion and the cutoff. */
const BK = { e: 0.30, Pb: [ax(6.30), 1.92], hb: 0.30, vb: 0.36, E0: [ax(6.62), 0.98], d2: 0.94, k: 0.45, Lrb: 0.40, Lvr: 2.185, gMax: 0.45, z: 1.30, aYoke: 5.95, aShaft: 6.95, aPR: 11.0 };
BK.Rmid = [BK.E0[0], BK.E0[1] + BK.k * BK.d2];
BK.Lecc = Math.hypot(BK.E0[0] - ax(LG.aD[2]), BK.E0[1] - LG.rD);
function circLow(x1, y1, r1, x2, y2, r2) {   // lower intersection of two circles
  const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1e-6, a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const px = x1 + a * dx / d, py = y1 + a * dy / d, y1s = py - h * dx / d, y2s = py + h * dx / d;
  return y1s < y2s ? [px + h * dy / d, y1s] : [px - h * dy / d, y2s];
}
function bakerSolve(Rc, Y, st) {               // find the bell-crank angle that keeps the radius bar its own length
  const ev = b => { const B = [BK.Pb[0] - BK.hb * Math.cos(b), BK.Pb[1] - BK.hb * Math.sin(b)], E = circLow(Rc[0], Rc[1], BK.Lecc, B[0], B[1], BK.d2), R = [E[0] + (B[0] - E[0]) * BK.k, E[1] + (B[1] - E[1]) * BK.k]; return { f: Math.hypot(R[0] - Y[0], R[1] - Y[1]) - BK.Lrb, B, E, R, b }; };
  let b = st.b;
  for (let i = 0; i < 6; i++) { const r0 = ev(b), r1 = ev(b + 1e-5), d = (r1.f - r0.f) / 1e-5; if (Math.abs(r0.f) < 1e-7 || Math.abs(d) < 1e-9) break; b = clamp(b - r0.f / d, -0.8, 0.8); }
  st.b = b; return ev(b);
}

/* Boiler: smokebox, a parallel first course, a conical course and the big rear course meeting the firebox.
   Radii are over the jacket. bR(a) / bY(a): radius and centre height of the barrel at a. */
const BOIL = { sb: [1.91, 4.75, 1.13], c1: [4.75, 7.20, 1.08], cone: [7.20, 8.80], c3: [8.80, 11.80, 1.15], yR: 3.20, fb: [11.80, CABDIM.aBh] };
BOIL.bR = a => a < BOIL.sb[1] ? BOIL.sb[2] : a < BOIL.cone[0] ? BOIL.c1[2] : a < BOIL.cone[1] ? lerp(BOIL.c1[2], BOIL.c3[2], (a - BOIL.cone[0]) / (BOIL.cone[1] - BOIL.cone[0])) : BOIL.c3[2];
BOIL.bY = a => a < BOIL.cone[0] ? LG.yB : a < BOIL.cone[1] ? lerp(LG.yB, BOIL.yR, (a - BOIL.cone[0]) / (BOIL.cone[1] - BOIL.cone[0])) : BOIL.yR;
BOIL.top = a => a >= BOIL.fb[0] ? CABDIM.FB.cy + CABDIM.FB.r : BOIL.bY(a) + BOIL.bR(a);
/* half width of the barrel (or firebox) at height y, a */
BOIL.half = (a, y) => { if (a >= BOIL.fb[0]) return CABDIM.fbHalf(y); const r = BOIL.bR(a), d = y - BOIL.bY(a); return Math.sqrt(Math.max(0, r * r - d * d)); };

/* Spoked driving wheel centre (NKP) with a crescent counterweight, in wheel-local coordinates like driverWheel */
function spokedCentre(R, main, parts) {
  const rimIn = R - 0.13, hubR = 0.27, n = 18;
  parts.black.push(new THREE.ExtrudeGeometry((() => { const s = new THREE.Shape(); s.absarc(0, 0, R - 0.07, 0, TAU, false); const h = new THREE.Path(); h.absarc(0, 0, rimIn, 0, TAU, true); s.holes.push(h); return s; })(), { depth: 0.1, bevelEnabled: false, curveSegments: 40 }).translate(0, 0, -0.03));
  for (let i = 0; i < n; i++) {   // oval-section spokes, a little thicker at the hub
    const t = i / n * TAU, L = rimIn - hubR + 0.04, g = new THREE.CylinderGeometry(0.034, 0.05, L, 8);
    g.scale(1, 1, 1.5); g.translate(0, hubR - 0.02 + L / 2, 0); g.rotateZ(t - Math.PI / 2); g.translate(0, 0, 0.02); parts.black.push(g);
  }
  parts.black.push(new THREE.CylinderGeometry(hubR, hubR + 0.02, 0.17, 24).rotateX(Math.PI / 2).translate(0, 0, 0.04));
  const cw = new THREE.Shape(); const sp = main ? 1.05 : 0.8, r0 = R * 0.36, r1 = rimIn + 0.01;
  cw.absarc(0, 0, r1, Math.PI - sp, Math.PI + sp, false); cw.absarc(0, 0, r0, Math.PI + sp * 0.75, Math.PI - sp * 0.75, true);
  parts.black.push(new THREE.ExtrudeGeometry(cw, { depth: 0.13, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1, curveSegments: 18 }).translate(0, 0, -0.03));
}
/* Boxpok centre (PM): a disc with oval lightening holes and a cast counterweight */
function boxpokCentre(R, main, parts) {
  const shp = new THREE.Shape(); shp.absarc(0, 0, R - 0.07, 0, TAU, false);
  for (let i = 0; i < 6; i++) {
    const a = (i + 0.5) / 6 * TAU, h = new THREE.Path(), cx = Math.cos(a) * R * 0.53, cy = Math.sin(a) * R * 0.53, pts = [];
    for (let k = 0; k <= 16; k++) { const t = k / 16 * TAU, ex = Math.cos(t) * R * 0.17, ey = Math.sin(t) * R * 0.1; pts.push(new THREE.Vector2(cx + ex * Math.cos(a) - ey * Math.sin(a), cy + ex * Math.sin(a) + ey * Math.cos(a))); }
    h.setFromPoints(pts.reverse()); shp.holes.push(h);
  }
  parts.black.push(new THREE.ExtrudeGeometry(shp, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1, curveSegments: 28 }).translate(0, 0, -0.02));
  parts.black.push(new THREE.CylinderGeometry(0.22, 0.25, 0.16, 18).rotateX(Math.PI / 2).translate(0, 0, 0.06));
  const cw = new THREE.Shape(); const sp = main ? 1.15 : 0.85, r0 = R * 0.28, r1 = R - 0.09;
  cw.absarc(0, 0, r1, Math.PI - sp, Math.PI + sp, false); cw.absarc(0, 0, r0, Math.PI + sp * 0.7, Math.PI - sp * 0.7, true);
  parts.black.push(new THREE.ExtrudeGeometry(cw, { depth: 0.09, bevelEnabled: false, curveSegments: 18 }));
}

function buildBerkshire(key, trim = '') {
  const spec = LOCO_SPEC[key], nkp = spec.front !== 'pm';
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const gb = new GeoBin();
  const yB = LG.yB, C = CABDIM, FB = C.FB;
  const RB = { lo: 2.55, hi: 2.95, aStep: 3.55, zi: 1.20, zo: 1.62, t: 0.05 };   // running boards: low ahead of the cylinders' back, high from there to the cab
  const bar = (k, r, a, b, seg = 8) => gb.add(k, barGeo(r, a, b, seg));
  const surfZ = (a, y, pad = 0) => BOIL.half(a, y) - pad;                           // boiler/firebox side at height y

  /* ---- frame: cast bed from the pilot to the cab, cradle over the trailing truck ---- */
  for (const s of [-1, 1]) {
    gb.box('dark', 10.9, 0.46, 0.15, ax(6.25), 1.22, s * 0.56);                    // main frame over the drivers
    gb.box('dark', 5.9, 0.36, 0.15, ax(14.15), 1.48, s * 0.56);                    // cradle under the firebox
    gb.box('dark', 0.6, 0.62, 0.15, ax(11.35), 1.33, s * 0.56);                    // knee where the two meet
    for (let i = 0; i < 4; i++) {                                                  // pedestals and driving boxes
      const xd = ax(LG.aD[i]);
      gb.box('dark', 0.34, 0.5, 0.2, xd, LG.rD + 0.02, s * 0.58);
      for (const d of [-0.22, 0.22]) gb.box('dark', 0.08, 0.62, 0.17, xd + d, 1.05, s * 0.58);
    }
  }
  for (const a of [1.2, 4.2, 7.6, 11.0, 16.9]) gb.box('dark', 0.24, 0.4, 0.98, ax(a), a > 11 ? 1.48 : 1.22, 0);   // cross ties
  /* ---- pilot: beam, slatted cast pilot sloping down to the rail, deck, coupler ---- */
  const pil = { beam: 0.60, deckA: 0.66, deckY: 1.22 };
  gb.box('black', 0.26, 0.42, 2.9, ax(pil.beam + 0.13), 1.04, 0);
  gb.box('dark', BOIL.sb[0] - pil.deckA + 0.02, 0.05, 2.9, ax((pil.deckA + BOIL.sb[0]) / 2), pil.deckY + 0.025, 0);   // pilot deck up to the smokebox
  gb.box('dark', 0.8, 0.4, 1.4, ax(1.15), 1.0, 0);                                // deck casting under the smokebox front
  {
    const top = [ax(pil.beam + 0.02), 0.83], bot = [ax(0.18), 0.09], L = Math.hypot(top[0] - bot[0], top[1] - bot[1]), th = Math.atan2(top[1] - bot[1], top[0] - bot[0]) - Math.PI / 2;
    const mx = (top[0] + bot[0]) / 2, my = (top[1] + bot[1]) / 2;
    for (let z = -1.27; z <= 1.28; z += 0.127) gb.add('dark', new THREE.BoxGeometry(0.05, L, 0.065), M(mx, my, z, 0, 0, th));
    for (const t of [0.12, 0.55, 0.95]) gb.add('dark', new THREE.BoxGeometry(0.09, 0.09, 2.7 - t * 0.3), M(lerp(top[0], bot[0], t), lerp(top[1], bot[1], t), 0, 0, 0, th));
    for (const s of [-1, 1]) { const sp = new THREE.Shape(); sp.moveTo(top[0], 0.83); sp.lineTo(bot[0], 0.09); sp.lineTo(ax(pil.beam + 0.2), 0.09); sp.lineTo(ax(pil.beam + 0.2), 0.83); sp.closePath(); gb.add('dark', new THREE.ExtrudeGeometry(sp, { depth: 0.06, bevelEnabled: false }).translate(0, 0, s * 1.36 - 0.03)); }
  }
  const coupler = addCoupler(gb, body, { x: ax(0), out: 1, sx: -(pil.beam), sb: 0.83, ly: 1.02, zh: 1.3, yp: 0.8, housing: true, hl: 0.3 });
  // front steps: a ladder from the pilot deck up to the low running board, treads level, stringers sloping back
  for (const s of [-1, 1]) {
    const z = s * 1.45, top = [ax(BOIL.sb[0] + 0.12), RB.lo], bot = [ax(pil.deckA + 0.3), pil.deckY + 0.05];
    for (const dz of [-0.17, 0.17]) bar('dark', 0.025, [top[0], top[1], z + dz], [bot[0], bot[1], z + dz], 6);
    for (let i = 1; i < 4; i++) { const t = i / 4; gb.box('dark', 0.22, 0.035, 0.36, lerp(top[0], bot[0], t), lerp(top[1], bot[1], t), z); }
    gb.box('dark', 0.12, 0.035, 0.36, bot[0] - 0.04, bot[1] - 0.02, z);
    bar('rod', 0.016, [top[0], top[1] + 0.9, z + s * 0.2], [bot[0] - 0.05, bot[1] + 0.8, z + s * 0.2], 6);   // grab rail beside the ladder
    bar('rod', 0.014, [top[0], top[1], z + s * 0.2], [top[0], top[1] + 0.9, z + s * 0.2], 6);
    bar('rod', 0.014, [bot[0] - 0.05, bot[1] + 0.8, z + s * 0.2], [bot[0] - 0.05, bot[1], z + s * 0.2], 6);
  }

  /* ---- cylinders, valve chests, saddle ---- */
  const cyl = { a0: 2.53, a1: 3.80, r: spec.cylR + 0.12 };
  const cylA = (cyl.a0 + cyl.a1) / 2;
  for (const s of [-1, 1]) {
    const z = s * LG.zC;
    gb.cylX('black', cyl.r, cyl.r, cyl.a1 - cyl.a0 - 0.12, 28, ax(cylA), LG.yC, z);
    for (const a of [cyl.a0 + 0.04, cyl.a1 - 0.04]) gb.cylX('graphite', cyl.r + 0.025, cyl.r + 0.025, 0.08, 28, ax(a), LG.yC, z);
    gb.cylX('graphite', cyl.r - 0.06, cyl.r - 0.1, 0.08, 24, ax(cyl.a0 - 0.04), LG.yC, z);   // front cylinder head
    gb.cylX('black', 0.30, 0.30, 1.3, 20, ax(cylA), LG.yV, s * 1.13);                         // valve chest
    for (const a of [cylA - 0.68, cylA + 0.68]) gb.cylX('graphite', 0.32, 0.32, 0.06, 20, ax(a), LG.yV, s * 1.13);
    gb.box('black', 1.18, LG.yV - LG.yC, 0.34, ax(cylA), (LG.yV + LG.yC) / 2, s * 1.13);       // web between cylinder and chest
    gb.box('black', 0.5, 0.18, 0.18, ax(cyl.a1 + 0.3), LG.yV, s * 1.13);                       // valve stem guide
    for (const a of [cyl.a0 + 0.15, cyl.a1 - 0.15]) gb.add('dark', new THREE.CylinderGeometry(0.025, 0.025, 0.35, 6), M(ax(a), LG.yC - cyl.r - 0.1, z));   // drain cocks
    // crosshead guides (two bars) from the back cylinder head to the guide yoke
    for (const dy of [-0.19, 0.19]) gb.box('rod', BK.aYoke - cyl.a1 + 0.05, 0.06, 0.14, ax((cyl.a1 + BK.aYoke) / 2), LG.yC + dy, z);
    // guide yoke: a deep casting from the frame up to the running board
    gb.box('black', 0.16, RB.hi - 0.95 - RB.t, 0.42, ax(BK.aYoke), (RB.hi - RB.t + 0.95) / 2, s * 0.98);
    gb.box('black', 0.16, 0.5, 0.22, ax(BK.aYoke), LG.yC, s * 1.18);
    // Baker gear frame behind the yoke: an open outer frame, a solid inner plate, bell-crank bearing, yoke trunnions
    {
      const ga = BK.aYoke + 0.05, gz = ga + 1.12;
      const fr = new THREE.Shape(); fr.moveTo(ax(ga), 1.28); fr.lineTo(ax(ga), 2.1); fr.lineTo(ax(gz), 2.1); fr.lineTo(ax(gz), 1.62); fr.lineTo(ax(gz - 0.32), 1.28); fr.closePath();
      const hole = new THREE.Path(); hole.moveTo(ax(ga + 0.1), 1.38); hole.lineTo(ax(ga + 0.1), 2.0); hole.lineTo(ax(gz - 0.1), 2.0); hole.lineTo(ax(gz - 0.1), 1.66); hole.lineTo(ax(gz - 0.36), 1.38); hole.closePath(); fr.holes.push(hole);
      gb.add('black', new THREE.ExtrudeGeometry(fr, { depth: 0.04, bevelEnabled: false }).translate(0, 0, s * 1.45 - 0.02));
      gb.box('black', 1.12, 0.66, 0.04, ax(ga + 0.56), 1.72, s * 1.13);
      gb.box('black', 1.12, 0.06, 0.36, ax(ga + 0.56), 2.08, s * 1.29);
      gb.box('black', 0.1, RB.hi - RB.t - 2.11, 0.1, ax(gz - 0.06), (RB.hi - RB.t + 2.11) / 2, s * 1.29);   // hanger up to the running board
      gb.cylZ('dark', 0.07, 0.34, 14, BK.Pb[0], BK.Pb[1], s * 1.30);
      for (const zz of [1.15, 1.43]) gb.cylZ('dark', 0.08, 0.06, 14, BK.Rmid[0], BK.Rmid[1], s * zz);
    }
  }
  gb.box('black', 1.27, yB - LG.yV + 0.1, 2.0, ax(cylA), (yB + LG.yV - 0.3) / 2 + 0.1, 0);   // saddle up into the smokebox
  gb.cylZ('dark', 0.05, 2.74, 10, ax(BK.aShaft), 1.98, 0);                                      // reverse shaft between the gear frames

  /* ---- boiler ---- */
  const lathe = (pts, a0) => { const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[1], p[0])), 48); g.rotateZ(-Math.PI / 2); g.translate(ax(a0), yB, 0); return g; };
  const barrel = (a0, a1, r, y) => gb.add('black', new THREE.CylinderGeometry(r, r, a1 - a0, 48, 1, true).rotateZ(Math.PI / 2).translate(ax((a0 + a1) / 2), y, 0));
  // smokebox (graphite on the as-delivered finish) with its front ring, dished door, hinges and dogs
  gb.add('graphite', new THREE.CylinderGeometry(BOIL.sb[2], BOIL.sb[2], BOIL.sb[1] - BOIL.sb[0], 48).rotateZ(Math.PI / 2).translate(ax((BOIL.sb[0] + BOIL.sb[1]) / 2), yB, 0));
  gb.add('graphite', new THREE.CylinderGeometry(BOIL.sb[2] + 0.025, BOIL.sb[2] + 0.025, 0.09, 48).rotateZ(Math.PI / 2).translate(ax(BOIL.sb[0] + 0.045), yB, 0));
  const door = { r: 0.86, a: BOIL.sb[0] - 0.16 };                                          // the door bulges 0.16 m out of the front plate
  gb.add('graphite', lathe([[0, door.r + 0.04], [0.04, door.r + 0.04], [0.07, door.r], [0.13, 0.58], [0.16, 0.0]], BOIL.sb[0] - 0.005));
  for (const dy of [0.38, -0.38]) gb.box('dark', 0.05, 0.07, 0.42, ax(BOIL.sb[0] - 0.07), yB + dy, -0.6);   // hinge straps
  for (let i = 0; i < 16; i++) { const t = (i + 0.5) / 16 * TAU; gb.add('dark', new THREE.BoxGeometry(0.07, 0.13, 0.07), M(ax(BOIL.sb[0] - 0.03), yB + 0.95 * Math.cos(t), 0.95 * Math.sin(t), t, 0, 0)); }   // door dogs round the ring
  gb.box('dark', 0.06, 0.08, 0.5, ax(door.a + 0.02), yB, 0);                                // door handle bar
  // barrel courses and the conical course between them (bottom line rises with the radius so the seams meet)
  barrel(BOIL.c1[0] - 0.02, BOIL.c1[1], BOIL.c1[2], yB);
  {
    const L = BOIL.cone[1] - BOIL.cone[0], g = new THREE.CylinderGeometry(BOIL.c1[2], BOIL.c3[2], L, 48, 1, true).rotateZ(-Math.PI / 2);   // r1 at +x (front)
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + (BOIL.yR - yB) * (L / 2 - p.getX(i)) / L);
    g.computeVertexNormals(); g.translate(ax((BOIL.cone[0] + BOIL.cone[1]) / 2), yB, 0); gb.add('black', g);
  }
  barrel(BOIL.c3[0], BOIL.c3[1] + 0.3, BOIL.c3[2], BOIL.yR);                                // runs into the firebox
  gb.add('black', new THREE.CircleGeometry(BOIL.c1[2], 48).rotateY(Math.PI / 2).translate(ax(BOIL.c1[0] - 0.02), yB, 0));   // first course closed behind the smokebox
  for (const a of [BOIL.sb[1], 6.0, BOIL.cone[0], BOIL.cone[1], 10.3, BOIL.c3[1] - 0.02]) { const r = BOIL.bR(a + 0.01) + 0.012; gb.add('dark', new THREE.CylinderGeometry(r, r, 0.07, 48, 1, true).rotateZ(Math.PI / 2).translate(ax(a), BOIL.bY(a + 0.01), 0)); }   // jacket bands
  // firebox: round top over flat sides flaring to the mud ring, from the throat to the back sheet in the cab
  {
    const s = new THREE.Shape();
    s.moveTo(-FB.wb, FB.base); s.lineTo(-FB.r, FB.cy); s.absarc(0, FB.cy, FB.r, Math.PI, 0, true); s.lineTo(FB.wb, FB.base); s.lineTo(-FB.wb, FB.base);
    const g = new THREE.ExtrudeGeometry(s, { depth: BOIL.fb[1] - BOIL.fb[0], bevelEnabled: false, curveSegments: 28 });
    g.rotateY(Math.PI / 2); g.translate(ax(BOIL.fb[1]), 0, 0); gb.add('graphite', g);
    gb.box('dark', BOIL.fb[1] - BOIL.fb[0] + 0.05, 0.1, 2 * FB.wb + 0.08, ax((BOIL.fb[0] + BOIL.fb[1]) / 2), FB.base - 0.05, 0);   // mud ring
    // ashpan hoppers between the trailing wheels, down from the mud ring
    gb.box('dark', 2.4, 0.62, 1.0, ax(12.0 + 1.2), FB.base - 0.41, 0);
    gb.box('dark', 0.9, 0.5, 1.0, ax(14.0), FB.base - 0.35, 0);
  }

  /* ---- stack, feedwater heater, domes, top fittings ---- */
  const stackA = 3.14, sbTop = yB + BOIL.sb[2];
  gb.cyl('black', 0.62, 0.72, 0.24, 32, ax(stackA), sbTop + 0.03, 0);                       // base flange, seated in the smokebox top
  gb.cyl('black', 0.37, 0.42, 4.775 - 0.06 - sbTop, 28, ax(stackA), (4.775 - 0.06 + sbTop) / 2, 0);
  gb.add('black', new THREE.TorusGeometry(0.41, 0.06, 10, 28).rotateX(Math.PI / 2).translate(ax(stackA), 4.775 - 0.06, 0));
  gb.add('blackMatte', new THREE.CircleGeometry(0.36, 24).rotateX(-Math.PI / 2).translate(ax(stackA), 4.70, 0));
  // Worthington feedwater heater: a drum across the smokebox top ahead of the stack, on two saddles
  { const fa = 2.30, fy = 4.40;
    gb.cylZ('black', 0.29, 1.36, 28, ax(fa), fy, 0);
    for (const z of [-0.69, 0.69]) gb.cylZ('graphite', 0.305, 0.06, 28, ax(fa), fy, z);
    for (const z of [-0.45, 0.45]) gb.box('black', 0.5, 0.3, 0.14, ax(fa), sbTop - 0.02 + 0.12, z);
    bar('dark', 0.05, [ax(fa - 0.1), fy - 0.15, 0.68], [ax(fa - 0.4), sbTop - 0.2, 0.95]);      // feed pipes down the smokebox side
    bar('dark', 0.05, [ax(fa + 0.1), fy - 0.15, -0.68], [ax(fa + 0.4), sbTop - 0.2, -0.95]);
  }
  // domes: seated on the barrel (their skirts go into it, so no gap shows on the curved top)
  const dome = (a0, a1, w, top, k) => {
    const L = a1 - a0, base = BOIL.top((a0 + a1) / 2) - 0.32, h = top - base, g = new THREE.SphereGeometry(1, 32, 16, 0, TAU, 0, Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {   // superellipse plan, flat crown
      const x = p.getX(i), z = p.getZ(i), y = p.getY(i), r = Math.hypot(x, z), ang = Math.atan2(z, x), c = Math.cos(ang), sn = Math.sin(ang);
      const se = Math.pow(Math.pow(Math.abs(c), 4) + Math.pow(Math.abs(sn), 4), -0.25);
      const yy = Math.pow(y, 0.55);
      p.setXYZ(i, c * se * r * L / 2, yy * h, sn * se * r * w / 2);
    }
    g.computeVertexNormals(); g.translate(ax((a0 + a1) / 2), base, 0); gb.add(k || 'black', g);
    gb.add(k || 'black', new THREE.CylinderGeometry(1, 1, 0.34, 32, 1, true).scale(L / 2 * 1.0, 1, w / 2).translate(ax((a0 + a1) / 2), base - 0.17 + 0.001, 0));
  };
  dome(6.00, 7.08, 1.02, 4.70);                                                              // steam dome
  dome(7.57, 10.33, 0.92, 4.68);                                                             // long sand dome
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const a = 8.0 + i * 0.62; gb.box('dark', 0.2, 0.14, 0.08, ax(a), BOIL.top(a) - 0.1, s * 0.44); }   // sand valves on the dome skirt
  // safety valves, whistle, turret and turbo-generators on the firebox top / rear course
  const fbTop = FB.cy + FB.r;
  for (const z of [-0.24, 0, 0.24]) { gb.cyl('brass', 0.075, 0.095, 0.3, 14, ax(12.15), fbTop + 0.12, z); gb.cyl('brass', 0.11, 0.11, 0.05, 14, ax(12.15), fbTop + 0.29, z); }
  gb.box('black', 0.5, 0.12, 0.7, ax(12.15), fbTop - 0.02, 0);
  const wh = [12.85, fbTop, 0.35];                                                            // whistle on the right of the turret
  gb.cyl('brass', 0.09, 0.09, 0.42, 16, ax(wh[0]), wh[1] + 0.28, wh[2]); gb.cyl('brass', 0.12, 0.12, 0.05, 16, ax(wh[0]), wh[1] + 0.51, wh[2]); gb.cyl('brass', 0.05, 0.05, 0.16, 8, ax(wh[0]), wh[1] + 0.02, wh[2]);
  gb.cyl('black', 0.22, 0.26, 0.26, 18, ax(12.95), fbTop - 0.02, -0.05);                     // steam turret
  { const tg = [13.6, fbTop - 0.05, -0.62];                                                   // turbo-generator, fireman's side
    gb.cylX('black', 0.17, 0.17, 0.58, 16, ax(tg[0]), tg[1] + 0.12, tg[2]); gb.box('black', 0.5, 0.18, 0.3, ax(tg[0]), tg[1] - 0.03, tg[2] + 0.04); }
  if (nkp) { const tg = [13.0, fbTop - 0.15, -0.82]; gb.cylX('black', 0.15, 0.15, 0.5, 14, ax(tg[0]), tg[1] + 0.1, tg[2]); gb.box('black', 0.42, 0.16, 0.28, ax(tg[0]), tg[1] - 0.04, tg[2] + 0.06); }
  gb.cyl('black', 0.2, 0.24, 0.24, 18, ax(5.4), BOIL.top(5.4) + 0.06, 0); gb.cyl('dark', 0.13, 0.13, 0.1, 14, ax(5.4), BOIL.top(5.4) + 0.21, 0);   // top check valve

  /* ---- smokebox front: headlight, bell, number plate, class lamps ---- */
  let hlPos, hlR, lensA;
  const numMat = decalMat(128, 64, (g, w, h) => { g.fillStyle = '#f2efe4'; g.fillRect(0, 0, w, h); g.fillStyle = '#121212'; g.font = 'bold 44px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(spec.num, w / 2, h / 2 + 2); });
  RMAT['num' + key] = numMat;
  let bellR = null;
  const bell = (bx, by) => {
    // the stand stays put; the bell swings on its trunnions (bellRig)
    for (const z of [-0.3, 0.3]) gb.box('black', 0.06, 0.38, 0.05, bx, by + 0.2, z);
    gb.cylZ('dark', 0.025, 0.62, 8, bx, by + 0.22, 0);
    gb.box('black', 0.08, 0.06, 0.66, bx, by + 0.4, 0);
    bellR = bellRig(body, bx, by + 0.22, 1, 0.3);
  };
  /* A Pyle-National headlight case: a drum with a rounded back, a hinged front door whose rim holds the lens
     a little behind its lip, a visor over the top of the door, a ventilator cap on top, the door hinge on the
     fireman's side and the latch on the engineer's. aF: front of the door, R: case radius, D: case depth.
     Returns where the lens sits and its radius. */
  const headlamp = (aF, y, R, D, rim) => {
    const aB = aF + D, x0 = ax(aB);
    const prof = [[0, 0], [0.012, R * 0.5], [0.04, R * 0.8], [0.09, R * 0.95], [0.15, R], [D - 0.06, R], [D - 0.06, R + 0.022], [D - 0.014, R + 0.022], [D, R - 0.012], [D, R - 0.05], [D - 0.04, R - 0.055]];
    gb.add('black', new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[1], p[0])), 36).rotateZ(-Math.PI / 2).translate(x0, y, 0));
    gb.add(rim, new THREE.TorusGeometry(R - 0.028, 0.018, 8, 36).rotateY(Math.PI / 2).translate(ax(aF + 0.01), y, 0));   // door rim
    gb.add('black', new THREE.TorusGeometry(R + 0.006, 0.014, 6, 36).rotateY(Math.PI / 2).translate(ax(aB - 0.15), y, 0));   // rolled bead round the case
    // visor: an arched hood over the top of the door
    { const s = new THREE.Shape(), r0 = R + 0.005, r1 = R + 0.03, t0 = 0.3, t1 = Math.PI - 0.3;
      s.absarc(0, 0, r1, t0, t1, false); s.lineTo(r0 * Math.cos(t1), r0 * Math.sin(t1)); s.absarc(0, 0, r0, t1, t0, true); s.lineTo(r1 * Math.cos(t0), r1 * Math.sin(t0));
      gb.add('black', new THREE.ExtrudeGeometry(s, { depth: 0.13, bevelEnabled: false, curveSegments: 16 }).rotateY(Math.PI / 2).translate(ax(aF + 0.06), y, 0)); }
    // ventilator cap on top, back of the case
    gb.cyl('black', 0.05, 0.055, 0.1, 14, ax(aB - 0.13), y + R + 0.03, 0); gb.cyl('black', 0.085, 0.085, 0.025, 16, ax(aB - 0.13), y + R + 0.09, 0);
    gb.cyl('black', 0.03, 0.03, 0.03, 10, ax(aB - 0.13), y + R + 0.115, 0);
    // door hinge (fireman's side) and latch (engineer's side)
    for (const dy of [-0.55, 0.55]) gb.cyl('dark', 0.022, 0.022, 0.08, 10, ax(aF + 0.03), y + dy * R, -(R + 0.016));
    gb.cyl('dark', 0.009, 0.009, 1.2 * R, 6, ax(aF + 0.03), y, -(R + 0.016));
    gb.box('dark', 0.05, 0.07, 0.04, ax(aF + 0.03), y, R + 0.025); gb.box('dark', 0.025, 0.025, 0.06, ax(aF + 0.005), y, R + 0.045);
    return { a: aF + 0.035, r: R - 0.05 };
  };
  if (nkp) {
    // Pyle-National headlight on a shelf bracket at the top of the smokebox front, number boards angled back either side
    const hx = 1.62, hy = 4.33, R = 0.27, D = 0.52, aF = hx - D / 2;
    const ln = headlamp(aF, hy, R, D, 'black'); hlPos = [ax(ln.a), hy]; hlR = ln.r; lensA = ln.a;
    // shelf under the case running back to the smokebox front, a web below it and a cradle the drum sits in
    const shelfY = hy - R - 0.02;
    gb.box('black', 0.56, 0.04, 0.46, ax(hx + 0.06), shelfY, 0);
    gb.box('black', 0.22, 0.12, 0.05, ax(hx + 0.24), shelfY - 0.08, 0);
    for (const z of [-0.16, 0.16]) gb.box('black', 0.3, 0.07, 0.04, ax(hx), shelfY + 0.05, z);
    // conduit from the turbo-generator into the back of the case
    bar('dark', 0.018, [ax(hx + 0.2), hy - 0.12, -0.2], [ax(hx + 0.3), shelfY + 0.02, -0.21]);
    // number boards: lit glass boxes on the case sides, swept back 25 degrees, black frames
    const th = 0.44, W = 0.4, H = 0.22, Dp = 0.13, _e = new THREE.Euler(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
    const place = (x, y, z, ry) => _m.compose(new THREE.Vector3(x, y, z), _q.setFromEuler(_e.set(0, ry, 0)), new THREE.Vector3(1, 1, 1)).clone();
    for (const s of [-1, 1]) {
      const zc = s * (R - 0.02 + W / 2 * Math.cos(th)), xc = ax(hx - 0.06) - W / 2 * Math.sin(th), ry = -s * th;
      gb.add('black', new THREE.BoxGeometry(Dp, H + 0.04, W + 0.03), place(xc, hy - 0.01, zc, ry));
      gb.add('num' + key, new THREE.PlaneGeometry(W - 0.05, H - 0.04), place(xc + (Dp / 2 + 0.002) * Math.cos(th), hy - 0.01, zc + s * (Dp / 2 + 0.002) * Math.sin(th), Math.PI / 2 + ry));
    }
    // bell hung on a bracket out of the door centre, number plate below it
    gb.box('black', 0.42, 0.1, 0.14, ax(door.a - 0.2), yB + 0.55, 0);
    bell(ax(door.a - 0.32), yB + 0.15 - 0.02);
    const plate = decalMat(128, 128, (g, w, h) => { g.fillStyle = '#121212'; g.beginPath(); g.moveTo(10, 30); g.lineTo(64, 4); g.lineTo(118, 30); g.lineTo(118, 122); g.lineTo(10, 122); g.closePath(); g.fill(); g.strokeStyle = '#d9d5c7'; g.lineWidth = 5; g.stroke(); g.fillStyle = '#e8e4d6'; g.font = 'bold 42px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(spec.num, 64, 76); });
    RMAT['plate' + key] = plate;
    gb.box('black', 0.04, 0.4, 0.4, ax(door.a + 0.005), yB - 0.48, 0);
    gb.add('plate' + key, new THREE.PlaneGeometry(0.42, 0.42), M(ax(door.a - 0.017), yB - 0.48, 0, 0, Math.PI / 2, 0));
    // holiday: a wreath framing the number plate, its back on the plate's mounting
    if (trim) addWreath(gb, 0.34, 0.075, M(ax(door.a - 0.015), yB - 0.48, 0, 0, Math.PI / 2, 0));
  } else {
    // round lamp in the door centre with a brass rim, the bell up on top of the smokebox front, number plate beside the lamp
    { const ln = headlamp(door.a - 0.44, yB + 0.05, 0.3, 0.46, 'brass'); hlPos = [ax(ln.a), yB + 0.05]; hlR = ln.r; lensA = ln.a; }
    // holiday: a wreath round the lamp drum, hugging the case just ahead of the number board
    if (trim) addWreath(gb, 0.41, 0.09, M(ax(door.a - 0.05), yB + 0.05, 0, 0, Math.PI / 2, 0));
    gb.box('black', 0.3, 0.3, 0.3, ax(door.a - 0.05), yB - 0.18, 0);                         // lamp bracket on the door
    gb.box('black', 0.08, 0.24, 0.42, ax(door.a - 0.01), yB - 0.1, 0.55);
    gb.add('num' + key, new THREE.PlaneGeometry(0.34, 0.18), M(ax(door.a - 0.052), yB - 0.1, 0.55, 0, Math.PI / 2, 0));
    // (hung far enough out and up that it swings clear of the smokebox front and the door ring)
    const bY = sbTop - 0.18;
    bell(ax(BOIL.sb[0] - 0.34), bY);
    gb.box('black', 0.62, 0.08, 0.12, ax(BOIL.sb[0] - 0.07), bY + 0.4, 0);                    // bell bracket back over the smokebox
    gb.box('black', 0.1, bY + 0.44 - sbTop + 0.04, 0.12, ax(BOIL.sb[0] + 0.2), (bY + 0.44 + sbTop - 0.04) / 2, 0);
    RMAT['digits' + key] = decalMat(256, 96, (g, w, h) => { g.fillStyle = '#e9e6dc'; g.font = 'bold 74px "Times New Roman", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; if (g.letterSpacing !== undefined) g.letterSpacing = '4px'; g.fillText(spec.num, w / 2, h / 2 + 4); });
    gb.add('digits' + key, new THREE.PlaneGeometry(0.6, 0.22), M(ax(BOIL.sb[0] - 0.14), yB - 0.6, 0, 0, Math.PI / 2, 0));
  }
  // classification lamps on brackets at the top corners of the smokebox front
  // (green when the engine runs as an extra: clsLamps, worked by clicking them, the J key or the Class lamps button)
  const cls = clsLampSet();
  for (const z of [-0.78, 0.78]) {
    const y = yB + 0.78, xf = ax(BOIL.sb[0] - 0.23), s = Math.sign(z);
    gb.box('black', 0.2, 0.24, 0.2, ax(BOIL.sb[0] - 0.13), y, z); gb.box('black', 0.06, 0.06, 0.2, ax(BOIL.sb[0] - 0.02), y - 0.06, z * 0.9);
    clsLens(cls, body, 0.06, xf + 0.003, y, z, Math.PI / 2, 0.55, [xf - 0.1, y, z]);                      // front lens
    clsLens(cls, body, 0.045, ax(BOIL.sb[0] - 0.13), y, z + s * 0.103, s > 0 ? 0 : Math.PI, 0.35);        // side lens
  }

  /* ---- running boards, brackets, steps, handrails ---- */
  for (const s of [-1, 1]) {
    const rbW = RB.zo - RB.zi, rbZ = s * (RB.zi + rbW / 2);
    // low board over the cylinders, the step plate, the high board back to the cab
    gb.box('black', RB.aStep - BOIL.sb[0] + 0.12, RB.t, rbW, ax((BOIL.sb[0] - 0.12 + RB.aStep) / 2), RB.lo - RB.t / 2, rbZ);
    gb.box('black', 0.04, RB.hi - RB.lo, rbW, ax(RB.aStep), (RB.hi + RB.lo) / 2 - RB.t / 2, rbZ);
    gb.box('black', C.a0 - RB.aStep + 0.02, RB.t, rbW, ax((RB.aStep + C.a0) / 2), RB.hi - RB.t / 2, rbZ);
    // edge strip (white on the excursion finish), following the step
    gb.box('rbEdge', RB.aStep - BOIL.sb[0] + 0.12, 0.16, 0.03, ax((BOIL.sb[0] - 0.12 + RB.aStep) / 2), RB.lo - 0.08, s * (RB.zo + 0.015));
    gb.box('rbEdge', 0.03, RB.hi - RB.lo + 0.16, 0.03, ax(RB.aStep), (RB.hi + RB.lo) / 2 - 0.08, s * (RB.zo + 0.015));
    gb.box('rbEdge', C.a0 - RB.aStep, 0.16, 0.03, ax((RB.aStep + C.a0) / 2), RB.hi - 0.08, s * (RB.zo + 0.015));
    // brackets from the boiler (or smokebox, or firebox) out under the boards
    for (const a of [2.3, 3.1]) { const zs = surfZ(a, RB.lo - 0.12) - 0.03; gb.box('dark', 0.08, 0.12, RB.zo - zs - 0.04, ax(a), RB.lo - RB.t - 0.06, s * (zs + (RB.zo - zs - 0.04) / 2)); }
    for (let a = 4.0; a < C.a0 - 0.2; a += 1.45) { const zs = surfZ(a, RB.hi - 0.14) - 0.03; gb.box('dark', 0.08, 0.14, RB.zo - zs - 0.04, ax(a), RB.hi - RB.t - 0.07, s * (zs + (RB.zo - zs - 0.04) / 2)); }
    // handrail along the boiler and its stanchions into the jacket
    const hy = 3.92;
    bar('rod', 0.018, [ax(2.2), hy, s * 1.2], [ax(C.a0 - 0.1), hy, s * 1.2], 6);
    for (let a = 2.4; a < C.a0 - 0.1; a += 1.35) { const zs = surfZ(a, hy) - 0.02; bar('rod', 0.013, [ax(a), hy, s * zs], [ax(a), hy, s * 1.21], 5); }
    // cab steps hung from the cab floor and a grab iron beside them
    for (const y of [0.95, 1.42]) gb.box('dark', 0.5, 0.04, 0.32, ax(C.a0 + 0.55), y, s * 1.45);
    for (const d of [-0.24, 0.24]) gb.box('dark', 0.04, C.bottom - 0.93, 0.32, ax(C.a0 + 0.55) + d, (C.bottom + 0.93) / 2, s * 1.45);
  }
  // air reservoirs slung under the high running boards on straps
  for (const s of [-1, 1]) for (const [a0, a1] of (s > 0 ? [[3.85, 5.55], [8.1, 10.8]] : [[8.1, 10.8]])) {
    const r = 0.25, y = RB.hi - RB.t - 0.04 - r, z = s * 1.36;
    gb.cylX('black', r, r, a1 - a0, 20, ax((a0 + a1) / 2), y, z);
    const yb = RB.hi - RB.t, ys = y + Math.sqrt(r * r - 0.14 * 0.14) - 0.01;   // straps from the board down onto the shell
    for (const a of [a0 + 0.25, a1 - 0.25]) { gb.add('dark', new THREE.TorusGeometry(r + 0.012, 0.016, 6, 20, Math.PI).rotateY(Math.PI / 2).rotateX(Math.PI).translate(ax(a), y, z)); for (const d of [-0.14, 0.14]) gb.box('dark', 0.05, yb - ys, 0.06, ax(a), (yb + ys) / 2, z + d); }
  }
  // power reverse on the engineer's side and the reach rod forward to the reverse shaft arm
  gb.cylX('black', 0.16, 0.16, 1.0, 16, ax(BK.aPR + 0.5), 2.3, 1.36);
  gb.box('dark', 0.14, RB.hi - RB.t - 2.3, 0.14, ax(BK.aPR + 0.5), (RB.hi - RB.t + 2.3) / 2, 1.36);
  // sand pipes: out of the long dome's skirt, down the side of the barrel, under the running board to each driver
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const xd = ax(LG.aD[i]), as = 8.0 + i * 0.62, xs = ax(as), y0 = BOIL.top(as) - 0.08, z0 = BOIL.half(as, y0) - 0.04;
    const y1 = BOIL.bY(as) + 0.2, z1 = BOIL.half(as, y1) + 0.025, y2 = RB.hi - 0.25, z2 = BOIL.half(as, y2) + 0.03;
    gb.tube('dark', [[xs, y0, s * z0], [xs, (y0 + y1) / 2, s * (BOIL.half(as, (y0 + y1) / 2) + 0.025)], [xs, y1, s * z1], [xs - 0.05, y2, s * z2], [lerp(xs, xd + 1.0, 0.5), 2.2, s * 1.14], [xd + 1.0, 1.85, s * 1.12], [xd + 0.95, 0.45, s * 0.82], [xd + 0.86, 0.14, s * 0.75]], 0.025, 40, 5);
  }
  // driver brake shoes & hangers, springs over the boxes
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const xd = ax(LG.aD[i]);
    gb.box('dark', 0.14, 0.42, 0.18, xd + 0.92, 0.62, s * 0.75); gb.box('dark', 0.05, 0.62, 0.05, xd + 0.98, 1.1, s * 0.62);
    for (let k = 0; k < 5; k++) gb.box('dark', 0.9 - k * 0.12, 0.035, 0.14, xd, 1.47 + k * 0.035, s * 0.6);
  }
  // air compressors: NKP on the fireman's side at the front, standing on the low running board and strapped to the smokebox;
  // PM on the pilot deck either side of the smokebox front
  const pump = (x, y0, z, side) => {
    gb.cyl('black', 0.19, 0.19, 0.62, 18, x, y0 + 0.31, z); gb.cyl('black', 0.24, 0.24, 0.52, 18, x, y0 + 0.62 + 0.26, z);
    gb.cyl('graphite', 0.22, 0.22, 0.06, 18, x, y0 + 1.17, z); gb.box('dark', 0.36, 0.08, 0.36, x, y0 + 0.62, z);
    if (side) { const zs = BOIL.half(LG.ref - x, y0 + 0.9); gb.box('dark', 0.12, 0.12, Math.abs(z) - zs + 0.02, x, y0 + 0.9, Math.sign(z) * (zs + (Math.abs(z) - zs) / 2 - 0.01)); }
  };
  const pumpPos = [];
  if (nkp) for (const a of [2.35, 3.05]) { pump(ax(a), RB.lo, -1.42, true); pumpPos.push(a); }
  else for (const z of [-0.88, 0.88]) { pump(ax(1.28), pil.deckY + 0.05, z, false); pumpPos.push(1.28); }
  // outside steam pipes from the smokebox down to the valve chests
  for (const s of [-1, 1]) gb.tube('black', [[ax(cylA), yB - 0.25, s * 0.95], [ax(cylA), yB - 0.55, s * 1.08], [ax(cylA), RB.lo - 0.2, s * 1.14], [ax(cylA), LG.yV + 0.25, s * 1.13]], 0.15, 16, 12);
  // injector and feed pipes, engineer's side under the cab
  gb.cylX('brass', 0.1, 0.1, 0.4, 10, ax(C.a0 - 0.6), 1.75, 1.42);
  gb.box('dark', 0.1, 0.25, 0.25, ax(C.a0 - 0.6), 1.9, 1.3);
  gb.tube('dark', [[ax(C.a0 - 0.6), 1.75, 1.42], [ax(10.5), 2.2, 1.3], [ax(7.0), 2.55, 1.18], [ax(5.6), 2.75, 1.12], [ax(5.45), 3.6, BOIL.half(5.45, 3.6) + 0.03], [ax(5.4), 4.05, 0.35]], 0.05, 48, 6);
  gb.tube('dark', [[ax(12.0), 2.0, -1.33], [ax(9.5), 2.4, -1.25], [ax(5.8), 2.75, -1.12], [ax(5.45), 3.6, -(BOIL.half(5.45, 3.6) + 0.03)], [ax(5.4), 4.05, -0.35]], 0.045, 48, 6);
  // Worthington hot-water pump, fireman's side under the running board
  gb.cyl('black', 0.2, 0.2, 0.9, 16, ax(7.4), 2.25, -1.32); gb.cyl('dark', 0.24, 0.24, 0.08, 16, ax(7.4), 2.70, -1.32); gb.cyl('dark', 0.24, 0.24, 0.08, 16, ax(7.4), 1.80, -1.32);
  gb.box('dark', 0.14, RB.hi - RB.t - 2.74, 0.14, ax(7.4), (RB.hi - RB.t + 2.74) / 2, -1.32);

  /* ---- cab ---- */
  let cab;
  {
    const x0 = C.x0, x1 = C.x1, fl = C.fl, hw = C.hw, L = x0 - x1, aRoof1 = 17.85;
    // side sheets: from the cab bottom to the eaves, the top running back over the deck in a curve; two window openings
    for (const s of [-1, 1]) {
      const sh = new THREE.Shape();
      sh.moveTo(x1, C.bottom); sh.lineTo(x0, C.bottom); sh.lineTo(x0, C.roofY); sh.lineTo(ax(17.72), C.roofY);
      sh.quadraticCurveTo(x1 - 0.05, C.roofY - 0.05, x1, C.roofY - 0.62); sh.lineTo(x1, C.bottom);
      const w = C.side, mid = (w.a0 + w.a1) / 2;
      for (const [a0, a1] of [[w.a0, mid - 0.04], [mid + 0.04, w.a1]]) { const h = new THREE.Path(); h.moveTo(ax(a1), w.y0); h.lineTo(ax(a0), w.y0); h.lineTo(ax(a0), w.y1); h.lineTo(ax(a1), w.y1); h.closePath(); sh.holes.push(h); }
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false, curveSegments: 12 });
      g.translate(0, 0, s * hw - 0.025); gb.add('black', g);
      // sashes: 2 x 2 panes each, the frame proud of the sheet
      for (const [a0, a1] of [[w.a0, mid - 0.04], [mid + 0.04, w.a1]]) {
        const am = (a0 + a1) / 2, wa = a1 - a0, hy = w.y1 - w.y0, ym = (w.y0 + w.y1) / 2;
        gb.box('winGlass', wa, hy, 0.012, ax(am), ym, s * (hw - 0.03));
        gb.box('black', 0.04, hy, 0.03, ax(am), ym, s * (hw - 0.012)); gb.box('black', wa, 0.04, 0.03, ax(am), ym, s * (hw - 0.012));
      }
      gb.box('black', w.a1 - w.a0 + 0.14, 0.04, 0.06, ax((w.a0 + w.a1) / 2), w.y1 + 0.05, s * (hw + 0.03));   // drip strip over the windows
      gb.box('black', w.a1 - w.a0 + 0.1, 0.05, 0.16, ax((w.a0 + w.a1) / 2), w.y0 - 0.03, s * (hw + 0.08));      // arm rest
      gb.box('dark', 0.05, 0.05, 0.08, ax(w.a0 + 0.1), w.y0 - 0.03, s * (hw + 0.03)); gb.box('dark', 0.05, 0.05, 0.08, ax(w.a1 - 0.1), w.y0 - 0.03, s * (hw + 0.03));
      bar('rod', 0.014, [ax(C.a1 - 0.08), C.bottom + 0.15, s * (hw + 0.06)], [ax(C.a1 - 0.08), C.roofY - 0.8, s * (hw + 0.06)], 6);   // grab irons at the cab door opening
      for (const y of [C.bottom + 0.15, C.roofY - 0.8]) gb.box('dark', 0.04, 0.04, 0.07, ax(C.a1 - 0.08), y, s * (hw + 0.03));
    }
    // front wall: rectangle up to the eaves plus the roof arch, cut round the firebox, two windows
    {
      const sh = new THREE.Shape(); sh.moveTo(-hw, fl); sh.lineTo(hw, fl); sh.lineTo(hw, C.roofY);
      for (let i = 1; i < 16; i++) { const z = hw - i / 16 * 2 * hw; sh.lineTo(z, C.arch(z) - 0.01); }
      sh.lineTo(-hw, C.roofY); sh.lineTo(-hw, fl);
      const yb = fl + 0.03, hole = new THREE.Path(), pad = 0.012;
      hole.moveTo(-C.fbHalf(yb) - pad, yb); hole.lineTo(C.fbHalf(yb) + pad, yb); hole.lineTo(FB.r + pad, FB.cy); hole.absarc(0, FB.cy, FB.r + pad, 0, Math.PI, false); hole.lineTo(-C.fbHalf(yb) - pad, yb);
      sh.holes.push(hole);
      const fw = C.front;
      // both window holes wound the same way round (clockwise), or the triangulator fills one of them in
      for (const s of [-1, 1]) { const h = new THREE.Path(), lo = Math.min(s * fw.zi, s * fw.zo), hi = Math.max(s * fw.zi, s * fw.zo); h.moveTo(lo, fw.y0); h.lineTo(lo, fw.y1); h.lineTo(hi, fw.y1); h.lineTo(hi, fw.y0); h.lineTo(lo, fw.y0); sh.holes.push(h); }
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false, curveSegments: 24 });
      g.rotateY(Math.PI / 2); g.translate(x0 - 0.025, 0, 0); gb.add('black', g);
      for (const s of [-1, 1]) gb.box('winGlass', 0.012, fw.y1 - fw.y0, fw.zo - fw.zi, x0 - 0.01, (fw.y0 + fw.y1) / 2, s * (fw.zi + fw.zo) / 2);
      gb.box('black', 0.08, 0.05, 2 * hw, x0 + 0.03, fl + 0.02, 0);
    }
    // roof: an arched sheet from ahead of the front wall back over the deck, eave strips and a ventilator
    {
      const rs = new THREE.Shape(), o = 0.07, n = 20;
      rs.moveTo(-hw - o, C.roofY - 0.02);
      for (let i = 0; i <= n; i++) { const z = -hw - o + i / n * 2 * (hw + o); rs.lineTo(z, C.arch(clamp(z, -hw, hw)) + 0.0); }
      for (let i = n; i >= 0; i--) { const z = -hw - o + i / n * 2 * (hw + o); rs.lineTo(z, C.arch(clamp(z, -hw, hw)) - C.roofT); }
      const rg = new THREE.ExtrudeGeometry(rs, { depth: aRoof1 - C.a0 + 0.1, bevelEnabled: false });
      rg.rotateY(Math.PI / 2); rg.translate(ax(aRoof1), 0, 0); gb.add('roof', rg);
      for (const s of [-1, 1]) gb.box('black', aRoof1 - C.a0 + 0.1, 0.06, 0.05, ax((aRoof1 + C.a0 - 0.1) / 2), C.roofY - 0.03, s * (hw + 0.05));
      gb.box('roof', 1.0, 0.18, 0.9, ax((C.a0 + C.a1) / 2), C.crown + 0.06, 0);               // ventilator hatch
      gb.box('roof', 1.1, 0.04, 1.0, ax((C.a0 + C.a1) / 2), C.crown + 0.16, 0);
      // rear of the roof: a curved storm sheet down to the side extensions
      gb.box('roof', 0.05, 0.25, 2 * hw + 0.1, ax(aRoof1) + 0.025, C.roofY - 0.1, 0);
      // holiday: snow lying on the roof (the boiler is too warm to hold any)
      if (trim) {
        const pts = []; for (let i = 0; i <= 24; i++) { const z = -hw + i / 24 * 2 * hw; pts.push([z, C.arch(z)]); }
        const L = aRoof1 - C.a0 - 0.12;
        gb.add('snow', snowCap(pts, 0.05, L, 0.35).translate(ax(aRoof1 - 0.06), 0, 0));
      }
    }
    // floor and the deck back to the tender
    gb.box('dark', L + 0.05, 0.08, 2 * hw - 0.02, x1 + (L + 0.05) / 2, fl - 0.04, 0);
    gb.box('dark', 0.48, 0.02, 1.5, x1 - 0.24 + 0.01, fl + 0.01, 0);                               // fall plate, resting on the tender deck
    for (const s of [-1, 1]) gb.box('dark', L, C.bottom - 1.66, 0.12, x1 + L / 2, (C.bottom + 1.66) / 2, s * 0.9);   // posts from the cradle up under the floor
    // cab number
    const cabNum = decalMat(256, 128, (g, w, h) => romanText(g, spec.num, w / 2, h / 2 + 4, 104, '#ebe8dd', 0.02));
    RMAT['cab' + key] = cabNum;
    for (const s of [-1, 1]) gb.add('cab' + key, new THREE.PlaneGeometry(1.0, 0.5), M(ax(15.95), 2.5, s * (hw + 0.026), 0, s > 0 ? 0 : Math.PI, 0));
    // interior: backhead, gauges, firedoor, seats, levers
    cab = steamCab(gb, body, { x0: C.x0, x1: C.x1, fl: C.fl, floor: C.fl, hw: C.hw, bh: C.bh, FB: C.FB, ceil: C.ceil, fwin: C.front, side: C.side, eyeY: 3.6 });
  }
  /* ---- trailing truck: Delta cast frame outside the wheels, pivoted ahead of the firebox ---- */
  for (const s of [-1, 1]) {
    const z = s * 1.0;
    gb.box('dark', LG.aT[1] - LG.aT[0] + 0.9, 0.34, 0.16, ax((LG.aT[0] + LG.aT[1]) / 2), 0.72, z);
    for (let i = 0; i < 2; i++) gb.box('dark', 0.36, 0.5, 0.26, ax(LG.aT[i]), i ? LG.rT2 : LG.rT1, z);   // journal boxes
    gb.box('dark', 0.16, 0.36, 0.16, ax(LG.aT[1] + 0.5), 0.88, z * 0.9);
    bar('dark', 0.07, [ax(LG.aT[0] - 0.4), 0.8, z], [ax(11.4), 1.1, s * 0.4], 8);               // the Delta arms to the pivot
  }
  gb.box('dark', 0.3, 0.3, 2.1, ax(LG.aT[0] - 0.45), 0.85, 0);
  gb.box('dark', 0.3, 0.3, 2.1, ax(LG.aT[1] + 0.55), 0.95, 0);
  gb.box('dark', 0.5, 0.36, 0.9, ax(11.4), 1.12, 0);                                           // pivot casting under the cradle
  for (const s of [-1, 1]) gb.box('dark', 0.4, (C.bottom - 0.1) - 1.12, 0.2, ax(LG.aT[1] + 0.55), ((C.bottom - 0.1) + 1.12) / 2, s * 0.9);   // rear frame posts
  gb.box('dark', 0.6, 0.3, 1.2, ax(LG.len - 0.2), 1.0, 0);                                    // drawbar pocket at the back
  gb.box('dark', 0.2, 0.7, 2.0, ax(LG.len - 0.1), 1.45, 0);                                   // rear buffer beam under the deck

  const statics = gb.build({ ...RMAT, black: RMAT.black });
  body.add(statics);

  /* ---- glows & lights ---- */
  const lens = new THREE.Mesh(new THREE.CircleGeometry(hlR, 36), RMAT.hlLens); lens.position.set(ax(lensA) + 0.004, hlPos[1], 0); lens.rotation.y = Math.PI / 2; body.add(lens);
  const fire = new THREE.Mesh(new THREE.PlaneGeometry(...cab.fireSize), RMAT.glow.clone()); fire.position.copy(cab.firePos); fire.rotation.y = -Math.PI / 2; body.add(fire);
  const beam = headBeam(ax(lensA), hlPos[1], -0.04); body.add(beam);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  halo.position.set(ax(lensA) + 0.06, hlPos[1], 0); halo.scale.set(2.6, 2.6, 1); body.add(halo);
  const ash = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.0), new THREE.MeshBasicMaterial({ color: 0xff5a1a, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending }));
  ash.rotation.x = Math.PI / 2; ash.position.set(ax(13.2), FB.base - 0.73, 0); body.add(ash);

  /* ---- moving parts ---- */
  const parts = { drivers: [], lead: null, trail: [], rods: {} };
  const centre = spec.wheels === 'spoked' ? spokedCentre : boxpokCentre;
  const mainG = driverAxle(LG.rD, true, centre), sideG = driverAxle(LG.rD, false, centre);
  for (let i = 0; i < 4; i++) {
    const g = i === 2 ? mainG : sideG;
    const grp = new THREE.Group(); grp.position.set(ax(LG.aD[i]), LG.rD, 0);
    for (const k of ['black', 'tire', 'rod', 'wall']) { const m = new THREE.Mesh(g[k], k === 'black' ? RMAT.black : k === 'tire' ? RMAT.tire : k === 'wall' ? RMAT.dWall : RMAT.rod); m.castShadow = k !== 'wall'; m.receiveShadow = true; grp.add(m); }
    body.add(grp); parts.drivers.push(grp);
  }
  const rL = spec.leadR || LG.rL;
  const leadG = plainAxle(rL), tr1G = plainAxle(LG.rT1), tr2G = plainAxle(LG.rT2);
  const wallG = R => mergeGeos([new THREE.RingGeometry(R - 0.062, R + 0.001, 36).translate(0, 0, RAIL_OFF + 0.0665), new THREE.RingGeometry(R - 0.062, R + 0.001, 36).rotateY(Math.PI).translate(0, 0, -(RAIL_OFF + 0.0665))]);
  const mk = (G, R) => { const grp = new THREE.Group(); for (const k of ['black', 'tire']) { const m = new THREE.Mesh(G[k], k === 'black' ? RMAT.black : RMAT.tire); m.castShadow = true; grp.add(m); } grp.add(new THREE.Mesh(wallG(R), RMAT.dWall)); return grp; };
  // lead truck (swivels, so positioned in world by the train): equalized frame with journal boxes outside the wheels
  const leadTruck = new THREE.Group();
  { const lg = new GeoBin();
    for (const s of [-1, 1]) { lg.box('dark', 1.3, 0.22, 0.14, 0, rL + 0.12, s * 0.98); lg.box('dark', 0.34, 0.44, 0.24, 0, rL, s * 0.98); lg.box('dark', 0.8, 0.05, 0.14, 0, rL + 0.27, s * 0.98); }
    lg.box('dark', 0.36, 0.2, 2.1, 0, rL + 0.22, 0);
    lg.box('dark', 2.0, 0.16, 0.26, -1.05, rL + 0.3, 0);                                       // radius bar back to the frame
    lg.box('dark', 0.5, 0.18, 0.5, 0, rL + 0.4, 0);                                             // centre bearing up to the deck casting
    leadTruck.add(lg.build(RMAT)); }
  const la = mk(leadG, rL); la.position.y = rL; leadTruck.add(la); parts.lead = la;
  const t1 = mk(tr1G, LG.rT1); t1.position.set(ax(LG.aT[0]), LG.rT1, 0); body.add(t1);
  const t2 = mk(tr2G, LG.rT2); t2.position.set(ax(LG.aT[1]), LG.rT2, 0); body.add(t2);
  parts.trail = [t1, t2];
  // rods per side
  const R = RMAT.rod;
  for (const s of [-1, 1]) {
    const P = {
      side: [0, 1, 2].map(i => { const L = LG.aD[i + 1] - LG.aD[i]; const m = new THREE.Mesh(rodGeo(L, 0.16, 0.16, 0.07, 0.13, 0.13), R); m.castShadow = true; body.add(m); return m; }),
      main: (() => { const m = new THREE.Mesh(rodGeo(LG.Lm, 0.26, 0.15, 0.09, 0.19, 0.12), R); m.castShadow = true; body.add(m); return m; })(),
      cross: (() => { const g = new GeoBin(); g.box('rod', 0.5, 0.3, 0.2, 0, 0, 0); g.box('dark', 0.12, 0.42, 0.1, 0.05, -0.32, 0); const m = g.build(RMAT); body.add(m); return m; })(),
      piston: (() => { const L = 1.82 + 0.3; const m = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, L, 10).rotateZ(Math.PI / 2).translate(L / 2, 0, 0), R); body.add(m); return m; })(),
      ecc: (() => { const m = new THREE.Mesh(rodGeo(0.3, 0.12, 0.1, 0.06, 0.1, 0.07), R); body.add(m); return m; })(),
      eccRod: (() => { const m = new THREE.Mesh(rodGeo(BK.Lecc, 0.1, 0.085, 0.05, 0.065, 0.06), R); m.castShadow = true; body.add(m); return m; })(),
      gcr: (() => { const m = new THREE.Mesh(rodGeo(BK.d2, 0.11, 0.08, 0.055, 0.065, 0.055), R); m.castShadow = true; body.add(m); return m; })(),
      rbar: (() => { const g = new GeoBin(); for (const dz of [-0.055, 0.055]) g.add('rod', rodGeo(BK.Lrb, 0.06, 0.06, 0.025, 0.04, 0.04).translate(0, 0, dz)); const m = g.build(RMAT); body.add(m); return m; })(),
      yoke: (() => { const g = new GeoBin(); for (const dz of [-0.11, 0.11]) g.add('black', rodGeo(BK.Lrb, 0.12, 0.08, 0.03, 0.08, 0.05).translate(0, 0, dz)); g.box('black', 0.06, 0.07, 0.25, BK.Lrb, 0, 0); const m = g.build(RMAT); body.add(m); return m; })(),
      bell: (() => { const g = new GeoBin(); g.add('rod', rodGeo(BK.hb, 0.1, 0.07, 0.05, 0.075, 0.05).rotateZ(Math.PI)); g.add('rod', rodGeo(BK.vb, 0.1, 0.07, 0.05, 0, 0.05).rotateZ(-Math.PI / 2)); const m = g.build(RMAT); body.add(m); return m; })(),
      vrod: (() => { const m = new THREE.Mesh(rodGeo(BK.Lvr, 0.075, 0.07, 0.045, 0.05, 0.05), R); m.castShadow = true; body.add(m); return m; })(),
      comb: (() => { const g = new THREE.BoxGeometry(0.08, LG.a + LG.b + 0.1, 0.05).translate(0, -(LG.a + LG.b) / 2, 0); const m = new THREE.Mesh(g, R); body.add(m); return m; })(),
      union: (() => { const m = new THREE.Mesh(rodGeo(LG.Lu, 0.07, 0.07, 0.04, 0.045, 0.045), R); body.add(m); return m; })(),
      vstem: (() => { const g = new GeoBin(); g.add('rod', new THREE.CylinderGeometry(0.035, 0.035, 1.0, 8).rotateZ(Math.PI / 2).translate(0.5, 0, 0)); g.box('rod', 0.18, 0.14, 0.3, 0, 0, s * 0.11); const m = g.build(RMAT); body.add(m); return m; })(),
      reach: (() => { const L = BK.aPR - BK.aShaft; const m = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, L, 6).rotateZ(Math.PI / 2).translate(L / 2, 0, 0), RMAT.black); body.add(m); return m; })(),
    };
    parts.rods[s] = P;
  }
  // tap hitbox
  const hit = new THREE.Mesh(new THREE.BoxGeometry(LG.len, 4.8, 3.3), RMAT.hit); hit.position.set(ax(LG.len / 2), 2.4, 0); body.add(hit);
  root.traverse(o => { if (o.isMesh) { o.castShadow = o.castShadow !== false && o.material !== RMAT.hit; o.receiveShadow = true; } });
  lens.castShadow = false; fire.castShadow = false; ash.castShadow = false;
  return { root, body, parts, leadTruck, lens, couplers: [coupler, null], fire, ash, beam, halo, spec, rL,
    stackPos: new THREE.Vector3(ax(stackA), 4.8, 0), cockPos: [new THREE.Vector3(ax(cylA), 0.4, 1.2), new THREE.Vector3(ax(cylA), 0.4, -1.2)],
    safetyPos: new THREE.Vector3(ax(12.15), fbTop + 0.35, 0), whistlePos: new THREE.Vector3(ax(wh[0]), wh[1] + 0.6, wh[2]),
    pumpPos: new THREE.Vector3(ax(pumpPos[0]), nkp ? RB.lo + 1.2 : pil.deckY + 1.25, nkp ? -1.42 : -0.88), injPos: new THREE.Vector3(ax(C.a0 - 0.5), 1.5, 1.45),
    cabEye: cab.eye, cab, headlightPos: new THREE.Vector3(ax(lensA), hlPos[1], 0), bellRig: bellR, cls };
}

/* A locomotive bell that swings on its yoke while it rings. (x, y) is the trunnion axis, which runs across the
   engine, s scales the 765's bell (0.25 m across the mouth) and A is the swing either way in radians. The bell,
   its clapper and the ringer's crank arm are built round the axis in their own group; bellSwing turns it. */
function bellRig(parent, x, y, s = 1, A = 0.3) {
  const gb = new GeoBin(), py = 0.22;
  gb.add('brass', new THREE.LatheGeometry([[0, 0.27], [0.09, 0.27], [0.16, 0.24], [0.21, 0.13], [0.25, 0.0], [0.24, -0.01]].map(p => new THREE.Vector2(p[0] * s, (p[1] - py) * s)), 28));
  gb.add('brass', new THREE.LatheGeometry([[0.2, 0.0], [0.21, 0.13], [0.16, 0.24], [0.0, 0.25]].map(p => new THREE.Vector2(p[0] * s, (p[1] - py) * s)), 28));   // inside of the bell
  gb.cyl('dark', 0.01 * s, 0.01 * s, 0.16 * s, 6, 0, -0.1 * s, 0); gb.add('dark', new THREE.SphereGeometry(0.035 * s, 10, 8).translate(0, -0.19 * s, 0));    // clapper
  gb.box('black', 0.04 * s, 0.16 * s, 0.03 * s, 0, 0.07 * s, 0.25 * s);                                                     // ringer's crank arm
  gb.cylZ('black', 0.045 * s, 0.05 * s, 10, 0, 0, 0.25 * s);
  const g = new THREE.Group(); g.position.set(x, y, 0); g.add(gb.build(RMAT)); parent.add(g);
  return { g, A, amp: 0, ph: 0, sgn: 1 };
}
/* swing every bell on a train: a stroke at each end of the swing, strokes P seconds apart. t is the time since the
   last stroke and struck says one rang this frame (the sound's own timer), so the bell is at full lean as it sounds.
   Let go, it swings on and dies away. */
function bellSwing(T, on, t, P, struck, dt) {
  const rigs = T.diesel ? T.units.map(u => u.bellRig) : [T.loco && T.loco.bellRig];
  for (const r of rigs) {
    if (!r) continue;
    if (on) { if (struck) r.sgn = -r.sgn; r.ph = clamp(t / P, 0, 1); r.amp += (r.A - r.amp) * Math.min(1, dt * 3); }
    else { if (r.amp < 0.002) { r.amp = 0; r.g.rotation.z *= Math.max(0, 1 - dt * 6); continue; } r.ph += dt / P; if (r.ph >= 1) { r.ph -= 1; r.sgn = -r.sgn; } r.amp *= Math.exp(-dt * 1.4); }
    const target = r.amp * r.sgn * Math.cos(Math.PI * r.ph);
    r.g.rotation.z += (target - r.g.rotation.z) * Math.min(1, dt * 25);
  }
}
/* classification lamps: green lenses with their glows, all on one material so they light together */
function clsLampSet() {
  return { mat: new THREE.MeshStandardMaterial({ color: 0x163222, metalness: 0.2, roughness: 0.12, emissive: 0x39ff7c, emissiveIntensity: 0 }), glows: [], lenses: [], at: [], on: -1 };
}
function clsLens(cls, parent, r, x, y, z, ry, glow, pick) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 14), cls.mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = false; parent.add(m); cls.lenses.push(m);
  if (typeof markerGlow === 'function') {
    const g = markerGlow(glow); g.material.color.setHex(0x2aff6a); g.position.set(x + 0.04 * Math.sin(ry), y, z + 0.04 * Math.cos(ry)); parent.add(g); cls.glows.push(g);
  }
  if (pick) cls.at.push(new THREE.Vector3(...pick));
}
/* light or put out an engine's class lamps; cheap to call every frame */
function clsLampsShow(cls, on) {
  if (!cls) return;
  const dk = (typeof SKY !== 'undefined' && SKY.dark) || 0, day = lerp(0.3, 1, smooth(0.1, 0.5, dk)), v = on ? 1 : 0;
  if (cls.on !== v) { cls.on = v; cls.mat.emissiveIntensity = on ? 1.3 : 0; cls.mat.color.setHex(on ? 0x2a6a44 : 0x163222); }
  for (const g of cls.glows) { g.visible = !!on; if (on) g.material.opacity = 0.85 * day; }
}

/* Paint finish for the steam engines: as delivered (graphite smokebox and firebox),
   excursion white trim (tire faces and running-board edges), plain black, or the holiday
   trim (all black here; the wreaths, garland and snow are built with the train). */
function applySteamFinish(k) {
  if (!RMAT.graphite) return;
  const set = (m, hex) => { m.color.set(hex).convertSRGBToLinear(); m.userData.lin = true; };
  const white = 0xe9e6dc;
  const blk = k === 'black' || k === 'polar';   // the holiday trim is all black, like the film's engine
  set(RMAT.graphite, blk ? 0x19191a : 0x45474a); RMAT.graphite.roughness = blk ? 0.5 : 0.66;
  const wt = k === 'white';
  set(RMAT.rbEdge, wt ? white : 0x141516);
  set(RMAT.dWall, wt ? white : 0x141516);
  RMAT.dWall.metalness = RMAT.rbEdge.metalness = wt ? 0.05 : 0.25;
  RMAT.dWall.roughness = wt ? 0.62 : 0.5;
}

/* Paint for the coaches (the holiday trim keeps its own maroon): a few railroad standards, or any colour */
const COACH_PAINT = {
  pullman: { name: 'Pullman green', sub: 'Heavyweight standard', c: 0x2a3a2a },
  tuscan: { name: 'Tuscan red', sub: 'Pennsy style', c: 0x5a2219 },
  blue: { name: 'Royal blue', sub: 'Limited express', c: 0x1d3150 },
  black: { name: 'Black', sub: 'Business car', c: 0x18191a },
  custom: { name: 'Custom', sub: 'Pick a colour', c: null },
};
function coachPaintHex(k, custom) { return k === 'custom' ? (custom >>> 0) & 0xffffff : (COACH_PAINT[k] || COACH_PAINT.pullman).c; }
function applyCoachPaint(k, custom) {
  if (!RMAT.green) return;
  carMaterials();
  const hex = coachPaintHex(k, custom);
  for (const m of [RMAT.green, RMAT.greenLow, RMAT.greenSill]) { m.color.set(hex).convertSRGBToLinear(); m.userData.lin = true; }
}

/* =================== HOLIDAY TRIM =================== */
/* The "North Pole" finish dresses a steam train for a Christmas excursion: a wreath on the smokebox front,
   garland swags and wreaths on the coaches, snow lying on the cab roof, the tender and the car roofs, warm
   windows, and the cars in deep maroon with gold lining and our own POLAR LIMITED lettering. The trim is
   built with the train (Train opts.trim) so other trains on the road keep their everyday paint. */
const TRIM = {
  polar: { road: 'POLAR LIMITED', drum: ['THE', 'POLAR', 'LIMITED'], gold: '#e0bd62', body: 0x4d1418 },
};
function trimMaterials() {
  if (RMAT.snow || !RMAT.black) return;
  const S = (c, m, r, extra = {}) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r, ...extra });
  // fresh snow: near white with a cool tint, matte, a few sparkles in the texture
  const snowTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#f4f7fb'; g.fillRect(0, 0, w, h); const r = rng(1225); for (let i = 0; i < 900; i++) { const v = 228 + ((r() * 27) | 0); g.fillStyle = `rgb(${v - 6},${v - 2},${v})`; g.fillRect(r() * w, r() * h, 2, 2); } }, { repeat: true });
  RMAT.snow = S(0xf2f5fa, 0, 0.82, { map: snowTex });
  // a dusting: the same snow, broken into patches by an alpha map so the coal shows through
  const dust = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h); const r = rng(1941);
    for (let i = 0; i < 1600; i++) { const x = r() * w, y = r() * h, rr = 1.5 + r() * 4.5, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, 2 * rr, 2 * rr); }
  }, { srgb: false });
  RMAT.snowDust = S(0xf2f5fa, 0, 0.85, { alphaMap: dust, alphaTest: 0.45, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  RMAT.snowDust.side = THREE.DoubleSide;
  // fir garland: deep green needles, a little lighter at the tips
  const fir = canvasTex(128, 64, (g, w, h) => { g.fillStyle = '#2b6236'; g.fillRect(0, 0, w, h); const r = rng(24); for (let i = 0; i < 700; i++) { const x = r() * w, y = r() * h, a = r() * TAU, l = 3 + r() * 6; g.strokeStyle = r() < 0.5 ? '#4f9257' : '#1d4a28'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); } }, { repeat: true });
  RMAT.garland = S(0xffffff, 0, 0.85, { map: fir });
  RMAT.ribbon = S(0xb3141c, 0.05, 0.42);
  RMAT.berry = S(0xc8161e, 0.1, 0.3);
  RMAT.gold = S(0xd2a446, 0.9, 0.3);
  RMAT.holBody = S(TRIM.polar.body, 0.25, 0.42); RMAT.holBody.envMapIntensity = 0.9;
  // car windows that glow a little even by day, like a train with every lamp lit inside
  RMAT.holWin = RMAT.coachWin.clone(); RMAT.holWin.userData = { litAt: 0.15, litI: 1.3, minI: 0.14 };
  SCN.winMats.push(RMAT.holWin);
  for (const k of ['snow', 'garland', 'ribbon', 'holBody']) RMAT[k].side = THREE.DoubleSide;
}
/* a smooth, repeatable bump at a point, so vertices that share a position move together and seams stay closed */
function fluff(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s) - 0.5; }
function fluffGeo(g, amt) {
  const p = g.attributes.position, n = g.attributes.normal;
  if (!p || !n || !(p.count > 0)) return g;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = fluff(Math.round(x * 400), Math.round(y * 400), Math.round(z * 400)) * amt;
    p.setXYZ(i, x + n.getX(i) * k, y + n.getY(i) * k, z + n.getZ(i) * k);
  }
  g.computeVertexNormals(); return g;
}
/* A layer of snow lying on a roof: pts is the roof's top line across the car, [z, y] pairs from one side to the
   other; the layer is t thick in the middle and thins to nothing at both edges. Its underside sits a few mm
   into the roof so it never floats. Runs along x from 0 to L. */
function snowCap(pts, t, L, edge = 0.25) {
  const z0 = pts[0][0], z1 = pts[pts.length - 1][0], s = new THREE.Shape();
  const th = z => t * Math.min(1, smooth(0, edge, z - z0) * 0.85 + 0.15, smooth(0, edge, z1 - z) * 0.85 + 0.15);
  s.moveTo(-pts[0][0], pts[0][1] - 0.006);
  for (const [z, y] of pts) s.lineTo(-z, y + th(z));
  for (let i = pts.length - 1; i >= 0; i--) s.lineTo(-pts[i][0], pts[i][1] - 0.006);
  const g = new THREE.ExtrudeGeometry(s, { depth: L, bevelEnabled: false });
  g.rotateY(Math.PI / 2);   // shape x (minus z) back to z, the extrusion along +x
  return g;
}
/* points along a quadratic curve, [z, y] */
function quadPts(p0, c, p1, n, t0 = 0, t1 = 1) {
  const out = []; for (let i = 0; i <= n; i++) { const t = lerp(t0, t1, i / n), u = 1 - t; out.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]); } return out;
}
/* A wreath of fir with a red bow at the bottom and berries round the ring. Built facing +z (its back on z = 0)
   and placed by matrix m: R ring radius, r thickness. */
function addWreath(gb, R, r, m) {
  const ring = fluffGeo(new THREE.TorusGeometry(R, r, 10, 40), r * 0.5); ring.scale(1, 1, 0.75); ring.translate(0, 0, r * 0.75);
  gb.add('garland', ring, m);
  const rb = rng(Math.round(R * 1000));
  for (let i = 0; i < 9; i++) { const a = Math.PI / 2 + (i + 0.5) / 9 * TAU * 0.86 - TAU * 0.43 + Math.PI; const rr = R + (rb() - 0.5) * r * 0.9; gb.add('berry', new THREE.IcosahedronGeometry(r * 0.28, 0).translate(Math.cos(a) * rr, Math.sin(a) * rr, r * 1.35), m); }
  // the bow: two loops, a knot and two tails, on the face of the ring at the bottom
  const by = -R, bz = r * 1.35;
  for (const s of [-1, 1]) {
    gb.add('ribbon', new THREE.SphereGeometry(r * 0.9, 10, 6).scale(1.25, 0.7, 0.45).rotateZ(s * 0.35).translate(s * r * 1.05, by + r * 0.2, bz), m);
    gb.add('ribbon', new THREE.BoxGeometry(r * 0.5, r * 2.6, r * 0.18).rotateZ(s * 0.32).translate(s * r * 0.55, by - r * 1.3, bz - r * 0.1), m);
  }
  gb.add('ribbon', new THREE.SphereGeometry(r * 0.55, 10, 6).scale(1, 1, 0.7).translate(0, by + r * 0.15, bz + r * 0.05), m);
}
/* garland hung in swags between anchor points along a car side at face z, sagging dy between them, a bow at each anchor */
function addSwags(gb, xs, y, dy, z, r, bows = true) {
  const pts = [];
  for (let i = 0; i < xs.length - 1; i++) for (let k = 0; k < 6; k++) { const t = k / 6; pts.push([lerp(xs[i], xs[i + 1], t), y - dy * 4 * t * (1 - t), z]); }
  pts.push([xs[xs.length - 1], y, z]);
  const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])));
  gb.add('garland', fluffGeo(new THREE.TubeGeometry(c, (xs.length - 1) * 10, r, 7, false), r * 0.45));
  if (!bows) return;
  const s = Math.sign(z) || 1;
  for (const x of xs) {
    const m = M(x, y + r * 0.2, z + s * r * 0.7, 0, s > 0 ? 0 : Math.PI, 0);
    for (const d of [-1, 1]) gb.add('ribbon', new THREE.SphereGeometry(r * 0.9, 8, 5).scale(1.2, 0.7, 0.45).rotateZ(d * 0.35).translate(d * r * 1.0, 0, 0), m);
    gb.add('ribbon', new THREE.SphereGeometry(r * 0.5, 8, 5).scale(1, 1, 0.7), m);
    for (const d of [-1, 1]) gb.add('ribbon', new THREE.BoxGeometry(r * 0.45, r * 2.4, r * 0.16).rotateZ(d * 0.3).translate(d * r * 0.5, -r * 1.25, 0), m);
  }
}
/* the finish the menu asks for, as a trim for a new steam train ('' for none) */
function trimWanted() { return (typeof GAME !== 'undefined' && GAME.settings && GAME.settings.finish === 'polar') ? 'polar' : ''; }

/* Valve gear & rods kinematics. theta: driver rotation angle; rev: -1..1 */
function animateBerkshire(L, theta, rev) {
  const p = L.parts;
  for (const d of p.drivers) d.rotation.z = theta;
  const A3x = ax(LG.aD[2]), A3y = LG.rD;
  for (const s of [-1, 1]) {
    const P = p.rods[s];
    const phi = theta + (s > 0 ? 0 : Math.PI / 2);
    const zs = s;
    // crank pins on all drivers
    const pins = LG.aD.map(a => [ax(a) + LG.cr * Math.cos(phi), LG.rD + LG.cr * Math.sin(phi)]);
    // side rods D1-D2, D2-D3, D3-D4 (pivot at the rear pin of each pair... built along +x from first)
    for (let i = 0; i < 3; i++) { const a = pins[i + 1], b = pins[i]; P.side[i].position.set(a[0], a[1], zs * 0.99); P.side[i].rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]); }
    // main rod and crosshead
    const pin = pins[2];
    const wy = LG.yC, wx = pin[0] + Math.sqrt(LG.Lm * LG.Lm - (wy - pin[1]) ** 2);
    P.main.position.set(pin[0], pin[1], zs * 1.1); P.main.rotation.z = Math.atan2(wy - pin[1], wx - pin[0]);
    P.cross.position.set(wx, wy, zs * LG.zC);
    P.piston.position.set(wx, wy, zs * LG.zC);
    // Baker gear: eccentric crank, eccentric rod, gear connecting rod on the radius bars, bell crank, valve rod
    const Rc = [A3x + BK.e * Math.cos(phi - Math.PI / 2), A3y + BK.e * Math.sin(phi - Math.PI / 2)];
    P.ecc.position.set(pin[0], pin[1], zs * 1.21); P.ecc.rotation.z = Math.atan2(Rc[1] - pin[1], Rc[0] - pin[0]);
    P.ecc.scale.x = Math.hypot(Rc[0] - pin[0], Rc[1] - pin[1]) / 0.3;
    const gam = -rev * BK.gMax, Ym = BK.Rmid;
    const Y = [Ym[0] + BK.Lrb * Math.sin(gam), Ym[1] + BK.Lrb * Math.cos(gam)];
    const g = bakerSolve(Rc, Y, P.bk || (P.bk = { b: 0 }));
    const V = [BK.Pb[0] + BK.vb * Math.sin(g.b), BK.Pb[1] - BK.vb * Math.cos(g.b)];
    const Cx = V[0] + Math.sqrt(Math.max(0, BK.Lvr * BK.Lvr - (V[1] - LG.yR) ** 2)), Cy = LG.yR;
    P.eccRod.position.set(Rc[0], Rc[1], zs * 1.25); P.eccRod.rotation.z = Math.atan2(g.E[1] - Rc[1], g.E[0] - Rc[0]);
    P.gcr.position.set(g.E[0], g.E[1], zs * BK.z); P.gcr.rotation.z = Math.atan2(g.B[1] - g.E[1], g.B[0] - g.E[0]);
    P.rbar.position.set(Y[0], Y[1], zs * BK.z); P.rbar.rotation.z = Math.atan2(g.R[1] - Y[1], g.R[0] - Y[0]);
    P.yoke.position.set(Ym[0], Ym[1], zs * BK.z); P.yoke.rotation.z = Math.atan2(Y[1] - Ym[1], Y[0] - Ym[0]);
    P.bell.position.set(BK.Pb[0], BK.Pb[1], zs * 1.37); P.bell.rotation.z = g.b;
    P.vrod.position.set(V[0], V[1], zs * 1.37); P.vrod.rotation.z = Math.atan2(Cy - V[1], Cx - V[0]);
    // union link and combination lever
    const Ux = wx + 0.1, Uy = 0.6, Bx = Ux + LG.Lu, By = 0.62;
    P.union.position.set(Ux, Uy, zs * 1.37); P.union.rotation.z = Math.atan2(By - Uy, Bx - Ux);
    const Tvx = Cx + (Cx - Bx) * (LG.a / LG.b), Tvy = LG.yV;
    P.comb.position.set(Tvx, Tvy, zs * 1.37); P.comb.rotation.z = Math.atan2(Bx - Tvx, -(By - Tvy));
    P.vstem.position.set(Tvx, Tvy, zs * 1.14);
    P.reach.position.set(ax(BK.aPR), 2.3, zs * 1.37); P.reach.rotation.z = rev * 0.02;
  }
}

/* =================== TENDER =================== */
/* 22,000 gal / 22 t, on two six-wheel trucks with 60 in axle spacing. t = metres back from the engine's drawbar
   (the tender's front), heights above the rail. Side profile from the same drawing: the tank sides run up into
   the raised coal bunker with a flare at the front and a slope sheet down to the tank top behind it. */
const TD = { len: 13.626, axles: [1.64, 3.164, 4.688, 8.648, 10.172, 11.696], trucks: [3.164, 10.172], sp: 1.524, hw: 1.60,
  t0: 0.69, t1: 13.07, yBot: 1.12, yTank: 3.62, yBunk: 4.21, bunk: [1.47, 7.25, 8.13], deck: 2.06 };
TD.ref = (TD.trucks[0] + TD.trucks[1]) / 2;
/* the tender's side sheets: service-worn black, coal dust settling from the bunker, water streaks down from the
   tank top, rivet rows along the bottom and the tank-top seam. The extruded sides carry their shape's x, y as uv,
   so the texture is stretched over the whole side once. */
function tenderSideMat(D, tx) {
  if (RMAT.tSide) return;
  const t = canvasTex(1024, 256, (g, w, h) => {
    const r = rng(765), yOf = y => h * (1 - (y - D.yBot) / (D.yBunk - D.yBot)), xOf = a => w * (tx(a) - tx(D.t1)) / (tx(D.t0) - tx(D.t1));
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 30; i++) { const x = r() * w, y0 = yOf(D.yTank) + r() * 6, L = h * (0.15 + r() * 0.45), gr = g.createLinearGradient(0, y0, 0, y0 + L); gr.addColorStop(0, `rgba(190,190,180,${0.06 + r() * 0.08})`); gr.addColorStop(1, 'rgba(190,190,180,0)'); g.fillStyle = gr; g.fillRect(x, y0, 2 + r() * 8, L); }
    const top = g.createLinearGradient(0, 0, 0, h * 0.35); top.addColorStop(0, 'rgba(30,28,26,0.35)'); top.addColorStop(1, 'rgba(30,28,26,0)'); g.fillStyle = top; g.fillRect(0, 0, w, h);
    const bot = g.createLinearGradient(0, h * 0.75, 0, h); bot.addColorStop(0, 'rgba(120,100,80,0)'); bot.addColorStop(1, 'rgba(120,100,80,0.3)'); g.fillStyle = bot; g.fillRect(0, 0, w, h);
    rivetRow(g, 4, h - 6, w - 4, h - 6, 160, 1.6); rivetRow(g, 4, yOf(D.yTank) + 5, xOf(D.bunk[2]), yOf(D.yTank) + 5, 70, 1.6);
  });
  t.repeat.set(1 / (tx(D.t0) - tx(D.t1)), 1 / (D.yBunk - D.yBot)); t.offset.set(-tx(D.t1) * t.repeat.x, -D.yBot * t.repeat.y);
  RMAT.tSide = RMAT.black.clone(); RMAT.tSide.map = t; RMAT.tSide.side = THREE.DoubleSide;
}
function buildTender(key, trim = '') {
  const spec = LOCO_SPEC[key], T = TRIM[trim];
  const root = new THREE.Group();
  const gb = new GeoBin();
  const D = TD, tx = a => D.ref - a, hw = D.hw, Lt = D.len;
  const bar = (k, r, a, b, seg = 8) => gb.add(k, barGeo(r, a, b, seg));
  // cast underframe: centre sill, side sills, bolsters down onto the truck centre plates, end sills
  gb.box('dark', D.t1 - 0.3, 0.22, 0.9, tx((0.3 + D.t1) / 2), D.yBot - 0.11, 0);
  for (const s of [-1, 1]) gb.box('dark', D.t1 - D.t0, 0.16, 0.12, tx((D.t0 + D.t1) / 2), D.yBot - 0.08, s * (hw - 0.08));
  for (const a of D.trucks) gb.box('dark', 0.6, D.yBot - 1.005, 2.6, tx(a), (D.yBot + 1.005) / 2, 0);
  gb.box('dark', 0.3, 0.36, 2.9, tx(D.t1 + 0.12), 1.06, 0);                                   // rear end sill
  // tank & bunker sides: one profile, extruded across as two side sheets
  const prof = new THREE.Shape();
  prof.moveTo(tx(D.t0), D.yBot); prof.lineTo(tx(D.t1), D.yBot); prof.lineTo(tx(D.t1), D.yTank); prof.lineTo(tx(D.bunk[2]), D.yTank);
  prof.lineTo(tx(D.bunk[1]), D.yBunk); prof.lineTo(tx(D.bunk[0]), D.yBunk);
  prof.quadraticCurveTo(tx(D.t0 + 0.1), D.yBunk - 0.05, tx(D.t0), D.yTank - 0.02); prof.lineTo(tx(D.t0), D.yBot);
  tenderSideMat(D, tx);
  for (const s of [-1, 1]) gb.add('tSide', new THREE.ExtrudeGeometry(prof, { depth: 0.04, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, s * (hw - 0.02) - 0.02));
  // bottom, rear, the tank top behind the bunker and the slope sheet up to the bunker
  gb.box('black', D.t1 - D.t0, 0.04, 2 * hw - 0.04, tx((D.t0 + D.t1) / 2), D.yBot + 0.02, 0);
  gb.box('black', 0.04, D.yTank - D.yBot, 2 * hw, tx(D.t1) - 0.02, (D.yTank + D.yBot) / 2, 0);
  gb.box('black', D.t1 - D.bunk[2] + 0.02, 0.04, 2 * hw, tx((D.bunk[2] + D.t1) / 2), D.yTank - 0.02, 0);
  { const a = [tx(D.bunk[2]), D.yTank], b = [tx(D.bunk[1]), D.yBunk], L = Math.hypot(a[0] - b[0], a[1] - b[1]); gb.add('black', new THREE.BoxGeometry(L, 0.04, 2 * hw - 0.04), M((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.02, 0, 0, 0, Math.atan2(b[1] - a[1], b[0] - a[0]))); }
  // front: tank face below the deck, the deck, and the coal bulkhead with its gate
  gb.box('black', 0.04, D.deck - D.yBot, 2 * hw, tx(D.t0) + 0.02, (D.deck + D.yBot) / 2, 0);
  gb.box('dark', D.t0 + 0.3 - 0.25, 0.06, 2 * hw - 0.1, tx((0.25 + D.t0 + 0.3) / 2), D.deck - 0.03, 0);
  gb.box('dark', 0.25, D.deck - 0.03 - 1.0, 1.2, tx(0.38), (D.deck - 0.03 + 1.0) / 2, 0);      // drawbar casting under the deck
  { const bt = D.t0 + 0.3;
    gb.box('black', 0.05, D.yTank - D.deck, 2 * hw - 0.04, tx(bt), (D.yTank + D.deck) / 2, 0);
    gb.box('dark', 0.03, 0.75, 0.8, tx(bt) + 0.03, D.deck + 0.42, 0);                          // coal gate
    for (const z of [-0.43, 0.43]) gb.box('black', 0.06, 0.8, 0.05, tx(bt) + 0.035, D.deck + 0.42, z);
  }
  // coal heaped in the bunker, inside the side sheets
  {
    const a0 = D.t0 + 0.34, a1 = D.bunk[2] - 0.2, La = a1 - a0, W = 2 * hw - 0.1;
    const g = new THREE.PlaneGeometry(La, W, 28, 12); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, r = rng(55);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), u = 1 - (x / (La / 2)) ** 2, v = 1 - (z / (W / 2)) ** 2, h = Math.max(0, u) ** 0.5 * Math.max(0, v) ** 0.6;
      const t = a0 + La / 2 - x, wallTop = t > D.bunk[1] ? lerp(D.yBunk, D.yTank, (t - D.bunk[1]) / (D.bunk[2] - D.bunk[1])) : D.yBunk;
      p.setY(i, Math.min(wallTop - 0.25, D.yTank - 0.1) + h * 0.65 + h * (r() - 0.5) * 0.08);
    }
    g.computeVertexNormals(); g.translate(tx(a0 + La / 2), 0, 0); gb.add('coal', g);
  }
  // water hatch, back-up light, rear deck ladders and grab irons
  gb.cyl('black', 0.42, 0.42, 0.24, 20, tx(11.0), D.yTank + 0.1, 0);
  gb.cyl('black', 0.47, 0.47, 0.05, 20, tx(11.0), D.yTank + 0.24, 0);
  gb.box('black', 0.5, 0.45, 0.5, tx(D.t1 - 0.3), D.yTank + 0.225, 0);
  const bl = new THREE.Mesh(new THREE.CircleGeometry(0.15, 18), RMAT.lensOff); bl.position.set(tx(D.t1 - 0.05) - 0.003, D.yTank + 0.24, 0); bl.rotation.y = -Math.PI / 2;
  for (const s of [-1, 1]) {
    const xr = tx(D.t1) - 0.07;
    for (let y = D.yBot + 0.25; y < D.yTank; y += 0.36) gb.box('rod', 0.03, 0.03, 0.42, xr, y, s * 1.3);
    for (const z of [1.08, 1.52]) { gb.box('dark', 0.04, D.yTank + 0.3 - 0.9, 0.04, xr, (D.yTank + 0.3 + 0.9) / 2, s * z); for (const y of [1.3, D.yTank - 0.1]) gb.box('dark', 0.07, 0.04, 0.04, xr + 0.035, y, s * z); }
    // front grab irons on standoffs at the tank corners
    bar('dark', 0.016, [tx(D.t0) + 0.02, D.deck - 0.3, s * (hw + 0.07)], [tx(D.t0) + 0.02, D.yTank - 0.2, s * (hw + 0.07)], 6);
    for (const y of [D.deck - 0.3, D.yTank - 0.2]) gb.box('dark', 0.04, 0.04, 0.1, tx(D.t0) + 0.02, y, s * (hw + 0.03));
    // steps, each hung on two stringers from the side sill
    const steps = (a, ys) => { for (const y of ys) gb.box('dark', 0.45, 0.04, 0.3, tx(a), y, s * 1.45); for (const d of [-0.2, 0.2]) gb.box('dark', 0.04, D.yBot - 0.08 - ys[0] + 0.03, 0.3, tx(a) + d, (ys[0] - 0.03 + D.yBot - 0.08) / 2, s * 1.45); };
    steps(D.t0 + 0.3, [0.6, 0.95]); steps(D.t1 - 0.25, [0.6]);
    // rivet seams on the tank side
    for (let a = 1.6; a < D.t1 - 0.4; a += 0.82) { const top = a < D.bunk[1] ? D.yBunk : a < D.bunk[2] ? lerp(D.yBunk, D.yTank, (a - D.bunk[1]) / (D.bunk[2] - D.bunk[1])) : D.yTank; gb.box('blackMatte', 0.025, top - D.yBot - 0.08, 0.006, tx(a), (top + D.yBot) / 2, s * (hw + 0.002)); }
    gb.box('blackMatte', D.t1 - D.t0, 0.025, 0.006, tx((D.t0 + D.t1) / 2), D.yBot + 0.06, s * (hw + 0.002));
  }
  const coupler = addCoupler(gb, root, { x: tx(Lt), out: -1, sx: tx(D.t1 + 0.27) - tx(Lt), sb: 0.88, ly: 1.12, zh: 1.3, yp: 0.86, housing: true, hl: 0.3 });
  // lettering, centred on the tank side below the bunker line
  const rk = 'road' + key + trim, rt = T ? T.road : spec.road;
  RMAT[rk] = decalMat(1024, 128, (g, w, h) => romanText(g, rt, w / 2, h / 2 + 6, rt.length > 15 ? 84 : 92, T ? T.gold : '#ecE9de', 0.1));
  for (const s of [-1, 1]) gb.add(rk, new THREE.PlaneGeometry(9.6, 1.2), M(tx(6.9), 2.45, s * (hw + 0.008), 0, s > 0 ? 0 : Math.PI, 0));
  if (T) {
    // snow on the tank top behind the bunker and a dusting over the coal; garland swagged along the tank sides
    const pts = []; for (let i = 0; i <= 12; i++) pts.push([-hw + i / 12 * 2 * hw, D.yTank]);
    const L = D.t1 - D.bunk[2] - 0.12;
    gb.add('snow', snowCap(pts, 0.06, L, 0.3).translate(tx(D.t1 - 0.06), 0, 0));
    const coal = gb.bins.coal[gb.bins.coal.length - 1].clone(); coal.translate(0, 0.008, 0); gb.add('snowDust', coal);
    const xs = []; for (let a = D.bunk[2] + 0.35; a <= D.t1 - 0.3 + 1e-6; a += (D.t1 - 0.65 - D.bunk[2]) / 3) xs.push(tx(a));
    for (const s of [-1, 1]) addSwags(gb, xs, D.yTank - 0.12, 0.16, s * (hw + 0.035), 0.045);
  }
  const statics = gb.build(RMAT);
  root.add(statics); root.add(bl);
  root.traverse(o => { if (o.isMesh && !o.userData.cpl) { o.castShadow = true; o.receiveShadow = true; } });
  return { root, len: Lt, ref0: D.ref, trucks: D.trucks.map(a => ({ a, type: 'buck', R: 0.457, sp: D.sp })), frame: D.trucks.slice(), backup: bl, waterHatchA: 11.0, couplers: [null, coupler] };
}

/* =================== CARS =================== */
/* Freight cars and heavyweight coaches, drawn to the published dimensions of the cars they stand for:
   an AAR 1937 40 ft boxcar, an AAR twin offset-side hopper, an AAR type 103 10,000 gal tank car, a 46 ft steel
   gondola, a steel cupola caboose and a Pullman-built heavyweight coach and observation car. Every car sits on a
   cast steel underframe (centre sill, bolsters, crossbearers, end sills) with AB brake gear and a train line,
   and rides on trucks whose journals run out into their journal boxes. x along the car (front +), y up from the
   rail top, z across; the car's centre is at x = 0. */
function textDecal(lines, w = 1024, h = 128, color = '#e9e3c9', font = 'serif', size = 80) {
  return decalMat(w, h, (g, W, H) => {
    if (font === 'serif') romanText(g, lines, W / 2, H / 2 + 6, size, color, 0.12);
    else { g.font = `bold ${size}px "Arial Narrow", Arial`; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(lines, W / 2, H / 2 + 4); }
  });
}
const AXJ = 1.1;                 // axle journals reach out to here, inside the journal boxes centred 1.0 m out
const TPY = 0.845, SBY = 0.83;   // freight truck: top of the centre plate bowl and of the side bearings
const TPY6 = 1.09, SBY6 = 1.075; // six-wheel passenger truck (its bolster rides over the middle wheels)
/* the trucks and wheelsets every car shares (instanced by the train) */
function carGeos() { return { tg: truckGeos(), a6: plainAxle(0.457, true, RAIL_OFF, AXJ), a4: plainAxle(0.419, true, RAIL_OFF, AXJ) }; }

/* weathered paints: the colour, streaked by rain from the roof, sooty along the bottom, a little rust */
function grimeTex(seed, o = {}) {
  return canvasTex(512, 256, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '90,80,70' : '255,250,240'},${0.02 + r() * 0.03})`; g.beginPath(); g.ellipse(r() * w, r() * h, 6 + r() * 40, 4 + r() * 20, 0, 0, TAU); g.fill(); }
    for (let i = 0; i < (o.streaks || 26); i++) {
      const x = r() * w, L = h * (0.15 + r() * 0.6), wd = 3 + r() * 14, gr = g.createLinearGradient(0, 0, 0, L);
      gr.addColorStop(0, `rgba(60,48,38,${0.05 + r() * 0.08})`); gr.addColorStop(1, 'rgba(60,48,38,0)');
      g.fillStyle = gr; g.fillRect(x, 0, wd, L);
    }
    const b = g.createLinearGradient(0, h * 0.62, 0, h); b.addColorStop(0, 'rgba(52,42,34,0)'); b.addColorStop(1, `rgba(52,42,34,${o.soot || 0.5})`);
    g.fillStyle = b; g.fillRect(0, 0, w, h);
    if (o.rust) for (let i = 0; i < o.rust; i++) { g.fillStyle = `rgba(${120 + r() * 40 | 0},${60 + r() * 20 | 0},30,${0.08 + r() * 0.16})`; g.beginPath(); g.ellipse(r() * w, h * (0.3 + r() * 0.7), 1 + r() * 4, 1 + r() * 3, r() * 3, 0, TAU); g.fill(); }
    if (o.rivets) o.rivets(g, w, h, r);
  });
}
/* rivet heads: a lit top and a shadow under each */
function rivetRow(g, x0, y0, x1, y1, n, rad = 2.2) {
  for (let i = 0; i <= n; i++) {
    const x = lerp(x0, x1, i / n), y = lerp(y0, y1, i / n);
    g.fillStyle = 'rgba(40,32,26,0.55)'; g.beginPath(); g.arc(x + 0.6, y + 0.9, rad, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,248,236,0.55)'; g.beginPath(); g.arc(x - 0.5, y - 0.6, rad * 0.75, 0, TAU); g.fill();
  }
}
function carMaterials() {
  if (RMAT.boxPanel) return;
  const S = (base, map) => { const m = base.clone(); m.map = map; m.side = THREE.DoubleSide; return m; };
  // a boxcar side panel between two rivet seams (each panel is its own face, so its rivets land on its edges)
  RMAT.boxPanel = S(RMAT.oxide, grimeTex(11, { rust: 10, rivets: (g, w, h) => { for (const x of [5, w - 5]) rivetRow(g, x, 4, x, h - 4, 26); rivetRow(g, 5, h - 6, w - 5, h - 6, 12); } }));
  RMAT.oxideW = S(RMAT.oxide, grimeTex(12, { rust: 14 }));
  RMAT.oxide2W = S(RMAT.oxide2, grimeTex(13, { rust: 20, soot: 0.6 }));
  RMAT.hopW = S(RMAT.black, grimeTex(14, { rust: 30, soot: 0.35, streaks: 40, rivets: (g, w, h) => { for (const x of [5, w - 5]) rivetRow(g, x, 4, x, h - 4, 22); } }));
  RMAT.hopW.color.setHex(0x1d1e1f);
  RMAT.cabooseW = S(RMAT.caboose, grimeTex(15, { rust: 6, soot: 0.12, rivets: (g, w, h) => { rivetRow(g, 5, 6, w - 5, 6, 14); rivetRow(g, 5, h - 6, w - 5, h - 6, 14); } }));
  RMAT.tankW = S(RMAT.tank, grimeTex(16, { streaks: 12, soot: 0.25 }));
  RMAT.deckPlate = S(RMAT.dark, grimeTex(17, { soot: 0.7, rust: 40 }));
  // heavyweight coach sides: rivet rows along the belt rail and the side sill, a seam under every window post
  const coachRivets = (seams) => (g, w, h) => { rivetRow(g, 4, 5, w - 4, 5, 300, 1.6); rivetRow(g, 4, h - 5, w - 4, h - 5, 300, 1.6); for (const u of seams) rivetRow(g, u * w, 8, u * w, h - 8, 10, 1.6); };
  RMAT.coachSeams = [];
  for (let i = 0; i < 14; i++) RMAT.coachSeams.push((-9.5 - 0.79 + i * 1.58 + 11.0) / 22.0);
  const lower = canvasTex(2048, 128, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); const b = g.createLinearGradient(0, 0, 0, h); b.addColorStop(0, 'rgba(60,50,40,0)'); b.addColorStop(1, 'rgba(60,50,40,0.28)'); g.fillStyle = b; g.fillRect(0, 0, w, h); coachRivets(RMAT.coachSeams)(g, w, h); });
  const sill = canvasTex(2048, 64, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); const b = g.createLinearGradient(0, 0, 0, h); b.addColorStop(0, 'rgba(50,40,32,0.1)'); b.addColorStop(1, 'rgba(50,40,32,0.45)'); g.fillStyle = b; g.fillRect(0, 0, w, h); rivetRow(g, 4, 8, w - 4, 8, 320, 1.6); rivetRow(g, 4, h - 8, w - 4, h - 8, 320, 1.6); });
  RMAT.greenLow = S(RMAT.green, lower); RMAT.greenSill = S(RMAT.green, sill);
  RMAT.holLow = S(RMAT.holBody, lower); RMAT.holSill = S(RMAT.holBody, sill);
}

/* ---- small parts the cars share ---- */
const v3a = (p, q, s = 1) => [p[0] + q[0] * s, p[1] + q[1] * s, p[2] + q[2] * s];
/* a closed solid from eight corners: P[0..3] one end ring, P[4..7] the other in the same order */
function hexa(gb, k, P) {
  const F = [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]];
  const c = [0, 1, 2].map(i => P.reduce((s, p) => s + p[i], 0) / 8), pos = [], uv = [];
  const U = [[0, 0], [1, 0], [1, 1], [0, 1]];
  for (const f of F) {
    const q = f.map(i => P[i]), fc = [0, 1, 2].map(i => (q[0][i] + q[1][i] + q[2][i] + q[3][i]) / 4);
    const a = [q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2]], b = [q[3][0] - q[0][0], q[3][1] - q[0][1], q[3][2] - q[0][2]];
    const n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const out = n[0] * (fc[0] - c[0]) + n[1] * (fc[1] - c[1]) + n[2] * (fc[2] - c[2]) >= 0;
    const ord = out ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    for (const j of ord) { pos.push(...q[j]); uv.push(...U[j]); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  return gb.add(k, g);
}
/* a plate in the x-y plane between two edges, thickness t across z: from (x0,y0) to (x1,y1), z from z0 to z1 at both */
function slab(gb, k, x0, y0, x1, y1, z0, z1, t) {
  const L = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / L * t / 2, ny = (x1 - x0) / L * t / 2;
  return hexa(gb, k, [[x0 - nx, y0 - ny, z0], [x0 - nx, y0 - ny, z1], [x0 + nx, y0 + ny, z1], [x0 + nx, y0 + ny, z0], [x1 - nx, y1 - ny, z0], [x1 - nx, y1 - ny, z1], [x1 + nx, y1 + ny, z1], [x1 + nx, y1 + ny, z0]]);
}
/* a grab iron: a bar from a to b standing off the surface by o, with its two legs back into the surface */
function grabIron(gb, k, a, b, o, r = 0.012) {
  const A = v3a(a, o), B = v3a(b, o);
  gb.add(k, barGeo(r, v3a(a, o, -0.25), A, 6)); gb.add(k, barGeo(r, v3a(b, o, -0.25), B, 6)); gb.add(k, barGeo(r, A, B, 6));
}
/* a ladder up a car side (face at z = s*zf) between stiles at x0 and x1, from y0 to y1 */
function sideLadder(gb, k, x0, x1, y0, y1, s, zf, rungs = 0.42) {
  const z = s * (zf + 0.07);
  for (const x of [x0, x1]) {
    gb.box(k, 0.05, y1 - y0, 0.014, x, (y0 + y1) / 2, z);
    for (const y of [y0 + 0.08, y1 - 0.08]) gb.box(k, 0.04, 0.04, 0.09, x, y, s * (zf + 0.035));
  }
  for (let y = y0 + 0.2; y < y1 - 0.05; y += rungs) gb.add(k, barGeo(0.012, [x0, y, z], [x1, y, z], 6));
}
/* a ladder up a car end (face at x = e*xf) between stiles at z0 and z1 */
function endLadder(gb, k, z0, z1, y0, y1, e, xf, rungs = 0.42) {
  const x = e * (xf + 0.07);
  for (const z of [z0, z1]) {
    gb.box(k, 0.014, y1 - y0, 0.05, x, (y0 + y1) / 2, z);
    for (const y of [y0 + 0.08, y1 - 0.08]) gb.box(k, 0.09, 0.04, 0.04, e * (xf + 0.035), y, z);
  }
  for (let y = y0 + 0.2; y < y1 - 0.05; y += rungs) gb.add(k, barGeo(0.012, [x, y, z0], [x, y, z1], 6));
}
/* a sill step: two legs down from the side sill (bottom at yTop) and a tread across them */
function stirrup(gb, k, x, s, z, yTop, yBot = 0.42) {
  for (const d of [-0.17, 0.17]) gb.add(k, barGeo(0.014, [x + d, yTop + 0.04, s * z], [x + d, yBot, s * (z + 0.04)], 6));
  gb.box(k, 0.4, 0.025, 0.07, x, yBot, s * (z + 0.04));
}
/* a hand brake wheel facing along x at (x, y, z), its gear housing back to the end face at xf */
function brakeWheel(gb, k, x, y, z, xf) {
  const e = Math.sign(x - xf) || 1;
  gb.add(k, new THREE.TorusGeometry(0.27, 0.016, 6, 24).rotateY(Math.PI / 2).translate(x, y, z));
  for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + 0.3; gb.add(k, barGeo(0.012, [x, y, z], [x, y + Math.sin(a) * 0.27, z + Math.cos(a) * 0.27], 5)); }
  gb.add(k, new THREE.CylinderGeometry(0.035, 0.035, Math.abs(x - xf) + 0.02, 8).rotateZ(Math.PI / 2).translate((x + xf) / 2, y, z));
  gb.box(k, Math.abs(x - xf) * 0.6, 0.36, 0.26, xf + e * Math.abs(x - xf) * 0.3, y - 0.08, z);           // gear housing
  gb.add(k, barGeo(0.012, [xf + e * 0.04, y - 0.26, z], [xf + e * 0.04, 1.0, z], 5));                     // chain down to the brake rigging
}
/* a horizontal brake wheel on a vertical staff at (x, z), from the deck at y0 up to y1 */
function staffWheel(gb, k, x, z, y0, y1) {
  gb.add(k, barGeo(0.02, [x, y0 - 0.02, z], [x, y1, z], 6));
  gb.add(k, new THREE.TorusGeometry(0.26, 0.016, 6, 24).rotateX(Math.PI / 2).translate(x, y1, z));
  for (let i = 0; i < 3; i++) { const a = i * TAU / 3; gb.add(k, barGeo(0.012, [x, y1, z], [x + Math.cos(a) * 0.26, y1, z + Math.sin(a) * 0.26], 5)); }
  gb.cyl(k, 0.05, 0.06, 0.18, 8, x, y0 + 0.09, z);   // ratchet at the deck
}
/* cast steel underframe: deck plate (unless noFloor), end sills, centre sill (fish-bellied between the bolsters to
   yBelly), body bolsters with centre plates and side bearings, crossbearers, the train line and the AB brake set.
   he = half length to the end sill faces, hw = half width, yT = top of the frame, xb = truck centres */
function carFrame(gb, o) {
  const k = o.k || 'dark', he = o.he, hw = o.hw, yT = o.yT, xb = o.xb, yU = yT - 0.06, ySb = 0.93;
  const tp = o.tp || TPY, sb = o.sb || SBY;
  if (!o.noFloor) gb.box(o.deck || k, 2 * he - 0.02, 0.06, 2 * hw - 0.04, 0, yT - 0.03, 0);
  for (const e of [-1, 1]) gb.box(k, 0.14, yT - ySb, 2 * hw, e * (he - 0.07), (yT + ySb) / 2, 0);
  gb.box(k, 2 * he - 0.1, yU - ySb + 0.01, 0.42, 0, (yU + ySb) / 2, 0);
  if (o.belly) for (const e of [-1, 1]) {
    const xm = xb * 0.45, xt = xb - 0.35, zz = 0.19, yb = o.belly;
    hexa(gb, k, [[e * xt, yU, -zz], [e * xt, yU, zz], [e * xt, ySb + 0.02, zz], [e * xt, ySb + 0.02, -zz], [e * xm, yU, -zz], [e * xm, yU, zz], [e * xm, yb, zz], [e * xm, yb, -zz]]);
    hexa(gb, k, [[e * xm, yU, -zz], [e * xm, yU, zz], [e * xm, yb, zz], [e * xm, yb, -zz], [0, yU, -zz], [0, yU, zz], [0, yb, zz], [0, yb, -zz]]);
    gb.box(k, 2 * (xb * 0.45), 0.03, 0.5, 0, yb + 0.015, 0);    // bottom cover plate
  }
  // bolsters: deep at the centre sill, tapering out to the side sills; a crossbearer between each bolster and the centre
  const xing = (x, w, dIn, dOut) => { for (const s of [-1, 1]) hexa(gb, k, [[x - w / 2, yU, 0], [x + w / 2, yU, 0], [x + w / 2, yU - dIn, 0], [x - w / 2, yU - dIn, 0], [x - w / 2, yU, s * (hw - 0.05)], [x + w / 2, yU, s * (hw - 0.05)], [x + w / 2, yU - dOut, s * (hw - 0.05)], [x - w / 2, yU - dOut, s * (hw - 0.05)]]); };
  const yBol = Math.max(yT - 0.32, tp + 0.03);
  for (const e of [-1, 1]) {
    xing(e * xb, 0.4, yU - yBol, 0.12);
    gb.cyl(k, 0.2, 0.2, yBol + 0.02 - (tp - 0.01), 16, e * xb, (yBol + 0.02 + tp - 0.01) / 2, 0);                         // centre plate
    for (const s of [-1, 1]) gb.box(k, 0.22, yBol + 0.06 - (sb - 0.005), 0.16, e * xb, (yBol + 0.06 + sb - 0.005) / 2, s * 0.64);  // side bearings
    if (!o.noCross) xing(e * xb * 0.42, 0.24, 0.2, 0.08);
  }
  // train line along the car, hung on straps; it meets the angle cocks' pipes at each end
  const yp = 0.926, zp = 0.32, xp = o.L / 2 - 0.86;
  gb.add(k, barGeo(0.021, [-xp, yp, zp], [xp, yp, zp], 6));
  for (let x = -xp + 1.0; x < xp - 0.5; x += 2.2) gb.box(k, 0.05, yU - yp + 0.01, 0.05, x, (yU + yp) / 2, zp);
  if (o.noBrake) return;
  // AB brake: reservoir and valve on brackets off the centre sill, brake cylinder on the other side, levers and rods
  const xr = o.xr !== undefined ? o.xr : 0.9, yr = Math.min(yU - 0.24, 0.9);
  gb.add(k, new THREE.CylinderGeometry(0.19, 0.19, 1.0, 14).rotateZ(Math.PI / 2).translate(xr, yr, 0.5));
  for (const d of [-0.3, 0.3]) gb.box(k, 0.06, 0.06, 0.34, xr + d, yr, 0.36);
  gb.box(k, 0.3, 0.3, 0.24, xr + 0.72, yr, 0.42); gb.box(k, 0.24, 0.06, 0.24, xr + 0.72, yr, 0.27);
  gb.add(k, barGeo(0.012, [xr + 0.72, yr + 0.15, 0.42], [xr + 0.72, yp, zp], 5));                                    // branch pipe to the train line
  const xc = -xr - 0.3;
  gb.add(k, new THREE.CylinderGeometry(0.18, 0.18, 0.42, 14).rotateZ(Math.PI / 2).translate(xc, yr, -0.46));
  gb.box(k, 0.42, 0.06, 0.3, xc, yr, -0.3);
  gb.box(k, 0.05, 0.5, 0.06, xc - 0.5, yr - 0.02, -0.46);                                                             // cylinder lever
  gb.add(k, barGeo(0.018, [xc - 0.21, yr, -0.46], [xc - 0.5, yr, -0.46], 5));                                         // push rod
  for (const e of [-1, 1]) gb.add(k, barGeo(0.016, [xc - 0.5, yr + (e > 0 ? 0.18 : -0.18), -0.46], [e * (xb - 0.2), yr + (e > 0 ? 0.18 : -0.18), -0.46], 5));
}

/* ======== freight cars ======== */
function freightModel(type, num, r) {
  carMaterials();
  const root = new THREE.Group(); const gb = new GeoBin();
  let L, hw = 1.5, weight, ta = 1.95;
  const G = 'dark';
  // reporting marks, a little proud of the side at face distance zf; on a tank they wrap around the barrel (radius tr, centre ty)
  const marks = (txt, sub, mat, y, color, zf = hw + 0.005, tr = 0, ty = 0, w = 2.6, mx = L / 2 - 2.2) => {
    const k = 'fm_' + type + '_' + num; RMAT[k] = decalMat(512, 128, (g, w, h) => { g.fillStyle = color || '#ece9df'; g.font = 'bold 48px "Arial Narrow", Arial'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(txt, 12, 42); g.font = '28px "Arial Narrow", Arial'; g.fillText(sub, 12, 96); });
    for (const s of [-1, 1]) {
      const g = new THREE.PlaneGeometry(w, w / 4, 1, tr ? 8 : 1);
      if (tr) { const p = g.attributes.position, r = tr + 0.008, a0 = Math.asin((y - ty) / r); for (let i = 0; i < p.count; i++) { const a = a0 + p.getY(i) / r; p.setY(i, ty + r * Math.sin(a) - y); p.setZ(i, r * Math.cos(a)); } g.computeVertexNormals(); g.translate(0, 0, -zf); }
      gb.add(k, g, M(s > 0 ? -mx : mx, y, s * zf, 0, s > 0 ? 0 : Math.PI, 0));
    }
  };
  // the data stencilled at the other end of the side: built date, light weight, the last brake test
  const data = (y, zf, x, color = '#e6e2d6') => {
    const k = 'fd_' + type; if (!RMAT[k]) RMAT[k] = decalMat(256, 128, (g, w, h) => { g.fillStyle = color; g.font = '22px "Arial Narrow", Arial'; g.textAlign = 'left'; g.textBaseline = 'top'; ['LT WT 44200', 'BLT 4-41', 'IL 40 6  IH 10 0', 'CU FT 3712'].forEach((t, i) => g.fillText(t, 10, 10 + i * 28)); });
    for (const s of [-1, 1]) gb.add(k, new THREE.PlaneGeometry(0.9, 0.45), M(s > 0 ? x : -x, y, s * zf, 0, s > 0 ? 0 : Math.PI, 0));
  };
  const corner = (he, top, zf, yS) => {   // sill steps at the four corners, under the side sills
    for (const e of [-1, 1]) for (const s of [-1, 1]) stirrup(gb, G, e * (he - 0.32), s, zf - 0.04, yS);
  };
  if (type === 'box') {
    /* AAR 1937 40 ft boxcar: 40 ft 6 in inside, 10 ft inside height, ten riveted panels, a 6 ft Youngstown door,
       Dreadnaught ends, a raised-panel roof with a wooden running board. */
    L = 13.0; weight = (r() < 0.6 ? 62 : 25) * STON; hw = 1.55;
    const he = L / 2 - 0.51, yT = 1.17, yE = 4.22, xe = he - 0.02, xb = L / 2 - ta;
    carFrame(gb, { L, he, hw, yT, xb, belly: 0.66 });
    // side sill angle, and the riveted side panels: five each side of the door opening
    for (const s of [-1, 1]) {
      gb.box(G, 2 * xe, 0.13, 0.03, 0, 1.08, s * (hw + 0.012));
      const D = 0.94, n = 5;
      for (const e of [-1, 1]) for (let i = 0; i < n; i++) {
        const x0 = D + (xe - D) * i / n, x1 = D + (xe - D) * (i + 1) / n;
        gb.box('boxPanel', x1 - x0 + 0.004, yE - 1.04, 0.04, e * (x0 + x1) / 2, (yE + 1.04) / 2, s * (hw - 0.02));
      }
      // Youngstown door: a corrugated steel door hung from its top track, with door guides along the bottom
      gb.box('oxideW', 1.98, yE - 1.18, 0.05, 0, (yE + 1.18) / 2 - 0.04, s * (hw + 0.02));
      for (let y = 1.42; y < yE - 0.3; y += 0.36) gb.box('oxide', 1.9, 0.12, 0.03, 0, y, s * (hw + 0.058));
      for (const x of [-0.97, 0.97]) gb.box('oxide', 0.06, yE - 1.25, 0.05, x, (yE + 1.18) / 2 - 0.04, s * (hw + 0.055));
      gb.box(G, 4.1, 0.1, 0.1, 1.0, yE - 0.06, s * (hw + 0.07));                                     // top door track
      for (let x = -0.9; x <= 2.9; x += 0.95) gb.box(G, 0.08, 0.16, 0.08, x, yE - 0.13, s * (hw + 0.03));
      gb.box(G, 4.1, 0.05, 0.05, 1.0, 1.14, s * (hw + 0.055));                                       // bottom guide rail
      for (const x of [-1.05, 3.0]) gb.box(G, 0.08, 0.2, 0.12, x, 1.25, s * (hw + 0.05));             // door stops
      gb.box(G, 0.05, 0.6, 0.04, 0.9, 1.85, s * (hw + 0.07)); gb.box(G, 0.12, 0.08, 0.06, 0.9, 1.55, s * (hw + 0.07));   // latch bar
      gb.box('wood', 0.55, 0.35, 0.02, -0.5, 2.1, s * (hw + 0.075));                                  // route card board
      gb.box(G, 0.04, yE - 1.1, 0.06, -0.97, (yE + 1.1) / 2, s * (hw + 0.005));                       // door posts
      gb.box(G, 0.04, yE - 1.1, 0.06, 0.97, (yE + 1.1) / 2, s * (hw + 0.005));
    }
    // Dreadnaught ends: the end sheet with its gable, and tapering horizontal ribs
    for (const e of [-1, 1]) {
      const sh = new THREE.Shape(); sh.moveTo(-hw, 1.04); sh.lineTo(hw, 1.04); sh.lineTo(hw, yE + 0.02); sh.lineTo(0, yE + 0.15); sh.lineTo(-hw, yE + 0.02); sh.closePath();
      gb.add('oxideW', new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false }).rotateY(Math.PI / 2).translate(e * xe - 0.025, 0, 0));
      for (let y = 1.6; y < yE - 0.2; y += 0.52) for (const s of [-1, 1]) {
        const x0 = e * (xe + 0.02), x1 = e * (xe + 0.08);
        hexa(gb, 'oxide', [[x0, y - 0.13, 0], [x1, y - 0.06, 0], [x1, y + 0.06, 0], [x0, y + 0.13, 0], [x0, y - 0.06, s * (hw - 0.1)], [e * (xe + 0.03), y - 0.03, s * (hw - 0.1)], [e * (xe + 0.03), y + 0.03, s * (hw - 0.1)], [x0, y + 0.06, s * (hw - 0.1)]]);
      }
      for (const s of [-1, 1]) gb.box(G, 0.1, yE - 1.04, 0.1, e * (xe - 0.01), (yE + 1.04) / 2, s * (hw - 0.03));   // corner posts
    }
    // roof: a closed slab from the eaves up to the ridge, overhanging the sides and ends, with a raised seam over each panel
    const rp = (y0, t, o = 0) => { const p = new THREE.Shape(); p.moveTo(-hw - 0.07 - o, y0 - 0.03); p.lineTo(-hw - 0.07 - o, y0 + 0.04 + t); p.lineTo(0, y0 + 0.2 + t); p.lineTo(hw + 0.07 + o, y0 + 0.04 + t); p.lineTo(hw + 0.07 + o, y0 - 0.03); p.lineTo(0, y0 + 0.12); p.closePath(); return p; };
    gb.add('oxide2W', new THREE.ExtrudeGeometry(rp(yE, 0), { depth: 2 * xe + 0.12, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-xe - 0.06, 0, 0));
    for (let i = 0; i <= 12; i++) {
      const x = -xe + 0.12 + i * (2 * xe - 0.24) / 12, sh = new THREE.Shape();
      sh.moveTo(-hw - 0.05, yE + 0.035); sh.lineTo(0, yE + 0.195); sh.lineTo(hw + 0.05, yE + 0.035); sh.lineTo(hw + 0.05, yE + 0.065); sh.lineTo(0, yE + 0.225); sh.lineTo(-hw - 0.05, yE + 0.065); sh.closePath();
      gb.add('oxide2', new THREE.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: false }).rotateY(Math.PI / 2).translate(x - 0.035, 0, 0));
      gb.box('wood', 0.07, 0.12, 0.5, x, yE + 0.27, 0);                                              // running board saddle
    }
    gb.box('wood', 2 * xe + 0.14, 0.04, 0.52, 0, yE + 0.35, 0);                                        // running board
    for (const e of [-1, 1]) { const s = e; gb.box('wood', 0.5, 0.04, hw - 0.2, e * (xe - 0.35), yE + 0.35, s * (hw / 2 + 0.06)); gb.box(G, 0.05, 0.25, 0.05, e * (xe - 0.35), yE + 0.22, s * (hw - 0.05)); }   // laterals at the ladder corners
    // ladders on the side and end at two corners, grab irons at the other two, sill steps at all four
    for (const e of [-1, 1]) {
      const s = e;
      sideLadder(gb, G, e * (xe - 0.08), e * (xe - 0.52), 1.15, yE - 0.02, s, hw);
      endLadder(gb, G, s * (hw - 0.12), s * (hw - 0.56), 1.15, yE - 0.02, e, xe + 0.025);
      for (let y = 1.6; y < yE - 0.4; y += 0.85) { grabIron(gb, G, [e * (xe - 0.12), y, -s * hw], [e * (xe - 0.55), y, -s * hw], [0, 0, -s * 0.06]); grabIron(gb, G, [e * (xe + 0.025), y, -s * (hw - 0.12)], [e * (xe + 0.025), y, -s * (hw - 0.55)], [e * 0.08, 0, 0]); }
      grabIron(gb, G, [e * (xe - 0.4), yE + 0.12, s * (hw - 0.1)], [e * (xe - 0.4), yE + 0.12, s * (hw - 0.5)], [0, 0.07, 0]);
    }
    corner(xe, yE, hw, 1.04);
    // hand brake on the B end, high on the end with the brake step below it
    brakeWheel(gb, G, -(xe + 0.36), yE - 0.42, 0.62, -(xe + 0.06));
    gb.box('wood', 0.32, 0.04, 0.8, -(xe + 0.24), 2.6, 0.62); for (const z of [0.3, 0.94]) slab(gb, G, -(xe + 0.08), 2.35, -(xe + 0.38), 2.58, z - 0.02, z + 0.02, 0.03);
    marks(ROAD_SHORT + ' ' + num, 'CAPY 100000  LD LMT 110700', 'oxide', 3.1, null, hw + 0.006, 0, 0, 2.6, 3.6);
    data(1.75, hw + 0.006, 4.1);
  } else if (type === 'hopper') {
    /* AAR twin offset-side hopper, 55 t: 10 ft 8 in high, 10 ft 4 in wide, two bays with bottom doors */
    L = 11.2; weight = 92 * STON; hw = 1.52;
    const he = L / 2 - 0.51, yT = 1.17, xe = he - 0.04, top = 3.25, xb = L / 2 - ta;
    carFrame(gb, { L, he, hw, yT, xb, noFloor: true, noCross: true, xr: -0.15 });
    for (const s of [-1, 1]) {
      gb.box(G, 2 * xe, 0.2, 0.06, 0, 1.15, s * (hw - 0.01));                                         // side sill
      const n = 8;
      for (let i = 0; i < n; i++) { const x0 = -xe + 2 * xe * i / n, x1 = -xe + 2 * xe * (i + 1) / n; gb.box('hopW', x1 - x0 + 0.004, top - 0.08 - 1.2, 0.04, (x0 + x1) / 2, (top - 0.08 + 1.2) / 2, s * (hw - 0.03)); }
      for (let i = 0; i <= n; i++) {                                                                   // exterior posts, wider at the foot
        const x = -xe + 2 * xe * i / n, w = i === 0 || i === n ? 0.1 : 0.12;
        hexa(gb, 'hopW', [[x - w / 2, 1.1, s * (hw - 0.01)], [x + w / 2, 1.1, s * (hw - 0.01)], [x + w / 2, 1.1, s * (hw + 0.07)], [x - w / 2, 1.1, s * (hw + 0.07)], [x - w / 2.6, top - 0.09, s * (hw - 0.01)], [x + w / 2.6, top - 0.09, s * (hw - 0.01)], [x + w / 2.6, top - 0.09, s * (hw + 0.045)], [x - w / 2.6, top - 0.09, s * (hw + 0.045)]]);
      }
      gb.box('black', 2 * xe + 0.04, 0.1, 0.12, 0, top - 0.05, s * (hw + 0.02));                      // top chord
    }
    // end slope sheets, running from the top of each end down into the bays; the bays narrow to their doors
    const yBay = 1.3, xBay = 3.05;
    for (const e of [-1, 1]) {
      slab(gb, 'hopW', e * (xe - 0.02), top - 0.06, e * xBay, yBay, -(hw - 0.03), hw - 0.03, 0.04);
      gb.box('black', 0.12, 0.12, 2 * hw, e * (xe - 0.02), top - 0.08, 0);                             // end top angle
      for (const s of [-1, 1]) gb.box('black', 0.1, top - 1.1, 0.1, e * (xe - 0.02), (top + 1.1) / 2, s * (hw - 0.02));   // corner posts
      for (const z of [-0.5, 0.5]) { const yo = lerp(top - 0.06, yBay, 0.04); gb.box('black', 0.08, yo - 1.12, 0.1, e * (xe - 0.04), (yo + 1.12) / 2, z); }   // end posts up to the slope sheet
      hexa(gb, 'hopW', [[e * xBay, yBay, -(hw - 0.03)], [e * xBay, yBay, hw - 0.03], [e * 0.02, 1.95, hw - 0.03], [e * 0.02, 1.95, -(hw - 0.03)], [e * 1.95, 0.58, -0.62], [e * 1.95, 0.58, 0.62], [e * 1.25, 0.58, 0.62], [e * 1.25, 0.58, -0.62]]);
      gb.box(G, 0.74, 0.08, 1.3, e * 1.6, 0.54, 0);                                                    // bottom doors
      for (const z of [-0.45, 0, 0.45]) gb.box(G, 0.7, 0.03, 0.05, e * 1.6, 0.495, z);                  // door stiffeners
      gb.add(G, barGeo(0.025, [e * 1.23, 0.6, -0.72], [e * 1.23, 0.6, 0.72], 8));                       // hinge rod
      gb.box(G, 0.06, 0.25, 0.06, e * 1.97, 0.68, 0.66); gb.add(G, barGeo(0.015, [e * 1.97, 0.8, 0.66], [e * 1.97, 0.8, 1.2], 5));   // door lock and its lever
      // end platform over the end sill, with the brake staff on the B end
      gb.box('deckPlate', 0.42, 0.04, 2 * hw - 0.3, e * (he - 0.22), yT + 0.02, 0);
      endLadder(gb, G, e * (hw - 0.02), e * 0.5, 1.2, top - 0.1, e, xe + 0.03);
      for (let y = 1.5; y < top - 0.3; y += 0.8) grabIron(gb, G, [e * (xe - 0.08), y, -e * hw], [e * (xe - 0.5), y, -e * hw], [0, 0, -e * 0.06]);
    }
    staffWheel(gb, G, -(he - 0.2), -0.7, yT + 0.04, 2.55);
    corner(xe, top, hw, 1.05);
    // the heaped coal, inside the sides and ends
    const g = new THREE.PlaneGeometry(2 * xe - 0.1, 2 * hw - 0.08, 22, 8); g.rotateX(-Math.PI / 2); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), u = 1 - (z / (hw - 0.04)) ** 2, v = 1 - (x / (xe - 0.05)) ** 8; p.setY(i, top - 0.08 + 0.42 * Math.max(0, u * v) * (0.75 + 0.25 * Math.cos(x * 1.3 + 0.4)) + Math.sin(x * 9.1 + z * 7.3) * 0.02 * u * v); }
    g.computeVertexNormals(); gb.add('coal', g);
    marks(ROAD_SHORT + ' ' + num, 'CAPY 110000', 'black', 2.6, null, hw + 0.006, 0, 0, 1.15, 3.05);
  } else if (type === 'tank') {
    /* AAR type 103 10,000 gal tank car: an 88 in barrel on a full underframe, banded to the bolster saddles,
       a dome with its safety valve and a platform, running boards, handrails and a dome ladder */
    L = 12.4; weight = 70 * STON; hw = 1.45;
    const he = L / 2 - 0.51, yT = 1.17, R = 1.12, yc = 2.45, BL = 4.8, xb = L / 2 - ta;
    carFrame(gb, { L, he, hw: 1.3, yT, xb, noFloor: true, noCross: true });
    gb.add('tankW', new THREE.CylinderGeometry(R, R, 2 * BL, 32, 1, true).rotateZ(Math.PI / 2).translate(0, yc, 0));
    for (const s of [-1, 1]) gb.add('tank', new THREE.SphereGeometry(R, 24, 10, 0, TAU, 0, Math.PI / 2).scale(1, 0.42, 1).rotateZ(-s * Math.PI / 2).translate(s * BL, yc, 0));
    for (const x of [-4.4, -1.5, 1.5, 4.4]) gb.add(G, new THREE.TorusGeometry(R + 0.008, 0.022, 4, 36).rotateY(Math.PI / 2).translate(x, yc, 0));   // tank bands
    // bolster saddles shaped to the barrel, and the anchor at the centre
    for (const e of [-1, 1]) {
      const sh = new THREE.Shape(), zw = 0.85; sh.moveTo(-zw, yT - 0.08); sh.lineTo(zw, yT - 0.08);
      for (let i = 0; i <= 12; i++) { const z = zw - 2 * zw * i / 12; sh.lineTo(z, yc - Math.sqrt(R * R - z * z) + 0.01); }
      sh.closePath(); gb.add(G, new THREE.ExtrudeGeometry(sh, { depth: 0.36, bevelEnabled: false }).rotateY(Math.PI / 2).translate(e * xb - 0.18, 0, 0));
    }
    gb.box(G, 0.8, yc - R + 0.06 - (yT - 0.08), 0.5, 0, (yc - R + 0.06 + yT - 0.08) / 2, 0);
    // running boards on brackets along both sides, across both ends
    for (let x = -he + 0.3; x <= he - 0.29; x += (2 * he - 0.6) / 6) gb.box(G, 0.08, 0.06, 2 * hw - 0.04, x, yT - 0.03, 0);
    for (const s of [-1, 1]) gb.box('wood', 2 * he - 0.1, 0.05, 0.4, 0, yT + 0.025, s * (hw - 0.2));
    for (const e of [-1, 1]) gb.box('wood', 0.42, 0.05, 2 * hw - 0.8, e * (he - 0.28), yT + 0.025, 0);
    // handrail along each side of the tank on stanchions from the running boards, and across the ends
    const yH = 2.15, zH = 1.36;
    for (const s of [-1, 1]) {
      gb.add(G, barGeo(0.017, [-(he - 0.15), yH, s * zH], [he - 0.15, yH, s * zH], 6));
      for (let x = -(he - 0.15); x <= he - 0.14; x += (2 * he - 0.3) / 6) { gb.add(G, barGeo(0.016, [x, yT + 0.03, s * zH], [x, yH, s * zH], 5)); }
      for (const x of [-3.0, 0, 3.0]) gb.add(G, barGeo(0.014, [x, yH, s * zH], [x, yH, s * (Math.sqrt(R * R - (yH - yc) ** 2) - 0.03)], 5));   // stays back to the barrel
    }
    for (const e of [-1, 1]) gb.add(G, barGeo(0.017, [e * (he - 0.15), yH, -zH], [e * (he - 0.15), yH, zH], 6));
    // dome, its cover, safety valve and platform with a railing, and the ladder up to it
    const yTop = yc + R;
    gb.cyl('tankW', 0.56, 0.56, 0.7, 24, 0, yTop + 0.25, 0);
    gb.cyl('tank', 0.6, 0.6, 0.06, 24, 0, yTop + 0.62, 0); gb.cyl('tank', 0.36, 0.42, 0.1, 18, 0, yTop + 0.7, 0);
    gb.cyl(G, 0.07, 0.09, 0.22, 10, 0.32, yTop + 0.75, -0.25); gb.cyl('brass', 0.05, 0.05, 0.06, 10, 0.32, yTop + 0.89, -0.25);
    const yP = yTop + 0.04;
    for (const s of [-1, 1]) {
      gb.box('wood', 1.9, 0.04, 0.46, 0, yP, s * 0.5);
      for (const x of [-0.85, 0.85]) gb.box(G, 0.06, yP - (yc + Math.sqrt(R * R - 0.6 * 0.6)) + 0.04, 0.06, x, (yP + yc + Math.sqrt(R * R - 0.6 * 0.6)) / 2 - 0.02, s * 0.6);
      for (const x of [-0.92, 0.92]) gb.add(G, barGeo(0.014, [x, yP, s * 0.7], [x, yP + 0.9, s * 0.7], 5));
      gb.add(G, barGeo(0.015, [-0.92, yP + 0.9, s * 0.7], [0.92, yP + 0.9, s * 0.7], 5));
    }
    for (const x of [-0.92, 0.92]) gb.add(G, barGeo(0.015, [x, yP + 0.9, -0.7], [x, yP + 0.9, 0.7], 5));
    { const zL = 1.26, zS = Math.sqrt(R * R - 0.5 * 0.5);
      for (const x of [0.9, 1.3]) {
        gb.add(G, barGeo(0.016, [x, yT + 0.04, zL], [x, yP, zL], 5)); gb.add(G, barGeo(0.016, [x, yP, zL], [x, yP, 0.68], 5));
        gb.add(G, barGeo(0.014, [x, yc, zL], [x, yc, R - 0.03], 5));
        gb.add(G, barGeo(0.014, [x, yc + 0.5, zL], [x, yc + 0.5, zS - 0.03], 5));
      }
      for (let y = yT + 0.3; y < yP - 0.1; y += 0.36) gb.add(G, barGeo(0.012, [0.9, y, zL], [1.3, y, zL], 5));
    }
    // bottom outlet valve and its operating rod; the hand brake staff on the B end platform
    gb.cyl(G, 0.11, 0.11, yc - R + 0.06 - 0.72, 12, 1.0, (yc - R + 0.06 + 0.72) / 2, 0.36); gb.cyl(G, 0.15, 0.15, 0.08, 12, 1.0, 0.72, 0.36);
    gb.add(G, barGeo(0.012, [1.0, 0.9, 0.36], [1.0, 0.9, 1.3], 5));
    staffWheel(gb, G, -(he - 0.2), 0.75, yT + 0.05, 2.3);
    corner(he - 0.05, 0, hw - 0.1, 1.17);
    for (const e of [-1, 1]) endLadder(gb, G, -0.5, -0.9, 0.6, yT + 0.03, e, he - 0.03, 0.3);
    marks('UTLX ' + num, 'NON-ACCIDENT  CAPY 10000 GAL', 'tank', 2.0, null, R, R, yc);
  } else if (type === 'gon') {
    /* 46 ft steel gondola with pressed exterior posts, fixed corrugated ends and a heaped stone load */
    L = 14.6; weight = 88 * STON; hw = 1.52;
    const he = L / 2 - 0.51, yT = 1.17, xe = he - 0.02, top = 2.62, xb = L / 2 - ta;
    carFrame(gb, { L, he, hw, yT, xb, belly: 0.7, deck: 'deckPlate' });
    for (const s of [-1, 1]) {
      gb.box('oxideW', 2 * xe, top - 0.08 - 1.04, 0.04, 0, (top - 0.08 + 1.04) / 2, s * (hw - 0.02));
      gb.box(G, 2 * xe, 0.12, 0.04, 0, 1.08, s * (hw + 0.01));
      for (let i = 0; i <= 14; i++) {
        const x = -xe + 0.05 + (2 * xe - 0.1) * i / 14;
        hexa(gb, 'oxideW', [[x - 0.07, 1.06, s * (hw - 0.01)], [x + 0.07, 1.06, s * (hw - 0.01)], [x + 0.07, 1.06, s * (hw + 0.08)], [x - 0.07, 1.06, s * (hw + 0.08)], [x - 0.05, top - 0.09, s * (hw - 0.01)], [x + 0.05, top - 0.09, s * (hw - 0.01)], [x + 0.05, top - 0.09, s * (hw + 0.05)], [x - 0.05, top - 0.09, s * (hw + 0.05)]]);
      }
      gb.box('oxide', 2 * xe + 0.04, 0.1, 0.14, 0, top - 0.05, s * (hw + 0.03));
    }
    for (const e of [-1, 1]) {
      gb.box('oxideW', 0.05, top - 1.04, 2 * hw, e * xe, (top + 1.04) / 2, 0);
      for (let y = 1.4; y < top - 0.2; y += 0.34) gb.box('oxide2', 0.05, 0.12, 2 * hw - 0.3, e * (xe + 0.04), y, 0);
      gb.box('oxide2', 0.14, 0.1, 2 * hw + 0.06, e * xe, top - 0.05, 0);
      endLadder(gb, G, e * (hw - 0.12), e * (hw - 0.52), 1.15, top - 0.1, e, xe + 0.02);
      for (const s of [-1, 1]) for (let y = 1.5; y < top - 0.2; y += 0.5) grabIron(gb, G, [e * (xe - 0.12), y, s * (hw + 0.05)], [e * (xe - 0.52), y, s * (hw + 0.05)], [0, 0, s * 0.05]);
    }
    brakeWheel(gb, G, -(xe + 0.34), 2.15, -0.62, -(xe + 0.06));
    gb.box('wood', 0.32, 0.04, 0.8, -(xe + 0.22), 1.55, -0.62);
    corner(xe, top, hw, 1.04);
    const g = new THREE.PlaneGeometry(2 * xe - 0.12, 2 * hw - 0.09, 30, 8); g.rotateX(-Math.PI / 2); const p = g.attributes.position; const rr = rng(num);
    for (let i = 0; i < p.count; i++) { const z = p.getZ(i), x = p.getX(i), edge = Math.min(1, (xe - 0.06 - Math.abs(x)) * 3) * Math.min(1, (hw - 0.05 - Math.abs(z)) * 3); p.setY(i, 1.95 + 0.42 * Math.max(0, 1 - (z / 1.45) ** 2) * edge + (rr() - 0.5) * 0.1 * edge); }
    g.computeVertexNormals(); gb.add('stoneLoad', g);
    marks(ROAD_SHORT + ' ' + num, 'CAPY 140000', 'oxide2', 1.85, null, hw + 0.06, 0, 0, 1.15, 4.6);
  } else if (type === 'caboose') {
    /* steel cupola caboose: a 30 ft body on a 36 ft frame, open end platforms with railings and steps, a centre
       cupola, a stove and its smokejack, roof walks, and red markers on the rear corners */
    L = 11.0; weight = 22 * STON; ta = 2.4; hw = 1.45;
    const he = L / 2 - 0.51, yT = 1.25, xw = 4.3, yE = 3.5, xb = L / 2 - ta, hp = 1.42;
    carFrame(gb, { L, he, hw: hp, yT, xb, deck: 'deckPlate', xr: 0.4 });
    // body walls in panels around the windows; windows glazed a little inside with sash frames
    const wins = [[-3.0, 0.62], [3.0, 0.62], [-1.1, 0.62]], wy0 = 2.2, wy1 = 2.98;
    for (const s of [-1, 1]) {
      const z = s * (hw - 0.025);
      gb.box('cabooseW', 2 * xw, wy0 - yT + 0.04, 0.05, 0, (wy0 + yT - 0.04) / 2, z);
      gb.box('cabooseW', 2 * xw, yE - wy1, 0.05, 0, (yE + wy1) / 2, z);
      const xs = [-xw]; for (const [x, w] of wins.slice().sort((a, b) => a[0] - b[0])) { xs.push(x - w / 2, x + w / 2); } xs.push(xw);
      for (let i = 0; i < xs.length; i += 2) gb.box('cabooseW', xs[i + 1] - xs[i] + 0.002, wy1 - wy0, 0.05, (xs[i] + xs[i + 1]) / 2, (wy0 + wy1) / 2, z);
      for (const [x, w] of wins) {
        gb.box('win', w, wy1 - wy0, 0.02, x, (wy0 + wy1) / 2, s * (hw - 0.04));
        gb.box('caboose', w + 0.1, 0.06, 0.08, x, wy0 - 0.02, s * (hw + 0.01));                          // sill
        gb.box('caboose', w + 0.06, 0.04, 0.06, x, wy1 + 0.02, s * (hw + 0.005));                        // drip cap
        gb.box('caboose', 0.03, wy1 - wy0, 0.03, x, (wy0 + wy1) / 2, s * (hw - 0.035));                  // sash bars
        gb.box('caboose', w, 0.03, 0.03, x, (wy0 + wy1) / 2 + 0.06, s * (hw - 0.035));
      }
      gb.box(G, 2 * xw, 0.1, 0.03, 0, yT - 0.02, s * (hw + 0.005));                                      // side sill
      for (const e of [-1, 1]) gb.add(G, barGeo(0.014, [e * (xw - 0.0), 1.45, s * (hw + 0.07)], [e * xw, 3.0, s * (hw + 0.07)], 5)), gb.box(G, 0.04, 0.04, 0.09, e * xw, 1.5, s * (hw + 0.03)), gb.box(G, 0.04, 0.04, 0.09, e * xw, 2.95, s * (hw + 0.03));
    }
    // end walls with a door in the middle, the door's window, and the gable under the arched roof
    const rise = 0.24, arc = z => yE + rise * (1 - (z / (hw + 0.08)) ** 2);
    for (const e of [-1, 1]) {
      const x = e * (xw - 0.025);
      for (const s of [-1, 1]) gb.box('cabooseW', 0.05, yE - yT, hw - 0.4, x, (yE + yT) / 2, s * (hw + 0.4) / 2);
      gb.box('cabooseW', 0.05, yE - 3.2, 0.8, x, (yE + 3.2) / 2, 0);
      const gs = new THREE.Shape(); gs.moveTo(-hw, yE - 0.01); for (let i = 0; i <= 16; i++) { const z = -hw + 2 * hw * i / 16; gs.lineTo(z, arc(z) - 0.02); } gs.lineTo(hw, yE - 0.01); gs.closePath();
      gb.add('cabooseW', new THREE.ExtrudeGeometry(gs, { depth: 0.05, bevelEnabled: false }).rotateY(Math.PI / 2).translate(x - 0.025, 0, 0));
      gb.box('caboose', 0.04, 3.2 - yT, 0.8, e * (xw - 0.035), (3.2 + yT) / 2, 0);                       // door
      gb.box('win', 0.02, 0.62, 0.5, e * (xw + 0.0), 2.65, 0);
      gb.box('caboose', 0.06, 0.06, 0.06, e * (xw + 0.02), 2.0, 0.3);                                      // knob
      for (const s of [-1, 1]) { gb.box('win', 0.02, 0.5, 0.32, e * (xw + 0.0), 2.7, s * 0.95); gb.box('caboose', 0.07, 0.05, 0.4, e * (xw + 0.02), 2.43, s * 0.95); }
      endLadder(gb, G, 0.5, 0.85, 2.2, yE + 0.05, e, xw, 0.3);
    }
    // arched roof overhanging the walls and a little over the platforms
    const rs = new THREE.Shape(); rs.moveTo(-hw - 0.08, yE - 0.03);
    for (let i = 0; i <= 20; i++) { const z = -hw - 0.08 + 2 * (hw + 0.08) * i / 20; rs.lineTo(z, arc(z) + 0.03); }
    rs.lineTo(hw + 0.08, yE - 0.03); for (let i = 20; i >= 0; i--) { const z = -hw - 0.08 + 2 * (hw + 0.08) * i / 20; rs.lineTo(z, arc(z) - 0.03); }
    rs.closePath();
    gb.add('roof', new THREE.ExtrudeGeometry(rs, { depth: 2 * xw + 0.3, bevelEnabled: false, curveSegments: 4 }).rotateY(Math.PI / 2).translate(-xw - 0.15, 0, 0));
    // cupola: walls with two windows a side and one an end, its own arched roof, grab irons at its corners
    const c0 = -1.85, c1 = 0.45, cw = 1.0, cy0 = arc(cw) - 0.05, cy1 = 4.45, cx = (c0 + c1) / 2;
    for (const s of [-1, 1]) {
      gb.box('cabooseW', c1 - c0, 4.0 - cy0, 0.05, cx, (4.0 + cy0) / 2, s * cw);
      gb.box('cabooseW', c1 - c0, cy1 - 4.42, 0.05, cx, (cy1 + 4.42) / 2, s * cw);
      for (const [x0, x1] of [[c0, -1.55], [-1.05, -0.65], [-0.15, c1]]) gb.box('cabooseW', x1 - x0, 0.42, 0.05, (x0 + x1) / 2, 4.21, s * cw);
      for (const x of [-1.3, -0.4]) { gb.box('win', 0.5, 0.42, 0.02, x, 4.21, s * (cw - 0.015)); gb.box('caboose', 0.56, 0.04, 0.07, x, 3.98, s * (cw + 0.01)); }
      for (const x of [c0 - 0.04, c1 + 0.04]) gb.add(G, barGeo(0.012, [x, 3.95, s * (cw + 0.05)], [x, 4.4, s * (cw + 0.05)], 5));
      for (const x of [c0, c1]) for (const y of [3.98, 4.37]) gb.box(G, 0.05, 0.04, 0.06, x - Math.sign(x - cx) * 0.0 + (x > cx ? 0.03 : -0.03), y, s * (cw + 0.025));
    }
    for (const e of [-1, 1]) {
      const x = e > 0 ? c1 : c0;
      for (const s of [-1, 1]) gb.box('cabooseW', 0.05, 4.42 - cy0, cw - 0.32, x, (4.42 + cy0) / 2, s * (cw + 0.32) / 2);
      gb.box('cabooseW', 0.05, 4.0 - cy0 + 0.05, 0.64, x, (4.0 + cy0) / 2, 0); gb.box('cabooseW', 0.05, cy1 - 4.42, 0.64, x, (cy1 + 4.42) / 2, 0);
      gb.box('win', 0.02, 0.42, 0.62, x, 4.21, 0);
    }
    { const cr = new THREE.Shape(), W2 = cw + 0.1; cr.moveTo(-W2, cy1 - 0.03); for (let i = 0; i <= 12; i++) { const z = -W2 + 2 * W2 * i / 12; cr.lineTo(z, cy1 + 0.13 * (1 - (z / W2) ** 2) + 0.03); } cr.lineTo(W2, cy1 - 0.03); cr.closePath();
      gb.add('roof', new THREE.ExtrudeGeometry(cr, { depth: c1 - c0 + 0.2, bevelEnabled: false }).rotateY(Math.PI / 2).translate(c0 - 0.1, 0, 0)); }
    // roof walks from the cupola to each end on saddles, and the stove's smokejack
    for (const [x0, x1] of [[-xw - 0.12, c0], [c1, xw + 0.12]]) {
      gb.box('wood', x1 - x0, 0.04, 0.46, (x0 + x1) / 2, yE + rise + 0.09, 0);
      for (let x = x0 + 0.2; x < x1 - 0.1; x += 0.7) gb.box('wood', 0.06, 0.08, 0.4, x, yE + rise + 0.04, 0);
    }
    gb.cyl(G, 0.075, 0.075, 0.75, 12, 1.7, arc(0.6) + 0.33, 0.6); gb.add(G, new THREE.ConeGeometry(0.16, 0.14, 12).translate(1.7, arc(0.6) + 0.76, 0.6)); gb.cyl(G, 0.13, 0.13, 0.05, 12, 1.7, arc(0.6) + 0.04, 0.6);
    // end platforms: deck, railings, steps at the corners, a hand brake staff on each
    for (const e of [-1, 1]) {
      const xr = e * (he - 0.06);
      gb.box('deckPlate', he - xw + 0.02, 0.05, 2 * hp - 0.04, e * (xw + he) / 2, yT + 0.025, 0);
      for (const z of [-1.38, -0.42, 0.42, 1.38]) gb.add(G, barGeo(0.02, [xr, yT + 0.03, z], [xr, 2.3, z], 6));
      for (const y of [1.8, 2.3]) gb.add(G, barGeo(0.02, [xr, y, -1.38], [xr, y, 1.38], 6));
      for (const s of [-1, 1]) {
        gb.add(G, barGeo(0.018, [xr, 2.3, s * 1.38], [e * (xw + 0.05), 2.3, s * 1.38], 6)); gb.box(G, 0.05, 0.05, 0.08, e * (xw + 0.03), 2.3, s * 1.4);   // top rail back to the body corner
        for (const d of [-0.32, 0.32]) gb.box(G, 0.05, yT - 0.42, 0.05, e * (xw + 0.55) + d, (yT + 0.42) / 2, s * 1.35);
        for (const y of [0.45, 0.85]) gb.box('deckPlate', 0.7, 0.04, 0.26, e * (xw + 0.55), y, s * 1.3);
      }
      staffWheel(gb, G, e * (he - 0.25), -0.9, yT + 0.05, 2.1);
    }
    // underbody: battery and tool boxes
    gb.box(G, 1.0, 0.45, 0.6, 1.3, yT - 0.06 - 0.225, 0.75); gb.box(G, 1.4, 0.4, 0.5, -1.3, yT - 0.06 - 0.2, -0.8);
    // marker lamps on brackets at the rear corners
    for (const s of [-1, 1]) { gb.box(G, 0.2, 0.3, 0.2, -(xw + 0.1), 3.2, s * (hw + 0.06)); gb.cyl(G, 0.05, 0.07, 0.08, 8, -(xw + 0.1), 3.39, s * (hw + 0.06)); gb.box(G, 0.12, 0.04, 0.12, -(xw + 0.06), 3.03, s * (hw - 0.02)); }
    marks(ROAD_SHORT + ' ' + num, '', 'caboose', 1.75, null, hw + 0.006, 0, 0, 2.2, 0.3);
    root.userData.markers = [new THREE.Vector3(-(xw + 0.203), 3.2, -(hw + 0.06)), new THREE.Vector3(-(xw + 0.203), 3.2, hw + 0.06)];
  }
  const couplers = carCouplers(gb, root, L, -0.51, 0.95, 1.12);
  root.add(gb.build(RMAT));
  root.traverse(o => { if (o.isMesh && !o.userData.cpl) { o.castShadow = true; o.receiveShadow = true; } });
  const trucks = [{ a: ta, type: 'four', R: 0.419 }, { a: L - ta, type: 'four', R: 0.419 }];
  return { root, len: L, trucks, frame: [ta, L - ta], weight, kind: type, axles: 4, area: 105, couplers };
}

/* ======== heavyweight coach and observation car ========
   Pullman-built all-steel heavyweight, 80 ft over the end sills: riveted side sheets with a belt rail, paired
   windows with sash, letterboard, a clerestory roof hooded down at the ends, vestibules with steps, trap and
   diaphragm, a fish-belly centre sill with the battery boxes, water tanks and axle generator underneath, on
   six-wheel trucks. The observation car ends in an open brass-railed platform with the drumhead. */
const CH = { L: 24.7, hw: 1.52, yT: 1.30, sill: [1.05, 1.47], belt: 2.13, win: [2.2, 3.0], lint: 3.1, eave: 3.43, xb: 11.0, xv: 11.76 };
function coachModel(spec, num, observation, trim = '') {
  carMaterials();
  const root = new THREE.Group(); const gb = new GeoBin();
  const L = CH.L, hw = CH.hw, he = L / 2 - 0.55, xb0 = CH.xb, yE = CH.eave, G = 'dark';
  const T = TRIM[trim], body = T ? 'holBody' : 'green', low = T ? 'holLow' : 'greenLow', sillK = T ? 'holSill' : 'greenSill', win = T ? 'holWin' : 'win', gold = T ? T.gold : '#d9c27a';
  carFrame(gb, { L, he, hw: hw - 0.04, yT: CH.yT, xb: L / 2 - 3.5, belly: 0.72, tp: TPY6, sb: SBY6, xr: 2.6 });
  // underbody: battery boxes, water tanks, the axle-driven generator, the steam heat line
  for (const [x, z] of [[-1.8, 0.85], [1.0, 0.85]]) { gb.box(G, 1.6, 0.6, 0.62, x, CH.yT - 0.06 - 0.3, z); for (const d of [-0.6, 0.6]) gb.box(G, 0.06, 0.08, 0.7, x + d, CH.yT - 0.08, z); }
  for (const x of [-4.6, 4.6]) { gb.add(G, new THREE.CylinderGeometry(0.34, 0.34, 1.8, 16).rotateZ(Math.PI / 2).translate(x, CH.yT - 0.06 - 0.36, -0.85)); for (const d of [-0.6, 0.6]) gb.box(G, 0.08, 0.06, 0.5, x + d, CH.yT - 0.08, -0.85); }
  gb.add(G, new THREE.CylinderGeometry(0.22, 0.22, 0.7, 14).rotateZ(Math.PI / 2).translate(5.7, CH.yT - 0.3, 0.75)); gb.box(G, 0.6, 0.26, 0.3, 5.7, CH.yT - 0.15, 0.75);
  gb.add(G, barGeo(0.03, [-(he - 0.3), 0.98, -0.34], [he - 0.3, 0.98, -0.34], 6));
  for (let x = -(he - 0.8); x < he - 0.5; x += 3.0) gb.box(G, 0.05, CH.yT - 0.06 - 0.98, 0.05, x, (CH.yT - 0.06 + 0.98) / 2, -0.34);
  // the sides: riveted side sill, lower sheets, belt rail, window band with its posts, lintel and letterboard
  const pairs = []; for (let i = 0; i < 13; i++) pairs.push(-9.5 + i * 1.58);
  const opens = []; for (const x of pairs) for (const d of [-0.33, 0.33]) opens.push([x + d - 0.28, x + d + 0.28]);
  const [w0, w1] = CH.win;
  for (const s of [-1, 1]) {
    const z = s * (hw - 0.02);
    gb.box(sillK, 2 * xb0, CH.sill[1] - CH.sill[0], 0.05, 0, (CH.sill[0] + CH.sill[1]) / 2, s * (hw - 0.01));
    gb.box(low, 2 * xb0, CH.belt - CH.sill[1] + 0.01, 0.04, 0, (CH.belt + CH.sill[1]) / 2, z);
    gb.box(body, 2 * xb0, 0.07, 0.06, 0, CH.belt + 0.035, s * (hw - 0.01));                            // belt rail
    let x = -xb0; for (const [a, b] of opens) { gb.box(body, a - x + 0.002, w1 - w0, 0.04, (a + x) / 2, (w0 + w1) / 2, z); x = b; }
    gb.box(body, xb0 - x + 0.002, w1 - w0, 0.04, (xb0 + x) / 2, (w0 + w1) / 2, z);
    gb.box(win, 2 * xb0 - 0.4, w1 - w0, 0.02, 0, (w0 + w1) / 2, s * (hw - 0.05));                      // glazing behind the posts
    for (const [a, b] of opens) {
      gb.box(G, b - a, 0.035, 0.03, (a + b) / 2, w0 + (w1 - w0) * 0.62, s * (hw - 0.035));             // meeting rail of the sash
      gb.box(body, b - a + 0.03, 0.04, 0.07, (a + b) / 2, w0 - 0.01, s * (hw - 0.0));                  // window sill
    }
    gb.box(body, 2 * xb0, CH.lint - w1 + 0.01, 0.06, 0, (CH.lint + w1) / 2, s * (hw - 0.01));          // lintel band
    gb.box(body, 2 * xb0, yE - CH.lint + 0.01, 0.04, 0, (yE + CH.lint) / 2, z);                        // letterboard
    gb.box(body, 2 * xb0 + 0.02, 0.05, 0.09, 0, yE - 0.02, s * (hw + 0.01));                           // cornice
  }
  // letterboard and car number
  const lk = 'lb' + (T ? trim : spec.short);
  RMAT[lk] = textDecal(T ? T.road : spec.road, 1024, 128, gold, 'serif', 72);
  for (const s of [-1, 1]) gb.add(lk, new THREE.PlaneGeometry(11, 0.32), M(0, (yE + CH.lint) / 2, s * (hw + 0.002), 0, s > 0 ? 0 : Math.PI, 0));
  const nk = 'cn' + num + trim; RMAT[nk] = textDecal(String(num), 256, 96, gold, 'serif', 64);
  for (const s of [-1, 1]) gb.add(nk, new THREE.PlaneGeometry(0.9, 0.32), M(-7.5, 1.8, s * (hw + 0.002), 0, s > 0 ? 0 : Math.PI, 0));
  // vestibules: side walls with the Dutch door, steps under it, grab irons beside it, the end wall and the diaphragm
  const xd = (CH.xb + CH.xv) / 2, dw = 0.62;
  const vest = e => {
    const xv = e * CH.xv, zz = hw - 0.02;
    for (const s of [-1, 1]) {
      const z = s * zz;
      gb.box(body, 0.08, yE - CH.yT, 0.05, e * (CH.xb + 0.03), (yE + CH.yT) / 2, z);                     // door posts
      gb.box(body, 0.06, yE - CH.yT, 0.05, e * (CH.xv - 0.03), (yE + CH.yT) / 2, z);
      gb.box(body, CH.xv - CH.xb, yE - 3.08, 0.05, e * xd, (yE + 3.08) / 2, z);                          // over the door
      gb.box(body, dw, 3.08 - CH.yT, 0.04, e * xd, (3.08 + CH.yT) / 2, s * (zz - 0.04));                 // the door
      gb.box(win, dw - 0.16, 0.66, 0.02, e * xd, 2.6, s * (zz - 0.015));
      gb.box(G, dw, 0.04, 0.03, e * xd, 2.2, s * (zz - 0.01));                                             // the Dutch door's split
      gb.box('brass', 0.03, 0.12, 0.05, e * (xd - 0.24), 2.05, s * (zz + 0.0));
      for (const x of [e * (CH.xb - 0.0), e * (CH.xv + 0.0)]) gb.add('brass', barGeo(0.013, [x, 1.5, s * (hw + 0.06)], [x, 2.9, s * (hw + 0.06)], 5)), gb.box('brass', 0.04, 0.04, 0.09, x, 1.55, s * (hw + 0.03)), gb.box('brass', 0.04, 0.04, 0.09, x, 2.85, s * (hw + 0.03));
      // steps: three treads on stringers hung from the floor, and the trap plate at floor level
      for (const d of [-1, 1]) gb.box(G, 0.04, CH.yT - 0.36, 0.34, e * xd + d * (dw / 2 - 0.02), (CH.yT + 0.36) / 2, s * (zz - 0.18));
      for (const y of [0.4, 0.72, 1.02]) gb.box(G, dw - 0.06, 0.04, 0.32 - (y - 0.4) * 0.2, e * xd, y, s * (zz - 0.18 + (y - 0.4) * 0.1 * 0));
      gb.box(G, dw - 0.06, 0.04, 0.36, e * xd, CH.yT - 0.02, s * (zz - 0.18));
      if (T) addWreath(gb, 0.15, 0.035, M(e * xd, 2.62, s * (zz + 0.0), 0, s > 0 ? 0 : Math.PI, 0));
    }
    // end wall with the end door
    for (const s of [-1, 1]) gb.box(body, 0.06, yE - CH.yT, hw - 0.42, xv, (yE + CH.yT) / 2, s * (hw + 0.42) / 2);
    gb.box(body, 0.06, yE - 3.1, 0.84, xv, (yE + 3.1) / 2, 0);
    gb.box(G, 0.04, 3.1 - CH.yT, 0.84, xv - e * 0.01, (3.1 + CH.yT) / 2, 0);
    // diaphragm: bellows out to a face plate at the coupler line, with its buffer and the hood's curtain rods
    const x0 = CH.xv, x1 = L / 2 - 0.03;
    for (let i = 0; i < 6; i++) { const xa = x0 + (x1 - 0.06 - x0) * i / 6, xb = x0 + (x1 - 0.06 - x0) * (i + 1) / 6, k = i % 2 ? 0.04 : 0; gb.box('diaphragm', xb - xa + 0.003, 2.5 - k, 1.5 - k, e * (xa + xb) / 2, 2.35, 0); }
    gb.box(G, 0.07, 2.52, 1.56, e * (x1 - 0.035), 2.35, 0);
    gb.box('diaphragm', 0.03, 2.2, 1.0, e * (x1 + 0.01), 2.35, 0);
    gb.box(G, 0.12, 0.2, 1.2, e * (CH.xv + 0.06), CH.yT - 0.1 + 0.2, 0);                                  // buffer beam over the end sill
  };
  vest(1); if (!observation) vest(-1);
  // roof: the lower deck curving up from the eaves, the clerestory with its deck sash, and its arched top,
  // hooded down over each end
  const rE = hw + 0.06, rD = 0.86, hD = 0.35, hC = 0.59, cr = 1.03;
  const deck = new THREE.Shape(); deck.moveTo(-rE, 0); deck.quadraticCurveTo(-hw * 0.9, 0.3, -rD, hD); deck.lineTo(rD, hD); deck.quadraticCurveTo(hw * 0.9, 0.3, rE, 0); deck.closePath();
  const rL0 = observation ? -(L / 2 - 0.1) : -(CH.xv + 0.06), rL1 = CH.xv + 0.06;
  gb.add('roof', new THREE.ExtrudeGeometry(deck, { depth: rL1 - rL0, bevelEnabled: false, curveSegments: 10 }).rotateY(Math.PI / 2).translate(rL0, yE, 0));
  const clr = []; clr.push([-rD, hD - 0.02], [rD, hD - 0.02], [rD, hC]); for (let i = 1; i < 12; i++) { const t = i / 12, z = lerp(rD, -rD, t); clr.push([z, (1 - t) * (1 - t) * hC + 2 * (1 - t) * t * cr + t * t * hC]); } clr.push([-rD, hC]);
  const cs = new THREE.Shape(); cs.moveTo(...clr[0]); for (const p of clr.slice(1)) cs.lineTo(...p); cs.closePath();
  const xc0 = rL0 + (observation ? 0.6 : 0.62), xc1 = rL1 - 0.62;
  gb.add('roof', new THREE.ExtrudeGeometry(cs, { depth: xc1 - xc0, bevelEnabled: false }).rotateY(Math.PI / 2).translate(xc0, yE, 0));
  for (const [xa, xb] of [[xc1, rL1 - 0.02], [xc0, rL0 + 0.02]]) {      // the hoods: the clerestory section lofted down to the deck
    const pos = [], q = clr.map(([z, y]) => [z, y]), n = q.length, lo = ([z, y]) => [z, hD - 0.02 + (y - hD + 0.02) * 0.04];
    for (let i = 0; i < n; i++) {
      const a = q[i], b = q[(i + 1) % n], A = [xa, yE + a[1], a[0]], B = [xa, yE + b[1], b[0]], la = lo(a), lb = lo(b), C = [xb, yE + lb[1], lb[0]], D = [xb, yE + la[1], la[0]];
      pos.push(...A, ...B, ...C, ...A, ...C, ...D);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); gb.add('roof', g);
  }
  for (let i = 0; i < 12; i++) for (const s of [-1, 1]) gb.box(win, 0.5, 0.15, 0.02, -9.4 + i * 1.71, yE + (hD + hC) / 2, s * (rD + 0.005));   // deck sash
  for (let i = 0; i < 7; i++) for (const s of [-1, 1]) {        // Garland ventilators on the clerestory roof
    const z = s * 0.42, t = (rD - z) / (2 * rD), yv = yE + (1 - t) * (1 - t) * hC + 2 * (1 - t) * t * cr + t * t * hC;
    gb.box('roof', 0.36, 0.2, 0.24, -9.0 + i * 3.0, yv + 0.06, z); gb.box('roof', 0.42, 0.04, 0.3, -9.0 + i * 3.0, yv + 0.17, z);
  }
  if (observation) {
    // open rear platform: the lounge end wall with its door and wide windows, the deck, brass railing and gates,
    // steps either side, the drumhead, and marker lamps under the roof's overhang
    const xw = -CH.xb, xP = -(L / 2 - 0.15);
    for (const s of [-1, 1]) {
      gb.box(body, 0.06, w0 - CH.yT, hw - 0.4, xw - 0.03, (w0 + CH.yT) / 2, s * (hw + 0.4) / 2);
      gb.box(body, 0.06, yE - w1, hw - 0.4, xw - 0.03, (yE + w1) / 2, s * (hw + 0.4) / 2);
      gb.box(win, 0.02, w1 - w0, hw - 0.5, xw - 0.03, (w0 + w1) / 2, s * (hw + 0.45) / 2);
      gb.box(body, 0.06, w1 - w0, 0.08, xw - 0.03, (w0 + w1) / 2, s * (hw - 0.04));
      gb.box(body, 0.06, w1 - w0, 0.08, xw - 0.03, (w0 + w1) / 2, s * 0.44);
    }
    gb.box(body, 0.06, yE - 3.1, 0.8, xw - 0.03, (yE + 3.1) / 2, 0);
    gb.box(G, 0.04, 3.1 - CH.yT, 0.8, xw - 0.06, (3.1 + CH.yT) / 2, 0); gb.box(win, 0.02, 0.8, 0.5, xw - 0.08, 2.55, 0);
    // the platform in the style of the great observation-car ends: rounded corners, a deck of teak boards, a railing of
    // turned balusters with scrollwork between the rails, a lantern hung at each corner of the canopy, a valance under it
    const xr = xP + 0.04, zR = 1.42, Rc = 0.38, rail = T ? 'gold' : 'brass', yTop = 2.3, yMid = 1.78;
    const outline = [];   // the railing's line: down one side, round the corner, across the end, round and back up
    for (const s of [-1, 1]) {
      const pts = [[xw - 0.62, s * zR], [xr + Rc, s * zR]];
      for (let i = 1; i <= 6; i++) { const a = i / 6 * Math.PI / 2; pts.push([xr + Rc - Math.sin(a) * Rc, s * (zR - Rc + Math.cos(a) * Rc)]); }
      if (s < 0) outline.push(...pts); else outline.push(...pts.reverse());
    }
    const deck = new THREE.Shape(); deck.moveTo(xw, -hw + 0.02);
    for (const [x, z] of outline.slice(0, outline.length / 2)) deck.lineTo(x - 0.04 * (x < xr + Rc ? 1 : 0), z * 1.02);
    for (const [x, z] of outline.slice(outline.length / 2)) deck.lineTo(x - 0.04 * (x < xr + Rc ? 1 : 0), z * 1.02);
    deck.lineTo(xw, hw - 0.02); deck.closePath();
    gb.add('wood', new THREE.ExtrudeGeometry(deck, { depth: 0.06, bevelEnabled: false, curveSegments: 4 }).rotateX(Math.PI / 2).translate(0, CH.yT, 0));
    gb.add(G, new THREE.ExtrudeGeometry(deck, { depth: 0.2, bevelEnabled: false, curveSegments: 4 }).rotateX(Math.PI / 2).translate(0, CH.yT - 0.06, 0).scale(1, 1, 0.97));
    const P3 = (y) => outline.map(([x, z]) => [x, y, z]);
    for (const y of [yTop, yMid]) for (let i = 0; i + 1 < outline.length; i++) { const [p, q] = [P3(y)[i], P3(y)[i + 1]]; gb.add(rail, barGeo(y === yTop ? 0.026 : 0.018, p, q, 8)); gb.add(rail, new THREE.SphereGeometry(y === yTop ? 0.026 : 0.018, 8, 6).translate(...q)); }
    // balusters every 16 cm along the line, a heavier post at each end and corner, scrolls between the rails
    let acc = 0;
    for (let i = 0; i + 1 < outline.length; i++) {
      const [x0, z0] = outline[i], [x1, z1] = outline[i + 1], L = Math.hypot(x1 - x0, z1 - z0);
      for (let d = (0.16 - acc) % 0.16; d < L; d += 0.16) { const t = d / L, x = lerp(x0, x1, t), z = lerp(z0, z1, t); gb.add(rail, barGeo(0.009, [x, CH.yT, z], [x, yTop, z], 5)); }
      acc = (acc + L) % 0.16;
    }
    for (const [x, z] of [outline[0], outline[outline.length - 1], [xr, -(zR - Rc)], [xr, zR - Rc], [xr + Rc, -zR], [xr + Rc, zR]]) { gb.cyl(rail, 0.03, 0.035, yTop - CH.yT, 10, x, (yTop + CH.yT) / 2, z); gb.add(rail, new THREE.SphereGeometry(0.045, 10, 8).translate(x, yTop + 0.04, z)); }
    for (const z of [-0.74, 0.74]) gb.add(rail, new THREE.TorusGeometry(0.2, 0.012, 6, 24).rotateY(Math.PI / 2).translate(xr, (yTop + yMid) / 2, z));
    for (const s of [-1, 1]) gb.add(rail, new THREE.TorusGeometry(0.2, 0.012, 6, 24).translate(xw - 0.95, (yTop + yMid) / 2, s * zR));
    for (const s of [-1, 1]) {
      // the gate opening, steps and a grab post at the body corner
      gb.add(rail, barGeo(0.02, [xw - 0.06, yTop, s * (hw - 0.04)], [xw - 0.06, CH.yT + 0.1, s * (hw - 0.04)], 6));
      gb.box(rail, 0.08, 0.04, 0.05, xw - 0.04, yTop - 0.1, s * (hw - 0.04)); gb.box(rail, 0.08, 0.04, 0.05, xw - 0.04, CH.yT + 0.2, s * (hw - 0.04));
      const xs = (xw - 0.06 + xw - 0.62) / 2;
      for (const d of [-0.26, 0.26]) gb.box(G, 0.04, CH.yT - 0.4, 0.3, xs + d, (CH.yT + 0.4) / 2 - 0.06, s * (hw - 0.2));
      for (const y of [0.42, 0.85]) gb.box(G, 0.52, 0.04, 0.3, xs, y, s * (hw - 0.2));
    }
    if (T) for (const s of [-1, 1]) addSwags(gb, [xw - 0.62, (xw - 0.62 + xr + Rc) / 2, xr + Rc], yTop - 0.01, 0.1, s * zR, 0.035);
    // valance under the canopy's edge, and a lantern on a bracket at each corner
    gb.box(body, 0.05, 0.16, 2 * hw + 0.08, xP - 0.03, yE - 0.06, 0);
    if (T) gb.box('gold', 0.012, 0.03, 2 * hw + 0.04, xP - 0.058, yE - 0.06, 0);
    for (const z of [-1.2, 1.2]) {
      const xl = xP + 0.13, yl = yE - 0.42;
      gb.add(G, barGeo(0.012, [xl, yE + 0.02, z], [xl, yl + 0.2, z], 5));
      gb.add(G, new THREE.ConeGeometry(0.11, 0.12, 12).translate(xl, yl + 0.17, z));
      gb.cyl(G, 0.1, 0.1, 0.03, 12, xl, yl + 0.11, z);
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; gb.add(G, barGeo(0.008, [xl + Math.cos(a) * 0.085, yl - 0.11, z + Math.sin(a) * 0.085], [xl + Math.cos(a) * 0.085, yl + 0.11, z + Math.sin(a) * 0.085], 4)); }
      gb.cyl('glass', 0.08, 0.08, 0.2, 12, xl, yl, z);
      gb.cyl(G, 0.1, 0.07, 0.05, 12, xl, yl - 0.12, z);
    }
    const ink = T ? '#8a1219' : '#6b1f1a';
    const dh = decalMat(256, 256, (g, w, h) => {
      g.fillStyle = '#e9dfc2'; g.beginPath(); g.arc(128, 128, 122, 0, TAU); g.fill(); g.strokeStyle = ink; g.lineWidth = 10; g.stroke(); g.fillStyle = ink; g.font = '600 30px "Times New Roman", serif'; g.textAlign = 'center';
      const t = T ? T.drum : { NKP: ['THE', 'NICKEL PLATE', 'LIMITED'], PM: ['THE', 'PERE', 'MARQUETTE'], 'S&S': ['THE', 'SCIOTO', 'LIMITED'] }[spec.short] || ['THE', 'LAKE SHORE', 'LIMITED'];
      g.fillText(t[0], 128, 92); g.font = '700 34px "Times New Roman", serif'; g.fillText(t[1], 128, 134); g.font = '600 30px "Times New Roman", serif'; g.fillText(t[2], 128, 176);
      if (T) {   // a gold star over the name and a sprig of holly under it
        g.fillStyle = '#c8962e'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 7 : 17; g.lineTo(128 + Math.cos(a) * r, 52 + Math.sin(a) * r); } g.closePath(); g.fill();
        g.fillStyle = '#1f5a2c'; for (const d of [-1, 1]) { g.beginPath(); g.ellipse(128 + d * 16, 208, 16, 7, d * 0.4, 0, TAU); g.fill(); }
        g.fillStyle = '#c8161e'; for (const d of [-6, 0, 6]) { g.beginPath(); g.arc(128 + d, 204 + Math.abs(d) * 0.5, 5, 0, TAU); g.fill(); }
      }
    });
    const dk = 'drumhead' + trim; RMAT[dk] = dh; dh.emissive = new THREE.Color(0xffd9a0); dh.emissiveMap = dh.map; dh.emissiveIntensity = 0; SCN.winMats.push(dh);
    const xd2 = xr - 0.035;
    gb.cyl('brass', 0.44, 0.44, 0.05, 28, xd2 + 0.0, 1.95, 0, 0, 0, Math.PI / 2);
    gb.add(dk, new THREE.CircleGeometry(0.42, 28), M(xd2 - 0.027, 1.95, 0, 0, -Math.PI / 2, 0));
    gb.add('brass', barGeo(0.015, [xd2, 2.39, 0], [xr, 2.3, 0], 5));
    if (T) addWreath(gb, 0.5, 0.06, M(xd2 - 0.03, 1.95, 0, 0, -Math.PI / 2, 0));   // the drumhead ringed with fir
    gb.add('brass', new THREE.TorusGeometry(0.43, 0.025, 6, 28).rotateY(Math.PI / 2).translate(xd2 - 0.025, 1.95, 0));
    root.userData.markers = [new THREE.Vector3(xP + 0.045, yE - 0.42, -1.2), new THREE.Vector3(xP + 0.045, yE - 0.42, 1.2)];
  }
  if (T) {
    // gold lining along the belt rail and the sill, garland swagged between the window pairs, snow on the roof
    for (const s of [-1, 1]) for (const y of [CH.belt - 0.06, CH.sill[1] + 0.05]) gb.box('gold', 21.8, 0.035, 0.012, 0, y, s * (hw + 0.006));
    const xs = []; for (let i = 0; i <= 13; i++) xs.push(-9.5 - 0.79 + i * 1.58);
    for (const s of [-1, 1]) addSwags(gb, xs, CH.lint - 0.02, 0.07, s * (hw + 0.035), 0.04);
    const Ls = xc1 - xc0 - 0.2, x0 = xc0 + 0.1;
    gb.add('snow', snowCap(quadPts([-rD, hC], [0, cr], [rD, hC], 16).map(([z, y]) => [z, y + yE]), 0.045, Ls, 0.3).translate(x0, 0, 0));
    for (const s of [-1, 1]) {   // the lower deck, from the eaves' shoulder in to the clerestory wall
      const pts = quadPts([s * rE, 0], [s * hw * 0.9, 0.3], [s * rD, hD], 12, 0.5, 1).map(([z, y]) => [z, y + yE]);
      if (s > 0) pts.reverse();
      gb.add('snow', snowCap(pts, 0.04, Ls, 0.22).translate(x0, 0, 0));
    }
  }
  const couplers = carCouplers(gb, root, L, -0.55, 0.955, 1.08);
  root.add(gb.build(RMAT));
  root.traverse(o => { if (o.isMesh && !o.userData.cpl) { o.castShadow = true; o.receiveShadow = true; } });
  return { root, len: L, trucks: [{ a: 3.5, type: 'six', R: 0.457 }, { a: 21.2, type: 'six', R: 0.457 }], frame: [3.5, 21.2], weight: 82 * STON, kind: 'coach', axles: 6, area: 120, couplers };
}

/* ======== trucks ========
   Freight: a 70 t cast steel truck in the ASF A-3 Ride Control style, 5 ft 8 in wheelbase, 33 in wheels:
   side frames with pedestal jaws round friction journal boxes, a spring nest under each bolster end, the bolster
   with its centre plate bowl and side bearings, and the brake beams with their shoes on the wheel treads.
   Passenger: a Commonwealth cast six-wheel truck, 11 ft wheelbase, 36 in wheels, with equalizers under the
   journal boxes, coil springs, a bolster riding over the middle wheels and clasp brakes on every wheel.
   Tender: one-piece side frames with 60 in axle spacing (TD.sp). */
function coilGeo(r, h, turns = 3, wire = 0.013) {
  const pts = []; for (let i = 0; i <= turns * 8; i++) { const a = i / 8 * TAU; pts.push(new THREE.Vector3(Math.cos(a) * r, h * i / (turns * 8), Math.sin(a) * r)); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 8, wire, 3, false);
}
function journalBox(bin, x, y, z, w, h, d) {
  bin.box('dark', w, h, d, x, y, z);
  bin.box('dark', w * 0.82, h * 0.78, 0.03, x, y + h * 0.02, z + Math.sign(z) * (d / 2 + 0.012));        // the lid
  bin.add('dark', new THREE.CylinderGeometry(0.025, 0.025, w * 0.5, 8).rotateZ(Math.PI / 2).translate(x, y + h * 0.42, z + Math.sign(z) * (d / 2 + 0.02)));   // lid hinge
}
/* brake shoes on the treads of the wheels at xs, on the side of each wheel toward dir(x) (+1/-1), on beams across */
function brakeShoes(bin, R, list, yHang, zHang) {
  for (const [xa, d] of list) {
    const th = 0.2, cx = xa + d * (R + 0.022) * Math.cos(th), cy = R - (R + 0.022) * Math.sin(th);
    for (const s of [-1, 1]) {
      bin.add('dark', new THREE.BoxGeometry(0.05, 0.34, 0.09).rotateZ(d * th), M(cx, cy, s * RAIL_OFF));
      bin.box('dark', 0.07, 0.16, 0.12, cx + d * 0.05, cy, s * (RAIL_OFF - 0.01));                          // brake head
      bin.add('dark', barGeo(0.016, [cx + d * 0.06, cy, s * (RAIL_OFF + 0.04)], [cx + d * 0.08, yHang, s * zHang], 5));   // hanger to the frame
    }
    bin.add('dark', barGeo(0.03, [cx + d * 0.07, cy, -RAIL_OFF], [cx + d * 0.07, cy, RAIL_OFF], 6));         // brake beam
    bin.add('dark', barGeo(0.014, [cx + d * 0.07, cy, -RAIL_OFF + 0.05], [cx + d * 0.2, cy - 0.06, 0], 5));   // its truss rod
    bin.add('dark', barGeo(0.014, [cx + d * 0.07, cy, RAIL_OFF - 0.05], [cx + d * 0.2, cy - 0.06, 0], 5));
    bin.box('dark', 0.05, 0.3, 0.05, cx + d * 0.2, cy + 0.06, 0);                                           // brake lever
  }
}
function truckBins() {
  const zf = 1.0;
  /* --- 70 t freight truck --- */
  const four = new GeoBin(), a4 = 0.865;
  for (const s of [-1, 1]) {
    const z = s * zf, fr = new THREE.Shape();
    fr.moveTo(-1.13, 0.74); fr.lineTo(-0.95, 0.8); fr.lineTo(0.95, 0.8); fr.lineTo(1.13, 0.74);
    fr.lineTo(1.13, 0.4); fr.lineTo(1.06, 0.4); fr.lineTo(1.06, 0.6); fr.lineTo(0.67, 0.6); fr.lineTo(0.67, 0.4); fr.lineTo(0.6, 0.4);
    fr.lineTo(0.56, 0.47); fr.lineTo(0.36, 0.28); fr.lineTo(-0.36, 0.28); fr.lineTo(-0.56, 0.47);
    fr.lineTo(-0.6, 0.4); fr.lineTo(-0.67, 0.4); fr.lineTo(-0.67, 0.6); fr.lineTo(-1.06, 0.6); fr.lineTo(-1.06, 0.4); fr.lineTo(-1.13, 0.4); fr.closePath();
    const win = new THREE.Path(); win.moveTo(-0.3, 0.34); win.lineTo(0.3, 0.34); win.lineTo(0.3, 0.71); win.lineTo(-0.3, 0.71); win.closePath(); fr.holes.push(win);
    for (const d of [-1, 1]) { const h = new THREE.Path(); h.moveTo(d * 0.36, 0.73); h.lineTo(d * 0.585, 0.73); h.lineTo(d * 0.4, 0.47); h.closePath(); fr.holes.push(h); }
    four.add('dark', new THREE.ExtrudeGeometry(fr, { depth: 0.13, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1 }).translate(0, 0, z - 0.065));
    for (const x of [-a4, a4]) journalBox(four, x, 0.425, z, 0.39, 0.34, 0.3);
    for (const x of [-0.19, 0, 0.19]) for (const dz of [-0.04, 0.04]) four.add('dark', coilGeo(0.05, 0.2, 3).translate(x, 0.335, z + dz));   // spring nest
    four.box('dark', 0.62, 0.03, 0.18, 0, 0.335, z);                                                         // spring seat
    four.box('dark', 0.05, 0.12, 0.06, 0.26, 0.6, z + s * 0.07);                                             // Ride Control friction wedge
  }
  hexa(four, 'dark', [[-0.18, 0.53, -zf], [0.18, 0.53, -zf], [0.18, 0.76, -zf], [-0.18, 0.76, -zf], [-0.18, 0.53, 0], [0.18, 0.53, 0], [0.18, 0.79, 0], [-0.18, 0.79, 0]].map(([x, y, z]) => [x, y, z]));
  hexa(four, 'dark', [[-0.18, 0.53, zf], [0.18, 0.53, zf], [0.18, 0.76, zf], [-0.18, 0.76, zf], [-0.18, 0.53, 0], [0.18, 0.53, 0], [0.18, 0.79, 0], [-0.18, 0.79, 0]]);
  four.box('dark', 0.36, 0.06, 0.02, 0, 0.555, 0);   // ties the two bolster halves
  four.cyl('dark', 0.21, 0.21, TPY - 0.78, 16, 0, (TPY + 0.78) / 2, 0);
  for (const s of [-1, 1]) four.box('dark', 0.2, SBY - 0.77, 0.16, 0, (SBY + 0.77) / 2, s * 0.64);
  brakeShoes(four, 0.419, [[-a4, 1], [a4, -1]], 0.66, zf - 0.06);
  /* --- Commonwealth six-wheel passenger truck --- */
  const six = new GeoBin(), sp = 1.676, R6 = 0.457, b = 0.2;
  const sixFrame = (bin, sp, xEnd, R) => {
    for (const s of [-1, 1]) {
      const z = s * zf, fr = new THREE.Shape(), top = 1.0, Jt = R + 0.19, Jb = R - 0.06;
      fr.moveTo(-xEnd, 0.74); fr.lineTo(-xEnd, top - 0.08); fr.lineTo(-xEnd + 0.15, top); fr.lineTo(xEnd - 0.15, top); fr.lineTo(xEnd, top - 0.08); fr.lineTo(xEnd, 0.74);
      const cs = [sp, 0, -sp];
      for (let i = 0; i < 3; i++) {
        const c = cs[i];
        fr.lineTo(c + b + 0.07, 0.74); fr.lineTo(c + b + 0.07, Jb); fr.lineTo(c + b, Jb); fr.lineTo(c + b, Jt); fr.lineTo(c - b, Jt); fr.lineTo(c - b, Jb); fr.lineTo(c - b - 0.07, Jb); fr.lineTo(c - b - 0.07, 0.74);
        if (i < 2) { const m = (c + cs[i + 1]) / 2; fr.quadraticCurveTo(m, 0.6, cs[i + 1] + b + 0.07, 0.74); }
      }
      fr.closePath();
      for (const c of [-sp / 2, sp / 2]) { const h = new THREE.Path(); h.moveTo(c - 0.26, 0.78); h.lineTo(c + 0.26, 0.78); h.quadraticCurveTo(c + 0.32, 0.84, c + 0.26, 0.9); h.lineTo(c - 0.26, 0.9); h.quadraticCurveTo(c - 0.32, 0.84, c - 0.26, 0.78); fr.holes.push(h); }
      bin.add('dark', new THREE.ExtrudeGeometry(fr, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1 }).translate(0, 0, z - 0.07));
      for (const c of cs) journalBox(bin, c, R - 0.01, z, 2 * b, Jt - (R - 0.01) + (R - 0.01 - 0.25), 0.32);
      // equalizers under the boxes, with their springs up to the frame
      for (const d of [-1, 1]) {
        const x0 = d * 0.02, x1 = d * sp;
        hexa(bin, 'dark', [[x0, 0.19, z - 0.05], [x0, 0.19, z + 0.05], [x0, 0.25, z + 0.05], [x0, 0.25, z - 0.05], [x1, 0.19, z - 0.05], [x1, 0.19, z + 0.05], [x1, 0.25, z + 0.05], [x1, 0.25, z - 0.05]]);
        for (const xs of [d * (sp / 2 - 0.17), d * (sp / 2 + 0.17)]) { bin.add('dark', coilGeo(0.06, 0.6 - 0.24, 4, 0.015).translate(xs, 0.245, z)); bin.box('dark', 0.16, 0.03, 0.14, xs, 0.25, z); }
      }
    }
  };
  sixFrame(six, sp, 2.12, R6);
  hexa(six, 'dark', [[-0.26, 0.95, -zf], [0.26, 0.95, -zf], [0.26, 1.0, -zf], [-0.26, 1.0, -zf], [-0.26, 0.95, 0], [0.26, 0.95, 0], [0.26, TPY6 - 0.03, 0], [-0.26, TPY6 - 0.03, 0]]);
  hexa(six, 'dark', [[-0.26, 0.95, zf], [0.26, 0.95, zf], [0.26, 1.0, zf], [-0.26, 1.0, zf], [-0.26, 0.95, 0], [0.26, 0.95, 0], [0.26, TPY6 - 0.03, 0], [-0.26, TPY6 - 0.03, 0]]);
  six.cyl('dark', 0.22, 0.22, 0.05, 16, 0, TPY6 - 0.025, 0);
  for (const s of [-1, 1]) six.box('dark', 0.2, 0.08, 0.16, 0, SBY6 - 0.04, s * 0.7);
  for (const x of [-0.75, 0.75]) six.box('dark', 0.16, 0.12, 2 * zf, x, 0.93, 0);                   // transoms
  brakeShoes(six, R6, [[-sp, -1], [-sp, 1], [0, -1], [0, 1], [sp, -1], [sp, 1]], 0.8, zf - 0.07);
  /* --- the Berkshire tender's six-wheel truck --- */
  const buck = new GeoBin(), tsp = TD.sp;
  for (const s of [-1, 1]) {
    const z = s * zf, fr = new THREE.Shape(), top = 0.8, bot = 0.5;
    fr.moveTo(-tsp - 0.32, 0.56); fr.lineTo(-tsp - 0.32, top); fr.lineTo(tsp + 0.32, top); fr.lineTo(tsp + 0.32, 0.56); fr.lineTo(tsp - 0.25, 0.56);
    fr.lineTo(tsp - 0.42, bot); fr.lineTo(0.42, bot); fr.lineTo(0.25, 0.56); fr.lineTo(-0.25, 0.56); fr.lineTo(-0.42, bot); fr.lineTo(-tsp + 0.42, bot); fr.lineTo(-tsp + 0.25, 0.56); fr.closePath();
    buck.add('dark', new THREE.ExtrudeGeometry(fr, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1 }).translate(0, 0, z - 0.08));
    for (const x of [-tsp, 0, tsp]) journalBox(buck, x, 0.457, z, 0.36, 0.34, 0.28);
    for (const x of [-tsp / 2, tsp / 2]) { for (let k = 0; k < 3; k++) buck.add('dark', coilGeo(0.06, 0.22, 3).translate(x, 0.55, z + (k - 1) * 0.07)); buck.box('dark', 0.36, 0.05, 0.3, x, 0.79, z); buck.box('dark', 0.36, 0.04, 0.3, x, 0.55, z); }
  }
  for (const x of [-tsp / 2, tsp / 2]) buck.box('dark', 0.34, 0.24, 2.18, x, 0.9, 0);   // bolsters
  buck.box('dark', tsp + 0.34, 0.12, 0.5, 0, 0.94, 0);                                  // span bolster with the centre plate
  brakeShoes(buck, 0.457, [[-tsp, -1], [0, -1], [0, 1], [tsp, 1]], 0.6, zf - 0.08);
  return { six, four, buck };
}
/* truck frame geometries for instancing */
function truckGeos() { const b = truckBins(); return { six: mergeGeos(b.six.bins.dark), four: mergeGeos(b.four.bins.dark), buck: mergeGeos(b.buck.bins.dark) }; }

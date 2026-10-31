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
function plainAxle(R, disc = true, tread = RAIL_OFF) {
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
  const bell = (bx, by) => {
    gb.add('brass', new THREE.LatheGeometry([[0, 0.27], [0.09, 0.27], [0.16, 0.24], [0.21, 0.13], [0.25, 0.0], [0.24, -0.01]].map(p => new THREE.Vector2(p[0], p[1])), 28).translate(bx, by, 0));
    for (const z of [-0.3, 0.3]) gb.box('black', 0.06, 0.38, 0.05, bx, by + 0.2, z);
    gb.cylZ('dark', 0.025, 0.62, 8, bx, by + 0.22, 0);
    gb.box('black', 0.08, 0.06, 0.66, bx, by + 0.4, 0);
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
    if (trim) addWreath(gb, 0.33, 0.055, M(ax(door.a - 0.015), yB - 0.48, 0, 0, Math.PI / 2, 0));
  } else {
    // round lamp in the door centre with a brass rim, the bell up on top of the smokebox front, number plate beside the lamp
    { const ln = headlamp(door.a - 0.44, yB + 0.05, 0.3, 0.46, 'brass'); hlPos = [ax(ln.a), yB + 0.05]; hlR = ln.r; lensA = ln.a; }
    // holiday: a wreath round the lamp drum, hugging the case just ahead of the number board
    if (trim) addWreath(gb, 0.4, 0.07, M(ax(door.a - 0.05), yB + 0.05, 0, 0, Math.PI / 2, 0));
    gb.box('black', 0.3, 0.3, 0.3, ax(door.a - 0.05), yB - 0.18, 0);                         // lamp bracket on the door
    gb.box('black', 0.08, 0.24, 0.42, ax(door.a - 0.01), yB - 0.1, 0.55);
    gb.add('num' + key, new THREE.PlaneGeometry(0.34, 0.18), M(ax(door.a - 0.052), yB - 0.1, 0.55, 0, Math.PI / 2, 0));
    bell(ax(BOIL.sb[0] - 0.2), sbTop - 0.3);
    gb.box('black', 0.44, 0.08, 0.12, ax(BOIL.sb[0] + 0.02), sbTop + 0.1, 0);                 // bell bracket back over the smokebox
    gb.box('black', 0.1, 0.12, 0.12, ax(BOIL.sb[0] + 0.2), sbTop + 0.02, 0);
    RMAT['digits' + key] = decalMat(256, 96, (g, w, h) => { g.fillStyle = '#e9e6dc'; g.font = 'bold 74px "Times New Roman", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; if (g.letterSpacing !== undefined) g.letterSpacing = '4px'; g.fillText(spec.num, w / 2, h / 2 + 4); });
    gb.add('digits' + key, new THREE.PlaneGeometry(0.6, 0.22), M(ax(BOIL.sb[0] - 0.14), yB - 0.6, 0, 0, Math.PI / 2, 0));
  }
  // classification lamps on brackets at the top corners of the smokebox front
  for (const z of [-0.78, 0.78]) { const y = yB + 0.78; gb.box('black', 0.2, 0.24, 0.2, ax(BOIL.sb[0] - 0.13), y, z); gb.box('black', 0.06, 0.06, 0.2, ax(BOIL.sb[0] - 0.02), y - 0.06, z * 0.9); gb.add('lensOff', new THREE.CircleGeometry(0.06, 12), M(ax(BOIL.sb[0] - 0.23) + 0.003, y, z, 0, Math.PI / 2, 0)); }

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
    cabEye: cab.eye, cab, headlightPos: new THREE.Vector3(ax(lensA), hlPos[1], 0) };
}

/* Paint finish for the steam engines: as delivered (graphite smokebox and firebox),
   excursion white trim (tire faces and running-board edges), plain black, or the holiday
   trim (white walls here; the wreaths, garland and snow are built with the train). */
function applySteamFinish(k) {
  if (!RMAT.graphite) return;
  const set = (m, hex) => { m.color.set(hex).convertSRGBToLinear(); m.userData.lin = true; };
  const white = 0xe9e6dc;
  set(RMAT.graphite, k === 'black' ? 0x19191a : 0x45474a); RMAT.graphite.roughness = k === 'black' ? 0.5 : 0.66;
  const wt = k === 'white' || k === 'polar';   // the holiday trim keeps the excursion white walls
  set(RMAT.rbEdge, wt ? white : 0x141516);
  set(RMAT.dWall, wt ? white : 0x141516);
  RMAT.dWall.metalness = RMAT.rbEdge.metalness = wt ? 0.05 : 0.25;
  RMAT.dWall.roughness = wt ? 0.62 : 0.5;
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
    for (let i = 0; i < 420; i++) { const x = r() * w, y = r() * h, rr = 3 + r() * 12, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, 2 * rr, 2 * rr); }
  }, { srgb: false });
  RMAT.snowDust = S(0xf2f5fa, 0, 0.85, { alphaMap: dust, alphaTest: 0.45, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  RMAT.snowDust.side = THREE.DoubleSide;
  // fir garland: deep green needles, a little lighter at the tips
  const fir = canvasTex(128, 64, (g, w, h) => { g.fillStyle = '#163a20'; g.fillRect(0, 0, w, h); const r = rng(24); for (let i = 0; i < 700; i++) { const x = r() * w, y = r() * h, a = r() * TAU, l = 3 + r() * 6; g.strokeStyle = r() < 0.5 ? '#2a5e32' : '#0f2c17'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); } }, { repeat: true });
  RMAT.garland = S(0x2e6b3a, 0, 0.88, { map: fir });
  RMAT.ribbon = S(0xb3141c, 0.05, 0.42);
  RMAT.berry = S(0xc8161e, 0.1, 0.3);
  RMAT.gold = S(0xd2a446, 0.9, 0.3);
  RMAT.holBody = S(TRIM.polar.body, 0.25, 0.42); RMAT.holBody.envMapIntensity = 0.9;
  // car windows that glow a little even by day, like a train with every lamp lit inside
  RMAT.holWin = RMAT.coachWin.clone(); RMAT.holWin.userData = { litAt: 0.15, litI: 1.3, minI: 0.42 };
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
  for (const s of [-1, 1]) gb.add('black', new THREE.ExtrudeGeometry(prof, { depth: 0.04, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, s * (hw - 0.02) - 0.02));
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
function textDecal(lines, w = 1024, h = 128, color = '#e9e3c9', font = 'serif', size = 80) {
  return decalMat(w, h, (g, W, H) => {
    if (font === 'serif') romanText(g, lines, W / 2, H / 2 + 6, size, color, 0.12);
    else { g.font = `bold ${size}px "Arial Narrow", Arial`; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(lines, W / 2, H / 2 + 4); }
  });
}
function coachModel(spec, num, observation, trim = '') {
  const root = new THREE.Group(); const gb = new GeoBin();
  const L = 24.7, ref = L / 2, tx = a => ref - a, hw = 1.52;
  const T = TRIM[trim], body = T ? 'holBody' : 'green', win = T ? 'holWin' : 'win', gold = T ? T.gold : '#d9c27a';
  // body
  gb.box(body, 23.4, 2.55, 2 * hw, 0, 2.45, 0);
  gb.box('dark', 23.6, 0.25, 2 * hw - 0.1, 0, 1.08, 0);
  // underbody gear: battery boxes, AC generator, truss
  gb.box('dark', 2.0, 0.6, 1.2, 3.5, 0.75, 0); gb.box('dark', 1.6, 0.5, 1.0, -3, 0.75, 0.3); gb.box('dark', 2.6, 0.45, 0.5, 0, 0.75, -0.6);
  for (const s of [-1, 1]) {   // truss rods: up to the underframe at each end, down over two queen posts
    gb.tube('dark', [[-6.6, 0.98, s * 1.1], [-3.0, 0.62, s * 1.1], [3.0, 0.62, s * 1.1], [6.6, 0.98, s * 1.1]], 0.03, 40, 6);
    for (const x of [-3.0, 3.0]) gb.box('dark', 0.08, 0.38, 0.08, x, 0.79, s * 1.1);
  }
  for (const x of [-8.85, 8.85]) gb.box('dark', 0.6, 0.1, 2.0, x, 0.98, 0);   // body bolsters on the trucks
  // windows (paired) and window posts
  const wy = 2.62;
  for (let i = 0; i < 13; i++) {
    const x = -9.5 + i * 1.58;
    for (const s of [-1, 1]) for (const dx of [-0.33, 0.33]) gb.box(win, 0.56, 0.78, 0.04, x + dx, wy, s * (hw + 0.005));
  }
  // letterboard
  const lk = 'lb' + (T ? trim : spec.short);
  RMAT[lk] = textDecal(T ? T.road : spec.road, 1024, 128, gold, 'serif', 72);
  for (const s of [-1, 1]) gb.add(lk, new THREE.PlaneGeometry(11, 0.42), M(0, 3.38, s * (hw + 0.005), 0, s > 0 ? 0 : Math.PI, 0));
  const nmat = textDecal(String(num), 256, 96, gold, 'serif', 64); const nk = 'cn' + num + trim; RMAT[nk] = nmat;
  for (const s of [-1, 1]) gb.add(nk, new THREE.PlaneGeometry(1.0, 0.36), M(-7.5, 1.65, s * (hw + 0.005), 0, s > 0 ? 0 : Math.PI, 0));
  // clerestory roof
  const rs = new THREE.Shape(); rs.moveTo(-hw - 0.06, 0); rs.quadraticCurveTo(-hw * 0.9, 0.42, -0.82, 0.5); rs.lineTo(-0.82, 0.88); rs.quadraticCurveTo(0, 1.02, 0.82, 0.88); rs.lineTo(0.82, 0.5); rs.quadraticCurveTo(hw * 0.9, 0.42, hw + 0.06, 0); rs.lineTo(-hw - 0.06, 0);
  const rL = observation ? 24.5 : 23.8, rg = new THREE.ExtrudeGeometry(rs, { depth: rL, bevelEnabled: false, curveSegments: 10 }); rg.rotateY(Math.PI / 2); rg.translate(11.9 - rL, 3.72, 0); gb.add('roof', rg);   // the observation roof overhangs the platform
  for (let i = 0; i < 12; i++) for (const s of [-1, 1]) gb.box(win, 0.5, 0.2, 0.02, -9.5 + i * 1.7, 4.42, s * 0.825);
  for (let i = 0; i < 5; i++) gb.cyl('roof', 0.12, 0.14, 0.22, 10, -8 + i * 4, 4.72, 0);
  // vestibules: doors, steps, diaphragms
  for (const e of [-1, 1]) {
    const xe = e * (L / 2 - 0.62);
    gb.box(body, 0.08, 2.5, 2 * hw, e * 11.72, 2.45, 0);
    for (const s of [-1, 1]) {
      gb.box(body, 0.85, 0.3, 0.05, e * 11.3, 1.2, s * (hw)); gb.box(win, 0.4, 0.7, 0.04, e * 11.2, 2.7, s * (hw + 0.005));
      if (T) addWreath(gb, 0.15, 0.035, M(e * 11.2, 2.74, s * (hw + 0.025), 0, s > 0 ? 0 : Math.PI, 0));   // a wreath on each vestibule door
      gb.box('dark', 0.5, 0.05, 0.35, e * 11.25, 0.75, s * (hw - 0.05)); gb.box('dark', 0.5, 0.05, 0.35, e * 11.25, 0.45, s * (hw - 0.05));
      for (const d of [-0.27, 0.27]) gb.box('dark', 0.04, 0.82, 0.35, e * 11.25 + d, 0.82, s * (hw - 0.05));   // step stringers up to the sill
    }
    if (!(observation && e < 0)) { gb.box('diaphragm', 0.58, 2.55, 1.52, e * 12.03, 2.45, 0); gb.box('dark', 0.06, 2.6, 1.6, e * (L / 2 - 0.02), 2.45, 0); }
  }
  if (observation) {
    // open rear platform with brass railing and drumhead
    gb.box('dark', 1.6, 0.08, 2.9, -11.8, 1.15, 0);
    for (const z of [-1.4, -0.7, 0, 0.7, 1.4]) gb.cyl('brass', 0.02, 0.02, 1.05, 6, -12.55, 1.7, z);
    gb.add('brass', new THREE.CylinderGeometry(0.03, 0.03, 2.9, 8).rotateX(Math.PI / 2).translate(-12.55, 2.2, 0));
    gb.cyl('roof', 0.12, 0.12, 0.3, 8, -12.3, 3.62, 0);
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
    gb.add(dk, new THREE.CircleGeometry(0.42, 28), M(-12.575, 1.85, 0, 0, -Math.PI / 2, 0));
    if (T) addWreath(gb, 0.5, 0.06, M(-12.56, 1.85, 0, 0, -Math.PI / 2, 0));   // the drumhead ringed with fir
    gb.add('brass', new THREE.TorusGeometry(0.43, 0.025, 6, 28).rotateY(Math.PI / 2).translate(-12.56, 1.85, 0));
  }
  if (T) {
    // gold lining under the windows and along the sill, garland swagged between the window pairs, snow on the roof
    for (const s of [-1, 1]) for (const y of [2.13, 1.32]) gb.box('gold', 21.8, 0.035, 0.012, 0, y, s * (hw + 0.006));
    const xs = []; for (let i = 0; i <= 13; i++) xs.push(-9.5 - 0.79 + i * 1.58);
    for (const s of [-1, 1]) addSwags(gb, xs, 3.13, 0.09, s * (hw + 0.035), 0.04);
    const yR = 3.72, Ls = rL - 0.5, x0 = 11.9 - rL + 0.25;
    gb.add('snow', snowCap(quadPts([-0.82, 0.88], [0, 1.02], [0.82, 0.88], 16).map(([z, y]) => [z, y + yR]), 0.045, Ls, 0.3).translate(x0, 0, 0));
    for (const s of [-1, 1]) {   // the lower roof, from the eaves' shoulder in to the clerestory wall
      const pts = quadPts([s * (hw + 0.06), 0], [s * hw * 0.9, 0.42], [s * 0.82, 0.5], 12, 0.5, 1).map(([z, y]) => [z, y + yR]);
      if (s > 0) pts.reverse();
      gb.add('snow', snowCap(pts, 0.04, Ls, 0.22).translate(x0, 0, 0));
    }
  }
  const couplers = carCouplers(gb, root, L, -0.55, 0.955, 1.08);
  root.add(gb.build(RMAT));
  root.traverse(o => { if (o.isMesh && !o.userData.cpl) { o.castShadow = true; o.receiveShadow = true; } });
  return { root, len: L, trucks: [{ a: 3.5, type: 'six', R: 0.457 }, { a: 21.2, type: 'six', R: 0.457 }], frame: [3.5, 21.2], weight: 82 * STON, kind: 'coach', axles: 6, area: 120, couplers };
}
function freightModel(type, num, r) {
  const root = new THREE.Group(); const gb = new GeoBin();
  let L, hw = 1.5, weight, trucks;
  // reporting marks, a little proud of the side at face distance zf; on a tank they wrap around the barrel (radius tr, centre ty)
  const marks = (txt, sub, mat, y, color, zf = hw + 0.005, tr = 0, ty = 0, w = 2.6, mx = L / 2 - 2.2) => {
    const k = 'fm_' + type + '_' + num; RMAT[k] = decalMat(512, 128, (g, w, h) => { g.fillStyle = color || '#ece9df'; g.font = 'bold 48px "Arial Narrow", Arial'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(txt, 12, 42); g.font = '28px "Arial Narrow", Arial'; g.fillText(sub, 12, 96); });
    for (const s of [-1, 1]) {
      const g = new THREE.PlaneGeometry(w, w / 4, 1, tr ? 8 : 1);
      if (tr) { const p = g.attributes.position, r = tr + 0.008, a0 = Math.asin((y - ty) / r); for (let i = 0; i < p.count; i++) { const a = a0 + p.getY(i) / r; p.setY(i, ty + r * Math.sin(a) - y); p.setZ(i, r * Math.cos(a)); } g.computeVertexNormals(); g.translate(0, 0, -zf); }
      gb.add(k, g, M(s > 0 ? -mx : mx, y, s * zf, 0, s > 0 ? 0 : Math.PI, 0));
    }
  };
  // end ladder: two stiles on standoffs and rungs, up the car end at half length he, to height top
  const ladder = (he, top, bot = 1.3) => { for (const e of [-1, 1]) { const x = e * (he + 0.07); for (const z of [0.95, 1.4]) { gb.box('dark', 0.03, top - bot, 0.04, x, (top + bot) / 2, z); for (const y of [bot + 0.15, top - 0.15]) gb.box('dark', 0.09, 0.04, 0.04, e * (he + 0.035), y, z); } for (let y = bot + 0.2; y < top - 0.1; y += 0.42) gb.box('dark', 0.03, 0.03, 0.45, x, y, 1.175); } };
  if (type === 'box') {
    L = 13.0; weight = (r() < 0.6 ? 62 : 25) * STON;
    gb.box('oxide', 12.2, 2.75, 2 * hw, 0, 2.55, 0);
    for (let x = -5.6; x <= 5.6; x += 0.8) for (const s of [-1, 1]) gb.box('oxide2', 0.06, 2.75, 0.016, x, 2.55, s * (hw + 0.008));
    for (const s of [-1, 1]) { gb.box('oxide2', 1.8, 2.5, 0.06, 0.4, 2.45, s * (hw + 0.04)); gb.box('dark', 2.2, 0.08, 0.08, 0.4, 3.75, s * (hw + 0.06)); }
    gb.box('oxide2', 12.3, 0.1, 2 * hw + 0.08, 0, 3.97, 0);
    gb.box('wood', 12.2, 0.05, 0.52, 0, 4.044, 0);   // running board on the roof
    ladder(6.1, 3.92);
    gb.add('dark', new THREE.TorusGeometry(0.22, 0.02, 4, 14).translate(-6.15, 3.6, 0));
    marks(ROAD_SHORT + ' ' + num, 'CAPY 100000  LD LMT 110700', 'oxide', 3.1, null, hw + 0.019);   // painted across the posts
  } else if (type === 'hopper') {
    L = 11.2; weight = 92 * STON;
    gb.box('black', 10.4, 2.3, 2 * hw, 0, 2.45, 0);   // sides come down to the side sill
    for (let x = -4.8; x <= 4.8; x += 1.2) for (const s of [-1, 1]) gb.box('black', 0.12, 2.35, 0.08, x, 2.45, s * (hw + 0.03));
    for (const x of [-1.25, 1.25]) gb.add('black', new THREE.ConeGeometry(1.27, 1.1, 4).rotateY(Math.PI / 4).rotateX(Math.PI).translate(x, 1.1, 0));   // bays, clear of the wheels
    ladder(5.2, 3.6);
    const g = new THREE.PlaneGeometry(10.1, 2.8, 20, 6); g.rotateX(-Math.PI / 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, 3.5 + 0.35 * Math.max(0, (1 - (z / 1.4) ** 2)) * (0.7 + 0.3 * Math.cos(x * 1.2))); } g.computeVertexNormals(); gb.add('coal', g);
    marks(ROAD_SHORT + ' ' + num, 'CAPY 140000', 'black', 2.9, null, hw + 0.005, 0, 0, 1.0, 3.0);   // in the panel between two stakes
  } else if (type === 'tank') {
    L = 12.4; weight = 70 * STON; hw = 1.45;
    gb.add('tank', new THREE.CylinderGeometry(1.4, 1.4, 11.4, 28).rotateZ(Math.PI / 2).translate(0, 2.65, 0));
    for (const s of [-1, 1]) gb.add('tank', new THREE.SphereGeometry(1.4, 20, 10, 0, TAU, 0, Math.PI / 2).scale(1, 0.25, 1).rotateZ(-s * Math.PI / 2).translate(s * 5.7, 2.65, 0));
    gb.cyl('tank', 0.65, 0.65, 0.6, 18, 0, 4.2, 0); gb.cyl('tank', 0.7, 0.7, 0.08, 18, 0, 4.52, 0);
    gb.box('dark', 11, 0.2, 2.9, 0, 1.3, 0);
    for (const s of [-1, 1]) gb.box('wood', 11, 0.05, 0.4, 0, 1.424, s * 1.45);   // running boards on the platform
    for (const x of [-4, 0, 4]) gb.add('dark', new THREE.TorusGeometry(1.42, 0.03, 4, 28).rotateY(Math.PI / 2).translate(x, 2.65, 0));
    marks('UTLX ' + num, 'NON-ACCIDENT  CAPY 10000 GAL', 'tank', 2.15, null, 1.4, 1.4, 2.65);
  } else if (type === 'gon') {
    L = 14.6; weight = 88 * STON;
    gb.box('oxide2', 13.8, 1.3, 2 * hw, 0, 1.95, 0);
    for (let x = -6.4; x <= 6.4; x += 0.9) for (const s of [-1, 1]) gb.box('oxide2', 0.1, 1.32, 0.08, x, 1.95, s * (hw + 0.03));
    const g = new THREE.PlaneGeometry(13.4, 2.8, 26, 6); g.rotateX(-Math.PI / 2); const p = g.attributes.position; const rr = rng(num); for (let i = 0; i < p.count; i++) { const z = p.getZ(i); p.setY(i, 2.45 + 0.35 * Math.max(0, 1 - (z / 1.4) ** 2) + (rr() - 0.5) * 0.12); } g.computeVertexNormals(); gb.add('stoneLoad', g);
    marks(ROAD_SHORT + ' ' + num, 'CAPY 140000', 'oxide2', 1.95);
    ladder(6.9, 2.6);
  } else if (type === 'caboose') {
    L = 11.0; weight = 22 * STON;
    gb.box('caboose', 8.4, 2.5, 2 * hw - 0.1, 0, 2.45, 0);
    gb.box('caboose', 2.6, 1.05, 2.4, -0.6, 4.25, 0);
    gb.box('roof', 8.7, 0.08, 2 * hw + 0.1, 0, 3.74, 0); gb.box('roof', 2.8, 0.08, 2.6, -0.6, 4.82, 0);
    for (const s of [-1, 1]) { for (const x of [-2.8, 1.2, 2.8]) gb.box('win', 0.6, 0.7, 0.04, x, 2.7, s * (hw - 0.04)); for (const x of [-1.3, 0.1]) gb.box('win', 0.55, 0.5, 0.04, x, 4.35, s * 1.21); }
    for (const e of [-1, 1]) { gb.box('dark', 1.2, 0.08, 2.8, e * 4.9, 1.25, 0); for (const z of [-1.3, 1.3]) gb.cyl('dark', 0.02, 0.02, 1.0, 6, e * 5.45, 1.75, z); gb.box('dark', 0.04, 0.04, 2.6, e * 5.45, 2.25, 0); gb.box('win', 0.04, 0.9, 0.55, e * 4.21, 2.6, 0); }
    gb.cyl('dark', 0.08, 0.1, 0.5, 8, 1.8, 4.0, 0.6);
    // marker lamps
    for (const z of [-1.2, 1.2]) { gb.box('dark', 0.2, 0.3, 0.2, -4.25, 3.25, z); }   // marker lamps on the rear end
    marks(ROAD_SHORT + ' ' + num, '', 'caboose', 2.0, null, hw - 0.045);
    root.userData.markers = [new THREE.Vector3(-4.353, 3.25, -1.2), new THREE.Vector3(-4.353, 3.25, 1.2)];
  }
  // underframe common
  gb.box('dark', L - 1.4, 0.35, 2.6, 0, 1.15, 0);
  const ta = type === 'caboose' ? 2.4 : 1.95;
  for (const e of [-1, 1]) { gb.box('dark', 0.3, 0.4, 2.9, e * (L / 2 - 0.66), 1.15, 0); gb.box('dark', 0.5, 0.2, 2.4, e * (L / 2 - ta), 0.9, 0); }
  gb.add('dark', new THREE.CylinderGeometry(0.17, 0.17, 0.5, 10).rotateZ(Math.PI / 2).translate(1.6, 0.9, 0.5));
  const couplers = carCouplers(gb, root, L, -0.51, 0.95, 1.12);
  root.add(gb.build(RMAT));
  root.traverse(o => { if (o.isMesh && !o.userData.cpl) { o.castShadow = true; o.receiveShadow = true; } });
  trucks = [{ a: ta, type: 'four', R: 0.419 }, { a: L - ta, type: 'four', R: 0.419 }];
  return { root, len: L, trucks, frame: [ta, L - ta], weight, kind: type, axles: 4, area: 105, couplers };
}
/* truck frame geometries for instancing */
function truckGeos() {
  const six = new GeoBin();
  for (const s of [-1, 1]) {
    six.box('dark', 4.3, 0.32, 0.2, 0, 0.62, s * 1.0);
    for (const x of [-1.676, 0, 1.676]) six.box('dark', 0.36, 0.42, 0.28, x, 0.46, s * 1.0);
    six.box('dark', 3.6, 0.1, 0.12, 0, 0.88, s * 0.95);
    for (const x of [-0.85, 0.85]) for (let k = 0; k < 4; k++) six.cyl('dark', 0.09, 0.09, 0.3, 8, x, 0.6, s * (0.9 - k * 0.0));
  }
  six.box('dark', 0.5, 0.25, 2.1, 0, 0.88, 0);
  const four = new GeoBin();
  for (const s of [-1, 1]) {
    four.box('dark', 2.6, 0.26, 0.18, 0, 0.58, s * 0.98);
    four.box('dark', 1.0, 0.2, 0.2, 0, 0.42, s * 0.98);
    for (const x of [-0.865, 0.865]) four.box('dark', 0.3, 0.36, 0.26, x, 0.42, s * 0.98);
    for (let k = 0; k < 3; k++) four.cyl('dark', 0.075, 0.075, 0.26, 8, -0.15 + k * 0.15, 0.62, s * 0.98);
  }
  four.box('dark', 0.4, 0.25, 2.0, 0, 0.7, 0);
  // the Berkshire tender's six-wheel trucks: 60 in axle spacing, one-piece side frames with a pedestal over
  // each journal, spring nests either side of the bolster, and the bolster carrying the centre plate
  const buck = new GeoBin(), sp = TD.sp;
  for (const s of [-1, 1]) {
    const z = s * 1.0, fr = new THREE.Shape(), top = 0.8, bot = 0.5;
    fr.moveTo(-sp - 0.32, 0.56); fr.lineTo(-sp - 0.32, top); fr.lineTo(sp + 0.32, top); fr.lineTo(sp + 0.32, 0.56); fr.lineTo(sp - 0.25, 0.56);
    fr.lineTo(sp - 0.42, bot); fr.lineTo(0.42, bot); fr.lineTo(0.25, 0.56); fr.lineTo(-0.25, 0.56); fr.lineTo(-0.42, bot); fr.lineTo(-sp + 0.42, bot); fr.lineTo(-sp + 0.25, 0.56); fr.closePath();
    buck.add('dark', new THREE.ExtrudeGeometry(fr, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1 }).translate(0, 0, z - 0.08));
    for (const x of [-sp, 0, sp]) buck.box('dark', 0.36, 0.34, 0.28, x, 0.457, z);
    for (const x of [-sp / 2, sp / 2]) { for (let k = 0; k < 3; k++) buck.cyl('dark', 0.07, 0.07, 0.26, 8, x, 0.66, z + (k - 1) * 0.07); buck.box('dark', 0.36, 0.05, 0.3, x, 0.79, z); }
  }
  for (const x of [-sp / 2, sp / 2]) buck.box('dark', 0.34, 0.24, 2.18, x, 0.9, 0);   // bolsters
  buck.box('dark', sp + 0.34, 0.12, 0.5, 0, 0.94, 0);                                  // span bolster with the centre plate
  return { six: mergeGeos(six.bins.dark), four: mergeGeos(four.bins.dark), buck: mergeGeos(buck.bins.dark) };
}

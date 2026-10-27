/* ============================================================================
   Rolling stock models.
   Lima Super Power 2-8-4 (NKP S-2 765 / PM N-1 1225) built to published
   dimensions: 69 in drivers, 36 in lead truck, 36/43 in trailing truck,
   25 x 34 in cylinders, 89 in boiler, 100 ft 8-3/4 in over couplers,
   15 ft 8 in tall. Tender: 22,000 gal / 22 t on two six-wheel trucks.
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
  RMAT.glow = new THREE.MeshBasicMaterial({ color: 0xff7a26 });
  RMAT.green = S(0x2a3a2a, 0.3, 0.5);
  RMAT.roof = S(0x1d1e1f, 0.2, 0.8);
  RMAT.coachWin = new THREE.MeshStandardMaterial({ color: 0x1a2024, metalness: 0.3, roughness: 0.15, emissive: 0xffc77a, emissiveIntensity: 0 });
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
  for (const k of ['black', 'blackMatte', 'graphite', 'dark', 'tire', 'rod', 'brass', 'green', 'roof', 'oxide', 'oxide2', 'caboose', 'tank', 'steel', 'backhead', 'cabInt', 'wood']) RMAT[k].side = THREE.DoubleSide;
}
function decalMat(w, h, draw) { return new THREE.MeshStandardMaterial({ map: canvasTex(w, h, draw), transparent: true, alphaTest: 0.35, metalness: 0.2, roughness: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }); }
function romanText(g, txt, x, y, size, color = '#efede4', spacing = 0.06) {
  g.font = `600 ${size}px "Times New Roman", Georgia, serif`; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (g.letterSpacing !== undefined) g.letterSpacing = (size * spacing) + 'px';
  g.fillText(txt, x, y);
}

/* -------- wheel sets -------- */
function driverWheel(R, main, rightCrankAngle) {
  // geometry in wheel-local: xy = wheel face plane, +z outward (toward the rod side)
  const parts = { black: [], tire: [], rod: [] };
  const tire = new THREE.LatheGeometry([new THREE.Vector2(R - 0.075, -0.07), new THREE.Vector2(R, -0.07), new THREE.Vector2(R, 0.065), new THREE.Vector2(R + 0.032, 0.07), new THREE.Vector2(R + 0.03, 0.09), new THREE.Vector2(R - 0.075, 0.09)].map(v => new THREE.Vector2(v.x, -v.y)), 40);
  tire.rotateX(Math.PI / 2); parts.tire.push(tire);
  // Boxpok-style centre: disc with oval lightening holes
  const shp = new THREE.Shape(); shp.absarc(0, 0, R - 0.07, 0, TAU, false);
  const nh = 6;
  for (let i = 0; i < nh; i++) {
    const a = (i + 0.5) / nh * TAU; if (Math.abs(((a - Math.PI + TAU) % TAU) - Math.PI) < 0.01) {}
    const h = new THREE.Path(); const cx = Math.cos(a) * R * 0.53, cy = Math.sin(a) * R * 0.53;
    const pts = []; for (let k = 0; k <= 16; k++) { const t = k / 16 * TAU; const ex = Math.cos(t) * R * 0.17, ey = Math.sin(t) * R * 0.1; pts.push(new THREE.Vector2(cx + ex * Math.cos(a) - ey * Math.sin(a), cy + ex * Math.sin(a) + ey * Math.cos(a))); }
    h.setFromPoints(pts.reverse()); shp.holes.push(h);
  }
  const disc = new THREE.ExtrudeGeometry(shp, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1, curveSegments: 28 });
  disc.translate(0, 0, -0.02); parts.black.push(disc);
  // hub & axle boss
  parts.black.push(new THREE.CylinderGeometry(0.22, 0.25, 0.16, 18).rotateX(Math.PI / 2).translate(0, 0, 0.06));
  // counterweight: crescent opposite the crank pin
  const cw = new THREE.Shape(); const sp = main ? 1.15 : 0.85, r0 = R * 0.28, r1 = R - 0.09;
  cw.absarc(0, 0, r1, Math.PI - sp, Math.PI + sp, false); cw.absarc(0, 0, r0, Math.PI + sp * 0.7, Math.PI - sp * 0.7, true);
  const cwg = new THREE.ExtrudeGeometry(cw, { depth: 0.09, bevelEnabled: false, curveSegments: 18 }); cwg.translate(0, 0, 0.0);
  parts.black.push(cwg);
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
function driverAxle(R, main) {
  const right = driverWheel(R, main, 0), left = driverWheel(R, main, Math.PI / 2);
  const res = {};
  for (const k of ['black', 'tire', 'rod']) {
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

/* =================== THE BERKSHIRE =================== */
const LOCO_SPEC = {
  '765': { road: 'NICKEL PLATE ROAD', num: '765', short: 'NKP', cls: 'S-2', built: 'Lima, Sept 1944', weight: 440800, adhesive: 264300, te: 64135, fw: 'Worthington', whistle: [233, 277, 330, 370, 415, 466].map(f => f * 0.82), bellOnFront: false },
  '1225': { road: 'PERE MARQUETTE', num: '1225', short: 'PM', cls: 'N-1', built: 'Lima, Oct 1941', weight: 442500, adhesive: 264000, te: 69350, fw: 'Elesco', whistle: [196, 247, 294].map(f => f * 1.0), bellOnFront: true },
};
const LG = {
  ref: 8.7325, rD: 0.8763, rL: 0.457, rT1: 0.457, rT2: 0.546, cr: 0.432,
  aD: [5.95, 7.805, 9.66, 11.515], aL: 2.95, aT: [14.17, 15.80], len: 17.35,
  yC: 0.95, zC: 1.25, Lm: 3.95, e: 0.37, T: [1.40, 1.62], rho: 0.48, Le: 2.34, yR: 1.56, Lr: 1.95, yV: 1.70, a: 0.14, b: 0.94, Lu: 0.23,
  yB: 3.05,
};
const ax = a => LG.ref - a;

function buildBerkshire(key) {
  const spec = LOCO_SPEC[key];
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const gb = new GeoBin();
  const yB = LG.yB;
  /* ---- frame & running gear supports ---- */
  for (const z of [-0.56, 0.56]) gb.box('dark', 12.4, 0.5, 0.14, ax(8.0), 1.18, z);
  gb.box('dark', 1.4, 0.55, 1.2, ax(1.4), 1.15, 0);
  // pilot beam & cast pilot
  gb.box('black', 0.28, 0.5, 3.05, ax(0.62), 1.22, 0);
  for (let i = -5; i <= 5; i++) gb.add('dark', new THREE.BoxGeometry(0.06, 1.25, 0.1), M(ax(0.36), 0.62, i * 0.26, 0, 0, -0.5));
  gb.box('dark', 0.12, 0.12, 2.95, ax(0.06), 0.14, 0);
  for (const z of [-1.38, 1.38]) gb.box('dark', 0.9, 0.06, 0.45, ax(0.38), 0.95, z); // footboard ends
  // coupler (drop), air hoses, cut lever
  gb.box('dark', 0.55, 0.22, 0.26, ax(0.22), 0.875, 0); gb.box('dark', 0.16, 0.34, 0.36, ax(0.02), 0.875, 0);
  gb.add('dark', new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6), M(ax(0.32), 0.62, 0.42, 0.5, 0, 0.3));
  gb.add('dark', new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6), M(ax(0.32), 0.62, -0.42, -0.5, 0, 0.3));
  gb.add('rod', new THREE.CylinderGeometry(0.015, 0.015, 1.6, 6), M(ax(0.48), 1.5, 0, Math.PI / 2, 0, 0));
  /* ---- cylinders & saddle ---- */
  for (const s of [-1, 1]) {
    const z = s * LG.zC;
    gb.cylX('black', 0.42, 0.42, 1.3, 24, ax(3.75), LG.yC, z);
    for (const a of [3.08, 4.42]) gb.cylX('graphite', 0.44, 0.44, 0.07, 24, ax(a), LG.yC, z);
    gb.cylX('black', 0.31, 0.31, 1.45, 18, ax(3.72), LG.yV, s * 1.12);
    gb.cylX('graphite', 0.33, 0.33, 0.06, 18, ax(3.0), LG.yV, s * 1.12); gb.cylX('graphite', 0.33, 0.33, 0.06, 18, ax(4.44), LG.yV, s * 1.12);
    gb.box('black', 1.2, 0.5, 0.5, ax(3.72), 1.32, s * 1.08);
    // crosshead guides (two bars) and guide yoke
    for (const dy of [-0.2, 0.2]) gb.box('rod', 2.0, 0.06, 0.14, ax(5.4), LG.yC + dy, z);
    gb.box('black', 0.14, 1.05, 0.5, ax(6.45), 1.45, s * 1.07);
    // link support bracket
    gb.box('black', 0.5, 0.14, 0.12, ax(7.33), LG.T[1] + 0.3, s * 1.18);
    gb.box('black', 0.12, 0.7, 0.12, ax(7.33), LG.T[1] - 0.05, s * 1.12);
    // drain cocks
    for (const a of [3.2, 4.3]) gb.add('dark', new THREE.CylinderGeometry(0.025, 0.025, 0.35, 6), M(ax(a), LG.yC - 0.55, z));
    // valve stem guide
    gb.box('black', 0.55, 0.18, 0.16, ax(LG.ref - 3.55), LG.yV, s * 1.16);
  }
  gb.box('black', 1.25, 0.9, 1.9, ax(3.75), 1.75, 0); // saddle
  /* ---- boiler ---- */
  const lathe = (pts, a0) => { const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[1], p[0])), 40); g.rotateZ(-Math.PI / 2); g.translate(ax(a0), yB, 0); return g; };
  gb.add('graphite', new THREE.CylinderGeometry(1.04, 1.04, 2.95, 40, 1, true).rotateZ(Math.PI / 2).translate(ax(3.02), yB, 0));
  // smokebox front with dished door
  gb.add('graphite', new THREE.CylinderGeometry(1.06, 1.06, 0.1, 40).rotateZ(Math.PI / 2).translate(ax(1.55), yB, 0));
  gb.add('graphite', lathe([[0, 0.82], [0.06, 0.82], [0.14, 0.6], [0.17, 0.0]], 1.5));
  for (const dy of [0.35, -0.35]) gb.box('rod', 0.04, 0.05, 0.5, ax(1.38), yB + dy, 0.45);
  gb.add('rod', new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8).rotateZ(Math.PI / 2).translate(ax(1.22), yB, 0));
  // boiler courses: front ring, conical course, rear courses
  gb.add('black', new THREE.CylinderGeometry(1.0, 1.0, 2.9, 40, 1, true).rotateZ(Math.PI / 2).translate(ax(5.95), yB, 0));
  gb.add('black', new THREE.CylinderGeometry(1.0, 1.13, 1.6, 40, 1, true).rotateZ(Math.PI / 2).translate(ax(8.2), yB + 0.06, 0));
  gb.add('black', new THREE.CylinderGeometry(1.13, 1.13, 3.0, 40, 1, true).rotateZ(Math.PI / 2).translate(ax(10.5), yB + 0.13, 0));
  for (const a of [4.6, 6.0, 7.4, 8.9, 10.0, 11.0, 11.95]) { const r = a < 7.4 ? 1.012 : (a < 9 ? lerp(1.0, 1.13, (a - 7.4) / 1.6) + 0.012 : 1.142); gb.add('dark', new THREE.CylinderGeometry(r, r, 0.07, 40, 1, true).rotateZ(Math.PI / 2).translate(ax(a), yB + (a < 7.4 ? 0 : a < 9 ? 0.06 : 0.13), 0)); }
  // firebox: round top over flat sides, wider at the base
  {
    const s = new THREE.Shape(); const top = yB + 0.13, rr = 1.22, base = 1.72, wb = 1.35;
    s.moveTo(-wb, base); s.lineTo(-rr, top - 0.25); s.absarc(0, top - 0.25, rr, Math.PI, 0, true); s.lineTo(wb, base); s.lineTo(-wb, base);
    const g = new THREE.ExtrudeGeometry(s, { depth: 3.05, bevelEnabled: false, curveSegments: 24 });
    g.rotateY(Math.PI / 2); g.translate(ax(14.9), 0, 0);
    gb.add('graphite', g);
    gb.box('dark', 1.9, 0.6, 2.3, ax(13.55), 1.35, 0); // ashpan
  }
  /* ---- stack, domes, appliances ---- */
  gb.cyl('black', 0.37, 0.43, 0.82, 24, ax(2.55), 4.36, 0);
  gb.add('black', new THREE.TorusGeometry(0.4, 0.06, 8, 24).rotateX(Math.PI / 2).translate(ax(2.55), 4.76, 0));
  gb.cyl('black', 0.55, 0.62, 0.18, 24, ax(2.55), 4.02, 0);
  gb.add('blackMatte', new THREE.CylinderGeometry(0.33, 0.33, 0.02, 20).translate(ax(2.55), 4.77, 0));
  // feedwater heater drum on smokebox front (Worthington) / Elesco bundle
  if (spec.fw === 'Worthington') {
    gb.cylZ('black', 0.32, 1.7, 24, ax(1.98), 3.96, 0);
    for (const z of [-0.85, 0.85]) gb.cylZ('graphite', 0.33, 0.06, 24, ax(1.98), 3.96, z);
    gb.add('black', new THREE.CylinderGeometry(0.05, 0.05, 1.6, 8).rotateZ(Math.PI / 2).translate(ax(3.0), 4.05, 0.55));
  } else {
    gb.cylZ('black', 0.28, 2.0, 24, ax(1.85), 4.0, 0);
    for (let i = -4; i <= 4; i++) gb.cylZ('dark', 0.29, 0.04, 20, ax(1.85), 4.0, i * 0.22);
  }
  // sand dome
  gb.add('black', new THREE.CylinderGeometry(0.56, 0.68, 0.62, 28).translate(ax(6.3), yB + 1.08, 0));
  gb.add('black', new THREE.SphereGeometry(0.56, 24, 10, 0, TAU, 0, Math.PI / 2).scale(1, 0.38, 1).translate(ax(6.3), yB + 1.39, 0));
  // steam dome
  gb.add('black', new THREE.CylinderGeometry(0.5, 0.6, 0.45, 28).translate(ax(9.2), yB + 1.27, 0));
  gb.add('black', new THREE.SphereGeometry(0.5, 24, 10, 0, TAU, 0, Math.PI / 2).scale(1, 0.4, 1).translate(ax(9.2), yB + 1.49, 0));
  // safety valves
  for (const z of [-0.22, 0, 0.22]) { gb.cyl('brass', 0.07, 0.09, 0.32, 12, ax(12.05), yB + 1.36, z); gb.cyl('brass', 0.1, 0.1, 0.05, 12, ax(12.05), yB + 1.53, z); }
  // whistle (multi-chime) with lever
  gb.cyl('brass', 0.09, 0.09, 0.5, 16, ax(10.1), yB + 1.36, 0.42); gb.cyl('brass', 0.12, 0.12, 0.06, 16, ax(10.1), yB + 1.62, 0.42); gb.cyl('brass', 0.05, 0.05, 0.25, 8, ax(10.1), yB + 1.05, 0.42);
  // turbo-generator
  gb.cylX('black', 0.18, 0.18, 0.62, 16, ax(3.9), yB + 1.08, -0.42); gb.cyl('dark', 0.05, 0.05, 0.3, 8, ax(3.7), yB + 1.3, -0.42);
  // bell
  const bellA = spec.bellOnFront ? 1.35 : 7.6;
  if (spec.bellOnFront) {
    gb.add('brass', new THREE.LatheGeometry([[0, 0.24], [0.08, 0.24], [0.15, 0.21], [0.2, 0.12], [0.23, 0.0]].map(p => new THREE.Vector2(p[0], p[1])), 20).translate(ax(1.32), 2.42, 0));
    gb.box('black', 0.1, 0.4, 0.5, ax(1.4), 2.7, 0);
  } else {
    gb.add('brass', new THREE.LatheGeometry([[0, 0.3], [0.09, 0.3], [0.17, 0.26], [0.23, 0.14], [0.27, 0.0]].map(p => new THREE.Vector2(p[0], p[1])), 20).translate(ax(bellA), yB + 1.14, 0));
    for (const z of [-0.33, 0.33]) gb.box('black', 0.08, 0.6, 0.06, ax(bellA), yB + 1.32, z);
    gb.box('black', 0.1, 0.06, 0.72, ax(bellA), yB + 1.62, 0);
  }
  // headlight with number boards
  const hlY = spec.bellOnFront ? 3.68 : 3.6;
  gb.box('black', 0.55, 0.62, 0.62, ax(1.25), hlY, 0);
  gb.add('black', new THREE.CylinderGeometry(0.29, 0.29, 0.12, 24).rotateZ(Math.PI / 2).translate(ax(0.98), hlY, 0));
  gb.box('black', 0.32, 0.06, 0.66, ax(0.95), hlY + 0.36, 0);
  const numMat = decalMat(128, 64, (g, w, h) => { g.fillStyle = '#f2efe4'; g.fillRect(0, 0, w, h); g.fillStyle = '#121212'; g.font = 'bold 44px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(spec.num, w / 2, h / 2 + 2); });
  RMAT['num' + key] = numMat;
  for (const z of [-0.45, 0.45]) { gb.box('black', 0.5, 0.3, 0.12, ax(1.3), hlY, z); gb.add('num' + key, new THREE.PlaneGeometry(0.42, 0.22), M(ax(1.04), hlY, z, 0, Math.PI / 2, 0)); }
  // number plate on smokebox door
  const plate = decalMat(128, 128, (g, w, h) => { g.fillStyle = '#121212'; g.beginPath(); g.arc(64, 64, 62, 0, TAU); g.fill(); g.strokeStyle = '#d9d5c7'; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 55, 0, TAU); g.stroke(); g.fillStyle = '#e8e4d6'; g.font = 'bold 40px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(spec.num, 64, 66); });
  RMAT['plate' + key] = plate;
  gb.add('plate' + key, new THREE.CircleGeometry(0.3, 28), M(ax(1.33), yB - 0.45, 0, 0, Math.PI / 2, 0));
  // classification lamps
  for (const z of [-0.85, 0.85]) { gb.box('black', 0.22, 0.26, 0.2, ax(1.62), yB + 0.75, z); gb.add('lensOff', new THREE.CircleGeometry(0.06, 10), M(ax(1.5), yB + 0.75, z, 0, Math.PI / 2, 0)); }
  // outside steam pipes (smokebox to valve chests)
  for (const s of [-1, 1]) gb.tube('black', [[ax(3.3), yB - 0.2, s * 0.95], [ax(3.4), yB - 0.7, s * 1.12], [ax(3.6), 2.25, s * 1.17], [ax(3.72), 1.98, s * 1.13]], 0.16, 20, 12);
  /* ---- running boards, walkways, steps ---- */
  for (const s of [-1, 1]) {
    gb.box('black', 12.6, 0.05, 0.58, ax(7.95), 2.12, s * 1.34);
    gb.box('black', 12.6, 0.16, 0.04, ax(7.95), 2.05, s * 1.62);
    for (let a = 2.0; a < 14; a += 1.6) gb.box('dark', 0.06, 0.4, 0.06, ax(a), 1.9, s * 1.2);
    // front steps from pilot to running board
    for (const y of [0.55, 1.0, 1.5]) gb.box('dark', 0.36, 0.04, 0.32, ax(1.05), y, s * 1.42);
    gb.box('dark', 0.05, 1.7, 0.05, ax(0.88), 1.2, s * 1.58); gb.box('dark', 0.05, 1.7, 0.05, ax(1.22), 1.2, s * 1.58);
    // handrail along boiler
    gb.add('rod', new THREE.CylinderGeometry(0.018, 0.018, 12.0, 6).rotateZ(Math.PI / 2).translate(ax(7.6), yB + 0.6, s * 1.13));
    for (let a = 2.2; a < 13.5; a += 1.5) gb.add('rod', new THREE.CylinderGeometry(0.014, 0.014, 0.14, 5).rotateX(Math.PI / 2).translate(ax(a), yB + 0.6, s * 1.06));
    // air reservoirs under running boards
    gb.cylX('black', 0.27, 0.27, 3.4, 18, ax(10.6), 1.82, s * 1.3);
    for (const a of [9.0, 12.2]) gb.cylX('dark', 0.28, 0.28, 0.06, 18, ax(a), 1.82, s * 1.3);
    // sand pipes from dome to each driver
    for (let i = 0; i < 4; i++) {
      const xd = ax(LG.aD[i]);
      gb.tube('dark', [[ax(6.3), yB + 0.95, s * 0.6], [ax(6.3) - (i - 1) * 0.35, yB + 0.3, s * 1.04], [xd + 1.0, 2.0, s * 1.08], [xd + 0.95, 0.45, s * 0.82], [xd + 0.86, 0.14, s * 0.75]], 0.022, 16, 5);
    }
    // driver brake shoes & hangers
    for (let i = 0; i < 4; i++) { const xd = ax(LG.aD[i]); gb.box('dark', 0.14, 0.42, 0.18, xd + 0.92, 0.62, s * 0.75); gb.box('dark', 0.05, 0.6, 0.05, xd + 0.98, 1.05, s * 0.62); }
    // springs & equalizers between drivers
    for (let i = 0; i < 4; i++) { const xd = ax(LG.aD[i]); for (let k = 0; k < 5; k++) gb.box('dark', 0.9 - k * 0.12, 0.035, 0.14, xd, 1.38 + k * 0.035, s * 0.6); gb.box('dark', 0.3, 0.34, 0.3, xd, 1.0, s * 0.56); }
    // cab steps
    for (const y of [0.85, 1.35, 1.8]) gb.box('dark', 0.5, 0.04, 0.3, ax(14.55), y, s * 1.44);
    gb.box('dark', 0.05, 1.5, 0.05, ax(14.3), 1.45, s * 1.58); gb.box('dark', 0.05, 1.5, 0.05, ax(14.8), 1.45, s * 1.58);
  }
  // air compressors (left side, on smokebox), lubricators (right running board), power reverse
  for (const a of [3.25, 3.95]) { gb.cyl('black', 0.2, 0.2, 0.75, 16, ax(a), 2.75, -1.33); gb.cyl('black', 0.24, 0.24, 0.55, 16, ax(a), 2.2 + 0.05, -1.33); gb.cyl('graphite', 0.22, 0.22, 0.06, 16, ax(a), 3.12, -1.33); }
  gb.box('black', 1.1, 0.06, 0.6, ax(3.6), 3.25, -1.3);
  gb.box('black', 0.6, 0.4, 0.35, ax(5.4), 2.35, 1.38); gb.box('black', 0.4, 0.35, 0.3, ax(6.2), 2.32, 1.38);
  gb.cylX('black', 0.15, 0.15, 0.9, 12, ax(12.5), 2.35, 1.36);
  // injector & feed pipes under cab, right side
  gb.cylX('brass', 0.1, 0.1, 0.4, 10, ax(13.9), 1.75, 1.42);
  gb.tube('dark', [[ax(13.9), 1.75, 1.42], [ax(12.0), 2.0, 1.2], [ax(9.0), 2.4, 1.05], [ax(5.5), 2.6, 0.96]], 0.05, 20, 6);
  gb.tube('dark', [[ax(13.0), 2.2, -1.25], [ax(9.5), 2.45, -1.07], [ax(4.2), 2.7, -0.98]], 0.045, 18, 6);
  /* ---- cab ---- */
  {
    const x0 = ax(14.22), x1 = ax(17.0), fl = 2.06, roofY = 4.55, hw = 1.58;
    const L = x0 - x1;
    // side walls with window openings (Shape with holes)
    for (const s of [-1, 1]) {
      const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(L, 0); sh.lineTo(L, roofY - fl - 0.05); sh.lineTo(0, roofY - fl - 0.05); sh.lineTo(0, 0);
      const w1 = new THREE.Path(); w1.moveTo(L - 0.25, 1.25); w1.lineTo(L - 1.15, 1.25); w1.lineTo(L - 1.15, 2.15); w1.lineTo(L - 0.25, 2.15); w1.lineTo(L - 0.25, 1.25);
      const w2 = new THREE.Path(); w2.moveTo(L - 1.35, 1.25); w2.lineTo(L - 2.25, 1.25); w2.lineTo(L - 2.25, 2.15); w2.lineTo(L - 1.35, 2.15); w2.lineTo(L - 1.35, 1.25);
      sh.holes.push(w1, w2);
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false });
      g.translate(0, 0, -0.025); g.translate(x1, fl, s * hw);
      gb.add('black', g);
      gb.box('glass', 0.9, 0.9, 0.012, x1 + L - 0.7, fl + 1.7, s * (hw - 0.02));
      gb.box('black', 0.06, 0.95, 0.07, x1 + L - 1.25, fl + 1.7, s * hw);
      // arm rest & sun visor
      gb.box('black', 2.2, 0.05, 0.18, x1 + L - 1.25, fl + 2.25, s * (hw + 0.09));
      gb.box('dark', 0.9, 0.06, 0.12, x1 + L - 1.75, fl + 1.2, s * (hw - 0.06));
    }
    // cab front with boiler opening and front windows
    {
      const sh = new THREE.Shape(); sh.moveTo(-hw, fl); sh.lineTo(hw, fl); sh.lineTo(hw, roofY); sh.lineTo(-hw, roofY); sh.lineTo(-hw, fl);
      const hole = new THREE.Path(); hole.moveTo(-1.37, fl + 0.03); hole.lineTo(1.37, fl + 0.03); hole.lineTo(1.24, yB - 0.12); hole.absarc(0, yB - 0.12, 1.24, 0, Math.PI, false); hole.lineTo(-1.37, fl + 0.03);
      const wl = new THREE.Path(); wl.moveTo(-1.5, 3.3); wl.lineTo(-1.5, 4.25); wl.lineTo(-1.12, 4.25); wl.lineTo(-1.12, 3.78); wl.lineTo(-1.5, 3.3);
      const wr = new THREE.Path(); wr.moveTo(1.5, 3.3); wr.lineTo(1.12, 3.78); wr.lineTo(1.12, 4.25); wr.lineTo(1.5, 4.25); wr.lineTo(1.5, 3.3);
      sh.holes.push(wl, wr);
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false, curveSegments: 20 });
      g.rotateY(Math.PI / 2); g.translate(x0, 0, 0);
      gb.add('black', g);
    }
    // roof with overhang, gutter and ventilator
    const roofShape = new THREE.Shape(); roofShape.moveTo(-hw - 0.08, 0); roofShape.quadraticCurveTo(0, 0.42, hw + 0.08, 0); roofShape.lineTo(hw + 0.08, 0.05); roofShape.quadraticCurveTo(0, 0.47, -hw - 0.08, 0.05);
    const rg = new THREE.ExtrudeGeometry(roofShape, { depth: L + 0.55, bevelEnabled: false, curveSegments: 16 }); rg.rotateY(Math.PI / 2); rg.translate(x1 - 0.45, roofY - 0.02, 0);
    gb.add('black', rg);
    gb.box('black', 0.9, 0.18, 0.8, x1 + L / 2, roofY + 0.4, 0);
    // floor, deck, apron to tender
    gb.box('dark', L + 0.4, 0.08, 2 * hw, x1 + L / 2 - 0.15, fl, 0);
    gb.box('dark', 0.8, 0.05, 1.9, x1 - 0.35, fl + 0.02, 0);
    // cab number
    const cabNum = decalMat(256, 128, (g, w, h) => romanText(g, spec.num, w / 2, h / 2 + 4, 104, '#ebe8dd', 0.02));
    RMAT['cab' + key] = cabNum;
    for (const s of [-1, 1]) gb.add('cab' + key, new THREE.PlaneGeometry(1.0, 0.5), M(x1 + L / 2 - 0.25, fl + 0.65, s * (hw + 0.03), 0, s > 0 ? 0 : Math.PI, 0));
    // interior: backhead, gauges, firedoor, seats, levers
    const bh = ax(14.92);
    gb.box('backhead', 0.06, 1.7, 2.3, bh - 0.03, fl + 1.0, 0);
    gb.box('dark', 0.4, 0.4, 0.4, bh - 0.2, fl + 0.75, 0);
    for (const [z, y, r] of [[-0.45, 3.9, 0.13], [0.15, 3.95, 0.16], [0.55, 3.85, 0.12], [-0.1, 3.6, 0.1], [0.9, 3.55, 0.1]]) { gb.add('brass', new THREE.CylinderGeometry(r, r, 0.05, 18).rotateZ(Math.PI / 2).translate(bh - 0.05, y, z)); gb.add('white', new THREE.CircleGeometry(r * 0.85, 18).rotateY(-Math.PI / 2).translate(bh - 0.08, y, z)); }
    gb.box('glass', 0.05, 0.5, 0.06, bh - 0.06, 3.3, -0.85); gb.box('brass', 0.06, 0.08, 0.1, bh - 0.06, 3.58, -0.85); gb.box('brass', 0.06, 0.08, 0.1, bh - 0.06, 3.02, -0.85);
    for (const s of [-1, 1]) { gb.box('cabInt', 0.6, 0.55, 0.5, x1 + 0.8, fl + 0.85, s * 1.15); gb.box('cabInt', 0.1, 0.6, 0.5, x1 + 0.55, fl + 1.35, s * 1.15); }
    gb.box('dark', 0.1, 0.1, 0.7, bh - 0.35, 3.45, 0.75); // throttle quadrant
    gb.box('dark', 0.3, 0.25, 0.25, x1 + 1.6, fl + 1.05, 1.35); // brake stand
    gb.add('dark', new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6).rotateZ(Math.PI / 2).translate(x1 + 1.2, 3.75, 0.6)); // whistle cord
  }
  /* ---- trailing truck frame ---- */
  for (const s of [-1, 1]) { gb.box('dark', 3.4, 0.4, 0.18, ax(15.0), 0.78, s * 1.0); gb.box('dark', 0.3, 0.7, 0.25, ax(14.17), 0.75, s * 0.98); gb.box('dark', 0.3, 0.7, 0.25, ax(15.8), 0.8, s * 0.98); }
  gb.box('dark', 1.6, 0.25, 2.2, ax(13.3), 0.95, 0);
  // rear drawbar & deck
  gb.box('dark', 0.5, 0.3, 1.2, ax(17.15), 1.0, 0);

  const statics = gb.build({ ...RMAT, black: RMAT.black });
  body.add(statics);

  /* ---- glows & lights ---- */
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.25, 28), RMAT.lens); lens.position.set(ax(0.91), hlY, 0); lens.rotation.y = Math.PI / 2; body.add(lens);
  const fire = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.32), RMAT.glow.clone()); fire.position.set(ax(14.92) - 0.07, 2.75, 0); fire.rotation.y = -Math.PI / 2; body.add(fire);
  // headlight beam (visible at night) and lens halo
  const beamG = new THREE.ConeGeometry(7, 70, 24, 1, true); beamG.translate(0, -35, 0); beamG.rotateZ(Math.PI / 2);
  const beam = new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: true }));
  beam.position.set(ax(0.9), hlY, 0); beam.rotation.z = -0.045; beam.castShadow = false; body.add(beam);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(64, 64, g => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,248,225,1)'); gr.addColorStop(0.25, 'rgba(255,236,190,0.55)'); gr.addColorStop(1, 'rgba(255,220,160,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  halo.position.set(ax(0.86), hlY, 0); halo.scale.set(2.4, 2.4, 1); body.add(halo);
  const ash = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), new THREE.MeshBasicMaterial({ color: 0xff5a1a, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending }));
  ash.rotation.x = Math.PI / 2; ash.position.set(ax(13.4), 0.93, 0); body.add(ash);

  /* ---- moving parts ---- */
  const parts = { drivers: [], lead: null, trail: [], rods: {} };
  const mainG = driverAxle(LG.rD, true), sideG = driverAxle(LG.rD, false);
  for (let i = 0; i < 4; i++) {
    const g = i === 2 ? mainG : sideG;
    const grp = new THREE.Group(); grp.position.set(ax(LG.aD[i]), LG.rD, 0);
    for (const k of ['black', 'tire', 'rod']) { const m = new THREE.Mesh(g[k], k === 'black' ? RMAT.black : k === 'tire' ? RMAT.tire : RMAT.rod); m.castShadow = true; m.receiveShadow = true; grp.add(m); }
    body.add(grp); parts.drivers.push(grp);
  }
  const leadG = plainAxle(LG.rL), tr1G = plainAxle(LG.rT1), tr2G = plainAxle(LG.rT2);
  const mk = (G) => { const grp = new THREE.Group(); for (const k of ['black', 'tire']) { const m = new THREE.Mesh(G[k], k === 'black' ? RMAT.black : RMAT.tire); m.castShadow = true; grp.add(m); } return grp; };
  // lead truck (swivels, so positioned in world by the train)
  const leadTruck = new THREE.Group();
  { const lg = new GeoBin(); for (const s of [-1, 1]) { lg.box('dark', 1.4, 0.28, 0.16, 0, 0.62, s * 0.98); lg.box('dark', 0.34, 0.5, 0.26, 0, 0.5, s * 0.98); } lg.box('dark', 0.4, 0.2, 1.8, -0.55, 0.75, 0); lg.box('dark', 2.2, 0.16, 0.25, -1.0, 0.78, 0); leadTruck.add(lg.build(RMAT)); }
  const la = mk(leadG); la.position.y = LG.rL; leadTruck.add(la); parts.lead = la;
  // trailing truck wheels (attached to body: Delta truck pivots but stays close)
  const t1 = mk(tr1G); t1.position.set(ax(LG.aT[0]), LG.rT1, 0); body.add(t1);
  const t2 = mk(tr2G); t2.position.set(ax(LG.aT[1]), LG.rT2, 0); body.add(t2);
  parts.trail = [t1, t2];
  // rods per side
  const R = RMAT.rod;
  for (const s of [-1, 1]) {
    const z = s;
    const P = {
      side: [0, 1, 2].map(i => { const L = LG.aD[i + 1] - LG.aD[i]; const m = new THREE.Mesh(rodGeo(L, 0.16, 0.16, 0.07, 0.13, 0.13), R); m.castShadow = true; body.add(m); return m; }),
      main: (() => { const m = new THREE.Mesh(rodGeo(LG.Lm, 0.26, 0.15, 0.09, 0.19, 0.12), R); m.castShadow = true; body.add(m); return m; })(),
      cross: (() => { const g = new GeoBin(); g.box('rod', 0.5, 0.3, 0.2, 0, 0, 0); g.box('dark', 0.12, 0.42, 0.1, 0.05, -0.32, 0); const m = g.build(RMAT); body.add(m); return m; })(),
      piston: (() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.5, 10).rotateZ(Math.PI / 2).translate(0.75, 0, 0), R); body.add(m); return m; })(),
      ecc: (() => { const m = new THREE.Mesh(rodGeo(0.3, 0.12, 0.1, 0.06, 0.1, 0.07), R); body.add(m); return m; })(),
      eccRod: (() => { const m = new THREE.Mesh(rodGeo(LG.Le, 0.1, 0.09, 0.05, 0.06, 0.06), R); body.add(m); return m; })(),
      link: (() => { const g = new GeoBin(); g.box('rod', 0.12, 0.95, 0.08, 0, -0.05, 0); g.box('dark', 0.22, 0.12, 0.12, 0, 0, 0); g.cylZ('rod', 0.06, 0.12, 10, 0, -LG.rho, 0); const m = g.build(RMAT); body.add(m); return m; })(),
      radius: (() => { const m = new THREE.Mesh(rodGeo(LG.Lr, 0.09, 0.08, 0.05, 0.06, 0.05), R); body.add(m); return m; })(),
      comb: (() => { const g = new THREE.BoxGeometry(0.08, LG.a + LG.b + 0.1, 0.05).translate(0, -(LG.a + LG.b) / 2, 0); const m = new THREE.Mesh(g, R); body.add(m); return m; })(),
      union: (() => { const m = new THREE.Mesh(rodGeo(LG.Lu, 0.07, 0.07, 0.04, 0.045, 0.045), R); body.add(m); return m; })(),
      vstem: (() => { const g = new GeoBin(); g.add('rod', new THREE.CylinderGeometry(0.035, 0.035, 1.0, 8).rotateZ(Math.PI / 2).translate(0.5, 0, 0)); g.box('rod', 0.18, 0.14, 0.12, 0, 0, 0); const m = g.build(RMAT); body.add(m); return m; })(),
      reach: (() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 4.8, 6).rotateZ(Math.PI / 2).translate(2.4, 0, 0), RMAT.black); body.add(m); return m; })(),
    };
    parts.rods[s] = P;
  }
  // tap hitbox
  const hit = new THREE.Mesh(new THREE.BoxGeometry(17, 4.8, 3.2), RMAT.hit); hit.position.set(ax(8.6), 2.4, 0); body.add(hit);
  root.traverse(o => { if (o.isMesh) { o.castShadow = o.castShadow !== false && o.material !== RMAT.hit; o.receiveShadow = true; } });
  lens.castShadow = false; fire.castShadow = false; ash.castShadow = false;
  return { root, body, parts, leadTruck, lens, fire, ash, beam, halo, spec, stackPos: new THREE.Vector3(ax(2.55), 4.8, 0), cockPos: [new THREE.Vector3(ax(3.6), 0.4, 1.2), new THREE.Vector3(ax(3.6), 0.4, -1.2)], safetyPos: new THREE.Vector3(ax(12.05), yB + 1.6, 0), whistlePos: new THREE.Vector3(ax(10.1), yB + 1.7, 0.42), pumpPos: new THREE.Vector3(ax(3.6), 3.2, -1.4), injPos: new THREE.Vector3(ax(14.0), 1.5, 1.45), cabEye: new THREE.Vector3(ax(15.25), 3.72, 1.36), headlightPos: new THREE.Vector3(ax(0.9), hlY, 0) };
}

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
    // return crank
    const beta = -Math.PI / 2;
    const Rx = A3x + LG.e * Math.cos(phi + beta), Ry = A3y + LG.e * Math.sin(phi + beta);
    P.ecc.position.set(pin[0], pin[1], zs * 1.21); P.ecc.rotation.z = Math.atan2(Ry - pin[1], Rx - pin[0]);
    P.ecc.scale.x = Math.hypot(Rx - pin[0], Ry - pin[1]) / 0.3;
    // expansion link angle
    const Tx = LG.T[0], Ty = LG.T[1];
    let psi = 0;
    for (let k = 0; k < 3; k++) { const Fy = Ty - LG.rho * Math.cos(psi); const Fx = Rx + Math.sqrt(Math.max(0, LG.Le * LG.Le - (Fy - Ry) ** 2)); psi = Math.asin(clamp((Fx - Tx) / LG.rho, -0.9, 0.9)); }
    const Fx = Tx + LG.rho * Math.sin(psi), Fy = Ty - LG.rho * Math.cos(psi);
    P.eccRod.position.set(Rx, Ry, zs * 1.25); P.eccRod.rotation.z = Math.atan2(Fy - Ry, Fx - Rx);
    P.link.position.set(Tx, Ty, zs * 1.22); P.link.rotation.z = psi;
    // die block position from reverser
    const c = -rev * 0.31;
    const Dx = Tx + c * Math.sin(psi), Dy = Ty - c * Math.cos(psi);
    const Rry = LG.yR, Rrx = Dx + Math.sqrt(Math.max(0, LG.Lr * LG.Lr - (Rry - Dy) ** 2));
    P.radius.position.set(Dx, Dy, zs * 1.19); P.radius.rotation.z = Math.atan2(Rry - Dy, Rrx - Dx);
    // union link and combination lever
    const Ux = wx + 0.1, Uy = 0.6, Bx = Ux + LG.Lu, By = 0.62;
    P.union.position.set(Ux, Uy, zs * 1.29); P.union.rotation.z = Math.atan2(By - Uy, Bx - Ux);
    const Tvx = Rrx + (Rrx - Bx) * (LG.a / LG.b), Tvy = LG.yV;
    P.comb.position.set(Tvx, Tvy, zs * 1.29); P.comb.rotation.z = Math.atan2(Bx - Tvx, -(By - Tvy));
    P.vstem.position.set(Tvx, Tvy, zs * 1.14);
    P.reach.position.set(ax(12.4), 2.28, zs * 1.37); P.reach.rotation.z = -0.05 + rev * 0.02;
  }
}

/* =================== TENDER =================== */
function buildTender(key) {
  const spec = LOCO_SPEC[key];
  const root = new THREE.Group();
  const gb = new GeoBin();
  const Lt = 13.35, ref = Lt / 2, tx = a => ref - a;
  const hw = 1.6;
  gb.box('dark', 12.6, 0.45, 2.9, tx(6.75), 1.25, 0);   // underframe / sill
  gb.box('black', 12.45, 2.5, 2 * hw, tx(6.85), 2.72, 0); // water tank
  gb.box('black', 12.55, 0.08, 2 * hw + 0.06, tx(6.85), 3.98, 0);
  // coal bunker: raised flared coal boards forward half
  for (const s of [-1, 1]) {
    gb.box('black', 6.4, 0.62, 0.06, tx(3.6), 4.3, s * (hw + 0.08));
    gb.box('black', 0.06, 0.62, 2 * hw + 0.2, tx(6.8), 4.3, 0);
  }
  gb.box('black', 0.06, 1.3, 2 * hw, tx(0.42), 3.3, 0); // front coal gate wall
  gb.box('dark', 0.9, 0.06, 2.2, tx(0.15), 2.07, 0);    // deck
  // heaped coal
  {
    const g = new THREE.PlaneGeometry(6.0, 3.0, 24, 12); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position; const r = rng(55);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const u = 1 - (x / 3) ** 2, v = 1 - (z / 1.5) ** 2; p.setY(i, 4.05 + Math.max(0, u * v) * 0.75 + (r() - 0.5) * 0.06); }
    g.computeVertexNormals(); g.translate(tx(3.65), 0, 0); gb.add('coal', g);
  }
  // water hatch, rear deck, back-up light, ladders, grab irons
  gb.cyl('black', 0.42, 0.42, 0.22, 20, tx(10.6), 4.1, 0);
  gb.cyl('black', 0.46, 0.46, 0.05, 20, tx(10.6), 4.22, 0);
  gb.box('black', 0.6, 0.55, 0.6, tx(12.8), 4.15, 0);
  const bl = new THREE.Mesh(new THREE.CircleGeometry(0.17, 18), RMAT.lensOff); bl.position.set(tx(13.11), 4.15, 0); bl.rotation.y = -Math.PI / 2;
  for (const s of [-1, 1]) {
    for (let y = 1.5; y < 4.0; y += 0.35) gb.box('rod', 0.04, 0.04, 0.42, tx(13.12), y, s * 1.3);
    gb.box('dark', 0.05, 2.6, 0.05, tx(13.12), 2.7, s * 1.08); gb.box('dark', 0.05, 2.6, 0.05, tx(13.12), 2.7, s * 1.52);
    gb.box('dark', 0.05, 2.2, 0.05, tx(0.5), 2.6, s * (hw + 0.04));
    for (const y of [0.85, 1.3]) gb.box('dark', 0.45, 0.04, 0.3, tx(0.55), y, s * 1.45);
    gb.box('dark', 0.45, 0.04, 0.3, tx(12.7), 0.85, s * 1.45);
    // tank rivet seam
    for (const a of [4.0, 8.0]) gb.box('blackMatte', 0.03, 2.45, 0.01, tx(a), 2.72, s * (hw + 0.005));
  }
  gb.box('dark', 0.35, 0.3, 2.9, tx(13.05), 1.15, 0); gb.box('dark', 0.55, 0.22, 0.26, tx(13.25), 0.875, 0);
  // lettering
  const road = decalMat(1024, 128, (g, w, h) => romanText(g, spec.road, w / 2, h / 2 + 6, spec.road.length > 15 ? 84 : 92, '#ecE9de', 0.1));
  RMAT['road' + key] = road;
  for (const s of [-1, 1]) gb.add('road' + key, new THREE.PlaneGeometry(10.4, 1.3), M(tx(6.9), 2.95, s * (hw + 0.012), 0, s > 0 ? 0 : Math.PI, 0));
  const statics = gb.build(RMAT);
  root.add(statics); root.add(bl);
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { root, len: Lt, trucks: [{ a: 3.25, type: 'six', R: 0.457 }, { a: 10.1, type: 'six', R: 0.457 }], frame: [3.25, 10.1], backup: bl, waterHatchA: 10.6 };
}

/* =================== CARS =================== */
function textDecal(lines, w = 1024, h = 128, color = '#e9e3c9', font = 'serif', size = 80) {
  return decalMat(w, h, (g, W, H) => {
    if (font === 'serif') romanText(g, lines, W / 2, H / 2 + 6, size, color, 0.12);
    else { g.font = `bold ${size}px "Arial Narrow", Arial`; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(lines, W / 2, H / 2 + 4); }
  });
}
function coachModel(spec, num, observation) {
  const root = new THREE.Group(); const gb = new GeoBin();
  const L = 24.7, ref = L / 2, tx = a => ref - a, hw = 1.52;
  // body
  gb.box('green', 23.4, 2.55, 2 * hw, 0, 2.45, 0);
  gb.box('dark', 23.6, 0.25, 2 * hw - 0.1, 0, 1.08, 0);
  // underbody gear: battery boxes, AC generator, truss
  gb.box('dark', 2.0, 0.6, 1.2, 3.5, 0.75, 0); gb.box('dark', 1.6, 0.5, 1.0, -3, 0.75, 0.3); gb.box('dark', 2.6, 0.45, 0.5, 0, 0.75, -0.6);
  for (const s of [-1, 1]) gb.add('dark', new THREE.CylinderGeometry(0.03, 0.03, 9, 6).rotateZ(Math.PI / 2).translate(0, 0.62, s * 1.1));
  // windows (paired) and window posts
  const wy = 2.62;
  for (let i = 0; i < 13; i++) {
    const x = -9.5 + i * 1.58;
    for (const s of [-1, 1]) for (const dx of [-0.33, 0.33]) gb.box('win', 0.56, 0.78, 0.04, x + dx, wy, s * (hw + 0.005));
  }
  // letterboard
  const lb = textDecal(spec.road, 1024, 128, '#d9c27a', 'serif', 72); RMAT['lb' + spec.short] = lb;
  for (const s of [-1, 1]) gb.add('lb' + spec.short, new THREE.PlaneGeometry(11, 0.42), M(0, 3.38, s * (hw + 0.012), 0, s > 0 ? 0 : Math.PI, 0));
  const nmat = textDecal(String(num), 256, 96, '#d9c27a', 'serif', 64); const nk = 'cn' + num; RMAT[nk] = nmat;
  for (const s of [-1, 1]) gb.add(nk, new THREE.PlaneGeometry(1.0, 0.36), M(-7.5, 1.65, s * (hw + 0.012), 0, s > 0 ? 0 : Math.PI, 0));
  // clerestory roof
  const rs = new THREE.Shape(); rs.moveTo(-hw - 0.06, 0); rs.quadraticCurveTo(-hw * 0.9, 0.42, -0.82, 0.5); rs.lineTo(-0.82, 0.88); rs.quadraticCurveTo(0, 1.02, 0.82, 0.88); rs.lineTo(0.82, 0.5); rs.quadraticCurveTo(hw * 0.9, 0.42, hw + 0.06, 0); rs.lineTo(-hw - 0.06, 0);
  const rg = new THREE.ExtrudeGeometry(rs, { depth: 23.8, bevelEnabled: false, curveSegments: 10 }); rg.rotateY(Math.PI / 2); rg.translate(-11.9, 3.72, 0); gb.add('roof', rg);
  for (let i = 0; i < 12; i++) for (const s of [-1, 1]) gb.box('win', 0.5, 0.2, 0.02, -9.5 + i * 1.7, 4.42, s * 0.825);
  for (let i = 0; i < 5; i++) gb.cyl('roof', 0.12, 0.14, 0.22, 10, -8 + i * 4, 4.72, 0);
  // vestibules: doors, steps, diaphragms
  for (const e of [-1, 1]) {
    const xe = e * (L / 2 - 0.62);
    gb.box('green', 0.08, 2.5, 2 * hw, e * 11.72, 2.45, 0);
    for (const s of [-1, 1]) { gb.box('green', 0.85, 0.3, 0.05, e * 11.3, 1.2, s * (hw)); gb.box('dark', 0.5, 0.05, 0.35, e * 11.25, 0.75, s * (hw - 0.05)); gb.box('dark', 0.5, 0.05, 0.35, e * 11.25, 0.45, s * (hw - 0.05)); gb.box('win', 0.4, 0.7, 0.04, e * 11.2, 2.7, s * (hw + 0.005)); }
    if (!(observation && e < 0)) { gb.box('diaphragm', 0.42, 2.55, 1.52, e * (L / 2 - 0.22), 2.45, 0); gb.box('dark', 0.06, 2.6, 1.6, e * (L / 2 - 0.02), 2.45, 0); }
    gb.box('dark', 0.6, 0.22, 0.26, e * (L / 2 - 0.3), 0.875, 0);
  }
  if (observation) {
    // open rear platform with brass railing and drumhead
    gb.box('dark', 1.6, 0.08, 2.9, -11.8, 1.15, 0);
    for (const z of [-1.4, -0.7, 0, 0.7, 1.4]) gb.cyl('brass', 0.02, 0.02, 1.05, 6, -12.55, 1.7, z);
    gb.add('brass', new THREE.CylinderGeometry(0.03, 0.03, 2.9, 8).rotateX(Math.PI / 2).translate(-12.55, 2.2, 0));
    gb.cyl('roof', 0.12, 0.12, 0.3, 8, -12.3, 4.0, 0);
    const dh = decalMat(256, 256, (g, w, h) => { g.fillStyle = '#e9dfc2'; g.beginPath(); g.arc(128, 128, 122, 0, TAU); g.fill(); g.strokeStyle = '#6b1f1a'; g.lineWidth = 10; g.stroke(); g.fillStyle = '#6b1f1a'; g.font = '600 30px "Times New Roman", serif'; g.textAlign = 'center'; const t = spec.short === 'NKP' ? ['THE', 'NICKEL PLATE', 'LIMITED'] : ['THE', 'PERE', 'MARQUETTE']; g.fillText(t[0], 128, 92); g.font = '700 34px "Times New Roman", serif'; g.fillText(t[1], 128, 134); g.font = '600 30px "Times New Roman", serif'; g.fillText(t[2], 128, 176); });
    RMAT.drumhead = dh; dh.emissive = new THREE.Color(0xffd9a0); dh.emissiveMap = dh.map; dh.emissiveIntensity = 0; SCN.winMats.push(dh);
    gb.add('drumhead', new THREE.CircleGeometry(0.42, 28), M(-12.58, 1.85, 0, 0, -Math.PI / 2, 0));
    gb.add('brass', new THREE.TorusGeometry(0.43, 0.025, 6, 28).rotateY(Math.PI / 2).translate(-12.56, 1.85, 0));
  }
  root.add(gb.build(RMAT));
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { root, len: L, trucks: [{ a: 3.5, type: 'six', R: 0.457 }, { a: 21.2, type: 'six', R: 0.457 }], frame: [3.5, 21.2], weight: 82 * STON, kind: 'coach', axles: 6, area: 120 };
}
function freightModel(type, num, r) {
  const root = new THREE.Group(); const gb = new GeoBin();
  let L, hw = 1.5, weight, trucks;
  const marks = (txt, sub, mat, y, color) => { const k = 'fm_' + type + '_' + num; RMAT[k] = decalMat(512, 128, (g, w, h) => { g.fillStyle = color || '#ece9df'; g.font = 'bold 48px "Arial Narrow", Arial'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(txt, 12, 42); g.font = '28px "Arial Narrow", Arial'; g.fillText(sub, 12, 96); }); for (const s of [-1, 1]) gb.add(k, new THREE.PlaneGeometry(2.6, 0.65), M(s > 0 ? -L / 2 + 2.2 : L / 2 - 2.2, y, s * (hw + 0.012), 0, s > 0 ? 0 : Math.PI, 0)); };
  if (type === 'box') {
    L = 13.0; weight = (r() < 0.6 ? 62 : 25) * STON;
    gb.box('oxide', 12.2, 2.75, 2 * hw, 0, 2.55, 0);
    for (let x = -5.6; x <= 5.6; x += 0.8) for (const s of [-1, 1]) gb.box('oxide2', 0.06, 2.75, 0.03, x, 2.55, s * (hw + 0.015));
    for (const s of [-1, 1]) { gb.box('oxide2', 1.8, 2.5, 0.06, 0.4, 2.45, s * (hw + 0.04)); gb.box('dark', 2.2, 0.08, 0.08, 0.4, 3.75, s * (hw + 0.06)); }
    gb.box('oxide2', 12.3, 0.1, 2 * hw + 0.08, 0, 3.97, 0);
    gb.box('wood', 12.2, 0.05, 0.52, 0, 4.06, 0);
    gb.add('dark', new THREE.TorusGeometry(0.22, 0.02, 4, 14).translate(-6.15, 3.6, 0));
    marks('NKP ' + num, 'CAPY 100000  LD LMT 110700', 'oxide', 3.1);
  } else if (type === 'hopper') {
    L = 11.2; weight = 92 * STON;
    gb.box('black', 10.4, 2.0, 2 * hw, 0, 2.6, 0);
    for (let x = -4.8; x <= 4.8; x += 1.2) for (const s of [-1, 1]) gb.box('black', 0.12, 2.05, 0.08, x, 2.6, s * (hw + 0.03));
    for (const x of [-2.6, 2.6]) gb.add('black', new THREE.ConeGeometry(1.1, 1.2, 4).rotateY(Math.PI / 4).rotateX(Math.PI).translate(x, 1.1, 0));
    const g = new THREE.PlaneGeometry(10.1, 2.8, 20, 6); g.rotateX(-Math.PI / 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, 3.5 + 0.35 * Math.max(0, (1 - (z / 1.4) ** 2)) * (0.7 + 0.3 * Math.cos(x * 1.2))); } g.computeVertexNormals(); gb.add('coal', g);
    marks('NKP ' + num, 'CAPY 140000', 'black', 2.8);
  } else if (type === 'tank') {
    L = 12.4; weight = 70 * STON; hw = 1.45;
    gb.add('tank', new THREE.CylinderGeometry(1.4, 1.4, 11.4, 28).rotateZ(Math.PI / 2).translate(0, 2.65, 0));
    for (const s of [-1, 1]) gb.add('tank', new THREE.SphereGeometry(1.4, 20, 10, 0, TAU, 0, Math.PI / 2).scale(1, 0.25, 1).rotateZ(-s * Math.PI / 2).translate(s * 5.7, 2.65, 0));
    gb.cyl('tank', 0.65, 0.65, 0.6, 18, 0, 4.2, 0); gb.cyl('tank', 0.7, 0.7, 0.08, 18, 0, 4.52, 0);
    gb.box('dark', 11, 0.2, 2.4, 0, 1.3, 0);
    for (const s of [-1, 1]) gb.box('wood', 11, 0.05, 0.4, 0, 1.45, s * 1.45);
    for (const x of [-4, 0, 4]) gb.add('dark', new THREE.TorusGeometry(1.42, 0.03, 4, 28).rotateY(Math.PI / 2).translate(x, 2.65, 0));
    marks('UTLX ' + num, 'NON-ACCIDENT  CAPY 10000 GAL', 'tank', 2.1);
  } else if (type === 'gon') {
    L = 14.6; weight = 88 * STON;
    gb.box('oxide2', 13.8, 1.3, 2 * hw, 0, 1.95, 0);
    for (let x = -6.4; x <= 6.4; x += 0.9) for (const s of [-1, 1]) gb.box('oxide2', 0.1, 1.32, 0.08, x, 1.95, s * (hw + 0.03));
    const g = new THREE.PlaneGeometry(13.4, 2.8, 26, 6); g.rotateX(-Math.PI / 2); const p = g.attributes.position; const rr = rng(num); for (let i = 0; i < p.count; i++) { const z = p.getZ(i); p.setY(i, 2.45 + 0.35 * Math.max(0, 1 - (z / 1.4) ** 2) + (rr() - 0.5) * 0.12); } g.computeVertexNormals(); gb.add('stoneLoad', g);
    marks('NKP ' + num, 'CAPY 140000', 'oxide2', 1.95);
  } else if (type === 'caboose') {
    L = 11.0; weight = 22 * STON;
    gb.box('caboose', 8.4, 2.5, 2 * hw - 0.1, 0, 2.45, 0);
    gb.box('caboose', 2.6, 1.05, 2.4, -0.6, 4.25, 0);
    gb.box('roof', 8.7, 0.08, 2 * hw + 0.1, 0, 3.74, 0); gb.box('roof', 2.8, 0.08, 2.6, -0.6, 4.82, 0);
    for (const s of [-1, 1]) { for (const x of [-2.8, 1.2, 2.8]) gb.box('win', 0.6, 0.7, 0.04, x, 2.7, s * (hw - 0.04)); for (const x of [-1.3, 0.1]) gb.box('win', 0.55, 0.5, 0.04, x, 4.35, s * 1.21); }
    for (const e of [-1, 1]) { gb.box('dark', 1.2, 0.08, 2.8, e * 4.9, 1.25, 0); for (const z of [-1.3, 1.3]) gb.cyl('dark', 0.02, 0.02, 1.0, 6, e * 5.45, 1.75, z); gb.box('dark', 0.04, 0.04, 2.6, e * 5.45, 2.25, 0); gb.box('win', 0.04, 0.9, 0.55, e * 4.21, 2.6, 0); }
    gb.cyl('dark', 0.08, 0.1, 0.5, 8, 1.8, 4.0, 0.6);
    // marker lamps
    for (const z of [-1.2, 1.2]) { gb.box('dark', 0.2, 0.3, 0.2, 4.25, 3.25, z); }
    marks('NKP ' + num, '', 'caboose', 2.0);
    root.userData.markers = [new THREE.Vector3(4.37, 3.25, -1.2), new THREE.Vector3(4.37, 3.25, 1.2)];
  }
  // underframe common
  gb.box('dark', L - 1.4, 0.35, 2.6, 0, 1.15, 0);
  for (const e of [-1, 1]) { gb.box('dark', 0.6, 0.22, 0.26, e * (L / 2 - 0.3), 0.875, 0); gb.box('dark', 0.3, 0.4, 2.9, e * (L / 2 - 0.65), 1.15, 0); if (type !== 'caboose' && type !== 'tank') { for (let y = 1.4; y < 3.6; y += 0.42) gb.box('dark', 0.03, 0.03, 0.45, e * (L / 2 - 0.62), y, 1.2); } }
  gb.add('dark', new THREE.CylinderGeometry(0.17, 0.17, 0.5, 10).rotateZ(Math.PI / 2).translate(1.6, 0.9, 0.5));
  root.add(gb.build(RMAT));
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const ta = type === 'caboose' ? 2.4 : 1.95;
  trucks = [{ a: ta, type: 'four', R: 0.419 }, { a: L - ta, type: 'four', R: 0.419 }];
  return { root, len: L, trucks, frame: [ta, L - ta], weight, kind: type, axles: 4, area: 105 };
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
  return { six: mergeGeos(six.bins.dark), four: mergeGeos(four.bins.dark) };
}

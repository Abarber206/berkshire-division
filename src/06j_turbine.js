/* ============================================================================
   Union Pacific 8500 hp gas turbine-electric (GTEL 8500, road numbers 1-30, 1958-61), "Big Blow".
   Built from UP's own diagram (Turbines Westward, T. Lee, 1990, p. 148) and the published figures:
   - cab ("control") unit 69 ft 6 in and turbine ("B") unit 63 ft over the pulling faces, 132 ft 6 in together;
     the 24,384 gal fuel tender 46 ft 5 1/4 in, 178 ft 11 1/4 in in all;
   - C-C trucks, 40 in wheels, 7 ft 3 in axle spacing, the first axle 7 ft 2 in in from the coupler face,
     truck centres 40 ft 8 in (cab unit) and 34 ft 2 in (B unit); total wheelbase 118 ft 2 in;
   - carbodies 10 ft wide, 15 ft 4 in to the roof, 16 ft over the turbine air intake and exhaust casing;
   - the tender (rebuilt from an 800-class FEF tender): Buckeye six-wheel trucks of 5 ft axle spacing, 36 in wheels,
     truck centres 23 ft 5 in, tank 13 ft 8 21/32 in over the insulation sheet, 14 ft 3 21/32 in over the runboard,
     six round heater access plates a side.
   849,248 lb without the tender, 212,312 lbf starting and 146,000 lbf continuous at 18 mph, 74:18 gears, 65 mph.
   The cab unit carries the cab, the 850 hp Cooper-Bessemer auxiliary diesel, its radiator, the dynamic brake grids
   and the compressors; the B unit the single-shaft GE frame 5 turbine, its inlet silencer and its exhaust casing.
   Armour Yellow and Harbor Mist Gray with red pinstripes, the winged shield on the nose.
   Local frame (as the diesel's): +X forward, origin midway between the truck centres at rail top.
   ========================================================================== */
const FT_ = 0.3048, IN_ = 0.0254;
const GT = {
  lenA: 69.5 * FT_, lenB: 63 * FT_, tc: 14 * FT_ + 5 * IN_, axle: 7 * FT_ + 3 * IN_, rW: 20 * IN_,
  hw: 5 * FT_, roof: 15 * FT_ + 4 * IN_, top: 16 * FT_, y0: 1.40, sill: 1.05, rr: 0.28,
  num: 18, massA: 408624, massB: 440624,   // lb: 849,248 the pair
};
const GTT = { len: 46 * FT_ + 5.25 * IN_, tc: 11 * FT_ + 6.125 * IN_, sp: 5 * FT_, R: 18 * IN_, hw: 1.55,
  tank: 13 * FT_ + 8.656 * IN_, run: 14 * FT_ + 3.656 * IN_, rail: 15 * FT_ + 11.656 * IN_, y0: 1.42, a0: 0.5 };

/* ---------------- paint and lettering ---------------- */
function turbineMaterials() {
  if (RMAT.upYel) return;
  const mk = (c, m, r, extra = {}) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r, ...extra });
  RMAT.upYel = mk(0xf2b21c, 0.15, 0.5, { side: THREE.DoubleSide });          // Armour Yellow
  RMAT.upGray = mk(0x8d9295, 0.3, 0.55, { side: THREE.DoubleSide });         // Harbor Mist Gray
  RMAT.upRed = mk(0xb5121b, 0.15, 0.5);
  RMAT.upFrame = mk(0x5f6467, 0.35, 0.6, { side: THREE.DoubleSide });
  RMAT.upSilver = mk(0xc4c8ca, 0.85, 0.3);
  RMAT.upLouver = mk(0xf2b21c, 0.15, 0.55, { map: louverTex() });
  wear(RMAT.upYel, 0.25, 58); wear(RMAT.upGray, 0.55, 59); wear(RMAT.upFrame, 0.5, 60); wear(RMAT.upLouver);
  const red = '#b5121b';
  const dec = (w, h, draw) => decalMat(w, h, draw);
  const gothic = px => `800 ${px}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
  RMAT.upRoad2 = dec(512, 512, (g, w, h) => { g.fillStyle = red; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = gothic(196); if (g.letterSpacing !== undefined) g.letterSpacing = '18px'; g.fillText('UNION', w / 2, h * 0.27); g.fillText('PACIFIC', w / 2, h * 0.75); });
  RMAT.upRoad1 = dec(1024, 128, (g, w, h) => { g.fillStyle = red; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = gothic(100); if (g.letterSpacing !== undefined) g.letterSpacing = '14px'; g.fillText('UNION PACIFIC', w / 2, h / 2 + 4); });
  RMAT.upShield = dec(256, 320, (g, w, h) => upShield(g, w / 2, 20, 200, 280));
  RMAT.upWings = dec(1024, 256, (g, w, h) => {
    // wings swept back from the shield: silver feathers outlined in red
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
      const y = 70 + k * 34, x0 = w / 2 + s * 90, x1 = w / 2 + s * (470 - k * 70);
      g.fillStyle = '#d9dcdd'; g.strokeStyle = red; g.lineWidth = 6;
      g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y - 6 + k * 3); g.quadraticCurveTo(x1 + s * 18, y + 9, x1, y + 22); g.lineTo(x0, y + 26); g.closePath(); g.fill(); g.stroke();
    }
    upShield(g, w / 2, 26, 160, 214);
  });
}
/* the Union Pacific shield: white top with the name in blue, red and white stripes below */
function upShield(g, cx, y, w, h) {
  const x = cx - w / 2, path = () => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h * 0.55); g.quadraticCurveTo(x + w, y + h * 0.9, cx, y + h); g.quadraticCurveTo(x, y + h * 0.9, x, y + h * 0.55); g.closePath(); };
  g.save(); path(); g.clip();
  g.fillStyle = '#f4f2ea'; g.fillRect(x, y, w, h);
  const n = 13, sw = w / n; for (let i = 0; i < n; i += 2) { g.fillStyle = '#b5121b'; g.fillRect(x + i * sw, y + h * 0.38, sw, h); }
  g.fillStyle = '#1d3a8a'; g.fillRect(x, y, w, h * 0.38);
  g.fillStyle = '#f4f2ea'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `800 ${Math.round(h * 0.1)}px Arial, sans-serif`; g.fillText('UNION', cx, y + h * 0.1); g.fillText('PACIFIC', cx, y + h * 0.2); g.fillText('RAILROAD', cx, y + h * 0.3);
  g.restore(); g.strokeStyle = '#1b1b1b'; g.lineWidth = Math.max(3, w * 0.03); path(); g.stroke();
}
function upNumberMat(num, board) {
  const k = (board ? 'upBoard' : 'upNum') + num; if (RMAT[k]) return RMAT[k];
  if (board) return (RMAT[k] = new THREE.MeshBasicMaterial({ map: canvasTex(128, 48, (g, w, h) => { g.fillStyle = '#ece6cf'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.font = 'bold 34px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(num), w / 2, h / 2 + 2); }) }));
  return (RMAT[k] = decalMat(256, 128, (g, w, h) => { g.fillStyle = '#b5121b'; g.font = '800 104px "Arial Narrow", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(num), w / 2, h / 2 + 4); }));
}

/* ---------------- a carbody shell lofted through stations ----------------
   Each station: { a, hw, y0, top, r }: half width, bottom, roof and the radius of the roof's edges. The ring runs
   up the left side, over the roof and down the right side (20 segments: 0-2 left side, 3-7 left edge, 8-11 roof,
   12-16 right edge, 17-19 right side). skip(seg, a0, a1) leaves a panel out (windows are built in their place). */
const GT_RING = 20;
function gtRing(hw, y0, top, r) {
  r = Math.min(r, top - y0 - 0.01, hw - 0.01);
  const P = [];
  for (let i = 0; i < 3; i++) P.push([-hw, y0 + (top - r - y0) * i / 3]);
  for (let i = 0; i < 5; i++) { const t = Math.PI - (Math.PI / 2) * i / 5; P.push([-hw + r + Math.cos(t) * r, top - r + Math.sin(t) * r]); }
  for (let i = 0; i < 4; i++) P.push([-(hw - r) + 2 * (hw - r) * i / 4, top]);
  for (let i = 0; i < 5; i++) { const t = Math.PI / 2 - (Math.PI / 2) * i / 5; P.push([hw - r + Math.cos(t) * r, top - r + Math.sin(t) * r]); }
  for (let i = 0; i <= 3; i++) P.push([hw, top - r - (top - r - y0) * i / 3]);
  return P;   // 21 points
}
function gtLoft(gb, key, dx, st, o = {}) {
  const rings = st.map(s => gtRing(s.hw, s.y0, s.top, s.r));
  const pos = [], uv = [];
  const V = (i, j) => { const p = rings[i][j]; return [dx(st[i].a), p[1], p[0]]; };
  const tri = (a, b, c) => { pos.push(...a, ...b, ...c); uv.push(0, 0, 1, 0, 1, 1); };
  for (let i = 0; i < st.length - 1; i++) for (let j = 0; j < GT_RING; j++) {
    if (o.skip && o.skip(j, st[i].a, st[i + 1].a)) continue;
    const a = V(i, j), b = V(i, j + 1), c = V(i + 1, j + 1), d = V(i + 1, j);
    tri(a, c, b); tri(a, d, c);
  }
  for (const [i, out] of [[0, 1], [st.length - 1, -1]]) {
    if ((out > 0 && !o.capF) || (out < 0 && !o.capB)) continue;
    const s = st[i], C = [dx(s.a), s.y0, 0];
    for (let j = 0; j < GT_RING; j++) { const a = V(i, j), b = V(i, j + 1); if (out > 0) tri(C, a, b); else tri(C, b, a); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return gb.add(key, g);
}

/* ---------------- C-C truck: 40 in wheels, 7 ft 3 in axle spacing, equalized side frames ---------------- */
function gtTruck(wheels) {
  const grp = new THREE.Group(), tg = new GeoBin(), A = GT.axle, R = GT.rW, k = A / 2.0;
  const ax = plainAxle(R, true, RAIL_OFF, 1.16);
  for (const s of [-1, 1]) {
    const sf = new THREE.Shape();
    sf.moveTo(-2.62 * k - 0.15, 0.78); sf.lineTo(-2.45 * k - 0.15, 0.98); sf.lineTo(2.45 * k + 0.15, 0.98); sf.lineTo(2.62 * k + 0.15, 0.78);
    for (const x of [A, 0, -A]) { sf.lineTo(x + 0.44, 0.74); sf.lineTo(x + 0.32, 0.32); sf.lineTo(x - 0.32, 0.32); sf.lineTo(x - 0.44, 0.74); }
    sf.closePath();
    const g = new THREE.ExtrudeGeometry(sf, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
    g.translate(0, 0, s * 1.06 - 0.08); tg.add('dark', g);
    for (const x of [-A, 0, A]) {
      tg.add('steel', new THREE.CylinderGeometry(0.16, 0.16, 0.09, 14).rotateX(Math.PI / 2), M(x, R, s * 1.175));                         // journal box lids
      for (const dz of [-1, 1]) tg.add('steel', new THREE.CylinderGeometry(0.075, 0.075, 0.24, 10), M(x + 0.22 * dz, 0.86, s * 1.2));     // coil springs
    }
    // equalizer bars swinging between the journal boxes under the springs
    for (const [x0, x1] of [[-A, 0], [0, A]]) tg.add('dark', new THREE.BoxGeometry(A - 0.2, 0.09, 0.08), M((x0 + x1) / 2, 0.71, s * 1.2));
    for (const x of [-A / 2, A / 2]) tg.add('dark', new THREE.CylinderGeometry(0.11, 0.11, 0.36, 10).rotateZ(Math.PI / 2), M(x, 0.9, s * 1.22));   // brake cylinders
    tg.box('dark', 0.46, 0.4, 0.3, s * (A + 0.62), 0.9, s * 1.0);   // sand boxes
  }
  for (const x of [-A, 0, A]) {
    const cx = x + (x >= 0 ? -0.44 : 0.44);
    tg.add('dark', new THREE.CylinderGeometry(0.4, 0.4, 0.96, 14).rotateX(Math.PI / 2), M(cx, 0.55, 0));      // traction motors on their axles
  }
  for (const x of [-A / 2, A / 2]) tg.box('dark', 0.25, 0.16, 2.1, x, 0.9, 0);
  tg.box('dark', 0.9, 0.22, 2.1, 0, 1.0, 0);                 // the floating bolster
  grp.add(tg.build(RMAT));
  for (const x of [-A, 0, A]) {
    const wg = new THREE.Group(); wg.position.set(x, R, 0);
    wg.add(new THREE.Mesh(ax.black, RMAT.black), new THREE.Mesh(ax.tire, RMAT.tire));
    grp.add(wg); wheels.push(wg);
  }
  grp.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return grp;
}

/* frame, pilots, steps, couplers and trucks under a unit; ends: { front: 'nose' | 'end', rear: 'end' } */
function gtUnderframe(gb, body, len, dx, ends) {
  const box = (k, a0, a1, y0, y1, z0, z1) => gb.box(k, Math.abs(a1 - a0), Math.abs(y1 - y0), Math.abs(z1 - z0), dx((a0 + a1) / 2), (y0 + y1) / 2, (z0 + z1) / 2);
  const W = GT.hw, Y0 = GT.y0, YS = GT.sill;
  box('upFrame', 0.4, len - 0.4, YS, Y0, -W + 0.02, W - 0.02);                    // frame skirt under the carbody
  box('upRed', 0.4, len - 0.4, Y0 - 0.035, Y0, -W - 0.004, W + 0.004);             // red pinstripe along the foot of the yellow
  box('dark', 0.9, len - 0.9, 0.95, YS, -0.5, 0.5);                                // centre sill
  for (const a of [GT.tc, len - GT.tc]) box('dark', a - 0.5, a + 0.5, 1.08, YS + 0.01, -1.1, 1.1);   // body bolsters
  const couplers = [];
  for (const e of [0, 1]) {
    const A = e ? len : 0, sg = e ? -1 : 1, at = d => A + sg * d, nose = !e && ends.front === 'nose';
    if (nose) {
      // the pilot: raked back from the rail, open in the middle round the coupler, footboard-free
      for (const s of [-1, 1]) {
        const g = new THREE.BoxGeometry(0.06, 0.9, 1.05); g.applyMatrix4(M(0, 0, 0, 0, 0, 0.42));
        gb.add('upFrame', g, M(dx(at(0.36)), 0.68, s * 0.78));
      }
      box('upFrame', 0.3, 0.42, 1.0, YS + 0.01, -1.32, 1.32);
    } else {
      box('upFrame', at(0.30) - 0.06 * sg, at(0.30) + 0.06 * sg, 0.72, YS + 0.01, -1.3, 1.3);   // end sill plate
      box('dark', at(0.30) - 0.03 * sg, at(0.30) + 0.03 * sg, 1.2, 1.36, -1.42, 1.42);         // anticlimber
    }
    couplers.push(addCoupler(gb, body, { x: dx(A), out: e ? -1 : 1, sx: -0.42, sb: 0.72, ly: 1.4, zh: 0.95, yp: 0.86, housing: false }));
    for (const z of [-0.74, 0.74]) box('dark', at(0.4) - 0.04 * sg, at(0.4) + 0.04 * sg, 0.92, 1.12, z - 0.1, z + 0.1);   // MU / hose brackets
  }
  // boarding steps and ladders by the trucks, with grab irons up the carbody
  for (const a of [GT.tc - 1.85, len - GT.tc + 1.85]) for (const s of [-1, 1]) {
    for (const y of [0.42, 0.75]) box('dark', a - 0.3, a + 0.3, y, y + 0.04, s * (W - 0.32), s * (W - 0.02));
    for (const d of [-0.32, 0.32]) box('dark', a + d - 0.02, a + d + 0.02, 0.42, YS + 0.01, s * (W - 0.32), s * (W - 0.02));
    gb.add('upSilver', barGeo(0.016, [dx(a - 0.36), 1.5, s * (W + 0.06)], [dx(a - 0.36), 3.1, s * (W + 0.06)], 6));
    for (const y of [1.5, 3.1]) box('upSilver', a - 0.38, a - 0.34, y - 0.02, y + 0.02, s * W, s * (W + 0.08));
  }
  return couplers;
}

/* ---------------- the cab ("control") unit and the turbine ("B") unit ---------------- */
function buildTurbineUnit(opts) {
  dieselMaterials(); turbineMaterials(); cabMaterials();
  const B = opts.unit === 'B', len = B ? GT.lenB : GT.lenA, ref = len / 2, dx = a => ref - a;
  const num = opts.number || GT.num, lead = !B;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const gb = new GeoBin();
  const box = (k, a0, a1, y0, y1, z0, z1) => gb.box(k, Math.abs(a1 - a0), Math.abs(y1 - y0), Math.abs(z1 - z0), dx((a0 + a1) / 2), (y0 + y1) / 2, (z0 + z1) / 2);
  const W = GT.hw, Y0 = GT.y0, RF = GT.roof, R = GT.rr;
  const side = (k, a, y, w, h, s, mat) => gb.add(k, new THREE.PlaneGeometry(w, h), M(dx(a), y, s * (W + 0.006), 0, s > 0 ? 0 : Math.PI, 0));
  const out = { root, body, trucks: [], wheels: [], couplers: null, spec: LOCO_SPEC['18'], skin: {}, livery: null, number: num, diesel: true, turb: true, unit: B ? 'B' : 'A', lead, len, frame: [GT.tc, len - GT.tc], rW: GT.rW, wb: GT.axle, ditch: [], lenses: [] };
  let cab = null;
  if (!B) {
    /* --- nose: a flat face rounded in plan at the corners, its top edge rolled over, rising to the windshield --- */
    const N0 = 0.4, N1 = 1.45, WS0 = 1.72, WS1 = 2.42, CAB1 = 3.72;
    const hwA = a => a >= N1 ? W : 0.95 + (W - 0.95) * Math.sqrt(Math.max(0, 1 - (1 - (a - N0) / (N1 - N0)) ** 2));
    const topA = a => a < 0.72 ? 3.62 + 0.26 * Math.sqrt(Math.max(0, 1 - (1 - (a - N0) / 0.32) ** 2)) : a < WS0 ? 3.88 + 0.1 * (a - 0.72) / (WS0 - 0.72) : a < WS1 ? 3.98 + (RF - 3.98) * (a - WS0) / (WS1 - WS0) : RF;
    const as = [N0, 0.405, 0.42, 0.45, 0.5, 0.56, 0.63, 0.72, 0.84, 0.98, 1.13, 1.3, N1, WS0, WS1, CAB1, len - 0.4];
    const st = as.map(a => ({ a, hw: hwA(a), y0: Y0, top: topA(a), r: a < WS1 ? 0.3 : R }));
    // the windshield's slope and the cab sides are framed separately with their glass
    const winSkip = (j, a0, a1) => (a0 >= WS0 - 1e-6 && a1 <= WS1 + 1e-6 && j >= 8 && j <= 11) || (a0 >= WS1 - 1e-6 && a1 <= CAB1 + 1e-6 && (j <= 2 || j >= 17));
    gtLoft(gb, 'upYel', dx, st, { capF: true, capB: true, skip: winSkip });
    // the cab's lining inside the shell, a centimetre in, from the nose back to the cab's rear wall
    gtLoft(gb, 'dLining', dx, st.filter(o => o.a >= N1 - 1e-6 && o.a <= CAB1 + 1e-6).map(o => ({ a: o.a, hw: o.hw - 0.01, y0: Y0 + 0.01, top: o.top - 0.01, r: o.r })), { skip: winSkip });
    // the lower nose and the skirt under it, gray, with three red pinstripes round the nose
    {
      const sk = as.filter(a => a <= N1).map(a => ({ a, hw: hwA(a), y0: GT.sill - 0.18, top: Y0, r: 0.002 }));
      sk.push({ a: N1 + 0.5, hw: W, y0: GT.sill - 0.18, top: Y0, r: 0.002 });
      gtLoft(gb, 'upGray', dx, sk, { capF: true });
      for (const y of [Y0 - 0.06, Y0 - 0.2, Y0 - 0.34]) {
        const rs = as.filter(a => a <= N1).map(a => ({ a: a - 0.004, hw: hwA(a) + 0.004, y0: y - 0.025, top: y, r: 0.002 }));
        rs.push({ a: N1 + 0.5, hw: W + 0.004, y0: y - 0.025, top: y, r: 0.002 });
        gtLoft(gb, 'upRed', dx, rs, { capF: true });
      }
    }
    // windshield: a sloped plate with two panes, between the roof edges
    {
      const zt = W - 0.3, u = Math.hypot(WS1 - WS0, RF - 3.98), ang = Math.atan2(RF - 3.98, WS1 - WS0);
      const sh = new THREE.Shape(); sh.moveTo(0, -zt); sh.lineTo(u, -zt); sh.lineTo(u, zt); sh.lineTo(0, zt); sh.closePath();
      for (const s of [-1, 1]) { const h = new THREE.Path(), z0 = s > 0 ? 0.07 : -0.95, z1 = s > 0 ? 0.95 : -0.07; h.moveTo(0.06, z0); h.lineTo(u - 0.08, z0); h.lineTo(u - 0.08, z1); h.lineTo(0.06, z1); h.closePath(); sh.holes.push(h); }
      const m = new THREE.Matrix4().makeTranslation(dx(WS0), 3.98, 0).multiply(new THREE.Matrix4().makeRotationZ(Math.PI - ang)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
      const g = new THREE.ShapeGeometry(sh); g.applyMatrix4(m); g.computeVertexNormals(); gb.add('upYel', g);
      const gi = new THREE.ShapeGeometry(sh); gi.translate(0, 0, -0.01); gi.applyMatrix4(m); gb.add('dLining', gi);   // its inside face, lined
      for (const s of [-1, 1]) {
        const pg = new THREE.PlaneGeometry(u - 0.12, 0.9); pg.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2)); pg.translate((u - 0.02) / 2, 0, s * 0.51); pg.applyMatrix4(m.clone().multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2)));
        gb.add('glassT', pg);
        const wp = barGeo(0.008, [0, 0, 0], [0, 0, 0.75]); wp.applyMatrix4(new THREE.Matrix4().makeTranslation(0.12, 0.012, s * 0.14)); wp.applyMatrix4(m.clone().multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2))); gb.add('dark', wp);   // parked wiper
      }
    }
    // cab sides: each a wall with the sliding window, number under it; the carbody door behind
    for (const s of [-1, 1]) {
      const sw = new THREE.Shape(), top = RF - R;
      sw.moveTo(dx(CAB1), Y0); sw.lineTo(dx(WS1), Y0); sw.lineTo(dx(WS1), top); sw.lineTo(dx(CAB1), top); sw.closePath();
      const h = new THREE.Path(); h.moveTo(dx(2.5), 3.62); h.lineTo(dx(3.6), 3.62); h.lineTo(dx(3.6), 4.3); h.lineTo(dx(2.5), 4.3); h.closePath(); sw.holes.push(h);
      const g = new THREE.ShapeGeometry(sw); g.translate(0, 0, s * W); g.computeVertexNormals(); gb.add('upYel', g);
      const gi = new THREE.ShapeGeometry(sw); gi.translate(0, 0, s * (W - 0.01)); gb.add('dLining', gi);
      gb.add('glassT', new THREE.PlaneGeometry(1.1, 0.68), M(dx(3.05), 3.96, s * (W - 0.01)));
      box('upSilver', 3.04, 3.07, 3.62, 4.3, s * (W - 0.03), s * (W + 0.005));          // sash
      box('upSilver', 2.47, 3.63, 4.3, 4.33, s * (W - 0.01), s * (W + 0.05));           // drip rail
      gb.add(upNumberMat(num, false).uuid, new THREE.PlaneGeometry(0.7, 0.35), M(dx(3.05), 3.2, s * (W + 0.006), 0, s > 0 ? 0 : Math.PI, 0));
      // the door to the engine room behind the cab, its window and handle
      box('dark', 3.76, 3.79, 1.5, 4.12, s * W, s * (W + 0.006)); box('dark', 4.36, 4.39, 1.5, 4.12, s * W, s * (W + 0.006)); box('dark', 3.76, 4.39, 4.1, 4.13, s * W, s * (W + 0.006));
      box('glassT', 3.88, 4.27, 3.55, 4.0, s * W, s * (W + 0.004));
      box('upSilver', 4.27, 4.33, 2.78, 2.82, s * W, s * (W + 0.04));
      // the shield behind the door, lettering two lines high, the radiator windows, a second door at the rear
      gb.add(RMAT.upShield.uuid, new THREE.PlaneGeometry(0.95, 1.19), M(dx(5.0), 3.05, s * (W + 0.007), 0, s > 0 ? 0 : Math.PI, 0));
      gb.add(RMAT.upRoad1.uuid, new THREE.PlaneGeometry(7.4, 0.93), M(dx(8.75), 3.05, s * (W + 0.007), 0, s > 0 ? 0 : Math.PI, 0));   // UNION PACIFIC in one line, as on the cab units
      for (let k = 0; k < 6; k++) { const a0 = 12.95 + k * 0.66; box('upLouver', a0 + 0.04, a0 + 0.62, 1.92, 3.68, s * W, s * (W + 0.012)); box('dark', a0, a0 + 0.04, 1.88, 3.72, s * W, s * (W + 0.016)); }
      box('dark', 12.95 + 6 * 0.66, 12.99 + 6 * 0.66, 1.88, 3.72, s * W, s * (W + 0.016));
      box('dark', 17.1, 17.13, 1.5, 4.1, s * W, s * (W + 0.006)); box('dark', 17.7, 17.73, 1.5, 4.1, s * W, s * (W + 0.006));
      for (const [a0, a1] of [[5.8, 6.4], [10.6, 11.4], [18.6, 19.6]]) box('upLouver', a0, a1, 3.85, 4.25, s * W, s * (W + 0.01));   // engine room intakes high on the side
    }
    // nose: headlight under the roll of the nose, the winged shield, number boards on the corners, class lamps
    {
      const hy = 3.36;
      gb.cylX('upGray', 0.27, 0.25, 0.14, 24, dx(N0) + 0.05, hy, 0);
      const ln = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), RMAT.hlLens); ln.position.set(dx(N0) + 0.125, hy, 0); ln.rotation.y = Math.PI / 2; body.add(ln); out.lenses.push(ln); out.lens = ln;
      gb.add('upSilver', new THREE.TorusGeometry(0.215, 0.022, 6, 28).rotateY(Math.PI / 2).translate(dx(N0) + 0.125, hy, 0));
      gb.add(RMAT.upWings.uuid, new THREE.PlaneGeometry(1.86, 0.47), M(dx(N0) + 0.007, 2.15, 0, 0, Math.PI / 2, 0));
      for (const s of [-1, 1]) {
        const a = 0.66, z = hwA(a), d = (hwA(a + 0.02) - hwA(a - 0.02)) / 0.04, yaw = Math.atan2(1, d);   // the corner's facing in plan
        const nb = new THREE.PlaneGeometry(0.5, 0.18); nb.applyMatrix4(M(dx(a), 3.6, s * (z + 0.006), 0, s > 0 ? Math.PI / 2 - yaw : -(Math.PI / 2 - yaw) + Math.PI, 0));
        gb.add(upNumberMat(num, true).uuid, nb);
        gb.add('upSilver', new THREE.BoxGeometry(0.56, 0.24, 0.02), M(dx(a), 3.6, s * (z - 0.004), 0, s > 0 ? Math.PI / 2 - yaw : -(Math.PI / 2 - yaw), 0));
        gb.cyl('upSilver', 0.07, 0.07, 0.06, 12, dx(0.86), 3.86, s * (hwA(0.86) - 0.03));             // class lamp on the nose top
        gb.add('lensOff', new THREE.CircleGeometry(0.05, 12), M(dx(0.86) + 0.031, 3.86, s * (hwA(0.86) - 0.03), 0, Math.PI / 2, 0));
        gb.add('upSilver', barGeo(0.016, [dx(0.55), 2.2, s * (hwA(0.55) + 0.05)], [dx(0.62), 3.3, s * (hwA(0.62) + 0.05)], 6));    // nose grab irons on their standoffs
        for (const [a, y] of [[0.55, 2.2], [0.62, 3.3]]) gb.add('upSilver', barGeo(0.012, [dx(a), y, s * (hwA(a) - 0.01)], [dx(a), y, s * (hwA(a) + 0.06)], 6));
      }
    }
    // roof: horns on the cab roof (where they were delivered), cab heater, dynamic brake grids, radiator, aux diesel stack
    {
      const hx = 2.85, hy = RF + 0.02;
      box('upGray', hx - 0.12, hx + 0.12, RF - 0.02, hy + 0.1, -0.21, 0.21);   // the horn manifold
      for (const [Lh, r, dir, z] of [[0.62, 0.085, 1, -0.17], [0.5, 0.072, 1, 0], [0.42, 0.064, 1, 0.17], [0.55, 0.08, -1, -0.09], [0.46, 0.07, -1, 0.09]]) {   // Leslie S-5T-R: three bells ahead, two back
        const g = new THREE.CylinderGeometry(r, 0.03, Lh, 14, 1, true).rotateZ(dir * -Math.PI / 2); g.translate(dx(hx) + dir * Lh / 2, hy + 0.06, z); gb.add('upSilver', g);
      }
      box('upGray', 3.2, 3.55, RF - 0.02, RF + 0.18, -0.35, 0.35); box('grille', 3.22, 3.53, RF + 0.18, RF + 0.185, -0.3, 0.3);    // cab heater
      const grid = (a0, a1) => { box('upGray', a0, a1, RF - 0.05, GT.top - 0.15, -1.05, 1.05); box('grille', a0 + 0.05, a1 - 0.05, GT.top - 0.15, GT.top - 0.13, -1.0, 1.0); for (const s of [-1, 1]) box('grille', a0 + 0.05, a1 - 0.05, RF - 0.02, GT.top - 0.2, s * 1.05, s * 1.056); };
      grid(18.1 * FT_, 30.4 * FT_); grid(56.1 * FT_, 68.2 * FT_);
      box('upGray', 30.6 * FT_, 42.2 * FT_, RF - 0.05, RF + 0.08, -0.9, 0.9);                      // engine room hatch
      box('upGray', 42.4 * FT_, 55.4 * FT_, RF - 0.05, RF + 0.12, -1.1, 1.1);                      // radiator housing
      gb.add('dUnder', new THREE.CylinderGeometry(0.93, 0.93, 0.08, 30), M(dx(48.9 * FT_), RF + 0.15, 0)); gb.add('fan', new THREE.CircleGeometry(0.9, 30), M(dx(48.9 * FT_), RF + 0.195, 0, -Math.PI / 2, 0, 0));   // 72 in fan
      gb.cyl('dark', 0.13, 0.13, 0.22, 14, dx(40.9 * FT_), RF + 0.05, 0.35);                          // auxiliary diesel exhaust
    }
    // roof cap in gray from the windshield back
    gtLoft(gb, 'upGray', dx, [{ a: WS1, hw: W + 0.004, y0: RF - R - 0.002, top: RF + 0.004, r: R + 0.004 }, { a: len - 0.4, hw: W + 0.004, y0: RF - R - 0.002, top: RF + 0.004, r: R + 0.004 }], { skip: j => j <= 2 || j >= 17 });
    // fuel tank (2,500 gal) and air reservoirs under the frame
    {
      const t = new THREE.Shape(), w = 1.3, y0 = 0.45, y1 = GT.sill, r = 0.24;
      t.moveTo(-w, y1); t.lineTo(-w, y0 + r); t.quadraticCurveTo(-w, y0, -w + r, y0); t.lineTo(w - r, y0); t.quadraticCurveTo(w, y0, w, y0 + r); t.lineTo(w, y1); t.closePath();
      const g = new THREE.ExtrudeGeometry(t, { depth: 15.6 * FT_, bevelEnabled: false, curveSegments: 6 }); g.rotateY(Math.PI / 2); g.translate(dx(43.1 * FT_), 0, 0); gb.add('upFrame', g);
      for (const s of [-1, 1]) gb.cylX('dark', 0.2, 0.2, 2.4, 14, dx(9.7), 0.85, s * 0.95);
    }
    // the cab: floor, back wall, controls
    const FL = 2.62;
    box('dInt', WS0 - 0.4, CAB1 - 0.03, FL - 0.04, FL, -W + 0.03, W - 0.03);
    cab = turbineCab(gb, body, { dx, WS0, WS1, CAB1, FL, W, RF, uid: ++DG.uid });
    out.cabEye = cab.eye; out.cab = cab;
    out.headlightPos = new THREE.Vector3(dx(N0) + 0.13, 3.36, 0);
    out.hornPos = new THREE.Vector3(dx(2.85), RF + 0.1, 0);
    out.stackPos = new THREE.Vector3(dx(40.9 * FT_), RF + 0.17, 0.35);
    out.enginePos = new THREE.Vector3(dx(40 * FT_), 2.6, 0);
    out.cabLightPos = new THREE.Vector3(dx(3.0), RF - 0.35, 0);
    // bell under the frame, behind the pilot
    const bellA = 1.05, bp = GT.sill - 0.2;
    for (const z of [-0.2, 0.2]) box('dark', bellA - 0.035, bellA + 0.035, bp - 0.03, GT.sill + 0.005, z - 0.015, z + 0.015);   // hangers from the frame
    gb.cylZ('dSteel', 0.014, 0.43, 8, dx(bellA), bp, 0);                                                                      // trunnion shaft
    out.bellRig = bellRig(body, dx(bellA), bp, 0.55, 0.3);
    const beam = headBeam(dx(N0) + 0.1, 3.36); body.add(beam); out.beam = beam;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    halo.position.set(dx(N0) + 0.16, 3.36, 0); halo.scale.set(2.4, 2.4, 1); body.add(halo); out.halo = halo;
  } else {
    /* --- the turbine unit: a plain carbody, flat ends, the turbine's air intake and exhaust casing on the roof --- */
    const E0 = 0.4, E1 = len - 0.4;
    gtLoft(gb, 'upYel', dx, [{ a: E0, hw: W, y0: Y0, top: RF, r: R }, { a: E1, hw: W, y0: Y0, top: RF, r: R }], { capF: true, capB: true });
    gtLoft(gb, 'upGray', dx, [{ a: E0, hw: W + 0.004, y0: RF - R - 0.002, top: RF + 0.004, r: R + 0.004 }, { a: E1, hw: W + 0.004, y0: RF - R - 0.002, top: RF + 0.004, r: R + 0.004 }], { skip: j => j <= 2 || j >= 17 });
    for (const s of [-1, 1]) {
      // louvred panels and doors along the side, from the diagram
      for (const [a0, a1] of [[14.9, 18.8], [24.9, 28.1], [30.8, 34.4], [37.0, 44.9]]) { box('upLouver', a0 * FT_, a1 * FT_, 6.4 * FT_, 13.4 * FT_, s * W, s * (W + 0.012)); box('dark', a0 * FT_ - 0.03, a1 * FT_ + 0.03, 6.4 * FT_ - 0.03, 6.4 * FT_, s * W, s * (W + 0.016)); }
      for (const [a0, a1] of [[2.0, 3.8], [19.4, 23.1], [59.0, 61.0]]) { box('dark', a0 * FT_, a0 * FT_ + 0.03, 1.5, 4.1, s * W, s * (W + 0.006)); box('dark', a1 * FT_ - 0.03, a1 * FT_, 1.5, 4.1, s * W, s * (W + 0.006)); box('dark', a0 * FT_, a1 * FT_, 4.08, 4.11, s * W, s * (W + 0.006)); }
      gb.add(RMAT.upShield.uuid, new THREE.PlaneGeometry(0.95, 1.19), M(dx(10.6 * FT_), 3.0, s * (W + 0.007), 0, s > 0 ? 0 : Math.PI, 0));
      gb.add(upNumberMat(num + 'B', false).uuid, new THREE.PlaneGeometry(0.7, 0.35), M(dx(57 * FT_), 3.2, s * (W + 0.006), 0, s > 0 ? 0 : Math.PI, 0));
      for (let y = 2.0; y < 4.0; y += 0.32) box('dark', 54 * FT_, 55.2 * FT_, y, y + 0.06, s * W, s * (W + 0.01));     // exhaust casing vents
    }
    // roof: dynamic brake blowers, a hatch, the turbine air intake and silencer, engine room intakes, the exhaust casing
    box('upGray', 2.2 * FT_, 15.3 * FT_, RF - 0.05, GT.top - 0.12, -1.05, 1.05); box('grille', 2.4 * FT_, 15.1 * FT_, GT.top - 0.12, GT.top - 0.1, -1.0, 1.0);
    box('upGray', 15.8 * FT_, 21.3 * FT_, RF - 0.05, RF + 0.1, -1.0, 1.0);
    box('upGray', 21.5 * FT_, 36.3 * FT_, RF - 0.05, GT.top - 0.012, -1.3, 1.3);                                // inlet silencer
    for (const s of [-1, 1]) box('grille', 21.8 * FT_, 36.0 * FT_, RF + 0.02, GT.top - 0.05, s * 1.3, s * 1.306);
    for (let a = 22.5; a < 36; a += 1.6) box('dark', a * FT_, a * FT_ + 0.04, GT.top - 0.012, GT.top, -1.25, 1.25);
    box('upGray', 36.6 * FT_, 51 * FT_, RF - 0.05, RF + 0.1, -0.95, 0.95);
    // exhaust casing: it rises toward the rear and opens upward through a grate
    {
      const a0 = 51.7 * FT_, a1 = 61.6 * FT_, sh = new THREE.Shape();
      sh.moveTo(dx(a0), RF - 0.05); sh.lineTo(dx(a1), RF - 0.05); sh.lineTo(dx(a1), GT.top); sh.lineTo(dx(a0 + 0.9), GT.top - 0.05); sh.lineTo(dx(a0), RF + 0.06); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: 2.4, bevelEnabled: false }); g.translate(0, 0, -1.2); gb.add('upGray', g);
      box('dark', a0 + 1.1, a1 - 0.15, GT.top - 0.04, GT.top + 0.003, -1.0, 1.0);      // the outlet, sooty
      for (let a = a0 + 1.2; a < a1 - 0.15; a += 0.22) box('steel', a, a + 0.04, GT.top - 0.02, GT.top + 0.008, -0.98, 0.98);
    }
    // underframe tanks: lube oil, fuel processing
    box('upFrame', 26 * FT_, 40 * FT_, 0.55, GT.sill, -1.15, 1.15);
    out.hornPos = new THREE.Vector3(dx(5), RF, 0);
    out.stackPos = new THREE.Vector3(dx(57.5 * FT_), GT.top + 0.1, 0);
    out.enginePos = new THREE.Vector3(dx(40 * FT_), 2.6, 0);
    out.exhaust = { a0: 52.8 * FT_, a1: 61.4 * FT_, w: 2.0, y: GT.top + 0.02 };
    // back-up light high on the rear end
    gb.cylX('upGray', 0.15, 0.14, 0.12, 18, dx(E1) - 0.06, 4.15, 0);
    const bl = new THREE.Mesh(new THREE.CircleGeometry(0.11, 18), RMAT.lensOff); bl.position.set(dx(E1) - 0.125, 4.15, 0); bl.rotation.y = -Math.PI / 2; body.add(bl); out.backup = bl;
  }
  out.couplers = gtUnderframe(gb, body, len, dx, { front: B ? 'end' : 'nose' });
  // material keys added by uuid (the per-number decals) go in by their own material
  const mats = { ...RMAT }; for (const m of [RMAT.upShield, RMAT.upRoad1, RMAT.upRoad2, RMAT.upWings, upNumberMat(num, true), upNumberMat(num, false), upNumberMat(num + 'B', false)]) mats[m.uuid] = m;
  if (cab) for (const k in cab.mats || {}) mats[k] = cab.mats[k];
  body.add(gb.build(mats));
  for (let t = 0; t < 2; t++) out.trucks.push(gtTruck(out.wheels));
  const hit = new THREE.Mesh(new THREE.BoxGeometry(len - 0.8, 4.4, 3.2), RMAT.hit); hit.position.set(0, 2.5, 0); body.add(hit);
  root.traverse(o => { if (o.isMesh && o.material !== RMAT.glassT && o.material !== RMAT.hit && !o.userData.cpl) { o.castShadow = true; o.receiveShadow = true; } });
  if (out.beam) out.beam.castShadow = false;
  return out;
}

/* ---------------- the 24,384 gallon fuel tender ---------------- */
function buildTurbineTender(num = GT.num) {
  turbineMaterials();
  const D = GTT, L = D.len, dx = a => L / 2 - a, root = new THREE.Group(), gb = new GeoBin();
  const box = (k, a0, a1, y0, y1, z0, z1) => gb.box(k, Math.abs(a1 - a0), Math.abs(y1 - y0), Math.abs(z1 - z0), dx((a0 + a1) / 2), (y0 + y1) / 2, (z0 + z1) / 2);
  const hw = D.hw, A0 = D.a0, A1 = L - D.a0, T = D.tank;
  // the jacketed tank: its top corners rolled, the ends sloped back at the top as the FEF tender's were
  const st = [{ a: A0, top: T - 0.55 }, { a: A0 + 0.25, top: T - 0.2 }, { a: A0 + 0.55, top: T }, { a: A1 - 0.75, top: T }, { a: A1 - 0.4, top: T - 0.3 }, { a: A1, top: T - 0.7 }].map(s => ({ a: s.a, hw, y0: D.y0, top: s.top, r: 0.32 }));
  gtLoft(gb, 'upYel', dx, st, { capF: true, capB: true });
  box('upFrame', 0.32, L - 0.32, 1.0, D.y0, -hw + 0.03, hw - 0.03);                                  // underframe
  box('upRed', A0, A1, D.y0, D.y0 + 0.035, -hw - 0.004, hw + 0.004);
  for (const a of [D.tc, L - D.tc]) box('dark', a - 0.45, a + 0.45, 1.0 - 0.1, 1.02, -1.15, 1.15);   // bolsters down onto the trucks
  for (const s of [-1, 1]) {
    // the smooth insulation jacket: the six heater access plates, lettering
    for (let k = 0; k < 6; k++) { const a = 1.6 + k * 2.0; gb.add('upFrame', new THREE.CylinderGeometry(0.2, 0.2, 0.03, 18).rotateX(Math.PI / 2).scale(1.25, 0.8, 1), M(dx(a), 1.92, s * (hw + 0.012))); }
    gb.add(RMAT.upRoad1.uuid, new THREE.PlaneGeometry(9.2, 1.15), M(dx(L / 2), 3.1, s * (hw + 0.006), 0, s > 0 ? 0 : Math.PI, 0));
    // ladders at both ends up to the runboard
    for (const a of [A0 + 0.18, A1 - 0.18]) {
      for (const d of [-0.2, 0.2]) gb.add('upSilver', barGeo(0.015, [dx(a + d), 0.5, s * (hw + 0.07)], [dx(a + d), T + 0.4, s * (hw + 0.07)], 6));
      for (let y = 0.6; y < T; y += 0.38) gb.add('upSilver', barGeo(0.013, [dx(a - 0.2), y, s * (hw + 0.07)], [dx(a + 0.2), y, s * (hw + 0.07)], 6));
      for (const y of [1.6, 3.2]) box('upSilver', a - 0.22, a + 0.22, y - 0.02, y + 0.02, s * (hw - 0.01), s * (hw + 0.08));
    }
  }
  // runboard and its railings along the top, fuel fill hatch
  box('upFrame', A0 + 0.6, A1 - 0.8, T - 0.02, D.run, -0.38, 0.38);
  for (const s of [-1, 1]) {
    const z = s * 0.62;
    gb.add('upSilver', barGeo(0.02, [dx(A0 + 0.75), D.rail, z], [dx(A1 - 0.95), D.rail, z], 6));
    for (let a = A0 + 0.75; a <= A1 - 0.9; a += (A1 - A0 - 1.7) / 9) gb.add('upSilver', barGeo(0.016, [dx(a), T - 0.06, z], [dx(a), D.rail, z], 6));
  }
  gb.cyl('upFrame', 0.32, 0.32, 0.12, 18, dx(5.6), T + 0.05, 0.75);   // fuel filling hatch
  // back-up light on the rear end
  gb.cylX('upGray', 0.15, 0.14, 0.12, 18, dx(A1) - 0.05, T - 0.95, 0);
  const bl = new THREE.Mesh(new THREE.CircleGeometry(0.11, 18), RMAT.lensOff); bl.position.set(dx(A1) - 0.115, T - 0.95, 0); bl.rotation.y = -Math.PI / 2;
  // end sills and couplers
  for (const e of [0, 1]) { const a = e ? L - 0.32 : 0.32, sg = e ? -1 : 1; box('upFrame', a - 0.06 * sg, a + 0.06 * sg, 0.72, D.y0, -1.4, 1.4); }
  const couplers = carCouplers(gb, root, L, -0.32, 0.72, 1.12);
  const mats = { ...RMAT }; mats[RMAT.upRoad1.uuid] = RMAT.upRoad1;
  root.add(gb.build(mats)); root.add(bl);
  root.traverse(o => { if (o.isMesh && !o.userData.cpl) { o.castShadow = true; o.receiveShadow = true; } });
  return { root, len: L, trucks: [D.tc, L - D.tc].map(a => ({ a, type: 'buck', R: D.R, sp: D.sp })), frame: [D.tc, L - D.tc], weight: GTT_EMPTY, kind: 'fueltender', axles: 6, area: 0, couplers, backup: bl, number: num };
}
const GTT_EMPTY = 171000 * 0.4536;   // 24-C-GTE tender light weight, lb (about 610 tons with the units and a full tender)

/* ---------------- the cab: GE control stand of the 1950s, gauges on the panel, 20-notch throttle ---------------- */
function turbineCab(gb, body, d) {
  const K = new CabKit(gb, body), dx = d.dx, FL = d.FL, wallZ = d.W - 0.04;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const box = (k, a0, a1, y0, y1, z0, z1) => gb.box(k, Math.abs(a1 - a0), Math.abs(y1 - y0), Math.abs(z1 - z0), dx((a0 + a1) / 2), (y0 + y1) / 2, (z0 + z1) / 2);
  const eye = V(dx(2.95), FL + 1.56, 0.72);
  // lining: walls, ceiling, back wall with the door into the engine room
  box('dLining', d.WS1 - 0.1, d.CAB1, FL, 3.6, -wallZ, -wallZ + 0.02); box('dLining', d.WS1 - 0.1, d.CAB1, FL, 3.6, wallZ - 0.02, wallZ);
  box('dLining', d.WS1 - 0.4, d.CAB1, d.RF - 0.26, d.RF - 0.24, -wallZ, wallZ);
  box('dLining', d.CAB1 - 0.03, d.CAB1, FL, d.RF - 0.24, -wallZ, wallZ);
  box('dUnder', d.CAB1 - 0.045, d.CAB1 - 0.03, FL + 0.05, FL + 1.95, -0.45, 0.25);
  box('dMat', d.WS0, d.CAB1 - 0.03, FL, FL + 0.008, -wallZ, wallZ);
  // the gauge panel under the windshield sill, tipped back toward the engineer's eye, on a console filling the nose
  const aP = 2.02, yP = 3.7, tilt = -0.46, pn = V(-Math.cos(tilt), -Math.sin(tilt), 0);
  box('dDesk', d.WS0 - 0.35, aP - 0.02, FL, yP - 0.2, -wallZ + 0.05, wallZ - 0.05);
  gb.add('dDesk', new THREE.BoxGeometry(0.03, 0.4, 2 * wallZ - 0.12), M(dx(aP), yP, 0, 0, 0, tilt));
  box('dDesk', d.WS0 - 0.1, aP + 0.05, yP + 0.17, yP + 0.2, -wallZ + 0.05, wallZ - 0.05);           // glare shield over the gauges
  const at = z => V(dx(aP), yP, z).addScaledVector(pn, 0.016);
  const dials = [
    { kind: 'speed', p: at(0.95), r: 0.1, hands: [[() => Math.abs(S.v) / MPH]], read: CAB_READ.speed },
    { kind: 'load', p: at(0.68), r: 0.1, hands: [[() => Math.max(0, S.amps)]], read: () => `Load meter · ${Math.round(Math.max(0, S.amps))} A${S.dyn > 0.06 ? ' · dynamic brake ' + Math.round(S.dbLoad * 100) + '%' : ''}` },
    { kind: 'tspd', p: at(0.42), r: 0.085, hands: [[() => S.tspd * 100]], read: () => `Turbine speed · ${Math.round(S.tspd * GTE.rpm)} rpm${S.tStart > 0 ? ' · starting' : ''}` },
    { kind: 'egt', p: at(0.18), r: 0.085, hands: [[() => S.egt]], read: () => `Exhaust temperature · ${Math.round(S.egt)} °F` },
    { kind: 'mreq', p: at(-0.12), r: 0.09, hands: [[() => S.MR, true], [() => S.ER]], read: CAB_READ.mreq },
    { kind: 'bpbc', p: at(-0.38), r: 0.09, hands: [[() => GAME.train ? GAME.train.lead.brake.BP : 90], [() => S.BCloco || 0, true]], read: () => CAB_READ.bpbc(GAME.train) },
  ];
  for (const o of dials) K.dial(Object.assign({ n: pn, depth: 0.04 }, o));
  // control stand on the engineer's left, as on the diesels of the day: brake valves forward, throttle and dynamic brake facing him
  const A0 = 2.35, A1 = 3.2, Am = 2.9, z0 = 0.26, z1 = 0.5, yLow = FL + 0.88, yHigh = FL + 1.02;
  box('dDesk', A0, A1, FL, yLow, z0, z1);
  box('dDesk', A0, Am, yLow - 0.01, yHigh, z0, z1);
  box('dSteel', A0 + 0.03, Am - 0.02, yHigh, yHigh + 0.04, z0 - 0.02, z1 + 0.02);
  {
    const pa = K.part(V(dx(A0 + 0.22), yHigh + 0.04, 0.34));
    pa.gb.cyl('dSteel', 0.03, 0.035, 0.04, 14, 0, 0.02, 0); pa.gb.box('handle', 0.2, 0.02, 0.026, -0.1, 0.03, 0); pa.gb.cyl('knob', 0.02, 0.02, 0.06, 10, -0.2, 0.05, 0);
    K.done(pa);
    const c = K.ctl({ id: 'brake', name: 'Automatic brake', kind: 'lever', part: pa.inner, outer: pa.outer, grip: V(-0.2, 0.05, 0), show: () => S.brakeH, p: () => ctlTravel(CTL.brake, false), setP: p => { ctlSetTravel(CTL.brake, false, p); GAME.controlTouched('lvBrake'); },
      pose: p => { pa.inner.rotation.y = 0.35 - 1.6 * p; }, label: () => 'Automatic brake · ' + CTL.brake.label(S.brakeH) });
    K.hit(pa, c, 0.12, 0.08, 0.08, -0.17, 0.05, 0);
  }
  {
    const bxx = dx(A0 + 0.4); gb.cyl('dSteel', 0.035, 0.035, 0.08, 14, bxx, yHigh + 0.08, 0.46);
    const pi = K.part(V(bxx, yHigh + 0.12, 0.46));
    pi.gb.cyl('dSteel', 0.03, 0.03, 0.03, 12, 0, 0, 0); pi.gb.box('handle', 0.15, 0.018, 0.024, -0.075, 0.01, 0); pi.gb.cyl('knob', 0.018, 0.018, 0.05, 10, -0.15, 0.03, 0);
    K.done(pi);
    const c = K.ctl({ id: 'ind', name: 'Independent brake', kind: 'lever', part: pi.inner, outer: pi.outer, grip: V(-0.15, 0.03, 0), show: () => S.indH, p: () => ctlTravel(CTL.ind, false), setP: p => { ctlSetTravel(CTL.ind, false, p); GAME.controlTouched('lvInd'); },
      pose: p => { pi.inner.rotation.y = 0.4 - 1.3 * p; }, label: () => 'Independent brake · ' + CTL.ind.label(S.indH) });
    K.hit(pi, c, 0.06, 0.07, 0.06, -0.15, 0.03, 0);
  }
  const plateD = (y, ticks) => {
    const s = new THREE.Shape(); s.absarc(0, 0, 0.17, -Math.PI / 2, Math.PI / 2, false); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.014, bevelEnabled: false, curveSegments: 16 }); g.rotateX(Math.PI / 2); g.rotateY(-Math.PI / 2); g.translate(dx(Am + 0.03), y, z1); gb.add('dSteel', g);
    for (let i = 0; i <= ticks; i++) { const a = i / ticks * 0.95; gb.box('dUnder', 0.004, 0.004, 0.03, dx(Am + 0.03) - Math.sin(a) * 0.15, y + 0.002, z1 + Math.cos(a) * 0.15, 0, -a, 0); }
  };
  const handleOut = (y, len, knobKey) => { const pt = K.part(V(dx(Am + 0.03), y, z1)); pt.gb.cyl('dSteel', 0.022, 0.022, 0.03, 10, 0, 0, 0.01); pt.gb.box('handle', 0.024, 0.02, len, 0, 0, len / 2); pt.gb.cyl(knobKey, 0.022, 0.022, 0.07, 10, 0, 0.02, len); return pt; };
  {
    plateD(yLow - 0.11, 20);
    const pt = handleOut(yLow - 0.09, 0.22, 'knob'); K.done(pt);
    const c = K.ctl({ id: 'throttle', name: 'Throttle', kind: 'lever', part: pt.inner, outer: pt.outer, grip: V(0, 0.02, 0.22), show: () => S.throttle, p: () => ctlTravel(CTL.throttle, true), setP: p => { ctlSetTravel(CTL.throttle, true, p); GAME.controlTouched('lvThrottle'); },
      pose: p => { pt.inner.rotation.y = -p * 0.95; }, label: () => 'Throttle · ' + CTL.throttle.label(S.throttle) });
    K.hit(pt, c, 0.09, 0.08, 0.14, 0, 0.01, 0.17);
  }
  // the turbine control switch, below the throttle: the one control that starts and stops the turbine
  {
    box('dUnder', Am - 0.05, Am + 0.12, yLow - 0.36, yLow - 0.28, z1, z1 + 0.012);
    const pt = K.part(V(dx(Am + 0.035), yLow - 0.32, z1 + 0.012));
    pt.gb.box('redKnob', 0.05, 0.03, 0.03, 0, 0, 0.015); pt.gb.box('handle', 0.012, 0.05, 0.012, 0, 0.012, 0.03); K.done(pt);
    const c = K.ctl({ id: 'turbine', name: 'Turbine control', kind: 'toggle', part: pt.inner, outer: pt.outer, grip: V(0, 0, 0.02), show: () => (S.tOn ? 1 : 0),
      pose: p => { pt.inner.rotation.z = (p - 0.5) * 1.1; }, tap: () => turbineSwitch(), label: () => 'Turbine control · ' + turbineState() });
    K.hit(pt, c, 0.08, 0.08, 0.06, 0, 0, 0.02);
  }
  {
    plateD(yLow - 0.5, 2);
    const pt = handleOut(yLow - 0.48, 0.18, 'redKnob'); K.done(pt);
    const c = K.ctl({ id: 'dyn', name: 'Dynamic brake', kind: 'lever', part: pt.inner, outer: pt.outer, grip: V(0, 0.02, 0.18), show: () => S.dyn, p: () => ctlTravel(CTL.dyn, false), setP: p => { ctlSetTravel(CTL.dyn, false, p); GAME.controlTouched('lvDyn'); },
      pose: p => { pt.inner.rotation.y = -p * 0.95; }, label: () => 'Dynamic brake · ' + CTL.dyn.label(S.dyn) });
    K.hit(pt, c, 0.09, 0.08, 0.12, 0, 0.01, 0.14);
  }
  {
    box('dSteel', Am + 0.02, Am + 0.18, yLow, yLow + 0.04, 0.32, 0.44);
    const pt = K.part(V(dx(Am + 0.1), yLow + 0.03, 0.38));
    pt.gb.box('handle', 0.02, 0.15, 0.03, 0, 0.075, 0); pt.gb.box('knob', 0.05, 0.035, 0.04, 0, 0.15, 0); K.done(pt);
    const c = K.ctl({ id: 'reverser', name: 'Reverser', kind: 'lever', part: pt.inner, outer: pt.outer, grip: V(0, 0.15, 0), show: () => S.reverser, p: () => ctlTravel(CTL.reverser, false), setP: p => { ctlSetTravel(CTL.reverser, false, p); GAME.controlTouched('lvReverser'); },
      pose: v => { pt.inner.rotation.z = -v * 0.42; }, label: () => 'Reverser · ' + CTL.reverser.label(S.reverser) });
    c.poseP = p => c.pose(1 - 2 * p);
    K.hit(pt, c, 0.08, 0.12, 0.07, 0, 0.12, 0);
  }
  // horn valve: a cord handle hung from the ceiling over the engineer's window
  {
    const ph = K.part(V(dx(2.7), d.RF - 0.27, wallZ - 0.12));
    ph.gb.add('dark', barGeo(0.004, [0, 0, 0], [0, -0.32, 0], 5)); ph.gb.box('knob', 0.03, 0.08, 0.03, 0, -0.36, 0); K.done(ph);
    const h = K.ctl({ id: 'horn', name: 'Horn', kind: 'hold', part: ph.inner, outer: ph.outer, grip: V(0, -0.36, 0), show: () => S.whistle > 0.02 ? whistleToPull(S.whistle) : 0, p: () => whistleToPull(S.whistle || 0.62), setP: p => { S.whistle = pullToWhistle(p); },
      pose: p => { ph.inner.position.y = -p * 0.08; }, press: () => { S.whistle = 0.62; }, release: () => { S.whistle = 0; }, label: () => 'Horn · pull down for more' });
    K.hit(ph, h, 0.08, 0.14, 0.08, 0, -0.36, 0);
  }
  // switches on the panel's right: headlight, bell, sander, auxiliary diesel
  {
    const defs = [
      { id: 'light', name: 'Headlight', get: () => S.light / 2, tap: () => { S.light = (S.light + 1) % 3; }, txt: () => ['off', 'dim', 'bright'][S.light] },
      { id: 'bell', name: 'Bell', get: () => S.bell ? 1 : 0, tap: () => { S.bell = !S.bell; }, txt: () => S.bell ? 'ringing' : 'off' },
      { id: 'sander', name: 'Sander', get: () => S.sander ? 1 : 0, tap: () => { S.sander = !S.sander; }, txt: () => S.sander ? 'sanding' : 'off' },
      { id: 'engine', name: 'Auxiliary diesel', get: () => (S.engineRun || S.crank > 0) ? 1 : 0, tap: () => { const b = $('btnInj'); if (b) b.click(); }, txt: () => S.crank > 0 ? 'cranking' : (S.engineRun ? 'running' : 'shut down') },
    ];
    defs.forEach((o, i) => {
      const p = at(1.2 + 0 * i).add(V(0, 0.05 - i * 0.075, 0)); p.z = 1.22;
      const pt = K.part(p.clone().add(V(0.02, 0.02, 0))); pt.outer.rotation.z = Math.PI / 4;
      pt.gb.box(o.id === 'engine' ? 'redKnob' : 'knob', 0.03, 0.022, 0.02, 0, 0, 0.0); pt.gb.box('handle', 0.008, 0.024, 0.006, 0, 0.0, 0.012); K.done(pt);
      const c = K.ctl({ id: o.id, name: o.name, kind: 'toggle', part: pt.inner, outer: pt.outer, grip: V(0, 0, 0.02), show: o.get, pose: q => { pt.inner.rotation.x = (q - 0.5) * 0.9; }, tap: o.tap, label: () => o.name + ' · ' + o.txt() });
      K.hit(pt, c, 0.07, 0.07, 0.06, 0, 0, 0.02);
    });
  }
  // seats
  const seatTop = eye.y - 0.76;
  for (const sd of [-1, 1]) cabChair(gb, 'dSeat', dx(3.05), sd * 0.78, seatTop, FL);
  return K.out(eye, { look: [{ yaw: 0.0, pitch: -0.12 }, { yaw: 0.42, pitch: -0.5 }] });
}

/* ---------------- the turbine's running state, shared by physics, cab and HUD ---------------- */
const GTE = { rpm: 4860, idle: 0.75, crank: 0.16, lite: 0.2, egtIdle: 520, egtMax: 850, startT: 45, cool: 750 / 4860 };
function turbineState() {
  if (S.tStart > 0) return S.tspd < GTE.lite ? 'cranking' : 'lighting off';
  if (S.tOn) return S.oil > 0 ? 'running' : 'flamed out';
  return S.tspd > GTE.cool + 0.02 ? 'running down' : 'cool-down crank';
}
/* the turbine control switch: start (cranked by the auxiliary diesel motoring No. 1 generator), or shut down */
function turbineSwitch() {
  if (S.tOn || S.tStart > 0) { S.tOn = false; S.tStart = 0; toast('Turbine shut down: purging on diesel fuel, then cool-down crank.', 'warn', 3200, 'eng'); return; }
  if (!S.engineRun) { toast('Start the auxiliary diesel first: it cranks the turbine.', 'warn', 3000, 'eng'); return; }
  if (S.oil <= 0) { toast('The fuel tender is dry.', 'bad', 3000, 'eng'); return; }
  S.tStart = GTE.startT; toast('Starting the turbine: cranking on No. 1 generator, then light-off on diesel fuel.', '', 3600, 'eng');
}

/* The turbine-electric on the rails. A single-shaft turbine: the throttle's 20 notches set the shaft speed (the
   governor holds it from idle at three quarters speed to full at 4,860 rpm) and the generator excitation together,
   so the power comes up as the shaft does. 7,000 hp reaches the rail of 8,500 at the shaft; the DC traction motors
   start at 212,312 lbf and hold 146,000 lbf continuous at 18 mph. Without the turbine the 850 hp auxiliary diesel
   can move the engine light. The aux diesel cranks the turbine by motoring No. 1 generator to about a fifth
   speed, it lights off on diesel fuel and runs up to idle, then burns Bunker C from the tender. The turbine is
   purged on diesel fuel at shutdown and cranked at 750 rpm while it cools. Returns the total tractive effort. */
const GTP = { P: 7000 * 745.7, TE: 212312 * 4.448, aux: 600 * 745.7, auxTE: 140e3, DB: 240e3, DBP: 2.3e6, vmax: 65, oilFull: 24384 * 3.785, dslFull: 2500 * 3.785 };
function turbinePower(dt, spec) {
  const notch = Math.round(S.throttle * 20); S.notch = notch;
  const dir = S.reverser > 0.5 ? 1 : (S.reverser < -0.5 ? -1 : 0);
  const v = Math.abs(S.v), nf = notch / 20, dynOn = S.dyn > 0.06;
  // the auxiliary diesel: cranked on batteries like any diesel
  if (S.crank > 0) {
    S.crank -= dt; S.rpm = Math.min(110, S.rpm + 45 * dt);
    if (S.crank <= 0) { S.crank = 0; S.engineRun = true; S.rpm = 330; GAME.event('started'); }
  }
  if (S.fuel <= 0 && S.engineRun) { S.engineRun = false; GAME.event('noFuel'); }
  if (dynOn && notch > 0) GAME.event('dynInterlock');
  // the turbine shaft
  if (S.tStart > 0) {
    if (!S.engineRun) { S.tStart = 0; GAME.event('tAbort'); }
    else if (S.tspd < GTE.lite) S.tspd = Math.min(GTE.lite, S.tspd + dt * GTE.lite / 16);                       // cranking on No. 1 generator
    else { S.tspd += dt * (GTE.idle - GTE.lite) / 24; if (S.tspd >= GTE.idle) { S.tspd = GTE.idle; S.tStart = 0; S.tOn = true; GAME.event('turbineOn'); } }   // lit, accelerating on its own
  } else if (S.tOn) {
    if (S.oil <= 0) { S.tOn = false; GAME.event('flameOut'); }
    const tT = GTE.idle + (1 - GTE.idle) * (dynOn ? 0 : nf);
    S.tspd += clamp(tT - S.tspd, -0.03 * dt, 0.022 * dt);
  } else {
    // running down; the aux diesel turns it over at cool-down speed
    const tT = S.engineRun ? GTE.cool : 0;
    S.tspd += clamp(tT - S.tspd, -0.012 * dt, 0.02 * dt);
  }
  S.tspd = clamp(S.tspd, 0, 1.02);
  const turb = S.tOn && S.tStart <= 0, aux = !turb && S.engineRun && S.tStart <= 0;
  const powerOK = (turb || aux) && notch > 0 && dir !== 0 && !dynOn;
  S.load += clamp((powerOK ? 1 : 0) - S.load, -0.7 * dt, 0.12 * dt);
  const gov = 1 - smooth((GTP.vmax - 1.5) * MPH, (GTP.vmax + 1) * MPH, v);    // the motors' top speed
  let P, TEcap;
  if (turb) { const shaft = clamp((S.tspd - 0.7) / 0.3, 0, 1); P = GTP.P * Math.min(Math.pow(nf, 1.1), shaft) * S.load * gov; TEcap = GTP.TE * Math.min(1, nf * 1.6) * S.load * gov; }
  else { P = GTP.aux * Math.min(1, nf * 3) * S.load * gov; TEcap = GTP.auxTE * Math.min(1, nf * 3) * S.load; }
  const TE = S.load > 0.01 ? Math.min(TEcap, P / Math.max(v, 0.35)) : 0;
  // dynamic brake grids in both units, excited from the auxiliary generator; it fades out below about 9 mph
  const dbMax = Math.min(GTP.DB, GTP.DBP / Math.max(v, 0.1)) * smooth(1.8, 4.2, v);
  S.dbLoad += clamp((dynOn && S.engineRun ? (S.dyn - 0.06) / 0.94 : 0) - S.dbLoad, -0.8 * dt, 0.3 * dt);
  S.DBF = dbMax * S.dbLoad;   // per unit
  // fuel: Bunker C to the turbine, about 860 gal an hour flat out and a third of that at idle; diesel fuel to the aux engine and for starting
  const tw = TE * v;
  if (turb) S.oil = Math.max(0, S.oil - (0.3 + 0.7 * clamp(tw / GTP.P, 0, 1)) * 0.91 * (S.tspd / 1) * dt);
  const Paux = S.engineRun ? (aux ? tw / 0.85 : 0) + 60e3 + (S.tStart > 0 ? 300e3 : 0) + S.dbLoad * 80e3 : 0;
  S.fuel = Math.max(0, S.fuel - (Paux * 0.25 / 3.6e6 + (S.tStart > 0 && S.tspd >= GTE.lite ? 0.06 : 0)) * dt);
  let rpmT = 0;
  if (S.engineRun) rpmT = S.tStart > 0 ? 1000 : aux && powerOK ? 450 + 550 * Math.min(1, nf * 3) : dynOn ? 700 : 450;
  else if (S.crank > 0) rpmT = 110;
  S.rpm += clamp(rpmT - S.rpm, -75 * dt, 60 * dt);
  // exhaust temperature: the control holds it under about 850 °F at full load
  const egtT = turb ? GTE.egtIdle + (GTE.egtMax - 15 - GTE.egtIdle) * Math.pow(clamp(tw / GTP.P, 0, 1), 0.8) + 30 * (S.tspd - GTE.idle) : S.tStart > 0 && S.tspd >= GTE.lite ? 760 : 90 + 300 * S.tspd;
  S.egt += (egtT - S.egt) * Math.min(1, dt / (egtT > S.egt ? 4 : 14));
  S.amps = TE / GTP.TE * 1400 - S.DBF / GTP.DB * 700;
  S.turbo = S.engineRun ? 0.15 + 0.6 * S.rpm / 1000 : 0;
  S.Psc = 0; S.cut = 0; S.use = 0;
  return dir * TE;
}
/* the fuel tender's weight: light, plus the Bunker C aboard (0.97 kg a litre) */
const turbineTenderMass = (train, st = S) => train.tenderEmpty + Math.max(0, st.oil || 0) * 0.97;

/* ---------------- exhaust: smoke at light-off, a haze and the heat shimmering over the B unit's roof ----------------
   The shimmer is the scene behind it, bent: just before the column of hot air is drawn, the patch of the frame it
   covers is copied to a texture, and the column draws that patch back with its pixels pushed about by rising ripples. */
const GT_SHIM = 512;
function turbineShimmer(B) {
  const ex = B.exhaust, x = B.len / 2 - (ex.a0 + ex.a1) / 2, H = 6.5;
  const tex = new THREE.DataTexture(new Uint8Array(GT_SHIM * GT_SHIM * 3), GT_SHIM, GT_SHIM, THREE.RGBFormat);
  tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const mat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: tex }, rect: { value: new THREE.Vector4(0, 0, GT_SHIM, GT_SHIM) }, t: { value: 0 }, k: { value: 0 }, amp: { value: 4 } },
    vertexShader: `#include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vL; varying vec3 vN; varying vec3 vV;
      void main() { vL = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <logdepthbuf_pars_fragment>
      uniform sampler2D tex; uniform vec4 rect; uniform float t, k, amp; varying vec3 vL; varying vec3 vN; varying vec3 vV;
      void main() {
        #include <logdepthbuf_fragment>
        float h = clamp(vL.y / ${H.toFixed(1)} + 0.5, 0.0, 1.0);
        float fade = smoothstep(0.0, 0.06, h) * pow(1.0 - h, 1.6) * pow(abs(dot(normalize(vN), normalize(vV))), 1.5) * k;
        vec2 n = vec2(sin(vL.y * 6.0 - t * 15.0 + vL.x * 4.0) + 0.5 * sin(vL.y * 13.0 - t * 27.0 + vL.z * 7.0),
                      cos(vL.y * 8.0 - t * 18.0 + vL.z * 5.0) + 0.5 * cos(vL.y * 17.0 - t * 31.0 + vL.x * 6.0));
        vec2 uv = (gl_FragCoord.xy + n * amp * fade - rect.xy) / rect.zw;
        if (fade < 0.004 || uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) discard;
        gl_FragColor = vec4(texture2D(tex, uv).rgb, min(1.0, fade * 3.0));
      }`,
    transparent: true, depthWrite: false,
  });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.5, H, 18, 1, true), mat);
  m.position.set(x, ex.y + H / 2, 0); m.scale.set((ex.a1 - ex.a0) / 2 / 1.2, 1, ex.w / 2 / 1.2);
  m.renderOrder = 20; m.frustumCulled = true; m.castShadow = false; m.receiveShadow = false; m.visible = false;
  m.userData.noCheck = true; m.raycast = () => {};
  const box = new THREE.Box3(), P = new THREE.Vector3(), sz = new THREE.Vector2(), at = new THREE.Vector2();
  m.onBeforeRender = (renderer, scene, camera) => {
    // the patch of the frame under the column, at most GT_SHIM pixels square
    renderer.getDrawingBufferSize(sz);
    m.geometry.computeBoundingBox(); box.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < 8; i++) {
      P.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
      const px = (P.x + 1) / 2 * sz.x, py = (P.y + 1) / 2 * sz.y; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    const big = Math.max(x1 - x0, y1 - y0);
    if (sz.x < GT_SHIM || sz.y < GT_SHIM || big > GT_SHIM * 1.6) { mat.uniforms.k.value = 0; return; }
    at.set(Math.round(clamp((x0 + x1) / 2 - GT_SHIM / 2, 0, sz.x - GT_SHIM)), Math.round(clamp((y0 + y1) / 2 - GT_SHIM / 2, 0, sz.y - GT_SHIM)));
    renderer.copyFramebufferToTexture(at, tex);
    mat.uniforms.rect.value.set(at.x, at.y, GT_SHIM, GT_SHIM);
    mat.uniforms.amp.value = clamp(big / 40, 1.5, 9) * (big > GT_SHIM ? GT_SHIM * 1.6 / big - 0.6 : 1);
  };
  B.body.add(m);
  return m;
}
let gtPuff = 0, gtNotch = 0, gtLit = false, gtT = 0, gtAuxT = 0, gtCrankT = 0, gtPumpT = 0;
function turbineFX(dt, T, tv) {
  const A = T.units[0], B = T.units[1], ex = B.exhaust;
  const lit = S.tOn || (S.tStart > 0 && S.tspd >= GTE.lite);
  if (lit && !gtLit && S.tStart > 0) gtPuff = 4;          // light-off: a black cloud of unburnt fuel
  gtLit = lit;
  if (S.notch > gtNotch && lit) gtPuff = Math.min(2.5, gtPuff + 0.45);
  gtNotch = S.notch; gtPuff = Math.max(0, gtPuff - dt);
  const burn = lit ? 0.3 + 0.7 * clamp(Math.abs(S.TE * S.v) / GTP.P, 0, 1) : 0;
  const near = T.unitWorld(B, B.enginePos).distanceTo(camera.position);
  gtT += dt;
  if (gtT > 0.05 && (lit || S.tspd > 0.15) && near < 1500) {
    gtT = 0;
    const dark = Math.min(1, gtPuff * 0.35), gv = lerp(0.6, 0.09, dark);
    const a = (lit ? 0.025 + 0.045 * burn : 0.015) + 0.55 * dark;   // a clean-burning turbine leaves only a thin haze
    for (let n = dark > 0.2 ? 3 : 1; n > 0; n--) {
      const p = T.unitWorld(B, new THREE.Vector3(B.len / 2 - lerp(ex.a0, ex.a1, Math.random()), ex.y, (Math.random() - 0.5) * ex.w));
      emit(p, new THREE.Vector3(tv.x + (Math.random() - 0.5) * 1.2, 9 + 14 * burn * S.tspd + 4 * dark, tv.z + (Math.random() - 0.5) * 1.2), 1.4 + Math.random() + dark * 2.5, 1.2, 4 + 4 * burn + 4 * dark, a, [gv, gv, gv * 1.03], 1.3, 1.15);
    }
  }
  // the auxiliary diesel's stack on the cab unit
  gtAuxT += dt;
  if (gtAuxT > 0.1 && S.engineRun && S.rpm > 60) {
    gtAuxT = 0;
    const rf = clamp((S.rpm - 450) / 550, 0, 1), dark = S.crank > 0 ? 0.8 : 0, gv = lerp(0.6, 0.2, dark);
    emit(T.unitWorld(A, A.stackPos), new THREE.Vector3(tv.x + (Math.random() - 0.5) * 0.4, 3 + 5 * rf, tv.z + (Math.random() - 0.5) * 0.4), 2 + Math.random(), 0.4, 2 + 2 * rf, 0.08 + 0.15 * rf + 0.4 * dark, [gv, gv, gv], 0.5, 1.1);
  }
  if (S.crank > 0) { gtCrankT += dt; if (gtCrankT > 0.32) { gtCrankT = 0; sndCrank(); } }
  if (S.pumping && S.engineRun) { gtPumpT += dt; if (gtPumpT > 0.4) { gtPumpT = 0; GAME.pumpPh = (GAME.pumpPh || 0) + 1; if (GAME.pumpPh % 2) sndPump(GAME.pumpPh); } }
  // heat over the exhaust, near enough to see it
  if (!B.shim && !T.remote) B.shim = turbineShimmer(B);
  if (B.shim) {
    const k = lit && near < 260 ? (0.35 + 0.65 * burn) * smooth(GTE.lite, GTE.idle, S.tspd) * (1 - smooth(180, 260, near)) : 0;
    B.shim.visible = k > 0.01; B.shim.material.uniforms.k.value = k; B.shim.material.uniforms.t.value = S.time;
  }
  // heard from the turbine unit, where the noise is
  return { src: T.unitWorld(B, B.enginePos), working: S.load > 0.05 };
}

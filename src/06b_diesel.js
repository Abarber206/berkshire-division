/* ============================================================================
   Modern six-axle AC freight diesel in the GE wide-cab style:
   73 ft 2 in over couplers, 15 ft 5 in to the cab roof, 9 ft 11 in wide,
   C-C trucks (13 ft 2 in wheelbase, 42 in wheels), 4,400 hp four-stroke V12.
   Chamfered short nose with stacked headlights, number boards on the cab front,
   aux cab behind the cab on the conductor's side, a roof hump over the dynamic
   brake grids, and a tall radiator section with flared wings, a bulge along the
   top edge, and intake grilles set at two angles underneath.
   Paint: real Ohio roads in their classic schemes (as their heritage units wear them), the division's
   made-up roads, and custom colours.
   Local frame: +X forward, origin midway between truck centres at rail top.
   ========================================================================== */
const DG = { len: 22.30, ref: 11.15, trucks: [4.05, 18.25], axle: 2.0, rW: 0.533, deck: 1.72, uid: 0 };
const dx = a => DG.ref - a;

/* ---------------- liveries ----------------
   Real roads that ran through Ohio, in their classic freight schemes, as the railroads' own heritage units wear
   them on this same GE wide cab today (NS 8100 Nickel Plate, 8102 Pennsylvania, 8103 Norfolk & Western, 1066 New York
   Central; CSX 1827 Baltimore & Ohio, 1869 Chesapeake & Ohio), then the made-up roads of the division, then custom.
   bands: [y0, y1, colour] in metres above the rail, painted along the sides and carried round the nose.
   safety: the pilot stripe colour when the scheme has no accent colour of its own. */
const LIVERIES = {
  nkp: { name: 'Nickel Plate Road', sub: 'Black & yellow · NKP', road: 'NICKEL PLATE ROAD', init: 'NKP', num: 8100, body: 0x141516, roof: 0x18191a, accent: 0xf1b82a, letter: 0xf1b82a, rail: 0xf1b82a, nose: 'zebra', herald: 'nkp', font: 'serif', real: true,
    bands: [[2.04, 2.12, 0xf1b82a]] },
  prr: { name: 'Pennsylvania', sub: 'Brunswick green · PRR', road: 'PENNSYLVANIA', init: 'PRR', num: 8102, body: 0x1b2a21, roof: 0x18241d, accent: 0x1b2a21, letter: 0xd9b55e, rail: 0xd9b55e, safety: 0xd9b55e, nose: 'plain', herald: 'prr', font: 'serif', real: true },
  nyc: { name: 'New York Central', sub: 'Lightning stripe · NYC', road: 'NEW YORK CENTRAL', init: 'NYC', num: 1066, body: 0x3a3d40, roof: 0x303336, accent: 0xeeeeea, letter: 0xeeeeea, rail: 0xeeeeea, nose: 'lightning', herald: 'nyc', font: 'sans', real: true,
    bands: [[1.98, 2.04, 0xeeeeea], [2.04, 2.46, 0x989da0], [2.46, 2.52, 0xeeeeea]] },
  bo: { name: 'Baltimore & Ohio', sub: 'Blue & grey · B&O', road: 'BALTIMORE & OHIO', init: 'B&O', num: 1827, body: 0x1d3a6c, roof: 0x1a3360, accent: 0xe8b52e, letter: 0xe8b52e, rail: 0xe8b52e, nose: 'plain', herald: 'bo', font: 'serif', real: true,
    bands: [[1.10, 2.48, 0xa4a9ac], [2.48, 2.56, 0xe8b52e]] },
  co: { name: 'Chesapeake & Ohio', sub: 'Enchantment blue · C&O', road: 'C&O', roadPx: 112, coachRoad: 'CHESAPEAKE AND OHIO', init: 'C&O', num: 1869, body: 0x1f4c88, roof: 0x1b4277, accent: 0xf4c41c, letter: 0xf4c41c, rail: 0xf4c41c, nose: 'plain', herald: 'co', font: 'sans', real: true },
  nw: { name: 'Norfolk & Western', sub: 'Black & gold · N&W', road: 'NORFOLK AND WESTERN', init: 'N&W', num: 8103, body: 0x131415, roof: 0x171819, accent: 0x131415, letter: 0xd8b25a, rail: 0xd8b25a, safety: 0xd8b25a, nose: 'plain', herald: 'nw', font: 'serif', real: true },
  pm: { name: 'Pere Marquette', sub: 'Blue, grey & yellow · PM', road: 'PERE MARQUETTE', init: 'PM', num: 1900, body: 0x24467a, roof: 0x1f3d6b, accent: 0xefc33a, letter: 0xefc33a, rail: 0xefc33a, nose: 'plain', herald: 'pm', font: 'serif', real: true,
    bands: [[1.96, 2.03, 0xefc33a], [2.03, 2.44, 0xa9adaf], [2.44, 2.51, 0xefc33a]] },
  ss: { name: 'Sandusky & Scioto', sub: 'Green & cream', road: 'SANDUSKY & SCIOTO', init: 'S&S', num: 4401, body: 0x1d4634, roof: 0x16372a, accent: 0xe6d6a6, letter: 0xece0b6, rail: 0xe6d6a6, nose: 'bands', herald: 'ring', font: 'sans' },
  fle: { name: 'Fostoria & Lake Erie', sub: 'Lake red & silver', road: 'FOSTORIA & LAKE ERIE', init: 'F&LE', num: 2210, body: 0x7c1e19, roof: 0x5b5f63, accent: 0xd8d8d2, letter: 0xf2f0ea, rail: 0xd8d8d2, nose: 'chevrons', herald: 'diamond', font: 'serif' },
  kn: { name: 'Kenton & Northern', sub: 'Teal & gold', road: 'KENTON & NORTHERN', init: 'K&N', num: 1907, body: 0x1e4b55, roof: 0x173a42, accent: 0xd6a43c, letter: 0xe8c46a, rail: 0xd6a43c, nose: 'split', herald: 'shield', font: 'sans' },
  dgl: { name: 'Delphos Grain Lines', sub: 'Harvest gold', road: 'DELPHOS GRAIN LINES', init: 'DGL', num: 815, body: 0xc99a2c, roof: 0x4a3a28, accent: 0x4a3624, letter: 0x3a2a1c, rail: 0x4a3624, nose: 'bands', herald: 'sheaf', font: 'serif' },
  bvt: { name: 'Bellevue Terminal', sub: 'Graphite & orange', road: 'BELLEVUE TERMINAL', init: 'BVT', num: 3104, body: 0x44494f, roof: 0x33373b, accent: 0xe3742b, letter: 0xf0f0ea, rail: 0xe3742b, nose: 'chevrons', herald: 'oval', font: 'sans' },
  custom: { name: 'Custom', sub: 'Your colours', road: 'SANDUSKY & SCIOTO', init: 'S&S', num: 4401, body: 0x2c5f8a, roof: 0x24384a, accent: 0xf0f0ea, letter: 0xf0f0ea, rail: 0xf0f0ea, nose: 'bands', herald: 'ring', font: 'sans' },
};
/* run-through power in a mixed lashup: other real roads behind a real road, the made-up roads behind a made-up one */
const LIVERY_ORDER = Object.keys(LIVERIES).filter(k => k !== 'custom');
const liveryMixOrder = base => LIVERY_ORDER.filter(k => k !== base && !!LIVERIES[k].real === !!(LIVERIES[base] || {}).real);
/* the sides' band decal spans these heights; its texture is one column of the bands */
const LSIDE = { y0: 1.10, y1: 4.75 };

function liveryTextures(L, num) {
  const B = hexCss(L.body), A = hexCss(L.accent), T = hexCss(L.letter), S = hexCss(L.safety !== undefined ? L.safety : L.accent);
  const font = (w, px) => (L.font === 'serif' ? `700 ${px}px Georgia, "Times New Roman", serif` : `800 ${px}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`);
  const road = canvasTex(1024, 128, (g, w, h) => { g.font = font(w, L.roadPx || (L.road.length > 18 ? 66 : 76)); g.fillStyle = T; g.textAlign = 'center'; g.textBaseline = 'middle'; if (g.letterSpacing !== undefined) g.letterSpacing = (L.roadPx ? 14 : 5) + 'px'; g.fillText(L.road, w / 2, h / 2 + 4); });
  const number = canvasTex(256, 128, (g, w, h) => { g.font = font(w, 96); g.fillStyle = T; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(num), w / 2, h / 2 + 4); });
  const herald = canvasTex(256, 256, g => drawHerald(g, L.herald, T, B, L.font, L.init));
  // nose: the side bands carried round (v = 0 at the deck, 1 at the nose top), then the scheme's own nose design
  const nose = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = B; g.fillRect(0, 0, w, h);
    const row = y => h * (1 - (y - DG.deck) / (3.48 - DG.deck));
    const bands = L.bands || [];
    if (L.nose !== 'lightning') for (const [y0, y1, c] of bands) { g.fillStyle = hexCss(c); g.fillRect(0, row(y1), w, row(y0) - row(y1) + 0.5); }
    g.fillStyle = A;
    if (L.nose === 'bands') { g.fillRect(0, h * 0.18, w, h * 0.12); g.fillRect(0, h * 0.62, w, h * 0.2); }
    else if (L.nose === 'chevrons') { for (let k = -2; k < 6; k++) { const y = h * 0.95 - k * 34; g.beginPath(); g.moveTo(0, y); g.lineTo(w / 2, y - 60); g.lineTo(w, y); g.lineTo(w, y + 16); g.lineTo(w / 2, y - 44); g.lineTo(0, y + 16); g.closePath(); g.fill(); } }
    else if (L.nose === 'split') { g.beginPath(); g.moveTo(0, h * 0.55); g.lineTo(w, h * 0.25); g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fill(); }
    else if (L.nose === 'zebra') {          // NKP: slanted stripes rising toward the middle of the nose from each side
      const s = row(2.12);                  // they start off the side stripe
      for (const side of [-1, 1]) for (let k = 0; k < 4; k++) {
        const x0 = w / 2 + side * (w / 2 - k * 30), x1 = x0 - side * 44;
        g.beginPath(); g.moveTo(x0, s + 6); g.lineTo(x0 - side * 16, s + 6); g.lineTo(x1 - side * 16, s - 60); g.lineTo(x1, s - 60); g.closePath(); g.fill();
      }
    }
    else if (L.nose === 'lightning') {      // NYC: the band and its pinstripes sweep down into a point on the nose front
      const tip = h * 0.92, mid = w / 2;
      for (let i = bands.length - 1; i >= 0; i--) {
        const [y0, y1, c] = bands[i], a0 = row(y0), a1 = row(y1), d = a0 - a1;
        g.fillStyle = hexCss(c); g.beginPath(); g.moveTo(0, a1); g.lineTo(mid, Math.min(h, tip - (row(bands[0][0]) - a1) * 0.6)); g.lineTo(w, a1);
        g.lineTo(w, a1 + d); g.lineTo(mid, Math.min(h, tip - (row(bands[0][0]) - a1) * 0.6 + d * 1.4)); g.lineTo(0, a1 + d); g.closePath(); g.fill();
      }
    }
  });
  const dark = (() => { const r = (L.body >> 16) & 255, gg = (L.body >> 8) & 255, b = L.body & 255, k = 0.55; return `rgb(${r * k | 0},${gg * k | 0},${b * k | 0})`; })();
  const pilot = canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = dark; g.fillRect(0, 0, w, h);
    g.fillStyle = S; g.fillRect(0, 0, w, h * 0.16);
    // short diagonal safety stripes only at the outer corners
    for (const [x0, dir] of [[0, 1], [w, -1]]) for (let k = 0; k < 3; k++) { const x = x0 + dir * (6 + k * 16); g.beginPath(); g.moveTo(x, h); g.lineTo(x + dir * 8, h); g.lineTo(x + dir * 26, h * 0.2); g.lineTo(x + dir * 18, h * 0.2); g.closePath(); g.fill(); }
  });
  const board = canvasTex(128, 48, (g, w, h) => { g.fillStyle = '#e9e4cf'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.font = 'bold 34px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(num), w / 2, h / 2 + 2); });
  // the side bands: one column, transparent where there is no band
  const side = canvasTex(16, 512, (g, w, h) => {
    const row = y => h * (1 - (y - LSIDE.y0) / (LSIDE.y1 - LSIDE.y0));
    for (const [y0, y1, c] of L.bands || []) { g.fillStyle = hexCss(c); g.fillRect(0, row(y1), w, row(y0) - row(y1) + 0.5); }
  });
  return { road, number, herald, nose, pilot, board, side };
}
/* One material set per unit, so every unit in a lashup can wear its own paint and be re-skinned live. */
function liveryMaterials(L, num) {
  const mk = (c, m, r, extra = {}) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r, ...extra });
  const t = liveryTextures(L, num);
  const dec = map => new THREE.MeshStandardMaterial({ map, transparent: true, alphaTest: 0.35, metalness: 0.2, roughness: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  return wearSkin({
    lBody: mk(L.body, 0.3, 0.42, { side: THREE.DoubleSide }),
    lRoof: mk(L.roof, 0.3, 0.55, { side: THREE.DoubleSide }),
    lAccent: mk(L.accent, 0.2, 0.5, { side: THREE.DoubleSide }),
    lRail: mk(L.rail, 0.3, 0.45),
    lLouver: mk(L.body, 0.3, 0.5, { map: louverTex() }),
    lNose: mk(0xffffff, 0.3, 0.42, { map: t.nose, side: THREE.DoubleSide }),
    lPilot: mk(0xffffff, 0.25, 0.5, { map: t.pilot }),
    lRoad: dec(t.road), lNum: dec(t.number), lHerald: dec(t.herald),
    lSide: new THREE.MeshStandardMaterial({ map: t.side, transparent: true, alphaTest: 0.5, metalness: 0.3, roughness: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }),
    lBoard: new THREE.MeshBasicMaterial({ map: t.board }),
  });
}
/* road wear on a livery: a mottled sheen on the paint, exhaust soot on the roof, brake dust on the pilot */
function wearSkin(k) {
  for (const n of ['lBody', 'lAccent', 'lRail', 'lNose', 'lPilot', 'lLouver']) { wear(k[n]); grmTag(k[n], 'diesel'); }
  wear(k.lRoof, 0.6, 31); grmTag(k.lRoof, 'dieselRoof'); grmTag(k.lSide, 'diesel');
  return k;
}
function applyLivery(model, L, num) {
  const M = model.skin, t = liveryTextures(L, num);
  const set = (m, hex) => { m.color.set(hex).convertSRGBToLinear(); m.userData.lin = true; };
  set(M.lBody, L.body); set(M.lRoof, L.roof); set(M.lAccent, L.accent); set(M.lRail, L.rail); set(M.lLouver, L.body);
  const swap = (m, tex) => { if (m.map) m.map.dispose(); m.map = tex; m.needsUpdate = true; };
  swap(M.lNose, t.nose); swap(M.lPilot, t.pilot); swap(M.lRoad, t.road); swap(M.lNum, t.number); swap(M.lHerald, t.herald); swap(M.lBoard, t.board); swap(M.lSide, t.side);
  model.livery = L; model.number = num;
}

function dieselMaterials() {
  if (RMAT.dUnder) return;
  const mk = (c, m, r, extra = {}) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r, ...extra });
  RMAT.dDeck = mk(0x2a2c2b, 0.4, 0.8);
  RMAT.dUnder = mk(0x161718, 0.45, 0.55, { side: THREE.DoubleSide });
  RMAT.dSafety = mk(0xe8c23a, 0.15, 0.5);
  RMAT.dInt = mk(0x9a9c94, 0.05, 0.85, { side: THREE.DoubleSide });
  RMAT.dDesk = mk(0x3b3e40, 0.3, 0.6);
  RMAT.dSteel = mk(0x6b6f72, 0.7, 0.4);
  RMAT.glassT = new THREE.MeshStandardMaterial({ color: 0x15232a, metalness: 0.6, roughness: 0.05, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  if (typeof rainGlass === 'function') rainGlass(RMAT.glassT, true);   // rain and wipers on the windshield (10f_rainglass.js)
  RMAT.screen = new THREE.MeshBasicMaterial({ map: canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#05080a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1c3d2c'; g.fillRect(6, 6, w - 12, 22);
    g.fillStyle = '#7fe0a0'; g.font = 'bold 16px monospace'; g.fillText('TE  42 KLB   N5   FWD', 12, 22);
    g.strokeStyle = '#3fae74'; g.lineWidth = 3; g.beginPath(); g.arc(70, 82, 34, Math.PI * 0.8, Math.PI * 2.2); g.stroke();
    g.strokeStyle = '#e8c23a'; g.beginPath(); g.arc(190, 82, 34, Math.PI * 0.8, Math.PI * 1.6); g.stroke();
    g.fillStyle = '#cfe9d8'; g.font = '14px monospace'; g.fillText('BP 90', 46, 88); g.fillText('MR 140', 162, 88);
  }) });
  RMAT.grille = mk(0x111213, 0.4, 0.7, { side: THREE.DoubleSide, map: canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#5a5e60'; g.fillRect(0, 0, w, h); g.fillStyle = '#0b0c0d'; for (let y = 0; y < h; y += 6) g.fillRect(0, y, w, 4); }, { repeat: true }) });
  RMAT.mesh = mk(0x1a1b1c, 0.5, 0.6, { map: canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#0a0b0c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#4a4e50'; g.lineWidth = 2; for (let x = 0; x < w; x += 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } }, { repeat: true }) });
  RMAT.fan = mk(0x161718, 0.5, 0.6, { map: canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#0a0b0c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#4a4e50'; g.lineWidth = 2; for (let r = 8; r < 64; r += 7) { g.beginPath(); g.arc(64, 64, r, 0, TAU); g.stroke(); } for (let a = 0; a < 12; a++) { g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(a / 12 * TAU) * 62, 64 + Math.sin(a / 12 * TAU) * 62); g.stroke(); } g.fillStyle = '#2a2d2f'; g.beginPath(); g.arc(64, 64, 9, 0, TAU); g.fill(); }) });
  RMAT.headOff = mk(0x2a2a28, 0.6, 0.2);
  wear(RMAT.dDeck, 0.5, 32); wear(RMAT.dUnder, 0.6, 33); wear(RMAT.dSteel, 0.35, 34); wear(RMAT.dSafety, 0.35, 35); wear(RMAT.grille); wear(RMAT.mesh); wear(RMAT.fan);
}

function buildDiesel(opts) {
  dieselMaterials();
  const spec = LOCO_SPEC.diesel;
  const L = opts.livery, num = opts.number, lead = opts.lead !== false;
  const skin = liveryMaterials(L, num);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const gb = new GeoBin();
  const D = DG.deck;
  const box = (k, a0, a1, y0, y1, z0, z1) => gb.box(k, Math.abs(a1 - a0), Math.abs(y1 - y0), Math.abs(z1 - z0), dx((a0 + a1) / 2), (y0 + y1) / 2, (z0 + z1) / 2);
  const rod = (k, r, p0, p1, seg = 6) => { const a = new THREE.Vector3(...p0), b = new THREE.Vector3(...p1), L2 = a.distanceTo(b); const g = new THREE.CylinderGeometry(r, r, L2, seg); g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()))); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); gb.add(k, g); };
  const quad = (k, a0, a1, p, q) => { const g = new THREE.BufferGeometry(); const x0 = dx(a0), x1 = dx(a1); g.setAttribute('position', new THREE.Float32BufferAttribute([x0, p[0], p[1], x1, p[0], p[1], x1, q[0], q[1], x0, p[0], p[1], x1, q[0], q[1], x0, q[0], q[1]], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, (a1 - a0) / 1.2, 0, (a1 - a0) / 1.2, 1, 0, 0, (a1 - a0) / 1.2, 1, 0, 1], 2)); g.computeVertexNormals(); gb.add(k, g); };
  const W = 1.51, HZ = 1.17;               // half widths: carbody / hood
  // one nearly level roofline, as on the GE wide cabs: cab, dynamic-brake section, engine room, radiators
  const CAB0 = 2.62, CAB1 = 5.30, ROOF = 4.62, DBH = 4.6, DB1 = 10.9, HOOD = 4.5, RADH = 4.7, RAD0 = 15.4, RAD1 = 21.62, WING = 1.47;

  /* ---- frame, sill, deck ---- */
  const PW = 1.06;                         // pilot end plate half width; the step wells sit outboard of it
  box('lBody', 1.26, DG.len - 1.26, 1.16, 1.70, -W, W);
  box('lAccent', 1.25, DG.len - 1.25, 1.40, 1.53, -W - 0.008, W + 0.008);
  box('dDeck', 0.42, DG.len - 0.42, 1.70, D + 0.02, -W - 0.02, W + 0.02);
  for (let a = 1.5, k = 0; a < 20.6; a += 0.9, k++) for (const s of [-1, 1]) box(k % 2 ? 'red' : 'white', a, a + 0.42, 1.24, 1.33, s * (W - 0.002), s * (W + 0.008));
  for (const a of [3.0, 19.3]) for (const s of [-1, 1]) box('dUnder', a, a + 0.45, 1.05, 1.18, s * 1.2, s * 1.48); // jacking pads

  /* ---- ends: pilot, plow, coupler, open step wells at the corners, yellow handrails ---- */
  const couplers = [];
  for (const e of [0, 1]) {
    const A = e ? DG.len : 0, sg = e ? -1 : 1, at = d => A + sg * d;
    box('lBody', at(0.42), at(1.26), 0.72, 1.70, -PW, PW);
    gb.add('lPilot', new THREE.PlaneGeometry(2 * PW, 0.9), M(dx(at(0.41)), 1.18, 0, 0, e ? -Math.PI / 2 : Math.PI / 2, 0));
    for (const s of [-1, 1]) gb.add('dUnder', new THREE.BoxGeometry(1.42, 0.62, 0.05), M(dx(at(0.58)), 0.46, s * 0.62, 0, -s * sg * 0.42, 0).multiply(M(0, 0, 0, 0, Math.PI / 2, 0)));   // snow plow
    couplers.push(addCoupler(gb, body, { x: dx(A), out: e ? -1 : 1, sx: -0.42, sb: 0.72, ly: 1.4, zh: 0.95, yp: 0.86, housing: false }));
    // anticlimber: a heavy ribbed ledge across the end at deck height
    box('dUnder', at(0.34), at(0.5), 1.6, 1.8, -PW - 0.03, PW + 0.03);
    for (const y of [1.65, 1.71, 1.77]) box('dUnder', at(0.32), at(0.36), y - 0.012, y + 0.012, -PW, PW);
    for (const z of [-0.95, -0.62, 0.62, 0.95]) gb.add('dUnder', new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6), M(dx(at(0.4)), 0.98, z, 0.3 * sg, 0, 0));
    for (const z of [-0.74, 0.74]) box('dUnder', at(0.36), at(0.44), 1.02, 1.26, z - 0.11, z + 0.11); // MU receptacles
    // MU jumper cables and air hoses: looped from the receptacles in toward the coupler, and hanging at the corners
    for (const s of [-1, 1]) {
      gb.tube('dUnder', [[dx(at(0.38)), 1.06, s * 0.66], [dx(at(0.33)), 0.88, s * 0.5], [dx(at(0.33)), 0.84, s * 0.32], [dx(at(0.4)), 1.0, s * 0.16]], 0.024, 14, 6);
      gb.tube('dUnder', [[dx(at(0.38)), 1.1, s * 0.8], [dx(at(0.32)), 0.8, s * 0.92], [dx(at(0.33)), 0.62, s * 0.86], [dx(at(0.38)), 0.7, s * 0.8]], 0.02, 12, 6);
    }
    gb.tube('dSafety', [[dx(at(0.44)), 1.72, -0.42], [dx(at(0.4)), 1.86, -0.36], [dx(at(0.4)), 1.86, 0.36], [dx(at(0.44)), 1.72, 0.42]], 0.018, 12, 6);
    for (const s of [-1, 1]) {
      box('dUnder', at(0.44), at(1.25), 0.30, 1.69, s * (PW - 0.03), s * (PW + 0.006));   // inner wall of the step well
      box('dUnder', at(1.22), at(1.26), 0.30, 1.70, s * PW, s * 1.52);               // back of the well
      for (const y of [0.42, 0.84, 1.26]) { box('dUnder', at(0.48), at(1.22), y, y + 0.05, s * PW, s * 1.48); box('dSafety', at(0.49), at(1.21), y + 0.045, y + 0.06, s * 1.43, s * 1.49); }
      // a hoop over the open side of the well, and a front rail arching in toward the nose
      gb.tube('dSafety', [[dx(at(0.5)), 0.44, s * 1.52], [dx(at(0.5)), 2.42, s * 1.52], [dx(at(0.6)), 2.76, s * 1.52], [dx(at(1.06)), 2.78, s * 1.52], [dx(at(1.17)), 2.45, s * 1.52], [dx(at(1.17)), 1.74, s * 1.52]], 0.022, 30, 6);
      gb.tube('dSafety', [[dx(at(0.5)), 2.5, s * 1.52], [dx(at(0.5)), 2.74, s * 1.32], [dx(at(0.53)), 2.62, s * 1.08], [dx(at(0.56)), 1.74, s * 1.0]], 0.02, 18, 6);
    }
  }
  /* ---- short nose, as on the GE Evolution wide cabs (ES44AC): nearly as wide as the cab, a flat front face with the
         nose door, the top sloping up from a crease to the windshield sill, and its two top corners cut off by long
         chamfers. Narrow walkways run past it on both sides to the cab front wall. ---- */
  const N0 = 1.12, Wn = 1.48, yC = 3.12, Wt = 1.16, yF = 3.34, yT1 = 3.48, yT2 = 3.6, CHc = 0.25, NF = Wn;
  const yW0 = yT2, yW1 = 4.33, tL = 0.2, aTop = CAB0 + (yW1 - yW0) * tL, Wc = W - CHc, aB = aTop - 0.12;
  /* the side bands (lSide): one decal over each flat run of the sides, mapped by height so the bands line up */
  const band = (a0, a1, y0, y1, z, face) => {
    const g = new THREE.PlaneGeometry(Math.abs(a1 - a0), y1 - y0), uv = g.attributes.uv, p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setY(i, (p.getY(i) + (y0 + y1) / 2 - LSIDE.y0) / (LSIDE.y1 - LSIDE.y0));
    gb.add('lSide', g.applyMatrix4(M(dx((a0 + a1) / 2), (y0 + y1) / 2, z, 0, face, 0)));
  };
  const zAt = y => Wn - (y - yC) * (Wn - Wt) / (yT2 - yC);   // the chamfer, from the top of the side wall to the edge of the top
  const zF = zAt(yF);
  // the top is crowned: a centre ridge stands hR above the corner edges at the front crease, easing to the flat
  // windshield sill at the cab (ridge height at a: rY(a))
  const hR = 0.12, rY = a => yF + (yT2 - yF) * (a - N0) / (CAB0 - N0) + hR * (CAB0 - a) / (CAB0 - N0);
  const P = (a, z, y) => [dx(a), y, z];
  const facet = (k, pts, uvs) => {      // flat convex polygon, fan triangulated
    const pos = [], uv = [];
    for (let i = 1; i < pts.length - 1; i++) for (const j of [0, i, i + 1]) { pos.push(...pts[j]); uv.push(...(uvs ? uvs[j] : [0, 0])); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); gb.add(k, g);
  };
  // the side bands on a flat facet, mapped by height like the sides (the band texture is one column)
  const bandFacet = (pts, off) => facet('lSide', pts.map(p => [p[0] + off[0], p[1], p[2] + off[2]]), pts.map(p => [0.5, (p[1] - LSIDE.y0) / (LSIDE.y1 - LSIDE.y0)]));
  {
    const v = y => (y - D) / (yT1 - D), u = z => (Wn - z) / (2 * Wn);
    // front face: the nose scheme (bands and design) across it
    const front = [P(N0, Wn, D), P(N0, -Wn, D), P(N0, -Wn, yC), P(N0, -zF, yF), P(N0, 0, rY(N0)), P(N0, zF, yF), P(N0, Wn, yC)];
    facet('lNose', front, front.map(p => [u(p[2]), v(p[1])]));
    // the sides run straight back, then flare out to the cab's full width over the last half metre, so the nose
    // meets the cab corners with no step (aFl: where the flare starts; zE, yE: the top corner edge there)
    const aFl = CAB0 - 0.5, yE = yF + (yT2 - yF) * (aFl - N0) / (CAB0 - N0), zE = zAt(yE);
    facet('lRoof', [P(N0, -zF, yF), P(aFl, -zE, yE), P(aFl, 0, rY(aFl)), P(N0, 0, rY(N0))]);   // the sloping, crowned top, crease to flare
    facet('lRoof', [P(N0, 0, rY(N0)), P(aFl, 0, rY(aFl)), P(aFl, zE, yE), P(N0, zF, yF)]);
    for (const s of [-1, 1]) {
      const f = s > 0 ? 0 : Math.PI;
      facet('lBody', [P(N0, s * Wn, D), P(aFl, s * Wn, D), P(aFl, s * Wn, yC), P(N0, s * Wn, yC)]);                // side wall
      facet('lBody', [P(N0, s * Wn, yC), P(aFl, s * Wn, yC), P(aFl, s * zE, yE), P(N0, s * zF, yF)]);              // top corner chamfer
      band(N0, aFl, D, yC, s * (Wn + 0.003), f);
      const flare = [P(aFl, s * Wn, D), P(CAB0, s * W, D), P(CAB0, s * W, yC), P(aFl, s * Wn, yC)];
      facet('lBody', flare); bandFacet(flare, [-0.003 * (W - Wn) / Math.hypot(W - Wn, 0.5), 0, s * 0.003 * 0.5 / Math.hypot(W - Wn, 0.5)]);
      facet('lBody', [P(aFl, s * Wn, yC), P(CAB0, s * W, yC), P(CAB0, s * Wc, yT2)]);                              // the chamfer, flaring with it
      facet('lBody', [P(aFl, s * Wn, yC), P(CAB0, s * Wc, yT2), P(aFl, s * zE, yE)]);
      facet('lBody', [P(CAB0, s * W, yC), P(CAB0, s * W, yW0), P(CAB0, s * Wc, yW0)]);                               // corner cap under the windshield's angled corner
      // the cab side ahead of the side window, square to the sill, and the ledge under the windshield's corner
      facet('lBody', [P(CAB0, s * W, D), P(CAB0 + CHc, s * W, D), P(CAB0 + CHc, s * W, yW0), P(CAB0, s * W, yW0)]);
      band(CAB0, CAB0 + CHc, D, yW0, s * (W + 0.003), f);
      facet('lRoof', [P(CAB0, s * Wc, yW0), P(CAB0, s * W, yW0), P(CAB0 + CHc, s * W, yW0)]);
    }
    // the sloping top, widening with the flare
    facet('lRoof', [P(aFl, -zE, yE), P(CAB0, -Wc, yT2), P(CAB0, 0, yT2), P(aFl, 0, rY(aFl))]);
    facet('lRoof', [P(aFl, 0, rY(aFl)), P(CAB0, 0, yT2), P(CAB0, Wc, yT2), P(aFl, zE, yE)]);
    box('dUnder', 1.5, 1.9, 1.95, 2.35, Wn - 0.004, Wn + 0.008);          // access panel, engineer's side
    // crease trim along the top of the front face, and the drip strip over the nose door
    for (const s of [-1, 1]) rod('lBody', 0.011, [dx(N0 - 0.004), yF - 0.008, s * zF], [dx(N0 - 0.004), rY(N0) - 0.008, 0], 5);
  }
  /* ---- ditch lights: a pair of square housings low on the nose face, just above the anticlimber ---- */
  const ditch = [];
  for (const s of [-1, 1]) {
    const z = s * 0.88, y = 2.0;
    box('dUnder', N0 - 0.1, N0, y - 0.12, y + 0.12, z - 0.13, z + 0.13);           // housing
    box('dSteel', N0 - 0.108, N0 - 0.098, y - 0.1, y + 0.1, z - 0.11, z + 0.11);   // bezel
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.075, 18), new THREE.MeshBasicMaterial({ color: 0xfff3d6 })); lens.position.set(dx(N0 - 0.11), y, z); lens.rotation.y = Math.PI / 2; body.add(lens);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    halo.position.set(dx(N0 - 0.15), y, z); halo.scale.set(1.2, 1.2, 1); body.add(halo);
    ditch.push({ lens, halo });
  }
  /* ---- front walkway railing: posts in the paint colour, a chain across the nose door ---- */
  for (const s of [-1, 1]) {
    const aR = 0.52, yR = 2.77;
    rod('lRail', 0.024, [dx(aR), yR, s * 1.08], [dx(aR), yR, s * 0.36]);
    for (const z of [0.36, 0.72]) rod('lRail', 0.022, [dx(aR), D, s * z], [dx(aR), yR + 0.02, s * z]);
    rod('lRail', 0.022, [dx(aR), yR + 0.02, s * 1.08], [dx(0.53), 2.6, s * 1.08]);   // down onto the yellow corner rail
  }
  for (let i = 0; i < 10; i++) {   // the chain, hanging in a shallow curve
    const z0 = -0.34 + i * 0.068, z1 = z0 + 0.068, sag = q => 0.09 * (1 - (q / 0.34) ** 2);
    rod('dSteel', 0.008, [dx(0.52), 2.72 - sag(z0), z0], [dx(0.52), 2.72 - sag(z1), z1], 4);
  }
  // the bell, on a stand on the nose top ahead of the windshield; it swings while it rings (bellRig)
  const bellA = 2.0, bellY = rY(bellA), bs = 0.6, bp = bellY + 0.25;
  box('dUnder', bellA - 0.16, bellA + 0.16, bellY - 0.03, bellY + 0.025, -0.22, 0.22);                  // base plate on the roof
  for (const s of [-1, 1]) box('dUnder', bellA - 0.035, bellA + 0.035, bellY, bp + 0.05, s * 0.17, s * 0.2);   // stand posts
  gb.cylZ('dSteel', 0.016, 0.4, 8, dx(bellA), bp, 0);                                                  // trunnion shaft
  const bellRigD = bellRig(body, dx(bellA), bp, bs, 0.35, 'diesel');

  /* ---- cab: raked windshield with chamfered corners, and a brow above it carrying the number boards ---- */
  let cab; const lenses = [];
  {
    const rr = (p, x0, y0, x1, y1, r) => { p.moveTo(x0 + r, y0); p.lineTo(x1 - r, y0); p.quadraticCurveTo(x1, y0, x1, y0 + r); p.lineTo(x1, y1 - r); p.quadraticCurveTo(x1, y1, x1 - r, y1); p.lineTo(x0 + r, y1); p.quadraticCurveTo(x0, y1, x0, y1 - r); p.lineTo(x0, y0 + r); p.quadraticCurveTo(x0, y0, x0 + r, y0); };
    // the windshield plane leans back: x' = x - (y - yW0) * tL
    const shear = new THREE.Matrix4().set(1, -tL, 0, dx(CAB0) + tL * yW0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
    const f = new THREE.Shape(); f.moveTo(-Wc, yW0); f.lineTo(Wc, yW0); f.lineTo(Wc, yW1); f.lineTo(-Wc, yW1); f.closePath();
    const wz0 = 0.08, wz1 = Wc - 0.1, wy0 = yW0 + 0.07, wy1 = yW1 - 0.06;
    for (const s of [-1, 1]) { const h = new THREE.Path(); rr(h, s > 0 ? wz0 : -wz1, wy0, s > 0 ? wz1 : -wz0, wy1, 0.1); f.holes.push(h); }
    const g = new THREE.ExtrudeGeometry(f, { depth: 0.06, bevelEnabled: false, curveSegments: 5 }); g.rotateY(Math.PI / 2); g.translate(-0.06, 0, 0); g.applyMatrix4(shear); gb.add('lBody', g);
    for (const s of [-1, 1]) {
      gb.add('glassT', new THREE.PlaneGeometry(wz1 - wz0 + 0.02, wy1 - wy0 + 0.02).rotateY(Math.PI / 2).translate(-0.03, (wy0 + wy1) / 2, s * (wz0 + wz1) / 2).applyMatrix4(shear));
      // chamfered corner panel between the windshield and the cab side
      facet('lBody', [P(CAB0, s * Wc, yW0), P(aTop, s * Wc, yW1), P(aTop + CHc, s * W, yW1), P(CAB0 + CHc, s * W, yW0)]);
    }
    // brow over the windshield, the same chamfered plan, overhanging it like a visor
    const bp = new THREE.Shape();
    bp.moveTo(dx(aB), -Wc); bp.lineTo(dx(aB), Wc); bp.lineTo(dx(aB + CHc), W); bp.lineTo(dx(CAB1), W); bp.lineTo(dx(CAB1), -W); bp.lineTo(dx(aB + CHc), -W); bp.closePath();
    const bg = new THREE.ExtrudeGeometry(bp, { depth: ROOF - yW1, bevelEnabled: false }); bg.rotateX(-Math.PI / 2); bg.translate(0, yW1, 0); gb.add('lBody', bg);
    // number boards either side of the twin headlights, each in its own raised case on the brow
    for (const s of [-1, 1]) {
      box('dUnder', aB - 0.07, aB + 0.01, 4.36, 4.59, s * 0.36, s * 0.97);
      box('lBody', aB - 0.075, aB - 0.065, 4.36, 4.59, s * 0.36, s * 0.97);
      gb.add('lBoard', new THREE.PlaneGeometry(0.54, 0.17), M(dx(aB - 0.078), 4.475, s * 0.665, 0, Math.PI / 2, 0));
    }
    // headlight case between the boards: two sealed beams side by side
    box('dUnder', aB - 0.1, aB + 0.01, 4.36, 4.59, -0.3, 0.3);
    for (const s of [-1, 1]) gb.add('dSteel', new THREE.TorusGeometry(0.098, 0.014, 6, 20).rotateY(Math.PI / 2), M(dx(aB - 0.104), 4.475, s * 0.135));
    for (const s of [-1, 1]) {
      const ln = new THREE.Mesh(new THREE.CircleGeometry(0.092, 20), lead ? RMAT.lens : RMAT.headOff); ln.position.set(dx(aB - 0.103), 4.475, s * 0.135); ln.rotation.y = Math.PI / 2; body.add(ln); lenses.push(ln);
    }
    // roof cap following the same outline
    const o = 0.006, rp = new THREE.Shape();
    rp.moveTo(dx(aB) + o, -Wc - o * 0.4); rp.lineTo(dx(aB) + o, Wc + o * 0.4); rp.lineTo(dx(aB + CHc), W + o); rp.lineTo(dx(CAB1 + 0.04), W + o); rp.lineTo(dx(CAB1 + 0.04), -W - o); rp.lineTo(dx(aB + CHc), -W - o); rp.closePath();
    const rg = new THREE.ExtrudeGeometry(rp, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.035, bevelSegments: 2 }); rg.rotateX(-Math.PI / 2); rg.translate(0, ROOF + 0.005, 0); gb.add('lRoof', rg);
    // side walls: one big sliding window each, cab-side numbers beneath
    for (const s of [-1, 1]) {
      const sw = new THREE.Shape(); sw.moveTo(dx(CAB1), D); sw.lineTo(dx(CAB0 + CHc), D); sw.lineTo(dx(CAB0 + CHc), yW0); sw.lineTo(dx(aTop + CHc), yW1); sw.lineTo(dx(CAB1), yW1); sw.closePath();
      const h = new THREE.Path(); rr(h, dx(5.05), 3.5, dx(3.25), 4.24, 0.09); sw.holes.push(h);
      const g2 = new THREE.ExtrudeGeometry(sw, { depth: 0.06, bevelEnabled: false, curveSegments: 4 }); g2.translate(0, 0, s * W - 0.03); gb.add('lBody', g2);
      gb.add('glassT', new THREE.PlaneGeometry(1.82, 0.76), M(dx(4.15), 3.87, s * (W + 0.005)));
      box('dUnder', 4.13, 4.18, 3.5, 4.24, s * (W - 0.02), s * (W + 0.03));       // sash
      box('lBody', 3.2, 5.1, 4.27, 4.31, s * W, s * (W + 0.07));                  // rain visor
      gb.add('lNum', new THREE.PlaneGeometry(1.1, 0.54), M(dx(4.15), 3.08, s * (W + 0.035), 0, s > 0 ? 0 : Math.PI, 0));
      gb.add('lRail', new THREE.CylinderGeometry(0.02, 0.02, 1.2, 6), M(dx(5.08), 2.6, s * (W + 0.065)));
      for (const y of [2.1, 3.1]) box('lRail', 5.06, 5.1, y - 0.02, y + 0.02, s * (W + 0.02), s * (W + 0.07));   // its standoffs
    }
    for (const [a0, a1] of [[3.2, 3.95], [4.1, 4.85]]) box('lLouver', a0, a1, 1.86, 2.5, W + 0.028, W + 0.036);   // louvres under the engineer's window
    box('lBody', CAB1 - 0.06, CAB1, D, ROOF, -W, W);
    // roof: air conditioner, antennas
    box('dUnder', 3.4, 4.3, ROOF + 0.07, ROOF + 0.2, -0.62, 0.62);
    box('grille', 3.45, 4.25, ROOF + 0.2, ROOF + 0.206, -0.55, 0.55);
    for (const z of [-0.95, 0.9]) gb.add('dUnder', new THREE.CylinderGeometry(0.015, 0.03, 0.45, 6), M(dx(4.8), ROOF + 0.3, z));
    // interior: floor, console, control stand, seats
    const FL = 2.7;                                            // the cab floor sits well above the deck
    box('dInt', CAB0 + 0.3, CAB1 - 0.05, FL - 0.03, FL, -W + 0.02, W - 0.02);
    cab = dieselCab(gb, body, { dx, CAB0, CAB1, FL, W, sill: yW0, ceil: yW1, lead, uid: ++DG.uid, nose: { w: zAt(3.5) - 0.04, top: 3.5 }, wipe: { tL, wz0: 0.08, wz1: Wc - 0.1, wy0: yW0 + 0.07, yW0 } });
    // air conditioner under the cab, conductor's side
    box('grille', CAB0 + 0.3, CAB0 + 1.5, 1.2, 1.62, -W - 0.006, -W - 0.002);
  }
  /* ---- aux cab (conductor's side, behind the cab) ---- */
  box('lBody', CAB1, 7.1, D, DBH, -W, -HZ);
  box('lRoof', CAB1, 7.12, DBH, DBH + 0.04, -W - 0.01, -HZ);
  box('lLouver', 5.6, 6.9, 3.45, 4.35, -W - 0.006, -W - 0.002);
  box('dUnder', 5.42, 5.46, 1.95, 4.2, -W - 0.006, -W - 0.002);
  /* ---- long hood ---- */
  box('lBody', CAB1, DB1, D, DBH, -HZ, HZ);
  box('lRoof', CAB1, DB1 + 0.02, DBH, DBH + 0.03, -HZ - 0.01, HZ + 0.01);
  box('lBody', DB1, RAD0, D, HOOD, -HZ, HZ);
  box('lRoof', DB1, RAD0 + 0.02, HOOD, HOOD + 0.03, -HZ - 0.01, HZ + 0.01);
  // dynamic brake hump right behind the cab
  box('grille', 6.4, 10.5, DBH + 0.03, DBH + 0.036, -0.9, 0.9);          // dynamic brake grid hatch
  box('dUnder', 5.92, 6.08, DBH + 0.03, DBH + 0.26, -0.05, 0.05);
  box('dUnder', 5.95, 6.05, DBH + 0.25, DBH + 0.37, -0.2, 0.2);   // horn manifold
  for (const [Lh, r, s, z] of [[0.55, 0.075, 1, -0.16], [0.42, 0.065, 1, 0], [0.34, 0.055, 1, 0.16], [0.48, 0.07, -1, -0.08], [0.38, 0.06, -1, 0.08]]) {
    const g3 = new THREE.CylinderGeometry(r, 0.03, Lh, 12, 1, true).rotateZ(s * -Math.PI / 2); g3.translate(dx(6.0) + s * Lh / 2, DBH + 0.31, z); gb.add('dUnder', g3);
  }
  for (const s of [-1, 1]) box('lLouver', 7.2, 10.7, 3.98, 4.46, s * HZ, s * (HZ + 0.006));   // grid intake louvres high on the hood
  // engine room doors, latches, intake
  for (const s of [-1, 1]) {
    for (let a = 7.25; a < 15.3; a += 0.94) { box('dUnder', a, a + 0.025, 1.85, 3.92, s * (HZ - 0.002), s * (HZ + 0.007)); box('dSteel', a + 0.38, a + 0.52, 2.9, 2.95, s * HZ, s * (HZ + 0.025)); }
    box('lLouver', 13.25, 14.1, 3.7, 4.36, s * HZ, s * (HZ + 0.01));
    gb.add('lRoad', new THREE.PlaneGeometry(6.2, 0.78), M(dx(12.2), 3.0, s * (HZ + 0.012), 0, s > 0 ? 0 : Math.PI, 0));
    gb.add('lHerald', new THREE.PlaneGeometry(0.95, 0.95), M(dx(7.95), 3.05, s * (HZ + 0.012), 0, s > 0 ? 0 : Math.PI, 0));
  }
  // exhaust silencer and stack, sand fill
  box('dUnder', 10.92, 12.05, HOOD + 0.02, HOOD + 0.2, -0.46, 0.46);
  box('dUnder', 11.3, 11.7, HOOD + 0.2, HOOD + 0.26, -0.3, 0.3);
  gb.add('dSteel', new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12), M(dx(9.4), DBH + 0.06, 0.75));
  /* ---- radiator section with flared wings ---- */
  box('lBody', RAD0, RAD1, D, RADH, -HZ, HZ);
  {
    const ramp = new THREE.BufferGeometry();     // step up from the hood to the radiator roof
    const x0 = dx(RAD0 - 0.45), x1 = dx(RAD0);
    const v = [x0, HOOD, -HZ, x1, RADH, -HZ, x1, RADH, HZ, x0, HOOD, -HZ, x1, RADH, HZ, x0, HOOD, HZ];
    ramp.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); ramp.computeVertexNormals(); gb.add('lRoof', ramp);
    for (const s of [-1, 1]) { const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([x0, HOOD, s * HZ, x1, RADH, s * HZ, x1, HOOD, s * HZ], 3)); tri.computeVertexNormals(); gb.add('lBody', tri); }
  }
  for (const s of [-1, 1]) {
    const wp = new THREE.Shape();                 // side profile of a wing, sloped leading edge
    wp.moveTo(dx(RAD0 + 0.05), RADH); wp.lineTo(dx(RAD1), RADH); wp.lineTo(dx(RAD1), 3.32); wp.lineTo(dx(RAD0 + 0.75), 3.32); wp.closePath();
    const g = new THREE.ExtrudeGeometry(wp, { depth: WING - HZ, bevelEnabled: false });
    g.translate(0, 0, s > 0 ? HZ : -WING); gb.add('lBody', g);
    gb.add('lRail', new THREE.CylinderGeometry(0.055, 0.055, RAD1 - RAD0 - 0.3, 10).rotateZ(Math.PI / 2), M(dx((RAD0 + RAD1) / 2 + 0.12), RADH - 0.02, s * (WING - 0.03)));   // bulge on the wing's top edge
    box('lAccent', RAD0 + 0.75, RAD1, 3.3, 3.34, s * (HZ - 0.01), s * (WING + 0.006));
    // intake grilles under the wing, set at two angles: a steep lower panel and a shallow upper one
    quad('grille', RAD0 + 0.95, RAD1 - 0.15, [2.3, s * HZ], [2.92, s * (HZ + 0.07)]);
    quad('grille', RAD0 + 0.95, RAD1 - 0.15, [2.92, s * (HZ + 0.07)], [3.31, s * (WING - 0.02)]);
    for (const a of [RAD0 + 0.95, RAD1 - 0.15]) { const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([dx(a), 2.3, s * HZ, dx(a), 3.31, s * HZ, dx(a), 3.31, s * (WING - 0.02), dx(a), 2.3, s * HZ, dx(a), 2.92, s * (HZ + 0.07), dx(a), 3.31, s * (WING - 0.02)], 3)); tri.computeVertexNormals(); gb.add('lBody', tri); }
  }
  box('lRoof', RAD0, RAD1 + 0.02, RADH, RADH + 0.03, -WING, WING);
  for (const a of [16.8, 18.75]) { gb.add('dUnder', new THREE.CylinderGeometry(0.82, 0.82, 0.1, 28), M(dx(a), RADH + 0.08, 0)); gb.add('fan', new THREE.CircleGeometry(0.78, 28), M(dx(a), RADH + 0.135, 0, -Math.PI / 2, 0, 0)); }
  box('mesh', 19.8, 21.4, RADH + 0.03, RADH + 0.06, -1.1, 1.1);
  // rear wall: headlights, number boards, rear platform handrails
  box('lBody', RAD1 - 0.04, RAD1 + 0.02, D, RADH, -WING, WING);
  box('dUnder', RAD1, RAD1 + 0.12, 4.18, 4.52, -0.36, 0.36);
  for (const z of [-0.16, 0.16]) { const r = new THREE.Mesh(new THREE.CircleGeometry(0.1, 18), RMAT.headOff); r.position.set(dx(RAD1 + 0.125), 4.35, z); r.rotation.y = -Math.PI / 2; body.add(r); }
  for (const s of [-1, 1]) { box('dUnder', RAD1, RAD1 + 0.1, 4.4, 4.63, s * 0.7, s * 1.28); gb.add('lBoard', new THREE.PlaneGeometry(0.54, 0.18), M(dx(RAD1 + 0.105), 4.515, s * 0.99, 0, -Math.PI / 2, 0)); }
  /* ---- walkway handrails (paint colour) ---- */
  for (const s of [-1, 1]) {
    const a0 = s < 0 ? 7.2 : CAB1 + 0.1;
    rod('lRail', 0.022, [dx(a0), 2.75, s * 1.49], [dx(21.5), 2.75, s * 1.49]);
    for (let a = a0; a < 21.6; a += 1.55) rod('lRail', 0.019, [dx(a), D, s * 1.49], [dx(a), 2.75, s * 1.49]);
    rod('lRail', 0.019, [dx(21.5), D, s * 1.49], [dx(21.5), 2.75, s * 1.49]);
  }
  /* ---- side bands (lSide): one decal over each flat run of the sides, mapped by height so the bands line up ---- */
  for (const s of [-1, 1]) {
    const f = s > 0 ? 0 : Math.PI;
    band(1.26, DG.len - 1.26, 1.16, 1.70, s * (W + 0.003), f);                 // frame sill
    band(CAB0 + CHc, CAB1, D, 3.5, s * (W + 0.033), f);                         // cab side, under the window
    band(s < 0 ? 7.1 : CAB1, RAD1, D, HOOD, s * (HZ + 0.003), f);                // long hood and radiator section
    band(RAD0 + 0.75, RAD1, 3.32, RADH, s * (WING + 0.003), f);                 // the radiator wing's face
  }
  band(CAB1, 7.1, D, DBH, -(W + 0.003), Math.PI);                                // aux cab, conductor's side
  {                                                                              // the rear wall, so the bands turn the corner
    const g = new THREE.PlaneGeometry(2 * WING, RADH - D), uv = g.attributes.uv, p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setY(i, (p.getY(i) + (RADH + D) / 2 - LSIDE.y0) / (LSIDE.y1 - LSIDE.y0));
    gb.add('lSide', g.applyMatrix4(M(dx(RAD1 + 0.023), (RADH + D) / 2, 0, 0, -Math.PI / 2, 0)));
  }
  /* ---- fuel tank ---- */
  {
    const t = new THREE.Shape(); const w = 1.38, y0 = 0.5, y1 = 1.16, r = 0.26;
    t.moveTo(-w, y1); t.lineTo(-w, y0 + r); t.quadraticCurveTo(-w, y0, -w + r, y0); t.lineTo(w - r, y0); t.quadraticCurveTo(w, y0, w, y0 + r); t.lineTo(w, y1); t.closePath();
    const g = new THREE.ExtrudeGeometry(t, { depth: 8.8, bevelEnabled: false, curveSegments: 6 }); g.rotateY(Math.PI / 2); g.translate(dx(15.55), 0, 0);
    gb.add('dUnder', g);
    for (const s of [-1, 1]) { gb.add('dSteel', new THREE.CylinderGeometry(0.09, 0.09, 0.06, 12).rotateX(Math.PI / 2), M(dx(9.2), 0.98, s * 1.4)); box('white', 12.6, 12.85, 0.72, 0.98, s * 1.378, s * 1.386); box('dSteel', 10.4, 10.55, 0.6, 1.1, s * 1.375, s * 1.4); }
  }
  for (const a of DG.trucks) box('dUnder', a - 0.45, a + 0.45, 1.08, 1.18, -1.0, 1.0);   // body bolsters on the trucks
  dieselDetail(gb, { box, rod, W, HZ, D, N0, NF, yF, CAB0, CAB1, ROOF, DBH, DB1, HOOD, RADH, RAD0, RAD1, WING });
  const statics = gb.build({ ...RMAT, ...skin });
  body.add(statics);
  // headlight beam & halo
  const hlY = 4.475, hlA = 2.766 - 0.12 - 0.12;   // up on the brow, between the number boards (aB - 0.12)
  const beam = headBeam(dx(hlA), hlY, -0.045); body.add(beam);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  halo.position.set(dx(hlA - 0.02), hlY, 0); halo.scale.set(2.4, 1.6, 1); body.add(halo);
  /* ---- Hi-Ad style trucks (swivel; placed by the train) ---- */
  const trucks = [], wheels = [];
  const ax = plainAxle(DG.rW, true, RAIL_OFF, 1.16, 28);
  for (let t = 0; t < 2; t++) {
    const grp = new THREE.Group(), tg = new GeoBin();
    for (const s of [-1, 1]) {
      const sf = new THREE.Shape();               // sideframe profile with pedestal jaws around each axle
      sf.moveTo(-2.62, 0.78); sf.lineTo(-2.45, 0.98); sf.lineTo(2.45, 0.98); sf.lineTo(2.62, 0.78);
      for (const x of [2.0, 0, -2.0]) { sf.lineTo(x + 0.42, 0.74); sf.lineTo(x + 0.3, 0.3); sf.lineTo(x - 0.3, 0.3); sf.lineTo(x - 0.42, 0.74); }
      sf.closePath();
      const g = new THREE.ExtrudeGeometry(sf, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
      g.translate(0, 0, s * 1.06 - 0.08); tg.add('dUnder', g);
      for (const x of [-DG.axle, 0, DG.axle]) {
        tg.add('dSteel', new THREE.CylinderGeometry(0.15, 0.15, 0.08, 14).rotateX(Math.PI / 2), M(x, DG.rW, s * 1.17));   // journal end caps
        for (const dz of [-1, 1]) tg.add('dSteel', new THREE.CylinderGeometry(0.075, 0.075, 0.22, 10), M(x + 0.2 * dz, 0.87, s * 1.2));  // coil springs
        tg.box('dSafety', 0.04, 0.04, 0.24, x, 0.99, s * 1.06);
      }
      tg.add('dUnder', new THREE.CylinderGeometry(0.11, 0.11, 0.34, 10).rotateZ(Math.PI / 2), M(-1.0, 0.88, s * 1.2));
      tg.add('dUnder', new THREE.CylinderGeometry(0.11, 0.11, 0.34, 10).rotateZ(Math.PI / 2), M(1.0, 0.88, s * 1.2));
      tg.add('dSteel', new THREE.CylinderGeometry(0.045, 0.045, 0.6, 8), M(0.35, 0.72, s * 1.22, 0, 0, 0.7));   // shock absorber
      tg.box('dUnder', 0.46, 0.4, 0.3, s * 2.66, 0.9, s * 1.0);   // sand boxes
    }
    // traction motors hung on their axles, noses carried on the transoms
    for (const x of [-DG.axle, 0, DG.axle]) {
      const d = x > 0 ? -1 : 1, cx = x + d * 0.42 * (x === 0 ? -1 : 1);
      tg.add('dUnder', new THREE.CylinderGeometry(0.36, 0.36, 0.96, 14).rotateX(Math.PI / 2), M(cx, 0.52, 0));
      const tx = x === 0 ? -1.0 : x > 0 ? 1.0 : -1.0, nx = cx + Math.sign(tx - cx) * 0.3;
      tg.box('dUnder', Math.abs(tx - nx) + 0.1, 0.16, 0.3, (tx + nx) / 2, 0.78, 0);
    }
    for (const x of [-1.0, 1.0]) tg.box('dUnder', 0.25, 0.16, 2.1, x, 0.88, 0);   // transoms between the sideframes
    tg.box('dUnder', 2.1, 0.22, 1.2, 0, 1.0, 0);   // bolster on the transoms, between the middle wheels
    dieselTruckDetail(tg);
    grp.add(tg.build(RMAT));
    for (const x of [-DG.axle, 0, DG.axle]) {
      const wg = new THREE.Group(); wg.position.set(x, DG.rW, 0);
      wg.add(new THREE.Mesh(ax.black, RMAT.black), new THREE.Mesh(ax.tire, RMAT.tire));
      grp.add(wg); wheels.push(wg);
    }
    grp.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    trucks.push(grp);
  }
  const hit = new THREE.Mesh(new THREE.BoxGeometry(22, 4.6, 3.2), RMAT.hit); hit.position.set(0, 2.4, 0); body.add(hit);
  root.traverse(o => { if (o.isMesh && o.material !== RMAT.glassT && o.material !== RMAT.hit && !o.userData.cpl) { o.castShadow = true; o.receiveShadow = true; } });
  beam.castShadow = false;
  if (!lead) { beam.visible = false; halo.visible = false; ditch.forEach(d => { d.lens.material.color.setScalar(0.12); d.halo.visible = false; }); }
  return {
    root, body, trucks, wheels, couplers, lens: lenses[0], lenses, beam, halo, ditch, spec, skin, livery: L, number: num, diesel: true, lead, len: DG.len, frame: DG.trucks.slice(),
    stackPos: new THREE.Vector3(dx(11.5), HOOD + 0.3, 0), hornPos: new THREE.Vector3(dx(6.0), DBH + 0.35, 0), enginePos: new THREE.Vector3(dx(12.5), 2.9, 0),
    cabEye: cab.eye, cab, headlightPos: new THREE.Vector3(dx(hlA), hlY, 0), cabLightPos: new THREE.Vector3(dx(4.1), 4.25, 0), bellRig: bellRigD,
  };
}
let _louverTex = null;
function louverTex() {
  return _louverTex || (_louverTex = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#d6d6d6'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 6) { g.fillStyle = '#3c3c3c'; g.fillRect(0, y, w, 2); g.fillStyle = '#f2f2f2'; g.fillRect(0, y + 2, w, 1); } g.fillStyle = '#5a5a5a'; g.fillRect(0, 0, 2, h); g.fillRect(w - 2, 0, 2, h); }));
}

/* ---------------- detail (2026-11) ----------------
   The fittings a GE road unit carries that the plain carbody lacked. Everything here stands on or reaches into
   a part that is already there, so nothing floats. c: the builder's own helpers and dimensions. */
function dieselDetail(gb, c) {
  const { box, rod, W, HZ, D, N0, NF, yF, CAB1, ROOF, DBH, HOOD, RADH, RAD0, RAD1, WING } = c;
  // a grab iron: a bar standing `o` off a surface on two legs
  const grab = (k, p, q, o, r = 0.012) => { const P = p.map((v, i) => v + o[i]), Q = q.map((v, i) => v + o[i]); rod(k, r, p.map((v, i) => v - o[i] * 0.2), P, 5); rod(k, r, P, Q, 5); rod(k, r, Q, q.map((v, i) => v - o[i] * 0.2), 5); };
  for (const s of [-1, 1]) {
    // engine room doors: seams along the top and bottom, three hinges on every post
    for (const y of [1.85, 3.92]) box('dUnder', 7.25, 15.3, y - 0.008, y + 0.008, s * (HZ - 0.002), s * (HZ + 0.006));
    for (let a = 7.25; a < 15.3; a += 0.94) for (const y of [2.12, 2.6, 3.66]) box('dSteel', a - 0.03, a + 0.055, y - 0.05, y + 0.05, s * (HZ - 0.002), s * (HZ + 0.016));
    // lifting lugs along the roof edges
    for (const [a, y] of [[5.9, DBH], [8.6, DBH], [10.5, DBH], [11.4, HOOD], [13.2, HOOD], [15.0, HOOD], [16.0, RADH], [21.2, RADH]]) box('dUnder', a - 0.07, a + 0.07, y + 0.01, y + 0.1, s * (HZ - 0.16), s * (HZ - 0.12));
    // mirror and wind deflector ahead of the cab window
    box('dUnder', 3.10, 3.125, 3.56, 4.16, s * (W - 0.01), s * (W + 0.19));
    box('dSteel', 3.124, 3.13, 3.6, 4.12, s * (W + 0.03), s * (W + 0.18));
    // emergency fuel cut-off on the sill, a red cap on the fuel filler
    box('red', 6.86, 6.98, 1.56, 1.67, s * (W - 0.002), s * (W + 0.02));
    gb.cylZ('red', 0.075, 0.035, 12, dx(9.2), 0.98, s * 1.446);
    // sand fillers high on the rear wall and on the nose shoulders
    box('dUnder', RAD1 + 0.01, RAD1 + 0.05, 3.62, 3.86, s * 1.08, s * 1.32);
    box('dSteel', RAD1 + 0.045, RAD1 + 0.06, 3.71, 3.77, s * 1.14, s * 1.26);
  }
  // roof hatch seams
  for (const [a, y] of [[7.1, DBH], [8.85, DBH], [12.6, HOOD], [14.2, HOOD]]) box('dUnder', a - 0.012, a + 0.012, y + 0.02, y + 0.042, -HZ, HZ);
  // exhaust stack: an open rectangular stack standing on the silencer
  {
    const y0 = HOOD + 0.25, y1 = HOOD + 0.4;
    for (const z of [-0.27, 0.27]) box('dUnder', 11.32, 11.68, y0, y1, z - 0.015, z + 0.015);
    for (const a of [11.335, 11.665]) box('dUnder', a - 0.015, a + 0.015, y0, y1, -0.27, 0.27);
    box('black', 11.35, 11.65, y0, y0 + 0.03, -0.255, 0.255);
  }
  // radiator fans: a wire guard over each one
  for (const a of [16.8, 18.75]) {
    for (const r of [0.26, 0.52, 0.79]) gb.add('dSteel', new THREE.TorusGeometry(r, 0.013, 5, 30).rotateX(Math.PI / 2), M(dx(a), RADH + 0.142, 0));
    for (let i = 0; i < 4; i++) gb.box('dSteel', 1.6, 0.016, 0.022, dx(a), RADH + 0.15, 0, 0, i * Math.PI / 4, 0);
    gb.cyl('dUnder', 0.11, 0.11, 0.05, 12, dx(a), RADH + 0.15, 0);
  }
  // satellite and radio antenna domes on the cab roof
  gb.cyl('white', 0.11, 0.13, 0.09, 14, dx(4.9), ROOF + 0.11, 0);
  gb.cyl('white', 0.07, 0.09, 0.07, 12, dx(4.9), ROOF + 0.1, 0.45);
  // handbrake wheel on the hood behind the cab, engineer's side
  {
    const a = 6.25, y = 2.95, z = HZ + 0.075;
    box('dUnder', a - 0.13, a + 0.13, y - 0.42, y + 0.12, HZ - 0.002, HZ + 0.045);
    gb.cylZ('dUnder', 0.035, 0.09, 8, dx(a), y, HZ + 0.04);
    gb.add('dSteel', new THREE.TorusGeometry(0.2, 0.016, 6, 24), M(dx(a), y, z));
    for (let i = 0; i < 3; i++) gb.box('dSteel', 0.4, 0.02, 0.014, dx(a), y, z, 0, 0, i * Math.PI / 3);
  }
  // nose door (conductor's side of the headlights): frame, hinges and handle; grab irons up the engineer's side
  {
    const y0 = D + 0.1, y1 = yF - 0.08, z0 = -0.7, z1 = -0.24, a0 = N0 - 0.008, a1 = N0 + 0.004;
    for (const z of [z0, z1]) box('dUnder', a0, a1, y0, y1, z - 0.008, z + 0.008);
    box('dUnder', a0, a1, y1 - 0.008, y1 + 0.008, z0, z1);
    for (const y of [y0 + 0.2, y1 - 0.2]) box('dSteel', N0 - 0.02, a1, y - 0.05, y + 0.05, z0 - 0.03, z0 + 0.03);
    box('dSteel', N0 - 0.035, a1, 2.5, 2.54, z1 - 0.16, z1 - 0.04);
    // its small window, up high
    box('dUnder', N0 - 0.006, a1, 2.86, 3.14, z0 + 0.1, z0 + 0.3);
    box('glassT', N0 - 0.01, N0 - 0.004, 2.88, 3.12, z0 + 0.12, z0 + 0.28);
    for (const y of [2.1, 2.45, 2.8, 3.1]) grab('dSafety', [dx(N0), y, 0.3], [dx(N0), y, 0.72], [0.06, 0, 0]);
  }
  // rear hood door, and grab irons up the wall beside it
  {
    const xw = RAD1 + 0.02, a0 = xw - 0.004, a1 = xw + 0.008;
    for (const z of [-0.62, 0.02]) box('dUnder', a0, a1, D + 0.04, 3.7, z - 0.008, z + 0.008);
    box('dUnder', a0, a1, 3.692, 3.708, -0.62, 0.02);
    for (const y of [2.1, 3.4]) box('dSteel', a0, xw + 0.02, y - 0.05, y + 0.05, -0.65, -0.59);
    box('dSteel', a0, xw + 0.035, 2.72, 2.76, -0.16, -0.04);
    for (let y = 2.1; y < 4.15; y += 0.4) grab('dSafety', [dx(xw), y, 0.42], [dx(xw), y, 0.84], [-0.06, 0, 0]);
  }
  // uncoupling levers across both pilots, in brackets on the end plate
  for (const e of [0, 1]) {
    const A = e ? DG.len : 0, sg = e ? -1 : 1, x = dx(A + sg * 0.385), y = 1.34;
    rod('dSteel', 0.012, [x, y, -1.0], [x, y, 1.0], 5);
    for (const s of [-1, 1]) { rod('dSteel', 0.012, [x, y, s * 1.0], [x, y - 0.14, s * 1.04], 5); box('dUnder', A + sg * 0.36, A + sg * 0.425, y - 0.03, y + 0.03, s * 0.5 - 0.02, s * 0.5 + 0.02); }
    rod('dSteel', 0.012, [x, y, 0.12], [x, y - 0.2, 0.05], 5);
  }
}
/* one truck's fittings: a brake shoe on every wheel hung from the side frame with a beam across, bolted bearing
   caps, and sand pipes down to the rail ahead of the outer wheels */
function dieselTruckDetail(tg, A = DG.axle, R = DG.rW) {
  const th = 0.2, rs = R + 0.047;
  for (const [xa, d] of [[-A, -1], [0, 1], [A, 1]]) {      // each shoe on the side away from its axle's motor
    const cx = xa + d * rs * Math.cos(th), cy = R - rs * Math.sin(th);
    for (const s of [-1, 1]) {
      tg.add('dark', new THREE.BoxGeometry(0.05, 0.34, 0.09).rotateZ(-d * th), M(cx, cy, s * RAIL_OFF));
      tg.box('dark', 0.07, 0.16, 0.12, cx + d * 0.05, cy, s * (RAIL_OFF - 0.01));
      tg.add('dark', barGeo(0.018, [cx + d * 0.06, cy, s * (RAIL_OFF + 0.04)], [xa + d * 0.5, 0.84, s * 0.985], 5));
    }
    tg.add('dark', barGeo(0.03, [cx + d * 0.075, cy, -RAIL_OFF], [cx + d * 0.075, cy, RAIL_OFF], 6));
  }
  for (const s of [-1, 1]) {
    for (const x of [-A, 0, A]) {
      tg.cylZ('dUnder', 0.07, 0.03, 10, x, R, s * 1.22);
      for (let i = 0; i < 3; i++) tg.cylZ('dUnder', 0.02, 0.02, 6, x + 0.105 * Math.cos(i * TAU / 3 + 0.5), R + 0.105 * Math.sin(i * TAU / 3 + 0.5), s * 1.215);
    }
    tg.tube('dSteel', [[s * (A + 0.64), 0.74, s * 0.92], [s * (A + 0.64), 0.45, s * 0.8], [s * (A + 0.62), 0.13, s * RAIL_OFF]], 0.015, 10, 5);
  }
}

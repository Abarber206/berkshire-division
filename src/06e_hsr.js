/* ============================================================================
   High-speed trainsets: fixed electric multiple units that run as one train.
   JR East E5 series "Hayabusa" Shinkansen: ten cars, 253 m, 9,600 kW from
   32 x 300 kW motors on cars 2-9, 320 km/h. 3.35 m wide, 3.65 m high, end cars
   26.5 m with a 15 m nose, intermediate cars 25 m, bogie centres 17.5 m,
   2.5 m bogie wheelbase, 860 mm wheels. Tokiwa green over Hiun white with a
   Hayate pink stripe. Pantographs on cars 3 and 7, one raised in service.
   Amtrak Acela Express (Bombardier / Alstom, 2000): two 4,600 kW power cars and
   six tilting coaches, 202.3 m, 150 mph in service. Power cars 21.22 m long,
   3.18 m wide, 4.32 m high, truck centres 10.74 m, 40 in wheels; coaches 26.64 m,
   3.16 m wide, 4.23 m high, truck centres 18.14 m, 36 in wheels.
   Local frame like the diesel: +X forward, origin midway between the truck
   centres at rail top. a = metres back from the car's front end.
   ========================================================================== */
const HSR = {
  e5: {
    name: 'E5 Hayabusa', vmaxKmh: 320, wireH: 5.5,
    /* type, length, mass (t), motored, pantograph at a, seating class, number */
    cars: [
      { type: 'nose', len: 26.5, t: 41.9, motor: false, cls: 'ord', num: 'E523-19' },
      { type: 'mid', len: 25, t: 45.9, motor: true, cls: 'ord', num: 'E526-119' },
      { type: 'mid', len: 25, t: 46.0, motor: true, cls: 'ord', num: 'E525-19', pan: 7.6 },
      { type: 'mid', len: 25, t: 46.3, motor: true, cls: 'ord', num: 'E526-219' },
      { type: 'mid', len: 25, t: 46.1, motor: true, cls: 'ord', num: 'E525-419' },
      { type: 'mid', len: 25, t: 46.8, motor: true, cls: 'ord', num: 'E526-319' },
      { type: 'mid', len: 25, t: 46.8, motor: true, cls: 'ord', num: 'E525-119', pan: 7.6, raised: true },
      { type: 'mid', len: 25, t: 46.0, motor: true, cls: 'ord', num: 'E526-419' },
      { type: 'mid', len: 25, t: 45.8, motor: true, cls: 'green', num: 'E515-19' },
      { type: 'nose', len: 26.5, t: 42.7, motor: false, cls: 'gran', num: 'E514-19' },
    ],
  },
  acela: {
    name: 'Acela Express', wireH: 5.5,
    cars: [
      { type: 'power', len: 21.22, t: 93, motor: true, num: '2010' },
      { type: 'coach', len: 26.64, t: 64, cls: 'first', num: '3210' },
      { type: 'coach', len: 26.64, t: 63, cls: 'bus', num: '3510' },
      { type: 'coach', len: 26.64, t: 63, cls: 'bus', num: '3520' },
      { type: 'coach', len: 26.64, t: 62, cls: 'cafe', num: '3310' },
      { type: 'coach', len: 26.64, t: 63, cls: 'bus', num: '3530' },
      { type: 'coach', len: 26.64, t: 64, cls: 'bus', num: '3540' },
      { type: 'power', len: 21.22, t: 93, motor: true, num: '2011' },
    ],
  },
};
/* air resistance of each car in lbf per mph squared, [leading, in the train]; with the rolling terms this gives
   the E5 about 0.04 m/s2 in hand at 320 km/h on the level, and the Acela a balancing speed a little over 165 mph */
const HS_AERO = { e5: { nose: [0.12, 0.03], mid: [0.3, 0.024] }, acela: { power: [0.2, 0.045], coach: [0.3, 0.03] } };
/* E5: 32 motors x 300 kW, 1.71 km/h/s starting (about 250 kN on the 453.5 t set with a full load), 320 km/h.
   Acela: two power cars, each 4,600 kW and 49,500 lbf starting. Regenerative braking on both; the
   Acela's power cars can also burn it in rheostats when the line will not take it. */
Object.assign(LOCO_SPEC, {
  e5: { road: 'JR EAST', num: 'U19', short: 'JRE', cls: 'E5', built: 'Hitachi / Kawasaki, 2013', set: 'e5', diesel: true, elec: true, hs: true,
    weight: 453500 / 0.4536, adhesive: 369700 / 0.4536, te: 250e3 / LBF, P: 9.6e6, TEmax: 250e3, RP: 10.5e6, RBmax: 235e3, rheo: false, vmax: 320 / 1.609344, whistle: 'shin', bell: false, ditch: false },
  acela: { road: 'AMTRAK', num: '2010', short: 'AMTK', cls: 'Acela', built: 'Bombardier / Alstom, 2000', set: 'acela', diesel: true, elec: true, hs: true,
    weight: 1246000, adhesive: 408000, te: 99000, P: 9.2e6, TEmax: 440e3, RP: 8.0e6, RBmax: 300e3, rheo: true, vmax: 150, whistle: 'k5', bell: true, ditch: true },
});

function hsMaterials() {
  if (RMAT.hsGlass) return;
  const mk = (c, m, r, extra = {}) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r, ...extra });
  RMAT.hsGlass = mk(0x0d1418, 0.6, 0.06, { side: THREE.DoubleSide, transparent: true, opacity: 0.4, depthWrite: false });
  RMAT.hsWin = new THREE.MeshStandardMaterial({ color: 0x141b20, metalness: 0.4, roughness: 0.08, emissive: 0xeaf1ff, emissiveIntensity: 0 });
  SCN.winMats.push(RMAT.hsWin);
  RMAT.hsUnder = mk(0x2b2e30, 0.4, 0.7, { side: THREE.DoubleSide });
  RMAT.hsBogie = mk(0x3a3d40, 0.5, 0.55);
  RMAT.hsSteel = mk(0x8b9095, 0.8, 0.35);
  RMAT.hsRubber = mk(0x1b1c1d, 0.0, 0.92, { side: THREE.DoubleSide });
  RMAT.hsSeam = mk(0x5d6266, 0.3, 0.6);
  RMAT.hsIns = mk(0x9a5a3a, 0.1, 0.4);       // brown porcelain insulators
  RMAT.hsPan = mk(0x9ea3a8, 0.7, 0.35);
  RMAT.hsCarbon = mk(0x1c1d1e, 0.2, 0.6);
  RMAT.hsTail = new THREE.MeshBasicMaterial({ color: 0xff2a1e });
  RMAT.hsTailOff = mk(0x5a1612, 0.4, 0.2);
  RMAT.hsLamp = mk(0xd9dde0, 0.6, 0.12);     // lamp housing behind the lens
}

/* ---------------- lofted bodies ----------------
   A half section runs from the bottom centre round the right side to the roof centre:
   flat bottom, rounded bottom corner (radius ch), a side from yb + ch to the shoulder ys (leaning in by
   tum at the top), then a superellipse (exponent n) over to the roof at yt. Point CUT_I lies on the side
   at height cut, where the body is cut away over the bogies. When the section carries window heights wy = [y0, y1],
   the two side points between the cut and the shoulder sit on them, so a window is one strip of the ring (WIN_J). */
const HS_HALF = 24, CUT_I = 6;
function hsHalf(p, cut) {
  const pts = [[0, p.yb], [(p.w - p.ch) * 0.5, p.yb], [p.w - p.ch, p.yb]];
  for (let i = 1; i <= 3; i++) { const t = i / 3 * Math.PI / 2; pts.push([p.w - p.ch + Math.sin(t) * p.ch, p.yb + p.ch - Math.cos(t) * p.ch]); }
  const y0 = p.yb + p.ch, tum = p.tum || 0, zs = y => p.w - tum * clamp((y - y0) / Math.max(0.01, p.ys - y0), 0, 1) ** 1.6;
  const yc = clamp(cut, y0 + 0.002, p.ys - 0.002);
  pts.push([zs(yc), yc]);
  const wy = p.wy && p.wy[0] > yc + 0.05 && p.wy[1] < p.ys - 0.005 ? p.wy : null;
  for (let i = 1; i <= 3; i++) { const y = wy && i < 3 ? wy[i - 1] : lerp(yc, p.ys, i / 3); pts.push([zs(y), y]); }
  const ws = p.w - tum;
  for (let i = 1; i <= 14; i++) { const t = i / 14 * Math.PI / 2; pts.push([ws * Math.pow(Math.cos(t), 2 / p.n), p.ys + (p.yt - p.ys) * Math.pow(Math.sin(t), 2 / p.n)]); }
  pts[pts.length - 1][0] = 0;
  return pts;
}
/* the whole ring, bottom centre round the right side, over the roof and down the left side */
function hsRing(p, cut) {
  const h = hsHalf(p, cut), R = h.slice();
  for (let i = HS_HALF - 2; i >= 0; i--) R.push([-h[i][0], h[i][1]]);
  return R;
}
const RING_N = 2 * HS_HALF - 1, CUT_L = RING_N - 1 - CUT_I;   // 47 points; the left cut point
const WIN_J = CUT_I + 1, ROOF_J = CUT_I + 3;                      // window bottom (top is the next point); the shoulder, where the roof starts
const mirJ = j => RING_N - 1 - j;                                 // the same point on the left
/* the half width of the body at height y on station ring R (right side) */
function ringZ(R, y) {
  for (let i = 0; i < HS_HALF - 1; i++) {
    const a = R[i], b = R[i + 1];
    if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) return lerp(a[0], b[0], (y - a[1]) / (b[1] - a[1]));
  }
  return 0;
}

/* the height of the roof at |z| on station ring R */
function ringTop(R, z) {
  for (let i = HS_HALF - 1; i > 0; i--) {
    const a = R[i], b = R[i - 1];
    if (z >= a[0] && z <= b[0] && b[0] > a[0]) return lerp(a[1], b[1], (z - a[0]) / (b[0] - a[0]));
  }
  return R[HS_HALF - 1][1];
}
/* Triangles from stations (each {a, R}) over ring indices idx, with UVs planar in (a, y);
   skip(a0, a1, j0, j1) leaves a quad out (a window or windscreen opening) */
function loftInto(acc, st, idx, ref, uvL, uvH, out = 0, skip = null) {
  const base = acc.pos.length / 3;
  for (const s of st) for (const j of idx) {
    const [z, y] = s.R[j], k = out ? 1 + out / Math.max(0.3, Math.hypot(z, y - 1.6)) : 1;
    acc.pos.push(ref - s.a, out ? 1.6 + (y - 1.6) * k : y, z * k);
    acc.uv.push(s.a / uvL, y / uvH);
  }
  const n = idx.length;
  for (let i = 0; i < st.length - 1; i++) for (let j = 0; j < n - 1; j++) {
    if (skip && skip(st[i].a, st[i + 1].a, idx[j], idx[j + 1])) continue;
    const A = base + i * n + j, B = A + 1, C = A + n + 1, D = A + n;
    acc.idx.push(A, B, C, A, C, D);
  }
}
/* a flat polygon (convex or star-shaped about its centroid) given as [x, y, z] points, facing nrm */
function capInto(acc, pts, nrm, uvf) {
  const base = acc.pos.length / 3, c = [0, 0, 0];
  for (const p of pts) { c[0] += p[0] / pts.length; c[1] += p[1] / pts.length; c[2] += p[2] / pts.length; }
  for (const p of [c, ...pts]) { acc.pos.push(p[0], p[1], p[2]); acc.uv.push(...(uvf ? uvf(p) : [0, 0])); }
  for (let i = 0; i < pts.length; i++) {
    const a = base + 1 + i, b = base + 1 + (i + 1) % pts.length;
    const e1 = [pts[i][0] - c[0], pts[i][1] - c[1], pts[i][2] - c[2]], q = pts[(i + 1) % pts.length], e2 = [q[0] - c[0], q[1] - c[1], q[2] - c[2]];
    const nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
    if (nx * nrm[0] + ny * nrm[1] + nz * nrm[2] >= 0) acc.idx.push(base, a, b); else acc.idx.push(base, b, a);
  }
}
const newMesh = () => ({ pos: [], uv: [], idx: [] });
function meshGeo(acc) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(acc.pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(acc.uv, 2));
  g.setIndex(acc.idx); g.computeVertexNormals();
  return g;
}
/* a rounded rectangle lying on the plane z = 0, in (x, y) */
function rrectGeo(w, h, r, seg = 4) {
  const s = new THREE.Shape(), x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2;
  s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r); s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1);
  s.lineTo(x0 + r, y1); s.quadraticCurveTo(x0, y1, x0, y1 - r); s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return new THREE.ShapeGeometry(s, seg);
}

/* Build the body of one car. B describes the body:
   sect(a) -> section params at a; len; ends: [front, rear] each 'nose' | 'joint'; cut: bogie well height;
   wells: [[a0, a1], ...] cut away for the bogies; skin: material key; uvL/uvH texture size in metres.
   holes: [[a0, a1], ...] window openings, both sides, on the ring's window strip (the section's wy);
   canopy: { A0, A1, th0(a) } a windscreen over the roof (see hsCanopy). Returns the stations. */
function hsBody(gb, B, ref) {
  const L = B.len, st = [], holes = B.holes || [], cn = B.canopy;
  const grid = new Set([...B.stations]);
  for (const [w0, w1] of B.wells) { grid.add(w0); grid.add(w1); for (let a = w0; a < w1; a += 0.5) grid.add(a); }
  for (const [h0, h1] of holes) { grid.add(h0); grid.add(h1); }
  for (const a of B.extra || []) grid.add(a);
  if (cn) for (let k = 0; k <= 16; k++) grid.add(lerp(cn.A0, cn.A1, k / 16));
  const as = [...grid].filter(a => a >= B.a0 - 1e-6 && a <= B.a1 + 1e-6).sort((x, y) => x - y);
  for (const a of as) { const p = B.sect(a); st.push({ a, p, R: hsRing(p, B.cut) }); }
  const skin = newMesh(), under = newMesh();
  const upper = []; for (let j = CUT_I; j <= CUT_L; j++) upper.push(j);
  const lower = []; for (let j = CUT_L; j < RING_N; j++) lower.push(j); for (let j = 1; j <= CUT_I; j++) lower.push(j);
  lower[lower.indexOf(RING_N - 1)] = 0;
  const within = (a0, a1, h0, h1) => a0 >= h0 - 1e-6 && a1 <= h1 + 1e-6;
  const skip = (a0, a1, j0, j1) => (cn && j0 >= ROOF_J && j1 <= mirJ(ROOF_J) && within(a0, a1, cn.A0, cn.A1))
    || (((j0 === WIN_J && j1 === WIN_J + 1) || (j1 === mirJ(WIN_J) && j0 === mirJ(WIN_J + 1))) && holes.some(([h0, h1]) => within(a0, a1, h0, h1)));
  loftInto(skin, st, upper, ref, B.uvL, B.uvH, 0, skip);
  if (cn) hsCanopy(gb, B, st.filter(s => within(s.a, s.a, cn.A0, cn.A1)), ref);
  // below the cut: everywhere except over the bogies, where the well roof and its end walls close the body
  const inWell = (a0, a1) => B.wells.some(([w0, w1]) => a0 >= w0 - 1e-6 && a1 <= w1 + 1e-6);
  let run = [];
  const flush = () => { if (run.length > 1) loftInto(skin, run, lower, ref, B.uvL, B.uvH); run = []; };
  for (let i = 0; i < st.length; i++) {
    if (i < st.length - 1 && inWell(st[i].a, st[i + 1].a)) { run.push(st[i]); flush(); continue; }
    run.push(st[i]);
  }
  flush();
  for (const [w0, w1] of B.wells) {
    const ws = st.filter(s => s.a >= w0 - 1e-6 && s.a <= w1 + 1e-6);
    // well roof: a flat plate at the cut height from side to side
    const base = under.pos.length / 3;
    for (const s of ws) { const zr = s.R[CUT_I][0], zl = s.R[CUT_L][0]; under.pos.push(ref - s.a, B.cut, zl, ref - s.a, B.cut, zr); under.uv.push(0, 0, 0, 0); }
    for (let i = 0; i < ws.length - 1; i++) { const A = base + 2 * i; under.idx.push(A, A + 2, A + 3, A, A + 3, A + 1); }
    for (const [s, n] of [[ws[0], -1], [ws[ws.length - 1], 1]]) {
      const pts = lower.map(j => [ref - s.a, s.R[j][1], s.R[j][0]]);
      capInto(under, pts, [n, 0, 0]);
    }
  }
  // flat ends at a joint (the rubber gangway cover closes the rest)
  for (const [s, n] of [[st[0], 1], [st[st.length - 1], -1]]) {
    if (s.R[0][1] >= s.R[HS_HALF - 1][1] - 0.01) continue;   // a nose closes to a point
    const pts = []; for (let j = 0; j < RING_N - 1; j++) pts.push([ref - s.a, s.R[j][1], s.R[j][0]]);
    capInto(under, pts, [n, 0, 0]);
  }
  gb.add(B.skin, meshGeo(skin));
  gb.add('hsUnder', meshGeo(under));
  return st;
}
/* The windscreen over a cab: between A0 and A1 the roof is a frame of skin either side of the glass, which runs
   from angle th0(a) on the right to pi - th0 on the left. The angle is the roof's own parameter (hsSup), so frame,
   rubber and glass share their edges, and at A0 and A1 (th0 = pi / 2) the frame is the roof itself. */
function hsCanopy(gb, B, cst, ref) {
  const fr = newMesh(), rb = newMesh(), gl = newMesh(), F = [], Rb = [], G = [];
  const mir = R => R.map(([z, y]) => [-z, y]);
  for (const s of cst) {
    const p = s.p, th0 = B.canopy.th0(s.a), d = 0.025 * clamp((Math.PI / 2 - th0) / 0.1, 0, 1);
    const R = []; for (let i = 0; i <= 14; i++) R.push(hsSup(p, (th0 - d) * i / 14));
    F.push({ a: s.a, R });
    Rb.push({ a: s.a, R: [hsSup(p, th0 - d), hsSup(p, th0)] });
    const ws = p.w - (p.tum || 0), Gr = [];
    for (let j = 0; j <= 10; j++) { const th = lerp(th0, Math.PI - th0, j / 10), c = Math.cos(th); Gr.push([Math.sign(c) * ws * Math.pow(Math.abs(c), 2 / p.n), p.ys + (p.yt - p.ys) * Math.pow(Math.sin(th), 2 / p.n)]); }
    G.push({ a: s.a, R: Gr });
  }
  const i15 = [...Array(15).keys()];
  loftInto(fr, F, i15, ref, B.uvL, B.uvH); loftInto(fr, F.map(f => ({ a: f.a, R: mir(f.R) })), i15, ref, B.uvL, B.uvH);
  loftInto(rb, Rb, [0, 1], ref, 1, 1); loftInto(rb, Rb.map(f => ({ a: f.a, R: mir(f.R) })), [0, 1], ref, 1, 1);
  loftInto(gl, G, [...Array(11).keys()], ref, 1, 1);
  gb.add(B.skin, meshGeo(fr)); gb.add('hsRubber', meshGeo(rb)); gb.add('hsGlass', meshGeo(gl));
}
/* Full-section rubber gangway cover from the body end out to the car end (a0 -> a1), a little inside the body */
function hsGangway(gb, sect, a0, a1, ref, k = 0.975) {
  const p = sect(a0), R = hsRing({ ...p, w: p.w * k, yt: 1.6 + (p.yt - 1.6) * k, yb: p.yb + 0.08, ys: p.ys, ch: p.ch * k }, 1.0);
  const acc = newMesh(), idx = []; for (let j = 0; j < RING_N; j++) idx.push(j);
  loftInto(acc, [{ a: a0, R }, { a: a1, R }], idx, ref, 1, 1);
  const pts = []; for (let j = 0; j < RING_N - 1; j++) pts.push([ref - a1, R[j][1], R[j][0]]);
  capInto(acc, pts, [a1 > a0 ? -1 : 1, 0, 0]);
  gb.add('hsRubber', meshGeo(acc));
  // folds of the bellows
  for (let a = Math.min(a0, a1) + 0.05; a < Math.max(a0, a1) - 0.02; a += 0.075) {
    const r2 = R.map(([z, y]) => [z * 1.004, 1.6 + (y - 1.6) * 1.004]), f = newMesh();
    loftInto(f, [{ a, R: r2 }, { a: a + 0.02, R: r2 }], idx, ref, 1, 1);
    gb.add('hsRubber', meshGeo(f));
  }
}

/* ---------------- liveries ---------------- */
/* texture over (a, y): u = a / uvL, v = y / uvH. draw(g, X, Y) gets metre to pixel mappers */
function hsSkin(key, uvL, uvH, w, h, draw, opts = {}) {
  if (RMAT[key]) return RMAT[key];
  const tex = canvasTex(w, h, (g, W, H) => draw(g, a => a / uvL * W, y => H - y / uvH * H, W, H));
  return (RMAT[key] = new THREE.MeshStandardMaterial({ map: tex, metalness: opts.metal ?? 0.25, roughness: opts.rough ?? 0.32, side: THREE.DoubleSide }));
}
const E5C = { green: '#0f6b4c', white: '#eef0ec', pink: '#e8558f', silver: '#a9adb1' };

/* ---------------- E5 ---------------- */
const E5 = { HW: 1.675, ROOF: 3.65, LN: 15.0, CUT: 1.12, YB: 0.62, SH: 2.62, BOG: 17.5, OV: 3.75, WB: 2.5, R: 0.43, GW: 0.3 };
/* section of an E5 body at a metres from the nose tip (end car), or anywhere on an intermediate car (nose = false) */
function e5Sect(a, nose) {
  const { HW, ROOF, LN, YB, SH } = E5;
  if (!nose || a >= LN) return { yb: YB, w: HW, ys: SH, yt: ROOF, ch: 0.24, n: 2.5 };
  const t = clamp(a / LN, 0, 1);
  let w = 0.62 + (HW - 0.62) * (1 - Math.pow(1 - t, 2.4));
  let yt = 1.0 + (ROOF - 1.0) * Math.pow(Math.sin(t * Math.PI / 2), 1.45) + 0.2 * Math.exp(-(((a - 10.0) / 1.9) ** 2)) * (1 - smooth(12.5, LN, a));
  yt = Math.min(yt, ROOF + 0.0);
  let yb = YB - 0.3 * (1 - smooth(0, 4.5, a));
  let ys = yb + 0.3 + (SH - YB - 0.3) * Math.pow(smooth(0, 9, a), 0.7);
  let ch = 0.24;
  const n = lerp(2.0, 2.5, t);
  // the tip rounds off to a point in both plan and side view
  const RC = 0.9, q = Math.sqrt(Math.max(0, 1 - (1 - Math.min(a, RC) / RC) ** 2)), yc = 0.68;
  if (a < RC) { w *= q; yb = yc + (yb - yc) * q; yt = yc + (yt - yc) * q; ys = yc + (ys - yc) * q; ch *= q; }
  return { yb, w: Math.max(w, 0.0005), ys, yt, ch: Math.min(ch, Math.max(0.0004, (ys - yb) * 0.45)), n };
}
/* the green over the white: the boundary (top of the pink stripe) at a from the nose tip */
const e5Line = a => a >= E5.LN ? 2.86 : 0.98 + (2.86 - 0.98) * Math.pow(a / E5.LN, 0.85);
function e5Skin(nose) {
  const L = nose ? 26.5 : 25;
  return hsSkin(nose ? 'e5SkinNose' : 'e5SkinMid', L, 4, 2048, 256, (g, X, Y, W, H) => {
    g.fillStyle = E5C.white; g.fillRect(0, 0, W, H);
    g.beginPath(); g.moveTo(0, 0);
    for (let a = 0; a <= L + 0.01; a += 0.1) g.lineTo(X(a), Y(nose ? e5Line(a) : 2.86));
    g.lineTo(W, 0); g.closePath(); g.fillStyle = E5C.green; g.fill();
    g.beginPath();
    for (let a = 0; a <= L + 0.01; a += 0.1) g.lineTo(X(a), Y(nose ? e5Line(a) : 2.86));
    for (let a = L; a >= -0.01; a -= 0.1) g.lineTo(X(a), Y((nose ? e5Line(a) : 2.86) - 0.085));
    g.closePath(); g.fillStyle = E5C.pink; g.fill();
    // a faint panel line along the bottom of the body side
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, Y(0.9), W, 1);
  });
}
/* E5 car: def from HSR.e5.cars. Built nose forward (a = 0 at the nose tip or the joint at car 1's end) */
function buildE5Car(def, idx) {
  hsMaterials(); hsIntMaterials();
  const nose = def.type === 'nose', L = def.len, rev = idx === HSR.e5.cars.length - 1;
  const t0 = nose ? L - E5.OV - E5.BOG : E5.OV, t1 = L - E5.OV, ref = (t0 + t1) / 2, x = a => ref - a;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const gb = new GeoBin();
  const skinKey = nose ? 'e5SkinNose' : 'e5SkinMid'; e5Skin(nose);
  // the side windows sit on the constant body behind the nose: put two ring points on their sill and head
  const WY = [2.08, 2.58], sect = a => Object.assign(e5Sect(a, nose), !nose || a >= E5.LN ? { wy: WY } : {});
  const pitch = def.cls === 'gran' ? 1.3 : def.cls === 'green' ? 1.16 : 1.04, wW = def.cls === 'ord' ? 0.62 : 0.78;
  // seating saloon between the vestibules, a window to each row of seats; car 1 and car 10 lose the front of the car to the nose and cab
  const s0 = nose ? E5.LN + 1.2 : 3.4, s1 = L - 3.1, door1 = L - 1.85;
  const n = Math.floor((s1 - s0) / pitch), wins = [];
  for (let i = 0; i < n; i++) wins.push(s0 + (s1 - s0 - (n - 1) * pitch) / 2 + i * pitch);
  const holes = wins.map(a => [a - wW / 2, a + wW / 2]), S0 = s0 - 0.5, S1 = s1 + 0.5;
  const CB = { A0: 7.8, A1: 12.5, yF: 1.95 };
  const canopy = nose ? { A0: 8.0, A1: 11.6, th0: a => Math.PI / 2 - (Math.PI / 2 - 0.55) * Math.pow(Math.sin(Math.PI * clamp((a - 8.0) / 3.6, 0, 1)), 0.45) } : null;
  const stations = [];
  if (nose) { for (const a of [0, 0.01, 0.03, 0.06, 0.1, 0.16, 0.24, 0.34, 0.47, 0.62, 0.8, 1.0, 1.25]) stations.push(a); for (let a = 1.5; a < E5.LN; a += 0.35) stations.push(a); }
  for (const a of [nose ? E5.LN : E5.GW, L - E5.GW]) stations.push(a);
  const wells = [[t0 - 1.75, t0 + 1.75], [t1 - 1.75, t1 + 1.75]];
  const st = hsBody(gb, { len: L, a0: nose ? 0 : E5.GW, a1: L - E5.GW, stations, wells, cut: E5.CUT, sect, skin: skinKey, uvL: L, uvH: 4, holes, canopy, extra: nose ? [S0, S1, CB.A0, CB.A1] : [S0, S1] }, ref);
  if (!nose) hsGangway(gb, sect, E5.GW, 0.0, ref);
  hsGangway(gb, sect, L - E5.GW, L, ref);

  /* ---- windows, doors, lettering ---- */
  const HW = E5.HW, side = s => s * (HW + 0.004);
  const door = (a, w = 1.0) => {
    for (const s of [-1, 1]) {
      const z = s * (HW + 0.003);
      for (const da of [-w / 2, w / 2]) gb.box('hsSeam', 0.012, 1.62, 0.004, x(a + da), 0.95 + 0.81, z);
      gb.box('hsSeam', w, 0.012, 0.004, x(a), 2.57, z);
      gb.add('hsWin', rrectGeo(0.36, 0.5, 0.08), M(x(a), 2.22, s * (HW + 0.005), 0, s > 0 ? 0 : Math.PI, 0));   // door window
      gb.box('hsSeam', w * 0.9, 0.05, 0.08, x(a), 0.93, s * (HW - 0.01));   // step plate in the doorway sill
    }
  };
  door(door1);
  if (!nose) door(1.85);
  else {
    // crew door behind the cab, and the cab side window
    for (const s of [-1, 1]) {
      const z = s * (ringZ(hsRing(sect(13.3), E5.CUT), 1.8) + 0.003);
      for (const da of [-0.33, 0.33]) gb.box('hsSeam', 0.012, 1.6, 0.004, x(13.3 + da), 1.0 + 0.8, z);
      gb.box('hsSeam', 0.66, 0.012, 0.004, x(13.3), 2.6, z);
    }
  }
  // car number by the door, and a class mark on the Green and Gran Class cars
  const nk = 'e5n_' + def.num; RMAT[nk] = RMAT[nk] || textDecal(def.num, 512, 96, '#2b2f31', 'sans', 54);
  for (const s of [-1, 1]) gb.add(nk, new THREE.PlaneGeometry(0.9, 0.17), M(x(door1 - (s > 0 ? -0.95 : 0.95)), 1.55, s * (HW + 0.006), 0, s > 0 ? 0 : Math.PI, 0));
  if (def.cls !== 'ord') {
    const ck = 'e5c_' + def.cls; RMAT[ck] = RMAT[ck] || decalMat(128, 128, (g, w, h) => { g.fillStyle = def.cls === 'gran' ? '#b8954a' : '#2f8f4e'; g.beginPath(); g.moveTo(64, 8); g.lineTo(120, 64); g.lineTo(64, 120); g.lineTo(8, 64); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 54px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(def.cls === 'gran' ? 'G' : '✿', 64, 68); });
    for (const s of [-1, 1]) gb.add(ck, new THREE.PlaneGeometry(0.22, 0.22), M(x(door1 + (s > 0 ? 0.85 : -0.85)), 2.34, s * (HW + 0.006), 0, s > 0 ? 0 : Math.PI, 0));
  }

  /* ---- the cab: windscreen over the canopy, headlights low on the nose ---- */
  let lens = null, lenses = [], beam = null, halo = null;
  if (nose) {
    // headlights: a slim lamp each side on the white just under the line, about 3 m back from the tip
    for (const s of [-1, 1]) {
      const a0 = 2.3, a1 = 4.1, la = newMesh(), st2 = [];
      for (let k = 0; k <= 8; k++) {
        const a = lerp(a0, a1, k / 8), R0 = hsRing(sect(a), E5.CUT), yl = e5Line(a) - 0.16, hgt = 0.11 * Math.sin(Math.PI * k / 8) ** 0.5 + 0.004, R = [];
        for (const y of [yl - hgt, yl, yl + hgt * 0.6]) R.push([s * (ringZ(R0, y) + 0.004), y]);
        st2.push({ a, R });
      }
      loftInto(la, st2, s > 0 ? [0, 1, 2] : [2, 1, 0], ref, 1, 1);
      const m = new THREE.Mesh(meshGeo(la), RMAT.lens); body.add(m); lenses.push(m);
    }
    lens = lenses[0];
    const hy = 1.3;
    beam = headBeam(x(0.5), hy); body.add(beam);
    halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    halo.position.set(x(0.2), 0.95, 0); halo.scale.set(2.2, 1.4, 1); body.add(halo);
    // obstacle deflector (snow plough) under the tip
    gb.add('hsUnder', plowGeo(x(0.5), x(2.4), 1.15, 0.16, 0.8));
  }
  /* ---- inside: the saloon behind the windows, and the cab under the canopy ---- */
  const ib = new GeoBin(), nIn = body.children.length;
  const inside = (a0, a1) => st.filter(s => s.a >= a0 - 1e-6 && s.a <= a1 + 1e-6);
  const face = rev ? -1 : 1;
  hsSaloon(gb, ib, { st: inside(S0, S1), ref, yF: 1.25, holes, r: Math.min(wW, 0.5) * 0.22, skin: skinKey, uvL: L, uvH: 4, cls: def.cls, face, rows: wins.map(a => x(a)),
    layout: { ord: [3, 2], green: [2, 2], gran: [2, 1] }[def.cls], rackY: 2.82 });
  let cab = null;
  if (nose) {
    const gW = a => a > canopy.A0 && a < canopy.A1 ? hsSup(sect(a), canopy.th0(a))[1] : Infinity;
    cab = hsCab(gb, body, ib, { st: inside(CB.A0, CB.A1), ref, yF: CB.yF, th0: a => a >= canopy.A0 && a <= canopy.A1 ? canopy.th0(a) : Math.PI / 2, dx: x,
      eye: new THREE.Vector3(x(10.35), 3.18, -0.3), drv: -0.3, seats: [-0.3], seatA: 10.2, door: 0.5, sect, cut: E5.CUT, gW,
      prof: [[7.8, 2.5], [9.0, 2.8], [9.32, 2.68]], screen: [1, 2], desk: [9.3, 9.85, 2.68, 2.61], kind: 'e5', lead: idx === 0, uid: 'e5' + idx });
  }
  const cabParts = body.children.slice(nIn);
  /* ---- roof: pantograph on cars 3 and 7, roof fairing at the gangways ---- */
  const pans = [];
  if (def.pan) pans.push(hsPantograph(gb, body, { a: def.pan, ref, roofAt: z => ringTop(hsRing(sect(def.pan), E5.CUT), z), roof: E5.ROOF, w: 1.45, L1: 1.42, L2: 1.52, raised: !!def.raised, rise: HSR.e5.wireH }));
  /* ---- bogies ---- */
  const trucks = [], wheels = [];
  for (const ta of [t0, t1]) { const B = hsBogie({ wb: E5.WB, R: E5.R, motor: def.motor, top: E5.CUT, w: 1.03 }); trucks.push(B.grp); wheels.push(...B.wheels); }
  body.add(gb.build({ ...RMAT }));
  const inner = ib.build({ ...RMAT }, { cast: false }); body.add(inner);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(L, 3.2, 3.3), RMAT.hit); hit.position.set(x(L / 2), 2.1, 0); body.add(hit);
  root.traverse(o => { if (o.isMesh && o.material !== RMAT.hsGlass && o.material !== RMAT.hit) { o.castShadow = true; o.receiveShadow = true; } });
  hsNoCast([...cabParts, inner]);
  if (beam) beam.castShadow = false;
  return {
    root, body, trucks, wheels, rW: E5.R, wb: E5.WB, len: L, frame: [t0, t1], ref, pans, lens, lenses, beam, halo, ditch: [], set: 'e5', nose, motor: def.motor, mass: def.t * 1000, num: def.num,
    cab, cabEye: cab ? cab.eye : new THREE.Vector3(x(10.35), 3.18, -0.3),
    inner, shell: { sect, cut: E5.CUT, yF: 1.25, saloon: [S0, S1], cabA: nose ? [CB.A0, CB.A1] : null, holes },
    headlightPos: new THREE.Vector3(x(0.6), 1.25, 0), hornPos: new THREE.Vector3(x(2.0), 1.0, 0), cabLightPos: new THREE.Vector3(x(11.0), 2.9, 0),
    enginePos: new THREE.Vector3(x(L / 2), 0.8, 0), skin: {},
  };
}

/* obstacle deflector under a nose: a blunt V in plan from xTip back to xBack (half width hw at the back),
   standing from y0 above the rail up to y1 inside the body */
function plowGeo(xTip, xBack, hw, y0, y1) {
  const sh = new THREE.Shape();
  sh.moveTo(xTip, -0.18); sh.lineTo(xTip, 0.18); sh.lineTo(xBack, hw); sh.lineTo(xBack, -hw); sh.closePath();
  return new THREE.ExtrudeGeometry(sh, { depth: y1 - y0, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, y1, 0);
}

/* ---------------- bogies ----------------
   A bolsterless bogie: H-frame of two side beams and two transoms, axle boxes on coil springs, an air
   spring on each side beam carrying the body, yaw dampers, disc brakes; motored bogies carry two
   frame-hung traction motors between the axles. Local frame at the bogie centre, rail top. */
function hsBogie(o) {
  hsMaterials();
  const grp = new THREE.Group(), tg = new GeoBin(), W = o.w, h = o.wb / 2, R = o.R;
  const yF = R + 0.16;                      // side beam centre
  for (const s of [-1, 1]) {
    const z = s * W;
    // side beam dipping between the axle boxes
    const sf = new THREE.Shape();
    sf.moveTo(-h - 0.42, yF + 0.04); sf.lineTo(-h - 0.42, yF + 0.2); sf.lineTo(-h + 0.3, yF + 0.2); sf.quadraticCurveTo(-h + 0.6, yF + 0.2, -h + 0.75, yF + 0.05);
    sf.lineTo(h - 0.75, yF + 0.05); sf.quadraticCurveTo(h - 0.6, yF + 0.2, h - 0.3, yF + 0.2); sf.lineTo(h + 0.42, yF + 0.2); sf.lineTo(h + 0.42, yF + 0.04);
    sf.lineTo(h - 0.3, yF + 0.04); sf.quadraticCurveTo(h - 0.6, yF + 0.04, h - 0.75, yF - 0.14); sf.lineTo(-h + 0.75, yF - 0.14); sf.quadraticCurveTo(-h + 0.6, yF + 0.04, -h + 0.3, yF + 0.04); sf.closePath();
    tg.add('hsBogie', new THREE.ExtrudeGeometry(sf, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1 }).translate(0, 0, z - 0.1));
    for (const x of [-h, h]) {
      tg.box('hsBogie', 0.4, 0.3, 0.26, x, R, z);                                                       // axle box
      tg.add('hsSteel', new THREE.CylinderGeometry(0.11, 0.11, 0.1, 14).rotateX(Math.PI / 2), M(x, R, s * (W + 0.15)));   // end cap
      tg.add('hsBogie', new THREE.CylinderGeometry(0.11, 0.11, yF + 0.04 - (R + 0.15), 10), M(x + 0.0, (R + 0.15 + yF + 0.04) / 2, z));   // axle spring
      tg.box('hsBogie', 0.7, 0.07, 0.12, x - Math.sign(x) * 0.45, R + 0.02, z);                          // axle box guide arm
    }
    // air spring on the side beam, its top plate bearing on the underside of the body
    tg.add('hsRubber', new THREE.CylinderGeometry(0.3, 0.3, o.top - 0.035 - (yF + 0.2), 18), M(0, (yF + 0.2 + o.top - 0.035) / 2, z));
    tg.add('hsBogie', new THREE.CylinderGeometry(0.33, 0.33, 0.035, 18), M(0, o.top - 0.0175, z));
    // yaw damper along the outside of the frame
    tg.add('hsSteel', new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8).rotateZ(Math.PI / 2), M(0.75, yF + 0.12, s * (W + 0.17)));
    tg.box('hsBogie', 0.1, 0.12, 0.12, 0.1, yF + 0.12, s * (W + 0.17)); tg.box('hsBogie', 0.12, 0.2, 0.08, 0.1, yF + 0.12, s * (W + 0.1));
  }
  for (const x of [-0.42, 0.42]) tg.box('hsBogie', 0.24, 0.26, 2 * W - 0.1, x, yF + 0.0, 0);   // transoms
  if (o.motor) {
    // traction motors hung from the transoms, driving the axles through gearboxes
    const mx = 0.76;                          // the motor nests against the transom's outer face
    for (const x of [-1, 1]) {
      tg.add('hsBogie', new THREE.CylinderGeometry(0.27, 0.27, 0.62, 16).rotateX(Math.PI / 2), M(x * mx, R + 0.02, -0.1));
      tg.box('hsBogie', h - mx, 0.42, 0.26, x * (h + mx) / 2, R, 0.33);              // gearbox from the motor's shaft end out to the axle
    }
  } else for (const s of [-1, 1]) {
    // brake units hung off the transom, reaching out toward each axle
    const x0 = 0.5, x1 = h - 0.28;
    tg.box('hsBogie', x1 - x0, 0.3, 0.9, s * (x0 + x1) / 2, R + 0.1, 0);
  }
  grp.add(tg.build(RMAT));
  const ax = plainAxle(R), wheels = [];
  for (const x of [-h, h]) {
    const wg = new THREE.Group(); wg.position.set(x, R, 0);
    wg.add(new THREE.Mesh(ax.black, RMAT.black), new THREE.Mesh(ax.tire, RMAT.tire));
    // wheel-mounted brake discs on both faces of each wheel web
    for (const s of [-1, 1]) wg.add(new THREE.Mesh(new THREE.CylinderGeometry(R * 0.82, R * 0.82, 0.04, 24).rotateX(Math.PI / 2).translate(0, 0, s * (RAIL_OFF - 0.12)), RMAT.hsSteel));
    // axle journals running out through the hubs into the axle boxes
    for (const s of [-1, 1]) wg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, W - 0.62, 12).rotateX(Math.PI / 2).translate(0, 0, s * (W + 0.62) / 2), RMAT.black));
    grp.add(wg); wheels.push(wg);
  }
  grp.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return { grp, wheels };
}

/* ---------------- pantograph ----------------
   A single-arm pantograph on insulators: the lower arm rises from a hinge at the back of the base frame,
   the upper arm folds back over it to the collector head. set(h) puts the top of the head h above the rail. */
function hsPantograph(gb, body, o) {
  const x0 = o.ref - o.a, yB = o.roof + 0.34, Lb = 1.5;
  // base frame on four insulators
  for (const dx of [-Lb / 2, Lb / 2]) for (const z of [-0.45, 0.45]) {
    gb.add('hsIns', new THREE.CylinderGeometry(0.07, 0.09, 0.3, 10), M(x0 + dx, o.roof + 0.15, z));
    for (let k = 0; k < 3; k++) gb.add('hsIns', new THREE.CylinderGeometry(0.11, 0.11, 0.025, 12), M(x0 + dx, o.roof + 0.07 + k * 0.08, z));
    const r0 = o.roofAt(Math.abs(z) + 0.12);
    gb.box('hsBogie', 0.24, o.roof + 0.025 - r0 + 0.01, 0.24, x0 + dx, (o.roof + 0.025 + r0 - 0.01) / 2, z);   // mounting pad, down onto the curve of the roof
  }
  for (const z of [-0.45, 0.45]) gb.box('hsPan', Lb + 0.16, 0.06, 0.08, x0, yB, z);
  for (const dx of [-Lb / 2, Lb / 2]) gb.box('hsPan', 0.08, 0.06, 0.98, x0 + dx, yB, 0);
  gb.box('hsBogie', 0.5, 0.18, 0.5, x0 + Lb / 2 - 0.3, yB + 0.08, 0);   // air cylinder that raises it
  const P0 = [x0 + Lb / 2 - 0.12, yB + 0.08];   // hinge of the lower arm, at the base's rear end
  const lower = new THREE.Group(), upper = new THREE.Group(), head = new THREE.Group();
  {
    const g = new GeoBin();
    for (const z of [-0.32, 0.32]) g.add('hsPan', barGeo(0.035, [0, 0, z], [o.L1, 0, z * 0.25], 8));
    g.add('hsPan', barGeo(0.03, [0.15, 0, -0.32], [0.15, 0, 0.32], 6));
    g.add('hsPan', barGeo(0.045, [0, 0, -0.38], [0, 0, 0.38], 10));
    g.add('hsPan', barGeo(0.04, [o.L1, 0, -0.12], [o.L1, 0, 0.12], 10));   // knee pin the upper arm hangs on
    lower.add(g.build(RMAT));
  }
  {
    const g = new GeoBin();
    g.add('hsPan', barGeo(0.03, [0, 0, 0], [o.L2, 0, 0], 8));
    g.add('hsPan', barGeo(0.018, [0.25, -0.08, 0], [o.L2 * 0.85, -0.02, 0], 6));
    upper.add(g.build(RMAT));
  }
  {
    const g = new GeoBin(), hw = o.w / 2;
    // two carbon strips on a frame, with horns turned down at each end
    for (const dx of [-0.13, 0.13]) { g.box('hsCarbon', 0.05, 0.035, 2 * hw - 0.3, dx, -0.0175, 0); g.box('hsPan', 0.06, 0.04, 2 * hw - 0.3, dx, -0.055, 0); }
    for (const s of [-1, 1]) {
      g.add('hsPan', barGeo(0.02, [0, -0.05, s * (hw - 0.15)], [0, -0.15, s * hw], 6));
      for (const dx of [-0.13, 0.13]) g.add('hsPan', barGeo(0.014, [dx, -0.04, s * (hw - 0.15)], [0, -0.15, s * (hw - 0.02)], 6));
      g.box('hsPan', 0.32, 0.04, 0.04, 0, -0.08, s * 0.35);
    }
    g.box('hsPan', 0.06, 0.12, 0.06, 0, -0.12, 0);
    g.box('hsPan', 0.32, 0.04, 0.06, 0, -0.08, 0);          // centre cross member tying the strip frames to the post
    g.box('hsPan', 0.08, 0.1, 0.1, 0, -0.04, 0);            // knuckle where the upper arm meets the head
    head.add(g.build(RMAT));
  }
  for (const grp of [lower, upper, head]) { grp.traverse(m => { if (m.isMesh) m.castShadow = true; }); body.add(grp); }
  const pan = { lower, upper, head, P0, L1: o.L1, L2: o.L2, raised: o.raised, hx: P0[0] - 0.1, down: yB + 0.27, rise: o.rise, h: -1 };
  pan.set = h => {
    if (Math.abs(h - pan.h) < 1e-4) return; pan.h = h;
    // the collector head travels up a near-vertical line just behind the hinge; solve the two-arm linkage for it
    const hx = pan.hx, hy = h - 0.0, dx = hx - P0[0], dy = hy - P0[1], d = Math.hypot(dx, dy);
    const c = clamp((pan.L1 * pan.L1 + d * d - pan.L2 * pan.L2) / (2 * pan.L1 * d), -1, 1);
    const phi = Math.atan2(dy, dx), al = phi - Math.acos(c);    // the knee swings out ahead of the hinge, away from the head
    const K = [P0[0] + Math.cos(al) * pan.L1, P0[1] + Math.sin(al) * pan.L1];
    lower.position.set(P0[0], P0[1], 0); lower.rotation.set(0, 0, al);
    upper.position.set(K[0], K[1], 0); upper.rotation.set(0, 0, Math.atan2(hy - K[1], hx - K[0]));
    head.position.set(hx, hy, 0);
  };
  pan.set(o.raised ? o.rise : pan.down);
  return pan;
}

/* ---------------- Acela Express ---------------- */
const AC = { PW: 1.59, CW: 1.58, PROOF: 4.32, CROOF: 4.23, LN: 4.8, PCUT: 1.32, CCUT: 1.2, PBOG: 10.74, CBOG: 18.14, PWB: 3.0, CWB: 2.6, PR: 0.508, CR: 0.457, GW: 0.32 };
const ACC = { silver: '#c4c8cc', band: '#2c3238', skirt: '#3d4247', blue: '#2f6aa3', logo: '#2a5d8f' };
/* power car section at a from the nose (cab end) */
function acPowerSect(a) {
  const { PW, PROOF, LN } = AC;
  if (a >= LN) return { yb: 0.55, w: PW, ys: 3.62, yt: PROOF, ch: 0.16, n: 3.0, tum: 0.1 };
  const t = clamp(a / LN, 0, 1), tw = clamp(a / 3.0, 0, 1);
  let w = 1.12 + (PW - 1.12) * (1 - (1 - tw) ** 2);
  let yt = 1.75 + (PROOF - 1.75) * Math.pow(Math.sin(t * Math.PI / 2), 1.15);
  let yb = 0.55 - 0.22 * (1 - smooth(0, 2.0, a));
  let ys = yb + 0.6 + (3.62 - 0.55 - 0.6) * Math.pow(smooth(0, LN, a), 0.8);
  let ch = 0.16, tum = 0.1 * smooth(0, LN, a);
  const n = lerp(2.2, 3.0, t);
  const RC = 0.35, q = Math.sqrt(Math.max(0, 1 - (1 - Math.min(a, RC) / RC) ** 2)), yc = 1.05;
  if (a < RC) { w *= q; yb = yc + (yb - yc) * q; yt = yc + (yt - yc) * q; ys = yc + (ys - yc) * q; ch *= q; tum *= q; }
  return { yb, w: Math.max(w, 0.0005), ys, yt, ch: Math.min(ch, Math.max(0.0004, (ys - yb) * 0.45)), n, tum };
}
/* tilting coach: a narrower upper body so it can lean 4.2 degrees inside the loading gauge */
const acCoachSect = () => ({ yb: 0.7, w: AC.CW, ys: 3.5, yt: AC.CROOF, ch: 0.14, n: 2.4, tum: 0.26 });
const AC_GANG = () => ({ yb: 0.98, w: 0.8, ys: 3.05, yt: 3.5, ch: 0.08, n: 3 });
function acSkin(power) {
  const L = power ? 21.22 : 26.64;
  return hsSkin(power ? 'acSkinPower' : 'acSkinCoach', L, 4.4, 2048, 256, (g, X, Y, W, H) => {
    g.fillStyle = ACC.silver; g.fillRect(0, 0, W, H);
    // fluting on the lower body, as the stainless panels catch the light
    g.fillStyle = 'rgba(255,255,255,0.10)'; for (let y = 1.0; y < 2.15; y += 0.11) g.fillRect(0, Y(y), W, 1);
    g.fillStyle = ACC.skirt; g.fillRect(0, Y(0.98), W, H - Y(0.98));
    // dark window band, and the blue line under it
    if (power) {
      g.beginPath(); g.moveTo(X(0.0), Y(2.05)); g.bezierCurveTo(X(1.2), Y(2.15), X(2.2), Y(2.28), X(3.0), Y(2.3)); g.lineTo(X(L), Y(2.3)); g.lineTo(X(L), Y(2.95)); g.lineTo(X(0), Y(2.95)); g.closePath();
      g.fillStyle = ACC.band; g.fill();
      g.fillStyle = ACC.blue; g.beginPath(); g.moveTo(X(0.4), Y(2.0)); g.bezierCurveTo(X(1.4), Y(2.1), X(2.3), Y(2.2), X(3.0), Y(2.22)); g.lineTo(X(L), Y(2.22)); g.lineTo(X(L), Y(2.26)); g.lineTo(X(3.0), Y(2.26)); g.bezierCurveTo(X(2.3), Y(2.25), X(1.4), Y(2.15), X(0.4), Y(2.05)); g.closePath(); g.fill();
    } else {
      g.fillStyle = ACC.band; g.fillRect(0, Y(2.95), W, Y(2.3) - Y(2.95));
      g.fillStyle = ACC.blue; g.fillRect(0, Y(2.26), W, Y(2.22) - Y(2.26));
    }
  }, { metal: 0.55, rough: 0.33 });
}
function buildAcelaCar(def, idx) {
  hsMaterials(); hsIntMaterials();
  const power = def.type === 'power', L = def.len, bog = power ? AC.PBOG : AC.CBOG;
  const t0 = (L - bog) / 2, t1 = t0 + bog, ref = (t0 + t1) / 2, x = a => ref - a;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const gb = new GeoBin();
  const skinKey = power ? 'acSkinPower' : 'acSkinCoach'; acSkin(power);
  const cut = power ? AC.PCUT : AC.CCUT, hw = power ? AC.PW : AC.CW;
  // window sill and head as ring points: the coaches' window band, and the cab side window of a power car
  const sect = power ? a => Object.assign(acPowerSect(a), a >= 2.5 ? { wy: [2.345, 2.895] } : {}) : () => Object.assign(acCoachSect(), { wy: [2.31, 2.93] });
  const pitch = def.cls === 'first' ? 1.36 : 1.17, s0 = 3.0, s1 = L - 2.4, n = Math.floor((s1 - s0) / pitch), wins = [];
  if (!power) for (let i = 0; i < n; i++) wins.push(s0 + (s1 - s0 - (n - 1) * pitch) / 2 + i * pitch);
  const holes = power ? [[3.55 - 0.475, 3.55 + 0.475]] : wins.map(a => [a - 0.5, a + 0.5]), S0 = s0 - 0.5, S1 = s1 + 0.5;
  const CB = { A0: 0.9, A1: 4.45, yF: 2.02 };
  const canopy = power ? { A0: 1.0, A1: 3.7, th0: a => Math.PI / 2 - (Math.PI / 2 - 0.62) * Math.pow(Math.sin(Math.PI * clamp((a - 1.0) / 2.7, 0, 1)), 0.35) } : null;
  const stations = [];
  if (power) { for (const a of [0, 0.01, 0.03, 0.06, 0.1, 0.16, 0.24, 0.35, 0.5]) stations.push(a); for (let a = 0.7; a < AC.LN; a += 0.25) stations.push(a); stations.push(AC.LN); }
  else stations.push(AC.GW);
  stations.push(L - AC.GW);
  const half = power ? 1.85 : 1.6;
  const wells = [[t0 - half, t0 + half], [t1 - half, t1 + half]];
  const st = hsBody(gb, { len: L, a0: power ? 0 : AC.GW, a1: L - AC.GW, stations, wells, cut, sect, skin: skinKey, uvL: L, uvH: 4.4, holes, canopy, extra: power ? [CB.A0, CB.A1] : [S0, S1] }, ref);
  if (!power) hsGangway(gb, () => AC_GANG(), AC.GW, 0, ref, 1);
  hsGangway(gb, () => AC_GANG(), L - AC.GW, L, ref, 1);
  const R0 = hsRing(sect(L / 2), cut);
  /* a window or panel lying on the (leaning) side at height y */
  const onSide = (k, geo, a, y, out = 0.004) => {
    const z = ringZ(R0, y), lean = Math.atan2(ringZ(R0, y - 0.15) - ringZ(R0, y + 0.15), 0.3);
    for (const s of [-1, 1]) gb.add(k, geo.clone(), M(x(a), y, s * (z + out), s * lean, s > 0 ? 0 : Math.PI, 0));
  };
  const door = (a, w = 0.95) => {
    for (const da of [-w / 2, w / 2]) for (let y = 1.0; y < 2.9; y += 0.19) onSide('hsSeam', new THREE.BoxGeometry(0.012, 0.2, 0.006), a + da, y + 0.095, 0.003);
    onSide('hsSeam', new THREE.BoxGeometry(w, 0.012, 0.006), a, 2.96, 0.003);
    onSide('hsWin', rrectGeo(0.4, 0.62, 0.07), a, 2.5, 0.005);
  };
  if (power) {
    // crew door behind the cab (its side window is cut through, below), cooling grilles, the name on the side
    door(5.0, 0.7);
    for (const [a0, a1] of [[13.6, 16.3], [16.8, 19.5]]) onSide('acGrille', new THREE.PlaneGeometry(a1 - a0, 0.78), (a0 + a1) / 2, 1.62, 0.005);
    RMAT.acGrille = RMAT.acGrille || new THREE.MeshStandardMaterial({ color: 0x9aa0a5, metalness: 0.6, roughness: 0.45, map: louverTex() });
    RMAT.acLogo = RMAT.acLogo || decalMat(1024, 256, (g, w, h) => { g.fillStyle = ACC.logo; g.font = 'italic 600 170px "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; if (g.letterSpacing !== undefined) g.letterSpacing = '6px'; g.fillText('Acela', w / 2, h / 2 + 10); });
    for (const s of [-1, 1]) gb.add('acLogo', new THREE.PlaneGeometry(4.0, 1.0), M(x(10.2), 1.62, s * (ringZ(R0, 1.62) + 0.006), 0, s > 0 ? 0 : Math.PI, 0));
  } else {
    door(1.55);
  }
  const nk = 'acn_' + def.num; RMAT[nk] = RMAT[nk] || textDecal(def.num, 256, 96, '#2c3238', 'sans', 60);
  onSide(nk, new THREE.PlaneGeometry(0.5, 0.19), power ? 7.0 : L - 1.6, 1.7, 0.006);

  let lens = null, lenses = [], beam = null, halo = null; const ditch = [];
  if (power) {
    // two headlights low in the nose with ditch lights out at the corners, a pilot (the windscreen is cut in by hsBody)
    for (const s of [-1, 1]) {
      // lamps let into the nose: find where the lamp's axis meets the skin, face the lens along the skin's normal there
      // and run the housing back through the skin into the body
      const seat = (y, z, r) => {
        const zr = a => ringZ(hsRing(sect(a), cut), y);
        let lo = 0.05, hi = 6; for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (zr(mid) < Math.abs(z)) lo = mid; else hi = mid; }
        const aS = (lo + hi) / 2, tx = x(aS + 0.05) - x(aS - 0.05), tz = Math.sign(z) * (zr(aS + 0.05) - zr(aS - 0.05));
        const n = new THREE.Vector3(-tz, 0, tx).normalize(); if (n.x * Math.sign(x(0) - x(1)) < 0) n.negate();
        const P = new THREE.Vector3(x(aS), y, z);
        const hg = new THREE.CylinderGeometry(r, r, 0.3, 20).translate(0, -0.144, 0);
        hg.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n))); hg.translate(P.x, P.y, P.z);
        gb.add('hsLamp', hg);
        const lp = P.clone().addScaledVector(n, 0.01), rot = Math.atan2(n.x, n.z);
        return { lp, rot, n };
      };
      const L1 = seat(1.12, s * 0.62, 0.15);
      const ln = new THREE.Mesh(new THREE.CircleGeometry(0.12, 20), RMAT.lens); ln.position.copy(L1.lp); ln.rotation.y = L1.rot; body.add(ln); lenses.push(ln);
      const L2 = seat(0.78, s * 1.05, 0.1);
      const dl = new THREE.Mesh(new THREE.CircleGeometry(0.075, 16), new THREE.MeshBasicMaterial({ color: 0xfff3d6 })); dl.position.copy(L2.lp); dl.rotation.y = L2.rot; body.add(dl);
      const dh = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      dh.position.copy(L2.lp).addScaledVector(L2.n, 0.03); dh.scale.set(1.2, 1.2, 1); body.add(dh);
      ditch.push({ lens: dl, halo: dh });
    }
    lens = lenses[0];
    beam = headBeam(x(0.3), 1.12); body.add(beam);
    halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    halo.position.set(x(0.2), 1.12, 0); halo.scale.set(2.2, 1.6, 1); body.add(halo);
    // pilot and snow plow below the nose
    gb.add('hsUnder', plowGeo(x(0.7), x(2.6), 1.2, 0.16, 0.75));
  }
  /* ---- inside: a coach's saloon, or a power car's cab ---- */
  const ib = new GeoBin(), nIn = body.children.length;
  const inside = (a0, a1) => st.filter(s => s.a >= a0 - 1e-6 && s.a <= a1 + 1e-6);
  let cab = null;
  if (power) {
    const gW = a => a > canopy.A0 && a < canopy.A1 ? hsSup(sect(a), canopy.th0(a))[1] : Infinity;
    cab = hsCab(gb, body, ib, { st: inside(CB.A0, CB.A1), ref, yF: CB.yF, th0: a => a >= canopy.A0 && a <= canopy.A1 ? canopy.th0(a) : Math.PI / 2, dx: x,
      holes, r: 0.1, skin: skinKey, uvL: L, uvH: 4.4,
      eye: new THREE.Vector3(x(2.9), 3.25, 0.62), drv: 0.62, seats: [0.62, -0.62], seatA: 2.75, door: 0, sect, cut, gW,
      prof: [[0.9, 2.3], [2.0, 2.86], [2.27, 2.77]], screen: [1, 2], desk: [2.25, 2.7, 2.77, 2.69], kind: 'acela', lead: idx === 0, uid: 'ac' + idx });
  } else {
    const cafe = def.cls === 'cafe', half = Math.ceil(wins.length / 2), rows = cafe ? wins.slice(half) : wins;
    const faces = def.cls === 'bus' ? rows.map((_, i) => i < rows.length / 2 ? -1 : 1) : null;
    const mid = faces ? rows.length / 2 : -1;
    const tables = cafe ? rows.slice(0, -1).map((a, i) => i % 2 ? null : [x(a), x(rows[i + 1])]).filter(Boolean)
      : faces && mid >= 1 ? [[x(rows[mid - 1]), x(rows[mid])]] : [];
    hsSaloon(gb, ib, { st: inside(S0, S1), ref, yF: 1.27, holes, r: 0.1, skin: skinKey, uvL: L, uvH: 4.4, cls: def.cls, rows: rows.map(a => x(a)), face: 1,
      faces: cafe ? rows.map((_, i) => i % 2 ? 1 : -1) : faces, tables, counter: cafe ? [S0 + 0.6, wins[half - 1] + 0.5] : null,
      layout: def.cls === 'first' ? [2, 1] : [2, 2], rackY: 3.2 });
  }
  const cabParts = body.children.slice(nIn);
  const pans = [];
  if (power) {
    const roofAt = z => ringTop(hsRing(sect(15), cut), z);
    pans.push(hsPantograph(gb, body, { a: 12.6, ref, roofAt, roof: AC.PROOF, w: 1.95, L1: 1.25, L2: 1.35, raised: false, rise: HSR.acela.wireH }));
    pans.push(hsPantograph(gb, body, { a: 16.6, ref, roofAt, roof: AC.PROOF, w: 1.95, L1: 1.25, L2: 1.35, raised: true, rise: HSR.acela.wireH }));
  }
  const trucks = [], wheels = [];
  for (const ta of [t0, t1]) { const B = hsBogie({ wb: power ? AC.PWB : AC.CWB, R: power ? AC.PR : AC.CR, motor: power, top: cut, w: 1.03 }); trucks.push(B.grp); wheels.push(...B.wheels); }
  body.add(gb.build({ ...RMAT }));
  const inner = ib.build({ ...RMAT }, { cast: false }); body.add(inner);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(L, 3.8, 3.2), RMAT.hit); hit.position.set(x(L / 2), 2.4, 0); body.add(hit);
  root.traverse(o => { if (o.isMesh && o.material !== RMAT.hsGlass && o.material !== RMAT.hit) { o.castShadow = true; o.receiveShadow = true; } });
  hsNoCast([...cabParts, inner]);
  if (beam) beam.castShadow = false;
  return {
    root, body, trucks, wheels, rW: power ? AC.PR : AC.CR, wb: power ? AC.PWB : AC.CWB, len: L, frame: [t0, t1], ref, pans, lens, lenses, beam, halo, ditch, set: 'acela', nose: power, motor: power, mass: def.t * 1000, num: def.num,
    tilt: !power, tiltY: 1.3,
    cab, cabEye: cab ? cab.eye : new THREE.Vector3(x(2.9), 3.25, 0.62),
    inner, shell: { sect, cut, yF: 1.27, saloon: power ? null : [S0, S1], cabA: power ? [CB.A0, CB.A1] : null, holes },
    headlightPos: new THREE.Vector3(x(0.4), 1.12, 0), hornPos: new THREE.Vector3(x(6), AC.PROOF + 0.1, 0), cabLightPos: new THREE.Vector3(x(3.2), 3.6, 0),
    enginePos: new THREE.Vector3(x(L / 2), 2.0, 0), skin: {},
  };
}

/* the inside casts no shadows (the body round it does) */
function hsNoCast(objs) { for (const c of objs) c.traverse(o => { if (o.isMesh) o.castShadow = false; }); }

/* ---------------- the trainset ---------------- */
/* every car of set key, front to back; the last cab car (or power car) runs turned */
function buildTrainset(key) {
  const D = HSR[key], n = D.cars.length;
  return D.cars.map((def, i) => {
    const m = key === 'e5' ? buildE5Car(def, i) : buildAcelaCar(def, i);
    [m.aeroLead, m.aero] = HS_AERO[key][def.type];
    m.reversed = n > 1 && i === n - 1;
    m.lead = i === 0;
    if (m.lens) {
      // headlights on the leading cab, red tail lights on the trailing one
      for (const l of m.lenses) l.material = m.lead ? RMAT.lens : RMAT.hsTail;
      if (!m.lead) { m.beam.visible = false; m.halo.visible = false; m.ditch.forEach(d => { d.lens.material.color.setScalar(0.12); d.halo.visible = false; }); }
    }
    return m;
  });
}
/* the vehicle record for car m of a trainset */
function setVehicle(m, i) {
  const frame = m.reversed ? [m.len - m.frame[1], m.len - m.frame[0]] : m.frame.slice();
  return { kind: i === 0 ? 'loco' : 'loco2', model: m, len: m.len, frame, trucks: [], mass: m.mass, axles: 4, area: 0, aero: m.aero, aeroLead: m.aeroLead,
    brakeA: 0.8, disc: true, emu: true, motor: m.motor, reversed: m.reversed, noCouple: true };
}
/* every frame: pantographs up to the wire or folded down, and the tilting coaches leaning into the curves */
function animateTrainset(T, dt) {
  const panK = T.remote ? 1 : S.pan, v = T.remote ? 0 : S.v;
  // the lamps inside: the surfaces glow a little by day, more at night, as the cars' own lighting would show them
  if (RMAT.hsLit) { const d = smooth(0.2, 0.6, SKY.dark || 0); for (const m of RMAT.hsLit) m.emissiveIntensity = lerp(0.12, 0.42, d); RMAT.hsLight.emissiveIntensity = lerp(0.7, 1.1, d); }
  for (const veh of T.vehicles) {
    const m = veh.model; if (!m || !m.set) continue;
    for (const p of m.pans) p.set(p.raised ? lerp(p.down, p.rise, smooth(0, 1, panK)) : p.down);
    if (m.tilt && veh.fp) {
      const tp = veh.fp[0].tp, k = tp.e.curv(tp.s) * tp.o * (veh.reversed ? -1 : 1);
      // active tilt takes out most of the unbalanced lateral acceleration, up to 4.2 degrees
      const want = clamp(0.75 * v * v * k / 9.81, -0.0733, 0.0733);
      m.tiltA = (m.tiltA || 0) + clamp(want - (m.tiltA || 0), -0.03 * dt, 0.03 * dt);
      const b = m.body; b.matrixAutoUpdate = false;
      b.matrix.makeTranslation(0, m.tiltY, 0).multiply(_m4.makeRotationX(-m.tiltA)).multiply(new THREE.Matrix4().makeTranslation(0, -m.tiltY, 0));
      b.matrixWorldNeedsUpdate = true;
    }
  }
}

/* ---------------- sound ----------------
   The voice of a trainset under power: the inverters' switching tone, which climbs in steps at low speed
   (asynchronous PWM) and then holds while the motors' own whine rises with speed; the cooling blowers
   whenever the main breaker is in; and the pantograph's hiss on the wire at speed. */
function updateElectricAudio(T, inCab) {
  if (!AU.on) return;
  const ctx = AU.ctx, t = ctx.currentTime;
  if (!AU.ez) {
    const Z = AU.ez = {};
    const gain = (v = 0) => { const g = ctx.createGain(); g.gain.value = v; return g; };
    Z.out = gain(0); Z.out.connect(AU.loco);
    Z.inv = ctx.createOscillator(); Z.inv.type = 'sawtooth'; Z.invF = ctx.createBiquadFilter(); Z.invF.type = 'bandpass'; Z.invF.Q.value = 6; Z.invG = gain(0);
    Z.inv.connect(Z.invF); Z.invF.connect(Z.invG); Z.invG.connect(Z.out);
    Z.m1 = ctx.createOscillator(); Z.m1.type = 'triangle'; Z.m2 = ctx.createOscillator(); Z.m2.type = 'sine'; Z.mG = gain(0);
    Z.m1.connect(Z.mG); Z.m2.connect(Z.mG); Z.mG.connect(Z.out);
    const n = ctx.createBufferSource(); n.buffer = AU.noise; n.loop = true; Z.bF = ctx.createBiquadFilter(); Z.bF.type = 'bandpass'; Z.bF.frequency.value = 480; Z.bF.Q.value = 0.7; Z.bG = gain(0);
    n.connect(Z.bF); Z.bF.connect(Z.bG); Z.bG.connect(Z.out);
    const w = ctx.createBufferSource(); w.buffer = AU.white; w.loop = true; Z.pF = ctx.createBiquadFilter(); Z.pF.type = 'highpass'; Z.pF.frequency.value = 2600; Z.pG = gain(0);
    w.connect(Z.pF); Z.pF.connect(Z.pG); Z.pG.connect(AU.loco);
    for (const o of [Z.inv, Z.m1, Z.m2]) o.start();
    n.start(0, Math.random()); w.start(0, Math.random());
  }
  const Z = AU.ez, on = !!(T && T.elec);
  if (!on) { for (const g of [Z.out, Z.pG]) g.gain.setTargetAtTime(0, t, 0.05); return; }
  const v = Math.abs(S.v), sp = LOCO_SPEC[T.locoKey];
  const work = clamp((Math.abs(S.TE) + S.DBF + S.blend) / sp.TEmax, 0, 1.2);
  // carrier steps up through a scale below about 40 km/h, then follows the motor frequency
  const step = Math.min(7, Math.floor(v / 1.6)), carrier = v < 11 ? 420 * Math.pow(2, step / 6) : 280 + 22 * v;
  Z.inv.frequency.setTargetAtTime(carrier, t, 0.04); Z.invF.frequency.setTargetAtTime(carrier * 2, t, 0.04);
  Z.invG.gain.setTargetAtTime(0.09 * work * (1 - 0.7 * smooth(10, 30, v)), t, 0.1);
  Z.m1.frequency.setTargetAtTime(24 + v * 21, t, 0.1); Z.m2.frequency.setTargetAtTime(48 + v * 42, t, 0.1);
  Z.mG.gain.setTargetAtTime(0.05 * (0.25 + work) * Math.min(1, v / 3), t, 0.15);
  Z.bG.gain.setTargetAtTime(S.vcb ? 0.12 + 0.12 * work : 0, t, 0.6);
  Z.out.gain.setTargetAtTime(inCab ? 0.45 : 1, t, 0.1);
  Z.pG.gain.setTargetAtTime(S.pan > 0.99 ? 0.06 * smooth(15, 80, v) : 0, t, 0.3);
}

/* ============================================================================
   Inside the high-speed trainsets: windows and windscreens you can see
   through, the E5's and the Acela's driving cabs (every control works, the
   screens read the train), and the saloons behind the windows, each class
   with its own seats.
   The lining is the inside face of the car's wall, HS_TH in from the skin and
   following the same sections, so nothing inside can poke out through the
   body. Window openings are cut through both, with a reveal between them.
   Same local frame as 06e_hsr.js: +X forward, a = metres back from the car's front.
   ========================================================================== */
const HS_TH = 0.06;

function hsIntMaterials() {
  if (RMAT.hsLine) return;
  cabMaterials(); dieselMaterials();   // levers and knobs shared with the other cabs
  const mk = (c, m, r, extra = {}) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r, side: THREE.DoubleSide, ...extra });
  // the inside is lit by its own lamps: a glow in the colour of each surface, brighter at night (animateTrainset)
  RMAT.hsLit = [];
  const lit = (c, m, r) => { const x = mk(c, m, r, { emissive: c }); RMAT.hsLit.push(x); return x; };
  RMAT.hsLine = lit(0xdcdbd4, 0.05, 0.75);      // wall and ceiling panels
  RMAT.hsEnd = lit(0xc7c4bb, 0.1, 0.6);         // end walls
  RMAT.hsDoor = lit(0x9fa3a6, 0.4, 0.4);        // sliding doors into the vestibules
  RMAT.hsRack = lit(0xb4b8bb, 0.7, 0.35);       // luggage racks
  RMAT.hsShell = lit(0x8d9194, 0.3, 0.5);       // seat frames, pedestals, armrests
  RMAT.hsCover = lit(0xf1efe8, 0.0, 0.9);       // white headrest covers
  RMAT.hsWood = lit(0x6e4a2e, 0.1, 0.45);       // Gran Class shells and tables
  RMAT.hsTable = lit(0x5f6366, 0.3, 0.4);
  for (const [k, c] of Object.entries({ ord: 0x46628a, green: 0x7d5f48, gran: 0xd6c8aa, first: 0x2f3c50, bus: 0x3e5677, cafe: 0x3e5677 })) RMAT['hsSeat_' + k] = lit(c, 0.0, 0.85);
  for (const [k, c] of Object.entries({ ord: 0x5b6670, green: 0x5a4636, gran: 0x3c3027, first: 0x3a3f46, bus: 0x4a525a, cafe: 0x4a525a })) RMAT['hsCarpet_' + k] = lit(c, 0.0, 0.95);
  RMAT.hsLight = new THREE.MeshStandardMaterial({ color: 0xf6f7f2, emissive: 0xfffdf4, emissiveIntensity: 0.7, roughness: 0.5, side: THREE.DoubleSide });
  RMAT.hsLight.userData.lamp = true;
  RMAT.hsSign = new THREE.MeshBasicMaterial({ map: canvasTex(512, 64, (g, w, h) => { g.fillStyle = '#0b0c0c'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff9a2a'; g.font = 'bold 40px "IBM Plex Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('NEXT · BELLEVUE', w / 2, h / 2 + 2); }) });
  RMAT.hsPane = mk(0x1d2e33, 0.5, 0.05, { transparent: true, opacity: 0.32, depthWrite: false }); RMAT.hsPane.userData.noShadow = true;
  // the cabs: dark blue-grey panels, a near-black desk
  RMAT.hsCabLine = lit(0x6d747a, 0.15, 0.7);
  RMAT.hsCabFloor = lit(0x2f3337, 0.1, 0.9);
  RMAT.hsDesk = lit(0x33383d, 0.25, 0.55);
  RMAT.hsDeskTop = lit(0x24282c, 0.2, 0.45);
  RMAT.hsSeatCab = lit(0x30353b, 0.0, 0.8);
  RMAT.hsScrOff = new THREE.MeshStandardMaterial({ color: 0x07090a, metalness: 0.3, roughness: 0.2 });
  RMAT.hsBtn = mk(0x2c7a3c, 0.2, 0.4);
  for (const [k, c] of Object.entries({ G: 0x34d058, A: 0xffb02e, R: 0xe8402c, W: 0xf2f2e8 })) RMAT['hsLamp' + k] = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.55, roughness: 0.3 });
}

/* ---------------- the lining: the inside face of the wall ----------------
   At one station (skin ring R, section p): the right half from the floor yF up the side, then over the roof
   as far as angle th0 (pi / 2 reaches the top centre), pushed in by HS_TH along the wall's normal.
   sideY: heights of the side points above the floor, the last the shoulder p.ys. When the floor is up in the
   roof curve (an Acela nose) every point goes on the roof instead, so each station has the same count. */
function hsSup(p, t) {
  const ws = p.w - (p.tum || 0);
  return [ws * Math.pow(Math.max(0, Math.cos(t)), 2 / p.n), p.ys + (p.yt - p.ys) * Math.pow(Math.max(0, Math.sin(t)), 2 / p.n)];
}
function liningHalf(R, p, yF, th0, sideY) {
  let pts;
  if (yF < p.ys - 0.05) {
    pts = [[ringZ(R, yF), yF]];
    for (const y of sideY) pts.push([ringZ(R, y), y]);
    for (let i = 1; i <= 14; i++) pts.push(hsSup(p, th0 * i / 14));
  } else {
    const tF = Math.asin(Math.pow(clamp((yF - p.ys) / Math.max(0.01, p.yt - p.ys), 0, 1), p.n / 2)), n = sideY.length + 14;
    pts = []; for (let i = 0; i <= n; i++) pts.push(hsSup(p, lerp(tF, Math.max(th0, tF + 0.01), i / n)));
    pts[0][1] = yF;
  }
  const top = th0 > Math.PI / 2 - 1e-6;
  return pts.map((q, i) => {
    if (top && i === pts.length - 1) return [0, q[1] - HS_TH];
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], tz = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tz, ty) || 1;
    return [q[0] - HS_TH * ty / l, q[1] + HS_TH * tz / l];
  });
}
/* z of a half polyline (floor first) at height y, and y at z */
function polyZ(H, y) {
  for (let i = 0; i < H.length - 1; i++) { const a = H[i], b = H[i + 1]; if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) return lerp(a[0], b[0], (y - a[1]) / (b[1] - a[1])); }
  return y < H[0][1] ? H[0][0] : 0;
}
function polyY(H, z) {
  for (let i = H.length - 1; i > 0; i--) { const a = H[i], b = H[i - 1]; if (z >= a[0] && z <= b[0] && b[0] > a[0]) return lerp(a[1], b[1], (z - a[0]) / (b[0] - a[0])); }
  return H[H.length - 1][1];
}

/* a flat frame in the plane through (z0, y0) -> (z1, y1) (the window strip of a ring), over x0..x1: the rectangle
   with a rounded-rectangle hole. side +1 right, -1 left; off moves it out along the normal. Returns the matrix too. */
function stripFrame(x0, x1, q0, q1, side, off) {
  const v = new THREE.Vector3(0, q1[1] - q0[1], side * (q1[0] - q0[0])).normalize(), u = new THREE.Vector3(side, 0, 0);
  const n = new THREE.Vector3().crossVectors(u, v);
  const o = new THREE.Vector3((x0 + x1) / 2, (q0[1] + q1[1]) / 2, side * (q0[0] + q1[0]) / 2).addScaledVector(n, off);
  return { m: new THREE.Matrix4().makeBasis(u, v, n).setPosition(o), H: Math.hypot(q1[0] - q0[0], q1[1] - q0[1]) };
}
function rrectPath(P, w, h, r, rev) {
  const x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2;
  if (!rev) { P.moveTo(x0 + r, y0); P.lineTo(x1 - r, y0); P.quadraticCurveTo(x1, y0, x1, y0 + r); P.lineTo(x1, y1 - r); P.quadraticCurveTo(x1, y1, x1 - r, y1); P.lineTo(x0 + r, y1); P.quadraticCurveTo(x0, y1, x0, y1 - r); P.lineTo(x0, y0 + r); P.quadraticCurveTo(x0, y0, x0 + r, y0); }
  else { P.moveTo(x0 + r, y0); P.quadraticCurveTo(x0, y0, x0, y0 + r); P.lineTo(x0, y1 - r); P.quadraticCurveTo(x0, y1, x0 + r, y1); P.lineTo(x1 - r, y1); P.quadraticCurveTo(x1, y1, x1, y1 - r); P.lineTo(x1, y0 + r); P.quadraticCurveTo(x1, y0, x1 - r, y0); P.lineTo(x0 + r, y0); }
  return P;
}
/* rectangle W x H (grown by g) less a rounded hole w x h, radius r */
function holeGeo(W, H, g, w, h, r) {
  const s = new THREE.Shape(); s.moveTo(-W / 2 - g, -H / 2 - g); s.lineTo(W / 2 + g, -H / 2 - g); s.lineTo(W / 2 + g, H / 2 + g); s.lineTo(-W / 2 - g, H / 2 + g); s.closePath();
  s.holes.push(rrectPath(new THREE.Path(), w, h, r, true));
  return new THREE.ShapeGeometry(s, 4);
}
/* a rounded-rectangle ring t wide, its outside w x h with corner radius r */
function ringGeo(w, h, r, t) { const s = rrectPath(new THREE.Shape(), w, h, r, false); s.holes.push(rrectPath(new THREE.Path(), w - 2 * t, h - 2 * t, Math.max(0.005, r - t), true)); return new THREE.ShapeGeometry(s, 4); }
const rrGeo = (w, h, r) => new THREE.ShapeGeometry(rrectPath(new THREE.Shape(), w, h, r, false), 4);
/* UVs planar in (a, y), as the skin's, so a frame in the skin's material carries the livery across */
function skinUV(g, ref, uvL, uvH) {
  const P = g.attributes.position, uv = new Float32Array(P.count * 2);
  for (let i = 0; i < P.count; i++) { uv[2 * i] = (ref - P.getX(i)) / uvL; uv[2 * i + 1] = P.getY(i) / uvH; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/* ---------------- a lined room inside the body ----------------
   o: st (the body's stations, first and last are the end walls), ref, yF (floor top), th0(a) (windscreen edge,
   omitted for a full roof), holes [[a0, a1]] (windows, on the section's wy), r (window corner radius),
   skin/uvL/uvH (skin material and texture size), line/floor (material keys), caps [front, rear].
   Skin-side parts (window frames) go in gb; the rest in ib. Returns the lining halves by station. */
function hsShell(gb, ib, o) {
  const st = o.st, holes = o.holes || [], thAt = a => o.th0 ? o.th0(a) : Math.PI / 2;
  const lin = st.map(s => {
    const p = s.p, wy = holes.length && p.wy && p.wy[0] > o.yF + 0.01 && p.wy[1] < p.ys - 0.005 ? p.wy : null;   // as hsHalf, where the window fits below the shoulder
    const sideY = wy ? [wy[0], wy[1], p.ys] : [1, 2, 3].map(k => lerp(o.yF, p.ys, k / 3));
    return { a: s.a, R: s.R, p, th0: thAt(s.a), H: liningHalf(s.R, p, o.yF, thAt(s.a), sideY) };
  });
  const N = lin[0].H.length, rings = side => lin.map(l => ({ a: l.a, R: l.H.map(([z, y]) => [side * z, y]) })), idx = [...Array(N).keys()];
  const inHole = (a0, a1) => holes.some(([h0, h1]) => a0 >= h0 - 1e-6 && a1 <= h1 + 1e-6);
  const skip = (a0, a1, j0, j1) => holes.length && j0 === 1 && j1 === 2 && inHole(a0, a1);
  for (const side of [1, -1]) { const acc = newMesh(); loftInto(acc, rings(side), idx, o.ref, 1, 1, 0, skip); ib.add(o.line, meshGeo(acc)); }
  { const acc = newMesh(); loftInto(acc, lin.map(l => ({ a: l.a, R: [[l.H[0][0], l.H[0][1]], [-l.H[0][0], l.H[0][1]]] })), [0, 1], o.ref, 1, 1); ib.add(o.floor, meshGeo(acc)); }
  // end walls: the lining's outline at the first and last station, closed along the floor
  (o.caps || [true, true]).forEach((on, e) => {
    if (!on) return;
    const l = e ? lin[lin.length - 1] : lin[0], pts = [];
    for (const [z, y] of l.H) pts.push([o.ref - l.a, y, z]);
    for (let i = l.H.length - (l.th0 > Math.PI / 2 - 1e-6 ? 2 : 1); i >= 0; i--) pts.push([o.ref - l.a, l.H[i][1], -l.H[i][0]]);
    const acc = newMesh(); capInto(acc, pts, [e ? 1 : -1, 0, 0]); ib.add(o.cap || o.line, meshGeo(acc));
  });
  // the windscreen's reveal: from the lining's edge out to the glass, all round the opening
  if (o.th0) for (const side of [1, -1]) {
    const acc = newMesh();
    loftInto(acc, lin.map(l => { const q = hsSup(l.p, l.th0), e = l.H[N - 1]; return { a: l.a, R: [[side * e[0], e[1]], [side * q[0], q[1]]] }; }), [0, 1], o.ref, 1, 1);
    ib.add('hsRubber', meshGeo(acc));
  }
  // windows: a reveal through the wall, the glass, a rubber gasket, and a frame on each face that rounds the corners
  for (const [h0, h1] of holes) {
    const ls = lin.filter(l => l.a >= h0 - 1e-6 && l.a <= h1 + 1e-6), l0 = ls[0];
    const w = h1 - h0, x0 = o.ref - h1, x1 = o.ref - h0;
    for (const side of [1, -1]) {
      const S = (l, j) => [side * l.R[j][0], l.R[j][1]], I = (l, k) => [side * l.H[k][0], l.H[k][1]];
      const acc = newMesh();
      // sill and head along the opening, then the two jambs
      loftInto(acc, ls.map(l => ({ a: l.a, R: [S(l, WIN_J), I(l, 1)] })), [0, 1], o.ref, 1, 1);
      loftInto(acc, ls.map(l => ({ a: l.a, R: [S(l, WIN_J + 1), I(l, 2)] })), [0, 1], o.ref, 1, 1);
      for (const l of [ls[0], ls[ls.length - 1]]) loftInto(acc, [{ a: l.a, R: [S(l, WIN_J), I(l, 1)] }, { a: l.a, R: [S(l, WIN_J + 1), I(l, 2)] }], [0, 1], o.ref, 1, 1);
      ib.add(o.line, meshGeo(acc));
      const q0 = [l0.R[WIN_J][0], l0.R[WIN_J][1]], q1 = [l0.R[WIN_J + 1][0], l0.R[WIN_J + 1][1]];
      const out = stripFrame(x0, x1, q0, q1, side, 0.0015), Ht = out.H, r = Math.min(o.r, w / 2 - 0.005, Ht / 2 - 0.005);
      gb.add(o.skin, skinUV(holeGeo(w, Ht, 0.004, w, Ht, r).applyMatrix4(out.m), o.ref, o.uvL, o.uvH));
      gb.add('hsRubber', ringGeo(w, Ht, r, 0.016).applyMatrix4(stripFrame(x0, x1, q0, q1, side, 0.0025).m));
      ib.add('hsPane', rrGeo(w, Ht, r).applyMatrix4(stripFrame(x0, x1, q0, q1, side, -0.012).m));
      const inn = stripFrame(x0, x1, l0.H[1], l0.H[2], side, -0.0015);
      ib.add(o.line, holeGeo(w, inn.H, 0.004, w, inn.H, Math.min(r, inn.H / 2 - 0.005)).applyMatrix4(inn.m));
    }
  }
  return lin;
}

/* ---------------- seats ----------------
   A seat facing +x, its cushion centred over the origin on the floor: one side profile extruded across the seat,
   a white cover on the headrest. Per class: width between armrest centres, and how tall and deep it is. */
const HS_SEAT = {
  ord: { w: 0.47, k: 1.0 }, green: { w: 0.58, k: 1.06 }, gran: { w: 0.7, k: 1.12, shell: 'hsWood' },
  bus: { w: 0.56, k: 1.04 }, first: { w: 0.62, k: 1.1 }, cafe: { w: 0.56, k: 1.04 },
};
function seatParts(cls) {
  const key = 'seatGeo_' + cls; if (seatParts[key]) return seatParts[key];
  const c = HS_SEAT[cls], k = c.k, sw = c.w - 0.05;
  const s = new THREE.Shape();
  const P = [[0.25, 0.3], [0.265, 0.42], [0.23, 0.46], [-0.18, 0.47], [-0.29, 1.1 * k], [-0.32, 1.17 * k], [-0.4, 1.16 * k], [-0.43, 1.1 * k], [-0.32, 0.44], [-0.28, 0.3]].map(([x, y]) => [x * Math.sqrt(k), y]);
  s.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) s.lineTo(P[i][0], P[i][1]); s.closePath();
  const body = new THREE.ExtrudeGeometry(s, { depth: sw, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2, curveSegments: 2 });
  body.translate(0, 0, -sw / 2);
  // the cover lies on the front of the backrest, near its top
  const b0 = P[3], b1 = P[4], t = 0.82, cx = lerp(b0[0], b1[0], t), cy = lerp(b0[1], b1[1], t), lean = Math.atan2(b0[0] - b1[0], b1[1] - b0[1]);
  const nx = Math.cos(lean), ny = Math.sin(lean);
  const cover = new THREE.BoxGeometry(0.012, 0.19, sw - 0.12).applyMatrix4(M(cx + 0.02 * nx, cy + 0.02 * ny, 0, 0, 0, lean));
  return (seatParts[key] = { body, cover, sw: c.w, k, shell: c.shell || 'hsShell' });
}
/* a row of seats across the car: groups [[zFrom, n]] each n seats from zFrom toward the aisle (dir -1 from the
   right wall, +1 from the left), facing face (+1 forward), cushions centred at x */
function seatRow(ib, cls, x, face, groups) {
  const S = seatParts(cls), r = face > 0 ? 0 : Math.PI;
  for (const [z0, n, dir] of groups) {
    const zc = i => z0 + dir * S.sw * (i + 0.5), zA = z0 + dir * S.sw * n;
    for (let i = 0; i < n; i++) {
      ib.add('hsSeat_' + cls, S.body.clone(), M(x, 0, zc(i), 0, r, 0));
      ib.add('hsCover', S.cover.clone(), M(x, 0, zc(i), 0, r, 0));
    }
    // one pedestal under the group, armrests between and outside the seats on posts down to it
    ib.box(S.shell, 0.34 * Math.sqrt(S.k), 0.31, Math.abs(zA - z0) - 0.12, x - face * 0.03, 0.155, (z0 + zA) / 2);
    for (let i = 0; i <= n; i++) {
      const z = z0 + dir * S.sw * i - dir * (i === 0 ? -0.025 : i === n ? 0.025 : 0);
      ib.box(S.shell, 0.46, 0.05, 0.05, x - face * 0.04, 0.655, z);
      ib.box(S.shell, 0.06, 0.37, 0.05, x - face * 0.12, 0.47, z);
    }
  }
}
/* a table between two facing rows, on a post to the floor */
function seatTable(ib, x, z0, z1, key = 'hsTable') {
  ib.box(key, 0.5, 0.03, Math.abs(z1 - z0), x, 0.72, (z0 + z1) / 2);
  ib.cyl('hsShell', 0.035, 0.035, 0.705, 10, x, 0.3525, (z0 + z1) / 2);
  ib.cyl('hsShell', 0.18, 0.2, 0.02, 16, x, 0.01, (z0 + z1) / 2);
}

/* ---------------- a saloon ----------------
   o: everything hsShell takes, plus cls, face (+1 seats face the front of the car), rows (x of each row's cushion
   centre, front to back), layout [nLeft, nRight], tables (row pairs facing across a table). */
function hsSaloon(gb, ib, o) {
  const lin = hsShell(gb, ib, Object.assign({ line: 'hsLine', floor: 'hsCarpet_' + o.cls, cap: 'hsEnd' }, o));
  const mid = lin[lin.length >> 1].H, yF = o.yF, zW = y => polyZ(mid, y);
  // luggage racks above the windows, from end to end, a shelf on brackets with a rail along its edge
  const x0 = o.ref - lin[0].a - 0.01, x1 = o.ref - lin[lin.length - 1].a + 0.01, xm = (x0 + x1) / 2, len = x0 - x1;
  for (const s of [-1, 1]) {
    const y = o.rackY, z = zW(y), z2 = zW(y + 0.025);
    ib.box('hsRack', len, 0.022, 0.43, xm, y, s * (Math.max(z, z2) + 0.01 - 0.215));
    ib.box('hsRack', len, 0.05, 0.02, xm, y + 0.014, s * (Math.max(z, z2) - 0.42));
    // brackets every 2.2 m: a strap up the wall from above the window heads, an arm out under the shelf
    for (let x = x1 + 0.6; x < x0 - 0.3; x += 2.2) {
      const zs = zW(y - 0.15); ib.box('hsRack', 0.03, 0.16, 0.025, x, y - 0.075, s * (Math.min(zs, z) - 0.0105));
      ib.box('hsRack', 0.03, 0.02, 0.42, x, y - 0.021, s * (Math.max(z, z2) - 0.205));
    }
  }
  // a light panel down the middle of the ceiling, its edges let into the curve
  { const hw = 0.17, y = polyY(mid, hw) + 0.004; ib.box('hsLight', len - 0.3, 0.03, 2 * hw, xm, y - 0.015, 0); }
  // a sliding door in each end wall, with a window, and the information display over it
  for (const [l, e] of [[lin[0], 1], [lin[lin.length - 1], -1]]) {
    const x = o.ref - l.a - e * 0.02, dh = 1.95;
    ib.box('hsDoor', 0.04, dh, 0.86, x, yF + dh / 2, 0);
    ib.box('hsPane', 0.044, 0.6, 0.42, x, yF + 1.4, 0);
    ib.box('hsRack', 0.05, 0.03, 0.9, x, yF + dh + 0.015, 0);
    ib.box('hsShell', 0.04, 0.14, 0.92, x, yF + dh + 0.18, 0);
    ib.add('hsSign', new THREE.PlaneGeometry(0.84, 0.1), M(x - e * 0.021, yF + dh + 0.18, 0, 0, e > 0 ? -Math.PI / 2 : Math.PI / 2, 0));
  }
  const fit = new GeoBin();   // seats and tables, built on the floor at y 0
  // the seats: a row per window, against the walls with the aisle between
  const S = seatParts(o.cls), zR = Math.min(zW(yF + 0.3), zW(yF + 1.25)) - 0.04;
  const [nL, nR] = o.layout, groups = [[zR, nR, -1], [-zR, nL, 1]];
  o.rows.forEach((x, i) => {
    const f = o.faces ? o.faces[i] : o.face;
    seatRow(fit, o.cls, x, f, groups);
  });
  for (const [xa, xb] of o.tables || []) for (const [z0, n, d] of groups) seatTable(fit, (xa + xb) / 2, z0 - d * 0.04, z0 + d * (S.sw * n - 0.04));
  if (o.counter) {
    const [ca, cb] = o.counter, xc = o.ref - (ca + cb) / 2, cl = cb - ca;
    ib.box('hsEnd', cl, 0.98, 0.62, xc, yF + 0.49, zR - 0.31);
    ib.box('hsWood', cl + 0.04, 0.04, 0.68, xc, yF + 1.0, zR - 0.32);
  }
  for (const k in fit.bins) for (const g of fit.bins[k]) ib.add(k, g.translate(0, yF, 0));
  return lin;
}

/* ---------------- a driving cab ----------------
   o: st, ref, yF, th0, holes/r/skin/uvL/uvH (side windows), dx (model x of a), eye, drv (driver's z),
   prof [[a, y]...] the top of the console from the front wall back to the desk, screen [i0, i1] (the profile
   segment the screens sit on), desk [a0, a1, top, under], sect/cut (to keep the console inside the lining),
   gW (the windscreen's lower edge at a), kind 'e5' | 'acela', lead, uid. */
function hsCab(gb, body, ib, o) {
  hsShell(gb, ib, Object.assign({ line: 'hsCabLine', floor: 'hsCabFloor', cap: 'hsCabLine' }, o));
  const K = new CabKit(ib, body), dx = o.dx, V = (x, y, z) => new THREE.Vector3(x, y, z);
  const inner = (a, y) => { const p = o.sect(a), R = hsRing(p, o.cut); return polyZ(liningHalf(R, p, o.yF, Math.PI / 2, [1, 2, 3].map(k => lerp(o.yF, p.ys, k / 3))), y); };
  const topAt = a => { const P = o.prof; for (let i = 0; i < P.length - 1; i++) if (a <= P[i + 1][0] + 1e-9) return lerp(P[i][1], P[i + 1][1], (a - P[i][0]) / (P[i + 1][0] - P[i][0])); return P[P.length - 1][1]; };
  /* a block lofted along a, its section a rectangle from y0(a) to y1(a), as wide as hw allows inside the lining */
  const block = (key, a0, a1, y0f, y1f, hwMax) => {
    const st = [], n = Math.max(2, Math.ceil((a1 - a0) / 0.05));
    for (let i = 0; i <= n; i++) {
      const a = lerp(a0, a1, i / n), y0 = y0f(a), y1 = Math.min(y1f(a), o.gW(a) - 0.03), hw = Math.min(hwMax, inner(a, y1) - 0.025, inner(a, y0) - 0.025);
      st.push({ a, R: [[-hw, y0], [-hw, y1], [hw, y1], [hw, y0], [-hw, y0]] });
    }
    const acc = newMesh(); loftInto(acc, st, [0, 1, 2, 3, 4], o.ref, 1, 1);
    for (const s of [st[0], st[st.length - 1]]) capInto(acc, s.R.slice(0, 4).map(([z, y]) => [o.ref - s.a, y, z]), [s === st[0] ? 1 : -1, 0, 0]);
    ib.add(key, meshGeo(acc));
    return st;
  };
  const P = o.prof, A0 = o.st[0].a, [dA0, dA1, dTop, dUnder] = o.desk;
  block('hsDesk', A0 - 0.01, P[P.length - 1][0], () => o.yF - 0.01, topAt, 1.45);
  block('hsDeskTop', dA0 - 0.02, dA1, () => dUnder, () => dTop, 1.45);
  // the screens, on the panel that leans back toward the driver
  const [i0, i1] = o.screen, s0 = V(dx(P[i1][0]), P[i1][1], 0), s1 = V(dx(P[i0][0]), P[i0][1], 0), up = s1.clone().sub(s0), sLen = up.length(); up.normalize();
  const sn = V(up.y, -up.x, 0).normalize(); if (sn.x > 0) sn.negate();          // facing back, toward the driver
  const panelFrame = (t, z, off) => faceFrame(s0.clone().addScaledVector(up, t * sLen).addScaledVector(sn, off).setZ(z), sn, up);
  const kinds = ['hsSpeed', 'hsPower', 'air'], reads = [() => CAB_READ.hs(), () => CAB_READ.hsPower(), () => CAB_READ.air(GAME.train)];
  const sw = 0.34, sh = Math.min(0.26, sLen - 0.07);
  [-0.4, 0, 0.4].forEach((dz, i) => {
    const m = panelFrame(0.5, o.drv + dz, 0);
    ib.add('hsDeskTop', new THREE.BoxGeometry(sw + 0.04, sh + 0.04, 0.03).translate(0, 0, 0.0), m);
    let key = 'hsScrOff';
    if (o.lead) {
      const tex = canvasTex(512, 384, g => { g.fillStyle = '#05080a'; g.fillRect(0, 0, 512, 384); });
      key = 'hsScr' + o.uid + i; RMAT[key] = new THREE.MeshBasicMaterial({ map: tex });
      K.screens.push({ tex, kind: kinds[i], draw: drawHsScreen });
    }
    ib.add(key, new THREE.PlaneGeometry(sw, sh).translate(0, 0, 0.0155), m);
    const holder = new THREE.Group(); holder.matrixAutoUpdate = false; holder.matrix.copy(m); body.add(holder);
    K.hit(holder, K.ctl({ id: 'screen', kind: 'info', label: reads[i] }), sw, sh, 0.05, 0, 0, 0.02);
  });
  // handles on the desk: power controller under the left hand, brake under the right, each swinging fore and aft
  const yD = dTop, aH = (dA0 + dA1) / 2;
  const handle = (id, name, z, a, len, knob, ctl, inv, swing) => {
    ib.box('hsDesk', 0.2, 0.03, 0.09, dx(a), yD + 0.015, z);                                    // quadrant
    ib.box('hsRubber', 0.17, 0.004, 0.012, dx(a), yD + 0.031, z);                                // its slot
    const pt = K.part(V(dx(a), yD + 0.02, z));
    pt.gb.cyl('dSteel', 0.018, 0.018, len, 10, 0, len / 2, 0); pt.gb.add(knob, new THREE.SphereGeometry(0.03, 14, 10).translate(0, len + 0.01, 0));
    K.done(pt);
    const c = K.ctl({ id, name, kind: 'lever', part: pt.inner, outer: pt.outer, grip: V(0, len, 0),
      show: () => ctl.get(), p: () => ctlTravel(ctl, inv), setP: p => { ctlSetTravel(ctl, inv, p); GAME.controlTouched('lv' + id[0].toUpperCase() + id.slice(1)); },
      pose: v => { pt.inner.rotation.z = swing * (ctlTravel(Object.assign({}, ctl, { get: () => v }), inv) - 0.5); }, label: () => name + ' · ' + ctl.label(ctl.get()) });
    c.poseP = p => { pt.inner.rotation.z = swing * (p - 0.5); };
    K.hit(pt, c, 0.08, 0.1, 0.08, 0, len, 0);
  };
  const L = o.kind === 'e5' ? [-0.47, 0.45, 0.68, -0.72] : [-0.4, 0.38, 0.55, -0.62];   // power, brake, regen, reverser across from the driver
  handle('throttle', o.kind === 'e5' ? 'Power controller' : 'Throttle', o.drv + L[0], aH, 0.16, 'knob', CTL.throttle, true, 0.9);
  handle('brake', 'Brake', o.drv + L[1], aH, 0.15, 'redKnob', CTL.brake, false, 1.0);
  handle('dyn', 'Regenerative brake', o.drv + L[2], aH + 0.04, 0.1, 'knob', CTL.dyn, false, 0.8);
  if (o.kind === 'acela') handle('ind', 'Independent brake', o.drv + L[2] + 0.17, aH + 0.04, 0.1, 'knob', CTL.ind, false, 0.8);
  {
    // reverser: a short key lever in a block, forward, off, reverse
    const z = o.drv + L[3];
    ib.box('hsDesk', 0.1, 0.035, 0.07, dx(aH), yD + 0.0175, z);
    const pt = K.part(V(dx(aH), yD + 0.03, z));
    pt.gb.box('handle', 0.018, 0.09, 0.03, 0, 0.045, 0); pt.gb.box('knob', 0.05, 0.03, 0.035, 0, 0.09, 0);
    K.done(pt);
    const c = K.ctl({ id: 'reverser', name: 'Reverser', kind: 'lever', part: pt.inner, outer: pt.outer, grip: V(0, 0.09, 0),
      show: () => S.reverser, p: () => ctlTravel(CTL.reverser, false), setP: p => { ctlSetTravel(CTL.reverser, false, p); GAME.controlTouched('lvReverser'); },
      pose: v => { pt.inner.rotation.z = -v * 0.42; }, label: () => 'Reverser · ' + CTL.reverser.label(S.reverser) });
    c.poseP = p => c.pose(1 - 2 * p);
    K.hit(pt, c, 0.07, 0.1, 0.07, 0, 0.07, 0);
  }
  // horn: a push button in front of the driver, held for as long as it sounds
  {
    const z = o.drv, a = dA1 - 0.07;
    ib.cyl('hsDesk', 0.035, 0.035, 0.012, 16, dx(a), yD + 0.006, z);
    const pt = K.part(V(dx(a), yD + 0.012, z));
    pt.gb.cyl('hsBtn', 0.025, 0.025, 0.02, 16, 0, 0.01, 0);
    K.done(pt);
    const h = K.ctl({ id: 'horn', name: 'Horn', kind: 'hold', part: pt.inner, outer: pt.outer, grip: V(0, 0.02, 0),
      show: () => S.whistle > 0.02 ? 1 : 0, p: () => whistleToPull(S.whistle || 0.62), setP: p => { S.whistle = pullToWhistle(p); },
      pose: p => { pt.inner.position.y = -0.008 * clamp(p, 0, 1); }, press: () => { S.whistle = 0.62; }, release: () => { S.whistle = 0; }, label: () => 'Horn · hold it down' });
    h.poseP = () => h.pose(1);
    K.hit(pt, h, 0.06, 0.05, 0.06, 0, 0.02, 0);
  }
  // switches along the back of the desk: pantograph, headlight (and the Acela's bell and ditch lights)
  {
    const defs = [
      { id: 'pan', name: 'Pantograph', get: () => S.panUp ? 1 : 0, tap: () => { const b = $('btnInj'); if (b) b.click(); }, txt: () => S.panUp ? (S.vcb ? 'up · breaker in' : 'rising') : 'down' },
      { id: 'light', name: 'Headlight', get: () => S.light / 2, tap: () => { S.light = (S.light + 1) % 3; }, txt: () => ['off', 'dim', 'bright'][S.light], rot: true },
    ];
    if (o.kind === 'acela') defs.push(
      { id: 'bell', name: 'Bell', get: () => S.bell ? 1 : 0, tap: () => { S.bell = !S.bell; }, txt: () => S.bell ? 'ringing' : 'off' },
      { id: 'ditch', name: 'Ditch lights', get: () => S.ditch ? 1 : 0, tap: () => { S.ditch = !S.ditch; }, txt: () => S.ditch ? 'on' : 'off' });
    const a = dA0 + 0.06, z0 = o.drv + 0.1 - (defs.length - 1) * 0.06;
    ib.box('hsDesk', 0.07, 0.016, defs.length * 0.12, dx(a), yD + 0.008, z0 + (defs.length - 1) * 0.06);
    defs.forEach((d, i) => {
      const z = z0 + i * 0.12, pt = K.part(V(dx(a), yD + 0.016, z));
      if (d.rot) { pt.gb.cyl('knob', 0.022, 0.024, 0.024, 14, 0, 0.012, 0); pt.gb.box('handle', 0.03, 0.006, 0.008, 0, 0.027, 0); }
      else { pt.gb.box(d.id === 'pan' ? 'redKnob' : 'knob', 0.03, 0.02, 0.026, 0, 0.01, 0); pt.gb.box('handle', 0.008, 0.026, 0.006, 0, 0.026, 0); }
      K.done(pt);
      const c = K.ctl({ id: d.id, name: d.name, kind: 'toggle', part: pt.inner, outer: pt.outer, grip: V(0, 0.02, 0),
        show: d.get, pose: d.rot ? (p => { pt.inner.rotation.y = (0.5 - p) * 1.6; }) : (p => { pt.inner.rotation.z = (0.5 - p) * 0.9; }),
        tap: d.tap, label: () => d.name + ' · ' + d.txt() });
      K.hit(pt, c, 0.07, 0.07, 0.08, 0, 0.02, 0);
    });
  }
  /* ---- the rest of a working cab: a glare hood over the screens, standby gauges either side of them, banks of
     lit push buttons on the panel beyond, an indicator strip along the top of the dash, a padded front edge, a
     footrest and pedals under the desk, a ceiling panel with its lights and vents, a breaker panel and jump seat on
     the back wall, a coat hook, the fire extinguisher, and a ribbed mat under the driver's feet ---- */
  const slA = t => lerp(P[i1][0], P[i0][0], t), slY = t => lerp(P[i1][1], P[i0][1], t);
  const room = (t, z, pad) => Math.abs(z) + pad < inner(slA(t), slY(t)) - 0.04;
  {
    const hood = panelFrame(1.0, o.drv, 0), hw = Math.min(0.62, inner(P[i0][0], P[i0][1] + 0.06) - Math.abs(o.drv) - 0.12);
    if (hw > 0.6) {   // only where the dash is wide enough for a hood over all three screens
      ib.add('hsDeskTop', new THREE.BoxGeometry(2 * hw, 0.012, 0.13).translate(0, 0.0, 0.065), hood);
      for (const e of [-1, 1]) ib.add('hsDeskTop', new THREE.BoxGeometry(0.012, sLen * 0.95, 0.1).translate(e * hw, -sLen * 0.47, 0.05), hood);
    }
  }
  [-1, 1].forEach((e, i) => {
    const z = o.drv + e * 0.74;
    if (!room(0.5, z, 0.09)) return;
    const p = s0.clone().addScaledVector(up, 0.5 * sLen).setZ(z);
    K.dial(i ? { kind: 'bpbc', p, n: sn, r: 0.062, depth: 0.03, hands: [[() => GAME.train ? GAME.train.lead.brake.BP : 90], [() => S.BCloco || 0, true]], read: () => CAB_READ.bpbc(GAME.train) }
             : { kind: 'mreq', p, n: sn, r: 0.062, depth: 0.03, hands: [[() => S.MR, true], [() => S.ER]], read: CAB_READ.mreq });
  });
  const lamps = ['hsLampG', 'hsLampA', 'hsLampW', 'hsLampR', 'hsLampG', 'hsLampW'], btn = new THREE.CylinderGeometry(0.013, 0.013, 0.012, 10).rotateX(Math.PI / 2);
  for (const e of [-1, 1]) for (let c = 0; c < 6; c++) {
    const z = o.drv + e * (0.88 + c * 0.075);
    for (let r = 0; r < 3; r++) {
      const t = 0.25 + r * 0.25;
      if (!room(t, z, 0.04)) continue;
      const m = panelFrame(t, z, 0);
      ib.add('hsDeskTop', new THREE.BoxGeometry(0.066, 0.07, 0.006).translate(0, 0, 0.003), m);
      ib.add(lamps[(c + r * 2 + (e > 0 ? 3 : 0)) % lamps.length], btn.clone().translate(0, 0, 0.012), m);
    }
  }
  {   // the indicator strip along the top edge of the dash, beyond the screens
    const a = P[i0][0] - 0.03, y = P[i0][1] + 0.012, n = 14, w = 1.1;
    ib.box('hsDeskTop', 0.05, 0.02, w + 0.04, dx(a), y, o.drv);
    for (let i = 0; i < n; i++) ib.box(['hsLampG', 'hsLampA', 'hsLampR', 'hsLampW'][i % 4], 0.03, 0.012, w / n - 0.02, dx(a), y + 0.016, o.drv - w / 2 + (i + 0.5) * w / n);
  }
  {   // padded front edge of the desk, the footrest and pedals
    const hw = Math.min(1.45, inner(dA1, dTop) - 0.06);
    ib.add('hsSeatCab', new THREE.CylinderGeometry(0.035, 0.035, 2 * hw, 12).rotateX(Math.PI / 2).translate(dx(dA1), dTop - 0.03, 0));
    const aR = P[P.length - 1][0] + 0.14, zf = 0.32;
    ib.add('dSteel', barGeo(0.018, [dx(aR), o.yF + 0.14, o.drv - zf], [dx(aR), o.yF + 0.14, o.drv + zf], 8));
    for (const e of [-1, 1]) ib.box('dSteel', 0.15, 0.03, 0.03, dx(aR - 0.075), o.yF + 0.14, o.drv + e * zf);
    for (const [dz, k] of [[-0.14, 'hsDeskTop'], [0.14, 'hsDeskTop']]) {
      ib.box('hsDesk', 0.22, 0.03, 0.14, dx(aR + 0.25), o.yF + 0.015, o.drv + dz);
      ib.add(k, new THREE.BoxGeometry(0.2, 0.02, 0.11).applyMatrix4(M(dx(aR + 0.25), o.yF + 0.06, o.drv + dz, 0, 0, -0.3)));
    }
    ib.box('hsCabFloor', 0.9, 0.006, 0.8, dx(o.seatA - 0.25), o.yF + 0.003, o.drv);
    for (let i = 0; i < 9; i++) ib.box('dMat', 0.03, 0.006, 0.74, dx(o.seatA - 0.65 + i * 0.1), o.yF + 0.009, o.drv);
  }
  {   // ceiling: a panel over the driver with two lamps and an air vent
    const a = Math.min(o.seatA + 0.7, o.st[o.st.length - 1].a - 0.6), zc = o.drv * 0.5;
    const yc = Math.min(o.sect(a - 0.47).yt, o.sect(a + 0.47).yt) - HS_TH - 0.12;   // under the roof's crown, clear of its curve
    ib.box('hsCabLine', 0.9, 0.02, 0.5, dx(a), yc, zc);
    for (const d of [-0.25, 0.25]) ib.box('hsLight', 0.24, 0.012, 0.16, dx(a + d), yc - 0.016, zc);
    ib.box('grille', 0.3, 0.012, 0.1, dx(a), yc - 0.016, zc + 0.17);
  }
  {   // back wall: a breaker panel with rows of switches, a fold-down jump seat, a coat hook, the extinguisher
    const l = o.st[o.st.length - 1], xw = o.ref - l.a + 0.02, zp = o.door > 0 ? o.door - 0.78 : o.door + 0.78, sd = zp > o.door ? 1 : -1;
    ib.box('hsDesk', 0.06, 0.5, 0.42, xw + 0.03, o.yF + 0.98, zp);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) ib.box(r === 0 ? 'hsLampW' : 'knob', 0.02, 0.035, 0.018, xw + 0.07, o.yF + 0.8 + r * 0.11, zp - 0.15 + c * 0.06);
    ib.box('hsSeatCab', 0.08, 0.36, 0.4, xw + 0.04, o.yF + 0.47, zp);
    for (const e of [-1, 1]) ib.box('dSteel', 0.06, 0.04, 0.03, xw + 0.03, o.yF + 0.31, zp + e * 0.18);
    ib.add('dSteel', barGeo(0.008, [xw + 0.0, o.yF + 1.5, o.door + sd * 0.42], [xw + 0.09, o.yF + 1.55, o.door + sd * 0.42], 5));
    ib.cyl('redKnob', 0.06, 0.06, 0.4, 12, xw + 0.09, o.yF + 0.25, o.door - sd * 0.45);
    ib.box('dSteel', 0.04, 0.12, 0.08, xw + 0.02, o.yF + 0.3, o.door - sd * 0.45);
  }
  // seats on pedestals: the driver's, and for the Acela the second man's across the cab
  const seatTop = o.eye.y - 0.78, sa = o.seatA;
  for (const z of o.seats) {
    cabChair(ib, 'hsSeatCab', dx(sa), z, seatTop, o.yF);
  }
  // the timetable card in its holder in front of the driver, and the train radio handset in its cradle
  {
    const a = aH + 0.02, z = o.drv - 0.1, m = M(dx(a), yD + 0.1, z, 0, 0, -0.35);
    ib.box('hsDesk', 0.06, 0.03, 0.26, dx(a) - 0.01, yD + 0.015, z);
    ib.add('hsDesk', new THREE.BoxGeometry(0.012, 0.2, 0.24).applyMatrix4(m));
    ib.add('white', new THREE.BoxGeometry(0.004, 0.17, 0.2).translate(-0.008, 0.005, 0).applyMatrix4(m));
    const zr = o.drv + (o.drv > 0 ? -0.75 : 0.75), ar = dA0 + 0.12;
    ib.box('hsDesk', 0.16, 0.03, 0.08, dx(ar), yD + 0.015, zr);
    ib.box('knob', 0.05, 0.04, 0.2, dx(ar), yD + 0.05, zr);
    ib.add('dUnder', new THREE.TorusGeometry(0.03, 0.004, 4, 10).rotateY(Math.PI / 2).translate(dx(ar) - 0.04, yD + 0.03, zr + 0.12));
  }
  // a door in the back wall to the corridor
  {
    const l = o.st[o.st.length - 1], p = l.p, H = liningHalf(l.R, p, o.yF, Math.PI / 2, [1, 2, 3].map(k => lerp(o.yF, p.ys, k / 3)));
    const x = o.ref - l.a + 0.02, z = o.door, dh = Math.min(1.85, polyY(H, Math.abs(z) + 0.33) - o.yF - 0.04);
    ib.box('hsDoor', 0.04, dh, 0.62, x, o.yF + dh / 2, z); ib.box('dSteel', 0.05, 0.025, 0.14, x + 0.02, o.yF + Math.min(1.0, dh * 0.55), z + 0.2);
  }
  return K.out(o.eye, { look: [{ yaw: 0, pitch: -0.08 }, { yaw: 0.05, pitch: -0.62 }] });
}

/* what the high-speed screens show when pointed at */
CAB_READ.hs = () => { const T = GAME.train, e5 = T && T.locoKey === 'e5', k = e5 ? 3.6 : 1 / MPH; return `${Math.round(Math.abs(S.v) * k)} ${e5 ? 'km/h' : 'mph'} · limit ${e5 ? Math.round(S.limit * MPH * 3.6) + ' km/h' : Math.round(S.limit) + ' mph'}`; };
CAB_READ.hsPower = () => `${S.kW >= 0 ? 'Power' : 'Regenerating'} ${Math.abs(Math.round(S.kW)).toLocaleString()} kW · ${S.vcb ? 'breaker in' : S.panUp ? 'pantograph rising' : 'pantograph down'}`;

/* ---------------- the high-speed displays ---------------- */
function drawHsScreen(sc, T) {
  if (sc.kind === 'air') return drawCabScreen(sc, T);
  const c = sc.tex.image, g = c.getContext('2d'), w = c.width, h = c.height, e5 = T && T.locoKey === 'e5';
  const unit = e5 ? 'km/h' : 'MPH', k = e5 ? 3.6 : 1 / MPH, vmax = e5 ? 320 : 160;
  g.fillStyle = '#04070a'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#132430'; g.fillRect(0, 0, w, 44);
  g.textBaseline = 'middle'; g.font = 'bold 24px "IBM Plex Mono", monospace';
  const bar = (x, y, bw, bh, f, col, bg = '#14202a') => { g.fillStyle = bg; g.fillRect(x, y, bw, bh); g.fillStyle = col; g.fillRect(x, y, bw * clamp(f, 0, 1), bh); };
  if (sc.kind === 'hsSpeed') {
    const v = Math.abs(S.v) * k, lim = e5 ? S.limit * MPH * 3.6 : S.limit, over = v > lim + 2;
    const dir = S.reverser > 0.5 ? 'FWD' : S.reverser < -0.5 ? 'REV' : 'NEUT';
    g.textAlign = 'left'; g.fillStyle = dir === 'NEUT' ? '#e8c23a' : '#7fe0a0'; g.fillText(dir, 14, 23);
    g.textAlign = 'right'; g.fillStyle = '#cfe9d8'; g.fillText(e5 ? 'ATC' : 'ACSES', w - 14, 23);
    // a speed tape across the screen with the limit marked on it
    const x0 = 30, x1 = w - 30, X = s => x0 + (x1 - x0) * clamp(s / vmax, 0, 1);
    bar(x0, 238, x1 - x0, 26, v / vmax, over ? '#ff6b5a' : '#3fae74');
    g.fillStyle = '#ffb02e'; g.fillRect(X(lim) - 3, 226, 6, 50);
    g.fillStyle = '#5d7480'; g.font = '600 16px "IBM Plex Mono", monospace'; g.textAlign = 'center';
    for (let s = 0; s <= vmax; s += vmax / 8) g.fillText(String(s), X(s), 292);
    g.fillStyle = over ? '#ff8a6a' : '#eef6f1'; g.font = 'bold 120px "IBM Plex Mono", monospace'; g.fillText(String(Math.round(v)), w / 2, 136);
    g.fillStyle = '#8fb3a0'; g.font = '600 22px "IBM Plex Sans Condensed", Arial, sans-serif'; g.fillText(unit, w / 2, 206);
    g.fillStyle = '#ffb02e'; g.font = 'bold 26px "IBM Plex Mono", monospace'; g.fillText('LIMIT ' + Math.round(lim), w / 2, 336);
  } else {
    const notch = Math.round(S.throttle * 8), sp = T ? LOCO_SPEC[T.locoKey] : null, pMax = sp ? sp.P / 1000 : 9600;
    g.textAlign = 'left'; g.fillStyle = '#cfe9d8'; g.fillText(S.dyn > 0.06 ? 'REGEN' : notch ? 'P' + notch : 'COAST', 14, 23);
    g.textAlign = 'right'; g.fillStyle = S.vcb ? '#7fe0a0' : (S.panUp ? '#e8c23a' : '#ff6b5a'); g.fillText(S.vcb ? 'VCB ON' : (S.panUp ? 'PAN UP' : 'PAN DOWN'), w - 14, 23);
    g.textAlign = 'left'; g.fillStyle = '#8fb3a0'; g.font = '600 20px "IBM Plex Sans Condensed", Arial, sans-serif';
    g.fillText('TRACTION', 24, 86); bar(24, 102, w - 48, 26, Math.max(0, S.kW) / pMax, '#3fae74');
    g.fillText('REGENERATION', 24, 160); bar(24, 176, w - 48, 26, Math.max(0, -S.kW) / pMax, '#4aa3e0');
    g.fillStyle = '#eef6f1'; g.font = 'bold 30px "IBM Plex Mono", monospace';
    g.fillText((S.kW >= 0 ? '' : '-') + Math.abs(Math.round(S.kW)).toLocaleString() + ' kW', 24, 244);
    g.fillStyle = '#8fb3a0'; g.font = '600 22px "IBM Plex Mono", monospace';
    g.fillText('LINE ' + (S.vcb ? (e5 ? '25.0' : '25.0') : ' 0.0') + ' kV', 24, 290);
    g.fillText('ENERGY ' + Math.round(S.kWh).toLocaleString() + ' kWh', 24, 326);
    g.textAlign = 'right'; g.fillText('PAN ' + Math.round(S.pan * 100) + '%', w - 24, 290);
  }
  sc.tex.needsUpdate = true;
}

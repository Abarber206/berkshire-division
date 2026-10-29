/* ============================================================================
   Laurel Mountain country: the ground the mountain division runs through.
   The land is shaped first as a drainage system (the Stony River, Laurel Run,
   Bear Run and Pine Creek, with the mountains rising away from them), then
   warped gently so it meets the railroad where the railroad was laid, then
   cut by the creeks, levelled for the towns, and finally graded to the track
   by the same cut-and-fill blend the Ohio division uses.
   ========================================================================== */
const MT = { rivers: [], flats: [], ridges: [] };

/* a polyline through control points, resampled every `step` metres (centripetal-ish Catmull-Rom) */
function mtSpline(ctrl, step = 10) {
  const out = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const c = (a, b, c_, d) => 0.5 * (2 * b + (-a + c_) * t + (2 * a - 5 * b + 4 * c_ - d) * t2 + (-a + 3 * b - 3 * c_ + d) * t3);
      out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(ctrl[ctrl.length - 1].slice(0, 2));
  return out;
}
/* a river: plan points with a bed elevation that only ever falls downstream (from the first point) */
function mtRiver(name, pts, bedAt, opt) {
  const P = []; let s = 0, prev = null;
  for (const [X, N] of pts) { if (prev) s += Math.hypot(X - prev[0], N - prev[1]); P.push({ X, N, s }); prev = [X, N]; }
  P.forEach((p, i) => { p.y = bedAt(p, i, P); });
  for (let i = 1; i < P.length; i++) P[i].y = Math.min(P[i].y, P[i - 1].y - 0.0005 * (P[i].s - P[i - 1].s));   // never uphill going downstream
  const r = Object.assign({ name, pts: P, halfW: 4, bank: 0.42, depth: 0.5, water: true }, opt);
  MT.rivers.push(r);
  return r;
}
/* points beside the main line: off metres to the left, from sA to sB (or as far as the line goes) */
function mtBeside(sA, sB, off, step = 60) {
  const m = ROUTE.main, out = [], dir = Math.sign(sB - sA);
  for (let s = sA; dir > 0 ? s <= sB : s >= sB; s += dir * step) { const o = typeof off === 'function' ? off(s) : off, p = m.poseAt(clamp(s, 0, m.len)), ex = s < 0 ? s : s > m.len ? s - m.len : 0; out.push([p.X - Math.sin(p.h) * o + Math.cos(p.h) * ex, p.N + Math.cos(p.h) * o + Math.sin(p.h) * ex]); }
  return out;
}

function mtPrepare() {
  const F = ROUTE.features, m = ROUTE.main, Y = ROUTE.mainY;
  MT.rivers = []; MT.flats = []; MT.ridges = [];
  // the world box: the railroad and three kilometres round it, on 1.5 km tile lines
  let x0 = Infinity, x1 = -Infinity, n0 = Infinity, n1 = -Infinity;
  for (const e of NET.edges) for (let i = 0; i < e.n; i += 10) { x0 = Math.min(x0, e.X[i]); x1 = Math.max(x1, e.X[i]); n0 = Math.min(n0, e.N[i]); n1 = Math.max(n1, e.N[i]); }
  Object.assign(INNER, { x0: Math.floor((x0 - 3000) / 1500) * 1500, x1: Math.ceil((x1 + 3000) / 1500) * 1500, n0: Math.floor((n0 - 3000) / 1500) * 1500, n1: Math.ceil((n1 + 3000) / 1500) * 1500 });

  /* ---------- the rivers ---------- */
  const sB = ROUTE.bridge.s, pBr = m.poseAt(sB), yBr = Y(sB) - 10.5;
  // Stony River: past Riverton and Hollins on the north side, under the bridge, then up its own valley east to
  // its head below Summit. Its bed falls about 1 m a kilometre below the bridge.
  {
    const west = mtBeside(-9000, 9300, s => lerp(330, 150, smooth(1500, 6000, s)), 120);
    const east = [[pBr.X + 900, pBr.N + 200], [pBr.X + 2600, pBr.N + 700], [700, 1900], [3600, 2050], [6400, 2500], [8700, 2800], [10600, 3300]];
    // it meets the bridge square on, so the approach banks never lie across the water
    const nx = -Math.sin(pBr.h), nn = Math.cos(pBr.h), sq = d => [pBr.X + nx * d, pBr.N + nn * d];
    const pts = mtSpline([...west, sq(230), [pBr.X, pBr.N], sq(-230), ...east], 12).reverse();   // upstream first, so the bed falls along the list
    const L = pts.reduce((a, p, i) => a + (i ? Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
    let sBrR = 0; { let best = Infinity, s = 0; pts.forEach((p, i) => { if (i) s += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]); const d = Math.hypot(p[0] - pBr.X, p[1] - pBr.N); if (d < best) { best = d; sBrR = s; } }); }
    // above the bridge it climbs steadily to its head (about 300 m); below it, it falls gently toward Riverton
    mtRiver('Stony River', pts, p => p.s < sBrR ? yBr + (sBrR - p.s) / sBrR * (300 - yBr) * (0.35 + 0.65 * (sBrR - p.s) / sBrR) : yBr - (p.s - sBrR) * 0.0011,
      { halfW: 24, bank: 0.2, depth: 1.6 });
    MT.riverLen = L;
  }
  // Laurel Run: from a spring inside the horseshoe down the valley beside the climb, into the river above the bridge
  const lr = (() => {
    const pts = mtSpline([...mtBeside(F.horseshoe + 250, sB + 260, s => s > F.horseshoe - 300 ? lerp(-70, -330, smooth(F.horseshoe - 300, F.horseshoe + 250, s)) : -70, 60)], 10);
    return mtRiver('Laurel Run', pts, p => { const s = clamp(F.horseshoe + 250 - p.s, sB, m.len); return Y(s) - 9 - 24 * smooth(F.horseshoe - 1500, F.horseshoe + 250, s); }, { halfW: 3.5, bank: 0.45 });
  })();
  // Bear Run: down a ravine from the east, under the trestle and into Laurel Run
  {
    const v = ROUTE.viaduct, pv = m.poseAt(v.s), lrAt = (() => { let best = null, bd = Infinity; for (const p of lr.pts) { const d = Math.hypot(p.X - (pv.X - 760), p.N - pv.N); if (d < bd) { bd = d; best = p; } } return best; })();
    const pts = mtSpline([[pv.X + 2100, pv.N - 500], [pv.X + 1100, pv.N - 150], [pv.X, pv.N], [pv.X - 400, pv.N + 20], [lrAt.X, lrAt.N]], 10);
    const yv = Y(v.s) - 48;
    let sv = 0; { let s = 0, bd = Infinity; pts.forEach((p, i) => { if (i) s += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]); const d = Math.hypot(p[0] - pv.X, p[1] - pv.N); if (d < bd) { bd = d; sv = s; } }); }
    mtRiver('Bear Run', pts, (p, i, P) => { const tot = P[P.length - 1].s; return p.s < sv ? yv + (sv - p.s) * 0.045 : lerp(yv, lrAt.y + 0.3, (p.s - sv) / (tot - sv)); }, { halfW: 2.5, bank: 0.42 });
  }
  // Pine Creek: rises east of the tunnel and falls beside the line all the way past Ashby
  {
    // past Ashby it turns away south, clear of the turning loop
    const pts = mtSpline(mtBeside(F.tunnelEnd + 2200, m.len + 3000, s => -95 - 1400 * smooth(m.len - 700, m.len + 2200, s), 80), 10);
    mtRiver('Pine Creek', pts, p => { const s = F.tunnelEnd + 2200 + p.s; return Y(Math.min(s, m.len)) - 11 - 0.004 * p.s; }, { halfW: 4, bank: 0.4 });
  }
  // the summit ridge the tunnel goes through: a crest across the line at the bore's middle
  { const sm = (F.tunnel + F.tunnelEnd) / 2, p = m.poseAt(sm); MT.ridges.push({ X: p.X, N: p.N, h: p.h, y: Y(sm), top: 95, half: (F.tunnelEnd - F.tunnel) / 2, len: 5200 }); }

  /* ---------- level ground for the towns ---------- */
  for (const st of ROUTE.stations) {
    if (st.kind !== 'depot') continue;
    const loc = st.line.locate(st.sLine); loc.edge.pose(loc.s, FR);
    MT.flats.push({ X: FR.p.x, N: -FR.p.z, h: Math.atan2(-FR.f.z, FR.f.x), side: st.side, y: FR.p.y - 0.75, U: 330, V: 270 });
  }

  /* ---------- fields on coarse grids ---------- */
  const G = (step) => { const nx = Math.ceil((INNER.x1 - INNER.x0) / step) + 1, nn = Math.ceil((INNER.n1 - INNER.n0) / step) + 1; return { step, nx, nn, a: new Float32Array(nx * nn) }; };
  // river samples hashed for exact distances near the water
  MT.rh = new Map();
  for (const r of MT.rivers) for (let i = 0; i < r.pts.length; i++) {
    const p = r.pts[i], k = Math.floor(p.X / 100) + ',' + Math.floor(p.N / 100);
    let a = MT.rh.get(k); if (!a) MT.rh.set(k, a = []); a.push(p, r, i);
  }
  // distance to the nearest water, by a chamfer sweep on a 100 m grid (good to a few per cent, which is all the uplift needs)
  const chamfer = (seeds) => {
  const dV = G(100), near = new Int32Array(dV.nx * dV.nn).fill(-1);
  dV.a.fill(1e9);
  for (let q = 0; q < seeds.length; q++) { const p = seeds[q], i = Math.round((p.X - INNER.x0) / 100), j = Math.round((p.N - INNER.n0) / 100); if (i < 0 || j < 0 || i >= dV.nx || j >= dV.nn) continue; const k = j * dV.nx + i, d = Math.hypot(INNER.x0 + i * 100 - p.X, INNER.n0 + j * 100 - p.N); if (d < dV.a[k]) { dV.a[k] = d; near[k] = q; } }
  const relax = (i, j, ii, jj) => { if (ii < 0 || jj < 0 || ii >= dV.nx || jj >= dV.nn) return; const kk = jj * dV.nx + ii, q = near[kk]; if (q < 0) return; const p = seeds[q], k = j * dV.nx + i, d = Math.hypot(INNER.x0 + i * 100 - p.X, INNER.n0 + j * 100 - p.N); if (d < dV.a[k]) { dV.a[k] = d; near[k] = q; } };
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j < dV.nn; j++) for (let i = 0; i < dV.nx; i++) { relax(i, j, i - 1, j); relax(i, j, i, j - 1); relax(i, j, i - 1, j - 1); relax(i, j, i + 1, j - 1); }
    for (let j = dV.nn - 1; j >= 0; j--) for (let i = dV.nx - 1; i >= 0; i--) { relax(i, j, i + 1, j); relax(i, j, i, j + 1); relax(i, j, i + 1, j + 1); relax(i, j, i - 1, j + 1); }
  }
  return dV;
  };
  const wet = [];
  for (const r of MT.rivers) for (let i = 0; i < r.pts.length; i += 3) wet.push(r.pts[i]);
  MT.dV = chamfer(wet);
  // and to the nearest track (the forest and the far scenery thin out with it)
  const rails = [];
  for (const e of NET.edges) for (let s = 0; s <= e.len; s += 40) { const [X, N] = e.xz(s); rails.push({ X, N }); }
  MT.dT = chamfer(rails);
  // the valley floor: river elevations spread out by a wide Gaussian (and a still wider one beyond it)
  const fl = G(250), fw = 1400, smp = [];
  for (const r of MT.rivers) for (let i = 0; i < r.pts.length; i += 10) smp.push(r.pts[i]);
  for (let j = 0; j < fl.nn; j++) for (let i = 0; i < fl.nx; i++) {
    const X = INNER.x0 + i * fl.step, N = INNER.n0 + j * fl.step;
    let sw = 0, sy = 0, sw2 = 0, sy2 = 0;
    for (const p of smp) { const d2 = (p.X - X) ** 2 + (p.N - N) ** 2, w2 = Math.exp(-d2 / (2 * 4200 * 4200)); sw2 += w2; sy2 += w2 * p.y; if (d2 < 25e6) { const w = Math.exp(-d2 / (2 * fw * fw)); sw += w; sy += w * p.y; } }
    fl.a[j * fl.nx + i] = (sy + (sy2 / sw2) * 0.02) / (sw + 0.02);
  }
  MT.fl = fl;
  // the railroad's correction: how far the drainage-shaped land is from the grade the track was laid on,
  // spread round each piece of track (not the tunnel or the trestle, which leave the land alone)
  const C = G(50), cw = 210, ch = new Map();
  for (const e of NET.edges) for (let s = 0; s <= e.len; s += 12) {
    if (e.isTunnel(s) || (e.isBridge(s) && e.line === m && Math.abs(e.lineS0 + s - ROUTE.viaduct.s) < ROUTE.viaduct.half + 5)) continue;
    const [X, N] = e.xz(s), k = Math.floor(X / 500) + ',' + Math.floor(N / 500);
    let a = ch.get(k); if (!a) ch.set(k, a = []); a.push(X, N, e.elev(s) - mtValley(X, N));
  }
  for (let j = 0; j < C.nn; j++) for (let i = 0; i < C.nx; i++) {
    const X = INNER.x0 + i * 50, N = INNER.n0 + j * 50, ci = Math.floor(X / 500), cj = Math.floor(N / 500);
    let sw = 0, sr = 0, dm = 1e18;
    for (let b = cj - 2; b <= cj + 2; b++) for (let a = ci - 2; a <= ci + 2; a++) { const l = ch.get(a + ',' + b); if (!l) continue; for (let q = 0; q < l.length; q += 3) { const d2 = (l[q] - X) ** 2 + (l[q + 1] - N) ** 2; if (d2 < dm) dm = d2; if (d2 > 9 * cw * cw) continue; const w = Math.exp(-d2 / (2 * cw * cw)); sw += w; sr += w * l[q + 2]; } }
    // the nearest track's own correction, eased out over the half kilometre beyond it
    C.a[j * C.nx + i] = sw > 0 ? sr / sw * (1 - smooth(120, 640, Math.sqrt(dm))) : 0;
  }
  MT.C = C;
  WORLD.riverPts = [];
}
/* bilinear sample of a coarse field, clamped at the box edges */
function mtField(F, X, N) {
  const fx = clamp((X - INNER.x0) / F.step, 0, F.nx - 1.001), fn = clamp((N - INNER.n0) / F.step, 0, F.nn - 1.001);
  const i = Math.floor(fx), j = Math.floor(fn), tx = fx - i, tn = fn - j, k = j * F.nx + i, a = F.a;
  return (a[k] * (1 - tx) + a[k + 1] * tx) * (1 - tn) + (a[k + F.nx] * (1 - tx) + a[k + F.nx + 1] * tx) * tn;
}
/* ridged noise in 0..1: sharp crests, rounded hollows */
function mtRidged(x, y, oct) {
  let s = 0, a = 0.5, f = 1, w = 1, n = 0;
  for (let i = 0; i < oct; i++) { let v = 1 - Math.abs(Noise.n2(x * f + i * 31.7, y * f - i * 17.9) * 1.4); v *= v; v *= w; w = clamp(v * 1.6, 0, 1); s += v * a; n += a; a *= 0.5; f *= 2.07; }
  return s / n;
}
/* the land as the water shaped it: valley floors at the rivers, mountains rising away from them */
function mtValley(X, N) {
  const dv = mtField(MT.dV, X, N), fl = mtField(MT.fl, X, N);
  const up = 520 * Math.pow(smooth(60, 3000, dv), 0.8);
  const amp = 20 + 210 * smooth(150, 1600, dv);
  let h = fl + up + amp * (mtRidged(X / 2300 + 7.1, N / 2300 - 3.3, 5) - 0.42) + 6 * Noise.fbm(X / 260, N / 260, 3);
  return h;
}
/* the summit ridge: a dome over the bore, 95 m over the rails at the middle and 14 m at the portals (a little
   over the headwalls), dying away within 250 m beyond them */
function mtRidge(X, N, h) {
  for (const r of MT.ridges) {
    const dx = X - r.X, dn = N - r.N, c = Math.cos(r.h), s = Math.sin(r.h), a = Math.abs(dx * c + dn * s), across = -dx * s + dn * c;
    const rise = a < r.half ? 14 + (r.top - 14) * (1 - (a / r.half) ** 2) : 14 * (1 - smooth(r.half, r.half + 250, a));
    if (rise <= 0) continue;
    const T = r.y + rise * (1 + 0.4 * Noise.fbm(X / 700, N / 700, 3));
    h = Math.max(h, lerp(h, T, 1 - smooth(r.len * 0.35, r.len * 0.5, Math.abs(across))));
  }
  return h;
}
/* the nearest bit of water: its bed height, how far, and which river; null beyond 250 m */
function mtWaterNear(X, N) {
  if (mtField(MT.dV, X, N) > 420) return null;   // the coarse distance field rules out most of the map at once
  const ci = Math.floor(X / 100), cj = Math.floor(N / 100); let best = null, bd = 250;
  for (let b = cj - 3; b <= cj + 3; b++) for (let a = ci - 3; a <= ci + 3; a++) {
    const l = MT.rh.get(a + ',' + b); if (!l) continue;
    for (let q = 0; q < l.length; q += 3) {
      const p = l[q], r = l[q + 1], i = l[q + 2], nb = r.pts[Math.min(i + 1, r.pts.length - 1)];
      // distance to the segment p..nb, and the bed height there
      const ux = nb.X - p.X, un = nb.N - p.N, L2 = ux * ux + un * un || 1, t = clamp(((X - p.X) * ux + (N - p.N) * un) / L2, 0, 1);
      const d = Math.hypot(X - p.X - ux * t, N - p.N - un * t) - r.halfW;
      if (d < bd) { bd = d; best = { d, y: lerp(p.y, nb.y, t), r }; }
    }
  }
  return best;
}
/* the natural ground before the track is graded in */
function mtNaturalH(X, N) {
  // the ridge goes on after the railroad's correction, which would otherwise pull it down to the approach cuts
  let h = mtRidge(X, N, mtValley(X, N) + mtField(MT.C, X, N));
  // town sites are levelled to the depot
  for (const f of MT.flats) {
    const dx = X - f.X, dn = N - f.N; if (dx * dx + dn * dn > 700 * 700) continue;
    const u = dx * Math.cos(f.h) + dn * Math.sin(f.h), v = (dx * Math.sin(f.h) - dn * Math.cos(f.h)) * f.side;
    const k = (1 - smooth(f.U, f.U + 160, Math.abs(u))) * (1 - smooth(-20, 20, -v)) * (1 - smooth(f.V, f.V + 160, v));
    if (k > 0) h = lerp(h, f.y + 0.4 * Noise.fbm(X / 90, N / 90, 2), k);
  }
  return mtCarve(X, N, h);
}
/* the water cuts its own bed, through the town flats too: flat across the stream, banks rising away */
function mtCarve(X, N, h) {
  const w = mtWaterNear(X, N);
  if (w) {
    const bed = w.y - 0.6 * (1 - smooth(-w.r.halfW, 0, w.d));
    h = Math.min(h, bed + Math.max(0, w.d + w.r.halfW * 0.55) * w.r.bank + 0.25 * smooth(0, 30, w.d) * Noise.n2(X / 23, N / 23));
    // and never lies below its own surface beyond the banks, where the water would stand over dry land
    if (w.d > 0) { const lip = w.y + w.r.depth + 0.35 + w.d * 0.03; if (h < lip) h = lerp(h, lip, 1 - smooth(40, 240, w.d)); }
  }
  return h;
}
/* how far from the water's edge (the Ohio code reads its river distance from the centre of an 84 m wide river) */
function mtRiverDist(X, N) { const w = mtWaterNear(X, N); return w ? w.d + 21 : 1e9; }
/* the streams' surfaces: a ribbon a little wider than the water, its edges tucked under the banks */
function mtBuildWater(scene) {
  for (const r of MT.rivers) {
    const P = r.pts, pos = [], idx = [], w = r.halfW + 2.5;
    for (let i = 0; i < P.length; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], dx = b.X - a.X, dn = b.N - a.N, L = Math.hypot(dx, dn) || 1, nx = -dn / L, nn = dx / L, y = P[i].y + r.depth;
      pos.push(P[i].X + nx * w, y, -(P[i].N + nn * w), P[i].X - nx * w, y, -(P[i].N - nn * w));
      if (i > 0) { const k = (i - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, MAT.water); m.renderOrder = 1; scene.add(m);
    WORLD.riverPts.push(...P.filter((p, i) => i % 4 === 0).map(p => [p.X, p.N]));
  }
}

/* the mountain's ground: no crops, leaf litter and moss under the woods, rough meadow where the woods thin,
   cinder and ballast shoulders by the track and gravel bars along the water */
function mtGroundColor(X, N, h, lat, out) {
  const wood = (0.55 + 0.5 * Noise.fbm(X / 420 + 9, N / 420 - 4, 3)) * (1 - 0.55 * smooth(700, 2600, mtField(MT.dT, X, N)));
  const k0 = typeof mtClearing === 'function' && mtClearing(X, N, 6) ? 0 : smooth(0.35, 0.75, wood);   // the yards are cleared meadow
  // under the woods: dark leaf litter and the canopy's shade, rust and olive in patches so a wooded hillside reads as autumn woods from afar
  const rust = smooth(-0.1, 0.5, Noise.fbm(X / 160 + 3, N / 160 - 7, 2));
  let r = lerp(0.40, lerp(0.25, 0.34, rust), k0), g = lerp(0.47, lerp(0.27, 0.24, rust), k0), b = lerp(0.24, lerp(0.14, 0.12, rust), k0);
  // hemlock needles darken the high ground
  const hk = smooth(300, 560, h) * k0; r = lerp(r, 0.24, hk * 0.5); g = lerp(g, 0.27, hk * 0.5); b = lerp(b, 0.18, hk * 0.5);
  if (lat && lat.d < 30) {
    const k = 1 - smooth(8, 30, lat.d); r = lerp(r, 0.38, k); g = lerp(g, 0.44, k); b = lerp(b, 0.23, k);
    if (lat.d < 7) { const k2 = 1 - smooth(3, 7, lat.d); r = lerp(r, 0.33, k2); g = lerp(g, 0.31, k2); b = lerp(b, 0.28, k2); }
  }
  const dr = mtRiverDist(X, N);
  if (dr < 50) { const k = 1 - smooth(14, 50, dr); r = lerp(r, 0.42, k); g = lerp(g, 0.40, k); b = lerp(b, 0.33, k); }
  if (WORLD.townMask && inTown(X, N)) { r = 0.36; g = 0.45; b = 0.22; }
  const n = 0.86 + 0.28 * (Noise.n2(X / 37, N / 37) * 0.5 + 0.5);
  out[0] = r * n; out[1] = g * n; out[2] = b * n; out[3] = 0;
}

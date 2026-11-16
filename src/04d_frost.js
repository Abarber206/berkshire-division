/* ============================================================================
   Raven Lake country: the ground the winter loop is laid on. A snowbound
   plateau of low hills and pines, mountains standing round it at the horizon,
   and the lake sunk below it: Raven Cliff falls sheer to the ice along the
   north shore, under the shelf the line comes down on, and the south and west
   shores slope gently down to it. The lake's outlet runs away east, frozen too.
   Ice is the ground there: groundAt never returns less than the ice level.
   ========================================================================== */

/* distances on a grid: nearest-seed chamfer, two sweeps, with the seed's own value carried along */
function frChamfer(x0, n0, step, nx, nn, seeds) {
  const d = new Float32Array(nx * nn).fill(1e9), near = new Int32Array(nx * nn).fill(-1);
  for (let q = 0; q < seeds.length; q += 3) {
    const i = Math.round((seeds[q] - x0) / step), j = Math.round((seeds[q + 1] - n0) / step);
    for (let b = j - 1; b <= j + 1; b++) for (let a = i - 1; a <= i + 1; a++) {
      if (a < 0 || b < 0 || a >= nx || b >= nn) continue;
      const k = b * nx + a, dd = Math.hypot(x0 + a * step - seeds[q], n0 + b * step - seeds[q + 1]);
      if (dd < d[k]) { d[k] = dd; near[k] = q; }
    }
  }
  const relax = (i, j, ii, jj) => {
    if (ii < 0 || jj < 0 || ii >= nx || jj >= nn) return;
    const q = near[jj * nx + ii]; if (q < 0) return;
    const k = j * nx + i, dd = Math.hypot(x0 + i * step - seeds[q], n0 + j * step - seeds[q + 1]);
    if (dd < d[k]) { d[k] = dd; near[k] = q; }
  };
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j < nn; j++) for (let i = 0; i < nx; i++) { relax(i, j, i - 1, j); relax(i, j, i, j - 1); relax(i, j, i - 1, j - 1); relax(i, j, i + 1, j - 1); }
    for (let j = nn - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) { relax(i, j, i + 1, j); relax(i, j, i, j + 1); relax(i, j, i + 1, j + 1); relax(i, j, i - 1, j + 1); }
  }
  return { d, near };
}
/* bilinear sample of a grid { x0, n0, step, nx, nn, a } (clamped at its edges) */
function frField(G, X, N) {
  const fx = clamp((X - G.x0) / G.step, 0, G.nx - 1.001), fn = clamp((N - G.n0) / G.step, 0, G.nn - 1.001);
  const i = Math.floor(fx), j = Math.floor(fn), tx = fx - i, tn = fn - j, k = j * G.nx + i, a = G.a;
  return (a[k] * (1 - tx) + a[k + 1] * tx) * (1 - tn) + (a[k + G.nx] * (1 - tx) + a[k + G.nx + 1] * tx) * tn;
}

function frPrepare() {
  MT.rivers = []; MT.flats = []; MT.ridges = [];
  INNER.step = 10;   // the cliff and the shelf need a finer grid than farm country or the mountain
  let x0 = Infinity, x1 = -Infinity, n0 = Infinity, n1 = -Infinity;
  for (const e of NET.edges) for (let i = 0; i < e.n; i += 10) { x0 = Math.min(x0, e.X[i]); x1 = Math.max(x1, e.X[i]); n0 = Math.min(n0, e.N[i]); n1 = Math.max(n1, e.N[i]); }
  Object.assign(INNER, { x0: Math.floor((x0 - 3000) / 1500) * 1500, x1: Math.ceil((x1 + 3000) / 1500) * 1500, n0: Math.floor((n0 - 3000) / 1500) * 1500, n1: Math.ceil((n1 + 3000) / 1500) * 1500 });

  /* ---------- the water: signed distance to the shore (negative on the ice) on a 10 m grid ---------- */
  {
    const L = FROST.lake, R = FROST.river.pts;
    let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
    for (const p of [...L, ...R]) { a = Math.min(a, p[0]); b = Math.max(b, p[0]); c = Math.min(c, p[1]); d = Math.max(d, p[1]); }
    const st = 10, M = 1500, gx0 = Math.floor((a - M) / st) * st, gn0 = Math.floor((c - M) / st) * st, nx = Math.ceil((b + M - gx0) / st) + 1, nn = Math.ceil((d + M - gn0) / st) + 1;
    // the shore, sampled every 4 m
    const sh = [];
    for (let i = 0; i < L.length; i++) { const p = L[i], q = L[(i + 1) % L.length], n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 4)), c0 = FROST.lakeC[i], c1 = FROST.lakeC[(i + 1) % L.length]; for (let k = 0; k < n; k++) sh.push(p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n, lerp(c0, c1, k / n)); }
    const lk = frChamfer(gx0, gn0, st, nx, nn, sh);
    // the outlet's middle line, with its half-width
    const rv = []; let rs = 0;
    for (let i = 0; i < R.length - 1; i++) { const p = R[i], q = R[i + 1], l = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(1, Math.ceil(l / 4)); for (let k = 0; k < n; k++) rv.push(p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n, FROST.river.halfW(rs + l * k / n)); rs += l; }
    const rk = frChamfer(gx0, gn0, st, nx, nn, rv);
    const A = new Float32Array(nx * nn), C = new Float32Array(nx * nn);
    for (let j = 0; j < nn; j++) {
      // inside the lake: scanline crossings of this row
      const N = gn0 + j * st, xs = [];
      for (let i = 0; i < L.length; i++) { const p = L[i], q = L[(i + 1) % L.length]; if ((p[1] > N) !== (q[1] > N)) xs.push(p[0] + (N - p[1]) / (q[1] - p[1]) * (q[0] - p[0])); }
      xs.sort((u, v) => u - v);
      for (let i = 0; i < nx; i++) {
        const X = gx0 + i * st, k = j * nx + i;
        let inside = false; for (const x of xs) if (x < X) inside = !inside;
        const dl = inside ? -lk.d[k] : lk.d[k], q = rk.near[k], dr = q >= 0 ? rk.d[k] - rv[q + 2] : 1e9;
        A[k] = Math.min(dl, dr);
        // how sheer the nearest shore is (the outlet's banks are gentle)
        C[k] = dl <= dr && lk.near[k] >= 0 ? sh[lk.near[k] + 2] : 0;
      }
    }
    // the sheerness changes where the nearest shore point does: spread it over 150 m so the land has no seams
    for (let pass = 0; pass < 3; pass++) {
      const r = 5, tmp = new Float32Array(C.length);
      for (let j = 0; j < nn; j++) { let acc = 0; const o = j * nx; for (let i = -r; i <= r; i++) acc += C[o + clamp(i, 0, nx - 1)]; for (let i = 0; i < nx; i++) { tmp[o + i] = acc / (2 * r + 1); acc += C[o + Math.min(nx - 1, i + r + 1)] - C[o + Math.max(0, i - r)]; } }
      for (let i = 0; i < nx; i++) { let acc = 0; for (let j = -r; j <= r; j++) acc += tmp[clamp(j, 0, nn - 1) * nx + i]; for (let j = 0; j < nn; j++) { C[j * nx + i] = acc / (2 * r + 1); acc += tmp[Math.min(nn - 1, j + r + 1) * nx + i] - tmp[Math.max(0, j - r) * nx + i]; } }
    }
    FROST.wd = { x0: gx0, n0: gn0, step: st, nx, nn, a: A }; FROST.wc = { x0: gx0, n0: gn0, step: st, nx, nn, a: C };
    // the ice is drawn over the whole of this box; terrain stands above it everywhere but the water
    FROST.box = [gx0, gx0 + (nx - 1) * st, gn0, gn0 + (nn - 1) * st];
  }

  /* ---------- the track: elevation spread round it, distance to it, and which side of the cliff ---------- */
  {
    const st = 25, gx0 = INNER.x0, gn0 = INNER.n0, nx = Math.round((INNER.x1 - gx0) / st) + 1, nn = Math.round((INNER.n1 - gn0) / st) + 1;
    const seeds = [], m = ROUTE.main, [c0, c1] = FROST.cliff;
    for (const e of NET.edges) for (let s = 0; s <= e.len; s += 8) {
      if (e.ice && e.isIce(s)) continue;
      const [X, N] = e.xz(s); seeds.push(X, N, e.elev(s));
    }
    const ch = frChamfer(gx0, gn0, st, nx, nn, seeds);
    const D = new Float32Array(nx * nn), CK = new Float32Array(nx * nn), SK = new Float32Array(nx * nn);
    const ts = 50, tnx = Math.round((INNER.x1 - gx0) / ts) + 1, tnn = Math.round((INNER.n1 - gn0) / ts) + 1, T = new Float32Array(tnx * tnn);
    // the elevation: a Gaussian average of the track within a few hundred metres, so the land follows the grade
    const hash = new Map(), cw = 260;
    for (let q = 0; q < seeds.length; q += 3) { const key = Math.floor(seeds[q] / 500) + ',' + Math.floor(seeds[q + 1] / 500); let l = hash.get(key); if (!l) hash.set(key, l = []); l.push(seeds[q], seeds[q + 1], seeds[q + 2]); }
    // the cliff shelf: main-line points down the cliff, for which side of it a point is
    const shelf = []; for (let s = c0 + 150; s <= c1 + 100; s += 10) { const p = m.poseAt(s); shelf.push(p); }
    for (let j = 0; j < nn; j++) for (let i = 0; i < nx; i++) {
      const X = gx0 + i * st, N = gn0 + j * st, k = j * nx + i, ci = Math.floor(X / 500), cj = Math.floor(N / 500);
      D[k] = ch.d[k];
      // the cliff face stands on the left (uphill) side of the shelf, within 400 m of it
      let best = 1e9, side = 0;
      if (D[k] < 500) for (const p of shelf) { const dd = (p.X - X) ** 2 + (p.N - N) ** 2; if (dd < best) { best = dd; side = -Math.sin(p.h) * (X - p.X) + Math.cos(p.h) * (N - p.N); } }
      CK[k] = best < 400 * 400 && side > 0 ? 1 : 0;
      SK[k] = best < 450 * 450 ? 1 : 0;
    }
    // soften the cliff mask a little so the face has no seam where it starts
    for (let j = 0; j < tnn; j++) for (let i = 0; i < tnx; i++) {
      const X = gx0 + i * ts, N = gn0 + j * ts, ci = Math.floor(X / 500), cj = Math.floor(N / 500);
      let sw = 0, sy = 0, bd = 1e18, by = FROST.plateau;
      for (let b = cj - 2; b <= cj + 2; b++) for (let a = ci - 2; a <= ci + 2; a++) { const l = hash.get(a + ',' + b); if (!l) continue; for (let q = 0; q < l.length; q += 6) { const d2 = (l[q] - X) ** 2 + (l[q + 1] - N) ** 2; if (d2 < bd) { bd = d2; by = l[q + 2]; } if (d2 > 9 * cw * cw) continue; const w = Math.exp(-d2 / (2 * cw * cw)); sw += w; sy += w * l[q + 2]; } }
      T[j * tnx + i] = (sy + by * 1e-4) / (sw + 1e-4);   // far from the track (where it is not used) it eases to the nearest track's height
    }
    const blur = A => { const O = new Float32Array(A.length); for (let j = 0; j < nn; j++) for (let i = 0; i < nx; i++) { let s = 0, n = 0; for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= nx || jj >= nn) continue; s += A[jj * nx + ii]; n++; } O[j * nx + i] = s / n; } return O; };
    const G = a => ({ x0: gx0, n0: gn0, step: st, nx, nn, a });
    FROST.dT = G(D); FROST.T = { x0: gx0, n0: gn0, step: ts, nx: tnx, nn: tnn, a: T }; FROST.CK = G(blur(CK)); FROST.SK = G(blur(SK));
    // the forest and far scenery read the track distance as the mountain's does
    MT.dT = { step: st, nx, nn, a: D };
    MT.dV = { step: st, nx, nn, a: new Float32Array(nx * nn).fill(1e9) };
  }
  WORLD.riverPts = [];
}

/* how far from the shore: negative out on the ice (far from the water, a large number) */
function frShore(X, N) {
  const W = FROST.wd; if (!W) return 1e9;
  if (X < W.x0 || N < W.n0 || X > W.x0 + (W.nx - 1) * W.step || N > W.n0 + (W.nn - 1) * W.step) return 1500;
  return frField(W, X, N);
}
const frOnIce = (X, N) => frShore(X, N) < 0;
/* how much of a shore is cliff: the north shore under the shelf and on west under the plateau */
function frShoreCliff(X, N) { const W = FROST.wc; if (X < W.x0 || N < W.n0 || X > W.x0 + (W.nx - 1) * W.step || N > W.n0 + (W.nn - 1) * W.step) return 0; return frField(W, X, N); }
/* how wide the track's grading spreads: narrow on the cliff shelf, so the face rises close beside it */
function frGradeW(X, N) { return lerp(76, 26, frField(FROST.SK, X, N)); }
/* the country away from the line: a snowbound plateau of low hills that slopes gently down to the lake on its south
   and west shores and breaks off sheer along the north one, mountains rising beyond */
function frBase(X, N, dm, ds) {
  const hills = 16 * Noise.fbm(X / 1400 + 2.3, N / 1400 - 1.1, 4) + 7 * Noise.fbm(X / 330, N / 330, 3);
  let h = FROST.plateau + 6 + hills * smooth(150, 900, ds);
  const far = smooth(900, 4200, dm);
  h += far * (90 + 330 * mtRidged(X / 2600 + 4.1, N / 2600 - 2.2, 5) * (0.6 + 0.4 * Noise.fbm(X / 5000, N / 5000, 2)));
  return h;
}
/* the natural ground before the track is graded in */
function frNaturalH(X, N) {
  const out = X < INNER.x0 || X > INNER.x1 || N < INNER.n0 || N > INNER.n1;
  const dm = out ? 5000 : frField(FROST.dT, X, N), ds = frShore(X, N);
  let h = frBase(X, N, dm, ds);
  // the lake's basin: the shore climbs away from the ice, sheer under the cliff, in long slopes elsewhere
  if (ds < 1400) {
    const cl = frShoreCliff(X, N), lip = FROST.iceY + 0.45 + 0.25 * Noise.n2(X / 17, N / 17);
    if (ds < 0) h = FROST.iceY - 1.6;
    else {
      const gentle = lerp(lip + ds * 0.09, h, Math.pow(smooth(0, 1400, ds), 0.8));
      const sheer = lip + ds * 3.2 + 3 * Noise.fbm(X / 40, N / 40, 2) * smooth(0, 20, ds);
      h = Math.min(h, lerp(gentle, sheer, cl * cl));
    }
  }
  if (out) return h;
  // near the line the land follows its grade; up against the cliff shelf it rises sheer to the plateau
  const T = frField(FROST.T, X, N), ck = frField(FROST.CK, X, N), W = lerp(420, 50, ck);
  const k = smooth(6, W, dm);
  return ds < 0 ? h : lerp(Math.min(T, Math.max(h, FROST.iceY + 0.5)), Math.max(h, lerp(h, T + 4, ck)), k);
}
function frRiverDist(X, N) { return Math.max(0, frShore(X, N)) + 21; }

/* the snow-covered ground: the colours under the snow the ground shader lays over everything level */
function frGroundColor(X, N, h, lat, out) {
  const n = 0.9 + 0.2 * (Noise.n2(X / 37, N / 37) * 0.5 + 0.5);
  let r = 0.80, g = 0.84, b = 0.90;
  // under the pines the snow is thinner and dirtier, needles and shadow
  const wood = (0.55 + 0.5 * Noise.fbm(X / 420 + 9, N / 420 - 4, 3)) * (1 - 0.55 * smooth(700, 2600, frField(FROST.dT, X, N)));
  const k = smooth(0.25, 0.5, wood) * 0.35; r = lerp(r, 0.5, k); g = lerp(g, 0.54, k); b = lerp(b, 0.56, k);
  if (lat && lat.d < 9) { const k2 = 1 - smooth(3.5, 9, lat.d); r = lerp(r, 0.42, k2 * 0.6); g = lerp(g, 0.42, k2 * 0.6); b = lerp(b, 0.43, k2 * 0.6); }   // plowed and sooty by the rails
  const ds = frShore(X, N);
  if (ds < 10) { const k3 = 1 - smooth(0, 10, ds); r = lerp(r, 0.74, k3); g = lerp(g, 0.8, k3); b = lerp(b, 0.88, k3); }   // shore ice and drift
  out[0] = r * n; out[1] = g * n; out[2] = b * n; out[3] = 0;
}

/* ============================================================================
   Laurel Mountain structures and forest: the Riverton engine terminal, the
   Bear Run trestle, Summit tunnel (portals, lining and the hillside graded
   round them), and the forest, grown tile by tile round the camera.
   ========================================================================== */

/* ---------------- Riverton engine terminal ---------------- */
function mtFacilities() {
  const eng = ROUTE.features.engine;
  coalingTower(linePlace(eng, ROUTE.coal.sLine, 0));
  sandHouse(linePlace(eng, 360, 0));
  engineHouse(linePlace(eng, eng.len - 24, 0));
  yardOffice(clearPlace(ROUTE.main, 2300, 10, 6));
}

/* ---------------- Bear Run trestle ----------------
   A double-track steel deck-girder viaduct: tower spans of 9 m and 18 m intermediate spans alternate on
   battered four-legged towers standing on concrete pedestals. Two plate girders under the ties carry each
   track; the frames here are on the middle line between the tracks (track 1 at +z, track 2 at -z). */
function mtBuildViaduct(scene) {
  const V = ROUTE.viaduct, line = V.line, gb = new GeoBin(), off = V.off || 0, TR = off ? [off, -off] : [0];
  const s0 = V.s - V.half, s1 = V.s + V.half;
  const frameAt = (s, F) => { const loc = line.locate(s); loc.edge.pose(loc.s, F); F.p.addScaledVector(F.r, -off); return F; };
  const at = (F, x, y, z) => new THREE.Vector3().copy(F.p).addScaledVector(F.f, x).addScaledVector(_cU0, y).addScaledVector(F.r, z);
  const strut = (key, a, b, w, d) => {   // a box from point a to point b
    const L = a.distanceTo(b), g = new THREE.BoxGeometry(w, L, d), m = new THREE.Matrix4();
    const dir = _v3.subVectors(b, a).normalize(), q = new THREE.Quaternion().setFromUnitVectors(_cU0, dir);
    m.compose(_v2.addVectors(a, b).multiplyScalar(0.5), q, _v1.set(1, 1, 1));
    gb.add(key, g, m);
  };
  const GD = 1.9, GZ = 1.05;                    // girder depth below the tie bottoms, girder centres either side
  const yTop = -0.364, yBot = yTop - GD;          // relative to the railhead
  // abutments at each end: a concrete seat and backwall, with the ballasted fill sloping down to the ground
  for (const [s, dir] of [[s0, -1], [s1, 1]]) {
    const F = frameAt(s, newFrame()), base = frameMatrix(F, new THREE.Matrix4());
    const gl = Math.min(...[-3 - off, 0, 3 + off].map(z => groundAt(at(F, 0, 0, z).x, -at(F, 0, 0, z).z))) - F.p.y, AW = 6.6 + 2 * off;
    // the body under the approach fill, the bridge seat the girder ends bear on, and the backwall between them,
    // which stops under the ties so the track runs straight over it
    const h = -0.5 - gl + 1.5, hs = yBot - gl + 1.5;
    gb.add('concrete', boxT(3.7, h, AW, 2), base.clone().multiply(M(dir * 1.85, -0.5 - h / 2, 0)));
    gb.add('concrete', boxT(1.4, hs, AW, 2), base.clone().multiply(M(-dir * 0.7, yBot - hs / 2, 0)));
    gb.add('concrete', boxT(0.5, -0.42 - yBot, AW), base.clone().multiply(M(-dir * 0.25, (yBot - 0.42) / 2, 0)));
  }
  // the towers: every 27 m, a 9 m tower span then an 18 m girder span
  const towers = [];
  for (let s = s0 + 18; s + 9 <= s1 - 17.9; s += 27) towers.push([s, s + 9]);
  for (const [ta, tb] of towers) {
    const bents = [ta, tb].map(s => {
      const F = frameAt(s, newFrame()), legs = [];
      for (const z of [-1, 1]) {
        const zt = 1.55 + off, top = at(F, 0, yBot - 0.2, z * zt);
        // battered 1 in 6 outward; follow the ground down to the pedestal
        let len = 0, foot = null;
        for (let k = 0; k < 4; k++) { const d = top.y - (foot ? foot.gy : top.y - 20); foot = at(F, 0, yBot - 0.2 - d, z * (zt + d / 6)); foot.gy = groundAt(foot.x, -foot.z) + 0.5; len = d; }
        const bot = at(F, 0, 0, 0); bot.copy(F.p).addScaledVector(_cU0, yBot - 0.2 - (top.y - foot.gy)).addScaledVector(F.r, z * (zt + (top.y - foot.gy) / 6));
        legs.push({ top, bot, z });
        strut('steel', top, bot, 0.42, 0.42);
        // pedestal under each leg, down past the lowest ground round it
        const pm = new THREE.Matrix4().makeRotationY(Math.atan2(-F.f.z, F.f.x)).setPosition(bot.x, bot.y, bot.z);
        let lo = Infinity; for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [0.9, 0.9], [-0.9, 0.9]]) lo = Math.min(lo, groundAt(bot.x + dx, -(bot.z + dz)));
        const ph = bot.y - lo + 0.6;
        gb.add('concrete', boxT(1.5, ph, 1.5), pm.multiply(M(0, -ph / 2 + 0.15, 0)));
      }
      // cap beam across the bent under the girders
      strut('steel', at(F, 0, yBot - 0.2, -1.9 - off), at(F, 0, yBot - 0.2, 1.9 + off), 0.5, 0.45);
      return { F, legs };
    });
    // bracing: struts every 8 m down each bent and between the two bents, with X braces in each panel
    const H = bents[0].legs[0].top.y - bents[0].legs[0].bot.y, nPanel = Math.max(1, Math.round(H / 8));
    const P = (leg, t) => new THREE.Vector3().lerpVectors(leg.top, leg.bot, t);
    for (let i = 0; i <= nPanel; i++) {
      const t = i / nPanel, t2 = (i + 1) / nPanel;
      for (const b of bents) {
        if (i > 0) strut('steel', P(b.legs[0], t), P(b.legs[1], t), 0.22, 0.22);
        if (i < nPanel) { strut('steel', P(b.legs[0], t), P(b.legs[1], t2), 0.12, 0.12); strut('steel', P(b.legs[1], t), P(b.legs[0], t2), 0.12, 0.12); }
      }
      for (let z = 0; z < 2; z++) {
        const a = bents[0].legs[z], c = bents[1].legs[z];
        if (i > 0) strut('steel', P(a, t), P(c, t), 0.22, 0.22);
        if (i < nPanel) { strut('steel', P(a, t), P(c, t2), 0.12, 0.12); strut('steel', P(c, t), P(a, t2), 0.12, 0.12); }
      }
    }
  }
  // plate girders end to end, with stiffeners, bearing on the cap beams and abutment seats
  const stops = [s0 + 0.6, ...towers.flat(), s1 - 0.6];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    for (const z of TR.flatMap(t => [t - GZ, t + GZ])) {
      const Fa = frameAt(a + 0.05, newFrame()), Fb = frameAt(b - 0.05, newFrame());
      strut('steel', at(Fa, 0, (yTop + yBot) / 2, z), at(Fb, 0, (yTop + yBot) / 2, z), 0.06, GD);   // web
      for (const y of [yTop - 0.03, yBot + 0.03]) strut('steel', at(Fa, 0, y, z), at(Fb, 0, y, z), 0.46, 0.06);   // flanges (box lies along the strut)
      for (let s = a + 1.5; s < b - 1; s += 1.5) { const F = frameAt(s, FR2); strut('steel', at(F, 0, yTop - 0.05, z + 0.12), at(F, 0, yBot + 0.05, z + 0.12), 0.1, 0.02); strut('steel', at(F, 0, yTop - 0.05, z - 0.12), at(F, 0, yBot + 0.05, z - 0.12), 0.1, 0.02); }
    }
    // cross frames between the girders
    for (let s = a + 3; s < b - 2; s += 4.5) for (const t of TR) { const F = frameAt(s, FR2); strut('steel', at(F, 0, yTop - 0.1, t - GZ), at(F, 0, yBot + 0.1, t + GZ), 0.1, 0.1); strut('steel', at(F, 0, yBot + 0.1, t - GZ), at(F, 0, yTop - 0.1, t + GZ), 0.1, 0.1); }
  }
  // open deck: ties under each track, guard timbers, and a walkway with a pipe railing along each outer side
  const r = rng(51);
  for (let s = s0 - 1; s <= s1 + 1; s += 0.42) for (const t of TR) {
    const F = frameAt(s, FR2), m = frameMatrix(F, new THREE.Matrix4()), out = t < 0 ? -1 : 1, long = !(Math.round(s / 0.42) % 4);
    const geo = new THREE.BoxGeometry(0.24, 0.24, long ? 4.6 : 3.1); geo.translate(0, -0.3, t + (long ? out * 0.75 : 0));
    const v = 0.7 + r() * 0.3, col = new Float32Array(geo.attributes.position.count * 3);
    for (let i = 0; i < col.length; i += 3) { col[i] = 0.42 * v; col[i + 1] = 0.36 * v; col[i + 2] = 0.29 * v; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    gb.add('tie', geo, m);
  }
  for (let s = s0 - 1; s < s1 + 1; s += 6) {
    const Fa = frameAt(s, newFrame()), Fb = frameAt(Math.min(s + 6, s1 + 1), newFrame());
    for (const t of TR) {
      const out = t < 0 ? -1 : 1;
      for (const z of [-1.42, 1.42]) strut('wood', at(Fa, 0, -0.1, t + z), at(Fb, 0, -0.1, t + z), 0.2, 0.2);
      strut('wood', at(Fa, 0, -0.2, t + out * 2.45), at(Fb, 0, -0.2, t + out * 2.45), 0.66, 0.06);
      strut('steel', at(Fa, 0, 0.85, t + out * 2.75), at(Fb, 0, 0.85, t + out * 2.75), 0.06, 0.06);
      strut('steel', at(Fa, 0, -0.2, t + out * 2.75), at(Fa, 0, 0.85, t + out * 2.75), 0.06, 0.06);
    }
  }
  const vis = gb.build({ steel: MAT.bridge, concrete: SMAT.concrete, tie: MAT.tie, wood: SMAT.wood });
  vis.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(vis);
  // keep the woods off the towers, and from under the deck where it runs low near the ends
  for (const [ta, tb] of towers) { const F = frameAt((ta + tb) / 2, FR2); keep(F.p.x, -F.p.z, 16 + off); }
  for (let s = s0 - 10; s <= s1 + 10; s += 8) { const F = frameAt(s, FR2); if (F.p.y - groundAt(F.p.x, -F.p.z) < 24) keep(F.p.x, -F.p.z, 9 + off); }
}
const _cU0 = new THREE.Vector3(0, 1, 0);

/* ---------------- Summit tunnel ----------------
   A double-track bore, lined in concrete: walls 5.3 m either side of the middle line between the tracks
   (3.05 m outside each track) up to the springing at 4.6 m, then an elliptical arch rising 3.4 m to the
   crown at 8.0 m. At each end a concrete headwall stands across the cut, and the hillside round it is
   graded on a fine patch of ground that replaces the terrain there. */
const BORE = { half: 5.3, spring: 4.6, rise: 3.4, crown: 8.0, wallH: 11.8, wallHalf: 15.6, wallT: 2.4, cutHalf: 6.8, cutSlope: 1.5 };
/* the lining's height over the rail at l metres from the middle of the bore */
const boreTop = l => BORE.spring + BORE.rise * Math.sqrt(Math.max(0, 1 - (l / BORE.half) ** 2));
function boreProfile(n = 16) {   // the inside of the lining, from the left foot round the arch to the right foot
  const p = [[-BORE.half, -1.6], [-BORE.half, BORE.spring]];
  for (let i = 1; i < n; i++) { const a = Math.PI - Math.PI * i / n; p.push([Math.cos(a) * BORE.half, BORE.spring + Math.sin(a) * BORE.rise]); }
  p.push([BORE.half, BORE.spring], [BORE.half, -1.6]);
  return p;
}
function mtBuildTunnels(scene) {
  WORLD.portals = []; WORLD.patches = [];
  for (const T of ROUTE.tunnels) {
    const line = T.line, prof = boreProfile();
    // the lining, darkening toward the middle of the bore where daylight never reaches
    const pos = [], col = [], idx = [], F = newFrame();
    const nS = Math.ceil((T.s1 - T.s0) / 4);
    for (let i = 0; i <= nS; i++) {
      const s = T.s0 + (T.s1 - T.s0) * i / nS, loc = line.locate(s); loc.edge.pose(loc.s, F); F.p.addScaledVector(F.r, -(T.off || 0));
      const depth = Math.min(s - T.s0, T.s1 - s), k = 0.1 + 0.9 * Math.exp(-depth / 35);
      for (const [x, y] of prof) {
        pos.push(F.p.x + F.r.x * x + F.u.x * y, F.p.y + F.r.y * x + F.u.y * y, F.p.z + F.r.z * x + F.u.z * y);
        const v = (0.55 + 0.1 * Noise.hash(i, Math.round(y * 3))) * k; col.push(v, v * 0.97, v * 0.92);
      }
      if (i) { const n = prof.length, a = (i - 1) * n, b = i * n; for (let q = 0; q < n - 1; q++) idx.push(a + q, b + q, a + q + 1, a + q + 1, b + q, b + q + 1); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
    g.computeVertexNormals(); g.computeBoundingSphere();
    const lining = new THREE.Mesh(g, SMAT.lining || (SMAT.lining = new THREE.MeshLambertMaterial({ vertexColors: true, map: TEX.ground })));
    lining.castShadow = true; lining.receiveShadow = true; scene.add(lining);
    if (g.attributes.normal.getY(prof.length * 3 + 8) > 0) throw new Error('tunnel lining wound outward');
    for (const [s, dir] of [[T.s0, 1], [T.s1, -1]]) mtPortal(scene, T, s, dir);
  }
}
/* a portal at s on line, dir +1 when the bore runs on toward +s */
function mtPortal(scene, T, s, dir) {
  const line = T.line, loc = line.locate(s), F = newFrame(); loc.edge.pose(loc.s, F);
  F.p.addScaledVector(F.r, -(T.off || 0));   // the middle of the bore
  if (dir < 0) { F.f.negate(); F.r.negate(); }
  const rail = F.p.y, yaw = Math.atan2(-F.f.z, F.f.x);
  const P = { X: F.p.x, N: -F.p.z, y: rail, yaw, c: Math.cos(yaw), sn: Math.sin(yaw), name: T.name };
  WORLD.portals.push(P);
  // the headwall: a slab across the cut with the arch opening through it, a coping, and pilasters each side
  const gb = binAt(P.X, P.N), base = new THREE.Matrix4().makeRotationY(yaw).setPosition(F.p.x, rail, F.p.z);
  const sh = new THREE.Shape();
  sh.moveTo(-BORE.wallHalf, -2.8); sh.lineTo(BORE.wallHalf, -2.8); sh.lineTo(BORE.wallHalf, BORE.wallH); sh.lineTo(-BORE.wallHalf, BORE.wallH); sh.lineTo(-BORE.wallHalf, -2.8);
  const hole = new THREE.Path(); const pr = boreProfile(24); hole.moveTo(pr[0][0], -2.8);
  for (const [x, y] of pr) hole.lineTo(x, Math.max(y, -2.8)); hole.lineTo(pr[0][0], -2.8);
  sh.holes.push(hole);
  const wall = new THREE.ExtrudeGeometry(sh, { depth: BORE.wallT, bevelEnabled: false, curveSegments: 24 });
  // extruded along +z; turn so the slab lies across the track (local z) with its face toward the approach
  wall.applyMatrix4(new THREE.Matrix4().makeRotationY(-Math.PI / 2)); wall.translate(-0.8, 0, 0);
  { const uv = wall.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2.5, uv.getY(i) / 2.5); }
  gb.add('concrete', wall, base.clone());
  gb.add('concrete', boxT(BORE.wallT + 0.9, 0.7, 2 * BORE.wallHalf + 0.6), base.clone().multiply(M(-0.8 + BORE.wallT / 2 - 0.2, BORE.wallH + 0.35, 0)));   // coping
  for (const z of [-1, 1]) gb.add('concrete', boxT(0.5, BORE.wallH + 2.6, 1.6), base.clone().multiply(M(-1.05, BORE.wallH / 2 - 1.4, z * (BORE.half + 1.6))));   // pilasters
  gb.add('concrete', boxT(0.4, 0.9, 2 * BORE.half + 4.4), base.clone().multiply(M(-1.0, BORE.crown + 0.95, 0)));   // band over the arch
  // the name stone above the arch
  const k = 'tn' + T.name; SMAT[k] = SMAT[k] || nameBoard(T.name + ' · 1913');
  gb.add(k, new THREE.PlaneGeometry(4.6, 0.75), base.clone().multiply(M(-1.21, BORE.crown + 2.2, 0, 0, -Math.PI / 2, 0)));
  keep(P.X, P.N, 26);
  mtPortalPatch(scene, P);
}
/* the portal's coordinates: a = metres into the hill from the headwall face, l = metres to the left */
const portalAL = (P, X, N) => { const dx = X - P.X, dn = N - P.N; return [dx * P.c + dn * P.sn, -dx * P.sn + dn * P.c]; };
/* the graded ground round a portal: the cut runs up to the headwall, the hill comes down to its top behind it */
function portalShape(P, X, N, nat) {
  const [a, l] = portalAL(P, X, N), y0 = P.y - 0.95;
  const cut = y0 + Math.max(0, Math.abs(l) - BORE.cutHalf) * BORE.cutSlope;
  if (a < 0) return Math.min(nat, cut);
  return Math.min(nat, Math.max(cut, P.y + BORE.wallH + 0.62 + Math.max(0, a - 2) * 0.9));   // just under the coping top, then up the hill
}
function mtPortalPatch(scene, P) {
  // a box on the 20 m terrain grid round the portal, wide enough to hold all the grading
  const R = 110, L = INNER, st = L.step;
  let x0 = Infinity, x1 = -Infinity, n0 = Infinity, n1 = -Infinity;
  for (const [a, l] of [[-R, -R], [-R, R], [R, -R], [R, R]]) { const X = P.X + a * P.c - l * P.sn, N = P.N + a * P.sn + l * P.c; x0 = Math.min(x0, X); x1 = Math.max(x1, X); n0 = Math.min(n0, N); n1 = Math.max(n1, N); }
  const i0 = Math.floor((x0 - L.x0) / st), i1 = Math.ceil((x1 - L.x0) / st), j0 = Math.floor((n0 - L.n0) / st), j1 = Math.ceil((n1 - L.n0) / st);
  const patch = { P, i0, i1, j0, j1, X0: L.x0 + i0 * st, X1: L.x0 + i1 * st, N0: L.n0 + j0 * st, N1: L.n0 + j1 * st, res: 1, mesh: null };
  const main = (X, N) => groundAtGrid(X, N);
  // height inside the patch: the terrain grid's own surface at its edges, the portal grading inside
  patch.h = (X, N) => {
    const [a, l] = portalAL(P, X, N);
    const edge = Math.min(X - patch.X0, patch.X1 - X, N - patch.N0, patch.N1 - N);
    const w = smooth(0, 18, edge) * (1 - smooth(R - 30, R - 5, Math.max(Math.abs(a), Math.abs(l))));
    const g = main(X, N);
    if (w <= 0) return g;
    return lerp(g, portalShape(P, X, N, naturalH(X, N)), w);
  };
  // the mesh: 1 m squares, with the ground right under the track at the opening left out (the ballast covers it)
  const nx = Math.round((patch.X1 - patch.X0) / patch.res), nn = Math.round((patch.N1 - patch.N0) / patch.res);
  const H = new Float32Array((nx + 1) * (nn + 1)); patch.H = H; patch.nx = nx; patch.nn = nn;
  const pos = new Float32Array((nx + 1) * (nn + 1) * 3), col = new Float32Array((nx + 1) * (nn + 1) * 3), uv = new Float32Array((nx + 1) * (nn + 1) * 2), crop = new Float32Array((nx + 1) * (nn + 1)), c = [0, 0, 0, 0];
  for (let j = 0; j <= nn; j++) for (let i = 0; i <= nx; i++) {
    const X = patch.X0 + i * patch.res, N = patch.N0 + j * patch.res, k = j * (nx + 1) + i, h = patch.h(X, N);
    H[k] = h; pos[k * 3] = X; pos[k * 3 + 1] = h; pos[k * 3 + 2] = -N;
    groundColor(X, N, h, latticeAt(X, N), c);
    const [a, l] = portalAL(P, X, N); if (Math.abs(l) < BORE.wallHalf + 6 && a > -40 && a < 6) { const q = 1 - smooth(BORE.cutHalf + 1, BORE.wallHalf + 6, Math.abs(l)); c[0] = lerp(c[0], 0.42, q * 0.7); c[1] = lerp(c[1], 0.40, q * 0.7); c[2] = lerp(c[2], 0.36, q * 0.7); }
    col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2]; crop[k] = c[3];
    uv[k * 2] = X / 14; uv[k * 2 + 1] = N / 14;
  }
  const idx = [];
  for (let j = 0; j < nn; j++) for (let i = 0; i < nx; i++) {
    const X = patch.X0 + (i + 0.5) * patch.res, N = patch.N0 + (j + 0.5) * patch.res, [a, l] = portalAL(P, X, N);
    // the track bed in front of the opening (under the ballast) and the step up to the hill inside the headwall;
    // behind the coping the hill's surface carries on over the bore
    if (Math.abs(l) < BORE.half + 0.6 && a > -9 && a < 0.9) continue;   // a 1 m cell reaches 0.71 m either way of its centre
    const A = j * (nx + 1) + i, B = A + 1, D = A + nx + 1, E = D + 1;
    idx.push(A, B, D, B, E, D);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('aCrop', new THREE.BufferAttribute(crop, 1));
  g.setIndex(idx); g.computeVertexNormals(); mtRockColors(g); g.computeBoundingSphere();
  patch.mesh = new THREE.Mesh(g, MAT.ground); patch.mesh.receiveShadow = true; scene.add(patch.mesh);
  WORLD.patches.push(patch);
}
/* the terrain grid's own surface (its triangles), whatever patches lie over it */
function groundAtGrid(X, N) { const p = WORLD.patches; WORLD.patches = null; const h = groundAt(X, N); WORLD.patches = p; return h; }
/* a patch's surface: its 1 m triangles, split the way the mesh splits them */
function patchAt(X, N) {
  for (const p of WORLD.patches || []) {
    if (X < p.X0 || X > p.X1 || N < p.N0 || N > p.N1) continue;
    const fx = (X - p.X0) / p.res, fn = (N - p.N0) / p.res; let i = Math.floor(fx), j = Math.floor(fn); if (i >= p.nx) i = p.nx - 1; if (j >= p.nn) j = p.nn - 1;
    const tx = fx - i, tn = fn - j, k = j * (p.nx + 1) + i, H = p.H, a = H[k], b = H[k + 1], d = H[k + p.nx + 1], e = H[k + p.nx + 2];
    return tx + tn <= 1 ? a + (b - a) * tx + (d - a) * tn : e + (d - e) * (1 - tx) + (b - e) * (1 - tn);
  }
  return null;
}
/* terrain triangles under a patch are dropped from a tile's detailed mesh */
WORLD.portalHoles = function (t) {
  if (!WORLD.patches || !WORLD.patches.length) return;
  const g = t.hi.geometry, n = Math.round(t.size / t.step) + 1, ix = g.index.array, keepI = [];
  const ti0 = Math.round((t.x0 - INNER.x0) / INNER.step), tj0 = Math.round((t.n0 - INNER.n0) / INNER.step);
  const cells = (n - 1) * (n - 1);
  for (let c = 0; c < ix.length / 6; c++) {
    if (c < cells) {
      const i = ti0 + (c % (n - 1)), j = tj0 + Math.floor(c / (n - 1));
      if (WORLD.patches.some(p => i >= p.i0 && i < p.i1 && j >= p.j0 && j < p.j1)) continue;
    }
    for (let q = 0; q < 6; q++) keepI.push(ix[c * 6 + q]);
  }
  g.setIndex(keepI);
};
/* steep ground shows rock: grey where the slope passes about 45 degrees (the woods cling to anything less) */
function mtRockColors(g) {
  const n = g.attributes.normal, c = g.attributes.color, cr = g.attributes.aCrop;
  for (let i = 0; i < n.count; i++) {
    const k = smooth(0.7, 0.5, n.getY(i)); if (k <= 0) continue;
    const v = 0.9 + 0.2 * Noise.hash(i, 7);
    c.setXYZ(i, lerp(c.getX(i), 0.36 * v, k), lerp(c.getY(i), 0.35 * v, k), lerp(c.getZ(i), 0.32 * v, k));
    if (cr) cr.setX(i, cr.getX(i) * (1 - k));
  }
}
/* inside a bore: the rail height there and how far in, or null */
function mtInBore(x, z, pad = 0) {
  for (const T of ROUTE.tunnels || []) {
    const P0 = WORLD.portals[ROUTE.tunnels.indexOf(T) * 2], P1 = WORLD.portals[ROUTE.tunnels.indexOf(T) * 2 + 1];
    if (!P0) continue;
    const [a, l] = portalAL(P0, x, -z), len = portalAL(P0, P1.X, P1.N)[0];
    if (a < -0.8 || a > len + 0.8 || Math.abs(l) > BORE.half + pad) continue;
    const top = boreTop(l);   // the lining's height over the rail here
    return { rail: lerp(P0.y, P1.y, clamp(a / len, 0, 1)), depth: Math.min(a, len - a), l, top, P: P0 };
  }
  return null;
}

/* ---------------- the forest ----------------
   Grown a 1.5 km tile at a time when the camera comes within reach of it and cleared again when it
   leaves: hemlock and spruce on the high ground and in the hollows, autumn hardwoods on the slopes. */
const FOREST = { tiles: new Map(), geos: null };
function mtForestTile(key, scene) {
  const [ti, tj] = key.split(',').map(Number), X0 = INNER.x0 + ti * 1500, N0 = INNER.n0 + tj * 1500;
  const r = rng(ti * 7919 + tj * 104729 + 13), L = { dec: [], con: [] }, RK = [];
  const sp = 10.5;
  for (let y = N0 + sp / 2; y < N0 + 1500; y += sp) for (let x = X0 + sp / 2; x < X0 + 1500; x += sp) {
    const X = x + (r() - 0.5) * sp * 0.9, N = y + (r() - 0.5) * sp * 0.9, rr = r();
    const dT = mtField(MT.dT, X, N);
    let p = (0.55 + 0.5 * Noise.fbm(X / 420 + 9, N / 420 - 4, 3)) * (1 - 0.55 * smooth(700, 2600, dT));
    if (rr > p) continue;
    const lat = latticeAt(X, N); if (lat && lat.d < 17 + r() * 8) continue;
    if (mtClearing(X, N, r() * 12)) continue;
    if (trackWithin(X, N, 14)) continue;   // the lattice is a 20 m grid; check the real distance close in
    if (mtRiverDist(X, N) < 24) continue;
    if (inTown(X, N) || kept(X, N, 2) || inFoot(X, N, 5)) continue;
    const gy = groundAt(X, N);
    // the woods thin out on rock steeper than about 45 degrees
    const sl = Math.hypot(groundAt(X + 3, N) - groundAt(X - 3, N), groundAt(X, N + 3) - groundAt(X, N - 3)) / 6;
    if (sl > 1 && r() < 0.75) continue;
    // ledge rock breaks out on the steep ground, and a boulder now and then on the forest floor
    if (r() < (sl > 0.55 ? 0.22 : 0.025) && !(lat && lat.d < 16) && !trackWithin(X, N, 17)) { const sz = sl > 0.55 ? 0.8 + r() * 1.6 : 0.5 + r() * 0.9; RK.push([X, gy, N, sz, r() * TAU, (r() * 3) | 0]); }
    const conK = clamp(0.18 + 0.55 * smooth(260, 560, gy) + 0.35 * Noise.fbm(X / 300 - 2, N / 300 + 5, 2), 0.05, 0.9);
    if (r() < conK) L.con.push([X, gy - 0.3, N, 0.95 + r() * 0.8, [0.12 + r() * 0.05, 0.22 + r() * 0.07, 0.13 + r() * 0.03]]);
    else { const x2 = r(); L.dec.push([X, gy - 0.3, N, 0.85 + r() * 0.6, x2 < 0.45 ? [0.28 + r() * 0.1, 0.40 + r() * 0.12, 0.16] : x2 < 0.72 ? [0.74 + r() * 0.14, 0.52 + r() * 0.16, 0.15] : x2 < 0.9 ? [0.68 + r() * 0.1, 0.26 + r() * 0.1, 0.11] : [0.55, 0.40, 0.2]]); }
  }
  const tt = { hi: [], lo: [], c: null, r: 0, solids: [], key };
  const M = { dec: [], con: [] };
  for (const type of ['dec', 'con']) for (const q of L[type]) {
    const s = q[3];
    M[type].push([q[0], q[1], q[2], s, s * (0.9 + ((q[0] * 7 + q[2] * 3) % 1) * 0.25), q[4]]);
    const cell = Math.floor(q[0] / 40) + ',' + Math.floor(-q[2] / 40), e = type === 'dec' ? [q[0], -q[2], 3.7 * s, q[1] + 2.4 * s, q[1] + 9.9 * s] : [q[0], -q[2], 2.6 * s, q[1] + 1.5 * s, q[1] + 10 * s];
    let l = SCN.solids.get(cell); if (!l) SCN.solids.set(cell, l = []); l.push(e); tt.solids.push([cell, e]);
  }
  const T = treeMeshes(M, scene);
  tt.hi = T.hi; tt.lo = T.lo;
  if (RK.length) {
    const BG = boulderGeos(), sph = new THREE.Sphere().setFromPoints(RK.map(q => new THREE.Vector3(q[0], q[1], -q[2]))); sph.radius += 4;
    for (let v = 0; v < 3; v++) {
      const list = RK.filter(q => q[5] === v); if (!list.length) continue;
      const im = new THREE.InstancedMesh(shareGeo(BG[v], sph.clone()), MAT.boulder, list.length);
      list.forEach((q, i) => {
        _m4.compose(_v1.set(q[0], q[1], -q[2]), _q.setFromEuler(_e.set(0, q[4], 0)), _v2.set(q[3], q[3] * (0.8 + 0.3 * ((q[4] * 3) % 1)), q[3] * 0.85)); im.setMatrixAt(i, _m4);
        const cell = Math.floor(q[0] / 40) + ',' + Math.floor(-q[2] / 40), e = [q[0], -q[2], q[3] * 1.1, q[1] - 0.2, q[1] + q[3]];
        let l = SCN.solids.get(cell); if (!l) SCN.solids.set(cell, l = []); l.push(e); tt.solids.push([cell, e]);
      });
      im.userData.sph = im.geometry.boundingSphere;
      im.castShadow = false; im.receiveShadow = true; im.visible = false; scene.add(im); tt.hi.push(im);
    }
  }
  if (T.pts.length) { const s = new THREE.Sphere().setFromPoints(T.pts); tt.c = s.center; tt.r = s.radius + 12; }
  else { tt.c = new THREE.Vector3(X0 + 750, 0, -(N0 + 750)); tt.r = 1100; }
  tt.n = L.dec.length + L.con.length;
  FOREST.tiles.set(key, tt); WORLD.treeTiles.push(tt);
  return tt;
}
/* field boulders and broken ledge rock: a lumpy, flattened stone, mossy on top, in three shapes */
function boulderGeos() {
  if (FOREST.rocks) return FOREST.rocks;
  FOREST.rocks = [1, 2, 3].map(seed => {
    const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position, r = rng(seed * 31);
    const off = [r() * 9, r() * 9, r() * 9];
    for (let i = 0; i < p.count; i++) {
      _v1.fromBufferAttribute(p, i);
      const k = 0.75 + 0.45 * (Noise.n2(_v1.x * 1.3 + off[0], _v1.z * 1.3 + _v1.y + off[1]) + 0.5) + 0.12 * Noise.n2(_v1.x * 4 + off[2], _v1.y * 4 - _v1.z * 3);   // the same at shared corners, so the stone stays closed
      _v1.multiplyScalar(k); _v1.y = _v1.y * 0.62 + 0.18; if (_v1.y < -0.15) _v1.y = -0.15 - (-_v1.y - 0.15) * 0.3;   // sits down in the soil
      p.setXYZ(i, _v1.x * (1 + 0.25 * seed / 3), _v1.y, _v1.z);
    }
    g.computeVertexNormals();
    { // the icosahedron comes unwelded: average the normals of coincident corners so the stone reads rounded
      const n = g.attributes.normal, acc = new Map(), key = i => p.getX(i).toFixed(3) + ',' + p.getY(i).toFixed(3) + ',' + p.getZ(i).toFixed(3);
      for (let i = 0; i < p.count; i++) { const k = key(i); const a = acc.get(k) || [0, 0, 0]; a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i); acc.set(k, a); }
      for (let i = 0; i < p.count; i++) { const a = acc.get(key(i)), l = Math.hypot(a[0], a[1], a[2]) || 1; n.setXYZ(i, a[0] / l, a[1] / l, a[2] / l); }
    }
    const n = g.attributes.normal, col = new Float32Array(p.count * 3), uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const moss = smooth(0.45, 0.85, n.getY(i)) * 0.8, v = 0.9 + 0.2 * r();
      col[i * 3] = lerp(0.6, 0.38, moss) * v; col[i * 3 + 1] = lerp(0.58, 0.4, moss) * v; col[i * 3 + 2] = lerp(0.54, 0.27, moss) * v;
      uv.setXY(i, (p.getX(i) + p.getZ(i)) * 0.35, p.getY(i) * 0.6);
    }
    for (let i = 0; i < col.length; i++) col[i] = Math.pow(col[i], 2.2);   // written linear, as the scene expects
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); (linearizeObject.done || (linearizeObject.done = new WeakSet())).add(col);
    g.computeBoundingSphere();
    return g;
  });
  return FOREST.rocks;
}
/* yards and sidings stand in open ground: woods kept 50 m back from yard tracks and 28 m from sidings */
function mtClearing(X, N, jit) {
  if (!FOREST.clear) {
    FOREST.clear = new Map();
    for (const e of NET.edges) {
      const r = e.kind === 'yard' ? 50 : e.kind === 'siding' ? 28 : 0; if (!r) continue;
      for (let s = 0; s <= e.len; s += 15) { const [x, n] = e.xz(s), k = Math.floor(x / 100) + ',' + Math.floor(n / 100); let l = FOREST.clear.get(k); if (!l) FOREST.clear.set(k, l = []); l.push(x, n, r); }
    }
  }
  const ci = Math.floor(X / 100), cj = Math.floor(N / 100);
  for (let b = cj - 1; b <= cj + 1; b++) for (let a = ci - 1; a <= ci + 1; a++) {
    const l = FOREST.clear.get(a + ',' + b); if (!l) continue;
    for (let q = 0; q < l.length; q += 3) if (Math.hypot(l[q] - X, l[q + 1] - N) < l[q + 2] + jit) return true;
  }
  return false;
}
function mtForestDrop(tt) {
  for (const m of [...tt.hi, ...tt.lo]) { scene.remove(m); dropShared(m.geometry); m.dispose && m.dispose(); const w = WORLD.treeMeshes.indexOf(m); if (w >= 0) WORLD.treeMeshes.splice(w, 1); }
  for (const [cell, e] of tt.solids) { const l = SCN.solids.get(cell); if (l) { const i = l.indexOf(e); if (i >= 0) l.splice(i, 1); } }
  FOREST.tiles.delete(tt.key); WORLD.treeTiles.splice(WORLD.treeTiles.indexOf(tt), 1);
}
/* grow what the camera can see from where it is: everything within reach at once (for the start), or one tile a frame */
function mtForestUpdate(cp, scene, all = false) {
  const reach = Math.max(4000, Math.min(7500, fogFar(7500))), nx = Math.round((INNER.x1 - INNER.x0) / 1500), nn = Math.round((INNER.n1 - INNER.n0) / 1500);
  let best = null, bd = Infinity;
  for (let tj = 0; tj < nn; tj++) for (let ti = 0; ti < nx; ti++) {
    const cx = INNER.x0 + ti * 1500 + 750, cn = INNER.n0 + tj * 1500 + 750, d = Math.hypot(cx - cp.x, -cn - cp.z) - 1060, key = ti + ',' + tj, tt = FOREST.tiles.get(key);
    if (tt && d > reach + 1500) mtForestDrop(tt);
    else if (!tt && d < reach && mtField(MT.dT, cx, cn) < 2600) { if (all) mtForestTile(key, scene); else if (d < bd) { bd = d; best = key; } }
  }
  if (best) mtForestTile(best, scene);
  WORLD.treeCount = [...FOREST.tiles.values()].reduce((a, t) => a + t.n, 0);
}
function mtBuildForest(scene) {
  WORLD.treeTiles = [];
  const st = ROUTE.startLine.poseAt(ROUTE.startS);
  mtForestUpdate(new THREE.Vector3(st.X, 0, -st.N), scene, true);
}

/* every frame on the mountain: forest round the camera, and the daylight going as the camera goes into a bore */
function mtUpdate(cam, scene) {
  if (!WORLD.mtn) return;
  mtForestUpdate(cam.position, scene);
  const b = mtInBore(cam.position.x, cam.position.z, 1);
  const k = b && cam.position.y < b.rail + BORE.crown + 0.5 ? smooth(4, 60, b.depth) : 0;
  SKY.boreK = k;
  if (SKY.sun && SKY.sunBase !== undefined) { SKY.sun.intensity = SKY.sunBase * (1 - 0.94 * k); SKY.hemi.intensity = SKY.hemiBase * (1 - 0.85 * k); }
}

/* ============================================================================
   Overhead line over both main tracks, for the electric trainsets.
   Simple catenary of the kind on modern high-speed lines: a contact wire 5.5 m above the rail
   hung by droppers from a messenger 1.1 m higher, zigzagged 0.2 m either side of the track centre so
   it wears the pantograph strips evenly, and pulled to the outside of curves at each support. Supports
   come every 63 m on tangents and closer on curves, so a chord never strays more than 0.3 m from the
   track centre. Each support is a single mast with a boom out over both tracks where one side is clear,
   a two-mast portal where sidings, platforms or buildings crowd both sides, and on the river bridge a
   pair of drop tubes hung from the truss's lateral struts. Masts stand at least 3 m from any track
   centre and clear of roads, the river, the pole line and every structure in the scenery. The line is
   built the first time an electric train is out, and only shown while one is.
   ========================================================================== */
const WIRE = { built: false, groups: [], H: 5.5, MH: 6.6, BOOM: 7.15, TOP: 8.3, misses: 0, missAt: [], supports: [] };

/* plan boxes of everything standing in the scenery, taken before the bins are merged: [x0, x1, y0, y1, z0, z1] in world axes */
function sceneryBoxes() {
  const hash = new Map(), C = 50, list = [];
  for (const [, gb] of SCN.bins) for (const k in gb.bins) for (const g of gb.bins[k]) {
    if (!g.boundingBox) g.computeBoundingBox();
    const b = g.boundingBox; if (b.isEmpty() || b.max.x - b.min.x > 300 || b.max.z - b.min.z > 300) continue;
    const r = [b.min.x, b.max.x, b.min.y, b.max.y, b.min.z, b.max.z]; list.push(r);
    for (let i = Math.floor(r[0] / C); i <= Math.floor(r[1] / C); i++) for (let j = Math.floor(r[4] / C); j <= Math.floor(r[5] / C); j++) {
      const key = i + ',' + j; if (!hash.has(key)) hash.set(key, []); hash.get(key).push(r);
    }
  }
  SCN.boxes = { hash, C, n: list.length };
}
/* is world point (x, y, z) inside any scenery box grown by pad? */
function inScenery(x, y, z, pad) {
  const B = SCN.boxes; if (!B) return false;
  const l = B.hash.get(Math.floor(x / B.C) + ',' + Math.floor(z / B.C)); if (!l) return false;
  for (const r of l) if (x > r[0] - pad && x < r[1] + pad && y > r[2] - pad && y < r[3] + pad && z > r[4] - pad && z < r[5] + pad) return true;
  return false;
}

function wireMaterials() {
  if (WIRE.mat) return WIRE.mat;
  WIRE.mat = {
    galv: new THREE.MeshLambertMaterial({ color: 0x5d6366 }),
    concrete: SMAT.concrete,
    ins: new THREE.MeshLambertMaterial({ color: 0x6e3f26 }),
    line: new THREE.LineBasicMaterial({ color: 0x1e2022, transparent: true, opacity: 0.9 }),
  };
  return WIRE.mat;
}

function buildWire(scene) {
  if (WIRE.built) return; WIRE.built = true;
  const main = ROUTE.main, main2 = ROUTE.main2;
  if (WORLD.custom || WORLD.mtn || !main || !main2) return;   // no wire over the mountain
  const mat = wireMaterials();
  const bridges = (ROUTE.bridges || (ROUTE.bridge ? [ROUTE.bridge] : [])).slice().sort((p, q) => p.s - q.s);
  const v = new THREE.Vector3();

  /* ---- where the supports go, along track 1 ---- */
  const maxK = (s0, s1) => { let k = 0; for (let s = s0; s <= s1; s += 4) { const loc = main.locate(s); k = Math.max(k, Math.abs(loc.edge.curv(loc.s))); } return k; };
  const spanFrom = s => { const k = maxK(s, s + 63); return k > 1e-6 ? Math.min(63, Math.sqrt(8 * 0.3 / k)) : 63; };
  const at = [];
  for (let s = 0; s < main.len - 20;) {
    const b = bridges.find(q => s > q.s - 76 - 63 && s < q.s + 76), bridge0 = b ? b.s - 76 : -1, bridge1 = b ? b.s + 76 : -1;
    if (b) {
      // last mast short of the bridge, the truss struts across it, first mast beyond
      if (s < bridge0) at.push({ s: bridge0, kind: 'mast' });
      for (const x of [-48, -24, 8, 32]) at.push({ s: b.s + x, kind: 'bridge' });
      s = bridge1 + spanFrom(bridge1) * 0.6; continue;
    }
    at.push({ s, kind: 'mast' });
    s += spanFrom(s);
  }

  /* ---- a clear place for a mast at lateral offset lat (from track 1, + toward track 2) ---- */
  const place = (s, lat) => linePlace(main, s, lat);
  const roadClear = (X, N) => { for (const rx of WORLD.roadsX) if (Math.abs(X - rx) < 9) return false; return Math.abs(N - WORLD.roadN) < 9.5 ? false : true; };
  const mastClear = (s, lat, y) => {
    const p = place(s, lat);
    if (trackGap(p.X, p.N) < 3.0 || !roadClear(p.X, p.N) || riverDist(p.X, p.N) < 10) return false;
    for (const sg of SCN.signals) if (Math.hypot(sg.X - p.X, sg.N - p.N) < 5) return false;   // nor crowd a signal
    for (let h = -1; h <= WIRE.TOP + 0.3; h += 0.5) for (const [dx, dz] of [[0, 0], [0.45, 0.45], [-0.45, 0.45], [0.45, -0.45], [-0.45, -0.45]]) if (inScenery(p.X + dx, y + h, -p.N + dz, 0.4)) return false;
    return true;
  };
  // nothing in the way of a boom running at boom height from lat a to lat b
  const boomClear = (s, a, c, y) => { for (let l = Math.min(a, c); l <= Math.max(a, c); l += 0.5) { const p = place(s, l); if (inScenery(p.X, y + WIRE.BOOM, -p.N, 0.4)) return false; } return true; };

  const bins = new Map();
  const binFor = (X, N) => { const k = Math.floor((X + 20000) / 1500) + ',' + Math.floor((N + 20000) / 1500); if (!bins.has(k)) bins.set(k, { gb: new GeoBin(), lines: [] }); return bins.get(k); };
  const reg = [[], []];   // registration points per track, in order along the line
  let zig = 1;

  // the two tracks at a support: track 1's frame, and where track 2 lies across it
  const frameAt = s => {
    const p1 = place(s, 0), loc2 = main2.locate(ROUTE.to2(s));
    loc2.edge.pose(loc2.s, FR);
    const z2 = (FR.p.x - p1.X) * Math.sin(p1.yaw) + (FR.p.z + p1.N) * Math.cos(p1.yaw);
    return { s, p1, z2, y2: FR.p.y - p1.y, base: baseM(p1.X, p1.y, p1.N, p1.yaw) };
  };
  // track 2 lies to one side (sg); a mast stands 3.4 m out from either track, its boom reaching 0.6 m past the far one
  const chooseMast = F => {
    const { s, p1, z2 } = F, sg = Math.sign(z2) || 1, zO = -sg * 3.4, zI = z2 + sg * 3.4;
    if (mastClear(s, zO, p1.y) && boomClear(s, zO, z2 + sg * 0.6, p1.y)) return { z: [zO], far: z2 + sg * 0.6 };
    if (mastClear(s, zI, p1.y) && boomClear(s, -sg * 0.6, zI, p1.y)) return { z: [zI], far: -sg * 0.6 };
    // both sides crowded: a portal between the nearest clear spots either side
    let a = null, c = null;
    for (let d = 0; d <= 9.1; d += 0.5) if (mastClear(s, zO - sg * d, p1.y)) { a = zO - sg * d; break; }
    for (let d = 0; d <= 20; d += 0.5) if (mastClear(s, zI + sg * d, p1.y)) { c = zI + sg * d; break; }
    return a !== null && c !== null && boomClear(s, a, c, p1.y) ? { z: [a, c] } : null;
  };
  for (const sp of at) {
    let F = frameAt(sp.s), mast = null;
    if (sp.kind === 'mast') {
      // slide a support a little along the track if its own spot is crowded
      for (const dd of [0, 8, -8, 16, -16, 24]) { F = dd ? frameAt(sp.s + dd) : F; mast = chooseMast(F); if (mast) break; }
      if (!mast) { WIRE.misses++; WIRE.missAt.push(Math.round(sp.s)); continue; }
    }
    const { s, p1, z2, y2, base } = F, tz = [0, z2], ty = [0, y2];
    const g = binFor(p1.X, p1.N).gb;
    const k = main.locate(s), curv = k.edge.curv(k.s);
    const stagger = Math.abs(curv) > 1 / 5000 ? -0.2 * Math.sign(curv) : 0.2 * (zig = -zig);
    const yB = WIRE.BOOM;
    if (mast) {
      for (const zm of mast.z) {
        const gy = groundUnder(base, 0, zm, 0.9, 0.9), top = Math.max(gy[1], -0.3) + 0.25;
        footing(g, 'concrete', base, 0, zm, 0.9, 0.9, top);
        const hTop = mast.z.length > 1 ? yB + 0.3 : WIRE.TOP, hh = hTop - top;
        // wide-flange mast: two flanges and a web
        for (const dz of [-0.13, 0.13]) g.add('galv', new THREE.BoxGeometry(0.26, hh, 0.025), P(base, 0, top + hh / 2, zm + dz));
        g.add('galv', new THREE.BoxGeometry(0.02, hh, 0.26), P(base, 0, top + hh / 2, zm));
        g.add('galv', new THREE.BoxGeometry(0.42, 0.04, 0.42), P(base, 0, top + 0.02, zm));          // base plate on the foundation
        g.add('galv', new THREE.BoxGeometry(0.3, 0.02, 0.3), P(base, 0, hTop + 0.01, zm));           // cap
      }
      // the boom: a box girder out over both tracks, or a light truss between portal masts
      const ends = mast.z.length > 1 ? mast.z : [mast.z[0], mast.far], z0 = Math.min(...ends), z1 = Math.max(...ends);
      if (mast.z.length > 1) {
        for (const dy of [-0.22, 0.22]) g.add('galv', new THREE.BoxGeometry(0.16, 0.08, z1 - z0), P(base, 0, yB + dy, (z0 + z1) / 2));
        const n = Math.max(2, Math.round((z1 - z0) / 1.6));
        for (let i = 0; i <= n; i++) g.add('galv', new THREE.BoxGeometry(0.1, 0.44, 0.06), P(base, 0, yB, z0 + (z1 - z0) * i / n));
      } else {
        g.add('galv', new THREE.BoxGeometry(0.16, 0.2, z1 - z0), P(base, 0, yB, (z0 + z1) / 2));
        // tie rod from the mast head to two thirds of the way out
        const zm = mast.z[0], end = [0, yB + 0.1, zm + (mast.far - zm) * 0.66];
        g.add('galv', barGeo(0.025, [0, WIRE.TOP - 0.15, zm], end, 6), base.clone());
      }
    }
    // the hangers: drop tube with an insulator, a messenger clamp, and a steady arm out to the contact wire
    const yTop = sp.kind === 'bridge' ? 7.55 : yB;
    for (let t = 0; t < 2; t++) {
      const z = tz[t], y0 = ty[t], st = t && Math.abs(curv) <= 1 / 5000 ? -stagger : stagger, yR = y0 + WIRE.H + 0.32;
      g.add('galv', new THREE.CylinderGeometry(0.035, 0.035, yTop - yR), P(base, 0, (yTop + yR) / 2, z));
      g.add('ins', new THREE.CylinderGeometry(0.07, 0.07, 0.42, 10), P(base, 0, y0 + WIRE.MH + 0.38, z));
      for (let i = 0; i < 4; i++) g.add('ins', new THREE.CylinderGeometry(0.11, 0.11, 0.03, 12), P(base, 0, y0 + WIRE.MH + 0.22 + i * 0.1, z));
      g.add('galv', new THREE.BoxGeometry(0.16, 0.08, 0.1), P(base, 0, y0 + WIRE.MH, z));
      g.add('galv', barGeo(0.018, [0, yR + 0.02, z], [0, y0 + WIRE.H + 0.02, z + st], 6), base.clone());
      g.add('galv', new THREE.BoxGeometry(0.08, 0.05, 0.05), P(base, 0, y0 + WIRE.H + 0.025, z + st));   // contact wire clamp
      const C = new THREE.Vector3(0, y0 + WIRE.H, z + st).applyMatrix4(base), Mp = new THREE.Vector3(0, y0 + WIRE.MH, z).applyMatrix4(base);
      reg[t].push({ C, M: Mp });
    }
    WIRE.supports.push({ s, kind: sp.kind, z: mast ? mast.z : null, X: p1.X, N: p1.N });
  }

  /* ---- wires: straight contact chords between registrations, a sagging messenger, droppers about every 9 m ---- */
  for (const R of reg) for (let i = 0; i < R.length; i++) {
    const A = R[i], B = R[(i + 1) % R.length], d = A.C.distanceTo(B.C);
    if (d > 140) continue;
    const L = binFor(A.C.x, -A.C.z).lines, n = Math.max(2, Math.round(d / 9)), sag = Math.min(0.6, 0.42 * (d / 63) ** 2);
    L.push(A.C.x, A.C.y, A.C.z, B.C.x, B.C.y, B.C.z);
    let prev = A.M;
    for (let j = 1; j <= n; j++) {
      const t = j / n, m = new THREE.Vector3().lerpVectors(A.M, B.M, t); m.y -= sag * 4 * t * (1 - t);
      L.push(prev.x, prev.y, prev.z, m.x, m.y, m.z); prev = m;
      if (j < n) { const c = new THREE.Vector3().lerpVectors(A.C, B.C, t); L.push(m.x, m.y, m.z, c.x, c.y, c.z); }
    }
  }
  for (const [, bn] of bins) {
    const grp = bn.gb.build(mat, { cast: true });
    if (bn.lines.length) { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(bn.lines, 3)); const cl = new THREE.LineSegments(lg, mat.line); cl.castShadow = true; grp.add(cl); }
    const sph = new THREE.Box3().setFromObject(grp).getBoundingSphere(new THREE.Sphere());
    grp.userData = { c: sph.center, r: sph.radius }; grp.visible = false;
    scene.add(grp); WIRE.groups.push(grp);
  }
  if (WIRE.misses) console.warn('overhead line: no clear place for', WIRE.misses, 'supports');
}

/* shown while an electric train is out, near the camera */
function updateWire(cp) {
  const want = !!(GAME.train && GAME.train.elec) || (MP.on && MP.trains().some(x => x.rt.train.elec));
  if (want && !WIRE.built) buildWire(scene);
  for (const g of WIRE.groups) g.visible = want && g.userData.c.distanceTo(cp) - g.userData.r < 3400;
}

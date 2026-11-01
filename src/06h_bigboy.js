/* ============================================================================
   Union Pacific 4000 class "Big Boy", No. 4014: a simple articulated 4-8-8-4
   (American Locomotive Co., 1941), built to the published figures:
     132 ft 9-1/4 in over the couplers (engine 85 ft 3-2/5 in), 11 ft wide,
     16 ft 2-1/2 in high; engine wheelbase 72 ft 5-1/2 in, engine and tender
     117 ft 7 in; 68 in drivers, two groups of four at 73 in centres (rigid
     wheelbase 18 ft 3 in, 47 ft 3 in over all eight); 36 in lead and 42 in
     trailing wheels; four 23-3/4 x 32 in cylinders, Walschaerts gear; 300 psi;
     762,000 lb engine, 540,000 lb on the drivers, 135,375 lbf.
   The rear engine is the main frame: boiler, firebox and cab ride on it. The
   front engine (its cylinders, eight drivers, the pilot and the front coupler)
   hangs from a hinge just ahead of the rear cylinders and swings out under the
   smokebox on curves, the boiler resting on it through a sliding bearing.
   Tender: "centipede" type, a four-wheel lead truck and five axles in the
   frame, 25,000 gal of water and 28 tons of coal.
   a = metres back from the front coupler face, heights above the rail. Local x
   on the main frame is BB.refR - a, on the front engine BB.refF - a, so the two
   agree on straight track.
   ========================================================================== */
Object.assign(LOCO_SPEC, {
  '4014': { road: 'UNION PACIFIC', num: '4014', short: 'UP', cls: '4000 · 4-8-8-4', built: 'Alco, Dec 1941', weight: 762000, adhesive: 540000, te: 135375, fw: 'Worthington', whistle: 'deep6',
    art: true, wheels: 'spoked', psi: 300, rD: 0.8636, teK: 2 * 23.75 * 23.75 * 32 / 68, vcyl: 8 * Math.PI / 4 * 0.6033 * 0.6033 * 0.8128, boil: 1.7,
    water: 94635, coal: 25401, tenderEmpty: 120000, axles: 12 },
});
const BB = {
  len: 25.99, rD: 0.8636, rL: 0.457, rT: 0.533, cr: 0.4064,
  aL: [2.40, 4.53], aDf: [6.200, 8.053, 9.906, 11.759], aDr: [15.039, 16.892, 18.745, 20.598], aT: [22.39, 24.49],
  yC: 1.10, zC: 1.25, cylR: 0.42, Lm: 3.756, yV: 1.78, zV: 1.20, aH: 12.45,
  yB: 3.38, hw: 1.62,
};
BB.refF = (BB.aDf[0] + BB.aDf[3]) / 2; BB.refR = (BB.aDr[0] + BB.aDr[3]) / 2;
BB.leadA = (BB.aL[0] + BB.aL[1]) / 2;
const bxR = a => BB.refR - a, bxF = a => BB.refF - a;
/* the two engines' cylinders and Walschaerts gear, a values on each engine's own frame */
const BBW = (() => {
  const mk = aD => {
    const aX = aD[2] - BB.Lm;                            // crosshead at mid stroke
    return { aD, aX, cyl: [aX - 2.30, aX - 1.10], aLink: aX + 0.92, yLink: 1.74, rl: 0.42, dMax: 0.30, e: 0.21, Lrr: 1.62, yR: BB.yV - 0.14, a: 0.14, b: 0.80, Lu: 0.72 };
  };
  return { f: mk(BB.aDf), r: mk(BB.aDr) };
})();
/* the boiler: smokebox, first course, cone, the big rear course, firebox back into the cab */
const BBOIL = { sb: [1.95, 6.10, 1.22], c1: [6.10, 9.40, 1.24], cone: [9.40, 11.10], c3: [11.10, 16.60, 1.36], fb: [16.60, 22.55], yR: 3.40 };
BBOIL.bR = a => a < BBOIL.sb[1] ? BBOIL.sb[2] : a < BBOIL.cone[0] ? BBOIL.c1[2] : a < BBOIL.cone[1] ? lerp(BBOIL.c1[2], BBOIL.c3[2], (a - BBOIL.cone[0]) / (BBOIL.cone[1] - BBOIL.cone[0])) : BBOIL.c3[2];
BBOIL.bY = a => a < BBOIL.cone[0] ? BB.yB : a < BBOIL.cone[1] ? lerp(BB.yB, BBOIL.yR, (a - BBOIL.cone[0]) / (BBOIL.cone[1] - BBOIL.cone[0])) : BBOIL.yR;
const BBCAB = (() => {
  const C = { a0: 22.25, a1: 25.45, fl: 2.30, bottom: 2.20, roofY: 4.48, crown: 4.93, hw: 1.58, roofT: 0.05, aBh: 22.55,
    FB: { cy: 3.40, r: 1.36, base: 1.96, wb: 1.42 },
    side: { a0: 22.75, a1: 24.85, y0: 3.08, y1: 3.88 },
    front: { y0: 3.98, y1: 4.38, zi: 1.27, zo: 1.56 } };
  C.x0 = bxR(C.a0); C.x1 = bxR(C.a1); C.bh = bxR(C.aBh);
  C.arch = z => C.crown - (C.crown - C.roofY) * (z / C.hw) ** 2;
  C.ceil = z => C.arch(z) - C.roofT;
  C.fbHalf = y => y >= C.FB.cy ? Math.sqrt(Math.max(0, C.FB.r ** 2 - (y - C.FB.cy) ** 2)) : C.FB.r + (C.FB.wb - C.FB.r) * (C.FB.cy - y) / (C.FB.cy - C.FB.base);
  return C;
})();
BBOIL.top = a => a >= BBOIL.fb[0] ? BBCAB.FB.cy + BBCAB.FB.r : BBOIL.bY(a) + BBOIL.bR(a);
BBOIL.half = (a, y) => { if (a >= BBOIL.fb[0]) return BBCAB.fbHalf(y); const r = BBOIL.bR(a), d = y - BBOIL.bY(a); return Math.sqrt(Math.max(0, r * r - d * d)); };
/* the drift between the two engines: they are not geared together, so their exhausts wander in and out of step */
const bbDrift = odo => 0.9 * Math.sin(odo / 61) + 0.5 * Math.sin(odo / 23 + 1.3);

/* one engine unit's frame, cylinders, saddle, guides, gear brackets, brake rigging; bx maps a to local x */
function bbEngineUnit(gb, bx, W, front) {
  const bar = (k, r, a, b, seg = 8) => gb.add(k, barGeo(r, a, b, seg));
  const aD = W.aD, a0 = front ? 1.35 : W.cyl[0] - 0.25, a1 = front ? BB.aH + 0.05 : 25.9;
  for (const s of [-1, 1]) {
    gb.box('dark', (front ? aD[3] + 0.75 : 21.3) - a0, 0.46, 0.15, bx(((front ? aD[3] + 0.75 : 21.3) + a0) / 2), 1.22, s * 0.56);   // frame over the drivers
    for (let i = 0; i < 4; i++) {
      const xd = bx(aD[i]);
      gb.box('dark', 0.34, 0.5, 0.2, xd, BB.rD + 0.02, s * 0.58);                     // driving box
      for (const d of [-0.22, 0.22]) gb.box('dark', 0.08, 0.62, 0.17, xd + d, 1.05, s * 0.58);
      for (let k = 0; k < 5; k++) gb.box('dark', 0.9 - k * 0.12, 0.035, 0.14, xd, 1.47 + k * 0.035, s * 0.6);   // spring
      gb.box('dark', 0.14, 0.42, 0.18, xd + 0.95, 0.62, s * 0.75); gb.box('dark', 0.05, 0.62, 0.05, xd + 1.0, 1.1, s * 0.62);   // brake shoe & hanger
    }
  }
  for (const a of front ? [1.55, aD[0] - 0.9, (aD[1] + aD[2]) / 2, aD[3] + 0.6] : [W.cyl[1] + 0.5, (aD[1] + aD[2]) / 2, aD[3] + 0.7]) gb.box('dark', 0.24, 0.4, 0.98, bx(a), 1.22, 0);   // cross ties
  /* cylinders, valve chests, saddle */
  const cA = (W.cyl[0] + W.cyl[1]) / 2, cL = W.cyl[1] - W.cyl[0];
  for (const s of [-1, 1]) {
    const z = s * BB.zC;
    gb.cylX('black', BB.cylR, BB.cylR, cL - 0.12, 28, bx(cA), BB.yC, z);
    for (const a of [W.cyl[0] + 0.04, W.cyl[1] - 0.04]) gb.cylX('graphite', BB.cylR + 0.025, BB.cylR + 0.025, 0.08, 28, bx(a), BB.yC, z);
    gb.cylX('graphite', BB.cylR - 0.06, BB.cylR - 0.1, 0.08, 24, bx(W.cyl[0] - 0.04), BB.yC, z);
    gb.cylX('black', 0.30, 0.30, cL + 0.1, 20, bx(cA), BB.yV, s * BB.zV);           // valve chest
    for (const a of [cA - (cL + 0.1) / 2, cA + (cL + 0.1) / 2]) gb.cylX('graphite', 0.32, 0.32, 0.06, 20, bx(a), BB.yV, s * BB.zV);
    gb.box('black', cL - 0.1, BB.yV - BB.yC, 0.34, bx(cA), (BB.yV + BB.yC) / 2, s * 1.16);
    gb.box('black', 0.5, 0.18, 0.18, bx(W.cyl[1] + 0.3), BB.yV, s * BB.zV);           // valve stem guide
    for (const a of [W.cyl[0] + 0.15, W.cyl[1] - 0.15]) gb.add('dark', new THREE.CylinderGeometry(0.025, 0.025, 0.35, 6), M(bx(a), BB.yC - BB.cylR - 0.1, z));   // drain cocks
    for (const dy of [-0.19, 0.19]) gb.box('rod', W.aLink - 0.1 - W.cyl[1], 0.06, 0.14, bx((W.cyl[1] + W.aLink - 0.1) / 2), BB.yC + dy, z);   // crosshead guides
    gb.box('black', 0.16, 1.01, 0.42, bx(W.aLink - 0.1), 1.795, s * 0.98);                      // guide yoke, above the wheel, up to the link bridge
    // link bracket: a plate standing outboard of the link, carrying its trunnions, bridged over the link's top to the yoke
    gb.box('black', 0.62, 0.86, 0.04, bx(W.aLink), W.yLink + 0.17, s * 1.47);
    gb.box('black', 0.3, 0.1, 0.53, bx(W.aLink - 0.05), 2.25, s * 1.215);
    gb.cylZ('dark', 0.06, 0.12, 12, bx(W.aLink), W.yLink, s * 1.43);
  }
  gb.box('black', cL - 0.05, (front ? 2.05 : 2.30) - BB.yV + 0.25, 2.0, bx(cA), ((front ? 2.05 : 2.30) + BB.yV - 0.25) / 2, 0);   // saddle
  return cA;
}

function buildBigBoy(key, trim = '') {
  const spec = LOCO_SPEC[key];
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const front = new THREE.Group(); front.matrixAutoUpdate = false;                 // the front engine, placed by the train
  const gb = new GeoBin(), gf = new GeoBin();
  const C = BBCAB, FB = C.FB, yB = BB.yB, ax = bxR;
  const bar = (k, r, a, b, seg = 8) => gb.add(k, barGeo(r, a, b, seg));
  const RB = { y: 2.66, zi: 1.18, zo: 1.65, t: 0.05, a0: 1.85 };

  /* ===================== front engine ===================== */
  const cylF = bbEngineUnit(gf, bxF, BBW.f, true);
  // the hinge: a tongue off the back of the front frame into a clevis under the rear cylinders
  gf.box('dark', 0.9, 0.3, 0.7, bxF(BB.aH - 0.35), 1.15, 0);
  gf.cyl('dark', 0.16, 0.16, 0.42, 16, bxF(BB.aH), 1.15, 0);
  // the boiler's sliding bearing: a pad on a pedestal from the frame up under the first course
  { const a = 9.0, top = BB.yB - BBOIL.bR(a) - 0.005;
    gf.box('dark', 0.5, top - 1.45, 0.5, bxF(a), (top + 1.45) / 2 - 0.02, 0);
    gf.box('steel', 0.62, 0.04, 0.56, bxF(a), top - 0.02, 0); }
  // pilot beam, a slatted cast pilot sloping down to the rail, the deck back toward the smokebox
  const pil = { beam: 0.48, deckA: 0.55, deckY: 1.36 };
  gf.box('black', 0.26, 0.44, 2.9, bxF(pil.beam + 0.13), 1.05, 0);
  gf.box('dark', 2.05 - pil.deckA, 0.05, 2.9, bxF((pil.deckA + 2.05) / 2), pil.deckY + 0.025, 0);
  gf.box('dark', 1.0, 0.36, 1.4, bxF(1.2), 1.15, 0);
  {
    const top = [bxF(pil.beam + 0.02), 0.84], bot = [bxF(0.12), 0.09], L = Math.hypot(top[0] - bot[0], top[1] - bot[1]), th = Math.atan2(top[1] - bot[1], top[0] - bot[0]) - Math.PI / 2;
    const mx = (top[0] + bot[0]) / 2, my = (top[1] + bot[1]) / 2;
    for (let z = -1.27; z <= 1.28; z += 0.127) gf.add('dark', new THREE.BoxGeometry(0.05, L, 0.065), M(mx, my, z, 0, 0, th));
    for (const t of [0.12, 0.55, 0.95]) gf.add('dark', new THREE.BoxGeometry(0.09, 0.09, 2.7 - t * 0.3), M(lerp(top[0], bot[0], t), lerp(top[1], bot[1], t), 0, 0, 0, th));
    for (const s of [-1, 1]) { const sp = new THREE.Shape(); sp.moveTo(top[0], 0.84); sp.lineTo(bot[0], 0.09); sp.lineTo(bxF(pil.beam + 0.2), 0.09); sp.lineTo(bxF(pil.beam + 0.2), 0.84); sp.closePath(); gf.add('dark', new THREE.ExtrudeGeometry(sp, { depth: 0.06, bevelEnabled: false }).translate(0, 0, s * 1.36 - 0.03)); }
  }
  const coupler = addCoupler(gf, front, { x: bxF(0), out: 1, sx: -pil.beam, sb: 0.84, ly: 1.03, zh: 1.3, yp: 0.8, housing: true, hl: 0.3 });
  // steps up from the pilot to the deck at each corner, with a grab rail
  for (const s of [-1, 1]) {
    const z = s * 1.40;
    for (const y of [0.62, 0.98]) gf.box('dark', 0.36, 0.035, 0.3, bxF(pil.beam + 0.32), y, z);
    for (const d of [-0.17, 0.17]) gf.box('dark', 0.035, pil.deckY - 0.6, 0.3, bxF(pil.beam + 0.32) + d, (pil.deckY + 0.6) / 2, z);
    gf.add('rod', barGeo(0.016, [bxF(0.75), pil.deckY + 0.05, s * 1.32], [bxF(0.75), pil.deckY + 0.95, s * 1.32], 6));
  }
  // steam pipes: out of the flexible joint at the back of the saddle down into each valve chest
  for (const s of [-1, 1]) gf.tube('black', [[bxF(cylF + 0.1), 2.0, s * 0.5], [bxF(cylF), 2.02, s * 0.9], [bxF(cylF), BB.yV + 0.25, s * BB.zV]], 0.14, 12, 12);
  // sand pipes to the front drivers from the sand box (on the boiler) through a flexible hose at the frame
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const xd = bxF(BB.aDf[i]); gf.add('dark', barGeo(0.022, [xd + 0.95, 1.6, s * 1.0], [xd + 0.9, 0.18, s * 0.78], 5)); }

  /* ===================== rear engine (main frame) ===================== */
  const cylR = bbEngineUnit(gb, bxR, BBW.r, false);
  gb.box('dark', 0.6, 0.3, 0.9, ax(BB.aH + 0.05), 1.42, 0);                        // clevis over the front engine's tongue
  for (const s of [-1, 1]) gb.box('dark', 5.0, 0.36, 0.15, ax(23.3), 1.55, s * 0.56);   // cradle under the firebox and cab
  gb.box('dark', 0.24, 0.4, 0.98, ax(25.7), 1.5, 0);
  // the rear cylinders take their steam straight off the boiler
  for (const s of [-1, 1]) gb.tube('black', [[ax(cylR), BB.yB - 0.6, s * 0.95], [ax(cylR), 2.1, s * 1.08], [ax(cylR), BB.yV + 0.25, s * BB.zV]], 0.15, 12, 12);
  // the flexible front steam pipe's ball joint and the boiler's sliding-bearing shoe
  gb.box('dark', 0.5, 0.2, 0.6, ax(9.0), BB.yB - BBOIL.bR(9.0) + 0.06, 0);

  /* ---- boiler ---- */
  const sbTop = yB + BBOIL.sb[2];
  gb.add('graphite', new THREE.CylinderGeometry(BBOIL.sb[2], BBOIL.sb[2], BBOIL.sb[1] - BBOIL.sb[0], 48).rotateZ(Math.PI / 2).translate(ax((BBOIL.sb[0] + BBOIL.sb[1]) / 2), yB, 0));
  gb.add('graphite', new THREE.CylinderGeometry(BBOIL.sb[2] + 0.025, BBOIL.sb[2] + 0.025, 0.09, 48).rotateZ(Math.PI / 2).translate(ax(BBOIL.sb[0] + 0.045), yB, 0));
  const lathe = (pts, a0) => { const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[1], p[0])), 48); g.rotateZ(-Math.PI / 2); g.translate(ax(a0), yB, 0); return g; };
  const door = { r: 0.95, a: BBOIL.sb[0] - 0.17 };
  gb.add('graphite', lathe([[0, door.r + 0.05], [0.04, door.r + 0.05], [0.07, door.r], [0.14, 0.62], [0.17, 0.0]], BBOIL.sb[0] - 0.005));
  for (let i = 0; i < 18; i++) { const t = (i + 0.5) / 18 * TAU; gb.add('dark', new THREE.BoxGeometry(0.07, 0.13, 0.07), M(ax(BBOIL.sb[0] - 0.03), yB + 1.05 * Math.cos(t), 1.05 * Math.sin(t), t, 0, 0)); }
  gb.box('dark', 0.06, 0.08, 0.5, ax(door.a + 0.02), yB - 0.3, 0);                   // door handle
  gb.add('black', new THREE.CylinderGeometry(BBOIL.c1[2], BBOIL.c1[2], BBOIL.c1[1] - BBOIL.c1[0] + 0.02, 48, 1, true).rotateZ(Math.PI / 2).translate(ax((BBOIL.c1[0] + BBOIL.c1[1]) / 2 - 0.01), yB, 0));
  gb.add('black', new THREE.CircleGeometry(BBOIL.c1[2], 48).rotateY(Math.PI / 2).translate(ax(BBOIL.c1[0] - 0.01), yB, 0));
  {
    const L = BBOIL.cone[1] - BBOIL.cone[0], g = new THREE.CylinderGeometry(BBOIL.c1[2], BBOIL.c3[2], L, 48, 1, true).rotateZ(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + (BBOIL.yR - yB) * (L / 2 - p.getX(i)) / L);
    g.computeVertexNormals(); g.translate(ax((BBOIL.cone[0] + BBOIL.cone[1]) / 2), yB, 0); gb.add('black', g);
  }
  gb.add('black', new THREE.CylinderGeometry(BBOIL.c3[2], BBOIL.c3[2], BBOIL.c3[1] - BBOIL.c3[0] + 0.3, 48, 1, true).rotateZ(Math.PI / 2).translate(ax((BBOIL.c3[0] + BBOIL.c3[1] + 0.3) / 2), BBOIL.yR, 0));
  for (const a of [BBOIL.sb[1], 7.7, BBOIL.cone[0], BBOIL.cone[1], 12.9, 14.8, BBOIL.c3[1] - 0.02]) { const r = BBOIL.bR(a + 0.01) + 0.012; gb.add('dark', new THREE.CylinderGeometry(r, r, 0.07, 48, 1, true).rotateZ(Math.PI / 2).translate(ax(a), BBOIL.bY(a + 0.01), 0)); }
  // firebox: round top over sides flaring to the mud ring, from the throat back to the backhead in the cab
  {
    const s = new THREE.Shape();
    s.moveTo(-FB.wb, FB.base); s.lineTo(-FB.r, FB.cy); s.absarc(0, FB.cy, FB.r, Math.PI, 0, true); s.lineTo(FB.wb, FB.base); s.lineTo(-FB.wb, FB.base);
    const g = new THREE.ExtrudeGeometry(s, { depth: BBOIL.fb[1] - BBOIL.fb[0], bevelEnabled: false, curveSegments: 28 });
    g.rotateY(Math.PI / 2); g.translate(ax(BBOIL.fb[1]), 0, 0); gb.add('graphite', g);
    gb.box('dark', BBOIL.fb[1] - BBOIL.fb[0] + 0.05, 0.1, 2 * FB.wb + 0.08, ax((BBOIL.fb[0] + BBOIL.fb[1]) / 2), FB.base - 0.05, 0);   // mud ring
    gb.box('dark', 2.6, 0.24, 1.0, ax(21.0), FB.base - 0.22, 0);                                   // ashpan
  }
  /* ---- stack, domes, top fittings ---- */
  // the double stack: one oblong casing over two exhaust nozzles, squat to clear the loading gauge
  const stk = { a: 4.05, L: 1.30, w: 0.78, top: 4.94 };
  {
    const casing = (rx, rz, h, y, k, open = false) => gb.add(k, new THREE.CylinderGeometry(1, 1, h, 40, 1, open).scale(rx, 1, rz).translate(ax(stk.a), y, 0));
    casing(stk.L / 2 + 0.12, stk.w / 2 + 0.12, 0.24, sbTop - 0.04, 'black');
    casing(stk.L / 2, stk.w / 2, stk.top - 0.05 - sbTop, (stk.top - 0.05 + sbTop) / 2, 'black');
    gb.add('black', new THREE.TorusGeometry(1, 0.06, 10, 40).scale(stk.L / 2, stk.w / 2, 1).rotateX(Math.PI / 2).translate(ax(stk.a), stk.top - 0.06, 0));
    gb.add('blackMatte', new THREE.CircleGeometry(1, 32).scale(stk.L / 2 - 0.02, stk.w / 2 - 0.02, 1).rotateX(-Math.PI / 2).translate(ax(stk.a), stk.top - 0.12, 0));
  }
  const dome = (a0, a1, w, top, k) => {
    const L = a1 - a0, base = BBOIL.top((a0 + a1) / 2) - 0.32, h = top - base, g = new THREE.SphereGeometry(1, 32, 16, 0, TAU, 0, Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = p.getY(i), r = Math.hypot(x, z), ang = Math.atan2(z, x), c = Math.cos(ang), sn = Math.sin(ang);
      const se = Math.pow(Math.pow(Math.abs(c), 4) + Math.pow(Math.abs(sn), 4), -0.25);
      p.setXYZ(i, c * se * r * L / 2, Math.pow(y, 0.55) * h, sn * se * r * w / 2);
    }
    g.computeVertexNormals(); g.translate(ax((a0 + a1) / 2), base, 0); gb.add(k || 'black', g);
    gb.add(k || 'black', new THREE.CylinderGeometry(1, 1, 0.34, 32, 1, true).scale(L / 2, 1, w / 2).translate(ax((a0 + a1) / 2), base - 0.17 + 0.001, 0));
  };
  dome(7.4, 10.4, 0.98, 4.86);                                                     // the long sand dome
  dome(12.2, 13.5, 1.08, 4.90);                                                    // steam dome
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const a = 7.9 + i * 0.66; gb.box('dark', 0.2, 0.14, 0.08, ax(a), BBOIL.top(a) - 0.12, s * 0.46); }
  const fbTop = FB.cy + FB.r;
  for (const z of [-0.26, 0, 0.26]) { gb.cyl('brass', 0.08, 0.1, 0.16, 14, ax(17.1), fbTop + 0.05, z); gb.cyl('brass', 0.115, 0.115, 0.05, 14, ax(17.1), fbTop + 0.14, z); }
  gb.box('black', 0.5, 0.12, 0.76, ax(17.1), fbTop - 0.02, 0);
  const wh = [17.9, FB.cy + Math.sqrt(FB.r * FB.r - 0.7 * 0.7), 0.7];                 // the whistle, low on the engineer's shoulder to clear the loading gauge
  gb.cyl('brass', 0.1, 0.1, 0.24, 16, ax(wh[0]), wh[1] + 0.16, wh[2]); gb.cyl('brass', 0.13, 0.13, 0.05, 16, ax(wh[0]), wh[1] + 0.3, wh[2]); gb.cyl('brass', 0.05, 0.05, 0.14, 8, ax(wh[0]), wh[1] + 0.02, wh[2]);
  gb.cyl('black', 0.24, 0.28, 0.24, 18, ax(18.3), fbTop - 0.03, -0.05);              // steam turret
  { const tg = [19.2, FB.cy + Math.sqrt(FB.r * FB.r - 0.9 * 0.9), -0.9]; gb.cylX('black', 0.17, 0.17, 0.58, 16, ax(tg[0]), tg[1] + 0.12, tg[2]); gb.box('black', 0.5, 0.18, 0.3, ax(tg[0]), tg[1] - 0.03, tg[2] + 0.04); }   // turbo-generator
  gb.cyl('black', 0.2, 0.24, 0.24, 18, ax(6.9), BBOIL.top(6.9) + 0.06, 0); gb.cyl('dark', 0.13, 0.13, 0.1, 14, ax(6.9), BBOIL.top(6.9) + 0.21, 0);   // top check

  /* ---- smokebox front: headlight with number boards, bell, class lamps, air pumps ---- */
  const numMat = decalMat(128, 64, (g, w, h) => { g.fillStyle = '#f2efe4'; g.fillRect(0, 0, w, h); g.fillStyle = '#121212'; g.font = 'bold 44px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(spec.num, w / 2, h / 2 + 2); });
  RMAT['num' + key] = numMat;
  const hl = { y: yB + 0.68, R: 0.29, D: 0.5 };
  hl.aF = door.a - 0.04 - hl.D;
  {
    const aF = hl.aF, R = hl.R, D = hl.D, aB = aF + D, x0 = ax(aB);
    const prof = [[0, 0], [0.012, R * 0.5], [0.04, R * 0.8], [0.09, R * 0.95], [0.15, R], [D - 0.06, R], [D - 0.06, R + 0.022], [D - 0.014, R + 0.022], [D, R - 0.012], [D, R - 0.05], [D - 0.04, R - 0.055]];
    gb.add('black', new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[1], p[0])), 36).rotateZ(-Math.PI / 2).translate(x0, hl.y, 0));
    gb.add('black', new THREE.TorusGeometry(R - 0.028, 0.018, 8, 36).rotateY(Math.PI / 2).translate(ax(aF + 0.01), hl.y, 0));
    { const s = new THREE.Shape(), r0 = R + 0.005, r1 = R + 0.03, t0 = 0.3, t1 = Math.PI - 0.3;
      s.absarc(0, 0, r1, t0, t1, false); s.lineTo(r0 * Math.cos(t1), r0 * Math.sin(t1)); s.absarc(0, 0, r0, t1, t0, true); s.lineTo(r1 * Math.cos(t0), r1 * Math.sin(t0));
      gb.add('black', new THREE.ExtrudeGeometry(s, { depth: 0.13, bevelEnabled: false, curveSegments: 16 }).rotateY(Math.PI / 2).translate(ax(aF + 0.06), hl.y, 0)); }
    gb.box('black', 0.3, 0.3, 0.3, ax(door.a - 0.08), hl.y - 0.12, 0);              // bracket onto the door
    // number boards either side of the lamp, set into the bracket and facing ahead
    for (const s of [-1, 1]) { const zc = s * (R + 0.3); gb.box('black', 0.16, 0.26, 0.5, ax(aF + 0.2), hl.y - 0.02, zc); gb.add('num' + key, new THREE.PlaneGeometry(0.44, 0.2), M(ax(aF + 0.12) + 0.002, hl.y - 0.02, zc, 0, Math.PI / 2, 0)); gb.box('black', 0.3, 0.06, 0.12, ax(aF + 0.38), hl.y - 0.02, s * (R + 0.04)); }
  }
  hl.lensA = hl.aF + 0.035; hl.r = hl.R - 0.05;
  // bell on a bracket out of the door below the lamp, hung clear of the door's dish
  let bellR;
  { const bx = ax(door.a - 0.36), by = yB - 0.42;
    for (const z of [-0.3, 0.3]) gb.box('black', 0.06, 0.38, 0.05, bx, by + 0.2, z);
    gb.cylZ('dark', 0.025, 0.62, 8, bx, by + 0.22, 0);
    gb.box('black', 0.08, 0.06, 0.66, bx, by + 0.4, 0);
    gb.box('black', 0.42, 0.08, 0.12, ax(door.a - 0.16), by + 0.42, 0);
    bellR = bellRig(body, bx, by + 0.22, 1, 0.3); }
  // class lamps at the top corners of the smokebox front
  const cls = clsLampSet();
  for (const z of [-0.86, 0.86]) {
    const y = yB + 0.8, xf = ax(BBOIL.sb[0] - 0.23);
    gb.box('black', 0.2, 0.24, 0.2, ax(BBOIL.sb[0] - 0.13), y, z); gb.box('black', 0.06, 0.06, 0.2, ax(BBOIL.sb[0] - 0.02), y - 0.06, z * 0.9);
    clsLens(cls, body, 0.06, xf + 0.003, y, z, Math.PI / 2, 0.55, [xf - 0.1, y, z]);
  }
  // two cross-compound air pumps hung on the smokebox front either side of the door, clear above the front engine's deck
  const pump = (x, y0, z) => {
    gb.cyl('black', 0.2, 0.2, 0.6, 18, x, y0 + 0.3, z); gb.cyl('black', 0.25, 0.25, 0.52, 18, x, y0 + 0.86, z);
    gb.cyl('graphite', 0.23, 0.23, 0.06, 18, x, y0 + 1.15, z); gb.box('dark', 0.38, 0.08, 0.38, x, y0 + 0.6, z);
    gb.box('dark', ax(BBOIL.sb[0]) - x + 0.02, 0.14, 0.14, (ax(BBOIL.sb[0]) + x) / 2, y0 + 0.9, z);   // strap back to the smokebox front
  };
  const pumpZ = 1.0, pumpY = 1.62, pumpX = ax(1.64);
  for (const s of [-1, 1]) pump(pumpX, pumpY, s * pumpZ);
  for (const s of [-1, 1]) gb.box('dark', ax(BBOIL.sb[0]) - pumpX + 0.3, 0.06, 0.5, (ax(BBOIL.sb[0]) + pumpX + 0.3) / 2, pumpY - 0.03, s * pumpZ);   // their shelf

  /* ---- running boards, brackets, handrails, reservoirs, pipes ---- */
  for (const s of [-1, 1]) {
    const w = RB.zo - RB.zi, z = s * (RB.zi + w / 2);
    const fa = BBOIL.fb[0], zf = BBOIL.half(fa + 0.5, RB.y) + 0.01, wf = RB.zo - zf;   // over the firebox the boards narrow to clear its wrapper
    gb.box('black', fa - RB.a0 + 0.02, RB.t, w, ax((RB.a0 + fa) / 2), RB.y - RB.t / 2, z);
    gb.box('black', C.a0 - fa + 0.02, RB.t, wf, ax((fa + C.a0) / 2), RB.y - RB.t / 2, s * (zf + wf / 2));
    gb.box('rbEdge', C.a0 - RB.a0, 0.16, 0.03, ax((RB.a0 + C.a0) / 2), RB.y - 0.08, s * (RB.zo + 0.015));
    for (let a = RB.a0 + 0.35; a < C.a0 - 0.2; a += 1.5) { const zs = BBOIL.half(a, RB.y - 0.14) - 0.03; gb.box('dark', 0.08, 0.14, RB.zo - zs - 0.04, ax(a), RB.y - RB.t - 0.07, s * (zs + (RB.zo - zs - 0.04) / 2)); }
    gb.box('black', 0.05, RB.y - 1.5, w, ax(RB.a0), (RB.y + 1.5) / 2 - 0.02, z);                     // front end of the board, down to a step
    for (const y of [1.55, 2.1]) gb.box('dark', 0.3, 0.035, w - 0.04, ax(RB.a0 - 0.12), y, z);
    const hy = 3.95;
    bar('rod', 0.018, [ax(2.3), hy, s * (BBOIL.half(2.3, hy) + 0.08)], [ax(C.a0 - 0.1), hy, s * (BBOIL.half(2.3, hy) + 0.08)], 6);
    for (let a = 2.5; a < C.a0 - 0.1; a += 1.5) { const zs = BBOIL.half(a, hy) - 0.02; bar('rod', 0.013, [ax(a), hy, s * zs], [ax(a), hy, s * (BBOIL.half(2.3, hy) + 0.09)], 5); }
    for (const y of [1.1, 1.65]) gb.box('dark', 0.5, 0.04, 0.32, ax(C.a0 + 0.55), y, s * 1.47);       // cab steps
    for (const d of [-0.24, 0.24]) gb.box('dark', 0.04, C.bottom - 1.08, 0.32, ax(C.a0 + 0.55) + d, (C.bottom + 1.08) / 2, s * 1.47);
  }
  // air reservoirs under the boards behind the rear gear, hung on straps
  for (const s of [1]) {
    const a0 = 9.4, a1 = 12.2, r = 0.27, y = RB.y - RB.t - 0.04 - r, z = s * 1.38;
    gb.cylX('black', r, r, a1 - a0, 20, ax((a0 + a1) / 2), y, z);
    const yb = RB.y - RB.t, ys = y + Math.sqrt(r * r - 0.14 * 0.14) - 0.01;
    for (const a of [a0 + 0.3, a1 - 0.3]) { gb.add('dark', new THREE.TorusGeometry(r + 0.012, 0.016, 6, 20, Math.PI).rotateY(Math.PI / 2).rotateX(Math.PI).translate(ax(a), y, z)); for (const d of [-0.14, 0.14]) gb.box('dark', 0.05, yb - ys, 0.06, ax(a), (yb + ys) / 2, z + d); }
  }
  // sand pipes off the dome to the rear drivers, down the boiler side
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const xd = ax(BB.aDr[i]), as = 9.9, xs = ax(as), y0 = BBOIL.top(as) - 0.1, z0 = BBOIL.half(as, y0) - 0.03;
    const y2 = RB.y + 0.2, z2 = BBOIL.half(as, y2) + 0.03;
    gb.tube('dark', [[xs, y0, s * z0], [xs - 0.05, BBOIL.bY(as), s * (BBOIL.half(as, BBOIL.bY(as)) + 0.03)], [xs - 0.1, y2, s * z2], [lerp(xs, xd + 1.0, 0.6), RB.y - 0.3, s * 1.12], [xd + 1.0, 1.7, s * 1.08], [xd + 0.95, 0.45, s * 0.82], [xd + 0.88, 0.16, s * 0.76]], 0.024, 48, 5);
  }
  // injector and feed lines, engineer's side; Worthington feedwater pump on the fireman's side
  gb.cylX('brass', 0.1, 0.1, 0.4, 10, ax(C.a0 - 0.6), 1.85, 1.44);
  const feed = (s, a0, y0) => { const z = a => s * (BBOIL.half(a, 2.95) + 0.06);
    gb.tube('dark', [[ax(a0), y0, s * 1.44], [ax(a0 - 0.3), 2.95, s * 1.48], [ax(16.0), 2.95, z(16.0)], [ax(12.0), 2.95, z(12.0)], [ax(7.3), 2.98, z(7.3)], [ax(6.95), 3.7, s * (BBOIL.half(6.95, 3.7) + 0.03)], [ax(6.9), 4.45, s * 0.36]], 0.05, 64, 6); };
  feed(1, C.a0 - 0.6, 1.85);
  gb.cyl('black', 0.22, 0.22, 0.9, 16, ax(11.0), 2.1, -1.36); gb.cyl('dark', 0.26, 0.26, 0.08, 16, ax(11.0), 2.58, -1.36); gb.cyl('dark', 0.26, 0.26, 0.08, 16, ax(11.0), 1.62, -1.36);
  gb.box('dark', 0.14, RB.y - RB.t - 2.62, 0.14, ax(11.0), (RB.y - RB.t + 2.62) / 2, -1.36);
  gb.tube('dark', [[ax(11.0), 2.55, -1.36], [ax(10.6), 2.95, -(BBOIL.half(10.6, 2.95) + 0.06)], [ax(7.3), 2.98, -(BBOIL.half(7.3, 2.98) + 0.06)], [ax(6.95), 3.7, -(BBOIL.half(6.95, 3.7) + 0.03)], [ax(6.9), 4.45, -0.36]], 0.05, 48, 6);
  // power reverse, engineer's side, with reach rods to both engines' reverse shafts
  gb.cylX('black', 0.17, 0.17, 1.1, 16, ax(21.4), 2.35, 1.38);
  gb.box('dark', 0.14, RB.y - RB.t - 2.35, 0.14, ax(21.4), (RB.y - RB.t + 2.35) / 2, 1.38);
  bar('black', 0.024, [ax(20.85), 2.35, 1.38], [ax(BBW.r.aLink + 0.3), 2.1, 1.38], 6);

  /* ---- cab ---- */
  let cab;
  {
    const x0 = C.x0, x1 = C.x1, hw = C.hw, L = x0 - x1, aRoof1 = 26.2, fl = C.fl;
    for (const s of [-1, 1]) {
      const sh = new THREE.Shape();
      sh.moveTo(x1, C.bottom); sh.lineTo(x0, C.bottom); sh.lineTo(x0, C.roofY); sh.lineTo(ax(26.0), C.roofY);
      sh.quadraticCurveTo(x1 - 0.05, C.roofY - 0.05, x1, C.roofY - 0.62); sh.lineTo(x1, C.bottom);
      const w = C.side, mid = (w.a0 + w.a1) / 2;
      for (const [a0, a1] of [[w.a0, mid - 0.04], [mid + 0.04, w.a1]]) { const h = new THREE.Path(); h.moveTo(ax(a1), w.y0); h.lineTo(ax(a0), w.y0); h.lineTo(ax(a0), w.y1); h.lineTo(ax(a1), w.y1); h.closePath(); sh.holes.push(h); }
      gb.add('black', new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false, curveSegments: 12 }).translate(0, 0, s * hw - 0.025));
      for (const [a0, a1] of [[w.a0, mid - 0.04], [mid + 0.04, w.a1]]) {
        const am = (a0 + a1) / 2, wa = a1 - a0, hy = w.y1 - w.y0, ym = (w.y0 + w.y1) / 2;
        gb.box('winGlass', wa, hy, 0.012, ax(am), ym, s * (hw - 0.03));
        gb.box('black', 0.04, hy, 0.03, ax(am), ym, s * (hw - 0.012)); gb.box('black', wa, 0.04, 0.03, ax(am), ym, s * (hw - 0.012));
      }
      gb.box('black', w.a1 - w.a0 + 0.14, 0.04, 0.06, ax((w.a0 + w.a1) / 2), w.y1 + 0.05, s * (hw + 0.03));
      gb.box('black', w.a1 - w.a0 + 0.1, 0.05, 0.10, ax((w.a0 + w.a1) / 2), w.y0 - 0.03, s * (hw + 0.05));
      gb.box('dark', 0.05, 0.05, 0.08, ax(w.a0 + 0.1), w.y0 - 0.03, s * (hw + 0.03)); gb.box('dark', 0.05, 0.05, 0.08, ax(w.a1 - 0.1), w.y0 - 0.03, s * (hw + 0.03));
      bar('rod', 0.014, [ax(C.a1 - 0.08), C.bottom + 0.15, s * (hw + 0.06)], [ax(C.a1 - 0.08), C.roofY - 0.8, s * (hw + 0.06)], 6);
      for (const y of [C.bottom + 0.15, C.roofY - 0.8]) gb.box('dark', 0.04, 0.04, 0.07, ax(C.a1 - 0.08), y, s * (hw + 0.03));
    }
    {
      const sh = new THREE.Shape(); sh.moveTo(-hw, fl); sh.lineTo(hw, fl); sh.lineTo(hw, C.roofY);
      for (let i = 1; i < 16; i++) { const z = hw - i / 16 * 2 * hw; sh.lineTo(z, C.arch(z) - 0.01); }
      sh.lineTo(-hw, C.roofY); sh.lineTo(-hw, fl);
      const yb = fl + 0.03, hole = new THREE.Path(), pad = 0.012;
      hole.moveTo(-C.fbHalf(yb) - pad, yb); hole.lineTo(C.fbHalf(yb) + pad, yb); hole.lineTo(FB.r + pad, FB.cy); hole.absarc(0, FB.cy, FB.r + pad, 0, Math.PI, false); hole.lineTo(-C.fbHalf(yb) - pad, yb);
      sh.holes.push(hole);
      const fw = C.front;
      for (const s of [-1, 1]) { const h = new THREE.Path(), lo = Math.min(s * fw.zi, s * fw.zo), hi = Math.max(s * fw.zi, s * fw.zo); h.moveTo(lo, fw.y0); h.lineTo(lo, fw.y1); h.lineTo(hi, fw.y1); h.lineTo(hi, fw.y0); h.lineTo(lo, fw.y0); sh.holes.push(h); }
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false, curveSegments: 24 });
      g.rotateY(Math.PI / 2); g.translate(x0 - 0.025, 0, 0); gb.add('black', g);
      for (const s of [-1, 1]) gb.box('winGlass', 0.012, fw.y1 - fw.y0, fw.zo - fw.zi, x0 - 0.01, (fw.y0 + fw.y1) / 2, s * (fw.zi + fw.zo) / 2);
      gb.box('black', 0.08, 0.05, 2 * hw, x0 + 0.03, fl + 0.02, 0);
    }
    {
      const rs = new THREE.Shape(), o = 0.07, n = 20;
      rs.moveTo(-hw - o, C.roofY - 0.02);
      for (let i = 0; i <= n; i++) { const z = -hw - o + i / n * 2 * (hw + o); rs.lineTo(z, C.arch(clamp(z, -hw, hw))); }
      for (let i = n; i >= 0; i--) { const z = -hw - o + i / n * 2 * (hw + o); rs.lineTo(z, C.arch(clamp(z, -hw, hw)) - C.roofT); }
      const rg = new THREE.ExtrudeGeometry(rs, { depth: aRoof1 - C.a0 + 0.1, bevelEnabled: false });
      rg.rotateY(Math.PI / 2); rg.translate(ax(aRoof1), 0, 0); gb.add('roof', rg);
      for (const s of [-1, 1]) gb.box('black', aRoof1 - C.a0 + 0.1, 0.06, 0.05, ax((aRoof1 + C.a0 - 0.1) / 2), C.roofY - 0.03, s * (hw + 0.05));
      gb.box('roof', 0.05, 0.25, 2 * hw + 0.1, ax(aRoof1) + 0.025, C.roofY - 0.1, 0);
      if (trim) {
        const pts = []; for (let i = 0; i <= 24; i++) { const z = -hw + i / 24 * 2 * hw; pts.push([z, C.arch(z)]); }
        gb.add('snow', snowCap(pts, 0.05, aRoof1 - C.a0 - 0.12, 0.35).translate(ax(aRoof1 - 0.06), 0, 0));
      }
    }
    gb.box('dark', L + 0.05, 0.08, 2 * hw - 0.02, x1 + (L + 0.05) / 2, fl - 0.04, 0);
    gb.box('dark', 0.48, 0.02, 1.5, x1 - 0.24 + 0.01, fl + 0.01, 0);
    for (const s of [-1, 1]) gb.box('dark', L, C.bottom - 1.73, 0.12, x1 + L / 2, (C.bottom + 1.73) / 2, s * 0.9);
    const cabNum = decalMat(256, 128, (g, w, h) => romanText(g, spec.num, w / 2, h / 2 + 4, 104, '#ebe8dd', 0.02));
    RMAT['cab' + key] = cabNum;
    for (const s of [-1, 1]) gb.add('cab' + key, new THREE.PlaneGeometry(1.1, 0.55), M(ax(23.8), 2.62, s * (hw + 0.026), 0, s > 0 ? 0 : Math.PI, 0));
    cab = steamCab(gb, body, { x0: C.x0, x1: C.x1, fl: C.fl, floor: C.fl, hw: C.hw, bh: C.bh, FB: C.FB, ceil: C.ceil, fwin: C.front, side: C.side, eyeY: 3.92 });
  }
  /* ---- trailing truck: cast frame outside the wheels, pivoted ahead of the firebox ---- */
  for (const s of [-1, 1]) {
    const z = s * 1.02, [t0, t1] = BB.aT;
    gb.box('dark', t1 - t0 + 0.9, 0.3, 0.15, ax((t0 + t1) / 2), 0.9, z);
    for (const a of BB.aT) { gb.box('dark', 0.36, 0.48, 0.26, ax(a), BB.rT, z); gb.box('dark', 0.24, 0.3, 0.03, ax(a), BB.rT, s * 1.17); }
    gb.box('dark', 0.14, 0.3, 0.17, ax((t0 + t1) / 2), 1.18, z);
    for (let k = 0; k < 6; k++) gb.box('dark', 1.6 - 0.22 * k, 0.026, 0.12, ax((t0 + t1) / 2), 1.27 - 0.028 * k, z);
    bar('dark', 0.07, [ax(t0 - 0.4), 1.0, z], [ax(21.6), 1.3, s * 0.4], 8);
    for (const a of BB.aT) gb.box('dark', 0.08, 0.3, 0.13, ax(a - BB.rT - 0.04), BB.rT, s * 0.76);
  }
  for (const a of BB.aT) bar('dark', 0.03, [ax(a - BB.rT - 0.04), BB.rT, -1.0], [ax(a - BB.rT - 0.04), BB.rT, 1.0], 6);   // brake beams out to the side frames
  gb.box('dark', 0.3, 0.3, 2.1, ax(BB.aT[0] - 0.45), 1.0, 0);
  gb.box('dark', 0.3, 0.3, 2.1, ax(BB.aT[1] + 0.55), 1.1, 0);
  gb.box('dark', 0.5, 0.36, 0.9, ax(21.6), 1.4, 0);
  for (const s of [-1, 1]) gb.box('dark', 0.4, (C.bottom - 0.1) - 1.25, 0.2, ax(BB.aT[1] + 0.55), ((C.bottom - 0.1) + 1.25) / 2, s * 0.9);
  gb.box('dark', 0.6, 0.3, 1.2, ax(BB.len - 0.2), 1.0, 0);                          // drawbar pocket
  gb.box('dark', 0.2, 0.9, 2.0, ax(BB.len - 0.1), 1.6, 0);                          // rear buffer beam under the deck

  body.add(gb.build({ ...RMAT }));
  front.add(gf.build({ ...RMAT }));

  /* ---- glows & lights ---- */
  const lens = new THREE.Mesh(new THREE.CircleGeometry(hl.r, 36), RMAT.hlLens || RMAT.lens); lens.position.set(ax(hl.lensA) + 0.004, hl.y, 0); lens.rotation.y = Math.PI / 2; body.add(lens);
  const fire = new THREE.Mesh(new THREE.PlaneGeometry(...cab.fireSize), RMAT.glow.clone()); fire.position.copy(cab.firePos); fire.rotation.y = -Math.PI / 2; body.add(fire);
  const beam = headBeam(ax(hl.lensA), hl.y, -0.04); body.add(beam);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  halo.position.set(ax(hl.lensA) + 0.06, hl.y, 0); halo.scale.set(2.6, 2.6, 1); body.add(halo);
  const ash = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.0), new THREE.MeshBasicMaterial({ color: 0xff5a1a, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending }));
  ash.rotation.x = Math.PI / 2; ash.position.set(ax(21.0), FB.base - 0.35, 0); body.add(ash);

  /* ---- moving parts ---- */
  const centre = spec.wheels === 'boxpok' ? boxpokCentre : spokedCentre;
  const mainG = driverAxle(BB.rD, true, centre), sideG = driverAxle(BB.rD, false, centre);
  const wallG = R => mergeGeos([new THREE.RingGeometry(R - 0.062, R + 0.001, 36).translate(0, 0, RAIL_OFF + 0.0665), new THREE.RingGeometry(R - 0.062, R + 0.001, 36).rotateY(Math.PI).translate(0, 0, -(RAIL_OFF + 0.0665))]);
  const mk = (G, R) => { const grp = new THREE.Group(); for (const k of ['black', 'tire']) { const m = new THREE.Mesh(G[k], k === 'black' ? RMAT.black : RMAT.tire); m.castShadow = true; grp.add(m); } grp.add(new THREE.Mesh(wallG(R), RMAT.dWall)); return grp; };
  const engine = (parent, bx, W) => {
    const E = { drivers: [], rods: {}, bx, W };
    for (let i = 0; i < 4; i++) {
      const g = i === 2 ? mainG : sideG, grp = new THREE.Group(); grp.position.set(bx(W.aD[i]), BB.rD, 0);
      for (const k of ['black', 'tire', 'rod', 'wall']) { const m = new THREE.Mesh(g[k], k === 'black' ? RMAT.black : k === 'tire' ? RMAT.tire : k === 'wall' ? RMAT.dWall : RMAT.rod); m.castShadow = k !== 'wall'; m.receiveShadow = true; grp.add(m); }
      parent.add(grp); E.drivers.push(grp);
    }
    const R = RMAT.rod, add = m => { m.castShadow = true; parent.add(m); return m; };
    // the eccentric rod's length is set with the crank on the front centre
    const C3 = [bx(W.aD[2]), BB.rD], Lk = [bx(W.aLink), W.yLink];
    W.Lecc = Math.hypot(Lk[0] - C3[0], (Lk[1] - W.rl) - (BB.rD - W.e));
    for (const s of [-1, 1]) {
      E.rods[s] = {
        side: [0, 1, 2].map(i => add(new THREE.Mesh(rodGeo(W.aD[i + 1] - W.aD[i], 0.17, 0.17, 0.075, 0.135, 0.135), R))),
        main: add(new THREE.Mesh(rodGeo(BB.Lm, 0.27, 0.16, 0.09, 0.2, 0.13), R)),
        cross: (() => { const g = new GeoBin(); g.box('rod', 0.52, 0.3, 0.2, 0, 0, 0); g.box('dark', 0.12, 0.42, 0.1, 0.05, -0.32, 0); return add(g.build(RMAT)); })(),
        piston: add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.0, 10).rotateZ(Math.PI / 2).translate(1.0, 0, 0), R)),
        ecc: add(new THREE.Mesh(rodGeo(W.e, 0.12, 0.1, 0.06, 0.1, 0.07), R)),
        eccRod: add(new THREE.Mesh(rodGeo(W.Lecc, 0.1, 0.085, 0.05, 0.065, 0.06), R)),
        // the expansion link: a curved slotted casting hung on its trunnion, foot down to the eccentric rod
        link: (() => { const g = new GeoBin(); for (const dz of [-0.05, 0.05]) g.box('rod', 0.07, W.rl + 0.42, 0.025, 0, -(W.rl - 0.42) / 2, dz); g.box('rod', 0.12, 0.08, 0.13, 0, -W.rl, 0); g.cylZ('dark', 0.05, 0.16, 10, 0, 0, 0); return add(g.build(RMAT)); })(),
        rrod: add(new THREE.Mesh(rodGeo(W.Lrr, 0.08, 0.07, 0.045, 0.05, 0.05), R)),
        comb: add(new THREE.Mesh(new THREE.BoxGeometry(0.08, W.a + W.b + 0.1, 0.05).translate(0, -(W.a + W.b) / 2, 0), R)),
        union: add(new THREE.Mesh(rodGeo(W.Lu, 0.07, 0.07, 0.04, 0.045, 0.045), R)),
        vstem: (() => { const g = new GeoBin(); g.add('rod', new THREE.CylinderGeometry(0.035, 0.035, 1.0, 8).rotateZ(Math.PI / 2).translate(0.5, 0, 0)); g.box('rod', 0.18, 0.14, 0.3, 0, 0, s * 0.11); return add(g.build(RMAT)); })(),
        lifter: add(new THREE.Mesh(rodGeo(0.55, 0.06, 0.05, 0.03, 0.04, 0.04), RMAT.black)),
      };
    }
    return E;
  };
  const parts = { drivers: [], lead: null, trail: [], rods: {}, eng: { f: engine(front, bxF, BBW.f), r: engine(body, bxR, BBW.r) } };
  parts.drivers = [...parts.eng.f.drivers, ...parts.eng.r.drivers];
  // lead truck: equalized frame with journal boxes outside the two axles, swivelling under the front engine
  const leadTruck = new THREE.Group();
  { const lg = new GeoBin(), sp = (BB.aL[1] - BB.aL[0]) / 2, rL = BB.rL;
    for (const s of [-1, 1]) {
      lg.box('dark', 2 * sp + 0.6, 0.2, 0.14, 0, rL + 0.03, s * 0.98);             // kept low: the cylinders sit over the rear axle
      for (const x of [-sp, sp]) lg.box('dark', 0.34, 0.36, 0.24, x, rL, s * 0.98);
    }
    lg.box('dark', 0.4, 0.24, 2.1, 0, rL + 0.24, 0);
    lg.box('dark', 0.6, 0.12, 0.6, 0, rL + 0.42, 0);                              // centre bearing up under the front engine's cradle
    leadTruck.add(lg.build(RMAT));
    parts.lead = [];
    for (const x of [-sp, sp]) { const w = mk(plainAxle(rL, true, RAIL_OFF, AXJ), rL); w.position.set(x, rL, 0); leadTruck.add(w); parts.lead.push(w); } }
  // the cradle the truck's centre bearing rides under, on the front engine
  { const g2 = new GeoBin(), y0 = BB.rL + 0.48; g2.box('dark', 0.9, 1.36 - y0, 1.3, bxF(BB.leadA), (1.36 + y0) / 2, 0); front.add(g2.build(RMAT)); }
  for (const a of BB.aT) { const t = mk(plainAxle(BB.rT, true, RAIL_OFF, AXJ), BB.rT); t.position.set(ax(a), BB.rT, 0); body.add(t); parts.trail.push(t); }
  // tap hitboxes
  const hit = new THREE.Mesh(new THREE.BoxGeometry(BB.len - BB.aH, 4.9, 3.35), RMAT.hit); hit.position.set(ax((BB.len + BB.aH) / 2), 2.45, 0); body.add(hit);
  const hitF = new THREE.Mesh(new THREE.BoxGeometry(BB.aH, 2.4, 3.35), RMAT.hit); hitF.position.set(bxF(BB.aH / 2), 1.2, 0); front.add(hitF);
  for (const g of [root, front, leadTruck]) g.traverse(o => { if (o.isMesh) { o.castShadow = o.castShadow !== false && o.material !== RMAT.hit; o.receiveShadow = true; } });
  lens.castShadow = false; fire.castShadow = false; ash.castShadow = false;

  const L = { root, body, front, parts, leadTruck, lens, couplers: [coupler, null], fire, ash, beam, halo, spec, rL: BB.rL, art: true,
    len: BB.len, frame: [BB.aDr[0], BB.aDr[3]], leadA: BB.leadA, rD: BB.rD,
    stackPos: new THREE.Vector3(ax(stk.a), 5.0, 0), cockPos: [new THREE.Vector3(bxR((BBW.f.cyl[0] + BBW.f.cyl[1]) / 2), 0.4, 1.2), new THREE.Vector3(bxR((BBW.r.cyl[0] + BBW.r.cyl[1]) / 2), 0.4, -1.2)],
    safetyPos: new THREE.Vector3(ax(17.1), fbTop + 0.35, 0), whistlePos: new THREE.Vector3(ax(wh[0]), wh[1] + 0.55, wh[2]),
    pumpPos: new THREE.Vector3(pumpX, pumpY + 1.25, -pumpZ), injPos: new THREE.Vector3(ax(C.a0 - 0.5), 1.6, 1.47),
    cabEye: cab.eye, cab, headlightPos: new THREE.Vector3(ax(hl.lensA), hl.y, 0), bellRig: bellR, cls,
    fireLightPos: new THREE.Vector3(C.bh - 0.3, C.fl + 0.5, 0.1), cabLightPos: new THREE.Vector3(ax(23.9), 4.3, 0),
    extras: [front],
  };
  L.animate = (roll, theta, rev, odo) => animateBigBoy(L, roll, theta, rev, odo);
  return L;
}

/* Walschaerts gear for one side of one engine. phi: this side's crank angle. */
function bbGear(E, P, phi, rev, s) {
  const W = E.W, bx = E.bx, cr = BB.cr, rD = BB.rD, z = s;
  const pins = W.aD.map(a => [bx(a) + cr * Math.cos(phi), rD + cr * Math.sin(phi)]);
  for (let i = 0; i < 3; i++) { const a = pins[i + 1], b = pins[i]; P.side[i].position.set(a[0], a[1], z * 0.99); P.side[i].rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]); }
  const pin = pins[2], wy = BB.yC, wx = pin[0] + Math.sqrt(BB.Lm * BB.Lm - (wy - pin[1]) ** 2);
  P.main.position.set(pin[0], pin[1], z * 1.1); P.main.rotation.z = Math.atan2(wy - pin[1], wx - pin[0]);
  P.cross.position.set(wx, wy, z * BB.zC); P.piston.position.set(wx, wy, z * BB.zC);
  // return crank on the main pin, a quarter turn behind the crank
  const C3 = [bx(W.aD[2]), rD], Ec = [C3[0] + W.e * Math.cos(phi - Math.PI / 2), C3[1] + W.e * Math.sin(phi - Math.PI / 2)];
  P.ecc.position.set(pin[0], pin[1], z * 1.22); P.ecc.rotation.z = Math.atan2(Ec[1] - pin[1], Ec[0] - pin[0]);
  P.ecc.scale.x = Math.hypot(Ec[0] - pin[0], Ec[1] - pin[1]) / W.e;
  // the link swings on its trunnion; its foot is where the eccentric rod reaches
  const Lk = [bx(W.aLink), W.yLink], F = circLow(Lk[0], Lk[1], W.rl, Ec[0], Ec[1], W.Lecc);
  P.eccRod.position.set(Ec[0], Ec[1], z * 1.27); P.eccRod.rotation.z = Math.atan2(F[1] - Ec[1], F[0] - Ec[0]);
  const ux = (Lk[0] - F[0]) / W.rl, uy = (Lk[1] - F[1]) / W.rl;                       // up the link
  P.link.position.set(Lk[0], Lk[1], z * 1.36); P.link.rotation.z = Math.atan2(-ux, uy);
  // the die block rides up the link for forward gear, down for back; the radius rod runs forward to the combination lever
  const d = -rev * W.dMax, D = [Lk[0] + ux * d, Lk[1] + uy * d];
  const Cx = D[0] + Math.sqrt(Math.max(0, W.Lrr * W.Lrr - (W.yR - D[1]) ** 2)), Cy = W.yR;
  P.rrod.position.set(D[0], D[1], z * 1.36); P.rrod.rotation.z = Math.atan2(Cy - D[1], Cx - D[0]);
  P.lifter.position.set(D[0] + 0.05, D[1] + 0.05, z * 1.42); P.lifter.rotation.z = Math.PI / 2 - 0.15;
  const By = BB.yV - W.a - W.b, Ux = wx + 0.1, Uy = By - 0.02, Bx = Ux + W.Lu;
  P.union.position.set(Ux, Uy, z * 1.36); P.union.rotation.z = Math.atan2(By - Uy, Bx - Ux);
  const Tvx = Cx + (Cx - Bx) * (W.a / W.b), Tvy = BB.yV;
  P.comb.position.set(Tvx, Tvy, z * 1.36); P.comb.rotation.z = Math.atan2(Bx - Tvx, -(By - Tvy));
  P.vstem.position.set(Tvx, Tvy, z * BB.zV);
}
/* wheels and gear for both engines. The front engine runs a little out of step with the rear (bbDrift). */
function animateBigBoy(L, roll, theta, rev, odo = 0) {
  const p = L.parts;
  for (const w of p.lead) w.rotation.z = -roll / BB.rL;
  for (const w of p.trail) w.rotation.z = -roll / BB.rT;
  for (const [E, th] of [[p.eng.r, theta], [p.eng.f, theta + bbDrift(odo)]]) {
    for (const d of E.drivers) d.rotation.z = th;
    for (const s of [-1, 1]) bbGear(E, E.rods[s], th + (s > 0 ? 0 : Math.PI / 2), rev, s);
  }
}

/* place the front engine: hinged to the main frame at BB.aH, its middle on the rails (v.artPt), so it swings out
   from under the boiler on a curve. Off the rails it goes with the wreck (v.rb.f0 is where it was). */
const _afH = new THREE.Vector3(), _afX = new THREE.Vector3(), _afU = new THREE.Vector3(), _afR = new THREE.Vector3();
function artFront(v, L, D) {
  const g = L.front; g.matrixAutoUpdate = false;
  if (D && v.rb.f0) { g.matrix.multiplyMatrices(D, v.rb.f0); g.matrixWorldNeedsUpdate = true; return; }
  const F = v.artPt.F;
  _afH.set(bxR(BB.aH), 0, 0).applyMatrix4(v.root.matrix);
  _afX.subVectors(F.p, _afH).normalize();
  _afR.crossVectors(_afX, F.u).normalize(); _afU.crossVectors(_afR, _afX).normalize();
  g.matrix.makeBasis(_afX, _afU, _afR).setPosition(_afH.addScaledVector(_afX, -bxF(BB.aH)));
  g.matrixWorldNeedsUpdate = true;
}
/* how far the front engine stands out from under the boiler at the pilot, metres (for the tests and the camera) */
function artSwing(L) {
  const p = new THREE.Vector3(bxF(0.5), 0, 0).applyMatrix4(L.front.matrix), q = new THREE.Vector3(bxR(0.5), 0, 0).applyMatrix4(L.root.matrix);
  return p.distanceTo(q);
}

/* ===================== the centipede tender ===================== */
/* t = metres back from the tender's front (its drawbar). A four-wheel truck under the front, five axles in the cast
   frame behind it, 42 in wheels throughout. 14.48 m long, so engine and tender make 132 ft 9 in. */
const BBT = { len: 14.48, truckA: [1.60, 3.43], rigid: [5.53, 7.21, 8.89, 10.57, 12.25], R: 0.533, hw: 1.62,
  t0: 0.62, t1: 13.95, yBot: 1.32, yTank: 3.98, yBunk: 4.62, bunk: [1.2, 6.9, 7.9], deck: 2.30 };
BBT.truck = (BBT.truckA[0] + BBT.truckA[1]) / 2;
BBT.ref = (BBT.truck + BBT.rigid[2]) / 2;
function buildBigBoyTender(key, trim = '') {
  const spec = LOCO_SPEC[key], D = BBT, tx = a => D.ref - a, hw = D.hw;
  const root = new THREE.Group(), gb = new GeoBin();
  const bar = (k, r, a, b, seg = 8) => gb.add(k, barGeo(r, a, b, seg));
  // cast frame: centre sill, side sills, pedestals and journal boxes for the five rigid axles
  gb.box('dark', D.t1 - 0.4, 0.3, 0.9, tx((0.4 + D.t1) / 2), D.yBot - 0.15, 0);
  for (const s of [-1, 1]) {
    gb.box('dark', D.t1 - D.t0, 0.2, 0.12, tx((D.t0 + D.t1) / 2), D.yBot - 0.1, s * (hw - 0.08));
    gb.box('dark', D.rigid[4] - D.rigid[0] + 0.8, 0.26, 0.14, tx((D.rigid[0] + D.rigid[4]) / 2), 1.02, s * 1.0);   // side frame over the boxes
    for (const a of D.rigid) {
      gb.box('dark', 0.34, 0.42, 0.24, tx(a), D.R, s * 1.0);
      gb.box('dark', 0.24, 0.28, 0.03, tx(a), D.R, s * 1.13);
      for (const d of [-0.2, 0.2]) gb.box('dark', 0.06, 1.02 - D.R + 0.1, 0.16, tx(a) + d, (1.02 + D.R) / 2, s * 1.0);
      gb.box('dark', 0.08, 0.3, 0.12, tx(a - D.R - 0.04), D.R, s * 0.76);           // brake shoe
    }
    for (let i = 0; i < 4; i++) { const am = (D.rigid[i] + D.rigid[i + 1]) / 2; for (let k = 0; k < 4; k++) gb.box('dark', 0.9 - 0.15 * k, 0.025, 0.12, tx(am), 1.2 - 0.025 * k, s * 1.0); }
  }
  // cross bolsters from the side frames up under the tank, and brake beams across to the shoes
  for (let i = 0; i < 4; i++) gb.box('dark', 0.3, D.yBot - 1.12, 2.14, tx((D.rigid[i] + D.rigid[i + 1]) / 2 + 0.25), (D.yBot + 1.12) / 2, 0);
  for (const a of D.rigid) bar('dark', 0.03, [tx(a - D.R - 0.04), D.R, -0.8], [tx(a - D.R - 0.04), D.R, 0.8], 6);
  gb.box('dark', 0.7, D.yBot - 0.955, 2.4, tx(D.truck), (D.yBot + 0.955) / 2, 0);          // bolster down onto the front truck's centre plate
  gb.box('dark', 0.3, 0.4, 2.9, tx(D.t1 + 0.15), 1.08, 0);                               // rear end sill
  // tank and bunker sides from one profile
  const prof = new THREE.Shape();
  prof.moveTo(tx(D.t0), D.yBot); prof.lineTo(tx(D.t1), D.yBot); prof.lineTo(tx(D.t1), D.yTank); prof.lineTo(tx(D.bunk[2]), D.yTank);
  prof.lineTo(tx(D.bunk[1]), D.yBunk); prof.lineTo(tx(D.bunk[0]), D.yBunk);
  prof.quadraticCurveTo(tx(D.t0 + 0.1), D.yBunk - 0.05, tx(D.t0), D.yTank - 0.02); prof.lineTo(tx(D.t0), D.yBot);
  const side = typeof tenderSideMat === 'function' && RMAT.tSide ? 'tSide' : 'black';
  for (const s of [-1, 1]) gb.add(side, new THREE.ExtrudeGeometry(prof, { depth: 0.04, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, s * (hw - 0.02) - 0.02));
  gb.box('black', D.t1 - D.t0, 0.04, 2 * hw - 0.04, tx((D.t0 + D.t1) / 2), D.yBot + 0.02, 0);
  gb.box('black', 0.04, D.yTank - D.yBot, 2 * hw, tx(D.t1) - 0.02, (D.yTank + D.yBot) / 2, 0);
  gb.box('black', D.t1 - D.bunk[2] + 0.02, 0.04, 2 * hw, tx((D.bunk[2] + D.t1) / 2), D.yTank - 0.02, 0);
  { const a = [tx(D.bunk[2]), D.yTank], b = [tx(D.bunk[1]), D.yBunk], L = Math.hypot(a[0] - b[0], a[1] - b[1]); gb.add('black', new THREE.BoxGeometry(L, 0.04, 2 * hw - 0.04), M((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.02, 0, 0, 0, Math.atan2(b[1] - a[1], b[0] - a[0]))); }
  gb.box('black', 0.04, D.deck - D.yBot, 2 * hw, tx(D.t0) + 0.02, (D.deck + D.yBot) / 2, 0);
  gb.box('dark', D.t0 + 0.3 - 0.25, 0.06, 2 * hw - 0.1, tx((0.25 + D.t0 + 0.3) / 2), D.deck - 0.03, 0);
  gb.box('dark', 0.25, D.deck - 0.03 - 1.0, 1.2, tx(0.38), (D.deck - 0.03 + 1.0) / 2, 0);
  { const bt = D.t0 + 0.3;
    gb.box('black', 0.05, D.yTank - D.deck, 2 * hw - 0.04, tx(bt), (D.yTank + D.deck) / 2, 0);
    gb.box('dark', 0.03, 0.75, 0.8, tx(bt) + 0.03, D.deck + 0.42, 0);
    for (const z of [-0.43, 0.43]) gb.box('black', 0.06, 0.8, 0.05, tx(bt) + 0.035, D.deck + 0.42, z); }
  // coal heaped in the bunker
  {
    const a0 = D.t0 + 0.34, a1 = D.bunk[2] - 0.2, La = a1 - a0, Wd = 2 * hw - 0.1;
    const g = new THREE.PlaneGeometry(La, Wd, 28, 12); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, r = rng(4014);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), u = 1 - (x / (La / 2)) ** 2, v = 1 - (z / (Wd / 2)) ** 2, h = Math.max(0, u) ** 0.5 * Math.max(0, v) ** 0.6;
      const t = a0 + La / 2 - x, wallTop = t > D.bunk[1] ? lerp(D.yBunk, D.yTank, (t - D.bunk[1]) / (D.bunk[2] - D.bunk[1])) : D.yBunk;
      p.setY(i, Math.min(wallTop - 0.25, D.yTank - 0.1) + h * 0.6 + h * (r() - 0.5) * 0.08);
    }
    g.computeVertexNormals(); g.translate(tx(a0 + La / 2), 0, 0); gb.add('coal', g);
  }
  // water hatches, back-up light, ladders, grab irons, steps
  for (const a of [10.2, 12.4]) { gb.cyl('black', 0.42, 0.42, 0.22, 20, tx(a), D.yTank + 0.09, 0); gb.cyl('black', 0.47, 0.47, 0.05, 20, tx(a), D.yTank + 0.22, 0); }
  gb.box('black', 0.5, 0.45, 0.5, tx(D.t1 - 0.3), D.yTank + 0.225, 0);
  const bl = new THREE.Mesh(new THREE.CircleGeometry(0.15, 18), RMAT.lensOff); bl.position.set(tx(D.t1 - 0.05) - 0.003, D.yTank + 0.24, 0); bl.rotation.y = -Math.PI / 2;
  for (const s of [-1, 1]) {
    const xr = tx(D.t1) - 0.07;
    for (let y = D.yBot + 0.25; y < D.yTank; y += 0.36) gb.box('rod', 0.03, 0.03, 0.42, xr, y, s * 1.3);
    for (const z of [1.08, 1.52]) { gb.box('dark', 0.04, D.yTank + 0.3 - 1.1, 0.04, xr, (D.yTank + 0.3 + 1.1) / 2, s * z); for (const y of [1.5, D.yTank - 0.1]) gb.box('dark', 0.07, 0.04, 0.04, xr + 0.035, y, s * z); }
    bar('dark', 0.016, [tx(D.t0) + 0.02, D.deck - 0.3, s * (hw + 0.045)], [tx(D.t0) + 0.02, D.yTank - 0.2, s * (hw + 0.045)], 6);
    for (const y of [D.deck - 0.3, D.yTank - 0.2]) gb.box('dark', 0.04, 0.04, 0.06, tx(D.t0) + 0.02, y, s * (hw + 0.03));
    const steps = (a, ys) => { for (const y of ys) gb.box('dark', 0.45, 0.04, 0.3, tx(a), y, s * 1.47); for (const d of [-0.2, 0.2]) gb.box('dark', 0.04, D.yBot - 0.1 - ys[0] + 0.03, 0.3, tx(a) + d, (ys[0] - 0.03 + D.yBot - 0.1) / 2, s * 1.47); };
    steps(D.t0 + 0.3, [0.75, 1.15]); steps(D.t1 - 0.25, [0.75]);
    gb.box('blackMatte', D.t1 - D.t0, 0.025, 0.006, tx((D.t0 + D.t1) / 2), D.yBot + 0.06, s * (hw + 0.002));
  }
  const coupler = addCoupler(gb, root, { x: tx(D.len), out: -1, sx: tx(D.t1 + 0.3) - tx(D.len), sb: 0.88, ly: 1.12, zh: 1.3, yp: 0.86, housing: true, hl: 0.3 });
  const road = decalMat(1024, 128, (g, w, h) => { g.font = '600 88px "Arial Narrow", Arial, sans-serif'; g.fillStyle = '#ecE9de'; g.textAlign = 'center'; g.textBaseline = 'middle'; if (g.letterSpacing !== undefined) g.letterSpacing = '10px'; g.fillText(spec.road, w / 2, h / 2 + 4); });
  RMAT['road' + key] = road;
  for (const s of [-1, 1]) gb.add('road' + key, new THREE.PlaneGeometry(10.4, 1.3), M(tx(7.4), 2.75, s * (hw + 0.008), 0, s > 0 ? 0 : Math.PI, 0));
  root.add(gb.build(RMAT)); root.add(bl);
  // wheels: the rigid axles turn in the frame, the front truck swivels (placed by the train)
  const wheels = [], ax6 = plainAxle(D.R, true, RAIL_OFF, typeof AXJ !== 'undefined' ? AXJ : 0);
  const wheel = () => { const g = new THREE.Group(); for (const k of ['black', 'tire']) { const m = new THREE.Mesh(ax6[k], k === 'black' ? RMAT.black : RMAT.tire); m.castShadow = true; g.add(m); } return g; };
  for (const a of D.rigid) { const w = wheel(); w.position.set(tx(a), D.R, 0); root.add(w); wheels.push(w); }
  const truck = new THREE.Group(); truck.matrixAutoUpdate = false;
  { const tg = new GeoBin(), sp = (D.truckA[1] - D.truckA[0]) / 2;
    for (const s of [-1, 1]) {
      tg.box('dark', 2 * sp + 0.7, 0.24, 0.14, 0, D.R + 0.1, s * 1.0);
      for (const x of [-sp, sp]) { tg.box('dark', 0.34, 0.42, 0.24, x, D.R, s * 1.0); tg.box('dark', 0.08, 0.3, 0.12, x - D.R - 0.04, D.R, s * 0.76); }
      for (let k = 0; k < 4; k++) tg.box('dark', 1.0 - 0.15 * k, 0.025, 0.12, 0, D.R + 0.28 - 0.025 * k, s * 1.0);
    }
    tg.box('dark', 0.5, 0.26, 2.1, 0, D.R + 0.2, 0); tg.box('dark', 0.7, 0.1, 0.7, 0, D.R + 0.38, 0);
    truck.add(tg.build(RMAT));
    for (const x of [-sp, sp]) { const w = wheel(); w.position.set(x, D.R, 0); truck.add(w); wheels.push(w); } }
  root.traverse(o => { if (o.isMesh && !o.userData.cpl) { o.castShadow = true; o.receiveShadow = true; } });
  truck.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { root, len: D.len, ref0: D.ref, trucks: [], frame: [D.truck, D.rigid[2]], backup: bl, waterHatchA: 10.2, couplers: [null, coupler],
    truck, extras: [truck], swivelA: D.truck, wheels, spin: roll => { for (const w of wheels) w.rotation.z = -roll / D.R; } };
}

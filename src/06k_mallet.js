/* ============================================================================
   Chesapeake & Ohio class H-6 No. 1308: a 2-6-6-2 compound Mallet (Baldwin, 1949),
   the last class of steam locomotive Baldwin built for a United States railroad.
   Published figures: 99 ft 8 in over the couplers with its tender, engine
   wheelbase 48 ft 10 in, 56 in drivers in two groups of three at 60 in centres
   (10 ft rigid wheelbase each), 32 in stroke; high-pressure cylinders 22 in on
   the rear engine, low-pressure 35 in on the front; Walschaerts gear; 210 psi;
   434,900 lb engine, 366,700 lb on the drivers; 12,000 gal and 16 tons in a
   rectangular tender (class 12-RC) on four-wheel trucks.
   A true Mallet: the boiler's steam works the rear cylinders first, then goes
   forward through the receiver pipe under the boiler to the big low-pressure
   pair on the hinged front engine, and only those exhaust up the stack. Two
   cross-compound air pumps hang on the smokebox front, the headlight sits low on
   the pilot deck (on the front engine, so it swings with it).
   Lead and trailing wheel diameters and the pilot are not from a drawing.
   a = metres back from the front coupler face; local x on the main frame is
   ML.refR - a, on the front engine ML.refF - a (see 06h_bigboy.js).
   ========================================================================== */
Object.assign(LOCO_SPEC, {
  '1308': { road: 'CHESAPEAKE AND OHIO', num: '1308', short: 'C&O', cls: 'H-6 · 2-6-6-2', built: 'Baldwin, 1949', weight: 434900, adhesive: 366700, te: 77900, whistle: 'co3',
    art: true, mallet: true, wheels: 'spoked', psi: 210, rD: 0.7112, teK: 436, vcyl: 4 * Math.PI / 4 * 0.5588 * 0.5588 * 0.8128, boil: 0.85,
    water: 45425, coal: 14515, tenderEmpty: 34560, axles: 8 },
});
const ML = {
  len: 19.60, rD: 0.7112, rL: 0.381, rT: 0.533, cr: 0.4064, mi: 2,
  aL: 1.95, aDf: [4.60, 6.124, 7.648], aDr: [11.00, 12.524, 14.048], aT: 16.88,
  yC: 0.80, zC: 1.22, rLP: 0.455, rHP: 0.31, Lm: 2.80, yV: 1.58, zV: 1.17, aH: 8.72,
  yB: 3.02, hw: 1.52, yF: 1.05,
};
ML.refF = ML.aDf[1]; ML.refR = ML.aDr[1]; ML.leadA = ML.aL;
const mxR = a => ML.refR - a, mxF = a => ML.refF - a;
const MLW = (() => {
  const mk = (aD, front) => {
    const aX = aD[2] - ML.Lm;                            // crosshead at mid stroke
    return { aD, aX, cyl: front ? [aX - 2.36, aX - 1.20] : [aX - 2.30, aX - 1.10], cylR: front ? ML.rLP : ML.rHP, aLink: aX + 0.92, yLink: 1.58, rl: 0.42, dMax: 0.26, e: 0.21, Lrr: 1.50,
      yR: ML.yV + 0.13, a: 0.13, b: 1.04, Lu: 0.60, aS: aX + 1.22, yS: 2.01, rS: 0.66, Ll: 0.41, qL: 0.30 };
  };
  return { f: mk(ML.aDf, true), r: mk(ML.aDr, false) };
})();
const MLOIL = { sb: [2.30, 4.40, 1.10], c1: [4.40, 7.20, 1.12], cone: [7.20, 8.60], c3: [8.60, 13.30, 1.22], fb: [13.30, 16.85], yR: 3.06 };
MLOIL.bR = a => a < MLOIL.sb[1] ? MLOIL.sb[2] : a < MLOIL.cone[0] ? MLOIL.c1[2] : a < MLOIL.cone[1] ? lerp(MLOIL.c1[2], MLOIL.c3[2], (a - MLOIL.cone[0]) / (MLOIL.cone[1] - MLOIL.cone[0])) : MLOIL.c3[2];
MLOIL.bY = a => a < MLOIL.cone[0] ? ML.yB : a < MLOIL.cone[1] ? lerp(ML.yB, MLOIL.yR, (a - MLOIL.cone[0]) / (MLOIL.cone[1] - MLOIL.cone[0])) : MLOIL.yR;
const MLCAB = (() => {
  const C = { a0: 16.55, a1: 19.15, fl: 2.10, bottom: 2.00, roofY: 4.10, crown: 4.50, hw: ML.hw, roofT: 0.05, aBh: 16.85,
    FB: { cy: 3.06, r: 1.22, base: 1.72, wb: 1.28 },
    side: { a0: 16.95, a1: 18.75, y0: 2.85, y1: 3.60 },
    front: { y0: 3.55, y1: 3.98, zi: 1.17, zo: 1.46 } };
  C.x0 = mxR(C.a0); C.x1 = mxR(C.a1); C.bh = mxR(C.aBh);
  C.arch = z => C.crown - (C.crown - C.roofY) * (z / C.hw) ** 2;
  C.ceil = z => C.arch(z) - C.roofT;
  C.fbHalf = y => y >= C.FB.cy ? Math.sqrt(Math.max(0, C.FB.r ** 2 - (y - C.FB.cy) ** 2)) : C.FB.r + (C.FB.wb - C.FB.r) * (C.FB.cy - y) / (C.FB.cy - C.FB.base);
  return C;
})();
MLOIL.top = a => a >= MLOIL.fb[0] ? MLCAB.FB.cy + MLCAB.FB.r : MLOIL.bY(a) + MLOIL.bR(a);
MLOIL.half = (a, y) => { if (a >= MLOIL.fb[0]) return MLCAB.fbHalf(y); const r = MLOIL.bR(a), d = y - MLOIL.bY(a); return Math.sqrt(Math.max(0, r * r - d * d)); };
/* the 12-RC tender, in buildTender's terms (06_models.js) */
const MLT = { len: 10.79, trucks: [2.20, 8.79], four: true, hw: 1.50, t0: 0.60, t1: 10.25, yBot: 1.12, yTank: 3.45, yBunk: 4.00, bunk: [1.30, 5.20, 6.00], deck: 2.10,
  hatch: 8.4, letter: [7.4, 0.92, 5.6, 2.35], sideKey: 'tSideH6', seed: 1308 };
MLT.ref = (MLT.trucks[0] + MLT.trucks[1]) / 2;

/* one engine unit's frame, cylinders, saddle, guides, gear brackets and brake rigging; bx maps a to local x */
function mlEngineUnit(gb, bx, W, front) {
  const aD = W.aD, n = aD.length, rD = ML.rD, yF = ML.yF, R = W.cylR;
  const a0 = front ? 1.30 : W.cyl[0] - 0.25, a1 = aD[n - 1] + 0.75;
  for (const s of [-1, 1]) {
    gb.box('dark', a1 - a0, 0.46, 0.15, bx((a0 + a1) / 2), yF, s * 0.56);              // frame
    for (let i = 0; i < n; i++) {
      const xd = bx(aD[i]);
      gb.box('dark', 0.34, 0.5, 0.2, xd, rD + 0.02, s * 0.58);                       // driving box
      for (const d of [-0.22, 0.22]) gb.box('dark', 0.08, 0.62, 0.17, xd + d, yF - 0.17, s * 0.58);
      for (let k = 0; k < 5; k++) gb.box('dark', 0.86 - k * 0.12, 0.035, 0.14, xd, yF + 0.25 + k * 0.035, s * 0.6);   // spring
      brakeShoe(gb, xd, rD, s, rD + 0.104); gb.box('dark', 0.05, 0.94, 0.05, xd + rD + 0.079, 0.85, s * 0.62);   // brake shoe & hanger, in the 4 in between the tyres
    }
  }
  for (const a of front ? [1.5, (aD[0] + aD[1]) / 2, (aD[1] + aD[2]) / 2, aD[2] + 0.6] : [(aD[0] + aD[1]) / 2, (aD[1] + aD[2]) / 2, aD[2] + 0.6]) gb.box('dark', 0.24, 0.4, 0.98, bx(a), yF, 0);   // cross ties
  const cA = (W.cyl[0] + W.cyl[1]) / 2, cL = W.cyl[1] - W.cyl[0], yC = ML.yC, yV = ML.yV;
  for (const s of [-1, 1]) {
    const z = s * ML.zC;
    gb.cylX('black', R, R, cL - 0.12, 32, bx(cA), yC, z);
    for (const a of [W.cyl[0] + 0.04, W.cyl[1] - 0.04]) gb.cylX('graphite', R, R, 0.08, 32, bx(a), yC, z);
    gb.cylX('graphite', R - 0.06, R - 0.12, 0.07, 24, bx(W.cyl[0] - 0.035), yC, z);
    gb.cylX('black', 0.30, 0.30, cL + 0.1, 20, bx(cA), yV, s * ML.zV);              // piston valve chest
    for (const a of [cA - (cL + 0.1) / 2, cA + (cL + 0.1) / 2]) gb.cylX('graphite', 0.32, 0.32, 0.06, 20, bx(a), yV, s * ML.zV);
    gb.box('black', cL - 0.1, yV - yC, 0.34, bx(cA), (yV + yC) / 2, s * 1.16);
    gb.box('black', 0.25, 0.18, 0.18, bx(W.cyl[1] + 0.175), yV, s * ML.zV);          // valve stem guide
    for (const a of [W.cyl[0] + 0.15, W.cyl[1] - 0.15]) gb.add('dark', new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6), M(bx(a), yC - R - 0.1, z));   // drain cocks
    for (const dy of [-0.19, 0.19]) gb.box('rod', W.aLink - 0.2 - W.cyl[1], 0.06, 0.14, bx((W.cyl[1] + W.aLink - 0.2) / 2), yC + dy, z);   // crosshead guides
    // guide yoke: a beam over the tyres and the side rods up to the link bridge, a thin leg down inside the guides
    gb.box('black', 0.16, 2.25 - 1.36, 0.42, bx(W.aLink - 0.12), (2.25 + 1.36) / 2, s * 0.98);
    gb.box('black', 0.16, 1.38 - 0.58, 0.04, bx(W.aLink - 0.12), (1.38 + 0.58) / 2, s * 1.17);
    // link bracket: a plate outboard of the link carrying its trunnions, bridged over the link's top to the yoke
    gb.box('black', 0.80, 0.93, 0.04, bx(W.aLink + 0.09), 2.25 - 0.465, s * 1.50);
    gb.box('black', 0.2, 0.08, 0.56, bx(W.aLink + 0.05), 2.21, s * 1.23);
    gb.cylZ('dark', 0.045, 0.12, 12, bx(W.aS), W.yS, s * 1.46);                      // reverse shaft stub
    gb.cylZ('dark', 0.06, 0.16, 12, bx(W.aLink), W.yLink, s * 1.44);
  }
  const top = front ? 1.80 : 1.90, hwS = front ? 0.80 : 0.95;
  gb.box('black', cL - 0.05, top - 0.55, 2 * hwS, bx(cA), (top + 0.55) / 2, 0);        // saddle casting between the cylinders
  return cA;
}

function buildMallet(key, trim = '') {
  const spec = LOCO_SPEC[key];
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const front = new THREE.Group(); front.matrixAutoUpdate = false;                 // the front engine, placed by the train
  const gb = new GeoBin(), gf = new GeoBin();
  const C = MLCAB, FB = C.FB, yB = ML.yB, ax = mxR, O = MLOIL;
  const bar = (k, r, a, b, seg = 8) => gb.add(k, barGeo(r, a, b, seg));
  const RB = { y: 2.46, zi: 1.12, zo: 1.51, t: 0.05, a0: 2.35 };
  const yPipe = 1.68, aPed = (ML.aDf[1] + ML.aDf[2]) / 2;

  /* ===================== front (low-pressure) engine ===================== */
  const cylF = mlEngineUnit(gf, mxF, MLW.f, true);
  // the hinge: a tongue off the back of the front frame into a clevis ahead of the high-pressure cylinders
  gf.box('dark', 0.9, 0.3, 0.7, mxF(ML.aH - 0.35), 1.0, 0);
  gf.cyl('dark', 0.16, 0.16, 0.42, 16, mxF(ML.aH), 1.0, 0);
  // the receiver pipe: from the ball joint at the hinge forward along the centre line into the low-pressure saddle
  gf.cylX('black', 0.13, 0.13, ML.aH - 0.12 - (cylF + 0.3), 16, mxF((ML.aH - 0.12 + cylF + 0.3) / 2), yPipe, 0);
  gf.add('dark', new THREE.SphereGeometry(0.19, 16, 12).translate(mxF(ML.aH - 0.12), yPipe, 0));
  for (const a of [5.0, 7.4]) gf.cylX('dark', 0.16, 0.16, 0.08, 16, mxF(a), yPipe, 0);                       // flanged joints
  gf.box('dark', 0.2, yPipe - 0.13 - 1.2, 0.2, mxF(ML.aH - 0.5), (yPipe - 0.13 + 1.2) / 2 - 0.01, 0);       // its stand on the tongue
  for (const s of [-1, 1]) gf.tube('black', [[mxF(cylF + 0.45), yPipe, 0], [mxF(cylF + 0.2), yPipe + 0.02, s * 0.3], [mxF(cylF), yPipe + 0.12, s * 0.8], [mxF(cylF), ML.yV + 0.2, s * ML.zV]], 0.12, 14, 12);
  gf.cyl('black', 0.18, 0.18, 0.12, 18, mxF(cylF), 1.85, 0);                                                  // exhaust up to the slip joint under the smokebox
  // the boiler's sliding bearing: a pad on two legs astride the receiver pipe
  { const top = yB - O.bR(aPed) - 0.005;
    for (const z of [-0.36, 0.36]) gf.box('dark', 0.4, top - 1.2, 0.16, mxF(aPed), (top + 1.2) / 2 - 0.02, z);
    gf.box('steel', 0.62, 0.04, 0.9, mxF(aPed), top - 0.02, 0); }
  // pilot beam with switching footboards, the deck back to the cylinders
  const pil = { beam: 0.48, deckA: 0.55, deckY: 1.36, deckB: 2.46 };
  gf.box('black', 0.26, 0.44, 2.9, mxF(pil.beam + 0.13), 1.05, 0);
  gf.box('dark', pil.deckB - pil.deckA, 0.05, 2.9, mxF((pil.deckA + pil.deckB) / 2), pil.deckY + 0.025, 0);
  gf.box('dark', 1.0, 0.36, 1.4, mxF(1.2), 1.1, 0);
  for (const s of [-1, 1]) {
    gf.box('dark', 0.34, 0.05, 1.15, mxF(0.36), 0.28, s * 0.82);                                             // footboard
    gf.box('dark', 0.03, 0.12, 1.15, mxF(0.52), 0.34, s * 0.82);                                             // its toe board
    for (const z of [0.32, 1.32]) gf.box('dark', 0.06, 0.86 - 0.26, 0.08, mxF(0.50), (0.86 + 0.26) / 2, s * z);   // hangers off the beam
    const z = s * 1.40;
    for (const y of [0.62, 0.98]) gf.box('dark', 0.36, 0.035, 0.3, mxF(pil.beam + 0.32), y, z);              // steps up to the deck
    for (const d of [-0.17, 0.17]) gf.box('dark', 0.035, pil.deckY - 0.6, 0.3, mxF(pil.beam + 0.32) + d, (pil.deckY + 0.6) / 2, z);
    gf.add('rod', barGeo(0.016, [mxF(0.75), pil.deckY + 0.05, s * 1.32], [mxF(0.75), pil.deckY + 0.95, s * 1.32], 6));
    gf.add('rod', barGeo(0.016, [mxF(0.75), pil.deckY + 0.95, s * 1.32], [mxF(2.3), pil.deckY + 0.95, s * 1.32], 6));   // deck railing
    gf.add('rod', barGeo(0.016, [mxF(2.3), pil.deckY + 0.05, s * 1.32], [mxF(2.3), pil.deckY + 0.95, s * 1.32], 6));
  }
  const coupler = addCoupler(gf, front, { x: mxF(0), out: 1, sx: -pil.beam, sb: 0.84, ly: 1.03, zh: 1.3, yp: 0.8, housing: true, hl: 0.3 });
  // sand pipes from flexible hoses at the frame: ahead of the first driver and, for backing, behind the last
  // (the tyres stand only 4 in apart, so nothing comes down between them)
  for (const s of [-1, 1]) for (const [i, d] of [[0, 1], [2, -1]]) { const xd = mxF(ML.aDf[i]), k = d * (ML.rD + 0.074); gf.tube('dark', [[xd + k - d * 0.14, ML.yF + 0.2, s * 0.6], [xd + k - d * 0.05, ML.yF + 0.36, s * 0.7], [xd + k, ML.yF + 0.26, s * 0.79], [xd + k, 0.9, s * 0.79], [xd + k, 0.45, s * 0.78], [xd + k - d * 0.015, 0.13, s * 0.77]], 0.022, 24, 5); }

  /* ===================== rear (high-pressure) engine: the main frame ===================== */
  const cylR = mlEngineUnit(gb, mxR, MLW.r, false);
  gb.box('dark', 0.6, 0.3, 0.9, ax(ML.aH + 0.05), 1.27, 0);                          // clevis over the front engine's tongue
  for (const s of [-1, 1]) gb.box('dark', 4.8, 0.36, 0.15, ax(17.0), 1.44, s * 0.56);   // cradle under the firebox and cab
  gb.box('dark', 0.24, 0.4, 0.98, ax(19.3), 1.4, 0);
  // steam down from the boiler into the high-pressure valve chests; their exhaust into the receiver's ball joint
  for (const s of [-1, 1]) gb.tube('black', [[ax(cylR), yB - 0.25, s * 1.0], [ax(cylR), 2.05, s * 1.12], [ax(cylR), ML.yV + 0.25, s * ML.zV]], 0.12, 12, 12);
  gb.cylX('black', 0.15, 0.15, MLW.r.cyl[0] + 0.1 - (ML.aH - 0.02), 16, ax((MLW.r.cyl[0] + 0.1 + ML.aH - 0.02) / 2), yPipe, 0);
  gb.box('dark', 0.5, 0.2, 0.6, ax(aPed), yB - O.bR(aPed) + 0.06, 0);                 // the boiler's bearing shoe
  gb.cyl('black', 0.22, 0.22, 0.14, 18, ax(cylF), 1.96, 0);                           // exhaust slip joint under the smokebox

  /* ---- boiler ---- */
  const sbTop = yB + O.sb[2];
  gb.add('graphite', new THREE.CylinderGeometry(O.sb[2], O.sb[2], O.sb[1] - O.sb[0], 48).rotateZ(Math.PI / 2).translate(ax((O.sb[0] + O.sb[1]) / 2), yB, 0));
  const lathe = (pts, a0) => { const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[1], p[0])), 48); g.rotateZ(-Math.PI / 2); g.translate(ax(a0), yB, 0); return g; };
  const door = { r: 0.86 };
  gb.add('graphite', lathe(smokeDoorPts([[0, door.r + 0.05], [0.04, door.r + 0.05], [0.07, door.r], [0.13, 0.56], [0.15, 0.0]]), O.sb[0] - 0.005));
  gb.add('graphite', lathe(smokeRingPts(O.sb[2]), O.sb[0] + 0.09));   // the front ring, its edges rolled over
  for (let i = 0; i < 16; i++) { const t = (i + 0.5) / 16 * TAU; gb.add('dark', new THREE.BoxGeometry(0.07, 0.12, 0.07), M(ax(O.sb[0] - 0.03), yB + 0.95 * Math.cos(t), 0.95 * Math.sin(t), t, 0, 0)); }
  gb.add('jacket', new THREE.CylinderGeometry(O.c1[2], O.c1[2], O.c1[1] - O.c1[0] + 0.02, 48, 1, true).rotateZ(Math.PI / 2).translate(ax((O.c1[0] + O.c1[1]) / 2 - 0.01), yB, 0));
  gb.add('black', new THREE.CircleGeometry(O.c1[2], 48).rotateY(Math.PI / 2).translate(ax(O.c1[0] - 0.01), yB, 0));
  {
    const L = O.cone[1] - O.cone[0], g = new THREE.CylinderGeometry(O.c1[2], O.c3[2], L, 48, 1, true).rotateZ(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + (O.yR - yB) * (L / 2 - p.getX(i)) / L);
    g.computeVertexNormals(); g.translate(ax((O.cone[0] + O.cone[1]) / 2), yB, 0); gb.add('jacket', g);
  }
  gb.add('jacket', new THREE.CylinderGeometry(O.c3[2], O.c3[2], O.c3[1] - O.c3[0] + 0.3, 48, 1, true).rotateZ(Math.PI / 2).translate(ax((O.c3[0] + O.c3[1] + 0.3) / 2), O.yR, 0));
  for (const a of [O.sb[1], 5.8, O.cone[0], O.cone[1], 10.2, 11.8, O.c3[1] - 0.02]) { const r = O.bR(a + 0.01) + 0.012; gb.add('jacketBand', new THREE.CylinderGeometry(r, r, 0.07, 48, 1, true).rotateZ(Math.PI / 2).translate(ax(a), O.bY(a + 0.01), 0)); }
  // firebox: round top over sides flaring to the mud ring, from the throat back to the backhead in the cab
  {
    const s = new THREE.Shape();
    s.moveTo(-FB.wb, FB.base); s.lineTo(-FB.r, FB.cy); s.absarc(0, FB.cy, FB.r, Math.PI, 0, true); s.lineTo(FB.wb, FB.base); s.lineTo(-FB.wb, FB.base);
    const g = new THREE.ExtrudeGeometry(s, { depth: O.fb[1] - O.fb[0], bevelEnabled: false, curveSegments: 28 });
    g.rotateY(Math.PI / 2); g.translate(ax(O.fb[1]), 0, 0); gb.add('graphite', g);
    gb.box('dark', O.fb[1] - O.fb[0] + 0.05, 0.1, 2 * FB.wb + 0.08, ax((O.fb[0] + O.fb[1]) / 2), FB.base - 0.05, 0);   // mud ring
    gb.box('dark', 2.4, 0.3, 1.0, ax(15.6), 1.47, 0);                                                                  // ashpan
    // over-fire jets: a row of air nozzles through each side sheet above the fire
    for (const sd of [-1, 1]) for (let i = 0; i < 6; i++) { const a = 14.0 + i * 0.42, y = 2.22, z = C.fbHalf(y); gb.cylZ('dark', 0.045, 0.1, 10, ax(a), y, sd * (z + 0.03)); gb.cylZ('black', 0.03, 0.06, 8, ax(a), y, sd * (z + 0.1)); }
    for (const sd of [-1, 1]) gb.add('dark', barGeo(0.022, [ax(13.85), 2.34, sd * (C.fbHalf(2.34) + 0.05)], [ax(16.25), 2.34, sd * (C.fbHalf(2.34) + 0.05)], 6));   // their steam line
    for (const sd of [-1, 1]) for (const a of [13.85, 16.25]) gb.box('dark', 0.05, 0.05, 0.1, ax(a), 2.34, sd * (C.fbHalf(2.34) + 0.02));
  }
  /* ---- stack, domes, top fittings ---- */
  const stk = { a: cylF, r: 0.29, top: 4.62 };
  gb.cyl('black', stk.r + 0.1, stk.r + 0.16, 0.2, 32, ax(stk.a), sbTop - 0.02, 0);
  gb.cyl('black', stk.r - 0.02, stk.r + 0.02, stk.top - sbTop, 32, ax(stk.a), (stk.top + sbTop) / 2, 0);
  gb.add('black', new THREE.TorusGeometry(stk.r - 0.02, 0.045, 10, 32).rotateX(Math.PI / 2).translate(ax(stk.a), stk.top - 0.04, 0));
  gb.add('blackMatte', new THREE.CircleGeometry(stk.r - 0.04, 28).rotateX(-Math.PI / 2).translate(ax(stk.a), stk.top - 0.1, 0));
  const dome = (a0, a1, w, top, k, np = 2.6) => {
    const L = a1 - a0, base = O.top((a0 + a1) / 2) - 0.32, d = domeShape(L, w, top - base, np);
    for (const g of d.geos) gb.add(k || 'jacket', g.translate(ax((a0 + a1) / 2), base, 0));
  };
  dome(5.2, 6.3, 0.95, 4.55);                                                      // front sand dome
  dome(8.9, 9.9, 1.0, 4.60);                                                       // steam dome
  dome(11.2, 12.3, 0.95, 4.60);                                                    // rear sand dome
  for (const a of [5.75, 11.75]) { gb.cyl('dark', 0.16, 0.16, 0.05, 14, ax(a), (a < 8 ? 4.55 : 4.60) + 0.005, 0); }   // filler lids
  const fbTop = FB.cy + FB.r;
  for (const z of [-0.16, 0.16]) { gb.cyl('brass', 0.08, 0.1, 0.16, 14, ax(13.75), fbTop + 0.05, z); gb.cyl('brass', 0.115, 0.115, 0.05, 14, ax(13.75), fbTop + 0.14, z); }
  gb.box('black', 0.4, 0.12, 0.62, ax(13.75), fbTop - 0.02, 0);
  const wh = [10.3, O.yR + Math.sqrt(O.c3[2] ** 2 - 0.5 * 0.5), 0.5];                // the whistle, on the engineer's shoulder behind the steam dome
  gb.cyl('brass', 0.07, 0.07, 0.3, 14, ax(wh[0]), wh[1] + 0.2, wh[2]); gb.cyl('brass', 0.09, 0.09, 0.04, 14, ax(wh[0]), wh[1] + 0.37, wh[2]); gb.cyl('brass', 0.04, 0.04, 0.14, 8, ax(wh[0]), wh[1] + 0.02, wh[2]);
  gb.cyl('black', 0.22, 0.26, 0.22, 18, ax(14.6), fbTop - 0.03, -0.05);              // steam turret
  { const tg = [15.6, FB.cy + Math.sqrt(FB.r * FB.r - 0.8 * 0.8), -0.8]; gb.cylX('black', 0.16, 0.16, 0.54, 16, ax(tg[0]), tg[1] + 0.11, tg[2]); gb.box('black', 0.46, 0.18, 0.3, ax(tg[0]), tg[1] - 0.03, tg[2] + 0.04); }   // turbo-generator

  /* ---- front end: two cross-compound air pumps on the smokebox front, the bell above them, class lamps at the
     corners; the headlight and number boards low on the pilot deck (on the front engine) ---- */
  const numBoard = txt => decalMat(160, 64, (g, w, h) => { g.fillStyle = '#f2efe4'; g.fillRect(0, 0, w, h); g.fillStyle = '#121212'; g.font = 'bold 44px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 2); });
  RMAT['num' + key] = numBoard(spec.num);
  const PM = { a: 1.93, z: 0.47, y0: 2.52 };
  for (const s of [-1, 1]) {
    const x = ax(PM.a), z = s * PM.z;
    for (const [dz, rS, rA] of [[-0.16, 0.15, 0.2], [0.17, 0.2, 0.14]]) {          // each pump: a high- and a low-pressure side, steam over air
      const zz = z + s * dz;
      gb.cyl('black', rA, rA, 0.44, 20, x, PM.y0 + 0.24, zz); gb.cyl('black', rS, rS, 0.44, 20, x, PM.y0 + 0.9, zz);
      for (const y of [0.02, 0.46]) gb.cyl('dark', rA + 0.02, rA + 0.02, 0.04, 20, x, PM.y0 + y, zz);
      for (const y of [0.68, 1.12]) gb.cyl('dark', rS + 0.02, rS + 0.02, 0.04, 20, x, PM.y0 + y, zz);
      for (let k = 0; k < 4; k++) gb.cyl('dark', rA + 0.012, rA + 0.012, 0.014, 20, x, PM.y0 + 0.1 + k * 0.09, zz);   // cooling fins on the air cylinders
      gb.cyl('rod', 0.025, 0.025, 0.22, 8, x, PM.y0 + 0.57, zz);                     // piston rod between them
    }
    gb.box('black', 0.3, 0.2, 0.72, x, PM.y0 + 0.57, z);                             // the centre piece
    gb.box('dark', 0.1, 1.1, 0.5, ax(PM.a + 0.22), PM.y0 + 0.57, z);                 // bracket back to the smokebox front
    gb.box('dark', O.sb[0] + 0.02 - (PM.a + 0.2), 0.1, 0.5, ax((O.sb[0] + 0.02 + PM.a + 0.2) / 2), PM.y0 + 0.2, z);
    gb.box('dark', O.sb[0] + 0.02 - (PM.a + 0.2), 0.1, 0.5, ax((O.sb[0] + 0.02 + PM.a + 0.2) / 2), PM.y0 + 0.95, z);
    gb.tube('dark', [[x, PM.y0 + 1.14, z], [x - 0.02, PM.y0 + 1.3, z * 1.2], [ax(O.sb[0] + 0.2), yB + 0.72, s * 0.86]], 0.03, 14, 6);   // steam to the pump
    gb.tube('dark', [[x, PM.y0, z], [x, PM.y0 - 0.14, z * 1.3], [ax(O.sb[0] + 0.25), yB - 0.62, s * 0.93]], 0.035, 14, 6);              // air away
  }
  gb.box('dark', 0.26, 0.05, 2 * PM.z + 0.9, ax(PM.a), PM.y0 - 0.025, 0);              // the shelf the pumps stand on
  for (const s of [-1, 1]) gb.box('dark', O.sb[0] + 0.02 - (PM.a - 0.13), 0.06, 0.08, ax((O.sb[0] + 0.02 + PM.a - 0.13) / 2), PM.y0 - 0.03, s * 0.75);
  // the headlight on a pedestal on the pilot deck, number boards either side
  const hl = { y: 2.0, R: 0.24, D: 0.46, aF: 0.78 }, deckTop = pil.deckY + 0.05;
  {
    const aF = hl.aF, R = hl.R, D = hl.D, aB = aF + D, x0 = mxF(aB);
    const prof = [[0, 0], [0.012, R * 0.5], [0.04, R * 0.8], [0.09, R * 0.95], [0.15, R], [D - 0.06, R], [D - 0.06, R + 0.022], [D - 0.014, R + 0.022], [D, R - 0.012], [D, R - 0.05], [D - 0.04, R - 0.055]];
    gf.add('black', new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[1], p[0])), 36).rotateZ(-Math.PI / 2).translate(x0, hl.y, 0));
    gf.add('black', new THREE.TorusGeometry(R - 0.028, 0.018, 8, 36).rotateY(Math.PI / 2).translate(mxF(aF + 0.01), hl.y, 0));
    { const sp = new THREE.Shape(), r0 = R + 0.005, r1 = R + 0.03, t0 = 0.3, t1 = Math.PI - 0.3;
      sp.absarc(0, 0, r1, t0, t1, false); sp.lineTo(r0 * Math.cos(t1), r0 * Math.sin(t1)); sp.absarc(0, 0, r0, t1, t0, true); sp.lineTo(r1 * Math.cos(t0), r1 * Math.sin(t0));
      gf.add('black', new THREE.ExtrudeGeometry(sp, { depth: 0.13, bevelEnabled: false, curveSegments: 16 }).rotateY(Math.PI / 2).translate(mxF(aF + 0.06), hl.y, 0)); }
    gf.box('black', 0.3, hl.y - R - deckTop + 0.02, 0.3, mxF(aF + D / 2), (hl.y - R + deckTop) / 2, 0);        // pedestal
    gf.box('black', 0.5, 0.04, 0.5, mxF(aF + D / 2), deckTop + 0.02, 0);
    for (const s of [-1, 1]) { const zc = s * (R + 0.21); gf.box('black', 0.14, 0.2, 0.38, mxF(aF + 0.2), hl.y - 0.02, zc); gf.add('num' + key, new THREE.PlaneGeometry(0.34, 0.15), M(mxF(aF + 0.13) + 0.002, hl.y - 0.02, zc, 0, Math.PI / 2, 0)); gf.box('black', 0.2, 0.06, 0.06, mxF(aF + 0.2), hl.y - 0.02, s * (R + 0.01)); }
  }
  hl.lensA = hl.aF + 0.035; hl.r = hl.R - 0.05;
  let bellR;
  { const ab = 2.62, bx = ax(ab), by = sbTop + 0.3;
    for (const z of [-0.27, 0.27]) gb.box('black', 0.07, by + 0.03 - (sbTop - 0.06), 0.05, bx, (by + 0.03 + sbTop - 0.06) / 2, z);
    gb.cylZ('dark', 0.022, 0.6, 8, bx, by, 0);
    bellR = bellRig(body, bx, by, 0.8, 0.3, 'pm'); }
  const cls = clsLampSet();
  for (const z of [-0.78, 0.78]) {
    const y = yB + 0.72, xf = ax(O.sb[0] - 0.23);
    gb.box('black', 0.2, 0.24, 0.2, ax(O.sb[0] - 0.13), y, z); gb.box('black', 0.06, 0.06, 0.2, ax(O.sb[0] - 0.02), y - 0.06, z * 0.94);
    clsLens(cls, body, 0.06, xf + 0.003, y, z, Math.PI / 2, 0.55, [xf - 0.1, y, z]);
  }

  /* ---- running boards, handrails, reservoirs, pipes ---- */
  for (const s of [-1, 1]) {
    const w = RB.zo - RB.zi, z = s * (RB.zi + w / 2);
    const fa = O.fb[0], zf = O.half(fa + 0.5, RB.y) + 0.01, wf = RB.zo - zf;       // over the firebox the boards narrow to clear its wrapper
    gb.box('black', fa - RB.a0 + 0.02, RB.t, w, ax((RB.a0 + fa) / 2), RB.y - RB.t / 2, z);
    gb.box('black', C.a0 - fa + 0.02, RB.t, wf, ax((fa + C.a0) / 2), RB.y - RB.t / 2, s * (zf + wf / 2));
    gb.box('rbEdge', C.a0 - RB.a0, 0.14, 0.03, ax((RB.a0 + C.a0) / 2), RB.y - 0.07, s * (RB.zo + 0.015));
    for (let a = RB.a0 + 0.3; a < C.a0 - 0.2; a += 1.4) { const zs = O.half(a, RB.y - 0.1) - 0.03; gb.box('dark', 0.08, 0.1, RB.zo - zs - 0.04, ax(a), RB.y - RB.t - 0.05, s * (zs + (RB.zo - zs - 0.04) / 2)); }
    const hy = 3.62, zh = O.half(2.6, hy) + 0.08;
    bar('rod', 0.018, [ax(2.5), hy, s * zh], [ax(C.a0 - 0.1), hy, s * zh], 6);
    for (let a = 2.7; a < C.a0 - 0.1; a += 1.5) { const zs = O.half(a, hy) - 0.02; bar('rod', 0.013, [ax(a), hy, s * Math.min(zs, zh)], [ax(a), hy, s * (zh + 0.01)], 5); }
    for (const y of [0.9, 1.45]) gb.box('dark', 0.5, 0.04, 0.3, ax(C.a0 + 0.55), y, s * 1.42);          // cab steps
    for (const d of [-0.24, 0.24]) gb.box('dark', 0.04, C.bottom - 0.88, 0.3, ax(C.a0 + 0.55) + d, (C.bottom + 0.88) / 2, s * 1.42);
    // main air reservoir under the board, over the front engine's rear drivers
    { const a0 = 7.0, a1 = 8.6, r = 0.24, y = RB.y - RB.t - 0.04 - r, zr = s * 1.3;
      gb.cylX('black', r, r, a1 - a0, 20, ax((a0 + a1) / 2), y, zr);
      const yb = RB.y - RB.t, ys = y + Math.sqrt(r * r - 0.14 * 0.14) - 0.01;
      for (const a of [a0 + 0.3, a1 - 0.3]) { gb.add('dark', new THREE.TorusGeometry(r + 0.012, 0.016, 6, 20, Math.PI).rotateY(Math.PI / 2).rotateX(Math.PI).translate(ax(a), y, zr)); for (const d of [-0.14, 0.14]) gb.box('dark', 0.05, yb - ys, 0.06, ax(a), (yb + ys) / 2, zr + d); } }
    // sand pipes off the rear dome down the boiler side: ahead of the first rear driver and behind the last
    for (const [i, d, as] of [[0, 1, 11.5], [2, -1, 12.0]]) {
      const xd = ax(ML.aDr[i]), k = d * (ML.rD + 0.074), xs = ax(as), y0 = O.top(as) - 0.1, z0 = O.half(as, y0) - 0.03;
      gb.tube('dark', [[xs, y0, s * z0], [xs, O.bY(as) + 0.3, s * (O.half(as, O.bY(as) + 0.3) + 0.03)], [xs, RB.y + 0.15, s * (O.half(as, RB.y + 0.15) + 0.03)], [lerp(xs, xd + k, 0.5), RB.y - 0.25, s * 1.02], [xd + k, 1.85, s * 0.88], [xd + k, 1.45, s * 0.79], [xd + k, 0.9, s * 0.79], [xd + k, 0.45, s * 0.78], [xd + k - d * 0.015, 0.13, s * 0.77]], 0.022, 56, 5);
    }
    // injector under the cab and its delivery pipe forward to a check valve on the first course
    gb.cylX('brass', 0.09, 0.09, 0.36, 10, ax(C.a0 - 0.5), 1.8, s * 1.40);
    gb.box('dark', 0.08, RB.y - RB.t - 1.86, 0.08, ax(C.a0 - 0.5), (RB.y - RB.t + 1.86) / 2, s * 1.40);
    const zb = a => s * (O.half(a, 2.82) + 0.06);
    gb.tube('dark', [[ax(C.a0 - 0.62), 1.84, s * 1.40], [ax(C.a0 - 0.9), 2.82, s * 1.42], [ax(13.0), 2.82, zb(13.0)], [ax(9.0), 2.82, zb(9.0)], [ax(5.4), 2.84, zb(5.4)], [ax(5.0), 3.3, s * (O.half(5.0, 3.3) + 0.04)]], 0.045, 64, 6);
    gb.cylZ('brass', 0.08, 0.16, 12, ax(5.0), 3.3, s * (O.half(5.0, 3.3) + 0.03));
  }
  // power reverse on the engineer's side, its reach rod forward to the rear engine's reverse shaft
  gb.cylX('black', 0.16, 0.16, 1.0, 16, ax(15.4), 2.12, 1.42);
  gb.box('dark', 0.14, RB.y - RB.t - 2.12, 0.14, ax(15.4), (RB.y - RB.t + 2.12) / 2, 1.42);
  bar('black', 0.024, [ax(14.9), 2.12, 1.42], [ax(MLW.r.aS), MLW.r.yS + 0.05, 1.40], 6);

  /* ---- cab ---- */
  let cab;
  {
    const x0 = C.x0, x1 = C.x1, hw = C.hw, L = x0 - x1, aRoof1 = C.a1 + 0.65, fl = C.fl;
    for (const s of [-1, 1]) {
      const sh = new THREE.Shape();
      sh.moveTo(x1, C.bottom); sh.lineTo(x0, C.bottom); sh.lineTo(x0, C.roofY); sh.lineTo(ax(C.a1 + 0.5), C.roofY);
      sh.quadraticCurveTo(x1 - 0.05, C.roofY - 0.05, x1, C.roofY - 0.55); sh.lineTo(x1, C.bottom);
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
      bar('rod', 0.014, [ax(C.a1 - 0.08), C.bottom + 0.15, s * (hw + 0.06)], [ax(C.a1 - 0.08), C.roofY - 0.7, s * (hw + 0.06)], 6);
      for (const y of [C.bottom + 0.15, C.roofY - 0.7]) gb.box('dark', 0.04, 0.04, 0.07, ax(C.a1 - 0.08), y, s * (hw + 0.03));
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
    gb.box('dark', 0.44, 0.02, 1.5, x1 - 0.22 + 0.01, fl + 0.01, 0);
    for (const s of [-1, 1]) gb.box('dark', L, C.bottom - 1.45, 0.12, x1 + L / 2, (C.bottom + 1.45) / 2, s * 0.9);
    RMAT['cab' + key] = decalMat(256, 128, (g, w, h) => romanText(g, spec.num, w / 2, h / 2 + 4, 104, '#ebe8dd', 0.02));
    for (const s of [-1, 1]) gb.add('cab' + key, new THREE.PlaneGeometry(1.0, 0.5), M(ax((C.side.a0 + C.side.a1) / 2), 2.45, s * (hw + 0.026), 0, s > 0 ? 0 : Math.PI, 0));
    cab = steamCab(gb, body, { x0: C.x0, x1: C.x1, fl: C.fl, floor: C.fl, hw: C.hw, bh: C.bh, FB: C.FB, ceil: C.ceil, fwin: C.front, side: C.side, eyeY: 3.62, key, spec, ax });
  }
  /* ---- trailing truck: one axle in a cast frame outside the wheels, radius bars forward to its pivot ---- */
  { const aT = ML.aT, rT = ML.rT;
    for (const s of [-1, 1]) {
      const z = s * 1.02;
      gb.box('dark', 2.1, 0.26, 0.15, ax(aT - 0.08), 0.9, z);
      gb.box('dark', 0.36, 0.48, 0.26, ax(aT), rT, z); gb.box('dark', 0.24, 0.3, 0.03, ax(aT), rT, s * 1.17);
      for (let k = 0; k < 6; k++) gb.box('dark', 1.5 - 0.2 * k, 0.026, 0.12, ax(aT), 1.17 - 0.028 * k, z);
      bar('dark', 0.06, [ax(aT - 1.1), 0.92, z], [ax(14.95), 1.3, s * 0.42], 8);
      gb.box('dark', 0.2, 0.36, 0.15, ax(aT - 0.98), 1.2, s * 0.56);                 // hangers from the cradle down to the truck's cross beams
      gb.box('dark', 0.4, C.bottom - 0.1 - 0.95, 0.2, ax(aT + 0.82), (C.bottom - 0.1 + 0.95) / 2, s * 0.9);
      gb.box('dark', 0.08, 0.3, 0.13, ax(aT - rT - 0.09), rT, s * 0.76); gb.box('dark', 0.04, 0.34, 0.04, ax(aT - rT - 0.09), 0.62, s * 0.97);
    }
    bar('dark', 0.03, [ax(aT - rT - 0.09), rT, -1.0], [ax(aT - rT - 0.09), rT, 1.0], 6);
    gb.box('dark', 0.3, 0.3, 2.1, ax(aT - 0.98), 0.95, 0);
    gb.box('dark', 0.3, 0.3, 2.1, ax(aT + 0.82), 1.0, 0);
    gb.box('dark', 0.5, 0.3, 1.0, ax(14.95), 1.36, 0); }
  gb.box('dark', 0.6, 0.3, 1.2, ax(ML.len - 0.2), 1.0, 0);                          // drawbar pocket
  gb.box('dark', 0.2, 0.9, 2.0, ax(ML.len - 0.1), 1.6, 0);                          // rear buffer beam under the deck

  /* ---- rivets, staybolt caps, cylinder studs, pilot fittings (helpers at the end of 06_models.js) ---- */
  dtSmokebox(gb, ax, O.sb, yB);
  dtFirebox(gb, ax, C, O.fb[0], C.a0, [1.94, 2.66, 2.86, 3.06, 3.26, 3.46, 3.66, 3.86], [1.88, 2.64], (s, a, y) => (y < 2.5 && a > 13.7 && a < 16.4) || (s > 0 && y < 2.5 && a > 14.7));
  dtCab(gb, ax, C, C.a1 - 0.6);
  for (const [bin, bx, W] of [[gf, mxF, MLW.f], [gb, mxR, MLW.r]]) for (const s of [-1, 1]) dtCylHeads(bin, bx(W.cyl[0]), bx(W.cyl[1]), ML.yC, s * ML.zC, W.cylR);
  dtPilot(gf, mxF(pil.beam), 1.27);
  body.add(gb.build({ ...RMAT, jacket: RMAT.black, jacketBand: RMAT.dark }));
  front.add(gf.build({ ...RMAT }));

  /* ---- glows & lights ---- */
  const lens = new THREE.Mesh(new THREE.CircleGeometry(hl.r, 36), RMAT.hlLens || RMAT.lens); lens.position.set(mxF(hl.lensA) + 0.004, hl.y, 0); lens.rotation.y = Math.PI / 2; front.add(lens);
  const fire = new THREE.Mesh(new THREE.PlaneGeometry(...cab.fireSize), RMAT.glow.clone()); fire.position.copy(cab.firePos); fire.rotation.y = -Math.PI / 2; body.add(fire);
  const beam = headBeam(mxF(hl.lensA), hl.y, -0.02); front.add(beam);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  halo.position.set(mxF(hl.lensA) + 0.06, hl.y, 0); halo.scale.set(2.2, 2.2, 1); front.add(halo);
  const ash = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.0), new THREE.MeshBasicMaterial({ color: 0xff5a1a, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending }));
  ash.rotation.x = Math.PI / 2; ash.position.set(ax(15.6), 1.28, 0); body.add(ash);

  /* ---- moving parts ---- */
  const centre = spec.wheels === 'boxpok' ? boxpokCentre : spokedCentre;
  const mainG = driverAxle(ML.rD, true, centre, ML.cr), sideG = driverAxle(ML.rD, false, centre, ML.cr);
  const wallG = R => mergeGeos([new THREE.RingGeometry(R - 0.062, R + 0.001, 36).translate(0, 0, RAIL_OFF + 0.0665), new THREE.RingGeometry(R - 0.062, R + 0.001, 36).rotateY(Math.PI).translate(0, 0, -(RAIL_OFF + 0.0665))]);
  const mk = (G, R) => { const grp = new THREE.Group(); for (const k of ['black', 'tire']) { const m = new THREE.Mesh(G[k], k === 'black' ? RMAT.black : RMAT.tire); m.castShadow = true; grp.add(m); } grp.add(new THREE.Mesh(wallG(R), RMAT.dWall)); return grp; };
  const engine = (parent, bx, W) => {
    const E = { drivers: [], rods: {}, bx, W, K: ML };
    for (let i = 0; i < 3; i++) {
      const g = i === ML.mi ? mainG : sideG, grp = new THREE.Group(); grp.position.set(bx(W.aD[i]), ML.rD, 0);
      for (const k of ['black', 'tire', 'rod', 'wall']) { const m = new THREE.Mesh(g[k], k === 'black' ? RMAT.black : k === 'tire' ? RMAT.tire : k === 'wall' ? RMAT.dWall : RMAT.rod); m.castShadow = k !== 'wall'; m.receiveShadow = true; grp.add(m); }
      parent.add(grp); E.drivers.push(grp);
    }
    const R = RMAT.rod, add = m => { m.castShadow = true; parent.add(m); return m; };
    const C3 = [bx(W.aD[ML.mi]), ML.rD], Lk = [bx(W.aLink), W.yLink];
    W.Lecc = Math.hypot(Lk[0] - C3[0], (Lk[1] - W.rl) - (ML.rD - W.e));
    for (const s of [-1, 1]) {
      E.rods[s] = {
        side: [0, 1].map(i => add(new THREE.Mesh(rodGeo(W.aD[i + 1] - W.aD[i], 0.16, 0.16, 0.075, 0.13, 0.13), R))),
        main: add(new THREE.Mesh(rodGeo(ML.Lm, 0.25, 0.15, 0.09, 0.19, 0.125), R)),
        cross: (() => { const g = new GeoBin(); g.box('rod', 0.52, 0.3, 0.14, 0, 0, s * 0.01); g.box('dark', 0.12, 0.42, 0.1, 0.05, -0.32, s * 0.13); return add(g.build(RMAT)); })(),
        piston: add(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.9, 10).rotateZ(Math.PI / 2).translate(0.95, 0, 0), R)),
        ecc: add(new THREE.Mesh(rodGeo(W.e, 0.12, 0.1, 0.06, 0.1, 0.07), R)),
        eccRod: add(new THREE.Mesh(rodGeo(W.Lecc, 0.1, 0.085, 0.05, 0.065, 0.06), R)),
        link: (() => { const g = new GeoBin(); for (const dz of [-0.05, 0.05]) g.box('rod', 0.07, W.rl + 0.42, 0.025, 0, -(W.rl - 0.42) / 2, dz); g.box('rod', 0.12, 0.08, 0.13, 0, -W.rl, 0); g.cylZ('dark', 0.05, 0.16, 10, 0, 0, 0); return add(g.build(RMAT)); })(),
        rrod: add(new THREE.Mesh(rodGeo(W.Lrr, 0.08, 0.07, 0.045, 0.05, 0.05), R)),
        comb: add(new THREE.Mesh(new THREE.BoxGeometry(0.08, W.a + W.b + 0.1, 0.05).translate(0, -(W.a + W.b) / 2, 0), R)),
        union: add(new THREE.Mesh(rodGeo(W.Lu, 0.07, 0.07, 0.04, 0.045, 0.045), R)),
        vstem: (() => { const g = new GeoBin(); g.add('rod', new THREE.CylinderGeometry(0.035, 0.035, 1.0, 8).rotateZ(Math.PI / 2).translate(0.5, 0, 0)); g.box('rod', 0.18, 0.1, 0.3, 0, 0, s * 0.11); return add(g.build(RMAT)); })(),
        lifter: (() => { const g = new GeoBin(); g.add('black', rodGeo(W.Ll, 0.06, 0.05, 0.02, 0.04, 0.04)); g.cylZ('black', 0.02, 0.1, 8, 0, 0, -s * 0.05); return add(g.build(RMAT)); })(),
        rarm: add(new THREE.Mesh(rodGeo(W.rS, 0.08, 0.06, 0.02, 0.06, 0.04), RMAT.black)),
      };
    }
    return E;
  };
  const parts = { drivers: [], lead: [], trail: [], rods: {}, eng: { f: engine(front, mxF, MLW.f), r: engine(body, mxR, MLW.r) } };
  parts.drivers = [...parts.eng.f.drivers, ...parts.eng.r.drivers];
  // lead truck: one axle in a frame with outside boxes, a radius bar back to its pivot under the saddle
  const leadTruck = new THREE.Group();
  { const lg = new GeoBin(), rL = ML.rL;
    for (const s of [-1, 1]) { lg.box('dark', 0.95, 0.18, 0.14, -0.2, rL + 0.05, s * 0.98); lg.box('dark', 0.32, 0.34, 0.24, 0, rL, s * 0.98); }
    lg.box('dark', 0.2, 0.2, 2.1, -0.56, rL + 0.08, 0);                           // cross member behind the wheels
    lg.box('dark', 0.16, 0.36, 0.3, -0.42, rL + 0.3, 0);                          // post up to the centre bearing
    lg.box('dark', 0.6, 0.12, 0.6, -0.14, rL + 0.42, 0);                          // centre bearing up under the front engine's cradle
    lg.box('dark', 1.0, 0.1, 0.14, -1.1, rL + 0.1, 0);                            // radius bar back to its pivot
    leadTruck.add(lg.build(RMAT));
    const w = mk(plainAxle(rL, true, RAIL_OFF, AXJ, 28), rL); w.position.set(0, rL, 0); leadTruck.add(w); parts.lead.push(w); }
  { const g2 = new GeoBin(), y0 = ML.rL + 0.48; g2.box('dark', 0.9, 1.36 - y0, 1.3, mxF(ML.leadA), (1.36 + y0) / 2, 0); front.add(g2.build(RMAT)); }
  { const t = mk(plainAxle(ML.rT, true, RAIL_OFF, AXJ, 28), ML.rT); t.position.set(ax(ML.aT), ML.rT, 0); body.add(t); parts.trail.push(t); }
  // tap hitboxes
  const hit = new THREE.Mesh(new THREE.BoxGeometry(ML.len - ML.aH, 4.6, 3.2), RMAT.hit); hit.position.set(ax((ML.len + ML.aH) / 2), 2.3, 0); body.add(hit);
  const hitF = new THREE.Mesh(new THREE.BoxGeometry(ML.aH, 2.3, 3.2), RMAT.hit); hitF.position.set(mxF(ML.aH / 2), 1.15, 0); front.add(hitF);
  for (const g of [root, front, leadTruck]) g.traverse(o => { if (o.isMesh) { o.castShadow = o.castShadow !== false && o.material !== RMAT.hit; o.receiveShadow = true; } });
  lens.castShadow = false; fire.castShadow = false; ash.castShadow = false;

  const L = { root, body, front, parts, leadTruck, lens, couplers: [coupler, null], fire, ash, beam, halo, ditch: [], spec, rL: ML.rL, art: true,
    len: ML.len, frame: [ML.aDr[0], ML.aDr[2]], leadA: ML.leadA, rD: ML.rD, artA: ML.refF, hinge: [mxR(ML.aH), mxF(ML.aH)], nose: [mxR(0.5), mxF(0.5)],
    stackPos: new THREE.Vector3(ax(stk.a), stk.top + 0.06, 0), cockPos: [new THREE.Vector3(mxR(cylF), 0.35, 1.2), new THREE.Vector3(mxR(cylR), 0.35, -1.2)],
    safetyPos: new THREE.Vector3(ax(13.75), fbTop + 0.35, 0), whistlePos: new THREE.Vector3(ax(wh[0]), wh[1] + 0.6, wh[2]),
    pumpPos: new THREE.Vector3(ax(PM.a), PM.y0 + 0.6, -PM.z), injPos: new THREE.Vector3(ax(C.a0 - 0.5), 1.6, 1.42),
    cabEye: cab.eye, cab, headlightPos: new THREE.Vector3(mxF(hl.lensA), hl.y, 0), headFrame: front, bellRig: bellR, cls,
    fireLightPos: new THREE.Vector3(C.bh - 0.3, C.fl + 0.5, 0.1), cabLightPos: new THREE.Vector3(ax(17.9), 3.95, 0),
    extras: [front],
  };
  L.animate = (roll, theta, rev, odo) => animateMallet(L, roll, theta, rev, odo);
  return L;
}
/* wheels and gear for both engines; like the Big Boy's, the two are not geared together and drift in and out of step */
function animateMallet(L, roll, theta, rev, odo = 0) {
  const p = L.parts;
  for (const w of p.lead) w.rotation.z = -roll / ML.rL;
  for (const w of p.trail) w.rotation.z = -roll / ML.rT;
  for (const [E, th] of [[p.eng.r, theta], [p.eng.f, theta + bbDrift(odo)]]) {
    for (const d of E.drivers) d.rotation.z = th;
    for (const s of [-1, 1]) bbGear(E, E.rods[s], th + (s > 0 ? 0 : Math.PI / 2), rev, s);
  }
}
function buildMalletTender(key, trim = '') { return buildTender(key, trim, MLT); }

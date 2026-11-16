/* ============================================================================
   Raven Lake: the winter railroad. A single-track loop of a little over nine
   miles, run at night under a full moon. From Hollow Pine on the plateau the
   line drops down the face of Raven Cliff on a 4 per cent shelf, swings onto
   the frozen lake at the foot of it and crosses nearly two kilometres of ice
   on ties laid straight on the ice, then climbs back out up Owl Creek at 1.4
   per cent and round the west end of the lake to the plateau again.
   ========================================================================== */
/* the lake and its outlet: plan shapes (X, N), the ice level, and where the track runs on the ice */
const FROST = { iceY: 0, plateau: 96, lake: null, river: null, sIce: [0, 0], cliff: [0, 0] };
/* rail top over the ice: the ties lie straight on it (their undersides are 0.364 m under the rail top) */
const ICE_RAIL = 0.364;

/* point-in-polygon, polygon as [[X, N], ...] */
function frInPoly(P, X, N) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i], b = P[j];
    if ((a[1] > N) !== (b[1] > N) && X < (b[0] - a[0]) * (N - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

/* the loop: plateau tangent past Hollow Pine, round onto the cliff and down it, the turn onto the ice at the
   foot, across the lake, and the long climb back round the west end. lk and lm are the two straights that are
   solved so the loop closes. */
function frLoopPts(lk, lm) {
  const pb = new PathBuilder(-2600, 900, 0), at = {};
  const mark = k => (at[k] = pb.s);
  pb.straight(1500); mark('plateauEnd');
  pb.curve(-800, 30, 120); mark('cliffTop');
  pb.straight(700); pb.curve(1200, 15, 100); pb.straight(900); mark('foot');
  pb.curve(-500, 75, 110); mark('iceTurnEnd');
  pb.straight(700); pb.curve(1000, 12, 90); pb.curve(-1000, 12, 90); pb.straight(400); mark('farShore');
  pb.curve(-600, 90, 120); mark('climbW'); pb.straight(lk);
  pb.curve(-700, 90, 130); mark('climbN'); pb.straight(lm);
  pb.curve(-800, 90, 130); mark('top');
  return { pb, at };
}

function buildFrostRoute() {
  WORLD.mtn = true; WORLD.lazy = true; WORLD.frost = true;
  /* ---------- the loop, closed exactly ---------- */
  let lk = 3580, lm = 1912;
  for (let it = 0; it < 30; it++) {
    const e = (a, b) => { const { pb } = frLoopPts(a, b); return [pb.X - pb.pts[0].X, pb.N - pb.pts[0].N]; };
    const f0 = e(lk, lm); if (Math.hypot(f0[0], f0[1]) < 1e-4) break;
    const fa = e(lk + 1, lm), fb = e(lk, lm + 1);
    const J = [[fa[0] - f0[0], fb[0] - f0[0]], [fa[1] - f0[1], fb[1] - f0[1]]], det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
    lk -= (J[1][1] * f0[0] - J[0][1] * f0[1]) / det; lm -= (-J[1][0] * f0[0] + J[0][0] * f0[1]) / det;
  }
  const { pb, at } = frLoopPts(lk, lm), F = at;
  { // what little is left is spread round the loop so it closes exactly
    const P = pb.pts, L0 = P[0], LE = P[P.length - 1], ex = LE.X - L0.X, en = LE.N - L0.N, n = P.length;
    for (let i = 0; i < n; i++) { const t = i / (n - 1); P[i].X -= ex * t * t; P[i].N -= en * t * t; }
  }
  const LEN = pb.s;
  const P = pb.pts, poseAt = s => { s = ((s % LEN) + LEN) % LEN; let lo = 0, hi = P.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m].s <= s) lo = m; else hi = m; } const a = P[lo], b = P[hi], t = clamp((s - a.s) / ((b.s - a.s) || 1), 0, 1); return { X: lerp(a.X, b.X, t), N: lerp(a.N, b.N, t), h: lerp(a.h, b.h, t) }; };
  const side = (s, off) => { const p = poseAt(s); return [p.X - Math.sin(p.h) * off, p.N + Math.cos(p.h) * off]; };

  /* ---------- the lake ----------
     Its north shore runs under the cliff shelf, 45 m out from the track; it takes in the turn at the foot and
     the whole crossing, and reaches west under the plateau. The outlet river leaves its east end. */
  const sFoot = F.foot;
  // control points [X, N, how sheer the shore is there]
  const north = [];
  for (let s = F.cliffTop + 260; s <= sFoot + 60; s += 60) north.push([...side(s, -30 - 10 * smooth(F.cliffTop + 260, F.cliffTop + 900, s)), 1]);
  const lakeCtl = [
    ...north,
    // round the outside of the turn at the foot (a bluff) and down the east side of the crossing
    [...side(F.foot + 300, 230), 0.7], [...side(F.iceTurnEnd + 120, 330), 0.35], [...side(F.iceTurnEnd + 700, 420), 0], [...side(F.farShore - 260, 380), 0],
    // the south shore: the track leaves the ice here, square to the shore
    [...side(F.farShore - 120, 120), 0], [...side(F.farShore - 100, 0), 0], [...side(F.farShore - 120, -160), 0],
    [1000, -2300, 0], [200, -2380, 0], [-600, -2280, 0], [-1300, -1980, 0], [-1720, -1460, 0], [-1700, -820, 0.25], [-1350, -280, 0.7], [-850, 280, 0.95],
  ];
  FROST.lake = mtSpline(lakeCtl.concat([lakeCtl[0]]), 25).slice(0, -1);
  // each shore point takes the sheerness of the control points either side of it
  FROST.lakeC = FROST.lake.map(p => { let w = 0, c = 0; for (const q of lakeCtl) { const d = Math.hypot(q[0] - p[0], q[1] - p[1]), k = 1 / (d * d + 400); w += k * k; c += k * k * q[2]; } return c / w; });
  // the outlet: from the lake's east side away to the east, wandering a little
  {
    const a = side(F.iceTurnEnd + 700, 400);
    const ctl = [a, [a[0] + 900, a[1] - 150], [a[0] + 2000, a[1] + 220], [a[0] + 3300, a[1] - 80], [a[0] + 4800, a[1] + 260], [a[0] + 7000, a[1] + 100]];
    FROST.river = { pts: mtSpline(ctl, 20), halfW: s => 70 - 30 * smooth(0, 1500, s) };
  }
  // where the main line is on the ice: the stretch inside the lake around the crossing
  {
    let s0 = null, s1 = null;
    for (let s = F.foot - 400; s < F.farShore + 400; s += 0.5) {
      const p = poseAt(s), inside = frInPoly(FROST.lake, p.X, p.N);
      if (inside && s0 === null) s0 = s; if (!inside && s0 !== null && s1 === null && s > F.iceTurnEnd) s1 = s;
    }
    // the track runs onto the ice a few metres inside the shore and leaves it the same
    FROST.sIce = [s0 + 6, s1 - 6];
  }
  const [sI0, sI1] = FROST.sIce;

  /* ---------- profile ----------
     The plateau at 96 m over the ice. The cliff grade, 4 per cent, ends 40 m short of the ice; the climb
     from the far shore is 1.4 per cent to the top. Vertical curves round every change over 160 m. */
  const YI = FROST.iceY + ICE_RAIL, YP = FROST.iceY + FROST.plateau;
  const sD0 = F.cliffTop - 120, gD = 0.04, sD1 = sI0 - 40, sC0 = sI1 + 40, gC = 0.014;
  const drop = YP - YI, dLen = drop / gD;
  const descent = [sD1 - dLen, sD1], climb = [sC0, sC0 + drop / gC];
  FROST.cliff = descent; FROST.climb = climb;
  const gAt = s => {
    const R = 80;
    return -gD * smooth(descent[0] - R, descent[0] + R, s) * (1 - smooth(descent[1] - R, descent[1] + R, s))
      + gC * smooth(climb[0] - R, climb[0] + R, s) * (1 - smooth(climb[1] - R, climb[1] + R, s));
  };
  const MY = new Float32Array(Math.ceil(LEN) + 2);
  { let y = YP; for (let i = 0; i < MY.length; i++) { MY[i] = y; y += gAt(i + 0.5); } }
  { // the climb gives back exactly what the cliff took: anything left over is taken out along the climb
    const e = MY[Math.floor(LEN)] + (LEN % 1) * (MY[Math.floor(LEN) + 1] - MY[Math.floor(LEN)]) - YP;
    for (let i = 0; i < MY.length; i++) MY[i] -= e * smooth(climb[0], climb[1], i);
    // and on the ice the rails lie exactly at the ice
    for (let i = Math.floor(sI0 - 20); i <= Math.ceil(sI1 + 20); i++) MY[i] = lerp(MY[i], YI, smooth(sI0 - 30, sI0, i) * (1 - smooth(sI1, sI1 + 30, i)));
  }
  const mainY = s => { s = ((s % LEN) + LEN) % LEN; const i = Math.min(Math.floor(s), MY.length - 2), t = s - i; return lerp(MY[i], MY[i + 1], t); };
  ROUTE.mainY = mainY;

  /* ---------- the main ---------- */
  // speed limits: 40 over the plateau, 30 down the cliff, 25 on the ice, 35 on the climb
  const limits = [[0, 40], [sD0 - 300, 30], [sI0 - 150, 60], [sI1 + 60, 35], [climb[1] + 300, 40]];
  const limitAt = s => { s = ((s % LEN) + LEN) % LEN; let v = limits[0][1]; for (const [a, l] of limits) if (s >= a) v = l; return v; };
  const main = new Line('Main', P, { kind: 'main', loop: true, limitAt, ice: [[sI0, sI1]] });
  main.mainS = s => s;
  ROUTE.mainLen = main.len; ROUTE.main = main; ROUTE.features = F;
  for (const [a] of limits) main.cut(a);

  /* ---------- Hollow Pine: a passing siding and an engine track on the plateau ---------- */
  const lines = [];
  const sideLine = (name, parent, sA, sB, off, opt, back = true, L = 90) => {
    const nA = parent.cut(sA), nB = back ? parent.cut(sB) : null;
    const ln = new Line(name, alongside(parent, sA, sB, off, L, true, back), Object.assign({ startNode: nA, endNode: nB || undefined }, opt));
    lines.push(ln); return ln;
  };
  const sid = sideLine('Hollow Pine Siding', main, 250, 1250, 4.5, { kind: 'siding', limit: 25 });
  const eng = sideLine('Hollow Pine Engine Track', sid, 120, 560, 9, { kind: 'yard', limit: 10 }, false, 110);
  ROUTE.features.engine = eng;

  /* ---------- build ---------- */
  main.build(s => mainY(s));
  FROST.main = main;
  for (const l of lines) l.build(s => mainY(l.mainS(s)));
  const SW = (name, node, line, divLine, atStart, legNames) => {
    const lm = line.map.get(node), d = atStart ? divLine.first() : divLine.last();
    return NET.addSwitch(node, atStart ? lm.before : lm.after, atStart ? lm.after : lm.before, d, name, legNames);
  };
  SW('Hollow Pine West', sid.startNode, main, sid, true, ['Main', 'Siding']);
  SW('Hollow Pine East', sid.endNode, main, sid, false, ['Main', 'Siding']);
  SW('Engine Track', eng.startNode, sid, eng, true, ['Siding', 'Engine track']);
  for (const sw of NET.switches) { const dk = sw.legs[1].edge.kind; sw.divLimit = dk === 'siding' ? 25 : 15; }
  for (const nd of NET.nodes) if (nd.att.length === 1) ROUTE.bumpers.push(nd);

  /* ---------- the station, water and coal, signals, mileposts ---------- */
  const st = (name, line, s, side_, kind, across = 0) => { const loc = line.locate(s); ROUTE.stations.push({ name, line, sLine: s, edge: loc.edge, s: loc.s, side: side_, kind, across }); };
  st('Hollow Pine', main, 760, 1, 'depot');   // on the open side: the siding and engine track are on the other
  st('Owl Creek', main, climb[0] + 2400, 1, 'small');
  const wc = (line, s, side_, kind) => { const loc = line.locate(s); ROUTE.water.push({ line, sLine: s, edge: loc.edge, s: loc.s, side: side_, kind }); };
  wc(eng, 180, 1, 'tower'); wc(main, 1120, 1, 'column');
  ROUTE.coal = { line: eng, sLine: 300, edge: eng.locate(300).edge, s: eng.locate(300).s };
  const sig = (line, sLine, dir, kind = 'mast') => ROUTE.signals.push({ line, sLine, dir, kind });
  // home signals into Hollow Pine both ways, automatics round the loop (none on the ice or the cliff shelf)
  sig(main, LEN - 350 + 250, 1); sig(main, 1250 + 350, -1);
  for (const s of [sD0 - 600, climb[0] + 1500, climb[0] + 4200]) sig(main, s, 1);
  sig(sid, 80, -1, 'dwarf'); sig(sid, sid.len - 80, 1, 'dwarf');
  for (let m = 1; m * MILE < main.len; m++) if (m * MILE < sI0 - 30 || m * MILE > sI1 + 30) ROUTE.mileposts.push({ line: main, sLine: m * MILE, num: m });
  ROUTE.yardLimits = [];
  ROUTE.tunnels = [];
  ROUTE.startLine = sid; ROUTE.startS = 500;
  ROUTE.lined = ['Hollow Pine East'];
  ROUTE.spawnName = 'the siding at Hollow Pine';
  ROUTE.sidings = { 'Hollow Pine': sid };
  return { main, at: F };
}
/* where a new train is made up in a multiplayer room at Raven Lake (negative = from the end of the track) */
const FROST_SPAWNS = [['Hollow Pine Siding', -175], ['Main', 400], ['Main', 2600], ['Main', 9000], ['Main', 11500]];
const FROST_SPAWN_NAMES = { 'Hollow Pine Siding': 'the siding at Hollow Pine', 'Main': 'the main line' };

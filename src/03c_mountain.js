/* ============================================================================
   Laurel Mountain: the second railroad. A single-track mountain division,
   34 miles from Riverton Yard up the river, round the Laurel Run horseshoe,
   along the valley wall to Summit tunnel and down Pine Creek to Ashby. A
   turning loop at each end; the ruling grade is 1.9 per cent eastward.
   ========================================================================== */
const ROUTES = {
  ohio: { name: 'Berkshire Division', sub: 'Ohio farm country · 13.8 mi double-track loop' },
  laurel: { name: 'Laurel Mountain', sub: 'Mountain grades · 34 mi single track, horseshoe curve, tunnel' },
};
/* ?route= picks the railroad; without it, the one last driven. A layout from the editor overrides both. */
const ROUTE_KEY = (() => {
  try {
    const q = new URLSearchParams(location.search).get('route');
    if (q && ROUTES[q]) return q;
    const s = localStorage.getItem('bd_route');
    return ROUTES[s] ? s : 'ohio';
  } catch (e) { return 'ohio'; }
})();

/* A track beside `line` from sA to sB, `off` metres to its left (+) or right (-), easing out to the full
   spread and back over L metres each end on a quintic reverse curve, so it leaves and rejoins tangent with
   no kink. The points carry sm, the distance on `line` they stand against. */
function alongside(line, sA, sB, off, L, out = true, back = true) {
  const f = t => t * t * t * (10 + t * (-15 + 6 * t)), f1 = t => 30 * t * t * (1 - t) * (1 - t), f2 = t => 60 * t * (1 - t) * (1 - 2 * t);
  const pts = [];
  for (let s = sA; ; s = Math.min(sB, s + 1.5)) {
    let lat = off, d1 = 0, d2 = 0;
    if (out && s < sA + L) { const t = (s - sA) / L; lat = off * f(t); d1 = off * f1(t) / L; d2 = off * f2(t) / (L * L); }
    else if (back && s > sB - L) { const t = (sB - s) / L; lat = off * f(t); d1 = -off * f1(t) / L; d2 = off * f2(t) / (L * L); }
    const p = line.poseAt(s), X = p.X - Math.sin(p.h) * lat, N = p.N + Math.cos(p.h) * lat;
    const q = pts[pts.length - 1];
    pts.push({ X, N, h: p.h + Math.atan2(d1, 1 - p.k * lat), k: p.k / (1 - p.k * lat) + d2, sm: line.mainS(s), s: q ? q.s + Math.hypot(X - q.X, N - q.N) : 0 });
    if (s >= sB) break;
  }
  return pts;
}

/* A turning loop at a dead end: from the switch the normal leg runs straight on, swings right, sweeps
   left round the balloon and runs back on a straight that curves into the switch on the reverse leg, off
   to the left of the normal one. The swing b and the return straight c are solved so the loop closes. */
function balloonPts(X, N, h, R = 215, R1 = 320, Rt = 260, dDeg = 9, a = 140) {
  const make = (b, c) => {
    const pb = new PathBuilder(X, N, h);
    pb.straight(a); pb.curve(-R1, b, 40); pb.curve(R, 180 + b + dDeg, 60); pb.straight(c); pb.arc(-Rt, dDeg);
    return pb;
  };
  let b = 60, c = 300;
  for (let it = 0; it < 40; it++) {
    const e = pb => [pb.X - X, pb.N - N], f0 = e(make(b, c)), fb = e(make(b + 0.05, c)), fc = e(make(b, c + 0.5));
    if (Math.hypot(f0[0], f0[1]) < 1e-4) break;
    const J = [[(fb[0] - f0[0]) / 0.05, (fc[0] - f0[0]) / 0.5], [(fb[1] - f0[1]) / 0.05, (fc[1] - f0[1]) / 0.5]];
    const det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
    b = clamp(b - (J[1][1] * f0[0] - J[0][1] * f0[1]) / det, 5, 120);
    c = clamp(c - (-J[1][0] * f0[0] + J[0][0] * f0[1]) / det, 20, 2000);
  }
  const pb = make(b, c), pts = pb.pts, L = pts[pts.length - 1];
  // what little is left over is spread along the loop so it closes exactly
  const ex = L.X - X, en = L.N - N, n = pts.length;
  for (let i = 0; i < n; i++) { const t = i / (n - 1); pts[i].X -= ex * t * t; pts[i].N -= en * t * t; }
  return pts;
}

function buildMountainRoute() {
  WORLD.mtn = true;
  /* ---------- the main line, west to east ---------- */
  const pb = new PathBuilder(-15000, 0, 0), at = {};
  const mark = k => (at[k] = pb.s);
  pb.straight(2600); mark('yardEnd');
  pb.curve(2200, 14, 150); pb.straight(1400); pb.curve(-1600, 22, 150); pb.straight(1600); pb.curve(1800, 8, 120);
  mark('hollins'); pb.straight(1900);
  pb.curve(900, 55, 150); mark('bridge'); pb.straight(520); pb.curve(1100, 30, 140);
  mark('climb'); pb.straight(1200); pb.curve(-1300, 18, 140); pb.straight(1100); pb.curve(1000, 30, 140); pb.straight(600); pb.curve(-1100, 24, 140);
  mark('bigLaurel'); pb.straight(1700); pb.curve(1200, 22, 140); pb.straight(900); pb.curve(-900, 15, 120); pb.straight(600);
  mark('horseshoe'); pb.curve(-330, 165, 120); mark('horseshoeEnd');
  pb.straight(1400); pb.curve(1000, 20, 140); pb.straight(1000); pb.curve(-1100, 25, 140); pb.straight(1200);
  pb.curve(800, 70, 140); pb.straight(1500); pb.curve(1500, 25, 140);
  mark('glenIron'); pb.straight(2000); pb.curve(-1200, 20, 140); pb.straight(1600); pb.curve(1000, 30, 140); pb.straight(1400); pb.curve(-1300, 20, 140); pb.straight(1200); pb.curve(1100, 20, 140);
  mark('summit'); pb.straight(1500); mark('tunnel'); pb.straight(1100); mark('tunnelEnd');
  pb.curve(-1400, 30, 140); pb.straight(2200); pb.curve(1600, 25, 140); pb.straight(1800); pb.curve(-1500, 25, 140); pb.straight(1500); pb.curve(1200, 15, 140);
  mark('pineFlats'); pb.straight(2400); pb.curve(-1800, 15, 140); pb.straight(2900); pb.curve(2000, 10, 140);
  mark('ashby'); pb.straight(1700);
  const F = at;
  /* ---------- profile: the climb from the river to Summit and the drop down Pine Creek ----------
     [where the grade starts, rise per metre]. Sidings stand on easier grades so a train can start
     again after a meet; vertical curves round every change over 180 m. */
  const grades = [[0, 0], [2650, 0.0035], [11500, 0.019], [16100, 0.010], [18000, 0.019], [20400, 0.015], [21550, 0.019],
    [29500, 0.010], [31400, 0.0195], [38100, 0.006], [39700, 0.003], [40220, -0.003], [40800, -0.016], [49100, -0.005], [51000, -0.013], [55500, 0]];
  const LEN = pb.s, MY = new Float32Array(Math.ceil(LEN) + 2);
  const gAt = s => { let g = grades[0][1]; for (let i = 1; i < grades.length; i++) g = lerp(g, grades[i][1], smooth(grades[i][0] - 90, grades[i][0] + 90, s)); return g; };
  { let y = 0; for (let i = 0; i < MY.length; i++) { MY[i] = y; y += gAt(i + 0.5); } }
  const mainY = s => { s = clamp(s, 0, LEN); const i = Math.min(Math.floor(s), MY.length - 2), t = s - i; return lerp(MY[i], MY[i + 1], t); };
  ROUTE.mainY = mainY; ROUTE.grades = grades;

  /* ---------- structures on the main ---------- */
  const sBridge = F.bridge + 260;                    // two through-truss spans over the river
  const sViaduct = F.horseshoeEnd + 760, VH = 120;   // steel trestle over Bear Run, below the horseshoe
  const tunnel = [F.tunnel, F.tunnelEnd];
  // speed limits: yard limits at both terminals, 30 round the horseshoe, 35 through the bore
  const limits = [[0, 30], [2650, 50], [11400, 40], [20300, 30], [21650, 40], [39550, 35], [40900, 40], [55400, 30]];
  const limitAt = s => { let v = limits[0][1]; for (const [a, l] of limits) if (s >= a) v = l; return v; };
  const main = new Line('Main', pb.pts, { kind: 'main', limitAt, bridges: [[sBridge - 72, sBridge + 72], [sViaduct - VH, sViaduct + VH]], tunnels: [tunnel] });
  main.mainS = s => s;
  ROUTE.mainLen = main.len; ROUTE.main = main; ROUTE.features = F;
  ROUTE.bridge = { line: main, s: sBridge, half: 64, name: 'LAUREL MTN · CONEMAUGH RIVER' };
  ROUTE.viaduct = { line: main, s: sViaduct, half: VH };
  ROUTE.tunnels = [{ line: main, s0: tunnel[0], s1: tunnel[1], name: 'SUMMIT' }];
  for (const [a] of limits.slice(1)) main.cut(a);

  /* ---------- sidings, yards and terminals ---------- */
  const lines = [];
  const side = (name, parent, sA, sB, off, opt, back = true, L = 90) => {
    const nA = parent.cut(sA), nB = back ? parent.cut(sB) : null;
    const ln = new Line(name, alongside(parent, sA, sB, off, L, true, back), Object.assign({ startNode: nA, endNode: nB || undefined }, opt));
    lines.push(ln); return ln;
  };
  const SIDING = { kind: 'siding', limit: 30 }, YARD = { kind: 'yard', limit: 15 };
  // Riverton Yard: four tracks on the river's far side of the main, each laddered off the one before
  const yards = [side('Riverton 1', main, 420, 2420, -4.5, YARD)];
  for (let k = 2; k <= 4; k++) { const p = yards[k - 2]; yards.push(side('Riverton ' + k, p, 125, p.len - 125, -4.5, YARD)); }
  const eng = side('Riverton Engine Track', yards[3], 140, 700, -9, { kind: 'yard', limit: 10 }, false, 110);
  ROUTE.features.engine = eng;
  // passing sidings: [name, from, to, which side]
  const sid = {};
  for (const [nm, a, b, o] of [['Hollins', F.hollins + 200, F.hollins + 1900, 4.5], ['Big Laurel', 16200, 17950, 4.5], ['Glen Iron', 29600, 31350, 4.5], ['Summit', 38150, 39480, 4.5], ['Pine Flats', 49150, 50950, -4.5]])
    sid[nm] = side(nm + ' Siding', main, a, b, o, SIDING);
  const ashby = side('Ashby 1', main, F.ashby + 120, main.len - 330, -4.5, YARD);
  const ashby2 = side('Ashby 2', ashby, 125, ashby.len - 125, -4.5, YARD);
  // turning loops beyond each terminal
  const p0 = main.poseAt(0), pE = main.poseAt(main.len);
  const nLW = main.startNode = NET.node(), nLE = main.endNode = NET.node();
  const loopW = new Line('Riverton Loop', balloonPts(p0.X, p0.N, p0.h + Math.PI), { kind: 'yard', limit: 15, startNode: nLW, endNode: nLW });
  const loopE = new Line('Ashby Loop', balloonPts(pE.X, pE.N, pE.h), { kind: 'yard', limit: 15, startNode: nLE, endNode: nLE });

  /* ---------- build edges ---------- */
  main.build(s => mainY(s));
  for (const l of lines) l.build(s => mainY(l.mainS(s)));
  loopW.build(() => 0); loopE.build(() => mainY(main.len));

  /* ---------- switches ---------- */
  const SW = (name, node, line, divLine, atStart, legNames) => {
    const lm = line.map.get(node), d = atStart ? divLine.first() : divLine.last();
    return NET.addSwitch(node, atStart ? lm.before : lm.after, atStart ? lm.after : lm.before, d, name, legNames);
  };
  SW('Riverton West', yards[0].startNode, main, yards[0], true, ['Main', 'Riverton 1']);
  SW('Riverton East', yards[0].endNode, main, yards[0], false, ['Main', 'Riverton 1']);
  for (let k = 1; k < 4; k++) {
    SW('Riverton ladder W' + (k + 1), yards[k].startNode, yards[k - 1], yards[k], true, ['Riverton ' + k, 'Riverton ' + (k + 1)]);
    SW('Riverton ladder E' + (k + 1), yards[k].endNode, yards[k - 1], yards[k], false, ['Riverton ' + k, 'Riverton ' + (k + 1)]);
  }
  SW('Riverton Engine Terminal', eng.startNode, yards[3], eng, true, ['Riverton 4', 'Engine track']);
  for (const nm in sid) { SW(nm + ' West', sid[nm].startNode, main, sid[nm], true, ['Main', 'Siding']); SW(nm + ' East', sid[nm].endNode, main, sid[nm], false, ['Main', 'Siding']); }
  SW('Ashby West', ashby.startNode, main, ashby, true, ['Main', 'Ashby 1']); SW('Ashby East', ashby.endNode, main, ashby, false, ['Main', 'Ashby 1']);
  SW('Ashby ladder W', ashby2.startNode, ashby, ashby2, true, ['Ashby 1', 'Ashby 2']); SW('Ashby ladder E', ashby2.endNode, ashby, ashby2, false, ['Ashby 1', 'Ashby 2']);
  // the loops' switches are sprung: a train coming round trails through without being thrown
  for (const [nm, node, loop, trunk] of [['Riverton Loop', nLW, loopW, main.first()], ['Ashby Loop', nLE, loopE, main.last()]])
    NET.addSwitch(node, trunk, loop.first(), loop.last(), nm, ['Loop', 'Loop return']).spring = true;
  for (const sw of NET.switches) { const dk = sw.legs[1].edge.kind; sw.divLimit = dk === 'siding' ? 30 : 15; }
  for (const nd of NET.nodes) if (nd.att.length === 1) ROUTE.bumpers.push(nd);

  /* ---------- stations, water, signals, mileposts ---------- */
  const st = (name, line, s, side, kind, across = 0) => { const loc = line.locate(s); ROUTE.stations.push({ name, line, sLine: s, edge: loc.edge, s: loc.s, side, kind, across }); };
  st('Riverton', main, 1500, 1, 'depot');
  st('Hollins', main, F.hollins + 1100, -1, 'depot');
  st('Big Laurel', main, 17000, -1, 'small');
  st('Glen Iron', main, 30400, 1, 'small', 4.5);
  st('Summit', main, 38800, -1, 'small');
  st('Pine Flats', main, 50000, 1, 'depot');
  st('Ashby', main, F.ashby + 700, 1, 'depot');
  const wc = (line, s, side, kind) => { const loc = line.locate(s); ROUTE.water.push({ line, sLine: s, edge: loc.edge, s: loc.s, side, kind }); };
  wc(main, 17500, -1, 'column'); wc(main, 39100, -1, 'column'); wc(main, 50400, 1, 'column');
  wc(eng, 160, 1, 'tower'); wc(main, F.ashby + 1000, 1, 'column');
  ROUTE.coal = { line: eng, sLine: 260, edge: eng.locate(260).edge, s: eng.locate(260).s };
  /* Single track, signalled both ways: a home signal 400 m out from each end of every siding and
     automatic block signals in between, staggered. Dwarfs govern moves off the sidings and Riverton 1. */
  const sig = (line, sLine, dir, kind = 'mast') => ROUTE.signals.push({ line, sLine, dir, kind });
  const ends = [[2420, 2420], ...Object.values(sid).map(l => [l.mainS(0), l.mainS(l.len)]), [F.ashby + 120, F.ashby + 120]];
  for (let i = 0; i < ends.length; i++) {
    const [a, b] = ends[i];
    if (i > 0) sig(main, a - 420, 1);
    if (i < ends.length - 1) sig(main, b + 420, -1);
    if (i < ends.length - 1) {   // automatic signals between this siding and the next, about every 3 km
      const g0 = b + 420, g1 = ends[i + 1][0] - 420, n = Math.floor((g1 - g0) / 3000);
      for (let k = 1; k <= n; k++) { const s = g0 + (g1 - g0) * k / (n + 1); sig(main, s - 40, 1); sig(main, s + 40, -1); }
    }
  }
  for (const l of [...Object.values(sid), yards[0], ashby]) { sig(l, 80, -1, 'dwarf'); sig(l, l.len - 80, 1, 'dwarf'); }
  for (let m = 1; m * MILE < main.len; m++) ROUTE.mileposts.push({ line: main, sLine: m * MILE, num: m });
  ROUTE.yardLimits = [[2700, -1], [F.ashby - 50, 1]];
  ROUTE.startLine = yards[1]; ROUTE.startS = 260;
  ROUTE.sidings = sid; ROUTE.yards = yards; ROUTE.loops = [loopW, loopE];
  return { main, at: F };
}
/* where a new train is made up in a multiplayer room on the mountain (negative = from the end of the track) */
const MTN_SPAWNS = [['Riverton 2', -175], ['Riverton 3', -140], ['Riverton 4', -112], ['Riverton 1', -200], ['Ashby 2', -150], ['Hollins Siding', -320], ['Pine Flats Siding', -320], ['Main', 5200], ['Main', 52000]];
const MTN_SPAWN_NAMES = { 'Riverton 1': 'Riverton 1, Riverton Yard', 'Riverton 2': 'Riverton 2, Riverton Yard', 'Riverton 3': 'Riverton 3, Riverton Yard', 'Riverton 4': 'Riverton 4, Riverton Yard', 'Ashby 2': 'Ashby 2, Ashby', 'Hollins Siding': 'the Hollins siding', 'Pine Flats Siding': 'the Pine Flats siding', 'Main': 'the main line' };

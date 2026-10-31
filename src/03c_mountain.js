/* ============================================================================
   Laurel Mountain: the second railroad. A double-track mountain division,
   35 miles from Riverton Yard up the river, round the Laurel Run horseshoe,
   along the valley wall to Summit tunnel and down Pine Creek to Ashby. A
   turning loop at each end; the ruling grade is 1.9 per cent eastward.
   ========================================================================== */
const ROUTES = {
  ohio: { name: 'Berkshire Division', sub: 'Ohio farm country · 13.8 mi double-track loop' },
  laurel: { name: 'Laurel Mountain', sub: 'Mountain grades · 35.6 mi double track, horseshoe curve, tunnel' },
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

  /* ---------- the second main track ----------
     Track 2 runs 4.5 m to the left of track 1 from just past Riverton Yard to just short of Ashby, leaving
     and rejoining it on long easy reverse curves. Right-hand running, as on the Berkshire Division: track 1
     carries eastward (+s) trains up the mountain and track 2 westward ones. Beyond the two junctions the
     terminals, their yards and the turning loops are single track. */
  const DT = 4.5, JL = 150, sW = 2480, sE = F.ashby + 40;
  const nW = main.cut(sW), nE = main.cut(sE);
  const main2 = new Line('Main 2', alongside(main, sW, sE, DT, JL), { kind: 'main', startNode: nW, endNode: nE });
  const S2 = main2.pts.map(p => p.s), SM2 = main2.pts.map(p => p.sm);
  const remap = (A, B) => s => {
    if (s <= A[0]) return B[0]; if (s >= A[A.length - 1]) return B[B.length - 1];
    let lo = 0, hi = A.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (A[m] <= s) lo = m; else hi = m; }
    return B[lo] + (B[hi] - B[lo]) * (s - A[lo]) / ((A[hi] - A[lo]) || 1);
  };
  const to2 = remap(SM2, S2), to1 = main2.mainS;
  main2.opt.limitAt = s => limitAt(to1(s));
  main2.opt.bridges = main.opt.bridges.map(([a, b]) => [to2(a), to2(b)]);
  main2.opt.tunnels = [[to2(tunnel[0]), to2(tunnel[1])]];
  for (const [a] of limits.slice(1)) if (a > sW + JL && a < sE - JL) main2.cut(to2(a));
  ROUTE.main2 = main2; ROUTE.to2 = to2; ROUTE.to1 = to1; ROUTE.spacing = DT;
  ROUTE.span2 = [sW + JL, sE - JL];   // where the two tracks run side by side at full spacing
  ROUTE.tunnels[0].off = ROUTE.viaduct.off = DT / 2;   // both are built round the middle of the two tracks

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
  /* passing sidings: [name, from, to (on track 1), which side]. Those on the left come off track 2, for
     westward trains; Big Laurel and Pine Flats, on the right, come off track 1, so a slow freight on the
     climb can be put away there for a faster train to go by. */
  const sid = {};
  for (const [nm, a, b, o] of [['Hollins', F.hollins + 200, F.hollins + 1900, 4.5], ['Big Laurel', 16200, 17950, -4.5], ['Glen Iron', 29600, 31350, 4.5], ['Summit', 38150, 39480, 4.5], ['Pine Flats', 49150, 50950, -4.5]])
    sid[nm] = o > 0 ? side(nm + ' Siding', main2, to2(a), to2(b), o, SIDING) : side(nm + ' Siding', main, a, b, o, SIDING);
  const ashby = side('Ashby 1', main, F.ashby + 120, main.len - 330, -4.5, YARD);
  const ashby2 = side('Ashby 2', ashby, 125, ashby.len - 125, -4.5, YARD);
  /* crossovers between the main tracks, on tangent track: A takes an eastward train from track 1 over to
     track 2 and B, just beyond, brings one back, each on a reverse curve as long as the junctions' */
  const xos = [];
  for (const [place, s] of [['Riverton', 3400], ['Big Laurel', 15120], ['Bear Run', 22450], ['Glen Iron', 28300], ['Summit', 37100], ['Pine Flats', 51100], ['Ashby', 54600]]) {
    const sB = s + JL + 50;
    xos.push({ line: new Line(place + ' crossover A', alongside(main, s, s + JL, DT, JL, true, false), { kind: 'main', limit: 40, cant: false, startNode: main.cut(s), endNode: main2.cut(to2(s + JL)) }), from: main, to: main2 });
    xos.push({ line: new Line(place + ' crossover B', alongside(main, sB, sB + JL, DT, JL, false, true), { kind: 'main', limit: 40, cant: false, startNode: main2.cut(to2(sB)), endNode: main.cut(sB + JL) }), from: main2, to: main });
  }  // turning loops beyond each terminal
  const p0 = main.poseAt(0), pE = main.poseAt(main.len);
  const nLW = main.startNode = NET.node(), nLE = main.endNode = NET.node();
  const loopW = new Line('Riverton Loop', balloonPts(p0.X, p0.N, p0.h + Math.PI), { kind: 'yard', limit: 15, startNode: nLW, endNode: nLW });
  const loopE = new Line('Ashby Loop', balloonPts(pE.X, pE.N, pE.h), { kind: 'yard', limit: 15, startNode: nLE, endNode: nLE });

  /* ---------- build edges ---------- */
  main.build(s => mainY(s));
  main2.build(s => mainY(to1(s)));
  for (const x of xos) x.line.build(s => mainY(x.line.mainS(s)));
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
  SW('Riverton Jct', nW, main, main2, true, ['Track 1', 'Track 2']); SW('Ashby Jct', nE, main, main2, false, ['Track 1', 'Track 2']);
  for (const nm in sid) { const on = main2.map.has(sid[nm].startNode) ? main2 : main;
    SW(nm + ' West', sid[nm].startNode, on, sid[nm], true, ['Main', 'Siding']); SW(nm + ' East', sid[nm].endNode, on, sid[nm], false, ['Main', 'Siding']); }
  // the two switches of a crossover are thrown together
  for (let i = 0; i < xos.length; i += 2) for (const x of [xos[i], xos[i + 1]]) {
    const a = SW(x.line.name, x.line.startNode, x.from, x.line, true, [x.from === main ? 'Track 1' : 'Track 2', 'Crossover']);
    const b = SW(x.line.name, x.line.endNode, x.to, x.line, false, [x.to === main ? 'Track 1' : 'Track 2', 'Crossover']);
    a.mate = b; b.mate = a;
  }
  SW('Ashby West', ashby.startNode, main, ashby, true, ['Main', 'Ashby 1']); SW('Ashby East', ashby.endNode, main, ashby, false, ['Main', 'Ashby 1']);
  SW('Ashby ladder W', ashby2.startNode, ashby, ashby2, true, ['Ashby 1', 'Ashby 2']); SW('Ashby ladder E', ashby2.endNode, ashby, ashby2, false, ['Ashby 1', 'Ashby 2']);
  // the loops' switches are sprung: a train coming round trails through without being thrown
  for (const [nm, node, loop, trunk] of [['Riverton Loop', nLW, loopW, main.first()], ['Ashby Loop', nLE, loopE, main.last()]])
    NET.addSwitch(node, trunk, loop.first(), loop.last(), nm, ['Loop', 'Loop return']).spring = true;
  for (const sw of NET.switches) { const dk = sw.legs[1].edge.kind; sw.divLimit = dk === 'main' ? 40 : dk === 'siding' ? 30 : 15; }
  for (const nd of NET.nodes) if (nd.att.length === 1) ROUTE.bumpers.push(nd);

  /* ---------- stations, water, signals, mileposts ---------- */
  const st = (name, line, s, side, kind, across = 0) => { const loc = line.locate(s); ROUTE.stations.push({ name, line, sLine: s, edge: loc.edge, s: loc.s, side, kind, across }); };
  st('Riverton', main, 1500, -1, 'depot');
  // across: how much further out than usual, past track 2 and any siding beyond it
  st('Hollins', main, F.hollins + 1100, -1, 'depot', 2 * DT);
  st('Big Laurel', main, 17000, -1, 'small', DT);
  st('Glen Iron', main, 30400, 1, 'small');
  st('Summit', main, 38800, -1, 'small', 2 * DT);
  st('Pine Flats', main, 50000, 1, 'depot', DT);
  st('Ashby', main, F.ashby + 700, -1, 'depot');
  const wc = (line, s, side, kind) => { const loc = line.locate(s); ROUTE.water.push({ line, sLine: s, edge: loc.edge, s: loc.s, side, kind }); };
  // beside the track they serve, never between the two mains: Big Laurel's for trains in the siding on the climb
  wc(sid['Big Laurel'], 1300, 1, 'column'); wc(main, 39100, 1, 'column'); wc(main2, to2(50400), -1, 'column');
  wc(eng, 160, 1, 'tower'); wc(main, F.ashby + 1000, -1, 'column');
  ROUTE.coal = { line: eng, sLine: 260, edge: eng.locate(260).edge, s: eng.locate(260).s };
  /* Signals, as on the Berkshire Division: track 1 for eastward running and track 2 for westward. A home
     signal 350 m short of each place with switches on that track, automatic block signals between them
     about every 2.5 km. Into each junction from the single track at the terminals, one home signal on the
     main. Dwarfs govern moves off the sidings and Riverton 1 and Ashby 1 onto the main. */
  const sig = (line, sLine, dir, kind = 'mast') => ROUTE.signals.push({ line, sLine, dir, kind });
  const swAt = ln => NET.switches.filter(sw => ln.map.has(sw.node)).map(sw => { const m = ln.map.get(sw.node); return m.after ? m.after.edge.lineS0 : m.before.edge.lineS0 + m.before.edge.len; });
  // nothing on the bridges or in the bore: a signal that would stand there goes back to the near end of it
  const structs = [...main.opt.bridges.map(([a, b]) => [a - 40, b + 40]), [tunnel[0] - 90, tunnel[1] + 90]];
  const clear = (ln, s, dir) => { for (let g = 0; g < 3; g++) for (const [a, b] of structs) { const m = ln === main2 ? to1(s) : s; if (m > a && m < b) s = ln === main2 ? to2(dir > 0 ? a : b) : dir > 0 ? a : b; } return s; };
  for (const [ln, dir] of [[main, 1], [main2, -1]]) {
    // the places, each the switches within 2 km of each other (a siding's two ends make one place)
    const at = swAt(ln).filter(s => ln === main2 || (s > 2000 && s < sE + 100)).sort((a, b) => (a - b) * dir), places = [];
    for (const s of at) if (places.length && (s - places[places.length - 1].last) * dir < 2000) places[places.length - 1].last = s; else places.push({ first: s, last: s });
    let prev = null;
    for (const pl of places) {
      const into = ln === main2 && pl === places[0], home = into ? sE + 350 : clear(ln, pl.first - dir * 350, dir);
      if (prev !== null) { const n = Math.floor(Math.abs(home - prev) / 2500); for (let k = 1; k <= n; k++) sig(ln, clear(ln, prev + (home - prev) * k / (n + 1), dir), dir); }
      sig(into ? main : ln, home, dir);
      prev = pl.last;
    }
  }
  for (const l of [...Object.values(sid), yards[0], ashby]) { sig(l, 80, -1, 'dwarf'); sig(l, l.len - 80, 1, 'dwarf'); }
  ROUTE.crossovers = xos.map(x => x.line);
  for (let m = 1; m * MILE < main.len; m++) ROUTE.mileposts.push({ line: main, sLine: m * MILE, num: m });
  ROUTE.yardLimits = [[2700, -1], [F.ashby - 50, 1]];
  ROUTE.startLine = yards[1]; ROUTE.startS = 260;
  ROUTE.sidings = sid; ROUTE.yards = yards; ROUTE.loops = [loopW, loopE];
  return { main, at: F };
}
/* where a new train is made up in a multiplayer room on the mountain (negative = from the end of the track) */
const MTN_SPAWNS = [['Riverton 2', -175], ['Riverton 3', -140], ['Riverton 4', -112], ['Riverton 1', -200], ['Ashby 2', -150], ['Hollins Siding', -320], ['Pine Flats Siding', -320], ['Main', 5200], ['Main', 52000]];
const MTN_SPAWN_NAMES = { 'Riverton 1': 'Riverton 1, Riverton Yard', 'Riverton 2': 'Riverton 2, Riverton Yard', 'Riverton 3': 'Riverton 3, Riverton Yard', 'Riverton 4': 'Riverton 4, Riverton Yard', 'Ashby 2': 'Ashby 2, Ashby', 'Hollins Siding': 'the Hollins siding', 'Pine Flats Siding': 'the Pine Flats siding', 'Main': 'the main line' };

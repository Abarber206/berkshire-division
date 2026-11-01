/* ============================================================================
   The railroad: Nickel Plate–style division with a mainline loop.
   South tangent 7,200 m (Bellevue Yard, Fostoria), east curve, north side
   over Kenton Hill and the Sandusky River bridge, quarry branch, west curve.
   ========================================================================== */
const NET = new Network();
const ROUTE = { lines: {}, stations: [], water: [], signals: [], crossings: [], mileposts: [], bumpers: [], features: {} };
/* The Van Wert extension's country: the moraine's crest (a north-south ridge the line climbs over on both
   sides of the loop), and the Little Auglaize, which rises in a lake inside the loop and runs north under
   the line at Van Wert. riverN is filled in when the route is laid. */
const VW = { moraineX: -10140, riverX: -13200, riverN: 0, lake: { X: -12650, N: 1420, r: 330 } };

/* the same path moved sideways by off metres (+ left), as builder points */
function offsetPts(pts, off) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], X = p.X - Math.sin(p.h) * off, N = p.N + Math.cos(p.h) * off;
    out.push({ X, N, h: p.h, k: p.k / (1 - p.k * off), s: i ? out[i - 1].s + Math.hypot(X - out[i - 1].X, N - out[i - 1].N) : 0 });
  }
  return out;
}

/* A Line is a continuous builder path that gets cut into edges at nodes. */
class Line {
  constructor(name, pts, opt = {}) {
    this.name = name; this.pts = pts; this.opt = opt; this.cuts = []; this.loop = !!opt.loop;
    this.len = pts[pts.length - 1].s; this.startNode = opt.startNode || null; this.endNode = opt.endNode || null;
    this.edges = []; this.map = new Map();
    // a track laid alongside another carries, point by point, the distance on the main line it stands against
    if (pts[0].sm !== undefined) { const S = pts.map(p => p.s), SM = pts.map(p => p.sm); this.mainS = s => { s = clamp(s, 0, this.len); const i = this._find(s), j = Math.min(i + 1, S.length - 1); return SM[i] + (SM[j] - SM[i]) * ((s - S[i]) / ((S[j] - S[i]) || 1)); }; }
    ROUTE.lines[name] = this;
  }
  _find(s) { let lo = 0, hi = this.pts.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.pts[m].s <= s) lo = m; else hi = m; } return lo; }
  poseAt(s) {
    if (this.loop) s = ((s % this.len) + this.len) % this.len;
    s = clamp(s, 0, this.len);
    const i = this._find(s), a = this.pts[i], b = this.pts[Math.min(i + 1, this.pts.length - 1)];
    const t = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0;
    return { X: lerp(a.X, b.X, t), N: lerp(a.N, b.N, t), h: lerp(a.h, b.h, t), k: lerp(a.k, b.k, t) };
  }
  cut(s, node) { node = node || NET.node(); this.cuts.push({ s, node }); return node; }
  slice(sA, sB) {
    const out = [];
    const push = (p, sOff, hOff) => out.push({ X: p.X, N: p.N, h: p.h + hOff, k: p.k, s: p.s + sOff - sA });
    const segment = (a, b, sOff, hOff) => {
      const pa = this.poseAt(a); push({ ...pa, s: a }, sOff, hOff);
      let i = this._find(a) + 1;
      while (i < this.pts.length && this.pts[i].s < b) { push(this.pts[i], sOff, hOff); i++; }
      const pb = this.poseAt(b); if (b >= this.len - 1e-9) { const L = this.pts[this.pts.length - 1]; push(L, sOff, hOff); } else push({ ...pb, s: b }, sOff, hOff);
    };
    if (sB <= this.len + 1e-9) segment(sA, Math.min(sB, this.len), 0, 0);
    else {
      segment(sA, this.len, 0, 0);
      const last = out.pop();
      const hw = this.pts[this.pts.length - 1].h - this.pts[0].h;
      segment(0, sB - this.len, this.len, hw);
      if (out.length > 1 && Math.abs(out[1].s - last.s) < 1e-6) {} // continuity
    }
    // ensure strictly increasing s
    const clean = [out[0]];
    for (let i = 1; i < out.length; i++) if (out[i].s > clean[clean.length - 1].s + 1e-4) clean.push(out[i]);
    return clean;
  }
  build(profile) {
    const opt = this.opt;
    const cuts = this.cuts.slice().sort((a, b) => a.s - b.s);
    const segs = [];
    if (this.loop) {
      for (let i = 0; i < cuts.length; i++) {
        const a = cuts[i], b = cuts[(i + 1) % cuts.length];
        const sB = b.s > a.s ? b.s : b.s + this.len;
        segs.push({ s0: a.s, s1: sB, na: a.node, nb: b.node });
      }
    } else {
      const all = [{ s: 0, node: this.startNode || NET.node() }, ...cuts, { s: this.len, node: this.endNode || NET.node() }];
      this.startNode = all[0].node; this.endNode = all[all.length - 1].node;
      for (let i = 0; i < all.length - 1; i++) segs.push({ s0: all[i].s, s1: all[i + 1].s, na: all[i].node, nb: all[i + 1].node });
    }
    for (const sg of segs) {
      const pts = this.slice(sg.s0, sg.s1);
      const local = R => (R || []).map(b => [b[0] - sg.s0, b[1] - sg.s0]).filter(b => b[1] > 0 && b[0] < sg.s1 - sg.s0);
      const limit = opt.limitAt ? opt.limitAt((sg.s0 + sg.s1) / 2) : opt.limit;
      const e = NET.edge(pts, { kind: opt.kind, name: this.name, limit, cant: opt.cant, bridges: local(opt.bridges), tunnels: local(opt.tunnels) });
      e.line = this; e.lineS0 = sg.s0;
      e.setProfile((s, X, N) => profile(sg.s0 + s, X, N));
      NET.attach(e, 0, sg.na); NET.attach(e, 1, sg.nb);
      this.edges.push(e);
      if (!this.map.has(sg.na)) this.map.set(sg.na, {}); this.map.get(sg.na).after = { edge: e, end: 0 };
      if (!this.map.has(sg.nb)) this.map.set(sg.nb, {}); this.map.get(sg.nb).before = { edge: e, end: 1 };
    }
    return this;
  }
  before(node) { return this.map.get(node).before; }
  after(node) { return this.map.get(node).after; }
  first() { return { edge: this.edges[0], end: 0 }; }
  last() { return { edge: this.edges[this.edges.length - 1], end: 1 }; }
  /* edge + local s for a line distance */
  locate(s) {
    if (this.loop) s = ((s % this.len) + this.len) % this.len;
    for (const e of this.edges) {
      let ls = s - e.lineS0; if (this.loop && ls < 0) ls += this.len;
      if (ls >= -1e-6 && ls <= e.len + 1e-6) return { edge: e, s: clamp(ls, 0, e.len) };
    }
    return { edge: this.edges[0], s: 0 };
  }
}

function buildRoute() {
  const R_CURVE = 1200, LS = 160, LSOUTH = 7200, X0 = -3600;
  /* ---------- mainline loop ---------- */
  const pb = new PathBuilder(X0, 0, 0);
  pb.straight(LSOUTH);                          // south tangent, eastbound
  const sC1 = pb.s; pb.curve(R_CURVE, 180, LS); // east curve
  const sNorth = pb.s, xNorthStart = pb.X;
  const LA = 2500; pb.straight(LA);            // Kenton tangent, westbound
  const sJog = pb.s, xJ0 = pb.X;
  pb.curve(-1500, 6, 80); pb.straight(320); pb.curve(1500, 6, 80); pb.straight(260);
  pb.curve(1500, 6, 80); pb.straight(320); pb.curve(-1500, 6, 80);
  const jogX = xJ0 - pb.X, sJogEnd = pb.s;
  const LB = LSOUTH - LA - jogX; pb.straight(LB);
  /* ---------- the Van Wert extension ----------
     Past Delphos the line runs on west instead of turning back: across the moraine and a long reverse curve
     to Middle Point, over the Little Auglaize at Van Wert, round the far curve and back east through
     Willshire and Spencerville to the west end of Bellevue Yard. Both sides shift 378 m by the same reverse
     curve and run the same distance, so the loop still closes on itself. */
  const sC2 = pb.s;                              // Delphos: where the old west curve began
  const vwJog = sg => { pb.curve(-sg * 2000, 12, 120); pb.straight(1400); pb.curve(sg * 2000, 12, 120); };
  const XN1 = 3000, XN2 = 7800, XS1 = 6200, XS2 = XN1 + XN2 - XS1;
  pb.straight(XN1); const sVJ1 = pb.s; vwJog(1); const sVJ1e = pb.s;
  pb.straight(XN2); const sC3 = pb.s; pb.curve(R_CURVE, 180, LS);
  const sSouthW = pb.s;
  pb.straight(XS1); const sVJ2 = pb.s; vwJog(1); const sVJ2e = pb.s;
  pb.straight(XS2);
  // close loop exactly
  const L0 = pb.pts[0], LE = pb.pts[pb.pts.length - 1];
  const ex = LE.X - L0.X, en = LE.N - L0.N, n = pb.pts.length;
  for (let i = 0; i < n; i++) { const t = i / (n - 1); pb.pts[i].X -= ex * t * t; pb.pts[i].N -= en * t * t; }
  const main = new Line('Main', pb.pts, { kind: 'main', loop: true, limit: 70 });
  ROUTE.mainLen = main.len;
  // the detailed country reaches out past the far curve; it is too big to build whole, so its terrain is
  // made as the camera comes near and let go behind it
  if (typeof INNER !== 'undefined') INNER.x0 = Math.floor((Math.min(...pb.pts.map(p => p.X)) - 3000) / 1500) * 1500;
  if (typeof WORLD !== 'undefined') WORLD.lazy = true;
  ROUTE.features = { sC1, sNorth, sJog, sJogEnd, sC2, sVJ1, sVJ1e, sC3, sSouthW, sVJ2, sVJ2e, LSOUTH };

  /* ---------- main profile: Kenton Hill, and the moraine the extension crosses twice ---------- */
  // the moraine's crest runs north and south at X = MORAINE.X; each side climbs 0.62% to it and down again
  const mN = sVJ1e + 1100, mS = sVJ2 + 500;
  const grades = [[0, 0], [sNorth + 300, 0.009], [sNorth + 1800, 0], [sJog + 60, -0.0088], [sJog + 60 + 1530, 0],
    [mN - 1400, 0.0062], [mN, -0.0062], [mN + 1400, 0], [mS - 1400, 0.0062], [mS, -0.0062], [mS + 1400, 0]];
  const MY = new Float32Array(Math.ceil(main.len) + 2);
  const gAt = s => { let g = 0; for (let i = 0; i < grades.length; i++) { const w = smooth(grades[i][0] - 90, grades[i][0] + 90, s); if (i === 0) g = grades[0][1]; else g = lerp(g, grades[i][1], w); } return g; };
  let y = 0; for (let i = 0; i < MY.length; i++) { MY[i] = y; y += gAt(i + 0.5); }
  const drift = MY[Math.floor(main.len)];
  for (let i = 0; i < MY.length; i++) MY[i] -= drift * (i / main.len) * smooth(sJog + 1400, sJog + 2200, i);
  const mainY = s => { s = ((s % main.len) + main.len) % main.len; const i = Math.floor(s), t = s - i; return lerp(MY[i], MY[Math.min(i + 1, MY.length - 1)], t); };
  ROUTE.mainY = mainY;
  /* project a plan point onto a straight portion of main near reference s */
  const projMain = (sRef) => { const p = main.poseAt(sRef); const c = Math.cos(p.h), sn = Math.sin(p.h); return (X, N) => sRef + (X - p.X) * c + (N - p.N) * sn; };

  const sBridge = sJogEnd + 460; // two 64 m through truss spans
  // the Little Auglaize at Van Wert, on the far side of the extension (the river is laid to pass under it)
  const sBridge2 = sVJ1e + (main.poseAt(sVJ1e).X - VW.riverX);
  main.opt.bridges = [[sBridge - 72, sBridge + 72], [sBridge2 - 72, sBridge2 + 72]];
  ROUTE.bridge = { s: sBridge, half: 64 };
  ROUTE.bridges = [ROUTE.bridge, { s: sBridge2, half: 64, name: 'NICKEL PLATE · LITTLE AUGLAIZE' }];
  { const p = main.poseAt(sBridge2); VW.riverN = p.N; }

  /* ---------- the second main track ----------
     Track 2 runs 4.5 m inside track 1 (the original main) all the way round. Right-hand running: track 1
     carries eastward (+s) trains and track 2 westward ones. to2 / to1 carry a distance from one to the other. */
  const DT = 4.5;
  const p2 = offsetPts(main.pts, DT);
  const main2 = new Line('Main 2', p2, { kind: 'main', loop: true, limit: 70 });
  const remap = (A, B, L) => s => {
    s = ((s % L) + L) % L;
    let lo = 0, hi = A.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (A[m] <= s) lo = m; else hi = m; }
    return B[lo] + (B[hi] - B[lo]) * (s - A[lo]) / ((A[hi] - A[lo]) || 1);
  };
  const S1 = main.pts.map(p => p.s), S2 = p2.map(p => p.s);
  const to2 = remap(S1, S2, main.len), to1 = remap(S2, S1, main2.len);
  main2.opt.bridges = main.opt.bridges.map(b => b.map(to2));
  ROUTE.main2 = main2; ROUTE.to2 = to2; ROUTE.to1 = to1; ROUTE.spacing = DT;

  /* helper: a diverging line from a main node */
  const div = (name, s, off, R, straightLen, back = true, opt = {}, from = main) => {
    const p = from.poseAt(s);
    const b = new PathBuilder(p.X, p.N, p.h);
    const j = b.jog(off, R);
    b.straight(straightLen);
    if (back) b.jog(-off, R);
    return { line: new Line(name, b.pts, opt), proj: j, total: back ? 2 * j + straightLen : j + straightLen };
  };

  /* ---------- Bellevue Yard (south side of main) ---------- */
  const sW1 = 500, YL = 1180, RY = 180, OFF = -4.5, gap = 26;
  const jl = jogLen(4.5, RY);
  const nW1 = main.cut(sW1), nE1 = main.cut(sW1 + YL);
  const yardProf = projMain(sW1 + YL / 2);
  const yards = [];
  {
    const y1 = div('Yard 1', sW1, OFF, RY, YL - 2 * jl, true, { kind: 'yard', limit: 15, startNode: nW1, endNode: nE1 });
    yards.push(y1.line);
    const arcJ0 = 2 * RY * Math.acos(1 - 4.5 / (2 * RY));   // path length of one jog
    let prev = y1.line;
    for (let k = 2; k <= 4; k++) {
      // staircase ladder: each track branches off the previous one just past its own jog
      const localW = arcJ0 + gap, localE = prev.len - arcJ0 - gap;
      const p = prev.poseAt(localW), pe = prev.poseAt(localE);
      const nW = prev.cut(localW), nE = prev.cut(localE);
      const dx = (pe.X - p.X) * Math.cos(p.h) + (pe.N - p.N) * Math.sin(p.h);
      const b2 = new PathBuilder(p.X, p.N, p.h); b2.jog(OFF, RY); b2.straight(dx - 2 * jl); b2.jog(-OFF, RY);
      const ln = new Line('Yard ' + k, b2.pts, { kind: 'yard', limit: 15, startNode: nW, endNode: nE });
      yards.push(ln);
      prev = ln;
    }
  }
  // engine service track off Yard 4
  const y4 = yards[3];
  const arcJ = 2 * RY * Math.acos(1 - 4.5 / (2 * RY));
  const sEN = arcJ + 30;
  const nEN = y4.cut(sEN);
  const pEN = y4.poseAt(sEN);
  const be = new PathBuilder(pEN.X, pEN.N, pEN.h); be.jog(2 * OFF, RY); be.straight(400);
  const eng = new Line('Engine Track', be.pts, { kind: 'yard', limit: 10, startNode: nEN });
  ROUTE.features.engine = eng;

  /* ---------- Fostoria passing siding (north side, off track 2) + elevator spur ---------- */
  const sF1 = 3150, FL = 2650, RS = 235;
  const nF1 = main2.cut(to2(sF1)), nF2 = main2.cut(to2(sF1 + FL));
  const jS = jogLen(4.5, RS);
  const fos = div('Fostoria Siding', to2(sF1), 4.5, RS, FL - 2 * jS, true, { kind: 'siding', limit: 30, startNode: nF1, endNode: nF2 }, main2);
  const fosProf = projMain(sF1 + FL / 2);
  const sFE = 1350;
  const nFE = fos.line.cut(sFE);
  const pFE = fos.line.poseAt(sFE);
  const bs = new PathBuilder(pFE.X, pFE.N, pFE.h); bs.jog(4.5, RY); bs.straight(330);
  const spur = new Line('Elevator Track', bs.pts, { kind: 'yard', limit: 10, startNode: nFE });

  /* ---------- Kenton siding (north side of westbound main) ---------- */
  const sK1 = sNorth + 900, KL = 1400;
  const nK1 = main.cut(sK1), nK2 = main.cut(sK1 + KL);
  const ken = div('Kenton Siding', sK1, -4.5, RS, KL - 2 * jS, true, { kind: 'siding', limit: 30, startNode: nK1, endNode: nK2 });
  const kenProf = projMain(sK1 + KL / 2);

  /* ---------- industry spurs ----------
     Kenton Coal & Feed off the Kenton siding, and the Delphos Oil bulk plant off track 1, both on the outside of
     the loop. Each trails for a train working round on track 1 (+s): it pulls by the switch and backs its cars
     in, with no runaround. So a spur leaves its switch heading back down the line (-s). */
  const backSpur = (name, from, s, len) => {
    const p = from.poseAt(s), node = from.cut(s);
    const b = new PathBuilder(p.X, p.N, p.h + Math.PI); b.jog(4.5, RY); b.straight(len);
    return { line: new Line(name, b.pts, { kind: 'yard', limit: 10, startNode: node }), node, from };
  };
  const kSp = backSpur('Kenton Spur', ken.line, 1250, 300);
  const sDel = 17950, dSp = backSpur('Delphos Spur', main, sDel, 300);
  const delProf = projMain(sDel - 180);

  /* ---------- Quarry branch ---------- */
  const sBR = sBridge + 900;
  const nBR = main.cut(sBR);
  const pBR = main.poseAt(sBR);
  const bb = new PathBuilder(pBR.X, pBR.N, pBR.h);
  bb.jog(-4.5, RS); bb.straight(40);
  const sBrCurve = bb.s; bb.curve(-420, 90, 70);
  const sBrStraight = bb.s; bb.straight(2900);
  const sQ1 = bb.s - 620; bb.straight(330);
  const branch = new Line('Quarry Branch', bb.pts, { kind: 'branch', limit: 35, startNode: nBR });
  const brY = s => { // smoothed 0.62% grade
    const a = 900, b = 2400, g = 0.0062, v = 150;
    const ramp = x => x <= -v ? 0 : x >= v ? x : (x + v) * (x + v) / (4 * v);
    return g * (ramp(s - a) - ramp(s - b));
  };
  const nQ1 = branch.cut(sQ1), sQ2 = sQ1 + 470, nQ2 = branch.cut(sQ2);
  const pQ = branch.poseAt(sQ1);
  const jQ = jogLen(4.5, RY);
  const bq = new PathBuilder(pQ.X, pQ.N, pQ.h); bq.jog(-4.5, RY); bq.straight(470 - 2 * jQ); bq.jog(4.5, RY);
  const run = new Line('Quarry Runaround', bq.pts, { kind: 'yard', limit: 10, startNode: nQ1, endNode: nQ2 });
  const sQS = arcJ + 22, nQS = run.cut(sQS), pQS = run.poseAt(sQS);
  const bst = new PathBuilder(pQS.X, pQS.N, pQS.h); bst.jog(-4.5, RY); bst.straight(300);
  const stub = new Line('Quarry Storage', bst.pts, { kind: 'yard', limit: 10, startNode: nQS });
  const brProj = (X, N) => { const p0 = branch.poseAt(sBrStraight); return sBrStraight + (N - p0.N); };

  /* ---------- Van Wert and Spencerville passing sidings (inside, off track 2, like Fostoria's) ---------- */
  const xS = (X0, sRef) => sRef + Math.abs(main.poseAt(sRef).X - X0);   // the main distance at X along a straight from sRef
  const sVW1 = xS(-13620, sVJ1e), VWL = 2200, sSP1 = xS(-7600, sVJ2e), SPL = 2200;
  const passing = (name, s1, L) => {
    const n1 = main2.cut(to2(s1)), n2 = main2.cut(to2(s1 + L));
    const d = div(name + ' Siding', to2(s1), 4.5, RS, L - 2 * jS, true, { kind: 'siding', limit: 30, startNode: n1, endNode: n2 }, main2);
    return { line: d.line, n1, n2, prof: projMain(s1 + L / 2), name };
  };
  const vws = passing('Van Wert', sVW1, VWL), sps = passing('Spencerville', sSP1, SPL);
  ROUTE.features.sVW1 = sVW1; ROUTE.features.sSP1 = sSP1;

  /* ---------- crossovers between the main tracks ----------
     At each place, A takes an eastward train from track 1 over to track 2 and B, just beyond, brings a
     train back. Both are on tangent track, where a distance on one main maps straight across to the other. */
  const XR = 235, xl = jogLen(DT, XR), xos = [];
  const crossover = (name, s, up) => {
    const from = up ? main : main2, to = up ? main2 : main, s0 = up ? s : to2(s);
    const p = from.poseAt(s0), b = new PathBuilder(p.X, p.N, p.h); b.jog(up ? DT : -DT, XR);
    const nA = from.cut(s0), nB = to.cut(up ? to2(s + xl) : s + xl);
    xos.push({ line: new Line(name, b.pts, { kind: 'main', limit: 30, cant: false, startNode: nA, endNode: nB }), from, to, nA, nB, prof: projMain(s + xl / 2) });
  };
  for (const [place, s] of [['Bellevue', 2150], ['Fostoria', 6100], ['Kenton', 11650], ['Delphos', 17000], ['Van Wert', xS(-12450, sVJ1e)], ['Spencerville', xS(-4950, sVJ2e)]]) {
    crossover(place + ' crossover A', s, true); crossover(place + ' crossover B', s + 150, false);
  }

  /* ---------- build edges ---------- */
  main.build(s => mainY(s));
  main2.build(s => mainY(to1(s)));
  for (const x of xos) x.line.build((s, X, N) => mainY(x.prof(X, N)));
  yards.forEach(l => l.build((s, X, N) => mainY(yardProf(X, N))));
  eng.build((s, X, N) => mainY(yardProf(X, N)));
  fos.line.build((s, X, N) => mainY(fosProf(X, N)));
  spur.build((s, X, N) => mainY(fosProf(X, N)));
  ken.line.build((s, X, N) => mainY(kenProf(X, N)));
  kSp.line.build((s, X, N) => mainY(kenProf(X, N)));
  dSp.line.build((s, X, N) => mainY(delProf(X, N)));
  for (const p of [vws, sps]) p.line.build((s, X, N) => mainY(p.prof(X, N)));
  branch.build((s) => brY(s));
  run.build((s, X, N) => brY(brProj(X, N)));
  stub.build((s, X, N) => brY(brProj(X, N)));

  /* ---------- switches ---------- */
  const SW = (name, node, line, divLine, atStart, legNames) => {
    // line: the through track the node sits on; divLine: diverging line starting (atStart) or ending at node
    const lm = line.map.get(node);
    const div = atStart ? divLine.first() : divLine.last();
    const facingFromBefore = atStart; // diverging line leaves toward 'after'
    const trunk = facingFromBefore ? lm.before : lm.after;
    const normal = facingFromBefore ? lm.after : lm.before;
    return NET.addSwitch(node, trunk, normal, div, name, legNames);
  };
  SW('Bellevue West', nW1, main, yards[0], true, ['Main', 'Yard 1']);
  SW('Bellevue East', nE1, main, yards[0], false, ['Main', 'Yard 1']);
  for (let k = 1; k < 4; k++) {
    SW('Yard ladder W' + (k + 1), yards[k].startNode, yards[k - 1], yards[k], true, ['Yard ' + k, 'Yard ' + (k + 1)]);
    SW('Yard ladder E' + (k + 1), yards[k].endNode, yards[k - 1], yards[k], false, ['Yard ' + k, 'Yard ' + (k + 1)]);
  }
  SW('Engine Terminal', nEN, y4, eng, true, ['Yard 4', 'Engine track']);
  SW('Fostoria West', nF1, main2, fos.line, true, ['Main', 'Siding']);
  SW('Fostoria East', nF2, main2, fos.line, false, ['Main', 'Siding']);
  SW('Elevator', nFE, fos.line, spur, true, ['Siding', 'Elevator']);
  SW('Kenton East', nK1, main, ken.line, true, ['Main', 'Siding']);
  SW('Kenton West', nK2, main, ken.line, false, ['Main', 'Siding']);
  SW('Quarry Jct', nBR, main, branch, true, ['Main', 'Branch']);
  SW('Quarry South', nQ1, branch, run, true, ['Branch', 'Runaround']);
  SW('Quarry North', nQ2, branch, run, false, ['Branch', 'Runaround']);
  SW('Storage', nQS, run, stub, true, ['Runaround', 'Storage']);
  // the spurs leave toward the line's 'before' side, so the trunk is the track beyond the switch
  for (const [sp, legs] of [[kSp, ['Siding', 'Spur']], [dSp, ['Main', 'Spur']]]) {
    const lm = sp.from.map.get(sp.node);
    NET.addSwitch(sp.node, lm.after, lm.before, sp.line.first(), sp.line.name, legs).industry = true;
  }
  for (const p of [vws, sps]) { SW(p.name + ' West', p.n1, main2, p.line, true, ['Main', 'Siding']); SW(p.name + ' East', p.n2, main2, p.line, false, ['Main', 'Siding']); }
  // the two switches of a crossover are thrown together
  for (const x of xos) {
    const a = SW(x.line.name, x.nA, x.from, x.line, true, [x.from === main ? 'Track 1' : 'Track 2', 'Crossover']);
    const b = SW(x.line.name, x.nB, x.to, x.line, false, [x.to === main ? 'Track 1' : 'Track 2', 'Crossover']);
    a.mate = b; b.mate = a;
  }
  // turnout speed by radius
  for (const sw of NET.switches) { const dk = sw.legs[1].edge.kind; sw.divLimit = (dk === 'siding' || dk === 'branch' || dk === 'main') ? 30 : 15; }

  /* ---------- dead ends ---------- */
  for (const nd of NET.nodes) if (nd.att.length === 1) ROUTE.bumpers.push(nd);

  /* ---------- stations, water, signals ---------- */
  // a depot on the inside of the loop stands beyond track 2 (across: the extra distance out)
  const st = (name, line, s, side, kind, across = 0) => { const loc = line.locate(s); ROUTE.stations.push({ name, line, sLine: s, edge: loc.edge, s: loc.s, side, kind, across }); };
  st('Bellevue', main, sW1 + 620, -1, 'depot', DT);
  st('Fostoria', main, sF1 + 1250, 1, 'depot');
  st('Kenton', main, sK1 + 700, -1, 'depot', DT);
  st('Delphos', main, sBR + 1500, -1, 'small', DT);
  st('Middle Point', main, xS(-11750, sVJ1e), -1, 'small', DT);
  st('Van Wert', main, sVW1 + 700, 1, 'depot');
  st('Willshire', main, xS(-14650, sSouthW), 1, 'small');
  st('Spencerville', main, sSP1 + 1150, 1, 'depot');
  st('Quarry', branch, branch.len - 40, 1, 'quarry');
  const wc = (line, s, side, kind) => { const loc = line.locate(s); ROUTE.water.push({ line, sLine: s, edge: loc.edge, s: loc.s, side, kind }); };
  wc(main, sF1 + 1450, 1, 'column');
  wc(main2, to2(sK1 + 940), -1, 'column');
  wc(main, sVW1 + 1050, 1, 'column');
  wc(eng, 150, 1, 'tower');
  ROUTE.coal = { line: eng, sLine: 235, edge: eng.locate(235).edge, s: eng.locate(235).s };
  /* Signals. Track 1 is signalled for eastward running and track 2 for westward, as double track was in
     the 1940s: a home signal on the approach to each place with switches on that track, automatic block
     signals between. Dwarfs govern moves off the sidings, Yard 1 and the quarry branch onto the main. */
  const sig = (line, sLine, dir, kind = 'mast') => ROUTE.signals.push({ line, sLine, dir, kind });
  for (const s of [340, 3500, 5940, 8700, 11490, 14000, 16678, 19500]) sig(main, s, 1);
  for (const s of [2460, 6410, 9000, 11960, 14600, 17310, 20100]) sig(main2, to2(s), -1);
  /* The extension: a home signal 350 m short of each place with switches on that track, automatics between
     so no block runs much over 2.7 km. Between the last old signal each way and the next one round the loop
     (sA..sB in track 1 distance, sB past the end of the loop for the ones beyond Bellevue). */
  const sOf = (ln, nd) => { const c = ln.cuts.find(c => c.node === nd); return ln === main ? c.s : to1(c.s); };
  const extSignals = (ln, dir, sA, sB, nodes, avoid = []) => {
    const L = main.len, sw = nodes.map(nd => { const v = sOf(ln, nd); return v < sA ? v + L : v; }).filter(v => v > sA && v < sB).sort((p, q) => p - q);
    const fixed = [sA, sB];
    for (let i = 0; i < sw.length; i++) {
      // a cluster's first switch in the direction of travel
      if (dir > 0 && (i === 0 || sw[i] - sw[i - 1] > 600)) fixed.push(sw[i] - 350);
      if (dir < 0 && (i === sw.length - 1 || sw[i + 1] - sw[i] > 600)) fixed.push(sw[i] + 350);
    }
    fixed.sort((p, q) => p - q);
    const out = fixed.slice(1, -1);
    for (let i = 0; i < fixed.length - 1; i++) { const g = fixed[i + 1] - fixed[i], n = Math.ceil(g / 2700); for (let k = 1; k < n; k++) out.push(fixed[i] + g * k / n); }
    // never on a bridge, nor beside a siding on the signal's own side: those step on past it
    return out.map(v => {
      for (const b of main.opt.bridges) if (v > b[0] - 15 && v < b[1] + 15) v = dir > 0 ? b[0] - 15 : b[1] + 15;
      for (const [lo, hi] of avoid) if (v > lo - 60 && v < hi + 60) v = dir > 0 ? hi + 60 : lo - 60;
      return v % L;
    }).sort((p, q) => p - q);
  };
  const xNodes = ln => xos.flatMap(x => [x.from === ln ? x.nA : null, x.to === ln ? x.nB : null]).filter(Boolean);
  for (const s of extSignals(main, 1, 19500, main.len + 340, xNodes(main))) sig(main, s, 1);
  for (const s of extSignals(main2, -1, 20100, main.len + 2460, [...xNodes(main2), vws.n1, vws.n2, sps.n1, sps.n2], [[sVW1, sVW1 + VWL], [sSP1, sSP1 + SPL]])) sig(main2, to2(s), -1);
  for (const [ln, at, dir] of [[fos.line, 110, -1], [fos.line, -110, 1], [ken.line, 110, -1], [ken.line, -110, 1], [yards[0], 78, -1], [yards[0], -78, 1], [branch, 150, -1], [vws.line, 110, -1], [vws.line, -110, 1], [sps.line, 110, -1], [sps.line, -110, 1]]) sig(ln, at < 0 ? ln.len + at : at, dir, 'dwarf');
  // mileposts
  for (let m = 1; m * MILE < main.len; m++) ROUTE.mileposts.push({ line: main, sLine: m * MILE, num: 101 + m });
  ROUTE.main = main; ROUTE.branch = branch; ROUTE.crossovers = xos.map(x => x.line);
  ROUTE.startLine = yards[1]; // train starts on Yard 2
  ROUTE.startS = 260;
}

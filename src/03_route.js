/* ============================================================================
   The railroad: Nickel Plate–style division with a mainline loop.
   South tangent 7,200 m (Bellevue Yard, Fostoria), east curve, north side
   over Kenton Hill and the Sandusky River bridge, quarry branch, west curve.
   ========================================================================== */
const NET = new Network();
const ROUTE = { lines: {}, stations: [], water: [], signals: [], crossings: [], mileposts: [], bumpers: [], features: {} };

/* A Line is a continuous builder path that gets cut into edges at nodes. */
class Line {
  constructor(name, pts, opt = {}) {
    this.name = name; this.pts = pts; this.opt = opt; this.cuts = []; this.loop = !!opt.loop;
    this.len = pts[pts.length - 1].s; this.startNode = opt.startNode || null; this.endNode = opt.endNode || null;
    this.edges = []; this.map = new Map();
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
      const bridges = (opt.bridges || []).map(b => [b[0] - sg.s0, b[1] - sg.s0]).filter(b => b[1] > 0 && b[0] < sg.s1 - sg.s0);
      const e = NET.edge(pts, { kind: opt.kind, name: this.name, limit: opt.limit, bridges });
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
  const sC2 = pb.s; pb.curve(R_CURVE, 180, LS);
  // close loop exactly
  const L0 = pb.pts[0], LE = pb.pts[pb.pts.length - 1];
  const ex = LE.X - L0.X, en = LE.N - L0.N, n = pb.pts.length;
  for (let i = 0; i < n; i++) { const t = i / (n - 1); pb.pts[i].X -= ex * t * t; pb.pts[i].N -= en * t * t; }
  const main = new Line('Main', pb.pts, { kind: 'main', loop: true, limit: 70 });
  ROUTE.mainLen = main.len;
  ROUTE.features = { sC1, sNorth, sJog, sJogEnd, sC2, LSOUTH };

  /* ---------- main profile: Kenton Hill ---------- */
  const grades = [[0, 0], [sNorth + 300, 0.009], [sNorth + 1800, 0], [sJog + 60, -0.0088], [sJog + 60 + 1530, 0]];
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
  main.opt.bridges = [[sBridge - 72, sBridge + 72]];
  ROUTE.bridge = { s: sBridge, half: 64 };

  /* helper: a diverging line from a main node */
  const div = (name, s, off, R, straightLen, back = true, opt = {}) => {
    const p = main.poseAt(s);
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

  /* ---------- Fostoria passing siding (north side) + elevator spur ---------- */
  const sF1 = 3150, FL = 2650, RS = 235;
  const nF1 = main.cut(sF1), nF2 = main.cut(sF1 + FL);
  const jS = jogLen(4.5, RS);
  const fos = div('Fostoria Siding', sF1, 4.5, RS, FL - 2 * jS, true, { kind: 'siding', limit: 30, startNode: nF1, endNode: nF2 });
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

  /* ---------- build edges ---------- */
  main.build(s => mainY(s));
  yards.forEach(l => l.build((s, X, N) => mainY(yardProf(X, N))));
  eng.build((s, X, N) => mainY(yardProf(X, N)));
  fos.line.build((s, X, N) => mainY(fosProf(X, N)));
  spur.build((s, X, N) => mainY(fosProf(X, N)));
  ken.line.build((s, X, N) => mainY(kenProf(X, N)));
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
  SW('Fostoria West', nF1, main, fos.line, true, ['Main', 'Siding']);
  SW('Fostoria East', nF2, main, fos.line, false, ['Main', 'Siding']);
  SW('Elevator', nFE, fos.line, spur, true, ['Siding', 'Elevator']);
  SW('Kenton East', nK1, main, ken.line, true, ['Main', 'Siding']);
  SW('Kenton West', nK2, main, ken.line, false, ['Main', 'Siding']);
  SW('Quarry Jct', nBR, main, branch, true, ['Main', 'Branch']);
  SW('Quarry South', nQ1, branch, run, true, ['Branch', 'Runaround']);
  SW('Quarry North', nQ2, branch, run, false, ['Branch', 'Runaround']);
  SW('Storage', nQS, run, stub, true, ['Runaround', 'Storage']);
  // turnout speed by radius
  for (const sw of NET.switches) { const dk = sw.legs[1].edge.kind; sw.divLimit = (dk === 'siding' || dk === 'branch') ? 30 : 15; }

  /* ---------- dead ends ---------- */
  for (const nd of NET.nodes) if (nd.att.length === 1) ROUTE.bumpers.push(nd);

  /* ---------- stations, water, signals ---------- */
  const st = (name, line, s, side, kind) => { const loc = line.locate(s); ROUTE.stations.push({ name, line, sLine: s, edge: loc.edge, s: loc.s, side, kind }); };
  st('Bellevue', main, sW1 + 620, -1, 'depot');
  st('Fostoria', main, sF1 + 1250, 1, 'depot');
  st('Kenton', main, sK1 + 700, -1, 'depot');
  st('Delphos', main, sBR + 1500, -1, 'small');
  st('Quarry', branch, branch.len - 40, 1, 'quarry');
  const wc = (line, s, side, kind) => { const loc = line.locate(s); ROUTE.water.push({ line, sLine: s, edge: loc.edge, s: loc.s, side, kind }); };
  wc(main, sF1 + 1450, 1, 'column');
  wc(main, sK1 + 940, -1, 'column');
  wc(eng, 150, 1, 'tower');
  ROUTE.coal = { line: eng, sLine: 235, edge: eng.locate(235).edge, s: eng.locate(235).s };
  // signals protecting facing-point main switches
  const sig = (sw, line, sNode, dir) => ROUTE.signals.push({ sw, line, sLine: sNode - dir * 160, dir });
  sig(NET.switches[0], main, sW1, 1); sig(NET.switches[1], main, sW1 + YL, -1);
  const fsw = NET.switches.find(s => s.name === 'Fostoria West'), fsw2 = NET.switches.find(s => s.name === 'Fostoria East');
  sig(fsw, main, sF1, 1); sig(fsw2, main, sF1 + FL, -1);
  const k1 = NET.switches.find(s => s.name === 'Kenton East'), k2 = NET.switches.find(s => s.name === 'Kenton West');
  sig(k1, main, sK1, 1); sig(k2, main, sK1 + KL, -1);
  sig(NET.switches.find(s => s.name === 'Quarry Jct'), main, sBR, 1);
  // mileposts
  for (let m = 1; m * MILE < main.len; m++) ROUTE.mileposts.push({ line: main, sLine: m * MILE, num: 101 + m });
  ROUTE.main = main; ROUTE.branch = branch;
  ROUTE.startLine = yards[1]; // train starts on Yard 2
  ROUTE.startS = 260;
}

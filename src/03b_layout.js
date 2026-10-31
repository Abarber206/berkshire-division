/* ============================================================================
   Custom layouts: a catalogue of track pieces with exact endpoints, the joint
   finder the editor and the game share, and building the track network from a
   layout drawn in the editor.

   A piece is placed by its origin (X, N, h): the A end, heading into the piece.
   Every piece is generated from that pose with PathBuilder, so an end computed
   in the editor is the same number the network is built from. Two ends join
   when they sit on the same point facing each other; the snapping in the editor
   copies the exact pose of the end it attaches to, so joints are flush.
   ========================================================================== */
const LAYOUT = {
  bounds: { x0: -5400, x1: 5400, n0: -1400, n1: 6400 },   // inside the detailed terrain
  joinTol: 0.05, joinAng: 0.01,                           // m, rad: what counts as joined
  gapTol: 3,                                              // ends closer than this but not joined are reported
  minFlexR: 100,                                          // tightest join curve allowed
  lead: 4.0,                                              // stock rail ahead of the points on a turnout
};
const TURNOUTS = {
  yard: { name: 'Yard turnout', sub: '15° · R 180 m', R: 180, deg: 15, lim: 15 },
  main: { name: 'Main turnout', sub: '7.5° · R 400 m', R: 400, deg: 7.5, lim: 30 },
  par:  { name: 'Siding turnout', sub: 'Parallel at 4.5 m', R: 235, off: 4.5, lim: 30 },
};
const STRAIGHTS = [25, 50, 100, 200];
const DOUBLE = 4.5;   // m between the two tracks of double track, as the siding turnout lays them
const XOVER = { R: 235, lead: 4, lim: 30 };   // crossover: a reverse curve between two tracks DOUBLE apart
/* which side a station platform stands: on double track always outside the pair */
const stSide = p => p.dbl ? (p.dbl > 0 ? 1 : -1) : (p.st.side || 1);
const pieceExt = p => p.t === 'turnout' ? 3 : p.t === 'xover' || p.dbl ? 4 : 2;   // external ends
const CURVE_R = [180, 300, 500, 800, 1200];
const CURVE_DEG = [7.5, 15, 30, 45];
const wrapPi = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

/* paths and ends of a piece in world plan coordinates
   ports[i] = { X, N, h } with h the outward heading (leaving the piece)
   paths[j] = { pts, a, b }: point list from port a to port b              */
function pieceGeom(p) {
  const P0 = { X: p.X, N: p.N, h: p.h };
  const run = (pose, fn) => { const b = new PathBuilder(pose.X, pose.N, pose.h); fn(b); return b; };
  const start = { X: P0.X, N: P0.N, h: P0.h + Math.PI };
  const endOf = b => ({ X: b.X, N: b.N, h: b.h });
  if (p.t === 'straight' || p.t === 'curve') {
    const b = run(P0, b => p.t === 'straight' ? b.straight(p.L) : b.arc(p.dir * p.R, p.deg));
    const g = { ports: [start, endOf(b)], paths: [{ pts: b.pts, a: 0, b: 1, R: p.t === 'curve' ? p.R : 0 }] };
    if (p.dbl) {   // double track: a second track DOUBLE m to the dbl side, concentric on a curve, ends square with the first
      const sd = p.dbl > 0 ? 1 : -1, o = { X: p.X - Math.sin(p.h) * sd * DOUBLE, N: p.N + Math.cos(p.h) * sd * DOUBLE, h: p.h };
      const R2 = p.t === 'curve' ? p.R - p.dir * sd * DOUBLE : 0;
      const b2 = run(o, b => p.t === 'straight' ? b.straight(p.L) : b.arc(p.dir * R2, p.deg));
      g.ports.push({ X: o.X, N: o.N, h: o.h + Math.PI }, endOf(b2));
      g.paths.push({ pts: b2.pts, a: 2, b: 3, R: R2 });
    }
    return g;
  }
  if (p.t === 'xover') {
    /* two parallel tracks with a crossover between them: from the first track (from 0) or the second
       (from 1) the reverse curve leaves forward at one set of points and arrives at the other */
    const sd = p.side > 0 ? 1 : -1, jl = jogLen(DOUBLE, XOVER.R), L = 2 * XOVER.lead + jl;
    const o2 = { X: p.X - Math.sin(p.h) * sd * DOUBLE, N: p.N + Math.cos(p.h) * sd * DOUBLE, h: p.h };
    const f = p.from ? 1 : 0, O = [P0, o2], to = 1 - f;
    const aF = run(O[f], b => b.straight(XOVER.lead)), pF = aF.pose(), bF = run(pF, b => b.straight(L - XOVER.lead));
    const aT = run(O[to], b => b.straight(XOVER.lead + jl)), pT = aT.pose(), bT = run(pT, b => b.straight(XOVER.lead));
    const jog = run(pF, b => b.jog((f ? -sd : sd) * DOUBLE, XOVER.R));
    // ports: A1 B1 A2 B2, then the points on the from track (4) and on the to track (5)
    const A = [], B = [];
    A[f] = aF; B[f] = bF; A[to] = aT; B[to] = bT;
    const pts = [pF, pT];
    const ports = [{ X: P0.X, N: P0.N, h: P0.h + Math.PI }, endOf(B[0]), { X: o2.X, N: o2.N, h: o2.h + Math.PI }, endOf(B[1]),
      { ...pts[0], internal: true }, { ...pts[1], internal: true }];
    const pa = [0, 2][f], pb = [1, 3][f], qa = [0, 2][to], qb = [1, 3][to];
    const paths = [{ pts: aF.pts, a: pa, b: 4 }, { pts: bF.pts, a: 4, b: pb }, { pts: aT.pts, a: qa, b: 5 }, { pts: bT.pts, a: 5, b: qb }, { pts: jog.pts, a: 4, b: 5, R: XOVER.R }];
    // points on the from track face the way the piece runs; on the to track they trail
    const sws = [{ port: 4, trunk: [0, 1], normal: [1, 0], reverse: [4, 0], lim: XOVER.lim }, { port: 5, trunk: [3, 0], normal: [2, 1], reverse: [4, 1], lim: XOVER.lim }];
    return { ports, paths, sw: sws[0], sws };
  }
  if (p.t === 'turnout') {
    const T = TURNOUTS[p.k];
    const lead = run(P0, b => b.straight(LAYOUT.lead)), pts = lead.pose();
    const thruLen = T.off ? jogLen(T.off, T.R) : T.R * Math.sin(T.deg * Math.PI / 180);
    const thru = run(pts, b => b.straight(thruLen));
    const div = run(pts, b => T.off ? b.jog(p.dir * T.off, T.R) : b.arc(p.dir * T.R, T.deg));
    return {
      ports: [start, endOf(thru), endOf(div), { X: pts.X, N: pts.N, h: pts.h, internal: true }],
      paths: [{ pts: lead.pts, a: 0, b: 3 }, { pts: thru.pts, a: 3, b: 1 }, { pts: div.pts, a: 3, b: 2, R: T.R }],
      sw: { port: 3, trunk: 0, normal: 1, reverse: 2, lim: T.lim },
      sws: [{ port: 3, trunk: [0, 1], normal: [1, 0], reverse: [2, 0], lim: T.lim }],
    };
  }
  if (p.t === 'flex') {
    const f = flexPath(P0, p.b);
    return { ports: [start, { X: p.b.X, N: p.b.N, h: p.b.h }], paths: [{ pts: f.pts, a: 0, b: 1, R: f.minR }] };
  }
  return { ports: [], paths: [] };
}

/* A smooth join from pose a (heading into the join) to end b (heading out of it, i.e. the
   direction of travel on arrival). Cubic Bézier resampled by arc length. */
function flexPath(a, b) {
  const d = Math.hypot(b.X - a.X, b.N - a.N), L = d * 0.42;
  const p0 = [a.X, a.N], p1 = [a.X + Math.cos(a.h) * L, a.N + Math.sin(a.h) * L];
  const p3 = [b.X, b.N], p2 = [b.X - Math.cos(b.h) * L, b.N - Math.sin(b.h) * L];
  const at = t => { const u = 1 - t, A = u * u * u, B = 3 * u * u * t, C = 3 * u * t * t, D = t * t * t; return [A * p0[0] + B * p1[0] + C * p2[0] + D * p3[0], A * p0[1] + B * p1[1] + C * p2[1] + D * p3[1]]; };
  const tan = t => { const u = 1 - t; return [3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]), 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1])]; };
  const n = Math.max(64, Math.ceil(d * 4));
  const T = [0], S = [0]; let prev = p0;
  for (let i = 1; i <= n; i++) { const t = i / n, q = at(t); S.push(S[i - 1] + Math.hypot(q[0] - prev[0], q[1] - prev[1])); T.push(t); prev = q; }
  const total = S[n], m = Math.max(2, Math.ceil(total / 0.5));
  const pts = []; let j = 0, hPrev = a.h;
  for (let i = 0; i <= m; i++) {
    const s = total * i / m;
    while (j < n - 1 && S[j + 1] < s) j++;
    const t = lerp(T[j], T[j + 1], clamp((s - S[j]) / ((S[j + 1] - S[j]) || 1), 0, 1));
    const q = i === 0 ? p0 : i === m ? p3 : at(t), g = tan(i === 0 ? 0 : i === m ? 1 : t);
    let h = Math.atan2(g[1], g[0]); h = hPrev + wrapPi(h - hPrev); hPrev = h;
    pts.push({ X: q[0], N: q[1], h, k: 0, s });
  }
  let minR = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a2 = pts[Math.max(0, i - 1)], b2 = pts[Math.min(pts.length - 1, i + 1)];
    const k = (b2.h - a2.h) / ((b2.s - a2.s) || 1); pts[i].k = k;
    if (Math.abs(k) > 1e-9) minR = Math.min(minR, 1 / Math.abs(k));
  }
  return { pts, minR, len: total };
}

/* Place piece p so that its port j lands on end E (outward heading E.h), facing it. */
function attachPiece(p, j, E) {
  const loc = pieceGeom({ ...p, X: 0, N: 0, h: 0 }).ports[j];
  const phi = wrapPi(E.h + Math.PI - loc.h), c = Math.cos(phi), s = Math.sin(phi);
  if (j === 0) return { ...p, X: E.X, N: E.N, h: wrapPi(E.h) };   // exact: the A end is the origin
  return { ...p, X: E.X - (c * loc.X - s * loc.N), N: E.N - (s * loc.X + c * loc.N), h: phi };
}

/* Analyse a layout: every port, which ports are joined, and what is wrong with it. */
function layoutGraph(map) {
  const pieces = map.pieces.map(p => ({ p, g: pieceGeom(p) }));
  const ports = [];
  pieces.forEach((P, pi) => { P.base = ports.length; P.g.ports.forEach((q, j) => ports.push({ pi, j, X: q.X, N: q.N, h: q.h, internal: !!q.internal, mate: -1, id: ports.length })); });
  const cell = q => Math.floor(q.X / 4) + ',' + Math.floor(q.N / 4);
  const hash = new Map();
  for (const q of ports) { if (q.internal) continue; const k = cell(q); if (!hash.has(k)) hash.set(k, []); hash.get(k).push(q); }
  const near = (q, r, fn) => { const cx = Math.floor(q.X / 4), cn = Math.floor(q.N / 4), w = Math.ceil(r / 4); for (let i = cx - w; i <= cx + w; i++) for (let j = cn - w; j <= cn + w; j++) for (const o of hash.get(i + ',' + j) || []) if (o !== q) fn(o, Math.hypot(o.X - q.X, o.N - q.N)); };
  for (const q of ports) {
    if (q.internal || q.mate >= 0) continue;
    let best = null, bd = LAYOUT.joinTol;
    near(q, LAYOUT.joinTol, (o, d) => { if (o.mate >= 0 || o.pi === q.pi) return; if (Math.abs(wrapPi(o.h - q.h - Math.PI)) > LAYOUT.joinAng) return; if (d <= bd) { bd = d; best = o; } });
    if (best) { q.mate = best.id; best.mate = q.id; }
  }
  const issues = [];
  const seen = new Set();
  for (const q of ports) {
    if (q.internal || q.mate >= 0) continue;
    near(q, LAYOUT.gapTol, (o, d) => {
      if (o.mate >= 0 || o.internal || o.pi === q.pi) return;
      const key = Math.min(q.id, o.id) + ':' + Math.max(q.id, o.id); if (seen.has(key)) return; seen.add(key);
      const kink = Math.abs(wrapPi(o.h - q.h - Math.PI)) * 180 / Math.PI;
      issues.push({ kind: 'gap', X: (q.X + o.X) / 2, N: (q.N + o.N) / 2, text: d < LAYOUT.joinTol ? `Ends meet at a ${kink.toFixed(1)}° kink` : `Gap of ${d < 0.1 ? (d * 100).toFixed(1) + ' cm' : d.toFixed(2) + ' m'} between two ends`, a: q.id, b: o.id });
    });
  }
  // out of bounds and crossings (no diamonds yet)
  const B = LAYOUT.bounds;
  const segs = new Map(), segList = [];
  pieces.forEach((P, pi) => P.g.paths.forEach(path => {
    let prev = null;
    for (let i = 0; i < path.pts.length; i += 4) {
      const q = path.pts[i];
      if (q.X < B.x0 || q.X > B.x1 || q.N < B.n0 || q.N > B.n1) { if (!P.out) { P.out = true; issues.push({ kind: 'bounds', X: q.X, N: q.N, text: 'Track runs off the edge of the world', pi }); } }
      if (prev) segList.push([prev.X, prev.N, q.X, q.N, pi]);
      prev = q;
    }
    const L = path.pts[path.pts.length - 1]; if (prev && prev !== L) segList.push([prev.X, prev.N, L.X, L.N, pi]);
  }));
  for (const s of segList) { const k = Math.floor((s[0] + s[2]) / 40) + ',' + Math.floor((s[1] + s[3]) / 40); if (!segs.has(k)) segs.set(k, []); segs.get(k).push(s); }
  const adj = new Set();
  for (const q of ports) if (q.mate >= 0) { const o = ports[q.mate]; adj.add(q.pi + ':' + o.pi); }
  const cross = (a, b) => { const d1x = a[2] - a[0], d1n = a[3] - a[1], d2x = b[2] - b[0], d2n = b[3] - b[1]; const den = d1x * d2n - d1n * d2x; if (Math.abs(den) < 1e-9) return null; const t = ((b[0] - a[0]) * d2n - (b[1] - a[1]) * d2x) / den, u = ((b[0] - a[0]) * d1n - (b[1] - a[1]) * d1x) / den; return t >= 0 && t < 1 && u >= 0 && u < 1 ? [a[0] + d1x * t, a[1] + d1n * t] : null; };
  const crossSeen = new Set();
  for (const [k, list] of segs) {
    const [ci, cj] = k.split(',').map(Number);
    const cand = []; for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) for (const s of segs.get(i + ',' + j) || []) cand.push(s);
    for (const a of list) for (const b of cand) {
      if (a[4] >= b[4] || adj.has(a[4] + ':' + b[4])) continue;
      const x = cross(a, b); if (!x) continue;
      const key = a[4] + ':' + b[4] + ':' + Math.round(x[0] / 5) + ':' + Math.round(x[1] / 5); if (crossSeen.has(key)) continue; crossSeen.add(key);
      issues.push({ kind: 'cross', X: x[0], N: x[1], text: 'Two tracks cross here without a junction' });
    }
  }
  let len = 0, minR = Infinity, nSw = 0;
  for (const P of pieces) { for (const path of P.g.paths) { len += path.pts[path.pts.length - 1].s; if (path.R) minR = Math.min(minR, path.R); } nSw += (P.g.sws || []).length; }
  const open = ports.filter(q => !q.internal && q.mate < 0);
  return { pieces, ports, open, issues, len, minR, nSw };
}

/* chain the pieces into edges and nodes on NET, then fill ROUTE for the rest of the game */
function buildLayoutRoute(map) {
  const G = layoutGraph(map);
  const paths = [];
  G.pieces.forEach((P, pi) => P.g.paths.forEach((path, j) => paths.push({ pi, j, pts: path.pts, R: path.R || 0, pa: P.base + path.a, pb: P.base + path.b })));
  // junction id for a port: joined ports share the lower id
  const jn = id => { const q = G.ports[id]; return q.mate >= 0 ? Math.min(id, q.mate) : id; };
  const att = new Map(); // junction -> [{path, end}]
  paths.forEach((P, i) => { for (const [end, port] of [[0, P.pa], [1, P.pb]]) { const k = jn(port); if (!att.has(k)) att.set(k, []); att.get(k).push({ path: i, end }); } });
  const through = k => att.get(k).length === 2;
  // speed limit of each path from its tightest curvature: about 1.1 m/s² of unbalanced lateral acceleration
  const limitOf = pts => { let k = 0; for (const q of pts) k = Math.max(k, Math.abs(q.k)); return k < 1e-6 ? 70 : clamp(Math.floor(Math.sqrt(1.1 / k) / MPH / 5) * 5, 10, 70); };
  paths.forEach(P => { P.lim = limitOf(P.pts); });
  const nextOf = (k, i, end) => att.get(k).find(a => !(a.path === i && a.end === end));
  const nodes = new Map(), nodeOf = k => { if (!nodes.has(k)) nodes.set(k, NET.node()); return nodes.get(k); };
  const placed = new Map(), endAtt = new Map(), visited = new Set();
  const flip = pts => { const L = pts[pts.length - 1].s; return pts.slice().reverse().map(q => ({ X: q.X, N: q.N, h: q.h + Math.PI, k: -q.k, s: L - q.s })); };
  let nEdge = 0;
  const makeEdge = (seq, kA, kB) => {
    const pts = []; let off = 0;
    for (const st of seq) {
      const P = paths[st.path];
      let q = st.rev ? flip(P.pts) : P.pts;
      const dh = pts.length ? Math.round((pts[pts.length - 1].h - q[0].h) / TAU) * TAU : 0;
      for (let i = pts.length ? 1 : 0; i < q.length; i++) pts.push({ X: q[i].X, N: q[i].N, h: q[i].h + dh, k: q[i].k, s: off + q[i].s });
      const L = q[q.length - 1].s;
      placed.set(st.path, { s0: off, s1: off + L, rev: st.rev });
      off += L;
    }
    const limit = paths[seq[0].path].lim;
    const e = NET.edge(pts, { kind: 'main', name: map.name || 'Layout', limit });
    e.setProfile(() => 0);
    easeCant(e);
    NET.attach(e, 0, nodeOf(kA)); NET.attach(e, 1, nodeOf(kB));
    const f = seq[0], l = seq[seq.length - 1];
    endAtt.set(f.path + ':' + (f.rev ? 1 : 0), { edge: e, end: 0 });
    endAtt.set(l.path + ':' + (l.rev ? 0 : 1), { edge: e, end: 1 });
    for (const st of seq) placed.get(st.path).edge = e;
    nEdge++;
    return e;
  };
  /* one edge per run of paths with the same speed limit between switches and ends */
  const walk = (i, end) => {
    const seq = []; let cur = i, e0 = end; const kA = jn(e0 ? paths[i].pb : paths[i].pa); let kB;
    for (;;) {
      seq.push({ path: cur, rev: e0 === 1 }); visited.add(cur);
      const exit = 1 - e0, k = jn(exit ? paths[cur].pb : paths[cur].pa);
      if (!through(k)) { kB = k; break; }
      const nx = nextOf(k, cur, exit);
      if (visited.has(nx.path) || paths[nx.path].lim !== paths[i].lim) { kB = k; break; }
      cur = nx.path; e0 = nx.end;
    }
    return makeEdge(seq, kA, kB);
  };
  const boundary = (i, end) => { const k = jn(end ? paths[i].pb : paths[i].pa); if (!through(k)) return true; return paths[nextOf(k, i, end).path].lim !== paths[i].lim; };
  for (let pass = 0; pass < 2; pass++)   // runs that start at a switch, an end or a change of limit; then loops of one limit
    paths.forEach((P, i) => { for (const end of [0, 1]) { if (visited.has(i)) return; if (pass || boundary(i, end)) walk(i, end); } });
  // switches
  let swN = 0;
  G.pieces.forEach((P, pi) => {
    const pid = j => paths.findIndex(x => x.pi === pi && x.j === j);
    for (const sw of P.g.sws || []) {
      const k = jn(P.base + sw.port), leg = ([j, end]) => endAtt.get(pid(j) + ':' + end);
      const trunk = leg(sw.trunk), normal = leg(sw.normal), reverse = leg(sw.reverse);
      if (!trunk || !normal || !reverse) continue;
      const s = NET.addSwitch(nodeOf(k), trunk, normal, reverse, P.p.name || ('Switch ' + (++swN)), ['Straight', 'Diverging']);
      s.divLimit = sw.lim; s.layoutKind = P.p.t === 'xover' ? 'xover' : P.p.k; s.pieceId = P.p.id;
    }
  });
  for (const nd of NET.nodes) if (nd.att.length === 1) ROUTE.bumpers.push(nd);
  // stations (with a water column for steam) on straights the editor marked
  const lineOf = e => ({ edge: e, len: e.len, locate: s => ({ edge: e, s: clamp(s, 0, e.len) }) });
  G.pieces.forEach((P, pi) => {
    const st = P.p.st; if (!st) return;
    const pl = placed.get(paths.findIndex(x => x.pi === pi)); if (!pl) return;
    const s = (pl.s0 + pl.s1) / 2, side = stSide(P.p) * (pl.rev ? -1 : 1), line = lineOf(pl.edge);
    ROUTE.stations.push({ name: st.name || 'Station', line, sLine: s, edge: pl.edge, s, side, kind: st.big ? 'depot' : 'small' });
    const sw = clamp(s + (pl.s1 - pl.s0) * 0.3, 4, pl.edge.len - 4);
    ROUTE.water.push({ line, sLine: sw, edge: pl.edge, s: sw, side, kind: 'column' });
  });
  // signals ahead of facing-point turnouts on long approaches
  for (const sw of NET.switches) {
    if (sw.layoutKind === 'yard') continue;
    const t = sw.trunk, tp = new TrackPos(t.edge, t.end ? t.edge.len : 0, t.end ? -1 : 1);
    if (tp.advance(160, null) !== 0) continue;   // not enough approach for a signal
    ROUTE.signals.push({ sw, line: lineOf(tp.e), sLine: tp.s, dir: -tp.o });
  }
  ROUTE.coal = null;
  ROUTE.mainLen = G.len;
  ROUTE.layout = { map, graph: G, placed, paths, lineOf };
  return G;
}

/* ---------- placement helpers the editor snaps with (pure, tested in tests/editor.test.js) ----------
   A rigid move is { a, tx, tn }: a plan point P goes to R(a)·P + t. Moving every piece of a joined
   group by the same move keeps its joints flush, because each piece is rebuilt from its own pose. */
const SNAP = {
  track: 4.5,       // m between parallel track centres, as the siding turnout lays them
  endAng: Math.PI / 4,   // an end only pulls a piece onto it when they already face within 45°
  parR: 30,         // m: how near an existing track a free piece lines up parallel with it
  parAng: Math.PI / 18,  // once turned by hand, a piece only lines up when within 10°
};
const rigidAt = (T, X, N) => { const c = Math.cos(T.a), s = Math.sin(T.a); return { X: c * X - s * N + T.tx, N: s * X + c * N + T.tn }; };
/* a move that turns by a about (cx, cn), then shifts by (dx, dn) */
function rigidAbout(a, cx, cn, dx = 0, dn = 0) { const c = Math.cos(a), s = Math.sin(a); return { a, tx: cx - (c * cx - s * cn) + dx, tn: cn - (s * cx + c * cn) + dn }; }
/* T followed by an extra turn b about (px, pn) and a shift (dx, dn) */
function rigidThen(T, b, px, pn, dx, dn) { const U = rigidAbout(b, px, pn, dx, dn), o = rigidAt(U, T.tx, T.tn); return { a: T.a + b, tx: o.X, tn: o.N }; }
function movePiece(p, T) {
  const o = rigidAt(T, p.X, p.N), q = { ...p, X: o.X, N: o.N, h: wrapPi(p.h + T.a) };
  if (p.b) { const b = rigidAt(T, p.b.X, p.b.N); q.b = { X: b.X, N: b.N, h: p.b.h + T.a }; }
  if (p.st) q.st = { ...p.st };
  return q;
}
/* every piece joined, directly or through others, to piece index pi */
function layoutGroup(G, pi) {
  const out = new Set([pi]), todo = [pi];
  while (todo.length) {
    const P = G.pieces[todo.pop()];
    for (let k = 0; k < P.g.ports.length; k++) { const q = G.ports[P.base + k]; if (q.mate < 0) continue; const o = G.ports[q.mate].pi; if (!out.has(o)) { out.add(o); todo.push(o); } }
  }
  return out;
}
/* the open end among `ends` that one of `mine` (outward ports of what is being placed) lands on,
   within r metres and facing it within SNAP.endAng: { E, q, d } or null */
function nearestEnd(mine, ends, r) {
  let best = null;
  for (const q of mine) for (const E of ends) {
    const d = Math.hypot(q.X - E.X, q.N - E.N); if (d > r || (best && d >= best.d)) continue;
    if (Math.abs(wrapPi(q.h - E.h - Math.PI)) > SNAP.endAng) continue;
    best = { E, q, d };
  }
  return best;
}
/* the closest point of laid track to (X, N) within r: { X, N, h, d, lat } with lat + to the left of h */
function nearestTrack(G, X, N, r, skip) {
  let best = null;
  for (let pi = 0; pi < G.pieces.length; pi++) {
    if (skip && skip.has(pi)) continue;
    for (const path of G.pieces[pi].g.paths) for (const q of path.pts) {
      const d = Math.hypot(q.X - X, q.N - N); if (d > r || (best && d >= best.d)) continue;
      best = { X: q.X, N: q.N, h: q.h, d, lat: -Math.sin(q.h) * (X - q.X) + Math.cos(q.h) * (N - q.N) };
    }
  }
  return best;
}
/* Where a free piece lands for a pointer at (X, N), heading h, with snapping on:
   1. any end of the piece near an open end facing it attaches there, flush;
   2. near laid track it lines up parallel, a whole number of track spacings to the side
      (any heading with o.alignAny, else only one already within SNAP.parAng);
   3. otherwise the grid (step metres).
   Returns { p, how, E?, j?, lat? }. */
function snapFree(spec, X, N, h, G, o = {}) {
  const step = o.step || 1, r = o.r || 8, ext = pieceExt(spec);
  const p0 = { ...spec, X, N, h };
  if (o.ends !== false) {
    const ports = pieceGeom(p0).ports.slice(0, ext).map((q, j) => ({ ...q, j }));
    const hit = nearestEnd(ports, G.open, r);
    if (hit) return { p: attachPiece(spec, hit.q.j, hit.E), how: 'end', E: hit.E, j: hit.q.j };
  }
  if (o.parallel !== false && G.pieces.length) {
    const t = nearestTrack(G, X, N, SNAP.parR);
    if (t) {
      const flip = Math.abs(wrapPi(h - t.h)) > Math.PI / 2, ht = flip ? wrapPi(t.h + Math.PI) : wrapPi(t.h);
      if (o.alignAny || Math.abs(wrapPi(h - ht)) <= SNAP.parAng) {
        const n = Math.max(1, Math.round(Math.abs(t.lat) / SNAP.track)) * (t.lat < 0 ? -1 : 1), lat = n * SNAP.track;
        return { p: { ...spec, X: t.X - Math.sin(t.h) * lat, N: t.N + Math.cos(t.h) * lat, h: ht }, how: 'parallel', lat };
      }
    }
  }
  return { p: { ...spec, X: Math.round(X / step) * step, N: Math.round(N / step) * step, h }, how: 'grid' };
}
/* Snap a group being dragged by move T: if one of its open ends comes within r of another open end
   and faces it, turn and shift the whole group so that joint is flush. Returns { T, E?, q? }. */
function snapGroup(G, group, T, r) {
  const mine = [], ends = [];
  for (const q of G.open) {
    if (group.has(q.pi)) { const o = rigidAt(T, q.X, q.N); mine.push({ X: o.X, N: o.N, h: q.h + T.a }); }
    else ends.push(q);
  }
  const hit = nearestEnd(mine, ends, r);
  if (!hit) return { T };
  const b = wrapPi(hit.E.h + Math.PI - hit.q.h);
  return { T: rigidThen(T, b, hit.q.X, hit.q.N, hit.E.X - hit.q.X, hit.E.N - hit.q.N), E: hit.E, q: hit.q };
}

/* superelevation that runs in and out over about 40 m instead of stepping at a joint */
function easeCant(e) {
  const n = e.n, W = Math.max(1, Math.round(20 / e.ds)), pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + e.K[i];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - W), b = Math.min(n, i + W + 1), k = (pre[b] - pre[a]) / (b - a);
    const E = clamp(105 * Math.abs(k), 0, 0.1);
    e.C[i] = Math.sign(k) * Math.asin(E / 1.5);
  }
}

/* where the train is made up on a layout: the start marker, or the middle of the longest edge */
function layoutStart(map) {
  const L = ROUTE.layout;
  if (map.start) {
    const pi = L.graph.pieces.findIndex(P => P.p.id === map.start.id);
    const path = L.paths.findIndex(x => x.pi === pi);
    const pl = path >= 0 ? L.placed.get(path) : null;
    if (pl) return { edge: pl.edge, s: (pl.s0 + pl.s1) / 2, o: (map.start.dir || 1) * (pl.rev ? -1 : 1) };
  }
  let best = NET.edges[0]; for (const e of NET.edges) if (e.len > best.len) best = e;
  return { edge: best, s: best.len / 2, o: 1 };
}

/* ---------- saved layouts (localStorage) ---------- */
const LAYOUTS = {
  all() { try { const o = JSON.parse(localStorage.getItem('bd_layouts') || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } },
  get(id) { return LAYOUTS.all()[id] || null; },
  put(map) { const o = LAYOUTS.all(); map.saved = Date.now(); o[map.id] = map; try { localStorage.setItem('bd_layouts', JSON.stringify(o)); return true; } catch (e) { return false; } },
  remove(id) { const o = LAYOUTS.all(); delete o[id]; try { localStorage.setItem('bd_layouts', JSON.stringify(o)); } catch (e) {} },
  newId: () => 'L' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36),
};
/* the layout this page was opened to drive (?layout=id), or null for the Berkshire Division */
const PLAY_LAYOUT = (() => { try { const id = new URLSearchParams(location.search).get('layout'); const m = id && LAYOUTS.get(id); return m && m.pieces && m.pieces.length ? m : null; } catch (e) { return null; } })();

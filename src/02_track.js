/* ============================================================================
   Track network: clothoid path builder, edges, nodes, switches, traversal
   ========================================================================== */
class PathBuilder {
  constructor(X, N, h) { this.X = X; this.N = N; this.h = h; this.k = 0; this.s = 0; this.pts = [{ X, N, h, k: 0, s: 0 }]; }
  seg(L, k0, k1) {
    if (L <= 1e-6) return this;
    const n = Math.max(1, Math.ceil(L / 0.5)), ds = L / n;
    for (let i = 0; i < n; i++) {
      const ka = k0 + (k1 - k0) * (i / n), kb = k0 + (k1 - k0) * ((i + 1) / n), km = (ka + kb) * 0.5, dh = km * ds;
      if (Math.abs(km) < 1e-12) { this.X += Math.cos(this.h) * ds; this.N += Math.sin(this.h) * ds; }
      else { const R = 1 / km; this.X += R * (Math.sin(this.h + dh) - Math.sin(this.h)); this.N -= R * (Math.cos(this.h + dh) - Math.cos(this.h)); }
      this.h += dh; this.s += ds; this.k = kb;
      this.pts.push({ X: this.X, N: this.N, h: this.h, k: kb, s: this.s });
    }
    return this;
  }
  straight(L) { return this.seg(L, 0, 0); }
  /* R signed: + left, - right. deg: total deflection. Ls: spiral length each end */
  curve(R, deg, Ls = 0) {
    const a = deg * Math.PI / 180, k = 1 / R, aR = Math.abs(R);
    if (Ls > 0 && Ls / aR > a) Ls = a * aR * 0.99;
    const Larc = aR * a - Ls;
    if (Ls > 0) this.seg(Ls, 0, k);
    this.seg(Larc, k, k);
    if (Ls > 0) this.seg(Ls, k, 0);
    return this;
  }
  arc(R, deg) { return this.curve(R, deg, 0); }
  /* reverse curve shifting laterally by `off` (+ left), radius R; returns along-track projected length */
  jog(off, R) {
    const th = Math.acos(1 - Math.abs(off) / (2 * R)), sg = Math.sign(off);
    this.seg(R * th, sg / R, sg / R); this.seg(R * th, -sg / R, -sg / R);
    return 2 * R * Math.sin(th);
  }
  pose() { return { X: this.X, N: this.N, h: this.h }; }
}
const jogLen = (off, R) => 2 * R * Math.sin(Math.acos(1 - Math.abs(off) / (2 * R)));

let EDGE_ID = 0, NODE_ID = 0;
class Edge {
  constructor(pts, opt = {}) {
    this.id = EDGE_ID++;
    this.kind = opt.kind || 'main';
    this.name = opt.name || '';
    this.limit = opt.limit || 70;          // mph
    this.cantOK = opt.cant !== false && this.kind === 'main';
    this.bridges = opt.bridges || [];      // [[s0,s1],...]
    this.tunnels = opt.tunnels || [];      // [[s0,s1],...] bored through the hill: no ground is graded over them
    this.noTies = false;
    const total = pts[pts.length - 1].s - pts[0].s;
    this.len = total;
    const n = Math.max(2, Math.ceil(total / 1.0) + 1);
    this.n = n; this.ds = total / (n - 1);
    this.X = new Float64Array(n); this.N = new Float64Array(n); this.H = new Float64Array(n);
    this.K = new Float32Array(n); this.Y = new Float32Array(n); this.C = new Float32Array(n);
    // resample uniformly
    let j = 0; const s0 = pts[0].s;
    for (let i = 0; i < n; i++) {
      const s = s0 + i * this.ds;
      while (j < pts.length - 2 && pts[j + 1].s < s) j++;
      const a = pts[j], b = pts[j + 1], t = clamp((s - a.s) / ((b.s - a.s) || 1), 0, 1);
      this.X[i] = lerp(a.X, b.X, t); this.N[i] = lerp(a.N, b.N, t); this.H[i] = lerp(a.h, b.h, t); this.K[i] = lerp(a.k, b.k, t);
    }
    this.a = null; this.b = null;
  }
  setProfile(fn) {
    for (let i = 0; i < this.n; i++) this.Y[i] = fn(i * this.ds, this.X[i], this.N[i]);
    for (let i = 0; i < this.n; i++) {
      // superelevation for 60 mph balance, capped at 4 in
      const E = this.cantOK ? clamp(105 * Math.abs(this.K[i]), 0, 0.1) : 0;
      this.C[i] = Math.sign(this.K[i]) * Math.asin(E / 1.5);
    }
  }
  isBridge(s) { for (const b of this.bridges) if (s >= b[0] && s <= b[1]) return true; return false; }
  isTunnel(s) { for (const b of this.tunnels) if (s >= b[0] && s <= b[1]) return true; return false; }
  _idx(s) { const f = clamp(s, 0, this.len) / this.ds; let i = Math.floor(f); if (i >= this.n - 1) i = this.n - 2; return [i, f - i]; }
  heading(s) { const [i, t] = this._idx(s); return lerp(this.H[i], this.H[i + 1], t); }
  curv(s) { const [i, t] = this._idx(s); return lerp(this.K[i], this.K[i + 1], t); }
  cant(s) { const [i, t] = this._idx(s); return lerp(this.C[i], this.C[i + 1], t); }
  grade(s) { const [i] = this._idx(s); return (this.Y[i + 1] - this.Y[i]) / this.ds; }
  elev(s) { const [i, t] = this._idx(s); return lerp(this.Y[i], this.Y[i + 1], t); }
  xz(s) { const [i, t] = this._idx(s); return [lerp(this.X[i], this.X[i + 1], t), lerp(this.N[i], this.N[i + 1], t)]; }
  /* Full 3D frame at s (direction of +s). out: {p,f,u,r} Vector3s */
  pose(s, out, lateral = 0) {
    const [i, t] = this._idx(s);
    const X = lerp(this.X[i], this.X[i + 1], t), Nn = lerp(this.N[i], this.N[i + 1], t);
    const h = lerp(this.H[i], this.H[i + 1], t), y = lerp(this.Y[i], this.Y[i + 1], t);
    const c = lerp(this.C[i], this.C[i + 1], t), g = (this.Y[i + 1] - this.Y[i]) / this.ds;
    const ch = Math.cos(h), sh = Math.sin(h), cc = Math.cos(c), sc = Math.sin(c);
    out.f.set(ch, g, -sh).normalize();
    // banked right vector
    out.r.set(sh * cc, sc, ch * cc);
    out.u.crossVectors(out.r, out.f).normalize();
    out.r.crossVectors(out.f, out.u).normalize();
    out.p.set(X, y, -Nn);
    if (lateral) out.p.addScaledVector(out.r, lateral);
    return out;
  }
}
const newFrame = () => ({ p: new THREE.Vector3(), f: new THREE.Vector3(), u: new THREE.Vector3(), r: new THREE.Vector3() });

class Node {
  constructor() { this.id = NODE_ID++; this.att = []; this.sw = null; this.X = 0; this.N = 0; this.y = 0; }
  /* attachment entering the node from `edge` at its end `end`; returns next attachment {edge,end} or null */
  next(edge, end, ctx) {
    if (this.sw) {
      const sw = this.sw;
      if (sw.trunk.edge === edge && sw.trunk.end === end) return sw.legs[sw.state];
      const li = sw.legs[0].edge === edge && sw.legs[0].end === end ? 0 : 1;
      if (li !== sw.state && ctx && ctx.commit && !sw.spring) { sw.state = li; sw.anim = li; if (ctx.onRunThrough) ctx.onRunThrough(sw); }
      return sw.trunk;
    }
    if (this.att.length === 2) { const a = this.att[0]; return (a.edge === edge && a.end === end) ? this.att[1] : a; }
    return null;
  }
}
let SW_ID = 0;
class Switch {
  constructor(node, trunk, normal, reverse, name) {
    this.id = ++SW_ID; this.node = node; this.trunk = trunk; this.legs = [normal, reverse];
    this.state = 0; this.anim = 0; this.name = name || ('Switch ' + this.id);
    this.legNames = ['Main', 'Siding'];
    node.sw = this;
  }
  get lined() { return this.legNames[this.state]; }
}

class Network {
  constructor() { this.edges = []; this.nodes = []; this.switches = []; }
  edge(pts, opt) { const e = new Edge(pts, opt); this.edges.push(e); return e; }
  node() { const n = new Node(); this.nodes.push(n); return n; }
  attach(edge, end, node) {
    node.att.push({ edge, end });
    if (end === 0) edge.a = node; else edge.b = node;
    const i = end === 0 ? 0 : edge.n - 1;
    node.X = edge.X[i]; node.N = edge.N[i];
  }
  /* split an edge at distance s, returns [first, second, node] (edges re-created) */
  addSwitch(node, trunk, normal, reverse, name, legNames) {
    const sw = new Switch(node, trunk, normal, reverse, name);
    if (legNames) sw.legNames = legNames;
    this.switches.push(sw); return sw;
  }
}

/* A position on the network. o = +1 when the train's forward direction is +s. */
class TrackPos {
  constructor(e, s, o) { this.e = e; this.s = s; this.o = o; }
  clone() { return new TrackPos(this.e, this.s, this.o); }
  copy(t) { this.e = t.e; this.s = t.s; this.o = t.o; return this; }
  /* advance by d metres in train-forward sense. returns leftover distance if blocked (end of track) */
  advance(d, ctx) {
    if (d === 0) return 0;
    const sd = Math.sign(d);
    let rem = d * this.o;
    for (let guard = 0; guard < 64; guard++) {
      const ns = this.s + rem;
      if (ns >= 0 && ns <= this.e.len) { this.s = ns; return 0; }
      const end = ns > this.e.len ? 1 : 0;
      const over = end ? ns - this.e.len : -ns;
      const node = end ? this.e.b : this.e.a;
      const nx = node ? node.next(this.e, end, ctx) : null;
      if (!nx) { this.s = end ? this.e.len : 0; return over * sd; }
      if (ctx && ctx.onNode) ctx.onNode(node, this.e, nx.edge);
      const sig = nx.end === 0 ? 1 : -1;
      this.e = nx.edge; this.o = sig * sd; this.s = nx.end === 0 ? 0 : this.e.len;
      rem = sig * over;
    }
    return 0;
  }
  pose(out, lateral) { this.e.pose(this.s, out, lateral); if (this.o < 0) { out.f.negate(); out.r.negate(); } return out; }
}

/* Walk ahead without changing anything; calls visit(node, distAtNode, fromEdge, fromEnd) at each node. */
function peekPath(tp, dir, maxD, visit) {
  let e = tp.e, s = tp.s, o = tp.o * dir, d = 0;
  for (let g = 0; g < 80 && d < maxD; g++) {
    const toEnd = o > 0 ? e.len - s : s;
    d += toEnd;
    const end = o > 0 ? 1 : 0;
    const node = end ? e.b : e.a;
    if (!node) return;
    if (d > maxD) return;
    const stop = visit(node, d, e, end);
    if (stop) return;
    const nx = node.next(e, end, null);
    if (!nx) { visit(null, d, e, end); return; }
    e = nx.edge; o = nx.end === 0 ? 1 : -1; s = nx.end === 0 ? 0 : e.len;
  }
}

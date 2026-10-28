/* ============================================================================
   Layout editor: lay your own railroad on a plan view from straights, curves,
   turnouts and join curves. A new piece snaps onto an open end with that end's
   exact pose, so joints are flush; the joint finder in 03b decides what is
   joined, here and when the layout is built into 3D track.
   ========================================================================== */
const ED = {
  map: null, G: null, idx: new Map(), view: { cx: 0, cn: 2500, sc: 0.4 }, W: 0, H: 0,
  active: null, sel: null, armed: null, attach: 0, rot: 0, join: null, ghost: null, hoverEnd: null,
  undo: [], redo: [], curveR: 300, curveDeg: 15, tab: 'straight', warned: false, dirty: true, open: false,
};
const ED_PORT_NAMES = ['A', 'B', 'C'];

function edBlank(name) { return { v: 1, id: LAYOUTS.newId(), name: name || 'My railroad', pieces: [], nid: 1, start: null }; }
const edExt = spec => spec.t === 'turnout' ? 3 : 2;   // external ends of a piece
function edLabel(p) {
  if (p.t === 'straight') return { h: `Straight ${p.L} m`, s: `${Math.round(p.L / FT)} ft of tangent track` };
  if (p.t === 'curve') return { h: `Curve ${p.dir > 0 ? 'left' : 'right'}`, s: `Radius ${p.R} m · ${p.deg}° · ${(p.R * p.deg * Math.PI / 180).toFixed(1)} m long` };
  if (p.t === 'turnout') { const T = TURNOUTS[p.k]; return { h: `${T.name}, ${p.dir > 0 ? 'left' : 'right'} hand`, s: `${T.sub} · diverging route ${T.lim} mph` }; }
  if (p.t === 'flex') { const f = flexPath(p, p.b); return { h: 'Join curve', s: `${f.len.toFixed(1)} m · tightest radius ${f.minR === Infinity ? 'straight' : Math.round(f.minR) + ' m'}` }; }
  return { h: 'Piece', s: '' };
}

/* ---------- model changes (all go through here so undo and autosave see them) ---------- */
function edRebuild() {
  ED.G = layoutGraph(ED.map);
  ED.idx = new Map(ED.G.pieces.map((P, i) => [P.p.id, i]));
  for (const P of ED.G.pieces) {
    let x0 = Infinity, x1 = -Infinity, n0 = Infinity, n1 = -Infinity;
    for (const path of P.g.paths) for (const q of path.pts) { if (q.X < x0) x0 = q.X; if (q.X > x1) x1 = q.X; if (q.N < n0) n0 = q.N; if (q.N > n1) n1 = q.N; }
    P.bb = [x0 - 6, x1 + 6, n0 - 6, n1 + 6];
  }
  if (ED.active && !edPort(ED.active)) ED.active = null;
  if (ED.active) { const q = edPort(ED.active); if (q.mate >= 0) ED.active = null; }
  if (ED.sel != null && !ED.idx.has(ED.sel)) ED.sel = null;
  ED.warned = false;
  edPanels(); ED.dirty = true;
}
/* A change is what one edit did: pieces added, removed and altered, and the name or
   start if they moved. Undo applies the inverse of our own changes only, so in a
   shared build it never takes back what someone else laid. */
function edSnap() { return { p: new Map(ED.map.pieces.map(x => [x.id, JSON.stringify(x)])), name: ED.map.name, start: JSON.stringify(ED.map.start || null) }; }
function edDiff(a) {
  const ch = { add: [], del: [], set: [] }, seen = new Set();
  for (const x of ED.map.pieces) { seen.add(x.id); const o = a.p.get(x.id), n = JSON.stringify(x); if (o === undefined) ch.add.push(JSON.parse(n)); else if (o !== n) ch.set.push([JSON.parse(o), JSON.parse(n)]); }
  for (const [id, o] of a.p) if (!seen.has(id)) ch.del.push(JSON.parse(o));
  if (a.name !== ED.map.name) ch.name = [a.name, ED.map.name];
  if (a.start !== JSON.stringify(ED.map.start || null)) ch.start = [JSON.parse(a.start), ED.map.start || null];
  return ch.add.length || ch.del.length || ch.set.length || ch.name || ch.start ? ch : null;
}
const edInvert = ch => ({ add: ch.del, del: ch.add, set: ch.set.map(([o, n]) => [n, o]), name: ch.name && [ch.name[1], ch.name[0]], start: ch.start && [ch.start[1], ch.start[0]] });
function edApply(ch) {
  const P = ED.map.pieces, at = id => P.findIndex(x => x.id === id);
  for (const x of ch.del) { const i = at(x.id); if (i >= 0) P.splice(i, 1); }
  for (const x of ch.add) { const i = at(x.id); if (i >= 0) P[i] = x; else P.push(x); }
  for (const [, x] of ch.set) { const i = at(x.id); if (i >= 0) P[i] = x; else P.push(x); }
  if (ch.name) ED.map.name = ch.name[1];
  if (ch.start) ED.map.start = ch.start[1];
}
function edCommit(fn) {
  const a = edSnap(); fn();
  const ch = edDiff(a); if (!ch) return;
  ED.undo.push(ch); if (ED.undo.length > 200) ED.undo.shift(); ED.redo = [];
  edRebuild(); edSave(); BT.send(ch);
}
function edSave() { if (!LAYOUTS.put(ED.map)) edMsg('Could not save: browser storage is full or blocked.', 'bad'); }
function edUndo(redo) {
  const from = redo ? ED.redo : ED.undo, to = redo ? ED.undo : ED.redo;
  if (!from.length) return;
  const ch = from.pop(), go = redo ? ch : edInvert(ch);
  edApply(go); to.push(ch);
  ED.active = null; ED.armed = null; ED.join = null;
  edRebuild(); edSave(); BT.send(go);
}
/* a piece id nobody else in a shared build will pick */
function edNewId() { let id; do id = 1 + Math.floor(Math.random() * 2e9); while (ED.idx.has(id)); return id; }
function edPort(ref) { const i = ED.idx.get(ref.pid); if (i === undefined) return null; const P = ED.G.pieces[i]; return ED.G.ports[P.base + ref.j] || null; }
const edRefOf = q => ({ pid: ED.G.pieces[q.pi].p.id, j: q.j });

/* place spec attached by its port j to end E, or free at (X, N, h) */
function edPlace(spec, E, j, X, N, h) {
  const base = { ...spec, id: edNewId() };
  return E ? attachPiece(base, j % edExt(spec), E) : { ...base, X, N, h };
}
function edAdd(spec, E, j, X, N, h) {
  const p = edPlace(spec, E, j, X, N, h);
  if (!edInBounds(p)) { edMsg('That would run off the edge of the world.', 'bad'); return null; }
  edCommit(() => { ED.map.pieces.push(p); });
  // carry on from the far end of the new piece
  const P = ED.G.pieces[ED.idx.get(p.id)], jj = E ? j % edExt(spec) : -1;
  const order = spec.t === 'turnout' ? (jj === 0 ? [1, 2] : [0, 1, 2]) : [1, 0];
  ED.active = null;
  for (const k of order) { if (k === jj) continue; const q = ED.G.ports[P.base + k]; if (q.mate < 0) { ED.active = { pid: p.id, j: k }; break; } }
  if (!ED.active && E) edMsg('Joined up: that closes the track.', 'good');
  edPanels(); ED.dirty = true;
  return p;
}
function edInBounds(p) {
  const B = LAYOUT.bounds, g = pieceGeom(p);
  for (const path of g.paths) for (const q of path.pts) if (q.X < B.x0 || q.X > B.x1 || q.N < B.n0 || q.N > B.n1) return false;
  return true;
}
function edDelete(pid) {
  const i = ED.idx.get(pid); if (i === undefined) return;
  const P = ED.G.pieces[i];
  // the piece this one was attached to keeps building from the freed end
  let back = null;
  for (let k = 0; k < edExt(P.p); k++) { const q = ED.G.ports[P.base + k]; if (q.mate >= 0) { back = edRefOf(ED.G.ports[q.mate]); break; } }
  edCommit(() => {
    ED.map.pieces = ED.map.pieces.filter(p => p.id !== pid);
    if (ED.map.start && ED.map.start.id === pid) ED.map.start = null;
  });
  ED.sel = null; ED.active = back && edPort(back) ? back : null;
  edPanels(); ED.dirty = true;
}
function edUpdatePiece(pid, fn) {
  edCommit(() => { const p = ED.map.pieces.find(x => x.id === pid); if (p) fn(p); });
}
function edJoin(a, b) {
  const qa = edPort(a), qb = edPort(b);
  if (!qa || !qb || qa === qb) return;
  const d = Math.hypot(qa.X - qb.X, qa.N - qb.N);
  if (d < 1) { edMsg('Those ends already touch. Line them up with the pieces instead.', 'bad'); return; }
  const spec = { t: 'flex', X: qa.X, N: qa.N, h: qa.h, b: { X: qb.X, N: qb.N, h: qb.h + Math.PI } };
  const f = flexPath(spec, spec.b);
  if (f.minR < LAYOUT.minFlexR) { edMsg(`Too sharp to join: the curve would be ${Math.round(f.minR)} m radius (${LAYOUT.minFlexR} m is the tightest allowed). Lay more track toward the other end first.`, 'bad'); return; }
  const p = { ...spec, id: edNewId() };
  if (!edInBounds(p)) { edMsg('That join would run off the edge of the world.', 'bad'); return; }
  edCommit(() => { ED.map.pieces.push(p); });
  ED.active = null; ED.join = null; edMsg(`Joined with a ${f.len.toFixed(0)} m curve, radius ${f.minR === Infinity ? 'straight' : Math.round(f.minR) + ' m'} at its tightest.`, 'good');
  edPanels();
}
function edRotateSel(dir) {
  const i = ED.idx.get(ED.sel); if (i === undefined) return;
  const P = ED.G.pieces[i];
  for (let k = 0; k < edExt(P.p); k++) if (ED.G.ports[P.base + k].mate >= 0) { edMsg('Only a piece that is not joined to anything can be turned.', 'bad'); return; }
  if (P.p.t === 'flex') return;
  // turn about the middle of the piece
  const g = P.g, mid = g.paths[0].pts[(g.paths[0].pts.length / 2) | 0], a = dir * Math.PI / 12, c = Math.cos(a), s = Math.sin(a);
  const dx = P.p.X - mid.X, dn = P.p.N - mid.N;
  const np = { ...P.p, X: mid.X + c * dx - s * dn, N: mid.N + s * dx + c * dn, h: wrapPi(P.p.h + a) };
  if (!edInBounds(np)) { edMsg('That would run off the edge of the world.', 'bad'); return; }
  edUpdatePiece(ED.sel, p => { p.X = np.X; p.N = np.N; p.h = np.h; });
}

/* ---------- view ---------- */
const edTX = X => ED.W / 2 + (X - ED.view.cx) * ED.view.sc, edTY = N => ED.H / 2 - (N - ED.view.cn) * ED.view.sc;
const edWX = x => ED.view.cx + (x - ED.W / 2) / ED.view.sc, edWN = y => ED.view.cn - (y - ED.H / 2) / ED.view.sc;
function edFit() {
  const pcs = ED.G ? ED.G.pieces : [];
  if (!pcs.length) { ED.view.cx = 0; ED.view.cn = 2500; ED.view.sc = Math.min(ED.W, ED.H) / 1600; ED.dirty = true; return; }
  let x0 = Infinity, x1 = -Infinity, n0 = Infinity, n1 = -Infinity;
  for (const P of pcs) { x0 = Math.min(x0, P.bb[0]); x1 = Math.max(x1, P.bb[1]); n0 = Math.min(n0, P.bb[2]); n1 = Math.max(n1, P.bb[3]); }
  ED.view.cx = (x0 + x1) / 2; ED.view.cn = (n0 + n1) / 2;
  ED.view.sc = clamp(Math.min(ED.W / (x1 - x0 + 120), (ED.H - 220) / (n1 - n0 + 120)), 0.03, 30);
  ED.dirty = true;
}
function edZoom(f, x, y) {
  const X = edWX(x), N = edWN(y);
  ED.view.sc = clamp(ED.view.sc * f, 0.03, 40);
  ED.view.cx = X - (x - ED.W / 2) / ED.view.sc; ED.view.cn = N + (y - ED.H / 2) / ED.view.sc;
  ED.dirty = true;
}

/* ---------- drawing ---------- */
function edStroke(g, pts, off, step = 1) {
  g.beginPath();
  for (let i = 0; i < pts.length; i += step) {
    const q = pts[i]; const x = edTX(q.X - Math.sin(q.h) * off), y = edTY(q.N + Math.cos(q.h) * off);
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  const L = pts[pts.length - 1]; if ((pts.length - 1) % step) g.lineTo(edTX(L.X - Math.sin(L.h) * off), edTY(L.N + Math.cos(L.h) * off));
  g.stroke();
}
function edDrawPiece(g, P, mode) {
  const sc = ED.view.sc, step = sc > 2 ? 1 : sc > 0.4 ? 4 : 10;
  const ghost = mode === 'ghost', bad = mode === 'bad', sel = mode === 'sel';
  g.lineCap = 'butt'; g.lineJoin = 'round';
  for (const path of P.g.paths) {
    const pts = path.pts;
    if (sel) { g.strokeStyle = 'rgba(207,166,81,0.45)'; g.lineWidth = Math.max(10, 7 * sc); edStroke(g, pts, 0, step); }
    g.strokeStyle = bad ? 'rgba(238,75,61,0.55)' : ghost ? 'rgba(82,212,131,0.35)' : '#4a4843'; g.lineWidth = Math.max(3, 4.4 * sc); edStroke(g, pts, 0, step);
    if (sc > 5 && !ghost && !bad) {   // ties
      g.strokeStyle = '#5c4a39'; g.lineWidth = Math.max(1, 0.23 * sc); g.beginPath();
      for (let i = 0; i < pts.length; i++) { const q = pts[i], c = Math.cos(q.h), s = Math.sin(q.h); g.moveTo(edTX(q.X + s * 1.3), edTY(q.N - c * 1.3)); g.lineTo(edTX(q.X - s * 1.3), edTY(q.N + c * 1.3)); }
      g.stroke();
    }
    const railC = bad ? '#ffb4ab' : ghost ? '#a9f0c4' : P.p.t === 'turnout' ? '#e6d3a1' : P.p.t === 'flex' ? '#b9d4df' : '#c9d2d6';
    g.strokeStyle = railC;
    if (sc > 2.2) { g.lineWidth = Math.max(1, 0.15 * sc); edStroke(g, pts, RAIL_OFF, step); edStroke(g, pts, -RAIL_OFF, step); }
    else { g.lineWidth = sc > 0.6 ? 1.6 : 1.2; edStroke(g, pts, 0, step); }
  }
  // the points of a turnout
  if (P.g.sw && !ghost) { const q = P.g.ports[3]; g.fillStyle = bad ? '#ffb4ab' : '#cfa651'; g.beginPath(); g.arc(edTX(q.X), edTY(q.N), clamp(1.2 * sc, 2.5, 6), 0, TAU); g.fill(); }
}
function edDraw() {
  const c = $('edCanvas'), dpr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight;
  if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
  ED.W = W; ED.H = H;
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#1b231d'; g.fillRect(0, 0, W, H);
  const sc = ED.view.sc;
  // outside the world
  const B = LAYOUT.bounds;
  g.fillStyle = '#0d1214'; g.beginPath(); g.rect(0, 0, W, H); g.rect(edTX(B.x0), edTY(B.n1), (B.x1 - B.x0) * sc, (B.n1 - B.n0) * sc); g.fill('evenodd');
  // grid: 10 m, 100 m, 1 km as the zoom allows
  for (const [step, a] of [[10, 0.035], [100, 0.06], [1000, 0.1]]) {
    if (step * sc < 9) continue;
    g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = 1; g.beginPath();
    const x0 = Math.max(B.x0, Math.floor(edWX(0) / step) * step), x1 = Math.min(B.x1, edWX(W)), n0 = Math.max(B.n0, Math.floor(edWN(H) / step) * step), n1 = Math.min(B.n1, edWN(0));
    for (let X = x0; X <= x1; X += step) { const x = Math.round(edTX(X)) + 0.5; g.moveTo(x, edTY(Math.max(B.n0, edWN(H)))); g.lineTo(x, edTY(n1)); }
    for (let N = n0; N <= n1; N += step) { const y = Math.round(edTY(N)) + 0.5; g.moveTo(edTX(Math.max(B.x0, edWX(0))), y); g.lineTo(edTX(x1), y); }
    g.stroke();
  }
  g.strokeStyle = 'rgba(207,166,81,0.35)'; g.lineWidth = 1.5; g.strokeRect(edTX(B.x0), edTY(B.n1), (B.x1 - B.x0) * sc, (B.n1 - B.n0) * sc);
  const G = ED.G; if (!G) return;
  const vis = P => !(edTX(P.bb[1]) < -20 || edTX(P.bb[0]) > W + 20 || edTY(P.bb[2]) < -20 || edTY(P.bb[3]) > H + 20);
  // stations under the track
  for (const P of G.pieces) {
    if (!P.p.st || !vis(P)) continue;
    const pts = P.g.paths[0].pts, side = P.p.st.side || 1;
    g.strokeStyle = 'rgba(207,166,81,0.55)'; g.lineWidth = Math.max(2, 4 * sc); g.lineCap = 'butt';
    edStroke(g, pts.slice(Math.floor(pts.length * 0.15), Math.ceil(pts.length * 0.85)), -side * 4.4, 1);
    const m = pts[(pts.length / 2) | 0], off = -side * (12 + 14 / Math.max(sc, 0.05));
    g.fillStyle = '#cfa651'; g.font = '600 12px "IBM Plex Sans Condensed", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText((P.p.st.name || 'Station').toUpperCase(), edTX(m.X - Math.sin(m.h) * off), edTY(m.N + Math.cos(m.h) * off));
  }
  for (const P of G.pieces) if (vis(P)) edDrawPiece(g, P, P.p.id === ED.sel ? 'sel' : '');
  // joints: a hairline across the rails where two pieces meet flush
  if (sc > 1.5) {
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1; g.beginPath();
    for (const q of G.ports) { if (q.internal || q.mate < q.id) continue; const c = Math.cos(q.h), s = Math.sin(q.h); g.moveTo(edTX(q.X + s * 1.1), edTY(q.N - c * 1.1)); g.lineTo(edTX(q.X - s * 1.1), edTY(q.N + c * 1.1)); }
    g.stroke();
  }
  // start marker
  if (ED.map.start && ED.idx.has(ED.map.start.id)) {
    const P = G.pieces[ED.idx.get(ED.map.start.id)], pts = P.g.paths[0].pts, m = pts[(pts.length / 2) | 0];
    const h = m.h + (ED.map.start.dir < 0 ? Math.PI : 0), r = clamp(9 * sc, 9, 18), x = edTX(m.X), y = edTY(m.N), c = Math.cos(h), s = Math.sin(h);
    g.fillStyle = '#ffe08a'; g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath();
    g.moveTo(x + c * r, y - s * r); g.lineTo(x - c * r * 0.7 - s * r * 0.6, y + s * r * 0.7 - c * r * 0.6); g.lineTo(x - c * r * 0.7 + s * r * 0.6, y + s * r * 0.7 + c * r * 0.6); g.closePath(); g.fill(); g.stroke();
  }
  // ghost of the piece about to be placed
  if (ED.ghost) edDrawPiece(g, { p: ED.ghost.p, g: pieceGeom(ED.ghost.p) }, ED.ghost.ok ? 'ghost' : 'bad');
  // open ends
  const r = 6;
  for (const q of G.open) {
    const x = edTX(q.X), y = edTY(q.N); if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
    const isA = ED.active && edPort(ED.active) === q, isJ = ED.join && edPort(ED.join) === q, hov = ED.hoverEnd === q;
    const c = Math.cos(q.h), s = Math.sin(q.h);
    g.strokeStyle = isA || isJ ? '#fff2c9' : '#f2b33d'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + c * (isA ? 22 : 12), y - s * (isA ? 22 : 12)); g.stroke();
    if (isA) { const ax = x + c * 22, ay = y - s * 22; g.fillStyle = '#fff2c9'; g.beginPath(); g.moveTo(ax + c * 7, ay - s * 7); g.lineTo(ax - s * 5, ay - c * 5); g.lineTo(ax + s * 5, ay + c * 5); g.closePath(); g.fill(); }
    g.fillStyle = isA || isJ ? '#fff2c9' : '#f2b33d'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(x, y, isA || isJ || hov ? r + 2 : r, 0, TAU); g.fill(); g.stroke();
  }
  BT.drawPeers(g);
  // problems
  const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 260);
  for (const is of G.issues) {
    const x = edTX(is.X), y = edTY(is.N); if (x < -30 || y < -30 || x > W + 30 || y > H + 30) continue;
    g.fillStyle = 'rgba(238,75,61,0.16)'; g.strokeStyle = `rgba(238,75,61,${pulse})`; g.lineWidth = 3;
    g.beginPath(); g.arc(x, y, 16 + 3 * pulse, 0, TAU); g.fill(); g.stroke();
  }
  // scale bar
  const target = 120 / sc, pow = Math.pow(10, Math.floor(Math.log10(target))), nice = [1, 2, 5, 10].map(k => k * pow).find(v => v >= target * 0.6) || pow, bw = nice * sc;
  const bx = 14, by = H - (innerWidth <= 600 ? 150 : 132) ;
  g.fillStyle = '#dfe4e6'; g.fillRect(bx, by, bw, 2); g.fillRect(bx, by - 4, 1.5, 6); g.fillRect(bx + bw - 1.5, by - 4, 1.5, 6);
  g.font = '500 11px "IBM Plex Mono", monospace'; g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillText(nice >= 1000 ? nice / 1000 + ' km' : nice + ' m', bx, by - 5);
}

/* ---------- panels ---------- */
function edMsg(t, kind = '') {
  const m = $('edMsg'); m.textContent = t; m.className = 'on ' + kind;
  clearTimeout(edMsg.t); edMsg.t = setTimeout(() => { m.className = kind; }, kind === 'bad' ? 5200 : 3400);
}
function edPanels() {
  const G = ED.G; if (!G) return;
  $('edName').value === ED.map.name || ($('edName').value = ED.map.name);
  $('edUndo').disabled = !ED.undo.length; $('edRedo').disabled = !ED.redo.length;
  $('edStats').innerHTML = G.pieces.length
    ? `<b>${fmtMi(G.len)}</b> of track · <b>${G.pieces.length}</b> pieces · <b>${G.nSw}</b> switch${G.nSw === 1 ? '' : 'es'} · <b>${G.open.length}</b> open end${G.open.length === 1 ? '' : 's'}`
    : 'Empty layout';
  const iss = $('edIssues'); iss.innerHTML = '';
  if (G.pieces.length) {
    if (!G.issues.length) { const d = document.createElement('div'); d.className = 'ok'; d.textContent = G.open.length ? 'Every joint is flush. Open ends get bumping posts.' : 'Every joint is flush and the track is continuous.'; iss.appendChild(d); }
    for (const is of G.issues.slice(0, 4)) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = is.text + ' (show)';
      b.addEventListener('click', () => { ED.view.cx = is.X; ED.view.cn = is.N; ED.view.sc = Math.max(ED.view.sc, 6); ED.dirty = true; });
      iss.appendChild(b);
    }
    if (G.issues.length > 4) { const d = document.createElement('div'); d.className = 'ok'; d.style.color = 'var(--stop)'; d.textContent = `and ${G.issues.length - 4} more marked in red`; iss.appendChild(d); }
  }
  let hint;
  if (ED.join) hint = '<b>Join:</b> now tap the open end to join it to. The editor draws the smoothest curve between them.';
  else if (ED.tab === 'tools' && ED.joinArmed) hint = '<b>Join:</b> tap the first of two open ends.';
  else if (ED.armed) hint = `Tap the map to put it down, or tap an amber end to attach it there. <b>Turn</b> and <b>Flip end</b> are under Tools. Attaching by end <b>${ED_PORT_NAMES[ED.attach % edExt(ED.armed)]}</b>.`;
  else if (ED.active) hint = 'Tap a piece below to add it at the highlighted end. Tap any other amber end to build from there, or a piece to select it.';
  else if (!G.pieces.length) hint = 'Pick a piece below and tap the map to lay it down. Then keep picking pieces: each one snaps flush onto the open end.';
  else hint = 'Tap an amber end to build from it, or tap a piece to select it.';
  $('edHint').innerHTML = hint;
  edPalState(); edSelCard();
}
function edSelCard() {
  const box = $('edSel');
  const i = ED.sel != null ? ED.idx.get(ED.sel) : undefined;
  if (i === undefined) { box.hidden = true; return; }
  const P = ED.G.pieces[i], p = P.p, lab = edLabel(p);
  const free = [...Array(edExt(p)).keys()].every(k => ED.G.ports[P.base + k].mate < 0);
  const isStart = ED.map.start && ED.map.start.id === p.id;
  const canStation = p.t === 'straight' && p.L >= 50;
  box.hidden = false;
  box.innerHTML = `<h3>${lab.h}</h3><div class="sub">${lab.s}</div>
    <div class="acts">
      <button class="btn warn" type="button" data-a="del">Delete</button>
      ${p.t !== 'turnout' ? `<button class="btn" type="button" data-a="start" aria-pressed="${!!isStart}">${isStart ? 'Start: turn around' : 'Start here'}</button>` : ''}
      ${canStation ? `<button class="btn" type="button" data-a="st" aria-pressed="${!!p.st}">${p.st ? 'Remove station' : 'Add station'}</button>` : ''}
      ${free && p.t !== 'flex' ? '<button class="btn" type="button" data-a="rl">Turn ⟲</button><button class="btn" type="button" data-a="rr">Turn ⟳</button>' : ''}
      <button class="btn" type="button" data-a="close">Done</button>
    </div>
    ${p.st ? `<div id="edSt"><input class="mpIn" id="edStName" maxlength="24" value="${(p.st.name || '').replace(/"/g, '&quot;')}" placeholder="Station name" aria-label="Station name">
      <div class="acts"><button class="btn" type="button" data-a="sl" aria-pressed="${p.st.side < 0}">Left side</button><button class="btn" type="button" data-a="sr" aria-pressed="${p.st.side > 0}">Right side</button>
      <button class="btn" type="button" data-a="big" aria-pressed="${!!p.st.big}">Town</button><button class="btn" type="button" data-a="small" aria-pressed="${!p.st.big}">Halt</button></div></div>` : ''}
    ${p.t === 'straight' && p.L < 50 ? '<div class="sub" style="margin:0">Stations go on straights of 50 m or more.</div>' : ''}`;
  box.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    const a = b.dataset.a;
    if (a === 'del') edDelete(p.id);
    else if (a === 'close') { ED.sel = null; edPanels(); ED.dirty = true; }
    else if (a === 'start') edCommit(() => { ED.map.start = isStart ? { id: p.id, dir: -(ED.map.start.dir || 1) } : { id: p.id, dir: 1 }; });
    else if (a === 'st') edUpdatePiece(p.id, x => { if (x.st) delete x.st; else x.st = { name: edStationName(), side: 1, big: true }; });
    else if (a === 'sl' || a === 'sr') edUpdatePiece(p.id, x => { x.st.side = a === 'sl' ? -1 : 1; });
    else if (a === 'big' || a === 'small') edUpdatePiece(p.id, x => { x.st.big = a === 'big'; });
    else if (a === 'rl' || a === 'rr') edRotateSel(a === 'rl' ? 1 : -1);
  }));
  const nm = $('edStName');
  if (nm) nm.addEventListener('change', () => edUpdatePiece(p.id, x => { x.st.name = nm.value.trim().slice(0, 24) || 'Station'; }));
}
function edStationName() {
  const used = new Set(ED.map.pieces.filter(p => p.st).map(p => p.st.name));
  for (const n of ['Millersburg', 'Ashland', 'Wooster', 'Orrville', 'Galion', 'Crestline', 'Bucyrus', 'Upper Sandusky', 'Marion', 'Findlay', 'Lima', 'Van Wert']) if (!used.has(n)) return n;
  return 'Station ' + (used.size + 1);
}

/* ---------- palette ---------- */
function edIcon(cv, spec) {
  const dpr = 2; cv.width = 56 * dpr; cv.height = 30 * dpr;
  const g = cv.getContext('2d'); g.scale(dpr, dpr);
  const geo = pieceGeom({ ...spec, X: 0, N: 0, h: 0 });
  let x0 = Infinity, x1 = -Infinity, n0 = Infinity, n1 = -Infinity;
  for (const path of geo.paths) for (const q of path.pts) { x0 = Math.min(x0, q.X); x1 = Math.max(x1, q.X); n0 = Math.min(n0, q.N); n1 = Math.max(n1, q.N); }
  const span = Math.max(x1 - x0, (n1 - n0) * 1.9, 30), s = 48 / span, cx = (x0 + x1) / 2, cn = (n0 + n1) / 2;
  g.lineCap = 'round'; g.strokeStyle = spec.t === 'turnout' ? '#e6d3a1' : '#c9d2d6'; g.lineWidth = 2.4;
  for (const path of geo.paths) { g.beginPath(); path.pts.forEach((q, i) => { const x = 28 + (q.X - cx) * s, y = 15 - (q.N - cn) * s; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); }
}
const ED_TABS = { straight: 'Straight', curve: 'Curve', turnout: 'Turnout', tools: 'Tools' };
function edPalette() {
  const tabs = $('edTabs'); tabs.innerHTML = '';
  for (const k in ED_TABS) {
    const b = document.createElement('button'); b.type = 'button'; b.role = 'tab'; b.textContent = ED_TABS[k]; b.setAttribute('aria-selected', String(ED.tab === k));
    b.addEventListener('click', () => { ED.tab = k; ED.joinArmed = false; ED.join = null; edPalette(); edPanels(); });
    tabs.appendChild(b);
  }
  const pal = $('edPal'); pal.innerHTML = '';
  const grp = () => { const d = document.createElement('div'); d.className = 'grp'; pal.appendChild(d); return d; };
  const piece = (host, spec, name, sub) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pc'; b.spec = spec;
    const cv = document.createElement('canvas'); edIcon(cv, spec); b.appendChild(cv);
    b.insertAdjacentHTML('beforeend', `<span>${name}</span>${sub ? `<small>${sub}</small>` : ''}`);
    b.addEventListener('click', () => edPick(spec));
    host.appendChild(b);
  };
  const chips = (host, label, vals, cur, fmt, set) => {
    const w = document.createElement('div'); w.className = 'chips'; w.innerHTML = `<span class="lbl">${label}</span>`;
    const row = document.createElement('div'); w.appendChild(row);
    for (const v of vals) { const c = document.createElement('button'); c.type = 'button'; c.className = 'chip'; c.textContent = fmt(v); c.setAttribute('aria-pressed', String(v === cur)); c.addEventListener('click', () => { set(v); edPalette(); }); row.appendChild(c); }
    host.appendChild(w);
  };
  if (ED.tab === 'straight') { const g = grp(); for (const L of STRAIGHTS) piece(g, { t: 'straight', L }, L + ' m', Math.round(L / FT) + ' ft'); }
  else if (ED.tab === 'curve') {
    const a = grp(); chips(a, 'Radius', CURVE_R, ED.curveR, v => v + ' m', v => { ED.curveR = v; }); chips(a, 'Angle', CURVE_DEG, ED.curveDeg, v => v + '°', v => { ED.curveDeg = v; });
    const b = grp();
    piece(b, { t: 'curve', R: ED.curveR, deg: ED.curveDeg, dir: 1 }, 'Left', `R ${ED.curveR} · ${ED.curveDeg}°`);
    piece(b, { t: 'curve', R: ED.curveR, deg: ED.curveDeg, dir: -1 }, 'Right', `R ${ED.curveR} · ${ED.curveDeg}°`);
  } else if (ED.tab === 'turnout') {
    for (const k of ['main', 'par', 'yard']) { const g = grp(), T = TURNOUTS[k]; for (const dir of [1, -1]) piece(g, { t: 'turnout', k, dir }, `${T.name.split(' ')[0]} ${dir > 0 ? 'L' : 'R'}`, T.sub); }
  } else {
    const g = grp();
    const tool = (name, sub, fn, pressed) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'pc'; b.style.minWidth = '74px'; b.innerHTML = `<span style="font-size:18px;line-height:30px">${sub}</span><span>${name}</span>`; if (pressed) b.setAttribute('aria-pressed', 'true'); b.addEventListener('click', fn); g.appendChild(b); return b; };
    tool('Join ends', '⤳', () => { ED.joinArmed = !ED.joinArmed; ED.join = null; ED.armed = null; ED.ghost = null; edPalette(); edPanels(); }, ED.joinArmed);
    tool('Flip end', '⇄', () => { ED.attach = (ED.attach + 1) % 3; edMsg(`New pieces attach by end ${ED_PORT_NAMES[ED.attach]}${ED.attach ? ': the far end of a straight or curve, or the straight / diverging end of a turnout.' : ', the usual end.'}`); edPanels(); edGhostAt(ED.lastPtr); });
    tool('Turn ⟲', '⟲', () => { if (ED.sel != null) edRotateSel(1); else { ED.rot = wrapPi(ED.rot + Math.PI / 12); edGhostAt(ED.lastPtr); edMsg(`Free pieces point ${Math.round((ED.rot * 180 / Math.PI + 360) % 360)}° from east.`); } });
    tool('Turn ⟳', '⟳', () => { if (ED.sel != null) edRotateSel(-1); else { ED.rot = wrapPi(ED.rot - Math.PI / 12); edGhostAt(ED.lastPtr); edMsg(`Free pieces point ${Math.round((ED.rot * 180 / Math.PI + 360) % 360)}° from east.`); } });
    tool('Delete', '⌫', () => edDeleteKey());
  }
  edPalState();
}
function edPalState() {
  for (const b of document.querySelectorAll('#edPal .pc')) if (b.spec) b.setAttribute('aria-pressed', String(!!ED.armed && JSON.stringify(ED.armed) === JSON.stringify(b.spec)));
}
function edPick(spec) {
  ED.joinArmed = false; ED.join = null;
  if (ED.active) { const E = edPort(ED.active); if (E) { ED.armed = null; ED.ghost = null; edAdd(spec, E, ED.attach); return; } }
  ED.armed = (ED.armed && JSON.stringify(ED.armed) === JSON.stringify(spec)) ? null : spec;
  if (!ED.armed) ED.ghost = null; else edGhostAt(ED.lastPtr);
  edPanels();
}
function edDeleteKey() {
  if (ED.sel != null) { edDelete(ED.sel); return; }
  if (ED.active) { edDelete(ED.active.pid); return; }
  edMsg('Select a piece first, or pick an end to delete the piece behind it.');
}

/* ---------- pointer ---------- */
function edEndAt(x, y, rad) {
  let best = null, bd = rad;
  for (const q of ED.G.open) { const d = Math.hypot(edTX(q.X) - x, edTY(q.N) - y); if (d < bd) { bd = d; best = q; } }
  return best;
}
function edPieceAt(x, y) {
  let best = null, bd = 14;
  for (const P of ED.G.pieces) {
    if (edTX(P.bb[1]) < x - 20 || edTX(P.bb[0]) > x + 20 || edTY(P.bb[2]) < y - 20 || edTY(P.bb[3]) > y + 20) continue;
    for (const path of P.g.paths) for (let i = 0; i < path.pts.length; i += 2) { const q = path.pts[i], d = Math.hypot(edTX(q.X) - x, edTY(q.N) - y); if (d < bd) { bd = d; best = P; } }
  }
  return best;
}
function edGhostAt(ptr) {
  if (!ptr || !ED.armed) { ED.ghost = null; ED.dirty = true; return; }
  const E = edEndAt(ptr.x, ptr.y, ptr.touch ? 34 : 26);
  let p;
  if (E) p = edPlace(ED.armed, E, ED.attach);
  else p = edPlace(ED.armed, null, 0, Math.round(edWX(ptr.x)), Math.round(edWN(ptr.y)), ED.rot);
  ED.ghost = { p, E, ok: edInBounds(p) };
  ED.dirty = true;
}
function edTap(x, y, touch) {
  const E = edEndAt(x, y, touch ? 30 : 20);
  if (ED.joinArmed) {
    if (!E) { edMsg('Tap an open (amber) end.'); return; }
    if (!ED.join) { ED.join = edRefOf(E); edPanels(); ED.dirty = true; return; }
    const a = ED.join; if (edPort(a) === E) { ED.join = null; edPanels(); return; }
    edJoin(a, edRefOf(E)); return;
  }
  if (ED.armed) {
    const spec = ED.armed; ED.armed = null; ED.ghost = null;
    if (E) edAdd(spec, E, ED.attach);
    else edAdd(spec, null, 0, Math.round(edWX(x)), Math.round(edWN(y)), ED.rot);
    return;
  }
  if (E) { ED.active = edRefOf(E); ED.sel = null; edPanels(); ED.dirty = true; return; }
  const P = edPieceAt(x, y);
  if (P) { ED.sel = P.p.id; edPanels(); ED.dirty = true; return; }
  ED.sel = null; ED.active = null; edPanels(); ED.dirty = true;
}
function edInput() {
  const c = $('edCanvas'), ptrs = new Map(); let tap = null, pinch = null;
  c.addEventListener('pointerdown', e => {
    c.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    tap = ptrs.size === 1 && e.button === 0 ? { x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse' } : null;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), sc: ED.view.sc, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; }
  });
  c.addEventListener('pointermove', e => {
    ED.lastPtr = { x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse' };
    if (!ptrs.has(e.pointerId)) {
      if (e.pointerType === 'mouse') { const E = edEndAt(e.clientX, e.clientY, 20); if (E !== ED.hoverEnd) { ED.hoverEnd = E; ED.dirty = true; } if (ED.armed) edGhostAt(ED.lastPtr); }
      return;
    }
    const p = ptrs.get(e.pointerId), dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 7) tap = null;
    if (ptrs.size === 2 && pinch) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      edZoom(pinch.sc * d / pinch.d / ED.view.sc, mx, my);
      ED.view.cx -= (mx - pinch.mx) / ED.view.sc; ED.view.cn += (my - pinch.my) / ED.view.sc; pinch.mx = mx; pinch.my = my;
    } else if (!tap) { ED.view.cx -= dx / ED.view.sc; ED.view.cn += dy / ED.view.sc; ED.dirty = true; if (ED.armed && e.pointerType === 'mouse') edGhostAt(ED.lastPtr); }
  });
  const up = e => {
    if (tap && ptrs.size === 1 && e.type === 'pointerup') edTap(e.clientX, e.clientY, tap.touch);
    ptrs.delete(e.pointerId); tap = null; if (ptrs.size < 2) pinch = null;
  };
  c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  c.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && ED.armed) { ED.ghost = null; ED.dirty = true; } });
  c.addEventListener('wheel', e => { e.preventDefault(); edZoom(Math.exp(-e.deltaY * 0.0016), e.clientX, e.clientY); if (ED.armed) edGhostAt(ED.lastPtr); }, { passive: false });
  c.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('keydown', e => {
    if (!ED.open) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    let used = true;
    if (mod && k === 'z') edUndo(e.shiftKey);
    else if (mod && k === 'y') edUndo(true);
    else if (k === 'delete' || k === 'backspace') edDeleteKey();
    else if (k === 'escape') { ED.armed = null; ED.ghost = null; ED.join = null; ED.joinArmed = false; ED.sel = null; edPalette(); edPanels(); ED.dirty = true; }
    else if (k === 'q' || k === 'e') { const d = k === 'q' ? 1 : -1; if (ED.sel != null) edRotateSel(d); else { ED.rot = wrapPi(ED.rot + d * Math.PI / 12); edGhostAt(ED.lastPtr); } }
    else if (k === 'f') { ED.attach = (ED.attach + 1) % 3; edPanels(); edGhostAt(ED.lastPtr); }
    else if (k === 'j') { ED.tab = 'tools'; ED.joinArmed = !ED.joinArmed; ED.join = null; edPalette(); edPanels(); }
    else used = false;
    if (used) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
}

/* ---------- files ---------- */
function edLoad(map) {
  if (BT.on && map.shared !== BT.code) BT.leave(true);   // a different layout is not the shared one
  ED.map = map;
  ED.undo = []; ED.redo = []; ED.active = null; ED.sel = null; ED.armed = null; ED.ghost = null; ED.join = null; ED.joinArmed = false;
  try { localStorage.setItem('bd_layout_last', map.id); } catch (e) {}
  edRebuild(); edFit();
}
function edFiles(show) {
  $('edFiles').hidden = !show; if (!show) return;
  const list = $('edList'); list.innerHTML = '';
  const all = Object.values(LAYOUTS.all()).sort((a, b) => (b.saved || 0) - (a.saved || 0));
  if (!all.length) list.innerHTML = '<div class="help">No saved layouts yet.</div>';
  for (const m of all) {
    const b = document.createElement('button'); b.type = 'button'; if (m.id === ED.map.id) b.setAttribute('aria-current', 'true');
    const n = (m.pieces || []).length;
    b.innerHTML = `<span></span><small>${n} piece${n === 1 ? '' : 's'}</small>`; b.firstChild.textContent = m.name || 'Untitled';
    b.addEventListener('click', () => { edLoad(m); edFiles(false); });
    list.appendChild(b);
  }
}
function edExport() {
  const blob = new Blob([JSON.stringify({ berkshireLayout: 1, ...ED.map }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = (ED.map.name || 'layout').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() + '.json';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function edValidImport(o) {
  if (!o || !Array.isArray(o.pieces) || o.pieces.length > 5000) return null;
  const num = v => typeof v === 'number' && isFinite(v);
  const pieces = [];
  for (const p of o.pieces) {
    if (!p || !num(p.X) || !num(p.N) || !num(p.h) || !num(p.id)) return null;
    const q = { id: p.id | 0, t: p.t, X: p.X, N: p.N, h: p.h };
    if (p.t === 'straight' && STRAIGHTS.includes(p.L)) q.L = p.L;
    else if (p.t === 'curve' && CURVE_R.includes(p.R) && CURVE_DEG.includes(p.deg) && (p.dir === 1 || p.dir === -1)) Object.assign(q, { R: p.R, deg: p.deg, dir: p.dir });
    else if (p.t === 'turnout' && TURNOUTS[p.k] && (p.dir === 1 || p.dir === -1)) Object.assign(q, { k: p.k, dir: p.dir });
    else if (p.t === 'flex' && p.b && num(p.b.X) && num(p.b.N) && num(p.b.h)) q.b = { X: p.b.X, N: p.b.N, h: p.b.h };
    else return null;
    if (p.st && q.t === 'straight') q.st = { name: String(p.st.name || 'Station').slice(0, 24), side: p.st.side < 0 ? -1 : 1, big: !!p.st.big };
    pieces.push(q);
  }
  const start = o.start && num(o.start.id) ? { id: o.start.id | 0, dir: o.start.dir < 0 ? -1 : 1 } : null;
  return { v: 1, id: LAYOUTS.newId(), name: String(o.name || 'Imported layout').slice(0, 32), pieces, nid: 1, start };
}

/* a sample railroad built with the same snapping the editor uses */
function edSample() {
  const m = edBlank('Lakeshore Loop');
  const add = (spec, E, j = 0) => { const p = E ? attachPiece({ ...spec, id: m.nid }, j, E) : { ...spec, id: m.nid, ...E0 }; m.nid++; m.pieces.push(p); return { p, ports: pieceGeom(p).ports }; };
  const E0 = { X: -900, N: 1600, h: 0 };
  const S = L => ({ t: 'straight', L }), C = (dir, deg = 15, R = 500) => ({ t: 'curve', R, deg, dir });
  // south side: passing siding outside the loop
  let a = add(S(200), null), end = a.ports[1];
  const t1 = add({ t: 'turnout', k: 'par', dir: -1 }, end);
  const main = add(S(200), t1.ports[1]), main2 = add(S(200), main.ports[1]);
  const sd = add(S(200), t1.ports[2]); add(S(200), sd.ports[1]);
  const t2 = add({ t: 'turnout', k: 'par', dir: 1 }, main2.ports[1], 1);
  m.start = { id: main.p.id, dir: 1 };
  end = add(S(200), t2.ports[0]).ports[1];
  // east curve
  for (let i = 0; i < 12; i++) end = add(C(1), end).ports[1];
  // north side: station and a spur to an industry
  const n1 = add(S(200), end); n1.p.st = { name: 'Lakeshore', side: 1, big: true }; end = n1.ports[1];
  end = add(S(100), end).ports[1];
  const t3 = add({ t: 'turnout', k: 'yard', dir: 1 }, end);
  let sp = add(C(-1, 15, 180), t3.ports[2]).ports[1]; sp = add(S(100), sp).ports[1]; add(S(50), sp);
  end = t3.ports[1];
  for (const L of [200, 200, 100, 50, 25]) end = add(S(L), end).ports[1];
  // a short straight join brings the north side out exactly over the start, then the west curve closes the loop
  const j = { t: 'flex', id: m.nid++, X: end.X, N: end.N, h: end.h, b: { X: E0.X, N: end.N, h: end.h } }; m.pieces.push(j);
  end = pieceGeom(j).ports[1];
  for (let i = 0; i < 12; i++) end = add(C(1), end).ports[1];
  return m;
}

/* ---------- menu hook-up ---------- */
function edOpen() {
  ED.open = true; $('editor').hidden = false;
  if (!ED.map) {
    let last = null; try { last = localStorage.getItem('bd_layout_last'); } catch (e) {}
    const m = (PLAY_LAYOUT && LAYOUTS.get(PLAY_LAYOUT.id)) || (last && LAYOUTS.get(last)) || Object.values(LAYOUTS.all())[0];
    ED.W = innerWidth; ED.H = innerHeight;
    edLoad(m || edBlank());
    if (!m) LAYOUTS.put(ED.map);
  } else { edRebuild(); }
  edPalette(); edPanels(); ED.dirty = true;
  (function tick() { if (!ED.open) return; if (ED.dirty || (ED.G && ED.G.issues.length)) { ED.dirty = false; edDraw(); } requestAnimationFrame(tick); })();
}
function edClose() { ED.open = false; $('editor').hidden = true; edFiles(false); railMenu(); }
function edDrive() {
  if (!ED.map.pieces.length) { edMsg('Lay some track first.', 'bad'); return; }
  const bad = ED.G.issues.length;
  if (bad && !ED.warned) { ED.warned = true; edMsg(`${bad} problem${bad === 1 ? ' is' : 's are'} marked in red. Tap Drive it again to drive anyway.`, 'bad'); return; }
  edSave();
  // building together: everyone driving this version of the layout meets in the same room
  location.href = location.pathname + '?layout=' + encodeURIComponent(ED.map.id) + (BT.on ? '&room=' + driveCode(BT.code, ED.map) : '');
}
function railMenu() {
  const host = $('optRail'); if (!host) return;
  host.innerHTML = '';
  const cur = PLAY_LAYOUT ? PLAY_LAYOUT.id : '';
  const opts = [['', 'Berkshire Division', '13.8 mi · built in']];
  for (const m of Object.values(LAYOUTS.all()).filter(m => (m.pieces || []).length).sort((a, b) => (b.saved || 0) - (a.saved || 0)).slice(0, 5)) opts.push([m.id, m.name || 'Untitled', `${(m.pieces || []).length} pieces · yours`]);
  for (const [id, name, sub] of opts) {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-pressed', String(id === cur));
    b.innerHTML = '<span></span><small></small>'; b.firstChild.textContent = name; b.lastChild.textContent = sub;
    const changed = id && id === cur && (LAYOUTS.get(id) || {}).saved !== PLAY_LAYOUT.saved;
    if (changed) b.lastChild.textContent = 'Edited · tap to reload';
    b.addEventListener('click', () => {
      if (id === cur && !changed) return;
      if (id && !((LAYOUTS.get(id) || {}).pieces || []).length) return;
      location.href = location.pathname + (id ? '?layout=' + encodeURIComponent(id) : '');
    });
    host.appendChild(b);
  }
}
function edInit() {
  $('btnEditor').addEventListener('click', edOpen);
  $('edBack').addEventListener('click', edClose);
  $('edDrive').addEventListener('click', edDrive);
  $('edUndo').addEventListener('click', () => edUndo(false));
  $('edRedo').addEventListener('click', () => edUndo(true));
  $('edFit').addEventListener('click', edFit);
  $('edName').addEventListener('change', () => { const v = $('edName').value.trim().slice(0, 32) || 'My railroad'; if (v !== ED.map.name) edCommit(() => { ED.map.name = v; }); });
  $('edFileBtn').addEventListener('click', () => edFiles(true));
  $('edFilesClose').addEventListener('click', () => edFiles(false));
  $('edNew').addEventListener('click', () => { const m = edBlank('Railroad ' + (Object.keys(LAYOUTS.all()).length + 1)); LAYOUTS.put(m); edLoad(m); edFiles(false); });
  $('edTpl').addEventListener('click', () => { const m = edSample(); LAYOUTS.put(m); edLoad(m); edFiles(false); edMsg('A sample loop with a passing siding, a station and a spur. Change anything.', 'good'); });
  $('edExport').addEventListener('click', edExport);
  $('edImportBtn').addEventListener('click', () => $('edImport').click());
  $('edImport').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    let o = null; try { o = edValidImport(JSON.parse(await f.text())); } catch (err) { o = null; }
    if (!o) { edMsg('That file is not a layout this editor can read.', 'bad'); return; }
    LAYOUTS.put(o); edLoad(o); edFiles(false); edMsg(`Imported ${o.name}.`, 'good');
  });
  $('edDelete').addEventListener('click', () => {
    const b = $('edDelete');
    if (!b.dataset.arm) { b.dataset.arm = '1'; b.textContent = 'Tap again to delete'; setTimeout(() => { delete b.dataset.arm; b.textContent = 'Delete this one'; }, 3000); return; }
    delete b.dataset.arm; b.textContent = 'Delete this one';
    LAYOUTS.remove(ED.map.id);
    const next = Object.values(LAYOUTS.all())[0] || edBlank(); if (!LAYOUTS.get(next.id)) LAYOUTS.put(next);
    edLoad(next); edFiles(true);
  });
  addEventListener('resize', () => { if (ED.open) ED.dirty = true; });
  edInput();
  railMenu();
  if (PLAY_LAYOUT) {
    const lede = document.querySelector('.lede');
    if (lede) lede.textContent = `${PLAY_LAYOUT.name || 'Your layout'}: a railroad you laid in the editor. Every switch can be thrown from the map or the switch card, and stations have water for the steam engines.`;
  }
}
edInit();

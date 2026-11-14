/* Clipping check for moving parts: a model is posed, every piece is taken in model space, and each piece
   that moves is tested against every piece outside its own moving group for real interpenetration (a point of
   one more than DEPTH inside the closed body of the other). Used by tests/clip.test.js. */
'use strict';
const G = require('./geocheck');
const DEPTH = 0.012;

/* pieces of the model, each tagged with the animated object (one of `movers`) it hangs from, or '', and with
   that object's own origin (its pivot) in model space.
   Pass the same `keep` map for every pose of one model and the pieces that do not move are only worked out once. */
function posedPieces(root, movers, keep) {
  const { THREE } = G.world(), out = [];
  if (keep && keep.has(root)) out.push(...keep.get(root));
  const still = keep && keep.has(root) ? null : [];
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const moverOf = o => { for (let q = o; q; q = q.parent) if (movers.has(q)) return q; return null; };
  const orgOf = mv => new THREE.Vector3().setFromMatrixPosition(mv.matrixWorld).applyMatrix4(inv);
  root.traverse(o => {
    const mv = moverOf(o), tag = mv ? movers.get(mv) : ''; if (!tag && !still) return;
    const org = mv && orgOf(mv);
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    if (o.userData && o.userData.pieces) for (const p of o.userData.pieces) { const q = G.prep(THREE, p.g.clone().applyMatrix4(m), p.k, p.at); q.tag = tag; q.org = org; out.push(q); if (!tag) still.push(q); }
    else if (o.isMesh && !(o.parent && o.parent.userData.pieces) && o.visible && o.material && o.material.visible !== false && o.material.colorWrite !== false && !o.material.isShaderMaterial && !o.material.transparent && !o.isSprite && !o.userData.noCheck) {
      const q = G.prep(THREE, o.geometry.clone().applyMatrix4(m), o.name || 'mesh', 'mesh'); q.tag = tag; q.org = org; out.push(q); if (!tag) still.push(q);
    }
  });
  if (keep && still) keep.set(root, still);
  return out;
}
/* sample points of a piece: corners, face centres and points along its edges every few centimetres */
function samples(THREE, P) {
  if (P.smp) return P.smp;
  const pts = [], seen = new Set(), add = v => { const k = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`; if (!seen.has(k)) { seen.add(k); pts.push(v); } };
  for (const t of P.tris) {
    add(t.a); add(t.b); add(t.c); add(new THREE.Vector3().add(t.a).add(t.b).add(t.c).multiplyScalar(1 / 3));
    for (const [p, q] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]]) { const L = p.distanceTo(q), n = Math.min(40, Math.floor(L / 0.04)); for (let i = 1; i <= n; i++) add(new THREE.Vector3().lerpVectors(p, q, i / (n + 1))); }
  }
  return (P.smp = pts);
}
/* a closed body: every edge is shared by an even number of faces (welded by position) */
function closed(P) {
  if (P.closed !== undefined) return P.closed;
  const E = new Map(), k = v => `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
  for (const t of P.tris) { const a = k(t.a), b = k(t.b), c = k(t.c); if (a === b || b === c || a === c) continue; for (const [p, q] of [[a, b], [b, c], [c, a]]) { const e = p < q ? p + '|' + q : q + '|' + p; E.set(e, (E.get(e) || 0) + 1); } }
  let odd = 0; for (const n of E.values()) if (n % 2) odd++;
  return (P.closed = E.size > 0 && odd === 0);
}
/* bounding sphere of each face, so a ray can skip most of them cheaply */
function balls(THREE, P) {
  if (P.balls) return P.balls;
  const b = new Float64Array(P.tris.length * 4);
  P.tris.forEach((t, i) => { const cx = (t.a.x + t.b.x + t.c.x) / 3, cy = (t.a.y + t.b.y + t.c.y) / 3, cz = (t.a.z + t.b.z + t.c.z) / 3; let r = 0; for (const v of [t.a, t.b, t.c]) r = Math.max(r, (v.x - cx) ** 2 + (v.y - cy) ** 2 + (v.z - cz) ** 2); b.set([cx, cy, cz, r], i * 4); });
  return (P.balls = b);
}
const DIRS = [[0.577, 0.5774, 0.5773], [-0.31, 0.89, 0.33], [0.72, -0.21, -0.66]];
/* how deep piece A reaches into closed piece B: the deepest sample point of A inside B (0 when none) */
function depthInto(THREE, A, B) {
  if (!A.box.intersectsBox(B.box) || !closed(B)) return 0;
  const ray = new THREE.Ray(), hit = new THREE.Vector3(), q = new THREE.Vector3(), dirs = DIRS.map(d => new THREE.Vector3(...d).normalize());
  let worst = 0, at = null; const bl = balls(THREE, B);
  for (const p of samples(THREE, A)) {
    if (!B.box.containsPoint(p)) continue;
    let inside = true;
    for (const d of dirs) {
      ray.set(p, d); let n = 0;
      for (let i = 0; i < B.tris.length; i++) {
        const ox = bl[i * 4] - p.x, oy = bl[i * 4 + 1] - p.y, oz = bl[i * 4 + 2] - p.z, along = ox * d.x + oy * d.y + oz * d.z, r2 = bl[i * 4 + 3];
        if (ox * ox + oy * oy + oz * oz - along * along > r2 || (along < 0 && ox * ox + oy * oy + oz * oz > r2)) continue;
        const t = B.tris[i]; if (ray.intersectTriangle(t.a, t.b, t.c, false, hit)) n++;
      }
      if (n % 2 === 0) { inside = false; break; }
    }
    if (!inside) continue;
    let dmin = Infinity; for (const t of B.tris) { t.closestPointToPoint(p, q); const d = q.distanceTo(p); if (d < dmin) dmin = d; if (dmin <= worst) break; }
    if (dmin > worst) { worst = dmin; at = p; }
  }
  return worst > DEPTH ? { d: worst, at } : 0;
}
/* every clipping pair in one pose: a moving piece against any piece that is not in its own group */
function clips(pieces, allow = () => false) {
  const { THREE } = G.world(), out = [];
  const mov = pieces.filter(p => p.tag);
  for (const A of mov) for (const B of pieces) {
    if (A === B || A.tag === B.tag || (B.tag && B.tag < A.tag)) continue;   // each moving pair once
    if (!A.box.intersectsBox(B.box) || allow(A, B)) continue;
    const r = depthInto(THREE, A, B) || depthInto(THREE, B, A);
    if (r) out.push({ a: A, b: B, d: r.d, at: r.at });
  }
  return out;
}
const name = p => `${p.tag || 'body'}:${p.k}@${p.at === 'mesh' ? 'mesh' : G.where(p.at)}`;
module.exports = { posedPieces, clips, name, closed, DEPTH };

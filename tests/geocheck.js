/* Geometry checks on real three.js models, with no page or GPU: builds the rolling stock from src/ in a vm context,
   keeps every piece each GeoBin is given (with the source line that added it), and finds the pieces that do not
   touch the rest of a model. Shared by tests/rollingstock.test.js.
   three.js r128 is read from tests/vendor/three.min.js (CI fetches it; locally: npm pack three@0.128.0). */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const THREE_JS = path.join(__dirname, 'vendor', 'three.min.js');
const FILES = ['01_util.js', '06_models.js', '06b_diesel.js', '06c_couplers.js', '06d_cab.js', '06g_person.js', '06h_bigboy.js', '06i_graffiti.js', '06j_turbine.js'];
const have = fs.existsSync(THREE_JS);

function Anything() {
  const fn = function () { return proxy; };
  const proxy = new Proxy(fn, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : (k in t ? t[k] : (t[k] = Anything()))), set: (t, k, v) => { t[k] = v; return true }, apply: () => proxy });
  return proxy;
}
let W = null;
function world() {
  if (W) return W;
  const ctx = { console, Math, performance: { now: () => 0 }, self: {}, window: {}, Error,
    document: { createElement: () => ({ width: 0, height: 0, getContext: () => Anything(), style: {} }), getElementById: () => Anything() },
    localStorage: { getItem: () => null, setItem() {} } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(THREE_JS, 'utf8'), ctx, { filename: 'three.min.js' });
  // one file per source so the stack names the line that added a piece
  vm.runInContext('var SCN = { winMats: [] }, SKY = { night: false }, TEX = {}, GAME = { isDiesel: () => false, train: null, settings: { finish: "standard" } }, S = { throttle: 0, reverser: 0, brakeH: 0.12, indH: 0.6, dyn: 0, whistle: 0, light: 1, bell: false };', ctx);
  const code = FILES.map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');
  vm.runInContext(code + `
    const _add = GeoBin.prototype.add;
    GeoBin.prototype.add = function (k, g, m) {
      const r = _add.call(this, k, g, m), st = (new Error().stack || '').split('\\n').slice(2).find(l => !/GeoBin\\.(box|cyl|cylX|cylZ|tube)|geocheck/.test(l)) || '';
      (this.pieces || (this.pieces = [])).push({ k, g: r, at: (st.match(/:(\\d+):\\d+\\)?$/) || [])[1] });
      return r;
    };
    const _build = GeoBin.prototype.build;
    GeoBin.prototype.build = function (mats, opt) { const grp = _build.call(this, mats, opt); grp.userData.pieces = this.pieces || []; return grp; };
    rollingMaterials();
    globalThis.__W = { buildTurbineUnit, buildTurbineTender, GT, GTT, THREE, RMAT, SCN, LOCO_SPEC, TRIM, TD, DG, GeoBin, buildBerkshire, buildTender, buildDiesel, bellRig, BELL_LOOK, bellSwing, clsLampsShow, BELL_KICK, coachModel, freightModel, truckBins, plainAxle, mergeGeos, AXJ, CH, LIVERIES, buildPerson, PD, coachInterior, coachSeats, COACH_IN, coachPairs, GRAFFITI, gfName, gfHash, graffitiSpots, rng, buildBigBoy, buildBigBoyTender, animateBigBoy, artFront, artSwing, BB, BBT, BBCAB, bxR, bxF };`,
  ctx, { filename: 'rolling.js' });
  return (W = ctx.__W);
}
/* line numbers in the concatenated source back to file:line */
const OFFS = (() => { let n = 0; return FILES.map(f => { const o = { f, n }; n += fs.readFileSync(path.join(SRC, f), 'utf8').split('\n').length; return o; }); })();
function where(line) { if (!line) return '?'; line = +line; let o = OFFS[0]; for (const x of OFFS) if (x.n < line) o = x; return `${o.f}:${line - o.n}`; }

/* triangles and vertices of a piece (already in model space), with its bounding box */
function prep(THREE, g, k, at) {
  g = g.index ? g.toNonIndexed() : g;
  const a = g.attributes.position, v = [];
  for (let i = 0; i < a.count; i++) v.push(new THREE.Vector3(a.getX(i), a.getY(i), a.getZ(i)));
  const tris = []; for (let i = 0; i + 2 < v.length; i += 3) tris.push(new THREE.Triangle(v[i], v[i + 1], v[i + 2]));
  return { k, at, v, tris, box: new THREE.Box3().setFromPoints(v) };
}
const TOL = 0.012;
function touches(THREE, A, B) {
  const bb = B.box.clone().expandByScalar(TOL), ab = A.box.clone().expandByScalar(TOL);
  if (!bb.intersectsBox(A.box)) return false;
  const q = new THREE.Vector3(), tb = new THREE.Box3();
  const near = (P, Q, box) => {
    const tris = Q.tris.filter(t => { tb.setFromPoints([t.a, t.b, t.c]).expandByScalar(TOL); return tb.intersectsBox(box); });
    if (!tris.length) return false;
    for (const p of P.v) { if (!box.containsPoint(p)) continue; for (const t of tris) { t.closestPointToPoint(p, q); if (q.distanceToSquared(p) < TOL * TOL) return true; } }
    return false;
  };
  if (near(A, B, bb) || near(B, A, ab)) return true;
  // an edge of either passing through a face of the other
  const ray = new THREE.Ray(), hit = new THREE.Vector3(), dir = new THREE.Vector3();
  const cross = (P, Q, qb) => {
    const tris = Q.tris.filter(t => { tb.setFromPoints([t.a, t.b, t.c]); return tb.intersectsBox(qb); });
    if (!tris.length) return false;
    for (const t of P.tris) for (const [p0, p1] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]]) {
      const L = dir.subVectors(p1, p0).length(); if (L < 1e-9) continue; ray.set(p0, dir.normalize());
      for (const u of tris) if (ray.intersectTriangle(u.a, u.b, u.c, false, hit) && hit.distanceTo(p0) <= L) return true;
    }
    return false;
  };
  return cross(A, B, ab) || cross(B, A, bb);
}
/* also true when one piece sits wholly inside a closed other (a pin in a boss) */
function inside(A, B) {
  if (!B.box.containsBox(A.box)) return false;
  const THREE = world().THREE, ray = new THREE.Ray(A.v[0].clone(), new THREE.Vector3(0.577, 0.5774, 0.5773).normalize()), hit = new THREE.Vector3();
  let n = 0; for (const t of B.tris) if (ray.intersectTriangle(t.a, t.b, t.c, false, hit)) n++;
  return n % 2 === 1;
}

/* every piece of a model: the GeoBin pieces of every group built into it, plus loose meshes (coupler knuckles, lenses),
   each moved into the model's space */
function modelPieces(root, { meshes = true } = {}) {
  const { THREE } = world(), out = [];
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  root.traverse(o => {
    if (o.userData && o.userData.pieces) {
      const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      for (const p of o.userData.pieces) out.push(prep(THREE, p.g.clone().applyMatrix4(m), p.k, p.at));
    } else if (meshes && o.isMesh && !(o.parent && o.parent.userData.pieces) && o.visible && o.material && o.material.visible !== false && !o.userData.noCheck && !o.material.isShaderMaterial && !(o.material.transparent && !o.material.depthWrite && !o.material.alphaTest)) {
      const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      out.push(prep(THREE, o.geometry.clone().applyMatrix4(m), o.name || 'mesh', 'mesh'));
    }
  });
  return out;
}
/* groups of pieces that touch; the biggest group is the model, the rest float */
function components(P) {
  const { THREE } = world(), par = P.map((_, i) => i), f = i => (par[i] === i ? i : (par[i] = f(par[i])));
  // sort and sweep along x so only pieces whose boxes overlap in x are compared
  const ord = P.map((_, i) => i).sort((a, b) => P[a].box.min.x - P[b].box.min.x);
  for (let ii = 0; ii < ord.length; ii++) {
    const i = ord[ii];
    for (let jj = ii + 1; jj < ord.length; jj++) {
      const j = ord[jj];
      if (P[j].box.min.x > P[i].box.max.x + TOL) break;
      if (f(i) === f(j)) continue;
      if (touches(THREE, P[i], P[j]) || inside(P[i], P[j]) || inside(P[j], P[i])) par[f(i)] = f(j);
    }
  }
  const g = new Map(); P.forEach((p, i) => { const r = f(i); if (!g.has(r)) g.set(r, []); g.get(r).push(p); });
  return [...g.values()].sort((a, b) => b.length - a.length);
}
function describe(group) {
  return group.slice(0, 4).map(p => `${p.k}@${p.at === 'mesh' ? 'mesh' : where(p.at)} [${p.box.min.toArray().map(n => n.toFixed(2))} .. ${p.box.max.toArray().map(n => n.toFixed(2))}]`).join('; ') + (group.length > 4 ? ` +${group.length - 4}` : '');
}
module.exports = { have, world, prep, modelPieces, components, describe, where, touches, TOL };

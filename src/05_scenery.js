/* ============================================================================
   Scenery: buildings, bridge, roads & crossings, pole line, signals, trees
   ========================================================================== */
const SMAT = {};
const SCN = { bins: new Map(), keepout: [], foot: [], decks: [], blocks: [], solids: new Map(), signals: [], winMats: [], lamps: [], crossings: [] };
function sceneryMaterials() {
  const brick = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#6d5b52'; g.fillRect(0, 0, w, h); const r = rng(5);
    for (let y = 0; y < h; y += 16) for (let x = ((y / 16) % 2) * 16 - 16; x < w; x += 32) {
      const v = 0.75 + r() * 0.35; g.fillStyle = `rgb(${150 * v | 0},${68 * v | 0},${50 * v | 0})`; g.fillRect(x + 1, y + 1, 30, 14);
    }
  }, { repeat: true });
  const siding = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 8) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, y + 6, w, 2); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(0, y, w, 1); } }, { repeat: true });
  const corrug = canvasTex(64, 16, (g, w, h) => { for (let x = 0; x < w; x++) { const v = 150 + 70 * Math.sin(x / w * TAU * 8); g.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`; g.fillRect(x, 0, 1, h); } }, { repeat: true });
  const shingle = canvasTex(64, 64, (g, w, h) => { const r = rng(2); g.fillStyle = '#777'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 8) for (let x = ((y / 8) % 2) * 6 - 6; x < w; x += 12) { const v = 90 + r() * 70 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 11, 7); } }, { repeat: true });
  SMAT.brick = new THREE.MeshLambertMaterial({ map: brick });
  SMAT.cream = new THREE.MeshLambertMaterial({ color: 0xd8c592, map: siding });
  SMAT.trim = new THREE.MeshLambertMaterial({ color: 0x4d3420 });
  SMAT.white = new THREE.MeshLambertMaterial({ color: 0xe9e5d8, map: siding });
  SMAT.barn = new THREE.MeshLambertMaterial({ color: 0x8c2d20, map: siding });
  SMAT.slate = new THREE.MeshLambertMaterial({ color: 0x55585e, map: shingle });
  SMAT.tin = new THREE.MeshLambertMaterial({ color: 0x9a9ea4, map: corrug });
  SMAT.rust = new THREE.MeshLambertMaterial({ color: 0x7a4a33, map: corrug });
  SMAT.concrete = new THREE.MeshLambertMaterial({ color: 0xb7b1a2, map: TEX.ground });
  SMAT.steel = new THREE.MeshStandardMaterial({ color: 0x2a2c2f, metalness: 0.5, roughness: 0.65 });
  SMAT.wood = new THREE.MeshLambertMaterial({ color: 0x7a6650, map: TEX.wood });
  SMAT.tank = new THREE.MeshLambertMaterial({ color: 0x6e5a44, map: siding });
  SMAT.stone = new THREE.MeshLambertMaterial({ color: 0x9c978c, map: TEX.ballast });
  SMAT.coal = new THREE.MeshLambertMaterial({ color: 0x1c1c1e, map: TEX.ballast });
  SMAT.black = new THREE.MeshLambertMaterial({ color: 0x1a1b1c });
  SMAT.silver = new THREE.MeshLambertMaterial({ color: 0xc8ccd0 });
  SMAT.platform = new THREE.MeshLambertMaterial({ color: 0x8e8a80, map: TEX.ground });
  SMAT.win = new THREE.MeshLambertMaterial({ color: 0x1c2228, emissive: 0xffbe6a, emissiveIntensity: 0 });
  // three sets of house and depot windows, so a town lights up over a few minutes at dusk rather
  // than all at once, and some rooms stay dark (win3: a hall lamp or a television, bluer and dim)
  SMAT.win2 = SMAT.win.clone(); SMAT.win2.emissive.set(0xffcf8a);
  SMAT.win3 = SMAT.win.clone(); SMAT.win3.emissive.set(0xc8d4ff);
  SMAT.win.userData = { litI: 1.0, perWindow: true }; SMAT.win2.userData = { litI: 0.85, perWindow: true }; SMAT.win3.userData = { litI: 0.45, perWindow: true };
  // each window decides when its room lights up and when its people go to bed (winMaterial, 10c_lamps.js)
  if (typeof winMaterial === 'function') for (const m of [SMAT.win, SMAT.win2, SMAT.win3]) winMaterial(m);
  SCN.winMats.push(SMAT.win, SMAT.win2, SMAT.win3);
  SMAT.lampGlass = new THREE.MeshLambertMaterial({ color: 0x4a4436, emissive: 0xffc27a, emissiveIntensity: 0 });
  SMAT.streetGlass = new THREE.MeshLambertMaterial({ color: 0x8a8678, emissive: 0xffc070, emissiveIntensity: 0, side: THREE.DoubleSide });
  SMAT.floodGlass = new THREE.MeshLambertMaterial({ color: 0x8c9096, emissive: 0xeef3ff, emissiveIntensity: 0 });
  SMAT.alu = new THREE.MeshLambertMaterial({ color: 0xb4b8bc });
  SMAT.gateArm = new THREE.MeshLambertMaterial({ vertexColors: true });
  SMAT.road = new THREE.MeshLambertMaterial({ color: 0x55534f, map: TEX.ground });
  SMAT.gravel = new THREE.MeshLambertMaterial({ color: 0x9f927a, map: TEX.ballast });
  SMAT.line = new THREE.MeshBasicMaterial({ color: 0xd9c56a });
  SMAT.pole = new THREE.MeshLambertMaterial({ color: 0x5b4a3a, map: TEX.wood });
  SMAT.insul = new THREE.MeshLambertMaterial({ color: 0x4f8a78 });
  SMAT.signBack = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  SMAT.lampG = new THREE.MeshBasicMaterial({ color: 0x40ff8a });
  SMAT.lampR = new THREE.MeshBasicMaterial({ color: 0xff3c2e });
  SMAT.lampY = new THREE.MeshBasicMaterial({ color: 0xffc23a });
  SMAT.lampL = new THREE.MeshBasicMaterial({ color: 0xdfe6ff });   // lunar white
  SMAT.lampOff = new THREE.MeshLambertMaterial({ color: 0x121414 });
  const xb = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#f2f1ec'; g.fillRect(0, 0, w, h); g.strokeStyle = '#111'; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6); g.fillStyle = '#111'; g.font = 'bold 30px Arial Narrow, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('RAILROAD', w / 2, h / 2 + 2); });
  SMAT.crossbuck = new THREE.MeshLambertMaterial({ map: xb });
  const xb2 = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#f2f1ec'; g.fillRect(0, 0, w, h); g.strokeStyle = '#111'; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6); g.fillStyle = '#111'; g.font = 'bold 30px Arial Narrow, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('CROSSING', w / 2, h / 2 + 2); });
  SMAT.crossbuck2 = new THREE.MeshLambertMaterial({ map: xb2 });
  SMAT.wpost = new THREE.MeshLambertMaterial({ map: canvasTex(64, 96, (g, w, h) => { g.fillStyle = '#f2f1ec'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.font = 'bold 72px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('W', w / 2, h / 2 + 4); }) });
  SMAT.yardLimit = new THREE.MeshLambertMaterial({ map: canvasTex(256, 96, (g, w, h) => { g.fillStyle = '#f2f1ec'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.font = 'bold 40px Arial Narrow, Arial'; g.textAlign = 'center'; g.fillText('YARD', w / 2, 42); g.fillText('LIMIT', w / 2, 84); }) });
}
const nameBoard = (txt) => new THREE.MeshLambertMaterial({ map: canvasTex(512, 96, (g, w, h) => { g.fillStyle = '#1b1d1c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8e3d0'; g.lineWidth = 5; g.strokeRect(8, 8, w - 16, h - 16); g.fillStyle = '#efe9d6'; g.font = 'bold 58px "Arial Narrow", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 3); }) });
/* a name board whose lettering is sized to fit, for the longer firm names */
const nameBoardFit = (txt) => new THREE.MeshLambertMaterial({ map: canvasTex(512, 96, (g, w, h) => { g.fillStyle = '#1b1d1c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8e3d0'; g.lineWidth = 5; g.strokeRect(8, 8, w - 16, h - 16); g.fillStyle = '#efe9d6'; let f = 58; g.font = `bold ${f}px "Arial Narrow", Arial`; const tw = +g.measureText(txt).width || 0; if (tw > w - 48) { f = Math.floor(f * (w - 48) / tw); g.font = `bold ${f}px "Arial Narrow", Arial`; } g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 3); }) });
const numberPlate = (txt) => new THREE.MeshLambertMaterial({ map: canvasTex(64, 128, (g, w, h) => { g.fillStyle = '#f0eee6'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.font = 'bold 30px Arial'; g.textAlign = 'center'; const t = String(txt); for (let i = 0; i < t.length; i++) g.fillText(t[i], w / 2, 34 + i * 30); }) });

/* -------- placement helpers -------- */
function binAt(X, N) {
  const k = Math.floor((X + 20000) / 1500) + ',' + Math.floor((N + 20000) / 1500);
  if (!SCN.bins.has(k)) SCN.bins.set(k, new GeoBin());
  return SCN.bins.get(k);
}
function baseM(X, y, N, yaw) { return new THREE.Matrix4().makeRotationY(yaw).setPosition(X, y, -N); }
function P(base, x, y, z, rx = 0, ry = 0, rz = 0) { return base.clone().multiply(M(x, y, z, rx, ry, rz)); }
function boxT(w, h, d, sc = 2.5) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0] / sc, uv.getY(i) * dims[f][1] / sc); }
  return g;
}
/* roofs are closed solids: the soffit (underside) sits flat on the wall tops */
function hipRoof(L, W, H, over = 0.6) {
  const l = L / 2 + over, w = W / 2 + over, r = Math.max(0, l - w);
  const v = [[-l, 0, -w], [l, 0, -w], [l, 0, w], [-l, 0, w], [-r, H, 0], [r, H, 0]];
  const f = [[0, 4, 5], [0, 5, 1], [1, 5, 2], [2, 5, 4], [2, 4, 3], [3, 4, 0], [0, 1, 2], [0, 2, 3]];
  return polyGeo(v, f, 3);
}
function gableRoof(L, W, H, over = 0.5) {
  const l = L / 2 + over, w = W / 2 + over;
  const v = [[-l, 0, -w], [l, 0, -w], [l, 0, w], [-l, 0, w], [-l, H, 0], [l, H, 0]];
  const f = [[0, 4, 5], [0, 5, 1], [2, 5, 4], [2, 4, 3], [3, 4, 0], [1, 5, 2], [0, 1, 2], [0, 2, 3]];
  return polyGeo(v, f, 3);
}
function polyGeo(v, f, sc) {
  const pos = [], uv = [];
  for (const t of f) for (const i of t) { pos.push(...v[i]); uv.push((v[i][0] + v[i][2]) / sc, v[i][1] / sc + v[i][2] / sc); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  return g;
}
function gambrel(L, W, H) {
  const s = new THREE.Shape(); const w = W / 2 + 0.4;
  s.moveTo(-w, 0); s.lineTo(-w * 0.62, H * 0.62); s.lineTo(0, H); s.lineTo(w * 0.62, H * 0.62); s.lineTo(w, 0); s.lineTo(-w, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: L + 0.8, bevelEnabled: false }); g.translate(0, 0, -(L + 0.8) / 2); g.rotateY(Math.PI / 2);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2.5, uv.getY(i) / 2.5);
  return g;
}
/* ground under a base-local footprint, as [lowest, highest] in base-local y */
function groundUnder(base, x, z, w, d) {
  const v = new THREE.Vector3(), by = base.elements[13]; let lo = Infinity, hi = -Infinity;
  for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) {
    v.set(x + (i / 4 - 0.5) * w, 0, z + (j / 4 - 0.5) * d).applyMatrix4(base);
    const g = groundAt(v.x, -v.z) - by; if (g < lo) lo = g; if (g > hi) hi = g;
  }
  return [lo, hi];
}
/* foundation under a footprint: from `top` down past the lowest ground beneath it */
function footing(gb, key, base, x, z, w, d, top = 0) {
  const lo = groundUnder(base, x, z, w, d)[0], h = top - lo + 0.3;
  if (h > 0.02) gb.add(key, boxT(w, h, d, 2), P(base, x, top - h / 2, z));
}
/* building footprints, so trees planted round buildings can keep their canopies clear of the walls */
function foot(base, x, z, w, d) { const e = base.elements, c = new THREE.Vector3(x, 0, z).applyMatrix4(base); SCN.foot.push([c.x, c.z, e[0], e[2], e[8], e[10], w / 2, d / 2]); }
/* a surface you can walk on (a platform): base-local centre x, z, size w x d, its top at base-local y top.
   Stored like a footprint with the top's world height last. */
function walkDeck(base, x, z, w, d, top) { const e = base.elements, c = new THREE.Vector3(x, top, z).applyMatrix4(base); SCN.decks.push([c.x, c.z, e[0], e[2], e[8], e[10], w / 2, d / 2, c.y]); }
/* something low you can't walk through (a bench, a cart): like a footprint, with its world bottom and top */
/* an upright thing you walk round (a mast, a leg, a post): base-local x, z, radius, height over the base */
function walkPost(base, x, z, r, h) { const c = new THREE.Vector3(x, 0, z).applyMatrix4(base); solid(c.x, c.z, r, c.y - 0.5, c.y + h); }
/* a fence run you can't walk through, between two world points, its bottom and top in world y */
function walkWall(x0, z0, x1, z1, y0, y1) { const L = Math.hypot(x1 - x0, z1 - z0) || 1, ax = (x1 - x0) / L, az = (z1 - z0) / L; SCN.blocks.push([(x0 + x1) / 2, (z0 + z1) / 2, ax, az, -az, ax, L / 2, 0.05, y0, y1]); }
function walkBlock(base, x, z, w, d, y0, y1) { const e = base.elements, c = new THREE.Vector3(x, 0, z).applyMatrix4(base); SCN.blocks.push([c.x, c.z, e[0], e[2], e[8], e[10], w / 2, d / 2, c.y + y0, c.y + y1]); }
function inFoot(X, N, pad) {
  for (const f of SCN.foot) { const dx = X - f[0], dz = -N - f[1]; if (Math.abs(dx * f[2] + dz * f[3]) < f[6] + pad && Math.abs(dx * f[4] + dz * f[5]) < f[7] + pad) return true; }
  return false;
}
/* distance from a plan point to the nearest track centre line, leaving out the edges in skip */
function trackGap(X, N, skip) {
  let d = Infinity;
  for (const e of NET.edges) {
    if (skip && skip.includes(e)) continue;
    if (!e.bb) { e.bb = [Infinity, -Infinity, Infinity, -Infinity]; for (let i = 0; i < e.n; i++) { e.bb[0] = Math.min(e.bb[0], e.X[i]); e.bb[1] = Math.max(e.bb[1], e.X[i]); e.bb[2] = Math.min(e.bb[2], e.N[i]); e.bb[3] = Math.max(e.bb[3], e.N[i]); } }
    const r = Math.min(d, 60);
    if (X < e.bb[0] - r || X > e.bb[1] + r || N < e.bb[2] - r || N > e.bb[3] + r) continue;
    for (let i = 0; i < e.n; i++) { const dd = Math.hypot(e.X[i] - X, e.N[i] - N); if (dd < d) d = dd; }
  }
  return d;
}
function keep(X, N, r) { SCN.keepout.push([X, N, r]); }
/* upright solids the camera keeps out of (tree canopies, poles): world x, z, radius, bottom, top, in 40 m cells */
function solid(x, z, r, y0, y1) { const k = Math.floor(x / 40) + ',' + Math.floor(z / 40); let l = SCN.solids.get(k); if (!l) SCN.solids.set(k, l = []); l.push([x, z, r, y0, y1]); }
const kept = (X, N, pad = 0) => { for (const k of SCN.keepout) if ((X - k[0]) ** 2 + (N - k[1]) ** 2 < (k[2] + pad) ** 2) return true; return false; };
/* frame on a line at distance sLine with lateral offset: returns {X,N,y,yaw} */
function linePlace(line, sLine, lat = 0) {
  const loc = line.locate(sLine); loc.edge.pose(loc.s, FR);
  const yaw = Math.atan2(-FR.f.z, FR.f.x);
  const X = FR.p.x + Math.sin(yaw) * lat, N = -(FR.p.z + Math.cos(yaw) * lat);
  return { X, N, y: FR.p.y, yaw, edge: loc.edge, s: loc.s };
}
/* plan point at lateral offset lat from a placement */
const latXN = (pl, lat) => [pl.X + Math.sin(pl.yaw) * lat, pl.N - Math.cos(pl.yaw) * lat];
/* like linePlace, but stepped outward (away from the line) until it is gap metres clear of every track */
function clearPlace(line, sLine, lat, gap = 3.4) {
  const d = Math.sign(lat) || 1;
  for (let k = 0; k < 80; k++, lat += d * 0.5) { const pl = linePlace(line, sLine, lat); if (trackGap(pl.X, pl.N) >= gap) return pl; }
  return linePlace(line, sLine, lat);
}
/* set the two numbers a window's lighting hangs on (any geometry: every vertex gets the same pair) */
function winSeed(geo, m) {
  const e = m ? m.elements : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, Math.random() * 1e3, Math.random() * 1e3, Math.random() * 1e3];
  const h = (x, y, z, k) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + k * 4.581) * 43758.5453; return s - Math.floor(s); };
  const a = h(e[12], e[13], e[14], 1), b = h(e[12], e[13], e[14], 2), n = geo.attributes.position.count, uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { uv[i * 2] = a; uv[i * 2 + 1] = b; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
const WIN_SETS = ['win', 'win', 'win2', 'win2', 'win3'];
function windowsRow(gb, base, x0, x1, y, z, w, h, n, face = 1) {
  const e = base.elements, seed = Math.abs(Math.round(e[12] * 7.3 + e[14] * 3.1 + y * 11 + z * 5));
  for (let i = 0; i < n; i++) { const x = n === 1 ? (x0 + x1) / 2 : lerp(x0, x1, i / (n - 1)); { const m = P(base, x, y, z + face * 0.03); gb.add(WIN_SETS[(seed + i * 3) % 5], winSeed(new THREE.BoxGeometry(w, h, 0.06), m), m); } gb.add('trim', new THREE.BoxGeometry(w + 0.16, 0.1, 0.1), P(base, x, y - h / 2 - 0.05, z + face * 0.05)); }
}

/* -------- buildings -------- */
/* every lamp on the railroad: { kind, p (where the light comes from), gp (where its glow shows, if not p) }.
   Lit after dark, and the nearest ones really light their surroundings: see 10c_lamps.js */
const LAMPS = { lights: [], sig: [] };
const lampAt = (kind, m, x, y, z, more) => { const l = { kind, p: new THREE.Vector3(x, y, z).applyMatrix4(m), ...more }; LAMPS.lights.push(l); return l; };
/* a platform lamp post on a depot's platform: cast iron plinth and post, a glazed lantern and its cap.
   x, z are in the depot's own frame, whose platform top is at y = 0.16. */
function platformLamp(gb, base, x, z) {
  gb.add('black', new THREE.CylinderGeometry(0.15, 0.19, 0.36, 10), P(base, x, 0.16 + 0.18 - 0.01, z));   // sits 1 cm into the boards
  { const m = new THREE.Vector3(x, 0, z).applyMatrix4(base); solid(m.x, m.z, 0.19, m.y, m.y + 4.3); }
  gb.add('black', new THREE.CylinderGeometry(0.055, 0.075, 3.12, 8), P(base, x, 0.5 + 1.56, z));
  gb.add('black', new THREE.BoxGeometry(0.36, 0.05, 0.36), P(base, x, 3.6, z));
  gb.add('lampGlass', new THREE.BoxGeometry(0.3, 0.38, 0.3), P(base, x, 3.6 + 0.02 + 0.19, z));
  gb.add('black', new THREE.ConeGeometry(0.27, 0.22, 4, 1).rotateY(Math.PI / 4), P(base, x, 4.0 + 0.11 - 0.005, z));
  gb.add('black', new THREE.SphereGeometry(0.05, 8, 6), P(base, x, 4.24, z));
  lampAt('plat', base, x, 3.81, z);
}
/* a gooseneck lamp over a door: a curved arm out of the wall and an enamel shade. x, z: the wall's face
   in base's frame (facing +z), y: the top of the arm */
function doorLamp(gb, base, x, y, z) {
  gb.add('black', new THREE.BoxGeometry(0.14, 0.14, 0.04), P(base, x, y - 0.1, z + 0.02));
  gb.add('black', new THREE.TorusGeometry(0.28, 0.02, 5, 10, Math.PI / 2), P(base, x, y - 0.32, z + 0.04, 0, -Math.PI / 2, 0).multiply(M(0, 0, 0, 0, 0, 0)));
  gb.add('black', new THREE.ConeGeometry(0.2, 0.14, 12, 1, true), P(base, x, y - 0.38, z + 0.33));
  gb.add('streetGlass', new THREE.CircleGeometry(0.12, 10).rotateX(Math.PI / 2), P(base, x, y - 0.44, z + 0.33));
  lampAt('door', base, x, y - 0.5, z + 0.33);
}
/* a town street light: a wooden pole with a mast arm and a cobra head over the street (local +z) */
function streetLamp(X, N, yaw) {
  const y = groundAt(X, N), base = baseM(X, y, N, yaw), gb = binAt(X, N);
  gb.add('pole', new THREE.CylinderGeometry(0.11, 0.15, 9.4, 8), P(base, 0, 4.4, 0));   // 0.3 m in the ground
  gb.add('steel', new THREE.CylinderGeometry(0.045, 0.045, 2.1, 6), P(base, 0, 8.25, 1.0, Math.PI / 2 - 0.08, 0, 0));
  gb.add('steel', new THREE.CylinderGeometry(0.025, 0.025, 1.2, 5), P(base, 0, 7.8, 0.55, Math.PI / 2 - 0.75, 0, 0));
  gb.add('steel', new THREE.BoxGeometry(0.2, 0.2, 0.3), P(base, 0, 8.2, 0.16));
  gb.add('silver', new THREE.SphereGeometry(0.3, 10, 6, 0, TAU, 0, Math.PI / 2).scale(0.75, 0.45, 1.25), P(base, 0, 8.27, 2.2, 0.08, 0, 0));
  gb.add('streetGlass', new THREE.CylinderGeometry(0.2, 0.2, 0.06, 12).scale(1, 1, 1.5), P(base, 0, 8.24, 2.2, 0.08, 0, 0));
  lampAt('street', base, 0, 8.05, 2.25, { gp: new THREE.Vector3(0, 8.15, 2.22).applyMatrix4(base) });
  keep(X, N, 1.2);
}
/* a yard floodlight tower: a tapered steel pole, a platform with a rail, and a bank of floodlights
   tipped down toward the tracks (local +z) */
function floodTower(X, N, yaw) {
  const y = groundAt(X, N), base = baseM(X, y, N, yaw), gb = binAt(X, N), H = 21;
  footing(gb, 'concrete', base, 0, 0, 1.4, 1.4, 0.25);
  gb.add('steel', new THREE.CylinderGeometry(0.22, 0.38, H, 10), P(base, 0, H / 2, 0));
  for (let k = 0; k < 18; k++) gb.add('steel', new THREE.BoxGeometry(0.04, 0.04, 0.4), P(base, 0, 1.5 + k * 1.05, -0.32));   // step bolts
  gb.add('steel', new THREE.BoxGeometry(2.6, 0.1, 1.8), P(base, 0, H, 0.2));
  for (const z of [-0.7, 1.1]) gb.add('steel', new THREE.BoxGeometry(2.6, 0.05, 0.05), P(base, 0, H + 1.0, z));
  for (const x of [-1.28, 1.28]) gb.add('steel', new THREE.BoxGeometry(0.05, 0.05, 1.8), P(base, x, H + 1.0, 0.2));
  for (const x of [-1.28, 0, 1.28]) for (const z of [-0.7, 1.1]) gb.add('steel', new THREE.BoxGeometry(0.05, 1.0, 0.05), P(base, x, H + 0.5, z));
  gb.add('steel', new THREE.BoxGeometry(2.5, 0.08, 0.08), P(base, 0, H + 1.6, 1.15));
  for (let i = 0; i < 6; i++) {
    const x = -1.0 + (i % 3) * 1.0, yy = H + (i < 3 ? 1.95 : 1.25), m = P(base, x, yy, 1.25, 0.7, 0, 0);
    gb.add('black', new THREE.BoxGeometry(0.62, 0.5, 0.36), m.clone().multiply(M(0, 0, -0.1)));
    gb.add('floodGlass', new THREE.PlaneGeometry(0.56, 0.44), m.clone().multiply(M(0, 0, 0.081)));
  }
  lampAt('flood', base, 0, H + 1.2, 2.0, { gp: new THREE.Vector3(0, H + 1.6, 1.5).applyMatrix4(base) });
  keep(X, N, 2);
}

function depot(pl, name, big) {
  const L = big ? 26 : 16, W = big ? 8 : 6.5, H = 4.1;
  const off = pl.lat;
  const base = baseM(pl.X, pl.y - 0.15, pl.N, pl.yaw + (off < 0 ? 0 : Math.PI));
  const gb = binAt(pl.X, pl.N);
  gb.add('brick', boxT(L, 0.9, W, 2), P(base, 0, 0.45, 0));
  footing(gb, 'brick', base, 0, 0, L, W);
  gb.add('cream', boxT(L - 0.1, H - 0.9, W - 0.1, 2), P(base, 0, 0.9 + (H - 0.9) / 2, 0));
  gb.add('trim', new THREE.BoxGeometry(L + 0.1, 0.18, W + 0.1), P(base, 0, 0.95, 0));
  gb.add('trim', new THREE.BoxGeometry(L + 0.1, 0.25, W + 0.1), P(base, 0, H - 0.1, 0));
  // operator's bay facing track (+z side of base faces the track)
  gb.add('brick', boxT(3.2, 0.9, 1.4, 2), P(base, 0, 0.45, W / 2 + 0.6));
  gb.add('cream', boxT(3.1, H - 0.9, 1.35, 2), P(base, 0, 0.9 + (H - 0.9) / 2, W / 2 + 0.6));
  gb.add('trim', new THREE.BoxGeometry(3.3, 0.18, 1.5), P(base, 0, 0.95, W / 2 + 0.6));
  windowsRow(gb, base, -1.0, 1.0, 2.4, W / 2 + 1.275, 0.8, 1.5, 2);
  windowsRow(gb, base, -L / 2 + 2, -2.6, 2.4, W / 2 - 0.05, 0.9, 1.6, big ? 4 : 2);
  windowsRow(gb, base, 2.6, L / 2 - 2, 2.4, W / 2 - 0.05, 0.9, 1.6, big ? 3 : 2);
  windowsRow(gb, base, -L / 2 + 2, L / 2 - 2, 2.4, -W / 2 + 0.05, 0.9, 1.6, big ? 6 : 4, -1);
  // freight doors
  gb.add('trim', new THREE.BoxGeometry(2.4, 2.6, 0.14), P(base, L / 2 - 2.5, 1.36, W / 2));
  gb.add('slate', hipRoof(L, W, 2.6, 1.6), P(base, 0, H, 0));
  // roof brackets
  for (let x = -L / 2 + 1; x <= L / 2 - 1; x += 3) for (const z of [-1, 1]) gb.add('trim', new THREE.BoxGeometry(0.14, 0.7, 1.4), P(base, x, H - 0.45, z * (W / 2 + 0.6), z * 0.6, 0, 0));
  gb.add('brick', boxT(0.7, 2.2, 0.7, 2), P(base, L / 4, H + 2.0, -0.6));
  // platform along the track
  gb.add('platform', boxT(L + 50, 0.32, 5.2, 3), P(base, 0, 0.0, W / 2 + 2.7));
  footing(gb, 'concrete', base, 0, W / 2 + 2.7, L + 50, 5.2, -0.16);
  walkDeck(base, 0, W / 2 + 2.7, L + 50, 5.2, 0.16);
  foot(base, 0, 0, L + 0.2, W + 0.2); foot(base, 0, W / 2 + 0.6, 3.3, 1.5);
  // lamp posts along the back of the platform, beyond the depot's ends
  for (const lx of [-(L / 2 + 20), -(L / 2 + 9), L / 2 + 11, L / 2 + 20]) platformLamp(gb, base, lx, W / 2 + 0.9);
  doorLamp(gb, base, L / 2 - 2.5, 3.25, W / 2);   // over the freight door
  // name boards on both ends + track side
  const nb = nameBoard(name);
  const mat = 'nb_' + name;
  SMAT[mat] = nb;
  gb.add(mat, new THREE.PlaneGeometry(2.9, 0.5), P(base, 0, 3.55, W / 2 + 1.285));
  for (const s of [-1, 1]) gb.add(mat, new THREE.PlaneGeometry(3.4, 0.65), P(base, s * (L / 2 - 0.045), H - 0.8, 0, 0, s * Math.PI / 2, 0));
  // benches on the platform (top at 0.16)
  for (const bx of [-L / 2 + 2.2, -L / 2 + 5, 3.2]) {
    const bz = W / 2 + 0.7;
    gb.add('trim', new THREE.BoxGeometry(1.8, 0.06, 0.45), P(base, bx, 0.6, bz));
    gb.add('trim', new THREE.BoxGeometry(1.8, 0.4, 0.05), P(base, bx, 0.83, bz - 0.2));
    for (const lx of [-0.75, 0.75]) gb.add('trim', new THREE.BoxGeometry(0.06, 0.42, 0.42), P(base, bx + lx, 0.36, bz));
    walkBlock(base, bx, bz - 0.05, 1.85, 0.55, 0.16, 1.05);
  }
  gb.add('wood', boxT(2.8, 0.7, 1.2), P(base, L / 2 + 6, 0.51, W / 2 + 2.6));
  walkBlock(base, L / 2 + 6, W / 2 + 2.6, 2.8, 1.2, 0.16, 0.86);
  { const m = new THREE.Vector3(0, 0, W / 2 + 2.4).applyMatrix4(base); solid(m.x, m.z, 0.18, m.y, m.y + 7.3); }
  // train order signal mast at the bay
  gb.add('steel', new THREE.CylinderGeometry(0.08, 0.1, 7, 8), P(base, 0, 3.5 + 0.16, W / 2 + 2.4));
  gb.add('steel', new THREE.CylinderGeometry(0.16, 0.18, 0.12, 10), P(base, 0, 0.22, W / 2 + 2.4));
  for (const s of [-1, 1]) gb.add('redPaint', new THREE.BoxGeometry(1.4, 0.3, 0.05), P(base, s * (0.04 + 0.7 * Math.cos(0.7)), 6.3 + 0.7 * Math.sin(0.7), W / 2 + 2.4, 0, 0, s * 0.7));
  keep(pl.X, pl.N, L / 2 + 8);
  SCN.lamps.push(new THREE.Vector3().setFromMatrixPosition(P(base, 0, 3.4, W / 2 + 1.7)));
}
/* A plank walk over both main tracks at the depot, for trains on the far main: planks between the rails
   like a road crossing, and timber decking between the tracks (and out to a depot beyond track 2, or beyond
   a siding past it) set down into the ballast. Track 2 is on the left (-z) of track 1; distances here are
   to the left. A siding between the mains and the depot lies one more track spacing out. */
function stationCrossing(st) {
  const sp = ROUTE.spacing, W = st.kind === 'depot' ? 8 : 6.5, across = st.across || 0;
  const loc = st.line.locate(st.sLine); loc.edge.pose(loc.s, FR);
  const gb = binAt(FR.p.x, -FR.p.z), m1 = frameMatrix(FR, new THREE.Matrix4());
  const deck = (m, z0, z1, depth) => gb.add('wood', boxT(3.0, depth, Math.abs(z1 - z0)), m.clone().multiply(M(0, -0.01 - depth / 2, -(z0 + z1) / 2)));
  const l2 = ROUTE.main2.locate(ROUTE.to2(st.sLine)); l2.edge.pose(l2.s, FR2);
  const out = -st.side, tracks = [[m1, 0], [frameMatrix(FR2, new THREE.Matrix4()), sp]];   // out: +1 when the depot is on the left
  for (let k = out > 0 ? 2 : 1; k * sp <= across + 0.01; k++) tracks.push([m1.clone().multiply(M(0, 0, -out * k * sp)), out * k * sp]);
  tracks.sort((a, b) => a[1] - b[1]);
  for (const [m] of tracks) for (const z of [[-0.66, 0.66], [-1.5, -0.84], [0.84, 1.5]]) gb.add('wood', boxT(3.0, 0.18, z[1] - z[0]), m.clone().multiply(M(0, -0.1, (z[0] + z[1]) / 2)));
  for (let i = 0; i + 1 < tracks.length; i++) { const a = tracks[i][1], b = tracks[i + 1][1]; deck(m1, a + 1.5, b - 1.5, a === 0 && b === sp ? 0.6 : 1.0); }
  // and out to the track edge of the depot's platform
  if (across) {
    const near = 12 + across - W / 2 - 2.7 - 2.6, far = out > 0 ? tracks[tracks.length - 1][1] : -tracks[0][1];
    if (near > far + 1.5) deck(m1, out * (far + 1.5), out * near, 1.2);
  }
}
function waterColumn(pl) {
  const base = baseM(pl.X, pl.y - 0.2, pl.N, pl.yaw + (pl.lat < 0 ? 0 : Math.PI));
  const gb = binAt(pl.X, pl.N);
  gb.add('steel', new THREE.CylinderGeometry(0.35, 0.45, 0.6, 12), P(base, 0, 0.3, 0));
  footing(gb, 'concrete', base, 0, 0, 1.2, 1.2, 0.02); walkPost(base, 0, 0, 0.5, 5);
  gb.add('steel', new THREE.CylinderGeometry(0.2, 0.2, 4.4, 12), P(base, 0, 2.6, 0));
  gb.add('steel', new THREE.CylinderGeometry(0.17, 0.17, 3.0, 10), P(base, 1.4, 4.7, 0.25, 0, 0, Math.PI / 2));
  gb.add('steel', new THREE.CylinderGeometry(0.16, 0.2, 1.1, 10), P(base, 2.85, 4.25, 0.25));
  gb.add('steel', new THREE.BoxGeometry(0.4, 0.4, 0.5), P(base, 0, 4.6, -0.4));
  gb.add('steel', new THREE.TorusGeometry(0.28, 0.03, 6, 16), P(base, 0.3, 1.4, 0, 0, Math.PI / 2, 0));
  gb.add('steel', new THREE.CylinderGeometry(0.035, 0.035, 0.16, 6), P(base, 0.24, 1.4, 0, 0, 0, Math.PI / 2));
  for (const a of [0, Math.PI / 2]) gb.add('steel', new THREE.BoxGeometry(0.03, 0.56, 0.03), P(base, 0.3, 1.4, 0, a, 0, 0));
  keep(pl.X, pl.N, 6);
}
function waterTower(pl) {
  const base = baseM(pl.X, pl.y - 0.3, pl.N, pl.yaw + Math.PI);
  const gb = binAt(pl.X, pl.N);
  const H = 9;
  for (const [x, z] of [[-2.6, -2.6], [2.6, -2.6], [2.6, 2.6], [-2.6, 2.6]]) {
    // legs splay outward toward the foot; each stands on a concrete pier
    gb.add('steel', new THREE.CylinderGeometry(0.16, 0.22, H, 8), P(base, x * 0.92, H / 2, z * 0.92 + 1.6, -z * 0.03, 0, x * 0.03));
    const sp = Math.sin(2.6 * 0.03) * H / 2 / 2.6;
    footing(gb, 'concrete', base, x * (0.92 + sp), z * (0.92 + sp) + 1.6, 0.9, 0.9, 0.25); walkPost(base, x * (0.92 + sp), z * (0.92 + sp) + 1.6, 0.55, 9);
  }
  for (const y of [3, 6]) { gb.add('steel', new THREE.BoxGeometry(5.0, 0.12, 0.12), P(base, 0, y, -2.4 + 1.6)); gb.add('steel', new THREE.BoxGeometry(5.0, 0.12, 0.12), P(base, 0, y, 2.4 + 1.6)); gb.add('steel', new THREE.BoxGeometry(0.12, 0.12, 5), P(base, -2.4, y, 1.6)); gb.add('steel', new THREE.BoxGeometry(0.12, 0.12, 5), P(base, 2.4, y, 1.6)); }
  gb.add('steel', new THREE.BoxGeometry(6.4, 0.3, 6.4), P(base, 0, H, 1.6));
  gb.add('tank', new THREE.CylinderGeometry(3.6, 3.7, 5.2, 28), P(base, 0, H + 2.7, 1.6));
  for (let y = 0.4; y < 5.2; y += 0.7) gb.add('steel', new THREE.TorusGeometry(3.7 - 0.1 * (y + 0.06) / 5.2 + 0.02, 0.04, 4, 32), P(base, 0, H + 0.2 + y, 1.6, Math.PI / 2, 0, 0));
  gb.add('slate', new THREE.ConeGeometry(4.1, 2.2, 28), P(base, 0, H + 6.4, 1.6));
  gb.add('steel', new THREE.CylinderGeometry(0.24, 0.24, 3.6, 10), P(base, 0, H + 0.4, 6.2, Math.PI / 2 + 0.45, 0, 0));
  gb.add('steel', new THREE.CylinderGeometry(0.03, 0.03, 3.4, 6), P(base, 0, H - 0.4 - 1.65, 7.7));
  keep(pl.X, pl.N, 8);
}
function coalingTower(pl) {
  const base = baseM(pl.X, pl.y - 0.25, pl.N, pl.yaw);
  const gb = binAt(pl.X, pl.N);
  // straddles the track: legs at z = ±3.2
  for (const z of [-3.4, 3.4]) for (const x of [-4.5, 4.5]) { walkPost(base, x, z, 0.8, 7.5); gb.add('concrete', boxT(1.1, 7.5, 1.1), P(base, x, 3.75, z)); footing(gb, 'concrete', base, x, z, 1.5, 1.5, 0.1); }
  gb.add('concrete', boxT(11, 15, 9, 3), P(base, 0, 7.5 + 7.5, 0));
  gb.add('concrete', boxT(11.4, 0.5, 9.4), P(base, 0, 7.5, 0));
  gb.add('tin', boxT(6, 4, 5, 2), P(base, 0, 24.5, 0));
  gb.add('slate', gableRoof(6, 5, 1.6, 0.3), P(base, 0, 26.5, 0));
  for (const x of [-2.5, 2.5]) gb.add('steel', new THREE.BoxGeometry(0.8, 0.6, 3.2), P(base, x, 6.7, 1.2, -0.6, 0, 0));
  windowsRow(gb, base, -3.5, 3.5, 18, 4.5, 0.8, 1.2, 3);
  // conveyor/hoist house at side, on whichever side is clear of the neighbouring track
  const sd = trackGap(...latXN(pl, 8)) >= 4.5 ? 1 : -1;
  gb.add('tin', boxT(4, 3, 4), P(base, 0, 1.5, sd * 8));
  footing(gb, 'concrete', base, 0, sd * 8, 4.2, 4.2, 0.05); foot(base, 0, sd * 8, 4.2, 4.2);
  gb.add('tin', gableRoof(4, 4, 0.9, 0.2), P(base, 0, 3, sd * 8));
  // inclined conveyor from the hoist house roof into the bin
  gb.add('steel', new THREE.BoxGeometry(1.4, 1.4, 10.6), P(base, 0, 7.75, sd * 5.95, -sd * Math.atan2(9.7, 4.1), 0, 0));
  keep(pl.X, pl.N, 9);
}
function sandHouse(pl) {
  const base = baseM(pl.X, pl.y - 0.2, pl.N, pl.yaw);
  const gb = binAt(pl.X, pl.N);
  gb.add('brick', boxT(8, 4, 5, 2), P(base, 0, 2, 8));
  footing(gb, 'concrete', base, 0, 8, 8.2, 5.2, 0.05); foot(base, 0, 8, 8.2, 5.2);
  gb.add('slate', gableRoof(8, 5, 1.4), P(base, 0, 4, 8));
  // dry-sand bin on four legs between the house and the track, spout raised clear of engines
  for (const x of [-0.68, 0.68]) for (const z of [2.72, 4.08]) gb.add('steel', new THREE.CylinderGeometry(0.08, 0.08, 6.4, 6), P(base, x, 3.2, z));
  footing(gb, 'concrete', base, 0, 3.4, 2.0, 2.0, 0.05); foot(base, 0, 3.4, 2.0, 2.0);
  gb.add('steel', new THREE.CylinderGeometry(1.0, 1.0, 3.5, 14), P(base, 0, 7.8, 3.4));
  gb.add('steel', new THREE.ConeGeometry(1.0, 1.2, 14), P(base, 0, 5.45, 3.4, Math.PI, 0, 0));
  gb.add('steel', new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6), P(base, 0, 6.5, 2.15, -0.695, 0, 0));
  gb.add('steel', new THREE.BoxGeometry(0.12, 0.12, 4.6), P(base, 0, 5.2, 5.5, 0.35, 0, 0));
}
function engineHouse(pl) {
  const base = baseM(pl.X, pl.y - 0.25, pl.N, pl.yaw);
  const gb = binAt(pl.X, pl.N);
  const L = 48, W = 10, H = 8.5;
  gb.add('brick', boxT(L, H, 0.8, 2.4), P(base, 0, H / 2, W / 2));
  gb.add('brick', boxT(L, H, 0.8, 2.4), P(base, 0, H / 2, -W / 2));
  gb.add('brick', boxT(0.8, H, W, 2.4), P(base, L / 2, H / 2, 0));
  for (const z of [-1, 1]) gb.add('brick', boxT(0.8, H, 3.1, 2.4), P(base, -L / 2, H / 2, z * 3.45));
  gb.add('brick', boxT(0.8, H - 6.0, 3.8, 2.4), P(base, -L / 2, 6.0 + (H - 6.0) / 2, 0));
  gb.add('trim', new THREE.BoxGeometry(0.2, 6.0, 1.9), P(base, -L / 2 - 1.0, 3.03, -2.6, 0, -0.9, 0));
  gb.add('trim', new THREE.BoxGeometry(0.2, 6.0, 1.9), P(base, -L / 2 - 1.0, 3.03, 2.6, 0, 0.9, 0));
  footing(gb, 'concrete', base, 0, 0, L + 0.8, W + 0.8);   // no footprint: the engines run in through the doors
  for (const z of [-1, 1]) { walkBlock(base, 0, z * W / 2, L + 0.8, 0.8, -0.5, H); walkBlock(base, -L / 2, z * 3.45, 0.8, 3.1, -0.5, H); }   // the walls you walk round
  walkBlock(base, L / 2, 0, 0.8, W, -0.5, H);
  for (const z of [-1, 1]) { footing(gb, 'concrete', base, -L / 2 - 1.3, z * 2.9, 2.0, 2.0); foot(base, -L / 2 - 1.3, z * 2.9, 2.0, 2.0); }
  gb.add('tin', boxT(L + 0.9, 0.3, W + 0.9), P(base, 0, H + 0.15, 0));
  gb.add('slate', gableRoof(L, W, 2.2, 0.5), P(base, 0, H + 0.3, 0));
  windowsRow(gb, base, -L / 2 + 4, L / 2 - 4, 5.2, W / 2 + 0.4, 1.5, 3.0, 8);
  windowsRow(gb, base, -L / 2 + 4, L / 2 - 4, 5.2, -W / 2 - 0.4, 1.5, 3.0, 8, -1);
  for (const x of [-14, 0, 14]) gb.add('black', new THREE.CylinderGeometry(0.55, 0.85, 3.0, 10), P(base, x, H + 3.0, 0));
  gb.add('concrete', boxT(L, 0.12, W - 1), P(base, 0, 0.0, 0));
  keep(pl.X, pl.N, L / 2 + 6);
}
/* floodlight towers along Bellevue Yard (beyond its outside track) and at the engine terminal, each
   standing clear of every track and building and facing back over the tracks */
function yardFloods() {
  const spots = [];
  const y4 = ROUTE.lines['Yard 4'], eng = ROUTE.features.engine;
  if (y4) for (const f of [0.22, 0.5, 0.78]) spots.push([y4, y4.len * f]);
  if (eng) spots.push([eng, eng.len * 0.45]);
  for (const [ln, sL] of spots) {
    // the outer side: the one without a neighbouring track a track spacing away
    const out = [-1, 1].sort((a, b) => { const qa = linePlace(ln, sL, a * 4.5), qb = linePlace(ln, sL, b * 4.5); return trackGap(qb.X, qb.N, [ln.locate(sL).edge]) - trackGap(qa.X, qa.N, [ln.locate(sL).edge]); })[0];
    let q = null;
    for (let lat = 6; lat < 40 && !q; lat += 1) {
      const c = linePlace(ln, sL, out * lat);
      if (trackGap(c.X, c.N) >= 5.5 && !kept(c.X, c.N, 3) && !inFoot(c.X, c.N, 3)) q = c;
    }
    if (!q) continue;
    const look = linePlace(ln, sL, -out * 6);
    floodTower(q.X, q.N, Math.atan2(look.X - q.X, -(look.N - q.N)));
  }
}
function yardOffice(pl) {
  const base = baseM(pl.X, pl.y - 0.2, pl.N, pl.yaw);
  const gb = binAt(pl.X, pl.N);
  gb.add('cream', boxT(8, 3.4, 5, 2), P(base, 0, 1.7, 0));
  footing(gb, 'concrete', base, 0, 0, 8.2, 5.2, 0.05); foot(base, 0, 0, 8.2, 5.2);
  gb.add('slate', gableRoof(8, 5, 1.8, 0.6), P(base, 0, 3.4, 0));
  windowsRow(gb, base, -2.5, 2.5, 2, 2.5, 0.9, 1.3, 3);
  windowsRow(gb, base, -2.5, 2.5, 2, -2.5, 0.9, 1.3, 3, -1);
  gb.add('brick', boxT(0.6, 1.6, 0.6), P(base, 2.5, 4.6, 0));
  gb.add('trim', new THREE.BoxGeometry(0.95, 2.1, 0.08), P(base, -1.6, 1.25, 2.53));   // door, with a lamp over it
  doorLamp(gb, base, -1.6, 2.95, 2.5);
  keep(pl.X, pl.N, 9);
}
function grainElevator(pl, name = 'FOSTORIA GRAIN CO.') {
  const base = baseM(pl.X, pl.y - 0.3, pl.N, pl.yaw + (pl.lat < 0 ? Math.PI : 0));
  const gb = binAt(pl.X, pl.N);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) gb.add('concrete', new THREE.CylinderGeometry(3.4, 3.4, 30, 24), P(base, -12 + i * 6.8, 15, 3.4 + j * 6.8));
  gb.add('concrete', boxT(34.5, 2, 14, 3), P(base, 0, 31, 6.8));
  gb.add('concrete', boxT(9, 46, 10, 3), P(base, 21, 23, 6.8));
  gb.add('tin', boxT(9.4, 5, 10.4, 2), P(base, 21, 48.5, 6.8));
  gb.add('slate', gableRoof(9.4, 10.4, 1.6, 0.2), P(base, 21, 51, 6.8));
  windowsRow(gb, base, 18, 24, 40, 1.8, 0.8, 1.2, 3, -1);
  gb.add('tin', boxT(16, 6, 9, 2), P(base, 33, 3.02, 5));
  footing(gb, 'concrete', base, 1.6, 6.8, 34.6, 14, 0.05); foot(base, 1.6, 6.8, 34.6, 14);
  footing(gb, 'concrete', base, 21, 6.8, 9.4, 10.4, 0.05); foot(base, 21, 6.8, 9.4, 10.4);
  footing(gb, 'concrete', base, 33, 5, 16.2, 9.2, 0.05); foot(base, 33, 5, 16.2, 9.2);
  gb.add('slate', gableRoof(16, 9, 1.8), P(base, 33, 6, 5));
  // loading spouts hang from the headhouse and the end bin out over the track
  gb.add('steel', new THREE.BoxGeometry(1.2, 1.2, 14), P(base, 21, 30.98, -2.58, -0.8, 0, 0));
  gb.add('steel', new THREE.CylinderGeometry(0.3, 0.3, 16, 8), P(base, 14, 20, -5.5, Math.PI / 2 - 0.75, 0, 0));
  keep(pl.X, pl.N, 34);
  const nk = 'nbGrain' + name; if (!SMAT[nk]) SMAT[nk] = nameBoard(name);
  gb.add(nk, new THREE.PlaneGeometry(8.4, 1.47), P(base, 21, 43.6, 1.79, 0, Math.PI, 0));
}
/* ---------- the customers on the two industry spurs ----------
   Each is laid out in a frame on its spur: local x along the track, z outward (away from the main), y = 0 at the
   railhead. A boxcar's floor is 1.17 m above the rail, so the docks stand at that height, 2.0 m from the track
   centre (a car body is 1.63 m either side); anything lower than 4.9 m keeps out of the 1.9 m swept envelope. */
function spurFrame(name, s) {
  const ln = ROUTE.lines[name]; if (!ln) return null;
  const skip = ln.edges, a = linePlace(ln, s, 10), b = linePlace(ln, s, -10);
  const out = trackGap(a.X, a.N, skip) >= trackGap(b.X, b.N, skip) ? 1 : -1;   // the side away from the other tracks
  const pl = linePlace(ln, s, 0);
  return { pl, base: baseM(pl.X, pl.y, pl.N, pl.yaw + (out > 0 ? 0 : Math.PI)), gb: binAt(pl.X, pl.N) };
}
/* a timber freight dock along the track: x0..x1, from z0 out to z1, top at y */
function freightDock(gb, base, x0, x1, z0, z1, y) {
  const L = x1 - x0, xc = (x0 + x1) / 2, W = z1 - z0, zc = (z0 + z1) / 2;
  gb.add('wood', boxT(L, 0.12, W, 2), P(base, xc, y - 0.06, zc));                       // deck planks
  gb.add('trim', boxT(L, 0.22, 0.14, 2), P(base, xc, y - 0.13, z0 + 0.07));             // rub rail on the track face
  footing(gb, 'wood', base, xc, z0 + 0.12, L, 0.24, y - 0.12);                          // timber face, down into the ground
  for (let x = x0 + 0.3; x <= x1 - 0.29; x += (L - 0.6) / Math.max(1, Math.round((L - 0.6) / 2.4))) footing(gb, 'trim', base, x, zc + 0.2, 0.3, W - 0.6, y - 0.12);   // posts
  walkDeck(base, xc, zc, L, W, y);
}
function kentonCoalFeed() {
  const F = spurFrame('Kenton Spur', 225); if (!F) return;
  const { base, gb } = F, dock = 1.17;
  /* the feed house: a frame warehouse on a dock, sliding doors to the track, a gable roof with a name board */
  const wx0 = -38, wx1 = -8, wz0 = 4.0, wz1 = 15, wL = wx1 - wx0, wW = wz1 - wz0, wxc = (wx0 + wx1) / 2, wzc = (wz0 + wz1) / 2, wH = 5.2;
  const [glo, ghi] = groundUnder(base, wxc, wzc, wL, wW), floor = Math.max(dock, ghi + 0.15);
  freightDock(gb, base, wx0 - 2, wx1 + 2, 2.0, wz0 + 0.05, dock);
  footing(gb, 'concrete', base, wxc, wzc, wL + 0.2, wW + 0.2, floor);
  gb.add('barn', boxT(wL, wH, wW, 2.5), P(base, wxc, floor + wH / 2, wzc)); foot(base, wxc, wzc, wL, wW);
  walkBlock(base, wxc, wzc, wL, wW, floor - 1, floor + wH);
  gb.add('trim', boxT(wL + 0.12, 0.2, wW + 0.12), P(base, wxc, floor + wH - 0.1, wzc));
  gb.add('tin', gableRoof(wL, wW, 2.4, 0.5), P(base, wxc, floor + wH, wzc));
  for (const x of [-31, -16]) {           // sliding doors on their track, a little proud of the wall
    gb.add('trim', boxT(3.4, 3.2, 0.08, 2), P(base, x, floor + 1.6, wz0 - 0.05));
    gb.add('steel', new THREE.BoxGeometry(7.2, 0.12, 0.12), P(base, x + 1.7, floor + 3.32, wz0 - 0.12));
  }
  windowsRow(gb, base, -25, -21, floor + 2.6, wz0, 1.0, 1.3, 2, -1);
  windowsRow(gb, base, wx0 + 3, wx1 - 3, floor + 2.6, wz1, 1.0, 1.3, 5);
  SMAT.nbKenton = nameBoardFit('KENTON COAL & FEED');
  gb.add('nbKenton', new THREE.PlaneGeometry(7.5, 1.4), P(base, wxc + 0.5, floor + 4.3, wz0 - 0.03, 0, Math.PI, 0));
  /* the coal pocket: three concrete silos fed by a bucket elevator from a track hopper under the spur */
  const sz = 10.5, sr = 3.1, sh = 15, sxs = [4, 10.8, 17.6];
  const [slo, shi] = groundUnder(base, 10.8, sz, 21, 2 * sr + 1), sy = shi + 0.25;
  footing(gb, 'concrete', base, 10.8, sz, 21.2, 2 * sr + 1, sy);
  for (const x of sxs) { gb.add('concrete', new THREE.CylinderGeometry(sr, sr, sh, 28), P(base, x, sy + sh / 2, sz)); gb.add('concrete', new THREE.CylinderGeometry(sr + 0.12, sr + 0.12, 0.35, 28), P(base, x, sy + sh + 0.17, sz)); walkPost(base, x, sz, sr, sh); }
  foot(base, 10.8, sz, 21, 2 * sr);
  gb.add('tin', boxT(18.4, 2.4, 3.2, 2), P(base, 10.8, sy + sh + 1.55, sz));                    // gallery over the silos
  gb.add('tin', gableRoof(18.4, 3.2, 0.8, 0.2), P(base, 10.8, sy + sh + 2.75, sz));
  // the elevator leg stands beside the track, its boot in the track hopper pit
  const lx = 10.8, lz = 4.2, top = sy + sh + 5;
  gb.add('tin', boxT(1.6, top + 1.2, 1.6, 2), P(base, lx, top / 2 - 0.6, lz)); walkPost(base, lx, lz, 1.1, top);
  footing(gb, 'concrete', base, lx, lz, 2.0, 2.0, 0.05);
  gb.add('tin', boxT(2.6, 2.6, 2.6, 2), P(base, lx, top + 1.3, lz)); gb.add('tin', gableRoof(2.6, 2.6, 0.8, 0.15), P(base, lx, top + 2.6, lz));
  const dz = sz - lz, dy = top - 0.2 - (sy + sh + 2.2);   // spout from the head down to the gallery
  gb.add('steel', new THREE.BoxGeometry(0.6, 0.6, Math.hypot(dz, dy) - 1.0), P(base, lx, top - 0.2 - dy / 2, lz + dz / 2, Math.atan2(dy, dz), 0, 0));
  gb.add('steel', new THREE.BoxGeometry(2.2, 0.08, 1.4), P(base, lx, 0.0, 0));             // track hopper grating between the rails
  // truck loading chutes on the far side
  for (const x of sxs) gb.add('steel', new THREE.BoxGeometry(0.7, 0.7, 2.6), P(base, x, sy + 3.6, sz + sr + 0.6, 0.6, 0, 0));
  /* the office and scale house, with the truck scale in front */
  const ox = 28, oz = 11, [olo, ohi] = groundUnder(base, ox, oz, 6, 5), oy = ohi + 0.25;
  footing(gb, 'brick', base, ox, oz, 6.2, 5.2, oy);
  gb.add('white', boxT(6, 3.2, 5, 2), P(base, ox, oy + 1.6, oz)); foot(base, ox, oz, 6, 5); walkBlock(base, ox, oz, 6, 5, oy - 1, oy + 3.2);
  gb.add('slate', hipRoof(6, 5, 1.6, 0.4), P(base, ox, oy + 3.2, oz));
  windowsRow(gb, base, ox - 1.5, ox + 1.5, oy + 1.7, oz - 2.5, 1.0, 1.2, 2, -1);
  const [clo] = groundUnder(base, ox, oz + 8, 3.6, 9);
  gb.add('concrete', boxT(3.6, 0.4, 9, 2), P(base, ox, clo + 0.12, oz + 8)); gb.add('steel', new THREE.BoxGeometry(3.2, 0.06, 8.6), P(base, ox, clo + 0.34, oz + 8));
  for (const [x, z, r] of [[wxc, wzc, 22], [10.8, sz, 14], [ox, oz + 4, 9]]) { const c = new THREE.Vector3(x, 0, z).applyMatrix4(base); keep(c.x, -c.z, r); }
}
function delphosOil() {
  const F = spurFrame('Delphos Spur', 235); if (!F) return;
  const { base, gb } = F;
  /* the unloading rack: a timber walkway at tank-dome height beside the track, posts, stairs, and stairs; the unloading line runs from the rack out to the tanks */
  const rz0 = 2.05, rz1 = 3.05, ry = 3.72, rx0 = -14, rx1 = 14;
  gb.add('wood', boxT(rx1 - rx0, 0.1, rz1 - rz0, 2), P(base, 0, ry - 0.05, (rz0 + rz1) / 2));
  for (let x = rx0 + 0.2; x <= rx1 - 0.19; x += (rx1 - rx0 - 0.4) / 7) for (const z of [rz0 + 0.12, rz1 - 0.12]) {
    const [lo] = groundUnder(base, x, z, 0.4, 0.4);
    gb.add('trim', boxT(0.2, ry - 0.1 - lo + 0.3, 0.2), P(base, x, (ry - 0.1 + lo - 0.3) / 2, z)); walkPost(base, x, z, 0.15, ry);
  }
  for (const x of [rx0 + 0.1, rx1 - 0.1]) gb.add('steel', new THREE.BoxGeometry(0.05, 1.0, 0.05), P(base, x, ry + 0.5, rz1 - 0.05));
  gb.add('steel', new THREE.BoxGeometry(rx1 - rx0, 0.05, 0.05), P(base, 0, ry + 1.0, rz1 - 0.05));   // handrail on the back of the walkway
  { // stairs down the back at the west end
    const [lo] = groundUnder(base, rx0 + 1.5, rz1 + 2.2, 1.2, 4), h = ry - lo, run = h * 1.1;
    gb.add('wood', boxT(1.1, 0.12, Math.hypot(h, run)), P(base, rx0 + 1.2, (ry + lo) / 2, rz1 + run / 2, Math.atan2(h, run), 0, 0));
    for (const x of [rx0 + 0.65, rx0 + 1.75]) gb.add('wood', boxT(0.06, 0.25, Math.hypot(h, run)), P(base, x, (ry + lo) / 2 + 0.1, rz1 + run / 2, Math.atan2(h, run), 0, 0));
  }
  walkDeck(base, 0, (rz0 + rz1) / 2, rx1 - rx0, rz1 - rz0, ry);
  /* the tanks, inside an earth dike, each on a concrete ring */
  const tz = 21, tanks = [[-13, 4.2, 9.5], [0, 4.2, 9.5], [13, 4.2, 9.5], [24, 2.6, 6.5]];
  let ty = -Infinity; for (const [x, r] of tanks) ty = Math.max(ty, groundUnder(base, x, tz, 2 * r + 1, 2 * r + 1)[1] + 0.35);
  for (const [x, r, h] of tanks) {
    const [lo] = groundUnder(base, x, tz, 2 * r + 1, 2 * r + 1);
    gb.add('concrete', new THREE.CylinderGeometry(r + 0.4, r + 0.5, ty - lo + 0.3, 28), P(base, x, (ty + lo - 0.3) / 2, tz));
    gb.add('silver', new THREE.CylinderGeometry(r, r, h, 32), P(base, x, ty + h / 2, tz));
    gb.add('silver', new THREE.ConeGeometry(r + 0.08, 0.7, 32), P(base, x, ty + h + 0.35, tz));
    for (const y of [h * 0.33, h * 0.66]) gb.add('steel', new THREE.CylinderGeometry(r + 0.03, r + 0.03, 0.08, 32, 1, true), P(base, x, ty + y, tz));
    // ladder up the side facing the track, with a hoop cage at the top
    for (const dx of [-0.22, 0.22]) gb.add('steel', new THREE.BoxGeometry(0.05, h, 0.05), P(base, x + dx, ty + h / 2, tz - r - 0.2));
    for (let y = 0.4; y < h; y += 0.4) gb.add('steel', new THREE.BoxGeometry(0.44, 0.03, 0.03), P(base, x, ty + y, tz - r - 0.2));
    for (const dx of [-0.22, 0.22]) gb.add('steel', new THREE.BoxGeometry(0.04, 0.04, 0.2), P(base, x + dx, ty + h - 0.3, tz - r - 0.1));
    walkPost(base, x, tz, r, h);
    foot(base, x, tz, 2 * r, 2 * r);
  }
  // the fire wall: a low concrete wall all round the tank field, its top level, its foot in the ground
  const wTop = ty + 0.8, wx0 = -20, wx1 = 30, wz0 = 14, wz1 = 28;
  for (const [x, z, L, W] of [[(wx0 + wx1) / 2, wz0, wx1 - wx0 + 0.3, 0.3], [(wx0 + wx1) / 2, wz1, wx1 - wx0 + 0.3, 0.3], [wx0, (wz0 + wz1) / 2, 0.3, wz1 - wz0], [wx1, (wz0 + wz1) / 2, 0.3, wz1 - wz0]]) {
    const n = Math.max(1, Math.round(Math.max(L, W) / 5));
    for (let k = 0; k < n; k++) {   // in short panels, so each one's foot follows the ground under it
      const px = L > W ? x - L / 2 + (k + 0.5) * L / n : x, pz = L > W ? z : z - W / 2 + (k + 0.5) * W / n, pl = L > W ? L / n : L, pw = L > W ? W : W / n;
      footing(gb, 'concrete', base, px, pz, pl + 0.02, pw + 0.02, wTop);
    }
    walkBlock(base, x, z, L, W, -2, wTop);
  }
  // the unloading line: up from under the rack, on piers over the fire wall, and into the side of the middle tank
  const pipe = [[-6, 3.4], [-6, 17], [0, 17]], py = wTop + 0.45;
  for (let i = 0; i + 1 < pipe.length; i++) {
    const [ax, az] = pipe[i], [bx, bz] = pipe[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 3.5));
    gb.add('steel', barGeo(0.11, [ax, py, az], [bx, py, bz], 10), base);
    for (let k = i ? 1 : 0; k < n; k++) { const x = lerp(ax, bx, k / n), z = lerp(az, bz, k / n); if (Math.abs(z - wz0) < 0.5) continue; footing(gb, 'concrete', base, x, z, 0.35, 0.35, py - 0.11); }
  }
  gb.add('steel', new THREE.SphereGeometry(0.13, 10, 8), P(base, -6, py, 17));
  { const [lo] = groundUnder(base, -6, 3.4, 0.3, 0.3); gb.add('steel', barGeo(0.11, [-6, lo - 0.2, 3.4], [-6, py, 3.4], 10), base); gb.add('steel', new THREE.SphereGeometry(0.13, 10, 8), P(base, -6, py, 3.4)); }
  /* the warehouse and office: brick, with a truck dock and a loading rack for the delivery trucks */
  const hx = -36, hz = 14, hL = 14, hW = 8, [hlo, hhi] = groundUnder(base, hx, hz, hL, hW), hy = hhi + 0.3;
  footing(gb, 'concrete', base, hx, hz, hL + 0.2, hW + 0.2, hy);
  gb.add('brick', boxT(hL, 4.2, hW, 2), P(base, hx, hy + 2.1, hz)); foot(base, hx, hz, hL, hW); walkBlock(base, hx, hz, hL, hW, hy - 1, hy + 4.2);
  gb.add('trim', boxT(hL + 0.12, 0.22, hW + 0.12), P(base, hx, hy + 4.1, hz));
  gb.add('tin', gableRoof(hL, hW, 1.4, 0.4), P(base, hx, hy + 4.2, hz));
  windowsRow(gb, base, hx - 4, hx + 4, hy + 2.3, hz - hW / 2, 1.0, 1.3, 3, -1);
  gb.add('trim', boxT(3, 3, 0.08, 2), P(base, hx + 4.5, hy + 1.5, hz + hW / 2 + 0.04));
  SMAT.nbDelphos = nameBoardFit('DELPHOS OIL CO.');
  gb.add('nbDelphos', new THREE.PlaneGeometry(5, 0.9), P(base, hx, hy + 3.45, hz - hW / 2 - 0.03, 0, Math.PI, 0));
  for (const [x, z, r] of [[0, 21, 26], [hx, hz, 10]]) { const c = new THREE.Vector3(x, 0, z).applyMatrix4(base); keep(c.x, -c.z, r); }
}
function interlockingTower(pl, label) {
  const base = baseM(pl.X, pl.y - 0.2, pl.N, pl.yaw + (pl.lat < 0 ? 0 : Math.PI));
  const gb = binAt(pl.X, pl.N);
  gb.add('brick', boxT(5, 3.2, 4.5, 2), P(base, 0, 1.6, 0));
  footing(gb, 'concrete', base, 0, 0, 5.2, 4.7, 0.05); foot(base, 0, 0, 5.2, 4.7);
  gb.add('cream', boxT(5.2, 3.0, 4.7, 2), P(base, 0, 4.7, 0));
  windowsRow(gb, base, -1.8, 1.8, 4.9, 2.35, 1.0, 1.8, 3);
  windowsRow(gb, base, -1.8, 1.8, 4.9, -2.35, 1.0, 1.8, 3, -1);
  gb.add('slate', hipRoof(5.2, 4.7, 1.8, 0.7), P(base, 0, 6.2, 0));
  gb.add('wood', boxT(0.9, 0.1, 3.2), P(base, 2.85, 2.9, 0, 0, 0, 0.6));
  const nb = nameBoard(label); SMAT['nb_' + label] = nb;
  gb.add('nb_' + label, new THREE.PlaneGeometry(2.4, 0.5), P(base, 0, 3.6, 2.356));
  doorLamp(gb, base, -1.6, 3.0, 2.25);
  keep(pl.X, pl.N, 7);
}
function farmstead(X, N, yaw, r) {
  const y = groundAt(X, N);
  const base = baseM(X, y, N, yaw);
  const gb = binAt(X, N);
  // each structure sits level at its own spot: floor just below the high side, stone footing down to the low side
  const site = (x, z, w, d) => groundUnder(base, x, z, w, d)[1] - 0.1;
  const fnd = (x, z, w, d, y0) => footing(gb, 'stone', base, x, z, w + 0.2, d + 0.2, y0 + 0.08);
  // house with kitchen wing and front porch
  const h0 = site(-2.25, 1.15, 14.5, 9.3); foot(base, -2.25, 1.15, 14.5, 9.3);
  gb.add('white', boxT(9, 6.2, 7), P(base, 0, h0 + 3.1, 0)); fnd(0, 0, 9, 7, h0);
  gb.add('slate', gableRoof(9, 7, 3.0, 0.45), P(base, 0, h0 + 6.2, 0));
  gb.add('white', boxT(6, 3, 4), P(base, -6.5, h0 + 1.5, 1.5)); fnd(-6.5, 1.5, 6, 4, h0);
  gb.add('slate', gableRoof(6, 4, 1.4, 0.3), P(base, -6.5, h0 + 3, 1.5));
  windowsRow(gb, base, -3, 3, h0 + 1.8, 3.5, 0.9, 1.4, 3); windowsRow(gb, base, -3, 3, h0 + 4.6, 3.5, 0.9, 1.3, 3);
  windowsRow(gb, base, -3, 3, h0 + 1.8, -3.5, 0.9, 1.4, 3, -1); windowsRow(gb, base, -3, 3, h0 + 4.6, -3.5, 0.9, 1.3, 3, -1);
  gb.add('trim', new THREE.BoxGeometry(9.2, 0.12, 2.4), P(base, 0, h0 + 2.9, 4.6));
  gb.add('wood', boxT(9.0, 0.3, 2.3), P(base, 0, h0 + 0.15, 4.65)); fnd(0, 4.65, 9.0, 2.3, h0 - 0.05);
  for (const px of [-4.4, -1.5, 1.5, 4.4]) gb.add('white', boxT(0.14, 2.56, 0.14), P(base, px, h0 + 1.58, 5.65));
  gb.add('brick', boxT(0.8, 3.5, 0.8), P(base, 2.5, h0 + 8.05, 0));
  // barn
  const bx = 30 + r() * 15, bz = -14 - r() * 12;
  const bL = 22 + r() * 8, bW = 13, b0 = site(bx, bz, bL, bW); foot(base, bx, bz, bL + 0.8, bW + 0.8);
  gb.add('barn', boxT(bL, 5.5, bW, 2.4), P(base, bx, b0 + 2.75, bz)); fnd(bx, bz, bL, bW, b0);
  gb.add(r() < 0.5 ? 'slate' : 'rust', gambrel(bL, bW, 6.2), P(base, bx, b0 + 5.5, bz));
  gb.add('white', new THREE.BoxGeometry(4, 4, 0.1), P(base, bx - bL / 2 - 0.04, b0 + 2.2, bz, 0, Math.PI / 2, 0));
  // silos
  const ns = 1 + (r() * 2 | 0);
  for (let i = 0; i < ns; i++) {
    const sx = bx + bL / 2 + 3.5 + i * 6.5, tall = 13 + r() * 6, s0 = site(sx, bz - 2, 5.2, 5.2);
    gb.add(r() < 0.5 ? 'concrete' : 'silver', new THREE.CylinderGeometry(2.6, 2.6, tall, 18), P(base, sx, s0 + tall / 2, bz - 2));
    gb.add('tin', new THREE.SphereGeometry(2.65, 16, 8, 0, TAU, 0, Math.PI / 2), P(base, sx, s0 + tall, bz - 2));
    fnd(sx, bz - 2, 5.4, 5.4, s0); foot(base, sx, bz - 2, 5.4, 5.4);
  }
  // corn crib / shed
  const c0 = site(8, -30, 10, 4); foot(base, 8, -30, 10.6, 4.6);
  gb.add('wood', boxT(10, 3.4, 4), P(base, 8, c0 + 1.7, -30)); fnd(8, -30, 10, 4, c0);
  gb.add('tin', gableRoof(10, 4, 1.2, 0.3), P(base, 8, c0 + 3.4, -30));
  keep(X, N, 55);
  return { X, N, yaw };
}

/* -------- bridge (two through-truss Pratt spans) -------- */
function buildBridge(scene) { for (const b of ROUTE.bridges || [ROUTE.bridge]) trussBridge(scene, b); }
function trussBridge(scene, b) {
  // one double-track truss carries both main tracks: track 1 at z = +h2, track 2 at -h2
  const main = b.line || ROUTE.main, h2 = (ROUTE.spacing || 0) / 2, tracks = h2 ? [h2, -h2] : [0];
  const c = linePlace(main, b.s, -h2);
  const base = baseM(c.X, c.y, c.N, c.yaw);
  const gb = new GeoBin();
  const span = 64, H = 9.2, W = 2.85 + h2, panels = 8, pw = span / panels;
  for (const sOff of [-span / 2, span / 2]) {
    const x0 = sOff - span / 2;
    for (const z of [-W, W]) {
      gb.add('steel', new THREE.BoxGeometry(span, 0.85, 0.5), P(base, sOff, -0.75, z));                    // bottom chord
      gb.add('steel', new THREE.BoxGeometry(span - 2 * pw, 0.7, 0.6), P(base, sOff, H, z));               // top chord
      const ep = Math.hypot(pw, H + 0.75);
      for (const s of [-1, 1]) gb.add('steel', new THREE.BoxGeometry(ep, 0.7, 0.6), P(base, sOff + s * (span / 2 - pw / 2), H / 2 - 0.2, z, 0, 0, -s * Math.atan2(H + 0.75, pw)));
      for (let i = 1; i < panels; i++) gb.add('steel', new THREE.BoxGeometry(0.34, H + 0.6, 0.42), P(base, x0 + i * pw, H / 2 - 0.3, z));
      for (let i = 1; i < panels - 1; i++) {
        const xa = x0 + i * pw, xb = x0 + (i + 1) * pw;
        const towardC = (xa + xb) / 2 < sOff ? 1 : -1;
        const L = Math.hypot(pw, H);
        gb.add('steel', new THREE.BoxGeometry(L, 0.18, 0.3), P(base, (xa + xb) / 2, H / 2 - 0.2, z, 0, 0, towardC * Math.atan2(H, pw)));
      }
      // lacing detail plates on chords
      for (let i = 0; i <= panels; i++) gb.add('steel', new THREE.BoxGeometry(0.9, 1.3, 0.56), P(base, x0 + i * pw, -0.55, z));
    }
    // floor beams, stringers, top lateral bracing, portals
    for (let i = 0; i <= panels; i++) gb.add('steel', new THREE.BoxGeometry(0.35, 0.9, 2 * W), P(base, x0 + i * pw, -0.9, 0));
    for (const tz of tracks) for (const z of [-0.85, 0.85]) gb.add('steel', new THREE.BoxGeometry(span, 0.7, 0.3), P(base, sOff, -0.75, tz + z));
    for (let i = 1; i < panels - 1; i++) {
      const xa = x0 + i * pw, xb = xa + pw, L = Math.hypot(pw, 2 * W), a = Math.atan2(2 * W, pw);
      gb.add('steel', new THREE.BoxGeometry(L, 0.14, 0.14), P(base, (xa + xb) / 2, H + 0.2, 0, 0, a, 0));
      gb.add('steel', new THREE.BoxGeometry(L, 0.14, 0.14), P(base, (xa + xb) / 2, H + 0.2, 0, 0, -a, 0));
      gb.add('steel', new THREE.BoxGeometry(0.25, 0.5, 2 * W), P(base, xa, H, 0));
      gb.add('steel', new THREE.BoxGeometry(0.2, 0.2, 2 * W - 0.3), P(base, xa, H - 1.6, 0));
    }
    for (const s of [-1, 1]) {
      // portal strut spans between the inclined end posts, in their plane; name board on its outer face
      const lean = Math.atan2(pw, H + 0.75), px = sOff + s * (span / 2 - pw / 2 - (H / 2 - 0.9) * pw / (H + 0.75));
      const pm = P(base, px, H - 1.1, 0, 0, 0, s * lean);
      gb.add('steel', new THREE.BoxGeometry(0.3, 1.4, 2 * W), pm);
      const nk = 'nbBridge' + (b.name || ''); if (!SMAT[nk]) SMAT[nk] = nameBoard(b.name || 'NICKEL PLATE · SANDUSKY RIVER');
      gb.add(nk, new THREE.PlaneGeometry(4.8, 0.62), pm.clone().multiply(M(s * 0.157, 0, 0, 0, s * Math.PI / 2, 0)));
    }
  }
  // piers & abutments
  for (const x of [-span, 0, span]) {
    const top = -1.3;
    const g = groundAt(c.X + Math.cos(c.yaw) * x, c.N + Math.sin(c.yaw) * x);
    const h = top - (Math.min(WORLD.mtn ? g - c.y : g, -5.6) - 1);   // the mountain's river runs well below the rails
    gb.add('concrete', boxT(x === 0 ? 3.2 : 5, h, 8.4 + 2 * h2, 2), P(base, x, top - h / 2, 0));
    if (x !== 0) {
      // abutment backwall, then the ballasted approach fill out to the end of the bridge limits (±72),
      // with the same section as the track ballast carried down its own slope to the ground
      const sx = Math.sign(x), xa = x + sx * 0.6, xb = x + sx * 8.0;   // bridge limits are at ±72
      footing(gb, 'concrete', base, x + sx * 0.6, 0, 0.8, 8.4 + 2 * h2, -0.43);
      const yB = groundUnder(base, (xa + xb) / 2, 0, 8, 14 + 2 * h2)[0] - 0.3, wB = 1.9 + h2 + (-0.205 - yB) * 1.68;
      const prof = [[-wB, yB, 0.42], [-1.9 - h2, -0.205, 0.55], [1.9 + h2, -0.205, 0.55], [wB, yB, 0.42]];
      const pos = [], col = [], uv = [];
      const quad = (A, B, C, D) => { for (const v of [A, B, C, A, C, D]) { pos.push(v[0], v[1], v[2]); col.push(v[3], v[3] * 0.96, v[3] * 0.88); uv.push((v[0] + v[2]) / 1.4, v[1] / 1.4); } };
      const at = (xx, q) => [xx, prof[q][1], prof[q][0], prof[q][2]];
      for (let q = 0; q < 3; q++) sx > 0 ? quad(at(xa, q), at(xa, q + 1), at(xb, q + 1), at(xb, q)) : quad(at(xa, q), at(xb, q), at(xb, q + 1), at(xa, q + 1));
      { const A = at(xa, 0), B = at(xa, 1), C = at(xa, 2), D = at(xa, 3); sx > 0 ? (quad(A, D, C, B)) : quad(A, B, C, D); }   // face toward the bridge
      const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      fg.computeVertexNormals();
      { const n = fg.attributes.normal; if (n.getY(3) < 0) throw new Error('approach fill wound inward'); for (let i = 0; i < n.count; i++) { _v1.set(n.getX(i), n.getY(i) + 0.8, n.getZ(i)).normalize(); n.setXYZ(i, _v1.x, _v1.y, _v1.z); } }
      gb.add('ballast', fg, base.clone());
    }
    // bearing shoes carry the bottom chords on the pier caps
    for (const bx of x === 0 ? [-0.6, 0.6] : [-Math.sign(x) * 0.6]) for (const z of [-W, W]) gb.add('steel', new THREE.BoxGeometry(0.9, 0.14, 0.7), P(base, x + bx, top + 0.06, z));
  }
  // open deck ties and guard timbers on the bridge
  const r = rng(44);
  for (let x = -span - 7.8, i = 0; x <= span + 7.8; x += 0.42, i++) {
    const geo = new THREE.BoxGeometry(0.24, 0.24, (i % 4 ? 3.1 : 5.1) + 2 * h2); geo.translate(x, -0.3, 0);   // every fourth tie runs out under the walkways
    const v = 0.7 + r() * 0.3, col = new Float32Array(geo.attributes.position.count * 3);
    for (let i = 0; i < col.length; i += 3) { col[i] = 0.42 * v; col[i + 1] = 0.36 * v; col[i + 2] = 0.29 * v; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    gb.add('tie', geo, base.clone());
  }
  for (const tz of tracks) for (const z of [-1.42, 1.42]) gb.add('wood', boxT(2 * span + 2, 0.2, 0.2), P(base, 0, -0.1, tz + z));
  // walkway & railing
  for (const z of [-2.2 - h2, 2.2 + h2]) {
    gb.add('wood', boxT(2 * span, 0.06, 0.66), P(base, 0, -0.2, z));
  }
  const vis = gb.build({ steel: MAT.bridge, concrete: SMAT.concrete, tie: MAT.tie, wood: SMAT.wood, ['nbBridge' + (b.name || '')]: SMAT['nbBridge' + (b.name || '')], ballast: MAT.ballast });
  scene.add(vis);
  keep(c.X, c.N, 80);
}

/* -------- roads and grade crossings -------- */
/* A flashing-light crossing signal at (X, N), its local +x toward the road traffic it warns and +z toward
   the middle of the road: a mast with the crossbuck and bell on top, two flashers each way on a crossarm,
   and (on a gated crossing) the gate mechanism with its striped arm, which comes down across the near lane. */
function xingMast(scene, xg, X, N, face, roadW) {
  const y = groundAt(X, N), cb = baseM(X, y, N, face), gb = binAt(X, N), id = xg.id;
  const mast = { flash: [], lightAt: new THREE.Vector3(0.6, 3.0, 0).applyMatrix4(cb) };
  xg.masts.push(mast);
  if (!SMAT['xA' + id]) for (const k of ['xA', 'xB', 'xT']) SMAT[k + id] = new THREE.MeshBasicMaterial({ color: 0x1e0604 });
  footing(gb, 'concrete', cb, 0, 0, 0.9, 0.9, 0.12); walkPost(cb, 0, 0, 0.5, 5);
  gb.add('alu', new THREE.CylinderGeometry(0.07, 0.08, 5.0, 10), P(cb, 0, 2.6, 0));
  gb.add('alu', new THREE.CylinderGeometry(0.16, 0.2, 0.3, 10), P(cb, 0, 0.27, 0));
  // the crossbuck
  gb.add('xb1', new THREE.BoxGeometry(0.03, 0.32, 2.4), P(cb, 0.09, 4.35, 0, 0.785, 0, 0));
  gb.add('xb2', new THREE.BoxGeometry(0.03, 0.32, 2.4), P(cb, 0.12, 4.35, 0, -0.785, 0, 0));
  // the bell on its bracket at the top
  gb.add('alu', new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6), P(cb, 0, 5.18, 0));
  gb.add('black', new THREE.SphereGeometry(0.17, 12, 6, 0, TAU, 0, Math.PI / 2), P(cb, 0, 5.24, 0));
  // crossarm and the four flasher heads: a black background disc, the lens and a hood over it, each way
  gb.add('alu', new THREE.BoxGeometry(0.08, 0.1, 1.72), P(cb, 0, 3.0, 0));
  gb.add('alu', new THREE.BoxGeometry(0.1, 0.24, 0.2), P(cb, 0, 3.0, 0));
  for (const fx of [1, -1]) for (const z of [-0.62, 0.62]) {
    const rot = fx > 0 ? Math.PI / 2 : -Math.PI / 2;
    gb.add('black', new THREE.CylinderGeometry(0.31, 0.31, 0.03, 20), P(cb, fx * 0.09, 3.0, z, 0, 0, Math.PI / 2));
    gb.add('black', new THREE.CylinderGeometry(0.15, 0.15, 0.12, 14), P(cb, fx * 0.15, 3.0, z, 0, 0, Math.PI / 2));
    gb.add('black', new THREE.CylinderGeometry(0.175, 0.175, 0.26, 14, 1, true, -Math.PI / 2, Math.PI), P(cb, fx * 0.31, 3.02, z, 0, 0, Math.PI / 2).multiply(M(0, 0, 0, 0, fx > 0 ? 0 : Math.PI, 0)));
    // the near and far lamps of a pair flash in turn; seen from the other side, the pair is swapped
    const ab = (z < 0) === (fx > 0) ? 0 : 1;
    gb.add((ab ? 'xB' : 'xA') + id, new THREE.CircleGeometry(0.14, 18), P(cb, fx * 0.212, 3.0, z, 0, rot, 0));
    mast.flash.push({ p: new THREE.Vector3(fx * 0.26, 3.0, z).applyMatrix4(cb), c: [0, 0, 0], ab });
  }
  if (!xg.gated) return mast;
  // the gate: mechanism case on the track side of the mast, the arm pivoting in the plane 0.5 m behind it
  gb.add('alu', new THREE.BoxGeometry(0.34, 0.95, 0.42), P(cb, -0.32, 1.25, 0.18));
  gb.add('alu', new THREE.BoxGeometry(0.24, 0.12, 0.16), P(cb, -0.2, 1.25, 0.0));
  const mount = new THREE.Object3D(); mount.matrixAutoUpdate = false; mount.matrix.copy(P(cb, -0.56, 1.35, 0.3));
  const arm = new THREE.Group(); mount.add(arm); scene.add(mount);
  const La = roadW / 2 + 1.2 - 0.3 - 0.3;   // reaching just short of the centre line
  const ag = new GeoBin(), seg = 0.6;
  ag.add('m', new THREE.BoxGeometry(0.14, 0.2, 0.3), M(0, 0, 0));
  for (let z = 0.15, k = 0; z < La; z += seg, k++) {
    const l = Math.min(seg, La - z), t = 1 - 0.35 * (z / La);
    const g = new THREE.BoxGeometry(0.07, 0.13 * t, l); g.translate(0, 0, z + l / 2);
    const c = k % 2 ? [0.94, 0.94, 0.92] : [0.78, 0.08, 0.06];
    const col = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < col.length; i += 3) col.set(c, i);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); ag.add('arm', g);
  }
  // counterweights on the short end
  for (const x of [-0.06, 0.06]) ag.add('m', new THREE.BoxGeometry(0.03, 0.06, 0.95), M(x, 0, -0.45));
  ag.add('w', new THREE.BoxGeometry(0.18, 0.34, 0.32), M(0, -0.02, -0.82));
  const lampsOnArm = [[La * 0.38, 'xA'], [La * 0.7, 'xB'], [La - 0.12, 'xT']];
  for (const [z, k] of lampsOnArm) { ag.add('black', new THREE.CylinderGeometry(0.07, 0.07, 0.11, 10), M(0, 0.12, z, 0, 0, Math.PI / 2)); ag.add(k, new THREE.CircleGeometry(0.055, 12), M(0.056, 0.12, z, 0, Math.PI / 2, 0)); }
  const grp = ag.build({ m: SMAT.alu, arm: SMAT.gateArm, w: SMAT.black, black: SMAT.black, xA: SMAT['xA' + id], xB: SMAT['xB' + id], xT: SMAT['xT' + id] }, { cast: false });
  arm.add(grp); arm.rotation.x = -Math.PI / 2 * 0.96;
  mast.arm = arm; mast.armLamps = lampsOnArm.map(([z, k]) => ({ at: new THREE.Vector3(0.1, 0.12, z), ab: k === 'xA' ? 0 : 1, tip: k === 'xT' }));
  return mast;
}
function buildRoads(scene) {
  const roads = [];
  for (const X of WORLD.roadsX) { const paved = (WORLD.pavedX || []).includes(X); roads.push({ dir: 'N', c: X, a: -3500, b: 8000, w: paved ? 7 : 6, mat: paved ? 'road' : 'gravel' }); }
  roads.push({ dir: 'E', c: WORLD.roadN, a: Math.min(-7800, INNER.x0), b: 7800, w: 7.4, mat: 'road' });
  // find crossings
  for (const r of roads) {
    r.cross = [];
    for (const e of NET.edges) {
      let prev = null;
      for (let s = 0; s <= e.len; s += 1) {
        const [X, N] = e.xz(s); const v = r.dir === 'N' ? X - r.c : N - r.c;
        if (prev !== null && Math.sign(v) !== Math.sign(prev.v)) {
          const t = prev.v / (prev.v - v), ss = lerp(prev.s, s, t);
          const [cx, cn] = e.xz(ss); r.cross.push({ edge: e, s: ss, X: cx, N: cn, y: e.elev(ss), along: r.dir === 'N' ? cn : cx });
        }
        prev = { v, s };
      }
    }
    SCN.crossings.push(...r.cross.map(c => ({ ...c, road: r })));
  }
  for (const r of roads) {
    const pos = [], idx = [], uv = [], nor = [];
    const step = 6;
    let n = 0;
    for (let t = r.a; t <= r.b; t += step) {
      // refine near crossings
      const X = r.dir === 'N' ? r.c : t, N = r.dir === 'N' ? t : r.c;
      if (X < INNER.x0 + 30 || X > INNER.x1 - 30 || N < INNER.n0 + 30 || N > INNER.n1 - 30) { n = 0; continue; }
      if (riverDist(X, N) < 40) { n = 0; continue; }
      let y = Math.max(groundAt(X, N), groundAt(X + 3, N + 3), groundAt(X - 3, N - 3)) + 0.14;
      for (const c of r.cross) { const dd = Math.abs(t - c.along); if (dd < 30) y = Math.max(y, c.y - 0.025 - 0.04 * Math.max(0, dd - 3)); }
      if (r.dir === 'E') y += 0.03;
      const hw = r.w / 2;
      const px = r.dir === 'N' ? [X - hw, X + hw] : [X, X], pn = r.dir === 'N' ? [N, N] : [N - hw, N + hw];
      for (let q = 0; q < 2; q++) { pos.push(px[q], y, -pn[q]); nor.push(0, 1, 0); uv.push(q * r.w / 5, t / 5); }
      // skirts
      for (let q = 0; q < 2; q++) { pos.push(px[q] + (r.dir === 'N' ? (q ? 3.5 : -3.5) : 0), y - 1.4, -(pn[q] + (r.dir === 'E' ? (q ? 3.5 : -3.5) : 0))); nor.push(0, 1, 0); uv.push((q ? r.w + 3.8 : -3.8) / 5, t / 5); }
      const k = pos.length / 3 - 4;
      if (n > 0) { const p = k - 4; idx.push(p, p + 1, k, p + 1, k + 1, k); idx.push(p + 2, p, k + 2, p, k, k + 2, p + 1, p + 3, k + 1, p + 3, k + 3, k + 1); }
      n++;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    if (r.dir === 'E') { /* flip winding so E-W roads face up */ const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } }
    g.computeVertexNormals(); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, SMAT[r.mat]); m.receiveShadow = true; scene.add(m);
    if (r.mat === 'road') {
      // dashed centre line
      const lp = [], li = [];
      for (let t = r.a; t <= r.b; t += 12) {
        const X = r.dir === 'N' ? r.c : t, N = r.dir === 'N' ? t : r.c;
        if (X < INNER.x0 + 30 || X > INNER.x1 - 30 || N < INNER.n0 + 30 || N > INNER.n1 - 30) continue;
        let near = false; for (const c of r.cross) if (Math.abs(t - c.along) < 12) near = true; if (near) continue;
        const y = Math.max(groundAt(X, N), groundAt(X + 3, N + 3), groundAt(X - 3, N - 3)) + 0.16 + (r.dir === 'E' ? 0.03 : 0);
        const k = lp.length / 3;
        if (r.dir === 'N') lp.push(X - 0.07, y, -N, X + 0.07, y, -N, X - 0.07, y, -(N + 5), X + 0.07, y, -(N + 5));
        else lp.push(X, y, -(N - 0.07), X, y, -(N + 0.07), X + 5, y, -(N - 0.07), X + 5, y, -(N + 0.07));
        if (r.dir === 'N') li.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); else li.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); lg.setIndex(li); lg.computeBoundingSphere();
      scene.add(new THREE.Mesh(lg, SMAT.line));
    }
    // crossbucks, planks, whistle posts
    // tracks crossing the road side by side (both mains, a siding) share one pair of crossbucks
    const groups = [];
    for (const c of [...r.cross].sort((p, q) => p.along - q.along)) { const g = groups[groups.length - 1]; if (g && c.along - g[g.length - 1].along < 14) g.push(c); else groups.push([c]); }
    for (const g of groups) {
      // a pair of flashing-light signals beyond the outermost tracks, on the right-hand side of the road
      // for traffic coming up to the crossing, with gates on the paved roads
      const xg = { cross: g, masts: [], gated: r.mat === 'road', id: (SCN.xings || (SCN.xings = [])).length };
      SCN.xings.push(xg);
      for (const side of [-1, 1]) {
        const c = side > 0 ? g[g.length - 1] : g[0];
        const dx = r.dir === 'N' ? 0 : side * 9, dn = r.dir === 'N' ? side * 9 : 0;
        const lx = r.dir === 'N' ? (side > 0 ? -r.w / 2 - 1.2 : r.w / 2 + 1.2) : 0, ln = r.dir === 'E' ? (side > 0 ? r.w / 2 + 1.2 : -r.w / 2 - 1.2) : 0;
        const face = r.dir === 'N' ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
        xingMast(scene, xg, c.X + dx + lx, c.N + dn + ln, face, r.w);
      }
    }
    // whistle posts 1/4 mile before, on the right of each main track for its direction of running
    for (const c of r.cross) {
      const ln = c.edge.line, run = ln === ROUTE.main ? [1] : ln === ROUTE.main2 ? [-1] : c.edge.kind === 'main' && !ROUTE.main2 ? [-1, 1] : [];
      for (const dir of run) {
        const loc = c.edge; const ss = c.s - dir * 400;
        if (ss < 0 || ss > loc.len) continue;
        loc.pose(ss, FR2); const yaw = Math.atan2(-FR2.f.z, FR2.f.x);
        let lat = dir > 0 ? 3.4 : -3.4;
        const at = l => [FR2.p.x + Math.sin(yaw) * l, -(FR2.p.z + Math.cos(yaw) * l)];
        if (trackGap(...at(lat), [loc]) < 3) lat = -lat;
        if (trackGap(...at(lat), [loc]) < 3) continue;
        const X = FR2.p.x + Math.sin(yaw) * lat, N = -(FR2.p.z + Math.cos(yaw) * lat), y = groundAt(X, N);
        const wb = baseM(X, y, N, yaw + (dir > 0 ? 0 : Math.PI));
        const g2 = binAt(X, N);
        g2.add('white', boxT(0.12, 2.5, 0.12), P(wb, 0, 0.95, 0));
        g2.add('wpost', new THREE.BoxGeometry(0.04, 0.75, 0.5), P(wb, -0.08, 2.2, 0, 0, 0, 0));
      }
    }
    // planks proper: for each crossing build oriented along track
    for (const c of r.cross) {
      c.edge.pose(c.s, FR);
      const gb = binAt(c.X, c.N);
      const halfW = r.w / 2 / Math.max(0.3, Math.abs(r.dir === 'N' ? FR.f.x : FR.f.z)) + 0.8;
      for (const z of [[-0.66, 0.66], [-1.5, -0.84], [0.84, 1.5]]) {
        // planks bear on the tie tops (-0.186) and finish just under the railhead
        const m = frameMatrix(FR, new THREE.Matrix4()).multiply(M(0, -0.1, (z[0] + z[1]) / 2));
        gb.add('wood', boxT(halfW * 2, 0.18, z[1] - z[0]), m);
      }
    }
  }
  SMAT.xb1 = SMAT.crossbuck; SMAT.xb2 = SMAT.crossbuck2;
}

/* -------- pole line along the main -------- */
/* no poles through a tunnel or across the trestle: the line leaves the track there and rejoins beyond */
function offPoles(line, s) {
  for (const T of ROUTE.tunnels || []) if (T.line === line && s > T.s0 - 40 && s < T.s1 + 40) return true;
  const V = ROUTE.viaduct; return !!(V && V.line === line && Math.abs(s - V.s) < V.half + 30);
}
/* the six wires on the crossarms (height over the pole foot, offset along the arm) and their mid-span sag; the birds sit on them */
const POLE_WIRE_Y = [[8.82, -1.1], [8.82, -0.75], [8.82, 0.75], [8.82, 1.1], [8.02, -0.85], [8.02, 0.85]], POLE_SAG = 0.55;
function buildPoleLine(scene) {
  const main = ROUTE.main;
  const pole = (() => {
    const gb = new GeoBin();
    gb.add('pole', new THREE.CylinderGeometry(0.1, 0.14, 9.2, 7, 1, true), M(0, 4.6, 0));
    for (const [y, w, n] of [[8.7, 2.5, 8], [7.9, 1.9, 6]]) {
      gb.add('pole', new THREE.BoxGeometry(0.1, 0.12, w), M(0, y, 0));
      for (let i = 0; i < n; i++) { const z = -w / 2 + 0.12 + i * (w - 0.24) / (n - 1); if (Math.abs(z) < 0.2) continue; gb.add('ins', new THREE.CylinderGeometry(0.035, 0.045, 0.12, 5, 1, true), M(0, y + 0.12, z)); }
      gb.add('pole', new THREE.BoxGeometry(0.04, 0.6, 0.04), M(0, y - 0.25, 0.4, 0.9, 0, 0));
    }
    const g = mergeGeos([...gb.bins.pole.map(x => { const c = new Float32Array(x.attributes.position.count * 3).fill(1); x.setAttribute('color', new THREE.BufferAttribute(c, 3)); return x; }),
      ...gb.bins.ins.map(x => { const c = new Float32Array(x.attributes.position.count * 3); for (let i = 0; i < c.length; i += 3) { c[i] = 0.55; c[i + 1] = 1.25; c[i + 2] = 1.05; } x.setAttribute('color', new THREE.BufferAttribute(c, 3)); return x; })]);
    return g;
  })();
  const pmat = new THREE.MeshLambertMaterial({ vertexColors: true, map: TEX.wood, color: 0x6a5846 });
  const wireMat = new THREE.LineBasicMaterial({ color: 0x1c1d1e, transparent: true, opacity: 0.85 });
  const wireY = POLE_WIRE_Y;
  let group = [], groupWires = [];
  const flush = () => {
    if (!group.length) return;
    const im = new THREE.InstancedMesh(pole.clone(), pmat, group.length);
    const sph = new THREE.Sphere(); const pts = group.map(g => g.p);
    sph.setFromPoints(pts); sph.radius += 12;
    group.forEach((g, i) => im.setMatrixAt(i, new THREE.Matrix4().makeRotationY(g.yaw).setPosition(g.p)));
    im.geometry.boundingSphere = sph; im.castShadow = false; im.name = 'pole line'; scene.add(im);
    im.userData = { c: sph.center.clone(), r: sph.radius };
    const grpM = [im];
    if (groupWires.length) { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(groupWires, 3)); lg.computeBoundingSphere(); const ls = new THREE.LineSegments(lg, wireMat); ls.userData = im.userData; scene.add(ls); grpM.push(ls); }
    (WORLD.poleGroups || (WORLD.poleGroups = [])).push(grpM);
    group = []; groupWires = [];
  };
  let prev = null;
  for (let s = 20; s < main.len; s += 48) {
    const pl = clearPlace(main, s, -14.5, 3.5);   // swings out round the passing sidings
    if (kept(pl.X, pl.N, 2) || riverDist(pl.X, pl.N) < 32 || offPoles(main, s)) { prev = null; continue; }
    const y = groundAt(pl.X, pl.N) - 0.3;
    const p = new THREE.Vector3(pl.X, y, -pl.N);
    const cur = { p, yaw: pl.yaw };
    solid(p.x, p.z, 0.35, y, y + 9.3);
    group.push(cur);
    if (prev) {
      (WORLD.birdWires || (WORLD.birdWires = [])).push({ a: prev, b: cur });
      for (const [wy, wz] of wireY) {
        const a = prev.p.clone().add(new THREE.Vector3(Math.sin(prev.yaw) * wz, wy + 0.1, Math.cos(prev.yaw) * wz));
        const b = cur.p.clone().add(new THREE.Vector3(Math.sin(cur.yaw) * wz, wy + 0.1, Math.cos(cur.yaw) * wz));
        const nseg = 8;
        for (let i = 0; i < nseg; i++) {
          const t0 = i / nseg, t1 = (i + 1) / nseg, sag0 = POLE_SAG * 4 * t0 * (1 - t0), sag1 = POLE_SAG * 4 * t1 * (1 - t1);
          groupWires.push(lerp(a.x, b.x, t0), lerp(a.y, b.y, t0) - sag0, lerp(a.z, b.z, t0), lerp(a.x, b.x, t1), lerp(a.y, b.y, t1) - sag1, lerp(a.z, b.z, t1));
        }
      }
    }
    prev = cur;
    if (group.length >= 16) { const last = group[group.length - 1]; flush(); group.push(last); }
  }
  flush();
}

/* -------- signals, mileposts, misc signs -------- */
function buildSignals(scene) {
  for (const sg of ROUTE.signals) {
    // on the right of the track, or on the left where another track runs close by on the right
    const dwarf = sg.kind === 'dwarf', off = dwarf ? 2.4 : 3.3, need = dwarf ? 2.2 : 3.0;
    const own = sg.line.locate(sg.sLine).edge, gap = l => { const q = linePlace(sg.line, sg.sLine, l); return trackGap(q.X, q.N, [own]); };
    let lat = sg.dir > 0 ? off : -off;
    if (gap(lat) < need && gap(-lat) >= need) lat = -lat;
    else if (gap(lat) < need) console.warn('signal crowded by another track', sg.line.name, Math.round(sg.sLine));
    const pl = linePlace(sg.line, sg.sLine, lat);
    const y = pl.y - 0.3;
    const yaw = pl.yaw + (sg.dir > 0 ? Math.PI : 0); // heads face oncoming train
    const base = baseM(pl.X, y, pl.N, yaw);
    const gb = binAt(pl.X, pl.N);
    const heads = [];
    const lamp = (x, hy, r) => { const lens = new THREE.Mesh(new THREE.CircleGeometry(r, 16), SMAT.lampOff); lens.matrixAutoUpdate = false; lens.matrix.copy(P(base, x, hy, 0, 0, Math.PI / 2, 0)); scene.add(lens); heads.push(lens);
      lens.userData.glowAt = new THREE.Vector3().setFromMatrixPosition(P(base, x + 0.1, hy, 0)); };
    if (dwarf) {
      // a dwarf: two lamps in a low cast housing on a short pedestal
      footing(gb, 'concrete', base, 0, 0, 0.7, 0.7, 0.3); walkPost(base, 0, 0, 0.45, 1.3);
      gb.add('steel', new THREE.CylinderGeometry(0.08, 0.1, 0.32, 8), P(base, 0, 0.46, 0));
      gb.add('steel', new THREE.BoxGeometry(0.3, 0.62, 0.36), P(base, -0.02, 0.92, 0));
      gb.add('signBack', new THREE.BoxGeometry(0.03, 0.7, 0.46), P(base, 0.145, 0.92, 0));
      for (const hy of [1.07, 0.78]) {
        gb.add('black', new THREE.CylinderGeometry(0.1, 0.1, 0.16, 12, 1, true, 0, Math.PI), P(base, 0.24, hy + 0.01, 0, 0, 0, Math.PI / 2).multiply(M(0, 0, 0, 0, Math.PI / 2, 0)));
        lamp(0.165, hy, 0.075);
      }
    } else {
      footing(gb, 'concrete', base, 0, 0, 0.9, 0.9, 0.35); walkPost(base, -0.08, 0, 0.55, 7.5);
      gb.add('steel', new THREE.CylinderGeometry(0.09, 0.11, 7.2, 8), P(base, 0, 3.8, 0));
      gb.add('steel', new THREE.BoxGeometry(0.05, 0.05, 0.6), P(base, 0.0, 5.0, -0.3));
      // ladder up the back of the mast: stiles on standoffs, rungs between
      for (const z of [-0.22, 0.22]) {
        gb.add('steel', new THREE.BoxGeometry(0.04, 5.3, 0.04), P(base, -0.24, 3.0, z));
        for (const y of [0.9, 3.0, 5.1]) gb.add('steel', new THREE.BoxGeometry(0.28, 0.04, 0.03), P(base, -0.165, y, z / 2, 0, z > 0 ? 0.97 : -0.97, 0));
      }
      for (let r = 0; r < 6; r++) gb.add('steel', new THREE.BoxGeometry(0.03, 0.03, 0.48), P(base, -0.24, 0.8 + r * 0.9, 0));
      for (const hy of [6.4, 4.4]) {
        gb.add('signBack', new THREE.CylinderGeometry(0.42, 0.42, 0.08, 20), P(base, 0.14, hy, 0, 0, 0, Math.PI / 2));
        gb.add('steel', new THREE.BoxGeometry(0.34, 0.5, 0.5), P(base, -0.05, hy, 0));
        gb.add('black', new THREE.CylinderGeometry(0.18, 0.18, 0.28, 12, 1, true, 0, Math.PI), P(base, 0.3, hy + 0.02, 0, 0, 0, Math.PI / 2).multiply(M(0, 0, 0, 0, Math.PI / 2, 0)));
        lamp(0.19, hy, 0.13);
      }
    }
    SCN.signals.push({ sg, heads, X: pl.X, N: pl.N, aspect: '' });
  }
}
/* lamp colours, top head then bottom head, for each aspect */
const ASPECT_LAMPS = { Clear: ['lampG', 'lampR'], Approach: ['lampY', 'lampR'], 'Diverging Clear': ['lampR', 'lampG'], 'Diverging Approach': ['lampR', 'lampY'], Restricting: ['lampR', 'lampL'], Stop: ['lampR', 'lampR'] };
let sigT = 0;
function updateSignals(dt = 0) {
  if ((sigT -= dt) > 0) return;
  sigT = 0.25;
  let changed = false;
  for (const s of SCN.signals) {
    const a = signalAspect(s);
    if (a === s.aspect) continue;
    s.aspect = a;
    const L = ASPECT_LAMPS[a];
    s.heads[0].material = SMAT[L[0]]; s.heads[1].material = SMAT[L[1]];
    changed = true;
  }
  if (changed) lampsSignals();
}
function buildSigns() {
  for (const mp of ROUTE.mileposts) {
    if ((ROUTE.tunnels || []).some(T => T.line === mp.line && mp.sLine > T.s0 - 15 && mp.sLine < T.s1 + 15)) continue;
    const pl = clearPlace(mp.line, mp.sLine, -3.6 - (ROUTE.spacing || 0));   // beyond track 2 and any siding off it
    const y = groundAt(pl.X, pl.N);
    const base = baseM(pl.X, y, pl.N, pl.yaw + Math.PI / 2);
    const gb = binAt(pl.X, pl.N);
    const k = 'mp' + mp.num; SMAT[k] = numberPlate(mp.num);
    gb.add('white', boxT(0.22, 1.9, 0.22), P(base, 0, 0.65, 0)); walkPost(base, 0, 0, 0.17, 1.6);
    gb.add(k, new THREE.BoxGeometry(0.24, 0.75, 0.24), P(base, 0, 1.1, 0));
  }
  // yard limit boards
  for (const [s, d] of ROUTE.yardLimits || [[300, 1], [1980, -1]]) {
    const pl = clearPlace(ROUTE.main, s, d > 0 ? 3.6 : -3.6 - (ROUTE.spacing || 0));
    const y = groundAt(pl.X, pl.N);
    const base = baseM(pl.X, y, pl.N, pl.yaw + (d > 0 ? Math.PI : 0));
    const gb = binAt(pl.X, pl.N);
    gb.add('white', boxT(0.12, 2.7, 0.12), P(base, 0, 1.05, 0)); walkPost(base, 0, 0, 0.12, 3.0);
    gb.add('yardLimit', new THREE.BoxGeometry(0.04, 0.8, 1.3), P(base, 0.08, 2.4, 0));
  }
}

/* -------- stations & facilities -------- */
function buildStations() {
  for (const st of ROUTE.stations) {
    if (st.kind === 'quarry') continue;
    const pl = linePlace(st.line, st.sLine, st.side * (12 + (st.across || 0))); pl.lat = st.side;
    depot(pl, st.name.toUpperCase(), st.kind === 'depot');
    if (st.line === ROUTE.main && ROUTE.main2 && (!ROUTE.span2 || (st.sLine > ROUTE.span2[0] && st.sLine < ROUTE.span2[1]))) stationCrossing(st);
  }
  for (const w of ROUTE.water) {
    if (w.kind === 'column') { const pl = linePlace(w.line, w.sLine, w.side * 3.1); pl.lat = w.side; waterColumn(pl); w.place = pl; }
    else { const pl = linePlace(w.line, w.sLine, w.side * 7.5); pl.lat = w.side; waterTower(pl); w.place = pl;
      // spout reaches over the track: modelled in waterTower toward -z of base (which faces track)
    }
  }
  if (WORLD.mtn) { mtFacilities(); return; }
  if (WORLD.custom) return;   // the rest is the Berkshire Division's own terminal
  const eng = ROUTE.features.engine;
  coalingTower(linePlace(eng, ROUTE.coal.sLine, 0));
  sandHouse(linePlace(eng, 300, 0));
  engineHouse(linePlace(eng, eng.len - 24, 0));
  const yo = linePlace(ROUTE.main, 470, -10 - ROUTE.spacing); yardOffice(yo);
  yardFloods();
  const fe = ROUTE.lines['Elevator Track'];
  const ge = linePlace(fe, 190, -24); ge.lat = -1; grainElevator(ge);
  kentonCoalFeed(); delphosOil();
  // Quarry Jct tower
  const sw = NET.switches.find(s => s.name === 'Quarry Jct');
  const lineMain = ROUTE.main;
  let sJ = 0; for (const e of lineMain.edges) if (e.a === sw.node) sJ = e.lineS0;
  const tp = linePlace(lineMain, sJ - 60, -11 - ROUTE.spacing); tp.lat = -1; interlockingTower(tp, 'QJ');
  quarry();
  // out on the extension: the tower at the Van Wert crossovers and the elevator on the Spencerville siding
  const xv = NET.switches.find(s => s.name === 'Van Wert crossover A');
  const vt = linePlace(lineMain, lineMain.cuts.find(c => c.node === xv.node).s - 70, 11); vt.lat = 1; interlockingTower(vt, 'VW');
  const sp = ROUTE.lines['Spencerville Siding'];
  const ge2 = linePlace(sp, 1500, -24); ge2.lat = -1; grainElevator(ge2, 'SPENCERVILLE ELEVATOR');
}
function quarry() {
  const br = ROUTE.branch;
  const end = linePlace(br, br.len - 70, 0);
  const base = baseM(end.X, end.y - 0.3, end.N, end.yaw);
  const gb = binAt(end.X, end.N);
  // loading tipple over the branch end
  for (const x of [-6, 6]) for (const z of [-3.6, 3.6]) { gb.add('steel', new THREE.BoxGeometry(0.45, 11, 0.45), P(base, x, 5.5, z)); footing(gb, 'concrete', base, x, z, 0.9, 0.9, 0.2); }
  gb.add('rust', boxT(14, 6, 8.4, 2), P(base, 0, 14, 0));
  gb.add('tin', gableRoof(14, 8.4, 1.2, 0.3), P(base, 0, 17, 0));
  gb.add('steel', new THREE.BoxGeometry(10, 2.4, 6), P(base, 0, 10, 0));
  for (const x of [-3, 0, 3]) gb.add('steel', new THREE.CylinderGeometry(0.4, 0.9, 2, 8), P(base, x, 7.8, 0));
  // belt conveyor climbs from the crusher house to the top of the loading bin
  gb.add('steel', new THREE.BoxGeometry(2, 1.6, 46), P(base, 0, 13.75, -23.5, -Math.atan2(7.5, 43), 0, 0));
  gb.add('rust', boxT(16, 18, 14, 3), P(base, 0, 9, -52));
  footing(gb, 'concrete', base, 0, -52, 16.2, 14.2, 0.05);
  gb.add('tin', gableRoof(16, 14, 3), P(base, 0, 18, -52));
  windowsRow(gb, base, -5, 5, 12, -45, 1, 1.4, 4);
  // stone piles
  const r = rng(77);
  for (let i = 0; i < 6; i++) {
    const h = 6 + r() * 8; const x = -40 + r() * 80, z = -70 - r() * 60;
    const X = end.X + Math.cos(end.yaw) * x + Math.sin(end.yaw) * z, N = end.N + Math.sin(end.yaw) * x - Math.cos(end.yaw) * z;
    let y = groundAt(X, N);   // bed the pile below the lowest ground round its foot
    for (let a = 0; a < 12; a++) y = Math.min(y, groundAt(X + Math.cos(a * TAU / 12) * h * 1.7, N + Math.sin(a * TAU / 12) * h * 1.7));
    binAt(X, N).add('stone', new THREE.ConeGeometry(h * 1.7, h, 18), baseM(X, y + h / 2 - 0.3, N, 0));
  }
  // spoil bank round the quarry, following the ground
  {
    const X0 = end.X + 160, N0 = end.N + 60, R = 120, n = 96, prof = [[-7, -0.4], [-2.5, 2.2], [2.5, 2.2], [7, -0.4]];
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const a = i / n * TAU, ca = Math.cos(a), sa = Math.sin(a);
      for (const [dr, dy] of prof) { const X = X0 + ca * (R + dr), N = N0 + sa * (R + dr); pos.push(X, groundAt(X, N) + dy, -N); uv.push(i * 1.5, dr / 3); }
      if (i) for (let q = 0; q < 3; q++) { const k = i * 4 + q, p = k - 4; idx.push(p, k, p + 1, p + 1, k, k + 1); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    if (g.attributes.normal.getY(1) < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
    gb.add('stone', g, new THREE.Matrix4());
  }
  keep(end.X, end.N, 70);
}

/* -------- trees -------- */
/* instanced near (leaf-card) and far (impostor) meshes for a batch of trees: items are [X, y, N, sx, sy, sRGB colour] */
function treeMeshes(L, scene) {
  const G = foliageGeos(), out = { hi: [], lo: [], pts: [] };
  for (const k of ['dec', 'con']) {
    const list = L[k]; if (!list || !list.length) continue;
    const pts = list.map(q => new THREE.Vector3(q[0], q[1], -q[2]));
    const sph = new THREE.Sphere().setFromPoints(pts); sph.radius += 14;
    const vari = [list.filter(q => ((q[0] * 7.3 + q[2] * 3.1) % 2 + 2) % 2 < 1), list.filter(q => ((q[0] * 7.3 + q[2] * 3.1) % 2 + 2) % 2 >= 1)];
    const set = (im, i, q) => {
      _m4.compose(_v1.set(q[0], q[1], -q[2]), _q.setFromEuler(_e.set(0, ((q[0] * 13.1 + q[2]) % TAU + TAU) % TAU, 0)), _v2.set(q[3], q[4], q[3]));
      im.setMatrixAt(i, _m4); setFolColor(im, i, q[5]);
    };
    // near trees go in 250 m patches, so only the patches round the camera send their leaf cards to the GPU
    vari.forEach((vl, v) => {
      const patches = new Map();
      for (const q of vl) { const key = Math.floor(q[0] / 250) + ',' + Math.floor(q[2] / 250); let a = patches.get(key); if (!a) patches.set(key, a = []); a.push(q); }
      for (const [, pl] of patches) {
        const ps = new THREE.Sphere().setFromPoints(pl.map(q => new THREE.Vector3(q[0], q[1], -q[2]))); ps.radius += 14;
        const im = new THREE.InstancedMesh(shareGeo(G[v ? k + '2' : k], ps), MAT.treeNear, pl.length);
        pl.forEach((q, i) => set(im, i, q)); folColorsDone(im);
        im.userData.sph = ps; im.userData.fk = v ? k + '2' : k; out.hi.push(im);   // fk: which model, for the tree shadows (10g)
      }
    });
    const lo = new THREE.InstancedMesh(shareGeo(G[k + 'Lo'], sph.clone()), MAT.treeFar, list.length);
    list.forEach((q, i) => set(lo, i, q)); folColorsDone(lo);
    out.lo.push(lo); out.pts.push(...pts);
  }
  for (const m of [...out.hi, ...out.lo]) { m.castShadow = false; m.receiveShadow = false; m.visible = false; scene.add(m); WORLD.treeMeshes.push(m); }
  return out;
}
function buildTrees(scene) {
  const tiles = new Map();
  const put = (X, N, type, s, c) => {
    const k = Math.floor((X + 20000) / 1500) + ',' + Math.floor((N + 20000) / 1500);
    if (!tiles.has(k)) tiles.set(k, { dec: [], con: [] });
    tiles.get(k)[type].push([X, N, s, c]);
  };
  const cedar = (r) => [0.13 + r() * 0.05, 0.22 + r() * 0.06, 0.13 + r() * 0.03];   // red cedar and spruce, the farm windbreak evergreens
  const ok = (X, N, pad) => {
    const lat = latticeAt(X, N); if (lat && lat.d < 24 + pad) return false;
    if (WORLD.trackHash && trackWithin(X, N, 14 + pad)) return false;   // the lattice is a 20 m grid; check the real distance close in
    for (const rx of WORLD.roadsX) if (Math.abs(X - rx) < 11) return false;
    if (Math.abs(N - WORLD.roadN) < 12) return false;
    if (riverDist(X, N) < 30) return false;
    if (kept(X, N)) return false;
    if (X < INNER.x0 + 20 || X > INNER.x1 - 20 || N < INNER.n0 + 20 || N > INNER.n1 - 20) return false;
    return true;
  };
  const autumn = (r) => { const x = r(); if (x < 0.55) return [0.28 + r() * 0.1, 0.42 + r() * 0.12, 0.17 + r() * 0.06]; if (x < 0.8) return [0.72 + r() * 0.15, 0.55 + r() * 0.15, 0.16]; if (x < 0.93) return [0.7 + r() * 0.1, 0.27 + r() * 0.1, 0.12]; return [0.55, 0.4, 0.2]; };
  const r = rng(2024), rw = rng(4202);
  // woodlots
  // the old map's columns first, then the extension's, so the trees that were there stay where they were
  const iA = Math.floor((INNER.x0 + 40000) / FIELD.w), iB = Math.floor((INNER.x1 + 40000) / FIELD.w), iO = Math.max(iA, Math.floor((-6000 + 40000) / FIELD.w));
  for (const i of [...Array(iB - iO + 1).keys()].map(k => iO + k).concat([...Array(iO - iA).keys()].map(k => iA + k)))
    for (let j = Math.floor((INNER.n0 + 40000) / FIELD.h); j <= Math.floor((INNER.n1 + 40000) / FIELD.h); j++) {
      const X0 = i * FIELD.w - 40000, N0 = j * FIELD.h - 40000;
      const f = fieldAt(X0 + 1, N0 + 1);
      if (f.t.n === 'woods') {
        let spots = 0, planted = 0;
        const r = rw;   // own stream, so woodlot changes don't reshuffle the fence rows and windbreaks
        for (let x = 0.18; x < 0.82; x += 14 / FIELD.w) for (let y = 0.2; y < 0.78; y += 14 / FIELD.h) {
          const X = X0 + (x + (r() - 0.5) * 0.025) * FIELD.w, N = N0 + (y + (r() - 0.5) * 0.04) * FIELD.h;
          spots++;
          if (!ok(X, N, 0)) continue;
          planted++;
          if (r() < 0.22) put(X, N, 'dec', -(0.9 + r() * 0.5), [0.16 + r() * 0.05, 0.27 + r() * 0.06, 0.15]);
          else put(X, N, 'dec', 0.85 + r() * 0.6, autumn(r));
        }
        // the ground shader lays leaf litter only under woodlots that really stand; a cleared one stays meadow
        if (planted > spots * 0.4) WORLD.fieldTex.plant(i, j);
      }
      // fence-row trees along some field edges
      if (Noise.hash(i * 3 + 1, j * 7 + 2) < 0.22) {
        for (let x = 0; x < FIELD.w; x += 18 + r() * 30) { const X = X0 + x, N = N0 + (r() - 0.5) * 3; if (ok(X, N, 6) && r() < 0.6) { if (r() < 0.12) put(X, N, 'con', 0.6 + r() * 0.3, cedar(r)); else put(X, N, 'dec', 0.8 + r() * 0.5, autumn(r)); } }
      }
      if (Noise.hash(i * 5 + 3, j * 11 + 1) < 0.16) {
        for (let y = 0; y < FIELD.h; y += 18 + r() * 30) { const X = X0 + (r() - 0.5) * 3, N = N0 + y; if (ok(X, N, 6) && r() < 0.6) put(X, N, 'dec', 0.8 + r() * 0.5, autumn(r)); }
      }
    }
  // riverbank trees
  for (const p of WORLD.riverPts) for (const side of [-1, 1]) for (let q = 0; q < 1; q++) {
    const X = p[0] + side * (34 + r() * 40), N = p[1] + (r() - 0.5) * 20;
    if (ok(X, N, 0) && r() < 0.8) put(X, N, 'dec', 0.9 + r() * 0.6, autumn(r));
  }
  // windbreaks at farmsteads
  for (const f of SCN.farms) for (let i = 0; i < 14; i++) {
    const a = r() * TAU, d = 20 + r() * 30; const X = f.X + Math.cos(a) * d, N = f.N + Math.sin(a) * d;
    if (r() < 0.6) {
      const sc = (r() < 0.4 ? -1 : 1) * (1 + r() * 0.5), col = autumn(r), con = r() < 0.35;
      if (!inFoot(X, N, 3.6 * Math.abs(sc))) { if (con) put(X, N, 'con', 0.8 + r() * 0.4, cedar(r)); else put(X, N, 'dec', sc, col); }
    }
  }
  for (const t of SCN.extraTrees || []) { const col = t[3] || autumn(r); if (!inFoot(t[0], t[1], 3.6 * Math.abs(t[2]))) put(t[0], t[1], 'dec', t[2], col); }
  let total = 0;
  WORLD.treeTiles = [];
  for (const [, t] of tiles) {
    const L = { dec: [], con: [] };
    for (const k of ['dec', 'con']) for (const [X, N, s0, c] of t[k]) {
      const y = groundAt(X, N) - 0.3, s = Math.abs(s0), col = s0 < 0;   // a negative scale is a columnar tree (poplar, tulip tree)
      if (k === 'con') { L.con.push([X, y, N, s, s * (0.95 + ((X * 7 + N * 3) % 1) * 0.2), c]); solid(X, -N, 2.6 * s, y + 1.5 * s, y + 10 * s); continue; }
      L.dec.push(col ? [X, y, N, s * 0.55, s * 1.45, c] : [X, y, N, s, s * (0.9 + ((X * 7 + N * 3) % 1) * 0.2), c]);
      if (col) solid(X, -N, 1.95 * s, y + 4.3 * s, y + 14.1 * s); else solid(X, -N, 3.7 * s, y + 2.4 * s, y + 9.9 * s);
    }
    const M = treeMeshes(L, scene);
    total += L.dec.length + L.con.length;
    if (M.pts.length) { const sp = new THREE.Sphere().setFromPoints(M.pts); WORLD.treeTiles.push({ hi: M.hi, lo: M.lo, c: sp.center, r: sp.radius }); }
  }
  WORLD.treeCount = total;
}

function buildFarms() {
  SCN.farms = [];
  const r = rng(808);
  const cand = [];
  for (const X of WORLD.roadsX) if (X > -4000) for (let N = -1800; N < 6800; N += 520 + r() * 500) cand.push([X + (r() < 0.5 ? -1 : 1) * (28 + r() * 10), N, X]);
  for (let X = -5600; X < 5600; X += 600 + r() * 500) cand.push([X, WORLD.roadN - 30 - r() * 10, null]);
  // the extension's farms come after, on their own stream, so the old map's farms stay as they were
  const r2 = rng(1808), cand2 = [];
  for (const X of WORLD.roadsX) if (X <= -4000) for (let N = -1800; N < 6800; N += 520 + r2() * 500) cand2.push([X + (r2() < 0.5 ? -1 : 1) * (28 + r2() * 10), N, X, r2]);
  for (let X = INNER.x0 + 900; X < -5600; X += 600 + r2() * 500) cand2.push([X, WORLD.roadN - 30 - r2() * 10, null, r2]);
  for (const c of cand) c.push(r);
  for (const [X, N, rx, r] of [...cand, ...cand2]) {
    const lat = latticeAt(X, N); if (lat && lat.d < 90) continue;
    if (riverDist(X, N) < 120 || kept(X, N, 30)) continue;
    const f = fieldAt(X, N); if (f.t.n === 'woods') continue;
    const yaw = rx !== null ? (X < rx ? 0 : Math.PI) + Math.PI / 2 * 0 : Math.PI / 2;
    SCN.farms.push(farmstead(X, N, rx !== null ? (X < rx ? -Math.PI / 2 : Math.PI / 2) : 0, r));
  }
}

function finalizeScenery(scene) {
  sceneryBoxes();   // before the bins merge: the overhead line keeps its masts clear of all of it
  const mats = { ...SMAT, steel: SMAT.steel, redPaint: MAT.redPaint, tie: MAT.tie };
  WORLD.binGroups = [];
  for (const [, gb] of SCN.bins) {
    const grp = gb.build(mats, { cast: false });
    grp.children.forEach(m => { m.castShadow = false; m.receiveShadow = true; });
    const sp = new THREE.Sphere(); let first = true;
    grp.children.forEach(m => { const b = m.geometry.boundingSphere; if (first) { sp.copy(b); first = false; } else sp.union(b); });
    grp.userData = { c: sp.center.clone(), r: sp.radius };
    scene.add(grp); WORLD.binGroups.push(grp);
  }
}

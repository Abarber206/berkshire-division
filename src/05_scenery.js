/* ============================================================================
   Scenery: buildings, bridge, roads & crossings, pole line, signals, trees
   ========================================================================== */
const SMAT = {};
const SCN = { bins: new Map(), keepout: [], signals: [], winMats: [], lamps: [], crossings: [] };
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
  SCN.winMats.push(SMAT.win);
  SMAT.road = new THREE.MeshLambertMaterial({ color: 0x55534f, map: TEX.ground });
  SMAT.gravel = new THREE.MeshLambertMaterial({ color: 0x9f927a, map: TEX.ballast });
  SMAT.line = new THREE.MeshBasicMaterial({ color: 0xd9c56a });
  SMAT.pole = new THREE.MeshLambertMaterial({ color: 0x5b4a3a, map: TEX.wood });
  SMAT.insul = new THREE.MeshLambertMaterial({ color: 0x4f8a78 });
  SMAT.signBack = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  SMAT.lampG = new THREE.MeshBasicMaterial({ color: 0x40ff8a });
  SMAT.lampR = new THREE.MeshBasicMaterial({ color: 0xff3c2e });
  SMAT.lampY = new THREE.MeshBasicMaterial({ color: 0xffc23a });
  SMAT.lampOff = new THREE.MeshLambertMaterial({ color: 0x121414 });
  const xb = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#f2f1ec'; g.fillRect(0, 0, w, h); g.strokeStyle = '#111'; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6); g.fillStyle = '#111'; g.font = 'bold 30px Arial Narrow, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('RAILROAD', w / 2, h / 2 + 2); });
  SMAT.crossbuck = new THREE.MeshLambertMaterial({ map: xb });
  const xb2 = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#f2f1ec'; g.fillRect(0, 0, w, h); g.strokeStyle = '#111'; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6); g.fillStyle = '#111'; g.font = 'bold 30px Arial Narrow, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('CROSSING', w / 2, h / 2 + 2); });
  SMAT.crossbuck2 = new THREE.MeshLambertMaterial({ map: xb2 });
  SMAT.wpost = new THREE.MeshLambertMaterial({ map: canvasTex(64, 96, (g, w, h) => { g.fillStyle = '#f2f1ec'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.font = 'bold 72px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('W', w / 2, h / 2 + 4); }) });
  SMAT.yardLimit = new THREE.MeshLambertMaterial({ map: canvasTex(256, 96, (g, w, h) => { g.fillStyle = '#f2f1ec'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.font = 'bold 40px Arial Narrow, Arial'; g.textAlign = 'center'; g.fillText('YARD', w / 2, 42); g.fillText('LIMIT', w / 2, 84); }) });
}
const nameBoard = (txt) => new THREE.MeshLambertMaterial({ map: canvasTex(512, 96, (g, w, h) => { g.fillStyle = '#1b1d1c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8e3d0'; g.lineWidth = 5; g.strokeRect(8, 8, w - 16, h - 16); g.fillStyle = '#efe9d6'; g.font = 'bold 58px "Arial Narrow", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 3); }) });
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
function hipRoof(L, W, H, over = 0.6) {
  const l = L / 2 + over, w = W / 2 + over, r = Math.max(0, l - w);
  const v = [[-l, 0, -w], [l, 0, -w], [l, 0, w], [-l, 0, w], [-r, H, 0], [r, H, 0]];
  const f = [[0, 4, 5], [0, 5, 1], [1, 5, 2], [2, 5, 4], [2, 4, 3], [3, 4, 0]];
  return polyGeo(v, f, 3);
}
function gableRoof(L, W, H, over = 0.5) {
  const l = L / 2 + over, w = W / 2 + over;
  const v = [[-l, 0, -w], [l, 0, -w], [l, 0, w], [-l, 0, w], [-l, H, 0], [l, H, 0]];
  const f = [[0, 4, 5], [0, 5, 1], [2, 5, 4], [2, 4, 3], [3, 4, 0], [1, 5, 2]];
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
function keep(X, N, r) { SCN.keepout.push([X, N, r]); }
const kept = (X, N, pad = 0) => { for (const k of SCN.keepout) if ((X - k[0]) ** 2 + (N - k[1]) ** 2 < (k[2] + pad) ** 2) return true; return false; };
/* frame on a line at distance sLine with lateral offset: returns {X,N,y,yaw} */
function linePlace(line, sLine, lat = 0) {
  const loc = line.locate(sLine); loc.edge.pose(loc.s, FR);
  const yaw = Math.atan2(-FR.f.z, FR.f.x);
  const X = FR.p.x + Math.sin(yaw) * lat, N = -(FR.p.z + Math.cos(yaw) * lat);
  return { X, N, y: FR.p.y, yaw, edge: loc.edge, s: loc.s };
}
function windowsRow(gb, base, x0, x1, y, z, w, h, n, face = 1) {
  for (let i = 0; i < n; i++) { const x = n === 1 ? (x0 + x1) / 2 : lerp(x0, x1, i / (n - 1)); gb.add('win', new THREE.BoxGeometry(w, h, 0.06), P(base, x, y, z + face * 0.03)); gb.add('trim', new THREE.BoxGeometry(w + 0.16, 0.1, 0.1), P(base, x, y - h / 2 - 0.05, z + face * 0.05)); }
}

/* -------- buildings -------- */
function depot(pl, name, big) {
  const L = big ? 26 : 16, W = big ? 8 : 6.5, H = 4.1;
  const off = pl.lat;
  const base = baseM(pl.X, pl.y - 0.15, pl.N, pl.yaw + (off < 0 ? 0 : Math.PI));
  const gb = binAt(pl.X, pl.N);
  gb.add('brick', boxT(L, 0.9, W, 2), P(base, 0, 0.45, 0));
  gb.add('cream', boxT(L - 0.1, H - 0.9, W - 0.1, 2), P(base, 0, 0.9 + (H - 0.9) / 2, 0));
  gb.add('trim', new THREE.BoxGeometry(L + 0.1, 0.18, W + 0.1), P(base, 0, 0.95, 0));
  gb.add('trim', new THREE.BoxGeometry(L + 0.1, 0.25, W + 0.1), P(base, 0, H - 0.1, 0));
  // operator's bay facing track (+z side of base faces the track)
  gb.add('cream', boxT(3.2, H - 0.9, 1.4, 2), P(base, 0, 0.9 + (H - 0.9) / 2, W / 2 + 0.6));
  windowsRow(gb, base, -1.0, 1.0, 2.4, W / 2 + 1.3, 0.8, 1.5, 2);
  windowsRow(gb, base, -L / 2 + 2, -2.6, 2.4, W / 2, 0.9, 1.6, big ? 4 : 2);
  windowsRow(gb, base, 2.6, L / 2 - 2, 2.4, W / 2, 0.9, 1.6, big ? 3 : 2);
  windowsRow(gb, base, -L / 2 + 2, L / 2 - 2, 2.4, -W / 2, 0.9, 1.6, big ? 6 : 4, -1);
  // freight doors
  gb.add('trim', new THREE.BoxGeometry(2.4, 2.6, 0.08), P(base, L / 2 - 2.5, 1.3, W / 2 + 0.02));
  gb.add('slate', hipRoof(L, W, 2.6, 1.6), P(base, 0, H, 0));
  // roof brackets
  for (let x = -L / 2 + 1; x <= L / 2 - 1; x += 3) for (const z of [-1, 1]) gb.add('trim', new THREE.BoxGeometry(0.14, 0.7, 1.4), P(base, x, H - 0.45, z * (W / 2 + 0.6), z * 0.6, 0, 0));
  gb.add('brick', boxT(0.7, 2.2, 0.7, 2), P(base, L / 4, H + 2.0, -0.6));
  // platform along the track
  gb.add('platform', boxT(L + 50, 0.32, 5.2, 3), P(base, 0, 0.0, W / 2 + 2.7));
  // name boards on both ends + track side
  const nb = nameBoard(name);
  const mat = 'nb_' + name;
  SMAT[mat] = nb;
  gb.add(mat, new THREE.PlaneGeometry(4.2, 0.8), P(base, 0, H + 0.2, W / 2 + 1.45));
  for (const s of [-1, 1]) gb.add(mat, new THREE.PlaneGeometry(3.4, 0.65), P(base, s * (L / 2 + 0.02), H - 0.8, 0, 0, s * Math.PI / 2, 0));
  // baggage carts & benches
  for (let i = 0; i < 3; i++) gb.add('trim', new THREE.BoxGeometry(1.8, 0.12, 0.5), P(base, -L / 2 + 3 + i * 4, 0.6, W / 2 + 0.7));
  gb.add('wood', boxT(2.8, 0.7, 1.2), P(base, L / 2 + 6, 0.55, W / 2 + 2.6));
  // train order signal mast at the bay
  gb.add('steel', new THREE.CylinderGeometry(0.08, 0.1, 7, 8), P(base, 0, 3.5 + 0.3, W / 2 + 2.4));
  for (const s of [-1, 1]) gb.add('redPaint', new THREE.BoxGeometry(1.4, 0.3, 0.05), P(base, s * 0.8, 6.3, W / 2 + 2.4, 0, 0, s * 0.7));
  keep(pl.X, pl.N, L / 2 + 8);
  SCN.lamps.push(new THREE.Vector3().setFromMatrixPosition(P(base, 0, 3.4, W / 2 + 1.7)));
}
function waterColumn(pl) {
  const base = baseM(pl.X, pl.y - 0.2, pl.N, pl.yaw + (pl.lat < 0 ? 0 : Math.PI));
  const gb = binAt(pl.X, pl.N);
  gb.add('steel', new THREE.CylinderGeometry(0.35, 0.45, 0.6, 12), P(base, 0, 0.3, 0));
  gb.add('steel', new THREE.CylinderGeometry(0.2, 0.2, 4.4, 12), P(base, 0, 2.6, 0));
  gb.add('steel', new THREE.CylinderGeometry(0.17, 0.17, 3.0, 10), P(base, 1.4, 4.7, 0.25, 0, 0, Math.PI / 2));
  gb.add('steel', new THREE.CylinderGeometry(0.16, 0.2, 1.1, 10), P(base, 2.85, 4.25, 0.25));
  gb.add('steel', new THREE.BoxGeometry(0.4, 0.4, 0.5), P(base, 0, 4.6, -0.6));
  gb.add('steel', new THREE.TorusGeometry(0.28, 0.03, 6, 16), P(base, 0.3, 1.4, 0, 0, Math.PI / 2, 0));
  keep(pl.X, pl.N, 6);
}
function waterTower(pl) {
  const base = baseM(pl.X, pl.y - 0.3, pl.N, pl.yaw + Math.PI);
  const gb = binAt(pl.X, pl.N);
  const H = 9;
  for (const [x, z] of [[-2.6, -2.6], [2.6, -2.6], [2.6, 2.6], [-2.6, 2.6]]) gb.add('steel', new THREE.CylinderGeometry(0.16, 0.22, H, 8), P(base, x * 0.92, H / 2, z * 0.92 + 1.6, z * 0.03, 0, -x * 0.03));
  for (const y of [3, 6]) { gb.add('steel', new THREE.BoxGeometry(5.0, 0.12, 0.12), P(base, 0, y, -2.4 + 1.6)); gb.add('steel', new THREE.BoxGeometry(5.0, 0.12, 0.12), P(base, 0, y, 2.4 + 1.6)); gb.add('steel', new THREE.BoxGeometry(0.12, 0.12, 5), P(base, -2.4, y, 1.6)); gb.add('steel', new THREE.BoxGeometry(0.12, 0.12, 5), P(base, 2.4, y, 1.6)); }
  gb.add('steel', new THREE.BoxGeometry(6.4, 0.3, 6.4), P(base, 0, H, 1.6));
  gb.add('tank', new THREE.CylinderGeometry(3.6, 3.7, 5.2, 28), P(base, 0, H + 2.7, 1.6));
  for (let y = 0.4; y < 5.2; y += 0.7) gb.add('steel', new THREE.TorusGeometry(3.72, 0.04, 4, 32), P(base, 0, H + 0.2 + y, 1.6, Math.PI / 2, 0, 0));
  gb.add('slate', new THREE.ConeGeometry(4.1, 2.2, 28), P(base, 0, H + 6.4, 1.6));
  gb.add('steel', new THREE.CylinderGeometry(0.24, 0.24, 3.6, 10), P(base, 0, H + 0.4, 6.2, Math.PI / 2 + 0.45, 0, 0));
  gb.add('steel', new THREE.CylinderGeometry(0.03, 0.03, 4.5, 6), P(base, 0, H - 1.2, 7.5, 0.25, 0, 0));
  keep(pl.X, pl.N, 8);
}
function coalingTower(pl) {
  const base = baseM(pl.X, pl.y - 0.25, pl.N, pl.yaw);
  const gb = binAt(pl.X, pl.N);
  // straddles the track: legs at z = ±3.2
  for (const z of [-3.4, 3.4]) for (const x of [-4.5, 4.5]) gb.add('concrete', boxT(1.1, 7.5, 1.1), P(base, x, 3.75, z));
  gb.add('concrete', boxT(11, 15, 9, 3), P(base, 0, 7.5 + 7.5, 0));
  gb.add('concrete', boxT(11.4, 0.5, 9.4), P(base, 0, 7.5, 0));
  gb.add('tin', boxT(6, 4, 5, 2), P(base, 0, 24.5, 0));
  gb.add('slate', gableRoof(6, 5, 1.6, 0.3), P(base, 0, 26.5, 0));
  for (const x of [-2.5, 2.5]) gb.add('steel', new THREE.BoxGeometry(0.8, 0.6, 3.2), P(base, x, 6.7, 1.2, -0.6, 0, 0));
  windowsRow(gb, base, -3.5, 3.5, 18, 4.5, 0.8, 1.2, 3);
  // conveyor/hoist house at side
  gb.add('tin', boxT(4, 3, 4), P(base, 0, 1.5, -8));
  gb.add('steel', new THREE.BoxGeometry(1.4, 1.4, 9), P(base, 0, 10, -6.4, -1.0, 0, 0));
  keep(pl.X, pl.N, 9);
}
function sandHouse(pl) {
  const base = baseM(pl.X, pl.y - 0.2, pl.N, pl.yaw);
  const gb = binAt(pl.X, pl.N);
  gb.add('brick', boxT(8, 4, 5, 2), P(base, 0, 2, 8));
  gb.add('slate', gableRoof(8, 5, 1.4), P(base, 0, 4, 8));
  for (const x of [-0.8, 0.8]) for (const z of [4.8, 6.4]) gb.add('steel', new THREE.CylinderGeometry(0.08, 0.08, 6, 6), P(base, x, 3, z));
  gb.add('steel', new THREE.CylinderGeometry(1.0, 1.0, 3.5, 14), P(base, 0, 7.8, 5.6));
  gb.add('steel', new THREE.ConeGeometry(1.0, 1.2, 14), P(base, 0, 5.4, 5.6, Math.PI, 0, 0));
  gb.add('steel', new THREE.CylinderGeometry(0.08, 0.08, 4.0, 6), P(base, 0, 6.0, 3.4, -0.9, 0, 0));
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
  gb.add('trim', new THREE.BoxGeometry(0.2, 6.0, 1.9), P(base, -L / 2 - 1.0, 3.0, -2.6, 0, -0.9, 0));
  gb.add('trim', new THREE.BoxGeometry(0.2, 6.0, 1.9), P(base, -L / 2 - 1.0, 3.0, 2.6, 0, 0.9, 0));
  gb.add('tin', boxT(L + 1.0, 0.35, W + 1.0), P(base, 0, H + 0.15, 0));
  gb.add('slate', gableRoof(L, W, 2.2, 0.5), P(base, 0, H + 0.3, 0));
  windowsRow(gb, base, -L / 2 + 4, L / 2 - 4, 5.2, W / 2 + 0.42, 1.5, 3.0, 8);
  windowsRow(gb, base, -L / 2 + 4, L / 2 - 4, 5.2, -W / 2 - 0.42, 1.5, 3.0, 8, -1);
  for (const x of [-14, 0, 14]) gb.add('black', new THREE.CylinderGeometry(0.55, 0.85, 3.0, 10), P(base, x, H + 3.0, 0));
  gb.add('concrete', boxT(L, 0.12, W - 1), P(base, 0, 0.0, 0));
  keep(pl.X, pl.N, L / 2 + 6);
}
function yardOffice(pl) {
  const base = baseM(pl.X, pl.y - 0.2, pl.N, pl.yaw);
  const gb = binAt(pl.X, pl.N);
  gb.add('cream', boxT(8, 3.4, 5, 2), P(base, 0, 1.7, 0));
  gb.add('slate', gableRoof(8, 5, 1.8, 0.6), P(base, 0, 3.4, 0));
  windowsRow(gb, base, -2.5, 2.5, 2, 2.5, 0.9, 1.3, 3);
  windowsRow(gb, base, -2.5, 2.5, 2, -2.5, 0.9, 1.3, 3, -1);
  gb.add('brick', boxT(0.6, 1.6, 0.6), P(base, 2.5, 4.6, 0));
  keep(pl.X, pl.N, 9);
}
function grainElevator(pl) {
  const base = baseM(pl.X, pl.y - 0.3, pl.N, pl.yaw + (pl.lat < 0 ? Math.PI : 0));
  const gb = binAt(pl.X, pl.N);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) gb.add('concrete', new THREE.CylinderGeometry(3.4, 3.4, 30, 24), P(base, -12 + i * 6.8, 15, 3.4 + j * 6.8));
  gb.add('concrete', boxT(34.5, 2, 14, 3), P(base, 0, 31, 6.8));
  gb.add('concrete', boxT(9, 46, 10, 3), P(base, 21, 23, 6.8));
  gb.add('tin', boxT(9.4, 5, 10.4, 2), P(base, 21, 48.5, 6.8));
  gb.add('slate', gableRoof(9.4, 10.4, 1.6, 0.2), P(base, 21, 51, 6.8));
  windowsRow(gb, base, 18, 24, 40, 1.8, 0.8, 1.2, 3, -1);
  gb.add('tin', boxT(16, 6, 9, 2), P(base, 33, 3, 5));
  gb.add('slate', gableRoof(16, 9, 1.8), P(base, 33, 6, 5));
  gb.add('steel', new THREE.BoxGeometry(1.2, 1.2, 14), P(base, 21, 30, -5.5, 0.8, 0, 0));
  gb.add('steel', new THREE.CylinderGeometry(0.3, 0.3, 16, 8), P(base, 14, 20, -6.0, -0.75, 0, 0));
  keep(pl.X, pl.N, 34);
  const nb = nameBoard('FOSTORIA GRAIN CO.'); SMAT.nbGrain = nb;
  gb.add('nbGrain', new THREE.PlaneGeometry(16, 2.8), P(base, 0, 26, -0.1, 0, Math.PI, 0));
}
function interlockingTower(pl, label) {
  const base = baseM(pl.X, pl.y - 0.2, pl.N, pl.yaw + (pl.lat < 0 ? 0 : Math.PI));
  const gb = binAt(pl.X, pl.N);
  gb.add('brick', boxT(5, 3.2, 4.5, 2), P(base, 0, 1.6, 0));
  gb.add('cream', boxT(5.2, 3.0, 4.7, 2), P(base, 0, 4.7, 0));
  windowsRow(gb, base, -1.8, 1.8, 4.9, 2.36, 1.0, 1.8, 3);
  windowsRow(gb, base, -1.8, 1.8, 4.9, -2.36, 1.0, 1.8, 3, -1);
  gb.add('slate', hipRoof(5.2, 4.7, 1.8, 0.7), P(base, 0, 6.2, 0));
  gb.add('wood', boxT(0.9, 0.1, 3.2), P(base, 3.0, 2.9, 0, 0, 0, 0.6));
  const nb = nameBoard(label); SMAT['nb_' + label] = nb;
  gb.add('nb_' + label, new THREE.PlaneGeometry(2.4, 0.5), P(base, 0, 3.45, 2.38));
  keep(pl.X, pl.N, 7);
}
function farmstead(X, N, yaw, r) {
  const y = groundAt(X, N);
  const base = baseM(X, y - 0.2, N, yaw);
  const gb = binAt(X, N);
  // house
  gb.add('white', boxT(9, 6.2, 7), P(base, 0, 3.1, 0));
  gb.add('slate', gableRoof(9, 7, 3.0, 0.45), P(base, 0, 6.2, 0));
  gb.add('white', boxT(6, 3, 4), P(base, -6.5, 1.5, 1.5));
  gb.add('slate', gableRoof(6, 4, 1.4, 0.3), P(base, -6.5, 3, 1.5));
  windowsRow(gb, base, -3, 3, 1.8, 3.5, 0.9, 1.4, 3); windowsRow(gb, base, -3, 3, 4.6, 3.5, 0.9, 1.3, 3);
  windowsRow(gb, base, -3, 3, 1.8, -3.5, 0.9, 1.4, 3, -1); windowsRow(gb, base, -3, 3, 4.6, -3.5, 0.9, 1.3, 3, -1);
  gb.add('trim', new THREE.BoxGeometry(9.2, 0.12, 2.4), P(base, 0, 2.9, 4.6));
  gb.add('brick', boxT(0.8, 2.6, 0.8), P(base, 2.5, 7.6, 0));
  // barn
  const bx = 30 + r() * 15, bz = -14 - r() * 12;
  const bL = 22 + r() * 8, bW = 13;
  gb.add('barn', boxT(bL, 5.5, bW, 2.4), P(base, bx, 2.75, bz));
  gb.add(r() < 0.5 ? 'slate' : 'rust', gambrel(bL, bW, 6.2), P(base, bx, 5.5, bz));
  gb.add('white', new THREE.BoxGeometry(4, 4, 0.1), P(base, bx - bL / 2 - 0.05, 2.2, bz, 0, Math.PI / 2, 0));
  // silos
  const ns = 1 + (r() * 2 | 0);
  for (let i = 0; i < ns; i++) { const sx = bx + bL / 2 + 3.5 + i * 6.5; const tall = 13 + r() * 6; gb.add(r() < 0.5 ? 'concrete' : 'silver', new THREE.CylinderGeometry(2.6, 2.6, tall, 18), P(base, sx, tall / 2, bz - 2)); gb.add('tin', new THREE.SphereGeometry(2.65, 16, 8, 0, TAU, 0, Math.PI / 2), P(base, sx, tall, bz - 2)); }
  // corn crib / shed
  gb.add('wood', boxT(10, 3.4, 4), P(base, 8, 1.7, -30));
  gb.add('tin', gableRoof(10, 4, 1.2, 0.3), P(base, 8, 3.4, -30));
  keep(X, N, 55);
  return { X, N, yaw };
}

/* -------- bridge (two through-truss Pratt spans) -------- */
function buildBridge(scene) {
  const b = ROUTE.bridge, main = ROUTE.main;
  const c = linePlace(main, b.s, 0);
  const base = baseM(c.X, c.y, c.N, c.yaw);
  const gb = new GeoBin();
  const span = 64, H = 9.2, W = 2.85, panels = 8, pw = span / panels;
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
    for (const z of [-0.85, 0.85]) gb.add('steel', new THREE.BoxGeometry(span, 0.7, 0.3), P(base, sOff, -0.75, z));
    for (let i = 1; i < panels - 1; i++) {
      const xa = x0 + i * pw, xb = xa + pw, L = Math.hypot(pw, 2 * W), a = Math.atan2(2 * W, pw);
      gb.add('steel', new THREE.BoxGeometry(L, 0.14, 0.14), P(base, (xa + xb) / 2, H + 0.2, 0, 0, a, 0));
      gb.add('steel', new THREE.BoxGeometry(L, 0.14, 0.14), P(base, (xa + xb) / 2, H + 0.2, 0, 0, -a, 0));
      gb.add('steel', new THREE.BoxGeometry(0.25, 0.5, 2 * W), P(base, xa, H, 0));
      gb.add('steel', new THREE.BoxGeometry(0.2, 0.2, 2 * W - 1.2), P(base, xa, H - 1.6, 0));
    }
    for (const s of [-1, 1]) {
      const px = sOff + s * (span / 2 - pw * 0.55);
      gb.add('steel', new THREE.BoxGeometry(0.3, 1.4, 2 * W), P(base, px, H - 1.1, 0, 0, 0, -s * 0.12));
      const nm = nameBoard('NICKEL PLATE · SANDUSKY RIVER'); SMAT.nbBridge = nm;
      gb.add('nbBridge', new THREE.PlaneGeometry(4.8, 0.62), P(base, px - s * 0.2, H - 1.1, 0, 0, s * Math.PI / 2 + Math.PI / 2, 0));
    }
  }
  // piers & abutments
  for (const x of [-span, 0, span]) {
    const top = -1.3;
    const g = groundAt(c.X + Math.cos(c.yaw) * x, c.N + Math.sin(c.yaw) * x);
    const h = top - (Math.min(g, -5.6) - 1);
    gb.add('concrete', boxT(x === 0 ? 3.2 : 5, h, 8.4, 2), P(base, x, top - h / 2, 0));
    if (x !== 0) gb.add('concrete', boxT(1.2, 1.4, 10, 2), P(base, x + Math.sign(x) * 2.2, top + 0.4, 0));
  }
  // open deck ties and guard timbers on the bridge
  const r = rng(44);
  for (let x = -span - 4; x <= span + 4; x += 0.42) {
    const geo = new THREE.BoxGeometry(0.24, 0.24, 3.1); geo.translate(x, -0.3, 0);
    const v = 0.7 + r() * 0.3, col = new Float32Array(geo.attributes.position.count * 3);
    for (let i = 0; i < col.length; i += 3) { col[i] = 0.42 * v; col[i + 1] = 0.36 * v; col[i + 2] = 0.29 * v; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    gb.add('tie', geo, base.clone());
  }
  for (const z of [-1.45, 1.45]) gb.add('wood', boxT(2 * span + 8, 0.2, 0.2), P(base, 0, -0.1, z));
  // walkway & railing
  for (const z of [-2.2, 2.2]) {
    gb.add('wood', boxT(2 * span, 0.06, 0.7), P(base, 0, -0.2, z));
  }
  const vis = gb.build({ steel: MAT.bridge, concrete: SMAT.concrete, tie: MAT.tie, wood: SMAT.wood, nbBridge: SMAT.nbBridge });
  scene.add(vis);
  keep(c.X, c.N, 80);
}

/* -------- roads and grade crossings -------- */
function buildRoads(scene) {
  const roads = [];
  for (const X of WORLD.roadsX) roads.push({ dir: 'N', c: X, a: -3500, b: 8000, w: X === 600 ? 7 : 6, mat: X === 600 ? 'road' : 'gravel' });
  roads.push({ dir: 'E', c: WORLD.roadN, a: -7800, b: 7800, w: 7.4, mat: 'road' });
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
      for (const c of r.cross) { const dd = Math.abs(t - c.along); if (dd < 30) y = Math.max(y, c.y + 0.005 - 0.04 * Math.max(0, dd - 3)); }
      if (r.dir === 'E') y += 0.03;
      const hw = r.w / 2;
      const px = r.dir === 'N' ? [X - hw, X + hw] : [X, X], pn = r.dir === 'N' ? [N, N] : [N - hw, N + hw];
      for (let q = 0; q < 2; q++) { pos.push(px[q], y, -pn[q]); nor.push(0, 1, 0); uv.push(q * r.w / 5, t / 5); }
      // skirts
      for (let q = 0; q < 2; q++) { pos.push(px[q] + (r.dir === 'N' ? (q ? 1.5 : -1.5) : 0), y - 1.4, -(pn[q] + (r.dir === 'E' ? (q ? 1.5 : -1.5) : 0))); nor.push(0, 1, 0); uv.push(q * r.w / 5, t / 5); }
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
    for (const c of r.cross) {
      const gb = binAt(c.X, c.N);
      c.edge.pose(c.s, FR);
      // crossbucks on each side of the track, right-hand side of road
      for (const side of [-1, 1]) {
        const dx = r.dir === 'N' ? 0 : side * 9, dn = r.dir === 'N' ? side * 9 : 0;
        const lx = r.dir === 'N' ? (side > 0 ? -r.w / 2 - 1.2 : r.w / 2 + 1.2) : 0, ln = r.dir === 'E' ? (side > 0 ? -r.w / 2 - 1.2 : r.w / 2 + 1.2) : 0;
        const X = c.X + dx + lx, N = c.N + dn + ln, y = groundAt(X, N);
        const face = r.dir === 'N' ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
        const cb = baseM(X, y, N, face);
        gb.add('white', boxT(0.14, 3.9, 0.14), P(cb, 0, 1.95, 0));
        gb.add('xb1', new THREE.BoxGeometry(0.03, 0.32, 2.4), P(cb, 0.08, 3.35, 0, 0.785, 0, 0));
        gb.add('xb2', new THREE.BoxGeometry(0.03, 0.32, 2.4), P(cb, 0.1, 3.35, 0, -0.785, 0, 0));
      }
      // whistle posts 1/4 mile before, both directions
      for (const dir of [-1, 1]) {
        const loc = c.edge; const ss = c.s - dir * 400;
        if (ss < 0 || ss > loc.len) continue;
        loc.pose(ss, FR2); const yaw = Math.atan2(-FR2.f.z, FR2.f.x);
        const lat = dir > 0 ? 3.4 : -3.4;
        const X = FR2.p.x + Math.sin(yaw) * lat, N = -(FR2.p.z + Math.cos(yaw) * lat), y = groundAt(X, N);
        const wb = baseM(X, y, N, yaw + (dir > 0 ? 0 : Math.PI));
        const g2 = binAt(X, N);
        g2.add('white', boxT(0.12, 2.2, 0.12), P(wb, 0, 1.1, 0));
        g2.add('wpost', new THREE.BoxGeometry(0.04, 0.75, 0.5), P(wb, -0.08, 2.2, 0, 0, 0, 0));
      }
    }
    // planks proper: for each crossing build oriented along track
    for (const c of r.cross) {
      c.edge.pose(c.s, FR);
      const gb = binAt(c.X, c.N);
      const halfW = r.w / 2 / Math.max(0.3, Math.abs(r.dir === 'N' ? FR.f.x : FR.f.z)) + 0.8;
      for (const z of [[-0.66, 0.66], [-1.5, -0.84], [0.84, 1.5]]) {
        const m = frameMatrix(FR, new THREE.Matrix4()).multiply(M(0, -0.07, (z[0] + z[1]) / 2));
        gb.add('wood', boxT(halfW * 2, 0.14, z[1] - z[0]), m);
      }
    }
  }
  SMAT.xb1 = SMAT.crossbuck; SMAT.xb2 = SMAT.crossbuck2;
}

/* -------- pole line along the main -------- */
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
  const wireY = [[8.82, -1.1], [8.82, -0.75], [8.82, 0.75], [8.82, 1.1], [8.02, -0.85], [8.02, 0.85]];
  let group = [], groupWires = [];
  const flush = () => {
    if (!group.length) return;
    const im = new THREE.InstancedMesh(pole.clone(), pmat, group.length);
    const sph = new THREE.Sphere(); const pts = group.map(g => g.p);
    sph.setFromPoints(pts); sph.radius += 12;
    group.forEach((g, i) => im.setMatrixAt(i, new THREE.Matrix4().makeRotationY(g.yaw).setPosition(g.p)));
    im.geometry.boundingSphere = sph; im.castShadow = false; scene.add(im);
    im.userData = { c: sph.center.clone(), r: sph.radius };
    const grpM = [im];
    if (groupWires.length) { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(groupWires, 3)); lg.computeBoundingSphere(); const ls = new THREE.LineSegments(lg, wireMat); ls.userData = im.userData; scene.add(ls); grpM.push(ls); }
    (WORLD.poleGroups || (WORLD.poleGroups = [])).push(grpM);
    group = []; groupWires = [];
  };
  let prev = null;
  for (let s = 20; s < main.len; s += 48) {
    const pl = linePlace(main, s, -14.5);
    if (kept(pl.X, pl.N, 2) || riverDist(pl.X, pl.N) < 32) { prev = null; continue; }
    const y = groundAt(pl.X, pl.N) - 0.3;
    const p = new THREE.Vector3(pl.X, y, -pl.N);
    const cur = { p, yaw: pl.yaw };
    group.push(cur);
    if (prev) {
      for (const [wy, wz] of wireY) {
        const a = prev.p.clone().add(new THREE.Vector3(Math.sin(prev.yaw) * wz, wy + 0.1, Math.cos(prev.yaw) * wz));
        const b = cur.p.clone().add(new THREE.Vector3(Math.sin(cur.yaw) * wz, wy + 0.1, Math.cos(cur.yaw) * wz));
        const nseg = 8;
        for (let i = 0; i < nseg; i++) {
          const t0 = i / nseg, t1 = (i + 1) / nseg, sag0 = 0.55 * 4 * t0 * (1 - t0), sag1 = 0.55 * 4 * t1 * (1 - t1);
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
    const lat = sg.dir > 0 ? 3.3 : -3.3;
    const pl = linePlace(sg.line, sg.sLine, lat);
    const y = pl.y - 0.3;
    const yaw = pl.yaw + (sg.dir > 0 ? Math.PI : 0); // heads face oncoming train
    const base = baseM(pl.X, y, pl.N, yaw);
    const gb = binAt(pl.X, pl.N);
    gb.add('concrete', boxT(0.9, 0.5, 0.9), P(base, 0, 0.1, 0));
    gb.add('steel', new THREE.CylinderGeometry(0.09, 0.11, 7.2, 8), P(base, 0, 3.8, 0));
    gb.add('steel', new THREE.BoxGeometry(0.05, 0.05, 0.6), P(base, 0.0, 5.0, -0.3));
    for (let r = 0; r < 6; r++) gb.add('steel', new THREE.BoxGeometry(0.03, 0.03, 0.5), P(base, -0.18, 0.6 + r * 0.9, 0));
    const heads = [];
    for (const hy of [6.4, 4.4]) {
      gb.add('signBack', new THREE.CylinderGeometry(0.42, 0.42, 0.08, 20), P(base, 0.14, hy, 0, 0, 0, Math.PI / 2));
      gb.add('steel', new THREE.BoxGeometry(0.34, 0.5, 0.5), P(base, -0.05, hy, 0));
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.13, 16), SMAT.lampOff);
      lens.matrixAutoUpdate = false; lens.matrix.copy(P(base, 0.19, hy, 0, 0, Math.PI / 2, 0)); scene.add(lens);
      gb.add('black', new THREE.CylinderGeometry(0.18, 0.18, 0.28, 12, 1, true, 0, Math.PI), P(base, 0.3, hy + 0.02, 0, 0, 0, Math.PI / 2).multiply(M(0, 0, 0, 0, Math.PI / 2, 0)));
      heads.push(lens);
    }
    SCN.signals.push({ sg, heads, X: pl.X, N: pl.N });
  }
}
function updateSignals() {
  for (const s of SCN.signals) {
    const rev = s.sg.sw.state === 1;
    s.heads[0].material = rev ? SMAT.lampR : SMAT.lampG;
    s.heads[1].material = rev ? SMAT.lampG : SMAT.lampR;
    s.aspect = rev ? 'Diverging Clear' : 'Clear';
  }
}
function buildSigns() {
  for (const mp of ROUTE.mileposts) {
    const pl = linePlace(mp.line, mp.sLine, -3.6);
    const y = groundAt(pl.X, pl.N);
    const base = baseM(pl.X, y, pl.N, pl.yaw + Math.PI / 2);
    const gb = binAt(pl.X, pl.N);
    const k = 'mp' + mp.num; SMAT[k] = numberPlate(mp.num);
    gb.add('white', boxT(0.22, 1.6, 0.22), P(base, 0, 0.8, 0));
    gb.add(k, new THREE.BoxGeometry(0.24, 0.75, 0.24), P(base, 0, 1.1, 0));
  }
  // yard limit boards
  for (const [s, d] of [[300, 1], [1980, -1]]) {
    const pl = linePlace(ROUTE.main, s, d > 0 ? 3.6 : -3.6);
    const y = groundAt(pl.X, pl.N);
    const base = baseM(pl.X, y, pl.N, pl.yaw + (d > 0 ? Math.PI : 0));
    const gb = binAt(pl.X, pl.N);
    gb.add('white', boxT(0.12, 2.4, 0.12), P(base, 0, 1.2, 0));
    gb.add('yardLimit', new THREE.BoxGeometry(0.04, 0.8, 1.3), P(base, 0.08, 2.4, 0));
  }
}

/* -------- stations & facilities -------- */
function buildStations() {
  for (const st of ROUTE.stations) {
    if (st.kind === 'quarry') continue;
    const pl = linePlace(st.line, st.sLine, st.side * 12); pl.lat = st.side;
    depot(pl, st.name.toUpperCase(), st.kind === 'depot');
  }
  for (const w of ROUTE.water) {
    if (w.kind === 'column') { const pl = linePlace(w.line, w.sLine, w.side * 3.1); pl.lat = w.side; waterColumn(pl); w.place = pl; }
    else { const pl = linePlace(w.line, w.sLine, w.side * 7.5); pl.lat = w.side; waterTower(pl); w.place = pl;
      // spout reaches over the track: modelled in waterTower toward -z of base (which faces track)
    }
  }
  const eng = ROUTE.features.engine;
  coalingTower(linePlace(eng, ROUTE.coal.sLine, 0));
  sandHouse(linePlace(eng, 300, 0));
  engineHouse(linePlace(eng, eng.len - 24, 0));
  const yo = linePlace(ROUTE.main, 470, -10); yardOffice(yo);
  const fe = ROUTE.lines['Elevator Track'];
  const ge = linePlace(fe, 190, -24); ge.lat = -1; grainElevator(ge);
  // Quarry Jct tower
  const sw = NET.switches.find(s => s.name === 'Quarry Jct');
  const lineMain = ROUTE.main;
  let sJ = 0; for (const e of lineMain.edges) if (e.a === sw.node) sJ = e.lineS0;
  const tp = linePlace(lineMain, sJ - 60, -11); tp.lat = -1; interlockingTower(tp, 'QJ');
  quarry();
}
function quarry() {
  const br = ROUTE.branch;
  const end = linePlace(br, br.len - 70, 0);
  const base = baseM(end.X, end.y - 0.3, end.N, end.yaw);
  const gb = binAt(end.X, end.N);
  // loading tipple over the branch end
  for (const x of [-6, 6]) for (const z of [-3.6, 3.6]) gb.add('steel', new THREE.BoxGeometry(0.45, 11, 0.45), P(base, x, 5.5, z));
  gb.add('rust', boxT(14, 6, 8.4, 2), P(base, 0, 14, 0));
  gb.add('steel', new THREE.BoxGeometry(10, 2.4, 6), P(base, 0, 10, 0));
  for (const x of [-3, 0, 3]) gb.add('steel', new THREE.CylinderGeometry(0.4, 0.9, 2, 8), P(base, x, 7.8, 0));
  gb.add('steel', new THREE.BoxGeometry(2, 1.6, 46), P(base, 0, 9, -26, 0.32, 0, 0));
  gb.add('rust', boxT(16, 18, 14, 3), P(base, 0, 9, -52));
  gb.add('tin', gableRoof(16, 14, 3), P(base, 0, 18, -52));
  windowsRow(gb, base, -5, 5, 12, -45, 1, 1.4, 4);
  // stone piles
  const r = rng(77);
  for (let i = 0; i < 6; i++) {
    const h = 6 + r() * 8; const x = -40 + r() * 80, z = -70 - r() * 60;
    const X = end.X + Math.cos(end.yaw) * x + Math.sin(end.yaw) * z, N = end.N + Math.sin(end.yaw) * x - Math.cos(end.yaw) * z;
    const y = groundAt(X, N);
    binAt(X, N).add('stone', new THREE.ConeGeometry(h * 1.7, h, 18), baseM(X, y + h / 2 - 0.5, N, 0));
  }
  // quarry pit rim (stepped benches)
  for (let k = 0; k < 3; k++) {
    const X = end.X + 160, N = end.N + 60;
    gb.add('stone', new THREE.CylinderGeometry(120 - k * 30, 126 - k * 30, 1.5, 32, 1, true), baseM(X, groundAt(X, N) - k * 5, N, 0));
  }
  keep(end.X, end.N, 70);
}

/* -------- trees -------- */
function treeGeos() {
  const colorize = (g, c) => { const a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const trunk = c => colorize(new THREE.CylinderGeometry(0.16, 0.28, 4.5, 5, 1, true).translate(0, 2.25, 0), c);
  const dec = mergeGeos([trunk([0.33, 0.27, 0.22]),
    colorize(new THREE.IcosahedronGeometry(3.4, 0).scale(1, 0.95, 1).translate(0, 6.4, 0), [1, 1, 1]),
    colorize(new THREE.IcosahedronGeometry(2.6, 0).translate(1.4, 5.0, 0.8), [0.92, 0.92, 0.92]),
    colorize(new THREE.IcosahedronGeometry(2.3, 0).translate(-1.3, 5.3, -0.9), [0.85, 0.85, 0.85])]);
  const con = mergeGeos([trunk([0.3, 0.24, 0.2]),
    colorize(new THREE.ConeGeometry(2.6, 5.5, 7, 1, true).translate(0, 4.6, 0), [1, 1, 1]),
    colorize(new THREE.ConeGeometry(1.9, 4.2, 7, 1, true).translate(0, 7.4, 0), [0.92, 0.92, 0.92])]);
  const decLo = mergeGeos([colorize(new THREE.OctahedronGeometry(3.6, 0).scale(1.05, 1.15, 1.05).translate(0, 5.8, 0), [0.95, 0.95, 0.95])]);
  const conLo = mergeGeos([colorize(new THREE.ConeGeometry(2.5, 9.5, 5, 1, true).translate(0, 5.6, 0), [0.95, 0.95, 0.95])]);
  return { dec, con, decLo, conLo };
}
function buildTrees(scene) {
  const G = treeGeos();
  const tiles = new Map();
  const put = (X, N, type, s, c) => {
    const k = Math.floor((X + 20000) / 1500) + ',' + Math.floor((N + 20000) / 1500);
    if (!tiles.has(k)) tiles.set(k, { dec: [], con: [] });
    tiles.get(k)[type].push([X, N, s, c]);
  };
  const ok = (X, N, pad) => {
    const lat = latticeAt(X, N); if (lat && lat.d < 24 + pad) return false;
    for (const rx of WORLD.roadsX) if (Math.abs(X - rx) < 11) return false;
    if (Math.abs(N - WORLD.roadN) < 12) return false;
    if (riverDist(X, N) < 30) return false;
    if (kept(X, N)) return false;
    if (X < INNER.x0 + 20 || X > INNER.x1 - 20 || N < INNER.n0 + 20 || N > INNER.n1 - 20) return false;
    return true;
  };
  const autumn = (r) => { const x = r(); if (x < 0.55) return [0.28 + r() * 0.1, 0.42 + r() * 0.12, 0.17 + r() * 0.06]; if (x < 0.8) return [0.72 + r() * 0.15, 0.55 + r() * 0.15, 0.16]; if (x < 0.93) return [0.7 + r() * 0.1, 0.27 + r() * 0.1, 0.12]; return [0.55, 0.4, 0.2]; };
  const r = rng(2024);
  // woodlots
  for (let i = Math.floor((INNER.x0 + 40000) / FIELD.w); i <= Math.floor((INNER.x1 + 40000) / FIELD.w); i++)
    for (let j = Math.floor((INNER.n0 + 40000) / FIELD.h); j <= Math.floor((INNER.n1 + 40000) / FIELD.h); j++) {
      const X0 = i * FIELD.w - 40000, N0 = j * FIELD.h - 40000;
      const f = fieldAt(X0 + 1, N0 + 1);
      if (f.t.n === 'woods') {
        for (let x = 0.18; x < 0.82; x += 19 / FIELD.w) for (let y = 0.2; y < 0.78; y += 19 / FIELD.h) {
          const X = X0 + (x + (r() - 0.5) * 0.03) * FIELD.w, N = N0 + (y + (r() - 0.5) * 0.05) * FIELD.h;
          if (!ok(X, N, 0)) continue;
          if (r() < 0.22) put(X, N, 'dec', -(0.9 + r() * 0.5), [0.16 + r() * 0.05, 0.27 + r() * 0.06, 0.15]);
          else put(X, N, 'dec', 0.85 + r() * 0.6, autumn(r));
        }
      }
      // fence-row trees along some field edges
      if (Noise.hash(i * 3 + 1, j * 7 + 2) < 0.22) {
        for (let x = 0; x < FIELD.w; x += 18 + r() * 30) { const X = X0 + x, N = N0 + (r() - 0.5) * 3; if (ok(X, N, 6) && r() < 0.6) put(X, N, 'dec', 0.8 + r() * 0.5, autumn(r)); }
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
    if (r() < 0.6) put(X, N, 'dec', (r() < 0.4 ? -1 : 1) * (1 + r() * 0.5), autumn(r));
  }
  for (const t of SCN.extraTrees || []) put(t[0], t[1], 'dec', t[2], t[3] || autumn(r));
  let total = 0;
  WORLD.treeTiles = [];
  for (const [, t] of tiles) {
    const tt = { hi: [], lo: [], c: null, r: 0 }; const allPts = [];
    for (const type of ['dec', 'decLo']) {
      const list = t[type.replace('Lo', '')]; if (!list.length) continue;
      const im = new THREE.InstancedMesh(G[type].clone(), MAT.tree, list.length);
      const pts = [];
      list.forEach((q, i) => {
        const [X, N, s0, c] = q; const y = groundAt(X, N) - 0.3; const s = Math.abs(s0), col = s0 < 0;
        _m4.compose(_v1.set(X, y, -N), _q.setFromEuler(_e.set(0, (X * 13.1 + N) % TAU, 0)), col ? _v2.set(s * 0.55, s * 1.45, s * 0.55) : _v2.set(s, s * (0.9 + ((X * 7 + N * 3) % 1) * 0.2), s));
        im.setMatrixAt(i, _m4); im.setColorAt(i, _tc.setRGB(c[0], c[1], c[2])); pts.push(new THREE.Vector3(X, y, -N));
      });
      const sph = new THREE.Sphere().setFromPoints(pts); sph.radius += 12; im.geometry.boundingSphere = sph;
      im.castShadow = false; im.receiveShadow = false;
      scene.add(im); WORLD.treeMeshes.push(im);
      if (type.endsWith('Lo')) { tt.lo.push(im); im.visible = false; } else { tt.hi.push(im); total += list.length; allPts.push(...pts); }
    }
    if (allPts.length) { const sp = new THREE.Sphere().setFromPoints(allPts); tt.c = sp.center; tt.r = sp.radius; WORLD.treeTiles.push(tt); }
  }
  WORLD.treeCount = total;
}

function buildFarms() {
  SCN.farms = [];
  const r = rng(808);
  const cand = [];
  for (const X of WORLD.roadsX) for (let N = -1800; N < 6800; N += 520 + r() * 500) cand.push([X + (r() < 0.5 ? -1 : 1) * (28 + r() * 10), N, X]);
  for (let X = -5600; X < 5600; X += 600 + r() * 500) cand.push([X, WORLD.roadN - 30 - r() * 10, null]);
  for (const [X, N, rx] of cand) {
    const lat = latticeAt(X, N); if (lat && lat.d < 90) continue;
    if (riverDist(X, N) < 120 || kept(X, N, 30)) continue;
    const f = fieldAt(X, N); if (f.t.n === 'woods') continue;
    const yaw = rx !== null ? (X < rx ? 0 : Math.PI) + Math.PI / 2 * 0 : Math.PI / 2;
    SCN.farms.push(farmstead(X, N, rx !== null ? (X < rx ? -Math.PI / 2 : Math.PI / 2) : 0, r));
  }
}

function finalizeScenery(scene) {
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

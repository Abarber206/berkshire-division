/* ============================================================================
   Ground detail & country life: standing corn, roadside grass and wildflowers,
   pasture fences, cattle, hay bales, and small towns around the depots.
   ========================================================================== */
const DET = { cornGroups: [], lifeGroups: [], grassMats: [], timeU: { value: 0 }, windK: { value: 1 } };

/* ---------- precise distance to any track (2 m samples hashed in 10 m cells) ---------- */
function buildTrackHash() {
  const H = new Map();
  for (const e of NET.edges) for (let s = 0; s <= e.len; s += 2) {
    const [X, N] = e.xz(s), k = Math.floor(X / 10) + ',' + Math.floor(N / 10);
    let a = H.get(k); if (!a) H.set(k, a = []); a.push(X, N);
  }
  WORLD.trackHash = H;
  // coarse samples for "how far is this field from the railroad"
  const C = []; for (const e of NET.edges) for (let s = 0; s <= e.len; s += 60) C.push(e.xz(s));
  WORLD.trackCoarse = C;
}
function distToTrack(X, N) {
  const H = WORLD.trackHash, ix = Math.floor(X / 10), iy = Math.floor(N / 10); let d = 99;
  for (let j = iy - 1; j <= iy + 1; j++) for (let i = ix - 1; i <= ix + 1; i++) {
    const a = H.get(i + ',' + j); if (!a) continue;
    for (let q = 0; q < a.length; q += 2) { const dd = Math.hypot(a[q] - X, a[q + 1] - N); if (dd < d) d = dd; }
  }
  return d;
}
/* is any track centre within r metres (any r; distToTrack only sees about 10 m) */
function trackWithin(X, N, r) {
  const H = WORLD.trackHash, ix = Math.floor(X / 10), iy = Math.floor(N / 10), c = Math.ceil(r / 10);
  for (let j = iy - c; j <= iy + c; j++) for (let i = ix - c; i <= ix + c; i++) {
    const a = H.get(i + ',' + j); if (!a) continue;
    for (let q = 0; q < a.length; q += 2) if (Math.hypot(a[q] - X, a[q + 1] - N) < r) return true;
  }
  return false;
}
function farFromTrack(X, N) { let d = 1e9; for (const p of WORLD.trackCoarse) { const dd = (p[0] - X) ** 2 + (p[1] - N) ** 2; if (dd < d) d = dd; } return Math.sqrt(d); }
const onRoad = (X, N, pad) => { for (const rx of WORLD.roadsX) if (Math.abs(X - rx) < pad) return true; return Math.abs(N - WORLD.roadN) < pad; };

/* ---------- textures ---------- */
function detailTextures() {
  const blades = (g, w, h, r, n, cols, hMin) => {
    for (let i = 0; i < n; i++) {
      const x0 = w * (0.1 + 0.8 * r()), lean = (r() - 0.5) * w * 0.45, top = h * (1 - (hMin + (1 - hMin) * r()));
      g.strokeStyle = cols[(r() * cols.length) | 0]; g.lineWidth = 1.5 + r() * 2.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x0, h); g.quadraticCurveTo(x0 + lean * 0.2, (h + top) / 2, x0 + lean, top); g.stroke();
    }
  };
  TEX.grass = grassTexture();
  TEX.goldenrod = canvasTex(128, 128, (g, w, h) => {
    const r = rng(22); blades(g, w, h, r, 26, ['#56603a', '#4a5432', '#66663f'], 0.45);   // olive stems, not spring green
    for (let k = 0; k < 7; k++) { const cx = w * (0.15 + 0.7 * r()), cy = h * (0.08 + 0.3 * r()); for (let i = 0; i < 40; i++) { g.fillStyle = r() < 0.5 ? '#f0c63a' : '#d9a92a'; g.beginPath(); g.arc(cx + (r() - 0.5) * 22 + (i / 40) * 10, cy + (r() - 0.2) * 16 + i * 0.5, 1.6 + r() * 1.8, 0, TAU); g.fill(); } }
  });
  // bracken and wood fern, arching fronds from the crown; the instance colour gives green or autumn rust
  TEX.fern = canvasTex(128, 128, (g, w, h) => {
    const r = rng(24);
    for (let f = 0; f < 9; f++) {
      const a = -Math.PI / 2 + (f / 8 - 0.5) * 2.4 + (r() - 0.5) * 0.2, L = 52 + r() * 22, bend = (f / 8 - 0.5) * 0.9;
      let x = w / 2, y = h - 2, ang = a;
      for (let k = 0; k < 18; k++) {
        const nx = x + Math.cos(ang) * L / 18, ny = y + Math.sin(ang) * L / 18; ang += bend * 0.06;
        g.strokeStyle = '#c9d0b8'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
        const pl = (1 - k / 18) * 11 + 2;
        for (const sd of [-1, 1]) { const pa = ang + sd * 1.25; const v = 200 + r() * 55 | 0; g.strokeStyle = `rgb(${v},${v},${v * 0.92 | 0})`; g.lineWidth = 2.2; g.beginPath(); g.moveTo(nx, ny); g.lineTo(nx + Math.cos(pa) * pl, ny + Math.sin(pa) * pl); g.stroke(); }
        x = nx; y = ny;
      }
    }
  });
  TEX.aster = canvasTex(128, 128, (g, w, h) => {
    const r = rng(23); blades(g, w, h, r, 30, ['#535e39', '#475232', '#62643e'], 0.4);
    for (let i = 0; i < 46; i++) { const x = w * (0.1 + 0.8 * r()), y = h * (0.1 + 0.45 * r()); g.fillStyle = r() < 0.7 ? '#a48ad8' : '#eeeaf6'; g.beginPath(); g.arc(x, y, 2.4 + r() * 1.6, 0, TAU); g.fill(); g.fillStyle = '#e8c33a'; g.beginPath(); g.arc(x, y, 0.9, 0, TAU); g.fill(); }
  });
  TEX.cornWall = canvasTex(256, 128, (g, w, h) => {
    const r = rng(31);
    const grd = g.createLinearGradient(0, h * 0.25, 0, h); grd.addColorStop(0, '#8a7445'); grd.addColorStop(0.6, '#5f4f2f'); grd.addColorStop(1, '#3d3220');
    g.fillStyle = grd; g.fillRect(0, h * 0.3, w, h * 0.7);
    for (let i = 0; i < 120; i++) { // stalks
      const x = r() * w, top = h * (0.06 + 0.22 * r());
      g.strokeStyle = r() < 0.5 ? '#b49a5e' : '#9c8550'; g.lineWidth = 1.5 + r() * 1.5;
      g.beginPath(); g.moveTo(x, h); g.lineTo(x + (r() - 0.5) * 4, top); g.stroke();
      for (let l = 0; l < 3; l++) { const ly = top + (h - top) * (0.15 + 0.5 * r()), dir = r() < 0.5 ? -1 : 1; g.strokeStyle = r() < 0.5 ? '#c8ad6c' : '#a48b52'; g.lineWidth = 2 + r() * 2; g.beginPath(); g.moveTo(x, ly); g.quadraticCurveTo(x + dir * 10, ly - 6, x + dir * (14 + r() * 10), ly + 10 + r() * 8); g.stroke(); }
      if (r() < 0.7) { g.strokeStyle = '#d8bf7c'; g.lineWidth = 1; for (let t = 0; t < 4; t++) { g.beginPath(); g.moveTo(x, top); g.lineTo(x + (r() - 0.5) * 10, top - 4 - r() * 6); g.stroke(); } }
    }
  }, { repeat: true });
  TEX.cornTop = canvasTex(128, 128, (g, w, h) => {
    const r = rng(32); g.fillStyle = '#6d5b36'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 520; i++) { const x = r() * w, y = r() * h, a = r() * TAU, L = 4 + r() * 12; g.strokeStyle = ['#b49a5e', '#c9b072', '#8f7a48', '#a99057'][(r() * 4) | 0]; g.lineWidth = 1.5 + r() * 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
    for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(30,24,12,0.5)'; g.beginPath(); g.arc(r() * w, r() * h, 2 + r() * 3, 0, TAU); g.fill(); }
  }, { repeat: true });
  TEX.hay = canvasTex(64, 64, (g, w, h) => { const r = rng(33); g.fillStyle = '#b89a55'; g.fillRect(0, 0, w, h); for (let i = 0; i < 220; i++) { g.strokeStyle = r() < 0.5 ? '#d6bd78' : '#8f7640'; g.lineWidth = 1; const y = r() * h; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + (r() - 0.5) * 6); g.stroke(); } }, { repeat: true });
  const roofT = canvasTex(64, 64, (g, w, h) => { const r = rng(34); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 8) for (let x = ((y / 8) % 2) * 6 - 6; x < w; x += 12) { const v = 170 + r() * 80 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 11, 7); } }, { repeat: true });
  const sideT = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 8) { g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(0, y + 6, w, 2); } }, { repeat: true });
  const brickT = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#b8b0a8'; g.fillRect(0, 0, w, h); const r = rng(35); for (let y = 0; y < h; y += 8) for (let x = ((y / 8) % 2) * 8 - 8; x < w; x += 16) { const v = 0.82 + r() * 0.3; g.fillStyle = `rgb(${255 * v | 0},${255 * v | 0},${255 * v | 0})`; g.fillRect(x + 1, y + 1, 14, 6); } }, { repeat: true });
  SMAT.sidingVC = new THREE.MeshLambertMaterial({ vertexColors: true, map: sideT });
  SMAT.roofVC = new THREE.MeshLambertMaterial({ vertexColors: true, map: roofT });
  SMAT.brickVC = new THREE.MeshLambertMaterial({ vertexColors: true, map: brickT });
  SMAT.vc = new THREE.MeshLambertMaterial({ vertexColors: true });
  SMAT.awning = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  SMAT.cornTop = new THREE.MeshLambertMaterial({ map: TEX.cornTop });
  SMAT.cornWall = new THREE.MeshLambertMaterial({ map: TEX.cornWall, alphaTest: 0.5, side: THREE.DoubleSide });
  SMAT.hay = new THREE.MeshLambertMaterial({ map: TEX.hay, vertexColors: true });
  SMAT.post = new THREE.MeshLambertMaterial({ color: 0x6a5a48, map: TEX.wood });
  for (const k of ['grass', 'goldenrod', 'aster', 'fern']) {
    // grass is one-sided cards drawn from both sides (both lit as the front); alpha to coverage keeps the thin
    // blades from shimmering or thinning out to nothing as they go back into the distance
    const grass = k === 'grass';
    const m = new THREE.MeshLambertMaterial({ map: TEX[k], alphaTest: grass ? 0.3 : 0.5, side: grass ? THREE.DoubleSide : THREE.FrontSide });
    if (grass) m.alphaToCoverage = true;
    const amp = grass ? 1 : k === 'fern' ? 0.45 : 0.6;
    m.onBeforeCompile = sh => grassWind(sh, amp, grass); m.customProgramCacheKey = () => 'wind' + amp + grass;
    fadeByDistance(m, grass || k === 'fern' ? LOD.grass : LOD.flowers, true);
    SMAT['g_' + k] = m; DET.grassMats.push(m);
  }
}
/* Meadow grass, 256 x 256: tapered blades that are dark down in the clump and light at the tips (so a clump
   is shaded like the real thing, and sits down into the ground), a back layer darker than the front, some
   tips gone to straw, and a few timothy and foxtail seed heads standing above. Light greys: the instance
   colour gives green, gold or straw. */
function grassTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    const r = rng(21);
    const blade = (x0, top, lean, bw, c0, c1) => {
      const tx = x0 + lean, mx = x0 + lean * 0.3, my = (h + top) / 2;
      const grd = g.createLinearGradient(0, h, 0, top); grd.addColorStop(0, c0); grd.addColorStop(0.3, c0); grd.addColorStop(1, c1);
      g.fillStyle = grd; g.beginPath();
      g.moveTo(x0 - bw / 2, h + 1); g.quadraticCurveTo(mx - bw * 0.3, my, tx, top); g.quadraticCurveTo(mx + bw * 0.3, my, x0 + bw / 2, h + 1); g.closePath(); g.fill();
    };
    const grey = (v, warm = 0) => `rgb(${Math.min(255, v + warm) | 0},${Math.min(255, v + 6) | 0},${Math.max(0, v * 0.86 - warm) | 0})`;
    for (let layer = 0; layer < 3; layer++) {
      const n = [55, 60, 45][layer];
      for (let i = 0; i < n; i++) {
        const c = 0.5 + (r() - 0.5) * (layer === 2 ? 0.75 : 0.9) * (0.6 + 0.4 * r());
        const x0 = w * c, top = h * (1 - (layer === 0 ? 0.55 + 0.42 * r() : layer === 1 ? 0.4 + 0.5 * r() : 0.2 + 0.45 * r()));
        const lean = (x0 - w / 2) * (0.35 + 0.5 * r()) + (r() - 0.5) * w * 0.18;
        const lo = [52, 72, 92][layer] + r() * 18, hi = [150, 195, 230][layer] + r() * 25;
        const dryTip = r() < 0.22;
        blade(x0, top, lean, 3.5 + r() * 4.5, grey(lo), dryTip ? grey(hi + 10, 22) : grey(hi));
      }
    }
    // seed heads: a thin stem, then a slender spike of florets, a little browner than the leaves
    for (let i = 0; i < 4; i++) {
      const x0 = w * (0.3 + 0.4 * r()), top = h * (0.02 + 0.12 * r()), lean = (r() - 0.5) * w * 0.25, L = 12 + r() * 12;
      g.strokeStyle = grey(140, 8); g.lineWidth = 1.3; g.beginPath(); g.moveTo(x0, h); g.quadraticCurveTo(x0 + lean * 0.2, (h + top) / 2, x0 + lean, top + L); g.stroke();
      for (let k = 0; k < 14; k++) {
        const t = k / 13, px = x0 + lean, py = top + L * (1 - t);
        g.fillStyle = grey(150 + r() * 40, 30); g.beginPath(); g.ellipse(px + (r() - 0.5) * 1.6, py, 1.7 - t * 0.6, 2.2, 0, 0, TAU); g.fill();
      }
    }
  });
}
/* One meadow clump: four cards round the centre, each in three rows so the wind can bend it into a curve, leaning
   out a little and spreading wider at the top. Normals point up, so the clump is lit like the ground it grows from. */
function grassClumpGeo(w = 1.0, h = 0.8) {
  const pos = [], uv = [], nor = [], idx = [], r = rng(57), segs = 3, n = 4;
  for (let k = 0; k < n; k++) {
    const a = k * Math.PI / n + (r() - 0.5) * 0.35, ax = Math.cos(a), az = Math.sin(a), nx = -az, nz = ax;
    const ox = (r() - 0.5) * 0.14, oz = (r() - 0.5) * 0.14, lean = (k % 2 ? 1 : -1) * h * (0.1 + 0.1 * r()), cw = w * (0.85 + 0.25 * r());
    const b = pos.length / 3;
    for (let j = 0; j <= segs; j++) {
      const t = j / segs, y = h * t * (1 - 0.06 * t * t), d = lean * t * t, sp = 1 + 0.18 * t;
      for (let i = 0; i < 2; i++) {
        const u = (i - 0.5) * cw * sp;
        pos.push(ox + ax * u + nx * d, y, oz + az * u + nz * d); uv.push(i, t); nor.push(0, 1, 0);
      }
    }
    for (let j = 0; j < segs; j++) { const q = b + j * 2; idx.push(q, q + 1, q + 3, q, q + 3, q + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeBoundingSphere();
  return g;
}
/* Wind through the grass: slow gusts that roll across the field as a wave (so neighbouring clumps move together,
   not each on its own beat), a quicker flutter on top, and the bend growing with the square of the height so the
   roots stay put. Stronger under an overcast sky. With grass set, both faces of a card are lit as the front. */
function grassWind(sh, amp, grass) {
  sh.uniforms.uTime = DET.timeU; sh.uniforms.uWindK = DET.windK;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWindK;')
    .replace('#include <project_vertex>', `vec4 mvPosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
        {
          vec2 wp = instanceMatrix[3].xz, wd = vec2(0.8, 0.6);
          float hg = max(position.y, 0.0), bend = hg * hg * ${amp.toFixed(2)} * uWindK;
          float wave = sin(dot(wp, wd) * 0.07 - uTime * 1.5) + 0.5 * sin(dot(wp, vec2(-0.3, 0.95)) * 0.19 - uTime * 2.6);
          float gust = 0.5 + 0.4 * wave;
          float flut = sin(uTime * 6.3 + wp.x * 2.3 + wp.y * 1.7 + position.x * 5.0 + position.z * 4.0);
          vec2 off = wd * (0.18 + 0.3 * gust) * bend + vec2(-wd.y, wd.x) * flut * 0.07 * bend;
          mvPosition.xz += off; mvPosition.y -= 0.5 * dot(off, off) / max(hg, 0.1);
        }
      #endif
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;`);
  if (grass) sh.fragmentShader = sh.fragmentShader
    .replace('( gl_FrontFacing ) ? vLightFront : vLightBack', 'vLightFront')
    .replace('( gl_FrontFacing ) ? vIndirectFront : vIndirectBack', 'vIndirectFront');
}
/* How dry the grass is here, from the same broad drifts the ground shader paints (TEX.detail blue channel), so a
   clump's colour matches the turf it stands in: 0 lush, 1 parched. */
function grassDryAt(X, N) {
  let D = DET.detailB;
  if (!D) {
    const img = TEX.detail && TEX.detail.image; if (!img || !img.getContext) return 0.5;
    const d = img.getContext('2d').getImageData(0, 0, img.width, img.height).data, B = new Uint8Array(img.width * img.height);
    for (let i = 0; i < B.length; i++) B[i] = d[i * 4 + 2];
    D = DET.detailB = { B, w: img.width, h: img.height };
  }
  const at = (u, v) => { const x = ((Math.floor(u * D.w) % D.w) + D.w) % D.w, y = ((Math.floor((1 - v) * D.h) % D.h) + D.h) % D.h; return D.B[y * D.w + x] / 255; };
  const x = X, z = -N;
  const b1 = at(x * 0.0011 + 0.13, z * 0.0011 + 0.13), b2 = at(x * 0.0047 - 0.31, z * 0.0047 - 0.31);
  return smooth(0.38, 0.66, b1 * 0.65 + b2 * 0.35);
}
/* flowers keep their own colours, a little dulled and each plant a shade different, so they sit in the grass
   instead of glowing on top of it */
const flowerTint = r => { const b = 0.74 + r() * 0.16; return [b, b * 0.97, b * 0.88]; };
/* the colour of a meadow clump: lush green, summer green or straw, by the drifts, with each clump a little its own */
function grassColor(X, N, r, dryBias = 0) {
  // the mountain is in autumn: its meadows have mostly gone over to tawny and straw
  const d = clamp(grassDryAt(X, N) * 0.8 + dryBias + (WORLD.mtn ? 0.3 : 0) + (r() - 0.5) * 0.45, 0, 1);
  const lush = [0.34, 0.50, 0.20], summer = [0.50, 0.58, 0.29], straw = [0.74, 0.65, 0.42];
  const c = d < 0.5 ? lush.map((v, i) => lerp(v, summer[i], d * 2)) : summer.map((v, i) => lerp(v, straw[i], (d - 0.5) * 2));
  const b = 0.88 + r() * 0.24;
  return c.map(v => Math.min(1, v * b));
}
const colorize = (g, c) => { const a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

/* ---------- towns around the depots ---------- */
function planTowns() {
  WORLD.towns = [];
  for (const st of ROUTE.stations) {
    if (st.kind !== 'depot' && st.kind !== 'small') continue;
    const loc = st.line.locate(st.sLine); loc.edge.pose(loc.s, FR);
    const h = Math.atan2(-FR.f.z, FR.f.x);
    const T = { name: st.name, X: FR.p.x, N: -FR.p.z, h, side: st.side, big: st.kind === 'depot', lots: [], streets: [] };
    T.at = (u, v) => [T.X + Math.cos(h) * u + Math.sin(h) * T.side * v, T.N + Math.sin(h) * u - Math.cos(h) * T.side * v];
    WORLD.towns.push(T);
    const U = T.big ? 300 : 180, V = T.big ? 215 : 150;
    T.U = U; T.V = V;
    // where the county road already runs alongside the depot, it serves as Main Street
    const [, mn] = T.at(0, 44), countyMain = Math.abs(Math.sin(h)) < 0.1 && Math.abs(mn - WORLD.roadN) < 40;
    const mainV = countyMain ? Math.abs(WORLD.roadN - T.N) : 44;
    if (!countyMain) T.streets.push([[-U, 44], [U, 44], 9]);
    for (const v of (T.big ? [112, 182] : [112])) T.streets.push([[-U + 20, v], [U - 20, v], 7]);
    for (const u of (T.big ? [-200, -100, 0, 100, 200] : [-100, 0, 100])) T.streets.push([[u, mainV], [u, V], 7]);
    const r = rng(st.name.length * 97 + 13);
    const ok = (u, v, rad) => { const [X, N] = T.at(u, v); const lat = latticeAt(X, N); if (lat && lat.d < 26 + rad) return false; if (riverDist(X, N) < 55 + rad) return false; if (onRoad(X, N, 8 + rad)) return false; if (kept(X, N, rad)) return false; return X > INNER.x0 + 60 && X < INNER.x1 - 60 && N > INNER.n0 + 60 && N < INNER.n1 - 60; };
    // commercial block facing the depot
    const cross = T.streets.filter(s => s[0][0] === s[1][0]).map(s => s[0][0]);
    const nearCross = (u, half) => cross.some(c => Math.abs(u - c) < half + 6);
    for (let u = -130; u < 130;) {
      const w = 10 + r() * 8;
      if (!nearCross(u + w / 2, w / 2) && ok(u + w / 2, mainV + 17, 6)) T.lots.push({ kind: 'shop', u: u + w / 2, v: mainV + 17, w, d: 16, stories: r() < 0.55 ? 2 : 3, r: r() });
      u += w + (r() < 0.2 ? 4 : 0.4);
    }
    // houses along the residential streets
    for (const sv of T.streets.filter(s => s[0][1] === s[1][1] && s[0][1] > 100)) {
      const v0 = sv[0][1];
      for (const dv of [-15, 15]) for (let u = -U + 34; u < U - 34; u += 21 + r() * 4) {
        if (nearCross(u, 6) || r() < 0.12) continue;
        if (!ok(u, v0 + dv, 8)) continue;
        T.lots.push({ kind: 'house', u, v: v0 + dv, face: dv < 0 ? 1 : -1, w: 8 + r() * 2.5, d: 7 + r() * 2, stories: r() < 0.6 ? 2 : 1, r: r() });
      }
    }
    if (T.big) {
      if (ok(-150, 150, 18)) T.lots.push({ kind: 'church', u: -150, v: 147, r: r() });
      if (ok(150, V + 18, 10)) T.lots.push({ kind: 'tower', u: 150, v: V + 18, r: r() });
    }
    for (const L of T.lots) { const [X, N] = T.at(L.u, L.v); L.X = X; L.N = N; keep(X, N, L.kind === 'church' ? 18 : L.kind === 'tower' ? 10 : 9); }
  }
  WORLD.townMask = true;
}
function inTown(X, N) {
  for (const T of WORLD.towns || []) {
    const dx = X - T.X, dn = N - T.N; if (dx * dx + dn * dn > 360 * 360) continue;
    const u = dx * Math.cos(T.h) + dn * Math.sin(T.h), v = (dx * Math.sin(T.h) - dn * Math.cos(T.h)) * T.side;
    if (Math.abs(u) < T.U + 10 && v > 36 && v < T.V + 30) return true;
  }
  return false;
}
function buildTowns(scene) {
  const SID = [0xf1eee4, 0xe9dfb8, 0xc9d3d6, 0xb7c4a6, 0xd8c3a0, 0xe8e4dc, 0xa9b9c9, 0xcfb79a];
  const ROOF = [0x55585c, 0x4a3c33, 0x3b4a40, 0x5e4a3e, 0x6b6e70];
  const BRICK = [0x9c4a35, 0x8a3f2e, 0xb0745a, 0xc9a77f, 0x7d3a2b];
  const AWN = [0x2f5a3c, 0x8e2c24, 0x2c4a6e, 0xc9a24a];
  for (const T of WORLD.towns) {
    const yaw = T.side > 0 ? T.h + Math.PI : T.h; // local +z of a building faces the track
    // streets
    const pos = [], idx = [];
    for (const [a, b, w] of T.streets) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(len / 8));
      const du = (b[0] - a[0]) / len, dv = (b[1] - a[1]) / len;
      let run = 0;
      for (let i = 0; i <= n; i++) {
        const u = lerp(a[0], b[0], i / n), v = lerp(a[1], b[1], i / n);
        const [X0, N0] = T.at(u - dv * w / 2, v + du * w / 2), [X1, N1] = T.at(u + dv * w / 2, v - du * w / 2);
        const [Xc, Nc] = T.at(u, v); const lat = latticeAt(Xc, Nc);
        if ((lat && lat.d < 12) || riverDist(Xc, Nc) < 40) { run = 0; continue; }
        const y = Math.max(groundAt(X0, N0), groundAt(X1, N1), groundAt(Xc, Nc)) + 0.1;
        const k = pos.length / 3; pos.push(X0, y, -N0, X1, y, -N1);
        if (run > 0) idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
        run++;
      }
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setIndex(idx); sg.computeVertexNormals();
    for (let i = 0; i < sg.attributes.normal.count; i++) { if (sg.attributes.normal.getY(i) < 0) { const ix = sg.index.array; for (let q = 0; q < ix.length; q += 3) { const t = ix[q + 1]; ix[q + 1] = ix[q + 2]; ix[q + 2] = t; } sg.computeVertexNormals(); } break; }
    const uvs = new Float32Array(pos.length / 3 * 2); for (let i = 0; i < pos.length / 3; i++) { uvs[i * 2] = pos[i * 3] / 6; uvs[i * 2 + 1] = pos[i * 3 + 2] / 6; } sg.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    const sm = new THREE.Mesh(sg, SMAT.road); sm.receiveShadow = true; scene.add(sm);
    // street lights: a pole every 36 m or so, on alternate sides, its arm out over the street
    for (const [a, b, w] of T.streets) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), du = (b[0] - a[0]) / len, dv = (b[1] - a[1]) / len;
      const n = Math.max(1, Math.round(len / 36));
      for (let i = 0; i <= n; i++) {
        const t = (i + 0.5) / (n + 1), u = lerp(a[0], b[0], t), v = lerp(a[1], b[1], t), side = i % 2 ? 1 : -1;
        const [Xc, Nc] = T.at(u, v), [X, N] = T.at(u - dv * side * (w / 2 + 0.9), v + du * side * (w / 2 + 0.9));
        const lat = latticeAt(X, N);
        if ((lat && lat.d < 14) || riverDist(X, N) < 45 || kept(X, N, 0.8) || inFoot(X, N, 0.8)) continue;
        streetLamp(X, N, Math.atan2(Xc - X, -(Nc - N)));
      }
    }
    for (const L of T.lots) {
      const gb = binAt(L.X, L.N), y = groundAt(L.X, L.N);
      const r = rng(Math.floor(L.r * 1e6));
      // set each building level just under the high side of its footprint; footings run down past the low side
      const sited = (yw, x, z, w, d) => baseM(L.X, y + groundUnder(baseM(L.X, y, L.N, yw), x, z, w, d)[1] - 0.12, L.N, yw);
      const fnd = (base, x, z, w, d, top, c = [0.55, 0.53, 0.5]) => { const h = top - groundUnder(base, x, z, w, d)[0] + 0.3; gb.add('vc', colorize(new THREE.BoxGeometry(w, h, d), c), P(base, x, top - h / 2, z)); };
      if (L.kind === 'shop') {
        const base = sited(yaw, 0, 0, L.w, L.d); foot(base, 0, 0, L.w + 0.6, L.d + 2.6);
        const H = 0.6 + L.stories * 3.6, col = hex3(BRICK[(r() * BRICK.length) | 0]);
        gb.add('brickVC', colorize(boxT(L.w, H, L.d, 3), col), P(base, 0, H / 2, 0));
        fnd(base, 0, 0, L.w + 0.1, L.d + 0.1, 0.06);
        gb.add('vc', colorize(new THREE.BoxGeometry(L.w + 0.3, 0.45, L.d + 0.3), [0.82, 0.78, 0.68]), P(base, 0, H + 0.1, 0)); // cornice
        gb.add('vc', colorize(new THREE.BoxGeometry(L.w - 0.4, 0.7, 0.12), [0.12, 0.12, 0.12]), P(base, 0, 3.75, L.d / 2 + 0.06)); // sign band
        { const m = P(base, -0.6, 1.6, L.d / 2 + 0.02); gb.add('win', winSeed(new THREE.BoxGeometry(L.w - 2.0, 2.2, 0.08), m), m); }   // shop window
        gb.add('trim', new THREE.BoxGeometry(1.0, 2.4, 0.1), P(base, L.w / 2 - 0.9, 1.25, L.d / 2 + 0.03));
        const ac = hex3(AWN[(r() * AWN.length) | 0]);
        gb.add('awning', colorize(new THREE.PlaneGeometry(L.w - 0.6, 1.6), ac), P(base, 0, 3.15, L.d / 2 + 0.65, -1.05, 0, 0));
        for (let s = 2; s <= L.stories; s++) windowsRow(gb, base, -L.w / 2 + 1.6, L.w / 2 - 1.6, 1.0 + (s - 1) * 3.6 + 1.2, L.d / 2, 0.9, 1.6, Math.max(2, Math.round(L.w / 3)));
      } else if (L.kind === 'house') {
        const base = sited(yaw + (L.face > 0 ? Math.PI : 0), 0, 1.0, L.w, L.d + 2.0); foot(base, 0, 1.0, L.w + 0.9, L.d + 2.9);
        const H = L.stories === 2 ? 5.8 : 3.2, col = hex3(SID[(r() * SID.length) | 0]), rc = hex3(ROOF[(r() * ROOF.length) | 0]);
        gb.add('sidingVC', colorize(boxT(L.w, H, L.d, 2.4), col), P(base, 0, H / 2 + 0.3, 0));
        gb.add('roofVC', colorize(gableRoof(L.w, L.d, L.stories === 2 ? 2.6 : 2.2, 0.45), rc), P(base, 0, H + 0.3, 0));
        fnd(base, 0, 0, L.w + 0.1, L.d + 0.1, 0.4); // foundation
        gb.add('vc', colorize(new THREE.BoxGeometry(L.w * 0.7, 0.12, 2.0), [0.92, 0.9, 0.85]), P(base, 0, 2.9, L.d / 2 + 1.0)); // porch roof
        gb.add('vc', colorize(new THREE.BoxGeometry(L.w * 0.7, 0.25, 2.0), [0.6, 0.57, 0.52]), P(base, 0, 0.45, L.d / 2 + 1.0)); // porch deck
        fnd(base, 0, L.d / 2 + 1.0, L.w * 0.7 - 0.2, 1.8, 0.34);
        for (const px of [-L.w * 0.33, L.w * 0.33]) gb.add('vc', colorize(new THREE.BoxGeometry(0.14, 2.4, 0.14), [0.95, 0.94, 0.9]), P(base, px, 1.7, L.d / 2 + 1.9));
        gb.add('trim', new THREE.BoxGeometry(0.95, 2.1, 0.08), P(base, 0, 1.45, L.d / 2 + 0.02));
        windowsRow(gb, base, -L.w / 2 + 1.4, L.w / 2 - 1.4, 1.9, L.d / 2, 0.85, 1.3, 2);
        if (L.stories === 2) windowsRow(gb, base, -L.w / 2 + 1.4, L.w / 2 - 1.4, 4.6, L.d / 2, 0.85, 1.2, 3);
        windowsRow(gb, base, -L.w / 2 + 1.4, L.w / 2 - 1.4, 1.9, -L.d / 2, 0.85, 1.3, 2, -1);
        gb.add('brick', boxT(0.6, 3.0, 0.6), P(base, L.w * 0.28, H + 1.9, -0.6));
        if (r() < 0.35) { gb.add('sidingVC', colorize(boxT(3.6, 2.8, 6), col), P(base, L.w / 2 + 2.6, 1.4, -1.0)); gb.add('roofVC', colorize(gableRoof(3.6, 6, 1.0, 0.25), rc), P(base, L.w / 2 + 2.6, 2.8, -1.0)); fnd(base, L.w / 2 + 2.6, -1.0, 3.7, 6.1, 0.06); foot(base, L.w / 2 + 2.6, -1.0, 3.7, 6.1); }
        for (let t = 0; t < 2; t++) if (r() < 0.75) { const [tx, tn] = T.at(L.u + (r() - 0.5) * 14, L.v + L.face * (-8 - r() * 4)); (SCN.extraTrees || (SCN.extraTrees = [])).push([tx, tn, 0.9 + r() * 0.6, null]); }
      } else if (L.kind === 'church') {
        const base = sited(yaw, 0, 2.05, 12, 26.1); foot(base, 0, 2.05, 13, 27);
        gb.add('white', boxT(12, 8, 22, 2.4), P(base, 0, 4, 0));
        fnd(base, 0, 0, 12.2, 22.2, 0.06); fnd(base, 0, 12.8, 4.8, 4.8, 0.06);
        gb.add('slate', gableRoof(22, 12, 6.0, 0.5).rotateY(Math.PI / 2), P(base, 0, 8, 0));
        gb.add('white', boxT(4.6, 15, 4.6, 2.4), P(base, 0, 7.5, 12.8));
        gb.add('slate', new THREE.ConeGeometry(3.3, 11, 4).rotateY(Math.PI / 4), P(base, 0, 20.5, 12.8));
        gb.add('trim', new THREE.BoxGeometry(1.6, 3.0, 0.1), P(base, 0, 1.55, 15.12));
        // the church's windows all light together for evening service: one seed for the lot
        { const m0 = P(base, 0, 4.4, 0); for (const z of [-7, -2, 3]) for (const s of [-1, 1]) gb.add('win', winSeed(new THREE.BoxGeometry(0.08, 3.4, 1.1), m0), P(base, s * 6.03, 4.4, z));
          gb.add('win', winSeed(new THREE.CylinderGeometry(0.8, 0.8, 0.08, 16).rotateX(Math.PI / 2), m0), P(base, 0, 11.0, 15.12)); }
        keep(L.X, L.N, 18);
      } else if (L.kind === 'tower') {
        const base = baseM(L.X, y - 0.15, L.N, yaw); foot(base, 0, 0, 14, 14);
        for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4, x = Math.cos(a) * 4.2, z = Math.sin(a) * 4.2; gb.add('silver', new THREE.CylinderGeometry(0.25, 0.32, 30.4, 8), P(base, x, 15.2, z)); fnd(base, x, z, 1.0, 1.0, 0.25, [0.62, 0.6, 0.56]); }
        gb.add('silver', new THREE.CylinderGeometry(0.6, 0.6, 30, 10), P(base, 0, 15, 0)); fnd(base, 0, 0, 1.6, 1.6, 0.25, [0.62, 0.6, 0.56]);
        // tank in four pieces on one 24 x 14 facet grid; the lettered band is one of them, so it lies flush
        const tank = (k, ...a) => gb.add(k, new THREE.SphereGeometry(7, ...a).scale(1, 0.72, 1), P(base, 0, 34, 0));
        const RW = Math.PI / 14;
        tank('silver', 24, 6, 0, TAU, 0, 6 * RW); tank('silver', 24, 6, 0, TAU, 8 * RW, 6 * RW); tank('silver', 18, 2, 3 * Math.PI / 4, 3 * Math.PI / 2, 6 * RW, 2 * RW);
        gb.add('silver', new THREE.ConeGeometry(2.2, 2.2, 16), P(base, 0, 39.8, 0));
        const k = 'twr_' + T.name; SMAT[k] = new THREE.MeshLambertMaterial({ map: canvasTex(512, 128, (g, w, h) => { g.fillStyle = '#c8ccd0'; g.fillRect(0, 0, w, h); g.fillStyle = '#23405e'; g.font = 'bold 84px "Arial Narrow", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(T.name.toUpperCase(), w / 2, h / 2 + 4); }) });
        tank(k, 6, 2, Math.PI / 4, Math.PI / 2, 6 * RW, 2 * RW);
      }
    }
    // street trees
    for (const [a, b] of T.streets) { const len = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let s = 10; s < len; s += 17) { const t = s / len, u = lerp(a[0], b[0], t), v = lerp(a[1], b[1], t), ndv = (b[0] - a[0]) / len, ndu = -(b[1] - a[1]) / len; for (const side of [-1, 1]) { if (Math.random() < 0.35) continue; const [X, N] = T.at(u + ndu * side * 7.5, v + ndv * side * 7.5); if (kept(X, N, 1) || onRoad(X, N, 6)) continue; const lat = latticeAt(X, N); if (lat && lat.d < 20) continue; (SCN.extraTrees || (SCN.extraTrees = [])).push([X, N, 1.0 + Math.random() * 0.5, null]); } } }
  }
}

/* ---------- standing corn ---------- */
function buildCorn(scene) {
  const L = INNER, HG = WORLD.hgrid, nx = HG.nx, nn = HG.nn;
  const corn = new Uint8Array(nx * nn);
  for (let j = 0; j < nn - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const X = L.x0 + i * 20 + 10, N = L.n0 + j * 20 + 10;
    if (fieldAt(X, N).t.n !== 'corn') continue;
    let bad = false;
    for (const [cx, cn] of [[X - 10, N - 10], [X + 10, N - 10], [X - 10, N + 10], [X + 10, N + 10]]) { const lat = latticeAt(cx, cn); if (lat && lat.d < 34) { bad = true; break; } }
    if (bad || onRoad(X, N, 18) || riverDist(X, N) < 70 || kept(X, N, 14) || inTown(X, N)) continue;
    if (groundAt(X, N) > 34) continue;
    corn[j * nx + i] = 1;
  }
  const isC = (i, j) => i >= 0 && j >= 0 && i < nx - 1 && j < nn - 1 && corn[j * nx + i] === 1;
  const hAt = (i, j) => HG.h[j * nx + i];
  const jit = (i, j) => (Noise.hash(i * 7 + 1, j * 13 + 5) - 0.5) * 0.3;
  const bins = new Map();
  const bin = (X, N) => { const k = Math.floor((X + 20000) / 1500) + ',' + Math.floor((N + 20000) / 1500); let b = bins.get(k); if (!b) bins.set(k, b = { top: [], tuv: [], wall: [], wuv: [], pts: [] }); return b; };
  for (let j = 0; j < nn - 1; j++) for (let i = 0; i < nx - 1; i++) {
    if (!isC(i, j)) continue;
    const X0 = L.x0 + i * 20, N0 = L.n0 + j * 20, b = bin(X0 + 10, N0 + 10);
    const v = (ii, jj, up) => [L.x0 + ii * 20, hAt(ii, jj) + up + (up > 1 ? jit(ii, jj) : 0), -(L.n0 + jj * 20)];
    const a = v(i, j, 2.3), c1 = v(i + 1, j, 2.3), d = v(i, j + 1, 2.3), e = v(i + 1, j + 1, 2.3);
    for (const p of [a, c1, d, c1, e, d]) { b.top.push(...p); b.tuv.push(p[0] / 3.5, -p[2] / 3.5); }
    b.pts.push(new THREE.Vector3(X0 + 10, a[1], -(N0 + 10)));
    // walls on edges facing non-corn cells
    const edges = [[i, j, i + 1, j, !isC(i, j - 1)], [i + 1, j, i + 1, j + 1, !isC(i + 1, j)], [i + 1, j + 1, i, j + 1, !isC(i, j + 1)], [i, j + 1, i, j, !isC(i - 1, j)]];
    for (const [ia, ja, ib, jb, need] of edges) {
      if (!need) continue;
      const pa0 = v(ia, ja, -0.3), pa1 = v(ia, ja, 2.6), pb0 = v(ib, jb, -0.3), pb1 = v(ib, jb, 2.6);
      const u0 = (ia * 20 + ja * 20) / 4.5, u1 = u0 + 20 / 4.5;
      for (const [p, uu, vv] of [[pa0, u0, 0], [pb0, u1, 0], [pa1, u0, 1], [pb0, u1, 0], [pb1, u1, 1], [pa1, u0, 1]]) { b.wall.push(...p); b.wuv.push(uu, vv); }
    }
  }
  for (const [, b] of bins) {
    if (!b.top.length) continue;
    const grp = new THREE.Group();
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(b.top, 3)); tg.setAttribute('uv', new THREE.Float32BufferAttribute(b.tuv, 2)); tg.computeVertexNormals();
    const tm = new THREE.Mesh(tg, SMAT.cornTop); tm.receiveShadow = true; grp.add(tm);
    if (b.wall.length) { const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(b.wall, 3)); wg.setAttribute('uv', new THREE.Float32BufferAttribute(b.wuv, 2)); wg.computeVertexNormals(); const wm = new THREE.Mesh(wg, SMAT.cornWall); wm.receiveShadow = true; grp.add(wm); }
    const sp = new THREE.Sphere().setFromPoints(b.pts); sp.radius += 15;
    grp.userData = { c: sp.center, r: sp.radius };
    scene.add(grp); DET.cornGroups.push(grp);
  }
  WORLD.cornCells = corn;
}

/* ---------- pastures: fences, cattle; hay bales on stubble ---------- */
function cowGeos() {
  const make = (bodyC, faceC, patch) => {
    const parts = [];
    const body = new THREE.SphereGeometry(1, 14, 10).scale(0.95, 0.46, 0.36).translate(0, 1.02, 0);
    if (patch) { const p = body.attributes.position, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const n = Noise.n2(p.getX(i) * 3.1 + 5, p.getZ(i) * 3.3 + p.getY(i) * 2.1); const col = n > 0.08 ? [0.08, 0.08, 0.08] : [0.93, 0.92, 0.88]; c.set(col, i * 3); } body.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
    else colorize(body, bodyC);
    parts.push(body);
    parts.push(colorize(new THREE.BoxGeometry(0.42, 0.34, 0.3).translate(0.98, 1.08, 0), bodyC));
    parts.push(colorize(new THREE.BoxGeometry(0.34, 0.3, 0.24).rotateZ(-0.6).translate(1.22, 0.9, 0), faceC));
    parts.push(colorize(new THREE.BoxGeometry(0.16, 0.14, 0.2).rotateZ(-0.6).translate(1.36, 0.72, 0), [0.35, 0.28, 0.26]));
    for (const s of [-1, 1]) parts.push(colorize(new THREE.BoxGeometry(0.06, 0.1, 0.16).translate(1.12, 1.08, s * 0.2), bodyC));
    for (const [x, z] of [[0.6, 0.18], [0.6, -0.18], [-0.62, 0.18], [-0.62, -0.18]]) parts.push(colorize(new THREE.CylinderGeometry(0.075, 0.06, 0.82, 6).translate(x, 0.41, z), patch ? [0.9, 0.89, 0.85] : bodyC));
    parts.push(colorize(new THREE.CylinderGeometry(0.025, 0.02, 0.7, 4).rotateZ(0.25).translate(-0.98, 0.78, 0), bodyC));
    return mergeGeos(parts);
  };
  return [make([0.07, 0.07, 0.07], [0.07, 0.07, 0.07], false), make([0.9, 0.9, 0.86], [0.92, 0.92, 0.9], true), make([0.38, 0.18, 0.11], [0.9, 0.88, 0.82], false)];
}
function buildPastureLife(scene) {
  const cows = cowGeos();
  const bale = (() => { const g = new THREE.CylinderGeometry(0.78, 0.78, 1.5, 16).rotateX(Math.PI / 2).translate(0, 0.74, 0); const c = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < g.attributes.position.count; i++) { const end = Math.abs(g.attributes.normal.getZ(i)) > 0.9; c.set(end ? [0.82, 0.74, 0.55] : [1, 1, 1], i * 3); } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; })();
  const post = (() => { const g = dropFaces(new THREE.BoxGeometry(0.12, 1.4, 0.12), [0, 1, 2, 4, 5]); g.translate(0, 0.7, 0); return g; })();
  const bins = new Map();
  const bin = (X, N) => { const k = Math.floor((X + 20000) / 1500) + ',' + Math.floor((N + 20000) / 1500); let b = bins.get(k); if (!b) bins.set(k, b = { cows: [[], [], []], bales: [], posts: [], wires: [], pts: [] }); return b; };
  const free = (X, N, pad) => { const lat = latticeAt(X, N); if (lat && lat.d < pad) return false; if (riverDist(X, N) < 40 || onRoad(X, N, 9) || kept(X, N, 3) || inTown(X, N)) return false; return X > INNER.x0 + 40 && X < INNER.x1 - 40 && N > INNER.n0 + 40 && N < INNER.n1 - 40; };
  const r = rng(4242);
  const i0 = Math.ceil((INNER.x0 + 40000) / FIELD.w), i1 = Math.floor((INNER.x1 + 40000) / FIELD.w) - 1;
  const j0 = Math.ceil((INNER.n0 + 40000) / FIELD.h), j1 = Math.floor((INNER.n1 + 40000) / FIELD.h) - 1;
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const X0 = i * FIELD.w - 40000, N0 = j * FIELD.h - 40000, f = fieldAt(X0 + 5, N0 + 5);
    if (f.t.n !== 'pasture' && f.t.n !== 'stubble') continue;
    const cX = X0 + FIELD.w / 2, cN = N0 + FIELD.h / 2;
    if (farFromTrack(cX, cN) > 1100) continue;
    if (f.t.n === 'pasture') {
      // fence along the field boundary
      const corners = [[X0 + 1.5, N0 + 1.5], [X0 + FIELD.w - 1.5, N0 + 1.5], [X0 + FIELD.w - 1.5, N0 + FIELD.h - 1.5], [X0 + 1.5, N0 + FIELD.h - 1.5]];
      for (let k = 0; k < 4; k++) {
        const [ax0, an0] = corners[k], [bx0, bn0] = corners[(k + 1) % 4], len = Math.hypot(bx0 - ax0, bn0 - an0), n = Math.round(len / 4);
        let prev = null;
        for (let q = 0; q <= n; q++) {
          const X = lerp(ax0, bx0, q / n), N = lerp(an0, bn0, q / n);
          if (!free(X, N, 14)) { prev = null; continue; }
          const y = groundAt(X, N) - 0.05, b = bin(X, N);
          b.posts.push([X, y, N]);
          if (prev) { for (const hgt of [0.55, 0.9, 1.25]) b.wires.push(prev[0], prev[1] + hgt, -prev[2], X, y + hgt, -N); walkWall(prev[0], -prev[2], X, -N, Math.min(y, prev[1]), Math.max(y, prev[1]) + 1.3); }
          prev = [X, y, N];
        }
      }
      // a herd
      const herd = 5 + ((r() * 10) | 0), hx = X0 + FIELD.w * (0.25 + 0.5 * r()), hn = N0 + FIELD.h * (0.25 + 0.5 * r());
      for (let c = 0; c < herd; c++) {
        const X = hx + (r() - 0.5) * 50, N = hn + (r() - 0.5) * 36;
        if (X < X0 + 8 || X > X0 + FIELD.w - 8 || N < N0 + 8 || N > N0 + FIELD.h - 8 || !free(X, N, 40)) continue;
        const b = bin(X, N), y = groundAt(X, N), kind = r() < 0.45 ? 0 : (r() < 0.5 ? 1 : 2);
        b.cows[kind].push([X, y, N, r() * TAU, 0.95 + r() * 0.12, 0]);
      }
    } else if (r() < 0.6) {
      // round bales in rows
      const along = r() < 0.5, rows = 1 + ((r() * 2) | 0);
      for (let rw = 0; rw < rows; rw++) {
        const off = 0.3 + 0.4 * r(), n = 5 + ((r() * 8) | 0);
        for (let q = 0; q < n; q++) {
          const t = 0.15 + 0.7 * q / n, X = along ? X0 + FIELD.w * t : X0 + FIELD.w * off, N = along ? N0 + FIELD.h * off : N0 + FIELD.h * t;
          if (!free(X, N, 36)) continue;
          bin(X, N).bales.push([X + (r() - 0.5) * 3, groundAt(X, N) - 0.08, N + (r() - 0.5) * 3, (along ? 0 : Math.PI / 2) + (r() - 0.5) * 0.5]);
        }
      }
    }
  }
  const wireMat = new THREE.LineBasicMaterial({ color: 0x3a3a38, transparent: true, opacity: 0.8 });
  const cowMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  for (const [, b] of bins) {
    const grp = new THREE.Group(), pts = [];
    const inst = (geo, mat, list, fn) => { if (!list.length) return; const im = new THREE.InstancedMesh(geo.clone(), mat, list.length); list.forEach((q, i) => { fn(q, _m4); im.setMatrixAt(i, _m4); pts.push(new THREE.Vector3(q[0], q[1], -q[2])); }); im.castShadow = true; im.receiveShadow = true; grp.add(im); return im; };
    b.cows.forEach((list, k) => inst(cows[k], cowMat, list, (q, m) => { m.compose(_v1.set(q[0], q[1], -q[2]), _q.setFromEuler(_e.set(0, q[3], q[5])), _v2.setScalar(q[4])); }));
    inst(bale, SMAT.hay, b.bales, (q, m) => m.compose(_v1.set(q[0], q[1], -q[2]), _q.setFromEuler(_e.set(0, q[3], 0)), _v2.set(1, 1, 1)));
    const pim = inst(post, SMAT.post, b.posts, (q, m) => m.compose(_v1.set(q[0], q[1], -q[2]), _q.set(0, 0, 0, 1), _v2.set(1, 1, 1)));
    if (pim) pim.castShadow = false;
    if (b.wires.length) { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(b.wires, 3)); grp.add(new THREE.LineSegments(lg, wireMat)); }
    if (!pts.length) continue;
    const sp = new THREE.Sphere().setFromPoints(pts); sp.radius += 6;
    grp.children.forEach(m => { if (m.geometry) m.geometry.boundingSphere = sp.clone(); });
    grp.userData = { c: sp.center, r: sp.radius };
    scene.add(grp); DET.lifeGroups.push(grp);
  }
}

/* ---------- roadside grass, wildflowers and sumac, generated per track piece as the camera nears ---------- */
function crossedQuads(w, h, n = 3) {
  // each blade card is built twice, back to back, so both faces light like the ground (no flipped normals)
  const parts = [];
  for (let k = 0; k < n; k++) for (const flip of [0, Math.PI]) { const g = new THREE.PlaneGeometry(w, h); g.translate(0, h / 2, 0); g.rotateY(k * Math.PI / n + flip); parts.push(g); }
  const g = mergeGeos(parts); const nrm = g.attributes.normal; for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
  return g;
}
function grassGeos() {
  if (DET.geos) return DET.geos;
  return (DET.geos = { grass: grassClumpGeo(1.0, 0.8), goldenrod: crossedQuads(0.9, 1.2), aster: crossedQuads(0.8, 0.9), fern: crossedQuads(1.3, 0.75, 2), bush: foliageGeos().bush });
}
function genGrass(piece, scene) {
  const U = piece.userData, e = U.edge, G = grassGeos();
  const r = rng(e.id * 131 + Math.floor(U.s0 * 7));
  const L = { grass: [], goldenrod: [], aster: [], bush: [] };
  const step = GFX.lite ? 1.15 : 0.8;
  for (let s = U.s0; s < U.s1; s += step) {
    if (e.isBridge(s) || e.isTunnel(s)) continue;
    e.pose(s, FR);
    for (const side of [-1, 1]) {
      const n = 2 + (r() < 0.6 ? 1 : 0) + (GFX.lite ? 0 : 1);
      for (let q = 0; q < n; q++) {
        const lat = q < 2 ? 3.35 + r() * r() * 7 : q < 3 ? 6 + r() * 8 : 9 + r() * 15;
        const along = (r() - 0.5) * step;
        const x = FR.p.x + FR.r.x * lat * side + FR.f.x * along, z = FR.p.z + FR.r.z * lat * side + FR.f.z * along;
        const X = x, N = -z;
        if (distToTrack(X, N) < 3.3 || riverDist(X, N) < 30 || onRoad(X, N, 5.5) || kept(X, N, 0) || inTown(X, N)) continue;
        const y = groundAt(X, N) - 0.04, pick = r();
        let type = 'grass';
        if (lat > 4.5 && pick < 0.07) type = 'goldenrod'; else if (lat > 4.5 && pick < 0.1) type = 'aster'; else if (lat > 7 && pick < 0.118) type = 'bush';
        const dry = r();
        let c;
        if (type === 'grass') c = grassColor(X, N, r, lat < 4.6 ? 0.12 : 0);   // a little drier on the ballast toe
        else if (type === 'bush') c = r() < 0.4 ? [0.52, 0.2, 0.12] : (r() < 0.5 ? [0.66, 0.44, 0.2] : [0.32, 0.42, 0.2]);
        else c = flowerTint(r);
        const sc = type === 'grass' ? 0.6 + r() * 0.7 : type === 'bush' ? 0.55 + r() * 0.45 : 0.8 + r() * 0.45;
        L[type].push([X, y, N, r() * TAU, sc, c, 0.6 + r() * 0.65]);
      }
    }
  }
  const grp = new THREE.Group();
  for (const k in L) {
    const list = L[k]; if (!list.length) continue;
    const mat = k === 'bush' ? MAT.bush : SMAT['g_' + k];
    const im = new THREE.InstancedMesh(k === 'bush' ? shareGeo(G.bush, U.sphere.clone()) : G[k].clone(), mat, list.length);
    list.forEach((q, i) => { _m4.compose(_v1.set(q[0], q[1], -q[2]), _q.setFromEuler(_e.set(0, q[3], 0)), _v2.set(q[4], q[4] * (k === 'grass' ? q[6] : 1), q[4])); im.setMatrixAt(i, _m4); _tc.setRGB(q[5][0], q[5][1], q[5][2]).convertSRGBToLinear(); im.setColorAt(i, _tc); });
    im.geometry.boundingSphere = U.sphere.clone(); folColorsDone(im);
    im.castShadow = false; im.receiveShadow = true; im.userData.kind = k;
    grp.add(im);
  }
  scene.add(grp);
  U.grass = grp;
}
function updateDetailLOD(cam, scene, dt) {
  DET.timeU.value += dt;
  DET.windK.value += ((SKY.weather === 'clear' ? 1 : 1.7) - DET.windK.value) * Math.min(1, dt * 0.5);
  const cp = cam.position;
  let budget = 1;
  for (const p of WORLD.pieces) {
    const U = p.userData, d = U.sphere.center.distanceTo(cp) - U.sphere.radius;
    if (!U.grass && d < 360 && budget > 0) { genGrass(p, scene); budget--; }
    if (U.grass) { U.grass.visible = d < 420; for (const m of U.grass.children) m.visible = d < (m.userData.kind === 'grass' ? (SKY.snow ? -1 : 230) : m.userData.kind === 'bush' ? 420 : 300); }
  }
  coverUpdate(cam, scene);
  for (const g of DET.cornGroups) g.visible = g.userData.c.distanceTo(cp) - g.userData.r < 3200;
  for (const g of DET.lifeGroups) g.visible = g.userData.c.distanceTo(cp) - g.userData.r < 900;
}

/* ---------- ground cover away from the track: grass tufts in the pastures and meadows, weeds and flowers along
   the fence rows, bracken under the mountain woods. Grown in 48 m cells round the camera, one cell a frame, and
   let go again behind it. Nothing comes within 26 m of a track (the lineside grass covers that) or onto a road,
   a river, a town or a building. ---------- */
const COVER = { cells: new Map(), size: 48 };
function coverCell(ci, cj, scene) {
  const S = COVER.size, X0 = ci * S, N0 = cj * S, G = grassGeos(), r = rng(ci * 7349 + cj * 1931 + 5);
  const sp = GFX.lite ? 2.3 : 1.55, L = { grass: [], goldenrod: [], aster: [], fern: [] };
  const mtn = !!WORLD.mtn;
  for (let y = N0 + sp / 2; y < N0 + S; y += sp) for (let x = X0 + sp / 2; x < X0 + S; x += sp) {
    const X = x + (r() - 0.5) * sp, N = y + (r() - 0.5) * sp, pick = r();
    let type = null, c = null;
    if (mtn) {
      const wood = (0.55 + 0.5 * Noise.fbm(X / 420 + 9, N / 420 - 4, 3)) * (1 - 0.55 * smooth(700, 2600, mtField(MT.dT, X, N)));
      if (wood > 0.28 && !mtClearing(X, N, 0)) { if (pick < 0.11) { type = 'fern'; c = r() < 0.55 ? [0.62, 0.42, 0.2] : [0.36, 0.44, 0.2]; } }
      else if (pick < 0.32) type = 'grass';
      else if (pick < 0.335) type = 'goldenrod';
    } else {
      const f = fieldAt(X, N), n = f.t.n, edge = f.edge < 4.5;
      const p = edge ? 0.7 : n === 'pasture' ? (GFX.lite ? 0.3 : 0.42) : n === 'woods' ? 0.4 : n === 'stubble' ? 0.03 : 0;
      if (pick >= p) continue;
      type = edge && pick < 0.1 ? (pick < 0.06 ? 'goldenrod' : 'aster') : 'grass';
    }
    if (!type) continue;
    const lat = latticeAt(X, N); if (lat && lat.d < 26) continue;
    if ((mtn ? mtRiverDist(X, N) < 24 : riverDist(X, N) < 30) || onRoad(X, N, 6) || kept(X, N, 1) || inTown(X, N) || inFoot(X, N, 1.5)) continue;
    if (type === 'grass') c = grassColor(X, N, r);
    if (!c) c = flowerTint(r);
    const sc = type === 'grass' ? 0.55 + r() * 0.7 : type === 'fern' ? 0.6 + r() * 0.6 : 0.75 + r() * 0.4;
    L[type].push([X, groundAt(X, N) - 0.05, N, r() * TAU, sc, c, 0.6 + r() * 0.65]);
  }
  const grp = new THREE.Group(), sph = new THREE.Sphere(new THREE.Vector3(X0 + S / 2, groundAt(X0 + S / 2, N0 + S / 2), -(N0 + S / 2)), S * 0.75 + 6);
  for (const k in L) {
    const list = L[k]; if (!list.length) continue;
    const im = new THREE.InstancedMesh(shareGeo(G[k], sph.clone()), SMAT['g_' + k], list.length);
    list.forEach((q, i) => { _m4.compose(_v1.set(q[0], q[1], -q[2]), _q.setFromEuler(_e.set(0, q[3], 0)), _v2.set(q[4], q[4] * (k === 'grass' ? q[6] : 1), q[4])); im.setMatrixAt(i, _m4); _tc.setRGB(q[5][0], q[5][1], q[5][2]).convertSRGBToLinear(); im.setColorAt(i, _tc); });
    folColorsDone(im);
    im.castShadow = false; im.receiveShadow = true; im.userData.kind = k;
    grp.add(im);
  }
  scene.add(grp);
  return { grp, c: sph.center };
}
function coverUpdate(cam, scene) {
  if (!WORLD.trackHash) return;
  const S = COVER.size, R = GFX.lite ? 125 : 200, cp = cam.position, X = cp.x, N = -cp.z;
  // nothing to grow when the camera is high above the ground (an aerial view sees it all as texture)
  const high = cp.y - groundAt(X, N) > 140;
  let best = null, bd = 1e9;
  const i0 = Math.floor((X - R) / S), i1 = Math.floor((X + R) / S), j0 = Math.floor((N - R) / S), j1 = Math.floor((N + R) / S);
  if (!high) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const key = i + ',' + j; if (COVER.cells.has(key)) continue;
    if (i * S < INNER.x0 + 40 || (i + 1) * S > INNER.x1 - 40 || j * S < INNER.n0 + 40 || (j + 1) * S > INNER.n1 - 40) continue;
    const d = Math.hypot((i + 0.5) * S - X, (j + 0.5) * S - N) - S * 0.7; if (d > R) continue;
    if (d < bd) { bd = d; best = key; }
  }
  if (best) { const [i, j] = best.split(',').map(Number); COVER.cells.set(best, coverCell(i, j, scene)); }
  const snow = SKY.snow;
  for (const [key, c] of COVER.cells) {
    const d = Math.hypot(c.c.x - cp.x, c.c.z - cp.z);
    if (d > R + 160) { scene.remove(c.grp); for (const m of c.grp.children) { dropShared(m.geometry); m.dispose(); } COVER.cells.delete(key); continue; }
    c.grp.visible = d < 300;
    for (const m of c.grp.children) m.visible = !(snow && (m.userData.kind === 'grass' || m.userData.kind === 'fern'));
  }
}

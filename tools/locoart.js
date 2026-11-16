#!/usr/bin/env node
/* Draws the side view of every engine for its card in the menu's Locomotive picker, straight from the
   in-game models, and writes them to src/12a_locoart.js. Run it again whenever an engine's model changes:
     ./build.sh && node tools/locoart.js && ./build.sh
   Needs tests/vendor/three.min.js (see the CI workflow) and the preinstalled Playwright Chromium. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'src', '12a_locoart.js');
const W = 450, H = 102;            // 3x the card's 150 x 34 art box
const SS = 3;                       // supersampling before the downscale
const SHOTS = process.env.SHOTS;    // a folder to also write a preview strip to

function png(w, h, alpha) {         // greyscale + alpha PNG, grey 0: only the alpha is used, as a CSS mask
  const raw = Buffer.alloc((w * 2 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 2 + 1)] = 0; for (let x = 0; x < w; x++) raw[y * (w * 2 + 1) + 1 + x * 2 + 1] = alpha[y * w + x]; }
  const crc = b => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let r = 0xffffffff; for (const x of b) r = t[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 4;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}


/* runs in the page: make up the engine as a light engine, then draw it side on with an orthographic
   camera, flat clay shading and dark outlines, on a layer that holds nothing but the engine */
const SHOOTER = `window.LART_SHOOT = function (key, W, H, SS) {
  GAME.settings.loco = key; GAME.settings.consist = 'light'; GAME.settings.units = 1;
  makeTrain();
  const t = GAME.train;
  for (let i = 0; i < 3; i++) { t.update && t.update(0, 0, 0); }
  // a trainset is drawn as its leading power car, an engine with everything that is part of it
  const set = !!LOCO_SPEC[key].set;
  const u0 = set && (t.units.find(u => u.root === t.vehicles[0].root) || t.units[0]);
  const roots = set ? [t.vehicles[0].root, ...(u0.trucks || [])] : trainRoots(t);
  roots.forEach(r => r.updateMatrixWorld(true));
  const LAY = 9;
  // the engine's own frame: forward along the lead vehicle's x, up its y
  const lead = t.vehicles[0].root, m = lead.matrixWorld.clone(), inv = new THREE.Matrix4().copy(m).invert();
  const box = new THREE.Box3(), v = new THREE.Vector3();
  const onLayer = [];
  const pts = (o, f) => {
    const g = o.geometry; if (!g || !g.attributes.position) return;
    const p = g.attributes.position, n = p.count, step = Math.max(1, Math.floor(n / 4000));
    const mats = o.isInstancedMesh ? Array.from({ length: o.count }, (_, i) => { const im = new THREE.Matrix4(); o.getMatrixAt(i, im); return new THREE.Matrix4().multiplyMatrices(o.matrixWorld, im); }) : [o.matrixWorld];
    for (const mw of mats) for (let i = 0; i < n; i += step) f(v.fromBufferAttribute(p, i).applyMatrix4(mw).applyMatrix4(inv));
  };
  roots.forEach(r => r.traverse(o => {
    if (!o.visible || !o.isMesh) return;
    // light beams, glows and haze are drawn additively and are not part of the engine's shape
    const mt = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!mt || mt.blending !== THREE.NormalBlending || (mt.transparent && !mt.depthWrite)) return;
    o.layers.enable(LAY); onLayer.push(o);
    pts(o, q => box.expandByPoint(q));
  }));
  const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  // fit to the card: the whole length across, or the full height, whichever runs out first; standing on the bottom edge
  const mpp = Math.max(size.x / W, size.y / H);
  const cam = new THREE.OrthographicCamera(-W * mpp / 2, W * mpp / 2, H * mpp / 2, -H * mpp / 2, 0.1, 200);
  const look = new THREE.Vector3(c.x, box.min.y + H * mpp / 2, c.z).applyMatrix4(m);
  const side = new THREE.Vector3(0, 0, 1).transformDirection(m), up = new THREE.Vector3(0, 1, 0).transformDirection(m);
  cam.position.copy(look).addScaledVector(side, 60); cam.up.copy(up); cam.lookAt(look);
  cam.layers.set(LAY);
  const amb = new THREE.AmbientLight(0xffffff, 0.22), key1 = new THREE.DirectionalLight(0xffffff, 0.7);
  key1.position.copy(look).addScaledVector(side, 9).addScaledVector(up, 30).addScaledVector(new THREE.Vector3(1, 0, 0).transformDirection(m), 12);
  key1.target.position.copy(look);
  [amb, key1, key1.target].forEach(o => { o.layers.set(LAY); scene.add(o); });
  const fog = scene.fog, bg = scene.background, ov = scene.overrideMaterial;
  scene.fog = null; scene.background = null;
  const rt = new THREE.WebGLRenderTarget(W * SS, H * SS);
  const read = mat => { scene.overrideMaterial = mat; renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam); const px = new Uint8Array(W * SS * H * SS * 4); renderer.readRenderTargetPixels(rt, 0, 0, W * SS, H * SS, px); return px; };
  const clay = read(new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
  const dep = read(new THREE.MeshNormalMaterial({ side: THREE.DoubleSide }));
  renderer.setRenderTarget(null);
  scene.overrideMaterial = ov; scene.fog = fog; scene.background = bg;
  [amb, key1, key1.target].forEach(o => scene.remove(o));
  onLayer.forEach(o => o.layers.disable(LAY));
  rt.dispose();
  // full-size alpha: coverage times a shade, with outlines where the surface turns sharply
  const w = W * SS, h = H * SS, A = new Uint8ClampedArray(w * h * 4);
  const nrm = (x, y) => { const i = ((h - 1 - y) * w + x) * 4; return [dep[i], dep[i + 1], dep[i + 2], dep[i + 3]]; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = ((h - 1 - y) * w + x) * 4, o = (y * w + x) * 4;
    const a = clay[i + 3] / 255; if (!a) continue;
    const lum = clay[i] / 255;
    let edge = 0; const n0 = nrm(x, y);
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const xx = x + dx * SS, yy = y + dy * SS; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const n1 = nrm(xx, yy); if (!n1[3]) continue; const d = Math.abs(n0[0] - n1[0]) + Math.abs(n0[1] - n1[1]) + Math.abs(n0[2] - n1[2]); if (d > 90) edge = 1; }
    A[o + 3] = 255 * a * (edge ? 0.2 : 0.3 + 0.7 * Math.min(1, lum * 1.25));
  }
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').putImageData(new ImageData(A, w, h), 0, 0);
  const sm = document.createElement('canvas'); sm.width = W; sm.height = H; const g2 = sm.getContext('2d'); g2.imageSmoothingQuality = 'high'; g2.drawImage(cv, 0, 0, W, H);
  const d = g2.getImageData(0, 0, W, H).data, al = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) al[i] = Math.round(d[i * 4 + 3] / 17) * 17;   // 16 levels: half the bytes, no change you can see on a card
  let s = ''; for (let i = 0; i < al.length; i += 8192) s += String.fromCharCode.apply(null, al.subarray(i, i + 8192));
  return { alpha: btoa(s), m: { len: +size.x.toFixed(2), ht: +size.y.toFixed(2), wide: +size.z.toFixed(2), mpp: +mpp.toFixed(4), n: t.vehicles.length } };
};`;

async function main() {
  const { chromium } = require('playwright');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<script src="https:\/\/cdnjs[^"]*three.min.js"><\/script>/, '<script src="/three.min.js"></script>');
  const srv = http.createServer((q, r) => {
    const u = decodeURIComponent(q.url.split('?')[0]);
    if (u === '/' || u === '/index.html') { r.setHeader('content-type', 'text/html'); return r.end(html); }
    if (u === '/three.min.js') return r.end(fs.readFileSync(path.join(ROOT, 'tests', 'vendor', 'three.min.js')));
    const f = path.join(ROOT, u); if (f.startsWith(ROOT) && fs.existsSync(f) && fs.statSync(f).isFile()) return r.end(fs.readFileSync(f));
    r.statusCode = 404; r.end();
  }).listen(0);
  const port = srv.address().port;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => console.error('page:', e.message));
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction(() => typeof GAME !== 'undefined' && GAME.ready, null, { timeout: 300000 });
  await page.addScriptTag({ content: SHOOTER });
  if (process.env.PROBE) { console.log(await page.evaluate(new Function(process.env.PROBE))); await browser.close(); srv.close(); return {}; }
  const keys = await page.evaluate(() => Object.keys(LOCO_SPEC));
  const out = {};
  for (const key of keys) {
    const r = await page.evaluate(([key, W, H, SS]) => LART_SHOOT(key, W, H, SS), [key, W, H, SS]).catch(e => { throw new Error(key + ': ' + e.message); });
    out[key] = { alpha: Buffer.from(r.alpha, 'base64'), m: r.m };
    console.log(key, r.m);
  }
  await browser.close(); srv.close();
  return out;
}
module.exports = { png, main };
if (require.main === module) main().then(out => {
  const lines = Object.keys(out).map(k => `  '${k}': 'data:image/png;base64,${png(W, H, out[k].alpha).toString('base64')}',`);
  fs.writeFileSync(OUT, `/* The side view of every engine on its card in the menu's Locomotive picker, drawn from the in-game models
   by tools/locoart.js (flat shading, dark outlines) as ${W} x ${H} alpha masks: the card tints them with its own colour.
   Generated: run \`./build.sh && node tools/locoart.js && ./build.sh\` after changing an engine's model. */
const LOCO_ART = {
${lines.join('\n')}
};
const LOCO_ART_SIZE = [${W}, ${H}];
`);
  console.log('wrote', path.relative(ROOT, OUT), fs.statSync(OUT).size, 'bytes');
  if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); for (const k in out) fs.writeFileSync(path.join(SHOTS, k + '.png'), png(W, H, out[k].alpha)); }
}).catch(e => { console.error(e); process.exit(1); });

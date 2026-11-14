/* ============================================================================
   Post-processing and graphics quality
   The scene is drawn into an off-screen target (with its own 4x MSAA where WebGL2 allows), then one
   short chain of full-screen passes takes it to the screen:
     bright pass -> five-level bloom (down by 13-tap, up by tent filter) -> sun shafts (radial blur of the
     bright sky toward the sun) -> composite: bloom, shafts, colour grade, vignette, FXAA or a light
     sharpen, and a dither so skies and night gradients don't band.
   The target holds exactly what the screen used to (ACES tone mapped, sRGB encoded, 8 bits), so with
   the effects at zero the picture is the same as before; the effects are layered on in linear light.
   Dynamic resolution shrinks only that target (never the canvas) when frames run long on the GPU.
   ========================================================================== */
const GFXQ = {
  low: { name: 'Low', sub: 'No effects · fastest', post: false, pr: 1, shadow: 1024, far: 1024 },
  medium: { name: 'Medium', sub: 'Bloom & grade · 4x MSAA', post: true, msaa: 4, fxaa: true, bloom: true, shafts: false, pr: 1.5, shadow: 2048, far: 1024 },
  high: { name: 'High', sub: 'Bloom, sun shafts · 4x MSAA', post: true, msaa: 4, fxaa: false, bloom: true, shafts: true, pr: 2, shadow: 4096, far: 2048 },
  ultra: { name: 'Ultra', sub: 'Sharpest · big far shadows', post: true, msaa: 8, fxaa: false, bloom: true, shafts: true, pr: 2.5, shadow: 4096, far: 4096, fixed: true },
};
const GFX_MENU = Object.assign({ auto: { name: 'Auto', sub: 'Picks for this device' } }, GFXQ);
const POST = {
  key: 'high', q: GFXQ.high, on: false, ready: false, scale: 1, dyn: true,
  bloomK: 0.55, shaftK: 0.0, vig: 0.26, sat: 1.06, con: 1.05, warm: 0,
  ft: 0, ftN: 0, vs: 1 / 60, vsMin: 1, hold: 0, lastScale: 1, lastFt: 0, tried: 0,
};
/* the setting as saved (read before the renderer exists, so the canvas is made with or without its own AA) */
function postSavedKey() { try { const o = JSON.parse(localStorage.getItem('bd_settings') || 'null'); return (o && GFX_MENU[o.gfx]) ? o.gfx : 'auto'; } catch (e) { return 'auto'; } }
function postResolve(k) {
  if (GFXQ[k]) return k;
  const phone = (typeof GFX !== 'undefined' && GFX.lite) || /iPhone|iPad|Android/i.test(navigator.userAgent);
  return phone ? 'medium' : 'high';
}
const PP_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const PP_SRGB = `
  vec3 ppLin(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
  vec3 ppSrgb(vec3 c){ c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
  float ppLum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }`;
function ppMat(frag, uniforms) {
  return new THREE.ShaderMaterial({ vertexShader: PP_VS, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, toneMapped: false });
}
function postSetup(renderer) {
  const gl = renderer.getContext(), ext = renderer.extensions;
  POST.webgl2 = renderer.capabilities.isWebGL2;
  POST.maxSamples = POST.webgl2 ? gl.getParameter(gl.MAX_SAMPLES) : 0;
  POST.halfOK = POST.webgl2 ? (ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float')) : (ext.has('OES_texture_half_float') && ext.has('OES_texture_half_float_linear') && ext.has('EXT_color_buffer_half_float'));
  POST.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  POST.quad = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), null); POST.quad.frustumCulled = false;
  POST.qs = new THREE.Scene(); POST.qs.add(POST.quad);
  const tex = () => ({ value: null }), v2 = () => ({ value: new THREE.Vector2() });
  // bright pass: what is brighter than the knee, in linear light, kept smooth so lamps don't flicker
  POST.mBright = ppMat(`${PP_SRGB}
    uniform sampler2D tSrc; uniform vec2 uTx; uniform float uKnee; varying vec2 vUv;
    void main(){
      vec3 c = vec3(0.0);
      c += ppLin(texture2D(tSrc, vUv + uTx * vec2(-0.5, -0.5)).rgb); c += ppLin(texture2D(tSrc, vUv + uTx * vec2(0.5, -0.5)).rgb);
      c += ppLin(texture2D(tSrc, vUv + uTx * vec2(-0.5, 0.5)).rgb); c += ppLin(texture2D(tSrc, vUv + uTx * vec2(0.5, 0.5)).rgb);
      c *= 0.25;
      float l = ppLum(c), k = smoothstep(uKnee, 1.0, l);
      gl_FragColor = vec4(c * k * k, 1.0);
    }`, { tSrc: tex(), uTx: v2(), uKnee: { value: 0.62 } });
  // 13-tap downsample (the "COD" filter): no fireflies, no blocky steps
  POST.mDown = ppMat(`uniform sampler2D tSrc; uniform vec2 uTx; varying vec2 vUv;
    vec3 t(vec2 o){ return texture2D(tSrc, vUv + uTx * o).rgb; }
    void main(){
      vec3 c = t(vec2(0.0)) * 0.125;
      c += (t(vec2(-1.0, -1.0)) + t(vec2(1.0, -1.0)) + t(vec2(-1.0, 1.0)) + t(vec2(1.0, 1.0))) * 0.125;
      c += (t(vec2(-2.0, -2.0)) + t(vec2(2.0, -2.0)) + t(vec2(-2.0, 2.0)) + t(vec2(2.0, 2.0))) * 0.03125;
      c += (t(vec2(-2.0, 0.0)) + t(vec2(2.0, 0.0)) + t(vec2(0.0, -2.0)) + t(vec2(0.0, 2.0))) * 0.0625;
      gl_FragColor = vec4(c, 1.0);
    }`, { tSrc: tex(), uTx: v2() });
  // tent upsample, added onto the level above
  POST.mUp = ppMat(`uniform sampler2D tSrc; uniform sampler2D tBase; uniform vec2 uTx; uniform float uW; varying vec2 vUv;
    vec3 t(vec2 o){ return texture2D(tSrc, vUv + uTx * o).rgb; }
    void main(){
      vec3 c = t(vec2(0.0)) * 4.0;
      c += (t(vec2(-1.0, 0.0)) + t(vec2(1.0, 0.0)) + t(vec2(0.0, -1.0)) + t(vec2(0.0, 1.0))) * 2.0;
      c += t(vec2(-1.0, -1.0)) + t(vec2(1.0, -1.0)) + t(vec2(-1.0, 1.0)) + t(vec2(1.0, 1.0));
      gl_FragColor = vec4(texture2D(tBase, vUv).rgb + c / 16.0 * uW, 1.0);
    }`, { tSrc: tex(), tBase: tex(), uTx: v2(), uW: { value: 1 } });
  // sun shafts: march from each pixel toward the sun through the bright sky, so trees, cars and the
  // engine's smoke throw rays across the haze (only the sky is bright enough at the knee used here)
  POST.mShaft = ppMat(`${PP_SRGB}
    uniform sampler2D tSrc; uniform vec2 uSun; uniform float uAsp; varying vec2 vUv;
    void main(){
      vec2 d = (uSun - vUv) / 40.0; vec2 p = vUv; float w = 1.0; vec3 c = vec3(0.0);
      float j = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
      p += d * j;
      for (int i = 0; i < 40; i++) { vec3 s = ppLin(texture2D(tSrc, p).rgb); c += max(s - 0.72, 0.0) * w; w *= 0.955; p += d; }
      vec2 q = (vUv - uSun) * vec2(uAsp, 1.0);
      gl_FragColor = vec4(c / 40.0 * exp(-dot(q, q) * 2.2), 1.0);
    }`, { tSrc: tex(), uSun: v2(), uAsp: { value: 1 } });
  POST.mFinal = ppMat(`${PP_SRGB}
    uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tShaft;
    uniform vec2 uTx; uniform float uBloom, uShaft, uVig, uSat, uCon, uSharp, uTime, uFxaa;
    uniform vec3 uTint; uniform vec3 uShaftC; uniform float uAsp; varying vec2 vUv;
    vec3 fxaa(vec2 uv){
      vec3 rgbM = texture2D(tScene, uv).rgb;
      vec3 rgbNW = texture2D(tScene, uv + vec2(-1.0, -1.0) * uTx).rgb, rgbNE = texture2D(tScene, uv + vec2(1.0, -1.0) * uTx).rgb;
      vec3 rgbSW = texture2D(tScene, uv + vec2(-1.0, 1.0) * uTx).rgb, rgbSE = texture2D(tScene, uv + vec2(1.0, 1.0) * uTx).rgb;
      float lM = ppLum(rgbM), lNW = ppLum(rgbNW), lNE = ppLum(rgbNE), lSW = ppLum(rgbSW), lSE = ppLum(rgbSE);
      float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE))), lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
      if (lMax - lMin < max(0.0312, lMax * 0.125)) return rgbM;
      vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
      float red = max((lNW + lNE + lSW + lSE) * 0.03125, 0.0078125);
      dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + red), -8.0, 8.0) * uTx;
      vec3 a = 0.5 * (texture2D(tScene, uv - dir * 0.1667).rgb + texture2D(tScene, uv + dir * 0.1667).rgb);
      vec3 b = a * 0.5 + 0.25 * (texture2D(tScene, uv - dir * 0.5).rgb + texture2D(tScene, uv + dir * 0.5).rgb);
      float lB = ppLum(b);
      return (lB < lMin || lB > lMax) ? a : b;
    }
    void main(){
      vec3 c;
      if (uFxaa > 0.5) c = fxaa(vUv);
      else {
        c = texture2D(tScene, vUv).rgb;
        if (uSharp > 0.0) {   // a light unsharp mask while dynamic resolution is scaling the image up
          vec3 n = texture2D(tScene, vUv + vec2(uTx.x, 0.0)).rgb + texture2D(tScene, vUv - vec2(uTx.x, 0.0)).rgb + texture2D(tScene, vUv + vec2(0.0, uTx.y)).rgb + texture2D(tScene, vUv - vec2(0.0, uTx.y)).rgb;
          c = clamp(c + (c - n * 0.25) * uSharp, 0.0, 1.0);
        }
      }
      vec3 l = ppLin(c);
      vec3 b = texture2D(tBloom, vUv).rgb * uBloom;
      vec3 s = texture2D(tShaft, vUv).rgb * uShaftC * uShaft;
      l += (b + s) * (1.0 - 0.6 * clamp(l, 0.0, 1.0));   // added light fills shadows more than it blows out highlights
      l *= uTint;
      c = ppSrgb(l);
      // grade in display space: a gentle S-curve and a little more colour
      c = clamp(c, 0.0, 1.0);
      c = clamp((c - 0.42) * uCon + 0.42, 0.0, 1.0);   // contrast about the mid-tones, so the picture is no darker overall
      float y = ppLum(c); c = max(mix(vec3(y), c, uSat), 0.0);
      vec2 q = (vUv - 0.5) * vec2(uAsp, 1.0);
      c *= 1.0 - uVig * smoothstep(0.35, 1.05, length(q) * 1.15);
      c += (fract(sin(dot(vUv * 1000.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
      gl_FragColor = vec4(c, 1.0);
    }`, { tScene: tex(), tBloom: tex(), tShaft: tex(), uTx: v2(), uBloom: { value: 0.5 }, uShaft: { value: 0 }, uVig: { value: 0.25 }, uSat: { value: 1.05 }, uCon: { value: 1.04 }, uSharp: { value: 0 }, uTime: { value: 0 }, uFxaa: { value: 0 }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uShaftC: { value: new THREE.Vector3(1, 0.85, 0.6) }, uAsp: { value: 1 } });
  POST.ready = true;
  postQuality(postResolve(GAME.settings.gfx || 'auto'));
}
function ppTarget(w, h, half) {
  return new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: half ? THREE.HalfFloatType : THREE.UnsignedByteType, depthBuffer: false, stencilBuffer: false });
}
function postFree() {
  if (POST.rt) POST.rt.dispose(); POST.rt = null;
  if (POST.mips) for (const m of POST.mips) { m.a.dispose(); if (m.b) m.b.dispose(); } POST.mips = null;
  if (POST.shaft) POST.shaft.dispose(); POST.shaft = null;
}
/* grass cards fade out their blade edges by alpha to coverage, which only works with multisampling: without it
   the cut is raised so the blades don't draw fat and dark */
function postGrassCut(msaa) {
  if (typeof DET === 'undefined' || !DET.grassMats) return;
  for (const m of DET.grassMats) { if (!m.alphaToCoverage) continue; const at = msaa ? 0.3 : 0.5; if (m.alphaTest !== at) { m.alphaTest = at; m.needsUpdate = true; } }
}
/* (re)build the targets for the canvas size times the dynamic scale */
function postAlloc() {
  postFree();
  if (typeof SKY !== 'undefined' && SKY.starU) SKY.starU.uPx.value = ppPx();
  if (!POST.on) { postGrassCut(!!(renderer.getContextAttributes && renderer.getContextAttributes().antialias)); return; }
  const db = renderer.getDrawingBufferSize(new THREE.Vector2());
  const w = Math.max(2, Math.round(db.x * POST.scale)), h = Math.max(2, Math.round(db.y * POST.scale));
  const q = POST.q, ms = POST.webgl2 ? Math.min(q.msaa || 0, POST.maxSamples) : 0;
  const opt = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, encoding: THREE.sRGBEncoding, depthBuffer: true, stencilBuffer: false };
  if (ms > 0) { POST.rt = new THREE.WebGLMultisampleRenderTarget(w, h, opt); POST.rt.samples = ms; }
  else POST.rt = new THREE.WebGLRenderTarget(w, h, opt);
  POST.w = w; POST.h = h; POST.samples = ms;
  postGrassCut(ms > 0);
  // bloom mips start at half size; each level holds the blur going down and the sum coming back up
  POST.mips = [];
  let mw = Math.max(1, w >> 1), mh = Math.max(1, h >> 1);
  for (let i = 0; i < 6 && mw >= 4 && mh >= 4; i++) { POST.mips.push({ a: ppTarget(mw, mh, POST.halfOK), b: i < 5 ? ppTarget(mw, mh, POST.halfOK) : null, w: mw, h: mh }); mw >>= 1; mh >>= 1; }
  POST.shaft = ppTarget(Math.max(2, w >> 2), Math.max(2, h >> 2), POST.halfOK);
  gfxNote();
}
function postQuality(key) {
  POST.key = key; POST.q = GFXQ[key];
  const q = POST.q;
  POST.on = POST.ready && q.post;
  POST.dyn = !q.fixed; POST.scale = 1; POST.hold = 3; POST.tried = 0;
  const mobile = Math.min(screen.width, screen.height) < 600;
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? Math.min(q.pr, 1.6) : q.pr));
  postShadows(q);
  postAlloc();
}
/* shadow maps follow the setting; a map is freed so three makes it again at the new size */
function postShadows(q) {
  if (typeof SKY === 'undefined' || !SKY.sun) return;
  const mobile = Math.min(screen.width, screen.height) < 600, max = renderer.capabilities.maxTextureSize;
  const near = Math.min(mobile ? Math.min(q.shadow, 2048) : q.shadow, max), far = Math.min(mobile ? 1024 : q.far, max);
  const set = (L, s) => { if (L.shadow.mapSize.x === s) return; L.shadow.mapSize.set(s, s); if (L.shadow.map) { L.shadow.map.dispose(); L.shadow.map = null; } };
  set(SKY.sun, near); SKY.shadowMap = near;
  if (SKY.sunFar) { set(SKY.sunFar, far); SKY.sunFar.shadow.needsUpdate = true; }
}
function postResize() { if (POST.on) postAlloc(); }
/* frame timing for dynamic resolution: the shortest gap seen is the display's refresh; when frames take
   clearly longer than that the target shrinks a step, and grows back once there is room again. A step
   down that buys nothing (the game is waiting on the CPU, not the GPU) is undone and not tried again for a while. */
function postTime() {
  const now = performance.now(), dt = POST.at ? (now - POST.at) / 1000 : 0; POST.at = now;
  if (!POST.on || !POST.dyn || dt <= 0 || dt > 0.25 || document.hidden) return;
  POST.vsMin = Math.min(POST.vsMin * 1.00003, Math.max(dt, 1 / 165));
  POST.ft = POST.ftN ? POST.ft + (dt - POST.ft) * 0.05 : dt; POST.ftN++;
  POST.hold -= dt; if (POST.hold > 0 || POST.ftN < 60) return;
  const vs = POST.vsMin, slow = POST.ft > vs * 1.22, room = POST.ft < vs * 1.06;
  if (POST.tried && POST.lastScale > POST.scale && POST.ft > POST.lastFt * 0.95) {   // shrinking didn't help
    POST.scale = POST.lastScale; POST.tried = 0; POST.hold = 25; postAlloc(); return;
  }
  POST.tried = 0;
  if (slow && POST.scale > 0.62) { POST.lastScale = POST.scale; POST.lastFt = POST.ft; POST.scale = Math.max(0.6, POST.scale * 0.88); POST.tried = 1; POST.hold = 2; postAlloc(); }
  else if (room && POST.scale < 1) { POST.lastScale = POST.scale; POST.scale = Math.min(1, POST.scale / 0.92); POST.hold = 4; postAlloc(); }
  else POST.hold = 1;
}
const _ppV = new THREE.Vector3(), _ppDb = new THREE.Vector2();
/* draw a frame: straight to the screen on Low, through the chain otherwise */
function postRender(renderer, scene, camera) {
  if (!POST.on || !POST.rt) { renderer.render(scene, camera); return; }
  postTime();
  const ac = renderer.autoClear;
  renderer.setRenderTarget(POST.rt); renderer.render(scene, camera);
  const q = POST.q, Q = POST.quad, mips = POST.mips, src = POST.rt.texture;
  const pass = (mat, dst) => { Q.material = mat; renderer.setRenderTarget(dst); renderer.render(POST.qs, POST.cam); };
  let bloom = null;
  if (q.bloom && mips.length) {
    const m0 = mips[0], b = POST.mBright.uniforms;
    b.tSrc.value = src; b.uKnee.value = POST.knee || 0.7; b.uTx.value.set(1 / POST.w, 1 / POST.h); pass(POST.mBright, m0.a);
    for (let i = 1; i < mips.length; i++) { const d = POST.mDown.uniforms; d.tSrc.value = mips[i - 1].a.texture; d.uTx.value.set(1 / mips[i - 1].w, 1 / mips[i - 1].h); pass(POST.mDown, mips[i].a); }
    let up = mips[mips.length - 1].a;
    for (let i = mips.length - 2; i >= 0; i--) { const u = POST.mUp.uniforms; u.tSrc.value = up.texture; u.tBase.value = mips[i].a.texture; u.uTx.value.set(1 / mips[i + 1].w, 1 / mips[i + 1].h); u.uW.value = 1; pass(POST.mUp, mips[i].b); up = mips[i].b; }
    bloom = up.texture;
  }
  // sun shafts, when the sun (or a bright moon) is in front of the camera
  let shaftK = 0; const F = POST.mFinal.uniforms;
  if (q.shafts && POST.shaftK > 0.01 && typeof SKY !== 'undefined' && SKY.keyDir) {
    _ppV.copy(camera.position).addScaledVector(SKY.keyDir, 1000).project(camera);
    const ahead = _ppV.z < 1 && _ppV.z > -1, sx = _ppV.x * 0.5 + 0.5, sy = _ppV.y * 0.5 + 0.5;
    const edge = Math.max(Math.abs(sx - 0.5), Math.abs(sy - 0.5));
    // not from inside a cab: the march can't tell a shiny boiler jacket from the sky behind it
    const inside = typeof CAM !== 'undefined' && CAM.mode === 'cab';
    shaftK = ahead && !inside ? POST.shaftK * (1 - smooth(0.55, 1.1, edge)) : 0;
    if (shaftK > 0.01) { const s = POST.mShaft.uniforms; s.tSrc.value = src; s.uSun.value.set(sx, sy); s.uAsp.value = POST.w / POST.h; pass(POST.mShaft, POST.shaft); }
  }
  F.tScene.value = src; F.tBloom.value = bloom || (mips[0] && mips[0].a.texture); F.tShaft.value = POST.shaft.texture;
  F.uBloom.value = bloom ? POST.bloomK : 0; F.uShaft.value = shaftK;
  F.uTx.value.set(1 / POST.w, 1 / POST.h); F.uAsp.value = POST.w / POST.h;
  const fx = q.fxaa && !POST.samples; F.uFxaa.value = fx ? 1 : 0; F.uSharp.value = !fx && POST.scale < 0.98 ? (1 - POST.scale) * 1.1 : 0;
  F.uVig.value = POST.vig; F.uSat.value = POST.sat; F.uCon.value = POST.con; F.uTime.value = (F.uTime.value + 0.618) % 64;
  pass(POST.mFinal, null);
  renderer.autoClear = ac;
}
/* the look follows the light: called from skyLight with the darkness, golden-hour and grey amounts */
function postLight(dark, golden, gray, fogK) {
  // lamps, headlights and windows glow more at night; by day only the sky and hot glints do
  POST.bloomK = lerp(0.28, 0.85, dark) * (1 - 0.25 * gray);
  POST.knee = lerp(0.74, 0.5, dark);
  POST.shaftK = 1.6 * (1 - gray) * (1 - smooth(0.2, 0.6, dark)) * lerp(0.55, 1.25, golden) / Math.max(1, fogK * 0.6);
  POST.sat = lerp(1.07, 1.0, dark) - 0.04 * gray;
  POST.con = lerp(1.035, 1.0, dark);
  POST.vig = lerp(0.16, 0.2, dark);
  const F = POST.mFinal && POST.mFinal.uniforms; if (!F) return;
  // warm sun shafts at golden hour, whiter at noon, cool by moonlight
  if (dark > 0.5) F.uShaftC.value.set(0.55, 0.65, 0.9); else F.uShaftC.value.set(1, lerp(0.92, 0.72, golden), lerp(0.8, 0.45, golden));
}
/* the Graphics tab says what Auto chose, and how the picture is being drawn right now */
function gfxNote() {
  const el = typeof document !== 'undefined' && document.getElementById('gfxNote'); if (!el || !POST.ready) return;
  const q = POST.q, auto = (GAME.settings.gfx || 'auto') === 'auto';
  const caa = !!(renderer.getContextAttributes && renderer.getContextAttributes().antialias);
  const aa = !q.post ? (caa ? 'smooth edges' : 'no anti-aliasing') : POST.samples ? `${POST.samples}x MSAA` : 'FXAA';
  el.textContent = `${auto ? `Auto chose ${q.name} for this device. ` : ''}${q.post ? `Bloom${q.shafts ? ', sun shafts' : ''}, colour grade and ${aa}. ` : `Effects off, ${aa}, drawn straight to the screen. `}` +
    `${q.post && POST.dyn ? 'Resolution scales itself (now ' + Math.round(POST.scale * 100) + '%) to keep the frame rate smooth.' : q.post ? 'Full resolution always.' : ''}` +
    `${!q.post && !caa ? ' Reload the page for smooth edges on Low.' : ''}`;
}

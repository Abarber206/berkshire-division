/* ============================================================================
   Sky, sun and moon on the clock, weather, smoke & steam particles, snow
   ========================================================================== */
const SKY = { hour: 6 + 40 / 60, weather: 'clear', dark: 0, night: false, look: {}, envKey: '', envAt: -1e9,
  // shared by every fogged material (see the fog chunks below): the sun's glow in the haze, and how
  // the haze thins with height. Plain objects, so each material's copy of the uniform is this one
  fogSun: { x: 0, y: 1, z: 0 }, fogSunC: { x: 0, y: 0, z: 0 }, fogHaze: { x: 0, y: 260, z: 1 } };   // haze base height, thinning scale (m), on
const WEATHER = {
  clear: { name: 'Clear', sub: 'Dry rail', mu: 0.27, fogK: 1, sunK: 1, cloud: 0.25, snow: 0, gray: 0 },
  overcast: { name: 'Overcast', sub: 'Damp rail', mu: 0.2, fogK: 1.9, sunK: 0.32, cloud: 0.95, snow: 0, gray: 0.55 },
  snow: { name: 'Snow', sub: 'Slippery, low visibility', mu: 0.15, fogK: 3.4, sunK: 0.25, cloud: 1, snow: 1, gray: 0.7 },
};

/* Haze that behaves like air: brighter and warmer looking toward the sun (light scattered forward
   by the haze, strongest at golden hour and twilight), and thinner higher up, so valleys hold
   more haze than ridge tops. Without these uniforms a material falls back to plain FogExp2. */
(function hazeChunks() {
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = C.fog_pars_vertex.replace('varying float fogDepth;', 'varying float fogDepth; varying vec3 vFogWorld;');
  C.fog_vertex = C.fog_vertex.replace('fogDepth = - mvPosition.z;', 'fogDepth = - mvPosition.z; vFogWorld = ( vec4( mvPosition.xyz, 0.0 ) * viewMatrix ).xyz;');
  C.fog_pars_fragment = C.fog_pars_fragment.replace('varying float fogDepth;', 'varying float fogDepth; varying vec3 vFogWorld; uniform vec3 fogSunDir; uniform vec3 fogSunColor; uniform vec3 fogHaze;');
  C.fog_fragment = `#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogH = max( 0.0, cameraPosition.y + vFogWorld.y * 0.5 - fogHaze.x );
    float fogD = fogDensity * mix( 1.0, 0.4 + 0.6 * exp( - fogH / max( fogHaze.y, 1.0 ) ), fogHaze.z );
    float fogFactor = 1.0 - exp( - fogD * fogD * fogDepth * fogDepth );
    float fogS = max( dot( normalize( vFogWorld ), fogSunDir ), 0.0 );
    vec3 fogC = fogColor + fogSunColor * ( pow( fogS, 10.0 ) * 0.55 + pow( fogS, 2.5 ) * 0.14 );
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogC, fogFactor );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, fogDepth );
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
  #endif
#endif`;
  const add = u => { if (u && u.fogColor) Object.assign(u, { fogSunDir: { value: SKY.fogSun }, fogSunColor: { value: SKY.fogSunC }, fogHaze: { value: SKY.fogHaze } }); };
  add(THREE.UniformsLib.fog);
  for (const k in THREE.ShaderLib) add(THREE.ShaderLib[k].uniforms);
})();

function buildSky(scene, renderer) {
  const uni = { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunC: { value: new THREE.Color() },
    uMoon: { value: new THREE.Vector3(0, -1, 0) }, uMoonC: { value: new THREE.Color() }, uGray: { value: 0 }, uNight: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: uni, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    // the sun's disc only above the horizon; its glow carries on below it through twilight
    fragmentShader: `uniform vec3 uTop,uHor,uSunC,uMoonC; uniform vec3 uSun,uMoon; uniform float uGray,uNight; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); float h = max(d.y, 0.0);
        vec3 c = mix(uHor, uTop, pow(h, 0.55));
        c = mix(c, uHor*0.55, smoothstep(0.0,-0.25,d.y));
        float s = max(dot(d, normalize(uSun)), 0.0), up = smoothstep(-0.01, 0.006, d.y);
        c += uSunC * (pow(s, 900.0)*6.0*(1.0-uGray)*up + pow(s, 12.0)*0.35*(1.0-uGray*0.7) + pow(s,3.0)*0.12);
        float m = max(dot(d, normalize(uMoon)), 0.0);
        c += uMoonC * (pow(m, 900.0)*6.0*(1.0-uGray) + pow(m, 12.0)*0.35*(1.0-uGray*0.7) + pow(m,3.0)*0.12);
        vec3 g = vec3(dot(c, vec3(0.3,0.5,0.2)));
        c = mix(c, g*vec3(0.95,0.98,1.03), uGray);
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(9000, 40, 20), mat);
  dome.renderOrder = -10; dome.frustumCulled = false;
  scene.add(dome);
  SKY.dome = dome; SKY.uni = uni;
  // clouds: big textured plane
  const ct = canvasTex(512, 512, (g, w, h) => {
    const id = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = Noise.fbm(x / 64, y / 64, 5) * 0.5 + 0.5; const n2 = Noise.fbm(x / 22 + 40, y / 22, 3) * 0.5 + 0.5;
      const a = clamp((n * 0.85 + n2 * 0.25 - 0.52) * 3.2, 0, 1);
      const i = (y * w + x) * 4; id.data[i] = id.data[i + 1] = id.data[i + 2] = 255; id.data[i + 3] = a * 255;
    }
    g.putImageData(id, 0, 0);
  }, { repeat: true });
  ct.repeat.set(5, 5);
  const cm = new THREE.MeshBasicMaterial({ map: ct, transparent: true, depthWrite: false, fog: false, opacity: 0.6 });
  const clouds = new THREE.Mesh(new THREE.PlaneGeometry(30000, 30000), cm); clouds.rotation.x = Math.PI / 2; clouds.position.y = 1600; clouds.renderOrder = -9; clouds.frustumCulled = false;
  scene.add(clouds); SKY.clouds = clouds;
  // stars over the whole sphere, turning about the pole star through the night; those near the
  // horizon dim out as starlight does through the thick air there
  const sp = [], mag = []; const r = rng(9);
  for (let i = 0; i < 3400; i++) { const u = r() * 2 - 1, a = r() * TAU, s = Math.sqrt(1 - u * u); sp.push(Math.cos(a) * s * 8000, u * 8000, Math.sin(a) * s * 8000); mag.push(Math.pow(r(), 3)); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setAttribute('aMag', new THREE.Float32BufferAttribute(mag, 1));
  SKY.starU = { uAlpha: { value: 0 }, uPx: { value: Math.min(devicePixelRatio, 2) }, uCol: { value: new THREE.Color(0xdfe8ff) } };
  SKY.stars = new THREE.Points(sg, new THREE.ShaderMaterial({
    uniforms: SKY.starU, transparent: true, depthWrite: false, fog: false,
    vertexShader: `#include <common>
      #include <logdepthbuf_pars_vertex>
      attribute float aMag; uniform float uAlpha, uPx; varying float vA;
      void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); float alt = normalize(wp.xyz - cameraPosition).y;
        vA = uAlpha * (0.35 + 0.65 * aMag) * smoothstep(-0.005, 0.14, alt);
        gl_PointSize = uPx * (1.1 + 1.6 * aMag); vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uCol; varying float vA;
      void main(){
        #include <logdepthbuf_fragment>
        vec2 q = gl_PointCoord - 0.5; float a = vA * smoothstep(0.5, 0.15, length(q)); if (a < 0.004) discard;
        gl_FragColor = vec4(uCol, a); }`,
  }));
  SKY.stars.renderOrder = -9; SKY.stars.frustumCulled = false; scene.add(SKY.stars);
  SKY.pole = new THREE.Vector3(0, Math.sin(DN.lat * Math.PI / 180), -Math.cos(DN.lat * Math.PI / 180));
  // moon
  const mt = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 10, 64, 64, 64); gr.addColorStop(0, 'rgba(255,250,235,1)'); gr.addColorStop(0.35, 'rgba(240,238,225,1)'); gr.addColorStop(0.42, 'rgba(200,210,235,0.35)'); gr.addColorStop(1, 'rgba(160,180,220,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  SKY.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: mt, fog: false, depthWrite: false, transparent: true })); SKY.moon.scale.set(520, 520, 1); SKY.moon.renderOrder = -8; scene.add(SKY.moon);
  // lights: one directional key light that is the sun by day and the moon by night (they swap
  // at sunset, when both are too faint to see), and the sky's fill
  SKY.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7); scene.add(SKY.hemi);
  SKY.sun = new THREE.DirectionalLight(0xffffff, 2.5);
  SKY.sun.castShadow = true;
  const mobile = /iPhone|iPad|Android/i.test(navigator.userAgent) || Math.min(screen.width, screen.height) < 600;
  SKY.sun.shadow.mapSize.set(mobile ? 1536 : 2048, mobile ? 1536 : 2048);
  const sc = SKY.sun.shadow.camera; sc.left = -42; sc.right = 42; sc.top = 42; sc.bottom = -42; sc.near = 10; sc.far = 600;
  SKY.sun.shadow.bias = -0.0006; SKY.sun.shadow.normalBias = 0.04;
  scene.add(SKY.sun); scene.add(SKY.sun.target);
  scene.fog = new THREE.FogExp2(0xcccccc, 0.0002);
  SKY.sunDir = new THREE.Vector3(0, 1, 0); SKY.moonDir = new THREE.Vector3(0, -1, 0); SKY.keyDir = new THREE.Vector3(0, 1, 0);
}

/* Set the clock to one of the menu's start times (timeKey), and/or the weather. Either may be null
   to leave it as it is. */
function applyLook(timeKey, weatherKey) {
  if (timeKey && DN.starts[timeKey]) SKY.hour = DN.starts[timeKey].h;
  if (weatherKey && WEATHER[weatherKey]) SKY.weather = weatherKey;
  const W = WEATHER[SKY.weather];
  SKY.snow = W.snow > 0; WORLD.snowU.value = W.snow;
  skyLight(true);
}
/* the clock: a job runs on its own railroad clock; otherwise time passes at the chosen rate */
function skyTick(dt) {
  if (JOB.run && !JOB.run.over) SKY.hour = dnWrap(JOB.clock() / 3600);
  else if (GAME.running && !S.paused) SKY.hour = dnWrap(SKY.hour + dt * ((DN.rates[GAME.settings.cycle] || DN.rates.x30).k) / 3600);
  skyLight(false);
}

const _skC = new THREE.Color(), _skC2 = new THREE.Color(), _skQ = new THREE.Quaternion();
/* everything the hour and weather decide: sky, sun or moon light, fog, exposure, stars, lit windows */
function skyLight(force) {
  const W = WEATHER[SKY.weather], h = SKY.hour;
  const sb = dnSun(h), mb = dnMoon(h);
  dnDir(sb, SKY.sunDir); dnDir(mb, SKY.moonDir);
  const L = dnLook(sb.el, SKY.look);
  const dark = dnDark(sb.el), gray = W.gray * lerp(1, 0.4, dark);
  Object.assign(SKY, { sunEl: sb.el, sunAz: sb.az, moonEl: mb.el, dark, night: dark > 0.5, gray });
  const u = SKY.uni;
  u.uTop.value.setHex(L.top); u.uHor.value.setHex(L.hor);
  if (W.gray) { u.uTop.value.lerp(_skC.setHex(mixHex(0x8e98a3, 0x0b0f16, dark)), W.gray * 0.8); u.uHor.value.lerp(_skC.setHex(mixHex(0xb9bec2, 0x121820, dark)), W.gray * 0.8); }
  u.uSun.value.copy(SKY.sunDir); u.uSunC.value.setHex(L.sun).multiplyScalar(smooth(-12, -1, sb.el));
  const mk = dnMoonK(sb.el, mb.el);
  u.uMoon.value.copy(SKY.moonDir); u.uMoonC.value.setHex(0x8ea6d6).multiplyScalar(0.25 * mk);
  u.uGray.value = gray; u.uNight.value = dark;
  // the key light
  const bySun = sb.el > -1.5;
  SKY.keyDir.copy(bySun ? SKY.sunDir : SKY.moonDir);
  SKY.sun.color.setHex(bySun ? L.sun : 0x8ea6d6).convertSRGBToLinear();
  SKY.sun.intensity = SKY.sunBase = (bySun ? L.sunI : 0.22 * mk) * W.sunK;
  SKY.hemi.color.setHex(L.hemiS).convertSRGBToLinear(); SKY.hemi.groundColor.setHex(L.hemiG).convertSRGBToLinear();
  SKY.hemi.intensity = SKY.hemiBase = L.hemiI * (W.gray ? 1.25 : 1);
  // haze
  _skC.setHex(L.fog); if (W.gray) _skC.lerp(_skC2.setHex(mixHex(0xb3b8bc, 0x0d1218, dark)), W.gray);
  scene.fog.color.copy(_skC).convertSRGBToLinear(); scene.fog.density = L.fogD * W.fogK;
  const glowDir = sb.el > -8 ? SKY.sunDir : SKY.moonDir;
  const glowK = (sb.el > -8 ? smooth(-8, -1, sb.el) * (1 - 0.6 * smooth(10, 40, sb.el)) : mk * 0.2) * (1 - gray * 0.85);
  _skC.setHex(sb.el > -8 ? L.sun : 0x8ea6d6).convertSRGBToLinear().multiplyScalar(glowK);
  Object.assign(SKY.fogSun, { x: glowDir.x, y: glowDir.y, z: glowDir.z }); Object.assign(SKY.fogSunC, { x: _skC.r, y: _skC.g, z: _skC.b });
  renderer.toneMappingExposure = L.exp;
  SKY.clouds.material.opacity = W.cloud * lerp(1, 0.25, dark); SKY.clouds.material.color.setHex(W.gray ? mixHex(0xb8bcc0, 0x1a2030, dark) : L.cloud);
  SKY.starU.uAlpha.value = W.gray ? 0 : 0.85 * dnStars(sb.el); SKY.stars.visible = SKY.starU.uAlpha.value > 0.003;
  SKY.stars.quaternion.copy(_skQ.setFromAxisAngle(SKY.pole, -h / 24 * TAU));
  SKY.moon.visible = mb.el > -1 && !W.gray; SKY.moon.material.opacity = 1 - 0.8 * smooth(-4, 8, sb.el);
  ENV.mu = W.mu * (SKY.night && !W.gray ? 0.92 : 1);
  // windows light up through dusk: not all at once, each material at its own darkness
  // (house and depot windows decide for themselves, window by window: see winMaterial)
  for (const m of SCN.winMats) { if (m.userData.perWindow) continue; const a = m.userData.litAt !== undefined ? m.userData.litAt : 0.3; m.emissiveIntensity = Math.max(smooth(a, a + 0.1, dark) * (m.userData.litI || 0.95), W.gray ? 0.15 : 0, m.userData.minI || 0); }
  RMAT.coachWin.emissiveIntensity = Math.max(smooth(0.15, 0.3, dark) * 1.2, W.gray ? 0.25 : 0);
  lampsLight(dark);
  const sm = L.smoke, gk = W.gray ? lerp(0.75, 1, dark) : 1;
  FX.light.setRGB(sm[0] * gk, sm[1] * gk, sm[2] * gk);
  // the environment map (a small canvas cube painted with the same sky): repainted only when the
  // light has moved enough to show, as it costs a few milliseconds
  const key = `${Math.round(sb.el * 1.5)}|${Math.round(sb.az / 5)}|${SKY.weather}|${bySun}`;
  const now = performance.now();
  if (force || (key !== SKY.envKey && now - SKY.envAt > 900)) {
    SKY.envKey = key; SKY.envAt = now;
    if (SKY.envCube) SKY.envCube.dispose();
    const kc = bySun ? u.uSunC.value : u.uMoonC.value;
    SKY.envCube = makeEnvCube(u.uTop.value, u.uHor.value, SKY.keyDir, kc, gray, mixHex(W.snow ? 0xc3c7cb : 0x55503e, 0x070707, dark));
    scene.environment = SKY.envCube;
  }
}
/* sky things that follow the camera, and the key light's shadow box over what we are looking at */
function skyFollow(cam, focus) {
  const c = cam.position;
  SKY.dome.position.copy(c); SKY.stars.position.copy(c);
  SKY.clouds.position.set(c.x, c.y + 1600, c.z);
  SKY.moon.position.copy(SKY.moonDir).multiplyScalar(7000).add(c);
  SKY.sun.target.position.copy(focus); SKY.sun.position.copy(focus).addScaledVector(SKY.keyDir, 300);
}

function makeEnvCube(top, hor, sun, sunC, gray, ground) {
  const S = 64, faces = [];
  const gC = new THREE.Color(ground);
  const dirs = [ (u, v) => [1, -v, -u], (u, v) => [-1, -v, u], (u, v) => [u, 1, v], (u, v) => [u, -1, -v], (u, v) => [u, -v, 1], (u, v) => [-u, -v, -1] ];
  const sn = sun.clone().normalize();
  for (let f = 0; f < 6; f++) {
    const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); const id = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = (x + 0.5) / S * 2 - 1, v = (y + 0.5) / S * 2 - 1; const d = dirs[f](u, v); const L = Math.hypot(d[0], d[1], d[2]); const dx = d[0] / L, dy = d[1] / L, dz = d[2] / L;
      let r, gg, b;
      if (dy >= 0) { const t = Math.pow(dy, 0.55); r = lerp(hor.r, top.r, t); gg = lerp(hor.g, top.g, t); b = lerp(hor.b, top.b, t); }
      else { const t = Math.min(1, -dy * 4); r = lerp(hor.r * 0.6, gC.r, t); gg = lerp(hor.g * 0.6, gC.g, t); b = lerp(hor.b * 0.6, gC.b, t); }
      const sd = Math.max(0, dx * sn.x + dy * sn.y + dz * sn.z);
      const k = (Math.pow(sd, 40) * 2.5 + Math.pow(sd, 6) * 0.35) * (1 - gray * 0.8);
      r += sunC.r * k; gg += sunC.g * k; b += sunC.b * k;
      const i = (y * S + x) * 4;
      id.data[i] = clamp(r, 0, 1) * 255; id.data[i + 1] = clamp(gg, 0, 1) * 255; id.data[i + 2] = clamp(b, 0, 1) * 255; id.data[i + 3] = 255;
    }
    g.putImageData(id, 0, 0); faces.push(c);
  }
  const t = new THREE.CubeTexture(faces); t.encoding = THREE.sRGBEncoding; t.needsUpdate = true;
  return t;
}

/* ----------------------- particles ----------------------- */
const FX = { light: new THREE.Color(1, 1, 1) };
function buildFX(scene) {
  const N = 2400;
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3), size = new Float32Array(N), alpha = new Float32Array(N), col = new Float32Array(N * 3);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1)); g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1)); g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  const tex = canvasTex(64, 64, (c) => { const gr = c.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64); }, { srgb: false });
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTex: { value: tex }, uScale: { value: 800 } }]),
    vertexShader: `#include <common>
      #include <fog_pars_vertex>
      #include <logdepthbuf_pars_vertex>
      attribute float aSize; attribute float aAlpha; attribute vec3 aColor; uniform float uScale; varying float vA; varying vec3 vC;
      void main(){ vA = aAlpha; vC = aColor; vec4 mvPosition = modelViewMatrix * vec4(position,1.0);
        gl_PointSize = min(900.0, aSize * uScale / max(0.2, -mvPosition.z)); gl_Position = projectionMatrix * mvPosition;
        #include <logdepthbuf_vertex>
        #include <fog_vertex>
      }`,
    fragmentShader: `#include <common>
      #include <fog_pars_fragment>
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D uTex; varying float vA; varying vec3 vC;
      void main(){
        #include <logdepthbuf_fragment>
        vec4 t = texture2D(uTex, gl_PointCoord); if (t.a * vA < 0.004) discard;
        gl_FragColor = vec4(vC, t.a * vA);
        #include <fog_fragment>
      }`,
    transparent: true, depthWrite: false, fog: true,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 5;
  scene.add(pts);
  Object.assign(FX, { N, g, pos, size, alpha, col, mat, pts, vel: new Float32Array(N * 3), age: new Float32Array(N).fill(1e9), life: new Float32Array(N), s0: new Float32Array(N), s1: new Float32Array(N), a0: new Float32Array(N), base: new Float32Array(N * 3), buoy: new Float32Array(N), drag: new Float32Array(N), next: 0 });
  // snow
  const SN = 3500, sp = new Float32Array(SN * 3), r = rng(3);
  for (let i = 0; i < SN; i++) { sp[i * 3] = (r() - 0.5) * 120; sp[i * 3 + 1] = r() * 60; sp[i * 3 + 2] = (r() - 0.5) * 120; }
  const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  FX.snow = new THREE.Points(sgeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.16, transparent: true, opacity: 0.95, depthWrite: false, map: tex }));
  FX.snow.frustumCulled = false; FX.snow.visible = false; scene.add(FX.snow);
}
function emit(p, v, life, s0, s1, a0, c, buoy = 0.6, drag = 1.0) {
  const i = FX.next; FX.next = (FX.next + 1) % FX.N;
  FX.pos[i * 3] = p.x; FX.pos[i * 3 + 1] = p.y; FX.pos[i * 3 + 2] = p.z;
  FX.vel[i * 3] = v.x; FX.vel[i * 3 + 1] = v.y; FX.vel[i * 3 + 2] = v.z;
  FX.age[i] = 0; FX.life[i] = life; FX.s0[i] = s0; FX.s1[i] = s1; FX.a0[i] = a0;
  FX.base[i * 3] = c[0]; FX.base[i * 3 + 1] = c[1]; FX.base[i * 3 + 2] = c[2]; FX.buoy[i] = buoy; FX.drag[i] = drag;
}
function updateFX(dt, cam) {
  const w = ENV.wind, L = FX.light;
  for (let i = 0; i < FX.N; i++) {
    const age = FX.age[i];
    if (age > FX.life[i]) { if (FX.alpha[i] !== 0) { FX.alpha[i] = 0; } continue; }
    const t = age / FX.life[i];
    const k = 1 - Math.exp(-dt * FX.drag[i]);
    const j = i * 3;
    FX.vel[j] += (w.x - FX.vel[j]) * k; FX.vel[j + 1] += (FX.buoy[i] * (1 - t) - FX.vel[j + 1] * 0.6) * dt; FX.vel[j + 2] += (w.z - FX.vel[j + 2]) * k;
    FX.pos[j] += FX.vel[j] * dt; FX.pos[j + 1] += FX.vel[j + 1] * dt; FX.pos[j + 2] += FX.vel[j + 2] * dt;
    FX.size[i] = lerp(FX.s0[i], FX.s1[i], 1 - (1 - t) * (1 - t));
    FX.alpha[i] = FX.a0[i] * (1 - t) * (1 - t) * Math.min(1, age * 8);
    FX.col[j] = FX.base[j] * L.r; FX.col[j + 1] = FX.base[j + 1] * L.g; FX.col[j + 2] = FX.base[j + 2] * L.b;
    FX.age[i] = age + dt;
  }
  FX.g.attributes.position.needsUpdate = true; FX.g.attributes.aSize.needsUpdate = true; FX.g.attributes.aAlpha.needsUpdate = true; FX.g.attributes.aColor.needsUpdate = true;
  FX.mat.uniforms.uScale.value = innerHeight * (Math.min(devicePixelRatio, 2)) * 0.5 / Math.tan(cam.fov * Math.PI / 360);
  if (FX.snow.visible) {
    const p = FX.snow.geometry.attributes.position, a = p.array, c = cam.position;
    for (let i = 0; i < a.length; i += 3) {
      a[i + 1] -= dt * (1.1 + (i % 7) * 0.12); a[i] += dt * (w.x * 0.6 + Math.sin(i + S.time) * 0.3); a[i + 2] += dt * w.z * 0.6;
      if (a[i + 1] < c.y - 25) a[i + 1] += 55;
      const dx = a[i] - c.x, dz = a[i + 2] - c.z;
      if (dx > 60) a[i] -= 120; else if (dx < -60) a[i] += 120;
      if (dz > 60) a[i + 2] -= 120; else if (dz < -60) a[i + 2] += 120;
    }
    p.needsUpdate = true;
  }
}

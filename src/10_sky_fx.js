/* ============================================================================
   Sky, light presets, weather, smoke & steam particles, snow
   ========================================================================== */
const SKY = {};
const PRESETS = {
  morning: { name: 'Morning', sub: 'Low sun, long shadows', elev: 13, az: 118, top: 0x5f93d6, hor: 0xe9d3b4, sun: 0xffdcae, sunI: 2.7, hemiS: 0xb9cde8, hemiG: 0x4f4836, hemiI: 0.8, fog: 0xd9cfbe, fogD: 0.00017, exp: 1.0, night: false },
  noon: { name: 'Midday', sub: 'High sun, clear air', elev: 56, az: 170, top: 0x3e7dcf, hor: 0xbcd4ea, sun: 0xfff4e4, sunI: 2.6, hemiS: 0xc4d8f0, hemiG: 0x5d5845, hemiI: 0.6, fog: 0xc6d5e2, fogD: 0.00013, exp: 0.95, night: false },
  golden: { name: 'Golden hour', sub: 'Sun on the drivers', elev: 6.5, az: 252, top: 0x4c6ea6, hor: 0xf3ae6e, sun: 0xffad63, sunI: 2.3, hemiS: 0x9fb2d6, hemiG: 0x584430, hemiI: 0.8, fog: 0xe2b58e, fogD: 0.0002, exp: 1.05, night: false },
  night: { name: 'Night', sub: 'Headlight & firebox', elev: 28, az: 210, top: 0x03070f, hor: 0x162236, sun: 0x8ea6d6, sunI: 0.22, hemiS: 0x304060, hemiG: 0x141210, hemiI: 0.16, fog: 0x0a0f18, fogD: 0.00036, exp: 1.25, night: true },
};
const WEATHER = {
  clear: { name: 'Clear', sub: 'Dry rail', mu: 0.27, fogK: 1, sunK: 1, cloud: 0.25, snow: 0, gray: 0 },
  overcast: { name: 'Overcast', sub: 'Damp rail', mu: 0.2, fogK: 1.9, sunK: 0.32, cloud: 0.95, snow: 0, gray: 0.55 },
  snow: { name: 'Snow', sub: 'Slippery, low visibility', mu: 0.15, fogK: 3.4, sunK: 0.25, cloud: 1, snow: 1, gray: 0.7 },
};

function buildSky(scene, renderer) {
  const uni = { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunC: { value: new THREE.Color() }, uGray: { value: 0 }, uNight: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: uni, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 uTop,uHor,uSunC; uniform vec3 uSun; uniform float uGray,uNight; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); float h = max(d.y, 0.0);
        vec3 c = mix(uHor, uTop, pow(h, 0.55));
        c = mix(c, uHor*0.55, smoothstep(0.0,-0.25,d.y));
        float s = max(dot(d, normalize(uSun)), 0.0);
        c += uSunC * (pow(s, 900.0)*6.0*(1.0-uGray) + pow(s, 12.0)*0.35*(1.0-uGray*0.7) + pow(s,3.0)*0.12);
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
  // stars
  const sp = []; const r = rng(9);
  for (let i = 0; i < 2600; i++) { const u = r() * 2 - 1, a = r() * TAU, s = Math.sqrt(1 - u * u); const y = Math.abs(u); sp.push(Math.cos(a) * s * 8000, y * 8000 + 200, Math.sin(a) * s * 8000); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  SKY.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, depthWrite: false }));
  SKY.stars.renderOrder = -9; SKY.stars.frustumCulled = false; scene.add(SKY.stars);
  // moon
  const mt = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 10, 64, 64, 64); gr.addColorStop(0, 'rgba(255,250,235,1)'); gr.addColorStop(0.35, 'rgba(240,238,225,1)'); gr.addColorStop(0.42, 'rgba(200,210,235,0.35)'); gr.addColorStop(1, 'rgba(160,180,220,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  SKY.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: mt, fog: false, depthWrite: false, transparent: true })); SKY.moon.scale.set(520, 520, 1); SKY.moon.renderOrder = -8; scene.add(SKY.moon);
  // lights
  SKY.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7); scene.add(SKY.hemi);
  SKY.sun = new THREE.DirectionalLight(0xffffff, 2.5);
  SKY.sun.castShadow = true;
  const mobile = /iPhone|iPad|Android/i.test(navigator.userAgent) || Math.min(screen.width, screen.height) < 600;
  SKY.sun.shadow.mapSize.set(mobile ? 1536 : 2048, mobile ? 1536 : 2048);
  const sc = SKY.sun.shadow.camera; sc.left = -42; sc.right = 42; sc.top = 42; sc.bottom = -42; sc.near = 10; sc.far = 600;
  SKY.sun.shadow.bias = -0.0006; SKY.sun.shadow.normalBias = 0.04;
  scene.add(SKY.sun); scene.add(SKY.sun.target);
  scene.fog = new THREE.FogExp2(0xcccccc, 0.0002);
  SKY.pmrem = new THREE.PMREMGenerator(renderer);
  SKY.envScene = new THREE.Scene();
  SKY.envDome = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), mat.clone());
  SKY.envDome.material.depthTest = true;
  SKY.envScene.add(SKY.envDome);
  SKY.envGround = new THREE.Mesh(new THREE.CircleGeometry(48, 24), new THREE.MeshBasicMaterial({ color: 0x4a4636 })); SKY.envGround.rotation.x = -Math.PI / 2; SKY.envGround.position.y = -2; SKY.envScene.add(SKY.envGround);
}
function applyLook(timeKey, weatherKey, renderer, scene) {
  const P = PRESETS[timeKey], W = WEATHER[weatherKey];
  const el = P.elev * Math.PI / 180, az = P.az * Math.PI / 180;
  const sd = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  SKY.sunDir = sd;
  const gray = W.gray * (P.night ? 0.4 : 1);
  SKY.uni.uTop.value.set(P.top); SKY.uni.uHor.value.set(P.hor); SKY.uni.uSun.value.copy(sd); SKY.uni.uSunC.value.set(P.sun).multiplyScalar(P.night ? 0.25 : 1); SKY.uni.uGray.value = gray; SKY.uni.uNight.value = P.night ? 1 : 0;
  if (W.gray) { SKY.uni.uTop.value.lerp(new THREE.Color(P.night ? 0x0b0f16 : 0x8e98a3), W.gray * 0.8); SKY.uni.uHor.value.lerp(new THREE.Color(P.night ? 0x121820 : 0xb9bec2), W.gray * 0.8); }
  SKY.sun.color.set(P.sun); SKY.sun.intensity = P.sunI * W.sunK;
  SKY.hemi.color.set(P.hemiS); SKY.hemi.groundColor.set(P.hemiG); SKY.hemi.intensity = P.hemiI * (W.gray ? 1.25 : 1);
  SKY.sunBase = SKY.sun.intensity; SKY.hemiBase = SKY.hemi.intensity;
  const fogC = new THREE.Color(P.fog); if (W.gray) fogC.lerp(new THREE.Color(P.night ? 0x0d1218 : 0xb3b8bc), W.gray);
  scene.fog.color.copy(fogC).convertSRGBToLinear(); scene.fog.density = P.fogD * W.fogK;
  SKY.sun.color.convertSRGBToLinear(); SKY.hemi.color.convertSRGBToLinear(); SKY.hemi.groundColor.convertSRGBToLinear();
  renderer.toneMappingExposure = P.exp;
  SKY.clouds.material.opacity = W.cloud * (P.night ? 0.25 : 1); SKY.clouds.material.color.set(P.night ? 0x1a2030 : (W.gray ? 0xb8bcc0 : 0xffffff));
  SKY.stars.visible = P.night && !W.gray;
  SKY.moon.visible = P.night && !W.gray;
  SKY.moon.position.copy(sd).multiplyScalar(7000);
  SKY.sun.castShadow = !P.night;
  WORLD.snowU.value = W.snow;
  ENV.mu = W.mu * (P.night && !W.gray ? 0.92 : 1);
  SKY.night = P.night; SKY.snow = W.snow > 0; SKY.weather = weatherKey; SKY.time = timeKey;
  for (const m of SCN.winMats) m.emissiveIntensity = P.night ? 0.95 : (W.gray ? 0.15 : 0);
  RMAT.coachWin.emissiveIntensity = P.night ? 1.2 : (W.gray ? 0.25 : 0);
  // environment map: a small canvas cube painted with the same sky (robust on every GPU)
  if (SKY.envCube) SKY.envCube.dispose();
  SKY.envCube = makeEnvCube(SKY.uni.uTop.value, SKY.uni.uHor.value, sd, SKY.uni.uSunC.value, gray, P.night ? 0x070707 : (W.snow ? 0xc3c7cb : 0x55503e));
  scene.environment = SKY.envCube;
  const smokeK = P.night ? 0.25 : (W.gray ? 0.75 : 1);
  FX.light.setRGB(smokeK, smokeK * 0.98, smokeK * 0.95);
  if (timeKey === 'golden') FX.light.setRGB(1.05, 0.86, 0.7); if (timeKey === 'morning') FX.light.setRGB(1, 0.93, 0.84);
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

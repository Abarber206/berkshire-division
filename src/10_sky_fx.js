/* ============================================================================
   Sky, sun and moon on the clock, the weather's light, smoke & steam particles
   ========================================================================== */
const SKY = { hour: 6 + 40 / 60, weather: 'clear', dark: 0, night: false, look: {}, envKey: '', envAt: -1e9,
  // shared by every fogged material (see the fog chunks below): the sun's glow in the haze, and how
  // the haze thins with height. Plain objects, so each material's copy of the uniform is this one
  fogSun: { x: 0, y: 1, z: 0 }, fogSunC: { x: 0, y: 0, z: 0 }, fogHaze: { x: 0, y: 260, z: 1 } };   // haze base height, thinning scale (m), on
/* the weather itself (WEATHER, WX, the kinds and how they change) is in 10d_weather.js */

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
    vec3 fogC = fogColor + fogSunColor * ( pow( fogS, 12.0 ) * 0.3 + pow( fogS, 3.0 ) * 0.07 );
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

/* Two shadow cascades from the one sun. SKY.sun casts a sharp shadow over the 150 m round what we look at; SKY.sunFar
   (no light of its own, intensity 0) casts a coarse one 600 m across, so a whole train and the scenery beyond still
   have shadows. Every lit shader takes the near shadow inside the near box and fades to the far one at its edge,
   instead of multiplying the two (which would darken twice). Only active when both lights cast. */
(function cascadeChunks() {
  const C = THREE.ShaderChunk, one = 'getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] )';
  const mask = 'getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] )';
  if (!C.lights_fragment_begin.includes(one) || !C.shadowmask_pars_fragment.includes(mask)) { console.warn('shadow cascades: three.js chunks changed, using one cascade'); return; }
  C.shadowmap_pars_fragment += `
#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS >= 2
  float csmShadow() {
    vec3 c = vDirectionalShadowCoord[ 0 ].xyz / vDirectionalShadowCoord[ 0 ].w;
    vec2 e = abs( c.xy - 0.5 );
    float k = smoothstep( 0.4, 0.48, max( e.x, e.y ) );
    float n = k < 1.0 ? getShadow( directionalShadowMap[ 0 ], directionalLightShadows[ 0 ].shadowMapSize, directionalLightShadows[ 0 ].shadowBias, directionalLightShadows[ 0 ].shadowRadius, vDirectionalShadowCoord[ 0 ] ) : 1.0;
    float f = k > 0.0 ? getShadow( directionalShadowMap[ 1 ], directionalLightShadows[ 1 ].shadowMapSize, directionalLightShadows[ 1 ].shadowBias, directionalLightShadows[ 1 ].shadowRadius, vDirectionalShadowCoord[ 1 ] ) : 1.0;
    return mix( n, f, k );
  }
  #define CSM_PICK( I, S ) ( I == 0 ? csmShadow() : I == 1 ? 1.0 : S )
#else
  #define CSM_PICK( I, S ) ( S )
#endif`;
  C.lights_fragment_begin = C.lights_fragment_begin.replace(one, 'CSM_PICK( UNROLLED_LOOP_INDEX, ' + one + ' )');
  C.shadowmask_pars_fragment = C.shadowmask_pars_fragment.replace(mask, 'CSM_PICK( UNROLLED_LOOP_INDEX, ' + mask + ' )');
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
        // a small hot disc (the real sun is half a degree across), a tight corona round it and a soft
        // aureole in the haze; the old wide glow washed a third of the sky out to white
        float disc = smoothstep(0.99993, 0.99997, s);
        c += uSunC * ((disc*14.0 + pow(s, 2500.0)*2.0)*(1.0-uGray)*up + pow(s, 40.0)*0.22*(1.0-uGray*0.7) + pow(s, 8.0)*0.07);
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
  // one shadow box over what the camera looks at: 150 m across on a 4096 map (about 3.7 cm a texel), 120 m on
  // phones at 2048, so a whole cut of cars and the buildings round it are shadowed, not just the engine
  const big = !mobile && renderer.capabilities.maxTextureSize >= 4096;
  SKY.shadowHalf = mobile ? 60 : 75; SKY.shadowMap = big ? 4096 : 2048;
  SKY.sun.shadow.mapSize.set(SKY.shadowMap, SKY.shadowMap);
  const sh = SKY.shadowHalf, sc = SKY.sun.shadow.camera; sc.left = -sh; sc.right = sh; sc.top = sh; sc.bottom = -sh; sc.near = 10; sc.far = 700;
  SKY.sun.shadow.bias = -0.0006; SKY.sun.shadow.normalBias = 0.04;
  scene.add(SKY.sun); scene.add(SKY.sun.target);
  // the far cascade (see cascadeChunks): added right after the sun so it is shadow 1; it only casts, never lights
  SKY.farHalf = mobile ? 230 : 300;
  SKY.sunFar = new THREE.DirectionalLight(0x000000, 0); SKY.sunFar.castShadow = true;
  SKY.sunFar.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  const fc = SKY.sunFar.shadow.camera, fh = SKY.farHalf; fc.left = -fh; fc.right = fh; fc.top = fh; fc.bottom = -fh; fc.near = 10; fc.far = 1400;
  SKY.sunFar.shadow.bias = -0.0012; SKY.sunFar.shadow.normalBias = 0.3; SKY.sunFar.shadow.autoUpdate = false;
  SKY.farEvery = mobile ? 3 : 2; SKY.farTick = 0;
  scene.add(SKY.sunFar); scene.add(SKY.sunFar.target);
  scene.fog = new THREE.FogExp2(0xcccccc, 0.0002);
  SKY.sunDir = new THREE.Vector3(0, 1, 0); SKY.moonDir = new THREE.Vector3(0, -1, 0); SKY.keyDir = new THREE.Vector3(0, 1, 0);
}

/* Set the clock to one of the menu's start times (timeKey), and/or the weather. Either may be null
   to leave it as it is. */
function applyLook(timeKey, weatherKey) {
  if (timeKey && DN.starts[timeKey]) SKY.hour = DN.starts[timeKey].h;
  if (weatherKey && WEATHER[weatherKey]) { SKY.weather = weatherKey; wxSet(weatherKey, Date.now() % 1e6); if (CLOUD.on) CLOUD.fresh = 2; }
  wxGround();
  skyLight(true);
}
/* snow lies on the ground in winter: the grass is hidden and the ground goes white */
function wxGround() {
  SKY.snow = WX.season === 'winter'; WORLD.snowU.value = SKY.snow ? 1 : 0;
  if (FX.snow) FX.snow.visible = WX.P.snow > 0.01;
  if (typeof snowFrame === 'function') snowFrame();   // bare hardwoods, snow on the trees and trains (10i_snow.js)
}
/* the clock: a job runs on its own railroad clock; otherwise time passes at the chosen rate */
function skyTick(dt) {
  if (JOB.run && !JOB.run.over) SKY.hour = dnWrap(JOB.clock() / 3600);
  else if (GAME.running && !S.paused && !GAME.frostNight) SKY.hour = dnWrap(SKY.hour + dt * ((DN.rates[GAME.settings.cycle] || DN.rates.x30).k) / 3600);
  // the weather runs on real time whatever the clock does, so a spell lasts minutes at any clock rate
  if (!S.paused) { wxStep(dt, (1 - SKY.dark) * (1 - CLOUD.shade)); wxNews(); wxWind(dt); }
  if (typeof snowFrame === 'function') snowFrame();
  SKY.dt = dt;
  skyLight(false);
}
/* a word when the weather turns, and when the rail goes slippery */
function wxNews() {
  const c = WX.changed; if (!c || !GAME.running) return;
  const K = WX_KINDS[c.to], was = WX_KINDS[c.from];
  if (K.rain > 0 && !was.rain) toast(K.bolt ? 'A thunderstorm is coming in. Wet rail ahead: sand before she slips.' : 'Rain coming on. The rail will be greasy at first: use the sand.', 'warn', 5000, 'wx');
  else if (K.snow > 0 && !was.snow) toast('Snow starting. Slippery rail and poor visibility.', 'warn', 5000, 'wx');
  else if (c.to === 'fog') toast('Fog rolling in. Watch the signals.', '', 4000, 'wx');
  else if ((was.rain || was.snow) && !K.rain && !K.snow) toast('The rain is easing off. The rail will dry slowly.', '', 4000, 'wx');
}
/* the weather's wind: its strength, and a direction that veers slowly */
const WX_WIND = { a: 2.68 };
function wxWind(dt) {
  WX_WIND.a += dt * 0.004 * Math.sin(performance.now() * 0.00003);
  const k = WX.P.wind * (1 + 0.25 * Math.sin(performance.now() * 0.00041) * Math.sin(performance.now() * 0.00017));
  ENV.wind.set(Math.cos(WX_WIND.a) * k, 0, Math.sin(WX_WIND.a) * k);
}

const _skC = new THREE.Color(), _skC2 = new THREE.Color(), _skQ = new THREE.Quaternion();
/* everything the hour and weather decide: sky, sun or moon light, fog, exposure, stars, lit windows */
function skyLight(force) {
  const W = WX.P, h = SKY.hour, gk = clamp(W.gray / 0.55, 0, 1), fl = WX.flash;
  const sb = dnSun(h), mb = dnMoon(h);
  dnDir(sb, SKY.sunDir); dnDir(mb, SKY.moonDir);
  const L = dnLook(sb.el, SKY.look);
  const dark = dnDark(sb.el), gray = W.gray * lerp(1, 0.4, dark);
  Object.assign(SKY, { sunEl: sb.el, sunAz: sb.az, moonEl: mb.el, dark, night: dark > 0.5, gray });
  const u = SKY.uni;
  u.uTop.value.setHex(L.top); u.uHor.value.setHex(L.hor);
  if (W.gray > 0.005) { const sd = W.dark * 0.35; u.uTop.value.lerp(_skC.setHex(mixHex(mixHex(0x8e98a3, 0x5a6068, sd), 0x0b0f16, dark)), W.gray * 0.8); u.uHor.value.lerp(_skC.setHex(mixHex(mixHex(0xb9bec2, 0x80868c, sd), 0x121820, dark)), W.gray * 0.8); }
  if (fl > 0) { u.uTop.value.addScalar(fl * 0.35); u.uHor.value.addScalar(fl * 0.4); }
  u.uSun.value.copy(SKY.sunDir); u.uSunC.value.setHex(L.sun).multiplyScalar(smooth(-12, -1, sb.el));
  const mk = dnMoonK(sb.el, mb.el);
  u.uMoon.value.copy(SKY.moonDir); u.uMoonC.value.setHex(0x8ea6d6).multiplyScalar(0.25 * mk);
  u.uGray.value = gray; u.uNight.value = dark;
  // the key light
  const bySun = sb.el > -1.5;
  SKY.keyDir.copy(bySun ? SKY.sunDir : SKY.moonDir);
  SKY.sun.color.setHex(bySun ? L.sun : 0x8ea6d6).convertSRGBToLinear();
  // the sun through the weather, and dimmed while a cloud's shadow passes over us
  SKY.sunBase = (bySun ? L.sunI : 0.22 * mk) * W.sunK * (SKY.cloudSun === undefined ? 1 : SKY.cloudSun);
  SKY.sun.intensity = SKY.sunBase;
  SKY.hemi.color.setHex(L.hemiS).convertSRGBToLinear(); SKY.hemi.groundColor.setHex(L.hemiG).convertSRGBToLinear();
  SKY.hemi.intensity = SKY.hemiBase = L.hemiI * (1 + 0.25 * gk) * (1 - 0.3 * W.dark * (1 - dark)) + fl * 2.2;
  // haze
  _skC.setHex(L.fog); if (W.gray > 0.005) _skC.lerp(_skC2.setHex(mixHex(mixHex(0xb3b8bc, 0x8e9498, W.dark * 0.4), 0x0d1218, dark)), W.gray);
  if (fl > 0) _skC.addScalar(fl * 0.25);
  scene.fog.color.copy(_skC).convertSRGBToLinear(); scene.fog.density = L.fogD * W.fogK * 0.8;   // clear-day haze lets the far tree lines and towns show
  // in thick fog the sky itself is the fog: the dome and the clouds fade into it
  const fogSky = smooth(3, 40, W.fogK); SKY.fogSky = fogSky;
  if (fogSky > 0) { u.uTop.value.lerp(_skC, fogSky); u.uHor.value.lerp(_skC, fogSky); u.uGray.value = Math.max(u.uGray.value, fogSky); }
  // fog lies low in the valleys; ordinary haze thins slowly with height
  SKY.fogHaze.y = W.haze;
  const glowDir = sb.el > -8 ? SKY.sunDir : SKY.moonDir;
  const glowK = (sb.el > -8 ? smooth(-8, -1, sb.el) * (1 - 0.6 * smooth(10, 40, sb.el)) : mk * 0.2) * (1 - gray * 0.85);
  _skC.setHex(sb.el > -8 ? L.sun : 0x8ea6d6).convertSRGBToLinear().multiplyScalar(glowK);
  Object.assign(SKY.fogSun, { x: glowDir.x, y: glowDir.y, z: glowDir.z }); Object.assign(SKY.fogSunC, { x: _skC.r, y: _skC.g, z: _skC.b });
  renderer.toneMappingExposure = L.exp;
  if (typeof postLight === 'function') postLight(dark, smooth(-3, 3, sb.el) * (1 - smooth(9, 24, sb.el)), gray, W.fogK);
  SKY.starU.uAlpha.value = 0.85 * dnStars(sb.el) * (1 - 0.7 * gk); SKY.stars.visible = SKY.starU.uAlpha.value > 0.003;
  SKY.stars.quaternion.copy(_skQ.setFromAxisAngle(SKY.pole, -h / 24 * TAU));
  SKY.moon.visible = mb.el > -1; SKY.moon.material.opacity = 1 - 0.8 * smooth(-4, 8, sb.el);
  // dew on a clear night takes a little off the rail too
  ENV.mu = wxMu() * (SKY.night ? lerp(0.92, 1, gk) : 1);
  SKY.railWord = wxRailWord(ENV.mu);
  // windows light up through dusk: not all at once, each material at its own darkness
  // (house and depot windows decide for themselves, window by window: see winMaterial)
  for (const m of SCN.winMats) { if (m.userData.perWindow) continue; const a = m.userData.litAt !== undefined ? m.userData.litAt : 0.3; m.emissiveIntensity = Math.max(smooth(a, a + 0.1, dark) * (m.userData.litI || 0.95), 0.15 * gk, m.userData.minI || 0); }
  RMAT.coachWin.emissiveIntensity = Math.max(smooth(0.15, 0.3, dark) * 1.2, 0.25 * gk);
  lampsLight(dark);
  const sm = L.smoke, sk = lerp(1, lerp(0.75, 1, dark), gk) * (1 + fl);
  FX.light.setRGB(sm[0] * sk, sm[1] * sk, sm[2] * sk);
  cloudLight(L, dark, bySun, SKY.keyDir, bySun ? u.uSunC.value : u.uMoonC.value, gray);
  // the environment map (a small canvas cube painted with the same sky): repainted only when the
  // light has moved enough to show, as it costs a few milliseconds
  const key = `${Math.round(sb.el * 1.5)}|${Math.round(sb.az / 5)}|${Math.round(gray * 12)}|${SKY.snow}|${bySun}`;
  const now = performance.now();
  if (force || (key !== SKY.envKey && now - SKY.envAt > 900)) {
    SKY.envKey = key; SKY.envAt = now;
    if (SKY.envCube) SKY.envCube.dispose();
    const kc = bySun ? u.uSunC.value : u.uMoonC.value;
    SKY.envCube = makeEnvCube(u.uTop.value, u.uHor.value, SKY.keyDir, kc, gray, mixHex(SKY.snow ? 0xc3c7cb : mixHex(0x55503e, 0x3a382e, WX.wet), 0x070707, dark));
    scene.environment = SKY.envCube;
  }
}
/* sky things that follow the camera, and the key light's shadow box over what we are looking at */
function skyFollow(cam, focus) {
  const c = cam.position;
  SKY.dome.position.copy(c); SKY.stars.position.copy(c);
  if (CLOUD.lay) CLOUD.lay.position.copy(c);
  SKY.cloudSun = cloudSunAt(focus, SKY.dt || 0.016);
  SKY.moon.position.copy(SKY.moonDir).multiplyScalar(7000).add(c);
  shadowCentre(cam, focus, _skSc);
  SKY.sun.target.position.copy(_skSc); SKY.sun.position.copy(_skSc).addScaledVector(SKY.keyDir, 350);
  if (SKY.sunFar) {   // the far cascade, redrawn every 2nd frame (3rd on phones)
    shadowCentre(cam, focus, _skSc, SKY.farHalf, SKY.sunFar.shadow.mapSize.x);
    SKY.sunFar.target.position.copy(_skSc); SKY.sunFar.position.copy(_skSc).addScaledVector(SKY.keyDir, 700);
    if (++SKY.farTick >= SKY.farEvery) { SKY.farTick = 0; SKY.sunFar.shadow.needsUpdate = true; }
  }
}
/* the shadow box centre: pushed out ahead of the camera so the box covers what is in view (pulled back toward
   the focus when looking down), then snapped to whole shadow texels in the light's frame so edges don't crawl */
const _skSc = new THREE.Vector3(), _skR = new THREE.Vector3(), _skU = new THREE.Vector3(), _skF = new THREE.Vector3();
function shadowCentre(cam, focus, out, half, map) {
  const h = half || SKY.shadowHalf || 42;
  cam.getWorldDirection(_skF); const fl = Math.hypot(_skF.x, _skF.z);
  if (fl > 1e-3) { const ahead = h * 0.62 * fl; out.set(cam.position.x + _skF.x / fl * ahead, focus.y, cam.position.z + _skF.z / fl * ahead); }
  else out.copy(focus);
  // keep the thing we follow inside the box, whatever the camera does
  const dx = out.x - focus.x, dz = out.z - focus.z, d = Math.hypot(dx, dz), lim = h * 0.7;
  if (d > lim) { out.x = focus.x + dx / d * lim; out.z = focus.z + dz / d * lim; }
  const k = SKY.keyDir; _skR.set(0, 1, 0).cross(k); if (_skR.lengthSq() < 1e-6) _skR.set(1, 0, 0); _skR.normalize(); _skU.copy(k).cross(_skR).normalize();
  const tx = 2 * h / (map || SKY.shadowMap || 2048), a = out.dot(_skR), b = out.dot(_skU), c = out.dot(k);
  out.copy(_skR).multiplyScalar(Math.round(a / tx) * tx).addScaledVector(_skU, Math.round(b / tx) * tx).addScaledVector(k, c);
  return out;
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
/* Smoke and steam: one pool of point sprites. Each puff is drawn from an atlas of eight cells: four round
   billows (the thick rolling smoke right out of the stack) and four wisps (thin curling tendrils, the smoke
   pulled apart as it rises). A puff starts as a billow and, as it ages, turns into a wisp while a slow
   swirling flow twists it, so a plume is a dense column at the stack that breaks into curls and threads as it
   climbs and drifts. Each puff is lit like a volume: a rounded body with the atlas's bumps on it, bright on
   the sun side, shaded underneath and away from the sun, marbled light and dark through its thickness, and
   glowing at its thin edges when the sun is behind it. Puffs fade out as they reach the camera so they never
   smear across a cab window. */
function smokeAtlas() {
  const C = 128, SX = C * 4, SY = C * 2, data = new Uint8Array(SX * SY * 4), r = rng(77);
  const den = new Float32Array(C * C), tone = new Float32Array(C * C);
  const fbm = (x, y, o) => { let n = 0, amp = 0.5, f = 1; for (let k = 0; k < o; k++) { n += amp * vnoise2(x * f, y * f); amp *= 0.5; f *= 2.03; } return n; };
  for (let cell = 0; cell < 8; cell++) {
    den.fill(0);
    const wisp = cell >= 4, ox = r() * 50, oy = r() * 50, tx = r() * 50, ty = r() * 50;
    const blobs = [];
    for (let i = 0; i < (wisp ? 0 : 15); i++) { const a = r() * TAU, d = Math.sqrt(r()) * 0.46; blobs.push([Math.cos(a) * d, Math.sin(a) * d, 0.18 + r() * 0.24, 0.55 + r() * 0.45]); }
    for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) {
      const u = (x + 0.5) / C * 2 - 1, v = (y + 0.5) / C * 2 - 1, R = Math.hypot(u, v);
      let dd;
      if (!wisp) {
        // a billow: overlapping lumps with fine wisps eaten into the body
        let d = 0; for (const b of blobs) { const dx = u - b[0], dy = v - b[1]; d += b[3] * Math.exp(-(dx * dx + dy * dy) / (b[2] * b[2])); }
        const n = fbm(u * 3 + ox, v * 3 + oy, 4);
        dd = Math.max(0, Math.min(1, (d * 0.5) * (0.25 + 1.25 * n) - 0.08)) * smooth(1.0, 0.7, R);
      } else {
        // a wisp: the ridges of a twice-warped noise, so the smoke comes out as thin, curling, branching threads
        const wx = u * 1.6 + 1.3 * fbm(u * 1.4 + ox, v * 1.4 + oy, 3), wy = v * 1.6 + 1.3 * fbm(u * 1.4 + oy + 7, v * 1.4 + ox + 3, 3);
        const w2x = wx + 0.9 * fbm(wx * 2 + tx, wy * 2 + ty, 3), w2y = wy + 0.9 * fbm(wx * 2 + ty + 5, wy * 2 + tx + 9, 3);
        const ridge = 1 - Math.abs(2 * fbm(w2x + ox, w2y + oy, 4) - 1);
        const threads = Math.pow(ridge, 14) * 1.7 + Math.pow(ridge, 4) * 0.1;   // bright filaments in a faint haze
        dd = Math.min(1, Math.min(1, threads) * smooth(1.0, 0.45, R) * (0.75 + 0.5 * fbm(u * 2 + tx, v * 2 + ty, 2)));
      }
      den[y * C + x] = dd;
      tone[y * C + x] = fbm(u * 2.2 + tx, v * 2.2 + ty, 3);   // light and dark marbling through the smoke
    }
    const cx = (cell % 4) * C, cy = (cell >> 2) * C;
    for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) {
      const at = (xx, yy) => den[Math.min(C - 1, Math.max(0, yy)) * C + Math.min(C - 1, Math.max(0, xx))];
      const gx = at(x + 1, y) - at(x - 1, y), gy = at(x, y + 1) - at(x, y - 1);
      const k = 5, nl = Math.hypot(gx * k, gy * k, 1);
      const o = ((cy + y) * SX + cx + x) * 4;
      data[o] = Math.round((-gx * k / nl * 0.5 + 0.5) * 255);
      data[o + 1] = Math.round((gy * k / nl * 0.5 + 0.5) * 255);   // texture rows run down, the sprite's y runs up
      data[o + 2] = Math.round(clamp(tone[y * C + x] * 1.6 - 0.3, 0, 1) * 255);
      data[o + 3] = Math.round(den[y * C + x] * 255);
    }
  }
  const t = new THREE.DataTexture(data, SX, SY, THREE.RGBAFormat);
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  t.userData = { data, SX, SY, C };
  return t;
}
/* smooth 2D value noise for the atlas */
function vnoise2(x, y) {
  const h = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(h(i, j), h(i + 1, j), ux), lerp(h(i, j + 1), h(i + 1, j + 1), ux), uy);
}
/* how much smoke this machine draws: the pool is set by the device, the puffs per beat by the graphics setting */
const SMK_Q = { low: 0.45, medium: 0.7, high: 1, ultra: 1.25 };
function smkPool() { return (typeof GFX !== 'undefined' && GFX.lite) ? 3000 : 7000; }
function smkQuality() {
  const k = typeof POST !== 'undefined' && POST.key, q = SMK_Q[k] || 1;
  return (typeof GFX !== 'undefined' && GFX.lite) ? Math.min(q, 0.7) : q;
}
function buildFX(scene) {
  const N = smkPool();
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3), size = new Float32Array(N), alpha = new Float32Array(N), col = new Float32Array(N * 3), seed = new Float32Array(N), wisp = new Float32Array(N);
  for (let i = 0; i < N; i++) seed[i] = Math.random();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1)); g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1)); g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1)); g.setAttribute('aWisp', new THREE.BufferAttribute(wisp, 1));
  for (const k of ['position', 'aSize', 'aAlpha', 'aColor', 'aWisp']) g.attributes[k].setUsage(THREE.DynamicDrawUsage);
  const tex = smokeAtlas();
  const gl = renderer.getContext(), ptMax = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1] || 256;
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTex: { value: tex }, uScale: { value: 800 }, uMax: { value: Math.min(1024, ptMax) }, uSunV: { value: new THREE.Vector3(0, 1, 0) }, uSunK: { value: 1 }, uSunC: { value: new THREE.Color(1, 0.95, 0.85) }, uTime: { value: 0 } }]),
    vertexShader: `#include <common>
      #include <fog_pars_vertex>
      #include <logdepthbuf_pars_vertex>
      attribute float aSize; attribute float aAlpha; attribute vec3 aColor; attribute float aSeed; attribute float aWisp;
      uniform float uScale; uniform float uMax; varying float vA; varying vec3 vC; varying float vSeed; varying float vW;
      void main(){ vC = aColor; vSeed = aSeed; vW = aWisp; vec4 mvPosition = modelViewMatrix * vec4(position,1.0);
        float px = aSize * uScale / max(0.2, -mvPosition.z);
        // fade out as a puff reaches the camera, and as it outgrows the largest sprite the GPU will draw
        vA = aAlpha * smoothstep(0.6, 3.5, -mvPosition.z) * (1.0 - smoothstep(uMax * 0.8, uMax * 1.6, px));
        gl_PointSize = vA > 0.002 ? min(uMax, px) : 0.0; gl_Position = projectionMatrix * mvPosition;
        #include <logdepthbuf_vertex>
        #include <fog_vertex>
      }`,
    fragmentShader: `#include <common>
      #include <fog_pars_fragment>
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D uTex; uniform vec3 uSunV; uniform float uSunK; uniform vec3 uSunC; uniform float uTime;
      varying float vA; varying vec3 vC; varying float vSeed; varying float vW;
      void main(){
        #include <logdepthbuf_fragment>
        vec2 q = gl_PointCoord * 2.0 - 1.0; q.y = -q.y;
        float ang = vSeed * 6.2832 + uTime * (vSeed - 0.5) * (0.5 + vW * 0.6), cs = cos(ang), sn = sin(ang);
        vec2 rq = vec2(cs * q.x - sn * q.y, sn * q.x + cs * q.y);
        if (max(abs(rq.x), abs(rq.y)) > 0.97) discard;
        float cell = floor(vSeed * 4.0);
        vec2 cuv = (vec2(rq.x, -rq.y) * 0.5 + 0.5) * vec2(0.25, 0.5);
        vec4 tb = texture2D(uTex, cuv + vec2(cell * 0.25, 0.0));
        vec4 tw = vW > 0.01 ? texture2D(uTex, cuv + vec2(mod(cell + 1.0, 4.0) * 0.25, 0.5)) : tb;
        // a billow thins into its wisp: the threads stay while the body between them clears
        vec4 t = mix(tb, tw, vW); t.a = mix(tb.a, max(tw.a, tb.a * tw.a * 1.6), vW);
        float a = t.a * vA; if (a < 0.004) discard;
        // the billow's bumps, turned back to the screen, on a rounded body
        vec2 nt = t.rg * 2.0 - 1.0; nt = vec2(cs * nt.x + sn * nt.y, -sn * nt.x + cs * nt.y);
        vec3 n = normalize(vec3(q * 0.75 + nt * 0.9, sqrt(max(0.0, 1.0 - dot(q, q))) + 0.25));
        float lit = dot(n, uSunV) * 0.5 + 0.5;
        float shade = mix(0.62, 1.18, lit * lit) * mix(1.0, 0.82, t.a);    // thick middles darker
        vec3 c = vC * mix(0.78, 1.14, t.b) * mix(1.0, shade, uSunK) * mix(vec3(1.0), uSunC, uSunK * lit * 0.35);
        // the sun behind the smoke lights up its thin edges and threads
        float back = pow(max(0.0, -uSunV.z), 3.0) * (1.0 - t.a) * uSunK;
        c += vC * uSunC * back * (0.9 + 0.5 * vW);
        gl_FragColor = vec4(c, a);
        #include <fog_fragment>
      }`,
    transparent: true, depthWrite: false, fog: true,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 5;
  scene.add(pts);
  Object.assign(FX, { N, g, pos, size, alpha, col, wisp, mat, pts, vel: new Float32Array(N * 3), age: new Float32Array(N).fill(1e9), life: new Float32Array(N), s0: new Float32Array(N), s1: new Float32Array(N), a0: new Float32Array(N), base: new Float32Array(N * 3), buoy: new Float32Array(N), drag: new Float32Array(N), curl: new Float32Array(N), ph: new Float32Array(N), next: 0, t: 0 });
}
/* one puff. curl: how hard the swirling air twists it and how soon it pulls apart into wisps (0 keeps it a
   round billow all its life: diesel exhaust, steam from a cock or a valve) */
function emit(p, v, life, s0, s1, a0, c, buoy = 0.6, drag = 1.0, curl = 0) {
  const i = FX.next; FX.next = (FX.next + 1) % FX.N;
  FX.pos[i * 3] = p.x; FX.pos[i * 3 + 1] = p.y; FX.pos[i * 3 + 2] = p.z;
  FX.vel[i * 3] = v.x; FX.vel[i * 3 + 1] = v.y; FX.vel[i * 3 + 2] = v.z;
  FX.age[i] = 0; FX.life[i] = life; FX.s0[i] = s0; FX.s1[i] = s1; FX.a0[i] = a0;
  FX.base[i * 3] = c[0]; FX.base[i * 3 + 1] = c[1]; FX.base[i * 3 + 2] = c[2]; FX.buoy[i] = buoy; FX.drag[i] = drag;
  FX.curl[i] = curl; FX.ph[i] = Math.random() * 0.8;   // neighbours share the flow, so a plume twists as one rather than scattering
  return i;
}
/* Steam engine exhaust. One exhaust beat: a hard core of dark smoke shot up out of the stack and a ring of
   bigger, lighter billows rolling off it. inten 0..1.3 is how hard the engine is working, gv the grey of
   the smoke (dark when the fire is being forced), up the exhaust's speed out of the stack. */
const _smkV = new THREE.Vector3(), _smkP = new THREE.Vector3();
function smkBeat(at, tv, up, inten, gv, scale = 1) {
  const q = smkQuality() * scale, n = Math.max(2, Math.round((3 + 3 * Math.min(1, inten)) * q));
  const hard = Math.min(1, inten);
  for (let j = 0; j < n; j++) {
    const core = j === 0, sp = core ? 0.6 : 1.8 + hard;
    const g = clamp(gv * (core ? 0.82 : 0.9 + Math.random() * 0.28), 0.08, 1);   // light and dark puffs through the plume
    // spread along the jet, faster and slower, so a beat fills a stretch of the column and runs into the next one
    // instead of leaving the stack as one ball in a string of beads
    const f = core ? 0 : j / n, vk = core ? 1.1 : 0.45 + 0.6 * Math.random();
    _smkP.set(at.x + (Math.random() - 0.5) * 0.4 - tv.x * f * 0.12, at.y + f * up * 0.12, at.z + (Math.random() - 0.5) * 0.4 - tv.z * f * 0.12);
    _smkV.set(tv.x + (Math.random() - 0.5) * sp, up * vk, tv.z + (Math.random() - 0.5) * sp);
    emit(_smkP, _smkV, 9 + Math.random() * 6 + hard * 5, core ? 1.8 : 2.4, (core ? 11 : 15) + hard * 13 + Math.random() * 5,
      (core ? 0.85 : 0.62) + 0.2 * hard, [g, g * 0.985, g * 0.96], 0.95 + 0.3 * hard, 1.0, 0.9 + Math.random() * 0.5);
  }
}
/* An engine standing or drifting with the throttle shut: the blower draws a lazy column of thin grey smoke
   that rises, twists and curls away in threads. a 0..1 how much, g its grey. */
function smkDrift(at, tv, a, g, lift) {
  _smkV.set(tv.x + (Math.random() - 0.5) * 0.5, lift, tv.z + (Math.random() - 0.5) * 0.5);
  const gg = clamp(g * (0.88 + Math.random() * 0.26), 0.1, 1);
  emit(at, _smkV, 10 + Math.random() * 5, 1.6, 11 + Math.random() * 5, a, [gg, gg * 0.98, gg * 0.95], 0.85, 0.8, 1.4 + Math.random() * 0.4);
}
function updateFX(dt, cam) {
  const w = ENV.wind, L = FX.light, T = (FX.t += dt);
  for (let i = 0; i < FX.N; i++) {
    const age = FX.age[i];
    if (age > FX.life[i]) { if (FX.alpha[i] !== 0) { FX.alpha[i] = 0; FX.size[i] = 0; FX.wisp[i] = 0; } continue; }
    const t = age / FX.life[i];
    const k = 1 - Math.exp(-dt * FX.drag[i]);
    const j = i * 3;
    FX.vel[j] += (w.x - FX.vel[j]) * k; FX.vel[j + 1] += (FX.buoy[i] * (1 - t) - FX.vel[j + 1] * 0.6) * dt; FX.vel[j + 2] += (w.z - FX.vel[j + 2]) * k;
    let px = FX.pos[j] + FX.vel[j] * dt, py = FX.pos[j + 1] + FX.vel[j + 1] * dt, pz = FX.pos[j + 2] + FX.vel[j + 2] * dt;
    const cu = FX.curl[i];
    if (cu > 0) {
      // swirling air: a slowly changing rotational flow (the curl of a few sines) that is gentle at the stack and
      // grows as the plume loses its push, so the smoke rolls, twists and curls instead of rising in a cone
      const ph = FX.ph[i], A = cu * (0.3 + 1.5 * t) * dt, x = px * 0.11, y = py * 0.13, z = pz * 0.11, s = T * 0.35 + ph;
      const a1 = Math.sin(y + s) + Math.cos(z * 1.7 - s * 0.6), b1 = Math.sin(z + s * 0.8) + Math.cos(x * 1.9 + s * 0.5), c1 = Math.sin(x * 1.3 - s * 0.7) + Math.cos(y * 1.6 + s);
      px += (Math.cos(y * 1.6 + s) - b1 * 0.5) * A * 1.4;
      py += (Math.sin(x * 1.3 + s * 0.9) - c1 * 0.3) * A * 0.7;
      pz += (Math.cos(x * 1.9 - s) - a1 * 0.5) * A * 1.4;
      FX.wisp[i] = 0.72 * smooth(0.15, 0.8, t * Math.min(1.4, cu));   // the body never quite clears: wisps on a soft haze
    }
    FX.pos[j] = px; FX.pos[j + 1] = py; FX.pos[j + 2] = pz;
    const grow = cu > 0 ? 1 - Math.pow(1 - t, 3.5) : 1 - (1 - t) * (1 - t);   // smoke swells fast as it leaves the stack, then slowly
    FX.size[i] = lerp(FX.s0[i], FX.s1[i], grow);
    // full strength almost as it leaves the stack, holding thick for the first part of its climb, then thinning away
    const fade = cu > 0 ? (1 - smooth(0.3, 1, t)) * (1 - 0.3 * t) : (1 - t) * (1 - t);
    FX.alpha[i] = FX.a0[i] * fade * Math.min(1, age * 25);
    // smoke spreads and lightens as it mixes with the air
    const lift = cu > 0 ? 0.45 * t : 0, gl = 0.78;
    FX.col[j] = lerp(FX.base[j], gl, lift) * L.r; FX.col[j + 1] = lerp(FX.base[j + 1], gl, lift) * L.g; FX.col[j + 2] = lerp(FX.base[j + 2], gl * 0.99, lift) * L.b;
    FX.age[i] = age + dt;
  }
  const A = FX.g.attributes;
  A.position.needsUpdate = true; A.aSize.needsUpdate = true; A.aAlpha.needsUpdate = true; A.aColor.needsUpdate = true; A.aWisp.needsUpdate = true;
  const U = FX.mat.uniforms;
  U.uScale.value = innerHeight * ppPx() * 0.5 / Math.tan(cam.fov * Math.PI / 360);
  // the key light in view space, how strong it is through the weather, and its colour
  cam.updateMatrixWorld(); U.uSunV.value.copy(SKY.keyDir).transformDirection(cam.matrixWorldInverse);
  U.uSunK.value = clamp((SKY.sun.intensity || 0) / 2.2, 0, 1) * (1 - 0.8 * (SKY.gray || 0)) * (1 - 0.7 * (SKY.dark || 0));
  U.uSunC.value.copy(SKY.sun.color);
  U.uTime.value += dt;
}

/* ============================================================================
   Volumetric clouds, rain and snow, lightning, wet ground.

   Clouds: the sky is ray-marched through a slab of cloud (its cover, base,
   depth and shape set by the weather) into a small panorama of the sky round
   the camera: every direction above the horizon, finer near the horizon where
   the clouds stand closest together. Each frame marches the whole panorama
   with a fresh jitter and blends it into the last one, so a few steps a frame
   add up to a smooth, deep picture. The panorama is laid over the sky dome
   behind everything else (it hides the sun, moon and stars behind cloud), and
   a touch of fine noise breaks up the cloud edges at full screen resolution.
   Light: sunlight (or moonlight) through the cloud with forward scattering, so
   edges toward the sun glow silver and storm bases go dark; sky light from
   above; lightning lights the cloud from within.

   Phones march a smaller panorama with fewer steps, every other frame.
   ========================================================================== */
const CLOUD = { on: false, frame: 0, drift: { x: 0, z: 0 }, shade: 0, wetLook: 0, camV: new THREE.Vector3(), lastCam: null };

function cloudNoiseTex() {
  // 256 x 256 random values; green is red moved by (37, 17), so one lookup gives two z slices of 3D noise
  const N = 256, r = rng(77), v = new Uint8Array(N * N), d = new Uint8Array(N * N * 4);
  for (let i = 0; i < v.length; i++) v[i] = Math.floor(r() * 256);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (y * N + x) * 4;
    d[i] = v[y * N + x]; d[i + 1] = v[((y + 17) & 255) * N + ((x + 37) & 255)]; d[i + 2] = 0; d[i + 3] = 255;
  }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}
function cloudMapTex() {
  const M = WX_MAP.a ? WX_MAP : wxBuildMap(), N = M.n, d = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) { d[i * 4] = Math.round(M.a[i] * 255); d[i * 4 + 1] = Math.round(M.b[i] * 255); d[i * 4 + 3] = 255; }
  // the CPU copy reads the same 8-bit values the GPU sees, so the sun's shadow matches the clouds overhead
  for (let i = 0; i < N * N; i++) { M.a[i] = d[i * 4] / 255; M.b[i] = d[i * 4 + 1] / 255; }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}

const CLOUD_GLSL_NOISE = `
  float noise3( vec3 x ) {
    vec3 p = floor( x ), f = fract( x ); f = f * f * ( 3.0 - 2.0 * f );
    vec2 uv = p.xy + vec2( 37.0, 17.0 ) * p.z + f.xy;
    vec2 rg = texture2D( uNoise, ( uv + 0.5 ) / 256.0 ).rg;
    return mix( rg.x, rg.y, f.z );
  }`;

function buildClouds(scene) {
  const lite = GFX.lite;
  const W = lite ? 448 : 1024, H = lite ? 144 : 288, STEPS = lite ? 12 : 22;
  const opt = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false, generateMipmaps: false };
  const rts = [new THREE.WebGLRenderTarget(W, H, opt), new THREE.WebGLRenderTarget(W, H, opt)];
  for (const r of rts) { r.texture.wrapS = THREE.RepeatWrapping; r.texture.wrapT = THREE.ClampToEdgeWrapping; }
  const noise = cloudNoiseTex(), map = cloudMapTex();
  const U = {
    uMap: { value: map }, uNoise: { value: noise }, uPrev: { value: rts[1].texture }, uRes: { value: new THREE.Vector2(W, H) },
    uCam: { value: new THREE.Vector3() }, uDrift: { value: new THREE.Vector2() }, uEdge: { value: new THREE.Vector2(0.8, 1) }, uTile: { value: WX_MAP.tile },
    uBase: { value: 1500 }, uThick: { value: 800 }, uStrat: { value: 0 }, uDens: { value: 1 }, uDark: { value: 0 },
    uLight: { value: new THREE.Vector3(0, 1, 0) }, uLightC: { value: new THREE.Color(1, 1, 1) }, uAmbT: { value: new THREE.Color() }, uAmbB: { value: new THREE.Color() },
    uHor: { value: new THREE.Color() }, uFlash: { value: 0 }, uBlend: { value: 1 }, uFrame: { value: 0 }, uTime: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, depthTest: false, depthWrite: false,
    defines: { STEPS },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `varying vec2 vUv;
      uniform sampler2D uMap, uNoise, uPrev; uniform vec2 uRes, uDrift, uEdge;
      uniform vec3 uCam, uLight, uLightC, uAmbT, uAmbB, uHor;
      uniform float uTile, uBase, uThick, uStrat, uDens, uDark, uFlash, uBlend, uFrame, uTime;
      ${CLOUD_GLSL_NOISE}
      float hash( vec2 p ) { return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) ); }
      // the cloud's density at p: the map says where cloud stands; heaped clouds have flat bases and
      // rounded tops that narrow with height, a sheet is even; noise wears both into lumps and wisps
      float density( vec3 p, float fine ) {
        float h = ( p.y - uBase ) / uThick;
        if ( h <= 0.0 || h >= 1.0 ) return 0.0;
        // the map, warped a little so cloud edges never run straight up like walls
        vec2 w = vec2( noise3( p / 1700.0 ), noise3( p / 1700.0 + 19.7 ) ) - 0.5;
        vec2 m = texture2D( uMap, ( p.xz + uDrift + w * 900.0 ) / uTile ).rg;
        float c = smoothstep( uEdge.x, uEdge.y, m.r );
        float cu = smoothstep( 0.08 + h * 0.95, 0.3 + h * 0.95, c ) * smoothstep( 0.0, 0.05, h );
        // a sheet: its base and top undulate, thicker and thinner in broad patches
        float top = 0.45 + 0.55 * m.g, bot = 0.25 * ( 1.0 - m.g );
        float st = c * smoothstep( bot, bot + 0.15, h ) * smoothstep( top, top - 0.35, h ) * ( 0.55 + 0.45 * m.g );
        float d = mix( cu, st, uStrat );
        if ( d < 0.01 ) return 0.0;
        vec3 q = p + vec3( uDrift.x, -uTime * 2.0, uDrift.y );
        float n = noise3( q / 620.0 ) * 0.62;
        if ( fine > 0.01 ) n += ( noise3( q / 240.0 + 7.1 ) * 0.38 + ( noise3( q / 95.0 + 3.3 ) - 0.5 ) * 0.22 ) * fine;
        else n += 0.19;
        float wear = mix( 0.62, 0.32, uStrat );
        d = clamp( ( d - ( 1.0 - n ) * wear * ( 1.6 - d * 0.6 ) ) * 1.8, 0.0, 1.0 );
        return d * uDens;
      }
      float hg( float c, float g ) { float g2 = g * g; return ( 1.0 - g2 ) / pow( 1.0 + g2 - 2.0 * g * c, 1.5 ); }
      void main() {
        float a = ( vUv.x - 0.5 ) * 6.2831853, dy = vUv.y * vUv.y, hz = sqrt( max( 0.0, 1.0 - dy * dy ) );
        vec3 d = normalize( vec3( sin( a ) * hz, max( dy, 0.012 ), -cos( a ) * hz ) );
        float y0 = uBase, y1 = uBase + uThick, ta, tb;
        if ( uCam.y < y0 ) { ta = ( y0 - uCam.y ) / d.y; tb = ( y1 - uCam.y ) / d.y; }
        else { ta = 0.0; tb = max( 0.0, ( y1 - uCam.y ) / d.y ); }
        tb = min( tb, ta + mix( 9000.0, 16000.0, smoothstep( 0.3, 0.05, d.y ) ) );
        vec3 col = vec3( 0.0 ); float T = 1.0;
        if ( ta < 62000.0 && tb > ta ) {
          float ds = ( tb - ta ) / float( STEPS ), j = fract( hash( vUv * uRes ) + uFrame * 0.6180339 );
          float cosT = dot( d, uLight );
          float ph = min( mix( hg( cosT, 0.5 ), hg( cosT, -0.15 ), 0.5 ), 3.0 );
          float sig = 0.0042;
          vec3 l1 = uLight * uThick * 0.06, l2 = uLight * uThick * 0.18, l3 = uLight * uThick * 0.42;
          float far = smoothstep( 9000.0, 30000.0, ta );
          for ( int i = 0; i < STEPS; i++ ) {
            vec3 p = uCam + d * ( ta + ( float( i ) + j ) * ds );
            float den = density( p, 1.0 - far );
            if ( den > 0.002 ) {
              // light: how much cloud lies between here and the sun
              float od = ( density( p + l1, 0.0 ) * 0.06 + density( p + l2, 0.0 ) * 0.12 + density( p + l3, 0.0 ) * 0.24 ) * uThick;
              float beer = max( exp( -od * sig ), exp( -od * sig * 0.22 ) * 0.42 );
              float powder = 1.0 - 0.55 * exp( -den * 6.0 );
              float h = clamp( ( p.y - uBase ) / uThick, 0.0, 1.0 );
              vec3 amb = mix( uAmbB, uAmbT, h * 0.8 + 0.2 ) * mix( 1.0, 0.55, uDark * ( 1.0 - h ) );
              vec3 S = uLightC * beer * ph * powder + amb + vec3( 0.75, 0.8, 1.0 ) * uFlash * ( 0.6 + 0.6 * noise3( p / 900.0 ) );
              float dT = exp( -den * sig * ds );
              col += T * ( 1.0 - dT ) * S; T *= dT;
              if ( T < 0.02 ) break;
            }
          }
          // far cloud sinks into the haze on the horizon, and the farthest goes altogether
          float k = exp( -ta / 26000.0 );
          col = col * k + uHor * ( 1.0 - T ) * ( 1.0 - k );
          float gone = 1.0 - smoothstep( 38000.0, 62000.0, ta );
          col *= gone; T = 1.0 - ( 1.0 - T ) * gone;
        }
        vec4 cur = vec4( min( col, vec3( 1.3 ) ), 1.0 - T );
        gl_FragColor = mix( texture2D( uPrev, vUv ), cur, uBlend );
      }`,
  });
  const qs = new THREE.Scene(), qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false; qs.add(quad);
  // the layer over the sky: a sphere inside the far plane, drawn after the stars and moon
  const LU = { uPano: { value: rts[0].texture }, uNoise: { value: noise }, uCam: U.uCam, uDrift: U.uDrift, uBase: U.uBase, uDetail: { value: lite ? 0.6 : 1 }, uFade: { value: 1 } };
  const lay = new THREE.Mesh(new THREE.SphereGeometry(24000, 48, 24), new THREE.ShaderMaterial({
    uniforms: LU, side: THREE.BackSide, transparent: true, depthWrite: false, depthTest: true, fog: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    vertexShader: `#include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vDir; void main(){ vDir = position; vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 ); gl_Position = projectionMatrix * mvPosition;
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <common>
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D uPano, uNoise; uniform vec3 uCam; uniform vec2 uDrift; uniform float uBase, uDetail, uFade; varying vec3 vDir;
      ${CLOUD_GLSL_NOISE}
      void main(){
        #include <logdepthbuf_fragment>
        vec3 d = normalize( vDir ); if ( d.y < -0.03 ) discard;
        vec2 uv = vec2( atan( d.x, -d.z ) / 6.2831853 + 0.5, sqrt( clamp( d.y, 0.0, 1.0 ) ) );
        vec4 c = texture2D( uPano, uv );
        if ( c.a < 0.003 ) discard;
        // fine detail on the panorama's soft edges, fixed to the clouds as they drift
        vec2 q = ( d.xz * max( uBase - uCam.y, 200.0 ) / max( d.y, 0.04 ) + uCam.xz + uDrift ) / 130.0;
        float n = noise3( vec3( q, 0.0 ) ) * 0.65 + noise3( vec3( q * 2.7, 1.0 ) ) * 0.35;
        float e = c.a * ( 1.0 - c.a ) * 4.0 * uDetail * smoothstep( 0.02, 0.12, d.y );
        c *= clamp( 1.0 + ( n - 0.5 ) * 1.3 * e, 0.0, 1.5 );
        c.a = min( c.a, 1.0 );
        c *= smoothstep( -0.03, 0.004, d.y ) * uFade;
        gl_FragColor = c;
      }`,
  }));
  lay.renderOrder = -7; lay.frustumCulled = false; scene.add(lay);
  Object.assign(CLOUD, { on: true, W, H, STEPS, rts, U, LU, mat, qs, qc, lay, every: lite ? 2 : 1, ping: 0, fresh: 2 });
  buildPrecip(scene);
}
/* the cloud panorama for this frame: called before the scene is drawn */
function cloudRender(renderer, cam, dt) {
  if (!CLOUD.on) return;
  const P = WX.P, U = CLOUD.U, c = cam.position;
  // the clouds drift with the wind aloft, faster than it blows down here
  const wl = Math.hypot(ENV.wind.x, ENV.wind.z) || 1, sp = 10 + 4 * P.wind;
  CLOUD.drift.x -= ENV.wind.x / wl * sp * dt; CLOUD.drift.z -= ENV.wind.z / wl * sp * dt;
  U.uDrift.value.set(CLOUD.drift.x, CLOUD.drift.z); U.uTime.value += dt;
  U.uCam.value.copy(c);
  const [e0, e1] = wxCoverEdge(P.cover); U.uEdge.value.set(e0, e1);
  U.uBase.value = P.base; U.uThick.value = P.thick; U.uStrat.value = P.strat; U.uDens.value = P.dens; U.uDark.value = P.dark;
  U.uFlash.value = WX.flash;
  CLOUD.frame++;
  if (CLOUD.frame % CLOUD.every && !CLOUD.fresh) return;
  U.uFrame.value = CLOUD.frame % 1000;
  // a big jump (a new weather picked, the camera moved far) starts the picture afresh; otherwise blend in
  if (CLOUD.lastCam && CLOUD.lastCam.distanceTo(c) > 400) CLOUD.fresh = 2;
  CLOUD.lastCam = (CLOUD.lastCam || new THREE.Vector3()).copy(c);
  U.uBlend.value = CLOUD.fresh ? 1 : (CLOUD.every > 1 ? 0.22 : 0.12);
  if (CLOUD.fresh) CLOUD.fresh--;
  const src = CLOUD.rts[CLOUD.ping], dst = CLOUD.rts[1 - CLOUD.ping];
  U.uPrev.value = src.texture;
  const prevRT = renderer.getRenderTarget(), ac = renderer.autoClear;
  renderer.setRenderTarget(dst); renderer.autoClear = false; renderer.render(CLOUD.qs, CLOUD.qc);
  renderer.setRenderTarget(prevRT); renderer.autoClear = ac;
  CLOUD.LU.uPano.value = dst.texture; CLOUD.ping = 1 - CLOUD.ping;
}
/* the light on the clouds, from the sky's look this hour (called from skyLight) */
function cloudLight(L, dark, bySun, keyDir, keyC, gray) {
  if (!CLOUD.on) return;
  const U = CLOUD.U, su = SKY.uni;
  U.uLight.value.copy(keyDir);
  // sunlight in the sky's own units: about 1 for a white noon cloud; the moon lights them faintly
  const sunUp = bySun ? smooth(-3, 4, SKY.sunEl) : 1;
  U.uLightC.value.copy(keyC).multiplyScalar((bySun ? 0.78 : 1.3) * sunUp * lerp(1, 0.55, WX.P.dark));
  U.uAmbT.value.copy(su.uHor.value).lerp(su.uTop.value, 0.35).multiplyScalar(lerp(0.95, 0.75, gray));
  U.uAmbB.value.copy(su.uHor.value).multiplyScalar(0.55).lerp(_skC.setHex(L.hemiG), 0.3);
  if (gray > 0.3) { const g = (U.uAmbT.value.r + U.uAmbT.value.g + U.uAmbT.value.b) / 3; U.uAmbT.value.lerp(_skC.setRGB(g, g, g * 1.03), gray * 0.6); }
  U.uHor.value.copy(su.uHor.value);
  CLOUD.LU.uFade.value = 1 - (SKY.fogSky || 0);
}
/* how much of the sun the cloud overhead lets through to where we are (0 under a thick cloud, 1 in sun) */
function cloudSunAt(p, dt) {
  const P = WX.P, k = SKY.keyDir;
  let shade = 0;
  if (k.y > 0.03) {
    const hgt = P.base + P.thick * 0.35 - p.y, t = hgt / k.y;
    shade = wxCoverAt(p.x + k.x * t, p.z + k.z * t, P.cover, CLOUD.drift) * Math.min(1, 0.7 + P.dens * 0.3);
  } else shade = P.cover;
  CLOUD.shade += (shade - CLOUD.shade) * Math.min(1, dt * 1.2);
  return 1 - 0.8 * CLOUD.shade;
}

/* ---------------- rain and snow: drops in a box round the camera, moved on the GPU ---------------- */
const PRECIP = { rain: null, snow: null };
function buildPrecip(scene) {
  const lite = GFX.lite, box = 46, high = 30;
  const mk = (n, verts, lines) => {
    const seed = new Float32Array(n * verts * 4), end = new Float32Array(n * verts), pos = new Float32Array(n * verts * 3), r = rng(lines ? 5 : 6);
    for (let i = 0; i < n; i++) { const s = [r(), r(), r(), r()]; for (let v = 0; v < verts; v++) { seed.set(s, (i * verts + v) * 4); end[i * verts + v] = v; } }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4)); g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    return g;
  };
  const U = {
    uCam: { value: new THREE.Vector3() }, uCamV: { value: new THREE.Vector3() }, uWind: { value: new THREE.Vector3() }, uTime: { value: 0 }, uAmt: { value: 0 },
    uBox: { value: new THREE.Vector3(box, high, box) }, uShelter: { value: 0 }, uCol: { value: new THREE.Color(0.7, 0.72, 0.75) }, uPx: { value: 600 },
  };
  const common = `
    attribute vec4 aSeed; attribute float aEnd; uniform vec3 uCam, uCamV, uWind, uBox; uniform float uTime, uAmt, uShelter, uPx; varying float vA;
    vec3 dropAt( vec3 vel, float wob ) {
      vec3 o = uCam - uBox * vec3( 0.5, 0.62, 0.5 );
      vec3 p = aSeed.xyz * uBox + vel * uTime;
      p.x += sin( uTime * 1.3 + aSeed.w * 40.0 ) * wob; p.z += cos( uTime * 1.1 + aSeed.w * 31.0 ) * wob;
      return mod( p - o, uBox ) + o;
    }`;
  const fragC = `uniform vec3 uCol; varying float vA; void main(){ if ( vA < 0.01 ) discard; gl_FragColor = vec4( uCol, vA ); }`;
  const rainMat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false,
    vertexShader: `#include <common>
      #include <logdepthbuf_pars_vertex>
      ${common}
      void main(){
        vec3 vel = vec3( uWind.x, -9.0 - aSeed.w * 2.5, uWind.z );
        vec3 p = dropAt( vel, 0.0 );
        // the streak a drop leaves in a twentieth of a second, as seen from the moving camera
        vec3 rel = vel - uCamV; p -= rel * 0.045 * aEnd;
        vec3 r = p - uCam; float dist = length( r );
        float on = step( aSeed.w, uAmt ) * smoothstep( uShelter, uShelter + 1.5, dist );
        vA = on * ( 0.45 + 0.35 * aSeed.y ) * ( 1.0 - smoothstep( 8.0, 22.0, dist ) ) * ( 1.0 - aEnd * 0.6 );
        vec4 mvPosition = viewMatrix * vec4( p, 1.0 ); gl_Position = projectionMatrix * mvPosition;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <common>
      #include <logdepthbuf_pars_fragment>
      ${fragC.replace('void main(){', 'void main(){\n#include <logdepthbuf_fragment>\n')}`,
  });
  const NR = lite ? 4000 : 12000;
  PRECIP.rain = new THREE.LineSegments(mk(NR, 2, true), rainMat);
  const flake = canvasTex(32, 32, (c) => { const gr = c.createRadialGradient(16, 16, 1, 16, 16, 15); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 32, 32); }, { srgb: false });
  const snowMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uTex: { value: flake } }, U), transparent: true, depthWrite: false,
    vertexShader: `#include <common>
      #include <logdepthbuf_pars_vertex>
      ${common}
      void main(){
        vec3 vel = vec3( uWind.x * 0.8, -1.0 - aSeed.w * 0.5, uWind.z * 0.8 );
        vec3 p = dropAt( vel, 0.6 );
        float dist = length( p - uCam );
        vA = step( aSeed.w, uAmt ) * smoothstep( uShelter, uShelter + 1.5, dist ) * ( 1.0 - smoothstep( 16.0, 23.0, dist ) );
        vec4 mvPosition = viewMatrix * vec4( p, 1.0 ); gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = clamp( uPx * ( 0.05 + 0.04 * aSeed.y ) / max( 0.3, -mvPosition.z ), 1.0, 40.0 );
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <common>
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D uTex; uniform vec3 uCol; varying float vA;
      void main(){
        #include <logdepthbuf_fragment>
        float a = vA * texture2D( uTex, gl_PointCoord ).a; if ( a < 0.01 ) discard; gl_FragColor = vec4( min( uCol * 1.6, vec3( 1.0 ) ), min( 1.0, a * 1.3 ) ); }`,
  });
  const NS = lite ? 3500 : 9000;
  PRECIP.snow = new THREE.Points(mk(NS, 1, false), snowMat);
  for (const o of [PRECIP.rain, PRECIP.snow]) { o.frustumCulled = false; o.renderOrder = 6; o.visible = false; scene.add(o); }
  PRECIP.U = U;
  FX.snow = PRECIP.snow;   // older code asks whether snow is showing
}
function precipFrame(cam, dt) {
  if (!PRECIP.U) return;
  const U = PRECIP.U, P = WX.P, c = cam.position;
  // the camera's own speed, so streaks slant past a moving train's windows
  if (CLOUD.lastV) { const v = _skV.subVectors(c, CLOUD.lastV).divideScalar(Math.max(dt, 1e-3)); if (v.length() < 120) CLOUD.camV.lerp(v, Math.min(1, dt * 8)); }
  CLOUD.lastV = (CLOUD.lastV || new THREE.Vector3()).copy(c);
  U.uCam.value.copy(c); U.uCamV.value.copy(CLOUD.camV); U.uTime.value += dt;
  U.uWind.value.set(ENV.wind.x * 1.4, 0, ENV.wind.z * 1.4);
  const inside = SKY.boreK || 0;
  U.uShelter.value = CAM.mode === 'cab' || (WALK.on && WALK.mode === 'ride') ? 3.2 : 0;
  U.uPx.value = innerHeight * Math.min(devicePixelRatio, 2) * 0.5 / Math.tan(cam.fov * Math.PI / 360);
  const lit = FX.light, b = lerp(0.62, 0.16, SKY.dark) * (1 + WX.flash * 2);
  U.uCol.value.setRGB(lit.r * b, lit.g * b, lit.b * b * 1.04);
  const rain = P.rain * (1 - inside), snow = P.snow * (1 - inside);
  U.uAmt.value = Math.max(rain, snow) * 1.0;
  PRECIP.rain.visible = rain > 0.01; PRECIP.snow.visible = snow > 0.01;
  // the wet look on the ground follows the rail's wetness
  CLOUD.wetLook = WX.wet;
  if (WORLD.wetU) WORLD.wetU.value = Math.min(1, WX.wet * 1.2) * (SKY.snow ? 0.3 : 1);
  if (MAT.rail) MAT.rail.roughness = 0.42 - 0.2 * WX.wet;
}
const _skV = new THREE.Vector3();

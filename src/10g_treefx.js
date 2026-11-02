/* ============================================================================
   Tree shadows and drifting leaves.
   Shadows: the visible trees never cast (a woodlot holds thousands of them). Instead the trees round the
   shadow box are copied into a few shadow-only instanced meshes, rebuilt as the view moves: they are
   clipped away in the main pass and drawn only into the sun's shadow map, with their leaf cards turned to
   the sun and swaying in the same wind as the crowns. So only the nearest hundred or so trees cost anything,
   and they shade the ground, the track and the train under them, dappled through the gaps in the leaves.
   Leaves: a few hundred leaves blown about in a box round the camera, moved on the GPU. They ride the
   weather's wind, sink and swing as they fall and tumble end over end. There are more of them under trees,
   in a breeze and by day, few in open fields, and almost none in rain, snow, at night or in a tunnel.
   ========================================================================== */
const TSH = { meshes: {}, at: new THREE.Vector3(1e9, 0, 0), seen: -1, trees: 0, R: 0, cap: 0, list: [] };
const LEAF = { mesh: null, U: null, amt: 0, near: 0, drift: new THREE.Vector3() };

function buildTreeFX(scene) { buildTreeShadows(scene); buildLeaves(scene); }

/* ---------------- shadows ---------------- */
function treeShadowDepth() {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: FOL.tex || (FOL.tex = foliageTexture()), alphaTest: 0.45, side: THREE.DoubleSide });
  m.onBeforeCompile = sh => {
    sh.uniforms.uWind = WORLD.waterT; sh.uniforms.uWinter = FOL.winterU;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aLeaf; attribute vec3 aCorner; uniform float uWind, uWinter; float vBare;')
      // bare in winter, as the crowns are (04c): the twigs throw a thin web of shadow
      .replace('#include <uv_vertex>', '#include <uv_vertex>' + FOL_BARE_GLSL)
      // the same breath of wind as foliageShader (04c), so a shadow moves with its crown
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { float ph = instanceMatrix[3].x * 0.21 + instanceMatrix[3].z * 0.17;
          float w = aLeaf * max(position.y - 1.0, 0.0) * 0.012 * (sin(uWind * 1.3 + ph) + 0.4 * sin(uWind * 3.1 + ph * 2.0 + position.x));
          transformed.x += w; transformed.z += w * 0.7; }`)
      // leaf cards face the light here, as they face the camera in the main pass
      .replace('#include <project_vertex>', `#include <project_vertex>
        if (aCorner.z > 0.5) { mvPosition.xy += aCorner.xy * length(instanceMatrix[0].xyz); gl_Position = projectionMatrix * mvPosition; }`);
  };
  m.customProgramCacheKey = () => 'treeShadowDepth';
  return m;
}
function buildTreeShadows(scene) {
  if (typeof foliageGeos !== 'function') return;
  const G = foliageGeos();
  TSH.cap = GFX.lite ? 200 : 480; TSH.R = (SKY.shadowHalf || 64) * 1.2;   // reach the corners of the shadow box
  // drawn in the main pass as nothing: every vertex lands outside the clip box
  const none = new THREE.ShaderMaterial({ vertexShader: 'void main(){ gl_Position = vec4(position * 0.0 + vec3(0.0, 0.0, 3.0), 1.0); }', fragmentShader: 'void main(){ gl_FragColor = vec4(0.0); }', side: THREE.DoubleSide });
  const depth = treeShadowDepth();
  for (const k of ['dec', 'dec2', 'con', 'con2']) {
    const im = new THREE.InstancedMesh(G[k], none, TSH.cap);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.count = 0; im.castShadow = true; im.receiveShadow = false; im.frustumCulled = false;
    im.customDepthMaterial = depth; im.name = 'tree shadows ' + k; im.userData.treeShadow = true;
    scene.add(im); TSH.meshes[k] = im;
  }
}
/* the trees within R of p, nearest first, at most cap: [d2, mesh, index] (pure; tested) */
function tfxTreesNear(meshes, X, Z, R, cap) {
  const out = [], R2 = R * R;
  for (const m of meshes) {
    const fk = m.userData && m.userData.fk, sph = m.userData && m.userData.sph; if (!fk) continue;
    if (sph && Math.hypot(sph.center.x - X, sph.center.z - Z) > R + sph.radius) continue;
    const a = m.instanceMatrix.array;
    for (let i = 0; i < m.count; i++) {
      const dx = a[i * 16 + 12] - X, dz = a[i * 16 + 14] - Z, d2 = dx * dx + dz * dz;
      if (d2 < R2) out.push([d2, m, i]);
    }
  }
  out.sort((p, q) => p[0] - q[0]);
  if (out.length > cap) out.length = cap;
  return out;
}
function treeShadowRefresh(focus) {
  const M = TSH.meshes; if (!M.dec) return;
  // look a little toward the sun: the trees there throw their shadows into the box
  const kd = SKY.keyDir, h = Math.hypot(kd.x, kd.z), lean = h > 1e-3 ? Math.min(14, 6 * h / Math.max(0.25, kd.y)) / h : 0;
  const X = focus.x + kd.x * lean, Z = focus.z + kd.z * lean;
  const near = tfxTreesNear(WORLD.treeMeshes, X, Z, TSH.R, TSH.cap);
  for (const k in M) M[k].count = 0;
  for (const [, m, i] of near) {
    const s = M[m.userData.fk]; if (!s) continue;
    s.instanceMatrix.array.set(m.instanceMatrix.array.subarray(i * 16, i * 16 + 16), s.count * 16); s.count++;
  }
  for (const k in M) M[k].instanceMatrix.needsUpdate = true;
  TSH.trees = near.length; TSH.at.copy(focus); TSH.seen = WORLD.treeMeshes.length;
}

/* ---------------- leaves ---------------- */
function buildLeaves(scene) {
  const N = GFX.lite ? 280 : 720, r = rng(41);
  const base = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.setIndex(base.index); g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
  const s1 = new Float32Array(N * 4), s2 = new Float32Array(N * 4);
  for (let i = 0; i < N * 4; i++) { s1[i] = r(); s2[i] = r(); }
  for (let i = 0; i < N; i++) s1[i * 4 + 3] = (i + r()) / N;   // the order leaves appear in as the count rises
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(s1, 4)); g.setAttribute('aSeed2', new THREE.InstancedBufferAttribute(s2, 4));
  g.instanceCount = N;
  const pal = []; for (let i = 0; i < 5; i++) pal.push(new THREE.Color());
  const U = {
    uCam: { value: new THREE.Vector3() }, uDrift: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(44, 15, 44) },
    uFloor: { value: 0 }, uTime: { value: 0 }, uAmt: { value: 0 }, uShelter: { value: 0 }, uFlut: { value: 1 },
    uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunC: { value: new THREE.Color() }, uAmb: { value: new THREE.Color() }, uPal: { value: pal },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, side: THREE.DoubleSide,
    vertexShader: `#include <common>
      #include <logdepthbuf_pars_vertex>
      attribute vec4 aSeed; attribute vec4 aSeed2;
      uniform vec3 uCam, uDrift, uBox, uSun, uSunC, uAmb; uniform vec3 uPal[5];
      uniform float uFloor, uTime, uAmt, uShelter, uFlut;
      varying vec2 vUv; varying vec3 vCol;
      mat3 rotAxis(vec3 a, float t) {
        float s = sin(t), c = cos(t), o = 1.0 - c;
        return mat3(o * a.x * a.x + c, o * a.x * a.y + a.z * s, o * a.z * a.x - a.y * s,
                    o * a.x * a.y - a.z * s, o * a.y * a.y + c, o * a.y * a.z + a.x * s,
                    o * a.z * a.x + a.y * s, o * a.y * a.z - a.x * s, o * a.z * a.z + c);
      }
      void main(){
        vUv = uv;
        float t = uTime + aSeed2.w * 97.0, ph = aSeed.w * 51.0;
        // light leaves keep closer to the wind's speed; each sinks at its own rate and swings as it falls
        float ride = 0.55 + 0.45 * aSeed2.x, fall = 0.45 + 0.65 * aSeed2.y;
        vec3 p = aSeed.xyz * uBox + uDrift * ride - vec3(0.0, fall * uTime, 0.0);
        p.x += sin(t * (0.6 + 0.5 * aSeed.y) + ph) * 0.9 * uFlut;
        p.z += cos(t * (0.5 + 0.4 * aSeed.x) + ph * 1.3) * 0.9 * uFlut;
        p.y += sin(t * 1.9 + ph) * 0.18 * uFlut;
        vec3 o = vec3(uCam.x, uFloor, uCam.z) - uBox * vec3(0.5, 0.0, 0.5);
        p = mod(p - o, uBox) + o;
        float dist = length(p - uCam), hy = (p.y - uFloor) / uBox.y;
        float sz = (0.06 + 0.04 * aSeed2.z) * step(aSeed.w, uAmt)
          * smoothstep(uShelter, uShelter + 1.2, dist) * (1.0 - smoothstep(14.0, 20.5, dist))
          * smoothstep(0.0, 0.06, hy) * (1.0 - smoothstep(0.85, 1.0, hy));
        // tumbling end over end about an axis of its own, faster in a stronger wind
        vec3 ax = normalize(aSeed2.xyz * 2.0 - 1.0 + vec3(0.0, 0.0, 0.01));
        mat3 R = rotAxis(ax, t * (1.6 + 2.6 * aSeed.y) * (0.6 + 0.4 * uFlut) + ph);
        vec3 n = R * vec3(0.0, 0.0, 1.0);
        p += R * vec3(position.x * sz * 0.62, position.y * sz, 0.0);
        // season colour; thin leaves glow a little when the sun comes through them
        float k = aSeed.y * 4.999;
        vec3 c = k < 1.0 ? uPal[0] : k < 2.0 ? uPal[1] : k < 3.0 ? uPal[2] : k < 4.0 ? uPal[3] : uPal[4];
        c *= 0.85 + 0.3 * aSeed2.z;
        vCol = c * (uAmb + uSunC * (0.3 + 0.7 * abs(dot(n, uSun))));
        vec4 mvPosition = viewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <common>
      #include <logdepthbuf_pars_fragment>
      varying vec2 vUv; varying vec3 vCol;
      void main(){
        #include <logdepthbuf_fragment>
        // a pointed oval leaf on a short stalk, with a darker midrib
        float x = (vUv.x - 0.5) * 2.0, y = vUv.y * 2.2 - 1.15;
        float w = 0.95 * pow(max(0.0, 1.0 - y * y), 0.75);
        bool stalk = y < -0.95 && abs(x) < 0.07;
        if (abs(x) > w && !stalk) discard;
        vec3 c = vCol * (1.0 - 0.28 * (1.0 - smoothstep(0.0, 0.09, abs(x)))) * (0.82 + 0.18 * smoothstep(0.0, 0.6, w - abs(x) + 0.3));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  });
  LEAF.mesh = new THREE.Mesh(g, mat); LEAF.mesh.frustumCulled = false; LEAF.mesh.visible = false; LEAF.mesh.name = 'leaves';
  LEAF.U = U; LEAF.N = N; scene.add(LEAF.mesh);
}
/* sRGB leaf colours: turning hardwoods (as the woodlots in buildTrees), or dry winter leaves */
const LEAF_PAL = {
  autumn: [[0.42, 0.5, 0.2], [0.86, 0.64, 0.16], [0.82, 0.42, 0.12], [0.66, 0.2, 0.1], [0.56, 0.4, 0.2]],
  winter: [[0.5, 0.38, 0.24], [0.44, 0.33, 0.21], [0.58, 0.46, 0.3], [0.4, 0.3, 0.2], [0.52, 0.42, 0.28]],
};
/* how many of the leaves show (0..1), from the trees about, the wind, the weather and the hour (pure; tested) */
function leafAmount(trees, wind, P, dark, winter, inside) {
  const near = clamp(trees / 30, 0, 1);
  const w = clamp(0.4 + wind / 4, 0.5, 1.25);
  return clamp((0.1 + 0.9 * near) * w * (1 - 0.9 * Math.min(1, (P.rain || 0) * 1.6)) * (1 - Math.min(1, (P.snow || 0) * 2)) * lerp(1, 0.2, dark) * (winter ? 0.35 : 1) * (1 - inside), 0, 1);
}

/* ---------------- each frame ---------------- */
function treeFxFrame(cam, dt) {
  const focus = SKY.sun.target.position;
  if (TSH.meshes.dec) {
    const moved = Math.hypot(focus.x - TSH.at.x, focus.z - TSH.at.z);
    if (moved > 6 || TSH.seen !== WORLD.treeMeshes.length) treeShadowRefresh(focus);
  }
  if (!LEAF.U) return;
  const U = LEAF.U, c = cam.position, P = WX.P, wind = Math.hypot(ENV.wind.x, ENV.wind.z), winter = WX.season === 'winter';
  // the leaf count follows the trees round the camera (counted for the shadows), smoothed so it never jumps
  const tn = Math.hypot(c.x - TSH.at.x, c.z - TSH.at.z) < 90 ? TSH.trees : 0;
  LEAF.near += (tn - LEAF.near) * Math.min(1, dt * 0.4);
  const want = leafAmount(LEAF.near, wind, P, SKY.dark, winter, SKY.boreK || 0);
  LEAF.amt += (want - LEAF.amt) * Math.min(1, dt * 0.5);
  LEAF.mesh.visible = LEAF.amt > 0.01;
  if (!LEAF.mesh.visible) return;
  if (!S.paused) { U.uTime.value += dt; LEAF.drift.x += ENV.wind.x * 1.3 * dt; LEAF.drift.z += ENV.wind.z * 1.3 * dt; }
  U.uDrift.value.copy(LEAF.drift); U.uCam.value.copy(c); U.uAmt.value = LEAF.amt;
  U.uFloor.value = (typeof groundAt === 'function' ? groundAt(c.x, -c.z) : 0) - 1;
  U.uFlut.value = clamp(0.7 + wind * 0.12, 0.7, 1.5);
  U.uShelter.value = CAM.mode === 'cab' || (WALK.on && WALK.mode === 'ride') ? 3.2 : 0;
  // lit like the world: the key light (sun or moon) and the sky's fill
  U.uSun.value.copy(SKY.keyDir);
  U.uSunC.value.copy(SKY.sun.color).multiplyScalar(SKY.sun.intensity);
  U.uAmb.value.copy(SKY.hemi.color).multiplyScalar(0.75).add(_lfC.copy(SKY.hemi.groundColor).multiplyScalar(0.25)).multiplyScalar(SKY.hemi.intensity);
  const pal = LEAF_PAL[winter ? 'winter' : 'autumn'];
  for (let i = 0; i < 5; i++) U.uPal.value[i].setRGB(pal[i][0], pal[i][1], pal[i][2]).convertSRGBToLinear().multiplyScalar(0.75);
}
const _lfC = new THREE.Color();

/* ============================================================================
   Raven Lake scenery: the frozen lake itself (black ice swept clear in places
   and drifted over with snow in others, glinting under the moon), lanterns
   where the rails end at each shore, and the engine terminal at Hollow Pine.
   ========================================================================== */

/* ---------------- the ice ----------------
   One flat sheet at the ice level over the lake and its outlet (only the cells near the water; the land stands
   over the rest). Clear black ice with white bubbles and old frozen-over cracks in it, wind-blown drifts of snow
   lying in long streaks across it, more snow along the shores. Clear ice is nearly a mirror: the sky and the
   moon shine in it. */
const ICE_GLSL = `
  {
    vec2 xz = vIW.xz;
    // the wind came out of the north-west: drifts are long that way and narrow across
    vec2 q = vec2(dot(xz, vec2(0.80, 0.60)), dot(xz, vec2(-0.60, 0.80)));
    float d1 = texture2D(uDetail, q * vec2(0.0019, 0.0062) + 0.21).b, d2 = texture2D(uDetail, q * vec2(0.0072, 0.026) - 0.4).g;
    float d3 = texture2D(uDetail, xz * 0.0009 + 0.6).b;
    float snow = smoothstep(0.50, 0.66, d1 * 0.62 + d2 * 0.28 + d3 * 0.25 - 0.08 + vShore * 0.45);
    // a dusting on the clear ice, thicker toward the drifts
    float dust = smoothstep(0.35, 0.6, d2) * 0.25 + snow;
    // inside the clear ice: old cracks that froze over (white seams), and bubbles
    float c1 = texture2D(uDetail, xz * 0.011).r, c2 = texture2D(uDetail, xz * 0.047 + 0.3).g;
    float seam = (1.0 - smoothstep(0.0, 0.018, abs(c1 - 0.5))) * 0.8 + (1.0 - smoothstep(0.0, 0.012, abs(c2 - 0.5))) * 0.45;
    float fwI = fwidth(xz.x) + fwidth(xz.y);
    seam *= 1.0 - smoothstep(0.15, 0.9, fwI);
    float bub = smoothstep(0.72, 0.9, texture2D(uDetail, xz * 0.35).r) * (1.0 - smoothstep(0.05, 0.25, fwI));
    vec3 ice = vec3(0.010, 0.020, 0.030) + vec3(0.10, 0.13, 0.16) * (seam + bub * 0.5);
    vec3 sn = vec3(0.78, 0.82, 0.88) * (0.88 + 0.2 * d2);
    diffuseColor.rgb = mix(ice, sn, clamp(dust, 0.0, 1.0));
    vIceSnow = clamp(dust, 0.0, 1.0);
  }`;
function frIceMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 0.1, envMapIntensity: 0.9 });
  m.extensions = { derivatives: true };
  m.onBeforeCompile = sh => {
    sh.uniforms.uDetail = { value: TEX.detail };
    sh.uniforms.uMirror = MIR.U.uMirror; sh.uniforms.uMirrorM = MIR.U.uMirrorM; sh.uniforms.uMirrorOn = MIR.U.uMirrorOn;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aShore; varying float vShore; varying vec3 vIW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvShore = aShore; vIW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uDetail; uniform sampler2D uMirror; uniform mat4 uMirrorM; uniform float uMirrorOn; varying float vShore; varying vec3 vIW; float vIceSnow;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + ICE_GLSL)
      // clear ice is glassy (the moon and sky in it); snow is matte
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(0.06, 0.92, vIceSnow);')
      // the mirror image in the bare ice: stronger looking across it than down into it, rippled a touch by the surface
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        if (uMirrorOn > 0.5) {
          vec4 mp = uMirrorM * vec4(vIW + vec3(sin(vIW.z * 0.9) * 0.05, 0.0, sin(vIW.x * 0.7) * 0.05), 1.0);
          vec3 mc = texture2DProj(uMirror, mp).rgb;
          float fr = 0.25 + 0.6 * pow(1.0 - clamp(abs(dot(normalize(cameraPosition - vIW), vec3(0.0, 1.0, 0.0))), 0.0, 1.0), 3.0);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * 0.35 + mc, fr * (1.0 - vIceSnow) * (0.5 + 0.5 * vShore));
        }`);
  };
  m.customProgramCacheKey = () => 'frIce';
  return m;
}
function frBuildIce(scene) {
  const [x0, x1, n0, n1] = FROST.box, st = 20;
  const nx = Math.ceil((x1 - x0) / st), nn = Math.ceil((n1 - n0) / st);
  const D = new Float32Array((nx + 1) * (nn + 1));
  for (let j = 0; j <= nn; j++) for (let i = 0; i <= nx; i++) D[j * (nx + 1) + i] = frShore(x0 + i * st, n0 + j * st);
  const pos = [], sho = [], idx = [], vi = new Map();
  const vert = (i, j) => {
    const k = j * (nx + 1) + i; let v = vi.get(k); if (v !== undefined) return v;
    v = pos.length / 3; vi.set(k, v);
    pos.push(x0 + i * st, FROST.iceY, -(n0 + j * st)); sho.push(1 - smooth(-90, -5, D[k]));
    return v;
  };
  for (let j = 0; j < nn; j++) for (let i = 0; i < nx; i++) {
    const k = j * (nx + 1) + i;
    // a cell goes in if any corner is on the water or within 40 m of it (the land covers what is past the shore)
    if (Math.min(D[k], D[k + 1], D[k + nx + 1], D[k + nx + 2]) > 40) continue;
    const a = vert(i, j), b = vert(i + 1, j), c = vert(i, j + 1), d = vert(i + 1, j + 1);
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setAttribute('aShore', new THREE.Float32BufferAttribute(sho, 1));
  g.setIndex(idx); g.computeBoundingSphere();
  // wound to face up
  { const p = g.attributes.position, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(); a.fromBufferAttribute(p, idx[0]); b.fromBufferAttribute(p, idx[1]); c.fromBufferAttribute(p, idx[2]);
    if (b.sub(a).cross(c.sub(a)).y < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } g.setIndex(idx); } }
  MAT.ice = frIceMaterial();
  const m = new THREE.Mesh(g, MAT.ice); m.receiveShadow = true; m.renderOrder = 0;
  scene.add(m); FROST.iceMesh = m;
}

/* ---------------- where the rails end at the shore ----------------
   No track crosses the lake: the rails stop at the water's edge on both shores. Each end has a lantern on a
   post either side of the rails, burning orange, so a crew skating across in the dark has something to aim
   at, and a little spruce stuck in the snow beyond each lantern. */
function frShoreMarks(scene) {
  const m = ROUTE.main, [s0, s1] = FROST.sIce, list = [], lamps = [];
  const post = new THREE.CylinderGeometry(0.06, 0.08, 1.9, 6); post.translate(0, 0.95, 0);
  const lamp = new THREE.SphereGeometry(0.17, 10, 8); lamp.translate(0, 2.05, 0);
  const glow = new THREE.SphereGeometry(0.6, 10, 8); glow.translate(0, 2.05, 0);
  const pm = new THREE.MeshLambertMaterial({ color: 0x2a2520 }), lm = new THREE.MeshBasicMaterial({ color: 0xffa040 });
  const gm = new THREE.MeshBasicMaterial({ color: 0xff8a30, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const [s, dir] of [[s0, 1], [s1, -1]]) {   // dir: out onto the ice from this end
    const p = m.poseAt(s - dir * 1.5);
    for (const side of [-1, 1]) {
      const o = side * 3.3, X = p.X - Math.sin(p.h) * o, N = p.N + Math.cos(p.h) * o, y = groundAt(X, N);
      for (const [g, mt] of [[post, pm], [lamp, lm], [glow, gm]]) { const k = new THREE.Mesh(g, mt); k.position.set(X, y, -N); k.castShadow = mt === pm; scene.add(k); }
      lamps.push(new THREE.Vector3(X, y + 2.05, -N));
      const o2 = side * 6.5, q = m.poseAt(s - dir * 6);
      list.push([q.X - Math.sin(q.h) * o2, q.N + Math.cos(q.h) * o2, 0.9 + 0.3 * Math.abs(Math.sin(s + side))]);
    }
  }
  const tree = frSpruceGeo(), im = new THREE.InstancedMesh(tree, new THREE.MeshLambertMaterial({ vertexColors: true }), list.length);
  list.forEach((q, i) => { _m4.compose(_v1.set(q[0], groundAt(q[0], q[1]) - 0.1, -q[1]), _q.setFromEuler(_e.set(0.04 * Math.sin(i), i * 1.7, 0.05 * Math.cos(i))), _v2.set(q[2], q[2], q[2])); im.setMatrixAt(i, _m4); });
  im.castShadow = true; im.receiveShadow = true;
  scene.add(im);
  FROST.lanterns = lamps;
}
/* a little spruce, about 2.6 m: tiers of drooping boughs with snow on their tops, a bare stick of a trunk */
function frSpruceGeo() {
  const parts = [], add = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c[0]; a[i * 3 + 1] = c[1]; a[i * 3 + 2] = c[2]; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(g); };
  const trunk = new THREE.CylinderGeometry(0.035, 0.06, 2.7, 5); trunk.translate(0, 1.2, 0); add(trunk, [0.16, 0.11, 0.07]);
  for (let t = 0; t < 4; t++) {
    const r = 0.62 - t * 0.13, y = 0.35 + t * 0.52, h = 0.75 - t * 0.08;
    const c = new THREE.ConeGeometry(r, h, 7, 1, true); c.translate(0, y + h / 2, 0);
    // the top of each tier carries snow, the underside stays dark green
    const p = c.attributes.position, a = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const k = smooth(y + h * 0.35, y + h * 0.75, p.getY(i)); a[i * 3] = lerp(0.05, 0.78, k); a[i * 3 + 1] = lerp(0.12, 0.82, k); a[i * 3 + 2] = lerp(0.07, 0.88, k); }
    c.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(c);
  }
  const g = mergeGeos(parts);
  { const c = g.attributes.color.array; for (let i = 0; i < c.length; i++) c[i] = Math.pow(c[i], 2.2); (linearizeObject.done || (linearizeObject.done = new WeakSet())).add(c); }
  return g;
}

/* ---------------- Hollow Pine ---------------- */
function frFacilities() {
  const eng = ROUTE.features.engine;
  coalingTower(linePlace(eng, ROUTE.coal.sLine, 0));
  sandHouse(linePlace(eng, 400, 0));
  engineHouse(linePlace(eng, eng.len - 24, 0));
  yardOffice(clearPlace(ROUTE.main, 1450, -10, 6));
}
function frBuildScenery(scene) {
  frShoreMarks(scene);
}

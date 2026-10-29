/* ============================================================================
   Lamps after dark: the glow round platform lamps and signal lenses, and the
   pool of light each platform lamp throws on the boards. Glows are point
   sprites that keep a few pixels' size far away, as a lit signal does at night.
   ========================================================================== */

function glowMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 800 }, uMin: { value: 2.5 }, uK: { value: 0 }, uFogD: { value: 0 } },
    vertexShader: `#include <common>
      #include <logdepthbuf_pars_vertex>
      attribute vec3 aCol; attribute float aSize; uniform float uScale, uMin, uK, uFogD; varying vec3 vC;
      void main(){ vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); float z = -mvPosition.z;
        float px = aSize * uScale / max(0.2, z);
        gl_PointSize = max(px, uMin);
        // the haze swallows a far lamp slowly: its glow is thinned by about the square root of the fog
        vC = aCol * uK * mix(0.25, 1.0, exp(-0.5 * uFogD * uFogD * z * z));
        gl_Position = projectionMatrix * mvPosition;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <common>
      #include <logdepthbuf_pars_fragment>
      varying vec3 vC;
      void main(){
        #include <logdepthbuf_fragment>
        float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard;
        float a = pow(1.0 - r, 2.2) * 0.85 + pow(max(0.0, 1.0 - r * 3.0), 2.0) * 0.6;
        gl_FragColor = vec4(vC * a, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}
function glowPoints(list, size, scene) {
  const n = list.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), sz = new Float32Array(n).fill(size);
  list.forEach((l, i) => { pos.set([l.p.x, l.p.y, l.p.z], i * 3); col.set(l.c || [0, 0, 0], i * 3); l.i = i; });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(col, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  const pts = new THREE.Points(g, glowMaterial()); pts.frustumCulled = false; pts.renderOrder = 4; pts.visible = false;
  scene.add(pts);
  return pts;
}

/* the pools of lamplight: one quad per lamp lying 2 cm over the platform, cut to the platform's edges,
   its texture a soft ellipse centred under the lantern */
function buildLampPools(scene) {
  if (!LAMPS.pools.length) return;
  const tex = canvasTex(128, 128, g => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }, { srgb: false });
  const pos = [], uv = [], idx = [], R = 4.2, v = new THREE.Vector3();
  for (const q of LAMPS.pools) {
    const x0 = Math.max(q.x - R, q.px0), x1 = Math.min(q.x + R, q.px1), z0 = Math.max(q.z - R, q.pz0), z1 = Math.min(q.z + R, q.pz1);
    const k = pos.length / 3;
    for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) {
      v.set(x, 0.18, z).applyMatrix4(q.base); pos.push(v.x, v.y, v.z);
      uv.push(0.5 + (x - q.x) / (2 * R), 0.5 + (z - q.z) / (2 * R));
    }
    idx.push(k, k + 2, k + 1, k, k + 3, k + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const m = new THREE.MeshBasicMaterial({ map: tex, color: 0xffc27a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  LAMPS.pool = new THREE.Mesh(g, m); LAMPS.pool.renderOrder = 2; LAMPS.pool.visible = false; LAMPS.pool.frustumCulled = false;
  scene.add(LAMPS.pool);
}

function buildLamps(scene) {
  buildLampPools(scene);
  LAMPS.platPts = glowPoints(LAMPS.plat, 1.5, scene);
  // signal lenses: their colour comes from the aspect each one shows
  LAMPS.sig = [];
  for (const s of SCN.signals) for (const lens of s.heads) LAMPS.sig.push({ p: lens.userData.glowAt, lens });
  LAMPS.sigPts = glowPoints(LAMPS.sig, 0.9, scene);
  lampsSignals();
}
/* recolour the signal glows after an aspect change */
function lampsSignals() {
  if (!LAMPS.sigPts) return;
  const a = LAMPS.sigPts.geometry.attributes.aCol;
  for (const l of LAMPS.sig) {
    const m = l.lens.material, c = m === SMAT.lampOff ? null : m.color;
    a.setXYZ(l.i, c ? c.r : 0, c ? c.g : 0, c ? c.b : 0);
  }
  a.needsUpdate = true;
}
/* how bright the lamps are for the darkness (0 day, 1 night) */
function lampsLight(dark) {
  if (SMAT.lampGlass) SMAT.lampGlass.emissiveIntensity = smooth(0.2, 0.35, dark) * 1.6;
  const on = smooth(0.2, 0.45, dark);
  if (LAMPS.pool) { LAMPS.pool.material.opacity = 0.6 * on; LAMPS.pool.visible = on > 0.01; }
  if (LAMPS.platPts) { LAMPS.platPts.material.uniforms.uK.value = 0.9 * on; LAMPS.platPts.visible = on > 0.01; }
  // by day a signal shows only its lens; the glow comes up as the light goes
  if (LAMPS.sigPts) { const k = smooth(0.05, 0.6, dark); LAMPS.sigPts.material.uniforms.uK.value = k; LAMPS.sigPts.visible = k > 0.01; }
}
function lampsFrame(cam) {
  const sc = innerHeight * Math.min(devicePixelRatio, 2) * 0.5 / Math.tan(cam.fov * Math.PI / 360);
  for (const p of [LAMPS.platPts, LAMPS.sigPts]) if (p) { const u = p.material.uniforms; u.uScale.value = sc; u.uFogD.value = scene.fog.density; u.uMin.value = Math.min(devicePixelRatio, 2) * 2; }
}

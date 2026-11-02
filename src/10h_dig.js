/* ============================================================================
   Derailments that tear up the ground: where a wrecked car digs in and plows it throws clods of dirt
   (or ballast off the roadbed) and a cloud of dust, and it leaves a gouge behind it that stays.
   The wreck physics (07d_wreck.js) marks each body's hardest ground contact every frame; digWreck
   turns that into spray and scars. Everything is pooled: nothing is allocated while a wreck runs,
   and with no wreck going there is no work at all.
   ========================================================================== */
const DIG = { alive: 0, scarN: 0, scarDirty: false };
const _dga = new THREE.Vector3(), _dgb = new THREE.Vector3(), _dgc = new THREE.Vector3(), _dgs = new THREE.Vector2();

/* a pool of round points sized in metres; soft ones are dust (blended), hard ones are clods (solid) */
function digPool(scene, n, soft) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
  g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n), 1));
  const P = {
    n, soft, next: 0, live: 0, g,
    v: new Float32Array(n * 3), age: new Float32Array(n), life: new Float32Array(n).fill(-1),
    s0: new Float32Array(n), c: new Float32Array(n * 3), floor: new Float32Array(n), rest: new Uint8Array(n), ref: new Array(n),
  };
  P.pts = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: DIG.U, transparent: soft, depthWrite: !soft, fog: false,
    vertexShader: `#include <common>
      #include <logdepthbuf_pars_vertex>
      attribute vec4 aCol; attribute float aSize; uniform float uScale; varying vec4 vC;
      void main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize > 0.0 ? clamp(aSize * uScale / max(-mv.z, 0.1), 1.5, 256.0) : 0.0;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float uLight; varying vec4 vC;
      void main(){
        #include <logdepthbuf_fragment>
        float r = length(gl_PointCoord - 0.5);
        ${soft ? 'float a = vC.a * smoothstep(0.5, 0.05, r); if (a < 0.004) discard;'
               : 'if (r > 0.5) discard; float a = 1.0; '}
        gl_FragColor = vec4(vC.rgb * uLight * (${soft ? '1.0' : '1.15 - 0.6 * r'}), a); }`,
  }));
  P.pts.frustumCulled = false; P.pts.renderOrder = soft ? 5 : 0; P.pts.visible = false;
  scene.add(P.pts);
  return P;
}

/* torn earth: a dark furrow down the middle, churned clumps either side, ragged edges */
function digScarTex() {
  return canvasTex(64, 256, (c) => {
    const r = rng(77), img = c.createImageData(64, 256), d = img.data;
    for (let y = 0; y < 256; y++) for (let x = 0; x < 64; x++) {
      const u = (x + 0.5) / 64 - 0.5, edge = 0.5 - 0.09 * (Math.sin(y * 0.21) + Math.sin(y * 0.077 + 2)) - 0.05 * r();
      const k = (y * 64 + x) * 4, a = clamp((edge - Math.abs(u)) / 0.08, 0, 1);
      const furrow = Math.exp(-u * u * 40), clump = r() < 0.18 ? 0.35 * r() : 0;
      const sh = 0.75 + 0.25 * r() - 0.35 * furrow + clump;
      d[k] = 92 * sh; d[k + 1] = 70 * sh; d[k + 2] = 48 * sh; d[k + 3] = 255 * a * (0.8 + 0.2 * furrow);
    }
    c.putImageData(img, 0, 0);
  });
}

function buildDig(scene) {
  const mobile = /iPhone|iPad|Android/i.test(navigator.userAgent) || Math.min(screen.width, screen.height) < 600;
  DIG.U = { uScale: { value: 800 }, uLight: { value: 1 } };
  DIG.clods = digPool(scene, mobile ? 700 : 1600, false);
  DIG.dust = digPool(scene, mobile ? 160 : 360, true);
  DIG.q = mobile ? 0.5 : 1;
  // gouges: a ring of strips, three vertices across so each one lies on the ground under it
  const S = DIG.SEG = mobile ? 320 : 700;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(S * 12 * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(S * 12 * 3), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(S * 12 * 2), 2));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(S * 12 * 3), 3));
  const tex = digScarTex(); tex.wrapT = THREE.RepeatWrapping;
  DIG.scar = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
  DIG.scar.frustumCulled = false; DIG.scar.receiveShadow = true; DIG.scar.renderOrder = 1; DIG.scar.visible = false;
  scene.add(DIG.scar);
}

function digEmit(P, x, y, z, vx, vy, vz, size, life, r, g, b, floor, ref) {
  const i = P.next; P.next = (P.next + 1) % P.n;
  const j = i * 3;
  if (P.life[i] < 0) P.live++;
  P.g.attributes.position.array[j] = x; P.g.attributes.position.array[j + 1] = y; P.g.attributes.position.array[j + 2] = z;
  P.v[j] = vx; P.v[j + 1] = vy; P.v[j + 2] = vz;
  P.c[j] = r; P.c[j + 1] = g; P.c[j + 2] = b;
  P.age[i] = 0; P.life[i] = life; P.s0[i] = size; P.floor[i] = floor; P.rest[i] = 0; P.ref[i] = ref;
}

/* one strip of gouge from A to B, w wide, following whatever the car rests on there */
function digSegment(R, b, A, B, w, ballast) {
  if (!DIG.scar) return;
  const dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz); if (L < 0.05) return;
  const sx = -dz / L * w / 2, sz = dx / L * w / 2;
  const s = DIG.scarN % DIG.SEG; DIG.scarN++;
  const at = DIG.scar.geometry.attributes, pos = at.position.array, nor = at.normal.array, uv = at.uv.array, col = at.color.array;
  const v0 = b.dgD / 5, v1 = (b.dgD += L) / 5;
  // rows: A left, A mid, A right, B left, B mid, B right
  const row = [];
  for (const [P, v] of [[A, v0], [B, v1]]) for (const k of [-1, 0, 1]) {
    _dgc.set(P.x + sx * k, 0, P.z + sz * k); _dgc.y = P.y + 0.3;
    const y = R.ground(b, _dgc) + 0.05 - (k === 0 ? 0.015 : 0);
    row.push([_dgc.x, y, _dgc.z, (k + 1) / 2, v]);
  }
  const tris = [0, 3, 1, 1, 3, 4, 1, 4, 2, 2, 4, 5];
  const tint = ballast ? [0.95, 0.92, 0.9] : [1, 1, 1];
  for (let t = 0; t < 12; t++) {
    const q = row[tris[t]], o = (s * 12 + t);
    pos[o * 3] = q[0]; pos[o * 3 + 1] = q[1]; pos[o * 3 + 2] = q[2];
    nor[o * 3] = 0; nor[o * 3 + 1] = 1; nor[o * 3 + 2] = 0;
    uv[o * 2] = q[3]; uv[o * 2 + 1] = q[4];
    col[o * 3] = tint[0]; col[o * 3 + 1] = tint[1]; col[o * 3 + 2] = tint[2];
  }
  DIG.scarDirty = true;
}

/* called by WreckSim.step: spray and scar where each body is digging in this frame */
function digWreck(R, dt) {
  if (!DIG.clods || !(dt > 0)) return;
  try {
    const cp = (typeof camera !== 'undefined' && camera) ? camera.position : null;
    for (const b of R.bodies) {
      if (!(b.dgS > 0)) { b.dgOn = false; continue; }
      const P = b.dgP, V = b.dgV, im = b.dgI;
      const hs = Math.hypot(V.x, V.z);
      const gr = groundAt(P.x, -P.z), gy = R.ground(b, P), ballast = gy > gr + 0.05;
      // the gouge: a strip each time the car has plowed on another metre, none across a bounce
      if (b.dgD === undefined) b.dgD = 0;
      if (!b.dgL) b.dgL = new THREE.Vector3();
      const dist = b.dgOn ? Math.hypot(P.x - b.dgL.x, P.z - b.dgL.z) : 0;
      if (!b.dgOn || dist > 6) b.dgL.copy(P);
      else if (dist >= 0.9 && hs > 0.5) {
        const w = clamp(1.1 + 0.12 * hs + 0.5 * b.dgN, 1.1, 3.2);
        digSegment(R, b, b.dgL, P, w, ballast); b.dgL.copy(P);
      }
      b.dgOn = true;
      // the spray, only where someone can see it
      if (cp && P.distanceToSquared(cp) > 300 * 300) continue;
      const k = clamp(im / 9, 0.25, 1.6), q = DIG.q;
      b.dgA = (b.dgA || 0) + dt * q * Math.min(90, im * 14 * (0.5 + b.dgN));
      b.dgB = (b.dgB || 0) + dt * q * Math.min(14, im * 1.6);
      const fx = hs > 0.1 ? V.x / hs : 0, fz = hs > 0.1 ? V.z / hs : 0, ref = [R, b];
      while (b.dgA >= 1) {
        b.dgA--;
        const side = Math.random() < 0.5 ? -1 : 1, out = (0.6 + 3 * Math.random()) * k, f = hs * (0.2 + 0.55 * Math.random());
        const sh = ballast ? 0.42 + 0.12 * Math.random() : 0.2 + 0.12 * Math.random();
        digEmit(DIG.clods, P.x + (Math.random() - 0.5) * 0.8, gy + 0.15, P.z + (Math.random() - 0.5) * 0.8,
          fx * f - fz * side * out + (Math.random() - 0.5), (1.4 + 4 * Math.random()) * k, fz * f + fx * side * out + (Math.random() - 0.5),
          (ballast ? 0.06 : 0.07) + Math.random() * (ballast ? 0.08 : 0.18), 25 + 15 * Math.random(),
          ballast ? sh : sh * 1.25, ballast ? sh * 0.98 : sh, ballast ? sh * 0.94 : sh * 0.72, gy, ref);
      }
      while (b.dgB >= 1) {
        b.dgB--;
        const t = Math.random();
        digEmit(DIG.dust, P.x + (Math.random() - 0.5) * 2, gy + 0.4, P.z + (Math.random() - 0.5) * 2,
          V.x * 0.35 + (Math.random() - 0.5) * 2, 0.4 + 1.2 * Math.random() * k, V.z * 0.35 + (Math.random() - 0.5) * 2,
          1.2 + 1.5 * k * Math.random(), 2.5 + 3 * Math.random(),
          ballast ? 0.6 + 0.05 * t : 0.6 + 0.06 * t, ballast ? 0.58 + 0.05 * t : 0.52 + 0.05 * t, ballast ? 0.55 + 0.05 * t : 0.42 + 0.05 * t, gy, null);
      }
    }
  } catch (e) { console.warn('dig', e); }
}

function digPoolStep(P, dt, soft) {
  if (!P.live) { P.pts.visible = false; return; }
  P.pts.visible = true;
  const pos = P.g.attributes.position.array, col = P.g.attributes.aCol.array, sz = P.g.attributes.aSize.array;
  for (let i = 0; i < P.n; i++) {
    if (P.life[i] < 0) continue;
    const t = (P.age[i] += dt) / P.life[i], j = i * 3;
    if (t >= 1) { P.life[i] = -1; P.live--; sz[i] = 0; P.ref[i] = null; continue; }
    if (soft) {
      // dust: drifts and slows, rises a little, spreads and thins out
      const dr = Math.exp(-1.6 * dt);
      P.v[j] *= dr; P.v[j + 2] *= dr; P.v[j + 1] = P.v[j + 1] * Math.exp(-0.8 * dt) + 0.05 * dt;
      pos[j] += P.v[j] * dt; pos[j + 1] += P.v[j + 1] * dt; pos[j + 2] += P.v[j + 2] * dt;
      sz[i] = P.s0[i] * (1 + 2.2 * Math.sqrt(t));
      col[i * 4] = P.c[j]; col[i * 4 + 1] = P.c[j + 1]; col[i * 4 + 2] = P.c[j + 2];
      col[i * 4 + 3] = 0.42 * Math.min(1, t * 8) * Math.pow(1 - t, 1.6);
    } else {
      if (!P.rest[i]) {
        P.v[j + 1] -= 9.81 * dt;
        pos[j] += P.v[j] * dt; pos[j + 1] += P.v[j + 1] * dt; pos[j + 2] += P.v[j + 2] * dt;
        if (P.v[j + 1] < 0 && pos[j + 1] < P.floor[i] + 1) {
          // the ground right under it while it comes down, so it lands on it, not above or in it
          const ref = P.ref[i]; _dga.set(pos[j], pos[j + 1], pos[j + 2]);
          try { P.floor[i] = ref ? ref[0].ground(ref[1], _dga) : groundAt(pos[j], -pos[j + 2]); } catch (e) { P.floor[i] = groundAt(pos[j], -pos[j + 2]); }
        }
        const fl = P.floor[i] + P.s0[i] * 0.35;
        if (pos[j + 1] <= fl && P.v[j + 1] <= 0) {
          pos[j + 1] = fl;
          if (P.v[j + 1] < -2.5) { P.v[j + 1] *= -0.22; P.v[j] *= 0.4; P.v[j + 2] *= 0.4; }
          else { P.rest[i] = 1; P.v[j] = P.v[j + 1] = P.v[j + 2] = 0; P.ref[i] = null; }
        }
      }
      // lying clods sink into the grass at the very end rather than vanish
      sz[i] = P.s0[i] * (t > 0.9 ? (1 - t) / 0.1 : 1);
      col[i * 4] = P.c[j]; col[i * 4 + 1] = P.c[j + 1]; col[i * 4 + 2] = P.c[j + 2]; col[i * 4 + 3] = 1;
    }
  }
  P.g.attributes.position.needsUpdate = true; P.g.attributes.aCol.needsUpdate = true; P.g.attributes.aSize.needsUpdate = true;
}

/* every frame from the main loop */
function digFrame(dt, cam) {
  if (!DIG.clods) return;
  if (DIG.scarDirty) {
    const at = DIG.scar.geometry.attributes;
    at.position.needsUpdate = at.normal.needsUpdate = at.uv.needsUpdate = at.color.needsUpdate = true;
    DIG.scarDirty = false; DIG.scar.visible = true;
  }
  if (!DIG.clods.live && !DIG.dust.live) { DIG.clods.pts.visible = DIG.dust.pts.visible = false; return; }
  if (typeof renderer !== 'undefined' && renderer && cam) DIG.U.uScale.value = renderer.getDrawingBufferSize(_dgs).y / (2 * Math.tan(cam.fov * Math.PI / 360));
  DIG.U.uLight.value = lerp(1, 0.16, SKY.dark || 0);
  const h = Math.min(dt, 0.05);
  digPoolStep(DIG.clods, h, false); digPoolStep(DIG.dust, h, true);
}

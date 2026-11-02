/* ============================================================================
   Foliage: trees and bushes built from leaf cards, and their far impostors.
   Near trees are a bark trunk with a few limbs and clumps of alpha-cut leaf cards (hardwoods) or tiers of
   drooping needle sprays (hemlock and spruce). Their normals point out of the crown, so a tree is lit as one
   soft mass with a bright sunny side, and the cards deep inside and low down are shaded darker. Far away each
   tree becomes a single camera-facing card whose picture is rendered from the near model when the world
   loads, so the two dissolve into each other without changing shape or colour.
   ========================================================================== */
const FOL = { geos: null, imp: null, winterU: { value: 0 }, layU: { value: 0 } };   // winter: hardwoods bare; lay: snow on the trees (10i_snow.js)
/* phones and small tablets: shorter near-tree band, thinner ground cover */
const GFX = { lite: typeof screen !== 'undefined' && Math.min(screen.width, screen.height) < 600 };

/* atlas, 512 x 512: top left hardwood leaf clump, top right needle spray, bottom left bark, bottom right twigs */
const FOL_UV = { leaf: [0, 0.5, 0.5, 1], needle: [0.5, 0.5, 1, 1], bark: [0, 0, 0.5, 0.5], twig: [0.5, 0, 1, 0.5] };
function foliageTexture() {
  const t = canvasTex(512, 512, (g) => {
    const r = rng(77);
    // ---- hardwood leaf clump (light greys; the instance colour gives the season)
    g.save(); g.translate(128, 128);
    for (let i = 0; i < 9; i++) { const a = r() * TAU; g.strokeStyle = 'rgba(70,60,50,0.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 30); g.quadraticCurveTo(Math.cos(a) * 40, Math.sin(a) * 40, Math.cos(a) * 95, Math.sin(a) * 95); g.stroke(); }
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < 520; i++) {
      const a = r() * TAU, d = 116 * Math.pow(r(), 0.62), x = Math.cos(a) * d, y = Math.sin(a) * d * 0.92;
      const sh = pass === 0 ? 0.42 + r() * 0.2 : 0.7 + r() * 0.3 - 0.18 * (y / 116);   // under-leaves darker, the top lighter
      const v = Math.min(255, sh * 255) | 0;
      g.fillStyle = `rgb(${v},${Math.min(255, v + 6)},${v * 0.9 | 0})`;
      g.save(); g.translate(x, y); g.rotate(r() * TAU); g.beginPath(); g.ellipse(0, 0, 6 + r() * 6, 3 + r() * 2.6, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(-1.5, -1, 3, 1.4, 0, 0, TAU); g.fill(); g.restore();
    }
    g.restore();
    // ---- needle spray, base at the left (the trunk) and tip at the right
    g.save(); g.translate(256, 0);
    const twig = (x0, y0, x1, y1, len, w) => {
      g.strokeStyle = 'rgb(92,80,66)'; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      const n = len / 2.2 | 0, dx = (x1 - x0) / n, dy = (y1 - y0) / n, L = Math.hypot(dx, dy);
      for (let k = 0; k < n; k++) {
        const px = x0 + dx * k, py = y0 + dy * k, f = k / n, nl = (7 + 9 * Math.sin(Math.PI * Math.min(1, f * 1.2 + 0.1))) * (len / 120 + 0.35);
        for (const s of [-1, 1]) {
          const v = (150 + r() * 105) | 0; g.strokeStyle = `rgb(${v},${Math.min(255, v + 10)},${v * 0.85 | 0})`; g.lineWidth = 1.6;
          const ax = dx / L, ay = dy / L, nx = -ay * s, ny = ax * s;
          g.beginPath(); g.moveTo(px, py); g.lineTo(px + (nx * 0.8 + ax * 0.6) * nl, py + (ny * 0.8 + ay * 0.6) * nl); g.stroke();
        }
      }
    };
    twig(4, 128, 250, 126, 246, 3.5);
    for (let k = 0; k < 9; k++) { const x = 22 + k * 24, s = k % 2 ? -1 : 1, len = 100 * (1 - k / 11) + 16; twig(x, 128, x + len * 0.62, 128 + s * len * 0.72, len, 2); twig(x + 8, 128, x + 8 + len * 0.55, 128 - s * len * 0.66, len * 0.9, 1.8); }
    g.restore();
    // ---- bark: grey-brown with vertical furrows (opaque; never tinted)
    g.save(); g.translate(0, 256);
    g.fillStyle = '#5d5248'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 260; i++) { const x = r() * 256, v = 60 + r() * 70 | 0; g.strokeStyle = `rgba(${v},${v * 0.9 | 0},${v * 0.8 | 0},0.8)`; g.lineWidth = 1 + r() * 4; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + r() * 10 - 5, 85, x + r() * 10 - 5, 170, x + r() * 8 - 4, 256); g.stroke(); }
    for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(160,165,140,0.25)'; g.fillRect(r() * 256, r() * 256, 3 + r() * 10, 2 + r() * 6); }   // lichen
    g.restore();
    // ---- bare twigs (a winter or thin crown filler)
    g.save(); g.translate(256, 256);
    // a winter crown seen through: limbs forking into finer and finer twigs, all reaching out from the middle
    const limb = (x, y, a, len, w, d) => {
      const x1 = x + Math.cos(a) * len, y1 = y + Math.sin(a) * len, v = 62 + (d * 9) + r() * 16 | 0;
      g.strokeStyle = `rgba(${v},${v * 0.88 | 0},${v * 0.76 | 0},0.97)`; g.lineWidth = w; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + x1) / 2 + (r() - 0.5) * len * 0.3, (y + y1) / 2 + (r() - 0.5) * len * 0.3, x1, y1); g.stroke();
      if (d < 4) for (let k = 0, n = 2 + (r() < 0.5); k < n; k++) limb(x1, y1, a + (r() - 0.5) * 1.3, len * (0.6 + r() * 0.12), Math.max(1, w * 0.62), d + 1);
    };
    // kept within about 90 px of the middle, so no twig runs out to the card's edge and shows as a stray line
    for (let i = 0; i < 9; i++) limb(128 + (r() - 0.5) * 16, 128 + (r() - 0.5) * 16, i / 9 * TAU + r() * 0.5, 22 + r() * 8, 3, 0);
    g.restore();
  });
  t.anisotropy = 4;
  return t;
}

/* ---- a geometry made of cards and tubes; colour carries ambient occlusion, aLeaf says what the season tints */
function folAcc() { return { pos: [], nor: [], uv: [], col: [], leaf: [], cor: [], snow: [], idx: [] }; }
function folGeo(A) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(A.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(A.nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(A.uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(A.col, 3));
  g.setAttribute('aLeaf', new THREE.Float32BufferAttribute(A.leaf, 1));
  g.setAttribute('aCorner', new THREE.Float32BufferAttribute(A.cor, 3));
  g.setAttribute('aSnow', new THREE.Float32BufferAttribute(A.snow, 1));   // how much snow this corner holds (0-1)
  g.setIndex(A.idx); g.computeBoundingSphere();
  // the colours are written linear already
  const done = linearizeObject.done || (linearizeObject.done = new WeakSet()); done.add(g.attributes.color.array);
  return g;
}
const _fa = new THREE.Vector3(), _fb = new THREE.Vector3(), _fc = new THREE.Vector3(), _fn = new THREE.Vector3(), _ft = new THREE.Vector3();
/* one leaf card: centre c, unit axes u and v (half sizes hu, hv), uv rect, lighting centre lc; ao(p) shades each corner */
function folCard(A, c, u, v, hu, hv, rect, lc, ao, up = 0.35) {
  const b = A.pos.length / 3;
  // snow lies on a card's upper edge, and all over one that lies flat; less on the shaded cards deep inside
  const flat = Math.abs(_ft.crossVectors(u, v).normalize().y), reach = Math.abs(u.y) * hu + Math.abs(v.y) * hv + 1e-3;
  for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    _fa.copy(c).addScaledVector(u, su * hu).addScaledVector(v, sv * hv);
    A.pos.push(_fa.x, _fa.y, _fa.z);
    _fn.copy(_fa).sub(lc); _fn.y = Math.max(_fn.y, -0.3 * _fn.length()); _fn.normalize(); _fn.y += up; _fn.normalize();
    A.nor.push(_fn.x, _fn.y, _fn.z);
    A.uv.push(su < 0 ? rect[0] : rect[2], sv < 0 ? rect[1] : rect[3]);
    const s = ao(_fa); A.col.push(s, s, s); A.leaf.push(1); A.cor.push(0, 0, 0);
    const rel = (su * u.y * hu + sv * v.y * hv) / reach;
    A.snow.push(clamp(0.2 + 0.6 * flat + 0.55 * rel, 0, 1) * clamp((s - 0.35) / 0.4, 0.3, 1));
  }
  A.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
}
/* a leaf card that always turns its face to the viewer (so a crown is never seen edge-on): all four corners
   sit at the centre c and aCorner carries the offset, rolled by a fixed angle so the clumps don't line up */
function folBill(A, c, hs, roll, lc, ao, up = 0.3) {
  const b = A.pos.length / 3, cr = Math.cos(roll), sr = Math.sin(roll);
  _fn.copy(c).sub(lc); _fn.y = Math.max(_fn.y, -0.3 * _fn.length()); _fn.normalize(); _fn.y += up; _fn.normalize();
  const s = ao(c), e = 2 / 512, L = FOL_UV.leaf, R = [L[0] + e, L[1] + e, L[2] - e, L[3] - e];   // inset off the tile edges (the bark bleeds in)
  for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    A.pos.push(c.x, c.y, c.z); A.nor.push(_fn.x, _fn.y, _fn.z);
    A.uv.push(su < 0 ? R[0] : R[2], sv < 0 ? R[1] : R[3]);
    A.col.push(s, s, s); A.leaf.push(1);
    A.cor.push((su * cr - sv * sr) * hs, (su * sr + sv * cr) * hs, 1);
    A.snow.push(clamp(0.15 + 0.4 * (su * sr + sv * cr), 0, 1) * clamp((s - 0.35) / 0.4, 0.3, 1));
  }
  A.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
}
/* a tapered tube of bark from a to b */
function folTube(A, a, b, r0, r1, sides, vLen = 1) {
  const ax = _fb.copy(b).sub(a), len = ax.length(); ax.normalize();
  const t1 = _ft.set(0, 1, 0).cross(ax); if (t1.lengthSq() < 1e-4) t1.set(1, 0, 0).cross(ax); t1.normalize();
  const t2 = _fc.copy(ax).cross(t1).normalize();
  const base = A.pos.length / 3, R = FOL_UV.bark;
  for (let e = 0; e < 2; e++) for (let k = 0; k <= sides; k++) {
    const an = k / sides * TAU, ca = Math.cos(an), sa = Math.sin(an), rr = e ? r1 : r0;
    const nx = t1.x * ca + t2.x * sa, ny = t1.y * ca + t2.y * sa, nz = t1.z * ca + t2.z * sa;
    const p = e ? b : a;
    A.pos.push(p.x + nx * rr, p.y + ny * rr, p.z + nz * rr); A.nor.push(nx, ny * 0.6 + 0.2, nz);
    A.uv.push(lerp(R[0], R[2], k / sides), lerp(R[1], R[3], e ? Math.min(1, len / 6 * vLen) : 0));
    const s = e ? 1 : 0.8; A.col.push(s, s, s); A.leaf.push(0); A.cor.push(0, 0, 0);
    A.snow.push(clamp((ny - 0.25) / 0.45, 0, 1));   // along the top of a limb; never down a trunk
  }
  for (let k = 0; k < sides; k++) { const i0 = base + k, i1 = base + k + 1, j0 = i0 + sides + 1, j1 = i1 + sides + 1; A.idx.push(i0, j0, i1, i1, j0, j1); }
}
const _rv = (r, out) => { const z = r() * 2 - 1, a = r() * TAU, s = Math.sqrt(1 - z * z); return out.set(s * Math.cos(a), z, s * Math.sin(a)); };

/* a broad hardwood (maple, oak, ash): crown about 3.7 m in radius from 2.4 to 9.9 m, as the old blobs */
function hardwoodGeo(seed, cards = 1) {
  const r = rng(seed), A = folAcc();
  const top = new THREE.Vector3(0, 3.9, 0);
  folTube(A, new THREE.Vector3(0, -0.5, 0), top, 0.27, 0.17, 6);
  const C = new THREE.Vector3(0, 6.4, 0);
  const clumps = [[0, 7.5, 0, 2.5], [1.8, 6.0, 0.8, 2.1], [-1.6, 6.3, -1.1, 2.1], [0.5, 5.5, -1.9, 1.9], [-0.7, 5.6, 1.9, 1.9], [0.3, 8.9, 0.4, 1.5], [2.1, 7.6, -0.9, 1.5], [-2.0, 7.7, 0.9, 1.5]];
  for (const q of clumps.slice(1, 6)) {   // limbs out to the clumps, seen through the gaps
    const end = new THREE.Vector3(q[0] * 0.75, q[1] * 0.92, q[2] * 0.75);
    folTube(A, top.clone().add(new THREE.Vector3(0, -0.3, 0)), end, 0.11, 0.045, 4, 0.5);
  }
  const ao = p => { const rad = Math.hypot(p.x, (p.y - C.y) * 1.05, p.z) / 3.9; return clamp(0.42 + 0.5 * rad + 0.12 * (p.y - 4) / 5, 0.38, 1.05); };
  const u = new THREE.Vector3(), v = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Vector3();
  for (const q of clumps) {
    const n0 = Math.round((q[3] > 2 ? 10 : q[3] > 1.7 ? 7 : 5) * cards);
    for (let i = 0; i < n0; i++) {
      _rv(r, n); c.set(q[0], q[1], q[2]).addScaledVector(n, q[3] * (0.35 + 0.6 * Math.sqrt(r())));
      folBill(A, c, 1.0 + r() * 0.45, r() * TAU, C, ao, 0.3);
    }
  }
  return folGeo(A);
}
/* hemlock or spruce: a straight trunk and eleven tiers of drooping sprays, about 2.6 m out at the bottom */
function coniferGeo(seed) {
  const r = rng(seed), A = folAcc();
  folTube(A, new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(0, 10.6, 0), 0.25, 0.04, 6);
  const C = new THREE.Vector3(0, 5.2, 0);
  const ao = p => clamp(0.45 + 0.4 * Math.hypot(p.x, p.z) / 2.6 + 0.25 * (p.y - 1.5) / 9, 0.4, 1.05);
  const u = new THREE.Vector3(), v = new THREE.Vector3(), c = new THREE.Vector3(), rad = new THREE.Vector3(), tan = new THREE.Vector3();
  const nT = 12;
  for (let t = 0; t < nT; t++) {
    const f = t / (nT - 1), y = 1.5 + f * 9.0, R = 2.75 * Math.pow(1 - f, 0.95) + 0.45;
    const n = Math.max(3, Math.round(3 + 5 * (1 - f))), a0 = r() * TAU;
    for (let k = 0; k < n; k++) {
      const a = a0 + k / n * TAU + (r() - 0.5) * 0.5, L = R * (0.8 + r() * 0.3);
      rad.set(Math.cos(a), 0, Math.sin(a)); tan.set(-Math.sin(a), 0, Math.cos(a));
      const droop = 0.3 + 0.15 * r();
      u.copy(rad).multiplyScalar(1).addScaledVector(_ft.set(0, -1, 0), droop).normalize();
      // twist the spray about its own axis, so seen from the side the tier still shows a face
      const tw = (k % 2 ? 1 : -1) * (0.45 + r() * 0.3);
      v.copy(tan).multiplyScalar(Math.cos(tw)).addScaledVector(_ft.set(0, 1, 0), Math.sin(tw)).normalize();
      c.set(0, y + (r() - 0.5) * 0.3, 0).addScaledVector(u, L / 2);
      folCard(A, c, u, v, L / 2, 0.35 + L * 0.3, FOL_UV.needle, C, ao, 0.45);
    }
  }
  // the leader
  for (let k = 0; k < 2; k++) { const a = k * Math.PI / 2; c.set(0, 10.9, 0); u.set(0, 1, 0); v.set(Math.cos(a), 0, Math.sin(a)); folCard(A, c, u, v, 0.8, 0.35, FOL_UV.needle, C, ao, 0.45); }
  return folGeo(A);
}
/* a shrub (sumac, dogwood, multiflora) about 1.6 m across */
function bushGeo(seed) {
  const r = rng(seed), A = folAcc(), C = new THREE.Vector3(0, 0.55, 0);
  const ao = p => clamp(0.45 + 0.55 * p.y / 1.3, 0.4, 1.05);
  const u = new THREE.Vector3(), v = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Vector3();
  for (const q of [[0, 0.7, 0, 0.7], [0.55, 0.5, 0.25, 0.5], [-0.5, 0.45, -0.2, 0.5]]) for (let i = 0; i < 6; i++) {
    _rv(r, n); c.set(q[0], q[1], q[2]).addScaledVector(n, q[3] * (0.3 + 0.6 * r())); c.y = Math.max(c.y, 0.42);
    folBill(A, c, 0.48, r() * TAU, C, ao, 0.35);
  }
  return folGeo(A);
}

/* ---- the shaders: season tint on the leaves only, a breath of wind in the crowns, both faces lit as the front.
   In winter the hardwood leaf cards (the billboards: aCorner.z is 1) show the bare twig picture instead and lose the season tint, and snow lies
   on the trees as FOL.layU says: on the upper edges of the needle sprays and along the tops of the limbs. */
const FOL_BARE_GLSL = `
      if (uWinter > 0.5 && aCorner.z > 0.5) { vUv = vec2(0.75, 0.25) + (vUv - vec2(0.25, 0.75)) * 0.9; vBare = 1.0; }`;
   // the hardwood and bush leaf cards (the only billboards) take the twig tile, kept clear of its edges so the
   // opaque bark next door never bleeds in as a thin line along a card's edge
function foliageShader(sh) {
  sh.uniforms.uWind = WORLD.waterT; sh.uniforms.uWinter = FOL.winterU; sh.uniforms.uLay = FOL.layU;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float aLeaf; attribute vec3 aCorner; attribute float aSnow; uniform float uWind, uWinter; varying float vSnow; float vBare;')
    .replace('#include <uv_vertex>', '#include <uv_vertex>\n vBare = 0.0;' + FOL_BARE_GLSL + '\n vSnow = aSnow;')
    .replace('#include <project_vertex>', `#include <project_vertex>
      if (aCorner.z > 0.5) {
        #ifdef USE_INSTANCING
         mvPosition.xy += aCorner.xy * length(instanceMatrix[0].xyz);
        #else
         mvPosition.xy += aCorner.xy;
        #endif
        gl_Position = projectionMatrix * mvPosition;
      }`)
    .replace('#include <color_vertex>', '#include <color_vertex>\n#ifdef USE_INSTANCING_COLOR\n vColor.xyz = color.xyz * mix(vec3(1.0), instanceColor.xyz, aLeaf * (1.0 - vBare));\n#endif')
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
       { float ph = instanceMatrix[3].x * 0.21 + instanceMatrix[3].z * 0.17;
         float w = aLeaf * max(position.y - 1.0, 0.0) * 0.012 * (sin(uWind * 1.3 + ph) + 0.4 * sin(uWind * 3.1 + ph * 2.0 + position.x));
         transformed.x += w; transformed.z += w * 0.7; }
      #endif`);
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float uLay; varying float vSnow;')
    .replace('#include <color_fragment>', `#include <color_fragment>
      { // a coat that grows from the best placed corners; the texture's own light and dark break its edge up
        float tl = dot(diffuseColor.rgb, vec3(0.3, 0.5, 0.2)) / max(0.02, dot(vColor, vec3(0.3, 0.5, 0.2)));
        float cov = smoothstep(0.34, 0.58, vSnow * (0.3 + 1.1 * uLay) + 0.3 * (tl - 0.75)) * smoothstep(0.02, 0.2, uLay);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.81, 0.86), cov);
      }`)
    .replace('( gl_FrontFacing ) ? vLightFront : vLightBack', 'vLightFront')
    .replace('( gl_FrontFacing ) ? vIndirectFront : vIndirectBack', 'vIndirectFront');
}
function foliageMaterial() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, map: FOL.tex || (FOL.tex = foliageTexture()), alphaTest: 0.45, side: THREE.DoubleSide });
  m.onBeforeCompile = foliageShader; m.customProgramCacheKey = () => 'foliage';
  return m;
}

/* ---- impostors: one card per tree, facing the camera, whose picture is the near tree rendered once at load.
   Eight 256 px slots across: 0 and 1 the summer hardwood and conifer (grey, tinted per tree as they draw),
   2 and 3 the same in winter, bare and with no snow, 4 and 5 winter with a coat of snow. Winter cards are
   baked in their own colours, and the far shader blends the bare and snowy slots by how much snow lies. */
const IMP = { dec: { u0: 0 }, con: { u0: 1 }, slots: 8 };
const IMP_WINTER = { needle: [0.032, 0.062, 0.026], twig: [0.72, 0.72, 0.72], snow: [0.78, 0.81, 0.86] };   // linear, as the near shader draws them
/* the square frame each tree is drawn in: its height from the bounding box, centred on the trunk */
function impFrame(k, g) {
  const p = g.attributes.position, c = g.attributes.aCorner, B = IMP[k]; let y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < p.count; i++) { const e = Math.hypot(c.getX(i), c.getY(i)); y0 = Math.min(y0, p.getY(i) - e); y1 = Math.max(y1, p.getY(i) + e); }
  B.y0 = y0 - 0.1; B.y1 = y1 + 0.1; B.x = (B.y1 - B.y0) / 2; return B;
}
function bakeImpostors(G) {
  const rt = new THREE.WebGLRenderTarget(256 * IMP.slots, 256, { minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true });
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: FOL.tex }, uWinter: { value: 0 }, uLay: { value: 0 }, uNeedle: { value: new THREE.Vector3(...IMP_WINTER.needle) }, uTwig: { value: new THREE.Vector3(...IMP_WINTER.twig) }, uSnowC: { value: new THREE.Vector3(...IMP_WINTER.snow) } }, side: THREE.DoubleSide,
    vertexShader: 'attribute float aLeaf; attribute vec3 aCorner; attribute float aSnow; uniform float uWinter; varying vec2 vUv; varying vec3 vCol; varying float vLeaf; varying vec3 vN; varying float vSnow;\n' +
      'void main(){ vUv = uv; float vBare = 0.0;' + FOL_BARE_GLSL + ' vCol = color; vLeaf = aLeaf * (1.0 - vBare); vSnow = aSnow; vN = normal; vec4 mv = modelViewMatrix * vec4(position, 1.0); mv.xy += aCorner.xy * aCorner.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform sampler2D map; uniform float uWinter, uLay; uniform vec3 uNeedle, uTwig, uSnowC; varying vec2 vUv; varying vec3 vCol; varying float vLeaf; varying vec3 vN; varying float vSnow;\n' +
      'void main(){ vec4 t = texture2D(map, vUv); if (t.a < 0.45) discard; vec3 tl = pow(t.rgb, vec3(2.2)); vec3 c = tl * vCol;\n' +
      // winter cards carry their own colour: green needles, grey-brown twigs and bark, and the snow
      ' if (uWinter > 0.5) { c *= vLeaf > 0.5 ? uNeedle * 1.6 : uTwig * 1.4;\n' +
      '   float cov = smoothstep(0.34, 0.58, vSnow * (0.3 + 1.1 * uLay) + 0.3 * (dot(tl, vec3(0.3, 0.5, 0.2)) - 0.75)) * step(0.02, uLay);\n' +
      '   c = mix(c, uSnowC * mix(1.0, vCol.g, 0.3), cov); }\n' +
      // a little of the near tree's own light, from above and from the viewer's side, so the far card is not flat
      ' vec3 n = normalize(vN); c *= 0.82 + 0.28 * clamp(n.y * 0.6 + n.z * 0.5, -0.4, 1.0);\n' +
      ' gl_FragColor = vec4(c, 1.0); }',
    vertexColors: true,
  });
  const sc = new THREE.Scene(), oldRT = renderer.getRenderTarget(), oldC = renderer.getClearColor(new THREE.Color()), oldA = renderer.getClearAlpha();
  renderer.setClearColor(0x5d6450, 0);   // the colour the edge texels fade toward in the small mip levels
  rt.scissorTest = true;
  for (const [wi, lay] of [[0, 0], [1, 0], [1, 0.85]]) for (const k of ['dec', 'con']) {
    const B = IMP[k], slot = B.u0 + 2 * wi + (lay > 0 ? 2 : 0);
    mat.uniforms.uWinter.value = wi; mat.uniforms.uLay.value = lay;
    const cam = new THREE.OrthographicCamera(-B.x, B.x, B.y1, B.y0, -50, 50); cam.position.set(0, 0, 10); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
    const m = new THREE.Mesh(G[k], mat); sc.add(m);
    rt.viewport.set(slot * 256, 0, 256, 256); rt.scissor.copy(rt.viewport);
    renderer.setRenderTarget(rt); renderer.clear(); renderer.render(sc, cam);
    sc.remove(m);
  }
  renderer.setRenderTarget(oldRT); renderer.setClearColor(oldC, oldA);
  mat.dispose();
  return rt.texture;
}
function impostorGeo(k) {
  const B = IMP[k], g = new THREE.PlaneGeometry(B.x * 2, B.y1 - B.y0);
  g.translate(0, (B.y1 + B.y0) / 2, 0);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, (B.u0 + uv.getX(i)) / IMP.slots);
  const c = new Float32Array(uv.count * 3).fill(1); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  (linearizeObject.done || (linearizeObject.done = new WeakSet())).add(c);
  return g;
}
function impostorMaterial(tex) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, map: tex, alphaTest: 0.5 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uWinter = FOL.winterU; sh.uniforms.uLay = FOL.layU;
    // winter: the bare and the snowy pictures (two and four slots along), blended by the snow lying; their
    // colours are baked in, so the per-tree season tint is left off
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uWinter, uLay;')
      .replace('#include <map_fragment>', `
        vec4 texelColor = texture2D( map, vUv );
        if ( uWinter > 0.5 ) texelColor = mix( texture2D( map, vUv + vec2( 0.25, 0.0 ) ), texture2D( map, vUv + vec2( 0.5, 0.0 ) ), smoothstep( 0.0, 0.85, uLay ) );
        texelColor = mapTexelToLinear( texelColor );
        diffuseColor *= texelColor;`);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWinter;')
      .replace('#include <color_vertex>', '#include <color_vertex>\n if ( uWinter > 0.5 ) vColor.xyz = color.xyz;')
      .replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\n transformedNormal = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz * 0.7 + vec3(0.0, 0.0, 0.5));')
      .replace('#include <project_vertex>', `
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
        vec3 rightV = normalize(cross(upV, normalize(-mvPosition.xyz)));
        vec3 upC = normalize(cross(normalize(-mvPosition.xyz), rightV));
        upV = normalize(mix(upV, upC, 0.5));   // lean back a little toward the viewer when seen from above
        mvPosition.xyz += rightV * position.x * length(instanceMatrix[0].xyz) + upV * position.y * length(instanceMatrix[1].xyz);
        gl_Position = projectionMatrix * mvPosition;
        #ifdef LAMP_DECL
          vLampP = vec3(1e6); vLampN = vec3(0.0, 1.0, 0.0);   // far trees: out of reach of the lamps (10c_lamps.js)
        #endif`);
  };
  m.customProgramCacheKey = () => 'impostor';
  return m;
}

/* ---- the shared tree set: a few variants of each so a woodlot is not one tree repeated */
function foliageGeos() {
  if (FOL.geos) return FOL.geos;
  const G = { dec: hardwoodGeo(11), dec2: hardwoodGeo(23), con: coniferGeo(5), con2: coniferGeo(9), bush: bushGeo(3) };
  impFrame('dec', G.dec); impFrame('con', G.con);
  if (typeof renderer !== 'undefined' && renderer) FOL.imp = bakeImpostors(G);
  G.decLo = impostorGeo('dec'); G.conLo = impostorGeo('con');
  return (FOL.geos = G);
}
/* a geometry that shares another's attributes (one GPU copy) but has its own bounding sphere, for culling */
function shareGeo(base, sphere) {
  const g = new THREE.BufferGeometry();
  for (const k in base.attributes) g.setAttribute(k, base.attributes[k]);
  g.setIndex(base.index); g.boundingSphere = sphere;
  return g;
}
/* let a shared geometry go without freeing the buffers the others still use */
function dropShared(g) { g.attributes = {}; g.index = null; g.dispose(); }
/* set the instance colours from sRGB and mark them done, for meshes built after the world loaded */
function setFolColor(im, i, c) { im.setColorAt(i, _tc.setRGB(c[0], c[1], c[2]).convertSRGBToLinear()); }
function folColorsDone(im) { if (im.instanceColor) { im.instanceColor.userData = { lin: true }; im.instanceColor.needsUpdate = true; } }

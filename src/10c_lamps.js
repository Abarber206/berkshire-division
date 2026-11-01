/* ============================================================================
   Lamps after dark.

   Every lamp on the railroad (platform lanterns, street lights, yard floodlights, the flashers at the
   grade crossings, a diesel's ditch lights) is registered in LAMPS.lights. Each frame the nearest of the
   lit ones are handed to every lit material as a short list of point lights, so a lamp really lights the
   boards, the road, a house front and a train going by under it, at the cost of a small loop in the
   shader instead of a real three.js light (which would recompile every shader whenever one switched).
   Lamps further off show as glows: point sprites that keep a few pixels' size far away, as a lit lamp
   does at night. Windows light up one by one through dusk and go dark as the town goes to bed.
   ========================================================================== */

// a phone gets the nearest 8 lamps, a computer 16: each is a few more sums for every pixel lamps can reach
const LAMP_MAX = (/iPhone|iPad|Android/i.test(navigator.userAgent) || Math.min(screen.width, screen.height) < 600) ? 8 : 16;
const LAMPLIT = { P: new Float32Array(LAMP_MAX * 4), C: new Float32Array(LAMP_MAX * 4), D: new Float32Array(LAMP_MAX * 4), info: new Float32Array(4) };

/* The lamp list in every Lambert, Phong and Standard shader. Typed arrays, so each material's copy of
   these uniforms is the same array (three.js copies plain arrays but not typed ones). */
(function lampChunks() {
  // Lambert's fragment shader has no define of its own, so the declarations go in with the light
  // uniforms every lit shader pulls in (and in common for the lit vertex shaders, which may not)
  const C = THREE.ShaderChunk, DECL = `
#ifndef LAMP_DECL
  #define LAMP_DECL
  #define LAMP_MAX ${LAMP_MAX}
  varying vec3 vLampP; varying vec3 vLampN;
  uniform vec4 lampP[ LAMP_MAX ]; uniform vec4 lampC[ LAMP_MAX ]; uniform vec4 lampD[ LAMP_MAX ]; uniform vec4 lampInfo;
#endif`;
  C.common += `
#if defined( LAMBERT ) || defined( PHONG ) || defined( STANDARD )
${DECL}
#endif`;
  C.lights_pars_begin = DECL + '\n' + C.lights_pars_begin;
  // world position, and the normal turned back out of view space (three.js does not set cameraPosition
  // for a Lambert material, so the position comes from the model matrix)
  C.project_vertex += `
#ifdef LAMP_DECL
  vec4 lampW = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    lampW = instanceMatrix * lampW;
  #endif
  vLampP = ( modelMatrix * lampW ).xyz;
  vLampN = ( vec4( transformedNormal, 0.0 ) * viewMatrix ).xyz;
#endif`;
  // added to the diffuse light just before the shader sums it up. lampP: position, reach;
  // lampC: colour x brightness, and how fast it falls off; lampD: the way the lamp throws its light, and the cosine of its cone
  C.aomap_fragment += `
#ifdef LAMP_DECL
  if ( lampInfo.x > 0.5 ) {
    vec3 lampNrm = normalize( vLampN ) * ( gl_FrontFacing ? 1.0 : -1.0 );
    vec3 lampSum = vec3( 0.0 );
    for ( int i = 0; i < LAMP_MAX; i ++ ) {
      if ( float( i ) >= lampInfo.x ) break;
      vec3 lv = lampP[ i ].xyz - vLampP; float d2 = dot( lv, lv ), r2 = lampP[ i ].w * lampP[ i ].w;
      if ( d2 >= r2 ) continue;
      float d = sqrt( d2 ); lv /= max( d, 0.001 );
      float fall = 1.0 - d2 / r2; fall *= fall;
      float cone = smoothstep( lampD[ i ].w, lampD[ i ].w + 0.22, dot( - lv, lampD[ i ].xyz ) );
      // a little light wraps round the edge of a surface, as it does off the ground and the walls nearby
      float nl = max( dot( lampNrm, lv ) * 0.85 + 0.15, 0.0 );
      lampSum += lampC[ i ].rgb * ( nl * cone * fall / ( 1.0 + d2 * lampC[ i ].w ) );
    }
    reflectedLight.directDiffuse += lampSum * diffuseColor.rgb;
  }
#endif`;
  const u = { lampP: { value: LAMPLIT.P }, lampC: { value: LAMPLIT.C }, lampD: { value: LAMPLIT.D }, lampInfo: { value: LAMPLIT.info } };
  for (const k of ['lambert', 'phong', 'standard', 'physical']) if (THREE.ShaderLib[k]) Object.assign(THREE.ShaderLib[k].uniforms, u);
})();

/* What each kind of lamp is. col: the colour of its light; I: how bright; r: how far it reaches (m);
   k: how quickly it falls off with distance; down: the cosine of its cone round the vertical (-1: all
   round); glow: the glow's colour and size; on: the darkness at which its photocell (or the agent)
   switches it on, give or take a little for each lamp; warm: seconds to come up to full (a metal halide
   floodlight takes a while). */
const LAMP_KINDS = {
  plat: { col: 0xffbf78, I: 2.6, r: 12, k: 0.08, down: -1, glow: [1.0, 0.72, 0.42], gs: 1.5, on: 0.22 },
  street: { col: 0xffb466, I: 3.4, r: 24, k: 0.03, down: 0.35, glow: [1.0, 0.68, 0.36], gs: 1.7, on: 0.26 },
  flood: { col: 0xe4ecff, I: 4.5, r: 60, k: 0.008, down: 0.3, glow: [0.85, 0.9, 1.0], gs: 2.6, on: 0.3, warm: 40 },
  door: { col: 0xffcf8c, I: 2.4, r: 11, k: 0.08, down: 0.1, glow: [1.0, 0.78, 0.5], gs: 0.9, on: 0.25 },
  xing: { col: 0xff2410, I: 1.8, r: 10, k: 0.1, down: -1 },
  ditch: { col: 0xfff1d8, I: 7, r: 46, k: 0.004 },
};
const _lc = new THREE.Color();

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
/* one Points object for a list of glows ({p, c}); each item learns its index (i) */
function glowPoints(list, size, scene) {
  const n = list.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), sz = new Float32Array(n);
  list.forEach((l, i) => { pos.set([l.p.x, l.p.y, l.p.z], i * 3); col.set(l.c || [0, 0, 0], i * 3); sz[i] = l.gs || size; l.i = i; });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(col, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  const pts = new THREE.Points(g, glowMaterial()); pts.frustumCulled = false; pts.renderOrder = 4; pts.visible = false;
  scene.add(pts);
  return pts;
}

/* a lens that looks lit: a hot centre and the rings of a Fresnel lens, multiplied by the aspect's colour */
function lensTexture(lit) {
  return canvasTex(64, 64, (g, w) => {
    const c = w / 2, gr = g.createRadialGradient(c, c, 0, c, c, c);
    if (lit) { gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, '#f4f4f4'); gr.addColorStop(0.8, '#b8b8b8'); gr.addColorStop(1, '#707070'); }
    else { gr.addColorStop(0, '#5a5a5a'); gr.addColorStop(0.5, '#2c2c2c'); gr.addColorStop(1, '#1a1a1a'); }
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
    g.strokeStyle = lit ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.10)'; g.lineWidth = 1.2;
    for (let r = 6; r < c; r += 4.5) { g.beginPath(); g.arc(c, c, r, 0, TAU); g.stroke(); }
    if (!lit) { g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.ellipse(c - 9, c - 10, 7, 4, -0.6, 0, TAU); g.fill(); }
  });
}

function buildLamps(scene) {
  // signal lenses get their glass; the dark one shows a glint of the sky
  const lit = lensTexture(true);
  for (const k of ['lampG', 'lampR', 'lampY', 'lampL']) { SMAT[k].map = lit; SMAT[k].needsUpdate = true; }
  SMAT.lampOff.map = lensTexture(false); SMAT.lampOff.needsUpdate = true;
  // the glows of the fixed lamps, a Points object for each kind
  LAMPS.glows = [];
  for (const kind of ['plat', 'street', 'flood', 'door']) {
    const K = LAMP_KINDS[kind], list = LAMPS.lights.filter(l => l.kind === kind);
    if (!list.length) continue;
    const gl = list.map(l => ({ p: l.gp || l.p, c: [0, 0, 0], l }));
    LAMPS.glows.push({ kind, list: gl, pts: glowPoints(gl, K.gs, scene) });
  }
  for (const l of LAMPS.lights) { const K = LAMP_KINDS[l.kind]; l.lv = 0; l.at = K.on + (l.jit !== undefined ? l.jit : Math.random()) * 0.12; }
  // signal lenses: their colour comes from the aspect each one shows
  LAMPS.sig = [];
  for (const s of SCN.signals) for (const lens of s.heads) LAMPS.sig.push({ p: lens.userData.glowAt, lens });
  LAMPS.sigPts = glowPoints(LAMPS.sig, 0.9, scene);
  lampsSignals();
  xingBuild(scene);
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

/* how bright the lamps are for the darkness (0 day, 1 night); dt moves floodlights on toward full */
function lampsLight(dark) {
  if (!LAMPS.glows) return;
  LAMPS.dark = dark;
  if (SMAT.lampGlass) SMAT.lampGlass.emissiveIntensity = smooth(0.2, 0.35, dark) * 1.6;
  if (SMAT.streetGlass) SMAT.streetGlass.emissiveIntensity = smooth(0.26, 0.4, dark) * 2.2;
  if (SMAT.floodGlass) SMAT.floodGlass.emissiveIntensity = smooth(0.3, 0.45, dark) * 2.6;
  // a signal's lens is lit day and night; its glow is faint by day and comes up as the light goes
  if (LAMPS.sigPts) { const k = lerp(0.18, 1, smooth(0.05, 0.6, dark)); LAMPS.sigPts.material.uniforms.uK.value = k; LAMPS.sigPts.visible = true; }
  winLight(dark);
}
/* each lamp's photocell: on as the darkness passes its own setting. A metal halide floodlight strikes dim
   and takes a while to come up; anything goes out at once. A jump of the clock sets them straight away. */
function lampsLevels(dark, dt) {
  const gray = SKY.gray || 0, jump = Math.abs(dark - (LAMPS.lastDark === undefined ? -1 : LAMPS.lastDark)) > 0.08;
  LAMPS.lastDark = dark;
  for (const l of LAMPS.lights) {
    if (l.dyn) continue;
    const K = LAMP_KINDS[l.kind], want = smooth(l.at, l.at + 0.04, dark + gray * 0.12);
    l.lv = K.warm && want > l.lv && !jump ? Math.min(want, l.lv + dt / K.warm * (0.25 + l.lv)) : want;
  }
  for (const G of LAMPS.glows) {
    const K = LAMP_KINDS[G.kind], a = G.pts.geometry.attributes.aCol; let any = false, ch = false;
    for (const g of G.list) {
      const v = g.l.lv; if (v > 0.002) any = true;
      if (Math.abs(a.getX(g.i) - K.glow[0] * v) > 0.004) { a.setXYZ(g.i, K.glow[0] * v, K.glow[1] * v, K.glow[2] * v); ch = true; }
    }
    if (ch) a.needsUpdate = true;
    G.pts.material.uniforms.uK.value = 0.9; G.pts.visible = any;
  }
}

/* the lamps nearest the camera that are lit, handed to the shaders. A lamp fades out as it nears the edge
   of the chosen set, so nothing pops as the camera moves. */
const _lampCand = [];
function lampsPick(cam) {
  const cp = cam.position; _lampCand.length = 0;
  for (const l of LAMPS.lights) {
    if (!(l.lv > 0.002)) continue;
    const dx = l.p.x - cp.x, dy = l.p.y - cp.y, dz = l.p.z - cp.z, d = Math.max(0, Math.sqrt(dx * dx + dy * dy + dz * dz) - (l.r || LAMP_KINDS[l.kind].r) * 0.5);
    if (d > 700) continue;
    l.cd = d; _lampCand.push(l);
  }
  _lampCand.sort((a, b) => a.cd - b.cd);
  const n = Math.min(LAMP_MAX, _lampCand.length), edge = _lampCand.length > LAMP_MAX ? _lampCand[LAMP_MAX].cd : 700;
  const P = LAMPLIT.P, C = LAMPLIT.C, D = LAMPLIT.D;
  let k = 0;
  for (let i = 0; i < n; i++) {
    const l = _lampCand[i], K = LAMP_KINDS[l.kind];
    const f = l.lv * smooth(edge + 1, Math.max(edge * 0.7, edge - 60), l.cd);
    if (!(f >= 0.003)) continue;
    _lc.setHex(l.col || K.col).convertSRGBToLinear().multiplyScalar((l.I || K.I) * f);
    P[k * 4] = l.p.x; P[k * 4 + 1] = l.p.y; P[k * 4 + 2] = l.p.z; P[k * 4 + 3] = l.r || K.r;
    C[k * 4] = _lc.r; C[k * 4 + 1] = _lc.g; C[k * 4 + 2] = _lc.b; C[k * 4 + 3] = K.k;
    if (l.dir) { D[k * 4] = l.dir.x; D[k * 4 + 1] = l.dir.y; D[k * 4 + 2] = l.dir.z; D[k * 4 + 3] = l.cos; }
    else { D[k * 4] = 0; D[k * 4 + 1] = -1; D[k * 4 + 2] = 0; D[k * 4 + 3] = K.down === undefined ? -1 : K.down; }
    if (D[k * 4 + 3] <= -1) D[k * 4 + 3] = -2;   // all round: the cone test always passes
    k++;
  }
  LAMPLIT.info[0] = k;
}

function lampsFrame(cam, dt = 0) {
  const sc = innerHeight * Math.min(devicePixelRatio, 2) * 0.5 / Math.tan(cam.fov * Math.PI / 360);
  const pts = [LAMPS.sigPts, LAMPS.xPts, ...(LAMPS.glows || []).map(g => g.pts)];
  for (const p of pts) if (p) { const u = p.material.uniforms; u.uScale.value = sc; u.uFogD.value = scene.fog.density; u.uMin.value = Math.min(devicePixelRatio, 2) * 2; }
  xingTick(dt);
  ditchLamps();
  railLamps();
  if (LAMPS.glows) lampsLevels(SKY.dark || 0, dt);
  WIN.u.value[2] = S.time || 0;
  lampsPick(cam);
}

/* ---------------- house and depot windows ----------------
   Each window carries two random numbers in its uv (set when it is built) that decide when its room
   lights up at dusk, whether anybody is home, how warm and bright the lamp is, and when they go to bed
   (and whether they are up before dawn). The materials keep their own colours: warm, warmer, and a cool
   dim one for a hall light or a television. */
const WIN = { u: { value: new Float32Array(4) } };   // darkness, hour, time, overcast
function winMaterial(m) {
  m.onBeforeCompile = sh => {
    sh.uniforms.uWin = WIN.u;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWinR;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWinR = uv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vWinR; uniform vec4 uWin;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        float a = vWinR.x, b = vWinR.y, c = fract( a * 13.71 + b * 7.13 ), e = fract( a * 3.7 + b * 17.3 );
        float dark = uWin.x, h = uWin.y, n = h < 12.0 ? h + 24.0 : h;
        float dusk = smoothstep( 0.04 + a * 0.55, 0.09 + a * 0.55, dark );            // the room lights up as the evening draws in
        float bed = 21.0 + b * 4.5, wake = 28.6 + c * 2.2;                             // bed between 9 pm and 1:30 am; up from 4:36 am
        float home = step( 0.14, e ) * max( step( 0.9, b ), 1.0 - smoothstep( bed, bed + 0.05, n ) + smoothstep( wake, wake + 0.05, n ) );
        float lit = max( dusk * home, uWin.w * step( 0.55, e ) );                      // a gloomy day: some lamps on indoors
        float tv = step( 0.93, c ) * ( 0.75 + 0.25 * sin( uWin.z * 7.0 + a * 40.0 ) * sin( uWin.z * 2.3 + b * 20.0 ) );
        vec3 tint = mix( vec3( 1.0, 0.86, 0.66 ), vec3( 1.0, 1.04, 1.12 ), c * 0.6 );
        totalEmissiveRadiance *= tint * lit * ( 0.45 + 0.55 * e ) * mix( 1.0, tv * 0.55, step( 0.93, c ) );
        totalEmissiveRadiance = mix( totalEmissiveRadiance, totalEmissiveRadiance.bgr * vec3( 0.7, 0.9, 1.4 ), step( 0.93, c ) * 0.6 );
      }`);
  };
  m.customProgramCacheKey = () => 'win';
  return m;
}
function winLight(dark) {
  const w = WIN.u.value;
  w[0] = dark; w[1] = SKY.hour; w[3] = 0.35 * clamp(WX.P.gray / 0.55, 0, 1) * (1 - dark);
  for (const m of [SMAT.win, SMAT.win2, SMAT.win3]) if (m) m.emissiveIntensity = m.userData.litI || 0.9;
}

/* ---------------- grade crossings ----------------
   Each road crossing has flashing-light signals on both approaches (with gates on the paved roads).
   They start when a train is about 25 seconds off or right at the crossing, the gates come down a few
   seconds later, and everything clears once the train is past. */
const XING = { groups: [], t: 0, tick: 0 };
function xingBuild(scene) {
  XING.groups = SCN.xings || [];
  const all = [];
  for (const g of XING.groups) {
    g.on = false; g.idle = 0; g.since = 0; g.gate = 0; g.prev = new Map();
    for (const m of g.masts) for (const f of m.flash) all.push(f);
    g.lamps = g.masts.map(m => { const l = { kind: 'xing', p: m.lightAt, dyn: true, lv: 0, r: LAMP_KINDS.xing.r }; LAMPS.lights.push(l); return l; });
  }
  if (all.length) { LAMPS.xing = all; LAMPS.xPts = glowPoints(all, 1.1, scene); }
  // the lenses look lit through their glass; the lamps on a gate arm carry a glow of their own
  const lit = lensTexture(true), halo = xingHalo();
  for (const g of XING.groups) {
    g.matA = SMAT['xA' + g.id]; g.matB = SMAT['xB' + g.id]; g.matTip = SMAT['xT' + g.id];
    for (const m of [g.matA, g.matB, g.matTip]) if (m) { m.map = lit; m.needsUpdate = true; }
    for (const m of g.masts) m.armGlow = (m.armLamps || []).map(L => {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: 0xff3a22, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
      spr.position.copy(L.at); spr.scale.set(0.9, 0.9, 1); spr.visible = false; m.arm.add(spr);
      return { spr, ab: L.ab, tip: L.tip };
    });
  }
}
function xingHalo() {
  return canvasTex(64, 64, (g, w) => { const c = w / 2, gr = g.createRadialGradient(c, c, 0, c, c, c); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.15, 'rgba(255,255,255,0.7)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); }, { srgb: false });
}
/* how far (along the track) the nearest end of each train is from crossing c, walking both ways */
function xingFind(c, maxD, out) {
  const idx = IX.index();
  for (const o of [1, -1]) {
    routeWalk(c.edge, c.s, o, maxD, (e, a, b, d) => {
      const l = idx.get(e); if (!l) return false;
      const lo = Math.min(a, b), hi = Math.max(a, b);
      for (const it of l) if (it.s >= lo && it.s <= hi) {
        const dd = d + Math.abs(it.s - a), r = out.get(it.c) || { d: 1e9, sides: 0 };
        if (dd < r.d) r.d = dd;
        r.sides |= o > 0 ? 1 : 2; out.set(it.c, r);
      }
      return false;
    }, () => false);
  }
  return out;
}
function xingTick(dt) {
  if (!XING.groups.length) return;
  const run = GAME.running && !S.paused;
  if (run) XING.t += dt;
  XING.tick -= dt;
  if (run && XING.tick <= 0) {
    const step = 0.25 - XING.tick; XING.tick = 0.25;
    for (const g of XING.groups) {
      const seen = new Map();
      for (const c of g.cross) xingFind(c, 900, seen);
      let want = false;
      for (const [con, r] of seen) {
        const p = g.prev.get(con), closing = p ? (p - r.d) / step : 0;
        // straddling the crossing, or closing on it and due within about 25 seconds
        if (r.sides === 3 && r.d < 60) want = true;
        else if (closing > 0.3 && (r.d < 30 || r.d / closing < 25)) want = true;
      }
      g.prev = new Map([...seen].map(([con, r]) => [con, r.d]));
      if (want) { g.idle = 0; if (!g.on) { g.on = true; g.since = 0; } }
      else if (g.on && (g.idle += step) > 2.5 && (!g.gated || g.gate <= 0.001)) g.on = false;
      if (g.on) g.since += step;
    }
  }
  // the gates start down 4 s after the lights, take 10 s to come down and 8 s to go back up
  for (const g of XING.groups) {
    if (!g.gated) continue;
    const down = g.on && g.idle === 0 && g.since > 4;
    if (run) g.gate = clamp(g.gate + (down ? dt / 10 : -dt / 8), 0, 1);
    const ang = -Math.PI / 2 * 0.96 * (1 - (1 - Math.cos(Math.PI * g.gate)) / 2);
    for (const m of g.masts) if (m.arm) m.arm.rotation.x = ang;
  }
  // two lamps on each mast flash in turn, about 55 times a minute each; the bulbs take a moment to brighten and fade
  const ph = XING.t * 0.92, A = lampPulse(ph), B = lampPulse(ph + 0.5);
  const a = LAMPS.xPts ? LAMPS.xPts.geometry.attributes.aCol : null; let ch = false;
  const dk = SKY.dark || 0, day = lerp(0.45, 1, smooth(0.1, 0.6, dk));
  for (const g of XING.groups) {
    const on = g.on, va = on ? A : 0, vb = on ? B : 0;
    if (g.matA) { g.matA.color.setRGB(0.12 + 0.88 * va, 0.02 + 0.1 * va, 0.02 + 0.06 * va); g.matB.color.setRGB(0.12 + 0.88 * vb, 0.02 + 0.1 * vb, 0.02 + 0.06 * vb); }
    if (g.matTip) g.matTip.color.setRGB(on ? 1 : 0.12, on ? 0.1 : 0.02, on ? 0.06 : 0.02);
    if (a) for (const m of g.masts) for (const f of m.flash) {
      const v = (f.ab === 0 ? va : vb) * day; if (Math.abs(a.getX(f.i) - v) > 0.002) { a.setXYZ(f.i, v, v * 0.08, v * 0.04); ch = true; }
    }
    for (const l of g.lamps) l.lv = on ? Math.max(va, vb) : 0;
    for (const m of g.masts) for (const s of m.armGlow || []) { const v = s.tip ? (on ? 1 : 0) : (s.ab === 0 ? va : vb); s.spr.material.opacity = v * lerp(0.35, 1, dk); s.spr.visible = v > 0.01; }
  }
  if (ch) a.needsUpdate = true;
  if (LAMPS.xPts) { LAMPS.xPts.material.uniforms.uK.value = 1; LAMPS.xPts.visible = XING.groups.some(g => g.on); }
}
/* an incandescent flasher: up quickly, a soft top, fading out a little slower */
function lampPulse(ph) {
  const t = ph - Math.floor(ph);
  return t < 0.5 ? smooth(0, 0.08, t) : 1 - smooth(0.5, 0.62, t);
}

/* ---------------- ditch lights ----------------
   the player's diesel throws two pools of light ahead at the rails' edges */
const _dv = new THREE.Vector3(), _dq = new THREE.Vector3();
function ditchLamps() {
  if (!LAMPS.ditch) LAMPS.ditch = [0, 1].map(() => { const l = { kind: 'ditch', p: new THREE.Vector3(), dyn: true, lv: 0, dir: new THREE.Vector3(), cos: 0.82, r: LAMP_KINDS.ditch.r }; LAMPS.lights.push(l); return l; });
  const T = GAME.train, L = T && T.loco, on = T && L && L.ditch && L.ditch.length && (T.diesel ? S.ditch : true) && S.light > 0;
  LAMPS.ditch.forEach((l, k) => {
    if (!on || !L.ditch[k]) { l.lv = 0; return; }
    const lens = L.ditch[k].lens; lens.updateMatrixWorld();
    l.p.setFromMatrixPosition(lens.matrixWorld);
    // the lens faces along its own +z (a CircleGeometry turned to face forward); aim a little down
    _dv.set(0, 0, 1).transformDirection(lens.matrixWorld); _dv.y -= 0.12; l.dir.copy(_dv.normalize());
    l.p.addScaledVector(l.dir, 0.3);
    const b = S.ditchFlash > 0 ? (Math.floor(S.time * 2.6) % 2 === k ? 1 : 0.15) : 0.85;
    l.lv = b * smooth(0.15, 0.6, SKY.dark || 0);
  });
}

/* ---------------- the rear of the train ----------------
   A caboose or observation car on the rear of a train shows its red markers. A train ending in an
   ordinary freight car carries an end-of-train device on its last coupler instead, with a red lamp that
   flashes once a second or so. A cut of cars standing in a yard shows nothing. */
let _mkHalo = null;
function markerGlow(size) {
  if (!_mkHalo) _mkHalo = xingHalo();
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: _mkHalo, color: 0xff2a18, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
  s.scale.set(size, size, 1); s.visible = false; s.renderOrder = 5;
  return s;
}
function fredModel() {
  const g = new THREE.Group(), gb = new GeoBin();
  gb.box('case', 0.24, 0.3, 0.2, 0, 0.15, 0);              // the box, clamped on the knuckle
  gb.box('dark', 0.08, 0.06, 0.24, 0.05, -0.02, 0);
  gb.cyl('dark', 0.012, 0.012, 0.32, 5, -0.05, 0.46, 0.06); // whip antenna
  gb.cyl('dark', 0.055, 0.055, 0.08, 10, 0, 0.36, 0);
  g.add(gb.build({ case: RMAT.fredCase || (RMAT.fredCase = new THREE.MeshLambertMaterial({ color: 0xd9b21c })), dark: RMAT.dark }, { cast: false }));
  const mat = new THREE.MeshBasicMaterial({ color: 0x2a0806 });
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 6, 0, TAU, 0, Math.PI / 2), mat); lens.position.set(0, 0.4, 0); g.add(lens);
  const glow = markerGlow(1.0); glow.position.set(0, 0.42, 0); g.add(glow);
  g.userData = { mat, glow };
  return g;
}
function railLamps() {
  if (typeof IX === 'undefined' || !IX.consists) return;
  const dk = SKY.dark || 0, day = lerp(0.3, 1, smooth(0.1, 0.5, dk)), t = S.time || 0;
  for (const c of IX.consists()) {
    const vs = c.vehicles, n = vs.length; if (!n) continue;
    let rv = null, end = 0;
    if (vs.some(v => v.kind === 'loco') && n > 1) {
      // the rear is the end away from the engine
      if (c.li <= (n - 1) / 2) { rv = vs[n - 1]; end = rv.flip ? 1 : -1; } else { rv = vs[0]; end = rv.flip ? -1 : 1; }
      if (rv.kind === 'loco' || rv.kind === 'loco2' || rv.kind === 'tender') rv = null;
    }
    for (const v of vs) {
      if (!v.lamps) { if (v.markers && c.markerLamps) c.markerLamps(v); if (!v.lamps) continue; }
      const lit = v === rv && end === -1 ? 1 : 0;   // the markers are on the car's -x end
      if (v.lamps.lit !== lit || lit) {
        v.lamps.lit = lit;
        v.lamps.mat.color.setRGB(lit ? 1 : 0.16, lit ? 0.12 : 0.03, lit ? 0.07 : 0.02);
        for (const g of v.lamps.glows) { g.visible = !!lit; g.material.opacity = 0.9 * day; }
      }
    }
    // an end-of-train device where there are no markers to show
    const need = rv && !(rv.lamps && end === -1) && ['box', 'hopper', 'tank', 'gon', 'caboose'].includes(rv.kind);
    if (need) {
      if (!c.fred) c.fred = fredModel();
      const f = c.fred;
      if (f.parent !== rv.root || f.userData.end !== end) {
        rv.root.add(f); f.userData.end = end;
        f.position.set(end * (rv.len / 2 - 0.3), 1.12, 0.32); f.rotation.y = end > 0 ? 0 : Math.PI;
      }
      const ph = (t * 1.1) % 1, v = ph < 0.12 ? 1 : 0;
      f.userData.mat.color.setRGB(0.16 + 0.84 * v, 0.03 + 0.1 * v, 0.02 + 0.05 * v);
      f.userData.glow.visible = v > 0; f.userData.glow.material.opacity = day;
      f.visible = true;
    } else if (c.fred) { if (c.fred.parent) c.fred.parent.remove(c.fred); }
  }
}

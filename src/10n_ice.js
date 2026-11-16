/* ============================================================================
   Raven Lake: running on the ice, and what it does to the ice.

   The track across the lake is ties laid straight on the ice with no ballast
   to hold them, so it has little to resist a train pushing it sideways.
   Too fast through the curves out there and the track slews out from under
   the train; brake hard at speed and the slack running in buckles the train
   and it folds up across the ice. Either way the cars come off as wreck
   bodies (07d_wreck.js), and on the ice they slide a long way: steel on ice
   holds about a seventh of what steel on frozen ground does.

   And the ice answers back: a heavy train out on it sets long cracks running
   off across the lake with that singing ping lake ice makes; a car slamming
   down on it shatters a star of cracks; anything sliding over it throws up
   chips and powder and scores white scrape marks into it (10h_dig.js does
   the spray and the scars). On the cliff, the brake shoes throw sparks.
   ========================================================================== */
const ICE = {
  on: false, t: 0,
  MU: 0.075, TRIP: 0.1,           // wreck bodies on the ice: steel sliding on ice, and a little more for a car going sideways
  LAT: 0.95,                      // m/s2 of unbalanced side force the ties will take on the ice before the track slews
  SKID_V: 13.5,                   // m/s (30 mph): hard braking above this out on the ice buckles the train
  FAST: 30,                       // m/s (67 mph): straight track on the ice heaves and kinks under a train this fast
  LV_K: 0.5,                      // in-train side force a car on the ice can stand, against one on ballast
  creep: 0, skid: 0, fastT: 0, crackIn: 3, warnT: 0,
  segN: 0, seg: 0, dirty: false,
};
const _ica = new THREE.Vector3(), _icb = new THREE.Vector3();

/* which bits of a train are out on the ice */
function iceTP(tp) { return !!(tp && tp.e && tp.e.ice && tp.e.ice.length && tp.e.isIce(tp.s)); }
function iceCount(T) { let n = 0; for (const v of T.vehicles) if (v.tp && iceTP(v.tp[0])) n++; return n; }

/* ---------------- cracks ----------------
   A pool of thin quads lying on the ice, each with the moment it appears, so a crack runs out from where it
   started at the speed cracks run. They stay until the pool comes round to them again. */
function buildIceFX(scene) {
  ICE.on = !!WORLD.frost;
  ICE.frost = { value: ICE.on ? 0.8 : 0 };
  if (!ICE.on) return;
  const mobile = /iPhone|iPad|Android/i.test(navigator.userAgent) || Math.min(screen.width, screen.height) < 600;
  const n = ICE.SEG = mobile ? 1500 : 5000;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 4 * 3), 3));
  g.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(n * 4).fill(1e9), 1));
  g.setAttribute('aU', new THREE.BufferAttribute(new Float32Array(n * 4), 1));
  const idx = new (n * 4 > 65535 ? Uint32Array : Uint16Array)(n * 6);
  for (let i = 0; i < n; i++) { const k = i * 4; idx.set([k, k + 1, k + 2, k + 1, k + 3, k + 2], i * 6); }
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  ICE.U = { uTime: { value: 0 }, uCol: { value: new THREE.Color(1, 1, 1) } };
  ICE.cracks = new THREE.Mesh(g, new THREE.ShaderMaterial({
    uniforms: ICE.U, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    vertexShader: `#include <common>
      #include <logdepthbuf_pars_vertex>
      attribute float aT; attribute float aU; varying float vT; varying float vU; varying float vD;
      void main(){ vT = aT; vU = aU; vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float uTime; uniform vec3 uCol; varying float vT; varying float vU; varying float vD;
      void main(){
        #include <logdepthbuf_fragment>
        float a = smoothstep(vT, vT + 0.05, uTime);
        if (a <= 0.0) discard;
        // a bright fracture plane down the middle catching the light, a frosted halo either side
        float u = abs(vU), core = 1.0 - smoothstep(0.12, 0.45, u), halo = (1.0 - u) * 0.4;
        float far = 1.0 - smoothstep(250.0, 700.0, vD);
        gl_FragColor = vec4(uCol * (0.75 + 0.6 * core), (core + halo) * a * far);
      }`,
  }));
  ICE.cracks.frustumCulled = false; ICE.cracks.renderOrder = 2; ICE.cracks.visible = false;
  scene.add(ICE.cracks);
}
/* one crack segment from (x0, n0) to (x1, n1), w wide, appearing at time t */
function iceSeg(x0, n0, x1, n1, w, t) {
  const dx = x1 - x0, dn = n1 - n0, L = Math.hypot(dx, dn); if (L < 0.01) return;
  const sx = -dn / L * w / 2, sn = dx / L * w / 2, y = FROST.iceY + 0.012;
  const i = ICE.seg % ICE.SEG; ICE.seg++; ICE.segN = Math.min(ICE.SEG, ICE.segN + 1);
  const at = ICE.cracks.geometry.attributes, p = at.position.array, T = at.aT.array, U = at.aU.array, k = i * 4;
  const put = (j, X, N, u, tt) => { p[(k + j) * 3] = X; p[(k + j) * 3 + 1] = y; p[(k + j) * 3 + 2] = -N; U[k + j] = u; T[k + j] = tt; };
  // the far end appears a moment after the near end: the crack is seen running
  put(0, x0 + sx, n0 + sn, -1, t); put(1, x0 - sx, n0 - sn, 1, t); put(2, x1 + sx, n1 + sn, -1, t + L / 90); put(3, x1 - sx, n1 - sn, 1, t + L / 90);
  ICE.dirty = true;
}
/* a crack running from (X, N) heading h for about len metres, branching as it goes; it stops at the shore */
function iceRun(X, N, h, len, w, t, depth = 0, r = Math.random) {
  let x = X, n = N, a = h, s = 0;
  const speed = 140 + 60 * r();   // m/s: fast, but you see it go
  while (s < len) {
    const st = 0.8 + 1.6 * r();
    a += (r() - 0.5) * 0.5;
    const x1 = x + Math.cos(a) * st, n1 = n + Math.sin(a) * st;
    if (!frOnIce(x1, n1)) break;
    const ww = w * (1 - 0.6 * s / len);
    iceSeg(x, n, x1, n1, ww, t + s / speed);
    // a branch now and then, shorter and finer
    if (depth < 2 && r() < 0.045 * st) iceRun(x1, n1, a + (r() < 0.5 ? -1 : 1) * (0.4 + 0.8 * r()), (len - s) * (0.25 + 0.4 * r()), ww * 0.6, t + s / speed, depth + 1, r);
    x = x1; n = n1; s += st;
  }
}
/* a star of cracks from a point: power 0..1 */
function iceStar(X, N, power) {
  if (!ICE.on || !ICE.cracks || !frOnIce(X, N)) return;
  const t = ICE.t, nb = 3 + Math.round(5 * power), a0 = Math.random() * TAU;
  for (let k = 0; k < nb; k++) iceRun(X, N, a0 + k * TAU / nb + (Math.random() - 0.5) * 0.6, (3 + 26 * power) * (0.5 + Math.random()), 0.1 + 0.16 * power, t, 1);
  // a ring or two of shorter arcs round a hard hit
  if (power > 0.45) for (let k = 0; k < 6; k++) { const a = Math.random() * TAU, r = 3 + 6 * power * Math.random(); iceRun(X + Math.cos(a) * r, N + Math.sin(a) * r, a + Math.PI / 2, 3 + 5 * power, 0.07, t + r / 120, 2); }
  iceSound(power, Math.hypot(X - camera.position.x, -N - camera.position.z));
}

/* the sound lake ice makes when it cracks: a sharp tick, then a singing chirp falling away (the high notes travel
   through the sheet faster than the low ones, so they arrive first), and under a big one a deep boom */
function iceSound(power, dist) {
  if (typeof AU === 'undefined' || !AU.on) return;
  const g = clamp(power, 0.15, 1) / (1 + (dist / 120) ** 1.4); if (g < 0.01) return;
  const t = AU.ctx.currentTime + 0.01 + dist / 340;
  envNoise(t, 0.05, 3200, 3, 0.35 * g, AU.world, 'bandpass', AU.white, 0.001);
  for (let k = 0; k < 3; k++) { const f = 2400 + 900 * Math.random(); envTone(t + 0.01 + k * 0.035, 0.45 + 0.35 * power, f, 0.06 * g, AU.world, 'sine', 160 + 120 * Math.random()); }
  if (power > 0.5) envTone(t + 0.02, 1.4, 58, 0.5 * g, AU.world, 'sine', 32);
}

/* ---------------- the train on the ice ---------------- */
/* called from the sim each frame while the train is on the rails */
function iceStep(dt, T) {
  if (!ICE.on || S.derailed || !T || !T.lead) return;
  const lt = T.lead.leadPt && T.lead.leadPt.tp, onLead = iceTP(lt), n = iceCount(T), v = Math.abs(S.v);
  if (!n) { ICE.creep = ICE.skid = ICE.fastT = 0; return; }
  // a heavy train out on the ice: cracks shoot off across the lake from under it, more the faster and heavier it is
  ICE.crackIn -= dt * (0.25 + v / 10) * Math.min(1, n / 6);
  if (ICE.crackIn <= 0) {
    ICE.crackIn = 2 + 5 * Math.random();
    const on = T.vehicles.filter(x => x.tp && iceTP(x.tp[0]) && x.pos), x = on[(Math.random() * on.length) | 0];
    if (x) {
      x.tp[0].pose(FR);
      const side = Math.random() < 0.5 ? -1 : 1, X = FR.p.x + FR.r.x * side * 3.2, N = -(FR.p.z + FR.r.z * side * 3.2);
      const h = Math.atan2(-FR.r.z * side, FR.r.x * side) + (Math.random() - 0.5) * 0.9;
      const p = clamp(0.3 + v / 30, 0.3, 1);
      iceRun(X, N, h, (40 + 160 * Math.random()) * p, 0.12 + 0.12 * p, ICE.t);
      iceSound(0.35 + 0.4 * p, Math.hypot(X - camera.position.x, -N - camera.position.z));
    }
  }
  // the track slews: too much side force on a curve, where the ties have nothing but the ice to hold them
  if (onLead) {
    const ub = curveUnbalanced(lt, S.v);
    ICE.creep = ub > ICE.LAT ? ICE.creep + dt * (ub - ICE.LAT) * 1.6 : Math.max(0, ICE.creep - dt);
    if (ICE.creep > 0.6 && ICE.warnT <= 0) { toast('The track is shifting on the ice! Slow down.', 'bad', 2400, 'icecurve'); ICE.warnT = 3; }
    if (ICE.creep > 1.2) {
      lt.pose(FR); const k = lt.e.curv(lt.s), out = _ica.copy(FR.r).multiplyScalar(Math.sign(k) || 1);
      const L = T.lead, e = L.root.matrix.elements, side = Math.sign(out.x * e[8] + out.y * e[9] + out.z * e[10]) || 1;
      GAME.derail(`The track slewed out from under the engine on the ice at ${Math.round(v / MPH)} mph. Out on the lake the ties lie on bare ice with no ballast to hold them: take the curves there at the posted 25.`, 'Derailed', { a: 0, side, k: clamp(0.35 + ub / 6, 0.35, 0.9) });
      iceStar(FR.p.x, -FR.p.z, 1);
      return;
    }
  } else ICE.creep = Math.max(0, ICE.creep - dt);
  // straight track heaves under a train going much too fast: the joints kink and it goes over
  ICE.fastT = v > ICE.FAST ? ICE.fastT + dt : 0;
  if (ICE.fastT > 1.5) {
    const j = Math.min(T.vehicles.length - 1, 1 + ((Math.random() * 3) | 0)), x = T.vehicles[j];
    GAME.derail(`The rails kinked on the ice under the train at ${Math.round(v / MPH)} mph. Track laid on a frozen lake is good for 25.`, 'Derailed', { a: x.a0 + x.len / 2, side: Math.random() < 0.5 ? -1 : 1, k: 0.8 });
    if (x.pos) iceStar(x.pos.x, -x.pos.z, 1);
    return;
  }
  // braking hard out on the ice: the wheels pick up and slide, the slack runs in, and the train buckles
  const hard = v > ICE.SKID_V && (S.slideN > 0 || brakeZone(S.brakeH) === 'EMG' || (S.accel || 0) < -1.05);
  ICE.skid = hard ? ICE.skid + dt * v / ICE.SKID_V : Math.max(0, ICE.skid - dt * 2);
  if (hard && ICE.warnT <= 0) { toast('Wheels sliding on the ice: ease off the brake!', 'bad', 2400, 'iceskid'); ICE.warnT = 3; }
  if (ICE.skid > 1.4) {
    // the slack runs in hardest just behind the engine: the first heavy car there is shoved out sideways
    let j = Math.min(T.vehicles.length - 1, (T.li || 0) + 1);
    for (let q = j; q < T.vehicles.length; q++) if (T.vehicles[q].kind !== 'tender' && T.vehicles[q].tp && iceTP(T.vehicles[q].tp[0])) { j = q; break; }
    const x = T.vehicles[j];
    GAME.derail(`Jackknifed on the ice at ${Math.round(v / MPH)} mph. The wheels slid on the icy rail, the slack ran in hard and ${x.kind === 'tender' ? 'the tender' : 'the train'} buckled sideways off the track. Out on the lake, brake early and gently.`, 'Derailed', { a: x.a0 + x.len / 2, side: Math.random() < 0.5 ? -1 : 1, k: clamp(0.4 + (v - ICE.SKID_V) / 25, 0.4, 0.9) });
    if (x.pos) iceStar(x.pos.x, -x.pos.z, 0.9);
    return;
  }
  ICE.warnT = Math.max(0, ICE.warnT - dt);
}

/* a wreck body digging into or sliding over the ice (from digWreck): stars of cracks where it slams down, and a
   crack now and then along its path */
function iceDig(b, P, V, hs, dt) {
  if (!ICE.on) return;
  b.icT = (b.icT || 0) - dt;
  if (b.icT > 0) return;
  const down = -V.y * 1.5;
  if (down > 2.5) { iceStar(P.x, -P.z, clamp(down / 9, 0.25, 1)); b.icT = 0.35; }
  else if (hs > 2 && Math.random() < dt * hs * 0.12) { iceStar(P.x, -P.z, 0.15 + 0.1 * Math.random()); b.icT = 0.2; }
}

/* ---------------- the brakes on the cliff ----------------
   Brake shoes bearing hard on wheels turning fast throw sparks off the treads. Every braked wheel within reach of
   the camera, more the harder the brake and the faster the wheel; brightest at night. */
const _ibs = [];
function iceBrakeSparks(dt, T, cam) {
  if (!SPK.lines || !(dt > 0) || S.derailed || !GAME.running || S.paused) return;
  const v = Math.abs(S.v); if (v < 6) return;
  const cp = cam.position, out = _ibs; out.length = 0;
  for (const x of T.vehicles) {
    const bc = x.brake ? x.brake.BC : 0; if (bc < 30 || x.slide || !x.pos || x.pos.distanceTo(cp) > 140) continue;
    const k = (bc - 30) / 34;
    if (x.kind === 'loco' && !T.diesel && !T.elec) { for (const a of LG.aD) for (const z of [-RAIL_OFF, RAIL_OFF]) out.push([_ica.set(ax(a) - 0.5, 0.35, z * 1.05).applyMatrix4(x.root.matrix).clone(), k]); continue; }
    if (!x.trucks || !x.tp) continue;
    for (let q = 0; q < x.trucks.length; q++) {
      const t = x.trucks[q], sp = t.sp || 1.676;
      frameMatrix(x.tp[q].F, _sm); if (x.flip) _sm.multiply(_sn.makeRotationY(Math.PI));
      for (const px of t.type === 'four' ? [-0.865, 0.865] : [-sp, 0, sp]) for (const z of [-RAIL_OFF, RAIL_OFF]) out.push([_ica.set(px + (px < 0 ? -0.42 : 0.42), 0.3, z * 1.05).applyMatrix4(_sm).clone(), k]);
    }
  }
  if (!out.length) return;
  out.sort((a, b) => a[0].distanceToSquared(cp) - b[0].distanceToSquared(cp));
  const fwd = _icb.copy(T.lead.fwd).multiplyScalar(Math.sign(S.v)), side = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const rate = 26 * Math.min(1, v / 20) * (0.35 + 0.65 * (SKY.dark || 0));
  for (let i = 0; i < Math.min(out.length, 64); i++) {
    const [p, k] = out[i], w = rate * k / (1 + (p.distanceTo(cp) / 25) ** 2) * dt;
    let m = Math.floor(w + Math.random()); while (m-- > 0) sparkEmit(p, fwd, side, v * 0.35);
  }
}

/* ---------------- every frame ---------------- */
function iceFrame(dt, cam, T) {
  if (!ICE.on) return;
  ICE.t += dt;
  ICE.U.uTime.value = ICE.t;
  // the cracks catch whatever light there is: moonlight blue at night
  const d = SKY.dark || 0; ICE.U.uCol.value.setRGB(lerp(0.95, 0.42, d), lerp(0.97, 0.5, d), lerp(1.0, 0.62, d));
  if (ICE.dirty) { const at = ICE.cracks.geometry.attributes; at.position.needsUpdate = at.aT.needsUpdate = at.aU.needsUpdate = true; ICE.dirty = false; ICE.cracks.visible = true; }
  if (T) iceBrakeSparks(dt, T, cam);
  // the windows frost over in the cold; a cab with the fire going keeps the middle of the glass clear
  ICE.frost.value = 0.8;
}

/* After a wreck on the lake: lift the train back onto the main on the far shore,
   facing up the climb, so the lap can go on. */
function iceRerailFar() {
  const T = GAME.train, M = FROST.main; if (!T || !M) return;
  GAME.rerail();
  const s = FROST.sIce[1] + 160 + T.length;
  const loc = M.locate(Math.min(s, M.len - 5));
  T.place(new TrackPos(loc.edge, loc.s, 1));
  S.v = 0; S.vw = 0; MP.dirty = true;
  toast('Re-railed on the far shore. The climb back to Hollow Pine is ahead.', 'good', 4000);
}

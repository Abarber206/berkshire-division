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
  CAP_D: 1.1, CAP_A: 0.055,       // m and rad: how close to the far rails a skating train must come to drop back on
  JACK: 3.0,                      // m/s2 of side force: a skating train swung harder than this slides out and jackknifes
  LV_K: 0.5,                      // in-train side force a car on the ice can stand, against one on ballast
  crackIn: 3, warnT: 0,
  segN: 0, seg: 0, dirty: false,
};
const _ica = new THREE.Vector3(), _icb = new THREE.Vector3();

/* which bits of a train are out on the ice */
function iceTP(tp) { if (tp && tp.tp) tp = tp.tp; return !!(tp && tp.e && tp.e.ice && tp.e.ice.length && tp.e.isIce(tp.s)); }   // a TrackPos, or a truck point holding one
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
        // a crack runs out, glints, and frosts back over within a minute
        float a = smoothstep(vT, vT + 0.05, uTime) * (1.0 - smoothstep(vT + 20.0, vT + 55.0, uTime));
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
  if (!n) { if (ICE.sk.on) iceSkateEnd(); return; }
  // a heavy train out on the ice: cracks shoot off across the lake from under it, more the faster and heavier it is
  ICE.crackIn -= dt * Math.max(0, v - 9) / 20 * Math.min(1, n / 6);   // only a fast, heavy train sets the ice cracking
  if (ICE.crackIn <= 0) {
    ICE.crackIn = 6 + 10 * Math.random();
    const on = T.vehicles.filter(x => x.tp && iceTP(x.tp[0]) && x.pos), x = on[(Math.random() * on.length) | 0];
    if (x) {
      x.tp[0].tp.pose(FR);
      const side = Math.random() < 0.5 ? -1 : 1, X = FR.p.x + FR.r.x * side * 3.2, N = -(FR.p.z + FR.r.z * side * 3.2);
      const h = Math.atan2(-FR.r.z * side, FR.r.x * side) + (Math.random() - 0.5) * 0.9;
      const p = clamp(0.3 + v / 30, 0.3, 1);
      iceRun(X, N, h, (40 + 160 * Math.random()) * p, 0.12 + 0.12 * p, ICE.t);
      iceSound(0.35 + 0.4 * p, Math.hypot(X - camera.position.x, -N - camera.position.z));
    }
  }
  iceSkate(dt, T);
  ICE.warnT = Math.max(0, ICE.warnT - dt);
}

/* a wreck body digging into or sliding over the ice (from digWreck): stars of cracks where it slams down, and a
   crack now and then along its path */
/* ---------------- skating the lake ----------------
   There are no rails out on the ice. The train runs off the end of the track at the shore and goes on across
   the lake on its wheels, wherever the engine points. The engine writes its path as it goes, as a side offset
   from the surveyed line (one sample a metre), and every truck behind reads the same path back through the
   edge's pose (02_track.js), so the cars follow it the way a train follows its rails. The crew can swing it:
   sand under the left or right drivers (A and D) with steam or power on bites that side and turns her, the
   train brake steadies her, the engine brake alone lets the cars shove and swing her harder. Come up to the
   rails on the far shore close enough and square enough and she drops back on; miss, and she ploughs into
   the bank. */
ICE.sk = { on: false, live: false, E: null, a: 0, b: 0, PX: null, PN: null, PH: null, o: 0, lo: 0, hi: 0, openLo: false, openHi: false,
  H: 0, w: 0, v: 0, cap: 0, steer: 0, kickT: 1, jackT: 0, hud: null };
const _isk = new THREE.Vector3(), _isz = new THREE.Vector2();
const SK_N = 12000, SK_Z = 6000;   // path samples, one a metre, and the index of the start
function iceSkating() { return !!(ICE.on && ICE.sk.on); }
function iceSkateEdge() {   // the main line's edge across the lake
  const k = ICE.sk; if (k.E) return k.E;
  for (const e of NET.edges) if (e.ice && e.ice.length) {
    const r = e.ice[0]; k.E = e; k.a = r[0]; k.b = r[1];
    k.PX = new Float64Array(SK_N); k.PN = new Float64Array(SK_N); k.PH = new Float64Array(SK_N);
    e.sk = iceSkatePose; break;
  }
  return k.E;
}
/* The path is kept by its own length: s on the edge is the distance along the path (sample σ = s - o), so the
   trucks stay their proper distance apart however far she swings off the surveyed line. Past either written end
   it runs straight on (or, where that end is rails, the rails take over). */
function iceSkateAt(s, out) {
  const k = ICE.sk; let f = s - k.o;
  if (f < k.lo && !k.openLo) return false;
  if (f > k.hi && !k.openHi) return false;
  let j, t, X, N, H;
  if (f <= k.lo) { j = k.lo + SK_Z; H = k.PH[j]; X = k.PX[j] + Math.cos(H) * (f - k.lo); N = k.PN[j] + Math.sin(H) * (f - k.lo); }
  else if (f >= k.hi) { j = k.hi + SK_Z; H = k.PH[j]; X = k.PX[j] + Math.cos(H) * (f - k.hi); N = k.PN[j] + Math.sin(H) * (f - k.hi); }
  else { const i = Math.floor(f); t = f - i; j = i + SK_Z; X = lerp(k.PX[j], k.PX[j + 1], t); N = lerp(k.PN[j], k.PN[j + 1], t); H = k.PH[j] + Math.atan2(Math.sin(k.PH[j + 1] - k.PH[j]), Math.cos(k.PH[j + 1] - k.PH[j])) * t; }
  out.X = X; out.N = N; out.H = H; return true;
}
const _skq = { X: 0, N: 0, H: 0 };
/* Edge.pose hook: put the frame on the skated path, level on the ice */
function iceSkatePose(s, out) {
  const k = ICE.sk; if (!k.live || !iceSkateAt(s, _skq)) return;
  const c = Math.cos(_skq.H), sn = Math.sin(_skq.H);
  out.p.set(_skq.X, FROST.iceY + ICE_RAIL, -_skq.N); out.f.set(c, 0, -sn); out.r.set(sn, 0, c); out.u.set(0, 1, 0);
}
function iceSkateEnd() {
  const k = ICE.sk; k.on = false; k.live = false; k.cap = 0; k.steer = 0; k.jackT = 0; k.v = 0;
  if (k.hud) k.hud.hidden = true;
  iceSkatePads(false);
}
function iceSkateReset() { if (ICE.sk.PX) iceSkateEnd(); }
/* the end of the train that is going first, as a track position */
function iceSkateLead(T) { return (ICE.sk.v || S.v) >= 0 ? T.endTP('front') : T.endTP('rear'); }
/* slide every tracked point of the train (and the path's origin with it) along the edge by d: nothing moves in
   the world, the numbers just make room on the edge */
function iceSkateShift(T, d) {
  const k = ICE.sk; for (const p of T.pts) if (p.tp.e === k.E) p.tp.s += d; k.o += d;
}

function iceSkate(dt, T) {
  const k = ICE.sk, E = iceSkateEdge(); if (!E || !(dt > 0)) return;
  let tp = iceSkateLead(T); const onE = tp.e === E;
  if (!k.on) {
    if (!onE || tp.s <= k.a || tp.s >= k.b) return;
    // off the end of the rails: the path starts where she leaves them, heading the way the rails ran
    const u0 = S.v * tp.o, j = SK_Z;
    E.pose(tp.s, FR); k.o = tp.s; k.lo = k.hi = 0;
    k.PX[j] = FR.p.x; k.PN[j] = -FR.p.z; k.PH[j] = Math.atan2(-FR.f.z, FR.f.x);
    k.openLo = u0 < 0; k.openHi = u0 >= 0;   // the end she came from is rails
    k.on = true; k.live = true; k.w = (Math.random() - 0.5) * 0.03; k.v = S.v; k.cap = 0; k.jackT = 0;
    // creeping off the rail end, the skate can start and stop over and over: only bang and crack the ice once,
    // and only when she drops off with some speed
    const fresh = !(ICE.t - (k.t0 || -99) < 4); k.t0 = ICE.t;
    if (fresh && Math.abs(S.v) > 3) { iceStar(FR.p.x, -FR.p.z, 0.8); if (AU.on) sndClunk(1, 0); }
    if (fresh) toast('Off the end of the rails and out on the ice! Steer with the sanders (A / D) and the throttle, and line her up with the lanterns on the far shore.', 'warn', 7000, 'skate');
  }
  // speed: she rolls on her wheels with nothing to hold her to a line; power pushes a little, the brakes drag a little
  const v0 = k.v;
  let bcAll = 0, nb = 0; for (const x of T.vehicles) if (x.brake) { bcAll += x.brake.BC; nb++; }
  const fAll = clamp(nb ? bcAll / nb / 64 : 0, 0, 1), fLoco = clamp(T.lead.brake ? T.lead.brake.BC / 64 : 0, 0, 1);
  const thr = S.derailed ? 0 : S.throttle * (Math.abs(S.reverser) > 0.05 ? 1 : 0), dirT = Math.sign(S.reverser) || 0;
  const drag = 0.04 + 0.66 * fAll + 0.002 * v0 * v0 / 30;
  let nv = v0 + 0.45 * thr * dirT * dt;
  nv = Math.abs(nv) <= drag * dt ? 0 : nv - Math.sign(nv) * drag * dt;
  k.v = nv; S.v = nv; S.vw = nv + thr * dirT * 6;   // the drivers spin on the ice under power
  const v = Math.abs(nv), u = nv * tp.o;              // u: speed along the edge
  if (!onE) { iceSkateCheckEnd(T); return; }
  // keep the whole train on the edge: once every point is out on the path, move the numbers back from the edge's end
  if (!k.cap) {
    let mn = Infinity, mx = -Infinity, all = true;
    for (const p of T.pts) { if (p.tp.e !== E) { all = false; break; } mn = Math.min(mn, p.tp.s); mx = Math.max(mx, p.tp.s); }
    if (all && (mx > E.len - 80 || mn < 80)) {
      const d = mx > E.len - 80 ? Math.max(-(mn - 20), -1500) : Math.min(E.len - 20 - mx, 1500);
      iceSkateShift(T, d); k.openLo = k.openHi = true; tp = iceSkateLead(T);
    }
  }
  const f = tp.s - k.o, ahead = u > 0 ? f > k.hi : f < k.lo;
  if (ahead && !k.cap) {
    // swing: sand on one side with power on, shoving cars with only the engine braked, the ice's own ripples
    // the sanders turn her by side force, not by a fixed rate: at speed the same sand swings her slower,
    // so steering alone never pulls past the jackknife limit (shoving with the engine brake still can)
    const steer = k.steer * (0.04 + 0.12 * thr) * Math.min(1, v / 6) * Math.min(1, 30 / Math.max(v, 1));
    const shove = Math.max(0, fLoco - fAll) * (2.2 * k.w + 0.06 * (Math.sign(k.w) || 1)) * Math.min(1, v / 10);
    const damp = 0.45 + 1.0 * thr + 1.6 * fAll;
    k.kickT -= dt; if (k.kickT <= 0) { k.kickT = 0.8 + 2.2 * Math.random(); k.w += (Math.random() - 0.5) * 0.035 * Math.min(1, v / 15) * Math.min(1, 20 / Math.max(v, 1)); }
    k.w += (steer + shove - damp * k.w) * dt; k.w = clamp(k.w, -0.3, 0.3);
    // lay the path down to here, a metre at a time, turning as she turns (w: anticlockwise)
    const end = u > 0 ? k.hi : k.lo, H0 = k.PH[end + SK_Z], H1 = H0 + k.w * dt;
    if (u > 0) { const n = Math.floor(f) - k.hi; for (let q = 1; q <= n && k.hi + SK_Z + 1 < SK_N; q++) { const j = k.hi + SK_Z, H = lerp(H0, H1, q / n); k.PX[j + 1] = k.PX[j] + Math.cos(H); k.PN[j + 1] = k.PN[j] + Math.sin(H); k.PH[j + 1] = H; k.hi++; } }
    else { const n = k.lo - Math.ceil(f); for (let q = 1; q <= n && k.lo + SK_Z - 1 >= 0; q++) { const j = k.lo + SK_Z, H = lerp(H0, H1, q / n); k.PX[j - 1] = k.PX[j] - Math.cos(H); k.PN[j - 1] = k.PN[j] - Math.sin(H); k.PH[j - 1] = H; k.lo--; } }
    k.PH[(u > 0 ? k.hi : k.lo) + SK_Z] = H1;
    // swung too hard: she slides out sideways and the train jackknifes across the ice
    const lat = v * Math.abs(k.w);
    k.jackT = lat > ICE.JACK ? k.jackT + dt : Math.max(0, k.jackT - dt);
    if (lat > ICE.JACK * 0.7 && ICE.warnT <= 0) { toast('She is sliding out! Ease the swing: train brake or straighten up.', 'bad', 2200, 'skatejack'); ICE.warnT = 2.5; }
    if (k.jackT > 0.6) {
      const j = Math.min(T.vehicles.length - 1, (T.li || 0) + 2), x = T.vehicles[j];
      GAME.derail(`Jackknifed out on the ice at ${Math.round(v / MPH)} mph: swung too hard, the engine slid out and the train folded up behind her.`, 'Jackknifed', { a: x.a0 + x.len / 2, side: Math.sign(k.w) || 1, k: 1 });
      return;
    }
  } else if (!ahead) k.w *= Math.max(0, 1 - dt * 2);
  const A = iceSkateAim(T);
  tp.pose(FR);
  const sh = frShore(FR.p.x, -FR.p.z);
  if (!k.cap && v > 0.2 && A.dist < Math.max(1.2, v * dt * 2)) {
    if (Math.abs(A.off) < ICE.CAP_D && Math.abs(A.ang) < ICE.CAP_A) {
      // dropped back on: put her at the end of the rails, and ease the last of the path onto their line
      k.cap = 1;
      const fw = u > 0, tgt = fw ? k.b : k.a, sg = fw ? 1 : -1;
      iceSkateShift(T, tgt - tp.s);
      const [Xt, Nt] = E.xz(tgt), h = E.heading(tgt), fe = tgt - k.o;
      if (fw) { k.hi = Math.floor(fe); k.openHi = false; } else { k.lo = Math.ceil(fe); k.openLo = false; }
      for (let q = 0; q <= 45; q++) {
        const j = (fw ? k.hi - q : k.lo + q) + SK_Z; if (j < 0 || j >= SK_N) break;
        const w = 1 - smooth(0, 45, q), back = (Math.abs(fe - (j - SK_Z))) * sg;
        k.PX[j] = lerp(k.PX[j], Xt - Math.cos(h) * back, w); k.PN[j] = lerp(k.PN[j], Nt - Math.sin(h) * back, w);
        k.PH[j] = k.PH[j] + Math.atan2(Math.sin(h - k.PH[j]), Math.cos(h - k.PH[j])) * w;
      }
      if (AU.on) { sndClunk(1, 0); sndClunk(1, 0.12); }
      toast(`Back on the rails! Missed by only ${(Math.abs(A.off) * 100).toFixed(0)} cm.`, 'good', 5000, 'skate');
      iceStar(FR.p.x, -FR.p.z, 0.6);
    } else {
      GAME.derail(`Missed the rails on the far shore by ${Math.abs(A.off).toFixed(1)} m${Math.abs(A.ang) >= ICE.CAP_A ? `, coming in ${(Math.abs(A.ang) * 180 / Math.PI).toFixed(0)}° off square` : ''}. She ploughed into the bank at ${Math.round(v / MPH)} mph.`, 'Missed the rails', { a: k.v >= 0 ? 0 : T.length, side: Math.sign(A.off) || 1, k: 1 });
      return;
    }
  } else if (!k.cap && v > 1 && A.dist > 40 && Math.abs(tp.s - k.o) > 60 && (sh > -1.5 || groundAt(FR.p.x + FR.f.x * Math.sign(u || 1) * 3, -(FR.p.z + FR.f.z * Math.sign(u || 1) * 3)) > FROST.iceY + 0.5)) {
    GAME.derail(`Ran out of ice: she skated ${Math.abs(A.off).toFixed(0)} m off the line of the rails and up onto the shore at ${Math.round(v / MPH)} mph.`, 'Ran aground', { a: k.v >= 0 ? 0 : T.length, side: Math.sign(A.off) || 1, k: 1 });
    return;
  }
  iceSkateSpray(dt, T, v);
  iceSkateHud(A);
  iceSkateCheckEnd(T);
}
/* the train is all off the ice again: the path is finished with */
function iceSkateCheckEnd(T) {
  const k = ICE.sk;
  for (const p of T.pts) { const t = p.tp; if (t.e === k.E && iceSkateAt(t.s, _skq)) return; }
  iceSkateEnd();
}
/* snow and frost kicked up by the wheels, a white plume when she is swinging */
function iceSkateSpray(dt, T, v) {
  if (typeof DIG === 'undefined' || !DIG.dust || v < 3) return;
  const k = ICE.sk, sw = Math.min(1, v * Math.abs(k.w) / 1.2);
  for (const x of T.vehicles) {
    if (!x.pos || !x.tp || !iceTP(x.tp[0])) continue;
    if (x.pos.distanceToSquared(camera.position) > 500 * 500) continue;
    let n = (x === T.lead ? 6 : 1.5) * (0.4 + sw * 2) * Math.min(1, v / 20) * dt * 10 * (DIG.q || 1);
    for (; n > 0; n--) {
      if (n < 1 && Math.random() > n) break;
      const sd = Math.random() < 0.5 ? -1 : 1, fx = x.fwd || _isk.set(1, 0, 0);
      const px = x.pos.x - fx.z * sd * 1.6 + (Math.random() - 0.5) * x.len * 0.8 * fx.x, pz = x.pos.z + fx.x * sd * 1.6 + (Math.random() - 0.5) * x.len * 0.8 * fx.z;
      digEmit(DIG.dust, px, FROST.iceY + 0.3, pz, -fx.z * sd * (1 + 3 * sw) + (Math.random() - 0.5), 0.5 + 1.5 * Math.random() * (0.3 + sw), fx.x * sd * (1 + 3 * sw) + (Math.random() - 0.5),
        0.8 + 1.6 * Math.random() * (0.4 + sw), 1.5 + 2.5 * Math.random(), 0.88, 0.92, 0.97, FROST.iceY, null);
    }
  }
  DIG.dust.pts.visible = true;
}
/* how she is lined up with the rails she is heading for: how far right of their line (carried on out across the
   ice) the engine is, how many degrees she is turned left of them (+ = left), and how far there is to go */
function iceSkateAim(T) {
  const k = ICE.sk, E = k.E, tp = iceSkateLead(T), u = k.v * tp.o, fw = u >= 0, sEnd = fw ? k.b : k.a;
  const [Xt, Nt] = E.xz(sEnd), h = E.heading(sEnd) + (fw ? 0 : Math.PI);
  tp.pose(FR); const X = FR.p.x, N = -FR.p.z, th = Math.atan2(-FR.f.z, FR.f.x) + (tp.o > 0 === fw ? 0 : Math.PI);
  const dx = X - Xt, dn = N - Nt;
  return { off: dx * Math.sin(h) - dn * Math.cos(h), ang: Math.atan2(Math.sin(th - h), Math.cos(th - h)), dist: -(dx * Math.cos(h) + dn * Math.sin(h)) };
}
function iceSkateHud(A) {
  const k = ICE.sk;
  if (!k.hud) { k.hud = document.createElement('div'); k.hud.id = 'skateHud'; k.hud.style.cssText = 'position:fixed;left:50%;top:64px;transform:translateX(-50%);padding:8px 14px;border-radius:8px;background:rgba(10,14,22,.72);color:#f2e6c8;font:600 14px/1.35 system-ui,sans-serif;text-align:center;pointer-events:none;z-index:30;white-space:nowrap'; document.body.appendChild(k.hud); }
  k.hud.hidden = false;
  iceSkatePads(true);
  if (k.cap) { k.hud.textContent = 'Back on the rails'; return; }
  const deg = A.ang * 180 / Math.PI, good = Math.abs(A.off) < ICE.CAP_D && Math.abs(A.ang) < ICE.CAP_A;
  const side = Math.abs(A.off) < 0.05 ? 'dead in line' : `${Math.abs(A.off).toFixed(1)} m ${A.off > 0 ? 'right' : 'left'} of their line`;
  const head = Math.abs(deg) < 0.2 ? 'square' : `turned ${Math.abs(deg).toFixed(1)}° ${deg > 0 ? 'left' : 'right'}`;
  k.hud.innerHTML = `Far rails ${Math.max(0, A.dist).toFixed(0)} m · <span style="color:${good ? '#9fe08a' : '#ffb070'}">${side}, ${head}</span><br><span style="opacity:.7;font-weight:500;font-size:12px">A / D (or the buttons) sand left / right · throttle swings her harder · train brake steadies her</span>`;
}


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
    if (x.tp && iceTP(x.tp[0])) continue;   // no rails out on the lake to strike sparks from
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
  if (ICE.sk.hud && !ICE.sk.hud.hidden && (S.derailed || !ICE.sk.on)) { ICE.sk.hud.hidden = true; iceSkatePads(false); }
  iceMirror(cam);
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

/* ---------------- the ice as a mirror ----------------
   Clear black ice reflects: the train, its lamps, the moonlit hills. Each frame (on a PC, near the lake) the
   scene is drawn once more at half size from the camera mirrored in the ice, clipped at the ice by an oblique
   near plane, and the ice shader (05e_frost.js) looks it up where the ice is bare. */
const MIR = { rt: null, cam: null, mat: new THREE.Matrix4(), on: false, plane: new THREE.Plane(), clip: new THREE.Vector4(), q: new THREE.Vector4(),
  U: { uMirror: { value: null }, uMirrorM: { value: new THREE.Matrix4() }, uMirrorOn: { value: 0 } } };
function iceMirror(cam) {
  // on with the High or Ultra graphics setting, phone or PC (Auto picks High on a PC, Medium on a phone)
  const mobile = !(typeof POST !== 'undefined' && (POST.key === 'high' || POST.key === 'ultra'));
  const near = FROST.box && cam.position.y - FROST.iceY < 600 && typeof frShore === 'function' && frShore(cam.position.x, -cam.position.z) < 900;
  MIR.U.uMirrorOn.value = 0;
  if (mobile || !near || !FROST.iceMesh || typeof renderer === 'undefined') return;
  const r = renderer, sz = r.getDrawingBufferSize(_isz), w = Math.max(2, sz.x >> 1), h = Math.max(2, sz.y >> 1);
  if (!MIR.rt) { MIR.rt = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }); MIR.cam = new THREE.PerspectiveCamera(); MIR.U.uMirror.value = MIR.rt.texture; }
  if (MIR.rt.width !== w || MIR.rt.height !== h) MIR.rt.setSize(w, h);
  const y0 = FROST.iceY, V = MIR.cam;
  cam.updateMatrixWorld();
  // the camera mirrored in the ice: position, the point it looks at and its up all reflected in the plane
  const p = cam.position, d = _ica.set(0, 0, -1).applyQuaternion(cam.quaternion), up = _icb.set(0, 1, 0).applyQuaternion(cam.quaternion);
  V.position.set(p.x, 2 * y0 - p.y, p.z);
  V.up.set(up.x, -up.y, up.z);
  V.lookAt(p.x + d.x, 2 * y0 - (p.y + d.y), p.z + d.z);
  V.fov = cam.fov; V.aspect = cam.aspect; V.near = cam.near; V.far = Math.min(cam.far, 6000);
  V.updateMatrixWorld(); V.updateProjectionMatrix();
  // oblique near plane on the ice, so nothing under it (the lake bed) gets in the way
  MIR.plane.setFromNormalAndCoplanarPoint(_ica.set(0, 1, 0), _icb.set(0, y0, 0)).applyMatrix4(V.matrixWorldInverse);
  const c = MIR.clip.set(MIR.plane.normal.x, MIR.plane.normal.y, MIR.plane.normal.z, MIR.plane.constant), P = V.projectionMatrix.elements, q = MIR.q;
  q.set((Math.sign(c.x) + P[8]) / P[0], (Math.sign(c.y) + P[9]) / P[5], -1, (1 + P[10]) / P[14]);
  c.multiplyScalar(2 / c.dot(q));
  P[2] = c.x; P[6] = c.y; P[10] = c.z + 1 - 0.003; P[14] = c.w;
  V.projectionMatrixInverse.copy(V.projectionMatrix).invert();
  MIR.U.uMirrorM.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(V.projectionMatrix).multiply(V.matrixWorldInverse);
  // draw it: no shadow update, no ice, no cracks
  const sh = r.shadowMap.autoUpdate, rt0 = r.getRenderTarget();
  r.shadowMap.autoUpdate = false; FROST.iceMesh.visible = false; const cv = ICE.cracks ? ICE.cracks.visible : false; if (ICE.cracks) ICE.cracks.visible = false;
  r.setRenderTarget(MIR.rt); r.clear(); r.render(scene, V);
  r.setRenderTarget(rt0); r.shadowMap.autoUpdate = sh; FROST.iceMesh.visible = true; if (ICE.cracks) ICE.cracks.visible = cv;
  MIR.U.uMirrorOn.value = 1;
}

/* touch steering while skating: two big buttons, hold one to sand that side (the same as holding A or D) */
function iceSkatePads(on) {
  const k = ICE.sk;
  if (!k.pads) {
    if (!on) return;
    const box = k.pads = document.createElement('div');
    box.id = 'skatePads';
    box.style.cssText = 'position:fixed;left:0;right:0;bottom:34%;display:flex;justify-content:space-between;padding:0 max(16px,env(safe-area-inset-left));pointer-events:none;z-index:31';
    for (const [dir, label] of [[1, '◀ Sand left'], [-1, 'Sand right ▶']]) {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = 'pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;min-width:120px;height:84px;padding:0 18px;border-radius:14px;border:2px solid rgba(242,230,200,.5);background:rgba(10,14,22,.62);color:#f2e6c8;font:700 17px system-ui,sans-serif';
      const down = e => { e.preventDefault(); k.steer = dir; b.style.background = 'rgba(200,150,60,.75)'; };
      const up = e => { if (k.steer === dir) k.steer = 0; b.style.background = 'rgba(10,14,22,.62)'; };
      b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
      box.appendChild(b);
    }
    document.body.appendChild(box);
  }
  k.pads.hidden = !on;
  if (!on) k.steer = 0;
}

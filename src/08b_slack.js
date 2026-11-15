/* ============================================================================
   Slack action. The physics (08_physics.js) moves the train as one body; this rides on top of it and lets
   every car run a little ahead of or behind where that body puts it, held to its neighbours by its couplers.
   Each joint has some free slack (the knuckles' play and the draft gear's give) and then a draft gear: a soft
   spring for the first couple of inches, then solid, and a friction gear gives back only part of what it took.
   So when the engine opens up, the slack comes out one car at a time; when the brakes go on at the head end
   first (the brake pipe empties from the front), the cars behind run in on it. Bangs where the slack closes
   hard, the lurch in the cab, and a knuckle that breaks under too much pull parts the train, which then goes
   into emergency like a real one does when its brake hoses pull apart.
   ========================================================================== */
const SLK = {
  K1: 8e6,        // draft gear, first stage (N/m)
  SOFT: 0.065,    // ...for its first 2-1/2 in of travel
  K2: 8e7,        // then it goes solid
  C: 1.2e5,       // damping while the gear is working (N s/m)
  UNLOAD: 0.35,   // a friction draft gear gives back about a third of what went in
  BREAK: 2.2e6,   // a knuckle gives at about 500,000 lbf of pull
  CLANK: 0.12,    // slack closing faster than this (m/s) is heard
  HZ: 240,        // substeps a second
  on: true,
};
/* free slack at a joint (m): tight-lock passenger couplers and the engine's drawbar have little, freight a lot more */
function slkGap(a, b) {
  const tight = v => v.kind === 'coach' || v.kind === 'loco' || v.kind === 'loco2' || v.kind === 'tender' || v.emu;
  return tight(a) && tight(b) ? 0.012 : 0.04;
}
function slkState(T) {
  const V = T.vehicles, n = V.length;
  let s = T.slk;
  if (!s || s.V !== V || s.n !== n) {
    s = T.slk = { V, n, x: new Float64Array(n), u: new Float64Array(n), acc: new Float64Array(n), F: new Float64Array(n), M: new Float64Array(n),
      t: new Float64Array(Math.max(0, n - 1)), d: new Float64Array(Math.max(0, n - 1)), g: new Float64Array(Math.max(0, n - 1)), maxT: 0, minT: 0, accL: 0 };
    for (let j = 0; j < n - 1; j++) s.g[j] = slkGap(V[j], V[j + 1]);
  }
  return s;
}
/* the force a joint carries (tension positive) from its stretch dl and how fast that is changing */
function slkForce(dl, dv, half) {
  const e = Math.abs(dl) - half; if (e <= 0) return 0;
  const sp = e < SLK.SOFT ? SLK.K1 * e : SLK.K1 * SLK.SOFT + SLK.K2 * (e - SLK.SOFT), sg = Math.sign(dl);
  const load = sg * dv > 0;
  return sg * sp * (load ? 1 : SLK.UNLOAD) + SLK.C * dv;
}
/* after the physics step: s.F holds each car's own force along the train (traction, grade, resistance,
   brakes) and s.M its mass; a is the whole train's acceleration */
function slackStep(dt, T, a) {
  const s = T.slk; if (!s || !SLK.on) return;
  const n = s.n, x = s.x, u = s.u, F = s.F, M = s.M, t = s.t, g = s.g, acc = s.acc;
  if (n < 2 || !(dt > 0) || S.derailed) { s.accL = 0; return; }
  const held = Math.abs(S.v) < 0.03, uL0 = u[T.li] || 0;
  let Mt = 0; for (let i = 0; i < n; i++) Mt += M[i];
  const N = Math.max(1, Math.ceil(dt * SLK.HZ)), h = dt / N, hold = Math.exp(-6 * h);
  s.maxT = 0; s.minT = 0;
  const clank = [];
  for (let k = 0; k < N; k++) {
    for (let j = 0; j < n - 1; j++) {
      const dl = x[j] - x[j + 1], dv = u[j] - u[j + 1], half = g[j] / 2;
      const was = Math.abs(s.d[j]) > half;
      t[j] = slkForce(dl, dv, half);
      // the slack running in or out and closing up: the bang of it
      if (!was && Math.abs(dl) > half && Math.abs(dv) > SLK.CLANK) clank.push([j, Math.abs(dv)]);
      s.d[j] = dl;
      if (t[j] > s.maxT) s.maxT = t[j]; if (t[j] < s.minT) s.minT = t[j];
    }
    let am = 0;
    for (let i = 0; i < n; i++) {
      const own = held ? 0 : F[i] - M[i] * a;
      acc[i] = (own + (i > 0 ? t[i - 1] : 0) - (i < n - 1 ? t[i] : 0)) / M[i];
      am += M[i] * acc[i];
    }
    am /= Mt;   // the train as a whole goes where the physics put it; only the cars' share among themselves is left
    for (let i = 0; i < n; i++) { acc[i] -= am; u[i] += acc[i] * h; if (held) u[i] *= hold; x[i] += u[i] * h; }
  }
  let xm = 0, um = 0;
  for (let i = 0; i < n; i++) { xm += M[i] * x[i]; um += M[i] * u[i]; }
  xm /= Mt; um /= Mt;
  for (let i = 0; i < n; i++) { x[i] -= xm; u[i] -= um; }
  s.accL = acc[T.li] || 0;
  // the jolt the engine took this step: the cab lurches the other way (10b_slide.js)
  if (T === GAME.train && typeof SLIDE !== 'undefined') SLIDE.surgeV -= clamp((u[T.li] || 0) - uL0, -0.5, 0.5) * 0.35;
  if (clank.length) slkClank(T, clank);
  // too much pull for a knuckle: it breaks and the train comes apart there
  if (T === GAME.train && s.maxT > SLK.BREAK) {
    for (let j = 0; j < n - 1; j++) if (t[j] > SLK.BREAK && CARS.canCut(T, j + 1)) { slkPart(T, j + 1); break; }
  }
}
/* the bangs, loudest for the hardest and nearest */
function slkClank(T, list) {
  const cam = typeof camera !== 'undefined' && camera ? camera.position : null, V = T.vehicles;
  list.sort((p, q) => q[1] - p[1]);
  const seen = new Set();
  let n = 0;
  for (const [j, dv] of list) {
    if (seen.has(j) || n >= 6) continue; seen.add(j); n++;
    const v = V[j], d = cam && v.pos ? v.pos.distanceTo(cam) : 40;
    if (typeof sndClunk === 'function') sndClunk(clamp(0.25 + dv * 0.9, 0.25, 1.3) / (1 + (d / 25) ** 1.3), Math.random() * 0.03);
  }
}
/* a knuckle let go at joint j (between vehicles j-1 and j): the cars come apart and both halves' brake
   pipes, open to the air where the hoses parted, put them into emergency */
function slkPart(T, j) {
  const n0 = T.vehicles.length;
  CARS.uncouple(j, T, 'broke');
  if (T.vehicles.length === n0) return;
  for (const v of T.vehicles) { v.brake.BP = 0; v.brake.emerg = true; }
  S.brakeH = Math.max(S.brakeH, 0.95);
  if (typeof GAME.event === 'function') GAME.event('knuckle');
}

/* ============================================================================
   Trains knocked around. When your train runs hard into another (AI traffic, one of your parked trains, a
   cut of cars standing in a yard, or another player's train), the one it hit becomes part of the wreck:
   its cars on the rails take the blow, get shoved along their track, and the ones rammed hard enough come
   off and are thrown about by the same physics as your own cars (WreckSim.stepAll in 07d_wreck.js steps
   every wreck together, so their cars hit each other). A train shoved into a third drags that one in too.
   Re-railing your train puts all of them back on the rails.

   Each consist knocked about carries c.knk = { kin } (the speed and weight of its cars still on the rails,
   which this file moves along the track). While it has one, its own driver leaves it alone: the AI's
   tick, the cut's rolling physics and the crew of a parked train all skip it.
   ========================================================================== */
const KNOCK = { list: [], clk: {}, RAM: 2.7 };   // RAM: closing speed (m/s) that drags a train standing in the way into the wreck

/* is consist c part of a wreck (your own train while it is derailed counts) */
KNOCK.on = c => !!(c && (c.knk || (c === GAME.train && S.derailed && c.rb)));
/* make consist c part of the wreck. spec as for WreckSim: left out, nothing comes off yet (its cars come off
   as they are hit); { a, side, k } knocks the car at a metres back from its front off its rails, thrown to side */
KNOCK.strike = function (c, spec) {
  if (!c || c === GAME.train || c.knk) return c && c.knk;
  if (!c.vehicles || !c.vehicles.length || !c.vehicles[0].pos || typeof WreckSim === 'undefined') return null;
  const v = velOf(c) || 0;
  c.wreck(Object.assign({ a: 0, side: Math.random() < 0.5 ? -1 : 1, k: 0.5, none: true, v0: Math.abs(v), vs: v, seed: 1 + ((Math.random() * 1e9) | 0) }, spec || {}));
  c.knk = { kin: { v: spec && spec.vs !== undefined ? spec.vs : v, mass: 0, force: 0 } };
  if (c.crew) c.crew.mph = 0;
  KNOCK.list.push(c);
  c.dirty = true; if (c.ai) c.ai.dirty = true;
  return c.knk;
};
/* consists the wreck has taken in: yours (derailed), and every one knocked about */
KNOCK.member = c => c === GAME.train ? S.derailed : !!c.knk;
/* how far consist c (in the wreck) can run by d before its end meets a consist that is not: that one is
   dragged in, and the wreck physics takes it from there */
KNOCK.limit = function (c, d) {
  if (!d || (!CARS.cuts.length && !AI.trains.length)) return d;
  const idx = carIndex();
  for (const [e, l] of idx) { const k = l.filter(it => !KNOCK.member(it.c)); if (k.length !== l.length) { if (k.length) idx.set(e, k); else idx.delete(e); } }
  const hit = carAhead(c, Math.sign(d), Math.abs(d) + 0.05, idx);
  if (!hit || hit.d >= Math.abs(d)) return d;
  KNOCK.strike(hit.c);
  return Math.sign(d) * hit.d;
};
/* every wreck one frame on (player: your train's sim, with kin its cars on the rails, or null) */
KNOCK.step = function (dt, player, kin) {
  const sims = [];
  if (player) { player.kin = kin; sims.push(player); }
  if (KNOCK.list.length) KNOCK.list = KNOCK.list.filter(KNOCK.alive);
  for (const c of KNOCK.list) {
    const R = c.rb, k = c.knk.kin; if (!R) continue;
    k.mass = 0; for (const v of c.vehicles) if (!v.rb) k.mass += R.massOf(v);
    k.x0 = 0; if (k.mass <= 0) k.v = 0;
    R.kin = k; sims.push(R);
  }
  // other players' wrecks play out here too, at the speed they report; their cars on the rails can't be shoved from here
  if (typeof MP !== 'undefined' && MP.on) for (const { rt } of MP.trains()) {
    const R = rt.train.rb; if (!R || !rt.placed) continue;
    const k = rt.kin || (rt.kin = { v: 0, mass: 0, force: 0 });
    k.v = rt.v; k.mass = 0; k.x0 = 0; R.fixed = true; R.kin = k; sims.push(R);
  }
  if (!sims.length) return;
  try { WreckSim.stepAll(sims, dt, KNOCK.clk); }
  catch (e) { console.warn('wreck', e); for (const R of sims) { R.asleep = true; R.kin.v = 0; R.kin.dx = 0; } }
  // the knocked trains' cars still on the rails run on (or back) as far as the wreck pushed them
  for (const c of KNOCK.list) {
    const k = c.knk.kin, R = c.rb;
    let d = k.dx || 0;
    if (d) {
      d = KNOCK.limit(c, d);
      const moved = c.move(d, { onBlocked: () => { k.v = 0; } });
      if (c.ai) { const a = c.ai; a.odo += moved; a.authLeft -= moved; a.theta -= moved / LG.rD; }
    }
    c.v = k.v; if (c.parkS) c.parkS.vw = k.v;
    c.rolling = false;
    if (R && !R.asleep) { c.dirty = true; if (c.ai) c.ai.dirty = true; }
  }
};
/* a consist moving under its own power or rolling touched one in the wreck (A moving toward its dir end) */
KNOCK.meet = function (A, dir, hit) {
  const B = hit.c, T = GAME.train;
  const aEnd = dir > 0 ? 'front' : 'rear', sB = hit.end === aEnd ? -1 : 1;
  const closing = dir * (velOf(A) - (hit.end ? velOf(B) * sB : 0)), mph = Math.round(closing / MPH);
  const other = A === T ? B : B === T ? A : null;
  if (other && !S.derailed) {
    if (closing > KNOCK.RAM) { GAME.derail(`Ran into the wreck at ${mph} mph.`, 'Collision', { none: true }); KNOCK.strike(other); return; }
    sndClunk(clamp(closing / COUPLE_OK, 0.3, 1.2), 0);
    setVel(T, 0); toast('Stopped against the wreck.', 'bad', 3000, 'wreckStop');
    return;
  }
  // something else rolling into the pile: it is taken in if it hits hard, stopped against it if not
  const mover = KNOCK.member(A) ? B : A;
  if (KNOCK.member(mover)) return;
  if (closing > KNOCK.RAM) KNOCK.strike(mover); else setVel(mover, 0);
};
/* your train is back on the rails: so is everything it knocked about, clear of it */
KNOCK.clear = function () {
  const T = GAME.train;
  for (const c of KNOCK.list) {
    if (c.rb) c.wreck(null);
    delete c.knk; c.v = 0; c.rolling = false;
    if (c.parkS) c.parkS.vw = 0;
    if (c.ai) { c.ai.v = 0; c.ai.dirty = true; }
    c.dirty = true;
    if (T && KNOCK.alive(c)) KNOCK.clearOf(c, T);
  }
  KNOCK.list = [];
};
/* slide consist c along its track until it no longer stands on train T (the wreck can leave them overlapping) */
KNOCK.clearOf = function (c, T) {
  const on = () => CARS.overlaps(c) === T;
  if (!on()) return;
  const go = d => { const m = c.move(d, {}); if (c.ai) { c.ai.odo += m; c.ai.authLeft -= m; } return m; };
  for (const dir of [1, -1]) {
    let went = 0;
    while (went < 120) { const m = go(dir); went += Math.abs(m); if (!m) break; if (!on()) return; }
    go(-dir * went);
  }
};
/* still in the game (a new run or route throws the old cars away) */
KNOCK.alive = c => CARS.cuts.includes(c) || !!(c.ai && AI.trains.includes(c.ai));

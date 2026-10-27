/* ============================================================================
   Steam locomotive, boiler, air brake and train dynamics
   ========================================================================== */
const S = {
  throttle: 0, reverser: 0, brakeH: 0.12, indH: 0.6,
  sander: false, cocks: true, bell: false, light: 1, injector: false, blower: 0.35, stoker: 0.45, whistle: 0, autoFire: true,
  v: 0, vw: 0, slip: false, theta: 0, odo: 0,
  P: 238, Psc: 0, W: 0.62, fire: 0.55, coal: 19958, water: 83280, sand: 1800,
  MR: 140, ER: 90, pumping: false, bailoff: false,
  safety: false, lowWater: false, priming: false,
  TE: 0, use: 0, gen: 0, cut: 0, mu: 0.27, grade: 0, limit: 70,
  dead: false, derailed: false, paused: false, time: 0, warnTimer: 0,
  notch: 0, dyn: 0, dbLoad: 0, DBF: 0, rpm: 300, engineRun: true, crank: 0, load: 0, fuel: 18927, turbo: 0.15, ditch: true, ditchFlash: 0, slipCtl: false, amps: 0,
};
const ENV = { mu: 0.27, wind: new THREE.Vector3(-1.2, 0, 0.6) };
const DRIVER_C = Math.PI * 2 * LG.rD, VCYL = Math.PI / 4 * 0.635 * 0.635 * 0.864;

function brakeZone(h) {
  if (h < 0.06) return 'REL'; if (h < 0.18) return 'RUN'; if (h < 0.28) return 'LAP'; if (h < 0.9) return 'SRV'; return 'EMG';
}
function brakeLabel(h) { const z = brakeZone(h); if (z === 'SRV') return '−' + Math.round(6 + 20 * (h - 0.28) / 0.62) + ' psi'; return { REL: 'REL', RUN: 'RUN', LAP: 'LAP', EMG: 'EMERG' }[z]; }

function physicsStep(dt, train) {
  const spec = LOCO_SPEC[train.locoKey];
  const V = train.vehicles;
  const DSL = train.diesel;
  let TEcmd = 0;
  const nU = DSL ? train.nUnits : 1;
  if (DSL) TEcmd = dieselPower(dt) * nU;
  else {
  /* ----------------- boiler & front end ----------------- */
  const n = Math.abs(S.vw) / DRIVER_C;                 // driver revolutions per second
  const dir = Math.sign(S.reverser) * (Math.abs(S.reverser) > 0.03 ? 1 : 0);
  let cut = Math.abs(S.reverser) * 0.85; if (dir && cut < 0.1) cut = 0.1;
  S.cut = dir ? cut : 0;
  const valve = Math.pow(S.throttle, 1.12);
  const PscT = S.P * valve * (S.cocks ? 0.93 : 1);
  S.Psc += (PscT - S.Psc) * Math.min(1, dt * 2.2);
  const ratio = dir ? cut * (1 + Math.log(1 / cut)) / 0.988 * 0.85 : 0;
  const wire = 1 / (1 + (n / 6.0) ** 2);
  const back = 1.0 + 0.55 * n * n * cut;
  let mep = Math.max(0, S.Psc * ratio * wire - (S.Psc > 5 ? back : 0));
  if (S.priming) mep *= 0.55 + 0.25 * Math.sin(S.time * 9);
  TEcmd = dir * mep * 307.97 * LBF;                   // 2 cyl: mep * d^2 * s / D
  // steam consumption
  const rho = (S.Psc + 14.7) * 0.02323;
  const useCyl = dir ? n * 4 * VCYL * (cut + 0.08) * rho : 0;
  const aux = (S.pumping ? 0.07 : 0) + (S.light ? 0.02 : 0) + S.blower * 0.38 + (S.injector ? 0.28 : 0) + (S.cocks ? 0.45 * valve : 0) + S.whistle * 0.3 + (S.safety ? 4.8 : 0);
  S.use = useCyl + aux;
  // firing: stoker feeds, draft from exhaust & blower burns
  if (S.autoFire && !S.dead) autoFireman(dt);
  const draft = clamp(0.16 + 0.78 * Math.min(1, useCyl / 7.5) + 0.72 * S.blower, 0, 1.25);
  const fireT = S.coal > 0 && !S.dead ? Math.min(S.stoker * 1.18, draft * 1.08) : 0;
  S.fire += (fireT - S.fire) * dt / 16;
  S.fire = Math.max(0, S.fire);
  S.coal = Math.max(0, S.coal - S.fire * 1.35 * dt);
  S.gen = 9.9 * S.fire * (1 - 0.22 * clamp((S.P - 200) / 60, 0, 1));
  // water
  let cooling = 0;
  if (S.injector && S.water > 0 && S.P > 60) { const feed = 11.5; S.W += feed * dt / 2600; S.water -= feed * dt; cooling = feed * (spec.fw === 'Worthington' ? 0.1 : 0.13); }
  S.W -= S.gen * dt / 2600;
  S.water = Math.max(0, S.water);
  S.P += (S.gen - S.use - cooling) / 3.4 * dt;
  if (S.P > 245.5) S.safety = true; else if (S.P < 241) S.safety = false;
  S.P = clamp(S.P, 0, 250);
  S.lowWater = S.W < 0.04; S.priming = S.W > 1.0;
  if (S.W < -0.2 && !S.dead) { S.dead = true; S.fire = 0; GAME.fail('Fusible plug dropped', 'The water level fell below the crown sheet and the fusible plug melted, venting steam into the firebox. The fire is out. Keep the water glass above the bottom nut.'); }
  S.W = clamp(S.W, -0.3, 1.15);
  }

  /* ----------------- air brakes ----------------- */
  const z = brakeZone(S.brakeH);
  let erT = S.ER, erRate = 0;
  if (z === 'REL') { erT = 90; erRate = 5; } else if (z === 'RUN') { erT = 90; erRate = 2.2; } else if (z === 'LAP') { erT = S.ER; } else if (z === 'SRV') { erT = 90 - (6 + 20 * (S.brakeH - 0.28) / 0.62); erRate = 1.6; } else { erT = 0; erRate = 40; }
  const prevER = S.ER;
  if (erT > S.ER) S.ER = Math.min(erT, S.ER + erRate * dt * (S.MR > S.ER + 5 ? 1 : 0.2)); else S.ER = Math.max(erT, S.ER - erRate * dt);
  // brake pipe propagation front to rear
  let prev = S.ER, chargeFlow = 0;
  for (let i = 0; i < V.length; i++) {
    const b = V[i].brake, tau = i === 0 ? 0.35 : 0.22;
    const nb = b.BP + (prev - b.BP) * Math.min(1, dt / tau);
    b.dBP = (nb - b.BP) / dt; if (nb > b.BP) chargeFlow += nb - b.BP;
    b.BP = nb; prev = b.BP;
  }
  if (z === 'EMG') for (const v of V) v.brake.BP = Math.max(0, v.brake.BP - 60 * dt);
  // compressor
  if (S.MR < 128) S.pumping = true; else if (S.MR > 140) S.pumping = false;
  if (S.pumping && (DSL ? S.engineRun && S.rpm > 150 : S.P > 50)) S.MR += (DSL ? 1.3 + 2.4 * S.rpm / 904 : 1.05) * dt;
  S.MR -= chargeFlow * 0.05;
  S.MR = clamp(S.MR, 0, 142);
  // triple valves
  for (let i = 0; i < V.length; i++) {
    const v = V[i], b = v.brake;
    const passenger = v.kind === 'coach' || v.kind === 'loco' || v.kind === 'loco2' || v.kind === 'tender';
    if (b.dBP < -14 || (b.BP < 12 && z === 'EMG')) b.emerg = true;
    if (b.emerg) { b.BC = Math.min(78, b.BC + 40 * dt); if (b.BP > 60 && z !== 'EMG') b.emerg = false; continue; }
    if (passenger) {
      const t = clamp(2.5 * (b.AR - b.BP), 0, 64);
      b.BC += clamp(t - b.BC, -7 * dt, 9 * dt);
      if (b.BP > b.AR - 0.5) b.AR = Math.min(90, b.AR + (b.BP - b.AR) * 0.05 * dt + 0.01 * dt);
    } else {
      if (b.BP < b.AR - 0.7) {           // application: aux reservoir feeds the cylinder
        const dAR = Math.min(b.AR - b.BP, (b.AR - b.BP) * 1.4 * dt);
        if (b.BC < b.AR) { b.AR -= dAR; b.BC = Math.min(b.BC + 2.5 * dAR, b.AR); }
        b.released = false;
      } else if (b.BP > b.AR + 0.6) {    // direct release, then slow recharge
        b.BC = Math.max(0, b.BC - 6 * dt);
        b.AR += (b.BP - b.AR) * 0.045 * dt;
        b.released = true;
      }
    }
  }
  // locomotive: independent brake + automatic (bail-off releases the automatic)
  const lb = V[0].brake;
  const ind = clamp((S.indH - 0.1) / 0.9, 0, 1) * 45;
  const autoLoco = S.bailoff ? 0 : lb.BC;
  S.BCloco = Math.max(ind, autoLoco);

  /* ----------------- adhesion & tractive effort ----------------- */
  const Wd = spec.adhesive * 0.4536 * 9.81 * nU;
  let mu = ENV.mu + (S.sander && S.sand > 0 ? 0.075 : 0);
  if (S.sander) S.sand = Math.max(0, S.sand - 0.9 * dt);
  S.mu = mu;
  const Fadh = mu * Wd;
  let Frail;
  if (DSL) {
    // AC traction with creep control: wheel slip is caught and power trimmed instead of spinning
    const muD = ENV.mu * 1.45 + (S.sander && S.sand > 0 ? 0.06 : 0);
    const lim = muD * Wd * 0.97;
    S.slipCtl = Math.abs(TEcmd) > lim;
    Frail = clamp(TEcmd, -lim, lim);
    if (S.slipCtl) { Frail *= 0.92 + 0.05 * Math.sin(S.time * 11); GAME.event('slipCtl'); }
    S.slip = false; S.vw = S.v; S.mu = muD;
  } else {
  if (!S.slip) {
    if (Math.abs(TEcmd) > Fadh) { S.slip = true; GAME.event('slip'); }
    Frail = TEcmd;
  }
  if (S.slip) {
    const mk = 0.62 * mu * Wd;
    const rel = S.vw - S.v;
    const fr = Math.abs(rel) > 0.05 ? Math.sign(rel) * mk : clamp(TEcmd, -mk, mk);
    S.vw += (TEcmd - fr) / 7000 * dt;
    Frail = fr;
    if (Math.abs(TEcmd) < Fadh * 0.85 && Math.abs(S.vw - S.v) < 0.35) S.slip = false;
    if (Math.abs(TEcmd) < Fadh * 0.85) S.vw += (S.v - S.vw) * Math.min(1, dt * 2.5);
  }
  }
  S.TE = Frail;

  /* ----------------- resistances & dynamics ----------------- */
  let M = 0, Fgrade = 0, Fres = 0, Fbrake = 0;
  const vm = Math.abs(S.v) / MPH;
  const shoe = 1.25 - 0.5 * smooth(0, 35, Math.abs(S.v));
  let gradeLead = 0, limit = 99;
  for (let i = 0; i < V.length; i++) {
    const v = V[i];
    const mass = v.kind === 'tender' ? train.tenderEmpty + S.water + S.coal : v.mass;
    M += mass;
    const f = v.fp[0].F && v.fp[1].F ? _v1.addVectors(v.fp[0].F.f, v.fp[1].F.f).multiplyScalar(0.5) : _v1.set(1, 0, 0);
    Fgrade -= mass * 9.81 * f.y;
    if (i === 0) gradeLead = f.y;
    const tons = mass / STON;
    const k = Math.abs(v.fp[0].tp.e.curv(v.fp[0].tp.s));
    let R = 1.3 * tons + 29 * v.axles + (v.kind === 'coach' ? 0.03 : 0.045) * tons * vm + (i === 0 ? 0.0024 * 125 : 0.0005 * (v.area || 90)) * vm * vm;
    if (v.kind === 'loco' || v.kind === 'loco2') R += 14 * tons;
    R += 0.8 * tons * 1746.4 * k;
    R += (v.kind === 'coach' || v.kind === 'loco' || v.kind === 'loco2' || v.kind === 'tender' ? 7 : 14) * tons * (1 - smooth(0.15, 2.0, Math.abs(S.v)));
    Fres += R * LBF;
    const isLoco = v.kind === 'loco' || v.kind === 'loco2';
    const bc = isLoco ? S.BCloco : v.brake.BC;
    Fbrake += mass * v.brakeA * (bc / 64) * shoe + (isLoco && DSL ? S.DBF : 0);
    for (const p of [v.fp[0], v.fp[1]]) limit = Math.min(limit, p.tp.e.limit);
  }
  S.limit = limit; S.grade = gradeLead;
  const Meff = M * 1.04;
  const Fdrive = Frail + Fgrade;
  let a;
  if (Math.abs(S.v) < 0.03) {
    const hold = Fres + Fbrake;
    if (Math.abs(Fdrive) <= hold) { a = 0; S.v = 0; }
    else a = (Fdrive - Math.sign(Fdrive) * hold) / Meff;
  } else {
    a = (Fdrive - Math.sign(S.v) * (Fres + Fbrake)) / Meff;
    const nv = S.v + a * dt;
    if (Math.sign(nv) !== Math.sign(S.v) && Math.abs(Fdrive) < Fres + Fbrake) { a = -S.v / dt; }
  }
  S.v += a * dt;
  S.accel = a;
  if (!S.slip) S.vw = S.v;
  S.theta -= S.vw * dt / LG.rD;
  S.M = M;
  return S.v * dt;
}

/* An attentive fireman: holds 240 psi and half a glass. */
function autoFireman(dt) {
  const demand = S.use;
  const want = clamp(0.25 + demand / 9.5 + (240 - S.P) * 0.025, 0.05, 1);
  S.stoker += (want - S.stoker) * Math.min(1, dt * 0.8);
  if (S.W < 0.52 && S.P > 120) S.injector = true;
  if (S.W > 0.72) S.injector = false;
  const working = Math.abs(S.reverser) > 0.05 && S.throttle > 0.05;
  const bt = working ? 0.05 : (S.P < 235 ? 0.55 : 0.2);
  S.blower += (bt - S.blower) * Math.min(1, dt * 0.7);
}

/* Six-axle AC diesel: prime mover, main alternator loading, traction, dynamic brake, fuel. */
function dieselPower(dt) {
  const notch = Math.round(S.throttle * 8); S.notch = notch;
  const dir = S.reverser > 0.5 ? 1 : (S.reverser < -0.5 ? -1 : 0);
  const v = Math.abs(S.v);
  if (S.crank > 0) {
    S.crank -= dt; S.rpm = Math.min(110, S.rpm + 45 * dt);
    if (S.crank <= 0) { S.crank = 0; S.engineRun = true; S.rpm = 330; GAME.event('started'); }
  }
  if (S.fuel <= 0 && S.engineRun) { S.engineRun = false; GAME.event('noFuel'); }
  const dynOn = S.dyn > 0.06;
  if (dynOn && notch > 0) GAME.event('dynInterlock');
  let rpmT = 0;
  if (S.engineRun) rpmT = dynOn ? 300 + 420 * S.dyn : 300 + notch * 93.75;
  else if (S.crank > 0) rpmT = 110;
  const rate = rpmT > S.rpm ? 52 : 75;
  S.rpm += clamp(rpmT - S.rpm, -rate * dt, rate * dt);
  // main alternator excitation ramps in over ~10 s and drops quickly
  const powerOK = S.engineRun && notch > 0 && dir !== 0 && !dynOn;
  S.load += clamp((powerOK ? 1 : 0) - S.load, -0.7 * dt, 0.1 * dt);
  const rf = clamp((S.rpm - 300) / 750, 0, 1), nf = notch / 8;
  const P = 3280e3 * Math.pow(nf, 1.2) * Math.min(1, rf / Math.max(0.06, nf)) * S.load;   // W at the rail
  const TEcap = 814e3 * Math.min(1, nf * 1.25) * S.load;                                 // 183,000 lbf starting
  let TE = powerOK || S.load > 0.01 ? Math.min(TEcap, P / Math.max(v, 0.35)) : 0;
  // extended-range dynamic brake: full force down to ~2 mph, power limited at speed
  const dbMax = Math.min(445e3, 4500e3 / Math.max(v, 0.1)) * smooth(0.25, 1.4, v);
  S.dbLoad += clamp((dynOn && S.engineRun ? (S.dyn - 0.06) / 0.94 : 0) - S.dbLoad, -0.8 * dt, 0.3 * dt);
  S.DBF = dbMax * S.dbLoad;
  const Peng = S.engineRun ? (TE * v) / 0.86 + 40e3 + rf * 140e3 : 0;
  S.fuel = Math.max(0, S.fuel - Peng * 0.25 / 3.6e6 * dt);
  S.amps = TE / 814e3 * 1350 - S.DBF / 445e3 * 760;
  S.turbo += ((S.engineRun ? 0.12 + 0.88 * rf * (0.35 + 0.65 * S.load) : 0) - S.turbo) * Math.min(1, dt * 0.55);
  S.Psc = 0; S.cut = 0; S.use = 0;
  return dir * TE;
}

/* ============================================================================
   Steam locomotive, boiler, air brake and train dynamics
   ========================================================================== */
const S = {
  throttle: 0, reverser: 0, brakeH: 0.12, indH: 0.6,
  sander: false, cocks: true, bell: false, light: 1, injector: false, blower: 0.35, stoker: 0.45, whistle: 0, autoFire: true, autoCut: true, cutA: 0.85, railP: 0,
  v: 0, vw: 0, slip: false, slide: false, slideN: 0, theta: 0, odo: 0,
  P: 238, Psc: 0, W: 0.62, fire: 0.55, coal: 19958, water: 83280, sand: 1800,
  MR: 140, ER: 90, pumping: false, bailoff: false,
  safety: false, lowWater: false, priming: false,
  TE: 0, use: 0, gen: 0, cut: 0, mu: 0.27, grade: 0, limit: 70,
  dead: false, derailed: false, paused: false, time: 0, warnTimer: 0,
  notch: 0, dyn: 0, dbLoad: 0, DBF: 0, rpm: 300, engineRun: true, crank: 0, load: 0, fuel: 18927, turbo: 0.15, ditch: true, ditchFlash: 0, slipCtl: false, amps: 0,
  pan: 1, panUp: true, vcb: true, vcbT: 0, kW: 0, kWh: 0, rbMax: 0, blend: 0,
};
const ENV = { mu: 0.27, wind: new THREE.Vector3(-1.2, 0, 0.6) };
const DRIVER_C = Math.PI * 2 * LG.rD, VCYL = Math.PI / 4 * 0.635 * 0.635 * 0.864;

function brakeZone(h) {
  if (h < 0.06) return 'REL'; if (h < 0.18) return 'RUN'; if (h < 0.28) return 'LAP'; if (h < 0.9) return 'SRV'; return 'EMG';
}
/* Wheels sliding. A steam-era train has no wheel slide protection: an emergency application at speed locks the
   wheels and they skid on the rail until the train stops or the brakes come off. A locked wheel is held by the
   rail's sliding friction instead of the shoe, steel on steel, which falls off as the contact heats at speed. */
const SLIDE_ON = 2.0, SLIDE_BC = 45, SLIDE_OFF_BC = 25;   // m/s to start a slide; cylinder psi to lock / to roll again
const slideMu = v => 0.065 + 0.055 * (1 - smooth(0, 25, v));
function brakeLabel(h) { const z = brakeZone(h); if (z === 'SRV') return '−' + Math.round(6 + 20 * (h - 0.28) / 0.62) + ' psi'; return { REL: 'REL', RUN: 'RUN', LAP: 'LAP', EMG: 'EMERG' }[z]; }

function physicsStep(dt, train) {
  const spec = LOCO_SPEC[train.locoKey];
  const V = train.vehicles;
  const DSL = train.diesel;
  let TEcmd = 0;
  const nU = DSL ? train.nUnits : 1;
  if (train.elec) TEcmd = electricPower(dt, spec);
  else if (DSL) TEcmd = dieselPower(dt) * nU;
  else {
  /* ----------------- boiler & front end ----------------- */
  const n = Math.abs(S.vw) / DRIVER_C;                 // driver revolutions per second
  const dir = Math.sign(S.reverser) * (Math.abs(S.reverser) > 0.03 ? 1 : 0);
  let cut = Math.abs(S.reverser) * 0.85; if (dir && cut < 0.1) cut = 0.1;
  // easy driving: hook the reverser up as the engine gains speed, so the boiler can keep up
  S.cutA += (autoCutoff(n, S.P) - S.cutA) * Math.min(1, dt * 0.8);
  if (S.autoCut && dir) cut = Math.min(cut, S.cutA);
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
  if (S.autoCut && S.cocks && Math.abs(S.v) > 3) { S.cocks = false; GAME.event('cocksShut'); }
  if (!S.autoCut && dir && S.P < 175 && cut > 0.4 && n > 1.6 && S.throttle > 0.3) GAME.event('lowSteam');
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
  // brake pipe propagation outward from the engine, both ways when cars are coupled ahead of it
  let chargeFlow = 0;
  const li = train.li;
  for (const step of [1, -1]) {
    let prev = step > 0 ? S.ER : V[li].brake.BP;
    for (let i = step > 0 ? li : li - 1; i >= 0 && i < V.length; i += step) {
      const b = V[i].brake, tau = train.elec ? 0.04 : i === li ? 0.35 : 0.22;   // a trainset's brakes are electrically controlled, all at once
      const nb = b.BP + (prev - b.BP) * Math.min(1, dt / tau);
      b.dBP = (nb - b.BP) / dt; if (nb > b.BP) chargeFlow += nb - b.BP;
      b.BP = nb; prev = b.BP;
    }
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
  const lb = V[li].brake;
  const ind = clamp((S.indH - 0.1) / 0.9, 0, 1) * 45;
  const autoLoco = S.bailoff ? 0 : lb.BC;
  S.BCloco = Math.max(ind, autoLoco);

  /* ----------------- adhesion & tractive effort ----------------- */
  const Wd = spec.adhesive * 0.4536 * 9.81 * nU;
  S.railP = railPatch(S.odo);
  let mu = ENV.mu * (1 - 0.24 * S.railP) + (S.sander && S.sand > 0 ? 0.075 : 0);
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
  } else if (S.slide) {
    S.slip = false; Frail = 0; S.vw = 0;   // drivers locked by the brakes: the cylinders can't turn them
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
  const disc = 1 - 0.3 * smooth(20, 90, Math.abs(S.v));   // disc brakes, held back at speed to what the rail will take
  let motorBrake = 0, slid = 0;
  let gradeLead = 0, limit = 99;
  for (let i = 0; i < V.length; i++) {
    const v = V[i];
    const mass = v.kind === 'tender' ? train.tenderEmpty + S.water + S.coal : v.mass;
    M += mass;
    const f = v.fp[0].F && v.fp[1].F ? _v1.addVectors(v.fp[0].F.f, v.fp[1].F.f).multiplyScalar(0.5) : _v1.set(1, 0, 0);
    Fgrade -= mass * 9.81 * f.y;
    if (i === li) gradeLead = f.y;
    const tons = mass / STON;
    const k = Math.abs(v.fp[0].tp.e.curv(v.fp[0].tp.s));
    // a trainset's streamlined cab takes the air at whichever end is leading
    const leading = i === (S.v >= 0 ? 0 : V.length - 1);
    const aero = v.aero !== undefined ? (leading ? v.aeroLead : v.aero) : (i === 0 ? 0.0024 * 125 : 0.0005 * (v.area || 90));
    let R = 1.3 * tons + 29 * v.axles + (v.kind === 'coach' || v.emu ? 0.03 : 0.045) * tons * vm + aero * vm * vm;
    if ((v.kind === 'loco' || v.kind === 'loco2') && !v.emu) R += 14 * tons;
    R += 0.8 * tons * 1746.4 * k;
    R += (v.kind === 'coach' || v.kind === 'loco' || v.kind === 'loco2' || v.kind === 'tender' ? 7 : 14) * tons * (1 - smooth(0.15, 2.0, Math.abs(S.v)));
    Fres += R * LBF;
    const isLoco = v.kind === 'loco' || v.kind === 'loco2';
    const bc = isLoco ? S.BCloco : v.brake.BC;
    if (!DSL) {
      const emg = (isLoco ? lb.emerg : v.brake.emerg) || z === 'EMG';
      if (!v.slide && emg && bc > SLIDE_BC && Math.abs(S.v) > SLIDE_ON) v.slide = true;
      else if (v.slide && (bc < SLIDE_OFF_BC || Math.abs(S.v) < 0.05)) v.slide = false;
    } else v.slide = false;
    if (v.slide) slid++;
    const fb = v.slide ? mass * 9.81 * slideMu(Math.abs(S.v)) : mass * v.brakeA * (bc / 64) * (v.disc ? disc : shoe);
    Fbrake += fb + (isLoco && DSL && !train.elec ? S.DBF : 0);
    if (v.motor) motorBrake += fb;
    for (const p of [v.fp[0], v.fp[1]]) limit = Math.min(limit, spec.hs ? hsLimit(p.tp, spec) : p.tp.e.limit);
  }
  if (train.elec) {
    // the regenerative brake comes in on the motored cars first and the discs make up the rest (blending)
    Fbrake += S.DBF;
    S.blend = Math.min(motorBrake, Math.max(0, S.rbMax - S.DBF));
    const regen = (S.DBF + S.blend) * Math.abs(S.v);
    S.kW = (Math.abs(S.TE) * Math.abs(S.v) / 0.92 - regen * 0.85) / 1000 + (S.vcb ? 180 : 0);   // auxiliaries: air, cooling, the cars' heat and light
    S.kWh += S.kW * dt / 3600;
  }
  S.limit = Math.min(limit, JOB.vmax()); S.grade = gradeLead;
  S.slide = !!V[li].slide; S.slideN = slid;
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
  if (S.slide) S.vw = 0; else if (!S.slip) S.vw = S.v;
  S.theta -= S.vw * dt / LG.rD;
  S.M = M;
  return S.v * dt;
}

/* Curve overturning. What pushes a car over is the part of v²k the superelevation does not carry (g sin of the
   cant). A car with its centre of gravity about 2 m above the rail and wheels 1.5 m apart starts to lift its
   inner wheels at roughly 0.4 g of that, and it takes a moment to roll right over, so only a clear overspeed
   held for over half a second tips the train. */
const CURVE_WARN = 1.6, CURVE_TIP = 3.9, CURVE_HOLD = 0.6;
function curveUnbalanced(tp, v) {
  const e = tp.e, c = e.cant ? e.cant(tp.s) : 0;
  return Math.abs(v * v * e.curv(tp.s) - 9.81 * Math.sin(c));
}

/* Turnout overspeed. The posted diverging speed has a wide safety margin built in: a few mph over is a rules
   violation (warned and docked), but the wheels only climb the frog or the points and come off well past it,
   at twice the limit and never less than 20 mph over (35 mph through a 15 mph yard turnout, 60 through a 30). */
const TURNOUT_WARN_OVER = 4;
const turnoutDerailMph = limit => Math.max(limit * 2, limit + 20);

/* A high-speed set runs at its own top speed on main track (and straight through the turnouts there), with
   each curve posted for 1.5 m/s2 of lateral acceleration, rounded down to 5 mph. Everything else (yards,
   sidings, crossovers) keeps its own limit. */
function hsLimit(tp, spec) {
  const e = tp.e;
  if (e.kind !== 'main' || e.limit < 70) return e.limit;
  const k = Math.abs(e.curv(tp.s));
  const curve = k > 1e-5 ? Math.floor(Math.sqrt(1.5 / k) / MPH / 5) * 5 : Infinity;
  return Math.min(Math.floor(spec.vmax / 5) * 5, curve);
}

/* Steam driving help. 'easy': the fireman runs the boiler and the engineer's reverser hooks up on its own,
   and the cylinder cocks shut once rolling. 'auto': the fireman only. 'hand': you run everything. */
function applyFireSetting(k) { S.autoFire = k !== 'hand'; S.autoCut = k === 'easy' || k === undefined; }
/* The cutoff that holds steam at this speed: long at a start for the pull, shorter as the drivers turn faster,
   and shorter still if the pressure sags. What an engineer does with the reverser, notch by notch. */
function autoCutoff(n, P) {
  const budget = 7.2 * clamp((P - 150) / 80, 0.35, 1);
  const rho = (P + 14.7) * 0.02323;
  return clamp(budget / Math.max(0.05, n * 4 * VCYL * rho) - 0.08, 0.2, 0.85);
}
/* Rail condition along the line: patches of dew, leaves and grease where adhesion falls by up to a quarter.
   An engine working hard there slips unless the sander is on. 0 is clean rail, 1 the worst of a patch. */
function railPatch(x) {
  const w = Math.sin(x / 173 + 3.5) * 0.55 + Math.sin(x / 61 + 2.1) * 0.3 + Math.sin(x / 23 + 0.7) * 0.15;
  return smooth(0.25, 0.7, w);
}

/* An attentive fireman: holds 240 psi and half a glass. */
function autoFireman(dt) {
  const demand = S.use;
  const want = clamp(0.25 + demand / 9.5 + (240 - S.P) * 0.025, 0.05, 1);
  S.stoker += (want - S.stoker) * Math.min(1, dt * 0.8);
  if (S.W < 0.52 && S.P > 65) S.injector = true;   // the injector still lifts at low pressure: never let the crown sheet go dry
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

/* Electric trainset: pantograph and main breaker, power controller, traction motors fed from the line,
   regenerative brake, and the speed governor at the set's top speed. */
function electricPower(dt, spec) {
  const notch = Math.round(S.throttle * 8); S.notch = notch;
  const dir = S.reverser > 0.5 ? 1 : (S.reverser < -0.5 ? -1 : 0);
  const v = Math.abs(S.v);
  // the pantograph takes about 7 s to rise and 3 s to drop; the breaker closes once it is on the wire
  S.pan = clamp(S.pan + (S.panUp ? dt / 7 : -dt / 3), 0, 1);
  if (S.panUp && S.pan >= 1) { if (!S.vcb) { S.vcbT += dt; if (S.vcbT > 1.5) { S.vcb = true; S.vcbT = 0; GAME.event('vcb'); } } }
  else { if (S.vcb) GAME.event('vcbOpen'); S.vcb = false; S.vcbT = 0; }
  S.engineRun = S.vcb; S.rpm = S.vcb ? 600 : 0;   // the compressor runs off the auxiliary supply
  const regenOn = S.dyn > 0.06;
  if (regenOn && notch > 0) GAME.event('dynInterlock');
  const powerOK = S.vcb && notch > 0 && dir !== 0 && !regenOn;
  // IGBT inverters answer in a second or two
  S.load += clamp((powerOK ? 1 : 0) - S.load, -1.5 * dt, 0.6 * dt);
  const nf = notch / 8, vmax = spec.vmax * MPH;
  const gov = 1 - smooth(vmax - 2, vmax + 0.5, v);
  const P = spec.P * nf * S.load * gov, TEcap = spec.TEmax * Math.min(1, nf * 1.6) * S.load * gov;
  const TE = S.load > 0.001 ? Math.min(TEcap, P / Math.max(v, 0.5)) : 0;
  // regeneration back into the line needs the breaker in; power cars with rheostats can burn it off instead
  S.rbMax = (S.vcb || spec.rheo ? 1 : 0) * Math.min(spec.RBmax, spec.RP / Math.max(v, 0.1)) * smooth(0.6, 2.2, v);
  S.dbLoad += clamp((regenOn ? (S.dyn - 0.06) / 0.94 : 0) - S.dbLoad, -1.0 * dt, 0.8 * dt);
  S.DBF = S.rbMax * S.dbLoad;
  S.amps = TE / spec.TEmax * 1000 - S.DBF / spec.RBmax * 800;
  S.Psc = 0; S.cut = 0; S.use = 0; S.turbo = 0;
  return dir * TE;
}

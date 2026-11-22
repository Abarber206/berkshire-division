/* ============================================================================
   Guided first run: a lesson in the yard at Bellevue and out on the main that
   teaches the controls one at a time. Brakes, bell and whistle, the reverser
   and throttle, backing onto three cars and coupling up, charging the air, the
   fire (steam) or the notches and dynamic brake (diesel), then a run up to
   speed and a stop with the train brake. Offered from the Run tab of the menu,
   and picked out there on the very first launch. It never scores you, and you
   can skip a step or end it at any time. Free running and jobs are untouched.
   ========================================================================== */
const TUT = { want: false, run: null, hz: 0, first: false };
const TUT_GAP = 40;                  // metres from the tender to the cars waiting behind it on Yard 2
const TUT_CARS = ['box/', 'box/', 'hopper/'];
/* the key (and pad button, with a controller in) for an action, as the player has them bound (11o_ctrl.js) */
const tutKey = id => typeof CTRL !== 'undefined' && CTRL_A[id] ? CTRL.hint(id) : `<kbd>${id}</kbd>`;
const tutCars = T => T ? T.vehicles.filter(v => !isPower(v)).length : 0;
const tutMph = () => Math.abs(S.v) / MPH;
const tutStopped = () => Math.abs(S.v) < 0.05;
const tutRev = d => GAME.isDiesel() ? Math.sign(Math.round(S.reverser)) === d : d > 0 ? S.reverser > 0.25 : S.reverser < -0.25;
const tutOnMain = T => !!(T && ROUTE.main && ROUTE.main.edges.includes(T.frontTP().e));
function tutPanelOpen() { const p = $('carPanel'); return !!p && p.hidden === false; }

/* The lesson. Each step: what to do (title), why and how (body), the controls to light up on the stand (hi),
   who it is for (only: 'steam' | 'diesel'), and done(T, R) for steps the sim can see you do. A step without
   done is read and dismissed with Next. enter(R) runs when the step comes up. */
const TUT_STEPS = [
  { id: 'hello', title: 'Welcome to the cab',
    body: () => `You are on Yard 2 at Bellevue with a light engine. Three cars are waiting behind you: you will back onto them, couple up and take them out on the main. Press ${tutKey('cam1')} to ${tutKey('cam6')} (or ${tutKey('camCycle')}) to change cameras (${tutKey('cam2')} is the cab), drag to look around, and tap Next when you are ready.` },
  { id: 'indep', title: 'Release the engine brake', hi: ['lvInd'],
    body: () => `The engine brake holds the engine on its own. Press ${tutKey('indRel')} until the Engine lever reads 0, or drag the lever up. (${tutKey('indApp')} puts it back on.)`,
    done: () => S.indH < 0.05 },
  { id: 'train', title: 'The train brake', hi: ['lvBrake'],
    body: () => `The Train lever works the air brakes on every car. ${tutKey('brakeApp')} applies, ${tutKey('brakeRel')} releases. It sits in RUN while you drive: leave it there for now. You will use it to stop later.`,
    done: () => brakeZone(S.brakeH) === 'RUN' || brakeZone(S.brakeH) === 'REL' },
  { id: 'bell', title: 'Ring the bell, sound the whistle', hi: ['btnBell', 'btnWhistle'],
    body: () => `Ring the bell before you move: ${tutKey('bell')}. Then whistle to say you are about to go: three short blasts mean backing up. Hold ${tutKey('whistle')}, or the Whistle key, for each.`,
    enter: R => { R.blew = false; },
    done: (T, R) => S.bell && R.blew },
  { id: 'revBack', title: 'Reverser into reverse', hi: ['lvReverser'],
    body: () => GAME.isDiesel() ? `The reverser picks the direction. The cars are behind you, so press ${tutKey('revBack')} until it reads REV.` : `The reverser picks the direction and, on a steam engine, how long steam is admitted to the cylinders. The cars are behind you, so press ${tutKey('revBack')} until it is well back toward full reverse.`,
    done: () => tutRev(-1) },
  { id: 'throttleBack', title: 'Open the throttle', hi: ['lvThrottle'],
    body: () => GAME.isDiesel() ? `Press ${tutKey('throttleUp')} to notch the throttle out to 1 or 2. The engine loads up and starts to roll back.` : `Ease the throttle open with ${tutKey('throttleUp')}, a little at a time, until she starts to roll back. Too much on a cold rail and the drivers slip: ease off with ${tutKey('throttleDown')}.`,
    done: () => S.throttle > 0.01 && tutMph() > 0.5 && tutRev(-1) },
  { id: 'couple', title: 'Couple to the cars', hi: ['lvThrottle', 'lvInd'],
    body: () => `Watch behind you (${tutKey('cam5')} or ${tutKey('cam3')} helps) and keep it under 4 mph. Close the throttle (${tutKey('throttleDown')}) as you get close and let her drift into the cars. Their knuckle is open, so they couple when you touch.`,
    meter: () => ({ v: tutMph(), max: 8, mark: 4, txt: tutMph().toFixed(1) + ' mph', bad: tutMph() > 4 }),
    done: (T, R) => tutCars(T) > R.cars0 },
  { id: 'stop1', title: 'Stop', hi: ['lvThrottle', 'lvInd'],
    body: () => `Throttle closed (${tutKey('throttleDown')}) and the engine brake on (${tutKey('indApp')}) to bring her to a stand.`,
    done: () => tutStopped() && S.throttle < 0.01 },
  { id: 'cars', title: 'Look at your train', hi: ['btnCars'],
    body: () => `Press ${tutKey('cars')} or tap the Couplers button to see your train car by car. Tapping a coupler there, or the cut lever on the cars themselves, pulls the pin to set cars out again.`,
    done: () => tutPanelOpen() },
  { id: 'air', title: 'Pump up the air', hi: ['lvBrake'],
    body: () => `The cars were standing with their brakes bled off. Amber cars in the Couplers panel are still charging. Leave the Train lever in RUN (or ${tutKey('brakeRel')} to RELEASE to charge faster) until they all go grey.`,
    meter: (T) => { const c = T.vehicles.filter(v => !isPower(v)); const ok = c.filter(v => v.brake.AR >= 62).length; return { v: ok, max: Math.max(1, c.length), txt: `${ok} of ${c.length} charged` }; },
    done: T => T.vehicles.every(v => isPower(v) || v.brake.AR >= 62) },
  { id: 'revFwd', title: 'Reverser forward', hi: ['lvReverser', 'lvInd'],
    enter: () => { if (tutPanelOpen()) carPanelToggle(false); },
    body: () => `Now head out. Release the engine brake (${tutKey('indRel')}) and press ${tutKey('revFwd')} to put the reverser ${GAME.isDiesel() ? 'in FWD' : 'well forward'}. Bring the train brake back to RUN with ${tutKey('brakeRel')} if you moved it.`,
    done: () => tutRev(1) && S.indH < 0.05 && brakeZone(S.brakeH) !== 'SRV' && brakeZone(S.brakeH) !== 'EMG' },
  { id: 'out', title: 'Out onto the main', hi: ['lvThrottle'],
    body: () => `Open the throttle and pull out of the yard. The ladder at the east end is already lined for the main: the switch card at the top shows which way the next switch lies, and ${tutKey('throwSwitch')} throws it. Keep it under 15 mph through the yard switches.`,
    done: T => tutOnMain(T) },
  // ---- steam: the fire and the water
  { id: 'boiler', only: 'steam', title: 'Steam and water',
    body: () => `Everything comes from the boiler. On the gauges, watch the steam pressure (the big dial) and the water glass. Work her hard and the pressure falls; let the water drop out of the glass and you can melt the crown sheet. On Easy your fireman handles both, but try it yourself for a minute.` },
  { id: 'fire', only: 'steam', title: 'Fire her', hi: ['btnFire'],
    body: () => `Press ${tutKey('stoker')} or tap Stoker to feed more coal to the fire. That hands you the fire. More coal means more steam, but only once the fire has caught up: watch the pressure needle.`,
    done: () => !S.autoFire },
  { id: 'inject', only: 'steam', title: 'Water in the boiler', hi: ['btnInj'],
    body: () => `Press ${tutKey('injector')} or tap Inject to put the injector on. It forces water from the tender into the boiler: the glass rises, but cold water knocks the pressure back a little. Keep the glass about half full.`,
    done: () => S.injector },
  { id: 'fireBack', only: 'steam', title: 'Your fireman takes it back', enter: R => tutFireBack(R),
    body: () => `That is the job: coal for steam, water for the glass, and never let either run away. Your fireman has the boiler again. Choose Hand fired under Driving in the menu when you want to run it yourself, and ${tutKey('blower')} works the blower that draws the fire.` },
  // ---- diesel: notches and the dynamic brake
  { id: 'notch', only: 'diesel', title: 'Notch out', hi: ['lvThrottle'],
    body: () => `A diesel throttle has eight notches. Press ${tutKey('throttleUp')} for each one, and give the engine a moment to load up between notches. Run 4 or more.`,
    done: () => Math.round(S.throttle * GAME.notches()) >= 4 },
  // ---- running
  { id: 'speed', title: 'Up to 25 mph', hi: ['lvThrottle'],
    body: () => `Bring her up to 25 mph. The badge under your speed is the speed limit here: stay at or under it. If the drivers slip, ease off and put down sand with ${tutKey('sander')}.`,
    meter: () => ({ v: tutMph(), max: 30, mark: 25, txt: Math.round(tutMph()) + ' mph' }),
    done: () => tutMph() >= 25 },
  { id: 'dyn', only: 'diesel', title: 'The dynamic brake', hi: ['lvThrottle', 'lvDyn'],
    body: () => `The traction motors can hold the train back too. Throttle to idle (${tutKey('throttleDown')}), then ${tutKey('dynUp')} to set up the dynamic brake and feel it pull. ${tutKey('dynDown')} backs it off.`,
    done: () => S.dyn > 0.1 && S.throttle < 0.01 },
  { id: 'whistle', title: 'Whistle for the crossings', hi: ['btnWhistle'],
    body: () => `Out on the main you whistle for every road crossing: two long, a short and a long. Give it a try with ${tutKey('whistle')}.`,
    enter: R => { R.blew = false; },
    done: (T, R) => R.blew && S.whistle === 0 },
  { id: 'service', title: 'Set the train brake', hi: ['lvThrottle', 'lvBrake'],
    body: () => `Time to stop. Close the throttle${GAME.isDiesel() ? ' and the dynamic brake' : ''}, then press ${tutKey('brakeApp')} until the Train lever reads SERVICE. Air takes a few seconds to reach the back of the train: plan your stops early.`,
    done: () => S.throttle < 0.01 && brakeZone(S.brakeH) === 'SRV' },
  { id: 'slow', title: 'Bring her down', hi: ['lvBrake'],
    body: () => `Hold the brake and let the speed come down. More ${tutKey('brakeApp')} for a harder application. All the way down to EMERGENCY dumps the air at once, which is only for when something is in the way.`,
    meter: () => ({ v: tutMph(), max: 30, txt: Math.round(tutMph()) + ' mph' }),
    done: () => tutStopped() },
  { id: 'release', title: 'Release', hi: ['lvBrake', 'lvInd'],
    body: () => `Stopped. Put the engine brake on (${tutKey('indApp')}) to hold her, then ${tutKey('brakeRel')} back to RUN to release the train brake and recharge the air.`,
    done: () => tutStopped() && (brakeZone(S.brakeH) === 'RUN' || brakeZone(S.brakeH) === 'REL') && S.indH > 0.3 },
];

TUT.steps = loco => TUT_STEPS.filter(st => !st.only || st.only === loco);
TUT.done = () => { try { return localStorage.getItem('bd_tut') === 'done'; } catch (e) { return false; } };
TUT.mark = v => { try { localStorage.setItem('bd_tut', v); } catch (e) {} };

/* ---------------- starting, running and ending the lesson ---------------- */
/* from the menu: the lesson needs the Berkshire Division, one player and an engine that picks up cars */
TUT.start = function () {
  if (!GAME.ready) return;
  if (MP.on) { toast('The guided first run is single player. Leave the room to take it.', 'warn', 4200, 'tutmp'); return; }
  if (WORLD.custom || ROUTE_KEY !== 'ohio') {
    try { localStorage.setItem('bd_route', 'ohio'); localStorage.setItem('bd_tutGo', '1'); } catch (e) {}
    leavePage(location.pathname + '?route=ohio'); return;
  }
  const sp = LOCO_SPEC[GAME.settings.loco];
  if (sp.set || sp.turb) { const b = $('optLoco_765'); if (b) b.click(); }
  if (JOB.run) JOB.end();
  if (GAME.settings.job) { GAME.settings.job = ''; saveSettings(); jobMenu(); }
  TUT.want = true;
  GAME.start();
};
/* called by GAME.start right after the light engine is made up on Yard 2 */
TUT.begin = function () {
  const T = GAME.train; if (!T) return;
  const R = TUT.run = { i: 0, steps: TUT.steps(T.diesel ? 'diesel' : 'steam'), fire0: GAME.settings.fire, cars0: 0, blew: false, okT: 0, t0: S.time, cut: null };
  // three cars on the same track, a few car lengths behind the tender, their knuckles open
  const line = ROUTE.startLine, sF = line.len - 175 - T.length - TUT_GAP;
  R.cut = CARS.makeCut({ line: line.name, cars: TUT_CARS }, line, sF, rng(1944), 30000).cut;
  if (R.cut) R.cut.mid = 'tut';
  R.cars0 = tutCars(T);
  if (SKY.night) applyLook('morning', null);   // learn in daylight; the clock and the saved time of day are left alone
  CARS.gen++;
  TUT.enter();
  TUT.ui();
};
TUT.intro = function () { setTimeout(() => toast('Guided first run: follow the card on the left. Skip a step or end the lesson any time.', 'good', 5200, 'tutintro'), 600); };
TUT.step = () => TUT.run ? TUT.run.steps[TUT.run.i] || null : null;
TUT.enter = function () { const R = TUT.run, st = TUT.step(); R.okT = 0; R.stepT = S.time; if (st && st.enter) st.enter(R); TUT.glow(); };
TUT.next = function () {
  const R = TUT.run; if (!R) return;
  R.i++;
  if (R.i >= R.steps.length) { TUT.finish(); return; }
  TUT.enter(); TUT.ui();
};
/* the end of the lesson: the card says so, and the train is yours to keep driving */
TUT.finish = function () {
  const R = TUT.run; if (!R) return;
  tutFireBack(R);
  TUT.mark('done');
  R.over = true;
  TUT.glow();
  TUT.ui();
  toast('Guided first run complete. The railroad is yours.', 'good', 4200, 'tutdone');
  tutMenu();
};
/* stop the lesson; the train stays where it is and becomes an ordinary free run */
TUT.end = function (quiet) {
  const R = TUT.run; if (!R) { TUT.want = false; return; }
  tutFireBack(R);
  if (!R.over && !quiet) { TUT.mark(TUT.done() ? 'done' : 'skip'); toast('Lesson ended. Free running: the guided first run is in the Run tab whenever you want it.', '', 4600, 'tutend'); }
  TUT.run = null; TUT.want = false;
  // the menu's train choice follows the train you are on, so Resume keeps it rather than making up a new one
  const t = GAME.train; if (t && CONSISTS[t.consistKey] && !CONSISTS[t.consistKey].hidden) {
    GAME.settings.consist = t.consistKey; const host = $('optTrain');
    if (host) [...host.children].forEach(b => b.setAttribute('aria-pressed', String(b.id === 'optTrain_' + t.consistKey)));
  }
  TUT.glow(); TUT.ui(); tutMenu();
};
/* hand the fire back to however the player had it set before the lesson took it over */
function tutFireBack(R) {
  if (!R || R.fire0 === GAME.settings.fire) return;
  const b = $('optFire_' + R.fire0);
  if (b && b.click) b.click(); else { GAME.settings.fire = R.fire0; applyFireSetting(R.fire0); }
}

/* every frame from simStep: is the step done? a short pause on the tick before moving on */
TUT.tick = function (dt) {
  const R = TUT.run, T = GAME.train; if (!R || R.over || !T) return;
  if (S.whistle > 0) R.blew = true;   // a quick tap on the whistle is shorter than the check below
  TUT.hz += dt; if (TUT.hz < 0.1) return;
  const h = TUT.hz; TUT.hz = 0;
  const st = TUT.step(); if (!st) return;
  if (st.id === 'couple' && tutCars(T) > R.cars0 && !R.hit) {
    R.hit = R.lastMph || tutMph();
    toast(R.hit <= 4.5 ? `Coupled at ${R.hit.toFixed(1)} mph: nice and gentle.` : `Coupled at ${R.hit.toFixed(1)} mph. That rattled the cars: aim for 4 mph or less.`, R.hit <= 4.5 ? 'good' : 'warn', 3600, 'tutcpl');
  }
  R.lastMph = tutMph();
  if (!st.done) { TUT.meter(); return; }
  if (R.okT > 0 || st.done(T, R)) {
    if (!R.okT) TUT.ui(true);
    R.okT += h;
    if (R.okT > 0.9) TUT.next();
  } else TUT.meter();
};

/* ---------------- the card on the HUD ---------------- */
/* light up the levers and keys the step is about */
TUT.glow = function () {
  for (const el of document.querySelectorAll ? document.querySelectorAll('.tutHi') : []) el.classList.remove('tutHi');
  const st = TUT.run && !TUT.run.over && TUT.step(); if (!st || !st.hi) return;
  for (const id of st.hi) { const el = $(id); if (el && el.classList) el.classList.add('tutHi'); }
};
TUT.ui = function (ok) {
  const box = $('tutBox'); if (!box) return;
  const R = TUT.run;
  box.hidden = !R;
  if (!R) return;
  box.classList.toggle('ok', !!ok); box.classList.toggle('over', !!R.over);
  if (R.over) {
    $('tutStep').textContent = 'Lesson complete';
    $('tutTitle').textContent = 'You can drive a train';
    $('tutBody').innerHTML = `Brakes, reverser, throttle, coupling${GAME.isDiesel() ? ', notches and the dynamic brake' : ' and the fire'}: that is the whole of it. Keep going on the main, set the cars out with ${tutKey('cars')}, or take a job from the Run tab: <b>Elevator pickup</b> is a good first one. The keys are listed under Driving in the menu.`;
    $('tutMeter').hidden = true;
    $('tutNext').textContent = 'Keep driving'; $('tutNext').hidden = false;
    $('tutJob').hidden = !JOB.available || !JOB.available() || !JOB.def('elevator');
    $('tutSkip').hidden = true;
    return;
  }
  const st = TUT.step(); if (!st) return;
  const T = GAME.train;
  $('tutStep').textContent = `Guided first run · ${R.i + 1} of ${R.steps.length}`;
  $('tutTitle').textContent = (ok ? '✓ ' : '') + st.title;
  $('tutBody').innerHTML = st.body(T, R);
  $('tutNext').textContent = 'Next'; $('tutNext').hidden = !!st.done;
  $('tutJob').hidden = true;
  $('tutSkip').hidden = !st.done;
  TUT.meter();
};
TUT.meter = function () {
  const st = TUT.step(), m = $('tutMeter'); if (!m) return;
  if (!st || !st.meter || !GAME.train) { m.hidden = true; return; }
  const v = st.meter(GAME.train, TUT.run);
  m.hidden = false;
  const fill = m.querySelector('em'), mark = m.querySelector('i'), txt = m.querySelector('b');
  fill.style.width = (clamp(v.v / v.max, 0, 1) * 100).toFixed(1) + '%';
  m.classList.toggle('bad', !!v.bad);
  mark.hidden = v.mark == null; if (v.mark != null) mark.style.left = (clamp(v.mark / v.max, 0, 1) * 100).toFixed(1) + '%';
  if (txt.textContent !== v.txt) txt.textContent = v.txt;
};

/* ---------------- the offer in the menu ---------------- */
function tutMenu() {
  const g = $('grpTut'); if (!g) return;
  const done = TUT.done(), on = !!TUT.run && !TUT.run.over;
  g.classList.toggle('first', TUT.first && !done && !on);
  $('tutGo').textContent = on ? 'Restart the lesson' : done ? 'Take it again' : 'Start the lesson';
  $('tutState').textContent = on ? 'In progress: the card on the left walks you through it.' : done ? '✓ Completed. Run it again any time.' : TUT.first ? 'New here? Start with this.' : '';
  $('tutEnd').hidden = !on;
}
/* nothing saved yet: this browser has never run the game */
function tutFirst() {
  try { return !localStorage.getItem('bd_settings') && !localStorage.getItem('bd.menuTab') && !localStorage.getItem('bd_tut') && !localStorage.getItem('bd_jobs'); } catch (e) { return false; }
}
function tutSetup() {
  // the very first launch (TUT.first, read before the menu saved anything): open the menu on Run with the lesson picked out
  let go = false; try { go = localStorage.getItem('bd_tutGo') === '1'; localStorage.removeItem('bd_tutGo'); } catch (e) {}
  if ((TUT.first || go) && MENU_TABS.show) MENU_TABS.show('run');
  if (go) TUT.first = true;   // came over from another railroad to take it: picked out the same way
  $('tutGo').addEventListener('click', () => { if (TUT.run) TUT.end(true); TUT.start(); });
  $('tutEnd').addEventListener('click', () => { TUT.end(); GAME.start(); });
  $('tutNext').addEventListener('click', () => { if (TUT.run && TUT.run.over) TUT.end(true); else TUT.next(); });
  $('tutSkip').addEventListener('click', () => TUT.next());
  $('tutQuit').addEventListener('click', () => TUT.end());
  $('tutJob').addEventListener('click', () => { TUT.end(true); GAME.settings.job = 'elevator'; saveSettings(); jobMenu(); startLabel(); MENU_TABS.show('run'); GAME.pause(true); });
  $('tutMin').addEventListener('click', () => { const b = $('tutBox'); b.classList.toggle('mini'); $('tutMin').textContent = b.classList.contains('mini') ? '▸' : '▾'; });
  tutMenu();
}

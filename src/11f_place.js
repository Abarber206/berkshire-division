/* ============================================================================
   Place mode: the railroad holds still under a free camera, and the engine or
   a car follows the pointer along the nearest track until it is set down
   ========================================================================== */
Object.assign(PLACE, { cam: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0.8, dist: 75 }, heading: null, last: null, samples: null, ribbon: null, pick: null, touch: false, told: false });
const PLACE_COL = { ok: 0x52d483, join: 0xcfa651, warn: 0xf2b33d, bad: 0xee4b3d, pick: 0xdfe4e6 };
const PLACE_SWATCH = { box: '#5a3125', hopper: '#262a2d', tank: '#2f3436', gon: '#4c2d22', caboose: '#7a2a1e', coach: '#2c3d2a' };
const _pv = new THREE.Vector3(), _pw = new THREE.Vector3(), _ps = new THREE.Vector3(), _pd = new THREE.Vector3();

PLACE.toggle = () => PLACE.on ? PLACE.exit() : PLACE.enter();
PLACE.enter = function () {
  if (!GAME.running || !GAME.train || PLACE.on) return;
  if (JOB.activeId()) { toast('A job makes up its own train and cars, so placing is off until it is over. Abandon the job from its sheet to place things.', 'warn', 5200, 'placeJob'); return; }
  PLACE.on = true; PLACE.ghost = null; PLACE.pick = null;
  carPanelToggle(false); if (MAP.visible) MAP.close(); CPL.point(null);
  $('bigMsg').hidden = true; $('jobPanel').hidden = true; $('mpPanel').hidden = true;
  const p = GAME.train.lead.pos, c = PLACE.cam;
  c.x = p.x; c.y = p.y; c.z = p.z; c.yaw = Math.atan2(camera.position.x - p.x, camera.position.z - p.z); c.pitch = 0.8; c.dist = 75;
  $('hud').classList.add('placing'); $('placeBar').hidden = false;
  PLACE.chips(); PLACE.show();
  if (MP.on && !PLACE.toldMP) {
    PLACE.toldMP = PLACE.told = true;
    toast('Your train holds still while you place, but the room carries on around you. Cars you set down, pick up or couple are shared with everyone.', '', 7000, 'placeIntro');
  } else if (!PLACE.told) {
    PLACE.told = true;
    toast(matchMedia('(pointer: coarse)').matches ? 'Everything holds still while you place. Pick a car or your engine, tap the track to put it there, then tap Place. Tap a car on the track to pick it up.'
      : 'Everything holds still while you place. Pick a car or your engine and click the track to set it down; F turns it, Delete removes it, Esc puts it back.', '', 7000, 'placeIntro');
  }
};
PLACE.exit = function () {
  if (!PLACE.on) return;
  PLACE.cancel();
  PLACE.on = false; PLACE.pick = null;
  PLACE.ribbonAt(null); $('placeTip').hidden = true; $('gl').style.cursor = '';
  $('hud').classList.remove('placing'); $('placeBar').hidden = true;
  if (S.derailed) GAME.wreckBar();
  CAM.init = false; GAME.refreshKeys(); setTimeout(drawLeverTicks, 30);
};

/* ---------------- what is held ---------------- */
PLACE.newCar = function (type, quiet) {
  PLACE.cancel();
  if (!CARS.geo) CARS.geo = carGeos();
  const n = ++PLACE.made, num = type === 'coach' ? 3300 + n * 7 : 40000 + n * 11;
  const tr = type === 'coach' && GAME.train.trim || '';
  const m = type === 'coach' ? coachModel(LOCO_SPEC[GAME.train.locoKey], num, false, tr) : freightModel(type, num, rng(num));
  scene.add(m.root); linearizeObject(m.root);
  const v = carVehicle(m); v.yard = true; v.placed = true; v.hb = true; v.made = { type, num, rk: GAME.train.locoKey, rs: ROAD_SHORT };
  if (tr) v.made.tr = tr;
  v.brake = { AR: 0, BC: 0, BP: 0, emerg: false, released: true };
  const c = new Cut(scene, [v]); c.setVisible(false);
  PLACE.ghost = { c, kind: 'new', type, fit: null };
  if (quiet) PLACE.show(); else PLACE.again();
};
/* pick up vehicle v of consist c: the engine brings the whole train, a car comes on its own */
PLACE.lift = function (c, v) {
  PLACE.cancel();
  const T = GAME.train;
  // the engine brings its whole train; another train standing with its engine is always picked up whole
  if ((c === T && isPower(v)) || c.parkS) PLACE.ghost = { c, kind: 'train', orig: c.pts.map(p => p.tp.clone()), fit: null };
  else { const g = PLACE.split(c, v); if (!g) return; PLACE.ghost = { c: g, kind: 'car', type: v.kind, orig: g.endTP('front'), fit: null }; }
  const C = PLACE.ghost.c, f = C.endTP('front'), r = C.endTP('rear'), a = tpXYZ(f), b = tpXYZ(r);
  PLACE.heading = { x: a[0] - b[0], z: a[2] - b[2] };
  PLACE.ghost.fit = PLACE.fit(C, f);
  PLACE.pick = null; sndPin(0.4, false);
  PLACE.show();
};
/* let go of what is held: a new car goes away, anything picked up goes back where it was */
PLACE.cancel = function () {
  const g = PLACE.ghost; if (!g) return;
  PLACE.ghost = null;
  if (g.kind === 'new') PLACE.discard(g.c);
  else if (g.kind === 'train') { g.c.pts.forEach((p, i) => p.tp.copy(g.orig[i])); g.c.update(0, S.theta, S.reverser); PLACE.changed(); }
  else { const f = PLACE.fit(g.c, g.orig); if (f.ok) PLACE.commit(g.c, f); else { g.c.place(g.orig); CARS.cuts.push(g.c); PLACE.changed(); } }
  PLACE.show();
};
PLACE.discard = function (c) { c.dispose(); c.vehicles.forEach(freeVehicle); };
PLACE.remove = function () {
  let g = PLACE.ghost;
  if (!g && PLACE.pick) {
    const pc = PLACE.pick.c;
    // another of your trains: pick it up first, so taking a whole train away is never one slip of a key
    if (pc.parkS) { PLACE.lift(pc, PLACE.pick.v); toast(`Holding ${FLEET.name(pc)}. Press Remove (or Delete) again to take the whole train off the railroad.`, 'warn', 4200, 'placeDel'); return; }
    if (isPower(PLACE.pick.v)) { toast('Your engine stays on the railroad. Pick it up to set it down somewhere else.', 'warn', 3600, 'placeEng'); return; }
    PLACE.lift(pc, PLACE.pick.v); g = PLACE.ghost;
  }
  if (!g) return;
  if (g.kind === 'train' && g.c.parkS) { PLACE.ghost = null; FLEET.remove(g.c, true); PLACE.changed(); PLACE.show(); return; }
  if (g.kind === 'train') { toast('Your engine stays on the railroad. Set it down somewhere, or press Put back.', 'warn', 3600, 'placeEng'); return; }
  PLACE.ghost = null; PLACE.discard(g.c);
  toast(`${CAR_NAMES[g.type] || 'Car'} taken off the railroad.`, '', 2200, 'placeDel');
  PLACE.show();
};
PLACE.flip = function () {
  const g = PLACE.ghost; if (!g) return;
  if (PLACE.heading) PLACE.heading = { x: -PLACE.heading.x, z: -PLACE.heading.z };
  if (g.fit && g.fit.F) g.fit = PLACE.fit(g.c, PLACE.turned(g.c));
  PLACE.show();
};
/* an engine from the menu's list: change to it in place (as the menu does), then pick the train up */
PLACE.engine = function (k) {
  PLACE.cancel();
  const old = GAME.settings.loco, b = $('optLoco_' + k);
  if (old !== k && b) {
    b.click();
    if (!GAME.train || GAME.train.locoKey !== k) { const o = $('optLoco_' + old); if (o) o.click(); return; }
  }
  const T = GAME.train;
  PLACE.lift(T, T.lead);
  PLACE.chips();
};

/* ---------------- following the pointer ---------------- */
function placeSamples() {
  if (PLACE.samples) return PLACE.samples;
  const a = [];
  for (const e of NET.edges) {
    for (let s = 0; s < e.len; s += 4) a.push({ e, s, v: new THREE.Vector3(...tpXYZ({ e, s })) });
    a.push({ e, s: e.len, v: new THREE.Vector3(...tpXYZ({ e, s: e.len })) });
  }
  return (PLACE.samples = a);
}
/* screen position of a world point, or null behind the camera */
function placeScreen(p) {
  _ps.subVectors(p, camera.position); camera.getWorldDirection(_pd);
  if (_ps.dot(_pd) < 0.5) return null;
  _ps.copy(p).project(camera);
  return [(_ps.x + 1) / 2 * innerWidth, (1 - _ps.y) / 2 * innerHeight];
}
/* the nearest point of track under screen point (x, y), facing the way the held vehicle faces */
PLACE.trackAt = function (x, y) {
  const lim = PLACE.touch ? 60 : 44, far = (PLACE.cam.dist * 5 + 400) ** 2;
  let best = null, bd = lim * lim;
  camera.updateMatrixWorld();
  for (const q of placeSamples()) {
    if (q.v.distanceToSquared(camera.position) > far) continue;
    const p = placeScreen(q.v); if (!p) continue;
    const d = (p[0] - x) ** 2 + (p[1] - y) ** 2;
    if (d < bd) { bd = d; best = q; }
  }
  if (!best) return null;
  const e = best.e; let bs = best.s; bd = Infinity;
  for (let s = Math.max(0, best.s - 4); s <= Math.min(e.len, best.s + 4) + 1e-6; s += 0.25) {
    const p = placeScreen(_pv.set(...tpXYZ({ e, s: Math.min(s, e.len) }))); if (!p) continue;
    const d = (p[0] - x) ** 2 + (p[1] - y) ** 2;
    if (d < bd) { bd = d; bs = Math.min(s, e.len); }
  }
  const h = e.heading(bs), H = PLACE.heading || { x: Math.cos(PLACE.cam.yaw), z: -Math.sin(PLACE.cam.yaw) };
  return new TrackPos(e, bs, Math.cos(h) * H.x - Math.sin(h) * H.z >= 0 ? 1 : -1);
};
/* the engine or car under screen point (x, y) */
PLACE.vehicleAt = function (x, y) {
  let best = null, bd = Infinity;
  const ppm = innerHeight / (2 * Math.tan(camera.fov * Math.PI / 360));
  for (const c of [GAME.train, ...CARS.cuts]) for (const v of c.vehicles) {
    if (!v.pos || v.root.visible === false) continue;
    const dc = v.pos.distanceTo(camera.position), lim = Math.max(26, 1.7 * ppm / dc);
    _pv.copy(v.pos).addScaledVector(v.fwd, v.len / 2); _pv.y += 1.8; const a = placeScreen(_pv);
    _pv.copy(v.pos).addScaledVector(v.fwd, -v.len / 2); _pv.y += 1.8; const b = placeScreen(_pv);
    if (!a || !b) continue;
    const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / L2, 0, 1);
    const d = Math.hypot(a[0] + t * dx - x, a[1] + t * dy - y);
    if (d < lim && d + dc * 0.01 < bd) { bd = d + dc * 0.01; best = { c, v }; }
  }
  return best;
};
PLACE.hoverAt = function (x, y) {
  PLACE.last = { x, y };
  const g = PLACE.ghost;
  if (!g) { PLACE.pick = PLACE.vehicleAt(x, y); PLACE.show(); return; }
  const tp = PLACE.trackAt(x, y);
  if (!tp) { if (g.kind === 'new') { g.fit = null; g.c.setVisible(false); } PLACE.show(); return; }
  // the half of the car ahead of the pointer may run back through a switch lined for another track
  const front = tp.clone(), via = PLACE.against(tp, g.c.length / 2);
  front.advance(g.c.length / 2, null);
  g.fit = PLACE.fit(g.c, front, g.c, via);
  if (g.fit.F) {
    g.c.setVisible(true);
    if (g.kind === 'train') g.c.update(0, S.theta, S.reverser);
    const a = tpXYZ(g.fit.F), b = tpXYZ(g.fit.R);
    PLACE.heading = { x: a[0] - b[0], z: a[2] - b[2] };
  } else if (g.kind === 'new') g.c.setVisible(false);
  PLACE.show();
};
/* the held vehicle under the last pointer position again (a new one picked, or the view moved) */
PLACE.again = function () { if (PLACE.last && !PLACE.touch) PLACE.hoverAt(PLACE.last.x, PLACE.last.y); else PLACE.show(); };

/* ---------------- setting it down ---------------- */
/* switches under the held vehicle that would have to be thrown for it, if they can be */
function placeLining(f) {
  for (const { sw } of f.line) for (const s of swPair(sw)) {
    const held = PLACE.ghost.c, on = CARS.cuts.find(c => c !== held && c.fouls(s));
    if (on) return on.parkS ? `${FLEET.name(on)} is on ${s.name}` : `Cars are standing over ${s.name}`;
    if (held !== GAME.train && GAME.occupied(s)) return `Your train is on ${s.name}`;
    const ai = AI.holding(s); if (ai) return ai.replace(/\.$/, '');
  }
  return null;
}
function placeName(c) {
  if (c === GAME.train) return 'your train';
  if (c.parkS) return FLEET.name(c);
  if (c.ai) return c.ai.name;
  const n = c.vehicles.length, k = c.vehicles[0].kind, same = c.vehicles.every(v => v.kind === k);
  return n === 1 ? `the ${(CAR_NAMES[k] || 'car').toLowerCase()}${c.home ? ' on ' + c.home : ''}` : `the ${n} ${same ? (CAR_NAMES[k] || 'car').toLowerCase() + 's' : 'cars'}${c.home ? ' on ' + c.home : ''}`;
}
/* what setting it down here would do, as [colour, words] */
function placeVerdict(g) {
  const f = g.fit;
  if (!f) return null;
  if (f.why === 'short') return ['bad', 'Not enough track here'];
  if (f.why === 'clash') return ['bad', `In the way of ${placeName(f.hit)}`];
  if (f.why === 'points') { const no = placeLining(f); return no ? ['bad', no] : ['warn', `Lines ${f.line.map(l => l.sw.name).join(' and ')} for it`]; }
  if (f.joins.length) return ['join', 'Couples to ' + f.joins.map(j => placeName(j.c)).join(' and ')];
  if (f.fouls.length) return ['warn', `Foul of ${f.fouls.map(s => s.name).join(' and ')}: it holds the switch`];
  const line = PLACE.lineOf(f.F);
  return ['ok', line || 'Clear track'];
}
PLACE.drop = function () {
  const g = PLACE.ghost; if (!g || !g.fit) return;
  let f = g.fit;
  if (f.why === 'points') {
    const no = placeLining(f);
    if (no) { toast(no + '. Wait for it to clear, or set this down somewhere else.', 'bad', 3200, 'placeNo'); return; }
    for (const { sw, li } of f.line) for (const s of swPair(sw)) { s.state = li; MP.noteThrow(s); }
    sndThrow();
    f = g.fit = PLACE.fit(g.c, f.F);
  }
  if (!f.ok) { const v = placeVerdict(g); toast(v ? v[1] + '.' : 'That will not go there.', 'bad', 2600, 'placeNo'); PLACE.show(); return; }
  const joins = f.joins.map(j => placeName(j.c)), line = PLACE.lineOf(f.F);
  if (g.kind !== 'train' && line) g.c.home = line;
  PLACE.commit(g.c, f);
  PLACE.ghost = null;
  if (joins.length) sndCouple(0.7); else sndClunk(0.35, 0);
  const what = g.kind === 'train' ? (g.c === GAME.train ? 'Your train' : FLEET.name(g.c)) : (CAR_NAMES[g.type] || 'Car');
  if (g.kind === 'train' && g.c === GAME.train) {
    const T = GAME.train;
    S.v = 0; S.vw = 0; S.limit = Math.min(...T.pts.map(p => p.tp.e.limit));
    GAME.jointMem = new Map(); GAME.filling = null; GAME.lastStation = null;
    if (S.derailed) GAME.rerail();
    T.update(0, S.theta, S.reverser);
  }
  toast(joins.length ? `${what} coupled to ${joins.join(' and ')}.` : `${what} set down on ${line || 'the track'}${g.kind === 'train' ? '' : ', handbrake tied'}.`, 'good', 2200, 'placed');
  if (g.kind === 'new') PLACE.newCar(g.type, true); else PLACE.show();
};
/* touch: tap the track to move what is held there, tap it again (or Place) to set it down */
PLACE.tapAt = function (x, y, mouse) {
  const g = PLACE.ghost;
  if (g) {
    if (mouse) { PLACE.hoverAt(x, y); PLACE.drop(); return; }
    if (g.fit && g.fit.F && PLACE.onGhost(x, y)) { PLACE.drop(); return; }
    PLACE.hoverAt(x, y); return;
  }
  const hit = PLACE.vehicleAt(x, y);
  if (hit) { PLACE.lift(hit.c, hit.v); return; }
  _ray.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
  const sw = _ray.intersectObjects(NET.switches.map(s => s.vis.hit), false);
  if (sw.length) { GAME.throwSwitch(sw[0].object.userData.sw); PLACE.show(); }
};
PLACE.onGhost = function (x, y) {
  const f = PLACE.ghost.fit, a = placeScreen(_pv.set(...tpXYZ(f.F))), b = placeScreen(_pw.set(...tpXYZ(f.R)));
  if (!a || !b) return false;
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / L2, 0, 1);
  return Math.hypot(a[0] + t * dx - x, a[1] + t * dy - y) < 44;
};

/* ---------------- drawing ---------------- */
/* a translucent band on the rails from front coupler F back len metres, with a point showing which way the
   front faces; null hides it */
PLACE.ribbonAt = function (F, len, col, arrow) {
  let m = PLACE.ribbon;
  if (!F) { if (m) m.visible = false; return; }
  if (!m) {
    m = PLACE.ribbon = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
    m.renderOrder = 6; m.frustumCulled = false; scene.add(m);
  }
  const rows = [], t = F.clone(), fr = newFrame(), w = 1.95;
  if (arrow) { const a = F.clone(); a.advance(2.6, null); rows.push([a, 0]); }
  rows.push([t.clone(), w]);
  for (let d = 0; d < len; ) { const k = Math.min(1, len - d); t.advance(-k, null); d += k; rows.push([t.clone(), w]); }
  const pos = new Float32Array(rows.length * 6), idx = [];
  rows.forEach(([p, hw], i) => {
    p.pose(fr);
    for (let j = 0; j < 2; j++) { const s = j ? hw : -hw, o = i * 6 + j * 3; pos[o] = fr.p.x + fr.r.x * s + fr.u.x * 0.05; pos[o + 1] = fr.p.y + fr.r.y * s + fr.u.y * 0.05; pos[o + 2] = fr.p.z + fr.r.z * s + fr.u.z * 0.05; }
    if (i) idx.push((i - 1) * 2, i * 2, (i - 1) * 2 + 1, (i - 1) * 2 + 1, i * 2, i * 2 + 1);
  });
  m.geometry.dispose();
  m.geometry = new THREE.BufferGeometry();
  m.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.geometry.setIndex(idx);
  m.material.color.setHex(PLACE_COL[col]).convertSRGBToLinear();
  m.visible = true;
};
/* the band, the pointer label, the hint line and the buttons, for what is held or pointed at now */
PLACE.show = function () {
  if (!PLACE.on) return;
  const g = PLACE.ghost, tip = $('placeTip'), touch = PLACE.touch;
  let label = '', hint;
  if (g) {
    const v = placeVerdict(g);
    if (g.fit && g.fit.F) PLACE.ribbonAt(g.fit.F, g.c.length, v ? v[0] : 'ok', true); else PLACE.ribbonAt(null);
    const name = g.kind === 'train' ? (g.c === GAME.train ? 'Your train' : FLEET.name(g.c)) : (CAR_NAMES[g.type] || 'Car');
    label = v ? `<b>${name}</b> · ${v[1]}` : '';
    hint = !g.fit ? `${touch ? 'Tap' : 'Point at'} the track to put ${g.kind === 'train' ? 'it' : 'the ' + name.toLowerCase()} there.`
      : v && v[0] === 'bad' ? `${v[1]}. ${touch ? 'Tap' : 'Try'} somewhere else.`
      : touch ? `${v[1]}. Tap it again or press Place to set it down; Turn swaps its ends.` : `${v[1]}. Click to set it down · F turns it · Esc ${g.kind === 'new' ? 'lets go' : 'puts it back'}.`;
    $('gl').style.cursor = 'crosshair';
  } else {
    const p = PLACE.pick;
    if (p) {
      const C = p.c, T = GAME.train, train = (C === T && isPower(p.v)) || !!C.parkS;
      PLACE.ribbonAt(train ? C.endTP('front') : PLACE.frontOf(C, p.v), train ? C.length : p.v.len, 'pick', train);
      const n = T.vehicles.filter(v => !isPower(v)).length;
      label = C.parkS ? `<b>${FLEET.name(C)}</b> · click to move it` : train ? `<b>Your train</b>${n ? ` · ${n} car${n > 1 ? 's' : ''}` : ''} · click to move it` : `<b>${C === T ? carName(T, p.v) + ' in your train' : CAR_NAMES[p.v.kind] || 'Car'}</b> · click to pick it up`;
    } else PLACE.ribbonAt(null);
    $('gl').style.cursor = p ? 'grab' : '';
    hint = touch ? 'Pick a car or an engine below, or tap one on the track to pick it up. Drag to look around; pinch to zoom and turn.'
      : 'Pick a car or an engine below, or click one on the track to pick it up. Drag to pan, right-drag to turn the view, scroll to zoom.';
  }
  if (label && !touch && PLACE.last) {
    tip.innerHTML = label; tip.hidden = false;
    tip.style.transform = `translate(${Math.min(PLACE.last.x + 16, innerWidth - tip.offsetWidth - 8)}px, ${PLACE.last.y + 18}px)`;
  } else tip.hidden = true;
  $('placeHint').textContent = hint;
  for (const b of $('placeCars').children) b.setAttribute('aria-pressed', String(!!g && g.kind !== 'train' && b.dataset.car === g.type));
  for (const b of $('placeEngines').children) b.setAttribute('aria-pressed', String(!!g && g.kind === 'train' && b.dataset.loco === GAME.train.locoKey));
  $('placeFlip').disabled = !g;
  $('placeRemove').disabled = !(g ? g.kind !== 'train' || g.c.parkS : PLACE.pick && PLACE.pick.c.parkS);
  $('placeBack').disabled = !g; $('placeBack').textContent = g && g.kind === 'new' ? 'Let go' : 'Put back';
  $('placeGo').disabled = !g || !g.fit || !g.fit.F || placeVerdict(g)[0] === 'bad';
};
/* the palette: every engine the menu offers, and the cars */
PLACE.chips = function () {
  const eng = $('placeEngines'), cars = $('placeCars');
  eng.innerHTML = '';
  for (const b of $('optLoco').children) {
    const k = b.id.slice('optLoco_'.length), name = b.firstChild && b.firstChild.nodeType === 3 ? b.firstChild.textContent : b.textContent;
    const c = document.createElement('button'); c.type = 'button'; c.className = 'pchip eng'; c.dataset.loco = k;
    c.innerHTML = `${name}${GAME.train && GAME.train.locoKey === k ? '<small>yours</small>' : ''}`;
    c.addEventListener('click', () => PLACE.engine(k));
    eng.appendChild(c);
  }
  if (!cars.children.length) for (const k in PLACE_CARS) {
    const c = document.createElement('button'); c.type = 'button'; c.className = 'pchip'; c.dataset.car = k;
    c.innerHTML = `<i style="background:${PLACE_SWATCH[k]}"></i>${PLACE_CARS[k]}`;
    c.addEventListener('click', () => { if (PLACE.ghost && PLACE.ghost.kind === 'new' && PLACE.ghost.type === k) PLACE.cancel(); else PLACE.newCar(k); });
    cars.appendChild(c);
  }
};

/* ---------------- the free camera ---------------- */
PLACE.pan = function (dx, dy) {
  const c = PLACE.cam, k = c.dist * 0.0021, sy = Math.sin(c.yaw), cy = Math.cos(c.yaw);
  c.x = clamp(c.x - cy * dx * k - sy * dy * k, -9000, 9000);
  c.z = clamp(c.z + sy * dx * k - cy * dy * k, -9000, 9000);
};
PLACE.camera = function (cam, dt) {
  const c = PLACE.cam, gy = groundAt(c.x, -c.z);
  if (isFinite(gy)) c.y += (gy - c.y) * Math.min(1, dt * 6);
  const cp = Math.cos(c.pitch);
  cam.position.set(c.x + Math.sin(c.yaw) * cp * c.dist, c.y + Math.sin(c.pitch) * c.dist, c.z + Math.cos(c.yaw) * cp * c.dist);
  const floor = groundAt(cam.position.x, -cam.position.z) + 2; if (isFinite(floor) && cam.position.y < floor) cam.position.y = floor;
  cam.lookAt(c.x, c.y, c.z);
  cam.near = 0.3; CAM.fov = cam.aspect < 1 ? 64 : 52; cam.fov = CAM.fov; cam.updateProjectionMatrix();
};
PLACE.focus = () => _pw.set(PLACE.cam.x, PLACE.cam.y, PLACE.cam.z);
PLACE.home = function () { const p = GAME.train.lead.pos; Object.assign(PLACE.cam, { x: p.x, z: p.z }); };

/* ---------------- input ---------------- */
PLACE.setup = function (canvas) {
  const ptrs = new Map(); let tap = null, two = null, turn = false;
  canvas.addEventListener('pointerdown', e => {
    if (!PLACE.on) return;
    canvas.setPointerCapture(e.pointerId);
    PLACE.touch = e.pointerType !== 'mouse';
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) { tap = { x: e.clientX, y: e.clientY, t: performance.now() }; turn = !PLACE.touch && (e.button === 2 || e.shiftKey || e.ctrlKey); }
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], c = PLACE.cam; two = { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), my: (a.y + b.y) / 2, dist: c.dist, yaw: c.yaw, pitch: c.pitch }; tap = null; }
  });
  canvas.addEventListener('pointermove', e => {
    if (!PLACE.on) return;
    if (!ptrs.has(e.pointerId)) { if (e.pointerType === 'mouse') { PLACE.touch = false; PLACE.hoverAt(e.clientX, e.clientY); } return; }
    const p = ptrs.get(e.pointerId), dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 8) tap = null;
    const c = PLACE.cam;
    if (ptrs.size === 2 && two) {
      const [a, b] = [...ptrs.values()];
      c.dist = clamp(two.dist * two.d / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), 12, 900);
      c.yaw = two.yaw - (Math.atan2(b.y - a.y, b.x - a.x) - two.ang);
      c.pitch = clamp(two.pitch + ((a.y + b.y) / 2 - two.my) * 0.004, 0.12, 1.45);
      return;
    }
    if (tap || ptrs.size !== 1) return;
    if (turn) { c.yaw -= dx * 0.006; c.pitch = clamp(c.pitch + dy * 0.004, 0.12, 1.45); } else PLACE.pan(dx, dy);
  });
  const up = e => {
    if (!PLACE.on) return;
    if (tap && ptrs.size === 1 && performance.now() - tap.t < 500 && !turn) PLACE.tapAt(e.clientX, e.clientY, e.pointerType === 'mouse');
    ptrs.delete(e.pointerId); if (ptrs.size < 2) two = null; tap = null;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); tap = null; two = null; });
  canvas.addEventListener('pointerleave', () => { if (PLACE.on && !ptrs.size) $('placeTip').hidden = true; });
  canvas.addEventListener('wheel', e => { if (!PLACE.on) return; e.preventDefault(); PLACE.cam.dist = clamp(PLACE.cam.dist * (1 + e.deltaY * 0.0012), 12, 900); }, { passive: false });
  canvas.addEventListener('contextmenu', e => { if (PLACE.on) e.preventDefault(); });
  $('btnPlace').addEventListener('click', () => PLACE.toggle());
  $('placeDone').addEventListener('click', () => PLACE.exit());
  $('placeFlip').addEventListener('click', () => PLACE.flip());
  $('placeRemove').addEventListener('click', () => PLACE.remove());
  $('placeBack').addEventListener('click', () => PLACE.cancel());
  $('placeGo').addEventListener('click', () => PLACE.drop());
  $('placeHome').addEventListener('click', () => PLACE.home());
  $('placeRotL').addEventListener('click', () => { PLACE.cam.yaw += 0.4; });
  $('placeRotR').addEventListener('click', () => { PLACE.cam.yaw -= 0.4; });
};
/* keys while placing (the driving keys are off) */
PLACE.key = function (e) {
  const c = PLACE.cam, move = { ArrowUp: [0, 60], ArrowDown: [0, -60], ArrowLeft: [60, 0], ArrowRight: [-60, 0], KeyW: [0, 60], KeyS: [0, -60], KeyA: [60, 0], KeyD: [-60, 0] }[e.code];
  if (move) { PLACE.pan(move[0], move[1]); e.preventDefault(); return; }
  if (e.code === 'KeyQ') { c.yaw += 0.06; return; }
  if (e.code === 'KeyE') { c.yaw -= 0.06; return; }
  if (e.key === '+' || e.key === '=') { c.dist = clamp(c.dist / 1.15, 12, 900); return; }
  if (e.key === '-' || e.key === '_') { c.dist = clamp(c.dist * 1.15, 12, 900); return; }
  if (e.repeat) return;
  const cars = Object.keys(PLACE_CARS), n = e.code.startsWith('Digit') ? +e.code.slice(5) : 0;
  if (n >= 1 && n <= cars.length) { PLACE.touch = false; PLACE.newCar(cars[n - 1]); return; }
  switch (e.code) {
    case 'Escape': if (PLACE.ghost) PLACE.cancel(); else PLACE.exit(); break;
    case 'KeyG': PLACE.exit(); break;
    case 'KeyF': case 'KeyR': PLACE.flip(); break;
    case 'Enter': PLACE.drop(); break;
    case 'Delete': case 'Backspace': PLACE.remove(); e.preventDefault(); break;
    case 'KeyH': PLACE.home(); break;
  }
};

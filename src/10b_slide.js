/* ============================================================================
   Emergency stops you can feel: sparks where locked wheels skid on the rail,
   the slack running in car by car, and the lurch and judder in the cab.
   Physics (which wheels are locked, how hard they hold) is in 08_physics.js.
   ========================================================================== */
const SLIDE = { surge: 0, surgeV: 0, judder: 0, shakeT: 0, kick: 0, wasEmg: false, wasSlide: false, settle: 0 };
const SPK = { N: 2600, G: 64, next: 0 };
const _sp = new THREE.Vector3(), _sq = new THREE.Vector3(), _sm = new THREE.Matrix4(), _sn = new THREE.Matrix4();

function buildSparks(scene) {
  const N = SPK.N, G = SPK.G;
  Object.assign(SPK, { p: new Float32Array(N * 3), v: new Float32Array(N * 3), age: new Float32Array(N).fill(1e9), life: new Float32Array(N), floor: new Float32Array(N) });
  // flying sparks: short additive streaks from where the spark is back along its path
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
  lg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
  SPK.lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
  // a white-hot glow at each skidding wheel's contact with the rail
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(G * 3), 3));
  gg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(G * 3), 3));
  const tex = canvasTex(32, 32, (c) => { const gr = c.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 32, 32); }, { srgb: false });
  SPK.glow = new THREE.Points(gg, new THREE.PointsMaterial({ size: 0.42, map: tex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
  for (const o of [SPK.lines, SPK.glow]) { o.frustumCulled = false; o.renderOrder = 6; o.visible = false; scene.add(o); }
}

/* every wheel of a sliding vehicle where it meets the rail, nearest the camera first, out to 150 m */
function slideContacts(T, cp, out) {
  out.length = 0;
  for (const v of T.vehicles) {
    if (!v.slide || !v.pos || v.pos.distanceTo(cp) > 150) continue;
    if (v.kind === 'loco' && !T.diesel) {
      for (const a of [LG.aL, ...LG.aD, ...LG.aT]) for (const z of [-RAIL_OFF, RAIL_OFF]) out.push(_sp.set(ax(a), 0.02, z * 1.1).applyMatrix4(v.root.matrix).clone());
      continue;
    }
    for (let k = 0; k < v.trucks.length; k++) {
      const t = v.trucks[k], sp = t.sp || 1.676;
      frameMatrix(v.tp[k].F, _sm); if (v.flip) _sm.multiply(_sn.makeRotationY(Math.PI));
      for (const x of t.type === 'four' ? [-0.865, 0.865] : [-sp, 0, sp]) for (const z of [-RAIL_OFF, RAIL_OFF]) out.push(_sp.set(x, 0.02, z * 1.1).applyMatrix4(_sm).clone());
    }
  }
  out.sort((a, b) => a.distanceToSquared(cp) - b.distanceToSquared(cp));
  return out;
}

function sparkEmit(p, fwd, side, speed) {
  const i = SPK.next; SPK.next = (SPK.next + 1) % SPK.N;
  const j = i * 3, f = speed * (0.15 + Math.random() * 0.45), out = Math.random() * 1.6, up = 0.4 + Math.random() * 2.6;
  SPK.p[j] = p.x + (Math.random() - 0.5) * 0.12; SPK.p[j + 1] = p.y; SPK.p[j + 2] = p.z + (Math.random() - 0.5) * 0.12;
  SPK.v[j] = fwd.x * f + side.x * out * Math.sign(Math.random() - 0.3) + (Math.random() - 0.5) * 0.8;
  SPK.v[j + 1] = up;
  SPK.v[j + 2] = fwd.z * f + side.z * out * Math.sign(Math.random() - 0.3) + (Math.random() - 0.5) * 0.8;
  SPK.age[i] = 0; SPK.life[i] = 0.25 + Math.random() * 0.45; SPK.floor[i] = p.y - 0.2;
}

const _contacts = [];
function updateSparks(dt, T, cam) {
  if (!SPK.lines) return;
  const run = GAME.running && !S.paused && !S.derailed, v = Math.abs(S.v);
  const live = run && S.slideN > 0 && v > 0.4 && !T.diesel;
  const C = live ? slideContacts(T, cam.position, _contacts) : (_contacts.length = 0, _contacts);
  if (live && dt > 0) {
    const fwd = _sq.copy(T.lead.fwd).multiplyScalar(Math.sign(S.v)), side = new THREE.Vector3(-fwd.z, 0, fwd.x);
    // more and livelier sparks the faster the wheels skid; the nearest wheels get the most
    const rate = 150 * Math.min(1, v / 8) * (0.6 + 0.4 * Math.min(1, v / 25));
    for (let k = 0; k < C.length; k++) {
      const w = rate / (1 + (C[k].distanceTo(cam.position) / 30) ** 2) * dt;
      let n = Math.floor(w + Math.random()); while (n-- > 0) sparkEmit(C[k], fwd, side, v);
    }
  }
  const lp = SPK.lines.geometry.attributes.position.array, lc = SPK.lines.geometry.attributes.color.array;
  let any = false;
  const drag = Math.exp(-dt * 2.2);
  for (let i = 0; i < SPK.N; i++) {
    const j = i * 3, o = i * 6;
    if (SPK.age[i] > SPK.life[i]) { if (lc[o] || lc[o + 3]) lc.fill(0, o, o + 6); continue; }
    any = true;
    SPK.v[j] *= drag; SPK.v[j + 2] *= drag; SPK.v[j + 1] = SPK.v[j + 1] * drag - 9.81 * dt;
    SPK.p[j] += SPK.v[j] * dt; SPK.p[j + 1] += SPK.v[j + 1] * dt; SPK.p[j + 2] += SPK.v[j + 2] * dt;
    if (SPK.p[j + 1] < SPK.floor[i]) { SPK.p[j + 1] = SPK.floor[i]; SPK.v[j + 1] *= -0.3; SPK.v[j] *= 0.5; SPK.v[j + 2] *= 0.5; }
    SPK.age[i] += dt;
    // white-yellow when struck, cooling through orange to a dull red
    const t = SPK.age[i] / SPK.life[i], h = 1 - t, b = 1.6 * h;
    const r = b, g = b * (0.35 + 0.6 * h * h), bl = b * 0.45 * h * h * h;
    const tl = Math.min(0.06, 0.6 / (Math.hypot(SPK.v[j], SPK.v[j + 1], SPK.v[j + 2]) + 1e-3));
    lp[o] = SPK.p[j]; lp[o + 1] = SPK.p[j + 1]; lp[o + 2] = SPK.p[j + 2];
    lp[o + 3] = SPK.p[j] - SPK.v[j] * tl; lp[o + 4] = SPK.p[j + 1] - SPK.v[j + 1] * tl; lp[o + 5] = SPK.p[j + 2] - SPK.v[j + 2] * tl;
    lc[o] = r; lc[o + 1] = g; lc[o + 2] = bl; lc[o + 3] = r * 0.25; lc[o + 4] = g * 0.15; lc[o + 5] = 0;
  }
  SPK.lines.visible = any;
  if (any) { SPK.lines.geometry.attributes.position.needsUpdate = true; SPK.lines.geometry.attributes.color.needsUpdate = true; }
  // contact glow, flickering with the skid
  const gp = SPK.glow.geometry.attributes.position.array, gc = SPK.glow.geometry.attributes.color.array, n = Math.min(SPK.G, C.length);
  const heat = Math.min(1, v / 6);
  for (let k = 0; k < SPK.G; k++) {
    if (k < n) { gp[k * 3] = C[k].x; gp[k * 3 + 1] = C[k].y; gp[k * 3 + 2] = C[k].z; const f = heat * (0.55 + 0.45 * Math.random()); gc[k * 3] = f; gc[k * 3 + 1] = f * 0.62; gc[k * 3 + 2] = f * 0.25; }
    else { gc[k * 3] = gc[k * 3 + 1] = gc[k * 3 + 2] = 0; }
  }
  SPK.glow.visible = n > 0;
  if (n) { SPK.glow.geometry.attributes.position.needsUpdate = true; SPK.glow.geometry.attributes.color.needsUpdate = true; }
}

/* The feel of it. The engine's surge is a spring the deceleration leans on: an emergency application throws you
   forward, then each car's slack running in behind bangs into the engine in turn, and when the train finally
   stops the slack runs back out and rocks it. Skidding drivers judder through the whole cab. */
function slideFeel(dt, T) {
  if (!dt) return;
  const v = Math.abs(S.v), run = GAME.running && !S.paused && !S.derailed;
  const z = brakeZone(S.brakeH), emg = run && z === 'EMG';
  const dir = Math.sign(S.v) || SLIDE.lastDir || 1; if (S.v) SLIDE.lastDir = Math.sign(S.v);
  if (emg && !SLIDE.wasEmg && v > 1) {
    SLIDE.surgeV += 0.05 * dir * Math.min(1, v / 15);
    if (AU.on && SND.has('dump')) SND.shot('dump', AU.world, { gain: (SND_GAIN.dump || 1) * (CAM.mode === 'cab' ? 1 : 0.5) });
  }
  SLIDE.wasEmg = emg;
  // slack running in: each car bangs as its brakes take hold, front to rear as the emergency travels down the pipe
  const cp = camera.position;
  let i = 0;
  for (const x of T.vehicles) {
    const on = !!x.slide;
    if (on && !x.slideSeen && run && v > 1) {
      const hard = Math.min(1, v / 20), dist = x.pos ? x.pos.distanceTo(cp) : 50;
      if (AU.on) sndClunk((0.45 + 0.6 * hard) / (1 + (dist / 25) ** 1.3), Math.random() * 0.04);
      // the engine feels the cars close behind it the most
      const k = Math.abs(i - T.li);
      if (k > 0 && k < 10) SLIDE.surgeV += 0.22 * hard * dir / (1 + 0.45 * k);
    }
    x.slideSeen = on; i++;
  }
  // brought to a stand: the slack runs back out, the train rocks and settles
  const sliding = S.slideN > 0;
  if (SLIDE.wasSlide && !sliding && v < 0.1 && run) {
    SLIDE.surgeV -= 0.09 * dir; SLIDE.settle = 1.2;
    if (AU.on) { let k = 0; for (let j = T.vehicles.length - 1; j >= 0; j--) { const x = T.vehicles[j]; if (!x.pos) continue; const d = x.pos.distanceTo(cp); if (d < 120) sndClunk(0.45 / (1 + (d / 25) ** 1.3), (k++) * 0.09); } }
  }
  SLIDE.wasSlide = sliding;
  // forward lean from the deceleration (only steam trains skid; everything feels the brakes), under-damped
  const target = clamp(-(S.accel || 0), -2, 2) * 0.035;
  SLIDE.surgeV += (90 * (target - SLIDE.surge) - 7 * SLIDE.surgeV) * dt;
  SLIDE.surge = clamp(SLIDE.surge + SLIDE.surgeV * dt, -0.2, 0.2);
  // skidding judder: strongest at speed, fading out as the train slows
  const jt = S.slide && run ? 0.4 + 0.6 * Math.min(1, v / 20) : 0;
  SLIDE.judder += (jt - SLIDE.judder) * Math.min(1, dt * 6);
  SLIDE.shakeT += dt;
  SLIDE.settle = Math.max(0, SLIDE.settle - dt);
}

/* camera offset: the surge and full judder in the cab, a touch of judder for the outside cameras that ride along */
function slideCam(cam, T, inCab) {
  const k = inCab ? 1 : (CAM.riding() ? 0.35 : 0), sg = inCab ? SLIDE.surge : 0;
  if (!k || (!SLIDE.judder && Math.abs(sg) < 1e-4)) return;
  const t = SLIDE.shakeT, j = SLIDE.judder * k;
  const f = T.lead.fwd;
  cam.position.addScaledVector(f, sg);
  cam.position.y += j * (Math.sin(t * 83) * 0.006 + Math.sin(t * 131 + 1) * 0.004);
  cam.position.x += j * Math.sin(t * 97 + 2) * 0.004; cam.position.z += j * Math.sin(t * 89 + 3) * 0.004;
  // nod with the surge (head goes the way the train was going), and the judder in the view
  _sq.set(0, 0, -1).applyQuaternion(cam.quaternion);
  const nod = sg * 0.5 * (f.x * _sq.x + f.z * _sq.z), ang = j * Math.sin(t * 71) * 0.0025 + nod;
  cam.rotateX(-ang); cam.rotateZ(j * Math.sin(t * 59 + 1.3) * 0.002);
}

/* ============================================================================
   Recorded sound. Voices are played from field recordings in audio/ (sources
   and licences in audio/CREDITS.md):
   - one-shots (exhaust beats, rail joints, couplers, bell strokes) pick a
     different take each time, with a little variation in pitch and level;
   - continuous sounds (rolling, wind, blower, prime mover) are woven from
     overlapping slices of a long take with equal-power crossfades, at random
     places, so no loop point or repeat is ever heard.
   Each train is heard through an emitter that delays its sound by distance
   over the speed of sound, which gives true Doppler and lag, with air
   absorption, falloff and stereo position. If the recordings can't be
   fetched (the page opened from a file), the voices in 09_audio.js play instead.
   ========================================================================== */
const SND = { bufs: {}, last: {}, loading: false, ready: false, beds: [], ahead: 0.5 };
const C_AIR = 343;

SND.load = function () {
  if (SND.loading || !AU.ctx || typeof fetch !== 'function' || location.protocol === 'file:') return;
  SND.loading = true;
  const decode = a => new Promise((ok, no) => { const p = AU.ctx.decodeAudioData(a, ok, no); if (p && p.catch) p.catch(no); });
  const jobs = [];
  for (const [k, list] of Object.entries(SND_FILES)) list.forEach((f, i) => jobs.push(
    fetch('audio/' + f).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).then(decode)
      .then(b => { (SND.bufs[k] || (SND.bufs[k] = []))[i] = b; }).catch(() => {})));
  Promise.all(jobs).then(() => { SND.ready = true; });
};
SND.has = k => !!(SND.bufs[k] && SND.bufs[k].some(Boolean));
/* a take of k: index i, or a random one that isn't the last one played */
SND.pick = function (k, i) {
  const l = SND.bufs[k]; if (!l) return null;
  if (i !== undefined) return l[i] || null;
  const n = l.length; if (n === 1) return l[0] || null;
  let j = (Math.random() * n) | 0; if (j === SND.last[k]) j = (j + 1 + ((Math.random() * (n - 1)) | 0)) % n;
  SND.last[k] = j; return l[j] || l.find(Boolean);
};
/* play a one-shot. o: gain, rate, when, delay, dur (fade out by then), lp/hp (Hz), pan, vary (pitch spread), i (take) */
SND.shot = function (k, dest, o = {}) {
  const b = SND.pick(k, o.i); if (!b || !AU.on) return null;
  const ctx = AU.ctx, t = o.when || ctx.currentTime + 0.006 + (o.delay || 0);
  const s = ctx.createBufferSource(); s.buffer = b;
  const vary = o.vary === undefined ? 0.05 : o.vary;
  s.playbackRate.value = (o.rate || 1) * (1 + (Math.random() - 0.5) * vary);
  const g = ctx.createGain(), gain = (o.gain === undefined ? 1 : o.gain) * (1 + (Math.random() - 0.5) * 0.16);
  let n = s;
  if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = 0.5; n.connect(f); n = f; }
  if (o.hp) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = o.hp; f.Q.value = 0.5; n.connect(f); n = f; }
  n.connect(g);
  if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = clamp(o.pan, -1, 1); g.connect(p); p.connect(dest); } else g.connect(dest);
  const off = o.offset || 0, len = (b.duration - off) / s.playbackRate.value;
  const dur = Math.min(len, o.dur || len);
  // a take started part way in fades up over 4 ms; a cut-short one fades out over its last third
  g.gain.setValueAtTime(off > 0 ? 0 : gain, t); if (off > 0) g.gain.linearRampToValueAtTime(gain, t + 0.004);
  if (dur < len) { g.gain.setValueAtTime(gain, t + dur * 0.62); g.gain.linearRampToValueAtTime(0, t + dur); }
  s.start(t, off); s.stop(t + dur + 0.02);
  return { s, g };
};

/* A continuous sound woven from a long take: slices of seg[0]..seg[1] s taken at
   random, each overlapping the last by xf s with equal-power curves. set() steers
   level and playback rate smoothly; with the level at zero it stops scheduling. */
const XF_IN = new Float32Array(64), XF_OUT = new Float32Array(64);
for (let i = 0; i < 64; i++) { const a = i / 63 * Math.PI / 2; XF_IN[i] = Math.sin(a); XF_OUT[i] = Math.cos(a); }
class Bed {
  constructor(k, dest, o = {}) {
    this.k = k; this.i = o.i; this.keep = !!o.keep; this.seg = o.seg || [2.2, 4.5]; this.xf = o.xf || 0.7; this.vary = o.vary || 0;
    this.out = AU.ctx.createGain(); this.out.gain.value = 0; this.out.connect(dest);
    this.level = 0; this.rate = 1; this.next = 0; this.live = []; this.quiet = 0; this.prev = -1;
    SND.beds.push(this);
  }
  get ok() { return this.i === undefined ? SND.has(this.k) : !!SND.pick(this.k, this.i); }
  set(level, rate = this.rate, tc = 0.15) {
    const now = AU.ctx.currentTime;
    if (level > 0.0005 && this.level <= 0.0005) this.quiet = 0;
    if (level <= 0.0005 && this.level > 0.0005) this.quiet = now;
    this.level = level; this.out.gain.setTargetAtTime(level, now, tc);
    if (Math.abs(rate - this.rate) > 1e-4) { this.rate = rate; for (const s of this.live) s.playbackRate.setTargetAtTime(rate * s.vr, now, tc); }
  }
  tick() {
    const ctx = AU.ctx, now = ctx.currentTime;
    this.live = this.live.filter(s => s.end > now);
    if (!this.keep && this.level <= 0.0005 && now - this.quiet > 1.5) { this.next = 0; return; }
    const b = this.i === undefined ? this.buf() : SND.pick(this.k, this.i);
    if (!b) return;
    if (this.next < now) this.next = now + 0.01;
    while (this.next < now + SND.ahead) this.grain(b);
  }
  buf() { const l = SND.bufs[this.k]; return l ? l[(Math.random() * l.length) | 0] || l.find(Boolean) : null; }
  grain(b) {
    const ctx = AU.ctx, xf = this.xf;
    const L = this.seg[0] + Math.random() * (this.seg[1] - this.seg[0]);
    const vr = 1 + (Math.random() - 0.5) * this.vary, r = this.rate * vr;
    const span = Math.min(b.duration, (L + xf) * r * 1.25 + 0.05);
    let off = Math.random() * Math.max(0, b.duration - span);
    if (Math.abs(off - this.prev) < span * 0.5 && b.duration > span * 3) off = (off + span * 1.5) % (b.duration - span);
    this.prev = off;
    const t = this.next, s = ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = r; s.vr = vr;
    const g = ctx.createGain(); g.gain.value = 0;
    g.gain.setValueCurveAtTime(XF_IN, t, xf); g.gain.setValueCurveAtTime(XF_OUT, t + L - xf, xf);
    s.connect(g); g.connect(this.out); s.start(t, off); s.stop(t + L + 0.02); s.end = t + L + 0.05;
    s.onended = () => { try { g.disconnect(); } catch (e) {} };
    this.live.push(s);
    this.next = t + L - xf;
  }
  kill() { for (const s of this.live) { try { s.stop(); } catch (e) {} } this.live = []; try { this.out.disconnect(); } catch (e) {} const i = SND.beds.indexOf(this); if (i >= 0) SND.beds.splice(i, 1); }
}

/* A tonal sustain (a whistle or horn held open) can't be woven from random slices
   without phasing, so it plays a loop cut at matching phase (audio/ makes them)
   from a random point, with the same set() as a Bed. */
class Loop {
  constructor(k, dest) { this.k = k; this.out = AU.ctx.createGain(); this.out.gain.value = 0; this.out.connect(dest); this.s = null; this.rate = 1; this.level = 0; SND.beds.push(this); }
  get ok() { return SND.has(this.k); }
  set(level, rate = this.rate, tc = 0.1) {
    const now = AU.ctx.currentTime; this.level = level; this.out.gain.setTargetAtTime(level, now, tc);
    if (this.s && Math.abs(rate - this.rate) > 1e-4) this.s.playbackRate.setTargetAtTime(rate, now, 0.04);
    this.rate = rate;
  }
  tick() {
    if (this.s || !this.ok) return;
    const b = SND.pick(this.k, 0), s = AU.ctx.createBufferSource(); s.buffer = b; s.loop = true; s.playbackRate.value = this.rate;
    s.connect(this.out); s.start(0, Math.random() * b.duration); this.s = s;
  }
  kill() { try { if (this.s) this.s.stop(); this.out.disconnect(); } catch (e) {} const i = SND.beds.indexOf(this); if (i >= 0) SND.beds.splice(i, 1); }
}

/* Where a source is heard from: propagation delay (Doppler falls out of it),
   distance falloff, air absorption, more room than direct sound far off, and pan. */
const _snA = new THREE.Vector3(), _snB = new THREE.Vector3();
class Emitter {
  constructor(o = {}) {
    const ctx = AU.ctx;
    this.in = ctx.createGain();
    this.delay = ctx.createDelay(5); this.delay.delayTime.value = 0;
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 16000; this.lp.Q.value = 0.5;
    this.g = ctx.createGain(); this.g.gain.value = 0;
    this.in.connect(this.delay); this.delay.connect(this.lp); this.lp.connect(this.g);
    this.pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (this.pan) { this.g.connect(this.pan); this.pan.connect(AU.master); } else this.g.connect(AU.master);
    this.send = ctx.createGain(); this.send.gain.value = 0.15; this.g.connect(this.send); this.send.connect(AU.verbIn);
    this.ref = o.ref || 26; this.law = o.law || 1.25; this.d = -1;
  }
  /* p: world position; o.cab: heard from the cab of this train (no delay, close and muffled) */
  place(p, o = {}) {
    const ctx = AU.ctx, now = ctx.currentTime, cam = camera.position;
    const d = o.cab ? 3 : Math.max(1, p.distanceTo(cam));
    const dl = o.cab ? 0 : d / C_AIR;
    // a camera cut moves the listener instantly: jump the delay rather than sweep it
    if (this.d < 0 || Math.abs(dl - this.delay.delayTime.value) > 0.25) { this.delay.delayTime.cancelScheduledValues(now); this.delay.delayTime.setValueAtTime(dl, now); }
    else this.delay.delayTime.setTargetAtTime(dl, now, 0.09);
    this.d = d;
    const gain = o.cab ? (o.cabGain || 0.85) : 1 / (1 + Math.pow(d / this.ref, this.law));
    this.g.gain.setTargetAtTime(gain * (o.gain === undefined ? 1 : o.gain), now, 0.08);
    this.lp.frequency.setTargetAtTime(o.cab ? (o.cabLP || 6500) : clamp(16000 / (1 + d / 90), 900, 16000), now, 0.1);
    this.send.gain.setTargetAtTime(o.cab ? 0.05 : 0.12 + 0.55 * clamp(d / 400, 0, 1), now, 0.2);
    if (this.pan) {
      let x = 0;
      if (!o.cab) { _snA.subVectors(p, cam).normalize(); _snB.set(1, 0, 0).applyQuaternion(camera.quaternion); x = _snA.dot(_snB) * clamp(30 / (d + 10), 0.35, 0.85); }
      this.pan.pan.setTargetAtTime(x, now, 0.1);
    }
  }
  kill() { try { this.g.disconnect(); this.send.disconnect(); if (this.pan) this.pan.disconnect(); } catch (e) {} }
}

/* ---------------------------------------------------------------- voices
   SND.init runs once the audio context exists. The engine's own bus (AU.loco)
   is re-routed through SND.loco, so synthesized fallbacks get the same
   propagation. Wheels, flanges and brakes come from SND.train, which sits on
   whichever car is nearest the listener. */
SND.init = function () {
  SND.loco = new Emitter({ ref: 26 });
  AU.locoLP.disconnect(); AU.locoLP.connect(SND.loco.in);
  SND.train = new Emitter({ ref: 16, law: 1.35 });
  const L = AU.loco, W = SND.train.in, A = AU.world;
  SND.v = {
    blower: new Bed('blower', L), safety: new Bed('safety', L, { seg: [1.4, 2.8], xf: 0.5 }), injector: new Bed('injector', L),
    cocks: new Bed('cocks', L, { seg: [1, 2], xf: 0.4 }), fire: new Bed('fire', L), bpx: new Bed('bpx', L, { seg: [1, 2], xf: 0.4 }),
    turbo: new Bed('turbo', L), dyn: new Bed('dyn', L), comp: new Bed('comp', L), motor: new Bed('motor', L),
    roll: new Bed('roll', W, { seg: [2, 4], xf: 0.9 }), flange: new Bed('flange', W, { seg: [1.2, 2.6], xf: 0.5, vary: 0.05 }), squeal: new Bed('squeal', W, { seg: [1, 2], xf: 0.4, vary: 0.04 }),
    wind: new Bed('wind', A, { seg: [3, 6], xf: 1.2 }), birds: new Bed('birds', A, { seg: [6, 11], xf: 1.8 }), night: new Bed('night', A, { seg: [6, 11], xf: 1.8 }),
  };
  SND.dz = (SND_DZ || []).map((r, i) => ({ rpm: r.rpm, load: r.load || 0, bed: new Bed('dz', L, { i, seg: [1.6, 3.2], xf: 0.6 }) }));
  SND.whistle = null; SND.whKey = null;
  SND.load();
};
SND.tick = function () { for (const b of SND.beds) b.tick(); };
/* a recorded voice when its takes are loaded (at rec, times its trim), otherwise the synthesized layer at syn */
function duo(bed, layer, syn, rec = syn, rate = 1, tc = 0.15) {
  if (bed.ok) { bed.set(rec * (SND_GAIN[bed.k] || 1), rate, tc); if (layer) setG(layer.g || layer, 0, tc); return true; }
  bed.set(0); if (layer) setG(layer.g || layer, syn, tc);
  return false;
}

/* the player's train, every frame: fx.src is where the engine is heard from, tv its velocity */
let sndJointMem = null;
function soundMix(dt, T, fx, tv) {
  const L = T.loco, DSL = T.diesel, cp = camera.position, inCab = CAM.mode === 'cab';
  const now = AU.ctx.currentTime, v = Math.abs(S.v), working = fx.working, Vv = SND.v;
  SND.ahead = clamp(dt * 4, 0.5, 2);   // schedule further ahead when frames come slowly
  SND.tick();
  SND.loco.place(fx.src, { cab: inCab, cabLP: DSL ? 5200 : 7000 });
  AU.loco.gain.setTargetAtTime(1, now, 0.08); AU.locoLP.frequency.setTargetAtTime(16000, now, 0.1);
  // wheels, flanges and brakes: from the car nearest the listener
  let near = T.lead, nd = 1e9;
  if (inCab) near = T.lead; else for (const x of T.vehicles) { const d = x.pos.distanceTo(cp); if (d < nd) { nd = d; near = x; } }
  SND.train.place(near.pos, { cab: inCab, cabGain: 0.55, cabLP: 2400 });
  // steam: blower, safety valves, injector, open cylinder cocks standing, firebox (in the cab)
  duo(Vv.blower, AU.blower, DSL ? 0 : S.blower * 0.22, DSL ? 0 : S.blower * 0.5);
  duo(Vv.safety, AU.safety, !DSL && S.safety ? 0.5 : 0, !DSL && S.safety ? 1 : 0, 1, 0.15);
  duo(Vv.injector, AU.injector, !DSL && S.injector ? 0.1 : 0, !DSL && S.injector ? 0.55 : 0, 1, 0.2);
  const cocksSt = !DSL && S.cocks && v < 0.5 && S.throttle > 0.02 ? S.throttle : 0;
  duo(Vv.cocks, AU.cocks, 0.25 * cocksSt, 0.8 * cocksSt);
  duo(Vv.fire, AU.firedoor, !DSL && inCab ? 0.14 * S.fire : 0, !DSL && inCab ? 0.5 * S.fire : 0);
  setG(AU.drift.g, !DSL && !working && v > 1 && !Vv.roll.ok ? 0.08 * Math.min(1, v / 12) : 0);
  // rolling: the recorded take is sped up with the train
  duo(Vv.roll, AU.roar, 0.32 * Math.min(1, v / 22), Math.min(1, v / 18) ** 1.2 * (inCab ? 0.7 : 1), clamp(0.55 + v / 30, 0.6, 1.6), 0.2);
  updateDieselAudio(DSL && !T.elec, inCab, T.nUnits || 1);
  updateElectricAudio(T, inCab);
  // brake pipe venting at the brake valve, heard in and around the cab
  const b0 = T.lead.brake, vent = b0.dBP < -0.3 ? Math.min(1, -b0.dBP * 0.12) : 0;
  duo(Vv.bpx, AU.bpExhaust, Math.min(0.5, vent * 0.5), vent * (inCab ? 0.9 : 0.5), 1, 0.05);
  // flange squeal on curves, brake shoe squeal at low speed
  const lp0 = T.lead.leadPt.tp, kk = Math.abs(lp0.e.curv(lp0.s));
  const gw = 1 / (1 + Math.pow(cp.distanceTo(T.lead.pos) / 30, 1.3));
  const fl = kk > 1 / 320 && v > 1.5 ? Math.min(1, v / 8) * clamp((kk - 1 / 320) * 900, 0.3, 1) : 0;
  duo(Vv.flange, AU.flange, 0.05 * fl * gw, 0.5 * fl, clamp(0.85 + v / 60, 0.85, 1.25), 0.25);
  const bcAvg = T.vehicles.reduce((a, x) => a + x.brake.BC, 0) / T.vehicles.length;
  const sq = bcAvg > 15 && v > 0.3 && v < 9 ? clamp((bcAvg - 15) / 30, 0.3, 1) * (v < 3 ? v / 3 : 1) : 0;
  duo(Vv.squeal, AU.bsq, sq ? 0.035 * gw : 0, 0.35 * sq, clamp(1.15 - v / 40, 0.9, 1.15), 0.15);
  // whistle or horn
  whistleMix(T, tv, inCab);
  // rail joints under nearby trucks
  if (v > 0.6) {
    const mem = GAME.jointMem;
    for (const x of T.vehicles) {
      const dv = x.pos.distanceTo(cp); if (dv > 110 && !(inCab && x.kind === 'loco')) continue;
      const g = Math.min(1, v / 7) / (1 + Math.pow((inCab ? Math.max(4, dv) : dv) / 13, 1.4)) * (inCab ? 0.7 : 1);
      const pts = (x.kind === 'loco' || x.kind === 'loco2') ? (DSL ? [[x.fp[0], x.emu ? 2 : 3, x.emu ? x.model.wb : DG.axle], [x.fp[1], x.emu ? 2 : 3, x.emu ? x.model.wb : DG.axle]] : [[x.leadPt, 1, 0], [x.fp[0], 4, 1.855]]) : x.tp.map((p, i) => [p, x.trucks[i].type === 'four' ? 2 : 3, x.trucks[i].sp || (x.trucks[i].type === 'four' ? 1.73 : 1.676)]);
      for (const [p, axles, sp] of pts) {
        const j = Math.floor(p.tp.s / 11.89), prev = mem.get(p);
        if (prev && prev.e === p.tp.e && prev.j !== j) for (let a = 0; a < axles; a++) sndJoint(g * (a === 0 ? 1 : 0.8), a * sp / v, inCab ? null : x.pos, v);
        mem.set(p, { e: p.tp.e, j });
      }
    }
  }
  ambience(dt, inCab, v);
}

/* whistle or horn. Recorded: the attack of the take, then its sustain loop held
   while the cord is pulled; a part-open valve sounds lower and breathier (the quill).
   Doppler comes from the emitter. Synthesized: the voices of 09_audio.js. */
function whistleMix(T, tv, inCab) {
  const DSL = T.diesel, key = LOCO_SPEC[GAME.settings.loco].whistle, k = 'wh_' + key, pull = S.whistle, now = AU.ctx.currentTime;
  if (SND.has(k)) {
    if (SND.whKey !== k) { if (SND.whistle) SND.whistle.kill(); SND.whistle = new Loop(k, AU.loco); SND.whKey = k; SND.whPull = 0; }
    const R = WHISTLE_REC[key], opening = pull > SND.whPull + 0.002;
    if (pull > 0.05 && SND.whPull <= 0.05) SND.shot(k + '_on', AU.loco, { gain: (SND_GAIN[k] || 1) * Math.pow(pull, 0.6), vary: 0.01, dur: R.on });
    SND.whistle.set((SND_GAIN[k] || 1) * Math.pow(pull, DSL ? 0.5 : 0.8) * (inCab ? 0.7 : 1), 1 - R.quill * (1 - pull), opening ? R.attack : R.release);
    SND.whPull = pull;
    if (AU.whistle) setG(AU.whistle.out, 0);
    return;
  }
  if (!AU.whistle) return;
  const L = T.loco, cp = camera.position;
  const src = T.worldOf(DSL ? L.hornPos : L.whistlePos);
  const toCam = new THREE.Vector3().subVectors(cp, src); const dist = toCam.length(); toCam.normalize();
  const vr = inCab ? 0 : tv.dot(toCam);
  const dop = C_AIR / (C_AIR - clamp(vr, -60, 60));
  const gwh = (inCab ? 0.55 : 1 / (1 + Math.pow(dist / 90, 1.1))) * Math.pow(pull, DSL ? 0.5 : 0.8) * 0.95;
  setG(AU.whistle.out, gwh, AU.whistle.attack);
  const bend = 1 - AU.whistle.quill * (1 - pull);
  for (const vc of AU.whistle.voices) { const f = vc.f * bend * dop; vc.o1.frequency.setTargetAtTime(f, now, 0.04); vc.o2.frequency.setTargetAtTime(f * vc.ratio2, now, 0.04); }
  AU.whistle.lp.frequency.setTargetAtTime(inCab ? 3200 : clamp(11000 / (1 + dist / 160), 1800, 7000), now, 0.1);
}

/* the countryside: wind (rising past the cab windows with speed), birds by day,
   crickets at night, all hushed by snow */
let sndChirpT = 2;
function ambience(dt, inCab, v) {
  const Vv = SND.v, snow = SKY.snow, night = SKY.night, wet = SKY.weather === 'overcast';
  const draught = inCab ? 0.9 * Math.min(1, (v / 30) ** 2) : 0;
  duo(Vv.wind, AU.wind, inCab ? 0.32 * Math.min(1, (v / 30) ** 2) + 0.02 : 0.03, (snow ? 0.32 : wet ? 0.24 : 0.16) * (inCab ? 0.5 : 1) + draught, 1 + (inCab ? 0.25 * Math.min(1, v / 30) : 0), 0.4);
  const out = inCab ? 0.35 : 1;
  Vv.birds.set(!night && !snow ? (wet ? 0.5 : 1) * out * (SND_GAIN.birds || 1) : 0, 1, 1.5);
  Vv.night.set(night && !snow ? out * (SND_GAIN.night || 1) : 0, 1, 1.5);
  if (Vv.birds.ok) return;
  sndChirpT -= dt; if (sndChirpT < 0) { sndChirpT = 1.5 + Math.random() * (night ? 2 : 5); if (!inCab && !snow) sndChirp(night); }
}

/* playback rate of a prime-mover take at engine speed rpm: matched to the take's own speed
   when there are takes either side, but with a single idle take only part of the way, so
   eighth notch sounds like the same engine working harder rather than a sped-up tape */
function dzRate(D, d, rpm) {
  if (D.length === 1) return 1 + 0.6 * clamp((rpm - d.rpm) / 750, 0, 1);
  return clamp(Math.max(rpm, 60) / d.rpm, 0.75, 1.3);
}
/* recorded prime mover: the takes either side of the engine speed cross-fade,
   each sped up or slowed to match it, so notching up runs smoothly through them */
function dieselRec(on, inCab, units) {
  const D = SND.dz; if (!D.length || !D[0].bed.ok) return false;
  const Vv = SND.v, rpm = S.rpm, running = on && rpm > 20;
  const k = 1 + 0.28 * (units - 1), cab = inCab ? 0.6 : 1;
  let lo = 0; while (lo < D.length - 2 && rpm > D[lo + 1].rpm) lo++;
  const hi = Math.min(D.length - 1, lo + 1), w = hi === lo ? 0 : clamp((rpm - D[lo].rpm) / (D[hi].rpm - D[lo].rpm), 0, 1);
  const lvl = running ? (0.55 + 0.45 * S.load) * k * cab * Math.min(1, rpm / 250) : 0;
  D.forEach((d, i) => {
    const wt = i === lo ? Math.cos(w * Math.PI / 2) : i === hi ? Math.sin(w * Math.PI / 2) : 0;
    d.bed.set(lvl * wt * (SND_GAIN.dz || 1), dzRate(D, d, rpm), 0.12);
  });
  duo(Vv.turbo, null, 0, running ? S.turbo * S.turbo * cab : 0, 0.7 + 0.6 * S.turbo, 0.3);
  duo(Vv.dyn, null, 0, on ? S.dbLoad * cab : 0, 0.8 + 0.3 * S.dbLoad, 0.4);
  const v = Math.abs(S.v), work = clamp((Math.abs(S.TE) + S.DBF) / 445e3, 0, 1.4);
  duo(Vv.motor, null, 0, on ? work * Math.min(1, v / 2) * cab * 0.6 : 0, clamp(0.4 + v / 25, 0.4, 1.8), 0.15);
  duo(Vv.comp, null, 0, on && S.pumping && S.engineRun ? cab : 0, 1, 0.3);
  return true;
}

/* one exhaust beat from the recorded takes: four to a turn of the drivers, each
   cut short as the next one comes; a light throttle or short cutoff sounds softer
   and duller, a hard pull at low speed uses the heavy takes */
function chuffRec(k, n, intensity, dest, cocks) {
  const beat = 1 / (4 * Math.max(n, 0.05)), limp = (k % 4 === 1 || k % 4 === 3) ? 0.86 : 1;
  const hard = intensity > 0.75 && n < 1.3 && SND.has('chuff_hard');
  SND.shot(hard ? 'chuff_hard' : 'chuff', dest, {
    gain: intensity * limp * (SND_GAIN[hard ? 'chuff_hard' : 'chuff'] || 1), dur: clamp(beat * 1.8, 0.1, 1.5),
    rate: 1 + 0.08 * Math.min(1, n / 4), lp: 1500 + 7000 * clamp(intensity, 0, 1), vary: 0.06,
  });
  if (cocks && SND.has('cocks')) SND.shot('cocks', dest, { gain: (SND_GAIN.cocks || 1) * 0.7 * Math.min(1, intensity + 0.3), dur: clamp(beat * 2, 0.15, 0.8) });
}
/* a wheel over a rail joint, heard from where the truck is: later and further round with distance */
function jointRec(gain, delay, pos, v) {
  let pan = 0, lp = 0, d = 0;
  if (pos) { d = pos.distanceTo(camera.position); _snA.subVectors(pos, camera.position).normalize(); _snB.set(1, 0, 0).applyQuaternion(camera.quaternion); pan = _snA.dot(_snB) * clamp(30 / (d + 10), 0.3, 0.85); lp = clamp(16000 / (1 + d / 60), 1500, 16000); }
  else lp = 3500;   // under the cab floor
  SND.shot('joint', AU.world, { gain: gain * (SND_GAIN.joint || 1), delay: delay + d / C_AIR, pan, lp, rate: clamp(0.9 + v / 120, 0.9, 1.2), vary: 0.08 });
}

/* ---------------------------------------------------------------- other trains
   Another player's train or an AI train: its engine through one emitter, its
   wheels through another on the car nearest the listener. Recorded where the
   takes are loaded, with a small synthesized stand-in otherwise. */
function makeRemoteBus(diesel) {
  const ctx = AU.ctx, em = new Emitter({ ref: 26 }), wheels = new Emitter({ ref: 16, law: 1.35 });
  const g = em.in, nodes = [];
  const rs = ctx.createBufferSource(); rs.buffer = AU.noise; rs.loop = true; const rf = ctx.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 260; rf.Q.value = 0.7;
  const roar = ctx.createGain(); roar.gain.value = 0; rs.connect(rf); rf.connect(roar); roar.connect(wheels.in); rs.start(0, Math.random()); nodes.push(rs);
  let eng = null;
  if (diesel) {
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; const o2 = ctx.createOscillator(); o2.type = 'square';
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380; f.Q.value = 1;
    const eg = ctx.createGain(); eg.gain.value = 0; const g2 = ctx.createGain(); g2.gain.value = 0.4;
    o1.connect(f); o2.connect(g2); g2.connect(f); f.connect(eg); eg.connect(g); o1.start(); o2.start(); nodes.push(o1, o2);
    eng = { o1, o2, f, g: eg };
  }
  const beds = { roll: new Bed('roll', wheels.in, { seg: [2, 4], xf: 0.9 }), flange: new Bed('flange', wheels.in, { seg: [1.2, 2.6], xf: 0.5, vary: 0.05 }) };
  const dz = diesel ? (SND_DZ || []).map((r, i) => ({ rpm: r.rpm, bed: new Bed('dz', g, { i, seg: [1.6, 3.2], xf: 0.6 }) })) : [];
  return {
    g, em, wheels, roar, eng, beds, dz, whistle: null,
    kill() { em.kill(); wheels.kill(); for (const b of Object.values(beds)) b.kill(); for (const d of dz) d.bed.kill(); if (this.whistle) this.whistle.kill(); nodes.forEach(n => { try { n.stop(); } catch (e) {} }); },
  };
}
function remoteSound(R, dt, st, d, cam) {
  const T = R.train, L = T.loco, B = R.bus, now = AU.ctx.currentTime, v = Math.abs(R.v);
  const src = T.diesel ? T.unitWorld(T.units[0], T.units[0].enginePos, R.wp) : T.worldOf(L.stackPos, R.wp);
  B.em.place(d > 1500 ? T.lead.pos : src);
  let near = T.lead, nd = 1e9;
  for (const x of T.vehicles) { const dx = x.pos.distanceTo(cam); if (dx < nd) { nd = dx; near = x; } }
  B.wheels.place(near.pos);
  duo(B.beds.roll, B.roar, 0.3 * Math.min(1, v / 22), Math.min(1, v / 18) ** 1.2, clamp(0.55 + v / 30, 0.6, 1.6), 0.2);
  const lp0 = T.lead.leadPt && T.lead.leadPt.tp, kk = lp0 ? Math.abs(lp0.e.curv(lp0.s)) : 0;
  B.beds.flange.set(kk > 1 / 320 && v > 1.5 ? 0.5 * Math.min(1, v / 8) * (SND_GAIN.flange || 1) : 0, clamp(0.85 + v / 60, 0.85, 1.25), 0.25);
  for (const b of Object.values(B.beds)) b.tick();
  const rpm = Math.max(300, st.rpm || 0), rf = clamp((rpm - 300) / 750, 0, 1), units = 1 + 0.28 * ((st.u || 1) - 1);
  if (B.dz.length && B.dz[0].bed.ok) {
    if (B.eng) setG(B.eng.g, 0);
    let lo = 0; while (lo < B.dz.length - 2 && rpm > B.dz[lo + 1].rpm) lo++;
    const hi = Math.min(B.dz.length - 1, lo + 1), w = hi === lo ? 0 : clamp((rpm - B.dz[lo].rpm) / (B.dz[hi].rpm - B.dz[lo].rpm), 0, 1);
    const lvl = st.rpm > 20 ? (0.55 + 0.45 * (st.ex || 0)) * units * (SND_GAIN.dz || 1) : 0;
    B.dz.forEach((x, i) => { x.bed.set(lvl * (i === lo ? Math.cos(w * Math.PI / 2) : i === hi ? Math.sin(w * Math.PI / 2) : 0), dzRate(B.dz, x, rpm), 0.15); x.bed.tick(); });
  } else if (B.eng) {
    const E = B.eng, fire = rpm / 60 * 6;
    E.o1.frequency.setTargetAtTime(fire, now, 0.1); E.o2.frequency.setTargetAtTime(fire / 2, now, 0.1); E.f.frequency.setTargetAtTime(260 + 700 * rf + 400 * rf * st.ex, now, 0.1);
    setG(E.g, st.rpm > 20 ? (0.2 + 0.3 * rf) * units : 0, 0.15);
  }
  if (st.bl) { R.bellT += dt; if (R.bellT > (T.diesel ? 1.05 : 0.86)) { R.bellT = 0; if (d < 1200) sndBell(T.diesel, B.g); } } else R.bellT = 0.8;
  // whistle or horn: recorded through the emitter (which gives the Doppler), or the synthesized voices
  const key = LOCO_SPEC[st.lk].whistle, k = 'wh_' + key;
  if (SND.has(k)) {
    if (!B.whistle && st.wh > 0.02) B.whistle = new Loop(k, B.g);
    if (B.whistle) {
      const Rw = WHISTLE_REC[key];
      if (st.wh > 0.05 && !(B.whPull > 0.05)) SND.shot(k + '_on', B.g, { gain: (SND_GAIN[k] || 1) * Math.pow(st.wh, 0.6), vary: 0.01, dur: Rw.on });
      B.whistle.set((SND_GAIN[k] || 1) * Math.pow(st.wh, T.diesel ? 0.5 : 0.8), 1 - Rw.quill * (1 - st.wh), st.wh > (B.whPull || 0) ? Rw.attack : Rw.release);
      B.whistle.tick(); B.whPull = st.wh;
    }
    return;
  }
  if (st.wh > 0.02 && !R.wh) R.wh = makeWhistle(WHISTLES[key]);
  if (R.wh) {
    const W = R.wh, ws = T.worldOf(T.diesel ? L.hornPos : L.whistlePos, R.wp);
    const toCam = _snA.subVectors(cam, ws), dist = toCam.length(); toCam.normalize();
    const riding = CAM.riding() && !MP.watching && GAME.train;
    const vl = riding ? _snB.copy(GAME.train.lead.fwd).multiplyScalar(S.v).dot(toCam) : 0;
    const dop = C_AIR / (C_AIR - clamp(R.tv.dot(toCam) - vl, -60, 60));
    setG(W.out, (1 / (1 + Math.pow(dist / 90, 1.1))) * Math.pow(st.wh, T.diesel ? 0.5 : 0.8) * 0.95, W.attack);
    const bend = 1 - W.quill * (1 - st.wh);
    for (const vc of W.voices) { const f = vc.f * bend * dop; vc.o1.frequency.setTargetAtTime(f, now, 0.04); vc.o2.frequency.setTargetAtTime(f * vc.ratio2, now, 0.04); }
    W.lp.frequency.setTargetAtTime(clamp(11000 / (1 + dist / 160), 1800, 7000), now, 0.1);
  }
}

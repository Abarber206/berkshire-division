/* ============================================================================
   Sound: the audio graph, and synthesized voices that stand in for the
   recordings of 09b_sound.js when those can't be loaded
   ========================================================================== */
const AU = { ctx: null, on: false };
/* The mixer. Each slider (0-150 %, 100 by default) scales one bus: VOL_TRIM is where that bus sits
   at 100 %, so the default mix leaves the whistle or horn well clear of the engine working, and the
   compressor only catches the loudest peaks. The slider follows a square law, so it feels even. */
const VOL_KEYS = ['master', 'whistle', 'engine', 'effects', 'ambience'];
const VOL_TRIM = { master: 0.62, whistle: 1.55, engine: 0.55, effects: 0.6, ambience: 0.6 };
const VOL = { master: 100, whistle: 100, engine: 100, effects: 100, ambience: 100 };
try { const o = JSON.parse(localStorage.getItem('bd_vol') || 'null'); if (o) for (const k of VOL_KEYS) if (Number.isFinite(o[k])) VOL[k] = Math.max(0, Math.min(150, o[k])); } catch (e) {}
function volGain(k) { return VOL_TRIM[k] * Math.pow(VOL[k] / 100, 2); }
/* set one slider (or none, to re-apply them all) */
function setVolume(k, v) {
  if (k) { VOL[k] = Math.max(0, Math.min(150, Math.round(v))); try { localStorage.setItem('bd_vol', JSON.stringify(VOL)); } catch (e) {} }
  if (!AU.ctx) return;
  const now = AU.ctx.currentTime, put = (n, g) => { if (n) n.gain.setTargetAtTime(g, now, 0.05); };
  put(AU.master, volGain('master')); put(AU.loco, volGain('engine')); put(AU.world, volGain('effects'));
  put(AU.amb, volGain('ambience')); put(AU.whistleBus, volGain('whistle')); if (typeof SND !== 'undefined') put(SND.whBus, volGain('whistle'));
}
function audioInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  const ctx = new AC(); AU.ctx = ctx;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -8; comp.ratio.value = 6; comp.knee.value = 6; comp.attack.value = 0.004; comp.release.value = 0.25; comp.connect(ctx.destination);
  AU.master = ctx.createGain(); AU.master.gain.value = volGain('master'); AU.master.connect(comp);
  // reverb (open-country echo)
  const len = ctx.sampleRate * 3.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) { const t = i / ctx.sampleRate; d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 1.6) * (t < 0.08 ? t / 0.08 : 1) * (1 + 0.25 * Math.exp(-((t - 0.9) ** 2) * 40)); } }
  AU.verb = ctx.createConvolver(); AU.verb.buffer = ir; AU.verbIn = ctx.createGain(); AU.verbIn.gain.value = 0.5; AU.verbIn.connect(AU.verb); AU.verb.connect(AU.master);
  // noise
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < nd.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527; nd[i] = (b0 + b1 + b2 + w * 0.1848) * 0.16; }
  AU.noise = nb;
  const wb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), wd = wb.getChannelData(0); for (let i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1; AU.white = wb;
  // buses: locomotive (distance filtered), world
  AU.loco = ctx.createGain(); AU.loco.gain.value = volGain('engine'); AU.locoLP = ctx.createBiquadFilter(); AU.locoLP.type = 'lowpass'; AU.locoLP.frequency.value = 16000;
  AU.loco.connect(AU.locoLP); AU.locoLP.connect(AU.master);
  AU.locoSend = ctx.createGain(); AU.locoSend.gain.value = 0.18; AU.locoLP.connect(AU.locoSend); AU.locoSend.connect(AU.verbIn);
  AU.world = ctx.createGain(); AU.world.gain.value = volGain('effects'); AU.world.connect(AU.master);
  // the countryside, and every whistle and horn (the player's goes through SND.whBus instead)
  AU.amb = ctx.createGain(); AU.amb.gain.value = volGain('ambience'); AU.amb.connect(AU.master);
  AU.whistleBus = ctx.createGain(); AU.whistleBus.gain.value = volGain('whistle'); AU.whistleBus.connect(AU.master);
  // continuous layers
  const loop = (buf, type, f, q, dest) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = Math.random(); const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(dest); s.start(0, Math.random()); return { g, fl }; };
  AU.blower = loop(AU.noise, 'bandpass', 520, 0.8, AU.loco);
  AU.safety = loop(AU.white, 'highpass', 1700, 0.6, AU.loco);
  AU.injector = loop(AU.white, 'bandpass', 3100, 1.3, AU.loco);
  AU.cocks = loop(AU.white, 'highpass', 1200, 0.7, AU.loco);
  AU.roar = loop(AU.noise, 'lowpass', 260, 0.7, AU.loco);
  AU.drift = loop(AU.noise, 'bandpass', 380, 1.5, AU.loco);
  AU.wind = loop(AU.noise, 'lowpass', 420, 0.5, AU.amb);
  AU.bpExhaust = loop(AU.white, 'bandpass', 1500, 1.1, AU.loco);
  AU.firedoor = loop(AU.noise, 'lowpass', 160, 0.6, AU.loco);
  // flange & brake squeal
  const sq = (f) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; const lfo = ctx.createOscillator(); lfo.frequency.value = 6.5; const lg = ctx.createGain(); lg.gain.value = f * 0.012; lfo.connect(lg); lg.connect(o.frequency); const g = ctx.createGain(); g.gain.value = 0; o.connect(g); g.connect(AU.world); o.start(); lfo.start(); return { g, o }; };
  AU.flange = sq(3900); AU.bsq = sq(2350);
  // whistle voices
  AU.whistle = null;
  AU.dz = null;
  buildDieselAudio();
  AU.lastJ = new Map();
  AU.on = true;
  SND.init();
}
/* Whistles and horns. Each locomotive gets its own chord and its own tone colour:
   - a deep, mellow six-chime (minor voicing) with a long quill,
   - a bigger, higher six-chime (E, F#, A, B, D#, G#, the Pere Marquette's), brighter on top,
   - a brassy five-chime air horn (B major 6th: D#, F#, G#, B, D#) with chorus and a hard attack.
   Partials are built with PeriodicWave so the tone is set per voice, and a presence lift
   keeps every one of them audible on a phone speaker. */
const WHISTLES = {
  deep6: { kind: 'steam', notes: [164.8, 196.0, 220.0, 246.9, 293.7, 329.6], harm: [1, 0.56, 0.36, 0.24, 0.15, 0.09, 0.05], breath: 0.13, breathF: 1400, vib: [4.8, 0.0025], quill: 0.06, attack: 0.06, beat: 1.0018, pres: 2200 },
  // the 765: no recording of its own exists, so it blows the Big Boy's take a little lower (see WHISTLE_REC.nkp6)
  nkp6: { kind: 'steam', notes: [153.3, 182.3, 204.6, 229.6, 273.1, 306.5], harm: [1, 0.56, 0.36, 0.24, 0.15, 0.09, 0.05], breath: 0.13, breathF: 1400, vib: [4.8, 0.0025], quill: 0.06, attack: 0.06, beat: 1.0018, pres: 2200 },
  chime6: { kind: 'steam', notes: [335.0, 375.4, 444.6, 505.4, 632.3, 825.8], harm: [1, 0.62, 0.38, 0.26, 0.16, 0.1, 0.06], breath: 0.14, breathF: 2200, vib: [5.4, 0.003], quill: 0.05, attack: 0.05, beat: 1.0025, pres: 2600 },
  /* Shinkansen air horn: a bright two-tone (A5 over F#5) with few upper partials */
  shin: { kind: 'horn', notes: [740.0, 880.0], harm: [1, 0.75, 0.5, 0.34, 0.22, 0.14, 0.08], breath: 0.025, breathF: 2400, vib: [0, 0], quill: 0, attack: 0.012, beat: 1.003, pres: 2400 },
  k5: { kind: 'horn', notes: [311.1, 370.0, 415.3, 493.9, 622.3], harm: [1, 0.92, 0.8, 0.7, 0.6, 0.52, 0.45, 0.38, 0.32, 0.27, 0.22, 0.18, 0.15, 0.12], breath: 0.035, breathF: 1300, vib: [0, 0], quill: 0, attack: 0.015, beat: 1.004, pres: 1500 },
};
function buildWhistle(def) {
  if (AU.whistle) AU.whistle.kill();
  AU.whistle = makeWhistle(def);
}
/* one whistle or horn voice set; other players' trains get their own */
function makeWhistle(def) {
  const ctx = AU.ctx;
  const horn = def.kind === 'horn';
  const out = ctx.createGain(); out.gain.value = 0;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 140; hp.Q.value = 0.7;
  const pres = ctx.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = def.pres; pres.Q.value = 0.8; pres.gain.value = horn ? 5 : 7;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000; lp.Q.value = 0.5;
  out.connect(hp); hp.connect(pres); pres.connect(lp); lp.connect(AU.whistleBus);
  const send = ctx.createGain(); send.gain.value = horn ? 0.6 : 0.85; lp.connect(send); send.connect(AU.verbIn);
  const real = new Float32Array(def.harm.length + 1), imag = new Float32Array(def.harm.length + 1);
  def.harm.forEach((h, i) => { imag[i + 1] = h; });
  const wave = ctx.createPeriodicWave(real, imag);
  const energy = Math.sqrt(def.harm.reduce((a, h) => a + h * h, 0));
  const vg = 0.95 / Math.sqrt(def.notes.length) / energy;
  const nodes = [];
  const voices = def.notes.map((f, i) => {
    const vmix = ctx.createGain(); vmix.gain.value = vg;
    const o1 = ctx.createOscillator(); o1.setPeriodicWave(wave); o1.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.setPeriodicWave(wave); o2.frequency.value = f * def.beat;
    const g1 = ctx.createGain(); g1.gain.value = horn ? 0.6 : 0.78; const g2 = ctx.createGain(); g2.gain.value = horn ? 0.45 : 0.22;
    o1.connect(g1); g1.connect(vmix); o2.connect(g2); g2.connect(vmix); vmix.connect(out);
    if (def.vib[0] > 0) { const l = ctx.createOscillator(); l.frequency.value = def.vib[0] * (0.92 + 0.16 * Math.random()); const lg = ctx.createGain(); lg.gain.value = f * def.vib[1]; l.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency); l.start(); nodes.push(l); }
    o1.start(); o2.start(); nodes.push(o1, o2);
    return { o1, o2, f, ratio2: def.beat };
  });
  const br = ctx.createBufferSource(); br.buffer = AU.white; br.loop = true;
  const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = def.breathF; bf.Q.value = 0.7;
  const bg = ctx.createGain(); bg.gain.value = def.breath;
  br.connect(bf); bf.connect(bg); bg.connect(out); br.start(0, Math.random()); nodes.push(br);
  const stop = () => nodes.forEach(n => { try { n.stop(); } catch (e) {} });
  return { out, voices, lp, kind: def.kind, quill: def.quill, attack: def.attack, stop, kill: () => { try { out.disconnect(); lp.disconnect(); stop(); } catch (e) {} } };
}
/* Diesel prime mover (V12 four-stroke), turbocharger, traction motors, dynamic brake blowers */
function buildDieselAudio() {
  const ctx = AU.ctx; if (AU.dz) return;
  const Z = {};
  Z.out = ctx.createGain(); Z.out.gain.value = 0; Z.out.connect(AU.loco);
  // firing pulses
  Z.lp = ctx.createBiquadFilter(); Z.lp.type = 'lowpass'; Z.lp.frequency.value = 400; Z.lp.Q.value = 1.1;
  Z.am = ctx.createGain(); Z.am.gain.value = 0.7; Z.lp.connect(Z.am); Z.am.connect(Z.out);
  Z.o1 = ctx.createOscillator(); Z.o1.type = 'sawtooth'; const g1 = ctx.createGain(); g1.gain.value = 0.55; Z.o1.connect(g1); g1.connect(Z.lp);
  Z.o2 = ctx.createOscillator(); Z.o2.type = 'square'; const g2 = ctx.createGain(); g2.gain.value = 0.3; Z.o2.connect(g2); g2.connect(Z.lp);
  // once-per-revolution lope
  Z.lfo = ctx.createOscillator(); Z.lfo.type = 'sine'; Z.lfoG = ctx.createGain(); Z.lfoG.gain.value = 0.28; Z.lfo.connect(Z.lfoG); Z.lfoG.connect(Z.am.gain);
  // exhaust roughness (carries on small speakers)
  const n = ctx.createBufferSource(); n.buffer = AU.noise; n.loop = true;
  Z.nf = ctx.createBiquadFilter(); Z.nf.type = 'bandpass'; Z.nf.Q.value = 1.4; Z.ng = ctx.createGain(); Z.ng.gain.value = 0.9;
  n.connect(Z.nf); Z.nf.connect(Z.ng); Z.ng.connect(Z.am);
  // turbo whine + air
  Z.tb = ctx.createOscillator(); Z.tb.type = 'sine'; Z.tbG = ctx.createGain(); Z.tbG.gain.value = 0; Z.tb.connect(Z.tbG); Z.tbG.connect(AU.loco);
  const tn = ctx.createBufferSource(); tn.buffer = AU.white; tn.loop = true; Z.tnF = ctx.createBiquadFilter(); Z.tnF.type = 'bandpass'; Z.tnF.Q.value = 0.8; Z.tnG = ctx.createGain(); Z.tnG.gain.value = 0;
  tn.connect(Z.tnF); Z.tnF.connect(Z.tnG); Z.tnG.connect(AU.loco);
  // AC traction inverter / motor whine
  Z.tm1 = ctx.createOscillator(); Z.tm1.type = 'triangle'; Z.tm2 = ctx.createOscillator(); Z.tm2.type = 'sine';
  Z.tmG = ctx.createGain(); Z.tmG.gain.value = 0; Z.tm1.connect(Z.tmG); Z.tm2.connect(Z.tmG); Z.tmG.connect(AU.loco);
  // dynamic brake grid blowers
  const db = ctx.createBufferSource(); db.buffer = AU.noise; db.loop = true; Z.dbF = ctx.createBiquadFilter(); Z.dbF.type = 'bandpass'; Z.dbF.Q.value = 0.6; Z.dbG = ctx.createGain(); Z.dbG.gain.value = 0;
  db.connect(Z.dbF); Z.dbF.connect(Z.dbG); Z.dbG.connect(AU.loco);
  for (const o of [Z.o1, Z.o2, Z.lfo, Z.tb, Z.tm1, Z.tm2]) o.start();
  n.start(0, Math.random()); tn.start(0, Math.random()); db.start(0, Math.random());
  AU.dz = Z;
}
function updateDieselAudio(on, inCab, units = 1) {
  const Z = AU.dz; if (!Z) return;
  const t = AU.ctx.currentTime, tc = 0.08;
  if (dieselRec(on, inCab, units)) on = false;
  if (!on) { Z.out.gain.setTargetAtTime(0, t, 0.05); Z.tbG.gain.setTargetAtTime(0, t, 0.05); Z.tnG.gain.setTargetAtTime(0, t, 0.05); Z.tmG.gain.setTargetAtTime(0, t, 0.05); Z.dbG.gain.setTargetAtTime(0, t, 0.05); return; }
  const rpm = Math.max(1, S.rpm), fire = rpm / 60 * 6, rf = clamp((rpm - 300) / 750, 0, 1);
  Z.o1.frequency.setTargetAtTime(fire, t, tc); Z.o2.frequency.setTargetAtTime(fire / 2, t, tc);
  Z.lfo.frequency.setTargetAtTime(rpm / 120, t, tc);
  Z.lp.frequency.setTargetAtTime(260 + 900 * S.load * rf + 520 * rf, t, tc);
  Z.nf.frequency.setTargetAtTime(fire * 5 + 320, t, tc);
  const running = S.rpm > 20;
  Z.out.gain.setTargetAtTime(running ? (0.3 + 0.35 * rf + 0.25 * S.load * rf) * (inCab ? 0.55 : 1) * (1 + 0.28 * (units - 1)) : 0, t, 0.12);
  Z.tb.frequency.setTargetAtTime(1300 + 4200 * S.turbo, t, 0.3);
  Z.tbG.gain.setTargetAtTime(0.012 + 0.07 * S.turbo * S.turbo, t, 0.3);
  Z.tnF.frequency.setTargetAtTime(700 + 1900 * S.turbo, t, 0.3); Z.tnG.gain.setTargetAtTime(0.25 * S.turbo * S.turbo, t, 0.3);
  const v = Math.abs(S.v), work = clamp((Math.abs(S.TE) + S.DBF) / 445e3, 0, 1.4);
  Z.tm1.frequency.setTargetAtTime(30 + v * 33, t, 0.1); Z.tm2.frequency.setTargetAtTime(45 + v * 50, t, 0.1);
  Z.tmG.gain.setTargetAtTime(0.06 * work * Math.min(1, v / 2) * (inCab ? 0.5 : 1), t, 0.15);
  Z.dbF.frequency.setTargetAtTime(380 + 900 * S.dbLoad, t, 0.3); Z.dbG.gain.setTargetAtTime(0.45 * S.dbLoad, t, 0.4);
}
function sndCrank() { if (!AU.on) return; if (SND.has('dz_start')) { const now = AU.ctx.currentTime; if (now > (SND.crankEnd || 0)) { const p = SND.shot('dz_start', AU.loco, { gain: SND_GAIN.dz_start || 1, vary: 0.02 }); if (p) SND.crankEnd = now + p.s.buffer.duration; } return; } const t = AU.ctx.currentTime + 0.005; envNoise(t, 0.22, 140, 1.2, 0.5, AU.loco, 'lowpass', AU.noise, 0.02); envTone(t, 0.25, 70 + Math.random() * 10, 0.22, AU.loco, 'sawtooth', 55); }
function envNoise(t, dur, f, q, gain, dest, type = 'bandpass', buf = AU.noise, att = 0.006) {
  const ctx = AU.ctx; const s = ctx.createBufferSource(); s.buffer = buf; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  return fl;
}
function envTone(t, dur, f, gain, dest, type = 'sine', f2) {
  const ctx = AU.ctx; const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
}
/* one exhaust beat */
function sndChuff(k, n, intensity, dest = AU.loco, cocks = S.cocks) {
  if (!AU.on) return;
  if (SND.has('chuff')) return chuffRec(k, n, intensity, dest, cocks);
  const t = AU.ctx.currentTime + 0.005;
  const dur = clamp(0.38 / (1 + n * 0.85), 0.055, 0.34);
  const limp = (k % 4 === 1 || k % 4 === 3) ? 0.82 : 1;
  const g = intensity * limp;
  const fl = envNoise(t, dur, 340 + 90 * (k % 2) + n * 40, 0.9, 0.95 * g, dest, 'bandpass', AU.noise, 0.004 + 0.01 / (1 + n));
  fl.frequency.exponentialRampToValueAtTime(160, t + dur);
  envNoise(t, dur * 0.7, 1800, 0.7, 0.18 * g, dest, 'bandpass', AU.white, 0.003);
  envTone(t, Math.min(0.12, dur), 62, 0.55 * g, dest, 'sine', 38);
  if (cocks) envNoise(t, Math.min(0.5, dur * 1.8), 2600, 0.6, 0.35 * Math.min(1, intensity + 0.3), dest, 'highpass', AU.white, 0.01);
}
function sndClank(n) {
  if (!AU.on) return; if (SND.has('clank')) { SND.shot('clank', AU.loco, { gain: (SND_GAIN.clank || 1) * clamp(n / 3, 0.3, 1) }); return; } const t = AU.ctx.currentTime + 0.003;
  envNoise(t, 0.05, 1100, 6, 0.18, AU.loco, 'bandpass', AU.white, 0.002);
  envTone(t, 0.06, 310 + Math.random() * 30, 0.08, AU.loco, 'triangle');
}
function sndJoint(gain, delay = 0, pos = null, v = 10) {
  if (!AU.on || gain < 0.01) return;
  if (SND.has('joint')) return jointRec(gain, delay, pos, v);
  const t = AU.ctx.currentTime + 0.005 + delay;
  envNoise(t, 0.035, 2300, 1.3, 0.5 * gain, AU.world, 'bandpass', AU.white, 0.0015);
  envTone(t, 0.07, 140, 0.45 * gain, AU.world, 'sine', 70);
}
function sndPump(phase) {
  if (!AU.on) return; const k = phase % 2 ? 'pump_a' : 'pump_b'; if (SND.has(k)) { SND.shot(k, AU.loco, { gain: SND_GAIN.pump || 1, vary: 0.03 }); return; } const t = AU.ctx.currentTime + 0.005;
  if (phase % 2) envNoise(t, 0.22, 800, 1.2, 0.22, AU.loco, 'bandpass', AU.noise, 0.02);
  else { envNoise(t, 0.16, 300, 1, 0.3, AU.loco, 'lowpass', AU.noise, 0.01); envTone(t, 0.1, 90, 0.12, AU.loco); }
}
function sndBell(diesel, dest = AU.loco) {
  if (!AU.on) return;
  // the steam engine's big cast bell rings lower than the diesel's
  if (SND.has('bell')) { SND.shot('bell', dest, { gain: SND_GAIN.bell || 1, rate: diesel ? 0.7 : 0.56, vary: 0.01 }); return; } const t = AU.ctx.currentTime + 0.005;
  const f = diesel ? 640 : 435;
  for (const [r, g, d] of [[1, 0.5, 2.6], [2.02, 0.28, 1.8], [2.74, 0.22, 1.3], [3.95, 0.14, 0.9], [5.41, 0.08, 0.6], [0.5, 0.18, 2.0]]) envTone(t, d, f * r, g * 0.55, dest, 'sine');
  envNoise(t, 0.03, 4000, 2, 0.15, dest, 'bandpass', AU.white, 0.001);
}
function sndClunk(gain, delay) { if (!AU.on || gain < 0.01) return; if (SND.has('clunk')) { SND.shot('clunk', AU.world, { gain: gain * (SND_GAIN.clunk || 1), delay }); return; } const t = AU.ctx.currentTime + 0.01 + delay; envNoise(t, 0.16, 650, 3, 0.6 * gain, AU.world, 'bandpass', AU.noise, 0.003); envTone(t, 0.12, 75, 0.5 * gain, AU.world, 'sine', 45); }
/* knuckles closing: a sharp crack, then the slack running in */
function sndCouple(gain) { if (!AU.on || gain < 0.01) return; if (SND.has('couple')) { SND.shot('couple', AU.world, { gain: gain * (SND_GAIN.couple || 1) }); return; } const t = AU.ctx.currentTime + 0.01; envNoise(t, 0.08, 2100, 7, 0.45 * gain, AU.world, 'bandpass', AU.white, 0.001); envNoise(t, 0.3, 560, 3, 0.75 * gain, AU.world, 'bandpass', AU.noise, 0.002); envTone(t, 0.2, 68, 0.6 * gain, AU.world, 'sine', 40); envNoise(t + 0.16, 0.2, 700, 3, 0.3 * gain, AU.world, 'bandpass', AU.noise, 0.003); }
/* cut lever lifting the pin; with dump, the hoses part and the brake pipe vents */
function sndPin(gain, dump) {
  if (!AU.on || gain < 0.01) return;
  const t = AU.ctx.currentTime + 0.01;
  if (SND.has('pin')) SND.shot('pin', AU.world, { gain: gain * (SND_GAIN.pin || 1) });
  else { envNoise(t, 0.1, 1600, 6, 0.3 * gain, AU.world, 'bandpass', AU.white, 0.002); envNoise(t + 0.14, 0.08, 2400, 8, 0.2 * gain, AU.world, 'bandpass', AU.white, 0.002); }
  if (!dump) return;
  if (SND.has('dump')) SND.shot('dump', AU.world, { gain: gain * (SND_GAIN.dump || 1), delay: 0.3 });
  else envNoise(t + 0.3, 1.6, 3200, 0.8, 0.35 * gain, AU.world, 'bandpass', AU.white, 0.02);
}
function sndThrow() { if (!AU.on) return; if (SND.has('switch')) { SND.shot('switch', AU.world, { gain: SND_GAIN.switch || 1 }); return; } const t = AU.ctx.currentTime + 0.01; envNoise(t, 0.18, 900, 4, 0.25, AU.world, 'bandpass', AU.white, 0.003); envNoise(t + 0.25, 0.12, 1400, 5, 0.2, AU.world, 'bandpass', AU.white, 0.002); }
function sndChirp(night) {
  if (!AU.on) return; const t = AU.ctx.currentTime + 0.01;
  if (night) { for (let i = 0; i < 4; i++) envTone(t + i * 0.05, 0.03, 4600, 0.012, AU.amb); }
  else { const f = 2800 + Math.random() * 1600; envTone(t, 0.09, f, 0.02, AU.amb, 'sine', f * 1.3); envTone(t + 0.12, 0.07, f * 1.1, 0.015, AU.amb, 'sine', f * 0.9); }
}
function setG(node, v, tc = 0.06) { if (AU.on) node.gain.setTargetAtTime(v, AU.ctx.currentTime, tc); }

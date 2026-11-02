/* Whistle and horn checks: every engine's whistle has a recording (attack and sustain loop) and a
   synthesized fallback, and no two steam engines share one. Run with: node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const h = require('./harness');

const ROOT = path.join(__dirname, '..');
const bank = vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src', '09a_soundbank.js'), 'utf8') + ';({ SND_FILES, WHISTLE_REC })');
const audio = fs.readFileSync(path.join(ROOT, 'src', '09_audio.js'), 'utf8');
const synth = audio.slice(audio.indexOf('const WHISTLES = {'), audio.indexOf('};', audio.indexOf('const WHISTLES = {')));
const { LOCO_SPEC } = h.load();

test('every engine whistle has a recording, its shaping and a synthesized fallback', () => {
  for (const [lk, spec] of Object.entries(LOCO_SPEC)) {
    const key = spec.whistle;
    assert.ok(new RegExp(`\\b${key}: \\{ kind:`).test(synth), `${lk}: no synthesized whistle '${key}'`);
    if (!bank.SND_FILES['wh_' + key]) continue;   // synthesized only (the Shinkansen horn)
    assert.ok(bank.WHISTLE_REC[key], `${lk}: no WHISTLE_REC for '${key}'`);
    for (const k of ['wh_' + key, 'wh_' + key + '_on']) {
      assert.ok(bank.SND_FILES[k] && bank.SND_FILES[k].length, `${lk}: no takes for ${k}`);
      for (const f of bank.SND_FILES[k]) assert.ok(fs.existsSync(path.join(ROOT, 'audio', f)), `${lk}: audio/${f} missing`);
    }
  }
});

test('each steam engine blows its own whistle', () => {
  const steam = Object.entries(LOCO_SPEC).filter(([, s]) => !s.diesel && s.fw);
  assert.ok(steam.length >= 2);
  const keys = steam.map(([, s]) => s.whistle);
  assert.equal(new Set(keys).size, keys.length, `steam engines share a whistle: ${keys.join(', ')}`);
  assert.notEqual(LOCO_SPEC['1225'].whistle, LOCO_SPEC['765'].whistle);
});

// a 16-bit mono WAV's samples, as -1..1
function wavSamples(f) {
  const b = fs.readFileSync(f); let o = 12;
  while (b.toString('ascii', o, o + 4) !== 'data') o += 8 + b.readUInt32LE(o + 4);
  const n = b.readUInt32LE(o + 4) / 2, s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = b.readInt16LE(o + 8 + 2 * i) / 32768;
  return s;
}

test('whistle and horn sustain loops are long enough not to be heard repeating, and wrap without a click', () => {
  for (const [k, files] of Object.entries(bank.SND_FILES)) {
    if (!/^wh_[a-z0-9]+$/.test(k)) continue;
    for (const f of files) {
      const s = wavSamples(path.join(ROOT, 'audio', f)), sec = s.length / 44100;
      assert.ok(sec >= 1.9, `${f}: a ${sec.toFixed(2)} s loop repeats audibly`);
      const steps = Array.from(s.subarray(1), (v, i) => Math.abs(v - s[i])).sort((a, b) => a - b);
      const p99 = steps[Math.floor(steps.length * 0.99)];
      assert.ok(Math.abs(s[0] - s[s.length - 1]) <= p99, `${f}: the wrap from end to start jumps (a click)`);
    }
  }
});

// the valve logic from 09b_sound.js, run against a fake clock and a fake opening take
function valveSandbox() {
  const src = fs.readFileSync(path.join(ROOT, 'src', '09b_sound.js'), 'utf8');
  const from = src.indexOf('const TOOT_MIN'), to = src.indexOf('/* whistle or horn. Recorded');
  const log = [];
  const gain = () => ({ value: 1, cancelScheduledValues() {}, setValueAtTime() {}, setTargetAtTime(v, t, tc) { log.push(['fade', t, tc]); } });
  const ctx = { SND_GAIN: {}, log, clamp: (v, a, b) => Math.max(a, Math.min(b, v)), SND: { shot: (k, d, o) => { log.push(['shot', k, o.dur]); return { g: { gain: gain() }, s: { stop: t => log.push(['stop', t]) } }; } } };
  vm.runInNewContext(src.slice(from, to) + ';this.whistleValve = whistleValve; this.whistleOnset = whistleOnset; this.whistleTc = whistleTc; this.whistleBlend = whistleBlend; this.WH_LEAD = WH_LEAD; this.TOOT_MIN = TOOT_MIN;', ctx);
  return ctx;
}
// drive one cord pull of `hold` seconds at 60 fps; returns when the whistle went quiet and the log
function blow(hold) {
  const c = valveSandbox(), o = { whPull: 0 }, R = { release: 0.12, on: 1.2 };
  let shut = null;
  for (let f = 0; f < 180; f++) {
    const now = f / 60, cord = now < hold ? 0.7 : 0;
    const p = c.whistleValve(o, cord, now); c.whistleOnset(o, 'wh_x', R, p, null, now); o.whPull = p;
    if (shut === null && f > 0 && p <= 0.05) shut = now;
  }
  return { shut, log: c.log, TOOT_MIN: c.TOOT_MIN };
}

test('a tap on the whistle is a short toot, not the whole opening take', () => {
  const r = blow(1 / 60);
  assert.ok(r.shut >= r.TOOT_MIN && r.shut < r.TOOT_MIN + 0.05, `tap sounded for ${r.shut} s`);
  assert.equal(r.log.filter(e => e[0] === 'shot').length, 1);
  const stop = r.log.find(e => e[0] === 'stop');
  assert.ok(stop && stop[1] < 1.2, 'the opening take was not cut off when the valve closed');
});

test('holding the cord blows for as long as it is held', () => {
  for (const hold of [0.5, 1.0, 2.0]) {
    const r = blow(hold);
    assert.ok(Math.abs(r.shut - hold) < 0.03, `held ${hold} s, sounded ${r.shut} s`);
  }
});

// a 1-channel MP3/WAV take's level, in dB, over 50 ms windows (decoded with ffmpeg)
function takeLevels(f) {
  const { execFileSync } = require('child_process');
  const raw = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', path.join(ROOT, 'audio', f), '-f', 'f32le', '-ac', '1', '-ar', '44100', '-']);
  const x = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4), n = 2205, out = [];
  for (let i = 0; i + n <= x.length; i += n) { let e = 0; for (let j = i; j < i + n; j++) e += x[j] * x[j]; out.push(10 * Math.log10(e / n + 1e-12)); }
  return out;
}

test('the Pere Marquette whistle closes with its recorded release, starting at the sustain level and dying away', t => {
  try { require('child_process').execFileSync('ffmpeg', ['-version']); } catch (e) { t.skip('no ffmpeg'); return; }
  assert.ok(bank.SND_FILES.wh_chime6_off && bank.WHISTLE_REC.chime6.xf > 0);
  const loop = takeLevels(bank.SND_FILES.wh_chime6[0]), off = takeLevels(bank.SND_FILES.wh_chime6_off[0]);
  const sustain = loop.reduce((a, b) => a + b) / loop.length;
  assert.ok(Math.abs(off[0] - sustain) < 3, `release starts at ${off[0].toFixed(1)} dB, the loop sustains at ${sustain.toFixed(1)} dB`);
  assert.ok(off[off.length - 1] < off[0] - 25, 'the release does not die away');
  assert.ok(off.length * 0.05 > 0.6 && off.length * 0.05 < 2, 'the release should be under 2 s');
});

test('when the cord drops, a recorded release takes over and the loop under it fades fast', () => {
  const c = valveSandbox();
  c.SND.has = k => k === 'wh_x_off';
  const o = { whPull: 0 }, R = { quill: 0.05, attack: 0.05, release: 0.12, on: 1.2, xf: 0.03 };
  let tcShut = null;
  for (let f = 0; f < 90; f++) {
    const now = f / 60, p = c.whistleValve(o, now < 1 ? 0.8 : 0, now);
    c.whistleOnset(o, 'wh_x', R, p, null, now, 0.7);
    if (now >= 1 && tcShut === null) tcShut = c.whistleTc(o, R, false);
    o.whPull = p;
  }
  const shots = c.log.filter(e => e[0] === 'shot').map(e => e[1]);
  assert.deepEqual(shots, ['wh_x_on', 'wh_x_off']);
  assert.equal(tcShut, R.xf);
  // reopening goes back to the normal valve
  const p = c.whistleValve(o, 0.8, 2); c.whistleOnset(o, 'wh_x', R, p, null, 2); assert.equal(c.whistleTc(o, R, false), R.release);
});

test('the sustain loop waits under the opening take and takes over as it fades, so the chord never sounds twice', () => {
  const c = valveSandbox(), o = {}, R = { on: 1.2, attack: 0.05, release: 0.12 };
  let p = c.whistleValve(o, 0.8, 0); c.whistleOnset(o, 'wh_x', R, p, null, 0); o.whPull = p;
  // the take is played at full level until 62% of its length, then fades linearly to nothing (SND.shot)
  const take = t => t < 0.62 * R.on ? 1 : Math.max(0, 1 - (t - 0.62 * R.on) / (0.38 * R.on));
  for (let t = 0; t <= 2; t += 0.05) {
    // the loop is asked for WH_LEAD early to make up its lag, so it is heard as it was asked for then
    const loop = c.whistleBlend(o, t - c.WH_LEAD), sum = Math.hypot(take(t), loop);   // two takes of one chord, not in phase: power adds
    if (t < 0.62 * R.on) assert.equal(loop, 0, `the loop sounds over the opening take at ${t.toFixed(2)} s`);
    assert.ok(sum > 0.95 && sum < 1.05, `at ${t.toFixed(2)} s the whistle swells or dips (${sum.toFixed(2)})`);
  }
  assert.equal(c.whistleBlend(o, 2), 1, 'the loop carries the whistle once the take is done');
  // let go early: the take is cut, and the loop (fading with the valve) is no longer held back
  p = c.whistleValve(o, 0, 3); c.whistleOnset(o, 'wh_x', R, p, null, 3);
  assert.equal(c.whistleBlend(o, 3), 1);
});

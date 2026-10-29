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

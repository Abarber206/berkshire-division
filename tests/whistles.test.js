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

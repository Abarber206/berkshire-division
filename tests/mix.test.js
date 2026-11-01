/* Sound mix: the whistle or horn stands clear of the engine at the default mix, the volume sliders
   load safely from storage, and every voice goes through a mixer bus rather than straight to the
   master. Run with: node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const audio = fs.readFileSync(path.join(SRC, '09_audio.js'), 'utf8');
const sound = fs.readFileSync(path.join(SRC, '09b_sound.js'), 'utf8');
const mixer = audio.slice(audio.indexOf('const VOL_KEYS'), audio.indexOf('/* set one slider'));
const load = stored => vm.runInNewContext(mixer + ';({ VOL, VOL_TRIM, volGain })', { localStorage: { getItem: () => stored }, Math, Number, JSON });
const dB = g => 20 * Math.log10(g);

test('the default mix puts the whistle well above the engine and the countryside', () => {
  const { volGain } = load(null);
  assert.ok(dB(volGain('whistle') / volGain('engine')) >= 8, 'whistle should sit at least 8 dB over the engine');
  assert.ok(dB(volGain('whistle') / volGain('effects')) >= 8);
  assert.ok(dB(volGain('whistle') / volGain('ambience')) >= 8);
  // overall quieter than the old master (0.9) so the compressor is not pumping all the time
  assert.ok(volGain('master') <= 0.7);
});

test('volume sliders load from storage and are clamped', () => {
  const { VOL, volGain } = load(JSON.stringify({ master: 40, whistle: 900, engine: -5, effects: 'loud' }));
  assert.equal(VOL.master, 40); assert.equal(VOL.whistle, 150); assert.equal(VOL.engine, 0); assert.equal(VOL.effects, 100);
  assert.equal(volGain('engine'), 0);
  const bad = load('{not json');
  assert.equal(bad.VOL.master, 100);
});

test('every voice reaches the master through a mixer bus', () => {
  // only the buses themselves, the reverb return and the echo taps (fed from the whistle bus) may feed AU.master
  const direct = [...(audio + sound).matchAll(/(\w[\w.]*)\.connect\(AU\.master\)/g)].map(m => m[1]);
  for (const n of direct) assert.ok(['AU.master', 'AU.locoLP', 'AU.verb', 'AU.world', 'AU.amb', 'AU.whistleBus', 'p', 'gn', 'this.pan', 'this.g'].includes(n), `${n} bypasses the mixer`);
  assert.match(sound, /SND\.whBus\.connect\(SND\.loco\.in\)/, "the player's whistle should skip the engine bus");
  assert.doesNotMatch(sound, /AU\.loco\.gain\.setTargetAtTime\(1/, 'nothing should reset the engine bus to full every frame');
  assert.match(sound, /new Loop\(k, B\.wg\)/, "other trains' whistles go through their whistle bus");
  assert.match(sound, /SND\.train = new Emitter\(\{[^}]*bus: 'effects'/);
});

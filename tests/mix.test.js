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
  // only the buses themselves, the reverb return, the echo taps (fed from the whistle bus) and the tunnel room's
  // return (fed from emitters after their level and from the effects bus) may feed AU.master
  const direct = [...(audio + sound).matchAll(/(\w[\w.]*)\.connect\(AU\.master\)/g)].map(m => m[1]);
  for (const n of direct) assert.ok(['AU.master', 'AU.locoLP', 'AU.verb', 'AU.world', 'AU.amb', 'AU.whistleBus', 'p', 'gn', 'this.pan', 'this.g', 'ret'].includes(n), `${n} bypasses the mixer`);
  assert.match(sound, /SND\.whBus\.connect\(SND\.loco\.in\)/, "the player's whistle should skip the engine bus");
  assert.doesNotMatch(sound, /AU\.loco\.gain\.setTargetAtTime\(1/, 'nothing should reset the engine bus to full every frame');
  assert.match(sound, /new Loop\(k, B\.wg\)/, "other trains' whistles go through their whistle bus");
  assert.match(sound, /SND\.train = new Emitter\(\{[^}]*bus: 'effects'/);
});

test('the hill echo is a wash, never a repeat of the whistle', () => {
  const echo = sound.slice(sound.indexOf('const ECHO_MIN'), sound.indexOf('function makeEcho'));
  const { ECHO, ECHO_MIN } = vm.runInNewContext(echo + ';({ ECHO, ECHO_MIN })');
  assert.ok(ECHO_MIN >= 0.8);
  assert.ok(ECHO.taps.length >= 12, 'enough reflections to blur into a wash');
  for (let i = 0; i < ECHO.taps.length; i++) {
    const [t, g] = ECHO.taps[i];
    assert.ok(t >= ECHO_MIN, `an echo at ${t} s lands on the tail of a short toot`);
    // no single reflection loud enough to be heard as the whistle blowing again
    assert.ok(ECHO.send * g <= 0.02, `an echo at ${t} s stands out (${ECHO.send * g})`);
    if (i) {
      const [t0, g0] = ECHO.taps[i - 1];
      assert.ok(t - t0 < 0.15, `a ${(t - t0).toFixed(2)} s gap between reflections at ${t} s is heard as a separate repeat`);
      assert.ok(g <= g0, 'each reflection no louder than the one before');
    }
  }
});

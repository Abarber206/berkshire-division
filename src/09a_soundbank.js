/* ============================================================================
   The recordings in audio/, by voice. Sources and licences: audio/CREDITS.md.
   SND_GAIN trims each voice to sit in the mix; SND_DZ gives the engine speed
   of each prime-mover take; WHISTLE_REC shapes how each whistle opens.
   ========================================================================== */
const SND_FILES = {
  dz: ['dz_0.mp3'],
  chuff: ['chuff_0.mp3', 'chuff_1.mp3', 'chuff_2.mp3', 'chuff_3.mp3', 'chuff_4.mp3', 'chuff_5.mp3', 'chuff_6.mp3', 'chuff_7.mp3'],
  wh_deep6: ['wh_deep6_0.wav'],
  wh_deep6_on: ['wh_deep6_on_0.mp3'],
  safety: ['safety_0.mp3'],
  blower: ['blower_0.mp3'],
  pump_a: ['pump_a_0.mp3', 'pump_a_1.mp3', 'pump_a_2.mp3', 'pump_a_3.mp3', 'pump_a_4.mp3', 'pump_a_5.mp3', 'pump_a_6.mp3', 'pump_a_7.mp3', 'pump_a_8.mp3', 'pump_a_9.mp3'],
  pump_b: ['pump_b_0.mp3', 'pump_b_1.mp3', 'pump_b_2.mp3', 'pump_b_3.mp3', 'pump_b_4.mp3', 'pump_b_5.mp3', 'pump_b_6.mp3', 'pump_b_7.mp3', 'pump_b_8.mp3', 'pump_b_9.mp3'],
  wind: ['wind_0.mp3'],
  birds: ['birds_0.mp3'],
  night: ['night_0.mp3'],
  roll: ['roll_0.mp3'],
  flange: ['flange_0.mp3'],
  joint: ['joint_0.mp3', 'joint_1.mp3', 'joint_2.mp3', 'joint_3.mp3', 'joint_4.mp3', 'joint_5.mp3', 'joint_6.mp3', 'joint_7.mp3', 'joint_8.mp3', 'joint_9.mp3', 'joint_10.mp3', 'joint_11.mp3', 'joint_12.mp3', 'joint_13.mp3', 'joint_14.mp3', 'joint_15.mp3', 'joint_16.mp3', 'joint_17.mp3', 'joint_18.mp3', 'joint_19.mp3'],
  wh_bright3: ['wh_bright3_0.wav'],
  wh_bright3_on: ['wh_bright3_on_0.mp3'],
  wh_k5: ['wh_k5_0.wav'],
  wh_k5_on: ['wh_k5_on_0.mp3'],
  cocks: ['cocks_0.mp3'],
  bpx: ['bpx_0.mp3'],
  injector: ['injector_0.mp3'],
};
// end SND_FILES (written by audio/tools/prepare.py)
const SND_GAIN = { chuff: 1, joint: 0.9, roll: 0.7, flange: 0.35, wind: 0.8, birds: 0.5, night: 0.5, blower: 0.5, safety: 0.9, pump: 0.6, cocks: 0.6, bpx: 0.7, injector: 0.5, dz: 1, wh_deep6: 1, wh_bright3: 1, wh_k5: 1 };
// one idle take so far: above idle it is sped up with the engine (see dieselRec)
const SND_DZ = [{ rpm: 300 }];
// quill: how far a part-open valve drops the pitch; attack/release: how fast it opens and closes (s); on: length of the opening take (s)
const WHISTLE_REC = {
  deep6: { quill: 0.05, attack: 0.05, release: 0.12, on: 1.2 },
  bright3: { quill: 0.04, attack: 0.04, release: 0.1, on: 0.7 },
  k5: { quill: 0, attack: 0.02, release: 0.08, on: 1.2 },
};

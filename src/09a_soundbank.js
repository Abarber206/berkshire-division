/* ============================================================================
   The recordings in audio/, by voice. Sources and licences: audio/CREDITS.md.
   SND_GAIN trims each voice to sit in the mix; SND_DZ gives the engine speed
   of each prime-mover take; WHISTLE_REC shapes how each whistle opens.
   ========================================================================== */
const SND_FILES = {
  dz: ['dz_0.mp3', 'dz_1.mp3', 'dz_2.mp3'],
  comp: ['comp_0.mp3'],
  purge: ['purge_0.mp3', 'purge_1.mp3', 'purge_2.mp3', 'purge_3.mp3'],
  dump: ['dump_0.mp3'],
  chuff: ['chuff_0.mp3', 'chuff_1.mp3', 'chuff_2.mp3', 'chuff_3.mp3', 'chuff_4.mp3', 'chuff_5.mp3', 'chuff_6.mp3', 'chuff_7.mp3'],
  chuff_hard: ['chuff_hard_0.mp3', 'chuff_hard_1.mp3', 'chuff_hard_2.mp3', 'chuff_hard_3.mp3', 'chuff_hard_4.mp3', 'chuff_hard_5.mp3', 'chuff_hard_6.mp3', 'chuff_hard_7.mp3'],
  wh_deep6: ['wh_deep6_0.wav'],
  wh_deep6_on: ['wh_deep6_on_0.mp3'],
  safety: ['safety_0.mp3'],
  blower: ['blower_0.mp3'],
  fire: ['fire_0.mp3'],
  pump_a: ['pump_a_0.mp3', 'pump_a_1.mp3', 'pump_a_2.mp3', 'pump_a_3.mp3', 'pump_a_4.mp3', 'pump_a_5.mp3', 'pump_a_6.mp3', 'pump_a_7.mp3', 'pump_a_8.mp3', 'pump_a_9.mp3'],
  pump_b: ['pump_b_0.mp3', 'pump_b_1.mp3', 'pump_b_2.mp3', 'pump_b_3.mp3', 'pump_b_4.mp3', 'pump_b_5.mp3', 'pump_b_6.mp3', 'pump_b_7.mp3', 'pump_b_8.mp3', 'pump_b_9.mp3'],
  wind: ['wind_0.mp3'],
  birds: ['birds_0.mp3'],
  night: ['night_0.mp3'],
  crickets: ['crickets_0.mp3'],
  dawn: ['dawn_0.mp3'],
  frogs: ['frogs_0.mp3'],
  roll: ['roll_0.mp3'],
  flange: ['flange_0.mp3'],
  squeal: ['squeal_0.mp3'],
  joint: ['joint_0.mp3', 'joint_1.mp3', 'joint_2.mp3', 'joint_3.mp3', 'joint_4.mp3', 'joint_5.mp3', 'joint_6.mp3', 'joint_7.mp3', 'joint_8.mp3', 'joint_9.mp3', 'joint_10.mp3', 'joint_11.mp3', 'joint_12.mp3', 'joint_13.mp3', 'joint_14.mp3', 'joint_15.mp3', 'joint_16.mp3', 'joint_17.mp3', 'joint_18.mp3', 'joint_19.mp3'],
  wh_chime6: ['wh_chime6_0.wav'],
  wh_chime6_on: ['wh_chime6_on_0.mp3'],
  wh_k5: ['wh_k5_0.wav'],
  wh_k5_on: ['wh_k5_on_0.mp3'],
  cocks: ['cocks_0.mp3'],
  bpx: ['bpx_0.mp3'],
  injector: ['injector_0.mp3'],
  bell: ['bell_0.mp3', 'bell_1.mp3', 'bell_2.mp3', 'bell_3.mp3', 'bell_4.mp3', 'bell_5.mp3', 'bell_6.mp3', 'bell_7.mp3', 'bell_8.mp3', 'bell_9.mp3', 'bell_10.mp3', 'bell_11.mp3'],
  wh_chime6_off: ['wh_chime6_off_0.mp3'],
  rain: ['rain_0.mp3'],
  rain_lt: ['rain_lt_0.mp3'],
  rain_hvy: ['rain_hvy_0.mp3'],
  thunder: ['thunder_0.mp3', 'thunder_1.mp3', 'thunder_2.mp3', 'thunder_3.mp3', 'thunder_4.mp3', 'thunder_5.mp3', 'thunder_6.mp3'],
  gt_whine: ['gt_whine_0.mp3'],
  gt_roar: ['gt_roar_0.mp3'],
  wh_s5t: ['wh_s5t_0.wav'],
  wh_s5t_on: ['wh_s5t_on_0.mp3'],
  bell_st: ['bell_st_0.mp3', 'bell_st_1.mp3', 'bell_st_2.mp3', 'bell_st_3.mp3'],
};
// end SND_FILES (written by audio/tools/prepare.py)
const SND_GAIN = { bell_st: 0.8, gt_whine: 0.55, gt_roar: 0.8, chuff: 1, chuff_hard: 0.9, fire: 0.6, comp: 0.5, purge: 0.6, dump: 0.8, squeal: 0.5, bell: 0.8, crickets: 0.45, dawn: 0.5, frogs: 0.3, joint: 0.9, roll: 0.7, flange: 0.35, wind: 0.8, birds: 0.5, night: 0.5, blower: 0.5, safety: 0.9, pump: 0.6, cocks: 0.6, bpx: 0.7, injector: 0.5, dz: 1, wh_deep6: 1, wh_chime6: 1, wh_k5: 1, rain_lt: 0.7, rain: 0.65, rain_hvy: 0.6, thunder: 1 };
// idle (a freight engine in Houston), mid throttle (a CSX freight at a crawl) and full throttle
// (a UP freight drawing near); notching up crossfades between them (see dieselRec)
const SND_DZ = [{ rpm: 300 }, { rpm: 650, load: 0.6 }, { rpm: 1050, load: 1 }];
// quill: how far a part-open valve drops the pitch; attack/release: how fast it opens and closes (s); on: length of the opening take (s);
// xf: for a whistle with a recorded closing take (wh_<key>_off), how fast the loop hands over to it (s)
const WHISTLE_REC = {
  deep6: { quill: 0.05, attack: 0.05, release: 0.12, on: 1.2 },   // Big Boy 4014 itself
  // take: borrow another whistle's recording, rate: played this much lower. No PD recording of NKP 765 exists, so it
  // blows the Big Boy's take a whole tone down, which keeps the two engines apart.
  nkp6: { quill: 0.05, attack: 0.05, release: 0.12, on: 1.2, take: 'deep6', rate: 0.93 },
  chime6: { quill: 0.05, attack: 0.05, release: 0.12, on: 1.2, xf: 0.03 },
  k5: { quill: 0, attack: 0.02, release: 0.08, on: 1.2 },
  s5t: { quill: 0, attack: 0.03, release: 0.1, on: 0.7 },   // Leslie S-5T-R, the gas turbine's horn
};

/* Every engine rings its own bell. take: the recorded strokes it plays (bell_st, a locomotive bell rung at
   Steamtown, cleaned of the engine blowing behind it; bell, an old cast crossing bell); rate: played this
   much slower, which is a bigger, deeper bell; P: seconds between strokes (a heavy bell swings slower, an
   air ringer on a diesel quicker); f: the strike note for the synthesized fallback. */
const BELL_VOICE = {
  '1225': { take: 'bell_st', rate: 0.64, P: 0.86, gain: 1, f: 620 },     // Pere Marquette: bright polished brass
  '765': { take: 'bell_st', rate: 0.5, P: 0.98, gain: 1.05, f: 495 },     // Nickel Plate: bigger and darker
  '4014': { take: 'bell', rate: 0.47, P: 1.14, gain: 1.1, f: 380 },       // Big Boy: the biggest, a slow heavy swing
  diesel: { take: 'bell', rate: 0.82, P: 0.7, gain: 0.85, f: 760 },      // AC44: small steel bell on an air ringer
  '18': { take: 'bell_st', rate: 0.8, P: 0.78, gain: 0.9, f: 790 },      // UP gas turbine: a small bell under the frame
  acela: { take: 'bell', rate: 0.9, P: 0.8, gain: 0.8, f: 820 },
};
function bellVoice(lk) { return BELL_VOICE[lk] || (LOCO_SPEC[lk] && LOCO_SPEC[lk].diesel ? BELL_VOICE.diesel : BELL_VOICE['765']); }

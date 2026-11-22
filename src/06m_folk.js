/* ============================================================================
   Travellers: the people who wait on the platforms, climb aboard the coaches,
   ride in the seats and get off at their stations (11q_crowd.js moves them).
   Each is one skinned mesh on the same jointed skeleton as the railroader you
   walk about as (06g_person.js PD, posePerson), so they stand on their soles,
   sit on the cushions and walk the same way, at one draw call apiece.
   The clothes are the 1940s: men in suits and overcoats under fedoras, women in
   dresses and coats with small hats, soldiers going home on leave, children.
   Every piece overlaps the piece it hangs from, so no pose opens a gap.
   Person frame as in 06g: soles on y = 0, facing +Z, +X to the left.
   ========================================================================== */
/* the skeleton: the joints of buildPerson, in this order (index 0 of each pair is the +X side, his left) */
const FOLK_BONES = ['hips', 'spine', 'neck', 'head', 'sh0', 'el0', 'wr0', 'sh1', 'el1', 'wr1', 'hip0', 'kn0', 'an0', 'hip1', 'kn1', 'an1', 'skirt'];
const FOLK_PARENT = [-1, 0, 1, 2, 1, 4, 5, 1, 7, 8, 0, 10, 11, 0, 13, 14, 0];
const FOLK_REST = (() => {
  const P = [[0, PD.hips, 0], [0, PD.spine, 0], [0, PD.neck, 0], [0, PD.head, 0]];
  for (const s of [1, -1]) P.push([s * PD.shX, PD.shY, 0], [0, -PD.upper, 0], [0, -PD.fore, 0]);
  for (const s of [1, -1]) P.push([s * PD.hipX, -0.005, 0], [0, -PD.thigh, 0], [0, -PD.shin, 0]);
  P.push([0, -0.005, 0]);   // the skirt's middle, swung halfway between the thighs
  return P;
})();
/* each joint's rest position in the person frame (the skeleton has no rotation at rest) */
const FOLK_AT = FOLK_REST.map((p, i) => { const o = p.slice(); for (let j = FOLK_PARENT[i]; j >= 0; j = FOLK_PARENT[j]) for (let k = 0; k < 3; k++) o[k] += FOLK_REST[j][k]; return o; });
const FB = Object.fromEntries(FOLK_BONES.map((n, i) => [n, i]));
/* colour slots: what each part of a traveller is made of */
const FS = { skin: 0, hair: 1, hat: 2, coat: 3, shirt: 4, legs: 5, shoes: 6, skirt: 7, bag: 8, accent: 9, dark: 10, band: 11 };
/* the kinds of traveller: build adds their parts; h is the range of heights (as a scale of the 1.78 m frame) */
const FOLK_KINDS = {
  suit: { h: [0.94, 1.03], seat: 1 },
  coat: { h: [0.94, 1.03], seat: 1 },
  dress: { h: [0.9, 0.97], seat: 1 },
  wcoat: { h: [0.9, 0.97], seat: 1 },
  soldier: { h: [0.95, 1.03], seat: 1 },
  boy: { h: [0.64, 0.74], seat: 1, kid: true },
  girl: { h: [0.62, 0.72], seat: 1, kid: true },
};
const FOLK_CASE = { suit: 0.55, coat: 0.45, wcoat: 0.4, soldier: 0.7, dress: 0, boy: 0, girl: 0 };   // how many carry a suitcase (or a kit bag)
const FOLK_BAG = { dress: 0.75, wcoat: 0.5 };                                                        // and a handbag on the arm

/* ---------- parts ---------- */
function folkParts(kind, carry) {
  const parts = [], kid = FOLK_KINDS[kind].kid, wom = kind === 'dress' || kind === 'wcoat' || kind === 'girl';
  const add = (bone, slot, g, m) => { if (m) g.applyMatrix4(m); parts.push([FB[bone], slot, g]); return g; };
  const tz = TORSO_ZS, coatK = kind === 'coat' || kind === 'wcoat';
  // the torso: a jacket, coat, dress bodice, sweater or uniform blouse; narrower in the shoulders for a woman
  const sx = wom ? 0.9 : 1, R = coatK ? 1.08 : 1.04;
  {
    const prof = TORSO.map(([r, y]) => [r * R, y]);
    add('spine', FS.coat, turned(prof, tz, 12).scale(sx, 1, 1));
    // the shoulders' round, so an arm swung any way still meets the body
    for (const s of [-1, 1]) add('spine', FS.coat, new THREE.SphereGeometry(0.06, 10, 8).scale(1, 0.9, 0.95).translate(s * PD.shX * (wom ? 0.95 : 1), PD.shY, 0));
    if (kind === 'suit' || kind === 'soldier') {
      // the shirt and tie in the jacket's open front
      add('spine', FS.shirt, new THREE.BoxGeometry(0.075, 0.15, 0.012).translate(...torsoAt(0, 0.4, 1, 0.012)));
      add('spine', FS.accent, new THREE.BoxGeometry(0.03, 0.17, 0.01).translate(...torsoAt(0, 0.385, 1, 0.022)));
      // jacket buttons
      for (const y of [0.18, 0.25]) add('spine', FS.dark, new THREE.SphereGeometry(0.011, 6, 4).translate(...torsoAt(0.02, y, 1, 0.012 + (R - 1) * 0.16)));
    }
    if (coatK) {
      // a scarf round the neck, its end hanging down the front, and the coat's buttons
      add('spine', FS.accent, new THREE.TorusGeometry(0.064, 0.024, 6, 14).rotateX(Math.PI / 2).translate(0, 0.47, 0));
      add('spine', FS.accent, new THREE.BoxGeometry(0.06, 0.2, 0.02).rotateZ(0.12).translate(...torsoAt(0.05, 0.36, 1, 0.025 + 0.012)));
      for (const y of [0.1, 0.2, 0.3]) add('spine', FS.dark, new THREE.SphereGeometry(0.012, 6, 4).translate(...torsoAt(0.045, y, 1, 0.014 + 0.012)));
    }
    if (kind === 'dress') add('spine', FS.accent, new THREE.TorusGeometry(0.06, 0.012, 5, 14).rotateX(Math.PI / 2).translate(0, 0.468, 0));   // collar
    if (kind === 'soldier') { add('spine', FS.band, turned([[0.0, 0.0], [torsoR(0.03) * R * 1.03, 0.0], [torsoR(0.03) * R * 1.03, 0.06], [0, 0.06]], tz, 12)); }   // belt
    if (kind === 'boy') add('spine', FS.shirt, new THREE.TorusGeometry(0.058, 0.016, 5, 14).rotateX(Math.PI / 2).translate(0, 0.47, 0));     // shirt collar over the sweater
  }
  // the pelvis: trousers, a skirt's top, or the coat over them
  {
    const skirtTop = kind === 'wcoat' || coatK ? FS.coat : wom ? FS.skirt : kind === 'boy' ? FS.skirt : FS.legs;
    add('hips', skirtTop, turned([[0.0, -0.15], [0.105, -0.145], [0.158, -0.09], [0.17, -0.01], [0.162, 0.06], [0.145, 0.11]].map(([r, y]) => [r * (wom ? 0.97 : 1), y]), 0.74, 12));
  }
  // the neck and head
  add('neck', FS.skin, new THREE.CylinderGeometry(0.05, 0.055, 0.15, 10).translate(0, 0.045, 0));
  {
    const hs = kid ? 1.22 : 1, H = (g) => g.scale(hs, hs, hs);
    const fx = 0.78, fy = wom ? 1.1 : 1.15, fz = 0.98;
    add('head', FS.skin, H(new THREE.SphereGeometry(0.1, 14, 11).scale(fx, fy, fz)));
    add('head', FS.skin, H(new THREE.SphereGeometry(0.019, 6, 5).scale(0.8, 1.3, 1).translate(0, -0.012, 0.096)));       // nose
    for (const s of [-1, 1]) {
      add('head', FS.skin, H(new THREE.SphereGeometry(0.025, 6, 5).scale(0.35, 1, 0.7).translate(s * 0.077, -0.005, -0.005)));
      add('head', FS.dark, H(new THREE.SphereGeometry(0.011, 6, 4).translate(s * 0.032, 0.018, 0.083)));                 // eyes
      add('head', FS.hair, H(new THREE.BoxGeometry(0.03, 0.007, 0.012).translate(s * 0.033, 0.038, 0.088)));             // brows
    }
    // hair: short back and sides for the men and the boy, longer and rolled for the women, a ribbon on the girl
    // the crown, down to the hairline, and the back and sides (the face left clear, 60 degrees either side)
    const hr = wom ? 0.107 : 0.104;
    add('head', FS.hair, H(new THREE.SphereGeometry(hr, 14, 4, 0, TAU, 0, Math.PI * 0.27).scale(fx, fy, fz)));
    add('head', FS.hair, H(new THREE.SphereGeometry(hr, 12, 7, Math.PI * 0.83, Math.PI * 1.34, Math.PI * 0.2, Math.PI * (wom ? 0.44 : 0.36)).scale(fx, fy, fz * (wom ? 1.03 : 1))));
    if (wom) {
      add('head', FS.hair, H(new THREE.SphereGeometry(0.075, 10, 8).scale(1.25, 0.8, 0.85).translate(0, -0.06, -0.06)));   // the roll at the nape
      if (kind === 'girl') add('head', FS.accent, H(new THREE.TorusGeometry(0.03, 0.012, 5, 10).scale(1.4, 1, 1).translate(0, 0.09, -0.06)));
    }
    // hats
    const hat = FOLK_HAT[kind];
    if (hat === 'fedora') {
      add('head', FS.hat, H(new THREE.CylinderGeometry(0.083, 0.094, 0.1, 14).scale(1, 1, 1.15).translate(0, 0.125, 0)));
      add('head', FS.hat, H(new THREE.SphereGeometry(0.084, 14, 5, 0, TAU, 0, Math.PI / 2).scale(1, 0.32, 1.15).translate(0, 0.172, 0)));
      add('head', FS.band, H(new THREE.CylinderGeometry(0.0955, 0.0965, 0.026, 14).scale(1, 1, 1.15).translate(0, 0.088, 0)));
      add('head', FS.hat, H(new THREE.CylinderGeometry(0.17, 0.165, 0.012, 18).scale(1, 1, 1.12).translate(0, 0.075, 0.005)));
    } else if (hat === 'garrison') {
      // the folded overseas cap, worn tipped to the right
      const g = new THREE.BoxGeometry(0.1, 0.07, 0.24); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setX(i, p.getX(i) * 0.35);
      g.computeVertexNormals();
      add('head', FS.hat, H(g.rotateZ(-0.12).translate(-0.012, 0.115, 0)));
    } else if (hat === 'cap') {
      add('head', FS.hat, H(new THREE.CylinderGeometry(0.097, 0.092, 0.06, 14).scale(1, 1, 1.1).translate(0, 0.095, -0.004)));
      add('head', FS.hat, H(new THREE.SphereGeometry(0.098, 14, 5, 0, TAU, 0, Math.PI / 2).scale(1.04, 0.3, 1.2).translate(0, 0.122, 0.012)));
      add('head', FS.hat, H(new THREE.CylinderGeometry(0.1, 0.1, 0.008, 14, 1, false, -1.1, 2.2).scale(1, 1, 0.75).rotateX(0.12).translate(0, 0.075, 0.04)));
    } else if (hat === 'lady') {
      // a small felt hat tipped forward over the rolled hair, with a band
      add('head', FS.hat, H(new THREE.CylinderGeometry(0.07, 0.078, 0.06, 14).scale(1, 1, 1.12).rotateX(0.18).translate(0, 0.128, 0.012)));
      add('head', FS.hat, H(new THREE.CylinderGeometry(0.13, 0.125, 0.01, 18).scale(1, 1, 1.05).rotateX(0.18).translate(0, 0.098, 0.018)));
      add('head', FS.band, H(new THREE.CylinderGeometry(0.0785, 0.0795, 0.02, 14).scale(1, 1, 1.12).rotateX(0.18).translate(0, 0.108, 0.014)));
    }
  }
  // arms: sleeves to the hands
  for (const i of [0, 1]) {
    const s = i ? 'sh1' : 'sh0', e = i ? 'el1' : 'el0', w = i ? 'wr1' : 'wr0';
    const slv = kind === 'boy' ? FS.coat : FS.coat;
    add(s, slv, limbGeo(0.055 * (coatK ? 1.05 : 1) * (wom ? 0.92 : 1), 0.046 * (wom ? 0.92 : 1), PD.upper, 10));
    add(e, slv, limbGeo(0.048 * (coatK ? 1.06 : 1), 0.04, PD.fore, 10));
    add(e, kind === 'suit' ? FS.shirt : slv, new THREE.CylinderGeometry(0.043, 0.041, 0.035, 10).translate(0, -PD.fore + 0.012, 0));   // the cuff
    const glove = kind === 'wcoat' ? FS.accent : FS.skin;
    add(w, glove, new THREE.SphereGeometry(0.046, 9, 8).scale(0.6, 1.7, 1.0).translate(0, -0.075, 0.005));
    add(w, glove, limbGeo(0.015, 0.013, 0.045, 6).rotateX(-0.6).rotateZ(-(i ? -1 : 1) * 0.35).translate(0, -0.045, 0.03));   // thumb
  }
  // legs: trousers (or stockings under a skirt, or the coat's skirts over trousers) to the shoes
  for (const i of [0, 1]) {
    const hp = i ? 'hip1' : 'hip0', kn = i ? 'kn1' : 'kn0', an = i ? 'an1' : 'an0', side = i ? -1 : 1;
    if (wom) {
      add(hp, FS.legs, limbGeo(0.078, 0.056, PD.thigh, 10));
      add(kn, FS.legs, limbGeo(0.056, 0.042, PD.shin, 10));
      /* the skirt, worn to just below the knee: each half flares round its own thigh and they overlap between
         the legs, so it hangs as one standing still, swings with the stride and drapes over the lap seated */
      const L = kind === 'girl' ? 0.36 : 0.5, top = 0.135, hem = kind === 'wcoat' ? 0.2 : 0.185;
      const g = new THREE.LatheGeometry([[hem * 0.86, -L + 0.004], [hem, -L], [hem * 0.92, -L + 0.06], [top * 1.1, -0.12], [top * 1.08, 0.0], [top * 0.9, 0.1], [0, 0.1]].map(([r, y]) => new THREE.Vector2(r, y)), 12);
      g.scale(1, 1, 0.86).translate(-side * 0.04, 0, 0.012);
      add(hp, kind === 'wcoat' ? FS.coat : FS.skirt, g);
    } else if (kind === 'boy') {
      add(hp, FS.skin, limbGeo(0.07, 0.052, PD.thigh, 10));
      add(hp, FS.skirt, new THREE.LatheGeometry([[0.075, -0.222], [0.098, -0.22], [0.104, -0.12], [0.1, 0.02], [0, 0.02]].map(([r, y]) => new THREE.Vector2(r, y)), 10));   // short trousers
      add(kn, FS.skin, limbGeo(0.052, 0.042, PD.shin, 10));
      add(kn, FS.legs, new THREE.CylinderGeometry(0.05, 0.047, 0.25, 10).translate(0, -PD.shin + 0.1, 0));            // knee socks
    } else {
      add(hp, FS.legs, limbGeo(0.088, 0.065, PD.thigh, 10));
      add(kn, FS.legs, limbGeo(0.065, 0.054, PD.shin, 10));
      add(kn, FS.legs, new THREE.CylinderGeometry(0.068, 0.066, 0.06, 10).translate(0, -PD.shin + 0.085, 0));          // the trouser cuff over the shoe
      if (kind === 'coat') {
        // the overcoat's skirts, to below the knee, each round its own thigh
        const g = new THREE.LatheGeometry([[0.13, -0.505], [0.152, -0.5], [0.148, -0.14], [0.142, 0.02], [0, 0.02]].map(([r, y]) => new THREE.Vector2(r, y)), 12);
        g.scale(1, 1, 0.86).translate(-side * 0.035, 0, 0.008);
        add(hp, FS.coat, g);
      }
      if (kind === 'soldier') add(kn, FS.band, new THREE.CylinderGeometry(0.062, 0.06, 0.13, 10).translate(0, -PD.shin + 0.1, 0));   // canvas leggings
    }
    // shoes: soles on the ground at y = -ankle in the ankle's frame
    const y0 = -PD.ankle, sw = wom ? 0.08 : 0.095, sl = wom ? 0.22 : 0.255;
    add(an, FS.shoes, new THREE.CylinderGeometry(wom ? 0.046 : 0.056, wom ? 0.05 : 0.06, 0.1, 10).translate(0, 0.0, -0.005));
    add(an, FS.shoes, new THREE.BoxGeometry(sw, 0.065, sl).translate(0, y0 + 0.0325, 0.04));
    add(an, FS.shoes, new THREE.SphereGeometry(sw / 2, 9, 6, 0, TAU, 0, Math.PI / 2).scale(1, 0.9, 1.1).translate(0, y0 + 0.012, 0.04 + sl / 2 - 0.01));
    add(an, FS.dark, new THREE.BoxGeometry(sw + 0.006, 0.014, sl + 0.01).translate(0, y0 + 0.007, 0.04));
  }
  /* the middle of a skirt or overcoat, hung from the hips and swung halfway between the thighs (folkPose), so the
     gap the two halves open at full stride is filled; just inside them standing still, over the lap seated */
  if (wom || kind === 'coat') {
    const L = kind === 'girl' ? 0.36 : 0.5, hm = kind === 'coat' ? 0.138 : 0.148, c = kind === 'coat' || kind === 'wcoat' ? FS.coat : FS.skirt;
    const g = new THREE.LatheGeometry([[hm * 0.84, -L + 0.006], [hm, -L + 0.002], [hm * 0.95, -L + 0.06], [0.11, -0.12], [0.1, 0.0], [0.09, 0.08], [0, 0.08]].map(([r, y]) => new THREE.Vector2(r, y)), 14);
    add('skirt', c, g.scale(1.35, 1, 0.97).translate(0, 0, 0.012));
  }
  // luggage: a suitcase (a soldier's kit bag) in the right hand, a handbag on the left forearm
  if (carry === 'case') {
    const w = 'wr1';
    if (kind === 'soldier') {
      add(w, FS.bag, new THREE.CylinderGeometry(0.13, 0.13, 0.52, 12).rotateX(Math.PI / 2).translate(0, -0.25, 0));
      add(w, FS.band, new THREE.TorusGeometry(0.05, 0.012, 5, 10).translate(0, -0.12, 0));
    } else {
      add(w, FS.bag, new THREE.BoxGeometry(0.12, 0.34, 0.48).translate(0, -0.3, 0));
      add(w, FS.band, new THREE.BoxGeometry(0.128, 0.03, 0.488).translate(0, -0.2, 0));
      add(w, FS.band, new THREE.BoxGeometry(0.1, 0.03, 0.03).translate(0, -0.115, 0));          // the handle in his grip
      for (const z of [-0.15, 0.15]) add(w, FS.band, new THREE.BoxGeometry(0.02, 0.04, 0.02).translate(0, -0.13, z * 0.25));
    }
  } else if (carry === 'bag') {
    add('el0', FS.bag, new THREE.BoxGeometry(0.06, 0.16, 0.22).translate(0.075, -0.12, 0.02));
    add('el0', FS.band, new THREE.TorusGeometry(0.06, 0.008, 4, 12).rotateY(Math.PI / 2).translate(0.06, -0.06, 0.0));
  }
  return parts;
}
const FOLK_HAT = { suit: 'fedora', coat: 'fedora', soldier: 'garrison', boy: 'cap', dress: 'lady', wcoat: 'lady', girl: null };

/* ---------- colourways ---------- */
const FOLK_PAL = {
  skin: ['#f2cba8', '#e3b08a', '#d29c74', '#b97e57', '#9a6443', '#7a4c31', '#5c3722'],
  hair: ['#1b1511', '#2f2219', '#4a3322', '#6b4428', '#93643a', '#c19a62', '#837c74', '#c9c4bb'],
  mCoat: ['#283140', '#35363a', '#4a3a2c', '#655440', '#55595d', '#2c3729', '#7a684e', '#1d2026', '#45403a'],
  wCoat: ['#7a2430', '#2b4a6b', '#4b5e3a', '#8a6a3e', '#5a3a5e', '#a5482f', '#2e2e35', '#6d7f8c', '#b28d5a'],
  dress: ['#9b3b3b', '#3b6b8a', '#c49a3e', '#5e7b4a', '#7a5a8a', '#2e4a6e', '#a85a6a', '#d8c9a8', '#3f5f5a'],
  mHat: ['#2a2420', '#4a3a2a', '#5c5c58', '#3a3d44', '#6b5a40', '#1b1b1d'],
  wHat: ['#1b1b1d', '#7a2430', '#2b3a5a', '#5a3a2a', '#d9cdb5', '#3a4a3a'],
  shoes: ['#1a1410', '#3a2416', '#2a1a12', '#4a2c18'],
  wShoes: ['#1a1410', '#5a2a1a', '#2a2a2a', '#7a4a2a', '#d0c4b0'],
  shirt: ['#e8e6df', '#dfe6ee', '#efe8d8'],
  accent: ['#7a1f1f', '#1f3a6b', '#2f4a2f', '#6b4a1f', '#3a1f4a', '#a8862a', '#5a2a2a'],
  bag: ['#6b4424', '#3d2a1c', '#7a6a4a', '#2a3a4a', '#5a1f1f', '#8a7a5a'],
  band: ['#2a1c12', '#1b1b1b', '#3a2a1a'],
  sweater: ['#8a2a2a', '#2a4a7a', '#4a6a3a', '#b88a3a', '#5a5a5a'],
};
function folkWay(kind, k) {
  const r = rng(7919 * (k + 1) + kind.length * 131 + kind.charCodeAt(0) * 17), pick = a => a[Math.floor(r() * a.length) % a.length];
  const skin = pick(FOLK_PAL.skin), hair = pick(FOLK_PAL.hair.slice(0, FOLK_KINDS[kind].kid ? 6 : 8));
  const w = { skin, hair, dark: '#1c1916', shirt: pick(FOLK_PAL.shirt), accent: pick(FOLK_PAL.accent), bag: pick(FOLK_PAL.bag), band: pick(FOLK_PAL.band) };
  if (kind === 'suit' || kind === 'coat') { w.coat = pick(FOLK_PAL.mCoat); w.legs = r() < 0.6 ? w.coat : pick(FOLK_PAL.mCoat); w.hat = pick(FOLK_PAL.mHat); w.shoes = pick(FOLK_PAL.shoes); w.skirt = w.coat; }
  else if (kind === 'soldier') { const navy = r() < 0.3; w.coat = navy ? '#1d2433' : '#5b5a3c'; w.legs = navy ? '#1d2433' : '#6b6447'; w.hat = w.coat; w.shoes = navy ? '#121212' : '#4a2e1c'; w.accent = navy ? '#121212' : '#4d4a36'; w.band = navy ? '#121212' : '#8f8665'; w.bag = navy ? '#e2ddd0' : '#77714f'; w.skirt = w.legs; }
  else if (kind === 'dress' || kind === 'girl') { w.coat = pick(FOLK_PAL.dress); w.skirt = w.coat; w.legs = folkMix(skin, '#c8a184', 0.55); w.hat = pick(FOLK_PAL.wHat); w.shoes = pick(FOLK_PAL.wShoes); if (kind === 'girl') w.legs = '#ece8e0'; }
  else if (kind === 'wcoat') { w.coat = pick(FOLK_PAL.wCoat); w.skirt = pick(FOLK_PAL.dress); w.legs = folkMix(skin, '#c8a184', 0.55); w.hat = pick(FOLK_PAL.wHat); w.shoes = pick(FOLK_PAL.wShoes); w.accent = r() < 0.5 ? '#1b1b1d' : pick(FOLK_PAL.accent); }
  else if (kind === 'boy') { w.coat = pick(FOLK_PAL.sweater); w.skirt = pick(['#4a4a4a', '#5a4a3a', '#2a3346']); w.legs = pick(['#e2ddd0', '#5a5a5a', '#2a3346']); w.hat = pick(FOLK_PAL.mHat); w.shoes = pick(FOLK_PAL.shoes); }
  return w;
}
function folkMix(a, b, k) { const A = new THREE.Color(a), B = new THREE.Color(b); return '#' + A.lerp(B, k).getHexString(); }
const FOLK_WAYS = 8;   // colourways of each kind

/* ---------- the shared geometry ---------- */
const FOLK = { base: {}, geo: {}, mat: null, matIn: null, inK: { value: 0 }, inv: null };
/* the merged parts of one kind with what it carries: positions in the rest pose, a bone and a slot for every vertex */
function folkBase(kind, carry) {
  const key = kind + '|' + (carry || '');
  if (FOLK.base[key]) return FOLK.base[key];
  const parts = folkParts(kind, carry);
  let nv = 0, ni = 0;
  for (const [, , g] of parts) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4), slot = new Uint8Array(nv);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let v = 0, q = 0;
  for (const [b, s, g0] of parts) {
    const g = g0.attributes.normal ? g0 : (g0.computeVertexNormals(), g0);
    const P = g.attributes.position, N = g.attributes.normal, at = FOLK_AT[b];
    for (let i = 0; i < P.count; i++) {
      pos[(v + i) * 3] = P.getX(i) + at[0]; pos[(v + i) * 3 + 1] = P.getY(i) + at[1]; pos[(v + i) * 3 + 2] = P.getZ(i) + at[2];
      nor[(v + i) * 3] = N.getX(i); nor[(v + i) * 3 + 1] = N.getY(i); nor[(v + i) * 3 + 2] = N.getZ(i);
      si[(v + i) * 4] = b; sw[(v + i) * 4] = 1; slot[v + i] = s;
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[q++] = g.index.getX(i) + v;
    else for (let i = 0; i < P.count; i++) idx[q++] = v + i;
    v += P.count;
    g.dispose();
  }
  const B = {
    key, kind, carry, slot, count: nv,
    position: new THREE.BufferAttribute(pos, 3), normal: new THREE.BufferAttribute(nor, 3),
    skinIndex: new THREE.Uint16BufferAttribute(si, 4), skinWeight: new THREE.BufferAttribute(sw, 4), index: new THREE.BufferAttribute(idx, 1),
    parts: parts.map(([b, s]) => [b, s]),
  };
  return (FOLK.base[key] = B);
}
/* one kind in one colourway: shares every attribute of its base but the colours */
const FOLK_SLOTKEY = Object.entries(FS).reduce((o, [k, v]) => (o[v] = k, o), []);
function folkGeo(kind, way, carry) {
  const key = kind + '|' + (carry || '') + '|' + way;
  if (FOLK.geo[key]) return FOLK.geo[key];
  const B = folkBase(kind, carry), W = folkWay(kind, way), col = new Float32Array(B.count * 3), c = new THREE.Color();
  const lin = FOLK_SLOTKEY.map(k => { c.set(W[k] || '#ff00ff'); return [Math.pow(c.r, 2.2), Math.pow(c.g, 2.2), Math.pow(c.b, 2.2)]; });
  for (let i = 0; i < B.count; i++) { const L = lin[B.slot[i]]; col[i * 3] = L[0]; col[i * 3 + 1] = L[1]; col[i * 3 + 2] = L[2]; }
  const g = new THREE.BufferGeometry();
  g.setIndex(B.index);
  for (const a of ['position', 'normal', 'skinIndex', 'skinWeight']) g.setAttribute(a, B[a]);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (typeof linearizeObject === 'function') (linearizeObject.done || (linearizeObject.done = new WeakSet())).add(col);   // already linear
  // posed any way (seated, arms up, a suitcase swinging) he stays inside this
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0.1), 1.15);
  g.boundingBox = new THREE.Box3(new THREE.Vector3(-0.8, -0.1, -0.8), new THREE.Vector3(0.8, 2.0, 1.0));
  g.userData.shared = true;
  return (FOLK.geo[key] = g);
}
/* two materials: outdoors, and inside a coach, where the saloon's lamps light them too (11q_crowd sets FOLK.inK) */
function folkMaterials() {
  if (FOLK.mat) return;
  const mk = inside => {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.86, metalness: 0 });
    m.skinning = true; m.userData.noSnow = true; m.userData.lin = true; m.userData.person = true;
    if (inside) {
      m.onBeforeCompile = sh => {
        sh.uniforms.folkIn = FOLK.inK;
        sh.fragmentShader = 'uniform float folkIn;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * folkIn;');
      };
      m.customProgramCacheKey = () => 'folkIn';
    }
    return m;
  };
  FOLK.mat = mk(false); FOLK.matIn = mk(true);
}
/* the bones' inverse bind matrices, the same for everyone */
function folkInverses() {
  if (FOLK.inv) return FOLK.inv;
  return (FOLK.inv = FOLK_AT.map(p => new THREE.Matrix4().makeTranslation(-p[0], -p[1], -p[2])));
}
/* a traveller: { mesh, rig } where rig is posePerson's (root, j, soles) over the mesh's bones */
function folkMesh(kind, way, carry) {
  folkMaterials();
  const bones = FOLK_BONES.map(n => { const b = new THREE.Bone(); b.name = n; return b; });
  bones.forEach((b, i) => { b.position.fromArray(FOLK_REST[i]); if (FOLK_PARENT[i] >= 0) bones[FOLK_PARENT[i]].add(b); });
  const mesh = new THREE.SkinnedMesh(folkGeo(kind, way, carry), FOLK.mat);
  mesh.add(bones[0]);
  mesh.bind(new THREE.Skeleton(bones, folkInverses()), new THREE.Matrix4());
  mesh.matrixAutoUpdate = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.name = 'traveller';
  const soles = [];
  for (const a of [bones[FB.an0], bones[FB.an1]]) for (const z of [-0.1, 0.19]) for (const x of [-0.045, 0.045]) { const o = new THREE.Object3D(); o.position.set(x, -PD.ankle, z); a.add(o); soles.push(o); }
  const j = { hips: bones[0], spine: bones[1], neck: bones[2], head: bones[3], sh: [bones[4], bones[7]], el: [bones[5], bones[8]], wr: [bones[6], bones[9]], hip: [bones[10], bones[13]], kn: [bones[11], bones[14]], an: [bones[12], bones[15]], skirt: bones[16] };
  const rig = { root: mesh, j, soles, hull: [], _inv: new THREE.Matrix4(), _p: new THREE.Vector3() };
  return { mesh, rig, kind, way, carry };
}
/* change what a traveller is (another kind, colourway or luggage) without a new skeleton */
function folkDress(f, kind, way, carry) { f.mesh.geometry = folkGeo(kind, way, carry); f.kind = kind; f.way = way; f.carry = carry; }

/* Pose a traveller. st as posePerson's ({ phase, speed, sit, t }), and also:
   turn: head turned (radians, + to his left), look: head pitch (as posePerson), watch: 0..1 lifting the left wrist to read a watch,
   carry: the suitcase hand held out from the leg, steady, scale: his height (for a seat height in metres),
   reach: seated, let the thighs slope so the shoes find the floor (a bench higher than a coach seat) */
function folkPose(f, st) {
  const rig = f.rig, j = rig.j, sc = st.scale || 1;
  const sit = st.sit ? st.sit / sc : 0;
  posePerson(rig, sit ? { sit, look: st.look || 0 } : st);
  if (sit) {
    // the soles hang (sit + seatHip - 0.005) - (thigh slope) - shin - ankle below the hips: let the thighs slope down to reach
    const lo = sit + PD.seatHip - 0.005 - PD.shin - PD.ankle - 0.03, reach = st.reach === false ? 0 : clamp(lo / PD.thigh, 0, FOLK_KINDS[f.kind].kid ? 0.1 : 0.28);
    if (reach > 0) { const d = Math.asin(reach); for (let s = 0; s < 2; s++) { j.hip[s].rotation.x += d; j.kn[s].rotation.x -= d; } }
    // hands in the lap
    for (let s = 0; s < 2; s++) { j.sh[s].rotation.set(-0.42, 0, (s ? -1 : 1) * 0.06); j.el[s].rotation.set(-0.95, 0, 0); j.wr[s].rotation.set(0, 0, 0); }
    if (st.read) { for (let s = 0; s < 2; s++) { j.sh[s].rotation.x = -0.6; j.el[s].rotation.x = -1.55; } j.neck.rotation.x = 0.32; }
  }
  if (st.turn) { j.neck.rotation.y = st.turn * 0.75; j.spine.rotation.y += st.turn * 0.25; }
  if (st.watch > 0) {
    const k = st.watch;
    j.sh[0].rotation.x = lerp(j.sh[0].rotation.x, -0.55, k); j.sh[0].rotation.z = lerp(j.sh[0].rotation.z, -0.25, k);
    j.el[0].rotation.x = lerp(j.el[0].rotation.x, -1.75, k); j.el[0].rotation.y = lerp(j.el[0].rotation.y, -0.5, k);
    j.neck.rotation.x = lerp(j.neck.rotation.x, 0.42, k);
  }
  if (f.carry === 'case' && !sit) {
    // the bag's weight: the arm hangs straight and a little out from the leg, swinging only a little
    j.sh[1].rotation.x *= 0.25; j.sh[1].rotation.z = f.kind === 'wcoat' || f.kind === 'dress' ? -0.33 : -0.21; j.el[1].rotation.x = -0.04; j.spine.rotation.z = -0.035;
  }
  if (f.carry === 'bag' && !sit) { j.sh[0].rotation.x *= 0.3; j.sh[0].rotation.z = 0.12; j.el[0].rotation.x = -1.35; }
  if (st.wave >= 0 && st.wave !== undefined && !sit) {
    const w = st.wave, up = smooth(0, 0.35, w) * (1 - smooth(2.2, 2.7, w));
    j.sh[0].rotation.set(-0.35 * up, 0, 2.55 * up + 0.07);
    j.el[0].rotation.set(0, 0, (0.25 + 0.45 * Math.sin(w * 9)) * up);
  }
  j.skirt.quaternion.copy(j.hip[0].quaternion).slerp(j.hip[1].quaternion, 0.5);
}
/* the kinds and colourways a crowd draws from, weighted: mostly grown-ups in their travelling clothes */
const FOLK_MIX = [['suit', 26], ['coat', 16], ['dress', 18], ['wcoat', 16], ['soldier', 9], ['boy', 8], ['girl', 7]];
function folkPick(r, opt = {}) {
  const wt = k => (opt.noKids && FOLK_KINDS[k].kid) || (opt.winter && k === 'dress') ? 0 : opt.winter && (k === 'coat' || k === 'wcoat') ? 1.8 : 1;
  let tot = 0; for (const [k, w] of FOLK_MIX) tot += w * wt(k);
  let x = r() * tot, kind = 'suit';
  for (const [k, w] of FOLK_MIX) { const ww = w * wt(k); if (ww > 0 && (x -= ww) <= 0) { kind = k; break; } }
  const K = FOLK_KINDS[kind];
  const carry = r() < (FOLK_CASE[kind] || 0) * (opt.bags === undefined ? 1 : opt.bags) ? 'case' : r() < (FOLK_BAG[kind] || 0) ? 'bag' : null;
  return { kind, way: Math.floor(r() * FOLK_WAYS), carry, scale: lerp(K.h[0], K.h[1], r()), seed: Math.floor(r() * 1e9) };
}

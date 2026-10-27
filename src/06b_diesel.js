/* ============================================================================
   Modern six-axle AC freight diesel, lettered for the fictional
   Sandusky & Scioto. Generic proportions of the class: 74 ft over couplers,
   C-C trucks with 42 in wheels, wide safety cab, 4,400 hp.
   Local frame: +X forward, origin midway between truck centres at rail top.
   ========================================================================== */
const DG = { len: 22.6, ref: 11.3, trucks: [4.2, 18.4], axle: 2.08, rW: 0.533, deck: 1.7 };
const dx = a => DG.ref - a;

function dieselMaterials() {
  if (RMAT.dGreen) return;
  const mk = (c, m, r, extra = {}) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r, ...extra });
  RMAT.dGreen = mk(0x1d4634, 0.3, 0.42, { side: THREE.DoubleSide });
  RMAT.dCream = mk(0xe6d6a6, 0.15, 0.5, { side: THREE.DoubleSide });
  RMAT.dDeck = mk(0x2a2c2b, 0.4, 0.8);
  RMAT.dUnder = mk(0x161718, 0.45, 0.55, { side: THREE.DoubleSide });
  RMAT.dSafety = mk(0xe8c23a, 0.15, 0.5);
  RMAT.dInt = mk(0x9a9c94, 0.05, 0.85, { side: THREE.DoubleSide });
  RMAT.dDesk = mk(0x3b3e40, 0.3, 0.6);
  RMAT.glassT = new THREE.MeshStandardMaterial({ color: 0x15232a, metalness: 0.6, roughness: 0.05, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  RMAT.screen = new THREE.MeshBasicMaterial({ map: canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#05080a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1c3d2c'; g.fillRect(6, 6, w - 12, 22);
    g.fillStyle = '#7fe0a0'; g.font = 'bold 16px monospace'; g.fillText('TE  42 KLB   N5   FWD', 12, 22);
    g.strokeStyle = '#3fae74'; g.lineWidth = 3; g.beginPath(); g.arc(70, 82, 34, Math.PI * 0.8, Math.PI * 2.2); g.stroke();
    g.strokeStyle = '#e8c23a'; g.beginPath(); g.arc(190, 82, 34, Math.PI * 0.8, Math.PI * 1.6); g.stroke();
    g.fillStyle = '#cfe9d8'; g.font = '14px monospace'; g.fillText('BP 90', 46, 88); g.fillText('MR 140', 162, 88);
  }) });
  RMAT.grille = mk(0x111213, 0.4, 0.7, { map: canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#5a5e60'; g.fillRect(0, 0, w, h); g.fillStyle = '#0b0c0d'; for (let y = 0; y < h; y += 6) g.fillRect(0, y, w, 4); }, { repeat: true }) });
  RMAT.fan = mk(0x161718, 0.5, 0.6, { map: canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#0a0b0c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#4a4e50'; g.lineWidth = 2; for (let r = 8; r < 64; r += 7) { g.beginPath(); g.arc(64, 64, r, 0, TAU); g.stroke(); } for (let a = 0; a < 12; a++) { g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(a / 12 * TAU) * 62, 64 + Math.sin(a / 12 * TAU) * 62); g.stroke(); } g.fillStyle = '#2a2d2f'; g.beginPath(); g.arc(64, 64, 9, 0, TAU); g.fill(); }) });
  RMAT.ditchL = new THREE.MeshBasicMaterial({ color: 0xfff3d6 });
  RMAT.ditchR = new THREE.MeshBasicMaterial({ color: 0xfff3d6 });
  RMAT.numLit = new THREE.MeshBasicMaterial({ map: canvasTex(128, 48, (g, w, h) => { g.fillStyle = '#e9e4cf'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.font = 'bold 34px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('4401', w / 2, h / 2 + 2); }) });
  RMAT.pilotStripe = mk(0x1d4634, 0.2, 0.55, { map: canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#1d4634'; g.fillRect(0, 0, w, h); g.fillStyle = '#e6d6a6'; for (let x = -64; x < w + 64; x += 32) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 16, h); g.lineTo(x + 16 + 40, 0); g.lineTo(x + 40, 0); g.closePath(); g.fill(); } }) });
  const cream = '#ece0b6';
  RMAT.dRoad = decalMat(1024, 128, (g, w, h) => { g.font = '800 82px "Arial Narrow", "Helvetica Neue", Arial, sans-serif'; g.fillStyle = cream; g.textAlign = 'center'; g.textBaseline = 'middle'; if (g.letterSpacing !== undefined) g.letterSpacing = '6px'; g.fillText('SANDUSKY & SCIOTO', w / 2, h / 2 + 4); });
  RMAT.dNum = decalMat(256, 128, (g, w, h) => { g.font = '800 96px "Arial Narrow", Arial, sans-serif'; g.fillStyle = cream; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('4401', w / 2, h / 2 + 4); });
  RMAT.dHerald = decalMat(256, 256, (g, w, h) => {
    g.strokeStyle = cream; g.lineWidth = 14; g.beginPath(); g.arc(128, 128, 112, 0, TAU); g.stroke();
    g.lineWidth = 5; g.beginPath(); g.arc(128, 128, 92, 0, TAU); g.stroke();
    g.fillStyle = cream; g.font = '800 92px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('S&S', 128, 134);
  });
}

function buildDiesel(key) {
  dieselMaterials();
  const spec = LOCO_SPEC[key];
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const gb = new GeoBin();
  const D = DG.deck;
  const box = (k, a0, a1, y0, y1, z0, z1) => gb.box(k, Math.abs(a1 - a0), Math.abs(y1 - y0), Math.abs(z1 - z0), dx((a0 + a1) / 2), (y0 + y1) / 2, (z0 + z1) / 2);

  /* ---- underframe, sill, deck ---- */
  box('dGreen', 0.6, 22.0, 1.16, 1.66, -1.55, 1.55);
  box('dCream', 0.59, 22.01, 1.46, 1.56, -1.56, 1.56);
  box('dDeck', 0.6, 22.0, 1.66, D + 0.02, -1.58, 1.58);
  for (let a = 1.6, k = 0; a < 21.2; a += 1.05, k++) for (const s of [-1, 1]) box(k % 2 ? 'red' : 'white', a, a + 0.45, 1.25, 1.36, s * 1.556, s * 1.562);
  /* ---- ends: pilot, plow, coupler, steps ---- */
  for (const e of [0, 1]) {
    const A = e ? 22.6 : 0, sg = e ? -1 : 1;  // sg: inward direction along a
    const at = d => A + sg * d;
    box('dGreen', at(0.42), at(0.62), 0.78, 1.66, -1.55, 1.55);
    gb.add('pilotStripe', new THREE.PlaneGeometry(3.08, 0.86), M(dx(at(0.41)), 1.22, 0, 0, e ? -Math.PI / 2 : Math.PI / 2, 0));
    // plow
    for (const s of [-1, 1]) gb.add('dUnder', new THREE.BoxGeometry(1.75, 0.72, 0.05), M(dx(at(0.62)), 0.48, s * 0.74, 0, -s * sg * 0.42, 0).multiply(M(0, 0, 0, 0, Math.PI / 2, 0)));
    box('dUnder', at(0.3), at(0.5), 0.84, 0.95, -0.12, 0.12);
    // coupler & draft gear
    box('dUnder', at(0.0), at(0.45), 0.77, 0.98, -0.13, 0.13); box('dUnder', at(0.0), at(0.12), 0.7, 1.05, -0.2, 0.2);
    box('dUnder', at(0.38), at(0.5), 1.62, 1.72, -1.5, 1.5); // anticlimber
    // MU / air hoses
    for (const z of [-0.85, -0.55, 0.55, 0.85]) gb.add('dUnder', new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6), M(dx(at(0.36)), 1.05, z, 0.3 * sg, 0, 0));
    // corner steps
    for (const s of [-1, 1]) {
      for (const y of [0.42, 0.82, 1.22]) { box('dUnder', at(0.66), at(1.3), y, y + 0.05, s * 1.25, s * 1.56); box('dSafety', at(0.66), at(1.3), y + 0.04, y + 0.06, s * 1.535, s * 1.565); }
      box('dUnder', at(0.66), at(0.7), 0.35, 1.66, s * 1.25, s * 1.57); box('dUnder', at(1.26), at(1.3), 0.35, 1.66, s * 1.25, s * 1.57);
      gb.add('dCream', new THREE.CylinderGeometry(0.02, 0.02, 1.1, 6), M(dx(at(0.68)), 2.2, s * 1.52));
    }
    // end handrail across the platform
    gb.add('dCream', new THREE.CylinderGeometry(0.022, 0.022, 3.0, 6).rotateX(Math.PI / 2), M(dx(at(0.66)), 2.75, 0));
    gb.add('dCream', new THREE.CylinderGeometry(0.022, 0.022, 3.0, 6).rotateX(Math.PI / 2), M(dx(at(0.66)), 2.25, 0));
    for (const z of [-1.5, -0.5, 0.5, 1.5]) gb.add('dCream', new THREE.CylinderGeometry(0.022, 0.022, 1.08, 6), M(dx(at(0.66)), 2.22, z));
  }
  // ditch lights on the front pilot
  const ditch = [];
  for (const s of [-1, 1]) {
    gb.add('dUnder', new THREE.CylinderGeometry(0.04, 0.05, 0.42, 8), M(dx(0.56), 1.9, s * 1.28));
    box('dUnder', 0.44, 0.7, 2.06, 2.3, s * 1.17, s * 1.39);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.085, 16), s < 0 ? RMAT.ditchL : RMAT.ditchR); lens.position.set(dx(0.435), 2.18, s * 1.28); lens.rotation.y = Math.PI / 2; body.add(lens);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    halo.position.set(dx(0.4), 2.18, s * 1.28); halo.scale.set(1.3, 1.3, 1); body.add(halo);
    ditch.push({ lens, halo });
  }
  /* ---- short hood (nose) ---- */
  {
    const sh = new THREE.Shape();
    sh.moveTo(dx(1.0), D); sh.lineTo(dx(1.0), 2.52); sh.lineTo(dx(1.3), 2.98); sh.lineTo(dx(2.5), 3.06); sh.lineTo(dx(2.5), D); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 2.3, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 });
    g.translate(0, 0, -1.15); gb.add('dGreen', g);
    // nose door, number and herald
    box('dUnder', 1.12, 2.2, 1.85, 2.85, -1.212, -1.205);
    gb.add('dNum', new THREE.PlaneGeometry(0.95, 0.42), M(dx(0.94), 2.15, 0, 0, Math.PI / 2, 0));
  }
  // headlights on the nose
  const hlY = 2.84;
  box('dUnder', 1.08, 1.32, hlY - 0.16, hlY + 0.16, -0.42, 0.42);
  const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.22), RMAT.lens); lens.position.set(dx(1.075), hlY, 0); lens.rotation.y = Math.PI / 2; body.add(lens);
  /* ---- cab (walls with real openings so the cab view sees out) ---- */
  const cA0 = 2.5, cA1 = 5.4, roofY = 4.5, hw = 1.54;
  {
    // front wall in (z,y)
    const f = new THREE.Shape(); f.moveTo(-hw, 3.0); f.lineTo(hw, 3.0); f.lineTo(hw, roofY); f.lineTo(-hw, roofY); f.closePath();
    for (const s of [-1, 1]) { const h = new THREE.Path(); const z0 = s * 0.1, z1 = s * 1.4; h.moveTo(Math.min(z0, z1), 3.12); h.lineTo(Math.max(z0, z1), 3.12); h.lineTo(Math.max(z0, z1), 4.24); h.lineTo(Math.min(z0, z1), 4.24); h.closePath(); f.holes.push(h); }
    const g = new THREE.ExtrudeGeometry(f, { depth: 0.07, bevelEnabled: false }); g.rotateY(Math.PI / 2); g.translate(dx(cA0) - 0.035, 0, 0); gb.add('dGreen', g);
    for (const s of [-1, 1]) gb.add('glassT', new THREE.PlaneGeometry(1.3, 1.12), M(dx(cA0) + 0.01, 3.68, s * 0.75, 0, Math.PI / 2, 0));
    box('dUnder', cA0 - 0.12, cA0 - 0.02, 4.26, 4.31, -1.45, 1.45); // visor strip
    for (const s of [-1, 1]) gb.add('dUnder', new THREE.BoxGeometry(0.015, 0.012, 0.85), M(dx(cA0) + 0.05, 3.17, s * 0.78)); // parked wipers
    // side walls in (x,y)
    for (const s of [-1, 1]) {
      const sw = new THREE.Shape(); sw.moveTo(dx(cA1), D); sw.lineTo(dx(cA0), D); sw.lineTo(dx(cA0), roofY); sw.lineTo(dx(cA1), roofY); sw.closePath();
      for (const [a0, a1] of [[2.68, 3.68], [3.86, 5.0]]) { const h = new THREE.Path(); h.moveTo(dx(a1), 3.2); h.lineTo(dx(a0), 3.2); h.lineTo(dx(a0), 4.18); h.lineTo(dx(a1), 4.18); h.closePath(); sw.holes.push(h); }
      const g2 = new THREE.ExtrudeGeometry(sw, { depth: 0.06, bevelEnabled: false }); g2.translate(0, 0, s * hw - 0.03); gb.add('dGreen', g2);
      for (const [a0, a1] of [[2.68, 3.68], [3.86, 5.0]]) gb.add('glassT', new THREE.PlaneGeometry(a1 - a0, 0.98), M(dx((a0 + a1) / 2), 3.69, s * (hw + 0.005)));
      box('dUnder', 3.7, 3.84, 3.2, 4.18, s * (hw - 0.02), s * (hw + 0.03)); // window post
      gb.add('dNum', new THREE.PlaneGeometry(1.1, 0.52), M(dx(3.95), 2.55, s * (hw + 0.04), 0, s > 0 ? 0 : Math.PI, 0));
      gb.add('dCream', new THREE.CylinderGeometry(0.02, 0.02, 1.2, 6), M(dx(5.25), 2.6, s * (hw + 0.06))); // grab
    }
    box('dGreen', cA1 - 0.06, cA1, D, roofY, -hw, hw); // back wall
    // roof with drip rail, AC unit, horn, antennas, number boards
    box('dGreen', cA0 - 0.18, cA1 + 0.05, roofY, roofY + 0.1, -hw - 0.05, hw + 0.05);
    box('dUnder', cA0 - 0.18, cA1 + 0.05, roofY - 0.02, roofY + 0.01, -hw - 0.07, hw + 0.07);
    box('dGreen', 4.3, 5.3, roofY + 0.1, roofY + 0.38, -0.65, 0.65);
    box('grille', 4.35, 5.25, roofY + 0.38, roofY + 0.4, -0.6, 0.6);
    for (const [L, r, s, z] of [[0.55, 0.075, 1, -0.16], [0.42, 0.065, 1, 0], [0.34, 0.055, 1, 0.16], [0.48, 0.07, -1, -0.08], [0.38, 0.06, -1, 0.08]]) {
      const g3 = new THREE.CylinderGeometry(r, 0.03, L, 12, 1, true).rotateZ(s * -Math.PI / 2); g3.translate(dx(3.6) + s * L / 2, roofY + 0.33, z); gb.add('dUnder', g3);
    }
    box('dUnder', 3.45, 3.75, roofY + 0.1, roofY + 0.3, -0.24, 0.24);
    for (const z of [-0.9, 0.95]) gb.add('dUnder', new THREE.CylinderGeometry(0.015, 0.03, 0.55, 6), M(dx(4.0), roofY + 0.38, z));
    for (const s of [-1, 1]) { box('dUnder', cA0 - 0.16, cA0 + 0.06, roofY - 0.18, roofY + 0.06, s * 0.62, s * 1.32); gb.add('numLit', new THREE.PlaneGeometry(0.68, 0.22), M(dx(cA0 - 0.17), roofY - 0.06, s * 0.97, 0, Math.PI / 2, 0)); }
    // interior: floor, desks, screens, seats
    box('dInt', cA0 + 0.05, cA1 - 0.08, D + 0.02, D + 0.05, -hw + 0.05, hw - 0.05);
    box('dDesk', cA0 + 0.1, cA0 + 0.7, D, 2.62, 0.15, 1.45);
    box('dDesk', cA0 + 0.1, cA0 + 0.6, D, 2.62, -1.45, -0.25);
    gb.add('screen', new THREE.PlaneGeometry(0.34, 0.2), M(dx(cA0 + 0.42), 2.74, 1.05, 0, -Math.PI / 2, 0).multiply(M(0, 0, 0, -0.75, 0, 0)));
    gb.add('screen', new THREE.PlaneGeometry(0.34, 0.2), M(dx(cA0 + 0.42), 2.74, 0.6, 0, -Math.PI / 2, 0).multiply(M(0, 0, 0, -0.75, 0, 0)));
    box('dDesk', cA0 + 0.32, cA0 + 0.52, 2.62, 2.66, 0.4, 1.25);
    for (const s of [-1, 1]) { box('dDesk', 3.75, 4.3, D, 2.35, s * 0.55, s * 1.15); box('dDesk', 4.2, 4.35, 2.35, 3.25, s * 0.55, s * 1.15); }
    box('dSafety', cA0 + 0.62, cA0 + 0.74, 2.62, 2.76, 1.2, 1.28); // automatic brake handle
    box('dUnder', cA0 + 0.62, cA0 + 0.72, 2.62, 2.74, 0.3, 0.36);   // throttle
  }
  /* ---- long hood ---- */
  const hz = 1.12;
  box('dGreen', 5.4, 7.8, D, 4.22, -hz, hz);              // electrical cabinet
  box('dGreen', 7.8, 10.4, D, 4.22, -hz, hz);             // dynamic brake
  box('dGreen', 7.95, 10.25, 4.22, 4.44, -1.0, 1.0);
  for (const s of [-1, 1]) box('grille', 8.1, 10.1, 4.24, 4.42, s * 1.0, s * 1.005);
  box('grille', 8.1, 10.1, 4.44, 4.45, -0.9, 0.9);
  box('dGreen', 10.4, 17.0, D, 4.12, -hz, hz);            // engine room
  box('dUnder', 12.0, 12.95, 4.12, 4.36, -0.32, 0.32);    // exhaust stack
  box('dUnder', 12.08, 12.87, 4.36, 4.38, -0.26, 0.26);
  box('dGreen', 17.0, 21.4, D, 3.35, -hz, hz);            // radiator section
  box('dGreen', 17.0, 21.4, 3.35, 4.36, -1.5, 1.5);
  for (const s of [-1, 1]) {
    gb.add('dGreen', new THREE.BoxGeometry(4.4, 0.42, 0.06), M(dx(19.2), 3.2, s * 1.3, s * 0.7, 0, 0)); // flare
    box('grille', 17.2, 21.2, 3.45, 4.2, s * 1.5, s * 1.505);
    // hood doors, latches
    for (let a = 5.7; a < 16.9; a += 1.12) { box('dUnder', a, a + 0.03, 1.9, 3.95, s * (hz - 0.002), s * (hz + 0.006)); box('dUnder', a + 0.45, a + 0.6, 2.85, 2.9, s * hz, s * (hz + 0.02)); }
    box('grille', 10.6, 12.2, 3.2, 3.95, s * hz, s * (hz + 0.004));   // engine air intake
    gb.add('dRoad', new THREE.PlaneGeometry(9.4, 1.18), M(dx(13.2), 2.95, s * (hz + 0.012), 0, s > 0 ? 0 : Math.PI, 0));
    gb.add('dHerald', new THREE.PlaneGeometry(0.95, 0.95), M(dx(6.6), 3.0, s * (hz + 0.012), 0, s > 0 ? 0 : Math.PI, 0));
    // side handrail and stanchions
    gb.add('dCream', new THREE.CylinderGeometry(0.022, 0.022, 16.5, 6).rotateZ(Math.PI / 2), M(dx(13.65), 2.75, s * 1.52));
    gb.add('dCream', new THREE.CylinderGeometry(0.022, 0.022, 1.9, 6).rotateZ(Math.PI / 2), M(dx(1.65), 2.75, s * 1.52));
    for (let a = 5.5; a < 21.9; a += 1.64) gb.add('dCream', new THREE.CylinderGeometry(0.02, 0.02, 1.05, 6), M(dx(a), 2.22, s * 1.52));
  }
  for (const a of [17.75, 19.2, 20.65]) { gb.add('dUnder', new THREE.CylinderGeometry(0.66, 0.66, 0.12, 24), M(dx(a), 4.42, 0)); gb.add('fan', new THREE.CircleGeometry(0.6, 24), M(dx(a), 4.485, 0, -Math.PI / 2, 0, 0)); }
  box('dUnder', 21.38, 21.42, D, 4.36, -1.5, 1.5);
  // rear headlight & number board
  box('dUnder', 21.4, 21.55, 3.75, 4.05, -0.3, 0.3);
  gb.add('lensOff', new THREE.PlaneGeometry(0.5, 0.18), M(dx(21.56), 3.9, 0, 0, -Math.PI / 2, 0));
  gb.add('numLit', new THREE.PlaneGeometry(0.62, 0.22), M(dx(21.43), 3.45, 0, 0, -Math.PI / 2, 0));
  /* ---- fuel tank, reservoirs ---- */
  {
    const t = new THREE.Shape(); const w = 1.36, y0 = 0.5, y1 = 1.16, r = 0.22;
    t.moveTo(-w, y1); t.lineTo(-w, y0 + r); t.quadraticCurveTo(-w, y0, -w + r, y0); t.lineTo(w - r, y0); t.quadraticCurveTo(w, y0, w, y0 + r); t.lineTo(w, y1); t.closePath();
    const g = new THREE.ExtrudeGeometry(t, { depth: 8.0, bevelEnabled: false, curveSegments: 6 }); g.rotateY(Math.PI / 2); g.translate(dx(15.3), 0, 0);
    gb.add('dUnder', g);
    for (const s of [-1, 1]) { gb.add('dCream', new THREE.CylinderGeometry(0.09, 0.09, 0.06, 12).rotateX(Math.PI / 2), M(dx(9.4), 0.98, s * 1.38)); box('white', 13.0, 13.25, 0.75, 1.0, s * 1.37, s * 1.375); }
  }
  const statics = gb.build({ ...RMAT });
  body.add(statics);
  // headlight beam & halo (same treatment as the steam engine)
  const beamG = new THREE.ConeGeometry(7, 70, 24, 1, true); beamG.translate(0, -35, 0); beamG.rotateZ(Math.PI / 2);
  const beam = new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: true }));
  beam.position.set(dx(1.07), hlY, 0); beam.rotation.z = -0.03; body.add(beam);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  halo.position.set(dx(1.03), hlY, 0); halo.scale.set(2.2, 2.2, 1); body.add(halo);
  /* ---- trucks (swivel; placed by the train each frame) ---- */
  const trucks = [], wheels = [];
  const ax = plainAxle(DG.rW);
  for (let t = 0; t < 2; t++) {
    const grp = new THREE.Group(), tg = new GeoBin();
    for (const s of [-1, 1]) {
      tg.box('dUnder', 5.0, 0.34, 0.2, 0, 0.66, s * 1.06);
      tg.box('dUnder', 4.2, 0.16, 0.16, 0, 0.92, s * 1.06);
      for (const x of [-DG.axle, 0, DG.axle]) {
        tg.box('dUnder', 0.44, 0.48, 0.3, x, DG.rW, s * 1.06);
        tg.add('dUnder', new THREE.CylinderGeometry(0.1, 0.1, 0.3, 10), M(x - 0.32, 0.92, s * 1.06));
        tg.add('dUnder', new THREE.CylinderGeometry(0.1, 0.1, 0.3, 10), M(x + 0.32, 0.92, s * 1.06));
        tg.box('dSafety', 0.46, 0.03, 0.31, x, DG.rW + 0.25, s * 1.06);
      }
      tg.add('dUnder', new THREE.CylinderGeometry(0.12, 0.12, 0.38, 10).rotateZ(Math.PI / 2), M(-1.04, 0.86, s * 1.12));
      tg.add('dUnder', new THREE.CylinderGeometry(0.12, 0.12, 0.38, 10).rotateZ(Math.PI / 2), M(1.04, 0.86, s * 1.12));
      tg.box('dUnder', 0.5, 0.42, 0.3, s * 2.55, 0.86, 1.0 * s);  // sand boxes
    }
    for (const x of [-DG.axle, 0, DG.axle]) tg.add('dUnder', new THREE.CylinderGeometry(0.36, 0.36, 0.98, 14).rotateX(Math.PI / 2), M(x + (x > 0 ? -0.62 : 0.62) * (x === 0 ? -1 : 1), 0.52, 0));
    tg.box('dUnder', 0.7, 0.24, 2.2, 0, 1.0, 0); // bolster
    grp.add(tg.build(RMAT));
    for (const x of [-DG.axle, 0, DG.axle]) {
      const wg = new THREE.Group(); wg.position.set(x, DG.rW, 0);
      wg.add(new THREE.Mesh(ax.black, RMAT.black), new THREE.Mesh(ax.tire, RMAT.tire));
      grp.add(wg); wheels.push(wg);
    }
    grp.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    trucks.push(grp);
  }
  const hit = new THREE.Mesh(new THREE.BoxGeometry(22, 4.6, 3.2), RMAT.hit); hit.position.set(0, 2.4, 0); body.add(hit);
  root.traverse(o => { if (o.isMesh && o.material !== RMAT.glassT && o.material !== RMAT.hit) { o.castShadow = true; o.receiveShadow = true; } });
  beam.castShadow = false;
  return {
    root, body, trucks, wheels, lens, beam, halo, ditch, spec, diesel: true, len: DG.len, frame: DG.trucks.slice(),
    stackPos: new THREE.Vector3(dx(12.5), 4.4, 0), hornPos: new THREE.Vector3(dx(3.6), 4.85, 0), enginePos: new THREE.Vector3(dx(13.5), 2.8, 0),
    cabEye: new THREE.Vector3(dx(3.5), 3.62, 0.8), headlightPos: new THREE.Vector3(dx(1.07), hlY, 0), cabLightPos: new THREE.Vector3(dx(4.0), 4.35, 0),
  };
}
let _haloTex = null;
function haloTex() {
  return _haloTex || (_haloTex = canvasTex(64, 64, g => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,248,225,1)'); gr.addColorStop(0.25, 'rgba(255,236,190,0.55)'); gr.addColorStop(1, 'rgba(255,220,160,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }));
}

/* ============================================================================
   What a wreck looks and sounds like beyond the dirt (10h_dig.js): sparks where steel scrapes on steel or
   on the ballast, the screech and crunch of it, car bodies dented and crumpled where they hit, coal and stone
   spilling from cars that go over, and a wrecked steam engine venting its boiler in a roaring white cloud.
   The physics (07d_wreck.js) says where steel scraped and where bodies hit; this turns that into effects.
   A dented car gets its own copy of the geometry it shared with the others, given back when it is re-railed.
   ========================================================================== */
const WFX = { crunchT: 0, hiss: null, scr: null };
const _wxa = new THREE.Vector3(), _wxb = new THREE.Vector3(), _wxc = new THREE.Vector3(), _wxm = new THREE.Matrix4(), _wxq = new THREE.Quaternion();

/* called by WreckSim.step after each frame of physics: sparks from the steel scraping this frame, and the screech */
function wfxWreck(R, dt) {
  if (!(dt > 0)) return;
  try {
    const cam = typeof camera !== 'undefined' ? camera : null, cp = cam ? cam.position : null;
    let loud = 0, at = null;
    for (let i = 0; i < (R.nSpk || 0); i++) {
      const o = R.spk[i], d = cp ? o.P.distanceTo(cp) : 0;
      const k = Math.min(1, o.sp / 12);
      if (k / (1 + d / 40) > loud) { loud = k / (1 + d / 40); at = o.P; }
      if (!SPK.lines || d > 220) continue;
      // a shower thrown along the way it is sliding, thickest close to the camera
      const h = _wxa.set(o.v.x, 0, o.v.z), hs = h.length(); if (hs < 0.1) continue;
      h.multiplyScalar(1 / hs); const side = _wxb.set(-h.z, 0, h.x);
      let n = Math.floor(dt * 260 * k / (1 + (d / 45) ** 2) + Math.random());
      while (n-- > 0) sparkEmit(o.P, h, side, o.sp);
    }
    // the screech of steel dragged along: the brake squeal pitched down to a grind
    if (AU.on && typeof Loop === 'function') {
      if (!WFX.scr && SND.has('squeal')) WFX.scr = new Loop('squeal', AU.world);
      if (WFX.scr) WFX.scr.set(0.5 * Math.min(1, loud * 1.4) * (SND_GAIN.squeal || 1), 0.62 + 0.25 * loud, loud > WFX.scrL ? 0.04 : 0.25);
      WFX.scrL = loud;
    }
    // metal crunching where cars slam into each other: the hardest new dent this frame
    WFX.crunchT -= dt;
    if (AU.on && WFX.crunchT <= 0) {
      let hard = 0, P = null;
      for (const b of R.bodies) if (b.dents) for (const o of b.dents) if (!o.heard) { o.heard = true; if (o.d > hard) { hard = o.d; P = b.p; } }
      if (P) { const d = cp ? P.distanceTo(cp) : 30; sndClunk(clamp(hard * 5, 0.5, 1.6) / (1 + (d / 35) ** 1.2), 0); sndClunk(clamp(hard * 3, 0.3, 1.2) / (1 + (d / 35) ** 1.2), 0.05 + Math.random() * 0.06); WFX.crunchT = 0.07; }
    }
  } catch (e) { console.warn('wreckfx', e); }
}

/* every frame while a wreck is on the ground: dents pressed into the bodies, spilled loads, the boiler venting */
function wfxFrame(dt, T) {
  const R = T && T.rb;
  if (!R) { wfxQuiet(); return; }
  if (!(dt > 0)) return;
  try {
    R.fxT = (R.fxT || 0) + dt;
    const steam = !T.diesel && !T.elec && !T.turb;
    let vent = 0;
    for (const b of R.bodies) {
      if (!b.v) continue;
      if (b.dents && b.dents.some(o => !o.done)) wfxDent(b);
      const kind = b.v.kind;
      // a hopper's coal or a gondola's stone pours out over the side once the car is on its side
      if ((kind === 'hopper' || kind === 'gon') && b.ax[1].y < 0.55 && typeof digEmit === 'function' && DIG.clods) {
        if (b.spill === undefined) b.spill = Math.round(140 * (DIG.q || 1));
        const rate = Math.min(b.spill, Math.floor(dt * 90 + Math.random()));
        const down = _wxc.set(b.ax[1].x, 0, b.ax[1].z).normalize();   // the open top faces this way along the ground
        for (let i = 0; i < rate; i++) {
          b.spill--;
          const u = (Math.random() * 2 - 1) * b.h.x * 0.85;
          _wxa.set(b.c.x + u, b.c.y + b.h.y * 0.95, b.c.z + (Math.random() - 0.5) * b.h.z * 1.6).applyMatrix4(b.W);
          const coal = kind === 'hopper', sh = coal ? 0.07 + 0.05 * Math.random() : 0.4 + 0.12 * Math.random();
          digEmit(DIG.clods, _wxa.x, _wxa.y, _wxa.z, down.x * (1 + 2.5 * Math.random()) + b.lv.x * 0.6, 0.5 + Math.random(), down.z * (1 + 2.5 * Math.random()) + b.lv.z * 0.6,
            0.14 + 0.16 * Math.random(), 300 + 200 * Math.random(), sh, sh * (coal ? 1 : 0.97), sh * (coal ? 1.08 : 0.92), _wxa.y - 3, [R, b]);
        }
      }
      // a steam engine torn off its wheels breaks its steam pipes: the boiler vents with a roar, dying away over a minute
      if (steam && kind === 'loco' && !b.v.helper) {
        vent = Math.exp(-R.fxT / 22) * Math.min(1, R.fxT * 3);
        const cam = typeof camera !== 'undefined' ? camera : null;
        if (cam && b.p.distanceTo(cam.position) > 900) continue;
        let n = Math.floor(dt * 70 * vent + Math.random());
        while (n-- > 0) {
          const u = Math.random() * 2 - 1;
          _wxa.set(b.c.x + u * b.h.x * 0.6, b.c.y + b.h.y * (0.2 + 0.4 * Math.random()), b.c.z + (Math.random() - 0.5) * b.h.z).applyMatrix4(b.W);
          _wxb.set((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6).addScaledVector(b.ax[1], 3 + 7 * vent * Math.random());
          emit(_wxa, _wxb, 2.5 + 3 * Math.random(), 1.2, 6 + 8 * vent, 0.5 + 0.35 * vent, [0.96, 0.96, 0.98], 0.7, 1.3);
        }
      }
    }
    if (AU.on && typeof Loop === 'function') {
      if (!WFX.hiss && vent > 0.02 && SND.has('safety')) WFX.hiss = new Loop('safety', AU.world);
      if (WFX.hiss) {
        const lead = T.lead && T.lead.rb, d = lead && camera ? lead.p.distanceTo(camera.position) : 40;
        WFX.hiss.set(vent * 0.9 * (SND_GAIN.safety || 1) / (1 + (d / 40) ** 1.3), 0.85 + 0.15 * vent, 0.3);
      }
    }
    if (WFX.scr && R.asleep) WFX.scr.set(0, WFX.scr.rate, 0.3);
  } catch (e) { console.warn('wreckfx', e); }
}
function wfxQuiet() {
  if (WFX.hiss) { WFX.hiss.kill(); WFX.hiss = null; }
  if (WFX.scr) { WFX.scr.kill(); WFX.scr = null; }
}

/* the body meshes of a car (not its lamps' glows or beams), each given its own geometry the first time it is dented */
function wfxMeshes(v) {
  const out = [];
  v.root.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.geometry && o.geometry.attributes.position && !(o.material && o.material.transparent)) out.push(o); });
  return out;
}
/* press car b's new dents into its body: every vertex near a dent pushed in along it, most at the centre, a little
   unevenly so it crumples rather than dishes; faces moved get their normals again */
function wfxDent(b) {
  const v = b.v; v.root.updateMatrixWorld(true);
  const inv = _wxm.copy(v.root.matrixWorld).invert();
  const todo = b.dents.filter(o => !o.done);
  for (const o of todo) o.done = true;
  for (const m of wfxMeshes(v)) {
    const rel = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld), ir = rel.clone().invert();
    const geo = m.geometry;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    const bs = geo.boundingSphere, c = _wxa.copy(bs.center).applyMatrix4(rel);
    const hits = todo.map(o => {
      const R = 0.9 + o.d * 3;
      if (c.distanceTo(o.p) > bs.radius + R) return null;
      return { p: o.p.clone().applyMatrix4(ir), n: o.n.clone().transformDirection(ir), d: o.d - (o.pressed || 0), R };
    }).filter(Boolean);
    if (!hits.length) continue;
    if (!m.userData.wfxG0) { m.userData.wfxG0 = m.geometry; m.geometry = m.geometry.clone(); (b.dented || (b.dented = [])).push(m); }
    const g = m.geometry, pos = g.attributes.position, a = pos.array, N = pos.count;
    const moved = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const x = a[i * 3], y = a[i * 3 + 1], z = a[i * 3 + 2];
      for (const h of hits) {
        const dx = x - h.p.x, dy = y - h.p.y, dz = z - h.p.z, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= h.R * h.R) continue;
        const w = (1 - d2 / (h.R * h.R)) ** 2, ru = 0.7 + 0.3 * Math.sin(x * 7.1 + y * 5.3 + z * 6.7);
        const s = h.d * w * ru;
        a[i * 3] += h.n.x * s; a[i * 3 + 1] += h.n.y * s; a[i * 3 + 2] += h.n.z * s; moved[i] = 1;
      }
    }
    pos.needsUpdate = true;
    if (!g.index && g.attributes.normal) {
      const nr = g.attributes.normal.array;
      for (let t = 0; t + 2 < N; t += 3) {
        if (!moved[t] && !moved[t + 1] && !moved[t + 2]) continue;
        _wxa.set(a[t * 3 + 3] - a[t * 3], a[t * 3 + 4] - a[t * 3 + 1], a[t * 3 + 5] - a[t * 3 + 2]);
        _wxb.set(a[t * 3 + 6] - a[t * 3], a[t * 3 + 7] - a[t * 3 + 1], a[t * 3 + 8] - a[t * 3 + 2]);
        _wxc.crossVectors(_wxa, _wxb).normalize();
        for (let q = 0; q < 3; q++) { nr[(t + q) * 3] = _wxc.x; nr[(t + q) * 3 + 1] = _wxc.y; nr[(t + q) * 3 + 2] = _wxc.z; }
      }
      g.attributes.normal.needsUpdate = true;
    } else if (g.attributes.normal) g.computeVertexNormals();
    g.computeBoundingSphere();
  }
  for (const o of todo) o.pressed = o.d;
}

/* put a re-railed (or departing) train's cars back the way they were: shared geometry back, the dented copies freed */
function wfxRestore(T) {
  const R = T && T.rb; if (!R) return;
  for (const b of R.bodies) if (b.dented) {
    for (const m of b.dented) { const g0 = m.userData.wfxG0; if (!g0) continue; m.geometry.dispose(); m.geometry = g0; delete m.userData.wfxG0; }
    b.dented = null;
  }
  if (T === GAME.train) wfxQuiet();
}

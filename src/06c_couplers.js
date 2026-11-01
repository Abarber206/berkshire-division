/* ============================================================================
   Knuckle couplers: AAR Type E heads with a knuckle that swings on its pin,
   the cut lever across the end sill, and the brake pipe's angle cock with its
   air hose and glad hand. The castings are merged into the car body; the
   knuckle, the cut lever and the two hose poses are separate meshes so they
   can move, and are only drawn near the camera.
   Coupler frame: +X out from the car, X = 0 on the line where two mated
   couplers meet, Y up from rail top, Z across. The knuckle and the hose sit
   on +Z, the left-hand side seen from off the end of the car, so two cars
   meeting end to end interlock knuckle behind knuckle.
   ========================================================================== */
const CPL = { near: 90, geo: null, kits: {}, hover: null };
const CPL_Y = 0.876;                 // 34-1/2 in centre line above the rail
const CPL_PIN = [-0.12, 0.072];      // knuckle pin (x, z)
const CPL_OPEN = -0.8;               // knuckle swing when thrown open (rad)
const CPL_LIFT = 0.55;               // cut lever turned up to lift the lock (rad)

/* a closed outline through pts with every corner rounded off by up to r */
function roundShape(pts, r) {
  const s = new THREE.Shape(), n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const ra = Math.min(r, la * 0.45), rb = Math.min(r, lb * 0.45);
    const p0 = [p[0] + (a[0] - p[0]) / la * ra, p[1] + (a[1] - p[1]) / la * ra], p1 = [p[0] + (b[0] - p[0]) / lb * rb, p[1] + (b[1] - p[1]) / lb * rb];
    if (i === 0) s.moveTo(p0[0], p0[1]); else s.lineTo(p0[0], p0[1]);
    s.quadraticCurveTo(p[0], p[1], p1[0], p1[1]);
  }
  s.closePath();
  return s;
}
/* a casting with plan outline pts (x, z), h tall centred on y0, edges rounded by bev (the outline grows by bev) */
function castPlan(pts, r, h, y0, bev = 0.008) {
  const g = new THREE.ExtrudeGeometry(roundShape(pts, r), { depth: h - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 4 });
  g.rotateX(Math.PI / 2);   // shape (x, z) at depth d lands at (x, -d, z)
  g.translate(0, y0 + h / 2 - bev, 0);
  return g;
}
/* a casting with side profile pts (x, y), w wide centred on z0 */
function castSide(pts, r, w, z0, bev = 0.008) {
  const g = new THREE.ExtrudeGeometry(roundShape(pts, r), { depth: w - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, z0 - w / 2 + bev);
  return g;
}
/* a round bar or pipe from a to b */
const tubeGeo = (pts, r, seg = 24, rs = 8) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), seg, r, rs, false);

function couplerMaterials() {
  if (RMAT.hose) return;
  RMAT.hose = new THREE.MeshStandardMaterial({ color: 0x121212, metalness: 0.0, roughness: 0.88 });
  RMAT.cplHi = new THREE.MeshStandardMaterial({ color: 0x3a3226, metalness: 0.5, roughness: 0.5, emissive: 0xffb347, emissiveIntensity: 0.55 });
}

/* the parts every coupler shares: the head and guard arm, the knuckle, pin and lock lift */
function couplerGeos() {
  if (CPL.geo) return CPL.geo;
  couplerMaterials();
  const y = CPL_Y, [px, pz] = CPL_PIN, head = [];
  // head with the guard arm reaching forward on the right; the mate's knuckle lies in the pocket inside it
  head.push(castPlan([[-0.33, 0.07], [-0.25, 0.124], [-0.098, 0.124], [-0.092, 0.036], [-0.092, -0.126], [0.028, -0.13], [0.06, -0.142], [0.05, -0.168], [-0.12, -0.172], [-0.25, -0.142], [-0.33, -0.07]], 0.028, 0.29, y));
  // neck tapering from the head down into the shank
  head.push(castSide([[-0.41, -0.07], [-0.34, -0.14], [-0.27, -0.14], [-0.27, 0.14], [-0.34, 0.14], [-0.41, 0.07]], 0.03, 0.15, 0).translate(0, y, 0));
  // pin lugs top and bottom, the knuckle pin, and the lock lift on top of the head
  for (const s of [-1, 1]) {
    head.push(new THREE.CylinderGeometry(0.046, 0.05, 0.04, 14).translate(px, y + s * 0.152, pz));
    head.push(new THREE.CylinderGeometry(0.026, 0.026, 0.02, 10).translate(px, y + s * 0.18, pz));
  }
  head.push(castPlan([[-0.2, -0.035], [-0.13, -0.035], [-0.13, 0.02], [-0.2, 0.02]], 0.012, 0.05, y + 0.168, 0.006));
  head.push(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 8).rotateX(Math.PI / 2).translate(-0.165, y + 0.19, -0.008));
  // cast ribs along the sides of the head
  head.push(castPlan([[-0.31, -0.152], [-0.13, -0.18], [-0.13, -0.166], [-0.31, -0.14]], 0.006, 0.05, y, 0.004));
  // knuckle, about its own pin: tail in the head, then the arm out to the hooked nose. Pulling face on the inside of the nose.
  const kn = castPlan([[-0.166, 0.062], [-0.142, 0.106], [-0.09, 0.108], [0.048, 0.104], [0.07, 0.084], [0.072, -0.004], [0.058, -0.022], [0.024, -0.022], [0.014, -0.008], [0.014, 0.036], [-0.086, 0.04], [-0.134, 0.04], [-0.162, 0.048]]
    .map(([x, z]) => [x - px, z - pz]), 0.02, 0.26, y, 0.005);
  const knuckle = mergeGeos([kn, castPlan([[0.03, -0.022], [0.07, -0.004], [0.07, 0.07], [0.03, 0.07]].map(([x, z]) => [x - px, z - pz]), 0.012, 0.28, y, 0.005)]);
  return (CPL.geo = { head, knuckle });
}

/* everything that depends on the end it is fitted to, cached by its dimensions:
   sx end sill face (coupler frame x), sb bottom of the sill, ly cut lever height, zh how far out the lever handle reaches,
   yp brake pipe height, housing whether to draw the draft gear pocket under the sill */
function couplerKit(o) {
  const key = [o.sx, o.sb, o.ly, o.zh, o.yp, !!o.housing, o.hl].join();
  if (CPL.kits[key]) return CPL.kits[key];
  const G = couplerGeos(), y = CPL_Y, sx = o.sx, dark = G.head.map(g => g.clone());
  // shank back through the striker into the draft gear
  dark.push(castSide([[sx - 0.16, -0.07], [-0.4, -0.07], [-0.4, 0.07], [sx - 0.16, 0.07]], 0.02, 0.15, 0).translate(0, y, 0));
  // striker casting on the end sill: cheeks, a top bar up into the sill, and the carrier iron the shank rides on
  const top = Math.max(y + 0.12, o.sb + 0.03);
  for (const s of [-1, 1]) dark.push(castPlan([[sx - 0.01, s * 0.088], [sx + 0.07, s * 0.088], [sx + 0.07, s * 0.2], [sx - 0.01, s * 0.2]], 0.015, top - (y - 0.15), (top + y - 0.15) / 2, 0.006));
  dark.push(castPlan([[sx - 0.01, -0.09], [sx + 0.07, -0.09], [sx + 0.07, 0.09], [sx - 0.01, 0.09]], 0.012, top - (y + 0.078), (top + y + 0.078) / 2, 0.006));
  dark.push(castPlan([[sx - 0.01, -0.09], [sx + 0.075, -0.09], [sx + 0.075, 0.09], [sx - 0.01, 0.09]], 0.012, 0.072, y - 0.114, 0.006));
  const hl = o.hl || 0.42, ht = o.sb + 0.03;
  if (o.housing) dark.push(new THREE.BoxGeometry(hl, ht - (y - 0.12), 0.34).translate(sx - hl / 2, (ht + y - 0.12) / 2, 0));
  // cut lever brackets: a strap off the sill face with an eye round the rod
  const xr = sx + 0.04, ly = o.ly;
  for (const z of [0.5, o.zh - 0.12]) {
    dark.push(new THREE.BoxGeometry(0.05, 0.03, 0.026).translate(sx + 0.02, ly, z));
    dark.push(new THREE.TorusGeometry(0.022, 0.008, 6, 12).translate(xr, ly, z));
  }
  // brake pipe from under the sill to the angle cock, the cock body, its elbow and handle
  const zc = 0.32, yp = o.yp, xc = sx + 0.07;
  dark.push(barGeo(0.021, [sx - 0.38, yp, zc], [xc, yp, zc]));
  dark.push(new THREE.BoxGeometry(0.06, 0.026, 0.03).translate(sx - 0.2, yp + 0.01 + 0.013, zc));   // pipe clamp to the sill
  dark.push(new THREE.CylinderGeometry(0.034, 0.034, 0.09, 10).rotateZ(Math.PI / 2).translate(xc - 0.01, yp, zc));
  dark.push(barGeo(0.026, [xc + 0.03, yp, zc], [xc + 0.06, yp - 0.075, zc], 10));
  dark.push(new THREE.BoxGeometry(0.13, 0.012, 0.026).translate(xc - 0.03, yp + 0.04, zc));
  dark.push(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 6).translate(xc - 0.01, yp + 0.02, zc));
  // the cut lever, about its own rod: rod across the end, handle bent down at the side, crank over the lock lift
  const lx = -0.165 - xr, lyk = y + 0.205 - ly;
  const lever = mergeGeos([
    tubeGeo([[0, 0, -0.03], [0, 0, o.zh - 0.1], [0.004, -0.03, o.zh - 0.02], [0.03, -0.12, o.zh + 0.035], [0.06, -0.2, o.zh + 0.06]], 0.0135, 28, 8),
    new THREE.SphereGeometry(0.02, 10, 8).translate(0.062, -0.205, o.zh + 0.062),
    tubeGeo([[0, 0, -0.03], [lx * 0.4, 0.035, -0.022], [lx * 0.85, lyk + 0.03, -0.012], [lx, lyk + 0.012, -0.008]], 0.012, 16, 8),
    barGeo(0.006, [lx, lyk + 0.012, -0.008], [lx, lyk - 0.012, -0.008], 6),
  ]);
  // the air hose, hanging from the cock or coupled to the next car's at the centre line under the couplers
  const H0 = [xc + 0.062, yp - 0.08, zc];
  const hand = (axisDown) => {
    const parts = [
      new THREE.CylinderGeometry(0.026, 0.028, 0.03, 10),                                       // hose clamp
      new THREE.CylinderGeometry(0.019, 0.022, 0.07, 10).translate(0, -0.05, 0),                  // glad hand body
      castPlan([[-0.045, -0.034], [0.045, -0.034], [0.045, 0.034], [-0.045, 0.034]], 0.022, 0.018, -0.094, 0.004),   // gasket face
      new THREE.BoxGeometry(0.03, 0.05, 0.014).translate(0.03, -0.06, 0.03),                     // locking lug
    ];
    const g = mergeGeos(parts);
    if (!axisDown) g.rotateZ(Math.PI / 2);                                                        // lying along +x toward the mate
    return g;
  };
  const clamp0 = new THREE.CylinderGeometry(0.026, 0.028, 0.035, 10).translate(...H0);
  const hangEnd = [H0[0] + 0.05, 0.42, zc + 0.015];
  const hang = mergeGeos([
    tubeGeo([H0, [H0[0] + 0.02, H0[1] - 0.13, zc + 0.005], [H0[0] + 0.045, 0.56, zc + 0.012], hangEnd], 0.021),
    clamp0, hand(true).translate(...hangEnd),
  ]);
  const mateEnd = [-0.105, 0.5, 0];
  const mid = [(H0[0] + mateEnd[0]) / 2 + 0.03, 0.5, zc * 0.42];
  const mate = mergeGeos([
    tubeGeo([H0, [H0[0] + 0.04, H0[1] - 0.14, zc - 0.02], mid, [mateEnd[0] - 0.05, 0.495, 0.03], mateEnd], 0.021, 32),
    clamp0.clone(), hand(false).translate(...mateEnd),
  ]);
  return (CPL.kits[key] = { dark: mergeGeos(dark), lever, hang, mate, xr });
}

/* Fit a coupler to one end of a model. gb gets the castings; the moving parts go on parent (the group gb is built into).
   o.x is the coupler face in model coordinates and o.out is +1 at the model's front, -1 at its rear. */
function addCoupler(gb, parent, o) {
  const kit = couplerKit(o), G = CPL.geo;
  const m = new THREE.Matrix4().makeTranslation(o.x, 0, 0);
  if (o.out < 0) m.multiply(new THREE.Matrix4().makeRotationY(Math.PI));
  gb.add(o.key || 'dark', kit.dark.clone(), m);
  const grp = new THREE.Group(); grp.matrixAutoUpdate = false; grp.matrix.copy(m); parent.add(grp);
  const kn = new THREE.Mesh(G.knuckle, RMAT.dark); kn.position.set(CPL_PIN[0], 0, CPL_PIN[1]);
  const lever = new THREE.Mesh(kit.lever, RMAT.dark); lever.position.set(kit.xr, o.ly, 0);
  const hang = new THREE.Mesh(kit.hang, RMAT.hose), mate = new THREE.Mesh(kit.mate, RMAT.hose); mate.visible = false;
  for (const p of [kn, lever, hang, mate]) { p.receiveShadow = true; p.userData.cpl = true; grp.add(p); }
  return { grp, kn, lever, hang, mate, ka: 0, la: 0, o };
}
/* both ends of a freight car or coach, whose faces are at +-L/2 */
const carCouplers = (gb, root, L, sx, sb, ly) => [1, -1].map(out => addCoupler(gb, root, { x: out * L / 2, out, sx, sb, ly, zh: 1.3, yp: sb - 0.024, housing: true }));

/* ---------------- every frame: knuckles, levers and hoses follow the cars ---------------- */
function cplConsists() {
  const list = [GAME.train, ...CARS.cuts];
  if (MP.on) for (const p of MP.peers.values()) if (p.rt && p.rt.train) list.push(p.rt.train);
  return list.filter(Boolean);
}
/* the coupler of the vehicle next to V[i] that meets V[i]'s coupler on side front (true) or back */
function cplMate(V, i, front) {
  const nb = V[front ? i - 1 : i + 1];
  return nb && nb.cpl ? nb.cpl[front ? (nb.flip ? 0 : 1) : (nb.flip ? 1 : 0)] : null;
}
CPL.frame = function (dt) {
  const cam = camera.position, a = Math.min(1, dt * 7);
  for (const c of cplConsists()) {
    const V = c.vehicles;
    for (let i = 0; i < V.length; i++) {
      const v = V[i]; if (!v.cpl) continue;
      const near = !!v.pos && v.root.visible !== false && v.pos.distanceTo(cam) < CPL.near + v.len;
      for (let k = 0; k < 2; k++) {
        const e = v.cpl[k]; if (!e) continue;
        if (e.grp.visible !== near) e.grp.visible = near;
        const front = (k === 0) !== !!v.flip, mated = !!cplMate(V, i, front);
        const s = v.kn ? v.kn[k] : 0;
        const kt = !mated && s === KN_OPEN ? CPL_OPEN : 0, lt = s === KN_LIFTED ? CPL_LIFT : 0;
        // out of sight they just take up their new positions; close by they swing over
        if (!near) { e.ka = kt; e.la = lt; e.kn.rotation.y = kt; e.lever.rotation.z = lt; if (e.hang.visible === mated) { e.hang.visible = !mated; e.mate.visible = mated; } continue; }
        e.ka += Math.abs(kt - e.ka) < 0.002 ? kt - e.ka : (kt - e.ka) * a;
        e.la += Math.abs(lt - e.la) < 0.002 ? lt - e.la : (lt - e.la) * Math.min(1, dt * 10);
        e.kn.rotation.y = e.ka; e.lever.rotation.z = e.la;
        if (e.hang.visible === mated) { e.hang.visible = !mated; e.mate.visible = mated; }
      }
    }
  }
};

/* ---------------- working a coupler by pointing at it ---------------- */
const _cp = new THREE.Vector3();
/* the coupler nearest screen point (x, y), within reach of the camera */
CPL.at = function (x, y) {
  if (!GAME.train) return null;
  const W = innerWidth, H = innerHeight, cam = camera.position, reach = 34 * Math.max(1, devicePixelRatio > 1.5 && W < 900 ? 1.3 : 1);
  let best = null, bd = reach * reach;
  for (const c of [GAME.train, ...CARS.cuts]) {
    const V = c.vehicles;
    for (let i = 0; i < V.length; i++) {
      const v = V[i]; if (!v.cpl) continue;
      for (let k = 0; k < 2; k++) {
        const e = v.cpl[k]; if (!e || !e.grp.visible) continue;
        for (const p of [[-0.1, CPL_Y, 0.02], [e.lever.position.x + 0.06, e.o.ly - 0.2, e.o.zh + 0.06]]) {
          _cp.set(...p).applyMatrix4(e.grp.matrixWorld);
          if (_cp.distanceTo(cam) > 60) continue;
          _cp.project(camera); if (_cp.z > 1 || _cp.z < -1) continue;
          const d2 = ((_cp.x + 1) / 2 * W - x) ** 2 + ((1 - _cp.y) / 2 * H - y) ** 2;
          if (d2 < bd) { bd = d2; best = { c, i, k, e }; }
        }
      }
    }
  }
  if (!best) return null;
  const { c, i, k } = best, v = c.vehicles[i], front = (k === 0) !== !!v.flip;
  best.mated = !!cplMate(c.vehicles, i, front);
  if (best.mated) best.j = front ? i : i + 1; else best.end = front ? 'front' : 'rear';
  return best;
};
CPL.label = function (t) {
  if (t.mated) return CARS.canCut(t.c, t.j) ? (Math.abs(velOf(t.c)) > 0.6 ? 'Pull the pin: kick the cars' : 'Pull the pin: uncouple here') : 'Drawbar: these stay together';
  const s = t.c.vehicles[t.i].kn[t.k];
  return s === KN_CLOSED ? 'Lift the pin: open the knuckle' : 'Close the knuckle';
};
CPL.act = function (t) {
  if (t.mated) {
    if (!CARS.canCut(t.c, t.j)) { toast('The engine and its tender (or units of a lashup) stay coupled.', '', 2600, 'nocut'); return; }
    CARS.uncouple(t.j, t.c);
  } else CARS.knuckle(t.c, t.end);
};
/* tap or click: work the coupler under the pointer. Returns true when one was there. */
CPL.tap = function (x, y) {
  const t = CPL.at(x, y); if (!t) return false;
  CPL.act(t); CPL.point(x, y);
  return true;
};
/* mouse hover: light the coupler up and say what a click will do */
CPL.point = function (x, y) {
  const t = x === null ? null : CPL.at(x, y), tip = $('cplTip');
  const prev = CPL.hover;
  if (prev && (!t || prev.e !== t.e)) { prev.e.kn.material = RMAT.dark; prev.e.lever.material = RMAT.dark; }
  CPL.hover = t;
  if (!t) { if (prev) { tip.hidden = true; $('gl').style.cursor = ''; } return; }   // the cab's own hover shares the tip
  $('gl').style.cursor = 'var(--cur-hot, pointer)';
  t.e.kn.material = RMAT.cplHi; t.e.lever.material = RMAT.cplHi;
  tip.textContent = CPL.label(t); tip.hidden = false;
  tip.style.left = Math.min(innerWidth - tip.offsetWidth - 8, x + 14) + 'px'; tip.style.top = Math.max(8, y - 34) + 'px';
};

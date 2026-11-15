/* ==========================================================================
   Light off the trains (through the lamp shader, 10c_lamps.js)

   The train you drive carries the only real lights in the scene (07_train.js). Every other train's
   headlight used to be a glow and a beam in the air with nothing landing on the ground. Here each
   headlight throws its pool down the rails ahead of the engine, and a steam engine's fire shows
   under the ashpan on the ties, the trailing truck and the ballast, as it does at night.
   ========================================================================== */
LAMP_KINDS.head = { col: 0xffeccd, I: 9, r: 120, k: 0.0014 };
LAMP_KINDS.fire = { col: 0xff6a22, I: 2.6, r: 4.2, k: 0.05 };
const TL = { aim: 0.07, cos: 0.84, out: 1.2, fcos: 0.15 };   // how far the beam dips, the cosine at its edge, how far ahead of the lens it starts
const _tlA = new THREE.Vector3();

/* own: a record the caller keeps for one train ({} to start with). L: its engine. hl: headlight 0 off, 1 dim,
   2 bright (pass 0 for a train whose headlight is a real light). fire: 0..1, how hot the fire is (0 for a
   diesel). night: 0 by day, 1 at night. t: seconds, for the fire's flicker. */
function trainLights(own, L, hl, fire, night, t = 0) {
  if (!own.h) {
    own.h = { kind: 'head', p: new THREE.Vector3(), dir: new THREE.Vector3(), cos: TL.cos, dyn: true, lv: 0 };
    own.f = { kind: 'fire', p: new THREE.Vector3(), dir: new THREE.Vector3(0, -1, 0), cos: TL.fcos, dyn: true, lv: 0 };   // it shines down: the pan hides the fire from the side
  }
  if (!own.on) { LAMPS.lights.push(own.h, own.f); own.on = true; }
  const dusk = smooth(0.12, 0.6, night);
  own.h.lv = hl && L.headlightPos ? (hl === 2 ? 1 : 0.4) * dusk : 0;
  if (own.h.lv > 0) {
    const f = L.headFrame || L.root;
    own.h.dir.set(1, -TL.aim, 0).normalize().transformDirection(f.matrixWorld);
    own.h.p.copy(L.headlightPos).applyMatrix4(f.matrixWorld).addScaledVector(own.h.dir, TL.out);
  }
  own.f.lv = fire > 0 && L.ash ? fire * dusk * (0.8 + 0.2 * Math.sin(t * 23) * Math.sin(t * 7.3)) : 0;
  if (own.f.lv > 0) own.f.p.copy(_tlA.copy(L.ash.position).setY(L.ash.position.y - 0.1)).applyMatrix4(L.ash.parent.matrixWorld);
}
/* the train is hidden or gone: its lamps go dark (drop: and leave the registry) */
function trainLightsOff(own, drop = false) {
  if (!own || !own.h) return;
  own.h.lv = own.f.lv = 0;
  if (drop && own.on) { for (const l of [own.h, own.f]) { const i = LAMPS.lights.indexOf(l); if (i >= 0) LAMPS.lights.splice(i, 1); } own.on = false; }
}

/* ==========================================================================
   Light out of the coach windows (through the lamp shader, 10c_lamps.js)

   At night a lit passenger car throws its windows onto everything beside it: a row of warm panes on the
   ballast and the ground, stretched out from the car, sliding along with the train, climbing a platform
   edge, a fence or the side of a train on the next track. The light comes from the lamps along the
   ceiling, wall to wall and end to end, so the light reaching any spot is the part of that ceiling it can see
   through the glass: it starts just off the car's side under the sills, is brightest a few metres out, fades
   to nothing past the line through the window heads, and each pane spreads into its neighbours the further
   it falls, as the light from many lamps does. Worked out per pixel for every lit material, a few
   sums per car near the camera. The observation car's red marker (and a caboose's) lights the rails behind.
   ========================================================================== */
// the cars nearest the camera that light the ground: a computer 12, a phone 4
const WL_MAX = LAMP_MAX > 8 ? 12 : 4;
const WLIT = { O: new Float32Array(WL_MAX * 4), X: new Float32Array(WL_MAX * 4), Y: new Float32Array(WL_MAX * 4), W: new Float32Array(WL_MAX * 4), C: new Float32Array(WL_MAX * 4), H: new Float32Array(WL_MAX * 4), info: new Float32Array(4) };

/* The window light, added in every lit shader just after the lamps. Per car:
   wlO: the car's origin (rail top, middle of the car), the first window's centre along the car
   wlX: the car's length axis, the window pitch      wlY: its up axis, how many windows
   wlW: half the gap between a pair's panes (0: single windows), half a pane's width, the glass's distance from the
        centre line, the ceiling lamps' height
   wlC: colour x brightness, the sill's height        wlH: the window head's height, half the car, its outside (sills, grabs) */
(function wlChunks() {
  const C = THREE.ShaderChunk, DECL = `
#ifndef WL_DECL
  #define WL_DECL
  #define WL_MAX ${WL_MAX}
  uniform vec4 wlO[ WL_MAX ]; uniform vec4 wlX[ WL_MAX ]; uniform vec4 wlY[ WL_MAX ]; uniform vec4 wlW[ WL_MAX ]; uniform vec4 wlC[ WL_MAX ]; uniform vec4 wlH[ WL_MAX ]; uniform vec4 wlInfo;
#endif`;
  C.lights_pars_begin = DECL + '\n' + C.lights_pars_begin;
  C.aomap_fragment += `
#if defined( LAMP_DECL ) && defined( WL_DECL )
  if ( wlInfo.x > 0.5 ) {
    vec3 wlN = normalize( vLampN ) * ( gl_FrontFacing ? 1.0 : -1.0 );
    vec3 wlSum = vec3( 0.0 );
    for ( int i = 0; i < WL_MAX; i ++ ) {
      if ( float( i ) >= wlInfo.x ) break;
      vec3 d = vLampP - wlO[ i ].xyz;
      vec3 ax = wlX[ i ].xyz, ay = wlY[ i ].xyz;
      float lx = dot( d, ax ), ly = dot( d, ay ), lz = dot( d, cross( ax, ay ) );
      float side = wlW[ i ].z, az = abs( lz ), wo = az - side;
      float mid = ( wlY[ i ].w - 1.0 ) * wlX[ i ].w * 0.5, along = abs( lx - wlO[ i ].w - mid ) - mid;   // past the end of the window run
      if ( az < wlH[ i ].z || wo > 15.0 || along > 4.0 ) continue;   // nothing on the car's own skin, sills and grab irons
      // the lit ceiling spans the car from wall to wall: where the lines from its far and near edges cross the glass
      float yL = wlW[ i ].w, zc = side - 0.3, uA = ( side + zc ) / ( az + zc ), uB = ( side - zc ) / ( az - zc );
      float ya = yL + ( ly - yL ) * uA, yb = yL + ( ly - yL ) * uB;
      // how much of the window's height that span looks through: a soft edge of its own, wider the further out
      float sill = wlC[ i ].w, head = wlH[ i ].x;
      float band = clamp( min( max( ya, yb ), head ) - max( min( ya, yb ), sill ), 0.0, head - sill ) / ( head - sill );
      if ( band <= 0.0 ) continue;
      // along the car the lamps run the whole length, so each pane spreads more the further it falls from the glass
      float pitch = wlX[ i ].w, so = wlW[ i ].x, hp = wlW[ i ].y, um = 0.5 * ( uA + uB ), B = 1.0 * ( 1.0 - um ) + 0.02;
      float pane = 0.0;
      for ( int j = 0; j < 7; j ++ ) {
        float x = lx + B * ( float( j ) / 3.0 - 1.0 );
        float k = clamp( floor( ( x - wlO[ i ].w ) / pitch + 0.5 ), 0.0, wlY[ i ].w - 1.0 );
        float dx = abs( x - wlO[ i ].w - k * pitch ), e = so > 0.0 ? abs( dx - so ) : dx;
        pane += 1.0 - smoothstep( hp - 0.04, hp + 0.04, e );
      }
      pane /= 7.0;
      // from the glass to here, and the way the light comes in
      float r = ( 1.0 - um ) * length( vec2( ly - yL, az ) );
      vec3 src = wlO[ i ].xyz + ax * lx + ay * yL;
      float nl = max( dot( wlN, normalize( src - vLampP ) ) * 0.85 + 0.15, 0.0 );
      wlSum += wlC[ i ].rgb * ( band * pane * nl * ( 1.0 - smoothstep( 10.0, 15.0, wo ) ) / ( 1.0 + 0.05 * r * r ) );
    }
    reflectedLight.directDiffuse += wlSum * diffuseColor.rgb;
  }
#endif`;
  const u = { wlO: { value: WLIT.O }, wlX: { value: WLIT.X }, wlY: { value: WLIT.Y }, wlW: { value: WLIT.W }, wlC: { value: WLIT.C }, wlH: { value: WLIT.H }, wlInfo: { value: WLIT.info } };
  for (const k of ['lambert', 'phong', 'standard', 'physical']) if (THREE.ShaderLib[k]) Object.assign(THREE.ShaderLib[k].uniforms, u);
})();

/* The same sums as the shader, for one car and one world point (the tests check the pools land where they should).
   c: a car as wlCars hands it to the shader; p: a point; n: the surface's normal (up if left out). */
function wlAt(c, p, n) {
  const d = [p.x - c.o.x, p.y - c.o.y, p.z - c.o.z], ax = c.ax, ay = c.ay, az3 = new THREE.Vector3().crossVectors(ax, ay);
  const lx = d[0] * ax.x + d[1] * ax.y + d[2] * ax.z, ly = d[0] * ay.x + d[1] * ay.y + d[2] * ay.z, lz = d[0] * az3.x + d[1] * az3.y + d[2] * az3.z;
  const w = c.w, az = Math.abs(lz), out = az - w.side;
  const mid = (w.n - 1) * w.pitch * 0.5, along = Math.abs(lx - w.x0 - mid) - mid;
  if (az < w.skin || out > 15 || along > 4) return 0;
  const zc = w.side - 0.3, uA = (w.side + zc) / (az + zc), uB = (w.side - zc) / (az - zc);
  const ya = w.yL + (ly - w.yL) * uA, yb = w.yL + (ly - w.yL) * uB;
  const band = clamp(Math.min(Math.max(ya, yb), w.head) - Math.max(Math.min(ya, yb), w.sill), 0, w.head - w.sill) / (w.head - w.sill);
  if (band <= 0) return 0;
  const um = 0.5 * (uA + uB), B = 1.0 * (1 - um) + 0.02;
  let pane = 0;
  for (let j = 0; j < 7; j++) {
    const x = lx + B * (j / 3 - 1), k = clamp(Math.floor((x - w.x0) / w.pitch + 0.5), 0, w.n - 1);
    const dx = Math.abs(x - w.x0 - k * w.pitch), e = w.so > 0 ? Math.abs(dx - w.so) : dx;
    pane += 1 - smooth(w.hw - 0.04, w.hw + 0.04, e);
  }
  pane /= 7;
  const r = (1 - um) * Math.hypot(ly - w.yL, az);
  const src = c.o.clone().addScaledVector(ax, lx).addScaledVector(ay, w.yL), L = src.sub(p).normalize(), N = n || new THREE.Vector3(0, 1, 0);
  const nl = Math.max(N.dot(L) * 0.85 + 0.15, 0);
  return c.I * band * pane * nl * (1 - smooth(10, 15, out)) / (1 + 0.05 * r * r);
}
/* how lit a car's ceiling lamps are for the darkness: the coaches' come on with their windows (10_sky_fx.js) */
function wlLit(w, dark) { return w.lit === 'hs' ? smooth(0.25, 0.4, dark) : smooth(0.15, 0.3, dark); }

const _wlM = new THREE.Matrix4(), _wlE = new THREE.Vector3();
/* where a car is right now (its world matrix is a frame behind until the scene renders) */
function wlMatrix(root, out) {
  if (root.matrixAutoUpdate) root.updateMatrix();   // a train's cars have their matrix set straight from the track (07_train.js)
  return root.parent && root.parent.matrixWorld && !root.parent.isScene ? out.multiplyMatrices(root.parent.matrixWorld, root.matrix) : out.copy(root.matrix);
}

/* every lit car near the camera, handed to the shader. consists: the trains (IX.consists()); cam: a position. */
const WL = { cars: [], pool: [] };
function wlCars(consists, cam, dark) {
  const out = WL.cars; out.length = 0;
  WLIT.info[0] = 0;
  if (!(dark > 0.12)) return out;
  let pi = 0;
  for (const c of consists) for (const v of c.vehicles) {
    const root = v.root, w = root && root.userData && root.userData.winLight;
    if (!w || root.visible === false || !root.parent) continue;
    const lit = wlLit(w, dark); if (!(lit > 0.003)) continue;
    const P = root.matrixAutoUpdate ? root.position : _wlE.setFromMatrixPosition(root.matrix);
    const dx = P.x - cam.x, dz = P.z - cam.z, dd = Math.sqrt(dx * dx + dz * dz) - w.half;
    if (dd > 260) continue;
    const e = WL.pool[pi] || (WL.pool[pi] = { o: new THREE.Vector3(), ax: new THREE.Vector3(), ay: new THREE.Vector3(), m: new THREE.Matrix4() }); pi++;
    e.root = root; e.w = w; e.lit = lit; e.d = dd;
    out.push(e);
  }
  out.sort((a, b) => a.d - b.d);
  if (out.length > WL_MAX) out.length = WL_MAX;
  const edge = 260;
  let k = 0;
  for (const e of out) {
    const w = e.w, m = wlMatrix(e.root, e.m);
    e.o.setFromMatrixPosition(m); e.ax.setFromMatrixColumn(m, 0).normalize(); e.ay.setFromMatrixColumn(m, 1).normalize();
    e.I = w.I * e.lit * smooth(edge, edge - 60, e.d);
    if (!(e.I > 0.003)) continue;
    _lc.setHex(w.col).convertSRGBToLinear().multiplyScalar(e.I);
    const O = WLIT.O, X = WLIT.X, Y = WLIT.Y, W = WLIT.W, C = WLIT.C, H = WLIT.H, j = k * 4;
    O[j] = e.o.x; O[j + 1] = e.o.y; O[j + 2] = e.o.z; O[j + 3] = w.x0;
    X[j] = e.ax.x; X[j + 1] = e.ax.y; X[j + 2] = e.ax.z; X[j + 3] = w.pitch;
    Y[j] = e.ay.x; Y[j + 1] = e.ay.y; Y[j + 2] = e.ay.z; Y[j + 3] = w.n;
    W[j] = w.so; W[j + 1] = w.hw; W[j + 2] = w.side; W[j + 3] = w.yL;
    C[j] = _lc.r; C[j + 1] = _lc.g; C[j + 2] = _lc.b; C[j + 3] = w.sill;
    H[j] = w.head; H[j + 1] = w.half; H[j + 2] = w.skin;
    k++;
  }
  WLIT.info[0] = k;
  return out;
}

/* The red marker lamps on the rear car throw a red glow onto the rails, the ties and the ground behind the
   train, a little of it down onto the platform. Rebuilt each frame from the lit markers, so a car that leaves
   takes its glow with it. v: the rear car; lit: 0..1. */
LAMP_KINDS.mark = { col: 0xff1e0c, I: 1.3, r: 14, k: 0.07 };
LAMP_KINDS.markBig = { col: 0xff1e0c, I: 1.8, r: 18, k: 0.05 };
function wlMarker(v, lit, list) {
  const u = v.root && v.root.userData; if (!v.markers || !u) return;
  const big = u.markerSets && v.markers === u.markerSets.roof, m = wlMatrix(v.root, _wlM);
  if (!v.mkLamps) v.mkLamps = [];
  v.markers.forEach((mp, i) => {
    const l = v.mkLamps[i] || (v.mkLamps[i] = { kind: 'mark', p: new THREE.Vector3(), dir: new THREE.Vector3(), cos: -0.2, dyn: true, lv: 0 });
    l.kind = big ? 'markBig' : 'mark';
    l.p.copy(mp).applyMatrix4(m);
    // out of the lens, back from the car's -x end and a little down; the lamp's case hides it from straight ahead
    l.dir.copy(_wlE.set(-1, -0.35, 0)).transformDirection(m);
    l.p.addScaledVector(l.dir, 0.12);
    l.lv = lit / (big ? 1 : Math.sqrt(v.markers.length));
    list.push(l);
  });
}

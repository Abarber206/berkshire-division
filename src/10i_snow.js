/* ============================================================================
   Snow on the engines and cars, and the winter trees.
   While it snows a coat builds up on everything that faces the sky: car roofs, tender decks, hood tops,
   running boards, the tops of the trucks, the floors of open cars. The flattest surfaces fill first, then
   the coat creeps down curved roofs as it deepens, broken into drifts by a noise fixed to each car (so it
   rides along with the train). It thaws slowly after the snow stops (WX.lay in 10d_weather.js).
   The coat is drawn in the paint's own shader, on the surface itself, so it can never float or gap.
   Kept dry: insides (cabs, coach saloons, anything built with cast false), the warm boiler jacket of a
   steam engine, and parts that move, shine or run hot (rods, tires, brass, the smokebox).
   In winter the hardwoods and bushes stand bare and snow lies on the pines (04c_foliage.js).
   ========================================================================== */
const SNOWC = { U: { value: 0 }, done: new WeakSet(), dry: new WeakSet(), twins: new WeakMap() };
// bins never coated: moving, polished or hot parts, glass and lamps, and the holiday trim's own snow
const SNOW_SKIP = new Set(['graphite', 'rod', 'tire', 'dWall', 'brass', 'copper', 'bronze', 'bellGrey', 'gold', 'fan', 'snow', 'snowDust', 'garland', 'berry', 'ribbon',
  'glow', 'lens', 'lensOff', 'hlLens', 'headOff', 'screen', 'hsLamp', 'hsTail', 'hsTailOff', 'hsGlass', 'hsWin', 'glass', 'glassT', 'win', 'coachWin', 'holWin', 'hit']);

/* can this material carry the coat? plain lit paint only: no glass, no lamps, no shader of its own */
function snowOk(m) {
  if (!m || !(m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)) return false;
  if (m.transparent || m.visible === false || m.userData.noSnow) return false;
  if (m.emissive && m.emissive.r + m.emissive.g + m.emissive.b > 0) return false;   // windows and lamps that light up
  return !Object.prototype.hasOwnProperty.call(m, 'onBeforeCompile');
}
/* the material for bin k of a GeoBin being built (01_util.js calls this): rolling stock only, which every
   engine and car builds with the RMAT set */
function snowMat(mats, k, opt = {}) {
  const m = mats[k];
  if (!m || typeof RMAT === 'undefined' || !RMAT.black || mats.black !== RMAT.black) return m;
  const ours = SNOWC.done.has(m);
  if (!ours && !snowOk(m)) return m;
  if (opt.cast === false || k.startsWith('jacket')) return snowDry(m);   // inside, or on the warm boiler
  if (SNOW_SKIP.has(k)) { if (!ours) SNOWC.dry.add(m); return m; }
  if (!ours && !SNOWC.dry.has(m)) snowCoat(m);
  return m;
}
/* a twin of a material that never takes the coat: the same colour (shared, so a repaint reaches it) and maps */
function snowDry(m) {
  let t = SNOWC.twins.get(m);
  if (!t) {
    t = m.clone(); t.color = m.color; t.userData.noSnow = true;
    if (m.name) t.name = m.name + ' (dry)';
    SNOWC.twins.set(m, t);
  }
  return t;
}
function snowCoat(m) {
  SNOWC.done.add(m);
  const std = !!m.isMeshStandardMaterial;
  m.onBeforeCompile = sh => snowShader(sh, std);
  m.customProgramCacheKey = () => 'snowcoat';
  m.needsUpdate = true;
}
const SNOW_GLSL = {
  vert: `
    { vec3 snN = objectNormal; vec4 snP = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        snN = mat3( instanceMatrix ) * snN;
      #endif
      vSnN = normalize( mat3( modelMatrix ) * snN ); vSnP = snP.xyz; }`,
  pars: `
    uniform float uSnowLay; varying vec3 vSnN; varying vec3 vSnP;
    float snHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
    float snNoise( vec2 p ) {
      vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
      return mix( mix( snHash( i ), snHash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( snHash( i + vec2( 0.0, 1.0 ) ), snHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
    }`,
  frag: `
    float snowCov = 0.0;
    if ( uSnowLay > 0.003 ) {
      vec3 snN = normalize( vSnN );
      #ifdef DOUBLE_SIDED
        snN *= gl_FrontFacing ? 1.0 : -1.0;
      #endif
      // drifts fixed to the car (its own coordinates, so they ride along), big and small
      float nz = snNoise( vSnP.xz * 1.7 + vSnP.y * 0.9 ) * 0.62 + snNoise( vSnP.xz * 6.1 - vSnP.y * 2.3 ) * 0.38;
      // a thin coat holds only on the flat; a deep one reaches down the curve of a roof
      float thr = mix( 0.97, 0.42, uSnowLay );
      snowCov = smoothstep( thr - 0.05, thr + 0.05, snN.y + ( nz - 0.5 ) * 0.32 )
              * smoothstep( 0.0, 0.14, uSnowLay * 1.5 - ( 1.0 - nz ) * 0.3 );
      diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.84, 0.87, 0.91 ), snowCov );
    }`,
};
function snowShader(sh, std) {
  sh.uniforms.uSnowLay = SNOWC.U;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vSnN; varying vec3 vSnP;')
    .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>' + SNOW_GLSL.vert);
  const at = std ? '#include <metalnessmap_fragment>' : '#include <specularmap_fragment>';
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>' + SNOW_GLSL.pars)
    .replace(at, at + SNOW_GLSL.frag + (std ? `
    roughnessFactor = mix( roughnessFactor, 0.88, snowCov ); metalnessFactor = mix( metalnessFactor, 0.0, snowCov );` : ''));
}

/* each frame, from the weather: the coat on the trains and the trees, and whether the hardwoods are bare */
function snowFrame() {
  SNOWC.U.value = WX.lay;
  if (typeof FOL !== 'undefined') { FOL.layU.value = WX.lay; FOL.winterU.value = WX.season === 'winter' ? 1 : 0; }
}

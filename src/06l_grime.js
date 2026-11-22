/* ============================================================================
   Weathering on every engine and car, drawn in the paint's own shader.
   Working railroad equipment is never clean: road dirt and brake dust thrown up by the wheels coats the
   bottom of everything, rain runs grime and rust down the sides in long streaks, ash, cinders and exhaust
   soot settle on whatever faces the sky, freight cars rust in blotches and along their seams, paint chips
   off where it gets knocked, running gear and diesel trucks wear a dark film of oil, and a smokebox goes
   ashy grey with heat. All of it is placed by the model's own coordinates (y is height above the rail,
   x runs along the car), so it sits where it would on the real thing, rides along with the train and can
   never float or gap. The paint's colour is still the colour underneath, so a repaint reaches it and
   lettering stays readable (decals take a lighter coat so they sit in the same dirt).
   Each material carries a profile (GRM_P): how much of each kind of wear it takes, the colour of the dirt
   and of what settles on top. Insides of cabs get a light coat. Off / Light / Full in the Graphics tab.
   ========================================================================== */
const GRM_LEVELS = { off: { name: 'Clean', sub: 'Fresh from the paint shop', k: 0 }, light: { name: 'Light', sub: 'Recently washed', k: 0.55 }, full: { name: 'Weathered', sub: 'Soot, grime and rust', k: 1 } };
/* colours in linear light (the shader works after the paints are linearized) */
const GRM_C = {
  road: [0.085, 0.066, 0.048],      // grey-brown road dirt and ballast dust
  brake: [0.085, 0.055, 0.036],     // brake-shoe dust, a rusty grey-brown
  ash: [0.088, 0.083, 0.076],       // cinders and ash on a steam engine's top
  soot: [0.016, 0.014, 0.012],      // diesel and turbine exhaust soot
  dust: [0.07, 0.06, 0.048],        // dust and soot on car roofs
  carbon: [0.035, 0.034, 0.034],    // pantograph carbon on electric roofs
};
/* profiles: a = [road dirt, streaks, rust, top], b = [oil, chips, heat, dirt band height (m)], top/dirt colours */
const GRM_P = {
  steam:   { a: [0.6, 0.48, 0.05, 0.8], b: [0.3, 0.12, 0, 1.7], top: 'ash', dirt: 'road' },
  smokebox:{ a: [0.35, 0.22, 0.06, 0.7], b: [0.1, 0.05, 0.42, 1.7], top: 'ash', dirt: 'road' },
  gear:    { a: [0.5, 0.15, 0.1, 0.4], b: [0.55, 0.08, 0, 2.2], top: 'ash', dirt: 'road' },
  steel:   { a: [0.45, 0.12, 0.22, 0.3], b: [0.35, 0, 0, 2.0], top: 'ash', dirt: 'brake' },
  roof:    { a: [0.1, 0.35, 0.25, 0.5], b: [0, 0.05, 0, 1.0], top: 'dust', dirt: 'road' },
  coach:   { a: [0.5, 0.3, 0.02, 0.45], b: [0.1, 0.06, 0, 1.8], top: 'dust', dirt: 'road' },
  freight: { a: [0.55, 0.5, 0.5, 0.5], b: [0.12, 0.2, 0, 1.9], top: 'dust', dirt: 'road' },
  hopper:  { a: [0.55, 0.55, 0.7, 0.55], b: [0.1, 0.22, 0, 1.9], top: 'dust', dirt: 'road' },
  tank:    { a: [0.45, 0.5, 0.05, 0.5], b: [0.25, 0.06, 0, 1.6], top: 'dust', dirt: 'road' },
  caboose: { a: [0.5, 0.35, 0.18, 0.4], b: [0.1, 0.12, 0, 1.9], top: 'dust', dirt: 'road' },
  deck:    { a: [0.5, 0.1, 0.45, 0.35], b: [0.2, 0.1, 0, 2.0], top: 'dust', dirt: 'road' },
  wood:    { a: [0.4, 0.2, 0, 0.35], b: [0, 0, 0, 1.6], top: 'dust', dirt: 'road' },
  diesel:  { a: [0.5, 0.5, 0.05, 0.65], b: [0.12, 0.1, 0, 2.0], top: 'soot', dirt: 'road' },
  dieselRoof: { a: [0.2, 0.35, 0.08, 0.75], b: [0, 0.05, 0, 1.0], top: 'soot', dirt: 'road' },
  under:   { a: [0.6, 0.18, 0.06, 0.4], b: [0.5, 0.06, 0, 2.4], top: 'soot', dirt: 'road' },
  turbine: { a: [0.55, 0.6, 0.04, 0.7], b: [0.15, 0.08, 0, 2.3], top: 'soot', dirt: 'road' },
  hs:      { a: [0.32, 0.14, 0, 0.22], b: [0.05, 0.02, 0, 1.25], top: 'carbon', dirt: 'brake' },
  hsUnder: { a: [0.6, 0.12, 0.08, 0.3], b: [0.3, 0.02, 0, 2.0], top: 'carbon', dirt: 'brake' },
  decal:   { a: [0.32, 0.26, 0, 0.3], b: [0, 0, 0, 1.8], top: 'dust', dirt: 'road' },
};
/* which profile each shared material takes, by its RMAT name (an engine's own skin is tagged where it is made) */
const GRM_BY = {
  black: 'steam', blackMatte: 'steam', rbEdge: 'steam', dWall: 'gear', jacket: 'steam', holBody: 'coach',
  graphite: 'smokebox', dark: 'gear', jacketBand: 'gear', steel: 'steel', roof: 'roof',
  green: 'coach', greenLow: 'coach', greenSill: 'coach', holLow: 'coach', holSill: 'coach',
  oxide: 'freight', oxide2: 'freight', oxideW: 'freight', oxide2W: 'freight', boxPanel: 'freight', red: 'caboose',
  hopW: 'hopper', tank: 'tank', tankW: 'tank', caboose: 'caboose', cabooseW: 'caboose', deckPlate: 'deck', wood: 'wood', diaphragm: 'wood',
  dDeck: 'deck', dUnder: 'under', dSteel: 'steel', dSafety: 'diesel', grille: 'under', mesh: 'dieselRoof', fan: 'dieselRoof',
  upYel: 'turbine', upGray: 'turbine', upRed: 'turbine', upFrame: 'under', upLouver: 'turbine',
  hsUnder: 'hsUnder', hsBogie: 'hsUnder', hsSteel: 'hsUnder', hsSeam: 'hs', acGrille: 'hs',
};
function grmLevel(k) { GRM.K.value = (GRM_LEVELS[k] || GRM_LEVELS.full).k; }
/* the profile for bin k's material m, or null to leave it clean */
function grmProfile(m, k, inside) {
  let name = GRM.tag.get(m) || GRM_BY[k];
  if (!name && m.transparent && m.alphaTest > 0) name = 'decal';   // lettering, heralds, number boards
  const p = name && GRM_P[name]; if (!p) return null;
  const a = p.a.slice(), b = p.b.slice();
  if (m.transparent && name !== 'decal') { a[0] *= 0.85; a[1] *= 0.85; a[3] *= 0.85; }   // the diesel's painted bands sit on the body
  if (inside) { a[0] *= 0.35; a[1] = 0; a[2] *= 0.3; a[3] *= 0.3; b[1] = 0; b[2] = 0; }
  return { a, b, top: GRM_C[p.top], dirt: GRM_C[p.dirt] };
}
/* give material m (from bin k) its weathering; called by snowMat (10i_snow.js) for every rolling-stock bin */
function grmApply(m, k, inside) {
  if (!m || GRM.mats.has(m) || GRM.no.has(m)) return m;
  const own = Object.prototype.hasOwnProperty.call(m, 'onBeforeCompile') && !(typeof SNOWC !== 'undefined' && SNOWC.own.has(m));
  const lit = m.emissive && m.emissive.r + m.emissive.g + m.emissive.b > 0;
  const ok = m.isMeshStandardMaterial && m.visible !== false && !own && !lit && (!m.transparent || m.alphaTest > 0);
  const p = ok && grmProfile(m, k, inside);
  if (!p) { GRM.no.add(m); return m; }
  GRM.mats.set(m, { uGrA: { value: new THREE.Vector4(...p.a) }, uGrB: { value: new THREE.Vector4(...p.b) }, uGrTop: { value: new THREE.Vector3(...p.top) }, uGrDirt: { value: new THREE.Vector3(...p.dirt) } });
  if (typeof rsInstall === 'function') rsInstall(m);
  return m;
}
const GRM_GLSL = {
  vert: `
    vGrP = transformed; vGrN = objectNormal;`,
  pars: `
    uniform vec4 uGrA; uniform vec4 uGrB; uniform vec3 uGrTop; uniform vec3 uGrDirt; uniform float uGrK;
    varying vec3 vGrP; varying vec3 vGrN;
    float grHash( vec2 p ) { p = fract( p * vec2( 0.1031, 0.1030 ) ); p += dot( p, p.yx + 33.33 ); return fract( ( p.x + p.y ) * p.x ); }
    float grNoise( vec2 p ) {
      vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
      return mix( mix( grHash( i ), grHash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( grHash( i + vec2( 0.0, 1.0 ) ), grHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
    }`,
  frag: `
    if ( uGrK > 0.001 ) {
      vec3 gP = vGrP, gN = normalize( vGrN );
      #ifdef DOUBLE_SIDED
        gN *= gl_FrontFacing ? 1.0 : -1.0;
      #endif
      // along the surface: x on the sides, z on the ends, so the streaks run straight down both (and down the
      // round side of a boiler or tank, where z changes with height, instead of curling into arcs)
      float gh = abs( gN.z ) >= abs( gN.x ) ? gP.x : gP.z * 1.37 + 17.0;
      float big = grNoise( vec2( gh * 0.33, gP.y * 0.45 ) ) * 0.65 + grNoise( vec2( gh * 1.1 + 7.0, gP.y * 1.3 ) ) * 0.35;
      float fine = grNoise( vec2( gh * 7.0, gP.y * 7.0 ) + 3.7 );
      // road dirt: thickest at the bottom, its top edge ragged where the spray thinned out
      float band = uGrB.w * ( 0.88 + 0.24 * big );
      float low = 1.0 - smoothstep( band * 0.15, band, gP.y + ( fine - 0.5 ) * 0.1 );
      float dirt = uGrA.x * pow( low, 1.5 ) * ( 0.78 + 0.22 * big );
      // streaks: rain carrying grime and rust down from the roof, seams and fittings; long, thin, uneven
      float side = 1.0 - smoothstep( 0.55, 0.9, abs( gN.y ) );
      float s1 = grNoise( vec2( gh * 8.0, gP.y * 0.32 + grNoise( vec2( gh * 0.9, 1.7 ) ) * 4.0 ) );
      float s2 = grNoise( vec2( gh * 21.0, gP.y * 0.55 ) );
      float streak = uGrA.y * side * smoothstep( 0.5, 0.92, s1 * 0.68 + s2 * 0.32 ) * ( 0.55 + 0.45 * big );
      // what settles on top: ash and cinders, exhaust soot, dust
      float up = smoothstep( 0.3, 0.9, gN.y );
      float top = uGrA.w * up * ( 0.5 + 0.5 * grNoise( gP.xz * 1.6 + 11.0 ) ) * ( 0.75 + 0.25 * fine );
      // rust: blotches that gather low, in the streaks and round the chips
      float rn = grNoise( vec2( gh * 1.7, gP.y * 1.7 ) + 2.1 ) * 0.45 + grNoise( vec2( gh * 5.3, gP.y * 5.3 ) + 5.3 ) * 0.35 + fine * 0.2;
      float rust = uGrA.z * smoothstep( 0.68 - 0.14 * low - 0.1 * streak / max( uGrA.y, 0.01 ), 0.84, rn );
      // chipped paint: small flecks of bare steel, more of them low down where ballast flies
      float chip = uGrB.y * smoothstep( 0.86 - 0.08 * low, 0.93 - 0.08 * low, grNoise( vec2( gh * 37.0, gP.y * 37.0 ) ) );
      // a film of oil and grease on running gear, trucks and fuel tanks
      float oil = uGrB.x * low * smoothstep( 0.35, 0.75, grNoise( vec2( gh * 1.9, gP.y * 2.6 ) + 1.3 ) );
      // a smokebox's heat bloom: ashy grey patches where the paint has burnt
      float heat = uGrB.z * smoothstep( 0.42, 0.85, big * 0.7 + fine * 0.3 );
      dirt *= uGrK; streak *= uGrK; top *= uGrK; rust *= uGrK; chip *= uGrK; oil *= uGrK; heat *= uGrK;
      vec3 gc = diffuseColor.rgb;
      gc = mix( gc, vec3( 0.19, 0.17, 0.15 ), heat * 0.6 );
      gc = mix( gc, uGrDirt * ( 0.75 + 0.5 * fine ), clamp( dirt, 0.0, 0.85 ) );
      // a streak darkens light paint and greys dark paint: grime the colour of the road
      gc = mix( gc, mix( gc * 0.6, uGrDirt * 1.1, 0.55 ), streak );
      vec3 rc = mix( vec3( 0.10, 0.038, 0.016 ), vec3( 0.21, 0.075, 0.025 ), fine );   // old rust is dark brown, fresh rust brighter
      gc = mix( gc, rc, clamp( rust, 0.0, 0.9 ) );
      gc = mix( gc, vec3( 0.11, 0.105, 0.1 ), chip );
      gc = mix( gc, uGrTop * ( 0.8 + 0.4 * fine ), clamp( top, 0.0, 0.9 ) );
      gc *= 1.0 - 0.45 * oil;
      diffuseColor.rgb = gc;
      float grime = clamp( dirt + top + heat * 0.8 + streak * 0.4, 0.0, 1.0 );
      #ifdef STANDARD
        roughnessFactor = mix( roughnessFactor, 0.92, grime * 0.85 );
        roughnessFactor = mix( roughnessFactor, 0.88, rust );
        roughnessFactor = mix( roughnessFactor, 0.32, oil );
        roughnessFactor = mix( roughnessFactor, 0.45, chip );
        roughnessFactor *= 0.9 + 0.2 * big;
        metalnessFactor = mix( metalnessFactor, 0.0, max( grime, rust ) * 0.8 );
        metalnessFactor = mix( metalnessFactor, 0.85, chip );
      #endif
    }`,
};
function grmShader(sh, m) {
  const U = GRM.mats.get(m); if (!U) return;
  Object.assign(sh.uniforms, U); sh.uniforms.uGrK = GRM.K;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vGrP; varying vec3 vGrN;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>' + GRM_GLSL.vert);
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>' + GRM_GLSL.pars)
    .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>' + GRM_GLSL.frag);
}

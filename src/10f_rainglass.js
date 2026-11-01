/* ============================================================================
   Rain on the glass, wipers, and puddles.

   Window panes (steam cab windows, the diesel's windshield and side glass,
   the high-speed cabs) get raindrops drawn on the glass itself: beads that
   land and dry off, and runners that slide down the pane, swept back along
   the side glass and up the windshield once the train has some speed. The
   diesel's windshield has a wiper on each pane that parks at the bottom and
   sweeps when it rains, faster in a downpour; the beads it clears come back
   as the rain lands again. Puddles stand in the flat hollows of wet ground
   and ring with ripples while it rains.
   ========================================================================== */
const RAINGLASS = {
  u: { uRG: { value: [0, 0, 0, -Math.PI / 2] }, uRW: { value: [0, 1.6, 0, 0] } },   // amount, time, speed, wiper phase | on, wiper rate (rad/s)
  wet: 0, phase: -Math.PI / 2, run: false,
};
const RAINGLASS_GLSL = `
  uniform vec4 uRG; uniform vec4 uRW; varying vec3 vRP; varying vec3 vRN; varying vec2 vRUv;
  float rgH( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
  vec2 rgH2( vec2 p ) { return fract( sin( vec2( dot( p, vec2( 127.1, 311.7 ) ), dot( p, vec2( 269.5, 183.3 ) ) ) ) * 43758.5453 ); }
  // beads sitting on the glass: each lands, sits a while and dries; after a wipe one comes back once rain hits there
  float rgBeads( vec2 p, float amt, float t, float since ) {
    float m = 0.0;
    for ( int k = 0; k < 2; k++ ) {
      float sc = k == 0 ? 0.032 : 0.017;
      vec2 id = floor( p / sc ), f = fract( p / sc ) - 0.5, r = rgH2( id + float( k ) * 17.0 );
      float life = fract( t * ( 0.05 + 0.04 * r.y ) + r.x );
      float on = step( r.y, amt * ( k == 0 ? 0.32 : 0.5 ) ) * smoothstep( 0.0, 0.03, life ) * smoothstep( 1.0, 0.75, life ) * step( r.x * 5.0, since );
      float rad = 0.1 + 0.15 * fract( r.x * 7.3 ) * fract( r.y * 3.1 + 0.5 );
      m = max( m, on * smoothstep( rad, rad * 0.55, length( ( f - ( r - 0.5 ) * 0.5 ) * vec2( 1.0, 0.85 ) ) ) );
    }
    return m;
  }
  // runners: drops sliding along dir, each leaving a thin wet trail behind it
  float rgRuns( vec2 p, vec2 dir, float amt, float t, float spd ) {
    vec2 dn = normalize( dir ), sd = vec2( -dn.y, dn.x );
    vec2 q = vec2( dot( p, sd ), dot( p, dn ) );
    float cw = 0.045, col = floor( q.x / cw ), r = rgH( vec2( col, 3.1 ) );
    if ( r > amt * 0.6 ) return 0.0;
    float fx = ( fract( q.x / cw ) - 0.5 ) * cw + sin( q.y * 37.0 + r * 6.0 ) * 0.003;
    float seg = 0.5 + r * 0.9, y = ( q.y - t * spd * ( 0.6 + 0.8 * r ) ) / seg + r * 9.0, b = fract( y );
    float head = smoothstep( 0.009, 0.004, length( vec2( fx, ( b - 0.9 ) * seg * 0.6 ) ) );
    float trail = smoothstep( 0.0025, 0.001, abs( fx ) ) * smoothstep( 0.35, 0.88, b ) * step( b, 0.9 ) * 0.55;
    return max( head, trail );
  }`;
/* draw rain on this pane material; wiper: true for panes that have a wiper (the diesel's windshield) */
function rainGlass(mat, wiper) {
  if (!mat || mat.userData.rainGlass) return mat;
  mat.userData.rainGlass = true;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uRG = RAINGLASS.u.uRG; sh.uniforms.uRW = RAINGLASS.u.uRW;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRP; varying vec3 vRN; varying vec2 vRUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRP = position; vRN = normal; vRUv = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + RAINGLASS_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
      if ( uRG.x > 0.004 || ${wiper ? 'true' : 'false'} ) {
        vec3 an = abs( vRN ); bool front = an.x > 0.6;
        vec2 p = front ? vRP.zy : vRP.xy;
        float spd = uRG.z, t = uRG.y, amt = uRG.x, since = 1e3, blade = 0.0;
        ${wiper ? `
        if ( front ) {
          // the wiper pivots below the middle of the pane: it parks flat along the bottom (the blade the model
          // already has) and sweeps up past upright
          vec2 v = vRUv - vec2( 0.5, -0.12 ); float rr = length( v ), A = 0.95, mid = -1.5708 + A, ang = atan( v.x, v.y ) - mid;
          float th = A * sin( uRW.w );
          if ( rr < 1.02 ) {
            float s1 = asin( clamp( ang / A, -1.0, 1.0 ) );
            float d1 = mod( uRW.w - s1, 6.2831853 ), d2 = mod( uRW.w - ( 3.1415927 - s1 ), 6.2831853 );
            if ( uRW.x > 0.5 && abs( ang ) < A ) since = min( d1, d2 ) / max( uRW.y, 0.1 );
            blade = smoothstep( 0.016, 0.006, abs( ang - th ) * rr ) * step( 0.16, rr ) * step( rr, 1.0 );
          }
        }` : ''}
        // airflow: back along the side glass, up the windshield once she has some speed
        vec2 dir = front ? vec2( 0.0001, -1.0 + 0.11 * abs( spd ) ) : vec2( -0.09 * spd, -1.0 );
        float m = rgBeads( p, amt * ( front ? 1.0 - smoothstep( 6.0, 22.0, abs( spd ) ) * 0.7 : 1.0 ), t, since );
        if ( since > 2.0 ) m = max( m, rgRuns( p, dir, amt, t, 0.12 + 0.02 * abs( spd ) ) );
        diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.62, 0.66, 0.7 ), m * 0.8 );
        diffuseColor.a = mix( diffuseColor.a + 0.06 * amt, 0.62, m );
        diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.03 ), blade ); diffuseColor.a = max( diffuseColor.a, blade );
      }`);
  };
  const key = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  mat.customProgramCacheKey = () => key() + '|rainglass' + (wiper ? 'W' : '');
  mat.needsUpdate = true;
  return mat;
}
/* the panes as built by the cab and model code */
function rainGlassAll() {
  rainGlass(RMAT.winGlass, false);
  rainGlass(RMAT.glassT, true);
  rainGlass(RMAT.hsGlass, false);
}
/* every frame: how wet the glass is, the train's speed, and the wipers */
function rainGlassFrame(dt) {
  const P = WX.P, inside = SKY.boreK || 0;
  // the glass wets quickly in rain, is kept dry in a tunnel, and dries slowly after
  const target = Math.min(1, P.rain * 1.4 + P.snow * 0.4) * (1 - inside);
  RAINGLASS.wet += (target - RAINGLASS.wet) * Math.min(1, dt * (target > RAINGLASS.wet ? 0.25 : 0.02));
  const w = RAINGLASS.wet;
  // wipers: on when the glass is wet, faster in a downpour; once off they finish the sweep and park
  const rate = P.rain > 0.7 ? 2.6 : 1.7;
  if (w > 0.12) RAINGLASS.run = true; else if (w < 0.06) RAINGLASS.run = false;
  const park = -Math.PI / 2, ph = RAINGLASS.phase;
  if (RAINGLASS.run || Math.abs(((ph - park) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)) > 0.05) RAINGLASS.phase += rate * dt;
  if (RAINGLASS.phase > 1e4) RAINGLASS.phase -= 2 * Math.PI * 1000;
  const g = RAINGLASS.u.uRG.value, ww = RAINGLASS.u.uRW.value;
  g[0] = w; g[1] = (S.time || 0); g[2] = S.v || 0; g[3] = RAINGLASS.phase;
  ww[0] = RAINGLASS.run ? 1 : 0; ww[1] = rate; ww[3] = RAINGLASS.phase;
  if (WORLD.rainU) { WORLD.rainU.value = P.rain * (1 - inside); WORLD.rainT.value = S.time || 0; }
}

/* puddles: in the flat low spots of wet ground, darker and mirror-like, ringing with ripples while it rains */
const PUDDLE_GLSL = `
  if ( uWet > 0.15 ) {
    float pn = texture2D( uDetail, vWPos.xz * 0.013 ).r * 0.6 + texture2D( uDetail, vWPos.xz * 0.041 + 0.3 ).g * 0.4;
    float pud = smoothstep( 0.66, 0.71, pn + uWet * 0.06 ) * smoothstep( 0.965, 0.995, vUp ) * smoothstep( 0.15, 0.7, uWet ) * ( 1.0 - uSnow );
    if ( pud > 0.0 ) {
      float rip = 0.0;
      if ( uRainA > 0.02 ) {
        vec2 cq = vWPos.xz / 0.55, id = floor( cq ), f = fract( cq ) - 0.5;
        float rh = fract( sin( dot( id, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
        float ph = fract( uRainT * ( 0.7 + rh * 0.6 ) + rh * 7.0 ), d = length( f - ( vec2( rh, fract( rh * 13.7 ) ) - 0.5 ) * 0.4 );
        rip = smoothstep( 0.03, 0.0, abs( d - ph * 0.42 ) ) * ( 1.0 - ph ) * step( rh, 0.3 + 0.7 * uRainA ) * smoothstep( 300.0, 40.0, vCamD );
      }
      diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.02, 0.022, 0.024 ), pud * 0.85 );
      #ifdef USE_FOG
        vec3 pudSky = fogColor;
      #else
        vec3 pudSky = vec3( 0.35 );
      #endif
      totalEmissiveRadiance += pudSky * pud * ( 0.13 + 0.3 * rip );
    }
  }`;

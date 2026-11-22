/* ============================================================================
   Far woods: the trees out past the planted ones, all the way to the haze.

   The real trees (04c_foliage.js) stand only round the line, and their baked far
   pictures dissolve away between about 4.5 and 7 km. Past that the world used to
   be bare ground to the horizon. Now:

   - Ohio (and layouts): every woodlot and fence row in the field pattern, out to
     the horizon, as a low block of canopy whose sides are cut into a line of
     tree crowns (round hardwoods, the odd pointed cedar) and whose top is a
     mottle of crowns in the season's colours. Fence rows have gaps, as the
     planted ones do. Each block stands exactly where the planted woodlot or
     fence row is, so as the far pictures dissolve the blocks dissolve in, in
     the same dither turned inside out: nothing pops and nothing doubles.
   - Laurel Mountain and Raven Lake: the forest that covers the hills, as a
     canopy skin over the far terrain (the same grid the far ground is built on,
     so it sits on it exactly), raised to tree height where the woods are and
     sunk into the ground where they thin out, at the rivers, the towns, the
     line and the lake.

   One instanced draw for the blocks and a few merged ones for the skin.
   ========================================================================== */
const FARW = { meshes: [], H: 12.5, near: { value: new THREE.Vector2(1900, 2700) } };

/* the crowns, the season and the dither; shared by the blocks and the skin */
const FARW_GLSL = `
  uniform vec4 uFade; uniform vec2 uFwNear; uniform float uWinter, uLay;
  uniform vec3 uFwPal[ 5 ]; uniform vec3 uFwCut; uniform vec3 uFwTwig; uniform vec3 uFwSnow;
  varying vec4 vFw; varying vec4 vFw2; varying vec2 vFwW; varying float vFwD;
  float fwHash( vec2 p ) { return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) + 0.1 * p.y ) ); }
  // a crown's colour: evergreen for the conifer share, else the hardwood palette (green, gold, red, brown) by the cut points
  vec3 fwLeaf( float h, float con ) {
    if ( h < con ) return uWinter > 0.5 ? mix( uFwPal[ 0 ], uFwSnow, uLay * 0.55 ) : uFwPal[ 0 ];
    float x = ( h - con ) / max( 1.0 - con, 0.001 );
    vec3 c = x < uFwCut.x ? uFwPal[ 1 ] : x < uFwCut.y ? uFwPal[ 2 ] : x < uFwCut.z ? uFwPal[ 3 ] : uFwPal[ 4 ];
    c = mix( vec3( dot( c, vec3( 0.3, 0.55, 0.15 ) ) ), c, 0.78 ) * ( 0.82 + 0.36 * fract( h * 7.7 ) );   // the leaf texture's grey and each tree's own shade
    return uWinter > 0.5 ? mix( uFwTwig * ( 0.85 + 0.3 * fract( h * 13.7 ) ), uFwSnow, uLay * 0.3 ) : c;
  }
  // the line of crowns along a side at (u, y) (m along it, m above the ground): round hardwoods, spire conifers, and in a
  // fence row gaps with the trunks showing. Returns 1 where a crown or trunk is; col its lit colour, top the crowns' highest
  float fwLine( float u, float y, float H, float cell, float gap, float con, out vec3 col, out float top ) {
    float c = floor( u / cell ), best = -1.0, cover = 0.0; col = vec3( 0.0 ); top = 0.0;
    for ( int k = -1; k <= 1; k++ ) {
      float ci = c + float( k ), h1 = fwHash( vec2( ci, 3.1 ) ), h2 = fwHash( vec2( ci, 8.7 ) );
      if ( h1 < gap ) continue;
      float r = cell * ( gap > 0.0 ? 0.2 + 0.1 * h2 : 0.6 + 0.25 * h2 ), cx = ( ci + 0.5 + ( h2 - 0.5 ) * 0.5 ) * cell;
      float ht = H * ( 0.8 + 0.34 * fract( h1 * 7.13 ) ), x = ( u - cx ) / r, ny, inside;
      if ( fract( h2 * 5.3 ) < con ) {   // a spruce or cedar: a narrow spire from near the ground
        inside = step( abs( u - cx ), r * 0.75 * clamp( ( ht - y ) / ( ht * 0.85 ), 0.0, 1.0 ) ) * step( ht * 0.1, y );
        ny = y / ht * 2.0 - 1.0; top = max( top, ht * step( abs( x ), 0.75 ) * ( 1.0 - abs( x ) / 0.75 ) );
      } else {                           // a hardwood: a round crown a little taller than wide
        float ry = r * 1.1, cy = ht - ry, d = x * x + ( ( y - cy ) / ry ) * ( ( y - cy ) / ry );
        inside = step( d, 1.0 ); ny = ( y - cy ) / ry; if ( abs( x ) < 1.0 ) top = max( top, cy + ry * sqrt( 1.0 - x * x ) );
      }
      if ( inside > 0.5 && ht > best ) {
        best = ht; cover = 1.0;
        // lit from above, shaded underneath and toward the rim
        col = fwLeaf( fract( h1 * 31.7 + h2 ), con ) * ( 0.58 + 0.42 * clamp( ny * 0.5 + 0.55, 0.0, 1.0 ) - 0.2 * smoothstep( 0.5, 1.0, x * x ) );
      }
      if ( gap > 0.0 && cover < 0.5 && abs( u - cx ) < 0.35 && y < ht * 0.6 ) { col = uFwTwig * 0.22; cover = 1.0; }   // the trunk
    }
    return cover;
  }`;

function farWoodsMaterial(shell) {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: shell });   // the skin carries the ground's colour under it
  m.extensions = { derivatives: true };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uFade: LOD.treeFar, uFwNear: FARW.near, uWinter: FOL.winterU, uLay: FOL.layU, uFwPal: FARW.pal, uFwCut: FARW.cut, uFwTwig: FARW.twig, uFwSnow: FARW.snow });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + (shell ? 'attribute vec4 aFw;' : 'attribute vec4 aFw; attribute vec4 aFwI;') + '\nvarying vec4 vFw; varying vec4 vFw2; varying vec2 vFwW; varying float vFwD;')
      .replace('#include <defaultnormal_vertex>', shell ? '#include <defaultnormal_vertex>' :
        // a block's faces lean their light up toward the sky as the near trees' cards do, so the side away from the sun is
        // shaded, not black (the block's own matrix is far from square, so its normals are worked out here)
        `vec3 fwN = aFw.x < 0.5 ? normalize( instanceMatrix[ 2 ].xyz ) * sign( objectNormal.z ) : aFw.x < 1.5 ? normalize( instanceMatrix[ 0 ].xyz ) * sign( objectNormal.x ) : vec3( 0.0, 1.0, 0.0 );
         fwN = normalize( vec3( fwN.x, 0.0, fwN.z ) * step( aFw.x, 1.5 ) + vec3( 0.0, aFw.x < 1.5 ? 0.65 : 1.0, 0.0 ) );
         vec3 transformedNormal = normalize( ( viewMatrix * vec4( fwN, 0.0 ) ).xyz );`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + (shell
        // the skin: aFw = (canopy share, conifer share, real trees stand here, 0)
        ? ' vFw = vec4( 0.0, 0.0, 0.0, aFw.y ); vFw2 = vec4( 0.0, aFw.z, aFw.x, 0.0 );'
        // a block: position is the unit block (x 0..1 along, z -0.5..0.5 across, y up to the tallest crown); aFw = (side: 0 long, 1 end, 2 top, 3 bottom;
        // height share), aFwI per block = (kind 0 woodlot / 1 fence row, real trees stand here, conifer share, random)
        : ` float fwL = length( instanceMatrix[ 0 ].xyz ), fwW = length( instanceMatrix[ 2 ].xyz ), fwH = instanceMatrix[ 1 ].y;
            float fwU = aFw.x < 0.5 ? position.x * fwL : aFw.x < 1.5 ? ( position.z + 0.5 ) * fwW : position.x * fwL;
            vFw = vec4( fwU + aFwI.w * 997.0, position.y * fwH, fwH / 1.3, aFwI.z ); vFw2 = vec4( aFwI.x, aFwI.y, aFw.x, position.z * fwW );`) +
        '\n vec4 fwP = vec4( transformed, 1.0 );\n#ifdef USE_INSTANCING\n fwP = instanceMatrix * fwP;\n#endif\n vFwW = ( modelMatrix * fwP ).xz; vFwD = length( ( modelViewMatrix * fwP ).xyz );');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FARW_GLSL)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        {
          // the planted trees' far pictures dissolve out over uFade.zw; these dissolve in over the same band in the
          // opposite dither. Where no trees were planted they come in sooner, past the near ground
          float st = mix( uFwNear.x, uFade.z, vFw2.y ), en = mix( uFwNear.y, uFade.w, vFw2.y );
          float keep = smoothstep( st, en, vFwD );
          float dn = 1.0 - fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
          if ( dn >= keep ) discard;
        }`)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + (shell ? `
        {
          // crowns 8 m across in the world, each its own colour, rounded by a little shade at its rim; they melt into
          // their average once they are smaller than a pixel or two so the far hills don't shimmer
          vec2 q = vFwW / 8.0, c = floor( q ), f = q - c - 0.5;
          float h = fwHash( c + 0.37 ), rim = dot( f, f ) * 2.0;
          float blur = smoothstep( 0.4, 1.4, length( fwidth( q ) ) );
          vec3 leaf = fwLeaf( h, vFw.w ), avg = fwLeaf( 0.0, vFw.w ) * vFw.w + ( uWinter > 0.5 ? uFwTwig : uFwPal[ 1 ] * 0.6 + uFwPal[ 2 ] * 0.4 ) * ( 1.0 - vFw.w );
          vec3 can = mix( leaf * ( 1.0 - 0.45 * rim ), avg * 0.85, blur ) * 1.25;
          // the forest floor shows between the crowns, as it does under the planted trees (about half the ground is open)
          diffuseColor.rgb = mix( vColor, can, 0.62 * smoothstep( 0.0, 0.6, vFw2.z ) + 0.2 );
        }` : `
        {
          float kind = vFw2.x, side = vFw2.z, H = vFw.z, con = vFw.w, u = vFw.x, y = vFw.y;
          float cell = kind > 0.5 ? 19.0 : 7.5, gap = kind > 0.5 ? 0.3 : 0.0;
          // once a crown is under a couple of pixels the line melts into its average: a fence row a dark band, a woodlot a wall
          float blur = smoothstep( 0.3, 0.9, fwidth( u ) / cell );
          vec3 col; float top, cover;
          if ( side < 1.5 ) {
            cover = fwLine( u, y, H, cell, gap, con, col, top );
            if ( kind < 0.5 && cover < 0.5 ) {
              // a woodlot's deeper trees behind the front ones: a second row of crowns, a little lower and in shade, and
              // under them a mosaic of crowns down to the ground
              float top2; vec3 col2;
              if ( fwLine( u + 531.7, y, H * 0.9, cell * 1.13, 0.0, con, col2, top2 ) > 0.5 ) { col = col2 * 0.78; cover = 1.0; }
              float back = H * 0.55;
              if ( cover < 0.5 && y < back ) {
                vec2 q = vec2( u / 6.0 + 0.5 * floor( y / 5.0 ), y / 5.0 ), c = floor( q ), f = q - c - 0.5;
                col = fwLeaf( fwHash( c + 4.1 ), con ) * ( 0.5 + 0.3 * clamp( y / back, 0.0, 1.0 ) ) * ( 1.0 - 0.3 * dot( f, f ) * 2.0 );
                cover = 1.0;
              }
            }
            vec3 avg = fwLeaf( 0.37, con ) * 0.75;
            if ( blur > 0.5 ) {
              float lo = kind > 0.5 ? H * 0.3 : -100.0;
              cover = step( lo, y ) * step( y, H * ( kind > 0.5 ? 0.82 : 0.95 ) );
              col = avg * mix( 0.7, 1.0, clamp( y / H, 0.0, 1.0 ) );
            } else col = mix( col, avg, blur );
            if ( cover < 0.5 ) discard;
          } else if ( side < 2.5 ) {
            // the top: a woodlot's closed canopy, a fence row's crowns from above, gaps and all
            if ( kind > 0.5 && blur < 0.5 ) {
              float c = floor( u / cell ), in0 = 0.0; col = vec3( 0.0 );
              for ( int k = -1; k <= 1; k++ ) {
                float ci = c + float( k ), h1 = fwHash( vec2( ci, 3.1 ) ), h2 = fwHash( vec2( ci, 8.7 ) );
                float r = cell * ( 0.2 + 0.1 * h2 ), cx = ( ci + 0.5 + ( h2 - 0.5 ) * 0.5 ) * cell;
                vec2 d = vec2( u - cx, vFw2.w ) / r;
                if ( h1 >= gap && dot( d, d ) < 1.0 ) { in0 = 1.0; col = fwLeaf( fract( h1 * 31.7 + h2 ), con ) * ( 1.0 - 0.35 * dot( d, d ) ); }
              }
              if ( in0 < 0.5 ) discard;
            } else {
              vec2 q = vFwW / 7.0, c = floor( q ), f = q - c - 0.5;
              float mb = smoothstep( 0.4, 1.4, length( fwidth( q ) ) );
              col = mix( fwLeaf( fwHash( c + 0.37 ), con ) * ( 1.0 - 0.4 * dot( f, f ) * 2.0 ), fwLeaf( 0.37, con ) * 0.8, mb );
            }
          } else discard;
          diffuseColor.rgb = col;
        }`));
  };
  m.customProgramCacheKey = () => 'farwoods' + (shell ? 'S' : 'B');
  return m;
}

/* the season's crown colours for this route, linear. Ohio's are the planted trees' autumn palette (05_scenery buildTrees),
   the mountain's its own (05d mtForestTile); the leaf texture and the shade inside a crown make them darker than the tint */
function farWoodsPalette() {
  const lin = c => new THREE.Vector3(...c.map(x => Math.pow(x * FARW.leafK, 2.2)));
  FARW.leafK = 0.62;
  const P = WORLD.mtn
    ? { pal: [[0.2, 0.33, 0.19], [0.33, 0.46, 0.16], [0.81, 0.60, 0.15], [0.73, 0.31, 0.11], [0.55, 0.40, 0.20]], cut: [0.45, 0.72, 0.90] }
    : { pal: [[0.21, 0.33, 0.2], [0.33, 0.48, 0.20], [0.79, 0.62, 0.16], [0.75, 0.32, 0.12], [0.55, 0.40, 0.20]], cut: [0.55, 0.80, 0.93] };
  FARW.pal = { value: P.pal.map(lin) }; FARW.cut = { value: new THREE.Vector3(...P.cut) };
  FARW.twig = { value: lin([0.47, 0.42, 0.39]) }; FARW.snow = { value: new THREE.Vector3(...[0.8, 0.83, 0.88].map(x => Math.pow(x, 2.2))) };
}

/* the unit block: x 0..1 along, z -0.5..0.5 across, y from below the ground up to the tallest crown (1.3 H).
   aFw.x: which face (0 a long side, 1 an end, 2 the top, 3 the underside never drawn); the top sits at the canopy's mean height */
function farBlockGeo() {
  const pos = [], nor = [], fw = [], idx = [], Y0 = -0.3, Y1 = 1, YT = 0.7;
  const quad = (a, b, c, d, n, face) => { const o = pos.length / 3; for (const p of [a, b, c, d]) { pos.push(...p); nor.push(...n); fw.push(face, 0, 0, 0); } idx.push(o, o + 1, o + 2, o, o + 2, o + 3); };
  quad([0, Y0, 0.5], [1, Y0, 0.5], [1, Y1, 0.5], [0, Y1, 0.5], [0, 0, 1], 0);
  quad([1, Y0, -0.5], [0, Y0, -0.5], [0, Y1, -0.5], [1, Y1, -0.5], [0, 0, -1], 0);
  quad([1, Y0, 0.5], [1, Y0, -0.5], [1, Y1, -0.5], [1, Y1, 0.5], [1, 0, 0], 1);
  quad([0, Y0, -0.5], [0, Y0, 0.5], [0, Y1, 0.5], [0, Y1, -0.5], [-1, 0, 0], 1);
  quad([0, YT, 0.5], [1, YT, 0.5], [1, YT, -0.5], [0, YT, -0.5], [0, 1, 0], 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('aFw', new THREE.Float32BufferAttribute(fw, 4));
  g.setIndex(idx);
  return g;
}

/* every woodlot and fence row in the field pattern over the far ground: [kind, X0, N0, along X?, length, width, real].
   Inside the inner region they follow the planted ones: a woodlot only if it was planted, a fence row broken where the
   planted trees keep clear of the track, the roads and the rivers (buildTrees ok()) */
function farFieldWoods(x0, x1, n0, n1) {
  const out = [], inIn = (X, N) => X > INNER.x0 + 20 && X < INNER.x1 - 20 && N > INNER.n0 + 20 && N < INNER.n1 - 20;
  const clear = (X, N, pad) => {
    if (riverDist(X, N) < 30) return false;
    for (const rx of WORLD.roadsX) if (Math.abs(X - rx) < 11 + pad) return false;   // the roads run on out across the far ground
    if (Math.abs(N - WORLD.roadN) < 12 + pad) return false;
    if (!inIn(X, N)) return true;
    const lat = latticeAt(X, N); if (lat && lat.d < 30 + pad) return false;
    if (WORLD.trackHash && trackWithin(X, N, 18 + pad)) return false;   // the lattice is a 20 m grid: check the real distance
    return !kept(X, N, pad);
  };
  // a fence row from (X0, N0) along X or N, in the runs that are clear of the track
  const row = (X0, N0, alongX, L) => {
    let s0 = null, last = 0;
    const close = () => { if (s0 !== null && last - s0 > 20) out.push([1, X0 + (alongX ? s0 : 0), N0 + (alongX ? 0 : s0), alongX, last - s0, 9, inIn(X0 + (alongX ? s0 : 0), N0 + (alongX ? 0 : s0)) ? 1 : 0]); s0 = null; };
    for (let s = 0; ; s = Math.min(L, s + 15)) {
      if (clear(X0 + (alongX ? s : 0), N0 + (alongX ? 0 : s), 6)) { if (s0 === null) s0 = s; last = s; } else close();   // a run ends at its last clear sample
      if (s >= L) break;
    }
    close();
  };
  for (let i = Math.floor((x0 + 40000) / FIELD.w); i <= Math.floor((x1 + 40000) / FIELD.w); i++)
    for (let j = Math.floor((n0 + 40000) / FIELD.h); j <= Math.floor((n1 + 40000) / FIELD.h); j++) {
      const X0 = i * FIELD.w - 40000, N0 = j * FIELD.h - 40000;
      const f = fieldAt(X0 + 1, N0 + 1);
      // the planted woodlot covers 0.18..0.82 by 0.2..0.78 of the field (buildTrees), crowns reaching 4 m past the last trunks
      if (f.t.n === 'woods') {
        const a = X0 + 0.18 * FIELD.w - 4, b = N0 + 0.2 * FIELD.h - 4, L = 0.64 * FIELD.w + 8, W = 0.58 * FIELD.h + 8, cn = b + W / 2;
        const inner = inIn(a + L / 2, cn);
        let ok = !inner || WORLD.fieldTex.planted(i, j);
        for (let q = 0; ok && q < 77; q++) ok = clear(a + L * (q % 11) / 10, b + W * Math.floor(q / 11) / 6, -2);
        if (ok) out.push([0, a, cn, true, L, W, inner ? 1 : 0]);
      }
      // fence rows, chosen by the same hashes as the planted ones
      if (Noise.hash(i * 3 + 1, j * 7 + 2) < 0.34) row(X0, N0, true, FIELD.w);
      if (Noise.hash(i * 5 + 3, j * 11 + 1) < 0.26) row(X0, N0, false, FIELD.h);
    }
  return out;
}

function buildFarBlocks(scene) {
  const reach = GFX.lite ? 7000 : 12000;
  const list = farFieldWoods(INNER.x0 - reach, INNER.x1 + reach, INNER.n0 - reach, INNER.n1 + reach);
  const mats = [], inst = [], r = rng(5150);
  for (const [kind, cx, cn, alongX, L, W, real] of list) {
    // the long axis (ax, an) and across it (px, pn), both in (X, N), turned so the block is not mirrored
    const ax = alongX ? 1 : 0, an = alongX ? 0 : 1, px = an, pn = -ax;
    // the block stands on the plane through its corners, so it follows a gentle slope; its sides run down below it
    const hA = (u, v) => groundAt(cx + ax * L * u + px * W * v, cn + an * L * u + pn * W * v);
    const h00 = hA(0, -0.5), h10 = hA(1, -0.5), h01 = hA(0, 0.5), h11 = hA(1, 0.5), h0 = (h00 + h01) / 2;
    const dyL = ((h10 + h11) - (h00 + h01)) / 2, dyW = ((h01 + h11) - (h00 + h10)) / 2;
    const H = (kind ? 11 : FARW.H) * (0.9 + 0.2 * r()) * 1.3, rnd = r();   // the unit block runs to 1.3 x the canopy height
    // where the ground under it dips or rises well away from that plane (a creek, a knoll) the block would float or be
    // buried: leave it out
    let ok = true;
    for (let q = 0; q < 15 && ok; q++) { const u = (q % 5) / 4, v = Math.floor(q / 5) / 2 - 0.5, d = hA(u, v) - (h0 + u * dyL + v * dyW); ok = d > -0.27 * H && d < 0.15 * H; }
    if (!ok) continue;
    // rows of the matrix; its columns are the block's axes (along, up, across) and its origin. World z is -N
    mats.push(new THREE.Matrix4().set(ax * L, 0, px * W, cx,
      dyL, H, dyW, h0,
      -an * L, 0, -pn * W, -cn,
      0, 0, 0, 1));
    inst.push(kind, real, kind ? 0.12 : 0.0, rnd);
  }
  const g = farBlockGeo(), n = mats.length;
  g.setAttribute('aFwI', new THREE.InstancedBufferAttribute(new Float32Array(inst), 4));
  const im = new THREE.InstancedMesh(g, farWoodsMaterial(false), n);
  mats.forEach((m, k) => im.setMatrixAt(k, m));
  im.frustumCulled = false; im.castShadow = false; im.receiveShadow = false;
  im.instanceMatrix.needsUpdate = true;
  scene.add(im); FARW.meshes.push(im); FARW.blocks = n;
}

/* how much of the ground the forest covers on the mountain routes (the same field mtForestTile plants by, without its thinning
   far from the line, since the woods out there are real woods too); 0 where trees can't stand */
function farCanopyAt(X, N, h, sl) {
  const wood = 0.55 + 0.5 * Noise.fbm(X / 420 + 9, N / 420 - 4, 3);
  let c = smooth(0.18, 0.45, wood);
  if (c <= 0) return 0;
  if (sl === undefined) sl = Math.hypot(heightRaw(X + 30, N) - heightRaw(X - 30, N), heightRaw(X, N + 30) - heightRaw(X, N - 30)) / 60;
  c *= 1 - 0.7 * smooth(0.8, 1.2, sl);                                        // bare rock on the steepest ground
  if (WORLD.frost) c *= smooth(10, 40, frShore(X, N));
  else c *= smooth(24, 60, mtRiverDist(X, N));
  // the right of way: cut back far enough that the skin, interpolated between its nodes, never lies over the rails
  if (farTrackNear(X, N, 55)) return 0;
  if (c > 0 && typeof inTown === 'function' && inTown(X, N)) c = 0;
  if (c > 0 && mtClearing(X, N, 20)) c = 0;
  return c;
}
/* any track within r (m) of (X, N), bridges included and tunnels not: the woods grow over a bore */
function farTrackNear(X, N, r) {
  if (!FARW.trk) {
    FARW.trk = new Map();
    for (const e of NET.edges) for (let s = 0; s <= e.len; s += 5) {
      if (e.isTunnel && e.isTunnel(s)) continue;
      const [x, n] = e.xz(s), k = Math.floor(x / 50) + ',' + Math.floor(n / 50); let a = FARW.trk.get(k); if (!a) FARW.trk.set(k, a = []); a.push(x, n);
    }
  }
  const ix = Math.floor(X / 50), iy = Math.floor(N / 50), c = Math.ceil(r / 50);
  for (let j = iy - c; j <= iy + c; j++) for (let i = ix - c; i <= ix + c; i++) {
    const a = FARW.trk.get(i + ',' + j); if (!a) continue;
    for (let q = 0; q < a.length; q += 2) if ((a[q] - X) ** 2 + (a[q + 1] - N) ** 2 < r * r) return true;
  }
  return false;
}
/* the conifer share at a spot (mtForestTile's conK) */
function farConAt(X, N, h) { return WORLD.frost ? 0.82 : clamp(0.18 + 0.55 * smooth(260, 560, h) + 0.35 * Noise.fbm(X / 300 - 2, N / 300 + 5, 2), 0.05, 0.9); }

/* the canopy skin over one grid: step-spaced nodes from (x0, n0), nx by nn, heights hAt; skip(X, N) leaves out a cell */
function farSkinGeo(x0, n0, step, nx, nn, hAt, skip) {
  const H = FARW.H, cov = new Float32Array(nx * nn), pos = new Float32Array(nx * nn * 3), fw = new Float32Array(nx * nn * 4), col = new Float32Array(nx * nn * 3), gc = [0, 0, 0, 0];
  const hs = new Float32Array(nx * nn);
  for (let j = 0; j < nn; j++) for (let i = 0; i < nx; i++) hs[j * nx + i] = hAt(x0 + i * step, n0 + j * step);
  const hg = (i, j) => hs[clamp(j, 0, nn - 1) * nx + clamp(i, 0, nx - 1)];
  for (let j = 0; j < nn; j++) for (let i = 0; i < nx; i++) {
    const X = x0 + i * step, N = n0 + j * step, k = j * nx + i, h = hs[k];
    const c = farCanopyAt(X, N, h, Math.hypot(hg(i + 1, j) - hg(i - 1, j), hg(i, j + 1) - hg(i, j - 1)) / (2 * step));   // the slope from the grid itself
    cov[k] = c;
    // up to tree height where the woods are, sunk into the ground where they end, so the edge meets the ground
    pos[k * 3] = X; pos[k * 3 + 1] = h - 3 + (H + 3) * Math.min(1, c * 1.6); pos[k * 3 + 2] = -N;
    const dT = mtField(MT.dT, X, N);
    fw[k * 4] = c; fw[k * 4 + 1] = farConAt(X, N, h); fw[k * 4 + 2] = 1 - smooth(2200, 3000, dT);
    groundColor(X, N, h, null, gc); for (let q = 0; q < 3; q++) col[k * 3 + q] = Math.pow(gc[q], 2.2);   // linear, as the scene draws
  }
  const idx = [];
  for (let j = 0; j < nn - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1;
    if (Math.max(cov[a], cov[b], cov[d], cov[e]) < 0.02) continue;
    if (skip && skip(x0 + (i + 0.5) * step, n0 + (j + 0.5) * step)) continue;
    idx.push(a, b, d, b, e, d);
  }
  if (!idx.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aFw', new THREE.BufferAttribute(fw, 4)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  (linearizeObject.done || (linearizeObject.done = new WeakSet())).add(col);
  g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}

function buildFarSkin(scene) {
  const mat = farWoodsMaterial(true), S = 1500;
  // inside the inner region: the far ground's own 75 m grid (buildTerrainTile), a block of 4 x 4 tiles to a draw
  for (let bx = INNER.x0; bx < INNER.x1; bx += S * 4) for (let bn = INNER.n0; bn < INNER.n1; bn += S * 4) {
    const w = Math.min(S * 4, INNER.x1 - bx), d = Math.min(S * 4, INNER.n1 - bn);
    const g = farSkinGeo(bx, bn, 75, Math.round(w / 75) + 1, Math.round(d / 75) + 1, (X, N) => groundAt(X, N));
    if (g) { const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = false; scene.add(m); FARW.meshes.push(m); }
  }
  // outside it: the far terrain's 250 m grid (buildFarTerrain), leaving out what lies inside
  const st = 250, x0 = INNER.x0 - 15000, n0 = INNER.n0 - 15000, nx = Math.round((INNER.x1 - INNER.x0 + 30000) / st) + 1, nn = Math.round((INNER.n1 - INNER.n0 + 30000) / st) + 1;
  const inside = (X, N) => X > INNER.x0 && X < INNER.x1 && N > INNER.n0 && N < INNER.n1;
  const g = farSkinGeo(x0, n0, st, nx, nn, (X, N) => heightRaw(X, N), inside);
  if (g) { const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = false; scene.add(m); FARW.meshes.push(m); }
}

function buildFarWoods(scene) {
  farWoodsPalette();
  if (WORLD.mtn) buildFarSkin(scene); else buildFarBlocks(scene);
}

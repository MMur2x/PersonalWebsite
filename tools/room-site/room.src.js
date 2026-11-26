/* Mayne's Room: the fixed 3D scene behind the page (three.js).
   You stand INSIDE a photoreal bedroom baked in Blender (assets/models/room.glb) and never leave it.
   Scrolling walks you from the doorway to the desk, the shelf, the wall of frames and the bed;
   clicking an object walks you up to it. All lighting is baked into four lightmap layers
   (night, lamps, desk lamp, day) that are blended live, so a frame is cheap and is only drawn
   when something actually changes.
   Build: tools/room-site -> npm run build -> assets/js/room.js. Public API (window.Room) is the same
   as the old hand-written renderer, so site.js does not care which one is running. */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Vector3, Vector4, Box3, Color, DataTexture, RGBAFormat,
  UnsignedByteType, LinearFilter, NoColorSpace, MeshBasicMaterial, FrontSide, OrthographicCamera, WebGLRenderTarget, HalfFloatType, PlaneGeometry, AgXToneMapping, SRGBColorSpace, ShaderChunk, Mesh, SphereGeometry,
  ShaderMaterial, BackSide, Object3D, MathUtils
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

(function () {
  'use strict';
  var canvas = document.getElementById('stage'), root = document.documentElement;
  if (!canvas) return;
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); }
  function sstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  var settled = false;
  function settle() { if (settled) return; settled = true; root.classList.remove('room-loading'); document.dispatchEvent(new CustomEvent('room:settled')); }
  function noWebGL(why) {
    if (why && window.console) console.warn('Mayne\'s Room:', why);
    root.classList.remove('has-webgl', 'room-loading'); root.classList.add('no-webgl'); settle();
  }

  /* ------------------------------------------------------------ renderer */
  var renderer, LOWGPU = false;
  try {
    // integrated / phone GPUs (measured on Intel Iris Xe): 4x MSAA cost ~25% of the frame, so they draw without it at 1x resolution
    var gpuName = (function () { try { var c = document.createElement('canvas').getContext('webgl'), x = c && c.getExtension('WEBGL_debug_renderer_info'), n = x ? c.getParameter(x.UNMASKED_RENDERER_WEBGL) : ''; var l = c && c.getExtension('WEBGL_lose_context'); if (l) l.loseContext(); return n || ''; } catch (e) { return ''; } })();
    LOWGPU = /[?&]gpu=high/.test(location.search) ? false : /intel|iris|uhd|hd graphics|mali|adreno|powervr|swiftshader|llvmpipe|microsoft basic/i.test(gpuName) || /[?&]gpu=low/.test(location.search);
    var aaQ = /[?&]aa=([01])/.exec(location.search);
    renderer = new WebGLRenderer({ canvas: canvas, antialias: aaQ ? aaQ[1] === '1' : (!LOWGPU && (window.devicePixelRatio || 1) < 2), alpha: false, powerPreference: 'high-performance', stencil: false });
  } catch (e) { noWebGL(e.message); window.Room = null; return; }
  root.classList.add('has-webgl', 'room-loading'); if (LOWGPU) root.classList.add('low-gpu');
  renderer.outputColorSpace = SRGBColorSpace; renderer.toneMapping = AgXToneMapping; renderer.setClearColor(0x050608, 1);
  var q = location.search;
  var coarse = window.matchMedia('(pointer: coarse)').matches, small = Math.min(screen.width, screen.height) < 820;
  var MOBILE = /[?&]room=mobile/.test(q) || (!/[?&]room=desktop/.test(q) && ((coarse && small) || (navigator.deviceMemory || 8) <= 4 || renderer.capabilities.maxTextureSize < 4096));
  var PROFILE = MOBILE ? 'mobile' : 'desktop', BASE = 'assets/models/';
  var GLB = BASE + (MOBILE ? 'room-mobile.glb' : 'room.glb'), LMDIR = BASE + 'lightmaps/' + PROFILE + '/';
  var scene = new Scene(), camera = new PerspectiveCamera(52, 1, .05, 1500);

  /* ------------------------------------------------------------ the room. 6.7 m wide (x), 5.8 m deep (z), 2.9 m tall. Back wall z=0, left wall x=0. */
  var W = 6.7, D = 5.8;
  /* camera: first person. ONE TIMELINE (p is scroll progress through #film).
     Each row is [p, where you stand, what you look at]. Eye height is about 1.6 m and every position is inside the room. */
  var CAM = [
    [0.00, [5.0, 1.62, 5.3], [1.9, 1.05, .9]],      // the doorway
    [0.06, [4.9, 1.62, 5.15], [1.9, 1.05, .9]],
    [0.20, [2.4, 1.52, 3.25], [1.45, 1.12, .3]],     // the desk
    [0.30, [2.3, 1.52, 3.1], [1.45, 1.12, .3]],
    [0.42, [2.35, 1.5, 2.75], [.1, 1.05, 2.25]],      // the shelf
    [0.52, [2.25, 1.5, 2.85], [.1, 1.05, 2.25]],
    [0.64, [2.45, 1.6, 4.3], [0, 1.85, 3.95]],        // the wall of frames
    [0.74, [2.3, 1.6, 4.35], [0, 1.85, 3.95]],
    [0.86, [3.0, 1.62, 3.8], [3.75, 1.15, .6]],      // the bed and the window
    [1.00, [3.1, 1.62, 3.65], [3.8, 1.15, .6]]
  ];
  var STOPS = [0, .25, .47, .69, .93];
  function camAt(p) {
    for (var i = 1; i < CAM.length; i++) if (p <= CAM[i][0]) {
      var a = CAM[i - 1], b = CAM[i], t = smooth((p - a[0]) / (b[0] - a[0]));
      return [[lerp(a[1][0], b[1][0], t), lerp(a[1][1], b[1][1], t), lerp(a[1][2], b[1][2], t)], [lerp(a[2][0], b[2][0], t), lerp(a[2][1], b[2][1], t), lerp(a[2][2], b[2][2], t)]];
    }
    var l = CAM[CAM.length - 1]; return [l[1], l[2]];
  }

  /* hotspots: name: [x, y, z, stops where it is offered (the last one is its home), viewing distance].
     x, y, z are replaced by the spot_<name> markers in room.glb once it has loaded. */
  var SPOT = {
    monitor: [1.5, 1.31, .45, [0, 1], 1.25], laptop: [2.45, 1.02, .56, [1], 1.05], paper: [.73, .82, .83, [1], .95], lamp: [.92, 1.3, .32, [1], 1.15],
    calendar: [.71, 1.8, .02, [1], 1.35], qr: [2.58, 1.83, .02, [1], 1.35], books: [.3, .72, 2.62, [0, 2], 1.35], diploma: [.05, 1.61, 3.06, [2], 1.1], cap: [.17, 2.0, 2.41, [2], 1.15],
    frames: [.04, 2.05, 4.2, [0], 1.6], f0: [.04, 1.6, 3.72, [3], 1.15], f1: [.04, 1.6, 4.22, [3], 1.15], f2: [.04, 1.6, 4.72, [3], 1.15], f3: [.04, 2.28, 3.97, [3], 1.15], f4: [.04, 2.28, 4.47, [3], 1.15],
    portrait: [3.21, .69, .24, [4], 1.0], phone: [3.2, .52, .49, [4], .95], window: [4.55, 1.92, -.06, [0, 4], 2.0], bag: [3.95, .82, 2.22, [4], 1.2]
  };
  function stationEye(stop) { return camAt(Math.min(1, STOPS[stop] + .03))[0]; }
  function inRoom(e) { e[0] = clamp(e[0], .45, W - .45); e[2] = clamp(e[2], .45, D - .4); return e; }
  function focusPose(key) { // stand a comfortable distance from the object, on the line back to where you were standing
    var s = SPOT[key], se = stationEye(s[3][s[3].length - 1]), dx = se[0] - s[0], dz = se[2] - s[2], l = Math.hypot(dx, dz) || 1, d = s[4];
    return [inRoom([s[0] + dx / l * d, clamp(s[1] + .42, 1.18, 1.66), s[2] + dz / l * d]), [s[0], s[1], s[2]]];
  }
  var spots = $$('[data-spot]').map(function (el) { var k = el.getAttribute('data-spot'), s = SPOT[k]; return s ? { el: el, key: k, p: s } : null; }).filter(Boolean);
  var hi = null;   // the hotspot whose dot the pointer is on: its object glows a little
  spots.forEach(function (s) {
    s.el.addEventListener('pointerenter', function () { hi = s.key; kick(); }); s.el.addEventListener('pointerleave', function () { hi = null; kick(); });
    s.el.addEventListener('focus', function () { hi = s.key; kick(); }); s.el.addEventListener('blur', function () { hi = null; kick(); });
  });

  /* furniture footprints [x0, z0, x1, z1] for walking; replaced by the col_* boxes in room.glb */
  var SOLID = [[.45, .12, 2.95, 1.06], [3.5, .06, 5.85, 2.5], [0, 2.0, .34, 3.3], [6.1, 3.75, 6.7, 4.95], [2.99, .12, 3.43, .6], [1.24, 1.42, 1.86, 2.04], [.11, 3.61, .45, 3.95], [6.05, 3.4, 6.35, 3.7], [0, 4.04, .3, 4.9], [5.68, 3.33, 5.92, 3.57], [6.13, 2.63, 6.57, 3.07], [6.0, .15, 6.55, .65], [6.12, .86, 6.56, 1.3], [6.42, 1.5, 6.7, 2.0], [.14, 4.98, 1.1, 5.66], [6.05, 5.2, 6.6, 5.62], [6.2, 5.6, 6.5, 5.8]];
  var OCC = [];   // the same boxes in 3D, used to hide dots that furniture is in front of

  /* ------------------------------------------------------------ baked light: four layers blended in one shader patch.
     Files store (irradiance / scale) ^ (1/2.2); manifest.json has each file's scale. */
  var LAYERS = ['night', 'practical', 'desklamp', 'day'];
  var black = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, RGBAFormat, UnsignedByteType); black.channel = 1; black.needsUpdate = true;
  var uW = { value: new Vector4(0, 0, 0, 0) };          // layer weights: night, lamps, desk lamp, day
  var uAmb = { value: new Color(0, 0, 0) };              // a little light for the few small things that have no baked light (cables, mug handle)
  var uVS = { value: new Vector4(0, 0, 0, 0) };          // plant vertex-light scales
  var LM_PARS = 'uniform sampler2D lmP; uniform sampler2D lmL; uniform sampler2D lmD; uniform vec4 uS; uniform vec4 uW;\n' +
    'vec3 mrDec(sampler2D t, vec2 uv) { return pow(texture2D(t, uv).rgb, vec3(2.2)); }\n' +
    'vec3 mrLM(vec2 uv) { vec3 L = mrDec(lightMap, uv) * (uS.x * uW.x);\n' +
    '  if (uW.y > 0.001) L += mrDec(lmP, uv) * (uS.y * uW.y);\n' +
    '  if (uW.z > 0.001) L += mrDec(lmL, uv) * (uS.z * uW.z);\n' +
    '  if (uW.w > 0.001) L += mrDec(lmD, uv) * (uS.w * uW.w);\n' +
    '  return L * PI; }\n';
  /* pre-mixed light: whenever the weights change, each area's four layers are mixed ONCE into a half-float texture, so every
     pixel on screen reads one lightmap instead of four (measured: ~20% of GPU time). Without half-float render targets the
     mixing happens per pixel instead (the LM_PARS path). */
  var COMBINE = !/[?&]combine=0/.test(q) && renderer.capabilities.isWebGL2 && (renderer.extensions.has('EXT_color_buffer_half_float') || renderer.extensions.has('EXT_color_buffer_float'));
  var groups = {}, mixW = new Vector4(-1, -1, -1, -1), mixDirty = true;
  var mixCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1), mixScene = new Scene();
  var mixMat = new ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { t0: { value: black }, t1: { value: black }, t2: { value: black }, t3: { value: black }, uS: { value: new Vector4() }, uW: uW },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: 'uniform sampler2D t0; uniform sampler2D t1; uniform sampler2D t2; uniform sampler2D t3; uniform vec4 uS; uniform vec4 uW; varying vec2 vUv;\n' +
      'vec3 d(sampler2D t) { return pow(texture2D(t, vUv).rgb, vec3(2.2)); }\n' +
      'void main() { gl_FragColor = vec4(3.14159265 * (d(t0) * uS.x * uW.x + d(t1) * uS.y * uW.y + d(t2) * uS.z * uW.z + d(t3) * uS.w * uW.w), 1.); }'
  });
  var mixQuad = new Mesh(new PlaneGeometry(2, 2), mixMat); mixQuad.frustumCulled = false; mixScene.add(mixQuad);
  function remix() {   // a few ms on an integrated GPU; only runs while the lights are changing
    var keep = renderer.getRenderTarget(), u = mixMat.uniforms;
    for (var g in groups) { var G = groups[g]; u.t0.value = G.u[0].value; u.t1.value = G.u[1].value; u.t2.value = G.u[2].value; u.t3.value = G.u[3].value; u.uS.value.copy(G.s); renderer.setRenderTarget(G.rt); renderer.render(mixScene, mixCam); }
    renderer.setRenderTarget(keep); mixW.copy(uW.value); mixDirty = false;
  }
  function needRemix() { var a = uW.value, b = mixW; return mixDirty || Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z), Math.abs(a.w - b.w)) > .003; }
  var MAPS = ShaderChunk.lights_fragment_maps;
  var MAPS_LM = MAPS.replace('vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;', 'vec3 lightMapIrradiance = mrLM( vLightMapUv );');
  var HI = '#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(1.0, .8, .55) * uHi * .05;';
  var VTX_PARS = 'attribute vec4 aLmN; attribute vec4 aLmP; attribute vec4 aLmL; attribute vec4 aLmD; uniform vec4 uW; uniform vec4 uVS; varying vec3 vLm;\n';
  var VTX_MAIN = '#include <begin_vertex>\n vLm = PI * (pow(aLmN.rgb, vec3(2.2)) * uVS.x * uW.x + pow(aLmP.rgb, vec3(2.2)) * uVS.y * uW.y + pow(aLmL.rgb, vec3(2.2)) * uVS.z * uW.z + pow(aLmD.rgb, vec3(2.2)) * uVS.w * uW.w);';
  // MeshBasicMaterial: with no live lights and no reflections, colour = albedo x baked light. Same pixels as the PBR shader, far less work per pixel.
  var B_LM = 'vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );', B_LMADD = 'reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;';
  var B_ONE = 'reflectedLight.indirectDiffuse += vec3( 1.0 );', B_OUT = 'vec3 outgoingLight = reflectedLight.indirectDiffuse;';
  function patchBasic(sh, u) {
    var f = 'uniform float uHi;\n' + sh.fragmentShader.replace(B_OUT, B_OUT + '\n outgoingLight += vec3(1.0, .8, .55) * uHi * .05;');
    if (u.kind === 'lm') {
      if (COMBINE) { sh.fragmentShader = f; return; }   // the pre-mixed texture is a plain lightmap: three's own code reads it
      sh.uniforms.lmP = u.lmP; sh.uniforms.lmL = u.lmL; sh.uniforms.lmD = u.lmD; sh.uniforms.uS = u.uS;
      f = f.replace('#include <lightmap_pars_fragment>', '#include <lightmap_pars_fragment>\n' + LM_PARS).replace(B_LM, '').replace(B_LMADD, 'reflectedLight.indirectDiffuse += mrLM( vLightMapUv ) * RECIPROCAL_PI;');
    } else if (u.kind === 'vtx') {
      sh.uniforms.uVS = uVS;
      sh.vertexShader = VTX_PARS + sh.vertexShader.replace('#include <begin_vertex>', VTX_MAIN);
      f = 'varying vec3 vLm;\n' + f.replace(B_ONE, 'reflectedLight.indirectDiffuse += vLm * RECIPROCAL_PI;');
    } else {
      sh.uniforms.uAmb = uAmb; f = 'uniform vec3 uAmb;\n' + f.replace(B_ONE, 'reflectedLight.indirectDiffuse += uAmb;');
    }
    sh.fragmentShader = f;
  }
  function toBasic(m0) {   // keep what is visible: colour texture, tint, transparency, cut-out
    return new MeshBasicMaterial({ name: m0.name, map: m0.map, color: m0.color, transparent: m0.transparent, opacity: m0.opacity, alphaTest: m0.alphaTest, alphaMap: m0.alphaMap, side: m0.side, depthWrite: m0.depthWrite, blending: m0.blending });
  }
  function patch(m, kind) {   // kind: 'lm' (lightmap on UV1), 'vtx' (plants: light per vertex), 'amb' (nothing baked)
    m.userData.kind = kind; m.userData.uHi = { value: 0 };
    m.onBeforeCompile = function (sh) {
      var u = this.userData; sh.uniforms.uW = uW; sh.uniforms.uHi = u.uHi;
      if (this.isMeshBasicMaterial) return patchBasic(sh, u);
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform float uHi;\nvoid main() {').replace('#include <emissivemap_fragment>', HI);
      if (u.kind === 'lm') {
        if (COMBINE) return;
        sh.uniforms.lmP = u.lmP; sh.uniforms.lmL = u.lmL; sh.uniforms.lmD = u.lmD; sh.uniforms.uS = u.uS;
        sh.fragmentShader = sh.fragmentShader.replace('#include <lightmap_pars_fragment>', '#include <lightmap_pars_fragment>\n' + LM_PARS).replace('#include <lights_fragment_maps>', MAPS_LM);
      } else if (u.kind === 'vtx') {
        sh.uniforms.uVS = uVS;
        sh.vertexShader = VTX_PARS + sh.vertexShader.replace('#include <begin_vertex>', VTX_MAIN);
        sh.fragmentShader = 'varying vec3 vLm;\n' + sh.fragmentShader.replace('#include <lights_fragment_maps>', MAPS + '\n irradiance += vLm;');
      } else {
        sh.uniforms.uAmb = uAmb;
        sh.fragmentShader = 'uniform vec3 uAmb;\n' + sh.fragmentShader.replace('#include <lights_fragment_maps>', MAPS + '\n irradiance += uAmb * PI;');
      }
    };
    m.customProgramCacheKey = function () { return 'mr-' + kind + (m.isMeshBasicMaterial ? 'b' : 's'); };
    return m;
  }

  /* emissive things follow the lights coming on: [material or node name, which light] */
  var GLOWS = [];   // { m, base, src }
  function glowSource(node, mat) {
    var n = node.name, mn = mat.name;
    if (/^screen_|phone_screen/.test(mn)) return 'monitor';
    if (mn === 'G_desk_glow' || n === 'lamp_bulb') return 'desk';
    if (mn === 'G_rightwall_glow' || n === 'floor_lamp_bulb') return 'floor';
    if (mn === 'led_strip') return 'led';
    if (mn === 'fairy_bulb') return 'floor';
    if (n === 'moon') return 'moon';
    return 'base';   // lava lamp, console light: on whenever the room is
  }

  /* ------------------------------------------------------------ the sky outside the window: follows the visitor's clock */
  var sky = new Mesh(new SphereGeometry(1000, 32, 16), new ShaderMaterial({
    side: BackSide, depthWrite: false,
    uniforms: { uDay: { value: 0 }, uDusk: { value: 0 }, uSun: { value: new Vector3(0, 1, 0) } },
    vertexShader: 'varying vec3 vD; void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }',
    fragmentShader: 'uniform float uDay; uniform float uDusk; uniform vec3 uSun; varying vec3 vD;\n' +
      'float h(vec3 p) { p = fract(p * .3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }\n' +
      'void main() { float y = clamp(vD.y, -.2, 1.0);\n' +
      ' vec3 night = mix(vec3(.018, .025, .06), vec3(.004, .006, .02), smoothstep(0., .6, y));\n' +
      ' vec3 day = mix(vec3(.62, .74, .9), vec3(.22, .42, .78), smoothstep(0., .7, y));\n' +
      ' vec3 dusk = mix(vec3(1.0, .5, .25), vec3(.3, .25, .45), smoothstep(-.05, .45, y));\n' +
      ' vec3 c = mix(night, day, uDay); c = mix(c, dusk, uDusk * .75 * (1. - smoothstep(.2, .7, y)));\n' +
      ' float s = pow(max(dot(vD, uSun), 0.), 600.) * 30. + pow(max(dot(vD, uSun), 0.), 8.) * .25; c += vec3(1., .85, .6) * s * max(uDay, uDusk);\n' +
      ' vec3 g = floor(vD * 260.); float st = step(.9965, h(g)) * (1. - uDay) * smoothstep(.02, .2, y); c += st * (.5 + .5 * h(g + 3.1));\n' +
      ' gl_FragColor = vec4(c, 1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'
  }));
  sky.renderOrder = 10; sky.frustumCulled = false; scene.add(sky);   // drawn after the room, so only the pixels seen through the window pay for it

  /* the time outside: it starts at your own clock and a whole day passes every DAY_LEN seconds. Room.time(15.5) pins it, Room.time(null) lets it run again. */
  var DAY_LEN = 360, todStart = (function () { var d = new Date(); return d.getHours() + d.getMinutes() / 60; })(), todT0 = performance.now(), todFixed = null;
  function hourNow() { if (todFixed !== null) return todFixed; var h = todStart + (calm ? 0 : (performance.now() - todT0) / 1000 * 24 / DAY_LEN); return ((h % 24) + 24) % 24; }
  var dayAmt = 0, duskAmt = 0;
  function setDay() {
    var h = hourNow(); dayAmt = sstep(5.4, 7.4, h) * (1 - sstep(17.6, 19.6, h));
    duskAmt = Math.min(1, Math.exp(-Math.pow((h - 6.4) / 1.1, 2)) + Math.exp(-Math.pow((h - 18.6) / 1.1, 2)));
    var a = clamp((h - 6) / 12, -.04, 1.04) * Math.PI;
    sky.material.uniforms.uDay.value = dayAmt; sky.material.uniforms.uDusk.value = duskAmt;
    sky.material.uniforms.uSun.value.set(Math.cos(a) * .8, .1 + Math.sin(a) * .95, -.6).normalize();
  }

  /* ------------------------------------------------------------ load the room */
  var ready = false, hiMats = {}, model = null, clockHands = null, moons = [];
  var ktx2 = new KTX2Loader().setTranscoderPath('assets/vendor/basis/').detectSupport(renderer);
  var gltfLoader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
  var loaderText = $('#loader .mono'), loaderBase = loaderText ? loaderText.textContent : '';
  function progressText(f) { if (loaderText) loaderText.textContent = loaderBase + (f > 0 && f < 1 ? '  ' + Math.round(f * 100) + '%' : ''); }
  var manifestP = fetch(LMDIR + 'manifest.json').then(function (r) { if (!r.ok) throw new Error('manifest ' + r.status); return r.json(); });
  var glbP = new Promise(function (res, rej) { gltfLoader.load(GLB, res, function (e) { if (e.total) progressText(e.loaded / e.total * .9); }, rej); });
  var lmTex = {};   // file -> Promise<texture>
  function loadLM(file) {
    if (!lmTex[file]) lmTex[file] = ktx2.loadAsync(LMDIR + file).then(function (t) { t.channel = 1; t.flipY = false; t.colorSpace = NoColorSpace; t.minFilter = LinearFilter; t.generateMipmaps = false; return t; });
    return lmTex[file];
  }
  Promise.all([glbP, manifestP]).then(function (r) {
    var gltf = r[0], man = r[1].groups, vsc = (gltf.parser.json.extras || {}).vertexLightmapScale || {};
    model = gltf.scene; uVS.value.set(vsc.night || 0, vsc.practical || 0, vsc.desklamp || 0, vsc.day || 0);
    var cache = {}, solids = [], nightJobs = [], laterJobs = [];
    function makeGroup(e) {   // one area of the room: its four lightmap layers and (when pre-mixing) the texture they are mixed into
      var G = { s: new Vector4(), u: [{ value: black }, { value: black }, { value: black }, { value: black }], mats: [] }, size = 4;
      LAYERS.forEach(function (L, i) {
        if (!e[L]) return; G.s.setComponent(i, e[L].scale); size = Math.max(size, e[L].size || 512);
        var job = function () { return loadLM(e[L].file).then(function (t) { G.u[i].value = t; if (!COMBINE && i === 0) G.mats.forEach(function (m) { m.lightMap = t; }); mixDirty = true; }); };
        if (i === 0) nightJobs.push(job()); else laterJobs.push(job);
      });
      if (COMBINE) { G.rt = new WebGLRenderTarget(size, size, { type: HalfFloatType, format: RGBAFormat, minFilter: LinearFilter, magFilter: LinearFilter, generateMipmaps: false, depthBuffer: false }); G.rt.texture.channel = 1; }
      return G;
    }
    model.updateMatrixWorld(true);
    model.traverse(function (o) {
      if (/^spot_/.test(o.name)) { var k = o.name.slice(5), w = new Vector3(); o.getWorldPosition(w); if (SPOT[k]) { SPOT[k][0] = w.x; SPOT[k][1] = w.y; SPOT[k][2] = w.z; } }
      if (/^col_/.test(o.name) && o.isMesh) { var b = new Box3().setFromObject(o); solids.push([b.min.x, b.min.z, b.max.x, b.max.z]); OCC.push([b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z]); o.visible = false; return; }
      if (!o.isMesh) return;
      o.matrixAutoUpdate = false;
      var p = o, g; while (p && (g = p.userData.lm_group) === undefined) p = p.parent;   // multi-material objects keep the tag on their parent
      var hot = null; p = o; while (p) { if (SPOT[p.name]) { hot = p.name; break; } p = p.parent; }
      var a = o.geometry.attributes, kind = a._lm_night ? 'vtx' : (man[g] ? 'lm' : 'amb');
      if (kind === 'vtx') [['aLmN', '_lm_night'], ['aLmP', '_lm_practical'], ['aLmL', '_lm_desklamp'], ['aLmD', '_lm_day']].forEach(function (x) { if (a[x[1]]) { o.geometry.setAttribute(x[0], a[x[1]]); o.geometry.deleteAttribute(x[1]); } });
      var mats = Array.isArray(o.material) ? o.material : [o.material];
      mats = mats.map(function (m0) {
        var src = (m0.emissive && (m0.emissiveMap || m0.emissive.getHex())) ? glowSource(o, m0) : null;
        var key = m0.uuid + '|' + kind + '|' + g + '|' + (hot || '') + '|' + (src === 'desk' || src === 'floor' ? o.name : '');
        var m = cache[key];
        if (!m) {
          // glowing things keep the standard shader (they need emission); everything else is albedo x baked light
          m = cache[key] = patch(src ? m0.clone() : toBasic(m0), kind);
          if (m.isMeshStandardMaterial) { m.metalness = 0; m.metalnessMap = null; }   // no reflections (measured: they doubled the cost of every pixel), so metal keeps its baked colour
          if (!/[?&]side=double/.test(q) && !m.transparent && !m.alphaTest) m.side = FrontSide;   // backs of closed objects are never seen (measured: ~25% of GPU time)
          if (kind === 'lm') {
            var G = groups[g] || (groups[g] = makeGroup(man[g])), u = m.userData;
            G.mats.push(m); u.uS = { value: G.s }; u.lmP = G.u[1]; u.lmL = G.u[2]; u.lmD = G.u[3];
            m.lightMap = COMBINE ? G.rt.texture : black; m.lightMapIntensity = 1;
          }
          if (src) GLOWS.push({ m: m, base: m.emissiveIntensity, src: src });
          if (hot) (hiMats[hot] = hiMats[hot] || []).push(m);
        }
        return m;
      });
      o.material = Array.isArray(o.material) ? mats : mats[0];
      if (o.name === 'moon') moons.push(o);
      // draw order: three.js sorts by distance to each object's centre, and the scenery outside is 170 m wide with its centre near the
      // room, so it was drawn FIRST and then painted over (measured: 3 ms of a 14 ms frame). Things outside go last, the room shell after the furniture.
      var top = o; while (top.parent && top.parent !== model) top = top.parent;
      if (/^(outdoor|moon)/.test(o.name) || /^(outdoor|moon)/.test(top.name)) o.renderOrder = 5;
      else if (/^(walls|floor)_static/.test(o.name) || /^(walls|floor)_static/.test(top.name)) o.renderOrder = 4;
    });
    if (solids.length) SOLID = solids;
    // the wall clock tells the visitor's time: hands turn about the hub
    var hub = model.getObjectByName('clock_hub');
    if (hub) {
      var hc = new Vector3(); hub.getWorldPosition(hc); clockHands = [];
      ['clock_hand_hour', 'clock_hand_minute', 'clock_hand_second'].forEach(function (n, i) {
        var h = model.getObjectByName(n); if (!h) return;
        var c = new Box3().setFromObject(h).getCenter(new Vector3()), a0 = Math.atan2(c.y - hc.y, c.x - hc.x), piv = new Object3D();
        piv.position.copy(hc); h.parent.add(piv); piv.updateMatrixWorld(true); piv.attach(h); h.matrixAutoUpdate = true;
        clockHands.push({ piv: piv, a0: a0, i: i });
      });
    }
    scene.add(model);
    return Promise.all(nightJobs).then(function () { return laterJobs; });
  }).then(function (laterJobs) {
    progressText(1); setDay(); refreshLights(); if (COMBINE) remix();
    renderer.compile(scene, camera); ready = true; kick();
    // the lamps and daylight layers arrive after the first frames, one at a time, so the first view is quick
    var i = 0; (function next() { if (i >= laterJobs.length) { later = true; dirty = true; kick(); return; } laterJobs[i++]().then(function () { dirty = true; kick(); next(); }, next); })();
  }).catch(function (e) { noWebGL(e && e.message ? e.message : String(e)); });
  var later = false;

  /* ------------------------------------------------------------ state + frame */
  var film = $('#film'), p = 0, pShown = 0, time = 0, last = 0, raf = null, visible = true, tier = 0, applied = 0, wantSharp = false, slow = 0, retier = false, idle = true, dirty = true;
  var intro = calm ? 1 : 0, introT = 0, lampOn = true, on = [0, 0, 0, 0, 0], px = 0, py = 0, sx = 0, sy = 0;
  var cur = null, tgt = null, focus = null, fAmt = 0, walk = 0, FOLLOW = 4.6;   // FOLLOW: how quickly the camera catches up (higher = snappier)
  // free walking: WALK_SPEED in metres a second, TURN_SPEED in radians a second (keys), BODY is how close you can get to furniture
  var free = false, fpos = [0, 0, 0], yaw = 0, pitch = 0, keys = {}, joy = [0, 0], vel = [0, 0], par = 1, WALK_SPEED = 1.9, TURN_SPEED = 1.9, BODY = .28, EYE = 1.6;
  var eye = new Vector3(), look = new Vector3(), tmp = new Vector3();
  function collide(q) { // keep the walker inside the walls and out of the furniture
    q[0] = clamp(q[0], BODY + .05, W - BODY - .05); q[2] = clamp(q[2], BODY + .05, D - BODY - .05);
    for (var i = 0; i < SOLID.length; i++) {
      var b = SOLID[i], nx = clamp(q[0], b[0], b[2]), nz = clamp(q[2], b[1], b[3]), dx = q[0] - nx, dz = q[2] - nz, d2 = dx * dx + dz * dz;
      if (d2 >= BODY * BODY) continue;
      if (d2 > 1e-8) { var d = Math.sqrt(d2); q[0] = nx + dx / d * BODY; q[2] = nz + dz / d * BODY; }
      else { var l = q[0] - b[0], r = b[2] - q[0], n = q[2] - b[1], f2 = b[3] - q[2], m = Math.min(l, r, n, f2); if (m === l) q[0] = b[0] - BODY; else if (m === r) q[0] = b[2] + BODY; else if (m === n) q[2] = b[1] - BODY; else q[2] = b[3] + BODY; }
    }
    return q;
  }
  function blocked(o, d, maxT, target) { // does any furniture box sit between the eye and a dot? Boxes holding the dot itself do not count.
    for (var i = 0; i < OCC.length; i++) {
      var b = OCC[i], m = .06;
      if (target[0] > b[0] - m && target[0] < b[3] + m && target[1] > b[1] - m && target[1] < b[4] + m && target[2] > b[2] - m && target[2] < b[5] + m) continue;
      var t0 = 0, t1 = maxT, ok = true;
      for (var a = 0; a < 3 && ok; a++) {
        if (Math.abs(d[a]) < 1e-9) { if (o[a] < b[a] || o[a] > b[a + 3]) ok = false; continue; }
        var u = (b[a] - o[a]) / d[a], v = (b[a + 3] - o[a]) / d[a]; if (u > v) { var s = u; u = v; v = s; }
        t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) ok = false;
      }
      if (ok) return true;
    }
    return false;
  }
  function aimFromCamera() { var dx = tgt[0] - cur[0], dy = tgt[1] - cur[1], dz = tgt[2] - cur[2]; yaw = Math.atan2(dx, -dz); pitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -.9, .9); fpos[0] = cur[0]; fpos[1] = cur[1]; fpos[2] = cur[2]; }
  function setFree(v, quiet) {
    if (v === free || !cur) return; free = v; vel[0] = vel[1] = 0;
    if (v) { focus = null; aimFromCamera(); }
    if (!quiet) document.dispatchEvent(new CustomEvent('room:explore', { detail: { on: v } })); kick();
  }
  function resize() {
    var cap = LOWGPU ? (MOBILE ? 1.5 : 1) : MOBILE ? 1.5 : 2, dpr = Math.max(.6, Math.min(cap, window.devicePixelRatio || 1) * [1, .85, .72, .62][applied]);
    renderer.setPixelRatio(dpr); renderer.setSize(window.innerWidth, window.innerHeight, false); dirty = true;
  }
  function progress() { var max = film ? film.offsetHeight - window.innerHeight : 1; return clamp(window.pageYOffset / Math.max(1, max), 0, 1); }
  // the lights: moon (room light), monitor, desk lamp, floor lamp, LED strip -> layer weights, glows and exposure
  var flick = 1;
  function refreshLights() {
    var base = on[0], d = dayAmt;
    uW.value.set(base * (1 - d), on[3] * .62 + on[4] * .38, on[2], base * d);
    uAmb.value.setRGB(.004 + .3 * d, .004 + .3 * d, .006 + .3 * d).multiplyScalar(base);
    renderer.toneMappingExposure = lerp(2.07, 1.0, d);
    for (var i = 0; i < GLOWS.length; i++) {
      var g = GLOWS[i], k = g.src === 'monitor' ? on[1] * flick : g.src === 'desk' ? on[2] : g.src === 'floor' ? on[3] : g.src === 'led' ? on[4] : g.src === 'moon' ? 1 - d : base;
      g.m.emissiveIntensity = g.base * k;
    }
    for (i = 0; i < moons.length; i++) moons[i].visible = d < .98;
  }
  setInterval(function () { if (!calm && todFixed === null && visible && ready && !document.body.classList.contains('dim')) { dirty = true; kick(); } }, 250);   // the sky keeps moving while you stand still
  var lastClock = -1;
  function tickClock() {
    if (!clockHands) return false;
    var d = new Date(), s = d.getSeconds(); if (s === lastClock) return false; lastClock = s;
    var hh = d.getHours() % 12 + d.getMinutes() / 60, mm = d.getMinutes() + s / 60, A = [hh / 12, mm / 60, s / 60];
    clockHands.forEach(function (c) { c.piv.rotation.z = (Math.PI / 2 - A[c.i] * Math.PI * 2) - c.a0; });
    return true;
  }
  setInterval(function () { if (visible && ready && tickClock()) { dirty = true; kick(); } }, 1000);
  var frames = [], bench = null, hiShown = null;

  function frame(now) {
    raf = null; var dt = idle ? .016 : Math.min(.12, (now - last) / 1000 || .016), i; last = now; idle = false;   // real elapsed time, so a slow machine keeps up with the scroll instead of playing in slow motion
    // dynamic resolution: a slow GPU draws fewer pixels only while the view moves; the frame you stop on is drawn sharp
    var tt = wantSharp ? 0 : tier; if (retier || tt !== applied) { retier = false; applied = tt; resize(); }
    if (!ready) { renderer.render(scene, camera); return; }
    if (!calm) time += dt;
    p = progress(); pShown += (p - pShown) * (calm ? 1 : 1 - Math.pow(.0008, dt));
    if (intro < 1) { introT += dt * (p > .015 ? 4 : 1); intro = Math.min(1, introT / 2.6); if (intro > .8) settle(); } else settle();
    // the lights come on one after another: moon, monitor, desk lamp, floor lamp, LED strip
    var want = [intro > .02 ? 1 : 0, intro > .3 ? 1 : 0, (intro > .5 && lampOn) ? 1 : 0, intro > .82 ? 1 : 0, intro > .66 ? 1 : 0], k = 1 - Math.pow(.004, dt);
    for (i = 0; i < 5; i++) on[i] += (want[i] - on[i]) * (calm ? 1 : k);
    flick = (intro > .3 && intro < .42) ? (Math.sin(time * 70) > 0 ? 1 : .25) : 1;
    sx += (px - sx) * .07; sy += (py - sy) * .07;
    setDay(); refreshLights(); if (COMBINE && needRemix()) remix();

    // where the camera wants to be: the scroll position, or right in front of the thing you clicked
    var aspect = window.innerWidth / Math.max(1, window.innerHeight), c = camAt(pShown), want2 = focus ? focusPose(focus) : c, e = want2[0], t = want2[1], walking = free && !focus && cur, mx = 0, mz = 0;
    if (walking) { // you are steering: keys, the on-screen stick, and drag to look
      mx = (keys.d ? 1 : 0) - (keys.a ? 1 : 0) + joy[0]; mz = (keys.w ? 1 : 0) - (keys.s ? 1 : 0) + joy[1]; var ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
      yaw += ((keys.e ? 1 : 0) - (keys.q ? 1 : 0)) * TURN_SPEED * dt;
      var ease = 1 - Math.exp(-dt * 9); vel[0] += (mx * WALK_SPEED - vel[0]) * ease; vel[1] += (mz * WALK_SPEED - vel[1]) * ease;
      var sy2 = Math.sin(yaw), cy2 = Math.cos(yaw), cp = Math.cos(pitch);
      fpos[0] += (cy2 * vel[0] + sy2 * vel[1]) * dt; fpos[2] += (sy2 * vel[0] - cy2 * vel[1]) * dt; fpos[1] += (EYE - fpos[1]) * ease * .5; collide(fpos);
      e = fpos; t = [fpos[0] + sy2 * cp * 2, fpos[1] + Math.sin(pitch) * 2, fpos[2] - cy2 * cp * 2];
    }
    if (window.__cam) { e = window.__cam[0]; t = window.__cam[1]; }   // debugging: look from anywhere
    if (aspect < .9 && !focus && !free) { var back = 1 + (1 - aspect) * .55 * (pShown > .12 ? 1 : .2); e = inRoom([t[0] + (e[0] - t[0]) * back, e[1], t[2] + (e[2] - t[2]) * back]); }   // phones step back, but never through a wall
    if (!cur) { cur = [e[0], e[1], e[2]]; tgt = [t[0], t[1], t[2]]; if (!calm && intro < 1) { cur[0] += .35; cur[2] += .3; } }
    var f = calm ? 1 : 1 - Math.exp(-dt * (walking ? 16 : FOLLOW)), moved = 0, dd;
    par += ((free ? 0 : 1) - par) * (calm ? 1 : 1 - Math.exp(-dt * 5));
    for (i = 0; i < 3; i++) { dd = (e[i] - cur[i]) * f; cur[i] += dd; moved += Math.abs(dd); tgt[i] += (t[i] - tgt[i]) * f; }
    fAmt += ((focus ? 1 : 0) - fAmt) * f; walk += moved;
    var bob = calm ? 0 : Math.sin(walk * 9) * Math.min(.012, moved * .6);                             // a hint of footsteps while you move
    eye.set(cur[0], cur[1] + bob, cur[2]);
    // looking around: the view turns a little towards the pointer
    var lx = tgt[0] - eye.x, ly = tgt[1] - eye.y, lz = tgt[2] - eye.z, ll = Math.hypot(lx, ly, lz), rx = -lz, rz = lx, rl = Math.hypot(rx, rz) || 1, lk = (1 - fAmt * .6) * par;
    look.set(tgt[0] + rx / rl * sx * ll * .62 * lk, tgt[1] - sy * ll * .34 * lk, tgt[2] + rz / rl * sx * ll * .62 * lk);
    camera.position.copy(eye); camera.lookAt(look);
    camera.fov = aspect < .9 ? 74 : aspect < 1.3 ? 62 : 52; camera.aspect = aspect; camera.updateProjectionMatrix();
    var kx = aspect > 1.15 ? -.24 * fAmt : 0, ky = aspect < .9 ? .3 * (pShown > .12 || focus ? 1 : .5) * Math.max(par, fAmt) : 0;   // slide the picture on screen to leave room for the copy
    if (kx || ky) { camera.projectionMatrix.elements[8] -= kx; camera.projectionMatrix.elements[9] -= ky; camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert(); }
    camera.updateMatrixWorld();
    if (hi !== hiShown) { if (hiShown && hiMats[hiShown]) hiMats[hiShown].forEach(function (m) { m.userData.uHi.value = 0; }); if (hi && hiMats[hi]) hiMats[hi].forEach(function (m) { m.userData.uHi.value = 1; }); hiShown = hi; }

    renderer.render(scene, camera);

    // hotspots follow their objects
    var stop = 0, best = 9; STOPS.forEach(function (s, n) { var d2 = Math.abs(pShown - s); if (d2 < best) { best = d2; stop = n; } });
    var moving = !free && moved > dt * 1.8, dim = document.body.classList.contains('dim'), vw = window.innerWidth, vh = window.innerHeight;
    var cover = [];   // the paper notes, hero cards and on-screen controls: dots never sit on top of them (a dot under the page dots could not be clicked)
    $$('.fx.is-live .note__card, .fx.is-live.note, .fx.is-live.cards, .fx.is-live.layer__copy, #steps, #chev, #dock > *, .hud:not([hidden]), .stick:not([hidden])').forEach(function (el) { var b = el.getBoundingClientRect(); if (b.width && b.height) cover.push(b); });
    for (i = 0; i < spots.length; i++) {
      var s = spots[i], P = s.p, ox = P[0] - eye.x, oy = P[1] - eye.y, oz = P[2] - eye.z, od = Math.hypot(ox, oy, oz);
      tmp.set(P[0], P[1], P[2]).project(camera);
      var qv = tmp.z < 1 && tmp.z > -1 ? [(tmp.x * .5 + .5) * vw, (1 - (tmp.y * .5 + .5)) * vh] : null;
      // every dot you could see is offered, wherever you are: near ones big, far ones small. Only furniture in the way hides one.
      var seen = qv && od < 7 && (od < .5 || !blocked([eye.x, eye.y, eye.z], [ox / od, oy / od, oz / od], od - .4, P));
      var show = settled && !dim && !moving && seen && qv[0] > 24 && qv[0] < vw - 24 && qv[1] > 76 && qv[1] < vh * (aspect < .9 && stop > 0 && !focus && !free ? .6 : 1) - 44;
      for (var cc = 0; show && cc < cover.length; cc++) { var cb = cover[cc]; if (qv[0] > cb.left - 16 && qv[0] < cb.right + 16 && qv[1] > cb.top - 16 && qv[1] < cb.bottom + 16) show = false; }
      if (qv) s.el.style.transform = 'translate3d(' + qv[0].toFixed(1) + 'px,' + qv[1].toFixed(1) + 'px,0)';
      var kk = Math.round(clamp(1.95 - od * .2, .72, 1.6) * 20) / 20;   // dot size: about 10 px across the room, about 22 px up close
      if (s.k !== kk) { s.k = kk; s.el.style.setProperty('--k', kk); }
      s.want = show; s.qv = qv; s.od = od;
    }
    // the wall: one dot from afar, one per frame once you are close (2.8 m) or the five frames sit clearly apart on screen (a phone's view stands further back)
    var fr = [], fw = null, fmin = 99, sep = 999;
    for (i = 0; i < spots.length; i++) { s = spots[i]; if (s.key === 'frames') fw = s; else if (/^f\d$/.test(s.key) && s.want) { fr.push(s); fmin = Math.min(fmin, s.od); } }
    for (i = 0; i < fr.length; i++) for (var j2 = i + 1; j2 < fr.length; j2++) sep = Math.min(sep, Math.hypot(fr[i].qv[0] - fr[j2].qv[0], fr[i].qv[1] - fr[j2].qv[1]));
    var split = fr.length > 0 && (fmin <= 2.8 || (fmin <= 4.2 && sep >= 44));
    if (split) { if (fw) fw.want = false; } else fr.forEach(function (x) { x.want = false; });
    // two dots on top of each other cannot both be tapped: show the nearer one; the other appears once you are close enough for them to separate
    for (i = 0; i < spots.length; i++) {
      var A = spots[i]; if (!A.want) continue;
      for (var j = 0; j < spots.length; j++) { var B = spots[j]; if (j !== i && B.want && B.od < A.od && Math.hypot(A.qv[0] - B.qv[0], A.qv[1] - B.qv[1]) < 34) { A.want = false; break; } }
    }
    for (i = 0; i < spots.length; i++) { s = spots[i]; if (s.shown !== s.want) { s.shown = s.want; s.el.classList.toggle('is-on', !!s.want); s.el.tabIndex = s.want ? 0 : -1; } }
    // frame timing: struggling? draw fewer pixels. Room.bench() reads the same numbers.
    frames.push(dt * 1000); if (frames.length > 240) frames.shift();
    if (!calm && intro >= 1 && !bench) { slow = dt > .024 ? slow + 1 : Math.max(0, slow - 1); if (slow > 40 && tier < 3) { tier++; slow = 0; retier = true; dirty = true; } }
    var busy = bench || (walking && (Math.abs(vel[0]) + Math.abs(vel[1]) > .002 || mx || mz || keys.q || keys.e)) || Math.abs(par - (free ? 0 : 1)) > .003 || intro < 1 || Math.abs(p - pShown) > .0004 || moved > .0006 || Math.abs(fAmt - (focus ? 1 : 0)) > .002 || Math.abs(px - sx) + Math.abs(py - sy) > .002 || on.some(function (v, n) { return Math.abs(v - want[n]) > .004; });
    if (busy) wantSharp = false;
    if (busy || dirty) { dirty = false; kick(); } else if (applied > 0) { wantSharp = true; kick(); } else idle = true;
  }
  function kick() { if (!raf && visible) raf = requestAnimationFrame(frame); }
  window.addEventListener('scroll', function () { dirty = true; kick(); }, { passive: true });
  window.addEventListener('resize', function () { resize(); if (raf) cancelAnimationFrame(raf); raf = null; frame(performance.now()); });
  window.addEventListener('pageshow', function () { dirty = true; kick(); });
  window.addEventListener('pointermove', function (e) { if (calm || e.pointerType === 'touch') return; px = e.clientX / window.innerWidth - .5; py = e.clientY / window.innerHeight - .5; kick(); }, { passive: true });
  // keyboard: W A S D (or the arrow keys once you are walking) to move, Q and E to turn
  var KEYMAP = { w: 'w', a: 'a', s: 's', d: 'd', q: 'q', e: 'e', arrowup: 'w', arrowdown: 's', arrowleft: 'q', arrowright: 'e' };
  function typing(el) { return el && (/^(input|textarea|select)$/i.test(el.tagName) || el.isContentEditable); }
  window.addEventListener('keydown', function (ev) {
    var k = KEYMAP[(ev.key || '').toLowerCase()]; if (!k || ev.ctrlKey || ev.metaKey || ev.altKey || typing(ev.target) || document.querySelector('dialog[open]') || document.body.classList.contains('dim')) return;
    var arrow = ev.key.length > 1; if (arrow && !free) return;            // arrows scroll the page as usual until you are walking
    if (!free) setFree(true); if (arrow) ev.preventDefault(); keys[k] = 1; kick();
  });
  window.addEventListener('keyup', function (ev) { var k = KEYMAP[(ev.key || '').toLowerCase()]; if (k) { keys[k] = 0; kick(); } });
  window.addEventListener('blur', function () { keys = {}; joy[0] = joy[1] = 0; });
  document.addEventListener('visibilitychange', function () { visible = !document.hidden; if (visible) { last = performance.now(); kick(); } });
  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); noWebGL('WebGL context lost'); });

  /* ------------------------------------------------------------ boot */
  resize(); setDay();
  if (window.pageYOffset > 4) { intro = 1; }          // arriving mid-page: skip the intro
  last = performance.now(); kick();

  if (/[?&]debug/.test(q)) window.__room = { SPOT: SPOT, OCC: OCC, blocked: blocked, uW: uW, renderer: renderer, scene: scene, camera: camera, sky: sky, kick: function () { dirty = true; kick(); } };
  window.Room = {
    replay: function () { if (calm) return; setFree(false); settled = false; intro = 0; introT = 0; on = [0, 0, 0, 0, 0]; focus = null; kick(); },
    lamp: function () { lampOn = !lampOn; kick(); return lampOn; },
    goTo: function (stop) { var max = film.offsetHeight - window.innerHeight; window.scrollTo({ top: STOPS[stop] * max, behavior: calm ? 'auto' : 'smooth' }); },
    focus: function (key) { if (SPOT[key]) { focus = key; kick(); } },
    blur: function () { if (focus && free && cur) { aimFromCamera(); collide(fpos); } focus = null; kick(); },   // when walking, you stay where you were standing
    explore: function (v) { setFree(!!v); }, exploring: function () { return free; },
    move: function (x, y) { joy[0] = clamp(x, -1, 1); joy[1] = clamp(y, -1, 1); kick(); },                         // on-screen stick: x strafes, y walks
    look: function (dx, dy) { if (!free || focus) return; yaw += dx; pitch = clamp(pitch - dy, -.9, .9); kick(); },
    home: function (key) { var s = SPOT[key]; return s ? s[3][s[3].length - 1] : 0; },
    time: function (h) { todFixed = (h === null || h === undefined) ? null : ((+h % 24) + 24) % 24; dirty = true; kick(); return hourNow(); },
    stops: STOPS, progress: function () { return p; },
    ready: function () { return ready && later; }, profile: PROFILE,
    // measure: draw continuously for `seconds` and report real frame times
    bench: function (seconds) {
      return new Promise(function (res) {
        frames.length = 0; bench = true; kick();
        setTimeout(function () {
          bench = false; var a = frames.slice(5).sort(function (x, y) { return x - y; }), n = a.length, avg = a.reduce(function (s, v) { return s + v; }, 0) / Math.max(1, n);
          var info = renderer.info.render;
          res({ profile: PROFILE, frames: n, fps: +(1000 / avg).toFixed(1), avgMs: +avg.toFixed(2), p95Ms: +(a[Math.floor(n * .95)] || 0).toFixed(2), worstMs: +(a[n - 1] || 0).toFixed(2), pixelRatio: renderer.getPixelRatio(), tier: tier, drawCalls: info.calls, triangles: info.triangles, gpu: (function () { try { var g = renderer.getContext(), x = g.getExtension('WEBGL_debug_renderer_info'); return x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : 'unknown'; } catch (e) { return 'unknown'; } })() });
        }, seconds * 1000);
      });
    }
  };
})();

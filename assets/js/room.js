/* Mayne's Room — the fixed 3D scene behind the page.
   Dependency-free WebGL. A night-time bedroom built from boxes, lit by the moon, a desk lamp, the
   monitor and an LED strip. It never leaves the screen: on load the furniture drops in and the
   lights come on, scrolling flies the camera from the wide view to the desk, shelf, wall and bed,
   and hotspots pinned to objects open details about Mayne. */
(function () {
  'use strict';
  var canvas = document.getElementById('stage'), root = document.documentElement;
  if (!canvas) return;
  var gl = canvas.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'high-performance' });
  if (!gl) { root.classList.add('no-webgl'); document.dispatchEvent(new CustomEvent('room:settled')); return; }
  root.classList.add('has-webgl');
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); }

  /* ------------------------------------------------------------ atlas: every picture in the room, drawn once */
  var AT = 1024, atlas = document.createElement('canvas'); atlas.width = atlas.height = AT;
  var CELL = { monitor: [0, 0, 512, 288], laptop: [512, 0, 256, 160], calendar: [768, 0, 256, 256], window: [0, 288, 384, 320], qr: [384, 288, 256, 256],
    paper: [640, 288, 128, 170], phone: [768, 288, 96, 170], f0: [0, 608, 160, 200], f1: [160, 608, 160, 200], f2: [320, 608, 160, 200], f3: [480, 608, 160, 200], f4: [640, 608, 160, 200],
    portrait: [800, 608, 200, 200], rug: [0, 820, 400, 200], diploma: [864, 288, 160, 120] };
  function paintAtlas(img) {
    var c = atlas.getContext('2d'), r, i, j;
    c.fillStyle = '#000'; c.fillRect(0, 0, AT, AT);
    function cell(k, fn) { r = CELL[k]; c.save(); c.translate(r[0], r[1]); c.beginPath(); c.rect(0, 0, r[2], r[3]); c.clip(); fn(r[2], r[3]); c.restore(); }
    var mono = '600 14px "JetBrains Mono", monospace', sans = '800 30px "Manrope", sans-serif';
    cell('monitor', function (w, h) { // the Fidelity dashboard
      c.fillStyle = '#0d1130'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#171c48'; c.fillRect(0, 0, w, 30); c.fillStyle = '#9db1ff'; c.font = mono; c.fillText('k8s / observability', 12, 20);
      ['#7c8cff', '#5fe3d0', '#ff9bd0'].forEach(function (col, n) {
        c.strokeStyle = col; c.lineWidth = 3; c.beginPath();
        for (i = 0; i <= 40; i++) { var x = 16 + i * 7.6, y = 120 + n * 26 - 30 * (i / 40) - 12 * Math.sin(i * .5 + n * 2) - 8 * Math.sin(i * .21 + n); i ? c.lineTo(x, y) : c.moveTo(x, y); }
        c.stroke();
      });
      for (i = 0; i < 9; i++) { c.fillStyle = i % 4 === 3 ? '#ffb86b' : '#5fe3d0'; c.fillRect(340 + (i % 3) * 54, 52 + Math.floor(i / 3) * 44, 44, 34); }
      for (i = 0; i < 16; i++) { c.fillStyle = 'rgba(124,140,255,' + (.35 + (i * 37 % 10) / 16) + ')'; c.fillRect(16 + i * 30, 268 - (20 + (i * 53 % 50)), 22, 20 + (i * 53 % 50)); }
    });
    cell('laptop', function (w, h) { c.fillStyle = '#12142e'; c.fillRect(0, 0, w, h); for (i = 0; i < 9; i++) { c.fillStyle = ['#7c8cff', '#5fe3d0', '#ffb86b', '#c9c5ff'][i % 4]; c.fillRect(14 + (i % 3) * 10, 14 + i * 15, 60 + (i * 47 % 130), 6); } });
    cell('calendar', function (w, h) { // Homework Tracker
      c.fillStyle = '#f3f0ff'; c.fillRect(0, 0, w, h); c.fillStyle = '#5546ea'; c.fillRect(0, 0, w, 46); c.fillStyle = '#fff'; c.font = '800 22px "Manrope", sans-serif'; c.fillText('NOVEMBER', 16, 31);
      for (i = 0; i < 5; i++) for (j = 0; j < 7; j++) { c.strokeStyle = '#c9c3ea'; c.strokeRect(8 + j * 34.5, 56 + i * 39, 34.5, 39); var d = (i * 7 + j * 3) % 5; if (d < 3) { c.fillStyle = ['#e5484d', '#f5a524', '#30a46c'][d]; c.beginPath(); c.arc(25 + j * 34.5, 82 + i * 39, 5, 0, 7); c.fill(); } }
    });
    cell('window', function (w, h) { // night sky
      var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0b1340'); g.addColorStop(1, '#3a2a78'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      for (i = 0; i < 70; i++) { c.fillStyle = 'rgba(255,255,255,' + (.3 + (i * 31 % 10) / 14) + ')'; c.fillRect((i * 97) % w, (i * 53) % (h * .8), 2, 2); }
      c.fillStyle = '#fdf6d8'; c.beginPath(); c.arc(w * .7, h * .3, 34, 0, 7); c.fill(); c.fillStyle = 'rgba(253,246,216,.15)'; c.beginPath(); c.arc(w * .7, h * .3, 60, 0, 7); c.fill();
      c.fillStyle = '#141433'; for (i = 0; i < 9; i++) c.fillRect(i * 44, h - 40 - (i * 37 % 60), 40, 100);
      c.fillStyle = '#ffd98a'; for (i = 0; i < 26; i++) c.fillRect(6 + (i * 61) % (w - 12), h - 12 - (i * 29 % 70), 5, 6);
      c.strokeStyle = '#1a1838'; c.lineWidth = 10; c.strokeRect(0, 0, w, h); c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
    });
    cell('qr', function (w, h) {
      c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); var q = canvas.getAttribute('data-qr') || '', n = 29, s = (w - 32) / n; c.fillStyle = '#17162e';
      try { c.save(); c.translate(16, 16); c.scale(s, s); c.fill(new Path2D(q)); c.restore(); } catch (e) {}
    });
    cell('paper', function (w, h) { c.fillStyle = '#f7f5ee'; c.fillRect(0, 0, w, h); c.fillStyle = '#17162e'; c.fillRect(12, 12, 70, 9); c.fillStyle = '#8d8aa8'; for (i = 0; i < 16; i++) c.fillRect(12, 32 + i * 8.4, 40 + (i * 43 % 64), 3); });
    cell('phone', function (w, h) { c.fillStyle = '#0f1024'; c.fillRect(0, 0, w, h); c.fillStyle = '#5fe3d0'; c.font = '800 20px "Manrope", sans-serif'; c.fillText('$', 10, 28); c.strokeStyle = '#5fe3d0'; c.lineWidth = 3; c.beginPath(); for (i = 0; i <= 12; i++) { var yy = 70 - i * 2.4 - 9 * Math.sin(i); i ? c.lineTo(8 + i * 6.6, yy) : c.moveTo(8, yy); } c.stroke(); for (i = 0; i < 5; i++) { c.fillStyle = '#23254d'; c.fillRect(8, 86 + i * 16, w - 16, 11); } });
    [['NSBE', '#e8a93e'], ['MLT', '#e5484d'], ['JNPR', '#30a46c'], ['SEO', '#3e8ed0'], ['G', '#9b6bff']].forEach(function (f, n) {
      cell('f' + n, function (w, h) { c.fillStyle = '#2a2140'; c.fillRect(0, 0, w, h); c.fillStyle = '#f4f1ea'; c.fillRect(12, 12, w - 24, h - 24); c.fillStyle = f[1]; c.fillRect(24, 24, w - 48, h - 90);
        c.fillStyle = '#fff'; c.font = '800 ' + (f[0].length > 3 ? 30 : 40) + 'px "Manrope", sans-serif'; c.textAlign = 'center'; c.fillText(f[0], w / 2, 24 + (h - 90) / 2 + 13); c.textAlign = 'left'; c.fillStyle = '#8d8aa8'; c.fillRect(34, h - 52, w - 68, 5); c.fillRect(50, h - 38, w - 100, 4); });
    });
    cell('portrait', function (w, h) { c.fillStyle = '#3a2d1c'; c.fillRect(0, 0, w, h); if (img) c.drawImage(img, 14, 14, w - 28, h - 28); else { c.fillStyle = '#c9b48a'; c.fillRect(14, 14, w - 28, h - 28); } });
    cell('rug', function (w, h) { c.fillStyle = '#2c2466'; c.fillRect(0, 0, w, h); c.strokeStyle = '#6f63d9'; c.lineWidth = 8; c.strokeRect(14, 14, w - 28, h - 28); c.strokeStyle = '#a99cff'; c.lineWidth = 3; c.strokeRect(34, 34, w - 68, h - 68); c.fillStyle = '#6f63d9'; for (i = 0; i < 7; i++) { c.beginPath(); c.arc(60 + i * 47, h / 2, 12, 0, 7); c.fill(); } });
    cell('diploma', function (w, h) { c.fillStyle = '#f7f1dc'; c.fillRect(0, 0, w, h); c.strokeStyle = '#b08d3c'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12); c.fillStyle = '#17162e'; c.font = '800 20px "Manrope", sans-serif'; c.textAlign = 'center'; c.fillText('B.S. CS', w / 2, 48); c.font = mono; c.fillText('UML 2027', w / 2, 72); c.textAlign = 'left'; c.fillStyle = '#c8323a'; c.beginPath(); c.arc(w / 2, 94, 9, 0, 7); c.fill(); });
  }

  /* ------------------------------------------------------------ the room, as boxes */
  var STR = 17, data = [], nextId = 1, IDS = {}, order = 0;
  function uvOf(k) { var r = CELL[k]; return [r[0] / AT, r[1] / AT, (r[0] + r[2]) / AT, (r[1] + r[3]) / AT]; }
  // box(name, [x0,y0,z0,x1,y1,z1], color, {em, grp, tex, face})  face: '+z' | '+x' | '+y'
  function box(name, b, col, o) {
    o = o || {}; var id = IDS[name] || (IDS[name] = nextId++), em = o.em || 0, grp = o.grp || 0, ord = o.ord !== undefined ? o.ord : (order += 1);
    var x0 = b[0], y0 = b[1], z0 = b[2], x1 = b[3], y1 = b[4], z1 = b[5], cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
    var t = o.tex ? uvOf(o.tex) : null;
    var F = [ // corners in order: bottom-left, bottom-right, top-right, top-left as seen from outside
      ['+z', [0, 0, 1], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]],
      ['-z', [0, 0, -1], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]]],
      ['+x', [1, 0, 0], [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]]],
      ['-x', [-1, 0, 0], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]]],
      ['+y', [0, 1, 0], [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]]],
      ['-y', [0, -1, 0], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]]
    ];
    F.forEach(function (f) {
      var tex = t && f[0] === (o.face || '+z'), uv = tex ? [[t[0], t[3]], [t[2], t[3]], [t[2], t[1]], [t[0], t[1]]] : [[-1, -1], [-1, -1], [-1, -1], [-1, -1]];
      var fe = (t && !tex) ? 0 : em;
      [0, 1, 2, 0, 2, 3].forEach(function (k) {
        var p = f[2][k];
        data.push(p[0], p[1], p[2], f[1][0], f[1][1], f[1][2], col[0], col[1], col[2], fe, grp, uv[k][0], uv[k][1], id + ord / 1000, cx, cy, cz);
      });
    });
    return id;
  }
  function hx(h) { return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]; }
  var W = 6, D = 5, Hh = 3.1;
  (function buildRoom() {
    var wall = hx('#3b3470'), wall2 = hx('#342d66'), floor = hx('#5a4a78'), wood = hx('#8a5f3c'), woodD = hx('#5f3f27'), white = hx('#ecebf5'), dark = hx('#1c1a33'), bedc = hx('#4d5fd6'), sheet = hx('#e8e6f7');
    box('floor', [-.15, -.2, -.15, W, 0, D], floor, { ord: 0 });
    box('wallB', [-.15, 0, -.15, W, Hh, 0], wall, { ord: 0 });
    box('wallL', [-.15, 0, 0, 0, Hh, D], wall2, { ord: 0 });
    box('trim', [0, 0, 0, W, .09, .03], dark, { ord: 0 }); box('trim', [0, 0, 0, .03, .09, D], dark, { ord: 0 });
    box('rug', [1.6, 0, 1.7, 4.6, .02, 3.9], white, { tex: 'rug', face: '+y' });
    // desk + everything on it
    box('desk', [.45, .74, .12, 2.95, .8, 1.06], wood); box('desk', [.5, 0, .16, .58, .74, 1.0], woodD); box('desk', [2.82, 0, .16, 2.9, .74, 1.0], woodD); box('desk', [2.2, .3, .16, 2.82, .74, 1.0], woodD);
    box('led', [.5, .7, .1, 2.9, .73, .13], hx('#a99cff'), { em: 3, grp: 3 });
    box('monitor', [1.25, .8, .34, 1.75, .83, .56], dark); box('monitor', [1.47, .83, .42, 1.53, 1.02, .47], dark);
    box('monitor', [.98, 1.0, .4, 2.02, 1.62, .46], white, { tex: 'monitor', em: 1.25, grp: 1 }); box('monitorBack', [.96, .98, .37, 2.04, 1.64, .4], dark);
    box('laptop', [2.15, .8, .52, 2.75, .82, .94], hx('#b9b6cf')); box('laptop', [2.15, .82, .5, 2.75, 1.2, .53], white, { tex: 'laptop', em: 1.1, grp: 1 });
    box('keys', [1.15, .8, .68, 1.85, .82, .9], dark); box('mouse', [1.95, .8, .74, 2.05, .83, .88], white);
    box('paper', [.58, .8, .62, .88, .805, 1.0], white, { tex: 'paper', face: '+y' });
    box('mug', [.62, .8, .3, .74, .93, .42], hx('#e5484d'));
    box('lamp', [.84, .8, .22, 1.0, .82, .38], dark); box('lamp', [.905, .82, .285, .935, 1.3, .315], dark); box('lamp', [.8, 1.28, .2, 1.04, 1.46, .44], hx('#ffd98a'), { em: .9, grp: 2 });
    box('chair', [1.25, .44, 1.3, 1.85, .5, 1.9], hx('#2a2850')); box('chair', [1.25, .5, 1.84, 1.85, 1.15, 1.9], hx('#2a2850')); box('chair', [1.52, 0, 1.56, 1.58, .44, 1.62], dark); box('chair', [1.3, 0, 1.4, 1.8, .04, 1.8], dark);
    // calendar + QR poster on the back wall
    box('calendar', [.5, 1.55, 0, .92, 2.05, .02], white, { tex: 'calendar' });
    box('qr', [2.3, 1.55, 0, 2.86, 2.11, .02], white, { tex: 'qr' });
    // window + bed + nightstand
    box('window', [3.75, 1.25, 0, 5.35, 2.6, .03], white, { tex: 'window', em: 1, grp: 0 }); box('sill', [3.68, 1.19, 0, 5.42, 1.25, .12], white);
    box('bed', [3.5, .0, .1, 5.85, .28, 2.5], woodD); box('bed', [3.5, .28, .1, 5.85, .5, 2.5], sheet); box('bed', [3.5, .5, 1.0, 5.85, .56, 2.5], bedc); box('bed', [3.5, 0, .04, 5.85, .95, .12], woodD);
    box('pillow', [3.7, .5, .22, 4.55, .64, .78], white); box('pillow', [4.75, .5, .22, 5.6, .64, .78], white);
    box('bag', [3.05, 0, 2.2, 3.42, .5, 2.5], hx('#30a46c')); box('bag', [3.1, .12, 2.5, 3.37, .36, 2.55], hx('#237a50'));
    box('stand', [2.98, 0, .12, 3.44, .5, .6], wood); box('stand', [3.0, .3, .6, 3.42, .34, .605], woodD);
    box('portrait', [3.06, .5, .2, 3.36, .86, .23], white, { tex: 'portrait' });
    box('phone', [3.14, .5, .4, 3.26, .51, .58], white, { tex: 'phone', face: '+y', em: 1.3, grp: 1 });
    // bookshelf on the left wall
    box('shelf', [0, 0, 2.0, .34, 1.9, 2.06], woodD); box('shelf', [0, 0, 3.24, .34, 1.9, 3.3], woodD);
    [0, .46, .92, 1.38, 1.84].forEach(function (y) { box('shelf', [0, y, 2.0, .34, y + .06, 3.3], wood); });
    var spine = ['#7c8cff', '#5fe3d0', '#ffb86b', '#ff9bd0', '#e5484d', '#30a46c', '#f4f1ea', '#9b6bff'], z, n = 0;
    [.52, .98, 1.44].forEach(function (y, row) { for (z = 2.1; z < 3.14; z += .1 + (n * 7 % 4) * .02) { var hgt = .26 + (n * 13 % 9) * .012; box('books', [.05, y, z, .3, y + hgt, z + .08 + (n % 3) * .01], hx(spine[(n + row) % spine.length])); n++; if (row === 2 && z > 2.7) break; } });
    box('diploma', [.02, 1.5, 2.86, .04, 1.8, 3.2], white, { tex: 'diploma', face: '+x' });
    box('cap', [.06, 1.9, 2.3, .3, 1.96, 2.54], dark); box('cap', [0, 1.96, 2.24, .36, 1.985, 2.6], dark); box('cap', [.16, 1.985, 2.4, .2, 2.0, 2.44], hx('#e8a93e'), { em: .6 });
    box('plant', [.08, 0, 3.6, .42, .34, 3.94], hx('#c8693e')); box('plant', [.2, .34, 3.72, .3, .8, 3.82], hx('#2f7d3e')); box('plant', [.1, .6, 3.6, .4, .95, 3.92], hx('#3b9450')); box('plant', [.16, .9, 3.68, .34, 1.15, 3.86], hx('#58b368'));
    // frames on the left wall
    ['f0', 'f1', 'f2', 'f3', 'f4'].forEach(function (f, i) { var z0 = 3.5 + (i % 3) * .5 - (i > 2 ? -.25 : 0), y0 = i > 2 ? 2.2 : 1.5; box('frames', [0, y0, z0, .03, y0 + .56, z0 + .44], white, { tex: f, face: '+x' }); });
  })();
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
  var VCOUNT = data.length / STR, MAXORD = order;

  /* ------------------------------------------------------------ shaders */
  var VS = [
    'attribute vec3 aP; attribute vec3 aN; attribute vec3 aC; attribute vec2 aE; attribute vec2 aUV; attribute float aId; attribute vec3 aCtr;',
    'uniform mat4 uVP; uniform float uIntro; uniform float uMaxOrd;',
    'varying vec3 vP; varying vec3 vN; varying vec3 vC; varying vec2 vE; varying vec2 vUV; varying float vId;',
    'void main(){',
    '  float id = floor(aId + .0005); float ord = (aId - id)*1000.;',
    '  float t = clamp(uIntro*(uMaxOrd + 6.) - ord, 0., 6.)/6.;',          // each piece drops in after the one before
    '  float s = ord < .5 ? 1. : 1. - pow(1. - t, 3.);',
    '  vec3 p = aCtr + (aP - aCtr)*s; p.y += (1. - s)*(1. - s)*2.2;',
    '  vP = p; vN = aN; vC = aC; vE = aE; vUV = aUV; vId = id;',
    '  gl_Position = uVP*vec4(p, 1.);',
    '}'
  ].join('\n');
  var FS = [
    'precision highp float;',
    'varying vec3 vP; varying vec3 vN; varying vec3 vC; varying vec2 vE; varying vec2 vUV; varying float vId;',
    'uniform sampler2D uAtlas; uniform vec4 uOn; uniform vec3 uEye; uniform float uHi; uniform float uTime; uniform vec4 uSh[7]; uniform float uFloorId;',
    'vec3 pt(vec3 lp, vec3 lc, float k){ vec3 d = lp - vP; float r2 = dot(d, d); return lc*max(dot(vN, normalize(d)), 0.)/(1. + k*r2); }',
    'void main(){',
    '  vec3 base = vC; if (vUV.x >= 0.) base *= texture2D(uAtlas, vUV).rgb;',
    '  vec3 L = vec3(.10, .11, .22);',                                                           // night ambient
    '  L += vec3(.30, .36, .62)*max(dot(vN, normalize(vec3(.25, .55, .8))), 0.)*uOn.x;',          // moonlight
    '  L += pt(vec3(.92, 1.34, .34), vec3(1.5, 1.02, .52), 1.1)*uOn.z*2.2;',                      // desk lamp
    '  L += pt(vec3(1.5, 1.3, .9), vec3(.42, .52, 1.), 1.6)*uOn.y*1.5;',                          // monitor glow
    '  L += pt(vec3(1.7, .6, .2), vec3(.66, .5, 1.), 2.2)*uOn.w*1.1;',                            // LED strip
    '  L += pt(vec3(.9, 2.7, 4.1), vec3(1.2, .95, .7), 1.4)*uOn.z*1.1 + pt(vec3(1.2, 1.6, 2.7), vec3(.9, .8, 1.), 1.5)*uOn.w*.8;',                       // picture light + shelf fill
    '  L += pt(vec3(4.5, 1.9, .5), vec3(.4, .46, .9), 1.2)*uOn.x*.9;',                            // window spill
    '  if (abs(vId - uFloorId) < .5 && vN.y > .5) {',                                             // soft contact shadows under furniture
    '    float sh = 0.;',
    '    for (int i = 0; i < 7; i++) { vec2 c = (uSh[i].xy + uSh[i].zw)*.5, h = (uSh[i].zw - uSh[i].xy)*.5; vec2 q = abs(vP.xz - c) - h; float d = length(max(q, 0.)); sh = max(sh, 1. - smoothstep(0., .38, d)); }',
    '    L *= 1. - sh*.55;',
    '  }',
    '  float grp = vE.y; float on = grp < .5 ? max(uOn.x, .25) : grp < 1.5 ? uOn.y : grp < 2.5 ? uOn.z : uOn.w;',
    '  vec3 col = base*L + base*vE.x*on;',
    '  if (abs(vId - uHi) < .5) col += vec3(.35, .3, .7)*(.55 + .45*sin(uTime*5.));',            // the object you are pointing at
    '  float fog = smoothstep(9., 20., distance(uEye, vP)); col = mix(col, vec3(.035, .03, .09), fog*.6);',
    '  col = col/(1. + col*.35); col = pow(col, vec3(.9));',
    '  gl_FragColor = vec4(col, 1.);',
    '}'
  ].join('\n');
  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  var prog = gl.createProgram();
  try { gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog)); }
  catch (e) { root.classList.remove('has-webgl'); root.classList.add('no-webgl'); if (window.console) console.warn(e.message); document.dispatchEvent(new CustomEvent('room:settled')); return; }
  gl.useProgram(prog);
  var U = {}; ['uVP', 'uIntro', 'uMaxOrd', 'uAtlas', 'uOn', 'uEye', 'uHi', 'uTime', 'uFloorId'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
  var uSh = gl.getUniformLocation(prog, 'uSh');
  [['aP', 3, 0], ['aN', 3, 3], ['aC', 3, 6], ['aE', 2, 9], ['aUV', 2, 11], ['aId', 1, 13], ['aCtr', 3, 14]].forEach(function (a) {
    var l = gl.getAttribLocation(prog, a[0]); if (l < 0) return; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, a[1], gl.FLOAT, false, STR * 4, a[2] * 4);
  });
  gl.uniform4fv(uSh, new Float32Array([.45, .12, 2.95, 1.06, 3.5, .1, 5.85, 2.5, 0, 2.0, .34, 3.3, 2.98, .12, 3.44, .6, 1.25, 1.3, 1.85, 1.9, 3.05, 2.2, 3.42, 2.5, .08, 3.6, .42, 3.94]));
  gl.uniform1f(U.uFloorId, IDS.floor); gl.uniform1f(U.uMaxOrd, MAXORD); gl.uniform1i(U.uAtlas, 0);
  var tex = gl.createTexture();
  function upload() {
    gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); dirty = true;
  }
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.clearColor(.035, .03, .09, 1);

  /* ------------------------------------------------------------ camera: ONE TIMELINE (p is scroll progress through #film) */
  var CAM = [ // [p, eye, target]
    [0.00, [10.6, 6.2, 11.0], [2.7, .95, 1.7]],
    [0.06, [10.6, 6.2, 11.0], [2.7, .95, 1.7]],
    [0.20, [3.4, 1.9, 5.1], [.95, 1.12, .4]],     // the desk
    [0.30, [3.6, 1.85, 5.0], [1.05, 1.12, .4]],
    [0.42, [4.7, 1.55, 3.7], [.1, 1.12, 2.25]],    // the shelf
    [0.52, [4.7, 1.6, 3.5], [.1, 1.12, 2.35]],
    [0.64, [4.3, 2.0, 4.5], [0, 1.95, 3.6]],       // the wall of frames
    [0.74, [4.2, 2.0, 4.3], [0, 1.95, 3.7]],
    [0.86, [3.1, 2.5, 6.5], [3.6, 1.15, .9]],      // the bed and the window
    [1.00, [3.3, 2.4, 6.3], [3.7, 1.15, .9]]
  ];
  var STOPS = [0, .25, .47, .69, .93];
  function camAt(p) {
    for (var i = 1; i < CAM.length; i++) if (p <= CAM[i][0]) {
      var a = CAM[i - 1], b = CAM[i], t = smooth((p - a[0]) / (b[0] - a[0]));
      return [[lerp(a[1][0], b[1][0], t), lerp(a[1][1], b[1][1], t), lerp(a[1][2], b[1][2], t)], [lerp(a[2][0], b[2][0], t), lerp(a[2][1], b[2][1], t), lerp(a[2][2], b[2][2], t)]];
    }
    var l = CAM[CAM.length - 1]; return [l[1], l[2]];
  }
  var VP = new Float32Array(16), eye = [0, 0, 0];
  function viewProj(e, t, aspect, kx, ky) {
    var portrait = aspect < .9, fov = (portrait ? 46 : 30) * Math.PI / 180, f = 1 / Math.tan(fov / 2), n = .1, fr = 60;
    var zx = e[0] - t[0], zy = e[1] - t[1], zz = e[2] - t[2], zl = Math.hypot(zx, zy, zz); zx /= zl; zy /= zl; zz /= zl;
    var xx = zz, xy = 0, xz = -zx, xl = Math.hypot(xx, xz) || 1; xx /= xl; xz /= xl;               // x = up × z
    var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    var tx = -(xx * e[0] + xy * e[1] + xz * e[2]), ty = -(yx * e[0] + yy * e[1] + yz * e[2]), tz = -(zx * e[0] + zy * e[1] + zz * e[2]);
    var a = f / aspect, c = (fr + n) / (n - fr), d = 2 * fr * n / (n - fr);
    VP[0] = a * xx; VP[1] = f * yx; VP[2] = c * zx; VP[3] = -zx;
    VP[4] = a * xy; VP[5] = f * yy; VP[6] = c * zy; VP[7] = -zy;
    VP[8] = a * xz; VP[9] = f * yz; VP[10] = c * zz; VP[11] = -zz;
    VP[12] = a * tx; VP[13] = f * ty; VP[14] = c * tz + d; VP[15] = -tz;
    for (var i = 0; i < 4; i++) { VP[i * 4] += kx * VP[i * 4 + 3]; VP[i * 4 + 1] += ky * VP[i * 4 + 3]; }   // slide the picture on screen to leave room for the copy
  }
  function project(p) {
    var x = VP[0] * p[0] + VP[4] * p[1] + VP[8] * p[2] + VP[12], y = VP[1] * p[0] + VP[5] * p[1] + VP[9] * p[2] + VP[13], w = VP[3] * p[0] + VP[7] * p[1] + VP[11] * p[2] + VP[15];
    return w <= .05 ? null : [(x / w * .5 + .5) * window.innerWidth, (1 - (y / w * .5 + .5)) * window.innerHeight];
  }

  /* ------------------------------------------------------------ hotspots: where each object is, and when it shows */
  var SPOT = { // name: [x, y, z, object to highlight, stops where it is offered]
    monitor: [1.5, 1.31, .47, 'monitor', [0, 1]], laptop: [2.45, 1.02, .54, 'laptop', [1]], paper: [.73, .82, .81, 'paper', [1]], lamp: [.92, 1.37, .44, 'lamp', [0, 1]],
    calendar: [.71, 1.8, .03, 'calendar', [1]], qr: [2.58, 1.83, .03, 'qr', [1]], books: [.31, 1.12, 2.62, 'books', [0, 2]], diploma: [.05, 1.65, 3.03, 'diploma', [2]], cap: [.18, 2.02, 2.42, 'cap', [2]],
    frames: [.04, 2.14, 4.2, 'frames', [0]], f0: [.04, 1.6, 3.72, 'frames', [3]], f1: [.04, 1.6, 4.22, 'frames', [3]], f2: [.04, 1.6, 4.72, 'frames', [3]], f3: [.04, 2.3, 3.97, 'frames', [3]], f4: [.04, 2.3, 4.47, 'frames', [3]],
    portrait: [3.21, .69, .24, 'portrait', [0, 4]], phone: [3.2, .52, .49, 'phone', [4]], window: [4.55, 1.9, .04, 'window', [0, 4]], bag: [3.23, .5, 2.52, 'bag', [4]]
  };
  var spots = $$('[data-spot]').map(function (el) { var s = SPOT[el.getAttribute('data-spot')]; return s ? { el: el, p: s, id: IDS[s[3]], stops: s[4] } : null; }).filter(Boolean);
  var hi = 0;
  spots.forEach(function (s) {
    s.el.addEventListener('pointerenter', function () { hi = s.id; kick(); }); s.el.addEventListener('pointerleave', function () { hi = 0; kick(); });
    s.el.addEventListener('focus', function () { hi = s.id; kick(); }); s.el.addEventListener('blur', function () { hi = 0; kick(); });
  });

  /* ------------------------------------------------------------ state + frame */
  var film = $('#film'), p = 0, pShown = 0, time = 0, last = 0, raf = null, visible = true, dirty = true, dpr = 1, tier = 0, slow = 0;
  var intro = calm ? 1 : 0, introT = 0, settled = false, lampOn = true, on = [0, 0, 0, 0], px = 0, py = 0, sx = 0, sy = 0;
  function resize() {
    dpr = Math.max(.6, Math.min(window.innerWidth < 760 ? 1.5 : 2, window.devicePixelRatio || 1) * [1, .8, .64][tier]);
    var w = Math.round(window.innerWidth * dpr), h = Math.round(window.innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } gl.viewport(0, 0, w, h); dirty = true;
  }
  function progress() { var max = film ? film.offsetHeight - window.innerHeight : 1; return clamp(window.pageYOffset / Math.max(1, max), 0, 1); }
  function settle() { if (settled) return; settled = true; document.dispatchEvent(new CustomEvent('room:settled')); }
  function frame(now) {
    raf = null; var dt = Math.min(.05, (now - last) / 1000 || .016); last = now; if (!calm) time += dt;
    p = progress(); pShown += (p - pShown) * (calm ? 1 : 1 - Math.pow(.0005, dt));
    if (intro < 1) { introT += dt; intro = Math.min(1, introT / 2.4); if (intro > .78) settle(); } else settle();
    // lights come on in order: moon, monitor, lamp, LED
    var tgt = [intro > .05 ? 1 : 0, intro > .55 ? 1 : 0, (intro > .72 && lampOn) ? 1 : 0, intro > .85 ? 1 : 0], k = 1 - Math.pow(.002, dt);
    for (var i = 0; i < 4; i++) on[i] += (tgt[i] - on[i]) * (calm ? 1 : k);
    var flick = (intro > .55 && intro < .68) ? (Math.sin(time * 70) > 0 ? 1 : .2) : 1;
    sx += (px - sx) * .06; sy += (py - sy) * .06;
    var c = camAt(pShown), e = c[0], t = c[1], far = 1 - smooth(pShown / .2), aspect = canvas.width / canvas.height;
    var pull = aspect < .9 ? 1 + (1 - aspect) * (.5 * far + .85 * (1 - far)) : 1;                                       // phones stand further back so the room fits
    eye[0] = t[0] + (e[0] - t[0]) * pull + sx * (.5 + far * 1.2); eye[1] = t[1] + (e[1] - t[1]) * pull - sy * (.3 + far * .7); eye[2] = t[2] + (e[2] - t[2]) * pull - sx * (.3 + far * .9);
    viewProj(eye, t, aspect, aspect > 1.15 ? .46 * far : 0, aspect < .9 ? .34 : aspect < 1.15 ? .2 : 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(U.uVP, false, VP); gl.uniform1f(U.uIntro, intro); gl.uniform3fv(U.uEye, eye); gl.uniform1f(U.uTime, time); gl.uniform1f(U.uHi, hi);
    gl.uniform4f(U.uOn, on[0], on[1] * flick, on[2], on[3]);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.drawArrays(gl.TRIANGLES, 0, VCOUNT);

    // hotspots follow their objects
    var stop = 0, best = 9; STOPS.forEach(function (s, n) { var d = Math.abs(pShown - s); if (d < best) { best = d; stop = n; } });
    var moving = best > .07, dim = document.body.classList.contains('dim');
    for (i = 0; i < spots.length; i++) {
      var s = spots[i], q = project(s.p), show = settled && !dim && !moving && q && s.stops.indexOf(stop) >= 0 && q[0] > 20 && q[0] < window.innerWidth - 20 && q[1] > 70 && q[1] < window.innerHeight * (aspect < .9 && stop > 0 ? .6 : 1) - 40;
      if (q) s.el.style.transform = 'translate3d(' + q[0].toFixed(1) + 'px,' + q[1].toFixed(1) + 'px,0)';
      if (s.shown !== show) { s.shown = show; s.el.classList.toggle('is-on', !!show); s.el.tabIndex = show ? 0 : -1; }
    }
    if (!calm && intro >= 1) { slow = dt > .026 ? slow + 1 : Math.max(0, slow - 1); if (slow > 50 && tier < 2) { tier++; slow = 0; resize(); } }
    var busy = intro < 1 || Math.abs(p - pShown) > .0004 || Math.abs(px - sx) + Math.abs(py - sy) > .002 || hi || on.some(function (v, n) { return Math.abs(v - tgt[n]) > .004; });
    if (busy || dirty) { dirty = false; kick(); }
  }
  function kick() { if (!raf && visible) raf = requestAnimationFrame(frame); }
  window.addEventListener('scroll', function () { dirty = true; kick(); }, { passive: true });
  window.addEventListener('resize', function () { resize(); kick(); });
  window.addEventListener('pointermove', function (e) { if (calm) return; px = e.clientX / window.innerWidth - .5; py = e.clientY / window.innerHeight - .5; kick(); }, { passive: true });
  document.addEventListener('visibilitychange', function () { visible = !document.hidden; if (visible) { last = performance.now(); kick(); } });
  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); root.classList.remove('has-webgl'); root.classList.add('no-webgl'); settle(); });

  /* ------------------------------------------------------------ boot: paint the pictures, then switch on the lights */
  resize(); paintAtlas(null); upload();
  var img = new Image(); img.onload = function () { paintAtlas(img); upload(); kick(); }; img.src = canvas.getAttribute('data-portrait') || '';
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { paintAtlas(img.complete && img.naturalWidth ? img : null); upload(); kick(); });
  if (window.pageYOffset > 4) { intro = 1; }          // arriving mid-page: skip the intro
  last = performance.now(); kick();

  window.Room = {
    replay: function () { if (calm) return; settled = false; intro = 0; introT = 0; on = [0, 0, 0, 0]; kick(); },
    lamp: function () { lampOn = !lampOn; kick(); return lampOn; },
    goTo: function (stop) { var max = film.offsetHeight - window.innerHeight; window.scrollTo({ top: STOPS[stop] * max, behavior: calm ? 'auto' : 'smooth' }); },
    stops: STOPS, progress: function () { return p; }
  };
})();

/* Mayne's Room — the fixed 3D scene behind the page.
   Dependency-free WebGL. You stand INSIDE a night-time bedroom, at eye height, and never leave it.
   Scrolling walks you from the doorway to the desk, the shelf, the wall of frames and the bed;
   clicking an object walks you up to it. Lighting is baked once at load (soft shadows and ambient
   occlusion, traced on the CPU), so each frame is a single cheap draw that only runs when
   something actually moves. */
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
  var AT = 2048, SC = 2, atlas = document.createElement('canvas'); atlas.width = atlas.height = AT;
  var CELL = { monitor: [0, 0, 512, 288], laptop: [512, 0, 256, 160], calendar: [768, 0, 256, 256], window: [0, 288, 384, 320], qr: [384, 288, 256, 256],
    paper: [640, 288, 128, 170], phone: [768, 288, 96, 170], f0: [0, 608, 160, 200], f1: [160, 608, 160, 200], f2: [320, 608, 160, 200], f3: [480, 608, 160, 200], f4: [640, 608, 160, 200],
    portrait: [800, 608, 200, 200], rug: [0, 820, 400, 200], diploma: [864, 288, 160, 120], keys: [400, 820, 300, 96] };
  var EXT = {};   // optional photographs: <canvas data-window="…" data-rug="…"> replace the drawn window view and rug
  function paintAtlas(img) {
    var c = atlas.getContext('2d'), r, i, j;
    c.fillStyle = '#000'; c.fillRect(0, 0, AT, AT);
    function cell(k, fn) { r = CELL[k]; c.save(); c.translate(r[0] * SC, r[1] * SC); c.scale(SC, SC); c.beginPath(); c.rect(0, 0, r[2], r[3]); c.clip(); fn(r[2], r[3]); c.restore(); }
    var mono = '600 14px "Hanken Grotesk", sans-serif', sans = '800 30px "Hanken Grotesk", sans-serif';
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
      c.fillStyle = '#f3f0ff'; c.fillRect(0, 0, w, h); c.fillStyle = '#5546ea'; c.fillRect(0, 0, w, 46); c.fillStyle = '#fff'; c.font = '800 22px "Hanken Grotesk", sans-serif'; c.fillText('NOVEMBER', 16, 31);
      for (i = 0; i < 5; i++) for (j = 0; j < 7; j++) { c.strokeStyle = '#c9c3ea'; c.strokeRect(8 + j * 34.5, 56 + i * 39, 34.5, 39); var d = (i * 7 + j * 3) % 5; if (d < 3) { c.fillStyle = ['#e5484d', '#f5a524', '#30a46c'][d]; c.beginPath(); c.arc(25 + j * 34.5, 82 + i * 39, 5, 0, 7); c.fill(); } }
    });
    cell('window', function (w, h) { // night sky
      if (EXT.window) { var iw = EXT.window.width, ih = EXT.window.height, kk = Math.max(w / iw, h / ih); c.drawImage(EXT.window, (w - iw * kk) / 2, (h - ih * kk) / 2, iw * kk, ih * kk); c.strokeStyle = '#e8e6ef'; c.lineWidth = 9; c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke(); return; }
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
    cell('phone', function (w, h) { c.fillStyle = '#0f1024'; c.fillRect(0, 0, w, h); c.fillStyle = '#5fe3d0'; c.font = '800 20px "Hanken Grotesk", sans-serif'; c.fillText('$', 10, 28); c.strokeStyle = '#5fe3d0'; c.lineWidth = 3; c.beginPath(); for (i = 0; i <= 12; i++) { var yy = 70 - i * 2.4 - 9 * Math.sin(i); i ? c.lineTo(8 + i * 6.6, yy) : c.moveTo(8, yy); } c.stroke(); for (i = 0; i < 5; i++) { c.fillStyle = '#23254d'; c.fillRect(8, 86 + i * 16, w - 16, 11); } });
    [['NSBE', '#e8a93e'], ['MLT', '#e5484d'], ['JNPR', '#30a46c'], ['SEO', '#3e8ed0'], ['G', '#9b6bff']].forEach(function (f, n) {
      cell('f' + n, function (w, h) { c.fillStyle = '#2a2140'; c.fillRect(0, 0, w, h); c.fillStyle = '#f4f1ea'; c.fillRect(12, 12, w - 24, h - 24); c.fillStyle = f[1]; c.fillRect(24, 24, w - 48, h - 90);
        c.fillStyle = '#fff'; c.font = '800 ' + (f[0].length > 3 ? 30 : 40) + 'px "Hanken Grotesk", sans-serif'; c.textAlign = 'center'; c.fillText(f[0], w / 2, 24 + (h - 90) / 2 + 13); c.textAlign = 'left'; c.fillStyle = '#8d8aa8'; c.fillRect(34, h - 52, w - 68, 5); c.fillRect(50, h - 38, w - 100, 4); });
    });
    cell('portrait', function (w, h) { c.fillStyle = '#3a2d1c'; c.fillRect(0, 0, w, h); if (img) c.drawImage(img, 14, 14, w - 28, h - 28); else { c.fillStyle = '#c9b48a'; c.fillRect(14, 14, w - 28, h - 28); } });
    cell('rug', function (w, h) { if (EXT.rug) { c.drawImage(EXT.rug, 0, 0, w, h); return; } c.fillStyle = '#2f3a52'; c.fillRect(0, 0, w, h); c.strokeStyle = '#d9cdb6'; c.lineWidth = 7; c.strokeRect(14, 14, w - 28, h - 28); c.strokeStyle = '#b4692a'; c.lineWidth = 3; c.strokeRect(30, 30, w - 60, h - 60); for (i = 0; i < 9; i++) for (j = 0; j < 4; j++) { c.fillStyle = (i + j) % 2 ? '#3b4866' : '#27314a'; c.beginPath(); c.moveTo(60 + i * 35, 52 + j * 32); c.lineTo(77 + i * 35, 68 + j * 32); c.lineTo(60 + i * 35, 84 + j * 32); c.lineTo(43 + i * 35, 68 + j * 32); c.fill(); } });
    cell('keys', function (w, h) { c.fillStyle = '#15142a'; c.fillRect(0, 0, w, h); for (j = 0; j < 5; j++) for (i = 0; i < 15; i++) { c.fillStyle = (i * 7 + j * 3) % 11 === 0 ? '#3b3770' : '#2a2850'; c.fillRect(6 + i * 19.3, 6 + j * 17.4, j === 4 && i > 3 && i < 10 ? 19.3 : 16.5, 14.5); } });
    cell('diploma', function (w, h) { c.fillStyle = '#f7f1dc'; c.fillRect(0, 0, w, h); c.strokeStyle = '#b08d3c'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12); c.fillStyle = '#17162e'; c.font = '800 20px "Hanken Grotesk", sans-serif'; c.textAlign = 'center'; c.fillText('B.S. CS', w / 2, 48); c.font = mono; c.fillText('UML 2027', w / 2, 72); c.textAlign = 'left'; c.fillStyle = '#c8323a'; c.beginPath(); c.arc(w / 2, 94, 9, 0, 7); c.fill(); });
  }

  /* ------------------------------------------------------------ posters: a second, sharper sheet of pictures (all original artwork, drawn here) */
  var atlas2 = document.createElement('canvas'); atlas2.width = 2048; atlas2.height = 1024;
  var CELL2 = { hoops: [0, 0, 512, 768], anime: [512, 0, 512, 768], game: [1024, 0, 512, 768], board: [1536, 0, 512, 512] };
  function uvOf2(k) { var r = CELL2[k]; return [2 + r[0] / 2048, r[1] / 1024, 2 + (r[0] + r[2]) / 2048, (r[1] + r[3]) / 1024]; }
  function paintPosters() {
    var c = atlas2.getContext('2d'), g, i, j, r;
    function cell(k, fn) { r = CELL2[k]; c.save(); c.translate(r[0], r[1]); c.beginPath(); c.rect(0, 0, r[2], r[3]); c.clip(); fn(r[2], r[3]); c.restore(); }
    var disp = '800 64px "Bricolage Grotesque", "Hanken Grotesk", sans-serif';
    cell('hoops', function (w, h) { // basketball
      g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1b1410'); g.addColorStop(.6, '#5a2410'); g.addColorStop(1, '#c4571b'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 2; for (i = 0; i < 9; i++) { c.beginPath(); c.arc(w / 2, h * 1.05, 120 + i * 70, 0, 7); c.stroke(); }                       // court lines
      c.strokeStyle = '#f2ece2'; c.lineWidth = 9; c.strokeRect(w * .3, 96, w * .4, 150); c.strokeRect(w * .41, 160, w * .18, 86);                                                    // backboard
      c.strokeStyle = '#ff7a2f'; c.lineWidth = 10; c.beginPath(); c.ellipse(w / 2, 262, 74, 14, 0, 0, 7); c.stroke();                                                               // rim
      c.strokeStyle = 'rgba(242,236,226,.75)'; c.lineWidth = 3; for (i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(w / 2 + i * 22, 268); c.lineTo(w / 2 + i * 13, 372); c.stroke(); } for (j = 0; j < 4; j++) { c.beginPath(); c.ellipse(w / 2, 292 + j * 24, 66 - j * 8, 8, 0, 0, 7); c.stroke(); }
      var bx = w * .62, by = 480, br = 104; g = c.createRadialGradient(bx - 34, by - 40, 10, bx, by, br); g.addColorStop(0, '#ffa04d'); g.addColorStop(.7, '#e2631c'); g.addColorStop(1, '#8a340c'); c.fillStyle = g; c.beginPath(); c.arc(bx, by, br, 0, 7); c.fill();
      c.save(); c.beginPath(); c.arc(bx, by, br, 0, 7); c.clip(); c.strokeStyle = '#2a140a'; c.lineWidth = 5; c.beginPath(); c.moveTo(bx - br, by); c.lineTo(bx + br, by); c.moveTo(bx, by - br); c.lineTo(bx, by + br); c.stroke(); c.beginPath(); c.arc(bx - br * 1.15, by, br * .9, -1.1, 1.1); c.stroke(); c.beginPath(); c.arc(bx + br * 1.15, by, br * .9, 2.04, 4.24); c.stroke(); c.restore();
      c.fillStyle = '#f6efe2'; c.font = disp; c.fillText('NOTHING', 36, 640); c.fillText('BUT NET', 36, 706); c.fillStyle = '#ffb27a'; c.font = '600 22px "Hanken Grotesk", sans-serif'; c.fillText('PLAY HARD  ·  STAY HUMBLE', 38, 742);
    });
    cell('anime', function (w, h) { // an original anime-style key visual: a lone traveller under a huge sun
      g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1a1438'); g.addColorStop(.45, '#b23a5a'); g.addColorStop(.75, '#f08a4b'); g.addColorStop(1, '#f6d58e'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = '#fff3d6'; c.beginPath(); c.arc(w * .56, h * .47, 150, 0, 7); c.fill(); c.fillStyle = 'rgba(255,243,214,.18)'; c.beginPath(); c.arc(w * .56, h * .47, 196, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,255,255,.75)'; for (i = 0; i < 40; i++) c.fillRect((i * 131) % w, (i * 67) % (h * .32), 3, 3);
      [['#7a2c5a', .62, 46], ['#4a1f4d', .7, 70], ['#24143a', .8, 54]].forEach(function (m, n) { c.fillStyle = m[0]; c.beginPath(); c.moveTo(0, h); for (i = 0; i <= 16; i++) c.lineTo(i * w / 16, h * m[1] - Math.abs(Math.sin(i * 1.7 + n * 2.3)) * m[2] - (i % 3) * 9); c.lineTo(w, h); c.fill(); });
      c.fillStyle = '#120a22'; c.beginPath(); c.moveTo(0, h); c.lineTo(0, h * .86); c.lineTo(w * .3, h * .8); c.lineTo(w * .43, h * .835); c.lineTo(w * .47, h); c.fill();                    // cliff
      var fx = w * .33, fy = h * .8; c.fillRect(fx - 7, fy - 84, 14, 60); c.beginPath(); c.arc(fx, fy - 96, 13, 0, 7); c.fill(); c.fillRect(fx - 9, fy - 26, 7, 28); c.fillRect(fx + 2, fy - 26, 7, 28);   // the traveller
      c.beginPath(); c.moveTo(fx - 6, fy - 80); c.quadraticCurveTo(fx - 70, fy - 62, fx - 92, fy - 20); c.lineTo(fx - 50, fy - 34); c.lineTo(fx - 4, fy - 30); c.fill();                    // cape in the wind
      c.strokeStyle = '#120a22'; c.lineWidth = 5; c.beginPath(); c.moveTo(fx + 8, fy - 70); c.lineTo(fx + 52, fy - 132); c.stroke();                                                       // staff
      c.fillStyle = '#fff3d6'; c.font = '800 54px "Hanken Grotesk", sans-serif'; ['旅', '路', 'の', '果', 'て'].forEach(function (ch, n) { c.fillText(ch, w - 86, 92 + n * 62); });
      c.font = disp; c.fillText('FAR ROAD', 34, h - 60); c.font = '600 20px "Hanken Grotesk", sans-serif'; c.fillStyle = '#f6d58e'; c.fillText('AN ORIGINAL SERIES  ·  SEASON ONE', 36, h - 28);
    });
    cell('game', function (w, h) { // an original retro game poster
      c.fillStyle = '#0c1024'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(90,230,200,.12)'; c.lineWidth = 2; for (i = 0; i <= 16; i++) { c.beginPath(); c.moveTo(i * 32, 0); c.lineTo(i * 32, h); c.stroke(); } for (i = 0; i <= 24; i++) { c.beginPath(); c.moveTo(0, i * 32); c.lineTo(w, i * 32); c.stroke(); }
      var SPR = ['..XXXX..', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', 'XXXXXXXX', '.X.XX.X.', 'X.X..X.X', '.X....X.'], px = 34;
      SPR.forEach(function (row, y) { for (var x = 0; x < 8; x++) if (row.charAt(x) === 'X') { c.fillStyle = y < 2 ? '#5ae6c8' : y < 5 ? '#37c7e8' : '#7b8cff'; c.fillRect(120 + x * px, 110 + y * px, px - 3, px - 3); } });
      c.fillStyle = '#0c1024'; c.fillRect(120 + 2 * px + 6, 110 + 2 * px + 6, px - 15, px - 15); c.fillRect(120 + 5 * px + 6, 110 + 2 * px + 6, px - 15, px - 15);
      c.fillStyle = '#ff5d73'; [0, 1, 2].forEach(function (n) { var hx0 = 150 + n * 76, hy = 440; [[1, 0], [2, 0], [4, 0], [5, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [2, 3], [3, 3], [4, 3], [3, 4]].forEach(function (q) { c.fillRect(hx0 + q[0] * 9, hy + q[1] * 9, 8, 8); }); });
      c.fillStyle = '#f6efe2'; c.font = '800 70px "Bricolage Grotesque", "Hanken Grotesk", sans-serif'; c.fillText('PRESS', 44, 596); c.fillStyle = '#5ae6c8'; c.fillText('START', 44, 668);
      c.fillStyle = '#9aa3c7'; c.font = '600 22px "Hanken Grotesk", sans-serif'; c.fillText('1 PLAYER   ·   HI-SCORE 999990', 46, 716); c.strokeStyle = '#5ae6c8'; c.lineWidth = 6; c.strokeRect(18, 18, w - 36, h - 36);
    });
    cell('board', function (w, h) { // cork board with notes
      c.fillStyle = '#b98a58'; c.fillRect(0, 0, w, h); for (i = 0; i < 1400; i++) { c.fillStyle = 'rgba(' + (90 + (i * 37) % 60) + ',' + (60 + (i * 17) % 40) + ',30,.25)'; c.fillRect((i * 193) % w, (i * 71) % h, 3 + i % 4, 2 + i % 3); }
      [[40, 50, 150, 130, '#fff2a8', -4], [220, 36, 150, 150, '#f6efe2', 3], [372, 210, 110, 110, '#ffd0d6', 6], [50, 230, 190, 130, '#cfe9ff', -2], [270, 250, 80, 200, '#f6efe2', -5], [70, 390, 170, 96, '#d9f2c4', 4]].forEach(function (n, k) {
        c.save(); c.translate(n[0] + n[2] / 2, n[1] + n[3] / 2); c.rotate(n[5] * Math.PI / 180); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(-n[2] / 2 + 4, -n[3] / 2 + 6, n[2], n[3]); c.fillStyle = n[4]; c.fillRect(-n[2] / 2, -n[3] / 2, n[2], n[3]);
        c.fillStyle = 'rgba(40,30,20,.55)'; for (j = 0; j < 4; j++) c.fillRect(-n[2] / 2 + 14, -n[3] / 2 + 26 + j * 20, n[2] - 28 - (j * 23 + k * 11) % 40, 5);
        c.fillStyle = ['#d8474c', '#3e8ed0', '#e8a93e'][k % 3]; c.beginPath(); c.arc(0, -n[3] / 2 + 10, 8, 0, 7); c.fill(); c.restore();
      });
      c.strokeStyle = '#5d3f27'; c.lineWidth = 18; c.strokeRect(0, 0, w, h);
    });
  }

  /* ------------------------------------------------------------ geometry: boxes, cylinders and balls, cut into small cells so baked light can vary across a surface */
  var STR = 19, data = [], vpart = [], OCC = [], IDS = {}, nextId = 1, part = 0, GRID = .2;
  function uvOf(k) { var r = CELL[k]; return [r[0] / 1024, r[1] / 1024, (r[0] + r[2]) / 1024, (r[1] + r[3]) / 1024]; }
  function hx(h) { return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]; }
  function vtx(p, n, col, o, u, v, id) { data.push(p[0], p[1], p[2], n[0], n[1], n[2], col[0], col[1], col[2], o.em || 0, o.grp || 0, u, v, id, o.mat || 0, 1, 1, 1, 1); vpart.push(part); }
  function quad(c, n, col, o, t, id) { // c = corners bottom-left, bottom-right, top-right, top-left seen from outside
    var lu = Math.hypot(c[1][0] - c[0][0], c[1][1] - c[0][1], c[1][2] - c[0][2]), lv = Math.hypot(c[3][0] - c[0][0], c[3][1] - c[0][1], c[3][2] - c[0][2]);
    var nu = clamp(Math.ceil(lu / GRID), 1, 30), nv = clamp(Math.ceil(lv / GRID), 1, 30), i, j;
    function P(a, b) { return [c[0][0] + (c[1][0] - c[0][0]) * a + (c[3][0] - c[0][0]) * b, c[0][1] + (c[1][1] - c[0][1]) * a + (c[3][1] - c[0][1]) * b, c[0][2] + (c[1][2] - c[0][2]) * a + (c[3][2] - c[0][2]) * b]; }
    function put(a, b) { vtx(P(a, b), n, col, o, t ? t[0] + (t[2] - t[0]) * a : -1, t ? t[3] + (t[1] - t[3]) * b : -1, id); }
    for (i = 0; i < nu; i++) for (j = 0; j < nv; j++) { var a0 = i / nu, a1 = (i + 1) / nu, b0 = j / nv, b1 = (j + 1) / nv; put(a0, b0); put(a1, b0); put(a1, b1); put(a0, b0); put(a1, b1); put(a0, b1); }
  }
  // box(name, [x0,y0,z0,x1,y1,z1], colour, {mat, em, grp, tex, face, skip, noOcc})
  function box(name, b, col, o) {
    o = o || {}; var id = IDS[name] || (IDS[name] = nextId++); part++;
    var x0 = b[0], y0 = b[1], z0 = b[2], x1 = b[3], y1 = b[4], z1 = b[5], t = o.tex ? uvOf(o.tex) : o.tex2 ? uvOf2(o.tex2) : null;
    var F = [['+z', [0, 0, 1], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]], ['-z', [0, 0, -1], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]]],
      ['+x', [1, 0, 0], [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]]], ['-x', [-1, 0, 0], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]]],
      ['+y', [0, 1, 0], [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]]], ['-y', [0, -1, 0], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]]];
    F.forEach(function (f) {
      if (o.skip && o.skip.indexOf(f[0]) >= 0) return;
      var on = t && f[0] === (o.face || '+z'), oo = (t && !on) ? { mat: o.sideMat || 0, em: 0, grp: o.grp } : o;
      quad(f[2], f[1], (t && !on && o.side) ? o.side : col, oo, on ? t : null, id);
    });
    if (!o.noOcc && Math.min(x1 - x0, y1 - y0, z1 - z0) > .025) OCC.push([x0, y0, z0, x1, y1, z1, part]);
    return id;
  }
  // rbox: a box with softened edges and corners, so furniture catches the light the way real furniture does. r is the edge radius.
  function rbox(name, b, col, o, r) {
    o = o || {}; var id = IDS[name] || (IDS[name] = nextId++); part++;
    var mn = [b[0], b[1], b[2]], mx = [b[3], b[4], b[5]]; r = Math.min(r, (mx[0] - mn[0]) / 2 - .0005, (mx[1] - mn[1]) / 2 - .0005, (mx[2] - mn[2]) / 2 - .0005);
    function samples(a) { var L = mx[a] - mn[a], out = [0, r * .3 / L, r * .68 / L, r / L], n = clamp(Math.ceil((L - 2 * r) / GRID), 1, 30), i; for (i = 1; i < n; i++) out.push((r + (L - 2 * r) * i / n) / L); out.push(1 - r / L, 1 - r * .68 / L, 1 - r * .3 / L, 1); return out; }
    var S3 = [samples(0), samples(1), samples(2)];
    function put(pt) { var q = [clamp(pt[0], mn[0] + r, mx[0] - r), clamp(pt[1], mn[1] + r, mx[1] - r), clamp(pt[2], mn[2] + r, mx[2] - r)], n = [pt[0] - q[0], pt[1] - q[1], pt[2] - q[2]], l = Math.hypot(n[0], n[1], n[2]) || 1; n = [n[0] / l, n[1] / l, n[2] / l]; vtx([q[0] + n[0] * r, q[1] + n[1] * r, q[2] + n[2] * r], n, col, o, -1, -1, id); }
    // each face: [fixed axis, value, u axis, v axis, flip] chosen so the corners run anticlockwise seen from outside
    [[2, 1, 0, 1, 0], [2, 0, 0, 1, 1], [0, 1, 2, 1, 1], [0, 0, 2, 1, 0], [1, 1, 0, 2, 1], [1, 0, 0, 2, 0]].forEach(function (f) {
      if (o.skip && o.skip.indexOf((f[1] ? '+' : '-') + 'xyz'.charAt(f[0])) >= 0) return;
      var su = S3[f[2]], sv = S3[f[3]], i, j;
      function P(a, c2) { var pt = [0, 0, 0]; pt[f[0]] = f[1] ? mx[f[0]] : mn[f[0]]; pt[f[2]] = mn[f[2]] + (mx[f[2]] - mn[f[2]]) * a; pt[f[3]] = mn[f[3]] + (mx[f[3]] - mn[f[3]]) * c2; return pt; }
      for (i = 0; i < su.length - 1; i++) for (j = 0; j < sv.length - 1; j++) {
        var p00 = P(su[i], sv[j]), p10 = P(su[i + 1], sv[j]), p11 = P(su[i + 1], sv[j + 1]), p01 = P(su[i], sv[j + 1]);
        if (f[4]) { put(p00); put(p11); put(p10); put(p00); put(p01); put(p11); } else { put(p00); put(p10); put(p11); put(p00); put(p11); put(p01); }
      }
    });
    if (!o.noOcc) OCC.push([b[0], b[1], b[2], b[3], b[4], b[5], part]);
    return id;
  }
  // cyl(name, [x,y,z] base centre, bottom radius, top radius, height, colour, {axis:'x'|'z', seg, open})
  function cyl(name, c, r0, r1, h, col, o) {
    o = o || {}; var id = IDS[name] || (IDS[name] = nextId++), seg = o.seg || 14, i, ax = o.axis; part++;
    function T(l) { return ax === 'x' ? [c[0] + l[1], c[1] + l[2], c[2] + l[0]] : ax === 'z' ? [c[0] + l[2], c[1] + l[0], c[2] + l[1]] : [c[0] + l[0], c[1] + l[1], c[2] + l[2]]; }
    function R(l) { return ax === 'x' ? [l[1], l[2], l[0]] : ax === 'z' ? [l[2], l[0], l[1]] : l; }
    var sl = r0 - r1, nl = Math.hypot(h, sl) || 1;
    for (i = 0; i < seg; i++) {
      var a0 = i / seg * 6.28318, a1 = (i + 1) / seg * 6.28318, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      var n0 = R([c0 * h / nl, sl / nl, s0 * h / nl]), n1 = R([c1 * h / nl, sl / nl, s1 * h / nl]);
      var bl = T([c1 * r0, 0, s1 * r0]), br = T([c0 * r0, 0, s0 * r0]), tr = T([c0 * r1, h, s0 * r1]), tl = T([c1 * r1, h, s1 * r1]);
      vtx(bl, n1, col, o, -1, -1, id); vtx(br, n0, col, o, -1, -1, id); vtx(tr, n0, col, o, -1, -1, id); vtx(bl, n1, col, o, -1, -1, id); vtx(tr, n0, col, o, -1, -1, id); vtx(tl, n1, col, o, -1, -1, id);
      if (o.inside) { var m0 = [-n0[0], -n0[1], -n0[2]], m1 = [-n1[0], -n1[1], -n1[2]], io = { mat: o.mat, em: o.inside, grp: o.grp }; vtx(br, m0, col, io, -1, -1, id); vtx(bl, m1, col, io, -1, -1, id); vtx(tl, m1, col, io, -1, -1, id); vtx(br, m0, col, io, -1, -1, id); vtx(tl, m1, col, io, -1, -1, id); vtx(tr, m0, col, io, -1, -1, id); }
      if (!o.open) {
        if (r1 > .001) { var up = R([0, 1, 0]), ct = T([0, h, 0]); vtx(ct, up, col, o, -1, -1, id); vtx(tl, up, col, o, -1, -1, id); vtx(tr, up, col, o, -1, -1, id); }
        if (r0 > .001) { var dn = R([0, -1, 0]), cb = T([0, 0, 0]); vtx(cb, dn, col, o, -1, -1, id); vtx(br, dn, col, o, -1, -1, id); vtx(bl, dn, col, o, -1, -1, id); }
      }
    }
    var rm = Math.max(r0, r1), a = T([-rm, 0, -rm]), b = T([rm, h, rm]);
    if (!o.noOcc) OCC.push([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2]), part]);
    return id;
  }
  // ball(name, centre, [rx,ry,rz], colour, opts)  — an ellipsoid, for pillows, leaves and anything soft
  function ball(name, c, r, col, o) {
    o = o || {}; var id = IDS[name] || (IDS[name] = nextId++), su = o.seg || 12, sv = Math.max(5, Math.round(su * .6)), i, j; part++;
    function pt(a, e) { var ce = Math.cos(e), d = [Math.cos(a) * ce, Math.sin(e), Math.sin(a) * ce], n = [d[0] / r[0], d[1] / r[1], d[2] / r[2]], l = Math.hypot(n[0], n[1], n[2]); return [[c[0] + d[0] * r[0], c[1] + d[1] * r[1], c[2] + d[2] * r[2]], [n[0] / l, n[1] / l, n[2] / l]]; }
    for (i = 0; i < su; i++) for (j = 0; j < sv; j++) {
      var a0 = i / su * 6.28318, a1 = (i + 1) / su * 6.28318, e0 = -1.5708 + j / sv * 3.14159, e1 = -1.5708 + (j + 1) / sv * 3.14159;
      var bl = pt(a1, e0), br = pt(a0, e0), tr = pt(a0, e1), tl = pt(a1, e1);
      [bl, br, tr, bl, tr, tl].forEach(function (q) { vtx(q[0], q[1], col, o, -1, -1, id); });
    }
    if (!o.noOcc) OCC.push([c[0] - r[0] * .8, c[1] - r[1] * .8, c[2] - r[2] * .8, c[0] + r[0] * .8, c[1] + r[1] * .8, c[2] + r[2] * .8, part]);
    return id;
  }

  /* ------------------------------------------------------------ the room. 6 m wide (x), 5 m deep (z), 2.9 m tall. Back wall z=0, left wall x=0. */
  var W = 6, D = 5, Hh = 2.9;
  var LAMP = [.92, 1.3, .34], FLAMP = [5.5, 1.56, 3.55], MON = [1.5, 1.31, .56];   // where the light sources are
  // materials: 0 plain · 1 wood (grain along x) · 2 wood (grain along z) · 3 floorboards · 4 painted wall · 5 fabric · 6 glossy · 7 wood (grain along y)
  (function buildRoom() {
    var wall = hx('#d8d0c2'), ceil = hx('#e6e1d7'), floor = hx('#a87447'), wood = hx('#b07c4c'), woodD = hx('#6a4a33'), white = hx('#f0ede6'), dark = hx('#26252b'), metal = hx('#8f8d8a'), duvet = hx('#3f4d6b'), sheet = hx('#e9e5dc'), trim = hx('#ebe7de');
    // shell
    box('floor', [-.15, -.2, -.15, W + .15, 0, D + .15], floor, { mat: 3, skip: '-y' });
    box('wallB', [-.15, 0, -.15, W + .15, Hh, 0], wall, { mat: 4, skip: '-z,-y,+y' }); box('wallL', [-.15, 0, 0, 0, Hh, D], wall, { mat: 4, skip: '-x,-y,+y' });
    box('wallR', [W, 0, 0, W + .15, Hh, D], wall, { mat: 4, skip: '+x,-y,+y' }); box('wallF', [-.15, 0, D, W + .15, Hh, D + .15], wall, { mat: 4, skip: '+z,-y,+y' });
    box('ceiling', [-.15, Hh, -.15, W + .15, Hh + .15, D + .15], ceil, { mat: 4, skip: '+y' });
    box('trim', [0, 0, 0, W, .1, .025], trim, { noOcc: 1 }); box('trim', [0, 0, 0, .025, .1, D], trim, { noOcc: 1 }); box('trim', [W - .025, 0, 0, W, .1, D], trim, { noOcc: 1 }); box('trim', [0, 0, D - .025, W, .1, D], trim, { noOcc: 1 });
    cyl('ceilLight', [3, Hh - .07, 2.5], .24, .2, .07, white, { seg: 20, noOcc: 1 });
    box('rug', [1.5, 0, 1.75, 4.5, .018, 3.95], white, { tex: 'rug', face: '+y', mat: 5, sideMat: 5, side: hx('#2f3a52') });
    // door (front wall) and wardrobe (right wall)
    box('door', [4.55, 0, D - .05, 5.45, 2.05, D], hx('#d9d5e2'), { mat: 6, noOcc: 1 }); box('door', [4.47, 0, D - .03, 4.55, 2.13, D], trim, { noOcc: 1 }); box('door', [5.45, 0, D - .03, 5.53, 2.13, D], trim, { noOcc: 1 }); box('door', [4.47, 2.05, D - .03, 5.53, 2.13, D], trim, { noOcc: 1 });
    cyl('door', [4.66, 1.0, D - .12], .022, .022, .07, metal, { axis: 'z', mat: 6, seg: 8, noOcc: 1 }); ball('door', [4.66, 1.0, D - .13], [.035, .035, .03], metal, { mat: 6, seg: 8, noOcc: 1 });
    box('switch', [4.3, 1.15, D - .012, 4.38, 1.27, D], white, { mat: 6, noOcc: 1 });
    rbox('wardrobe', [W - .6, 0, 3.75, W, 2.1, 4.95], hx('#8a6244'), { mat: 7 }, 0.015); box('wardrobe', [W - .615, .06, 3.79, W - .6, 2.04, 4.34], hx('#96694a'), { mat: 7, noOcc: 1 }); box('wardrobe', [W - .615, .06, 4.36, W - .6, 2.04, 4.91], hx('#96694a'), { mat: 7, noOcc: 1 });
    cyl('wardrobe', [W - .64, .95, 4.31], .01, .01, .22, metal, { mat: 6, seg: 6, noOcc: 1 }); cyl('wardrobe', [W - .64, .95, 4.39], .01, .01, .22, metal, { mat: 6, seg: 6, noOcc: 1 });
    // floor lamp in the corner by the wardrobe
    cyl('flamp', [5.5, 0, 3.55], .15, .15, .025, dark, { mat: 6, seg: 18, noOcc: 1 }); cyl('flamp', [5.5, .02, 3.55], .014, .014, 1.42, dark, { mat: 6, seg: 8, noOcc: 1 });
    cyl('flamp', [5.5, 1.42, 3.55], .2, .13, .3, hx('#f3e3c2'), { seg: 22, open: 1, em: .45, grp: 4, inside: 1.5, mat: 5, noOcc: 1 });
    // desk and everything on it
    rbox('desk', [.45, .75, .12, 2.95, .8, 1.06], wood, { mat: 1 }, 0.012); box('desk', [.5, 0, .16, .56, .75, 1.0], woodD, { mat: 7 }); box('desk', [2.84, 0, .16, 2.9, .75, 1.0], woodD, { mat: 7 });
    rbox('desk', [2.24, .22, .16, 2.84, .75, 1.0], woodD, { mat: 7 }, 0.01); box('desk', [2.26, .5, 1.0, 2.82, .73, 1.012], wood, { mat: 1, noOcc: 1 }); box('desk', [2.26, .25, 1.0, 2.82, .48, 1.012], wood, { mat: 1, noOcc: 1 });
    cyl('desk', [2.54, .615, 1.012], .012, .012, .02, metal, { axis: 'z', mat: 6, seg: 8, noOcc: 1 }); cyl('desk', [2.54, .365, 1.012], .012, .012, .02, metal, { axis: 'z', mat: 6, seg: 8, noOcc: 1 });
    box('led', [.5, .715, .1, 2.9, .735, .12], hx('#ffd9a8'), { em: 2.4, grp: 3, noOcc: 1 });
    cyl('monitor', [1.5, .8, .46], .15, .15, .012, dark, { mat: 6, seg: 20, noOcc: 1 }); box('monitor', [1.475, .81, .43, 1.525, 1.05, .46], dark, { mat: 6, noOcc: 1 });
    rbox('monitor', [.96, .98, .405, 2.04, 1.64, .44], dark, { mat: 6 }, 0.012); box('monitor', [.975, .995, .44, 2.025, 1.625, .446], white, { tex: 'monitor', em: 1.15, grp: 1, noOcc: 1, side: dark });
    box('laptop', [2.15, .8, .56, 2.75, .818, .96], hx('#b9b6cf'), { mat: 6, noOcc: 1 }); box('laptop', [2.19, .818, .6, 2.71, .821, .8], white, { tex: 'keys', face: '+y', noOcc: 1, side: dark });
    box('laptop', [2.15, .81, .535, 2.75, 1.2, .552], hx('#b9b6cf'), { mat: 6, noOcc: 1, skip: '+z' }); box('laptop', [2.15, .81, .552, 2.75, 1.2, .556], white, { tex: 'laptop', em: 1.0, grp: 1, noOcc: 1, side: dark });
    box('keys', [1.15, .8, .68, 1.85, .822, .9], white, { tex: 'keys', face: '+y', noOcc: 1, side: dark }); ball('mouse', [2.0, .81, .8], [.035, .022, .055], white, { mat: 6, seg: 10, noOcc: 1 });
    box('paper', [.58, .8, .64, .88, .804, 1.02], white, { tex: 'paper', face: '+y', noOcc: 1 });
    cyl('mug', [.68, .8, .5], .045, .05, .11, hx('#d8474c'), { mat: 6, seg: 16, noOcc: 1 }); cyl('mug', [.68, .9, .5], .042, .042, .005, hx('#3a2418'), { seg: 16, noOcc: 1 });
    cyl('lamp', [.92, .8, .3], .09, .08, .02, dark, { mat: 6, seg: 18, noOcc: 1 }); cyl('lamp', [.92, .82, .3], .012, .012, .44, dark, { mat: 6, seg: 8, noOcc: 1 });
    cyl('lamp', [.92, 1.24, .3], .15, .07, .17, hx('#f2d9a8'), { seg: 22, open: 1, em: .42, grp: 2, inside: 1.5, mat: 5, noOcc: 1 });
    // chair
    rbox('chair', [1.24, .46, 1.42, 1.86, .54, 2.0], hx('#2f3036'), { mat: 5 }, 0.035); rbox('chair', [1.26, .6, 1.96, 1.84, 1.16, 2.04], hx('#2f3036'), { mat: 5 }, 0.035); box('chair', [1.52, .5, 1.98, 1.58, .62, 2.02], dark, { noOcc: 1 });
    cyl('chair', [1.55, .08, 1.71], .028, .028, .38, metal, { mat: 6, seg: 8, noOcc: 1 }); box('chair', [1.27, .05, 1.69, 1.83, .085, 1.73], dark, { mat: 6, noOcc: 1 }); box('chair', [1.53, .05, 1.43, 1.57, .085, 1.99], dark, { mat: 6, noOcc: 1 });
    [[1.28, 1.71], [1.82, 1.71], [1.55, 1.44], [1.55, 1.98]].forEach(function (q) { ball('chair', [q[0], .03, q[1]], [.03, .03, .03], dark, { seg: 6, noOcc: 1 }); });
    // on the back wall
    box('calendar', [.5, 1.55, 0, .92, 2.05, .012], white, { tex: 'calendar', noOcc: 1 });
    box('qr', [2.3, 1.55, 0, 2.86, 2.11, .012], white, { tex: 'qr', noOcc: 1 });
    // window, with frame, sill and curtains
    box('window', [3.78, 1.28, 0, 5.32, 2.57, .01], white, { tex: 'window', em: 1, grp: 0, noOcc: 1 });
    box('wframe', [3.7, 1.2, 0, 3.78, 2.65, .06], trim, { noOcc: 1 }); box('wframe', [5.32, 1.2, 0, 5.4, 2.65, .06], trim, { noOcc: 1 }); box('wframe', [3.7, 2.57, 0, 5.4, 2.65, .06], trim, { noOcc: 1 }); box('wframe', [3.66, 1.16, 0, 5.44, 1.21, .13], trim, {});
    cyl('rod', [3.4, 2.75, .1], .012, .012, 2.3, dark, { axis: 'x', mat: 6, seg: 8, noOcc: 1 });
    var cu = hx('#59627a'), i;
    for (i = 0; i < 5; i++) { cyl('curtain', [3.44 + i * .075, 1.0, .1 + (i % 2) * .03], .05, .05, 1.76, cu, { seg: 8, mat: 5, noOcc: 1 }); cyl('curtain', [5.36 + i * .075, 1.0, .1 + (i % 2) * .03], .05, .05, 1.76, cu, { seg: 8, mat: 5, noOcc: 1 }); }
    // bed
    rbox('bed', [3.5, .12, .14, 5.85, .3, 2.5], woodD, { mat: 2 }, 0.02); rbox('bed', [3.5, 0, .06, 5.85, 1.0, .14], woodD, { mat: 1 }, 0.02);
    [[3.56, .2], [5.79, .2], [3.56, 2.44], [5.79, 2.44]].forEach(function (q) { box('bed', [q[0] - .04, 0, q[1] - .04, q[0] + .04, .12, q[1] + .04], woodD, { noOcc: 1 }); });
    rbox('bed', [3.54, .3, .16, 5.81, .52, 2.46], sheet, { mat: 5 }, 0.06);
    rbox('bed', [3.5, .34, 1.02, 5.85, .56, 2.5], duvet, { mat: 5 }, 0.07); ball('bed', [4.675, .55, 1.76], [1.2, .075, .76], duvet, { mat: 5, seg: 18, noOcc: 1 });
    ball('pillow', [4.12, .6, .5], [.42, .1, .27], white, { mat: 5, seg: 14 }); ball('pillow', [5.22, .6, .5], [.42, .1, .27], white, { mat: 5, seg: 14 });
    // backpack on the bed
    rbox('bag', [3.8, .58, 2.02, 4.1, .96, 2.2], hx('#2b3050'), { mat: 5 }, 0.05); ball('bag', [3.95, .96, 2.11], [.15, .07, .09], hx('#2b3050'), { mat: 5, seg: 12, noOcc: 1 }); box('bag', [3.84, .62, 2.2, 4.06, .8, 2.235], hx('#3b4270'), { mat: 5, noOcc: 1 }); box('bag', [3.93, .8, 2.2, 3.97, .93, 2.21], hx('#8d8c99'), { mat: 6, noOcc: 1 });
    // nightstand
    rbox('stand', [2.99, 0, .12, 3.43, .5, .6], wood, { mat: 7 }, 0.012); box('stand', [3.01, .27, .6, 3.41, .47, .61], woodD, { mat: 1, noOcc: 1 }); ball('stand', [3.21, .37, .62], [.015, .015, .015], metal, { mat: 6, seg: 6, noOcc: 1 });
    box('portrait', [3.06, .5, .2, 3.36, .86, .225], dark, { noOcc: 1, skip: '+z' }); box('portrait', [3.06, .5, .225, 3.36, .86, .23], white, { tex: 'portrait', noOcc: 1, mat: 6, side: dark });
    box('phone', [3.14, .5, .4, 3.26, .508, .58], white, { tex: 'phone', face: '+y', em: 1.1, grp: 1, noOcc: 1, side: dark });
    // bookshelf on the left wall
    box('shelf', [0, 0, 2.0, .34, 1.9, 2.04], woodD, { mat: 7 }); box('shelf', [0, 0, 3.26, .34, 1.9, 3.3], woodD, { mat: 7 }); box('shelf', [0, 0, 2.04, .015, 1.9, 3.26], hx('#4d3526'), { noOcc: 1 });
    [0, .46, .92, 1.38, 1.86].forEach(function (y) { box('shelf', [0, y, 2.04, .34, y + .04, 3.26], wood, { mat: 2 }); });
    var spine = ['#6f7fe8', '#4fc7b6', '#e9a85e', '#e58ebd', '#d8474c', '#2f9c68', '#ece9e1', '#8d62e6', '#35518f', '#c9b48a'], z, n = 0;
    [.04, .5, .96].forEach(function (y, row) { for (z = 2.07; z < 3.2; ) { var th = .035 + (n * 7 % 5) * .009, hgt = .24 + (n * 13 % 9) * .014, dep = .2 + (n * 5 % 4) * .02; if (z + th > 3.22) break; if (!(row === 1 && n % 9 === 8)) box('books', [.03, y, z, .03 + dep, y + hgt, z + th], hx(spine[(n * 3 + row) % spine.length]), { mat: 6, noOcc: th < .05 }); z += th + .004 + (n % 9 === 8 ? .12 : 0); n++; } });
    for (z = 2.07; z < 2.8; ) { var t2 = .04 + (n * 7 % 5) * .008; box('books', [.03, 1.42, z, .25, 1.42 + .25 + (n * 13 % 9) * .012, z + t2], hx(spine[(n * 3) % spine.length]), { mat: 6, noOcc: 1 }); z += t2 + .004; n++; }
    box('diploma', [.02, 1.46, 2.9, .04, 1.76, 3.22], hx('#3a2a1c'), { noOcc: 1, skip: '+x' }); box('diploma', [.04, 1.46, 2.9, .045, 1.76, 3.22], white, { tex: 'diploma', face: '+x', noOcc: 1, mat: 6 });
    box('cap', [.06, 1.9, 2.3, .28, 1.96, 2.52], dark, { mat: 5, noOcc: 1 }); box('cap', [-0.0, 1.96, 2.23, .35, 1.975, 2.59], dark, { mat: 5, noOcc: 1 }); ball('cap', [.17, 1.98, 2.41], [.02, .012, .02], hx('#e8a93e'), { seg: 6, noOcc: 1 });
    // plant
    cyl('plant', [.28, 0, 3.78], .13, .17, .32, hx('#c2673f'), { seg: 16 }); cyl('plant', [.28, .3, 3.78], .15, .15, .012, hx('#3a2a1e'), { seg: 16, noOcc: 1 });
    [[0, .62, 0, .09, .34, .09], [.1, .56, .06, .16, .2, .07], [-.08, .6, .09, .07, .24, .15], [.05, .82, -.1, .13, .22, .08], [-.06, .9, -.02, .09, .26, .11], [.12, .74, -.06, .07, .2, .14], [0, 1.0, .06, .1, .2, .09]].forEach(function (l, k) {
      ball('plant', [.28 + l[0], .3 + l[1] - .2, 3.78 + l[2]], [l[3], l[4], l[5]], hx(['#2f7d3e', '#3b9450', '#4ea862'][k % 3]), { seg: 8, noOcc: 1 });
    });
    // posters over the bed (right wall): basketball, an anime-style print, a retro game
    [['hoops', .45], ['anime', 1.3], ['game', 2.15]].forEach(function (q, k) { var y0 = 1.28 + (k === 1 ? .08 : 0); box('poster', [W - .008, y0, q[1], W, y0 + .96, q[1] + .64], white, { tex2: q[0], face: '-x', noOcc: 1 }); });
    // cork board above the desk
    box('board', [1.22, 1.78, 0, 1.86, 2.42, .02], white, { tex2: 'board', noOcc: 1, side: hx('#5d3f27') });
    // a second bookcase: the small library under the frames
    rbox('library', [0, 0, 4.04, .3, 1.12, 4.08], woodD, { mat: 7 }, .006); rbox('library', [0, 0, 4.86, .3, 1.12, 4.9], woodD, { mat: 7 }, .006); box('library', [0, 0, 4.08, .012, 1.12, 4.86], hx('#4d3526'), { noOcc: 1 });
    [0, .37, .74, 1.09].forEach(function (y) { box('library', [0, y, 4.08, .3, y + .03, 4.86], wood, { mat: 2 }); });
    var sp2 = ['#2f4a7a', '#8a2f3a', '#e0d6c2', '#3d6b55', '#c98f3c', '#5a4a8a', '#1f1f24', '#b9c6d6', '#7a4a2a', '#d8474c'], zz, m = 0;
    [.03, .4, .77].forEach(function (y, row) { for (zz = 4.1; zz < 4.82; ) { var th = .028 + (m * 7 % 6) * .008, hg = .2 + (m * 11 % 8) * .014, dp = .17 + (m * 5 % 4) * .02; if (zz + th > 4.84) break; if (row === 1 && m % 11 === 10) { box('library', [.03, y, zz, .03 + .24, y + .09, zz + .17], hx(sp2[(m + 2) % 10]), { mat: 6, noOcc: 1 }); box('library', [.04, y + .09, zz + .01, .04 + .22, y + .15, zz + .16], hx(sp2[(m + 5) % 10]), { mat: 6, noOcc: 1 }); zz += .19; } else { box('library', [.03, y, zz, .03 + dp, y + hg, zz + th], hx(sp2[(m * 3 + row) % 10]), { mat: 6, noOcc: 1 }); zz += th + .003; } m++; } });
    box('library', [.04, 1.12, 4.2, .25, 1.17, 4.5], hx('#2f4a7a'), { mat: 6, noOcc: 1 }); box('library', [.05, 1.17, 4.22, .24, 1.215, 4.48], hx('#c98f3c'), { mat: 6, noOcc: 1 }); box('library', [.06, 1.215, 4.25, .23, 1.25, 4.46], hx('#e0d6c2'), { mat: 6, noOcc: 1 });
    // lava lamp on top of the first bookshelf
    cyl('lava', [.17, 1.9, 3.08], .06, .042, .09, metal, { mat: 6, seg: 16, noOcc: 1 }); cyl('lava', [.17, 1.99, 3.08], .042, .03, .2, hx('#ff5fa2'), { seg: 16, em: 1.5, grp: 3, noOcc: 1 }); cyl('lava', [.17, 2.19, 3.08], .03, .016, .07, metal, { mat: 6, seg: 16, noOcc: 1 });
    ball('lava', [.17, 2.05, 3.08], [.026, .034, .026], hx('#ffd166'), { em: 2.2, grp: 3, seg: 8, noOcc: 1 }); ball('lava', [.178, 2.13, 3.075], [.017, .024, .017], hx('#ffd166'), { em: 2.2, grp: 3, seg: 8, noOcc: 1 });
    // a basketball by the wardrobe, and a controller on the bed
    ball('ball', [5.1, .12, 3.45], [.12, .12, .12], hx('#d9661f'), { seg: 18, mat: 5 });
    rbox('pad', [4.7, .625, 1.5, 4.86, .655, 1.6], hx('#e9e6df'), { mat: 6, noOcc: 1 }, .012); ball('pad', [4.74, .66, 1.55], [.014, .008, .014], dark, { seg: 6, noOcc: 1 }); ball('pad', [4.82, .66, 1.55], [.014, .008, .014], dark, { seg: 6, noOcc: 1 });
    // five frames on the left wall
    ['f0', 'f1', 'f2', 'f3', 'f4'].forEach(function (f, k) { var z0 = 3.5 + (k % 3) * .5 + (k > 2 ? .25 : 0), y0 = k > 2 ? 2.14 : 1.46; box('frames', [0, y0, z0, .028, y0 + .56, z0 + .44], dark, { noOcc: 1, skip: '+x' }); box('frames', [.028, y0, z0, .032, y0 + .56, z0 + .44], white, { tex: f, face: '+x', noOcc: 1, mat: 6, side: dark }); });
  })();
  var NSOLID = data.length / STR;
  // soft glows (drawn last, added on top): [x, y, z, size, r, g, b, light group]
  [[.92, 1.3, .3, .55, 1, .72, .36, 2], [5.5, 1.56, 3.55, .75, 1, .74, .42, 4], [1.5, 1.31, .5, 1.25, .2, .26, .6, 1], [4.55, 1.95, .05, 1.7, .12, .16, .42, 0], [1.7, .7, .14, 1.3, .3, .22, .62, 3], [2.45, 1.02, .56, .6, .14, .18, .4, 1], [.17, 2.09, 3.08, .5, .9, .28, .45, 3]].forEach(function (g) {
    [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]].forEach(function (q) { data.push(g[0], g[1], g[2], 0, 0, 1, g[4], g[5], g[6], g[3], g[7], q[0], q[1], 0, 9, 1, 1, 1, 1); vpart.push(0); });
  });
  var VCOUNT = data.length / STR;

  /* ------------------------------------------------------------ bake: trace soft shadows and ambient occlusion once, on the CPU.
     Per vertex: ambient occlusion, then how much of the desk lamp, the floor lamp and the monitor it can see. */
  function hit(ox, oy, oz, dx, dy, dz, tmax, skip) { // nearest box along the ray, or -1
    var ix = 1 / (dx || 1e-9), iy = 1 / (dy || 1e-9), iz = 1 / (dz || 1e-9), best = -1, i, b, t0, t1, a, c, lo, hi;
    for (i = 0; i < OCC.length; i++) {
      b = OCC[i]; if (b[6] === skip) continue;
      a = (b[0] - ox) * ix; c = (b[3] - ox) * ix; lo = a < c ? a : c; hi = a < c ? c : a;
      a = (b[1] - oy) * iy; c = (b[4] - oy) * iy; t0 = a < c ? a : c; t1 = a < c ? c : a; if (t0 > lo) lo = t0; if (t1 < hi) hi = t1; if (lo > hi) continue;
      a = (b[2] - oz) * iz; c = (b[5] - oz) * iz; t0 = a < c ? a : c; t1 = a < c ? c : a; if (t0 > lo) lo = t0; if (t1 < hi) hi = t1;
      if (lo > hi || hi < 0 || lo > tmax) continue; if (lo < 0) lo = 0;
      if (best < 0 || lo < best) { best = lo; if (tmax < 1e8 && best < tmax) return best; }
    }
    return best;
  }
  (function bake() {
    var AOD = [], k, i, cache = {}, AOR = 1.1;
    for (k = 0; k < 14; k++) { var u = (k + .5) / 14, v = (k * .618034) % 1, r = Math.sqrt(u), a = v * 6.28318; AOD.push([r * Math.cos(a), r * Math.sin(a), Math.sqrt(1 - u)]); }
    var JIT = [[0, 0, 0], [.6, .3, -.5], [-.5, -.4, .6], [-.3, .6, .4]];
    function vis(px, py, pz, nx, ny, nz, L, rad, sx, sy, me) {
      var s = 0, j, lx, ly, lz, d;
      for (j = 0; j < 4; j++) {
        lx = L[0] + JIT[j][0] * (sx || rad) - px; ly = L[1] + JIT[j][1] * (sy || rad) - py; lz = L[2] + JIT[j][2] * rad - pz; d = Math.hypot(lx, ly, lz);
        if ((lx * nx + ly * ny + lz * nz) <= 0) continue;
        if (hit(px, py, pz, lx / d, ly / d, lz / d, d - .03, me) < 0) s++;
      }
      return s / 4;
    }
    for (i = 0; i < NSOLID; i++) {
      var o = i * STR, px = data[o], py = data[o + 1], pz = data[o + 2], nx = data[o + 3], ny = data[o + 4], nz = data[o + 5], me = vpart[i];
      var key = Math.round(px * 500) + ',' + Math.round(py * 500) + ',' + Math.round(pz * 500) + ',' + Math.round(nx * 4) + ',' + Math.round(ny * 4) + ',' + Math.round(nz * 4) + ',' + me, c = cache[key];
      if (!c) {
        var qx = px + nx * .012, qy = py + ny * .012, qz = pz + nz * .012, tx, ty, tz, bx, by, bz, l, occ = 0, t;
        if (Math.abs(ny) < .9) { tx = nz; ty = 0; tz = -nx; } else { tx = 1; ty = 0; tz = 0; }
        l = Math.hypot(tx, ty, tz); tx /= l; ty /= l; tz /= l; bx = ny * tz - nz * ty; by = nz * tx - nx * tz; bz = nx * ty - ny * tx;
        for (k = 0; k < AOD.length; k++) {
          var d = AOD[k], dx = tx * d[0] + bx * d[1] + nx * d[2], dy = ty * d[0] + by * d[1] + ny * d[2], dz = tz * d[0] + bz * d[1] + nz * d[2];
          t = hit(qx, qy, qz, dx, dy, dz, 1e9, me); if (t >= 0 && t < AOR) occ += 1 - (t / AOR) * (t / AOR) * .9;
        }
        c = cache[key] = [1 - occ / AOD.length, vis(qx, qy, qz, nx, ny, nz, LAMP, .05, 0, 0, me), vis(qx, qy, qz, nx, ny, nz, FLAMP, .08, 0, 0, me), vis(qx, qy, qz, nx, ny, nz, MON, 0, .42, .26, me)];
      }
      data[o + 15] = c[0]; data[o + 16] = c[1]; data[o + 17] = c[2]; data[o + 18] = c[3];
    }
  })();
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW); data = null; vpart = null;

  /* ------------------------------------------------------------ shaders */
  var VS = [
    'attribute vec3 aP; attribute vec3 aN; attribute vec3 aC; attribute vec2 aE; attribute vec2 aUV; attribute float aId; attribute float aM; attribute vec4 aB;',
    'uniform mat4 uVP; uniform vec3 uRight; uniform vec3 uUp;',
    'varying vec3 vP; varying vec3 vN; varying vec3 vC; varying vec2 vE; varying vec2 vUV; varying float vId; varying float vM; varying vec4 vB;',
    'void main(){',
    '  vec3 p = aP; if (aM > 8.5) p += (uRight*aUV.x + uUp*aUV.y)*aE.x;',      // glows are little cards that always face you
    '  vP = p; vN = aN; vC = aC; vE = aE; vUV = aUV; vId = aId; vM = aM; vB = aB;',
    '  gl_Position = uVP*vec4(p, 1.);',
    '}'
  ].join('\n');
  var FS = [
    'precision highp float;',
    'varying vec3 vP; varying vec3 vN; varying vec3 vC; varying vec2 vE; varying vec2 vUV; varying float vId; varying float vM; varying vec4 vB;',
    'uniform sampler2D uAtlas; uniform sampler2D uAtlas2; uniform vec4 uOn; uniform float uFl; uniform vec3 uEye; uniform float uHi; uniform float uTime;',
    'float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x*p.y); }',
    'float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3. - 2.*f); return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y); }',
    'float lit(float g){ return g < .5 ? max(uOn.x, .3) : g < 1.5 ? uOn.y : g < 2.5 ? uOn.z : g < 3.5 ? uOn.w : uFl; }',
    'vec3 N; vec3 V; vec3 alb; float rough; float specK;',
    // one point light: diffuse + a highlight whose tightness depends on the material
    'vec3 point(vec3 lp, vec3 lc, float k, float sh){',
    '  vec3 d = lp - vP; float r2 = dot(d, d); vec3 l = d*inversesqrt(r2); float ndl = max(dot(N, l), 0.); float att = 1./(1. + k*r2);',
    '  vec3 h = normalize(l + V); float sp = pow(max(dot(N, h), 0.), mix(90., 6., rough))*specK*(1.2 - rough);',
    '  return lc*att*sh*(alb*ndl + sp*step(.0001, ndl));',
    '}',
    'void main(){',
    '  if (vM > 8.5) { float a = exp(-dot(vUV, vUV)*3.2) - .04; gl_FragColor = vec4(vC*max(a, 0.)*lit(vE.y)*.55, 1.); return; }',
    '  N = normalize(vN); V = normalize(uEye - vP); alb = vC; rough = .85; specK = .12;',
    '  if (vM > .5 && vM < 2.5 || vM > 6.5) {',                                                    // wood: long streaks along the grain
    '    vec2 g = vM > 6.5 ? vec2(vP.y, vP.x + vP.z) : vM < 1.5 ? vec2(vP.x, vP.z + vP.y) : vec2(vP.z, vP.x + vP.y);',
    '    float s = vn(vec2(g.x*3., g.y*46.)); float w = vn(vec2(g.x*.9, g.y*7.));',
    '    alb *= .78 + .26*s + .16*w; rough = .5; specK = .22;',
    '  } else if (vM < 3.5 && vM > 2.5) {',                                                        // floorboards
    '    float u = vP.x/.13; float id = floor(u); float fu = fract(u); float v = vP.z/1.15 + h21(vec2(id, 3.))*5.; float fv = fract(v);',
    '    float seam = smoothstep(0., .035, fu)*smoothstep(1., .965, fu)*smoothstep(0., .006, fv)*smoothstep(1., .994, fv);',
    '    float tone = .74 + .4*h21(vec2(id, floor(v))); float gr = vn(vec2(vP.x*60., vP.z*2.6 + id*7.));',
    '    alb *= tone*(.86 + .2*gr)*mix(.5, 1., seam); rough = .3 + .15*gr; specK = .5*seam;',
    '  } else if (vM < 4.5 && vM > 3.5) {',                                                        // painted wall: faint roller texture
    '    vec2 q = abs(N.x) > .5 ? vP.zy : abs(N.y) > .5 ? vP.xz : vP.xy; alb *= .95 + .07*vn(q*26.) + .03*vn(q*3.); rough = .95; specK = .05;',
    '  } else if (vM < 5.5 && vM > 4.5) {',                                                        // fabric: a tight weave
    '    vec2 q = abs(N.y) > .6 ? vP.xz : vP.xy + vP.zy; alb *= .86 + .12*vn(q*170.) + .1*vn(q*9.); rough = 1.; specK = .03;',
    '  } else if (vM < 6.5 && vM > 5.5) { rough = .22; specK = .55; }',                            // glossy plastic, metal, glass
    '  if (vUV.x > 1.5) alb *= texture2D(uAtlas2, vec2(vUV.x - 2., vUV.y)).rgb; else if (vUV.x >= 0.) alb *= texture2D(uAtlas, vUV).rgb;',
    '  float ao = vB.x; float aod = mix(.55, 1., ao);',
    '  vec3 L = vec3(.056, .060, .092)*(.6 + .4*N.y)*ao*ao + vec3(.03, .026, .036)*ao + vec3(.07, .052, .034)*ao*uFl + vec3(.03, .022, .014)*ao*uOn.z;',          // night ambient
    // moonlight: only where a ray towards the moon passes through the window
    '  vec3 md = normalize(vec3(.34, .62, -.71)); float tt = vP.z/-md.z; vec3 hp = vP + md*tt;',
    '  float win = smoothstep(3.74, 3.86, hp.x)*smoothstep(5.36, 5.24, hp.x)*smoothstep(1.24, 1.36, hp.y)*smoothstep(2.61, 2.49, hp.y);',
    '  win *= 1. - .85*(1. - smoothstep(.02, .07, abs(hp.x - 4.55)))*1. ; win *= 1. - .85*(1. - smoothstep(.02, .07, abs(hp.y - 1.925)));',
    '  L += vec3(.36, .46, .85)*max(dot(N, md), 0.)*win*uOn.x*aod*1.15;',
    '  vec3 C = alb*L;',
    // desk lamp: a warm cone pointing down out of the shade
    '  vec3 dl = normalize(vP - vec3(.92, 1.3, .3)); float cone = .1 + .9*smoothstep(-.15, .55, -dl.y);',
    '  C += point(vec3(.92, 1.27, .3), vec3(1., .66, .34)*3.2, 1.0, vB.y*cone*aod)*uOn.z;',
    // floor lamp: light out of the top and the bottom of the shade, a soft glow through its sides
    '  vec3 fl = normalize(vP - vec3(5.5, 1.56, 3.55)); float fc = .28 + .72*smoothstep(.1, .75, abs(fl.y));',
    '  C += point(vec3(5.5, 1.56, 3.55), vec3(1., .72, .44)*4.6, .42, vB.z*fc*aod)*uFl;',
    // the monitor is a soft blue panel facing into the room
    '  vec3 ml = vec3(1.5, 1.31, .5) - vP; float mface = clamp(-normalize(ml).z*1.6 + .15, 0., 1.);',
    '  C += point(vec3(1.5, 1.31, .62), vec3(.36, .46, 1.)*1.7, .8, vB.w*mface*aod)*uOn.y;',
    // LED strip behind the desk washes the wall purple
    '  vec3 lq = vec3(clamp(vP.x, .6, 2.8), .72, .11); C += point(lq, vec3(1., .78, .52)*.4, 7., ao)*uOn.w;',
    '  C += point(vec3(4.55, 1.9, .5), vec3(.3, .38, .8)*.45, 1., aod)*uOn.x;',
    '  C += point(vec3(.3, 2.1, 3.08), vec3(1., .3, .5)*.5, 5., aod)*uOn.w;',                         // lava lamp                    // sky glow spilling in at the window
    '  C += alb*vE.x*lit(vE.y);',                                                                  // screens, shades, the LED itself
    '  if (abs(vId - uHi) < .5) C += vec3(.2, .17, .42)*(.6 + .4*sin(uTime*5.));',                // the object you are pointing at
    '  C = (C*(2.51*C + .03))/(C*(2.43*C + .59) + .14);',                                           // filmic tone curve
    '  C = pow(C, vec3(.82)) + (h21(gl_FragCoord.xy + fract(uTime)) - .5)/160.;',                   // a little grain hides banding in the dark
    '  gl_FragColor = vec4(C, 1.);',
    '}'
  ].join('\n');
  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  var prog = gl.createProgram();
  try { gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog)); }
  catch (e) { root.classList.remove('has-webgl'); root.classList.add('no-webgl'); if (window.console) console.warn(e.message); document.dispatchEvent(new CustomEvent('room:settled')); return; }
  gl.useProgram(prog);
  var U = {}; ['uVP', 'uAtlas', 'uAtlas2', 'uOn', 'uFl', 'uEye', 'uHi', 'uTime', 'uRight', 'uUp'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
  [['aP', 3, 0], ['aN', 3, 3], ['aC', 3, 6], ['aE', 2, 9], ['aUV', 2, 11], ['aId', 1, 13], ['aM', 1, 14], ['aB', 4, 15]].forEach(function (a) {
    var l = gl.getAttribLocation(prog, a[0]); if (l < 0) return; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, a[1], gl.FLOAT, false, STR * 4, a[2] * 4);
  });
  gl.uniform1i(U.uAtlas, 0); gl.uniform1i(U.uAtlas2, 1);
  var tex2 = gl.createTexture();
  function upload2() {
    paintPosters(); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex2); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas2); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var af2 = gl.getExtension('EXT_texture_filter_anisotropic'); if (af2) gl.texParameterf(gl.TEXTURE_2D, af2.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(af2.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    gl.activeTexture(gl.TEXTURE0); dirty = true;
  }
  var tex = gl.createTexture(), dirty = true;
  function upload() {
    gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var af = gl.getExtension('EXT_texture_filter_anisotropic'); if (af) gl.texParameterf(gl.TEXTURE_2D, af.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(af.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    dirty = true;
  }
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.clearColor(.02, .02, .04, 1); gl.blendFunc(gl.ONE, gl.ONE);

  /* ------------------------------------------------------------ camera: first person. ONE TIMELINE (p is scroll progress through #film).
     Each row is [p, where you stand, what you look at]. Eye height is about 1.6 m and every position is inside the room. */
  var CAM = [
    [0.00, [5.05, 1.62, 4.5], [1.9, 1.05, .9]],      // the doorway
    [0.06, [4.95, 1.62, 4.4], [1.9, 1.05, .9]],
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
  var VP = new Float32Array(16), eye = [0, 0, 0], RT = [1, 0, 0], UPV = [0, 1, 0];
  function viewProj(e, t, aspect, kx, ky) {
    var fov = (aspect < .9 ? 74 : aspect < 1.3 ? 62 : 52) * Math.PI / 180, f = 1 / Math.tan(fov / 2), n = .06, fr = 30;
    var zx = e[0] - t[0], zy = e[1] - t[1], zz = e[2] - t[2], zl = Math.hypot(zx, zy, zz); zx /= zl; zy /= zl; zz /= zl;
    var xx = zz, xy = 0, xz = -zx, xl = Math.hypot(xx, xz) || 1; xx /= xl; xz /= xl;
    var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    var tx = -(xx * e[0] + xy * e[1] + xz * e[2]), ty = -(yx * e[0] + yy * e[1] + yz * e[2]), tz = -(zx * e[0] + zy * e[1] + zz * e[2]);
    var a = f / aspect, c = (fr + n) / (n - fr), d = 2 * fr * n / (n - fr);
    VP[0] = a * xx; VP[1] = f * yx; VP[2] = c * zx; VP[3] = -zx;
    VP[4] = a * xy; VP[5] = f * yy; VP[6] = c * zy; VP[7] = -zy;
    VP[8] = a * xz; VP[9] = f * yz; VP[10] = c * zz; VP[11] = -zz;
    VP[12] = a * tx; VP[13] = f * ty; VP[14] = c * tz + d; VP[15] = -tz;
    for (var i = 0; i < 4; i++) { VP[i * 4] += kx * VP[i * 4 + 3]; VP[i * 4 + 1] += ky * VP[i * 4 + 3]; }   // slide the picture on screen to leave room for the copy
    RT[0] = xx; RT[1] = xy; RT[2] = xz; UPV[0] = yx; UPV[1] = yy; UPV[2] = yz;
  }
  function project(p) {
    var x = VP[0] * p[0] + VP[4] * p[1] + VP[8] * p[2] + VP[12], y = VP[1] * p[0] + VP[5] * p[1] + VP[9] * p[2] + VP[13], w = VP[3] * p[0] + VP[7] * p[1] + VP[11] * p[2] + VP[15];
    return w <= .05 ? null : [(x / w * .5 + .5) * window.innerWidth, (1 - (y / w * .5 + .5)) * window.innerHeight];
  }

  /* ------------------------------------------------------------ hotspots: where each object is, where it is offered from, and how close you walk up to it */
  var SPOT = { // name: [x, y, z, object to highlight, stops where it is offered (the last one is its home), viewing distance]
    monitor: [1.5, 1.31, .45, 'monitor', [0, 1], 1.25], laptop: [2.45, 1.02, .56, 'laptop', [1], 1.05], paper: [.73, .82, .83, 'paper', [1], .95], lamp: [.92, 1.3, .32, 'lamp', [1], 1.15],
    calendar: [.71, 1.8, .02, 'calendar', [1], 1.35], qr: [2.58, 1.83, .02, 'qr', [1], 1.35], books: [.3, .72, 2.62, 'books', [0, 2], 1.35], diploma: [.05, 1.61, 3.06, 'diploma', [2], 1.1], cap: [.17, 2.0, 2.41, 'cap', [2], 1.15],
    frames: [.04, 2.05, 4.2, 'frames', [0], 1.6], f0: [.04, 1.6, 3.72, 'frames', [3], 1.15], f1: [.04, 1.6, 4.22, 'frames', [3], 1.15], f2: [.04, 1.6, 4.72, 'frames', [3], 1.15], f3: [.04, 2.28, 3.97, 'frames', [3], 1.15], f4: [.04, 2.28, 4.47, 'frames', [3], 1.15],
    portrait: [3.21, .69, .24, 'portrait', [4], 1.0], phone: [3.2, .52, .49, 'phone', [4], .95], window: [4.55, 1.9, .04, 'window', [0, 4], 2.3], bag: [3.95, .82, 2.22, 'bag', [4], 1.2]
  };
  function stationEye(stop) { return camAt(Math.min(1, STOPS[stop] + .03))[0]; }
  function inRoom(e) { e[0] = clamp(e[0], .45, W - .45); e[2] = clamp(e[2], .45, D - .4); return e; }
  function focusPose(key) { // stand a comfortable distance from the object, on the line back to where you were standing
    var s = SPOT[key], se = stationEye(s[4][s[4].length - 1]), dx = se[0] - s[0], dz = se[2] - s[2], l = Math.hypot(dx, dz) || 1, d = s[5];
    return [inRoom([s[0] + dx / l * d, clamp(s[1] + .42, 1.18, 1.66), s[2] + dz / l * d]), [s[0], s[1], s[2]]];
  }
  var spots = $$('[data-spot]').map(function (el) { var k = el.getAttribute('data-spot'), s = SPOT[k]; return s ? { el: el, key: k, p: s, id: IDS[s[3]], stops: s[4] } : null; }).filter(Boolean);
  var hi = 0;
  spots.forEach(function (s) {
    s.el.addEventListener('pointerenter', function () { hi = s.id; kick(); }); s.el.addEventListener('pointerleave', function () { hi = 0; kick(); });
    s.el.addEventListener('focus', function () { hi = s.id; kick(); }); s.el.addEventListener('blur', function () { hi = 0; kick(); });
  });

  /* ------------------------------------------------------------ state + frame */
  var film = $('#film'), p = 0, pShown = 0, time = 0, last = 0, raf = null, visible = true, dpr = 1, tier = 0, slow = 0;
  var intro = calm ? 1 : 0, introT = 0, settled = false, lampOn = true, on = [0, 0, 0, 0, 0], px = 0, py = 0, sx = 0, sy = 0;
  var cur = null, tgt = null, focus = null, fAmt = 0, walk = 0, FOLLOW = 3.4;   // FOLLOW: how quickly the camera catches up (higher = snappier)
  // free walking: WALK_SPEED in metres a second, TURN_SPEED in radians a second (keys), BODY is how close you can get to furniture
  var free = false, fpos = [0, 0, 0], yaw = 0, pitch = 0, keys = {}, joy = [0, 0], vel = [0, 0], par = 1, WALK_SPEED = 1.9, TURN_SPEED = 1.9, BODY = .28, EYE = 1.6;
  var SOLID = [[.45, .12, 2.95, 1.06], [3.5, .06, 5.85, 2.5], [0, 2.0, .34, 3.3], [5.4, 3.75, 6, 4.95], [2.99, .12, 3.43, .6], [1.24, 1.42, 1.86, 2.04], [.11, 3.61, .45, 3.95], [5.35, 3.4, 5.65, 3.7], [0, 4.04, .3, 4.9], [4.98, 3.33, 5.22, 3.57]];   // furniture footprints [x0, z0, x1, z1]
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
  function aimFromCamera() { var dx = tgt[0] - cur[0], dy = tgt[1] - cur[1], dz = tgt[2] - cur[2]; yaw = Math.atan2(dx, -dz); pitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -.9, .9); fpos[0] = cur[0]; fpos[1] = cur[1]; fpos[2] = cur[2]; }
  function setFree(on, quiet) {
    if (on === free || !cur) return; free = on; vel[0] = vel[1] = 0;
    if (on) { focus = null; aimFromCamera(); }
    if (!quiet) document.dispatchEvent(new CustomEvent('room:explore', { detail: { on: on } })); kick();
  }
  function resize() {
    dpr = Math.max(.75, Math.min(2, window.devicePixelRatio || 1) * [1, .85, .72][tier]);
    var w = Math.round(window.innerWidth * dpr), h = Math.round(window.innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } gl.viewport(0, 0, w, h); dirty = true;
  }
  function progress() { var max = film ? film.offsetHeight - window.innerHeight : 1; return clamp(window.pageYOffset / Math.max(1, max), 0, 1); }
  function settle() { if (settled) return; settled = true; document.dispatchEvent(new CustomEvent('room:settled')); }
  function frame(now) {
    raf = null; var dt = Math.min(.05, (now - last) / 1000 || .016), i; last = now; if (!calm) time += dt;
    p = progress(); pShown += (p - pShown) * (calm ? 1 : 1 - Math.pow(.0008, dt));
    if (intro < 1) { introT += dt; intro = Math.min(1, introT / 2.6); if (intro > .8) settle(); } else settle();
    // the lights come on one after another: moon, monitor, desk lamp, floor lamp, LED strip
    var want = [intro > .02 ? 1 : 0, intro > .3 ? 1 : 0, (intro > .5 && lampOn) ? 1 : 0, intro > .82 ? 1 : 0, intro > .66 ? 1 : 0], k = 1 - Math.pow(.004, dt);
    for (i = 0; i < 5; i++) on[i] += (want[i] - on[i]) * (calm ? 1 : k);
    var flick = (intro > .3 && intro < .42) ? (Math.sin(time * 70) > 0 ? 1 : .25) : 1;
    sx += (px - sx) * .07; sy += (py - sy) * .07;

    // where the camera wants to be: the scroll position, or right in front of the thing you clicked
    var aspect = canvas.width / canvas.height, c = camAt(pShown), want2 = focus ? focusPose(focus) : c, e = want2[0], t = want2[1], walking = free && !focus && cur;
    if (walking) { // you are steering: keys, the on-screen stick, and drag to look
      var mx = (keys.d ? 1 : 0) - (keys.a ? 1 : 0) + joy[0], mz = (keys.w ? 1 : 0) - (keys.s ? 1 : 0) + joy[1], ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
      yaw += ((keys.e ? 1 : 0) - (keys.q ? 1 : 0)) * TURN_SPEED * dt;
      var ease = 1 - Math.exp(-dt * 9); vel[0] += (mx * WALK_SPEED - vel[0]) * ease; vel[1] += (mz * WALK_SPEED - vel[1]) * ease;
      var sy2 = Math.sin(yaw), cy2 = Math.cos(yaw), cp = Math.cos(pitch);
      fpos[0] += (cy2 * vel[0] + sy2 * vel[1]) * dt; fpos[2] += (sy2 * vel[0] - cy2 * vel[1]) * dt; fpos[1] += (EYE - fpos[1]) * ease * .5; collide(fpos);
      e = fpos; t = [fpos[0] + sy2 * cp * 2, fpos[1] + Math.sin(pitch) * 2, fpos[2] - cy2 * cp * 2];
    }
    if (aspect < .9 && !focus && !free) { var back = 1 + (1 - aspect) * .55 * (pShown > .12 ? 1 : .2); e = inRoom([t[0] + (e[0] - t[0]) * back, e[1], t[2] + (e[2] - t[2]) * back]); }   // phones step back, but never through a wall
    if (!cur) { cur = [e[0], e[1], e[2]]; tgt = [t[0], t[1], t[2]]; if (!calm && intro < 1) { cur[0] += .35; cur[2] += .3; } }
    var f = calm ? 1 : 1 - Math.exp(-dt * (walking ? 16 : FOLLOW)), moved = 0, d;
    par += ((free ? 0 : 1) - par) * (calm ? 1 : 1 - Math.exp(-dt * 5));
    for (i = 0; i < 3; i++) { d = (e[i] - cur[i]) * f; cur[i] += d; moved += Math.abs(d); tgt[i] += (t[i] - tgt[i]) * f; }
    fAmt += ((focus ? 1 : 0) - fAmt) * f; walk += moved;
    var bob = calm ? 0 : Math.sin(walk * 9) * Math.min(.012, moved * .6);                             // a hint of footsteps while you move
    eye[0] = cur[0]; eye[1] = cur[1] + bob; eye[2] = cur[2];
    // looking around: the view turns a little towards the pointer
    var lx = tgt[0] - eye[0], ly = tgt[1] - eye[1], lz = tgt[2] - eye[2], ll = Math.hypot(lx, ly, lz), rx = -lz, rz = lx, rl = Math.hypot(rx, rz) || 1, look = (1 - fAmt * .6) * par;
    var T = [tgt[0] + rx / rl * sx * ll * .62 * look, tgt[1] - sy * ll * .34 * look, tgt[2] + rz / rl * sx * ll * .62 * look];
    viewProj(eye, T, aspect, aspect > 1.15 ? -.24 * fAmt : 0, aspect < .9 ? .3 * (pShown > .12 || focus ? 1 : .5) * Math.max(par, fAmt) : 0);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(U.uVP, false, VP); gl.uniform3fv(U.uEye, eye); gl.uniform1f(U.uTime, time); gl.uniform1f(U.uHi, hi); gl.uniform3fv(U.uRight, RT); gl.uniform3fv(U.uUp, UPV);
    gl.uniform4f(U.uOn, on[0], on[1] * flick, on[2], on[3]); gl.uniform1f(U.uFl, on[4]);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex2); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.drawArrays(gl.TRIANGLES, 0, NSOLID);
    gl.enable(gl.BLEND); gl.depthMask(false); gl.drawArrays(gl.TRIANGLES, NSOLID, VCOUNT - NSOLID); gl.depthMask(true); gl.disable(gl.BLEND);

    // hotspots follow their objects
    var stop = 0, best = 9; STOPS.forEach(function (s, n) { var dd = Math.abs(pShown - s); if (dd < best) { best = dd; stop = n; } });
    var moving = !free && (best > .07 || moved > .004), dim = document.body.classList.contains('dim');
    for (i = 0; i < spots.length; i++) {
      var s = spots[i], q = project(s.p), near = false;
      if (free && q && s.key !== 'frames') { var ox = s.p[0] - eye[0], oy = s.p[1] - eye[1], oz = s.p[2] - eye[2], od = Math.hypot(ox, oy, oz); near = od < 3.6 && (od < .5 || hit(eye[0], eye[1], eye[2], ox / od, oy / od, oz / od, od - .4, -1) < 0); }   // walking: offer what you can actually see nearby
      var show = settled && !dim && !moving && q && (free ? near : s.stops.indexOf(stop) >= 0) && q[0] > 24 && q[0] < window.innerWidth - 24 && q[1] > 76 && q[1] < window.innerHeight * (aspect < .9 && stop > 0 && !focus && !free ? .6 : 1) - 44;
      if (q) s.el.style.transform = 'translate3d(' + q[0].toFixed(1) + 'px,' + q[1].toFixed(1) + 'px,0)';
      if (s.shown !== show) { s.shown = show; s.el.classList.toggle('is-on', !!show); s.el.tabIndex = show ? 0 : -1; }
    }
    if (!calm && intro >= 1) { slow = dt > .028 ? slow + 1 : Math.max(0, slow - 1); if (slow > 45 && tier < 2) { tier++; slow = 0; resize(); } }   // struggling? draw fewer pixels
    var busy = (walking && (Math.abs(vel[0]) + Math.abs(vel[1]) > .002 || mx || mz || keys.q || keys.e)) || Math.abs(par - (free ? 0 : 1)) > .003 || intro < 1 || Math.abs(p - pShown) > .0004 || moved > .0006 || Math.abs(fAmt - (focus ? 1 : 0)) > .002 || Math.abs(px - sx) + Math.abs(py - sy) > .002 || hi || on.some(function (v, n) { return Math.abs(v - want[n]) > .004; });
    if (busy || dirty) { dirty = false; kick(); }
  }
  function kick() { if (!raf && visible) raf = requestAnimationFrame(frame); }
  window.addEventListener('scroll', function () { dirty = true; kick(); }, { passive: true });
  window.addEventListener('resize', function () { resize(); kick(); });
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
  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); root.classList.remove('has-webgl'); root.classList.add('no-webgl'); settle(); });

  /* ------------------------------------------------------------ boot: paint the pictures, then switch on the lights */
  resize(); paintAtlas(null); upload(); upload2();
  ['window', 'rug'].forEach(function (k) { var src = canvas.getAttribute('data-' + k); if (!src) return; var im = new Image(); im.onload = function () { EXT[k] = im; paintAtlas(img.complete && img.naturalWidth ? img : null); upload(); kick(); }; im.src = src; });
  var img = new Image(); img.onload = function () { paintAtlas(img); upload(); kick(); }; img.src = canvas.getAttribute('data-portrait') || '';
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { paintAtlas(img.complete && img.naturalWidth ? img : null); upload(); upload2(); kick(); });
  if (window.pageYOffset > 4) { intro = 1; }          // arriving mid-page: skip the intro
  last = performance.now(); kick();

  window.Room = {
    replay: function () { if (calm) return; setFree(false); settled = false; intro = 0; introT = 0; on = [0, 0, 0, 0, 0]; focus = null; kick(); },
    lamp: function () { lampOn = !lampOn; kick(); return lampOn; },
    goTo: function (stop) { var max = film.offsetHeight - window.innerHeight; window.scrollTo({ top: STOPS[stop] * max, behavior: calm ? 'auto' : 'smooth' }); },
    focus: function (key) { if (SPOT[key]) { focus = key; kick(); } },
    blur: function () { if (focus && free && cur) { aimFromCamera(); collide(fpos); } focus = null; kick(); },   // when walking, you stay where you were standing
    explore: function (on) { setFree(!!on); }, exploring: function () { return free; },
    move: function (x, y) { joy[0] = clamp(x, -1, 1); joy[1] = clamp(y, -1, 1); kick(); },                         // on-screen stick: x strafes, y walks
    look: function (dx, dy) { if (!free || focus) return; yaw += dx; pitch = clamp(pitch - dy, -.9, .9); kick(); },
    home: function (key) { var s = SPOT[key]; return s ? s[4][s[4].length - 1] : 0; },
    stops: STOPS, progress: function () { return p; }
  };
})();

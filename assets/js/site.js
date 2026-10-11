/* Mayne Murray — Grand Line voyage. Vanilla JS, no dependencies. */
(function () {
  'use strict';

  var doc = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var SVGNS = 'http://www.w3.org/2000/svg';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function store(key, val) { try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); } catch (e) { return null; } }

  // Seeded random so every island and fruit keeps the same shape between visits
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  /* ------------------------------------------------------------ theme */
  var themeBtn = $('#theme');
  function effectiveTheme() {
    var set = doc.getAttribute('data-theme');
    if (set === 'light' || set === 'dark') return set;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/></svg>';
  function paintThemeBtn() {
    var dark = effectiveTheme() === 'dark';
    themeBtn.innerHTML = dark ? SUN : MOON;
    themeBtn.setAttribute('aria-label', dark ? 'Switch to day sailing' : 'Switch to night sailing');
  }
  if (themeBtn) {
    paintThemeBtn();
    themeBtn.addEventListener('click', function () {
      var next = effectiveTheme() === 'dark' ? 'light' : 'dark';
      doc.setAttribute('data-theme', next);
      store('mm-theme', next);
      paintThemeBtn();
    });
  }

  /* ------------------------------------------------------------ nav: burger, scrollspy, progress */
  var nav = $('#nav'), burger = $('#burger');
  if (burger) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Close the section menu' : 'Open the section menu');
    });
    $$('a', nav).forEach(function (a) { a.addEventListener('click', function () { nav.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); }); });
  }

  var navLinks = $$('.nav a');
  if ('IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        navLinks.forEach(function (a) { a.setAttribute('aria-current', a.getAttribute('href') === '#' + e.target.id ? 'true' : 'false'); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('main section[id]').forEach(function (s) { spy.observe(s); });
  }

  /* ------------------------------------------------------------ eased anchor sailing */
  var sailing = null;
  function easeInOutCubic(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function sailTo(target) {
    var top = target.getBoundingClientRect().top + window.pageYOffset - (parseFloat(getComputedStyle(doc).scrollPaddingTop) || 0);
    if (reduceMotion.matches) { window.scrollTo(0, top); return; }
    var start = window.pageYOffset, dist = top - start, dur = Math.min(1100, Math.max(450, Math.abs(dist) * .22)), t0 = null;
    cancelSail();
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      window.scrollTo(0, start + dist * easeInOutCubic(p));
      if (p < 1) sailing = requestAnimationFrame(step); else sailing = null;
    }
    sailing = requestAnimationFrame(step);
  }
  function cancelSail() { if (sailing) { cancelAnimationFrame(sailing); sailing = null; } }
  ['wheel', 'touchstart', 'keydown'].forEach(function (ev) { window.addEventListener(ev, cancelSail, { passive: true }); });
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href');
    if (id.length < 2) return;
    var target = document.getElementById(id.slice(1));
    if (!target) return;
    e.preventDefault();
    if (a.hasAttribute('data-close')) closeConqueror();
    sailTo(target);
    if (history.replaceState) history.replaceState(null, '', id);
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });

  /* ------------------------------------------------------------ islands */
  function smoothClosed(pts) {
    // Catmull-Rom through points, as cubic Béziers
    var n = pts.length, d = 'M' + pts[0][0].toFixed(3) + ' ' + pts[0][1].toFixed(3);
    for (var i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += 'C' + c1x.toFixed(3) + ' ' + c1y.toFixed(3) + ' ' + c2x.toFixed(3) + ' ' + c2y.toFixed(3) + ' ' + p2[0].toFixed(3) + ' ' + p2[1].toFixed(3);
    }
    return d + 'Z';
  }
  function blob(rand, n, base, wobble, sx, sy, cx, cy) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2, r = base * (1 + (rand() - .5) * wobble);
      pts.push([cx + Math.cos(a) * r * sx, cy + Math.sin(a) * r * sy]);
    }
    return pts;
  }
  // Landmarks: one per island, drawn in island units (the island is about 2.2 wide)
  var LANDMARK = {
    // Fidelity: a lighthouse, because observability is about seeing what is coming
    lighthouse: function (x, y) {
      return '<g transform="translate(' + x + ' ' + y + ')">' +
        '<path class="isle__beam" d="M0 -.62L1.1 -.86L1.1 -.4Z" fill="rgba(255,236,160,.28)"/>' +
        '<ellipse cx="0" cy=".04" rx=".22" ry=".07" fill="#6a737c"/>' +
        '<path d="M-.13 0L-.08 -.5H.08L.13 0Z" fill="#f4efe6" stroke="#5a3415" stroke-width=".015"/>' +
        '<path d="M-.118 -.06L-.108 -.14H.108L.118 -.06ZM-.098 -.24L-.092 -.32H.092L.098 -.24ZM-.085 -.41L-.082 -.47H.082L.085 -.41Z" fill="#c8323a"/>' +
        '<rect x="-.03" y="-.12" width=".06" height=".1" fill="#3a2412"/>' +
        '<rect x="-.1" y="-.53" width=".2" height=".035" fill="#2b2b2b"/>' +
        '<rect class="isle__lamp" x="-.065" y="-.63" width=".13" height=".1" fill="#ffe08a" stroke="#2b2b2b" stroke-width=".015"/>' +
        '<path d="M-.09 -.63L0 -.71L.09 -.63Z" fill="#c8323a"/></g>';
    },
    // RSM: a windmill workshop, for automation that keeps turning
    windmill: function (x, y) {
      var blades = '';
      for (var i = 0; i < 4; i++) blades += '<path d="M0 0L.05 -.04L.34 -.06L.34 .02L.05 .03Z" fill="#efe6d2" stroke="#6b4320" stroke-width=".012" transform="rotate(' + (i * 90) + ')"/>';
      return '<g transform="translate(' + x + ' ' + y + ')">' +
        '<path d="M-.16 0L-.1 -.42H.1L.16 0Z" fill="#b5835a" stroke="#5a3415" stroke-width=".015"/>' +
        '<path d="M-.13 -.42L0 -.54L.13 -.42Z" fill="#7a4b22"/>' +
        '<rect x="-.035" y="-.13" width=".07" height=".13" fill="#3a2412"/><rect x="-.04" y="-.32" width=".05" height=".05" fill="#ffe08a"/>' +
        '<g class="isle__blades" transform="translate(0 -.43)">' + blades + '<circle r=".035" fill="#5a3415"/></g>' +
        '<g transform="translate(.26 -.04)"><circle r=".07" fill="none" stroke="#8a8f96" stroke-width=".03" stroke-dasharray=".03 .025"/><circle r=".025" fill="#8a8f96"/></g></g>';
    },
    // UMass Lowell: a brick mill and canal, because Lowell is the Mill City
    mill: function (x, y) {
      var win = '';
      for (var r = 0; r < 2; r++) for (var c = 0; c < 5; c++) win += '<rect x="' + (-.25 + c * .1).toFixed(2) + '" y="' + (-.27 + r * .12).toFixed(2) + '" width=".05" height=".07" fill="#ffe08a" opacity=".85"/>';
      return '<g transform="translate(' + x + ' ' + y + ')">' +
        '<path d="M-.7 .16Q0 .02 .7 .2" stroke="#4f9fc4" stroke-width=".06" fill="none"/>' +
        '<rect x="-.3" y="-.34" width=".6" height=".34" fill="#9a4a32" stroke="#5a2414" stroke-width=".015"/>' +
        '<path d="M-.3 -.34L-.15 -.44L0 -.34L.15 -.44L.3 -.34Z" fill="#6e3424"/>' + win +
        '<rect x=".2" y="-.68" width=".07" height=".34" fill="#7a3a26"/>' +
        '<g class="isle__smoke" fill="rgba(220,226,232,.75)"><circle cx=".24" cy="-.76" r=".05"/><circle cx=".3" cy="-.85" r=".065"/><circle cx=".38" cy="-.95" r=".08"/></g></g>';
    },
    // Homework Tracker: a clock tower stuck at five to midnight
    clocktower: function (x, y) {
      return '<g transform="translate(' + x + ' ' + y + ')">' +
        '<rect x="-.12" y="-.5" width=".24" height=".5" fill="#d9c7a0" stroke="#5a3415" stroke-width=".015"/>' +
        '<path d="M-.15 -.5L0 -.72L.15 -.5Z" fill="#4a6b8a"/>' +
        '<circle cx="0" cy="-.36" r=".085" fill="#fff8e6" stroke="#2b2b2b" stroke-width=".015"/>' +
        '<path d="M0 -.36V-.43M0 -.36L-.012 -.425" stroke="#2b2b2b" stroke-width=".014" stroke-linecap="round"/>' +
        '<rect x="-.035" y="-.13" width=".07" height=".13" fill="#3a2412"/>' +
        '<g transform="translate(.24 -.02)"><rect x="-.1" y="-.12" width=".2" height=".16" rx=".015" fill="#fff8e6" stroke="#5a3415" stroke-width=".012"/>' +
        '<rect x="-.1" y="-.12" width=".2" height=".04" fill="#c8323a"/><circle cx="-.04" cy="-.03" r=".012" fill="#c8323a"/><circle cx=".01" cy="-.03" r=".012" fill="#e8a93e"/><circle cx=".06" cy="-.03" r=".012" fill="#3f8f5a"/></g></g>';
    },
    // Crypto app: a dug-up treasure chest spilling coins
    treasure: function (x, y) {
      var coins = '';
      for (var i = 0; i < 9; i++) coins += '<ellipse cx="' + (-.2 + (i % 5) * .1 + (i > 4 ? .05 : 0)).toFixed(2) + '" cy="' + (.06 + (i > 4 ? .05 : 0)) + '" rx=".045" ry=".02" fill="#f2c14e" stroke="#9a6a10" stroke-width=".01"/>';
      return '<g transform="translate(' + x + ' ' + y + ')">' +
        '<ellipse cx="0" cy=".04" rx=".34" ry=".1" fill="#b8955c"/>' +
        '<path d="M-.18 -.2H.18V.02H-.18Z" fill="#8a5a2b" stroke="#4a2a12" stroke-width=".015"/>' +
        '<path d="M-.18 -.2L-.15 -.38H.21L.18 -.2Z" fill="#a8723f" stroke="#4a2a12" stroke-width=".015"/>' +
        '<path d="M-.18 -.12H.18M0 -.2V.02" stroke="#e8a93e" stroke-width=".025"/>' +
        '<ellipse class="isle__glint" cx="0" cy="-.2" rx=".14" ry=".04" fill="#ffe08a"/>' + coins +
        '<path d="M.3 -.3L.45 .05" stroke="#7a4b22" stroke-width=".03"/><path d="M.42 0L.5 .06L.44 .1L.38 .04Z" fill="#8a8f96"/>' +
        '<path d="M-.42 -.12L-.3 0M-.3 -.12L-.42 0" stroke="#b3122e" stroke-width=".035" stroke-linecap="round"/></g>';
    },
    // This site: a shipyard with a hull on the slipway
    shipyard: function (x, y) {
      var ribs = '';
      for (var i = 0; i < 6; i++) ribs += '<path d="M' + (-.24 + i * .09).toFixed(2) + ' -.02Q' + (-.24 + i * .09).toFixed(2) + ' -.2 ' + (-.2 + i * .09).toFixed(2) + ' -.26" stroke="#8a5a2b" stroke-width=".022" fill="none"/>';
      return '<g transform="translate(' + x + ' ' + y + ')">' +
        '<path d="M-.4 .04L.5 .2" stroke="#7a4b22" stroke-width=".05"/>' +
        '<path d="M-.3 -.02Q0 .06 .3 -.06" stroke="#6b4320" stroke-width=".04" fill="none"/>' + ribs +
        '<path d="M.36 .02V-.6M.36 -.58L.06 -.48" stroke="#4a2a12" stroke-width=".025" fill="none"/>' +
        '<path d="M.12 -.5V-.34" stroke="#2b2b2b" stroke-width=".01"/><rect x=".09" y="-.34" width=".06" height=".05" fill="#c8a35a"/>' +
        '<rect x="-.48" y="-.14" width=".12" height=".12" fill="#a8723f" stroke="#4a2a12" stroke-width=".012"/><rect x="-.44" y="-.24" width=".1" height=".1" fill="#c99a52" stroke="#4a2a12" stroke-width=".012"/></g>';
    },
    // QR Code Generator: a standing stone carved with a QR-like pattern
    checker: function (x, y) {
      var cells = '', rr = rng(93);
      for (var i = 0; i < 7; i++) for (var j = 0; j < 7; j++) {
        var finder = (i < 3 && j < 3) || (i < 3 && j > 3) || (i > 3 && j < 3);
        if (!finder && rr() > .5) cells += '<rect x="' + (-.105 + j * .03).toFixed(3) + '" y="' + (-.46 + i * .03).toFixed(3) + '" width=".03" height=".03" fill="#2b2b2b"/>';
      }
      var fp = function (fx, fy) { return '<rect x="' + fx + '" y="' + fy + '" width=".09" height=".09" fill="none" stroke="#2b2b2b" stroke-width=".018"/><rect x="' + (fx + .03) + '" y="' + (fy + .03) + '" width=".03" height=".03" fill="#2b2b2b"/>'; };
      return '<g transform="translate(' + x + ' ' + y + ')">' +
        '<path d="M-.16 0L-.15 -.52Q0 -.58 .15 -.52L.16 0Z" fill="#9aa3ab" stroke="#4d555c" stroke-width=".015"/>' +
        '<rect x="-.12" y="-.475" width=".24" height=".24" fill="#e8ecef"/>' + cells +
        fp(-.105, -.46) + fp(.015, -.46) + fp(-.105, -.34) +
        '<ellipse cx="-.3" cy=".02" rx=".08" ry=".05" fill="#7d868e"/><ellipse cx=".28" cy=".04" rx=".06" ry=".04" fill="#7d868e"/></g>';
    }
  };
  function islandSVG(seed, flagVar, landmark) {
    var r = rng(seed);
    var outline = blob(r, 13, 1, .42, 1.12, .82, 0, .05);
    var scale = function (pts, k, dx, dy) { return pts.map(function (p) { return [p[0] * k + (dx || 0), p[1] * k + (dy || 0)]; }); };
    var green = blob(r, 11, .66, .5, 1.05, .78, (r() - .5) * .18, -.04);
    var hill = blob(r, 9, .3, .4, 1, .8, (r() - .5) * .3, -.14);
    var trees = '', k;
    for (k = 0; k < 6; k++) {
      var tx = (r() - .5) * 1.2, ty = (r() - .5) * .5 + .08, tr = .06 + r() * .04;
      if (Math.abs(tx) < .35 && ty < .15) continue; // keep the landmark's footprint clear
      trees += '<circle cx="' + tx.toFixed(2) + '" cy="' + ty.toFixed(2) + '" r="' + tr.toFixed(3) + '" fill="var(--grass-2)"/><circle cx="' + (tx - tr * .3).toFixed(2) + '" cy="' + (ty - tr * .3).toFixed(2) + '" r="' + (tr * .45).toFixed(3) + '" fill="rgba(255,255,255,.12)"/>';
    }
    var palms = '', rocks = '', sandDots = '';
    for (k = 0; k < 3; k++) {
      var side = k % 2 ? 1 : -1, px = side * (.55 + r() * .35), py = .1 + r() * .25, lean = side * (.1 + r() * .25), top = [px + lean * .5, py - .48];
      palms += '<path d="M' + px.toFixed(2) + ' ' + py.toFixed(2) + 'Q' + (px + lean).toFixed(2) + ' ' + (py - .25).toFixed(2) + ' ' + top[0].toFixed(2) + ' ' + top[1].toFixed(2) + '" stroke="#6b4320" stroke-width=".045" fill="none" stroke-linecap="round"/>';
      for (var f = 0; f < 6; f++) {
        var ang = -Math.PI / 2 + (f - 2.5) * .58, ex = top[0] + Math.cos(ang) * .27, ey = top[1] + Math.sin(ang) * .2 + .09;
        palms += '<path d="M' + top[0].toFixed(2) + ' ' + top[1].toFixed(2) + 'Q' + ((top[0] + ex) / 2).toFixed(2) + ' ' + (Math.min(top[1], ey) - .08).toFixed(2) + ' ' + ex.toFixed(2) + ' ' + ey.toFixed(2) + '" stroke="var(--grass-2)" stroke-width=".065" fill="none" stroke-linecap="round"/>';
      }
      palms += '<circle cx="' + top[0].toFixed(2) + '" cy="' + (top[1] + .03).toFixed(2) + '" r=".035" fill="#5a3a1a"/>';
    }
    for (k = 0; k < 6; k++) {
      var a = r() * Math.PI * 2, rx = Math.cos(a) * 1.3, ry = Math.sin(a) * 1.0;
      rocks += '<ellipse cx="' + rx.toFixed(2) + '" cy="' + ry.toFixed(2) + '" rx="' + (.04 + r() * .07).toFixed(3) + '" ry=".04" fill="#5c6670"/><path d="M' + (rx - .08).toFixed(2) + ' ' + (ry + .05).toFixed(2) + 'q.08 .04 .16 0" stroke="rgba(255,255,255,.5)" stroke-width=".018" fill="none"/>';
    }
    for (k = 0; k < 14; k++) {
      var sa = r() * Math.PI * 2, sr = .82 + r() * .12;
      sandDots += '<circle cx="' + (Math.cos(sa) * sr * 1.1).toFixed(2) + '" cy="' + (Math.sin(sa) * sr * .8 + .05).toFixed(2) + '" r=".012" fill="rgba(120,80,30,.35)"/>';
    }
    var shells = '<path d="M.7 .62q.05-.07 .1 0z" fill="#f2b8a0"/><circle cx="-.72" cy=".55" r=".025" fill="#f4e2c4"/><path d="M-.2 .78l.03-.05.03.05z" fill="#e88a6a"/>';
    var gulls = '<g class="isle__gull" fill="none" stroke="var(--text)" stroke-width=".025" stroke-linecap="round" opacity=".7"><path d="M-1.1 -1q.06-.06 .12 0q.06-.06 .12 0"/><path d="M-.8 -1.12q.05-.05 .1 0q.05-.05 .1 0"/><path d="M1 -1.05q.04-.04 .08 0q.04-.04 .08 0"/></g>';
    var fx = -.55 + (r() - .5) * .2, fy = -.1;
    var lm = LANDMARK[landmark] ? LANDMARK[landmark](0.05, 0.12) : '';
    var id = 'isl' + seed;
    // shaded like a real atoll from above: turquoise shallows, wet sand, sunlit dunes, darker canopy
    var defs = '<defs>' +
      '<radialGradient id="' + id + 'w" cx=".5" cy=".5" r=".5"><stop offset=".55" stop-color="#7fe3d6" stop-opacity=".75"/><stop offset=".8" stop-color="#2fb3c0" stop-opacity=".35"/><stop offset="1" stop-color="#1a7f9a" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="' + id + 's" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#f6e7bf"/><stop offset=".7" stop-color="#e2c78e"/><stop offset="1" stop-color="#b99a62"/></radialGradient>' +
      '<radialGradient id="' + id + 'g" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#5fae5f"/><stop offset=".6" stop-color="#3d8a4c"/><stop offset="1" stop-color="#26603a"/></radialGradient>' +
      '<radialGradient id="' + id + 'h" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#4f9a55"/><stop offset="1" stop-color="#1f4f30"/></radialGradient>' +
      '</defs>';
    return '<svg viewBox="-1.5 -1.3 3 2.6" aria-hidden="true">' + defs +
      '<path d="' + smoothClosed(scale(outline, 1.5)) + '" fill="url(#' + id + 'w)"/>' +
      '<path class="isle__surf" d="' + smoothClosed(scale(outline, 1.16)) + '" fill="none" stroke="rgba(255,255,255,.7)" stroke-width=".035" stroke-dasharray=".05 .04 .14 .05"/>' + rocks +
      '<path d="' + smoothClosed(scale(outline, 1.05)) + '" fill="#b89a66" opacity=".75"/>' +
      '<path d="' + smoothClosed(outline) + '" fill="url(#' + id + 's)"/>' + sandDots + shells +
      '<path d="' + smoothClosed(green) + '" fill="url(#' + id + 'g)"/>' +
      '<path d="' + smoothClosed(hill) + '" fill="url(#' + id + 'h)" opacity=".8"/>' + trees + palms + lm + gulls +
      '<path d="M' + fx.toFixed(2) + ' ' + fy + 'v-.62" stroke="#3a2412" stroke-width=".035" stroke-linecap="round"/>' +
      '<path class="isle__flag" d="M' + fx.toFixed(2) + ' ' + (fy - .62) + 'l.34 .09-.34 .1z" fill="var(' + flagVar + ')"/>' +
      '</svg>';
  }
  $$('.isle__art').forEach(function (el) {
    var seed = parseInt(el.getAttribute('data-seed'), 10) || 1;
    var flag = el.getAttribute('data-flag') === 'proj' ? '--flag-proj' : '--flag-exp';
    el.insertAdjacentHTML('afterbegin', islandSVG(seed, flag, el.getAttribute('data-landmark')));
  });

  // Final island: a small island with an X marking the spot
  var xm = $('.xmark');
  if (xm) {
    var r2 = rng(104), ol = blob(r2, 13, 1, .3, 1.1, .85, 0, 0);
    xm.insertAdjacentHTML('afterbegin',
      '<svg viewBox="-1.5 -1.3 3 2.6" aria-hidden="true">' +
      '<defs><radialGradient id="xw" cx=".5" cy=".5" r=".5"><stop offset=".55" stop-color="#7fe3d6" stop-opacity=".75"/><stop offset=".8" stop-color="#2fb3c0" stop-opacity=".35"/><stop offset="1" stop-color="#1a7f9a" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="xs" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#f6e7bf"/><stop offset=".7" stop-color="#e2c78e"/><stop offset="1" stop-color="#b99a62"/></radialGradient></defs>' +
      '<path d="' + smoothClosed(ol.map(function (p) { return [p[0] * 1.5, p[1] * 1.5]; })) + '" fill="url(#xw)"/>' +
      '<path d="' + smoothClosed(ol.map(function (p) { return [p[0] * 1.14, p[1] * 1.14]; })) + '" fill="none" stroke="rgba(255,255,255,.7)" stroke-width=".035" stroke-dasharray=".05 .04 .14 .05"/>' +
      '<path d="' + smoothClosed(ol.map(function (p) { return [p[0] * 1.05, p[1] * 1.05]; })) + '" fill="#b89a66" opacity=".75"/>' +
      '<path d="' + smoothClosed(ol) + '" fill="url(#xs)"/>' +
      '<path d="M-.22 -.22L.22 .22M.22 -.22L-.22 .22" stroke="#b3122e" stroke-width=".11" stroke-linecap="round"/>' +
      '</svg>');
  }

  /* ------------------------------------------------------------ devil fruits (original art, one shape per fruit) */
  var FRUIT = {
    paramecia: { name: 'Paramecia', blurb: 'A language I write in.' },
    zoan: { name: 'Zoan', blurb: 'A framework I shape things with.' },
    logia: { name: 'Logia', blurb: 'Infrastructure I run on.' }
  };
  function starPath(cx, cy, R, r, n) {
    var pts = [];
    for (var i = 0; i < n * 2; i++) {
      var a = -Math.PI / 2 + i * Math.PI / n, rad = i % 2 ? r : R;
      pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
    }
    var d = 'M' + ((pts[0][0] + pts[1][0]) / 2).toFixed(1) + ' ' + ((pts[0][1] + pts[1][1]) / 2).toFixed(1);
    for (i = 1; i <= pts.length; i++) {
      var p = pts[i % pts.length], q = pts[(i + 1) % pts.length];
      d += 'Q' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ' ' + ((p[0] + q[0]) / 2).toFixed(1) + ' ' + ((p[1] + q[1]) / 2).toFixed(1);
    }
    return d + 'Z';
  }
  // shape: body path (or circles), grooves, where the stem attaches, crown style
  var SHAPES = {
    lobed:   { d: 'M50 29C55 24 64 23 70 27C80 26 88 40 87 56C88 74 80 90 66 96C60 99 55 98 50 96C45 98 40 99 34 96C20 90 12 74 13 56C12 40 20 26 30 27C36 23 45 24 50 29Z', g: 'M50 29Q46 62 50 96M30 28Q20 62 34 96M70 28Q80 62 66 96', top: [50, 29] },
    flame:   { d: 'M52 20C47 26 50 32 56 36C70 44 84 58 82 77C80 94 66 102 50 102C34 102 18 94 18 77C18 59 30 47 40 39C46 34 43 27 52 20Z', g: 'M50 40Q40 70 50 101M66 48Q74 76 64 98', top: [52, 22], tip: true },
    melon:   { d: 'M50 24C72 24 85 42 85 63C85 85 70 101 50 101C30 101 15 85 15 63C15 42 28 24 50 24Z', g: '', top: [50, 25], stripes: true },
    heart:   { d: 'M50 100C30 86 12 70 14 50C15 36 26 28 37 30C44 31 48 36 50 40C52 36 56 31 63 30C74 28 85 36 86 50C88 70 70 86 50 100Z', g: 'M50 40Q48 70 50 100', top: [50, 40] },
    gourd:   { d: 'M50 20C61 20 64 31 62 39C60 45 56 48 61 52C77 58 85 68 85 80C85 94 69 103 50 103C31 103 15 94 15 80C15 68 23 58 39 52C44 48 40 45 38 39C36 31 39 20 50 20Z', g: 'M38 52Q50 58 62 52', top: [50, 21] },
    pumpkin: { d: 'M50 40C56 34 70 34 78 40C90 46 94 64 90 78C86 92 72 100 60 98C56 100 44 100 40 98C28 100 14 92 10 78C6 64 10 46 22 40C30 34 44 34 50 40Z', g: 'M50 40Q46 70 50 98M34 38Q24 68 38 98M66 38Q76 68 62 98M20 42Q8 70 24 94M80 42Q92 70 76 94', top: [50, 40] },
    pine:    { d: 'M50 30C66 32 79 46 80 64C82 84 68 101 50 101C32 101 18 84 20 64C21 46 34 32 50 30Z', g: 'M24 50L64 100M30 36L80 88M44 30L82 66M20 74L40 100M76 46L34 100M64 32L20 82M52 30L18 62M80 74L58 100', top: [50, 30], crown: 'spiky' },
    star:    { d: null, g: '', top: [50, 32] },
    pear:    { d: 'M50 22C60 22 63 32 65 42C67 52 85 60 85 77C85 93 69 101 50 101C31 101 15 93 15 77C15 60 33 52 35 42C37 32 40 22 50 22Z', g: 'M50 22Q45 62 50 101', top: [50, 23] },
    peach:   { d: 'M50 30C70 26 88 42 86 64C84 86 68 100 50 100C32 100 16 86 14 64C12 42 30 26 50 30Z', g: 'M50 30C40 50 42 80 50 100', top: [50, 30], patches: true },
    lemon:   { d: 'M8 64C14 60 18 46 34 40C44 36 56 36 66 40C82 46 86 60 92 64C86 68 82 82 66 88C56 92 44 92 34 88C18 82 14 68 8 64Z', g: '', top: [50, 38] },
    apple:   { d: 'M50 30C56 22 74 22 82 36C90 50 88 76 76 88C66 98 56 99 50 97C44 99 34 98 24 88C12 76 10 50 18 36C26 22 44 22 50 30Z', g: 'M50 30Q47 64 50 97', top: [50, 30] },
    cluster: { c: [[50, 34, 11], [38, 44, 11], [62, 44, 11], [28, 57, 11], [50, 55, 11.5], [72, 57, 11], [38, 69, 11], [62, 69, 11], [50, 82, 11], [42, 94, 9], [58, 93, 9]], g: '', top: [50, 24] },
    cone:    { d: 'M50 103C36 93 19 73 19 53C19 41 32 35 50 35C68 35 81 41 81 53C81 73 64 93 50 103Z', g: '', top: [50, 35], crown: 'cap' },
    bean:    { d: 'M30 34C44 26 62 32 64 46C66 56 76 58 82 66C90 80 80 102 58 102C38 102 16 92 15 70C14 54 18 42 30 34Z', g: 'M64 46Q46 60 56 100', top: [44, 31] }
  };
  SHAPES.star.d = starPath(50, 67, 37, 23, 5);
  // [shape, hue, saturation, fruit name, power, swirl radius]
  var SPEC = {
    'C':              ['lobed', 272, 46, 'Kiso Kiso no Mi', 'Grants command over memory itself, down to the last pointer.', 6.6],
    'C++':            ['flame', 18, 86, 'Zōka Zōka no Mi', 'Everything C can do, plus classes and templates.', 7.6],
    'Python':         ['melon', 205, 58, 'Nyoro Nyoro no Mi', 'Slithers through scripts and data in a few readable lines.', 6.2],
    'JavaScript':     ['heart', 48, 80, 'Ugoki Ugoki no Mi', 'Brings any page to life; it powers the ship on this site.', 6],
    'TypeScript':     ['gourd', 212, 60, 'Kata Kata no Mi', 'Hardens loose code into strict, predictable types.', 6.4],
    'SQL':            ['pumpkin', 26, 78, 'Kura Kura no Mi', 'Opens the storehouse and pulls out exactly the rows you ask for.', 6.2],
    'React':          ['pine', 190, 64, 'Hannō Hannō no Mi', 'Interfaces that re-render the instant their state changes.', 5.2],
    'Grafana Scenes': ['star', 32, 88, 'Mie Mie no Mi', 'Turns raw telemetry into dashboards anyone can read.', 6.6],
    'Flutter':        ['pear', 198, 74, 'Pata Pata no Mi', 'One codebase that takes flight on every phone.', 6.6],
    'Pandas':         ['peach', 220, 8, 'Panda Panda no Mi', 'Model: Panda. Wrangles tables into shape.', 6.8],
    'Matplotlib':     ['lemon', 210, 48, 'Zu Zu no Mi', 'Draws any dataset as a chart.', 5.6],
    'Kubernetes':     ['apple', 222, 72, 'Kaji Kaji no Mi', 'Takes the helm of entire fleets of containers.', 6.8],
    'Docker':         ['cluster', 202, 82, 'Hako Hako no Mi', 'Seals anything inside a box that runs the same everywhere.', 4.4],
    'AWS EKS':        ['cone', 34, 94, 'Kumo Kumo no Mi', 'Summons Kubernetes clusters out of the cloud.', 5.6],
    'OpenTelemetry':  ['bean', 262, 52, 'Kansoku Kansoku no Mi', 'Observation made solid: traces, metrics and logs from every service.', 6.8]
  };
  function hsl(h, s, l, a) { return 'hsl(' + h + ' ' + s + '% ' + l + '%' + (a !== undefined ? ' / ' + a : '') + ')'; }
  function spiral(cx, cy, rad, turns, dir, rot) {
    var d = '', steps = 24;
    for (var i = 0; i <= steps; i++) {
      var t = i / steps, a = rot + dir * t * turns * Math.PI * 2, rr = rad * (1 - t * .9);
      d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(2) + ' ' + (cy + Math.sin(a) * rr).toFixed(2);
    }
    return d;
  }
  function fruitSVG(name, type) {
    var sp = SPEC[name] || ['apple', 280, 50, '', '', 6], sh = SHAPES[sp[0]];
    var H = sp[1], S = sp[2], R = sp[5], r = rng(hash(name)), id = 'df' + hash(name + type), grey = S < 15;
    var groove = hsl(H, Math.min(92, S + 8), grey ? 16 : 22), hi = hsl(H, S, grey ? 95 : 86, .42);
    var bodyShapes = sh.c
      ? sh.c.map(function (c) { return '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="' + c[2] + '"/>'; }).join('')
      : '<path d="' + sh.d + '"/>';
    var fillShapes = sh.c
      ? sh.c.map(function (c) { return '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="' + c[2] + '" fill="url(#' + id + 'b)" stroke="' + hsl(H, S, 16) + '" stroke-width="1"/>'; }).join('')
      : '<path d="' + sh.d + '" fill="url(#' + id + 'b)"/>';
    // swirls on a jittered hex grid; every one embossed (shadow, groove, highlight)
    var sw = '', row = 0, step = R * 1.85;
    for (var y = 18; y <= 106; y += step * .9, row++) {
      for (var x = 6 + (row % 2) * step / 2; x <= 96; x += step) {
        var jx = x + (r() - .5) * 2.2, jy = y + (r() - .5) * 2.2, rad = R + r() * 1.3, dir = r() > .5 ? 1 : -1, rot = r() * 6.28;
        var p = spiral(jx, jy, rad, 2 + r() * .35, dir, rot);
        sw += '<path d="' + p + '" stroke="rgba(0,0,0,.2)" stroke-width="' + (R * .45).toFixed(1) + '" transform="translate(.8 .9)"/>' +
              '<path d="' + p + '" stroke="' + groove + '" stroke-width="' + (R * .32).toFixed(1) + '"/>' +
              '<path d="' + p + '" stroke="' + hi + '" stroke-width=".75" transform="translate(-.55 -.65)"/>';
      }
    }
    var extra = '';
    if (sh.stripes) for (var s2 = 0; s2 < 7; s2++) extra += '<path d="M' + (18 + s2 * 11) + ' 20Q' + (12 + s2 * 12.5) + ' 62 ' + (18 + s2 * 11) + ' 104" stroke="' + hsl(H, S, 30, .45) + '" stroke-width="4.5"/>';
    if (sh.patches) extra += '<ellipse cx="30" cy="56" rx="11" ry="14" fill="' + hsl(0, 0, 14, .7) + '" stroke="none"/><ellipse cx="72" cy="78" rx="13" ry="11" fill="' + hsl(0, 0, 14, .7) + '" stroke="none"/>';
    var crown = '';
    if (sh.crown === 'spiky') {
      for (var c = 0; c < 7; c++) { var ca = -Math.PI / 2 + (c - 3) * .32; crown += '<path d="M50 32Q' + (50 + Math.cos(ca) * 12).toFixed(1) + ' ' + (30 + Math.sin(ca) * 10).toFixed(1) + ' ' + (50 + Math.cos(ca) * 22).toFixed(1) + ' ' + (32 + Math.sin(ca) * 22).toFixed(1) + 'Q' + (50 + Math.cos(ca) * 8).toFixed(1) + ' ' + (32 + Math.sin(ca) * 6).toFixed(1) + ' 50 33Z" fill="url(#' + id + 'l)" stroke="#1f4a2c" stroke-width=".7"/>'; }
    } else if (sh.crown === 'cap') {
      for (var c2 = 0; c2 < 6; c2++) { var cb = (c2 / 6) * Math.PI * 2; crown += '<path d="M50 36L' + (50 + Math.cos(cb) * 18).toFixed(1) + ' ' + (38 + Math.sin(cb) * 6).toFixed(1) + 'L' + (50 + Math.cos(cb + .5) * 8).toFixed(1) + ' ' + (37 + Math.sin(cb + .5) * 3).toFixed(1) + 'Z" fill="url(#' + id + 'l)" stroke="#1f4a2c" stroke-width=".7"/>'; }
    } else if (type !== 'paramecia') {
      crown = '<path d="M' + sh.top[0] + ' ' + (sh.top[1] - 2) + 'C' + (sh.top[0] - 6) + ' ' + (sh.top[1] - 9) + ' ' + (sh.top[0] - 14) + ' ' + (sh.top[1] - 9) + ' ' + (sh.top[0] - 19) + ' ' + (sh.top[1] - 6) + ' ' + (sh.top[0] - 12) + ' ' + (sh.top[1] - 4) + ' ' + (sh.top[0] - 7) + ' ' + (sh.top[1] - 1) + ' ' + sh.top[0] + ' ' + sh.top[1] + 'Z" fill="url(#' + id + 'l)" stroke="#1f4a2c" stroke-width=".8"/>';
    }
    var tx = sh.top[0], ty = sh.top[1];
    var stem = '<path d="M' + tx + ' ' + ty + 'C' + (tx - 1) + ' ' + (ty - 8) + ' ' + (tx + 2) + ' ' + (ty - 15) + ' ' + (tx + 9) + ' ' + (ty - 18) + 'C' + (tx + 16) + ' ' + (ty - 21) + ' ' + (tx + 22) + ' ' + (ty - 17) + ' ' + (tx + 20) + ' ' + (ty - 12) + 'C' + (tx + 18) + ' ' + (ty - 8) + ' ' + (tx + 13) + ' ' + (ty - 10) + ' ' + (tx + 15) + ' ' + (ty - 13) + '" fill="none" stroke="#3f2410" stroke-width="3.4" stroke-linecap="round"/>' +
      '<path d="M' + (tx + 5) + ' ' + (ty - 14) + 'C' + (tx + 10) + ' ' + (ty - 24) + ' ' + (tx + 24) + ' ' + (ty - 28) + ' ' + (tx + 34) + ' ' + (ty - 24) + 'C' + (tx + 30) + ' ' + (ty - 14) + ' ' + (tx + 18) + ' ' + (ty - 8) + ' ' + (tx + 5) + ' ' + (ty - 14) + 'Z" fill="url(#' + id + 'l)" stroke="#1f4a2c" stroke-width="1"/>' +
      '<path d="M' + (tx + 6) + ' ' + (ty - 14.5) + 'C' + (tx + 14) + ' ' + (ty - 19) + ' ' + (tx + 24) + ' ' + (ty - 23) + ' ' + (tx + 33) + ' ' + (ty - 23.6) + '" fill="none" stroke="#1f4a2c" stroke-width=".7"/>';
    var tipCurl = sh.tip ? '<path d="M52 21C58 16 62 20 58 24C55 27 52 24 55 22" fill="none" stroke="' + hsl(H, S, 30) + '" stroke-width="2.4" stroke-linecap="round"/>' : '';
    var aura = type === 'logia' ? '<circle cx="50" cy="64" r="48" fill="url(#' + id + 'a)"/>' : '';
    return '<svg viewBox="0 0 100 110" aria-hidden="true"><defs>' +
      '<radialGradient id="' + id + 'b" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="' + hsl(H, S, grey ? 92 : 72) + '"/><stop offset=".45" stop-color="' + hsl(H, S, grey ? 80 : 54) + '"/><stop offset="1" stop-color="' + hsl(H, S, grey ? 46 : 30) + '"/></radialGradient>' +
      '<radialGradient id="' + id + 's" cx=".3" cy=".26" r=".9"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></radialGradient>' +
      '<radialGradient id="' + id + 'h" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="' + id + 'a" cx=".5" cy=".5" r=".5"><stop offset=".55" stop-color="' + hsl(H, S, 60, .35) + '"/><stop offset="1" stop-color="' + hsl(H, S, 60, 0) + '"/></radialGradient>' +
      '<linearGradient id="' + id + 'l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6cc46f"/><stop offset="1" stop-color="#23663a"/></linearGradient>' +
      '<clipPath id="' + id + 'c">' + bodyShapes + '</clipPath></defs>' +
      aura + '<ellipse cx="50" cy="106" rx="30" ry="3.6" fill="rgba(0,0,0,.28)"/>' + fillShapes +
      '<g clip-path="url(#' + id + 'c)" fill="none" stroke-linecap="round">' + extra +
        (sh.g ? '<path d="' + sh.g + '" stroke="' + groove + '" stroke-width="2.6" opacity=".75"/><path d="' + sh.g + '" stroke="' + hi + '" stroke-width=".9" transform="translate(1.2 0)" opacity=".7"/>' : '') +
        sw + '<rect x="0" y="0" width="100" height="110" fill="url(#' + id + 's)" stroke="none"/>' +
      '</g>' +
      (sh.c ? '' : '<path d="' + sh.d + '" fill="none" stroke="' + hsl(H, S, 16) + '" stroke-width="1.3"/>') +
      '<ellipse cx="35" cy="' + (sh.top[1] + 16) + '" rx="9" ry="6" transform="rotate(-32 35 ' + (sh.top[1] + 16) + ')" fill="url(#' + id + 'h)"/>' +
      tipCurl + crown + stem + '</svg>';
  }
  $$('.fruits').forEach(function (list) {
    var type = list.getAttribute('data-type');
    $$('.fruit', list).forEach(function (btn) {
      var name = btn.textContent.trim(), used = btn.getAttribute('data-used'), sp = SPEC[name] || [];
      var target = { 'Fidelity Investments': '#isle-fidelity', 'Cryptocurrency Investment App': '#isle-crypto', 'QR Code Generator': '#isle-qr', 'UMass Lowell': '#isle-uml' }[used] || (used && used.indexOf('Homework') === 0 ? '#isle-homework' : '');
      var tip = '<b>' + (sp[3] || name) + '</b>' + FRUIT[type].name + ' type. ' + (sp[4] || FRUIT[type].blurb) +
        (used ? '<i>Used at: ' + used + (target ? '. Click to sail there.' : '') + '</i>' : '');
      btn.id = 'fruit-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      if (target) btn.setAttribute('data-target', target);
      btn.innerHTML = fruitSVG(name, type) + '<span class="fruit__name">' + name + '</span>' +
        (sp[3] ? '<span class="fruit__mi">' + sp[3] + '</span>' : '') + '<span class="fruit__tip" role="tooltip">' + tip + '</span>';
      btn.setAttribute('aria-label', name + ', ' + (sp[3] ? sp[3] + ', ' : '') + FRUIT[type].name + ' type' + (used ? ', used at ' + used : '') + (target ? '. Activate to go there.' : ''));
    });
  });

  /* ------------------------------------------------------------ route + ship */
  var voyage = $('#voyage'), routeSvg = $('#route'), base = $('#routeBase'), done = $('#routeDone'), ship = $('#ship');
  var samples = [], total = 0, built = false, raf = null;

  function buildRoute() {
    if (!voyage) return;
    var vr = voyage.getBoundingClientRect();
    var narrow = vr.width < 760;
    var pins = $$('.pin', voyage).map(function (p) {
      var b = p.getBoundingClientRect();
      return [narrow ? 26 : b.left - vr.left, b.top - vr.top];
    }).filter(function (p) { return p[1] > 0; }).sort(function (a, b) { return a[1] - b[1]; });
    if (!pins.length) return;
    var startX = narrow ? 26 : vr.width * .5;
    pins.unshift([startX, 8]);
    var d = 'M' + pins[0][0].toFixed(1) + ' ' + pins[0][1].toFixed(1);
    for (var i = 1; i < pins.length; i++) {
      var a = pins[i - 1], b = pins[i], dy = b[1] - a[1];
      d += 'C' + a[0].toFixed(1) + ' ' + (a[1] + dy * .5).toFixed(1) + ' ' + b[0].toFixed(1) + ' ' + (b[1] - dy * .5).toFixed(1) + ' ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1);
    }
    routeSvg.setAttribute('height', voyage.scrollHeight);
    routeSvg.setAttribute('viewBox', '0 0 ' + vr.width + ' ' + voyage.scrollHeight);
    base.setAttribute('d', d);
    done.setAttribute('d', d);
    total = base.getTotalLength();
    samples = [];
    for (var L = 0; L <= total; L += 5) { var pt = base.getPointAtLength(L); samples.push({ L: L, x: pt.x, y: pt.y }); }
    var last = base.getPointAtLength(total); samples.push({ L: total, x: last.x, y: last.y });
    done.style.strokeDasharray = total + ' ' + total;
    built = true;
    placeShip();
  }

  function placeShip() {
    raf = null;
    if (!built || !samples.length) return;
    var vr = voyage.getBoundingClientRect();
    var y = window.innerHeight * .52 - vr.top;
    var lo = 0, hi = samples.length - 1;
    if (y <= samples[0].y) hi = 0;
    else if (y >= samples[hi].y) lo = hi;
    else {
      while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (samples[mid].y < y) lo = mid; else hi = mid; }
    }
    var s0 = samples[lo], s1 = samples[Math.min(hi, samples.length - 1)];
    var k = s1.y > s0.y ? (y - s0.y) / (s1.y - s0.y) : 0; k = Math.max(0, Math.min(1, k));
    var x = s0.x + (s1.x - s0.x) * k, yy = s0.y + (s1.y - s0.y) * k, L = s0.L + (s1.L - s0.L) * k;
    var aIdx = Math.max(0, lo - 2), bIdx = Math.min(samples.length - 1, lo + 3);
    var dx = samples[bIdx].x - samples[aIdx].x, dy = samples[bIdx].y - samples[aIdx].y, len = Math.hypot(dx, dy) || 1;
    var side = dx / len;
    if (side < -.18) ship.classList.add('is-left'); else if (side > .18) ship.classList.remove('is-left');
    var tilt = Math.max(-9, Math.min(9, side * 10)) * (ship.classList.contains('is-left') ? -1 : 1);
    ship.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + yy.toFixed(1) + 'px,0) rotate(' + tilt.toFixed(1) + 'deg)';
    var off = Math.round(total - L);
    if (off !== lastOff) { done.style.strokeDashoffset = off; lastOff = off; }
  }
  var lastOff = -1;
  var progress = $('#progress'), driftDecor = function () {};
  function frame() {
    raf = null;
    var y = window.pageYOffset;
    placeShip();
    driftDecor(y);
    if (progress) {
      var max = doc.scrollHeight - window.innerHeight;
      progress.style.transform = 'scaleX(' + (max > 0 ? y / max : 0).toFixed(4) + ')';
    }
  }
  function queueShip() { if (!raf) raf = requestAnimationFrame(frame); }
  function onScroll() { queueShip(); }
  window.addEventListener('scroll', onScroll, { passive: true });

  var rebuildTimer = null;
  function queueBuild() { clearTimeout(rebuildTimer); rebuildTimer = setTimeout(buildRoute, 60); }
  window.addEventListener('resize', queueBuild);
  window.addEventListener('load', buildRoute);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildRoute);
  if ('ResizeObserver' in window && voyage) new ResizeObserver(queueBuild).observe(voyage);
  buildRoute();
  onScroll();

  /* ------------------------------------------------------------ images that fail to load */
  function portraitFallback(img) {
    var svg = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 132"><rect width="120" height="132" fill="#cdb88d"/><circle cx="60" cy="50" r="24" fill="#6b5338"/><path d="M14 132c4-30 22-44 46-44s42 14 46 44z" fill="#6b5338"/></svg>');
    img.src = svg; img.removeAttribute('data-fallback');
  }
  function handleBroken(img) {
    if (img.getAttribute('data-fallback') === 'portrait') { portraitFallback(img); return; }
    var fig = img.closest('figure'), spy = img.closest('.spy');
    if (fig) fig.remove();
    if (spy && !$('figure', spy)) spy.remove();
  }
  $$('img').forEach(function (img) {
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) handleBroken(img);
    else img.addEventListener('error', function () { handleBroken(img); }, { once: true });
  });

  /* ------------------------------------------------------------ poster counters (the one page-load moment) */
  if (!reduceMotion.matches) {
    var runCount = function (el) {
      var to = parseInt(el.getAttribute('data-count'), 10), t0 = null, suf = el.getAttribute('data-suffix') || '';
      var dur = to > 100 ? 1600 : 1100;
      function tick(ts) {
        if (t0 === null) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur);
        el.textContent = String(Math.round(to * easeInOutCubic(p))) + suf;
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    };
    var counters = $$('[data-count]');
    counters.forEach(function (el) { el.textContent = '0' + (el.getAttribute('data-suffix') || ''); });
    if ('IntersectionObserver' in window) {
      var cio = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { cio.unobserve(e.target); setTimeout(function () { runCount(e.target); }, 250); } });
      }, { threshold: .6 });
      counters.forEach(function (el) { cio.observe(el); });
    } else counters.forEach(runCount);
  }

  /* ------------------------------------------------------------ copy buttons */
  var toast = $('#toast'), toastTimer = null;
  function say(msg) {
    toast.textContent = msg; toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 1800);
  }
  $$('.copy').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      var ok = function () { say(btn.getAttribute('data-done')); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, function () { say('Copy failed. Select the text instead.'); });
      else say('Copy failed. Select the text instead.');
    });
  });

  /* ------------------------------------------------------------ Haki */
  var obsBtn = $('#hakiObs'), armBtn = $('#hakiArm'), conqBtn = $('#hakiConq'), ripple = $('#ripple');
  if (store('mm-haki-tried') === '1') doc.classList.add('haki-tried');
  [obsBtn, armBtn, conqBtn].forEach(function (b) {
    b.addEventListener('click', function () {
      var t = $('.haki__try', b); if (t) t.remove();
      if (!$$('.haki__try').length) { doc.classList.add('haki-tried'); store('mm-haki-tried', '1'); }
    });
  });

  function setObservation(on) {
    doc.classList.toggle('haki-obs', on);
    obsBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on && ripple && !reduceMotion.matches) {
      var b = obsBtn.getBoundingClientRect();
      ripple.style.left = (b.left + b.width / 2) + 'px';
      ripple.style.bottom = (window.innerHeight - b.top - b.height / 2 - 20) + 'px';
      ripple.classList.remove('go'); void ripple.offsetWidth; ripple.classList.add('go');
    }
    say(on ? 'Observation Haki on: numbers revealed' : 'Observation Haki off');
  }
  obsBtn.addEventListener('click', function () { setObservation(!doc.classList.contains('haki-obs')); });

  var logs = $$('.log');
  function setHard(log, on) {
    log.classList.toggle('is-hard', on);
    var b = $('.harden', log);
    if (b) {
      b.setAttribute('aria-expanded', on ? 'true' : 'false');
      $('span', b).textContent = on ? 'Soften' : 'Harden for detail';
    }
  }
  logs.forEach(function (log) {
    var b = $('.harden', log);
    if (!b) return;
    b.addEventListener('click', function () {
      setHard(log, !log.classList.contains('is-hard'));
      var all = logs.every(function (l) { return l.classList.contains('is-hard'); });
      armBtn.setAttribute('aria-pressed', all ? 'true' : 'false');
    });
  });
  armBtn.addEventListener('click', function () {
    var on = armBtn.getAttribute('aria-pressed') !== 'true';
    logs.forEach(function (l) { setHard(l, on); });
    armBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    say(on ? 'Armament Haki on: every card hardened' : 'Armament Haki off');
  });

  // Conqueror's: lightning, the ocean dims, highlights take over
  var conq = $('#conq'), bolts = $('#bolts');
  function boltPath(r, cx, cy, ang, len) {
    var d = 'M' + cx.toFixed(0) + ' ' + cy.toFixed(0), x = cx, y = cy, seg = 9 + Math.floor(r() * 5);
    for (var i = 0; i < seg; i++) {
      var step = len / seg, jitter = (r() - .5) * 1.1;
      x += Math.cos(ang + jitter) * step; y += Math.sin(ang + jitter) * step;
      d += 'L' + x.toFixed(0) + ' ' + y.toFixed(0);
    }
    return d;
  }
  function drawBolts() {
    var w = window.innerWidth, h = window.innerHeight, r = rng(Date.now() & 0xffff), out = '';
    bolts.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    var reach = Math.hypot(w, h) * .62;
    for (var i = 0; i < 9; i++) {
      var ang = i / 9 * Math.PI * 2 + r() * .5, sx = w / 2 + Math.cos(ang) * 120, sy = h / 2 + Math.sin(ang) * 90;
      var p = boltPath(r, sx, sy, ang, reach * (.6 + r() * .4));
      out += '<path pathLength="1" d="' + p + '"/><path class="inner" pathLength="1" d="' + p + '"/>';
    }
    bolts.innerHTML = out;
  }
  function openConqueror() {
    if (!conq || conq.open) return;
    drawBolts();
    doc.classList.add('haki-conq');
    conqBtn.setAttribute('aria-pressed', 'true');
    if (typeof conq.showModal === 'function') conq.showModal(); else conq.setAttribute('open', '');
  }
  function closeConqueror() {
    if (!conq || !conq.open) return;
    if (typeof conq.close === 'function') conq.close(); else conq.removeAttribute('open');
  }
  if (conq) {
    conq.addEventListener('close', function () {
      doc.classList.remove('haki-conq');
      conqBtn.setAttribute('aria-pressed', 'false');
      conqBtn.focus();
    });
    $$('button[data-close]', conq).forEach(function (b) { b.addEventListener('click', closeConqueror); });
    conq.addEventListener('click', function (e) { if (e.target === conq || e.target.classList.contains('conq__wrap')) closeConqueror(); });
  }
  conqBtn.addEventListener('click', function () { if (conq.open) closeConqueror(); else openConqueror(); });

  // Keyboard: O, A, C toggle Haki when you're not typing somewhere
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
    var k = (e.key || '').toLowerCase();
    if (conq && conq.open && k !== 'c') return;
    if (k === 'o') obsBtn.click();
    else if (k === 'a') armBtn.click();
    else if (k === 'c') conqBtn.click();
  });


  /* ------------------------------------------------------------ screenshot viewer: one photo, arrows to swap
     (pattern adapted from Watermelon UI's Radial Carousel + Carousel Navigator) */
  $$('.spy').forEach(function (spy, n) {
    var strip = $('.spy__strip', spy), figs = $$('figure', strip);
    if (!figs.length) return;
    var label = (strip.getAttribute('aria-label') || 'Screenshots').replace(', scroll sideways', '');
    var v = document.createElement('div');
    v.className = 'viewer';
    v.setAttribute('role', 'region'); v.setAttribute('aria-roledescription', 'carousel'); v.setAttribute('aria-label', label); v.tabIndex = 0;
    var stage = document.createElement('div'); stage.className = 'viewer__stage';
    var side = document.createElement('div'); side.className = 'viewer__side';
    var cap = document.createElement('p'); cap.className = 'viewer__cap'; cap.setAttribute('aria-live', 'polite');
    var nav = document.createElement('div'); nav.className = 'viewer__nav';
    nav.innerHTML = '<button type="button" class="viewer__btn" data-dir="-1" aria-label="Previous screenshot"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      '<span class="viewer__dots"></span><span class="viewer__count"></span>' +
      '<button type="button" class="viewer__btn viewer__btn--next" data-dir="1" aria-label="Next screenshot"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>';
    var dots = $('.viewer__dots', nav), count = $('.viewer__count', nav), i = 0;
    figs.forEach(function (f, k) {
      var c = $('figcaption', f); f.setAttribute('data-cap', c ? c.innerHTML : ''); if (c) c.remove();
      f.setAttribute('aria-hidden', 'true');
      stage.appendChild(f);
      var d = document.createElement('button'); d.type = 'button'; d.className = 'viewer__dot'; d.setAttribute('aria-label', 'Show screenshot ' + (k + 1));
      d.addEventListener('click', function () { show(k, k > i ? 1 : -1); });
      dots.appendChild(d);
    });
    function show(k, dir) {
      var prev = figs[i];
      i = (k + figs.length) % figs.length;
      figs.forEach(function (f, j) {
        f.classList.remove('is-on', 'from-left', 'from-right', 'is-leaving');
        f.setAttribute('aria-hidden', j === i ? 'false' : 'true');
      });
      if (prev !== figs[i]) prev.classList.add('is-leaving', dir > 0 ? 'to-left' : 'to-right');
      setTimeout(function () { prev.classList.remove('is-leaving', 'to-left', 'to-right'); }, 450);
      figs[i].classList.add('is-on', dir > 0 ? 'from-right' : 'from-left');
      cap.innerHTML = figs[i].getAttribute('data-cap');
      count.textContent = (i + 1) + ' / ' + figs.length;
      $$('.viewer__dot', dots).forEach(function (d, j) { d.setAttribute('aria-current', j === i ? 'true' : 'false'); });
    }
    $$('.viewer__btn', nav).forEach(function (b) { b.addEventListener('click', function () { var dd = +b.getAttribute('data-dir'); show(i + dd, dd); }); });
    v.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); show(i + 1, 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1, -1); }
    });
    var sx = null;
    stage.addEventListener('pointerdown', function (e) { sx = e.clientX; });
    stage.addEventListener('pointerup', function (e) { if (sx === null) return; var dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1); });
    side.appendChild(cap); side.appendChild(nav);
    v.appendChild(stage); v.appendChild(side);
    strip.replaceWith(v);
    show(0, 1);
  });

  /* ------------------------------------------------------------ clickable details */
  // Haki words in the hero list press the matching dock button
  $$('.hakilink').forEach(function (b) { b.addEventListener('click', function () { var t = document.getElementById(b.getAttribute('data-haki')); if (t) t.click(); }); });

  // Arriving somewhere by link makes the card glow so you can see where you landed
  function flash(el) {
    var card = el.classList.contains('log') || el.classList.contains('flag') || el.classList.contains('fruit') ? el : (el.querySelector && el.querySelector('.log'));
    if (!card) return;
    card.classList.remove('is-found'); void card.offsetWidth; card.classList.add('is-found');
    setTimeout(function () { card.classList.remove('is-found'); }, 2200);
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var t = document.getElementById(a.getAttribute('href').slice(1));
    if (t) setTimeout(function () { flash(t); }, 650);
  });
  function goTo(sel) {
    var t = $(sel); if (!t) return;
    sailTo(t); flash(t);
  }

  // Tech chips on every card jump to the matching devil fruit
  $$('.stack li').forEach(function (li) {
    var name = li.textContent.trim(), id = 'fruit-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (!document.getElementById(id)) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = name;
    b.setAttribute('aria-label', name + ': see its devil fruit');
    b.addEventListener('click', function () { goTo('#' + id); });
    li.textContent = ''; li.appendChild(b); li.classList.add('has-chip');
  });
  // Fruits that were used somewhere sail you there
  $$('.fruit[data-target]').forEach(function (f) {
    f.style.cursor = 'pointer';
    f.addEventListener('click', function () { goTo(f.getAttribute('data-target')); });
  });

  // The treasure chest on the final island
  var chestBtn = $('#chestBtn'), chestNote = $('#chestNote');
  if (chestBtn) chestBtn.addEventListener('click', function () {
    var open = chestBtn.getAttribute('aria-pressed') !== 'true';
    chestBtn.setAttribute('aria-pressed', open ? 'true' : 'false');
    chestBtn.textContent = open ? 'Close the chest' : 'Open the treasure';
    chestNote.textContent = open ? 'The real treasure is a conversation. Write to maynemurray@gmail.com.' : '';
    document.dispatchEvent(new CustomEvent('chest:toggle', { detail: open }));
  });

  // Paper: every text panel is a real sheet. The sheet layer carries the texture, crumple, creases
  // and stained edges, and its outline is cut with a slightly ragged edge, small nicks and the odd
  // torn corner. The panel itself casts the shadow, so the shadow follows the cut edge.
  var paperRand = function (k) { var r = rng(9001 + k * 97); return r; };
  $$('.log, .flag, .logpage, .vivre__card, .port, .bounty').forEach(function (el, k) {
    var r = paperRand(k);
    var sheet = document.createElement('span');
    sheet.className = 'sheet sheet--c' + (1 + k % 3); sheet.setAttribute('aria-hidden', 'true');
    var stain = r() < .35 ? '<span class="sheet__stain" style="left:' + (15 + r() * 65).toFixed(0) + '%;top:' + (20 + r() * 60).toFixed(0) + '%"></span>' : '';
    sheet.innerHTML = '<span class="sheet__crumple"></span>' + stain + '<svg class="sheet__creases" preserveAspectRatio="none"></svg>';
    el.insertBefore(sheet, el.firstChild);
    el.classList.add('paper');
    sheet.style.setProperty('--lean', ((r() - .5) * (el.classList.contains('port') ? .5 : .9)).toFixed(2) + 'deg');
    if (!el.classList.contains('port')) {
      var kind = el.classList.contains('bounty') || r() < .35 ? 'tack' : 'tape';
      var s = document.createElement('span'); s.className = kind; s.setAttribute('aria-hidden', 'true');
      if (kind === 'tape') s.style.setProperty('--tilt', ((r() - .5) * 9).toFixed(1) + 'deg');
      el.appendChild(s);
    }
    // the cut: built in pixels so nicks stay small on big sheets and small on small ones
    var seed = 400 + k * 13;
    function cut() {
      var w = el.offsetWidth, h = el.offsetHeight; if (!w || !h) return;
      var rr = rng(seed), pts = [];
      function edge(x0, y0, x1, y1, nx, ny) {
        var len = Math.hypot(x1 - x0, y1 - y0), steps = Math.max(2, Math.round(len / 14));
        var nickAt = rr() < .55 ? .15 + rr() * .7 : -1, nickDone = false;
        for (var i = 0; i < steps; i++) {
          var t = i / steps, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, j = rr() * 1.8;
          pts.push([x + nx * j, y + ny * j]);
          if (!nickDone && nickAt > 0 && t > nickAt) { // a small V-shaped nick into the sheet
            nickDone = true;
            var d = 4 + rr() * 7, wdt = 3 + rr() * 4, ux = (x1 - x0) / len, uy = (y1 - y0) / len;
            pts.push([x + ux * wdt + nx * d, y + uy * wdt + ny * d]);
            pts.push([x + ux * wdt * 2.2, y + uy * wdt * 2.2]);
          }
        }
      }
      var tear = rr() < .4 ? 8 + rr() * 12 : 0; // a torn-off corner on some sheets
      edge(0, 0, w, 0, 0, 1);
      edge(w, 0, w, h - tear, -1, 0);
      if (tear) { pts.push([w - tear * .3, h - tear * .55]); pts.push([w - tear * .65, h - tear * .2]); }
      edge(w - tear, h, 0, h, 0, -1);
      edge(0, h, 0, 0, 1, 0);
      sheet.style.clipPath = 'polygon(' + pts.map(function (p) { return p[0].toFixed(1) + 'px ' + p[1].toFixed(1) + 'px'; }).join(',') + ')';
      // creases: soft folds running edge to edge, a light ridge beside a dark valley
      var svg = sheet.querySelector('.sheet__creases'), out = '', n = 1 + Math.floor(rr() * 3);
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      for (var c = 0; c < n; c++) {
        var horiz = rr() < .5, a = rr(), b = rr(), d2;
        d2 = horiz ? 'M0 ' + (h * a).toFixed(0) + 'Q' + (w * .5).toFixed(0) + ' ' + (h * (a + b) / 2 + (rr() - .5) * 20).toFixed(0) + ' ' + w + ' ' + (h * b).toFixed(0)
                   : 'M' + (w * a).toFixed(0) + ' 0Q' + (w * (a + b) / 2 + (rr() - .5) * 20).toFixed(0) + ' ' + (h * .5).toFixed(0) + ' ' + (w * b).toFixed(0) + ' ' + h;
        out += '<path d="' + d2 + '" stroke="rgba(255,252,240,.55)" stroke-width="1.2" fill="none"/><path d="' + d2 + '" stroke="rgba(92,58,20,.2)" stroke-width="1.6" fill="none" transform="translate(1.4 1.4)"/>';
      }
      svg.innerHTML = out;
    }
    cut();
    if ('ResizeObserver' in window) new ResizeObserver(function () { cut(); }).observe(el);
  });

  /* ------------------------------------------------------------ the sea moves with you */
  (function sea() {
    if (!voyage) return;
    // things floating on the open water, kept in the margins beside the content
    var D = {
      whale: '<svg viewBox="0 0 120 60"><path d="M10 40Q30 20 62 24Q92 28 104 40Q90 46 60 46Q30 46 10 40Z" fill="#2a4a63"/><path d="M104 40Q112 30 118 24Q112 38 116 50Q110 44 104 40Z" fill="#2a4a63"/><circle cx="28" cy="34" r="2" fill="#0b1a26"/><path d="M40 22Q38 10 32 6M40 22Q44 10 50 6" stroke="#cfe8f1" stroke-width="2" fill="none" stroke-linecap="round" class="spout"/><path d="M4 46Q60 56 116 46" stroke="rgba(255,255,255,.5)" stroke-width="2" fill="none"/></svg>',
      barrel: '<svg viewBox="0 0 50 50"><g class="bob"><ellipse cx="25" cy="25" rx="14" ry="16" fill="#8a5a2b" stroke="#4a2a12" stroke-width="2"/><path d="M11 19H39M11 31H39" stroke="#c9a462" stroke-width="3"/><path d="M8 40Q25 46 42 40" stroke="rgba(255,255,255,.55)" stroke-width="2" fill="none"/></g></svg>',
      rocks: '<svg viewBox="0 0 90 50"><path d="M8 42L20 18L34 26L42 8L60 30L74 22L84 42Z" fill="#4d5862"/><path d="M42 8L48 22L60 30" stroke="#6e7a85" stroke-width="2" fill="none"/><path d="M2 44Q45 52 88 44" stroke="rgba(255,255,255,.55)" stroke-width="2.4" fill="none" stroke-dasharray="6 5"/></svg>',
      gulls: '<svg viewBox="0 0 80 40"><g fill="none" stroke="#e8f4f6" stroke-width="2" stroke-linecap="round" class="flap"><path d="M6 20q6-7 12 0q6-7 12 0"/><path d="M40 10q5-6 10 0q5-6 10 0"/><path d="M52 28q4-5 8 0q4-5 8 0"/></g></svg>',
      serpent: '<svg viewBox="0 0 140 60"><path d="M6 46Q20 14 36 40Q50 62 64 34Q78 10 92 38" stroke="#3f7a5e" stroke-width="11" fill="none" stroke-linecap="round"/><path d="M92 38Q100 50 112 40Q122 30 132 34L134 42Q124 40 116 48" fill="#3f7a5e"/><circle cx="124" cy="36" r="2" fill="#ffd27a"/><path d="M6 50Q70 58 136 50" stroke="rgba(255,255,255,.45)" stroke-width="2" fill="none"/></svg>',
      bottle: '<svg viewBox="0 0 40 40"><g class="bob"><rect x="12" y="10" width="14" height="22" rx="5" fill="rgba(170,220,200,.55)" stroke="#cfe8f1"/><rect x="16" y="5" width="6" height="7" fill="#8a5a2b"/><path d="M15 16h8M15 20h7M15 24h8" stroke="#eedcb6" stroke-width="1.6"/></g></svg>',
      buoy: '<svg viewBox="0 0 40 50"><g class="bob"><path d="M12 36L20 8L28 36Z" fill="#c8323a"/><path d="M14 28H26" stroke="#f4efe6" stroke-width="4"/><circle cx="20" cy="8" r="3" fill="#ffe08a"/><path d="M4 40Q20 46 36 40" stroke="rgba(255,255,255,.55)" stroke-width="2" fill="none"/></g></svg>',
      fish: '<svg viewBox="0 0 60 50"><g class="leap"><path d="M14 30Q26 12 44 22Q32 34 14 30Z" fill="#e8a93e"/><path d="M44 22L54 14L52 28Z" fill="#e8a93e"/><circle cx="22" cy="26" r="1.6" fill="#2a1a06"/></g><path d="M6 42Q30 48 54 42" stroke="rgba(255,255,255,.5)" stroke-width="2" fill="none"/></svg>'
    };
    var order = ['gulls', 'whale', 'barrel', 'rocks', 'bottle', 'serpent', 'buoy', 'gulls', 'barrel', 'whale', 'rocks', 'buoy'];
    var decor = [];
    function placeDecor() {
      decor.forEach(function (d) { d.el.remove(); }); decor = [];
      var w = voyage.clientWidth, h = voyage.scrollHeight;
      var margin = Math.max(0, (w - 1180) / 2);
      if (margin < 70) return; // not enough open water beside the content
      var n = Math.floor(h / 560);
      for (var k = 0; k < n; k++) {
        var kind = order[k % order.length], left = k % 2 === 0;
        var size = kind === 'whale' || kind === 'serpent' ? Math.min(margin - 10, 150) : Math.min(margin - 20, 70);
        if (size < 40) continue;
        var el = document.createElement('div');
        el.className = 'flotsam flotsam--' + kind + (kind === 'whale' || kind === 'serpent' ? ' is-under' : ''); el.setAttribute('aria-hidden', 'true');
        el.innerHTML = D[kind];
        el.style.width = size + 'px';
        el.style.left = (left ? (margin - size) * .45 : w - margin + (margin - size) * .55) + 'px';
        el.style.top = (380 + k * 560 + (k * 131 % 200)) + 'px';
        voyage.appendChild(el);
        decor.push({ el: el, speed: .04 + (k % 3) * .035 });
      }
    }
    // driven from the one scroll frame below, so everything moves on the same tick
    driftDecor = function (y) { if (reduceMotion.matches) return; for (var i = 0; i < decor.length; i++) decor[i].el.style.transform = 'translate3d(0,' + (-(y * decor[i].speed)).toFixed(1) + 'px,0)'; };
    window.addEventListener('load', function () { placeDecor(); driftDecor(window.pageYOffset); });
    var dt = null; window.addEventListener('resize', function () { clearTimeout(dt); dt = setTimeout(placeDecor, 200); });
    placeDecor();
  })();

  /* ------------------------------------------------------------ Motion Primitives ports (vanilla) */
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  var calm = reduceMotion.matches;

  // Text Loop: the hero tagline cycles through what I build
  var words = $$('.loop__word');
  if (words.length > 1 && !calm) {
    var wi = 0;
    var widest = 0;
    setInterval(function () {
      var cur = words[wi]; wi = (wi + 1) % words.length; var nxt = words[wi];
      cur.classList.remove('is-on'); cur.classList.add('is-out');
      nxt.classList.remove('is-out'); nxt.classList.add('is-on');
      setTimeout(function () { cur.classList.remove('is-out'); }, 500);
    }, 2400);
  }

  // Text Effect: headings arrive word by word, blurred to sharp
  $$('.split').forEach(function (el) {
    var parts = el.textContent.split(/(\s+)/), out = '', n = 0;
    parts.forEach(function (p) { out += /^\s+$/.test(p) ? p : '<span class="w" style="--i:' + (n++) + '">' + p + '</span>'; });
    el.setAttribute('aria-label', el.textContent);
    el.innerHTML = out;
    $$('.w', el).forEach(function (w) { w.setAttribute('aria-hidden', 'true'); });
    if (!calm) el.classList.add('is-armed');
  });

  // In View: cards rise in as they reach the viewport
  var rising = $$('.log, .flag, .bounty, .grove, .logpage, .vivre, .port');
  if ('IntersectionObserver' in window && !calm) {
    rising.forEach(function (el) { el.classList.add('inview'); });
    var vio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        vio.unobserve(e.target);
        e.target.classList.add('is-in');
        if (e.target.classList.contains('split')) e.target.classList.remove('is-armed');
        // drop the reveal transition once done so Tilt stays snappy
        setTimeout(function () { e.target.classList.remove('inview', 'is-in'); }, 900);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
    rising.forEach(function (el) { vio.observe(el); });
    $$('.split').forEach(function (el) { vio.observe(el); });
    // the hero name is above the fold: play it straight away
    var hn = $('#hero-name'); if (hn) setTimeout(function () { hn.classList.add('is-in'); hn.classList.remove('is-armed'); }, 120);
  }

  if (fine.matches && !calm) {
    // Tilt: spring-smoothed 3D rotation toward the pointer
    $$('[data-tilt]').forEach(function (el) {
      var max = parseFloat(el.getAttribute('data-tilt')) || 8, base = el.classList.contains('poster') ? 'rotate(-2deg) ' : '';
      var tx = 0, ty = 0, cx = 0, cy = 0, run = null;
      function frame() {
        cx += (tx - cx) * .14; cy += (ty - cy) * .14;
        el.style.transform = base + 'perspective(900px) rotateX(' + (-cy * max).toFixed(2) + 'deg) rotateY(' + (cx * max).toFixed(2) + 'deg)';
        if (Math.abs(tx - cx) > .001 || Math.abs(ty - cy) > .001) run = requestAnimationFrame(frame); else run = null;
      }
      el.addEventListener('pointermove', function (e) {
        var b = el.getBoundingClientRect();
        tx = (e.clientX - b.left) / b.width - .5; ty = (e.clientY - b.top) / b.height - .5;
        if (!run) run = requestAnimationFrame(frame);
      });
      el.addEventListener('pointerleave', function () { tx = 0; ty = 0; if (!run) run = requestAnimationFrame(frame); });
    });

    // Spotlight: a soft lantern follows the pointer across cards
    $$('.spot').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var b = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - b.left) + 'px');
        el.style.setProperty('--my', (e.clientY - b.top) + 'px');
      });
    });

    // Magnetic: buttons lean toward the pointer
    $$('.magnetic').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var b = el.getBoundingClientRect();
        var mx = e.clientX - (b.left + b.width / 2), my = e.clientY - (b.top + b.height / 2);
        el.style.transform = 'translate(' + (mx * .22).toFixed(1) + 'px,' + (my * .3).toFixed(1) + 'px)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
  }
})();


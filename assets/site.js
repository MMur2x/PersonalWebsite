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
    var start = window.pageYOffset, dist = top - start, dur = Math.min(1900, Math.max(700, Math.abs(dist) * .45)), t0 = null;
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
  function islandSVG(seed, flagVar) {
    var r = rng(seed);
    var outline = blob(r, 13, 1, .42, 1.12, .82, 0, .05);
    var scale = function (pts, k, dx, dy) { return pts.map(function (p) { return [p[0] * k + (dx || 0), p[1] * k + (dy || 0)]; }); };
    var green = blob(r, 11, .66, .5, 1.05, .78, (r() - .5) * .18, -.04);
    var hill = blob(r, 9, .3, .4, 1, .8, (r() - .5) * .3, -.14);
    var trees = '';
    for (var t = 0; t < 5; t++) {
      var tx = (r() - .5) * 1.0, ty = (r() - .5) * .55 - .05, tr = .07 + r() * .05;
      trees += '<circle cx="' + tx.toFixed(2) + '" cy="' + ty.toFixed(2) + '" r="' + tr.toFixed(3) + '" fill="var(--grass-2)"/>';
    }
    var fx = (r() - .5) * .4, fy = -.2;
    var palms = '', rocks = '', k;
    for (k = 0; k < 3; k++) {
      var px = (r() - .5) * 1.3, py = .05 + r() * .25, lean = (r() - .5) * .5, top = [px + lean * .5, py - .5];
      palms += '<path d="M' + px.toFixed(2) + ' ' + py.toFixed(2) + 'Q' + (px + lean).toFixed(2) + ' ' + (py - .25).toFixed(2) + ' ' + top[0].toFixed(2) + ' ' + top[1].toFixed(2) + '" stroke="#6b4320" stroke-width=".045" fill="none" stroke-linecap="round"/>';
      for (var f = 0; f < 5; f++) {
        var ang = -Math.PI / 2 + (f - 2) * .62, ex = top[0] + Math.cos(ang) * .26, ey = top[1] + Math.sin(ang) * .2 + .08;
        palms += '<path d="M' + top[0].toFixed(2) + ' ' + top[1].toFixed(2) + 'Q' + ((top[0] + ex) / 2).toFixed(2) + ' ' + (Math.min(top[1], ey) - .08).toFixed(2) + ' ' + ex.toFixed(2) + ' ' + ey.toFixed(2) + '" stroke="var(--grass-2)" stroke-width=".07" fill="none" stroke-linecap="round"/>';
      }
      palms += '<circle cx="' + top[0].toFixed(2) + '" cy="' + (top[1] + .03).toFixed(2) + '" r=".035" fill="#5a3a1a"/>';
    }
    for (k = 0; k < 4; k++) {
      var a = r() * Math.PI * 2, rx = Math.cos(a) * 1.28, ry = Math.sin(a) * .98;
      rocks += '<ellipse cx="' + rx.toFixed(2) + '" cy="' + ry.toFixed(2) + '" rx="' + (.05 + r() * .06).toFixed(3) + '" ry=".04" fill="#5c6670"/>';
    }
    var hx = (r() - .5) * .6, hy = .22;
    var hut = '<path d="M' + (hx - .14).toFixed(2) + ' ' + hy + 'h.28v-.16h-.28z" fill="#a8723f"/><path d="M' + (hx - .19).toFixed(2) + ' ' + (hy - .15) + 'L' + hx.toFixed(2) + ' ' + (hy - .34) + 'L' + (hx + .19).toFixed(2) + ' ' + (hy - .15) + 'z" fill="#c99a52"/><rect x="' + (hx - .03).toFixed(2) + '" y="' + (hy - .09) + '" width=".06" height=".09" fill="#3a2412"/>';
    var dock = '<path d="M' + (hx + .1).toFixed(2) + ' ' + (hy + .1) + 'l.42 .36" stroke="#7a4b22" stroke-width=".07"/><path d="M' + (hx + .2).toFixed(2) + ' ' + (hy + .2) + 'l-.06 .07M' + (hx + .36).toFixed(2) + ' ' + (hy + .33) + 'l-.06 .07" stroke="#4a2a12" stroke-width=".03"/>';
    var gulls = '<g class="isle__gull" fill="none" stroke="var(--text)" stroke-width=".025" stroke-linecap="round" opacity=".7"><path d="M-1.1 -1q.06-.06 .12 0q.06-.06 .12 0"/><path d="M-.8 -1.12q.05-.05 .1 0q.05-.05 .1 0"/></g>';
    return '<svg viewBox="-1.5 -1.3 3 2.6" aria-hidden="true">' +
      '<path class="isle__surf" d="' + smoothClosed(scale(outline, 1.42)) + '" fill="none" stroke="rgba(255,255,255,.35)" stroke-width=".03" stroke-dasharray=".08 .06"/>' +
      '<path d="' + smoothClosed(scale(outline, 1.32)) + '" fill="var(--shoal)"/>' + rocks +
      '<path d="' + smoothClosed(outline) + '" fill="var(--sand)" stroke="rgba(0,0,0,.18)" stroke-width=".02"/>' +
      '<path d="' + smoothClosed(green) + '" fill="var(--grass)"/>' +
      '<path d="' + smoothClosed(hill) + '" fill="var(--grass-2)" opacity=".85"/>' + trees + hut + dock + palms + gulls +
      '<path d="M' + fx.toFixed(2) + ' ' + fy + 'v-.62" stroke="#3a2412" stroke-width=".035" stroke-linecap="round"/>' +
      '<path d="M' + fx.toFixed(2) + ' ' + (fy - .62) + 'l.34 .09-.34 .1z" fill="var(' + flagVar + ')"/>' +
      '</svg>';
  }
  $$('.isle__art').forEach(function (el) {
    var seed = parseInt(el.getAttribute('data-seed'), 10) || 1;
    var flag = el.getAttribute('data-flag') === 'proj' ? '--flag-proj' : '--flag-exp';
    el.insertAdjacentHTML('afterbegin', islandSVG(seed, flag));
  });

  // Final island: a small island with an X marking the spot
  var xm = $('.xmark');
  if (xm) {
    var r2 = rng(104), ol = blob(r2, 13, 1, .3, 1.1, .85, 0, 0);
    xm.insertAdjacentHTML('afterbegin',
      '<svg viewBox="-1.5 -1.3 3 2.6" aria-hidden="true">' +
      '<path d="' + smoothClosed(ol.map(function (p) { return [p[0] * 1.3, p[1] * 1.3]; })) + '" fill="var(--shoal)"/>' +
      '<path d="' + smoothClosed(ol) + '" fill="var(--sand)"/>' +
      '<path d="M-.22 -.22L.22 .22M.22 -.22L-.22 .22" stroke="#b3122e" stroke-width=".11" stroke-linecap="round"/>' +
      '</svg>');
  }

  /* ------------------------------------------------------------ devil fruits (original, detailed art) */
  var FRUIT = {
    paramecia: { name: 'Paramecia', blurb: 'A language I write in.' },
    zoan: { name: 'Zoan', blurb: 'A framework I shape things with.' },
    logia: { name: 'Logia', blurb: 'Infrastructure I run on.' }
  };
  // shape, hue, saturation, fruit name, power
  var SPEC = {
    'C':            ['lobed', 272, 46, 'Kiso Kiso no Mi', 'Grants command over memory itself, down to the last pointer.'],
    'C++':          ['pear', 318, 52, 'Zōka Zōka no Mi', 'Everything C can do, plus classes and templates.'],
    'Python':       ['lobed', 208, 55, 'Nyoro Nyoro no Mi', 'Slithers through scripts and data in a few readable lines.'],
    'JavaScript':   ['apple', 48, 78, 'Ugoki Ugoki no Mi', 'Brings any page to life; it powers the ship on this site.'],
    'TypeScript':   ['pear', 212, 58, 'Kata Kata no Mi', 'Hardens loose code into strict, predictable types.'],
    'SQL':          ['round', 24, 70, 'Kura Kura no Mi', 'Opens the storehouse and pulls out exactly the rows you ask for.'],
    'React':        ['melon', 192, 62, 'Hannō Hannō no Mi', 'Interfaces that re-render the instant their state changes.'],
    'Grafana Scenes': ['melon', 26, 80, 'Mie Mie no Mi', 'Turns raw telemetry into dashboards anyone can read.'],
    'Flutter':      ['pine', 200, 72, 'Pata Pata no Mi', 'One codebase that takes flight on every phone.'],
    'Pandas':       ['melon', 220, 10, 'Panda Panda no Mi', 'Model: Panda. Wrangles tables into shape.'],
    'Matplotlib':   ['pear', 205, 45, 'Zu Zu no Mi', 'Draws any dataset as a chart.'],
    'Kubernetes':   ['apple', 222, 72, 'Kaji Kaji no Mi', 'Takes the helm of entire fleets of containers.'],
    'Docker':       ['round', 204, 82, 'Hako Hako no Mi', 'Seals anything inside a box that runs the same everywhere.'],
    'AWS EKS':      ['lobed', 36, 92, 'Kumo Kumo no Mi', 'Summons Kubernetes clusters out of the cloud.'],
    'OpenTelemetry':['apple', 262, 50, 'Kansoku Kansoku no Mi', 'Observation made solid: traces, metrics and logs from every service.']
  };
  var BODY = {
    round: 'M50 26C71 26 86 41 86 62S71 98 50 98 14 83 14 62 29 26 50 26Z',
    apple: 'M50 30C56 22 74 22 82 36C90 50 88 76 76 88C66 98 56 99 50 97C44 99 34 98 24 88C12 76 10 50 18 36C26 22 44 22 50 30Z',
    lobed: 'M50 29C55 24 64 23 70 27C80 26 88 40 87 56C88 74 80 90 66 96C60 99 55 98 50 96C45 98 40 99 34 96C20 90 12 74 13 56C12 40 20 26 30 27C36 23 45 24 50 29Z',
    pear:  'M50 22C60 22 63 32 65 42C67 52 85 60 85 77C85 93 69 101 50 101C31 101 15 93 15 77C15 60 33 52 35 42C37 32 40 22 50 22Z',
    melon: 'M50 24C70 24 83 41 83 63C83 85 69 100 50 100C31 100 17 85 17 63C17 41 30 24 50 24Z',
    pine:  'M50 22C64 24 78 40 80 60C82 82 68 100 50 100C32 100 18 82 20 60C22 40 36 24 50 22Z'
  };
  var GROOVES = {
    lobed: 'M50 29Q46 62 50 96M30 28Q20 62 34 96M70 28Q80 62 66 96',
    apple: 'M50 30Q47 64 50 97',
    melon: 'M30 30Q22 64 32 96M50 24V100M70 30Q78 64 68 96M18 56Q50 66 82 56M20 78Q50 88 80 78',
    pine:  'M22 48L66 100M34 30L80 82M50 22L82 62M20 70L46 100M78 46L34 100M66 28L20 80M50 22L18 62M80 70L56 100',
    pear:  'M50 22Q45 62 50 101',
    round: ''
  };
  function hsl(h, s, l, a) { return 'hsl(' + h + ' ' + s + '% ' + l + '%' + (a !== undefined ? ' / ' + a : '') + ')'; }
  function spiral(cx, cy, rad, turns, dir, rot) {
    var d = '', steps = 22;
    for (var i = 0; i <= steps; i++) {
      var t = i / steps, a = rot + dir * t * turns * Math.PI * 2, rr = rad * (1 - t * .9) ;
      d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(2) + ' ' + (cy + Math.sin(a) * rr).toFixed(2);
    }
    return d;
  }
  function fruitSVG(name, type) {
    var sp = SPEC[name] || ['round', 280, 50, 'Mi', ''];
    var shape = sp[0], H = sp[1], S = sp[2], r = rng(hash(name)), id = 'df' + hash(name + type);
    var groove = hsl(H, Math.min(90, S + 8), S < 15 ? 14 : 22), hi = hsl(H, S, S < 15 ? 94 : 86, .42);
    // swirls on a jittered hex grid, every one embossed: groove, body, highlight
    var sw = '', row = 0;
    for (var y = 24; y <= 104; y += 11.2, row++) {
      for (var x = 10 + (row % 2) * 6.2; x <= 92; x += 12.4) {
        var jx = x + (r() - .5) * 2.4, jy = y + (r() - .5) * 2.4, rad = 6.4 + r() * 1.5, dir = r() > .5 ? 1 : -1, rot = r() * 6.28;
        var p = spiral(jx, jy, rad, 2 + r() * .35, dir, rot);
        sw += '<path d="' + p + '" stroke="rgba(0,0,0,.2)" stroke-width="3" transform="translate(.8 .9)"/>' +
              '<path d="' + p + '" stroke="' + groove + '" stroke-width="2.1"/>' +
              '<path d="' + p + '" stroke="' + hi + '" stroke-width=".75" transform="translate(-.55 -.65)"/>';
      }
    }
    var aura = type === 'logia'
      ? '<circle cx="50" cy="63" r="47" fill="url(#' + id + 'a)"/>' : '';
    var crown = type === 'zoan' || type === 'logia'
      ? '<path d="M50 27C44 20 36 20 31 23 38 25 43 28 50 30ZM50 27C56 20 64 20 69 23 62 25 57 28 50 30Z" fill="url(#' + id + 'l)" stroke="#1f4a2c" stroke-width=".8"/>' : '';
    return '<svg viewBox="0 0 100 110" aria-hidden="true"><defs>' +
      '<radialGradient id="' + id + 'b" cx=".36" cy=".32" r=".78"><stop offset="0" stop-color="' + hsl(H, S, S < 15 ? 86 : 70) + '"/><stop offset=".45" stop-color="' + hsl(H, S, S < 15 ? 66 : 52) + '"/><stop offset="1" stop-color="' + hsl(H, S, S < 15 ? 30 : 30) + '"/></radialGradient>' +
      '<radialGradient id="' + id + 's" cx=".3" cy=".26" r=".9"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></radialGradient>' +
      '<radialGradient id="' + id + 'h" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="' + id + 'a" cx=".5" cy=".5" r=".5"><stop offset=".55" stop-color="' + hsl(H, S, 60, .35) + '"/><stop offset="1" stop-color="' + hsl(H, S, 60, 0) + '"/></radialGradient>' +
      '<linearGradient id="' + id + 'l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6cc46f"/><stop offset="1" stop-color="#23663a"/></linearGradient>' +
      '<clipPath id="' + id + 'c"><path d="' + BODY[shape] + '"/></clipPath></defs>' +
      aura +
      '<ellipse cx="50" cy="104" rx="30" ry="4.2" fill="rgba(0,0,0,.28)"/>' +
      '<path d="' + BODY[shape] + '" fill="url(#' + id + 'b)"/>' +
      '<g clip-path="url(#' + id + 'c)" fill="none" stroke-linecap="round">' +
        (GROOVES[shape] ? '<path d="' + GROOVES[shape] + '" stroke="' + groove + '" stroke-width="2.6" opacity=".75"/><path d="' + GROOVES[shape] + '" stroke="' + hi + '" stroke-width=".9" transform="translate(1.2 0)" opacity=".7"/>' : '') +
        sw +
        '<rect x="0" y="0" width="100" height="110" fill="url(#' + id + 's)" stroke="none"/>' +
        '<path d="' + BODY[shape] + '" stroke="' + hsl(H, S, 85, .5) + '" stroke-width="2.4" transform="translate(-1.6 -1.6)"/>' +
      '</g>' +
      '<path d="' + BODY[shape] + '" fill="none" stroke="' + hsl(H, S, 16) + '" stroke-width="1.3"/>' +
      '<ellipse cx="36" cy="44" rx="10" ry="6.5" transform="rotate(-32 36 44)" fill="url(#' + id + 'h)"/>' +
      '<circle cx="44" cy="38" r="1.8" fill="#fff" opacity=".85"/>' +
      crown +
      // stem with a curled tendril, and a veined leaf
      '<path d="M50 30C49 22 52 15 59 12C66 9 72 13 70 18C68 22 63 20 65 17" fill="none" stroke="#3f2410" stroke-width="3.6" stroke-linecap="round"/>' +
      '<path d="M50 30C49 22 52 15 59 12" fill="none" stroke="#8a5a2b" stroke-width="1.2" stroke-linecap="round" transform="translate(-.6 -.4)"/>' +
      '<path d="M55 16C60 6 74 2 84 6C80 16 68 22 55 16Z" fill="url(#' + id + 'l)" stroke="#1f4a2c" stroke-width="1"/>' +
      '<path d="M56 15.5C64 11 74 7 83 6.4M64 12.4l2-4.4M70 10l2.6-4M64 12.4l-1 4.2M71 9.8l-.2 4.4" fill="none" stroke="#1f4a2c" stroke-width=".7" stroke-linecap="round"/>' +
      '</svg>';
  }
  $$('.fruits').forEach(function (list) {
    var type = list.getAttribute('data-type');
    $$('.fruit', list).forEach(function (btn) {
      var name = btn.textContent.trim(), used = btn.getAttribute('data-used'), sp = SPEC[name] || [];
      var tip = '<b>' + (sp[3] || name) + '</b>' + FRUIT[type].name + ' type. ' + (sp[4] || FRUIT[type].blurb) +
        (used ? '<i>Used at: ' + used + '</i>' : '');
      btn.innerHTML = fruitSVG(name, type) + '<span class="fruit__name">' + name + '</span>' +
        (sp[3] ? '<span class="fruit__mi">' + sp[3] + '</span>' : '') + '<span class="fruit__tip" role="tooltip">' + tip + '</span>';
      btn.setAttribute('aria-label', name + ', ' + (sp[3] ? sp[3] + ', ' : '') + FRUIT[type].name + ' type' + (used ? ', used at ' + used : ''));
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
    ship.style.transform = 'translate(' + x.toFixed(1) + 'px,' + yy.toFixed(1) + 'px) rotate(' + tilt.toFixed(1) + 'deg)';
    done.style.strokeDashoffset = (total - L).toFixed(1);
  }
  function queueShip() { if (!raf) raf = requestAnimationFrame(placeShip); }

  var progress = $('#progress');
  function onScroll() {
    queueShip();
    if (progress) {
      var max = doc.scrollHeight - window.innerHeight;
      progress.style.transform = 'scaleX(' + (max > 0 ? window.pageYOffset / max : 0).toFixed(4) + ')';
    }
  }
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
  var rising = $$('.log, .flag, .board__item, .grove, .instruments section, .logpage, .vivre, .recruit__in, .port');
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
    $$('.log, .spot').forEach(function (el) {
      el.classList.add('spot');
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


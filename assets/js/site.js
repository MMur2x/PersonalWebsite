/* Mayne Murray — Portfolio interactions. Vanilla JS, no dependencies. */
(function () {
  'use strict';

  var doc = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function store(key, val) { try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); } catch (e) { return null; } }

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
    themeBtn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
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
    function closeSectionMenu() {
      nav.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Open the section menu');
    }
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Close the section menu' : 'Open the section menu');
    });
    $$('a', nav).forEach(function (a) { a.addEventListener('click', closeSectionMenu); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) { closeSectionMenu(); burger.focus(); }
    });
  }

  var navLinks = $$('.nav a[href^="#"]');
  if ('IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        navLinks.forEach(function (a) { a.setAttribute('aria-current', a.getAttribute('href') === '#' + e.target.id ? 'true' : 'false'); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('main section[id]').forEach(function (s) { spy.observe(s); });
  }

  /* ------------------------------------------------------------ eased anchor navigation */
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

  /* ------------------------------------------------------------ mission emblems */
  // Fixed SVG materials keep the work icons detailed without a rendering loop.
  // Legacy landmark keys keep card links stable.
  var EMBLEMS = {
    lighthouse:
      '<path d="m48 106-17 22 3 31 13-13 10-4 6-27m81-9 14 19 6 32-15-10-12-4-9-28" fill="#182b46" stroke="#122136" stroke-width="1.3"/>' +
      '<path d="m46 117-9 20 2 14m106-31 9 17 3 11" fill="none" stroke="#405370" stroke-width="1.2"/>' +
      '<path d="M34 81q66-23 132 0l-3 38q-64 18-126 0Z" fill="#203653" stroke="#13253b" stroke-width="1.5"/>' +
      '<path d="M38 85q62-20 124 0m-122 31q60 16 120 0" fill="none" stroke="#52627c" stroke-width=".9"/>' +
      '<path d="M50 80q50-15 100 0l3 36q-52 15-106 0Z" fill="url(#@steel)" stroke="#4f625c" stroke-width="1.6"/>' +
      '<path d="M54 82q46-13 92 0l2 31q-48 13-97 0Z" fill="none" stroke="#e5ecdf" stroke-width="1"/>' +
      '<path d="M60 84q39-10 80-1m-78 30q39 9 78 0" fill="none" stroke="#f5f7ee" stroke-width=".6" opacity=".7"/>' +
      '<g fill="#647a70" stroke="#d5dfd0" stroke-width=".7"><circle cx="57" cy="88" r="2.5"/><circle cx="143" cy="88" r="2.5"/><circle cx="55" cy="108" r="2.5"/><circle cx="145" cy="108" r="2.5"/></g>' +
      '<path d="m56 87 2 2m84-2 2 2m-90 18 2 2m88-2 2 2" fill="none" stroke="#3c5149" stroke-width=".6"/>' +
      '<path d="M5 34V14l8 12 8-12v20M27 34V14l8 12 8-12v20" fill="none" stroke="#eef1e5" stroke-width="3.4" stroke-linecap="square" stroke-linejoin="miter" transform="translate(75.35 73.1) scale(1.05)"/>' +
      '<path d="M5 34V14l8 12 8-12v20M27 34V14l8 12 8-12v20" fill="none" stroke="#314b43" stroke-width="2.8" stroke-linecap="square" stroke-linejoin="miter" transform="translate(74.75 72.3) scale(1.05)"/>' +
      '<path d="m62 96 3-2m68 10 4-2m-69 7 3-1m69-17 3-1" fill="none" stroke="#73877c" stroke-width=".7"/>' +
      '<path d="m37 89 7-1m112 0 7 1m-123 18 4 1m112 0 5-1" fill="none" stroke="#61718b" stroke-width=".8"/>',
    windmill:
      '<g fill="none" stroke="#365046" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="100" cy="100" r="67" stroke-width="2.5"/><circle cx="100" cy="100" r="63" stroke-width=".9"/><circle cx="100" cy="100" r="51" stroke-width="1.6"/><circle cx="100" cy="100" r="47" stroke-width=".8"/><circle cx="100" cy="100" r="31" stroke-width="1.8"/>' +
      '<path d="M100 69V53m22 25 12-12m-3 34h16m-25 22 12 12m-34-3v16m-22-25-12 12m3-34H53m25-22L66 66" stroke-width="1.5"/>' +
      '<path d="M95 55h10m-5-3v10m-4-3h8m-6 3-3 3m7-3 3 3" stroke-width="1.4"/>' +
      '<path d="M96 40v6m4-7v7m4-6v6m-8-3h8" stroke-width="1.1"/>' +
      '<g stroke-width="1.3"><path d="M95 40v5h10v-5m-9 8h8m-4-8v10" transform="rotate(30 100 100)"/><path d="M95 41h10m-8-2v9m6-8-7 8m1-3h8" transform="rotate(60 100 100)"/><path d="M96 39v9h8v-7h-9m5 4h6" transform="rotate(90 100 100)"/><path d="M95 41h10m-8-2v9m6-8-7 8m1-3h8" transform="rotate(120 100 100)"/><path d="M95 40v5h10v-5m-9 8h8m-4-8v10" transform="rotate(150 100 100)"/><path d="M96 39v9h8v-7h-9m5 4h6" transform="rotate(180 100 100)"/><path d="M95 41h10m-8-2v9m6-8-7 8m1-3h8" transform="rotate(210 100 100)"/><path d="M95 40v5h10v-5m-9 8h8m-4-8v10" transform="rotate(240 100 100)"/><path d="M96 39v9h8v-7h-9m5 4h6" transform="rotate(270 100 100)"/><path d="M95 41h10m-8-2v9m6-8-7 8m1-3h8" transform="rotate(300 100 100)"/><path d="M95 40v5h10v-5m-9 8h8m-4-8v10" transform="rotate(330 100 100)"/></g>' +
      '<path d="M93 54v7h-4m18-7v7h4M139 93h7v-4m-7 18h7v4M93 146v-7h-4m18 7v-7h4M54 93h7v-4m-7 18h7v4" stroke-width="1.2"/>' +
      '<path d="M115 82c-17-13-37 0-34 19 3 18 27 22 38 7 8-12-2-25-13-22-12 3-12 18-2 21 6 2 11-3 8-8-2-4-7-3-7 0" stroke-width="3"/>' +
      '<path d="M88 74l-5-7m43 20 8-3m-19 43 3 8m-44-18-7 3" stroke-width=".9"/>' +
      '<path d="M45 61l-5-7 8-7m105 91 7 4 5-6M39 126l-7 2-4-6m116-82 4-8-5-3" stroke-width="1" opacity=".6"/></g>' +
      '<g fill="#365046" stroke="none"><circle cx="77" cy="59" r="1.1"/><circle cx="123" cy="59" r="1.1"/><circle cx="141" cy="123" r="1.1"/><circle cx="123" cy="141" r="1.1"/><circle cx="77" cy="141" r="1.1"/><circle cx="59" cy="77" r="1.1"/><circle cx="59" cy="123" r="1.1"/><circle cx="141" cy="77" r="1.1"/></g>',
    mill:
      '<g transform="rotate(-10 100 100)">' +
      '<path d="M60 61h78v80H60Z" fill="url(#@paper)" stroke="#99815a" stroke-width="1.2"/>' +
      '<path d="M64 70v61m70-59v60M69 75h58m-58 54h48" fill="none" stroke="#b9a276" stroke-width=".7"/>' +
      '<path d="M48 55h104v9H48Zm0 78h104v9H48Z" fill="url(#@wood)" stroke="#69513a" stroke-width="1.2"/>' +
      '<g fill="url(#@brass)" stroke="#786440" stroke-width=".8"><path d="M44 53h7v13h-7Zm105 0h7v13h-7ZM44 137h7v13h-7Zm105 0h7v13h-7Z"/></g>' +
      '<path d="M60 50h78c15 0 15 21 0 21H60c-15 0-15-21 0-21Z" fill="url(#@paper)" stroke="#9d865f" stroke-width="1"/>' +
      '<path d="M60 54c9 0 9 13 0 13-6 0-7-10-1-10m14 0h55m-56 6h55m11-9c9 0 9 13 0 13" fill="none" stroke="#a48e67" stroke-width="1"/>' +
      '<path d="M60 133h78c15 0 15 22 0 22H60c-15 0-15-22 0-22Z" fill="url(#@paper)" stroke="#9d865f" stroke-width="1"/>' +
      '<path d="M60 137c9 0 9 14 0 14-7 0-7-11-1-11m14 0h55m-56 6h55m11-9c9 0 9 14 0 14" fill="none" stroke="#a48e67" stroke-width="1"/>' +
      '<path d="M73 82v9h7v-7h-8m14-2v9m-3-5h7M74 98h13m-10-3v10m7-10-8 9m-3 9h13m-10-3v9m7-9v9m-11 5h16" fill="none" stroke="#526353" stroke-width="1.3"/>' +
      '<path d="M116 80c-12-7-26 3-22 16 4 13 22 13 27 2 4-9-5-17-12-12-7 5-2 14 4 11m-15 17h20m-16 5h14" fill="none" stroke="#607461" stroke-width="1.5"/>' +
      '<path d="M55 108q40 6 89 0m-88 4q44 5 87-1" fill="none" stroke="#376e62" stroke-width="2.8"/>' +
      '<path d="M56 107q41 5 88 0m-62 7q16-16 36-4m-34 8q14-5 34-5" fill="none" stroke="#a3cfb4" stroke-width=".8"/>' +
      '<path d="M126 117c-17-13-25-6-14 0 8 4 18-5 22-10 6-6 10-2 6 3-4 5-10 7-14 7Zm0 0-6 24m7-23 12 19" fill="none" stroke="#376e62" stroke-width="2.6"/>' +
      '<path d="m124 124-6 23 10-5 5 6 1-24" fill="#973e33" stroke="#713e32" stroke-width=".8"/>' +
      '<path d="M128 108l5 1 4 4 1 6-3 5-5 2-6-1-4-3-1-6 3-5Z" fill="#b74b3b" stroke="#7e3e32" stroke-width="1.2"/>' +
      '<circle cx="128" cy="117" r="6.7" fill="none" stroke="#df9465" stroke-width=".9"/><path d="M125 113v8m6-8v8m-8-5h10m-8 4h6" fill="none" stroke="#edba86" stroke-width="1.1"/>' +
      '<path d="m67 78 3 1m63 18-3 1m-61 26 4-1m49 5 5-1m-63-59 3 1" fill="none" stroke="#ad996f" stroke-width=".7"/></g>',
    clocktower:
      '<g transform="rotate(-5 100 100)">' +
      '<path d="M58 60h84v83H58Z" fill="url(#@paper)"/>' +
      '<path d="M52 54h96v15H52Zm0 84h96v15H52Z" fill="url(#@wood)"/>' +
      '<path d="M57 57h86m-86 6h86m-86 78h86m-86 6h86" fill="none" stroke="#d6b47d" stroke-width=".8"/>' +
      '<path d="M52 52v20m96-20v20M52 136v20m96-20v20" fill="none" stroke="#604e35" stroke-width="3"/>' +
      '<path d="M70 72v61h61V72Zm0 19h61m-61 20h61m-41-39v61m20-61v61" fill="none" stroke="#8e8765" stroke-width=".9"/>' +
      '<path d="M78 66v13m43-13v13" fill="none" stroke="#485c4d" stroke-width="3"/>' +
      '<g stroke-width=".6" fill="#67785e"><path d="M78 81h4m16 0h4m16 0h4M78 101h4m16 0h4m16 0h4M78 122h4m36 0h4"/></g>' +
      '<circle cx="101" cy="122" r="7.5" fill="url(#@seal)" stroke="#855037" stroke-width="1"/>' +
      '<path d="m98 122 2 2 4-5" fill="none" stroke="#edddae" stroke-width="1.3"/>' +
      '<path d="M55 94q-14 12-2 23m0-23q14 12 0 23" fill="none" stroke="#856342" stroke-width="1.3"/>' +
      '<path d="m136 94 11-3 6 20-11 3Z" fill="url(#@paper)" stroke-width="1"/><path d="m141 99 5-1m-4 6 5-1" fill="none" stroke="#96563c" stroke-width="1.2"/></g>',
    treasure:
      '<path d="m86 130-9 30 14-7 8 10 6-27m17-8 17 29 2-12 14 1-19-23" fill="url(#@cloth)"/>' +
      '<path d="m91 138-7 19m45-20 10 15" fill="none" stroke="#a9b098" stroke-width="1"/>' +
      '<circle cx="99" cy="95" r="46" fill="url(#@brass)" stroke="#746442" stroke-width="2"/>' +
      '<circle cx="99" cy="95" r="39" fill="none" stroke="#f0dfaa" stroke-width="1.2"/>' +
      '<path d="M99 51v6m22-1-3 5m19 11-5 3m10 20h-6m1 22-5-3m-11 19-3-5m-19 10v-6m-22 1 3-5m-19-11 5-3m-10-19h6m-1-22 5 3m11-19 3 5" fill="none" stroke="#837348" stroke-width="1.4"/>' +
      '<path d="m99 64 27 16v31l-27 16-27-16V80Z" fill="none" stroke="#786c44" stroke-width="1.2"/>' +
      '<path d="M97 74v42m11-32H92c-12 0-13 13-2 13h13c11 0 10 13-2 13H86" fill="none" stroke="#3e5643" stroke-width="3.2"/>' +
      '<path d="M81 82v24m36-24v24M87 69l4-2m20 56 4-3m-43-17 4 2" fill="none" stroke="#f0dfa9" stroke-width=".8"/>' +
      '<path d="M57 114q3 17 18 23l18 4" fill="none" stroke="#8e573d" stroke-width="3"/>' +
      '<circle cx="126" cy="132" r="12" fill="url(#@seal)" stroke="#7f5139"/><path d="M120 132h12m-6-6v12m-4-10 8 8m0-8-8 8" fill="none" stroke="#edc995" stroke-width="1.1"/>',
    shipyard:
      '<path d="M60 59q31-18 78 8m-83 53q21 27 64 27" fill="none" stroke="#9f9876" stroke-width=".8"/>' +
      '<g transform="rotate(-38 100 100)">' +
      '<circle cx="100" cy="155" r="10" fill="none" stroke="#526c5b" stroke-width="4"/><circle cx="100" cy="155" r="7" fill="none" stroke="#d4dec8" stroke-width="1"/>' +
      '<path d="M94 110h12v37H94Z" fill="url(#@cloth)"/><path d="m94 116 12 5m-12 2 12 5m-12 2 12 5m-12 2 12 5" fill="none" stroke="#a1b29b" stroke-width="1.8"/>' +
      '<path d="m100 38-17 53 10 21h14l10-21Z" fill="url(#@steel)" stroke-width="1.6"/><path d="M100 43v66l-14-19Z" fill="#d6e0cf" stroke="none"/><path d="m100 43 1 44 13 5m-14-4-7 20" fill="none" stroke="#738879" stroke-width=".8"/>' +
      '<path d="M89 111h22v4H89Z" fill="url(#@brass)" stroke-width="1"/></g>' +
      '<g transform="rotate(38 100 100)">' +
      '<circle cx="100" cy="155" r="10" fill="none" stroke="#526c5b" stroke-width="4"/><circle cx="100" cy="155" r="7" fill="none" stroke="#d4dec8" stroke-width="1"/>' +
      '<path d="M94 110h12v37H94Z" fill="url(#@cloth)"/><path d="m94 116 12 5m-12 2 12 5m-12 2 12 5m-12 2 12 5" fill="none" stroke="#a1b29b" stroke-width="1.8"/>' +
      '<path d="m100 38-17 53 10 21h14l10-21Z" fill="url(#@steel)" stroke-width="1.6"/><path d="M100 43v66l-14-19Z" fill="#d6e0cf" stroke="none"/><path d="m100 43 1 44 13 5m-14-4-7 20" fill="none" stroke="#738879" stroke-width=".8"/>' +
      '<path d="M89 111h22v4H89Z" fill="url(#@brass)" stroke-width="1"/></g>' +
      '<path d="m82 86-6 5 6 5m36-10 6 5-6 5m-13-15-10 21" fill="none" stroke="#3b5549" stroke-width="2.2"/>',
    checker:
      '<g transform="rotate(-7 100 100)">' +
      '<path d="M51 52h98v96H51Z" fill="url(#@steel)" stroke-width="1.6"/><path d="M56 57h88v86H56Z" fill="url(#@paper)" stroke-width=".8"/>' +
      '<g fill="url(#@cloth)" stroke-width="1"><path d="M63 64h21v21H63Zm57 0h17v17h-17Zm-57 58h21v14H63Z"/><path d="M68 69h11v11H68Zm57 0h7v7h-7Zm-57 57h11v6H68Z" fill="url(#@paper)"/></g>' +
      '<path d="M63 93h8v8h-8Zm14 0h7v7h-7Zm-14 15h8v8h-8Zm15-4h7v9h-7ZM93 64h7v7h-7Zm13 0h6v13h-6Zm-13 14h8v6h-8Z" fill="#56694f" stroke="none"/>' +
      '<path d="m110 82 6 18 21 6-19 8-8 20-6-21-20-7 20-6Z" fill="url(#@steel)" stroke="#385344" stroke-width="1.5"/>' +
      '<path d="m110 85-1 22 9 7m-12-11-18 3m23 5-1 18m6-25 16 2" fill="none" stroke="#e1e7cf" stroke-width="1"/>' +
      '<circle cx="110" cy="107" r="5" fill="#496052" stroke="#a6b6a0" stroke-width="1.1"/>' +
      '<path d="M93 128h7v7h-7m26-4h6v5h-6m12-10h6v6h-6M53 57h3m86 0h3m-92 84h3m86 0h3" fill="none" stroke="#707b5c" stroke-width="1"/>' +
      '<path d="m53 89-11 6 3 13 10-3" fill="url(#@cloth)"/><path d="m48 94 2 7" fill="none" stroke="#b7c1a4" stroke-width="1.2"/></g>'
  };
  var missionArtId = 0;
  function missionSVG(seed, accentVar, landmark) {
    var marks = '', turn = seed % 12, id = 'mission-art-' + (++missionArtId) + '-';
    for (var i = 0; i < 12; i++) marks += '<path d="M100 17v7" transform="rotate(' + (i * 30 + turn) + ' 100 100)"/>';
    return '<svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">' +
      '<defs>' +
      '<linearGradient id="' + id + 'steel" x1="0" y1="0" x2=".85" y2="1"><stop stop-color="#e9eee2"/><stop offset=".33" stop-color="#b8c7bc"/><stop offset=".55" stop-color="#7c9287"/><stop offset=".78" stop-color="#cbd6c8"/><stop offset="1" stop-color="#a0b0a3"/></linearGradient>' +
      '<linearGradient id="' + id + 'paper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f5e9c9"/><stop offset=".6" stop-color="#e7d7ad"/><stop offset="1" stop-color="#c9b88e"/></linearGradient>' +
      '<linearGradient id="' + id + 'wood"><stop stop-color="#66523a"/><stop offset=".35" stop-color="#b28754"/><stop offset=".7" stop-color="#a17143"/><stop offset="1" stop-color="#624d33"/></linearGradient>' +
      '<linearGradient id="' + id + 'cloth" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#253b35"/><stop offset=".5" stop-color="#42584c"/><stop offset="1" stop-color="#1f322d"/></linearGradient>' +
      '<linearGradient id="' + id + 'seal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#cd794c"/><stop offset="1" stop-color="#9c4b33"/></linearGradient>' +
      '<linearGradient id="' + id + 'brass" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#ecd798"/><stop offset=".45" stop-color="#b4985e"/><stop offset=".7" stop-color="#e2ca8b"/><stop offset="1" stop-color="#977642"/></linearGradient>' +
      '<radialGradient id="' + id + 'lens" cx=".38" cy=".3" r=".8"><stop stop-color="#d99164"/><stop offset=".5" stop-color="#b66648"/><stop offset="1" stop-color="#824737"/></radialGradient>' +
      '<radialGradient id="' + id + 'chakra" cx=".39" cy=".35" r=".7"><stop stop-color="#d7e8ce"/><stop offset=".4" stop-color="#8fbea9"/><stop offset=".75" stop-color="#4b8577"/><stop offset="1" stop-color="#315a52"/></radialGradient></defs>' +
      '<circle cx="100" cy="100" r="88" fill="none" stroke="var(--text)" stroke-width=".75" opacity=".28"/>' +
      '<g fill="none" stroke="var(' + accentVar + ')" stroke-width="2" opacity=".5">' + marks + '</g>' +
      '<circle cx="100" cy="100" r="72" fill="url(#' + id + 'paper)" stroke="var(' + accentVar + ')" stroke-width="1.2"/>' +
      '<circle cx="100" cy="100" r="66" fill="none" stroke="#b6a985" stroke-width=".7" opacity=".55"/>' +
      '<path d="M60 48l6-2M136 147l7-3M47 133l5 2M148 61l6 2m-91 88 6 2m90-75 2 5M94 38l5-1m-61 73 1 5" fill="none" stroke="#a69571" stroke-width=".7" opacity=".55"/>' +
      '<g stroke="#435747" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      (EMBLEMS[landmark] || EMBLEMS.lighthouse).replace(/@/g, id) + '</g></svg>';
  }
  $$('.isle__art').forEach(function (el) {
    var seed = parseInt(el.getAttribute('data-seed'), 10) || 1;
    var accent = el.getAttribute('data-flag') === 'proj' ? '--flag-proj' : '--flag-exp';
    el.insertAdjacentHTML('afterbegin', missionSVG(seed, accent, el.getAttribute('data-landmark')));
  });

  /* ------------------------------------------------------------ seals */
  // Existing category values and fruit IDs are kept for incoming links.
  var TECHNIQUES = {
    languages: { name: 'Languages', blurb: 'A language I write in.' },
    frameworks: { name: 'Frameworks', blurb: 'A framework I shape things with.' },
    infrastructure: { name: 'Cloud and infrastructure', blurb: 'Infrastructure I run on.' }
  };
  // [seal icon, hue, saturation, name, capability]
  var SPEC = {
    'C':              ['memory', 135, 30, 'Memory Control', 'Direct control over memory, down to the last pointer.'],
    'C++':            ['precision', 25, 65, 'Template Craft', 'Memory control with classes and templates.'],
    'Python':         ['automation', 145, 40, 'Automation', 'Readable scripts that automate work and transform data.'],
    'JavaScript':     ['spark', 38, 85, 'Interaction', 'Brings pages to life and powers the interactions on this site.'],
    'TypeScript':     ['precision', 165, 34, 'Type Guard', 'Keeps code predictable with explicit types.'],
    'SQL':            ['archive', 26, 60, 'Data Retrieval', 'Retrieves exactly the rows a query asks for.'],
    'React':          ['react', 165, 40, 'State Flow', 'Interfaces that re-render when their state changes.'],
    'Grafana Scenes': ['insight', 30, 75, 'Telemetry Insight', 'Turns raw telemetry into dashboards anyone can read.'],
    'Flutter':        ['wind', 150, 45, 'Cross Platform', 'One codebase for interfaces on multiple platforms.'],
    'Pandas':         ['table', 130, 22, 'Data Shaping', 'Wrangles tables into shape.'],
    'Matplotlib':     ['chart', 140, 40, 'Chart Drawing', 'Draws datasets as charts.'],
    'Kubernetes':     ['orchestration', 130, 35, 'Orchestration', 'Coordinates deployments across clusters of containers.'],
    'Docker':         ['container', 155, 38, 'Container Sealing', 'Packages applications so they run consistently.'],
    'AWS EKS':        ['cloud', 35, 75, 'Cloud Summoning', 'Runs Kubernetes clusters in the cloud.'],
    'OpenTelemetry':  ['insight', 125, 34, 'Service Sensing', 'Collects traces, metrics and logs from services.']
  };
  var SEAL_ICONS = {
    memory: '<rect x="32" y="39" width="36" height="36" rx="3"/><path d="M41 48h18v18H41ZM25 46h7M25 57h7M25 68h7M68 46h7M68 57h7M68 68h7M39 32v7M50 32v7M61 32v7M39 75v7M50 75v7M61 75v7"/>',
    precision: '<path d="M50 30L70 51L50 84L30 51ZM50 30V84M30 51h40M38 43L62 67M62 43L38 67"/>',
    automation: '<path d="M29 43h39v30H29ZM34 49h17M34 57h26M34 65h21M69 42l8 8-8 8M76 51v12q0 18-18 18M59 76l-8 5 8 5"/>',
    spark: '<path d="M58 29L34 59H48L41 85L70 49H55ZM28 37l7 7M72 74l7 7M24 65h9M70 34h9"/>',
    archive: '<path d="M31 44q19-14 38 0v30q-19 14-38 0ZM31 44q19 14 38 0M31 54q19 14 38 0M31 64q19 14 38 0"/>',
    react: '<circle cx="50" cy="58" r="4"/><ellipse cx="50" cy="58" rx="27" ry="10"/><ellipse cx="50" cy="58" rx="27" ry="10" transform="rotate(60 50 58)"/><ellipse cx="50" cy="58" rx="27" ry="10" transform="rotate(120 50 58)"/>',
    insight: '<path d="M22 58Q50 28 78 58Q50 88 22 58Z"/><circle cx="50" cy="58" r="11"/><circle cx="50" cy="58" r="3"/><path d="M50 27v7M28 34l5 5M72 34l-5 5M50 82v7"/>',
    wind: '<path d="M23 46h44q15 0 10-10-5-7-11 0M23 57h35q17 0 18 11 1 9-8 10M28 69h18q10 0 7 10M33 36h13"/>',
    table: '<rect x="28" y="35" width="44" height="46" rx="3"/><path d="M28 47h44M28 59h44M28 71h44M42 47v34M58 47v34"/>',
    chart: '<path d="M27 32v49h48M37 68l12-16 11 7 12-22M36 75V64M48 75V57M60 75V65M72 75V45"/>',
    orchestration: '<circle cx="50" cy="58" r="19"/><circle cx="50" cy="58" r="7"/><path d="M50 30v16M50 70v16M22 58h16M62 58h16M30 38l11 11M59 67l11 11M30 78l11-11M59 49l11-11"/>',
    container: '<path d="M29 44L50 33L71 44V72L50 84L29 72ZM29 44L50 57L71 44M50 57V84M40 39L61 51M50 64l10-6"/>',
    cloud: '<path d="M30 65c-16-4-11-25 3-24 6-18 31-13 31 5 18-2 23 24 5 25H36M37 80h26M44 71v9M56 71v9"/>'
  };
  function hsl(h, s, l, a) { return 'hsl(' + h + ' ' + s + '% ' + l + '%' + (a !== undefined ? ' / ' + a : '') + ')'; }
  function skillSVG(name, type) {
    var sp = SPEC[name] || ['precision', 140, 35, '', ''], ticks = '';
    var angle = hash(name) % 12, color = hsl(sp[1], Math.min(sp[2], 36), 31);
    var id = 'technique-' + hash(name);
    for (var i = 0; i < 8; i++) ticks += '<path d="M50 15v4M47 16h6" transform="rotate(' + (i * 45 + angle) + ' 50 56)"/>';
    var boundary = type === 'languages'
      ? '<circle cx="50" cy="56" r="34"/>'
      : type === 'frameworks'
        ? '<path d="M50 19L76 30L86 56L76 82L50 93L24 82L14 56L24 30Z"/>'
        : '<path d="M50 17L89 56L50 95L11 56Z"/>';
    return '<svg viewBox="0 0 100 110" aria-hidden="true" focusable="false">' +
      '<defs><linearGradient id="' + id + '-paper" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#f5eccf"/><stop offset=".6" stop-color="#e6d7b4"/><stop offset="1" stop-color="#c4b28c"/></linearGradient></defs>' +
      '<circle cx="51" cy="58" r="44" fill="#293a30" opacity=".14" stroke="none"/>' +
      '<circle cx="50" cy="56" r="44" fill="url(#' + id + '-paper)" stroke="' + color + '" stroke-width="1"/>' +
      '<circle cx="50" cy="56" r="41.5" fill="none" stroke="#f7edce" stroke-width="1"/>' +
      '<path d="M20 39l3-2M76 73l4-2M31 87l4 1M63 23l3 1M22 73h3M70 31h4" fill="none" stroke="#a39470" stroke-width=".6" opacity=".5"/>' +
      '<g fill="none" stroke="' + color + '" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity=".65">' +
      ticks + boundary + '</g><circle cx="50" cy="56" r="28" fill="#fbf1d9" opacity=".18" stroke="none"/>' +
      '<g fill="none" stroke="' + color + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      (SEAL_ICONS[sp[0]] || SEAL_ICONS.precision) + '</g>' +
      '<path d="M40 94h5M47 94h2M51 94h3M56 94h4" fill="none" stroke="' + color + '" stroke-width="1" opacity=".6"/></svg>';
  }
  $$('.fruits').forEach(function (list) {
    var type = list.getAttribute('data-type'), group = TECHNIQUES[type];
    $$('.fruit', list).forEach(function (btn) {
      var name = btn.textContent.trim(), used = btn.getAttribute('data-used'), sp = SPEC[name] || [];
      var target = { 'Fidelity Investments': '#isle-fidelity', 'Cryptocurrency Investment App': '#isle-crypto', 'QR Code Generator': '#isle-qr', 'UMass Lowell': '#isle-uml' }[used] || (used && used.indexOf('Homework') === 0 ? '#isle-homework' : '');
      var capability = name + ' ' + (sp[3] || '');
      var tip = '<b>' + capability + '</b>' + group.name + '. ' + (sp[4] || group.blurb) +
        (used ? '<i>Used at: ' + used + (target ? '. Open the mission record.' : '') + '</i>' : '');
      btn.id = 'fruit-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      if (target) btn.setAttribute('data-target', target);
      btn.innerHTML = skillSVG(name, type) + '<span class="fruit__name">' + name + '</span>' +
        (sp[3] ? '<span class="fruit__mi">' + sp[3] + '</span>' : '') + '<span class="fruit__tip" role="tooltip">' + tip + '</span>';
      btn.setAttribute('aria-label', capability + ', ' + group.name + (used ? ', used at ' + used : '') + (target ? '. Activate to open the work record.' : ''));
    });
  });
  /* ------------------------------------------------------------ mission navigation */
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
    var original = btn.innerHTML, confirmationTimer = null;
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      var ok = function () {
        clearTimeout(confirmationTimer);
        btn.classList.add('is-copied');
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg><span>Copied</span>';
        say(btn.getAttribute('data-done'));
        confirmationTimer = setTimeout(function () { btn.innerHTML = original; btn.classList.remove('is-copied'); }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, function () { say('Copy failed. Select the text instead.'); });
      else say('Copy failed. Select the text instead.');
    });
  });

  /* ability activation controller */
  function createAbilityEffects(dom, preference) {
    var active = null, activeButton = null, timer = null, ns = 'http://www.w3.org/2000/svg';
    var names = { clarity: 'Clarity', insight: 'Insight', stillness: 'Stillness' };
    var captions = { clarity: 'Measurable results, clearly visible', insight: 'The detail behind the work', stillness: 'Pause and review the highlights' };
    function clear() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      if (active) active.remove();
      active = null;
      if (activeButton && activeButton.classList) activeButton.classList.remove('ability-transforming');
      activeButton = null;
    }
    function play(button, ability, host) {
      clear();
      if (preference.matches || dom.hidden || !names[ability]) return;
      var source = button && (button.querySelector('svg[data-awakened]') || button.querySelector('svg'));
      if (!source) return;
      var fx = dom.createElement('div');
      fx.className = 'ability-fx ability-fx--' + ability;
      fx.setAttribute('aria-hidden', 'true');
      fx.setAttribute('inert', '');
      var dock = dom.querySelector('.dock__in');
      if (dock) fx.style.setProperty('--ability-bottom', (dock.getBoundingClientRect().height + 26) + 'px');
      var eye = dom.createElement('div'), svg = source.cloneNode(true), normal = dom.createElementNS(ns, 'svg');
      eye.className = 'ability-fx__eye';
      normal.setAttribute('class', 'ability-eye--normal');
      normal.setAttribute('viewBox', '0 0 32 24');
      normal.innerHTML = '<path d="M2 12Q7.5 5 16 5Q24.5 5 30 12Q24.5 19 16 19Q7.5 19 2 12Z" fill="#fff8ef" stroke="#49372d" stroke-width="1.1"/><circle cx="16" cy="12" r="6" fill="#5899c4" stroke="#285b83" stroke-width=".9"/><circle cx="16" cy="12" r="4.1" fill="#78b3d9"/><circle cx="16" cy="12" r="2.3" fill="#1d2938"/><circle cx="14.5" cy="10" r=".9" fill="#f8fdff" opacity=".85"/>';
      svg.setAttribute('class', 'ability-eye--awakened');
      var iris = dom.createElementNS(ns, 'g');
      iris.setAttribute('class', 'ability-iris');
      Array.prototype.slice.call(svg.children).forEach(function (node) {
        if (/^(circle|g|rect)$/i.test(node.tagName)) iris.appendChild(node);
      });
      svg.appendChild(iris);
      eye.appendChild(normal); eye.appendChild(svg); fx.appendChild(eye);
      var label = dom.createElement('span'), caption = dom.createElement('small');
      label.className = 'ability-fx__label'; label.textContent = names[ability];
      caption.className = 'ability-fx__caption'; caption.textContent = captions[ability];
      fx.appendChild(label); fx.appendChild(caption);
      (host || dom.body).appendChild(fx);
      active = fx; activeButton = button;
      if (button.classList) button.classList.add('ability-transforming');
      timer = setTimeout(clear, 1600);
    }
    dom.addEventListener('visibilitychange', function () { if (dom.hidden) clear(); });
    function changed() { if (preference.matches) clear(); }
    if (preference.addEventListener) preference.addEventListener('change', changed);
    else if (preference.addListener) preference.addListener(changed);
    return { play: play, clear: clear, name: function (key) { return names[key] || key; } };
  }
  /* end ability activation controller */

  /* ------------------------------------------------------------ record details and reading modes */
  var logs = $$('.log'), armBtn = $('#hakiArm'), activeReadingMode = null;
  var closeConqueror = function () {};
  function setHard(log, on) {
    log.classList.toggle('is-hard', on);
    var button = $('.harden', log);
    if (button) {
      button.setAttribute('aria-expanded', on ? 'true' : 'false');
      $('span', button).textContent = on ? 'Close details' : 'Reveal details';
    }
  }
  logs.forEach(function (log) {
    var button = $('.harden', log);
    if (!button) return;
    button.addEventListener('click', function () {
      setHard(log, !log.classList.contains('is-hard'));
      if (activeReadingMode === 'insight' && !logs.every(function (record) { return record.classList.contains('is-hard'); })) {
        setReadingMode(null, true);
        if (abilityEffects) abilityEffects.clear();
      }
    });
  });
  var obsBtn = $('#hakiObs'), conqBtn = $('#hakiConq');
  function setReadingMode(next, keepDetails) {
    var previous = activeReadingMode;
    activeReadingMode = next;
    [
      { name: 'clarity', className: 'haki-obs', button: obsBtn },
      { name: 'insight', className: 'haki-arm', button: armBtn },
      { name: 'stillness', className: 'haki-stillness', button: conqBtn }
    ].forEach(function (mode) {
      var selected = mode.name === next;
      doc.classList.toggle(mode.className, selected);
      if (mode.button) mode.button.setAttribute('aria-pressed', String(selected));
    });
    if (previous === 'insight' && next !== 'insight' && !keepDetails) {
      logs.forEach(function (log) { setHard(log, false); });
    }
  }
  if (obsBtn && armBtn && conqBtn) {
    var abilityEffects = createAbilityEffects(document, reduceMotion);
    var conq = $('#conq'), restoreConqFocus = true;
    function leaveOverview(button) {
      if (!conq || !conq.open) return;
      restoreConqFocus = false;
      closeConqueror();
      button.focus();
    }
    obsBtn.addEventListener('click', function () {
      var on = activeReadingMode !== 'clarity';
      leaveOverview(obsBtn);
      setReadingMode(on ? 'clarity' : null);
      if (on) abilityEffects.play(obsBtn, 'clarity'); else abilityEffects.clear();
      say(on ? 'Numbers revealed' : 'Number highlights off');
    });
    armBtn.addEventListener('click', function () {
      var on = activeReadingMode !== 'insight';
      leaveOverview(armBtn);
      setReadingMode(on ? 'insight' : null);
      logs.forEach(function (log) { setHard(log, on); });
      if (on) abilityEffects.play(armBtn, 'insight'); else abilityEffects.clear();
      say(on ? 'Supporting details revealed' : 'Supporting details closed');
    });
    function openOverview() {
      if (!conq || conq.open) return;
      restoreConqFocus = true;
      setReadingMode('stillness');
      if (typeof conq.showModal === 'function') conq.showModal(); else conq.setAttribute('open', '');
      abilityEffects.play(conqBtn, 'stillness', conq);
    }
    closeConqueror = function (event) {
      if (!conq || !conq.open) return;
      if (event && event.currentTarget && event.currentTarget.tagName.toLowerCase() === 'a') restoreConqFocus = false;
      abilityEffects.clear();
      if (activeReadingMode === 'stillness') setReadingMode(null);
      if (typeof conq.close === 'function') conq.close(); else conq.removeAttribute('open');
    };
    if (conq) {
      conq.addEventListener('cancel', function () {
        abilityEffects.clear();
        if (activeReadingMode === 'stillness') setReadingMode(null);
      });
      conq.addEventListener('close', function () {
        if (conq.open) return;
        if (activeReadingMode === 'stillness') { abilityEffects.clear(); setReadingMode(null); }
        if (restoreConqFocus) conqBtn.focus();
        restoreConqFocus = true;
      });
      $$('[data-close]', conq).forEach(function (button) { button.addEventListener('click', closeConqueror); });
      conq.addEventListener('click', function (event) {
        if (event.target === conq || event.target.classList.contains('conq__wrap')) closeConqueror();
      });
    }
    conqBtn.addEventListener('click', function () { if (conq && conq.open) closeConqueror(); else openOverview(); });
    document.addEventListener('keydown', function (event) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.target.isContentEditable || /^(input|textarea|select)$/i.test(event.target.tagName || '')) return;
      var key = (event.key || '').toLowerCase();
      if (key === 'o') obsBtn.click();
      else if (key === 'a') armBtn.click();
      else if (key === 'c') conqBtn.click();
    });
  }
  /* ------------------------------------------------------------ native screenshot viewer */
  $$('.spy__strip').forEach(function (strip) {
    var figures = $$('figure', strip);
    if (!figures.length) return;

    function part(tag, className) {
      var node = document.createElement(tag);
      node.className = className;
      return node;
    }
    var gallery = part('div', 'viewer');
    gallery.tabIndex = 0;
    gallery.setAttribute('role', 'region');
    gallery.setAttribute('aria-roledescription', 'carousel');
    gallery.setAttribute('aria-label', (strip.getAttribute('aria-label') || 'Screenshots').replace(/, scroll sideways$/, ''));
    var stage = part('div', 'viewer__stage');
    var side = part('div', 'viewer__side');
    var caption = part('p', 'viewer__cap');
    caption.setAttribute('aria-live', 'polite');
    caption.setAttribute('aria-atomic', 'true');
    var navigation = part('div', 'viewer__nav');
    navigation.setAttribute('role', 'group');
    navigation.setAttribute('aria-label', 'Screenshot navigation');
    var dots = part('span', 'viewer__dots');
    var count = part('span', 'viewer__count');
    var selected = -1;
    var slides = figures.map(function (figure, index) {
      var sourceCaption = $('figcaption', figure);
      var text = sourceCaption ? sourceCaption.innerHTML : '';
      if (sourceCaption) sourceCaption.remove();
      figure.hidden = true;
      figure.setAttribute('aria-hidden', 'true');
      stage.appendChild(figure);
      var dot = part('button', 'viewer__dot');
      dot.type = 'button';
      dot.setAttribute('aria-label', 'Show screenshot ' + (index + 1));
      dot.setAttribute('aria-current', 'false');
      dot.addEventListener('click', function () { selectScreenshot(index, index > selected ? 1 : -1); });
      dots.appendChild(dot);
      figure.addEventListener('animationend', function () { figure.classList.remove('from-left', 'from-right'); });
      return { figure: figure, caption: text, dot: dot };
    });

    function selectScreenshot(index, direction) {
      var destination = ((index % slides.length) + slides.length) % slides.length;
      if (destination === selected) return;
      if (selected >= 0) {
        var outgoing = slides[selected];
        outgoing.figure.hidden = true;
        outgoing.figure.classList.remove('is-on', 'from-left', 'from-right');
        outgoing.figure.setAttribute('aria-hidden', 'true');
        outgoing.dot.setAttribute('aria-current', 'false');
      }
      selected = destination;
      var current = slides[selected];
      current.figure.hidden = false;
      current.figure.classList.add('is-on');
      current.figure.setAttribute('aria-hidden', 'false');
      current.dot.setAttribute('aria-current', 'true');
      caption.innerHTML = current.caption;
      count.textContent = (selected + 1) + ' / ' + slides.length;
      if (direction && !reduceMotion.matches) current.figure.classList.add(direction > 0 ? 'from-right' : 'from-left');
    }
    function arrow(direction) {
      var button = part('button', 'viewer__btn' + (direction > 0 ? ' viewer__btn--next' : ''));
      button.type = 'button';
      button.setAttribute('aria-label', direction > 0 ? 'Next screenshot' : 'Previous screenshot');
      var shape = direction > 0 ? 'M10 6l6 6-6 6' : 'M14 6l-6 6 6 6';
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + shape + '" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      button.addEventListener('click', function () { selectScreenshot(selected + direction, direction); });
      return button;
    }
    navigation.appendChild(arrow(-1));
    navigation.appendChild(dots);
    navigation.appendChild(count);
    navigation.appendChild(arrow(1));
    gallery.addEventListener('keydown', function (event) {
      var direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!direction || event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      selectScreenshot(selected + direction, direction);
    });

    var gesture = null;
    stage.addEventListener('pointerdown', function (event) {
      if (event.isPrimary === false || event.button !== 0) return;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
      stage.setPointerCapture(event.pointerId);
    });
    stage.addEventListener('pointerup', function (event) {
      if (!gesture || gesture.id !== event.pointerId) return;
      var horizontal = event.clientX - gesture.x;
      var vertical = event.clientY - gesture.y;
      gesture = null;
      if (Math.abs(horizontal) < 45 || Math.abs(horizontal) < Math.abs(vertical) * 1.4) return;
      var direction = horizontal < 0 ? 1 : -1;
      selectScreenshot(selected + direction, direction);
    });
    function cancelGesture() { gesture = null; }
    stage.addEventListener('pointercancel', cancelGesture);
    stage.addEventListener('lostpointercapture', cancelGesture);
    stage.addEventListener('dragstart', function (event) { event.preventDefault(); });
    side.appendChild(caption);
    side.appendChild(navigation);
    gallery.appendChild(stage);
    gallery.appendChild(side);
    strip.replaceWith(gallery);
    selectScreenshot(0, 0);
  });

  /* ------------------------------------------------------------ clickable details */
  // Chakra links in the hero list press the matching dock button
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
    var t = $(sel);
    if (!t) {
      var id = sel.slice(1), file = id.indexOf('fruit-') === 0 ? 'skills.html' : id.indexOf('isle-') === 0 ? (['isle-fidelity', 'isle-rsm', 'isle-uml'].indexOf(id) >= 0 ? 'experience.html' : 'projects.html') : '';
      if (file) window.location.href = file + sel;
      return;
    }
    sailTo(t); flash(t);
  }

  // Tech chips on every card jump to the matching
  $$('.stack li').forEach(function (li) {
    var name = li.textContent.trim(), id = 'fruit-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    // The matching skill now lives on skills.html.
    if (!SPEC[name]) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = name;
    b.setAttribute('aria-label', name + ': see where this skill was used');
    b.addEventListener('click', function () { goTo('#' + id); });
    li.textContent = ''; li.appendChild(b); li.classList.add('has-chip');
  });
  // Techniques used on a mission open its record
  $$('.fruit[data-target]').forEach(function (f) {
    f.style.cursor = 'pointer';
    f.addEventListener('click', function () { goTo(f.getAttribute('data-target')); });
  });

  /* ------------------------------------------------------------ page entrance and text effects */
  var calm = reduceMotion.matches;

  // Text Effect: headings arrive word by word with a short transform reveal.
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
        // clear the entry classes once the reveal is done
        setTimeout(function () { e.target.classList.remove('inview', 'is-in'); }, 900);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
    rising.forEach(function (el) { vio.observe(el); });
    $$('.split').forEach(function (el) { vio.observe(el); });
    // the hero name is above the fold: play it straight away
    var hn = $('#hero-name'); if (hn) setTimeout(function () { hn.classList.add('is-in'); hn.classList.remove('is-armed'); }, 120);
  }

})();


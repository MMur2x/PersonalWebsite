/* ==========================================================================
   Mayne Murray — Portfolio behaviour
   Vanilla JS, no dependencies. Loaded with `defer` on every page.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----------------------------------------------------------------------
     Theme — applied inline in <head> to avoid a flash; this wires the toggle
     ---------------------------------------------------------------------- */
  function initTheme() {
    var btn = document.querySelector('.theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      btn.setAttribute('aria-label', 'Switch to ' + (next === 'dark' ? 'light' : 'dark') + ' mode');
    });
  }

  /* ----------------------------------------------------------------------
     Mobile navigation
     ---------------------------------------------------------------------- */
  function initBurger() {
    var burger = document.querySelector('.nav__burger');
    var links = document.querySelector('.nav__links');
    if (!burger || !links) return;

    burger.addEventListener('click', function () {
      var open = links.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
    });
    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        links.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ----------------------------------------------------------------------
     Sticky nav shadow + scroll progress bar
     ---------------------------------------------------------------------- */
  function initScrollChrome() {
    var nav = document.querySelector('.nav');
    var bar = document.querySelector('.progress');
    var top = document.querySelector('.to-top');
    var ticking = false;

    function update() {
      var y = window.scrollY || 0;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (nav) nav.classList.toggle('is-stuck', y > 8);
      if (bar) bar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
      if (top) top.classList.toggle('is-visible', y > 600);
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();

    if (top) {
      top.addEventListener('click', function () {
        if (reduceMotion) window.scrollTo(0, 0);
        else smoothScrollTo(0);
      });
    }
  }

  /* ----------------------------------------------------------------------
     Scroll reveal — staggered within each group
     ---------------------------------------------------------------------- */
  function initReveal() {
    var items = document.querySelectorAll('[data-reveal]');
    if (!items.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var siblings = Array.prototype.slice.call(el.parentNode.children).filter(function (n) {
          return n.hasAttribute && n.hasAttribute('data-reveal');
        });
        var i = Math.min(siblings.indexOf(el), 5);
        el.style.setProperty('--reveal-delay', (i * 90) + 'ms');
        el.classList.add('is-visible');
        io.unobserve(el);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -8% 0px' });

    items.forEach(function (el) { io.observe(el); });
  }

  /* ----------------------------------------------------------------------
     Section scrollspy for the anchor nav
     ---------------------------------------------------------------------- */
  function initScrollspy() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav__links a[href^="#"]'));
    if (!links.length || !('IntersectionObserver' in window)) return;

    var map = {};
    var sections = [];
    links.forEach(function (a) {
      var el = document.getElementById(a.getAttribute('href').slice(1));
      if (el) { map[el.id] = a; sections.push(el); }
    });
    if (!sections.length) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) { a.classList.remove('is-active'); });
        var active = map[entry.target.id];
        if (active) active.classList.add('is-active');
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    sections.forEach(function (s) { io.observe(s); });
  }

  /* ----------------------------------------------------------------------
     Animated stat counters
     ---------------------------------------------------------------------- */
  function initCounters() {
    var nums = document.querySelectorAll('[data-count]');
    if (!nums.length) return;

    function run(el) {
      var target = parseFloat(el.getAttribute('data-count'));
      var decimals = (el.getAttribute('data-decimals') | 0);
      var suffix = el.getAttribute('data-suffix') || '';
      var prefix = el.getAttribute('data-prefix') || '';

      if (reduceMotion) {
        el.textContent = prefix + target.toFixed(decimals) + suffix;
        return;
      }
      var start = performance.now();
      var dur = 1400;
      (function step(now) {
        var t = Math.min((now - start) / dur, 1);
        var eased = 1 - Math.pow(1 - t, 3);
        el.textContent = prefix + (target * eased).toFixed(decimals) + suffix;
        if (t < 1) requestAnimationFrame(step);
      })(start);
    }

    if (!('IntersectionObserver' in window)) {
      nums.forEach(run);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { run(entry.target); io.unobserve(entry.target); }
      });
    }, { threshold: 0.5 });
    nums.forEach(function (el) { io.observe(el); });
  }

  /* ----------------------------------------------------------------------
     Hero typing effect
     ---------------------------------------------------------------------- */
  function initTyped() {
    var el = document.querySelector('[data-typed]');
    if (!el) return;

    var words;
    try { words = JSON.parse(el.getAttribute('data-typed')); } catch (e) { return; }
    if (!Array.isArray(words) || !words.length) return;

    if (reduceMotion) { el.textContent = words[0]; return; }

    var w = 0, c = 0, deleting = false;
    (function tick() {
      var word = words[w];
      c += deleting ? -1 : 1;
      el.textContent = word.slice(0, c);

      var delay = deleting ? 45 : 85;
      if (!deleting && c === word.length) { deleting = true; delay = 1700; }
      else if (deleting && c === 0) { deleting = false; w = (w + 1) % words.length; delay = 350; }
      setTimeout(tick, delay);
    })();
  }

  /* ----------------------------------------------------------------------
     Copy-to-clipboard on contact rows
     ---------------------------------------------------------------------- */
  function initCopy() {
    document.querySelectorAll('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var text = btn.getAttribute('data-copy');
        var done = function () {
          var old = btn.textContent;
          btn.textContent = 'Copied';
          btn.classList.add('copied');
          setTimeout(function () { btn.textContent = old; btn.classList.remove('copied'); }, 1600);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(function () {});
        } else {
          var ta = document.createElement('textarea');
          ta.value = text; document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); done(); } catch (err) {}
          document.body.removeChild(ta);
        }
      });
    });
  }

  /* ----------------------------------------------------------------------
     Slow, eased anchor scrolling.
     The browser's native `scroll-behavior: smooth` has a fixed, fairly brisk
     duration. This replaces it for in-page links with a longer ease whose
     length scales with distance, so a jump across the whole page takes
     noticeably longer than a nudge to the next section.
     ---------------------------------------------------------------------- */
  var SCROLL_MIN = 700;   // ms, for a very short hop
  var SCROLL_MAX = 1900;  // ms, for a full-page jump

  function smoothScrollTo(targetY, done) {
    var startY = window.scrollY || window.pageYOffset;
    var delta = targetY - startY;
    if (Math.abs(delta) < 2) { if (done) done(); return; }

    var dur = Math.min(SCROLL_MAX, Math.max(SCROLL_MIN, Math.abs(delta) * 0.7));
    var start = performance.now();
    var cancelled = false;
    function onUser() { cancelled = true; }
    // Any real input from the visitor abandons the animation immediately —
    // never fight someone who has decided to scroll themselves.
    window.addEventListener('wheel', onUser, { passive: true, once: true });
    window.addEventListener('touchstart', onUser, { passive: true, once: true });
    window.addEventListener('keydown', onUser, { once: true });

    function step(now) {
      if (cancelled) return;
      var t = Math.min((now - start) / dur, 1);
      // easeInOutCubic
      var e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      window.scrollTo(0, startY + delta * e);
      if (t < 1) requestAnimationFrame(step);
      else {
        window.removeEventListener('wheel', onUser);
        window.removeEventListener('touchstart', onUser);
        window.removeEventListener('keydown', onUser);
        if (done) done();
      }
    }
    requestAnimationFrame(step);
  }

  function initSlowScroll() {
    if (reduceMotion) return;
    // Take over from CSS so the two don't both animate.
    root.style.scrollBehavior = 'auto';

    var navH = 74;
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      var id = a.getAttribute('href').slice(1);
      if (!id) return;
      var el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      var y = el.getBoundingClientRect().top + window.scrollY - navH;
      smoothScrollTo(y, function () {
        if (history.replaceState) history.replaceState(null, '', '#' + id);
      });
    });
  }

  /* ----------------------------------------------------------------------
     Magnetic buttons — the button leans toward the cursor while it's near
     ---------------------------------------------------------------------- */
  function initMagnetic() {
    if (reduceMotion || !window.matchMedia('(hover: hover)').matches) return;

    document.querySelectorAll('.btn--magnetic').forEach(function (el) {
      var raf = null, tx = 0, ty = 0, ts = 1, cx = 0, cy = 0, cs = 1;

      function render() {
        cx += (tx - cx) * 0.22;
        cy += (ty - cy) * 0.22;
        cs += (ts - cs) * 0.22;
        el.style.setProperty('--mx', cx.toFixed(2) + 'px');
        el.style.setProperty('--my', cy.toFixed(2) + 'px');
        el.style.setProperty('--ms', cs.toFixed(3));
        if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1 || Math.abs(ts - cs) > 0.002) {
          raf = requestAnimationFrame(render);
        } else { raf = null; }
      }
      function kick() { if (!raf) raf = requestAnimationFrame(render); }

      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        // Pull is proportional to distance from centre, capped at ~35% of size.
        tx = ((e.clientX - (r.left + r.width / 2)) / r.width) * r.width * 0.34;
        ty = ((e.clientY - (r.top + r.height / 2)) / r.height) * r.height * 0.48;
        ts = 1.045;
        el.classList.add('is-pulling');
        kick();
      });

      el.addEventListener('mouseleave', function () {
        tx = 0; ty = 0; ts = 1;
        el.classList.remove('is-pulling');
        kick();
      });
    });
  }

  /* ----------------------------------------------------------------------
     Card tilt — a couple of degrees, no more
     ---------------------------------------------------------------------- */
  function initTilt() {
    if (reduceMotion || !window.matchMedia('(hover: hover)').matches) return;

    document.querySelectorAll('.card--tilt').forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        el.classList.add('is-tilting');
        el.style.setProperty('--ry', (px * 5).toFixed(2) + 'deg');
        el.style.setProperty('--rx', (-py * 5).toFixed(2) + 'deg');
        el.style.setProperty('--ty', '-5px');
      });
      el.addEventListener('mouseleave', function () {
        el.classList.remove('is-tilting');
        el.style.setProperty('--ry', '0deg');
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ty', '0px');
      });
    });
  }

  /* ----------------------------------------------------------------------
     Cross-page transitions.
     Uses the View Transitions API where the browser has it, and falls back
     to fading a full-screen veil. Either way navigation still works with
     JS disabled, because we only ever intercept a plain left-click.
     ---------------------------------------------------------------------- */
  function initPageTransitions() {
    var veil = document.querySelector('.page-veil');
    root.classList.add('js-ready');

    // Lift the veil once the page is painted.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { if (veil) veil.classList.add('is-lifted'); });
    });

    // Coming back via the bfcache should not leave the veil down.
    window.addEventListener('pageshow', function (e) {
      if (e.persisted && veil) {
        veil.classList.remove('is-closing');
        veil.classList.add('is-lifted');
      }
    });

    if (reduceMotion || !veil) return;

    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a');
      if (!a) return;
      // Only same-origin .html navigations, plain left-click, no modifiers.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target && a.target !== '_self') return;
      if (a.hasAttribute('download')) return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#' || /^(mailto:|tel:|https?:)/i.test(href)) return;
      if (a.origin && a.origin !== location.origin) return;

      e.preventDefault();
      veil.classList.remove('is-lifted');
      veil.classList.add('is-closing');
      setTimeout(function () { window.location.href = a.href; }, 290);
    });
  }

  /* ---------------------------------------------------------------------- */
  function boot() {
    initTheme();
    initBurger();
    initSlowScroll();
    initMagnetic();
    initTilt();
    initPageTransitions();
    initScrollChrome();
    initReveal();
    initScrollspy();
    initCounters();
    initTyped();
    initCopy();
    document.getElementById('year') &&
      (document.getElementById('year').textContent = new Date().getFullYear());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

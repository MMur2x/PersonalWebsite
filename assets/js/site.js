/* Mayne Murray — interactions. Vanilla JS, no dependencies.
   The room's overlays, hotspots and drawer, 3D tilt, flip cards, the turning project stage,
   the skill cloud, the leadership deck, the résumé sheet and small conveniences. */
(function () {
  'use strict';
  var root = document.documentElement;
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  /* ------------------------------------------------------------ toast */
  var toast = $('#toast'), toastT = null;
  function say(msg) { if (!toast) return; toast.textContent = msg; toast.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(function () { toast.classList.remove('is-on'); }, 1900); }

  /* ------------------------------------------------------------ intro: the hero copy staggers in when room.js says the lights are on */
  $$('.hi').forEach(function (el, i) { el.style.setProperty('--i', i); });
  function reveal() { root.classList.add('is-revealed'); }
  document.addEventListener('room:settled', reveal);
  if (calm || !window.Room) reveal();
  setTimeout(reveal, 4500); // never leave the page hidden if something stalls
  var replay = $('#replay');
  if (replay) replay.addEventListener('click', function () {
    if (!window.Room) return;
    root.classList.remove('is-revealed'); void root.offsetWidth; window.scrollTo(0, 0); window.Room.replay();
    if (calm) reveal();
  });

  /* ------------------------------------------------------------ ONE TIMELINE: p is scroll progress through #film.
     Every .fx fades in at data-in and out at data-out; FADE is how long (in p) each fade takes. */
  var FADE = .024, film = $('#film'), after = $('#after'), chev = $('#chev');
  var fx = $$('.fx').map(function (el) { return { el: el, a: parseFloat(el.getAttribute('data-in')), b: parseFloat(el.getAttribute('data-out')), o: -1 }; });
  var STOPS = (window.Room && window.Room.stops) || [0, .25, .47, .69, .93];
  var stepBtns = $$('#steps button'), stopLinks = $$('.nav__links a[data-stop]'), curStop = -1, ticking = false, inAfter = false;
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function filmMax() { return Math.max(1, film.offsetHeight - window.innerHeight); }
  function goStop(n) { if (window.Room && window.Room.exploring && window.Room.exploring()) window.Room.explore(false); closeDrawer(); window.scrollTo({ top: STOPS[n] * filmMax(), behavior: calm ? 'auto' : 'smooth' }); }
  function onScroll() {
    ticking = false; if (!film || !film.offsetHeight) return;
    var y = window.pageYOffset, p = clamp01(y / filmMax()), i, f, o;
    for (i = 0; i < fx.length; i++) {
      f = fx[i]; o = clamp01((p - f.a) / FADE) * clamp01((f.b - p) / FADE); o = Math.round(o * 100) / 100;
      if (o !== f.o) { f.o = o; f.el.style.setProperty('--o', o); f.el.classList.toggle('is-live', o > .5); if (o > .5) f.el.removeAttribute('inert'); else f.el.setAttribute('inert', ''); }
    }
    var stop = 0, best = 9; for (i = 0; i < STOPS.length; i++) if (Math.abs(p - STOPS[i]) < best) { best = Math.abs(p - STOPS[i]); stop = i; }
    var dim = after.getBoundingClientRect().top < window.innerHeight * .62;
    if (dim !== inAfter) { inAfter = dim; document.body.classList.toggle('dim', dim); chev.classList.toggle('is-end', dim); chev.setAttribute('aria-label', dim ? 'Back to the doorway' : 'Go to the next part of the room'); if (dim) closeDrawer(); }
    if (focusStop >= 0 && stop !== focusStop && Date.now() - focusAt > 1600) closeDrawer(true);   // you walked away from what you were looking at
    if (stop !== curStop) {
      curStop = stop;
      stepBtns.forEach(function (b, n) { b.setAttribute('aria-current', n === stop ? 'true' : 'false'); });
    }
    stopLinks.forEach(function (a) { a.setAttribute('aria-current', !dim && +a.getAttribute('data-stop') === stop ? 'true' : 'false'); });
  }
  function queue() { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }
  window.addEventListener('scroll', queue, { passive: true }); window.addEventListener('resize', queue);
  window.addEventListener('load', queue); window.addEventListener('pageshow', queue);   // the browser may restore a scroll position after this script has run
  // the chevron steps to the next stop, then into the details, then turns round and takes you back to the top
  if (chev) chev.addEventListener('click', function () {
    if (inAfter) { window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' }); return; }
    var p = clamp01(window.pageYOffset / filmMax()), n = -1;
    for (var i = 0; i < STOPS.length; i++) if (STOPS[i] > p + .03) { n = i; break; }
    if (n < 0) $('#work').scrollIntoView({ behavior: calm ? 'auto' : 'smooth' }); else goStop(n);
  });
  document.addEventListener('click', function (e) {
    var g = e.target.closest && e.target.closest('[data-go], [data-stop]'); if (!g) return;
    if (root.classList.contains('no-webgl')) { if (g.hasAttribute('data-stop')) { e.preventDefault(); $('#work').scrollIntoView(); } return; }
    e.preventDefault(); e.stopPropagation(); goStop(+(g.getAttribute('data-go') || g.getAttribute('data-stop')));
  }, true);

  /* ------------------------------------------------------------ lamp */
  var lampBtn = $('#lampBtn');
  function toggleLamp() {
    if (!window.Room) return; var on = window.Room.lamp();
    lampBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); lampBtn.setAttribute('aria-label', on ? 'Desk lamp: on. Switch it off' : 'Desk lamp: off. Switch it on');
    say(on ? 'Lamp on' : 'Lamp off');
  }
  if (lampBtn) lampBtn.addEventListener('click', toggleLamp);

  /* ------------------------------------------------------------ the drawer: what each object in the room tells you.
     Text is lifted from the detail sections further down the page, so there is one place to edit it. */
  function from(sel) { var el = $(sel); return el ? el.innerHTML : ''; }
  function job(id) { return function () { return '<ul>' + from(id + ' .flip__back .points') + '</ul><ul class="stack">' + from(id + ' .flip__back .stack') + '</ul>'; }; }
  function proj(n) { return function () { var el = $('#pp-' + n); if (!el) return ''; var out = ''; $$('p, ul', el).forEach(function (x, i) { if (i < 4 && !x.closest('.pp__links')) out += x.outerHTML; }); return out; }; }
  function card(n) { return function () { var c = $$('.deck__card')[n]; if (!c) return ''; var out = ''; $$('p:not(.card__org), ul', c).forEach(function (x) { out += x.outerHTML; }); return out; }; }
  var K = {
    work: function (sel) { return { label: 'Open the full card', href: sel, flip: sel }; },
    show: function (n) { return { label: 'See the project', href: '#projects', show: n }; }
  };
  var DETAIL = {
    monitor: { kicker: 'On the monitor · Summer 2026', title: 'Software Engineer Intern', org: 'Fidelity Investments · Merrimack, NH', body: function () { return '<ul class="nums"><li><b>9</b>Kubernetes resource types</li><li><b>16</b>telemetry dashboards</li><li><b>6+</b>exploration tools</li></ul>' + job('#exp-fidelity')(); }, keys: [K.work('#exp-fidelity')] },
    laptop: { kicker: 'On the laptop · Summer 2025', title: 'Information Technology Intern', org: 'RSM US LLP · Minneapolis, MN', body: function () { return '<ul class="nums"><li><b>500+</b>employees served</li><li><b>−30%</b>manual input errors</li></ul>' + job('#exp-rsm')(); }, keys: [K.work('#exp-rsm')] },
    paper: { kicker: 'On the desk', title: 'The résumé', org: 'One page, kept current', body: '<p>Everything in this room, on one sheet of paper. Read it here or take the PDF with you.</p>', keys: [{ label: 'Read it', resume: true, ink: true }, { label: 'Download PDF', href: 'assets/docs/mayne-murray-resume.pdf', download: true }] },
    lamp: { kicker: 'Desk lamp', title: 'How I like to work', org: 'It really does switch off', body: '<p>My interests sit where backend development meets infrastructure: automation, systems integration, and building tools that make complicated systems easier to understand.</p><p>The lamp is wired up, by the way.</p>', keys: [{ label: 'Flip the switch', lamp: true, ink: true }] },
    calendar: { kicker: 'On the wall · Project', title: 'Homework Tracker Extension', org: 'Chrome extension · 2026', body: proj(0), keys: [K.show(0)] },
    qr: { kicker: 'On the wall · Project', title: 'QR Code Generator', org: 'Python · 2024', body: function () { return proj(3)() + '<p>The poster is a real code. Point a phone camera at it and it opens this site.</p>'; }, keys: [K.show(3)] },
    phone: { kicker: 'On the nightstand · Project', title: 'Cryptocurrency Investment App', org: 'Flutter · 2025', body: proj(1), keys: [K.show(1)] },
    books: { kicker: 'On the shelf', title: 'Languages and tools', org: 'What I reach for', body: '<p><b>Languages</b></p><ul class="stack"><li>C</li><li>C++</li><li>Python</li><li>JavaScript</li><li>TypeScript</li><li>SQL</li></ul><p><b>Frameworks and libraries</b></p><ul class="stack"><li>React</li><li>Grafana Scenes</li><li>Flutter</li><li>Pandas</li><li>Matplotlib</li></ul><p><b>Cloud and infrastructure</b></p><ul class="stack"><li>Kubernetes</li><li>Docker</li><li>AWS EKS</li><li>OpenTelemetry</li></ul>', keys: [{ label: 'Spin the skill cloud', href: '#skills' }] },
    diploma: { kicker: 'On the shelf · Education', title: 'B.S. Computer Science', org: 'University of Massachusetts Lowell · May 2027', body: '<p>Honors College. Coursework so far includes:</p><ul class="stack"><li>Software Engineering I</li><li>Operating Systems</li><li>Organization of Programming Languages</li></ul>', keys: [{ label: 'Education and experience', href: '#work' }] },
    cap: { kicker: 'On top of the shelf', title: 'Class of 2027', org: 'Honors College · RSM Excellence Academy Scholar', body: '<p>The cap is ready early. I graduate from UMass Lowell in May 2027 as part of the Honors College, and I’m an RSM Excellence Academy Scholar.</p>', keys: [{ label: 'About me', href: '#about' }] },
    frames: { kicker: 'On the wall', title: 'Five frames, five programs', org: 'Leadership and fellowships', body: '<p>NSBE, MLT Career Prep, Juniper Scholars, SEO Career and Grow with Google. Walk over to the wall and click each frame.</p>', keys: [{ label: 'Take a closer look', go: 3, ink: true }], skip: true },
    f0: { kicker: 'Frame 1 · Oct 2023 to present', title: 'National Society of Black Engineers', org: 'Executive Board Senator', body: card(0), keys: [{ label: 'Leadership in full', href: '#about' }] },
    f1: { kicker: 'Frame 2 · Aug 2025 to present', title: 'MLT Career Prep ’27 Fellow', org: 'Management Leadership for Tomorrow', body: card(1), keys: [{ label: 'Leadership in full', href: '#about' }] },
    f2: { kicker: 'Frame 3 · Sep 2024 to present', title: 'Juniper Scholars Fellow', org: 'Juniper Networks', body: card(2), keys: [{ label: 'Leadership in full', href: '#about' }] },
    f3: { kicker: 'Frame 4 · Jul 2024 to Jun 2025', title: 'SEO Career, Technology Track', org: 'Sponsors for Educational Opportunity', body: card(3), keys: [{ label: 'Leadership in full', href: '#about' }] },
    f4: { kicker: 'Frame 5 · Jul 2025', title: 'Grow with Google Scholar', org: 'Google · Coursera', body: card(4), keys: [{ label: 'Leadership in full', href: '#about' }] },
    portrait: { kicker: 'On the nightstand', title: 'Mayne Murray', org: 'Software engineer · Framingham, MA', body: function () { return from('.about__me > p') ? '<p>' + from('.about__me > p') + '</p>' : ''; }, keys: [{ label: 'About me', href: '#about' }, { label: 'Say hello', href: '#contact', ink: true }] },
    window: { kicker: 'Out the window', title: 'Say hello', org: 'Framingham, Massachusetts', body: '<p>Recruiting, collaborating, or comparing notes on observability tooling. I’d like to hear from you.</p>', keys: [{ label: 'Email me', href: 'mailto:maynemurray@gmail.com', ink: true }, { label: 'LinkedIn', href: 'https://www.linkedin.com/in/mayne-murray/', ext: true }, { label: 'GitHub', href: 'https://github.com/MMur2x', ext: true }] },
    bag: { kicker: 'Packed for campus · Spring 2025', title: 'Data Management Intern', org: 'University of Massachusetts Lowell', body: function () { return job('#exp-uml')() + '<p><b>Also on campus</b></p>' + card(5)(); }, keys: [K.work('#exp-uml')] }
  };
  var drawer = $('#drawer'), dKick = $('#drawerKicker'), dTitle = $('#drawerTitle'), dOrg = $('#drawerOrg'), dBody = $('#drawerBody'), dKeys = $('#drawerKeys'), lastSpot = null, hideT = null;
  var total = Object.keys(DETAIL).filter(function (k) { return !DETAIL[k].skip; }).length, found = {};
  try { (JSON.parse(localStorage.getItem('mr-found') || '[]') || []).forEach(function (k) { if (DETAIL[k] && !DETAIL[k].skip) found[k] = 1; }); } catch (e) {}
  var foundN = $('#foundN'), foundT = $('#foundT'), foundArc = $('#foundArc'), foundBtn = $('#foundBtn');
  function paintFound(bump) {
    var n = Object.keys(found).length; if (foundN) foundN.textContent = n; if (foundT) foundT.textContent = total;
    if (foundArc) foundArc.style.strokeDashoffset = 100 - n / total * 100;
    $$('.spot').forEach(function (s) { s.classList.toggle('is-found', !!found[s.getAttribute('data-spot')]); });
    if (bump && foundBtn) { foundBtn.classList.remove('is-bump'); void foundBtn.offsetWidth; foundBtn.classList.add('is-bump'); }
  }
  paintFound();
  if (foundBtn) foundBtn.addEventListener('click', function () {
    var n = Object.keys(found).length;
    if (n >= total) { say('You found everything in the room'); return; }
    var miss = Object.keys(DETAIL).filter(function (k) { return !DETAIL[k].skip && !found[k]; })[0], el = $('.spot[data-spot="' + miss + '"] span');
    say((total - n) + ' left. Try the ' + (el ? el.textContent.toLowerCase() : 'next corner'));
  });
  function openDrawer(key, src) {
    var d = DETAIL[key]; if (!d || !drawer) return;
    clearTimeout(hideT); lastSpot = src || null;
    dKick.innerHTML = '<span class="eyebrow__dot"></span>' + d.kicker; dTitle.textContent = d.title; dOrg.textContent = d.org || '';
    dBody.innerHTML = typeof d.body === 'function' ? d.body() : d.body; $$('[id]', dBody).forEach(function (x) { x.removeAttribute('id'); }); $$('button, [data-tilt]', dBody).forEach(function (x) { if (x.tagName === 'BUTTON') x.remove(); });
    dKeys.innerHTML = '';
    d.keys.forEach(function (k) {
      var el = document.createElement(k.href ? 'a' : 'button'); el.className = 'key key--sm' + (k.ink ? ' key--ink' : ''); el.textContent = k.label;
      if (k.href) { el.href = k.href; if (k.ext) { el.target = '_blank'; el.rel = 'noopener'; } if (k.download) el.setAttribute('download', ''); if (k.flip) el.setAttribute('data-flip', k.flip); } else el.type = 'button';
      el.addEventListener('click', function () {
        if (k.lamp) { toggleLamp(); return; }
        if (k.resume) { openResume(); return; }
        if (k.go !== undefined) { goStop(k.go); return; }
        if (k.show !== undefined && window.__showGo) window.__showGo(k.show);
        if (k.href && k.href.charAt(0) === '#') closeDrawer(true);
      });
      dKeys.appendChild(el);
    });
    drawer.hidden = false; void drawer.offsetWidth; drawer.classList.add('is-open'); drawer.scrollTop = 0;
    $('#drawerClose').focus({ preventScroll: true });
    if (!d.skip && !found[key]) {
      found[key] = 1; try { localStorage.setItem('mr-found', JSON.stringify(Object.keys(found))); } catch (e) {}
      paintFound(true); if (Object.keys(found).length === total) say('That’s everything. You know the room now');
    }
  }
  function closeDrawer(quiet) {
    if (window.Room && window.Room.blur) window.Room.blur(); focusStop = -1;
    if (!drawer || drawer.hidden) return; drawer.classList.remove('is-open');
    hideT = setTimeout(function () { drawer.hidden = true; }, calm ? 0 : 420);
    if (!quiet && lastSpot && lastSpot.classList.contains('is-on')) lastSpot.focus({ preventScroll: true }); lastSpot = null;
  }
  // clicking an object walks you over to it, then tells you about it
  var focusStop = -1, focusAt = 0;
  $$('.spot').forEach(function (s) { s.addEventListener('click', function () {
    var key = s.getAttribute('data-spot');
    if (window.Room && window.Room.focus && DETAIL[key] && !DETAIL[key].skip) {
      focusStop = exploring ? -1 : window.Room.home(key); focusAt = Date.now();
      if (!exploring && focusStop !== curStop) window.scrollTo({ top: STOPS[focusStop] * filmMax(), behavior: calm ? 'auto' : 'smooth' });
      window.Room.focus(key);
    }
    openDrawer(key, s);
  }); });
  if (drawer) { $('#drawerClose').addEventListener('click', function () { closeDrawer(); }); document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !drawer.hidden) closeDrawer(); }); }

  /* ------------------------------------------------------------ free walking: the Walk button, the heads-up bar, drag-to-look and the touch stick */
  var hud = $('#hud'), stick = $('#stick'), knob = $('#stickKnob'), pad = $('#lookpad'), exploring = false, exploreY = 0;
  var LOOK_MOUSE = .0042, LOOK_TOUCH = .0058;   // radians turned per pixel dragged
  function paintExplore(on) {
    exploring = on; root.classList.toggle('exploring', on); exploreY = window.pageYOffset;
    if (hud) hud.hidden = !on; if (stick) stick.hidden = !on;
    $$('.dock__walk').forEach(function (b) { b.setAttribute('aria-pressed', on ? 'true' : 'false'); var t = $('span', b); if (t) t.textContent = on ? 'Walking' : 'Walk around'; });
    if (!on) closeDrawer(true);
  }
  function setExplore(on) {
    if (!window.Room || !window.Room.explore || root.classList.contains('no-webgl')) return;
    if (on && inAfter) window.scrollTo({ top: STOPS[STOPS.length - 1] * filmMax(), behavior: 'auto' });
    if (on) closeDrawer(true); window.Room.explore(on);
  }
  document.addEventListener('room:explore', function (e) { paintExplore(!!e.detail.on); });
  $$('[data-explore]').forEach(function (b) { b.addEventListener('click', function () { setExplore(!exploring); }); });
  if ($('#exploreExit')) $('#exploreExit').addEventListener('click', function () { setExplore(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && exploring && (!drawer || drawer.hidden)) setExplore(false); });
  window.addEventListener('scroll', function () { if (exploring && Math.abs(window.pageYOffset - exploreY) > 60) setExplore(false); }, { passive: true });   // scrolling picks the tour back up
  if (pad) {
    var lastX = 0, lastY = 0, dragId = null;
    pad.addEventListener('pointerdown', function (e) { dragId = e.pointerId; lastX = e.clientX; lastY = e.clientY; pad.classList.add('is-drag'); try { pad.setPointerCapture(e.pointerId); } catch (err) {} });
    pad.addEventListener('pointermove', function (e) {
      if (e.pointerId !== dragId) return; var k = e.pointerType === 'touch' ? LOOK_TOUCH : LOOK_MOUSE;
      window.Room.look((e.clientX - lastX) * -k, (e.clientY - lastY) * -k); lastX = e.clientX; lastY = e.clientY;   // drag the world: pull left to look right
    });
    var endDrag = function (e) { if (e.pointerId === dragId) { dragId = null; pad.classList.remove('is-drag'); } };
    pad.addEventListener('pointerup', endDrag); pad.addEventListener('pointercancel', endDrag);
  }
  if (stick && knob) {
    var sid = null, R0 = 38;
    var steer = function (e) {
      var r = stick.getBoundingClientRect(), x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2), l = Math.hypot(x, y) || 1, m = Math.min(l, R0);
      x = x / l * m; y = y / l * m; knob.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)'; window.Room.move(x / R0, -y / R0);
    };
    stick.addEventListener('pointerdown', function (e) { sid = e.pointerId; try { stick.setPointerCapture(e.pointerId); } catch (err) {} steer(e); e.preventDefault(); });
    stick.addEventListener('pointermove', function (e) { if (e.pointerId === sid) steer(e); });
    var letGo = function (e) { if (e.pointerId !== sid) return; sid = null; knob.style.transform = ''; window.Room.move(0, 0); };
    stick.addEventListener('pointerup', letGo); stick.addEventListener('pointercancel', letGo);
  }
  queue();

  /* ------------------------------------------------------------ smooth anchors (and remembering where a link landed) */
  function flash(el) { if (!el) return; el.classList.remove('is-hit'); void el.offsetWidth; el.classList.add('is-hit'); }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return;
    var id = a.getAttribute('href').slice(1); if (!id) return;
    var t = document.getElementById(id); if (!t) return;
    e.preventDefault();
    t.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: t.classList.contains('flip') ? 'center' : 'start' });
    if (history.replaceState) history.replaceState(null, '', '#' + id);
    var flipSel = a.getAttribute('data-flip');
    if (flipSel) setTimeout(function () { setFlip($(flipSel), true); }, calm ? 0 : 650);
  });

  /* ------------------------------------------------------------ reveal on scroll */
  var groups = {};
  $$('[data-reveal]').forEach(function (el) {
    var key = el.parentNode; var n = (groups.__k = groups.__k || new Map()).get(key) || 0;
    el.style.setProperty('--i', n); groups.__k.set(key, n + 1);
  });
  if ('IntersectionObserver' in window && !calm) {
    var rio = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting || en.boundingClientRect.top < window.innerHeight) { en.target.classList.add('is-in'); rio.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -4% 0px', threshold: 0 });
    $$('[data-reveal]').forEach(function (el) { rio.observe(el); });
  } else $$('[data-reveal]').forEach(function (el) { el.classList.add('is-in'); });

  /* ------------------------------------------------------------ count-up stats */
  function count(el) {
    var to = parseInt(el.getAttribute('data-count'), 10), suf = el.getAttribute('data-suffix') || '', t0 = null, dur = to > 100 ? 1500 : 1000;
    function tick(ts) { if (t0 === null) t0 = ts; var p = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - p, 4); el.textContent = Math.round(to * e) + suf; if (p < 1) requestAnimationFrame(tick); }
    requestAnimationFrame(tick);
  }
  if ('IntersectionObserver' in window && !calm) {
    var cio = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting || en.boundingClientRect.top < 0) { cio.unobserve(en.target); count(en.target); } }); }, { threshold: .2 });
    $$('[data-count]').forEach(function (el) { el.textContent = '0' + (el.getAttribute('data-suffix') || ''); cio.observe(el); });
  }

  /* ------------------------------------------------------------ 3D tilt with glare */
  if (fine && !calm) {
    $$('[data-tilt]').forEach(function (el) {
      var max = parseFloat(el.getAttribute('data-tilt')) || 6, raf = null, ev = null;
      function apply() {
        raf = null; if (!ev) return;
        var b = el.getBoundingClientRect(), x = (ev.clientX - b.left) / b.width, y = (ev.clientY - b.top) / b.height;
        el.style.setProperty('--ry', ((x - .5) * max * 2).toFixed(2) + 'deg');
        el.style.setProperty('--rx', ((.5 - y) * max * 2).toFixed(2) + 'deg');
        el.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
        el.style.setProperty('--glare', '1');
      }
      el.addEventListener('pointerenter', function () { el.classList.add('is-tilting'); });
      el.addEventListener('pointermove', function (e) { ev = e; if (!raf) raf = requestAnimationFrame(apply); });
      el.addEventListener('pointerleave', function () { ev = null; el.classList.remove('is-tilting'); el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); el.style.setProperty('--glare', '0'); });
    });
  }

  /* ------------------------------------------------------------ flip cards */
  function setFlip(card, on) {
    if (!card) return;
    card.classList.toggle('is-flipped', on);
    var front = $('.flip__front', card), back = $('.flip__back', card);
    if (front) front.inert = on; if (back) back.inert = !on;
    var b = $('.flip__front .flip__btn', card); if (b) b.setAttribute('aria-expanded', on ? 'true' : 'false');
  }
  $$('.flip').forEach(function (card) {
    setFlip(card, false);
    $$('.flip__btn', card).forEach(function (b) {
      b.addEventListener('click', function () {
        var on = !card.classList.contains('is-flipped'); setFlip(card, on);
        var target = $(on ? '.flip__back .flip__btn' : '.flip__front .flip__btn', card);
        if (target) setTimeout(function () { target.focus({ preventScroll: true }); }, 420);
      });
    });
  });

  /* ------------------------------------------------------------ project stage: a four-sided ring that turns */
  (function show() {
    var ring = $('#ring'); if (!ring) return;
    var tabs = $$('.tab'), faces = $$('.face', ring), panels = $$('.pp'), countEl = $('#showCount');
    var idx = 0, turn = 0;
    function go(n, focus) {
      var len = tabs.length, to = (n + len) % len, d = to - idx;
      if (d > len / 2) d -= len; if (d < -len / 2) d += len;       // always take the short way round
      turn -= d * 90; idx = to;
      ring.style.setProperty('--turn', turn + 'deg');
      tabs.forEach(function (t, i) { t.setAttribute('aria-selected', i === idx ? 'true' : 'false'); t.tabIndex = i === idx ? 0 : -1; });
      faces.forEach(function (f, i) { f.classList.toggle('is-front', i === idx); });
      panels.forEach(function (p, i) { p.hidden = i !== idx; p.classList.toggle('is-on', i === idx); });
      if (countEl) countEl.textContent = (idx + 1) + ' / ' + len;
      if (focus) tabs[idx].focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { go(i); });
      t.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1, true); }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1, true); }
      });
    });
    var prev = $('#showPrev'), next = $('#showNext');
    if (prev) prev.addEventListener('click', function () { go(idx - 1); });
    if (next) next.addEventListener('click', function () { go(idx + 1); });
    var stage = $('.show__stage'), sx = null;
    stage.addEventListener('pointerdown', function (e) { sx = e.clientX; });
    stage.addEventListener('pointerup', function (e) { if (sx === null) return; var dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 46) go(idx + (dx < 0 ? 1 : -1)); });
    function fit() { ring.style.setProperty('--rad', Math.round(Math.min(stage.clientWidth, 620) / 2) + 'px'); }
    fit(); window.addEventListener('resize', fit);
    go(0);
    window.__showGo = go;

    // screenshots inside each device
    $$('.screens').forEach(function (ctl) {
      var face = faces[+ctl.getAttribute('data-for')], imgs = $$('img', face), dots = $('.screens__dots', ctl), cap = $('.screens__cap', ctl), i = 0;
      imgs.forEach(function (im, k) {
        var d = document.createElement('button'); d.type = 'button'; d.className = 'screens__dot'; d.setAttribute('aria-label', 'Show screenshot ' + (k + 1));
        d.addEventListener('click', function () { pick(k); }); dots.appendChild(d);
      });
      function pick(k) {
        i = (k + imgs.length) % imgs.length;
        imgs.forEach(function (im, j) { im.classList.toggle('is-on', j === i); if (j === i) im.loading = 'eager'; });
        $$('.screens__dot', dots).forEach(function (d, j) { d.setAttribute('aria-current', j === i ? 'true' : 'false'); });
        cap.textContent = imgs[i].getAttribute('data-cap') || '';
      }
      $$('[data-step]', ctl).forEach(function (b) { b.addEventListener('click', function () { pick(i + (+b.getAttribute('data-step'))); }); });
      face.addEventListener('click', function () { pick(i + 1); });
      pick(0);
    });
  })();

  /* ------------------------------------------------------------ skill cloud: tags on a sphere you can turn */
  (function cloud() {
    var box = $('#orbit'); if (!box) return;
    var tags = $$('.tag', box), n = tags.length, pts = [];
    for (var i = 0; i < n; i++) { // even spread over a sphere
      var y = 1 - (i + .5) / n * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996323;
      pts.push([Math.cos(a) * r, y, Math.sin(a) * r]);
    }
    var yaw = 0, pitch = -.25, vy = calm ? 0 : .0035, vp = 0, drag = false, lx = 0, ly = 0, moved = 0, on = false, raf = null, R = 200;
    function size() { R = Math.min(box.clientWidth * .43, box.clientHeight * .44); }
    function draw() {
      raf = null;
      var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      for (var i = 0; i < n; i++) {
        var p = pts[i], x = p[0] * cy + p[2] * sy, z = -p[0] * sy + p[2] * cy, y2 = p[1] * cp - z * sp, z2 = p[1] * sp + z * cp;
        var s = .72 + (z2 + 1) * .2, el = tags[i];
        el.style.transform = 'translate3d(' + (x * R).toFixed(1) + 'px,' + (y2 * R * .92).toFixed(1) + 'px,0) translate(-50%,-50%) scale(' + s.toFixed(3) + ')';
        el.style.opacity = (.34 + (z2 + 1) * .33).toFixed(2);
        el.style.zIndex = Math.round((z2 + 1) * 50);
      }
      if (!drag) { yaw += vy; pitch += vp; vp *= .94; vy += ((calm ? 0 : .0035) - vy) * .02; }
      if (on && (!calm || drag || Math.abs(vy) > .0002)) raf = requestAnimationFrame(draw);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(draw); }
    size(); draw();
    window.addEventListener('resize', function () { size(); kick(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { on = es[0].isIntersecting; if (on) kick(); }).observe(box); else { on = true; kick(); }
    box.addEventListener('pointerdown', function (e) { drag = true; moved = 0; lx = e.clientX; ly = e.clientY; root.classList.add('is-grabbing'); });
    window.addEventListener('pointermove', function (e) {
      if (!drag) return; var dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
      yaw += dx * .006; pitch = Math.max(-1.1, Math.min(1.1, pitch + dy * .004)); vy = dx * .006; kick();
    }, { passive: true });
    window.addEventListener('pointerup', function () { if (drag) { drag = false; root.classList.remove('is-grabbing'); kick(); } });

    var ro = $('#readout'), roGroup = $('#roGroup'), roName = $('#roName'), roNote = $('#roNote'), roLink = $('#roLink');
    var NAMES = { lang: 'Language', frame: 'Framework or library', cloud: 'Cloud and infrastructure' };
    tags.forEach(function (t) {
      t.addEventListener('click', function () {
        if (moved > 8) return; // that was a drag, not a press
        tags.forEach(function (o) { o.classList.toggle('is-picked', o === t); });
        roGroup.textContent = NAMES[t.getAttribute('data-g')] + ' · used at ' + t.getAttribute('data-where');
        roName.textContent = t.textContent; roNote.textContent = t.getAttribute('data-note') || '';
        var link = t.getAttribute('data-link');
        roLink.hidden = !link;
        if (link) { roLink.setAttribute('href', link); roLink.textContent = link === '#projects' ? 'Open the project' : 'See the experience'; roLink.onclick = function () { var pj = t.getAttribute('data-proj'); if (pj !== null && window.__showGo) window.__showGo(+pj); if (link.indexOf('#exp-') === 0) setTimeout(function () { setFlip($(link), true); }, 650); }; }
        ro.classList.remove('is-swap'); void ro.offsetWidth; ro.classList.add('is-swap');
      });
    });
    $$('[data-filter]').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = b.getAttribute('data-filter');
        $$('[data-filter]').forEach(function (o) { o.classList.toggle('is-on', o === b); o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
        tags.forEach(function (t) { t.classList.toggle('is-dim', f !== 'all' && t.getAttribute('data-g') !== f); });
      });
    });
  })();

  /* ------------------------------------------------------------ leadership deck */
  (function deck() {
    var d = $('#deck'); if (!d) return;
    var cards = $$('.deck__card', d), order = cards.map(function (_, i) { return i; }), countEl = $('#deckCount'), top = 0;
    function lay() {
      order.forEach(function (ci, k) {
        var c = cards[ci]; c.style.setProperty('--k', Math.min(k, 4)); c.style.zIndex = 20 - k;
        c.setAttribute('aria-hidden', k === 0 ? 'false' : 'true'); c.inert = k !== 0;
        c.style.visibility = k > 4 ? 'hidden' : 'visible';
      });
      if (countEl) countEl.textContent = (order[0] + 1) + ' / ' + cards.length;
    }
    function next() {
      var c = cards[order[0]]; c.classList.add('is-leaving');
      setTimeout(function () { c.classList.remove('is-leaving'); order.push(order.shift()); lay(); }, calm ? 0 : 330);
    }
    function prev() {
      var ci = order.pop(); order.unshift(ci); var c = cards[ci];
      c.classList.add('is-entering'); lay(); void c.offsetWidth; c.classList.remove('is-entering');
    }
    lay();
    $('#deckNext').addEventListener('click', next); $('#deckPrev').addEventListener('click', prev);
    d.addEventListener('click', function (e) { if (!e.target.closest('a,button')) next(); });
    d.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') prev(); });
  })();

  /* ------------------------------------------------------------ résumé sheet */
  var sheet = $('#resume');
  function openResume() {
    if (!sheet) return;
    var f = $('iframe', sheet); if (f && !f.getAttribute('src')) f.setAttribute('src', f.getAttribute('data-src'));
    if (typeof sheet.showModal === 'function') sheet.showModal(); else window.open('assets/docs/mayne-murray-resume.pdf', '_blank');
  }
  $$('[data-resume]').forEach(function (b) { b.addEventListener('click', openResume); });
  if (sheet) {
    $$('[data-close]', sheet).forEach(function (b) { b.addEventListener('click', function () { sheet.close(); }); });
    sheet.addEventListener('click', function (e) { if (e.target === sheet) sheet.close(); });
  }
  if (location.hash === '#resume') openResume();

  /* ------------------------------------------------------------ copy buttons */
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var text = b.getAttribute('data-copy'), ok = function () { say(b.getAttribute('data-done') || 'Copied'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, function () { say('Copy failed. Select the text instead.'); });
      else say('Copy failed. Select the text instead.');
    });
  });

  /* ------------------------------------------------------------ keyboard feel: Enter and Space press keys visibly */
  document.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('key')) e.target.classList.add('is-down'); });
  document.addEventListener('keyup', function (e) { if (e.target.classList) e.target.classList.remove('is-down'); });

})();

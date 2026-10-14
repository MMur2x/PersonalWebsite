/* Plain page navigation, optional short transition, and offscreen animation pausing. */
(function () {
  'use strict';
  var root = document.documentElement;
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)');
  var home = document.body.classList.contains('portfolio-home');
  var blog = document.body.classList.contains('portfolio-blog');
  var sharedControls = !!document.querySelector('script[src*="assets/js/site.js"]');
  function destination(id) {
    if (id === 'experience' || /^isle-(fidelity|rsm|uml)$/.test(id)) return 'experience.html';
    if (id === 'projects' || id.indexOf('isle-') === 0) return 'projects.html';
    if (id === 'about' || id === 'leadership' || id.indexOf('flag-') === 0) return 'about.html';
    if (id === 'skills' || id.indexOf('fruit-') === 0) return 'skills.html';
    if (id === 'resume' || id === 'contact') return 'resume.html';
    if (id === 'blog') return 'blog.html';
    return '';
  }
  // Previously shared one-page URLs continue to land on the original content.
  if (home && location.hash) {
    var id = location.hash.slice(1), page = destination(id);
    if (page) { location.replace(page + location.hash); return; }
  }
  if (home || (blog && !sharedControls)) {
    var button = document.getElementById('theme');
    var sun = button ? button.innerHTML : '';
    var moon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/></svg>';
    function dark() {
      var theme = root.getAttribute('data-theme');
      return theme ? theme === 'dark' : !window.matchMedia('(prefers-color-scheme: light)').matches;
    }
    function label() {
      button.setAttribute('aria-label', dark() ? 'Switch to light mode' : 'Switch to dark mode');
      button.innerHTML = dark() ? sun : moon;
    }
    if (button) {
      label();
      button.addEventListener('click', function () {
        var theme = dark() ? 'light' : 'dark';
        root.setAttribute('data-theme', theme);
        try { localStorage.setItem('mm-theme', theme); } catch (e) {}
        label();
      });
    }
  }
  var current = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav a').forEach(function (link) {
    if (link.getAttribute('href') === current) link.setAttribute('aria-current', 'page');
  });
  if (blog && !sharedControls) {
    var menu = document.getElementById('nav'), burger = document.getElementById('burger');
    function closeMenu() {
      if (!menu || !burger) return;
      menu.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Open the section menu');
    }
    if (menu && burger) {
      burger.addEventListener('click', function () {
        var open = menu.classList.toggle('open');
        burger.setAttribute('aria-expanded', String(open));
        burger.setAttribute('aria-label', open ? 'Close the section menu' : 'Open the section menu');
      });
      menu.addEventListener('click', function (event) { if (event.target.closest('a')) closeMenu(); });
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && menu.classList.contains('open')) {
          closeMenu();
          burger.focus();
        }
      });
    }
  }
  var navigating = false;
  document.addEventListener('click', function (event) {
    var a = event.target.closest('a[href]');
    if (!a || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || a.hasAttribute('download') || (a.target && a.target !== '_self')) return;
    var url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !url.pathname.endsWith('.html') || url.pathname === location.pathname || calm.matches) return;
    event.preventDefault();
    if (navigating) return;
    navigating = true;
    root.classList.add('page-leaving');
    setTimeout(function () { location.assign(url.href); }, 140);
  });
  window.addEventListener('pageshow', function () { navigating = false; root.classList.remove('page-leaving'); });
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.target.classList.toggle('is-visible', e.isIntersecting); });
    }, { rootMargin: '80px' });
    document.querySelectorAll('.isle__art').forEach(function (el) { observer.observe(el); });
  }
})();

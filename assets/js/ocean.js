/* Cached ocean artwork moves with CSS transforms. No WebGL, scroll handler or JS frame loop. */
(function () {
  'use strict';
  if (!document.getElementById('ocean')) return;
  var root = document.documentElement;
  root.classList.add('has-ocean');
  function pauseWhenHidden() {
    root.classList.toggle('ocean-paused', document.hidden);
  }
  document.addEventListener('visibilitychange', pauseWhenHidden);
  pauseWhenHidden();
})();

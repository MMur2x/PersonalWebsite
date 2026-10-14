/* Fixed CSS atmosphere: no frame loop, scroll tracking, or particle generation. */
(function () {
  'use strict';
  if (!document.getElementById('atmosphere')) return;
  var root = document.documentElement;
  var button = document.getElementById('motion');
  var paused = false;
  try { paused = localStorage.getItem('mm-motion') === 'paused'; } catch (e) {}
  root.classList.add('has-atmosphere');
  function pauseWhenHidden() {
    root.classList.toggle('atmosphere-paused', document.hidden || paused);
  }
  function paintButton() {
    if (!button) return;
    button.setAttribute('aria-pressed', String(paused));
    var label = paused ? 'Resume background motion' : 'Pause background motion';
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.innerHTML = paused
      ? '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>';
  }
  if (button) button.addEventListener('click', function () {
    paused = !paused;
    try { localStorage.setItem('mm-motion', paused ? 'paused' : 'running'); } catch (e) {}
    pauseWhenHidden();
    paintButton();
  });
  document.addEventListener('visibilitychange', pauseWhenHidden);
  pauseWhenHidden();
  paintButton();
})();

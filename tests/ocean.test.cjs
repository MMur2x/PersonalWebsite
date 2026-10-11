const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('ocean has no JavaScript render loop and pauses when the tab is hidden', () => {
  const classes = new Set();
  const listeners = {};
  const document = {
    hidden: false,
    getElementById: () => ({}),
    documentElement: { classList: {
      add: name => classes.add(name),
      toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name)
    } },
    addEventListener: (name, fn) => { listeners[name] = fn; }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/js/ocean.js'), 'utf8'), {
    document,
    requestAnimationFrame: () => assert.fail('Ocean must not schedule per-frame JS work')
  });
  assert.ok(classes.has('has-ocean'));
  document.hidden = true;
  listeners.visibilitychange();
  assert.ok(classes.has('ocean-paused'));
  document.hidden = false;
  listeners.visibilitychange();
  assert.ok(!classes.has('ocean-paused'));
});

test('floating Log Pose and its 3D scene are removed', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const scenes = fs.readFileSync(path.join(root, 'assets/js/voyage-3d.js'), 'utf8');
  assert.doesNotMatch(html, /data-scene="logpose"|lpHeading/);
  assert.doesNotMatch(scenes, /__mmHeading|lpCanvas/);
  assert.match(html, /data-scene="chest"/);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('atmosphere has no JavaScript render loop and pauses when the tab is hidden', () => {
  const classes = new Set();
  const listeners = {};
  const document = {
    hidden: false,
    getElementById: id => id === 'atmosphere' ? {} : null,
    documentElement: { classList: {
      add: name => classes.add(name),
      toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name)
    } },
    addEventListener: (name, fn) => { listeners[name] = fn; }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/js/atmosphere.js'), 'utf8'), {
    document,
    requestAnimationFrame: () => assert.fail('Atmosphere must not schedule per-frame JS work')
  });
  assert.ok(classes.has('has-atmosphere'));
  document.hidden = true;
  listeners.visibilitychange();
  assert.ok(classes.has('atmosphere-paused'));
  document.hidden = false;
  listeners.visibilitychange();
  assert.ok(!classes.has('atmosphere-paused'));
});

test('all portfolio pages use lightweight artwork without a 3D dependency', () => {
  for (const page of ['index', 'experience', 'projects', 'about', 'skills', 'resume', 'blog']) {
    const html = fs.readFileSync(path.join(root, `${page}.html`), 'utf8');
    assert.doesNotMatch(html, /data-scene="logpose"|lpHeading|three\.min\.js|<canvas\b|fonts\.googleapis|fonts\.gstatic/);
  }
  const css = fs.readFileSync(path.join(root, 'assets/css/site.css'), 'utf8');
  assert.match(css, /mountain-village\.webp/);
  assert.doesNotMatch(css, /Shojumaru|Kaushan|Noto Sans|shinobi-scene/);
  assert.ok(!fs.existsSync(path.join(root, 'assets/images/backgrounds/shinobi-scene.webp')), 'The replaced artwork must not remain in deployed assets');
  const village = fs.statSync(path.join(root, 'assets/images/backgrounds/mountain-village.webp'));
  assert.ok(village.size < 450000, 'Village artwork must stay under 450 kB');
  assert.doesNotMatch(css, /forest-drift|backdrop-filter/);
  assert.match(css, /animation: cloud-drift 32s linear infinite alternate/);
  assert.match(css, /atmosphere-paused[^}]+animation-play-state: paused/);

});

function abilityHarness(reduced = false) {
  const source = fs.readFileSync(path.join(root, 'assets/js/site.js'), 'utf8');
  const start = source.indexOf('/* ability activation controller */');
  const end = source.indexOf('/* end ability activation controller */');
  assert.ok(start >= 0 && end > start, 'ability activation controller is missing');
  class Node {
    constructor(tag) { this.tagName = tag; this.children = []; this.attributes = {}; this.style = { setProperty() {} }; }
    setAttribute(key, value) { this.attributes[key] = value; }
    getAttribute(key) { return this.attributes[key] || null; }
    appendChild(node) { node.remove(); this.children.push(node); node.parentNode = this; return node; }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(node => node !== this); this.parentNode = null; }
    cloneNode() { const node = new Node(this.tagName); for (const child of this.children) node.appendChild(child.cloneNode()); return node; }
  }
  const listeners = {}, timers = new Map();
  let nextTimer = 0, preferenceListener;
  const document = { hidden: false, body: new Node('body'), querySelector: () => null,
    createElement: tag => new Node(tag), createElementNS: (_, tag) => new Node(tag),
    addEventListener: (event, fn) => { listeners[event] = fn; }
  };
  const preference = { matches: reduced, addEventListener: (_, fn) => { preferenceListener = fn; } };
  const context = { document, preference,
    setTimeout: (fn, ms) => { const id = ++nextTimer; timers.set(id, { fn, ms }); return id; },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame: () => assert.fail('Activation must not start a JS frame loop')
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  const effects = context.createAbilityEffects(document, preference);
  const eye = new Node('svg'); eye.appendChild(new Node('path')); eye.appendChild(new Node('circle')); eye.appendChild(new Node('g'));
  const buttonClasses = new Set();
  const button = { querySelector: () => eye, classList: {
    add: name => buttonClasses.add(name), remove: name => buttonClasses.delete(name)
  } };
  return { effects, button, buttonClasses, document, timers, dialog: new Node('dialog'),
    hide: () => { document.hidden = true; listeners.visibilitychange(); },
    reduce: () => { preference.matches = true; preferenceListener(); },
    finish: () => { for (const timer of [...timers.values()]) timer.fn(); }
  };
}

test('ability activations replace each other, work inside the dialog, and clean up', () => {
  const h = abilityHarness();
  h.effects.play(h.button, 'clarity');
  const first = h.document.body.children[0];
  assert.equal(first.attributes['aria-hidden'], 'true');
  h.effects.play(h.button, 'insight');
  assert.equal(first.parentNode, null);
  assert.equal(h.document.body.children.length, 1);
  assert.equal(h.timers.size, 1);
  assert.equal([...h.timers.values()][0].ms, 1600);
  h.effects.play(h.button, 'stillness', h.dialog);
  assert.equal(h.document.body.children.length, 0);
  assert.equal(h.dialog.children.length, 1);
  h.effects.clear();
  assert.equal(h.dialog.children.length, 0);
  assert.equal(h.timers.size, 0);
  h.effects.play(h.button, 'clarity');
  h.finish();
  assert.equal(h.document.body.children.length, 0);
  assert.equal(h.timers.size, 0);
});

test('ability effects respect reduced motion and stop when hidden or preferences change', () => {
  const reduced = abilityHarness(true);
  reduced.effects.play(reduced.button, 'stillness');
  assert.equal(reduced.document.body.children.length, 0);
  assert.equal(reduced.timers.size, 0);
  const hidden = abilityHarness();
  hidden.effects.play(hidden.button, 'clarity');
  hidden.hide();
  assert.equal(hidden.document.body.children.length, 0);
  assert.equal(hidden.timers.size, 0);
  hidden.effects.play(hidden.button, 'insight');
  assert.equal(hidden.document.body.children.length, 0);
  const changed = abilityHarness();
  changed.effects.play(changed.button, 'insight');
  changed.reduce();
  assert.equal(changed.document.body.children.length, 0);
  assert.equal(changed.timers.size, 0);
});

test('every Experience eye starts normal, transforms, and cancels cleanly', () => {
  const h = abilityHarness();
  for (const ability of ['clarity', 'insight', 'stillness']) {
    h.effects.play(h.button, ability, h.dialog);
    const eye = h.dialog.children[0].children.find(node => node.className === 'ability-fx__eye');
    assert.ok(eye.children.some(node => node.attributes.class === 'ability-eye--normal'),
      `${ability} must start with a normal eye`);
    assert.ok(eye.children.some(node => (node.attributes.class || '').includes('ability-eye--awakened')),
      `${ability} must have its own selected eye`);
    assert.ok(h.buttonClasses.has('ability-transforming'));
    assert.equal([...h.timers.values()][0].ms, 1600);
  }
  h.effects.play(h.button, 'clarity');
  assert.equal(h.dialog.children.length, 0);
  assert.equal(h.timers.size, 1);
  assert.equal([...h.timers.values()][0].ms, 1600);
  h.hide();
  assert.equal(h.document.body.children.length, 0);
  assert.equal(h.timers.size, 0);
  assert.ok(!h.buttonClasses.has('ability-transforming'));
});


test('removed lore techniques do not produce effects', () => {
  const h = abilityHarness();
  h.effects.play(h.button, 'unsupported');
  assert.equal(h.document.body.children.length, 0);
  assert.equal(h.timers.size, 0);
});

function readingModeHarness(reduced = false) {
  const source = fs.readFileSync(path.join(root, 'assets/js/site.js'), 'utf8');
  const effectsStart = source.indexOf('/* ability activation controller */');
  const modesStart = source.indexOf('/* ------------------------------------------------------------ record details and reading modes */');
  const modesEnd = source.indexOf('/* ------------------------------------------------------------ native screenshot viewer */');
  assert.ok(modesEnd > modesStart, 'Reading-mode test boundary must precede the gallery');
  const timers = new Map(), listeners = {}, classes = new Set();
  let nextTimer = 0, focused = null;
  class Node {
    constructor(tag) {
      this.tagName = tag; this.attributes = {}; this.children = []; this.listeners = {};
      this.classes = new Set(); this.style = { setProperty() {} };
      this.classList = { add: name => this.classes.add(name), remove: name => this.classes.delete(name),
        contains: name => this.classes.has(name),
        toggle: (name, on) => { if (on === undefined) on = !this.classes.has(name); if (on) this.classes.add(name); else this.classes.delete(name); return on; } };
    }
    setAttribute(key, value) { this.attributes[key] = value; }
    getAttribute(key) { return this.attributes[key] || null; }
    addEventListener(event, fn) { (this.listeners[event] ||= []).push(fn); }
    emit(event, data = {}) { for (const fn of this.listeners[event] || []) fn({ target: this, currentTarget: this, ...data }); }
    click() { this.emit('click'); }
    focus() { focused = this; }
    showModal() { this.open = true; }
    close() { this.open = false; this.emit('close'); }
    querySelector(selector) { return this.selectors && this.selectors[selector] || null; }
    appendChild(node) { node.remove(); this.children.push(node); node.parentNode = this; return node; }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; }
    cloneNode() { const node = new Node(this.tagName); for (const child of this.children) node.appendChild(child.cloneNode()); return node; }
  }
  const buttons = ['clarity', 'insight', 'stillness'].map(() => {
    const button = new Node('button'), svg = new Node('svg'); svg.appendChild(new Node('circle'));
    button.setAttribute('aria-pressed', 'false'); button.selectors = { 'svg[data-awakened]': svg }; return button;
  });
  const logs = [0, 1, 2].map(() => {
    const log = new Node('article'), button = new Node('button');
    button.selectors = { span: new Node('span') }; log.selectors = { '.harden': button }; return log;
  });
  const dialog = new Node('dialog'), close = new Node('button'), link = new Node('a');
  const selectors = { '#hakiObs': buttons[0], '#hakiArm': buttons[1], '#hakiConq': buttons[2], '#conq': dialog };
  const document = { hidden: false, body: new Node('body'), querySelector: () => null,
    createElement: tag => new Node(tag), createElementNS: (_, tag) => new Node(tag),
    addEventListener: (event, fn) => { (listeners[event] ||= []).push(fn); }
  };
  const context = { document, reduceMotion: { matches: reduced, addEventListener() {} },
    doc: { classList: { toggle: (name, on) => { if (on === undefined) on = !classes.has(name); if (on) classes.add(name); else classes.delete(name); return on; }, contains: name => classes.has(name) } },
    $: (selector, host) => host ? host.querySelector(selector) : selectors[selector] || null,
    $$: (selector, host) => selector === '.log' ? logs : selector === '[data-close]' && host === dialog ? [close, link] : [],
    say() {}, setTimeout: (fn, ms) => { const id = ++nextTimer; timers.set(id, { fn, ms }); return id; },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame: () => assert.fail('Reading modes must not schedule per-frame work')
  };
  vm.createContext(context);
  vm.runInContext(source.slice(effectsStart, modesStart) + source.slice(modesStart, modesEnd), context);
  return { buttons, logs, dialog, close, link, classes, timers, document,
    focused: () => focused,
    key: key => { for (const fn of listeners.keydown || []) fn({ key, target: new Node('body') }); },
    hide: () => { document.hidden = true; for (const fn of listeners.visibilitychange || []) fn(); }
  };
}

test('Experience modes replace each other and remain selected after transient cleanup', () => {
  const h = readingModeHarness();
  h.buttons[0].click();
  assert.ok(h.classes.has('haki-obs'));
  h.buttons[1].click();
  assert.deepEqual([...h.classes], ['haki-arm']);
  assert.equal(h.buttons[0].getAttribute('aria-pressed'), 'false');
  assert.equal(h.buttons[1].getAttribute('aria-pressed'), 'true');
  assert.ok(h.logs.every(log => log.classes.has('is-hard')));
  h.hide();
  assert.deepEqual([...h.classes], ['haki-arm']);
  assert.equal(h.timers.size, 0);
  h.buttons[1].click();
  assert.equal(h.classes.size, 0);
  assert.ok(h.logs.every(log => !log.classes.has('is-hard')));
});

test('native record buttons can change details without selecting or stacking eye modes', () => {
  const h = readingModeHarness();
  h.buttons[0].click();
  for (const log of h.logs) log.selectors['.harden'].click();
  assert.deepEqual([...h.classes], ['haki-obs']);
  assert.equal(h.buttons[1].getAttribute('aria-pressed'), 'false');
  h.buttons[1].click();
  h.logs[0].selectors['.harden'].click();
  assert.equal(h.classes.size, 0);
  assert.equal(h.buttons[1].getAttribute('aria-pressed'), 'false');
  assert.ok(h.logs[1].classes.has('is-hard'));
});

test('Stillness closes cleanly, preserves link focus, and permits the three shortcuts', () => {
  const h = readingModeHarness(true);
  h.key('a');
  h.key('c');
  assert.deepEqual([...h.classes], ['haki-stillness']);
  assert.equal(h.dialog.open, true);
  assert.equal(h.buttons[1].getAttribute('aria-pressed'), 'false');
  h.close.click();
  assert.equal(h.classes.size, 0);
  assert.equal(h.focused(), h.buttons[2]);
  h.key('c');
  h.link.focus();
  h.link.click();
  assert.equal(h.classes.size, 0);
  assert.equal(h.focused(), h.link);
  h.key('c');
  h.key('o');
  assert.equal(h.dialog.open, false);
  assert.deepEqual([...h.classes], ['haki-obs']);
  assert.equal(h.focused(), h.buttons[0]);
  h.key('o');
  assert.equal(h.classes.size, 0);
});

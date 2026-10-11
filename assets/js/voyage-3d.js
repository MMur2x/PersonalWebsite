/* Mayne Murray — 3D treasure chest for the final island of the Grand Line voyage. Three.js r128 from cdnjs. Each scene pauses offscreen, renders one still frame
   under reduced motion, and quietly does nothing without WebGL. */
(function () {
  'use strict';
  if (!window.THREE) return;
  var THREE = window.THREE;
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function stage(canvas, fov) {
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); }
    catch (e) { canvas.style.display = 'none'; return null; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputEncoding = THREE.sRGBEncoding;
    var scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(fov || 35, 1, .1, 100);
    scene.add(new THREE.HemisphereLight(0xfff4dc, 0x24435a, .9));
    var key = new THREE.DirectionalLight(0xffffff, .9); key.position.set(3, 5, 4); scene.add(key);
    var rim = new THREE.DirectionalLight(0x8fd8ff, .5); rim.position.set(-4, 2, -3); scene.add(rim);
    function size() {
      var w = canvas.clientWidth || 200, h = canvas.clientHeight || 200;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    size(); window.addEventListener('resize', size);
    var visible = true, frame = null, tick = null;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) loop(); }).observe(canvas);
    function loop() {
      if (frame) return;
      frame = requestAnimationFrame(function step(t) {
        frame = null;
        if (tick) tick(t / 1000);
        renderer.render(scene, camera);
        if (visible && !calm) frame = requestAnimationFrame(step);
      });
    }
    return { scene: scene, camera: camera, renderer: renderer, onTick: function (f) { tick = f; loop(); }, kick: loop };
  }

  /* ---------------------------------------------------------- the treasure chest */
  var chCanvas = document.querySelector('[data-scene="chest"]');
  if (chCanvas) (function () {
    var s = stage(chCanvas, 30); if (!s) return;
    s.camera.position.set(3.4, 2.8, 5.4); s.camera.lookAt(0, .35, 0);
    var g = new THREE.Group(); s.scene.add(g);
    var wood = new THREE.MeshStandardMaterial({ color: 0x5e3a1a, roughness: .75 });
    var dark = new THREE.MeshStandardMaterial({ color: 0x5a3415, roughness: .8 });
    var gold = new THREE.MeshStandardMaterial({ color: 0xf2c14e, metalness: .9, roughness: .25, emissive: 0x3a2400 });
    var iron = new THREE.MeshStandardMaterial({ color: 0x3a3a40, metalness: .7, roughness: .4 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(1.8, .9, 1.1), wood); body.position.y = .45; g.add(body);
    for (var i = -1; i <= 1; i += 2) { // iron bands
      var band = new THREE.Mesh(new THREE.BoxGeometry(.12, .94, 1.14), iron); band.position.set(i * .62, .45, 0); g.add(band);
    }
    var plankLine = new THREE.Mesh(new THREE.BoxGeometry(1.82, .04, 1.12), dark); plankLine.position.y = .45; g.add(plankLine);
    // coins inside
    var coins = new THREE.Group(); g.add(coins);
    var coinGeo = new THREE.CylinderGeometry(.11, .11, .03, 20);
    for (var c = 0; c < 70; c++) {
      var coin = new THREE.Mesh(coinGeo, gold);
      coin.position.set((Math.random() - .5) * 1.5, .85 + Math.random() * .22 - Math.abs((Math.random() - .5)) * .2, (Math.random() - .5) * .85);
      coin.rotation.set(Math.random() * .8, Math.random() * 3, Math.random() * .8);
      coins.add(coin);
    }
    var gem = new THREE.Mesh(new THREE.OctahedronGeometry(.13), new THREE.MeshStandardMaterial({ color: 0xd0173a, metalness: .3, roughness: .1, emissive: 0x400010 }));
    gem.position.set(.2, 1.08, .1); coins.add(gem);
    // the lid, hinged along the back edge
    var hinge = new THREE.Group(); hinge.position.set(0, .9, -.55); g.add(hinge);
    function halfTube(r, len, open) {
      var geo = new THREE.CylinderGeometry(r, r, len, 32, 1, open, -Math.PI / 2, Math.PI);
      geo.rotateZ(Math.PI / 2); geo.rotateX(-Math.PI / 2); return geo;
    }
    var lid = new THREE.Mesh(halfTube(.55, 1.8, false), wood); lid.position.set(0, 0, .55); hinge.add(lid);
    [-.62, .62].forEach(function (x) {
      var lb = new THREE.Mesh(halfTube(.575, .12, true), iron); lb.position.set(x, 0, .55); hinge.add(lb);
    });
    var lock = new THREE.Mesh(new THREE.BoxGeometry(.24, .26, .06), gold); lock.position.set(0, .8, .58); g.add(lock);
    var glow = new THREE.PointLight(0xffc35a, 0, 4); glow.position.set(0, 1.4, 0); g.add(glow);
    g.rotation.y = -.35;

    var open = false, amt = 0;
    document.addEventListener('chest:toggle', function (e) { open = !!e.detail; s.kick(); if (calm) { amt = open ? 1 : 0; apply(); } });
    function apply() { hinge.rotation.x = -amt * 1.9; glow.intensity = amt * 1.6; lock.position.y = .8 + amt * .5; lock.visible = amt < .5; }
    s.onTick(function (t) {
      amt += ((open ? 1 : 0) - amt) * .08; apply();
      g.rotation.y = -.35 + Math.sin(t * .5) * .12;
      gem.rotation.y = t * 1.5;
    });
  })();
})();

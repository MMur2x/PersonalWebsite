/* Mayne Murray — 3D pieces for the Grand Line voyage: the Log Pose (hero) and the treasure chest
   (final island). Three.js r128 from cdnjs. Each scene pauses offscreen, renders one still frame
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

  /* ---------------------------------------------------------- the Log Pose */
  var lpCanvas = document.querySelector('[data-scene="logpose"]');
  if (lpCanvas) (function () {
    var s = stage(lpCanvas, 32); if (!s) return;
    s.camera.position.set(0, 1.05, 6.4); s.camera.lookAt(0, .75, 0);
    var g = new THREE.Group(); s.scene.add(g);
    var wood = new THREE.MeshStandardMaterial({ color: 0x4e2c12, roughness: .7 });
    var brass = new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: .85, roughness: .3 });
    var leather = new THREE.MeshStandardMaterial({ color: 0x5a3415, roughness: .9 });
    // wrist strap and the cuff the instrument sits on
    var strap = new THREE.Mesh(new THREE.TorusGeometry(1.25, .2, 16, 64), leather);
    strap.rotation.x = Math.PI / 2; strap.scale.set(1, 1, .55); strap.position.y = -.35; g.add(strap);
    var buckle = new THREE.Mesh(new THREE.BoxGeometry(.42, .3, .1), brass); buckle.position.set(0, -.35, 1.25); g.add(buckle);
    var base = new THREE.Mesh(new THREE.CylinderGeometry(.95, 1.05, .45, 48), wood); base.position.y = -.05; g.add(base);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(.98, .06, 12, 64), brass); ring.rotation.x = Math.PI / 2; ring.position.y = .18; g.add(ring);
    for (var i = 0; i < 4; i++) { // brass pillars holding the globe
      var p = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 1.9, 8), brass);
      p.position.set(Math.cos(i * Math.PI / 2 + .78) * .8, 1.05, Math.sin(i * Math.PI / 2 + .78) * .8); g.add(p);
    }
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(.85, .85, .08, 48), brass); cap.position.y = 2; g.add(cap);
    // the glass globe
    var glass = new THREE.Mesh(new THREE.SphereGeometry(.78, 48, 32), new THREE.MeshPhongMaterial({ color: 0xcdeefa, transparent: true, opacity: .38, shininess: 160, specular: 0xffffff, depthWrite: false }));
    glass.position.y = 1.05; g.add(glass);
    var water = new THREE.Mesh(new THREE.SphereGeometry(.76, 32, 16, 0, Math.PI * 2, Math.PI * .72, Math.PI * .28), new THREE.MeshPhongMaterial({ color: 0x3aa0c8, transparent: true, opacity: .45 }));
    water.position.y = 1.05; g.add(water);
    // the floating needle: red point, white tail
    var needle = new THREE.Group(); needle.position.y = 1.05; g.add(needle);
    var red = new THREE.Mesh(new THREE.ConeGeometry(.09, .62, 16), new THREE.MeshStandardMaterial({ color: 0xc8323a, roughness: .4 }));
    red.rotation.z = -Math.PI / 2; red.position.x = .31; needle.add(red);
    var white = new THREE.Mesh(new THREE.ConeGeometry(.09, .62, 16), new THREE.MeshStandardMaterial({ color: 0xf2ede2, roughness: .4 }));
    white.rotation.z = Math.PI / 2; white.position.x = -.31; needle.add(white);
    needle.add(new THREE.Mesh(new THREE.SphereGeometry(.07, 16, 12), brass));
    g.rotation.x = .08;
    var shine = new THREE.Mesh(new THREE.SphereGeometry(.12, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .55 }));
    shine.scale.set(1, .6, .3); shine.position.set(-.38, 1.45, .62); g.add(shine);
    var halo = new THREE.Mesh(new THREE.TorusGeometry(.79, .015, 8, 64), new THREE.MeshBasicMaterial({ color: 0xe8f6ff, transparent: true, opacity: .6 }));
    halo.position.y = 1.05; g.add(halo);

    var spin = 0, px = 0, py = 0;
    document.addEventListener('logpose:spin', function () { spin = Math.PI * 4; s.kick(); });
    lpCanvas.parentElement.addEventListener('pointermove', function (e) {
      var b = lpCanvas.getBoundingClientRect(); px = (e.clientX - b.left) / b.width - .5; py = (e.clientY - b.top) / b.height - .5;
    });
    s.onTick(function (t) {
      g.rotation.y = t * .25 + px * .6;
      g.rotation.x = .08 + py * .25; halo.lookAt(s.camera.position.x, halo.position.y + 1.05, s.camera.position.z);
      if (spin > 0) { var d = Math.max(.08, spin * .06); spin -= d; needle.rotation.y += d; }
      else needle.rotation.y += Math.sin(t * 1.3) * .004;
      needle.position.y = 1.05 + Math.sin(t * 2) * .04;
    });
  })();

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

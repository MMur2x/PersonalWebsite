/* ==========================================================================
   scenes3d.js — WebGL scenes for the portfolio
   --------------------------------------------------------------------------
   Three scenes, one shared renderer pattern:

     network   hero      A distributed-network constellation with data pulses
                         travelling along its connections.
     lattice   projects  A deforming wireframe grid — a surface being sampled.
     globe     contact   A slowly turning wireframe sphere with orbit rings.

   Shared design rules:
   - Points are drawn with a custom shader (bright core + soft halo) rather
     than real spheres, so the glow costs one draw call and no bloom pass.
   - Every scene is skipped on narrow screens, when WebGL is unavailable, and
     when the visitor prefers reduced motion. The CSS gradients underneath are
     the fallback, so nothing looks broken without them.
   - Rendering pauses when the canvas is offscreen or the tab is hidden.
   - Additive blending is dark-mode only; the light theme switches to normal
     blending with darker marks, because additive on a pale ground is invisible.
   ========================================================================== */
(function () {
  'use strict';

  if (typeof THREE === 'undefined') return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || window.innerWidth < 768) return;

  try {
    var probe = document.createElement('canvas');
    if (!(probe.getContext('webgl') || probe.getContext('experimental-webgl'))) return;
  } catch (e) { return; }

  var BLUE    = new THREE.Color(0x0ea5e9);
  var VIOLET  = new THREE.Color(0x8b5cf6);
  var EMERALD = new THREE.Color(0x10b981);

  /* ----------------------------------------------------------------------
     Shared point shader
     ---------------------------------------------------------------------- */
  function makePointMaterial(renderer) {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uPixelRatio: { value: renderer.getPixelRatio() },
        uLight: { value: 0.0 }
      },
      vertexShader: [
        'attribute vec3 aColor;',
        'attribute float aSize;',
        'attribute float aAlpha;',
        'uniform float uPixelRatio;',
        'varying vec3 vColor;',
        'varying float vAlpha;',
        'void main() {',
        '  vColor = aColor;',
        '  vAlpha = aAlpha;',
        '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        '  gl_PointSize = aSize * 128.0 * uPixelRatio / -mv.z;',
        '  gl_Position = projectionMatrix * mv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vColor;',
        'varying float vAlpha;',
        'uniform float uLight;',
        'void main() {',
        '  vec2 uv = gl_PointCoord - vec2(0.5);',
        '  float d = length(uv);',
        '  if (d > 0.5) discard;',
        '  float core = smoothstep(0.16, 0.0, d);',
        '  float halo = pow(smoothstep(0.5, 0.0, d), 2.4);',
        '  float rim  = smoothstep(0.30, 0.22, d) * smoothstep(0.14, 0.22, d) * 0.55;',
        '  float a = (core * 0.95 + halo * 0.55 + rim) * vAlpha;',
        '  vec3 col = mix(vColor, vColor + vec3(0.35), core * 0.7);',
        '  col = mix(col, vColor * 0.82, uLight);',
        '  a = mix(a, (core * 1.0 + halo * 0.28) * vAlpha * 1.15, uLight);',
        '  gl_FragColor = vec4(col, a);',
        '}'
      ].join('\n')
    });
  }

  /* ----------------------------------------------------------------------
     Stage — renderer, camera, run loop, theme and visibility handling
     ---------------------------------------------------------------------- */
  function createStage(host, opts) {
    var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(opts.fov || 55, 1, 0.1, 200);
    camera.position.copy(opts.cameraPos);

    var pointMat = makePointMaterial(renderer);
    var lineMats = [];

    var stage = {
      renderer: renderer, scene: scene, camera: camera,
      pointMat: pointMat, isLight: false,
      registerLine: function (m) { lineMats.push(m); },
      lineOpacity: opts.lineOpacity || 0.8
    };

    function applyTheme() {
      var light = document.documentElement.getAttribute('data-theme') === 'light';
      stage.isLight = light;
      pointMat.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
      pointMat.uniforms.uLight.value = light ? 1.0 : 0.0;
      pointMat.needsUpdate = true;
      lineMats.forEach(function (m) {
        m.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
        m.opacity = light ? stage.lineOpacity * 0.5 : stage.lineOpacity;
        m.needsUpdate = true;
      });
    }
    applyTheme();
    if (window.MutationObserver) {
      new MutationObserver(applyTheme).observe(document.documentElement, {
        attributes: true, attributeFilter: ['data-theme']
      });
    }

    function resize() {
      var w = host.clientWidth || 1, h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      pointMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
      if (opts.onResize) opts.onResize(stage, w, h);
    }
    stage.resize = resize;

    var visible = true, running = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { visible = e[0].isIntersecting; },
        { threshold: 0 }).observe(host);
    }
    document.addEventListener('visibilitychange', function () {
      running = !document.hidden;
      if (running) clock.getDelta();
    });

    var clock = new THREE.Clock();
    function frame() {
      requestAnimationFrame(frame);
      if (!running || !visible) return;
      var dt = Math.min(clock.getDelta(), 0.05);
      opts.update(stage, dt, clock.elapsedTime);
      renderer.render(scene, camera);
    }

    // The builder creates its geometry after this returns, so rendering must
    // not begin until it calls start().
    stage.start = function () {
      resize();
      window.addEventListener('resize', resize, { passive: true });
      frame();
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { host.classList.add('is-ready'); });
      });
    };
    return stage;
  }

  /* Eased pointer position, shared by every scene. */
  var ptr = { tx: 0, ty: 0, x: 0, y: 0 };
  window.addEventListener('mousemove', function (e) {
    ptr.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    ptr.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });
  function easePointer(dt) {
    ptr.x += (ptr.tx - ptr.x) * Math.min(1, dt * 1.6);
    ptr.y += (ptr.ty - ptr.y) * Math.min(1, dt * 1.6);
  }

  /* ======================================================================
     SCENE 1 — network (hero)
     A constellation of nodes, sparse connections, and pulses of light that
     travel from node to node: the data actually moving through the graph.
     ====================================================================== */
  function buildNetwork(host) {
    var NODE_COUNT = 42, R = 6.4, MAX_LINK = 3.6;

    var seeds = [
      new THREE.Vector3( 0.6,  0.9, -0.4),
      new THREE.Vector3(-1.9, -1.4,  1.7),
      new THREE.Vector3( 2.2, -0.7, -1.9)
    ];
    var nodes = [];
    for (var i = 0; i < NODE_COUNT; i++) {
      var t = Math.pow(Math.random(), 0.62);
      var theta = Math.random() * Math.PI * 2;
      var phi = Math.acos(2 * Math.random() - 1);
      var r = t * R;
      var p = new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta) * 0.78,
        r * Math.cos(phi) * 0.92
      );
      p.lerp(seeds[i % seeds.length], 0.22 + Math.random() * 0.14);
      var size = 0.55 + Math.pow(Math.random(), 1.9) * 1.85;
      if (Math.random() < 0.09) size *= 2.3;
      nodes.push({
        base: p.clone(), pos: p.clone(), size: size,
        color: Math.random() < 0.66 ? BLUE : (Math.random() < 0.82 ? VIOLET : EMERALD),
        depth: (p.z + R) / (R * 2),
        driftAmp: 0.09 + Math.random() * 0.16,
        driftSpeed: 0.14 + Math.random() * 0.22,
        driftPhase: Math.random() * Math.PI * 2,
        pulses: Math.random() < 0.22,
        pulseSpeed: 0.22 + Math.random() * 0.25,
        pulsePhase: Math.random() * Math.PI * 2,
        flash: 0
      });
    }

    var links = [], seen = {}, deg = {};
    for (var a = 0; a < nodes.length; a++) {
      var cand = [];
      for (var b = 0; b < nodes.length; b++) {
        if (a === b) continue;
        var d = nodes[a].base.distanceTo(nodes[b].base);
        if (d < MAX_LINK) cand.push({ i: b, d: d });
      }
      cand.sort(function (x, y) { return x.d - y.d; });
      var made = 0;
      for (var c = 0; c < cand.length && made < 2; c++) {
        var j = cand[c].i, key = Math.min(a, j) + ':' + Math.max(a, j);
        if (seen[key] || (deg[j] || 0) >= 3 || Math.random() < 0.2) continue;
        seen[key] = 1; deg[a] = (deg[a] || 0) + 1; deg[j] = (deg[j] || 0) + 1;
        links.push([a, j]); made++;
      }
    }

    var stage = createStage(host, {
      fov: 55,
      cameraPos: new THREE.Vector3(0, 0, 15),
      lineOpacity: 0.8,
      onResize: function (st, w, h) {
        var halfH = Math.tan((st.camera.fov * Math.PI / 180) / 2) * st.camera.position.z;
        var halfW = halfH * st.camera.aspect;
        var scale = Math.min(1, Math.max(0.62, st.camera.aspect / 1.6));
        cluster.scale.setScalar(scale);
        cluster.position.x = halfW * 0.33;
        cluster.position.y = halfH * 0.04;
      },
      update: update
    });

    var cluster = new THREE.Group();
    stage.scene.add(cluster);

    var nPos = new Float32Array(nodes.length * 3),
        nCol = new Float32Array(nodes.length * 3),
        nSize = new Float32Array(nodes.length),
        nAlpha = new Float32Array(nodes.length);
    var nGeo = new THREE.BufferGeometry();
    nGeo.setAttribute('position', new THREE.BufferAttribute(nPos, 3));
    nGeo.setAttribute('aColor', new THREE.BufferAttribute(nCol, 3));
    nGeo.setAttribute('aSize', new THREE.BufferAttribute(nSize, 1));
    nGeo.setAttribute('aAlpha', new THREE.BufferAttribute(nAlpha, 1));
    cluster.add(new THREE.Points(nGeo, stage.pointMat));

    var segs = links.length * 2;
    var lPos = new Float32Array(segs * 2 * 3), lCol = new Float32Array(segs * 2 * 3);
    var lGeo = new THREE.BufferGeometry();
    lGeo.setAttribute('position', new THREE.BufferAttribute(lPos, 3));
    lGeo.setAttribute('color', new THREE.BufferAttribute(lCol, 3));
    var lMat = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.8,
      depthWrite: false, blending: THREE.AdditiveBlending
    });
    stage.registerLine(lMat);
    cluster.add(new THREE.LineSegments(lGeo, lMat));

    /* Pulses: a packet of light that rides one link, then hops to another.
       This is the "new" part of the scene — the graph now carries traffic. */
    var PULSE_COUNT = 14;
    var pulses = [];
    for (var k = 0; k < PULSE_COUNT; k++) {
      pulses.push({
        link: Math.floor(Math.random() * links.length),
        t: Math.random(),
        speed: 0.18 + Math.random() * 0.3,
        dir: Math.random() < 0.5 ? 1 : -1,
        color: Math.random() < 0.55 ? BLUE : (Math.random() < 0.7 ? EMERALD : VIOLET)
      });
    }
    var pPos = new Float32Array(PULSE_COUNT * 3),
        pCol = new Float32Array(PULSE_COUNT * 3),
        pSize = new Float32Array(PULSE_COUNT),
        pAlpha = new Float32Array(PULSE_COUNT);
    var pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('aColor', new THREE.BufferAttribute(pCol, 3));
    pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
    pGeo.setAttribute('aAlpha', new THREE.BufferAttribute(pAlpha, 1));
    cluster.add(new THREE.Points(pGeo, stage.pointMat));

    // Haze between the depth layers
    var HZ = 7;
    var hPos = new Float32Array(HZ * 3), hCol = new Float32Array(HZ * 3),
        hSize = new Float32Array(HZ), hAlpha = new Float32Array(HZ);
    for (var h = 0; h < HZ; h++) {
      hPos[h*3] = (Math.random()-0.5)*9; hPos[h*3+1] = (Math.random()-0.5)*7; hPos[h*3+2] = (Math.random()-0.5)*9;
      var hc = h % 3 === 0 ? VIOLET : BLUE;
      hCol[h*3] = hc.r; hCol[h*3+1] = hc.g; hCol[h*3+2] = hc.b;
      hSize[h] = 9 + Math.random()*7;
      hAlpha[h] = 0.035 + Math.random()*0.03;
    }
    var hGeo = new THREE.BufferGeometry();
    hGeo.setAttribute('position', new THREE.BufferAttribute(hPos, 3));
    hGeo.setAttribute('aColor', new THREE.BufferAttribute(hCol, 3));
    hGeo.setAttribute('aSize', new THREE.BufferAttribute(hSize, 1));
    hGeo.setAttribute('aAlpha', new THREE.BufferAttribute(hAlpha, 1));
    cluster.add(new THREE.Points(hGeo, stage.pointMat));

    var SPIN = (Math.PI * 2) / 30;

    function update(st, dt, time) {
      cluster.rotation.y += SPIN * dt;

      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        var ph = time * n.driftSpeed + n.driftPhase;
        n.pos.set(
          n.base.x + Math.sin(ph) * n.driftAmp,
          n.base.y + Math.cos(ph * 0.83) * n.driftAmp,
          n.base.z + Math.sin(ph * 0.61) * n.driftAmp * 0.7
        );
        nPos[i*3] = n.pos.x; nPos[i*3+1] = n.pos.y; nPos[i*3+2] = n.pos.z;
        nCol[i*3] = n.color.r; nCol[i*3+1] = n.color.g; nCol[i*3+2] = n.color.b;

        // a node brightens briefly when a pulse arrives
        n.flash = Math.max(0, n.flash - dt * 2.2);
        nSize[i] = n.size * (1 + n.flash * 0.5);

        var alpha = 0.55 + n.depth * 0.45;
        if (n.pulses) alpha *= 0.72 + 0.4 * (0.5 + 0.5 * Math.sin(time * n.pulseSpeed * Math.PI * 2 + n.pulsePhase));
        nAlpha[i] = Math.min(1.4, alpha + n.flash * 0.6);
      }
      nGeo.attributes.position.needsUpdate = true;
      nGeo.attributes.aColor.needsUpdate = true;
      nGeo.attributes.aSize.needsUpdate = true;
      nGeo.attributes.aAlpha.needsUpdate = true;

      for (var l = 0; l < links.length; l++) {
        var na = nodes[links[l][0]], nb = nodes[links[l][1]];
        var mx = (na.pos.x+nb.pos.x)/2, my = (na.pos.y+nb.pos.y)/2, mz = (na.pos.z+nb.pos.z)/2;
        var o = l * 12;
        lPos[o]=na.pos.x; lPos[o+1]=na.pos.y; lPos[o+2]=na.pos.z;
        lPos[o+3]=mx; lPos[o+4]=my; lPos[o+5]=mz;
        lPos[o+6]=mx; lPos[o+7]=my; lPos[o+8]=mz;
        lPos[o+9]=nb.pos.x; lPos[o+10]=nb.pos.y; lPos[o+11]=nb.pos.z;
        var fade = 0.14, e = st.isLight ? 0.55 : 0.95;
        lCol[o]=na.color.r*e; lCol[o+1]=na.color.g*e; lCol[o+2]=na.color.b*e;
        lCol[o+3]=na.color.r*fade; lCol[o+4]=na.color.g*fade; lCol[o+5]=na.color.b*fade;
        lCol[o+6]=nb.color.r*fade; lCol[o+7]=nb.color.g*fade; lCol[o+8]=nb.color.b*fade;
        lCol[o+9]=nb.color.r*e; lCol[o+10]=nb.color.g*e; lCol[o+11]=nb.color.b*e;
      }
      lGeo.attributes.position.needsUpdate = true;
      lGeo.attributes.color.needsUpdate = true;

      for (var q = 0; q < pulses.length; q++) {
        var pu = pulses[q];
        pu.t += pu.speed * pu.dir * dt;
        if (pu.t > 1 || pu.t < 0) {
          // arrived: flash the destination node, then hop to a link that
          // touches it so the packet appears to keep travelling the graph
          var lk = links[pu.link];
          var arrivedAt = pu.dir > 0 ? lk[1] : lk[0];
          nodes[arrivedAt].flash = 1;
          var options = [];
          for (var z = 0; z < links.length; z++) {
            if (links[z][0] === arrivedAt || links[z][1] === arrivedAt) options.push(z);
          }
          if (options.length) {
            pu.link = options[Math.floor(Math.random() * options.length)];
            var nl = links[pu.link];
            pu.dir = nl[0] === arrivedAt ? 1 : -1;
            pu.t = pu.dir > 0 ? 0 : 1;
          } else {
            pu.link = Math.floor(Math.random() * links.length);
            pu.t = 0; pu.dir = 1;
          }
        }
        var L = links[pu.link], A = nodes[L[0]].pos, B = nodes[L[1]].pos;
        pPos[q*3]   = A.x + (B.x - A.x) * pu.t;
        pPos[q*3+1] = A.y + (B.y - A.y) * pu.t;
        pPos[q*3+2] = A.z + (B.z - A.z) * pu.t;
        pCol[q*3] = pu.color.r; pCol[q*3+1] = pu.color.g; pCol[q*3+2] = pu.color.b;
        pSize[q] = 0.5;
        // fade in and out at the ends so packets don't pop
        pAlpha[q] = Math.sin(Math.min(1, Math.max(0, pu.t)) * Math.PI) * 1.1;
      }
      pGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.aColor.needsUpdate = true;
      pGeo.attributes.aSize.needsUpdate = true;
      pGeo.attributes.aAlpha.needsUpdate = true;

      easePointer(dt);
      st.camera.position.x = ptr.x * 1.15;
      st.camera.position.y = -ptr.y * 0.75;
      st.camera.lookAt(cluster.position.x * 0.55, 0, 0);
    }

    stage.start();
  }

  /* ======================================================================
     SCENE 2 — lattice (projects)
     A wireframe grid deformed by travelling waves, with bright vertices at
     the crests. Reads as a surface being sampled: quiet, wide, architectural.
     ====================================================================== */
  function buildLattice(host) {
    var COLS = 34, ROWS = 18, SPACING = 0.72;

    var stage = createStage(host, {
      fov: 48,
      cameraPos: new THREE.Vector3(0, 4.6, 11),
      lineOpacity: 0.55,
      update: update
    });
    stage.camera.lookAt(0, 0, 0);

    var grid = new THREE.Group();
    grid.rotation.x = -0.62;
    stage.scene.add(grid);

    var count = COLS * ROWS;
    var vPos = new Float32Array(count * 3),
        vCol = new Float32Array(count * 3),
        vSize = new Float32Array(count),
        vAlpha = new Float32Array(count);

    function idx(c, r) { return r * COLS + c; }
    for (var r0 = 0; r0 < ROWS; r0++) {
      for (var c0 = 0; c0 < COLS; c0++) {
        var i = idx(c0, r0);
        vPos[i*3]   = (c0 - (COLS - 1) / 2) * SPACING;
        vPos[i*3+1] = 0;
        vPos[i*3+2] = (r0 - (ROWS - 1) / 2) * SPACING;
      }
    }

    var vGeo = new THREE.BufferGeometry();
    vGeo.setAttribute('position', new THREE.BufferAttribute(vPos, 3));
    vGeo.setAttribute('aColor', new THREE.BufferAttribute(vCol, 3));
    vGeo.setAttribute('aSize', new THREE.BufferAttribute(vSize, 1));
    vGeo.setAttribute('aAlpha', new THREE.BufferAttribute(vAlpha, 1));
    grid.add(new THREE.Points(vGeo, stage.pointMat));

    // Wire segments: right and down neighbours only, so each edge is drawn once
    var pairs = [];
    for (var r1 = 0; r1 < ROWS; r1++) {
      for (var c1 = 0; c1 < COLS; c1++) {
        if (c1 < COLS - 1) pairs.push([idx(c1, r1), idx(c1 + 1, r1)]);
        if (r1 < ROWS - 1) pairs.push([idx(c1, r1), idx(c1, r1 + 1)]);
      }
    }
    var wPos = new Float32Array(pairs.length * 2 * 3),
        wCol = new Float32Array(pairs.length * 2 * 3);
    var wGeo = new THREE.BufferGeometry();
    wGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3));
    wGeo.setAttribute('color', new THREE.BufferAttribute(wCol, 3));
    var wMat = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.55,
      depthWrite: false, blending: THREE.AdditiveBlending
    });
    stage.registerLine(wMat);
    grid.add(new THREE.LineSegments(wGeo, wMat));

    var tmp = new THREE.Color();

    function update(st, dt, time) {
      var halfC = (COLS - 1) / 2, halfR = (ROWS - 1) / 2;
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          var i = idx(c, r);
          var x = (c - halfC) * SPACING, z = (r - halfR) * SPACING;
          // two crossing waves plus a slow radial ripple
          var y = Math.sin(x * 0.55 + time * 0.7) * 0.42
                + Math.cos(z * 0.7 - time * 0.45) * 0.34
                + Math.sin((Math.sqrt(x*x + z*z)) * 0.5 - time * 0.9) * 0.26;
          vPos[i*3+1] = y;

          var lift = (y + 1.0) / 2.0;                    // 0 trough .. 1 crest
          var falloff = 1 - Math.min(1, Math.abs(x) / (halfC * SPACING * 1.05));
          tmp.copy(BLUE).lerp(VIOLET, Math.min(1, Math.max(0, lift)));
          if (lift > 0.78) tmp.lerp(EMERALD, (lift - 0.78) * 2.2);
          vCol[i*3] = tmp.r; vCol[i*3+1] = tmp.g; vCol[i*3+2] = tmp.b;
          vSize[i] = 0.24 + lift * 0.5;
          vAlpha[i] = (0.3 + lift * 0.85) * (0.4 + falloff * 0.6);
        }
      }
      vGeo.attributes.position.needsUpdate = true;
      vGeo.attributes.aColor.needsUpdate = true;
      vGeo.attributes.aSize.needsUpdate = true;
      vGeo.attributes.aAlpha.needsUpdate = true;

      var dim = st.isLight ? 0.5 : 1.0;
      for (var p = 0; p < pairs.length; p++) {
        var ia = pairs[p][0], ib = pairs[p][1], o = p * 6;
        wPos[o]   = vPos[ia*3];   wPos[o+1] = vPos[ia*3+1]; wPos[o+2] = vPos[ia*3+2];
        wPos[o+3] = vPos[ib*3];   wPos[o+4] = vPos[ib*3+1]; wPos[o+5] = vPos[ib*3+2];
        var fa = vAlpha[ia] * 0.85 * dim, fb = vAlpha[ib] * 0.85 * dim;
        wCol[o]   = vCol[ia*3]*fa; wCol[o+1] = vCol[ia*3+1]*fa; wCol[o+2] = vCol[ia*3+2]*fa;
        wCol[o+3] = vCol[ib*3]*fb; wCol[o+4] = vCol[ib*3+1]*fb; wCol[o+5] = vCol[ib*3+2]*fb;
      }
      wGeo.attributes.position.needsUpdate = true;
      wGeo.attributes.color.needsUpdate = true;

      easePointer(dt);
      grid.rotation.z = ptr.x * 0.05;
      st.camera.position.y = 4.6 - ptr.y * 0.5;
      st.camera.lookAt(0, 0, 0);
    }

    stage.start();
  }

  /* ======================================================================
     SCENE 3 — globe (contact)
     A wireframe sphere with latitude/longitude lines, a scatter of surface
     points, and two tilted orbit rings. Signals "reachable from anywhere"
     without resorting to a literal map.
     ====================================================================== */
  function buildGlobe(host) {
    var RADIUS = 3.3;

    var stage = createStage(host, {
      fov: 45,
      cameraPos: new THREE.Vector3(0, 0, 12),
      lineOpacity: 0.45,
      update: update
    });

    var globe = new THREE.Group();
    globe.rotation.z = 0.28;
    stage.scene.add(globe);

    // Wire sphere
    var wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.SphereGeometry(RADIUS, 22, 14)),
      new THREE.LineBasicMaterial({
        color: 0x0ea5e9, transparent: true, opacity: 0.45,
        depthWrite: false, blending: THREE.AdditiveBlending
      })
    );
    stage.registerLine(wire.material);
    globe.add(wire);

    // Surface points, distributed with a Fibonacci sphere so they stay even
    var PN = 150;
    var sPos = new Float32Array(PN * 3), sCol = new Float32Array(PN * 3),
        sSize = new Float32Array(PN), sAlpha = new Float32Array(PN);
    var seedPts = [];
    var golden = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < PN; i++) {
      var y = 1 - (i / (PN - 1)) * 2;
      var rad = Math.sqrt(Math.max(0, 1 - y * y));
      var th = golden * i;
      var v = new THREE.Vector3(Math.cos(th) * rad, y, Math.sin(th) * rad).multiplyScalar(RADIUS * 1.004);
      var col = Math.random() < 0.72 ? BLUE : (Math.random() < 0.7 ? VIOLET : EMERALD);
      seedPts.push({ v: v, col: col, base: 0.1 + Math.random() * 0.22,
                     sp: 0.3 + Math.random() * 0.7, ph: Math.random() * Math.PI * 2 });
      sPos[i*3] = v.x; sPos[i*3+1] = v.y; sPos[i*3+2] = v.z;
      sCol[i*3] = col.r; sCol[i*3+1] = col.g; sCol[i*3+2] = col.b;
    }
    var sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    sGeo.setAttribute('aColor', new THREE.BufferAttribute(sCol, 3));
    sGeo.setAttribute('aSize', new THREE.BufferAttribute(sSize, 1));
    sGeo.setAttribute('aAlpha', new THREE.BufferAttribute(sAlpha, 1));
    globe.add(new THREE.Points(sGeo, stage.pointMat));

    // Orbit rings — drawn as line loops, tilted apart
    var rings = [];
    [[RADIUS * 1.45, 0.5, 0.25], [RADIUS * 1.75, -0.9, 0.16]].forEach(function (cfg) {
      var pts = [];
      for (var a = 0; a <= 96; a++) {
        var t = (a / 96) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(t) * cfg[0], 0, Math.sin(t) * cfg[0]));
      }
      var g = new THREE.BufferGeometry().setFromPoints(pts);
      var m = new THREE.LineBasicMaterial({
        color: 0x8b5cf6, transparent: true, opacity: cfg[2],
        depthWrite: false, blending: THREE.AdditiveBlending
      });
      stage.registerLine(m);
      var loop = new THREE.Line(g, m);
      loop.rotation.x = cfg[1];
      stage.scene.add(loop);
      rings.push({ obj: loop, speed: 0.1 + Math.random() * 0.12 });

      // a travelling marker on each ring
      var mp = new Float32Array(3), mc = new Float32Array(3),
          ms = new Float32Array(1), ma = new Float32Array(1);
      mc[0] = VIOLET.r; mc[1] = VIOLET.g; mc[2] = VIOLET.b;
      ms[0] = 0.55; ma[0] = 1.0;
      var mg = new THREE.BufferGeometry();
      mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
      mg.setAttribute('aColor', new THREE.BufferAttribute(mc, 3));
      mg.setAttribute('aSize', new THREE.BufferAttribute(ms, 1));
      mg.setAttribute('aAlpha', new THREE.BufferAttribute(ma, 1));
      var marker = new THREE.Points(mg, stage.pointMat);
      loop.add(marker);
      rings[rings.length - 1].marker = { geo: mg, arr: mp, r: cfg[0] };
    });

    function update(st, dt, time) {
      globe.rotation.y += 0.085 * dt;

      for (var i = 0; i < seedPts.length; i++) {
        var sp = seedPts[i];
        sSize[i] = sp.base + Math.sin(time * sp.sp + sp.ph) * 0.06;
        sAlpha[i] = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(time * sp.sp * 0.8 + sp.ph));
      }
      sGeo.attributes.aSize.needsUpdate = true;
      sGeo.attributes.aAlpha.needsUpdate = true;

      rings.forEach(function (rg, n) {
        rg.obj.rotation.z += rg.speed * dt;
        var ang = time * (0.5 + n * 0.25);
        rg.marker.arr[0] = Math.cos(ang) * rg.marker.r;
        rg.marker.arr[1] = 0;
        rg.marker.arr[2] = Math.sin(ang) * rg.marker.r;
        rg.marker.geo.attributes.position.needsUpdate = true;
      });

      easePointer(dt);
      st.camera.position.x = ptr.x * 1.6;
      st.camera.position.y = -ptr.y * 1.1;
      st.camera.lookAt(0, 0, 0);
    }

    stage.start();
  }

  /* ======================================================================
     SCENE 4 — floaters (page-anchored ambient geometry)
     Wireframe solids that belong to the DOCUMENT, not the viewport: each one
     holds a fixed page position and scrolls away with the content, exactly
     like an image would. They drift only under their own velocity, never
     because you scrolled.

     The canvas itself stays viewport-sized and fixed — a canvas as tall as
     the whole document would be an enormous framebuffer — and each shape's
     screen position is derived as (pageY - scrollY) every frame.

     They roam the full width of the page rather than sitting in one lane,
     so they read as drifting through the document. Opacity is kept low
     precisely because they will cross text on their way.
     ====================================================================== */
  function buildFloaters(host) {
    var PPU = 100;              // pixels per world unit
    var BUBBLE_PX = 6;          // bubble extends 6px from the cursor
    var REACH_PX = 74;          // how close before a shape reacts

    var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
    camera.position.z = 10;

    var vw = 1, vh = 1, halfW = 1, halfH = 1, docH = 1;

    function shapeGeometry(kind, r) {
      switch (kind) {
        case 0: return new THREE.IcosahedronGeometry(r, 0);
        case 1: return new THREE.OctahedronGeometry(r, 0);
        case 2: return new THREE.TetrahedronGeometry(r * 1.15, 0);
        case 3: return new THREE.BoxGeometry(r * 1.3, r * 1.3, r * 1.3);
        case 4: return new THREE.TorusGeometry(r, r * 0.36, 8, 16);
        case 5: return new THREE.DodecahedronGeometry(r, 0);
        default: return new THREE.IcosahedronGeometry(r, 1);
      }
    }

    var COUNT = 30;
    var shapes = [];
    for (var i = 0; i < COUNT; i++) {
      var r = 0.18 + Math.random() * 0.30;
      var col = Math.random() < 0.6 ? BLUE : (Math.random() < 0.65 ? VIOLET : EMERALD);
      var mat = new THREE.LineBasicMaterial({
        color: col.clone(), transparent: true,
        opacity: 0.15 + Math.random() * 0.19,
        depthWrite: false, blending: THREE.AdditiveBlending
      });
      var mesh = new THREE.LineSegments(
        new THREE.WireframeGeometry(shapeGeometry(i % 7, r)), mat);
      scene.add(mesh);
      shapes.push({
        mesh: mesh, mat: mat, r: r,
        pageX: 0, pageY: 0,             // position in DOCUMENT space (px)
        // Every shape gets its own drift, spin and phase — nothing is in step.
        vx: (Math.random() - 0.5) * 15,
        vy: (Math.random() - 0.5) * 11,
        rx: (Math.random() - 0.5) * 0.5,
        ry: (Math.random() - 0.5) * 0.5,
        rz: (Math.random() - 0.5) * 0.35,
        baseOpacity: mat.opacity,
        placed: false
      });
    }

    /* --- the bubble -----------------------------------------------------
       Drawn as a single shader point rather than ring geometry: at a 6px
       radius a real mesh ring aliases badly, whereas a sprite can be given
       a soft sub-pixel rim. The look is a soap film — a thin bright edge,
       a faint iridescent lean toward violet on one side, and almost nothing
       in the middle.
       ------------------------------------------------------------------ */
    var bubbleGeo = new THREE.BufferGeometry();
    bubbleGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 5]), 3));
    var bubbleMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uSize: { value: BUBBLE_PX * 2.6 * renderer.getPixelRatio() },
        uStrength: { value: 0.0 }
      },
      vertexShader: [
        'uniform float uSize;',
        'void main() {',
        '  gl_PointSize = uSize;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform float uStrength;',
        'void main() {',
        '  vec2 uv = gl_PointCoord - vec2(0.5);',
        '  float d = length(uv) * 2.0;',        // 0 centre .. 1 sprite edge
        '  if (d > 1.0) discard;',
        // thin film rim sitting just inside the sprite edge
        '  float rim = smoothstep(0.72, 0.88, d) * (1.0 - smoothstep(0.88, 1.0, d));',
        // barely-there interior, brighter at the very edge of the dome
        '  float fill = pow(d, 3.0) * 0.10;',
        // faint iridescence: the film leans violet on one side, cyan the other
        '  vec3 cyan   = vec3(0.42, 0.80, 0.95);',
        '  vec3 violet = vec3(0.62, 0.48, 0.95);',
        '  vec3 col = mix(cyan, violet, clamp(uv.y * 2.0 + 0.5, 0.0, 1.0));',
        '  float a = (rim * 0.55 + fill) * uStrength;',
        '  gl_FragColor = vec4(col, a);',
        '}'
      ].join('\n')
    });
    var bubble = new THREE.Points(bubbleGeo, bubbleMat);
    scene.add(bubble);

    var mouse = { sx: -9999, sy: -9999, active: false };
    window.addEventListener('mousemove', function (e) {
      mouse.sx = e.clientX; mouse.sy = e.clientY; mouse.active = true;
    }, { passive: true });
    window.addEventListener('mouseleave', function () { mouse.active = false; });

    function measure() {
      vw = window.innerWidth; vh = window.innerHeight;
      renderer.setSize(vw, vh, false);
      halfW = (vw / 2) / PPU; halfH = (vh / 2) / PPU;
      camera.left = -halfW; camera.right = halfW;
      camera.top = halfH; camera.bottom = -halfH;
      camera.updateProjectionMatrix();
      bubbleMat.uniforms.uSize.value = BUBBLE_PX * 2.6 * renderer.getPixelRatio();

      docH = Math.max(
        document.documentElement.scrollHeight,
        document.body ? document.body.scrollHeight : 0
      );

      shapes.forEach(function (sh) {
        if (sh.placed) return;
        sh.placed = true;
        // spread down the whole document, not just the first screen
        // spread down the whole document, and across its whole width
        sh.pageY = 120 + Math.random() * Math.max(400, docH - 240);
        sh.pageX = 60 + Math.random() * Math.max(120, vw - 120);
      });
    }

    function applyTheme() {
      var light = document.documentElement.getAttribute('data-theme') === 'light';
      shapes.forEach(function (sh) {
        sh.mat.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
        sh.mat.opacity = light ? sh.baseOpacity * 0.7 : sh.baseOpacity;
        sh.mat.needsUpdate = true;
      });
      bubbleMat.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
    }
    applyTheme();
    if (window.MutationObserver) {
      new MutationObserver(applyTheme).observe(document.documentElement,
        { attributes: true, attributeFilter: ['data-theme'] });
    }

    var running = true;
    document.addEventListener('visibilitychange', function () {
      running = !document.hidden;
      if (running) clock.getDelta();
    });

    var clock = new THREE.Clock();
    var strength = 0;

    function frame() {
      requestAnimationFrame(frame);
      if (!running) return;
      var dt = Math.min(clock.getDelta(), 0.05);

      var scrollY = window.scrollY || window.pageYOffset || 0;
      var nearestPx = 1e9;

      for (var i = 0; i < shapes.length; i++) {
        var sh = shapes[i];

        // Own drift only. Scrolling never moves a shape in page space.
        sh.pageX += sh.vx * dt;
        sh.pageY += sh.vy * dt;

        var screenY = sh.pageY - scrollY;
        var screenX = sh.pageX;

        if (mouse.active) {
          var dx = screenX - mouse.sx, dy = screenY - mouse.sy;
          var dist = Math.sqrt(dx * dx + dy * dy);
          nearestPx = Math.min(nearestPx, dist - sh.r * PPU);
          var reach = REACH_PX + sh.r * PPU;
          if (dist < reach && dist > 0.001) {
            var push = 1 - dist / reach;
            var f = push * push * 620 * dt;         // px/s^2
            sh.vx += (dx / dist) * f;
            sh.vy += (dy / dist) * f;
            sh.mesh.rotation.z += push * dt * 2.0;
          }
        }

        // drag back to a lazy drift
        var damp = 1 - Math.min(1, dt * 1.1);
        sh.vx *= damp; sh.vy *= damp;
        if (Math.abs(sh.vx) < 3) sh.vx += (sh.vx >= 0 ? 1 : -1) * 3 * dt;

        // bounce off the left and right edges of the page
        var pad = sh.r * PPU + 8;
        if (sh.pageX < pad)      { sh.pageX = pad;      sh.vx =  Math.abs(sh.vx); }
        if (sh.pageX > vw - pad) { sh.pageX = vw - pad; sh.vx = -Math.abs(sh.vx); }
        // and inside the document vertically
        if (sh.pageY < 80)        { sh.pageY = 80;        sh.vy =  Math.abs(sh.vy); }
        if (sh.pageY > docH - 80) { sh.pageY = docH - 80; sh.vy = -Math.abs(sh.vy); }

        // cull anything off-screen rather than drawing it
        var margin = sh.r * PPU + 60;
        var onScreen = screenY > -margin && screenY < vh + margin;
        sh.mesh.visible = onScreen;
        if (!onScreen) continue;

        sh.mesh.position.set(
          (screenX - vw / 2) / PPU,
          -(screenY - vh / 2) / PPU,
          0
        );
        sh.mesh.rotation.x += sh.rx * dt;
        sh.mesh.rotation.y += sh.ry * dt;
        sh.mesh.rotation.z += sh.rz * dt;
      }

      bubble.position.set((mouse.sx - vw / 2) / PPU, -(mouse.sy - vh / 2) / PPU, 5);
      var want = (mouse.active && nearestPx < REACH_PX * 1.5)
        ? Math.min(1, (REACH_PX * 1.5 - nearestPx) / (REACH_PX * 1.1)) : 0;
      strength += (want - strength) * Math.min(1, dt * 8);
      bubbleMat.uniforms.uStrength.value = strength * 0.72;

      renderer.render(scene, camera);
    }

    measure();
    window.addEventListener('resize', measure, { passive: true });
    // The document grows as images and scenes settle; re-measure its height.
    setTimeout(measure, 1200);
    setTimeout(measure, 3500);

    frame();
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { host.classList.add('is-ready'); });
    });
  }

  /* ======================================================================
     SCENE 5 — knot (experience)
     A (3,7) torus knot traced by ~7,000 points, each offset into a tube
     around the curve so the strand reads as a solid rope of light. A bright
     band travels along the curve parameter, so you can watch a signal run
     the whole length of it. This is the highest-detail scene on the site.
     ====================================================================== */
  function buildKnot(host) {
    var COUNT = 7000;
    var P = 3, Q = 7;          // knot winding numbers
    var R = 2.5, TUBE = 0.52;

    var stage = createStage(host, {
      fov: 48,
      cameraPos: new THREE.Vector3(0, 0, 13),
      lineOpacity: 0.4,
      onResize: function (st) {
        var scale = Math.min(1.12, Math.max(0.6, st.camera.aspect / 1.5));
        knot.scale.setScalar(scale);
      },
      update: update
    });

    var knot = new THREE.Group();
    knot.rotation.z = 0.5;
    stage.scene.add(knot);

    var pos = new Float32Array(COUNT * 3),
        col = new Float32Array(COUNT * 3),
        siz = new Float32Array(COUNT),
        alp = new Float32Array(COUNT);
    var tParam = new Float32Array(COUNT);   // where each point sits on the curve

    var tmpC = new THREE.Color();
    var curve = new THREE.Vector3(), tangent = new THREE.Vector3(),
        normal = new THREE.Vector3(), binormal = new THREE.Vector3(),
        up = new THREE.Vector3(0, 1, 0);

    function knotPoint(t, out) {
      // standard (p,q) torus knot
      var u = t * Math.PI * 2 * P;
      var qv = Q / P * u;
      var cs = Math.cos(qv);
      out.set(
        (R + TUBE * 2.4 * cs) * Math.cos(u),
        (R + TUBE * 2.4 * cs) * Math.sin(u),
        TUBE * 2.4 * Math.sin(qv)
      );
      return out;
    }

    var pA = new THREE.Vector3(), pB = new THREE.Vector3();
    for (var i = 0; i < COUNT; i++) {
      var t = i / COUNT;
      tParam[i] = t;
      knotPoint(t, pA);
      knotPoint(t + 0.0004, pB);
      tangent.subVectors(pB, pA).normalize();
      normal.crossVectors(tangent, up).normalize();
      binormal.crossVectors(tangent, normal).normalize();

      // scatter into a tube cross-section, denser near the core
      var ang = Math.random() * Math.PI * 2;
      var rad = Math.pow(Math.random(), 0.55) * TUBE;
      curve.copy(pA)
        .addScaledVector(normal, Math.cos(ang) * rad)
        .addScaledVector(binormal, Math.sin(ang) * rad);

      pos[i*3] = curve.x; pos[i*3+1] = curve.y; pos[i*3+2] = curve.z;

      // colour cycles around the knot so the winding is legible
      tmpC.copy(BLUE).lerp(VIOLET, 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * P));
      if (Math.random() < 0.05) tmpC.lerp(EMERALD, 0.75);
      col[i*3] = tmpC.r; col[i*3+1] = tmpC.g; col[i*3+2] = tmpC.b;

      siz[i] = 0.16 + (1 - rad / TUBE) * 0.3;
      alp[i] = 0.22 + (1 - rad / TUBE) * 0.5;
    }

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alp, 1));
    knot.add(new THREE.Points(geo, stage.pointMat));

    var baseAlpha = alp.slice(0);
    var baseSize = siz.slice(0);

    function update(st, dt, time) {
      knot.rotation.y += 0.16 * dt;
      knot.rotation.x = Math.sin(time * 0.12) * 0.22;

      // a bright band sweeping along the curve, wrapping at the seam
      var head = (time * 0.11) % 1;
      for (var i = 0; i < COUNT; i++) {
        var d = Math.abs(tParam[i] - head);
        if (d > 0.5) d = 1 - d;
        var glow = Math.max(0, 1 - d / 0.06);
        glow = glow * glow;
        alp[i] = Math.min(1.5, baseAlpha[i] + glow * 0.9);
        siz[i] = baseSize[i] * (1 + glow * 1.6);
      }
      geo.attributes.aAlpha.needsUpdate = true;
      geo.attributes.aSize.needsUpdate = true;

      easePointer(dt);
      st.camera.position.x = ptr.x * 1.5;
      st.camera.position.y = -ptr.y * 1.1;
      st.camera.lookAt(0, 0, 0);
    }

    stage.start();
  }

  /* ---------------------------------------------------------------------- */
  var BUILDERS = {
    network: buildNetwork, lattice: buildLattice, globe: buildGlobe,
    floaters: buildFloaters, knot: buildKnot
  };

  document.querySelectorAll('[data-scene]').forEach(function (host) {
    var kind = host.getAttribute('data-scene');
    var fn = BUILDERS[kind];
    if (!fn) return;
    try { fn(host); } catch (e) {
      // A failed scene must never take the page down — the CSS behind it stands in.
      if (window.console && console.warn) console.warn('scene "' + kind + '" failed:', e);
    }
  });
})();

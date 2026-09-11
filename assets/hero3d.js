/* ==========================================================================
   hero3d.js — abstract distributed-network hero scene
   --------------------------------------------------------------------------
   A cluster of glowing nodes connected by thin luminous lines, biased to the
   right of frame so the headline on the left stays legible.

   Design notes:
   - Nodes are rendered as GL points with a custom shader (bright core + soft
     halo) rather than real spheres. This gives the emissive-glass glow without
     needing post-processing bloom, which keeps the whole thing to one draw
     call and runs fine on integrated graphics.
   - Each connection is split into two segments so colour can fade toward the
     midpoint: bright where it meets a node, dim between.
   - Skipped entirely on narrow screens and when the visitor prefers reduced
     motion. The CSS aurora gradient underneath is the fallback.
   ========================================================================== */
(function () {
  'use strict';

  var host = document.getElementById('hero-canvas');
  if (!host) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || window.innerWidth < 768) return;
  if (typeof THREE === 'undefined') return;

  // WebGL availability check — some locked-down machines have it disabled.
  try {
    var probe = document.createElement('canvas');
    if (!(probe.getContext('webgl') || probe.getContext('experimental-webgl'))) return;
  } catch (e) { return; }

  /* --------------------------------------------------------------------
     Palette — blue dominant, violet secondary, emerald as a rare accent
     -------------------------------------------------------------------- */
  var BLUE    = new THREE.Color(0x0ea5e9);
  var VIOLET  = new THREE.Color(0x8b5cf6);
  var EMERALD = new THREE.Color(0x10b981);

  function pickColor(r) {
    if (r < 0.66) return BLUE;
    if (r < 0.94) return VIOLET;
    return EMERALD;
  }

  var NODE_COUNT = 42;
  var CLUSTER_RADIUS = 6.4;

  /* --------------------------------------------------------------------
     Renderer / scene / camera
     -------------------------------------------------------------------- */
  var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  host.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(55, 1, 0.1, 120);
  camera.position.set(0, 0, 15);

  // The whole constellation lives in this group so it can be offset right
  // and spun as one body.
  var cluster = new THREE.Group();
  scene.add(cluster);

  /* --------------------------------------------------------------------
     Node positions — organic, clustered, asymmetric.
     Rejection-sampled inside a squashed ellipsoid with density falling off
     toward the edges, then nudged into 3 loose sub-clusters so it reads like
     a real topology rather than a uniform cloud.
     -------------------------------------------------------------------- */
  var seeds = [
    new THREE.Vector3( 0.6,  0.9, -0.4),
    new THREE.Vector3(-1.9, -1.4,  1.7),
    new THREE.Vector3( 2.2, -0.7, -1.9)
  ];

  var nodes = [];
  for (var i = 0; i < NODE_COUNT; i++) {
    // Bias toward the centre of the cluster: cube of a uniform gives falloff.
    var t = Math.pow(Math.random(), 0.62);
    var theta = Math.random() * Math.PI * 2;
    var phi = Math.acos(2 * Math.random() - 1);
    var r = t * CLUSTER_RADIUS;

    var p = new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta) * 0.78, // squash vertically
      r * Math.cos(phi) * 0.92
    );
    // Pull toward one of the seed points so clumps form.
    p.lerp(seeds[i % seeds.length], 0.22 + Math.random() * 0.14);

    var depth = (p.z + CLUSTER_RADIUS) / (CLUSTER_RADIUS * 2); // 0 far .. 1 near
    var size = 0.55 + Math.pow(Math.random(), 1.9) * 1.85;     // heavy skew small
    if (Math.random() < 0.09) size *= 2.3;                     // a few big ones

    nodes.push({
      base: p.clone(),
      pos: p.clone(),
      size: size,
      color: pickColor(Math.random()),
      depth: depth,
      // independent drift
      driftAmp: 0.09 + Math.random() * 0.16,
      driftSpeed: 0.14 + Math.random() * 0.22,
      driftPhase: Math.random() * Math.PI * 2,
      // a minority pulse in brightness, on offset rhythms
      pulses: Math.random() < 0.22,
      pulseSpeed: 0.22 + Math.random() * 0.25,
      pulsePhase: Math.random() * Math.PI * 2
    });
  }

  /* --------------------------------------------------------------------
     Connections — only between near neighbours, and deliberately sparse.
     Each node links to at most 2 neighbours within a radius; some end up
     isolated, which is what makes it read as a real graph.
     -------------------------------------------------------------------- */
  var MAX_LINK_DIST = 3.6;
  var links = [];
  var linkCount = {};

  for (var a = 0; a < nodes.length; a++) {
    var candidates = [];
    for (var b = 0; b < nodes.length; b++) {
      if (a === b) continue;
      var d = nodes[a].base.distanceTo(nodes[b].base);
      if (d < MAX_LINK_DIST) candidates.push({ i: b, d: d });
    }
    candidates.sort(function (x, y) { return x.d - y.d; });

    var made = 0;
    for (var c = 0; c < candidates.length && made < 2; c++) {
      var j = candidates[c].i;
      var key = Math.min(a, j) + ':' + Math.max(a, j);
      if (linkCount[key]) continue;
      if ((linkCount['n' + j] || 0) >= 3) continue;
      // leave roughly a fifth of possible links out, for sparseness
      if (Math.random() < 0.2) continue;
      linkCount[key] = 1;
      linkCount['n' + a] = (linkCount['n' + a] || 0) + 1;
      linkCount['n' + j] = (linkCount['n' + j] || 0) + 1;
      links.push([a, j]);
      made++;
    }
  }

  /* --------------------------------------------------------------------
     Node geometry + shader
     -------------------------------------------------------------------- */
  var nodePositions = new Float32Array(nodes.length * 3);
  var nodeColors = new Float32Array(nodes.length * 3);
  var nodeSizes = new Float32Array(nodes.length);
  var nodeAlphas = new Float32Array(nodes.length);

  var nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePositions, 3));
  nodeGeo.setAttribute('aColor', new THREE.BufferAttribute(nodeColors, 3));
  nodeGeo.setAttribute('aSize', new THREE.BufferAttribute(nodeSizes, 1));
  nodeGeo.setAttribute('aAlpha', new THREE.BufferAttribute(nodeAlphas, 1));

  var nodeMat = new THREE.ShaderMaterial({
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
      // bright inner core
      '  float core = smoothstep(0.16, 0.0, d);',
      // soft wide halo
      '  float halo = pow(smoothstep(0.5, 0.0, d), 2.4);',
      // faint rim, standing in for a fresnel edge on glass
      '  float rim  = smoothstep(0.30, 0.22, d) * smoothstep(0.14, 0.22, d) * 0.55;',
      '  float a = (core * 0.95 + halo * 0.55 + rim) * vAlpha;',
      '  vec3 col = mix(vColor, vColor + vec3(0.35), core * 0.7);',
      // Light theme: normal blending, so keep the colour saturated (no white
      // lift) and tighten the halo or it turns to grey mush on a pale ground.
      '  col = mix(col, vColor * 0.82, uLight);',
      '  a = mix(a, (core * 1.0 + halo * 0.28) * vAlpha * 1.15, uLight);',
      '  gl_FragColor = vec4(col, a);',
      '}'
    ].join('\n')
  });

  var nodePoints = new THREE.Points(nodeGeo, nodeMat);
  cluster.add(nodePoints);

  /* --------------------------------------------------------------------
     Connection lines — two segments each so brightness fades to the middle
     -------------------------------------------------------------------- */
  var segCount = links.length * 2;
  var linePositions = new Float32Array(segCount * 2 * 3);
  var lineColors = new Float32Array(segCount * 2 * 3);

  var lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
  lineGeo.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));

  var lineMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  cluster.add(new THREE.LineSegments(lineGeo, lineMat));

  /* --------------------------------------------------------------------
     Haze — a handful of very large, very dim points sitting between the
     depth layers, to suggest volumetric fog without a real fog pass
     -------------------------------------------------------------------- */
  var hazeCount = 7;
  var hazePos = new Float32Array(hazeCount * 3);
  var hazeCol = new Float32Array(hazeCount * 3);
  var hazeSize = new Float32Array(hazeCount);
  var hazeAlpha = new Float32Array(hazeCount);

  for (var h = 0; h < hazeCount; h++) {
    hazePos[h * 3]     = (Math.random() - 0.5) * 9;
    hazePos[h * 3 + 1] = (Math.random() - 0.5) * 7;
    hazePos[h * 3 + 2] = (Math.random() - 0.5) * 9;
    var hc = h % 3 === 0 ? VIOLET : BLUE;
    hazeCol[h * 3] = hc.r; hazeCol[h * 3 + 1] = hc.g; hazeCol[h * 3 + 2] = hc.b;
    hazeSize[h] = 9 + Math.random() * 7;
    hazeAlpha[h] = 0.035 + Math.random() * 0.03;
  }

  var hazeGeo = new THREE.BufferGeometry();
  hazeGeo.setAttribute('position', new THREE.BufferAttribute(hazePos, 3));
  hazeGeo.setAttribute('aColor', new THREE.BufferAttribute(hazeCol, 3));
  hazeGeo.setAttribute('aSize', new THREE.BufferAttribute(hazeSize, 1));
  hazeGeo.setAttribute('aAlpha', new THREE.BufferAttribute(hazeAlpha, 1));
  cluster.add(new THREE.Points(hazeGeo, nodeMat));

  /* --------------------------------------------------------------------
     Layout — keep the cluster in the right two-thirds at any aspect ratio
     -------------------------------------------------------------------- */
  function layout() {
    var w = host.clientWidth || window.innerWidth;
    var hgt = host.clientHeight || window.innerHeight;
    renderer.setSize(w, hgt, false);
    camera.aspect = w / hgt;
    camera.updateProjectionMatrix();
    nodeMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();

    // Visible half-width at the cluster's depth.
    var halfH = Math.tan((camera.fov * Math.PI / 180) / 2) * camera.position.z;
    var halfW = halfH * camera.aspect;

    // Sit the cluster centre at ~38% of the half-width to the right, and
    // scale it down on narrow viewports so it never creeps left of centre.
    var scale = Math.min(1, Math.max(0.62, camera.aspect / 1.6));
    cluster.scale.setScalar(scale);
    cluster.position.x = halfW * 0.33;
    cluster.position.y = halfH * 0.04;
  }

  /* --------------------------------------------------------------------
     Cursor parallax — a few degrees, heavily eased
     -------------------------------------------------------------------- */
  var targetX = 0, targetY = 0, curX = 0, curY = 0;
  window.addEventListener('mousemove', function (e) {
    targetX = (e.clientX / window.innerWidth - 0.5) * 2;
    targetY = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  /* --------------------------------------------------------------------
     Animation
     -------------------------------------------------------------------- */
  var ROTATION_PERIOD = 30;                       // seconds per revolution
  var SPIN = (Math.PI * 2) / ROTATION_PERIOD;
  var clock = new THREE.Clock();
  var running = true;
  var visible = true;

  // Stop drawing when the hero scrolls away or the tab is hidden.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
    }, { threshold: 0 }).observe(host);
  }
  document.addEventListener('visibilitychange', function () {
    running = !document.hidden;
    if (running) clock.getDelta(); // discard the gap
  });

  /* --------------------------------------------------------------------
     Theme. Additive blending only reads correctly against a dark ground,
     so the light theme switches to normal blending and slightly darker,
     more saturated marks.
     -------------------------------------------------------------------- */
  var isLight = false;
  function applyTheme() {
    isLight = document.documentElement.getAttribute('data-theme') === 'light';
    nodeMat.blending = isLight ? THREE.NormalBlending : THREE.AdditiveBlending;
    nodeMat.uniforms.uLight.value = isLight ? 1.0 : 0.0;
    nodeMat.needsUpdate = true;
    lineMat.blending = isLight ? THREE.NormalBlending : THREE.AdditiveBlending;
    lineMat.opacity = isLight ? 0.42 : 0.8;
    lineMat.needsUpdate = true;
  }
  applyTheme();
  if (window.MutationObserver) {
    new MutationObserver(applyTheme).observe(document.documentElement, {
      attributes: true, attributeFilter: ['data-theme']
    });
  }

  var tmpA = new THREE.Vector3();
  var tmpB = new THREE.Vector3();
  var tmpC = new THREE.Color();

  function frame() {
    requestAnimationFrame(frame);
    if (!running || !visible) return;

    var dt = Math.min(clock.getDelta(), 0.05);
    var t = clock.elapsedTime;

    cluster.rotation.y += SPIN * dt;

    // Node positions, sizes and brightness
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var ph = t * n.driftSpeed + n.driftPhase;
      n.pos.set(
        n.base.x + Math.sin(ph) * n.driftAmp,
        n.base.y + Math.cos(ph * 0.83) * n.driftAmp,
        n.base.z + Math.sin(ph * 0.61) * n.driftAmp * 0.7
      );

      nodePositions[i * 3]     = n.pos.x;
      nodePositions[i * 3 + 1] = n.pos.y;
      nodePositions[i * 3 + 2] = n.pos.z;

      nodeColors[i * 3]     = n.color.r;
      nodeColors[i * 3 + 1] = n.color.g;
      nodeColors[i * 3 + 2] = n.color.b;

      nodeSizes[i] = n.size;

      // Distant nodes dimmer — stands in for depth of field.
      var alpha = 0.55 + n.depth * 0.45;
      if (n.pulses) alpha *= 0.72 + 0.4 * (0.5 + 0.5 * Math.sin(t * n.pulseSpeed * Math.PI * 2 + n.pulsePhase));
      nodeAlphas[i] = alpha;
    }
    nodeGeo.attributes.position.needsUpdate = true;
    nodeGeo.attributes.aColor.needsUpdate = true;
    nodeGeo.attributes.aSize.needsUpdate = true;
    nodeGeo.attributes.aAlpha.needsUpdate = true;

    // Lines: node -> midpoint (bright to dim), midpoint -> node (dim to bright)
    for (var l = 0; l < links.length; l++) {
      var na = nodes[links[l][0]];
      var nb = nodes[links[l][1]];
      tmpA.copy(na.pos);
      tmpB.copy(nb.pos);
      tmpC.copy(tmpA).lerp(tmpB, 0.5); // reuse as midpoint holder
      var mx = (tmpA.x + tmpB.x) / 2, my = (tmpA.y + tmpB.y) / 2, mz = (tmpA.z + tmpB.z) / 2;

      var o = l * 12; // 2 segments * 2 verts * 3 components
      linePositions[o]      = tmpA.x; linePositions[o + 1]  = tmpA.y; linePositions[o + 2]  = tmpA.z;
      linePositions[o + 3]  = mx;     linePositions[o + 4]  = my;     linePositions[o + 5]  = mz;
      linePositions[o + 6]  = mx;     linePositions[o + 7]  = my;     linePositions[o + 8]  = mz;
      linePositions[o + 9]  = tmpB.x; linePositions[o + 10] = tmpB.y; linePositions[o + 11] = tmpB.z;

      var fade = 0.14; // brightness at the midpoint
      var ea = isLight ? 0.55 : 0.95, eb = ea;
      lineColors[o]      = na.color.r * ea; lineColors[o + 1]  = na.color.g * ea; lineColors[o + 2]  = na.color.b * ea;
      lineColors[o + 3]  = na.color.r * fade; lineColors[o + 4] = na.color.g * fade; lineColors[o + 5] = na.color.b * fade;
      lineColors[o + 6]  = nb.color.r * fade; lineColors[o + 7] = nb.color.g * fade; lineColors[o + 8] = nb.color.b * fade;
      lineColors[o + 9]  = nb.color.r * eb; lineColors[o + 10] = nb.color.g * eb; lineColors[o + 11] = nb.color.b * eb;
    }
    lineGeo.attributes.position.needsUpdate = true;
    lineGeo.attributes.color.needsUpdate = true;

    // Eased cursor parallax — a few degrees at most
    curX += (targetX - curX) * Math.min(1, dt * 1.6);
    curY += (targetY - curY) * Math.min(1, dt * 1.6);
    camera.position.x = curX * 1.15;
    camera.position.y = -curY * 0.75;
    camera.lookAt(cluster.position.x * 0.55, 0, 0);

    renderer.render(scene, camera);
  }

  layout();
  window.addEventListener('resize', layout, { passive: true });
  frame();

  // Fade the canvas in once there is something to look at.
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { host.classList.add('is-ready'); });
  });
})();

/* Mayne Murray — the open sea behind the voyage.
   A WebGL fragment shader draws the water seen from above: rolling swell, wind chop, sun or moon
   glints and whitecaps. The water is pinned to the page, so it slides past as you scroll, with a
   touch of parallax. Rendered at reduced resolution (water is soft, so it doesn't show) and paused
   when the tab is hidden. Falls back to the CSS gradient if WebGL isn't available. */
(function () {
  'use strict';
  var canvas = document.getElementById('ocean');
  if (!canvas) return;
  var gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, powerPreference: 'low-power' }) ||
           canvas.getContext('experimental-webgl');
  if (!gl) { canvas.remove(); return; }
  document.documentElement.classList.add('has-ocean');

  var VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var FRAG = [
    'precision mediump float;',
    'uniform vec2 res;uniform float t;uniform float scroll;',
    'uniform vec3 deep;uniform vec3 shallow;uniform vec3 sky;uniform vec3 glint;uniform float glintAmt;',
    'float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);',
    ' return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);',
    ' for(int i=0;i<4;i++){v+=a*noise(p);p=m*p;a*=.5;}return v;}',
    // swell (long, directional) + chop (short, noisy)
    'float height(vec2 p){',
    ' float h=sin(dot(p,vec2(.82,.57))*1.4+t*.8)*.30;',
    ' h+=sin(dot(p,vec2(-.45,.89))*2.3+t*1.15)*.16;',
    ' h+=sin(dot(p,vec2(.2,-.98))*3.7+t*1.7)*.07;',
    ' h+=fbm(p*1.7+vec2(t*.12,t*.07))*.55;',
    ' h+=fbm(p*4.3+vec2(-t*.35,t*.28))*.09;',
    ' return h;}',
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/res.y;',
    ' vec2 p=uv*3.2; p.y-=scroll;',
    ' float e=.02; float h=height(p);',
    ' vec2 g=vec2(height(p+vec2(e,0.))-h,height(p+vec2(0.,e))-h)/e;',
    ' vec3 n=normalize(vec3(-g*.22,1.));',
    ' vec3 L=normalize(vec3(-.35,.55,.76)); vec3 V=vec3(0.,0.,1.); vec3 H=normalize(L+V);',
    ' float diff=clamp(dot(n,L),0.,1.);',
    ' float spec=pow(clamp(dot(n,H),0.,1.),90.);',
    ' float fres=pow(1.-clamp(n.z,0.,1.),2.2);',
    ' vec3 col=mix(deep,shallow,clamp(h*.55+diff*.35-.1,0.,1.));',
    ' col+=sky*fres*1.6;',
    ' col+=glint*spec*glintAmt;',
    // whitecaps on the highest crests, broken up by noise
    ' float foam=smoothstep(1.02,1.3,h+fbm(p*7.+t*.5)*.32);',
    ' col=mix(col,vec3(.88,.94,.96),foam*.5);',
    // a soft darkening toward the edges of the screen, like looking down through haze
    ' vec2 q=gl_FragCoord.xy/res; col*=.86+.14*smoothstep(.0,.35,q.x*(1.-q.x)*4.);',
    ' gl_FragColor=vec4(col,1.);}'
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  var prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (err) { canvas.remove(); document.documentElement.classList.remove('has-ocean'); return; }
  gl.useProgram(prog);
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var U = {}; ['res', 't', 'scroll', 'deep', 'shallow', 'sky', 'glint', 'glintAmt'].forEach(function (k) { U[k] = gl.getUniformLocation(prog, k); });

  // Night sea under moonlight, or a bright day sea, following the site theme
  var PALETTE = {
    dark:  { deep: [.01, .05, .09], shallow: [.045, .17, .25], sky: [.08, .16, .24], glint: [.7, .8, .95], amt: .45 },
    light: { deep: [.04, .27, .4], shallow: [.13, .5, .6], sky: [.45, .68, .78], glint: [1, .97, .88], amt: 1.1 }
  };
  function theme() {
    var set = document.documentElement.getAttribute('data-theme');
    if (set === 'light' || set === 'dark') return set;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  function applyPalette() {
    var c = PALETTE[theme()];
    gl.uniform3fv(U.deep, c.deep); gl.uniform3fv(U.shallow, c.shallow); gl.uniform3fv(U.sky, c.sky);
    gl.uniform3fv(U.glint, c.glint); gl.uniform1f(U.glintAmt, c.amt);
  }
  applyPalette();
  new MutationObserver(function () { applyPalette(); draw(performance.now()); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', applyPalette);

  var SCALE = .5;
  function size() {
    var w = Math.max(1, Math.round(window.innerWidth * SCALE)), h = Math.max(1, Math.round(window.innerHeight * SCALE));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
    gl.uniform2f(U.res, w, h);
  }
  size(); window.addEventListener('resize', size);

  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var raf = null, last = 0;
  function draw(now) {
    // 3.2 sea units per screen height; .8 keeps the water a little slower than the page (parallax)
    gl.uniform1f(U.scroll, window.pageYOffset / window.innerHeight * 3.2 * .8);
    gl.uniform1f(U.t, calm ? 0 : now / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function loop(now) {
    raf = requestAnimationFrame(loop);
    last = now; draw(now);
  }
  function start() { if (!raf && !calm) raf = requestAnimationFrame(loop); }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
  if (calm) window.addEventListener('scroll', function () { requestAnimationFrame(draw); }, { passive: true });
  draw(performance.now()); start();
})();

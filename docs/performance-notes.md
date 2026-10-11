# Performance review after the ocean remodel

The ocean now uses one static SVG wave texture at two scales over a blue depth gradient.
Only the two viewport-sized texture layers' transforms animate. There is no ocean WebGL
context, per-frame JavaScript loop, or scroll handler. Motion pauses when the tab is hidden
and stops under reduced motion. The floating Log Pose, its scene, pointer handler and
scroll-driven heading updates have been removed.

Local checks: two automated regression tests pass; all three active JavaScript files pass
syntax checks. The browser preview shows an animated DIV ocean and only the treasure chest
canvas. Wave transforms changed between observations, confirming independent motion.
The preview reported no browser warnings or errors.

## Remaining optimization candidates

These are source and browser observations, not a measured ranking of frame-time costs.
No claim of zero lag on every device is made.

1. **Route painting during scrolling.** `placeShip()` changes the gold SVG route's stroke
   dash offset. The route spans the voyage (about 14,000 CSS pixels in the narrow preview),
   and `.route` retains `will-change: transform` despite not being transformed. Cache
   voyage bounds and document height, and consider drawing only the visible route segment.
   `frame()` also reads document height after ship style writes, which can cause layout work.
2. **Paper and distressed ink.** There are 23 paper cards. Paper combines drop shadows,
   many background layers, crumple blending, and detailed polygon clipping. Poster and bounty
   lettering use SVG turbulence/displacement filters. These are mostly static, but costly
   when first painted or invalidated by transitions, counters or hover effects.
3. **Persistent decorative animation.** Island flags, smoke, windmill blades, lighthouse
   details, ship foam, the hero clouds and Haki hints retain infinite CSS animation.
   Some animate paint properties (fill, stroke offsets and glow filters). Their code does
   not explicitly pause them offscreen. Pause decorative animations outside the viewport.
4. **Rotating button border.** One `.trail` element continuously animates a custom angle
   driving a conic gradient, with masking. This can repaint every animation frame.
5. **Pointer effects.** Six tilt cards plus spotlight and magnetic effects read element
   bounds on pointer movement and write transforms or gradient positions. Batch pointer
   updates and cache bounds while hovering if desktop interaction still feels slow.
6. **Treasure chest.** The remaining Three.js scene renders when its canvas is visible,
   even when the closed chest is idle. It includes 70 separate coin meshes and pixel ratios
   up to 2. Prefer a still frame when idle and render only the opening/closing animation.
7. **New ocean's residual cost.** Two moving textures still require compositor work and
   image rasterization on initial load. Their size is bounded by the viewport rather than
   page length; there are no shader calculations or per-scroll repaint instructions.

Next measurement: compare identical scroll runs with the route, paper filters and
decorative animations disabled separately in browser performance tools. Record frame
times and paint/layout costs before choosing further changes.

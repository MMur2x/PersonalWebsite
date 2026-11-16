# Mayne's Room

Personal portfolio of Mayne Murray. The whole site is one page: you stand inside a 3D bedroom at night, in first person, and never leave it. Scroll for a guided tour, or walk around yourself. Click anything that glows to find out something about Mayne.

Live: https://mmur2x.github.io/PersonalWebsite/

Plain HTML, CSS and JavaScript. No framework, no build step, no dependencies. The room is drawn with raw WebGL.

## Three ways to move

- **Tour:** scroll. The camera walks doorway → desk → shelf → wall of frames → bed. The nav, the side dots and the chevron jump between stops.
- **Walk around:** press W A S D (or the "Walk around" button). Drag to look, Q/E or the arrow keys to turn. On a phone, a stick appears bottom-left to walk and you drag anywhere to look. Scrolling, Esc or "Back to the tour" returns to the tour.
- **Click a dot:** the camera walks up to that object and a drawer opens with the detail.

## How it works

| Piece | Where | What it does |
| --- | --- | --- |
| The room | `assets/js/room.js` | Builds the bedroom (boxes, cylinders, soft shapes), paints the pictures (monitor, posters, frames) onto one texture, bakes soft shadows and ambient occlusion once at load, and runs the first-person camera. It is fixed behind the page and never leaves the screen. |
| The film | `<section id="film">` in `index.html` | An empty, tall scroll track. `p` is how far through it you are (0 to 1). |
| Overlays | `.layers` in `index.html` | Fixed copy. Each `.fx` fades in at `data-in` and out at `data-out` (values of `p`). |
| Hotspots | `.spot[data-spot]` | Glowing dots pinned to objects. Clicking one opens the drawer and counts toward "found". |
| Drawer text | `DETAIL` in `assets/js/site.js` | What each object says. Most of it is lifted from the detail sections lower on the page, so edit the text there. |
| Details | `.after` in `index.html` | Experience, projects, skills, about and contact. They slide up over the dimmed room. |

## Things you will want to edit

- **Tour path:** `CAM` in `room.js`. Each row is `[p, where you stand, what you look at]`. `STOPS` are the values of `p` the nav, dots and chevron jump to.
- **Walking feel:** `WALK_SPEED`, `TURN_SPEED`, `BODY` (how close you can get to furniture) and `FOLLOW` in `room.js`; `LOOK_MOUSE` and `LOOK_TOUCH` in `site.js`. Furniture you cannot walk through is listed in `SOLID`.
- **Furniture:** `buildRoom()` in `room.js`. `box(name, [x0,y0,z0,x1,y1,z1], colour, {mat})`, `cyl(...)` and `ball(...)`. The room is 6 m wide, 5 m deep, 2.9 m tall. Lighting is re-baked automatically on load.
- **Lights:** the `point(...)` lines in the fragment shader in `room.js` (desk lamp, floor lamp, monitor, LED strip, moonlight).
- **Photo textures (optional):** add `data-window="assets/images/room/window.jpg"` and/or `data-rug="assets/images/room/rug.jpg"` to `<canvas id="stage">` to replace the drawn window view and rug with photographs.
- **Pictures in the room:** `paintAtlas()` in `room.js` (monitor, calendar, frames, rug) and `paintPosters()` (the basketball, anime-style and game posters and the cork board). All of it is original artwork drawn in code; swap in your own by drawing an image into the same cell.
- **Where a hotspot sits, when it shows, and how close the camera walks up:** `SPOT` in `room.js`.
- **Fade speed of the overlays:** `FADE` in `site.js`.
- **Intro length:** `introT / 2.6` in `room.js` (seconds).
- **Colours and type:** the tokens at the top of `assets/css/site.css`, and the "MAYNE'S ROOM" and "LAMPLIGHT" blocks at the bottom. Headings are Bricolage Grotesque, everything else is Hanken Grotesk (both self-hosted in `assets/fonts/`). Notes and the drawer are styled as paper cards.
- **Softer furniture:** `rbox(name, box, colour, opts, radius)` in `room.js` is a box with rounded edges.
- **Résumé:** replace `assets/docs/mayne-murray-resume.pdf`.

## Fallbacks

- No WebGL or no JavaScript: the overlays become a normal stacked page and every detail is still reachable.
- Reduced motion: no intro, no camera easing, no pulsing.
- Performance: the room only redraws while something is moving, lighting is baked rather than computed live, and on a struggling device the canvas lowers its resolution on its own.

## Run it locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000. Old page addresses (`experience.html`, `projects.html` and so on) redirect into the single page.

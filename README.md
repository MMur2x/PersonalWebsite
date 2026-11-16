# Mayne's Room

Personal portfolio of Mayne Murray. The whole site is one page: a 3D bedroom at night that you walk around by scrolling. Click anything that glows to find out something about Mayne.

Live: https://mmur2x.github.io/PersonalWebsite/

Plain HTML, CSS and JavaScript. No framework, no build step, no dependencies. The room is drawn with raw WebGL.

## How it works

| Piece | Where | What it does |
| --- | --- | --- |
| The room | `assets/js/room.js` | Builds the bedroom from boxes, paints the pictures (monitor, posters, frames) onto one texture, lights it, and flies the camera. It is fixed behind the page and never leaves the screen. |
| The film | `<section id="film">` in `index.html` | An empty, tall scroll track. `p` is how far through it you are (0 to 1). |
| Overlays | `.layers` in `index.html` | Fixed copy. Each `.fx` fades in at `data-in` and out at `data-out` (values of `p`). |
| Hotspots | `.spot[data-spot]` | Glowing dots pinned to objects. Clicking one opens the drawer and counts toward "found". |
| Drawer text | `DETAIL` in `assets/js/site.js` | What each object says. Most of it is lifted from the detail sections lower on the page, so edit the text there. |
| Details | `.after` in `index.html` | Experience, projects, skills, about and contact. They slide up over the dimmed room. |

## Things you will want to edit

- **Camera path:** `CAM` in `room.js`. Each row is `[p, eye, target]`. `STOPS` are the values of `p` the nav, dots and chevron jump to.
- **Furniture:** `buildRoom()` in `room.js`. `box(name, [x0,y0,z0,x1,y1,z1], colour)`. The room is 6 wide, 5 deep, 3.1 tall.
- **Pictures in the room:** `paintAtlas()` in `room.js`.
- **Where a hotspot sits and when it shows:** `SPOT` in `room.js`.
- **Fade speed of the overlays:** `FADE` in `site.js`.
- **Intro length:** `introT / 2.4` in `room.js` (seconds).
- **Colours and type:** the tokens at the top of `assets/css/site.css`, and the "MAYNE'S ROOM" block at the bottom.
- **Résumé:** replace `assets/docs/mayne-murray-resume.pdf`.

## Fallbacks

- No WebGL or no JavaScript: the overlays become a normal stacked page and every detail is still reachable.
- Reduced motion: no intro, no camera easing, no pulsing.
- Slow devices: the canvas lowers its resolution on its own.

## Run it locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000. Old page addresses (`experience.html`, `projects.html` and so on) redirect into the single page.

# Mayne Murray — Portfolio

Live site: https://mmur2x.github.io/PersonalWebsite/

A One Piece–themed "Grand Line voyage" portfolio: a wanted poster, the Going Merry sailing down
a route of islands, devil fruits for skills, and Haki toggles that reveal more detail. Plain HTML,
CSS and JavaScript with no build step, deployed by GitHub Pages from `main`.

## Folder layout

```
index.html                    the whole site (one page)
about.html, projects.html,    old page addresses; each redirects to its section of index.html
leadership.html, contact.html,
resume.html
assets/
  css/site.css                every style; color and font tokens are at the top
  js/site.js                  route + ship, islands, devil fruits, screenshot viewer, Haki, effects
  js/voyage-3d.js             Three.js scenes: the Log Pose and the treasure chest
  js/archive/scenes-3d-v1.js  3D scenes from the previous design (not loaded)
  images/headshot.jpg         wanted-poster photo
  images/projects/            screenshots, one folder per project, numbered in viewer order
  images/backgrounds/         button backgrounds (Haikei-style SVGs)
  docs/mayne-murray-resume.pdf
```

## Updating

- Text lives in `index.html`. Each section is marked with a comment (`<!-- Experience -->`, …).
- Add a project screenshot: put it in `assets/images/projects/<project>/`, numbered, and add a
  `<figure>` to that project's card. The viewer picks it up automatically.
- Replace the résumé: overwrite `assets/docs/mayne-murray-resume.pdf` with the same name.
- After changing CSS or JS, bump the `?v=` number on their links in `index.html` so browsers
  load the new files.

## Credits

Motion ideas adapted from Motion Primitives; carousel and card patterns from Watermelon UI;
backgrounds generated in the style of Haikei; 3D with Three.js r128. Fan-inspired design, not
affiliated with or endorsed by Eiichiro Oda, Shueisha, or Toei Animation.

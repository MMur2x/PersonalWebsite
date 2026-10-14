# Mayne Murray — Portfolio

[Live portfolio](https://mmur2x.github.io/PersonalWebsite/)

A personal portfolio built with plain HTML, CSS, and JavaScript. There is no build step or runtime framework. Seven pages cover professional experience, projects, education, skills, and contact information.

## Pages

- `index.html`: introduction and six scroll-style navigation links.
- `experience.html`: three internships, measured results, and expandable technical details.
- `projects.html`: four personal projects, implementation details, and screenshot galleries.
- `about.html`: background, education, leadership, and fellowships.
- `skills.html`: technology badges linked to relevant experience and projects.
- `resume.html`: résumé PDF preview and download, contact links, and email/phone copy buttons.
- `blog.html`: a portfolio guide with a table of contents and native FAQ disclosures.

`contact.html` redirects to the résumé's contact section. Shared links using former `index.html#section` addresses route to the corresponding page. Detail pages include a Back to home link and shared navigation.

## Design and interactions

A neutral static CSS backdrop sits behind carved-stone content panels and parchment scroll navigation. Light and dark themes share three font roles: Shojumaru for main headings, Kaushan Script for subheadings and scroll labels, and Noto Sans for body text and controls. Fonts load together with `display=swap`.

Experience offers three optional reading modes:

- **Byakugan:** reveals numerical impact readouts.
- **Sharingan:** expands internship details and applies a light static tint.
- **Sage Mode:** opens a calm highlights overview with links to the full records.

Each mode has a normal eye that blinks into its selected appearance during a 1.6-second activation cue. Reduced-motion preferences skip the cue. Individual detail buttons and the measured-results section remain available independently.

Project galleries support previous/next buttons, indicators, arrow keys, and touch swipes. Contact copy buttons confirm successful copying. The Blog explains these features and links directly to the relevant portfolio sections.

## Source files

- `assets/css/site.css`: shared theme, typography, materials, and component styles.
- `assets/css/pages.css`: home and detail-page layouts.
- `assets/js/site.js`: detail controls, Experience reading modes, skills, galleries, and contact interactions.
- `assets/js/pages.js`: page navigation, theme/menu controls, and legacy section routing.
- `assets/js/atmosphere.js`: visibility flags for the static backdrop.
- `assets/js/mission-scroll.js`: résumé-page contact scroll illustration.
- `assets/images/`: portfolio imagery and project screenshots.
- `assets/docs/mayne-murray-resume.pdf`: downloadable résumé.

After changing CSS or JavaScript, update its version query in the pages that load it. Run the local regression checks with `node --test`.

The site is hosted on GitHub Pages. Publish only when the owner explicitly requests a push or publication.

## Design references

The implementation uses native HTML, CSS, and JavaScript.

# Portfolio performance notes

The site uses seven focused HTML pages with shared CSS and small JavaScript files. There is no build step or runtime framework. `contact.html` is a compatibility redirect to the résumé's contact section.

## Rendering

- The neutral backdrop uses static CSS gradients with no image download, parallax, or JavaScript render loop.
- Scroll navigation uses CSS paper folds and wooden rollers. Stone panels use a small inline SVG fleck tile, gradients, bevels, and inset grooves.
- Main headings use Shojumaru, subheadings use Kaushan Script, and body text and controls use Noto Sans. One font stylesheet requests the fonts with `display=swap`.
- Pages load scripts for their relevant interactions. The Blog uses native FAQ disclosures and shared navigation controls.
- The résumé embeds its PDF lazily and provides direct open/download links. Contact artwork is static SVG.

## Interactions

- Experience alone offers Byakugan numerical readouts, Sharingan expanded details with a light static tint, and a Sage Mode highlights dialog.
- Eye controls start with a normal eye and blink into the selected appearance. The temporary activation cue lasts 1.6 seconds. New activations replace the previous cue; cancellation, hidden tabs, and reduced-motion changes remove it. Reduced motion preserves the reading action and skips the cue.
- Byakugan's white numerical glow and Sharingan's tint are static while selected. The highlights overview uses a brief entrance and then stays still.
- Project galleries change only when selected through buttons, indicators, arrow keys, or touch swipes. Transitions cancel stale timers during rapid navigation; gallery controls have 44-pixel hit targets.
- Contact copy confirmations and page transitions are brief. There is no continuous background animation or 3D rendering loop.

## Areas to inspect if scrolling feels slow

Project image decoding, gallery transitions, the browser's PDF viewer, CSS compositing, and font loading are potential sources of delay. These are inspection candidates, not measured causes. No fixed frame-rate claim is made.

Run local checks with `node --test` after changes. Check navigation, local links and fragments, factual content, galleries, Experience modes, contact copying, and the PDF preview on desktop and mobile layouts before an explicitly requested publication.

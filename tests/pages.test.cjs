const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const pages = ['index', 'experience', 'projects', 'about', 'skills', 'resume', 'blog'];

test('home is a compact menu and loads no detail content or Three.js', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /class="landing-menu"/);
  assert.doesNotMatch(html, /landing__portrait|poster__sheet|Shinobi record/i);
  assert.doesNotMatch(html, /id="voyage"|id="experience"|id="projects"|three\.min\.js|assets\/js\/site\.js/);
  for (const page of pages.slice(1)) assert.ok(html.includes(`href="${page}.html"`), page);
});

test('detail pages contain their own content and a link back home', () => {
  for (const page of pages.slice(1)) {
    const html = fs.readFileSync(path.join(root, `${page}.html`), 'utf8');
    assert.doesNotMatch(html, /http-equiv="refresh"|class="route"/);
    assert.match(html, /href="index.html"/);
    assert.match(html, /<h1\b/);
    assert.match(html, new RegExp(`id="${page}"`));
  }
});

test('local navigation links and fragments resolve on every page', () => {
  for (const page of pages) {
    const html = fs.readFileSync(path.join(root, `${page}.html`), 'utf8');
    for (const match of html.matchAll(/href="([^"\s]+)"/g)) {
      const href = match[1];
      if (/^(https?:|mailto:|tel:)/.test(href)) continue;
      const [file, hash] = href.split('#');
      const targetPath = path.join(root, (file || `${page}.html`).split('?')[0]);
      assert.ok(fs.existsSync(targetPath), `${page}: missing ${href}`);
      if (hash && targetPath.endsWith('.html')) {
        const target = fs.readFileSync(targetPath, 'utf8');
        assert.ok(target.includes(`id="${hash}"`), `${page}: missing anchor ${href}`);
      }
    }
  }
});

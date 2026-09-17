import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root = new URL('../ui/', import.meta.url);
for (const name of ['compare', 'review', 'workspace', 'proof', 'index', 'purchase']) {
  test(`${name}: home logo and consistent primary navigation`, () => {
    const html = readFileSync(new URL(`${name}.html`, root), 'utf8');
    const header = html.match(/<header\b[^>]*>([\s\S]*?)<\/header>/)?.[1];
    assert.ok(header);
    assert.match(header, /class="brand" href="\/" aria-label="Recall home"/);
    const nav = header.match(/<nav class="product-nav" aria-label="Main">([\s\S]*?)<\/nav>/)?.[1];
    assert.ok(nav);
    for (const target of ['/compare', '/review', '/workspace']) assert.ok(nav.includes(`href="${target}"`));
    assert.match(header, /(?:connect-wallet|wallet-settings|wallet-shortcut)/);
    assert.match(html, /href="\/brand.css"/);
  });
}
test('purchase history remains separate from the homepage', () => {
  const html = readFileSync(new URL('purchase.html', root), 'utf8');
  assert.match(html, /href="\/proof">Recorded example/);
  assert.match(html, /Historical Studio purchase flow/);
});

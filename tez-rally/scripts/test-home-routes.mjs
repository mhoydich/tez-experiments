// Check the generated public entry points and previously shared desk URLs.
// No wallet, network requests, or chain writes are involved.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
const root = new URL('../', import.meta.url);
const home = await readFile(new URL('dist/index.html', root), 'utf8');
const desk = await readFile(new URL('dist/desk/index.html', root), 'utf8');
const ids = html => [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const deskIds = ids(desk), homeIds = ids(home);
assert.equal(new Set(deskIds).size, deskIds.length, 'unique original desk IDs');
assert.equal(new Set(homeIds).size, homeIds.length, 'unique home IDs');
assert.ok(deskIds.includes('ladder') && deskIds.includes('booth-canvas') && deskIds.includes('finder-number'));
assert.deepEqual(homeIds.filter(id => deskIds.includes(id)), [], 'new anchors must not redirect to the desk');
const forwarding = [...home.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]).find(script => script.includes('legacyAnchors'));
assert.ok(forwarding, 'inline legacy link forwarding remains in the built home');
const redirect = (search, hash) => {
  let destination = null;
  runInNewContext(forwarding, { URLSearchParams, location: { search, hash, replace: value => { destination = value; } } });
  return destination;
};
for (const id of deskIds) assert.equal(redirect('?utm_source=old-card', `#${id}`), `/desk/?utm_source=old-card#${id}`);
for (const query of ['?view=tz1Example&ref=crew', '?invite=doubles', '?level=3500']) {
  assert.equal(redirect(query, '#booth'), `/desk/${query}#booth`);
}
for (const hash of ['#pb-learn', '#pb-courts', '#pb-practice', '#pb-tools']) assert.equal(redirect('', hash), null);
assert.equal(redirect('?utm_source=crew', ''), null);
assert.equal((home.match(/<h1\b/g) || []).length, 1);
assert.ok(home.includes('data-court-card'), 'court references are pre-rendered');
assert.ok(home.includes('data-learning-panel'), 'learning content is pre-rendered');
assert.ok(!home.includes('__PICKLEBALL_HOME__') && !home.includes('__LEGACY_ANCHORS__'));
for (const route of ['tonight', 'score', 'bag', 'paddle-calendar', 'paddle-fund', 'guide', 'pros']) {
  await readFile(new URL(`dist/${route}/index.html`, root));
}
const assetNames = await readdir(new URL('dist/assets/', root));
const code = (await Promise.all(assetNames.filter(name => name.endsWith('.js')).map(name => readFile(new URL(`dist/assets/${name}`, root), 'utf8')))).join('\n');
assert.ok(code.includes('KT1X4iLYF11LvZhU6PFRamLioKjrcgDJEUoT'), 'production rating desk remains on mainnet');
assert.ok(code.includes('KT1Q1g8Sv3uL2beaA7h89hTViJyZmXxfUS9D'), 'production court book remains on mainnet');
assert.ok(code.includes('https://api.tzkt.io'), 'production indexer');
console.log(`RALLY home routes passed: ${deskIds.length} original anchors, legacy queries, eight tool entry points, readable home, and both mainnet contracts.`);

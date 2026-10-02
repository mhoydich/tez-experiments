// index.html is pre-rendered, so learning and court notes are readable with
// JavaScript disabled. The shared source is mirrored to PointCast by the
// release coordinator; this standalone template has no cross-repo imports.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { renderPickleballHome } from '../src/pickleball-home/render.js';
const root = new URL('../', import.meta.url);
const shell = await readFile(new URL('src/home-shell.html', root), 'utf8');
const desk = await readFile(new URL('desk/index.html', root), 'utf8');
const legacyAnchors = [...desk.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const html = shell.replace('__LEGACY_ANCHORS__', JSON.stringify(legacyAnchors))
  .replace('__PICKLEBALL_HOME__', renderPickleballHome({
    brand: 'rally', assetBase: '/images/pickleball-home',
    rallyUrl: 'https://tez-rally.pages.dev', pointcastUrl: 'https://pointcast.xyz',
  })).replace(/[ \t]+$/gm, '');
await writeFile(new URL('index.html', root), html);
console.log(`Prerendered RALLY home in ${fileURLToPath(root)}; ${legacyAnchors.length} legacy anchors preserved.`);

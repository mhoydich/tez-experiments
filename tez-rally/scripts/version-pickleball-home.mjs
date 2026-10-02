// Refresh this manifest after a reviewed canonical change, then sync PointCast.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const source = new URL('../src/pickleball-home/', import.meta.url);
const files = {};
for (const name of ['render.js', 'client.js', 'styles.css', 'learning.json', 'courts.json']) {
  files[name] = createHash('sha256').update(await readFile(new URL(name, source))).digest('hex');
}
const fingerprint = createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0, 12);
const manifest = { version: `1-${fingerprint}`, canonicalRepository: 'mhoydich/tez-experiments', canonicalPath: 'tez-rally/src/pickleball-home', files };
await writeFile(new URL('shared-version.json', source), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Versioned shared pickleball experience ${manifest.version}.`);

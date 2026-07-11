// Upload trait art into the nouns contract's art big_map.
//   node scripts/upload-art.js [art/manifest.json]
// Expands the manifest's shorthand generators (same rules as src/render.js)
// into 32x32 grids, packs them as [paletteIndex, runLength] RLE byte pairs
// (runs split at 255), and writes every layer in one batched operation.
import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import { readFileSync } from "node:fs";
import "dotenv/config";

const SIZE = 32;
const manifest = JSON.parse(readFileSync(process.argv[2] || "art/manifest.json"));

function cells(shorthand) {
  const [kind, args = ""] = shorthand.split(":");
  const a = args.split(",").map(Number);
  const out = [];
  if (kind === "solid") for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) out.push([x, y, a[0]]);
  if (kind === "rect") { const [x0, y0, w, h, c] = a; for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) out.push([x, y, c]); }
  if (kind === "ring") { const [cx, cy, r, c] = a; for (let t = 0; t < 360; t += 3) { const x = Math.round(cx + r * Math.cos(t * Math.PI / 180)), y = Math.round(cy + r * Math.sin(t * Math.PI / 180)); if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) out.push([x, y, c]); } }
  if (kind === "noggles") { const [x0, y0, c] = a;
    for (const dx of [0, 1, 2, 3, 7, 8, 9, 10]) { out.push([x0 + dx, y0, c]); out.push([x0 + dx, y0 + 3, c]); }
    for (const dy of [1, 2]) for (const dx of [0, 3, 7, 10]) out.push([x0 + dx, y0 + dy, c]);
    for (const dx of [4, 5, 6]) out.push([x0 + dx, y0 + 1, c]);
    for (const dy of [1, 2]) for (const dx of [1, 2, 8, 9]) out.push([x0 + dx, y0 + dy, 8]);
  }
  return out;
}

function toRLE(shorthand) {
  const grid = new Uint8Array(SIZE * SIZE);
  for (const [x, y, c] of cells(shorthand)) grid[y * SIZE + x] = c;
  const bytes = [];
  let i = 0;
  while (i < grid.length) {
    const c = grid[i];
    let run = 1;
    while (i + run < grid.length && grid[i + run] === c && run < 255) run++;
    bytes.push(c, run);
    i += run;
  }
  return Buffer.from(bytes).toString("hex");
}

const Tezos = new TezosToolkit(process.env.RPC || "https://rpc.shadownet.teztnets.com");
Tezos.setSignerProvider(await InMemorySigner.fromSecretKey(process.env.ADMIN_KEY));
const c = await Tezos.contract.at(process.env.NOUNS_ADDRESS);

let batch = Tezos.contract.batch();
let count = 0;
for (const [layer, traits] of Object.entries(manifest.layers)) {
  traits.forEach((trait, index) => {
    if (trait.rle === "none") return;
    const rle = toRLE(trait.rle);
    batch = batch.withContractCall(c.methodsObject.set_art({ layer, index, rle }));
    count++;
    console.log(`  ${layer}[${index}] "${trait.name}" → ${rle.length / 2} bytes`);
  });
}
const op = await batch.send();
await op.confirmation(1);
console.log(`Uploaded ${count} art entries in one batch:`, op.hash);

// Import REAL Nouns trait art (CC0, @nouns/assets) into the contract.
//   node scripts/import-nouns-art.js            # writes palette + art on-chain
//   node scripts/import-nouns-art.js --dry-run  # local render check only
//
// Decodes each chosen trait via @nouns/sdk buildSVG (ground truth for the
// Nouns RLE format), rasterizes the rects to a 32x32 grid, compacts the
// palette to just the colors used, and uploads:
//   set_palette (batched)  index -> "%23rrggbb" utf8 bytes
//   set_art     (batched)  (layer, index) -> [paletteIdx, runLen] RLE
import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import { ImageData, getNounData } from "@nouns/assets";
import { buildSVG } from "@nouns/sdk";
import { writeFileSync } from "node:fs";
import "dotenv/config";

const SIZE = 32;

// ---- curation: the pools (order matters — indexes are the on-chain seed) ----
const CURATION = {
  background: ["cool", "warm"], // flat fills from ImageData.bgcolors
  body: ["body-teal", "body-gold", "body-blue-sky", "body-red"],
  head: [
    "head-wave", "head-coffeebean", "head-taco-classic", "head-laptop",
    "head-boombox", "head-piano", "head-microwave", "head-cone",
  ],
  glasses: [
    "glasses-square-black-rgb", "glasses-hip-rose",
    "glasses-square-teal", "glasses-square-honey",
  ],
  // pools: plain [0,2] · scholar [2,2] · wave/drum [4,2] · builder [6,2]
  accessory: [
    "accessory-none", "accessory-checker-spaced-black",
    "accessory-txt-cc", "accessory-pocket-pencil",
    "accessory-wave", "accessory-txt-pop",
    "accessory-txt-mint", "accessory-chain-logo",
  ],
};

const findPart = (group, filename) => {
  const part = ImageData.images[group].find((p) => p.filename === filename);
  if (!part) throw new Error(`missing trait: ${group}/${filename}`);
  return part;
};

// Rasterize one trait to a 32x32 grid of ORIGINAL palette indexes (0 = clear)
function traitGrid(part) {
  const svg = buildSVG([{ data: part.data }], ImageData.palette, "00000000");
  const grid = new Uint16Array(SIZE * SIZE); // original palette idx + 1 (0 = clear)
  const re = /<rect width="(\d+)" height="(\d+)" x="(\d+)" y="(\d+)" fill="#([0-9a-fA-F]{6})"/g;
  let m;
  while ((m = re.exec(svg))) {
    const [w, h, x, y] = [m[1], m[2], m[3], m[4]].map((v) => Number(v) / 10);
    const color = m[5].toLowerCase();
    const orig = ImageData.palette.findIndex((c) => c.toLowerCase() === color);
    if (orig <= 0) continue; // 0 is transparent in the nouns palette too
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++)
        grid[(y + dy) * SIZE + (x + dx)] = orig + 1;
  }
  return grid;
}

// Aura overlays (our Tezos-native living trait): 0 bright = clean,
// 1 dim = thin grey frame, 2 dusty = heavy grey frame.
function auraGrid(level, greyOrig) {
  const grid = new Uint16Array(SIZE * SIZE);
  if (level === 0) return grid;
  const t = level === 1 ? 1 : 2;
  for (let i = 0; i < SIZE; i++)
    for (let d = 0; d < t; d++) {
      grid[d * SIZE + i] = greyOrig; grid[(SIZE - 1 - d) * SIZE + i] = greyOrig;
      grid[i * SIZE + d] = greyOrig; grid[i * SIZE + (SIZE - 1 - d)] = greyOrig;
    }
  return grid;
}

// ---- build all grids, compact the palette to used colors ----
const used = new Map(); // originalIdx+1 -> compactIdx (1-based; 0 stays clear)
const compact = (grid) => {
  const out = new Uint8Array(grid.length);
  grid.forEach((v, i) => {
    if (!v) return;
    if (!used.has(v)) used.set(v, used.size + 1);
    out[i] = used.get(v);
  });
  return out;
};

const layers = {}; // layer -> [{index, grid}]
// Colors not present in the trait palette (e.g. the two nouns background
// hexes) get synthetic slots appended after the real palette.
const extraColors = [];
const colorSlot = (hex6) => {
  const orig = ImageData.palette.findIndex((c) => c.toLowerCase() === hex6.toLowerCase());
  if (orig > 0) return orig + 1;
  const at = extraColors.indexOf(hex6);
  if (at !== -1) return ImageData.palette.length + at + 1;
  extraColors.push(hex6);
  return ImageData.palette.length + extraColors.length;
};
const slotHex = (slot) => slot <= ImageData.palette.length
  ? ImageData.palette[slot - 1] : extraColors[slot - ImageData.palette.length - 1];
const solid = (hex6) => new Uint16Array(SIZE * SIZE).fill(colorSlot(hex6));

layers.background = CURATION.background.map((name, index) => ({
  index, grid: compact(solid(ImageData.bgcolors[name === "cool" ? 0 : 1])),
}));
for (const group of ["body", "head", "glasses", "accessory"]) {
  const plural = group === "body" ? "bodies" :
    group === "accessory" ? "accessories" : group === "glasses" ? "glasses" : "heads";
  layers[group] = CURATION[group].map((name, index) => ({
    index, grid: compact(traitGrid(findPart(plural, name))),
  }));
}
// grey for aura frames: nouns palette 807f7e (index 5)
const greyIdx = colorSlot("807f7e");
layers.aura = [0, 1, 2].map((level) => ({ index: level, grid: compact(auraGrid(level, greyIdx)) }));

const toRLE = (grid) => {
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
};

const paletteEntries = [...used.entries()].map(([slot, idx]) => ({
  index: idx,
  color: Buffer.from("%23" + slotHex(slot)).toString("hex"),
}));

console.log(`palette: ${paletteEntries.length} colors used (of ${ImageData.palette.length})`);
let totalArtBytes = 0;
const artEntries = [];
for (const [layer, traits] of Object.entries(layers)) {
  for (const { index, grid } of traits) {
    if (layer === "aura" && index === 0) continue; // bright = clean, no art entry
    const rle = toRLE(grid);
    totalArtBytes += rle.length / 2;
    artEntries.push({ layer, index, rle });
  }
}
console.log(`art: ${artEntries.length} entries, ${totalArtBytes} bytes total`);

// local sanity render of one composed noun (head 0 wave + noggles 0)
if (process.argv.includes("--dry-run")) {
  const pal = new Map(paletteEntries.map((p) => [p.index, Buffer.from(p.color, "hex").toString()]));
  const parts = [layers.background[1], layers.body[0], layers.accessory[4], layers.head[0], layers.glasses[0]];
  let rects = "";
  const composed = new Uint8Array(SIZE * SIZE);
  for (const { grid } of parts) grid.forEach((v, i) => { if (v) composed[i] = v; });
  composed.forEach((v, i) => {
    if (!v) return;
    const x = (i % SIZE) * 10, y = Math.floor(i / SIZE) * 10;
    rects += `<rect x='${x}' y='${y}' width='10' height='10' fill='${decodeURIComponent(pal.get(v))}'/>`;
  });
  writeFileSync("/tmp/dryrun-noun.svg",
    `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320' shape-rendering='crispEdges'>${rects}</svg>`);
  console.log("dry run → /tmp/dryrun-noun.svg");
  process.exit(0);
}

// ---- upload ----
const Tezos = new TezosToolkit(process.env.RPC || "https://rpc.shadownet.teztnets.com");
Tezos.setSignerProvider(await InMemorySigner.fromSecretKey(process.env.ADMIN_KEY));
const c = await Tezos.contract.at(process.env.NOUNS_ADDRESS);

let batch = Tezos.contract.batch();
for (const p of paletteEntries) batch = batch.withContractCall(c.methodsObject.set_palette(p));
const op1 = await batch.send();
await op1.confirmation(1);
console.log("palette uploaded:", op1.hash);

let batch2 = Tezos.contract.batch();
for (const a of artEntries) batch2 = batch2.withContractCall(c.methodsObject.set_art(a));
const op2 = await batch2.send();
await op2.confirmation(1);
console.log("art uploaded:", op2.hash);

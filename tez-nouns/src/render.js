#!/usr/bin/env node
// Compose a noun SVG from on-chain seed + art manifest.
// Local mode:  node src/render.js <token_id>   (reads chain seed, local manifest)
// The "rle" strings in the placeholder manifest are shorthand generators;
// real art replaces them with packed [palette,run] byte pairs (see decodeRLE).

import { readFileSync } from "node:fs";

const SIZE = 32, PX = 10;
const manifest = JSON.parse(readFileSync(new URL("../art/manifest.json", import.meta.url)));
const P = manifest.palette;

function cells(shorthand) {
  // Returns array of [x,y,paletteIdx]
  const [kind, args = ""] = shorthand.split(":");
  const a = args.split(",").map(Number);
  const out = [];
  if (kind === "solid") for (let y=0;y<SIZE;y++) for (let x=0;x<SIZE;x++) out.push([x,y,a[0]]);
  if (kind === "rect")  { const [x0,y0,w,h,c]=a; for(let y=y0;y<y0+h;y++) for(let x=x0;x<x0+w;x++) out.push([x,y,c]); }
  if (kind === "ring")  { const [cx,cy,r,c]=a; for(let t=0;t<360;t+=3){ const x=Math.round(cx+r*Math.cos(t*Math.PI/180)), y=Math.round(cy+r*Math.sin(t*Math.PI/180)); if(x>=0&&y>=0&&x<SIZE&&y<SIZE) out.push([x,y,c]); } }
  if (kind === "noggles") { const [x0,y0,c]=a;
    for (const dx of [0,1,2,3, 7,8,9,10]) { out.push([x0+dx,y0,c]); out.push([x0+dx,y0+3,c]); }
    for (const dy of [1,2]) for (const dx of [0,3,7,10]) out.push([x0+dx,y0+dy,c]);
    for (const dx of [4,5,6]) out.push([x0+dx,y0+1,c]);          // bridge
    for (const dy of [1,2]) for (const dx of [1,2,8,9]) out.push([x0+dx,y0+dy,8]); // lenses
  }
  return out;
}

// Real RLE path: bytes as [paletteIdx, runLen] pairs, row-major from (0,0)
export function decodeRLE(bytes) {
  const out = []; let i = 0, pos = 0;
  while (i < bytes.length) {
    const [c, run] = [bytes[i], bytes[i+1]]; i += 2;
    for (let k = 0; k < run; k++, pos++) {
      if (c !== 0) out.push([pos % SIZE, Math.floor(pos / SIZE), c]);
    }
  }
  return out;
}

export function composeSVG(seed) {
  const order = ["background","body","accessory","head","glasses","aura"];
  let rects = "";
  for (const layer of order) {
    const trait = manifest.layers[layer][seed[layer]];
    if (!trait || trait.rle === "none") continue;
    for (const [x,y,c] of cells(trait.rle)) {
      if (P[c] === "transparent") continue;
      rects += `<rect x="${x*PX}" y="${y*PX}" width="${PX}" height="${PX}" fill="${P[c]}"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE*PX}" height="${SIZE*PX}" shape-rendering="crispEdges">${rects}</svg>`;
}

// CLI: fetch seed from chain and print SVG
if (process.argv[2] !== undefined) {
  const id = Number(process.argv[2]);
  const RPC = process.env.RPC || "https://ghostnet.tezos.ecadinfra.com";
  const addr = process.env.NOUNS_ADDRESS;
  if (!addr) { // offline demo: random seed
    const seed = { background: id % 4, body: id % 2, head: id % 2, glasses: 0, accessory: id % 4, aura: 0 };
    console.log(composeSVG(seed));
  } else {
    const { TezosToolkit } = await import("@taquito/taquito"); // lazy: offline mode needs no deps
    const Tezos = new TezosToolkit(RPC);
    const c = await Tezos.contract.at(addr);
    const noun = await c.contractViews.get_noun(id).executeView({ viewCaller: addr });
    const s = noun.seed;
    console.log(composeSVG({
      background: Number(s.background), body: Number(s.body), head: Number(s.head),
      glasses: Number(s.glasses), accessory: Number(s.accessory), aura: Number(s.aura),
    }));
  }
}

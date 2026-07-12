// Light on-chain reads for the landing + view-only passports.
// Everything here is indexer JSON — no Taquito, no Beacon, so the landing
// page never pays the wallet-stack download. The noun composer mirrors the
// contract's token_metadata view, client-side, from the same bigmaps.
const REGISTRY = import.meta.env.VITE_REGISTRY_ADDRESS || "";
const NOUNS = import.meta.env.VITE_NOUNS_ADDRESS || "";
const INDEXER = import.meta.env.VITE_INDEXER || "https://api.shadownet.tzkt.io";

export const hex2str = (h) => decodeURIComponent(h.replace(/../g, "%$&"));

export async function loadStampTypes() {
  if (!REGISTRY) return [];
  const res = await fetch(
    `${INDEXER}/v1/contracts/${REGISTRY}/bigmaps/types/keys?limit=200&active=true`
  );
  const rows = await res.json();
  return rows.map((r) => {
    const md = r.value.metadata || {};
    return {
      id: Number(r.key),
      name: md.name ? hex2str(md.name) : `Stamp #${r.key}`,
      description: md.description ? hex2str(md.description) : "",
      thumb: md.thumbnailUri ? hex2str(md.thumbnailUri) : null,
      gate: Object.keys(r.value.gate || { open: null })[0]?.toLowerCase(),
      total: Number(r.value.total || 0),
    };
  });
}

export async function walletHolds(address, id) {
  const res = await fetch(
    `${INDEXER}/v1/contracts/${REGISTRY}/bigmaps/ledger/keys?key.address=${address}&key.nat=${id}&active=true`
  );
  return (await res.json()).length > 0;
}

// Latest stamped wallets — the "recent arrivals" ledger on the landing.
export async function recentPassports(limit = 6) {
  if (!REGISTRY) return [];
  const res = await fetch(
    `${INDEXER}/v1/contracts/${REGISTRY}/bigmaps/ledger/keys?active=true&sort.desc=id&limit=24`
  );
  const rows = await res.json();
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    if (seen.has(r.key.address)) continue;
    seen.add(r.key.address);
    out.push(r.key.address);
    if (out.length >= limit) break;
  }
  return out;
}

// ---- client-side noun composer (mirror of the on-chain view) ----
let artCache = null;
async function nounArt() {
  if (artCache) return artCache;
  const [palRows, artRows] = await Promise.all([
    fetch(`${INDEXER}/v1/contracts/${NOUNS}/bigmaps/palette/keys?limit=300&active=true`).then((r) => r.json()),
    fetch(`${INDEXER}/v1/contracts/${NOUNS}/bigmaps/art/keys?limit=100&active=true`).then((r) => r.json()),
  ]);
  const palette = new Map(palRows.map((r) => [Number(r.key), hex2str(r.value)]));
  const art = new Map(artRows.map((r) => [`${r.key.string}:${r.key.nat}`, r.value]));
  return (artCache = { palette, art });
}

const LAYER_ORDER = ["background", "body", "accessory", "head", "glasses", "aura"];

export async function composeNounSVG(seed) {
  const { palette, art } = await nounArt();
  let rects = "";
  for (const layer of LAYER_ORDER) {
    const rle = art.get(`${layer}:${seed[layer]}`);
    if (!rle) continue;
    let pos = 0;
    for (let i = 0; i + 4 <= rle.length; i += 4) {
      const c = parseInt(rle.slice(i, i + 2), 16);
      let run = parseInt(rle.slice(i + 2, i + 4), 16);
      if (c === 0) { pos += run; continue; }
      while (run > 0) {
        const x = pos % 32, y = (pos / 32) | 0;
        const w = Math.min(run, 32 - x);
        rects += `<rect x='${x * 10}' y='${y * 10}' width='${w * 10}' height='10' fill='${decodeURIComponent(palette.get(c) || "")}'/>`;
        pos += w; run -= w;
      }
    }
  }
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 320' shape-rendering='crispEdges'>${rects}</svg>`;
}

// Nouns owned by an address (or the latest minted overall with address=null).
export async function loadNouns(address, limit = 8) {
  if (!NOUNS) return [];
  const q = address ? `&value=${address}` : "";
  const owners = await fetch(
    `${INDEXER}/v1/contracts/${NOUNS}/bigmaps/ledger/keys?active=true&sort.desc=id&limit=${limit}${q}`
  ).then((r) => r.json());
  const nounsMap = await fetch(
    `${INDEXER}/v1/contracts/${NOUNS}/bigmaps/nouns/keys?active=true&limit=200`
  ).then((r) => r.json());
  const byId = new Map(nounsMap.map((r) => [r.key, r.value]));
  const out = [];
  for (const o of owners) {
    const n = byId.get(o.key);
    if (!n) continue;
    const seed = Object.fromEntries(Object.entries(n.seed).map(([k, v]) => [k, Number(v)]));
    out.push({
      id: Number(o.key),
      owner: o.value,
      name: `Tez Noun ${o.key}`,
      svg: await composeNounSVG(seed),
    });
  }
  return out;
}

// Indexer reads for the personal page — TzKT JSON only. No Taquito, no
// Beacon: viewing any wallet never pays the wallet-stack download.
export const NETWORK = import.meta.env.VITE_NETWORK || "shadownet";
export const INDEXER = import.meta.env.VITE_INDEXER ||
  (NETWORK === "mainnet" ? "https://api.tzkt.io" : "https://api.shadownet.tzkt.io");

const CAST = import.meta.env.VITE_CAST_ADDRESS || "";
const REGISTRY = import.meta.env.VITE_REGISTRY_ADDRESS || "";
const NOUNS = import.meta.env.VITE_NOUNS_ADDRESS || "";
const POSTCARDS = import.meta.env.VITE_POSTCARDS_ADDRESS || "";

export const hex2str = (h) => {
  try { return decodeURIComponent(h.replace(/../g, "%$&")); }
  catch { return ""; }
};

const j = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);

// ---- account vitals ----
export async function getAccount(addr) {
  const a = await j(`${INDEXER}/v1/accounts/${addr}`);
  if (!a) return null;
  return {
    balance: Number(a.balance || 0) / 1e6,
    alias: a.alias || null,
    firstSeen: a.firstActivityTime || null,
    lastSeen: a.lastActivityTime || null,
    firstLevel: a.firstActivity || null,
    lastLevel: a.lastActivity || null,
    ops: Number(a.numTransactions ?? 0),
    type: a.type,
  };
}

// Balance over time — sampled between the account's first and last levels.
export async function getBalanceHistory(addr, acct, points = 60) {
  if (!acct?.firstLevel || !acct?.lastLevel) return [];
  const step = Math.max(1, Math.floor((acct.lastLevel - acct.firstLevel) / points));
  const rows = await j(
    `${INDEXER}/v1/accounts/${addr}/balance_history?step=${step}&select=timestamp,balance&limit=${points + 40}`
  );
  if (!rows) return [];
  return rows.map((r) => ({ t: r.timestamp, v: Number(r.balance) / 1e6 }));
}

// Recent operation timestamps, bucketed per day for the activity strip.
export async function getActivity(addr, days = 56) {
  const rows = await j(
    `${INDEXER}/v1/accounts/${addr}/operations?limit=200&select=timestamp`
  );
  const buckets = new Array(days).fill(0);
  const now = Date.now();
  for (const r of rows || []) {
    const t = new Date(r.timestamp ?? r).getTime();
    const ago = Math.floor((now - t) / 86400000);
    if (ago >= 0 && ago < days) buckets[days - 1 - ago]++;
  }
  return buckets;
}

// Fungible-token holdings (anything indexed, minus zero balances).
export async function getTokens(addr, limit = 12) {
  const rows = await j(
    `${INDEXER}/v1/tokens/balances?account=${addr}&balance.gt=0&limit=${limit}&sort.desc=lastLevel`
  );
  return (rows || [])
    .map((r) => {
      const md = r.token?.metadata || {};
      const dec = Number(md.decimals || 0);
      return {
        name: md.name || md.symbol || null,
        symbol: md.symbol || "",
        amount: Number(r.balance) / 10 ** dec,
        contract: r.token?.contract?.address,
      };
    })
    .filter((t) => t.name);
}

// ---- the cast tower ----
export async function getCasts({ author = null, limit = 30 } = {}) {
  if (!CAST) return [];
  const q = author ? `&value.author=${author}` : "";
  const rows = await j(
    `${INDEXER}/v1/contracts/${CAST}/bigmaps/casts/keys?active=true&sort.desc=id&limit=${limit}${q}`
  );
  return (rows || []).map((r) => ({
    id: Number(r.key),
    author: r.value.author,
    kind: Number(r.value.kind),
    body: hex2str(r.value.body),
    at: r.value.cast_at,
  }));
}

export async function getCastCount(addr) {
  if (!CAST) return 0;
  const row = await j(`${INDEXER}/v1/contracts/${CAST}/bigmaps/by_author/keys/${addr}`);
  return Number(row?.value || 0);
}

// ---- sibling contracts: stamps, nouns, postcards ----
export async function getStamps(addr) {
  if (!REGISTRY) return [];
  const [held, types] = await Promise.all([
    j(`${INDEXER}/v1/contracts/${REGISTRY}/bigmaps/ledger/keys?key.address=${addr}&active=true&limit=100`),
    j(`${INDEXER}/v1/contracts/${REGISTRY}/bigmaps/types/keys?limit=200&active=true`),
  ]);
  const byId = new Map((types || []).map((r) => [r.key, r.value]));
  return (held || []).map((r) => {
    const t = byId.get(r.key.nat) || {};
    const md = t.metadata || {};
    return {
      id: Number(r.key.nat),
      name: md.name ? hex2str(md.name) : `Stamp #${r.key.nat}`,
      thumb: md.thumbnailUri ? hex2str(md.thumbnailUri) : null,
    };
  });
}

// Client-side noun composer — mirrors the contract's token_metadata view.
let artCache = null;
async function nounArt() {
  if (artCache) return artCache;
  const [palRows, artRows] = await Promise.all([
    j(`${INDEXER}/v1/contracts/${NOUNS}/bigmaps/palette/keys?limit=300&active=true`),
    j(`${INDEXER}/v1/contracts/${NOUNS}/bigmaps/art/keys?limit=100&active=true`),
  ]);
  const palette = new Map((palRows || []).map((r) => [Number(r.key), hex2str(r.value)]));
  const art = new Map((artRows || []).map((r) => [`${r.key.string}:${r.key.nat}`, r.value]));
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

export async function getNouns(addr, limit = 8) {
  if (!NOUNS) return [];
  const owners = await j(
    `${INDEXER}/v1/contracts/${NOUNS}/bigmaps/ledger/keys?active=true&sort.desc=id&limit=${limit}&value=${addr}`
  );
  if (!owners?.length) return [];
  const nounsMap = await j(`${INDEXER}/v1/contracts/${NOUNS}/bigmaps/nouns/keys?active=true&limit=200`);
  const byId = new Map((nounsMap || []).map((r) => [r.key, r.value]));
  const out = [];
  for (const o of owners) {
    const n = byId.get(o.key);
    if (!n) continue;
    const seed = Object.fromEntries(Object.entries(n.seed).map(([k, v]) => [k, Number(v)]));
    out.push({ id: Number(o.key), svg: await composeNounSVG(seed) });
  }
  return out;
}

// Postcard backgrounds — index is on-chain, art lives client-side.
export const POSTCARD_BGS = [
  { name: "Blue hour", css: "linear-gradient(160deg,#1a2a6c,#b21f66,#fdbb2d)" },
  { name: "El Segundo dusk", css: "linear-gradient(160deg,#f5e6d3,#cc5500,#5c1a1a)" },
  { name: "Kelp", css: "linear-gradient(160deg,#0f3443,#34e89e)" },
  { name: "Cotton candy", css: "linear-gradient(160deg,#ff9a9e,#fad0c4,#a18cd1)" },
  { name: "Grid paper", css: "linear-gradient(160deg,#e0eafc,#cfdef3)" },
  { name: "Noir", css: "linear-gradient(160deg,#232526,#414345)" },
];

export async function getPostcards(addr, limit = 6) {
  if (!POSTCARDS) return [];
  const rows = await j(
    `${INDEXER}/v1/contracts/${POSTCARDS}/bigmaps/cards/keys?value.to_=${addr}&active=true&sort.desc=id&limit=${limit}`
  );
  const out = [];
  for (const r of rows || []) {
    const v = r.value;
    const seedRow = await j(`${INDEXER}/v1/contracts/${NOUNS}/bigmaps/nouns/keys/${v.noun}`);
    const seed = Object.fromEntries(
      Object.entries(seedRow?.value?.seed || {}).map(([k, x]) => [k, Number(x)])
    );
    out.push({
      from: v.from_,
      background: Number(v.background),
      note: v.note ? hex2str(v.note) : "",
      at: v.sent_at,
      svg: await composeNounSVG(seed),
    });
  }
  return out;
}

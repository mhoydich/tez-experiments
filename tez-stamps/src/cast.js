// The broadcast tower joins the passport office. Indexer-only reads for
// casts (tez-cast's contract) + account vitals — no wallet stack here.
import { hex2str } from "./board.js";

const NETWORK = import.meta.env.VITE_NETWORK || "shadownet";
const INDEXER = import.meta.env.VITE_INDEXER ||
  (NETWORK === "mainnet" ? "https://api.tzkt.io" : "https://api.shadownet.tzkt.io");
const CAST = import.meta.env.VITE_CAST_ADDRESS || "";
const REGISTRY = import.meta.env.VITE_REGISTRY_ADDRESS || "";

const j = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);

export const KINDS = ["note", "link", "art"];

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

export async function getCast(id) {
  if (!CAST) return null;
  const r = await j(`${INDEXER}/v1/contracts/${CAST}/bigmaps/casts/keys/${id}`);
  if (!r?.value) return null;
  return {
    id: Number(r.key),
    author: r.value.author,
    kind: Number(r.value.kind),
    body: hex2str(r.value.body),
    at: r.value.cast_at,
  };
}

export async function getCastCount(addr) {
  if (!CAST) return 0;
  const row = await j(`${INDEXER}/v1/contracts/${CAST}/bigmaps/by_author/keys/${addr}`);
  return Number(row?.value || 0);
}

// Top authors by total casts — "loudest towers" on the landing.
export async function topCasters(limit = 5) {
  if (!CAST) return [];
  const rows = await j(
    `${INDEXER}/v1/contracts/${CAST}/bigmaps/by_author/keys?active=true&limit=500`
  );
  return (rows || [])
    .map((r) => ({ address: r.key, count: Number(r.value) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// Top wallets by stamps held — "most stamped" on the landing.
export async function topStamped(limit = 5) {
  if (!REGISTRY) return [];
  const rows = await j(
    `${INDEXER}/v1/contracts/${REGISTRY}/bigmaps/ledger/keys?active=true&limit=1000&select=key`
  );
  const counts = new Map();
  for (const r of rows || []) {
    const a = r.address ?? r.key?.address;
    if (a) counts.set(a, (counts.get(a) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([address, count]) => ({ address, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ---- rally: the pickleball rating desk (tez-rally template) ----
const RALLY = import.meta.env.VITE_RALLY_ADDRESS || "";

export async function getRallyPlayer(addr) {
  if (!RALLY) return null;
  const r = await j(`${INDEXER}/v1/contracts/${RALLY}/bigmaps/players/keys/${addr}`);
  if (!r?.value || r.active === false) return null;
  const v = r.value;
  return {
    declared: Number(v.declared),
    rating: Number(v.rating),
    matches: Number(v.matches),
    wins: Number(v.wins),
    declaredAt: v.declared_at,
  };
}

// ---- account vitals (any address) ----
export async function getAccount(addr) {
  const a = await j(`${INDEXER}/v1/accounts/${addr}`);
  if (!a) return null;
  return {
    balance: Number(a.balance || 0) / 1e6,
    alias: a.alias || null,
    firstSeen: a.firstActivityTime || null,
    firstLevel: a.firstActivity || null,
    lastLevel: a.lastActivity || null,
    ops: Number(a.numTransactions ?? 0),
    type: a.type,
  };
}

export async function getBalanceHistory(addr, acct, points = 60) {
  if (!acct?.firstLevel || !acct?.lastLevel) return [];
  const step = Math.max(1, Math.floor((acct.lastLevel - acct.firstLevel) / points));
  const rows = await j(
    `${INDEXER}/v1/accounts/${addr}/balance_history?step=${step}&select=timestamp,balance&limit=${points + 40}`
  );
  return (rows || []).map((r) => ({ t: r.timestamp, v: Number(r.balance) / 1e6 }));
}

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

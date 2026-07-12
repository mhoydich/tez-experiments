// The office prints public pages now. A page is the office's one-sheet for
// a passport: portrait, name, links, and the stamp strip — a link-in-bio
// where every fact is already on-chain. No new contracts: links are `link`
// casts on the broadcast tower ("label | url"), latest-wins per label,
// retired by casting the label with an empty url. The page is simply the
// current reading of a permanent log. Names ride Tezos Domains (.tez).
import { getCasts, getAccount, getCastCount } from "./cast.js";

const NETWORK = import.meta.env.VITE_NETWORK || "shadownet";
const INDEXER = import.meta.env.VITE_INDEXER ||
  (NETWORK === "mainnet" ? "https://api.tzkt.io" : "https://api.shadownet.tzkt.io");

const j = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);

export const isAddress = (v) => /^(tz[1-4]|KT1)[1-9A-HJ-NP-Za-km-z]{33}$/.test(v);
export const isDomain = (v) => /^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)*\.tez$/i.test(v);

// name.tez -> tz address (tzkt indexes Tezos Domains; mainnet only)
export async function resolveDomain(name) {
  const rows = await j(`${INDEXER}/v1/domains?name=${encodeURIComponent(name.toLowerCase())}&select=address&limit=1`);
  const a = rows?.[0];
  return (typeof a === "string" ? a : a?.address) || null;
}

// tz address -> its reverse-record .tez name, if the owner set one
export async function reverseDomain(addr) {
  const rows = await j(`${INDEXER}/v1/domains?address.eq=${addr}&reverse=true&select=name&limit=1`);
  return rows?.[0] || null;
}

// ---------- links: a folk-CRDT over the append-only tower ----------
// "label | https://url"  -> named link
// "label |"              -> retires the label
// "https://url"          -> bare link, label = hostname
export function parseLinkCast(body) {
  const i = body.indexOf("|");
  if (i >= 0) {
    const label = body.slice(0, i).trim();
    const url = body.slice(i + 1).trim();
    if (!label) return null;
    return { label, url: /^https?:\/\/\S+$/.test(url) ? url : null };
  }
  const bare = body.trim();
  if (/^https?:\/\/\S+$/.test(bare)) {
    try { return { label: new URL(bare).hostname.replace(/^www\./, ""), url: bare }; }
    catch { return null; }
  }
  return null;
}

// Current links for an address: newest cast per label wins; null url = gone.
export async function pageLinks(addr) {
  const casts = await getCasts({ author: addr, limit: 200 });
  const seen = new Map();
  for (const c of casts) { // getCasts returns newest first
    if (c.kind !== 1) continue;
    const p = parseLinkCast(c.body);
    if (!p) continue;
    const key = p.label.toLowerCase();
    if (!seen.has(key)) seen.set(key, p);
  }
  return [...seen.values()].filter((p) => p.url);
}

// ---------- the page's masthead facts ----------
export async function pageIdentity(addr) {
  const [acct, domain, castCount] = await Promise.all([
    getAccount(addr), reverseDomain(addr), getCastCount(addr),
  ]);
  return {
    address: addr,
    name: domain || acct?.alias || null,
    domain,
    since: acct?.firstSeen || null,
    ops: acct?.ops ?? 0,
    castCount,
  };
}

// ---------- QR (lazy — only pages pay for it) ----------
export async function qrDataUrl(text) {
  try {
    const QR = await import("qrcode");
    return await QR.toDataURL(text, {
      margin: 1, width: 168,
      color: { dark: "#241f1c", light: "#ffffff" },
    });
  } catch { return null; }
}

// ---------- vCard: the page as a contact file ----------
export function vcard({ name, address, pageUrl, links }) {
  const lines = [
    "BEGIN:VCARD", "VERSION:3.0",
    `FN:${name || address}`,
    `URL:${pageUrl}`,
    ...links.slice(0, 8).map((l) => `URL;TYPE=${l.label.replace(/[;:,]/g, " ")}:${l.url}`),
    `NOTE:Tezos ${address} — page printed by stampz.xyz`,
    "END:VCARD",
  ];
  return lines.join("\r\n");
}

export function downloadVcard(identity, links) {
  const blob = new Blob([vcard({
    name: identity.name, address: identity.address,
    pageUrl: `${location.origin}/?p=${identity.domain || identity.address}`,
    links,
  })], { type: "text/vcard" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(identity.name || identity.address).replace(/[^a-z0-9.-]/gi, "_")}.vcf`;
  a.click();
  URL.revokeObjectURL(a.href);
}

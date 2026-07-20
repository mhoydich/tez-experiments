import {
  escapeHtml,
  formatReceiptTime,
  receiptWish,
  shortenAddress,
  siteOrigin,
  truncateText,
} from "../src/share-fountain";
import {
  readRecentFountainReceipts,
  recentFountainReceiptLimit,
} from "../src/fountain-discovery";

const canonical = `${siteOrigin}/wishes`;
const feedUrl = `${siteOrigin}/fountain-feed.json`;

const pageHeaders = {
  "Cache-Control": "public, max-age=30, s-maxage=90, stale-while-revalidate=300",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "Content-Type": "text/html; charset=utf-8",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "index, follow, max-image-preview:large",
};

const errorHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "text/html; charset=utf-8",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
};

const shell = (body: string): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>recent public wishes — the fountain</title>
<meta name="description" content="Recent verified one-tez wishes tossed into the Fountain on Tezos." />
<meta name="robots" content="index, follow, max-image-preview:large" />
<meta property="og:title" content="recent public wishes — the fountain" />
<meta property="og:description" content="One tez at a time: recent public wishes verified against the Fountain contract." />
<meta property="og:image" content="${siteOrigin}/og/fountain" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${canonical}" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="canonical" href="${canonical}" />
<link rel="alternate" type="application/feed+json" title="The Fountain: recent wishes" href="${feedUrl}" />
<style>
  :root{--paper:#f2efe9;--white:#fffdf8;--ink:#241f1c;--blue:#0f61ff;--water:#86d9f7;--line:#d8d2c6;--dim:#6b6259}
  *{box-sizing:border-box}html{color-scheme:light}body{margin:0;background:var(--paper);color:var(--ink);font-family:Georgia,"Times New Roman",serif;background-image:radial-gradient(var(--line) 1px,transparent 1px);background-size:28px 28px}
  a{color:var(--blue)}main{width:min(920px,calc(100% - 32px));margin:32px auto 64px;background:var(--white);border:1.5px solid var(--ink);box-shadow:9px 9px 0 var(--blue)}
  header{padding:clamp(1.5rem,5vw,3.5rem);border-bottom:1.5px solid var(--ink)}.eyebrow,.meta,.machine{font-family:ui-monospace,"SF Mono",Menlo,monospace}.eyebrow{margin:0 0 1.25rem;color:var(--blue);font-size:.7rem;letter-spacing:.16em;text-transform:uppercase}
  h1{margin:0;font-size:clamp(2.7rem,9vw,5.8rem);line-height:.92;font-weight:500;font-style:italic}.lede{max-width:48rem;margin:1.4rem 0 0;font-size:1.12rem;line-height:1.55}
  ol{list-style:none;margin:0;padding:0}.wish{display:grid;grid-template-columns:7.5rem minmax(0,1fr);gap:clamp(1rem,4vw,2.4rem);padding:clamp(1.25rem,4vw,2.2rem);border-bottom:1px solid var(--line)}.wish:last-child{border-bottom:0}
  .coin{display:grid;place-items:center;align-self:start;width:5.8rem;height:5.8rem;border:2px solid var(--ink);border-radius:999px;background:var(--water);box-shadow:5px 5px 0 var(--blue);font-size:2.2rem;color:var(--blue)}
  blockquote{min-width:0;margin:0 0 .9rem;font-size:clamp(1.25rem,4vw,1.85rem);line-height:1.35;font-style:italic;overflow-wrap:anywhere;white-space:pre-wrap}.meta{display:flex;flex-wrap:wrap;gap:.45rem 1rem;color:var(--dim);font-size:.68rem;line-height:1.5}.meta a{overflow-wrap:anywhere}
  .empty{margin:0;padding:3rem;text-align:center;color:var(--dim);font-style:italic}.machine{margin:0;padding:1rem 1.4rem;border-top:1.5px solid var(--ink);background:var(--paper);font-size:.68rem;line-height:1.6;text-align:center}.machine a{overflow-wrap:anywhere}
  @media(max-width:620px){main{width:calc(100% - 20px);margin:14px auto 34px;box-shadow:6px 6px 0 var(--blue)}.wish{grid-template-columns:1fr}.coin{width:4.4rem;height:4.4rem;font-size:1.65rem}}
</style>
</head>
<body>${body}</body>
</html>`;

const unavailablePage = (): string => shell(`<main>
  <header><p class="eyebrow">the fountain · public ledger</p><h1>the water is quiet</h1><p class="lede">Recent wishes could not be read from the chain just now. The Fountain itself remains on Tezos.</p></header>
  <p class="machine"><a href="${siteOrigin}/fountain">return to the fountain</a></p>
</main>`);

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const receipts = await readRecentFountainReceipts(context.env, recentFountainReceiptLimit);
    const items = receipts.map((receipt) => {
      const wish = truncateText(receiptWish(receipt), 320);
      const receiptUrl = `${siteOrigin}/wish/${encodeURIComponent(receipt.hash)}`;
      return `<li class="wish">
  <div class="coin" aria-hidden="true">1ꜩ</div>
  <article>
    <blockquote>“${escapeHtml(wish)}”</blockquote>
    <div class="meta">
      <span title="${escapeHtml(receipt.sender)}">${escapeHtml(shortenAddress(receipt.sender))}</span>
      <time datetime="${escapeHtml(receipt.timestamp)}">${escapeHtml(formatReceiptTime(receipt.timestamp))} UTC</time>
      <a href="${receiptUrl}">verified receipt →</a>
    </div>
  </article>
</li>`;
    }).join("");
    const ledger = items
      ? `<ol aria-label="Recent verified Fountain wishes">${items}</ol>`
      : `<p class="empty">No applied one-tez tosses have reached this Fountain yet.</p>`;
    const body = `<main>
  <header>
    <p class="eyebrow">the fountain · public ledger · tezos mainnet</p>
    <h1>recent wishes</h1>
    <p class="lede">Each entry below is rechecked as one unambiguous, external, applied <strong>one-tez</strong> toss into the configured Fountain. Wishes and wallet addresses are public forever.</p>
  </header>
  ${ledger}
  <p class="machine"><a href="${siteOrigin}/fountain">visit the fountain</a> · <a href="${feedUrl}">read the JSON feed</a> · newest ${recentFountainReceiptLimit} at most</p>
</main>`;
    return new Response(shell(body), { headers: pageHeaders });
  } catch (error) {
    console.error(JSON.stringify({
      message: "recent fountain wishes page failed",
      error: error instanceof Error ? error.message : String(error),
    }));
    return new Response(unavailablePage(), { status: 502, headers: errorHeaders });
  }
};

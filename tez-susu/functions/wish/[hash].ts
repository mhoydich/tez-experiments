import {
  escapeHtml,
  formatReceiptTime,
  operationHashPattern,
  readFountainReceipt,
  receiptWish,
  siteOrigin,
  truncateText,
} from "../../src/share-fountain";

const pageHeaders = {
  "Cache-Control": "public, max-age=60, s-maxage=180, stale-while-revalidate=600",
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy": "default-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const notFoundHeaders = {
  ...pageHeaders,
  "Cache-Control": "public, max-age=30",
  "X-Robots-Tag": "noindex, nofollow",
};

const shell = (head: string, body: string): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${head}
<style>
  :root{--paper:#f2efe9;--white:#fffdf8;--ink:#241f1c;--blue:#0f61ff;--water:#86d9f7;--line:#d8d2c6;--dim:#6b6259}
  *{box-sizing:border-box}
  body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;overflow-x:hidden;background:var(--paper);color:var(--ink);font-family:Georgia,"Times New Roman",serif;background-image:radial-gradient(var(--line) 1px,transparent 1px);background-size:28px 28px}
  main{width:min(680px,100%);min-width:0;background:var(--white);border:1.5px solid var(--ink);padding:clamp(1.35rem,5vw,2.5rem);box-shadow:9px 9px 0 var(--blue)}
  .eyebrow,.facts,.note,.source{font-family:ui-monospace,"SF Mono",Menlo,monospace}
  .eyebrow{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.5rem 1rem;margin:0 0 1.5rem;color:var(--blue);font-size:.68rem;letter-spacing:.18em;text-transform:uppercase}
  .seal{display:grid;place-items:center;width:64px;height:64px;margin:0 0 1rem;border:2px solid var(--blue);border-radius:999px;color:var(--blue);font-size:2rem;box-shadow:inset 0 0 0 7px var(--water)}
  h1{margin:0 0 1.15rem;font-size:clamp(2.15rem,9vw,4rem);line-height:1.03;font-weight:500}
  blockquote{max-width:100%;min-width:0;margin:0;padding:1.2rem 1.25rem;border:1.5px solid var(--ink);background:var(--paper);box-shadow:4px 4px 0 var(--water);font-size:clamp(1.2rem,4vw,1.65rem);line-height:1.4;font-style:italic;overflow-wrap:anywhere;white-space:pre-wrap}
  .facts{display:grid;grid-template-columns:1fr;gap:.65rem;margin:1.45rem 0}
  .fact{display:grid;grid-template-columns:7rem minmax(0,1fr);min-width:0;gap:.7rem;padding:.7rem 0;border-bottom:1px solid var(--line);font-size:.72rem;line-height:1.45}
  .fact dt{color:var(--dim);letter-spacing:.1em;text-transform:uppercase}.fact dd{min-width:0;margin:0;overflow-wrap:anywhere;word-break:break-word}
  a{color:var(--blue);overflow-wrap:anywhere;word-break:break-word}
  a.button{display:block;margin-top:1.5rem;padding:.9rem 1rem;border:1.5px solid var(--ink);background:var(--blue);color:#fff;text-align:center;text-decoration:none;box-shadow:4px 4px 0 var(--ink);font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:.78rem;letter-spacing:.08em;text-transform:uppercase}
  a.button:hover{transform:translate(-1px,-1px);box-shadow:5px 5px 0 var(--ink)}
  .note{margin:1.2rem 0 0;color:var(--dim);font-size:.67rem;line-height:1.6}
  .source{margin:1rem 0 0;font-size:.62rem;color:var(--dim)}
  @media (max-width:600px){.eyebrow{display:block}.eyebrow span{display:block;margin-bottom:.35rem}.fact{grid-template-columns:1fr;gap:.2rem}}
</style>
</head>
<body>${body}</body>
</html>`;

const missingPage = (): string => shell(
  `<title>no such toss — the fountain</title><meta name="robots" content="noindex, nofollow" />`,
  `<main><p class="eyebrow"><span>the fountain</span><span>tezos · mainnet</span></p><div class="seal">ꜩ</div><h1>no such toss</h1><p>This operation is not an applied one-tez toss into this fountain.</p><a class="button" href="${siteOrigin}/fountain">back to the fountain →</a></main>`,
);

export const onRequestGet: PagesFunction<Env, "hash"> = async (context) => {
  const param = context.params.hash;
  const hash = Array.isArray(param) ? param[0] || "" : param;
  if (!operationHashPattern.test(hash)) {
    return new Response(missingPage(), { status: 404, headers: notFoundHeaders });
  }

  try {
    const receipt = await readFountainReceipt(hash, context.env);
    if (!receipt) return new Response(missingPage(), { status: 404, headers: notFoundHeaders });

    const wish = receiptWish(receipt);
    const wishHtml = escapeHtml(wish);
    const walletHtml = escapeHtml(receipt.sender);
    const time = formatReceiptTime(receipt.timestamp);
    const timeHtml = escapeHtml(time);
    const hashHtml = escapeHtml(receipt.hash);
    const title = escapeHtml(`${truncateText(wish, 58)} — a fountain toss`);
    const description = escapeHtml(`One tez joined the fountain from ${receipt.sender}. ${truncateText(wish, 120)}`);
    const canonical = `${siteOrigin}/wish/${encodeURIComponent(receipt.hash)}`;
    const image = `${siteOrigin}/og/wish/${encodeURIComponent(receipt.hash)}.png`;
    const operationUrl = `https://tzkt.io/${encodeURIComponent(receipt.hash)}`;
    const walletUrl = `https://tzkt.io/${encodeURIComponent(receipt.sender)}`;
    const head = `<title>${title}</title>
<meta name="description" content="${description}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="${image}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${canonical}" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="canonical" href="${canonical}" />`;
    const body = `<main>
  <p class="eyebrow"><span>the fountain · toss receipt</span><span>tezos · mainnet</span></p>
  <div class="seal">ꜩ</div>
  <h1>a coin in<br />the water</h1>
  <blockquote>“${wishHtml}”</blockquote>
  <dl class="facts">
    <div class="fact"><dt>coin</dt><dd>1 tez</dd></div>
    <div class="fact"><dt>wallet</dt><dd><a href="${walletUrl}" rel="noopener">${walletHtml}</a></dd></div>
    <div class="fact"><dt>time</dt><dd><time datetime="${escapeHtml(receipt.timestamp)}">${timeHtml} UTC</time></dd></div>
    <div class="fact"><dt>operation</dt><dd><a href="${operationUrl}" rel="noopener">${hashHtml}</a></dd></div>
  </dl>
  <p class="note">This one-tez coin joined the fountain's equal split. Its wish is public transaction data in the <a href="${operationUrl}" rel="noopener">Tezos operation</a>.</p>
  <a class="button" href="${siteOrigin}/fountain">toss a coin →</a>
  <p class="source">Data provided by <a href="https://tzkt.io" rel="noopener">TzKT API</a>.</p>
</main>`;
    return new Response(shell(head, body), { headers: pageHeaders });
  } catch (error) {
    console.error(JSON.stringify({
      message: "fountain receipt page failed",
      operationHash: hash,
      error: error instanceof Error ? error.message : String(error),
    }));
    return new Response("the chain could not be read", {
      status: 502,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }
};

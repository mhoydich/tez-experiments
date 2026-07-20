import {
  fountainAddress,
  receiptWish,
  siteOrigin,
  truncateText,
} from "../src/share-fountain";
import {
  readRecentFountainReceipts,
  recentFountainReceiptLimit,
} from "../src/fountain-discovery";

const feedUrl = `${siteOrigin}/fountain-feed.json`;
const wishesUrl = `${siteOrigin}/wishes`;

const feedHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=30, s-maxage=90, stale-while-revalidate=300",
  "Content-Type": "application/feed+json; charset=utf-8",
  "Link": `<${feedUrl}>; rel="self"; type="application/feed+json", <${wishesUrl}>; rel="alternate"; type="text/html"`,
  "X-Content-Type-Options": "nosniff",
};

const errorHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const fountain = fountainAddress(context.env);
    const receipts = await readRecentFountainReceipts(context.env, recentFountainReceiptLimit);
    const feed = {
      version: "https://jsonfeed.org/version/1.1",
      title: "The Fountain — recent public wishes",
      home_page_url: `${siteOrigin}/fountain`,
      feed_url: feedUrl,
      description: "Recent external, applied, exact-one-tez tosses into the configured Fountain on Tezos Mainnet.",
      language: "en-US",
      items: receipts.map((receipt) => {
        const wish = truncateText(receiptWish(receipt), 320);
        const receiptUrl = `${siteOrigin}/wish/${encodeURIComponent(receipt.hash)}`;
        return {
          id: `urn:tezos:operation:${receipt.hash}`,
          url: receiptUrl,
          external_url: `https://tzkt.io/${encodeURIComponent(receipt.hash)}`,
          title: truncateText(wish, 90),
          content_text: wish,
          date_published: receipt.timestamp,
          authors: [{
            name: receipt.sender,
            url: `https://tzkt.io/${encodeURIComponent(receipt.sender)}`,
          }],
          _tezos: {
            network: "mainnet",
            operation_hash: receipt.hash,
            contract: receipt.target,
            entrypoint: "toss",
            amount_mutez: 1_000_000,
            amount_tez: "1",
            receipt_url: receiptUrl,
          },
        };
      }),
      _fountain: {
        contract: fountain,
        network: "mainnet",
        validation: "external + applied + one unambiguous toss + exact 1000000 mutez + configured target",
        maximum_items: recentFountainReceiptLimit,
        human_url: wishesUrl,
      },
    };
    return new Response(JSON.stringify(feed, null, 2), { headers: feedHeaders });
  } catch (error) {
    console.error(JSON.stringify({
      message: "fountain JSON feed failed",
      error: error instanceof Error ? error.message : String(error),
    }));
    return new Response(JSON.stringify({ error: "chain_unavailable" }), {
      status: 502,
      headers: errorHeaders,
    });
  }
};

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const helper = read("src/fountain-discovery.ts");
const wishes = read("functions/wishes.ts");
const feed = read("functions/fountain-feed.json.ts");

test("recent discovery reuses the receipt validator and bounds indexer work", () => {
  assert.match(helper, /fountainAddress/);
  assert.match(helper, /parseFountainReceipt\(\[candidate\], hash, fountain\)/);
  assert.match(helper, /readFountainReceipt\(hash, env\)/);
  assert.match(helper, /const maximumResults = 18/);
  assert.match(helper, /const candidateLimit = 24/);
  assert.match(helper, /entrypoint: "toss"/);
  assert.match(helper, /status: "applied"/);
});

test("the human ledger is canonical, indexable, escaped, and receipt-linked", () => {
  assert.match(wishes, /<link rel="canonical" href="\$\{canonical\}"/);
  assert.match(wishes, /index, follow, max-image-preview:large/);
  assert.match(wishes, /escapeHtml\(wish\)/);
  assert.match(wishes, /\/wish\/\$\{encodeURIComponent\(receipt\.hash\)\}/);
  assert.match(wishes, /readRecentFountainReceipts/);
});

test("the machine feed identifies exact tez operations and fails closed", () => {
  assert.match(feed, /https:\/\/jsonfeed\.org\/version\/1\.1/);
  assert.match(feed, /amount_mutez: 1_000_000/);
  assert.match(feed, /receipt_url: receiptUrl/);
  assert.match(feed, /status: 502/);
  assert.match(feed, /"Cache-Control": "no-store"/);
  assert.match(feed, /fountainAddress\(context\.env\)/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const fountainHtml = read("public/fountain.html");
const printHtml = read("public/print.html");
const wrangler = read("wrangler.jsonc");

test("the public page exposes only the claim-based V2 operation surface", () => {
  assert.match(fountainHtml, /entrypoint:'toss'/);
  assert.match(fountainHtml, /entrypoint:'finalize'/);
  assert.match(fountainHtml, /entrypoint:'claim'/);
  assert.doesNotMatch(fountainHtml, /overflowDetail|entrypoint:'overflow'/);
  assert.match(fountainHtml, /legacy V1 address was configured as V2/);
  assert.match(fountainHtml, /codeHash:1760237160/);
  assert.match(fountainHtml, /typeHash:1632638859/);
  assert.match(fountainHtml, /target bytecode does not match the reviewed V2 contract/);
  assert.match(fountainHtml, /not the verified V2 flagship/);
});

test("Mainnet target is either pending or a non-legacy KT1", () => {
  const mainnet = fountainHtml.match(/mainnet:\s*\{[\s\S]*?kt1:'([^']*)'[\s\S]*?legacyKt1:'([^']+)'/);
  assert.ok(mainnet, "Mainnet Fountain config not found");
  const [, target, legacy] = mainnet;
  assert.ok(target === "" || /^KT1[1-9A-HJ-NP-Za-km-z]{33}$/.test(target));
  assert.notEqual(target, legacy);
});

test("receipt binding and public release state cannot silently drift", () => {
  const mainnet = fountainHtml.match(/mainnet:\s*\{[\s\S]*?kt1:'([^']*)'[\s\S]*?legacyKt1:'([^']+)'/);
  const binding = wrangler.match(/"FOUNTAIN":\s*"([^"]+)"/);
  const descriptor = JSON.parse(read("public/fountain.json"));
  assert.ok(mainnet && binding, "release addresses must be explicit");
  const [, target, legacy] = mainnet;
  if (target) {
    assert.equal(binding[1], target);
    assert.equal(descriptor.release.active.generation, "v2");
    assert.equal(descriptor.release.active.contract_address, target);
  } else {
    assert.equal(binding[1], legacy);
    assert.equal(descriptor.release.next.contract_address, null);
  }
});

test("truth-in-copy and public wish disclosure are visible", () => {
  assert.match(fountainHtml, /One wallet receives one equal share/);
  assert.match(fountainHtml, /Closing is manual: the clock alone moves no money/);
  assert.match(fountainHtml, /Public forever: your wish, wallet address, and transaction/);
  assert.match(fountainHtml, /Many-wallet risk/);
  assert.match(fountainHtml, /experimental, unaudited money-moving code/);
  assert.match(fountainHtml, /Someone can use many funded addresses to take many shares/);
});

test("wallet success requires an applied external transaction", () => {
  assert.match(fountainHtml, /operation\?\.target\?\.address===NET\.kt1/);
  assert.match(fountainHtml, /status==='applied'/);
  assert.match(fountainHtml, /\['failed','backtracked','skipped'\]\.includes\(status\)/);
  assert.match(fountainHtml, /no receipt was created/);
  assert.doesNotMatch(fountainHtml, /if\(response\.ok\) return true/);
});

test("legacy fountain printing is disabled in markup and code", () => {
  assert.match(printHtml, /name="kind" value="fountain" disabled/);
  assert.match(printHtml, /if\(kind==='fountain'\) throw new Error\('Fountain V2 printing is not open yet'\)/);
  assert.doesNotMatch(printHtml, /import \{[^}]*buildFountainStorage/);
});

test("static wallet pages ship defensive browser headers", () => {
  const headers = read("public/_headers");
  assert.match(headers, /Content-Security-Policy:/);
  assert.match(headers, /frame-ancestors 'none'/);
  assert.match(headers, /X-Frame-Options: DENY/);
  assert.match(headers, /X-Content-Type-Options: nosniff/);
});

test("Mainnet origination is pinned to the reviewed code and daily rhythm", () => {
  const deploy = read("scripts/deploy-fountain-v2-mainnet.js");
  assert.match(deploy, /APPROVED_MICHELSON_SHA256 = "267f245df855058347965a887594e4d1a9c55a3d5be0f1b15a0da8027a4ea427"/);
  assert.match(deploy, /REVIEWED_CODE_HASH_MISMATCH/);
  assert.match(deploy, /DAILY_EPOCH_SECONDS = 86_400/);
  assert.match(deploy, /MAINNET_EPOCH_MISMATCH/);
});

test("discovery files are real static documents", () => {
  const descriptor = JSON.parse(read("public/fountain.json"));
  assert.equal(descriptor.canonical_url, "https://tez-susu.pages.dev/fountain");
  assert.equal(descriptor.machine_url, "https://tez-susu.pages.dev/fountain.json");
  assert.match(read("public/robots.txt"), /^User-agent: \*/m);
  assert.match(read("public/robots.txt"), /Sitemap: https:\/\/tez-susu\.pages\.dev\/sitemap\.xml/);
  assert.match(read("public/sitemap.xml"), /<loc>https:\/\/tez-susu\.pages\.dev\/fountain<\/loc>/);
  assert.match(read("public/sitemap.xml"), /<loc>https:\/\/tez-susu\.pages\.dev\/wishes<\/loc>/);
  assert.match(read("public/llms.txt"), /^# tez-susu/m);
  assert.match(fountainHtml, /rel="alternate" type="application\/json" href="https:\/\/tez-susu\.pages\.dev\/fountain\.json"/);
  assert.match(fountainHtml, /rel="alternate" type="application\/feed\+json" href="https:\/\/tez-susu\.pages\.dev\/fountain-feed\.json"/);
});

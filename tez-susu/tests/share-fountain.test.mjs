import assert from "node:assert/strict";
import test from "node:test";

import {
  decodeWishBytes,
  escapeHtml,
  fountainAddress,
  parseFountainReceipt,
} from "../src/share-fountain.ts";

const hash = `o${"a".repeat(50)}`;
const fountain = "KT1UTu9vS3aJH3ktyVCF9DimjLKpqXGQkeGW";
const validToss = {
  type: "transaction",
  hash,
  status: "applied",
  amount: 1_000_000,
  target: { address: fountain },
  sender: { address: "tz1XgXN2aTxcwiGvUqMrqU7vuBtRZnGCPcUZ" },
  timestamp: "2026-07-20T12:34:56Z",
  parameter: { entrypoint: "toss", value: "77617465722074686520737175617265" },
};

test("parses one applied external one-tez toss", () => {
  const receipt = parseFountainReceipt([validToss], hash, fountain);
  assert.equal(receipt?.wish, "water the square");
  assert.equal(receipt?.sender, validToss.sender.address);
  assert.equal(parseFountainReceipt([{ ...validToss, nonce: null }], hash, fountain)?.wish, "water the square");
});

test("finds the toss in an overflow plus toss operation group", () => {
  const overflow = {
    ...validToss,
    amount: 0,
    parameter: { entrypoint: "overflow", value: null },
  };
  assert.equal(parseFountainReceipt([overflow, validToss], hash, fountain)?.wish, "water the square");
});

test("rejects failed, internal, wrong-amount, wrong-target, and ambiguous tosses", () => {
  const mutations = [
    { ...validToss, status: "failed" },
    { ...validToss, nonce: 0 },
    { ...validToss, amount: 999_999 },
    { ...validToss, target: { address: "KT19HJaK1hNmc337yv6DM4ZfYyPPQnzj277G" } },
  ];
  for (const transaction of mutations) {
    assert.equal(parseFountainReceipt([transaction], hash, fountain), null);
  }
  assert.equal(parseFountainReceipt([validToss, validToss], hash, fountain), null);
});

test("decodes UTF-8 bytes and marks malformed input unreadable", () => {
  assert.deepEqual(decodeWishBytes("f09f92a7"), { text: "💧", readable: true });
  assert.deepEqual(decodeWishBytes("f0"), { text: "", readable: false });
  assert.deepEqual(decodeWishBytes("xyz"), { text: "", readable: false });
});

test("requires an explicit valid FOUNTAIN binding", () => {
  assert.throws(() => fountainAddress({ FOUNTAIN: "" }), /configured explicitly/);
  assert.equal(fountainAddress({ FOUNTAIN: fountain }), fountain);
  assert.throws(() => fountainAddress({ FOUNTAIN: "not-a-contract" }), /valid KT1/);
});

test("escapes every HTML-significant character", () => {
  assert.equal(escapeHtml(`<wish from="a&b">'water'</wish>`), "&lt;wish from=&quot;a&amp;b&quot;&gt;&#39;water&#39;&lt;/wish&gt;");
});

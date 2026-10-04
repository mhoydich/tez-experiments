import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const original = await readFile(new URL("../src/cast.js", import.meta.url), "utf8");
async function loadCast(hidden = "") {
  const source = original
    .replace('import { hex2str } from "./board.js";', 'const hex2str = (s) => s;')
    .replaceAll("import.meta.env", JSON.stringify({
      VITE_NETWORK: "mainnet",
      VITE_CAST_ADDRESS: "tower",
      VITE_HIDDEN_CASTERS: hidden,
    }));
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}
const row = (id, author, kind = 0) => ({ id, key: String(id), value: { author, kind: String(kind), body: "", cast_at: "now" } });

test("human-only ranking spans pages and excludes anchors on mixed accounts", async (t) => {
  const calls = [];
  const firstPage = [
    ...Array.from({ length: 499 }, (_, i) => row(i, "alice", i % 3)),
    ...Array.from({ length: 499 }, (_, i) => row(i + 499, "bob", i % 3)),
    row(998, "machine", 3),
    row(999, "bob", 3),
  ];
  t.mock.method(globalThis, "fetch", async (url) => {
    calls.push(new URL(url));
    return { ok: true, json: async () => calls.length === 1 ? firstPage : [row(1000, "bob", 2), row(1001, "bob", 1)] };
  });
  const { topCasters } = await loadCast();
  assert.deepEqual(await topCasters(2), [
    { address: "bob", count: 501 },
    { address: "alice", count: 499 },
  ]);
  assert.equal(calls.length, 2);
  assert.ok(calls.every((url) => url.searchParams.get("value.kind.in") === "0,1,2"));
  assert.equal(calls[1].searchParams.get("offset.cr"), "999");
});

test("a later failed page does not display an incomplete leaderboard", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => ({
    ok: ++calls === 1,
    json: async () => Array.from({ length: 1000 }, (_, i) => row(i, "alice")),
  }));
  const { topCasters } = await loadCast();
  assert.deepEqual(await topCasters(), []);
});

test("explicit hidden casters remain excluded", async (t) => {
  t.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => [row(0, "alice"), row(1, "bob"), row(2, "machine", 3)],
  }));
  const { topCasters } = await loadCast(" alice , unused ");
  assert.deepEqual(await topCasters(), [{ address: "bob", count: 1 }]);
});

test("personal and public feed queries request only human kinds", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    calls.push(new URL(url));
    return { ok: true, json: async () => [] };
  });
  const { getCasts } = await loadCast();
  await getCasts();
  await getCasts({ author: "alice" });
  assert.ok(calls.every((url) => url.searchParams.get("value.kind.in") === "0,1,2"));
  assert.equal(calls[1].searchParams.get("value.author"), "alice");
});

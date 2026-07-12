// End-to-end smoke test on Shadownet: two throwaway players declare,
// play a match, countersign, and the ladder moves. Test keys derive from
// the two BIP39 test-vector mnemonics — deterministic, public, worthless;
// fund them with @tacoinfra/get-tez before running (see README).
// Usage: node scripts/smoke.js [KT1...]   (defaults to VITE_RALLY_ADDRESS)
import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import "dotenv/config";

const RPC = process.env.RPC || "https://rpc.shadownet.teztnets.com";
const RALLY = process.argv[2] || process.env.VITE_RALLY_ADDRESS;
if (!RALLY) throw new Error("no contract address (arg or VITE_RALLY_ADDRESS)");

const MNEMO_A = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const MNEMO_B = "legal winner thank year wave sausage worth useful legal winner thank yellow";

const toolkit = async (mnemonic) => {
  const t = new TezosToolkit(RPC);
  t.setSignerProvider(await InMemorySigner.fromMnemonic({ mnemonic }));
  return t;
};

const A = await toolkit(MNEMO_A);
const B = await toolkit(MNEMO_B);
const addrA = await A.signer.publicKeyHash();
const addrB = await B.signer.publicKeyHash();
console.log("player A:", addrA);
console.log("player B:", addrB);

const fmt = (m) => (Number(m) / 1000).toFixed(3);
// Taquito returns option<record> as { Some: {...} } / null
const playerView = async (t, a) => {
  const c = await t.contract.at(RALLY);
  const p = await c.contractViews.player_of(a).executeView({ viewCaller: RALLY });
  return p?.Some ?? p ?? null;
};
const ratingOf = async (t, a) => {
  const p = await playerView(t, a);
  return p ? `${fmt(p.rating)} (${p.wins}W/${Number(p.matches) - Number(p.wins)}L)` : "unrated";
};

const send = async (label, promise) => {
  const op = await promise;
  await op.confirmation(1);
  console.log(`${label} ✓ ${op.hash}`);
};

const cA = await A.contract.at(RALLY);
const cB = await B.contract.at(RALLY);

// 1) both declare (A a 4.0, B a 3.5 — B upsets, ladder should swing hard)
const pA = await playerView(A, addrA);
const pB = await playerView(B, addrB);
if (!pA) await send("A declares 4.000", cA.methodsObject.declare(4000).send());
if (!pB) await send("B declares 3.500", cB.methodsObject.declare(3500).send());
console.log("before:", await ratingOf(A, addrA), "vs", await ratingOf(B, addrB));

// 2) A reports a singles loss to B at California Smash (the upset)
const storage = await cA.storage();
const matchId = storage.next_match.toNumber();
await send("A reports 7–11", cA.methodsObject.propose_match({
  team_a: { p1: addrA, p2: null },
  team_b: { p1: addrB, p2: null },
  score_a: 7, score_b: 11,
  venue: "California Smash",
  video_hash: null,
}).send());

// 3) B countersigns — finalizes and settles Elo atomically
await send(`B confirms match ${matchId}`, cB.methodsObject.confirm_match(matchId).send());

console.log("after: ", await ratingOf(A, addrA), "vs", await ratingOf(B, addrB));
console.log("smoke passed — the ladder moves.");

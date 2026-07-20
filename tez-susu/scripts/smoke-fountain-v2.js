// Fountain V2 Shadownet lifecycle smoke.
//
// Proves lazy first-epoch start, exact coin and wish-size guards, repeat-toss
// weighting, late-toss auto-finalization, manual and empty finalization, two
// simultaneous reserves, out-of-order claims, rejecting-recipient isolation,
// independent payouts, zero-tez and membership guards, double-claim rejection,
// and balance accounting after every successful transition.
//
// Usage: node scripts/smoke-fountain-v2.js KT1...
import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import { stringToBytes } from "@taquito/utils";
import "dotenv/config";

const SHADOWNET_CHAIN_ID = "NetXsqzbfFenSTS";
const RPC = process.env.RPC || "https://rpc.tzkt.io/shadownet";
const KT1 = process.argv[2] || process.env.VITE_FOUNTAIN_V2_ADDRESS;
if (!KT1) throw new Error("contract address required (arg or VITE_FOUNTAIN_V2_ADDRESS)");
if (!process.env.ADMIN_KEY) throw new Error("ADMIN_KEY is required in .env");

// Public, testnet-only deterministic actors. Never use these on Mainnet.
const MNEMO_B =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const MNEMO_C =
  "legal winner thank year wave sausage worth useful legal winner thank yellow";

const toolkit = async (signer) => {
  const instance = new TezosToolkit(RPC);
  instance.setSignerProvider(signer);
  if ((await instance.rpc.getChainId()) !== SHADOWNET_CHAIN_ID) {
    throw new Error(`SHADOWNET_ONLY: ${RPC} is not Shadownet`);
  }
  return instance;
};

const A = await toolkit(await InMemorySigner.fromSecretKey(process.env.ADMIN_KEY));
const B = await toolkit(await InMemorySigner.fromMnemonic({ mnemonic: MNEMO_B }));
const C = await toolkit(await InMemorySigner.fromMnemonic({ mnemonic: MNEMO_C }));
const addrA = await A.signer.publicKeyHash();
const addrB = await B.signer.publicKeyHash();
const addrC = await C.signer.publicKeyHash();

const mutezBalance = async (address) => Number(await A.tz.getBalance(address));
const actorBalances = await Promise.all([addrA, addrB, addrC].map(mutezBalance));
const actorMinimums = [4_300_000, 5_000_000, 5_000_000];
for (const [index, balance] of actorBalances.entries()) {
  if (balance < actorMinimums[index]) {
    throw new Error(
      `TEST_ACTOR_UNFUNDED: ${[addrA, addrB, addrC][index]} has ${balance} mutez; ` +
      `need ${actorMinimums[index] / 1_000_000} tez`,
    );
  }
}

console.log("network: Shadownet", SHADOWNET_CHAIN_ID);
console.log("contract:", KT1);
console.log("A (epoch-0 repeat tosser):", addrA);
console.log("B (late tosser):", addrB);
console.log("C (epoch-1 repeat tosser + manual finalizer):", addrC);

const contract = async (toolkitInstance) => toolkitInstance.contract.at(KT1);
const storage = async () => (await contract(A)).storage();
const settlement = async (epoch) => (await storage()).settlements.get(epoch);
const toss = async (toolkitInstance, wish, amount = 1) => {
  const instance = await contract(toolkitInstance);
  const operation = await instance.methodsObject.toss(stringToBytes(wish)).send({ amount });
  await operation.confirmation(1);
  return operation.hash;
};
const finalize = async (toolkitInstance, amountMutez = 0) => {
  const instance = await contract(toolkitInstance);
  const operation = await instance.methodsObject.finalize().send({ amount: amountMutez, mutez: true });
  await operation.confirmation(1);
  return operation.hash;
};
const claim = async (toolkitInstance, epoch, recipient) => {
  const instance = await contract(toolkitInstance);
  const operation = await instance.methodsObject.claim({ epoch, recipient }).send();
  await operation.confirmation(1);
  return operation.hash;
};
const expectGuard = async (name, work) => {
  try {
    await work();
  } catch (error) {
    if (String(error?.message || error).includes(name)) {
      console.log(name, "guard ✓");
      return;
    }
    throw error;
  }
  throw new Error(`${name} guard did not fire`);
};
const assertInvariant = async (label) => {
  const snapshot = await storage();
  const balance = await mutezBalance(KT1);
  const accounted = Number(snapshot.pot) + Number(snapshot.claim_reserve);
  if (balance !== accounted) {
    throw new Error(`${label}: balance ${balance} != pot + reserve ${accounted}`);
  }
  console.log(`${label}: balance = pot + reserve ✓`);
  return snapshot;
};
const waitForEpochEnd = async (snapshot, label) => {
  const waitMs = Math.max(0, new Date(snapshot.epoch_end).getTime() - Date.now()) + 8_000;
  console.log(`waiting ${Math.ceil(waitMs / 1000)}s for ${label}…`);
  await new Promise((resolve) => setTimeout(resolve, waitMs));
};
const originateRejector = async () => {
  const operation = await A.contract.originate({
    code: "parameter unit; storage unit; code { CDR; PUSH string \"REJECT_TEZ\"; FAILWITH }",
    storage: { prim: "Unit" },
  });
  await operation.confirmation(1);
  return (await operation.contract()).address;
};

let s = await storage();
if (s.started !== false || Number(s.epoch) !== 0 || Number(s.coins) !== 0) {
  throw new Error("smoke requires a freshly deployed, unstarted Fountain V2");
}
const epochLen = Number(s.epoch_len);
if (epochLen < 90 || epochLen > 180) {
  throw new Error(`smoke requires EPOCH_LEN between 90 and 180 seconds; got ${epochLen}`);
}
await assertInvariant("initial state");

await expectGuard("ONE_TEZ_COINS_ONLY", () => toss(A, "wrong coin", 2));
await expectGuard("WISH_TOO_LONG", () => toss(A, "w".repeat(321)));
await expectGuard("SEND_NO_TEZ", () => finalize(C, 1));
await expectGuard("FOUNTAIN_NOT_STARTED", () => finalize(C));
await expectGuard("EPOCH_NOT_FINALIZED", () => claim(A, 0, addrA));

console.log("\nA tosses the first coin and starts a full epoch…");
await toss(A, "for the ladder");
s = await assertInvariant("first toss");
if (s.started !== true) throw new Error("first toss did not start the fountain");
const firstRemaining = new Date(s.epoch_end).getTime() - Date.now();
if (firstRemaining < (epochLen - 20) * 1000) {
  throw new Error(`first epoch was materially shortened: ${Math.floor(firstRemaining / 1000)}s remain`);
}
await expectGuard("NOT_BRIMMING_YET", () => finalize(C));

console.log("A adds 2 more coins; B and C toss 1 each…");
for (const [actor, wish, label] of [
  [A, "for the town", "epoch 0 · A coin 2"],
  [A, "for the drum", "epoch 0 · A coin 3"],
  [B, "for morgan", "epoch 0 · B"],
  [C, "for el segundo", "epoch 0 · C"],
]) {
  await toss(actor, wish);
  await assertInvariant(label);
}
s = await storage();
if (Number(s.pot) !== 5_000_000 || Number(s.tosser_count) !== 3 || Number(s.coins) !== 5) {
  throw new Error("epoch 0 should hold 5 tez from 3 unique wallets");
}

await waitForEpochEnd(s, "epoch 0");
console.log("B makes a late toss; epoch 0 finalizes and epoch 1 opens atomically…");
await toss(B, "for the next day");
s = await assertInvariant("late-toss auto-finalize");
if (Number(s.epoch) !== 1 || Number(s.tosser_count) !== 1 || Number(s.finalized_epochs) !== 1) {
  throw new Error("late toss did not finalize epoch 0 and join epoch 1");
}
const closed0 = await settlement(0);
if (
  !closed0
  || Number(closed0.total) !== 5_000_000
  || Number(closed0.share) !== 1_666_666
  || Number(closed0.dust) !== 2
  || Number(closed0.unclaimed) !== 3
) throw new Error("epoch 0 settlement arithmetic is wrong");
if (Number(s.pot) !== 1_000_002 || Number(s.claim_reserve) !== 4_999_998) {
  throw new Error("epoch 0 dust carry or reserve is wrong");
}
console.log("epoch 0: O(1) settlement · 1.666666 tez/share · 2 mutez carried ✓");

await expectGuard("RECIPIENT_NOT_PAYABLE", () => claim(A, 0, KT1));
await assertInvariant("invalid-recipient rollback");

const rejector = await originateRejector();
console.log("rejecting unit contract:", rejector);
await expectGuard("REJECT_TEZ", () => claim(A, 0, rejector));
if (Number((await settlement(0)).unclaimed) !== 3) {
  throw new Error("rejecting payout consumed a claim");
}
await assertInvariant("rejecting-contract rollback");

await claim(B, 0, addrB);
await assertInvariant("B claims epoch 0");

console.log("\nC adds 2 epoch-1 coins; A adds 1…");
for (const [actor, wish, label] of [
  [C, "a second-day gift", "epoch 1 · C coin 1"],
  [C, "water for everyone", "epoch 1 · C coin 2"],
  [A, "close the day by hand", "epoch 1 · A"],
]) {
  await toss(actor, wish);
  await assertInvariant(label);
}
s = await storage();
if (Number(s.pot) !== 4_000_002 || Number(s.tosser_count) !== 3) {
  throw new Error("epoch 1 should hold 4.000002 tez across 3 wallets");
}

await waitForEpochEnd(s, "epoch 1");
await finalize(C);
s = await assertInvariant("manual finalize epoch 1");
if (Number(s.epoch) !== 2 || Number(s.finalized_epochs) !== 2 || Number(s.paying_epochs) !== 2) {
  throw new Error("manual finalization counters are wrong");
}
const closed1 = await settlement(1);
if (
  !closed1
  || Number(closed1.total) !== 4_000_002
  || Number(closed1.share) !== 1_333_334
  || Number(closed1.dust) !== 0
  || Number(closed1.unclaimed) !== 3
) throw new Error("epoch 1 settlement arithmetic is wrong");
if (Number(s.claim_reserve) !== 7_333_334 || Number(s.pot) !== 0) {
  throw new Error("two simultaneous settlement reserves are wrong");
}
console.log("two finalized epochs coexist without blocking the fresh basin ✓");

console.log("\nclaiming epoch 1 before older epoch 0…");
for (const [actor, epoch, recipient, label] of [
  [C, 1, addrC, "C claims newer epoch 1"],
  [C, 0, addrC, "C claims older epoch 0"],
  [A, 1, addrA, "A claims epoch 1"],
  [B, 1, addrB, "B claims epoch 1"],
  [A, 0, addrA, "A claims epoch 0"],
]) {
  await claim(actor, epoch, recipient);
  await assertInvariant(label);
}
await expectGuard("ALREADY_CLAIMED", () => claim(B, 0, addrB));
s = await storage();
if (Number(s.claim_reserve) !== 0 || Number(s.claims) !== 6 || Number(s.paid) !== 9_000_000) {
  throw new Error("all epoch 0 and epoch 1 claims should be paid exactly");
}

await waitForEpochEnd(s, "empty epoch 2");
await finalize(A);
s = await assertInvariant("empty epoch finalize");
const empty = await settlement(2);
if (
  !empty
  || Number(empty.total) !== 0
  || Number(empty.member_count) !== 0
  || Number(empty.unclaimed) !== 0
  || Number(s.finalized_epochs) !== 3
  || Number(s.paying_epochs) !== 2
) throw new Error("empty finalization should advance time without creating claims");
await expectGuard("NOT_A_TOSSER", () => claim(A, 2, addrA));

console.log(
  "\n✅ SMOKE PASS — three epoch boundaries, two live reserves, rejecting recipients, and every accounting transition hold.",
);

// Fountain smoke on Shadownet (deploy with EPOCH_LEN=60 first).
// A tosses 3 coins (the whale), B and C toss 1 each; after the epoch ends
// C tips the fountain: 5ꜩ splits 3 ways (1.666666ꜩ each), 2μꜩ dust to C.
// Asserts the guards too: wrong amount, early overflow, toss-after-end.
// Usage: node scripts/smoke-fountain.js [KT1...] (defaults VITE_FOUNTAIN_ADDRESS)
import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import { stringToBytes } from "@taquito/utils";
import "dotenv/config";

const RPC = process.env.RPC || "https://rpc.shadownet.teztnets.com";
const KT1 = process.argv[2] || process.env.VITE_FOUNTAIN_ADDRESS;
if (!KT1) throw new Error("no contract address (arg or VITE_FOUNTAIN_ADDRESS)");

const MNEMO_B = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const MNEMO_C = "legal winner thank year wave sausage worth useful legal winner thank yellow";

const A = new TezosToolkit(RPC);
A.setSignerProvider(await InMemorySigner.fromSecretKey(process.env.ADMIN_KEY));
const B = new TezosToolkit(RPC);
B.setSignerProvider(await InMemorySigner.fromMnemonic({ mnemonic: MNEMO_B }));
const C = new TezosToolkit(RPC);
C.setSignerProvider(await InMemorySigner.fromMnemonic({ mnemonic: MNEMO_C }));
const addrA = await A.signer.publicKeyHash();
const addrB = await B.signer.publicKeyHash();
const addrC = await C.signer.publicKeyHash();
console.log("A (whale):", addrA, "\nB:", addrB, "\nC (tipper):", addrC);

const balance = async (a) => Number(await A.tz.getBalance(a)) / 1e6;
const rollIfDue = async () => {
  // make the smoke re-runnable: if the current epoch already lapsed,
  // tip the fountain once so we start from a fresh, full-length epoch
  const s0 = await storage();
  if (Date.now() >= new Date(s0.epoch_end).getTime()) {
    console.log("epoch already lapsed — rolling it first…");
    const c0 = await A.contract.at(KT1);
    const op0 = await c0.methodsObject.overflow().send();
    await op0.confirmation(1);
  }
};
const toss = async (t, wish, amount = 1) => {
  const c = await t.contract.at(KT1);
  const op = await c.methodsObject.toss(stringToBytes(wish)).send({ amount });
  await op.confirmation(1);
  return op.hash;
};
const storage = async () => (await A.contract.at(KT1)).storage();

await rollIfDue();

// guard: wrong coin size
let ok = false;
try { await toss(A, "too big", 2); } catch (e) { ok = /ONE_TEZ_COINS_ONLY/.test(String(e?.message || e)); }
if (!ok) throw new Error("coin-size guard did not fire");
console.log("ONE_TEZ_COINS_ONLY guard ✓");

// guard: overflow before the epoch is done
ok = false;
try {
  const c = await C.contract.at(KT1);
  const op = await c.methodsObject.overflow().send();
  await op.confirmation(1);
} catch (e) { ok = /NOT_BRIMMING_YET/.test(String(e?.message || e)); }
if (!ok) throw new Error("early-overflow guard did not fire");
console.log("NOT_BRIMMING_YET guard ✓");

const before = { A: await balance(addrA), B: await balance(addrB), C: await balance(addrC) };
console.log("\nA tosses 3 coins, B tosses 1, C tosses 1…");
await toss(A, "for the ladder");
await toss(A, "for the town");
await toss(A, "for the drum");
await toss(B, "for morgan");
await toss(C, "for el segundo");
let s = await storage();
if (Number(s.tosser_count) !== 3) throw new Error("expected 3 tossers");
console.log(`pot: ${Number(s.pot) / 1e6}ꜩ · tossers: ${s.tosser_count}`);

console.log("waiting out the epoch…");
const endAt = new Date(s.epoch_end).getTime();
await new Promise((r) => setTimeout(r, Math.max(0, endAt - Date.now()) + 12000));

// guard: toss after the epoch is done
ok = false;
try { await toss(B, "too late"); } catch (e) { ok = /TIP_THE_FOUNTAIN/.test(String(e?.message || e)); }
if (!ok) throw new Error("toss-after-end guard did not fire");
console.log("TIP_THE_FOUNTAIN guard ✓");

console.log("C tips the fountain…");
const c = await C.contract.at(KT1);
const op = await c.methodsObject.overflow().send();
await op.confirmation(1);

const after = { A: await balance(addrA), B: await balance(addrB), C: await balance(addrC) };
const dA = after.A - before.A, dB = after.B - before.B, dC = after.C - before.C;
console.log(`A (tossed 3, got 1.667): ${dA.toFixed(3)}ꜩ`);
console.log(`B (tossed 1, got 1.667): ${dB.toFixed(3)}ꜩ`);
console.log(`C (tossed 1, got 1.667 + dust): ${dC.toFixed(3)}ꜩ`);
if (!(dA < -1.3 && dA > -1.4)) throw new Error("whale delta off");
if (!(dB > 0.6 && dB < 0.7)) throw new Error("B delta off");
if (!(dC > 0.6 && dC < 0.7)) throw new Error("C delta off");

s = await storage();
if (Number(s.pot) !== 0 || Number(s.tosser_count) !== 0) throw new Error("epoch did not reset");
if (Number(s.overflows) !== 1) throw new Error("overflow counter off");
const kt1Bal = await balance(KT1);
if (kt1Bal !== 0) throw new Error("fountain should hold 0ꜩ, holds " + kt1Bal);

console.log("\n✅ SMOKE PASS — the fountain splits fair, the guards hold, the basin drains dry.");

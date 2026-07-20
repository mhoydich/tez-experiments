// End-to-end smoke on Shadownet: finish a two-seat circle, then prove that
// made-whole claims are member-only, completion-gated, and soulbound.
// Organizer = the deploy key; B and C derive from public BIP39 test vectors.
// Usage: node scripts/smoke-stamps.js [KT1...] (defaults to VITE_STAMPS_ADDRESS)
import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import { stringToBytes } from "@taquito/utils";
import "dotenv/config";

const RPC = process.env.RPC || "https://rpc.shadownet.teztnets.com";
const HOUSE = process.env.HOUSE || "KT1QkXi31V5Fv91y7EEu68iNXuY1dRGp5VgM";
const STAMPS = process.argv[2] || process.env.VITE_STAMPS_ADDRESS;
if (!STAMPS) throw new Error("no stamps address (arg or VITE_STAMPS_ADDRESS)");

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
console.log("rpc:", RPC, "\nhouse:", HOUSE, "\nstamps:", STAMPS);
console.log("A (organizer):", addrA, "\nB:", addrB, "\nC:", addrC);

const tez = (n) => Math.round(n * 1e6); // mutez
const CONTRIB = 0.5;

const balance = async (a) => Number(await A.tz.getBalance(a)) / 1e6;
const send = async (t, address, method, args, amountTez = 0) => {
  const c = await t.contract.at(address);
  const op = await c.methodsObject[method](args).send({ amount: amountTez });
  await op.confirmation(1);
  return op.hash;
};
const claim = (t, id) => send(t, STAMPS, "default", id);
const errorText = (e) => [
  e?.message,
  e?.description,
  JSON.stringify(e?.errors || e?.data || ""),
].filter(Boolean).join(" ");
const expectFailure = async (label, expected, fn) => {
  try {
    await fn();
  } catch (e) {
    const text = errorText(e);
    if (text.includes(expected)) {
      console.log(`✅ ${label} — ${expected}`);
      return;
    }
    throw new Error(`${label}: expected ${expected}, got ${text}`);
  }
  throw new Error(`${label}: expected ${expected}, but the call succeeded`);
};

// Fund and reveal the public throwaways when needed.
for (const [t, addr] of [[B, addrB], [C, addrC]]) {
  if ((await balance(addr)) < 2.5) {
    console.log(`funding ${addr} with 3ꜩ from deploy key…`);
    const op = await A.contract.transfer({ to: addr, amount: 3 });
    await op.confirmation(1);
  }
  try {
    if (!(await t.rpc.getManagerKey(addr))) {
      const r = await t.contract.reveal({});
      await r.confirmation(1);
      console.log(`revealed ${addr}`);
    }
  } catch (e) {
    console.log("reveal skipped:", e?.message || e);
  }
}

const house = await A.contract.at(HOUSE);
const doneId = Number((await house.storage()).next_id);
console.log(`\nA opens completed-test circle #${doneId} (2 seats, ${CONTRIB}ꜩ/round)…`);
await send(A, HOUSE, "open_circle", {
  name: stringToBytes("made-whole smoke circle"),
  contribution: tez(CONTRIB),
  seats: 2,
  grace: 3600,
});
await send(B, HOUSE, "join", doneId);
for (const round of [1, 2]) {
  console.log(`round ${round}: A and B contribute…`);
  await send(A, HOUSE, "contribute", doneId, CONTRIB);
  await send(B, HOUSE, "contribute", doneId, CONTRIB);
}
const doneCircle = await house.contractViews.read_circle(doneId).executeView({ viewCaller: HOUSE });
const circle = doneCircle?.Some ?? doneCircle;
const status = Object.keys(circle.status)[0];
if (status !== "done") throw new Error(`setup circle should be done, is ${status}`);
console.log(`circle #${doneId} is done.`);

const openId = Number((await house.storage()).next_id);
console.log(`A opens recruiting-test circle #${openId}…`);
await send(A, HOUSE, "open_circle", {
  name: stringToBytes("not done yet"),
  contribution: tez(CONTRIB),
  seats: 2,
  grace: 3600,
});

await expectFailure("1/6 non-member claim rejected", "NOT_A_MEMBER", () => claim(C, doneId));
await expectFailure("2/6 unfinished-circle claim rejected", "CIRCLE_NOT_DONE", () => claim(A, openId));

await claim(A, doneId);
const stamps = await A.contract.at(STAMPS);
const madeWholeA = await stamps.contractViews.made_whole(addrA).executeView({ viewCaller: STAMPS });
if (Number(madeWholeA) !== 1) throw new Error(`made_whole(A) should be 1, is ${madeWholeA}`);
console.log("✅ 3/6 A claim succeeded — made_whole(A) == 1");

await expectFailure("4/6 duplicate claim rejected", "ALREADY_STAMPED", () => claim(A, doneId));

await claim(B, doneId);
const stampStorage = await stamps.storage();
if (Number(stampStorage.stamps) !== 2 || Number(stampStorage.finishers) !== 2) {
  throw new Error(
    `town totals should be stamps=2, finishers=2; got stamps=${stampStorage.stamps}, finishers=${stampStorage.finishers}`,
  );
}
console.log("✅ 5/6 B claim succeeded — stamps == 2, finishers == 2");

await expectFailure("6/6 missing-circle claim rejected", "NO_SUCH_CIRCLE", () => claim(A, 9999));

console.log("\n✅ SMOKE PASS — all six made-whole assertions passed.");

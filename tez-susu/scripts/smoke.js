// End-to-end smoke on Shadownet: a full three-seat circle plus the disband
// valve. Organizer = the deploy key; members B and C derive from the BIP39
// test-vector mnemonics (deterministic, public, worthless) and are funded
// from the deploy key inside this script.
// (Does NOT exercise the Beacon/Kukai browser path — verify that in-page.)
// Usage: node scripts/smoke.js [KT1...]   (defaults to VITE_SUSU_ADDRESS)
import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import { stringToBytes } from "@taquito/utils";
import "dotenv/config";

const RPC = process.env.RPC || "https://rpc.shadownet.teztnets.com";
const KT1 = process.argv[2] || process.env.VITE_SUSU_ADDRESS;
if (!KT1) throw new Error("no contract address (arg or VITE_SUSU_ADDRESS)");

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
console.log("A (organizer):", addrA, "\nB:", addrB, "\nC:", addrC);

const tez = (n) => Math.round(n * 1e6); // mutez
const CONTRIB = 0.5;

const balance = async (a) => Number(await A.tz.getBalance(a)) / 1e6;
const send = async (t, method, args, amountTez = 0) => {
  const c = await t.contract.at(KT1);
  const op = await c.methodsObject[method](args).send({ amount: amountTez });
  await op.confirmation(1);
  return op.hash;
};
const readCircle = async (id) => {
  const c = await A.contract.at(KT1);
  const r = await c.contractViews.read_circle(id).executeView({ viewCaller: KT1 });
  return r?.Some ?? r ?? null;
};
const statusOf = (circle) => Object.keys(circle.status)[0]; // { active: {} } etc.

// ---- fund + reveal the throwaways (idempotent-ish; skips if flush) ----
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
  } catch (e) { console.log("reveal skipped:", e?.message || e); }
}

// ---- open a 3-seat circle ----
const house = await A.contract.at(KT1);
const id = Number((await house.storage()).next_id);
console.log(`\nA opens circle #${id} (3 seats, ${CONTRIB}ꜩ/round)…`);
await send(A, "open_circle", {
  name: stringToBytes("smoke circle — el segundo test kitchen"),
  contribution: tez(CONTRIB),
  seats: 3,
  grace: 3600,
});
console.log("B joins…"); await send(B, "join", id);
console.log("C joins…"); await send(C, "join", id);
let circ = await readCircle(id);
if (statusOf(circ) !== "active") throw new Error("circle should be active, is " + statusOf(circ));
console.log("circle active. seat order: A, B, C");

// ---- guard: pay twice in one round must fail ----
const before = { A: await balance(addrA), B: await balance(addrB), C: await balance(addrC) };
console.log("\nround 1: everyone pays in — B tries to pay twice (must fail)…");
await send(B, "contribute", id, CONTRIB);
let guardOk = false;
try { await send(B, "contribute", id, CONTRIB); }
catch (e) { guardOk = /ALREADY_PAID/.test(String(e?.message || e)); }
if (!guardOk) throw new Error("double-pay guard did not fire");
console.log("ALREADY_PAID guard ✓");

// ---- three full rounds ----
await send(C, "contribute", id, CONTRIB);
await send(A, "contribute", id, CONTRIB); // settles round 1 -> pot to A
for (const round of [2, 3]) {
  console.log(`round ${round}: everyone pays in…`);
  await send(A, "contribute", id, CONTRIB);
  await send(B, "contribute", id, CONTRIB);
  await send(C, "contribute", id, CONTRIB); // settles -> pot to B, then C
}
circ = await readCircle(id);
console.log("status:", statusOf(circ), "· round:", Number(circ.round), "· pot:", Number(circ.pot));
if (statusOf(circ) !== "done") throw new Error("circle should be done");

const after = { A: await balance(addrA), B: await balance(addrB), C: await balance(addrC) };
for (const k of ["A", "B", "C"]) {
  const delta = after[k] - before[k];
  console.log(`${k} net over the cycle: ${delta.toFixed(3)}ꜩ (fees only)`);
  if (Math.abs(delta) > 0.05) throw new Error(`${k} net should be ~0, was ${delta}`);
}

// ---- the disband valve on a second circle ----
console.log("\ndisband valve: A opens a 2-seat circle, B joins, A pays, A disbands…");
const id2 = id + 1;
await send(A, "open_circle", {
  name: stringToBytes("doomed circle"),
  contribution: tez(CONTRIB),
  seats: 2,
  grace: 3600,
});
await send(B, "join", id2);
await send(A, "contribute", id2, CONTRIB);
const aBefore = await balance(addrA);
await send(A, "disband", id2);
const aAfter = await balance(addrA);
const circ2 = await readCircle(id2);
if (statusOf(circ2) !== "disbanded") throw new Error("circle 2 should be disbanded");
if (aAfter - aBefore < CONTRIB - 0.05) throw new Error("disband refund missing");
console.log(`disband refunded A ${(aAfter - aBefore).toFixed(3)}ꜩ ✓`);

const kt1Bal = await balance(KT1);
console.log("\ncontract balance after everything:", kt1Bal, "ꜩ");
if (kt1Bal !== 0) throw new Error("contract should hold 0ꜩ");

console.log("\n✅ SMOKE PASS — the circle turns, the valve works, the house holds nothing.");

// End-to-end smoke on Shadownet: two members join and fill, every guard
// fires, the council draws with a memo, the views read true.
// Council = the deploy key; members B and C derive from the BIP39
// test-vector mnemonics (deterministic, public, worthless) and are funded
// from the deploy key inside this script.
// (Does NOT exercise the Beacon/Kukai browser path — verify that in-page.)
// Usage: node scripts/smoke.js [KT1...]   (defaults to VITE_RESERVOIR_ADDRESS)
import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import { stringToBytes } from "@taquito/utils";
import "dotenv/config";

const RPC = process.env.RPC || "https://rpc.tzkt.io/shadownet";
const KT1 = process.argv[2] || process.env.VITE_RESERVOIR_ADDRESS;
if (!KT1) throw new Error("no contract address (arg or VITE_RESERVOIR_ADDRESS)");

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
console.log("A (council):", addrA, "\nB:", addrB, "\nC:", addrC);

const balance = async (a) => Number(await A.tz.getBalance(a)) / 1e6;
const send = async (t, method, args, amountTez = 0) => {
  const c = await t.contract.at(KT1);
  const op = await c.methodsObject[method](args).send({ amount: amountTez });
  await op.confirmation(1);
  return op.hash;
};
const mustFail = async (label, re, fn) => {
  let ok = false;
  try { await fn(); } catch (e) { ok = re.test(String(e?.message || e)); }
  if (!ok) throw new Error(`${label} guard did not fire`);
  console.log(`${label} guard ✓`);
};
const level = async () => {
  const c = await A.contract.at(KT1);
  return await c.contractViews.reservoir().executeView({ viewCaller: KT1 });
};
const readMember = async (a) => {
  const c = await A.contract.at(KT1);
  const r = await c.contractViews.read_member(a).executeView({ viewCaller: KT1 });
  return r?.Some ?? r ?? null;
};

// ---- fund + reveal the throwaways (idempotent-ish; skips if flush) ----
for (const [t, addr] of [[B, addrB], [C, addrC]]) {
  if ((await balance(addr)) < 3) {
    console.log(`funding ${addr} with 4ꜩ from deploy key…`);
    const op = await A.contract.transfer({ to: addr, amount: 4 });
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

const memo = (s) => stringToBytes(s);
const before = await level();
const seats0 = Number(before.seats);
console.log(`\nreservoir before: seats=${seats0} pooled=${Number(before.pooled) / 1e6}ꜩ`);

// ---- joins + guards ----
console.log("\nB takes a seat (1ꜩ)…");
await send(B, "join", memo("smoke: first seat — el segundo test kitchen"), 1);
await mustFail("ALREADY_A_MEMBER", /ALREADY_A_MEMBER/, () =>
  send(B, "join", memo("smoke: double join"), 1));
await mustFail("BELOW_DUES", /BELOW_DUES/, () =>
  send(C, "join", memo("smoke: cheap join"), 0.25));
console.log("C takes a seat (1ꜩ)…");
await send(C, "join", memo("smoke: second seat"), 1);

// ---- fills + guards ----
await mustFail("NOT_A_MEMBER", /NOT_A_MEMBER/, () =>
  send(A, "fill", memo("smoke: council is not a member"), 0.5));
console.log("B pours a fill (0.7ꜩ)…");
await send(B, "fill", memo("smoke: monthly pour"), 0.7);
const mB = await readMember(addrB);
if (Number(mB.fills) !== 2) throw new Error("B should have 2 fills, has " + Number(mB.fills));
console.log(`B on the roll: seat ${Number(mB.seat)}, filled ${Number(mB.filled) / 1e6}ꜩ over ${Number(mB.fills)} fills ✓`);

// ---- draw + guards ----
await mustFail("NOT_COUNCIL", /NOT_COUNCIL/, () =>
  send(C, "draw", { to_: addrC, amount: 1_000_000, memo: memo("smoke: heist") }));
const aBefore = await balance(addrA);
console.log("council draws 1.5ꜩ (pretend api-credit buy)…");
await send(A, "draw", { to_: addrA, amount: 1_500_000, memo: memo("smoke: openrouter credits, july") });
const aAfter = await balance(addrA);
if (aAfter - aBefore < 1.4) throw new Error("draw did not arrive");
console.log(`draw arrived: +${(aAfter - aBefore).toFixed(3)}ꜩ to council target ✓`);

// ---- empty pour guard ----
await mustFail("EMPTY_POUR", /EMPTY_POUR/, () =>
  send(B, "fill", memo("smoke: empty pour"), 0));

// ---- dues knob ----
console.log("council raises dues to 2ꜩ, checks the view, sets it back…");
await send(A, "set_dues", 2_000_000);
const mid = await level();
if (Number(mid.dues) !== 2_000_000) throw new Error("dues should read 2ꜩ, reads " + Number(mid.dues));
console.log("dues knob turns ✓");
await send(A, "set_dues", 1_000_000);

// ---- the books ----
const after = await level();
const pooledDelta = (Number(after.pooled) - Number(before.pooled)) / 1e6;
const drawnDelta = Number(after.drawn) / 1e6;
console.log(`\nthe books: seats=${Number(after.seats)} (+${Number(after.seats) - seats0})`,
  `pooled +${pooledDelta}ꜩ · drawn ${drawnDelta}ꜩ (${Number(after.draws)} draws) · held ${Number(after.held) / 1e6}ꜩ`);
if (Number(after.seats) - seats0 !== 2) throw new Error("should have added exactly 2 seats");
if (Math.abs(pooledDelta - 2.7) > 0.001) throw new Error("pooled should be +2.7ꜩ");

console.log("\n✅ SMOKE PASS — seats are soulbound, the pool fills, the council draws, the books are open.");

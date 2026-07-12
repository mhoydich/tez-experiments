// Shadownet end-to-end for the passport book: originate fresh, add a test
// court, oracle-sign a voucher for smoke player A, stamp, verify the page,
// prove the daily rate limit. Reuses smoke.js's throwaway player A —
// fund it first (see README).
import { TezosToolkit, MichelsonMap } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import { packDataBytes } from "@taquito/michel-codec";
import { readFileSync } from "node:fs";
import "dotenv/config";

const RPC = process.env.RPC || "https://rpc.shadownet.teztnets.com";
const MNEMO_A = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

const adminT = new TezosToolkit(RPC);
adminT.setSignerProvider(await InMemorySigner.fromSecretKey(process.env.ADMIN_KEY));
const oracleSigner = await InMemorySigner.fromSecretKey(process.env.ORACLE_KEY);
const playerT = new TezosToolkit(RPC);
playerT.setSignerProvider(await InMemorySigner.fromMnemonic({ mnemonic: MNEMO_A }));
const player = await playerT.signer.publicKeyHash();

// originate
const code = readFileSync("contracts/courts.tz", "utf8");
const orig = await adminT.contract.originate({
  code,
  storage: {
    admin: await adminT.signer.publicKeyHash(),
    oracle: await oracleSigner.publicKey(),
    next_venue: 0, venues: new MichelsonMap(),
    book: new MichelsonMap(), metadata: new MichelsonMap(),
  },
});
const book = await orig.contract();
console.log("book:", book.address);

// add a test court
const add = await book.methodsObject.add_venue({
  name: "Test Court", lat_e6: 33920934, lon_e6: -118411794, radius_m: 200,
}).send();
await add.confirmation(1);
console.log("venue 0 added ✓");

// oracle voucher: pack([player, venue, unix_day, contract]) — right-comb pair
const day = Math.floor(Date.now() / 86_400_000);
const voucher = async () => {
  const data = packDataBytes(
    { prim: "Pair", args: [{ string: player }, { prim: "Pair", args: [
      { int: "0" }, { prim: "Pair", args: [{ int: String(day) }, { string: book.address }] },
    ] }] },
    { prim: "pair", args: [{ prim: "address" }, { prim: "pair", args: [
      { prim: "nat" }, { prim: "pair", args: [{ prim: "nat" }, { prim: "address" }] },
    ] }] }
  );
  return (await oracleSigner.sign(data.bytes)).prefixSig;
};

const pBook = await playerT.contract.at(book.address);
const st = await pBook.methodsObject.stamp({ venue: 0, sig: await voucher() }).send();
await st.confirmation(1);
console.log("stamped ✓", st.hash);

const pg = await pBook.contractViews.page_of([player, 0]).executeView({ viewCaller: book.address });
const page = pg?.Some ?? pg;
console.log("page:", `count=${page.count} first_at=${page.first_at}`);

try {
  const again = await pBook.methodsObject.stamp({ venue: 0, sig: await voucher() }).send();
  await again.confirmation(1);
  console.log("UNEXPECTED: double-stamp went through — rate limit broken");
  process.exit(1);
} catch (e) {
  const msg = String(e?.message || e);
  console.log(msg.includes("STAMPED_TODAY")
    ? "double-stamp rejected (STAMPED_TODAY) ✓"
    : `double-stamp rejected with unexpected error: ${msg.slice(0, 120)}`);
}
console.log("passport smoke passed.");

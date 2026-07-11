// Issuer side of the signed-voucher flow:
// node scripts/sign-claim.js <claimer_address> <token_id> <registry_address>
// Prints a signature the claimer submits to claim_signed. This is what your
// verifier backend runs after confirming the task was actually done.
import { InMemorySigner } from "@taquito/signer";
import { packDataBytes } from "@taquito/michel-codec";
import "dotenv/config";

const [claimer, id, registry] = process.argv.slice(2);
const signer = await InMemorySigner.fromSecretKey(process.env.ISSUER_KEY || process.env.ADMIN_KEY);

const data = packDataBytes(
  { prim: "Pair", args: [{ string: claimer }, { prim: "Pair", args: [{ int: id }, { string: registry }] }] },
  { prim: "pair", args: [{ prim: "address" }, { prim: "pair", args: [{ prim: "nat" }, { prim: "address" }] }] }
);
const { prefixSig } = await signer.sign(data.bytes);
console.log(JSON.stringify({ claimer, id: Number(id), sig: prefixSig }));

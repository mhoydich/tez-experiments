// node scripts/add-stamp-type.js "Name" "Description" open|issuer|signed [issuer_pk]
import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import { char2Bytes } from "@taquito/utils";
import "dotenv/config";

const [name, description, gateKind = "open", issuerPk] = process.argv.slice(2);
const Tezos = new TezosToolkit(process.env.RPC || "https://ghostnet.tezos.ecadinfra.com");
Tezos.setSignerProvider(await InMemorySigner.fromSecretKey(process.env.ADMIN_KEY));
const admin = await Tezos.signer.publicKeyHash();

const gate =
  gateKind === "open" ? { open: null }
  : gateKind === "issuer" ? { issuer: null }
  : { signed: issuerPk || (await Tezos.signer.publicKey()) };

const c = await Tezos.contract.at(process.env.VITE_REGISTRY_ADDRESS);
const op = await c.methodsObject.add_stamp_type({
  metadata: new Map([
    ["name", char2Bytes(name)],
    ["description", char2Bytes(description || "")],
    ["decimals", char2Bytes("0")],
  ]),
  issuer: admin,
  gate,
}).send();
await op.confirmation(1);
console.log(`Stamp type "${name}" added (${gateKind}):`, op.hash);

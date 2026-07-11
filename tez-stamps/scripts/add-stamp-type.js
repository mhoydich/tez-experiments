// node scripts/add-stamp-type.js "Name" "Description" open|issuer|signed [issuer_pk] [--image art/foo.webp]
// --image inlines the file as a data-URI thumbnailUri (keep it small, ~10-15KB).
import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import { char2Bytes } from "@taquito/utils";
import { readFileSync } from "node:fs";
import "dotenv/config";

const argv = process.argv.slice(2);
const imgIdx = argv.indexOf("--image");
const imagePath = imgIdx === -1 ? null : argv.splice(imgIdx, 2)[1];
const [name, description, gateKind = "open", issuerPk] = argv;
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
    ...(imagePath ? [["thumbnailUri", char2Bytes(
      `data:image/webp;base64,${readFileSync(imagePath).toString("base64")}`
    )]] : []),
  ]),
  issuer: admin,
  gate,
}).send();
await op.confirmation(1);
console.log(`Stamp type "${name}" added (${gateKind}):`, op.hash);

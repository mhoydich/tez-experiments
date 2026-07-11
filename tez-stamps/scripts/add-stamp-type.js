// node scripts/add-stamp-type.js "Name" "Description" open|issuer|signed [issuer_pk] [--image art/foo.webp]
// --image inlines the file as a data-URI thumbnailUri (keep it small, ~10-15KB).
import { TezosToolkit, MichelsonMap } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import taquitoUtils from "@taquito/utils";
const { stringToBytes } = taquitoUtils;
import { readFileSync } from "node:fs";
import "dotenv/config";

const argv = process.argv.slice(2);
const imgIdx = argv.indexOf("--image");
const imagePath = imgIdx === -1 ? null : argv.splice(imgIdx, 2)[1];
const [name, description, gateKind = "open", issuerPk] = argv;
const Tezos = new TezosToolkit(process.env.RPC || "https://rpc.shadownet.teztnets.com");
Tezos.setSignerProvider(await InMemorySigner.fromSecretKey(process.env.ADMIN_KEY));
const admin = await Tezos.signer.publicKeyHash();

const gate =
  gateKind === "open" ? { open: null }
  : gateKind === "issuer" ? { issuer: null }
  : { signed: issuerPk || (await Tezos.signer.publicKey()) };

const c = await Tezos.contract.at(process.env.VITE_REGISTRY_ADDRESS);
const op = await c.methodsObject.add_stamp_type({
  metadata: MichelsonMap.fromLiteral(Object.fromEntries([
    ["name", stringToBytes(name)],
    ["description", stringToBytes(description || "")],
    ["decimals", stringToBytes("0")],
    ...(imagePath ? [["thumbnailUri", stringToBytes(
      `data:image/webp;base64,${readFileSync(imagePath).toString("base64")}`
    )]] : []),
  ])),
  issuer: admin,
  gate,
}).send();
await op.confirmation(1);
console.log(`Stamp type "${name}" added (${gateKind}):`, op.hash);

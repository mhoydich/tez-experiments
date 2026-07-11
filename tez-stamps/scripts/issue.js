// Issuer-mints a stamp directly: node scripts/issue.js <address> <token_id>
import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import "dotenv/config";

const [to_, id] = process.argv.slice(2);
const Tezos = new TezosToolkit(process.env.RPC || "https://rpc.shadownet.teztnets.com");
Tezos.setSignerProvider(await InMemorySigner.fromSecretKey(process.env.ISSUER_KEY || process.env.ADMIN_KEY));

const c = await Tezos.contract.at(process.env.VITE_REGISTRY_ADDRESS);
const op = await c.methodsObject.issue({ to_, id: Number(id) }).send();
await op.confirmation(1);
console.log(`Issued stamp ${id} to ${to_}:`, op.hash);

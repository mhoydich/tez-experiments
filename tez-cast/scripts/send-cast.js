// Publish a cast from the CLI (admin key): node scripts/send-cast.js "hello sand"
import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import "dotenv/config";

const body = process.argv[2];
const kind = Number(process.argv[3] || 0);
if (!body) { console.error('usage: node scripts/send-cast.js "text" [kind]'); process.exit(1); }

const Tezos = new TezosToolkit(process.env.RPC || "https://rpc.shadownet.teztnets.com");
Tezos.setSignerProvider(await InMemorySigner.fromSecretKey(process.env.ADMIN_KEY));

const hex = Array.from(new TextEncoder().encode(body))
  .map((b) => b.toString(16).padStart(2, "0")).join("");

const c = await Tezos.contract.at(process.env.VITE_CAST_ADDRESS);
const op = await c.methodsObject.default({ kind, body: hex }).send();
console.log("Casting…", op.hash);
await op.confirmation(1);
console.log("Cast published.");

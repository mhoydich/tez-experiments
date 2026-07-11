// node scripts/mint.js personal|auction
import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import "dotenv/config";

const kind = process.argv[2] || "personal";
const Tezos = new TezosToolkit(process.env.RPC || "https://ghostnet.tezos.ecadinfra.com");
Tezos.setSignerProvider(await InMemorySigner.fromSecretKey(process.env.USER_KEY || process.env.ADMIN_KEY));
const c = await Tezos.contract.at(process.env.NOUNS_ADDRESS);
const op = await c.methodsObject.mint(kind === "personal" ? { personal: null } : { auction: null }).send();
await op.confirmation(1);
console.log(`Minted (${kind}):`, op.hash);

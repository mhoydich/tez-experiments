// Top up the faucet: node scripts/fund.js 10   (sends 10 tez)
import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import "dotenv/config";

const amount = Number(process.argv[2] || 5);
const RPC = process.env.RPC || "https://rpc.shadownet.teztnets.com";
const Tezos = new TezosToolkit(RPC);
Tezos.setSignerProvider(await InMemorySigner.fromSecretKey(process.env.ADMIN_KEY));

const faucet = process.env.VITE_FAUCET_ADDRESS;
if (!faucet) throw new Error("Set VITE_FAUCET_ADDRESS in .env");

const c = await Tezos.contract.at(faucet);
const op = await c.methodsObject.fund().send({ amount });
await op.confirmation(1);
console.log(`Funded ${faucet} with ${amount} tez:`, op.hash);

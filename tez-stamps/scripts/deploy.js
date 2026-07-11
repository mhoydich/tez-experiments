// Originate the stamps registry on Shadownet.
import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import { readFileSync } from "node:fs";
import "dotenv/config";

const Tezos = new TezosToolkit(process.env.RPC || "https://rpc.shadownet.teztnets.com");
Tezos.setSignerProvider(await InMemorySigner.fromSecretKey(process.env.ADMIN_KEY));

const code = readFileSync("contracts/stamps.tz", "utf8");
const admin = await Tezos.signer.publicKeyHash();

const op = await Tezos.contract.originate({
  code,
  storage: { admin, next_id: 0, types: new Map(), ledger: new Map(), metadata: new Map() },
});
console.log("Originating…", op.hash);
const c = await op.contract();
console.log("Registry deployed at:", c.address);
console.log(`Add to .env:  VITE_REGISTRY_ADDRESS=${c.address}`);

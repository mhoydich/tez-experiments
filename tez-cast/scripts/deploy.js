// Originate the cast broadcaster.
import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import { readFileSync } from "node:fs";
import "dotenv/config";

const Tezos = new TezosToolkit(process.env.RPC || "https://rpc.shadownet.teztnets.com");
Tezos.setSignerProvider(await InMemorySigner.fromSecretKey(process.env.ADMIN_KEY));

const code = readFileSync("contracts/cast.tz", "utf8");

const op = await Tezos.contract.originate({
  code,
  storage: { next_id: 0, casts: new Map(), by_author: new Map() },
});
console.log("Originating…", op.hash);
const c = await op.contract();
console.log("Cast tower deployed at:", c.address);
console.log(`Add to .env:  VITE_CAST_ADDRESS=${c.address}`);

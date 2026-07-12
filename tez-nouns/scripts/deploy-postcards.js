// Originate the postcards rail.
import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import { readFileSync } from "node:fs";
import "dotenv/config";

const Tezos = new TezosToolkit(process.env.RPC || "https://rpc.shadownet.teztnets.com");
Tezos.setSignerProvider(await InMemorySigner.fromSecretKey(process.env.ADMIN_KEY));
const code = readFileSync("contracts/postcards.tz", "utf8");
const op = await Tezos.contract.originate({ code, storage: { next_id: 0, cards: new Map() } });
console.log("Originating…", op.hash);
const c = await op.contract();
console.log("postcards deployed at:", c.address);

// Originate the rating desk on Shadownet.
import { TezosToolkit, MichelsonMap } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import { readFileSync } from "node:fs";
import "dotenv/config";

const Tezos = new TezosToolkit(process.env.RPC || "https://rpc.shadownet.teztnets.com");
Tezos.setSignerProvider(await InMemorySigner.fromSecretKey(process.env.ADMIN_KEY));

const code = readFileSync("contracts/rally.tz", "utf8");

const op = await Tezos.contract.originate({
  code,
  storage: {
    next_match: 0,
    players: new MichelsonMap(),
    matches: new MichelsonMap(),
    metadata: new MichelsonMap(),
  },
});
console.log("Originating…", op.hash);
const c = await op.contract();
console.log("Rating desk deployed at:", c.address);
console.log(`Add to .env:  VITE_RALLY_ADDRESS=${c.address}`);

// Deploy contracts/faucet.tz to Ghostnet.
// Requires: .env with ADMIN_KEY (an unencrypted Ghostnet secret key, edsk...)
// and contracts/faucet.tz compiled from faucet.jsligo (see README).

import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import { readFileSync } from "node:fs";
import "dotenv/config";

const RPC = process.env.RPC || "https://ghostnet.tezos.ecadinfra.com";
const KEY = process.env.ADMIN_KEY;
if (!KEY) throw new Error("Set ADMIN_KEY in .env");

const Tezos = new TezosToolkit(RPC);
Tezos.setSignerProvider(await InMemorySigner.fromSecretKey(KEY));

const code = readFileSync("contracts/faucet.tz", "utf8");
const admin = await Tezos.signer.publicKeyHash();

const op = await Tezos.contract.originate({
  code,
  storage: {
    admin,
    drip: 500_000,        // 0.5 tez in mutez
    max_balance: 100_000, // 0.1 tez threshold (informational)
    claimed: new Map(),
    paused: false,
  },
});

console.log("Originating…", op.hash);
const contract = await op.contract();
console.log("Faucet deployed at:", contract.address);
console.log(`Add to .env:  VITE_FAUCET_ADDRESS=${contract.address}`);

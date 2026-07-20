// Originate the fountain (default: Shadownet). EPOCH_LEN env in seconds
// (default 86400 — the fountain overflows daily). Reveal-first, Taquito >= 25.
import { TezosToolkit, MichelsonMap } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import { stringToBytes } from "@taquito/utils";
import { readFileSync } from "node:fs";
import "dotenv/config";

const RPC = process.env.RPC || "https://rpc.shadownet.teztnets.com";
const EPOCH_LEN = parseInt(process.env.EPOCH_LEN || "86400", 10);
const Tezos = new TezosToolkit(RPC);
const signer = await InMemorySigner.fromSecretKey(process.env.ADMIN_KEY);
Tezos.setSignerProvider(signer);
const deployer = await signer.publicKeyHash();
console.log("deployer:", deployer, "\nrpc:", RPC, "\nepoch_len:", EPOCH_LEN, "s");

try {
  const acct = await Tezos.rpc.getManagerKey(deployer);
  if (!acct) {
    const r = await Tezos.contract.reveal({});
    await r.confirmation(1);
    console.log("revealed:", r.hash);
  }
} catch (e) { console.log("reveal check skipped:", e?.message || e); }

const code = readFileSync(new URL("../contracts/fountain.tz", import.meta.url), "utf8");

const content = JSON.stringify({
  name: "the fountain",
  description:
    "Toss one-tez coins with a wish; every epoch the fountain overflows and the pot splits evenly among that epoch's tossers. Toss once, your coin comes back. Toss five times, you watered the square. No house, no chance — a mirror with a delay. tez-susu — rung 08 of the tez-experiments ladder.",
  version: "0.1.0",
  license: { name: "CC0-1.0" },
  authors: ["El Segundo"],
  homepage: "https://tez-susu.pages.dev/fountain",
  interfaces: ["TZIP-016"],
});
const metadata = new MichelsonMap();
metadata.set("", stringToBytes("tezos-storage:content"));
metadata.set("content", stringToBytes(content));

const op = await Tezos.contract.originate({
  code,
  storage: {
    epoch: 0,
    epoch_len: EPOCH_LEN,
    epoch_end: new Date(Date.now() + EPOCH_LEN * 1000).toISOString(),
    pot: 0,
    tossers: [],
    tosser_count: 0,
    coins: 0,
    overflows: 0,
    volume: 0,
    metadata,
  },
});
console.log("originating…", op.hash);
const c = await op.contract();
console.log("\nfountain deployed at:", c.address);
console.log(`Add to .env:  VITE_FOUNTAIN_ADDRESS=${c.address}`);

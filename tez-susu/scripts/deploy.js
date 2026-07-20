// Originate the susu circle house (default: Shadownet).
// Reveal the deploy key in its own op first (reveal + origination batched can
// blow the per-op gas cap), then originate. Taquito >= 25 for protocol 025.
import { TezosToolkit, MichelsonMap } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import { stringToBytes } from "@taquito/utils";
import { readFileSync } from "node:fs";
import "dotenv/config";

const RPC = process.env.RPC || "https://rpc.shadownet.teztnets.com";
const Tezos = new TezosToolkit(RPC);
const signer = await InMemorySigner.fromSecretKey(process.env.ADMIN_KEY);
Tezos.setSignerProvider(signer);
const deployer = await signer.publicKeyHash();
console.log("deployer:", deployer, "\nrpc:", RPC);

// reveal-first (no-op if already revealed)
try {
  const acct = await Tezos.rpc.getManagerKey(deployer);
  if (!acct) {
    console.log("revealing key…");
    const r = await Tezos.contract.reveal({});
    await r.confirmation(1);
    console.log("revealed:", r.hash);
  }
} catch (e) {
  console.log("reveal check skipped:", e?.message || e);
}

const code = readFileSync(new URL("../contracts/susu.tz", import.meta.url), "utf8");

// TZIP-16 contract metadata (inline, tezos-storage:content)
const content = JSON.stringify({
  name: "susu",
  description:
    "The savings circle (ROSCA/susu/tanda) on Tezos. N neighbors pay a fixed contribution each round; every round one member takes the whole pot, in join order, until everyone has had a turn. No house, no chance — just turns. tez-susu — rung 08 of the tez-experiments ladder.",
  version: "0.1.0",
  license: { name: "CC0-1.0" },
  authors: ["El Segundo"],
  homepage: "https://tez-susu.pages.dev",
  interfaces: ["TZIP-016"],
});
const metadata = new MichelsonMap();
metadata.set("", stringToBytes("tezos-storage:content"));
metadata.set("content", stringToBytes(content));

const op = await Tezos.contract.originate({
  code,
  storage: {
    circles: new MichelsonMap(),
    next_id: 0,
    circles_opened: 0,
    rounds_settled: 0,
    volume: 0,
    metadata,
  },
});
console.log("originating…", op.hash);
const c = await op.contract();
console.log("\nsusu deployed at:", c.address);
console.log(`Add to .env:  VITE_SUSU_ADDRESS=${c.address}`);

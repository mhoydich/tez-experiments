// Originate the made-whole completion stamps (default: Shadownet).
// Reveal the deploy key in its own op first, then originate. Taquito >= 25.
import { TezosToolkit, MichelsonMap } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import { stringToBytes } from "@taquito/utils";
import { readFileSync } from "node:fs";
import "dotenv/config";

const RPC = process.env.RPC || "https://rpc.shadownet.teztnets.com";
const HOUSE = process.env.HOUSE || "KT1QkXi31V5Fv91y7EEu68iNXuY1dRGp5VgM";
const Tezos = new TezosToolkit(RPC);
const signer = await InMemorySigner.fromSecretKey(process.env.ADMIN_KEY);
Tezos.setSignerProvider(signer);
const deployer = await signer.publicKeyHash();
console.log("deployer:", deployer, "\nrpc:", RPC, "\nhouse:", HOUSE);

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

const code = readFileSync(new URL("../contracts/made-whole.tz", import.meta.url), "utf8");

// TZIP-16 contract metadata (inline, tezos-storage:content)
const content = JSON.stringify({
  name: "made whole",
  description:
    "a ledger of kept promises — soulbound proof of completed savings circles",
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
    house: HOUSE,
    claimed: new MichelsonMap(),
    counts: new MichelsonMap(),
    finishers: 0,
    stamps: 0,
    metadata,
  },
});
console.log("originating…", op.hash);
const c = await op.contract();
console.log("\nmade-whole deployed at:", c.address);
console.log(`VITE_STAMPS_ADDRESS=${c.address}`);

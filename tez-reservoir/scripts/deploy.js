// Originate The Reservoir (default: Shadownet).
// Reveal the deploy key in its own op first (reveal + origination batched can
// blow the per-op gas cap), then originate. Taquito >= 25 for protocol 025.
import { TezosToolkit, MichelsonMap } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import { stringToBytes } from "@taquito/utils";
import { readFileSync } from "node:fs";
import "dotenv/config";

const RPC = process.env.RPC || "https://rpc.tzkt.io/shadownet";
const DUES = Number(process.env.DUES_MUTEZ || 1_000_000); // 1ꜩ default
const Tezos = new TezosToolkit(RPC);
const signer = await InMemorySigner.fromSecretKey(process.env.ADMIN_KEY);
Tezos.setSignerProvider(signer);
const deployer = await signer.publicKeyHash();
console.log("deployer (council):", deployer, "\nrpc:", RPC, "\ndues:", DUES / 1e6, "ꜩ");

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

const code = readFileSync(new URL("../contracts/reservoir.tz", import.meta.url), "utf8");

// TZIP-16 contract metadata (inline, tezos-storage:content)
const content = JSON.stringify({
  name: "the reservoir",
  description:
    "The compute susu. A club that pools small dues into secured compute — frontier API credits, decentralized GPU-hours, club nodes. Membership is a soulbound seat; the council draws the pool with memo-tagged buys; the books are open forever. The fountain splits water; the reservoir stores it against a dry season. tez-reservoir — rung 09 of the tez-experiments ladder.",
  version: "0.1.0",
  license: { name: "CC0-1.0" },
  authors: ["El Segundo"],
  homepage: "https://tez-reservoir.pages.dev",
  interfaces: ["TZIP-016"],
});
const metadata = new MichelsonMap();
metadata.set("", stringToBytes("tezos-storage:content"));
metadata.set("content", stringToBytes(content));

const op = await Tezos.contract.originate({
  code,
  storage: {
    council: deployer,
    dues: DUES,
    members: new MichelsonMap(),
    seats: 0,
    total_pooled: 0,
    total_drawn: 0,
    draws: 0,
    metadata,
  },
});
console.log("originating…", op.hash);
const c = await op.contract();
console.log("\nthe reservoir deployed at:", c.address);
console.log(`Add to .env:  VITE_RESERVOIR_ADDRESS=${c.address}`);

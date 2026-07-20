// Originate the DRUM token (default: Shadownet).
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

const code = readFileSync(new URL("../contracts/drum.tz", import.meta.url), "utf8");

// TZIP-16 contract metadata (inline, tezos-storage:content)
const content = JSON.stringify({
  name: "DRUM",
  description:
    "The fungible token you earn by drumming. Tap the drum, batch your hits, mint them in one op. tez-drum — rung 07 of the tez-experiments ladder.",
  version: "0.1.0",
  license: { name: "CC0-1.0" },
  authors: ["El Segundo"],
  homepage: "https://tez-drum.pages.dev",
  interfaces: ["TZIP-012", "TZIP-016"],
});
const metadata = new MichelsonMap();
metadata.set("", stringToBytes("tezos-storage:content"));
metadata.set("content", stringToBytes(content));

// TZIP-12 token metadata for the single fungible token (id 0)
const info = new MichelsonMap();
info.set("name", stringToBytes("DRUM"));
info.set("symbol", stringToBytes("DRUM"));
info.set("decimals", stringToBytes("0"));
const token_metadata = new MichelsonMap();
token_metadata.set(0, { token_id: 0, token_info: info });

const op = await Tezos.contract.originate({
  code,
  storage: {
    ledger: new MichelsonMap(),
    operators: new MichelsonMap(),
    total_supply: 0,
    taps: 0,
    drummers: 0,
    metadata,
    token_metadata,
  },
});
console.log("originating…", op.hash);
const c = await op.contract();
console.log("\nDRUM deployed at:", c.address);
console.log(`Add to .env:  VITE_DRUM_ADDRESS=${c.address}`);

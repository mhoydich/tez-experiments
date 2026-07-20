// Originate the claim-based Fountain V2 on Shadownet only.
// Compiles from jsLIGO at runtime so source and deployed code cannot drift.
// This script deliberately refuses every chain except Shadownet.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { TezosToolkit, MichelsonMap } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import { stringToBytes } from "@taquito/utils";
import "dotenv/config";

const SHADOWNET_CHAIN_ID = "NetXsqzbfFenSTS";
const RPC = process.env.RPC || "https://rpc.tzkt.io/shadownet";
const epochLenInput = process.env.EPOCH_LEN || "86400";
if (!/^\d+$/.test(epochLenInput)) throw new Error("EPOCH_LEN must contain decimal digits only");
const EPOCH_LEN = Number.parseInt(epochLenInput, 10);
const root = fileURLToPath(new URL("..", import.meta.url));

if (!Number.isSafeInteger(EPOCH_LEN) || EPOCH_LEN <= 0) {
  throw new Error("EPOCH_LEN must be a positive integer number of seconds");
}

const Tezos = new TezosToolkit(RPC);
const chainId = await Tezos.rpc.getChainId();
if (chainId !== SHADOWNET_CHAIN_ID) {
  throw new Error(
    `SHADOWNET_ONLY: RPC ${RPC} reports ${chainId}; refusing origination`,
  );
}
if (!process.env.ADMIN_KEY) {
  throw new Error("ADMIN_KEY is required in .env (test key only; never commit it)");
}

const signer = await InMemorySigner.fromSecretKey(process.env.ADMIN_KEY);
Tezos.setSignerProvider(signer);
const deployer = await signer.publicKeyHash();
const balance = Number(await Tezos.tz.getBalance(deployer));
if (balance < 2_000_000) {
  throw new Error(
    `TEST_KEY_UNFUNDED: ${deployer} has ${balance} mutez; need at least 2 tez`,
  );
}

console.log("network: Shadownet", chainId);
console.log("rpc:", RPC);
console.log("deployer:", deployer);
console.log("epoch_len:", EPOCH_LEN, "s");

const compilerVersion = spawnSync("ligo", ["--version"], { cwd: root, encoding: "utf8" });
if (compilerVersion.status !== 0 || compilerVersion.stdout.trim() !== "1.15.6") {
  throw new Error(`LIGO_VERSION_MISMATCH: expected 1.15.6, got ${compilerVersion.stdout.trim() || "unknown"}`);
}
const compiled = spawnSync(
  "ligo",
  ["compile", "contract", "contracts/fountain-v2.jsligo"],
  { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
);
if (compiled.error || compiled.status !== 0) {
  if (compiled.stderr) process.stderr.write(compiled.stderr);
  throw compiled.error || new Error(`LIGO compile failed (exit ${compiled.status})`);
}
const code = compiled.stdout;
if (!code.includes("parameter") || !code.includes("storage") || !code.includes("code")) {
  throw new Error("LIGO returned an invalid Michelson script");
}

const managerKey = await Tezos.rpc.getManagerKey(deployer);
if (!managerKey) {
  const reveal = await Tezos.contract.reveal({});
  console.log("revealing…", reveal.hash);
  await reveal.confirmation(1);
}

const content = JSON.stringify({
  name: "the fountain v2",
  description:
    "A one-tez public wish ritual with equal per-wallet shares and independent pull claims. Epoch finalization is constant-cost; repeat tosses water the square without adding payout weight. No owner, no fee, no chance — a mirror with a delay.",
  version: "0.2.1",
  license: { name: "CC0-1.0" },
  authors: ["El Segundo"],
  homepage: "https://tez-susu.pages.dev/fountain",
  interfaces: ["TZIP-016"],
});
const metadata = new MichelsonMap();
metadata.set("", stringToBytes("tezos-storage:content"));
metadata.set("content", stringToBytes(content));

const memberships = new MichelsonMap();
const settlements = new MichelsonMap();
const operation = await Tezos.contract.originate({
  code,
  storage: {
    started: false,
    epoch: 0,
    epoch_len: EPOCH_LEN,
    epoch_end: "1970-01-01T00:00:00Z",
    pot: 0,
    tosser_count: 0,
    memberships,
    settlements,
    claim_reserve: 0,
    coins: 0,
    finalized_epochs: 0,
    paying_epochs: 0,
    claims: 0,
    volume: 0,
    paid: 0,
    metadata,
  },
});
console.log("originating…", operation.hash);
const contract = await operation.contract();
console.log("\nFountain V2 deployed on Shadownet:", contract.address);
console.log(`Smoke: node scripts/smoke-fountain-v2.js ${contract.address}`);
console.log(`Frontend env: VITE_FOUNTAIN_V2_ADDRESS=${contract.address}`);

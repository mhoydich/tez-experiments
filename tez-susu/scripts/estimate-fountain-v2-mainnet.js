// Read-only Mainnet origination estimate for Fountain V2.
// This never signs, injects, originates, or changes chain state.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { TezosToolkit, MichelsonMap } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import { stringToBytes } from "@taquito/utils";
import "dotenv/config";

const MAINNET_CHAIN_ID = "NetXdQprcVkpaWU";
const APPROVED_MICHELSON_SHA256 = "267f245df855058347965a887594e4d1a9c55a3d5be0f1b15a0da8027a4ea427";
const DAILY_EPOCH_SECONDS = 86_400;
const LOW_BALANCE_ALLOWANCE_MUTEZ = 100_000;
const RPC = process.env.MAINNET_RPC || "https://rpc.tzkt.io/mainnet";
const epochLenInput = process.env.EPOCH_LEN || "86400";
const remainingInput = process.env.MAINNET_MIN_REMAINING_MUTEZ || "250000";
if (!/^\d+$/.test(epochLenInput)) throw new Error("EPOCH_LEN must contain decimal digits only");
if (!/^\d+$/.test(remainingInput)) throw new Error("MAINNET_MIN_REMAINING_MUTEZ must contain decimal digits only");
const EPOCH_LEN = Number.parseInt(epochLenInput, 10);
const MIN_REMAINING_MUTEZ = Number.parseInt(remainingInput, 10);
const root = fileURLToPath(new URL("..", import.meta.url));

if (!process.env.ADMIN_KEY) throw new Error("ADMIN_KEY is required for source-account simulation");
if (!Number.isSafeInteger(EPOCH_LEN) || EPOCH_LEN <= 0) {
  throw new Error("EPOCH_LEN must be a positive integer number of seconds");
}
if (EPOCH_LEN !== DAILY_EPOCH_SECONDS) {
  throw new Error(`MAINNET_EPOCH_MISMATCH: reviewed release requires ${DAILY_EPOCH_SECONDS} seconds`);
}

const Tezos = new TezosToolkit(RPC);
const chainId = await Tezos.rpc.getChainId();
if (chainId !== MAINNET_CHAIN_ID) {
  throw new Error(`MAINNET_ONLY: RPC ${RPC} reports ${chainId}`);
}

const signer = await InMemorySigner.fromSecretKey(process.env.ADMIN_KEY);
Tezos.setSignerProvider(signer);
const source = await signer.publicKeyHash();
const balanceMutez = Number(await Tezos.tz.getBalance(source));

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
const compiledHash = createHash("sha256").update(compiled.stdout).digest("hex");
if (compiledHash !== APPROVED_MICHELSON_SHA256) {
  throw new Error(
    `REVIEWED_CODE_HASH_MISMATCH: expected ${APPROVED_MICHELSON_SHA256}, got ${compiledHash}`,
  );
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

const origination = {
  code: compiled.stdout,
  storage: {
    started: false,
    epoch: 0,
    epoch_len: EPOCH_LEN,
    epoch_end: "1970-01-01T00:00:00Z",
    pot: 0,
    tosser_count: 0,
    memberships: new MichelsonMap(),
    settlements: new MichelsonMap(),
    claim_reserve: 0,
    coins: 0,
    finalized_epochs: 0,
    paying_epochs: 0,
    claims: 0,
    volume: 0,
    paid: 0,
    metadata,
  },
};

try {
  const estimate = await Tezos.estimate.originate(origination);
  const projectedRemainingMutez = balanceMutez - estimate.totalCost;
  console.log(JSON.stringify({
    network: "Mainnet",
    chainId,
    rpc: RPC,
    source,
    epochLen: EPOCH_LEN,
    balanceMutez,
    storageLimit: estimate.storageLimit,
    gasLimit: estimate.gasLimit,
    suggestedFeeMutez: estimate.suggestedFeeMutez,
    burnFeeMutez: estimate.burnFeeMutez,
    totalCostMutez: estimate.totalCost,
    projectedRemainingMutez,
    minimumRemainingMutez: MIN_REMAINING_MUTEZ,
    safeHeadroom: projectedRemainingMutez >= MIN_REMAINING_MUTEZ,
    reviewedMichelsonSha256: compiledHash,
  }, null, 2));
} catch (error) {
  const details = Array.isArray(error?.errors) ? error.errors : [];
  const lowBalance = details.find((item) => item?.id?.endsWith("contract.balance_too_low"));
  if (!lowBalance) throw error;
  const requiredForSimulationMutez = Number(lowBalance.amount);
  const topUpForSimulationMutez = Math.max(0, requiredForSimulationMutez - balanceMutez);
  // `balance_too_low.amount` is only the immediate protocol debit that failed,
  // not a complete fee estimate. Add an explicit conservative allowance; the
  // deployment script still reruns the exact estimate and refuses if unsafe.
  const recommendedTopUpMutez = Math.max(
    0,
    requiredForSimulationMutez
      + MIN_REMAINING_MUTEZ
      + LOW_BALANCE_ALLOWANCE_MUTEZ
      - balanceMutez,
  );
  console.log(JSON.stringify({
    network: "Mainnet",
    chainId,
    rpc: RPC,
    source,
    epochLen: EPOCH_LEN,
    balanceMutez,
    estimateStatus: "insufficient_balance",
    requiredForSimulationMutez,
    topUpForSimulationMutez,
    minimumRemainingMutez: MIN_REMAINING_MUTEZ,
    lowBalanceAllowanceMutez: LOW_BALANCE_ALLOWANCE_MUTEZ,
    recommendedTopUpMutez,
    safeHeadroom: false,
    reviewedMichelsonSha256: compiledHash,
  }, null, 2));
  process.exitCode = 2;
}

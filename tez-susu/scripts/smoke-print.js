// Shadownet proof for the browser print path: originate raw exported code with
// hand-built Micheline storage, then assert both new contracts join the family.
import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import { readFileSync } from "node:fs";
import "dotenv/config";

const RPC = process.env.RPC || "https://rpc.tzkt.io/shadownet";
const INDEXER = "https://api.shadownet.tzkt.io";
const EPOCH_LEN = Number.parseInt(process.env.EPOCH_LEN || "180", 10);
const shadownetChain = "NetXsqzbfFenSTS";

if (!process.env.ADMIN_KEY) throw new Error("ADMIN_KEY is required");
if (!Number.isSafeInteger(EPOCH_LEN) || EPOCH_LEN <= 0) throw new Error("EPOCH_LEN must be positive");

const Tezos = new TezosToolkit(RPC);
const signer = await InMemorySigner.fromSecretKey(process.env.ADMIN_KEY);
Tezos.setSignerProvider(signer);
const deployer = await signer.publicKeyHash();
const chain = await Tezos.rpc.getChainId();
if (chain !== shadownetChain) throw new Error(`refusing to originate on ${chain}; Shadownet only`);
console.log("deployer:", deployer, "\nrpc:", RPC, "\nchain:", chain);

try {
  if (!(await Tezos.rpc.getManagerKey(deployer))) {
    console.log("revealing key…");
    const reveal = await Tezos.contract.reveal({});
    await reveal.confirmation(1);
    console.log("revealed:", reveal.hash);
  }
} catch (error) {
  console.log("reveal check skipped:", error?.message || error);
}

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const susuCode = readJson("../public/contracts/susu.json");
const fountainCode = readJson("../public/contracts/fountain.json");
const family = readJson("../public/contracts/family.json");

const hex = (value) => Array.from(new TextEncoder().encode(value))
  .map((byte) => byte.toString(16).padStart(2, "0")).join("");
const int = (value) => ({ int: String(value) });
const metadata = (content) => [
  { prim: "Elt", args: [{ string: "" }, { bytes: hex("tezos-storage:content") }] },
  { prim: "Elt", args: [{ string: "content" }, { bytes: hex(JSON.stringify(content)) }] },
];

const susuDescription =
  "The savings circle (ROSCA/susu/tanda) on Tezos. N neighbors pay a fixed contribution each round; every round one member takes the whole pot, in join order, until everyone has had a turn. No house, no chance — just turns. tez-susu — rung 08 of the tez-experiments ladder. Printed at tez-susu.pages.dev.";
const fountainDescription =
  "Toss one-tez coins with a wish; every epoch the fountain overflows and the pot splits evenly among that epoch's tossers. Toss once, your coin comes back. Toss five times, you watered the square. No house, no chance — a mirror with a delay. tez-susu — rung 08 of the tez-experiments ladder. Printed at tez-susu.pages.dev.";
const common = {
  version: "0.1.0",
  license: { name: "CC0-1.0" },
  homepage: "https://tez-susu.pages.dev",
};

// Compiled order: circles, next_id, circles_opened, rounds_settled, volume, metadata.
const susuStorage = {
  prim: "Pair",
  args: [
    [], int(0), int(0), int(0), int(0),
    metadata({ name: "smoke print house — a susu house", description: susuDescription, ...common }),
  ],
};

// Compiled order: epoch, epoch_len, epoch_end, pot, tossers, tosser_count,
// coins, overflows, volume, metadata.
const fountainStorage = {
  prim: "Pair",
  args: [
    int(0), int(EPOCH_LEN), int(Math.floor(Date.now() / 1000) + EPOCH_LEN),
    int(0), [], int(0), int(0), int(0), int(0),
    metadata({ name: "smoke print fountain", description: fountainDescription, ...common }),
  ],
};

const originate = async (label, code, init) => {
  console.log(`\noriginating ${label} from exported JSON…`);
  const operation = await Tezos.contract.originate({ code, init });
  console.log(`${label} op:`, operation.hash);
  const contract = await operation.contract();
  console.log(`${label} KT1:`, contract.address);
  return contract.address;
};

const waitForTzkt = async (address) => {
  for (let attempt = 1; attempt <= 30; attempt++) {
    const response = await fetch(`${INDEXER}/v1/contracts/${address}`);
    if (response.ok) return response.json();
    if (response.status !== 404) throw new Error(`TzKT ${response.status} for ${address}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`TzKT did not index ${address}`);
};

const susu = await originate("susu", susuCode, susuStorage);
const fountain = await originate("fountain", fountainCode, fountainStorage);
const [susuInfo, fountainInfo] = await Promise.all([waitForTzkt(susu), waitForTzkt(fountain)]);

if (susuInfo.codeHash !== family.susu.codeHash) {
  throw new Error(`susu codeHash ${susuInfo.codeHash} != family ${family.susu.codeHash}`);
}
if (fountainInfo.codeHash !== family.fountain.codeHash) {
  throw new Error(`fountain codeHash ${fountainInfo.codeHash} != family ${family.fountain.codeHash}`);
}

console.log(`\nsusu codeHash: ${susuInfo.codeHash} == ${family.susu.codeHash} ✓`);
console.log(`fountain codeHash: ${fountainInfo.codeHash} == ${family.fountain.codeHash} ✓`);
console.log("\n✅ SMOKE PRINT PASS — exported JSON + raw Micheline storage join the family.");

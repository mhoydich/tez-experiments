// Shadownet proof for the browser print path: originate raw exported code with
// hand-built Micheline storage, then assert both new contracts join the family.
import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import { readFileSync } from "node:fs";
import { buildFountainStorage, buildSusuStorage } from "../public/print-storage.js";
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

const now = Math.floor(Date.now() / 1000);
const susuStorage = buildSusuStorage("smoke print house");
const fountainStorage = buildFountainStorage("smoke print fountain", EPOCH_LEN, now);

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

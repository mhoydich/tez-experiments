// Export browser-ready Micheline JSON, then pin the byte-identical contract
// family to the codeHash/typeHash reported for its mainnet + Shadownet copies.
import { closeSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const outputDir = fileURLToPath(new URL("../public/contracts/", import.meta.url));
mkdirSync(outputDir, { recursive: true });

const contracts = {
  susu: {
    source: "contracts/susu.jsligo",
    output: "public/contracts/susu.json",
    mainnet: ["https://api.tzkt.io", "KT19HJaK1hNmc337yv6DM4ZfYyPPQnzj277G"],
    shadownet: ["https://api.shadownet.tzkt.io", "KT1QkXi31V5Fv91y7EEu68iNXuY1dRGp5VgM"],
  },
  fountain: {
    source: "contracts/fountain.jsligo",
    output: "public/contracts/fountain.json",
    mainnet: ["https://api.tzkt.io", "KT1UTu9vS3aJH3ktyVCF9DimjLKpqXGQkeGW"],
    shadownet: ["https://api.shadownet.tzkt.io", "KT1X4uVpAndFZ3hU75SubFMHvvZaxjfDU34G"],
  },
  made_whole: {
    source: "contracts/made-whole.jsligo",
    output: "public/contracts/made-whole.json",
    mainnet: ["https://api.tzkt.io", "KT1A8Jq9d9aRo2Je9TtQRYUGRsKC8BdhWCWa"],
    shadownet: ["https://api.shadownet.tzkt.io", "KT1SiQbgGfLiXLfs4ZTa9RvPG6JRVdJSLF2F"],
  },
};

for (const [name, contract] of Object.entries(contracts)) {
  const outputPath = `${root}/${contract.output}`;
  // The wrapper's guest filesystem is read-only. Point compiler stdout at a
  // host-opened file descriptor instead of asking LIGO to write the asset.
  const output = openSync(outputPath, "w");
  const result = spawnSync(
    "ligo",
    ["compile", "contract", contract.source, "--michelson-format", "json"],
    { cwd: root, stdio: ["ignore", output, "inherit"] },
  );
  closeSync(output);
  if (result.error || result.status !== 0) {
    unlinkSync(outputPath);
    throw result.error || new Error(`LIGO failed for ${contract.source} (exit ${result.status})`);
  }
  const code = JSON.parse(readFileSync(outputPath, "utf8"));
  if (
    !Array.isArray(code) || code.length < 3 ||
    code[0]?.prim !== "parameter" || code[1]?.prim !== "storage" || code[2]?.prim !== "code"
  ) throw new Error(`${contract.output} is not a Micheline script`);
  // LIGO emits an extra trailing blank line; keep the committed asset stable.
  writeFileSync(outputPath, `${JSON.stringify(code)}\n`);
  console.log(`exported ${name}: ${contract.output}`);
}

const contractInfo = async ([indexer, address]) => {
  const response = await fetch(`${indexer}/v1/contracts/${address}`);
  if (!response.ok) throw new Error(`TzKT ${response.status} for ${address}`);
  const info = await response.json();
  if (!Number.isInteger(info.codeHash) || !Number.isInteger(info.typeHash)) {
    throw new Error(`TzKT omitted family hashes for ${address}`);
  }
  return { address, codeHash: info.codeHash, typeHash: info.typeHash };
};

const family = {};
console.log("\nfamily identity:");
for (const [name, contract] of Object.entries(contracts)) {
  const [mainnet, shadownet] = await Promise.all([
    contractInfo(contract.mainnet),
    contractInfo(contract.shadownet),
  ]);
  if (mainnet.codeHash !== shadownet.codeHash || mainnet.typeHash !== shadownet.typeHash) {
    throw new Error(
      `${name} FAMILY_MISMATCH: mainnet code/type ${mainnet.codeHash}/${mainnet.typeHash}, ` +
      `Shadownet ${shadownet.codeHash}/${shadownet.typeHash}`,
    );
  }
  family[name] = { codeHash: mainnet.codeHash, typeHash: mainnet.typeHash };
  console.log(
    `${name}: mainnet ${mainnet.codeHash}/${mainnet.typeHash} · ` +
    `Shadownet ${shadownet.codeHash}/${shadownet.typeHash} ✓`,
  );
}

writeFileSync(`${outputDir}/family.json`, `${JSON.stringify(family, null, 2)}\n`);
console.log("\nwrote public/contracts/family.json");

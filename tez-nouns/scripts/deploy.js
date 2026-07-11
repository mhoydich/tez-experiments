import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import { readFileSync } from "node:fs";
import "dotenv/config";

const Tezos = new TezosToolkit(process.env.RPC || "https://ghostnet.tezos.ecadinfra.com");
Tezos.setSignerProvider(await InMemorySigner.fromSecretKey(process.env.ADMIN_KEY));
const admin = await Tezos.signer.publicKeyHash();
const code = readFileSync("contracts/nouns.tz", "utf8");

const op = await Tezos.contract.originate({
  code,
  storage: {
    admin,
    stamps_registry: process.env.STAMPS_REGISTRY,
    next_id: 0,
    ledger: new Map(), nouns: new Map(), personal_minted: new Map(),
    pool_sizes: { background: 4, body: 2, head: 2, glasses: 1, aura: 3 },
    accessory_rules: new Map(),      // set via set_accessory_rule after deploy
    default_accessory_pool: [0, 1],  // "plain"
    qualifying_stamp: 0,             // stamp id required for personal mint
    art: new Map(),
    decay_period: 60 * 60 * 24 * 30, // 30 days to dim
    metadata: new Map(),
  },
});
console.log("Originating…", op.hash);
const c = await op.contract();
console.log("tez-nouns deployed at:", c.address);

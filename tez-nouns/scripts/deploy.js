import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import { readFileSync } from "node:fs";
import "dotenv/config";

const Tezos = new TezosToolkit(process.env.RPC || "https://rpc.shadownet.teztnets.com");
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
    pool_sizes: { background: 2, body: 4, head: 8, glasses: 4, aura: 3 },
    accessory_rules: new Map(),      // set via set_accessory_rule after deploy
    default_accessory_pool: { 9: 0, 10: 1 }, // "plain" (Taquito positional keys for the unannotated pair)
    qualifying_stamp: 0,             // stamp id required for personal mint
    art: new Map(),
    palette: new Map(),
    decay_period: 60 * 60 * 24 * 30, // 30 days to dim
    metadata: new Map(),
  },
});
console.log("Originating…", op.hash);
const c = await op.contract();
console.log("tez-nouns deployed at:", c.address);

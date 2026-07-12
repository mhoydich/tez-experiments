// Originate the passport book. Usage:
//   node scripts/deploy-courts.js            # originate only
//   node scripts/deploy-courts.js --seed     # originate + add the three courts
// RPC env picks the network (defaults Shadownet); ADMIN_KEY deploys,
// ORACLE_KEY's public key becomes the geoconfirm signer.
import { TezosToolkit, MichelsonMap } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import { readFileSync } from "node:fs";
import "dotenv/config";

const Tezos = new TezosToolkit(process.env.RPC || "https://rpc.shadownet.teztnets.com");
Tezos.setSignerProvider(await InMemorySigner.fromSecretKey(process.env.ADMIN_KEY));
const admin = await Tezos.signer.publicKeyHash();
const oracle = await (await InMemorySigner.fromSecretKey(process.env.ORACLE_KEY)).publicKey();

const code = readFileSync("contracts/courts.tz", "utf8");
const op = await Tezos.contract.originate({
  code,
  storage: {
    admin,
    oracle,
    next_venue: 0,
    venues: new MichelsonMap(),
    book: new MichelsonMap(),
    metadata: new MichelsonMap(),
  },
});
console.log("Originating…", op.hash);
const c = await op.contract();
console.log("Passport book deployed at:", c.address);
console.log(`Add to .env:  VITE_COURTS_ADDRESS=${c.address}`);

// microdegrees; radius meters — mirrored in functions/api/geostamp.ts
const VENUES = [
  { name: "California Smash", lat_e6: 33927222, lon_e6: -118388066, radius_m: 180 },
  { name: "Hollyglen Park", lat_e6: 33907488, lon_e6: -118349555, radius_m: 160 },
  { name: "El Segundo Rec Park", lat_e6: 33920934, lon_e6: -118411794, radius_m: 200 },
];

if (process.argv.includes("--seed")) {
  for (const v of VENUES) {
    const o = await c.methodsObject.add_venue(v).send();
    await o.confirmation(1);
    console.log(`venue added: ${v.name} ✓ ${o.hash}`);
  }
}

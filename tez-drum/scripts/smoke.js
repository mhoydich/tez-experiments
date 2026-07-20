// Smoke the DRUM contract on Shadownet with an InMemorySigner (the deploy key).
// Proves the on-chain half of the game: a batch of taps -> one mint -> balance.
// (Does NOT exercise the Beacon/Kukai browser path — that is verified in-page.)
import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import "dotenv/config";

const RPC = process.env.RPC || "https://rpc.shadownet.teztnets.com";
const KT1 = process.env.VITE_DRUM_ADDRESS;
if (!KT1) throw new Error("set VITE_DRUM_ADDRESS in .env first (run deploy)");

const Tezos = new TezosToolkit(RPC);
const signer = await InMemorySigner.fromSecretKey(process.env.ADMIN_KEY);
Tezos.setSignerProvider(signer);
const me = await signer.publicKeyHash();

const c = await Tezos.contract.at(KT1);
const before = await c.contractViews.balance(me).executeView({ viewCaller: KT1 });
console.log("balance before:", before.toString());

const TAPS = 7;
console.log(`minting ${TAPS} DRUM (a 7-tap session)…`);
const op = await c.methodsObject.mint(TAPS).send();
await op.confirmation(1);
console.log("mint op:", op.hash);

const after = await c.contractViews.balance(me).executeView({ viewCaller: KT1 });
const taps = await c.contractViews.total_taps().executeView({ viewCaller: KT1 });
console.log("balance after:", after.toString());
console.log("lifetime taps:", taps.toString());

const ok = Number(after) - Number(before) === TAPS;
console.log(ok ? "\n✅ SMOKE PASS — the drum mints." : "\n❌ SMOKE FAIL");
process.exit(ok ? 0 : 1);

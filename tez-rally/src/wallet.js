// The heavy stack (Taquito + Beacon, ~1.7MB gzipped) lives behind a dynamic
// import — the landing page never loads it; it arrives when someone actually
// connects (or already has a session to resume).
import { TezosToolkit } from "@taquito/taquito";
import { BeaconWallet } from "@taquito/beacon-wallet";
import { NetworkType } from "@airgap/beacon-sdk";

const NETWORK = import.meta.env.VITE_NETWORK || "shadownet";
const RPC = import.meta.env.VITE_RPC ||
  (NETWORK === "mainnet" ? "https://mainnet.smartpy.io" : "https://rpc.shadownet.teztnets.com");
const RALLY = import.meta.env.VITE_RALLY_ADDRESS || "";

export const Tezos = new TezosToolkit(RPC);
export const wallet = new BeaconWallet({
  name: "tez-rally",
  // Beacon v4: network is set on the client, not on requestPermissions()
  network: NETWORK === "mainnet"
    ? { type: NetworkType.MAINNET, rpcUrl: RPC }
    : { type: NetworkType.CUSTOM, name: "Shadownet", rpcUrl: RPC },
  featuredWallets: ["kukai", "temple", "umami"],
});
Tezos.setWalletProvider(wallet);

export const getActiveAccount = () => wallet.client.getActiveAccount();

export async function connect() {
  await wallet.requestPermissions();
  return (await getActiveAccount())?.address;
}

export async function disconnect() {
  await wallet.clearActiveAccount();
}

const run = async (statusEl, busy, done, send) => {
  try {
    statusEl.textContent = busy;
    const c = await Tezos.wallet.at(RALLY);
    const op = await send(c);
    await op.confirmation(1);
    statusEl.textContent = done;
    return true;
  } catch (e) {
    statusEl.textContent = String(e?.message || e);
    return false;
  }
};

export const declare = (milli, statusEl) =>
  run(statusEl, "Declaring…", "Declared. Card minted — now go earn it.",
    (c) => c.methodsObject.declare(milli).send());

// p = { teamA: [addr, addr?], teamB: [addr, addr?], scoreA, scoreB, venue }
export const proposeMatch = (p, statusEl) =>
  run(statusEl, "Reporting to the desk…", "Reported — awaiting countersignatures.",
    (c) => c.methodsObject.propose_match({
      team_a: { p1: p.teamA[0], p2: p.teamA[1] ?? null },
      team_b: { p1: p.teamB[0], p2: p.teamB[1] ?? null },
      score_a: p.scoreA, score_b: p.scoreB,
      venue: p.venue, video_hash: null,
    }).send());

export const confirmMatch = (id, statusEl) =>
  run(statusEl, "Countersigning…", "Countersigned.",
    (c) => c.methodsObject.confirm_match(id).send());

// ---- the passport book ----
const COURTS = import.meta.env.VITE_COURTS_ADDRESS || "";

export async function stampCourt(venue, sig, statusEl) {
  try {
    statusEl.textContent = "Inking the stamp…";
    const c = await Tezos.wallet.at(COURTS);
    const op = await c.methodsObject.stamp({ venue, sig }).send();
    await op.confirmation(1);
    statusEl.textContent = "Stamped. The book remembers.";
    return true;
  } catch (e) {
    const msg = String(e?.message || e);
    statusEl.textContent = msg.includes("STAMPED_TODAY")
      ? "Already stamped here today — one a day keeps it honest."
      : msg;
    return false;
  }
}

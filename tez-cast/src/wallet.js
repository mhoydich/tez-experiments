// The heavy stack (Taquito + Beacon) lives behind a dynamic import —
// pages are read-only until someone actually connects to cast.
import { TezosToolkit } from "@taquito/taquito";
import { BeaconWallet } from "@taquito/beacon-wallet";
import { NetworkType } from "@airgap/beacon-sdk";

const NETWORK = import.meta.env.VITE_NETWORK || "shadownet";
const RPC = import.meta.env.VITE_RPC ||
  (NETWORK === "mainnet" ? "https://mainnet.smartpy.io" : "https://rpc.shadownet.teztnets.com");
const CAST = import.meta.env.VITE_CAST_ADDRESS || "";

export const Tezos = new TezosToolkit(RPC);
export const wallet = new BeaconWallet({
  name: "tez-cast",
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

// Publish a cast. Body travels as raw utf8 bytes — emoji-safe.
export async function publishCast({ kind, body }, statusEl) {
  try {
    statusEl.textContent = "Broadcasting…";
    const hex = Array.from(new TextEncoder().encode(body))
      .map((b) => b.toString(16).padStart(2, "0")).join("");
    const c = await Tezos.wallet.at(CAST);
    const op = await c.methodsObject.default({ kind, body: hex }).send();
    statusEl.textContent = "Confirming…";
    await op.confirmation(1);
    statusEl.textContent = "On the air. Forever.";
    return true;
  } catch (e) {
    statusEl.textContent = String(e?.message || e);
    return false;
  }
}

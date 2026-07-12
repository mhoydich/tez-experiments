// The heavy stack (Taquito + Beacon, ~1.7MB gzipped) lives behind a dynamic
// import — the landing page never loads it; it arrives when someone actually
// connects (or already has a session to resume).
import { TezosToolkit } from "@taquito/taquito";
import { BeaconWallet } from "@taquito/beacon-wallet";
import { NetworkType } from "@airgap/beacon-sdk";

const NETWORK = import.meta.env.VITE_NETWORK || "shadownet";
const RPC = import.meta.env.VITE_RPC ||
  (NETWORK === "mainnet" ? "https://mainnet.smartpy.io" : "https://rpc.shadownet.teztnets.com");
const REGISTRY = import.meta.env.VITE_REGISTRY_ADDRESS || "";

export const Tezos = new TezosToolkit(RPC);
export const wallet = new BeaconWallet({
  name: "tez-stamps",
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

export async function claimOpen(id, statusEl) {
  try {
    statusEl.textContent = "Stamping…";
    const c = await Tezos.wallet.at(REGISTRY);
    const op = await c.methodsObject.claim_open(id).send();
    await op.confirmation(1);
    statusEl.textContent = "Stamped.";
    return true;
  } catch (e) {
    statusEl.textContent = String(e?.message || e);
    return false;
  }
}

export async function claimSigned(id, sig, statusEl) {
  try {
    statusEl.textContent = "Verifying voucher…";
    const c = await Tezos.wallet.at(REGISTRY);
    const op = await c.methodsObject.claim_signed({ id, sig }).send();
    await op.confirmation(1);
    statusEl.textContent = "Stamped.";
    return true;
  } catch (e) {
    statusEl.textContent = String(e?.message || e);
    return false;
  }
}

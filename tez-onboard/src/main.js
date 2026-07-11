// tez-onboard — Beacon connect + seed check
// Kukai is surfaced first (social login), but any Beacon wallet works.

import { TezosToolkit } from "@taquito/taquito";
import { BeaconWallet } from "@taquito/beacon-wallet";
import { NetworkType } from "@airgap/beacon-sdk";
import { maybeSeed } from "./faucet.js";

const NETWORK = import.meta.env.VITE_NETWORK || "shadownet";
const RPC =
  import.meta.env.VITE_RPC ||
  (NETWORK === "mainnet"
    ? "https://mainnet.tezos.ecadinfra.com"
    : "https://rpc.shadownet.teztnets.com");

export const Tezos = new TezosToolkit(RPC);

export const wallet = new BeaconWallet({
  name: "tez-onboard",
  // Beacon v4: network is set on the client, not on requestPermissions()
  network: NETWORK === "mainnet"
    ? { type: NetworkType.MAINNET, rpcUrl: RPC }
    : { type: NetworkType.CUSTOM, name: "Shadownet", rpcUrl: RPC },
  // Surfacing Kukai first is the whole onboarding thesis:
  featuredWallets: ["kukai", "temple", "umami"],
});

Tezos.setWalletProvider(wallet);

const $ = (id) => document.getElementById(id);

async function refreshUI() {
  const account = await wallet.client.getActiveAccount();
  if (!account) {
    $("connect").hidden = false;
    $("session").hidden = true;
    return;
  }
  $("connect").hidden = true;
  $("session").hidden = false;
  $("address").textContent = account.address;

  const balance = await Tezos.tz.getBalance(account.address);
  const tez = balance.toNumber() / 1_000_000;
  $("balance").textContent = `${tez.toFixed(4)} ꜩ`;

  // Fresh wallet? Offer/perform the seed.
  const seeded = await maybeSeed(Tezos, account.address, tez, $("status"));
  if (seeded) refreshUI();
}

$("connect").addEventListener("click", async () => {
  try {
    $("status").textContent = "Opening wallet…";
    await wallet.requestPermissions();
    $("status").textContent = "";
    await refreshUI();
  } catch (e) {
    $("status").textContent = e?.message || "Connection cancelled.";
  }
});

$("disconnect").addEventListener("click", async () => {
  await wallet.clearActiveAccount();
  $("status").textContent = "";
  await refreshUI();
});

refreshUI();

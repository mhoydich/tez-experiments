// tez-stamps — connect and render the wallet's stamp passport.
// Profile modes: connected (Beacon wallet, can claim + log out) or
// view-only via ?view=<address> — a shareable passport link.
import { TezosToolkit } from "@taquito/taquito";
import { BeaconWallet } from "@taquito/beacon-wallet";
import { NetworkType } from "@airgap/beacon-sdk";
import { loadStampTypes, walletHolds, loadNouns, claimOpen } from "./claim.js";

const NETWORK = import.meta.env.VITE_NETWORK || "shadownet";
const RPC = import.meta.env.VITE_RPC ||
  (NETWORK === "mainnet" ? "https://mainnet.smartpy.io" : "https://rpc.shadownet.teztnets.com");
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

const $ = (id) => document.getElementById(id);
const TZKT_UI = NETWORK === "mainnet" ? "https://tzkt.io" : "https://shadownet.tzkt.io";
const viewParam = new URLSearchParams(location.search).get("view");

function showProfileBar(address, viewOnly) {
  $("address").textContent = address;
  $("tzkt-link").href = `${TZKT_UI}/${address}`;
  $("share-link").href = `${location.origin}/?view=${address}`;
  $("copy-address").onclick = () =>
    navigator.clipboard.writeText(address).then(() => {
      $("copy-address").textContent = "copied";
      setTimeout(() => ($("copy-address").textContent = "copy"), 1200);
    });
  $("disconnect").hidden = viewOnly;
  if (viewOnly) {
    $("status").textContent = "Viewing a passport — connect your own wallet from the home page.";
  }
}

async function render(address, { viewOnly = false } = {}) {
  $("connect").hidden = true;
  $("passport").hidden = false;
  showProfileBar(address, viewOnly);

  const types = await loadStampTypes(Tezos);
  const grid = $("stamps");
  const claimable = $("claimable");
  grid.innerHTML = ""; claimable.innerHTML = "";

  for (const t of types) {
    const held = await walletHolds(Tezos, address, t.id);
    if (held) {
      const li = document.createElement("li");
      li.className = "stamp held";
      if (t.thumb) {
        const img = document.createElement("img");
        img.src = t.thumb;
        img.alt = t.name;
        li.appendChild(img);
      }
      const label = document.createElement("div");
      label.innerHTML = `<strong>${t.name}</strong><span>${t.description ?? ""}</span>`;
      li.appendChild(label);
      grid.appendChild(li);
    } else if (t.gate === "open" && !viewOnly) {
      const b = document.createElement("button");
      b.className = "claim";
      b.textContent = `Claim: ${t.name}`;
      b.onclick = () => claimOpen(Tezos, t.id, $("status")).then(() => render(address));
      claimable.appendChild(b);
    }
  }
  if (!grid.children.length) {
    grid.innerHTML = `<li class="stamp empty">No stamps yet — go do something.</li>`;
  }

  // Nouns shelf — images come straight from the contract's token_metadata view.
  const shelf = $("nouns");
  shelf.innerHTML = `<p class="noun-empty">Checking the vault…</p>`;
  const nouns = await loadNouns(Tezos, address);
  shelf.innerHTML = "";
  for (const n of nouns) {
    const fig = document.createElement("figure");
    fig.className = "noun-card";
    fig.innerHTML = n.image
      ? `<img src="${n.image}" alt="${n.name}" /><figcaption>${n.name}</figcaption>`
      : `<figcaption>${n.name} (image view unavailable)</figcaption>`;
    shelf.appendChild(fig);
  }
  if (!nouns.length) {
    shelf.innerHTML = `<p class="noun-empty">No nouns yet — earn stamps, then mint your portrait.</p>`;
  }
}

async function boot() {
  if (viewParam) return render(viewParam, { viewOnly: true });
  const account = await wallet.client.getActiveAccount();
  if (account) return render(account.address);
}

$("connect").addEventListener("click", async () => {
  await wallet.requestPermissions();
  const account = await wallet.client.getActiveAccount();
  if (account) render(account.address);
});

$("disconnect").addEventListener("click", async () => {
  await wallet.clearActiveAccount();
  $("passport").hidden = true;
  $("connect").hidden = false;
  $("status").textContent = "Logged out.";
});

boot();

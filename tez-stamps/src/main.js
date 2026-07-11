// tez-stamps — connect and render the wallet's stamp passport.
import { TezosToolkit } from "@taquito/taquito";
import { BeaconWallet } from "@taquito/beacon-wallet";
import { NetworkType } from "@airgap/beacon-sdk";
import { loadStampTypes, walletHolds, claimOpen } from "./claim.js";

const RPC = import.meta.env.VITE_RPC || "https://ghostnet.tezos.ecadinfra.com";
export const Tezos = new TezosToolkit(RPC);
export const wallet = new BeaconWallet({
  name: "tez-stamps",
  preferredNetwork: NetworkType.GHOSTNET,
  featuredWallets: ["kukai", "temple", "umami"],
});
Tezos.setWalletProvider(wallet);

const $ = (id) => document.getElementById(id);

async function render() {
  const account = await wallet.client.getActiveAccount();
  if (!account) return;
  $("connect").hidden = true;
  $("passport").hidden = false;
  $("address").textContent = account.address;

  const types = await loadStampTypes(Tezos);
  const grid = $("stamps");
  const claimable = $("claimable");
  grid.innerHTML = ""; claimable.innerHTML = "";

  for (const t of types) {
    const held = await walletHolds(Tezos, account.address, t.id);
    if (held) {
      const li = document.createElement("li");
      li.className = "stamp held";
      li.innerHTML = `<strong>${t.name}</strong><span>${t.description ?? ""}</span>`;
      grid.appendChild(li);
    } else if (t.gate === "open") {
      const b = document.createElement("button");
      b.className = "claim";
      b.textContent = `Claim: ${t.name}`;
      b.onclick = () => claimOpen(Tezos, t.id, $("status")).then(render);
      claimable.appendChild(b);
    }
  }
  if (!grid.children.length) {
    grid.innerHTML = `<li class="stamp empty">No stamps yet — go do something.</li>`;
  }
}

$("connect").addEventListener("click", async () => {
  await wallet.requestPermissions({
    network: { type: NetworkType.GHOSTNET, rpcUrl: RPC },
  });
  render();
});

render();

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

// ---- cast tower ----
const CAST = import.meta.env.VITE_CAST_ADDRESS || "";

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

// ---- rally: declare your pickleball level ----
const RALLY = import.meta.env.VITE_RALLY_ADDRESS || "";

// milli-rating: 4250 = 4.250. Free to re-declare until your first
// finalized match — after that the contract answers RATING_IS_EARNED.
export async function declareRally(milli, statusEl) {
  try {
    statusEl.textContent = "Declaring…";
    const c = await Tezos.wallet.at(RALLY);
    const op = await c.methodsObject.declare(milli).send();
    statusEl.textContent = "Confirming…";
    await op.confirmation(1);
    statusEl.textContent = "Declared. Now go earn it.";
    return true;
  } catch (e) {
    const msg = String(e?.message || e);
    statusEl.textContent = msg.includes("RATING_IS_EARNED")
      ? "Your rating is earned now — it only moves through matches."
      : msg.includes("DECLARE_RANGE") ? "Levels run 2.000–8.000."
      : msg;
    return false;
  }
}

// ---- nouns: mint + postcard ----
const NOUNS = import.meta.env.VITE_NOUNS_ADDRESS || "";
const POSTCARDS = import.meta.env.VITE_POSTCARDS_ADDRESS || "";

// Personal mint: contract checks the qualifying stamp on-chain (EARN_YOUR_NOUN).
export async function mintPersonal(statusEl) {
  try {
    statusEl.textContent = "Minting your noun…";
    const c = await Tezos.wallet.at(NOUNS);
    const op = await c.methodsObject.mint({ personal: null }).send();
    await op.confirmation(1);
    statusEl.textContent = "Minted. Welcome to the collection.";
    return true;
  } catch (e) {
    const msg = String(e?.message || e);
    statusEl.textContent = msg.includes("EARN_YOUR_NOUN")
      ? "Earn the qualifying stamp first (claim First Steps)."
      : msg.includes("ONE_PER_WALLET") ? "You've already minted your personal noun."
      : msg;
    return false;
  }
}

// Send a noun as a postcard: FA2 transfer + on-chain note/background, batched.
export async function sendPostcard({ to_, noun, background, note }, statusEl) {
  try {
    statusEl.textContent = "Sending…";
    const nounsC = await Tezos.wallet.at(NOUNS);
    const pcC = await Tezos.wallet.at(POSTCARDS);
    const me = (await getActiveAccount())?.address;
    const noteHex = Array.from(new TextEncoder().encode(note))
      .map((b) => b.toString(16).padStart(2, "0")).join("");
    const op = await Tezos.wallet.batch()
      .withContractCall(nounsC.methodsObject.transfer([
        { from_: me, txs: [{ to_, token_id: noun, amount: 1 }] },
      ]))
      .withContractCall(pcC.methodsObject.default({ to_, noun, background, note: noteHex }))
      .send();
    await op.confirmation(1);
    statusEl.textContent = "Postcard sent.";
    return true;
  } catch (e) {
    statusEl.textContent = String(e?.message || e);
    return false;
  }
}

// Client-side seeding logic.
// If the connected wallet is fresh (balance below threshold) and a faucet
// contract is configured, offer a one-tap claim.
//
// Note: a truly-empty wallet can't pay fees to call `claim` itself. Two options:
//   A) keep SEED_THRESHOLD tiny and ask users to grab dust from a public
//      Ghostnet faucet once (link shown in UI), then your faucet tops them up
//   B) run a relayer: your server (holding the relayer key) calls the
//      contract's `claim_for(address)` entrypoint. For Ghostnet demos, (A) is fine.

const FAUCET = import.meta.env.VITE_FAUCET_ADDRESS || "";
const SEED_THRESHOLD = Number(import.meta.env.VITE_SEED_THRESHOLD || 0.1); // tez

export async function maybeSeed(Tezos, address, balanceTez, statusEl) {
  if (!FAUCET) return false;
  if (balanceTez >= SEED_THRESHOLD) return false;

  if (balanceTez === 0) {
    statusEl.innerHTML =
      `This wallet is brand new — grab a drop of testnet tez from the ` +
      `<a href="https://faucet.ghostnet.teztnets.com" target="_blank" rel="noopener">Ghostnet faucet</a> ` +
      `first, then reconnect and we'll top you up.`;
    return false;
  }

  try {
    statusEl.textContent = "Fresh wallet detected — claiming your seed…";
    const contract = await Tezos.wallet.at(FAUCET);
    const op = await contract.methodsObject.claim().send();
    await op.confirmation(1);
    statusEl.textContent = "Seeded. You're ready to act on-chain.";
    return true;
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.includes("ALREADY_CLAIMED")) {
      statusEl.textContent = "This address has already claimed its seed.";
    } else {
      statusEl.textContent = `Seed claim failed: ${msg}`;
    }
    return false;
  }
}

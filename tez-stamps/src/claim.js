// Registry reads + claim flows.
// Reads use a TzKT-style indexer for big_map access (simplest client path);
// swap VITE_INDEXER for your own if needed.
const REGISTRY = import.meta.env.VITE_REGISTRY_ADDRESS || "";
const INDEXER = import.meta.env.VITE_INDEXER || "https://api.shadownet.tzkt.io";

const hex2str = (h) => decodeURIComponent(h.replace(/../g, "%$&"));

export async function loadStampTypes() {
  if (!REGISTRY) return [];
  const res = await fetch(
    `${INDEXER}/v1/contracts/${REGISTRY}/bigmaps/types/keys?limit=200&active=true`
  );
  const rows = await res.json();
  return rows.map((r) => {
    const md = r.value.metadata || {};
    return {
      id: Number(r.key),
      name: md.name ? hex2str(md.name) : `Stamp #${r.key}`,
      description: md.description ? hex2str(md.description) : "",
      gate: Object.keys(r.value.gate || { open: null })[0]?.toLowerCase(),
      total: Number(r.value.total || 0),
    };
  });
}

export async function walletHolds(_Tezos, address, id) {
  const res = await fetch(
    `${INDEXER}/v1/contracts/${REGISTRY}/bigmaps/ledger/keys?key.address=${address}&key.nat=${id}&active=true`
  );
  const rows = await res.json();
  return rows.length > 0;
}

export async function claimOpen(Tezos, id, statusEl) {
  try {
    statusEl.textContent = "Stamping…";
    const c = await Tezos.wallet.at(REGISTRY);
    const op = await c.methodsObject.claim_open(id).send();
    await op.confirmation(1);
    statusEl.textContent = "Stamped.";
  } catch (e) {
    statusEl.textContent = String(e?.message || e);
  }
}

// Signed-voucher claim: user got { sig } from your verifier (scripts/sign-claim.js
// shows the issuer side). The user pays the fee; the signature is the proof.
export async function claimSigned(Tezos, id, sig, statusEl) {
  try {
    statusEl.textContent = "Verifying voucher…";
    const c = await Tezos.wallet.at(REGISTRY);
    const op = await c.methodsObject.claim_signed({ id, sig }).send();
    await op.confirmation(1);
    statusEl.textContent = "Stamped.";
  } catch (e) {
    statusEl.textContent = String(e?.message || e);
  }
}

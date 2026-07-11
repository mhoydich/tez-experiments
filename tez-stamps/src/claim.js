// Registry reads + claim flows.
// Reads use a TzKT-style indexer for big_map access (simplest client path);
// swap VITE_INDEXER for your own if needed.
const REGISTRY = import.meta.env.VITE_REGISTRY_ADDRESS || "";
const NOUNS = import.meta.env.VITE_NOUNS_ADDRESS || "";
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
      // thumbnailUri is a data: URI stored as utf8 bytes — usable as <img src> directly
      thumb: md.thumbnailUri ? hex2str(md.thumbnailUri) : null,
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

// Nouns owned by an address, with images composed by the contract's own
// token_metadata view (the image never touches IPFS or a server).
export async function loadNouns(Tezos, address) {
  if (!NOUNS) return [];
  const res = await fetch(
    `${INDEXER}/v1/contracts/${NOUNS}/bigmaps/ledger/keys?value=${address}&active=true`
  );
  const rows = await res.json();
  const c = await Tezos.contract.at(NOUNS);
  const out = [];
  for (const r of rows) {
    const id = Number(r.key);
    try {
      const md = await c.contractViews
        .token_metadata(id)
        .executeView({ viewCaller: NOUNS });
      const info = Object.fromEntries(
        [...md.token_info.entries()].map(([k, v]) => [k, hex2str(v)])
      );
      out.push({ id, name: info.name || `Noun ${id}`, image: info.artifactUri });
    } catch {
      out.push({ id, name: `Noun ${id}`, image: null });
    }
  }
  return out;
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

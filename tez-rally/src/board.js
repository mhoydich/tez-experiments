// Light on-chain reads for the landing + view-only cards.
// Everything here is indexer JSON — no Taquito, no Beacon, so the landing
// page never pays the wallet-stack download.
const RALLY = import.meta.env.VITE_RALLY_ADDRESS || "";
const INDEXER = import.meta.env.VITE_INDEXER || "https://api.shadownet.tzkt.io";

const asPlayer = (address, v) => ({
  address,
  declared: Number(v.declared),
  rating: Number(v.rating),
  matches: Number(v.matches),
  wins: Number(v.wins),
  declaredAt: v.declared_at,
});

export async function loadLadder(limit = 50) {
  if (!RALLY) return [];
  const res = await fetch(
    `${INDEXER}/v1/contracts/${RALLY}/bigmaps/players/keys?active=true&limit=${limit}`
  );
  const rows = await res.json();
  return rows
    .map((r) => asPlayer(r.key, r.value))
    .sort((a, b) => b.rating - a.rating);
}

export async function playerOf(address) {
  if (!RALLY) return null;
  const res = await fetch(
    `${INDEXER}/v1/contracts/${RALLY}/bigmaps/players/keys/${address}`
  );
  if (!res.ok) return null;
  const row = await res.json();
  return row?.active ? asPlayer(row.key, row.value) : null;
}

const asMatch = (r) => ({
  id: Number(r.key),
  teamA: [r.value.team_a.p1, r.value.team_a.p2].filter(Boolean),
  teamB: [r.value.team_b.p1, r.value.team_b.p2].filter(Boolean),
  scoreA: Number(r.value.score_a),
  scoreB: Number(r.value.score_b),
  venue: r.value.venue,
  videoHash: r.value.video_hash,
  proposedBy: r.value.proposed_by,
  proposedAt: r.value.proposed_at,
  confirmations: r.value.confirmations || [],
  finalized: r.value.finalized,
});

export async function loadMatches(limit = 20) {
  if (!RALLY) return [];
  const res = await fetch(
    `${INDEXER}/v1/contracts/${RALLY}/bigmaps/matches/keys?active=true&sort.desc=id&limit=${limit}`
  );
  return (await res.json()).map(asMatch);
}

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
  // TzKT answers 204 (empty body) for a key that has never existed
  if (!res.ok || res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  const row = JSON.parse(text);
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

// Replay the ladder from the countersigned log — same integer Elo the
// contract runs. Returns {points, form} for one player: rating after each
// of their matches (starting at the declared seed) and last-5 W/L.
// Client shortcut: matches replay in id order; the MCP verify_replay tool
// does exact finalization-level ordering.
export async function trajectoryOf(address) {
  if (!RALLY) return null;
  const [pRes, mRes] = await Promise.all([
    fetch(`${INDEXER}/v1/contracts/${RALLY}/bigmaps/players/keys?active=true&limit=500`),
    fetch(`${INDEXER}/v1/contracts/${RALLY}/bigmaps/matches/keys?active=true&limit=1000`),
  ]);
  const players = await pRes.json();
  const matches = (await mRes.json()).map(asMatch).filter((m) => m.finalized)
    .sort((a, b) => a.id - b.id);
  const ratings = new Map(players.map((r) => [r.key, Number(r.value.declared)]));
  const delta = (w, l) => Math.max(10, Math.min(150, 50 - Math.floor((w - l) / 10)));
  const points = [ratings.get(address)];
  const form = [];
  for (const m of matches) {
    const avg = (t) => Math.floor(t.reduce((s, a) => s + (ratings.get(a) ?? 0), 0) / t.length);
    const aWon = m.scoreA > m.scoreB;
    const [w, l] = aWon ? [m.teamA, m.teamB] : [m.teamB, m.teamA];
    const d = delta(avg(w), avg(l));
    for (const a of w) ratings.set(a, (ratings.get(a) ?? 0) + d);
    for (const a of l) ratings.set(a, Math.max(1000, (ratings.get(a) ?? 0) - d));
    if (w.includes(address)) { points.push(ratings.get(address)); form.push("W"); }
    if (l.includes(address)) { points.push(ratings.get(address)); form.push("L"); }
  }
  return points[0] === undefined ? null : { points, form: form.slice(-5) };
}

// ---- the passport book (courts contract) ----
const COURTS = import.meta.env.VITE_COURTS_ADDRESS || "";

export async function loadCourts() {
  if (!COURTS) return [];
  const res = await fetch(
    `${INDEXER}/v1/contracts/${COURTS}/bigmaps/venues/keys?active=true&limit=50`
  );
  const rows = await res.json();
  return rows
    .map((r) => ({
      id: Number(r.key),
      name: r.value.name,
      visits: Number(r.value.visits),
    }))
    .sort((a, b) => a.id - b.id);
}

export async function bookOf(address) {
  if (!COURTS) return new Map();
  const res = await fetch(
    `${INDEXER}/v1/contracts/${COURTS}/bigmaps/book/keys?key.address=${address}&active=true`
  );
  const rows = await res.json();
  return new Map(rows.map((r) => [Number(r.key.nat), {
    count: Number(r.value.count),
    firstAt: r.value.first_at,
  }]));
}

export async function loadMatches(limit = 20) {
  if (!RALLY) return [];
  const res = await fetch(
    `${INDEXER}/v1/contracts/${RALLY}/bigmaps/matches/keys?active=true&sort.desc=id&limit=${limit}`
  );
  return (await res.json()).map(asMatch);
}

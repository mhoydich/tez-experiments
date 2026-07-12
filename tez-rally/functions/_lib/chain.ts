// Read-only chain loaders shared by the rally Pages Functions (MCP server,
// /api/glicko). Everything comes from TzKT; nothing here signs anything.

export const INDEXER = 'https://api.tzkt.io';
export const RALLY = 'KT1X4iLYF11LvZhU6PFRamLioKjrcgDJEUoT';   // rating desk (mainnet)
export const COURTS = 'KT1Q1g8Sv3uL2beaA7h89hTViJyZmXxfUS9D';  // passport book (mainnet)
export const SITE = 'https://tez-rally.pages.dev';

export const tzkt = async (path: string) => {
  const res = await fetch(`${INDEXER}${path}`);
  if (!res.ok) throw new Error(`tzkt ${res.status} on ${path}`);
  return res.json();
};

export interface Player { address: string; declared: number; rating: number; matches: number; wins: number; declaredAt: string; }
export interface Match {
  id: number; teamA: string[]; teamB: string[]; scoreA: number; scoreB: number;
  venue: string; proposedAt: string; confirmations: string[]; finalized: boolean;
}

export const loadPlayers = async (): Promise<Player[]> =>
  (await tzkt(`/v1/contracts/${RALLY}/bigmaps/players/keys?active=true&limit=500`))
    .map((r: any) => ({
      address: r.key,
      declared: Number(r.value.declared),
      rating: Number(r.value.rating),
      matches: Number(r.value.matches),
      wins: Number(r.value.wins),
      declaredAt: r.value.declared_at,
    }))
    .sort((a: Player, b: Player) => b.rating - a.rating);

export const loadMatches = async (): Promise<Match[]> =>
  (await tzkt(`/v1/contracts/${RALLY}/bigmaps/matches/keys?active=true&limit=1000`))
    .map((r: any) => ({
      id: Number(r.key),
      teamA: [r.value.team_a.p1, r.value.team_a.p2].filter(Boolean),
      teamB: [r.value.team_b.p1, r.value.team_b.p2].filter(Boolean),
      scoreA: Number(r.value.score_a),
      scoreB: Number(r.value.score_b),
      venue: r.value.venue,
      proposedAt: r.value.proposed_at,
      confirmations: r.value.confirmations || [],
      finalized: r.value.finalized,
    }))
    .sort((a: Match, b: Match) => a.id - b.id);

export const loadCourts = async () =>
  (await tzkt(`/v1/contracts/${COURTS}/bigmaps/venues/keys?active=true&limit=50`))
    .map((r: any) => ({ id: Number(r.key), name: r.value.name, visits: Number(r.value.visits) }))
    .sort((a: any, b: any) => a.id - b.id);

export const bookOf = async (address: string) =>
  (await tzkt(`/v1/contracts/${COURTS}/bigmaps/book/keys?key.address=${address}&active=true`))
    .map((r: any) => ({ venue: Number(r.key.nat), count: Number(r.value.count), firstAt: r.value.first_at }));

// settlement order is confirmation order, not proposal order
export const finalizationLevel = async (id: number): Promise<number> => {
  const updates = await tzkt(`/v1/contracts/${RALLY}/bigmaps/matches/keys/${id}/updates`);
  for (const u of updates) if (u.value?.finalized) return u.level;
  return Number.MAX_SAFE_INTEGER;
};

// finalized matches in the order they settled on-chain
export const settledMatches = async (matches: Match[]): Promise<Match[]> => {
  const done = matches.filter((m) => m.finalized);
  const levels = new Map(await Promise.all(done.map(async (m) =>
    [m.id, await finalizationLevel(m.id)] as [number, number])));
  return done.sort((a, b) => (levels.get(a.id)! - levels.get(b.id)!) || (a.id - b.id));
};

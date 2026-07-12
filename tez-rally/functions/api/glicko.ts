// GET /api/glicko — the second opinion as plain JSON, for the site (and
// anyone else): Glicko-2 over the countersigned log, uncertainty included.
// The on-chain integer Elo is the official number; this is the same ledger
// read through a different open formula. Disagreement is the feature.
import { loadPlayers, loadMatches, settledMatches } from '../_lib/chain';
import { rate } from '../_lib/glicko';

export const onRequestGet: PagesFunction = async () => {
  const [players, matches] = await Promise.all([loadPlayers(), loadMatches()]);
  const done = await settledMatches(matches);
  const rated = rate(players, done);
  const out = players.map((p) => {
    const g = rated.get(p.address)!;
    return {
      address: p.address,
      elo_chain: p.rating,
      glicko: g.rating,
      rd: g.rd,
      games: g.games,
    };
  }).sort((a, b) => b.glicko - a.glicko);
  return new Response(JSON.stringify({
    formula: 'Glicko-2 (tau 0.5, seed RD 350) over the countersigned match log, settlement-ordered',
    note: 'elo_chain is the official on-chain number; glicko±rd is the second opinion. Units: milli-rating (4000 = 4.000).',
    players: out,
  }), {
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=60',
    },
  });
};

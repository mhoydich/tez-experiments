/**
 * /api/mcp — Model Context Protocol server for rally.
 *
 * The rating desk, agent-readable: ladder, player cards, match log,
 * passport stamps, scouting reports — and verify_replay, which recomputes
 * every rating from the countersigned match log and diffs it against
 * chain state. "Replayable by anyone" includes agents.
 *
 * Stateless POST JSON-RPC 2.0 (same transport as pointcast.xyz/api/mcp).
 * GET returns a small discovery page. Read-only: no keys, no writes —
 * reporting and countersigning stay wallet-signed on the site.
 */

const MCP_PROTOCOL_VERSION = '2025-06-18';
const SERVER = { name: 'rally', version: '0.1.0' };
const INDEXER = 'https://api.tzkt.io';
const RALLY = 'KT1X4iLYF11LvZhU6PFRamLioKjrcgDJEUoT';   // rating desk (mainnet)
const COURTS = 'KT1Q1g8Sv3uL2beaA7h89hTViJyZmXxfUS9D';  // passport book (mainnet)
const SITE = 'https://tez-rally.pages.dev';

const JSON_HEADERS = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, mcp-session-id, mcp-protocol-version',
};

// ---------- chain reads (TzKT, read-only) ----------

const tzkt = async (path: string) => {
  const res = await fetch(`${INDEXER}${path}`);
  if (!res.ok) throw new Error(`tzkt ${res.status} on ${path}`);
  return res.json();
};

interface Player { address: string; declared: number; rating: number; matches: number; wins: number; declaredAt: string; }
interface Match {
  id: number; teamA: string[]; teamB: string[]; scoreA: number; scoreB: number;
  venue: string; proposedAt: string; confirmations: string[]; finalized: boolean;
}

const loadPlayers = async (): Promise<Player[]> =>
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

const loadMatches = async (): Promise<Match[]> =>
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

const loadCourts = async () =>
  (await tzkt(`/v1/contracts/${COURTS}/bigmaps/venues/keys?active=true&limit=50`))
    .map((r: any) => ({ id: Number(r.key), name: r.value.name, visits: Number(r.value.visits) }))
    .sort((a: any, b: any) => a.id - b.id);

const bookOf = async (address: string) =>
  (await tzkt(`/v1/contracts/${COURTS}/bigmaps/book/keys?key.address=${address}&active=true`))
    .map((r: any) => ({ venue: Number(r.key.nat), count: Number(r.value.count), firstAt: r.value.first_at }));

// finalization level per match — settlement order is confirmation order,
// not proposal order, so the replay sorts by when finalized flipped true
const finalizationLevel = async (id: number): Promise<number> => {
  const updates = await tzkt(`/v1/contracts/${RALLY}/bigmaps/matches/keys/${id}/updates`);
  for (const u of updates) if (u.value?.finalized) return u.level;
  return Number.MAX_SAFE_INTEGER;
};

// ---------- the replay (mirrors rally.jsligo exactly) ----------
// k_base 50, slope 10, clamp [10,150], floor 1000, team = floor-average.
// Math.floor matches Michelson EDIV (rounds toward -inf) on the one
// signed division; everything else is non-negative.

const eloDelta = (winnerAvg: number, loserAvg: number) => {
  const raw = 50 - Math.floor((winnerAvg - loserAvg) / 10);
  return Math.max(10, Math.min(150, raw));
};

interface ReplayState { ratings: Map<string, number>; log: Array<{ id: number; pre: Map<string, number>; delta: number }>; }

const replay = async (): Promise<{ state: ReplayState; players: Player[]; matches: Match[] }> => {
  const [players, matches] = await Promise.all([loadPlayers(), loadMatches()]);
  const done = matches.filter((m) => m.finalized);
  const levels = new Map(await Promise.all(done.map(async (m) => [m.id, await finalizationLevel(m.id)] as [number, number])));
  done.sort((a, b) => (levels.get(a.id)! - levels.get(b.id)!) || (a.id - b.id));

  const ratings = new Map(players.map((p) => [p.address, p.declared]));
  const log: ReplayState['log'] = [];
  for (const m of done) {
    const pre = new Map([...m.teamA, ...m.teamB].map((a) => [a, ratings.get(a) ?? 0]));
    const avg = (t: string[]) => Math.floor(t.reduce((s, a) => s + (ratings.get(a) ?? 0), 0) / t.length);
    const aWon = m.scoreA > m.scoreB;
    const [w, l] = aWon ? [m.teamA, m.teamB] : [m.teamB, m.teamA];
    const delta = eloDelta(avg(w), avg(l));
    for (const a of w) ratings.set(a, (ratings.get(a) ?? 0) + delta);
    for (const a of l) ratings.set(a, Math.max(1000, (ratings.get(a) ?? 0) - delta));
    log.push({ id: m.id, pre, delta });
  }
  return { state: { ratings, log }, players, matches };
};

// ---------- formatting ----------

const fmt = (m: number) => (m / 1000).toFixed(3);
const short = (a: string) => `${a.slice(0, 7)}…${a.slice(-4)}`;
const rec = (p: Player) => `${p.wins}W–${p.matches - p.wins}L`;
const tier = (p: Player) => (p.matches === 0 ? 'self-declared' : `peer-verified · ${p.matches} countersigned`);
const text = (t: string) => ({ content: [{ type: 'text', text: t }] });

const matchLine = (m: Match) => {
  const aWon = m.scoreA > m.scoreB;
  const [w, ws, l, ls] = aWon ? [m.teamA, m.scoreA, m.teamB, m.scoreB] : [m.teamB, m.scoreB, m.teamA, m.scoreA];
  const names = (t: string[]) => t.map(short).join('/');
  return `#${m.id} ${names(w)} def. ${names(l)} ${ws}–${ls} · ${m.venue} · ${m.proposedAt.slice(0, 10)}${m.finalized ? '' : ` · UNSIGNED ${m.confirmations.length}/${m.teamA.length + m.teamB.length}`}`;
};

// ---------- tools ----------

const TOOLS = [
  { name: 'ladder', description: 'The rally rating ladder: every player, sorted by rating, with record and trust tier. Ratings are milli (4000 = 4.000, DUPR-ish scale).', inputSchema: { type: 'object', properties: { limit: { type: 'number', description: 'max players (default 20)' } } } },
  { name: 'player_card', description: 'One player in full: rating, declared seed, record, tier, rating trajectory replayed from the match log, and passport-book court stamps.', inputSchema: { type: 'object', properties: { address: { type: 'string', description: 'tz address' } }, required: ['address'] } },
  { name: 'recent_matches', description: 'The countersigned match log, newest first, plus anything still awaiting signatures.', inputSchema: { type: 'object', properties: { limit: { type: 'number', description: 'max matches (default 15)' } } } },
  { name: 'courts', description: 'The passport-book courts: South Bay venues with total stamps inked at each.', inputSchema: { type: 'object', properties: {} } },
  { name: 'scouting_report', description: 'A pickleball scouting report for one player, derived entirely from the on-chain ledger: form, upset profile, format splits, venues, matchup plan. No shot-level data — bring your own eyes for the dinks.', inputSchema: { type: 'object', properties: { address: { type: 'string', description: 'tz address of the opponent to scout' } }, required: ['address'] } },
  { name: 'head_to_head', description: 'Every finalized match where two players were on opposite sides, with the running score between them.', inputSchema: { type: 'object', properties: { a: { type: 'string' }, b: { type: 'string' } }, required: ['a', 'b'] } },
  { name: 'verify_replay', description: 'Recompute every rating from declared seeds + the countersigned match log (same integer Elo the contract runs) and diff against live chain state. This is the "replayable by anyone" claim, as a tool call.', inputSchema: { type: 'object', properties: {} } },
];

async function dispatchTool(name: string, args: Record<string, unknown>) {
  const addr = String(args.address || '');

  if (name === 'ladder') {
    const limit = Number(args.limit) || 20;
    const players = await loadPlayers();
    if (!players.length) return text('The ladder is empty — nobody has declared yet.');
    const lines = players.slice(0, limit).map((p, i) =>
      `${i + 1}. ${short(p.address)}  ${fmt(p.rating)}  (${rec(p)} · ${tier(p)})`);
    return text(`rally ladder · ${players.length} player(s) · ${SITE}\n\n${lines.join('\n')}`);
  }

  if (name === 'courts') {
    const courts = await loadCourts();
    return text(`Passport-book courts:\n\n${courts.map((c) =>
      `${c.id}. ${c.name} — ${c.visits} stamp(s) inked`).join('\n')}\n\nStamping is geoconfirmed on-site at ${SITE}.`);
  }

  if (name === 'player_card') {
    const [players, book, courts] = await Promise.all([loadPlayers(), bookOf(addr), loadCourts()]);
    const p = players.find((x) => x.address === addr);
    if (!p) return text(`${addr} has no player card — unrated. Declaring at ${SITE} mints one.`);
    const { state } = await replay();
    const traj = [fmt(p.declared), ...state.log
      .filter((e) => e.pre.has(addr))
      .map((e, i, arr) => {
        const after = i + 1 < arr.length ? arr[i + 1].pre.get(addr)! : state.ratings.get(addr)!;
        return fmt(after);
      })].join(' → ');
    const stamps = book.map((s) => {
      const c = courts.find((x) => x.id === s.venue);
      return `${c?.name ?? `court ${s.venue}`} ×${s.count} (since ${s.firstAt.slice(0, 10)})`;
    });
    return text([
      `Player ${p.address}`,
      `rating ${fmt(p.rating)} · declared ${fmt(p.declared)} · ${rec(p)} · ${tier(p)}`,
      `trajectory: ${traj}`,
      `passport: ${stamps.length ? stamps.join(' · ') : 'no court stamps yet'}`,
      `card: ${SITE}/?view=${p.address}`,
    ].join('\n'));
  }

  if (name === 'recent_matches') {
    const limit = Number(args.limit) || 15;
    const matches = (await loadMatches()).reverse();
    if (!matches.length) return text('No matches on the record yet.');
    return text(matches.slice(0, limit).map(matchLine).join('\n'));
  }

  if (name === 'head_to_head') {
    const a = String(args.a || ''), b = String(args.b || '');
    const matches = (await loadMatches()).filter((m) => m.finalized &&
      ((m.teamA.includes(a) && m.teamB.includes(b)) || (m.teamA.includes(b) && m.teamB.includes(a))));
    if (!matches.length) return text(`${short(a)} and ${short(b)} have never been on opposite sides of a countersigned match.`);
    let aw = 0;
    for (const m of matches) {
      const aOnA = m.teamA.includes(a);
      if ((m.scoreA > m.scoreB) === aOnA) aw++;
    }
    return text(`${short(a)} ${aw}–${matches.length - aw} ${short(b)}\n\n${matches.map(matchLine).join('\n')}`);
  }

  if (name === 'scouting_report') {
    const { state, players, matches } = await replay();
    const p = players.find((x) => x.address === addr);
    if (!p) return text(`Nothing to scout — ${addr} has no card.`);
    const mine = matches.filter((m) => m.finalized && [...m.teamA, ...m.teamB].includes(addr));
    const won = (m: Match) => (m.scoreA > m.scoreB) === m.teamA.includes(addr);
    const form = mine.slice(-5).map((m) => (won(m) ? 'W' : 'L')).join(' ');
    let upsetsFor = 0, upsetsAgainst = 0, marginW = 0, nW = 0, marginL = 0, nL = 0;
    const partners = new Map<string, number>(); const venues = new Map<string, number>();
    for (const m of mine) {
      const myTeam = m.teamA.includes(addr) ? m.teamA : m.teamB;
      const oppTeam = m.teamA.includes(addr) ? m.teamB : m.teamA;
      const entry = state.log.find((e) => e.id === m.id)!;
      const avg = (t: string[]) => Math.floor(t.reduce((s, x) => s + (entry.pre.get(x) ?? 0), 0) / t.length);
      const margin = Math.abs(m.scoreA - m.scoreB);
      if (won(m)) { nW++; marginW += margin; if (avg(myTeam) < avg(oppTeam)) upsetsFor++; }
      else { nL++; marginL += margin; if (avg(myTeam) > avg(oppTeam)) upsetsAgainst++; }
      for (const t of myTeam) if (t !== addr) partners.set(t, (partners.get(t) || 0) + 1);
      venues.set(m.venue, (venues.get(m.venue) || 0) + 1);
    }
    const top = (m: Map<string, number>) => [...m.entries()].sort((x, y) => y[1] - x[1])[0];
    const homeCourt = top(venues); const usual = top(partners);
    const doubles = mine.filter((m) => m.teamA.length === 2);
    const dW = doubles.filter(won).length;
    const singles = mine.length - doubles.length;
    const sW = mine.filter((m) => m.teamA.length === 1 && won(m)).length;
    const patterns = [
      `${rec(p)} at ${fmt(p.rating)} (seeded ${fmt(p.declared)}); form ${form || '—'}.`,
      nW ? `wins by ${(marginW / nW).toFixed(1)} avg; ` : '',
      nL ? `loses by ${(marginL / nL).toFixed(1)} avg.` : '',
      upsetsFor ? ` Upset wins as underdog: ${upsetsFor}.` : '',
      upsetsAgainst ? ` Dropped ${upsetsAgainst} as the favorite — beatable on paper.` : '',
      doubles.length ? ` Doubles ${dW}–${doubles.length - dW}${singles ? '' : '.'}` : '',
      singles ? `${doubles.length ? ',' : ''} singles ${sW}–${singles - sW}.` : '',
      homeCourt ? ` Plays mostly at ${homeCourt[0]} (${homeCourt[1]}×).` : '',
      usual ? ` Usual partner ${short(usual[0])}.` : '',
    ].join('');
    return text([
      `## Scouting: ${short(addr)} (${fmt(p.rating)} · ${rec(p)})`,
      `**Observed patterns:** ${patterns}`,
      `**Target:** ${upsetsAgainst > 0 ? 'their favorite-status matches — the ledger says they leak points when expected to win' : nL > nW ? 'keep doing what the field does; the record is soft' : 'nothing obvious in the ledger — make them earn it point by point'}.`,
      `**Avoid:** ${upsetsFor > 0 ? 'writing them off on rating — they punch up' : 'long warmups; they start ' + (form.startsWith('W') ? 'hot' : 'slow')}.`,
      `**Game plan:** confirm everything at the kitchen line — this report is ledger-derived only (scores, ratings, formats, venues). No shot-level data on-chain yet; bring your own eyes for the dinks.`,
    ].join('\n\n'));
  }

  if (name === 'verify_replay') {
    const { state, players } = await replay();
    const rows = players.map((p) => {
      const r = state.ratings.get(p.address)!;
      return { addr: p.address, chain: p.rating, replayed: r, ok: r === p.rating };
    });
    const bad = rows.filter((r) => !r.ok);
    return text([
      `Replayed ${state.log.length} finalized match(es) over ${rows.length} player(s) — same integer Elo the contract runs (k=50, slope 10, clamp [10,150], floor 1000).`,
      ...rows.map((r) => `${r.ok ? '✓' : '✗'} ${short(r.addr)} chain ${fmt(r.chain)} / replay ${fmt(r.replayed)}`),
      bad.length ? `MISMATCH on ${bad.length} player(s) — either settlement-order inference is off or something is very wrong. Contract: ${RALLY}` : 'Ledger verifies. Nobody has to trust the desk — the desk shows its work.',
    ].join('\n'));
  }

  throw new Error(`unknown tool: ${name}`);
}

// ---------- transport ----------

const rpcResult = (id: unknown, result: unknown) =>
  new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), { headers: JSON_HEADERS });
const rpcError = (id: unknown, code: number, message: string) =>
  new Response(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }), { headers: JSON_HEADERS });

export const onRequestPost: PagesFunction = async ({ request }) => {
  let msg: any;
  try { msg = await request.json(); } catch { return rpcError(null, -32700, 'parse error'); }
  if (!msg || msg.jsonrpc !== '2.0') return rpcError(null, -32600, 'invalid request');
  const id = msg.id ?? null;
  const method = String(msg.method || '');
  const params = msg.params || {};
  try {
    if (method === 'initialize') {
      return rpcResult(id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER,
        instructions: 'rally is a self-declared pickleball rating on Tezos mainnet, hardened by countersigned matches. All tools are read-only chain reads. Start with ladder; use scouting_report before a matchup; verify_replay proves the ratings from the public log. Writes (declare, report, countersign, stamp) are wallet-signed by humans at tez-rally.pages.dev.',
      });
    }
    if (method === 'notifications/initialized' || method === 'initialized')
      return new Response(null, { status: 204, headers: JSON_HEADERS });
    if (method === 'ping') return rpcResult(id, {});
    if (method === 'tools/list') return rpcResult(id, { tools: TOOLS });
    if (method === 'tools/call')
      return rpcResult(id, await dispatchTool(String(params.name || ''), params.arguments || {}));
    return rpcError(id, -32601, `method not found: ${method}`);
  } catch (err: any) {
    return rpcError(id, -32603, `internal error: ${err?.message || String(err)}`);
  }
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { headers: JSON_HEADERS });

export const onRequestGet: PagesFunction = async () =>
  new Response(`<!doctype html><meta charset="utf-8"><title>rally MCP</title>
<style>body{font-family:Georgia,serif;max-width:560px;margin:3rem auto;padding:0 1rem;background:#f2efe9;color:#241f1c}code,pre{font-family:ui-monospace,Menlo,monospace;font-size:.85em;background:#fff;border:1.5px solid #241f1c;padding:2px 6px}pre{padding:12px;overflow-x:auto}h1{font-weight:500}</style>
<h1>rally · MCP</h1>
<p>The rating desk, agent-readable. Add <code>${SITE}/api/mcp</code> as a custom connector
(Claude, Cursor, any MCP client) and you get: <code>ladder</code>, <code>player_card</code>,
<code>recent_matches</code>, <code>courts</code>, <code>scouting_report</code>,
<code>head_to_head</code>, <code>verify_replay</code>.</p>
<p>All read-only. Writes stay wallet-signed at <a href="${SITE}">the desk</a>.</p>
<pre>{"mcpServers":{"rally":{"url":"${SITE}/api/mcp"}}}</pre>
<p>CC0 · contracts ${RALLY} (desk) · ${COURTS} (passport book)</p>`, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'access-control-allow-origin': '*' },
  });

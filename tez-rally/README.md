# tez-rally

**Deployed (Shadownet)**: rating desk `KT1C2EEKHEDjcFAeR8rBLdvX5agq2XnUz5AZ`
(LIGO 1.15.6) — smoke-tested end to end: declare → report → countersign →
Elo settles (`npm run smoke` replays it).

**Live at [tez-rally.pages.dev](https://tez-rally.pages.dev)** — Cloudflare
Pages project `tez-rally` (deploy: `npx vite build && npx wrangler pages
deploy dist --project-name tez-rally`). Rebuild + redeploy after changing
`VITE_RALLY_ADDRESS`.

A pickleball rating you declare yourself, then harden with countersigned
match results. Template #06 in the tez-experiments series.

**The trust ladder:**

```
declare 4.0        →  a CLAIM      (soulbound card, self-declared tier)
opponents co-sign  →  a RECORD     (peer-verified tier; only this moves the number)
venue keeper signs →  an ATTESTATION  (planned — venice-drum-circle keeper pattern)
video hash on match →  EVIDENCE    (field exists on-chain today; archival UX later)
```

Unlike DUPR, the algorithm is open and the ledger is public: integer Elo,
replayable by anyone from contract storage, portable to any app that reads
the big_maps. Your rating isn't an account in someone's database — it's a
property of your wallet.

## The contract

`contracts/rally.jsligo` — one contract, FA2-shaped:

- `declare(milli)` — self-declare 2.000–8.000 (milli-rating: 4250 = 4.250);
  mints your soulbound player card (token_id 0). Re-declare freely until
  your first finalized match; after that `RATING_IS_EARNED`.
- `propose_match(team_a, team_b, score_a, score_b, venue, video_hash)` —
  any participant reports; reporting counts as their signature. Singles or
  doubles, no ties, everyone must hold a card.
- `confirm_match(id)` — countersign. The last signature finalizes and
  settles ratings atomically: linear-approximation Elo, exchange
  `50 - edge/10` milli clamped to [10, 150], doubles settle on team average,
  floor at 1.000.
- FA2 read surface (`balance_of`, transfer-disabled) + views `rating_of`,
  `player_of`, `match_count` — compose forward: gate stamps/traits on rating.

## Run it

```
npm install
npm run dev
```

Reads are indexer-only (TzKT) — the Taquito/Beacon stack lazy-loads when
someone connects. Set `VITE_RALLY_ADDRESS` in `.env` (see `.env.example`).

## Deploy + smoke test

```
ligo compile contract contracts/rally.jsligo > contracts/rally.tz
npm run deploy          # originates with ADMIN_KEY on RPC
# fund the two throwaway smoke players (addresses print on first run):
#   npx @tacoinfra/get-tez <addr> --amount 10 --network shadownet
npm run smoke           # declare → report → countersign → ladder moves
```

## Honest gaps (template-grade, not anti-cheat-grade)

- Two friendly wallets can farm each other. Mitigations when it matters:
  per-pair rate limits, venue-keeper attestation weighting, decay.
- Self-declared seeds are trusted until verified matches wash them out
  (~10 games, same convergence bet DUPR makes).
- Linear Elo, not Glicko-2: no confidence interval, no volatility. The
  upgrade path is an off-chain deterministic rater reading the same match
  log — the log is the product, the formula is swappable.
- `video_hash` is stored but nothing verifies or serves video yet.
- Scores aren't validated as legal pickleball scores (win by 2, to 11/15).
  The countersignature is the validity check.

## License

CC0. Proliferate.

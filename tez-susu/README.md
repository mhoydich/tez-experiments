# tez-susu — the money games house

Rung 08 of the tez-experiments ladder: net-zero money games. Two rooms so
far, both CC0, both "no house, no chance, no yield":

1. **the savings circle** (`contracts/susu.jsligo`, `public/index.html`) —
   an old-world ROSCA (susu / tanda / chit fund): N neighbors each pay a
   fixed contribution per round; each round ONE member takes the whole pot,
   in **join order**, until everyone has had a turn. Everyone ends net-zero;
   each member gets one lump sum. The homepage is a playable pretend circle.
2. **the fountain V2** (`contracts/fountain-v2.jsligo`,
   `public/fountain.html`) — toss exact 1ꜩ coins with public wishes. One
   unique sender address receives one equal share per epoch; repeat coins
   grow the basin without adding weight. Anyone can finalize after the
   deadline in constant cost, then each eligible address claims
   independently. Division dust rolls forward. Wishes cost no contract
   storage — they remain public in transaction parameters and are read from
   the indexer.

Fountain V1 (`contracts/fountain.jsligo`) is retained only as public history.
Its push-all-payouts design and print surface are paused; do not deposit into
the V1 contract.

## Fountain V2 — honest boundary

- No owner, admin, fee, skim, randomness, or promised yield.
- The first accepted coin starts the first full-length epoch. A late coin
  atomically finalizes an expired epoch and enters the next one.
- Claims never expire. Lost-key claims stay reserved forever; nobody can
  recover them. A rejecting recipient rolls back only that claim.
- **One address is not one human.** A person can fund many addresses and take
  many shares, including value donated through another wallet's repeat
  coins. This many-wallet/Sybil attack is core economic risk, not an identity
  promise. Watch the participant count and use only tez you can lose.
- The code passed a separate correctness review and an expanded Shadownet
  lifecycle smoke. It has **not** received a professional audit.
- Reviewed LIGO 1.15.6 compiler-output SHA-256:
  `267f245df855058347965a887594e4d1a9c55a3d5be0f1b15a0da8027a4ea427`.

## How a circle turns

1. `open_circle(name, contribution, seats, grace)` — organizer takes seat 0.
2. `join(id)` — free; seat order = join order = payout order. Filling the
   last seat activates the circle.
3. `contribute(id)` — send exactly `contribution`. The LAST payment of each
   round hands the whole pot to that round's seat in the same operation and
   opens the next round. Round r pays seat r. After `seats` rounds: Done.
4. `disband(id)` — the valve for stalled circles. Organizer anytime; any
   member once the current round has sat unfinished past `grace` seconds.
   Refunds the CURRENT round's payments only.

The contract holds tez only mid-round; a settled or disbanded house holds 0.

## Honest weaknesses (by design, like the real thing)

- A member who stops paying stalls the round until disband. Past pots stay
  where they went — exactly how a real susu breaks. **Join people you
  trust; that is the mechanic.** (A slashable deposit or streaming schedule
  would change the social contract; deliberately not built.)
- Join-time `payable` check means a plain tz wallet can always be paid, but
  a contract wallet that later becomes unpayable cannot brick settlement —
  it was checked when it sat down.
- No partial payments, no seat transfers, no schedule enforcement between
  rounds. Template-grade.

## Addresses

| net | contract | address | notes |
|---|---|---|---|
| Shadownet | circle | `KT1QkXi31V5Fv91y7EEu68iNXuY1dRGp5VgM` | dev copy, smoke-tested (full cycle + valve) |
| Mainnet | circle | `KT19HJaK1hNmc337yv6DM4ZfYyPPQnzj277G` | live at tez-susu.pages.dev |
| Shadownet | fountain V2 | `KT1Xsdqa1K2aG5wrRNDZot3MxpoNEZtCy1Xj` | hardened 120s candidate; expanded lifecycle smoke passed; codeHash `1760237160` |
| Mainnet | fountain V2 | pending | daily reviewed release; public wallet actions remain disabled until originated and verified |
| Mainnet | fountain V1 legacy | `KT1UTu9vS3aJH3ktyVCF9DimjLKpqXGQkeGW` | empty historical deployment; deposits and printing discouraged |
| Shadownet | made-whole | `KT1SiQbgGfLiXLfs4ZTa9RvPG6JRVdJSLF2F` | dev copy against dev house; smoke = 6 claim assertions |
| Mainnet | made-whole | `KT1A8Jq9d9aRo2Je9TtQRYUGRsKC8BdhWCWa` | trustless completion stamps against the mainnet house (verifies via `read_circle` on-chain view — no oracle, no admin). Share posters at `/c/{id}` (Pages Functions + workers-og OG cards). See GROWTH.md |

Compiler: LIGO 1.15.6 (jsLIGO), `ligo compile contract contracts/susu.jsligo > contracts/susu.tz`
(`.tz` gitignored by design — recompile).

Frontend: single-file `public/index.html` — CDN Beacon 4.5.1 (Kukai/Temple),
TzKT-only reads, no build step. Deploy:
`npx wrangler pages deploy public --project-name=tez-susu`.

## Dev

```
cp .env.example .env       # add ADMIN_KEY (never commit)
npm install
npm run deploy             # originate the circle (RPC in .env; teztnets RPC
                           # can lag days — use https://rpc.tzkt.io/shadownet)
npm run smoke              # full 3-seat cycle + double-pay guard + disband valve
EPOCH_LEN=120 npm run deploy:fountain:v2:testnet
npm run smoke:fountain:v2 -- KT1...  # three epochs, six claims, failure isolation, accounting
npm run estimate:fountain:v2:mainnet # read-only; requires ADMIN_KEY for source simulation
# Mainnet is hard-pinned to a daily epoch + reviewed Michelson hash:
CONFIRM_MAINNET_FOUNTAIN_V2=YES npm run deploy:fountain:v2:mainnet
```

Views for the rest of the ladder: circle `read_circle(id)` / `circle_count()`
/ `town()`; Fountain V2 `fountain()`, `read_settlement(epoch)`, and
`can_claim([epoch,address])`.

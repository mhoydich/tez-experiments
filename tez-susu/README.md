# tez-susu — the savings circle

Rung 08 of the tez-experiments ladder. An old-world ROSCA (susu / tanda /
chit fund), on-chain: N neighbors each pay a fixed contribution per round;
each round ONE member takes the whole pot, in **join order**, until everyone
has had a turn. Everyone ends net-zero; each member gets one lump sum. A
savings club, not gambling — no house, no chance, no yield. CC0.

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

| net | address | notes |
|---|---|---|
| Shadownet | `KT1QkXi31V5Fv91y7EEu68iNXuY1dRGp5VgM` | dev copy, smoke-tested (full cycle + valve) |
| Mainnet | `KT19HJaK1hNmc337yv6DM4ZfYyPPQnzj277G` | live at tez-susu.pages.dev |

Compiler: LIGO 1.15.6 (jsLIGO), `ligo compile contract contracts/susu.jsligo > contracts/susu.tz`
(`.tz` gitignored by design — recompile).

Frontend: single-file `public/index.html` — CDN Beacon 4.5.1 (Kukai/Temple),
TzKT-only reads, no build step. Deploy:
`npx wrangler pages deploy public --project-name=tez-susu`.

## Dev

```
cp .env.example .env   # add ADMIN_KEY (never commit)
npm install
npm run deploy         # originate (RPC in .env; teztnets RPC can lag days —
                       # use https://rpc.tzkt.io/shadownet)
npm run smoke          # full 3-seat cycle + double-pay guard + disband valve
```

Views for the rest of the ladder: `read_circle(id)`, `circle_count()`,
`town()` (circles_opened / rounds_settled / volume).

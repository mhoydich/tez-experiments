# GROWTH.md — the susu growth loop

Spec for the next tez-susu increment. Thesis: **the games are the funnel,
the stamps are the asset, the share card is the vector.** Every circle
organizer recruits their own seats — this work gives them the artifact to
do it with, and gives finishers a permanent proof of the kept promise.

Three tasks, one commit each (repo convention). Builder: Codex.
Deploys (Shadownet mainnet + Cloudflare) are done by Claude afterward —
do NOT originate to mainnet or run wrangler deploys from this spec.

Live context:
- Mainnet susu house: `KT19HJaK1hNmc337yv6DM4ZfYyPPQnzj277G`
- Shadownet susu (dev copy): `KT1QkXi31V5Fv91y7EEu68iNXuY1dRGp5VgM`
- Site: https://tez-susu.pages.dev (Cloudflare Pages project `tez-susu`,
  static `public/`, deploy = `npx wrangler pages deploy public`)
- Contract compiler: `ligo compile contract contracts/X.jsligo > contracts/X.tz`
  (host wrapper → Lima VM; VM must be running: `~/.local/lima/bin/limactl start ligo`;
  guest mounts $HOME read-only so ALWAYS redirect stdout host-side)
- `.env` has `ADMIN_KEY` (ladder deploy key) + `RPC=https://rpc.tzkt.io/shadownet`
  (teztnets RPC lags days behind — do not switch back)

## Task A — `contracts/made-whole.jsligo` + deploy/smoke scripts

A minimal soulbound ledger of completed circles. TRUSTLESS: it verifies
completion by calling the susu house's own on-chain view — no oracle, no
server key, no admin.

Storage:
```
type storage = {
  house: address,                        // the susu contract, fixed at origination
  claimed: big_map<[nat, address], unit>,// (circle_id, member) already claimed
  counts: big_map<address, nat>,         // made-whole count per wallet
  finishers: nat,                        // distinct wallets with >= 1 stamp
  stamps: nat,                           // total stamps ever
  metadata: big_map<string, bytes>,      // TZIP-16
};
```

Single meaningful entrypoint:
```
@entry claim = (circle_id: nat, s: storage): ret
```
Rules (each with its own error string, in this order):
1. `Tezos.get_amount() != 0mutez` → `"SEND_NO_TEZ"`
2. Call the house view:
   `Tezos.call_view("read_circle", circle_id, s.house): option<option<circle>>`
   — note call_view itself returns option (None = view/contract missing);
   the view's own return type is `option<circle>`. Unwrap both;
   missing either way → `"NO_SUCH_CIRCLE"`.
3. Circle status must be `Done()` → else `"CIRCLE_NOT_DONE"`.
4. Sender must be in `circle.seat_of` → else `"NOT_A_MEMBER"`.
5. `(circle_id, sender)` not in claimed → else `"ALREADY_STAMPED"`.
Then: add to claimed, increment counts[sender] (0 default), stamps,
and finishers if this was the wallet's first stamp. No operations emitted.

Views:
```
@view made_whole  = (who: address, s) => nat            // counts[who] or 0
@view has_stamp   = (p: [nat, address], s) => bool      // claimed membership
@view town        = (_: unit, s) => { finishers, stamps }
```

CRITICAL jsLIGO/Michelson notes (all learned the hard way in this repo):
- The `circle` and `status` types must be REDECLARED in this contract
  **byte-for-byte identical to `contracts/susu.jsligo`** (same field names,
  same order, same variant order). Michelson view typechecking is
  structural WITH annotations — any drift and `call_view` returns None at
  runtime. Copy-paste the type block from susu.jsligo, do not retype it.
- ALL-CAPS identifiers parse as data constructors — constants lowercase.
- `match(x) { when(Some(v)): ...; when(None()): ... }` is the pattern used
  across the repo; ternaries allowed; no `continue`.
- Record literal after an arrow needs parens: `=> ({ ... })`.
- Fold callbacks take a TUPLE: `([acc, item]: [A, B]) => ...` (not curried).
- `Set.empty` / `list([])` in record positions may need `as` annotations.
- Deprecation warnings about `Tezos.Next` are expected and fine; exit 0 is
  what matters.
- After compiling, `head -20 contracts/made-whole.tz` and eyeball that the
  parameter is `(nat %claim)` — single-@entry contracts compile to a bare
  parameter and are called client-side as `methodsObject.default(id)` /
  Beacon `entrypoint: "default"`. If there are somehow multiple entries,
  the entrypoint is `"claim"`. Record which in the README.

Scripts (mirror the existing house style exactly — read
`scripts/deploy.js` and `scripts/smoke.js` first):
- `scripts/deploy-stamps.js` — originates made-whole. `HOUSE` env var
  selects the susu address (default: the Shadownet dev copy above).
  TZIP-16 inline metadata like deploy.js (name "made whole", description
  "a ledger of kept promises — soulbound proof of completed savings
  circles", CC0, homepage tez-susu.pages.dev). Reveal-first guard as in
  deploy.js. Prints `VITE_STAMPS_ADDRESS=KT1...`.
- `scripts/smoke-stamps.js` — full flow on Shadownet against the dev
  house. Uses ADMIN_KEY as A plus the two BIP39 test-vector throwaway
  mnemonics as B and C exactly like smoke.js (they are already funded).
  Flow: A opens a 2-seat circle (0.5ꜩ contribution, grace 3600),
  B joins, both contribute twice (2 rounds) → circle Done. Then:
  * C (non-member) claim → expect `NOT_A_MEMBER`
  * A claim on a NOT-done circle id (open a fresh recruiting circle for
    this) → expect `CIRCLE_NOT_DONE`
  * A claim (valid) → succeeds; `made_whole(A)` view == 1
  * A claim again → expect `ALREADY_STAMPED`
  * B claim → succeeds; storage `stamps == 2`, `finishers == 2`
  * claim on circle_id 9999 → expect `NO_SUCH_CIRCLE`
  Exit non-zero on any failed assertion; print a ✅ line on pass.
- package.json: add `deploy:stamps` and `smoke:stamps` scripts.

Definition of done (A): contract compiles clean (exit 0) via the ligo
wrapper; deploy-stamps.js originates on SHADOWNET successfully;
smoke-stamps.js passes end to end on Shadownet. Commit:
`tez-susu: made-whole — trustless completion stamps (contract + smoke)`.

## Task B — share pages `/c/{id}` with per-circle OG cards

Cloudflare Pages Functions in `functions/` at the repo's tez-susu root
(wrangler bundles `./functions` automatically when deploying `public`
from this directory — do not move it inside public/).

- `functions/c/[id].ts`: server-rendered share page for one circle.
  * Read the circle from TzKT mainnet:
    `GET https://api.tzkt.io/v1/contracts/KT19HJaK1hNmc337yv6DM4ZfYyPPQnzj277G/bigmaps/circles/keys/{id}`
    — 204/404 ⇒ render a "no such circle" page with 404 status.
  * The circle `name` is UTF-8 hex bytes — decode it; the `status` field
    may arrive as `"recruiting"` (string) or `{recruiting: {}}` (object) —
    normalize both. HTML-escape the decoded name everywhere.
  * `<head>`: og:title `"{name} — a susu circle"`, og:description like
    `"recruiting · 3/5 seats · 1ꜩ a round · join order is payout order"`
    (adapt per status: active → "round 2 of 5 · pot goes around", done →
    "everyone made whole"), og:image absolute URL `/og/c/{id}.png`,
    twitter:card summary_large_image, canonical.
  * `<body>`: a small passport-office card (inline CSS, copy the tokens
    from public/index.html: paper #f2efe9, ink #241f1c, stamp #b3402a,
    tezos-blue #0f61ff, Georgia serif + ui-monospace) showing name,
    status chip, seats filled, contribution, and ONE button:
    "take a seat →" linking `https://tez-susu.pages.dev/#c={id}`.
    No wallet code on this page — it is a poster, not an app.
  * Cache: `Cache-Control: public, max-age=60`.
- `functions/og/c/[id].ts`: PNG card 1200×630. Use the `workers-og`
  npm package (Satori-based, works on Pages Functions) to render a JSX-ish
  card: paper background, circle name large in serif, a row of seat dots
  (filled = joined), footer line "susu — the savings circle · tez-susu.pages.dev".
  IMPORTANT: do NOT use the ꜩ glyph in this rendered card (font subsetting
  tofu risk) — write "tez" or digits. If workers-og proves unusable in
  this runtime, FALLBACK: respond 302 → `/og-circle-default.png` and add
  that static asset (render it from an SVG variant of the site art);
  og:title/description still carry the per-circle text. Note which path
  shipped in the README.
  * `npm i workers-og` in this package if used.
- `public/index.html` additions (keep the existing style system):
  * Parse `location.hash` `#c={id}` on load → after circles render,
    scroll to and visually highlight that circle's card (e.g. stamp-red
    outline for a few seconds).
  * Each circle card gets a `share` ghost button → copies
    `https://tez-susu.pages.dev/c/{id}` via navigator.clipboard, status
    line "link copied — hand it to a neighbor".
- Local verification without deploying: `npx wrangler pages dev public`
  serves the functions; curl `http://127.0.0.1:8788/c/0` (mainnet has no
  circle 0 yet — the "no such circle" page IS the testable path, plus
  point the function at the SHADOWNET indexer/house via env override
  `INDEXER`/`HOUSE` query-less env: read from `context.env` with mainnet
  defaults so tests can exercise a real circle id on Shadownet, where
  ids 0 and 1 exist).

Definition of done (B): `wrangler pages dev` serves `/c/{id}` with correct
OG meta for a real Shadownet circle (env override) AND a clean no-such-circle
page; og image endpoint returns image/png (or the documented fallback);
share button + hash highlight work in the served page. Commit:
`tez-susu: share pages — /c/{id} posters with per-circle OG`.

## Task C — stamp claim UX + badges on the homepage

- Config: add `stamps` KT1 per network to the NETWORKS object (Shadownet:
  whatever Task A's deploy printed — read `.env` `VITE_STAMPS_ADDRESS`;
  mainnet: leave `''`, Claude fills it at mainnet deploy).
- Wallet bar: if connected and stamps contract configured, read
  `made_whole` count via TzKT big_map (`counts` bigmap, key = address;
  204 ⇒ 0) and show `made whole ×N` in the bar (mono eyebrow style,
  stamp-red ×N).
- Done circles where the connected wallet holds a seat: if not yet
  claimed (`claimed` bigmap key probe `{circle_id, address}` — TzKT
  bigmap key for a pair encodes as JSON object; verify the actual key
  shape against the Shadownet deployment with curl and note it in a
  comment), show a `claim your made-whole stamp` button → Beacon op to
  the stamps contract (`entrypoint "default"` if single-entry — see Task
  A note; amount 0; value `{int: String(circleId)}`). After success,
  refresh and render a `made whole ✓` note on the card.
- Keep ALL of it degrading gracefully when `stamps` KT1 is empty ('').

Definition of done (C): on Shadownet (flip ACTIVE='shadownet' locally to
test; RESTORE ACTIVE='mainnet' before committing), the completed smoke
circles from Task A show the claim button for a seated wallet, and the
made-whole count renders in the bar. Commit:
`tez-susu: claim UX — made-whole badges on the passport bar`.

## Out of scope (do not build)

Mainnet origination, wrangler production deploys, AGENTS.md ladder-map
edits, the tezos skill registry, print-your-own origination, sponsored
fountains. Claude handles all deploys and registries after review.

## Conventions reminder

jsLIGO + plain ES modules, no TypeScript in `public/` (functions/*.ts is
fine — Pages compiles them), no frameworks, CC0. Error strings and
entrypoint names are API — once smoke passes, do not rename. One commit
per task, message style `tez-susu: what changed`. Never commit `.env` or
`.tz` artifacts (gitignored). Honest NOTES over silent gaps.

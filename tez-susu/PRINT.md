# PRINT.md — print your own (phase 2 of the growth loop)

Thesis completion: GROWTH.md closed the loop for OUR house; this phase
removes us from the loop. Anyone prints their own susu house or fountain
from the browser — their wallet pays the origination (~0.5–1ꜩ storage
burn), they get a sovereign instance, and the town map finds it
automatically. **No registry contract exists or is needed:** every print
uses byte-identical Michelson, so all family members share a TzKT
`codeHash` — the directory is a TzKT query, and the flagship contracts
(susu `KT19HJaK1hNmc337yv6DM4ZfYyPPQnzj277G`, fountain
`KT1UTu9vS3aJH3ktyVCF9DimjLKpqXGQkeGW`, made-whole
`KT1A8Jq9d9aRo2Je9TtQRYUGRsKC8BdhWCWa`) are simply the first prints.

Iron law: **do not modify any contract source.** A one-byte code change
forks the family (different codeHash → invisible to the directory).
Parameterization happens ONLY through initial storage (names via TZIP-16
inline metadata, fountain epoch_len). The fountain's 1ꜩ coin is a code
constant and stays — "coins are one tez in every fountain in town."

Three tasks, one commit each. Codex builds; Claude deploys Pages after.
No mainnet originations by us — prints are user-paid from their wallet.
Shadownet smoke originations are fine (ADMIN_KEY, dev-family hashes).

## Task A — exported code + family hashes (`scripts/export-code.js`)

- `ligo compile contract contracts/susu.jsligo --michelson-format json`
  (same for fountain, made-whole) — via the Lima wrapper, stdout
  redirect. Write to `public/contracts/{susu,fountain,made-whole}.json`.
  These are page assets, NOT gitignored (unlike .tz — add them normally).
- Script `scripts/export-code.js` does the above (shelling out to `ligo`)
  AND then verifies family identity: fetch
  `https://api.tzkt.io/v1/contracts/{flagship}` for each and record
  `codeHash` + `typeHash`. Then originate NOTHING — instead assert the
  local JSON matches the chain by checking the SHADOWNET dev copies too
  (susu `KT1QkXi31V5Fv91y7EEu68iNXuY1dRGp5VgM`, fountain 180s copy
  `KT1X4uVpAndFZ3hU75SubFMHvvZaxjfDU34G`, made-whole
  `KT1SiQbgGfLiXLfs4ZTa9RvPG6JRVdJSLF2F`): mainnet and shadownet copies
  of the same source must report the SAME codeHash (they were compiled by
  the same ligo 1.15.6 — if any pair disagrees, STOP and report; do not
  paper over it).
- Emit `public/contracts/family.json`:
  `{ susu: {codeHash, typeHash}, fountain: {...}, made_whole: {...} }`
  (numbers as returned by TzKT) — the directory and print shop read this.
- Smoke `scripts/smoke-print.js`: with InMemorySigner (ADMIN_KEY, RPC in
  .env), originate ONE susu house and ONE fountain on Shadownet **from
  the exported JSON files** with hand-built initial storage (below), then
  fetch both new KT1s from TzKT and assert their `codeHash` equals the
  family value. This proves the whole print path (code JSON + storage
  Micheline) before any browser work. Also `npm run` entries.

Initial storage as Micheline JSON (right-comb; n-ary Pair args are legal;
verify field ORDER against the compiled storage type in each .tz — do not
trust this doc over the compiler):
- susu: `Pair [] 0 0 0 0 {Elt "" 0x...; Elt "content" 0x...}` i.e.
  `{prim:"Pair", args:[[], {int:"0"}, {int:"0"}, {int:"0"}, {int:"0"}, METAMAP]}`
  where `[]` is the empty circles big_map.
- fountain: epoch 0, epoch_len (user seconds), epoch_end = int unix
  `now + epoch_len` (Micheline timestamp accepts `{int}`), pot 0,
  tossers `[]` (empty set), tosser_count 0, coins 0, overflows 0,
  volume 0, METAMAP.
- made-whole: house address `{string:"KT1..."}`, claimed `[]`, counts
  `[]`, finishers 0, stamps 0, METAMAP.
- METAMAP: `[{prim:"Elt",args:[{string:""},{bytes:hex("tezos-storage:content")}]},
  {prim:"Elt",args:[{string:"content"},{bytes:hex(JSON)}]}]` — Elt keys
  must be sorted; "" < "content" already is. The JSON carries the
  user-chosen name: `{"name":"<user name> — a susu house", "description":
  "...printed at tez-susu.pages.dev...", "version":"0.1.0",
  "license":{"name":"CC0-1.0"}, "homepage":"https://tez-susu.pages.dev"}`.
  Reuse the flagship descriptions from scripts/deploy*.js as the base.
  Bytes are UTF-8 → hex (TextEncoder pattern from index.html).

Commit A: `tez-susu: print — exported family code + hash-verified smoke`.

## Task B — the print shop (`public/print.html`) + `?house=` overrides

- New page, passport-office set (copy tokens from index.html; red accent).
  Flow: pick **a susu house** or **a fountain** → name it (bytes-safe,
  ≤ 60 chars) → fountain only: epoch length picker (daily 86400 / weekly
  604800) → "print it" → Beacon `requestOperation` with
  `{kind: beacon.TezosOperationType.ORIGINATION, balance:"0",
  script:{code: <fetched /contracts/X.json>, storage: <built Micheline>}}`
  (this exact shape is proven — the TzSafe wallet-less origination
  lesson). Show honest cost copy up front: "printing burns ~0.5–1ꜩ of
  storage fees from your wallet; the press keeps nothing."
- On success, resolve the new KT1: Beacon returns the op hash; poll TzKT
  `/v1/operations/{hash}` (the originations endpoint IGNORES ?hash= —
  known gotcha, filter type=origination client-side) until the
  origination appears, take `originatedContract.address`. Success screen:
  the KT1 stamped big, plus links —
  * susu house → `/?house={KT1}` and its poster path note
  * fountain → `/fountain?fountain={KT1}`
  * "hang its stamp ledger" (susu only, optional second op): originate
    made-whole from `/contracts/made-whole.json` with `house` = the new
    KT1 → then link `/?house={X}&stamps={Y}`.
- `public/index.html` + `public/fountain.html`: honor query overrides —
  `?house=KT1...` / `?stamps=KT1...` / `?fountain=KT1...` replace the
  flagship addresses at runtime (validate `^KT1[1-9A-HJ-NP-Za-km-z]{33}$`;
  ignore invalid). When overridden, show a small "away game" line in the
  bar naming the house (its TZIP-16 name via TzKT contract metadata,
  fallback shortened KT1) with a link back to the flagship. If `?house=`
  is set and `?stamps=` is not, AUTO-DISCOVER its ledger: TzKT contracts
  by made-whole family codeHash (from /contracts/family.json), read each
  one's `storage.house`, match. Cache in sessionStorage.
- share Functions get the same override: `/c/{id}?house=KT1...` reads
  that house instead of env default (validate the same way; posters for
  printed houses).

Commit B: `tez-susu: the print shop — browser origination + away games`.

## Task C — the town map (`public/houses.html`)

- Directory of the whole family, zero registration: for each kind, TzKT
  `GET /v1/contracts?codeHash={family}&limit=200&sort.desc=firstActivity`
  (verify the exact filter param TzKT expects for codeHash — probe it
  with curl against the shadownet dev copies FIRST and leave the working
  URL in a comment; if codeHash isn't filterable, fall back to
  `typeHash` filter + client-side codeHash equality check from each
  contract's detail row).
- Each entry: TZIP-16 name (TzKT `metadata.name` if indexed, else fetch
  storage content bytes and decode, else shortened KT1), first activity
  date, per-kind stats (susu: `circles_opened`/`rounds_settled`/`volume`
  from storage; fountain: `coins`/`overflows`/`volume`; made-whole
  ledgers fold INTO their house's row via storage.house — show
  "stamps: N"). Flagships get a small "the first print" chip. Links:
  susu → `/?house=`, fountain → `/fountain?fountain=` (flagships link
  bare `/` and `/fountain`).
- Passport-office list styling like the circles list; a lede that says
  the quiet part: "every house here runs the same law; nobody can change
  it, including us. print yours at the shop."
- Nav: index.html + fountain.html + print.html footer/eyebrow links to
  `/houses` ("the town map") and `/print` ("the print shop"). Pages
  serves clean URLs for .html files automatically.
- Verify with `wrangler pages dev` against SHADOWNET family hashes (the
  smoke-print instances from Task A exist there): the map must list the
  dev flagships AND the smoke prints with names decoded.

Commit C: `tez-susu: the town map — codeHash family directory`.

## Out of scope

Universal cross-house made-whole (a fake house could fake the view — per-
house ledgers + client-side family verification is the honest v1; noted),
sponsored fountains, club treasuries, any contract source edits (iron
law), mainnet ops, production deploys (Claude's).

## Conventions

Same as GROWTH.md: plain ES modules in public/ (functions/*.ts fine),
error strings/entrypoints are API, one commit per task, .env/.tz stay
uncommitted, honest NOTES over silent gaps, ꜩ never inside rendered PNGs.

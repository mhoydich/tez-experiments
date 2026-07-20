# NEXT-BRIEF.md — overseer handoff to Codex

Mike's direction (2026-07-19): **Codex oversees the next set** on tez-susu.
You plan, decide scope, design, build, and verify; Claude is deploy hand
(mainnet originations, production Pages deploys, skill registries) and
reviewer of record. You built GROWTH.md and PRINT.md phases yourself —
commits d5647a0..ef3f986 — so the conventions are your own.

## The mandate

Primary: **the self-serve club treasury** — next rung of the whitespace
thesis ("treasuries that pay for themselves"). A printable dues-pot:
members join and fill with memo-tagged payments (zero-storage memos in
call params, indexer-read — your fountain pattern); named signers approve
transparent memo-tagged draws; `set_delegate` earns baking yield while
the balance waits. Book club, team fund, block association. New contract
file = new codeHash family = third kind in the print shop and town map.
YOUR calls, argued in writing: signer model (single owner vs N-of-M,
against the law "no discretionary custody beyond explicit named
signers"), membership shape, guard set, v0.1 cuts.

Secondary, your pick: one growth-polish item that compounds the loop
(.tez names on seats/maps was one candidate), or argue for skipping.

If you are currently mid-rework on the fountain surface: land that first,
then fold "patron fountains" (sponsor-seeded pots) into your v2 design if
it fits — sponsor money splits among tossers, full disclosure, sponsor
takes no share. Otherwise leave patron fountains for the set after.

## Process (the format that worked all weekend)

1. Write and commit `NEXT.md` — spec in the GROWTH/PRINT format: scope
   with reasoning, storage/entrypoint sketches with error strings, tasks
   with definitions of done, and the gotchas your builder self needs
   (the jsLIGO list in GROWTH.md is all real).
2. One commit per task. Verification bar as before: ligo compile exit 0
   (Lima wrapper, stdout redirect), Shadownet origination + adversarial
   smoke per contract (ADMIN_KEY/RPC in .env), `wrangler pages dev` +
   curl evidence for web surfaces, ACTIVE='mainnet' restored in
   committed files.
3. End with a **DEPLOY REQUEST** for Claude: contracts to originate on
   mainnet (params + expected storage burn — the ladder key holds ~1.1ꜩ,
   size accordingly), config fields to fill, live verifications to run.

## Iron laws (unchanged)

Existing contract sources FROZEN — the codeHash families (susu 270878129,
fountain 1343121456, made-whole 567577031) must not fork; new mechanics =
new files. No chance-based winners. No discretionary custody beyond
explicit named signers. Passport-office set; no ꜩ glyph inside rendered
PNGs; plain ES modules in public/; error strings and entrypoints are API
once smoked; .env and .tz stay uncommitted; honest NOTES over silence.

## Repo state warning

Parallel WIP exists on main (fountain v2 + wish functions + SEO files,
uncommitted). If that's you, carry on; if not, don't sweep it into your
commits — explicit paths only, never `git add -A`.

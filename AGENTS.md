# AGENTS.md — tez-experiments

Instructions for ANY coding agent working in this repo (Claude Code, Codex,
or a human). This file is the single source of truth; CLAUDE.md just points
here. Do not add agent-specific behavior anywhere else.

## What this is

A ladder of small, composable Tezos experiment templates. Thesis: the wallet
is a passport that accumulates identity through activity. Each template is
standalone and CC0; they compose but never require each other at runtime.

```
tez-onboard/          # 01 — Kukai/Beacon connect + seeding faucet (the door)
tez-stamps/           # 02 — soulbound FA2 verificational: do → prove → stamp
tez-nouns/            # 03 — Nouns-style NFT; accessory EARNED from stamps,
                      #      aura LIVING (mutable). See tez-stamps/TRAITS.md
venice-drum-circle/   # 04 — SCOPE.md only: physical drum circle dispensing
                      #      session badges. Zero new contracts needed.
tez-cast/             # 05 — personal page for any wallet (balance/activity/
                      #      stamps/nouns viz) + append-only broadcast tower.
                      #      MAINNET KT1NgPnaHLtZ2cNpb2hWGDxFH9fUCABaiaE1,
                      #      live at tez-cast.pages.dev
tez-rally/            # 06 — pickleball rating desk: self-declared soulbound
                      #      card hardened by countersigned matches; integer
                      #      Elo settled on-chain.
                      #      MAINNET KT1X4iLYF11LvZhU6PFRamLioKjrcgDJEUoT
                      #      (Kukai web = mainnet-only, so the live site
                      #      points there), Shadownet
                      #      KT1C2EEKHEDjcFAeR8rBLdvX5agq2XnUz5AZ.
                      #      Passport book (geoconfirmed court stamps):
                      #      MAINNET KT1Q1g8Sv3uL2beaA7h89hTViJyZmXxfUS9D.
                      #      Live at tez-rally.pages.dev
```

Read each repo's README.md before touching it. tez-stamps/TRAITS.md is the
design spec bridging 02→03. tez-nouns/contracts/NOTES.md lists known gaps.

## Ground truth about current state (be honest with yourself)

- All three contracts compile clean under LIGO 1.15.6 (P0 tasks 1+3 done
  2026-07-11; zero source fixes were needed). The `has_stamp`/`stamp_count`
  views are in stamps.jsligo. On this machine there is no docker: `ligo` on
  PATH (~/.local/bin/ligo) is a wrapper that runs the static Linux binary
  inside a Lima VM named "ligo" — output goes to stdout, redirect on the
  host side (the guest mounts $HOME read-only).
- Frontends smoke-tested (P0 task 2 done): both dev servers run and the
  Beacon Connect Wallet modal opens. This required vite.config.js node
  polyfills + Beacon-bundle aliases and the Beacon v4 constructor network
  option — see commit history for the why.
- The renderer (`tez-nouns/src/render.js`) IS tested offline and works.
- DEPLOYED to Shadownet 2026-07-11 (Ghostnet NO LONGER EXISTS — it died
  upstream; Shadownet at rpc.shadownet.teztnets.com is the long-running
  testnet, chain NetXsqzbfFenSTS). Addresses in each repo README.
  Gotchas that cost time: Taquito >= 25 required (protocol 025 forging;
  v20 signs invalid ops), plain JS Map silently encodes as EMPTY
  michelson map (use MichelsonMap), char2Bytes is now stringToBytes,
  unannotated tuple fields want positional keys ({9:..,10:..}) in
  storage objects. Fund testnet keys programmatically with
  `npx @tacoinfra/get-tez <addr> --amount 100 --network shadownet`.
- tez-stamps frontend is LIVE at stampz.xyz (see tez-stamps/README).
- tez-rally (06) deployed to Shadownet 2026-07-11 and smoke-tested end to
  end (two throwaway players: declare → report → countersign → Elo settles;
  scripts/smoke.js replays it). Frontend LIVE at tez-rally.pages.dev.
  jsLIGO gotcha learned: UPPERCASE identifiers parse as data constructors —
  constants must be lowercase.

## Environment

- Node >= 20. Each repo has its own package.json; no workspace root config
  on purpose (templates must stay independently copyable).
- LIGO compiler, either:
  - docker: `docker run --rm -v "$PWD":"$PWD" -w "$PWD" ligolang/ligo:1.6.0 compile contract <file> -o <out>`
  - or static binary from ligolang.org if no docker
  - if 1.6.0 syntax rejects something, try the latest 1.x and note the
    version that works in the repo README
- Shadownet RPC: https://rpc.shadownet.teztnets.com
- Testnet keys: NEVER commit. `.env` per repo (gitignored), `.env.example`
  documents shape. Fund via https://faucet.shadownet.teztnets.com

## Task backlog (work top to bottom; one PR/commit per task)

P0 — make it real
1. Compile all three contracts (`faucet.jsligo`, `stamps.jsligo`,
   `nouns.jsligo`). Fix errors with MINIMAL diffs — preserve entrypoint
   names, storage shapes, and error strings; they're referenced by the JS.
2. `npm install && npm run dev` smoke test tez-onboard and tez-stamps.
   Fix import/runtime breaks. Verify Beacon wallet modal opens.
3. Add the `has_stamp` and `stamp_count` views to stamps.jsligo
   (spec + snippet in tez-nouns/contracts/NOTES.md). Recompile.

P1 — close the honest gaps
4. Deploy all three to Shadownet; record addresses in each README.
   [READY 2026-07-11: deploy key generated in each repo's .env
   (tz1XgXN2aTxcwiGvUqMrqU7vuBtRZnGCPcUZ) — waiting on faucet funding,
   then run each repo's deploy script.]
5. ~~Faucet relayer~~ DONE: claim_for(address) gated on a relayer address
   (defaults to admin; rotate via set_relayer). Compiles clean.
6. ~~tez-nouns token_metadata view~~ DONE: on-chain view composing the
   TZIP-21 data-URI SVG from the art big_map; interpreter-verified.
   Also done: stamp-type art vendored (tez-stamps/art/) and
   add-stamp-type.js --image inlines it as a data-URI thumbnailUri.

P2 — extend
7. venice-drum-circle MVP per its SCOPE.md cutlist (one page + two keeper
   CLI scripts; reuses the stamps registry, no new contracts).
8. Commit-reveal randomness for tez-nouns auction series.
9. English auction contract for tez-nouns.

## Conventions

- jsLIGO for contracts, plain ES modules for JS, Vite for frontends.
  No TypeScript, no frameworks — templates optimize for readability and
  copy-paste-ability over robustness.
- Template-grade over production-grade, but never dishonest: known
  weaknesses get a comment or a NOTES.md line, not silence.
- CC0 everything. No proprietary deps.
- Keep templates decoupled: cross-template integration happens through
  on-chain views and documented env vars only, never imports.
- Don't invent new frontend aesthetics; both demo pages share the
  "passport office" visual family. Extend it.
- Commit messages: `repo-name: what changed` (e.g. `tez-stamps: add views`).

## Definition of done (per task)

Contract tasks: compiles clean; entrypoint names/error strings unchanged
unless the task says otherwise; NOTES.md updated if a gap closed or opened.
Frontend tasks: `npm run dev` works from a fresh clone + `.env.example`.
Deploy tasks: address recorded in README with the compiler version used.

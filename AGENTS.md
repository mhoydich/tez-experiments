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
```

Read each repo's README.md before touching it. tez-stamps/TRAITS.md is the
design spec bridging 02→03. tez-nouns/contracts/NOTES.md lists known gaps.

## Ground truth about current state (be honest with yourself)

- All three jsLIGO contracts were written WITHOUT a compiler in the loop.
  Assume syntax errors exist. Compiling them is task #1.
- `npm install` has never been run in any repo. Frontends are unsmoke-tested.
- The renderer (`tez-nouns/src/render.js`) IS tested offline and works.
- Nothing is deployed. Ghostnet is the only target until told otherwise.

## Environment

- Node >= 20. Each repo has its own package.json; no workspace root config
  on purpose (templates must stay independently copyable).
- LIGO compiler, either:
  - docker: `docker run --rm -v "$PWD":"$PWD" -w "$PWD" ligolang/ligo:1.6.0 compile contract <file> -o <out>`
  - or static binary from ligolang.org if no docker
  - if 1.6.0 syntax rejects something, try the latest 1.x and note the
    version that works in the repo README
- Ghostnet RPC: https://ghostnet.tezos.ecadinfra.com
- Testnet keys: NEVER commit. `.env` per repo (gitignored), `.env.example`
  documents shape. Fund via https://faucet.ghostnet.teztnets.com

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
4. Deploy all three to Ghostnet; record addresses in each README.
5. Faucet relayer: tiny `claim_for(address)` path so truly-empty wallets
   can be seeded (see note in tez-onboard/src/faucet.js). Keep it optional.
6. tez-nouns `token_metadata` off-chain view returning TZIP-21 with
   data-URI SVG (shape already in src/metadata.js).

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

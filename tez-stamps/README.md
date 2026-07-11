# tez-stamps

**Deployed (Shadownet)**: registry `KT1MSMyZDAhhNN7TLHoZYttRBfpURnnzgg3P`
(LIGO 1.15.6). Types 0 "First Steps" (open), 1 "Showed Up" (open),
2 "Shipped" (signed) — thumbnails are on-chain data URIs.

**Live at [stampz.xyz](https://stampz.xyz)** — Cloudflare Pages project
`stampz` (deploy: `npx vite build && npx wrangler pages deploy dist
--project-name stampz`). DNS: Namecheap ALIAS @ / CNAME www →
stampz.pages.dev. Rebuild + redeploy after setting VITE_REGISTRY_ADDRESS.

Template #2 in the tez-experiments series. The verificational primitive:

**do a thing → prove the thing → receive a stamp.**

A stamp is a soulbound FA2 token — non-transferable proof of participation, bound to the wallet forever. Stamps are what turn a seeded wallet (see `tez-onboard`) into an accumulating identity, and they're the raw material for activity-derived traits in `tez-nouns`.

## The model

```
   TASK                    VERIFIER                 STAMP
   "attend the thing"  →   signs attestation    →   FA2 token_id=N
   "finish the lesson" →   or on-chain check    →   minted to wallet,
   "tap the drum 100x" →   or open self-claim   →   non-transferable
```

- Each **stamp type** is one FA2 `token_id` with TZIP-21 metadata (name, image, what it attests).
- Each stamp type has a **gate**: who's allowed to trigger the mint.
  - `open` — anyone can self-claim (attendance-style, honor system)
  - `issuer` — only a designated issuer address mints (e.g. your backend verifies the task, then mints)
  - `signed` — user submits an off-chain signature from the issuer; contract verifies and mints. No relayer needed: the *user* pays the fee but can't forge the stamp.
- **Soulbound**: `transfer` fails for everyone except mint (from `None`) and optional issuer burn. Your history isn't for sale.

## What's in the box

```
tez-stamps/
├── contracts/
│   └── stamps.jsligo      # FA2 (TZIP-12) soulbound stamp registry
├── src/
│   ├── main.js            # connect + view your stamp passport
│   ├── claim.js           # open-claim and signed-claim flows
│   └── style.css
├── scripts/
│   ├── deploy.js          # originate the registry
│   ├── add-stamp-type.js  # create a new stamp type with metadata + gate
│   ├── issue.js           # issuer-mints a stamp to an address
│   └── sign-claim.js      # issuer signs an off-chain claim voucher
├── index.html
└── package.json
```

## Quick start

```bash
npm install
docker run --rm -v "$PWD":"$PWD" -w "$PWD" ligolang/ligo:1.6.0 \
  compile contract contracts/stamps.jsligo -o contracts/stamps.tz
node scripts/deploy.js
node scripts/add-stamp-type.js "First Steps" "Completed onboarding" open
npm run dev
```

> Verified: compiles clean with LIGO **1.15.6** (any 1.x should work; expect only `Tezos` → `Tezos.Next` deprecation warnings). No docker on your machine? A static `ligo` binary works the same: `ligo compile contract <file> -o <out>`.

## Education through activity

A curriculum is just an ordered list of stamp types with `signed` gates. The chain is the gradebook:

1. Lesson page checks the wallet's stamps to decide what's unlocked.
2. Learner completes the activity; your verifier signs a voucher.
3. Learner submits the voucher; the contract mints the stamp; the next lesson unlocks.

No accounts, no database of progress. The wallet *is* the transcript, portable to any app that reads the registry.

## Composing forward

`tez-nouns` reads this registry at mint time: the stamps a wallet holds deterministically influence the traits its noun gets. See `TRAITS.md` for the derivation spec.

## License

CC0. Proliferate.

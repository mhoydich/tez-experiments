# tez-onboard

A clean-room starter for Tezos apps where the wallet is the front door **and** the memory.

Connect with Kukai (social login — no seed phrase ceremony), get seeded with enough tez to act, and start accumulating on-chain history. This is template #1 in a series of small, composable Tezos experiment templates:

1. **tez-onboard** (this repo) — Kukai/Beacon connect + seeding faucet
2. **tez-stamps** — task → verify → FA2 stamp (verificational primitive)
3. **tez-nouns** — daily-mint generative collectible with activity-derived traits

## What's in the box

```
tez-onboard/
├── src/
│   ├── main.js          # Beacon wallet connect (Kukai, Temple, any Beacon wallet)
│   ├── faucet.js        # Client-side faucet interaction
│   └── style.css        # Demo UI
├── contracts/
│   └── faucet.jsligo    # Seeding faucet contract (jsLIGO)
├── scripts/
│   ├── deploy.js        # Deploy faucet to Ghostnet via Taquito
│   └── fund.js          # Top up the faucet from an admin key
├── index.html
└── package.json
```

## The onboarding flow

1. Visitor lands → one button: **Enter with Kukai**
2. Beacon opens Kukai — user signs in with Google/Twitter/etc. A wallet exists. No seed phrase shown, no jargon.
3. App checks balance. If the wallet is fresh (below threshold), it calls the faucet's `claim` entrypoint via a relayer or shows a one-tap claim.
4. Wallet now has ~0.5 tez — enough for dozens of operations. The user can *do things* immediately.
5. Everything the user does from here is written against this address: the wallet-as-passport begins.

## Quick start

```bash
npm install
npm run dev          # Vite dev server, points at Ghostnet
```

Deploy your own faucet:

```bash
# Compile the contract (needs ligo — docker one-liner below)
docker run --rm -v "$PWD":"$PWD" -w "$PWD" ligolang/ligo:1.6.0 \
  compile contract contracts/faucet.jsligo -o contracts/faucet.tz

# Deploy to Ghostnet (set ADMIN_KEY in .env — get free testnet tez from https://faucet.ghostnet.teztnets.com)
node scripts/deploy.js

# Fund it
node scripts/fund.js 10   # sends 10 tez to the faucet
```

> Verified: compiles clean with LIGO **1.15.6** (any 1.x should work; expect only `Tezos` → `Tezos.Next` deprecation warnings). No docker on your machine? A static `ligo` binary works the same: `ligo compile contract <file> -o <out>`.

Then set `VITE_FAUCET_ADDRESS` in `.env` and restart the dev server.

## Design decisions (and why)

- **Kukai first.** DirectAuth social login is the lowest-friction wallet on any chain. Beacon means Temple/Umami users connect too, for free.
- **Faucet is a contract, not a backend.** The seeding logic (one claim per address, claim amount, cooldown) lives on-chain and is auditable. The only trust is that the admin keeps it funded.
- **Claim-once-per-address** with a small amount. Sybil resistance here is deliberately weak — this is a Ghostnet/onboarding pattern, not a mainnet money spigot. For mainnet, gate `claim` behind a verificational (see tez-stamps) or a relayer with its own checks.
- **Ghostnet by default.** Flip `NETWORK` in `.env` for mainnet.

## Composing forward

The point of seeding a wallet is what happens next. The faucet emits nothing but tez — the follow-on templates give the wallet things to *earn*: stamps (FA2 soulbound-ish tokens for completed tasks), and eventually generative collectibles whose traits derive from that stamp history.

## License

CC0. Proliferate.

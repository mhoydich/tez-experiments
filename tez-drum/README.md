# tez-drum — rung 07

**DRUM: the fungible token you earn by drumming.**

Hit the drum. Every hit is a token. The drum is instant (synthesized sound +
a local counter); a run of taps settles as **one** on-chain mint. Solo to
start — the whole town shares a lifetime tap counter, so multiplayer is a
short hop from here.

This is the ladder's first *fungible* FA2 (stamps are soulbound, nouns are
NFTs). Permissionless self-mint: the drum is the faucet, there is no admin.

```
tap tap tap tap  →  [ claim 4 DRUM ]  →  1 wallet op  →  balance +4 🥁
```

## Contract — `contracts/drum.jsligo`

TZIP-12 FA2, single fungible token (`token_id 0`), fully transferable.

| entrypoint | who | effect |
|---|---|---|
| `mint(count)` | anyone | sender mints `count` DRUM to itself (the batch-claim) |
| `transfer` | holder / operator | standard FA2 fungible transfer |
| `balance_of` | anyone | standard FA2 callback |
| `update_operators` | owner | standard FA2 operator management |

Views: `balance(addr) → nat`, `total_taps() → nat`. Storage also tracks
`total_supply` and `drummers` (distinct minters) for legibility.

## Deployed

- **Mainnet (live):** `KT1P2F1MoWPLZBSgTG6bVtQgLaHu1vDShhME`
  ([tzkt](https://tzkt.io/KT1P2F1MoWPLZBSgTG6bVtQgLaHu1vDShhME)) —
  site at **https://tez-drum.pages.dev**
- **Shadownet (dev copy):** `KT1DrTZ69a7T81fZpFeKpsCMLb2AhEYdAAEs`
  ([tzkt](https://shadownet.tzkt.io/KT1DrTZ69a7T81fZpFeKpsCMLb2AhEYdAAEs))

## Build / deploy

```bash
# compile (Lima LIGO wrapper; guest mounts $HOME read-only, so redirect host-side)
ligo compile contract contracts/drum.jsligo > contracts/drum.tz

# originate (default Shadownet; reveals the key first, then originates)
npm install
npm run deploy                       # writes the KT1 to stdout → put in .env

# prove the on-chain half (mint a 7-tap session, read the balance back)
npm run smoke                        # ✅ SMOKE PASS — the drum mints.
```

`.env` holds the Shadownet deploy key + RPC/indexer (gitignored; shape in
`.env.example`). `.tz` is gitignored by design — recompile, don't commit.

## Frontend — `public/index.html`

One self-contained file. No build step: Beacon loads from CDN as the global
`beacon` (the thasher.xyz pattern), balances read from TzKT, sound is
synthesized live with WebAudio. Passport-office design set (paper dot-grid,
ink borders, hard offset shadows, stamp red + tezos blue).

- **Auth:** Beacon `DAppClient` → Kukai / Temple / Umami / Plenty. Taps save
  to `localStorage` until you connect, so nothing is lost pre-login.
- **Claim:** `requestOperation` with a single `TRANSACTION` calling
  `mint` with `{ int: "<count>" }`. No Taquito bundled — pure Beacon.
- **Network:** flip `const ACTIVE` at the top of the `<script>` between
  `'shadownet'` and `'mainnet'`.

Serve locally with any static server (e.g. `npx serve public`) or deploy:

```bash
npx wrangler pages deploy public --project-name=tez-drum
```

## Mainnet (done)

Originated 2026-07-12 with the shared ladder key (`tz1XgXN2…`, already
mainnet-funded — same key stamps/nouns/rally shipped with). The frontend has
`const ACTIVE = 'mainnet'` and `NETWORKS.mainnet.kt1` set; redeploy with
`npx wrangler pages deploy public --project-name=tez-drum`.

Kukai web is mainnet-only (custom networks throw "Network Error"), which is
why the live site points here.

CC0.

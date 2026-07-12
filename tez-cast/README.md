# tez-cast

A personal page for any Tezos wallet — and the tower it broadcasts from.

**Deployed (MAINNET)**: cast tower `KT1NgPnaHLtZ2cNpb2hWGDxFH9fUCABaiaE1`
— live at [tez-cast.pages.dev](https://tez-cast.pages.dev)

**Deployed (Shadownet)**: cast tower `KT1Di5ZR1fEsUqQfvtEnkcurRH9DrMiBhqgp`

Paste any address and get a page: balance sparkline, activity pulse,
soulbound stamps, on-chain nouns, postcards received, token holdings.
Connect your own wallet and the page grows a transmitter: publish short
casts (note / link / art) to an append-only, admin-less contract. No
delete, no edit — a broadcast tower, not a moderated feed.

## The contract

`contracts/cast.jsligo` — one entrypoint, two views:

- `cast(kind, body)` — append a cast; body is raw utf8 bytes (emoji-safe),
  kind is a nat the site interprets (0 note, 1 link, 2 art)
- `cast_count()` — total casts ever
- `author_count(address)` — casts by one author, so other contracts can
  gate on "has broadcast at least N times" (same pattern as stamps)

## Run it

```
npm install
npm run dev
```

Reads are indexer-only (TzKT) — the Taquito/Beacon stack lazy-loads only
when someone connects. Set addresses in `.env` (see `.env.example`);
leave a sibling contract blank to hide its section.

## Deploy the contract

```
ligo compile contract contracts/cast.jsligo > contracts/cast.tz
npm run deploy                        # originates with ADMIN_KEY on RPC
node scripts/send-cast.js "hello" 0   # CLI cast for testing
```

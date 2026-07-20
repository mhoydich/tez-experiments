# tez-reservoir — the compute susu

Rung 09 of the tez-experiments ladder. The fountain splits water; the
reservoir **stores it against a dry season**.

A club that pools small dues into secured compute — frontier API credits,
decentralized GPU-hours, someday club nodes. Founding note:
[An Update for Understanding: Compute](https://hoydich.wordpress.com/2026/07/20/an-update-for-understanding-compute/).

## The mechanic

1. `join(memo)` — send at least `dues` (1ꜩ at genesis) to take a **seat**.
   Seats are soulbound by construction: your membership is your address in
   the roll; there is nothing to transfer. Join order is your seat number,
   forever.
2. `fill(memo)` — members pour any amount into the pool whenever they like.
3. `draw(to_, amount, memo)` — the **council** converts pool into compute.
   Every draw carries a memo saying what it bought ("openrouter credits,
   july" / "akash h100 block"). Memos ride in call params and are read back
   off the indexer — zero storage, open books forever.
4. `set_dues` / `set_council` / `set_delegate` — council knobs. The council
   seat starts as the deploy key and migrates toward a k-of-n TzSafe;
   `set_delegate` lets the reservoir stake while it stores.

Views: `read_member(address)`, `reservoir()` (seats / dues / pooled /
drawn / draws / held).

## Honest weaknesses (template-grade, documented not hidden)

- **The council can drain the pool.** That is the mechanic: a susu is trust
  in the organizer, with open books. The ledger shows every draw and its
  memo; membership is a bet that the council buys compute, not exits. The
  migration path to a multisig council exists precisely to shrink this.
- No refund valve in rung one. The council can always rain the pool back
  with draws; the ledger shows whether it did.
- The water level (`held / total_pooled`) assumes no external deposits;
  a stray donation to the KT1 reads as extra water. Charming, harmless.

## Addresses

| net | address | notes |
|---|---|---|
| Mainnet | `KT1CRqDyvGLWmzSGiokGE58USLf3R1nLMxTT` | live at tez-reservoir.pages.dev · council = Mike's Kukai tz2 |
| Shadownet | `KT1KF2w3HzQhbs4QWaRFtfWMZxeGqSBVoF5Y` | dev copy, smoke-tested (all guards + draw + views) |

Compiler: LIGO 1.15.6 (jsLIGO),
`ligo compile contract contracts/reservoir.jsligo > contracts/reservoir.tz`
(`.tz` gitignored by design — recompile).

Frontend: single-file `public/index.html` — CDN Beacon 4.5.1 (Kukai/Temple),
TzKT-only reads, no build step. The tank's water level is
`held / total_pooled`: the blue is still stored; the rest went through the
valve and became compute. Deploy:
`npx wrangler pages deploy public --project-name=tez-reservoir`.

## Dev

```
cp .env.example .env       # add ADMIN_KEY (never commit)
npm install
npm run deploy             # originate (RPC in .env; Shadownet default)
npm run smoke              # joins + fills + guards + council draw + views
```

CC0. El Segundo.

# TRAITS.md — Activity-Derived Traits for tez-nouns

This is the bridge spec between `tez-stamps` and `tez-nouns` (template #3).
Ethereum Nouns assign traits from block-hash randomness: a Noun is a lottery
ticket. Tezos nouns derive some traits from what the minting wallet has
*done*: a noun is a rendered résumé.

## Trait slots

Keep the Nouns anatomy (it's CC0 — proliferate) but split slots by origin:

| Slot       | Origin     | Notes |
|------------|-----------|-------|
| background | random    | keep some lottery — scarcity still matters |
| body       | random    | |
| glasses    | random    | the sacred slot; never earned, always noggles |
| head       | random    | |
| accessory  | **earned** | derived from the wallet's stamp set at mint |
| aura       | **living** | new slot, unique to Tezos; mutable post-mint |

## Earned traits (accessory slot)

At mint, the contract (or the mint view) reads the stamps registry:

```
accessory = f(stamps held by minter)
```

Deterministic mapping, published on-chain so it's auditable:

- holds `first-steps` stamp only → plain accessory pool
- holds ≥3 education stamps → "scholar" accessory pool
- holds `drum` lineage stamps → drumsticks / drum accessory pool
- holds a baker-delegation stamp → "validator" accessory pool
- collision rule: highest-rarity qualifying pool wins; ties → seed random within union

Design constraint: earned pools must be *legible* — someone looking at the
noun should be able to guess roughly what its wallet did. That legibility is
the whole point.

## Living traits (aura slot)

TZIP-21 metadata is updatable, so the aura can change after mint:

- **decay**: aura dims after N cycles of wallet inactivity; brightens on activity
- **seasonal**: community vote (or admin, early on) rotates the seasonal palette
- **granted**: a DAO proposal can award an aura to a noun (on-chain merit badge)

Mutability rules live in the contract, not in an off-chain server: which
addresses can call `update_aura`, under what conditions, is auditable.
The token URI points at an on-chain view that composes the SVG live, so
there is no stale IPFS image to invalidate.

## Rendering

Follow Nouns' RLE-compressed on-chain art approach, adapted:

1. Trait art stored as RLE-packed bytes in a descriptor contract (Tezos
   storage is cheap enough that this is comfortable).
2. An off-chain view (`get_svg(token_id)`) decompresses and composes SVG
   rects, layering: background → body → accessory → head → glasses → aura.
3. `token_metadata` view returns TZIP-21 metadata with a data-URI SVG, so
   marketplaces/objkt render it with zero external dependencies.

## Cadence (open design dial)

"One per day" is a choice, not a law. Candidate cadences to prototype:

- **daily auction** — faithful port, treasury accrual, governance later
- **milestone mint** — a noun mints when the community completes a collective
  task (total stamps crosses a threshold); auctioned or awarded
- **personal mint** — each wallet may mint exactly one noun, but only after
  earning a qualifying stamp set (the noun as graduation portrait)

These aren't exclusive — the personal mint can coexist with a daily auction
line, distinguished by a series field in metadata.

## Anti-goals

- No trait pay-to-win: traits derive from stamps, stamps derive from doing.
  If a stamp can be bought, its trait pool should be visually plain.
- No off-chain trait oracle. If the mapping can't be expressed as a function
  of on-chain state, it doesn't become a trait.
- Don't break the silhouette. It should read as nounish at a glance.

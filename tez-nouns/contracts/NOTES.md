# Contract notes

## Views on tez-stamps — DONE

tez-nouns derives traits by calling on-chain views on the stamps registry.
`has_stamp` and `stamp_count` now live in `tez-stamps/contracts/stamps.jsligo`
(bottom of the file) and compile clean under LIGO 1.15.6. Signatures:

```jsligo
has_stamp   : (p: [address, nat]) => bool   // matches Tezos.call_view in nouns.jsligo
stamp_count : (who: address) => nat         // iterates token_ids 0..31
```

## Randomness caveat

`roll()` hashes (timestamp, sender, id). A block producer can grind
timestamps within bounds; acceptable for cosmetic traits, unacceptable for
anything with meaningful monetary variance. If auction nouns get valuable,
move to a commit-reveal or randomness beacon before mainnet.

## Missing on purpose (template scope)

- Auction house contract (wire a standard English auction; admin-mint until then)
- balance_of / update_operators FA2 plumbing (copy from tez-stamps, invert soulbound)
- token_metadata view emitting TZIP-21 with data-URI SVG — src/metadata.js
  shows the exact shape; porting it into a view is straightforward once art
  is final

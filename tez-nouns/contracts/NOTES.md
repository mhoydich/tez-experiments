# Contract notes

## Views to add to tez-stamps

tez-nouns derives traits by calling on-chain views on the stamps registry.
Add these to `tez-stamps/contracts/stamps.jsligo`:

```jsligo
@view
const has_stamp = (p: [address, nat], s: storage): bool =>
  Big_map.mem([p[0], p[1]], s.ledger);

@view
const stamp_count = (who: address, s: storage): nat => {
  // template shortcut: iterate known type range; fine for small registries
  let n = 0n; let i = 0n;
  while (i < 32n) {
    if (Big_map.mem([who, i], s.ledger)) n = n + 1n;
    i = i + 1n;
  };
  return n;
};
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

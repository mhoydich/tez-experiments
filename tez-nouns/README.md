# tez-nouns

**Deployed (Shadownet)**: `KT1JzbnZM6FJ9JqLvg3i6szb29dPRAMyrNM9` (LIGO
1.15.6), wired to stamps registry `KT1MSMyZDAhhNN7TLHoZYttRBfpURnnzgg3P`,
qualifying stamp id 0. Art uploaded (scripts/upload-art.js); noun #0 minted; token_metadata view verified on-chain (valid TZIP-21 JSON + 8.3KB SVG).

Template #3 in the tez-experiments series. A clean-room, CC0 Nouns-style
protocol for Tezos where some traits are **earned**, not rolled.

Ethereum Nouns are provenance objects — traits frozen at mint from block-hash
randomness. Tezos nouns are activity objects: the accessory slot derives from
the stamps the minting wallet holds (see `tez-stamps`), and a new **aura**
slot stays alive after mint. The noun is a rendered résumé.

Implements the design in `tez-stamps/TRAITS.md`.

## Trait slots

| slot       | origin  | source of truth |
|------------|---------|-----------------|
| background | random  | seed at mint |
| body       | random  | seed at mint |
| head       | random  | seed at mint |
| glasses    | random  | seed at mint — the sacred slot, always noggles |
| accessory  | earned  | on-chain view into the stamps registry at mint |
| aura       | living  | mutable post-mint under contract rules |

## Architecture

```
tez-nouns/
├── contracts/
│   └── nouns.jsligo       # FA2 NFT: mint, seeds, earned-trait derivation,
│                          #   aura lifecycle, art big_map (RLE bytes)
├── art/
│   └── manifest.json      # trait inventory: names, pools, RLE payloads
├── src/
│   ├── render.js          # RLE → SVG composer (reads art from chain)
│   └── metadata.js        # TZIP-21 token metadata w/ data-URI SVG
├── scripts/
│   ├── deploy.js
│   ├── upload-art.js      # writes RLE payloads into the art big_map
│   └── mint.js
└── README.md
```

**Art storage**: RLE-compressed trait bitmaps live on-chain in an `art`
big_map (Tezos storage is cheap enough for this). **Composition** happens in
`src/render.js`, which reads the bytes from chain and emits layered SVG
rects — the same split Nouns uses (descriptor on-chain, rendering wherever).
Everything needed to reproduce the image forever is on-chain; no IPFS.

**Earned traits**: at mint, the contract calls on-chain **views** on the
stamps registry (`has_stamp`, `stamp_count`) and maps the result to an
accessory pool via an auditable on-chain rule table. Add the views to your
stamps contract with the snippet in `contracts/NOTES.md`.

**Aura**: starts `bright`. `poke` refreshes it (any tx from the owner);
`decay` can be cranked by anyone if the owner has been inactive for N cycles
(keeper-style, permissionless). `grant_aura` is admin/DAO-gated.

## Cadence

`mint` supports two coexisting series (see TRAITS.md):

- **personal** — one per wallet, gated on a qualifying stamp set. The
  graduation portrait.
- **auction** — admin/auction-house mints to the winner. Auction contract
  itself is deliberately out of scope for the template; wire in a standard
  English auction or start with scheduled admin mints.

## Quick start

```bash
npm install
docker run --rm -v "$PWD":"$PWD" -w "$PWD" ligolang/ligo:1.6.0 \
  compile contract contracts/nouns.jsligo -o contracts/nouns.tz
node scripts/deploy.js
node scripts/upload-art.js art/manifest.json
node scripts/mint.js personal          # mints yours, if your stamps qualify
node src/render.js 0 > noun-0.svg      # render token 0 locally
```

> Verified: compiles clean with LIGO **1.15.6** (any 1.x should work; expect only `Tezos` → `Tezos.Next` deprecation warnings). No docker on your machine? A static `ligo` binary works the same: `ligo compile contract <file> -o <out>`.

`art/manifest.json` ships with a tiny placeholder set (4 backgrounds, 2
bodies, 2 heads, 1 glasses, 4 accessories, 3 auras) so the pipeline runs
end-to-end. Swap in real 32×32 art; the original Nouns art is CC0 if you
want to start from the source anatomy.

## Anti-goals (inherited from TRAITS.md)

- No purchasable participation → visually plain pools for buyable stamps
- No off-chain trait oracle — if it isn't a function of on-chain state, it
  isn't a trait
- Don't break the silhouette

## License

CC0. Proliferate.

// TZIP-21 token metadata with a data-URI SVG — the shape a token_metadata
// view should return once art is final.
import { composeSVG } from "./render.js";

export function tokenMetadata(id, seed, series) {
  const svg = composeSVG(seed);
  return {
    name: `Tez Noun ${id}`,
    description: "One noun, earned. Accessory derives from the minter's stamps; aura is alive.",
    decimals: 0,
    isBooleanAmount: true,
    artifactUri: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    attributes: [
      { name: "series", value: series },
      ...Object.entries(seed).map(([k, v]) => ({ name: k, value: String(v) })),
    ],
  };
}

export const KT1_PATTERN = /^KT1[1-9A-HJ-NP-Za-km-z]{33}$/;

const susuDescription =
  "The savings circle (ROSCA/susu/tanda) on Tezos. N neighbors pay a fixed contribution each round; every round one member takes the whole pot, in join order, until everyone has had a turn. No house, no chance — just turns. tez-susu — rung 08 of the tez-experiments ladder. Printed at tez-susu.pages.dev.";
const fountainDescription =
  "Toss one-tez coins with a wish; every epoch the fountain overflows and the pot splits evenly among that epoch's tossers. Toss once, your coin comes back. Toss five times, you watered the square. No house, no chance — a mirror with a delay. tez-susu — rung 08 of the tez-experiments ladder. Printed at tez-susu.pages.dev.";
const stampDescription =
  "a ledger of kept promises — soulbound proof of completed savings circles. Printed at tez-susu.pages.dev.";
const common = {
  version: "0.1.0",
  license: { name: "CC0-1.0" },
  homepage: "https://tez-susu.pages.dev",
};

export const utf8Hex = (value) => Array.from(new TextEncoder().encode(value))
  .map((byte) => byte.toString(16).padStart(2, "0")).join("");
const int = (value) => ({ int: String(value) });
const metadata = (content) => [
  { prim: "Elt", args: [{ string: "" }, { bytes: utf8Hex("tezos-storage:content") }] },
  { prim: "Elt", args: [{ string: "content" }, { bytes: utf8Hex(JSON.stringify(content)) }] },
];

// Compiled order: circles, next_id, circles_opened, rounds_settled, volume, metadata.
export function buildSusuStorage(name) {
  return {
    prim: "Pair",
    args: [
      [], int(0), int(0), int(0), int(0),
      metadata({ name: `${name} — a susu house`, description: susuDescription, ...common }),
    ],
  };
}

// Compiled order: epoch, epoch_len, epoch_end, pot, tossers, tosser_count,
// coins, overflows, volume, metadata.
export function buildFountainStorage(name, epochLen, now = Math.floor(Date.now() / 1000)) {
  if (!Number.isSafeInteger(epochLen) || epochLen <= 0) throw new Error("epoch length must be positive");
  return {
    prim: "Pair",
    args: [
      int(0), int(epochLen), int(now + epochLen), int(0), [], int(0), int(0), int(0), int(0),
      metadata({ name, description: fountainDescription, ...common }),
    ],
  };
}

// Compiled order: house, claimed, counts, finishers, stamps, metadata.
export function buildMadeWholeStorage(house, name) {
  if (!KT1_PATTERN.test(house)) throw new Error("house must be a KT1 address");
  return {
    prim: "Pair",
    args: [
      { string: house }, [], [], int(0), int(0),
      metadata({ name: `${name} — made whole`, description: stampDescription, ...common }),
    ],
  };
}

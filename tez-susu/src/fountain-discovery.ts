import {
  fountainAddress,
  operationHashPattern,
  parseFountainReceipt,
  readFountainReceipt,
  type FountainReceipt,
} from "./share-fountain";

const mainnetIndexer = "https://api.tzkt.io";
const maximumResults = 18;
const candidateLimit = 24;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const boundedLimit = (requested: number): number => {
  if (!Number.isFinite(requested)) return maximumResults;
  return Math.min(maximumResults, Math.max(1, Math.trunc(requested)));
};

/**
 * Read a bounded, newest-first set of Fountain tosses.
 *
 * The listing response is only candidate discovery. Every operation hash is
 * read again through readFountainReceipt so the public surfaces inherit its
 * full operation-group checks: one unambiguous external, applied, exact-one-
 * tez `toss` addressed to the configured Fountain.
 */
export async function readRecentFountainReceipts(
  env: Env,
  requestedLimit = maximumResults,
): Promise<FountainReceipt[]> {
  const limit = boundedLimit(requestedLimit);
  const fountain = fountainAddress(env);
  const indexer = (env.INDEXER || mainnetIndexer).replace(/\/+$/, "");
  const query = new URLSearchParams({
    target: fountain,
    entrypoint: "toss",
    status: "applied",
    limit: String(candidateLimit),
    "sort.desc": "id",
  });
  const response = await fetch(`${indexer}/v1/operations/transactions?${query}`, {
    headers: { Accept: "application/json" },
  });
  if (response.status === 204) return [];
  if (!response.ok) throw new Error(`TzKT returned ${response.status}`);

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error("TzKT returned an invalid transaction list");

  const hashes: string[] = [];
  const seen = new Set<string>();
  for (const candidate of payload) {
    if (!isRecord(candidate) || typeof candidate.hash !== "string") continue;
    const hash = candidate.hash;
    if (seen.has(hash) || !operationHashPattern.test(hash)) continue;

    // Reject obviously unsafe list rows before spending a detail subrequest.
    // The second, whole-operation-group validation below remains authoritative.
    if (!parseFountainReceipt([candidate], hash, fountain)) continue;
    seen.add(hash);
    hashes.push(hash);
    if (hashes.length >= candidateLimit) break;
  }

  const settled = await Promise.allSettled(
    hashes.map((hash) => readFountainReceipt(hash, env)),
  );
  const receipts = settled
    .filter((result): result is PromiseFulfilledResult<FountainReceipt | null> => result.status === "fulfilled")
    .map((result) => result.value)
    .filter((receipt): receipt is FountainReceipt => receipt !== null)
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .slice(0, limit);

  // Do not turn an indexer outage into a misleading, cacheable empty feed.
  if (receipts.length === 0 && settled.some((result) => result.status === "rejected")) {
    throw new Error("TzKT receipt validation failed");
  }
  return receipts;
}

export const recentFountainReceiptLimit = maximumResults;

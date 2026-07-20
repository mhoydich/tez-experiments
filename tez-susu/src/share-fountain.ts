const mainnetIndexer = "https://api.tzkt.io";

export const siteOrigin = "https://tez-susu.pages.dev";
export const operationHashPattern = /^o[1-9A-HJ-NP-Za-km-z]{50}$/;
const kt1Pattern = /^KT1[1-9A-HJ-NP-Za-km-z]{33}$/;

const maxDecodedWishBytes = 65_536;

export type FountainReceipt = {
  hash: string;
  sender: string;
  target: string;
  timestamp: string;
  wish: string;
  wishReadable: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const addressOf = (value: unknown): string | null => {
  if (!isRecord(value) || typeof value.address !== "string" || value.address.length === 0) return null;
  return value.address;
};

const bytesOf = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (isRecord(value) && typeof value.bytes === "string") return value.bytes;
  return null;
};

export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;",
})[char] || char);

export const truncateText = (value: string, maximum: number): string => {
  const characters = Array.from(value);
  if (characters.length <= maximum) return value;
  return `${characters.slice(0, Math.max(0, maximum - 1)).join("")}…`;
};

export const decodeWishBytes = (hex: string): { text: string; readable: boolean } => {
  if (
    hex.length % 2 !== 0
    || hex.length / 2 > maxDecodedWishBytes
    || !/^[0-9a-f]*$/i.test(hex)
  ) {
    return { text: "", readable: false };
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }

  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const safeText = decoded
      .replace(/\r\n?/g, "\n")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "�");
    return { text: safeText, readable: true };
  } catch {
    return { text: "", readable: false };
  }
};

export const fountainAddress = (env: Env): string => {
  const configured = env.FOUNTAIN?.trim() || "";
  if (!configured) throw new Error("FOUNTAIN must be configured explicitly");
  if (!kt1Pattern.test(configured)) throw new Error("FOUNTAIN is not a valid KT1 address");
  return configured;
};

export const parseFountainReceipt = (
  payload: unknown,
  hash: string,
  fountain: string,
): FountainReceipt | null => {
  if (!operationHashPattern.test(hash) || !Array.isArray(payload)) return null;

  const tosses = payload.filter((value): value is Record<string, unknown> => {
    // TzKT omits `nonce` on external transactions and uses a numeric nonce on
    // internal transactions. Accept omitted/null; reject only a present nonce.
    if (!isRecord(value) || value.type !== "transaction" || value.hash !== hash || value.nonce != null) return false;
    if (!isRecord(value.parameter) || value.parameter.entrypoint !== "toss") return false;
    return true;
  });

  // An operation group can contain overflow + toss, but a hash containing two
  // tosses is ambiguous. Refuse to invent which coin the receipt represents.
  if (tosses.length !== 1) return null;

  const transaction = tosses[0];
  if (transaction.status !== "applied") return null;
  if (transaction.amount !== 1_000_000 && transaction.amount !== "1000000") return null;
  if (addressOf(transaction.target) !== fountain) return null;

  const sender = addressOf(transaction.sender);
  const timestamp = transaction.timestamp;
  const parameter = transaction.parameter;
  const wishHex = isRecord(parameter) ? bytesOf(parameter.value) : null;
  if (!sender || typeof timestamp !== "string" || Number.isNaN(Date.parse(timestamp)) || wishHex === null) {
    return null;
  }

  const decoded = decodeWishBytes(wishHex);
  return {
    hash,
    sender,
    target: fountain,
    timestamp,
    wish: decoded.text,
    wishReadable: decoded.readable,
  };
};

export async function readFountainReceipt(hash: string, env: Env): Promise<FountainReceipt | null> {
  if (!operationHashPattern.test(hash)) return null;

  const fountain = fountainAddress(env);
  const indexer = (env.INDEXER || mainnetIndexer).replace(/\/+$/, "");
  const response = await fetch(`${indexer}/v1/operations/transactions/${encodeURIComponent(hash)}`, {
    headers: { Accept: "application/json" },
  });
  if (response.status === 204 || response.status === 404) return null;
  if (!response.ok) throw new Error(`TzKT returned ${response.status}`);

  // One Tezos operation group is protocol-bounded, so this JSON response is
  // small enough to validate in memory before rendering any public content.
  const payload: unknown = await response.json();
  return parseFountainReceipt(payload, hash, fountain);
}

export const receiptWish = (receipt: FountainReceipt): string => {
  if (!receipt.wishReadable) return "a wish written in unreadable bytes";
  return receipt.wish.trim() || "a silent coin";
};

export const formatReceiptTime = (timestamp: string): string => new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
}).format(new Date(timestamp));

export const shortenAddress = (address: string): string =>
  address.length > 15 ? `${address.slice(0, 8)}…${address.slice(-6)}` : address;

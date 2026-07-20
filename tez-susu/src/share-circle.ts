const mainnetIndexer = "https://api.tzkt.io";
const mainnetHouse = "KT19HJaK1hNmc337yv6DM4ZfYyPPQnzj277G";
export const kt1Pattern = /^KT1[1-9A-HJ-NP-Za-km-z]{33}$/;

export const siteOrigin = "https://tez-susu.pages.dev";

export type Circle = {
  name: string;
  status: string;
  seats: number;
  joined: number;
  round: number;
  contribution: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const textField = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  if (typeof value === "string" || typeof value === "number") return String(value);
  throw new Error(`circle field ${key} is missing`);
};

const natField = (record: Record<string, unknown>, key: string): number => {
  const value = Number(textField(record, key));
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`circle field ${key} is invalid`);
  return value;
};

export const decodeHex = (hex: string): string => {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) return "(unreadable circle name)";
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return new TextDecoder().decode(bytes);
};

export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;",
})[char] || char);

export const normalizeStatus = (value: unknown): string => {
  if (typeof value === "string") return value.toLowerCase();
  if (isRecord(value)) return (Object.keys(value)[0] || "unknown").toLowerCase();
  return "unknown";
};

export const formatTez = (mutez: string): string => {
  const tez = Number(mutez) / 1_000_000;
  if (!Number.isFinite(tez)) return "0";
  return tez.toLocaleString("en-US", { maximumFractionDigits: 6, useGrouping: false });
};

export const circleDescription = (circle: Circle): string => {
  const amount = `${formatTez(circle.contribution)}ꜩ a round`;
  if (circle.status === "recruiting") {
    return `recruiting · ${circle.joined}/${circle.seats} seats · ${amount} · join order is payout order`;
  }
  if (circle.status === "active") {
    return `active · round ${Math.min(circle.round + 1, circle.seats)} of ${circle.seats} · ${amount} · pot goes around`;
  }
  if (circle.status === "done") {
    return `done · ${circle.joined}/${circle.seats} seats · ${amount} · everyone made whole`;
  }
  if (circle.status === "disbanded") {
    return `disbanded · ${circle.joined}/${circle.seats} seats · ${amount} · the circle broke up`;
  }
  return `${circle.status} · ${circle.joined}/${circle.seats} seats · ${amount}`;
};

export async function readCircle(id: string, env: Env, houseOverride = ""): Promise<Circle | null> {
  if (!/^\d+$/.test(id)) return null;
  const indexer = (env.INDEXER || mainnetIndexer).replace(/\/+$/, "");
  const house = kt1Pattern.test(houseOverride) ? houseOverride : env.HOUSE || mainnetHouse;
  const url = `${indexer}/v1/contracts/${encodeURIComponent(house)}/bigmaps/circles/keys/${id}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (response.status === 204 || response.status === 404) return null;
  if (!response.ok) throw new Error(`TzKT returned ${response.status}`);

  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isRecord(payload.value)) throw new Error("TzKT returned an invalid circle");
  const value = payload.value;
  return {
    name: decodeHex(textField(value, "name")),
    status: normalizeStatus(value.status),
    seats: natField(value, "seats"),
    joined: natField(value, "joined"),
    round: natField(value, "round"),
    contribution: textField(value, "contribution"),
  };
}

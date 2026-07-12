// The geoconfirm oracle. POST {address, lat, lon} → if the position is
// inside a court's fence, signs the passport voucher the contract expects:
// pack([visitor, venue_id, unix_day, courts_contract]) with ORACLE_KEY.
// Honest limits, on the record: coordinates come from the visitor's browser
// and can be spoofed — this fence keeps the stamp honest-by-default, not
// cheat-proof. Upgrade paths: venue wifi challenge, keeper co-sign.
import { InMemorySigner } from "@taquito/signer";
import { packDataBytes } from "@taquito/michel-codec";

interface Env {
  ORACLE_KEY: string;
}

// Mainnet passport book — keep in sync with scripts/deploy-courts.js
const COURTS = "KT1Q1g8Sv3uL2beaA7h89hTViJyZmXxfUS9D";
const VENUES = [
  { id: 0, name: "California Smash", lat: 33.927222, lon: -118.388066, radius: 180 },
  { id: 1, name: "Hollyglen Park", lat: 33.907488, lon: -118.349555, radius: 160 },
  { id: 2, name: "El Segundo Rec Park", lat: 33.920934, lon: -118.411794, radius: 200 },
];

const metersBetween = (aLat: number, aLon: number, bLat: number, bLon: number) => {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLon = (bLon - aLon) * rad;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { address?: string; lat?: number; lon?: number };
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }
  const { address, lat, lon } = body;
  if (!address || !/^tz[123][A-Za-z0-9]{33}$/.test(address))
    return json({ error: "bad address" }, 400);
  if (typeof lat !== "number" || typeof lon !== "number" || !isFinite(lat) || !isFinite(lon))
    return json({ error: "bad coordinates" }, 400);

  const ranked = VENUES
    .map((v) => ({ ...v, distance: Math.round(metersBetween(lat, lon, v.lat, v.lon)) }))
    .sort((a, b) => a.distance - b.distance);
  const here = ranked[0];
  if (here.distance > here.radius)
    return json({
      error: "not at a court",
      nearest: { id: here.id, name: here.name, distance_m: here.distance, radius_m: here.radius },
    }, 403);

  const day = Math.floor(Date.now() / 86_400_000);
  const data = packDataBytes(
    { prim: "Pair", args: [{ string: address }, { prim: "Pair", args: [
      { int: String(here.id) }, { prim: "Pair", args: [{ int: String(day) }, { string: COURTS }] },
    ] }] },
    { prim: "pair", args: [{ prim: "address" }, { prim: "pair", args: [
      { prim: "nat" }, { prim: "pair", args: [{ prim: "nat" }, { prim: "address" }] },
    ] }] }
  );
  const signer = await InMemorySigner.fromSecretKey(env.ORACLE_KEY);
  const { prefixSig } = await signer.sign(data.bytes);

  return json({
    venue: here.id,
    name: here.name,
    distance_m: here.distance,
    day,
    sig: prefixSig,
  });
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, {
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });

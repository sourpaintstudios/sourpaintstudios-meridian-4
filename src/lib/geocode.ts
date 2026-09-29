import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type Place = {
  id: string;
  name: string;
  detail: string;
  lat: number;
  lng: number;
};

const Input = z.object({
  q: z.string().trim().min(2).max(240),
  skipUs: z.boolean().optional(),
});

/** Commas optional, case does not matter. "Delmar, Iowa" and "delmar iowa" are the same query. */
export function normalizePlaceQuery(q: string) {
  return q
    .trim()
    .replace(/[.,;:/]+/g, " ")
    .replace(/\s+/g, " ");
}

export function parsePostal(q: string): string | null {
  const t = normalizePlaceQuery(q).toUpperCase();
  if (!t) return null;
  const compact = t.replace(/[-\s]/g, "");
  if (/^\d{5}(?:\d{4})?$/.test(compact)) return compact.slice(0, 5);
  if (/^\d{4,8}$/.test(compact)) return compact;
  if (/^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/.test(t)) return t;
  if (/^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/.test(t)) return t;
  if (/^\d{4}\s?[A-Z]{2}$/.test(t)) return t;
  if (/^\d{3}-?\d{4}$/.test(t)) return compact;
  return null;
}

export function parseUsZip(q: string) {
  const postal = parsePostal(q);
  return postal && /^\d{5}$/.test(postal) ? postal : null;
}

type NominatimHit = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  class?: string;
  type?: string;
  addresstype?: string;
};

type OpenMeteoHit = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
};

type ZipPlace = {
  "place name": string;
  longitude: string;
  latitude: string;
  state: string;
  "state abbreviation": string;
};

const STREET_TYPES = new Set([
  "house",
  "yes",
  "residential",
  "unclassified",
  "primary",
  "secondary",
  "tertiary",
  "living_street",
  "pedestrian",
  "road",
  "motorway",
  "trunk",
]);

function uniquePlaces(list: Place[]) {
  const seen = new Set<string>();
  return list.filter((p) => {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return false;
    const key = `${p.lat.toFixed(3)}:${p.lng.toFixed(3)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function tokensOf(q: string) {
  return normalizePlaceQuery(q)
    .toLowerCase()
    .split(" ")
    .filter((t) => t.length >= 2);
}

function scorePlace(p: Place, tokens: string[]) {
  const hay = `${p.name} ${p.detail}`.toLowerCase();
  let s = 0;
  for (const t of tokens) if (hay.includes(t)) s += t.length;
  if (tokens[0] && p.name.toLowerCase().startsWith(tokens[0])) s += 4;
  return s;
}

function rankPlaces(list: Place[], q: string) {
  const tokens = tokensOf(q);
  return uniquePlaces(list).sort((a, b) => scorePlace(b, tokens) - scorePlace(a, tokens));
}

async function timedJson<T>(url: string, init: RequestInit | undefined, ms: number): Promise<T | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const NOMINATIM_HEADERS = {
  Accept: "application/json",
  "User-Agent": "MeridianGlobe/1.0 (https://grok.me; globe visualization)",
};

function fromNominatim(hit: NominatimHit): Place | null {
  if (STREET_TYPES.has(hit.type || "") || STREET_TYPES.has(hit.addresstype || "")) return null;
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id: `n-${hit.place_id}`,
    name: hit.name || hit.display_name.split(",")[0] || hit.display_name,
    detail: hit.display_name,
    lat,
    lng,
  };
}

export async function lookupZip(zip: string): Promise<Place[]> {
  const json = await timedJson<{ "post code": string; places?: ZipPlace[] }>(
    `https://api.zippopotam.us/us/${zip}`,
    undefined,
    6000,
  );
  if (!json?.places?.length) return [];
  return json.places.map((place, i) => ({
    id: `z-${json["post code"]}-${i}`,
    name: place["place name"],
    detail: `${place["place name"]}, ${place["state abbreviation"]} ${json["post code"]}, United States`,
    lat: Number(place.latitude),
    lng: Number(place.longitude),
  }));
}

async function nominatimPostal(code: string): Promise<Place[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("postalcode", code);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "6");
  const json = await timedJson<NominatimHit[]>(url.toString(), { headers: NOMINATIM_HEADERS }, 5000);
  return (json ?? []).map(fromNominatim).filter((p): p is Place => Boolean(p));
}

async function nominatimQuery(q: string, settlement: boolean): Promise<Place[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "6");
  if (settlement) url.searchParams.set("featuretype", "settlement");
  const json = await timedJson<NominatimHit[]>(url.toString(), { headers: NOMINATIM_HEADERS }, 5000);
  return (json ?? []).map(fromNominatim).filter((p): p is Place => Boolean(p));
}

async function openMeteo(q: string): Promise<Place[]> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", q);
  url.searchParams.set("count", "8");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  const json = await timedJson<{ results?: OpenMeteoHit[] }>(url.toString(), undefined, 5000);
  return (json?.results ?? []).map((hit) => ({
    id: `m-${hit.id}`,
    name: hit.name,
    detail: [hit.admin1, hit.country].filter(Boolean).join(", "),
    lat: hit.latitude,
    lng: hit.longitude,
  }));
}

async function openMeteoCities(q: string): Promise<Place[]> {
  const parts = q.split(" ");
  // Full query first. Only fall back to a truncated query (drop the last
  // word) when the full one comes up empty — most searches resolve on the
  // first try, so this avoids firing a second and third request every time.
  const first = await openMeteo(q);
  if (first.length || parts.length < 2) return first;
  return openMeteo(parts.slice(0, -1).join(" "));
}

// Repeat searches (retyping the same city, hitting "Find" twice) shouldn't
// re-hit the network — a place's coordinates don't change. Capped so it
// can't grow unbounded over a long session.
const PLACE_CACHE_LIMIT = 100;
const placeCache = new Map<string, Place[]>();

function cacheGet(key: string): Place[] | undefined {
  const hit = placeCache.get(key);
  if (hit) {
    // refresh recency
    placeCache.delete(key);
    placeCache.set(key, hit);
  }
  return hit;
}

function cacheSet(key: string, value: Place[]) {
  placeCache.set(key, value);
  if (placeCache.size > PLACE_CACHE_LIMIT) {
    const oldest = placeCache.keys().next().value;
    if (oldest !== undefined) placeCache.delete(oldest);
  }
}

export const searchPlaces = createServerFn({ method: "POST" })
  .validator(Input)
  .handler(async ({ data }) => {
    const q = normalizePlaceQuery(data.q);
    const postal = parsePostal(q);
    if (postal) {
      // The client already tried lookupZip for a US 5-digit zip before
      // calling here (see findPlaces below); skipUs avoids repeating that
      // same request a second time when it already came up empty.
      const shouldTryUs = /^\d{5}$/.test(postal) && !data.skipUs;
      const us = shouldTryUs ? lookupZip(postal) : Promise.resolve([] as Place[]);
      // Try the postal-specific search first; only fan out to the looser
      // free-text query if that comes back empty, instead of always paying
      // for both in parallel.
      const [zp, byCode] = await Promise.all([us, nominatimPostal(postal)]);
      let hits = [...zp, ...byCode];
      if (!hits.length) {
        hits = await nominatimQuery(postal, false);
      }
      return rankPlaces(hits, q).slice(0, 8);
    }
    const [cities, named] = await Promise.all([openMeteoCities(q), nominatimQuery(q, true)]);
    let hits = rankPlaces([...named, ...cities], q);
    if (!hits.length) {
      const loose = await nominatimQuery(q, false);
      hits = rankPlaces(loose, q);
    }
    return hits.slice(0, 8);
  });

export async function findPlaces(q: string): Promise<Place[]> {
  const query = normalizePlaceQuery(q);
  const cacheKey = query.toLowerCase();
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const us = parseUsZip(query);
  let triedUs = false;
  if (us) {
    const local = await lookupZip(us);
    triedUs = true;
    if (local.length) {
      cacheSet(cacheKey, local);
      return local;
    }
  }
  const result = await searchPlaces({ data: { q: query, skipUs: triedUs } });
  cacheSet(cacheKey, result);
  return result;
}

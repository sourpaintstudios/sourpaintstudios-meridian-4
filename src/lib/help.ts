import type { Place } from "@/lib/geocode";

export const APP_VERSION = "v4.2 · November 2026";
const KEY = "meridian.resume.v1";
const MAX_MS = 4 * 60 * 60 * 1000;

export type Resume = {
  t: number;
  place: Place | null;
  dateMs: number | null;
  firstPerson: boolean;
  constellations: boolean;
  planets: boolean;
  scientific: boolean;
};

export function saveResume(r: Omit<Resume, "t">) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...r, t: Date.now() }));
  } catch {
    /* ignore */
  }
}

export function readResume(): Resume | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!raw || typeof raw !== "object" || Date.now() - Number(raw.t) > MAX_MS) return null;
    const p = raw.place;
    const place =
      p && typeof p.lat === "number" && typeof p.lng === "number" && typeof p.name === "string" ? (p as Place) : null;
    return {
      t: raw.t,
      place,
      dateMs: typeof raw.dateMs === "number" ? raw.dateMs : null,
      firstPerson: !!raw.firstPerson && !!place,
      constellations: raw.constellations !== false,
      planets: raw.planets !== false,
      scientific: !!raw.scientific,
    };
  } catch {
    return null;
  }
}

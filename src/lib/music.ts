export type Slot = "dawn" | "day" | "dusk" | "night";
export type Mood = "calm" | "bright" | "stately" | "dreamy" | "dark" | "contemplative";

export type Track = {
  id: string;
  composer: string;
  title: string;
  src: string;
  mood: Mood;
  /** Times of day this track suits. */
  slots: Slot[];
};

/**
 * Library. To grow it: drop an mp3 into public/audio and add one line here.
 * Moods and slots are a judgment call, so adjust them freely.
 */
export const CLASSICAL: Track[] = [
  { id: "bach-air", composer: "Bach", title: "Air on the G String", src: "/audio/air-on-the-g-string.mp3", mood: "calm", slots: ["dawn", "dusk"] },
  { id: "satie-1", composer: "Satie", title: "Gymnopédie No. 1", src: "/audio/gymnopedie-1.mp3", mood: "calm", slots: ["dusk", "night"] },
  { id: "satie-2", composer: "Satie", title: "Gymnopédie No. 2", src: "/audio/gymnopedie-2.mp3", mood: "contemplative", slots: ["dusk", "night"] },
  { id: "satie-3", composer: "Satie", title: "Gymnopédie No. 3", src: "/audio/gymnopedie-3.mp3", mood: "dreamy", slots: ["night"] },
  { id: "pachelbel", composer: "Pachelbel", title: "Canon in D", src: "/audio/canon-in-d.mp3", mood: "bright", slots: ["dawn", "day"] },
  { id: "air-prelude", composer: "MacLeod", title: "Air Prelude", src: "/audio/air-prelude.mp3", mood: "calm", slots: ["dawn", "day"] },
  { id: "string-impromptu", composer: "MacLeod", title: "String Impromptu", src: "/audio/string-impromptu.mp3", mood: "bright", slots: ["day"] },
  { id: "virtutes", composer: "MacLeod", title: "Virtutes Instrumenti", src: "/audio/virtutes.mp3", mood: "stately", slots: ["day", "dusk"] },
  { id: "sovereign", composer: "MacLeod", title: "Sovereign", src: "/audio/sovereign.mp3", mood: "stately", slots: ["day", "dusk"] },
  { id: "descent", composer: "MacLeod", title: "The Descent", src: "/audio/the-descent.mp3", mood: "dark", slots: ["night"] },
  { id: "folk-round", composer: "MacLeod", title: "Folk Round", src: "/audio/folk-round.mp3", mood: "bright", slots: ["dawn", "day"] },
  { id: "court", composer: "MacLeod", title: "Court of the Queen", src: "/audio/court-of-the-queen.mp3", mood: "stately", slots: ["dusk"] },
  { id: "dreamy", composer: "MacLeod", title: "Dreamy Flashback", src: "/audio/dreamy-flashback.mp3", mood: "dreamy", slots: ["dusk", "night"] },
  { id: "thinking", composer: "MacLeod", title: "Thinking Music", src: "/audio/thinking-music.mp3", mood: "contemplative", slots: ["day", "night"] },
];

export const SLOT_LABEL: Record<Slot, string> = {
  dawn: "DAWN",
  day: "DAYTIME",
  dusk: "DUSK",
  night: "NIGHT",
};

/** Local clock hour (0–24) at the pinned place, or on the viewer's own clock with no pin. */
export function localHour(date: Date, lng: number | null): number {
  if (lng === null) return date.getHours() + date.getMinutes() / 60;
  const utc = date.getUTCHours() + date.getUTCMinutes() / 60;
  return (((utc + lng / 15) % 24) + 24) % 24;
}

export function slotFor(hour: number): Slot {
  if (hour >= 5 && hour < 9) return "dawn";
  if (hour >= 9 && hour < 17) return "day";
  if (hour >= 17 && hour < 21) return "dusk";
  return "night";
}

/** Next track for a slot (or any slot when null), never repeating the recent ones if avoidable. */
export function pickTrack(slot: Slot | null, recent: string[]): Track {
  const pool = slot ? CLASSICAL.filter((t) => t.slots.includes(slot)) : CLASSICAL;
  const base = pool.length ? pool : CLASSICAL;
  const keep = Math.min(recent.length, Math.max(0, base.length - 1));
  const avoid = new Set(recent.slice(-keep));
  const fresh = base.filter((t) => !avoid.has(t.id));
  const from = fresh.length ? fresh : base;
  return from[Math.floor(Math.random() * from.length)];
}

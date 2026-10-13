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
  // Added from the Grok build library (public-domain compositions).
  { id: "bach-cello", composer: "Bach", title: "Cello Suite No. 1, Prelude", src: "/audio/bach-cello.mp3", mood: "contemplative", slots: ["dawn", "day"] },
  { id: "bach-wtc", composer: "Bach", title: "Prelude in C, WTC I", src: "/audio/bach-wtc.mp3", mood: "calm", slots: ["dawn", "day"] },
  { id: "goldberg-aria", composer: "Bach", title: "Goldberg Variations, Aria", src: "/audio/goldberg-aria.mp3", mood: "contemplative", slots: ["dusk", "night"] },
  { id: "goldberg-13", composer: "Bach", title: "Goldberg Variations, Var. 13", src: "/audio/goldberg-var13.mp3", mood: "dreamy", slots: ["dusk", "night"] },
  { id: "goldberg-25", composer: "Bach", title: "Goldberg Variations, Var. 25", src: "/audio/goldberg-var25.mp3", mood: "dark", slots: ["night"] },
  { id: "mozart-ekn", composer: "Mozart", title: "Eine kleine Nachtmusik", src: "/audio/mozart-ekn.mp3", mood: "bright", slots: ["dawn", "day"] },
  { id: "mozart-allegro", composer: "Mozart", title: "Sonata K.333, Allegro", src: "/audio/mozart-allegro.mp3", mood: "bright", slots: ["day"] },
  { id: "mozart-andante", composer: "Mozart", title: "Sonata K.333, Andante", src: "/audio/mozart-andante.mp3", mood: "calm", slots: ["dusk", "night"] },
  { id: "mozart-rondo", composer: "Mozart", title: "Sonata K.333, Rondo", src: "/audio/mozart-rondo.mp3", mood: "bright", slots: ["day"] },
  { id: "chopin-nocturne", composer: "Chopin", title: "Nocturne in E-flat, Op. 9 No. 2", src: "/audio/chopin-nocturne.mp3", mood: "dreamy", slots: ["dusk", "night"] },
  { id: "chopin-15-1", composer: "Chopin", title: "Nocturne Op. 15 No. 1", src: "/audio/chopin-op15-1.mp3", mood: "dreamy", slots: ["night"] },
  { id: "chopin-15-2", composer: "Chopin", title: "Nocturne Op. 15 No. 2", src: "/audio/chopin-op15.mp3", mood: "contemplative", slots: ["dusk", "night"] },
  { id: "beethoven-adagio", composer: "Beethoven", title: "Pathétique, Adagio cantabile", src: "/audio/beethoven-adagio.mp3", mood: "calm", slots: ["dusk", "night"] },
  { id: "beethoven-grave", composer: "Beethoven", title: "Pathétique, Grave", src: "/audio/beethoven-grave.mp3", mood: "dark", slots: ["night"] },
  { id: "handel-paix", composer: "Handel", title: "La Paix, Royal Fireworks", src: "/audio/handel-paix.mp3", mood: "stately", slots: ["dawn", "day"] },
  { id: "handel-overture", composer: "Handel", title: "Overture, Royal Fireworks", src: "/audio/handel-overture.mp3", mood: "stately", slots: ["day", "dusk"] },
  { id: "handel-rejoice", composer: "Handel", title: "La Réjouissance", src: "/audio/handel-rejoice.mp3", mood: "bright", slots: ["dawn", "day"] },
  { id: "handel-bourree", composer: "Handel", title: "Bourrée, Royal Fireworks", src: "/audio/handel-bourree.mp3", mood: "bright", slots: ["day"] },
  { id: "joplin-maple", composer: "Joplin", title: "Maple Leaf Rag", src: "/audio/joplin-maple.mp3", mood: "bright", slots: ["day"] },
  { id: "tchaik-triste", composer: "Tchaikovsky", title: "Chanson Triste", src: "/audio/ru-tchaik-triste.mp3", mood: "contemplative", slots: ["dusk", "night"] },
  { id: "tchaik-humoresque", composer: "Tchaikovsky", title: "Humoresque", src: "/audio/ru-tchaik-humoresque.mp3", mood: "bright", slots: ["day"] },
  { id: "rimsky-sadko", composer: "Rimsky-Korsakov", title: "Song of India", src: "/audio/ru-rimsky-sadko.mp3", mood: "dreamy", slots: ["dusk", "night"] },
  { id: "granados", composer: "Granados", title: "Spanish Dance", src: "/audio/es-granados.mp3", mood: "stately", slots: ["dusk"] },
  { id: "paloma", composer: "Yradier", title: "La Paloma", src: "/audio/es-paloma.mp3", mood: "calm", slots: ["dusk", "night"] },
  { id: "dvorak", composer: "Dvořák", title: "Songs My Mother Taught Me", src: "/audio/cz-dvorak.mp3", mood: "calm", slots: ["dawn", "dusk"] },
  { id: "grieg", composer: "Grieg", title: "Solveig's Song", src: "/audio/no-grieg.mp3", mood: "contemplative", slots: ["dawn", "night"] },
  { id: "irish", composer: "Traditional", title: "Irish Melodies", src: "/audio/ie-melodies.mp3", mood: "calm", slots: ["dawn", "dusk"] },
  { id: "rosas", composer: "Rosas", title: "Over the Waves", src: "/audio/mx-waves.mp3", mood: "dreamy", slots: ["dusk", "night"] },
  { id: "sole-mio", composer: "di Capua", title: "O Sole Mio", src: "/audio/it-sole.mp3", mood: "bright", slots: ["dawn", "day"] },
  { id: "santa-lucia", composer: "Cottrau", title: "Santa Lucia", src: "/audio/it-lucia.mp3", mood: "calm", slots: ["dusk"] },
  { id: "sakura", composer: "Traditional", title: "Sakura Sakura", src: "/audio/jp-sakura.mp3", mood: "calm", slots: ["dawn", "night"] },
  { id: "tanko", composer: "Traditional", title: "Tankō Bushi", src: "/audio/jp-tanko.mp3", mood: "stately", slots: ["day", "dusk"] },
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
export function pickTrack(slot: Slot | null, recent: string[], composersOnly = false): Track {
  const all = composersOnly ? CLASSICAL.filter((t) => t.composer !== "MacLeod") : CLASSICAL;
  const pool = slot ? all.filter((t) => t.slots.includes(slot)) : all;
  const base = pool.length ? pool : all.length ? all : CLASSICAL;
  const keep = Math.min(recent.length, Math.max(0, base.length - 1));
  const avoid = new Set(recent.slice(-keep));
  const fresh = base.filter((t) => !avoid.has(t.id));
  const from = fresh.length ? fresh : base;
  return from[Math.floor(Math.random() * from.length)];
}

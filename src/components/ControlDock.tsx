import { Calendar, Eraser, LoaderCircle, MapPin, Moon, Search, Sun, Sunrise, Sunset } from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { moonIllumination, moonPosition, phaseLabel, sunPosition, sunTimes, formatClock } from "@/lib/astro";
import { formatDeg, formatLatLng } from "@/lib/geo";
import { findPlaces, parsePostal, type Place } from "@/lib/geocode";
import { cn } from "@/lib/utils";

function toDateTimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ControlDock({
  date,
  onDate,
  place,
  onPlace,
  firstPerson,
  onFirstPerson,
  showConstellations,
  onConstellations,
  showPlanets,
  onPlanets,
  onScientific,
  onHelp,
}: {
  date: Date;
  onDate: (d: Date) => void;
  place: Place | null;
  onPlace: (p: Place) => void;
  firstPerson: boolean;
  onFirstPerson: (v: boolean) => void;
  showConstellations: boolean;
  onConstellations: (v: boolean) => void;
  showPlanets: boolean;
  onPlanets: (v: boolean) => void;
  onScientific: () => void;
  onHelp: () => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const sky = useMemo(() => {
    if (!place) return null;
    const sun = sunPosition(date, place.lat, place.lng);
    const moon = moonPosition(date, place.lat, place.lng);
    const illum = moonIllumination(date);
    const times = sunTimes(date, place.lat, place.lng);
    return { sun, moon, illum, times };
  }, [date, place]);

  const canSearch = Boolean(parsePostal(q) || q.trim().replace(/[.,;:/]+/g, " ").trim().length >= 3);

  async function lookup(e?: FormEvent) {
    e?.preventDefault();
    const query = q.trim();
    if (!canSearch) return;
    setBusy(true);
    setErr(null);
    try {
      const results = await findPlaces(query);
      setHits(results.length > 1 ? results : []);
      if (results[0]) {
        onPlace(results[0]);
        if (results.length === 1) setQ(parsePostal(query) ?? results[0].name);
      } else {
        setErr(parsePostal(query) ? "Postal code not found." : "No match for that place.");
      }
    } catch {
      setErr("Lookup failed. Try a city or postal code.");
    } finally {
      setBusy(false);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }
  }

  const looking =
    firstPerson && sky
      ? sky.sun.altitude > 0
        ? "Standing at the horizon in daylight"
        : sky.moon.altitude > 0
          ? "Standing at the horizon — moon is up"
          : "Standing at the horizon"
      : null;

  return (
    <aside className="pointer-events-auto flex w-[min(100%,11.75rem)] flex-col">
      <div className="paint-panel">
        <div className="flex max-h-[32dvh] flex-col gap-1.5 overflow-y-auto p-1.5 sm:max-h-none">
      <header className="flex flex-col gap-0">
        <p className="text-[8px] font-medium tracking-[0.16em] text-brand uppercase">Sour Paint Studios</p>
        <h1 className="font-display text-[13px] leading-none tracking-tight text-fg">Meridian 4.0</h1>
      </header>

      <form onSubmit={lookup} className="flex flex-col gap-1">
        <label htmlFor="zip" className="sr-only">
          City or postal code
        </label>
        <div className="flex gap-1">
          <div className="relative min-w-0 flex-1">
            <MapPin className="pointer-events-none absolute top-1/2 left-1.5 size-2.5 -translate-y-1/2 text-muted" />
            <Input
              id="zip"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="City or postal code"
              className="h-6 pl-6 text-[11px]"
              autoComplete="off"
              enterKeyHint="search"
              maxLength={48}
            />
          </div>
          <Button type="submit" size="sm" className="h-6 px-1.5 text-[10px] [&_svg]:size-3" disabled={busy || !canSearch} aria-label="Find place">
            {busy ? <LoaderCircle className="animate-spin" /> : <Search />}
            <span className="hidden sm:inline">Find</span>
          </Button>
        </div>
        {err ? <p className="text-[10px] text-danger">{err}</p> : null}
        {hits.length > 1 ? (
          <ul className="paint-chip flex flex-col overflow-hidden">
            {hits.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPlace(hit);
                    setQ(hit.name);
                    setHits([]);
                  }}
                  className={cn(
                    "flex w-full flex-col items-start gap-0 px-1.5 py-1 text-left text-[11px]",
                    "hover:bg-fg/6",
                    place?.id === hit.id ? "bg-fg/8" : "",
                  )}
                >
                  <span className="text-fg">{hit.name}</span>
                  <span className="text-[9px] text-muted">{hit.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </form>

      {place ? (
        <p className="dock-city" title={place.detail}>
          {place.name}
        </p>
      ) : null}

      <div className="flex gap-1">
        <label htmlFor="when" className="sr-only">
          Date and time
        </label>
        <div className="relative min-w-0 flex-1">
          <Calendar className="pointer-events-none absolute top-1/2 left-1.5 size-2.5 -translate-y-1/2 text-muted" />
          <Input
            id="when"
            type="datetime-local"
            value={toDateTimeLocalValue(date)}
            onChange={(e) => {
              if (!e.target.value) return;
              onDate(new Date(e.target.value));
            }}
            suppressHydrationWarning
            className="h-6 pl-6 text-[11px]"
          />
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={() => onDate(new Date())}>
          Now
        </Button>
      </div>

      <Button
        type="button"
        size="sm"
        className="h-6 w-full text-[10px]"
        variant={firstPerson ? "default" : "outline"}
        aria-pressed={firstPerson}
        disabled={!place}
        title={place ? (firstPerson ? "Leave the horizon" : "Stand on the pin") : "Drop a pin first"}
        onClick={() => onFirstPerson(!firstPerson)}
      >
        {firstPerson ? "Back to Earth" : "First Person"}
      </Button>

      <div className="grid grid-cols-2 gap-1">
        <Button
          type="button"
          size="sm"
          className="h-6 px-1 text-[10px]"
          variant={showConstellations ? "default" : "outline"}
          aria-pressed={showConstellations}
          onClick={() => onConstellations(!showConstellations)}
        >
          Constellations
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-6 px-1 text-[10px]"
          variant={showPlanets ? "default" : "outline"}
          aria-pressed={showPlanets}
          onClick={() => onPlanets(!showPlanets)}
        >
          Planets
        </Button>
      </div>

      <Button type="button" size="sm" className="h-6 w-full px-1 text-[10px] [&_svg]:size-3" variant="outline" onClick={onScientific}>
        <Eraser className="size-3" />
        Scientific
      </Button>

      <Button type="button" size="sm" className="h-6 w-full px-1 text-[10px]" variant="outline" onClick={onHelp}>
        How to · About
      </Button>

      {place && sky ? (
        <p className="flex items-center justify-between gap-1 border-t border-border pt-1 font-mono text-[10px] leading-none text-fg">
          <span className="flex items-center gap-0.5">
            <Sunrise className="size-2.5 text-brand" />
            <span className="text-[8px] tracking-wide text-muted uppercase">Rise</span>
            {sky.times.polar === "up"
              ? "all day"
              : sky.times.polar === "down"
                ? "—"
                : sky.times.sunrise
                  ? formatClock(sky.times.sunrise)
                  : "—"}
          </span>
          <span className="flex items-center gap-0.5">
            <Sunset className="size-2.5 text-brand" />
            <span className="text-[8px] tracking-wide text-muted uppercase">Set</span>
            {sky.times.polar === "down"
              ? "all day"
              : sky.times.polar === "up"
                ? "—"
                : sky.times.sunset
                  ? formatClock(sky.times.sunset)
                  : "—"}
          </span>
        </p>
      ) : null}

      {looking ? (
        <p className="text-[10px] leading-snug text-muted">
          {looking}. Drag to look around.
          <span className="mt-0.5 block text-[9px] text-muted-more">
            Sky matches this time and place — daylight, twilight, or night.
          </span>
        </p>
      ) : null}

      {place && sky ? (
        <dl className="grid grid-cols-2 gap-1 border-t border-border pt-1.5">
          <div className="col-span-2">
            <dt className="text-[9px] tracking-wide text-muted uppercase">Pinned</dt>
            <dd className="text-[11px] text-fg">
              {place.name}
              <span className="ml-1 font-mono text-[9px] text-muted">{formatLatLng(place.lat, place.lng)}</span>
            </dd>
          </div>
          <Stat
            icon={<Sun className="size-2.5" />}
            label="Sun"
            value={formatDeg(sky.sun.altitude, "up", "down")}
            sub={`Az ${sky.sun.azimuth.toFixed(0)}°`}
          />
          <Stat
            icon={<Moon className="size-2.5" />}
            label="Moon"
            value={phaseLabel(sky.illum.fraction, sky.illum.angle)}
            sub={`${Math.round(sky.illum.fraction * 100)}% · ${formatDeg(sky.moon.altitude, "up", "down")}`}
          />
          <p className="col-span-2 text-[9px] leading-snug text-muted">
            Gold line on Earth is sunrise / sunset for this pin.
          </p>
        </dl>
      ) : null}
        </div>
      </div>
    </aside>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="paint-chip px-1.5 py-1">
      <dt className="flex items-center gap-0.5 text-[9px] tracking-wide text-muted uppercase">
        {icon}
        {label}
      </dt>
      <dd className="text-[11px] leading-tight text-fg">{value}</dd>
      <dd className="font-mono text-[9px] text-muted">{sub}</dd>
    </div>
  );
}

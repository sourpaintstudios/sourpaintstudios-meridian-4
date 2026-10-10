import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Menu, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AudioBed } from "@/components/AudioBed";
import { ControlDock } from "@/components/ControlDock";
import { GlobeScene } from "@/components/GlobeScene";
import { HorizonPlaque } from "@/components/HorizonPlaque";
import { LoaderSplash, introAlready, markIntroDone } from "@/components/LoaderSplash";
import { MusicCredits } from "@/components/MusicCredits";
import type { SkyHover, SkyIdentify } from "@/components/SkyLayer";
import { moonIllumination, sublunarPoint, subsolarPoint } from "@/lib/astro";
import type { Place } from "@/lib/geocode";
import { planetStates } from "@/lib/planets";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [date, setDate] = useState(() => new Date());
  const [place, setPlace] = useState<Place | null>(null);
  const [firstPerson, setFirstPerson] = useState(false);
  const [showConstellations, setShowConstellations] = useState(true);
  const [showPlanets, setShowPlanets] = useState(true);
  const [scientific, setScientific] = useState(false);
  const [hover, setHover] = useState<SkyHover | null>(null);
  const [identify, setIdentify] = useState<SkyIdentify | null>(null);
  const [globeReady, setGlobeReady] = useState(false);
  const [loadGone, setLoadGone] = useState(() => introAlready());

  const goFirstPerson = useCallback((v: boolean) => {
    setFirstPerson(v);
    if (v) setScientific(true);
    else setScientific(false);
  }, []);

  const dismissLoad = useCallback(() => {
    markIntroDone();
    setLoadGone(true);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setGlobeReady(true), 1800);
    return () => window.clearTimeout(t);
  }, []);

  const sun = useMemo(() => subsolarPoint(date), [date]);
  const moon = useMemo(() => sublunarPoint(date), [date]);
  const illum = useMemo(() => moonIllumination(date), [date]);
  const planets = useMemo(() => planetStates(date), [date]);
  const marker = useMemo(
    () => (place ? { lat: place.lat, lng: place.lng, label: place.name } : null),
    [place],
  );

  return (
    <main className="relative h-svh w-full overflow-hidden overscroll-none bg-bg text-fg">
      <div className="absolute inset-0">
        <GlobeScene
          date={date}
          sun={sun}
          moon={moon}
          moonFraction={illum.fraction}
          marker={marker}
          firstPerson={firstPerson}
          onFirstPerson={goFirstPerson}
          showConstellations={showConstellations}
          showPlanets={showPlanets}
          scientific={scientific}
          planets={planets}
          onHover={setHover}
          onIdentify={setIdentify}
        />
      </div>

      <div className="chrome-top pointer-events-none absolute top-3 left-3 z-40 flex flex-nowrap items-center gap-1">
        {firstPerson ? (
          <>
            <button
              type="button"
              className="paint-chip pointer-events-auto flex h-10 shrink-0 items-center gap-1 px-2.5 text-fg"
              aria-label={scientific ? "Show menus" : "Hide menus"}
              onClick={() => setScientific((s) => !s)}
            >
              <Menu className="size-4" />
              <span className="text-[11px] font-medium tracking-wide">Menu</span>
            </button>
            <button
              type="button"
              className="paint-chip pointer-events-auto flex h-10 shrink-0 items-center gap-1 px-2.5 text-fg"
              aria-label="Back to Earth"
              onClick={() => goFirstPerson(false)}
            >
              <ArrowLeft className="size-4" />
              <span className="text-[11px] font-medium tracking-wide">Earth</span>
            </button>
          </>
        ) : scientific ? (
          <button
            type="button"
            className="paint-chip pointer-events-auto flex h-10 shrink-0 items-center gap-1 px-2.5 text-fg"
            aria-label="Show menus"
            onClick={() => setScientific(false)}
          >
            <Menu className="size-4" />
            <span className="text-[11px] font-medium tracking-wide">Menu</span>
          </button>
        ) : (
          <a
            href="https://sourpaintstudios.com"
            target="_blank"
            rel="noreferrer"
            className="paint-chip pointer-events-auto block size-10 shrink-0"
            aria-label="Sour Paint Studios Meridian 4.0"
            title="Sour Paint Studios Meridian 4.0"
          >
            <img src="/sour-paint-logo.png" alt="Sour Paint Studios" className="size-full object-cover" />
          </a>
        )}
      </div>

      {loadGone ? (
        <div
          className={
            firstPerson
              ? "music-slot music-slot-fp"
              : scientific
                ? "music-slot music-slot-globe music-slot-globe-sci"
                : "music-slot music-slot-globe"
          }
        >
          {firstPerson ? <HorizonPlaque place={place} firstPerson menus={!scientific} /> : null}
          <AudioBed place={place} />
        </div>
      ) : null}

      {loadGone ? <MusicCredits /> : null}

      {hover && hover.name !== identify?.name ? (
        <div
          className="paint-chip pointer-events-none absolute z-20 px-1.5 py-0.5 font-mono text-[10px] leading-none text-fg"
          style={{ left: hover.x + 8, top: hover.y - 6 }}
        >
          {hover.name}
        </div>
      ) : null}

      {identify ? (
        <div className="paint-panel absolute top-28 left-1/2 z-20 sm:top-20 w-[min(18rem,calc(100%-1.5rem))] -translate-x-1/2 p-2.5" role="status">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-medium tracking-[0.14em] text-muted uppercase">That's</p>
              <p className="font-display text-lg leading-tight text-fg">{identify.name}</p>
            </div>
            <button type="button" className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted" aria-label="Close" onClick={() => setIdentify(null)}>
              <X className="size-3.5" />
            </button>
          </div>
          <p className="mt-1 text-xs leading-snug text-muted">{identify.blurb}</p>
        </div>
      ) : null}

      {scientific ? null : (
        <div
          className={
            firstPerson
              ? "pointer-events-none absolute bottom-[5.9rem] left-4 z-10 flex justify-start p-0"
              : "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:inset-auto sm:bottom-4 sm:left-4 sm:justify-start"
          }
        >
          <div className="flex w-[11.75rem] max-w-[11.75rem] flex-col items-stretch gap-1.5">
            <ControlDock
              date={date}
              onDate={setDate}
              place={place}
              onPlace={setPlace}
              firstPerson={firstPerson}
              onFirstPerson={goFirstPerson}
              showConstellations={showConstellations}
              onConstellations={setShowConstellations}
              showPlanets={showPlanets}
              onPlanets={setShowPlanets}
              onScientific={() => setScientific(true)}
            />
          </div>
        </div>
      )}

      {loadGone ? null : <LoaderSplash ready={globeReady} onDone={dismissLoad} />}
    </main>
  );
}

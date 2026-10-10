import { Moon, Shuffle, SkipForward, Sun, Sunrise, Sunset, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SLOT_LABEL, localHour, pickTrack, slotFor, type Slot, type Track } from "@/lib/music";
import type { Place } from "@/lib/geocode";
import { cn } from "@/lib/utils";

const MUTE_KEY = "meridian-mute-v2";

/**
 * Music follows the sun: tracks are chosen by the time of day at the pinned place
 * (or on the viewer's clock with no pin). "ALL" ignores the clock and shuffles everything.
 * A change of time of day takes effect when the current track ends.
 */
const SLOT_ICON: Record<Slot, typeof Sun> = { dawn: Sunrise, day: Sun, dusk: Sunset, night: Moon };

export function AudioBed({ place, date, compact = false }: { place: Place | null; date: Date; compact?: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const recent = useRef<string[]>([]);
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [auto, setAuto] = useState(true);
  const [track, setTrack] = useState<Track | null>(null);
  const [kick, setKick] = useState(0);

  const slot = slotFor(localHour(date, place ? place.lng : null));
  const slotRef = useRef(slot);
  slotRef.current = slot;
  const autoRef = useRef(auto);
  autoRef.current = auto;

  function advance(forceAuto?: boolean, first = false) {
    const useAuto = forceAuto ?? autoRef.current;
    const t = pickTrack(useAuto ? slotRef.current : null, recent.current, first);
    recent.current = [...recent.current, t.id].slice(-6);
    setTrack(t);
    setKick((k) => k + 1);
  }

  useEffect(() => {
    // Open with the famous classical pieces; the rest of the library follows.
    advance(undefined, true);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [muted]);

  useEffect(() => {
    const el = audio.current;
    if (!el || !track) return;
    el.volume = 0.34;
    if (muted) {
      el.pause();
      return;
    }
    try {
      if (el.ended || el.paused) el.currentTime = 0;
    } catch {
      /* ignore */
    }
    el.play().catch(() => {});
  }, [muted, track, kick]);

  const SlotIcon = auto ? SLOT_ICON[slot] : Shuffle;
  const btn = "pointer-events-auto size-8 [&_svg]:size-3.5";

  return (
    <div className="pointer-events-none absolute top-[4.25rem] right-2 z-40 flex flex-col items-end gap-1.5">
      {track ? <audio ref={audio} src={track.src} preload="auto" onEnded={() => advance()} onError={() => advance()} /> : null}
      <Button
        type="button"
        size="icon"
        variant="outline"
        className={cn(btn, !muted && "text-brand")}
        aria-label={muted ? "Play music" : "Pause music"}
        title={muted ? "Play music" : "Pause music"}
        onClick={() => setMuted((m) => !m)}
      >
        {muted ? <VolumeX /> : <Volume2 />}
      </Button>
      <Button type="button" size="icon" variant="outline" className={btn} aria-label="Next track" title="Next track" onClick={() => advance()}>
        <SkipForward />
      </Button>
      {compact ? null : (
        <>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className={cn(btn, auto && "text-brand")}
            aria-label={auto ? "Music follows the time of day. Tap to shuffle everything." : "Shuffling everything. Tap to follow the time of day."}
            title={auto ? `${SLOT_LABEL[slot]}: follows the sun (tap for shuffle)` : "Shuffle all (tap to follow the sun)"}
            onClick={() => {
              const next = !auto;
              setAuto(next);
              autoRef.current = next;
              advance(next);
            }}
          >
            <SlotIcon />
          </Button>
          <div className="paint-chip pointer-events-none max-w-[7.5rem] px-1.5 py-1 text-right" aria-live="off">
            <span className="block truncate text-[8px] font-semibold tracking-[0.14em] text-brand uppercase">
              {auto ? SLOT_LABEL[slot] : "SHUFFLE"}
            </span>
            <span className="block truncate text-[10px] leading-tight text-fg">{track?.title ?? ""}</span>
            <span className="block truncate text-[9px] leading-tight text-muted">{track?.composer ?? ""}</span>
          </div>
        </>
      )}
    </div>
  );
}

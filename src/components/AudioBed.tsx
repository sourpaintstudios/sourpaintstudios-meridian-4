import { SkipForward, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SLOT_LABEL, localHour, pickTrack, slotFor, type Track } from "@/lib/music";
import type { Place } from "@/lib/geocode";
import { cn } from "@/lib/utils";

const MUTE_KEY = "meridian-mute-v2";

/**
 * Music follows the sun: tracks are chosen by the time of day at the pinned place
 * (or on the viewer's clock with no pin). "ALL" ignores the clock and shuffles everything.
 * A change of time of day takes effect when the current track ends.
 */
export function AudioBed({ place, date }: { place: Place | null; date: Date }) {
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

  function advance(forceAuto?: boolean) {
    const useAuto = forceAuto ?? autoRef.current;
    const t = pickTrack(useAuto ? slotRef.current : null, recent.current);
    recent.current = [...recent.current, t.id].slice(-6);
    setTrack(t);
    setKick((k) => k + 1);
  }

  useEffect(() => {
    advance();
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

  return (
    <div className="music-deck pointer-events-auto">
      {track ? <audio ref={audio} src={track.src} preload="auto" onEnded={() => advance()} onError={() => advance()} /> : null}
      <button
        type="button"
        className={cn("paint-chip music-btn", !muted && "paint-live text-brand")}
        aria-label={muted ? "Unmute" : "Mute"}
        onClick={() => setMuted((m) => !m)}
      >
        {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
        <span>MUTE</span>
      </button>
      <button
        type="button"
        className={cn("paint-chip music-now", auto && "paint-live")}
        aria-label={auto ? "Music follows the time of day. Tap to shuffle everything." : "Shuffling everything. Tap to follow the time of day."}
        onClick={() => {
          const next = !auto;
          setAuto(next);
          autoRef.current = next;
          advance(next);
        }}
      >
        <span className="music-mode">{auto ? SLOT_LABEL[slot] : "ALL"}</span>
        <span className="music-title">{auto ? "Follows the sun" : "Shuffle"}</span>
      </button>
      <div className="paint-chip music-now" aria-live="off">
        <span className="music-mode">{track?.composer ?? "—"}</span>
        <span className="music-title">{track?.title ?? ""}</span>
      </div>
      <button type="button" className="paint-chip music-btn" aria-label="Next track" onClick={() => advance()}>
        <SkipForward className="size-3.5" />
        <span>NEXT</span>
      </button>
    </div>
  );
}

import { Info, X } from "lucide-react";
import { useState } from "react";
import { CLASSICAL } from "@/lib/music";

const MACLEOD_TITLES = CLASSICAL.filter((t) => t.composer === "MacLeod").map((t) => t.title);

export function MusicCredits() {
  const [open, setOpen] = useState(false);

  return (
    <div className="pointer-events-none absolute top-3 right-3 z-40 flex flex-col items-end gap-1.5">
      <button
        type="button"
        className="paint-chip pointer-events-auto flex h-10 shrink-0 items-center gap-1 px-2.5 text-fg"
        aria-label={open ? "Close music credits" : "Music credits"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X className="size-4" /> : <Info className="size-4" />}
        <span className="hidden text-[11px] font-medium tracking-wide sm:inline">Credits</span>
      </button>
      {open ? (
        <div className="paint-panel pointer-events-auto w-[min(18rem,calc(100vw-1.5rem))] p-2.5 text-xs leading-snug text-muted">
          <p className="mb-1 text-[10px] font-medium tracking-[0.14em] text-fg uppercase">Music</p>
          <p>
            “{MACLEOD_TITLES.join("”, “")}” by Kevin MacLeod (
            <a className="text-brand underline" href="https://incompetech.com" target="_blank" rel="noreferrer">
              incompetech.com
            </a>
            ), licensed under{" "}
            <a
              className="text-brand underline"
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noreferrer"
            >
              CC BY 4.0
            </a>
            .
          </p>
        </div>
      ) : null}
    </div>
  );
}

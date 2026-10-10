import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type SkyTag = {
  name: string;
  x: number;
  y: number;
  kind: "constellation" | "planet" | "body";
};

export const skyTagsApi = { current: [] as SkyTag[] };
export const systemRefApi = { labels: false };

const POOL = 40;

export function SkyTagHud({ muted = false }: { muted?: boolean }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = root.current;
    if (!host) return;
    const els: HTMLSpanElement[] = [];
    for (let i = 0; i < POOL; i++) {
      const el = document.createElement("span");
      el.style.position = "absolute";
      el.style.display = "none";
      el.style.transform = "translate(-50%, -120%)";
      el.style.whiteSpace = "nowrap";
      el.style.pointerEvents = "none";
      host.appendChild(el);
      els.push(el);
    }
    let id = 0;
    const sizes = new Map<string, { w: number; h: number }>();
    const PRIORITY = { body: 0, planet: 1, constellation: 2 } as const;
    const NUDGES = [0, -22, 22, -44, 44];
    const tick = () => {
      const tags = skyTagsApi.current;
      const count = Math.min(tags.length, POOL);
      const bounds = host.getBoundingClientRect();
      // Styling first, so measured sizes match what is drawn.
      for (let i = 0; i < POOL; i++) {
        const el = els[i];
        const t = i < count ? tags[i] : null;
        if (!t) {
          el.style.display = "none";
          continue;
        }
        el.style.display = "block";
        if (el.textContent !== t.name) el.textContent = t.name;
        el.className =
          t.kind === "constellation"
            ? cn(
                "rounded-sm px-1 font-mono tracking-[0.16em] uppercase",
                muted ? "text-[9px] text-muted/80" : "text-[10px] text-muted",
              )
            : cn(
                "paint-chip px-1 py-0.5 font-mono leading-none text-fg",
                muted ? "text-[9px]" : "text-[10px]",
              );
      }
      // Declutter: most important labels claim space first; others shift vertically or hide.
      const order = Array.from({ length: count }, (_, i) => i).sort(
        (a, b) => PRIORITY[tags[a].kind] - PRIORITY[tags[b].kind] || a - b,
      );
      const placed: { l: number; r: number; t: number; b: number }[] = [];
      const PAD = 3;
      for (const i of order) {
        const el = els[i];
        const t = tags[i];
        const key = `${t.kind}:${t.name}:${muted ? 1 : 0}`;
        let size = sizes.get(key);
        if (!size) {
          size = { w: el.offsetWidth, h: el.offsetHeight };
          sizes.set(key, size);
        }
        const half = size.w / 2;
        const x = Math.min(Math.max(t.x, half + 4), Math.max(half + 4, bounds.width - half - 4));
        let spot: { y: number; box: { l: number; r: number; t: number; b: number } } | null = null;
        for (const dy of NUDGES) {
          const y = t.y + dy;
          const top = y - size.h * 1.2;
          const box = { l: x - half - PAD, r: x + half + PAD, t: top - PAD, b: top + size.h + PAD };
          const hit = placed.some((p) => box.l < p.r && box.r > p.l && box.t < p.b && box.b > p.t);
          if (!hit) {
            spot = { y, box };
            break;
          }
        }
        if (!spot) {
          el.style.display = "none";
          continue;
        }
        placed.push(spot.box);
        el.style.left = `${x}px`;
        el.style.top = `${spot.y}px`;
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(id);
      for (const el of els) el.remove();
    };
  }, [muted]);

  return <div ref={root} className="pointer-events-none absolute inset-0 z-10 overflow-hidden" />;
}

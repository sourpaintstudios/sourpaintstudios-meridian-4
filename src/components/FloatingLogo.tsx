/** Sour Paint Studios mark drifting in space: transparent, glowing, no box. */
export function FloatingLogo() {
  return (
    <a
      href="https://sourpaintstudios.com"
      target="_blank"
      rel="noreferrer"
      className="space-logo pointer-events-auto absolute top-2 left-3 z-40 flex w-36 flex-col items-center gap-1 sm:w-52"
      aria-label="Sour Paint Studios, open sourpaintstudios.com"
      title="SourPaintStudios.com"
    >
      <img src="/sour-paint-mark.png" alt="Sour Paint Studios" className="space-logo-mark w-full" draggable={false} />
      <span className="space-logo-url">SourPaintStudios.com</span>
    </a>
  );
}

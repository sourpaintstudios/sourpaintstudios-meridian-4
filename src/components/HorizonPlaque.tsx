import type { Place } from "@/lib/geocode";

export function HorizonPlaque({
  place,
  firstPerson,
  menus,
}: {
  place: Place | null;
  firstPerson?: boolean;
  menus?: boolean;
}) {
  if (!place) return null;
  const extra = place.detail?.split(",")[0]?.trim() ?? "";

  if (menus) {
    return (
      <div className="horizon-chip">
        <p className="horizon-chip-city">{place.name}</p>
        {extra && extra.toLowerCase() !== place.name.toLowerCase() ? (
          <p className="horizon-chip-extra">{extra}</p>
        ) : null}
      </div>
    );
  }

  if (!firstPerson) return null;

  return (
    <div className="horizon-plaque">
      <p className="horizon-city">{place.name}</p>
      {extra && extra.toLowerCase() !== place.name.toLowerCase() ? <p className="horizon-extra">{extra}</p> : null}
      <p className="horizon-brand">Sour Paint Studios</p>
    </div>
  );
}

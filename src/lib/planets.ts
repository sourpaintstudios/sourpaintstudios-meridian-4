import { equatorialToAltAz, equatorialToGeo, type GeoPoint } from "@/lib/astro";

export type PlanetName = "Mercury" | "Venus" | "Mars" | "Jupiter" | "Saturn" | "Uranus" | "Neptune";

export type PlanetState = {
  name: PlanetName;
  lat: number;
  lng: number;
  raHours: number;
  decDeg: number;
  color: string;
};

const DEG = Math.PI / 180;
const OBL = 23.4397 * DEG;
const DAY_MS = 86400000;
const J1970 = 2440588;
const J2000 = 2451545;

function toDays(date: Date) {
  return date.valueOf() / DAY_MS - 0.5 + J1970 - J2000;
}

function wrap360(x: number) {
  return ((x % 360) + 360) % 360;
}

function kepler(M: number, e: number) {
  let E = M;
  for (let n = 0; n < 10; n++) E = M + e * Math.sin(E);
  return E;
}

type Orb = {
  name: PlanetName;
  color: string;
  N0: number;
  N1: number;
  i0: number;
  i1: number;
  w0: number;
  w1: number;
  a: number;
  e0: number;
  e1: number;
  M0: number;
  M1: number;
};

const ORBITS: Orb[] = [
  {
    name: "Mercury",
    color: "#c8c0b4",
    N0: 48.3313,
    N1: 3.24587e-5,
    i0: 7.0047,
    i1: 5e-8,
    w0: 29.1241,
    w1: 1.01444e-5,
    a: 0.387098,
    e0: 0.205635,
    e1: 5.59e-10,
    M0: 168.6562,
    M1: 4.0923344368,
  },
  {
    name: "Venus",
    color: "#e8d9a8",
    N0: 76.6799,
    N1: 2.4659e-5,
    i0: 3.3946,
    i1: 2.75e-8,
    w0: 54.891,
    w1: 1.38374e-5,
    a: 0.72333,
    e0: 0.006773,
    e1: -1.302e-9,
    M0: 48.0052,
    M1: 1.6021302244,
  },
  {
    name: "Mars",
    color: "#d08060",
    N0: 49.5574,
    N1: 2.11081e-5,
    i0: 1.8497,
    i1: -1.78e-8,
    w0: 286.5016,
    w1: 2.92961e-5,
    a: 1.523688,
    e0: 0.093405,
    e1: 2.516e-9,
    M0: 18.6021,
    M1: 0.5240207766,
  },
  {
    name: "Jupiter",
    color: "#e0c9a0",
    N0: 100.4542,
    N1: 2.76854e-5,
    i0: 1.303,
    i1: -1.557e-7,
    w0: 273.8777,
    w1: 1.64505e-5,
    a: 5.20256,
    e0: 0.048498,
    e1: 4.469e-9,
    M0: 19.895,
    M1: 0.0830853001,
  },
  {
    name: "Saturn",
    color: "#dcc8a0",
    N0: 113.6634,
    N1: 2.3898e-5,
    i0: 2.4886,
    i1: -1.081e-7,
    w0: 339.3939,
    w1: 2.97661e-5,
    a: 9.55475,
    e0: 0.055546,
    e1: -9.499e-9,
    M0: 316.967,
    M1: 0.0334442282,
  },
  {
    name: "Uranus",
    color: "#7ec8d4",
    N0: 74.0005,
    N1: 1.39796e-5,
    i0: 0.7733,
    i1: 1.9e-8,
    w0: 96.6612,
    w1: 3.0565e-5,
    a: 19.18171,
    e0: 0.047318,
    e1: 7.45e-9,
    M0: 142.5905,
    M1: 0.011725806,
  },
  {
    name: "Neptune",
    color: "#4d7cff",
    N0: 131.7806,
    N1: 3.0173e-5,
    i0: 1.77,
    i1: -2.55e-7,
    w0: 272.8461,
    w1: -6.027e-6,
    a: 30.05826,
    e0: 0.008606,
    e1: 2.15e-9,
    M0: 260.2471,
    M1: 0.005995147,
  },
];

const EARTH: Orb = {
  name: "Mercury",
  color: "#fff",
  N0: 0,
  N1: 0,
  i0: 0,
  i1: 0,
  w0: 282.9404,
  w1: 4.70935e-5,
  a: 1,
  e0: 0.016709,
  e1: -1.151e-9,
  M0: 356.047,
  M1: 0.9856002585,
};

function helio(d: number, p: Orb) {
  const N = wrap360(p.N0 + p.N1 * d) * DEG;
  const i = (p.i0 + p.i1 * d) * DEG;
  const w = wrap360(p.w0 + p.w1 * d) * DEG;
  const e = p.e0 + p.e1 * d;
  const M = wrap360(p.M0 + p.M1 * d) * DEG;
  const E = kepler(M, e);
  const xv = p.a * (Math.cos(E) - e);
  const yv = p.a * Math.sqrt(Math.max(0, 1 - e * e)) * Math.sin(E);
  const v = Math.atan2(yv, xv);
  const r = Math.sqrt(xv * xv + yv * yv);
  const lon = v + w;
  const xh = r * (Math.cos(N) * Math.cos(lon) - Math.sin(N) * Math.sin(lon) * Math.cos(i));
  const yh = r * (Math.sin(N) * Math.cos(lon) + Math.cos(N) * Math.sin(lon) * Math.cos(i));
  const zh = r * Math.sin(lon) * Math.sin(i);
  return { x: xh, y: yh, z: zh };
}

function equatorialFromHelio(p: { x: number; y: number; z: number }, e: { x: number; y: number; z: number }) {
  const x = p.x - e.x;
  const y = p.y - e.y;
  const z = p.z - e.z;
  const xe = x;
  const ye = y * Math.cos(OBL) - z * Math.sin(OBL);
  const ze = y * Math.sin(OBL) + z * Math.cos(OBL);
  const ra = Math.atan2(ye, xe);
  const dec = Math.atan2(ze, Math.sqrt(xe * xe + ye * ye));
  return {
    raHours: ((ra / DEG + 360) % 360) / 15,
    decDeg: (dec / DEG),
  };
}

export const SKY_BLURB: Record<string, string> = {
  Mercury: "Closest planet to the Sun. Small, fast, and almost no air.",
  Venus: "Earth's twin in size — and the hottest planet, wrapped in thick cloud.",
  Mars: "The red planet. Fourth from the Sun, with rust-colored dust and two tiny moons.",
  Jupiter: "The largest planet. A gas giant with a centuries-old Great Red Spot.",
  Saturn: "A pale gas giant, famous for those wide, bright rings.",
  Uranus: "An ice giant, tipped on its side. Faint rings, pale blue-green.",
  Neptune: "The farthest planet. Deep blue, windy, and a long way out.",
  Sun: "Our star. Everything in this sky is circling it.",
  Earth: "Home. Third planet from the Sun — the globe you're looking at.",
  Moon: "Earth's Moon — our companion. The light you see is sunlight on gray rock.",
  "Earth's Moon": "Earth's Moon — our companion. The light you see is sunlight on gray rock.",
  Polaris: "Polaris — the North Star. It sits almost still above Earth's north pole, which is why the sky turns around it.",
  "North Star": "Polaris — the North Star. It sits almost still above Earth's north pole, which is why the sky turns around it.",
};

export const CONSTELLATION_BLURB: Record<string, string> = {
  Orion: "The Hunter. Three stars in a row make his belt; red Betelgeuse and blue Rigel mark shoulder and foot.",
  "Ursa Major": "The Great Bear. Its seven brightest stars form the Big Dipper, whose pointer stars aim at the North Star.",
  "Ursa Minor": "The Little Bear. Contains the Little Dipper, with Polaris at the end of its handle.",
  Cassiopeia: "The Queen. A bright zigzag shaped like a W or M, opposite the Big Dipper around the North Star.",
  Cygnus: "The Swan, also called the Northern Cross. Deneb marks the tail, flying along the Milky Way.",
  Scorpius: "The Scorpion. Red Antares is its heart, with a curved tail hooked at the end.",
  Crux: "The Southern Cross. Smallest of the 88 constellations, and a guide to the south pole.",
  Taurus: "The Bull. Orange Aldebaran is its eye, with the Pleiades star cluster on its shoulder.",
  Gemini: "The Twins. Castor and Pollux are the two bright heads.",
  Leo: "The Lion. A backward question mark of stars, the Sickle, forms the head and mane.",
  "Canis Major": "The Great Dog. Holds Sirius, the brightest star in the night sky.",
  "Canis Minor": "The Little Dog. Procyon is its bright star, close to us at about 11 light-years.",
  Auriga: "The Charioteer. Bright yellow Capella leads a pentagon of stars.",
  "Boötes": "The Herdsman. Orange Arcturus shines at the base of a kite shape.",
  Pegasus: "The Winged Horse. Its Great Square is a signpost for autumn skies.",
  Andromeda: "The Chained Princess. Points toward the Andromeda Galaxy, our nearest large neighbor.",
  Lyra: "The Lyre. Small, but home to Vega, one of the brightest stars in the sky.",
  Aquila: "The Eagle. Altair is its bright star, flying along the Milky Way.",
  Virgo: "The Maiden. Spica is her bright star, and a cloud of galaxies lies within her.",
  Sagittarius: "The Archer. Its teapot shape points at the center of our Milky Way galaxy.",
};

export function skyBlurb(name: string) {
  return CONSTELLATION_BLURB[name] ?? SKY_BLURB[name] ?? "A bright star in this sky.";
}

export const PLANET_SPACE: Record<PlanetName, { dist: number; size: number; skyDist: number; skySize: number }> = {
  Mercury: { dist: 4.6, size: 0.055, skyDist: 44, skySize: 0.038 },
  Venus: { dist: 5.9, size: 0.082, skyDist: 40, skySize: 0.052 },
  Mars: { dist: 8.8, size: 0.07, skyDist: 48, skySize: 0.044 },
  Jupiter: { dist: 13.4, size: 0.16, skyDist: 54, skySize: 0.072 },
  Saturn: { dist: 17.2, size: 0.14, skyDist: 58, skySize: 0.062 },
  Uranus: { dist: 28, size: 0.11, skyDist: 62, skySize: 0.05 },
  Neptune: { dist: 34, size: 0.1, skyDist: 66, skySize: 0.046 },
};

export function planetStates(date: Date): PlanetState[] {
  const d = toDays(date);
  const earth = helio(d, EARTH);
  return ORBITS.map((orb) => {
    const eq = equatorialFromHelio(helio(d, orb), earth);
    const geo = equatorialToGeo(date, eq.raHours, eq.decDeg);
    return { name: orb.name, color: orb.color, raHours: eq.raHours, decDeg: eq.decDeg, lat: geo.lat, lng: geo.lng };
  });
}

export function planetAltAz(date: Date, lat: number, lng: number, planet: PlanetState) {
  return equatorialToAltAz(date, lat, lng, planet.raHours, planet.decDeg);
}

export type { GeoPoint };

import { Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { equatorialToAltAz, equatorialToGeo, moonPosition, sunPosition, type GeoPoint } from "@/lib/astro";
import { latLngToVector3 } from "@/lib/geo";
import { planetAltAz, PLANET_SPACE, skyBlurb, type PlanetState } from "@/lib/planets";
import { CONSTELLATIONS, starRgb, starSize, uniqueStars } from "@/lib/stars";
import { skyTagsApi, systemRefApi, type SkyTag } from "@/components/SkyTags";

const EARTH_R = 1.15;
const EYE_HEIGHT = 0.022;
const STAR_DIST = 68;
const CELESTIAL_R = 36;

export type SkyHover = { name: string; x: number; y: number };
export type SkyIdentify = { name: string; blurb: string };

type PickItem = {
  name: string;
  position: THREE.Vector3;
  kind: "planet" | "body" | "star" | "constellation";
  hit: number;
  occlude?: boolean;
};

export function rayHitsEarth(cam: THREE.Vector3, target: THREE.Vector3) {
  const dx = target.x - cam.x;
  const dy = target.y - cam.y;
  const dz = target.z - cam.z;
  const len2 = dx * dx + dy * dy + dz * dz;
  if (len2 < 1e-9) return false;
  const t = -(cam.x * dx + cam.y * dy + cam.z * dz) / len2;
  if (t <= 0 || t >= 1) return false;
  const px = cam.x + dx * t;
  const py = cam.y + dy * t;
  const pz = cam.z + dz * t;
  return px * px + py * py + pz * pz < EARTH_R * EARTH_R;
}

function localFrame(lat: number, lng: number) {
  const up = latLngToVector3(lat, lng, 1).normalize();
  const east = new THREE.Vector3(0, 1, 0).cross(up);
  if (east.lengthSq() < 1e-10) east.set(1, 0, 0);
  else east.normalize();
  const north = new THREE.Vector3().crossVectors(up, east).normalize();
  return { up, east, north };
}

function skyPoint(lat: number, lng: number, azimuthDeg: number, altitudeDeg: number, distance: number) {
  const { up, east, north } = localFrame(lat, lng);
  const eye = up.clone().multiplyScalar(EARTH_R + EYE_HEIGHT);
  const az = (azimuthDeg * Math.PI) / 180;
  const alt = (altitudeDeg * Math.PI) / 180;
  const dir = new THREE.Vector3()
    .addScaledVector(north, Math.cos(az) * Math.cos(alt))
    .addScaledVector(east, Math.sin(az) * Math.cos(alt))
    .addScaledVector(up, Math.sin(alt))
    .normalize();
  return eye.addScaledVector(dir, distance);
}

const starVert = /* glsl */ `
  attribute float aSize;
  varying vec3 vColor;
  void main() {
    vColor = color;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (220.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`;

const starFrag = /* glsl */ `
  varying vec3 vColor;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float d = dot(p, p);
    if (d > 1.0) discard;
    float a = exp(-d * 3.2);
    gl_FragColor = vec4(vColor, a);
  }
`;

function SkyPick({
  items,
  onHover,
  onIdentify,
  scientific,
}: {
  items: PickItem[];
  onHover: (h: SkyHover | null) => void;
  onIdentify: (h: SkyIdentify | null) => void;
  scientific: boolean;
}) {
  const { camera, gl } = useThree();
  const list = useRef(items);
  list.current = items;
  const scratch = useMemo(() => new THREE.Vector3(), []);
  const start = useRef<{ x: number; y: number } | null>(null);
  const pending = useRef<SkyIdentify | null>(null);

  useEffect(() => {
    const el = gl.domElement;
    const hitTest = (cx: number, cy: number) => {
      const rect = el.getBoundingClientRect();
      const pad = scientific ? 8 : 0;
      let best: { item: PickItem; x: number; y: number; d: number } | null = null;
      for (const it of list.current) {
        scratch.copy(it.position).project(camera);
        if (scratch.z < -1.05 || scratch.z > 1.25) continue;
        if (it.occlude && rayHitsEarth(camera.position, it.position)) continue;
        const x = (scratch.x * 0.5 + 0.5) * rect.width;
        const y = (-scratch.y * 0.5 + 0.5) * rect.height;
        const d = Math.hypot(cx - rect.left - x, cy - rect.top - y);
        if (d < it.hit + pad && (!best || d < best.d)) best = { item: it, x, y, d };
      }
      return best;
    };
    const onMove = (e: PointerEvent) => {
      const hit = hitTest(e.clientX, e.clientY);
      onHover(hit ? { name: hit.item.name, x: hit.x, y: hit.y } : null);
    };
    const onDown = (e: PointerEvent) => {
      start.current = { x: e.clientX, y: e.clientY };
      const hit = hitTest(e.clientX, e.clientY);
      pending.current = hit ? { name: hit.item.name, blurb: skyBlurb(hit.item.name) } : null;
    };
    const onUp = (e: PointerEvent) => {
      const s = start.current;
      const picked = pending.current;
      start.current = null;
      pending.current = null;
      if (!s) return;
      if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) return;
      onIdentify(picked);
    };
    const onLeave = () => onHover(null);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerdown", onDown, { capture: true });
    el.addEventListener("pointerup", onUp, { capture: true });
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onDown, true);
      el.removeEventListener("pointerup", onUp, true);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [camera, gl, onHover, onIdentify, scientific, scratch]);

  useFrame(() => {});
  return null;
}

export function SkyLayer({
  date,
  marker,
  firstPerson,
  showConstellations,
  showPlanets,
  scientific,
  planets,
  sun,
  moon,
  onHover,
  onIdentify,
}: {
  date: Date;
  marker: { lat: number; lng: number } | null;
  firstPerson: boolean;
  showConstellations: boolean;
  showPlanets: boolean;
  scientific: boolean;
  planets: PlanetState[];
  sun: GeoPoint;
  moon: GeoPoint;
  onHover: (h: SkyHover | null) => void;
  onIdentify: (h: SkyIdentify | null) => void;
}) {
  const stars = useMemo(() => uniqueStars(), []);
  const starByName = useMemo(() => {
    const m = new Map<string, (typeof stars)[number]>();
    for (const s of stars) m.set(s.n, s);
    return m;
  }, [stars]);

  const fp = Boolean(firstPerson && marker);
  const lat = marker?.lat ?? 0;
  const lng = marker?.lng ?? 0;

  const starGeom = useMemo(() => {
    const pos: number[] = [];
    const col: number[] = [];
    const siz: number[] = [];
    const scale = scientific ? 0.55 : 1;
    if (fp) {
      const sunAlt = sunPosition(date, lat, lng).altitude;
      const fade = sunAlt < -6 ? 1 : THREE.MathUtils.clamp((2 - sunAlt) / 8, 0.12, 1);
      for (const s of stars) {
        const { altitude, azimuth } = equatorialToAltAz(date, lat, lng, s.ra, s.dec);
        if (altitude < -1.2) continue;
        const p = skyPoint(lat, lng, azimuth, altitude, STAR_DIST);
        pos.push(p.x, p.y, p.z);
        const rgb = starRgb(s.sp);
        col.push(rgb[0], rgb[1], rgb[2]);
        siz.push(starSize(s.mag) * scale * fade);
      }
    } else {
      for (const s of stars) {
        const g = equatorialToGeo(date, s.ra, s.dec);
        const p = latLngToVector3(g.lat, g.lng, CELESTIAL_R);
        pos.push(p.x, p.y, p.z);
        const rgb = starRgb(s.sp);
        col.push(rgb[0], rgb[1], rgb[2]);
        siz.push(starSize(s.mag) * scale * 1.35);
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geom.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    geom.setAttribute("aSize", new THREE.Float32BufferAttribute(siz, 1));
    return geom;
  }, [date, fp, lat, lng, scientific, stars]);

  useEffect(() => () => starGeom.dispose(), [starGeom]);

  const constSegs = useMemo(() => {
    const segs: [THREE.Vector3, THREE.Vector3][] = [];
    if (!showConstellations) return segs;
    if (fp) {
      for (const c of CONSTELLATIONS) {
        for (const [a, b] of c.lines) {
          const sa = starByName.get(a);
          const sb = starByName.get(b);
          if (!sa || !sb) continue;
          const pa = equatorialToAltAz(date, lat, lng, sa.ra, sa.dec);
          const pb = equatorialToAltAz(date, lat, lng, sb.ra, sb.dec);
          if (pa.altitude < -8 && pb.altitude < -8) continue;
          segs.push([
            skyPoint(lat, lng, pa.azimuth, pa.altitude, STAR_DIST),
            skyPoint(lat, lng, pb.azimuth, pb.altitude, STAR_DIST),
          ]);
        }
      }
    } else {
      for (const c of CONSTELLATIONS) {
        for (const [a, b] of c.lines) {
          const sa = starByName.get(a);
          const sb = starByName.get(b);
          if (!sa || !sb) continue;
          const ga = equatorialToGeo(date, sa.ra, sa.dec);
          const gb = equatorialToGeo(date, sb.ra, sb.dec);
          segs.push([
            latLngToVector3(ga.lat, ga.lng, CELESTIAL_R),
            latLngToVector3(gb.lat, gb.lng, CELESTIAL_R),
          ]);
        }
      }
    }
    return segs;
  }, [date, fp, lat, lng, showConstellations, starByName]);

  const polaris = useMemo(() => {
    const s = starByName.get("Polaris");
    if (!s) return null;
    if (fp) {
      const sky = equatorialToAltAz(date, lat, lng, s.ra, s.dec);
      return {
        pos: skyPoint(lat, lng, sky.azimuth, sky.altitude, STAR_DIST),
        up: sky.altitude > -4,
        r: 0.028,
      };
    }
    return { pos: latLngToVector3(89.35, 0, EARTH_R + 0.82), up: true, r: 0.016 };
  }, [date, fp, lat, lng, starByName]);

  const constCentroids = useMemo(() => {
    const out: { name: string; pos: THREE.Vector3 }[] = [];
    if (!showConstellations) return out;
    for (const c of CONSTELLATIONS) {
      const seen = new Set<string>();
      const acc = new THREE.Vector3();
      let n = 0;
      for (const [a, b] of c.lines) {
        for (const nm of [a, b]) {
          if (seen.has(nm)) continue;
          seen.add(nm);
          const st = starByName.get(nm);
          if (!st) continue;
          if (fp) {
            const sky = equatorialToAltAz(date, lat, lng, st.ra, st.dec);
            if (sky.altitude < 4) continue;
            acc.add(skyPoint(lat, lng, sky.azimuth, sky.altitude, STAR_DIST));
          } else {
            const g = equatorialToGeo(date, st.ra, st.dec);
            acc.add(latLngToVector3(g.lat, g.lng, CELESTIAL_R));
          }
          n += 1;
        }
      }
      if (n < 2) continue;
      acc.multiplyScalar(1 / n);
      out.push({ name: c.name, pos: acc });
    }
    return out;
  }, [date, fp, lat, lng, showConstellations, starByName]);

  const pickItems = useMemo(() => {
    const items: PickItem[] = [];
    for (const c of constCentroids) {
      items.push({ name: c.name, position: c.pos, kind: "constellation", hit: fp ? 70 : 56, occlude: !fp });
    }
    if (fp) {
      const sunSky = sunPosition(date, lat, lng);
      if (sunSky.altitude > -2) {
        items.push({ name: "Sun", position: skyPoint(lat, lng, sunSky.azimuth, sunSky.altitude, 22), kind: "body", hit: 44 });
      }
      const moonSky = moonPosition(date, lat, lng);
      if (moonSky.altitude > -2) {
        items.push({ name: "Earth's Moon", position: skyPoint(lat, lng, moonSky.azimuth, moonSky.altitude, 16), kind: "body", hit: 72 });
      }
      for (const s of stars) {
        if (s.mag > 1.35) continue;
        const { altitude, azimuth } = equatorialToAltAz(date, lat, lng, s.ra, s.dec);
        if (altitude < 0) continue;
        items.push({ name: s.n, position: skyPoint(lat, lng, azimuth, altitude, STAR_DIST), kind: "star", hit: 22 });
      }
    } else {
      items.push({ name: "Sun", position: latLngToVector3(sun.lat, sun.lng, 22), kind: "body", hit: 48 });
      items.push({ name: "Moon", position: latLngToVector3(moon.lat, moon.lng, 3.4), kind: "body", hit: 48 });
    }
    if (showPlanets) {
      for (const p of planets) {
        const space = PLANET_SPACE[p.name];
        if (fp) {
          const sky = planetAltAz(date, lat, lng, p);
          if (sky.altitude < -2) continue;
          items.push({
            name: p.name,
            position: skyPoint(lat, lng, sky.azimuth, sky.altitude, space.skyDist),
            kind: "planet",
            hit: 52,
          });
        } else {
          items.push({
            name: p.name,
            position: latLngToVector3(p.lat, p.lng, space.dist),
            kind: "planet",
            hit: 72,
          });
        }
      }
    }
    if (polaris?.up) {
      items.push({ name: "North Star", position: polaris.pos, kind: "star", hit: fp ? 36 : 28 });
    }
    return items;
  }, [constCentroids, date, fp, lat, lng, moon.lat, moon.lng, planets, polaris, showPlanets, stars, sun.lat, sun.lng]);

  return (
    <>
      {starGeom.getAttribute("position")?.count ? (
        <points frustumCulled={false}>
          <primitive object={starGeom} attach="geometry" />
          <shaderMaterial
            vertexShader={starVert}
            fragmentShader={starFrag}
            vertexColors
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      ) : null}

      {constSegs.map((pts, i) => (
        <Line
          key={i}
          points={pts}
          color={scientific ? "#b8c0b4" : "#efe8d2"}
          lineWidth={scientific ? 1 : fp ? 1.35 : 1.6}
          transparent
          opacity={scientific ? 0.45 : fp ? 0.72 : 0.7}
          frustumCulled={false}
        />
      ))}

      {polaris?.up ? (
        <group position={polaris.pos} frustumCulled={false}>
          <mesh>
            <sphereGeometry args={[polaris.r, 12, 12]} />
            <meshBasicMaterial color="#e8f3ff" />
          </mesh>
          <mesh scale={2.4}>
            <sphereGeometry args={[polaris.r, 10, 10]} />
            <meshBasicMaterial color="#b7d4ff" transparent opacity={0.42} depthWrite={false} />
          </mesh>
        </group>
      ) : null}

      {showPlanets
        ? planets.map((p) => {
            const space = PLANET_SPACE[p.name];
            if (fp) {
              const sky = planetAltAz(date, lat, lng, p);
              if (sky.altitude < -2) return null;
              const pos = skyPoint(lat, lng, sky.azimuth, sky.altitude, space.skyDist);
              const r = space.skySize * (scientific ? 1.1 : 1.85);
              return (
                <group key={p.name} position={pos} frustumCulled={false}>
                  <mesh>
                    <sphereGeometry args={[r, 16, 16]} />
                    <meshBasicMaterial color={p.color} />
                  </mesh>
                  <mesh scale={2.8}>
                    <sphereGeometry args={[r, 10, 10]} />
                    <meshBasicMaterial color={p.color} transparent opacity={0.32} depthWrite={false} />
                  </mesh>
                </group>
              );
            }
            const pos = latLngToVector3(p.lat, p.lng, space.dist);
            const r = space.size * (scientific ? 0.7 : 1);
            return (
              <group key={p.name} position={pos} frustumCulled={false}>
                <mesh>
                  <sphereGeometry args={[r, 16, 16]} />
                  <meshBasicMaterial color={p.color} />
                </mesh>
                <mesh scale={1.7}>
                  <sphereGeometry args={[r, 10, 10]} />
                  <meshBasicMaterial color={p.color} transparent opacity={0.18} depthWrite={false} />
                </mesh>
              </group>
            );
          })
        : null}

      <SkyPick items={pickItems} onHover={onHover} onIdentify={onIdentify} scientific={scientific} />
      <SkyTagger
        date={date}
        lat={lat}
        lng={lng}
        fp={fp}
        showConstellations={showConstellations}
        polaris={polaris}
        showPlanets={showPlanets}
        planets={planets}
        centroids={constCentroids}
        sun={sun}
        moon={moon}
      />
    </>
  );
}

function SkyTagger({
  date,
  lat,
  lng,
  fp,
  showConstellations,
  polaris,
  showPlanets,
  planets,
  centroids,
  sun,
  moon,
}: {
  date: Date;
  lat: number;
  lng: number;
  fp: boolean;
  showConstellations: boolean;
  polaris: { pos: THREE.Vector3; up: boolean; r: number } | null;
  showPlanets: boolean;
  planets: PlanetState[];
  centroids: { name: string; pos: THREE.Vector3 }[];
  sun: GeoPoint;
  moon: GeoPoint;
}) {
  const { camera, gl } = useThree();
  const scratch = useMemo(() => new THREE.Vector3(), []);
  const earthTag = useMemo(() => new THREE.Vector3(), []);
  const moonTag = useMemo(() => new THREE.Vector3(), []);
  const sunTag = useMemo(() => new THREE.Vector3(), []);
  const planetTag = useMemo(() => new THREE.Vector3(), []);
  const sunAlt = fp ? sunPosition(date, lat, lng).altitude : -90;

  useFrame(() => {
    const rect = gl.domElement.getBoundingClientRect();
    const tags: SkyTag[] = [];
    const project = (pos: THREE.Vector3, name: string, kind: SkyTag["kind"]) => {
      scratch.copy(pos).project(camera);
      if (scratch.z < -1 || scratch.z > 1) return;
      if (Math.abs(scratch.x) > 0.98 || Math.abs(scratch.y) > 0.96) return;
      tags.push({
        name,
        x: (scratch.x * 0.5 + 0.5) * rect.width,
        y: (-scratch.y * 0.5 + 0.5) * rect.height,
        kind,
      });
    };

    if (!fp) {
      if (systemRefApi.labels) {
        earthTag.copy(camera.position).setLength(EARTH_R);
        project(earthTag, "Earth", "body");
        project(latLngToVector3(moon.lat, moon.lng, 3.4, moonTag), "Moon", "body");
        project(latLngToVector3(sun.lat, sun.lng, 22, sunTag), "Sun", "body");
      } else if (polaris?.up) {
        project(polaris.pos, "North Star", "planet");
      }
      if (showPlanets) {
        const camLen = camera.position.length();
        const earthAng = Math.asin(Math.min(1, EARTH_R / Math.max(camLen, EARTH_R + 0.05)));
        for (const p of planets) {
          const space = PLANET_SPACE[p.name];
          latLngToVector3(p.lat, p.lng, space.dist, planetTag);
          earthTag.copy(planetTag).sub(camera.position);
          const behind =
            earthTag.angleTo(sunTag.copy(camera.position).negate()) < earthAng &&
            earthTag.length() > camLen - EARTH_R;
          if (behind) continue;
          project(planetTag, p.name, "planet");
        }
      }
      if (showConstellations) {
        for (const c of centroids) {
          if (rayHitsEarth(camera.position, c.pos)) continue;
          project(c.pos, c.name, "constellation");
        }
      }
      skyTagsApi.current = tags;
      return;
    }

    if (polaris?.up) project(polaris.pos, "North Star", "planet");

    const sunSky = sunPosition(date, lat, lng);
    if (sunSky.altitude > -1) {
      project(skyPoint(lat, lng, sunSky.azimuth, sunSky.altitude, 22), "Sun", "body");
    }
    const moonSky = moonPosition(date, lat, lng);
    if (moonSky.altitude > -1) {
      project(skyPoint(lat, lng, moonSky.azimuth, moonSky.altitude, 16), "Earth's Moon", "body");
    }

    if (showPlanets) {
      for (const p of planets) {
        const sky = planetAltAz(date, lat, lng, p);
        if (sky.altitude < -1) continue;
        const space = PLANET_SPACE[p.name];
        project(skyPoint(lat, lng, sky.azimuth, sky.altitude, space.skyDist), p.name, "planet");
      }
    }

    if (showConstellations && sunAlt < 2) {
      for (const c of centroids) project(c.pos, c.name, "constellation");
    }

    skyTagsApi.current = tags;
  });

  return null;
}

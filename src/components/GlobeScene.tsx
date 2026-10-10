import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, useTexture } from "@react-three/drei";
import { Crosshair, Minus, Plus, SunMoon } from "lucide-react";
import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Button } from "@/components/ui/button";
import { moonPosition, pickSkyFocus, sunPosition, type GeoPoint } from "@/lib/astro";
import { easeInOutQuint, latLngToVector3, lerpRadial } from "@/lib/geo";
import type { PlanetState } from "@/lib/planets";
import { SkyLayer, type SkyHover, type SkyIdentify } from "@/components/SkyLayer";
import { CompassHud, headingApi } from "@/components/CompassHud";
import { SkyTagHud, systemRefApi } from "@/components/SkyTags";

const EARTH_R = 1.15;
const MIN_DIST = 1.72;
const MAX_DIST = 360;
const VIEW_DIST = 6.05;
const EYE_HEIGHT = 0.022;
const GLOBE_NEAR = 0.08;
const FP_NEAR = 0.002;
const GLOBE_FOV = 40;
const FP_FOV = 92;
const FP_FOV_MIN = 30;
const FP_FOV_MAX = 120;
const TRANSITION_SEC = 1.7;
const SUN_DIST = 22;
const MOON_DIST = 3.4;
const SKY_MOON_DIST = 16;
const SKY_SUN_DIST = 22;
const SKY_MOON_SIZE = 0.88;
const SKY_SUN_SIZE = 0.14;
const LOOK_PITCH_MIN = -0.38;
const LOOK_PITCH_MAX = 1.45;
const HORIZON_ALT = -7;

const zoomApi: {
  cam: THREE.PerspectiveCamera | null;
  controls: OrbitControlsImpl | null;
  first: boolean;
  look: { fov: number } | null;
  clearDest: () => void;
} = { cam: null, controls: null, first: false, look: null, clearDest: () => {} };

const frameApi = { seq: 0, pending: false };
const homeApi = { seq: 0, pending: false };

function systemViewPose(sun: GeoPoint, moon: GeoPoint, from: THREE.Vector3, aspect: number) {
  const s = latLngToVector3(sun.lat, sun.lng, SUN_DIST);
  const m = latLngToVector3(moon.lat, moon.lng, MOON_DIST);
  const target = s.clone().multiplyScalar(0.38);

  const axis = new THREE.Vector3().crossVectors(s, m);
  if (axis.lengthSq() < 1e-4) {
    axis.crossVectors(s, new THREE.Vector3(0, 1, 0));
    if (axis.lengthSq() < 1e-4) axis.set(1, 0, 0);
  }
  axis.normalize();
  if (from.lengthSq() > 1e-8 && axis.dot(from) < 0) axis.negate();

  const polar = Math.acos(THREE.MathUtils.clamp(axis.y, -1, 1));
  const minP = 0.28;
  const maxP = Math.PI - 0.28;
  if (polar < minP || polar > maxP) {
    const aim = polar < minP ? minP : maxP;
    const xz = Math.hypot(axis.x, axis.z) || 1e-6;
    const r = Math.sin(aim);
    axis.set((axis.x / xz) * r, Math.cos(aim), (axis.z / xz) * r).normalize();
  }

  const vHalf = Math.tan((GLOBE_FOV * Math.PI) / 360);
  const hHalf = vHalf * Math.max(aspect, 0.38);
  const half = Math.min(vHalf, hHalf);
  const span = Math.max(target.length() + EARTH_R, s.distanceTo(target) + 1.15, m.distanceTo(target) + 0.55);
  const dist = THREE.MathUtils.clamp((span / Math.max(half, 0.08)) * 1.3, 32, MAX_DIST);
  return { pos: target.clone().addScaledVector(axis, dist), target };
}

function snapSystemView(
  cam: THREE.PerspectiveCamera,
  controls: OrbitControlsImpl | null,
  sun: GeoPoint,
  moon: GeoPoint,
) {
  const pose = systemViewPose(sun, moon, cam.position, cam.aspect || 1);
  cam.position.copy(pose.pos);
  cam.up.set(0, 1, 0);
  cam.lookAt(pose.target);
  cam.near = GLOBE_NEAR;
  cam.fov = GLOBE_FOV;
  cam.updateProjectionMatrix();
  if (controls) {
    controls.target.copy(pose.target);
    controls.update();
  }
}

function applyZoom(dir: number) {
  systemRefApi.labels = false;
  if (zoomApi.first && zoomApi.look) {
    const next = zoomApi.look.fov * (dir < 0 ? 0.78 : 1.28);
    zoomApi.look.fov = THREE.MathUtils.clamp(next, FP_FOV_MIN, FP_FOV_MAX);
    return;
  }
  const cam = zoomApi.cam;
  if (!cam) return;
  const len = cam.position.length();
  const next = THREE.MathUtils.clamp(len * (dir < 0 ? 0.7 : 1.48), MIN_DIST, MAX_DIST);
  cam.position.multiplyScalar(next / Math.max(len, 0.001));
  zoomApi.controls?.update();
  zoomApi.clearDest();
}

function snapHomeView(
  cam: THREE.PerspectiveCamera,
  controls: OrbitControlsImpl | null,
  lat: number,
  lng: number,
  moon: GeoPoint,
) {
  const pin = latLngToVector3(lat, lng, 1);
  const moonPos = latLngToVector3(moon.lat, moon.lng, MOON_DIST);
  const moonNear = moonPos.normalize().dot(pin) > 0.08;
  const dist = moonNear ? 7.2 : VIEW_DIST;
  cam.position.copy(pin).multiplyScalar(dist);
  cam.up.set(0, 1, 0);
  cam.lookAt(0, 0, 0);
  cam.near = GLOBE_NEAR;
  cam.fov = GLOBE_FOV;
  cam.updateProjectionMatrix();
  if (controls) {
    controls.target.set(0, 0, 0);
    controls.update();
  }
}

function requestHomeView(hasPin: boolean, exitFirst?: (v: boolean) => void) {
  if (!hasPin) return;
  systemRefApi.labels = false;
  if (zoomApi.first) {
    homeApi.pending = true;
    homeApi.seq++;
    exitFirst?.(false);
    return;
  }
  homeApi.pending = false;
  homeApi.seq++;
}

function requestSystemView(exitFirst?: (v: boolean) => void) {
  systemRefApi.labels = true;
  if (zoomApi.first) {
    frameApi.pending = true;
    frameApi.seq++;
    exitFirst?.(false);
    return;
  }
  frameApi.pending = false;
  frameApi.seq++;
}

const _hFwd = new THREE.Vector3();
const _hEast = new THREE.Vector3();
const _hNorth = new THREE.Vector3();
const _hUp = new THREE.Vector3();
const _hRight = new THREE.Vector3();
const _hNadir = new THREE.Vector3();
const _hHoriz = new THREE.Vector3();
const _lookDir = new THREE.Vector3();
const _lookRight = new THREE.Vector3();
const _lookCamUp = new THREE.Vector3();
const _lookBack = new THREE.Vector3();
const _lookMat = new THREE.Matrix4();
const _lookEye = new THREE.Vector3();

function publishHeading(
  cam: THREE.PerspectiveCamera,
  first: boolean,
  lat: number | null,
  lng: number | null,
  yaw: number,
) {
  headingApi.current.first = first;
  if (first && lat != null && lng != null) {
    const frame = localFrame(lat, lng);
    _hFwd.set(0, 0, -1).applyQuaternion(cam.quaternion);
    _hHoriz.copy(_hFwd).addScaledVector(frame.up, -_hFwd.dot(frame.up));
    if (_hHoriz.lengthSq() > 1e-8) {
      _hHoriz.normalize();
      headingApi.current.headingDeg =
        (((Math.atan2(_hHoriz.dot(frame.east), _hHoriz.dot(frame.north)) * 180) / Math.PI) % 360 + 360) % 360;
    } else {
      headingApi.current.headingDeg = (((yaw * 180) / Math.PI) % 360 + 360) % 360;
    }
  } else {
    headingApi.current.headingDeg = (((yaw * 180) / Math.PI) % 360 + 360) % 360;
  }

  _hNadir.copy(cam.position).normalize();
  _hEast.set(0, 1, 0).cross(_hNadir);
  if (_hEast.lengthSq() < 1e-10) _hEast.set(1, 0, 0);
  else _hEast.normalize();
  _hNorth.crossVectors(_hNadir, _hEast).normalize();
  _hRight.set(1, 0, 0).applyQuaternion(cam.quaternion);
  _hUp.set(0, 1, 0).applyQuaternion(cam.quaternion);
  headingApi.current.roseDeg = (Math.atan2(_hNorth.dot(_hRight), _hNorth.dot(_hUp)) * 180) / Math.PI;
}

export type GlobeSceneProps = {
  date: Date;
  sun: GeoPoint;
  moon: GeoPoint;
  marker: { lat: number; lng: number; label: string } | null;
  moonFraction: number;
  firstPerson: boolean;
  onFirstPerson?: (v: boolean) => void;
  showConstellations: boolean;
  showPlanets: boolean;
  scientific: boolean;
  planets: PlanetState[];
  onHover: (h: SkyHover | null) => void;
  onIdentify: (h: SkyIdentify | null) => void;
};

const earthVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const earthFrag = /* glsl */ `
  uniform sampler2D uDay;
  uniform sampler2D uNight;
  uniform vec3 uSun;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 l = normalize(uSun);
    float ndl = dot(n, l);

    vec3 dayTex = texture2D(uDay, vUv).rgb;
    vec3 day = pow(dayTex, vec3(0.82)) * 1.85 + vec3(0.03, 0.04, 0.07);

    vec3 nightTex = texture2D(uNight, vUv).rgb;
    float lights = smoothstep(0.08, 0.36, dot(nightTex, vec3(0.33)));
    vec3 nightLand = dayTex * 0.38 + vec3(0.01, 0.015, 0.03);
    vec3 night = nightLand + nightTex * 1.55 * lights;

    float t = smoothstep(-0.0025, 0.0025, ndl);
    vec3 color = mix(night, day, t);

    float line = exp(-ndl * ndl * 9000.0);
    float halo = exp(-ndl * ndl * 2200.0);
    color += vec3(1.0, 0.48, 0.1) * halo * 0.4;
    color = mix(color, vec3(1.0, 0.86, 0.45), line * 0.85);

    float spec = pow(max(ndl, 0.0), 28.0) * 0.18 * t;
    gl_FragColor = vec4(color + vec3(spec), 1.0);
  }
`;

if (typeof window !== "undefined") {
  useTexture.preload("/textures/earth-day.jpg");
  useTexture.preload("/textures/earth-night.png");
  useTexture.preload("/textures/moon.jpg");
}

function Earth({ sun }: { sun: GeoPoint }) {
  const [dayMap, nightMap] = useTexture(["/textures/earth-day.jpg", "/textures/earth-night.png"]);
  dayMap.colorSpace = THREE.SRGBColorSpace;
  nightMap.colorSpace = THREE.SRGBColorSpace;
  const maxAniso = useThree((st) => st.gl.capabilities.getMaxAnisotropy());
  dayMap.anisotropy = Math.min(16, maxAniso);
  nightMap.anisotropy = Math.min(8, maxAniso);
  const uniforms = useMemo(
    () => ({
      uDay: { value: dayMap },
      uNight: { value: nightMap },
      uSun: { value: new THREE.Vector3() },
    }),
    [dayMap, nightMap],
  );

  useFrame(() => {
    latLngToVector3(sun.lat, sun.lng, 1, uniforms.uSun.value).normalize();
  });

  return (
    <mesh>
      <sphereGeometry args={[EARTH_R, 192, 144]} />
      <shaderMaterial
        key="earth-term-v5"
        vertexShader={earthVert}
        fragmentShader={earthFrag}
        uniforms={uniforms}
        toneMapped={false}
      />
    </mesh>
  );
}

function Atmosphere({ sun }: { sun: GeoPoint }) {
  const uniforms = useMemo(() => ({ uSun: { value: new THREE.Vector3() } }), []);
  useFrame(() => {
    latLngToVector3(sun.lat, sun.lng, 1, uniforms.uSun.value).normalize();
  });
  return (
    <mesh scale={1.09}>
      <sphereGeometry args={[EARTH_R, 48, 32]} />
      <shaderMaterial
        side={THREE.BackSide}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vNview;
          varying vec3 vNworld;
          void main() {
            vNview = normalize(normalMatrix * normal);
            vNworld = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 uSun;
          varying vec3 vNview;
          varying vec3 vNworld;
          void main() {
            float rim = pow(0.72 - dot(normalize(vNview), vec3(0.0, 0.0, 1.0)), 2.8);
            float ndl = dot(normalize(vNworld), normalize(uSun));
            float day = smoothstep(0.0, 0.15, ndl);
            float term = exp(-ndl * ndl * 1800.0);
            vec3 col = mix(vec3(0.01, 0.02, 0.05), vec3(0.35, 0.52, 0.95), day);
            col = mix(col, vec3(1.0, 0.55, 0.16), term * 0.7);
            float a = clamp(rim * mix(0.02, 0.4, day) + term * rim * 0.7, 0.0, 0.52);
            gl_FragColor = vec4(col, a);
          }
        `}
      />
    </mesh>
  );
}

function DaySky({ lat, lng, date }: { lat: number; lng: number; date: Date }) {
  const uniforms = useMemo(() => {
    const sun = sunPosition(date, lat, lng);
    const sky = skyPoint(lat, lng, sun.azimuth, sun.altitude, 1);
    return {
      uUp: { value: sky.up.clone() },
      uSunDir: { value: sky.dir.clone() },
      uSunAlt: { value: sun.altitude },
    };
  }, [date, lat, lng]);

  useFrame(() => {
    const sun = sunPosition(date, lat, lng);
    const sky = skyPoint(lat, lng, sun.azimuth, sun.altitude, 1);
    uniforms.uUp.value.copy(sky.up);
    uniforms.uSunDir.value.copy(sky.dir);
    uniforms.uSunAlt.value = sun.altitude;
  });

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
        uniforms,
        vertexShader: `
          varying vec3 vWorld;
          void main() {
            vec4 w = modelMatrix * vec4(position, 1.0);
            vWorld = w.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uUp;
          uniform vec3 uSunDir;
          uniform float uSunAlt;
          varying vec3 vWorld;
          void main() {
            vec3 view = normalize(vWorld - cameraPosition);
            float h = dot(view, normalize(uUp));
            float day = smoothstep(-8.0, 8.0, uSunAlt);
            float twilight = exp(-abs(uSunAlt) * 0.18) * (1.0 - day);
            float zh = smoothstep(-0.04, 0.62, h);
            vec3 dayZenith = vec3(0.32, 0.62, 0.96);
            vec3 dayHoriz = vec3(0.78, 0.9, 0.98);
            vec3 nightZenith = vec3(0.027, 0.031, 0.039);
            vec3 nightHoriz = vec3(0.07, 0.08, 0.11);
            vec3 duskHoriz = vec3(0.92, 0.48, 0.24);
            vec3 col = mix(mix(nightHoriz, nightZenith, zh), mix(dayHoriz, dayZenith, zh), day);
            col = mix(col, mix(duskHoriz, nightZenith, zh), twilight * 0.85);
            vec3 sunD = normalize(uSunDir);
            float sunDot = max(dot(view, sunD), 0.0);
            col += vec3(1.0, 0.88, 0.55) * pow(sunDot, 36.0) * day * 0.55;
            col += vec3(1.0, 0.96, 0.82) * smoothstep(0.9992, 0.9997, sunDot);
            float clouds = 0.5 + 0.5 * sin(view.x * 4.2 + view.z * 1.6);
            clouds *= 0.5 + 0.5 * sin(view.z * 3.1 - view.x * 0.8);
            clouds = smoothstep(0.58, 0.88, clouds) * smoothstep(0.04, 0.22, h) * smoothstep(0.7, 0.28, h);
            col = mix(col, vec3(1.0, 0.98, 0.96), clouds * day * 0.28);
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    [uniforms],
  );

  return (
    <mesh renderOrder={-20} frustumCulled={false}>
      <sphereGeometry args={[120, 32, 20]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

function Marker({ lat, lng }: { lat: number; lng: number }) {
  const group = useRef<THREE.Group>(null);
  const pos = useMemo(() => latLngToVector3(lat, lng, EARTH_R + 0.02), [lat, lng]);
  const quat = useMemo(() => {
    const q = new THREE.Quaternion();
    const dir = pos.clone().normalize();
    if (dir.lengthSq() < 0.0001) return q;
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return q;
  }, [pos]);
  const ring = useRef<THREE.Mesh>(null);

  useFrame(({ camera, clock }) => {
    if (group.current) {
      const dist = camera.position.length();
      const s = THREE.MathUtils.clamp(dist / VIEW_DIST, 0.9, 2.4);
      group.current.scale.setScalar(s);
    }
    if (!ring.current) return;
    const t = (Math.sin(clock.elapsedTime * 2.2) + 1) / 2;
    const s = 1 + t * 1.15;
    ring.current.scale.set(s, s, s);
    const mat = ring.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.7 - t * 0.55;
  });

  return (
    <group ref={group} position={pos} quaternion={quat}>
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]} renderOrder={3}>
        <ringGeometry args={[0.05, 0.068, 40]} />
        <meshBasicMaterial
          color="#c6ff1a"
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0.01, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.028, 8]} />
        <meshBasicMaterial color="#1a1a12" />
      </mesh>
      <mesh position={[0, 0.055, 0]}>
        <sphereGeometry args={[0.032, 16, 16]} />
        <meshBasicMaterial color="#c6ff1a" />
      </mesh>
      <mesh position={[0, 0.11, 0]}>
        <coneGeometry args={[0.018, 0.08, 8]} />
        <meshBasicMaterial color="#c6ff1a" />
      </mesh>
    </group>
  );
}

function GlowSphere({
  point,
  distance,
  size,
  color,
  glow,
  map,
  light,
}: {
  point: GeoPoint;
  distance: number;
  size: number;
  color: string;
  glow: string;
  map?: THREE.Texture;
  light?: boolean;
}) {
  const pos = useMemo(
    () => latLngToVector3(point.lat, point.lng, distance),
    [point.lat, point.lng, distance],
  );
  return (
    <group position={pos}>
      {light ? <pointLight color="#fff1d6" intensity={22} distance={90} decay={2} /> : null}
      <mesh>
        <sphereGeometry args={[size, 24, 24]} />
        <meshStandardMaterial
          map={map}
          color={color}
          emissive={glow}
          emissiveIntensity={map ? 0.18 : 3.4}
          roughness={map ? 0.94 : 0.28}
          metalness={0}
        />
      </mesh>
      <mesh scale={1.55}>
        <sphereGeometry args={[size, 16, 16]} />
        <meshBasicMaterial color={glow} transparent opacity={light ? 0.28 : 0.12} depthWrite={false} />
      </mesh>
    </group>
  );
}

type Pose = {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  up: THREE.Vector3;
  target: THREE.Vector3;
  near: number;
  fov: number;
};

type CamAnim = {
  from: Pose;
  to: Pose;
  elapsed: number;
  duration: number;
  wantFirst: boolean;
};

function quatLook(pos: THREE.Vector3, target: THREE.Vector3, up: THREE.Vector3) {
  const m = new THREE.Matrix4().lookAt(pos, target, up);
  return new THREE.Quaternion().setFromRotationMatrix(m);
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
  return { eye, up, dir, point: eye.clone().addScaledVector(dir, distance) };
}

function skyAim(lat: number, lng: number, date: Date) {
  const sun = sunPosition(date, lat, lng);
  const moon = moonPosition(date, lat, lng);
  const focus = pickSkyFocus(moon.altitude, sun.altitude);
  const azimuth =
    focus === "sun" ? sun.azimuth : focus === "moon" ? moon.azimuth : moon.altitude >= sun.altitude ? moon.azimuth : sun.azimuth;
  return { sun, moon, focus, aim: { azimuth, altitude: HORIZON_ALT }, dist: SKY_MOON_DIST };
}

function firstPersonPose(lat: number, lng: number, date: Date): Pose {
  const { aim, dist } = skyAim(lat, lng, date);
  const sky = skyPoint(lat, lng, aim.azimuth, aim.altitude, dist);
  return {
    pos: sky.eye,
    quat: quatLook(sky.eye, sky.point, sky.up),
    up: sky.up,
    target: sky.point,
    near: FP_NEAR,
    fov: FP_FOV,
  };
}

function applyLook(
  camera: THREE.PerspectiveCamera,
  lat: number,
  lng: number,
  yaw: number,
  pitch: number,
  fov: number,
) {
  const { up, east, north } = localFrame(lat, lng);
  const safePitch = THREE.MathUtils.clamp(pitch, LOOK_PITCH_MIN, LOOK_PITCH_MAX);
  const cp = Math.cos(safePitch);
  _lookEye.copy(up).multiplyScalar(EARTH_R + EYE_HEIGHT);
  _lookDir
    .copy(north)
    .multiplyScalar(Math.cos(yaw) * cp)
    .addScaledVector(east, Math.sin(yaw) * cp)
    .addScaledVector(up, Math.sin(safePitch));
  if (_lookDir.lengthSq() < 1e-10) _lookDir.copy(north);
  else _lookDir.normalize();

  _lookRight.crossVectors(_lookDir, up);
  if (_lookRight.lengthSq() < 1e-5) {
    _lookRight.crossVectors(_lookDir, Math.abs(_lookDir.dot(east)) > 0.2 ? east : north);
  }
  if (_lookRight.lengthSq() < 1e-5) _lookRight.set(1, 0, 0);
  _lookRight.normalize();
  _lookCamUp.crossVectors(_lookRight, _lookDir);
  if (_lookCamUp.lengthSq() < 1e-5) _lookCamUp.copy(up);
  else _lookCamUp.normalize();
  _lookBack.copy(_lookDir).multiplyScalar(-1);

  _lookMat.makeBasis(_lookRight, _lookCamUp, _lookBack);
  camera.quaternion.setFromRotationMatrix(_lookMat);
  camera.position.copy(_lookEye);
  camera.up.copy(_lookCamUp);
  if (!Number.isFinite(camera.quaternion.x) || !Number.isFinite(camera.position.x)) {
    camera.position.copy(_lookEye);
    camera.up.copy(up);
    camera.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), north);
  }
  camera.near = FP_NEAR;
  camera.far = 1400;
  camera.fov = fov;
  camera.updateProjectionMatrix();
}

function globePose(lat: number | null, lng: number | null, fallback: THREE.Vector3): Pose {
  const pos =
    lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
      ? latLngToVector3(lat, lng, VIEW_DIST)
      : fallback.clone().setLength(VIEW_DIST);
  const target = new THREE.Vector3(0, 0, 0);
  const up = new THREE.Vector3(0, 1, 0);
  return {
    pos,
    quat: quatLook(pos, target, up),
    up,
    target,
    near: GLOBE_NEAR,
    fov: GLOBE_FOV,
  };
}

function capturePose(camera: THREE.PerspectiveCamera, target: THREE.Vector3): Pose {
  return {
    pos: camera.position.clone(),
    quat: camera.quaternion.clone(),
    up: camera.up.clone(),
    target: target.clone(),
    near: camera.near,
    fov: camera.fov,
  };
}

function applyPose(camera: THREE.PerspectiveCamera, pose: Pose) {
  camera.position.copy(pose.pos);
  camera.quaternion.copy(pose.quat);
  camera.up.copy(pose.up);
  camera.near = pose.near;
  camera.fov = pose.fov;
  camera.updateProjectionMatrix();
}

function Rig({
  lat,
  lng,
  date,
  firstPerson,
  sun,
  moon,
}: {
  lat: number | null;
  lng: number | null;
  date: Date;
  firstPerson: boolean;
  sun: GeoPoint;
  moon: GeoPoint;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, gl } = useThree();
  const [spin, setSpin] = useState(true);
  const idle = useRef(0);
  const dest = useRef<THREE.Vector3 | null>(null);
  const anim = useRef<CamAnim | null>(null);
  const inFirst = useRef(false);
  const reduceMotion = useRef(false);
  const [locked, setLocked] = useState(false);
  const look = useRef({ yaw: 0, pitch: 0.2, fov: FP_FOV });
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const flick = useRef({ yaw: 0, pitch: 0 });
  const frameSeq = useRef(0);
  const homeSeq = useRef(0);

  useEffect(() => {
    reduceMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    zoomApi.clearDest = () => {
      dest.current = null;
      setSpin(false);
      idle.current = 0;
    };
    return () => {
      zoomApi.clearDest = () => {};
    };
  }, []);

  useEffect(() => {
    const el = gl.domElement;
    const onDown = (e: PointerEvent) => {
      if (!inFirst.current || anim.current) return;
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
    };
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      d.x = e.clientX;
      d.y = e.clientY;
      look.current.yaw -= dx * 0.0034;
      const nextPitch = look.current.pitch + dy * 0.0028;
      look.current.pitch = THREE.MathUtils.clamp(nextPitch, LOOK_PITCH_MIN, LOOK_PITCH_MAX);
      flick.current.yaw = -dx * 0.0034;
      flick.current.pitch =
        look.current.pitch === LOOK_PITCH_MAX || look.current.pitch === LOOK_PITCH_MIN ? 0 : dy * 0.0028;
    };
    const onUp = (e: PointerEvent) => {
      if (drag.current?.id !== e.pointerId) return;
      drag.current = null;
      el.style.cursor = inFirst.current ? "grab" : "";
    };
    const onWheel = (e: WheelEvent) => {
      if (!inFirst.current || anim.current) return;
      e.preventDefault();
      const step = Math.sign(e.deltaY) * Math.min(9, Math.max(3.5, Math.abs(e.deltaY) * 0.045));
      const next = look.current.fov + step;
      look.current.fov = THREE.MathUtils.clamp(next, FP_FOV_MIN, FP_FOV_MAX);
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
      el.style.cursor = "";
    };
  }, [gl]);

  const beginTransition = useCallback(
    (wantFirst: boolean) => {
      const cam = camera as THREE.PerspectiveCamera;
      dest.current = null;
      drag.current = null;
      flick.current.yaw = 0;
      flick.current.pitch = 0;
      setSpin(false);
      setLocked(true);
      idle.current = 0;

      const ahead = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).add(cam.position);
      const from = capturePose(cam, ahead);
      const to =
        wantFirst && lat != null && lng != null
          ? firstPersonPose(lat, lng, date)
          : globePose(lat, lng, cam.position);

      if (wantFirst && lat != null && lng != null) {
        const { aim } = skyAim(lat, lng, date);
        look.current.yaw = (aim.azimuth * Math.PI) / 180;
        look.current.pitch = THREE.MathUtils.clamp((aim.altitude * Math.PI) / 180, LOOK_PITCH_MIN, LOOK_PITCH_MAX);
        look.current.fov = FP_FOV;
      }

      anim.current = {
        from,
        to,
        elapsed: 0,
        duration: reduceMotion.current ? 0.05 : TRANSITION_SEC,
        wantFirst,
      };
    },
    [camera, lat, lng, date],
  );

  useEffect(() => {
    const want = Boolean(firstPerson && lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng));
    if (anim.current) return;
    if (want === inFirst.current) return;
    if (!want && firstPerson) return;
    beginTransition(want);
  }, [firstPerson, lat, lng, beginTransition]);

  useEffect(() => {
    if (firstPerson || inFirst.current || anim.current) return;
    if (lat == null || lng == null) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    dest.current = latLngToVector3(lat, lng, VIEW_DIST);
    systemRefApi.labels = false;
    setSpin(false);
    idle.current = 0;
  }, [lat, lng, firstPerson]);

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.08);
    const c = controls.current;
    const cam = camera as THREE.PerspectiveCamera;
    zoomApi.cam = cam;
    zoomApi.controls = c;
    zoomApi.first = inFirst.current;
    zoomApi.look = look.current;
    const a = anim.current;

    if (a) {
      a.elapsed += d;
      const u = Math.min(1, a.elapsed / Math.max(a.duration, 0.001));
      const e = easeInOutQuint(u);
      lerpRadial(a.from.pos, a.to.pos, e, cam.position);
      cam.quaternion.slerpQuaternions(a.from.quat, a.to.quat, e);
      cam.up.lerpVectors(a.from.up, a.to.up, e).normalize();
      cam.near = THREE.MathUtils.lerp(a.from.near, a.to.near, e);
      cam.fov = THREE.MathUtils.lerp(a.from.fov, a.to.fov, e);
      cam.updateProjectionMatrix();

      if (u >= 1) {
        applyPose(cam, a.to);
        inFirst.current = a.wantFirst;
        anim.current = null;
        gl.domElement.style.cursor = a.wantFirst ? "grab" : "";
        if (!a.wantFirst) {
          cam.up.set(0, 1, 0);
          cam.lookAt(0, 0, 0);
          cam.near = GLOBE_NEAR;
          cam.far = 500;
          cam.fov = GLOBE_FOV;
          cam.updateProjectionMatrix();
          if (frameApi.pending) {
            frameApi.pending = false;
            frameSeq.current = frameApi.seq;
            systemRefApi.labels = true;
            snapSystemView(cam, controls.current, sun, moon);
          } else if (homeApi.pending && lat != null && lng != null) {
            homeApi.pending = false;
            homeSeq.current = homeApi.seq;
            snapHomeView(cam, controls.current, lat, lng, moon);
          }
        }
        setLocked(a.wantFirst);
      }
      publishHeading(cam, a.wantFirst || inFirst.current, lat, lng, look.current.yaw);
      return;
    }

    if (inFirst.current && lat != null && lng != null) {
      try {
        if (!drag.current) {
          look.current.yaw += flick.current.yaw;
          look.current.pitch = THREE.MathUtils.clamp(
            look.current.pitch + flick.current.pitch,
            LOOK_PITCH_MIN,
            LOOK_PITCH_MAX,
          );
          flick.current.yaw *= 0.88;
          flick.current.pitch *= 0.88;
          if (Math.abs(flick.current.yaw) < 0.00015) flick.current.yaw = 0;
          if (Math.abs(flick.current.pitch) < 0.00015) flick.current.pitch = 0;
        }
        look.current.pitch = THREE.MathUtils.clamp(look.current.pitch, LOOK_PITCH_MIN, LOOK_PITCH_MAX);
        applyLook(cam, lat, lng, look.current.yaw, look.current.pitch, look.current.fov);
        cam.layers.enable(1);
        publishHeading(cam, true, lat, lng, look.current.yaw);
      } catch {
        look.current.pitch = THREE.MathUtils.clamp(look.current.pitch, -0.1, 0.6);
        applyLook(cam, lat, lng, look.current.yaw, look.current.pitch, look.current.fov);
      }
      return;
    }

    cam.layers.disable(1);

    if (dest.current) {
      cam.position.lerp(dest.current, 1 - Math.pow(0.001, d));
      if (cam.position.distanceTo(dest.current) < 0.03) {
        cam.position.copy(dest.current);
        dest.current = null;
      }
      c?.target.set(0, 0, 0);
      c?.update();
    }
    if (frameApi.seq !== frameSeq.current && !frameApi.pending) {
      frameSeq.current = frameApi.seq;
      dest.current = null;
      snapSystemView(cam, c, sun, moon);
      setSpin(false);
      idle.current = 0;
    }
    if (homeApi.seq !== homeSeq.current && !homeApi.pending && lat != null && lng != null) {
      homeSeq.current = homeApi.seq;
      dest.current = null;
      snapHomeView(cam, c, lat, lng, moon);
      setSpin(false);
      idle.current = 0;
    }
    if (spin) {
      idle.current = 0;
      publishHeading(cam, false, lat, lng, look.current.yaw);
      return;
    }
    idle.current += d;
    if (idle.current > 6) setSpin(true);
    publishHeading(cam, false, lat, lng, look.current.yaw);
  });

  if (firstPerson || locked) return null;

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.055}
      autoRotate={spin && !reduceMotion.current}
      autoRotateSpeed={0.22}
      minDistance={MIN_DIST}
      maxDistance={MAX_DIST}
      zoomSpeed={1.05}
      rotateSpeed={0.28}
      minPolarAngle={0.18}
      maxPolarAngle={Math.PI - 0.18}
      touches={{
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_ROTATE,
      }}
      onStart={() => {
        dest.current = null;
        systemRefApi.labels = false;
        setSpin(false);
        idle.current = 0;
      }}
    />
  );
}

function FallbackEarth() {
  return (
    <mesh>
      <sphereGeometry args={[EARTH_R, 32, 24]} />
      <meshStandardMaterial color="#1b2430" roughness={1} metalness={0} />
    </mesh>
  );
}

function SkyMoon({ position, map }: { position: THREE.Vector3; map: THREE.Texture }) {
  const mesh = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  const fill = useRef<THREE.AmbientLight>(null);
  const { camera } = useThree();

  useEffect(() => {
    mesh.current?.layers.set(1);
    glow.current?.layers.set(1);
    fill.current?.layers.set(1);
    camera.layers.enable(1);
    return () => {
      camera.layers.disable(1);
    };
  }, [camera]);

  useFrame(() => {
    mesh.current?.lookAt(camera.position);
  });

  return (
    <group position={position}>
      <ambientLight ref={fill} intensity={0.14} color="#c4c0b6" />
      <mesh ref={mesh}>
        <sphereGeometry args={[SKY_MOON_SIZE, 48, 48]} />
        <meshStandardMaterial map={map} color="#eee8dc" roughness={1} metalness={0} />
      </mesh>
      <mesh ref={glow} scale={1.26}>
        <sphereGeometry args={[SKY_MOON_SIZE, 24, 24]} />
        <meshBasicMaterial color="#d4cfc4" transparent opacity={0.18} depthWrite={false} />
      </mesh>
    </group>
  );
}

function SceneContent(props: GlobeSceneProps) {
  const moonMap = useTexture("/textures/moon.jpg");
  moonMap.colorSpace = THREE.SRGBColorSpace;
  const sunPos = useMemo(
    () => latLngToVector3(props.sun.lat, props.sun.lng, 9),
    [props.sun.lat, props.sun.lng],
  );
  const showMarker = Boolean(
    props.marker && Number.isFinite(props.marker.lat) && Number.isFinite(props.marker.lng) && !props.firstPerson,
  );
  const skyBodies = useMemo(() => {
    if (!props.firstPerson || !props.marker) return null;
    const { lat, lng } = props.marker;
    const sun = sunPosition(props.date, lat, lng);
    const moon = moonPosition(props.date, lat, lng);
    return {
      sun: skyPoint(lat, lng, sun.azimuth, sun.altitude, SKY_SUN_DIST).point,
      moon: skyPoint(lat, lng, moon.azimuth, moon.altitude, SKY_MOON_DIST).point,
      sunUp: sun.altitude > -1,
      moonUp: moon.altitude > -1,
      sunAlt: sun.altitude,
    };
  }, [props.firstPerson, props.marker, props.date]);

  const day = skyBodies ? THREE.MathUtils.clamp((skyBodies.sunAlt + 8) / 16, 0, 1) : 0;

  return (
    <>
      <color attach="background" args={[skyBodies ? (day > 0.45 ? "#6aa4e0" : "#07080a") : "#07080a"]} />
      <ambientLight intensity={props.firstPerson ? 0.28 + day * 0.4 : 0.22} />
      <hemisphereLight args={["#9eb6ff", "#1a120c", props.firstPerson ? 0.32 + day * 0.3 : 0.35]} />
      <directionalLight color="#fff6e8" intensity={props.firstPerson ? 0.55 + day * 1.05 : 1.7} position={sunPos} />
      {skyBodies ? <DaySky lat={props.marker!.lat} lng={props.marker!.lng} date={props.date} /> : null}
      <Earth sun={props.sun} />
      {props.firstPerson ? null : <Atmosphere sun={props.sun} />}
      {props.firstPerson ? null : (
        <Stars
          radius={110}
          depth={50}
          count={props.scientific ? 400 : 1600}
          factor={props.scientific ? 1.2 : 2.6}
          saturation={0}
          fade
          speed={0.12}
        />
      )}
      {skyBodies ? (
        <>
          {skyBodies.sunUp ? (
            <group position={skyBodies.sun}>
              <pointLight
                color="#fff1d6"
                intensity={14}
                distance={48}
                decay={2}
                ref={(light) => {
                  light?.layers.enable(1);
                }}
              />
              <mesh>
                <sphereGeometry args={[SKY_SUN_SIZE, 24, 24]} />
                <meshBasicMaterial color="#fff6d8" />
              </mesh>
              <mesh scale={2.4}>
                <sphereGeometry args={[SKY_SUN_SIZE, 16, 16]} />
                <meshBasicMaterial color="#ffe4bd" transparent opacity={0.22} depthWrite={false} />
              </mesh>
            </group>
          ) : null}
          {skyBodies.moonUp ? <SkyMoon position={skyBodies.moon} map={moonMap} /> : null}
        </>
      ) : (
        <>
          <GlowSphere point={props.sun} distance={SUN_DIST} size={0.42} color="#fff7ea" glow="#ffe4bd" light />
          <GlowSphere point={props.moon} distance={MOON_DIST} size={0.24} color="#d8d4ce" glow="#9aa3b0" map={moonMap} />
        </>
      )}
      {showMarker ? <Marker lat={props.marker!.lat} lng={props.marker!.lng} /> : null}
      <SkyLayer
        date={props.date}
        marker={props.marker}
        firstPerson={props.firstPerson}
        showConstellations={props.showConstellations}
        showPlanets={props.showPlanets}
        scientific={props.scientific}
        planets={props.planets}
        sun={props.sun}
        moon={props.moon}
        onHover={props.onHover}
        onIdentify={props.onIdentify}
      />
      <Rig
        lat={props.marker?.lat ?? null}
        lng={props.marker?.lng ?? null}
        date={props.date}
        firstPerson={props.firstPerson}
        sun={props.sun}
        moon={props.moon}
      />
    </>
  );
}

class CanvasGuard extends Component<{ children: ReactNode; onError: () => void }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    if (this.state.crashed) return null;
    return this.props.children;
  }
}

export function GlobeScene(props: GlobeSceneProps) {
  const [rendererId, setRendererId] = useState(0);
  const recover = useCallback(() => {
    window.setTimeout(() => setRendererId((n) => n + 1), 120);
  }, []);

  return (
    <div className="absolute inset-0 h-full w-full">
      <CanvasGuard key={rendererId} onError={recover}>
        <Canvas
          camera={{ position: [0, 0.62, VIEW_DIST], fov: GLOBE_FOV, near: GLOBE_NEAR, far: 500 }}
          dpr={[1, 1.5]}
          gl={{
            antialias: false,
            alpha: false,
            powerPreference: "default",
            failIfMajorPerformanceCaveat: false,
          }}
          style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }}
          className="h-full w-full touch-none"
          resize={{ debounce: 80 }}
          onCreated={({ gl }) => {
            gl.setClearColor("#07080a");
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.05;
            const canvas = gl.domElement;
            const onLost = (event: Event) => {
              event.preventDefault();
              recover();
            };
            canvas.addEventListener("webglcontextlost", onLost, false);
          }}
        >
          <Suspense fallback={<FallbackEarth />}>
            <SceneContent {...props} />
          </Suspense>
        </Canvas>
      </CanvasGuard>
      {props.scientific ? null : (
      <div className="pointer-events-none absolute top-1/2 right-2 z-10 flex -translate-y-1/2 flex-col gap-1.5">
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="pointer-events-auto size-8 [&_svg]:size-3.5"
          aria-label="Zoom in"
          onClick={() => applyZoom(-1)}
        >
          <Plus />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="pointer-events-auto size-8 [&_svg]:size-3.5"
          aria-label="Zoom out"
          onClick={() => applyZoom(1)}
        >
          <Minus />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="pointer-events-auto size-8 [&_svg]:size-3.5"
          aria-label="Center on pin"
          title="Center on pin"
          disabled={!props.marker}
          onClick={() => requestHomeView(Boolean(props.marker), props.onFirstPerson)}
        >
          <Crosshair />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="pointer-events-auto size-8 [&_svg]:size-3.5"
          aria-label="Earth, Moon and Sun"
          title="Earth, Moon and Sun"
          onClick={() => requestSystemView(props.onFirstPerson)}
        >
          <SunMoon />
        </Button>
      </div>
      )}
      <CompassHud muted={props.scientific} />
      <SkyTagHud muted={props.scientific} />
    </div>
  );
}

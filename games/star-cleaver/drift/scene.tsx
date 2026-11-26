'use client';
/**
 * Helion Drift — the R3F scene. Reads the sim every frame; never owns state.
 * Floating origin: the player ship is always at (0,0,0); everything else is
 * drawn at (worldPos - origin), so precision holds from cockpit to Pluto.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Runtime } from './runtime';
import type { Body } from './solar';
import { OBLIQUITY_RAD, planetPositionAU, AU_UNITS } from './solar';
import { asteroidsNear, mulberry32, DOCK_RANGE, BELT_INNER, BELT_OUTER, BELT_HALF_THICKNESS } from './world';
import { buildShrike, SHRIKE_NOZZLES } from './ship-model';
import { FX } from './fx';
import { glowTexture, flareTexture, ringTexture, alienMaps, rockTexture, gunmetalTexture } from './textures';
import { atmosphereMaterial, shieldMaterial, starMaterial, panoramaMaterial } from './shaders';
import { planetsData } from '../../../components/universe-engine/astronomy';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _s = new THREE.Vector3();
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function rel(out: THREE.Object3D, world: THREE.Vector3, origin: THREE.Vector3) {
  out.position.set(world.x - origin.x, world.y - origin.y, world.z - origin.z);
}

// ---------------------------------------------------------------- textures
const texCache = new Map<string, THREE.Texture>();
function useTex(url: string | null, srgb = true) {
  const [t, setT] = useState<THREE.Texture | null>(() => (url ? texCache.get(url) ?? null : null));
  useEffect(() => {
    if (!url) return;
    const hit = texCache.get(url);
    if (hit) { setT(hit); return; }
    let live = true;
    new THREE.TextureLoader().load(url, (tx) => {
      tx.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      tx.anisotropy = 8;
      texCache.set(url, tx);
      if (live) setT(tx);
    }, undefined, () => { /* missing texture → keep the tint */ });
    return () => { live = false; };
  }, [url, srgb]);
  return t;
}

// ---------------------------------------------------------------- environment
function EnvSetup() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.22;
    return () => { scene.environment = null; env.dispose(); pmrem.dispose(); };
  }, [gl, scene]);
  return null;
}

// ---------------------------------------------------------------- sky (real stars + real Milky Way)
function raDecDir(raHours: number, decDeg: number) {
  const ra = (raHours / 12) * Math.PI, dec = (decDeg * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(dec) * Math.cos(ra), Math.sin(dec), Math.cos(dec) * Math.sin(ra));
}
function galacticBasis() {
  const z = raDecDir(12.8571, 27.128);
  const x = raDecDir(17.7611, -28.936);
  x.addScaledVector(z, -z.dot(x)).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  return { x, y, z };
}

function Sky({ rt }: { rt: Runtime }) {
  const group = useRef<THREE.Group>(null);
  const { gl } = useThree();
  const [stars, setStars] = useState<THREE.Points | null>(null);
  const high = rt.settings.quality === 'high';
  const pano = useTex(high ? '/textures/allsky-brunier-4k.webp' : '/textures/allsky-brunier-2k.webp');
  const panoMat = useMemo(() => {
    if (!pano) return null;
    const b = galacticBasis();
    return panoramaMaterial(pano, b.x, b.y, b.z, 0.42);
  }, [pano]);

  useEffect(() => {
    const ac = new AbortController();
    fetch('/data/deep-stars.bin', { signal: ac.signal }).then((r) => r.arrayBuffer()).then((buf) => {
      const N = new Uint32Array(buf, 0, 1)[0];
      const cap = high ? N : Math.min(N, 26000);
      const pos16 = new Int16Array(buf, 4, N * 3);
      const col8 = new Uint8Array(buf, 4 + N * 6, N * 3);
      const mag8 = new Uint8Array(buf, 4 + N * 9, N);
      const R = 2.0e6;
      const pos = new Float32Array(cap * 3), col = new Float32Array(cap * 3), mag = new Float32Array(cap);
      for (let i = 0; i < cap; i++) {
        const x = pos16[i * 3], y = pos16[i * 3 + 1], z = pos16[i * 3 + 2];
        const l = Math.hypot(x, y, z) || 1;
        pos[i * 3] = (x / l) * R; pos[i * 3 + 1] = (y / l) * R; pos[i * 3 + 2] = (z / l) * R;
        col[i * 3] = col8[i * 3] / 255; col[i * 3 + 1] = col8[i * 3 + 1] / 255; col[i * 3 + 2] = col8[i * 3 + 2] / 255;
        mag[i] = mag8[i] / 8 - 2;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 1.1);
      const pts = new THREE.Points(geo, starMaterial(Math.min(2, gl.getPixelRatio())));
      pts.frustumCulled = false;
      pts.renderOrder = -9;
      setStars(pts);
    }).catch(() => { /* offline: the panorama still carries the sky */ });
    return () => ac.abort();
  }, [gl, high]);

  useFrame(({ camera }) => {
    if (!group.current) return;
    group.current.position.copy(camera.position);
    if (stars) {
      // stars wash out in cruise and near the Sun's glare
      const cruise = rt.sim.ship.cruise === 'on' ? 0.55 : 1;
      (stars.material as THREE.ShaderMaterial).uniforms.uFade.value = cruise;
    }
  }, -1);

  return (
    <group ref={group} rotation={[OBLIQUITY_RAD, 0, 0]}>
      {panoMat && (
        <mesh material={panoMat} renderOrder={-10} frustumCulled={false}>
          <sphereGeometry args={[2.6e6, 48, 32]} />
        </mesh>
      )}
      {stars && <primitive object={stars} />}
    </group>
  );
}

// ---------------------------------------------------------------- sun
function Sun({ rt, body }: { rt: Runtime; body: Body }) {
  const g = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Sprite>(null);
  const flare = useRef<THREE.Sprite>(null);
  const light = useRef<THREE.PointLight>(null);
  const tex = useTex('/textures/sun.webp');
  useFrame(({ camera }, dt) => {
    if (!g.current) return;
    rel(g.current, body.pos, rt.origin);
    if (light.current) light.current.position.copy(g.current.position);
    if (mesh.current) mesh.current.rotation.y += dt * 0.01;
    const d = camera.position.distanceTo(g.current.position);
    const r = body.radius;
    if (glow.current) glow.current.scale.setScalar(Math.max(r * 6, d * 0.06));
    if (flare.current) flare.current.scale.setScalar(Math.max(r * 12, d * 0.11));
  }, -1);
  return (
    <>
      <pointLight ref={light} intensity={3.1} decay={0} distance={0} color="#fff3e2" />
      <group ref={g}>
        <mesh ref={mesh}>
          <sphereGeometry args={[body.radius, 64, 48]} />
          <meshBasicMaterial key={tex ? 'tex' : 'flat'} map={tex} color={tex ? '#ffe2b0' : '#ffcf70'} toneMapped={false} />
        </mesh>
        <sprite ref={glow} renderOrder={5}>
          <spriteMaterial map={glowTexture()} color="#ffc56b" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0.95} />
        </sprite>
        <sprite ref={flare} renderOrder={5}>
          <spriteMaterial map={flareTexture()} color="#ffe0b0" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0.55} />
        </sprite>
      </group>
    </>
  );
}

// ---------------------------------------------------------------- planets & moons
function ringGeometry(inner: number, outer: number) {
  const g = new THREE.RingGeometry(inner, outer, 180, 1);
  const p = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  for (let i = 0; i < p.count; i++) {
    const r = Math.hypot(p.getX(i), p.getY(i));
    uv.setXY(i, (r - inner) / (outer - inner), 0.5);
  }
  g.rotateX(-Math.PI / 2);
  return g;
}

function Planet({ rt, body }: { rt: Runtime; body: Body }) {
  const g = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Mesh>(null);
  const map = useTex(body.texture);
  const ringTex = useTex(body.rings?.texture ?? null);
  const atmo = useMemo(() => (body.atmosphere ? atmosphereMaterial(body.atmosphere.color, body.atmosphere.strength) : null), [body]);
  const ringGeo = useMemo(() => (body.rings ? ringGeometry(body.rings.inner, body.rings.outer) : null), [body]);
  const seg = body.radius > 1000 ? 96 : 64;
  useFrame((_, dt) => {
    if (!g.current) return;
    rel(g.current, body.pos, rt.origin);
    if (spin.current) spin.current.rotation.y += body.spin * dt;
    if (atmo) {
      // sun direction in world space (sun at world origin)
      _v.copy(body.pos).negate().normalize();
      atmo.uniforms.uSun.value.copy(_v);
    }
  }, -1);
  return (
    <group ref={g}>
      <group rotation={[0, 0, THREE.MathUtils.degToRad(body.tiltDeg)]}>
        <mesh ref={spin}>
          <sphereGeometry args={[body.radius, seg, Math.round(seg * 0.66)]} />
          <meshStandardMaterial key={map ? 'tex' : 'flat'} map={map} color={map ? '#ffffff' : body.tint} roughness={1} metalness={0} />
        </mesh>
        {ringGeo && (
          <mesh geometry={ringGeo} renderOrder={2}>
            <meshStandardMaterial key={ringTex ? 'tex' : 'flat'} map={ringTex} color={ringTex ? '#ffffff' : '#d8c8a0'} transparent side={THREE.DoubleSide} depthWrite={false} roughness={1} metalness={0} alphaTest={0.02} />
          </mesh>
        )}
      </group>
      {atmo && (
        <mesh material={atmo} renderOrder={3}>
          <sphereGeometry args={[body.radius * 1.045, 64, 40]} />
        </mesh>
      )}
    </group>
  );
}

function Orbits({ rt }: { rt: Runtime }) {
  const g = useRef<THREE.Group>(null);
  const lines = useMemo(() => {
    const now = Date.now();
    return planetsData.map((p) => {
      const pts: THREE.Vector3[] = [];
      const N = 360;
      for (let i = 0; i <= N; i++) pts.push(planetPositionAU(p.name, now + (i / N) * p.periodDays * 86_400_000).multiplyScalar(AU_UNITS));
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#8fb4ff', transparent: true, opacity: 0.12, depthWrite: false }));
    });
  }, []);
  useFrame(() => {
    if (!g.current) return;
    g.current.position.set(-rt.origin.x, -rt.origin.y, -rt.origin.z);
    g.current.visible = rt.settings.showOrbits;
  }, -1);
  return <group ref={g}>{lines.map((l, i) => <primitive key={i} object={l} />)}</group>;
}

/** The asteroid belt + Jupiter trojans as faint dust, visible from anywhere. */
function BeltDust({ rt }: { rt: Runtime }) {
  const g = useRef<THREE.Group>(null);
  const pts = useMemo(() => {
    const rng = mulberry32(99);
    const n = rt.settings.quality === 'high' ? 26000 : 10000;
    const pos = new Float32Array(n * 3);
    const jup = rt.sim.body('Jupiter')!;
    const rj = Math.hypot(jup.pos.x, jup.pos.z), aj = Math.atan2(jup.pos.z, jup.pos.x);
    for (let i = 0; i < n; i++) {
      let r: number, a: number, y: number;
      if (i < n * 0.8) {
        r = BELT_INNER + (BELT_OUTER - BELT_INNER) * (0.5 + (rng() + rng() + rng() - 1.5) / 3);
        a = rng() * Math.PI * 2;
        y = (rng() + rng() - 1) * BELT_HALF_THICKNESS * 1.5;
      } else {
        const side = i % 2 ? 1 : -1;
        r = rj + (rng() - 0.5) * 0.5 * AU_UNITS;
        a = aj + side * Math.PI / 3 + (rng() - 0.5) * 0.35;
        y = (rng() - 0.5) * 0.12 * AU_UNITS;
      }
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#9a8f80', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.55, depthWrite: false }));
    p.frustumCulled = false;
    return p;
  }, [rt]);
  useFrame(() => { if (g.current) g.current.position.set(-rt.origin.x, -rt.origin.y, -rt.origin.z); }, -1);
  return <group ref={g}><primitive object={pts} /></group>;
}

// ---------------------------------------------------------------- stations
function normalizeModel(src: THREE.Object3D, size: number) {
  const obj = src.clone(true);
  const box = new THREE.Box3().setFromObject(obj);
  const dim = box.getSize(new THREE.Vector3());
  const s = size / Math.max(dim.x, dim.y, dim.z);
  const c = box.getCenter(new THREE.Vector3());
  const wrap = new THREE.Group();
  obj.position.sub(c);
  wrap.add(obj);
  wrap.scale.setScalar(s);
  return wrap;
}

function Stations({ rt }: { rt: Runtime }) {
  const gltf = useGLTF('/models/station.glb');
  const refs = useRef<(THREE.Group | null)[]>([]);
  const beacons = useRef<(THREE.Sprite | null)[]>([]);
  const zones = useRef<(THREE.Sprite | null)[]>([]);
  const models = useMemo(() => rt.sim.stations.map(() => normalizeModel(gltf.scene, 240)), [gltf, rt]);
  useFrame(({ camera, clock }) => {
    const sim = rt.sim;
    sim.stations.forEach((s, i) => {
      const g = refs.current[i];
      if (!g) return;
      rel(g, s.pos, rt.origin);
      g.rotation.x = clock.elapsedTime * 0.04 + i;
      const d = camera.position.distanceTo(g.position);
      const z = zones.current[i];
      if (z) {
        const dockable = sim.dockable?.id === s.id;
        z.visible = d < 4000 && !sim.ship.dockedAt;
        z.scale.setScalar(DOCK_RANGE * 2);
        (z.material as THREE.SpriteMaterial).opacity = dockable ? 0.35 + 0.15 * Math.sin(clock.elapsedTime * 5) : 0.08;
        (z.material as THREE.SpriteMaterial).color.set(dockable ? '#7dffb0' : '#7fb8ff');
      }
      const b = beacons.current[i];
      if (b) {
        const on = (clock.elapsedTime * 1.2 + i * 0.3) % 1 < 0.18;
        b.scale.setScalar(on ? Math.max(30, d * 0.012) : Math.max(14, d * 0.005));
      }
    });
  }, -1);
  return (
    <>
      {models.map((m, i) => (
        <group key={i} ref={(el) => { refs.current[i] = el; }}>
          <primitive object={m} />
          <sprite ref={(el) => { beacons.current[i] = el; }} position={[0, 30, 0]} renderOrder={6}>
            <spriteMaterial map={glowTexture()} color="#9dffcf" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </sprite>
          <sprite ref={(el) => { zones.current[i] = el; }} renderOrder={6}>
            <spriteMaterial map={ringTexture()} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </sprite>
        </group>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- hostile bases
function buildBaseMesh(tier: number) {
  const { map, emissive } = alienMaps();
  const hull = new THREE.MeshStandardMaterial({ map, emissiveMap: emissive, emissive: '#ff3c9e', emissiveIntensity: 2.4, metalness: 0.55, roughness: 0.42, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ map: gunmetalTexture(), color: '#3a2a35', metalness: 0.8, roughness: 0.5 });
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(58, 1), hull);
  g.add(core);
  const spikes = 6 + tier * 2;
  for (let i = 0; i < spikes; i++) {
    const y = 1 - ((i + 0.5) / spikes) * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996;
    const dir = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    const len = 70 + (i % 3) * 30;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(9, len, 5), hull);
    cone.position.copy(dir).multiplyScalar(52 + len / 2);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    g.add(cone);
  }
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(118, 4.5, 6, 48), dark);
  ring1.rotation.x = Math.PI / 2;
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(150, 3, 6, 56), dark);
  ring2.rotation.set(Math.PI / 2.6, 0.4, 0);
  g.add(ring1, ring2);
  for (let i = 0; i < 4 + tier; i++) {
    const pod = new THREE.Mesh(new THREE.OctahedronGeometry(14, 0), hull);
    const a = (i / (4 + tier)) * Math.PI * 2;
    pod.position.set(Math.cos(a) * 118, 0, Math.sin(a) * 118);
    g.add(pod);
  }
  return { group: g, rings: [ring1, ring2] };
}

function turretMesh() {
  const { map, emissive } = alienMaps();
  const hull = new THREE.MeshStandardMaterial({ map, emissiveMap: emissive, emissive: '#ff3c9e', emissiveIntensity: 2, metalness: 0.5, roughness: 0.45, flatShading: true });
  const metal = new THREE.MeshStandardMaterial({ color: '#2a2228', metalness: 0.9, roughness: 0.35 });
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(9, 11, 5, 6), metal);
  base.rotation.x = Math.PI / 2;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(7, 10, 8), hull);
  g.add(base, dome);
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 14), metal);
    b.position.set(s * 3, 1, -8);
    g.add(b);
  }
  const eye = new THREE.Mesh(new THREE.SphereGeometry(1.8, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff4fb0', toneMapped: false }));
  eye.position.set(0, 2, -5.5);
  g.add(eye);
  return g;
}

function Bases({ rt }: { rt: Runtime }) {
  const root = useRef<THREE.Group>(null);
  const items = useMemo(() => rt.sim.bases.map((b) => {
    const m = buildBaseMesh(b.def.tier);
    const shield = new THREE.Mesh(new THREE.SphereGeometry(118, 48, 32), shieldMaterial('#ff4fb0'));
    shield.renderOrder = 8;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ff4fb0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    glow.scale.setScalar(520);
    m.group.add(shield, glow);
    return { base: b, ...m, shield, glow };
  }), [rt]);
  useEffect(() => {
    const r = root.current;
    if (!r) return;
    items.forEach((it) => r.add(it.group));
    return () => { items.forEach((it) => r.remove(it.group)); };
  }, [items]);
  useFrame(({ clock }, dt) => {
    for (const it of items) {
      const b = it.base;
      it.group.visible = !b.destroyed;
      if (b.destroyed) continue;
      rel(it.group, b.pos, rt.origin);
      it.group.rotation.y += dt * 0.05;
      it.rings[0].rotation.z += dt * 0.25;
      it.rings[1].rotation.z -= dt * 0.18;
      const shielded = b.turretIds.some((id) => rt.sim.enemy(id));
      const mat = it.shield.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value = clock.elapsedTime;
      mat.uniforms.uOpacity.value = THREE.MathUtils.lerp(mat.uniforms.uOpacity.value, shielded ? 0.55 : 0, 1 - Math.exp(-4 * dt));
      it.shield.visible = mat.uniforms.uOpacity.value > 0.01;
      const pulse = 0.55 + 0.25 * Math.sin(clock.elapsedTime * 2 + b.def.tier);
      (it.glow.material as THREE.SpriteMaterial).opacity = (b.alert ? 0.5 : 0.25) * pulse;
    }
  }, -1);
  return <group ref={root} />;
}

// ---------------------------------------------------------------- asteroids (instanced, procedural)
function rockGeometry(seed: number, detail: number) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.getAttribute('position');
  const rng = mulberry32(seed);
  const bumps = Array.from({ length: 14 }, () => ({ d: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(), s: 0.15 + rng() * 0.35, w: 0.25 + rng() * 0.5 }));
  const craters = Array.from({ length: 7 }, () => ({ d: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(), r: 0.2 + rng() * 0.25 }));
  const v = new THREE.Vector3();
  const stretch = new THREE.Vector3(0.85 + rng() * 0.45, 0.7 + rng() * 0.3, 0.8 + rng() * 0.4);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    let r = 1;
    for (const b of bumps) r += b.s * Math.max(0, v.dot(b.d) - (1 - b.w)) / b.w * 0.6;
    for (const c of craters) { const d = v.distanceTo(c.d); if (d < c.r) r -= (1 - (d / c.r) ** 2) * 0.12; }
    r += (Math.sin(v.x * 9 + seed) * Math.sin(v.y * 11) * Math.sin(v.z * 7)) * 0.05;
    v.multiplyScalar(r).multiply(stretch);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  // box UVs for the rock texture
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const nrm = g.getAttribute('normal');
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(nrm.getX(i)), ay = Math.abs(nrm.getY(i)), az = Math.abs(nrm.getZ(i));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (ax > ay && ax > az) uv.setXY(i, z * 0.7, y * 0.7); else if (ay > az) uv.setXY(i, x * 0.7, z * 0.7); else uv.setXY(i, x * 0.7, y * 0.7);
  }
  return g;
}

function Asteroids({ rt }: { rt: Runtime }) {
  const high = rt.settings.quality === 'high';
  const CAP = high ? 1400 : 700;
  const meshes = useMemo(() => [0, 1].map((type) => {
    const geo = rockGeometry(type ? 777 : 333, high ? 3 : 2);
    const mat = new THREE.MeshStandardMaterial({ map: rockTexture(type as 0 | 1), roughness: 0.95, metalness: type ? 0.05 : 0.12 });
    const m = new THREE.InstancedMesh(geo, mat, CAP);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.count = 0;
    return m;
  }), [CAP, high]);
  const list = useRef<ReturnType<typeof asteroidsNear>>([]);
  const refreshT = useRef(0);
  useFrame((state, dt) => {
    const sim = rt.sim;
    refreshT.current -= dt;
    if (refreshT.current <= 0) {
      refreshT.current = sim.ship.cruise === 'on' ? 0.15 : 0.3;
      list.current = asteroidsNear(rt.origin, high ? 7000 : 4500, sim.sampler, sim.destroyedRocks, sim.rockCache);
    }
    const counts = [0, 0];
    const t = state.clock.elapsedTime;
    for (const a of list.current) {
      if (a.hp <= 0) continue;
      const m = meshes[a.type];
      const i = counts[a.type];
      if (i >= CAP) continue;
      counts[a.type]++;
      _q.setFromAxisAngle(a.axis, a.phase + t * a.spin);
      _v.set(a.pos.x - rt.origin.x, a.pos.y - rt.origin.y, a.pos.z - rt.origin.z);
      _s.setScalar(a.radius);
      _m.compose(_v, _q, _s);
      m.setMatrixAt(i, _m);
    }
    meshes.forEach((m, k) => { m.count = counts[k]; m.instanceMatrix.needsUpdate = true; });
  }, -1);
  return <>{meshes.map((m, i) => <primitive key={i} object={m} />)}</>;
}

// ---------------------------------------------------------------- enemies
function Enemies({ rt }: { rt: Runtime }) {
  const fighter = useGLTF('/models/enemy-fighter.glb');
  const sniper = useGLTF('/models/enemy-sniper.glb');
  const swarm = useGLTF('/models/enemy-swarm.glb');
  const root = useRef<THREE.Group>(null);
  const live = useRef(new Map<number, THREE.Object3D>());
  const protos = useMemo(() => ({
    fighter: normalizeModel(fighter.scene, 15),
    sniper: normalizeModel(sniper.scene, 17),
    swarm: normalizeModel(swarm.scene, 9),
    turret: turretMesh(),
  }), [fighter, sniper, swarm]);
  const glowMat = useMemo(() => new THREE.SpriteMaterial({ map: glowTexture(), color: '#ff4a6a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), []);

  useFrame(() => {
    const r = root.current;
    if (!r) return;
    const seen = new Set<number>();
    for (const e of rt.sim.enemies) {
      if (!e.alive) continue;
      // turrets far away aren't worth drawing
      if (e.kind === 'turret' && e.pos.distanceToSquared(rt.origin) > 20000 ** 2) continue;
      seen.add(e.id);
      let obj = live.current.get(e.id);
      if (!obj) {
        obj = new THREE.Group();
        obj.add(protos[e.kind].clone(true));
        if (e.kind !== 'turret') {
          const gl = new THREE.Sprite(glowMat);
          gl.scale.setScalar(e.kind === 'swarm' ? 5 : 8);
          gl.position.set(0, 0, e.kind === 'swarm' ? 4 : 8);
          obj.add(gl);
        }
        live.current.set(e.id, obj);
        r.add(obj);
      }
      rel(obj, e.pos, rt.origin);
      obj.quaternion.copy(e.quat);
    }
    for (const [id, obj] of live.current) {
      if (!seen.has(id)) { r.remove(obj); live.current.delete(id); }
    }
  }, -1);
  return <group ref={root} />;
}

// ---------------------------------------------------------------- projectiles + loot
function Projectiles({ rt }: { rt: Runtime }) {
  const CAP = 900;
  const [core, halo] = useMemo(() => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mk = (op: number) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), CAP);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.setColorAt(0, new THREE.Color());
      m.frustumCulled = false;
      m.count = 0;
      return m;
    };
    return [mk(1), mk(0.32)];
  }, []);
  const cPlayer = useMemo(() => new THREE.Color('#ffd27a').multiplyScalar(2.2), []);
  const cEnemy = useMemo(() => new THREE.Color('#ff3d7f').multiplyScalar(2.2), []);
  const cTorp = useMemo(() => new THREE.Color('#8fe3ff').multiplyScalar(2.6), []);
  useFrame((_, dt) => {
    let n = 0;
    for (const p of rt.sim.projectiles) {
      if (n >= CAP) break;
      const speed = p.vel.length();
      if (speed < 1) continue;
      _v2.copy(p.vel).divideScalar(speed);
      _q.setFromUnitVectors(Z_AXIS, _v2);
      const len = p.kind === 'torp' ? 5 : p.team === 'player' ? Math.min(34, speed * 0.028) : Math.min(24, speed * 0.02);
      const w = p.kind === 'torp' ? 1.8 : p.team === 'player' ? 0.85 : 0.9;
      _v.set(p.pos.x - rt.origin.x, p.pos.y - rt.origin.y, p.pos.z - rt.origin.z).addScaledVector(_v2, -len / 2);
      _s.set(w, w, len);
      _m.compose(_v, _q, _s);
      core.setMatrixAt(n, _m);
      _s.set(w * 3.6, w * 3.6, len * 1.15);
      _m.compose(_v, _q, _s);
      halo.setMatrixAt(n, _m);
      const c = p.kind === 'torp' ? cTorp : p.team === 'player' ? cPlayer : cEnemy;
      core.setColorAt(n, c); halo.setColorAt(n, c);
      if (p.kind === 'torp' && rt.fx) rt.fx.exhaust(p.pos, p.vel, _v2.clone().negate(), 0.9, new THREE.Color('#8fe3ff'));
      n++;
    }
    for (const m of [core, halo]) {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    void dt;
  }, -1);
  return <><primitive object={halo} /><primitive object={core} /></>;
}

function LootField({ rt }: { rt: Runtime }) {
  const CAP = 300;
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1.8, 0), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), CAP);
    m.setColorAt(0, new THREE.Color());
    m.frustumCulled = false; m.count = 0;
    return m;
  }, []);
  const cols = useMemo(() => ({ ore: new THREE.Color('#ffae4a').multiplyScalar(1.6), fuel: new THREE.Color('#6fe3ff').multiplyScalar(1.6), salvage: new THREE.Color('#8dff9a').multiplyScalar(1.6) }), []);
  useFrame(({ clock }) => {
    let n = 0;
    for (const l of rt.sim.loot) {
      if (n >= CAP) break;
      _v.set(l.pos.x - rt.origin.x, l.pos.y - rt.origin.y, l.pos.z - rt.origin.z);
      _q.setFromAxisAngle(_v2.set(0.3, 1, 0.2).normalize(), clock.elapsedTime * 2 + l.id);
      _s.setScalar(l.kind === 'salvage' ? 1.3 : 1);
      _m.compose(_v, _q, _s);
      mesh.setMatrixAt(n, _m);
      mesh.setColorAt(n, cols[l.kind]);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, -1);
  return <primitive object={mesh} />;
}

// ---------------------------------------------------------------- player ship
function PlayerShip({ rt }: { rt: Runtime }) {
  const parts = useMemo(() => buildShrike(), []);
  const root = useRef<THREE.Group>(null);
  const glows = useRef<THREE.Sprite[]>([]);
  const shield = useMemo(() => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(6.2, 32, 20), shieldMaterial('#8fe3ff'));
    m.scale.set(1, 0.55, 1.25);
    m.renderOrder = 9;
    (m.material as THREE.ShaderMaterial).uniforms.uOpacity.value = 0;
    return m;
  }, []);
  const flash = useRef(0);
  useEffect(() => {
    const r = root.current;
    if (!r) return;
    r.add(parts.group, shield);
    const gs: THREE.Sprite[] = [];
    for (const n of SHRIKE_NOZZLES) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffb066', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      s.position.copy(n).add(new THREE.Vector3(0, 0, 0.4));
      parts.group.add(s);
      gs.push(s);
    }
    glows.current = gs;
    return () => { r.remove(parts.group, shield); };
  }, [parts, shield]);

  useFrame(({ clock }, dt) => {
    const sim = rt.sim, sh = sim.ship;
    const r = root.current;
    if (!r) return;
    r.visible = sh.alive && !sh.dockedAt;
    r.position.set(0, 0, 0);
    r.quaternion.copy(sh.quat);
    const thr = sh.cruise === 'on' ? 1.6 : sh.boosting ? 1.35 : Math.max(0.12, Math.abs(sh.throttle));
    const flick = 0.9 + Math.random() * 0.2;
    glows.current.forEach((s) => { s.scale.setScalar((1.0 + thr * 1.7) * flick); (s.material as THREE.SpriteMaterial).opacity = 0.55 + Math.min(0.35, thr * 0.25); });
    parts.engineGlow.forEach((m) => { m.scale.setScalar(0.75 + thr * 0.2); (m.material as THREE.MeshBasicMaterial).color.setHSL(0.07, 1, 0.42 + Math.min(0.2, thr * 0.12)); });
    const strobe = (clock.elapsedTime % 1.4) < 0.07;
    parts.navLights[2].visible = strobe;
    // exhaust embers
    if (rt.fx && r.visible) {
      const back = _v2.set(0, 0, 1).applyQuaternion(sh.quat);
      for (const n of SHRIKE_NOZZLES) {
        _v.copy(n).applyQuaternion(sh.quat).add(sh.pos);
        rt.fx.exhaust(_v, sh.vel, back, sh.cruise === 'on' ? 0 : thr * 0.6);
      }
    }
    // shield flash
    const mat = shield.material as THREE.ShaderMaterial;
    if (rt.shieldFlash > 0) { flash.current = Math.max(flash.current, rt.shieldFlash); rt.shieldFlash = 0; }
    flash.current = Math.max(0, flash.current - dt * 2.5);
    mat.uniforms.uOpacity.value = flash.current;
    mat.uniforms.uTime.value = clock.elapsedTime;
    shield.visible = flash.current > 0.01;
  }, -1);

  return (
    <>
      <group ref={root} />

    </>
  );
}

// ---------------------------------------------------------------- space dust (speed cue)
function SpaceDust({ rt }: { rt: Runtime }) {
  const N = rt.settings.quality === 'high' ? 700 : 350;
  const BOX = 360;
  const data = useMemo(() => {
    const p = new Float32Array(N * 3);
    for (let i = 0; i < N * 3; i++) p[i] = (Math.random() - 0.5) * BOX;
    const pos = new Float32Array(N * 6), col = new Float32Array(N * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    lines.frustumCulled = false;
    return { p, lines, last: new THREE.Vector3(), primed: false };
  }, [N]);
  useFrame(({ camera }, dt) => {
    const sh = rt.sim.ship;
    // dust lives in world space; the camera moves through it
    const move = _v.copy(rt.origin).sub(data.last);
    data.last.copy(rt.origin);
    if (!data.primed) { data.primed = true; move.set(0, 0, 0); }
    const cruise = sh.cruise === 'on';
    const speed = sh.vel.length();
    const pos = data.lines.geometry.getAttribute('position') as THREE.BufferAttribute;
    const col = data.lines.geometry.getAttribute('color') as THREE.BufferAttribute;
    const stretch = cruise ? Math.min(160, speed * 0.002) : Math.min(14, speed * 0.05);
    const dir = _v2.copy(sh.vel).normalize();
    const big = move.length() > BOX * 0.5;
    for (let i = 0; i < N; i++) {
      let x = data.p[i * 3] - move.x, y = data.p[i * 3 + 1] - move.y, z = data.p[i * 3 + 2] - move.z;
      if (big) { x = (Math.random() - 0.5) * BOX; y = (Math.random() - 0.5) * BOX; z = (Math.random() - 0.5) * BOX; }
      // wrap around the camera
      const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
      const h = BOX / 2;
      if (x - cx > h) x -= BOX; else if (x - cx < -h) x += BOX;
      if (y - cy > h) y -= BOX; else if (y - cy < -h) y += BOX;
      if (z - cz > h) z -= BOX; else if (z - cz < -h) z += BOX;
      data.p[i * 3] = x; data.p[i * 3 + 1] = y; data.p[i * 3 + 2] = z;
      pos.setXYZ(i * 2, x, y, z);
      pos.setXYZ(i * 2 + 1, x - dir.x * stretch, y - dir.y * stretch, z - dir.z * stretch);
      const d = Math.hypot(x - cx, y - cy, z - cz) / h;
      const a = Math.max(0, 1 - d) * (cruise ? 0.9 : Math.min(0.55, 0.12 + speed / 400));
      const r = cruise ? 0.6 : 0.75, g = cruise ? 0.8 : 0.72, b = cruise ? 1 : 0.65;
      col.setXYZ(i * 2, r * a, g * a, b * a);
      col.setXYZ(i * 2 + 1, 0, 0, 0);
    }
    pos.needsUpdate = true; col.needsUpdate = true;
    void dt;
  }, -1);
  return <primitive object={data.lines} />;
}

// ---------------------------------------------------------------- camera
function CameraRig({ rt }: { rt: Runtime }) {
  const { camera, size } = useThree();
  const rel3 = useRef(new THREE.Vector3(0, 3, 14));
  const up = useRef(new THREE.Vector3(0, 1, 0));
  const fov = useRef(62);
  const dockAngle = useRef(0);
  useEffect(() => { rt.camera = camera as THREE.PerspectiveCamera; }, [camera, rt]);
  useFrame((_, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    const sim = rt.sim, sh = sim.ship;
    rt.viewport.w = size.width; rt.viewport.h = size.height;
    const k = 1 - Math.exp(-9 * dt);
    if (sh.dockedAt) {
      dockAngle.current += dt * 0.12;
      const a = dockAngle.current;
      cam.position.set(Math.cos(a) * 520, 140 + Math.sin(a * 0.7) * 60, Math.sin(a) * 520);
      cam.up.set(0, 1, 0);
      cam.lookAt(0, 0, 0);
      fov.current = THREE.MathUtils.lerp(fov.current, 55, k);
    } else {
      const cruise = sh.cruise === 'on' ? 1 : sh.cruise === 'spooling' ? sh.cruiseSpool * 0.4 : 0;
      const boost = sh.boosting ? 1 : 0;
      const speedFrac = Math.min(1, sh.vel.length() / 150);
      // portrait screens: pull back so the ship doesn't fill the view
      const aspect = size.width / Math.max(1, size.height);
      const back = aspect < 1 ? Math.pow(1 / aspect, 0.8) : 1;
      const desired = _v.set(0, (2.7 + cruise * 0.8) * (0.8 + 0.2 * back), (13 + speedFrac * 1.5 + boost * 2 + cruise * 5) * back).applyQuaternion(sh.quat);
      if (!sh.alive) desired.multiplyScalar(2.2);
      rel3.current.lerp(desired, sh.alive ? k : 1 - Math.exp(-0.8 * dt));
      cam.position.copy(rel3.current);
      const shipUp = _v2.set(0, 1, 0).applyQuaternion(sh.quat);
      up.current.lerp(shipUp, k).normalize();
      cam.up.copy(up.current);
      const ahead = _v2.set(0, 1.4, -32).applyQuaternion(sh.quat);
      cam.lookAt(ahead);
      // shake
      if (rt.shake > 0.001) {
        const s = rt.shake * rt.shake * 1.4;
        cam.position.add(_v.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s));
        rt.shake = Math.max(0, rt.shake - dt * 1.8);
      }
      fov.current = THREE.MathUtils.lerp(fov.current, 64 + boost * 8 + cruise * 18, 1 - Math.exp(-3 * dt));
    }
    if (Math.abs(cam.fov - fov.current) > 0.01) { cam.fov = fov.current; cam.updateProjectionMatrix(); }
    rt.fx?.setViewport(size.height, cam.fov);
  }, -2);
  return null;
}

// ---------------------------------------------------------------- driver: sim tick + event fan-out
function SimDriver({ rt, onFrame }: { rt: Runtime; onFrame?: () => void }) {
  const { scene } = useThree();
  const fx = useMemo(() => new FX(rt.settings.quality), [rt]);
  useEffect(() => {
    rt.fx = fx;
    scene.add(fx.group);
    return () => { scene.remove(fx.group); rt.fx = null; };
  }, [fx, rt, scene]);
  const fpsAcc = useRef({ t: 0, n: 0 });
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const sim = rt.sim;
    const c = rt.input.poll();
    sim.update(dt, c);
    rt.origin.copy(sim.ship.pos);
    const sh = sim.ship;
    for (const e of sim.events) {
      switch (e.t) {
        case 'explosion': {
          fx.explosion(e.pos, e.size, e.kind);
          const d = e.pos.distanceTo(sh.pos);
          rt.audio.explosion(e.size, d);
          rt.shake = Math.min(1, rt.shake + Math.max(0, (e.size * 6) / Math.max(40, d) - 0.05));
          break;
        }
        case 'hit': fx.hit(e.pos, e.team, e.shield); break;
        case 'fire': {
          fx.muzzle(e.pos, e.team);
          if (e.kind === 'torp') rt.audio.torpedo(); else rt.audio.laser(e.team, e.pos.distanceTo(sh.pos));
          break;
        }
        case 'playerHit': if (e.shield) rt.shieldFlash = 0.9; rt.audio.hit(e.shield); rt.shake = Math.min(1, rt.shake + 0.18 + e.amount * 0.02); break;
        case 'pickup': rt.audio.blip('pickup'); break;
        case 'scan': rt.audio.blip('scan'); break;
        case 'dock': rt.audio.blip('dock'); break;
        case 'msg': if (e.tone === 'good') rt.audio.blip('good'); else if (e.tone === 'warn' || e.tone === 'bad') rt.audio.blip('warn'); break;
        default: break;
      }
      rt.hudEvents.push(e);
    }
    sim.events.length = 0;
    if (rt.hudEvents.length > 200) rt.hudEvents.splice(0, rt.hudEvents.length - 200);
    fx.update(dt, rt.origin);
    rt.audio.engine(sh.boosting ? 1 : sh.throttle, sh.boosting, sh.cruise === 'on' ? Math.min(1, sh.cruiseSpeed / 20000) + 0.3 : 0, !!sh.dockedAt || !sh.alive);
    const a = fpsAcc.current;
    a.t += dtRaw; a.n++;
    if (a.t > 0.5) { rt.fps = a.n / a.t; a.t = 0; a.n = 0; }
  }, -3);
  useFrame(() => onFrame?.(), 0);
  return null;
}

// ---------------------------------------------------------------- composition
export function DriftScene({ rt, onFrame }: { rt: Runtime; onFrame?: () => void }) {
  const bodies = rt.sim.bodies;
  return (
    <>
      <EnvSetup />
      <ambientLight intensity={0.07} color="#9fb4d8" />
      <SimDriver rt={rt} onFrame={onFrame} />
      <CameraRig rt={rt} />
      <Sky rt={rt} />
      <Sun rt={rt} body={bodies[0]} />
      {bodies.slice(1).map((b) => <Planet key={b.id} rt={rt} body={b} />)}
      <Orbits rt={rt} />
      <BeltDust rt={rt} />
      <Suspense fallback={null}><Stations rt={rt} /></Suspense>
      <Bases rt={rt} />
      <Asteroids rt={rt} />
      <Suspense fallback={null}><Enemies rt={rt} /></Suspense>
      <Projectiles rt={rt} />
      <LootField rt={rt} />
      <PlayerShip rt={rt} />
      <SpaceDust rt={rt} />
    </>
  );
}

useGLTF.preload('/models/station.glb');
useGLTF.preload('/models/enemy-fighter.glb');
useGLTF.preload('/models/enemy-sniper.glb');
useGLTF.preload('/models/enemy-swarm.glb');

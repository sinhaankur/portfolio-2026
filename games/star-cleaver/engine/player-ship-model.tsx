'use client';

import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { generateShip } from '../../../lib/ship-generator/procedural-ships';
import { auditShipModel } from './ship-model-qa';
import type { SelectedShip } from './ship-selector';
import { GAMEPLAY_SHIP_RENDER_SCALE, PREVIEW_SHIP_RENDER_SCALE } from './scale-contract';

// Active player ship: Blender-authored X-wing (blender/space-assets/xwing.glb).
// Legacy Vanguard interceptor kept as a fallback reference.
const PLAYER_SHIP_MODEL_PATH = '/models/xwing.glb';
const LEGACY_SHIP_MODEL_PATH = '/models/Test1glb.glb';
void LEGACY_SHIP_MODEL_PATH;
// The reference X-wing GLB was exported +Y-forward / +Z-up in Blender with
// export_yup=true, so in three-space it already arrives nose -Z (game forward)
// and up +Y — no basis rotation needed. (The old [π/2, π, 0] was for the
// hand-built ship and tipped this model onto its back.)
export const SHIP_MODEL_BASIS_ROTATION: [number, number, number] = [0, 0, 0];

type PlayerShipMode = 'game' | 'preview';
type ShipVariant = 'default-vanguard';

type ShipTransform = {
	scale: number;
	position: [number, number, number];
	rotation: [number, number, number];
};

type ShipTextureSet = {
	color: THREE.CanvasTexture;
	roughness: THREE.CanvasTexture;
	metalness: THREE.CanvasTexture;
};

let shipTextureSetCache: ShipTextureSet | null | undefined;

function seededRandom(seed: number) {
	let state = seed >>> 0;
	return () => {
		state = (1664525 * state + 1013904223) >>> 0;
		return state / 4294967296;
	};
}

function createTextureCanvas(size: number) {
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;
	return { canvas, ctx };
}

function getShipTextureSet(): ShipTextureSet | null {
	if (shipTextureSetCache !== undefined) return shipTextureSetCache;
	if (typeof document === 'undefined') {
		shipTextureSetCache = null;
		return shipTextureSetCache;
	}

	const size = 512;
	const colorLayer = createTextureCanvas(size);
	const roughLayer = createTextureCanvas(size);
	const metalLayer = createTextureCanvas(size);
	if (!colorLayer || !roughLayer || !metalLayer) {
		shipTextureSetCache = null;
		return shipTextureSetCache;
	}

	const rand = seededRandom(94721);
	const { ctx: colorCtx, canvas: colorCanvas } = colorLayer;
	const { ctx: roughCtx, canvas: roughCanvas } = roughLayer;
	const { ctx: metalCtx, canvas: metalCanvas } = metalLayer;

	colorCtx.fillStyle = '#d8d2c8';
	colorCtx.fillRect(0, 0, size, size);
	roughCtx.fillStyle = '#8a8a8a';
	roughCtx.fillRect(0, 0, size, size);
	metalCtx.fillStyle = '#2f2f2f';
	metalCtx.fillRect(0, 0, size, size);

	for (let i = 0; i < 420; i += 1) {
		const x = Math.floor(rand() * size);
		const y = Math.floor(rand() * size);
		const w = 12 + Math.floor(rand() * 78);
		const h = 8 + Math.floor(rand() * 44);

		const shade = 202 + Math.floor(rand() * 32);
		colorCtx.fillStyle = `rgb(${shade},${shade - 4},${shade - 10})`;
		colorCtx.fillRect(x, y, w, h);

		const grime = 78 + Math.floor(rand() * 50);
		roughCtx.fillStyle = `rgb(${grime},${grime},${grime})`;
		roughCtx.fillRect(x, y, w, h);

		const metal = 28 + Math.floor(rand() * 48);
		metalCtx.fillStyle = `rgb(${metal},${metal},${metal})`;
		metalCtx.fillRect(x, y, w, h);

		colorCtx.strokeStyle = 'rgba(96,104,112,0.42)';
		colorCtx.lineWidth = 1;
		colorCtx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
	}

	for (let i = 0; i < 900; i += 1) {
		const x = Math.floor(rand() * size);
		const y = Math.floor(rand() * size);
		const dust = 126 + Math.floor(rand() * 48);
		colorCtx.fillStyle = `rgba(${dust},${dust},${dust},0.08)`;
		colorCtx.fillRect(x, y, 2, 2);

		const rough = 108 + Math.floor(rand() * 40);
		roughCtx.fillStyle = `rgba(${rough},${rough},${rough},0.2)`;
		roughCtx.fillRect(x, y, 2, 2);
	}

	const color = new THREE.CanvasTexture(colorCanvas);
	const roughness = new THREE.CanvasTexture(roughCanvas);
	const metalness = new THREE.CanvasTexture(metalCanvas);

	[color, roughness, metalness].forEach((tex) => {
		tex.wrapS = THREE.RepeatWrapping;
		tex.wrapT = THREE.RepeatWrapping;
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.needsUpdate = true;
	});

	roughness.colorSpace = THREE.NoColorSpace;
	metalness.colorSpace = THREE.NoColorSpace;

	shipTextureSetCache = { color, roughness, metalness };
	return shipTextureSetCache;
}

function cloneTextureWithRepeat(source: THREE.Texture, repeatX: number, repeatY: number) {
	const tex = source.clone();
	tex.wrapS = THREE.RepeatWrapping;
	tex.wrapT = THREE.RepeatWrapping;
	tex.repeat.set(repeatX, repeatY);
	tex.needsUpdate = true;
	return tex;
}

const SHIP_TRANSFORMS: Record<ShipVariant, { game: ShipTransform; preview: ShipTransform }> = {
	'default-vanguard': {
	       preview: { scale: PREVIEW_SHIP_RENDER_SCALE, position: [0, 0, 0], rotation: [0, 0, 0] },
	       game: { scale: GAMEPLAY_SHIP_RENDER_SCALE, position: [0, 0, 0], rotation: [0, 0, 0] },
       },
};

export function getPlayerShipTransform(shipId: SelectedShip, mode: PlayerShipMode = 'game'): ShipTransform {
	const variant = shipId as ShipVariant;
	return SHIP_TRANSFORMS[variant]?.[mode] ?? SHIP_TRANSFORMS['default-vanguard'][mode];
}

function createProceduralPlayerShip(shipId: SelectedShip, mode: PlayerShipMode): THREE.Group {
	void shipId;
	void mode;
	return generateShip({
	       faction: 'player',
	       class: 'fighter',
	       seed: 42,
	       scale: 3,
	       color1: { r: 0.2, g: 0.8, b: 1 },
	       color2: { r: 0.5, g: 1, b: 1 },
	});
}

function cloneAndStyleShipModel(scene: THREE.Object3D) {
	const cloned = scene.clone(true);

	cloned.traverse((child) => {
		if (!(child instanceof THREE.Mesh)) return;

		child.castShadow = true;
		child.receiveShadow = true;
		child.frustumCulled = false;

		const meshName = (child.name || '').toLowerCase();
		const currentMaterial = child.material;

		const styleMaterial = (material: THREE.Material, index = 0) => {
			if (!(material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial)) {
				return material;
			}

			const mat = material.clone();
			const partKey = `${meshName}-${index}`;

			const looksLikeEngine = /engine|thruster|exhaust|nozzle/.test(partKey);
			const looksLikeCockpit = /cockpit|canopy|glass|window/.test(partKey);
			const looksLikeWing = /wing|fin|foil/.test(partKey);
			const looksLikeWeapon = /laser|gun|barrel|cannon/.test(partKey);
			const textureSet = getShipTextureSet();
			const wearTint = /nose|fuselage|hull|wing|intake|panel/.test(partKey) ? 0.11 : 0.05;

			const applyWear = (base: THREE.Color, extraWear = 0) => {
				const worn = base.clone();
				worn.offsetHSL(-0.01, -0.02, -(wearTint + extraWear));
				return worn;
			};

			if (looksLikeCockpit) {
				mat.color = applyWear(new THREE.Color('#a9c7df'), 0.01);
				mat.roughness = 0.1;
				mat.metalness = 0.08;
				mat.transparent = true;
				mat.opacity = 0.7;
				if (mat instanceof THREE.MeshPhysicalMaterial) {
					mat.transmission = 0.66;
					mat.thickness = 0.38;
					mat.clearcoat = 0.9;
					mat.clearcoatRoughness = 0.08;
				}
				mat.emissive = new THREE.Color('#1f3143');
				mat.emissiveIntensity = 0.03;
			} else if (looksLikeEngine) {
				mat.color = applyWear(new THREE.Color('#2f3842'), 0.0);
				mat.roughness = 0.22;
				mat.metalness = 0.96;
				mat.emissive = new THREE.Color('#ff9a6b');
				mat.emissiveIntensity = 1.55;
			} else if (looksLikeWeapon) {
				mat.color = applyWear(new THREE.Color('#404954'), 0.02);
				mat.roughness = 0.24;
				mat.metalness = 0.94;
				mat.emissive = new THREE.Color('#1b2230');
				mat.emissiveIntensity = 0.08;
			} else if (looksLikeWing) {
				mat.color = applyWear(new THREE.Color('#e3ddd2'), 0.05);
				mat.roughness = 0.72;
				mat.metalness = 0.12;
				mat.emissive = new THREE.Color('#202a36');
				mat.emissiveIntensity = 0.03;
			} else {
				mat.color = applyWear(new THREE.Color('#ece6da'), 0.07);
				mat.roughness = 0.66;
				mat.metalness = 0.18;
				mat.emissive = new THREE.Color('#2b3645');
				mat.emissiveIntensity = 0.04;
			}

			if (textureSet && !looksLikeCockpit && !looksLikeEngine) {
				const repeat = looksLikeWing ? [2.6, 1.8] : looksLikeWeapon ? [3.2, 2.2] : [4.2, 3.0];
				mat.map = cloneTextureWithRepeat(textureSet.color, repeat[0], repeat[1]);
				mat.roughnessMap = cloneTextureWithRepeat(textureSet.roughness, repeat[0], repeat[1]);
				mat.metalnessMap = cloneTextureWithRepeat(textureSet.metalness, repeat[0], repeat[1]);
			}

			mat.envMapIntensity = Math.max(looksLikeEngine || looksLikeWeapon ? 1.95 : 1.35, mat.envMapIntensity || (looksLikeEngine || looksLikeWeapon ? 2.05 : 1.55));
			mat.needsUpdate = true;
			return mat;
		};

		if (Array.isArray(currentMaterial)) {
			child.material = currentMaterial.map((mat, idx) => styleMaterial(mat, idx));
		} else if (currentMaterial) {
			child.material = styleMaterial(currentMaterial, 0);
		}
	});

	return cloned;
}

function ShipUiOverlay({ mode }: { mode: PlayerShipMode }) {
	const groupRef = useRef<THREE.Group>(null);
	const ringRef = useRef<THREE.Mesh>(null);
	const barRef = useRef<THREE.Mesh>(null);
	const y = mode === 'preview' ? 0.15 : 0.22;
	const z = mode === 'preview' ? 0.2 : 0.28;
	const scale = mode === 'preview' ? 0.78 : 1;

	useFrame((state) => {
		if (groupRef.current) {
			groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.45) * 0.05;
		}

		if (ringRef.current) {
			const mat = ringRef.current.material as THREE.MeshBasicMaterial;
			mat.opacity = 0.2 + (Math.sin(state.clock.elapsedTime * 2.2) * 0.5 + 0.5) * 0.18;
		}

		if (barRef.current) {
			const mat = barRef.current.material as THREE.MeshBasicMaterial;
			mat.opacity = 0.18 + (Math.sin(state.clock.elapsedTime * 3.8 + 0.7) * 0.5 + 0.5) * 0.22;
		}
	});

	return (
		<group ref={groupRef} position={[0, y, z]} scale={scale}>
			<mesh ref={ringRef} rotation={[0, 0, 0]}>
				<ringGeometry args={[0.24, 0.27, 56]} />
				<meshBasicMaterial color="#40d8ff" transparent opacity={0.28} depthWrite={false} />
			</mesh>
			<mesh ref={barRef}>
				<planeGeometry args={[0.42, 0.03]} />
				<meshBasicMaterial color="#8ce6ff" transparent opacity={0.36} depthWrite={false} />
			</mesh>
			<mesh rotation={[0, 0, Math.PI / 2]}>
				<planeGeometry args={[0.42, 0.03]} />
				<meshBasicMaterial color="#8ce6ff" transparent opacity={0.24} depthWrite={false} />
			</mesh>
			<mesh rotation={[0, 0, Math.PI / 4]}>
				<ringGeometry args={[0.12, 0.125, 32]} />
				<meshBasicMaterial color="#5fe3ff" transparent opacity={0.35} depthWrite={false} />
			</mesh>
		</group>
	);
}

function ShipHighlightRig({ mode }: { mode: PlayerShipMode }) {
	const glowScale = mode === 'preview' ? 1.05 : 1.15;
	return (
		<group scale={glowScale}>
			<pointLight position={[0, 0.42, 1.85]} intensity={1.9} distance={28} color={0xcdf3ff} />
			<pointLight position={[0, -0.18, -1.65]} intensity={1.4} distance={24} color={0xff9b6a} />
			<pointLight position={[0, 0.9, 0.2]} intensity={0.7} distance={20} color={0xffffff} />
			<mesh position={[0, 0.08, 0.12]}>
				<icosahedronGeometry args={[2.85, 1]} />
				<meshBasicMaterial color="#ffac80" transparent opacity={0.06} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
			</mesh>
		</group>
	);
}

export function ProceduralPlayerShipModel({
	shipId,
	mode = 'game',
	applyTransform = true,
}: {
	shipId: SelectedShip;
	mode?: PlayerShipMode;
	applyTransform?: boolean;
}) {
	const shipModel = useMemo(() => createProceduralPlayerShip(shipId, mode), [shipId, mode]);
	if (!applyTransform) {
		return <primitive object={shipModel} />;
	}
	const transform = getPlayerShipTransform(shipId, mode);
	return (
		<group scale={transform.scale} position={transform.position} rotation={transform.rotation}>
			<primitive object={shipModel} />
		</group>
	);
}

export function PlayerShipModel({
       shipId,
       mode = 'game',
       applyTransform = true,
	applyBasisCorrection = true,
}: {
       shipId: SelectedShip;
       mode?: PlayerShipMode;
       applyTransform?: boolean;
	applyBasisCorrection?: boolean;
}) {
	const playerShipGltf = useGLTF(PLAYER_SHIP_MODEL_PATH);
	const fallbackShip = useMemo(() => createProceduralPlayerShip(shipId, mode), [shipId, mode]);
	const shipObject = useMemo(() => cloneAndStyleShipModel(playerShipGltf.scene), [playerShipGltf.scene]);
	const resolvedShip = shipObject ?? fallbackShip;
	const hasGltfShip = Boolean(shipObject);

	useEffect(() => {
		auditShipModel(playerShipGltf.scene, PLAYER_SHIP_MODEL_PATH);
	}, [playerShipGltf.scene]);

	const shipVisual = hasGltfShip ? (
		<>
			<primitive object={resolvedShip} />
			<ShipHighlightRig mode={mode} />
			<ShipUiOverlay mode={mode} />
		</>
	) : (
		<>
			<primitive object={resolvedShip} />
			<ShipHighlightRig mode={mode} />
			<ShipUiOverlay mode={mode} />
		</>
	);

	const basisAdjustedVisual = hasGltfShip && applyBasisCorrection ? (
		<group rotation={SHIP_MODEL_BASIS_ROTATION}>{shipVisual}</group>
	) : (
		shipVisual
	);

       if (!applyTransform) {
	       return (
		       <group>
			       {basisAdjustedVisual}
		       </group>
	       );
       }

       const transform = getPlayerShipTransform(shipId, mode);
       return (
	       <group scale={transform.scale} position={transform.position} rotation={transform.rotation}>
		       {basisAdjustedVisual}
	       </group>
       );
}

useGLTF.preload(PLAYER_SHIP_MODEL_PATH);

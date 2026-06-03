'use client';

import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { generateShip } from '../../../lib/ship-generator/procedural-ships';
import { auditShipModel } from './ship-model-qa';
import type { SelectedShip } from './ship-selector';

const PLAYER_SHIP_MODEL_PATH = '/models/Test1glb.glb';

type PlayerShipMode = 'game' | 'preview';
type ShipVariant = 'default-vanguard';

type ShipTransform = {
	scale: number;
	position: [number, number, number];
	rotation: [number, number, number];
};

const SHIP_TRANSFORMS: Record<ShipVariant, { game: ShipTransform; preview: ShipTransform }> = {
	'default-vanguard': {
	       preview: { scale: 1.2, position: [0, 0, 0], rotation: [0, 0, 0] },
	       game: { scale: 1.5, position: [0, 0, 0], rotation: [0, 0, 0] },
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
			const wearTint = /nose|fuselage|hull|wing|intake|panel/.test(partKey) ? 0.11 : 0.05;

			const applyWear = (base: THREE.Color, extraWear = 0) => {
				const worn = base.clone();
				worn.offsetHSL(-0.01, -0.02, -(wearTint + extraWear));
				return worn;
			};

			if (looksLikeCockpit) {
				mat.color = applyWear(new THREE.Color('#dfe8ef'), 0.015);
				mat.roughness = 0.08;
				mat.metalness = 0.32;
				if (mat instanceof THREE.MeshPhysicalMaterial) {
					mat.transmission = 0.48;
					mat.thickness = 0.3;
					mat.clearcoat = 0.82;
					mat.clearcoatRoughness = 0.08;
				}
				mat.emissive = new THREE.Color('#3a5472');
				mat.emissiveIntensity = 0.18;
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
}: {
       shipId: SelectedShip;
       mode?: PlayerShipMode;
       applyTransform?: boolean;
}) {
	const playerShipGltf = useGLTF(PLAYER_SHIP_MODEL_PATH);
	const fallbackShip = useMemo(() => createProceduralPlayerShip(shipId, mode), [shipId, mode]);
	const shipObject = useMemo(() => cloneAndStyleShipModel(playerShipGltf.scene), [playerShipGltf.scene]);
	const resolvedShip = shipObject ?? fallbackShip;

	useEffect(() => {
		auditShipModel(playerShipGltf.scene, PLAYER_SHIP_MODEL_PATH);
	}, [playerShipGltf.scene]);

       if (!applyTransform) {
	       return (
		       <group>
			       <primitive object={resolvedShip} />
				<ShipHighlightRig mode={mode} />
			       <ShipUiOverlay mode={mode} />
		       </group>
	       );
       }

       const transform = getPlayerShipTransform(shipId, mode);
       return (
	       <group scale={transform.scale} position={transform.position} rotation={transform.rotation}>
		       <primitive object={resolvedShip} />
			<ShipHighlightRig mode={mode} />
		       <ShipUiOverlay mode={mode} />
	       </group>
       );
}

useGLTF.preload(PLAYER_SHIP_MODEL_PATH);

'use client';

import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { generateShip } from '../../../lib/ship-generator/procedural-ships';
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

			if (looksLikeCockpit) {
				mat.color = new THREE.Color('#e8f4ff');
				mat.roughness = 0.04;
				mat.metalness = 0.35;
				if (mat instanceof THREE.MeshPhysicalMaterial) {
					mat.transmission = 0.6;
					mat.thickness = 0.3;
					mat.clearcoat = 0.9;
					mat.clearcoatRoughness = 0.06;
				}
				mat.emissive = new THREE.Color('#60e0ff');
				mat.emissiveIntensity = 0.75;
			} else if (looksLikeEngine) {
				mat.color = new THREE.Color('#4a7da8');
				mat.roughness = 0.22;
				mat.metalness = 0.92;
				mat.emissive = new THREE.Color('#5fd4ff');
				mat.emissiveIntensity = 1.2;
			} else if (looksLikeWeapon) {
				mat.color = new THREE.Color('#8aa8c8');
				mat.roughness = 0.3;
				mat.metalness = 0.9;
				mat.emissive = new THREE.Color('#3a6da0');
				mat.emissiveIntensity = 0.35;
			} else if (looksLikeWing) {
				mat.color = new THREE.Color('#d8e6f4');
				mat.roughness = 0.28;
				mat.metalness = 0.85;
				mat.emissive = new THREE.Color('#3a6da0');
				mat.emissiveIntensity = 0.3;
			} else {
				mat.color = new THREE.Color('#aec4dc');
				mat.roughness = 0.28;
				mat.metalness = 0.88;
				mat.emissive = new THREE.Color('#3a6da0');
				mat.emissiveIntensity = 0.25;
			}

			mat.envMapIntensity = Math.max(1.35, mat.envMapIntensity || 1.55);
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

       if (!applyTransform) {
	       return (
		       <group>
			       <primitive object={resolvedShip} />
			       <ShipUiOverlay mode={mode} />
		       </group>
	       );
       }

       const transform = getPlayerShipTransform(shipId, mode);
       return (
	       <group scale={transform.scale} position={transform.position} rotation={transform.rotation}>
		       <primitive object={resolvedShip} />
		       <ShipUiOverlay mode={mode} />
	       </group>
       );
}

useGLTF.preload(PLAYER_SHIP_MODEL_PATH);

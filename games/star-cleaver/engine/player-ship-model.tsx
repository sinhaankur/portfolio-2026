'use client';

import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { generateShip } from '../../../lib/ship-generator/procedural-ships';
import type { SelectedShip } from './ship-selector';

const PLAYER_SHIP_MODEL_PATH = '/models/Test1glb.glb';

type PlayerShipMode = 'game' | 'preview';
type ShipVariant = 'default-xwing';

type ShipTransform = {
	scale: number;
	position: [number, number, number];
	rotation: [number, number, number];
};

const SHIP_TRANSFORMS: Record<ShipVariant, { game: ShipTransform; preview: ShipTransform }> = {
       'default-xwing': {
	       preview: { scale: 1.05, position: [0, -1.05, 0], rotation: [-0.12, 0, 0] },
	       game: { scale: 1.75, position: [0, -1.58, 0.2], rotation: [-0.03, 0, 0] },
       },
};

export function getPlayerShipTransform(shipId: SelectedShip, mode: PlayerShipMode = 'game'): ShipTransform {
	const variant = shipId as ShipVariant;
	return SHIP_TRANSFORMS[variant]?.[mode] ?? SHIP_TRANSFORMS['default-xwing'][mode];
}

function createProceduralPlayerShip(shipId: SelectedShip, mode: PlayerShipMode): THREE.Group {
	return generateShip({
	       faction: 'player',
	       class: 'fighter',
	       seed: 42,
	       scale: 3,
	       color1: { r: 0.2, g: 0.8, b: 1 },
	       color2: { r: 0.5, g: 1, b: 1 },
	});
}

function cloneShipModel(scene: THREE.Object3D) {
	const cloned = scene.clone(true);

	cloned.traverse((child) => {
		if (child instanceof THREE.Mesh) {
			child.castShadow = true;
			child.receiveShadow = true;

			// Some exports ship with magenta/pink placeholder colors.
			// Normalize to a neutral metallic palette for in-game readability.
			const hash = (text: string) => {
				let h = 0;
				for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
				return h;
			};

			const normalizeMaterial = (material: THREE.Material, index = 0, meshKey = '') => {
				if (!(material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial)) {
					return material;
				}

				const mat = material.clone();
				const hasBaseMap = Boolean(mat.map);
				if (!hasBaseMap) {
					const v = (hash(meshKey || `part-${index}`) % 1000) / 1000;
					const base = new THREE.Color('#8f9eb1');
					const trim = new THREE.Color('#c4d0df');
					mat.color = base.lerp(trim, 0.22 + v * 0.48);
				} else {
					mat.color = new THREE.Color('#ffffff');
				}

				mat.roughness = Math.max(0.22, Math.min(0.68, mat.roughness || 0.46));
				mat.metalness = Math.max(0.38, Math.min(0.9, mat.metalness || 0.58));
				mat.envMapIntensity = Math.max(1.0, mat.envMapIntensity || 1.15);
				mat.emissive = new THREE.Color(0x000000);
				mat.emissiveIntensity = 0;
				mat.needsUpdate = true;
				return mat;
			};

			if (Array.isArray(child.material)) {
				child.material = child.material.map((mat, idx) => normalizeMaterial(mat, idx, `${child.name}-${idx}`));
			} else if (child.material) {
				child.material = normalizeMaterial(child.material, 0, child.name);
			}
		}
	});
	return cloned;
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
	const playerShip = useMemo(() => cloneShipModel(playerShipGltf.scene), [playerShipGltf.scene]);
       const objectByShip = {
	       'default-xwing': playerShip,
       } as const;

       const shipObject = objectByShip[shipId as 'default-xwing'] ?? fallbackShip;
       if (!applyTransform) {
	       return <primitive object={shipObject} />;
       }

       const transform = getPlayerShipTransform(shipId, mode);
       return (
	       <group scale={transform.scale} position={transform.position} rotation={transform.rotation}>
		       <primitive object={shipObject} />
	       </group>
       );
}

useGLTF.preload(PLAYER_SHIP_MODEL_PATH);

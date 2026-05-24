'use client';

import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { generateShip } from '../../../lib/ship-generator/procedural-ships';
import type { SelectedShip } from './ship-selector';

const CLASSIC_XWING_MODEL_PATH = '/models/rebels_x-wing_starfighter.glb';
const ALLIANCE_XWING_MODEL_PATH = '/models/vedic-space-craft-inspired-xwing.glb';
const T70_XWING_MODEL_PATH = '/models/poes_xwing.glb';
const XBLADE_MODEL_PATH = '/models/x-blade.glb';

type PlayerShipMode = 'game' | 'preview';
type ShipVariant = 'default-xwing' | 'alliance-xwing' | 't70-xwing' | 'x-blade';

const VARIANT_ACCENTS: Record<ShipVariant, THREE.ColorRepresentation> = {
	'default-xwing': '#6ec8ff',
	'alliance-xwing': '#d7b98a',
	't70-xwing': '#8dd7ff',
	'x-blade': '#ff7a59',
};

function createProceduralPlayerShip(shipId: SelectedShip, mode: PlayerShipMode): THREE.Group {
	const isT70 = shipId === 't70-xwing';
	const isXBlade = shipId === 'x-blade';
	const previewScaleFactor = mode === 'preview' ? 0.56 : 1;

	return generateShip({
		faction: 'player',
		class: isXBlade ? 'destroyer' : 'fighter',
		seed: isXBlade ? 99 : isT70 ? 70 : 42,
		scale: (isXBlade ? 3.2 : isT70 ? 2.8 : 3) * previewScaleFactor,
		color1: isXBlade
			? { r: 0.8, g: 0.2, b: 0.8 }
			: isT70
			? { r: 0.3, g: 0.6, b: 1 }
			: { r: 0.2, g: 0.8, b: 1 },
		color2: isXBlade
			? { r: 1, g: 0.5, b: 1 }
			: isT70
			? { r: 0.6, g: 0.9, b: 1 }
			: { r: 0.5, g: 1, b: 1 },
	});
}

function enhanceMaterial(
	material: THREE.Material,
	accent: THREE.Color,
	partIndex: number,
	partCount: number
) {
	const ratio = partCount > 1 ? partIndex / (partCount - 1) : 0;
	const panelShade = 0.9 + ratio * 0.16;

	if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial) {
		material.color = material.color.clone().multiplyScalar(panelShade);
		material.roughness = Math.max(0.18, Math.min(0.72, material.roughness * 0.78 + 0.08 + ratio * 0.06));
		material.metalness = Math.max(0.22, Math.min(0.92, material.metalness * 0.88 + 0.12));
		material.envMapIntensity = Math.max(1.05, material.envMapIntensity || 1.25);
		material.emissive = accent.clone().multiplyScalar(0.03 + ratio * 0.01);
		material.emissiveIntensity = 0.26;

		if (material instanceof THREE.MeshPhysicalMaterial) {
			material.clearcoat = Math.max(material.clearcoat ?? 0, 0.35);
			material.clearcoatRoughness = 0.28;
			smaterialSheen(material, accent, ratio);
		}

		material.needsUpdate = true;
	}
}

function smaterialSheen(material: THREE.MeshPhysicalMaterial, accent: THREE.Color, ratio: number) {
	material.sheen = 0.2;
	material.sheenRoughness = 0.55;
	material.sheenColor = accent.clone().lerp(new THREE.Color('#d9e8ff'), 0.65 + ratio * 0.2);
}

function cloneShipModel(scene: THREE.Object3D, variant: ShipVariant) {
	const cloned = scene.clone(true);
	const accent = new THREE.Color(VARIANT_ACCENTS[variant]);
	const meshList = cloned.children.length > 0
		? cloned.children.flatMap((node) => {
			const meshes: THREE.Mesh[] = [];
			node.traverse((child) => {
				if (child instanceof THREE.Mesh) meshes.push(child);
			});
			return meshes;
		})
		: [];
	const partCount = Math.max(meshList.length, 1);

	cloned.traverse((child) => {
		if (child instanceof THREE.Mesh) {
			child.castShadow = true;
			child.receiveShadow = true;
			if (Array.isArray(child.material)) {
				child.material = child.material.map((mat, idx) => {
					const clonedMaterial = mat.clone();
					enhanceMaterial(clonedMaterial, accent, idx, child.material.length);
					return clonedMaterial;
				});
			} else if (child.material) {
				const partIndex = meshList.findIndex((mesh) => mesh.uuid === child.uuid);
				const clonedMaterial = child.material.clone();
				enhanceMaterial(clonedMaterial, accent, Math.max(partIndex, 0), partCount);
				child.material = clonedMaterial;
			}
		}
	});
	return cloned;
}

export function ProceduralPlayerShipModel({ shipId, mode = 'game' }: { shipId: SelectedShip; mode?: PlayerShipMode }) {
	const shipModel = useMemo(() => createProceduralPlayerShip(shipId, mode), [shipId, mode]);
	return <primitive object={shipModel} />;
}

export function PlayerShipModel({ shipId, mode = 'game' }: { shipId: SelectedShip; mode?: PlayerShipMode }) {
	const classicGltf = useGLTF(CLASSIC_XWING_MODEL_PATH);
	const allianceGltf = useGLTF(ALLIANCE_XWING_MODEL_PATH);
	const t70Gltf = useGLTF(T70_XWING_MODEL_PATH);
	const xBladeGltf = useGLTF(XBLADE_MODEL_PATH);

	const fallbackShip = useMemo(() => createProceduralPlayerShip(shipId, mode), [shipId, mode]);
	const classicShip = useMemo(() => cloneShipModel(classicGltf.scene, 'default-xwing'), [classicGltf.scene]);
	const allianceShip = useMemo(() => cloneShipModel(allianceGltf.scene, 'alliance-xwing'), [allianceGltf.scene]);
	const t70Ship = useMemo(() => cloneShipModel(t70Gltf.scene, 't70-xwing'), [t70Gltf.scene]);
	const xBladeShip = useMemo(() => cloneShipModel(xBladeGltf.scene, 'x-blade'), [xBladeGltf.scene]);

	const isPreview = mode === 'preview';

	const layoutByShip = {
		'default-xwing': {
			object: classicShip,
			scale: isPreview ? 0.95 : 1.65,
			position: isPreview ? [0, -0.95, 0.15] : [0, -1.55, 0.2],
			rotation: isPreview ? [-0.18, Math.PI * 0.92, 0] : [-0.05, Math.PI, 0],
		},
		'alliance-xwing': {
			object: allianceShip,
			scale: isPreview ? 1.05 : 1.78,
			position: isPreview ? [0, -0.9, 0.2] : [0, -1.55, 0.25],
			rotation: isPreview ? [-0.16, Math.PI * 0.88, 0] : [-0.03, Math.PI * 0.98, 0],
		},
		't70-xwing': {
			object: t70Ship,
			scale: isPreview ? 1.15 : 1.9,
			position: isPreview ? [0, -1.1, 0.2] : [0, -1.85, 0.3],
			rotation: isPreview ? [-0.16, Math.PI * 0.96, 0] : [-0.04, Math.PI, 0],
		},
		'x-blade': {
			object: xBladeShip,
			scale: isPreview ? 1.25 : 2.0,
			position: isPreview ? [0, -1.2, 0.2] : [0, -2.0, 0.3],
			rotation: isPreview ? [-0.14, Math.PI * 0.95, 0] : [-0.03, Math.PI, 0],
		},
	} as const;

	const layout = layoutByShip[shipId as 'default-xwing' | 'alliance-xwing' | 't70-xwing' | 'x-blade'];

	return (
		<group scale={layout.scale} position={layout.position as [number, number, number]} rotation={layout.rotation as [number, number, number]}>
			<primitive object={layout.object} />
		</group>
	);
}

useGLTF.preload(CLASSIC_XWING_MODEL_PATH);
useGLTF.preload(ALLIANCE_XWING_MODEL_PATH);
useGLTF.preload(T70_XWING_MODEL_PATH);
useGLTF.preload(XBLADE_MODEL_PATH);

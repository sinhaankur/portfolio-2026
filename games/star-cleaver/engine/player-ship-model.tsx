'use client';

import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { generateShip } from '../../../lib/ship-generator/procedural-ships';
import type { SelectedShip } from './ship-selector';

const CLASSIC_XWING_MODEL_PATH = '/models/rebels_x-wing_starfighter.glb';
const ALLIANCE_XWING_MODEL_PATH = '/models/xwing.glb';
const T70_XWING_MODEL_PATH = '/models/poes_xwing.glb';

type PlayerShipMode = 'game' | 'preview';

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

function cloneShipModel(scene: THREE.Object3D) {
	const cloned = scene.clone(true);
	cloned.traverse((child) => {
		if (child instanceof THREE.Mesh) {
			child.castShadow = true;
			child.receiveShadow = true;
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

	const fallbackShip = useMemo(() => createProceduralPlayerShip(shipId, mode), [shipId, mode]);
	const classicShip = useMemo(() => cloneShipModel(classicGltf.scene), [classicGltf.scene]);
	const allianceShip = useMemo(() => cloneShipModel(allianceGltf.scene), [allianceGltf.scene]);
	const t70Ship = useMemo(() => cloneShipModel(t70Gltf.scene), [t70Gltf.scene]);

	if (shipId === 'x-blade') {
		return <primitive object={fallbackShip} />;
	}

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
	} as const;

	const layout = layoutByShip[shipId as 'default-xwing' | 'alliance-xwing' | 't70-xwing'];

	return (
		<group scale={layout.scale} position={layout.position as [number, number, number]} rotation={layout.rotation as [number, number, number]}>
			<primitive object={layout.object} />
		</group>
	);
}

useGLTF.preload(CLASSIC_XWING_MODEL_PATH);
useGLTF.preload(ALLIANCE_XWING_MODEL_PATH);
useGLTF.preload(T70_XWING_MODEL_PATH);

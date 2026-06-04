import * as THREE from 'three';

export type ShipTextureAudit = {
  slot: string;
  name: string;
  width: number;
  height: number;
  colorSpace: string;
};

export type ShipModelAuditReport = {
  label: string;
  meshes: number;
  materials: number;
  uniqueMaterials: number;
  vertices: number;
  triangles: number;
  textures: ShipTextureAudit[];
};

declare global {
  interface Window {
    __starCleaverShipAudit?: ShipModelAuditReport;
  }
}

const auditedScenes = new WeakSet<THREE.Object3D>();

function getTextureDimensions(texture: THREE.Texture) {
  const source = texture.source?.data ?? texture.image;
  if (!source || typeof source !== 'object') {
    return { width: 0, height: 0 };
  }

  const width = 'width' in source && typeof source.width === 'number' ? source.width : 0;
  const height = 'height' in source && typeof source.height === 'number' ? source.height : 0;
  return { width, height };
}

function gatherMaterialTextures(material: THREE.Material): ShipTextureAudit[] {
  if (!(material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial)) {
    return [];
  }

  const textureSlots: Array<[string, THREE.Texture | null]> = [
    ['baseColor', material.map],
    ['normal', material.normalMap],
    ['roughness', material.roughnessMap],
    ['metalness', material.metalnessMap],
    ['ao', material.aoMap],
    ['emissive', material.emissiveMap],
    ['alpha', material.alphaMap],
  ];

  return textureSlots
    .filter(([, texture]) => Boolean(texture))
    .map(([slot, texture]) => {
      const safeTexture = texture as THREE.Texture;
      const { width, height } = getTextureDimensions(safeTexture);
      return {
        slot,
        name: safeTexture.name || '(unnamed)',
        width,
        height,
        colorSpace: String(safeTexture.colorSpace ?? 'unknown'),
      };
    });
}

function shouldRunAudit() {
  if (typeof window === 'undefined') return false;
  if (process.env.NODE_ENV !== 'production') return true;
  return window.localStorage.getItem('star-cleaver-model-audit') === '1';
}

export function auditShipModel(scene: THREE.Object3D, label: string): ShipModelAuditReport | null {
  if (!shouldRunAudit()) return null;
  if (auditedScenes.has(scene)) return null;
  auditedScenes.add(scene);

  let meshCount = 0;
  let vertices = 0;
  let triangles = 0;
  let materialCount = 0;
  const materialSet = new Set<THREE.Material>();
  const textures: ShipTextureAudit[] = [];

  scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    meshCount += 1;

    const geometry = child.geometry;
    const position = geometry.getAttribute('position');
    if (position) {
      vertices += position.count;
      triangles += geometry.index ? geometry.index.count / 3 : position.count / 3;
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (!material) return;
      materialCount += 1;
      materialSet.add(material);
      textures.push(...gatherMaterialTextures(material));
    });
  });

  const uniqueTextureRows = new Map<string, ShipTextureAudit>();
  textures.forEach((row) => {
    const key = `${row.slot}|${row.name}|${row.width}|${row.height}|${row.colorSpace}`;
    uniqueTextureRows.set(key, row);
  });

  const report: ShipModelAuditReport = {
    label,
    meshes: meshCount,
    materials: materialCount,
    uniqueMaterials: materialSet.size,
    vertices,
    triangles: Math.round(triangles),
    textures: Array.from(uniqueTextureRows.values()),
  };

  window.__starCleaverShipAudit = report;

  // One-time snapshot for quick QA after each GLB replacement.
  console.groupCollapsed(`[Helion Drift][Ship QA] ${label}`);
  console.log('Triangles:', report.triangles);
  console.log('Vertices:', report.vertices);
  console.log('Meshes:', report.meshes);
  console.log('Materials:', report.materials, 'Unique:', report.uniqueMaterials);
  if (report.textures.length > 0) {
    console.table(report.textures);
  } else {
    console.log('Textures: none detected in PBR slots');
  }
  console.groupEnd();

  return report;
}

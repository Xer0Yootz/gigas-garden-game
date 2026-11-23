import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { ASSET_URLS } from './types';

export interface LoadedWorldAssets {
  shipRoot: THREE.Group;
  ruinsRoot: THREE.Group;
  propulsionLights: THREE.PointLight[];
  dispose: () => void;
}

function createConfiguredLoader(): { loader: GLTFLoader; draco: DRACOLoader } {
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  return { loader, draco };
}

/**
 * Loads the canonical runtime GLB assets without stretching or approximating them:
 * 1. infinity6-ship.glb — uniform scale ONLY, positioned alone on the teal water plain at the
 *    Sutro Baths shore apron edge so its aft propulsion/ramp meets the walkable shore ramp.
 * 2. ruins-megastructures.glb — uniform scale ONLY, grounded on the north shore/cliff side.
 */
export function loadExternalWorldAssets(
  isSoftwareGl: boolean,
  terrainHeightAt: (x: number, z: number) => number,
  callbacks: {
    onShipLoaded?: () => void;
    onRuinsLoaded?: () => void;
  }
): LoadedWorldAssets {
  const shipRoot = new THREE.Group();
  shipRoot.name = 'INFINITY_6_EXTERIOR';

  const ruinsRoot = new THREE.Group();
  ruinsRoot.name = 'RUINS_MEGASTRUCTURES';

  const propulsionGroup = new THREE.Group();
  propulsionGroup.name = 'PROPULSION';
  shipRoot.add(propulsionGroup);

  const propulsionLights: THREE.PointLight[] = [];

  const { loader, draco } = createConfiguredLoader();

  // 1. Load Infinity 6 ship GLB at runtime — uniform scale ONLY, exact proportions preserved
  loader.load(
    ASSET_URLS.shipGlb,
    (gltf) => {
      const model = gltf.scene;
      model.name = 'INFINITY_6_GLB_MODEL';

      model.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.castShadow = !isSoftwareGl;
          obj.receiveShadow = true;
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) {
            if (m && 'envMapIntensity' in m) {
              const std = m as THREE.MeshStandardMaterial;
              std.envMapIntensity = 1.05;
              if ('roughness' in std) {
                std.roughness = Math.min(Math.max(std.roughness, 0.36), 0.78);
              }
            }
          }
        }
      });

      // Compute exact unscaled bounding box
      const rawBox = new THREE.Box3().setFromObject(model);
      const rawSize = rawBox.getSize(new THREE.Vector3());
      const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z, 0.001);

      // Canon: Bridge deck alone is 30m x 24m, player is 1.8m -> monumental Mythic landmark scale (~108m)
      // STRICTLY UNIFORM SCALE ONLY — never stretch the ship model!
      const targetSpan = 108.0;
      const uniformScale = targetSpan / maxDim;
      model.scale.setScalar(uniformScale);

      // Recompute bounds after uniform scaling
      model.updateMatrixWorld(true);
      const scaledBox = new THREE.Box3().setFromObject(model);
      const scaledSize = scaledBox.getSize(new THREE.Vector3());

      // Align longest horizontal axis along Z (prow -> -Z seaward, stern -> +Z toward ramp/shore apron)
      if (scaledSize.x > scaledSize.z * 1.15) {
        model.rotation.y = Math.PI / 2;
        model.updateMatrixWorld(true);
      }

      const alignedBox = new THREE.Box3().setFromObject(model);
      const alignedCenter = alignedBox.getCenter(new THREE.Vector3());

      // Ground hull cleanly right into the teal water at the Sutro Baths edge
      // with stern meeting the walkable ramp cleanly at z ~ +23
      model.position.x -= alignedCenter.x;
      model.position.y -= alignedBox.min.y + 1.35;
      model.position.z -= alignedBox.max.z - 23.0;

      shipRoot.add(model);

      // Add subtle canonical PROPULSION engine bell aft glow lights flanking the aft ramp exit
      const bellOffsets = [-8.4, 8.4];
      const bellGeo = new THREE.CylinderGeometry(1.3, 1.65, 0.85, 20);
      bellGeo.rotateX(Math.PI / 2);
      const bellGlowMat = new THREE.MeshBasicNodeMaterial({
        color: new THREE.Color(0xb85cff),
        transparent: true,
        opacity: 0.6,
      });

      for (const bx of bellOffsets) {
        const glowRing = new THREE.Mesh(bellGeo, bellGlowMat);
        glowRing.name = bx < 0 ? 'PROPULSION_BELL_PORT' : 'PROPULSION_BELL_STARBOARD';
        glowRing.position.set(bx, 6.2, 22.2);
        propulsionGroup.add(glowRing);

        const light = new THREE.PointLight(0xc026d3, 20, 28, 1.6);
        light.position.set(bx, 6.2, 23.6);
        propulsionGroup.add(light);
        propulsionLights.push(light);
      }

      callbacks.onShipLoaded?.();
    },
    undefined,
    (err) => {
      console.error('Failed to load infinity6-ship.glb:', err);
      callbacks.onShipLoaded?.();
    }
  );

  // 2. Load ruins-megastructures.glb at runtime — uniform scale ONLY, monumental Midgar brutalist presence on north cliff rim
  loader.load(
    ASSET_URLS.ruinsGlb,
    (gltf) => {
      const ruins = gltf.scene;
      ruins.name = 'RUINS_MEGASTRUCTURES_GLB_MODEL';

      ruins.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.castShadow = !isSoftwareGl;
          obj.receiveShadow = true;
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) {
            if (m && 'roughness' in m) {
              // Grounded FF7 Midgar brutalist concrete & weathered industrial metal weight
              const std = m as THREE.MeshStandardMaterial;
              std.roughness = Math.max(std.roughness, 0.78);
              std.metalness = Math.min(std.metalness, 0.34);
              std.envMapIntensity = 0.82;
            }
          }
        }
      });

      const rawBox = new THREE.Box3().setFromObject(ruins);
      const rawSize = rawBox.getSize(new THREE.Vector3());
      const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z, 0.001);

      // Colossal mythic brutalist scale towering above the stepped north cliff rim
      const uniformScale = 58.0 / maxDim;
      ruins.scale.setScalar(uniformScale);
      ruins.updateMatrixWorld(true);

      const scaledBox = new THREE.Box3().setFromObject(ruins);
      const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

      const targetX = 72.0;
      const targetZ = 56.0;
      const groundY = terrainHeightAt(targetX, targetZ);

      ruins.position.set(
        targetX - scaledCenter.x,
        groundY - scaledBox.min.y - 2.0, // deep heavy brutalist foundation seated firmly into cliff
        targetZ - scaledCenter.z
      );
      ruins.rotation.y = -0.58;

      ruinsRoot.add(ruins);
      callbacks.onRuinsLoaded?.();
    },
    undefined,
    (err) => {
      console.error('Failed to load ruins-megastructures.glb:', err);
      callbacks.onRuinsLoaded?.();
    }
  );

  return {
    shipRoot,
    ruinsRoot,
    propulsionLights,
    dispose: () => {
      draco.dispose();
      [shipRoot, ruinsRoot].forEach((root) => {
        root.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry?.dispose();
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose());
            } else {
              obj.material?.dispose();
            }
          }
        });
      });
    },
  };
}

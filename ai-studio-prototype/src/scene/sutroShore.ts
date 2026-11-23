import * as THREE from 'three/webgpu';
import {
  Fn,
  float,
  vec3,
  color,
  positionWorld,
  normalWorld,
  time,
  sin,
  cos,
  mix,
  smoothstep,
  clamp,
  dot,
  max,
  pow,
  texture,
  uv,
} from 'three/tsl';
import { SUN_DIRECTION } from './types';
import { WorldTextureSet } from './textures';

export interface SutroPoolSpec {
  cx: number;
  cz: number;
  w: number;
  d: number;
  wallH: number;
}

// Monumental rectangular ruined Sutro Baths tide pools lining the shoreline (Zone 3)
export const SUTRO_POOLS: SutroPoolSpec[] = [
  { cx: -24, cz: 35, w: 18, d: 14, wallH: 1.85 },
  { cx: -45, cz: 42, w: 19, d: 15, wallH: 2.2 },
  { cx: -30, cz: 53, w: 17, d: 13, wallH: 2.0 },
  { cx: 24, cz: 36, w: 18, d: 14, wallH: 1.9 },
  { cx: 43, cz: 46, w: 17, d: 14, wallH: 2.3 },
];

/**
 * Deterministic heightfield for the continuous Sutro Baths shore, brutalist shore apron,
 * landward forest slope, and stepped climbable brutalist north cliff rim (+X side).
 */
export function terrainHeightAt(x: number, z: number): number {
  // 1. Base shoreline profile: sea floor (< z=28) rising to beach shore apron (z=38..74)
  const shoreCurve = z - 30.0 - Math.sin(x * 0.045) * 4.5 - Math.cos(x * 0.09) * 2.0;
  let y = -3.4 + THREE.MathUtils.smoothstep(shoreCurve, -12, 16) * 5.05;

  // Keep the ramp touchdown shore apron directly behind Infinity 6 level & solid
  const apronMask =
    (1 - THREE.MathUtils.smoothstep(Math.abs(x), 8, 16)) *
    THREE.MathUtils.smoothstep(z, 33, 40) *
    (1 - THREE.MathUtils.smoothstep(z, 56, 68));
  y = THREE.MathUtils.lerp(y, 1.55, apronMask);

  // 2. Carve rectangular Sutro Baths pool basins below waterline so bright teal sea fills them
  for (const pool of SUTRO_POOLS) {
    const dx = Math.abs(x - pool.cx) - (pool.w * 0.5 - 1.4);
    const dz = Math.abs(z - pool.cz) - (pool.d * 0.5 - 1.4);
    if (dx < 1.4 && dz < 1.4) {
      const inside =
        (1 - THREE.MathUtils.smoothstep(dx, -0.4, 1.4)) *
        (1 - THREE.MathUtils.smoothstep(dz, -0.4, 1.4));
      y = THREE.MathUtils.lerp(y, -0.68, inside);
    }
  }

  // 3. Landward rise behind the baths into the dense dark tree line (z > 72)
  if (z > 70) {
    const t = THREE.MathUtils.smoothstep(z, 70, 145);
    y += t * 8.8 + Math.sin(x * 0.06 + z * 0.05) * 1.1 * t;
  }

  // 4. Stepped climbable brutalist cliff rim on the NORTH side (+X flank, x > 42, z > 12)
  if (x > 40 && z > 10) {
    const xRamp = THREE.MathUtils.smoothstep(x, 42, 118);
    const zMask =
      THREE.MathUtils.smoothstep(z, 12, 34) *
      (1 - THREE.MathUtils.smoothstep(z, 115, 165));
    const rawRise = xRamp * zMask * 17.5;

    // Bold walkable monumental stepped terraces
    const stepSize = 2.8;
    const stepIdx = Math.floor(rawRise / stepSize);
    const stepFrac = (rawRise - stepIdx * stepSize) / stepSize;
    const terraced = (stepIdx + THREE.MathUtils.smoothstep(stepFrac, 0.22, 0.84)) * stepSize;
    y += terraced;
  }

  const detail =
    (Math.sin(x * 0.16 + z * 0.12) * 0.22 + Math.cos(x * 0.28 - z * 0.24) * 0.12) *
    (1 - apronMask);
  return y + detail;
}

export function createSutroShoreWorld(
  textures: WorldTextureSet,
  isSoftwareGl: boolean
): THREE.Group {
  const root = new THREE.Group();
  root.name = 'GIGAS_GARDEN_SUTRO_SHORE';

  const sunDirNode = vec3(SUN_DIRECTION.x, SUN_DIRECTION.y, SUN_DIRECTION.z);

  // =========================================================================
  // 1. PAINTERLY ANIME SHORELINE & STEPPED NORTH CLIFF TERRAIN
  // =========================================================================
  const sizeX = 290;
  const sizeZ = 215;
  const terrainGeo = new THREE.PlaneGeometry(sizeX, sizeZ, 128, 104);
  terrainGeo.rotateX(-Math.PI / 2);
  terrainGeo.translate(12, 0, 106);

  const pos = terrainGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, terrainHeightAt(pos.getX(i), pos.getZ(i)));
  }
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardNodeMaterial({
    map: textures.sandAlbedo,
    roughness: 0.9,
    metalness: 0.05,
  });

  // Grounded FF7 Pacific volcanic coast: dark wet tidal basalt, weathered shale beach & moody forest floor
  terrainMat.colorNode = Fn(() => {
    const h = positionWorld.y;
    const n = normalWorld;
    const sunFace = max(dot(n, sunDirNode), 0.0);

    const wetBasaltSand = color(0x10222b);
    const coastalShale = color(0x2a2936);
    const cliffRock = color(0x31303f);
    const forestFloor = color(0x131a24);

    const baseBeach = mix(wetBasaltSand, coastalShale, smoothstep(0.0, 2.0, h));
    const baseCliff = mix(baseBeach, cliffRock, smoothstep(3.0, 10.5, h));
    const forestMask = smoothstep(72.0, 94.0, positionWorld.z);
    const baseCol = mix(baseCliff, forestFloor, forestMask.mul(0.82));

    // Restrained low-sun warm rose-amber graze across sun-facing coastal slopes
    const sunWash = color(0xd9809c).mul(smoothstep(0.18, 0.88, sunFace)).mul(0.14);
    return baseCol.add(sunWash);
  })();

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.name = 'SUTRO_BEACH_AND_NORTH_CLIFFS';
  terrainMesh.receiveShadow = true;
  root.add(terrainMesh);

  // =========================================================================
  // 2. MIDGAR BRUTALIST POURED CONCRETE & WEATHERED INDUSTRIAL STEEL
  // =========================================================================
  const brutalistConcreteMat = new THREE.MeshStandardNodeMaterial({
    roughnessMap: textures.stoneRoughness,
    bumpMap: textures.stoneBump,
    bumpScale: 0.16,
    roughness: 0.92,
    metalness: 0.04,
  });

  brutalistConcreteMat.colorNode = Fn(() => {
    const tex = texture(textures.stoneAlbedo, uv()).rgb;
    const h = positionWorld.y;
    const n = normalWorld;
    const sunHit = smoothstep(0.12, 0.78, max(dot(n, sunDirNode), 0.0));
    const upHit = smoothstep(0.45, 0.92, n.y);

    // Heavy FF7 Midgar weathered stone & concrete: deep charcoal shadows, grounded ash-stone faces
    const shadowConcrete = color(0x20232e);
    const sunlitConcrete = color(0x6e6974);
    const wetBase = color(0x0c2028);

    const litTone = mix(shadowConcrete, sunlitConcrete, sunHit.mul(0.76).add(upHit.mul(0.24)));
    const rawBlock = litTone.mul(tex.mul(1.55));
    const withWetLine = mix(wetBase, rawBlock, smoothstep(-0.2, 1.45, h));

    // Subtle raking dusk rim grazing upper concrete lips without pastel wash
    const rim = color(0xe08aa6).mul(upHit).mul(0.09);
    return withWetLine.add(rim);
  })();

  // Darker heavy basalt-concrete trim for deep architectural plinths & coping slabs
  const heavyPlinthMat = new THREE.MeshStandardNodeMaterial({
    color: new THREE.Color(0x222530),
    bumpMap: textures.stoneBump,
    bumpScale: 0.1,
    roughness: 0.94,
    metalness: 0.05,
  });

  // Midgar-style weathered structural steel for industrial bracing, quay armor & exposed lintel girders
  const weatheredSteelMat = new THREE.MeshStandardNodeMaterial({
    color: new THREE.Color(0x2a2f3b),
    bumpMap: textures.gunmetalBump,
    bumpScale: 0.08,
    roughness: 0.56,
    metalness: 0.74,
  });

  // =========================================================================
  // 3. BRUTALIST CONCRETE & STEEL SHORE APRON QUAY (Where Infinity 6 Ramp Meets Shore)
  // =========================================================================
  const quayGroup = new THREE.Group();
  quayGroup.name = 'BRUTALIST_SHORE_APRON_QUAY';

  // Broad heavy poured-concrete landing apron slab half-buried in coastal volcanic sand
  const mainApron = new THREE.Mesh(new THREE.BoxGeometry(20, 2.2, 16), brutalistConcreteMat);
  mainApron.position.set(0, 0.44, 44.5);
  mainApron.receiveShadow = true;
  quayGroup.add(mainApron);

  // Heavy weathered steel apron curb bumper along seaward & landward quay edges
  const seawardCurb = new THREE.Mesh(new THREE.BoxGeometry(20.4, 0.45, 0.85), weatheredSteelMat);
  seawardCurb.position.set(0, 1.46, 36.6);
  seawardCurb.castShadow = !isSoftwareGl;
  seawardCurb.receiveShadow = true;
  quayGroup.add(seawardCurb);

  // Heavy stepped brutalist flank bollards / breakwater blocks with Midgar steel tie-plates
  for (const side of [-1, 1]) {
    const flankWall = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.2, 14.5), brutalistConcreteMat);
    flankWall.position.set(side * 10.2, 1.15, 44.0);
    flankWall.castShadow = !isSoftwareGl;
    flankWall.receiveShadow = true;
    quayGroup.add(flankWall);

    // Weathered steel bumper beam bolted along inner quay wall face
    const steelRail = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.6, 14.2), weatheredSteelMat);
    steelRail.position.set(side * 8.4, 2.1, 44.0);
    steelRail.castShadow = !isSoftwareGl;
    quayGroup.add(steelRail);

    // Heavy stepped concrete bollard block at the seaward corner of the apron
    const bollard = new THREE.Mesh(new THREE.BoxGeometry(3.8, 4.4, 3.8), brutalistConcreteMat);
    bollard.position.set(side * 10.6, 1.75, 36.6);
    bollard.castShadow = !isSoftwareGl;
    bollard.receiveShadow = true;
    quayGroup.add(bollard);

    // Heavy iron mooring cap plate atop the seaward corner bollard
    const capPlate = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.42, 4.1), weatheredSteelMat);
    capPlate.position.set(side * 10.6, 4.02, 36.6);
    capPlate.castShadow = !isSoftwareGl;
    quayGroup.add(capPlate);
  }
  root.add(quayGroup);

  // =========================================================================
  // 4. MONUMENTAL BRUTALIST SUTRO BATHS RUINED TIDE POOLS (Zone 3)
  //    Thick 2.8m-3.4m poured-stone walls, buttresses, sunken steps & ruined monolith piers
  // =========================================================================
  const bathsGroup = new THREE.Group();
  bathsGroup.name = 'SUTRO_BATHS_TIDE_POOLS';

  // Grounded coastal sea-spray foam sheets breaking over the heavy seaward walls
  const washFoamMat = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
  });
  washFoamMat.colorNode = color(0xbad6da);
  washFoamMat.opacityNode = Fn(() => {
    const p = positionWorld.xz;
    const wave = sin(p.y.mul(0.42).sub(time.mul(2.75)).add(cos(p.x.mul(0.22)).mul(1.4)));
    return clamp(smoothstep(0.24, 0.82, wave).mul(0.54), 0.0, 0.56);
  })();

  const wallThickness = 2.85; // Heavy brutalist poured-stone walls — nothing delicate!

  for (let idx = 0; idx < SUTRO_POOLS.length; idx++) {
    const pool = SUTRO_POOLS[idx];
    const poolGroup = new THREE.Group();
    poolGroup.name = `SUTRO_TIDE_POOL_${idx + 1}`;

    const addBrutalistWall = (
      x1: number,
      z1: number,
      x2: number,
      z2: number,
      baseHeight: number,
      isSeaward: boolean
    ) => {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      const angle = Math.atan2(dx, dz);
      const segments = Math.max(3, Math.round(len / 4.8));
      const segLen = len / segments;

      for (let s = 0; s < segments; s++) {
        const hash = Math.sin(idx * 17.3 + s * 11.7 + baseHeight * 5.1);
        const hMod = isSeaward
          ? hash > 0.58
            ? 0.45
            : 0.78 + (hash + 1) * 0.22
          : 0.85 + (hash + 1) * 0.34;
        const h = baseHeight * hMod + 2.0; // Deep submerged root below y = -1.6

        const t = (s + 0.5) / segments;
        const px = x1 + dx * t;
        const pz = z1 + dz * t;

        const block = new THREE.Mesh(
          new THREE.BoxGeometry(wallThickness, h, segLen - 0.16),
          brutalistConcreteMat
        );
        block.position.set(px, h * 0.5 - 1.65, pz);
        block.rotation.y = angle;
        block.castShadow = !isSoftwareGl;
        block.receiveShadow = true;
        poolGroup.add(block);

        // Heavy overhanging brutalist coping slab on taller intact wall segments
        if (hMod > 0.85) {
          const cap = new THREE.Mesh(
            new THREE.BoxGeometry(wallThickness + 0.45, 0.42, segLen - 0.12),
            heavyPlinthMat
          );
          cap.position.set(px, h - 1.68, pz);
          cap.rotation.y = angle;
          poolGroup.add(cap);
        }
      }

      // Chunky brutalist corner buttress blocks anchoring the pool wall corners
      const cornerPier = new THREE.Mesh(
        new THREE.BoxGeometry(wallThickness + 1.1, baseHeight + 2.8, wallThickness + 1.1),
        brutalistConcreteMat
      );
      cornerPier.position.set(x1, (baseHeight + 2.8) * 0.5 - 1.65, z1);
      cornerPier.castShadow = !isSoftwareGl;
      cornerPier.receiveShadow = true;
      poolGroup.add(cornerPier);

      // Animated white surf foam washing over the heavy seaward concrete wall
      if (isSeaward) {
        const foamSheet = new THREE.Mesh(new THREE.PlaneGeometry(len * 0.96, 3.2), washFoamMat);
        foamSheet.rotation.x = -Math.PI / 2;
        foamSheet.rotation.z = -angle + Math.PI / 2;
        foamSheet.position.set((x1 + x2) * 0.5, 0.38, (z1 + z2) * 0.5 + 0.45);
        poolGroup.add(foamSheet);
      }
    };

    const hw = pool.w * 0.5;
    const hd = pool.d * 0.5;
    const xL = pool.cx - hw;
    const xR = pool.cx + hw;
    const zF = pool.cz - hd;
    const zB = pool.cz + hd;

    addBrutalistWall(xL, zF, xR, zF, pool.wallH * 0.72, true);
    addBrutalistWall(xL, zB, xR, zB, pool.wallH * 1.18, false);
    addBrutalistWall(xL, zF, xL, zB, pool.wallH, false);
    addBrutalistWall(xR, zF, xR, zB, pool.wallH * 0.96, false);

    // Submerged heavy poured-stone pool floor
    const basinFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(pool.w - 2.2, pool.d - 2.2),
      heavyPlinthMat
    );
    basinFloor.rotation.x = -Math.PI / 2;
    basinFloor.position.set(pool.cx, -0.58, pool.cz);
    poolGroup.add(basinFloor);

    // Sunken brutalist concrete steps descending into the turquoise pool water
    for (let st = 0; st < 3; st++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(5.2, 0.55, 1.15),
        brutalistConcreteMat
      );
      step.position.set(pool.cx, 0.65 - st * 0.42, zB - 1.8 - st * 1.05);
      poolGroup.add(step);
    }

    bathsGroup.add(poolGroup);
  }

  // Monumental ruined brutalist bathhouse piers & broken concrete portal lintels behind the tide pools!
  // Gives unmistakable heavy raw concrete architectural silhouette on the shoreline (nothing delicate)
  const monolithSpecs: Array<{ x: number; z: number; w: number; h: number; d: number; rot: number; lintel?: boolean }> = [
    { x: -35, z: 61, w: 4.2, h: 8.6, d: 3.6, rot: 0.08, lintel: true },
    { x: -24, z: 62, w: 4.0, h: 7.4, d: 3.6, rot: 0.08 },
    { x: -53, z: 54, w: 4.6, h: 9.4, d: 4.0, rot: 0.22 },
    { x: 32, z: 56, w: 4.4, h: 8.8, d: 3.8, rot: -0.14, lintel: true },
    { x: 43, z: 58, w: 4.2, h: 7.6, d: 3.8, rot: -0.14 },
  ];

  for (let m = 0; m < monolithSpecs.length; m++) {
    const spec = monolithSpecs[m];
    const gy = terrainHeightAt(spec.x, spec.z);
    const pier = new THREE.Mesh(
      new THREE.BoxGeometry(spec.w, spec.h, spec.d),
      brutalistConcreteMat
    );
    pier.position.set(spec.x, gy + spec.h * 0.5 - 1.2, spec.z);
    pier.rotation.y = spec.rot;
    pier.castShadow = !isSoftwareGl;
    pier.receiveShadow = true;
    bathsGroup.add(pier);

    // Stepped cantilevered brutalist capital / broken lintel + Midgar weathered steel tie-girder
    if (spec.lintel && m + 1 < monolithSpecs.length) {
      const next = monolithSpecs[m + 1];
      const midX = (spec.x + next.x) * 0.5;
      const midZ = (spec.z + next.z) * 0.5;
      const span = Math.hypot(next.x - spec.x, next.z - spec.z) + 4.4;
      const lintelY = gy + Math.min(spec.h, next.h) - 1.1;
      const lintelRot = -Math.atan2(next.z - spec.z, next.x - spec.x);

      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(span, 2.2, 4.2),
        brutalistConcreteMat
      );
      beam.position.set(midX, lintelY, midZ);
      beam.rotation.y = lintelRot;
      beam.castShadow = !isSoftwareGl;
      beam.receiveShadow = true;
      bathsGroup.add(beam);

      // Exposed weathered Midgar industrial steel under-girder reinforcing the massive concrete lintel
      const girder = new THREE.Mesh(
        new THREE.BoxGeometry(span * 0.96, 0.65, 2.2),
        weatheredSteelMat
      );
      girder.position.set(midX, lintelY - 1.35, midZ);
      girder.rotation.y = lintelRot;
      girder.castShadow = !isSoftwareGl;
      bathsGroup.add(girder);
    }
  }

  root.add(bathsGroup);

  // =========================================================================
  // 5. BRUTALIST POURED-STONE STEPPED NORTH CLIFF RETAINING MONOLITHS (+X)
  //    Reinforces the climbable cliff rim with monumental cut-stone terraces
  // =========================================================================
  const cliffRetainingGroup = new THREE.Group();
  cliffRetainingGroup.name = 'BRUTALIST_NORTH_CLIFF_TERRACES';

  const terraceSlabs: Array<[number, number, number, number, number, number]> = [
    [52, 34, 10, 5.2, 22, -0.15],
    [60, 44, 12, 7.6, 26, -0.22],
    [70, 58, 14, 10.5, 30, -0.18],
    [82, 42, 16, 13.5, 28, -0.25],
    [56, 68, 13, 6.8, 22, -0.08],
  ];

  for (const [tx, tz, tw, th, td, trot] of terraceSlabs) {
    const gy = terrainHeightAt(tx, tz);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(tw, th, td), brutalistConcreteMat);
    slab.position.set(tx, gy - th * 0.45, tz);
    slab.rotation.y = trot;
    slab.castShadow = !isSoftwareGl;
    slab.receiveShadow = true;
    cliffRetainingGroup.add(slab);
  }
  root.add(cliffRetainingGroup);

  // =========================================================================
  // 6. DENSE DARK TREE LINE BEHIND THE BATHS (Silhouettes against luminous Sky!)
  // =========================================================================
  const treeGroup = new THREE.Group();
  treeGroup.name = 'GIGAS_GARDEN_DARK_TREE_LINE';

  const treePositions: Array<{ x: number; y: number; z: number; scale: number; rot: number; tint: number }> = [];
  for (let i = 0; i < 320; i++) {
    const h1 = Math.sin(i * 12.9898 + 1.23) * 43758.5453;
    const r1 = h1 - Math.floor(h1);
    const h2 = Math.sin(i * 78.233 + 4.56) * 24634.6345;
    const r2 = h2 - Math.floor(h2);
    const h3 = Math.sin(i * 41.123 + 9.87) * 19513.312;
    const r3 = h3 - Math.floor(h3);

    const tx = -118 + r1 * 240;
    const minZ = Math.abs(tx) < 18 ? 82 : 76;
    const tz = minZ + Math.pow(r2, 0.8) * 94;

    // Keep clear of the north cliff megastructures footprint
    if (Math.hypot(tx - 70, tz - 56) < 26) continue;

    const ty = terrainHeightAt(tx, tz);
    if (ty < 1.2) continue;

    treePositions.push({
      x: tx,
      y: ty - 0.4,
      z: tz,
      scale: 0.92 + r3 * 0.82, // Taller, bolder mythic open-world forest wall
      rot: r1 * Math.PI * 2,
      tint: r3,
    });
  }

  const count = treePositions.length;
  const trunkGeo = new THREE.CylinderGeometry(0.34, 0.62, 5.8, 6);
  trunkGeo.translate(0, 2.9, 0);
  const trunkMat = new THREE.MeshStandardNodeMaterial({
    color: new THREE.Color(0x1b172a),
    roughness: 0.94,
    metalness: 0.02,
  });

  // Clean, bold stylized anime conifer canopies catching sunlit pink rim against the dark silhouette
  const lowerCanopyGeo = new THREE.ConeGeometry(3.8, 8.8, 7);
  lowerCanopyGeo.translate(0, 7.6, 0);
  const upperCanopyGeo = new THREE.ConeGeometry(2.6, 7.4, 7);
  upperCanopyGeo.translate(0, 12.2, 0);

  const canopyMat = new THREE.MeshStandardNodeMaterial({
    roughness: 0.94,
    metalness: 0.02,
  });
  canopyMat.colorNode = Fn(() => {
    const n = normalWorld;
    const sunRim = pow(max(dot(n, sunDirNode), 0.0), 2.8);
    const deepForest = color(0x0a131c);
    const coastalPine = color(0x13242e);
    const base = mix(deepForest, coastalPine, smoothstep(-0.2, 0.85, n.y));
    // Crisp low-sun dusk rose-amber rim grazing dark coastal cypress silhouettes
    return base.add(color(0xd47092).mul(sunRim).mul(0.22));
  })();

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const lowCanopy = new THREE.InstancedMesh(lowerCanopyGeo, canopyMat, count);
  const highCanopy = new THREE.InstancedMesh(upperCanopyGeo, canopyMat, count);

  const dummy = new THREE.Object3D();
  const cTmp = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const t = treePositions[i];
    dummy.position.set(t.x, t.y, t.z);
    dummy.rotation.set(0, t.rot, 0);
    dummy.scale.set(t.scale, t.scale * (0.96 + (i % 5) * 0.07), t.scale);
    dummy.updateMatrix();

    trunks.setMatrixAt(i, dummy.matrix);
    lowCanopy.setMatrixAt(i, dummy.matrix);
    highCanopy.setMatrixAt(i, dummy.matrix);

    cTmp.setRGB(
      0.72 + t.tint * 0.24,
      0.8 + (1 - t.tint) * 0.2,
      0.86 + t.tint * 0.16
    );
    lowCanopy.setColorAt(i, cTmp);
    highCanopy.setColorAt(i, cTmp);
  }

  trunks.instanceMatrix.needsUpdate = true;
  lowCanopy.instanceMatrix.needsUpdate = true;
  highCanopy.instanceMatrix.needsUpdate = true;
  if (lowCanopy.instanceColor) lowCanopy.instanceColor.needsUpdate = true;
  if (highCanopy.instanceColor) highCanopy.instanceColor.needsUpdate = true;

  trunks.computeBoundingSphere();
  lowCanopy.computeBoundingSphere();
  highCanopy.computeBoundingSphere();

  treeGroup.add(trunks, lowCanopy, highCanopy);

  // Restrained mysterious Mako-teal & violet Gigas Garden flora glints tucked into the dark forest edge
  const floraGeo = new THREE.IcosahedronGeometry(0.42, 1);
  const floraMat = new THREE.MeshBasicNodeMaterial({ color: new THREE.Color(0x9a42b8) });
  const floraCount = 36;
  const floraMesh = new THREE.InstancedMesh(floraGeo, floraMat, floraCount);
  for (let i = 0; i < floraCount; i++) {
    const t = treePositions[(i * 7) % count];
    dummy.position.set(t.x + Math.sin(i) * 2.2, t.y + 0.5, t.z - 2.6);
    dummy.scale.setScalar(0.5 + (i % 4) * 0.2);
    dummy.rotation.set(0, i, 0);
    dummy.updateMatrix();
    floraMesh.setMatrixAt(i, dummy.matrix);
    cTmp.setHex(i % 3 === 0 ? 0x169e9e : 0x8b3fa8);
    floraMesh.setColorAt(i, cTmp);
  }
  floraMesh.instanceMatrix.needsUpdate = true;
  if (floraMesh.instanceColor) floraMesh.instanceColor.needsUpdate = true;
  floraMesh.computeBoundingSphere();
  treeGroup.add(floraMesh);

  root.add(treeGroup);

  // 7. Heavy raw coastal monolith boulders along the cliff base & tide-pool margins
  const boulderGeo = new THREE.DodecahedronGeometry(1.75, 0); // Crisp faceted brutalist rock weight
  const boulderCoords: Array<[number, number, number]> = [
    [-14, 48, 1.4],
    [-38, 60, 1.9],
    [16, 51, 1.5],
    [48, 30, 2.6],
    [54, 54, 2.8],
    [36, 68, 2.0],
    [-58, 46, 2.8],
    [62, 74, 2.4],
  ];
  for (const [bx, bz, bs] of boulderCoords) {
    const b = new THREE.Mesh(boulderGeo, brutalistConcreteMat);
    b.position.set(bx, terrainHeightAt(bx, bz) + bs * 0.3, bz);
    b.scale.set(bs * 1.25, bs * 0.78, bs);
    b.rotation.set(bx * 0.25, bz * 0.2, 0.15);
    b.castShadow = !isSoftwareGl;
    b.receiveShadow = true;
    root.add(b);
  }

  return root;
}

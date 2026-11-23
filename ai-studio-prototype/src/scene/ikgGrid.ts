import * as THREE from 'three/webgpu';
import {
  Fn,
  float,
  vec2,
  color,
  positionWorld,
  time,
  sin,
  abs,
  fract,
  fwidth,
  min,
  max,
  mix,
  smoothstep,
  clamp,
  length,
} from 'three/tsl';

/**
 * NEON VIGIL — IKG GRID (Intergalactic Kyber Grid) WebGPU / TSL Shader Plane
 *
 * Faint intergalactic kyber grid lines glowing subtly under the exterior Gigas Garden floor
 * and Sutro Baths shore terrain. Conforms cleanly to the coastal terrain heightfield so it
 * hugs the beach apron, forest edge, and stepped north cliffs without Z-fighting, while fading
 * out smoothly over deep open water and distant edges.
 */
export function createIKGGrid(
  terrainHeightAt: (x: number, z: number) => number
): THREE.Mesh {
  const sizeX = 250;
  const sizeZ = 195;
  const gridGeo = new THREE.PlaneGeometry(sizeX, sizeZ, 112, 92);
  gridGeo.rotateX(-Math.PI / 2);
  gridGeo.translate(12, 0, 102);

  // Conform grid shader plane smoothly just above the Gigas Garden ground surface
  const pos = gridGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const gx = pos.getX(i);
    const gz = pos.getZ(i);
    pos.setY(i, terrainHeightAt(gx, gz) + 0.065);
  }
  gridGeo.computeVertexNormals();

  // Uses MeshStandardNodeMaterial with pure emissiveNode so MRT selective bloom catches the faint kyber lines cleanly
  const ikgMat = new THREE.MeshStandardNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    roughness: 1.0,
    metalness: 0.0,
  });

  // Anti-aliased screen-space derivative grid line helper
  const gridLineMask = (coord: typeof positionWorld.xz, spacing: number, lineWidth: number) => {
    const scaled = coord.div(spacing);
    const fw = max(fwidth(scaled), float(0.002));
    const cellDist = abs(fract(scaled.sub(0.5)).sub(0.5)).div(fw);
    const minDist = min(cellDist.x, cellDist.y);
    return float(1.0).sub(smoothstep(float(lineWidth * 0.5), float(lineWidth * 1.35), minDist));
  };

  // Faint intersection node cross-ticks at major 8m Kyber lattice vertices (architectural — NO stars/sparkles)
  const computeIKGField = Fn(() => {
    const xz = positionWorld.xz;
    const y = positionWorld.y;

    const majorLines = gridLineMask(xz, 8.0, 1.15);
    const minorLines = gridLineMask(xz, 2.0, 0.85).mul(0.28);

    // Subtle node reinforcement at major 8m kyber intersections
    const majorCell = abs(fract(xz.div(8.0).sub(0.5)).sub(0.5));
    const nodeCross = smoothstep(0.06, 0.015, majorCell.x).mul(smoothstep(0.06, 0.015, majorCell.y));

    // Gentle radial breathing kyber wave flowing from the Infinity 6 shore apron across Gigas Garden
    const distFromHub = length(xz.sub(vec2(0.0, 46.0)));
    const kyberPulse = sin(distFromHub.mul(0.085).sub(time.mul(0.95))).mul(0.5).add(0.5);
    const pulseBoost = float(0.65).add(kyberPulse.mul(0.55));

    // Ground mask: strictly on land / garden floor & shore apron (fades smoothly off before open ocean)
    const landMask = smoothstep(-0.15, 0.72, y);
    const shoreFade = smoothstep(26.0, 42.0, xz.y);
    const edgeFade = smoothstep(132.0, 42.0, distFromHub);
    const mask = landMask.mul(shoreFade).mul(edgeFade);

    const gridStrength = clamp(majorLines.add(minorLines).add(nodeCross.mul(0.45)), 0.0, 1.0);
    return gridStrength.mul(pulseBoost).mul(mask);
  });

  ikgMat.colorNode = color(0x000000);

  ikgMat.emissiveNode = Fn(() => {
    const field = computeIKGField();
    const xz = positionWorld.xz;
    const distFromHub = length(xz.sub(vec2(0.0, 46.0)));
    const waveTint = sin(distFromHub.mul(0.06).sub(time.mul(0.7))).mul(0.5).add(0.5);

    // Subtle intergalactic kyber indigo-to-cyan glow grounded in FF7 anime-realist mood
    const kyberIndigo = color(0x4f46e5);
    const kyberCyan = color(0x22d3ee);
    const lineColor = mix(kyberIndigo, kyberCyan, waveTint.mul(0.65));

    return lineColor.mul(field).mul(0.68);
  })();

  ikgMat.opacityNode = Fn(() => {
    return clamp(computeIKGField().mul(0.36), 0.0, 0.42);
  })();

  const gridMesh = new THREE.Mesh(gridGeo, ikgMat);
  gridMesh.name = 'IKG_KYBER_GROUND_GRID';
  gridMesh.renderOrder = 1;
  return gridMesh;
}

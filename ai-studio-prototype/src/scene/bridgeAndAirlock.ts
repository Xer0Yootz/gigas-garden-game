import * as THREE from 'three/webgpu';
import {
  Fn,
  float,
  color,
  uv,
  time,
  sin,
  cos,
  mix,
  smoothstep,
  uniform,
} from 'three/tsl';
import { AIRLOCK, BRIDGE, RAMP } from './types';
import { WorldTextureSet } from './textures';
import {
  addDeltaHologramPart,
  createDeltaHologramMaterial,
  createDeltaHoloFieldMaterial,
  createDeltaInkOutlineMaterial,
  createDeltaMouthWaveformMaterial,
} from './nvHologram';

export interface BridgeAndAirlockRig {
  bridgeGroup: THREE.Group;       // Interior bridge + Cyphr bay (Deck 1 Upper)
  airlockGroup: THREE.Group;      // Airlock chamber (fog ONLY inside here)
  rampGroup: THREE.Group;         // Exterior descending ramp meeting the Sutro Baths shore apron
  backDoorLeft: THREE.Mesh;
  backDoorRight: THREE.Mesh;
  airlockOuterDoorLeft: THREE.Mesh;
  airlockOuterDoorRight: THREE.Mesh;
  cyphrGroup: THREE.Group;
  cyphrSpeakingUniform: THREE.UniformNode<'float', number>;
  update: (dt: number, elapsed: number, playerPos: THREE.Vector3, cyphrSpeaking: boolean) => void;
}

/**
 * Builds an oval / stadium-shaped panoramic aperture frame (24m wide × 7m high) in a thick ribbed
 * near-black surround with violet/magenta emissive filaments, matching References 3 & 4.
 */
function buildOvalViewportWall(
  hullMat: THREE.Material,
  darkRibMat: THREE.Material,
  violetFilamentMat: THREE.Material,
  cyanTrimMat: THREE.Material
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'OVAL_PANORAMIC_VIEWPORT';

  const wallW = BRIDGE.width;
  const wallH = BRIDGE.height;
  const openW = BRIDGE.viewportWidth;   // 24 m
  const openH = BRIDGE.viewportHeight;  // 7 m
  const openR = openH * 0.5;            // 3.5 m rounded stadium ends
  const straightHalf = openW * 0.5 - openR; // 8.5 m

  // Outer bulkhead rectangle with stadium-oval hole cut cleanly out
  const wallShape = new THREE.Shape();
  wallShape.moveTo(-wallW * 0.5, 0);
  wallShape.lineTo(wallW * 0.5, 0);
  wallShape.lineTo(wallW * 0.5, wallH);
  wallShape.lineTo(-wallW * 0.5, wallH);
  wallShape.closePath();

  const cy = BRIDGE.viewportCenterY - BRIDGE.deckY; // 4.05 m local center height
  const hole = new THREE.Path();
  hole.absarc(straightHalf, cy, openR, -Math.PI / 2, Math.PI / 2, false);
  hole.absarc(-straightHalf, cy, openR, Math.PI / 2, Math.PI * 1.5, false);
  hole.closePath();
  wallShape.holes.push(hole);

  const bulkheadGeo = new THREE.ExtrudeGeometry(wallShape, {
    depth: 1.5,
    bevelEnabled: true,
    bevelThickness: 0.16,
    bevelSize: 0.14,
    bevelSegments: 2,
    curveSegments: 32,
  });
  bulkheadGeo.translate(0, 0, -0.75);
  const bulkheadMesh = new THREE.Mesh(bulkheadGeo, hullMat);
  bulkheadMesh.receiveShadow = true;
  group.add(bulkheadMesh);

  // Thick ribbed black oval surround collar framing the 24m × 7m aperture
  const rimOuter = new THREE.Shape();
  const rOut = openR + 0.72;
  rimOuter.absarc(straightHalf, cy, rOut, -Math.PI / 2, Math.PI / 2, false);
  rimOuter.absarc(-straightHalf, cy, rOut, Math.PI / 2, Math.PI * 1.5, false);
  rimOuter.closePath();

  const rimInner = new THREE.Path();
  rimInner.absarc(straightHalf, cy, openR - 0.04, -Math.PI / 2, Math.PI / 2, false);
  rimInner.absarc(-straightHalf, cy, openR - 0.04, Math.PI / 2, Math.PI * 1.5, false);
  rimInner.closePath();
  rimOuter.holes.push(rimInner);

  const rimGeo = new THREE.ExtrudeGeometry(rimOuter, {
    depth: 1.9,
    bevelEnabled: true,
    bevelThickness: 0.14,
    bevelSize: 0.12,
    bevelSegments: 2,
    curveSegments: 36,
  });
  rimGeo.translate(0, 0, -0.9);
  const rimMesh = new THREE.Mesh(rimGeo, darkRibMat);
  group.add(rimMesh);

  // Exact analytical stadium curve points for crisp violet + cyan tubes
  const buildStadiumCurve = (radOffset: number, zOff: number): THREE.CatmullRomCurve3 => {
    const pts: THREE.Vector3[] = [];
    const r = openR + radOffset;
    const arcSteps = 20;
    // Right semicircle (-PI/2 to +PI/2)
    for (let i = 0; i <= arcSteps; i++) {
      const a = -Math.PI / 2 + (i / arcSteps) * Math.PI;
      pts.push(new THREE.Vector3(straightHalf + Math.cos(a) * r, cy + Math.sin(a) * r, zOff));
    }
    // Top straight edge right -> left
    for (let i = 1; i < 10; i++) {
      const x = THREE.MathUtils.lerp(straightHalf, -straightHalf, i / 10);
      pts.push(new THREE.Vector3(x, cy + r, zOff));
    }
    // Left semicircle (+PI/2 to +3PI/2)
    for (let i = 0; i <= arcSteps; i++) {
      const a = Math.PI / 2 + (i / arcSteps) * Math.PI;
      pts.push(new THREE.Vector3(-straightHalf + Math.cos(a) * r, cy + Math.sin(a) * r, zOff));
    }
    // Bottom straight edge left -> right
    for (let i = 1; i < 10; i++) {
      const x = THREE.MathUtils.lerp(-straightHalf, straightHalf, i / 10);
      pts.push(new THREE.Vector3(x, cy - r, zOff));
    }
    return new THREE.CatmullRomCurve3(pts, true);
  };

  const violetTube = new THREE.Mesh(
    new THREE.TubeGeometry(buildStadiumCurve(0.28, 0.96), 120, 0.065, 8, true),
    violetFilamentMat
  );
  group.add(violetTube);

  const cyanInnerTube = new THREE.Mesh(
    new THREE.TubeGeometry(buildStadiumCurve(0.06, 0.98), 120, 0.032, 8, true),
    cyanTrimMat
  );
  group.add(cyanInnerTube);

  // Subtle ribbed mechanical fins around the oval surround
  const ribCurve = buildStadiumCurve(0.55, 0.72);
  const ribCount = 28;
  const ribGeo = new THREE.BoxGeometry(0.18, 0.78, 0.55);
  for (let i = 0; i < ribCount; i++) {
    const u = i / ribCount;
    const p = ribCurve.getPointAt(u);
    const tangent = ribCurve.getTangentAt(u);
    const rib = new THREE.Mesh(ribGeo, darkRibMat);
    rib.position.copy(p);
    rib.rotation.z = Math.atan2(tangent.y, tangent.x);
    group.add(rib);
  }

  // Ultra-clear low-opacity viewport glass pane (depthWrite: false so sun, clouds & teal sea are crystal clear)
  const glassShape = new THREE.Shape();
  glassShape.absarc(straightHalf, cy, openR, -Math.PI / 2, Math.PI / 2, false);
  glassShape.absarc(-straightHalf, cy, openR, Math.PI / 2, Math.PI * 1.5, false);
  glassShape.closePath();

  const glassMat = new THREE.MeshPhysicalNodeMaterial({
    color: new THREE.Color(0x88d8ff),
    transparent: true,
    opacity: 0.045,
    roughness: 0.06,
    metalness: 0.05,
    clearcoat: 1.0,
    depthWrite: false,
  });
  const glassPane = new THREE.Mesh(new THREE.ShapeGeometry(glassShape, 32), glassMat);
  glassPane.position.z = 0.05;
  glassPane.renderOrder = 3;
  group.add(glassPane);

  return group;
}

/**
 * Builds NEURAL CORE — CYPHR: indigo female hologram of light standing at the Bridge Console
 * using Neon Vigil's Delta Hologram treatment (indigo light body, continuous 92-line scanlines,
 * 12 Hz flicker, crisp inverted-hull ink outlines — NO sparkles, NO stars).
 * Smooth blank face at rest; luminous horizontal audio waveform at the mouth ONLY while speaking.
 */
function buildCyphrHologram(): {
  group: THREE.Group;
  speakingUniform: THREE.UniformNode<'float', number>;
} {
  const group = new THREE.Group();
  group.name = 'NEURAL_CORE_CYPHR';

  const speakingUniform = uniform(0.0);

  // Delta Hologram house material: indigo light body + 92-line continuous scanlines + 12 Hz flicker + MRT emissive
  const holoMat = createDeltaHologramMaterial({
    baseWorldY: BRIDGE.deckY + BRIDGE.daisHeight,
    heightMeters: 1.74,
    speakingUniform,
    intensity: 1.42,
  });

  // Inverted-hull TSL toon-ink outline materials framing every holographic body volume cleanly
  const bodyInkMat = createDeltaInkOutlineMaterial(0.013);
  const fineInkMat = createDeltaInkOutlineMaterial(0.0085);

  // Holographic floor emitter ring on dais (matching Delta indigo + 92-line scan + 12 Hz flicker)
  const emitterRing = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.44, 32),
    createDeltaHoloFieldMaterial(0x5248e5, 0.74)
  );
  emitterRing.rotation.x = -Math.PI / 2;
  emitterRing.position.y = 0.02;
  group.add(emitterRing);

  // Sculpted graceful female holographic silhouette (1.72 m tall) paired with crisp Delta ink outlines
  addDeltaHologramPart(
    group,
    new THREE.CylinderGeometry(0.22, 0.34, 0.84, 24, 1, true),
    holoMat,
    bodyInkMat,
    (m) => {
      m.name = 'CYPHR_COLUMN';
      m.position.y = 0.44;
    }
  );

  addDeltaHologramPart(
    group,
    new THREE.CylinderGeometry(0.19, 0.14, 0.48, 20),
    holoMat,
    bodyInkMat,
    (m) => {
      m.name = 'CYPHR_TORSO';
      m.scale.set(1.15, 1, 0.74);
      m.position.y = 1.08;
    }
  );

  addDeltaHologramPart(
    group,
    new THREE.SphereGeometry(0.22, 20, 14),
    holoMat,
    bodyInkMat,
    (m) => {
      m.name = 'CYPHR_SHOULDERS';
      m.scale.set(1.22, 0.46, 0.65);
      m.position.y = 1.32;
    }
  );

  addDeltaHologramPart(
    group,
    new THREE.CylinderGeometry(0.055, 0.065, 0.14, 14),
    holoMat,
    fineInkMat,
    (m) => {
      m.name = 'CYPHR_NECK';
      m.position.y = 1.44;
    }
  );

  // Smooth blank oval face at rest (no eyes, nose, or mouth features)
  addDeltaHologramPart(
    group,
    new THREE.SphereGeometry(0.125, 24, 20),
    holoMat,
    fineInkMat,
    (m) => {
      m.name = 'CYPHR_HEAD';
      m.scale.set(0.86, 1.16, 0.94);
      m.position.y = 1.62;
    }
  );

  // Swept holographic hair silhouette framing the smooth blank face
  addDeltaHologramPart(
    group,
    new THREE.SphereGeometry(0.145, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.62),
    holoMat,
    fineInkMat,
    (m) => {
      m.name = 'CYPHR_HAIR';
      m.scale.set(0.95, 1.1, 1.05);
      m.position.set(0, 1.64, -0.025);
    }
  );

  // Translucent arms resting calmly at sides
  for (const s of [-1, 1]) {
    addDeltaHologramPart(
      group,
      new THREE.CapsuleGeometry(0.045, 0.46, 8, 12),
      holoMat,
      fineInkMat,
      (m) => {
        m.name = s < 0 ? 'CYPHR_ARM_L' : 'CYPHR_ARM_R';
        m.position.set(s * 0.27, 1.06, 0.02);
        m.rotation.z = s * 0.12;
      }
    );
  }

  // Luminous audio waveform at the mouth ONLY while speaking! (Opacity = 0 at rest)
  const waveMat = createDeltaMouthWaveformMaterial(speakingUniform);
  const mouthWave = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.055), waveMat);
  mouthWave.name = 'CYPHR_MOUTH_WAVEFORM';
  mouthWave.position.set(0, 1.565, 0.124); // Front of smooth blank face
  mouthWave.renderOrder = 3;
  group.add(mouthWave);

  return { group, speakingUniform };
}

/**
 * Builds the single black high-back command chair fixed at dais center facing the -Z viewport.
 */
function buildBlackCommandChair(
  obsidianMat: THREE.Material,
  matteLeatherMat: THREE.Material,
  cyanTrimMat: THREE.Material
): THREE.Group {
  const chair = new THREE.Group();
  chair.name = 'COMMAND_CHAIR';

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.82, 0.14, 24), obsidianMat);
  base.position.y = 0.07;
  chair.add(base);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.02, 8, 32), cyanTrimMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.12;
  chair.add(ring);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.42, 16), obsidianMat);
  stem.position.y = 0.34;
  chair.add(stem);

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.15, 0.82), matteLeatherMat);
  seat.position.set(0, 0.62, 0.02);
  chair.add(seat);

  // Iconic angular high-back silhouette matching References 3 & 4
  const backShape = new THREE.Shape();
  backShape.moveTo(-0.44, 0);
  backShape.lineTo(0.44, 0);
  backShape.lineTo(0.55, 0.65);
  backShape.lineTo(0.4, 1.24);
  backShape.lineTo(0.24, 1.54);
  backShape.lineTo(-0.24, 1.54);
  backShape.lineTo(-0.4, 1.24);
  backShape.lineTo(-0.55, 0.65);
  backShape.closePath();

  const backGeo = new THREE.ExtrudeGeometry(backShape, {
    depth: 0.15,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  backGeo.translate(0, 0, -0.075);

  const backShell = new THREE.Mesh(backGeo, obsidianMat);
  backShell.position.set(0, 0.58, 0.42);
  backShell.rotation.x = 0.11;
  chair.add(backShell);

  for (let i = 0; i < 3; i++) {
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(0.68 - i * 0.08, 0.28, 0.08),
      matteLeatherMat
    );
    pad.position.set(0, 0.9 + i * 0.34, 0.35 + i * 0.036);
    pad.rotation.x = 0.11;
    chair.add(pad);
  }

  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.82), obsidianMat);
    arm.position.set(s * 0.5, 0.96, 0.0);
    chair.add(arm);
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.38, 0.28), obsidianMat);
    pillar.position.set(s * 0.49, 0.74, 0.15);
    chair.add(pillar);
  }

  return chair;
}

/**
 * Builds the entire Bridge (Deck 1 Upper, 30m × 24m × 8m), Cyphr Bay with hexagonal garden window,
 * Airlock chamber (fog ONLY inside the airlock), and descending Ramp meeting the Sutro Baths shore apron.
 */
export function createBridgeAndAirlock(textures: WorldTextureSet): BridgeAndAirlockRig {
  // === CANON HULL & DOME ONE CONTINUOUS GRADED STEEL MATERIAL ===
  const unifiedGunmetalMat = new THREE.MeshStandardNodeMaterial({
    map: textures.gunmetalAlbedo,
    roughnessMap: textures.gunmetalRoughness,
    bumpMap: textures.gunmetalBump,
    bumpScale: 0.05,
    color: new THREE.Color(0x8894a8),
    metalness: 0.72,
    roughness: 0.34,
  });

  const obsidianBlackMat = new THREE.MeshStandardNodeMaterial({
    color: new THREE.Color(0x0b0d14),
    metalness: 0.45,
    roughness: 0.56,
  });

  const matteSeatMat = new THREE.MeshStandardNodeMaterial({
    color: new THREE.Color(0x0e1018),
    metalness: 0.08,
    roughness: 0.86,
  });

  const cyanTrimMat = new THREE.MeshStandardNodeMaterial({
    color: new THREE.Color(0x67f5ff),
    emissive: new THREE.Color(0x00e5ff),
    emissiveIntensity: 2.3,
    roughness: 0.2,
    metalness: 0.1,
  });

  const violetFilamentMat = new THREE.MeshStandardNodeMaterial({
    color: new THREE.Color(0xd8b4fe),
    emissive: new THREE.Color(0xa855f7),
    emissiveIntensity: 2.5,
    roughness: 0.2,
    metalness: 0.1,
  });

  const magentaGlowMat = new THREE.MeshStandardNodeMaterial({
    color: new THREE.Color(0xf5a8ff),
    emissive: new THREE.Color(0xd946ef),
    emissiveIntensity: 2.1,
    roughness: 0.22,
    metalness: 0.1,
  });

  const orangePinMat = new THREE.MeshStandardNodeMaterial({
    color: new THREE.Color(0xfdba74),
    emissive: new THREE.Color(0xf97316),
    emissiveIntensity: 2.8,
    roughness: 0.2,
  });

  // Thin quartz bleed glow tracing the overhead skylight dome ring
  const quartzBleedMat = new THREE.MeshStandardNodeMaterial({
    color: new THREE.Color(0xf4f0ff),
    emissive: new THREE.Color(0xdcd4ff),
    emissiveIntensity: 2.1,
    roughness: 0.15,
  });

  const screenMats = textures.consoleScreens.map(
    (tex) =>
      new THREE.MeshStandardNodeMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: new THREE.Color(0x52f2ff),
        emissiveIntensity: 1.55,
        roughness: 0.16,
        metalness: 0.12,
      })
  );

  // =========================================================================
  // 1. BRIDGE INTERIOR (30m × 24m × 8m, Deck 1 Upper at y = 9.0)
  // =========================================================================
  const bridgeGroup = new THREE.Group();
  bridgeGroup.name = 'HULL_AND_DOME';
  bridgeGroup.position.set(0, BRIDGE.deckY, 0);

  // Floor with inlaid cyan & violet circuit traces
  const floorMat = new THREE.MeshStandardNodeMaterial({
    map: textures.bridgeFloorAlbedo,
    emissiveMap: textures.bridgeFloorEmissive,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 1.35,
    roughnessMap: textures.bridgeFloorRoughness,
    metalness: 0.62,
    roughness: 0.34,
  });
  const floorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(BRIDGE.width, 0.3, BRIDGE.depth),
    floorMat
  );
  floorMesh.position.set(0, -0.15, (BRIDGE.zFront + BRIDGE.zBack) * 0.5);
  floorMesh.receiveShadow = true;
  bridgeGroup.add(floorMesh);

  // Great 24m × 7m Oval Panoramic Viewport at Forward Prow (z = -14)
  const ovalViewport = buildOvalViewportWall(
    unifiedGunmetalMat,
    obsidianBlackMat,
    violetFilamentMat,
    cyanTrimMat
  );
  ovalViewport.position.set(0, 0, BRIDGE.zFront);
  bridgeGroup.add(ovalViewport);

  // Overhead Ceiling Deck with Circular Light-Reflective Glass Skylight Dome & Thin Quartz Bleed Glow
  const ceilShape = new THREE.Shape();
  ceilShape.moveTo(-BRIDGE.width * 0.5, BRIDGE.zFront);
  ceilShape.lineTo(BRIDGE.width * 0.5, BRIDGE.zFront);
  ceilShape.lineTo(BRIDGE.width * 0.5, BRIDGE.zBack);
  ceilShape.lineTo(-BRIDGE.width * 0.5, BRIDGE.zBack);
  ceilShape.closePath();

  const domeRadius = 6.2;
  const domeHole = new THREE.Path();
  domeHole.absarc(0, BRIDGE.daisCenterZ, domeRadius, 0, Math.PI * 2, true);
  ceilShape.holes.push(domeHole);

  const ceilingDeckGeo = new THREE.ExtrudeGeometry(ceilShape, { depth: 0.45, bevelEnabled: false });
  ceilingDeckGeo.rotateX(Math.PI / 2);
  const ceilingDeck = new THREE.Mesh(ceilingDeckGeo, unifiedGunmetalMat);
  ceilingDeck.position.y = BRIDGE.height + 0.45;
  bridgeGroup.add(ceilingDeck);

  // Continuous graded steel dome ring + thin quartz bleed glow tracing the ring
  const domeRing = new THREE.Mesh(
    new THREE.TorusGeometry(domeRadius, 0.36, 12, 64),
    unifiedGunmetalMat
  );
  domeRing.rotation.x = Math.PI / 2;
  domeRing.position.set(0, BRIDGE.height, BRIDGE.daisCenterZ);
  bridgeGroup.add(domeRing);

  const quartzBleedRing = new THREE.Mesh(
    new THREE.TorusGeometry(domeRadius - 0.32, 0.045, 8, 64),
    quartzBleedMat
  );
  quartzBleedRing.rotation.x = Math.PI / 2;
  quartzBleedRing.position.set(0, BRIDGE.height - 0.05, BRIDGE.daisCenterZ);
  bridgeGroup.add(quartzBleedRing);

  // Light-reflective glass skylight dome overhead
  const skylightGlassMat = new THREE.MeshPhysicalNodeMaterial({
    color: new THREE.Color(0xc8dcff),
    transparent: true,
    opacity: 0.16,
    roughness: 0.05,
    metalness: 0.15,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const skylightDomeGeo = new THREE.SphereGeometry(domeRadius + 0.1, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  skylightDomeGeo.scale(1, 0.36, 1);
  const skylightDome = new THREE.Mesh(skylightDomeGeo, skylightGlassMat);
  skylightDome.position.set(0, BRIDGE.height, BRIDGE.daisCenterZ);
  bridgeGroup.add(skylightDome);

  // Overhead magenta & cyan ceiling accent rails matching Reference 3
  for (const side of [-1, 1]) {
    const magRail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 14.5), magentaGlowMat);
    magRail.position.set(side * 9.8, BRIDGE.height - 0.14, -1.0);
    bridgeGroup.add(magRail);

    const cyanRail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 11.0), cyanTrimMat);
    cyanRail.position.set(side * 7.6, BRIDGE.height - 0.1, -1.8);
    bridgeGroup.add(cyanRail);
  }

  // Side Walls (Port -X solid curved/faceted wall, Starboard +X wall with open archway into adjoining Cyphr Bay)
  const portWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, BRIDGE.height, BRIDGE.depth),
    unifiedGunmetalMat
  );
  portWall.position.set(-BRIDGE.width * 0.5 - 0.3, BRIDGE.height * 0.5, (BRIDGE.zFront + BRIDGE.zBack) * 0.5);
  bridgeGroup.add(portWall);

  // Starboard wall split to leave a 5.2m wide archway at z = 1.5..6.7 into the adjoining Cyphr Bay!
  const stbdFrontWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, BRIDGE.height, 15.5),
    unifiedGunmetalMat
  );
  stbdFrontWall.position.set(BRIDGE.width * 0.5 + 0.3, BRIDGE.height * 0.5, -6.25);
  bridgeGroup.add(stbdFrontWall);

  const stbdBackWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, BRIDGE.height, 3.3),
    unifiedGunmetalMat
  );
  stbdBackWall.position.set(BRIDGE.width * 0.5 + 0.3, BRIDGE.height * 0.5, 8.35);
  bridgeGroup.add(stbdBackWall);

  const stbdArchHeader = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 3.2, 5.4),
    unifiedGunmetalMat
  );
  stbdArchHeader.position.set(BRIDGE.width * 0.5 + 0.3, 6.4, 4.1);
  bridgeGroup.add(stbdArchHeader);

  // Cyan archway frame leading into adjoining Cyphr Bay
  const archTopGlow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 5.2), cyanTrimMat);
  archTopGlow.position.set(BRIDGE.width * 0.5 - 0.05, 4.78, 4.1);
  bridgeGroup.add(archTopGlow);

  // Back Bulkhead Wall (z = +10) with Paneled Door & Cyan-Lit Octagonal Frame (Reference 3)
  const backWallLeft = new THREE.Mesh(new THREE.BoxGeometry(12.2, BRIDGE.height, 0.7), unifiedGunmetalMat);
  backWallLeft.position.set(-8.9, BRIDGE.height * 0.5, BRIDGE.zBack + 0.35);
  bridgeGroup.add(backWallLeft);

  const backWallRight = new THREE.Mesh(new THREE.BoxGeometry(12.2, BRIDGE.height, 0.7), unifiedGunmetalMat);
  backWallRight.position.set(8.9, BRIDGE.height * 0.5, BRIDGE.zBack + 0.35);
  bridgeGroup.add(backWallRight);

  const backWallTop = new THREE.Mesh(new THREE.BoxGeometry(6.0, 3.5, 0.7), unifiedGunmetalMat);
  backWallTop.position.set(0, 6.25, BRIDGE.zBack + 0.35);
  bridgeGroup.add(backWallTop);

  // Octagonal cyan-lit back door frame
  const doorFramePts = [
    new THREE.Vector3(-2.65, 0.05, BRIDGE.zBack - 0.02),
    new THREE.Vector3(-2.65, 3.65, BRIDGE.zBack - 0.02),
    new THREE.Vector3(-1.85, 4.45, BRIDGE.zBack - 0.02),
    new THREE.Vector3(1.85, 4.45, BRIDGE.zBack - 0.02),
    new THREE.Vector3(2.65, 3.65, BRIDGE.zBack - 0.02),
    new THREE.Vector3(2.65, 0.05, BRIDGE.zBack - 0.02),
  ];
  const doorFrameCurve = new THREE.CatmullRomCurve3(doorFramePts, false);
  const doorCyanFrame = new THREE.Mesh(
    new THREE.TubeGeometry(doorFrameCurve, 40, 0.09, 8, false),
    cyanTrimMat
  );
  bridgeGroup.add(doorCyanFrame);

  // Paneled sliding back blast door (opens smoothly when player approaches)
  const backDoorLeft = new THREE.Mesh(new THREE.BoxGeometry(2.55, 4.4, 0.28), unifiedGunmetalMat);
  backDoorLeft.position.set(-1.28, 2.2, BRIDGE.zBack + 0.25);
  bridgeGroup.add(backDoorLeft);

  const backDoorRight = new THREE.Mesh(new THREE.BoxGeometry(2.55, 4.4, 0.28), unifiedGunmetalMat);
  backDoorRight.position.set(1.28, 2.2, BRIDGE.zBack + 0.25);
  bridgeGroup.add(backDoorRight);

  // =========================================================================
  // 2. CIRCULAR COMMAND DAIS (8m diameter, 3 steps) + CHAIR + 6m CONSOLE ARCS
  // =========================================================================
  const consoleGroup = new THREE.Group();
  consoleGroup.name = 'BRIDGE_CONSOLE';
  bridgeGroup.add(consoleGroup);

  const daisGroup = new THREE.Group();
  daisGroup.position.set(0, 0, BRIDGE.daisCenterZ);
  consoleGroup.add(daisGroup);

  // Three stepped circular risers (outer 8m diameter -> 4.0m radius)
  const stepRadii = [4.0, 3.55, 3.12];
  stepRadii.forEach((r, idx) => {
    const step = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r + 0.08, 0.18, 48),
      unifiedGunmetalMat
    );
    step.position.y = 0.09 + idx * 0.18;
    step.receiveShadow = true;
    daisGroup.add(step);

    // Subtle cyan step ring on top rim
    const stepTrim = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.024, 8, 48),
      idx === 2 ? cyanTrimMat : violetFilamentMat
    );
    stepTrim.rotation.x = Math.PI / 2;
    stepTrim.position.y = 0.18 + idx * 0.18;
    daisGroup.add(stepTrim);
  });

  // Small orange status pinpoints inset around the dais riser (matching Reference 3!)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.05), orangePinMat);
    pin.position.set(Math.sin(a) * 4.04, 0.12, -Math.cos(a) * 4.04);
    pin.rotation.y = -a;
    daisGroup.add(pin);
  }

  // Single Black Command Chair fixed at dais center facing -Z viewport
  const commandChair = buildBlackCommandChair(obsidianBlackMat, matteSeatMat, cyanTrimMat);
  commandChair.position.set(0, BRIDGE.daisHeight, 0);
  daisGroup.add(commandChair);

  // Curved Console Arcs (6m across -> radius 3.0m) encircling the dais (leaving clean walkways)
  const buildConsoleArcSegment = (
    startDeg: number,
    endDeg: number,
    radius: number,
    screenIdx: number
  ) => {
    const segGroup = new THREE.Group();
    const steps = 6;
    const totalRad = THREE.MathUtils.degToRad(endDeg - startDeg);
    const segArc = totalRad / steps;
    const segLen = radius * Math.abs(segArc) + 0.08;

    for (let i = 0; i < steps; i++) {
      const a = THREE.MathUtils.degToRad(startDeg) + (i + 0.5) * segArc;
      const cell = new THREE.Group();
      cell.position.set(Math.sin(a) * radius, BRIDGE.daisHeight, -Math.cos(a) * radius);
      cell.rotation.y = -a;

      // Continuous graded steel pedestal & sloped top
      const ped = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.82, 0.55), unifiedGunmetalMat);
      ped.position.set(0, 0.41, 0);
      cell.add(ped);

      const deck = new THREE.Mesh(new THREE.BoxGeometry(segLen + 0.04, 0.12, 0.86), unifiedGunmetalMat);
      deck.position.set(0, 0.84, 0.06);
      deck.rotation.x = 0.26;
      cell.add(deck);

      // Abstract glowing ring/wave console screen (ZERO text!)
      const scr = new THREE.Mesh(
        new THREE.PlaneGeometry(segLen * 0.84, 0.56),
        screenMats[(screenIdx + i) % screenMats.length]
      );
      scr.position.set(0, 0.915, 0.06);
      scr.rotation.x = -Math.PI / 2 + 0.26;
      cell.add(scr);

      // Tiny orange status pinpoint on console side cheek
      if (i === 0 || i === steps - 1) {
        const pin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.04), orangePinMat);
        pin.position.set(0, 0.56, 0.3);
        cell.add(pin);
      }

      segGroup.add(cell);
    }
    return segGroup;
  };

  // Forward curved console arc (6m across, facing -Z beneath the viewport) + two flanking arcs
  daisGroup.add(buildConsoleArcSegment(-54, 54, BRIDGE.consoleRadius, 0));
  daisGroup.add(buildConsoleArcSegment(-132, -74, BRIDGE.consoleRadius, 2));
  daisGroup.add(buildConsoleArcSegment(74, 132, BRIDGE.consoleRadius, 3));

  // === NEURAL CORE — CYPHR Hologram standing at the Bridge Console ===
  const cyphrRig = buildCyphrHologram();
  cyphrRig.group.position.set(2.05, BRIDGE.daisHeight, -2.05); // Right at the forward Bridge Console!
  cyphrRig.group.rotation.y = -0.58; // Angled gracefully toward the command chair & player
  daisGroup.add(cyphrRig.group);

  // =========================================================================
  // 3. WALL CONSOLE STATIONS RINGING THE ROOM + COMMS STATION (Refs 3 & 4)
  // =========================================================================
  const commsGroup = new THREE.Group();
  commsGroup.name = 'COMMS';
  bridgeGroup.add(commsGroup);

  const buildWallStation = (x: number, z: number, rotY: number, screenIdx: number, addUpper = true) => {
    const st = new THREE.Group();
    st.position.set(x, 0, z);
    st.rotation.y = rotY;

    const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.96, 1.05), unifiedGunmetalMat);
    base.position.y = 0.48;
    st.add(base);

    const slope = new THREE.Mesh(new THREE.BoxGeometry(2.68, 0.14, 1.1), unifiedGunmetalMat);
    slope.position.set(0, 1.0, 0.08);
    slope.rotation.x = 0.3;
    st.add(slope);

    const lowScr = new THREE.Mesh(
      new THREE.PlaneGeometry(2.24, 0.68),
      screenMats[screenIdx % screenMats.length]
    );
    lowScr.position.set(0, 1.09, 0.09);
    lowScr.rotation.x = -Math.PI / 2 + 0.3;
    st.add(lowScr);

    const trim = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.035, 0.04), cyanTrimMat);
    trim.position.set(0, 0.86, 0.6);
    st.add(trim);

    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.045, 0.04), orangePinMat);
    pin.position.set(-1.05, 0.36, 0.54);
    st.add(pin);

    if (addUpper) {
      const upperFrame = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.45, 0.2), unifiedGunmetalMat);
      upperFrame.position.set(0, 2.35, -0.45);
      st.add(upperFrame);

      const upperScr = new THREE.Mesh(
        new THREE.PlaneGeometry(2.05, 1.12),
        screenMats[(screenIdx + 1) % screenMats.length]
      );
      upperScr.position.set(0, 2.35, -0.34);
      st.add(upperScr);
    }

    return st;
  };

  // Low continuous sill consoles beneath the 24m oval viewport (keep below y=1.05 so viewport is 100% open!)
  for (let i = -3; i <= 3; i++) {
    const x = i * 3.1;
    const zCurve = BRIDGE.zFront + 1.35 + Math.abs(i) * 0.22;
    consoleGroup.add(buildWallStation(x, zCurve, -i * 0.07, Math.abs(i), false));
  }

  // Port (-X) perimeter wall console stations
  const portZs = [-9.5, -5.8, -2.1, 1.6, 5.4];
  portZs.forEach((wz, i) => {
    const st = buildWallStation(-13.4, wz, Math.PI / 2, i, true);
    (i === 2 ? commsGroup : consoleGroup).add(st);
  });

  // Starboard (+X) perimeter wall console stations (stopping cleanly before the Cyphr Bay archway at z=1.5..6.7)
  const stbdZs = [-9.5, -5.8, -2.1];
  stbdZs.forEach((wz, i) => {
    consoleGroup.add(buildWallStation(13.4, wz, -Math.PI / 2, i + 2, true));
  });

  // =========================================================================
  // 4. ADJOINING CYPHR BAY WITH HEXAGONAL WINDOW ONTO THE GARDEN (+X side)
  // =========================================================================
  const cyphrBay = new THREE.Group();
  cyphrBay.name = 'CYPHR_BAY';
  cyphrBay.position.set(BRIDGE.width * 0.5, 0, 4.1); // x = +15..+22.5, z = 0.8..7.4
  bridgeGroup.add(cyphrBay);

  const bayW = 7.4;
  const bayD = 6.6;
  const bayH = 5.0;

  // Floor & ceiling of Cyphr bay
  const bayFloor = new THREE.Mesh(new THREE.BoxGeometry(bayW, 0.28, bayD), unifiedGunmetalMat);
  bayFloor.position.set(bayW * 0.5, -0.14, 0);
  cyphrBay.add(bayFloor);

  const bayCeil = new THREE.Mesh(new THREE.BoxGeometry(bayW, 0.3, bayD), unifiedGunmetalMat);
  bayCeil.position.set(bayW * 0.5, bayH + 0.15, 0);
  cyphrBay.add(bayCeil);

  // North (-Z local) and East (+X local) enclosed walls of Cyphr Bay
  const bayNorthWall = new THREE.Mesh(new THREE.BoxGeometry(bayW, bayH, 0.45), unifiedGunmetalMat);
  bayNorthWall.position.set(bayW * 0.5, bayH * 0.5, -bayD * 0.5);
  cyphrBay.add(bayNorthWall);

  const bayEastWall = new THREE.Mesh(new THREE.BoxGeometry(0.45, bayH, bayD), unifiedGunmetalMat);
  bayEastWall.position.set(bayW, bayH * 0.5, 0);
  cyphrBay.add(bayEastWall);

  // South (+Z local, facing the Sutro Baths shore & dark Gigas Garden tree line!) wall with HEXAGONAL WINDOW!
  const hexWallShape = new THREE.Shape();
  hexWallShape.moveTo(0, 0);
  hexWallShape.lineTo(bayW, 0);
  hexWallShape.lineTo(bayW, bayH);
  hexWallShape.lineTo(0, bayH);
  hexWallShape.closePath();

  const hexCx = bayW * 0.52;
  const hexCy = 2.55;
  const hexR = 1.85;
  const hexHole = new THREE.Path();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const hx = hexCx + Math.cos(a) * hexR;
    const hy = hexCy + Math.sin(a) * hexR;
    if (i === 0) hexHole.moveTo(hx, hy);
    else hexHole.lineTo(hx, hy);
  }
  hexHole.closePath();
  hexWallShape.holes.push(hexHole);

  const hexWallGeo = new THREE.ExtrudeGeometry(hexWallShape, { depth: 0.48, bevelEnabled: false });
  const hexWall = new THREE.Mesh(hexWallGeo, unifiedGunmetalMat);
  hexWall.position.set(0, 0, bayD * 0.5 - 0.24);
  cyphrBay.add(hexWall);

  // Glowing cyan/violet hexagonal window frame onto the garden
  const hexFramePts: THREE.Vector3[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    hexFramePts.push(new THREE.Vector3(hexCx + Math.cos(a) * hexR, hexCy + Math.sin(a) * hexR, bayD * 0.5 - 0.28));
  }
  const hexTube = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hexFramePts, true), 36, 0.06, 8, true),
    violetFilamentMat
  );
  cyphrBay.add(hexTube);

  // Neural Core conduit pillar inside Cyphr Bay + Delta Hologram sheath (92-line scan, 12 Hz flicker, ink outline)
  const coreColumn = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 4.6, 6), obsidianBlackMat);
  coreColumn.position.set(5.4, 2.3, -1.5);
  cyphrBay.add(coreColumn);

  const bayCoreHoloMat = createDeltaHologramMaterial({
    baseWorldY: BRIDGE.deckY + 0.3,
    heightMeters: 3.8,
    intensity: 1.15,
  });
  const bayCoreInkMat = createDeltaInkOutlineMaterial(0.016);
  addDeltaHologramPart(
    cyphrBay,
    new THREE.CylinderGeometry(0.62, 0.68, 3.6, 6, 1, true),
    bayCoreHoloMat,
    bayCoreInkMat,
    (m) => {
      m.name = 'NEURAL_CORE_HOLO_SHEATH';
      m.position.set(5.4, 2.3, -1.5);
    }
  );

  const coreGlowRing = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.04, 8, 6), cyanTrimMat);
  coreGlowRing.rotation.x = Math.PI / 2;
  coreGlowRing.position.set(5.4, 2.3, -1.5);
  cyphrBay.add(coreGlowRing);

  const bayLight = new THREE.PointLight(0x818cf8, 12, 12, 1.5);
  bayLight.position.set(3.8, 3.6, 0);
  cyphrBay.add(bayLight);

  // =========================================================================
  // 5. BRIDGE CLEAR-AIR LIGHTING (Zero fog inside bridge, ever!)
  // =========================================================================
  const cyanLights: Array<[number, number, number]> = [
    [-6.5, 2.8, -5.5],
    [6.5, 2.8, -5.5],
    [-8.5, 2.8, 3.5],
    [8.5, 2.8, 3.5],
  ];
  for (const [lx, ly, lz] of cyanLights) {
    const pl = new THREE.PointLight(0x16e0ff, 18, 19, 1.5);
    pl.position.set(lx, ly, lz);
    bridgeGroup.add(pl);
  }

  // Violet/magenta overhead accent lights matching References 3 & 4
  const violetTop = new THREE.PointLight(0xb45eff, 16, 22, 1.4);
  violetTop.position.set(0, 6.8, -7.5);
  bridgeGroup.add(violetTop);

  const quartzSkylight = new THREE.PointLight(0xdce4ff, 14, 24, 1.5);
  quartzSkylight.position.set(0, 7.2, BRIDGE.daisCenterZ);
  bridgeGroup.add(quartzSkylight);

  // =========================================================================
  // 6. AIRLOCK & RAMP (Fog exists ONLY inside the airlock chamber!)
  //    Plus STASIS below-deck glowing viewing grate under airlock deck
  // =========================================================================
  const airlockGroup = new THREE.Group();
  airlockGroup.name = 'AIRLOCK_AND_RAMP';
  airlockGroup.position.set(0, AIRLOCK.deckY, 0);

  const alLen = AIRLOCK.zEnd - AIRLOCK.zStart;
  const alMidZ = (AIRLOCK.zStart + AIRLOCK.zEnd) * 0.5;
  const alW = AIRLOCK.halfWidth * 2;

  // Airlock floor, ceiling & side bulkheads
  const alFloor = new THREE.Mesh(new THREE.BoxGeometry(alW, 0.3, alLen), unifiedGunmetalMat);
  alFloor.position.set(0, -0.15, alMidZ);
  airlockGroup.add(alFloor);

  const alCeil = new THREE.Mesh(new THREE.BoxGeometry(alW, 0.35, alLen), unifiedGunmetalMat);
  alCeil.position.set(0, AIRLOCK.height + 0.17, alMidZ);
  airlockGroup.add(alCeil);

  for (const s of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.45, AIRLOCK.height, alLen), unifiedGunmetalMat);
    wall.position.set(s * (AIRLOCK.halfWidth + 0.22), AIRLOCK.height * 0.5, alMidZ);
    airlockGroup.add(wall);

    const ribLight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, alLen - 0.8), cyanTrimMat);
    ribLight.position.set(s * (AIRLOCK.halfWidth - 0.04), AIRLOCK.height - 0.35, alMidZ);
    airlockGroup.add(ribLight);
  }

  // STASIS (pods below deck — Delta Hologram illuminated deck grate hinting at stasis pods below)
  const stasisGroup = new THREE.Group();
  stasisGroup.name = 'STASIS';
  const stasisGrate = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 4.2),
    createDeltaHoloFieldMaterial(0x3b68e8, 0.28)
  );
  stasisGrate.rotation.x = -Math.PI / 2;
  stasisGrate.position.set(0, 0.02, alMidZ);
  stasisGroup.add(stasisGrate);
  airlockGroup.add(stasisGroup);

  // Outer airlock sliding doors at z = AIRLOCK.zEnd (leading onto the open ramp!)
  const airlockOuterDoorLeft = new THREE.Mesh(new THREE.BoxGeometry(2.4, 4.2, 0.28), unifiedGunmetalMat);
  airlockOuterDoorLeft.position.set(-1.2, 2.1, AIRLOCK.zEnd);
  airlockGroup.add(airlockOuterDoorLeft);

  const airlockOuterDoorRight = new THREE.Mesh(new THREE.BoxGeometry(2.4, 4.2, 0.28), unifiedGunmetalMat);
  airlockOuterDoorRight.position.set(1.2, 2.1, AIRLOCK.zEnd);
  airlockGroup.add(airlockOuterDoorRight);

  // === LOCALIZED VOLUMETRIC-STYLE FOG ONLY INSIDE THE AIRLOCK CHAMBER ===
  const airlockFogMat = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  airlockFogMat.colorNode = mix(color(0x6ad8f5), color(0xc084fc), float(0.45));
  airlockFogMat.opacityNode = Fn(() => {
    const p = uv();
    const edgeFade =
      smoothstep(0.0, 0.25, p.x)
        .mul(smoothstep(1.0, 0.75, p.x))
        .mul(smoothstep(0.0, 0.22, p.y))
        .mul(smoothstep(1.0, 0.65, p.y));
    const swirl =
      sin(p.x.mul(5.2).add(time.mul(0.85)))
        .mul(cos(p.y.mul(4.1).sub(time.mul(0.55))))
        .mul(0.5)
        .add(0.5);
    return edgeFade.mul(swirl.mul(0.18).add(0.12));
  })();

  const fogSliceCount = 7;
  for (let i = 0; i < fogSliceCount; i++) {
    const fz = THREE.MathUtils.lerp(AIRLOCK.zStart + 0.9, AIRLOCK.zEnd - 0.9, i / (fogSliceCount - 1));
    const fogSlice = new THREE.Mesh(
      new THREE.PlaneGeometry(alW - 0.5, AIRLOCK.height - 0.6),
      airlockFogMat
    );
    fogSlice.name = `AIRLOCK_FOG_LAYER_${i}`;
    fogSlice.position.set(0, AIRLOCK.height * 0.45, fz);
    fogSlice.renderOrder = 4;
    airlockGroup.add(fogSlice);
  }

  const airlockLight = new THREE.PointLight(0x38bdf8, 12, 12, 1.4);
  airlockLight.position.set(0, 3.8, alMidZ);
  airlockGroup.add(airlockLight);

  // =========================================================================
  // 7. WALKABLE EXTERIOR RAMP (connects Airlock exit z=18.5 down to Sutro shore apron z=41.5)
  // =========================================================================
  const rampGroup = new THREE.Group();
  rampGroup.name = 'INFINITY_6_SHORE_RAMP';

  const rampDz = RAMP.zEnd - RAMP.zStart;
  const rampDy = RAMP.yTop - RAMP.yBottom;
  const rampLen = Math.hypot(rampDz, rampDy);
  const rampPitch = Math.atan2(rampDy, rampDz); // downward tilt toward +Z
  const rampMidZ = (RAMP.zStart + RAMP.zEnd) * 0.5;
  const rampMidY = (RAMP.yTop + RAMP.yBottom) * 0.5;

  const rampDeck = new THREE.Mesh(
    new THREE.BoxGeometry(RAMP.halfWidth * 2, 0.36, rampLen),
    unifiedGunmetalMat
  );
  rampDeck.position.set(0, rampMidY - 0.18, rampMidZ);
  rampDeck.rotation.x = rampPitch;
  rampDeck.receiveShadow = true;
  rampDeck.castShadow = true;
  rampGroup.add(rampDeck);

  // Side curb rails + subtle cyan/magenta guidance strips along the ramp (matching Zone 1 Hub plate!)
  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.65, rampLen),
      obsidianBlackMat
    );
    rail.position.set(s * (RAMP.halfWidth - 0.14), rampMidY + 0.18, rampMidZ);
    rail.rotation.x = rampPitch;
    rampGroup.add(rail);

    const lightStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, rampLen - 0.6),
      s < 0 ? cyanTrimMat : magentaGlowMat
    );
    lightStrip.position.set(s * (RAMP.halfWidth - 0.28), rampMidY + 0.44, rampMidZ);
    lightStrip.rotation.x = rampPitch;
    rampGroup.add(lightStrip);
  }

  // Glowing magenta-violet ramp bay portal light at the top of the ramp (echoing Hub / Zone 1 plate)
  const rampBayGlow = new THREE.PointLight(0xd946ef, 22, 22, 1.5);
  rampBayGlow.position.set(0, RAMP.yTop + 1.8, RAMP.zStart + 1.5);
  rampGroup.add(rampBayGlow);

  // Smooth animated door openness & Cyphr voice waveform update
  let backDoorOpen = 0;
  let outerDoorOpen = 0;
  let speechLevel = 0;

  const update = (dt: number, elapsed: number, playerPos: THREE.Vector3, cyphrSpeaking: boolean) => {
    // Auto-open back door when player approaches z ~ 6.5..14.0
    const nearBack = Math.abs(playerPos.x) < 4.5 && playerPos.z > 5.8 && playerPos.z < 14.5;
    backDoorOpen = THREE.MathUtils.damp(backDoorOpen, nearBack ? 1 : 0, 5.5, dt);
    backDoorLeft.position.x = -1.28 - backDoorOpen * 2.25;
    backDoorRight.position.x = 1.28 + backDoorOpen * 2.25;

    // Auto-open outer airlock door when player approaches z ~ 14.2..24.0
    const nearOuter = Math.abs(playerPos.x) < 4.2 && playerPos.z > 14.0 && playerPos.z < 24.5;
    outerDoorOpen = THREE.MathUtils.damp(outerDoorOpen, nearOuter ? 1 : 0, 5.5, dt);
    airlockOuterDoorLeft.position.x = -1.2 - outerDoorOpen * 2.15;
    airlockOuterDoorRight.position.x = 1.2 + outerDoorOpen * 2.15;

    // Gentle living hover on Cyphr's hologram + smooth mouth waveform ONLY while speaking
    cyphrRig.group.position.y = BRIDGE.daisHeight + Math.sin(elapsed * 1.5) * 0.025;
    speechLevel = THREE.MathUtils.damp(speechLevel, cyphrSpeaking ? 1.0 : 0.0, 6.0, dt);
    cyphrRig.speakingUniform.value = speechLevel;
  };

  return {
    bridgeGroup,
    airlockGroup,
    rampGroup,
    backDoorLeft,
    backDoorRight,
    airlockOuterDoorLeft,
    airlockOuterDoorRight,
    cyphrGroup: cyphrRig.group,
    cyphrSpeakingUniform: cyphrRig.speakingUniform,
    update,
  };
}

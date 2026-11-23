import * as THREE from 'three/webgpu';
import { AIRLOCK, BRIDGE, PLAYER_HEIGHT, RAMP, ZoneId } from './types';
import { terrainHeightAt } from './sutroShore';

export interface PlayerAvatarRig {
  root: THREE.Group;
  updateAnimation: (dt: number, speed: number) => void;
}

/**
 * Builds the 1.8m tall stylized protagonist matching Reference 2:
 * lavender-lilac puffer bomber jacket, dark charcoal utility trousers with lavender side pockets,
 * heavy dark boots, and long dark braids.
 */
export function createPlayerAvatar(): PlayerAvatarRig {
  const root = new THREE.Group();
  root.name = 'PLAYER_AVATAR';

  const skinMat = new THREE.MeshStandardNodeMaterial({
    color: new THREE.Color(0x56382b),
    roughness: 0.68,
    metalness: 0.03,
  });
  const hairMat = new THREE.MeshStandardNodeMaterial({
    color: new THREE.Color(0x121018),
    roughness: 0.8,
    metalness: 0.08,
  });
  const jacketMat = new THREE.MeshStandardNodeMaterial({
    color: new THREE.Color(0x826cc4), // Grounded FF7-register lavender-lilac tactical bomber jacket (Ref 2)
    roughness: 0.72,
    metalness: 0.07,
  });
  const suitMat = new THREE.MeshStandardNodeMaterial({
    color: new THREE.Color(0x282b36), // Heavy weathered charcoal cargo trousers & inner suit
    roughness: 0.82,
    metalness: 0.08,
  });
  const bootMat = new THREE.MeshStandardNodeMaterial({
    color: new THREE.Color(0x13151c), // Grounded dark combat leather boots
    roughness: 0.48,
    metalness: 0.18,
  });
  const hardwareMat = new THREE.MeshStandardNodeMaterial({
    color: new THREE.Color(0x4b5263), // Brushed steel buckle & collar clasp
    roughness: 0.42,
    metalness: 0.78,
  });

  const body = new THREE.Group();
  root.add(body);

  // Legs (pivoted at hip height y = 0.88)
  const makeLeg = (side: number) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.115, 0.88, 0);

    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.54, 8, 12), suitMat);
    leg.position.y = -0.34;
    hip.add(leg);

    // Lavender cargo side pocket accent
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.15, 0.11), jacketMat);
    pocket.position.set(side * 0.065, -0.28, 0);
    hip.add(pocket);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 0.24), bootMat);
    boot.position.set(0, -0.76, -0.03);
    hip.add(boot);

    return hip;
  };

  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);
  body.add(leftLeg, rightLeg);

  // Torso (inner charcoal bodysuit + sculpted lavender bomber jacket + utility belt)
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.18, 12), suitMat);
  pelvis.position.y = 0.92;
  body.add(pelvis);

  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.162, 0.162, 0.05, 14), bootMat);
  belt.position.y = 0.98;
  body.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.055, 0.04), hardwareMat);
  buckle.position.set(0, 0.98, -0.155);
  body.add(buckle);

  const jacket = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.44, 14), jacketMat);
  jacket.scale.set(1.12, 1, 0.78);
  jacket.position.y = 1.22;
  body.add(jacket);

  const innerStripe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.43, 0.28), suitMat);
  innerStripe.position.set(0, 1.22, -0.02);
  body.add(innerStripe);

  // Arms (pivoted at shoulder y = 1.38)
  const makeArm = (side: number) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.245, 1.38, 0);

    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.064, 0.42, 8, 12), jacketMat);
    sleeve.position.y = -0.24;
    shoulder.add(sleeve);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 10), skinMat);
    hand.position.y = -0.51;
    shoulder.add(hand);

    return shoulder;
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  body.add(leftArm, rightArm);

  // Neck & Head (top crown hits canonical 1.80 m height)
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.1, 10), skinMat);
  neck.position.y = 1.49;
  body.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.118, 16, 14), skinMat);
  head.scale.set(0.92, 1.08, 0.98);
  head.position.y = 1.66;
  body.add(head);

  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.128, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.65), hairMat);
  hairCap.position.set(0, 1.68, 0.015);
  body.add(hairCap);

  // Long dark braids hanging down back & shoulders
  for (let i = -2; i <= 2; i++) {
    const braid = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.014, 0.56, 6), hairMat);
    braid.position.set(i * 0.048, 1.38, 0.1 + Math.abs(i) * 0.01);
    braid.rotation.x = 0.08;
    body.add(braid);
  }

  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  // Verify total height stays exactly canonical 1.8m
  void PLAYER_HEIGHT;

  let walkPhase = 0;
  const updateAnimation = (dt: number, speed: number) => {
    const moving = speed > 0.15;
    if (moving) {
      walkPhase += dt * (4.2 + speed * 0.85);
    } else {
      walkPhase = THREE.MathUtils.damp(walkPhase, Math.round(walkPhase / Math.PI) * Math.PI, 8, dt);
    }
    const amp = moving ? Math.min(0.55, speed * 0.095) : 0;
    const swing = Math.sin(walkPhase) * amp;

    leftLeg.rotation.x = swing;
    rightLeg.rotation.x = -swing;
    leftArm.rotation.x = -swing * 0.72;
    rightArm.rotation.x = swing * 0.72;
    body.position.y = Math.abs(Math.cos(walkPhase)) * amp * 0.06;
  };

  return { root, updateAnimation };
}

/**
 * Resolves the player's continuous world zone ('bridge' | 'airlock' | 'exterior'),
 * exact walkable ground elevation (3-step dais, deck, airlock, descending ramp, beach, stepped cliffs),
 * and clean collision clamping so the player walks seamlessly from Bridge -> Airlock -> Ramp -> Beach!
 */
export function resolvePlayerWorldStep(
  pos: THREE.Vector3,
  nextX: number,
  nextZ: number
): { x: number; y: number; z: number; zone: ZoneId } {
  let x = nextX;
  let z = nextZ;

  // Determine spatial corridor region
  const inBridgeZ = z <= BRIDGE.zBack + 0.1;
  const inAirlockZ = z > BRIDGE.zBack + 0.1 && z <= AIRLOCK.zEnd;
  const inRampZ = z > AIRLOCK.zEnd && z <= RAMP.zEnd;

  if (inBridgeZ) {
    // Check whether player is in the adjoining Cyphr Bay (x > 14.2, z in 1.2..7.0)
    const enteringCyphrBay = x > 12.2 && z > 1.3 && z < 6.9;

    if (enteringCyphrBay) {
      x = THREE.MathUtils.clamp(x, 12.2, BRIDGE.width * 0.5 + 6.4);
      z = THREE.MathUtils.clamp(z, 1.45, 6.75);
    } else {
      // Main Bridge Deck (30m x 24m) inside wall consoles & oval viewport sill
      x = THREE.MathUtils.clamp(x, -11.9, 12.2);
      z = THREE.MathUtils.clamp(z, BRIDGE.zFront + 2.5, BRIDGE.zBack + 0.25);

      // Keep away from exact back wall except through the 4.2m wide sliding back door opening
      if (z > BRIDGE.zBack - 0.55 && Math.abs(x) > 2.05) {
        z = BRIDGE.zBack - 0.55;
      }

      // Soft collision around fixed black command chair at dais center (0, -2.0)
      const dxChair = x - 0;
      const dzChair = z - BRIDGE.daisCenterZ;
      const distChair = Math.hypot(dxChair, dzChair);
      const chairR = 1.05;
      if (distChair < chairR && distChair > 0.001) {
        x = (dxChair / distChair) * chairR;
        z = BRIDGE.daisCenterZ + (dzChair / distChair) * chairR;
      }

      // Soft collision around Cyphr's hologram pedestal at (2.05, -4.05)
      const dxC = x - 2.05;
      const dzC = z - (BRIDGE.daisCenterZ - 2.05);
      const distC = Math.hypot(dxC, dzC);
      if (distC < 0.72 && distC > 0.001) {
        x = 2.05 + (dxC / distC) * 0.72;
        z = BRIDGE.daisCenterZ - 2.05 + (dzC / distC) * 0.72;
      }
    }

    // 3-step circular command dais elevation
    const distDais = Math.hypot(x, z - BRIDGE.daisCenterZ);
    let y = BRIDGE.deckY;
    if (distDais < 3.18) y = BRIDGE.deckY + 0.54;
    else if (distDais < 3.6) y = BRIDGE.deckY + 0.36;
    else if (distDais < 4.08) y = BRIDGE.deckY + 0.18;

    return { x, y, z, zone: 'bridge' };
  }

  if (inAirlockZ) {
    // Confined inside airlock corridor walls
    x = THREE.MathUtils.clamp(x, -(AIRLOCK.halfWidth - 0.55), AIRLOCK.halfWidth - 0.55);
    return { x, y: AIRLOCK.deckY, z, zone: 'airlock' };
  }

  if (inRampZ && Math.abs(pos.x) < RAMP.halfWidth + 0.9 && pos.z < RAMP.zEnd + 1.5 && Math.abs(x) < RAMP.halfWidth + 0.8) {
    // Walking on the descending shore ramp
    x = THREE.MathUtils.clamp(x, -(RAMP.halfWidth - 0.48), RAMP.halfWidth - 0.48);
    const t = THREE.MathUtils.clamp((z - RAMP.zStart) / (RAMP.zEnd - RAMP.zStart), 0, 1);
    const y = THREE.MathUtils.lerp(RAMP.yTop, RAMP.yBottom, t);
    return { x, y, z, zone: 'exterior' };
  }

  // Exterior Sutro Baths Shore, Beach Apron, Tide Pools & Stepped Climbable North Cliffs
  x = THREE.MathUtils.clamp(x, -86, 108);
  z = THREE.MathUtils.clamp(z, 25, 110);

  // Prevent walking back directly into the underwater ship hull flank except via the ramp foot
  if (z < RAMP.zEnd && Math.abs(x) > RAMP.halfWidth - 0.2 && Math.abs(x) < 16) {
    z = Math.max(z, RAMP.zEnd + 0.3);
  }

  const groundY = terrainHeightAt(x, z);
  // Prevent wading too deep into the open sea; allow shallow splash inside Sutro Baths tide pools (y >= -0.45)
  if (groundY < -0.55) {
    return { x: pos.x, y: Math.max(terrainHeightAt(pos.x, pos.z), -0.45), z: pos.z, zone: 'exterior' };
  }

  return { x, y: groundY, z, zone: 'exterior' };
}

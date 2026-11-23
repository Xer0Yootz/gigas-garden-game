import * as THREE from 'three/webgpu';
import {
  Fn,
  float,
  vec2,
  vec3,
  color,
  positionLocal,
  normalWorld,
  time,
  sin,
  cos,
  mix,
  smoothstep,
  clamp,
  pow,
  dot,
  max,
  fract,
  normalize,
  length,
} from 'three/tsl';
import { SUN_DIRECTION } from './types';

export interface NVSkysphereRig {
  group: THREE.Group;
  update: (dt: number) => void;
}

/**
 * NEON VIGIL — NV SKYSPHERE MODULE (Three.js r187 WebGPU / TSL)
 *
 * Encodes Neon Vigil's canonical sky architecture in FF7 anime-realist dusk luminosity:
 *  1. Structured pink-to-purple gradient dome with warm sunward horizon luminosity
 *  2. Canonical horizontal striped sun disc (8 crisp progressive sunset bands, HDR-boosted for selective bloom)
 *  3. Dual parallax drifting sky-dome cloud strata + huge luminous slow-drifting 3D cumulus banks
 *     framing the sun so Bridge oval viewport sightline keeps striped sun, clouds, and animated sea in frame
 */
export function createNVSkysphere(): NVSkysphereRig {
  const group = new THREE.Group();
  group.name = 'NV_SKYSPHERE';

  const skyGeo = new THREE.SphereGeometry(1650, 64, 48);
  const skyMat = new THREE.MeshBasicNodeMaterial();
  skyMat.side = THREE.BackSide;
  skyMat.depthWrite = false;
  skyMat.fog = false;

  const upWorld = new THREE.Vector3(0, 1, 0);
  const sunRightVec = new THREE.Vector3().crossVectors(upWorld, SUN_DIRECTION).normalize();
  const sunUpVec = new THREE.Vector3().crossVectors(SUN_DIRECTION, sunRightVec).normalize();

  const sunDirNode = vec3(SUN_DIRECTION.x, SUN_DIRECTION.y, SUN_DIRECTION.z);
  const sunRightNode = vec3(sunRightVec.x, sunRightVec.y, sunRightVec.z);
  const sunUpNode = vec3(sunUpVec.x, sunUpVec.y, sunUpVec.z);

  skyMat.colorNode = Fn(() => {
    const dir = normalize(positionLocal);
    const y = dir.y;
    const elev = clamp(y, 0.0, 1.0);

    // 1. NV Skysphere Pink-to-Purple Dusk Gradient Dome (FF7 anime-realist richness + luminous openness)
    const horizonRose = color(0xe87fa6);
    const lowerMagenta = color(0xc43f82);
    const midPlum = color(0x702c8a);
    const upperIndigo = color(0x301b62);
    const zenithNight = color(0x130c30);

    const g1 = mix(horizonRose, lowerMagenta, smoothstep(0.0, 0.11, elev));
    const g2 = mix(g1, midPlum, smoothstep(0.09, 0.28, elev));
    const g3 = mix(g2, upperIndigo, smoothstep(0.24, 0.54, elev));
    const upperSky = mix(g3, zenithNight, smoothstep(0.48, 0.96, elev));

    const underHorizon = mix(horizonRose, color(0x0b3a4a), smoothstep(0.0, 0.22, y.negate().max(0.0)));
    const baseSky = mix(underHorizon, upperSky, smoothstep(-0.012, 0.012, y));

    // Sunward horizon atmospheric luminosity
    const cosAngle = dot(dir, sunDirNode);
    const sunAlign = max(cosAngle, 0.0);
    const horizonBloom = pow(float(1.0).sub(elev), 5.6).mul(pow(sunAlign, 2.1).mul(0.6).add(0.24));
    const skyLit = baseSky.add(color(0xffa4b8).mul(horizonBloom).mul(0.42));

    // 2. NV Canonical Striped Sun with crisp 8-band progressive horizon slicing
    const u = dot(dir, sunRightNode);
    const v = dot(dir, sunUpNode);
    const angDist = length(vec2(u, v));
    const sunRadius = float(0.084);

    const discMask = smoothstep(sunRadius.add(0.0022), sunRadius.sub(0.0022), angDist)
      .mul(smoothstep(0.0, 0.15, cosAngle));

    const sunY = clamp(v.div(sunRadius).mul(0.5).add(0.5), 0.0, 1.0);

    // 8 crisp horizontal bands slicing progressively wider across the lower 62% of the sun disc
    const lowerProgress = clamp(float(0.62).sub(sunY).div(0.62), 0.0, 1.0);
    const stripePhase = fract(pow(lowerProgress, 0.94).mul(8.0));
    const gapWidth = mix(float(0.08), float(0.62), lowerProgress);
    const sliceKeep = smoothstep(gapWidth.sub(0.042), gapWidth.add(0.042), stripePhase);
    const stripeMask = mix(sliceKeep, float(1.0), smoothstep(0.59, 0.63, sunY));
    const finalSunMask = discMask.mul(stripeMask);

    // NV Striped Sun vertical gradient: warm amber-cream crown -> coral-rose mid -> deep crimson-magenta lower bands
    const sunTop = color(0xffebc4);
    const sunMid = color(0xf56c92);
    const sunBot = color(0xc21e68);
    const sunGrad = mix(
      mix(sunBot, sunMid, smoothstep(0.0, 0.54, sunY)),
      sunTop,
      smoothstep(0.46, 0.96, sunY)
    );
    // HDR-boosted sun core so selective bloom catches the striped sun cleanly
    const sunColor = sunGrad.mul(1.48);

    // Luminous cinematic solar corona
    const wideHalo = pow(sunAlign, 7.5).mul(0.28);
    const midHalo = pow(sunAlign, 28.0).mul(0.36);
    const tightHalo = pow(sunAlign, 84.0).mul(0.5);
    const skyWithCorona = skyLit
      .add(color(0xd95b96).mul(wideHalo))
      .add(color(0xff9eb8).mul(midHalo))
      .add(color(0xffe6cc).mul(tightHalo));

    const skyWithSun = mix(skyWithCorona, sunColor, finalSunMask);

    // 3. NV Dual-Layer Parallax Drifting Cloud Strata across the dome
    const cloudPlane = dir.xz.div(elev.add(0.16));

    // Layer A: High-altitude slow cirrus ribbons
    const driftHigh = time.mul(0.028);
    const h1 = sin(cloudPlane.x.mul(0.68).add(driftHigh)).mul(cos(cloudPlane.y.mul(0.5).add(0.35)));
    const h2 = sin(cloudPlane.x.mul(1.45).sub(cloudPlane.y.mul(0.75)).add(driftHigh.mul(1.6))).mul(0.55);
    const highField = h1.add(h2).mul(0.42).add(0.5);
    const highBand = smoothstep(0.10, 0.24, elev).mul(smoothstep(0.76, 0.28, elev));
    const highAlpha = smoothstep(0.52, 0.88, highField).mul(highBand);
    const highColor = mix(color(0x522a78), color(0xf4a8c8), smoothstep(0.5, 0.85, highField).mul(0.65).add(pow(sunAlign, 2.0).mul(0.35)));

    // Layer B: Lower-altitude sweeping dusk cloud deck
    const driftLow = time.mul(0.052);
    const l1 = sin(cloudPlane.x.mul(1.05).add(driftLow)).mul(cos(cloudPlane.y.mul(0.72).sub(0.5)));
    const l2 = cos(cloudPlane.x.mul(2.35).add(cloudPlane.y.mul(1.3)).add(driftLow.mul(1.3))).mul(0.42);
    const lowField = l1.add(l2).mul(0.44).add(0.5);
    const lowBand = smoothstep(0.02, 0.11, elev).mul(smoothstep(0.50, 0.14, elev));
    const lowAlpha = smoothstep(0.48, 0.84, lowField).mul(lowBand);
    const lowHighlight = mix(color(0xd876a8), color(0xffd2be), pow(sunAlign, 2.0));
    const lowShade = color(0x3a205c);
    const lowColor = mix(lowShade, lowHighlight, smoothstep(0.46, 0.78, lowField));

    const sunClear = float(1.0).sub(finalSunMask.mul(0.88));
    const withHigh = mix(skyWithSun, highColor, highAlpha.mul(0.42).mul(sunClear));
    return mix(withHigh, lowColor, lowAlpha.mul(0.56).mul(sunClear));
  })();

  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.name = 'NV_SKYSPHERE_DOME';
  skyMesh.frustumCulled = false;
  group.add(skyMesh);

  // =========================================================================
  // HUGE LUMINOUS SLOW-DRIFTING 3D CUMULUS CLOUD MASSES
  // Massive Sky-scale silhouettes shaded with dramatic FF7 dusk contrast & backlit amber-rose rims
  // =========================================================================
  const cloudRing = new THREE.Group();
  cloudRing.name = 'NV_SKYSPHERE_3D_CLOUD_MASSES';
  group.add(cloudRing);

  const cloudMat = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
  });

  cloudMat.colorNode = Fn(() => {
    const n = normalWorld;
    const upFactor = clamp(n.y.mul(0.5).add(0.5), 0.0, 1.0);
    const sunRim = pow(max(dot(n, sunDirNode), 0.0), 2.1);

    const bellySlatePlum = color(0x321f52);
    const bodyDuskRose = color(0x9c487c);
    const crownWarmPeach = color(0xffcbb6);

    const verticalGrad = mix(
      mix(bellySlatePlum, bodyDuskRose, smoothstep(0.14, 0.62, upFactor)),
      crownWarmPeach,
      smoothstep(0.56, 0.96, upFactor)
    );
    return verticalGrad.add(color(0xffc0a0).mul(sunRim).mul(0.44));
  })();

  cloudMat.opacityNode = Fn(() => {
    const n = normalWorld;
    const upSoft = smoothstep(-0.62, 0.28, n.y);
    return float(0.72).add(upSoft.mul(0.22));
  })();

  const puffGeo = new THREE.IcosahedronGeometry(1, 2);

  interface CloudBankSpec {
    angleDeg: number; // 0 = -Z (sun center); frame left/right & high so striped sun stays crystal clear!
    radius: number;
    elevation: number;
    scale: number;
    puffs: number;
  }

  const cloudSpecs: CloudBankSpec[] = [
    // Flanking the striped sun inside the Bridge oval viewport sightline
    { angleDeg: -22, radius: 620, elevation: 72, scale: 36, puffs: 7 },
    { angleDeg: 21, radius: 640, elevation: 68, scale: 38, puffs: 7 },
    { angleDeg: -38, radius: 580, elevation: 108, scale: 44, puffs: 8 },
    { angleDeg: 36, radius: 600, elevation: 102, scale: 42, puffs: 8 },
    { angleDeg: -8, radius: 740, elevation: 162, scale: 48, puffs: 7 },
    { angleDeg: 11, radius: 720, elevation: 154, scale: 46, puffs: 7 },
    // Sweeping panoramic clouds around the full 360-degree exterior horizon
    { angleDeg: -68, radius: 650, elevation: 94, scale: 52, puffs: 8 },
    { angleDeg: 66, radius: 640, elevation: 96, scale: 50, puffs: 8 },
    { angleDeg: -108, radius: 680, elevation: 122, scale: 56, puffs: 7 },
    { angleDeg: 105, radius: 660, elevation: 118, scale: 54, puffs: 7 },
    { angleDeg: -148, radius: 700, elevation: 112, scale: 58, puffs: 8 },
    { angleDeg: 146, radius: 690, elevation: 116, scale: 56, puffs: 8 },
    { angleDeg: 180, radius: 720, elevation: 138, scale: 62, puffs: 8 },
  ];

  const totalPuffs = cloudSpecs.reduce((acc, s) => acc + s.puffs, 0);
  const cloudInstanced = new THREE.InstancedMesh(puffGeo, cloudMat, totalPuffs);
  cloudInstanced.frustumCulled = false;

  const dummy = new THREE.Object3D();
  let instanceIdx = 0;

  for (let b = 0; b < cloudSpecs.length; b++) {
    const spec = cloudSpecs[b];
    const rad = THREE.MathUtils.degToRad(spec.angleDeg);
    const cx = Math.sin(rad) * spec.radius;
    const cz = -Math.cos(rad) * spec.radius;
    const tangentX = Math.cos(rad);
    const tangentZ = Math.sin(rad);

    for (let p = 0; p < spec.puffs; p++) {
      const frac = spec.puffs > 1 ? p / (spec.puffs - 1) - 0.5 : 0;
      const arch = Math.cos(frac * Math.PI);
      const lateral = frac * spec.scale * 3.1;
      const depthJitter = Math.sin(b * 7.3 + p * 4.1) * spec.scale * 0.45;
      const heightOff = arch * spec.scale * 0.72 + Math.cos(b * 3.1 + p * 5.7) * spec.scale * 0.14;

      dummy.position.set(
        cx + tangentX * lateral - Math.sin(rad) * depthJitter,
        spec.elevation + heightOff,
        cz + tangentZ * lateral + Math.cos(rad) * depthJitter
      );

      const puffR = spec.scale * (0.58 + arch * 0.52 + ((p * 3 + b) % 3) * 0.08);
      dummy.scale.set(puffR * 1.45, puffR * 0.78, puffR * 1.15);
      dummy.rotation.set(0, rad + p * 0.35, 0);
      dummy.updateMatrix();

      cloudInstanced.setMatrixAt(instanceIdx++, dummy.matrix);
    }
  }

  cloudInstanced.instanceMatrix.needsUpdate = true;
  cloudInstanced.computeBoundingSphere();
  cloudRing.add(cloudInstanced);

  const update = (dt: number) => {
    // Slow breathing drift across the horizon
    cloudRing.rotation.y += dt * 0.0062;
  };

  return { group, update };
}

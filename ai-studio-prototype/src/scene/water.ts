import * as THREE from 'three/webgpu';
import {
  Fn,
  float,
  vec3,
  color,
  positionLocal,
  positionWorld,
  cameraPosition,
  time,
  sin,
  cos,
  mix,
  smoothstep,
  clamp,
  pow,
  dot,
  max,
  normalize,
  length,
  reflect,
} from 'three/tsl';
import { SUN_DIRECTION } from './types';

/**
 * Aniimo / Anime Open-World Saturated Teal Sea.
 * Vibrant turquoise-to-deep-teal color bands, crisp stylized rolling wave crests & white foam,
 * radiant striped-sun glitter path crossing the water straight into the bridge oval viewport,
 * and bright turquoise illumination inside the brutalist Sutro Baths tide pools.
 */
export function createTealWaterPlain(): THREE.Mesh {
  const waterGeo = new THREE.PlaneGeometry(2400, 2400, 180, 180);
  waterGeo.rotateX(-Math.PI / 2);

  const waterMat = new THREE.MeshStandardNodeMaterial();
  waterMat.roughness = 0.19;
  waterMat.metalness = 0.22; // Grounded cinematic ocean sheen catching dusk sky & dramatic light
  waterMat.fog = false;

  const sunDirNode = vec3(SUN_DIRECTION.x, SUN_DIRECTION.y, SUN_DIRECTION.z);

  // Rolling animated swells traveling shoreward (+Z) toward the brutalist Sutro Baths
  waterMat.positionNode = Fn(() => {
    const lp = positionLocal;
    const t = time;
    const dist = length(lp.xz);
    const nearFade = smoothstep(820.0, 95.0, dist);

    const swell1 = sin(lp.z.mul(0.082).sub(t.mul(1.6)).add(lp.x.mul(0.022))).mul(0.36);
    const swell2 = cos(lp.z.mul(0.155).sub(t.mul(2.1)).sub(lp.x.mul(0.055))).mul(0.18);
    const chop = sin(lp.x.mul(0.22).add(lp.z.mul(0.2)).sub(t.mul(2.6))).mul(0.07);

    // Stronger surge rolling over the brutalist Sutro Baths pool walls (z ~ 22..56)
    const bathZone = smoothstep(10.0, 32.0, lp.z).mul(smoothstep(74.0, 48.0, lp.z));
    const surge = sin(lp.z.mul(0.26).sub(t.mul(2.5))).mul(0.26).mul(bathZone);

    const h = swell1.add(swell2).add(chop).mul(nearFade).add(surge);
    return lp.add(vec3(0.0, h, 0.0));
  })();

  const waterSurface = Fn(() => {
    const p = positionWorld.xz;
    const t = time;
    const dist = length(p);
    const detailFade = smoothstep(980.0, 70.0, dist);

    // Animated wave slope normals for heavy coastal swells and sharp shimmering sun glitter path
    const w1x = cos(p.x.mul(0.105).add(p.y.mul(0.085)).sub(t.mul(1.7))).mul(0.085);
    const w1z = cos(p.y.mul(0.135).sub(p.x.mul(0.04)).sub(t.mul(1.9))).mul(0.108);

    const w2x = sin(p.x.mul(0.30).sub(p.y.mul(0.22)).sub(t.mul(2.35))).mul(0.058);
    const w2z = cos(p.y.mul(0.34).add(p.x.mul(0.18)).sub(t.mul(2.55))).mul(0.066);

    const w3x = cos(p.x.mul(0.84).add(p.y.mul(0.72)).sub(t.mul(3.2))).mul(0.032);
    const w3z = sin(p.y.mul(0.90).sub(p.x.mul(0.66)).sub(t.mul(2.9))).mul(0.032);

    const nx = w1x.add(w2x).add(w3x).mul(detailFade);
    const nz = w1z.add(w2z).add(w3z).mul(detailFade);
    const N = normalize(vec3(nx, float(1.0), nz));

    const V = normalize(cameraPosition.sub(positionWorld));
    const nDotV = max(dot(N, V), 0.0);
    const fresnel = pow(float(1.0).sub(nDotV), 3.4);

    // Rich grounded FF7 marine teal-slate sea (deep moody troughs, rich sunlit teal swells — never candy-bright)
    const abyssTeal = color(0x032633);
    const marineTeal = color(0x085a68);
    const crestTeal = color(0x168c94);

    const crestWave = clamp(
      sin(p.y.mul(0.115).sub(t.mul(1.8)).add(p.x.mul(0.028))).mul(0.5).add(0.5).add(nz.mul(3.0)),
      0.0,
      1.0
    );

    const seaBase = mix(abyssTeal, marineTeal, smoothstep(0.16, 0.76, crestWave));
    const seaTeal = mix(seaBase, crestTeal, smoothstep(0.66, 0.94, crestWave).mul(0.45));

    // Grounded translucent emerald-teal shallows inside the ruined Sutro Baths concrete tide pools
    const shallowPoolGlow = smoothstep(18.0, 34.0, p.y).mul(smoothstep(64.0, 44.0, p.y)).mul(0.32);
    const tealWithShallows = mix(seaTeal, color(0x147b82), shallowPoolGlow);

    // Cinematic dusk rose-plum sky reflection across grazing wave angles
    const skyReflect = mix(color(0x185c6b), color(0xcc5a8e), fresnel.mul(0.84));
    const waterBody = mix(tealWithShallows, skyReflect, fresnel.mul(0.62));

    // Dramatic striped-sun amber-rose & hot-white glitter path cutting across the dark teal water
    const R = reflect(V.negate(), N);
    const sunSpec = max(dot(R, sunDirNode), 0.0);
    const wideGlint = pow(sunSpec, 16.0).mul(0.56);
    const brightSparkle = pow(sunSpec, 110.0).mul(1.65);
    const glitterPath = color(0xe86c96).mul(wideGlint).add(color(0xffe6c4).mul(brightSparkle));

    // Heavy coastal surf foam ribbons breaking over the brutalist Sutro Baths concrete walls
    const shoreBand = smoothstep(14.0, 32.0, p.y).mul(smoothstep(68.0, 44.0, p.y));
    const foamRoll = sin(p.y.mul(0.38).sub(t.mul(2.75)).add(sin(p.x.mul(0.16)).mul(1.7)));
    const foamRibbon = smoothstep(0.46, 0.82, foamRoll).mul(shoreBand);

    // Grounded turbulent wake foam ring around the monumental Infinity 6 resting on the sea
    const shipDist = length(vec3(p.x.mul(0.68), float(0.0), p.y.add(8.0).mul(0.48)));
    const shipFoam = smoothstep(32.0, 26.0, shipDist)
      .mul(smoothstep(18.0, 25.5, shipDist))
      .mul(smoothstep(0.24, 0.86, sin(shipDist.mul(1.1).sub(t.mul(2.3))).mul(0.5).add(0.5)))
      .mul(0.36);

    const litWater = waterBody
      .add(glitterPath)
      .add(color(0xc8e0e2).mul(foamRibbon.mul(0.46).add(shipFoam)));

    // Moody dusky rose-plum horizon atmospheric blend into the FF7 dusk sky dome
    const horizonMist = smoothstep(360.0, 1180.0, dist);
    return mix(litWater, color(0xc96898), horizonMist);
  });

  waterMat.colorNode = waterSurface();
  waterMat.emissiveNode = waterSurface().mul(0.22);

  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.name = 'TEAL_OCEAN_PLAIN';
  waterMesh.position.y = 0;
  waterMesh.receiveShadow = true;
  return waterMesh;
}

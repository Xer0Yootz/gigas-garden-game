import * as THREE from 'three/webgpu';
import {
  Fn,
  float,
  color,
  positionLocal,
  normalLocal,
  normalWorld,
  positionWorld,
  cameraPosition,
  uv,
  time,
  sin,
  cos,
  floor,
  fract,
  mix,
  smoothstep,
  clamp,
  pow,
  dot,
  max,
  abs,
} from 'three/tsl';

/**
 * NEON VIGIL — DELTA HOLOGRAM TREATMENT (Three.js r187 WebGPU / TSL)
 *
 * House hologram language:
 *  - Indigo light body with cel-stepped Fresnel silhouette (NO sparkles, NO stars)
 *  - Crisp 92-line horizontal scanlines mapped continuously across hologram height
 *  - Authentic 12 Hz hologram flicker cadence (quantized 12 Hz clock + subtle carrier pulse)
 *  - Inverted-hull TSL toon-ink outline contour around holographic forms
 *  - Dedicated 2D ink overlay pass projecting fine graphic ink registration lines onto the hologram
 */

export interface DeltaHologramOptions {
  /** World-space Y at the base of the hologram so all parts share one unbroken 92-line raster */
  baseWorldY: number;
  /** Total vertical height in meters spanned by the 92 scanlines */
  heightMeters: number;
  /** Optional speaking intensity uniform (0 = rest, 1 = speaking) */
  speakingUniform?: THREE.UniformNode<'float', number>;
  /** Emissive intensity multiplier for MRT selective bloom */
  intensity?: number;
}

/**
 * Shared 12 Hz Neon Vigil hologram flicker TSL node.
 * Produces a gentle, grounded 12 Hz signal cadence (~0.89..1.06) without harsh strobing.
 */
function deltaFlicker12Hz() {
  const step12 = floor(time.mul(12.0));
  const hash12 = fract(sin(step12.mul(12.9898)).mul(43758.5453));
  const microJitter = mix(float(0.91), float(1.04), hash12);
  const carrierWave = sin(time.mul(75.398223686)).mul(0.032); // 12 Hz * 2π
  // Occasional brief subtle 12 Hz dip (authentic projection sync flutter)
  const syncDip = smoothstep(0.92, 0.99, hash12).mul(0.09);
  return clamp(microJitter.add(carrierWave).sub(syncDip), 0.82, 1.08);
}

/**
 * Creates the house Delta Hologram indigo TSL material with 92-line scanlines,
 * 12 Hz flicker, cel-stepped Fresnel body, and MRT-compatible emissive output.
 * Strictly zero sparkles or stars.
 */
export function createDeltaHologramMaterial(
  options: DeltaHologramOptions
): THREE.MeshStandardNodeMaterial {
  const { baseWorldY, heightMeters, speakingUniform, intensity = 1.38 } = options;

  const mat = new THREE.MeshStandardNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    roughness: 1.0,
    metalness: 0.0,
  });

  const holoEmission = Fn(() => {
    const V = cameraPosition.sub(positionWorld).normalize();
    const nDotV = max(dot(normalWorld, V), 0.0);
    const rawFresnel = pow(float(1.0).sub(nDotV), 1.85);

    // Subtle anime-realist cel quantization of the indigo light volume
    const toonRim = mix(rawFresnel, smoothstep(0.28, 0.62, rawFresnel), 0.45);

    // Continuous 92-line scanline raster spanning exact hologram height (0..1 -> 92 lines)
    const normY = clamp(positionWorld.y.sub(baseWorldY).div(heightMeters), 0.0, 1.0);
    const scanPhase = fract(normY.mul(92.0).sub(time.mul(0.45)));
    const scanBand = smoothstep(0.08, 0.28, scanPhase).mul(smoothstep(0.96, 0.72, scanPhase));
    const scanMod = mix(float(0.64), float(1.12), scanBand);

    // 12 Hz hologram flicker cadence
    const flicker = deltaFlicker12Hz();

    // Pure indigo light body palette (NO sparkle, NO stars)
    const deepIndigo = color(0x312e81);
    const bodyIndigo = color(0x4f46e5);
    const rimPeriwinkle = color(0xa5b4fc);

    const baseBody = mix(deepIndigo, bodyIndigo, smoothstep(0.08, 0.55, toonRim));
    let litIndigo = mix(baseBody, rimPeriwinkle, smoothstep(0.45, 0.92, toonRim));

    if (speakingUniform) {
      litIndigo = litIndigo.add(color(0x818cf8).mul(speakingUniform.mul(0.28)));
    }

    return litIndigo.mul(scanMod).mul(flicker).mul(intensity);
  });

  // Zero diffuse fill so the hologram reads purely as projected indigo light & feeds MRT selective bloom cleanly
  mat.colorNode = color(0x090820);
  mat.emissiveNode = holoEmission();

  mat.opacityNode = Fn(() => {
    const V = cameraPosition.sub(positionWorld).normalize();
    const nDotV = max(dot(normalWorld, V), 0.0);
    const fresnel = pow(float(1.0).sub(nDotV), 1.35);

    const normY = clamp(positionWorld.y.sub(baseWorldY).div(heightMeters), 0.0, 1.0);
    const scanPhase = fract(normY.mul(92.0).sub(time.mul(0.45)));
    const scanAlpha = mix(float(0.76), float(1.0), smoothstep(0.1, 0.4, scanPhase));
    const fadeFoot = smoothstep(0.0, 0.16, normY);
    const flicker = deltaFlicker12Hz();

    return clamp(float(0.34).add(fresnel.mul(0.56)).mul(scanAlpha).mul(fadeFoot).mul(flicker), 0.0, 0.94);
  })();

  return mat;
}

/**
 * Inverted-hull TSL toon-ink outline material for Delta Hologram meshes.
 * Draws a crisp deep indigo-black ink contour around every holographic limb & silhouette.
 */
export function createDeltaInkOutlineMaterial(thickness = 0.012): THREE.MeshBasicNodeMaterial {
  const mat = new THREE.MeshBasicNodeMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthWrite: true,
  });

  mat.positionNode = positionLocal.add(normalLocal.mul(float(thickness)));
  mat.colorNode = color(0x09071a);
  mat.opacityNode = Fn(() => {
    const flicker = deltaFlicker12Hz();
    return clamp(float(0.86).mul(flicker), 0.7, 0.94);
  })();

  return mat;
}

/**
 * Helper: attaches a hologram mesh paired with its inverted-hull Delta ink outline child.
 */
export function addDeltaHologramPart(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  holoMat: THREE.Material,
  inkOutlineMat: THREE.Material,
  setup?: (mesh: THREE.Mesh) => void
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, holoMat);
  mesh.renderOrder = 2;
  if (setup) setup(mesh);

  const inkShell = new THREE.Mesh(geometry, inkOutlineMat);
  inkShell.name = `${mesh.name || 'HOLO'}_INK_OUTLINE`;
  inkShell.renderOrder = 1;
  mesh.add(inkShell);

  parent.add(mesh);
  return mesh;
}

/**
 * Delta Hologram projector / emitter ring & architectural holographic field shader
 * (indigo, fine scanlines, 12 Hz flicker, MRT emissive — zero sparkle/stars).
 */
export function createDeltaHoloFieldMaterial(
  baseColorHex = 0x5248e5,
  opacityScale = 0.65
): THREE.MeshStandardNodeMaterial {
  const mat = new THREE.MeshStandardNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    roughness: 1.0,
    metalness: 0.0,
  });

  mat.colorNode = color(0x070618);
  mat.emissiveNode = Fn(() => {
    const p = uv();
    const scan92 = mix(float(0.72), float(1.08), smoothstep(0.15, 0.45, fract(p.y.mul(92.0).sub(time.mul(0.5)))));
    const flicker = deltaFlicker12Hz();
    return color(baseColorHex).mul(scan92).mul(flicker).mul(1.45);
  })();

  mat.opacityNode = Fn(() => {
    const flicker = deltaFlicker12Hz();
    return clamp(float(opacityScale).mul(flicker), 0.0, 0.92);
  })();

  return mat;
}

/**
 * Cyphr's mouth audio waveform material — strictly opacity 0 at rest (smooth blank face),
 * manifests ONLY while speaking with Delta 12 Hz flicker & scanline coherence.
 */
export function createDeltaMouthWaveformMaterial(
  speakingUniform: THREE.UniformNode<'float', number>
): THREE.MeshStandardNodeMaterial {
  const mat = new THREE.MeshStandardNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    roughness: 1.0,
    metalness: 0.0,
  });

  mat.colorNode = color(0x090820);
  mat.emissiveNode = Fn(() => {
    const flicker = deltaFlicker12Hz();
    return color(0x88f4ff).mul(flicker).mul(2.1);
  })();

  mat.opacityNode = Fn(() => {
    const p = uv();
    const env = sin(p.x.mul(Math.PI));
    const w1 = sin(p.x.mul(22.0).add(time.mul(18.0))).mul(0.26);
    const w2 = cos(p.x.mul(38.0).sub(time.mul(24.0))).mul(0.14);
    const waveY = float(0.5).add(w1.add(w2).mul(env).mul(speakingUniform));
    const distToLine = abs(p.y.sub(waveY));
    const lineMask = smoothstep(0.14, 0.02, distToLine).mul(env);
    const flicker = deltaFlicker12Hz();
    return lineMask.mul(speakingUniform).mul(flicker);
  })();

  return mat;
}

/**
 * NEON VIGIL — 2D INK OVERLAY (Delta Hologram Scene Technique)
 *
 * Transparent 2D canvas synced to the active Three.js camera.
 * Renders crisp, zero-text graphic ink contours, subtle 92-line raster ink accents,
 * and 12 Hz registration ink ticks tightly projected onto Cyphr's holographic silhouette.
 * Zero HUD text, zero stars, zero sparkles.
 */
export class DeltaInkOverlay {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private width = 1;
  private height = 1;
  private dpr = 1;

  private readonly _worldBase = new THREE.Vector3();
  private readonly _worldMid = new THREE.Vector3();
  private readonly _worldTop = new THREE.Vector3();
  private readonly _worldLeft = new THREE.Vector3();
  private readonly _worldRight = new THREE.Vector3();
  private readonly _camRight = new THREE.Vector3();
  private readonly _toHolo = new THREE.Vector3();
  private readonly _camFwd = new THREE.Vector3();

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pointer-events-none absolute inset-0 h-full w-full';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d');
    container.appendChild(this.canvas);
    this.resize(container.clientWidth, container.clientHeight);
  }

  public resize(width: number, height: number) {
    this.width = Math.max(width, 1);
    this.height = Math.max(height, 1);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
  }

  public render(
    camera: THREE.Camera,
    cyphrGroup: THREE.Object3D | null,
    elapsed: number,
    inBridge: boolean,
    cyphrSpeaking: boolean
  ) {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    if (!inBridge || !cyphrGroup) return;

    // Project Cyphr's world figure envelope into 2D viewport coordinates
    cyphrGroup.getWorldPosition(this._worldBase);
    camera.getWorldDirection(this._camFwd);
    this._toHolo.copy(this._worldBase).add(new THREE.Vector3(0, 0.9, 0)).sub(camera.position);
    const dist = this._toHolo.length();
    if (dist < 0.6 || dist > 26) return;

    // Ensure hologram is in front of camera
    if (this._toHolo.dot(this._camFwd) <= 0.15) return;

    this._camRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
    this._worldMid.copy(this._worldBase).add(new THREE.Vector3(0, 0.92, 0));
    this._worldTop.copy(this._worldBase).add(new THREE.Vector3(0, 1.78, 0));
    this._worldLeft.copy(this._worldMid).addScaledVector(this._camRight, -0.42);
    this._worldRight.copy(this._worldMid).addScaledVector(this._camRight, 0.42);

    const toScreen = (v: THREE.Vector3) => {
      const p = v.clone().project(camera);
      return {
        x: (p.x * 0.5 + 0.5) * this.width,
        y: (-p.y * 0.5 + 0.5) * this.height,
        z: p.z,
      };
    };

    const sBase = toScreen(this._worldBase);
    const sTop = toScreen(this._worldTop);
    const sLeft = toScreen(this._worldLeft);
    const sRight = toScreen(this._worldRight);

    if (sBase.z > 1 || sTop.z > 1) return;

    const hPx = Math.abs(sBase.y - sTop.y);
    const wPx = Math.max(Math.abs(sRight.x - sLeft.x), hPx * 0.36);
    if (hPx < 24 || hPx > this.height * 1.4) return;

    const cx = (sBase.x + sTop.x) * 0.5;
    const cy = (sBase.y + sTop.y) * 0.5;
    const rx = wPx * 0.54;
    const ry = hPx * 0.52;

    // 12 Hz quantized Delta ink cadence
    const step12 = Math.floor(elapsed * 12.0);
    const hash12 = Math.sin(step12 * 12.9898) * 43758.5453;
    const frac12 = hash12 - Math.floor(hash12);
    const inkAlpha = 0.22 + frac12 * 0.12 + (cyphrSpeaking ? 0.1 : 0);

    ctx.save();

    // 1. Subtle 92-line fine 2D ink scanline veil tightly clipped to Cyphr's projected envelope
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.88, ry * 0.96, 0, 0, Math.PI * 2);
    ctx.clip();

    const lineStep = hPx / 92;
    if (lineStep >= 1.15) {
      ctx.strokeStyle = `rgba(12, 10, 32, ${(inkAlpha * 0.72).toFixed(3)})`;
      ctx.lineWidth = Math.max(0.65, lineStep * 0.24);
      const scrollPx = ((elapsed * 0.45) % 1) * lineStep;
      ctx.beginPath();
      for (let i = 0; i < 92; i++) {
        const ly = sTop.y + i * lineStep - scrollPx;
        ctx.moveTo(cx - rx, ly);
        ctx.lineTo(cx + rx, ly);
      }
      ctx.stroke();
    }

    ctx.restore();

    // 2. Crisp Delta 2D graphic ink contour arcs flanking Cyphr's holographic silhouette (zero text!)
    ctx.save();
    ctx.strokeStyle = `rgba(11, 9, 28, ${(inkAlpha + 0.16).toFixed(3)})`;
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 1.04, ry * 1.02, 0, -Math.PI * 0.32, Math.PI * 0.32);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 1.04, ry * 1.02, 0, Math.PI * 0.68, Math.PI * 1.32);
    ctx.stroke();

    // Delicate indigo-ink inner highlight hairlines syncing with 12 Hz flicker
    ctx.strokeStyle = `rgba(129, 140, 248, ${(inkAlpha * 0.65).toFixed(3)})`;
    ctx.lineWidth = 0.85;
    const tickH = Math.min(14, hPx * 0.08);
    ctx.beginPath();
    // Left vertical graphic registration ink marks
    ctx.moveTo(cx - rx * 1.12, sTop.y + tickH);
    ctx.lineTo(cx - rx * 1.12, sTop.y);
    ctx.lineTo(cx - rx * 0.92, sTop.y);
    // Right vertical graphic registration ink marks
    ctx.moveTo(cx + rx * 0.92, sBase.y);
    ctx.lineTo(cx + rx * 1.12, sBase.y);
    ctx.lineTo(cx + rx * 1.12, sBase.y - tickH);
    ctx.stroke();

    ctx.restore();
  }

  public dispose() {
    if (this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
    this.ctx = null;
  }
}

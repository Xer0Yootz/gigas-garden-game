import * as THREE from 'three/webgpu';
import {
  Fn,
  pass,
  mrt,
  output,
  emissive,
  luminance,
  screenUV,
  screenSize,
  vec2,
  vec4,
  float,
  color,
  abs,
  max,
  mix,
  smoothstep,
} from 'three/tsl';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import {
  AIRLOCK,
  BRIDGE,
  HudState,
  JumpTarget,
  SPAWN_POINTS,
  SUN_DIRECTION,
  ZoneId,
} from './types';
import { createWorldTextures, WorldTextureSet } from './textures';
import { createNVSkysphere, NVSkysphereRig } from './nvSkysphere';
import { createTealWaterPlain } from './water';
import { createSutroShoreWorld, terrainHeightAt } from './sutroShore';
import { createIKGGrid } from './ikgGrid';
import { createBridgeAndAirlock, BridgeAndAirlockRig } from './bridgeAndAirlock';
import { DeltaInkOverlay } from './nvHologram';
import { loadExternalWorldAssets, LoadedWorldAssets } from './externalAssets';
import { createPlayerAvatar, PlayerAvatarRig, resolvePlayerWorldStep } from './player';

function detectSoftwareGl(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export class SceneManager {
  private container: HTMLElement;
  private renderer: THREE.WebGPURenderer | null = null;
  private renderPipeline: THREE.RenderPipeline | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private exteriorFog: THREE.FogExp2;

  private textures: WorldTextureSet | null = null;
  private skyRig: NVSkysphereRig | null = null;
  private bridgeRig: BridgeAndAirlockRig | null = null;
  private externalAssets: LoadedWorldAssets | null = null;
  private playerRig: PlayerAvatarRig | null = null;
  private inkOverlay: DeltaInkOverlay | null = null;
  private envRT: THREE.RenderTarget | null = null;

  private isSoftwareGl: boolean;
  private disposed = false;
  private frameId = 0;
  private lastTime = 0;
  private elapsed = 0;

  // Continuous player & third-person follow camera state
  private playerPos = SPAWN_POINTS.bridge.pos.clone();
  private playerFacingYaw = 0;
  private camYaw = SPAWN_POINTS.bridge.yaw;
  private camPitch = SPAWN_POINTS.bridge.pitch;
  private desiredCamDist = 7.4; // Canon: ~7-8m behind, low angle
  private smoothCamPos = new THREE.Vector3(0, 11.4, 8.0);
  private smoothLookAt = new THREE.Vector3(0, 11.6, -10.0);

  // Input state (WASD + virtual joystick + mouse/touch drag)
  private keys = new Set<string>();
  private joyX = 0;
  private joyY = 0;
  private draggingLook = false;
  private activePointerId: number | null = null;
  private lastPointerX = 0;
  private lastPointerY = 0;

  // Canonical state synced to minimal HUD
  private currentZone: ZoneId = 'bridge';
  private cyphrSpeaking = false;
  private cyphrSpeechTimer = 0;
  private shipLoaded = false;
  private ruinsLoaded = false;
  private onHudChange: (state: HudState) => void;
  private onReady: () => void;

  // Reusable zero-GC math scratchpad
  private readonly _moveDir = new THREE.Vector3();
  private readonly _camTarget = new THREE.Vector3();
  private readonly _idealCam = new THREE.Vector3();

  constructor(
    container: HTMLElement,
    onHudChange: (state: HudState) => void,
    onReady: () => void
  ) {
    this.container = container;
    this.onHudChange = onHudChange;
    this.onReady = onReady;
    this.isSoftwareGl = detectSoftwareGl();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9e4b7c);
    // Cinematic dusk plum-rose atmospheric haze OUTSIDE only (density = 0 inside bridge so air stays crystal clear!)
    this.exteriorFog = new THREE.FogExp2(0x7c4674, 0.0);
    this.scene.fog = this.exteriorFog;

    const w = Math.max(container.clientWidth, 1);
    const h = Math.max(container.clientHeight, 1);
    this.camera = new THREE.PerspectiveCamera(56, w / h, 0.15, 2500);

    this.init().catch((err) => {
      console.error('Neon Vigil WebGPU init error:', err);
    });
  }

  private emitHud() {
    this.onHudChange({
      zone: this.currentZone,
      cyphrSpeaking: this.cyphrSpeaking,
      shipLoaded: this.shipLoaded,
      ruinsLoaded: this.ruinsLoaded,
    });
  }

  private async init() {
    const w = Math.max(this.container.clientWidth, 1);
    const h = Math.max(this.container.clientHeight, 1);

    const renderer = new THREE.WebGPURenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(w, h);
    renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = !this.isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    await renderer.init();
    if (this.disposed) {
      renderer.dispose();
      return;
    }

    this.renderer = renderer;
    this.container.appendChild(renderer.domElement);
    // Delta Hologram 2D ink overlay synced above the WebGPU canvas (pure graphic ink, zero UI chrome)
    this.inkOverlay = new DeltaInkOverlay(this.container);

    // Procedural studio environment reflections for light-reflective skylight dome & weathered metal/gunmetal
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
      this.scene.environment = this.envRT.texture;
      this.scene.environmentIntensity = 0.62;
      pmrem.dispose();
    } catch (e) {
      console.warn('PMREM skipped:', e);
    }

    this.textures = createWorldTextures(this.isSoftwareGl ? 2 : 8);

    // Build ONE continuous world: NV Skysphere (striped sun + pink-purple dome + drifting cloud strata),
    // FF7 Marine Teal Ocean, Brutalist Sutro Baths Shore + IKG Kyber Ground Grid, Bridge + Delta Cyphr + Airlock + Ramp
    this.setupWorldLights();
    this.skyRig = createNVSkysphere();
    this.scene.add(this.skyRig.group);
    this.scene.add(createTealWaterPlain());
    this.scene.add(createSutroShoreWorld(this.textures, this.isSoftwareGl));
    this.scene.add(createIKGGrid(terrainHeightAt));

    this.bridgeRig = createBridgeAndAirlock(this.textures);
    this.scene.add(this.bridgeRig.bridgeGroup);
    this.scene.add(this.bridgeRig.airlockGroup);
    this.scene.add(this.bridgeRig.rampGroup);

    // Load real GLB models at runtime (uniform scale only, never stretched)
    this.externalAssets = loadExternalWorldAssets(this.isSoftwareGl, terrainHeightAt, {
      onShipLoaded: () => {
        this.shipLoaded = true;
        this.syncZoneVisibility();
        this.emitHud();
      },
      onRuinsLoaded: () => {
        this.ruinsLoaded = true;
        this.emitHud();
      },
    });
    this.scene.add(this.externalAssets.shipRoot);
    this.scene.add(this.externalAssets.ruinsRoot);

    // Stylized 1.8m player avatar starting inside the bridge behind the command chair facing viewport
    this.playerRig = createPlayerAvatar();
    this.playerRig.root.position.copy(this.playerPos);
    this.scene.add(this.playerRig.root);

    this.syncZoneVisibility();
    this.snapCameraImmediate();

    // Neon Vigil WebGPU TSL RenderPipeline: TSL Toon-Outline Pass + MRT Selective Bloom
    if (!this.isSoftwareGl) {
      try {
        const rp = new THREE.RenderPipeline(renderer);
        const scenePass = pass(this.scene, this.camera);
        scenePass.setMRT(mrt({ output, emissive }));

        const sceneColor = scenePass.getTextureNode('output');
        const emissiveTex = scenePass.getTextureNode('emissive');
        const depthTex = scenePass.getTextureNode('depth');

        // 1. TSL Toon-Outline Pass: crisp foreground/midground depth-silhouette ink contours
        //    Gated away from far sky plane so the striped sun & luminous clouds stay completely pure
        const inkedScene = Fn(() => {
          const uv = screenUV;
          const texel = vec2(1.0).div(screenSize);
          const dc = depthTex.sample(uv).r;
          const dL = depthTex.sample(uv.add(vec2(texel.x.negate(), float(0.0)))).r;
          const dR = depthTex.sample(uv.add(vec2(texel.x, float(0.0)))).r;
          const dU = depthTex.sample(uv.add(vec2(float(0.0), texel.y))).r;
          const dD = depthTex.sample(uv.add(vec2(float(0.0), texel.y.negate()))).r;

          const grad = abs(dL.sub(dR)).add(abs(dU.sub(dD)));
          // Exclude sky dome / far background (depth >= 0.9994)
          const nearGate = smoothstep(0.9996, 0.9982, dc);
          const edgeMask = smoothstep(0.0018, 0.0065, grad).mul(nearGate);

          const base = sceneColor;
          const inkCol = color(0x090814);
          return vec4(mix(base.rgb, inkCol, edgeMask.mul(0.52)), base.a);
        })();

        // 2. Selective Bloom: MRT emissive channel (Cyphr Delta hologram, consoles, trim, IKG grid)
        //    plus HDR-only highlights (striped sun & blazing ocean sun glitter) — concrete & ink never bloom
        const selectiveSource = Fn(() => {
          const em = emissiveTex.rgb;
          const baseRgb = sceneColor.rgb;
          const hdrHighlight = baseRgb.mul(smoothstep(1.06, 1.38, luminance(baseRgb)));
          return vec4(max(em, hdrHighlight), float(1.0));
        })();

        const selectiveBloom = bloom(selectiveSource, 0.38, 0.5, 0.08);
        rp.outputNode = inkedScene.add(selectiveBloom);
        this.renderPipeline = rp;
      } catch (postErr) {
        console.warn('NV TSL RenderPipeline fallback to direct render:', postErr);
        this.renderPipeline = null;
      }
    }

    this.bindInputEvents(renderer.domElement);
    this.emitHud();
    this.onReady();

    this.lastTime = performance.now();
    this.tick();
  }

  private setupWorldLights() {
    // Cinematic FF7 twilight hemisphere: deep dusk rose-violet sky over moody marine-teal ground bounce
    const hemi = new THREE.HemisphereLight(0xc874a4, 0x0c3442, 0.68);
    this.scene.add(hemi);

    // Dramatic low-angle warm rose-amber solar key light carving deep brutalist shadows across shore & ship
    const sunKey = new THREE.DirectionalLight(0xffb09e, 2.85);
    sunKey.position.copy(SUN_DIRECTION).multiplyScalar(170);
    sunKey.castShadow = !this.isSoftwareGl;
    sunKey.shadow.mapSize.set(2048, 2048);
    sunKey.shadow.camera.near = 20;
    sunKey.shadow.camera.far = 360;
    const d = 105;
    sunKey.shadow.camera.left = -d;
    sunKey.shadow.camera.right = d;
    sunKey.shadow.camera.top = d;
    sunKey.shadow.camera.bottom = -d;
    sunKey.shadow.bias = -0.0005;
    sunKey.shadow.normalBias = 0.035;
    this.scene.add(sunKey);

    // Restrained cool Midgar steel-blue edge fill sculpting shadowed concrete & ship armor plates
    const shoreFill = new THREE.DirectionalLight(0x4c7c9e, 0.48);
    shoreFill.position.set(55, 42, 105);
    this.scene.add(shoreFill);
  }

  /**
   * Keeps one continuous coordinate world while ensuring zero exterior GLB polygons clip into the
   * playable bridge interior (or obstruct the 24m oval viewport), and zero interior shell boxes poke
   * outside the authentic infinity6-ship.glb silhouette when standing on the Sutro Baths shore.
   */
  private syncZoneVisibility() {
    const isInsideShip = this.currentZone !== 'exterior';
    if (this.externalAssets) {
      this.externalAssets.shipRoot.visible = !isInsideShip;
    }
    if (this.bridgeRig) {
      this.bridgeRig.bridgeGroup.visible = isInsideShip;
      this.bridgeRig.airlockGroup.visible = isInsideShip;
      this.bridgeRig.rampGroup.visible = true; // Ramp always visible connecting ship to shore apron
    }
  }

  private bindInputEvents(dom: HTMLCanvasElement) {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    dom.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handlePointerUp);
    dom.addEventListener('wheel', this.handleWheel, { passive: true });
    dom.addEventListener('contextmenu', this.preventContextMenu);
  }

  private preventContextMenu = (e: Event) => e.preventDefault();

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    this.keys.add(e.code);
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private handlePointerDown = (e: PointerEvent) => {
    // On touch devices, only right half of the screen triggers look-drag (left half reserved for virtual joystick)
    if (e.pointerType === 'touch' && e.clientX < window.innerWidth * 0.48) return;
    if (this.activePointerId !== null) return;
    this.activePointerId = e.pointerId;
    this.draggingLook = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (!this.draggingLook || e.pointerId !== this.activePointerId) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.addLookDelta(dx, dy);
  };

  private handlePointerUp = (e: PointerEvent) => {
    if (e.pointerId === this.activePointerId) {
      this.draggingLook = false;
      this.activePointerId = null;
    }
  };

  private handleWheel = (e: WheelEvent) => {
    this.desiredCamDist = THREE.MathUtils.clamp(
      this.desiredCamDist + e.deltaY * 0.004,
      4.5,
      11.5
    );
  };

  public addLookDelta(dx: number, dy: number) {
    this.camYaw -= dx * 0.0052;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + dy * 0.0042, -0.35, 0.58);
  }

  public setJoystickInput(x: number, y: number) {
    this.joyX = THREE.MathUtils.clamp(x, -1, 1);
    this.joyY = THREE.MathUtils.clamp(y, -1, 1);
  }

  public jumpTo(target: JumpTarget) {
    const sp = SPAWN_POINTS[target];
    this.playerPos.copy(sp.pos);
    this.camYaw = sp.yaw;
    this.camPitch = sp.pitch;
    this.playerFacingYaw = sp.yaw;
    this.desiredCamDist = target === 'bridge' ? 7.4 : 7.8;

    const resolved = resolvePlayerWorldStep(this.playerPos, this.playerPos.x, this.playerPos.z);
    this.playerPos.set(resolved.x, resolved.y, resolved.z);
    this.currentZone = resolved.zone;
    this.syncZoneVisibility();
    this.snapCameraImmediate();
    this.emitHud();
  }

  public resetCamera() {
    const preset = this.currentZone === 'exterior' ? SPAWN_POINTS.exterior : SPAWN_POINTS.bridge;
    this.camYaw = preset.yaw;
    this.camPitch = preset.pitch;
    this.desiredCamDist = this.currentZone === 'exterior' ? 7.8 : 7.4;
  }

  public triggerCyphrSpeech() {
    this.cyphrSpeaking = true;
    this.cyphrSpeechTimer = 5.5;
    this.emitHud();
  }

  private computeIdealCamera(outCam: THREE.Vector3, outLook: THREE.Vector3) {
    // Low-angle third-person follow camera ~7-8m behind player
    const lookY = this.playerPos.y + 1.55;
    outLook.set(this.playerPos.x, lookY, this.playerPos.z);

    // Direction from look target BACKWARD behind camera
    const cosP = Math.cos(this.camPitch);
    const backX = Math.sin(this.camYaw) * cosP;
    const backY = Math.sin(this.camPitch);
    const backZ = Math.cos(this.camYaw) * cosP;

    let dist = this.desiredCamDist;

    // Anti-clipping inside Bridge, Cyphr Bay & Airlock so camera NEVER clips behind walls or into consoles!
    if (this.currentZone === 'bridge') {
      const inBay = this.playerPos.x > 12.2;
      const minX = inBay ? 11.4 : -13.1;
      const maxX = inBay ? BRIDGE.width * 0.5 + 6.7 : 13.1;
      const minZ = inBay ? 1.2 : BRIDGE.zFront + 1.4;
      const maxZ = inBay ? 6.9 : BRIDGE.zBack - 0.6;
      const minY = BRIDGE.deckY + 1.15;
      const maxY = BRIDGE.deckY + (inBay ? 4.4 : BRIDGE.height - 0.7);

      // Ray-box distance clamping along camera boom
      const clampAxis = (origin: number, dir: number, lo: number, hi: number) => {
        if (dir > 0.0001) dist = Math.min(dist, Math.max(1.4, (hi - origin) / dir));
        else if (dir < -0.0001) dist = Math.min(dist, Math.max(1.4, (lo - origin) / dir));
      };
      clampAxis(outLook.x, backX, minX, maxX);
      clampAxis(outLook.y, backY, minY, maxY);
      clampAxis(outLook.z, backZ, minZ, maxZ);

      // Raise camera cleanly above dais consoles when looking low across the dais
      outCam.set(
        outLook.x + backX * dist,
        THREE.MathUtils.clamp(outLook.y + backY * dist + 0.35, minY, maxY),
        outLook.z + backZ * dist
      );
      // Slight forward look bias so the player sees straight out the 24m x 7m oval viewport!
      outLook.x -= Math.sin(this.camYaw) * 2.2;
      outLook.z -= Math.cos(this.camYaw) * 2.2;
      outLook.y += 0.22;
      return;
    }

    if (this.currentZone === 'airlock') {
      dist = Math.min(dist, 3.6);
      outCam.set(
        THREE.MathUtils.clamp(outLook.x + backX * dist, -(AIRLOCK.halfWidth - 0.45), AIRLOCK.halfWidth - 0.45),
        THREE.MathUtils.clamp(outLook.y + backY * dist + 0.25, AIRLOCK.deckY + 1.2, AIRLOCK.deckY + AIRLOCK.height - 0.55),
        outLook.z + backZ * dist
      );
      return;
    }

    // Exterior: Heroic low-angle Mythic GTA follow camera (~7.8m behind, gazing slightly upward at monumental ship & sky!)
    outCam.set(
      outLook.x + backX * dist,
      outLook.y + backY * dist + 0.15,
      outLook.z + backZ * dist
    );
    // Raise forward look bias gently so the towering Infinity 6 & huge luminous clouds dominate the sky frame
    outLook.x -= Math.sin(this.camYaw) * 3.2;
    outLook.z -= Math.cos(this.camYaw) * 3.2;
    outLook.y += 1.05;

    const groundAtCam = terrainHeightAt(outCam.x, outCam.z);
    if (outCam.y < groundAtCam + 1.05) {
      outCam.y = groundAtCam + 1.05;
    }
    if (outCam.y < 1.05) {
      outCam.y = 1.05;
    }
  }

  private snapCameraImmediate() {
    this.computeIdealCamera(this.smoothCamPos, this.smoothLookAt);
    this.camera.position.copy(this.smoothCamPos);
    this.camera.lookAt(this.smoothLookAt);
  }

  private handleResize = () => {
    if (!this.renderer || this.disposed) return;
    const w = Math.max(this.container.clientWidth, 1);
    const h = Math.max(this.container.clientHeight, 1);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.inkOverlay?.resize(w, h);
  };

  private tick = () => {
    if (this.disposed || !this.renderer) return;

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.08);
    this.lastTime = now;
    this.elapsed += dt;

    // 1. Gather movement input (Desktop WASD / Arrows + Mobile Virtual Joystick)
    let moveForward = -this.joyY; // joystick up (-1) = forward (+1)
    let moveRight = this.joyX;

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) moveForward += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) moveForward -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) moveRight += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) moveRight -= 1;

    const inputLen = Math.hypot(moveForward, moveRight);
    let moveSpeed = 0;

    if (inputLen > 0.04) {
      const clamped = Math.min(1, inputLen);
      const nf = (moveForward / inputLen) * clamped;
      const nr = (moveRight / inputLen) * clamped;

      // Forward vector from camera yaw (yaw = 0 points along -Z)
      const fwdX = -Math.sin(this.camYaw);
      const fwdZ = -Math.cos(this.camYaw);
      const rightX = Math.cos(this.camYaw);
      const rightZ = -Math.sin(this.camYaw);

      this._moveDir.set(fwdX * nf + rightX * nr, 0, fwdZ * nf + rightZ * nr);
      const walkRate = this.currentZone === 'exterior' ? 6.8 : 5.4;
      moveSpeed = walkRate * clamped;

      const stepX = this.playerPos.x + this._moveDir.x * walkRate * dt;
      const stepZ = this.playerPos.z + this._moveDir.z * walkRate * dt;

      const resolved = resolvePlayerWorldStep(this.playerPos, stepX, stepZ);
      this.playerPos.set(resolved.x, resolved.y, resolved.z);

      // Smoothly turn avatar toward walking direction
      const targetYaw = Math.atan2(-this._moveDir.x, -this._moveDir.z);
      let deltaYaw = targetYaw - this.playerFacingYaw;
      while (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2;
      while (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2;
      this.playerFacingYaw += deltaYaw * Math.min(1, dt * 11);

      if (resolved.zone !== this.currentZone) {
        this.currentZone = resolved.zone;
        this.syncZoneVisibility();
        this.emitHud();
      }
    }

    // Update avatar transform & walk cycle
    if (this.playerRig) {
      this.playerRig.root.position.copy(this.playerPos);
      this.playerRig.root.rotation.y = this.playerFacingYaw;
      this.playerRig.updateAnimation(dt, moveSpeed);
    }

    // 2. Cyphr ambient speaking timer (waveform at mouth ONLY while speaking; smooth blank face at rest)
    if (this.cyphrSpeechTimer > 0) {
      this.cyphrSpeechTimer -= dt;
      if (this.cyphrSpeechTimer <= 0) {
        this.cyphrSpeaking = false;
        this.emitHud();
      }
    }

    // 3. Update Bridge doors, Cyphr hologram, Airlock fog & slow drifting 3D cumulus clouds
    this.bridgeRig?.update(dt, this.elapsed, this.playerPos, this.cyphrSpeaking);
    this.skyRig?.update(dt);

    // 4. Enforce strict Fog rule: ZERO fog inside Bridge (density = 0), moody dusk haze OUTSIDE only!
    const targetFogDensity = this.currentZone === 'exterior' ? 0.00168 : 0.0;
    this.exteriorFog.density = THREE.MathUtils.damp(this.exteriorFog.density, targetFogDensity, 4.5, dt);

    // Subtle wide open-world FOV expansion outside (58.5° Mythic GTA vista vs 56° canon bridge)
    const targetFov = this.currentZone === 'exterior' ? 58.5 : 56.0;
    if (Math.abs(this.camera.fov - targetFov) > 0.02) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 4.0, dt);
      this.camera.updateProjectionMatrix();
    }

    // 5. Smooth third-person follow camera update
    this.computeIdealCamera(this._idealCam, this._camTarget);
    this.smoothCamPos.x = THREE.MathUtils.damp(this.smoothCamPos.x, this._idealCam.x, 9.5, dt);
    this.smoothCamPos.y = THREE.MathUtils.damp(this.smoothCamPos.y, this._idealCam.y, 9.5, dt);
    this.smoothCamPos.z = THREE.MathUtils.damp(this.smoothCamPos.z, this._idealCam.z, 9.5, dt);

    this.smoothLookAt.x = THREE.MathUtils.damp(this.smoothLookAt.x, this._camTarget.x, 11, dt);
    this.smoothLookAt.y = THREE.MathUtils.damp(this.smoothLookAt.y, this._camTarget.y, 11, dt);
    this.smoothLookAt.z = THREE.MathUtils.damp(this.smoothLookAt.z, this._camTarget.z, 11, dt);

    this.camera.position.copy(this.smoothCamPos);
    this.camera.lookAt(this.smoothLookAt);

    // 6. Render WebGPU frame + synced Delta 2D Ink Overlay
    if (this.renderPipeline) {
      this.renderPipeline.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    this.inkOverlay?.render(
      this.camera,
      this.bridgeRig?.cyphrGroup ?? null,
      this.elapsed,
      this.currentZone === 'bridge',
      this.cyphrSpeaking
    );

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(this.tick, 65);
    } else {
      this.frameId = window.requestAnimationFrame(this.tick);
    }
  };

  public dispose() {
    this.disposed = true;
    window.cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handlePointerUp);

    if (this.renderer) {
      const dom = this.renderer.domElement;
      dom.removeEventListener('pointerdown', this.handlePointerDown);
      dom.removeEventListener('wheel', this.handleWheel);
      dom.removeEventListener('contextmenu', this.preventContextMenu);
    }

    this.inkOverlay?.dispose();
    this.inkOverlay = null;
    this.externalAssets?.dispose();
    this.textures?.dispose();
    this.envRT?.dispose();

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material?.dispose();
        }
      }
    });

    if (this.renderer) {
      if (this.renderer.domElement.parentElement === this.container) {
        this.container.removeChild(this.renderer.domElement);
      }
      this.renderer.dispose();
      this.renderer = null;
    }
  }
}

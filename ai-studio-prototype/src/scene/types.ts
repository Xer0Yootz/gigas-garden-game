import * as THREE from 'three/webgpu';

export type ZoneId = 'bridge' | 'airlock' | 'exterior';
export type JumpTarget = 'bridge' | 'exterior';

export const ASSET_URLS = {
  shipGlb: 'https://xer0yootz.github.io/gigas-garden-game/gigas-garden/assets/infinity6-ship.glb',
  ruinsGlb: 'https://xer0yootz.github.io/gigas-garden-game/gigas-garden/assets/ruins-megastructures.glb',
} as const;

// Canon Deck 1 Upper (Bridge) dimensions & world placement:
// 30 m wide (X: -15..+15) × 24 m deep (Z: -14..+10) × 8 m ceiling (Y: 9.0..17.0)
export const BRIDGE = {
  deckY: 9.0,
  width: 30,
  depth: 24,
  height: 8.0,
  zFront: -14.0,
  zBack: 10.0,
  daisCenterZ: -2.0,
  daisRadius: 4.0,     // 8 m diameter circular command dais
  daisHeight: 0.54,    // 3 steps × 0.18 m
  consoleRadius: 3.0,  // 6 m across curved console arcs around the dais
  viewportWidth: 24.0,
  viewportHeight: 7.0,
  viewportCenterY: 13.05,
} as const;

// Airlock & Ramp connecting Bridge back door (z = 10) down to Sutro Baths shore apron (z = 42)
export const AIRLOCK = {
  zStart: 10.0,
  zEnd: 18.5,
  halfWidth: 3.4,
  height: 4.6,
  deckY: BRIDGE.deckY,
} as const;

export const RAMP = {
  zStart: 18.5,
  zEnd: 41.5,
  halfWidth: 2.8,
  yTop: BRIDGE.deckY,
  yBottom: 1.55,
} as const;

// Player canonical height 1.8 m; starts inside the bridge behind the command chair facing -Z viewport
export const PLAYER_HEIGHT = 1.8;

export const SPAWN_POINTS: Record<JumpTarget, { pos: THREE.Vector3; yaw: number; pitch: number }> = {
  bridge: {
    // Directly behind the fixed command chair (chair at z = -2.0), facing -Z out the 24m × 7m oval viewport
    pos: new THREE.Vector3(0, BRIDGE.deckY + BRIDGE.daisHeight, 0.75),
    yaw: 0,      // 0 = looking along -Z (open teal ocean, striped sun, drifting clouds)
    pitch: 0.05, // low angle keeping waves, sun, and drifting clouds all framed in the oval viewport
  },
  exterior: {
    // Heroic low-angle open-world framing on the Sutro Baths shore looking across the brutalist pools up at the monumental Infinity 6
    pos: new THREE.Vector3(-18.5, 1.85, 64.0),
    yaw: -0.28,   // sweeping diagonal view back toward Infinity 6, teal ocean, striped sun, and towering clouds
    pitch: -0.02, // low mythic angle giving the ship & luminous sky monumental presence
  },
};

// Large horizontal striped sun positioned low over the -Z open ocean (+6.2° elevation)
// Guaranteed visible simultaneously with animated teal ocean waves & drifting pink-purple clouds inside the oval viewport
export const SUN_DIRECTION = new THREE.Vector3(-0.04, 0.108, -0.993).normalize();

export interface HudState {
  zone: ZoneId;
  cyphrSpeaking: boolean;
  shipLoaded: boolean;
  ruinsLoaded: boolean;
}

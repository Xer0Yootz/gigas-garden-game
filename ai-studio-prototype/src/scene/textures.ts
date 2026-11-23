import * as THREE from 'three/webgpu';

export interface WorldTextureSet {
  gunmetalAlbedo: THREE.CanvasTexture;
  gunmetalRoughness: THREE.CanvasTexture;
  gunmetalBump: THREE.CanvasTexture;
  bridgeFloorAlbedo: THREE.CanvasTexture;
  bridgeFloorEmissive: THREE.CanvasTexture;
  bridgeFloorRoughness: THREE.CanvasTexture;
  consoleScreens: THREE.CanvasTexture[];
  stoneAlbedo: THREE.CanvasTexture;
  stoneRoughness: THREE.CanvasTexture;
  stoneBump: THREE.CanvasTexture;
  sandAlbedo: THREE.CanvasTexture;
  dispose: () => void;
}

function setupTex(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  aniso: number,
  rx = 1,
  ry = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.anisotropy = Math.max(1, Math.min(aniso, 16));
  tex.needsUpdate = true;
  return tex;
}

/**
 * One continuous graded near-black gunmetal / obsidian steel material for HULL & DOME
 * (floor, consoles, riser, dome ring). Zero text or logos.
 */
function createGunmetalSteel(aniso: number) {
  const size = 512;

  const albedo = document.createElement('canvas');
  albedo.width = size;
  albedo.height = size;
  const ctx = albedo.getContext('2d')!;

  const rough = document.createElement('canvas');
  rough.width = size;
  rough.height = size;
  const rCtx = rough.getContext('2d')!;

  const bump = document.createElement('canvas');
  bump.width = size;
  bump.height = size;
  const bCtx = bump.getContext('2d')!;

  // Smooth graded obsidian-gunmetal base
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#12151f');
  grad.addColorStop(0.5, '#191e2b');
  grad.addColorStop(1, '#10131c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  rCtx.fillStyle = '#5a5a5a';
  rCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  // Clean structural plate seams
  const grid = 4;
  const cell = size / grid;
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      const shade = (x + y) % 2 === 0 ? '#161a26' : '#121620';
      ctx.fillStyle = shade;
      ctx.fillRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4);

      rCtx.fillStyle = (x * 3 + y) % 2 === 0 ? '#505050' : '#666666';
      rCtx.fillRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4);

      ctx.strokeStyle = '#090b12';
      ctx.lineWidth = 3;
      ctx.strokeRect(x * cell + 1.5, y * cell + 1.5, cell - 3, cell - 3);

      bCtx.strokeStyle = '#2d2d2d';
      bCtx.lineWidth = 4;
      bCtx.strokeRect(x * cell + 1.5, y * cell + 1.5, cell - 3, cell - 3);
    }
  }

  // Fine brushed steel directional grain
  ctx.strokeStyle = 'rgba(160, 195, 235, 0.035)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 160; i++) {
    const y = (i * 3.2) % size;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  return {
    gunmetalAlbedo: setupTex(albedo, true, aniso, 4, 4),
    gunmetalRoughness: setupTex(rough, false, aniso, 4, 4),
    gunmetalBump: setupTex(bump, false, aniso, 4, 4),
  };
}

/**
 * Bridge floor with radial & concentric inlaid cyan (#00e5ff) and violet (#a855f7) circuit traces.
 * Matches Reference 1 and Reference 3. Zero text.
 */
function createBridgeFloorCircuits(aniso: number) {
  const size = 1024;

  const albedo = document.createElement('canvas');
  albedo.width = size;
  albedo.height = size;
  const ctx = albedo.getContext('2d')!;

  const emissive = document.createElement('canvas');
  emissive.width = size;
  emissive.height = size;
  const eCtx = emissive.getContext('2d')!;

  const rough = document.createElement('canvas');
  rough.width = size;
  rough.height = size;
  const rCtx = rough.getContext('2d')!;

  const cx = size / 2;
  const cy = size * 0.5;

  // Obsidian gunmetal floor base
  const bg = ctx.createRadialGradient(cx, cy, 40, cx, cy, size * 0.56);
  bg.addColorStop(0, '#181c29');
  bg.addColorStop(0.55, '#111520');
  bg.addColorStop(1, '#0b0d15');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, size, size);

  rCtx.fillStyle = '#4e4e4e';
  rCtx.fillRect(0, 0, size, size);

  // Subtle floor plating grooves
  const seamRadii = [155, 220, 305, 390, 468];
  for (const r of seamRadii) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#070910';
    ctx.lineWidth = 4;
    ctx.stroke();

    rCtx.beginPath();
    rCtx.arc(cx, cy, r, 0, Math.PI * 2);
    rCtx.strokeStyle = '#888888';
    rCtx.lineWidth = 5;
    rCtx.stroke();
  }

  // Concentric cyan & violet inlaid circuit rings
  const traceRings: Array<{ r: number; col: string; w: number; dash?: number[] }> = [
    { r: 175, col: '#00e5ff', w: 3 },
    { r: 235, col: '#9d4edd', w: 2.5, dash: [42, 16] },
    { r: 256, col: '#00d4ff', w: 2 },
    { r: 325, col: '#b55cff', w: 3 },
    { r: 350, col: '#00e5ff', w: 2, dash: [28, 12] },
    { r: 418, col: '#00d9ff', w: 2.5 },
    { r: 440, col: '#c04dff', w: 2.5, dash: [56, 20] },
  ];

  for (const tr of traceRings) {
    for (const target of [ctx, eCtx]) {
      target.save();
      if (tr.dash) target.setLineDash(tr.dash);
      target.beginPath();
      target.arc(cx, cy, tr.r, 0, Math.PI * 2);
      target.strokeStyle = tr.col;
      target.lineWidth = tr.w;
      target.stroke();
      target.restore();
    }
  }

  // Radial PCB-like circuit traces with crisp 45-degree jogs radiating from central dais
  const spokes = 20;
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    const isCyan = i % 2 === 0;
    const col = isCyan ? '#00e5ff' : '#a855f7';
    const r0 = 148;
    const rMid = 265 + (i % 3) * 35;
    const rEnd = 475;
    const jog = (i % 2 === 0 ? 1 : -1) * 0.06;

    for (const target of [ctx, eCtx]) {
      target.beginPath();
      target.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      target.lineTo(cx + Math.cos(a) * rMid, cy + Math.sin(a) * rMid);
      target.lineTo(cx + Math.cos(a + jog) * (rMid + 26), cy + Math.sin(a + jog) * (rMid + 26));
      target.lineTo(cx + Math.cos(a + jog) * rEnd, cy + Math.sin(a + jog) * rEnd);
      target.strokeStyle = col;
      target.lineWidth = 2.5;
      target.stroke();

      // Tiny circuit node dot
      target.fillStyle = isCyan ? '#7bf4ff' : '#e0aaff';
      target.beginPath();
      target.arc(
        cx + Math.cos(a + jog) * (rMid + 26),
        cy + Math.sin(a + jog) * (rMid + 26),
        4,
        0,
        Math.PI * 2
      );
      target.fill();
    }
  }

  return {
    bridgeFloorAlbedo: setupTex(albedo, true, aniso, 1, 1),
    bridgeFloorEmissive: setupTex(emissive, true, aniso, 1, 1),
    bridgeFloorRoughness: setupTex(rough, false, aniso, 1, 1),
  };
}

/**
 * Abstract geometric console readouts (rings, arcs, waveforms, bar meters).
 * STRICTLY ZERO words, letters, numbers, or logos on any in-world surface.
 */
function createAbstractConsoleScreen(variant: number, aniso: number): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#070e1c');
  bg.addColorStop(1, '#0a1930');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Fine grid
  ctx.strokeStyle = 'rgba(0, 224, 255, 0.1)';
  ctx.lineWidth = 1;
  for (let x = 24; x < w; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 12);
    ctx.lineTo(x, h - 12);
    ctx.stroke();
  }
  for (let y = 24; y < h; y += 32) {
    ctx.beginPath();
    ctx.moveTo(12, y);
    ctx.lineTo(w - 12, y);
    ctx.stroke();
  }

  // Border frame
  ctx.strokeStyle = 'rgba(0, 232, 255, 0.72)';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(10, 10, w - 20, h - 20);

  if (variant === 0) {
    // Concentric orbital rings + violet harmonic arc + bar columns
    const cx = 148;
    const cy = h / 2;
    const rings = [74, 56, 36, 18];
    rings.forEach((r, idx) => {
      ctx.strokeStyle = idx === 1 ? '#b366ff' : '#18e8ff';
      ctx.lineWidth = idx === 0 ? 3.5 : 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, idx * 0.6, Math.PI * 1.7 + idx * 0.4);
      ctx.stroke();
    });

    // Tiny orange status pinpoint
    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.arc(cx + 56, cy - 18, 5, 0, Math.PI * 2);
    ctx.fill();

    // Right abstract segment bars
    for (let i = 0; i < 6; i++) {
      const y = 38 + i * 32;
      ctx.fillStyle = 'rgba(24, 232, 255, 0.14)';
      ctx.fillRect(268, y, 212, 16);
      const frac = [0.84, 0.62, 0.91, 0.55, 0.78, 0.69][i];
      ctx.fillStyle = i % 3 === 1 ? '#c084fc' : '#22e5ff';
      ctx.fillRect(268, y, 212 * frac, 16);
    }
  } else if (variant === 1) {
    // Dual circular radar rings & crosshairs
    const centers = [142, 370];
    centers.forEach((cx, idx) => {
      const cy = h / 2;
      ctx.strokeStyle = idx === 0 ? '#22e5ff' : '#c084fc';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, 68, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(34, 229, 255, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 42, 0, Math.PI * 2);
      ctx.stroke();

      // Crosshair ticks
      ctx.beginPath();
      ctx.moveTo(cx - 80, cy);
      ctx.lineTo(cx - 22, cy);
      ctx.moveTo(cx + 22, cy);
      ctx.lineTo(cx + 80, cy);
      ctx.moveTo(cx, cy - 80);
      ctx.lineTo(cx, cy - 22);
      ctx.moveTo(cx, cy + 22);
      ctx.lineTo(cx, cy + 80);
      ctx.stroke();
    });
    // Center orange status dot
    ctx.fillStyle = '#f97316';
    ctx.fillRect(w / 2 - 5, h / 2 - 5, 10, 10);
  } else if (variant === 2) {
    // Layered cyan & violet harmonic sine waves
    const drawWave = (amp: number, freq: number, phase: number, y0: number, col: string) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 24; x <= w - 24; x += 6) {
        const t = (x - 24) / (w - 48);
        const y = y0 + Math.sin(t * Math.PI * freq + phase) * amp;
        if (x === 24) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    drawWave(28, 6, 0, 104, '#22e5ff');
    drawWave(20, 10, 1.4, 148, '#c084fc');
    drawWave(12, 14, 2.7, 192, 'rgba(34, 229, 255, 0.6)');
  } else {
    // Segmented arc gauge + matrix dots
    const cx = w / 2;
    const cy = 148;
    for (let i = 0; i < 12; i++) {
      const a0 = Math.PI * 1.05 + i * 0.23;
      const a1 = a0 + 0.16;
      ctx.strokeStyle = i > 8 ? '#e879f9' : '#22e5ff';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(cx, cy, 86, a0, a1);
      ctx.stroke();
    }
    ctx.strokeStyle = '#7bf4ff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 52, Math.PI, Math.PI * 2);
    ctx.stroke();

    // Small glowing matrix pins at bottom
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = i === 11 ? '#f97316' : i % 3 === 0 ? '#c084fc' : '#22e5ff';
      ctx.fillRect(62 + i * 28, 206, 16, 12);
    }
  }

  // Subtle CRT scanlines
  ctx.fillStyle = 'rgba(0, 8, 20, 0.24)';
  for (let y = 0; y < h; y += 4) {
    ctx.fillRect(0, y, w, 1.5);
  }

  return setupTex(canvas, true, aniso, 1, 1);
}

function createWeatheredStone(aniso: number) {
  const size = 512;

  const albedo = document.createElement('canvas');
  albedo.width = size;
  albedo.height = size;
  const ctx = albedo.getContext('2d')!;

  const rough = document.createElement('canvas');
  rough.width = size;
  rough.height = size;
  const rCtx = rough.getContext('2d')!;

  const bump = document.createElement('canvas');
  bump.width = size;
  bump.height = size;
  const bCtx = bump.getContext('2d')!;

  // Grounded FF7 Midgar brutalist poured concrete base (heavy industrial grey-slate with real weight)
  ctx.fillStyle = '#3f444f';
  ctx.fillRect(0, 0, size, size);

  rCtx.fillStyle = '#d4d4d4';
  rCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  // Monumental horizontal poured-concrete formwork lift bands (thick heavy slabs with gritty aggregate)
  const lifts = 4;
  const liftH = size / lifts;
  for (let r = 0; r < lifts; r++) {
    const y = r * liftH;
    const tone = ['#434854', '#393e4a', '#484c56', '#353a46'][r % 4];
    ctx.fillStyle = tone;
    ctx.fillRect(0, y, size, liftH);

    // Subtle wood-plank formwork impressions inside each brutalist pour
    ctx.fillStyle = 'rgba(12, 15, 22, 0.22)';
    bCtx.fillStyle = '#626262';
    for (let b = 1; b < 4; b++) {
      const by = y + (liftH / 4) * b;
      ctx.fillRect(0, by, size, 2);
      bCtx.fillRect(0, by, size, 2);
    }

    // Deep recessed horizontal cold-joint seam between concrete pours
    ctx.fillStyle = 'rgba(10, 12, 18, 0.72)';
    ctx.fillRect(0, y, size, 6);
    bCtx.fillStyle = '#242424';
    bCtx.fillRect(0, y, size, 6);
    rCtx.fillStyle = '#f0f0f0';
    rCtx.fillRect(0, y, size, 6);

    ctx.fillStyle = 'rgba(165, 172, 184, 0.12)';
    ctx.fillRect(0, y + 6, size, 2);
    bCtx.fillStyle = '#a4a4a4';
    bCtx.fillRect(0, y + 6, size, 2);

    // Brutalist recessed tie-rod cone holes with rust-iron runoff streaks beneath
    for (let c = 0; c < 4; c++) {
      const tx = (c + 0.5) * (size / 4);
      const ty = y + liftH * 0.5;

      // Vertical coastal rust / mineral stain trailing down from tie-rod bolts
      const stain = ctx.createLinearGradient(tx, ty, tx, ty + 48);
      stain.addColorStop(0, 'rgba(66, 38, 28, 0.44)');
      stain.addColorStop(1, 'rgba(32, 24, 24, 0.0)');
      ctx.fillStyle = stain;
      ctx.fillRect(tx - 4, ty, 8, 48);

      ctx.fillStyle = 'rgba(8, 10, 16, 0.78)';
      ctx.beginPath();
      ctx.arc(tx, ty, 5.5, 0, Math.PI * 2);
      ctx.fill();

      bCtx.fillStyle = '#1a1a1a';
      bCtx.beginPath();
      bCtx.arc(tx, ty, 6.0, 0, Math.PI * 2);
      bCtx.fill();
    }
  }

  // Vertical monolithic expansion joints
  for (let v = 0; v < 2; v++) {
    const vx = (v + 0.5) * (size / 2);
    ctx.fillStyle = 'rgba(10, 12, 18, 0.62)';
    ctx.fillRect(vx, 0, 4, size);
    bCtx.fillStyle = '#2a2a2a';
    bCtx.fillRect(vx, 0, 4, size);
  }

  // Weathered aggregate pitting, spalled patches & damp mineral runoff streaks
  for (let i = 0; i < 220; i++) {
    const x = (i * 89 + (i % 7) * 19) % size;
    const y = (i * 131 + (i % 5) * 23) % size;
    const w = 6 + (i % 22);
    const h = 14 + (i % 54);

    if (i % 4 === 0) {
      // Damp mossy/sea-salt dark streak (slightly slicker roughness)
      ctx.fillStyle = 'rgba(14, 30, 38, 0.24)';
      ctx.fillRect(x, y, w, h);
      rCtx.fillStyle = '#9c9c9c';
      rCtx.fillRect(x, y, w, h);
    } else if (i % 5 === 0) {
      // Weathered pale limestone/salt mineral efflorescence
      ctx.fillStyle = 'rgba(162, 168, 178, 0.09)';
      ctx.fillRect(x, y, w * 0.8, h * 0.7);
      bCtx.fillStyle = '#969696';
      bCtx.fillRect(x, y, 4, 4);
    } else {
      // Pitted aggregate micro-grit
      ctx.fillStyle = 'rgba(14, 16, 22, 0.22)';
      ctx.fillRect(x, y, 3 + (i % 4), 3 + (i % 4));
      bCtx.fillStyle = i % 2 === 0 ? '#5c5c5c' : '#9c9c9c';
      bCtx.fillRect(x, y, 3, 3);
    }
  }

  return {
    stoneAlbedo: setupTex(albedo, true, aniso, 2, 1.5),
    stoneRoughness: setupTex(rough, false, aniso, 2, 1.5),
    stoneBump: setupTex(bump, false, aniso, 2, 1.5),
  };
}

function createVolcanicSand(aniso: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1a1e28';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 620; i++) {
    const x = (i * 97) % size;
    const y = (i * 53) % size;
    const r = 1.5 + (i % 8);
    ctx.fillStyle =
      i % 3 === 0
        ? 'rgba(48, 54, 68, 0.30)'
        : i % 3 === 1
          ? 'rgba(10, 14, 22, 0.38)'
          : 'rgba(28, 44, 52, 0.22)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return setupTex(canvas, true, aniso, 16, 16);
}

export function createWorldTextures(aniso: number): WorldTextureSet {
  const gunmetal = createGunmetalSteel(aniso);
  const floor = createBridgeFloorCircuits(aniso);
  const consoleScreens = [0, 1, 2, 3].map((v) => createAbstractConsoleScreen(v, aniso));
  const stone = createWeatheredStone(aniso);
  const sandAlbedo = createVolcanicSand(aniso);

  return {
    ...gunmetal,
    ...floor,
    consoleScreens,
    ...stone,
    sandAlbedo,
    dispose: () => {
      gunmetal.gunmetalAlbedo.dispose();
      gunmetal.gunmetalRoughness.dispose();
      gunmetal.gunmetalBump.dispose();
      floor.bridgeFloorAlbedo.dispose();
      floor.bridgeFloorEmissive.dispose();
      floor.bridgeFloorRoughness.dispose();
      consoleScreens.forEach((t) => t.dispose());
      stone.stoneAlbedo.dispose();
      stone.stoneRoughness.dispose();
      stone.stoneBump.dispose();
      sandAlbedo.dispose();
    },
  };
}

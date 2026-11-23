import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  Compass,
  Gamepad2,
  Menu,
  RotateCcw,
  Waves,
  X,
} from 'lucide-react';
import { SceneManager } from './scene/SceneManager';
import { HudState, JumpTarget } from './scene/types';
import { VirtualJoystick } from './components/VirtualJoystick';

type LocationRealm = 'ship' | 'shore';

interface TitleCardState {
  primary: string;
  secondary: string;
  visible: boolean;
  seq: number;
}

function detectTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0
  );
}

const REALM_TITLES: Record<LocationRealm, { primary: string; secondary: string }> = {
  ship: {
    primary: 'INFINITY 6',
    secondary: 'THE BRIDGE',
  },
  shore: {
    primary: 'GIGAS GARDEN',
    secondary: 'SUTRO BATHS SHORE',
  },
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const managerRef = useRef<SceneManager | null>(null);
  const lastRealmRef = useRef<LocationRealm | null>(null);
  const fadeTimerRef = useRef<number | null>(null);

  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showJoystick, setShowJoystick] = useState<boolean>(() => detectTouchDevice());
  const [hud, setHud] = useState<HudState>({
    zone: 'bridge',
    cyphrSpeaking: false,
    shipLoaded: false,
    ruinsLoaded: false,
  });

  const [titleCard, setTitleCard] = useState<TitleCardState>({
    primary: REALM_TITLES.ship.primary,
    secondary: REALM_TITLES.ship.secondary,
    visible: false,
    seq: 0,
  });

  const showRealmTitle = useCallback((realm: LocationRealm) => {
    if (fadeTimerRef.current !== null) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }

    const copy = REALM_TITLES[realm];
    setTitleCard((prev) => ({
      primary: copy.primary,
      secondary: copy.secondary,
      visible: true,
      seq: prev.seq + 1,
    }));

    // Hold for ~2.6 seconds, then fade away completely until the next crossing
    fadeTimerRef.current = window.setTimeout(() => {
      setTitleCard((prev) => ({ ...prev, visible: false }));
      fadeTimerRef.current = null;
    }, 2600);
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const manager = new SceneManager(
      container,
      (nextHud) => setHud(nextHud),
      () => setReady(true)
    );
    managerRef.current = manager;

    return () => {
      if (fadeTimerRef.current !== null) {
        window.clearTimeout(fadeTimerRef.current);
      }
      manager.dispose();
      managerRef.current = null;
    };
  }, []);

  // Trigger stylized fading title card on start (once ready) and on every ship <-> shore crossing
  useEffect(() => {
    if (!ready) return;
    const realm: LocationRealm = hud.zone === 'exterior' ? 'shore' : 'ship';
    if (lastRealmRef.current !== realm) {
      lastRealmRef.current = realm;
      showRealmTitle(realm);
    }
  }, [ready, hud.zone, showRealmTitle]);

  // Bench keyboard shortcuts: 1 = Bridge, 2 = Exterior, R = Reset Camera
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '1') managerRef.current?.jumpTo('bridge');
      else if (e.key === '2') managerRef.current?.jumpTo('exterior');
      else if (e.key.toLowerCase() === 'r') managerRef.current?.resetCamera();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleJoystick = useCallback((x: number, y: number) => {
    managerRef.current?.setJoystickInput(x, y);
  }, []);

  const handleJump = (target: JumpTarget) => {
    managerRef.current?.jumpTo(target);
    setMenuOpen(false);
  };

  const handleResetCamera = () => {
    managerRef.current?.resetCamera();
  };

  const handleCyphrPing = () => {
    managerRef.current?.triggerCyphrSpeech();
    setMenuOpen(false);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0b0c14] text-[#e5f5ff]">
      {/* Isolated WebGPU 3D Canvas Container */}
      <div
        ref={mountRef}
        className="absolute inset-0 h-full w-full"
        aria-label="Neon Vigil: Gigas Garden 3D World"
      />

      {/* Minimal pre-first-frame typography screen (no boxes or pills) */}
      {!ready && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#0b0c14]">
          <p className="text-sm font-medium tracking-[0.34em] text-cyan-200/85 uppercase">
            Neon Vigil: Gigas Garden
          </p>
        </div>
      )}

      {/* TRANSIENT STYLIZED ENTRY / CROSSING TITLE — pure typography on transparent, fades away cleanly */}
      <div
        aria-live="polite"
        className={`pointer-events-none fixed inset-0 z-10 flex flex-col items-center justify-center px-6 text-center transition-opacity ease-out ${
          titleCard.visible ? 'opacity-100 duration-500' : 'opacity-0 duration-1000'
        }`}
      >
        <h1
          className="text-3xl sm:text-5xl font-light tracking-[0.42em] pl-[0.42em] text-white/95"
          style={{
            textShadow:
              '0 2px 24px rgba(8, 12, 24, 0.72), 0 0 36px rgba(34, 211, 238, 0.28)',
          }}
        >
          {titleCard.primary}
        </h1>
        <div className="my-3 flex items-center gap-3 opacity-80" aria-hidden="true">
          <span className="h-px w-10 bg-gradient-to-r from-transparent to-cyan-300/80" />
          <span className="h-1.5 w-1.5 rotate-45 bg-[#facc15]" />
          <span className="h-px w-10 bg-gradient-to-l from-transparent to-cyan-300/80" />
        </div>
        <p
          className="text-xs sm:text-sm font-normal tracking-[0.36em] pl-[0.36em] text-cyan-200/90"
          style={{
            textShadow: '0 2px 16px rgba(8, 12, 24, 0.85)',
          }}
        >
          {titleCard.secondary}
        </p>
      </div>

      {/* BOTTOM-LEFT: Touch virtual joystick (icon/pad only, no text labels) */}
      {showJoystick && (
        <div className="fixed bottom-5 left-5 z-10">
          <VirtualJoystick onChange={handleJoystick} />
        </div>
      )}

      {/* BOTTOM-RIGHT: Low-key circular glass icon buttons ONLY (no text labels on controls) */}
      <div className="fixed right-5 bottom-5 z-10 flex flex-col items-end gap-2.5">
        {menuOpen && (
          <div
            role="dialog"
            aria-label="Neon Vigil: Gigas Garden"
            className="nv-glass mb-1 flex flex-col items-center gap-3 rounded-2xl px-3.5 py-3"
          >
            {/* In-app title header inside options popover */}
            <div className="flex w-full items-center justify-between gap-4 border-b border-cyan-300/15 pb-2">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rotate-45 bg-[#facc15] shrink-0" aria-hidden="true" />
                <span className="text-[10px] tracking-[0.18em] text-cyan-100/90 whitespace-nowrap uppercase">
                  Neon Vigil: Gigas Garden
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close"
                title="Close"
                className="flex h-6 w-6 items-center justify-center rounded-full text-cyan-200/70 transition-colors hover:text-white"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            {/* Icon-only interactive affordances: Bridge, Exterior, Cyphr, Touch Joystick */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleJump('bridge')}
                aria-label="Infinity 6 — The Bridge"
                title="Infinity 6 — The Bridge"
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 ${
                  hud.zone !== 'exterior'
                    ? 'border border-cyan-300/80 bg-cyan-400/20 text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.28)]'
                    : 'nv-glass-btn text-cyan-200/80 hover:text-white'
                }`}
              >
                <Compass className="h-4 w-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => handleJump('exterior')}
                aria-label="Gigas Garden — Sutro Baths Shore"
                title="Gigas Garden — Sutro Baths Shore"
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 ${
                  hud.zone === 'exterior'
                    ? 'border border-cyan-300/80 bg-cyan-400/20 text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.28)]'
                    : 'nv-glass-btn text-cyan-200/80 hover:text-white'
                }`}
              >
                <Waves className="h-4 w-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={handleCyphrPing}
                aria-label="Cyphr"
                title="Cyphr"
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 ${
                  hud.cyphrSpeaking
                    ? 'border border-cyan-300/80 bg-cyan-400/20 text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.28)]'
                    : 'nv-glass-btn text-cyan-200/80 hover:text-white'
                }`}
              >
                <AudioLines className="h-4 w-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => setShowJoystick((v) => !v)}
                aria-label="Toggle Joystick"
                title="Toggle Joystick"
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 ${
                  showJoystick
                    ? 'border border-cyan-300/70 bg-cyan-400/18 text-cyan-100'
                    : 'nv-glass-btn text-cyan-200/75 hover:text-white'
                }`}
              >
                <Gamepad2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleResetCamera}
            aria-label="Reset camera"
            title="Reset camera"
            className="nv-glass-btn flex h-10 w-10 items-center justify-center rounded-full text-cyan-200/85 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Options"
            aria-expanded={menuOpen}
            title="Options"
            className="nv-glass-btn flex h-10 w-10 items-center justify-center rounded-full text-cyan-200/85 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

import { useRef, useState } from 'react';

interface VirtualJoystickProps {
  onChange: (x: number, y: number) => void;
}

const RADIUS = 44;

export function VirtualJoystick({ onChange }: VirtualJoystickProps) {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  const updateFromClient = (clientX: number, clientY: number) => {
    const el = baseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > RADIUS) {
      dx = (dx / dist) * RADIUS;
      dy = (dy / dist) * RADIUS;
    }
    setKnob({ x: dx, y: dy });
    onChange(dx / RADIUS, dy / RADIUS);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerIdRef.current = e.pointerId;
    setActive(true);
    updateFromClient(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    updateFromClient(e.clientX, e.clientY);
  };

  const resetStick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    pointerIdRef.current = null;
    setActive(false);
    setKnob({ x: 0, y: 0 });
    onChange(0, 0);
  };

  return (
    <div
      ref={baseRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={resetStick}
      onPointerCancel={resetStick}
      role="slider"
      aria-label="Movement Joystick"
      aria-valuetext={`${Math.round(knob.x)}, ${Math.round(knob.y)}`}
      className="nv-glass relative flex h-28 w-28 items-center justify-center rounded-full touch-none select-none"
    >
      {/* Inner cyan compass ring */}
      <div
        className="pointer-events-none absolute inset-3 rounded-full border border-cyan-300/25"
        aria-hidden="true"
      />
      {/* Directional micro-ticks */}
      <div className="pointer-events-none absolute top-2 h-1.5 w-0.5 bg-cyan-300/45" aria-hidden="true" />
      <div className="pointer-events-none absolute bottom-2 h-1.5 w-0.5 bg-cyan-300/45" aria-hidden="true" />
      <div className="pointer-events-none absolute left-2 h-0.5 w-1.5 bg-cyan-300/45" aria-hidden="true" />
      <div className="pointer-events-none absolute right-2 h-0.5 w-1.5 bg-cyan-300/45" aria-hidden="true" />

      {/* Draggable thumb nub */}
      <div
        style={{
          transform: `translate3d(${knob.x}px, ${knob.y}px, 0)`,
        }}
        className={`pointer-events-none h-11 w-11 rounded-full border transition-colors ${
          active
            ? 'border-cyan-300 bg-cyan-400/35 shadow-[0_0_16px_rgba(34,211,238,0.45)]'
            : 'border-cyan-300/60 bg-[#3c3a4c]/90'
        }`}
      />
    </div>
  );
}

import { useMemo } from 'react';

const CODE = ['0x7F', 'IKG', 'HEX', 'NODE', '0xA3', 'SYNC', 'GRID', '0x1C', 'OPEN', '0xE9'];

function HexOsMark() {
  return (
    <svg className="hex-os-mark flourish-mark" viewBox="0 0 64 64" aria-hidden="true">
      <polygon points="32,4 56,18 56,46 32,60 8,46 8,18" fill="none" stroke="currentColor" strokeWidth="3" />
      <polygon points="32,16 46,24 46,40 32,48 18,40 18,24" fill="currentColor" />
    </svg>
  );
}

export default function Flourish() {
  const voxels = useMemo(() => Array.from({ length: 28 }, (_, index) => {
    const angle = (index / 28) * Math.PI * 2;
    const distance = 90 + (index % 5) * 28;
    return {
      id: `v-${index}`,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      delay: (index % 7) * 0.06,
      size: 6 + (index % 3) * 3
    };
  }), []);

  const fragments = useMemo(() => Array.from({ length: 12 }, (_, index) => {
    const angle = (index / 12) * Math.PI * 2 + 0.2;
    const distance = 120 + (index % 4) * 24;
    return {
      id: `c-${index}`,
      text: CODE[index % CODE.length],
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      delay: 0.12 + (index % 6) * 0.05
    };
  }), []);

  return (
    <main className="flourish-shell" aria-label="Entering virtual reality construct">
      <div className="flourish-stage">
        {voxels.map((voxel) => (
          <span
            key={voxel.id}
            className="voxel"
            style={{
              '--x': `${voxel.x}px`,
              '--y': `${voxel.y}px`,
              '--delay': `${voxel.delay}s`,
              width: voxel.size,
              height: voxel.size
            }}
          />
        ))}
        {fragments.map((fragment) => (
          <span
            key={fragment.id}
            className="code-fragment"
            style={{
              '--x': `${fragment.x}px`,
              '--y': `${fragment.y}px`,
              '--delay': `${fragment.delay}s`
            }}
          >
            {fragment.text}
          </span>
        ))}
        <HexOsMark />
      </div>
      <p className="flourish-line">Entering virtual reality construct</p>
    </main>
  );
}

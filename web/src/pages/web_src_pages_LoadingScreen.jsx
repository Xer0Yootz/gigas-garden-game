import { useState } from 'react';

const LINES = [
  'Hex operating system loading',
  'Logging in to the IKG',
  'Reading the local node',
  'Holding the line'
];

function HexOsMark() {
  return (
    <svg className="hex-os-mark" viewBox="0 0 64 64" aria-label="Hex OS" role="img">
      <polygon
        points="32,4 56,18 56,46 32,60 8,46 8,18"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />
      <polygon
        points="32,16 46,24 46,40 32,48 18,40 18,24"
        fill="currentColor"
      />
    </svg>
  );
}

export default function LoadingScreen({ progress = 0, label = 'Hex operating system loading', onSkip }) {
  const [lineIndex, setLineIndex] = useState(0);
  const width = Math.max(0, Math.min(100, progress));

  function cycleLine() {
    setLineIndex((index) => (index + 1) % LINES.length);
  }

  return (
    <main className="loading-shell">
      <div className="loading-content">
        <div className="hexa-intro">
          <button type="button" className="hexa-button" onClick={cycleLine} aria-label="Hex OS">
            <HexOsMark />
          </button>
          <p className="hexa-speak">{LINES[lineIndex]}</p>
        </div>

        <div className="loading-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={width}>
          <div className="loading-progress" style={{ width: `${width}%` }}></div>
        </div>

        <p className="loading-text">{label}</p>
        <p className="loading-percent">{width}%</p>

        <button type="button" className="btn ghost" onClick={onSkip} disabled={!onSkip}>
          Skip
        </button>
      </div>
    </main>
  );
}

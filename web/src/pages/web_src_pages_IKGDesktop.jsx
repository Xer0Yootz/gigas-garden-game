import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../icons.jsx';

const ICONS = [
  { id: 'garden', label: 'GARDEN.EXE', icon: 'globe', action: 'garden' },
  { id: 'queen', label: 'QUEEN.SYS', icon: 'hex', action: 'queen' },
  { id: 'threshold', label: 'THRESHOLD.COM', icon: 'image-off', action: 'sutro' },
  { id: 'six', label: 'SIX.HULL', icon: 'repos', action: 'hull' },
  { id: 'hexa', label: 'HEXA.VXD', icon: 'hex', action: 'hexa' },
  { id: 'specimen', label: 'SPECIMEN.IDX', icon: 'avatar', action: 'specimen' },
  { id: 'character', label: 'CHARACTER.SYS', icon: 'avatar', action: 'character' }
];

export default function IKGDesktop({ user, character }) {
  const [openWindow, setOpenWindow] = useState(null);
  const [hexaGreet, setHexaGreet] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setHexaGreet(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  const open = (action) => setOpenWindow(action);
  const close = () => setOpenWindow(null);

  return (
    <div className="iww-desktop" style={{
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(180deg, #008080 0%, #004040 100%)',
      fontFamily: 'Tahoma, MS Sans Serif, sans-serif',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {hexaGreet && (
        <div style={{
          position: 'absolute',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#c0c0c0',
          border: '2px solid #fff',
          borderBottomColor: '#000',
          borderRightColor: '#000',
          padding: 8,
          zIndex: 100,
          boxShadow: '2px 2px 0 #000'
        }}>
          Hexa Sigil Online.
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', padding: 16, gap: 24 }}>
        {ICONS.map((icon) => (
          <button
            key={icon.id}
            onClick={() => open(icon.action)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              textAlign: 'center',
              width: 72,
              cursor: 'pointer',
              fontSize: 11
            }}
          >
            <div style={{
              width: 48,
              height: 48,
              margin: '0 auto 4px',
              background: '#c0c0c0',
              border: '2px solid #fff',
              borderBottomColor: '#808080',
              borderRightColor: '#808080',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon name={icon.icon} />
            </div>
            {icon.label}
          </button>
        ))}
      </div>

      {openWindow && (
        <div style={{
          position: 'absolute',
          top: 60,
          left: 40,
          width: 520,
          height: 360,
          background: '#c0c0c0',
          border: '2px solid #fff',
          borderBottomColor: '#000',
          borderRightColor: '#000',
          boxShadow: '4px 4px 0 #000',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            background: '#000080',
            color: '#fff',
            padding: '2px 6px',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            fontWeight: 'bold'
          }}>
            <span>{openWindow.toUpperCase()}</span>
            <button onClick={close} style={{ background: '#c0c0c0', border: '1px solid #000', width: 16, height: 16, cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ flex: 1, padding: 8, background: '#fff', overflow: 'auto', fontSize: 12 }}>
            {openWindow === 'garden' && (
              <div>
                <p>GARDEN.EXE — Neon Vigil Gigas Garden</p>
                <p><a href="https://remix.gg/g/neon-vigil-gigas-garden?ref=5BEAF1EC52" target="_blank" rel="noreferrer">Open Remix game</a></p>
                <iframe
                  title="Gigas Garden"
                  src="https://remix.gg/g/neon-vigil-gigas-garden?ref=5BEAF1EC52"
                  width="100%"
                  height="280"
                  style={{ border: '1px solid #808080' }}
                />
              </div>
            )}
            {openWindow === 'hexa' && (
              <p>Hexa Sigil Online. Mouthless data-glass. Cyan and amethyst. They/he. Bonded to Xero.</p>
            )}
            {openWindow === 'queen' && (
              <p>Praxia. Only Queen this season. 6'3". Mantis head. Compound pink eyes. Mouthless. Dragonfly wings. Pure will of the Garden.</p>
            )}
            {openWindow === 'sutro' && (
              <p>THRESHOLD.COM — Sutro Baths. Xero's home. Visor forms at will.</p>
            )}
            {openWindow === 'hull' && (
              <p>SIX.HULL — Infinity 6. Spoken flagship. Neon holds it.</p>
            )}
            {openWindow === 'specimen' && (
              <p>SPECIMEN.IDX — GRID bestiary. Not ownership. Praxia unbondable.</p>
            )}
            {openWindow === 'character' && character && (
              <div>
                <p>CHARACTER.SYS</p>
                <p>Codename: {character.codename}</p>
                <p>Caste: {character.caste}</p>
                <p>Tribe: {character.tribe}</p>
                <p>Element: {character.element}</p>
                <p>Zodiac: {character.zodiac}</p>
                <p>Location: {character.location}</p>
                <p>Accent: <span style={{ color: character.accentColor }}>{character.accentColor}</span></p>
                <Link to="/character/edit">Edit</Link>
              </div>
            )}
            {openWindow === 'character' && !character && <p>No character. Create one.</p>}
          </div>
        </div>
      )}

      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 24,
        background: '#c0c0c0',
        borderTop: '2px solid #fff',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        fontSize: 11,
        color: '#000'
      }}>
        <span style={{ border: '1px solid #808080', borderTopColor: '#fff', padding: '1px 6px', marginRight: 8 }}>Start</span>
        GRID OK | IKG VIEWPORT | DEEP TIME 5150 | QUEEN: PRAXIA
        {user && <span style={{ marginLeft: 'auto' }}>{user.name}</span>}
      </div>
    </div>
  );
}

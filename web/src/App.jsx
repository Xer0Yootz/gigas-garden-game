import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import GridField from './pages/GridField.jsx';
import LoadingScreen from './pages/LoadingScreen.jsx';
import Flourish from './pages/Flourish.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import CharacterCreation from './pages/CharacterCreation.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import GroupChatPage from './pages/GroupChatPage.jsx';
import HubPage from './pages/HubPage.jsx';
import OptionsMenu from './components/OptionsMenu.jsx';
import FloatingMusicPlayer from './components/FloatingMusicPlayer.jsx';
import { AUTH_MODE, readSession, writeSession, takeNext } from './auth.js';

const MIN_INTRO_MS = 1800;
const LOADED_HOLD_MS = 700;
const FLOURISH_MS = 1600;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function App() {
  const [user, setUser] = useState(null);
  const [character, setCharacter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [flourish, setFlourish] = useState(false);
  const [progress, setProgress] = useState(8);
  const [label, setLabel] = useState('Hex operating system loading');

  useEffect(() => {
    let cancelled = false;
    const started = Date.now();

    async function load() {
      try {
        setProgress(20);
        if (AUTH_MODE !== 'server') {
          // Static build (GitHub Pages) or dev mock: the session lives in this browser only.
          // A GitHub OAuth return lands here with no local session yet — pick the Supabase
          // session up and write it to the same key the game gate checks.
          let session = readSession();
          if (!session) {
            try {
              const { supabaseSessionUser } = await import('./supabase.js');
              const oauthUser = await supabaseSessionUser();
              if (oauthUser) session = writeSession(oauthUser);
            } catch { /* no Supabase session: fall through to sign-in */ }
          }
          setUser(session);
          setProgress(90);
          setLabel(session ? 'Logging in to the IKG' : 'No IKG session');
          return;
        }
        setLabel('Hex operating system loading');
        const authResponse = await fetch('/api/auth/me', { credentials: 'include' });
        if (cancelled) return;
        setProgress(55);

        if (!authResponse.ok) {
          setUser(null);
          setProgress(90);
          setLabel('No IKG session');
        } else {
          const data = await authResponse.json();
          setUser(data.user);
          writeSession(data.user); // lets the game page gate see the session too
          setProgress(70);
          setLabel('Logging in to the IKG');

          const characterResponse = await fetch('/api/character/me', { credentials: 'include' });
          if (cancelled) return;
          setProgress(90);

          if (characterResponse.ok) {
            const characterData = await characterResponse.json();
            setCharacter(characterData.character || null);
          } else {
            setCharacter(null);
          }
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setProgress(90);
          setLabel('IKG read failed');
        }
      } finally {
        if (!cancelled) {
          setProgress(100);
          setLabel('Entering virtual reality construct');
        }
        const elapsed = Date.now() - started;
        const remaining = Math.max(LOADED_HOLD_MS, MIN_INTRO_MS - elapsed);
        await wait(remaining);
        if (!cancelled) {
          setLoading(false);
          setFlourish(true);
          await wait(FLOURISH_MS);
          if (!cancelled) setFlourish(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // After sign-in, go back to whatever sent the visitor here (the gated game page), else stay in the app.
  useEffect(() => {
    if (loading || flourish || !user) return;
    const next = takeNext();
    if (next) window.location.assign(next);
  }, [loading, flourish, user]);

  const serverMode = AUTH_MODE === 'server';
  let screen = null;
  if (loading) {
    screen = (
      <LoadingScreen
        progress={progress}
        label={label}
        onSkip={() => {
          setLoading(false);
          setFlourish(true);
          setTimeout(() => setFlourish(false), FLOURISH_MS);
        }}
      />
    );
  } else if (flourish) {
    screen = <Flourish />;
  } else {
    screen = (
      <Routes>
        {/* Route gates (ported from 5150, adapted Oct 28, 2026):
            sign-up + codename registration gate Hub/Chat/Dashboard, but
            ONLY in server mode. Static Pages builds (Google/mock) carry
            no character record in App state, so gating them on character
            would lock out the live site entirely — Pages users keep
            Hub/Chat access. There is no /construct page in this app, so
            a server user without a character is sent to
            /character/create, the oauth equivalent. Root stays /hub:
            this app's Hub is its home screen, and sending Pages users
            to /character/create would loop (that route rejects
            non-server mode). */}
        <Route path="/" element={user ? <Navigate to="/hub" replace /> : <LoginPage setUser={setUser} />} />
        <Route path="/signup" element={user || !serverMode ? <Navigate to="/" replace /> : <SignupPage setUser={setUser} />} />
        <Route path="/character/create" element={user && serverMode && !character ? <CharacterCreation setCharacter={setCharacter} /> : <Navigate to="/" replace />} />
        <Route path="/character/edit" element={user && serverMode ? <CharacterCreation setCharacter={setCharacter} existing={character} /> : <Navigate to="/" replace />} />
        <Route path="/hub" element={user ? (serverMode && !character ? <Navigate to="/character/create" replace /> : <HubPage user={user} character={character} setUser={setUser} />) : <Navigate to="/" replace />} />
        <Route path="/dashboard" element={user && serverMode && character ? <DashboardPage user={user} character={character} setUser={setUser} /> : <Navigate to="/" replace />} />
        <Route path="/chat" element={user ? (serverMode && !character ? <Navigate to="/character/create" replace /> : <GroupChatPage user={user} character={character} />) : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <>
      <GridField />
      <div className="screen-layer">{screen}</div>
      {!loading && !flourish && user && <OptionsMenu user={user} />}
      {/* Floating player: everywhere signed-in EXCEPT sign-in screen and Hub. */}
      {!loading && !flourish && user && <PlayerGate />}
    </>
  );
}

function PlayerGate() {
  const { pathname } = useLocation();
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const path = pathname.startsWith(base) ? pathname.slice(base.length) || '/' : pathname;
  if (path === '/' || path === '/hub') return null;
  return <FloatingMusicPlayer />;
}

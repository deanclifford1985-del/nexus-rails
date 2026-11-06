// Nexus Rail (NFT edition): sign in before playing. Clerk gives Google or email sign-in (no Replit
// account). A test sign-in exists only when the server runs with NEXUS_DEV_AUTH=1, never live.
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { api, configureApi } from '../net/api.js';
import { useGame } from '../state/store.jsx';
import { GAME_NAME } from '../edition.js';

const ClerkGate = lazy(() => import('./ClerkGate.jsx'));

function Splash({ children }) {
  return (
    <div className="auth-page">
      <div className="auth-card plate riveted stack">
        <span className="label">{GAME_NAME}</span>
        {children}
      </div>
    </div>
  );
}

// Once signed in: start the session (creates the player, with the welcome Nexus) and load the bank.
export function Session({ children, signOut }) {
  const { startSession, account } = useGame();
  const [error, setError] = useState(null);
  useEffect(() => {
    let live = true;
    startSession(signOut).catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [startSession, signOut]);
  if (error)
    return (
      <Splash>
        <h1>Can't load your account</h1>
        <p className="muted">{error}</p>
        <button type="button" className="btn btn-arcane" onClick={() => window.location.reload()}>
          Try again
        </button>
      </Splash>
    );
  if (!account) return <Splash><p className="muted">Loading your account…</p></Splash>;
  return children;
}

function DevGate({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(window.sessionStorage.getItem('nexus-dev-user') ?? 'null');
    } catch {
      return null;
    }
  });
  const [name, setName] = useState('');
  if (user) {
    configureApi({ devUser: user });
    return (
      <Session
        signOut={() => {
          window.sessionStorage.removeItem('nexus-dev-user');
          window.location.reload();
        }}
      >
        {children}
      </Session>
    );
  }
  return (
    <Splash>
      <h1>Test sign-in</h1>
      <p className="muted">This server is in test mode. Type any name to sign in as that test player.</p>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          const id = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          if (!id) return;
          const next = { id, email: `${id}@dev.local` };
          window.sessionStorage.setItem('nexus-dev-user', JSON.stringify(next));
          setUser(next);
        }}
      >
        <input className="field grow" value={name} onChange={(e) => setName(e.target.value)} placeholder="Test player name" aria-label="Test player name" />
        <button type="submit" className="btn btn-arcane">
          Sign in
        </button>
      </form>
    </Splash>
  );
}

export default function AccountGate({ children }) {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    api('/api/config')
      .then(setConfig)
      .catch((e) => setError(e.message));
  }, []);
  if (error)
    return (
      <Splash>
        <h1>Sign-in is offline</h1>
        <p className="muted">{error} Accounts, Nexus and crates need the game server.</p>
      </Splash>
    );
  if (!config) return <Splash><p className="muted">Connecting…</p></Splash>;
  if (config.auth === 'clerk')
    return (
      <Suspense fallback={<Splash><p className="muted">Loading sign-in…</p></Splash>}>
        <ClerkGate publishableKey={config.clerkPublishableKey} proxyUrl={config.proxyUrl}>
          {children}
        </ClerkGate>
      </Suspense>
    );
  if (config.auth === 'dev') return <DevGate>{children}</DevGate>;
  return (
    <Splash>
      <h1>Sign-in is coming</h1>
      <p className="muted">Accounts aren't switched on for this server yet. Check back soon.</p>
    </Splash>
  );
}

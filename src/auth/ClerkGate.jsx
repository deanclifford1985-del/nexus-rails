// Clerk sign-in (Google or email), loaded only in Nexus Rail.
import React, { useCallback, useEffect } from 'react';
import { ClerkProvider, SignIn, useAuth } from '@clerk/clerk-react';
import { configureApi } from '../net/api.js';
import { TreasuryPreview } from '../ui/TreasuryBits.jsx';
import { Session } from './AccountGate.jsx';
import { GAME_NAME } from '../edition.js';

const appearance = {
  variables: { colorPrimary: '#19c3e6', colorBackground: '#0b1118', colorText: '#eef6ff', colorTextSecondary: '#a9b8c9', colorInputBackground: '#111a24', colorInputText: '#eef6ff', borderRadius: '10px' },
  elements: {
    socialButtonsBlockButton: { backgroundColor: '#ffffff', color: '#1f2328', border: '1px solid #d0d7de' },
    socialButtonsBlockButtonText: { color: '#1f2328', fontWeight: 600 },
    formButtonPrimary: { color: '#03141a', fontWeight: 700 },
  },
};

function Inner({ children }) {
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
  useEffect(() => {
    configureApi({ getToken: () => getToken() });
  }, [getToken]);
  const out = useCallback(() => signOut(), [signOut]);
  if (!isLoaded) return <div className="auth-page"><p className="muted">Loading sign-in…</p></div>;
  if (!isSignedIn)
    return (
      <div className="auth-page">
        <div className="stack" style={{ alignItems: 'center' }}>
          <div className="auth-brand">
            <span className="label">{GAME_NAME}</span>
            <h1>
              Sign in to <span className="hl-purple">play</span>
            </h1>
            <p className="muted">Use Google or your email. Your Nexus, crates and NFTs follow your account.</p>
          </div>
          <TreasuryPreview />
          <SignIn routing="hash" />
        </div>
      </div>
    );
  return <Session signOut={out}>{children}</Session>;
}

export default function ClerkGate({ publishableKey, proxyUrl, children }) {
  return (
    <ClerkProvider publishableKey={publishableKey} proxyUrl={proxyUrl || undefined} appearance={appearance}>
      <Inner>{children}</Inner>
    </ClerkProvider>
  );
}

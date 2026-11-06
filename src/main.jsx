import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { GameProvider } from './state/store.jsx';
import { IS_NFT } from './edition.js';
import './styles/app.css';
import './styles/nexus.css';

// Nexus Rail (NFT edition) signs players in before the game starts; Lite needs no account.
const AccountGate = IS_NFT ? React.lazy(() => import('./auth/AccountGate.jsx')) : null;

createRoot(document.getElementById('root')).render(
  <GameProvider>
    {AccountGate ? (
      <React.Suspense fallback={null}>
        <AccountGate>
          <App />
        </AccountGate>
      </React.Suspense>
    ) : (
      <App />
    )}
  </GameProvider>,
);

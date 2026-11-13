import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { GameProvider } from './state/store.jsx';
import './styles/base.css';
import './styles/hud.css';
import './styles/ui.css';

createRoot(document.getElementById('root')).render(
  <GameProvider>
    <App />
  </GameProvider>,
);

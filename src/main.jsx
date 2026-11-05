import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { GameProvider } from './state/store.jsx';
import './styles/app.css';
import './styles/nexus.css';

createRoot(document.getElementById('root')).render(
  <GameProvider>
    <App />
  </GameProvider>,
);

import React, { useEffect, useRef } from 'react';
import { useGame } from '../state/store.jsx';
import { Game } from './Game.js';

// Mounts the 3D world and its HUD. The Game object it creates is also the "host" the menus
// talk to; it is registered with the store for as long as this view is on screen.
export default function GameView() {
  const { api, setHost } = useGame();
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  useEffect(() => {
    const game = new Game({ canvas: canvasRef.current, hudRoot: rootRef.current, api });
    setHost(game);
    return () => {
      setHost(null);
      game.dispose();
    };
  }, [api, setHost]);
  return (
    <div className="game-view" ref={rootRef}>
      <canvas className="world" ref={canvasRef} />
    </div>
  );
}

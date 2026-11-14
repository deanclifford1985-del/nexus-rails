import React, { Suspense } from 'react';
import { useGame } from './state/store.jsx';
import Title from './ui/Title.jsx';
import Create from './ui/Create.jsx';
import Overlays from './ui/Overlays.jsx';

// The 3D world is the heavy part, so it loads on its own once a soldier is chosen.
const GameView = React.lazy(() => import('./view/GameView.jsx'));

// Three screens: the title, recruit creation, and the game itself (the 3D world with the menus
// drawn over it).
export default function App() {
  const { screen, save, toasts } = useGame();
  let view;
  if (screen === 'create') view = <Create />;
  else if (screen === 'game' && save) {
    view = (
      <Suspense fallback={<div className="loading-screen">Deploying to Corvane…</div>}>
        <GameView key={save.id} />
        <Overlays />
      </Suspense>
    );
  } else view = <Title />;
  return (
    <>
      {view}
      <div className="toasts" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.tone}`}>
            {toast.text}
          </div>
        ))}
      </div>
    </>
  );
}

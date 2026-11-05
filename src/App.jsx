import React from 'react';
import { useGame } from './state/store.jsx';
import { Shell } from './ui/Shell.jsx';
import Title from './screens/Title.jsx';
import Create from './screens/Create.jsx';
import Yard from './screens/Yard.jsx';
import Jobs from './screens/Jobs.jsx';
import Setup from './screens/Setup.jsx';
import Race from './screens/Race.jsx';
import Receipt from './screens/Receipt.jsx';
import Depot from './screens/Depot.jsx';
import Workshop from './screens/Workshop.jsx';
import Research from './screens/Research.jsx';
import Station from './screens/Station.jsx';
import Armory from './screens/Armory.jsx';
import Festival from './screens/Festival.jsx';

// Screens that fill the window on their own, without the top bar and tabs.
const FULL = { create: Create, setup: Setup, race: Race, receipt: Receipt };
const TABS = { yard: Yard, jobs: Jobs, depot: Depot, armory: Armory, festival: Festival, workshop: Workshop, research: Research, station: Station };

export default function App() {
  const { screen, conductor, toasts } = useGame();
  let view;
  if (screen.name === 'create') view = <Create />;
  else if (!conductor || screen.name === 'title') view = <Title />;
  else if (FULL[screen.name]) {
    const Screen = FULL[screen.name];
    // A new key per visit gives each run a fresh screen.
    view = <Screen key={screen.name === 'race' ? JSON.stringify(screen.ctx) + (screen.config?.player.fuel ?? '') : screen.name} />;
  } else {
    const Screen = TABS[screen.name] ?? Yard;
    view = (
      <Shell>
        <Screen />
      </Shell>
    );
  }
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

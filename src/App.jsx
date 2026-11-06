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
import Talents from './screens/Talents.jsx';
import Crates, { AdminPanel } from './screens/Crates.jsx';
import { IS_NFT } from './edition.js';

// Screens that fill the window on their own, without the top bar and tabs.
const FULL = { create: Create, setup: Setup, race: Race, receipt: Receipt };
const TABS = { yard: Yard, jobs: Jobs, depot: Depot, armory: Armory, festival: Festival, workshop: Workshop, research: Research, station: Station, ...(IS_NFT ? { talents: Talents, crates: Crates } : {}) };

// A Nexus Rail Captain with an empty garage can only reach the Crates and Talents until a crate
// gives them a locomotive.
const NO_TRAIN_OK = ['crates', 'talents'];

function NoTrain() {
  const { go } = useGame();
  return (
    <div className="plate riveted stack" style={{ maxWidth: 560, margin: '40px auto' }}>
      <h1>
        No locomotive <span className="hl-purple">yet</span>
      </h1>
      <p className="muted">Every Captain's first locomotive comes out of a crate. Open one with Nexus, send the locomotive to your Captain, and your conductor takes the controls.</p>
      <button type="button" className="btn btn-arcane btn-lg" onClick={() => go('crates', { tab: 'crates' })}>
        Go to the Crates
      </button>
    </div>
  );
}

// Nexus Rail: the admin panel on its own, at /#admin, with or without a Captain loaded.
function AdminPage() {
  const { account } = useGame();
  return (
    <div className="page stack" style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 16px' }}>
      <div className="page-head">
        <span className="label">Nexus Rail</span>
        <h1>
          Admin <span className="hl-purple">panel</span>
        </h1>
        <p className="muted">Every player who has signed in, newest activity first. Signed in as {account?.player?.name ?? '…'}.</p>
      </div>
      <AdminPanel />
      <a className="btn btn-ghost" href="#" onClick={() => window.location.assign(window.location.pathname)}>
        Back to the game
      </a>
    </div>
  );
}

const isAdminHash = () => IS_NFT && typeof window !== 'undefined' && window.location.hash === '#admin';

export default function App() {
  const { screen, conductor, toasts } = useGame();
  const [adminView, setAdminView] = React.useState(isAdminHash);
  React.useEffect(() => {
    const onHash = () => setAdminView(isAdminHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const noTrain = IS_NFT && conductor && !(conductor.locos?.length > 0);
  let view;
  if (adminView) view = <AdminPage />;
  else if (screen.name === 'create') view = <Create />;
  else if (!conductor || screen.name === 'title') view = <Title />;
  else if (noTrain && !NO_TRAIN_OK.includes(screen.name)) {
    view = (
      <Shell>
        <NoTrain />
      </Shell>
    );
  } else if (FULL[screen.name]) {
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

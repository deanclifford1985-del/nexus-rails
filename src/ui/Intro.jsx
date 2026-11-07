import React, { useEffect, useState } from 'react';
import { Box, Check, CheckCircle2, Circle, Copy, ExternalLink, Gem, Landmark, Sparkles, TrainFront, X } from 'lucide-react';
import { useGame } from '../state/store.jsx';
import { IS_NFT } from '../edition.js';
import { TREASURY } from '../game/treasury.js';

// Nexus Rail's first-time intro: four short cards after sign-in (skippable, shown once per account
// on this device, and again from the Treasury tab), the Venmo how-to, and a getting-started
// checklist that stays on the Fleet screen until each step is done.

const seenKey = (id) => `nexus-intro-seen:${id}`;
const listKey = (id) => `nexus-checklist-hidden:${id}`;
const VISITED = 'nexus-visited-treasury';
const read = (key) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode: the intro may show again, that's fine */
  }
};
export const showIntro = () => window.dispatchEvent(new Event('nexus:intro'));
export const markTreasuryVisited = () => {
  write(VISITED, '1');
  window.dispatchEvent(new Event('nexus:checklist'));
};

function CopyName({ name }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(name);
      setDone(true);
      window.setTimeout(() => setDone(false), 1600);
    } catch {
      /* the name is on screen to type by hand */
    }
  };
  return (
    <span className="intro-name">
      <b>{name}</b>
      <button type="button" className="btn btn-sm" onClick={copy} aria-label={`Copy your player name, ${name}`}>
        {done ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {done ? 'Copied' : 'Copy'}
      </button>
    </span>
  );
}

// How to buy Nexus: Venmo, with the player's name in the note.
export function VenmoSteps({ name }) {
  return (
    <div className="venmo stack-sm">
      <ol className="venmo-steps">
        <li>
          Pay <b>@{TREASURY.venmo.handle}</b> on Venmo. 1 Nexus = $1, so $10 buys 10 Nexus.
        </li>
        <li>
          In the Venmo note, put your player name: <CopyName name={name ?? 'your player name'} />
        </li>
        <li>The admin team adds the Nexus to your account once the payment comes in. The game shows a pop-up when they land.</li>
      </ol>
      <a className="btn btn-arcane btn-block" href={TREASURY.venmo.url} target="_blank" rel="noopener noreferrer">
        <ExternalLink aria-hidden="true" /> Open Venmo: @{TREASURY.venmo.handle}
      </a>
    </div>
  );
}

export function Intro() {
  const { account, conductor, screen, go } = useGame();
  const id = account?.player?.id;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!IS_NFT || !id) return;
    if (!read(seenKey(id))) setOpen(true);
  }, [id]);
  useEffect(() => {
    const again = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener('nexus:intro', again);
    return () => window.removeEventListener('nexus:intro', again);
  }, []);
  if (!IS_NFT || !open || !account || screen.name === 'race') return null;
  const close = () => {
    write(seenKey(id), '1');
    setOpen(false);
  };
  const name = account.player.name;
  const toCrates = () => {
    close();
    if (conductor) go('crates', { tab: 'crates' });
  };
  const cards = [
    {
      icon: TrainFront,
      title: 'Welcome, Captain',
      body: (
        <>
          <p>You run a rail company. Haul freight, win contracts and race other trains to earn <b>LocoTokens (LT)</b>.</p>
          <p>Every LT is backed by real money in the Treasury, so what you earn has a real dollar value.</p>
        </>
      ),
    },
    {
      icon: Box,
      title: 'Your first crate is on us',
      body: (
        <>
          <p>
            You start with <b>10 Nexus</b>: enough for a <b>Basic Crate</b>. Every crate holds a locomotive and a conductor to drive it.
          </p>
          <p>{conductor ? 'Open it in the Crates, then send both to your Captain.' : 'Create your Captain first, then open it in the Crates and send both to your Captain.'}</p>
        </>
      ),
      action: conductor ? (
        <button type="button" className="btn btn-block" onClick={toCrates}>
          <Box aria-hidden="true" /> Take me to the Crates
        </button>
      ) : null,
    },
    {
      icon: Gem,
      title: 'Getting more Nexus',
      body: (
        <>
          <p>Nexus buy bigger crates (Rare, Elite, Epic, Legendary, Mythic) with better trains and conductors.</p>
          <VenmoSteps name={name} />
          <p className="small muted">You can also swap the LT you earn for Nexus on the Treasury tab.</p>
        </>
      ),
    },
    {
      icon: Landmark,
      title: 'The Treasury',
      body: (
        <>
          <p>The Treasury tab shows how much money backs every LT, what your LT is worth in dollars, your earnings, and the top earners.</p>
          <p>
            85% of every crate bought goes into the Treasury. Paid Nexus (from Venmo or swaps) can be cashed out there too. Your 10 welcome Nexus are for crates only.
          </p>
        </>
      ),
    },
  ];
  const card = cards[step];
  const Icon = card.icon;
  const last = step === cards.length - 1;
  return (
    <div className="scrim intro-scrim" role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <div className="dialog plate intro stack">
        <div className="spread">
          <span className="intro-dots" aria-label={`Step ${step + 1} of ${cards.length}`}>
            {cards.map((c, i) => (
              <i key={c.title} className={i === step ? 'on' : i < step ? 'done' : ''} />
            ))}
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={close} aria-label="Skip the intro">
            <X aria-hidden="true" /> Skip
          </button>
        </div>
        <div className="intro-icon">
          <Icon aria-hidden="true" />
        </div>
        <h2 id="intro-title">{card.title}</h2>
        <div className="intro-body stack-sm">{card.body}</div>
        {card.action}
        <div className="row" style={{ gap: 8 }}>
          {step > 0 ? (
            <button type="button" className="btn" onClick={() => setStep(step - 1)}>
              Back
            </button>
          ) : null}
          <button type="button" className="btn btn-arcane grow" onClick={() => (last ? close() : setStep(step + 1))}>
            {last ? "Let's go" : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Getting started: four steps that tick themselves off as you play.
export function StartChecklist() {
  const { account, conductor, vault, go } = useGame();
  const id = account?.player?.id;
  const [, bump] = useState(0);
  useEffect(() => {
    const again = () => bump((n) => n + 1);
    window.addEventListener('nexus:checklist', again);
    return () => window.removeEventListener('nexus:checklist', again);
  }, []);
  if (!IS_NFT || !id || !conductor || read(listKey(id))) return null;
  const steps = [
    { done: (vault?.owned?.length ?? 0) > 0, text: 'Open your first crate', to: () => go('crates', { tab: 'crates' }) },
    { done: (conductor.locos?.length ?? 0) > 0, text: 'Send the train and conductor to your Captain', to: () => go('crates', { tab: 'vault' }) },
    { done: (conductor.stats?.runs ?? 0) > 0, text: 'Run your first race or job', to: () => go('jobs') },
    { done: !!read(VISITED), text: 'Visit the Treasury', to: () => go('treasury') },
  ];
  const left = steps.filter((s) => !s.done).length;
  const hide = () => {
    write(listKey(id), '1');
    bump((n) => n + 1);
  };
  return (
    <section className="plate stack-sm checklist" aria-labelledby="start-title">
      <div className="spread">
        <h3 id="start-title">
          <Sparkles aria-hidden="true" /> {left ? 'Getting started' : 'All set, Captain!'}
        </h3>
        <span className="small muted">
          {steps.length - left} of {steps.length}
        </span>
      </div>
      <ul className="check-list">
        {steps.map((s) => (
          <li key={s.text} className={s.done ? 'done' : ''}>
            {s.done ? <CheckCircle2 aria-hidden="true" /> : <Circle aria-hidden="true" />}
            {s.done ? (
              <span>{s.text}</span>
            ) : (
              <button type="button" className="linkish" onClick={s.to}>
                {s.text}
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-sm" onClick={showIntro}>
          Show the intro again
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={hide}>
          {left ? 'Hide this list' : 'Done'}
        </button>
      </div>
    </section>
  );
}

import React, { useState } from 'react';
import { Play, Trash2, UserPlus } from 'lucide-react';
import { useGame } from '../state/store.jsx';
import { RANKS } from '../game/ranks.js';
import { specOf } from '../game/specializations.js';
import { Btn, ConfirmBtn, Insignia } from './bits.jsx';
import { setPendingSlot } from './context.jsx';
import { playtime } from './format.js';

const CONTROLS = [
  ['Move', 'W A S D'],
  ['Look', 'Mouse'],
  ['Sprint · hold breath', 'Shift'],
  ['Crouch · prone', 'C · Z'],
  ['Jump · climb', 'Space'],
  ['Fire · aim', 'Left · right mouse'],
  ['Reload', 'R'],
  ['Use · talk · takedown', 'F'],
  ['Weapons', '1 · 2 · Q'],
  ['Grenade · next type', 'E · 3'],
  ['Melee', 'V'],
  ['Binoculars · night vision', 'B · N'],
  ['Medkit · bandage · stim', 'H · J · K'],
  ['Squad: on me · hold · move · attack', '5 · 6 · 7 · 8'],
  ['Squad: hold fire / weapons free', 'G'],
  ['Support: call · next', 'T · Y'],
  ['Field menu · map · pause', 'Tab · M · P'],
];

// The first screen: three service records to continue or start.
export default function Title() {
  const { saves, loadSlot, deleteSlot, setScreen } = useGame();
  const [help, setHelp] = useState(false);
  return (
    <main className="title-screen">
      <div className="title-sky" aria-hidden="true" />
      <div className="title-inner">
        <header className="title-head">
          <span className="title-kicker">Operation</span>
          <h1 className="title-logo">Iron Dawn</h1>
          <p className="title-tag">From recruit to commander. An open-world military RPG.</p>
        </header>
        <section className="title-slots" aria-label="Service records">
          {saves.slots.map((save, slot) =>
            save ? (
              <article key={slot} className="title-slot">
                <Insignia rank={save.rank} size={46} />
                <div className="title-slot-text">
                  <strong>
                    {RANKS[save.rank].abbr} {save.name}
                  </strong>
                  <span>
                    {RANKS[save.rank].name} · Level {save.level} · {specOf(save.spec)?.name ?? 'No specialization yet'}
                  </span>
                  <span className="title-slot-dim">
                    {save.phase === 'service' ? `${save.stats.missions} operations` : 'In basic training'} · {playtime(save.stats.playSeconds)}
                  </span>
                </div>
                <div className="title-slot-actions">
                  <Btn tone="primary" icon={Play} onClick={() => loadSlot(slot)}>
                    Continue
                  </Btn>
                  <ConfirmBtn tone="ghost" small icon={Trash2} confirm="Delete for good?" onConfirm={() => deleteSlot(slot)} aria-label={`Delete ${save.name}`}>
                    Delete
                  </ConfirmBtn>
                </div>
              </article>
            ) : (
              <article key={slot} className="title-slot is-empty">
                <div className="title-slot-text">
                  <strong>Empty record</strong>
                  <span>Start a new recruit at Camp Hawthorne.</span>
                </div>
                <div className="title-slot-actions">
                  <Btn
                    tone="gold"
                    icon={UserPlus}
                    onClick={() => {
                      setPendingSlot(slot);
                      setScreen('create');
                    }}
                  >
                    New recruit
                  </Btn>
                </div>
              </article>
            ),
          )}
        </section>
        <footer className="title-foot">
          <Btn tone="ghost" small onClick={() => setHelp((on) => !on)}>
            {help ? 'Hide controls' : 'Controls'}
          </Btn>
          <span>Saves are kept in this browser. Works with mouse and keyboard, or by touch.</span>
        </footer>
        {help ? (
          <section className="title-help" aria-label="Controls">
            {CONTROLS.map(([what, keys]) => (
              <div key={what}>
                <span>{what}</span>
                <b>{keys}</b>
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </main>
  );
}

export { CONTROLS };

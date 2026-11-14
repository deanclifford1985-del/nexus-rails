import React, { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { useGame } from '../state/store.jsx';
import { Btn, cx } from './bits.jsx';
import { getPendingSlot } from './context.jsx';
import { SKIN_TONES } from './format.js';

// A new recruit: a name and a face. The specialization is chosen later, at the intake tent.
export default function Create() {
  const { createSave, setScreen } = useGame();
  const [name, setName] = useState('');
  const [callsign, setCallsign] = useState('');
  const [skin, setSkin] = useState(1);
  const ready = name.trim().length >= 2;
  const enlist = () => {
    if (ready) createSave(getPendingSlot(), { name: name.trim(), callsign: callsign.trim(), skin });
  };
  return (
    <main className="title-screen">
      <div className="title-sky" aria-hidden="true" />
      <form
        className="create-card"
        onSubmit={(event) => {
          event.preventDefault();
          enlist();
        }}
      >
        <span className="title-kicker">Corvane Defence Force</span>
        <h1 className="create-title">Enlistment</h1>
        <p className="create-lead">A truck leaves for Camp Hawthorne in the morning. Sign below and you are on it.</p>
        <label className="create-field">
          <span>Surname</span>
          <input autoFocus value={name} maxLength={18} onChange={(e) => setName(e.target.value)} placeholder="e.g. Clifford" autoComplete="off" />
        </label>
        <label className="create-field">
          <span>Callsign (optional)</span>
          <input value={callsign} maxLength={14} onChange={(e) => setCallsign(e.target.value)} placeholder="e.g. Hawk" autoComplete="off" />
        </label>
        <fieldset className="create-field">
          <legend>Appearance</legend>
          <div className="create-skins">
            {SKIN_TONES.map((color, i) => (
              <button key={color} type="button" className={cx('create-skin', skin === i && 'is-on')} style={{ background: color }} onClick={() => setSkin(i)} aria-label={`Skin tone ${i + 1}`} aria-pressed={skin === i}>
                {skin === i ? <Check size={18} aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="create-actions">
          <Btn tone="ghost" icon={ArrowLeft} onClick={() => setScreen('title')}>
            Back
          </Btn>
          <Btn tone="gold" type="submit" disabled={!ready}>
            Enlist
          </Btn>
        </div>
      </form>
    </main>
  );
}

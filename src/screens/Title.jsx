import React, { useState } from 'react';
import { Clapperboard, Play, Plus } from 'lucide-react';
import { Trailer, trailerSeen } from '../ui/Trailer.jsx';
import { IS_NFT } from '../edition.js';
import { TRAILER_SRC } from '../ui/trailerSource.js';
import { useGame } from '../state/store.jsx';
import { PhantomNeonViewer } from '../ui/PhantomNeonViewer.jsx';
import { activeLoco } from '../game/conductor.js';
import { ConfirmButton } from '../ui/bits.jsx';
import { lt } from '../ui/format.js';

export default function Title() {
  const { saves, go, loadSlot, deleteSlot } = useGame();
  const freeSlot = saves.slots.findIndex((slot) => !slot);
  const hasSaves = saves.slots.some(Boolean);
  const [showTrailer, setShowTrailer] = useState(() => Boolean(TRAILER_SRC) && !trailerSeen());

  function resume(index) {
    loadSlot(index);
    const conductor = saves.slots[index];
    if (conductor.testRaceDone) go('yard');
    else go('setup', { ctx: { kind: 'test' } });
  }

  return (
    <div className="title-wrap">
      {showTrailer ? <Trailer src={TRAILER_SRC} onDone={() => setShowTrailer(false)} /> : null}
      <div className="title-card">
        <div>
          <div className="hero-brand">
            NEXUS<span>RAIL</span> <small className={`edition-tag ${IS_NFT ? 'nft' : ''}`}>{IS_NFT ? 'NFT' : 'LITE'}</small>
          </div>
          <div className="wordmark">
            Forge your <span>Iron Legacy</span>
          </div>
          <p className="tagline">
            {IS_NFT
              ? 'Captain a fleet. Hire conductors, open crates for locomotive and conductor NFTs, and race your way to the dragon.'
              : 'The RPG locomotive racer. Roll a conductor, arm an engine, haul, race and fight your way down the line to the dragon. Free to play.'}
          </p>
        </div>
        {showTrailer ? <div className="phantom-hero phantom-3d"><div className="phantom-3d-stage" /></div> : <PhantomNeonViewer />}

        {hasSaves ? (
          <div className="stack-sm">
            <span className="label">Your conductors</span>
            {saves.slots.map((slot, index) =>
              slot ? (
                <div className="paper" key={index}>
                  <div className="spread">
                    <div className="grow">
                      <h3 className="wrap-anywhere">{slot.name}</h3>
                      <span className="muted small">
                        Level {slot.level}, {lt(slot.lt)} LT, {activeLoco(slot).name}
                      </span>
                    </div>
                    <div className="row">
                      <ConfirmButton confirmLabel="Delete for good" onConfirm={() => deleteSlot(index)}>
                        Delete
                      </ConfirmButton>
                      <button type="button" className="btn btn-brass" onClick={() => resume(index)}>
                        <Play aria-hidden="true" />
                        Continue
                      </button>
                    </div>
                  </div>
                </div>
              ) : null,
            )}
          </div>
        ) : null}

        {freeSlot >= 0 ? (
          <button type="button" className={`btn btn-lg ${hasSaves ? '' : 'btn-brass'}`} onClick={() => go('create', { slot: freeSlot })}>
            <Plus aria-hidden="true" />
            {IS_NFT ? 'New Captain' : 'New conductor'}
          </button>
        ) : (
          <p className="muted">All three save slots are in use. Delete one to start a new conductor.</p>
        )}
        {TRAILER_SRC ? (
          <button type="button" className="btn btn-ghost" onClick={() => setShowTrailer(true)}>
            <Clapperboard aria-hidden="true" />
            Watch the trailer
          </button>
        ) : null}
        <p className="dim small">Saves are kept in this browser.</p>
      </div>
    </div>
  );
}

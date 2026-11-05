import React from 'react';
import { Crown, Lock, RotateCcw } from 'lucide-react';
import { useGame } from '../state/store.jsx';
import { CAPTAIN_MAX_LEVEL, FOCUSES, TREES, pointsLeft, pointsSpent, talentBlocker, tierOpenAt, treePoints } from '../game/captain.js';
import { respecCost } from '../game/actions.js';
import { ConfirmButton } from '../ui/bits.jsx';
import { ltWhole } from '../ui/format.js';

// The Captain's talent trees: three columns, six tiers each, like World of Warcraft.
export default function Talents() {
  const { conductor, act, notify } = useGame();
  const captain = conductor.captain;
  if (!captain) return <p className="muted">Talents belong to Captains in Nexus Rail.</p>;
  const focus = FOCUSES[captain.focus];
  const left = pointsLeft(conductor);

  return (
    <div className="stack">
      <div className="page-head">
        <span className="label">
          <Crown aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> Captain {captain.name}
        </span>
        <h1>
          Talent <span className="hl-purple">Trees</span>
        </h1>
        <p>
          Level {conductor.level} of {CAPTAIN_MAX_LEVEL}. One talent point every level. A tier opens once you have 5 points per tier above it in that tree; the capstone belongs to your focus. Focus: <b>{focus.name}</b>, {focus.perk.toLowerCase()}.
        </p>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <span className={`chip ${left > 0 ? 'chip-fest' : ''}`}>
          {left} point{left === 1 ? '' : 's'} to spend
        </span>
        <span className="chip">{pointsSpent(conductor)} spent</span>
        {pointsSpent(conductor) > 0 ? (
          <ConfirmButton confirmLabel={`Reset for ${ltWhole(respecCost(conductor))} LT`} onConfirm={() => act('resetTalents') && notify('Talents reset.', 'good')}>
            <RotateCcw aria-hidden="true" />
            Reset talents
          </ConfirmButton>
        ) : null}
      </div>

      <div className="talent-trees">
        {Object.entries(TREES).map(([treeId, tree]) => {
          const spent = treePoints(conductor, treeId);
          const isFocus = captain.focus === treeId;
          return (
            <section className={`plate talent-tree ${isFocus ? 'focus' : ''}`} key={treeId}>
              <div className="spread">
                <h2>{tree.name}</h2>
                <span className="chip">{spent} pts</span>
              </div>
              {isFocus ? <span className="small" style={{ color: 'var(--cyan)' }}>Your focus</span> : <span className="small muted">&nbsp;</span>}
              {[1, 2, 3, 4, 5, 6].map((tier) => {
                const open = spent >= tierOpenAt(tier);
                return (
                  <div className={`talent-tier ${open ? '' : 'locked'}`} key={tier}>
                    <span className="talent-tier-label">{open ? `Tier ${tier}` : <><Lock aria-hidden="true" /> {tierOpenAt(tier)} pts</>}</span>
                    <div className="talent-row">
                      {tree.talents
                        .filter((t) => t.tier === tier)
                        .map((t) => {
                          const rank = captain.talents[t.id] ?? 0;
                          const why = talentBlocker(conductor, t.id);
                          return (
                            <button
                              type="button"
                              key={t.id}
                              className={`talent ${rank > 0 ? 'has' : ''} ${rank === t.ranks ? 'max' : ''} ${t.capstone ? 'capstone' : ''}`}
                              disabled={!!why}
                              title={why ? `${t.text}. ${why}` : t.text}
                              onClick={() => act('spendTalent', { id: t.id })}
                            >
                              <b>{t.name}</b>
                              <span className="talent-rank">
                                {rank}/{t.ranks}
                              </span>
                              <small>{t.text}</small>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}

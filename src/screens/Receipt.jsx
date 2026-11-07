import { LicenceBadge } from '../ui/Licence.jsx';
import React from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import { B } from '../game/balance.js';
import { useGame } from '../state/store.jsx';
import { ATTRIBUTES, xpForLevel } from '../game/conductor.js';
import { Meter } from '../ui/bits.jsx';
import { fmt, lt, ltWhole, realTime } from '../ui/format.js';
import { fmtDate, fmtSpan, fmtTime } from '../game/calendar.js';
import { WeaponCard } from '../ui/WeaponCard.jsx';

import { dispatchTab } from '../ui/dispatch.js';
const STAMPS = {
  won: ['Won', 'good'],
  placed: ['Placed', 'gold'],
  delivered: ['Delivered', 'good'],
  lost: ['Beaten', ''],
  late: ['Late', ''],
  forfeit: ['Forfeit', ''],
  demo: ['Test drive', 'gold'],
};

function place(n) {
  const suffix = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${suffix[(v - 20) % 10] || suffix[v] || suffix[0]}`;
}

function headline(receipt) {
  const r = receipt.result;
  if (receipt.contest) {
    if (receipt.outcome === 'forfeit') return 'You stepped out of the contest.';
    if (receipt.contest === 'wall') return r.reason === 'smashed' ? `The wall came down in ${fmt(r.realSeconds, 1)} seconds.` : 'The judges called time with the wall still standing.';
    if (receipt.contest === 'pull') return r.reason === 'finished' ? `You hauled ${fmt(receipt.load ?? 0)} lb home in time.` : 'The load was too much for the clock.';
    return `You finished ${place(r.place)} of ${r.field} in the Speed Race.`;
  }
  if (r.derailed && receipt.outcome === 'lost') {
    return receipt.kind === 'test'
      ? 'Benchmark knocked you off the rails. The job board is open all the same.'
      : `Knocked off the rails. You are listed ${place(r.place)} of ${r.field}.`;
  }
  const knocked = r.rivalsDerailed ? ` ${r.rivalsDerailed === 1 ? 'One rival' : `${r.rivalsDerailed} rivals`} left the rails along the way.` : '';
  switch (receipt.outcome) {
    case 'won':
      if (receipt.kind === 'test') return `You beat Benchmark. The job board is yours.${knocked}`;
      return (receipt.negotiated ? `You finished ${place(r.place)}, and talked your way into the contract.` : `First home of ${r.field}.`) + knocked;
    case 'lost':
      if (receipt.kind === 'test') return 'Benchmark got there first. The job board is open all the same.';
      return `You finished ${place(r.place)} of ${r.field}.${knocked}`;
    case 'placed':
      return `You finished ${place(r.place)} of ${r.field} and take a share of the purse.${knocked}`;
    case 'delivered':
      return r.timeLimit ? `Delivered with ${Math.round(r.underLimitPct)}% of the time to spare.` : 'Delivered.';
    case 'late':
      return 'The time limit ran out before you arrived. No pay for a late load.';
    case 'forfeit':
      return 'You gave up the run. The fuel you burned is gone.';
    default:
      return 'Nothing was spent and nothing is kept.';
  }
}

export default function Receipt() {
  const { conductor, screen, go, act } = useGame();
  const receipt = screen.receipt;
  if (!receipt) {
    return (
      <div className="page stack">
        <h1>No run to show</h1>
        <button type="button" className="btn btn-brass" onClick={() => go('yard')}>
          Back to the yard
        </button>
      </div>
    );
  }
  const r = receipt.result;
  const [stamp, tone] = STAMPS[receipt.outcome];
  const contest = !!receipt.contest;
  const demo = receipt.kind === 'demo';
  const need = xpForLevel(conductor.level);

  return (
    <div className="page stack" style={{ maxWidth: 720, paddingBottom: 48 }}>
      <section className="paper stack">
        <span className="label">{receipt.company ?? 'Nexus Rails Company'}</span>
        <div className="spread">
          <h1 className="grow">{receipt.title}</h1>
          <span className={`stamp big ${tone}`}>{stamp}</span>
        </div>
        <p style={{ fontSize: '1.1rem' }}>{headline(receipt)}</p>
        {receipt.medal ? (
          <p>
            <span className={`medal ${receipt.medal}`}>{receipt.medal === 'none' ? 'No medal' : `${receipt.medal} medal`}</span>
          </p>
        ) : null}
        {receipt.licenceUp ? (
          <div className="licence-up">
            <LicenceBadge level={receipt.licenceUp.level} big />
            <div>
              <b>New licence: {receipt.licenceUp.name}</b>
              <span className="small">
                {Math.round(receipt.licenceUp.pay * 100)}% more pay on every job. Opens: {receipt.licenceUp.text}
              </span>
            </div>
          </div>
        ) : null}
        {receipt.expressDone ? <p className="note">The {receipt.expressDone} is complete. Bonus paid below.</p> : null}
        {receipt.prizeWeapon ? (
          <div className="note stack-sm">
            <b>Prize: a weapon for your shelf.</b>
            <WeaponCard weapon={receipt.prizeWeapon} />
          </div>
        ) : null}
        {receipt.minutes ? (
          <p className="small muted">
            The run took {fmtSpan(receipt.minutes)} on the calendar, trip and turnaround. It is now {fmtTime(receipt.date)}, {fmtDate(receipt.date)}.
          </p>
        ) : null}

        {receipt.contractsWon > 0 ? (
          <p className="note">
            <b>
              {receipt.contractsWon} contracts with {receipt.company}.
            </b>{' '}
            Its jobs are now on your board.
          </p>
        ) : null}

        {!demo && !contest ? (
          <dl className="kv">
            {receipt.lines.map((line) => (
              <React.Fragment key={line.label}>
                <dt>{line.label}</dt>
                <dd>+{ltWhole(line.lt)} LT</dd>
              </React.Fragment>
            ))}
            {receipt.lines.length === 0 ? (
              <>
                <dt>{receipt.kind === 'contract' ? 'Purse (the prize is contracts)' : receipt.kind === 'race' ? 'Purse (top three only)' : 'Pay'}</dt>
                <dd>0 LT</dd>
              </>
            ) : null}
            <dt>
              Fuel burned: {fmt(r.fuelUsed, 1)} gal{r.emergencyGallons ? `, ${fmt(r.emergencyGallons)} of it trucked in` : ''}
            </dt>
            <dd className="stop">-{lt(receipt.fuelCost)} LT</dd>
            {receipt.ammoCost ? (
              <>
                <dt>Ammo restocked: {r.roundsFired} units</dt>
                <dd className="stop">-{lt(receipt.ammoCost)} LT</dd>
              </>
            ) : null}

            <dt className="total">
              <b>{receipt.profit >= 0 ? 'Profit on the run' : receipt.payout === 0 ? 'Cost of the run' : 'Loss on the run'}</b>
            </dt>
            <dd className={`total ${receipt.profit >= 0 ? 'go' : receipt.payout === 0 ? '' : 'stop'}`}>
              {receipt.profit >= 0 ? '+' : '-'}
              {lt(Math.abs(receipt.profit))} LT
            </dd>
            {receipt.advanceRepaid ? (
              <>
                <dt>Fuel advance repaid out of pay</dt>
                <dd>-{lt(receipt.advanceRepaid)} LT</dd>
              </>
            ) : null}
          </dl>
        ) : null}

        <hr className="rule" />
        <div className="stats">
          <div className="stat">
            <span className="label">Distance</span>
            <b>
              {fmt(r.distance, 1)}
              <small>mi</small>
            </b>
          </div>
          <div className="stat">
            <span className="label">Real time</span>
            <b>{realTime(r.gameSeconds)}</b>
          </div>
          <div className="stat">
            <span className="label">Average</span>
            <b>
              {fmt(r.avgMph, 1)}
              <small>mph</small>
            </b>
          </div>
          <div className="stat">
            <span className="label">Top speed</span>
            <b>
              {fmt(r.topMph, 1)}
              <small>mph</small>
            </b>
          </div>
          {!demo ? (
            <div className="stat">
              <span className="label">Back in reserve</span>
              <b>
                {fmt(r.fuelLeft, 1)}
                <small>gal</small>
              </b>
            </div>
          ) : null}
          {r.combat && receipt.outcome !== 'forfeit' ? (
            <>
              <div className="stat">
                <span className="label">Damage dealt</span>
                <b>{fmt(r.damageDealt)}</b>
              </div>
              <div className="stat">
                <span className="label">Damage taken</span>
                <b className={r.derailed ? 'stop' : ''}>{fmt(r.damageTaken)}</b>
              </div>
              {r.rivalsDerailed ? (
                <div className="stat">
                  <span className="label">Knocked off</span>
                  <b>
                    {r.rivalsDerailed}
                    <small>+{fmt(r.rivalsDerailed * B.COMBAT.derailXp)} XP</small>
                  </b>
                </div>
              ) : null}
            </>
          ) : null}
          {r.boulders ? (
            <div className="stat">
              <span className="label">Boulders cleared</span>
              <b className={r.crashes ? 'stop' : ''}>
                {r.bouldersSmashed} of {r.boulders}
                {r.crashes ? <small>{r.crashes} hit</small> : null}
              </b>
            </div>
          ) : null}
          {receipt.condition !== undefined ? (
            <div className="stat">
              <span className="label">Durability</span>
              <b className={receipt.condition < 0.5 ? 'stop' : ''}>
                {fmt(receipt.condition * 100, 1)}%<small>-{fmt(receipt.wear * 100, 2)}%</small>
              </b>
            </div>
          ) : null}
          {receipt.reputation ? (
            <div className="stat">
              <span className="label">Reputation</span>
              <b>+{receipt.reputation}</b>
            </div>
          ) : null}
        </div>

        {r.standings.length > 1 && receipt.outcome !== 'forfeit' ? (
          <>
            <hr className="rule" />
            <div className="stack-sm">
              <span className="label">Finishing order</span>
              {r.standings.map((row, index) => (
                <div className="spread" key={row.id}>
                  <span>
                    <b className="num">{index + 1}.</b> {row.isPlayer ? <b>You</b> : row.name} <span className="muted small">{row.locoName}</span>
                  </span>
                  <span className={`num ${row.out ? 'stop' : 'muted'}`}>{row.finished ? realTime(row.gameSeconds) : row.out ? `Off the rails at ${fmt(row.distance, 1)} mi` : `${fmt(row.distance, 1)} mi`}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </section>

      {!demo ? (
        <section className="plate stack">
          <div className="spread">
            <div>
              <span className="label">Experience</span>
              <h2>+{fmt(receipt.xp)} XP</h2>
            </div>
            <span className="chip">Level {conductor.level}</span>
          </div>
          <Meter value={conductor.xp} max={need} label="Experience to next level" />
          <span className="muted small num">
            {fmt(conductor.xp)} of {fmt(need)} to level {conductor.level + 1}
          </span>
          {receipt.levels > 0 ? (
            <p className="note">
              <b>Level up.</b> You reached level {conductor.level}.
            </p>
          ) : null}
          {conductor.attributePoints > 0 ? (
            <div className="stack-sm">
              <span>
                {conductor.attributePoints} attribute point{conductor.attributePoints === 1 ? '' : 's'} to spend:
              </span>
              <div className="row">
                {Object.keys(ATTRIBUTES).map((key) => (
                  <button type="button" key={key} className="btn btn-brass btn-sm" onClick={() => act('spendAttributePoint', { key })}>
                    <Plus aria-hidden="true" />
                    {ATTRIBUTES[key].name} ({conductor[key]})
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="row">
        {contest ? (
          <button type="button" className="btn btn-brass btn-lg grow" onClick={() => go('festival')}>
            Back to the festival
            <ArrowRight aria-hidden="true" />
          </button>
        ) : demo ? (
          <button type="button" className="btn btn-brass btn-lg grow" onClick={() => go('station')}>
            Back to the station
            <ArrowRight aria-hidden="true" />
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-lg" onClick={() => go('yard')}>
              Yard
            </button>
            <button type="button" className="btn btn-brass btn-lg grow" onClick={() => go('jobs', { tab: dispatchTab(receipt.kind) })}>
              Dispatch
              <ArrowRight aria-hidden="true" />
            </button>
          </>
        )}
      </div>
      <p className="dim small center">One real second is {B.TIME_SCALE} seconds on the line.</p>
    </div>
  );
}

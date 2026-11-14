import { LicenceBadge } from '../ui/Licence.jsx';
import React from 'react';
import { ArrowRight, Gem, Plus, Trophy } from 'lucide-react';
import { MODELS } from '../game/locomotives.js';
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
  escaped: ['Got away', ''],
};

function place(n) {
  const suffix = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${suffix[(v - 20) % 10] || suffix[v] || suffix[0]}`;
}

const TRIAL_SCORE = {
  gauntlet: (score) => `${score} obstacle${score === 1 ? '' : 's'} dealt with`,
  timetrial: (score) => `${fmt(score, 1)} seconds`,
  brawl: (score) => `${score} raider${score === 1 ? '' : 's'} put off the rails`,
};

function headline(receipt) {
  const r = receipt.result;
  if (receipt.trial) {
    if (receipt.outcome === 'forfeit') return 'You stepped out of the trial.';
    const score = TRIAL_SCORE[receipt.trial](receipt.score);
    // A best worth the name: a score of nothing is not one.
    const best = receipt.record && receipt.score > 0 ? ' Your best yet.' : '';
    if (r.reason === 'derailed') return receipt.trial === 'gauntlet' ? `Wrecked with ${score}.${best}` : `Knocked off the rails with ${score}. This trial has to be finished on them.`;
    if (r.reason === 'late') return `The judges called time with ${score}.${receipt.trial === 'gauntlet' ? best : ''}`;
    return `${score[0].toUpperCase()}${score.slice(1)}.${best}`;
  }
  if (receipt.kind === 'open' && receipt.outcome !== 'forfeit' && !r.derailed) {
    const champ = receipt.champion;
    const tail = champ ? (champ.beaten ? ` You finished ahead of ${champ.name}, ${champ.title}.` : ` ${champ.name}, ${champ.title}, finished ahead of you.`) : '';
    if (receipt.outcome === 'won') return `First home of ${r.field}.${receipt.trophy ? ` The ${receipt.trophy} trophy is yours.` : ''}${tail}`;
    return `You finished ${place(r.place)} of ${r.field}${receipt.outcome === 'placed' ? ' and take a share of the purse' : ''}.${tail}`;
  }
  if (receipt.kind === 'bounty' && r.boss && receipt.outcome !== 'forfeit') {
    const left = Math.round((r.boss.hull / r.boss.hullMax) * 100);
    if (r.boss.slain) return `${r.boss.name} is brought down after ${fmt(r.boss.seconds)} seconds of fighting.${receipt.firstKill ? ' The bounty is yours in full.' : ''}`;
    if (!r.boss.met) return `The run ended before ${r.boss.name} showed itself.`;
    if (r.derailed) return `${r.boss.name} knocked you off the rails with ${left}% of its hull left.`;
    return `${r.boss.name} got away with ${left}% of its hull left. No bounty for a boss still on the line.`;
  }
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
  const contest = !!receipt.contest || !!receipt.trial;
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
        {receipt.trophy ? (
          <div className="licence-up relic-up trophy-up">
            <Trophy aria-hidden="true" />
            <div>
              <b>Trophy won: {receipt.trophy}</b>
              <span className="small">It pays the winner's purse again, and it counts towards your empire rating for good.</span>
            </div>
          </div>
        ) : null}
        {receipt.trial && receipt.lines.length ? (
          <p className="note">
            {receipt.lines.map((line) => `${line.label}: ${ltWhole(line.lt)} LT`).join(' · ')}
          </p>
        ) : null}
        {receipt.relic ? (
          <div className="licence-up relic-up">
            <Gem aria-hidden="true" />
            <div>
              <b>Relic won: {receipt.relic.name}</b>
              <span className="small">
                It forges {MODELS[receipt.relic.forges].name} for {ltWhole(B.MYTHIC[receipt.relic.forges].forge.price)} LT in the Hall of Legends at the Station.
              </span>
            </div>
          </div>
        ) : null}
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
                <dt>{receipt.kind === 'contract' ? 'Purse (the prize is contracts)' : receipt.kind === 'race' || receipt.kind === 'open' ? 'Purse (top three only)' : receipt.kind === 'bounty' ? 'Bounty (only for a boss brought down)' : 'Pay'}</dt>
                <dd>0 LT</dd>
              </>
            ) : null}
            <dt>
              Fuel burned: {fmt(r.fuelUsed, 1)} gal{r.emergencyGallons ? ` (${fmt(r.emergencyGallons)} gal trucked in)` : ''}
            </dt>
            <dd className="stop">-{lt(receipt.fuelCost)} LT</dd>
            {receipt.entryFee ? (
              <>
                <dt>Entry fee (paid at the start line)</dt>
                <dd className="stop">-{lt(receipt.entryFee)} LT</dd>
              </>
            ) : null}
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
          {/* Fuel on the house (festival contests, trials, the test drive) goes back to nobody's reserve. */}
          {!demo && !contest ? (
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
              {r.kills ? (
                <div className="stat">
                  <span className="label">Knocked off by you</span>
                  <b>
                    {r.kills}
                    {/* Trials and festival contests pay their medal's XP and nothing else. */}
                    {receipt.kind === 'trial' || receipt.contest ? null : <small>+{fmt(r.kills * B.COMBAT.derailXp)} XP</small>}
                  </b>
                </div>
              ) : null}
            </>
          ) : null}
          {r.boss?.met ? (
            <div className="stat">
              <span className="label">{r.boss.name}</span>
              <b className={r.boss.slain ? 'go' : 'stop'}>
                {r.boss.slain ? 'Down' : `${Math.round((r.boss.hull / r.boss.hullMax) * 100)}% left`}
                {r.boss.broken ? <small>{r.boss.broken} broken</small> : null}
              </b>
            </div>
          ) : null}
          {r.dodges ? (
            <div className="stat">
              <span className="label">Dodged</span>
              <b>{r.dodges}</b>
            </div>
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
        {receipt.trial ? (
          <button type="button" className="btn btn-brass btn-lg grow" onClick={() => go('jobs', { tab: 'races:trials' })}>
            Back to the Proving Grounds
            <ArrowRight aria-hidden="true" />
          </button>
        ) : contest ? (
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

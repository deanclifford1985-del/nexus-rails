import React from 'react';
import { Flag, Mountain, Swords, Timer } from 'lucide-react';
import { B } from '../game/balance.js';
import { useGame } from '../state/store.jsx';
import { TRIAL_IDS, trialConfig, trialRecord } from '../game/trials.js';
import { fmt, ltWhole } from '../ui/format.js';

// The Proving Grounds: three trials that are always open, each with three medals.

const ICON = { gauntlet: Mountain, timetrial: Timer, brawl: Swords };
const need = (id, at) => (id === 'timetrial' ? `in ${at} seconds or less` : id === 'gauntlet' ? `${at} obstacles shot or crushed` : `${at} raider${at === 1 ? '' : 's'} put off the rails by you`);
// "Run the Time Trial", but "Run The Gauntlet".
const runLabel = (name) => (name.startsWith('The ') ? `Run ${name}` : `Run the ${name}`);
const scoreText = (id, score) => (id === 'timetrial' ? `${fmt(score, 1)} s` : id === 'gauntlet' ? `${score} cleared` : `${score} knocked off`);

export function Medal({ medal }) {
  return <span className={`medal ${medal}`}>{medal === 'none' ? 'No medal' : medal}</span>;
}

export default function Trials() {
  const { conductor, go } = useGame();
  const P = B.TRIALS.prizes;
  return (
    <div className="stack">
      <p className="muted">
        The Proving Grounds never close. Fuel and rounds are on the house and nothing is lost by trying, so try as often as you like: only your best counts. Each medal pays once (a first gold pays the bronze and silver you skipped), and every medal counts towards your empire rating.
      </p>
      <div className="row" style={{ gap: 8 }}>
        {['gold', 'silver', 'bronze'].map((m) => (
          <span className="chip" key={m}>
            <Medal medal={m} /> {ltWhole(P[m].lt)} LT, {P[m].xp} XP{P[m].weapon ? `, ${P[m].weapon} weapon` : ''}
          </span>
        ))}
      </div>
      <div className="grid">
        {TRIAL_IDS.map((id) => {
          const t = B.TRIALS[id];
          const Icon = ICON[id];
          const record = trialRecord(conductor, id);
          return (
            <article className="plate riveted stack-sm" key={id}>
              <div className="spread">
                <h3>
                  <Icon aria-hidden="true" style={{ width: 18, height: 18, verticalAlign: '-3px' }} /> {t.name}
                </h3>
                <Medal medal={record.medal ?? 'none'} />
              </div>
              <p className="muted small">{t.blurb}</p>
              <div className="small num">
                {t.tiers.map((tier) => (
                  <div key={tier.medal} className="spread">
                    <Medal medal={tier.medal} />
                    <span>{need(id, tier.at)}</span>
                  </div>
                ))}
              </div>
              <span className="small muted">
                {record.best !== null && record.best !== undefined ? (
                  <>
                    Your best: <b className="go">{scoreText(id, record.best)}</b> in {record.runs} run{record.runs === 1 ? '' : 's'}.
                  </>
                ) : (
                  'Not run yet.'
                )}{' '}
                {id === 'gauntlet'
                  ? `The run ends at the line, after ${t.seconds / 60} minutes, or when you are wrecked: what you had cleared by then counts. One you crash into does not.`
                  : 'Finish on the rails or there is no medal.'}
              </span>
              <button type="button" className="btn btn-ember btn-block" onClick={() => go('race', { ctx: { kind: 'trial', trial: id }, config: trialConfig(conductor, id), run: { title: t.name } })}>
                <Flag aria-hidden="true" />
                {runLabel(t.name)}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

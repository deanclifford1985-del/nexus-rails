import React from 'react';
import { Check, FlaskConical, Pause, Play } from 'lucide-react';
import { B } from '../game/balance.js';
import { useGame } from '../state/store.jsx';
import { RESEARCH, researchRates } from '../game/economy.js';
import { fmtSpan } from '../game/calendar.js';
import { hasTrait } from '../game/traits.js';
import { Meter, Stat } from '../ui/bits.jsx';
import { fmt, ltWhole } from '../ui/format.js';

const TIERS = B.RESEARCH.costs.length;
const realHours = (gameMinutes) => gameMinutes / B.CALENDAR.driftGameMinutesPerRealMinute / 60;

export default function Research() {
  const { conductor, act, notify } = useGame();
  const active = conductor.research.active;
  const sample = researchRates(conductor, 0);

  function start(category) {
    const report = act('startResearch', { category });
    if (report && !report.resumed) notify(`Research started: ${fmtSpan(report.minutes)} on the calendar.`, 'good');
  }

  return (
    <div className="stack lab">
      <div className="page-head">
        <h1>
          Research <span className="hl-purple">Lab</span>
        </h1>
        <p>
          Pay once to start, then the work runs on the calendar: through your runs, your rests, and while you are away (1 real hour is {B.CALENDAR.driftGameMinutesPerRealMinute} hours on the line). Start a project before you log off. One at a time; a paused project keeps its progress and resumes for free.
        </p>
      </div>

      <section className="plate stack">
        <div className="stats">
          <Stat label="Intelligence" value={conductor.int} />
          <Stat label="Speed" value={`+${fmt((sample.speed - 1) * 100)}`} unit="%" tone="brass" />
          <Stat label="Price cut" value={`${fmt((1 - 1 / sample.match) * 100, 1)}`} unit="%" tone="brass" />
        </div>
        <span className="muted small">Each point of Intelligence adds 1% speed and cuts the price by about 0.5%.{hasTrait(conductor, 'genius') ? ' Genius adds 15% speed.' : ''}</span>
      </section>

      <div className="grid">
        {Object.entries(RESEARCH).map(([category, info]) => {
          const done = conductor.research.done[category] ?? 0;
          const complete = done >= TIERS;
          const running = active?.category === category;
          const paused = conductor.research.paused?.[category];
          const tier = Math.min(done, TIERS - 1);
          const rates = researchRates(conductor, tier);
          const project = running ? active : paused?.tier === tier ? paused : null;
          const left = project ? project.minutes - project.done : rates.minutes;
          return (
            <article className="plate riveted stack-sm" key={category}>
              <div className="spread">
                <h3>
                  <FlaskConical aria-hidden="true" style={{ width: 17, height: 17, verticalAlign: '-3px' }} /> {info.name}
                </h3>
                <span className="chip">
                  Tier {done} of {TIERS}
                </span>
              </div>
              <span className="muted">{info.bonus ?? `Unlocks ${info.unlocks}, two stages per tier.`}</span>
              {complete ? (
                <p className="note small">
                  <Check aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> Complete. {info.bonus ? 'Every tier is in force.' : 'All six stages are open.'}
                </p>
              ) : (
                <>
                  <div className="spread small">
                    <span className="label">Tier {done + 1}</span>
                    <span className="num">{project ? `${fmt((project.done / project.minutes) * 100)}% done` : `${ltWhole(rates.price)} LT`}</span>
                  </div>
                  <Meter value={project?.done ?? 0} max={project?.minutes ?? rates.minutes} tone={running ? 'ember' : ''} label={`Tier ${done + 1} progress`} />
                  <div className="spread small muted num">
                    <span>{fmtSpan(left)} on the calendar</span>
                    <span>about {fmt(realHours(left), 0)} real hours away</span>
                  </div>
                  {running ? (
                    <button type="button" className="btn btn-block" onClick={() => act('pauseResearch')}>
                      <Pause aria-hidden="true" />
                      Pause, keep progress
                    </button>
                  ) : (
                    <button type="button" className="btn btn-arcane btn-block" disabled={!!active || (!project && conductor.lt < rates.price)} onClick={() => start(category)}>
                      <Play aria-hidden="true" />
                      {project ? 'Resume research' : `Start for ${ltWhole(rates.price)} LT`}
                    </button>
                  )}
                </>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

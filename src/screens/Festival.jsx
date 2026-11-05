import React, { useState } from 'react';
import { Dumbbell, Flag, Gauge, Minus, PartyPopper, Plus, Target } from 'lucide-react';
import { useGame } from '../state/store.jsx';
import { activeLoco } from '../game/conductor.js';
import { deriveStats } from '../game/locomotives.js';
import { festivalInfo, fmtDate, fmtSpan } from '../game/calendar.js';
import { CONTESTS, PRIZES, contestConfig } from '../game/festival.js';
import { TowMeter } from '../ui/Impact.jsx';
import { fmt, lb } from '../ui/format.js';

const ICON = { pull: Dumbbell, speed: Gauge, wall: Target };

function Medal({ medal }) {
  return <span className={`medal ${medal}`}>{medal === 'none' ? 'No medal' : medal}</span>;
}

export default function Festival() {
  const { conductor, go } = useGame();
  const fest = festivalInfo(conductor.clock ?? 0);
  const loco = activeLoco(conductor);
  const stats = deriveStats(loco, conductor);
  const entered = conductor.festival?.id === fest.id ? conductor.festival.entered : {};
  const step = 5000;
  const [load, setLoad] = useState(() => Math.max(step, Math.floor((stats.tow * 0.6) / step) * step));
  const maxLoad = Math.floor(stats.tow / stats.cargoFactor / step) * step;

  if (!fest.active) {
    return (
      <div className="stack">
        <div className="page-head">
          <span className="label">Locomotive Festival</span>
          <h1>The fairground is quiet</h1>
          <p>The next Locomotive Festival opens on {fmtDate(fest.nextAt)}, in {fmtSpan(fest.nextAt - conductor.clock)}. It runs for three days, every three months.</p>
        </div>
      </div>
    );
  }

  function enter(id) {
    const ctx = { kind: id, festival: fest.id, load: id === 'pull' ? load : 0 };
    go('race', { ctx, config: contestConfig(conductor, id, fest.id, { cargoLb: ctx.load }), run: { title: CONTESTS[id].name } });
  }

  return (
    <div className="stack">
      <div className="page-head">
        <span className="label">
          <PartyPopper aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> Locomotive Festival
        </span>
        <h1>
          Locomotive <span className="hl-orange">Festival</span>
        </h1>
        <p>
          Three days of contests, games and prizes, open until {fmtDate(fest.endsAt)} ({fmtSpan(fest.endsAt - conductor.clock)} left). Each contest can be entered once. Fuel and rounds are on the house; gold wins an Epic weapon, silver a Rare one.
        </p>
      </div>
      <div className="row" style={{ gap: 8 }}>
        {['gold', 'silver', 'bronze'].map((m) => (
          <span className="chip" key={m}>
            <Medal medal={m} /> {fmt(PRIZES[m].lt)} LT, {PRIZES[m].xp} XP{PRIZES[m].weapon ? `, ${PRIZES[m].weapon} weapon` : ''}
          </span>
        ))}
      </div>

      <div className="grid">
        {Object.entries(CONTESTS).map(([id, c]) => {
          const Icon = ICON[id];
          const done = entered[id];
          const noWeapon = id === 'wall' && stats.arms.filter((a) => a !== 'barrier' && a !== 'shield').length === 0;
          return (
            <article className="plate riveted stack-sm" key={id}>
              <div className="spread">
                <h3>
                  <Icon aria-hidden="true" style={{ width: 18, height: 18, verticalAlign: '-3px' }} /> {c.name}
                </h3>
                {done ? <Medal medal={done} /> : null}
              </div>
              <p className="muted small">{c.blurb}</p>
              {c.tiers ? (
                <div className="small num">
                  {c.tiers.map((t) => (
                    <div key={t.medal} className="spread">
                      <Medal medal={t.medal} />
                      <span>{id === 'pull' ? `${lb(t.at)} lb or more` : `under ${t.at} s`}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="small">Gold, silver and bronze for the top three.</p>
              )}
              {id === 'pull' && !done ? (
                <div className="stack-sm">
                  <div className="spread">
                    <div className="steppers" role="group" aria-label="Load to pull">
                      <button type="button" className="btn btn-sm" disabled={load <= step} onClick={() => setLoad(load - step)} aria-label="Lighter">
                        <Minus aria-hidden="true" />
                      </button>
                      <b className="num" style={{ minWidth: 90, textAlign: 'center' }}>
                        {lb(load)} lb
                      </b>
                      <button type="button" className="btn btn-sm" disabled={load + step > maxLoad} onClick={() => setLoad(load + step)} aria-label="Heavier">
                        <Plus aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <TowMeter cargoLb={load * stats.cargoFactor} tow={stats.tow} />
                  <p className="small muted">Fail to get it home in 15 minutes on the line and there is no medal. Heavier is slower.</p>
                </div>
              ) : null}
              {noWeapon ? <p className="note warn small">You need a weapon or an attack spell fitted for the wall. Visit the Armory.</p> : null}
              {done ? (
                <p className="note small">Entered. Come back next festival for another try.</p>
              ) : (
                <button type="button" className="btn btn-ember btn-block" disabled={noWeapon} onClick={() => enter(id)}>
                  <Flag aria-hidden="true" />
                  Enter the {c.name}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

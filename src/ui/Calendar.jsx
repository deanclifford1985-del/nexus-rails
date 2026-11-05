import React from 'react';
import { CalendarDays, PartyPopper } from 'lucide-react';
import { useGame } from '../state/store.jsx';
import { dateOf, festivalInfo, fmtDate, fmtSpan, fmtTime } from '../game/calendar.js';
import { RESEARCH } from '../game/economy.js';

// Where the calendar stands: today, the next festival, and a way to let time pass.
export function CalendarCard() {
  const { conductor, act, go, notify } = useGame();
  const clock = conductor.clock ?? 0;
  const fest = festivalInfo(clock);
  const d = dateOf(clock);
  const active = conductor.research.active;
  function rest(hours) {
    const report = act('rest', { hours });
    if (report?.researchDone) notify(`${RESEARCH[report.researchDone.category].name} tier ${report.researchDone.tier} complete.`, 'good');
  }
  return (
    <section className={`plate stack-sm ${fest.active ? 'festival-on' : ''}`}>
      <div className="spread">
        <div>
          <span className="label">
            <CalendarDays aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> The calendar
          </span>
          <h3>{fmtDate(clock)}</h3>
          <span className="muted small num">
            {fmtTime(clock)}, week {d.week + 1}
          </span>
        </div>
        {fest.active ? (
          <button type="button" className="btn btn-ember" onClick={() => go('festival')}>
            <PartyPopper aria-hidden="true" />
            The Festival is on
          </button>
        ) : (
          <span className="chip">Festival in {fmtSpan(fest.nextAt - clock)}</span>
        )}
      </div>
      <p className="small muted">
        Every run takes its trip time plus a day and a bit to turn around, and the calendar keeps moving while you are away (1 real hour is 4 hours on the line). The board, depot, station and armory change every week. {active ? `Research is running: ${fmtSpan(active.minutes - active.done)} to go.` : ''}
      </p>
      <div className="row">
        <button type="button" className="btn btn-sm" onClick={() => rest(12)}>
          Rest 12 hours
        </button>
        <button type="button" className="btn btn-sm" onClick={() => rest(24 * 3)}>
          Rest 3 days
        </button>
      </div>
    </section>
  );
}

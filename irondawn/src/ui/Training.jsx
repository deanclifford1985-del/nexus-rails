import React from 'react';
import { Award, ChevronRight, GraduationCap, RotateCcw, Target } from 'lucide-react';
import { EVENTS, eventOf } from '../game/training.js';
import { RANKS } from '../game/ranks.js';
import { B } from '../game/balance.js';
import { memberLabel, ROLES } from '../game/squad.js';
import { AttrIcon, Bar, Btn, Chip, Insignia, Kv, Panel, Section, cx } from './bits.jsx';
import { useHost, useUi } from './context.jsx';
import { attrName, duration, num } from './format.js';

// What happened in an evaluation, in plain words.
function detailRows(event, detail) {
  if (!detail) return [];
  if (event === 'range') {
    return [
      ['Targets hit', `${detail.hits} of ${detail.total}`],
      ['Long targets hit', `${detail.longHits} of ${detail.longTotal}`],
      ['Average time to hit', detail.avgReact ? `${detail.avgReact.toFixed(2)} s` : '—'],
    ];
  }
  if (event === 'obstacle') {
    return [
      ['Time', detail.finished ? `${detail.time.toFixed(1)} s` : 'Did not finish'],
      ['Par', `${B.TRAINING.OBSTACLE_PAR} s`],
      ['Times winded', `${detail.faults}`],
    ];
  }
  if (event === 'stealth') {
    return [
      ['Reached the flag', detail.reached ? 'Yes' : 'No'],
      ['Strikes', `${detail.strikes} of ${B.TRAINING.STEALTH_STRIKES}`],
      ['Time', duration(detail.time)],
    ];
  }
  if (event === 'observation') {
    return [
      ['Dummies tagged', `${detail.found} of ${detail.total}`],
      ['Time left', `${Math.round(detail.timeLeft)} s`],
    ];
  }
  return [];
}

export function TrainingResult({ event, report, result }) {
  const { open } = useUi();
  const host = useHost();
  const def = eventOf(event);
  const bonuses = Object.entries(report.bonuses ?? {}).filter(([, n]) => n > 0);
  const again = () => (event === 'exam' ? open('exam', {}) : host.run({ type: 'training', id: event }));
  const tone = report.score >= 75 ? 'gold' : undefined;
  return (
    <Panel
      size="sm"
      tone={tone}
      icon={Target}
      kicker={def?.place}
      title={def?.name ?? 'Evaluation'}
      foot={
        <>
          <Btn tone="ghost" icon={RotateCcw} onClick={again}>
            Try again
          </Btn>
          <Btn tone="primary" icon={ChevronRight} onClick={() => host.resume()}>
            Continue
          </Btn>
        </>
      }
    >
      <div className="res-score">
        <div className={cx('res-ring', report.score >= 90 && 'is-top')}>
          <b>{report.score}</b>
          <span>of 100</span>
        </div>
        <div>
          <strong className="res-grade">{report.grade}</strong>
          {report.refresher ? (
            <p className="ui-muted ui-p">Refresher course. {report.record ? 'A new personal best.' : 'Practice counts toward the skills it uses.'}</p>
          ) : report.kept ? (
            <p className="ui-muted ui-p">Your earlier score of {report.best} stands. Only your best counts.</p>
          ) : report.improved ? (
            <p className="ui-muted ui-p">Better than before. Your baseline has been raised to match.</p>
          ) : (
            <p className="ui-muted ui-p">This sets part of your baseline. You may retake it before you graduate; the best score is kept.</p>
          )}
        </div>
      </div>
      {detailRows(event, result?.detail).length ? (
        <Section title="What happened">
          {detailRows(event, result.detail).map(([label, value]) => (
            <Kv key={label} label={label} value={value} />
          ))}
        </Section>
      ) : null}
      {event === 'exam' && result?.marked ? (
        <Section title="Marked paper">
          <p className="ui-p">
            {result.best} of {result.marked.length} best answers.
          </p>
          {result.marked
            .filter((m) => !m.right)
            .slice(0, 3)
            .map((m) => (
              <p key={m.id} className="ui-muted ui-small ui-p">
                {m.why}
              </p>
            ))}
        </Section>
      ) : null}
      {bonuses.length ? (
        <Section title={report.kept ? 'Baseline from your best run' : 'Baseline gained'}>
          <div className="res-gains">
            {bonuses.map(([attr, n]) => (
              <span key={attr} className="res-gain">
                <AttrIcon id={attr} /> {attrName(attr)} <b>+{n}</b>
              </span>
            ))}
          </div>
        </Section>
      ) : null}
      {(report.ups ?? []).length ? (
        <Section title="Skills improved">
          <div className="res-gains">
            {report.ups.map((up) => (
              <span key={up.attr} className="res-gain">
                <AttrIcon id={up.attr} /> {attrName(up.attr)} <b>{up.to}</b>
              </span>
            ))}
          </div>
        </Section>
      ) : null}
      {report.summary ? (
        <Section title="Basic training">
          <div className="res-events">
            {EVENTS.map((e) => (
              <Chip key={e.id} tone={report.summary.remaining.includes(e.id) ? undefined : 'good'}>
                {e.name}
              </Chip>
            ))}
          </div>
          {report.summary.complete ? <p className="ui-gold ui-p">All five complete. Report to Drill Sergeant Briggs to graduate.</p> : null}
        </Section>
      ) : null}
    </Panel>
  );
}

export function Graduation({ report }) {
  const host = useHost();
  return (
    <Panel
      size="sm"
      tone="gold"
      icon={GraduationCap}
      kicker="Camp Hawthorne"
      title={report.honors ? 'Honor Graduate' : 'Graduation'}
      foot={
        <Btn tone="gold" icon={ChevronRight} onClick={() => host.run({ type: 'overlay', name: 'dialog', id: 'graduation' })}>
          Fall in
        </Btn>
      }
    >
      <div className="res-score">
        <Insignia rank={1} size={84} />
        <div>
          <strong className="res-grade">Private</strong>
          <p className="ui-p">You are a soldier of the Corvane Defence Force.</p>
        </div>
      </div>
      <Kv label="Average score" value={report.average} />
      <Kv label="Graduation pay" value={`${num(report.rp)} RP`} tone="gold" />
      {report.honors ? <p className="ui-gold ui-p">Top of the cycle. The quartermaster has doubled your graduation pay.</p> : null}
      <p className="ui-muted ui-p">The scores you set are now your baseline. From here every skill grows with use in the field, and each level gives you points to place where you choose.</p>
    </Panel>
  );
}

export function Promotion({ report }) {
  const host = useHost();
  const rank = RANKS[report.to];
  return (
    <Panel
      size="sm"
      tone="gold"
      icon={Award}
      kicker="By order of Colonel Adeyemi"
      title="Promoted"
      foot={
        <Btn tone="gold" icon={ChevronRight} onClick={() => host.resume()}>
          Carry on
        </Btn>
      }
    >
      <div className="res-score">
        <Insignia rank={report.to} size={92} />
        <div>
          <strong className="res-grade">{rank.name}</strong>
          <p className="ui-p">{rank.duty}</p>
        </div>
      </div>
      <Kv label="Promotion pay" value={`${num(report.bonus)} RP`} tone="gold" />
      <Kv label="Soldiers you may lead" value={rank.squad} />
      <Kv label="Quartermaster shelf" value={`Tier ${rank.tier}`} />
      {(rank.supports ?? []).length ? <Kv label="Support on call" value={rank.supports.length} /> : null}
      {report.recruit ? (
        <p className="ui-p ui-good">
          {memberLabel(report.recruit)}, a {ROLES[report.recruit.role].name.toLowerCase()}, has been assigned to you. Find more at the barracks.
        </p>
      ) : null}
    </Panel>
  );
}

export function ProgressBar({ share }) {
  return <Bar share={share} tone="gold" />;
}

import React, { useState } from 'react';
import { ArrowLeft, ChevronRight, ClipboardList, Flag, Lock, Map as MapIcon, RotateCcw, Star } from 'lucide-react';
import { CHAPTERS, MISSION_TYPES, STORY, contractsFor, missionById, missionLock, nextStory, planCost, planFor, recommendedRating, storyDone } from '../game/missions.js';
import { RANKS, nextRankGap } from '../game/ranks.js';
import { activeSquad, memberLabel, ROLES } from '../game/squad.js';
import { locationOf } from '../game/world.js';
import { medalOf } from '../game/medals.js';
import { Bar, Btn, Chip, Insignia, Kv, MissionIcon, Panel, Section, TierPips, cx } from './bits.jsx';
import { useHost, useUi } from './context.jsx';
import { clock, dayPart, duration, forceText, num } from './format.js';

const ratingTone = (mine, wanted) => (mine >= wanted ? 'good' : mine >= wanted * 0.85 ? 'gold' : 'bad');

function MissionCard({ mission, gold, lock, rating, onPick }) {
  const wanted = recommendedRating(mission);
  return (
    <button type="button" className={cx('ops-card', gold && 'is-gold', lock && 'is-locked')} onClick={onPick}>
      <span className="ops-card-icon">
        <MissionIcon type={mission.type} size={22} />
      </span>
      <span className="ops-card-main">
        <strong>{mission.name}</strong>
        <span>
          {MISSION_TYPES[mission.type].name} · {locationOf(mission.site).name}
        </span>
        <span className="ops-card-meta">
          <TierPips tier={mission.tier} />
          <em className={`ui-${ratingTone(rating, wanted)}`}>Rating {wanted}</em>
          <em>{num(mission.xp)} XP</em>
          <em>{num(mission.rp)} RP</em>
        </span>
        {lock ? (
          <span className="ops-card-lock">
            <Lock size={13} aria-hidden="true" /> {lock}
          </span>
        ) : null}
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  );
}

// The operations board in the command tent.
export function OpsBoard() {
  const { save, derived, open } = useUi();
  const host = useHost();
  const next = nextStory(save);
  const contracts = contractsFor(save);
  const chapter = next ? CHAPTERS.find((c) => c.id === next.chapter) : null;
  const done = STORY.filter((m) => storyDone(save, m.id)).length;
  const gap = nextRankGap(save);
  return (
    <Panel
      size="lg"
      tall
      icon={ClipboardList}
      kicker="Command tent · Captain Marsh"
      title="Operations board"
      onClose={() => host.resume()}
      side={
        <span className="ops-rating">
          Your rating <b>{derived.rating}</b>
        </span>
      }
    >
      <Section title={chapter ? chapter.name : 'Campaign complete'} side={`${done} of ${STORY.length} operations`}>
        <Bar share={done / STORY.length} tone="gold" />
        {next ? (
          <div className="ops-list">
            <MissionCard mission={next} gold rating={derived.rating} lock={missionLock(save, next)} onPick={() => open('briefing', { missionId: next.id })} />
          </div>
        ) : (
          <p className="ui-p ui-gold" style={{ marginTop: 10 }}>
            The Citadel has fallen. Contracts remain for as long as you want them.
          </p>
        )}
        {gap && gap.xpLeft > 0 ? (
          <p className="ui-muted ui-small ui-p" style={{ marginTop: 8 }}>
            {num(gap.xpLeft)} XP to {gap.rank.name}.
          </p>
        ) : null}
      </Section>
      <Section title="Contracts" side="A new list after each one completed">
        <div className="ops-list">
          {contracts.map((mission) => (
            <MissionCard key={mission.id} mission={mission} rating={derived.rating} lock={missionLock(save, mission)} onPick={() => open('briefing', { missionId: mission.id })} />
          ))}
        </div>
      </Section>
    </Panel>
  );
}

// The briefing table: what the job is, who goes, and what your planning buys.
export function Briefing({ missionId }) {
  const { save, derived, open } = useUi();
  const host = useHost();
  const mission = missionById(save, missionId);
  const [picked, setPicked] = useState([]);
  if (!mission) {
    return (
      <Panel size="xs" title="Off the board" onClose={() => open('ops', {})}>
        <p>That operation is no longer available.</p>
      </Panel>
    );
  }
  const table = planFor(mission, derived);
  const spent = planCost(picked);
  const lock = missionLock(save, mission);
  const wanted = recommendedRating(mission);
  const squad = activeSquad(save);
  const site = locationOf(mission.site);
  const toggle = (option) => {
    if (picked.includes(option.id)) setPicked(picked.filter((id) => id !== option.id));
    else if (spent + option.cost <= table.points) setPicked([...picked, option.id]);
  };
  const hour = picked.includes('night') ? 1 : (mission.hour ?? save.world.hour);
  let going;
  if (mission.squad === 'none') going = 'You go alone.';
  else if (mission.squad === 'attached') going = `You are attached to ${mission.leader}’s section${mission.allies ? `: ${forceText(mission.allies)}` : ''}. They follow your lead in the field but take no orders.`;
  else if (squad.length) going = `Your squad: ${squad.map((m) => `${memberLabel(m)} (${ROLES[m.role].name.toLowerCase()})`).join(', ')}.`;
  else going = RANKS[save.rank].squad > 0 ? 'You have nobody on your active squad. Visit the barracks first, or go alone.' : 'You go alone: you lead a squad from the rank of Corporal.';
  return (
    <Panel
      size="lg"
      tall
      tone={mission.contract ? undefined : 'gold'}
      icon={MapIcon}
      kicker={`${mission.contract ? 'Contract' : 'Campaign'} · ${MISSION_TYPES[mission.type].name}`}
      title={mission.name}
      onClose={() => host.resume()}
      foot={
        <>
          <Btn tone="ghost" icon={ArrowLeft} onClick={() => open('ops', {})}>
            Back to the board
          </Btn>
          <span className="ui-foot-note">{lock ?? `Insertion at ${clock(hour)} (${dayPart(hour).toLowerCase()}).`}</span>
          <Btn tone="gold" icon={Flag} disabled={!!lock} onClick={() => host.call('startMission', mission.id, picked)}>
            Deploy
          </Btn>
        </>
      }
    >
      <div className="brief">
        <div className="brief-main">
          <p className="brief-text">{mission.brief}</p>
          <Section title="Intelligence">
            <p className="ui-p">{mission.intel}</p>
            <div className="ui-row">
              <Chip>{site.name}</Chip>
              <TierPips tier={mission.tier} />
              <Chip tone={ratingTone(derived.rating, wanted)}>
                Recommended rating {wanted} · yours {derived.rating}
              </Chip>
            </div>
          </Section>
          <Section title="Objectives">
            <ol className="brief-objectives">
              {mission.objectives.map((o) => (
                <li key={o.id}>{o.text}</li>
              ))}
            </ol>
            {(mission.bonus ?? []).map((b) => (
              <p key={b.id} className="brief-bonus">
                <Star size={14} aria-hidden="true" /> {b.text} <em>+{b.xp} XP</em>
              </p>
            ))}
          </Section>
          <Section title="Who goes">
            <p className="ui-p">{going}</p>
            {mission.issue ? <p className="ui-p ui-muted">The armoury issues a rifle for this one. Your own weapons stay at camp.</p> : null}
          </Section>
        </div>
        <aside className="brief-side">
          <Section title="Plan" side={`${table.points - spent} of ${table.points} plan point${table.points === 1 ? '' : 's'} left`}>
            <p className="ui-muted ui-small ui-p">Plan points come from your Planning ({Math.round(derived.planning)}): Intelligence, Leadership and Communication. Without spending any, planning already marks {Math.round(table.reveal * 100)}% of the garrison.</p>
            <div className="brief-plan">
              {table.options.map((option) => {
                const on = picked.includes(option.id);
                const cant = !on && spent + option.cost > table.points;
                return (
                  <button key={option.id} type="button" className={cx('plan-option', on && 'is-on')} disabled={cant} onClick={() => toggle(option)} aria-pressed={on}>
                    <span className="plan-cost">{option.cost}</span>
                    <span>
                      <strong>{option.name}</strong>
                      <span>{option.text}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>
          <Section title="Pay">
            <Kv label="Experience" value={`${num(mission.xp)} XP`} />
            <Kv label="Requisition" value={`${num(Math.round(mission.rp * derived.payMul))} RP`} />
            <Kv label="Rank pay" value={`${Math.round(80 * RANKS[save.rank].pay)} RP`} />
          </Section>
        </aside>
      </div>
    </Panel>
  );
}

// After the mission: what it paid and what it cost.
export function Debrief({ report, stats, mission }) {
  const host = useHost();
  const won = report.success;
  const r = report.rewards;
  const accuracy = stats.shots > 0 ? Math.round((stats.hits / stats.shots) * 100) : 0;
  return (
    <Panel
      size="md"
      tall
      tone={won ? 'gold' : 'red'}
      icon={Flag}
      kicker={`${MISSION_TYPES[mission.type].name} · ${locationOf(mission.site).name}`}
      title={won ? 'Mission complete' : 'Mission failed'}
      foot={
        <>
          {!won ? (
            <Btn tone="ghost" icon={RotateCcw} onClick={() => host.call('retryMission')}>
              Try again
            </Btn>
          ) : null}
          <Btn tone={won ? 'gold' : 'primary'} icon={ChevronRight} onClick={() => host.call('returnToBase')}>
            Return to camp
          </Btn>
        </>
      }
    >
      {won ? (
        <div className="res-score">
          <div className={cx('res-ring', r.grade.grade === 'S' && 'is-top')}>
            <b>{r.grade.grade}</b>
            <span>{r.grade.score} pts</span>
          </div>
          <div>
            <strong className="res-grade">{mission.name}</strong>
            <p className="ui-muted ui-p">Pay is multiplied by {r.grade.mult.toFixed(2)} for the grade.</p>
          </div>
        </div>
      ) : (
        <p className="brief-text ui-bad">{stats.reason ?? 'The operation did not succeed.'}</p>
      )}
      {won ? (
        <Section title="How it went">
          {r.grade.notes.map((note) => (
            <Kv key={note.text} label={note.text} value={`${note.points > 0 ? '+' : ''}${note.points}`} tone={note.points >= 0 ? 'good' : 'bad'} />
          ))}
        </Section>
      ) : null}
      <Section title="Earned">
        {won ? <Kv label="Mission" value={`${num(r.xp)} XP`} /> : null}
        {won && r.bonusXp ? <Kv label="Bonus objectives" value={`${num(r.bonusXp)} XP`} tone="gold" /> : null}
        <Kv label={won ? 'Enemies accounted for' : 'Enemies accounted for (part kept)'} value={`${num(won ? r.killXp : r.xp)} XP`} />
        <Kv label="Total with Intelligence" value={`${num(report.xp)} XP`} tone="gold" />
        {won ? <Kv label="Requisition and rank pay" value={`${num(r.rp + r.salary)} RP`} tone="gold" /> : null}
        {!won && r.bill ? <Kv label="Medical bill" value={`−${num(r.bill)} RP`} tone="bad" /> : null}
        {report.levels > 0 ? <p className="ui-gold ui-p">Level {report.level}. {report.points} attribute points to spend in the field menu (Tab).</p> : null}
        {report.dueRank ? (
          <p className="debrief-due">
            <Insignia rank={report.due} size={34} /> Promotion to {report.dueRank.name} is due. Report to Colonel Adeyemi at headquarters.
          </p>
        ) : null}
      </Section>
      <Section title="Field report">
        <div className="debrief-stats">
          <Kv label="Time" value={duration(stats.time)} />
          <Kv label="Kills" value={stats.kills} />
          <Kv label="Headshots" value={stats.headshots} />
          <Kv label="Silent kills" value={stats.stealthKills} />
          <Kv label="Accuracy" value={`${accuracy}%`} />
          <Kv label="Longest shot" value={`${Math.round(stats.longestShot)} m`} />
          <Kv label="Alarm" value={stats.alarm ? 'Raised' : 'Never raised'} tone={stats.alarm ? 'bad' : 'good'} />
          <Kv label="Times down" value={stats.downs} tone={stats.downs ? 'bad' : undefined} />
        </div>
      </Section>
      {report.squad.length ? (
        <Section title="Your squad">
          {report.squad.map((m) => (
            <Kv key={m.id} label={`${m.name}${m.down ? ' (wounded: out for two operations)' : ''}`} value={`${m.kills} kill${m.kills === 1 ? '' : 's'}${m.levels ? ` · level ${m.level}` : ''}`} tone={m.down ? 'bad' : m.levels ? 'gold' : undefined} />
          ))}
        </Section>
      ) : null}
      {report.medals.length || report.unlocked.length ? (
        <Section title="Of note">
          {report.medals.map((m) => (
            <p key={m.id} className="ui-gold ui-p">
              Awarded: {medalOf(m.id)?.name ?? m.name}. {m.text}
            </p>
          ))}
          {report.unlocked.map((text) => (
            <p key={text} className="ui-good ui-p">
              {text}
            </p>
          ))}
        </Section>
      ) : null}
    </Panel>
  );
}

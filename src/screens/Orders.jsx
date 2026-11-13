import React from 'react';
import { Award, Check, Gift, ListChecks } from 'lucide-react';
import { B } from '../game/balance.js';
import { useGame } from '../state/store.jsx';
import { allTasksClaimed, milestoneState, taskBonus, taskDone, taskText, taskTier, tasksOf } from '../game/tasks.js';
import { Meter, useCooldown } from '../ui/bits.jsx';
import { fmt, ltWhole } from '../ui/format.js';

// Orders: this week's four tasks, and the career milestones.

export function WeeklyOrders({ compact = false }) {
  const { conductor, act, notify, go } = useGame();
  const [cooling, cool] = useCooldown(500);
  const list = tasksOf(conductor);
  const bonus = taskBonus(conductor);
  const allClaimed = allTasksClaimed(conductor);
  const daysLeft = B.WEEK.days - (Math.floor((conductor.clock ?? 0) / 1440) % B.WEEK.days);
  const done = list.filter(taskDone).length;
  return (
    <section className={`plate stack-sm orders ${compact ? 'compact' : 'riveted'}`}>
      <div className="plate-head">
        <h3>
          <ListChecks aria-hidden="true" style={{ width: 18, height: 18, verticalAlign: '-3px' }} /> This week's orders
        </h3>
        <span className="muted small">
          {done} of {list.length} done · new orders in {daysLeft} day{daysLeft === 1 ? '' : 's'}
        </span>
      </div>
      {list.map((task) => {
        const ready = taskDone(task) && !task.claimed;
        return (
          <div className={`order ${task.claimed ? 'claimed' : ready ? 'ready' : ''}`} key={task.id}>
            <div className="grow">
              <div className="spread">
                <b>{taskText(task)}</b>
                <span className="small num">
                  {fmt(Math.floor(task.progress))} / {fmt(task.target)}
                </span>
              </div>
              <Meter value={task.progress} max={task.target} tone={taskDone(task) ? 'go' : 'ember'} thin label={taskText(task)} />
            </div>
            {task.claimed ? (
              <span className="order-done">
                <Check aria-hidden="true" /> Paid
              </span>
            ) : (
              <button
                type="button"
                className={`btn btn-sm ${ready ? 'btn-ember' : ''}`}
                disabled={!ready || cooling}
                onClick={() => {
                  const report = act('claimTask', { id: task.id });
                  cool();
                  if (report) notify(`Order paid: ${ltWhole(report.lt)} LT and ${fmt(report.xp)} XP.${report.levels ? ' Level up!' : ''}`, 'good');
                }}
              >
                {ltWhole(task.lt)} LT · {fmt(task.xp)} XP
              </button>
            )}
          </div>
        );
      })}
      <div className={`order bonus ${conductor.tasks?.bonus ? 'claimed' : allClaimed ? 'ready' : ''}`}>
        <Gift aria-hidden="true" />
        <span className="grow small">
          <b>All four done:</b> {ltWhole(bonus.lt)} LT more and a {B.RARITY[bonus.weapon].label} weapon for your shelf.
        </span>
        {conductor.tasks?.bonus ? (
          <span className="order-done">
            <Check aria-hidden="true" /> Paid
          </span>
        ) : (
          <button
            type="button"
            className={`btn btn-sm ${allClaimed ? 'btn-ember' : ''}`}
            disabled={!allClaimed || cooling}
            onClick={() => {
              const report = act('claimTaskBonus');
              cool();
              if (report) notify(`Bonus paid: ${ltWhole(report.lt)} LT and a ${report.weapon.name}.`, 'good');
            }}
          >
            Claim the bonus
          </button>
        )}
      </div>
      {compact ? (
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => go('jobs', { tab: 'orders' })}>
          Orders and milestones
        </button>
      ) : (
        <span className="small muted">Orders are sized to you (tier {taskTier(conductor) + 1} of 4: it rises with your licence and every five levels). Whatever run you make counts towards all of them at once.</span>
      )}
    </section>
  );
}

export default function Orders() {
  const { conductor, act, notify } = useGame();
  const [cooling, cool] = useCooldown(500);
  const states = Object.keys(B.MILESTONES).map((id) => milestoneState(conductor, id));
  // Ready to claim first, then the nearest to their next rung, then the finished.
  states.sort((a, b) => Number(b.ready) - Number(a.ready) || Number(a.complete) - Number(b.complete) || (b.next ? b.value / b.next : 0) - (a.next ? a.value / a.next : 0));
  return (
    <section className="stack" role="tabpanel">
      <WeeklyOrders />
      <div>
        <h2>
          <Award aria-hidden="true" style={{ width: 22, height: 22, verticalAlign: '-3px' }} /> Milestones
        </h2>
        <p className="muted">A ladder for everything a conductor does. Each rung pays once: its LocoTokens and half as much experience.</p>
      </div>
      <div className="grid">
        {states.map((state) => {
          const { def } = state;
          const rungs = def.tiers.length;
          return (
            <article className={`plate stack-sm milestone ${state.ready ? 'ready' : ''} ${state.complete ? 'complete' : ''}`} key={state.id}>
              <div className="spread">
                <h3>{def.name}</h3>
                <span className="pips" aria-label={`${state.claimed} of ${rungs} rungs claimed`}>
                  {def.tiers.map((_, i) => (
                    <i key={i} className={i < state.claimed ? 'on' : i < state.reached ? 'open' : ''} />
                  ))}
                </span>
              </div>
              <span className="small muted">
                <b className="num">{fmt(state.value)}</b> {def.text}
              </span>
              {state.complete ? (
                <p className="note small">
                  <Check aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> Every rung claimed.
                </p>
              ) : (
                <>
                  <Meter value={state.value} max={state.next} tone={state.ready ? 'go' : ''} thin label={`${def.name} progress`} />
                  <div className="spread">
                    <span className="small muted">
                      Rung {state.claimed + 1}: {fmt(state.next)}
                    </span>
                    <button
                      type="button"
                      className={`btn btn-sm ${state.ready ? 'btn-ember' : ''}`}
                      disabled={!state.ready || cooling}
                      onClick={() => {
                        const report = act('claimMilestone', { id: state.id });
                        cool();
                        if (report) notify(`${def.name}, rung ${report.tier}: ${ltWhole(report.lt)} LT and ${fmt(report.xp)} XP.${report.levels ? ' Level up!' : ''}`, 'good');
                      }}
                    >
                      {ltWhole(state.reward)} LT
                    </button>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

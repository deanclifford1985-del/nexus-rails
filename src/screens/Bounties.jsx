import React from 'react';
import { Castle, Clock, Crosshair, Flame, Gem, Lock, Shield, Skull, Snowflake, Swords, Trophy, Worm } from 'lucide-react';
import { B } from '../game/balance.js';
import { useGame } from '../state/store.jsx';
import { BOSS_IDS, bossById, bossState, bountyReward } from '../game/bosses.js';
import { MODELS } from '../game/locomotives.js';
import { lineById } from '../game/routemap.js';
import { realWait } from '../game/calendar.js';
import { Terrain } from '../ui/Terrain.jsx';
import { clock, fmt, ltWhole } from '../ui/format.js';

// The bounty board: the bosses of the line, what they do, and what bringing them down is worth.

export const BOSS_ICON = { rustjaw: Skull, frostmaw: Snowflake, devourer: Worm, bastion: Castle, vharzul: Flame };

// How an attack is answered, as a short tag.
function answerOf(atk) {
  if (atk.type === 'drop') return ['On the line', 'track'];
  if (atk.type === 'guard') return ['Guard', 'guard'];
  if (atk.break) return ['Break it', 'break'];
  if (atk.dodge) return ['Dodge', 'dodge'];
  return ['Shield it', 'shield'];
}

export function BossCrest({ id, size = 64, state = 'open' }) {
  const Icon = BOSS_ICON[id] ?? Skull;
  return (
    <span className={`boss-crest tier-${B.BOSSES[id]?.tier ?? 1} ${state}`} style={{ width: size, height: size }} aria-hidden="true">
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} />
    </span>
  );
}

export function BossAttacks({ boss }) {
  return (
    <ul className="boss-attacks">
      {boss.attacks.map((atk) => {
        const [label, tone] = answerOf(atk);
        return (
          <li key={atk.id}>
            <span className={`boss-answer ${tone}`}>{label}</span>
            <span>
              <b>{atk.name}</b>
              {atk.below !== undefined ? <span className="dim small"> (under {Math.round(atk.below * 100)}% HP)</span> : null}
              <span className="muted small"> {atk.text}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default function BountyBoard() {
  const { conductor, go } = useGame();
  const slain = BOSS_IDS.filter((id) => (conductor.bounties?.[id]?.kills ?? 0) > 0).length;
  return (
    <section className="stack" role="tabpanel">
      <p className="muted">
        The Railway Wardens pay for the monsters and marauders of the line. A boss is not raced: it rides beside you and the two of you fight until one falls, or until its time runs out and it gets away. Watch for the warning before every attack: <b>dodge</b> an aimed one by shifting your lever {Math.round(B.BOSS.dodgeLever * 100)}%, <b>break</b> a charged one with a burst of damage, <b>shield</b> the rest. The first kill pays in full and wins a relic that forges a legendary machine; a boss is back on its line {B.BOSS.respawnHours} hours later for a smaller purse. Those are real hours, like the freight's: resting does not bring it back sooner.
      </p>
      <div className="row" style={{ gap: 8 }}>
        <span className="chip">
          <Trophy aria-hidden="true" /> {slain} of {BOSS_IDS.length} brought down
        </span>
        <span className="chip">
          <Gem aria-hidden="true" /> {Object.keys(conductor.relics ?? {}).length} relic{Object.keys(conductor.relics ?? {}).length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="bounty-grid">
        {BOSS_IDS.map((id) => {
          const boss = bossById(id);
          const st = bossState(conductor, id);
          const reward = bountyReward(conductor, id);
          const line = lineById(boss.line);
          const hidden = st.state === 'locked' && !(st.record.kills > 0);
          return (
            <article className={`plate riveted bounty tier-${boss.tier} ${st.state}`} key={id}>
              <div className="bounty-head">
                <BossCrest id={id} state={st.state} />
                <div className="grow">
                  <span className="label">
                    Tier {boss.tier} bounty{st.record.kills > 0 ? ` · brought down ${st.record.kills}×` : ''}
                  </span>
                  <h3>{boss.name}</h3>
                  <span className="muted small">{boss.title}</span>
                </div>
                {st.state === 'slain' ? <span className="stamp good">Down</span> : st.state === 'locked' ? <Lock aria-hidden="true" className="dim" /> : <span className="stamp warn">At large</span>}
              </div>
              <p className="small">{boss.text}</p>
              <span className="muted small">
                {line.name} line · <Terrain theme={line.terrain} /> · a {boss.miles}-mile run
              </span>
              <div className="stats">
                <div className="stat">
                  <span className="label">Hull</span>
                  <b>{fmt(boss.hull)}</b>
                </div>
                <div className="stat">
                  <span className="label">Armor</span>
                  <b>{Math.round(boss.armor * 100)}%</b>
                </div>
                <div className="stat">
                  <span className="label">Stays for</span>
                  <b>{clock(boss.seconds)}</b>
                </div>
                {st.record.best ? (
                  <div className="stat">
                    <span className="label">Your best</span>
                    <b className="go">{clock(st.record.best)}</b>
                  </div>
                ) : null}
              </div>
              {hidden ? null : (
                <>
                  <BossAttacks boss={boss} />
                  <p className="note small">
                    <Crosshair aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> {boss.tip}
                  </p>
                </>
              )}
              <div className="bounty-reward">
                <span>
                  <span className="label">{reward.first ? 'Bounty' : 'Repeat bounty'}</span>
                  <b className="num">{ltWhole(reward.lt)} LT</b>
                </span>
                <span>
                  <span className="label">Experience</span>
                  <b className="num">{fmt(reward.xp)}</b>
                </span>
                <span>
                  <span className="label">Weapon</span>
                  <b className={`tag tag-${reward.weapon}`}>{B.RARITY[reward.weapon].label}</b>
                </span>
              </div>
              <p className="small brass">
                <Gem aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> {st.record.kills > 0 ? `You hold ${boss.relic}: ` : `First kill wins ${boss.relic}: `}
                it forges {MODELS[boss.forges].name} for {ltWhole(B.MYTHIC[boss.forges].forge.price)} LT at the Station.
              </p>
              {st.state === 'open' ? (
                <button type="button" className="btn btn-ember btn-block" onClick={() => go('setup', { ctx: { kind: 'bounty', bossId: id } })}>
                  <Swords aria-hidden="true" />
                  Hunt {boss.name}
                </button>
              ) : st.state === 'slain' ? (
                <p className="note small">
                  <Clock aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> Brought down. Back on its line in {realWait(st.backIn)}.
                </p>
              ) : (
                <p className="note warn small">
                  <Lock aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> {st.why}.
                </p>
              )}
            </article>
          );
        })}
      </div>
      <p className="dim small">
        <Shield aria-hidden="true" style={{ width: 13, height: 13, verticalAlign: '-2px' }} /> A boss at large raids the freight on its line: your routes there earn {Math.round(B.BOSS.raidCut * 100)}% less until it is brought down.
      </p>
    </section>
  );
}

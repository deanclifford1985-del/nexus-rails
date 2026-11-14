import React from 'react';
import { UserMinus, UserPlus } from 'lucide-react';
import { RANKS } from '../game/ranks.js';
import { ROLES, ROSTER_MAX, memberCombat, memberLabel, memberXpForLevel, recruitCost, recruitOffers, squadCap } from '../game/squad.js';
import { B } from '../game/balance.js';
import { Bar, Btn, Chip, ConfirmBtn, Kv, Section, cx } from './bits.jsx';
import { useUi } from './context.jsx';
import { num, pct, signedPct } from './format.js';

function MemberCard({ member, active, action }) {
  const { derived } = useUi();
  const c = memberCombat(member, derived);
  const role = ROLES[member.role];
  const span = memberXpForLevel(member.level + 1) - memberXpForLevel(member.level);
  return (
    <article className={cx('member', active && 'is-active', member.status === 'wounded' && 'is-out')}>
      <header>
        <div>
          <strong>
            {memberLabel(member)} <em>“{member.nick}”</em>
          </strong>
          <span>
            {role.name} · Level {member.level} · {c.weapon.name}
          </span>
        </div>
        {member.status === 'wounded' ? <Chip tone="bad">Wounded: {member.out} op{member.out === 1 ? '' : 's'}</Chip> : active ? <Chip tone="good">On the squad</Chip> : null}
      </header>
      <p className="ui-muted ui-small ui-p">{role.text}</p>
      <div className="member-stats">
        <Kv label="Health" value={c.maxHealth} />
        <Kv label="Hit chance at 30 m" value={pct(c.accuracy)} />
        <Kv label="Sees to" value={`${Math.round(c.view)} m`} />
        <Kv label="Concealment" value={pct(c.stealth)} />
        {c.heal ? <Kv label="Heals" value={c.heal} /> : null}
        <Kv label="Kills" value={member.kills} />
      </div>
      {member.level < B.SQUAD.LEVEL_CAP ? <Bar share={(member.xp - memberXpForLevel(member.level)) / Math.max(1, span)} tone="gold" label="Experience" /> : null}
      {action}
    </article>
  );
}

// Your roster. With `recruiting`, also the soldiers waiting at the barracks.
export default function SquadPanel({ recruiting = false }) {
  const { save, derived, act } = useUi();
  const cap = squadCap(save);
  const roster = save.squad.roster;
  const active = save.squad.active;
  const offers = recruiting ? recruitOffers(save).filter((m) => !roster.some((r) => r.id === m.id)) : [];
  const aura = derived.aura;
  return (
    <div className="sheet">
      <div className="sheet-left">
        <Section title="Your soldiers" side={cap > 0 ? `${active.length} of ${cap} on the squad · ${roster.length} of ${ROSTER_MAX} on the roster` : null}>
          {cap === 0 ? (
            <p className="ui-empty">A {RANKS[save.rank].name} leads nobody. Make Corporal and you are given your first soldier.</p>
          ) : roster.length === 0 ? (
            <p className="ui-empty">Nobody on your roster yet. The First Sergeant at the barracks has soldiers looking for a squad.</p>
          ) : (
            <div className="member-grid">
              {roster.map((member) => {
                const on = active.includes(member.id);
                return (
                  <MemberCard
                    key={member.id}
                    member={member}
                    active={on}
                    action={
                      <div className="ui-row member-actions">
                        <Btn small tone={on ? 'ghost' : 'primary'} disabled={member.status !== 'ready' || (!on && active.length >= cap)} onClick={() => act('setActive', { id: member.id, active: !on })}>
                          {on ? 'Stand down' : 'Take along'}
                        </Btn>
                        <ConfirmBtn small tone="ghost" icon={UserMinus} confirm="Release for good?" onConfirm={() => act('dismiss', { id: member.id })}>
                          Release
                        </ConfirmBtn>
                      </div>
                    }
                  />
                );
              })}
            </div>
          )}
        </Section>
        {recruiting && cap > 0 ? (
          <Section title="Looking for a squad" side="The list changes after every operation">
            {offers.length ? (
              <div className="member-grid">
                {offers.map((member) => {
                  const cost = recruitCost(member, derived.priceMul);
                  return (
                    <MemberCard
                      key={member.id}
                      member={member}
                      action={
                        <div className="ui-row member-actions">
                          <Btn small tone="gold" icon={UserPlus} disabled={save.rp < cost || roster.length >= ROSTER_MAX} onClick={() => act('recruit', { id: member.id })}>
                            Recruit · {num(cost)} RP
                          </Btn>
                        </div>
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <p className="ui-empty">Nobody new today.</p>
            )}
          </Section>
        ) : null}
      </div>
      <div className="sheet-right">
        <Section title="What your command adds">
          <Kv label="Squad accuracy" value={signedPct(aura.acc - 1)} tone="good" />
          <Kv label="Squad damage" value={signedPct(aura.dmg - 1)} tone="good" />
          <Kv label="Squad health" value={signedPct(aura.hp - 1)} tone="good" />
          <Kv label="Squad reactions" value={signedPct(1 - aura.reaction)} tone="good" />
          <Kv label="Your skill they share" value={pct(aura.transfer)} hint="Each soldier gains this share of your own Accuracy, Toughness, Quickness, Stealth, Perception and Medicine." tone="good" />
          <Kv label="Command range" value={`${Math.round(derived.commandRange)} m`} />
          <Kv label="Orders carried out in" value={`${derived.orderDelay.toFixed(1)} s`} />
          <p className="ui-muted ui-small ui-p">All of this comes from your Leadership and Communication. The numbers on each soldier already include it.</p>
        </Section>
        <Section title="Orders in the field">
          <Kv label="On me" value="5" />
          <Kv label="Hold here" value="6" />
          <Kv label="Move to where I am looking" value="7" />
          <Kv label="Attack the one in my sights" value="8" />
          <Kv label="Hold fire / weapons free" value="G" />
          <p className="ui-muted ui-small ui-p">A soldier beyond your command range does not hear the order.</p>
        </Section>
      </div>
    </div>
  );
}

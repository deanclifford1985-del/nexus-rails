import React, { useState } from 'react';
import { Backpack, BookOpen, Map as MapIcon, Plus, Settings as SettingsIcon, User, Users } from 'lucide-react';
import { ATTR_MAX, GROUPS, attrsInGroup } from '../game/attributes.js';
import { B } from '../game/balance.js';
import { describeDerived, levelProgress, pointCost, practiceShare, xpForLevel } from '../game/character.js';
import { MEDALS } from '../game/medals.js';
import { RANKS, nextRankGap, SUPPORTS } from '../game/ranks.js';
import { specOf } from '../game/specializations.js';
import { squadCap } from '../game/squad.js';
import { AttrIcon, Bar, Btn, Chip, Insignia, Kv, Panel, Section, Tabs, cx } from './bits.jsx';
import { useHost, useUi } from './context.jsx';
import { num, playtime } from './format.js';
import Loadout from './Loadout.jsx';
import SquadPanel from './SquadPanel.jsx';
import MapPanel from './MapPanel.jsx';
import { CONTROLS } from './Title.jsx';

// ---------- character ----------
function Character() {
  const { save, derived, act } = useUi();
  const progress = levelProgress(save);
  const gap = nextRankGap(save);
  const spec = specOf(save.spec);
  const rank = RANKS[save.rank];
  return (
    <div className="sheet">
      <div className="sheet-left">
        <div className="sheet-id">
          <Insignia rank={save.rank} size={64} />
          <div>
            <strong>
              {rank.abbr} {save.name}
              {save.callsign ? <em> “{save.callsign}”</em> : null}
            </strong>
            <span>
              {rank.name} · {spec ? spec.name : 'No specialization yet'}
            </span>
            <span className="ui-muted">{rank.duty}</span>
          </div>
        </div>
        <Section title={`Level ${save.level}`} side={save.level >= B.XP.LEVEL_CAP ? 'Maximum' : `${num(progress.into)} / ${num(progress.span)} XP`}>
          <Bar share={progress.share} tone="gold" />
          {gap ? (
            <p className="ui-muted ui-small ui-p" style={{ marginTop: 6 }}>
              {gap.xpLeft > 0 ? `${num(gap.xpLeft)} XP to ${gap.rank.name}.` : gap.needs ? `${gap.rank.name} needs more than experience: the campaign will bring it.` : `Promotion to ${gap.rank.name} is due: see Colonel Adeyemi.`}
            </p>
          ) : null}
        </Section>
        <Section title="Attributes" side={save.points > 0 ? <Chip tone="gold">{save.points} points to spend</Chip> : 'Skills also grow with use'}>
          {GROUPS.map((group) => (
            <div key={group.id} className="attr-group">
              <h4>{group.name}</h4>
              {attrsInGroup(group.id).map((attr) => {
                const base = Math.floor(save.attrs[attr.id]);
                const total = derived.attrs[attr.id];
                const cost = pointCost(base);
                const can = base < ATTR_MAX && save.points >= cost;
                const affinity = spec?.affinity.includes(attr.id);
                return (
                  <div key={attr.id} className="attr-row" title={`${attr.uses}\nImproves with: ${attr.practice}`}>
                    <span className="attr-name">
                      <AttrIcon id={attr.id} /> {attr.name}
                      {affinity ? <i title="Your specialization learns this faster">★</i> : null}
                    </span>
                    <Bar share={total / ATTR_MAX} under={practiceShare(save, attr.id)} label={`${attr.name} ${total}`} />
                    <b className="attr-value">
                      {total}
                      {total > base ? <em>+{total - base}</em> : null}
                    </b>
                    <button type="button" className="attr-plus" disabled={!can} onClick={() => act('spendPoint', { attr: attr.id })} aria-label={`Raise ${attr.name} (costs ${cost})`} title={base >= ATTR_MAX ? 'At its limit' : `Costs ${cost} point${cost === 1 ? '' : 's'}`}>
                      <Plus size={15} aria-hidden="true" />
                      {cost > 1 && base < ATTR_MAX ? <small>{cost}</small> : null}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
          <p className="ui-muted ui-small ui-p">The thin line under each bar is practice toward the next point. ★ marks what your specialization learns half again as fast.</p>
        </Section>
      </div>
      <div className="sheet-right">
        <Section title="What it adds up to" side={<Chip tone="gold">Rating {derived.rating}</Chip>}>
          {describeDerived(save, derived).map((group) => (
            <div key={group.id} className="derived-group">
              <h4>{group.name}</h4>
              {group.rows.map((row) => (
                <Kv key={row.label} label={row.label} value={row.value} hint={`From: ${row.from}`} warn={row.warn} />
              ))}
            </div>
          ))}
        </Section>
        {spec ? (
          <Section title="Perk">
            <p className="ui-p">
              <strong className="ui-gold">{spec.perk.name}.</strong> {spec.perk.text}
            </p>
          </Section>
        ) : null}
      </div>
    </div>
  );
}

// ---------- service record ----------
function Record() {
  const { save } = useUi();
  const s = save.stats;
  const accuracy = s.shots > 0 ? Math.round((s.hits / s.shots) * 100) : 0;
  const rank = RANKS[save.rank];
  return (
    <div className="sheet">
      <div className="sheet-left">
        <Section title="Service">
          <div className="debrief-stats">
            <Kv label="Operations completed" value={s.missions} />
            <Kv label="Operations failed" value={s.failed} />
            <Kv label="Enemies killed" value={s.kills} />
            <Kv label="Headshots" value={s.headshots} />
            <Kv label="Silent kills" value={s.stealthKills} />
            <Kv label="Longest shot" value={`${s.longestShot} m`} />
            <Kv label="Accuracy" value={`${accuracy}%`} />
            <Kv label="Captives brought home" value={s.rescued} />
            <Kv label="Taken alive" value={s.captured} />
            <Kv label="Squad kills" value={s.squadKills} />
            <Kv label="Times down" value={s.downs} />
            <Kv label="Time in the field" value={playtime(s.playSeconds)} />
          </div>
        </Section>
        <Section title="Command">
          <Kv label="Rank" value={rank.name} />
          <Kv label="Soldiers you may lead" value={squadCap(save)} />
          <Kv label="Total experience" value={`${num(save.xp)} XP`} />
          <Kv label="Next level at" value={save.level >= B.XP.LEVEL_CAP ? '—' : `${num(xpForLevel(save.level + 1))} XP`} />
          {(rank.supports ?? []).map((id) => (
            <Kv key={id} label={SUPPORTS[id].name} value="On call" hint={SUPPORTS[id].text} tone="good" />
          ))}
        </Section>
        <Section title="Decorations">
          <div className="medals">
            {MEDALS.map((medal) => (
              <div key={medal.id} className={cx('medal', save.medals.includes(medal.id) && 'is-earned')} title={medal.text}>
                <span className="medal-ribbon" aria-hidden="true" />
                <strong>{medal.name}</strong>
                <span>{medal.text}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
      <div className="sheet-right">
        <Section title="Log">
          {save.log.length ? (
            <ol className="log">
              {[...save.log].reverse().map((entry, i) => (
                <li key={i}>
                  <em>Day {entry.day}</em> {entry.text}
                </li>
              ))}
            </ol>
          ) : (
            <p className="ui-muted">Nothing on record yet.</p>
          )}
        </Section>
      </div>
    </div>
  );
}

// ---------- settings ----------
export function SettingsPanel() {
  const { settings, setSetting } = useUi();
  const slider = (key, label, min, max, step, show) => (
    <label className="set-row">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={settings[key]} onChange={(e) => setSetting(key, Number(e.target.value))} />
      <b>{show(settings[key])}</b>
    </label>
  );
  const toggle = (key, label, hint) => (
    <label className="set-row is-check">
      <span>
        {label}
        {hint ? <small>{hint}</small> : null}
      </span>
      <input type="checkbox" checked={!!settings[key]} onChange={(e) => setSetting(key, e.target.checked)} />
    </label>
  );
  return (
    <div className="sheet">
      <div className="sheet-left">
        <Section title="Settings">
          {slider('sensitivity', 'Look sensitivity', 0.3, 2.5, 0.05, (v) => `${v.toFixed(2)}×`)}
          {slider('volume', 'Volume', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`)}
          {slider('fov', 'Field of view', 55, 90, 1, (v) => `${v}°`)}
          <label className="set-row">
            <span>
              Graphics<small>Applies the next time you load the game.</small>
            </span>
            <select value={settings.quality} onChange={(e) => setSetting('quality', e.target.value)}>
              <option value="auto">Automatic</option>
              <option value="low">Low (fastest)</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          {toggle('invertY', 'Invert vertical look')}
          {toggle('hints', 'Show key hints', 'The line of keys at the bottom of the screen.')}
          {toggle('autoAim', 'Aim assist on touch screens', 'Your sights drift gently onto a soldier who is nearly in them.')}
        </Section>
      </div>
      <div className="sheet-right">
        <Section title="Controls">
          {CONTROLS.map(([what, keys]) => (
            <Kv key={what} label={what} value={keys} />
          ))}
        </Section>
      </div>
    </div>
  );
}

const TABS = [
  { id: 'character', name: 'Soldier', icon: User },
  { id: 'loadout', name: 'Loadout', icon: Backpack },
  { id: 'squad', name: 'Squad', icon: Users },
  { id: 'map', name: 'Map', icon: MapIcon },
  { id: 'record', name: 'Record', icon: BookOpen },
  { id: 'settings', name: 'Settings', icon: SettingsIcon },
];

// The field menu (Tab): everything about your soldier, in tabs.
export default function FieldMenu({ tab: first = 'character' }) {
  const { save } = useUi();
  const host = useHost();
  const [tab, setTab] = useState(first);
  const tabs = TABS.map((t) => (t.id === 'character' && save.points > 0 ? { ...t, badge: save.points } : t));
  return (
    <Panel size="xl" tall icon={User} kicker={`Requisition ${num(save.rp)} RP`} title="Field menu" onClose={() => host.resume()} tabs={<Tabs tabs={tabs} value={tab} onChange={setTab} />}>
      {tab === 'character' ? <Character /> : null}
      {tab === 'loadout' ? <Loadout /> : null}
      {tab === 'squad' ? <SquadPanel /> : null}
      {tab === 'map' ? <MapPanel /> : null}
      {tab === 'record' ? <Record /> : null}
      {tab === 'settings' ? <SettingsPanel /> : null}
    </Panel>
  );
}

// The pause menu.
export function Pause() {
  const { open, quit } = useUi();
  const host = useHost();
  const state = host.state();
  return (
    <Panel size="xs" kicker="Iron Dawn" title="Paused" onClose={() => host.resume()}>
      <div className="pause-list">
        <Btn tone="primary" onClick={() => host.resume()}>
          Resume
        </Btn>
        <Btn onClick={() => open('menu', { tab: 'character' })}>Field menu</Btn>
        <Btn onClick={() => open('menu', { tab: 'map' })}>Map</Btn>
        <Btn onClick={() => open('menu', { tab: 'settings' })}>Settings and controls</Btn>
        {state.mode === 'mission' ? (
          <Btn tone="danger" onClick={() => host.call('abortMission')}>
            Abort the mission
          </Btn>
        ) : null}
        {state.mode === 'training' ? (
          <Btn tone="danger" onClick={() => host.call('abortMission')}>
            Leave the evaluation
          </Btn>
        ) : null}
        <Btn tone="ghost" onClick={() => quit()}>
          Save and quit to title
        </Btn>
      </div>
      <p className="ui-muted ui-small ui-p" style={{ marginTop: 12 }}>
        Your progress is saved as you go. A mission in progress is not: quitting now returns you to camp.
      </p>
    </Panel>
  );
}

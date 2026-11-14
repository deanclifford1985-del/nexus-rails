import React, { useState } from 'react';
import { weaponByUid, weaponEff } from '../game/character.js';
import { ATTACHMENTS, ATTACHMENT_SLOTS, GEAR, GEAR_SLOTS, ITEMS, WEAPONS, WEAPON_CLASSES, attachmentFits, slotKind } from '../game/items.js';
import { Bar, Btn, Chip, Kv, Section, Tier, cx } from './bits.jsx';
import { useHost, useUi } from './context.jsx';
import { attachmentMods, gearMods, weaponRows } from './format.js';

function WeaponCard({ slot, locked }) {
  const { save, derived, act } = useUi();
  const [openSlot, setOpenSlot] = useState(null);
  const [swap, setSwap] = useState(false);
  const instance = weaponByUid(save, save.loadout[slot]);
  const others = save.weapons.filter((w) => WEAPON_CLASSES[WEAPONS[w.id].class].slot === slot && w.uid !== instance?.uid);
  if (!instance) {
    return (
      <div className="ui-card">
        <strong>{slot === 'primary' ? 'Primary' : 'Sidearm'}</strong>
        <p className="ui-muted ui-p">Nothing issued yet.</p>
      </div>
    );
  }
  const eff = weaponEff(save, instance, derived);
  const base = WEAPONS[instance.id];
  return (
    <div className="ui-card weapon-card">
      <header className="weapon-head">
        <div>
          <span className="ui-kicker">{slot === 'primary' ? 'Primary' : 'Sidearm'} · {WEAPON_CLASSES[base.class].name}</span>
          <strong>{base.name}</strong>
          <Tier tier={base.tier} />
        </div>
        {others.length && !locked ? (
          <Btn small tone="ghost" onClick={() => setSwap((on) => !on)}>
            {swap ? 'Keep' : 'Change'}
          </Btn>
        ) : null}
      </header>
      {swap ? (
        <div className="pick-list">
          {others.map((w) => (
            <button
              key={w.uid}
              type="button"
              className="ui-pick"
              onClick={() => {
                act('equipWeapon', { slot, uid: w.uid });
                setSwap(false);
              }}
            >
              <strong>{WEAPONS[w.id].name}</strong>
              <span>{WEAPON_CLASSES[WEAPONS[w.id].class].name}</span>
            </button>
          ))}
        </div>
      ) : null}
      <p className="ui-muted ui-small ui-p">{base.blurb}</p>
      <div className="stat-rows">
        {weaponRows(eff).map((row) => (
          <div key={row.key} className="stat-row">
            <span>{row.label}</span>
            <Bar share={row.raw / row.max} tone={row.good === 'low' ? 'khaki' : 'olive'} />
            <b>{row.value}</b>
          </div>
        ))}
      </div>
      <div className="att-slots">
        {base.slots.map((s) => {
          const current = ATTACHMENTS[instance.att?.[s]];
          const spares = Object.keys(save.attachments).filter((id) => save.attachments[id] > 0 && ATTACHMENTS[id]?.slot === s && attachmentFits(id, instance.id));
          return (
            <div key={s} className="att-slot">
              <button type="button" className={cx('att-button', current && 'is-filled')} disabled={locked || (!current && !spares.length)} onClick={() => setOpenSlot(openSlot === s ? null : s)} aria-expanded={openSlot === s}>
                <span>{ATTACHMENT_SLOTS[s]}</span>
                <strong>{current ? current.name : spares.length ? 'Empty: fit one' : 'Empty'}</strong>
              </button>
              {openSlot === s ? (
                <div className="pick-list">
                  {spares.map((id) => (
                    <button
                      key={id}
                      type="button"
                      className="ui-pick"
                      onClick={() => {
                        act('attach', { uid: instance.uid, attachment: id });
                        setOpenSlot(null);
                      }}
                    >
                      <strong>{ATTACHMENTS[id].name}</strong>
                      <span>{attachmentMods(ATTACHMENTS[id]).join(' · ')}</span>
                    </button>
                  ))}
                  {current ? (
                    <button
                      type="button"
                      className="ui-pick"
                      onClick={() => {
                        act('detach', { uid: instance.uid, slot: s });
                        setOpenSlot(null);
                      }}
                    >
                      <strong>Take it off</strong>
                      <span>{current.name} goes back in your kit bag.</span>
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GearSlot({ slot, locked }) {
  const { save, act } = useUi();
  const [open, setOpen] = useState(false);
  const current = GEAR[save.loadout.gear[slot]];
  const kind = slotKind(slot);
  const owned = save.gearOwned.map((id) => GEAR[id]).filter((g) => g && g.kind === kind && g.id !== current?.id);
  const fixed = slot === 'uniform' || slot === 'boots';
  return (
    <div className="gear-slot">
      <button type="button" className={cx('att-button', current && 'is-filled')} disabled={locked || (!owned.length && (!current || fixed))} onClick={() => setOpen((on) => !on)} aria-expanded={open}>
        <span>{GEAR_SLOTS[slot]}</span>
        <strong>{current ? current.name : 'Nothing'}</strong>
        {current ? <em>{gearMods(current).join(' · ') || current.text}</em> : null}
      </button>
      {open ? (
        <div className="pick-list">
          {owned.map((g) => (
            <button
              key={g.id}
              type="button"
              className="ui-pick"
              onClick={() => {
                act('equipGear', { slot, id: g.id });
                setOpen(false);
              }}
            >
              <strong>{g.name}</strong>
              <span>{gearMods(g).join(' · ') || g.text}</span>
            </button>
          ))}
          {current && !fixed ? (
            <button
              type="button"
              className="ui-pick"
              onClick={() => {
                act('equipGear', { slot, id: null });
                setOpen(false);
              }}
            >
              <strong>Take it off</strong>
              <span>Leave this slot empty.</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// What you carry: two weapons and their attachments, what you wear, and what is in your pouches.
export default function Loadout() {
  const { save, derived } = useUi();
  const host = useHost();
  const locked = host.state().mode !== 'roam';
  const spares = Object.entries(save.attachments).filter(([, n]) => n > 0);
  return (
    <div className="sheet">
      <div className="sheet-left">
        {locked ? <p className="ui-warn ui-p">Your loadout is fixed until you are back at camp.</p> : null}
        <Section title="Weapons">
          <div className="weapon-grid">
            <WeaponCard slot="primary" locked={locked} />
            <WeaponCard slot="secondary" locked={locked} />
          </div>
        </Section>
        {spares.length ? (
          <Section title="Spare attachments">
            <div className="ui-row">
              {spares.map(([id, n]) => (
                <Chip key={id} title={attachmentMods(ATTACHMENTS[id]).join(' · ')}>
                  {ATTACHMENTS[id].name}
                  {n > 1 ? ` ×${n}` : ''}
                </Chip>
              ))}
            </div>
          </Section>
        ) : null}
      </div>
      <div className="sheet-right">
        <Section title="Gear" side={<span className={derived.overload > 0 ? 'ui-bad' : ''}>{derived.load.toFixed(1)} / {derived.carry.toFixed(0)} kg</span>}>
          <Bar share={derived.load / derived.carry} tone={derived.overload > 0 ? 'red' : 'khaki'} />
          {derived.overload > 0 ? <p className="ui-bad ui-small ui-p">Overloaded: you move slower and evade less. More Strength or a pack helps.</p> : null}
          <div className="gear-grid">
            {Object.keys(GEAR_SLOTS).map((slot) => (
              <GearSlot key={slot} slot={slot} locked={locked} />
            ))}
          </div>
        </Section>
        <Section title="Pouches">
          {Object.values(ITEMS).map((item) => (
            <Kv key={item.id} label={`${item.name}${item.key ? ` (${item.key})` : ''}`} value={`${save.items[item.id] ?? 0} / ${derived.carryLimits[item.id]}`} hint={item.text} />
          ))}
          <p className="ui-muted ui-small ui-p">Your specialization’s issue is topped up free before every operation. The quartermaster sells the rest.</p>
        </Section>
      </div>
    </div>
  );
}

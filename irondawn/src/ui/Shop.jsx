import React, { useState } from 'react';
import { Lock, ShoppingCart, Users } from 'lucide-react';
import { priceOf, sellValue, shopList } from '../game/actions.js';
import { weaponByUid, weaponEff } from '../game/character.js';
import { ATTACHMENTS, ATTACHMENT_SLOTS, GEAR, GEAR_SLOTS, WEAPONS, WEAPON_CLASSES, slotKind, weaponWithAttachments } from '../game/items.js';
import { RANKS } from '../game/ranks.js';
import { Btn, Chip, ConfirmBtn, Panel, Section, Tabs, Tier, cx } from './bits.jsx';
import { useHost, useUi } from './context.jsx';
import { attachmentMods, better, gearMods, num, weaponRows } from './format.js';
import SquadPanel from './SquadPanel.jsx';

const SHELVES = [
  { id: 'weapon', name: 'Weapons' },
  { id: 'attachment', name: 'Attachments' },
  { id: 'gear', name: 'Gear' },
  { id: 'item', name: 'Supplies' },
  { id: 'sell', name: 'Sell' },
];

function Compare({ def }) {
  const { save, derived } = useUi();
  const slot = WEAPON_CLASSES[def.class].slot;
  const mine = weaponByUid(save, save.loadout[slot]);
  const rows = weaponRows(weaponWithAttachments({ id: def.id, att: {} }));
  const held = mine ? weaponRows(weaponWithAttachments({ id: mine.id, att: {} })) : [];
  void derived;
  return (
    <div className="shop-compare">
      {rows.slice(0, 8).map((row, i) => {
        const way = better(row, held[i]);
        return (
          <span key={row.key} className={cx(way > 0 && 'ui-good', way < 0 && 'ui-bad')}>
            {row.label} <b>{row.value}</b>
          </span>
        );
      })}
    </div>
  );
}

function Shelf({ kind }) {
  const { save, act } = useUi();
  const list = shopList(save, kind);
  return (
    <div className="shop-grid">
      {list.map(({ def, price, owned, locked, rankLocked }) => (
        <article key={def.id} className={cx('shop-item', rankLocked && 'is-locked')}>
          <header>
            <div>
              <strong>{def.name}</strong>
              <span className="ui-row">
                {def.tier !== undefined ? <Tier tier={def.tier} /> : null}
                {kind === 'weapon' ? <em>{WEAPON_CLASSES[def.class].name}</em> : null}
                {kind === 'attachment' ? <em>{ATTACHMENT_SLOTS[def.slot]}</em> : null}
                {kind === 'gear' ? <em>{def.kind === 'device' ? 'Kit' : GEAR_SLOTS[def.kind]}</em> : null}
                {owned && kind !== 'weapon' && kind !== 'gear' ? <em>Have {owned}</em> : null}
              </span>
            </div>
            <b className="shop-price">{num(price)} RP</b>
          </header>
          <p className="ui-muted ui-small ui-p">{def.blurb ?? def.text}</p>
          {kind === 'weapon' ? <Compare def={def} /> : null}
          {kind === 'attachment' ? <p className="shop-mods">{attachmentMods(def).join(' · ')}</p> : null}
          {kind === 'gear' ? <p className="shop-mods">{gearMods(def).join(' · ')}</p> : null}
          {kind === 'attachment' ? <p className="ui-dim ui-small ui-p">Fits: {def.fits.map((c) => WEAPON_CLASSES[c].name.toLowerCase()).join(', ')}</p> : null}
          <Btn small tone={locked ? 'ghost' : 'gold'} icon={rankLocked ? Lock : ShoppingCart} disabled={!!locked} onClick={() => act('buy', { kind, id: def.id })}>
            {locked ?? 'Buy'}
          </Btn>
        </article>
      ))}
    </div>
  );
}

function Sell() {
  const { save, act } = useUi();
  const weapons = save.weapons.filter((w) => w.uid !== save.loadout.primary && w.uid !== save.loadout.secondary);
  const spares = Object.entries(save.attachments).filter(([, n]) => n > 0);
  const worn = new Set(Object.values(save.loadout.gear));
  const gear = save.gearOwned.map((id) => GEAR[id]).filter((g) => g && g.price > 0 && !worn.has(g.id));
  if (!weapons.length && !spares.length && !gear.length) return <p className="ui-empty">Nothing spare to sell. What you are wearing or carrying stays with you.</p>;
  const row = (key, name, note, value, onSell) => (
    <article key={key} className="shop-item">
      <header>
        <div>
          <strong>{name}</strong>
          <span>{note}</span>
        </div>
        <b className="shop-price">{num(value)} RP</b>
      </header>
      <ConfirmBtn small tone="ghost" confirm={`Sell for ${num(value)} RP?`} onConfirm={onSell}>
        Sell
      </ConfirmBtn>
    </article>
  );
  return (
    <div className="shop-grid">
      {weapons.map((w) => row(w.uid, WEAPONS[w.id].name, WEAPON_CLASSES[WEAPONS[w.id].class].name, sellValue(save, 'weapon', w.id), () => act('sell', { kind: 'weapon', uid: w.uid })))}
      {spares.map(([id, n]) => row(id, ATTACHMENTS[id].name, `Spare ×${n}`, sellValue(save, 'attachment', id), () => act('sell', { kind: 'attachment', id })))}
      {gear.map((g) => row(g.id, g.name, slotKind(g.kind) === 'device' ? 'Kit' : GEAR_SLOTS[g.kind], sellValue(save, 'gear', g.id), () => act('sell', { kind: 'gear', id: g.id })))}
    </div>
  );
}

// The quartermaster's store.
export function Shop() {
  const { save, derived } = useUi();
  const host = useHost();
  const [shelf, setShelf] = useState('weapon');
  const discount = Math.round((1 - derived.priceMul) * 100);
  void priceOf;
  return (
    <Panel
      size="xl"
      tall
      icon={ShoppingCart}
      kicker={`Quartermaster · ${RANKS[save.rank].name} · shelf tier ${RANKS[save.rank].tier}`}
      title="Requisitions"
      onClose={() => host.resume()}
      side={
        <span className="ops-rating">
          <b>{num(save.rp)}</b> RP{discount > 0 ? <em> · {discount}% off for your Negotiating</em> : null}
        </span>
      }
      tabs={<Tabs tabs={SHELVES} value={shelf} onChange={setShelf} />}
    >
      {shelf === 'sell' ? <Sell /> : <Shelf kind={shelf} />}
      {shelf !== 'sell' ? <p className="ui-muted ui-small ui-p" style={{ marginTop: 12 }}>Rank opens the better shelves. Fit what you buy in the field menu (Tab), under Loadout.</p> : null}
    </Panel>
  );
}

// The barracks: soldiers to recruit, and your roster.
export function Barracks() {
  const { save } = useUi();
  const host = useHost();
  return (
    <Panel size="xl" tall icon={Users} kicker={`Barracks · First Sergeant Brennan · ${num(save.rp)} RP`} title="Your squad" onClose={() => host.resume()}>
      <SquadPanel recruiting />
    </Panel>
  );
}

export { Chip, Section };

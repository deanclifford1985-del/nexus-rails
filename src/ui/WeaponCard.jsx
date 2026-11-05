import React from 'react';
import { B } from '../game/balance.js';
import { isWeaponItem, standardWeapon, weaponStats } from '../game/weapons.js';
import { RarityTag } from './bits.jsx';
import { fmt } from './format.js';

// A weapon's attributes at a glance: damage, cooldown, accuracy, crit, armor penetration, traits.
export function WeaponStats({ weapon }) {
  const w = isWeaponItem(weapon) ? weapon : standardWeapon(weapon);
  const s = weaponStats(w);
  const burst = s.burst || 1;
  const dot = s.burn * (s.burn + 1) * 0.5; // a Burn of n stacks deals n + (n-1) + ... + 1
  if (s.channel) {
    // Lightning: ticks every quarter second, each one base + amp x ticks so far.
    const ticks = Math.round(s.channel / s.tick);
    const total = ticks * s.base + (s.amp * ticks * (ticks - 1)) / 2;
    return (
      <div className="stack-sm">
        <div className="wpn-stats num">
          <div>
            <span>Channel</span>
            {fmt(s.channel, 2)} s
          </div>
          <div>
            <span>Per tick</span>
            {s.base} +{s.amp} each {s.tick} s
          </div>
          <div>
            <span>Last tick</span>
            {s.base + s.amp * (ticks - 1)}
          </div>
          <div>
            <span>Full channel</span>
            {fmt(total)}
          </div>
          <div>
            <span>Cooldown</span>
            {fmt(s.cooldown, 1)} s after
          </div>
          <div>
            <span>Boots up</span>
            {bootText(s.boot)}
          </div>
          <div>
            <span>Per second</span>
            {fmt(total / (s.channel + s.cooldown), 1)}
          </div>
        </div>
        <Traits w={w} />
      </div>
    );
  }
  const avg = ((s.damage[0] + s.damage[1]) / 2) * s.accuracy * (1 + s.crit * (s.critMult - 1));
  const dps = ((avg + dot) * burst * (s.echoEvery ? 1 + 1 / s.echoEvery : 1)) / s.cooldown;
  return (
    <div className="stack-sm">
      <div className="wpn-stats num">
        <div>
          <span>Damage</span>
          {burst > 1 ? `${burst} × ` : ''}
          {s.damage[0] === s.damage[1] ? s.damage[0] : `${s.damage[0]}-${s.damage[1]}`}
        </div>
        <div>
          <span>Cooldown</span>
          {fmt(s.cooldown, 2)} s
        </div>
        <div>
          <span>Accuracy</span>
          {fmt(s.accuracy * 100)}%
        </div>
        <div>
          <span>Crit chance</span>
          {fmt(s.crit * 100)}% x{fmt(s.critMult, 1)}
        </div>
        <div>
          <span>Armor pen</span>
          {fmt(s.pen * 100)}%
        </div>
        <div>
          <span>Per second</span>
          {fmt(dps, 1)}
        </div>
        <div>
          <span>Boots up</span>
          {bootText(s.boot)}
        </div>
      </div>
      <Traits w={w} />
    </div>
  );
}

export function bootText(boot) {
  if (!boot) return 'Instant';
  const m = boot.mult ?? 1;
  const base =
    boot.type === 'time' ? `${Math.round(boot.s * m)} s` : boot.type === 'miles' ? `${fmt(boot.mi * m, 1)} mi` : boot.type === 'hurt' ? `below ${Math.round(boot.below * 100)}% HP` : boot.type === 'heat' ? `above ${Math.round(boot.above * m)}% heat` : '–';
  return boot.onHit ? `${base} or first hit` : base;
}

function Traits({ w }) {
  if (!w.traits?.length) return null;
  return (
    <div>
      {w.traits.map((id) => (
        <span className="trait-chip" key={id} title={B.WEAPONS.traits[id].text}>
          {B.WEAPONS.traits[id].name}: {B.WEAPONS.traits[id].text}
        </span>
      ))}
    </div>
  );
}

export function WeaponCard({ weapon, children }) {
  const w = isWeaponItem(weapon) ? weapon : standardWeapon(weapon);
  return (
    <div className="stack-sm">
      <div className="spread">
        <b>{w.name}</b>
        <RarityTag rarity={w.rarity} />
      </div>
      <WeaponStats weapon={w} />
      {children}
    </div>
  );
}

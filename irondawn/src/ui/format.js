// How the menus word things: clocks, durations, and what a piece of kit does in a few words.
// Nothing here decides anything: the numbers all come from the rules in game/.

import { attrInfo } from '../game/attributes.js';
import { ATTACHMENTS, GEAR, ITEMS, WEAPONS } from '../game/items.js';

export const num = (n) => Math.round(n ?? 0).toLocaleString('en-US');
export const pct = (v, digits = 0) => `${((v ?? 0) * 100).toFixed(digits)}%`;
export const signedPct = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(0)}%`;
export const attrName = (id) => attrInfo(id)?.name ?? id;

export function clock(hour) {
  const h = (((hour ?? 0) % 24) + 24) % 24;
  const whole = Math.floor(h);
  const minutes = Math.floor((h - whole) * 60 + 0.5);
  return minutes === 60 ? `${String((whole + 1) % 24).padStart(2, '0')}:00` : `${String(whole).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export const dayPart = (hour) => (hour >= 20.5 || hour < 5.25 ? 'Night' : hour < 8 ? 'Dawn' : hour < 17.5 ? 'Day' : 'Dusk');

export function duration(seconds) {
  const s = Math.max(0, Math.round(seconds ?? 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function playtime(seconds) {
  const minutes = Math.floor((seconds ?? 0) / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

// Skin tones offered at creation (index 0..4), lightest to darkest.
export const SKIN_TONES = ['#f0c8a4', '#dba77e', '#b98259', '#8c5b3c', '#5d3b28'];

const mulPct = (mul) => `${mul >= 1 ? '+' : '−'}${Math.abs((mul - 1) * 100).toFixed(0)}%`;
const ENABLES = { binoc: 'Binoculars (B): tag enemies', nvg: 'Night vision (N)', drone: 'Drone scan: tags everyone within 80 m' };

// What a piece of gear does, as short phrases.
export function gearMods(def) {
  if (!def) return [];
  const out = [];
  if (def.armor) out.push(`Body armour ${pct(def.armor)}`);
  if (def.armorHead) out.push(`Head armour ${pct(def.armorHead)}`);
  if (def.health) out.push(`+${def.health} health`);
  for (const [attr, bonus] of Object.entries(def.attrs ?? {})) out.push(`+${bonus} ${attrName(attr)}`);
  if (def.speed) out.push(`Speed ${mulPct(def.speed)}`);
  if (def.carry) out.push(`+${def.carry} kg carry`);
  if (def.ammo) out.push(`Ammunition ${mulPct(def.ammo)}`);
  if (def.noise) out.push(`Footfall ${mulPct(def.noise)}`);
  if (def.nightStealth) out.push(`+${pct(def.nightStealth)} concealment at night`);
  if (def.mantle) out.push(`Ledges +${def.mantle} m`);
  if (def.commandRange) out.push(`Command range ${mulPct(def.commandRange)}`);
  if (def.tracking) out.push(`+${def.tracking} Tracking`);
  if (def.planning) out.push(`+${def.planning} Planning`);
  for (const [item, n] of Object.entries(def.extra ?? {})) out.push(`Carry ${n} more ${ITEMS[item]?.name.toLowerCase() ?? item}${n === 1 ? '' : 's'}`);
  if (def.enables) out.push(ENABLES[def.enables] ?? def.enables);
  if (def.rangefinder) out.push('Reads the range');
  return out;
}

// What an attachment changes, as short phrases.
export function attachmentMods(def) {
  if (!def) return [];
  const m = def.mods ?? {};
  const out = [];
  if (m.zooms) out.push(`${m.zooms[0]}–${m.zooms[m.zooms.length - 1]}× zoom`);
  else if (m.zoom) out.push(`${m.zoom}× zoom`);
  if (m.thermal) out.push('Thermal picture');
  if (m.spread) out.push(`Spread ${mulPct(m.spread)}`);
  if (m.recoil) out.push(`Recoil ${mulPct(m.recoil)}`);
  if (m.hip) out.push(`Hip-fire spread ${mulPct(m.hip)}`);
  if (m.noise) out.push(`Noise ${mulPct(m.noise)}`);
  if (m.damage) out.push(`Damage ${mulPct(m.damage)}`);
  if (m.range) out.push(`Range ${mulPct(m.range)}`);
  if (m.mag) out.push(`Magazine ${mulPct(m.mag)}`);
  if (m.reload) out.push(`Reload time ${mulPct(m.reload)}`);
  if (m.ads) out.push(`Aim time ${mulPct(m.ads)}`);
  if (m.pierce) out.push(`Ignores ${pct(m.pierce)} of armour`);
  if (m.bipod) out.push('Steadies when prone or crouched still');
  if (m.weight) out.push(`+${m.weight} kg`);
  return out;
}

// The rows of a weapon's stat block. `good` says which direction is better, for comparisons.
export function weaponRows(w) {
  if (!w) return [];
  const pellets = w.pellets ?? 1;
  return [
    { key: 'damage', label: 'Damage', value: pellets > 1 ? `${w.damage.toFixed(0)} × ${pellets}` : w.damage.toFixed(0), raw: w.damage * pellets, good: 'high', max: 280 },
    { key: 'rpm', label: 'Rate of fire', value: `${w.rpm} rpm`, raw: w.rpm, good: 'high', max: 820 },
    { key: 'mag', label: 'Magazine', value: `${w.mag}`, raw: w.mag, good: 'high', max: 150 },
    { key: 'reload', label: 'Reload', value: `${w.reload.toFixed(1)} s`, raw: w.reload, good: 'low', max: 6 },
    { key: 'spread', label: 'Spread (aimed)', value: `${w.spread.toFixed(2)}°`, raw: w.spread, good: 'low', max: 2.6 },
    { key: 'recoil', label: 'Recoil', value: `${w.recoil.toFixed(1)}°`, raw: w.recoil, good: 'low', max: 4.2 },
    { key: 'range', label: 'Range', value: `${Math.round(w.range)} m`, raw: w.range, good: 'high', max: 1100 },
    { key: 'noise', label: 'Noise', value: `${Math.round(w.noise)} m`, raw: w.noise, good: 'low', max: 220 },
    { key: 'weight', label: 'Weight', value: `${w.weight.toFixed(1)} kg`, raw: w.weight, good: 'low', max: 12 },
    { key: 'zoom', label: 'Zoom', value: `${w.zoom}×`, raw: w.zoom, good: 'high', max: 16 },
  ];
}

// -1 worse, 0 same, 1 better: how row a compares with row b (the one you are holding).
export function better(a, b) {
  if (!a || !b || Math.abs(a.raw - b.raw) < 1e-6) return 0;
  const higher = a.raw > b.raw;
  return (a.good === 'high') === higher ? 1 : -1;
}

const PLURAL = { rifleman: 'riflemen', marksman: 'marksmen', medic: 'medics', gunner: 'gunners', scout: 'scouts', engineer: 'engineers' };
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

// { rifleman: 3, medic: 1 } -> "three riflemen and one medic"
export function forceText(counts) {
  const parts = Object.entries(counts ?? {})
    .filter(([, n]) => n > 0)
    .map(([role, n]) => `${WORDS[n] ?? n} ${n === 1 ? role : PLURAL[role] ?? `${role}s`}`);
  if (!parts.length) return '';
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export function weaponLine(kit) {
  if (!kit) return '';
  const weapon = WEAPONS[kit.id];
  const extras = Object.values(kit.att ?? {})
    .filter(Boolean)
    .map((id) => ATTACHMENTS[id]?.name)
    .filter(Boolean);
  return extras.length ? `${weapon?.name} with ${extras.join(', ')}` : weapon?.name ?? '';
}

// What a specialization issues, as lines for the intake board.
export function kitLines(spec) {
  const gear = Object.values(spec.kit.gear)
    .filter(Boolean)
    .map((id) => GEAR[id]?.name)
    .filter((name, index, list) => name && list.indexOf(name) === index);
  const items = Object.entries(spec.kit.items).map(([id, n]) => `${n} × ${ITEMS[id]?.name ?? id}`);
  return [
    { label: 'Primary', text: weaponLine(spec.kit.primary) },
    { label: 'Sidearm', text: weaponLine(spec.kit.secondary) },
    { label: 'Gear', text: gear.join(', ') },
    { label: 'Supplies', text: items.join(', ') },
  ];
}

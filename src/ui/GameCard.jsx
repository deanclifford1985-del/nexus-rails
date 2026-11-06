import React from 'react';
import { Sparkles, TrainFront, User } from 'lucide-react';
import { B } from '../game/balance.js';
import { MODELS, SUPER_TRAITS, spellsOf } from '../game/locomotives.js';
import { TRAITS } from '../game/traits.js';
import { ratingBand, ratingOf } from '../game/power.js';
import { CRATE_TIERS } from '../game/crates.js';
import Portrait from './Portrait.jsx';

// The collectible card for a locomotive or a conductor: art, name, stats, abilities and one big
// power rating in the top-right corner. Used for crate pools, the Vault, the reveal and the garage.

const SPELL_NAMES = { fire: 'Fire', bolt: 'Bolt', barrier: 'Barrier', frost: 'Frost Breath' };
const LOCO_STATS = [
  ['power', 'Power'],
  ['efficiency', 'Efficiency'],
  ['durability', 'Armor'],
  ['endurance', 'Endurance'],
];
const CREW_STATS = [
  ['str', 'Strength'],
  ['agi', 'Agility'],
  ['int', 'Intelligence'],
  ['end', 'Endurance'],
];
const ART = new Set(['tank', 'bullet', 'stable', 'longrun', 'scrappy', 'wizard', 'titan', 'dragon', 'phoenix', 'benchmark']);
const base = (import.meta.env?.BASE_URL ?? '/').replace(/\/?$/, '/');
export const locoArtUrl = (model) => `${base}art/locos/${ART.has(model) ? model : 'benchmark'}.webp`;

function abilitiesOf(kind, d) {
  if (kind === 'loco') {
    const list = [];
    if (d.superTrait && SUPER_TRAITS[d.superTrait]) list.push({ key: 'super', name: SUPER_TRAITS[d.superTrait].name, text: SUPER_TRAITS[d.superTrait].text, tone: 'gold' });
    if (d.journey) list.push({ key: 'journey', name: 'The Journey', text: 'Long-haul ability of the Long Run line', tone: 'gold' });
    for (const s of spellsOf(d)) list.push({ key: `spell-${s}`, name: SPELL_NAMES[s] ?? s, text: 'Built-in spell', tone: 'arcane' });
    return list;
  }
  return (d.traits ?? [])
    .map((t) => (typeof t === 'string' ? { id: t } : t))
    .filter((t) => TRAITS[t?.id])
    .map((t, i) => ({ key: `${t.id}-${i}`, name: `${t.rarity === 'profound' ? 'Profound ' : t.rarity === 'infused' ? 'Half ' : ''}${TRAITS[t.id].name}`, text: TRAITS[t.id].text, tone: 'trait' }));
}

export default function GameCard({ kind, data, rarity, serial, size = 'md', footer, children, className = '' }) {
  const d = data;
  const r = rarity ?? d.rarity ?? 'uncommon';
  const rating = ratingOf(kind, d);
  const band = ratingBand(rating);
  const stats = kind === 'loco' ? LOCO_STATS : CREW_STATS;
  const top = Math.max(kind === 'loco' ? 15 : 25, ...stats.map(([k]) => d[k] ?? 0));
  const abilities = abilitiesOf(kind, d);
  const subtitle = kind === 'loco' ? `${MODELS[d.model]?.name ?? 'Locomotive'}` : 'Conductor';
  const Icon = kind === 'loco' ? TrainFront : User;
  return (
    <article className={`gcard gcard-${r} gcard-${size} ${className}`}>
      <div className="gcard-frame">
        <div className="gcard-art">
          {kind === 'loco' ? (
            <img src={locoArtUrl(d.model)} alt={`${d.name}, ${subtitle}`} loading="lazy" draggable="false" />
          ) : (
            <Portrait seed={d.id ?? d.name} rarity={r} title={`${d.name}, conductor`} />
          )}
          <div className={`gcard-power band-${band}`} aria-label={`Power rating ${rating.toLocaleString()}`}>
            <span className="gcard-power-num">{rating.toLocaleString()}</span>
            <span className="gcard-power-lbl">Power</span>
          </div>
          <span className="gcard-rarity">{B.RARITY[r]?.label ?? (r === 'common' ? 'Rookie' : r)}</span>
          {r === 'legendary' || r === 'epic' ? <span className="gcard-foil" aria-hidden="true" /> : null}
        </div>
        <div className="gcard-body">
          <div className="gcard-title">
            <Icon aria-hidden="true" />
            <div>
              <h3>{d.name}</h3>
              <span className="gcard-sub">{subtitle}</span>
            </div>
          </div>
          <div className="gcard-stats">
            {stats.map(([k, label]) => (
              <div className="gcard-stat" key={k}>
                <span className="gcard-stat-lbl">{label}</span>
                <span className="gcard-bar">
                  <i style={{ width: `${Math.min(100, ((d[k] ?? 0) / top) * 100)}%` }} />
                </span>
                <b className="num">{d[k] ?? 0}</b>
              </div>
            ))}
          </div>
          {abilities.length ? (
            <div className="gcard-abilities">
              {abilities.map((a) => (
                <span className={`gcard-chip chip-${a.tone}`} key={a.key} title={a.text}>
                  {a.tone !== 'trait' ? <Sparkles aria-hidden="true" /> : null}
                  {a.name}
                </span>
              ))}
            </div>
          ) : (
            <div className="gcard-abilities gcard-none">{kind === 'loco' ? 'No spells or super trait' : 'No traits'}</div>
          )}
          <div className="gcard-foot">
            <span className="num">{serial ?? ''}</span>
            {footer}
          </div>
          {children ? <div className="gcard-actions">{children}</div> : null}
        </div>
      </div>
    </article>
  );
}

// An NFT from a crate pool or the Vault, as a card.
export function NftGameCard({ nft, children, size }) {
  return <GameCard kind={nft.kind} data={nft.data} rarity={CRATE_TIERS[nft.tier]?.rarity ?? nft.data.rarity} serial={nft.id} size={size}>{children}</GameCard>;
}

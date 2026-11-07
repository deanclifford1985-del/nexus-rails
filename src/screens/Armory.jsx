import React, { useState } from 'react';
import { Battery, Cog, Crosshair, Fuel, Package, Radar, Shield, Sparkles, Triangle } from 'lucide-react';
import { B } from '../game/balance.js';
import { useGame } from '../state/store.jsx';
import { activeLoco } from '../game/conductor.js';
import { deriveStats, fitOf, quoteLoad } from '../game/locomotives.js';
import { Delta, ImpactPanel } from '../ui/Impact.jsx';
import { RarityTag } from '../ui/bits.jsx';
import { WeaponCard, WeaponStats } from '../ui/WeaponCard.jsx';
import { armoryOffers, baseOf, weaponLabel, weaponPrice } from '../game/weapons.js';
import { weekNow } from '../game/economy.js';
import { dayIndex } from '../game/calendar.js';
import { fmt, lb } from '../ui/format.js';

const M = B.MODULES;
const ICON = { fuel: Fuel, ammo: Package, battery: Battery, engine: Cog, cannon: Crosshair, heavy: Crosshair, plasma: Sparkles, shield: Shield, radar1: Radar, radar2: Radar, sonar: Radar };
const GROUPS = [
  { label: 'Weapons', ids: ['launcher', 'cannon', 'heavy', 'heat', 'plasma', 'arc', 'tesla', 'windjet'] },
  { label: 'Shields and cooling', ids: ['shield', 'vent'] },
  { label: 'Sensors', ids: ['radar1', 'radar2', 'sonar'] },
  { label: 'Storage', ids: ['fuel', 'ammo', 'battery'] },
  { label: 'Engine', ids: ['engine'] },
];
const SPELL_NAME = { fire: 'Fire', bolt: 'Bolt', barrier: 'Barrier' };

function ModuleIcon({ id }) {
  const Icon = ICON[id] ?? Package;
  return <Icon aria-hidden="true" style={{ width: 18, height: 18, verticalAlign: '-3px' }} />;
}

export default function Armory() {
  const { conductor, act, notify } = useGame();
  const loco = activeLoco(conductor);
  const stats = deriveStats(loco, conductor);
  // A reference load to judge changes by: your containers at a typical weight, and 100 gallons.
  const typicalLb = (B.JOBS.containerLb[0] + B.JOBS.containerLb[1]) / 2;
  const refCargo = Math.max(1, conductor.containers ?? 1) * typicalLb * stats.cargoFactor;
  const quoteFor = (s) => quoteLoad(s, refCargo, 100);
  const now = quoteFor(stats);
  const [before, setBefore] = useState(null);
  // Every fitting change shows what it did to the numbers.
  const doAct = (name, args) => {
    const prev = now;
    const report = act(name, args);
    if (report) setBefore(prev);
    return report;
  };
  // What fitting one more `id` would do, against the numbers now.
  const preview = (id) => {
    const s = deriveStats({ ...loco, fit: [...fitOf(loco), id] }, conductor);
    const q = quoteFor(s);
    return { speed: q.topSpeed - now.topSpeed, fuel: (q.galPerMile - now.galPerMile) * 100, tow: s.tow - stats.tow, tank: s.tank - stats.tank };
  };
  const Preview = ({ id }) => {
    const p = preview(id);
    return (
      <div className="impact-mini">
        <span>
          Speed <Delta value={p.speed} digits={1} unit=" mph" />
        </span>
        <span>
          Fuel <Delta value={p.fuel} digits={1} unit=" gal/100 mi" better="down" />
        </span>
        {Math.abs(p.tow) > 1 ? (
          <span>
            Towing <Delta value={p.tow} unit=" lb" />
          </span>
        ) : null}
        {p.tank ? (
          <span>
            Tank <Delta value={p.tank} unit=" gal" />
          </span>
        ) : null}
      </div>
    );
  };
  const fit = fitOf(loco);
  const gear = conductor.gear ?? {};
  const free = stats.capacity - stats.slotsUsed;
  const spare = Object.entries(gear).filter(([, n]) => n > 0);
  // Weapons can be doubled up; only the shield is one per locomotive.
  const hasArm = (id) => id === 'shield' && fit.some((item) => baseOf(item) === 'shield');
  const arsenal = conductor.arsenal ?? [];
  const week = weekNow(conductor);
  const offers = armoryOffers(week);
  const bought = new Set(conductor.boughtOffers ?? []);
  const daysLeft = B.WEEK.days - (dayIndex(conductor.clock ?? 0) % B.WEEK.days);

  const pips = [];
  for (const entry of fit) for (let i = 0; i < M[baseOf(entry)].slots; i++) pips.push(M[baseOf(entry)].kind);
  while (pips.length < stats.capacity) pips.push(null);

  return (
    <div className="stack">
      <div className="page-head">
        <span className="label">Armory</span>
        <h1>
          Engineering <span>Bay</span>
        </h1>
        <p>
          Every locomotive has a Capacity: how many cargo slots it can fill. Weapons, shields, fuel storage, ammo crates, batteries and bigger engines all take slots, and all of them add weight.
        </p>
      </div>

      <section className="plate riveted stack">
        <div className="spread">
          <div>
            <span className="label">Fitting out</span>
            <h2>{loco.name}</h2>
          </div>
          <RarityTag rarity={loco.rarity} />
        </div>
        <div className="slot-meter" aria-label={`${stats.slotsUsed} of ${stats.capacity} slots used`}>
          {pips.map((kind, i) => (
            <i key={i} className={kind ? `on ${kind}` : ''} />
          ))}
        </div>
        <div className="stats">
          <div className="stat">
            <span className="label">Slots free</span>
            <b>
              {free}
              <small>of {stats.capacity}</small>
            </b>
          </div>
          <div className="stat">
            <span className="label">Kit weight</span>
            <b>
              {lb(stats.moduleWeight)}
              <small>lb</small>
            </b>
          </div>
          <div className="stat">
            <span className="label">Tank</span>
            <b>
              {fmt(stats.tank)}
              <small>gal</small>
            </b>
          </div>
          <div className="stat">
            <span className="label">Ammo</span>
            <b title="Ammo units: a cannonball takes 3. Missiles burn fuel instead">
              {stats.ammo}
              <small>units</small>
            </b>
          </div>
          <div className="stat">
            <span className="label">Charge</span>
            <b>{stats.charge}</b>
          </div>
          <div className="stat">
            <span className="label">Sees ahead</span>
            <b>
              {fmt(stats.sight, 1)}
              <small>mi</small>
            </b>
          </div>
          <div className="stat">
            <span className="label">Top speed loaded</span>
            <b>
              {fmt(now.topSpeed)}
              <small>mph</small>
            </b>
          </div>
        </div>
        <p className="small muted">
          {stats.spells.length ? (
            <>
              <span className="tag tag-arcane">Spells</span> This engine knows {stats.spells.map((s) => SPELL_NAME[s]).join(', ')}. Spells cost MP, not slots.
            </>
          ) : (
            'No spells. Only Epic and Legendary engines know spells; this one fights with what you fit.'
          )}
        </p>

        <div className="slots">
          {fit.map((entry, index) => {
            const id = baseOf(entry);
            const weapon = M[id].kind === 'weapon';
            return (
            <div className={`slot ${M[id].slots > 1 || weapon ? 'wide' : ''}`} key={`${id}-${index}`}>
              <span className="slot-kind">
                {M[id].kind} · {M[id].slots} slot{M[id].slots === 1 ? '' : 's'}
              </span>
              <b>
                <ModuleIcon id={id} /> {weapon ? weaponLabel(entry) : M[id].name}
              </b>
              {weapon ? <WeaponStats weapon={entry} /> : null}
              <span className="small muted">{lb(M[id].weight)} lb</span>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => doAct('unfitModule', { index })}>
                Take out
              </button>
            </div>
            );
          })}
          {Array.from({ length: Math.max(0, free) }, (_, i) => (
            <div className="slot empty" key={`empty-${i}`}>
              Empty slot
            </div>
          ))}
        </div>
        <div className="stack-sm">
          <span className="label">
            Pulling your {conductor.containers ?? 1} container{(conductor.containers ?? 1) === 1 ? '' : 's'} at a typical {Math.round(typicalLb).toLocaleString()} lb with 100 gallons
          </span>
          <ImpactPanel now={now} before={before} tow={stats.tow} />
        </div>
        <p className="small muted">
          Fuel costs weight too: every gallon you load adds {B.LOCO.fuelLbPerGallon} lb. Cannonballs fired are restocked after each run at {fmt(B.ARMORY.roundPrice * 3, 1)} LT each. Missiles burn {B.COMBAT.launcher.cost} gallons of fuel apiece from your tank, so a launcher wants a bigger fuel load (and fuel is heavy).
        </p>
      </section>

      <section className="plate stack">
        <div className="plate-head">
          <h3>This week's weapons</h3>
          <span className="muted small">New stock in {daysLeft} day{daysLeft === 1 ? '' : 's'}</span>
        </div>
        <p className="small muted">A few rolled weapons each week, with their own attributes and, from Rare up, special traits. When they are gone, they are gone.</p>
        <div className="grid">
          {offers.map((w) => {
            const sold = bought.has(w.uid);
            const price = weaponPrice(w);
            const canFit = M[w.base].slots <= free && !hasArm(w.base);
            return (
              <article className="plate stack-sm" key={w.uid}>
                <WeaponCard weapon={w}>
                  <span className="small muted">
                    {M[w.base].slots} slot{M[w.base].slots === 1 ? '' : 's'}, {lb(M[w.base].weight)} lb
                  </span>
                  <Preview id={w} />
                  {sold ? (
                    <p className="note small">Bought. It is on your shelf or fitted.</p>
                  ) : (
                    <div className="row">
                      <button type="button" className="btn btn-sm" disabled={conductor.lt < price} onClick={() => act('buyWeapon', { uid: w.uid }) && notify(`${w.name} is on the shelf.`, 'good')}>
                        Buy {fmt(price)} LT
                      </button>
                      <button type="button" className="btn btn-sm btn-brass" disabled={conductor.lt < price || !canFit} title={!canFit ? 'Free a slot first' : undefined} onClick={() => doAct('buyWeapon', { uid: w.uid, fit: true }) && notify(`${w.name} fitted.`, 'good')}>
                        Buy and fit
                      </button>
                    </div>
                  )}
                </WeaponCard>
              </article>
            );
          })}
        </div>
      </section>

      {arsenal.length ? (
        <section className="plate stack">
          <h3>Weapons on the shelf</h3>
          {arsenal.map((w) => (
            <div className="shop-row" key={w.uid}>
              <div className="grow">
                <WeaponCard weapon={w} />
                <Preview id={w} />
              </div>
              <div className="row">
                <button type="button" className="btn btn-sm" onClick={() => act('sellWeapon', { uid: w.uid }) && notify('Sold.')}>
                  Sell {fmt(Math.floor(weaponPrice(w) * B.ARMORY.resale))} LT
                </button>
                <button type="button" className="btn btn-sm btn-brass" disabled={M[w.base].slots > free || hasArm(w.base)}  onClick={() => doAct('fitWeapon', { uid: w.uid })}>
                  Fit
                </button>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {spare.length ? (
        <section className="plate stack">
          <h3>Modules on the shelf</h3>
          {spare.map(([id, n]) => (
            <div className="shop-row" key={id}>
              <div className="grow">
                <b>
                  <ModuleIcon id={id} /> {M[id].name}
                </b>{' '}
                <span className="muted small">× {n}</span>
                <div className="small muted">{M[id].text}</div>
                <Preview id={id} />
              </div>
              <div className="row">
                <button type="button" className="btn btn-sm" onClick={() => act('sellModule', { id }) && notify(`Sold for ${Math.floor(M[id].price * B.ARMORY.resale)} LT.`)}>
                  Sell {fmt(Math.floor(M[id].price * B.ARMORY.resale))} LT
                </button>
                <button type="button" className="btn btn-sm btn-brass" disabled={M[id].slots > free || hasArm(id)} onClick={() => doAct('fitModule', { id })}>
                  Fit
                </button>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <section className="plate stack">
        <div className="plate-head">
          <h3>
            <Triangle aria-hidden="true" style={{ width: 17, height: 17, verticalAlign: '-3px' }} /> Fronts
          </h3>
          <span className="muted small">No slot; one per locomotive; the old one sells back for half</span>
        </div>
        <p className="small muted">Some debris is not worth a round. A stronger front bursts through it and takes the sting out of what it cannot break.</p>
        {Object.entries(B.FRONTS).map(([id, f]) => {
          const current = (loco.front ?? 'cowcatcher') === id;
          const refund = Math.floor((B.FRONTS[loco.front ?? 'cowcatcher'].price ?? 0) * B.FRONT_RESALE);
          const smashes = ['nothing', 'debris', 'debris and boulders', 'all but giant boulders'][f.smash + 1];
          return (
            <div className="shop-row" key={id}>
              <div className="grow">
                <b>{f.name}</b> {current ? <span className="tag tag-arcane">Fitted</span> : null}
                <div className="small muted">
                  {f.text} Crushes {smashes}; {Math.round(f.cut * 100)}% less crash damage; {lb(f.weight)} lb.
                </div>
              </div>
              {current ? null : (
                <button type="button" className="btn btn-sm btn-brass" disabled={conductor.lt + refund < f.price} onClick={() => doAct('buyFront', { id }) && notify(`${f.name} fitted.`, 'good')}>
                  {f.price ? `Fit for ${fmt(f.price)} LT` : 'Refit'}
                </button>
              )}
            </div>
          );
        })}
      </section>

      <section className="plate stack">
        <h3>Always in stock</h3>
        {GROUPS.map((group) => (
          <div className="stack-sm" key={group.label}>
            <span className="label">{group.label}</span>
            {group.ids.map((id) => {
              const info = M[id];
              const arm = info.arm ? B.COMBAT[info.arm] : null;
              const canFit = info.slots <= free && !hasArm(id);
              return (
                <div className="shop-row" key={id}>
                  <div className="grow">
                    <b>
                      <ModuleIcon id={id} /> {info.name}
                    </b>
                    <div className="small muted">
                      {info.text}. {info.slots} slot{info.slots === 1 ? '' : 's'}, {lb(info.weight)} lb.
                      {arm?.range ? ` Reaches ${arm.range} mi.` : ''}
                    </div>
                    {info.kind === 'weapon' ? <WeaponStats weapon={id} /> : null}
                    <Preview id={id} />
                  </div>
                  <div className="row">
                    <button type="button" className="btn btn-sm" disabled={conductor.lt < (info.kind === 'weapon' ? weaponPrice(id) : info.price)} onClick={() => act('buyModule', { id }) && notify(`${info.name} is on the shelf.`, 'good')}>
                      Buy {fmt(info.price)} LT
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-brass"
                      disabled={conductor.lt < info.price || !canFit}
                      title={!canFit ? (hasArm(id) ? 'One shield per locomotive' : 'Not enough free slots') : undefined}
                      onClick={() => doAct('buyModule', { id, fit: true }) && notify(`${info.name} fitted.`, 'good')}
                    >
                      Buy and fit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </section>
    </div>
  );
}

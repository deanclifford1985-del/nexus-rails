import React from 'react';
import { Flag, Zap } from 'lucide-react';
import { B } from '../game/balance.js';
import { useGame } from '../state/store.jsx';
import { MODELS, MYTHIC_MODELS, SUPER_TRAITS, deriveStats } from '../game/locomotives.js';
import { mythicForSale, phoenixForSale } from '../game/economy.js';
import { RarityTag, Stat, useCooldown } from '../ui/bits.jsx';
import { LocoArt } from '../ui/LocoArt.jsx';
import { CoreStats } from '../ui/LocoStats.jsx';
import { fmt, lb, ltWhole } from '../ui/format.js';

export default function Station() {
  const { conductor, act, go, notify } = useGame();
  const phoenix = phoenixForSale();
  const phoenixStats = deriveStats(phoenix, conductor);
  const ownsPhoenix = conductor.locos.some((loco) => loco.model === 'phoenix');
  const full = conductor.locos.length >= B.LOCO.garageSlots;
  const turnsIn = B.WEEK.days - (Math.floor((conductor.clock ?? 0) / 1440) % B.WEEK.days);

  const [cooling, cool] = useCooldown();

  function buy(loco) {
    const report = act('buyLoco', { id: loco.id });
    cool();
    if (report) notify(`${loco.name} is in your garage. Switch to it from the yard.`, 'good');
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h1>
          Loco <span>Station</span>
        </h1>
        <p>
          Locomotives for sale. What you buy goes to your garage ({conductor.locos.length} of {B.LOCO.garageSlots} bays). New stock arrives every week: in {turnsIn} day{turnsIn === 1 ? '' : 's'}. Numbers include what your conductor adds.
        </p>
      </div>

      <section className="plate riveted">
        <div className="cols even">
          <div className="stack-sm">
            <div className="row">
              <RarityTag rarity="legendary" />
              <span className="label">Always on the lot</span>
            </div>
            <h2>{phoenix.name}</h2>
            <p className="muted">{MODELS.phoenix.blurb}</p>
            <CoreStats loco={phoenix} />
            <div className="stats">
              <Stat label="Horsepower" value={fmt(phoenixStats.hp)} />
              <Stat label="Torque" value={fmt(phoenixStats.tq)} />
              <Stat label="Top speed" value={fmt(phoenixStats.topSpeed)} unit="mph at 5 tons" />
              <Stat label="Can tow" value={lb(phoenixStats.tow)} unit="lb" />
            </div>
            <p className="note">
              <Zap aria-hidden="true" style={{ width: 15, height: 15, verticalAlign: '-2px' }} className="ember" /> <b>Siphon Speed.</b> Once a run, take {Math.round(B.RACE.siphon.steal * 100)}% of the nearest rival's speed for {B.RACE.siphon.seconds} seconds. They slow down and you gain what they lose.
            </p>
            <div className="row">
              <button type="button" className="btn btn-ember" onClick={() => go('setup', { ctx: { kind: 'demo' } })}>
                <Flag aria-hidden="true" />
                Test drive
              </button>
              <button type="button" className="btn btn-brass" disabled={cooling || ownsPhoenix || full || conductor.lt < phoenix.price} onClick={() => buy(phoenix)}>
                {ownsPhoenix ? 'In your garage' : `Buy for ${ltWhole(phoenix.price)} LT`}
              </button>
            </div>
          </div>
          <div style={{ display: 'grid', placeItems: 'center' }}>
            <LocoArt model="phoenix" />
          </div>
        </div>
      </section>

      <section className="stack">
        <div>
          <h2>The back siding</h2>
          <p className="muted">Mythic engines for the very end of the line. Each knows its own spells and needs no weapons to fight.</p>
        </div>
        <div className="grid">
          {MYTHIC_MODELS.map((model) => {
            const loco = mythicForSale(model);
            const stats = deriveStats(loco, conductor);
            const owned = conductor.locos.some((item) => item.model === model);
            return (
              <article className="plate riveted stack-sm" key={model}>
                <div className="spread">
                  <h3>{loco.name}</h3>
                  <RarityTag rarity={loco.rarity} />
                </div>
                <LocoArt model={model} />
                <p className="muted small">{MODELS[model].blurb}</p>
                <CoreStats loco={loco} />
                <div className="stats">
                  <Stat label="Horsepower" value={fmt(stats.hp)} />
                  <Stat label="Torque" value={fmt(stats.tq)} />
                  <Stat label="HP" value={fmt(stats.hull)} />
                  <Stat label="Capacity" value={stats.capacity} unit="slots" />
                </div>
                <span className="tag tag-arcane">{MODELS[model].perk}</span>
                <button type="button" className="btn btn-brass btn-block" disabled={cooling || owned || full || conductor.lt < loco.price} onClick={() => buy(loco)}>
                  {owned ? 'In your garage' : `Buy for ${ltWhole(loco.price)} LT`}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      {full ? <p className="note warn">Your garage is full. Sell a locomotive from the yard to buy another.</p> : null}

      <div className="grid">
        {conductor.station.stock.map((loco) => {
          const stats = deriveStats(loco, conductor);
          return (
            <article className="plate stack-sm" key={loco.id}>
              <div className="spread">
                <h3>{loco.name}</h3>
                <RarityTag rarity={loco.rarity} />
              </div>
              <LocoArt model={loco.model} />
              <CoreStats loco={loco} />
              <div className="stats">
                <Stat label="Horsepower" value={fmt(stats.hp)} />
                <Stat label="Torque" value={fmt(stats.tq)} />
                <Stat label="Top speed" value={fmt(stats.topSpeed)} unit="mph at 5 tons" />
                <Stat label="Fuel economy" value={fmt(stats.tmpg, 1)} unit="ton-mi/gal" />
                <Stat label="Weight" value={lb(stats.weight)} unit="lb" />
                <Stat label="Can tow" value={lb(stats.tow)} unit="lb" />
              </div>
              <span className="small brass">
                {MODELS[loco.model].perk}
                {loco.superTrait ? `. ${SUPER_TRAITS[loco.superTrait].name}: ${SUPER_TRAITS[loco.superTrait].text}` : ''}
              </span>
              <button type="button" className="btn btn-brass btn-block" disabled={cooling || full || conductor.lt < loco.price} onClick={() => buy(loco)}>
                Buy for {ltWhole(loco.price)} LT
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

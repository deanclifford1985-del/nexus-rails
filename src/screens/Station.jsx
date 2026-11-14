import React, { useState } from 'react';
import { Flag, Gem, Hammer, Lock, Sparkles, Zap } from 'lucide-react';
import { B } from '../game/balance.js';
import { useGame } from '../state/store.jsx';
import { LEGEND_MODELS, MODELS, SUPER_TRAITS, deriveStats } from '../game/locomotives.js';
import { mythicForSale, phoenixForSale } from '../game/economy.js';
import { legendOffer } from '../game/bosses.js';
import { garageSlots } from '../game/empire.js';
import { RarityTag, Stat, useCooldown } from '../ui/bits.jsx';
import { LocoArt } from '../ui/LocoArt.jsx';
import { LegendViewer } from '../ui/LegendViewer.jsx';
import { CoreStats } from '../ui/LocoStats.jsx';
import { fmt, lb, ltWhole } from '../ui/format.js';

const SPELL_NAMES = { fire: 'Fire', bolt: 'Bolt', barrier: 'Barrier', frost: 'Frost Breath' };

// The Hall of Legends: every legendary machine on a turntable, what it does, and how to get it.
function HallOfLegends({ conductor, buy, cooling, full }) {
  const firstOpen = LEGEND_MODELS.find((model) => !legendOffer(conductor, model)?.locked && !conductor.locos.some((item) => item.model === model)) ?? LEGEND_MODELS[0];
  const [pick, setPick] = useState(firstOpen);
  const loco = mythicForSale(pick);
  const stats = deriveStats(loco, conductor);
  const m = B.MYTHIC[pick];
  const offer = legendOffer(conductor, pick);
  const owned = conductor.locos.some((item) => item.model === pick);
  const ability = B.ABILITIES[m.ability];
  const boss = offer.bossId ? B.BOSSES[offer.bossId] : null;
  return (
    <section className="stack">
      <div>
        <h2>
          Hall of <span className="hl-orange">Legends</span>
        </h2>
        <p className="muted">
          The legendary machines. Each knows its own spells and carries a signature ability no other engine has. Some can be bought outright; the rest are forged from the relic of a boss you have brought down, for half the list price.
        </p>
      </div>
      <div className="legend-roster" role="tablist" aria-label="Legendary machines">
        {LEGEND_MODELS.map((model) => {
          const o = legendOffer(conductor, model);
          const has = conductor.locos.some((item) => item.model === model);
          return (
            <button type="button" role="tab" aria-selected={pick === model} key={model} className={`legend-tab ${pick === model ? 'on' : ''} ${o.locked ? 'locked' : ''}`} onClick={() => setPick(model)}>
              <LocoArt model={model} className="loco-art legend-thumb" />
              <span className="legend-tab-name">{MODELS[model].name.replace(/^The /, '')}</span>
              <span className="small">
                {has ? <span className="go">Owned</span> : o.locked ? <Lock aria-hidden="true" /> : o.forged ? <span className="brass">Forge</span> : <span className="muted">{fmt(o.price / 1000)}k</span>}
              </span>
            </button>
          );
        })}
      </div>
      <article className="plate riveted legend-stage">
        <div className="cols even">
          <LegendViewer key={pick} model={pick} name={loco.name} />
          <div className="stack-sm">
            <div className="row">
              <RarityTag rarity={loco.rarity} />
              <span className="label">{m.forgeOnly ? 'Forged, never sold' : 'For sale, or forged'}</span>
            </div>
            <h2>{loco.name}</h2>
            <p className="muted">{MODELS[pick].blurb}</p>
            <CoreStats loco={loco} />
            <div className="stats">
              <Stat label="Horsepower" value={fmt(stats.hp)} />
              <Stat label="Torque" value={fmt(stats.tq)} />
              <Stat label="Top speed" value={fmt(stats.topSpeed)} unit="mph at 5 tons" />
              <Stat label="Hull" value={fmt(stats.hull)} unit="HP" />
              <Stat label="Can tow" value={lb(stats.tow)} unit="lb" />
              <Stat label="Capacity" value={stats.capacity} unit="slots" />
            </div>
            <p className="note legend-ability">
              <Sparkles aria-hidden="true" style={{ width: 15, height: 15, verticalAlign: '-2px' }} /> <b>{ability.name}.</b> {ability.text}{' '}
              <span className="muted">{ability.uses ? `${ability.uses === 1 ? 'Once' : `${ability.uses} times`} a run.` : `Recharges in ${ability.cooldown} seconds.`}</span>
            </p>
            <div className="row" style={{ gap: 6 }}>
              {stats.spells.map((spell) => (
                <span className="tag tag-arcane" key={spell}>
                  {SPELL_NAMES[spell] ?? spell}
                </span>
              ))}
              {m.rebirth ? <span className="tag tag-legendary">Rebirth</span> : null}
              {m.smash >= 0 ? <span className="tag tag-uncommon">Jaws crush boulders</span> : null}
              {m.bootMult ? <span className="tag tag-uncommon">Weapons boot {Math.round((1 - m.bootMult) * 100)}% sooner</span> : null}
              {m.hullBonus ? <span className="tag tag-uncommon">+{m.hullBonus} hull</span> : null}
            </div>
            {boss ? (
              <p className={`small ${offer.forged ? 'brass' : 'muted'}`}>
                <Gem aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: '-2px' }} />{' '}
                {offer.forged
                  ? `You hold ${boss.relic}: forge it for ${ltWhole(m.forge.price)} LT instead of ${ltWhole(m.price)}.`
                  : m.forgeOnly
                    ? `Forged from ${boss.relic}, won by bringing down ${boss.name} (Dispatch, Bounties). Then ${ltWhole(m.forge.price)} LT.`
                    : `Bring down ${boss.name} for ${boss.relic} and it forges for ${ltWhole(m.forge.price)} LT.`}
              </p>
            ) : null}
            {offer.locked ? (
              <button type="button" className="btn btn-block" disabled>
                <Lock aria-hidden="true" />
                Needs {boss.relic}
              </button>
            ) : (
              <button type="button" className={`btn btn-block ${offer.forged ? 'btn-ember' : 'btn-brass'}`} disabled={cooling || owned || full || conductor.lt < offer.price} onClick={() => buy(loco, offer.forged)}>
                {offer.forged ? <Hammer aria-hidden="true" /> : null}
                {owned ? 'In your garage' : `${offer.forged ? 'Forge' : 'Buy'} for ${ltWhole(offer.price)} LT`}
              </button>
            )}
          </div>
        </div>
      </article>
    </section>
  );
}

export default function Station() {
  const { conductor, act, go, notify } = useGame();
  const phoenix = phoenixForSale();
  const phoenixStats = deriveStats(phoenix, conductor);
  const ownsPhoenix = conductor.locos.some((loco) => loco.model === 'phoenix');
  const bays = garageSlots(conductor);
  const full = conductor.locos.length >= bays;
  const turnsIn = B.WEEK.days - (Math.floor((conductor.clock ?? 0) / 1440) % B.WEEK.days);

  const [cooling, cool] = useCooldown();

  function buy(loco, forged = false) {
    const report = act('buyLoco', { id: loco.id });
    cool();
    if (report) notify(`${loco.name} is ${forged ? 'forged and ' : ''}in your garage. Switch to it from the yard.`, 'good');
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h1>
          Loco <span>Station</span>
        </h1>
        <p>
          Locomotives for sale. What you buy goes to your garage ({conductor.locos.length} of {bays} bays). New stock arrives every week: in {turnsIn} day{turnsIn === 1 ? '' : 's'}. Numbers include what your conductor adds.
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
              <Zap aria-hidden="true" style={{ width: 15, height: 15, verticalAlign: '-2px' }} className="ember" /> <b>Siphon Speed.</b> Once a run, take {Math.round(B.RACE.siphon.steal * 100)}% of the nearest rival's speed for {B.RACE.siphon.seconds} seconds. They slow down and you gain what they lose.{' '}
              <b>Rebirth.</b> Once a run, knocked to 0 HP, it rises again with {Math.round(B.MYTHIC.phoenix.rebirth * 100)}% of its hull.
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

      <HallOfLegends conductor={conductor} buy={buy} cooling={cooling} full={full} />

      {full ? <p className="note warn">Your garage is full. Sell a locomotive from the yard, or open a terminal (Empire) for another bay.</p> : null}

      <div>
        <h2>This week's lot</h2>
        <p className="muted">Working engines of every grade. The lot changes every week.</p>
      </div>
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

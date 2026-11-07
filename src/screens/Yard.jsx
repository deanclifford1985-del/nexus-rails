import React from 'react';
import { ClipboardList, Plus } from 'lucide-react';
import { B } from '../game/balance.js';
import { useGame } from '../state/store.jsx';
import { ATTRIBUTES, activeLoco, avgFuelCost, xpForLevel } from '../game/conductor.js';
import { MODELS, SUPER_TRAITS, deriveStats, resaleValue } from '../game/locomotives.js';
import { companyById, nextStarAt, starsFor } from '../game/jobs.js';
import { ConfirmButton, Meter, RarityTag, Stars, Stat, TraitChips } from '../ui/bits.jsx';
import { LocoArt } from '../ui/LocoArt.jsx';
import { CoreStats, LocoStats } from '../ui/LocoStats.jsx';
import { fmt, gal, lt, ltWhole } from '../ui/format.js';
import { CalendarCard } from '../ui/Calendar.jsx';
import GameCard from '../ui/GameCard.jsx';
import { StartChecklist } from '../ui/Intro.jsx';
import { Licences } from '../ui/Licence.jsx';
import { IS_NFT } from '../edition.js';

const OUTCOME = {
  won: ['Won', 'go'],
  delivered: ['Delivered', 'go'],
  lost: ['Lost', 'stop'],
  late: ['Late', 'stop'],
  forfeit: ['Forfeit', 'stop'],
};

export default function Yard() {
  const { conductor, act, go, notify } = useGame();
  const loco = activeLoco(conductor);
  const stats = deriveStats(loco, conductor);
  const need = xpForLevel(conductor.level);
  const companies = Object.entries(conductor.companies).sort((a, b) => b[1].rep - a[1].rep);

  return (
    <div className="stack">
      <StartChecklist />
      <CalendarCard />
      <section className="plate">
        <Licences conductor={conductor} />
      </section>
      <div className="cols">
        <section className="paper licence">
          <div className="spread">
            <span className="label">Conductor licence</span>
            <span className="stamp gold">Level {conductor.level}</span>
          </div>
          <div className="licence-name">{conductor.name}</div>
          <div>
            <div className="spread small">
              <span className="label">Experience</span>
              <span className="num">
                {fmt(conductor.xp)} / {fmt(need)}
              </span>
            </div>
            <Meter value={conductor.xp} max={need} label="Experience to next level" />
          </div>
          {conductor.attributePoints > 0 ? (
            <p className="note">
              <b>
                {conductor.attributePoints} attribute point{conductor.attributePoints === 1 ? '' : 's'} to spend.
              </b>{' '}
              Add it to one of the three below.
            </p>
          ) : null}
          <div className="attr-row">
            {Object.keys(ATTRIBUTES).map((key) => (
              <div className="attr-box" key={key}>
                <span className="label">{ATTRIBUTES[key].name}</span>
                <b>{conductor[key]}</b>
                <span className="small muted">{ATTRIBUTES[key].gives}</span>
                {conductor.attributePoints > 0 ? (
                  <button type="button" className="btn btn-brass btn-sm btn-block" style={{ marginTop: 6 }} onClick={() => act('spendAttributePoint', { key })} aria-label={`Add a point to ${ATTRIBUTES[key].name}`}>
                    <Plus aria-hidden="true" />1
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <div>
            <span className="label">Traits</span>
            <TraitChips traits={conductor.traits} />
          </div>
        </section>

        <section className="plate riveted stack">
          <div className="spread">
            <div>
              <span className="label">On the main line</span>
              <h2>{loco.name}</h2>
            </div>
            <RarityTag rarity={loco.rarity} />
          </div>
          <LocoArt model={loco.model} />
          <CoreStats loco={loco} />
          <LocoStats stats={stats} />
          <p className="small brass">
            {MODELS[loco.model].perk}
            {loco.superTrait ? `. ${SUPER_TRAITS[loco.superTrait].name}: ${SUPER_TRAITS[loco.superTrait].text}` : ''}
          </p>
        </section>
      </div>

      <section className="plate stack">
        <div className="spread">
          <div className="stats grow" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
            <Stat label="LocoTokens" value={lt(conductor.lt)} tone="brass" />
            <Stat label="Fuel reserve" value={gal(conductor.fuel.gallons)} unit="gal" tone="fuel" />
            <Stat label="Average fuel cost" value={fmt(avgFuelCost(conductor), 2)} unit="LT/gal" />
            <Stat label="Cargo containers" value={conductor.containers} unit="owned" />
            <Stat label="Runs" value={`${conductor.stats.wins} / ${conductor.stats.runs}`} unit="made good" />
            <Stat label="Miles" value={fmt(conductor.stats.miles)} />
          </div>
          <button type="button" className="btn btn-brass btn-lg" onClick={() => go('jobs')}>
            <ClipboardList aria-hidden="true" />
            Job board
          </button>
        </div>
      </section>

      <div className="cols even">
        <section className="plate stack">
          <div className="plate-head">
            <h3>Garage</h3>
            <span className="muted small">
              {conductor.locos.length} of {B.LOCO.garageSlots} bays
            </span>
          </div>
          {conductor.locos.map((item) => {
            const active = item.id === loco.id;
            const s = deriveStats(item, conductor);
            return (
              <div className="spread" key={item.id}>
                <div className="grow">
                  <div className="row" style={{ gap: 6 }}>
                    <b>{item.name}</b>
                    <RarityTag rarity={item.rarity} />
                    {active ? <span className="tag tag-solid">In use</span> : null}
                  </div>
                  <span className="muted small num">
                    {fmt(s.hp)} hp, {fmt(s.topSpeed)} mph at 5 tons, tows {fmt(s.tow)} lb
                  </span>
                </div>
                {!active ? (
                  <div className="row">
                    <ConfirmButton
                      confirmLabel={`Sell for ${ltWhole(resaleValue(item))} LT`}
                      onConfirm={() => {
                        const report = act('sellLoco', { id: item.id });
                        if (report) notify(`Sold for ${ltWhole(report.value)} LT.`, 'good');
                      }}
                    >
                      Sell
                    </ConfirmButton>
                    <button type="button" className="btn btn-sm" onClick={() => act('setActiveLoco', { id: item.id })}>
                      Use
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>

        <section className="plate stack">
          <div className="plate-head">
            <h3>Company standing</h3>
          </div>
          {companies.length === 0 ? <p className="muted">Race for an open contract on the job board to start a relationship with a company.</p> : null}
          {companies.map(([id, record]) => {
            const stars = starsFor(record.rep);
            const next = nextStarAt(record.rep);
            return (
              <div key={id} className="stack-sm">
                <div className="spread">
                  <b>{companyById(id).name}</b>
                  <Stars count={stars} />
                </div>
                <div className="spread small muted">
                  <span>
                    {record.contracts} contract{record.contracts === 1 ? '' : 's'} in hand
                  </span>
                  <span className="num">{next ? `${fmt(record.rep)} / ${fmt(next)} reputation` : `${fmt(record.rep)} reputation`}</span>
                </div>
                <Meter thin value={record.rep} max={next ?? record.rep} label="Reputation to next star" />
              </div>
            );
          })}
        </section>
      </div>

      <section className="plate stack">
        <div className="plate-head">
          <h3>Card collection</h3>
          <span className="muted small">Power ratings: Uncommon about 500 to 900, Legendary about 6,000</span>
        </div>
        <div className="gcard-grid">
          {conductor.locos.map((item) => (
            <GameCard kind="loco" data={item} key={item.id} size="sm" serial={item.nftId ?? MODELS[item.model]?.name} footer={item.id === loco.id ? <span className="tag tag-solid">In use</span> : null}>
              {item.id !== loco.id ? (
                <button type="button" className="btn btn-sm btn-block" onClick={() => act('setActiveLoco', { id: item.id })}>
                  Use this locomotive
                </button>
              ) : null}
            </GameCard>
          ))}
          {IS_NFT
            ? (conductor.crew ?? []).map((c) => <GameCard kind="crew" data={c} key={c.id} size="sm" serial={c.nftId ?? 'Rookie'} />)
            : <GameCard kind="crew" data={{ ...conductor, id: `captain-${conductor.createdAt}`, rarity: 'uncommon' }} size="sm" serial={`Level ${conductor.level}`} />}
        </div>
      </section>

      <section className="plate stack">
        <div className="plate-head">
          <h3>Recent runs</h3>
        </div>
        {conductor.history.length === 0 ? <p className="muted">Nothing yet. Your runs will be logged here.</p> : null}
        <ul className="history">
          {conductor.history.map((entry, index) => {
            const [label, tone] = OUTCOME[entry.outcome] ?? [entry.outcome, ''];
            return (
              <li key={index}>
                <span>
                  <b>{entry.title}</b> <span className={tone}>{label}</span>
                </span>
                <span className="num brass">{entry.payout ? `+${ltWhole(entry.payout)} LT` : ''}</span>
                <span className="muted small">{entry.miles} miles</span>
                <span className="muted small num" style={{ textAlign: 'right' }}>
                  +{fmt(entry.xp)} XP
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

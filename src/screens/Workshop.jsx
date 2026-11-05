import React from 'react';
import { FlaskConical, Lock, Wrench } from 'lucide-react';
import { B } from '../game/balance.js';
import { useGame } from '../state/store.jsx';
import { activeLoco } from '../game/conductor.js';
import { UPGRADE_TYPES, deriveStats, upgradeStage } from '../game/locomotives.js';
import { RESEARCH, repairQuote, stagesUnlocked, upgradeCost } from '../game/economy.js';
import { hasTrait } from '../game/traits.js';
import { Meter, Pips, RarityTag, useCooldown } from '../ui/bits.jsx';
import { LocoStats } from '../ui/LocoStats.jsx';
import { fmt, ltWhole } from '../ui/format.js';

const TOTAL = B.WORKSHOP.costs.length;

export default function Workshop() {
  const { conductor, act, go, notify } = useGame();
  const loco = activeLoco(conductor);
  const stats = deriveStats(loco, conductor);

  const [cooling, cool] = useCooldown();

  function buy(type) {
    const report = act('buyUpgrade', { type });
    cool();
    if (!report) return;
    if (type === 'tank') notify(`Cargo frame stage ${report.stage}: one more Capacity slot.`, 'good');
    else notify(`${UPGRADE_TYPES[type].name} stage ${report.stage}: +${fmt(report.gain * 100, 1)}% ${UPGRADE_TYPES[type].gives}.`, 'good');
  }
  const condition = loco.condition ?? 1;
  const full = repairQuote(loco, 100);
  const some = repairQuote(loco, 10);
  function repair(pct) {
    const report = act('repairLoco', { pct });
    if (report) notify(`Repaired ${fmt(report.pct, 1)}% for ${ltWhole(report.cost)} LT.`, 'good');
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h1>
          The <span>Workshop</span>
        </h1>
        <p>
          Six stages for each part of {loco.name}. Every stage adds 3 to 7%, rolled when it is fitted; the Cargo frame adds a whole Capacity slot instead. Research opens the stages two at a time.
          {hasTrait(conductor, 'engineer') ? ' Engineer: upgrades cost you 15% less.' : ''}
        </p>
      </div>

      <section className="plate riveted stack">
        <div className="spread">
          <h2>{loco.name}</h2>
          <RarityTag rarity={loco.rarity} />
        </div>
        <LocoStats stats={stats} />
      </section>

      <section className="plate stack">
        <div className="spread">
          <h3>
            <Wrench aria-hidden="true" style={{ width: 17, height: 17, verticalAlign: '-3px' }} /> Repairs
          </h3>
          <b className={`condition ${condition < 0.5 ? 'stop' : condition < 0.8 ? 'brass' : 'go'}`}>{fmt(condition * 100, 1)}% durability</b>
        </div>
        <Meter value={condition} max={1} tone={condition < 0.5 ? 'ember' : 'go'} label="Durability" />
        <p className="small muted">
          Every mile wears a locomotive a little ({fmt(B.LOCO.wearPerMile * 100 * 100, 0)}% per 100 miles), and damage and boulder crashes wear it more. HP resets every run; durability stays down until repaired. At 0% an engine has {Math.round(B.LOCO.wearPerformanceFloor * 100)}% of its pull and {Math.round(B.LOCO.wearHullFloor * 100)}% of its HP. Repairs cost {ltWhole(full.perPct)} LT per percent on this engine.
        </p>
        {full.pct > 0 ? (
          <div className="row">
            {some.pct < full.pct ? (
              <button type="button" className="btn" disabled={conductor.lt < some.cost} onClick={() => repair(10)}>
                Repair {fmt(some.pct, 1)}% for {ltWhole(some.cost)} LT
              </button>
            ) : null}
            <button type="button" className="btn btn-brass" disabled={conductor.lt < full.cost} onClick={() => repair(100)}>
              Repair fully for {ltWhole(full.cost)} LT
            </button>
          </div>
        ) : (
          <p className="note small">In perfect order.</p>
        )}
      </section>

      <div className="grid">
        {Object.entries(UPGRADE_TYPES).map(([type, info]) => {
          const stage = upgradeStage(loco, type);
          const open = stagesUnlocked(conductor, info.research);
          const cost = upgradeCost(conductor, stage);
          const gains = loco.upgrades[type] ?? [];
          const total = gains.reduce((product, gain) => product * (1 + gain), 1) - 1;
          const maxed = stage >= TOTAL;
          const locked = !maxed && stage >= open;
          return (
            <article className="plate stack-sm" key={type}>
              <div className="spread">
                <h3>
                  <Wrench aria-hidden="true" style={{ width: 17, height: 17, verticalAlign: '-3px' }} /> {info.name}
                </h3>
                <Pips filled={stage} open={open} total={TOTAL} />
              </div>
              <span className="muted">
                {type === 'tank' ? (
                  <>One more Capacity slot per stage. {stage > 0 ? <b className="brass">+{stage} so far.</b> : 'Nothing fitted yet.'}</>
                ) : (
                  <>More {info.gives}. {stage > 0 ? <b className="brass">+{fmt(total * 100, 1)}% so far.</b> : 'Nothing fitted yet.'}</>
                )}
              </span>
              {maxed ? (
                <p className="note small">Fully upgraded.</p>
              ) : locked ? (
                <div className="note warn small stack-sm">
                  <span>
                    <Lock aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> Stage {stage + 1} needs {RESEARCH[info.research].name} tier {Math.floor(stage / B.WORKSHOP.stagesPerTier) + 1}.
                  </span>
                  <button type="button" className="btn btn-sm" onClick={() => go('research')}>
                    <FlaskConical aria-hidden="true" />
                    Open research
                  </button>
                </div>
              ) : (
                <button type="button" className="btn btn-brass btn-block" disabled={cooling || conductor.lt < cost} onClick={() => buy(type)}>
                  Fit stage {stage + 1} for {ltWhole(cost)} LT
                </button>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

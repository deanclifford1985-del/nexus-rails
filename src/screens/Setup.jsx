import React, { useMemo, useState } from 'react';
import { themeOf } from '../game/course.js';
import { ArrowLeft, Flag, Fuel, Minus, Mountain, Package, Plus } from 'lucide-react';
import { B } from '../game/balance.js';
import { useGame } from '../state/store.jsx';
import { avgFuelCost } from '../game/conductor.js';
import { pumpPrice } from '../game/economy.js';
import { entryFee } from '../game/jobs.js';
import { buildRaceConfig, describeRun } from '../game/setup.js';
import { hasTrait } from '../game/traits.js';
import { Meter, RarityTag, Stat } from '../ui/bits.jsx';
import { ImpactPanel } from '../ui/Impact.jsx';
import { MixLine } from './Jobs.jsx';
import { estimateBand, estimateRange } from '../game/estimate.js';
import { fmtSpan } from '../game/calendar.js';
import { quoteLoad } from '../game/locomotives.js';
import { LocoArt } from '../ui/LocoArt.jsx';
import { dispatchTab } from '../ui/dispatch.js';
import { fmt, gal, lb, lt, ltWhole, minutes, range } from '../ui/format.js';

const KIND_LABEL = {
  test: 'First run',
  delivery: 'Delivery',
  company: 'Contract job',
  contract: 'Contract race',
  race: 'Prize race',
  demo: 'Test drive',
};

const ARM_NAMES = { launcher: 'a missile launcher', cannon: 'a cannon', heavy: 'a heavy cannon', plasma: 'a plasma gun', arc: 'a lightning cannon', fire: 'Fire', bolt: 'Bolt', barrier: 'Barrier', shield: 'Shield', frost: 'Frost Breath', vent: 'a coolant vent' };

// The first run: your train against Benchmark's, before and after the conductors.
function TaleOfTheTape({ conductor, run }) {
  const T = run.tutorial;
  const mine = run.loco;
  const rows = (list) =>
    list.map(([label, you, them, unit = '', show = fmt, lowerWins = false]) => {
      const win = you === them ? '' : you > them !== lowerWins ? 'you' : 'them';
      return (
        <div className="tape-row" key={label}>
          <span className={`num ${win === 'you' ? 'tape-win' : ''}`}>
            {show(you)}
            {unit ? <small> {unit}</small> : null}
          </span>
          <span className="label">{label}</span>
          <span className={`num ${win === 'them' ? 'tape-win' : ''}`}>
            {show(them)}
            {unit ? <small> {unit}</small> : null}
          </span>
        </div>
      );
    });
  const pts = (loco) => loco.power + loco.efficiency + loco.durability + (loco.endurance ?? 5);
  const final = run.stats;
  const theirs = T.stats;
  return (
    <div className="plate stack tape">
      <div className="plate-head">
        <h3>You against Benchmark</h3>
      </div>
      <div className="tape-head">
        <b>You</b>
        <span />
        <b>Benchmark</b>
      </div>
      <h4 className="tape-sub">The locomotive, before your conductor</h4>
      <div className="tape-row">
        <span>
          <RarityTag rarity={mine.rarity} />
        </span>
        <span className="label">Grade</span>
        <span>
          <RarityTag rarity={T.loco.rarity} />
        </span>
      </div>
      {rows([
        ['Stat points', pts(mine), pts(T.loco)],
        ['Efficiency', mine.efficiency, T.loco.efficiency],
        ['Armor', mine.durability, T.loco.durability],
        ['Endurance', mine.endurance ?? 5, T.loco.endurance],
        ['Horsepower', Math.round(T.yourRaw.hp), Math.round(T.raw.hp)],
        ['Top speed', Math.round(T.yourRaw.topSpeed), Math.round(T.raw.topSpeed), 'mph'],
      ])}
      <p className="small muted">Benchmark's train is the better build.</p>
      <h4 className="tape-sub">The conductor</h4>
      {rows([
        ['Strength', conductor.str ?? 0, T.crew.str],
        ['Agility', conductor.agi ?? 0, T.crew.agi],
        ['Intelligence', conductor.int ?? 0, T.crew.int],
        ['Endurance', conductor.end ?? 0, T.crew.end],
      ])}
      <p className="small muted">Your conductor is far stronger.</p>
      <h4 className="tape-sub">On the line, everything counted</h4>
      {rows([
        ['Top speed', Math.round(final.topSpeed), Math.round(theirs.topSpeed), 'mph'],
        ['Full speed after', Math.round(final.accelMiles * 10) / 10, Math.round(theirs.accelMiles * 10) / 10, 'mi', (v) => fmt(v, 1), true],
        ['Bend grip', Math.round(final.grip * 100), Math.round(theirs.grip * 100), '%'],
        ['Hull', Math.round(final.hull), Math.round(theirs.hull), 'HP'],
      ])}
      <p className="small">
        Your conductor makes you about {fmt((1 - T.ratio) * 100)}% quicker on the line. Benchmark is still stronger off the mark, and it carries a cannon: you carry {final.arms.length ? final.arms.map((a) => ARM_NAMES[a] ?? a).join(' and ') : 'nothing yet'}.
      </p>
    </div>
  );
}

export default function Setup() {
  const { conductor, screen, go, act, notify } = useGame();
  const [haulPick, setHaulPick] = useState(screen.ctx.haul ?? null);
  // The figures before the last change, so the screen can show what that change did.
  const [before, setBefore] = useState(null);
  const ctx = haulPick === null ? screen.ctx : { ...screen.ctx, haul: haulPick };
  // Worked out once per visit; it changes only if fuel is bought, the haul changes or the job disappears.
  const run = useMemo(
    () => describeRun(conductor, ctx),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conductor.fuel.gallons, conductor.activeLocoId, conductor.lt, JSON.stringify(ctx)],
  );
  // Estimates are ranges that narrow with Intelligence; the suggested load covers the top of the range.
  const band = estimateBand(conductor);
  const fuelEst = run ? estimateRange(run.plan.gallons, band, `${run.courseSeed}-fuel`) : null;
  const timeEst = run ? estimateRange(run.plan.realSeconds, band, `${run.courseSeed}-time`) : null;
  const suggested = run ? Math.min(run.stats.tank, Math.ceil(fuelEst.hi * 1.05)) : 0;
  const [fuel, setFuel] = useState(() => (run ? Math.min(run.maxLoad, suggested) : 0));

  if (!run) {
    return (
      <div className="page stack">
        <h1>That job is gone</h1>
        <p className="muted">The board has turned over since you opened it.</p>
        <button type="button" className="btn btn-brass" onClick={() => go('jobs')}>
          Back to the job board
        </button>
      </div>
    );
  }

  const { stats, plan } = run;
  const isTest = ctx.kind === 'test';
  const free = run.freeFuel;
  const load = free ? stats.tank : Math.min(fuel, run.maxLoad);
  const short = !free && load < fuelEst.hi;
  const reserveAfter = conductor.fuel.gallons - load;
  const shortfall = Math.max(0, Math.ceil(suggested - run.maxLoad));
  const pump = pumpPrice(conductor, shortfall);
  const limitReal = run.timeLimit ? run.timeLimit / B.TIME_SCALE : null;
  const willBeLate = limitReal !== null && timeEst.lo > limitReal;
  const mayBeLate = limitReal !== null && timeEst.hi > limitReal;

  function change(by) {
    snapshot();
    setFuel((current) => Math.max(0, Math.min(run.maxLoad, Math.round(Math.min(current, run.maxLoad) + by))));
  }

  function buyShortfall() {
    const report = act('buyPumpFuel', { gallons: shortfall });
    if (report) {
      notify(`Bought ${report.gallons} gallons for ${lt(report.cost)} LT.`, 'good');
      setFuel(suggested);
    }
  }

  function start() {
    if (fee && !run.job.entryPaid) {
      const paid = act('payEntry', { ctx });
      if (!paid) return;
      if (paid.fee) notify(`Entry fee paid: ${ltWhole(paid.fee)} LT.`, 'info');
    }
    const runCtx = run.job && run.ctx.kind !== 'contract' && run.ctx.kind !== 'race' ? { ...ctx, haul: run.haul } : ctx;
    go('race', { ctx: runCtx, config: buildRaceConfig(conductor, run, load), run: { title: run.title, subtitle: run.subtitle } });
  }
  const fee = run.job ? entryFee(ctx.kind, run.job) : 0;
  const owesFee = fee > 0 && !run.job.entryPaid;
  const cantPay = owesFee && conductor.lt < fee;
  const canHaul = run.job && run.ctx.kind !== 'contract' && run.ctx.kind !== 'race' && run.job.containers > 0;
  const quote = quoteLoad(stats, run.cargoLb, load);
  const snapshot = () => setBefore({ quote, gallons: plan.gallons });
  const maxHaul = canHaul ? Math.min(run.job.containers, run.owned) : 0;
  const fuelLb = load * B.LOCO.fuelLbPerGallon;
  const sharp = run.course.bends.filter((bend) => bend.kind === 'sharp').length;

  return (
    <div className="page stack" style={{ paddingBottom: 48 }}>
      <div className="page-head">
        <div className="spread">
          <span className="label">{KIND_LABEL[ctx.kind]}</span>
          {!isTest ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => (ctx.kind === 'demo' ? go('station') : go('jobs', { tab: dispatchTab(ctx.kind) }))}>
              <ArrowLeft aria-hidden="true" />
              Back
            </button>
          ) : null}
        </div>
        <h1>{run.title}</h1>
        <p>{run.subtitle}</p>
      </div>

      {isTest ? (
        <p className="note">
          Every new conductor proves their engine against the company's test locomotive. Benchmark is a better-built train than yours, but its conductor is weak; yours is not. This run walks you through the two things that decide races: holding speed through bends, and fighting with your weapons. Win or lose, the job board opens afterwards.
        </p>
      ) : null}

      <div className="cols">
        <section className="plate riveted stack">
          <div className="spread">
            <div>
              <span className="label">Your locomotive</span>
              <h2>{run.loco.name}</h2>
            </div>
            <RarityTag rarity={run.loco.rarity} />
          </div>
          <LocoArt model={run.loco.model} />
          <div className="stats">
            <Stat label="Distance" value={run.distance} unit="mi" />
            <Stat label="Terrain" value={themeOf(run.course).name} unit={run.course.water?.length ? `${fmt(run.course.water[0].end - run.course.water[0].start)} mi under water` : ''} />
            <Stat label="Bends" value={run.course.bends.length} unit={sharp ? `${sharp} sharp` : ''} />
            <Stat label="Climbs" value={(run.course.hills ?? []).filter((h) => h.grade > 0).length} unit={(run.course.hills ?? []).length ? `steepest ${fmt(Math.max(0, ...(run.course.hills ?? []).map((h) => h.grade)) * 100, 1)}%` : ''} />
            <Stat label="Cargo" value={lb(run.cargoLb)} unit="lb" />
            <Stat label="Kit" value={lb(stats.moduleWeight)} unit="lb" />
            <Stat label="Horsepower" value={fmt(stats.hp)} />
            <Stat label="Torque" value={fmt(stats.tq)} />
            {run.rivals.length && ctx.kind !== 'demo' ? <Stat label="Hull" value={fmt(stats.hull)} unit="HP" /> : null}
            <Stat label="Top speed loaded" value={fmt(plan.topMph)} unit="mph" />
            <Stat label="Takes" value={range(timeEst, minutes)} tone={willBeLate ? 'stop' : mayBeLate ? 'brass' : ''} />
            <Stat label="On the line" value={fmtSpan(plan.gameSeconds / 60)} />
            {limitReal !== null ? <Stat label="Time limit" value={minutes(limitReal)} /> : null}
            <Stat label="Needs" value={range(fuelEst)} unit="gal" tone="fuel" />
          </div>
          {run.cargoLb < run.weight ? <p className="small brass">Carrying {lb(run.weight)} lb as if it were {lb(run.cargoLb)} lb.</p> : null}
          {willBeLate ? <p className="note warn">At full lever this run is slower than the time limit. Push the lever past 100% or expect to arrive late.</p> : null}
          {!plan.oneTank ? <p className="note warn">This run needs more than one tank. You will have to call for emergency fuel on the way at {B.RACE.emergency.price} LT a gallon.</p> : null}
        </section>

        <section className="stack">
          {canHaul ? (
            <div className="plate stack">
              <div className="plate-head">
                <h3>
                  <Package aria-hidden="true" style={{ width: 18, height: 18, verticalAlign: '-3px' }} /> Containers
                </h3>
                <span className="muted small num">You own {run.owned}</span>
              </div>
              <div className="spread">
                <div className="steppers" role="group" aria-label="Containers to pull">
                  <button type="button" className="btn btn-sm" disabled={run.haul <= 1} onClick={() => { snapshot(); setHaulPick(run.haul - 1); }} aria-label="One container fewer">
                    <Minus aria-hidden="true" />
                  </button>
                  <b className="num" style={{ fontSize: '1.6rem', minWidth: 48, textAlign: 'center' }}>
                    {run.haul}
                  </b>
                  <button type="button" className="btn btn-sm" disabled={run.haul >= maxHaul} onClick={() => { snapshot(); setHaulPick(run.haul + 1); }} aria-label="One container more">
                    <Plus aria-hidden="true" />
                  </button>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="label">Pays</span>
                  <div className="num" style={{ fontSize: '1.4rem' }}>
                    {range(estimateRange(run.pay, band, `${run.job.id}-pay-${run.haul}`), ltWhole)} LT
                  </div>
                </div>
              </div>
              <p className="small muted">
                This job takes up to {run.job.containers} container{run.job.containers === 1 ? '' : 's'} of {lb(run.job.each)} lb.
                {run.owned < run.job.containers ? ` You own ${run.owned}; buy more containers at the depot to pull the full load.` : ''}
              </p>
            </div>
          ) : null}

          <div className="plate stack">
            <div className="plate-head">
              <h3>This load</h3>
              <span className="muted small num">{lb(quote.weight)} lb all in</span>
            </div>
            <ImpactPanel now={quote} before={before?.quote ?? null} distance={run.distance} gallons={{ now: plan.gallons, before: before?.gallons ?? plan.gallons, text: range(fuelEst) }} tow={stats.tow} />
            <p className="small muted">Engine, kit, cargo and fuel together. Heavier loads are slower, thirstier and wear the engine faster; the closer to the towing limit, the faster the wear.</p>
          </div>

          {run.boulders.length ? (
            <p className="note warn">
              <Mountain aria-hidden="true" style={{ width: 16, height: 16, verticalAlign: '-3px' }} /> Rockfall: {run.boulders.length} obstacle{run.boulders.length === 1 ? '' : 's'} on the line. <MixLine job={run.job} />. Shoot them before you reach them or crash through with a strong front; a crash costs HP and speed. Your lookout sees {fmt(stats.sight, 1)} mi ahead; you carry {Math.floor(stats.ammo / 3)} cannonballs{stats.arms?.some((a) => a.startsWith('launcher')) ? ', and every missile burns 2 gallons of your fuel' : ''}
              {stats.charge ? ` and ${stats.charge} charge` : ''} and a {B.FRONTS[stats.front].name}.
            </p>
          ) : null}

          {free ? (
            <div className="plate stack">
              <h3>Fuel</h3>
              <p className="muted">Test drives run on the station's fuel. Nothing is taken from your reserve and nothing is kept afterwards.</p>
            </div>
          ) : (
            <div className="plate stack">
              <div className="plate-head">
                <h3>Load fuel</h3>
                <span className="muted small num">
                  Reserve {gal(conductor.fuel.gallons)} gal at {fmt(avgFuelCost(conductor), 2)} LT
                </span>
              </div>
              <b className="fuel center" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '2.4rem', lineHeight: 1 }}>
                {fmt(load)} <span style={{ fontSize: '0.45em' }}>gal</span>
              </b>
              <div className="steppers" role="group" aria-label="Change the fuel load">
                {[-25, -5, 5, 25, 50].map((by) => (
                  <button type="button" className="btn btn-sm" key={by} onClick={() => change(by)} aria-label={`${Math.abs(by)} gallons ${by < 0 ? 'less' : 'more'}`}>
                    {by < 0 ? <Minus aria-hidden="true" /> : <Plus aria-hidden="true" />}
                    {Math.abs(by)}
                  </button>
                ))}
              </div>
              <Meter tone="fuel" value={load} max={stats.tank} label="Fuel loaded against tank size" />
              <div className="spread small muted num">
                <span>Tank {fmt(stats.tank)} gal</span>
                <span className={fuelLb > 2000 ? 'brass' : ''}>Adds {lb(fuelLb)} lb</span>
                <span>Reserve after {gal(Math.max(0, reserveAfter))} gal</span>
              </div>
              <p className="small muted">
                Fuel is heavy: {B.LOCO.fuelLbPerGallon} lb a gallon. A full tank is a slower, thirstier train, so load what the run needs. The plan assumes the lever at 100%; 110% burns about a quarter more.
              </p>
              <div className="row">
                <button type="button" className="btn btn-sm" onClick={() => { snapshot(); setFuel(Math.min(run.maxLoad, suggested)); }}>
                  Top of estimate ({fmt(Math.min(run.maxLoad, suggested))})
                </button>
                <button type="button" className="btn btn-sm" onClick={() => { snapshot(); setFuel(run.maxLoad); }}>
                  Fill
                </button>
              </div>
              {short ? (
                <p className="note warn">
                  {fmt(load)} gallons may not cover this run: your estimate is {range(fuelEst)} gallons. Less fuel is a lighter, faster train, but an empty tank stops you.
                </p>
              ) : null}
              {shortfall > 0 ? (
                <div className="note stack-sm">
                  <span>
                    Your reserve is {fmt(shortfall)} gallons short of the plan. The trackside pump sells at {fmt(pump, 2)} LT a gallon.
                  </span>
                  <button type="button" className="btn btn-brass btn-sm" onClick={buyShortfall}>
                    <Fuel aria-hidden="true" />
                    Buy {fmt(shortfall)} gal for {lt(Math.ceil(shortfall * pump * 10) / 10)} LT
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {isTest && run.tutorial ? <TaleOfTheTape conductor={conductor} run={run} /> : null}

          {run.rivals.length && !isTest ? (
            <div className="plate stack">
              <div className="plate-head">
                <h3>{run.rivals.length === 1 ? 'Your rival' : `${run.rivals.length} rivals`}</h3>
                {hasTrait(conductor, 'competitive') ? <span className="tag tag-solid">Competitive ready</span> : null}
              </div>
              {ctx.kind !== 'demo' ? (
                <p className="small muted">
                  Weapons are in play. Your {stats.arms.length ? stats.arms.join(', ') : 'locomotive has nothing fitted; visit the Armory'}. Rivals fight each other too. A train at 0 HP leaves the rails.
                </p>
              ) : null}
              {run.rivals.map((rival) => (
                <div className="spread" key={rival.id}>
                  <div className="grow">
                    <b>{rival.name}</b>
                    <div className="muted small">{rival.locoName}</div>
                  </div>
                  <span className="muted small num" style={{ textAlign: 'right' }}>
                    {fmt(rival.stats.hp)} hp, {fmt(rival.stats.tq)} tq
                    <br />
                    {lb(rival.stats.weight)} lb{ctx.kind !== 'demo' ? `, ${fmt(rival.stats.hull)} HP` : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {run.blocked ? <p className="note warn">{run.blocked}</p> : null}
          {fee > 0 ? (
            <p className={`note small ${cantPay ? 'warn' : ''}`}>
              {run.job.entryPaid
                ? `Entry fee already paid (${ltWhole(run.job.entryPaid)} LT). Running it again is free.`
                : cantPay
                  ? `Entry fee: ${ltWhole(fee)} LT. You have ${ltWhole(conductor.lt)} LT.`
                  : ctx.kind === 'race'
                    ? `Entry fee: ${ltWhole(fee)} LT, paid at the start line and not refunded. 1st pays ${ltWhole(run.job.purse[0])}, 2nd ${ltWhole(run.job.purse[1])}, 3rd ${ltWhole(run.job.purse[2])}.`
                    : `Entry fee: ${ltWhole(fee)} LT (${B.JOBS.contract.entryPerContract} LT for each of the ${run.job.award} contracts on offer), paid at the start line and not refunded.`}
            </p>
          ) : null}
          <button type="button" className="btn btn-ember btn-lg btn-block" disabled={!!run.blocked || (!free && load <= 0) || cantPay} onClick={start}>
            <Flag aria-hidden="true" />
            {!free && load <= 0 ? 'Load some fuel first' : cantPay ? 'Not enough LT for the entry fee' : owesFee ? `Pay ${ltWhole(fee)} LT and go to the start line` : 'Go to the start line'}
          </button>
        </section>
      </div>
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import { Award, Clock, FileSignature, Flag, Lock, Mountain, Package, PartyPopper, Trophy, Truck } from 'lucide-react';
import { B } from '../game/balance.js';
import { useGame } from '../state/store.jsx';
import { activeLoco, avgFuelCost } from '../game/conductor.js';
import { cargoFits, deriveStats } from '../game/locomotives.js';
import { COMPANIES, companyById, companyRecord, jobPay, jobXp, nextStarAt, obstacleMix, sortByDistance, starsFor } from '../game/jobs.js';
import { makeCourse, themeFor } from '../game/course.js';
import { depotPrice } from '../game/economy.js';
import { planTrip } from '../game/race.js';
import { hasTrait } from '../game/traits.js';
import { Meter, Stars, Stat } from '../ui/bits.jsx';
import { fmt, lb, ltWhole, minutes, range } from '../ui/format.js';
import { estimateBand, estimateRange } from '../game/estimate.js';
import { festivalInfo, fmtSpan } from '../game/calendar.js';

const TABS = [
  { id: 'deliveries', label: 'Deliveries', icon: Truck },
  { id: 'contracts', label: 'Contracts', icon: FileSignature },
  { id: 'races', label: 'Races', icon: Trophy },
  { id: 'reputation', label: 'Reputation', icon: Award },
];

// How many containers you would pull today: as many as you own, up to what the job offers.
const haulFor = (job, owned) => (job.type === 'contract' ? job.containers : job.containers === 0 ? 0 : Math.max(1, Math.min(job.containers, owned)));
const loadFor = (job, owned) => (job.type === 'contract' ? job.weight : haulFor(job, owned) * (job.each ?? 0));

function usePlans(jobs, stats, owned) {
  return useMemo(() => {
    const plans = {};
    for (const job of jobs) plans[job.id] = planTrip(stats, loadFor(job, owned) * stats.cargoFactor, job.distance, makeCourse(job.id, job.distance, job.theme));
    return plans;
    // The plan only changes when the jobs or the locomotive's numbers do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs.map((job) => job.id).join(','), stats.hp, stats.tq, stats.weight, stats.tmpg, stats.tank, stats.cargoFactor, owned]);
}

function Load({ job, stats, owned }) {
  if (job.type === 'contract') {
    const fits = cargoFits(stats, job.weight);
    return (
      <span className={fits ? '' : 'stop'}>
        <Package aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> {lb(job.weight)} lb of company freight, cars supplied
      </span>
    );
  }
  if (job.containers === 0) return <span>Mail sacks, no containers needed</span>;
  const haul = haulFor(job, owned);
  const fits = cargoFits(stats, haul * job.each);
  return (
    <span className={fits ? '' : 'stop'}>
      <Package aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> Up to {job.containers} container{job.containers === 1 ? '' : 's'} of {lb(job.each)} lb. You pull {haul}.
    </span>
  );
}

function Hazard({ job }) {
  if (!job.hazard || !job.boulders?.length) return null;
  return (
    <span className="stamp warn" title="Obstacles on the line: shoot them, or crash through with a strong front">
      <Mountain aria-hidden="true" style={{ width: 13, height: 13, verticalAlign: '-2px' }} /> Rockfall ×{job.boulders.length}
    </span>
  );
}

const MIX_NAME = { debris: 'debris', boulder: 'boulder', large: 'large', giant: 'GIANT' };
// The terrain a job runs through: plains, flooded, desert or a frozen pass.
const TERRAIN_TONE = { plains: '', flooded: 'water', desert: 'sand', snow: 'ice' };
export function Terrain({ id, theme }) {
  const t = theme ?? themeFor(id);
  const info = B.TRACK.themes[t];
  return (
    <span className={`terrain-chip ${TERRAIN_TONE[t]}`} title={info.text}>
      {info.name}
    </span>
  );
}

export function MixLine({ job }) {
  const mix = obstacleMix(job);
  const parts = ['giant', 'large', 'boulder', 'debris'].filter((s) => mix[s]).map((s) => `${mix[s]} ${MIX_NAME[s]}`);
  if (!parts.length) return null;
  return <span className="small brass">On the line: {parts.join(', ')}</span>;
}

function Pays({ job, owned, band }) {
  const haul = haulFor(job, owned);
  const now = jobPay(job, haul);
  const best = jobPay(job, job.containers);
  return (
    <div>
      <span className="label">Pays</span>
      <div>
        <b className="num" style={{ fontSize: '1.5rem' }}>
          {range(estimateRange(now, band, `${job.id}-pay-${haul}`), ltWhole)} LT
        </b>
      </div>
      {job.containers === 0 ? null : best > now ? (
        <span className="small muted">
          with {haul} container{haul === 1 ? '' : 's'}; up to {range(estimateRange(best, band, `${job.id}-best`), ltWhole)} LT with {job.containers}
        </span>
      ) : (
        <span className="small go">Full load: {haul} container{haul === 1 ? '' : 's'}</span>
      )}
      {job.hazard ? <div className="small brass">+{Math.round(job.hazard * B.HAZARD.payPerLevel * 100)}% for the rockfall</div> : null}
    </div>
  );
}

// Every figure here is an estimate: a range that narrows with Intelligence.
function TripFigures({ job, plan, fuelPrice, pay, band }) {
  const time = estimateRange(plan.realSeconds, band, `${job.id}-time`);
  const fuel = estimateRange(plan.gallons, band, `${job.id}-fuel`);
  const net = pay !== null ? estimateRange(pay - plan.gallons * fuelPrice, band, `${job.id}-net`) : null;
  const limit = job.timeLimit ? job.timeLimit / B.TIME_SCALE : null;
  const late = limit !== null && time.lo > limit ? 'stop' : limit !== null && time.hi > limit ? 'brass' : '';
  return (
    <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))' }}>
      <Stat label="Takes" value={range(time, minutes)} tone={late} />
      {limit !== null ? <Stat label="Time limit" value={minutes(limit)} /> : null}
      <Stat label="On the line" value={fmtSpan(plan.gameSeconds / 60)} />
      <Stat label="Fuel" value={`${range(fuel)}${plan.oneTank ? '' : '+'}`} unit="gal" />
      {net ? <Stat label="After fuel" value={range(net, ltWhole)} unit="LT" tone={net.hi < 0 ? 'stop' : net.lo >= 0 ? 'go' : ''} /> : null}
    </div>
  );
}

export default function Jobs() {
  const { conductor, screen, go } = useGame();
  const loco = activeLoco(conductor);
  const stats = deriveStats(loco, conductor);
  const board = conductor.board;
  const simple = sortByDistance(board.simple);
  const contracts = sortByDistance(board.contracts);
  const companyJobs = Object.entries(board.company).filter(([id, jobs]) => jobs.length && companyRecord(conductor, id).contracts > 0);
  const allJobs = [...simple, ...contracts, ...(board.races ?? []), ...companyJobs.flatMap(([, jobs]) => jobs)];
  const owned = conductor.containers ?? 0;
  const band = estimateBand(conductor);
  const plans = usePlans(allJobs, stats, owned);
  const fuelPrice = avgFuelCost(conductor) || depotPrice(conductor);
  const races = sortByDistance(board.races ?? []);
  const fest = festivalInfo(conductor.clock ?? 0);
  const known = COMPANIES.filter((company) => conductor.companies[company.id] || board.contracts.some((c) => c.companyId === company.id) || (board.races ?? []).some((r) => r.companyId === company.id))
    .map((company) => ({ company, record: companyRecord(conductor, company.id) }))
    .sort((a, b) => b.record.rep - a.record.rep || a.company.name.localeCompare(b.company.name));
  const [tab, setTab] = useState(screen.tab ?? 'deliveries');
  const [main, subPick] = tab.split(':');
  const sub = subPick ?? (companyJobs.length ? 'open' : 'compete');
  const counts = { deliveries: simple.length, contracts: contracts.length + companyJobs.reduce((n, [, jobs]) => n + jobs.length, 0), races: races.length, reputation: known.length };
  const daysToTurn = B.WEEK.days - (Math.floor((conductor.clock ?? 0) / 1440) % B.WEEK.days);

  const perks = [];
  if (hasTrait(conductor, 'business')) perks.push('Business: deliveries pay 5 to 15% more');
  if (hasTrait(conductor, 'leader')) perks.push('Leader: +15% experience');
  if (hasTrait(conductor, 'competitive')) perks.push('Competitive: power boost in close races');
  if (hasTrait(conductor, 'negotiator')) perks.push('Negotiator: can win contracts from 2nd or 3rd');
  if (hasTrait(conductor, 'elevate')) perks.push('Elevate: cargo weighs 15% less');
  if (hasTrait(conductor, 'diplomat')) perks.push('Diplomat: +25% reputation');
  perks.push(`${owned} container${owned === 1 ? '' : 's'} owned: jobs pay for every container you pull. Buy more at the depot.`);

  return (
    <div className="stack">
      <div className="page-head">
        <h1>
          Dispatch <span className="hl-orange">Center</span>
        </h1>
        <p>
          Hauling with {loco.name}: tows up to {lb(stats.tow)} lb. Estimates use your reserve's average fuel cost of {fmt(fuelPrice, 2)} LT a gallon. New postings in {daysToTurn} day{daysToTurn === 1 ? '' : 's'}. Your estimates are good to ±{Math.round(band * 100)}% (Intelligence {conductor.int}).
        </p>
        {perks.length ? (
          <div className="row" style={{ gap: 6, marginTop: 6 }}>
            {perks.map((perk) => (
              <span className="tag tag-uncommon" key={perk} style={{ textTransform: 'none', letterSpacing: 0, fontSize: '0.9rem', whiteSpace: 'normal' }}>
                {perk}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="tabs" role="tablist" aria-label="Dispatch boards">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={main === t.id} className="tab" onClick={() => setTab(t.id === 'contracts' ? `contracts:${sub}` : t.id)}>
            <t.icon aria-hidden="true" />
            {t.label}
            {counts[t.id] !== undefined ? <span className="tab-count">{counts[t.id]}</span> : null}
          </button>
        ))}
      </div>

      {main === 'deliveries' ? (
        <section className="stack" role="tabpanel">
          <p className="muted">Haul freight on the open board. Paid per container you pull; get it there inside the time limit.</p>
          <div className="grid">
            {simple.map((job) => {
              const fits = job.containers === 0 || cargoFits(stats, job.each);
              const pay = jobPay(job, haulFor(job, owned));
              return (
                <article className={`paper waybill stack-sm ${fits ? '' : 'locked'}`} key={job.id}>
                  <div className="spread">
                    <h3>{job.title}</h3>
                    <span className="row" style={{ gap: 6 }}>
                      <Hazard job={job} />
                      {job.speedBonus ? <span className="stamp good">Early bonus</span> : null}
                    </span>
                  </div>
                  <span className="muted">
                    {job.from} to {job.to}, <b>{job.distance} miles</b> · <Terrain id={job.id} distance={job.distance} theme={job.theme} />
                  </span>
                  <Load job={job} stats={stats} owned={owned} />
                  <MixLine job={job} />
                  <hr className="rule" />
                  <div className="spread">
                    <Pays job={job} owned={owned} band={band} />
                    <div style={{ textAlign: 'right' }}>
                      <span className="label">Experience</span>
                      <div>
                        <b className="num" style={{ fontSize: '1.5rem' }}>
                          {fmt(jobXp(job, haulFor(job, owned)))}
                        </b>
                      </div>
                      {job.xpBonusPct > 0 ? <span className="small go">+{job.xpBonusPct}% for low pay</span> : null}
                    </div>
                  </div>
                  <TripFigures job={job} plan={plans[job.id]} fuelPrice={fuelPrice} pay={pay} band={band} />
                  {fits ? (
                    <button type="button" className="btn btn-brass btn-block" onClick={() => go('setup', { ctx: { kind: 'delivery', jobId: job.id } })}>
                      Take this job
                    </button>
                  ) : (
                    <p className="note warn small">
                      <Lock aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> Too heavy for {loco.name}.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {main === 'contracts' ? (
        <section className="stack" role="tabpanel">
          <div className="tabs tabs-sub" role="tablist" aria-label="Contracts">
            <button type="button" role="tab" aria-selected={sub === 'open'} className="tab" onClick={() => setTab('contracts:open')}>
              Open contracts <span className="tab-count">{companyJobs.reduce((n, [, jobs]) => n + jobs.length, 0)}</span>
            </button>
            <button type="button" role="tab" aria-selected={sub === 'compete'} className="tab" onClick={() => setTab('contracts:compete')}>
              Compete for contracts <span className="tab-count">{contracts.length}</span>
            </button>
          </div>

          {sub === 'open' ? (
            companyJobs.length ? (
              <>
                <p className="muted">Better-paid work from companies you hold contracts with. Each job spends contracts.</p>
                {companyJobs.map(([companyId, jobs]) => {
                  const record = companyRecord(conductor, companyId);
                  return (
                    <div className="stack-sm" key={companyId}>
                      <div className="spread">
                        <h3>{companyById(companyId).name}</h3>
                        <span className="row" style={{ gap: 8 }}>
                          <Stars count={starsFor(record.rep)} />
                          <span className="chip">
                            {record.contracts} contract{record.contracts === 1 ? '' : 's'}
                          </span>
                        </span>
                      </div>
                      <div className="grid">
                        {sortByDistance(jobs).map((job) => {
                          const fits = cargoFits(stats, job.each);
                          const pay = jobPay(job, haulFor(job, owned));
                          const afford = record.contracts >= job.cost;
                          return (
                            <article className={`paper waybill stack-sm ${fits && afford ? '' : 'locked'}`} key={job.id}>
                              <div className="spread">
                                <h3>{job.cargo}</h3>
                                <span className="row" style={{ gap: 6 }}>
                                  <Hazard job={job} />
                                  {job.speedBonus ? <span className="stamp good">Early bonus</span> : null}
                                </span>
                              </div>
                              <span className="muted">
                                {job.from} to {job.to}, <b>{job.distance} miles</b> · <Terrain id={job.id} distance={job.distance} theme={job.theme} />
                              </span>
                              <Load job={job} stats={stats} owned={owned} />
                              <MixLine job={job} />
                              <hr className="rule" />
                              <div className="spread">
                                <Pays job={job} owned={owned} band={band} />
                                <div style={{ textAlign: 'right' }}>
                                  <span className="label">Experience</span>
                                  <div>
                                    <b className="num" style={{ fontSize: '1.5rem' }}>
                                      {fmt(jobXp(job, haulFor(job, owned)))}
                                    </b>
                                  </div>
                                </div>
                              </div>
                              <TripFigures job={job} plan={plans[job.id]} fuelPrice={fuelPrice} pay={pay} band={band} />
                              {fits && afford ? (
                                <button type="button" className="btn btn-brass btn-block" onClick={() => go('setup', { ctx: { kind: 'company', companyId, jobId: job.id } })}>
                                  Take it for {job.cost} contract{job.cost === 1 ? '' : 's'}
                                </button>
                              ) : (
                                <p className="note warn small">
                                  <Lock aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> {fits ? `Needs ${job.cost} contracts.` : `Too heavy for ${loco.name}.`}
                                </p>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="plate stack-sm">
                <h3>No contracts held yet</h3>
                <p className="muted">Win a race under Compete for contracts and that company's better-paid jobs open up here.</p>
                <button type="button" className="btn btn-ember" onClick={() => setTab('contracts:compete')}>
                  <Flag aria-hidden="true" />
                  Compete for contracts
                </button>
              </div>
            )
          ) : (
            <>
              <p className="muted">Race the other bidders. First home wins the company's contracts, which you spend on its jobs under Open contracts.</p>
              <div className="grid">
                {contracts.map((contract) => {
                  const fits = cargoFits(stats, contract.weight);
                  const company = companyById(contract.companyId);
                  const record = companyRecord(conductor, contract.companyId);
                  const plan = plans[contract.id];
                  return (
                    <article className={`plate riveted stack-sm ${fits ? '' : 'locked'}`} key={contract.id}>
                      <div className="spread">
                        <div>
                          <span className="label">{company.specialty}</span>
                          <h3>{company.name}</h3>
                        </div>
                        <Stars count={starsFor(record.rep)} />
                      </div>
                      <span className="muted">
                        {contract.cargo}, {contract.from} to {contract.to}
                      </span>
                      <div className="stats">
                        <Stat label="Distance" value={contract.distance} unit="mi" />
                        <Stat label="Rivals" value={contract.rivals.length} />
                        <Stat label="Prize" value={contract.award} unit="contracts" tone="brass" />
                        <Stat label="Takes" value={range(estimateRange(plan.realSeconds, band, `${contract.id}-time`), minutes)} />
                      </div>
                      <Load job={contract} stats={stats} owned={owned} />
                      {fits ? (
                        <button type="button" className="btn btn-ember btn-block" onClick={() => go('setup', { ctx: { kind: 'contract', contractId: contract.id } })}>
                          <Flag aria-hidden="true" />
                          Race for it
                        </button>
                      ) : (
                        <p className="note warn small">
                          <Lock aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> Too heavy for {loco.name}.
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>
      ) : null}

      {main === 'races' ? (
        <section className="stack" role="tabpanel">
          <p className="muted">Prize races: no freight, a field of rivals, and a purse for the top three. Free to enter; you pay for fuel and rounds. Each runs once a week, and the sponsor remembers a good finish.</p>
          <article className={`plate stack-sm ${fest.active ? 'festival-on' : ''}`}>
            <div className="spread">
              <h3>
                <PartyPopper aria-hidden="true" style={{ width: 17, height: 17, verticalAlign: '-3px' }} /> Locomotive Festival
              </h3>
              <span className="chip">{fest.active ? 'Open now' : `in ${fmtSpan(fest.nextAt - conductor.clock)}`}</span>
            </div>
            <span className="muted small">Max Pull, Speed Race and the Damage Wall, every three months. Medals pay LT, experience and weapons.</span>
            {fest.active ? (
              <button type="button" className="btn btn-ember" onClick={() => go('festival')}>
                Go to the fairground
              </button>
            ) : null}
          </article>
          {races.length ? (
            <div className="grid">
              {races.map((race) => {
                const company = companyById(race.companyId);
                const plan = plans[race.id];
                return (
                  <article className="plate riveted stack-sm" key={race.id}>
                    <div className="spread">
                      <div>
                        <span className="label">Sponsored by {company.name}</span>
                        <h3>{race.title}</h3>
                      </div>
                      <Flag aria-hidden="true" style={{ width: 18, height: 18, color: 'var(--orange)' }} />
                    </div>
                    <div className="stats">
                      <Stat label="Distance" value={race.distance} unit="mi" />
                      <Stat label="Rivals" value={race.rivals.length} />
                      <Stat label="Takes" value={range(estimateRange(plan.realSeconds, band, `${race.id}-time`), minutes)} />
                    </div>
                    <div className="purse">
                      {race.purse.map((amount, i) => (
                        <span key={i} className={`purse-${i + 1}`}>
                          <span className="label">{['1st', '2nd', '3rd'][i]}</span>
                          <b className="num">{ltWhole(amount)}</b> LT
                        </span>
                      ))}
                    </div>
                    <button type="button" className="btn btn-ember btn-block" onClick={() => go('setup', { ctx: { kind: 'race', raceId: race.id } })}>
                      <Flag aria-hidden="true" />
                      Enter the race
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="note small">All of this week's prize races are run. New ones post in {daysToTurn} day{daysToTurn === 1 ? '' : 's'}.</p>
          )}
        </section>
      ) : null}

      {main === 'reputation' ? (
        <section className="stack" role="tabpanel">
          <p className="muted">
            Every company you have raced for or hauled for. Reputation earns stars, and each star adds {Math.round(B.JOBS.reputation.payPerStar * 100)}% to that company's contract jobs. Win contract races (+{B.JOBS.reputation.contractWin}), run their jobs (+{B.JOBS.reputation.companyJob}) or podium their prize races to build it.
          </p>
          {known.length ? (
            <div className="grid">
              {known.map(({ company, record }) => {
                const stars = starsFor(record.rep);
                const next = nextStarAt(record.rep);
                const prev = stars ? B.JOBS.reputation.stars[stars - 1] : 0;
                return (
                  <article className="plate stack-sm" key={company.id}>
                    <div className="spread">
                      <div>
                        <span className="label">{company.specialty}</span>
                        <h3>{company.name}</h3>
                      </div>
                      <Stars count={stars} />
                    </div>
                    <div className="spread small">
                      <span className="num">{fmt(record.rep)} reputation</span>
                      <span className="muted">{next === null ? 'Top standing' : `${fmt(next - record.rep)} to the next star`}</span>
                    </div>
                    <Meter value={next === null ? 1 : record.rep - prev} max={next === null ? 1 : next - prev} tone="go" label={`${company.name} reputation`} />
                    <div className="stats" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                      <Stat label="Contracts" value={record.contracts ?? 0} tone="brass" />
                      <Stat label="Races won" value={record.wins ?? 0} />
                      <Stat label="Jobs run" value={record.jobs ?? 0} />
                      <Stat label="Pay bonus" value={`+${Math.round(stars * B.JOBS.reputation.payPerStar * 100)}`} unit="%" />
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="note small">You have not worked with any company yet. Compete for a contract or enter a sponsored prize race to get known.</p>
          )}
          {COMPANIES.length > known.length ? (
            <p className="dim small">
              {COMPANIES.length - known.length} more compan{COMPANIES.length - known.length === 1 ? 'y' : 'ies'} on the line you have not met yet.
            </p>
          ) : null}
        </section>
      ) : null}

      <p className="dim small">
        <Clock aria-hidden="true" style={{ width: 13, height: 13, verticalAlign: '-2px' }} /> Times are real minutes at full lever. One real second is {B.TIME_SCALE} seconds on the line.{' '}
        <Trophy aria-hidden="true" style={{ width: 13, height: 13, verticalAlign: '-2px' }} /> Deliveries allow {B.JOBS.limitSecondsPerMile / 60} simulated minutes per mile.
      </p>
    </div>
  );
}

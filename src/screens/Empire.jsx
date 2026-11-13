import React, { useMemo, useState } from 'react';
import { ArrowUpCircle, Building2, Coins, Crown, Lock, MapPin, Skull, TrainFront, Undo2, Warehouse } from 'lucide-react';
import { B } from '../game/balance.js';
import { useGame } from '../state/store.jsx';
import { CITIES, LINES, lineById, lineOpen } from '../game/routemap.js';
import { MODELS } from '../game/locomotives.js';
import {
  charterPrice,
  cityOpen,
  empireIncome,
  empireRank,
  empireRating,
  garageSlots,
  linesAt,
  openCities,
  operatedLines,
  operates,
  routeOfLoco,
  routeOnLine,
  routeQuote,
  terminalLevel,
  terminalPrice,
  terminalUpgradePrice,
  tillCap,
} from '../game/empire.js';
import { BOSS_IDS, bossAtLarge } from '../game/bosses.js';
import { hasTrait } from '../game/traits.js';
import { Meter, RarityTag, Stat, useCooldown } from '../ui/bits.jsx';
import CountUp from '../ui/CountUp.jsx';
import { H, OUTLINE_D, TERRAIN, W, labelAt, pt } from '../ui/mapgeo.js';
import { fmt, ltWhole } from '../ui/format.js';

// The Empire: the railway company, its terminals, the locomotives working its routes, and its rank.

const otherEnd = (line, cityId) => (line.a === cityId ? line.b : line.a);
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function RankBadge({ rank, size = 54 }) {
  return (
    <span className={`rank-badge rank-${rank.index}`} style={{ width: size, height: size }} aria-label={rank.name}>
      <Crown aria-hidden="true" style={{ width: size * 0.46, height: size * 0.46 }} />
      <b>{rank.index + 1}</b>
    </span>
  );
}

// The network: every line and city, the terminals the company holds and the trains at work.
function EmpireMap({ conductor, sel, onPick }) {
  const still = reduced();
  const raided = new Set(BOSS_IDS.filter((id) => bossAtLarge(conductor, id)).map((id) => B.BOSSES[id].line));
  return (
    <div className="rmap-scroll">
      <svg className="rmap emap" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Your rail network across the United States">
        <defs>
          <radialGradient id="emap-sea" cx="50%" cy="45%" r="75%">
            <stop offset="0%" stopColor="#0f1e30" />
            <stop offset="100%" stopColor="#05090f" />
          </radialGradient>
          <filter id="emap-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width={W} height={H} fill="url(#emap-sea)" />
        <path d={OUTLINE_D} fill="#142233" stroke="#2c4660" strokeWidth="2" />
        {LINES.map((line) => {
          const [ax, ay] = pt(line.a);
          const [bx, by] = pt(line.b);
          const open = lineOpen(conductor, line);
          const mine = operates(conductor, line);
          const route = routeOnLine(conductor, line.id);
          return (
            <g key={line.id}>
              {mine ? <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#ffcf5a" strokeWidth="8" opacity="0.3" filter="url(#emap-glow)" /> : null}
              <line x1={ax} y1={ay} x2={bx} y2={by} stroke={mine ? '#ffcf5a' : open ? TERRAIN[line.terrain].color : '#4b5a6c'} strokeWidth={mine ? 4 : 2.5} strokeDasharray={open ? '' : '7 6'} strokeLinecap="round" opacity={mine ? 1 : open ? 0.45 : 0.55} />
              {raided.has(line.id) && open ? (
                <g transform={`translate(${(ax + bx) / 2} ${(ay + by) / 2})`}>
                  <circle r="9" fill="#2a0a08" stroke="#ff5f5f" strokeWidth="1.5" />
                  <path d="M-4 -1 a4 4 0 0 1 8 0 v2 h-1.5 v2 h-5 v-2 h-1.5 z" fill="#ff8a7a" />
                </g>
              ) : null}
              {route ? (
                <circle r="6" fill="#fff" stroke="#ff9d1c" strokeWidth="3">
                  {still ? null : <animateMotion dur={`${Math.max(5, line.miles / 45)}s`} repeatCount="indefinite" path={`M ${ax} ${ay} L ${bx} ${by} L ${ax} ${ay}`} />}
                  {still ? <set attributeName="cx" to={(ax + bx) / 2} /> : null}
                  {still ? <set attributeName="cy" to={(ay + by) / 2} /> : null}
                </circle>
              ) : null}
            </g>
          );
        })}
        {Object.entries(CITIES).map(([id, city]) => {
          const [x, y] = pt(id);
          const [dx, dy, anchor] = labelAt(id, x);
          const level = terminalLevel(conductor, id);
          const open = cityOpen(conductor, id);
          const picked = sel === id;
          return (
            <g key={id} className={`rmap-city emap-city ${open ? 'open' : 'shut'} ${picked ? 'sel' : ''}`} onClick={() => onPick(id)} role="button" aria-label={`${city.name}${level ? `, your terminal, level ${level}` : open ? ', no terminal yet' : ', beyond your licence'}`}>
              <circle cx={x} cy={y} r="16" fill="transparent" />
              {picked ? <circle cx={x} cy={y} r="14" fill="none" stroke="#19c3e6" strokeWidth="2" /> : null}
              {level > 0 ? (
                <>
                  <rect x={x - 8} y={y - 8} width="16" height="16" rx="3" fill="#ffcf5a" stroke="#05090f" strokeWidth="2" filter="url(#emap-glow)" />
                  {id === conductor.empire?.hq ? <path d={`M${x - 5} ${y + 3} l2 -7 l3 4 l3 -4 l2 7 z`} fill="#05090f" /> : <text x={x} y={y + 4} textAnchor="middle" className="emap-level">{level}</text>}
                </>
              ) : (
                <circle cx={x} cy={y} r={open ? 5 : 4} fill={open ? '#e9f4ff' : '#5b6b7e'} stroke="#05090f" strokeWidth="2" />
              )}
              <text x={x + dx} y={y + dy} textAnchor={anchor}>
                {city.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function CityPanel({ conductor, cityId, act, notify, cooling, cool }) {
  const city = CITIES[cityId];
  const level = terminalLevel(conductor, cityId);
  const open = cityOpen(conductor, cityId);
  const lines = linesAt(cityId);
  const price = terminalPrice(cityId);
  const upgrade = terminalUpgradePrice(conductor, cityId);
  // Lines that would be worked from here: the other end already has a terminal.
  const joins = lines.filter((line) => lineOpen(conductor, line) && terminalLevel(conductor, otherEnd(line, cityId)) > 0);
  return (
    <section className="plate stack-sm emap-panel" aria-label={city.name}>
      <div className="spread">
        <h3 className="rmap-h3">
          <MapPin aria-hidden="true" /> {city.name}
        </h3>
        {level > 0 ? <span className="chip">{cityId === conductor.empire?.hq ? 'Headquarters · ' : ''}Terminal level {level}</span> : null}
      </div>
      <span className="small muted">
        {lines.length} line{lines.length === 1 ? '' : 's'} meet here: {lines.map((line) => `${CITIES[otherEnd(line, cityId)].name} (${fmt(line.miles)} mi${lineOpen(conductor, line) ? '' : ', locked'})`).join(', ')}.
      </span>
      {!open ? (
        <p className="note warn small">
          <Lock aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> Beyond your licence. Drive more miles to open the lines that reach {city.name}.
        </p>
      ) : level > 0 ? (
        <>
          <span className="small">
            {joins.length ? `Works with your terminals in ${joins.map((line) => CITIES[otherEnd(line, cityId)].name).join(', ')}.` : 'No line from here reaches another of your terminals yet.'}
            {level > 1 ? ` Routes through here bring in ${Math.round(B.EMPIRE.terminal.boost * (level - 1) * 100)}% more.` : ''}
          </span>
          {upgrade !== null ? (
            <button
              type="button"
              className="btn btn-brass"
              disabled={cooling || conductor.lt < upgrade}
              onClick={() => {
                const report = act('upgradeTerminal', { city: cityId });
                cool();
                if (report) notify(`${city.name} terminal is now level ${report.level}.`, 'good');
              }}
            >
              <ArrowUpCircle aria-hidden="true" />
              Level {level + 1} for {ltWhole(upgrade)} LT: +{Math.round(B.EMPIRE.terminal.boost * 100)}% on its routes
            </button>
          ) : (
            <span className="small go">As big as a terminal gets.</span>
          )}
        </>
      ) : (
        <>
          <span className="small">
            {joins.length ? `A terminal here opens ${joins.length} route${joins.length === 1 ? '' : 's'}: ${joins.map((line) => line.name).join(', ')}.` : 'A terminal here does not connect to your network yet: build towards it.'} It also adds a garage bay.
          </span>
          <button
            type="button"
            className="btn btn-ember"
            disabled={cooling || conductor.lt < price}
            onClick={() => {
              const report = act('buyTerminal', { city: cityId });
              cool();
              if (report) notify(`Terminal opened in ${city.name}.`, 'good');
            }}
          >
            <Warehouse aria-hidden="true" />
            Open a terminal for {ltWhole(price)} LT
          </button>
        </>
      )}
    </section>
  );
}

function Founding({ conductor, act, notify }) {
  const cities = openCities(conductor).sort((a, b) => linesAt(b).length - linesAt(a).length || CITIES[a].name.localeCompare(CITIES[b].name));
  const surname = String(conductor.name).trim().split(/\s+/).pop();
  const [name, setName] = useState(`${surname} Rail Co.`);
  const [hq, setHq] = useState(cities[0]);
  const price = charterPrice(conductor);
  const discount = price < B.EMPIRE.charter;
  return (
    <section className="plate riveted stack found">
      <div>
        <span className="label">Found your railway company</span>
        <h2>One engine is a job. A company is an empire.</h2>
      </div>
      <p className="muted">
        Take out a charter and you can open terminals in the cities your licence reaches, and put the locomotives in your garage to work hauling freight between them. They earn around the clock: while you race, while you rest, while you are away from the game.
      </p>
      <div className="found-grid">
        <label className="stack-sm">
          <span className="label">Company name</span>
          <input className="field" value={name} maxLength={32} onChange={(event) => setName(event.target.value)} aria-label="Company name" />
        </label>
        <div className="stack-sm">
          <span className="label">Headquarters (its terminal comes with the charter)</span>
          <div className="row" style={{ gap: 6 }}>
            {cities.map((id) => (
              <button type="button" key={id} className={`chip chip-pick ${hq === id ? 'on' : ''}`} onClick={() => setHq(id)} aria-pressed={hq === id}>
                {CITIES[id].name} <small>{linesAt(id).length} lines</small>
              </button>
            ))}
          </div>
          <span className="small muted">Pick a city where many lines meet: every line from it can become a route once you open a terminal at its other end.</span>
        </div>
      </div>
      <div className="spread">
        <span>
          <span className="label">Charter</span>
          <b className="num" style={{ fontSize: '1.6rem', display: 'block' }}>
            {ltWhole(price)} LT
          </b>
          {discount ? <span className="small go">{hasTrait(conductor, 'leader') ? 'Leader' : 'Business'}: 75% off the usual {ltWhole(B.EMPIRE.charter)} LT</span> : <span className="small muted">Leaders and conductors with a head for Business pay a quarter of this.</span>}
        </span>
        <button
          type="button"
          className="btn btn-ember btn-lg"
          disabled={conductor.lt < price || name.trim().length < 3}
          onClick={() => {
            const report = act('foundCompany', { name, hq });
            if (report) notify(`${report.name} is founded. Headquarters: ${CITIES[report.hq].name}.`, 'good');
          }}
        >
          <Building2 aria-hidden="true" />
          {conductor.lt < price ? `You need ${ltWhole(price)} LT` : 'Found the company'}
        </button>
      </div>
    </section>
  );
}

function RatingCard({ conductor }) {
  const rating = empireRating(conductor);
  const rank = empireRank(conductor);
  const from = rank.rating;
  return (
    <section className="plate stack-sm">
      <div className="empire-rank">
        <RankBadge rank={rank} />
        <div className="grow">
          <span className="label">Empire power rating</span>
          <div className="empire-rating">
            <CountUp value={rating.total} format={(v) => Math.round(v).toLocaleString()} />
          </div>
          <span className="small">
            <b>{rank.name}</b>
            {rank.income ? ` · every route brings in ${Math.round(rank.income * 100)}% more` : ''}
          </span>
        </div>
      </div>
      {rank.next ? (
        <>
          <Meter value={from - B.EMPIRE.ranks[rank.index].rating} max={rank.next.rating - B.EMPIRE.ranks[rank.index].rating} tone="ember" label={`Progress to ${rank.next.name}`} />
          <span className="small muted">
            {fmt(rank.next.rating - from)} to <b>{rank.next.name}</b>: +{Math.round(rank.next.income * 100)}% on every route.
          </span>
        </>
      ) : (
        <span className="small go">The top of the ladder. There is no one above an Iron Emperor.</span>
      )}
      <div className="rating-parts">
        {rating.parts.map((part) => (
          <span key={part.id} className={part.value ? '' : 'none'}>
            <span className="label">{part.label}</span>
            <b className="num">{fmt(part.value)}</b>
          </span>
        ))}
      </div>
    </section>
  );
}

function Fleet({ conductor, act, notify, cooling, cool }) {
  const lines = operatedLines(conductor);
  const free = lines.filter((line) => !routeOnLine(conductor, line.id));
  return (
    <section className="plate stack">
      <div className="plate-head">
        <h3>
          <TrainFront aria-hidden="true" style={{ width: 18, height: 18, verticalAlign: '-3px' }} /> The fleet
        </h3>
        <span className="muted small">
          {conductor.locos.length} of {garageSlots(conductor)} bays · {lines.length} line{lines.length === 1 ? '' : 's'} worked, {free.length} waiting for a locomotive
        </span>
      </div>
      {conductor.locos.map((loco) => {
        const active = loco.id === conductor.activeLocoId;
        const route = routeOfLoco(conductor, loco.id);
        const line = route ? lineById(route.lineId) : null;
        const quote = line ? routeQuote(conductor, loco, line) : null;
        // The best line still waiting for a locomotive, for this one.
        const offers = active || route ? [] : free.map((item) => ({ line: item, quote: routeQuote(conductor, loco, item) })).sort((a, b) => b.quote.perDay - a.quote.perDay);
        return (
          <div className={`fleet-row ${route ? 'working' : active ? 'active' : ''}`} key={loco.id}>
            <div className="grow">
              <div className="row" style={{ gap: 6 }}>
                <b>{loco.name}</b>
                <RarityTag rarity={loco.rarity} />
                {active ? <span className="tag tag-solid">On the main line</span> : route ? <span className="tag tag-legendary">Working</span> : <span className="tag tag-uncommon">In the garage</span>}
              </div>
              {route ? (
                <span className="small">
                  <b>{line.name}</b>: <b className="brass num">{ltWhole(quote.perDay)} LT a day</b> · hauls {fmt(quote.tons, 1)} tons at {fmt(quote.mph)} mph, {fmt(quote.tripsPerDay, 2)} trips a day
                  {quote.raider ? <span className="stop"> · raided by {B.BOSSES[quote.raider].name}: −{Math.round(B.BOSS.raidCut * 100)}%</span> : null}
                </span>
              ) : active ? (
                <span className="small muted">Yours to drive. Switch to another locomotive on the Fleet screen to put this one to work.</span>
              ) : offers.length ? (
                <span className="small muted">
                  Idle. Best line waiting: {offers[0].line.name}, about {ltWhole(offers[0].quote.perDay)} LT a day.
                </span>
              ) : (
                <span className="small muted">Idle. {lines.length ? 'Every line you work has its locomotive: open another terminal.' : 'Open a second terminal on a line from one you hold to give it work.'}</span>
              )}
            </div>
            {route ? (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => act('recallRoute', { locoId: loco.id })}>
                <Undo2 aria-hidden="true" />
                Recall
              </button>
            ) : offers.length ? (
              <div className="fleet-offers">
                {offers.slice(0, 3).map(({ line: item, quote: q }) => (
                  <button
                    type="button"
                    key={item.id}
                    className="btn btn-sm btn-brass"
                    disabled={cooling}
                    onClick={() => {
                      const report = act('assignRoute', { locoId: loco.id, lineId: item.id });
                      cool();
                      if (report) notify(`${loco.name} is working the ${item.name} line.`, 'good');
                    }}
                  >
                    {item.name} · {ltWhole(q.perDay)}/day
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
      <p className="small muted">
        A route is one locomotive working one line between two of your terminals. It hauls {Math.round(B.EMPIRE.route.loadShare * 100)}% of its towing capacity, so horsepower is money; a thrifty engine keeps more of it, and floods, deserts and frozen passes slow the trips. Buy more locomotives at the Station ({MODELS.tank.name}s tow the most for their price).
      </p>
    </section>
  );
}

export default function Empire() {
  const { conductor, act, notify } = useGame();
  const empire = conductor.empire;
  const [sel, setSel] = useState(empire?.hq ?? null);
  const [cooling, cool] = useCooldown();
  const perDay = useMemo(() => (empire ? empireIncome(conductor) : 0), [conductor, empire]);
  const cap = empire ? tillCap(conductor) : 0;
  const till = Math.floor(empire?.till ?? 0);
  const full = cap > 0 && (empire?.till ?? 0) >= cap - 1;

  return (
    <div className="stack empire">
      <div className="page-head">
        <h1>
          Rail <span className="hl-orange">Empire</span>
        </h1>
        <p>{empire ? `${empire.name}, headquartered in ${CITIES[empire.hq].name}. ${Object.keys(empire.terminals).length} terminal${Object.keys(empire.terminals).length === 1 ? '' : 's'}, ${empire.routes.length} route${empire.routes.length === 1 ? '' : 's'} at work.` : 'Build a railway company: terminals in real cities, and a fleet that earns while you are out on the line.'}</p>
      </div>

      {empire ? null : <Founding conductor={conductor} act={act} notify={notify} />}

      <div className="cols even">
        <RatingCard conductor={conductor} />
        {empire ? (
          <section className={`plate riveted stack-sm till ${full ? 'full' : ''}`}>
            <span className="label">
              <Coins aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> In the till
            </span>
            <div className="till-amount">
              <CountUp value={till} format={(v) => Math.round(v).toLocaleString()} /> <small>LT</small>
            </div>
            <div className="stats" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              <Stat label="A day" value={ltWhole(perDay)} unit="LT" tone="brass" />
              <Stat label="A week" value={ltWhole(perDay * B.WEEK.days)} unit="LT" />
              <Stat label="All time" value={ltWhole(empire.earned ?? 0)} unit="LT" />
            </div>
            {cap > 0 ? <Meter value={empire.till ?? 0} max={cap} tone={full ? 'ember' : 'go'} thin label="Till against its limit" /> : null}
            <span className="small muted">
              {empire.routes.length
                ? full
                  ? 'The till is full: your routes are working for nothing until you collect.'
                  : `Your routes pay in around the clock (1 real hour is ${B.CALENDAR.driftGameMinutesPerRealMinute} hours on the line). The till holds ${B.EMPIRE.tillDays} days of takings.`
                : 'No routes at work yet. Open a second terminal and put a locomotive from your garage on the line between them.'}
            </span>
            <button
              type="button"
              className="btn btn-ember btn-lg btn-block"
              disabled={till <= 0 || cooling}
              onClick={() => {
                const report = act('collectTill');
                cool();
                if (report) notify(`Collected ${ltWhole(report.amount)} LT from your routes.`, 'good');
              }}
            >
              <Coins aria-hidden="true" />
              {till > 0 ? `Collect ${ltWhole(till)} LT` : 'Nothing to collect yet'}
            </button>
          </section>
        ) : (
          <section className="plate stack-sm">
            <span className="label">How an empire earns</span>
            <ul className="empire-how">
              <li>
                <Warehouse aria-hidden="true" /> <span><b>Terminals</b> in real cities. One at each end of a line and the line is yours to work. Each adds a garage bay.</span>
              </li>
              <li>
                <TrainFront aria-hidden="true" /> <span><b>Routes.</b> A locomotive from your garage hauls freight on a line, day and night, and pays into the till.</span>
              </li>
              <li>
                <Skull aria-hidden="true" /> <span><b>Raiders.</b> A boss at large takes {Math.round(B.BOSS.raidCut * 100)}% of what its line earns. Bring it down.</span>
              </li>
              <li>
                <Crown aria-hidden="true" /> <span><b>Rank.</b> Everything you build raises your rating; every rank raises what your routes pay.</span>
              </li>
            </ul>
          </section>
        )}
      </div>

      {empire ? (
        <>
          <section className="stack-sm">
            <div className="spread">
              <h2>The network</h2>
              <div className="rmap-legend" aria-label="Map key">
                <span>
                  <i style={{ background: '#ffcf5a' }} /> Your lines
                </span>
                <span>
                  <i style={{ background: '#7fcf6a', opacity: 0.6 }} /> Open
                </span>
                <span>
                  <i className="locked" /> Locked
                </span>
              </div>
            </div>
            <p className="small muted">Tap a city to open or grow a terminal. Gold squares are yours; the white dots moving along a line are your locomotives at work; a red skull marks a boss raiding that line.</p>
            <EmpireMap conductor={conductor} sel={sel} onPick={setSel} />
            {sel ? <CityPanel conductor={conductor} cityId={sel} act={act} notify={notify} cooling={cooling} cool={cool} /> : null}
          </section>
          <Fleet conductor={conductor} act={act} notify={notify} cooling={cooling} cool={cool} />
        </>
      ) : null}

      <section className="plate stack-sm">
        <div className="plate-head">
          <h3>The ladder</h3>
          <span className="muted small">Rank comes from your empire power rating</span>
        </div>
        <ol className="rank-ladder">
          {B.EMPIRE.ranks.map((rank, index) => {
            const mine = empireRank(conductor).index;
            return (
              <li key={rank.id} className={index <= mine ? 'earned' : ''}>
                <RankBadge rank={{ ...rank, index }} size={38} />
                <span className="small">
                  <b>{rank.name}</b>
                  <span className="muted">
                    {' '}
                    {fmt(rank.rating)}
                    {rank.income ? ` · routes +${Math.round(rank.income * 100)}%` : ''}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

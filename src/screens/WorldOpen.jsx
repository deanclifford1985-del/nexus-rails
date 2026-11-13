import React, { useState } from 'react';
import { Check, Crown, Flag, Globe, Sparkles, Trophy } from 'lucide-react';
import { B } from '../game/balance.js';
import { useGame } from '../state/store.jsx';
import { OPEN_IDS, hasTrophy, openById, openEntry, openField, openPurse, openWeek, trophyCount } from '../game/open.js';
import { MODELS } from '../game/locomotives.js';
import { Terrain } from '../ui/Terrain.jsx';
import { Stat } from '../ui/bits.jsx';
import { LAND_D, WATER_D, WH, WW, wpx } from '../ui/worldgeo.js';
import { fmt, ltWhole } from '../ui/format.js';

// The World Open: twelve races on real routes around the world, open to anyone with the entry fee.

const TIER_COLOR = ['#7fcf6a', '#4fb0ff', '#b48cff', '#ff9d1c', '#ff5f5f'];
const place = (n) => `${n}${['th', 'st', 'nd', 'rd'][n] ?? 'th'}`;

function WorldMap({ conductor, sel, onPick }) {
  const week = openWeek(conductor);
  return (
    <div className="rmap-scroll">
      <svg className="rmap wmap" viewBox={`0 0 ${WW} ${WH}`} role="img" aria-label="Map of the world with the World Open events">
        <defs>
          <radialGradient id="wmap-sea" cx="50%" cy="45%" r="80%">
            <stop offset="0%" stopColor="#0f1e30" />
            <stop offset="100%" stopColor="#05090f" />
          </radialGradient>
          <filter id="wmap-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width={WW} height={WH} fill="url(#wmap-sea)" />
        {/* a faint grid of latitude and longitude */}
        {[-120, -60, 0, 60, 120].map((lon) => (
          <line key={`lon${lon}`} x1={wpx(lon, 0)[0]} y1="0" x2={wpx(lon, 0)[0]} y2={WH} stroke="#16283a" strokeWidth="1" />
        ))}
        {[60, 30, 0, -30].map((lat) => (
          <line key={`lat${lat}`} x1="0" y1={wpx(0, lat)[1]} x2={WW} y2={wpx(0, lat)[1]} stroke={lat === 0 ? '#1f3a52' : '#16283a'} strokeWidth="1" />
        ))}
        <path d={LAND_D} fill="#142233" stroke="#2c4660" strokeWidth="1.2" strokeLinejoin="round" />
        <path d={WATER_D} fill="#0b1622" stroke="#2c4660" strokeWidth="1" />
        {OPEN_IDS.map((id) => {
          const event = openById(id);
          const [ax, ay] = wpx(event.from[1], event.from[2]);
          const [bx, by] = wpx(event.to[1], event.to[2]);
          const color = TIER_COLOR[event.tier - 1];
          const picked = sel === id;
          const won = hasTrophy(conductor, id);
          const done = week.done[id] !== undefined;
          return (
            <g key={id} className={`wmap-pin ${picked ? 'sel' : ''}`} onClick={() => onPick(id)} role="button" aria-label={`${event.name}, ${event.country}, tier ${event.tier}${won ? ', trophy won' : ''}`}>
              <line x1={ax} y1={ay} x2={bx} y2={by} stroke={color} strokeWidth={picked ? 4 : 2.5} strokeLinecap="round" opacity="0.9" />
              <circle cx={ax} cy={ay} r="15" fill="transparent" />
              {picked ? <circle cx={ax} cy={ay} r="13" fill="none" stroke="#fff" strokeWidth="1.5" opacity="0.9" /> : null}
              <circle cx={ax} cy={ay} r={picked ? 8 : 6.5} fill={won ? '#ffcf5a' : color} stroke="#05090f" strokeWidth="2" filter={picked || won ? 'url(#wmap-glow)' : undefined} opacity={done ? 0.55 : 1} />
              <text x={ax} y={ay + 3.5} textAnchor="middle" className="wmap-tier">
                {event.tier}
              </text>
              {picked ? (
                <text x={ax + (ax > WW - 150 ? -12 : 12)} y={ay - 12} textAnchor={ax > WW - 150 ? 'end' : 'start'} className="wmap-label">
                  {event.name}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function EventPanel({ conductor, id, go }) {
  const event = openById(id);
  const t = event.tier - 1;
  const purse = openPurse(event);
  const fee = openEntry(event);
  const week = openWeek(conductor);
  const done = week.done[id];
  const paid = week.entered[id];
  const won = hasTrophy(conductor, id);
  const field = openField(id);
  const champ = field.at(-1);
  const ability = champ.ability ? B.ABILITIES[champ.ability] : null;
  return (
    <article className="plate riveted stack-sm open-panel" style={{ '--tier': TIER_COLOR[t] }}>
      <div className="spread">
        <div>
          <span className="label">
            Tier {event.tier} · {event.country}
          </span>
          <h3>{event.name}</h3>
        </div>
        {won ? (
          <span className="stamp gold">
            <Trophy aria-hidden="true" style={{ width: 13, height: 13, verticalAlign: '-2px' }} /> Trophy won
          </span>
        ) : null}
      </div>
      <span className="muted">
        {event.from[0]} to {event.to[0]} · <b>{event.miles} miles</b> raced · <Terrain theme={event.terrain} />
      </span>
      <p className="small">{event.text}</p>
      <div className="purse">
        {purse.map((amount, i) => (
          <span key={i} className={`purse-${i + 1}`}>
            <span className="label">{['1st', '2nd', '3rd'][i]}</span>
            <b className="num">{ltWhole(amount)}</b> LT
          </span>
        ))}
      </div>
      <div className="stats">
        <Stat label="Entry" value={paid ? 'Paid' : ltWhole(fee)} unit={paid ? '' : 'LT'} />
        <Stat label="Field" value={field.length} unit="rivals" />
        <Stat label="Their Power" value={`about ${B.OPEN.stat[t]}`} />
        <Stat label="Win" value={fmt(B.OPEN.winXp[t])} unit="XP" />
      </div>
      <div className="open-champ">
        <Crown aria-hidden="true" />
        <div>
          <span className="label">The champion</span>
          <b>
            {champ.name}, {champ.title}
          </b>
          <span className="small muted">
            drives {MODELS[champ.model]?.name ?? champ.locoName}
            {B.MYTHIC[champ.model]?.price || champ.model === 'phoenix' ? ', tuned to this class' : ''}
          </span>
          {ability ? (
            <span className="small">
              <Sparkles aria-hidden="true" style={{ width: 13, height: 13, verticalAlign: '-2px' }} /> <b>{ability.name}:</b> {ability.text}
            </span>
          ) : null}
        </div>
      </div>
      {!won ? <p className="small brass">The first win takes the {event.name} trophy and pays the winner's purse again.</p> : null}
      {done !== undefined ? (
        <p className="note small">
          <Check aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> Run this week{done > 0 ? `: you finished ${place(done)}` : ''}. It opens again with the new week.
        </p>
      ) : (
        <button type="button" className="btn btn-ember btn-block" onClick={() => go('setup', { ctx: { kind: 'open', openId: id } })}>
          <Flag aria-hidden="true" />
          {paid ? 'Back to the start line (entry paid)' : `Enter for ${ltWhole(fee)} LT`}
        </button>
      )}
    </article>
  );
}

export default function WorldOpen() {
  const { conductor, go } = useGame();
  const week = openWeek(conductor);
  // Start on the first event still to be won.
  const [sel, setSel] = useState(() => OPEN_IDS.find((id) => !hasTrophy(conductor, id)) ?? OPEN_IDS[0]);
  const trophies = trophyCount(conductor);
  return (
    <div className="stack">
      <p className="muted">
        Twelve races on real routes around the world, open to anyone who pays the entry: no licence, no invitation. The fields are not matched to you. Each event has a class, its crews are built to it, and its champion drives a legendary machine and uses it. Run each event once a week; the first win takes its trophy.
      </p>
      <div className="row" style={{ gap: 8 }}>
        <span className="chip">
          <Trophy aria-hidden="true" /> {trophies} of {OPEN_IDS.length} trophies
        </span>
        <span className="chip">
          <Globe aria-hidden="true" /> {Object.keys(week.done).length} run this week
        </span>
        <div className="rmap-legend" aria-label="Tiers">
          {TIER_COLOR.map((color, i) => (
            <span key={color}>
              <i style={{ background: color }} />
              Tier {i + 1}
            </span>
          ))}
        </div>
      </div>
      <WorldMap conductor={conductor} sel={sel} onPick={setSel} />
      <EventPanel conductor={conductor} id={sel} go={go} />
      <div className="open-list">
        {OPEN_IDS.map((id) => {
          const event = openById(id);
          const done = week.done[id] !== undefined;
          return (
            <button type="button" key={id} className={`open-row ${sel === id ? 'on' : ''} ${done ? 'done' : ''}`} onClick={() => setSel(id)} style={{ '--tier': TIER_COLOR[event.tier - 1] }} aria-pressed={sel === id}>
              <span className="open-tier">{event.tier}</span>
              <span className="grow">
                <b>{event.name}</b>
                <span className="small muted">
                  {event.from[0]} to {event.to[0]}, {event.country}
                </span>
              </span>
              <span className="small num">{ltWhole(openPurse(event)[0])} LT</span>
              {hasTrophy(conductor, id) ? <Trophy aria-hidden="true" className="open-won" /> : done ? <Check aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import { Flag, Lock, MapPin, Package, Route, TrainFront, Trophy } from 'lucide-react';
import { B } from '../game/balance.js';
import { useGame } from '../state/store.jsx';
import { CITIES, EXPRESSES, LINES, expressLines, expressMiles, lineById, lineOpen, nextUnlock, railRep } from '../game/routemap.js';
import { jobPay } from '../game/jobs.js';
import { fmt, ltWhole } from './format.js';

// The rail map: a stylized United States with the cities, the lines between them (coloured by
// terrain, locked ones dashed), this week's jobs as pins along their lines, and the express routes.

const W = 1000;
const H = 560;
const px = (lon, lat) => [30 + ((lon + 125) / 59) * 940, 18 + (50 - lat) * 19.9];
const pt = (id) => px(CITIES[id].lon, CITIES[id].lat);

// A rough outline of the lower 48, lon/lat, clockwise from the Olympic Peninsula.
const OUTLINE = [
  [-124.7, 48.4], [-123.0, 49.0], [-95.2, 49.0], [-94.8, 49.4], [-89.6, 48.0], [-84.8, 46.5], [-83.5, 46.1], [-82.4, 43.0], [-79.0, 43.3],
  [-76.5, 44.2], [-74.9, 45.0], [-71.5, 45.0], [-70.0, 46.7], [-67.8, 47.1], [-67.0, 44.8], [-70.6, 43.1], [-70.0, 41.7], [-71.9, 41.3],
  [-74.0, 40.6], [-74.2, 39.6], [-75.5, 38.5], [-76.0, 37.0], [-75.5, 35.3], [-77.9, 33.9], [-79.2, 33.2], [-80.9, 32.0], [-81.4, 30.7],
  [-80.0, 26.9], [-80.4, 25.2], [-81.8, 25.9], [-82.6, 27.5], [-82.8, 29.2], [-84.3, 30.0], [-86.5, 30.4], [-88.5, 30.3], [-89.6, 29.9],
  [-89.4, 29.0], [-90.9, 29.1], [-93.8, 29.7], [-95.0, 29.3], [-97.2, 27.6], [-97.4, 25.9], [-99.1, 26.4], [-100.6, 28.6], [-101.4, 29.8],
  [-103.1, 29.0], [-104.5, 29.6], [-106.5, 31.8], [-108.2, 31.8], [-111.1, 31.3], [-114.8, 32.5], [-117.1, 32.5], [-118.5, 34.0], [-120.6, 34.6],
  [-121.9, 36.6], [-122.5, 37.8], [-123.8, 39.8], [-124.2, 41.9], [-124.5, 43.0], [-124.0, 46.3],
];
const OUTLINE_D = `M ${OUTLINE.map(([lon, lat]) => px(lon, lat).map((v) => v.toFixed(1)).join(' ')).join(' L ')} Z`;

const TERRAIN = {
  plains: { color: '#7fcf6a', name: 'Plains' },
  flooded: { color: '#4fb0ff', name: 'Flooded' },
  desert: { color: '#f2a650', name: 'Desert' },
  snow: { color: '#e4f0ff', name: 'Frozen' },
};
// Labels that would collide with a neighbour sit somewhere else.
const LABEL_AT = { pittsburgh: [-9, 18, 'end'], newyork: [9, 4, 'start'], washington: [9, 16, 'start'], stlouis: [9, 16, 'start'], kansascity: [-9, -7, 'end'] };
const PIN = { delivery: '#19c3e6', company: '#a56bff', contract: '#ff9d1c', race: '#ff5f5f' };

// Jobs on the board, with where they go when taken.
function boardJobs(conductor) {
  const board = conductor.board ?? {};
  const out = [];
  for (const job of board.simple ?? []) out.push({ job, kind: 'delivery', ctx: { kind: 'delivery', jobId: job.id } });
  for (const [companyId, jobs] of Object.entries(board.company ?? {})) for (const job of jobs) out.push({ job, kind: 'company', ctx: { kind: 'company', companyId, jobId: job.id } });
  for (const job of board.contracts ?? []) out.push({ job, kind: 'contract', ctx: { kind: 'contract', contractId: job.id } });
  for (const job of board.races ?? []) out.push({ job, kind: 'race', ctx: { kind: 'race', raceId: job.id } });
  return out.filter((x) => x.job.line && lineById(x.job.line));
}

export default function RouteMap() {
  const { conductor, go, act } = useGame();
  const rep = railRep(conductor);
  const jobs = useMemo(() => boardJobs(conductor), [conductor]);
  const [sel, setSel] = useState(() => (conductor.express ? { express: conductor.express.id } : null));
  const run = conductor.express;
  const selLine = sel?.line ? lineById(sel.line) : null;
  const selExpress = sel?.express ? EXPRESSES.find((x) => x.id === sel.express) : null;
  const expressSet = new Set(selExpress ? expressLines(selExpress).map((l) => l.id) : []);
  const unlock = nextUnlock(conductor);
  const owned = conductor.containers ?? 0;

  const pinAt = (job) => {
    const line = lineById(job.line);
    const [ax, ay] = pt(line.a);
    const [bx, by] = pt(line.b);
    const k = job.linePos ?? 0.5;
    return [ax + (bx - ax) * k, ay + (by - ay) * k];
  };
  // Where the express run is now: the start of its current leg.
  let trainAt = null;
  if (run) {
    const leg = run.legs[run.leg];
    const line = leg && lineById(leg.line);
    if (line) {
      const legsOnLine = run.legs.filter((l) => l.line === leg.line);
      const idx = legsOnLine.indexOf(leg);
      const x = EXPRESSES.find((e) => e.id === run.id);
      const forward = x.path.indexOf(line.a) < x.path.indexOf(line.b);
      const [from, to] = forward ? [pt(line.a), pt(line.b)] : [pt(line.b), pt(line.a)];
      const k = idx / legsOnLine.length;
      trainAt = [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k];
    }
  }

  return (
    <div className="stack">
      <div className="rmap-head">
        <div>
          <span className="label">Rail reputation</span>
          <b className="num rmap-rep">{fmt(rep)}</b>
          <span className="small muted">{unlock ? ` · next lines open at ${fmt(unlock)}` : ' · every line is open'}</span>
        </div>
        <div className="rmap-legend" aria-label="Line terrain">
          {Object.entries(TERRAIN).map(([id, t]) => (
            <span key={id}>
              <i style={{ background: t.color }} />
              {t.name}
            </span>
          ))}
          <span>
            <i className="locked" />
            Locked
          </span>
        </div>
      </div>
      <p className="small muted">Earn rail reputation with deliveries (+{B.EXPRESS.rep.delivery}), contract jobs, contract wins and express legs. Tap a line to see its jobs, or an express to run it.</p>

      <div className="rmap-scroll">
        <svg className="rmap" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Rail map of the United States">
          <defs>
            <radialGradient id="rmap-sea" cx="50%" cy="45%" r="75%">
              <stop offset="0%" stopColor="#0f1e30" />
              <stop offset="100%" stopColor="#05090f" />
            </radialGradient>
            <filter id="rmap-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <rect width={W} height={H} fill="url(#rmap-sea)" />
          <path d={OUTLINE_D} fill="#142233" stroke="#2c4660" strokeWidth="2" />
          {/* lines */}
          {LINES.map((line) => {
            const [ax, ay] = pt(line.a);
            const [bx, by] = pt(line.b);
            const open = lineOpen(conductor, line);
            const hot = sel?.line === line.id || expressSet.has(line.id);
            const color = TERRAIN[line.terrain].color;
            return (
              <g key={line.id} className="rmap-line" onClick={() => setSel({ line: line.id })} role="button" aria-label={`${line.name}, ${line.miles} miles${open ? '' : `, locked until ${line.rep} rail reputation`}`}>
                <line x1={ax} y1={ay} x2={bx} y2={by} stroke="transparent" strokeWidth="18" />
                {hot ? <line x1={ax} y1={ay} x2={bx} y2={by} stroke={color} strokeWidth="9" opacity="0.35" filter="url(#rmap-glow)" /> : null}
                <line x1={ax} y1={ay} x2={bx} y2={by} stroke={open ? color : '#4b5a6c'} strokeWidth={hot ? 4.5 : 3} strokeDasharray={open ? '' : '7 6'} strokeLinecap="round" opacity={open ? 0.95 : 0.7} />
                {!open ? (
                  <g transform={`translate(${(ax + bx) / 2 - 7} ${(ay + by) / 2 - 7})`} opacity="0.85">
                    <rect width="14" height="14" rx="3" fill="#0b121b" stroke="#4b5a6c" />
                    <path d="M4 7 V5.5 a3 3 0 0 1 6 0 V7 M3.5 7 h7 v5 h-7 z" fill="none" stroke="#9fb0c4" strokeWidth="1.2" />
                  </g>
                ) : null}
              </g>
            );
          })}
          {/* job pins */}
          {jobs.map(({ job, kind }) => {
            const [x, y] = pinAt(job);
            return (
              <g key={job.id} className="rmap-pin" onClick={() => setSel({ line: job.line })} transform={`translate(${x} ${y})`}>
                <circle r="7" fill={PIN[kind]} stroke="#05090f" strokeWidth="2" />
                <circle r="2.4" fill="#05090f" />
              </g>
            );
          })}
          {/* cities */}
          {Object.entries(CITIES).map(([id, c]) => {
            const [x, y] = pt(id);
            const [dx, dy, anchor] = LABEL_AT[id] ?? (x > 820 ? [-9, -7, 'end'] : [9, -7, 'start']);
            return (
              <g key={id} className="rmap-city">
                <circle cx={x} cy={y} r="5" fill="#e9f4ff" stroke="#05090f" strokeWidth="2" />
                <text x={x + dx} y={y + dy} textAnchor={anchor}>
                  {c.name}
                </text>
              </g>
            );
          })}
          {trainAt ? (
            <g transform={`translate(${trainAt[0]} ${trainAt[1]})`} className="rmap-train">
              <circle r="13" fill="#ffcf5a" opacity="0.25" />
              <circle r="8" fill="#ffcf5a" stroke="#05090f" strokeWidth="2" />
            </g>
          ) : null}
        </svg>
      </div>
      <div className="rmap-pins small muted">
        <span><i style={{ background: PIN.delivery }} /> Delivery</span>
        <span><i style={{ background: PIN.company }} /> Contract job</span>
        <span><i style={{ background: PIN.contract }} /> Open contract</span>
        <span><i style={{ background: PIN.race }} /> Prize race</span>
        {run ? <span><i style={{ background: '#ffcf5a' }} /> Your express</span> : null}
      </div>

      {selLine ? <LinePanel line={selLine} jobs={jobs.filter((x) => x.job.line === selLine.id)} owned={owned} onClose={() => setSel(null)} /> : null}

      <section className="stack-sm">
        <h3 className="rmap-h3">
          <Route aria-hidden="true" /> Express routes
        </h3>
        <div className="rmap-express-grid">
          {EXPRESSES.map((x) => {
            const open = rep >= x.rep;
            const active = run?.id === x.id;
            const miles = expressMiles(x);
            const legs = expressLines(x).reduce((n, l) => n + Math.ceil(l.miles / B.EXPRESS.legMiles), 0);
            const est = Math.round(miles * (B.EXPRESS.feePerMile + B.EXPRESS.perContainerPerMile * Math.min(owned, B.EXPRESS.containers)) * (1 + B.EXPRESS.bonus));
            return (
              <article key={x.id} className={`rmap-express ${active ? 'active' : ''} ${open ? '' : 'locked'} ${sel?.express === x.id ? 'sel' : ''}`} onClick={() => setSel({ express: x.id })}>
                <div className="spread">
                  <b>{x.name}</b>
                  {open ? <span className="small num">{fmt(miles)} mi</span> : <span className="small"><Lock aria-hidden="true" /> {fmt(x.rep)} rep</span>}
                </div>
                <span className="small muted">{x.path.map((id) => CITIES[id].name).join(' → ')}</span>
                <span className="small">{x.text}</span>
                <span className="small">
                  {legs} legs · about {ltWhole(est)} LT with {Math.min(owned, B.EXPRESS.containers)} container{Math.min(owned, B.EXPRESS.containers) === 1 ? '' : 's'}, finish bonus included
                  {conductor.expressDone?.[x.id] ? ` · run ${conductor.expressDone[x.id]}×` : ''}
                </span>
                {active ? (
                  <div className="stack-xs">
                    <div className="rmap-progress">
                      <i style={{ width: `${(run.leg / run.legs.length) * 100}%` }} />
                    </div>
                    <span className="small">
                      Leg {run.leg + 1} of {run.legs.length}: {run.legs[run.leg].from} to {run.legs[run.leg].to}, {run.legs[run.leg].distance} mi · {ltWhole(run.paid)} LT earned so far{run.late ? ' · a leg ran late (smaller bonus)' : ''}
                    </span>
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn-brass" onClick={(e) => (e.stopPropagation(), go('setup', { ctx: { kind: 'express' } }))}>
                        <TrainFront aria-hidden="true" /> Run leg {run.leg + 1}
                      </button>
                      <AbandonButton act={act} />
                    </div>
                  </div>
                ) : open ? (
                  <button
                    type="button"
                    className="btn btn-ember btn-block"
                    disabled={!!run}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (act('startExpress', { id: x.id })) go('setup', { ctx: { kind: 'express' } });
                    }}
                  >
                    <Flag aria-hidden="true" /> {run ? 'Finish your current express first' : `Start the ${x.name}`}
                  </button>
                ) : (
                  <span className="small muted">Opens at {fmt(x.rep)} rail reputation ({fmt(x.rep - rep)} to go).</span>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function AbandonButton({ act }) {
  const [sure, setSure] = useState(false);
  return sure ? (
    <>
      <button type="button" className="btn btn-ghost" onClick={(e) => (e.stopPropagation(), act('abandonExpress'), setSure(false))}>
        Abandon (no bonus)
      </button>
      <button type="button" className="btn" onClick={(e) => (e.stopPropagation(), setSure(false))}>
        Keep going
      </button>
    </>
  ) : (
    <button type="button" className="btn btn-ghost" onClick={(e) => (e.stopPropagation(), setSure(true))}>
      Abandon
    </button>
  );
}

function LinePanel({ line, jobs, owned, onClose }) {
  const { conductor, go } = useGame();
  const open = lineOpen(conductor, line);
  const t = B.TRACK.themes[line.terrain];
  const LABEL = { delivery: 'Delivery', company: 'Contract job', contract: 'Open contract', race: 'Prize race' };
  const ICON = { delivery: Package, company: Package, contract: Trophy, race: Flag };
  return (
    <section className="plate stack-sm rmap-panel" aria-label={line.name}>
      <div className="spread">
        <h3 className="rmap-h3">
          <MapPin aria-hidden="true" /> {line.name}
        </h3>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          Close
        </button>
      </div>
      <span className="small">
        {fmt(line.miles)} miles · <b>{t.name}</b>: {t.text}
      </span>
      {!open ? (
        <p className="small muted">
          <Lock aria-hidden="true" /> No jobs here yet: this line opens at {fmt(line.rep)} rail reputation ({fmt(line.rep - railRep(conductor))} to go).
        </p>
      ) : jobs.length ? (
        <div className="stack-xs">
          {jobs.map(({ job, kind, ctx }) => {
            const Icon = ICON[kind];
            const pay = kind === 'race' ? job.purse?.[0] : kind === 'contract' ? null : jobPay(job, Math.min(job.containers, owned || 1));
            return (
              <div className="rmap-job" key={job.id}>
                <Icon aria-hidden="true" />
                <div className="grow">
                  <b>{job.title}</b>
                  <span className="small muted">
                    {LABEL[kind]} · {job.distance} mi{pay ? ` · ${ltWhole(pay)} LT` : ''}
                  </span>
                </div>
                <button type="button" className="btn btn-sm btn-brass" onClick={() => go('setup', { ctx })}>
                  Take it
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="small muted">No jobs posted on this line this week.</p>
      )}
    </section>
  );
}

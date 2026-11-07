import React, { useEffect, useMemo, useRef, useState } from 'react';

// The treasury's dollars over time: a step line (it only changes when money comes in or goes out
// as Nexus), a soft area under it, a few recessive gridlines and a crosshair with a tooltip.

const money = (v) => `$${v.toLocaleString('en-US', { minimumFractionDigits: v < 1000 ? 2 : 0, maximumFractionDigits: v < 1000 ? 2 : 0 })}`;
const day = (t) => new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' });
const stamp = (t) => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function niceMax(v) {
  if (v <= 0) return 10;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

export default function TreasuryChart({ history }) {
  const wrap = useRef(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    if (!wrap.current) return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  const height = width < 480 ? 190 : 230;
  const pad = { l: 52, r: 14, t: 14, b: 26 };
  const points = useMemo(() => (history ?? []).filter((p) => Number.isFinite(p.usd)), [history]);
  if (points.length < 2)
    return (
      <div ref={wrap} className="tr-chart-empty small muted">
        The chart starts with the first money into the treasury.
      </div>
    );
  const t0 = points[0].at;
  const t1 = Math.max(points[points.length - 1].at, t0 + 60000);
  const top = niceMax(Math.max(...points.map((p) => p.usd)) * 1.1);
  const x = (t) => pad.l + ((t - t0) / (t1 - t0)) * (width - pad.l - pad.r);
  const y = (v) => pad.t + (1 - v / top) * (height - pad.t - pad.b);
  let line = `M ${x(points[0].at)} ${y(points[0].usd)}`;
  for (let i = 1; i < points.length; i++) line += ` H ${x(points[i].at)} V ${y(points[i].usd)}`;
  const area = `${line} V ${y(0)} H ${x(t0)} Z`;
  const ticks = [0, top / 3, (2 * top) / 3, top];

  const onMove = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * width;
    const t = t0 + ((px - pad.l) / (width - pad.l - pad.r)) * (t1 - t0);
    let p = points[0];
    for (const q of points) if (q.at <= t) p = q;
    setHover({ x: Math.min(Math.max(px, pad.l), width - pad.r), p });
  };
  const last = points[points.length - 1];

  return (
    <div ref={wrap} className="tr-chart">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={`Treasury dollars over time, from ${money(points[0].usd)} on ${day(t0)} to ${money(last.usd)} now`} onPointerMove={onMove} onPointerLeave={() => setHover(null)} onPointerDown={onMove}>
        <defs>
          <linearGradient id="tr-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" className="tr-axis">
              {money(Math.round(v))}
            </text>
          </g>
        ))}
        <text x={pad.l} y={height - 6} className="tr-axis">
          {day(t0)}
        </text>
        <text x={width - pad.r} y={height - 6} textAnchor="end" className="tr-axis">
          Now
        </text>
        <path d={area} fill="url(#tr-area)" />
        <path d={line} fill="none" stroke="var(--cyan-hi)" strokeWidth="2" strokeLinejoin="round" />
        <circle cx={x(last.at)} cy={y(last.usd)} r="4.5" fill="var(--cyan-hi)" stroke="var(--iron)" strokeWidth="2" />
        {hover ? (
          <g pointerEvents="none">
            <line x1={hover.x} x2={hover.x} y1={pad.t} y2={y(0)} stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={hover.x} cy={y(hover.p.usd)} r="4.5" fill="var(--cyan-hi)" stroke="var(--iron)" strokeWidth="2" />
          </g>
        ) : null}
      </svg>
      {hover ? (
        <div className="tr-tip" style={{ left: `${(hover.x / width) * 100}%` }}>
          <b>{money(hover.p.usd)}</b>
          <span>{stamp(hover.p.at)}</span>
        </div>
      ) : null}
    </div>
  );
}

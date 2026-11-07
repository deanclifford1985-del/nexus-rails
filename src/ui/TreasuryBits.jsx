import React, { useEffect, useState } from 'react';
import { Crown, Landmark, Medal, Sparkles, TrendingUp } from 'lucide-react';
import { api } from '../net/api.js';
import CountUp from './CountUp.jsx';

export function usd(n) {
  const v = Number(n || 0);
  if (v === 0) return '$0.00';
  if (Math.abs(v) >= 0.01) return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${v.toPrecision(2)}`;
}
const ltText = (n) => `${Math.round(n).toLocaleString()} LT`;

// Top earners by the dollar value of the LT they earned: this week, this month or all time.
export function Leaderboard({ leaders, compact = false }) {
  const [board, setBoard] = useState('week');
  const rows = leaders?.[board] ?? [];
  const tabs = [
    ['week', 'This week'],
    ['month', 'This month'],
    ['all', 'All time'],
  ];
  return (
    <div className="lb stack-sm">
      {!compact ? (
        <div className="seg" role="group" aria-label="Leaderboard period">
          {tabs.map(([key, label]) => (
            <button type="button" key={key} aria-pressed={board === key} onClick={() => setBoard(key)}>
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {rows.length ? (
        <ol className="lb-list">
          {(compact ? rows.slice(0, 3) : rows).map((r) => (
            <li key={`${board}-${r.rank}`} className={`lb-row rank-${r.rank} ${r.me ? 'me' : ''}`}>
              <span className="lb-rank" aria-label={`Rank ${r.rank}`}>
                {r.rank <= 3 ? <Medal aria-hidden="true" /> : null}
                {r.rank}
              </span>
              <span className="lb-name">
                {r.name}
                {r.me ? <span className="lb-you">You</span> : null}
              </span>
              <span className="lb-val num">
                <b>{usd(r.usd)}</b>
                <span>{ltText(r.lt)}</span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="small muted">No earnings yet{board === 'week' ? ' this week' : board === 'month' ? ' this month' : ''}. The first run takes the top spot.</p>
      )}
    </div>
  );
}

// For the sign-in screen: the live treasury, so people see what's up for grabs before signing up.
export function TreasuryPreview() {
  const [data, setData] = useState(null);
  useEffect(() => {
    let live = true;
    const load = () =>
      api('/api/public/treasury')
        .then((d) => live && setData(d))
        .catch(() => {});
    load();
    const timer = setInterval(load, 20000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  if (!data?.treasury?.funded) return null;
  const t = data.treasury;
  const latest = data.events?.find((e) => e.kind === 'crate' || e.kind === 'deposit');
  return (
    <section className="tr-preview" aria-label="The Nexus Rail treasury">
      <span className="eyebrow">
        <Landmark aria-hidden="true" /> Live treasury
      </span>
      <div className="tr-preview-main">
        <div>
          <span className="tr-label">Available to earn</span>
          <b className="tr-preview-num">
            <CountUp value={t.usd} format={(v) => usd(v)} duration={1600} />
          </b>
        </div>
        <div className="tr-preview-side">
          <span className="tr-label">1 LT is worth</span>
          <b className="num">{usd(t.price)}</b>
          <span className="tr-sub">{t.ltPerDollar.toLocaleString()} LT = $1</span>
        </div>
      </div>
      {latest ? (
        <p className="tr-preview-line small">
          <Sparkles aria-hidden="true" /> {latest.kind === 'crate' ? `${latest.who} opened a ${latest.note}: +${usd(latest.usd)}` : `+${usd(latest.usd)} into the treasury`}
        </p>
      ) : null}
      {data.leaders?.week?.length ? (
        <div className="stack-xs">
          <span className="tr-label">
            <Crown aria-hidden="true" /> Top earners this week
          </span>
          <Leaderboard leaders={data.leaders} compact />
        </div>
      ) : (
        <p className="tr-preview-line small">
          <TrendingUp aria-hidden="true" /> Race, haul freight and win contracts to earn LT backed by real money.
        </p>
      )}
    </section>
  );
}

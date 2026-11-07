import React from 'react';
import { B } from '../game/balance.js';
import { licenceLevel, milesOf } from '../game/routemap.js';
import { fmt } from './format.js';

// Licences, earned only by miles driven: the badge ladder, your miles, and the road to the next one.
const initials = (name) =>
  name
    .replace(/'s\b/, '')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2);

export function LicenceBadge({ level, earned = true, big = false }) {
  const l = B.LICENCES[level];
  return (
    <span className={`licence-badge tier-${level} ${earned ? '' : 'dim'} ${big ? 'big' : ''}`} title={`${l.name}: ${fmt(l.miles)} miles${l.pay ? `, +${Math.round(l.pay * 100)}% pay` : ''}`}>
      {initials(l.name)}
    </span>
  );
}

export function Licences({ conductor, compact = false }) {
  const level = licenceLevel(conductor);
  const now = B.LICENCES[level];
  const next = B.LICENCES[level + 1] ?? null;
  const miles = milesOf(conductor);
  const pct = next ? Math.min(1, (miles - now.miles) / (next.miles - now.miles)) : 1;
  return (
    <section className={`licences ${compact ? 'compact' : ''}`} aria-label="Licences">
      <div className="licence-now">
        <LicenceBadge level={level} big />
        <div className="grow">
          <span className="label">Licence</span>
          <b className="licence-name">{now.name}</b>
          <span className="small muted">
            {fmt(miles)} miles driven{now.pay ? ` · +${Math.round(now.pay * 100)}% pay on every job` : ''}
          </span>
        </div>
      </div>
      {next ? (
        <div className="stack-xs">
          <div className="licence-bar" aria-label={`${Math.round(pct * 100)}% of the way to the ${next.name}`}>
            <i style={{ width: `${pct * 100}%` }} />
          </div>
          <span className="small">
            <b>{fmt(next.miles - miles)} mi</b> to the {next.name}: +{Math.round(next.pay * 100)}% pay. {next.text}
          </span>
        </div>
      ) : (
        <span className="small">Every licence earned. Every line and express is open.</span>
      )}
      {!compact ? (
        <ol className="licence-ladder">
          {B.LICENCES.map((l, i) => (
            <li key={l.id} className={i <= level ? 'earned' : ''}>
              <LicenceBadge level={i} earned={i <= level} />
              <span className="small">
                <b>{l.name}</b>
                <span className="muted">
                  {' '}
                  {fmt(l.miles)} mi{l.pay ? ` · +${Math.round(l.pay * 100)}%` : ''}
                </span>
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

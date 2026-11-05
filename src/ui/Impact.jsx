import React from 'react';
import { fmt, lb } from './format.js';

// A signed change, coloured good or bad. `better` says which direction is good.
export function Delta({ value, digits = 0, unit = '', better = 'up' }) {
  if (value === null || value === undefined || Math.abs(value) < Math.pow(10, -digits) / 2) return <span className="delta muted">no change</span>;
  const good = better === 'up' ? value > 0 : value < 0;
  return (
    <span className={`delta ${good ? 'go' : 'stop'}`}>
      {value > 0 ? '+' : '-'}
      {fmt(Math.abs(value), digits)}
      {unit}
    </span>
  );
}

// How much of the towing capacity a load uses, as a meter with the limit marked.
export function TowMeter({ cargoLb, tow }) {
  const use = tow > 0 ? cargoLb / tow : 0;
  const tone = use > 1 ? 'over' : use > 0.8 ? 'near' : '';
  return (
    <div className="stack-sm">
      <div className="spread small">
        <span className="label">Towing</span>
        <span className={`num ${use > 1 ? 'stop' : use > 0.8 ? 'brass' : ''}`}>
          {lb(cargoLb)} of {lb(tow)} lb ({fmt(use * 100)}%)
        </span>
      </div>
      <div className={`tow-meter ${tone}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(use * 100)} aria-label="Towing capacity used">
        <i style={{ width: `${Math.min(100, use * 100)}%` }} />
      </div>
    </div>
  );
}

/**
 * Live numbers for a load: top speed, fuel, towing and wear, each with the change from `before`
 * (the same figures one step back) when given.
 */
export function ImpactPanel({ now, before = null, distance = null, gallons = null, tow }) {
  const d = (key) => (before ? now[key] - before[key] : null);
  return (
    <div className="impact stack-sm">
      <div className="impact-grid">
        <div>
          <span className="label">Top speed</span>
          <b className="num">{fmt(now.topSpeed)} mph</b>
          {before ? <Delta value={d('topSpeed')} unit=" mph" /> : null}
        </div>
        <div>
          <span className="label">Full speed after</span>
          <b className="num">{fmt(now.accelMiles ?? 0, 1)} mi</b>
          {before ? <Delta value={d('accelMiles')} digits={1} unit=" mi" better="down" /> : null}
        </div>
        <div>
          <span className="label">{gallons !== null ? 'Trip fuel' : 'Fuel / 100 mi'}</span>
          <b className="num">{gallons !== null ? `${gallons.text ?? fmt(gallons.now)} gal` : `${fmt(now.galPerMile * 100, 1)} gal`}</b>
          {before ? (
            gallons !== null ? <Delta value={gallons.now - gallons.before} unit=" gal" better="down" /> : <Delta value={d('galPerMile') * 100} digits={1} unit=" gal" better="down" />
          ) : null}
        </div>
        <div>
          <span className="label">Wear</span>
          <b className="num">
            {fmt(now.wearPer100 * 100 * (distance ? distance / 100 : 1), 2)}%{distance ? '' : ' /100 mi'}
          </b>
          {before ? <Delta value={(now.wearPer100 - before.wearPer100) * 100 * (distance ? distance / 100 : 1)} digits={2} unit="%" better="down" /> : null}
        </div>
      </div>
      <TowMeter cargoLb={now.cargo} tow={tow} />
    </div>
  );
}

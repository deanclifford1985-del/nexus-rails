import React from 'react';
import { Stat } from './bits.jsx';
import { fmt, lb } from './format.js';

export function CoreStats({ loco }) {
  return (
    <div className="core3">
      <div>
        <span className="label">Power</span>
        <b>{loco.power}</b>
      </div>
      <div>
        <span className="label">Efficiency</span>
        <b>{loco.efficiency}</b>
      </div>
      <div>
        <span className="label">Armor</span>
        <b>{loco.durability}</b>
      </div>
      <div>
        <span className="label">Endurance</span>
        <b>{loco.endurance ?? 5}</b>
      </div>
    </div>
  );
}

export function LocoStats({ stats }) {
  return (
    <div className="stats">
      <Stat label="Horsepower" value={fmt(stats.hp)} />
      <Stat label="Torque" value={fmt(stats.tq)} />
      <Stat label="Weight" value={lb(stats.weight)} unit="lb with kit" />
      <Stat label="Top speed" value={fmt(stats.topSpeed)} unit="mph at 5 tons" />
      <Stat label="Full speed after" value={fmt(stats.accelMiles ?? 0, 1)} unit="mi" />
      <Stat label="Fuel economy" value={fmt(stats.tmpg, 1)} unit="ton-mi/gal" />
      <Stat label="Tank" value={fmt(stats.tank)} unit="gal" />
      <Stat label="Can tow" value={lb(stats.tow)} unit="lb" />
      <Stat label="Capacity" value={`${stats.slotsUsed} of ${stats.capacity}`} unit="slots" />
      <Stat label="HP" value={fmt(stats.hull)} />
      <Stat label="Heat" value={fmt((1 - stats.heatMult) * 100)} unit="% cooler" tone={stats.heatMult < 0.7 ? 'go' : ''} />
      <Stat label="Durability" value={`${Math.round(stats.condition * 100)}%`} tone={stats.condition < 0.5 ? 'stop' : ''} />
    </div>
  );
}

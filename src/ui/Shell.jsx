import React from 'react';
import { ClipboardList, Coins, FlaskConical, Fuel, Home, Shield, Store, TrainFront, Wrench } from 'lucide-react';
import { useGame } from '../state/store.jsx';
import { gal, lt } from './format.js';
import { festivalInfo, fmtShortDate } from '../game/calendar.js';

const NAV = [
  { group: null, items: [{ id: 'yard', label: 'Fleet', icon: Home }] },
  { group: 'Earn', items: [{ id: 'jobs', label: 'Dispatch', icon: ClipboardList }] },
  {
    group: 'Spend',
    items: [
      { id: 'depot', label: 'Market', icon: Fuel },
      { id: 'armory', label: 'Eng. Bay', icon: Shield },
      { id: 'workshop', label: 'Workshop', icon: Wrench },
      { id: 'station', label: 'Station', icon: Store },
    ],
  },
  { group: 'Invest', items: [{ id: 'research', label: 'Lab', icon: FlaskConical }] },
];

function NavLink({ item, current, go, flag }) {
  const Icon = item.icon;
  return (
    <button type="button" className="nav-link" aria-current={current === item.id ? 'page' : undefined} onClick={() => go(item.id)}>
      <Icon aria-hidden="true" />
      {item.label}
      {flag ? <span className="dot" aria-label="needs attention" /> : null}
    </button>
  );
}

export function Shell({ children }) {
  const { conductor, screen, go } = useGame();
  const flags = {
    yard: conductor.attributePoints > 0,
    research: false,
  };
  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <button type="button" className="brand" onClick={() => go('yard')}>
            <TrainFront aria-hidden="true" />
            <b>
              NEXUS<span>RAIL</span>
            </b>
          </button>
          <nav className="nav" aria-label="Main">
            {NAV.map((section) => (
              <div className={section.group ? 'nav-group' : 'row'} key={section.group ?? 'home'} style={section.group ? undefined : { gap: 2 }}>
                {section.group ? <span>{section.group}</span> : null}
                {section.items.map((item) => (
                  <NavLink key={item.id} item={item} current={screen.name} go={go} flag={flags[item.id]} />
                ))}
              </div>
            ))}
          </nav>
          <div className="balances">
            <span className="chip" title="LocoTokens">
              <Coins className="brass" aria-hidden="true" />
              {lt(conductor.lt)} <small>LT</small>
            </span>
            <span className="chip" title="Fuel reserve">
              <Fuel className="fuel" aria-hidden="true" />
              {gal(conductor.fuel.gallons)} <small>gal</small>
            </span>
            <button type="button" className={`chip ${festivalInfo(conductor.clock ?? 0).active ? 'chip-fest' : ''}`} title="The calendar" onClick={() => go(festivalInfo(conductor.clock ?? 0).active ? 'festival' : 'yard')}>
              {fmtShortDate(conductor.clock ?? 0)}
            </button>
            <span className="chip hide-narrow" title="Conductor level">
              Lv {conductor.level}
            </span>
          </div>
        </div>
      </header>
      <main className="page">{children}</main>
      <nav className="tabbar" aria-label="Main">
        {NAV.flatMap((section) => section.items).map((item) => (
          <NavLink key={item.id} item={item} current={screen.name} go={go} flag={flags[item.id]} />
        ))}
      </nav>
    </div>
  );
}

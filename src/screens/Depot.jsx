import React, { useState } from 'react';
import { Fuel, Minus, Package, Plus } from 'lucide-react';
import { B } from '../game/balance.js';
import { useGame } from '../state/store.jsx';
import { canTakeFuelAdvance } from '../game/actions.js';
import { avgFuelCost } from '../game/conductor.js';
import { containerPrice, depotPrice, depotStockLeft, fuelMarket, weekNow, weeklyDeal } from '../game/economy.js';
import { dayIndex } from '../game/calendar.js';
import { hasTrait } from '../game/traits.js';
import { Meter, Stat } from '../ui/bits.jsx';
import { fmt, gal, lt } from '../ui/format.js';

export default function Depot() {
  const { conductor, act, notify } = useGame();
  const week = weekNow(conductor);
  const market = fuelMarket(week);
  const deal = weeklyDeal(week);
  const daysLeft = B.WEEK.days - (dayIndex(conductor.clock ?? 0) % B.WEEK.days);
  const left = depotStockLeft(conductor);
  const [wanted, setWanted] = useState(50);
  const gallons = Math.min(wanted, left);
  const price = depotPrice(conductor, gallons);
  const cost = Math.ceil(gallons * price * 10) / 10;
  const cheap = market.price <= B.FUEL.base * 0.92;
  const dear = market.price >= B.FUEL.base * 1.08;
  const average = avgFuelCost(conductor);

  function buy() {
    const report = act('buyFuel', { gallons });
    if (report) notify(`${report.gallons} gallons into the reserve for ${lt(report.cost)} LT.`, 'good');
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h1>
          Supply <span>Market</span>
        </h1>
        <p>Fuel is bought into your reserve and loaded before each run. The price and the delivery change every game week, so buy when it is low.</p>
      </div>

      {deal ? (
        <section className="plate stack-sm festival-on">
          <span className="label">This week's deal</span>
          <h3>{deal.text}</h3>
          {deal.crate ? (
            conductor.claimedWeek === week ? (
              <p className="small muted">Claimed. It is on your Armory shelf.</p>
            ) : (
              <button type="button" className="btn btn-brass btn-sm" onClick={() => act('claimDeal') && notify('A free Ammo Crate is on your Armory shelf.', 'good')}>
                Claim the free Ammo Crate
              </button>
            )
          ) : (
            <p className="small muted">Ends in {daysLeft} day{daysLeft === 1 ? '' : 's'}.</p>
          )}
        </section>
      ) : null}

      <div className="cols">
        <section className="plate riveted stack">
          <div className="spread">
            <div>
              <span className="label">This week's price</span>
              <div className="row" style={{ alignItems: 'baseline' }}>
                <b className={`num ${cheap ? 'go' : dear ? 'stop' : ''}`} style={{ fontSize: '2.6rem', lineHeight: 1 }}>
                  {fmt(market.price, 2)}
                </b>
                <span className="muted">LT a gallon</span>
              </div>
              <span className="small muted">
                {cheap ? 'Below the usual 2.00. A good time to stock up.' : dear ? 'Above the usual 2.00.' : 'About the usual 2.00.'} {deal?.fuel ? ' The deal takes 30% off for you.' : ''} Changes in {daysLeft} day{daysLeft === 1 ? '' : 's'}.
              </span>
            </div>
            <div style={{ minWidth: 150 }}>
              <div className="spread small">
                <span className="label">In stock</span>
                <span className="num">
                  {fmt(left)} of {fmt(market.stock)} gal
                </span>
              </div>
              <Meter tone="fuel" value={left} max={market.stock} label="Depot stock left" />
            </div>
          </div>

          <hr className="rule" />

          {left > 0 ? (
            <>
              <b className="fuel center" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '2.4rem', lineHeight: 1 }}>
                {fmt(gallons)} <span style={{ fontSize: '0.45em' }}>gal</span>
              </b>
              <div className="steppers" role="group" aria-label="Change how much to buy">
                <button type="button" className="btn btn-sm" onClick={() => setWanted(Math.max(5, gallons - 100))} aria-label="100 gallons less">
                  <Minus aria-hidden="true" />
                  100
                </button>
                <button type="button" className="btn btn-sm" onClick={() => setWanted(Math.max(5, gallons - 25))} aria-label="25 gallons less">
                  <Minus aria-hidden="true" />
                  25
                </button>
                <button type="button" className="btn btn-sm" onClick={() => setWanted(Math.min(left, gallons + 25))} aria-label="25 gallons more">
                  <Plus aria-hidden="true" />
                  25
                </button>
                <button type="button" className="btn btn-sm" onClick={() => setWanted(Math.min(left, gallons + 100))} aria-label="100 gallons more">
                  <Plus aria-hidden="true" />
                  100
                </button>
                <button type="button" className="btn btn-sm" onClick={() => setWanted(left)}>
                  All
                </button>
              </div>
              <div className="spread">
                <span className="muted small num">
                  {fmt(price, 2)} LT a gallon for you
                  {hasTrait(conductor, 'economist') ? ' (Economist)' : ''}
                  {hasTrait(conductor, 'prepared') ? (gallons >= B.FUEL.preparedAt ? ' (Prepared bulk discount)' : `. Prepared: 20% off at ${B.FUEL.preparedAt} gallons or more`) : ''}
                </span>
                <button type="button" className="btn btn-brass btn-lg" disabled={conductor.lt < cost} onClick={buy}>
                  <Fuel aria-hidden="true" />
                  Buy for {lt(cost)} LT
                </button>
              </div>
            </>
          ) : (
            <p className="note">Sold out until next week's delivery, in {daysLeft} day{daysLeft === 1 ? '' : 's'}. The trackside pump at the start line always has fuel, at {Math.round(B.FUEL.pumpMarkup * 100)}% more.</p>
          )}

          {canTakeFuelAdvance(conductor) ? (
            <div className="note stack-sm">
              <span>Out of fuel and short of money. The company will front you {B.FUEL.advanceGallons} gallons and take {fmt(B.FUEL.advanceGallons * B.FUEL.base)} LT back out of your next pay.</span>
              <button type="button" className="btn btn-brass btn-sm" onClick={() => act('takeFuelAdvance') && notify(`${B.FUEL.advanceGallons} gallons added to your reserve.`, 'good')}>
                Take the fuel advance
              </button>
            </div>
          ) : null}
        </section>

        <section className="stack">
          <div className="plate stack">
            <h3>Your reserve</h3>
            <div className="stats">
              <Stat label="In reserve" value={gal(conductor.fuel.gallons)} unit="gal" tone="fuel" />
              <Stat label="Average cost" value={fmt(average, 2)} unit="LT/gal" />
              <Stat label="Worth" value={lt(conductor.fuel.basis)} unit="LT" />
            </div>
            <p className="muted small">Job estimates and trip costs use this average, so cheap fuel makes thin jobs worth taking.</p>
          </div>

          <div className="plate stack">
            <div className="plate-head">
              <h3>
                <Package aria-hidden="true" style={{ width: 18, height: 18, verticalAlign: '-3px' }} /> Cargo containers
              </h3>
              <span className="chip">You own {conductor.containers}</span>
            </div>
            <p className="muted">
              Every job pays a delivery fee plus a rate for each container you pull, so more containers means bigger pay. Jobs offer 1 to 5. Buying containers is how your pay grows.
            </p>
            <button
              type="button"
              className="btn"
              disabled={conductor.lt < containerPrice(conductor)}
              onClick={() => {
                if (act('buyContainer')) notify('One cargo container added to your stock.', 'good');
              }}
            >
              Buy a container for {fmt(containerPrice(conductor))} LT
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

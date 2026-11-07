// The LocoToken (LT) treasury: real dollars back every LT in the game.
//
//   dollars in the treasury  ÷  LT in existence  =  what one LT is worth
//
// LT in existence is the pool (what jobs, contracts, races and future shops pay out from) plus
// what players hold. The money only moves in ways that keep that price steady:
//   - Money in (Dean's deposits, 85% of every crate bought with paid Nexus): new LT are released
//     into the pool at today's price, so the price doesn't move.
//   - Players earn LT: it leaves the pool. Players spend LT (fuel, upgrades, the station...): it
//     goes back into the pool. Neither changes the total, so the price doesn't move.
//   - A player swaps LT for Nexus: the dollars behind those LT leave the treasury with the
//     Nexus, and the LT go back on hold ("waiting"). They are released into the pool again as
//     the next money comes in. The price doesn't move.
// When the pool runs low, payouts shrink so the pool can never run dry.

export const TREASURY = {
  startPrice: 0.0001, // dollars per LT before any money has come in: 10,000 LT = $1
  crateShare: 0.85, // of every paid Nexus spent on crates, this share goes into the treasury
  nexusUsd: 1, // 1 Nexus = $1
  lowPool: 0.1, // payouts shrink once the pool is under 10% of all LT
  minRate: 0.25, // ... but never below 25%
  maxSync: 100000, // the most LT one sync can report
  minCashout: 1, // Nexus
};

const cents = (n) => Math.round(n * 100) / 100;
const tenth = (n) => Math.round(n * 10) / 10;

export const emptyTreasury = () => ({ usd: 0, supply: 0, pool: 0, waiting: 0, inTotal: 0, donated: 0, crateIn: 0, house: 0, swappedUsd: 0, cashedOut: 0, funded: false });

export const priceOf = (t) => (t.supply > 0 ? t.usd / t.supply : TREASURY.startPrice);
export const heldOf = (t) => Math.max(0, t.supply - t.pool);

// How much of a payout the pool can cover right now (1 = full pay).
export function payoutRate(t) {
  if (!t.funded || t.supply <= 0) return 0;
  const low = TREASURY.lowPool * t.supply;
  return t.pool >= low ? 1 : Math.max(TREASURY.minRate, t.pool / low);
}

// Money in. Returns the LT released into the pool.
export function moneyIn(t, usd, kind = 'deposit') {
  if (!(usd > 0)) return 0;
  const price = priceOf(t);
  const lt = tenth(usd / price);
  t.usd += usd;
  t.supply += lt;
  t.pool += lt;
  t.waiting = Math.max(0, t.waiting - lt); // LT on hold from swaps come back first
  t.inTotal = cents(t.inTotal + usd);
  if (kind === 'deposit') t.donated = cents(t.donated + usd);
  else t.crateIn = cents(t.crateIn + usd);
  t.funded = true;
  return lt;
}

// A crate bought with paid Nexus: 85% to the treasury, 15% to the house.
export function crateSale(t, paidNexus) {
  const usd = paidNexus * TREASURY.nexusUsd;
  const share = cents(usd * TREASURY.crateShare);
  t.house = cents(t.house + usd - share);
  return moneyIn(t, share, 'crate');
}

// A player earned `lt`: paid from the pool, scaled down if the pool is low. Returns what was paid.
export function earn(t, lt) {
  const want = Math.max(0, Math.min(lt, TREASURY.maxSync));
  const paid = tenth(Math.min(want * payoutRate(t), t.pool));
  t.pool -= paid;
  return paid;
}

// A player spent `lt` in the game: back into the pool.
export function spend(t, lt) {
  const back = tenth(Math.max(0, Math.min(lt, heldOf(t))));
  t.pool += back;
  return back;
}

// Swap LT for Nexus at today's price. Nexus are whole cents, so only the LT those cents are worth
// are used (the rest stay with the player). Returns { nexus, used }.
export function swap(t, lt) {
  const price = priceOf(t);
  const nexus = Math.floor(((lt * price) / TREASURY.nexusUsd) * 100) / 100;
  if (!(nexus >= 0.01)) return { nexus: 0, used: 0 };
  const used = Math.min(lt, Math.ceil(((nexus * TREASURY.nexusUsd) / price) * 10) / 10);
  t.usd -= nexus * TREASURY.nexusUsd;
  t.supply -= used;
  t.waiting += used;
  t.swappedUsd = cents(t.swappedUsd + nexus * TREASURY.nexusUsd);
  return { nexus, used };
}

// LT needed for a Nexus amount at today's price (for the swap form).
export const ltFor = (t, nexus) => Math.ceil((nexus * TREASURY.nexusUsd) / priceOf(t) * 10) / 10;

export function summary(t) {
  const price = priceOf(t);
  return {
    usd: cents(t.usd),
    price,
    ltPerDollar: Math.round(1 / price),
    supply: tenth(t.supply),
    pool: tenth(t.pool),
    held: tenth(heldOf(t)),
    waiting: tenth(t.waiting),
    rate: payoutRate(t),
    inTotal: t.inTotal,
    donated: t.donated,
    crateIn: t.crateIn,
    house: t.house,
    swappedUsd: t.swappedUsd,
    cashedOut: t.cashedOut,
    funded: t.funded,
  };
}

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Banknote, Check, Coins, Gem, HandCoins, Landmark, PiggyBank, RefreshCw, TrendingUp, Trophy, X } from 'lucide-react';
import { useGame } from '../state/store.jsx';
import { api } from '../net/api.js';
import { TREASURY } from '../game/treasury.js';
import { fmt, lt as ltFmt } from '../ui/format.js';
import CountUp from '../ui/CountUp.jsx';
import TreasuryChart from '../ui/TreasuryChart.jsx';
import { Leaderboard, usd } from '../ui/TreasuryBits.jsx';
import { VenmoSteps, markTreasuryVisited, showIntro } from '../ui/Intro.jsx';

// The LocoToken treasury: what backs every LT, what one LT is worth, what you've earned, and where
// you swap LT for Nexus and ask to cash Nexus out.

export { usd };
const when = (t) => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const EVENT = { deposit: 'Money in', crate: 'Crate sale (85%)', swap: 'Swapped to Nexus' };

function Stat({ label, value, sub, tone = '', big = false }) {
  return (
    <div className={`tr-stat ${tone} ${big ? 'tr-big' : ''}`}>
      <span className="tr-label">{label}</span>
      <b className="num">{value}</b>
      {sub ? <span className="tr-sub">{sub}</span> : null}
    </div>
  );
}

export default function Treasury() {
  const { conductor, account, notify, swapLt, syncLt, bank, treasuryFunded } = useGame();
  const [data, setData] = useState(null);
  const [swapAmt, setSwapAmt] = useState('');
  const [cashAmt, setCashAmt] = useState('');
  const [confirm, setConfirm] = useState(null); // 'swap' | 'cash'
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    await syncLt();
    try {
      setData(await api('/api/treasury'));
    } catch (e) {
      notify(e.message, 'error');
    }
  }, [notify, syncLt]);
  useEffect(() => markTreasuryVisited(), []);
  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  const t = data?.treasury;
  const me = data?.me;
  const price = t?.price ?? TREASURY.startPrice;
  const captainLt = conductor?.lt ?? 0;
  const swapLtN = Math.round(Number(swapAmt) * 10) / 10;
  const swapNexus = Math.floor(swapLtN * price * 100) / 100;
  const swapUsed = swapNexus > 0 ? Math.min(swapLtN, Math.ceil((swapNexus / price) * 10) / 10) : 0;
  const cashN = Math.round(Number(cashAmt) * 100) / 100;
  const poolShare = t && t.supply > 0 ? t.pool / t.supply : 0;

  const doSwap = async () => {
    setBusy(true);
    const reply = await swapLt(swapLtN);
    setBusy(false);
    setConfirm(null);
    if (reply) {
      notify(`Swapped ${ltFmt(reply.lt)} LT for ${reply.nexus} Nexus.`, 'good');
      setSwapAmt('');
      load();
    }
  };
  const doCash = async () => {
    setBusy(true);
    const reply = await bank('/api/treasury/cashout', { nexus: cashN });
    setBusy(false);
    setConfirm(null);
    if (reply) {
      notify(`Cash-out request #${reply.id} sent: ${reply.nexus} Nexus (${usd(reply.nexus * TREASURY.nexusUsd)}).`, 'good');
      setCashAmt('');
      load();
    }
  };

  const periods = useMemo(
    () => [
      ['week', 'This week'],
      ['month', 'This month'],
      ['year', 'This year'],
      ['all', 'All time'],
    ],
    [],
  );

  return (
    <div className="stack treasury">
      <header className="stack-sm">
        <span className="eyebrow">
          <Landmark aria-hidden="true" /> Nexus Rail treasury
        </span>
        <h1>Treasury</h1>
        <p className="muted">
          Real money backs every LocoToken. Jobs, contracts and prize races pay out of the treasury's LT pool, and what you spend in the game goes back into it. One LT is worth the dollars in the treasury divided by
          all the LT in existence.
        </p>
      </header>

      {t && !t.funded ? (
        <div className="note warn">The treasury opens when the first money comes in. Until then your LT earnings wait and are counted as soon as it opens.</div>
      ) : null}
      {t && t.funded && t.rate < 1 ? (
        <div className="note warn">The LT pool is running low: jobs and races pay {Math.round(t.rate * 100)}% until more money comes in.</div>
      ) : null}

      <section className="plate stack" aria-labelledby="tr-dash">
        <div className="plate-head">
          <h2 id="tr-dash">Dashboard</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={load} aria-label="Refresh">
            <RefreshCw aria-hidden="true" />
          </button>
        </div>
        <div className="tr-hero">
          <Stat big label="Available to earn" value={t ? <CountUp value={t.usd} format={usd} duration={1600} /> : '…'} sub="Dollars in the treasury backing every LT" tone="gold" />
          <Stat big label="1 LT is worth" value={t ? usd(price) : '…'} sub={t ? `${fmt(t.ltPerDollar)} LT = $1` : ''} tone="cyan" />
        </div>
        <div className="tr-pool" aria-label={`LT pool ${Math.round(poolShare * 100)} percent of all LT`}>
          <div className="spread small">
            <span>
              <b>LT pool</b> <span className="muted">(ready to pay jobs and races)</span>
            </span>
            <span className="num">{t ? `${fmt(t.pool)} LT · ${usd(t.pool * price)}` : '…'}</span>
          </div>
          <div className="tr-bar">
            <i style={{ width: `${Math.round(poolShare * 100)}%` }} />
            <em style={{ left: `${TREASURY.lowPool * 100}%` }} title="Payouts shrink below this line" />
          </div>
          <div className="spread small muted">
            <span>Held by players {t ? `${fmt(t.held)} LT` : ''}</span>
            <span>Payouts at {t ? `${Math.round(t.rate * 100)}%` : '…'}</span>
          </div>
        </div>
        <div className="tr-grid">
          <Stat label="LT in existence" value={t ? fmt(t.supply) : '…'} />
          <Stat label="LT on hold" value={t ? fmt(t.waiting) : '…'} sub="Swapped for Nexus; back in the pool as money comes in" />
          <Stat label="Money in, all time" value={t ? <CountUp value={t.inTotal} format={usd} /> : '…'} sub={t ? `${usd(t.donated)} deposits · ${usd(t.crateIn)} from crates` : ''} />
          <Stat label="House share" value={t ? usd(t.house) : '…'} sub="15% of crate sales" />
          <Stat label="Swapped to Nexus" value={t ? usd(t.swappedUsd) : '…'} />
          <Stat label="Cashed out" value={t ? usd(t.cashedOut) : '…'} />
        </div>
      </section>

      <div className="cols">
        <section className="plate stack-sm" aria-labelledby="tr-growth">
          <h2 id="tr-growth">
            <TrendingUp aria-hidden="true" /> Treasury growth
          </h2>
          <p className="small muted">Dollars in the treasury over time. It grows with every deposit and crate sale, and dips when players swap LT for Nexus.</p>
          <TreasuryChart history={data?.history} />
        </section>
        <section className="plate stack-sm" aria-labelledby="tr-top">
          <h2 id="tr-top">
            <Trophy aria-hidden="true" /> Top earners
          </h2>
          <p className="small muted">Ranked by the dollar value of the LT earned from jobs, contracts and races.</p>
          <Leaderboard leaders={data?.leaders} />
        </section>
      </div>

      <section className="plate stack" aria-labelledby="tr-me">
        <h2 id="tr-me">Your LocoTokens</h2>
        <div className="tr-hero">
          <Stat big label={`${conductor?.name ?? 'Captain'}'s LT`} value={<CountUp value={captainLt} format={(v) => `${ltFmt(v)} LT`} />} sub={`Worth ${usd(captainLt * price)} today`} tone="cyan" />
          <Stat big label="Your Nexus" value={me ? fmt(me.nexus, 2) : '…'} sub={me ? `${fmt(me.paid, 2)} paid (cashable) · ${fmt(me.bonus, 2)} gift (crates only)` : ''} tone="arcane" />
        </div>
        {!treasuryFunded ? <p className="small muted">Some of your LT are waiting for the treasury to open.</p> : null}
        <h3 className="tr-h3">Earnings</h3>
        <div className="tr-earn">
          {periods.map(([key, label]) => (
            <div className="tr-earn-cell" key={key}>
              <span className="tr-label">{label}</span>
              <b className="num">{me ? <CountUp value={me.earned[key].usd} format={usd} /> : '…'}</b>
              <span className="tr-sub num">{me ? `${ltFmt(me.earned[key].lt)} LT` : ''}</span>
            </div>
          ))}
        </div>
        <p className="small muted">LT earned from jobs, contracts and races (all your Captains), valued at today's price. Week, month and year are the last 7, 30 and 365 days.</p>
      </section>

      <section className="plate stack-sm" aria-labelledby="tr-buy">
        <div className="plate-head">
          <h2 id="tr-buy">
            <Gem aria-hidden="true" /> Get more Nexus
          </h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={showIntro}>
            Show the intro again
          </button>
        </div>
        <VenmoSteps name={account?.player?.name} />
      </section>

      <div className="cols">
        <section className="plate stack-sm" aria-labelledby="tr-swap">
          <h2 id="tr-swap">
            <ArrowRightLeft aria-hidden="true" /> Swap LT for Nexus
          </h2>
          <p className="small muted">At today's price. Nexus buy crates, go to other players, or cash out. The LT you swap go back into the pool as new money comes in.</p>
          <label className="stack-xs">
            <span className="label">LT to swap</span>
            <input className="field" type="number" min="0" step="100" inputMode="decimal" value={swapAmt} onChange={(e) => setSwapAmt(e.target.value)} placeholder={`Up to ${ltFmt(captainLt)}`} />
          </label>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {[0.25, 0.5, 1].map((f) => (
              <button type="button" className="btn btn-sm" key={f} onClick={() => setSwapAmt(String(Math.floor(captainLt * f * 10) / 10))}>
                {f === 1 ? 'All' : `${f * 100}%`}
              </button>
            ))}
          </div>
          <div className="tr-quote">
            <span>You get</span>
            <b className="num">
              <Gem aria-hidden="true" /> {fmt(swapNexus, 2)} Nexus
            </b>
            <span className="muted small">
              {usd(swapNexus * TREASURY.nexusUsd)}
              {swapUsed > 0 && swapUsed < swapLtN - 0.05 ? ` · uses ${ltFmt(swapUsed)} LT (Nexus are whole cents)` : ''}
            </span>
          </div>
          {confirm === 'swap' ? (
            <div className="tr-confirm">
              <p className="small">
                Swap <b>{ltFmt(swapUsed)} LT</b> from {conductor?.name} for <b>{fmt(swapNexus, 2)} Nexus</b>? This can't be undone.
              </p>
              <div className="row" style={{ gap: 6 }}>
                <button type="button" className="btn btn-arcane" disabled={busy} onClick={doSwap}>
                  <Check aria-hidden="true" /> Swap
                </button>
                <button type="button" className="btn" onClick={() => setConfirm(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-arcane btn-block" disabled={!t?.funded || !(swapNexus >= 0.01) || swapLtN > captainLt + 0.01} onClick={() => setConfirm('swap')}>
              Review swap
            </button>
          )}
        </section>

        <section className="plate stack-sm" aria-labelledby="tr-cash">
          <h2 id="tr-cash">
            <Banknote aria-hidden="true" /> Cash out Nexus
          </h2>
          <p className="small muted">1 Nexus = $1. Paid Nexus only (from buy-ins, swaps and other players). The Nexus leave your balance now; the admin team pays you and marks the request paid, or turns it down and the Nexus come back.</p>
          <label className="stack-xs">
            <span className="label">Nexus to cash out</span>
            <input className="field" type="number" min={TREASURY.minCashout} step="1" inputMode="decimal" value={cashAmt} onChange={(e) => setCashAmt(e.target.value)} placeholder={me ? `Up to ${fmt(me.paid, 2)}` : ''} />
          </label>
          {confirm === 'cash' ? (
            <div className="tr-confirm">
              <p className="small">
                Ask to cash out <b>{fmt(cashN, 2)} Nexus</b> for <b>{usd(cashN * TREASURY.nexusUsd)}</b>?
              </p>
              <div className="row" style={{ gap: 6 }}>
                <button type="button" className="btn btn-arcane" disabled={busy} onClick={doCash}>
                  <Check aria-hidden="true" /> Send request
                </button>
                <button type="button" className="btn" onClick={() => setConfirm(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-block" disabled={!me || !(cashN >= TREASURY.minCashout) || cashN > me.paid} onClick={() => setConfirm('cash')}>
              <HandCoins aria-hidden="true" /> Review cash-out
            </button>
          )}
          {me?.cashouts?.length ? (
            <div className="small num ledger">
              {me.cashouts.map((c) => (
                <div className="spread" key={c.id}>
                  <span>
                    <span className="muted">{when(c.at)}</span> #{c.id} · {fmt(c.nexus, 2)} Nexus
                  </span>
                  <span className={`tr-status st-${c.status}`}>{c.status === 'rejected' ? 'turned down' : c.status}</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      <section className="plate stack-sm" aria-labelledby="tr-log">
        <h2 id="tr-log">
          <Coins aria-hidden="true" /> Treasury activity
        </h2>
        <div className="small num ledger">
          {data?.events?.length
            ? data.events.map((e, i) => (
                <div className="spread" key={i}>
                  <span>
                    <span className="muted">{when(e.at)}</span> {EVENT[e.kind]}
                    {e.kind !== 'deposit' && e.who ? ` · ${e.who}` : ''}
                    {e.kind === 'deposit' && e.note && e.note !== 'deposit' ? ` · ${e.note}` : ''}
                    {e.kind === 'crate' && e.note ? ` · ${e.note}` : ''}
                  </span>
                  <span className={e.kind === 'swap' ? 'stop' : 'go'}>
                    {e.kind === 'swap' ? '−' : '+'}
                    {usd(e.usd)} · {fmt(e.lt)} LT
                  </span>
                </div>
              ))
            : 'Nothing yet.'}
        </div>
      </section>

      {account?.admin ? <TreasuryAdmin onChange={load} /> : null}
    </div>
  );
}

export function TreasuryAdmin({ onChange }) {
  const { notify } = useGame();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [list, setList] = useState(null);
  const [sure, setSure] = useState(false);
  const loadList = useCallback(() => {
    api('/api/admin/cashouts')
      .then(setList)
      .catch((e) => notify(e.message, 'error'));
  }, [notify]);
  useEffect(() => loadList(), [loadList]);
  const n = Math.round(Number(amount) * 100) / 100;
  const deposit = async () => {
    try {
      const reply = await api('/api/admin/deposit', { usd: n, note });
      notify(`Deposited ${usd(n)}: ${fmt(reply.released)} LT released into the pool.`, 'good');
      setAmount('');
      setNote('');
      setSure(false);
      onChange();
    } catch (e) {
      notify(e.message, 'error');
    }
  };
  const decide = async (c, action) => {
    try {
      await api(`/api/admin/cashouts/${c.id}`, { action });
      notify(action === 'paid' ? `Request #${c.id} marked paid.` : `Request #${c.id} turned down; ${c.nexus} Nexus returned to ${c.player}.`, 'good');
      loadList();
      onChange();
    } catch (e) {
      notify(e.message, 'error');
    }
  };
  const pending = (list ?? []).filter((c) => c.status === 'pending');
  const done = (list ?? []).filter((c) => c.status !== 'pending').slice(0, 15);
  return (
    <section className="plate stack" aria-labelledby="tr-admin">
      <h2 id="tr-admin">
        <Landmark aria-hidden="true" /> Admin: treasury
      </h2>
      <div className="stack-sm">
        <h3 className="tr-h3">
          <PiggyBank aria-hidden="true" /> Deposit money
        </h3>
        <p className="small muted">Record real dollars you put into the treasury. New LT are released into the pool at today's price, so the LT price doesn't change.</p>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input className="field" style={{ maxWidth: 140 }} type="number" min="1" step="1" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Dollars" aria-label="Dollars to deposit" />
          <input className="field" style={{ flex: 1, minWidth: 160 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" maxLength={80} aria-label="Deposit note" />
          {sure ? (
            <>
              <button type="button" className="btn btn-arcane" onClick={deposit}>
                Deposit {usd(n)}
              </button>
              <button type="button" className="btn" onClick={() => setSure(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-arcane" disabled={!(n > 0)} onClick={() => setSure(true)}>
              Review deposit
            </button>
          )}
        </div>
      </div>
      <div className="stack-sm">
        <h3 className="tr-h3">
          <HandCoins aria-hidden="true" /> Cash-out requests
        </h3>
        {pending.length ? (
          <div className="admin-list">
            {pending.map((c) => (
              <article className="admin-row" key={c.id}>
                <div className="admin-who">
                  <b>
                    #{c.id} {c.player}
                  </b>
                  <span className="small muted">
                    {c.email ?? ''} · {when(c.at)}
                  </span>
                </div>
                <div className="admin-bal num">
                  {fmt(c.nexus, 2)} Nexus · {usd(c.nexus * TREASURY.nexusUsd)}
                </div>
                <div className="admin-act">
                  <button type="button" className="btn btn-arcane" onClick={() => decide(c, 'paid')}>
                    <Check aria-hidden="true" /> I paid this
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => decide(c, 'rejected')}>
                    <X aria-hidden="true" /> Turn down
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="small muted">No requests waiting.</p>
        )}
        {done.length ? (
          <div className="small num ledger">
            {done.map((c) => (
              <div className="spread" key={c.id}>
                <span>
                  <span className="muted">{when(c.decidedAt ?? c.at)}</span> #{c.id} {c.player} · {fmt(c.nexus, 2)} Nexus
                </span>
                <span className={`tr-status st-${c.status}`}>{c.status === 'rejected' ? 'turned down' : c.status}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

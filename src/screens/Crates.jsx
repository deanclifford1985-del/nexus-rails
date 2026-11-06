import React, { useEffect, useMemo, useState } from 'react';
import { Box, Gem, KeyRound, LogOut, Search, Send, ShieldAlert, Sparkles, TrainFront, User } from 'lucide-react';
import { useGame } from '../state/store.jsx';
import { CRATE_TIERS, PICK_PREMIUM, TIER_IDS, WELCOME_NEXUS, cratePrice, crewOf, remaining } from '../game/crates.js';
import { MODELS } from '../game/locomotives.js';
import { TRAITS } from '../game/traits.js';
import { api } from '../net/api.js';
import { RarityTag } from '../ui/bits.jsx';
import { fmt } from '../ui/format.js';

const TABS = [
  { id: 'crates', label: 'Crates', icon: Box },
  { id: 'vault', label: 'Vault', icon: Gem },
  { id: 'crew', label: 'Crew', icon: User },
  { id: 'send', label: 'Send', icon: Send },
  { id: 'admin', label: 'Admin', icon: KeyRound, admin: true },
];

const when = (at) => new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
function ledgerLabel(row) {
  if (row.type === 'grant') return row.note === 'welcome' ? 'Welcome gift' : `Admin award${row.note && row.note !== 'admin award' ? `: ${row.note}` : ''}`;
  if (row.type === 'trade') return `${row.nexus < 0 ? 'Sent to' : 'From'} ${row.other ?? 'a player'}${row.note ? ` · ${row.note}` : ''}`;
  return `${CRATE_TIERS[row.tier]?.name ?? 'Crate'}${row.picked ? ' (picked)' : ''}`;
}

export function Ledger({ rows, limit = 15 }) {
  return (
    <div className="small num ledger">
      {rows.length
        ? [...rows].reverse().slice(0, limit).map((row, i) => (
            <div className="spread" key={i}>
              <span>
                <span className="muted">{when(row.at)}</span> {ledgerLabel(row)}
              </span>
              <span className={row.nexus < 0 ? 'stop' : 'go'}>
                {row.nexus > 0 ? '+' : ''}
                {row.nexus}
              </span>
            </div>
          ))
        : 'Nothing yet.'}
    </div>
  );
}

// Your player name (what others type to send you Nexus), and sending Nexus to another player.
function SendPanel() {
  const { vault, account, bank, notify, refreshVault } = useGame();
  const [name, setName] = useState(account?.player?.name ?? '');
  useEffect(() => {
    refreshVault();
  }, [refreshVault]);
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [matches, setMatches] = useState([]);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (to.trim().length < 2) return setMatches([]);
    const timer = setTimeout(() => {
      api(`/api/players?q=${encodeURIComponent(to.trim())}`)
        .then((list) => setMatches(list.filter((p) => p.id !== account?.player?.id)))
        .catch(() => setMatches([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [to, account]);
  const n = Math.round(Number(amount) * 100) / 100;
  const ok = to.trim() && n > 0 && n <= vault.nexus;
  return (
    <div className="grid">
      <section className="plate stack-sm">
        <h2>Your player name</h2>
        <p className="small muted">Other players type this to send you Nexus.</p>
        <form
          className="row"
          onSubmit={async (e) => {
            e.preventDefault();
            if ((await bank('/api/name', { name })) !== null) notify('Player name saved.', 'good');
          }}
        >
          <input className="field grow" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} aria-label="Your player name" />
          <button type="submit" className="btn" disabled={name.trim() === account?.player?.name}>
            Save
          </button>
        </form>
        {account?.signOut ? (
          <button type="button" className="btn btn-ghost" onClick={() => account.signOut()}>
            <LogOut aria-hidden="true" /> Sign out
          </button>
        ) : null}
      </section>
      <section className="plate stack-sm">
        <h2>Send Nexus</h2>
        <p className="small muted">Straight to another player, no fee. You have {vault.nexus.toLocaleString()} Nexus.</p>
        {!confirm ? (
          <form
            className="stack-sm"
            onSubmit={(e) => {
              e.preventDefault();
              if (ok) setConfirm(true);
            }}
          >
            <label className="label" htmlFor="send-to">
              To (player name)
            </label>
            <input id="send-to" className="field" value={to} onChange={(e) => setTo(e.target.value)} list="send-matches" autoComplete="off" placeholder="Their player name" />
            <datalist id="send-matches">
              {matches.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
            <label className="label" htmlFor="send-amount">
              Amount
            </label>
            <input id="send-amount" className="field" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Nexus" />
            <label className="label" htmlFor="send-note">
              Note (optional)
            </label>
            <input id="send-note" className="field" value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} placeholder="What it's for" />
            <button type="submit" className="btn btn-arcane" disabled={!ok}>
              <Send aria-hidden="true" /> Review send
            </button>
            {n > vault.nexus ? <span className="small stop">That's more than you have.</span> : null}
          </form>
        ) : (
          <div className="stack-sm">
            <p>
              Send <b>{n.toLocaleString()} Nexus</b> to <b>{to.trim()}</b>? This can't be undone.
            </p>
            <div className="row">
              <button
                type="button"
                className="btn btn-arcane grow"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const reply = await bank('/api/send', { to: to.trim(), amount: n, note });
                  setBusy(false);
                  setConfirm(false);
                  if (reply) {
                    notify(`Sent ${reply.sent} Nexus to ${reply.to.name}.`, 'good');
                    setAmount('');
                    setNote('');
                  }
                }}
              >
                {busy ? 'Sending…' : 'Send it'}
              </button>
              <button type="button" className="btn" onClick={() => setConfirm(false)}>
                Back
              </button>
            </div>
          </div>
        )}
      </section>
      <section className="plate stack-sm">
        <h2>History</h2>
        <Ledger rows={vault.ledger} />
      </section>
    </div>
  );
}

function NftCard({ nft, children }) {
  const d = nft.data;
  return (
    <article className={`plate nft-card nft-${nft.tier}`}>
      <div className="spread">
        <span className="label">{nft.id}</span>
        <RarityTag rarity={CRATE_TIERS[nft.tier].rarity} />
      </div>
      {nft.kind === 'loco' ? (
        <>
          <h3>
            <TrainFront aria-hidden="true" style={{ width: 16, height: 16, verticalAlign: '-2px' }} /> {d.name}
          </h3>
          <span className="small muted">{MODELS[d.model]?.name} locomotive{d.superTrait ? ' · super trait' : ''}{d.journey ? ' · the Journey' : ''}</span>
          <div className="nft-stats num">
            <span>PWR {d.power}</span>
            <span>EFF {d.efficiency}</span>
            <span>ARM {d.durability}</span>
            <span>END {d.endurance}</span>
          </div>
        </>
      ) : (
        <>
          <h3>
            <User aria-hidden="true" style={{ width: 16, height: 16, verticalAlign: '-2px' }} /> {d.name}
          </h3>
          <span className="small muted">Conductor</span>
          <div className="nft-stats num">
            <span>STR {d.str}</span>
            <span>AGI {d.agi}</span>
            <span>INT {d.int}</span>
            <span>END {d.end}</span>
          </div>
          <div className="row" style={{ gap: 4 }}>
            {d.traits.map((t) => (
              <span className="trait-chip" key={t} title={TRAITS[t]?.text}>
                {TRAITS[t]?.name ?? t}
              </span>
            ))}
          </div>
        </>
      )}
      {children}
    </article>
  );
}

// Admin: every player, their balance, and awards. Server-checked: only admin accounts can use it.
// Used on the Crates screen and on its own at /#admin.
export function AdminPanel() {
  const { account, notify } = useGame();
  const [q, setQ] = useState('');
  const [players, setPlayers] = useState(null);
  const [amounts, setAmounts] = useState({});
  const [notes, setNotes] = useState({});
  const [open, setOpen] = useState(null);
  const [history, setHistory] = useState([]);
  const load = (text = q) =>
    api(`/api/admin/players?q=${encodeURIComponent(text)}`)
      .then(setPlayers)
      .catch((e) => notify(e.message, 'error'));
  useEffect(() => {
    if (!account?.admin) return undefined;
    const timer = setTimeout(() => load(q), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, account]);
  if (!account?.admin)
    return (
      <section className="plate stack-sm" style={{ maxWidth: 560 }}>
        <h2>Admins only</h2>
        <p className="muted">This account isn't an admin. Sign in with an admin account to award Nexus.</p>
      </section>
    );
  const award = async (p, value) => {
    const amount = Math.round(Number(value) * 100) / 100;
    if (!(amount > 0)) return notify('Enter an amount above zero.', 'error');
    try {
      const reply = await api('/api/admin/award', { playerId: p.id, amount, note: notes[p.id] ?? '' });
      notify(`Awarded ${amount} Nexus to ${reply.player.name}.`, 'good');
      setAmounts((a) => ({ ...a, [p.id]: '' }));
      load();
      if (open === p.id) setHistory(await api(`/api/admin/ledger/${encodeURIComponent(p.id)}`));
    } catch (e) {
      notify(e.message, 'error');
    }
  };
  return (
    <section className="plate stack-sm">
      <div className="spread">
        <h2>Players</h2>
        <span className="chip">{players ? players.length : '…'} shown</span>
      </div>
      <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by player name or email" aria-label="Search players" />
      <div className="admin-list">
        {(players ?? []).map((p) => (
          <article className="admin-row" key={p.id}>
            <div className="admin-who">
              <b>{p.name}</b>
              <span className="small muted">{p.email ?? 'no email'}</span>
              <span className="small muted">
                {p.nfts} NFT{p.nfts === 1 ? '' : 's'} · last seen {when(p.lastSeen)}
              </span>
            </div>
            <div className="admin-bal num">
              <Gem aria-hidden="true" /> {p.nexus.toLocaleString()}
            </div>
            <div className="admin-act">
              <button type="button" className="btn btn-arcane" onClick={() => award(p, 25)}>
                +25
              </button>
              <input className="field" type="number" min="1" step="1" value={amounts[p.id] ?? ''} onChange={(e) => setAmounts((a) => ({ ...a, [p.id]: e.target.value }))} placeholder="Amount" aria-label={`Amount for ${p.name}`} />
              <button type="button" className="btn" onClick={() => award(p, amounts[p.id])}>
                Award
              </button>
              <input className="field admin-note" value={notes[p.id] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))} placeholder="Note (optional)" aria-label={`Note for ${p.name}`} maxLength={80} />
              <button
                type="button"
                className="btn btn-ghost"
                onClick={async () => {
                  if (open === p.id) return setOpen(null);
                  setOpen(p.id);
                  setHistory(await api(`/api/admin/ledger/${encodeURIComponent(p.id)}`).catch(() => []));
                }}
              >
                {open === p.id ? 'Hide history' : 'History'}
              </button>
            </div>
            {open === p.id ? (
              <div className="admin-history">
                <Ledger
                  rows={history.map((r) => ({ at: r.at, type: r.kind, nexus: r.from_id === p.id && r.kind !== 'grant' ? -r.amount : r.amount, note: r.note, tier: r.tier, picked: r.picked, other: r.from_id === p.id ? r.to_name : r.from_name }))}
                  limit={30}
                />
              </div>
            ) : null}
          </article>
        ))}
        {players && !players.length ? <p className="muted">No players match.</p> : null}
      </div>
    </section>
  );
}

export default function Crates() {
  const { conductor, vault, deploy, act, notify, screen, account, openCrateFor, refreshVault } = useGame();
  const [busy, setBusy] = useState(false);
  // Pools are shared by every player: refresh when the screen opens.
  useEffect(() => {
    refreshVault();
  }, [refreshVault]);
  const [tab, setTab] = useState(screen.tab ?? 'crates');
  const [browse, setBrowse] = useState(null); // tier whose pool is open for picking
  const [reveal, setReveal] = useState(null);
  const saveId = conductor.createdAt;

  const open = async (tier, pickId = null) => {
    if (busy) return;
    setBusy(true);
    const nft = await openCrateFor({ tier, pickId, needLoco: !conductor.locos.length });
    setBusy(false);
    if (nft) {
      setBrowse(null);
      setReveal(nft);
    }
  };
  const pool = useMemo(() => (browse ? remaining(vault, browse) : []), [browse, vault]);

  return (
    <div className="stack">
      <div className="page-head">
        <h1>
          Nexus <span className="hl-purple">Crates</span>
        </h1>
        <p>
          Season 1 crates, opened with Nexus. Each tier is a visible pool that shrinks as crates are opened by anyone; every NFT in a tier has the same stat budget, spent differently. Open one at random, or pay {Math.round(PICK_PREMIUM * 100)}% more to pick exactly the one you want.
        </p>
        <p className="note warn small">
          <ShieldAlert aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> Test build: Nexus and NFTs are kept on the Nexus Rail server with your account. Nothing here is on a blockchain yet.
        </p>
      </div>

      <div className="tabs" role="tablist" aria-label="Nexus">
        {TABS.filter((t) => !t.admin || account?.admin).map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="tab" onClick={() => setTab(t.id)}>
            <t.icon aria-hidden="true" />
            {t.label}
            {t.id === 'vault' ? <span className="tab-count">{vault.owned.length}</span> : null}
          </button>
        ))}
      </div>

      {reveal ? (
        <div className="crate-reveal" role="dialog" aria-label="Crate opened">
          <div className="crate-burst" aria-hidden="true" />
          <span className="label">
            <Sparkles aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> You opened {reveal.tier === "epic" || reveal.tier === "uncommon" ? "an" : "a"} {CRATE_TIERS[reveal.tier].name}
          </span>
          <NftCard nft={reveal}>
            <div className="row">
              <button type="button" className="btn btn-arcane grow" onClick={async () => {
                  if (await deploy(reveal.id)) {
                    notify('Sent to your Captain.', 'good');
                    setReveal(null);
                  }
                }}>
                Send to {conductor.captain?.name ?? 'Captain'}
              </button>
              <button type="button" className="btn" onClick={() => setReveal(null)}>
                Keep in Vault
              </button>
            </div>
          </NftCard>
        </div>
      ) : null}

      {tab === 'crates' && !conductor.locos.length ? (
        <p className="note">
          <TrainFront aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> Your garage is empty. Every Captain's first locomotive comes out of a crate, and while your garage is empty a crate always holds a locomotive. You start with {WELCOME_NEXUS} Nexus: enough for an Uncommon crate. Open it and send the locomotive to {conductor.captain?.name ?? 'your Captain'}. {vault.nexus < cratePrice('uncommon') ? 'More Nexus is awarded by the admin team.' : ''}
        </p>
      ) : null}

      {tab === 'crates' ? (
        <>
          <div className="row" style={{ gap: 8 }}>
            <span className="chip chip-nexus">
              <Gem aria-hidden="true" /> {vault.nexus.toLocaleString()} Nexus
            </span>
            <span className="chip">Burned so far: {fmt(vault.burned ?? 0, 1)}</span>
          </div>
          <div className="grid">
            {TIER_IDS.map((tier) => {
              const T = CRATE_TIERS[tier];
              const left = remaining(vault, tier).length;
              return (
                <article className={`plate riveted stack-sm crate-card crate-${tier}`} key={tier}>
                  <div className="spread">
                    <h3>
                      <Box aria-hidden="true" style={{ width: 18, height: 18, verticalAlign: '-3px' }} /> {T.name}
                    </h3>
                    <RarityTag rarity={T.rarity} />
                  </div>
                  <span className="small muted">
                    Locomotives with {T.locoBudget} stat points, or conductors with {T.crewBudget} attribute points and {T.traits} trait{T.traits === 1 ? '' : 's'}.
                  </span>
                  <div className="pool-meter" aria-label={`${left} of ${T.pool} left`}>
                    <i style={{ width: `${(left / T.pool) * 100}%` }} />
                  </div>
                  <span className="small num">
                    {left} of {T.pool} left this season
                  </span>
                  <div className="row">
                    <button type="button" className="btn btn-arcane grow" disabled={busy || !left || vault.nexus < cratePrice(tier)} onClick={() => open(tier)}>
                      Open for {cratePrice(tier)} Nexus
                    </button>
                    <button type="button" className="btn" disabled={!left} onClick={() => setBrowse(browse === tier ? null : tier)}>
                      <Search aria-hidden="true" />
                      Pick ({cratePrice(tier, true)})
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          {browse ? (
            <section className="stack">
              <h2>Pick from the {CRATE_TIERS[browse].name} pool</h2>
              <div className="grid">
                {pool.map((entry) => (
                  <NftCard nft={entry} key={entry.id}>
                    <button type="button" className="btn btn-arcane btn-block" disabled={busy || vault.nexus < cratePrice(browse, true)} onClick={() => open(browse, entry.id)}>
                      Take this one for {cratePrice(browse, true)} Nexus
                    </button>
                  </NftCard>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {tab === 'vault' ? (
        vault.owned.length ? (
          <div className="grid">
            {vault.owned.map((nft) => (
              <NftCard nft={nft} key={nft.id}>
                {nft.deployedTo ? (
                  <span className="note small">{nft.deployedTo === saveId ? `With ${conductor.captain?.name ?? 'this Captain'}` : 'With another Captain'}</span>
                ) : (
                  <button type="button" className="btn btn-arcane btn-block" onClick={async () => (await deploy(nft.id)) && notify('Sent to your Captain.', 'good')}>
                    Send to {conductor.captain?.name ?? 'Captain'}
                  </button>
                )}
              </NftCard>
            ))}
          </div>
        ) : (
          <p className="note">Your Vault is empty. Open a crate to get your first NFT.</p>
        )
      ) : null}

      {tab === 'crew' ? (
        <section className="stack">
          <p className="muted">Each locomotive needs a conductor at the controls. The conductor in your active locomotive sets the Strength, Agility, Intelligence, Endurance and traits for the run.</p>
          <div className="grid">
            {conductor.locos.map((loco) => {
              const crew = crewOf(conductor, loco);
              return (
                <article className="plate stack-sm" key={loco.id}>
                  <div className="spread">
                    <h3>{loco.name}</h3>
                    {loco.id === conductor.activeLocoId ? <span className="chip">Active</span> : null}
                  </div>
                  <label className="label" htmlFor={`crew-${loco.id}`}>
                    Conductor
                  </label>
                  <select id={`crew-${loco.id}`} className="field" value={loco.crewId ?? ''} onChange={(e) => act('seatCrew', { locoId: loco.id, crewId: e.target.value || null })}>
                    <option value="">Nobody (no attributes or traits)</option>
                    {(conductor.crew ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.rarity}) · STR {c.str} AGI {c.agi} INT {c.int} END {c.end}
                      </option>
                    ))}
                  </select>
                  {crew ? <span className="small muted">Traits: {crew.traits.map((t) => TRAITS[t]?.name ?? t).join(', ') || 'none'}</span> : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {tab === 'send' ? <SendPanel /> : null}

      {tab === 'admin' && account?.admin ? <AdminPanel /> : null}
    </div>
  );
}

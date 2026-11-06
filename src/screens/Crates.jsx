import React, { useMemo, useState } from 'react';
import { Box, Gem, KeyRound, Search, ShieldAlert, Sparkles, TrainFront, User } from 'lucide-react';
import { useGame } from '../state/store.jsx';
import { CRATE_TIERS, PICK_PREMIUM, TIER_IDS, WELCOME_NEXUS, adminGrant, cratePrice, crewOf, openCrate, remaining } from '../game/crates.js';
import { MODELS } from '../game/locomotives.js';
import { TRAITS } from '../game/traits.js';
import { ADMIN_CODE } from '../edition.js';
import { RarityTag } from '../ui/bits.jsx';
import { fmt } from '../ui/format.js';

const TABS = [
  { id: 'crates', label: 'Crates', icon: Box },
  { id: 'vault', label: 'Vault', icon: Gem },
  { id: 'crew', label: 'Crew', icon: User },
  { id: 'admin', label: 'Admin', icon: KeyRound },
];

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

// Admin: award Nexus (test build). Used on the Crates screen and on its own at /#admin.
export function AdminPanel() {
  const { vault, actVault, notify } = useGame();
  const [code, setCode] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [amount, setAmount] = useState('100');
  return (
<section className="plate stack-sm" style={{ maxWidth: 520 }}>
      <h2>Admin: award Nexus</h2>
      <p className="note warn small">Test only. Until the game has a server, this passcode lives in the game itself and anyone determined can find it.</p>
      {!unlocked ? (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (code === ADMIN_CODE) setUnlocked(true);
            else notify('Wrong admin passcode.', 'error');
          }}
        >
          <input className="field grow" type="password" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Admin passcode" autoComplete="off" />
          <button type="submit" className="btn">
            Unlock
          </button>
        </form>
      ) : (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            const n = actVault(adminGrant, { amount, note: 'admin award' });
            if (n) notify(`Awarded ${amount} Nexus.`, 'good');
          }}
        >
          <input className="field grow" type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Nexus to award" />
          <button type="submit" className="btn btn-arcane">
            Award Nexus
          </button>
        </form>
      )}
      <h3>Ledger</h3>
      <div className="small num ledger">
        {vault.ledger.length
          ? [...vault.ledger].reverse().slice(0, 12).map((row, i) => (
              <div className="spread" key={i}>
                <span>{row.type === 'grant' ? (row.note === 'welcome' ? 'Welcome gift' : 'Admin award') : `${CRATE_TIERS[row.tier]?.name ?? 'Crate'}${row.picked ? ' (picked)' : ''}`}</span>
                <span className={row.nexus < 0 ? 'stop' : 'go'}>{row.nexus > 0 ? '+' : ''}{row.nexus}</span>
              </div>
            ))
          : 'Nothing yet.'}
      </div>
    </section>
  );
}

export default function Crates() {
  const { conductor, vault, actVault, deploy, act, notify, screen } = useGame();
  const [tab, setTab] = useState(screen.tab ?? 'crates');
  const [browse, setBrowse] = useState(null); // tier whose pool is open for picking
  const [reveal, setReveal] = useState(null);
  const saveId = conductor.createdAt;

  const open = (tier, pickId = null) => {
    const nft = actVault(openCrate, { tier, pickId, needLoco: !conductor.locos.length });
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
          <ShieldAlert aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> Test build: Nexus, pools and NFTs live in this browser until the game has a server. Nothing here is on a blockchain yet.
        </p>
      </div>

      <div className="tabs" role="tablist" aria-label="Nexus">
        {TABS.map((t) => (
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
              <button type="button" className="btn btn-arcane grow" onClick={() => deploy(reveal.id) && (notify('Sent to your Captain.', 'good'), setReveal(null))}>
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
                    <button type="button" className="btn btn-arcane grow" disabled={!left || vault.nexus < cratePrice(tier)} onClick={() => open(tier)}>
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
                    <button type="button" className="btn btn-arcane btn-block" disabled={vault.nexus < cratePrice(browse, true)} onClick={() => open(browse, entry.id)}>
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
                  <button type="button" className="btn btn-arcane btn-block" onClick={() => deploy(nft.id) && notify('Sent to your Captain.', 'good')}>
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

      {tab === 'admin' ? <AdminPanel /> : null}
    </div>
  );
}

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as actions from '../game/actions.js';
import { GameError } from '../game/actions.js';
import { RESEARCH } from '../game/economy.js';
import { loadSaves, loadVault, storeSaves } from '../game/storage.js';
import { VaultError, emptyVault, placeNft, seatPair } from '../game/crates.js';
import { IS_NFT } from '../edition.js';
import { api } from '../net/api.js';

// One place holds the saves and the current screen. Screens never write a save
// themselves: they call act('buyFuel', {...}) and the store applies the named action.

const GameContext = createContext(null);
export const useGame = () => useContext(GameContext);

export function GameProvider({ children }) {
  const [saves, setSaves] = useState(loadSaves);
  const [screen, setScreen] = useState({ name: 'title' });
  const [toasts, setToasts] = useState([]);
  // Nexus Rail keeps the vault on the server (see startSession); this is a mirror of it.
  const [vault, setVault] = useState(() => (IS_NFT ? emptyVault() : loadVault()));
  const [account, setAccount] = useState(null); // { player: { id, name }, admin, signOut }
  const vaultRef = useRef(vault);
  vaultRef.current = vault;
  const savesRef = useRef(saves);
  const screenRef = useRef(screen);
  savesRef.current = saves;
  screenRef.current = screen;

  const commit = useCallback((next) => {
    savesRef.current = next;
    setSaves(next);
    storeSaves(next);
  }, []);

  const notify = useCallback((text, tone = 'info', ms = 3600) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((list) => [...list.slice(-2), { id, text, tone }]);
    window.setTimeout(() => setToasts((list) => list.filter((toast) => toast.id !== id)), ms);
  }, []);

  const go = useCallback((name, params = {}) => {
    setScreen({ name, ...params });
    window.scrollTo(0, 0);
  }, []);

  // Runs a named action against the active save. Returns the action's report,
  // or null if a rule refused it (the reason is shown as a toast).
  const act = useCallback(
    (name, args = {}, options = {}) => {
      const current = savesRef.current;
      if (current.active === null) return null;
      const conductor = structuredClone(current.slots[current.active]);
      try {
        const report = actions[name](conductor, { ...args, now: Date.now() });
        const slots = current.slots.slice();
        slots[current.active] = conductor;
        commit({ slots, active: current.active });
        return report ?? {};
      } catch (error) {
        if (error instanceof GameError) {
          if (!options.quiet) notify(error.message, 'error');
          return null;
        }
        throw error;
      }
    },
    [commit, notify],
  );

  const createSave = useCallback(
    (slot, conductor) => {
      const copy = structuredClone(conductor);
      actions.refreshWorld(copy, { now: Date.now() });
      const slots = savesRef.current.slots.slice();
      slots[slot] = copy;
      commit({ slots, active: slot });
    },
    [commit],
  );

  const loadSlot = useCallback(
    (slot) => {
      const current = savesRef.current;
      if (!current.slots[slot]) return;
      const conductor = structuredClone(current.slots[slot]);
      const report = actions.refreshWorld(conductor, { now: Date.now() });
      const slots = current.slots.slice();
      slots[slot] = conductor;
      commit({ slots, active: slot });
      // A run that was under way when the page was last closed was settled there and then.
      const left = report?.leftRun;
      if (left) notify(left.outcome === 'forfeit' ? `You left "${left.title}" under way, so it was settled as given up: the fuel it had burned is gone.` : `Your last run, "${left.title}", was settled when you left the page.`, 'info', 9000);
      if (report?.researchDone) notify(`${RESEARCH[report.researchDone.category].name} tier ${report.researchDone.tier} complete.`, 'good');
    },
    [commit, notify],
  );

  const deleteSlot = useCallback(
    (slot) => {
      const current = savesRef.current;
      const gone = current.slots[slot];
      const slots = current.slots.slice();
      slots[slot] = null;
      commit({ slots, active: current.active === slot ? null : current.active });
      // Nexus Rail: a deleted Captain's locomotives and conductors go back to the vault.
      if (gone?.captain && vaultRef.current)
        api('/api/nft/release', { saveId: gone.createdAt })
          .then((reply) => {
            if (reply?.vault) {
              vaultRef.current = reply.vault;
              setVault(reply.vault);
            }
            if (reply?.released) notify(`${reply.released} NFT${reply.released === 1 ? '' : 's'} went back to your vault.`, 'good');
          })
          .catch(() => {});
    },
    [commit, notify],
  );

  // The calendar drifts with the real clock (and research with it). Every 15 seconds, outside a
  // run, the save catches up; a run's own time is added when it is settled.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (savesRef.current.active === null) return;
      if (['race', 'setup', 'title', 'create'].includes(screenRef.current.name)) return;
      const report = act('refreshWorld', {}, { quiet: true });
      if (report?.researchDone) notify(`${RESEARCH[report.researchDone.category].name} tier ${report.researchDone.tier} complete.`, 'good');
    }, 15000);
    return () => window.clearInterval(timer);
  }, [act, notify]);

  // Nexus Rail: one call to the bank. Updates the mirrored vault and player from the reply.
  // Returns the reply, or null if the server refused (the reason is shown as a toast).
  const bank = useCallback(
    async (path, body) => {
      try {
        const reply = await api(path, body);
        if (reply.vault) {
          vaultRef.current = reply.vault;
          setVault(reply.vault);
        }
        if (reply.player) setAccount((a) => (a ? { ...a, player: reply.player } : a));
        return reply;
      } catch (error) {
        notify(error.message, 'error');
        return null;
      }
    },
    [notify],
  );

  // Signed in: create or load the player on the server.
  const startSession = useCallback(async (signOut) => {
    const reply = await api('/api/session', {});
    vaultRef.current = reply.vault;
    setVault(reply.vault);
    setAccount({ player: reply.player, admin: !!reply.admin, signOut });
  }, []);

  const refreshVault = useCallback(() => bank('/api/state'), [bank]);

  // Awards and sends from other players land on the server: check for them every 20 seconds, and
  // when the player comes back to the tab. Quietly: a missed check isn't worth a toast.
  const signedIn = !!account;
  useEffect(() => {
    if (!signedIn) return undefined;
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      if (screenRef.current.name === 'race') return;
      api('/api/state')
        .then((reply) => {
          const before = vaultRef.current?.nexus ?? 0;
          vaultRef.current = reply.vault;
          setVault(reply.vault);
          const gained = Math.round((reply.vault.nexus - before) * 100) / 100;
          const last = reply.vault.ledger.at(-1);
          if (gained > 0 && last && (last.type === 'grant' || last.type === 'trade')) notify(`+${gained} Nexus${last.type === 'trade' && last.other ? ` from ${last.other}` : ' from the admin team'}.`, 'good');
        })
        .catch(() => {});
    };
    const timer = window.setInterval(check, 20000);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [signedIn, notify]);

  // Nexus Rail: every LT a Captain earns comes out of the treasury pool, and every LT spent goes
  // back into it. The save remembers how much the server knows about (ltSynced); a second after
  // the balance changes, the difference is reported. If the pool is low the server pays part of
  // an earning, and the save's LT drop to match.
  const syncingLt = useRef(null);
  const [treasuryFunded, setTreasuryFunded] = useState(true);
  const syncLt = useCallback(() => {
    if (!IS_NFT || syncingLt.current) return syncingLt.current ?? Promise.resolve();
    const current = savesRef.current;
    const save = current.active !== null ? current.slots[current.active] : null;
    if (!save) return Promise.resolve();
    const delta = Math.round(((save.lt ?? 0) - (save.ltSynced ?? 0)) * 10) / 10;
    if (Math.abs(delta) < 0.1) return Promise.resolve();
    const saveId = save.createdAt;
    const run = api('/api/lt/sync', { delta, reason: delta > 0 ? 'earned' : 'spent' })
      .then((reply) => {
        setTreasuryFunded(!reply.unfunded);
        if (reply.unfunded) return;
        const latest = savesRef.current;
        const index = latest.slots.findIndex((slot) => slot?.createdAt === saveId);
        if (index < 0) return;
        const next = structuredClone(latest.slots[index]);
        next.ltSynced = Math.round(((next.ltSynced ?? 0) + reply.granted) * 10) / 10;
        if (delta > 0 && reply.granted < delta - 0.05) {
          const short = Math.round((delta - reply.granted) * 10) / 10;
          next.lt = Math.round((next.lt - short) * 10) / 10;
          notify(`The treasury pool is running low: ${Math.round((reply.granted / delta) * 100)}% paid (${reply.granted.toLocaleString()} of ${delta.toLocaleString()} LT).`, 'error');
        }
        const slots = latest.slots.slice();
        slots[index] = next;
        commit({ slots, active: latest.active });
      })
      .catch(() => {})
      .finally(() => {
        syncingLt.current = null;
      });
    syncingLt.current = run;
    return run;
  }, [commit, notify]);
  useEffect(() => {
    if (!IS_NFT || !signedIn) return undefined;
    const save = saves.active !== null ? saves.slots[saves.active] : null;
    if (!save || Math.abs((save.lt ?? 0) - (save.ltSynced ?? 0)) < 0.1) return undefined;
    const timer = window.setTimeout(syncLt, 1000);
    return () => window.clearTimeout(timer);
  }, [saves, signedIn, syncLt, treasuryFunded]);
  // While the treasury is unfunded, earnings wait; try again every 20 seconds.
  useEffect(() => {
    if (!IS_NFT || !signedIn || treasuryFunded) return undefined;
    const timer = window.setInterval(syncLt, 20000);
    return () => window.clearInterval(timer);
  }, [signedIn, treasuryFunded, syncLt]);

  // Live treasury: every 20 seconds, look for new money in (deposits and crate sales) and tell
  // everyone, so the treasury feels alive. The first look only sets the starting point.
  const lastEventId = useRef(null);
  const myName = account?.player?.name ?? null;
  useEffect(() => {
    if (!IS_NFT || !signedIn) return undefined;
    const money = (v) => `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const look = () => {
      if (document.visibilityState !== 'visible' || screenRef.current.name === 'race') return;
      api('/api/public/treasury')
        .then((d) => {
          const events = d.events ?? [];
          const newest = events.reduce((m, e) => Math.max(m, e.id ?? 0), 0);
          if (lastEventId.current === null) {
            lastEventId.current = newest;
            return;
          }
          const fresh = events.filter((e) => e.id > lastEventId.current && (e.kind === 'crate' || e.kind === 'deposit')).reverse();
          lastEventId.current = Math.max(lastEventId.current, newest);
          for (const e of fresh.slice(-2)) {
            notify(e.kind === 'crate' ? `${e.who === myName ? 'You' : e.who} opened a ${e.note}: +${money(e.usd)} to the treasury!` : `${money(e.usd)} just landed in the treasury!`, 'good', 7000);
          }
        })
        .catch(() => {});
    };
    look();
    const timer = window.setInterval(look, 20000);
    return () => window.clearInterval(timer);
  }, [signedIn, notify, myName]);

  // Swap the active Captain's LT for Nexus at today's price.
  const swapLt = useCallback(
    async (lt) => {
      await syncLt();
      const current = savesRef.current;
      const save = current.active !== null ? current.slots[current.active] : null;
      if (!save) return null;
      if (lt > (save.lt ?? 0) + 0.01) {
        notify(`${save.name} has ${(save.lt ?? 0).toLocaleString()} LT.`, 'error');
        return null;
      }
      const reply = await bank('/api/treasury/swap', { lt });
      if (!reply) return null;
      const latest = savesRef.current;
      const index = latest.slots.findIndex((slot) => slot?.createdAt === save.createdAt);
      if (index >= 0) {
        const next = structuredClone(latest.slots[index]);
        next.lt = Math.round((next.lt - reply.lt) * 10) / 10;
        next.ltSynced = Math.round(((next.ltSynced ?? 0) - reply.lt) * 10) / 10;
        const slots = latest.slots.slice();
        slots[index] = next;
        commit({ slots, active: latest.active });
      }
      return reply;
    },
    [bank, commit, notify, syncLt],
  );

  // Open a crate; returns the NFT.
  const openCrateFor = useCallback(
    async ({ tier, pickId = null }) => {
      const reply = await bank('/api/crates/open', { tier, pickId });
      return reply?.nfts ? { crate: reply.crate, tier, nfts: reply.nfts } : null;
    },
    [bank],
  );

  // Move an NFT from the Vault into the active Captain's save.
  const deploy = useCallback(
    async (nftId) => {
      const current = savesRef.current;
      if (current.active === null) return null;
      const save = structuredClone(current.slots[current.active]);
      if (!save.captain) {
        notify('Only a Captain can take NFTs.', 'error');
        return null;
      }
      const reply = await bank('/api/nft/deploy', { nftId, saveId: save.createdAt });
      if (!reply) return null;
      try {
        placeNft(save, reply.nft);
      } catch (error) {
        if (error instanceof VaultError) {
          notify(error.message, 'error');
          return null;
        }
        throw error;
      }
      const latest = savesRef.current;
      const slots = latest.slots.slice();
      slots[latest.active] = save;
      commit({ slots, active: latest.active });
      return reply.nft;
    },
    [bank, commit, notify],
  );

  const conductor = saves.active === null ? null : saves.slots[saves.active];
  // Send both NFTs from a crate to the active Captain; the crate's conductor drives its locomotive.
  const deployCrate = useCallback(
    async (nfts) => {
      const done = [];
      for (const nft of nfts) if (!nft.deployedTo && (await deploy(nft.id))) done.push(nft);
      const loco = done.find((n) => n.kind === 'loco');
      const crew = done.find((n) => n.kind !== 'loco');
      if (loco && crew) {
        const current = savesRef.current;
        if (current.active !== null) {
          const save = structuredClone(current.slots[current.active]);
          seatPair(save, { locoId: loco.data.id, crewId: crew.data.id });
          const slots = current.slots.slice();
          slots[current.active] = save;
          commit({ slots, active: current.active });
        }
      }
      return done.length === nfts.filter((n) => !n.deployedTo).length;
    },
    [deploy, commit],
  );

  const value = useMemo(
    () => ({ saves, conductor, screen, toasts, go, act, notify, createSave, loadSlot, deleteSlot, vault, deploy, account, bank, startSession, refreshVault, openCrateFor, deployCrate, syncLt, swapLt, treasuryFunded }),
    [saves, conductor, screen, toasts, go, act, notify, createSave, loadSlot, deleteSlot, vault, deploy, account, bank, startSession, refreshVault, openCrateFor, deployCrate, syncLt, swapLt, treasuryFunded],
  );
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as actions from '../game/actions.js';
import { GameError } from '../game/actions.js';
import { RESEARCH } from '../game/economy.js';
import { loadSaves, loadVault, storeSaves } from '../game/storage.js';
import { VaultError, emptyVault, placeNft } from '../game/crates.js';
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

  const notify = useCallback((text, tone = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((list) => [...list.slice(-2), { id, text, tone }]);
    window.setTimeout(() => setToasts((list) => list.filter((toast) => toast.id !== id)), 3600);
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
      actions.refreshWorld(conductor, { now: Date.now() });
      const slots = current.slots.slice();
      slots[slot] = conductor;
      commit({ slots, active: slot });
    },
    [commit],
  );

  const deleteSlot = useCallback(
    (slot) => {
      const current = savesRef.current;
      const slots = current.slots.slice();
      slots[slot] = null;
      commit({ slots, active: current.active === slot ? null : current.active });
    },
    [commit],
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

  // Open a crate; returns the NFT.
  const openCrateFor = useCallback(
    async ({ tier, pickId = null, needLoco = false }) => (await bank('/api/crates/open', { tier, pickId, needLoco }))?.nft ?? null,
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
  const value = useMemo(
    () => ({ saves, conductor, screen, toasts, go, act, notify, createSave, loadSlot, deleteSlot, vault, deploy, account, bank, startSession, refreshVault, openCrateFor }),
    [saves, conductor, screen, toasts, go, act, notify, createSave, loadSlot, deleteSlot, vault, deploy, account, bank, startSession, refreshVault, openCrateFor],
  );
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

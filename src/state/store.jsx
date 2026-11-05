import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as actions from '../game/actions.js';
import { GameError } from '../game/actions.js';
import { RESEARCH } from '../game/economy.js';
import { loadSaves, storeSaves } from '../game/storage.js';

// One place holds the saves and the current screen. Screens never write a save
// themselves: they call act('buyFuel', {...}) and the store applies the named action.

const GameContext = createContext(null);
export const useGame = () => useContext(GameContext);

export function GameProvider({ children }) {
  const [saves, setSaves] = useState(loadSaves);
  const [screen, setScreen] = useState({ name: 'title' });
  const [toasts, setToasts] = useState([]);
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

  const conductor = saves.active === null ? null : saves.slots[saves.active];
  const value = useMemo(
    () => ({ saves, conductor, screen, toasts, go, act, notify, createSave, loadSlot, deleteSlot }),
    [saves, conductor, screen, toasts, go, act, notify, createSave, loadSlot, deleteSlot],
  );
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

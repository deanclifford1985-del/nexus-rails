import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as actions from '../game/actions.js';
import { GameError } from '../game/actions.js';
import { deriveStats, newCharacter } from '../game/character.js';
import { loadSaves, loadSettings, storeSaves, storeSettings } from '../game/save.js';

// One place holds the saves, the current screen and the open overlay. Nothing writes a save
// directly: screens and the simulation call act('buy', {...}) and the store applies the named
// action from game/actions.js. The running game (the "host") registers itself here so that
// overlays can ask it to do things in the world: host.startMission(...), host.runCommand(...).

const GameContext = createContext(null);
export const useGame = () => useContext(GameContext);

export function GameProvider({ children }) {
  const [saves, setSaves] = useState(loadSaves);
  const [screen, setScreen] = useState('title'); // title | create | game
  const [overlay, setOverlay] = useState(null); // { name, props } | null
  const [settings, setSettings] = useState(loadSettings);
  const [toasts, setToasts] = useState([]);
  const [host, setHost] = useState(null);
  const savesRef = useRef(saves);
  const overlayRef = useRef(overlay);
  const settingsRef = useRef(settings);
  const listeners = useRef(new Set());
  savesRef.current = saves;
  settingsRef.current = settings;

  const commit = useCallback((next) => {
    savesRef.current = next;
    setSaves(next);
    storeSaves(next);
    const save = next.active === null ? null : next.slots[next.active];
    listeners.current.forEach((listener) => listener(save));
  }, []);

  const notify = useCallback((text, tone = 'info', ms = 3800) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((list) => [...list.slice(-3), { id, text, tone }]);
    window.setTimeout(() => setToasts((list) => list.filter((toast) => toast.id !== id)), ms);
  }, []);

  // Runs a named action against the active save. Returns the action's report, or null if a rule
  // refused it (the reason is shown as a toast unless options.quiet).
  const act = useCallback(
    (name, args = {}, options = {}) => {
      const current = savesRef.current;
      if (current.active === null) return null;
      const save = structuredClone(current.slots[current.active]);
      try {
        const report = actions[name](save, { ...args, now: Date.now() });
        save.updatedAt = Date.now();
        const slots = current.slots.slice();
        slots[current.active] = save;
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

  const getSave = useCallback(() => {
    const current = savesRef.current;
    return current.active === null ? null : current.slots[current.active];
  }, []);

  // The simulation listens for save changes so its copy of the soldier's stats stays current.
  const subscribe = useCallback((listener) => {
    listeners.current.add(listener);
    return () => listeners.current.delete(listener);
  }, []);

  // The ref is set at once (not on the next render) so the running game sees the change immediately.
  const open = useCallback((name, props = {}) => {
    const next = { name, props };
    overlayRef.current = next;
    setOverlay(next);
  }, []);
  const close = useCallback(() => {
    overlayRef.current = null;
    setOverlay(null);
  }, []);

  const createSave = useCallback(
    (slot, details) => {
      const slots = savesRef.current.slots.slice();
      slots[slot] = newCharacter(details);
      commit({ slots, active: slot });
      close();
      setScreen('game');
    },
    [commit, close],
  );

  const loadSlot = useCallback(
    (slot) => {
      const current = savesRef.current;
      if (!current.slots[slot]) return;
      commit({ slots: current.slots, active: slot });
      close();
      setScreen('game');
    },
    [commit, close],
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

  const quit = useCallback(() => {
    close();
    setScreen('title');
    commit({ slots: savesRef.current.slots, active: null });
  }, [commit, close]);

  const setSetting = useCallback((key, value) => {
    setSettings((current) => {
      const next = { ...current, [key]: value };
      storeSettings(next);
      settingsRef.current = next;
      return next;
    });
  }, []);

  // A stable handle for the simulation: the same functions, reading the newest state.
  const api = useMemo(
    () => ({
      act,
      getSave,
      subscribe,
      notify,
      open,
      close,
      quit,
      overlay: () => overlayRef.current,
      settings: () => settingsRef.current,
    }),
    [act, getSave, subscribe, notify, open, close, quit],
  );

  const save = saves.active === null ? null : saves.slots[saves.active];
  const derived = useMemo(() => (save ? deriveStats(save) : null), [save]);

  useEffect(() => {
    if (typeof window !== 'undefined') window.__irondawnStore = { api, getSave, act, open, close, setScreen };
  }, [api, getSave, act, open, close]);

  const value = {
    saves,
    save,
    derived,
    screen,
    setScreen,
    overlay,
    open,
    close,
    settings,
    setSetting,
    toasts,
    notify,
    act,
    getSave,
    createSave,
    loadSlot,
    deleteSlot,
    quit,
    api,
    host,
    setHost,
  };
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

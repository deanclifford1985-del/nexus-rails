import { createContext, useContext, useMemo } from 'react';
import { useGame } from '../state/store.jsx';

// Menus read the game through useUi(). In the real game that is the store. The harness at
// /irondawn/?ui swaps in a mock, so every menu can be checked without the 3D world.
const Override = createContext(null);
export const UiOverride = Override.Provider;

export function useUi() {
  const override = useContext(Override);
  const game = useGame();
  return override ?? game;
}

// What menus ask the running game (the "host") to do. The host can be missing for a moment
// while the world loads, so every call here has a harmless fallback.
export function useHost() {
  const { host, open, close, notify, save } = useUi();
  return useMemo(
    () => ({
      ready: !!host,
      resume: () => (host?.resume ? host.resume() : close()),
      run: (cmd) => {
        if (host?.runCommand) return host.runCommand(cmd);
        if (cmd?.type === 'overlay') {
          const { type, name, ...props } = cmd;
          return open(name, props);
        }
        return close();
      },
      call: (method, ...args) => {
        if (host?.[method]) return host[method](...args);
        notify('The world is still loading. Try again in a moment.', 'error');
        return null;
      },
      state: () => host?.state?.() ?? { mode: 'roam', atBase: true, missionId: null, hour: save?.world?.hour ?? 12, day: save?.world?.day ?? 1 },
      mapData: () => host?.mapData?.() ?? null,
    }),
    [host, open, close, notify, save],
  );
}

// The slot a new recruit will be written to: set on the title screen, read on the creation screen.
let pendingSlot = 0;
export const setPendingSlot = (slot) => {
  pendingSlot = slot;
};
export const getPendingSlot = () => pendingSlot;

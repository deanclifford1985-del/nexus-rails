// Saves live in the browser's localStorage: three slots, one active, plus the player's settings.
// This file is the only thing to replace if saves ever move to a server.

import { ATTR_IDS } from './attributes.js';
import { B } from './balance.js';
import { SAVE_VERSION, EMPTY_GEAR } from './character.js';

const KEY = 'iron-dawn/saves/v1';
const SETTINGS_KEY = 'iron-dawn/settings/v1';
const EMPTY = { slots: [null, null, null], active: null };

const storage = () => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

// Fills in anything an older save lacks, so the rules can rely on every field being there.
export function migrate(save) {
  if (!save || typeof save !== 'object' || !save.attrs) return null;
  for (const id of ATTR_IDS) {
    if (typeof save.attrs[id] !== 'number') save.attrs[id] = B.ATTR.START;
    if (typeof save.practice?.[id] !== 'number') save.practice = { ...(save.practice ?? {}), [id]: 0 };
  }
  save.training ??= { results: {}, graduated: false, honors: false };
  save.loadout ??= { primary: null, secondary: null, gear: EMPTY_GEAR() };
  save.loadout.gear = { ...EMPTY_GEAR(), ...(save.loadout.gear ?? {}) };
  save.weapons ??= [];
  save.attachments ??= {};
  save.gearOwned ??= [];
  save.items ??= {};
  save.squad ??= { roster: [], active: [], seed: 1, offers: null };
  save.story ??= { done: [], flags: {}, seen: {} };
  save.story.flags ??= {};
  save.story.seen ??= {};
  save.contracts ??= { seed: 1, done: 0 };
  save.world ??= { hour: B.WORLD.START_HOUR, day: 1, liberated: {}, looted: {}, discovered: { hawthorne: true }, at: 'hawthorne' };
  save.world.liberated ??= {};
  save.world.looted ??= {};
  save.world.discovered ??= { hawthorne: true };
  save.world.cleared ??= {};
  save.records ??= {};
  save.stats = { kills: 0, headshots: 0, stealthKills: 0, longestShot: 0, missions: 0, failed: 0, shots: 0, hits: 0, rescued: 0, captured: 0, downs: 0, playSeconds: 0, squadKills: 0, ...(save.stats ?? {}) };
  save.medals ??= [];
  save.log ??= [];
  save.version = SAVE_VERSION;
  return save;
}

export function loadSaves() {
  try {
    const raw = storage()?.getItem(KEY);
    if (!raw) return structuredClone(EMPTY);
    const data = JSON.parse(raw);
    if (!Array.isArray(data.slots)) return structuredClone(EMPTY);
    const slots = [0, 1, 2].map((i) => migrate(data.slots[i]));
    return { slots, active: null };
  } catch {
    return structuredClone(EMPTY);
  }
}

export function storeSaves(saves) {
  try {
    storage()?.setItem(KEY, JSON.stringify({ slots: saves.slots }));
    return true;
  } catch {
    return false;
  }
}

export const DEFAULT_SETTINGS = {
  sensitivity: 1, // mouse and touch look speed
  invertY: false,
  volume: 0.7,
  quality: 'auto', // auto | low | medium | high
  fov: 68,
  hints: true,
  autoAim: true, // gentle aim assist on touch screens
};

export function loadSettings() {
  try {
    const raw = storage()?.getItem(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function storeSettings(settings) {
  try {
    storage()?.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

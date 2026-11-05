// Saves live in the browser's localStorage: three slots, one active.
// On Replit this file is the only thing to replace when saves move to a database.

const KEY = 'iron-rails/saves/v1'; // kept from the Iron Rails days so old saves still load
const EMPTY = { slots: [null, null, null], active: null };

export function loadSaves() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return structuredClone(EMPTY);
    const data = JSON.parse(raw);
    if (!Array.isArray(data.slots)) return structuredClone(EMPTY);
    const slots = [0, 1, 2].map((i) => migrate(data.slots[i]));
    const active = Number.isInteger(data.active) && slots[data.active] ? data.active : null;
    return { slots, active };
  } catch {
    return structuredClone(EMPTY);
  }
}

export function storeSaves(saves) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ slots: saves.slots, active: saves.active }));
    return true;
  } catch {
    return false;
  }
}

// Version 1 saves (Iron Rails) predate cargo slots, wear and per-container pay.
export function migrate(save) {
  if (!save || typeof save !== 'object') return null;
  if (save.version === 6) return save;
  if (save.version === 5) return toV6(save);
  if (save.version === 4) return toV6(toV5(save));
  if (save.version === 3) return toV6(toV5(toV4(save)));
  if (save.version === 2) return toV6(toV5(toV4(toV3(save))));
  if (save.version !== 1) return null;
  const next = structuredClone(save);
  next.version = 2;
  next.gear = next.gear ?? {};
  next.containers = Math.max(1, next.containers ?? 0);
  next.locos = next.locos.map((loco) => ({
    ...loco,
    fit: loco.fit ?? (loco.id === next.activeLocoId ? ['cannon', 'fuel'] : []),
    condition: loco.condition ?? 1,
  }));
  // Jobs are paid differently now, so post a fresh board.
  next.board = null;
  return toV6(toV5(toV4(toV3(next))));
}

// Version 3 added the calendar, weapon items and calendar research.
function toV3(save) {
  const next = structuredClone(save);
  next.version = 3;
  next.clock = next.clock ?? 6 * 60;
  next.lastSeen = Date.now();
  next.arsenal = next.arsenal ?? [];
  next.board = null;
  next.depot = { week: -1, bought: 0 };
  next.station = { stock: [], week: -1 };
  // Research in progress carries over as days of progress, already paid for.
  const r = next.research;
  const convert = (item) => (item ? { category: item.category, tier: item.tier, done: 0, minutes: 10 * 24 * 60 } : null);
  r.active = convert(r.active);
  r.paused = {};
  delete r.progress;
  return next;
}

// Version 4 tripled weapon ranges: weapons already owned reach three times as far too.
function toV4(save) {
  const next = structuredClone(save);
  next.version = 4;
  const stretch = (entry) => (entry && typeof entry === 'object' && entry.item === 'weapon' && entry.range ? { ...entry, range: Math.round(entry.range * 3 * 100) / 100 } : entry);
  next.arsenal = (next.arsenal ?? []).map(stretch);
  next.locos = (next.locos ?? []).map((loco) => ({ ...loco, fit: (loco.fit ?? []).map(stretch) }));
  return next;
}

// Version 5 rescaled combat (cannons 50 a shot, missiles 10): weapons already owned hit to the new scale.
const DAMAGE_SCALE = { cannon: 50 / 130, heavy: 90 / 260, plasma: 7.5 / 50 };
function toV5(save) {
  const next = structuredClone(save);
  next.version = 5;
  const rescale = (entry) => {
    if (!entry || typeof entry !== 'object' || entry.item !== 'weapon' || !DAMAGE_SCALE[entry.base] || !entry.damage) return entry;
    const k = DAMAGE_SCALE[entry.base];
    return { ...entry, damage: entry.damage.map((d) => Math.max(1, Math.round(d * k))) };
  };
  next.arsenal = (next.arsenal ?? []).map(rescale);
  next.locos = (next.locos ?? []).map((loco) => ({ ...loco, fit: (loco.fit ?? []).map(rescale) }));
  return next;
}

// Version 6 added Endurance: a conductor attribute and a locomotive stat. Old conductors get a
// middling Endurance; old locomotives get one from their model, and Epic Long Runs become the Journey.
const MODEL_ENDURANCE = { tank: 7, bullet: 4, stable: 5, longrun: 9, scrappy: 5, phoenix: 14, wizard: 10, titan: 13, dragon: 8 };
function toV6(save) {
  const next = structuredClone(save);
  next.version = 6;
  next.end = next.end ?? 8;
  next.locos = (next.locos ?? []).map((loco) => {
    const out = { ...loco, endurance: loco.endurance ?? MODEL_ENDURANCE[loco.model] ?? 5 };
    if (loco.model === 'longrun' && (loco.rarity === 'epic' || loco.rarity === 'legendary') && !loco.journey) {
      out.journey = true;
      out.name = 'The Journey';
    }
    return out;
  });
  return next;
}

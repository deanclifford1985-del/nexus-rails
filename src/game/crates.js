// Nexus Rail (NFT edition): the Vault, Nexus, seasonal crates, and crew.
//
// The Vault is account-wide (shared by every save on this device): the Nexus balance, the NFTs
// owned, and the season's crate pools. A crate is a reveal from a visible, shrinking pool; the same
// price opens a random one, or +10% picks a specific one. Every NFT in a tier has the same stat
// budget, so tiers differ in power and NFTs within a tier differ in style.
//
// Until the game has a server, all of this lives in the browser and can be edited: it is a test
// build. Nexus is awarded by admins only.

import { ACTIVE_TRAIT_IDS } from './traits.js';
import { FIRST_NAMES, LAST_NAMES } from './conductor.js';
import { generateLoco, STARTER_MODELS } from './locomotives.js';
import { makeRng, pick, randInt, shuffle } from './rng.js';
import { hashSeed } from './course.js';
import { B } from './balance.js';
import { crewRating } from './power.js';

export const VAULT_VERSION = 1;
export const SEASON = 1;
export const PICK_PREMIUM = 0.1;
export const BURN_SHARE = 0.05; // of every Nexus spend, taken out of circulation

// Every crate holds a matched pair: one locomotive and one conductor. The better one side is, the
// plainer the other: no crate holds two Legendaries. In the mixed tiers half the pool has the better
// locomotive and half the better conductor.
export const CRATE_TIERS = {
  basic: { name: 'Basic Crate', loco: 'uncommon', crew: 'uncommon', price: 10, pool: 200 },
  rare: { name: 'Rare Crate', loco: 'rare', crew: 'rare', price: 30, pool: 120 },
  elite: { name: 'Elite Crate', high: 'epic', low: 'rare', price: 60, pool: 80 },
  epic: { name: 'Epic Crate', loco: 'epic', crew: 'epic', price: 100, pool: 50 },
  legendary: { name: 'Legendary Crate', high: 'legendary', low: 'rare', price: 200, pool: 24 },
  mythic: { name: 'Mythic Crate', high: 'legendary', low: 'epic', price: 300, pool: 12 },
};
export const TIER_IDS = Object.keys(CRATE_TIERS);
// The stat budget of each rarity: locomotive stat points, conductor attribute points and traits.
export const RARITY_BUDGET = {
  uncommon: { loco: 20, crew: 36, traits: 1 },
  rare: { loco: 26, crew: 46, traits: 2 },
  epic: { loco: 32, crew: 56, traits: 3 },
  legendary: { loco: 40, crew: 66, traits: 4 },
};
const RANK = ['uncommon', 'rare', 'epic', 'legendary'];
// The best rarity in a crate (for its colour and its opening scene).
export const crateRarity = (tier) => {
  const T = CRATE_TIERS[tier];
  return T.high ?? (RANK.indexOf(T.loco) >= RANK.indexOf(T.crew) ? T.loco : T.crew);
};
// "Legendary + Rare", "Epic train or conductor + Rare", ...
export function crateMix(tier) {
  const T = CRATE_TIERS[tier];
  const L = (r) => B.RARITY[r].label;
  return T.high ? `${L(T.high)} train or conductor, ${L(T.low)} other` : `${L(T.loco)} train, ${L(T.crew)} conductor`;
}
const CREATION_TRAITS = ['lucky', 'consistent', 'focused', 'secondchances', 'prodigy'];
const CREW_TRAITS = ACTIVE_TRAIT_IDS.filter((id) => !CREATION_TRAITS.includes(id));

// Split `total` points across `n` stats, each between lo and hi, with a little character.
function spread(rng, total, n, lo, hi) {
  const out = Array.from({ length: n }, () => lo);
  let left = total - lo * n;
  const weights = Array.from({ length: n }, () => 0.4 + rng());
  while (left > 0) {
    const sum = weights.reduce((a, b, i) => a + (out[i] < hi ? b : 0), 0);
    let r = rng() * sum;
    for (let i = 0; i < n; i++) {
      if (out[i] >= hi) continue;
      r -= weights[i];
      if (r <= 0) {
        out[i] += 1;
        left -= 1;
        break;
      }
    }
  }
  return out;
}

const tierCode = { basic: 'BAS', rare: 'RAR', elite: 'ELI', epic: 'EPI', legendary: 'LEG', mythic: 'MYT' };

function makeLoco(rng, rarity, model, id) {
  const [power, efficiency, durability, endurance] = spread(rng, RARITY_BUDGET[rarity].loco, 4, 2, 15);
  const loco = generateLoco(rng, model, { rarity, power, efficiency, durability, endurance, hpBase: 1750, tqBase: 3900, growth: 1.095 });
  loco.id = `loco-${id}`;
  loco.nftId = id;
  return loco;
}
function makeCrew(rng, rarity, id) {
  const R = RARITY_BUDGET[rarity];
  const [str, agi, int, end] = spread(rng, R.crew, 4, 3, 20);
  const traits = shuffle(rng, CREW_TRAITS).slice(0, R.traits);
  return { id: `crew-${id}`, nftId: id, name: `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`, rarity, traits, str, agi, int, end };
}

// One season's pool for one tier, the same on every device. Each entry is a crate: its id, and the
// locomotive and conductor inside it (each its own NFT, id + "-T" and id + "-C").
export function seasonPool(tier, season = SEASON) {
  const T = CRATE_TIERS[tier];
  const rng = makeRng(hashSeed(`nexus-season-${season}-pair-${tier}`));
  const entries = [];
  for (let i = 0; i < T.pool; i++) {
    const id = `NXR-S${season}-${tierCode[tier]}-${String(i + 1).padStart(3, '0')}`;
    const trainHigh = i % 2 === 0;
    const locoRarity = T.high ? (trainHigh ? T.high : T.low) : T.loco;
    const crewRarity = T.high ? (trainHigh ? T.low : T.high) : T.crew;
    const model = STARTER_MODELS[i % STARTER_MODELS.length];
    entries.push({
      id,
      tier,
      loco: { id: `${id}-T`, kind: 'loco', tier, data: makeLoco(rng, locoRarity, model, `${id}-T`) },
      conductor: { id: `${id}-C`, kind: 'conductor', tier, data: makeCrew(rng, crewRarity, `${id}-C`) },
    });
  }
  return shuffle(rng, entries);
}

// Every NFT in a tier's pool (both halves of every crate).
export const poolNfts = (tier, season = SEASON) => poolOf(tier, season).flatMap((crate) => [crate.loco, crate.conductor]);

const poolCache = {};
export function poolOf(tier, season = SEASON) {
  const key = `${season}-${tier}`;
  if (!poolCache[key]) poolCache[key] = seasonPool(tier, season);
  return poolCache[key];
}

// Every player's Vault starts with enough Nexus for one Uncommon crate, so a new Captain can open
// their first crate (a locomotive and a conductor) without waiting on an admin.
export const WELCOME_NEXUS = 10;

export function emptyVault() {
  return { version: VAULT_VERSION, season: SEASON, nexus: 0, burned: 0, opened: {}, owned: [], ledger: [], welcomed: false };
}

// Give the welcome Nexus once per Vault, including Vaults made before the welcome existed.
export function welcome(vault, now = Date.now()) {
  if (vault.welcomed) return vault;
  vault.welcomed = true;
  vault.nexus = Math.round((vault.nexus + WELCOME_NEXUS) * 100) / 100;
  vault.ledger.push({ at: now, type: 'grant', nexus: WELCOME_NEXUS, note: 'welcome' });
  return vault;
}

// What is left in a tier's pool this season.
export const remaining = (vault, tier) => poolOf(tier, vault.season).filter((entry) => !vault.opened[entry.id]);

export class VaultError extends Error {}
const fail = (message) => {
  throw new VaultError(message);
};

function spend(vault, amount, what) {
  if (vault.nexus < amount) fail(`Not enough Nexus for ${what}. You have ${vault.nexus}.`);
  vault.nexus = Math.round((vault.nexus - amount) * 100) / 100;
  vault.burned = Math.round(((vault.burned ?? 0) + amount * BURN_SHARE) * 100) / 100;
}

export const cratePrice = (tier, picked = false) => Math.round(CRATE_TIERS[tier].price * (picked ? 1 + PICK_PREMIUM : 1) * 100) / 100;

// Open a crate: a random one from the pool, or the one you picked for +10%. You get both NFTs inside.
export function openCrate(vault, { tier, pickId = null, rng = Math.random, now = Date.now() }) {
  const T = CRATE_TIERS[tier];
  if (!T) fail('Unknown crate.');
  const left = remaining(vault, tier);
  if (!left.length) fail(`The ${T.name} pool is empty for this season.`);
  let entry;
  if (pickId) {
    entry = left.find((item) => item.id === pickId);
    if (!entry) fail('That one has already been taken.');
  } else entry = left[Math.floor(rng() * left.length)];
  spend(vault, cratePrice(tier, !!pickId), T.name);
  vault.opened[entry.id] = true;
  const nfts = [entry.loco, entry.conductor].map((item) => ({ id: item.id, kind: item.kind, tier, crate: entry.id, data: structuredClone(item.data), at: now, deployedTo: null }));
  vault.owned.push(...nfts);
  vault.ledger.push({ at: now, type: 'crate', tier, picked: !!pickId, nexus: -cratePrice(tier, !!pickId), id: entry.id });
  return { crate: entry.id, tier, nfts };
}

// Admin only (test build): award Nexus to this vault.
export function adminGrant(vault, { amount, note = '', now = Date.now() }) {
  const n = Math.round(Number(amount) * 100) / 100;
  if (!(n > 0)) fail('Enter an amount above zero.');
  vault.nexus = Math.round((vault.nexus + n) * 100) / 100;
  vault.ledger.push({ at: now, type: 'grant', nexus: n, note });
  return n;
}

// ---------- crew: conductors who drive the Captain's trains ----------

// The active locomotive's conductor sets the save's driving attributes and traits.
export function applyCrew(save) {
  if (!save?.captain) return save;
  const loco = save.locos.find((item) => item.id === save.activeLocoId) ?? save.locos[0];
  const crew = (save.crew ?? []).find((item) => item.id === loco?.crewId) ?? null;
  save.str = crew?.str ?? 0;
  save.agi = crew?.agi ?? 0;
  save.int = crew?.int ?? 0;
  save.end = crew?.end ?? 0;
  // Crate conductors hold their traits as plain ids; the save keeps them the way every screen and
  // rule reads them.
  save.traits = (crew?.traits ?? []).map((trait) => (typeof trait === 'string' ? { id: trait, mult: 1, rarity: 'normal' } : trait));
  return save;
}

export const crewOf = (save, loco) => (save.crew ?? []).find((item) => item.id === loco?.crewId) ?? null;

// Put an NFT's contents into a save: a locomotive into the garage, a conductor into the crew.
export function placeNft(save, nft) {
  if (!save?.captain) fail('Only a Captain can take NFTs.');
  if (nft.kind === 'loco') {
    const loco = { condition: 1, ...structuredClone(nft.data), crewId: null };
    // An empty-fitted crate locomotive comes with the starter kit: a missile launcher and fuel storage.
    if (!loco.fit?.length) loco.fit = [...B.ARMORY.startKit];
    save.locos.push(loco);
    // A Captain's first locomotive becomes the active one, with an idle conductor at the controls.
    if (!save.locos.some((item) => item.id === save.activeLocoId)) {
      save.activeLocoId = loco.id;
      const seated = new Set(save.locos.map((item) => item.crewId).filter(Boolean));
      loco.crewId = (save.crew ?? []).find((c) => !seated.has(c.id))?.id ?? null;
    }
  } else save.crew = [...(save.crew ?? []), structuredClone(nft.data)];
  applyCrew(save);
  return save;
}

// Mark an NFT in the vault as sent to a save (on the server, the owner's record).
export function markDeployed(vault, { nftId, saveId }) {
  const nft = vault.owned.find((item) => item.id === nftId);
  if (!nft) fail('You do not own that NFT.');
  if (nft.deployedTo) fail('That NFT is already with a Captain.');
  nft.deployedTo = saveId;
  return nft;
}

// Both steps at once, for a vault kept in this browser (tests and the offline build).
export function deployNft(vault, save, { nftId, saveId }) {
  const nft = vault.owned.find((item) => item.id === nftId);
  if (!nft) fail('You do not own that NFT.');
  if (nft.deployedTo) fail('That NFT is already with a Captain.');
  placeNft(save, nft);
  nft.deployedTo = saveId;
  return nft;
}

// After a crate's pair goes to a Captain: the crate's conductor drives the crate's locomotive. If
// that locomotive is the one already on the main line, whichever conductor has the higher power
// rating drives it and the other waits in the crew.
export function seatPair(save, { locoId, crewId }) {
  const loco = save.locos.find((item) => item.id === locoId);
  const crew = (save.crew ?? []).find((item) => item.id === crewId);
  if (!loco || !crew) return save;
  const seated = (save.crew ?? []).find((item) => item.id === loco.crewId);
  if (seated && save.locos.some((other) => other.id !== loco.id && other.crewId === crewId)) return save;
  if (seated && crewRating(seated) >= crewRating(crew)) return save;
  assignCrew(save, { locoId, crewId });
  return save;
}

// Seat a conductor in a locomotive. A conductor drives one locomotive at a time.
export function assignCrew(save, { locoId, crewId }) {
  const loco = save.locos.find((item) => item.id === locoId);
  if (!loco) fail('No such locomotive.');
  if (crewId && !(save.crew ?? []).some((item) => item.id === crewId)) fail('No such conductor.');
  for (const other of save.locos) if (crewId && other.crewId === crewId) other.crewId = null;
  loco.crewId = crewId;
  applyCrew(save);
  return loco;
}

// A short label for an NFT.
export function nftLabel(nft) {
  return nft.kind === 'loco' ? nft.data.name : nft.data.name;
}

export { randInt };

// Turn a freshly built save into a Captain's: the rolled conductor becomes the Captain's first
// crew member (not an NFT) and drives the starter locomotive.
export function makeCaptainSave(save, { focus, crewName }) {
  save.captain = { name: save.name, focus, talents: {} };
  const rookie = { id: 'crew-rookie', nftId: null, name: crewName, rarity: 'common', traits: [...save.traits], str: save.str, agi: save.agi, int: save.int, end: save.end };
  save.crew = [rookie];
  for (const loco of save.locos) loco.crewId = loco.id === save.activeLocoId ? rookie.id : null;
  // No starter train in Nexus Rail: the first locomotive comes from a crate.
  applyCrew(save);
  return save;
}

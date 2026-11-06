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

export const VAULT_VERSION = 1;
export const SEASON = 1;
export const PICK_PREMIUM = 0.1;
export const BURN_SHARE = 0.05; // of every Nexus spend, taken out of circulation

export const CRATE_TIERS = {
  uncommon: { name: 'Uncommon Crate', rarity: 'uncommon', price: 10, pool: 200, locoBudget: 20, crewBudget: 36, traits: 1 },
  rare: { name: 'Rare Crate', rarity: 'rare', price: 25, pool: 100, locoBudget: 26, crewBudget: 46, traits: 2 },
  epic: { name: 'Epic Crate', rarity: 'epic', price: 75, pool: 50, locoBudget: 32, crewBudget: 56, traits: 3 },
  legendary: { name: 'Legendary Crate', rarity: 'legendary', price: 250, pool: 20, locoBudget: 40, crewBudget: 66, traits: 4 },
};
export const TIER_IDS = Object.keys(CRATE_TIERS);
const LOCO_SHARE = 0.6; // the rest of each pool is conductors
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

const tierLetter = { uncommon: 'U', rare: 'R', epic: 'E', legendary: 'L' };

// One season's pool for one tier, the same on every device. Entries are what the crate can reveal.
export function seasonPool(tier, season = SEASON) {
  const T = CRATE_TIERS[tier];
  const rng = makeRng(hashSeed(`nexus-season-${season}-${tier}`));
  const entries = [];
  const locos = Math.round(T.pool * LOCO_SHARE);
  for (let i = 0; i < T.pool; i++) {
    const id = `NXR-S${season}-${tierLetter[tier]}-${String(i + 1).padStart(3, '0')}`;
    if (i < locos) {
      const model = STARTER_MODELS[i % STARTER_MODELS.length];
      const [power, efficiency, durability, endurance] = spread(rng, T.locoBudget, 4, 2, 15);
      const loco = generateLoco(rng, model, { rarity: T.rarity, power, efficiency, durability, endurance, hpBase: 1750, tqBase: 3900, growth: 1.095 });
      loco.id = `loco-${id}`;
      loco.nftId = id;
      entries.push({ id, kind: 'loco', tier, data: loco });
    } else {
      const [str, agi, int, end] = spread(rng, T.crewBudget, 4, 3, 20);
      const traits = shuffle(rng, CREW_TRAITS).slice(0, T.traits);
      entries.push({
        id,
        kind: 'conductor',
        tier,
        data: { id: `crew-${id}`, nftId: id, name: `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`, rarity: T.rarity, traits, str, agi, int, end },
      });
    }
  }
  return shuffle(rng, entries);
}

const poolCache = {};
export function poolOf(tier, season = SEASON) {
  const key = `${season}-${tier}`;
  if (!poolCache[key]) poolCache[key] = seasonPool(tier, season);
  return poolCache[key];
}

export function emptyVault() {
  return { version: VAULT_VERSION, season: SEASON, nexus: 0, burned: 0, opened: {}, owned: [], ledger: [] };
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

// Open a crate: a random entry from the pool, or the entry you picked for +10%.
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
  const nft = { id: entry.id, kind: entry.kind, tier, data: structuredClone(entry.data), at: now, deployedTo: null };
  vault.owned.push(nft);
  vault.ledger.push({ at: now, type: 'crate', tier, picked: !!pickId, nexus: -cratePrice(tier, !!pickId), id: entry.id });
  return nft;
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
  save.traits = crew?.traits ?? [];
  return save;
}

export const crewOf = (save, loco) => (save.crew ?? []).find((item) => item.id === loco?.crewId) ?? null;

// Put an NFT from the vault into a save: a locomotive into the garage, a conductor into the crew.
export function deployNft(vault, save, { nftId, saveId }) {
  const nft = vault.owned.find((item) => item.id === nftId);
  if (!nft) fail('You do not own that NFT.');
  if (nft.deployedTo) fail('That NFT is already with a Captain.');
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
  nft.deployedTo = saveId;
  return nft;
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

export const statBudgetOf = (tier) => CRATE_TIERS[tier];
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

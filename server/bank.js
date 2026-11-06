// Nexus Rail's bank: Nexus balances, crates, NFTs, admin awards and player-to-player sends, kept
// on the server so a balance can't be edited in the browser. Every function takes a `repo`
// (Postgres in production, memory in tests) and runs inside one transaction.
//
// The crate rules themselves live in src/game/crates.js and are shared with the game.

import { CRATE_TIERS, SEASON, VaultError, WELCOME_NEXUS, adminGrant as grantRule, markDeployed, openCrate } from '../src/game/crates.js';

export class BankError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const fail = (message, status) => {
  throw new BankError(message, status);
};
const money = (n) => Math.round(Number(n) * 100) / 100;
export const NAME_RULE = /^[A-Za-z0-9][A-Za-z0-9 _-]{1,18}[A-Za-z0-9]$/;
export const MAX_SEND = 100000;

// A starting player name from the sign-in name: letters and digits, plus 4 digits to keep it unique.
export function suggestName(raw, rng = Math.random) {
  const base = String(raw || 'Captain')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 14) || 'Captain';
  return `${base}${String(Math.floor(rng() * 9000) + 1000)}`;
}

// The vault the game shows: balance, NFTs, the shared season pools, and the player's history.
async function vaultOf(tx, player) {
  const opened = Object.fromEntries((await tx.openedIds(SEASON)).map((id) => [id, true]));
  const ledger = (await tx.ledgerFor(player.id, 40)).map((row) => ({
    at: row.at,
    type: row.kind,
    nexus: row.from_id === player.id && row.kind !== 'grant' ? -money(row.amount) : money(row.amount),
    note: row.note,
    tier: row.tier,
    picked: row.picked,
    id: row.nft_id,
    other: row.from_id === player.id ? row.to_name : row.from_name,
  }));
  return { version: 1, season: SEASON, welcomed: true, nexus: money(player.nexus), burned: money(player.burned), owned: structuredClone(player.owned), opened, ledger };
}

const publicPlayer = (p) => ({ id: p.id, name: p.name });

// Sign-in: find or create the player. New players get the welcome Nexus.
export async function signIn(repo, { id, email, display }, now = Date.now()) {
  return repo.tx(async (tx) => {
    let player = await tx.getPlayer(id, true);
    if (!player) {
      let name = suggestName(display || (email ?? '').split('@')[0]);
      for (let i = 0; i < 5 && (await tx.getPlayerByName(name)); i++) name = suggestName(display);
      player = { id, email: email ?? null, name, nexus: WELCOME_NEXUS, burned: 0, owned: [], createdAt: now, lastSeen: now };
      await tx.insertPlayer(player);
      await tx.addLedger({ at: now, kind: 'grant', from_id: null, to_id: id, amount: WELCOME_NEXUS, note: 'welcome' });
    } else {
      player.lastSeen = now;
      if (email && player.email !== email) player.email = email;
      await tx.updatePlayer(player);
    }
    return { player: publicPlayer(player), vault: await vaultOf(tx, player) };
  });
}

export async function state(repo, id) {
  return repo.tx(async (tx) => {
    const player = await tx.getPlayer(id);
    if (!player) fail('Sign in first.', 401);
    return { player: publicPlayer(player), vault: await vaultOf(tx, player) };
  });
}

// Your player name: what other players type to send you Nexus.
export async function rename(repo, id, raw) {
  const name = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (!NAME_RULE.test(name)) fail('Names are 3 to 20 letters, digits, spaces, _ or -, starting and ending with a letter or digit.');
  return repo.tx(async (tx) => {
    const player = await tx.getPlayer(id, true);
    if (!player) fail('Sign in first.', 401);
    const taken = await tx.getPlayerByName(name);
    if (taken && taken.id !== id) fail('That name is taken.');
    player.name = name;
    await tx.updatePlayer(player);
    return { player: publicPlayer(player), vault: await vaultOf(tx, player) };
  });
}

// Open a crate from the shared season pool. Two players can't take the same NFT: the pool row is
// unique, so the second one gets "already been taken".
export async function open(repo, id, { tier, pickId = null, needLoco = false, rng = Math.random }, now = Date.now()) {
  if (!CRATE_TIERS[tier]) fail('Unknown crate.');
  return repo.tx(async (tx) => {
    const player = await tx.getPlayer(id, true);
    if (!player) fail('Sign in first.', 401);
    const vault = await vaultOf(tx, player);
    let nft;
    try {
      nft = openCrate(vault, { tier, pickId, needLoco: !!needLoco, rng, now });
    } catch (error) {
      if (error instanceof VaultError) fail(error.message);
      throw error;
    }
    if (!(await tx.insertOpened(nft.id, SEASON, id, now))) fail('Someone else just took that one. Try again.', 409);
    player.nexus = vault.nexus;
    player.burned = vault.burned;
    player.owned = vault.owned;
    await tx.updatePlayer(player);
    const row = vault.ledger[vault.ledger.length - 1];
    await tx.addLedger({ at: now, kind: 'crate', from_id: id, to_id: null, amount: -row.nexus, note: '', tier, picked: !!pickId, nft_id: nft.id });
    return { nft, player: publicPlayer(player), vault: await vaultOf(tx, player) };
  });
}

// Send an NFT to one of your saves (the game puts it into the save in the browser).
export async function deploy(repo, id, { nftId, saveId }) {
  return repo.tx(async (tx) => {
    const player = await tx.getPlayer(id, true);
    if (!player) fail('Sign in first.', 401);
    const vault = { owned: player.owned };
    let nft;
    try {
      nft = markDeployed(vault, { nftId, saveId: String(saveId) });
    } catch (error) {
      if (error instanceof VaultError) fail(error.message);
      throw error;
    }
    player.owned = vault.owned;
    await tx.updatePlayer(player);
    return { nft, player: publicPlayer(player), vault: await vaultOf(tx, player) };
  });
}

// Player to player: no fee, whole or 2-decimal amounts, by player name.
export async function send(repo, id, { to, amount, note = '' }, now = Date.now()) {
  const n = money(amount);
  if (!(n > 0)) fail('Enter an amount above zero.');
  if (n > MAX_SEND) fail(`At most ${MAX_SEND.toLocaleString()} Nexus at a time.`);
  return repo.tx(async (tx) => {
    const target = await tx.getPlayerByName(String(to ?? '').trim());
    if (!target) fail('No player has that name.', 404);
    if (target.id === id) fail("You can't send Nexus to yourself.");
    // Lock both rows in a fixed order so two crossing sends can't deadlock.
    const [a, b] = [id, target.id].sort();
    const first = await tx.getPlayer(a, true);
    const second = await tx.getPlayer(b, true);
    const from = first.id === id ? first : second;
    const dest = first.id === id ? second : first;
    if (money(from.nexus) < n) fail(`You have ${money(from.nexus)} Nexus.`);
    from.nexus = money(from.nexus - n);
    dest.nexus = money(Number(dest.nexus) + n);
    await tx.updatePlayer(from);
    await tx.updatePlayer(dest);
    await tx.addLedger({ at: now, kind: 'trade', from_id: from.id, to_id: dest.id, amount: n, note: String(note).slice(0, 80) });
    return { sent: n, to: publicPlayer(dest), player: publicPlayer(from), vault: await vaultOf(tx, from) };
  });
}

// Name lookup for the send form: names only, never emails or balances.
export async function findPlayers(repo, q) {
  const text = String(q ?? '').trim();
  if (text.length < 2) return [];
  return repo.tx(async (tx) => (await tx.listPlayers(text, 8, { byEmail: false })).map(publicPlayer));
}

// ---------- admin ----------

export async function adminPlayers(repo, { q = '', limit = 200 } = {}) {
  return repo.tx(async (tx) =>
    (await tx.listPlayers(String(q).trim(), limit)).map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      nexus: money(p.nexus),
      nfts: p.owned.length,
      createdAt: p.createdAt,
      lastSeen: p.lastSeen,
    })),
  );
}

export async function adminAward(repo, adminId, { playerId, amount, note = '' }, now = Date.now()) {
  return repo.tx(async (tx) => {
    const player = await tx.getPlayer(playerId, true);
    if (!player) fail('No such player.', 404);
    const vault = { nexus: money(player.nexus), ledger: [] };
    try {
      grantRule(vault, { amount, note, now });
    } catch (error) {
      if (error instanceof VaultError) fail(error.message);
      throw error;
    }
    const n = money(vault.nexus - money(player.nexus));
    player.nexus = vault.nexus;
    await tx.updatePlayer(player);
    await tx.addLedger({ at: now, kind: 'grant', from_id: adminId, to_id: player.id, amount: n, note: String(note || 'admin award').slice(0, 80) });
    return { player: { id: player.id, name: player.name, nexus: player.nexus } };
  });
}

export async function adminLedger(repo, playerId, limit = 50) {
  return repo.tx(async (tx) => tx.ledgerFor(playerId, limit));
}

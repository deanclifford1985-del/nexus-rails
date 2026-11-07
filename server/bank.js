// Nexus Rail's bank: Nexus balances, crates, NFTs, admin awards and player-to-player sends, kept
// on the server so a balance can't be edited in the browser. Every function takes a `repo`
// (Postgres in production, memory in tests) and runs inside one transaction.
//
// The crate rules themselves live in src/game/crates.js and are shared with the game.

import { CRATE_TIERS, SEASON, VaultError, WELCOME_NEXUS, adminGrant as grantRule, cratePrice, markDeployed, openCrate } from '../src/game/crates.js';
import { TREASURY, crateSale, earn as earnRule, emptyTreasury, moneyIn, priceOf, spend as spendRule, summary, swap as swapRule } from '../src/game/treasury.js';

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
const tenth = (n) => Math.round(Number(n) * 10) / 10;
const paidOf = (p) => money(p.nexus - Math.min(money(p.nexus), money(p.bonus ?? 0)));
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
  const bonus = Math.min(money(player.nexus), money(player.bonus ?? 0));
  return { version: 1, season: SEASON, welcomed: true, nexus: money(player.nexus), bonus, paid: money(player.nexus - bonus), lt: tenth(player.lt ?? 0), burned: money(player.burned), owned: structuredClone(player.owned), opened, ledger };
}

const publicPlayer = (p) => ({ id: p.id, name: p.name });

// Sign-in: find or create the player. New players get the welcome Nexus.
export async function signIn(repo, { id, email, display }, now = Date.now()) {
  return repo.tx(async (tx) => {
    let player = await tx.getPlayer(id, true);
    if (!player) {
      let name = suggestName(display || (email ?? '').split('@')[0]);
      for (let i = 0; i < 5 && (await tx.getPlayerByName(name)); i++) name = suggestName(display);
      player = { id, email: email ?? null, name, nexus: WELCOME_NEXUS, bonus: WELCOME_NEXUS, lt: 0, burned: 0, owned: [], createdAt: now, lastSeen: now };
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

// Open a crate from the shared season pool (a locomotive and a conductor). Two players can't take the same crate: the pool row is
// unique, so the second one gets "already been taken".
export async function open(repo, id, { tier, pickId = null, rng = Math.random }, now = Date.now()) {
  if (!CRATE_TIERS[tier]) fail('Unknown crate.');
  return repo.tx(async (tx) => {
    const t = await treasuryOf(tx);
    const player = await tx.getPlayer(id, true);
    if (!player) fail('Sign in first.', 401);
    const vault = await vaultOf(tx, player);
    const price = cratePrice(tier, !!pickId);
    const bonusUsed = Math.min(vault.bonus, price);
    let got;
    try {
      got = openCrate(vault, { tier, pickId, rng, now });
    } catch (error) {
      if (error instanceof VaultError) fail(error.message);
      throw error;
    }
    if (!(await tx.insertOpened(got.crate, SEASON, id, now))) fail('Someone else just took that one. Try again.', 409);
    player.nexus = vault.nexus;
    player.bonus = money(vault.bonus - bonusUsed);
    player.burned = vault.burned;
    player.owned = vault.owned;
    await tx.updatePlayer(player);
    // Paid Nexus feed the treasury (85%) and the house (15%); welcome and gift Nexus don't.
    const paidUsed = money(price - bonusUsed);
    if (paidUsed > 0) {
      const share = money(paidUsed * TREASURY.nexusUsd * TREASURY.crateShare);
      const released = crateSale(t, paidUsed);
      await tx.saveTreasury(t);
      await tx.addFlow({ at: now, kind: 'crate', player_id: id, lt: released, usd: share, note: CRATE_TIERS[tier].name });
    }
    const row = vault.ledger[vault.ledger.length - 1];
    await tx.addLedger({ at: now, kind: 'crate', from_id: id, to_id: null, amount: -row.nexus, note: '', tier, picked: !!pickId, nft_id: got.crate });
    return { crate: got.crate, nfts: got.nfts, player: publicPlayer(player), vault: await vaultOf(tx, player) };
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
    if (paidOf(from) < n) fail(money(from.nexus) > paidOf(from) ? `You can send ${paidOf(from)} Nexus. Welcome and gift Nexus can only be spent on crates.` : `You have ${money(from.nexus)} Nexus.`);
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

export async function adminAward(repo, adminId, { playerId, amount, note = '', paid = true }, now = Date.now()) {
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
    if (!paid) player.bonus = money((player.bonus ?? 0) + n);
    await tx.updatePlayer(player);
    await tx.addLedger({ at: now, kind: 'grant', from_id: adminId, to_id: player.id, amount: n, note: String(note || (paid ? 'buy-in' : 'gift')).slice(0, 80) });
    return { player: { id: player.id, name: player.name, nexus: player.nexus, bonus: money(player.bonus ?? 0) } };
  });
}

export async function adminLedger(repo, playerId, limit = 50) {
  return repo.tx(async (tx) => tx.ledgerFor(playerId, limit));
}

// ---------- the LocoToken treasury ----------

// The treasury row. The first time it is made, every existing player's welcome Nexus is marked as
// gift Nexus (spendable on crates, not sendable or cashable), like new players'.
async function treasuryOf(tx) {
  const { data, isNew } = await tx.getTreasury();
  if (isNew) {
    await tx.markWelcomeBonus(WELCOME_NEXUS);
    const t = emptyTreasury();
    await tx.saveTreasury(t);
    return t;
  }
  return { ...emptyTreasury(), ...data };
}

const DAY = 24 * 60 * 60 * 1000;
const PUBLIC_KINDS = ['deposit', 'crate', 'swap'];

// The Treasury screen: the dashboard everyone sees, plus your own LT, earnings and cash-outs.
export async function treasury(repo, id, now = Date.now()) {
  return repo.tx(async (tx) => {
    const t = await treasuryOf(tx);
    const player = await tx.getPlayer(id);
    if (!player) fail('Sign in first.', 401);
    const price = priceOf(t);
    const earned = {};
    for (const [key, days] of [['week', 7], ['month', 30], ['year', 365], ['all', null]]) {
      const lt = tenth(await tx.sumFlow(id, 'earn', days ? now - days * DAY : 0));
      earned[key] = { lt, usd: lt * price };
    }
    const events = (await tx.recentFlows(20, PUBLIC_KINDS)).map((f) => ({ at: f.at, kind: f.kind, who: f.kind === 'deposit' ? 'Treasury' : f.player_name, lt: Number(f.lt), usd: Number(f.usd), note: f.note }));
    const cashouts = (await tx.listCashouts({ playerId: id, limit: 20 })).map((c) => ({ id: c.id, at: c.at, nexus: c.nexus, status: c.status, decidedAt: c.decided_at }));
    const lt = tenth(player.lt ?? 0);
    return {
      treasury: summary(t),
      events,
      me: { lt, ltUsd: lt * price, earned, paid: paidOf(player), bonus: money(Math.min(player.nexus, player.bonus ?? 0)), nexus: money(player.nexus), cashouts },
    };
  });
}

// The game reports a Captain's LT change since the last report. Earnings come out of the pool
// (scaled down if it is low); spending goes back into it.
export async function syncLt(repo, id, { delta, reason = '' }, now = Date.now()) {
  const d = tenth(delta);
  if (!Number.isFinite(d)) fail('Bad amount.');
  return repo.tx(async (tx) => {
    const t = await treasuryOf(tx);
    if (!t.funded) return { granted: 0, unfunded: true, treasury: summary(t) };
    const player = await tx.getPlayer(id, true);
    if (!player) fail('Sign in first.', 401);
    const price = priceOf(t);
    let granted = 0;
    if (d > 0) {
      granted = earnRule(t, d);
      player.lt = tenth((player.lt ?? 0) + granted);
      if (granted > 0) await tx.addFlow({ at: now, kind: 'earn', player_id: id, lt: granted, usd: granted * price, note: String(reason).slice(0, 40) });
    } else if (d < 0) {
      const back = spendRule(t, Math.min(-d, player.lt ?? 0));
      player.lt = tenth((player.lt ?? 0) - back);
      granted = d; // spending always goes through in the game
      if (back > 0) await tx.addFlow({ at: now, kind: 'spend', player_id: id, lt: back, usd: back * price, note: String(reason).slice(0, 40) });
    }
    await tx.saveTreasury(t);
    await tx.updatePlayer(player);
    return { granted, rate: d > 0 ? granted / Math.min(d, TREASURY.maxSync) : 1, treasury: summary(t) };
  });
}

// Swap LT for Nexus at today's price. The LT go on hold and come back into the pool as money comes in.
export async function swapLt(repo, id, { lt }, now = Date.now()) {
  const n = tenth(lt);
  if (!(n > 0)) fail('Enter an amount of LT above zero.');
  return repo.tx(async (tx) => {
    const t = await treasuryOf(tx);
    if (!t.funded) fail("The treasury isn't open yet.");
    const player = await tx.getPlayer(id, true);
    if (!player) fail('Sign in first.', 401);
    if ((player.lt ?? 0) < n) fail(`You have ${tenth(player.lt ?? 0).toLocaleString()} LT in the treasury's books.`);
    const { nexus, used } = swapRule(t, n);
    if (!(nexus > 0)) fail(`That's worth less than 0.01 Nexus. Swap at least ${Math.ceil(0.01 / priceOf(t)).toLocaleString()} LT.`);
    player.lt = tenth(player.lt - used);
    player.nexus = money(player.nexus + nexus);
    await tx.saveTreasury(t);
    await tx.updatePlayer(player);
    await tx.addFlow({ at: now, kind: 'swap', player_id: id, lt: used, usd: nexus * TREASURY.nexusUsd, note: '' });
    await tx.addLedger({ at: now, kind: 'swap', from_id: null, to_id: id, amount: nexus, note: `${used.toLocaleString()} LT` });
    return { nexus, lt: used, player: publicPlayer(player), vault: await vaultOf(tx, player) };
  });
}

// Ask to cash out paid Nexus. The Nexus leave your balance now; an admin pays you and marks it paid
// (or turns it down and the Nexus come back).
export async function requestCashout(repo, id, { nexus }, now = Date.now()) {
  const n = money(nexus);
  if (!(n >= TREASURY.minCashout)) fail(`Cash out at least ${TREASURY.minCashout} Nexus.`);
  return repo.tx(async (tx) => {
    const player = await tx.getPlayer(id, true);
    if (!player) fail('Sign in first.', 401);
    if (paidOf(player) < n) fail(`You can cash out ${paidOf(player)} Nexus. Welcome and gift Nexus can only be spent on crates.`);
    player.nexus = money(player.nexus - n);
    await tx.updatePlayer(player);
    const cashoutId = await tx.addCashout({ at: now, player_id: id, nexus: n, note: '' });
    await tx.addLedger({ at: now, kind: 'cashout', from_id: id, to_id: null, amount: n, note: `request #${cashoutId}` });
    return { id: cashoutId, nexus: n, player: publicPlayer(player), vault: await vaultOf(tx, player) };
  });
}

export async function adminDeposit(repo, adminId, { usd, note = '' }, now = Date.now()) {
  const n = money(usd);
  if (!(n > 0)) fail('Enter a dollar amount above zero.');
  if (n > 100000) fail('At most $100,000 at a time.');
  return repo.tx(async (tx) => {
    const t = await treasuryOf(tx);
    const released = moneyIn(t, n, 'deposit');
    await tx.saveTreasury(t);
    await tx.addFlow({ at: now, kind: 'deposit', player_id: null, lt: released, usd: n, note: String(note || 'deposit').slice(0, 80) });
    return { released, treasury: summary(t) };
  });
}

export async function adminCashouts(repo, { status = null } = {}) {
  return repo.tx(async (tx) =>
    (await tx.listCashouts({ status, limit: 100 })).map((c) => ({ id: c.id, at: c.at, nexus: c.nexus, status: c.status, decidedAt: c.decided_at, player: c.player_name, email: c.player_email, playerId: c.player_id })),
  );
}

export async function adminDecideCashout(repo, adminId, { cashoutId, action }, now = Date.now()) {
  if (!['paid', 'rejected'].includes(action)) fail('Mark it paid or rejected.');
  return repo.tx(async (tx) => {
    const t = await treasuryOf(tx);
    const c = await tx.getCashout(cashoutId);
    if (!c) fail('No such request.', 404);
    if (c.status !== 'pending') fail(`That request is already ${c.status}.`);
    c.status = action;
    c.decided_at = now;
    await tx.updateCashout(c);
    if (action === 'paid') {
      t.cashedOut = money(t.cashedOut + c.nexus * TREASURY.nexusUsd);
      await tx.saveTreasury(t);
    } else {
      const player = await tx.getPlayer(c.player_id, true);
      player.nexus = money(player.nexus + c.nexus);
      await tx.updatePlayer(player);
      await tx.addLedger({ at: now, kind: 'refund', from_id: null, to_id: c.player_id, amount: c.nexus, note: `request #${c.id} turned down` });
    }
    return { id: c.id, status: c.status };
  });
}

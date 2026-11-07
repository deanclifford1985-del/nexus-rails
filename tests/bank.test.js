import { describe, expect, it } from 'vitest';
import * as bank from '../server/bank.js';
import { memoryRepo } from '../server/repo-memory.js';
import { createApp } from '../server/index.js';
import { poolOf } from '../src/game/crates.js';

// Runs on the in-memory repo; set NR_PG_URL to run the same tests against a real Postgres.
async function makeRepo() {
  const url = process.env.NR_PG_URL;
  if (!url) return memoryRepo();
  const pg = (await import('pg')).default;
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  await c.query('drop table if exists nr_players, nr_opened, nr_ledger, nr_treasury, nr_flow, nr_cashouts');
  await c.end();
  const { pgRepo } = await import('../server/repo-pg.js');
  return pgRepo(url);
}

const ann = { id: 'u1', email: 'ann@example.com', display: 'Ann' };
const bob = { id: 'u2', email: 'bob@example.com', display: 'Bob' };

describe('the Nexus bank', () => {
  it('signs players in with 10 welcome Nexus, once', async () => {
    const repo = await makeRepo();
    const first = await bank.signIn(repo, ann);
    expect(first.vault.nexus).toBe(10);
    expect(first.vault.ledger.at(-1)).toMatchObject({ type: 'grant', note: 'welcome', nexus: 10 });
    const again = await bank.signIn(repo, ann);
    expect(again.vault.nexus).toBe(10);
    expect(first.player.name).toMatch(/^Ann\d{4}$/);
  });

  it('keeps player names unique, ignoring case', async () => {
    const repo = await makeRepo();
    await bank.signIn(repo, ann);
    await bank.signIn(repo, bob);
    await bank.rename(repo, 'u1', 'Iron Ann');
    await expect(bank.rename(repo, 'u2', 'iron ann')).rejects.toThrow('taken');
    await expect(bank.rename(repo, 'u2', '!')).rejects.toThrow('3 to 20');
  });

  it('shares crate pools between players and charges the opener', async () => {
    const repo = await makeRepo();
    await bank.signIn(repo, ann);
    await bank.signIn(repo, bob);
    const id = poolOf('basic')[0].id;
    await bank.adminAward(repo, 'admin', { playerId: 'u1', amount: 20 });
    await bank.adminAward(repo, 'admin', { playerId: 'u2', amount: 20 });
    const got = await bank.open(repo, 'u1', { tier: 'basic', pickId: id });
    expect(got.crate).toBe(id);
    expect(got.vault.nexus).toBe(19);
    expect(got.vault.owned.map((o) => o.id)).toEqual([`${id}-T`, `${id}-C`]);
    await expect(bank.open(repo, 'u2', { tier: 'basic', pickId: id })).rejects.toThrow('already been taken');
    const bobs = await bank.state(repo, 'u2');
    expect(bobs.vault.opened[id]).toBe(true);
    expect(bobs.vault.nexus).toBe(30);
  });

  it('a crate gives a locomotive and a conductor, and deploy marks each once', async () => {
    const repo = await makeRepo();
    await bank.signIn(repo, ann);
    const got = await bank.open(repo, 'u1', { tier: 'basic', rng: () => 0.5 });
    expect(got.nfts.map((n) => n.kind)).toEqual(['loco', 'conductor']);
    expect(got.vault.nexus).toBe(0);
    expect(got.vault.owned).toHaveLength(2);
    await bank.deploy(repo, 'u1', { nftId: got.nfts[0].id, saveId: 123 });
    await expect(bank.deploy(repo, 'u1', { nftId: got.nfts[0].id, saveId: 123 })).rejects.toThrow('already with a Captain');
    await bank.deploy(repo, 'u1', { nftId: got.nfts[1].id, saveId: 123 });
  });

  it('sends Nexus between players by name, with no fee', async () => {
    const repo = await makeRepo();
    await bank.signIn(repo, ann);
    await bank.signIn(repo, bob);
    await bank.rename(repo, 'u2', 'Bob');
    // Welcome Nexus can't be sent: only paid Nexus (buy-ins, swaps).
    await expect(bank.send(repo, 'u1', { to: 'bob', amount: 1 })).rejects.toThrow('can only be spent on crates');
    await bank.adminAward(repo, 'admin', { playerId: 'u1', amount: 10, paid: true });
    const out = await bank.send(repo, 'u1', { to: 'bob', amount: 4.5, note: 'for the crate' });
    expect(out.vault.nexus).toBe(15.5);
    expect(out.vault.paid).toBe(5.5);
    expect(out.vault.ledger.at(-1)).toMatchObject({ type: 'trade', nexus: -4.5, other: 'Bob' });
    const b = await bank.state(repo, 'u2');
    expect(b.vault.nexus).toBe(14.5);
    expect(b.vault.ledger.at(-1)).toMatchObject({ type: 'trade', nexus: 4.5, note: 'for the crate' });
    await expect(bank.send(repo, 'u1', { to: 'Bob', amount: 6 })).rejects.toThrow('You can send 5.5');
    await expect(bank.send(repo, 'u1', { to: 'Nobody', amount: 1 })).rejects.toThrow('No player');
    await expect(bank.send(repo, 'u2', { to: 'Bob', amount: 1 })).rejects.toThrow('yourself');
    await expect(bank.send(repo, 'u1', { to: 'Bob', amount: -3 })).rejects.toThrow('above zero');
  });

  it('lets admins list players and award Nexus; the name search never matches emails', async () => {
    const repo = await makeRepo();
    await bank.signIn(repo, ann);
    await bank.signIn(repo, bob);
    const list = await bank.adminPlayers(repo);
    expect(list.map((p) => p.email).sort()).toEqual(['ann@example.com', 'bob@example.com']);
    await bank.adminAward(repo, 'admin', { playerId: 'u2', amount: 25, note: 'tournament' });
    expect((await bank.state(repo, 'u2')).vault.nexus).toBe(35);
    expect(await bank.findPlayers(repo, 'example.com')).toEqual([]);
    expect((await bank.adminPlayers(repo, { q: 'bob@' })).length).toBe(1);
  });
});

describe('the API', () => {
  it('requires sign-in, keeps admin routes for admins, and works end to end', async () => {
    process.env.VITE_EDITION = 'nft';
    process.env.ADMIN_EMAILS = 'boss@example.com';
    const { app } = await createApp({ repo: memoryRepo(), authMode: 'dev' });
    const server = app.listen(0);
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = (url, { user, email, body, method } = {}) =>
      fetch(base + url, {
        method: method ?? (body ? 'POST' : 'GET'),
        headers: { 'content-type': 'application/json', ...(user ? { 'x-dev-user': user, 'x-dev-email': email ?? `${user}@example.com` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      }).then(async (r) => ({ status: r.status, json: await r.json() }));
    try {
      expect((await call('/api/state')).status).toBe(401);
      const me = await call('/api/session', { user: 'cat', body: {} });
      expect(me.json.vault.nexus).toBe(10);
      expect(me.json.admin).toBe(false);
      expect((await call('/api/admin/players', { user: 'cat' })).status).toBe(403);
      const boss = await call('/api/session', { user: 'boss', email: 'boss@example.com', body: {} });
      expect(boss.json.admin).toBe(true);
      const list = await call('/api/admin/players', { user: 'boss', email: 'boss@example.com' });
      const cat = list.json.find((p) => p.email === 'cat@example.com');
      const award = await call('/api/admin/award', { user: 'boss', email: 'boss@example.com', body: { playerId: cat.id, amount: 25 } });
      expect(award.json.player.nexus).toBe(35);
      await call('/api/name', { user: 'boss', email: 'boss@example.com', body: { name: 'The Boss' } });
      const sent = await call('/api/send', { user: 'cat', body: { to: 'the boss', amount: 5 } });
      expect(sent.json.vault.nexus).toBe(30);
    } finally {
      server.close();
    }
  });
});

describe('the LocoToken treasury', () => {
  it('prices LT from the dollars behind them and keeps the price steady through every move', async () => {
    const repo = await makeRepo();
    await bank.signIn(repo, ann);
    await bank.signIn(repo, bob);
    // Before any money comes in, earnings wait.
    expect((await bank.syncLt(repo, 'u1', { delta: 500 })).unfunded).toBe(true);
    const dep = await bank.adminDeposit(repo, 'admin', { usd: 100, note: 'seed' });
    expect(dep.released).toBe(1000000); // 10,000 LT per $1
    expect(dep.treasury).toMatchObject({ usd: 100, supply: 1000000, pool: 1000000, ltPerDollar: 10000 });
    // Earning takes LT out of the pool; spending puts them back. The price doesn't move.
    const e = await bank.syncLt(repo, 'u1', { delta: 20000 });
    expect(e.granted).toBe(20000);
    await bank.syncLt(repo, 'u1', { delta: -5000 });
    let t = (await bank.treasury(repo, 'u1')).treasury;
    expect(t).toMatchObject({ pool: 985000, held: 15000, ltPerDollar: 10000 });
    // A Basic crate bought with paid Nexus: $8.50 in, $1.50 to the house, 85,000 LT released.
    await bank.adminAward(repo, 'admin', { playerId: 'u2', amount: 10, paid: true });
    await bank.open(repo, 'u2', { tier: 'basic', rng: () => 0.2 }); // spends the 10 welcome Nexus first
    t = (await bank.treasury(repo, 'u1')).treasury;
    expect(t.crateIn).toBe(0);
    await bank.open(repo, 'u2', { tier: 'basic', rng: () => 0.4 }); // now the paid 10
    t = (await bank.treasury(repo, 'u1')).treasury;
    expect(t).toMatchObject({ usd: 108.5, crateIn: 8.5, house: 1.5, ltPerDollar: 10000 });
    expect(t.pool).toBe(985000 + 85000);
    // Swap 15,000 LT: $1.50 worth of Nexus, the LT go on hold, the price holds.
    const sw = await bank.swapLt(repo, 'u1', { lt: 15000 });
    expect(sw.nexus).toBe(1.5);
    expect(sw.vault).toMatchObject({ lt: 0, paid: 1.5, bonus: 10 });
    t = (await bank.treasury(repo, 'u1')).treasury;
    expect(t).toMatchObject({ usd: 107, waiting: 15000, ltPerDollar: 10000 });
    // The next money in releases the LT on hold first.
    await bank.adminDeposit(repo, 'admin', { usd: 1 });
    expect((await bank.treasury(repo, 'u1')).treasury.waiting).toBe(5000);
    // Nexus are whole cents: a swap only uses the LT those cents are worth.
    await bank.syncLt(repo, 'u1', { delta: 287.5 });
    const odd = await bank.swapLt(repo, 'u1', { lt: 287.5 });
    expect(odd).toMatchObject({ nexus: 0.02, lt: 200 });
    expect(odd.vault.lt).toBe(87.5);
    expect((await bank.treasury(repo, 'u1')).treasury.ltPerDollar).toBe(10000);
  });

  it('records earnings by week, month, year and all time, valued at today\'s price', async () => {
    const repo = await makeRepo();
    await bank.signIn(repo, ann);
    await bank.adminDeposit(repo, 'admin', { usd: 100 });
    const day = 24 * 3600 * 1000;
    const now = Date.now();
    await bank.syncLt(repo, 'u1', { delta: 1000 }, now - 400 * day);
    await bank.syncLt(repo, 'u1', { delta: 2000 }, now - 100 * day);
    await bank.syncLt(repo, 'u1', { delta: 3000 }, now - 10 * day);
    await bank.syncLt(repo, 'u1', { delta: 4000 }, now - 1 * day);
    const me = (await bank.treasury(repo, 'u1', now)).me;
    expect(me.earned.week.lt).toBe(4000);
    expect(me.earned.month.lt).toBe(7000);
    expect(me.earned.year.lt).toBe(9000);
    expect(me.earned.all.lt).toBe(10000);
    expect(me.earned.all.usd).toBeCloseTo(1, 5);
    expect(me.ltUsd).toBeCloseTo(1, 5);
  });

  it('shrinks payouts when the pool runs low, so it never runs dry', async () => {
    const repo = await makeRepo();
    await bank.signIn(repo, ann);
    await bank.adminDeposit(repo, 'admin', { usd: 10 }); // 100,000 LT
    for (let i = 0; i < 9; i++) await bank.syncLt(repo, 'u1', { delta: 10000 });
    let t = (await bank.treasury(repo, 'u1')).treasury;
    expect(t.pool).toBe(10000);
    const low = await bank.syncLt(repo, 'u1', { delta: 4000 });
    expect(low.granted).toBe(4000); // still 100% at exactly 10%
    t = (await bank.treasury(repo, 'u1')).treasury;
    expect(t.rate).toBeLessThan(1);
    for (let i = 0; i < 20; i++) await bank.syncLt(repo, 'u1', { delta: 10000 });
    t = (await bank.treasury(repo, 'u1')).treasury;
    expect(t.pool).toBeGreaterThanOrEqual(0);
    expect(t.held + t.pool).toBe(t.supply);
  });

  it('cash-outs take paid Nexus only; admins mark them paid or turn them down', async () => {
    const repo = await makeRepo();
    await bank.signIn(repo, ann);
    await expect(bank.requestCashout(repo, 'u1', { nexus: 5 })).rejects.toThrow('can only be spent on crates');
    await bank.adminAward(repo, 'admin', { playerId: 'u1', amount: 20, paid: true });
    await bank.adminAward(repo, 'admin', { playerId: 'u1', amount: 5, paid: false });
    const a = await bank.requestCashout(repo, 'u1', { nexus: 12 });
    expect(a.vault).toMatchObject({ nexus: 23, paid: 8, bonus: 15 });
    const b = await bank.requestCashout(repo, 'u1', { nexus: 8 });
    expect((await bank.adminCashouts(repo, { status: 'pending' })).length).toBe(2);
    await bank.adminDecideCashout(repo, 'admin', { cashoutId: a.id, action: 'paid' });
    await bank.adminDecideCashout(repo, 'admin', { cashoutId: b.id, action: 'rejected' });
    await expect(bank.adminDecideCashout(repo, 'admin', { cashoutId: b.id, action: 'paid' })).rejects.toThrow('already rejected');
    const me = (await bank.treasury(repo, 'u1')).me;
    expect(me).toMatchObject({ nexus: 23, paid: 8 });
    expect(me.cashouts.map((c) => c.status)).toEqual(['rejected', 'paid']);
    expect((await bank.treasury(repo, 'u1')).treasury.cashedOut).toBe(12);
  });
});

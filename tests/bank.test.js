import { describe, expect, it } from 'vitest';
import * as bank from '../server/bank.js';
import { memoryRepo } from '../server/repo-memory.js';
import { createApp } from '../server/index.js';
import { poolOf } from '../src/game/crates.js';

const ann = { id: 'u1', email: 'ann@example.com', display: 'Ann' };
const bob = { id: 'u2', email: 'bob@example.com', display: 'Bob' };

describe('the Nexus bank', () => {
  it('signs players in with 10 welcome Nexus, once', async () => {
    const repo = memoryRepo();
    const first = await bank.signIn(repo, ann);
    expect(first.vault.nexus).toBe(10);
    expect(first.vault.ledger.at(-1)).toMatchObject({ type: 'grant', note: 'welcome', nexus: 10 });
    const again = await bank.signIn(repo, ann);
    expect(again.vault.nexus).toBe(10);
    expect(first.player.name).toMatch(/^Ann\d{4}$/);
  });

  it('keeps player names unique, ignoring case', async () => {
    const repo = memoryRepo();
    await bank.signIn(repo, ann);
    await bank.signIn(repo, bob);
    await bank.rename(repo, 'u1', 'Iron Ann');
    await expect(bank.rename(repo, 'u2', 'iron ann')).rejects.toThrow('taken');
    await expect(bank.rename(repo, 'u2', '!')).rejects.toThrow('3 to 20');
  });

  it('shares crate pools between players and charges the opener', async () => {
    const repo = memoryRepo();
    await bank.signIn(repo, ann);
    await bank.signIn(repo, bob);
    const id = poolOf('uncommon')[0].id;
    await bank.adminAward(repo, 'admin', { playerId: 'u1', amount: 20 });
    await bank.adminAward(repo, 'admin', { playerId: 'u2', amount: 20 });
    const got = await bank.open(repo, 'u1', { tier: 'uncommon', pickId: id });
    expect(got.nft.id).toBe(id);
    expect(got.vault.nexus).toBe(19);
    expect(got.vault.owned.map((o) => o.id)).toEqual([id]);
    await expect(bank.open(repo, 'u2', { tier: 'uncommon', pickId: id })).rejects.toThrow('already been taken');
    const bobs = await bank.state(repo, 'u2');
    expect(bobs.vault.opened[id]).toBe(true);
    expect(bobs.vault.nexus).toBe(30);
  });

  it('a first crate for an empty garage is a locomotive, and deploy marks it once', async () => {
    const repo = memoryRepo();
    await bank.signIn(repo, ann);
    const got = await bank.open(repo, 'u1', { tier: 'uncommon', needLoco: true, rng: () => 0.5 });
    expect(got.nft.kind).toBe('loco');
    expect(got.vault.nexus).toBe(0);
    expect(got.vault.owned).toHaveLength(1);
    await bank.deploy(repo, 'u1', { nftId: got.nft.id, saveId: 123 });
    await expect(bank.deploy(repo, 'u1', { nftId: got.nft.id, saveId: 123 })).rejects.toThrow('already with a Captain');
  });

  it('sends Nexus between players by name, with no fee', async () => {
    const repo = memoryRepo();
    await bank.signIn(repo, ann);
    await bank.signIn(repo, bob);
    await bank.rename(repo, 'u2', 'Bob');
    const out = await bank.send(repo, 'u1', { to: 'bob', amount: 4.5, note: 'for the crate' });
    expect(out.vault.nexus).toBe(5.5);
    expect(out.vault.ledger.at(-1)).toMatchObject({ type: 'trade', nexus: -4.5, other: 'Bob' });
    const b = await bank.state(repo, 'u2');
    expect(b.vault.nexus).toBe(14.5);
    expect(b.vault.ledger.at(-1)).toMatchObject({ type: 'trade', nexus: 4.5, note: 'for the crate' });
    await expect(bank.send(repo, 'u1', { to: 'Bob', amount: 6 })).rejects.toThrow('You have 5.5');
    await expect(bank.send(repo, 'u1', { to: 'Nobody', amount: 1 })).rejects.toThrow('No player');
    await expect(bank.send(repo, 'u2', { to: 'Bob', amount: 1 })).rejects.toThrow('yourself');
    await expect(bank.send(repo, 'u1', { to: 'Bob', amount: -3 })).rejects.toThrow('above zero');
  });

  it('lets admins list players and award Nexus; the name search never matches emails', async () => {
    const repo = memoryRepo();
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

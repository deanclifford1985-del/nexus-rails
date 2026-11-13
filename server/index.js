// Nexus Rail's server: the game's pages plus, for the NFT edition, the bank API (balances, crates,
// sends, admin). Run `npm start` (production, serves dist/) or `npm run dev` (Vite in middleware).
//
// Sign-in is Clerk (Google or email; players don't need a Replit account). Admins are the signed-in
// accounts whose email is in ADMIN_EMAILS. For local tests only, NEXUS_DEV_AUTH=1 trusts an
// x-dev-user header instead (never in production).

import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as bank from './bank.js';
import { BankError } from './bank.js';
import { memoryRepo } from './repo-memory.js';
import { CLERK_PROXY_PATH, clerkProxyHost, clerkProxyMiddleware } from './clerkProxy.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const production = process.env.NODE_ENV === 'production';

// The edition comes from the environment or .env.local (the NFT project sets VITE_EDITION=nft).
function readEnvFile(file) {
  try {
    return Object.fromEntries(
      fs
        .readFileSync(path.join(root, file), 'utf8')
        .split('\n')
        .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
        .filter(Boolean)
        .map((m) => [m[1], m[2].replace(/^['"]|['"]$/g, '')]),
    );
  } catch {
    return {};
  }
}
const fileEnv = { ...readEnvFile('.env'), ...readEnvFile('.env.local') };
const env = (key) => process.env[key] ?? fileEnv[key];
const editionOf = () => ((env('VITE_EDITION') ?? 'lite').toLowerCase() === 'nft' ? 'nft' : 'lite');
const adminsOf = () =>
  new Set(
    String(env('ADMIN_EMAILS') ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );

export async function createApp({ repo = null, authMode = null } = {}) {
  const app = express();
  app.disable('x-powered-by');
  // Replit serves the app over https through its own proxy: trust it for the protocol and host.
  app.set('trust proxy', true);
  const edition = editionOf();
  const admins = adminsOf();
  const mode = authMode ?? (env('CLERK_SECRET_KEY') ? 'clerk' : !production && env('NEXUS_DEV_AUTH') === '1' ? 'dev' : 'none');

  // Clerk first, before any body parser. In production Clerk's own sign-in traffic is proxied
  // through this server at /api/__clerk (Replit's managed Clerk setup).
  let clerk = null;
  if (mode === 'clerk') {
    clerk = await import('@clerk/express');
    app.use(CLERK_PROXY_PATH, clerkProxyMiddleware({ production, secretKey: env('CLERK_SECRET_KEY') }));
    app.use(clerk.clerkMiddleware());
  }
  app.use('/api', express.json({ limit: '32kb' }));

  if (edition === 'nft' && !repo) {
    const url = env('DATABASE_URL');
    if (url) {
      const { pgRepo } = await import('./repo-pg.js');
      repo = await pgRepo(url);
    } else {
      if (production) console.warn('No DATABASE_URL: Nexus balances will not survive a restart.');
      repo = memoryRepo();
    }
  }

  // Who is calling: { id, email, display } or null.
  const profiles = new Map();
  async function whoIs(req) {
    if (mode === 'dev') {
      const id = req.get('x-dev-user');
      return id ? { id: `dev:${id}`, email: req.get('x-dev-email') ?? `${id}@dev.local`, display: id } : null;
    }
    if (mode !== 'clerk') return null;
    const { userId } = clerk.getAuth(req);
    if (!userId) return null;
    const cached = profiles.get(userId);
    if (cached && cached.until > Date.now()) return cached.who;
    const user = await clerk.clerkClient.users.getUser(userId);
    const email = user.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress ?? null;
    const who = { id: userId, email, display: user.firstName || user.username || (email ?? '').split('@')[0] };
    profiles.set(userId, { who, until: Date.now() + 5 * 60 * 1000 });
    return who;
  }
  const isAdmin = (who) => !!who?.email && admins.has(who.email.toLowerCase());

  const route = (handler, { admin = false } = {}) => async (req, res) => {
    try {
      if (edition !== 'nft') throw new BankError('Nexus is part of Nexus Rail (NFT edition).', 404);
      if (mode === 'none') throw new BankError("Sign-in isn't set up on this server yet.", 503);
      const who = await whoIs(req);
      if (!who) throw new BankError('Sign in first.', 401);
      if (admin && !isAdmin(who)) throw new BankError('Admins only.', 403);
      res.json(await handler(who, req));
    } catch (error) {
      if (error instanceof BankError) return res.status(error.status).json({ error: error.message });
      console.error(error);
      res.status(500).json({ error: 'Something went wrong on the server.' });
    }
  };

  app.get('/api/config', (req, res) => {
    const key = env('CLERK_PUBLISHABLE_KEY') ?? env('VITE_CLERK_PUBLISHABLE_KEY') ?? null;
    // The published app signs in through this server's proxy; the editor preview talks to Clerk directly.
    const proxied = mode === 'clerk' && production && String(key ?? '').startsWith('pk_live_');
    const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol).split(',')[0].trim() || 'https';
    res.json({ edition, auth: mode, clerkPublishableKey: mode === 'clerk' ? key : null, proxyUrl: proxied ? `${proto}://${clerkProxyHost(req)}${CLERK_PROXY_PATH}` : null });
  });
  app.post('/api/session', route(async (who) => ({ ...(await bank.signIn(repo, who)), admin: isAdmin(who) })));
  app.get('/api/state', route(async (who) => ({ ...(await bank.state(repo, who.id)), admin: isAdmin(who) })));
  app.post('/api/name', route((who, req) => bank.rename(repo, who.id, req.body?.name)));
  app.post('/api/crates/open', route((who, req) => bank.open(repo, who.id, { tier: req.body?.tier, pickId: req.body?.pickId ?? null })));
  app.post('/api/nft/deploy', route((who, req) => bank.deploy(repo, who.id, { nftId: req.body?.nftId, saveId: req.body?.saveId })));
  app.post('/api/nft/release', route((who, req) => bank.releaseSave(repo, who.id, { saveId: req.body?.saveId })));
  app.post('/api/send', route((who, req) => bank.send(repo, who.id, { to: req.body?.to, amount: req.body?.amount, note: req.body?.note ?? '' })));
  app.get('/api/players', route((who, req) => bank.findPlayers(repo, req.query.q)));
  app.get('/api/admin/players', route((who, req) => bank.adminPlayers(repo, { q: req.query.q ?? '' }), { admin: true }));
  app.post('/api/admin/award', route((who, req) => bank.adminAward(repo, who.id, { playerId: req.body?.playerId, amount: req.body?.amount, note: req.body?.note ?? '', paid: req.body?.paid !== false }), { admin: true }));
  // The public treasury feed: no sign-in, cached for 10 seconds.
  let publicCache = null;
  app.get('/api/public/treasury', async (req, res) => {
    if (edition !== 'nft' || !repo) return res.status(404).json({ error: 'No such API.' });
    try {
      if (!publicCache || publicCache.until < Date.now()) publicCache = { until: Date.now() + 10000, body: await bank.publicTreasury(repo) };
      res.set('cache-control', 'public, max-age=10').json(publicCache.body);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Something went wrong on the server.' });
    }
  });
  app.get('/api/treasury', route((who) => bank.treasury(repo, who.id)));
  app.post('/api/lt/sync', route((who, req) => bank.syncLt(repo, who.id, { delta: req.body?.delta, reason: req.body?.reason ?? '' })));
  app.post('/api/treasury/swap', route((who, req) => bank.swapLt(repo, who.id, { lt: req.body?.lt })));
  app.post('/api/treasury/cashout', route((who, req) => bank.requestCashout(repo, who.id, { nexus: req.body?.nexus })));
  app.post('/api/admin/deposit', route((who, req) => bank.adminDeposit(repo, who.id, { usd: req.body?.usd, note: req.body?.note ?? '' }), { admin: true }));
  app.get('/api/admin/cashouts', route((who, req) => bank.adminCashouts(repo, { status: req.query.status ?? null }), { admin: true }));
  app.post('/api/admin/cashouts/:id', route((who, req) => bank.adminDecideCashout(repo, who.id, { cashoutId: req.params.id, action: req.body?.action }), { admin: true }));
  app.get('/api/admin/nfts/:id', route((who, req) => bank.adminNfts(repo, req.params.id), { admin: true }));
  app.post('/api/admin/nft/release', route((who, req) => bank.adminReleaseNft(repo, who.id, { playerId: req.body?.playerId, nftId: req.body?.nftId }), { admin: true }));
  app.post('/api/admin/crate/return', route((who, req) => bank.adminReturnCrate(repo, who.id, { crate: req.body?.crate }), { admin: true }));
  app.get('/api/admin/ledger/:id', route((who, req) => bank.adminLedger(repo, req.params.id), { admin: true }));
  app.use('/api', (req, res) => res.status(404).json({ error: 'No such API.' }));

  return { app, repo, mode, edition };
}

async function main() {
  const { app, mode, edition } = await createApp();
  if (production) {
    const dist = path.join(root, 'dist');
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    // Iron Dawn (the military RPG) is a second page of the same build.
    app.get(['/irondawn', '/irondawn/'], (req, res) => res.sendFile(path.join(dist, 'irondawn', 'index.html')));
    app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }
  const port = Number(process.env.PORT ?? 5173);
  app.listen(port, '0.0.0.0', () => console.log(`Nexus Rail (${edition}, sign-in: ${mode}) on port ${port}`));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

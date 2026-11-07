// An in-memory repo with the same shape as the Postgres one, for tests and local runs.
// Transactions run one at a time.
export function memoryRepo() {
  const players = new Map();
  const opened = new Map();
  const ledger = [];
  let treasury = null;
  const flows = [];
  const cashouts = [];
  let chain = Promise.resolve();
  const clone = (p) => (p ? structuredClone(p) : null);
  const named = (id) => players.get(id)?.name ?? null;
  const tx = {
    async getPlayer(id) {
      return clone(players.get(id));
    },
    async getPlayerByName(name) {
      const key = String(name).toLowerCase();
      return clone([...players.values()].find((p) => p.name.toLowerCase() === key));
    },
    async insertPlayer(p) {
      players.set(p.id, clone(p));
    },
    async updatePlayer(p) {
      players.set(p.id, clone(p));
    },
    async openedIds(season) {
      return [...opened.values()].filter((o) => o.season === season).map((o) => o.id);
    },
    async insertOpened(id, season, playerId, at) {
      if (opened.has(id)) return false;
      opened.set(id, { id, season, playerId, at });
      return true;
    },
    async addLedger(row) {
      ledger.push({ tier: null, picked: false, nft_id: null, note: '', ...row, id: ledger.length + 1 });
    },
    async ledgerFor(id, limit) {
      return ledger
        .filter((r) => r.from_id === id || r.to_id === id)
        .slice(-limit)
        .map((r) => ({ ...r, from_name: named(r.from_id), to_name: named(r.to_id) }));
    },
    async getTreasury() {
      return treasury ? { data: structuredClone(treasury), isNew: false } : { data: null, isNew: true };
    },
    async saveTreasury(t) {
      treasury = structuredClone(t);
    },
    async markWelcomeBonus(amount) {
      for (const p of players.values()) if (!p.bonus) p.bonus = Math.min(Number(p.nexus), amount);
    },
    async addFlow(row) {
      flows.push({ player_id: null, lt: 0, usd: 0, note: '', ...row, id: flows.length + 1 });
    },
    async sumFlow(playerId, kind, since) {
      return flows.filter((f) => f.player_id === playerId && f.kind === kind && f.at >= since).reduce((sum, f) => sum + Number(f.lt), 0);
    },
    async recentFlows(limit, kinds) {
      return flows
        .filter((f) => kinds.includes(f.kind))
        .slice(-limit)
        .reverse()
        .map((f) => ({ ...f, player_name: named(f.player_id) }));
    },
    async flowHistory(kinds, limit) {
      return flows.filter((f) => kinds.includes(f.kind)).slice(-limit);
    },
    async topEarners(since, limit) {
      const by = new Map();
      for (const f of flows) if (f.kind === 'earn' && f.at >= since && f.player_id) by.set(f.player_id, (by.get(f.player_id) ?? 0) + Number(f.lt));
      return [...by.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([id, lt]) => ({ player_id: id, name: named(id), lt }));
    },
    async addCashout(row) {
      const out = { status: 'pending', decided_at: null, ...row, id: cashouts.length + 1 };
      cashouts.push(out);
      return out.id;
    },
    async getCashout(id) {
      return clone(cashouts.find((c) => c.id === Number(id)));
    },
    async updateCashout(row) {
      const i = cashouts.findIndex((c) => c.id === row.id);
      cashouts[i] = clone(row);
    },
    async listCashouts({ playerId = null, status = null, limit = 50 } = {}) {
      return cashouts
        .filter((c) => (!playerId || c.player_id === playerId) && (!status || c.status === status))
        .slice(-limit)
        .reverse()
        .map((c) => ({ ...c, player_name: named(c.player_id), player_email: players.get(c.player_id)?.email ?? null }));
    },
    async listPlayers(q, limit, { byEmail = true } = {}) {
      const key = String(q ?? '').toLowerCase();
      return [...players.values()]
        .filter((p) => !key || p.name.toLowerCase().includes(key) || (byEmail && (p.email ?? '').toLowerCase().includes(key)))
        .sort((a, b) => b.lastSeen - a.lastSeen)
        .slice(0, limit)
        .map(clone);
    },
  };
  return {
    kind: 'memory',
    tx(fn) {
      const run = chain.then(() => fn(tx));
      chain = run.catch(() => {});
      return run;
    },
  };
}

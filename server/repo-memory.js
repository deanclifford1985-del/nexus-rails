// An in-memory repo with the same shape as the Postgres one, for tests and local runs.
// Transactions run one at a time.
export function memoryRepo() {
  const players = new Map();
  const opened = new Map();
  const ledger = [];
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

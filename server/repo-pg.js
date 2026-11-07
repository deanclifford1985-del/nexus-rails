// The Postgres repo (Replit's database, DATABASE_URL). Tables are created on first start.
import pg from 'pg';

const SCHEMA = `
create table if not exists nr_players (
  id text primary key,
  email text,
  name text not null,
  nexus numeric(14,2) not null default 0,
  burned numeric(14,2) not null default 0,
  owned jsonb not null default '[]',
  created_at bigint not null,
  last_seen bigint not null
);
create unique index if not exists nr_players_name on nr_players (lower(name));
create table if not exists nr_opened (
  nft_id text primary key,
  season int not null,
  player_id text not null,
  at bigint not null
);
create table if not exists nr_ledger (
  id bigserial primary key,
  at bigint not null,
  kind text not null,
  from_id text,
  to_id text,
  amount numeric(14,2) not null,
  note text not null default '',
  tier text,
  picked boolean not null default false,
  nft_id text
);
create index if not exists nr_ledger_from on nr_ledger (from_id, id);
create index if not exists nr_ledger_to on nr_ledger (to_id, id);
alter table nr_players add column if not exists bonus numeric(14,2) not null default 0;
alter table nr_players add column if not exists lt numeric(18,1) not null default 0;
create table if not exists nr_treasury (
  id int primary key,
  data jsonb not null
);
create table if not exists nr_flow (
  id bigserial primary key,
  at bigint not null,
  kind text not null,
  player_id text,
  lt numeric(18,1) not null default 0,
  usd numeric(16,6) not null default 0,
  note text not null default ''
);
create index if not exists nr_flow_player on nr_flow (player_id, kind, at);
create index if not exists nr_flow_kind on nr_flow (kind, id);
create table if not exists nr_cashouts (
  id bigserial primary key,
  at bigint not null,
  player_id text not null,
  nexus numeric(14,2) not null,
  status text not null default 'pending',
  decided_at bigint,
  note text not null default ''
);
create index if not exists nr_cashouts_player on nr_cashouts (player_id, id);
`;

const row = (r) =>
  r && {
    id: r.id,
    email: r.email,
    name: r.name,
    nexus: Number(r.nexus),
    bonus: Number(r.bonus ?? 0),
    lt: Number(r.lt ?? 0),
    burned: Number(r.burned),
    owned: r.owned ?? [],
    createdAt: Number(r.created_at),
    lastSeen: Number(r.last_seen),
  };

export async function pgRepo(url) {
  const pool = new pg.Pool({ connectionString: url, max: 5 });
  await pool.query(SCHEMA);
  const make = (client) => ({
    async getPlayer(id, lock = false) {
      const r = await client.query(`select * from nr_players where id = $1${lock ? ' for update' : ''}`, [id]);
      return row(r.rows[0]);
    },
    async getPlayerByName(name) {
      const r = await client.query('select * from nr_players where lower(name) = lower($1)', [name]);
      return row(r.rows[0]);
    },
    async insertPlayer(p) {
      await client.query('insert into nr_players (id, email, name, nexus, burned, owned, created_at, last_seen, bonus, lt) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [
        p.id,
        p.email,
        p.name,
        p.nexus,
        p.burned,
        JSON.stringify(p.owned),
        p.createdAt,
        p.lastSeen,
        p.bonus ?? 0,
        p.lt ?? 0,
      ]);
    },
    async updatePlayer(p) {
      await client.query('update nr_players set email=$2, name=$3, nexus=$4, burned=$5, owned=$6, last_seen=$7, bonus=$8, lt=$9 where id=$1', [
        p.id,
        p.email,
        p.name,
        p.nexus,
        p.burned,
        JSON.stringify(p.owned),
        p.lastSeen,
        p.bonus ?? 0,
        p.lt ?? 0,
      ]);
    },
    async openedIds(season) {
      const r = await client.query('select nft_id from nr_opened where season = $1', [season]);
      return r.rows.map((x) => x.nft_id);
    },
    async insertOpened(id, season, playerId, at) {
      const r = await client.query('insert into nr_opened (nft_id, season, player_id, at) values ($1,$2,$3,$4) on conflict do nothing', [id, season, playerId, at]);
      return r.rowCount === 1;
    },
    async addLedger(x) {
      await client.query('insert into nr_ledger (at, kind, from_id, to_id, amount, note, tier, picked, nft_id) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [
        x.at,
        x.kind,
        x.from_id ?? null,
        x.to_id ?? null,
        x.amount,
        x.note ?? '',
        x.tier ?? null,
        !!x.picked,
        x.nft_id ?? null,
      ]);
    },
    async ledgerFor(id, limit) {
      const r = await client.query(
        `select l.*, f.name as from_name, t.name as to_name from nr_ledger l
         left join nr_players f on f.id = l.from_id left join nr_players t on t.id = l.to_id
         where l.from_id = $1 or l.to_id = $1 order by l.id desc limit $2`,
        [id, limit],
      );
      return r.rows.reverse().map((x) => ({ ...x, at: Number(x.at), amount: Number(x.amount) }));
    },
    async getTreasury() {
      // One row, locked for the whole transaction so treasury changes happen one at a time.
      await client.query("insert into nr_treasury (id, data) values (1, 'null') on conflict do nothing");
      const r = await client.query('select data from nr_treasury where id = 1 for update');
      const data = r.rows[0]?.data ?? null;
      return { data, isNew: data === null };
    },
    async saveTreasury(t) {
      await client.query('update nr_treasury set data = $1 where id = 1', [JSON.stringify(t)]);
    },
    async markWelcomeBonus(amount) {
      await client.query('update nr_players set bonus = least(nexus, $1) where bonus = 0', [amount]);
    },
    async addFlow(x) {
      await client.query('insert into nr_flow (at, kind, player_id, lt, usd, note) values ($1,$2,$3,$4,$5,$6)', [x.at, x.kind, x.player_id ?? null, x.lt ?? 0, x.usd ?? 0, x.note ?? '']);
    },
    async sumFlow(playerId, kind, since) {
      const r = await client.query('select coalesce(sum(lt), 0) as total from nr_flow where player_id = $1 and kind = $2 and at >= $3', [playerId, kind, since]);
      return Number(r.rows[0].total);
    },
    async recentFlows(limit, kinds) {
      const r = await client.query(
        'select f.*, p.name as player_name from nr_flow f left join nr_players p on p.id = f.player_id where f.kind = any($1) order by f.id desc limit $2',
        [kinds, limit],
      );
      return r.rows.map((x) => ({ ...x, at: Number(x.at), lt: Number(x.lt), usd: Number(x.usd) }));
    },
    async addCashout(x) {
      const r = await client.query('insert into nr_cashouts (at, player_id, nexus, note) values ($1,$2,$3,$4) returning id', [x.at, x.player_id, x.nexus, x.note ?? '']);
      return Number(r.rows[0].id);
    },
    async getCashout(id) {
      const r = await client.query('select * from nr_cashouts where id = $1 for update', [id]);
      const x = r.rows[0];
      return x ? { ...x, id: Number(x.id), at: Number(x.at), nexus: Number(x.nexus), decided_at: x.decided_at === null ? null : Number(x.decided_at) } : null;
    },
    async updateCashout(x) {
      await client.query('update nr_cashouts set status = $2, decided_at = $3, note = $4 where id = $1', [x.id, x.status, x.decided_at, x.note ?? '']);
    },
    async listCashouts({ playerId = null, status = null, limit = 50 } = {}) {
      const r = await client.query(
        `select c.*, p.name as player_name, p.email as player_email from nr_cashouts c left join nr_players p on p.id = c.player_id
         where ($1::text is null or c.player_id = $1) and ($2::text is null or c.status = $2) order by c.id desc limit $3`,
        [playerId, status, limit],
      );
      return r.rows.map((x) => ({ ...x, id: Number(x.id), at: Number(x.at), nexus: Number(x.nexus), decided_at: x.decided_at === null ? null : Number(x.decided_at) }));
    },
    async listPlayers(q, limit, { byEmail = true } = {}) {
      const like = `%${String(q).replace(/[%_\\]/g, (c) => '\\' + c)}%`;
      const r = q
        ? await client.query(`select * from nr_players where name ilike $1${byEmail ? ' or email ilike $1' : ''} order by last_seen desc limit $2`, [like, limit])
        : await client.query('select * from nr_players order by last_seen desc limit $1', [limit]);
      return r.rows.map(row);
    },
  });
  return {
    kind: 'postgres',
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const out = await fn(make(client));
        await client.query('commit');
        return out;
      } catch (error) {
        await client.query('rollback').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

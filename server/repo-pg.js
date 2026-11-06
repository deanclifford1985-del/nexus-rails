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
`;

const row = (r) =>
  r && {
    id: r.id,
    email: r.email,
    name: r.name,
    nexus: Number(r.nexus),
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
      await client.query('insert into nr_players (id, email, name, nexus, burned, owned, created_at, last_seen) values ($1,$2,$3,$4,$5,$6,$7,$8)', [
        p.id,
        p.email,
        p.name,
        p.nexus,
        p.burned,
        JSON.stringify(p.owned),
        p.createdAt,
        p.lastSeen,
      ]);
    },
    async updatePlayer(p) {
      await client.query('update nr_players set email=$2, name=$3, nexus=$4, burned=$5, owned=$6, last_seen=$7 where id=$1', [
        p.id,
        p.email,
        p.name,
        p.nexus,
        p.burned,
        JSON.stringify(p.owned),
        p.lastSeen,
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

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const seed = require('./seed-data');

const connectionString = process.env.DATABASE_URL || '';
const isLocal = !connectionString || /localhost|127\.0\.0\.1/.test(connectionString);

const pool = new Pool({
  connectionString,
  max: Number(process.env.PG_POOL_MAX || 5),
  ssl: isLocal ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000
});

pool.on('error', (err) => {
  console.error('postgres pool error', err.message);
});

async function query(text, params) {
  const started = Date.now();
  const res = await pool.query(text, params);
  const ms = Date.now() - started;
  if (ms > 800) console.warn('slow query', ms, text.slice(0, 120));
  return res;
}

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}

async function seedIfEmpty() {
  const counts = await query(`
    select
      (select count(*)::int from subjects) as subjects,
      (select count(*)::int from questions) as questions,
      (select count(*)::int from governance_layers) as layers,
      (select count(*)::int from networks) as networks
  `);
  const c = {
    subjects: Number(counts.rows[0].subjects || 0),
    questions: Number(counts.rows[0].questions || 0),
    layers: Number(counts.rows[0].layers || 0),
    networks: Number(counts.rows[0].networks || 0)
  };

  if (c.subjects === 0) {
    for (const s of seed.SUBJECTS) {
      await query(
        `insert into subjects (code, title, summary, outline, level)
         values ($1, $2, $3, $4::jsonb, $5)
         on conflict (code) do nothing`,
        [s.code, s.title, s.summary, JSON.stringify(s.outline), s.level]
      );
    }
  }

  if (c.questions === 0) {
    for (const kind of Object.keys(seed.QUESTIONS)) {
      const list = seed.QUESTIONS[kind];
      for (let i = 0; i < list.length; i += 1) {
        const q = list[i];
        await query(
          `insert into questions (kind, position, field, prompt, type, options, required)
           values ($1, $2, $3, $4, $5, $6::jsonb, $7)
           on conflict (kind, field) do nothing`,
          [kind, i + 1, q.field, q.prompt, q.type, q.options ? JSON.stringify(q.options) : null, q.required !== false]
        );
      }
    }
  }

  if (c.layers === 0) {
    for (const l of seed.LAYERS) {
      await query(
        `insert into governance_layers (code, name, kind, parent_code, description, sort)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (code) do nothing`,
        [l.code, l.name, l.kind, l.parent, l.description, l.sort]
      );
    }
  }

  if (c.networks === 0) {
    for (const n of seed.NETWORKS) {
      await query(
        `insert into networks (kind, name, model, description)
         values ($1, $2, $3, $4)
         on conflict (name) do nothing`,
        [n.kind, n.name, n.model, n.description]
      );
    }
  }

  await query(
    `insert into settings (key, value) values ('register_status', $1::jsonb)
     on conflict (key) do nothing`,
    [JSON.stringify({ clan_register: 'working register, pending verification', updated: new Date().toISOString() })]
  );
}

async function health() {
  const r = await query('select now() as now');
  return r.rows[0].now;
}

module.exports = { pool, query, migrate, seedIfEmpty, health };

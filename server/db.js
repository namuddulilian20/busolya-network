'use strict';

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

function hashPwd(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

const connectionString = process.env.DATABASE_URL || '';
const isLocal = !connectionString || /localhost|127\.0\.0\.1/.test(connectionString);

/*
 * Dual-storage database layer.
 *
 * Production  (DATABASE_URL set to a remote host): use pg Pool directly.
 * Local / dev (no DATABASE_URL or localhost):       use TEE-encrypted JSONL adapter.
 *
 * The exported interface (pool, query, migrate, seedIfEmpty, health) is
 * identical in both modes so server/index.js needs no changes.
 */

let pgPool  = null;
let adapter = null;

if (!isLocal) {
  const { Pool } = require('pg');
  pgPool = new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX || 5),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });
  pgPool.on('error', (err) => {
    console.error('[db] postgres pool error', err.message);
  });
} else {
  adapter = require('./data/adapter');
}

// ---------- core interface ----------

async function query(text, params) {
  if (!isLocal) {
    const started = Date.now();
    const res = await pgPool.query(text, params);
    const ms  = Date.now() - started;
    if (ms > 800) console.warn('[db] slow query', ms + 'ms', text.slice(0, 120));
    return res;
  }
  return adapter.query(text, params);
}

async function migrate() {
  if (!isLocal) {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    // Run each statement individually so that one "already exists" error
    // (e.g. an index or column on a legacy database) does not roll back
    // the entire migration. We split on semicolons that end a statement
    // (ignoring semicolons inside $$ dollar-quoted PL/pgSQL blocks).
    const statements = splitSql(sql);
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;
      try {
        await pgPool.query(trimmed);
      } catch (err) {
        // "already exists" errors are safe to ignore (idempotent schema)
        const safe = /already exists|duplicate (column|index|constraint|table|object)/i.test(err.message);
        if (!safe) throw err;
        // Log suppressed errors in non-production for visibility
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[migrate] suppressed:', err.message.slice(0, 120));
        }
      }
    }
    return;
  }
  return adapter.migrate();
}

/**
 * Split a SQL string into individual statements, respecting:
 *  - $$ dollar-quoted blocks (PL/pgSQL DO $$ ... $$)
 *  - single-quoted string literals
 *  - -- line comments
 */
function splitSql(sql) {
  const stmts = [];
  let current = '';
  let inDollarQuote = false;
  let inSingleQuote = false;
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];
    const remaining = sql.slice(i);

    // Toggle dollar-quote on $$ marker
    if (!inSingleQuote && remaining.startsWith('$$')) {
      inDollarQuote = !inDollarQuote;
      current += '$$';
      i += 2;
      continue;
    }

    // Toggle single-quote ('' escape)
    if (!inDollarQuote && ch === "'") {
      inSingleQuote = !inSingleQuote;
      current += ch; i++; continue;
    }

    // Skip line comments outside quotes
    if (!inDollarQuote && !inSingleQuote && ch === '-' && sql[i+1] === '-') {
      const end = sql.indexOf('\n', i);
      i = end === -1 ? sql.length : end + 1;
      continue;
    }

    // Statement separator
    if (!inDollarQuote && !inSingleQuote && ch === ';') {
      stmts.push(current.trim());
      current = '';
      i++;
      continue;
    }

    current += ch;
    i++;
  }
  if (current.trim()) stmts.push(current.trim());
  return stmts;
}

const pool = isLocal ? null : pgPool;

// ---------- seed ----------

const seed = require('./seed-data');

async function seedIfEmpty() {
  if (isLocal) {
    return adapter.seedIfEmpty();
  }

  /* ── PostgreSQL production seeding (all idempotent) ── */

  // Data rectification: the "Muyinzi/Muyizi Tasubwa" stall rows were misspelled
  // at registration and exhibitors had no way to fix them. Normalise to the
  // canonical name on every boot (idempotent — matches only the wrong spelling).
  const WRONG_STALL_NAMES = ['muyinzi tasubwa', 'muyizi tasubwa'];
  for (const w of WRONG_STALL_NAMES) {
    await query('update suppliers set business = $1 where lower(business) = $2', ['Muyizzi Tasubwa', w]);
  }
  await query('update directory_entries set name = $1 where lower(name) = any($2::text[])', ['Muyizzi Tasubwa', WRONG_STALL_NAMES]);

  const counts = await query(`
    select
      (select count(*)::int from subjects)          as subjects,
      (select count(*)::int from questions)          as questions,
      (select count(*)::int from governance_layers)  as layers,
      (select count(*)::int from networks)            as networks
  `);
  const c = {
    subjects:  Number(counts.rows[0].subjects  || 0),
    questions: Number(counts.rows[0].questions || 0),
    layers:    Number(counts.rows[0].layers    || 0),
    networks:  Number(counts.rows[0].networks  || 0)
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
          [kind, i + 1, q.field, q.prompt, q.type,
           q.options ? JSON.stringify(q.options) : null, q.required !== false]
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
    [JSON.stringify({
      clan_register: 'working register, pending verification',
      updated: new Date().toISOString()
    })]
  );

  // Staff / BAF employees
  const existingStaff = await query(
    "select count(*)::int as c from participants where role = 'employee'"
  );
  if (Number(existingStaff.rows[0].c || 0) === 0) {
    const staffUsers = [
      { phone: '+256700000001', name: 'Alice Nakato',     district: 'Mengo' },
      { phone: '+256700000002', name: 'Bob Kato',         district: 'Mengo' },
      { phone: '+256700000003', name: 'Grace Nambi',      district: 'Mengo' },
      { phone: '+256700000004', name: 'David Ssebugenyi', district: 'Mengo' },
      { phone: '+256700000005', name: 'Mary Namuleme',    district: 'Mengo' },
      { phone: '+256700000006', name: 'Peter Musoke',     district: 'Mengo' },
      { phone: '+256700000007', name: 'Sarah Nalwoga',    district: 'Mengo' }
    ];
    for (const u of staffUsers) {
      await query(
        `insert into participants (phone, name, role, password_hash, district)
         values ($1,$2,'employee',$3,$4) on conflict (phone) do nothing`,
        [u.phone, u.name, hashPwd('BafStaff2026!'), u.district]
      );
    }
  }

  // Farm Aid roles
  const existingRoles = await query('select count(*)::int as c from farm_aid_roles');
  if (Number(existingRoles.rows[0].c || 0) === 0) {
    const roles = [
      { role_code: 'clerk',        compartment: 'butaka',  location_level: 'village', location_name: 'Lunyiriri Village A', district: 'Mengo', phone: '+256700000001' },
      { role_code: 'clerk',        compartment: 'butaka',  location_level: 'village', location_name: 'Lunyiriri Village B', district: 'Mengo', phone: '+256700000001' },
      { role_code: 'verifier',     compartment: 'busolya', location_level: 'mutuba',  location_name: 'Mutuba North',        district: 'Mengo', phone: '+256700000002' },
      { role_code: 'verifier',     compartment: 'busolya', location_level: 'mutuba',  location_name: 'Mutuba South',        district: 'Mengo', phone: '+256700000002' },
      { role_code: 'aggregator',   compartment: 'busolya', location_level: 'mutuba',  location_name: 'Mutuba North',        district: 'Mengo', phone: '+256700000003' },
      { role_code: 'aggregator',   compartment: 'busolya', location_level: 'mutuba',  location_name: 'Mutuba South',        district: 'Mengo', phone: '+256700000003' },
      { role_code: 'courier',      compartment: 'butaka',  location_level: 'village', location_name: 'Lunyiriri Village A', district: 'Mengo', phone: '+256700000004' },
      { role_code: 'courier',      compartment: 'butaka',  location_level: 'village', location_name: 'Lunyiriri Village B', district: 'Mengo', phone: '+256700000004' },
      { role_code: 'registrar',    compartment: 'busolya', location_level: 'ssiga',   location_name: 'Ssiga Central',       district: 'Mengo', phone: '+256700000005' },
      { role_code: 'registrar',    compartment: 'busolya', location_level: 'ssiga',   location_name: 'Ssiga East',          district: 'Mengo', phone: '+256700000005' },
      { role_code: 'commissioner', compartment: 'busolya', location_level: 'ssaza',   location_name: 'Ssaza North',         district: 'Mengo', phone: '+256700000006' },
      { role_code: 'commissioner', compartment: 'busolya', location_level: 'ssaza',   location_name: 'Ssaza South',         district: 'Mengo', phone: '+256700000006' },
      { role_code: 'committee',    compartment: 'busolya', location_level: 'ssaza',   location_name: 'Ssaza North',         district: 'Mengo', phone: '+256700000007' }
    ];
    for (const r of roles) {
      const u = await query('select id from participants where phone = $1 limit 1', [r.phone]);
      if (u.rows.length) {
        await query(
          `insert into farm_aid_roles
             (user_id, role_code, compartment, location_level, location_name, district)
           values ($1,$2,$3,$4,$5,$6) on conflict do nothing`,
          [u.rows[0].id, r.role_code, r.compartment, r.location_level, r.location_name, r.district]
        );
      }
    }
  }

  /* Curriculum content is seeded row-by-row, not only when the table is empty,
     so a database created before a subject, topic or note existed still picks
     it up on the next deploy. Each insert is keyed and idempotent. */
  const subjectMap = new Map();
  {
    const subjRes = await query('select id, code from subjects');
    for (const s of subjRes.rows) subjectMap.set(String(s.code), s.id);
  }
  for (const s of seed.SUBJECTS || []) {
    if (!subjectMap.has(String(s.code))) {
      const created = await query(
        `insert into subjects (code, title, summary, outline, level)
         values ($1,$2,$3,$4::jsonb,$5)
         on conflict (code) do nothing returning id`,
        [s.code, s.title, s.summary, JSON.stringify(s.outline), s.level]
      );
      if (created.rows.length) subjectMap.set(String(s.code), created.rows[0].id);
    }
  }

  const allTopics = [
    ...(seed.FARM_AID_TOPICS || []),
    ...(seed.ALL_TOPICS      || [])
  ];
  for (const t of allTopics) {
    const subjectId = subjectMap.get(String(t.subject_code));
    if (!subjectId) continue;
    await query(
      `insert into education_topics
         (subject_id, code, title, summary, level, sort_order)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (subject_id, code) do nothing`,
      [subjectId, t.code, t.title, t.summary, t.level, t.sort_order]
    );
  }

  const topicMap = new Map();
  {
    const topicRes = await query('select id, code from education_topics');
    for (const t of topicRes.rows) topicMap.set(t.code, t.id);
  }

  /* One note per (topic, locale). The Farm Aid lists come first, so the
     ALL_NOTES_EN duplicates of the same topics are skipped. */
  const covered = new Set();
  const allNotes = [
    ...(seed.FARM_AID_NOTES_EN  || []),
    ...(seed.FARM_AID_NOTES_LUG || []),
    ...(seed.ALL_NOTES_EN        || [])
  ];
  for (const n of allNotes) {
    const key = n.topic_code + '|' + n.locale;
    if (covered.has(key)) continue;
    covered.add(key);
    const topicId = topicMap.get(n.topic_code);
    if (!topicId) continue;
    const exists = await query(
      'select id from education_notes where topic_id = $1 and locale = $2 and title = $3 limit 1',
      [topicId, n.locale, n.title]
    );
    if (exists.rows.length) continue;
    await query(
      `insert into education_notes
         (topic_id, title, content, locale, format, price_ugx)
       values ($1,$2,$3,$4,$5,$6)`,
      [topicId, n.title, n.content, n.locale, n.format, n.price_ugx]
    );
  }
}

// ---------- health ----------

async function health() {
  if (isLocal) return adapter.health();
  const r = await query('select now() as now');
  return r.rows[0].now;
}

module.exports = {
  pool,
  query,
  migrate,
  seedIfEmpty,
  health,
  hashPwd,
  isLocal,
  get adapter() { return adapter; },
  get sync()    { return adapter ? adapter.sync : null; }
};

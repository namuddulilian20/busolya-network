const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const seed = require('./seed-data');

function hashPwd(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

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

  // Seed staff / BAF employees into participants (idempotent)
  const existingParticipants = await query("select count(*)::int as c from participants where role = 'employee'");
  if (Number(existingParticipants.rows[0].c || 0) === 0) {
    const staffUsers = [
      { phone: '+256700000001', name: 'Alice Nakato',      role: 'employee', district: 'Mengo' },
      { phone: '+256700000002', name: 'Bob Kato',          role: 'employee', district: 'Mengo' },
      { phone: '+256700000003', name: 'Grace Nambi',       role: 'employee', district: 'Mengo' },
      { phone: '+256700000004', name: 'David Ssebugenyi',  role: 'employee', district: 'Mengo' },
      { phone: '+256700000005', name: 'Mary Namuleme',     role: 'employee', district: 'Mengo' },
      { phone: '+256700000006', name: 'Peter Musoke',      role: 'employee', district: 'Mengo' },
      { phone: '+256700000007', name: 'Sarah Nalwoga',     role: 'employee', district: 'Mengo' },
    ];
    for (const u of staffUsers) {
      await query(
        `insert into participants (phone, name, role, password_hash, district)
         values ($1,$2,$3,$4,$5) on conflict (phone) do nothing`,
        [u.phone, u.name, u.role, hashPwd('BafStaff2026!'), u.district]
      );
    }
  }

  // Seed Farm Aid roles using participants (idempotent)
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
      { role_code: 'committee',    compartment: 'busolya', location_level: 'ssaza',   location_name: 'Ssaza North',         district: 'Mengo', phone: '+256700000007' },
    ];
    for (const r of roles) {
      const u = await query('select id from participants where phone = $1 limit 1', [r.phone]);
      if (u.rows.length) {
        await query(
          `insert into farm_aid_roles (user_id, role_code, compartment, location_level, location_name, district)
           values ($1,$2,$3,$4,$5,$6) on conflict do nothing`,
          [u.rows[0].id, r.role_code, r.compartment, r.location_level, r.location_name, r.district]
        );
      }
    }
  }

  // Seed education topics for Farm Aid subject (idempotent)
  const existingTopics = await query('select count(*)::int as c from education_topics');
  if (Number(existingTopics.rows[0].c || 0) === 0) {
    const subjectRes = await query("select id from subjects where code = '01' limit 1");
    if (subjectRes.rows.length > 0) {
      const subjectId = subjectRes.rows[0].id;
      for (const t of seed.FARM_AID_TOPICS) {
        if (t.subject_code === '01') {
          await query(
            `insert into education_topics (subject_id, code, title, summary, level, sort_order)
             values ($1,$2,$3,$4,$5,$6) on conflict (subject_id, code) do nothing`,
            [subjectId, t.code, t.title, t.summary, t.level, t.sort_order]
          );
        }
      }
    }
  }

  // Seed education notes EN and LUG (idempotent)
  const existingNotes = await query('select count(*)::int as c from education_notes');
  if (Number(existingNotes.rows[0].c || 0) === 0) {
    for (const set of [seed.FARM_AID_NOTES_EN, seed.FARM_AID_NOTES_LUG]) {
      for (const n of set) {
        const t = await query('select id from education_topics where code = $1 limit 1', [n.topic_code]);
        if (t.rows.length) {
          await query(
            `insert into education_notes (topic_id, title, content, locale, format, price_ugx)
             values ($1,$2,$3,$4,$5,$6) on conflict do nothing`,
            [t.rows[0].id, n.title, n.content, n.locale, n.format, n.price_ugx]
          );
        }
      }
    }
  }
}

async function health() {
  const r = await query('select now() as now');
  return r.rows[0].now;
}

module.exports = { pool, query, migrate, seedIfEmpty, health };

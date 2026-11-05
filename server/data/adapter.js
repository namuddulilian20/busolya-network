'use strict';

/*
 * JSONL adapter — exposes the same query/migrate/seedIfEmpty/health interface
 * as the pg layer but executes against TEE-encrypted JSONL collections.
 *
 * Used by db.js when DATABASE_URL is unset or points at localhost.
 */

const { get, all: allCollections, COLLECTION_NAMES } = require('./collections');
const { dataDir, ensureDir }                         = require('./jsonl');

// ---------- SQL → collection translator ----------

async function query(text, params = []) {
  const sql   = text.trim();
  const upper = sql.toUpperCase();
  if (upper.startsWith('SELECT')) return selectJsonl(sql, params);
  if (upper.startsWith('INSERT')) return insertJsonl(sql, params);
  if (upper.startsWith('UPDATE')) return updateJsonl(sql, params);
  if (upper.startsWith('DELETE')) return deleteJsonl(sql, params);
  // CREATE TABLE, BEGIN, COMMIT etc. — no-op in JSONL mode
  return { rows: [], rowCount: 0 };
}

// ── SELECT ─────────────────────────────────────────────────────────────

function selectJsonl(sql, params) {
  const lower = sql.toLowerCase();
  const fromMatch  = sql.match(/from\s+([\w_]+)/i);
  const collName   = fromMatch ? fromMatch[1] : null;

  // COUNT(*)
  if (lower.includes('count(*)')) {
    const coll  = getCollection(collName);
    let   docs  = coll ? coll.all() : [];
    const whereMatch = sql.match(/where\s+(.+?)(\s+order\s+by|\s+limit\s+|$)/i);
    if (whereMatch) docs = applyWhere(docs, whereMatch[1], params);
    // Support ::int cast alias — just return the count
    const alias = lower.includes('::int as c') ? 'c' : 'count';
    return { rows: [{ [alias]: String(docs.length) }], rowCount: 1 };
  }

  const coll = getCollection(collName);
  if (!coll) return { rows: [], rowCount: 0 };

  let docs = coll.all();

  const whereMatch = sql.match(/where\s+(.+?)(\s+order\s+by|\s+limit\s+|\s+offset\s+|$)/i);
  if (whereMatch) docs = applyWhere(docs, whereMatch[1], params);

  const orderMatch = sql.match(/order\s+by\s+(.+?)(\s+limit\s+|\s+offset\s+|$)/i);
  if (orderMatch) docs = applyOrderBy(docs, orderMatch[1]);

  const offsetMatch = sql.match(/offset\s+(\d+)/i);
  if (offsetMatch) docs = docs.slice(Number(offsetMatch[1]));

  const limitMatch = sql.match(/limit\s+(\d+)/i);
  if (limitMatch) docs = docs.slice(0, Number(limitMatch[1]));

  return { rows: docs, rowCount: docs.length };
}

// ── INSERT ─────────────────────────────────────────────────────────────

function insertJsonl(sql, params) {
  const intoMatch = sql.match(/into\s+([\w_]+)/i);
  const coll      = getCollection(intoMatch ? intoMatch[1] : null);
  if (!coll) return { rows: [], rowCount: 0 };

  // Extract column names from the first (...) group after the table name
  const colsMatch = sql.match(/into\s+[\w_]+\s*\(([^)]+)\)/i);
  const columns   = colsMatch
    ? colsMatch[1].split(',').map(c => c.trim())
    : [];

  const doc = {};
  columns.forEach((col, i) => { doc[col] = params[i]; });

  // Auto-parse JSON strings so JSONB params work correctly
  Object.keys(doc).forEach((k) => {
    const v = doc[k];
    if (typeof v === 'string' && (v.startsWith('{') || v.startsWith('['))) {
      try { doc[k] = JSON.parse(v); } catch (_) { /* keep as string */ }
    }
  });

  const record = coll.insert(doc);
  return { rows: [record], rowCount: 1 };
}

// ── UPDATE ─────────────────────────────────────────────────────────────

function updateJsonl(sql, params) {
  const tableMatch = sql.match(/update\s+([\w_]+)/i);
  const coll       = getCollection(tableMatch ? tableMatch[1] : null);
  if (!coll) return { rows: [], rowCount: 0 };

  const setMatch = sql.match(/set\s+(.+?)\s+where\s/i);
  if (!setMatch) return { rows: [], rowCount: 0 };

  const whereIdMatch = sql.match(/where\s+(\w+)\s*=\s*\$(\d+)/i);
  if (!whereIdMatch) return { rows: [], rowCount: 0 };

  const id      = params[Number(whereIdMatch[2]) - 1];
  const changes = {};
  setMatch[1].split(',').forEach((part) => {
    const m = part.trim().match(/(\w+)\s*=\s*\$(\d+)/);
    if (!m) return;
    const val = params[Number(m[2]) - 1];
    if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
      try { changes[m[1]] = JSON.parse(val); } catch (_) { changes[m[1]] = val; }
    } else {
      changes[m[1]] = val;
    }
  });

  const record = coll.update(id, changes);
  if (!record) return { rows: [], rowCount: 0 };
  return { rows: [record], rowCount: 1 };
}

// ── DELETE ─────────────────────────────────────────────────────────────

function deleteJsonl(sql, params) {
  const fromMatch    = sql.match(/from\s+([\w_]+)/i);
  const coll         = getCollection(fromMatch ? fromMatch[1] : null);
  if (!coll) return { rows: [], rowCount: 0 };

  const whereIdMatch = sql.match(/where\s+(\w+)\s*=\s*\$(\d+)/i);
  if (!whereIdMatch) return { rows: [], rowCount: 0 };

  const id = params[Number(whereIdMatch[2]) - 1];
  const ok = coll.delete(id);
  return { rows: [], rowCount: ok ? 1 : 0 };
}

// ── WHERE evaluator (equality, ILIKE, IN, bare boolean) ───────────────

function applyWhere(docs, clause, params) {
  return docs.filter((d) =>
    clause.split(/\s+and\s+/i).every((cond) => {
      const c = cond.trim();

      // col = $N
      const eq = c.match(/^(\w+)\s*=\s*\$(\d+)$/);
      if (eq) return String(d[eq[1]]) === String(params[Number(eq[2]) - 1]);

      // col ilike $N
      const il = c.match(/^(\w+)\s+ilike\s+\$(\d+)$/i);
      if (il) {
        const pat = params[Number(il[2]) - 1];
        if (!pat) return true;
        const rx = new RegExp(String(pat).replace(/%/g, '.*').replace(/_/g, '.'), 'i');
        return rx.test(String(d[il[1]] || ''));
      }

      // col in ($1,$2,...)
      const inM = c.match(/^(\w+)\s+in\s*\(([^)]+)\)$/i);
      if (inM) {
        const vals = inM[2].split(',').map(p => {
          const m = p.trim().match(/\$(\d+)/);
          return m ? params[Number(m[1]) - 1] : null;
        });
        return vals.includes(d[inM[1]]);
      }

      // bare identifier: col (truthy check)
      const bare = c.match(/^(\w+)$/);
      if (bare) return !!d[bare[1]];

      return true; // unknown condition — pass through
    })
  );
}

function applyOrderBy(docs, clause) {
  const parts  = clause.split(',').map(p => p.trim());
  const result = [...docs];
  // Apply in reverse so that the first key has highest priority
  for (let i = parts.length - 1; i >= 0; i--) {
    const desc = /\s+desc$/i.test(parts[i]);
    const col  = parts[i].replace(/\s+(asc|desc)$/i, '').trim();
    result.sort((a, b) => {
      const av = a[col]; const bv = b[col];
      if (av == null) return desc ?  1 : -1;
      if (bv == null) return desc ? -1 :  1;
      if (av < bv)   return desc ?  1 : -1;
      if (av > bv)   return desc ? -1 :  1;
      return 0;
    });
  }
  return result;
}

function getCollection(name) {
  try { return get(name); } catch (_) { return null; }
}

// ---------- migrate ----------

async function migrate() {
  ensureDir();
  const fs   = require('fs');
  const path = require('path');
  COLLECTION_NAMES.forEach((name) => {
    const file = path.join(dataDir(), `${name}.jsonl`);
    if (!fs.existsSync(file)) fs.writeFileSync(file, '');
  });
}

// ---------- seedIfEmpty ----------

async function seedIfEmpty() {
  const seed        = require('../seed-data');
  const crypto      = require('crypto');
  const hashPwd     = (p) => crypto.createHash('sha256').update(String(p)).digest('hex');
  const collections = allCollections();

  const subjColl = collections.subjects;
  if (subjColl.count() === 0) {
    (seed.SUBJECTS || []).forEach((s) =>
      subjColl.insert({ code: s.code, title: s.title, summary: s.summary,
                        outline: s.outline, level: s.level, active: true })
    );
  }

  const qColl = collections.questions;
  if (qColl.count() === 0) {
    Object.keys(seed.QUESTIONS || {}).forEach((kind) => {
      (seed.QUESTIONS[kind] || []).forEach((q, i) =>
        qColl.insert({ kind, position: i + 1, field: q.field, prompt: q.prompt,
                       type: q.type, options: q.options || null,
                       required: q.required !== false, active: true })
      );
    });
  }

  const layerColl = collections.governance_layers;
  if (layerColl.count() === 0) {
    (seed.LAYERS || []).forEach((l) =>
      layerColl.insert({ code: l.code, name: l.name, kind: l.kind,
                         parent_code: l.parent, description: l.description, sort: l.sort })
    );
  }

  const netColl = collections.networks;
  if (netColl.count() === 0) {
    (seed.NETWORKS || []).forEach((n) =>
      netColl.insert({ kind: n.kind, name: n.name, model: n.model,
                       description: n.description, status: 'active' })
    );
  }

  const settingsColl = collections.settings;
  if (settingsColl.count() === 0) {
    settingsColl.insert({
      key:   'register_status',
      value: { clan_register: 'working register, pending verification',
               updated: new Date().toISOString() }
    });
  }

  const partColl = collections.participants;
  if (partColl.count() === 0) {
    const staff = [
      { phone: '+256700000001', name: 'Alice Nakato',     district: 'Mengo' },
      { phone: '+256700000002', name: 'Bob Kato',         district: 'Mengo' },
      { phone: '+256700000003', name: 'Grace Nambi',      district: 'Mengo' },
      { phone: '+256700000004', name: 'David Ssebugenyi', district: 'Mengo' },
      { phone: '+256700000005', name: 'Mary Namuleme',    district: 'Mengo' },
      { phone: '+256700000006', name: 'Peter Musoke',     district: 'Mengo' },
      { phone: '+256700000007', name: 'Sarah Nalwoga',    district: 'Mengo' }
    ];
    staff.forEach((u) =>
      partColl.insert({ phone: u.phone, name: u.name, role: 'employee',
                        password_hash: hashPwd('BafStaff2026!'),
                        password_is_phone: false, district: u.district })
    );
  }

  console.log('[jsonl/adapter] seed complete —', dataDir());
}

// ---------- health ----------

async function health() {
  ensureDir();
  return new Date().toISOString();
}

// ---------- sync (lazy require to avoid circular deps) ----------

let _sync = null;
function getSync() {
  if (!_sync) _sync = require('./sync');
  return _sync;
}

module.exports = {
  query,
  migrate,
  seedIfEmpty,
  health,
  isPg:    false,
  isJsonl: true,
  get sync()            { return getSync(); },
  get allCollections()  { return allCollections; },
  getCollection,
  COLLECTION_NAMES,
  get DATA_DIR()        { return dataDir(); }
};

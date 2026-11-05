'use strict';

const db = require('../db');
const { get, all: allCollections, COLLECTION_NAMES } = require('./collections');
const { readLinesDocs, listCollections, dataDir, ensureDir } = require('./jsonl');

function pgTableSafeName(name) {
  return name;
}

async function collectionToPgRows(collectionName) {
  const coll = get(collectionName);
  if (!coll) return [];
  const docs = coll.all({ includeDeleted: true });
  return docs.map((doc) => {
    const { id, _v, _updated_at, _synced, _sync_source, _deleted, _deleted_at, ...rest } = doc;
    const meta = { _v, _updated_at, _synced, _sync_source, _deleted, _deleted_at };
    return { id, payload: rest, meta };
  });
}

let _lamportFallback = Date.now();
function nextLamportFallback() {
  _lamportFallback += 1;
  return _lamportFallback;
}

async function pgRowsToCollection(collectionName, rows) {
  const coll = get(collectionName);
  if (!coll) return 0;
  const existingIds = new Set(coll.find().map(d => d.id));
  let imported = 0;
  for (const row of rows) {
    const id = row.id;
    const payload = row.payload || {};
    const meta = row.meta || {};
    if (existingIds.has(id)) {
      const existing = coll.findOne({ id });
      const existingV = existing ? (existing._v || 0) : 0;
      const incomingV = meta._v || 0;
      if (incomingV > existingV) {
        coll.update(id, { ...payload, _v: incomingV, _synced: true, _sync_source: 'postgres' });
      }
    } else {
      coll.insert({ ...payload, id, _v: meta._v || nextLamportFallback(), _synced: true, _sync_source: 'postgres', _deleted: meta._deleted || false });
      imported += 1;
    }
    if (meta._deleted) {
      coll.update(id, { _deleted: true, _deleted_at: meta._deleted_at, _synced: true });
    }
  }
  return imported;
}

async function exportToPg() {
  if (db.isPg === false) {
    throw new Error('exportToPg requires PostgreSQL mode (DATABASE_URL set to remote)');
  }
  const results = {};
  for (const name of COLLECTION_NAMES) {
    try {
      const rows = await collectionToPgRows(name);
      if (rows.length === 0) {
        results[name] = { exported: 0, skipped: 'empty' };
        continue;
      }
      let exported = 0;
      for (const row of rows) {
        await upsertRowToPg(name, row);
        exported += 1;
      }
      const ids = rows.map(r => r.id);
      const coll = get(name);
      if (coll) coll.markSynced(ids);
      results[name] = { exported };
    } catch (err) {
      results[name] = { error: err.message };
    }
  }
  return results;
}

async function importFromPg() {
  const results = {};
  for (const name of COLLECTION_NAMES) {
    try {
      const check = await db.query(
        `select to_regclass($1::text) as tbl`,
        [name]
      );
      if (!check.rows[0] || !check.rows[0].tbl) {
        results[name] = { skipped: 'no pg table' };
        continue;
      }
      const r = await db.query(`select * from ${name}`);
      const imported = await pgRowsToCollection(name, r.rows);
      results[name] = { imported, total: r.rows.length };
    } catch (err) {
      results[name] = { error: err.message };
    }
  }
  return results;
}

async function deltaSync() {
  const pushed = [];
  const pulled = [];

  for (const name of COLLECTION_NAMES) {
    const coll = get(name);
    if (!coll) continue;
    const unsynced = coll.unsynced();
    if (unsynced.length === 0) continue;
    for (const doc of unsynced) {
      try {
        await upsertRowToPg(name, { id: doc.id, payload: doc, meta: { _v: doc._v, _updated_at: doc._updated_at, _deleted: doc._deleted || false } });
        pushed.push({ collection: name, id: doc.id });
      } catch (err) {
        pushed.push({ collection: name, id: doc.id, error: err.message });
      }
    }
    const ids = unsynced.map(d => d.id);
    coll.markSynced(ids);
  }

  for (const name of COLLECTION_NAMES) {
    try {
      const check = await db.query(`select to_regclass($1::text) as tbl`, [name]);
      if (!check.rows[0] || !check.rows[0].tbl) continue;
      const r = await db.query(`select * from ${name}`);
      const imported = await pgRowsToCollection(name, r.rows);
      if (imported > 0) pulled.push({ collection: name, imported });
    } catch (err) {
      pulled.push({ collection: name, error: err.message });
    }
  }

  return { pushed, pulled };
}

async function upsertRowToPg(tableName, row) {
  const { id, payload, meta } = row;
  const doc = payload || {};
  const metaObj = meta || {};
  const columns = ['id'];
  const values = [id];
  const paramPlaceholders = ['$1'];
  let paramIndex = 2;

  const knownColumns = [
    'kind','event','name','phone','email','district','org','role','category',
    'payload','answers','credit_amount','guarantor_name','guarantor_phone',
    'guarantor_rel','consent','status','source','created_at','business',
    'contact','offer','capacity','price_band','delivery_range','listing_optin',
    'credit_terms','sector','description','website','exhibitor','verified',
    'subject_id','title','starts_at','venue','trainer','capacity','notes',
    'code','summary','outline','level','active','parent_code','sort',
    'kind','position','field','prompt','type','options','required',
    'reporter_id','report_type','compartment','ssaza','ssiga','mutuba',
    'parish','village','clan_name','content','submitted_at',
    'user_id','member_no','shares','savings','balance_after','reference',
    'narr','created_by','type','creditor_name','creditor_phone','amount',
    'guarantor_id','relationship','location_level','location_name',
    'appointment_at','network_id','model','topic_id','locale','format',
    'price_ugx','presentation','slides','password_hash'
  ];

  knownColumns.forEach((col) => {
    if (col in doc && doc[col] !== undefined && doc[col] !== null) {
      columns.push(col);
      values.push(typeof doc[col] === 'object' ? JSON.stringify(doc[col]) : doc[col]);
      paramPlaceholders.push(`$${paramIndex}`);
      paramIndex += 1;
    }
  });

  const hasPayloadCol = await columnExists(tableName, 'payload');
  if (hasPayloadCol) {
    columns.push('payload');
    values.push(JSON.stringify(doc));
    paramPlaceholders.push(`$${paramIndex}`);
    paramIndex += 1;
  }

  const hasMetaCol = await columnExists(tableName, 'meta_jsonb');
  if (hasMetaCol) {
    columns.push('meta_jsonb');
    values.push(JSON.stringify(metaObj));
    paramPlaceholders.push(`$${paramIndex}`);
    paramIndex += 1;
  }

  const setClause = columns.slice(1).map((col, i) => `${col} = $${i + 2}`).join(', ');
  const sql = `
    insert into ${tableName} (${columns.join(', ')})
    values (${paramPlaceholders.join(', ')})
    on conflict (id) do update set ${setClause}
  `;
  await db.query(sql, values);
}

async function columnExists(tableName, columnName) {
  try {
    const r = await db.query(
      `select count(*)::int as c from information_schema.columns
       where table_name = $1 and column_name = $2`,
      [tableName, columnName]
    );
    return Number(r.rows[0].c || 0) > 0;
  } catch (e) {
    return false;
  }
}

async function syncStatus() {
  const report = {
    mode: db.isPg ? 'postgres' : 'jsonl',
    dataDir: dataDir(),
    collections: [],
    timestamp: new Date().toISOString()
  };

  for (const name of COLLECTION_NAMES) {
    const entry = { name };
    const coll = get(name);
    if (coll) {
      entry.jsonl_total = coll.count({ includeDeleted: true });
      entry.jsonl_synced = coll.count({ includeDeleted: true }) - coll.unsyncedCount();
      entry.jsonl_unsynced = coll.unsyncedCount();
    }
    if (db.isPg) {
      try {
        const check = await db.query(`select to_regclass($1::text) as tbl`, [name]);
        if (check.rows[0] && check.rows[0].tbl) {
          const r = await db.query(`select count(*)::int as c from ${name}`);
          entry.pg_total = Number(r.rows[0].c || 0);
        } else {
          entry.pg_total = null;
          entry.pg_note = 'table missing';
        }
      } catch (err) {
        entry.pg_error = err.message;
      }
    }
    report.collections.push(entry);
  }

  return report;
}

async function backupToFile(filePath) {
  const fs = require('fs');
  const path = require('path');
  ensureDir();
  const out = {
    exported_at: new Date().toISOString(),
    tee_key_version: 1,
    collections: {}
  };
  for (const name of COLLECTION_NAMES) {
    const coll = get(name);
    if (coll) {
      out.collections[name] = coll.all({ includeDeleted: true });
    }
  }
  const dir = path.dirname(filePath);
  if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(out, null, 2));
  return out;
}

async function restoreFromFile(filePath) {
  const fs = require('fs');
  if (!fs.existsSync(filePath)) throw new Error('backup file not found: ' + filePath);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const restored = {};
  for (const [name, docs] of Object.entries(data.collections || {})) {
    const coll = get(name);
    if (coll && Array.isArray(docs)) {
      coll.rewriteAll(docs);
      restored[name] = docs.length;
    }
  }
  return restored;
}

module.exports = {
  exportToPg,
  importFromPg,
  deltaSync,
  syncStatus,
  backupToFile,
  restoreFromFile,
  collectionToPgRows,
  pgRowsToCollection,
  upsertRowToPg
};

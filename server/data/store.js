'use strict';

const { readLines, appendLine, rewrite, nextId, readLinesDocs } = require('./jsonl');

const LAMPORT_EPOCH = Date.now();
let _lamportCounter = 0;
function nextLamport() {
  _lamportCounter += 1;
  return LAMPORT_EPOCH + _lamportCounter;
}

function nowIso() {
  return new Date().toISOString();
}

/*
 * Collection class backed by TEE-encrypted JSONL files.
 *
 * Each document carries sync metadata:
 *   _v         — Lamport timestamp (logical clock) for conflict resolution
 *   _updated_at — ISO timestamp of last modification
 *   _synced     — boolean, true when this doc has been synced to PostgreSQL
 *   _sync_source — 'jsonl' or 'postgres' indicating where the doc originated
 *
 * The collection maintains an in-memory cache (_cache) that is populated
 * on first read and invalidated on write. All mutations go through _save()
 * which persists atomically.
 */
class Collection {
  constructor(name) {
    this.name = name;
    this._cache = null;
    this._dirty = false;
    this._skipped = 0;
  }

  _load() {
    if (this._cache === null) {
      const result = readLines(this.name);
      this._cache = result.docs;
      this._skipped = result.skipped || 0;
      if (this._skipped > 0 && process.env.NODE_ENV !== 'production') {
        console.warn(`[store:${this.name}] skipped ${this._skipped} corrupt line(s) on load`);
      }
    }
    return this._cache;
  }

  /*
   * Number of lines that could not be decrypted or verified on load.
   * Exposed so seedIfEmpty() can refuse to overwrite a collection whose
   * contents are unreadable (normally a TEE encryption key mismatch).
   */
  skippedLines() {
    this._load();
    return this._skipped;
  }

  _save(docs) {
    this._cache = docs;
    this._dirty = true;
    rewrite(this.name, docs);
    this._dirty = false;
  }

  find(query = {}) {
    const docs = this._load();
    const keys = Object.keys(query);
    return docs.filter(d => keys.every(k => d[k] === query[k]));
  }

  findOne(query) {
    return this.find(query)[0] || null;
  }

  /*
   * Insert a new document with sync metadata.
   * Assigns id, Lamport timestamp, created_at/updated_at, and marks as not synced.
   */
  insert(doc) {
    const docs = this._load();
    const id = nextId(docs);
    const now = nowIso();
    const record = {
      id,
      ...doc,
      _v: nextLamport(),
      _updated_at: now,
      _synced: false,
      _sync_source: 'jsonl',
      created_at: doc.created_at || now
    };
    docs.push(record);
    this._save(docs);
    return record;
  }

  /*
   * Update a document by id. Bumps Lamport timestamp and marks as not synced
   * so the change will be propagated to PostgreSQL on next delta sync.
   */
  update(id, changes) {
    const docs = this._load();
    const idx = docs.findIndex(d => d.id === id);
    if (idx === -1) return null;
    const now = nowIso();
    docs[idx] = {
      ...docs[idx],
      ...changes,
      _v: nextLamport(),
      _updated_at: now,
      _synced: false,
      _sync_source: 'jsonl'
    };
    this._save(docs);
    return docs[idx];
  }

  /*
   * Soft-delete: mark document as deleted rather than removing.
   * Deleted docs carry _deleted: true and are excluded from find() unless
   * includeDeleted is true. This supports sync propagation to PostgreSQL.
   */
  delete(id, { hard = false } = {}) {
    const docs = this._load();
    const idx = docs.findIndex(d => d.id === id);
    if (idx === -1) return false;
    if (hard) {
      docs.splice(idx, 1);
      this._save(docs);
      return true;
    }
    // Soft-delete: keep the record but mark it deleted for sync propagation
    const now = nowIso();
    docs[idx] = {
      ...docs[idx],
      _deleted: true,
      _deleted_at: now,
      _v: nextLamport(),
      _updated_at: now,
      _synced: false,
      _sync_source: 'jsonl'
    };
    this._save(docs);
    return true;
  }

  /*
   * Restore a soft-deleted document.
   */
  restore(id) {
    const docs = this._load();
    const idx = docs.findIndex(d => d.id === id);
    if (idx === -1) return null;
    docs[idx] = {
      ...docs[idx],
      _deleted: false,
      _deleted_at: null,
      _v: nextLamport(),
      _updated_at: nowIso(),
      _synced: false,
      _sync_source: 'jsonl'
    };
    this._save(docs);
    return docs[idx];
  }

  count({ includeDeleted = false } = {}) {
    const docs = this._load();
    if (includeDeleted) return docs.length;
    return docs.filter(d => !d._deleted).length;
  }

  /*
   * Return all documents, optionally including soft-deleted ones.
   */
  all({ includeDeleted = false } = {}) {
    const docs = this._load();
    if (includeDeleted) return docs;
    return docs.filter(d => !d._deleted);
  }

  /*
   * Return documents changed since a given Lamport timestamp (delta sync).
   * Used by sync.js to replicate only changed documents to PostgreSQL.
   */
  getChangesSince(sinceV) {
    const docs = this._load();
    return docs.filter(d => (d._v || 0) > sinceV);
  }

  /*
   * Mark documents as synced (called after successful propagation to PostgreSQL).
   * ids can be a single id or an array of ids.
   */
  markSynced(ids) {
    const idList = Array.isArray(ids) ? ids : [ids];
    const docs = this._load();
    let changed = false;
    idList.forEach((id) => {
      const idx = docs.findIndex(d => d.id === id);
      if (idx !== -1 && !docs[idx]._synced) {
        docs[idx]._synced = true;
        changed = true;
      }
    });
    if (changed) this._save(docs);
    return changed;
  }

  /*
   * Return unsynced documents (useful for sync status reporting).
   */
  unsynced() {
    const docs = this._load();
    return docs.filter(d => !d._synced && !d._deleted);
  }

  /*
   * Return the count of unsynced documents.
   */
  unsyncedCount() {
    return this.unsynced().length;
  }

  clear() {
    this._save([]);
  }

  /*
   * Replace all documents with a given array (used by restore from backup).
   */
  rewriteAll(docs) {
    const sanitized = docs.map((d) => ({
      ...d,
      _synced: false,
      _sync_source: d._sync_source || 'jsonl',
      _v: d._v || nextLamport()
    }));
    this._save(sanitized);
    return sanitized.length;
  }

  /*
   * Invalidate the in-memory cache (forces reload on next access).
   */
  invalidate() {
    this._cache = null;
  }
}

module.exports = { Collection, nextLamport };

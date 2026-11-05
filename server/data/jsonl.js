'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const { encryptDoc, decryptDoc } = require('./tee');

const DATA_DIR = path.join(__dirname, 'Data');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function collectionPath(name) {
  return path.join(DATA_DIR, `${name}.jsonl`);
}

/*
 * Read a JSONL collection with TEE decryption and integrity verification.
 * Corrupted or tampered lines are skipped and logged; valid lines are returned.
 * Returns { docs, skipped } where docs is the array of decrypted records.
 */
function readLines(name, { verify = true } = {}) {
  ensureDir();
  const file = collectionPath(name);
  if (!fs.existsSync(file)) return { docs: [], skipped: 0 };

  const raw = fs.readFileSync(file, 'utf8');
  const docs = [];
  let skipped = 0;

  raw.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const envelope = JSON.parse(trimmed);
      if (verify && envelope && envelope._enc) {
        docs.push(decryptDoc(envelope));
      } else {
        docs.push(envelope);
      }
    } catch (err) {
      // Tampered, corrupted, or undecryptable line — skip rather than crash
      skipped += 1;
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[jsonl] skipped corrupt line in ${name}: ${err.message}`);
      }
    }
  });

  return { docs, skipped };
}

/*
 * Read a JSONL collection returning just the docs array (backward-compatible).
 */
function readLinesDocs(name) {
  return readLines(name).docs;
}

/*
 * Append a single document to a JSONL collection with TEE encryption.
 * The document is encrypted and signed before being written.
 */
function appendLine(name, doc) {
  ensureDir();
  const envelope = encryptDoc(doc);
  const line = JSON.stringify(envelope) + '\n';
  fs.appendFileSync(collectionPath(name), line);
  return doc;
}

/*
 * Rewrite an entire JSONL collection with TEE encryption.
 * Uses atomic write: writes to temp file in same dir, then renames.
 */
function rewrite(name, docs) {
  ensureDir();
  const file = collectionPath(name);
  const tmp = file + '.tmp.' + process.pid;
  const content = docs.map(d => JSON.stringify(encryptDoc(d))).join('\n') + (docs.length ? '\n' : '');
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

/*
 * Append multiple documents atomically (single rewrite).
 */
function appendBatch(name, docs) {
  ensureDir();
  const { docs: existing } = readLines(name);
  const all = existing.concat(docs);
  rewrite(name, all);
  return docs;
}

/*
 * Compute the next integer id for a collection based on existing docs.
 */
function nextId(docs) {
  return docs.reduce((max, d) => Math.max(max, Number(d.id || 0)), 0) + 1;
}

/*
 * Return the path to the data directory (useful for backup/export tooling).
 */
function dataDir() {
  return DATA_DIR;
}

/*
 * List all collection files in the data directory.
 */
function listCollections() {
  ensureDir();
  try {
    return fs.readdirSync(DATA_DIR)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => f.replace(/\.jsonl$/, ''));
  } catch (err) {
    return [];
  }
}

module.exports = {
  ensureDir,
  collectionPath,
  readLines,
  readLinesDocs,
  appendLine,
  appendBatch,
  rewrite,
  nextId,
  dataDir,
  listCollections,
  DATA_DIR
};

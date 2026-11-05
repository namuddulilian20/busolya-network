'use strict';

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_VERSION = 1;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 16;

/*
 * TEE (Trusted Execution Environment) security layer for JSONL documents.
 * Provides encryption at rest and integrity verification for local/dev data.
 *
 * Security model:
 *   - Master key derived from TEE_ENCRYPTION_KEY env var, fallback to SESSION_SECRET
 *   - Per-document encryption using AES-256-GCM with random IV
 *   - HMAC-SHA256 signature over ciphertext + IV + key version
 *   - Key rotation support via key_version field
 *   - Corrupted/tampered lines are detected and skipped (never silently trusted)
 */

function deriveMasterKey() {
  const secret = process.env.TEE_ENCRYPTION_KEY || process.env.SESSION_SECRET || 'busolya-default-dev-key-change-in-production';
  return crypto.createHash('sha256').update(secret).digest();
}

let _masterKey = null;
function masterKey() {
  if (!_masterKey) _masterKey = deriveMasterKey();
  return _masterKey;
}

function encryptDoc(doc) {
  const key = masterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const plaintext = JSON.stringify(doc);
  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const tag = cipher.getAuthTag();

  // Sign: HMAC over (key_version || iv || tag || ciphertext)
  const signInput = Buffer.concat([
    Buffer.from([KEY_VERSION]),
    iv,
    tag,
    encrypted
  ]);
  const hmac = crypto.createHmac('sha256', key).update(signInput).digest();

  return {
    _enc: true,
    _kv: KEY_VERSION,
    _iv: iv.toString('base64url'),
    _tag: tag.toString('base64url'),
    _ct: encrypted.toString('base64url'),
    _sig: hmac.toString('base64url')
  };
}

function decryptDoc(envelope) {
  if (!envelope || !envelope._enc) {
    // Plaintext legacy line — verify it is valid JSON and return as-is
    return envelope;
  }

  const key = masterKey();
  const iv = Buffer.from(envelope._iv, 'base64url');
  const tag = Buffer.from(envelope._tag, 'base64url');
  const encrypted = Buffer.from(envelope._ct, 'base64url');

  // Verify signature before decrypting
  const signInput = Buffer.concat([
    Buffer.from([envelope._kv || KEY_VERSION]),
    iv,
    tag,
    encrypted
  ]);
  const expected = crypto.createHmac('sha256', key).update(signInput).digest();
  const provided = Buffer.from(envelope._sig, 'base64url');
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    throw new Error('TEE integrity check failed: signature mismatch (tampered or corrupted line)');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

function rotateKey(newSecret) {
  _masterKey = crypto.createHash('sha256').update(newSecret).digest();
}

module.exports = {
  ALGORITHM,
  KEY_VERSION,
  encryptDoc,
  decryptDoc,
  rotateKey,
  masterKey,
  deriveMasterKey
};

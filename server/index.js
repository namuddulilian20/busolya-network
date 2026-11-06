'use strict';

require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const db = require('./db');
const ui = require('./admin');

const app = express();
const PORT = Number(process.env.PORT || 10000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || 'insecure-development-secret';
const SESSION_HOURS = 8;
const COOKIE = 'bsl_admin';

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));

// ---------- helpers ----------

function clean(value, max = 500) {
  if (value === null || value === undefined) return null;
  const s = String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return s ? s.slice(0, max) : null;
}

function num(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function bool(value) {
  return value === true || value === 'true' || value === '1' || value === 1 || value === 'on' || value === 'yes';
}

function phoneOk(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 15;
}

function jsonObject(value, depthGuard = 0) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || depthGuard > 0) return {};
  const out = {};
  const keys = Object.keys(value).slice(0, 40);
  for (const k of keys) {
    const key = clean(k, 60);
    if (!key) continue;
    const v = value[k];
    if (v === null || v === undefined) continue;
    if (typeof v === 'object') continue;
    out[key] = String(v).slice(0, 1200);
  }
  return out;
}

function csvCell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return '"' + s.replace(/"/g, '""') + '"';
}

function toCsv(rows, columns) {
  const head = columns.map((c) => csvCell(c.label)).join(',');
  const lines = rows.map((r) => columns.map((c) => csvCell(typeof c.get === 'function' ? c.get(r) : r[c.key])).join(','));
  return [head].concat(lines).join('\r\n') + '\r\n';
}

// ---------- sessions ----------

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  const a = Buffer.from(mac || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

function readCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function currentSession(req) {
  return verify(readCookies(req)[COOKIE]);
}

function requireAdmin(req, res, next) {
  if (currentSession(req)) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ ok: false, error: 'unauthorised' });
  return res.redirect('/admin/login');
}

// ---------- public API ----------

/* CORS with credentials: the three site origins call the API with
   credentials: 'include', so Access-Control-Allow-Origin must echo the
   exact origin — the wildcard '*' is rejected by the browser there.
   Anything else (curl, server-side) still works without the header. */
const CORS_ORIGINS = new Set([
  'https://bataka-agro-expo.onrender.com',
  'https://busolya-agro-farmers.onrender.com',
  'https://abataka-mutindo-sacco.onrender.com',
  'http://localhost:10000', 'http://localhost:3000', 'http://localhost:8080',
  'http://localhost:5500', 'http://127.0.0.1:5500', 'http://127.0.0.1:3000'
]);
app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && CORS_ORIGINS.has(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Vary', 'Origin');
  }
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

const hits = new Map();
function rateLimit(req, res, next) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const windowStart = now - 60 * 60 * 1000;
  const list = (hits.get(ip) || []).filter((t) => t > windowStart);
  if (list.length > 60) return res.status(429).json({ ok: false, error: 'Too many submissions from this connection. Try again later.' });
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return next();
}

app.get('/api/health', async (req, res) => {
  try {
    const now = await db.health();
    res.json({ ok: true, db: 'up', time: now, mode: db.isLocal ? 'jsonl' : 'postgres' });
  } catch (err) {
    res.status(503).json({ ok: false, db: 'down', error: err.message });
  }
});

// ---------- sync API (JSONL ↔ PostgreSQL) — admin only ----------

app.get('/api/sync/status', requireAdmin, async (req, res, next) => {
  try {
    const sync = db.sync;
    if (!sync) return res.json({ ok: true, mode: 'postgres', note: 'running in postgres mode — no local JSONL layer active' });
    const status = await sync.syncStatus();
    return res.json({ ok: true, ...status });
  } catch (err) { next(err); }
});

app.post('/api/sync/delta', requireAdmin, rateLimit, async (req, res, next) => {
  try {
    const sync = db.sync;
    if (!sync) return res.json({ ok: true, note: 'postgres mode — delta sync not applicable' });
    const result = await sync.deltaSync();
    return res.json({ ok: true, ...result });
  } catch (err) { next(err); }
});

app.post('/api/sync/export', requireAdmin, rateLimit, async (req, res, next) => {
  try {
    const sync = db.sync;
    if (!sync) return res.status(400).json({ ok: false, error: 'not in JSONL mode' });
    const result = await sync.exportToPg();
    return res.json({ ok: true, result });
  } catch (err) { next(err); }
});

app.post('/api/sync/import', requireAdmin, rateLimit, async (req, res, next) => {
  try {
    const sync = db.sync;
    if (!sync) return res.status(400).json({ ok: false, error: 'not in JSONL mode' });
    const result = await sync.importFromPg();
    return res.json({ ok: true, result });
  } catch (err) { next(err); }
});

app.post('/api/sync/backup', requireAdmin, rateLimit, async (req, res, next) => {
  try {
    const sync = db.sync;
    if (!sync) return res.status(400).json({ ok: false, error: 'not in JSONL mode' });
    const path    = require('path');
    const ts      = new Date().toISOString().replace(/[:.]/g, '-');
    const outFile = path.join(__dirname, '..', 'backups', `backup-${ts}.json`);
    await sync.backupToFile(outFile);
    return res.json({ ok: true, file: outFile });
  } catch (err) { next(err); }
});

app.get('/api/questions/:kind', async (req, res, next) => {
  try {
    const kind = req.params.kind;
    if (!['demand', 'supply', 'linkage'].includes(kind)) return res.status(404).json({ ok: false, error: 'unknown questionnaire' });
    const r = await db.query(
      'select id, kind, position, field, prompt, type, options, required from questions where kind = $1 and active order by position',
      [kind]
    );
    res.json({ ok: true, kind, questions: r.rows });
  } catch (err) { next(err); }
});

app.get('/api/directory', async (req, res, next) => {
  try {
    const q = clean(req.query.q, 80);
    const sector = clean(req.query.sector, 80);
    const params = [];
    const where = ['verified'];
    if (q) { params.push(`%${q}%`); where.push(`(name ilike $${params.length} or description ilike $${params.length} or sector ilike $${params.length})`); }
    if (sector) { params.push(sector); where.push(`sector = $${params.length}`); }
    const r = await db.query(
      `select id, name, sector, description, phone, email, district, website, exhibitor
         from directory_entries where ${where.join(' and ')} order by name limit 500`,
      params
    );
    res.json({ ok: true, entries: r.rows });
  } catch (err) { next(err); }
});

app.get('/api/subjects', async (req, res, next) => {
  try {
    const r = await db.query('select id, code, title, summary, outline, level from subjects where active order by code');
    res.json({ ok: true, subjects: r.rows });
  } catch (err) { next(err); }
});

app.get('/api/networks', async (req, res, next) => {
  try {
    const n = await db.query('select id, kind, name, model, description, status from networks order by kind, name');
    const m = await db.query("select network_id, count(*)::int as members from members where status = 'active' group by network_id");
    const counts = new Map(m.rows.map((row) => [String(row.network_id), row.members]));
    res.json({ ok: true, networks: n.rows.map((row) => ({ ...row, active_members: counts.get(String(row.id)) || 0 })) });
  } catch (err) { next(err); }
});

app.get('/api/governance', async (req, res, next) => {
  try {
    const layers = await db.query('select code, name, kind, parent_code, description, sort from governance_layers order by sort');
    const units = await db.query('select id, layer_code, name, parent_id, clan, notes from governance_units where verified order by name');
    res.json({ ok: true, layers: layers.rows, units: units.rows, register: 'working register, pending verification where marked' });
  } catch (err) { next(err); }
});

app.get('/api/stats', async (req, res, next) => {
  try {
    const r = await db.query(`
      select
        (select count(*)::int from submissions where kind = 'demand') as demand,
        (select count(*)::int from submissions where kind = 'supply') as supply,
        (select count(*)::int from submissions where kind = 'linkage') as linkage,
        (select count(*)::int from suppliers) as suppliers,
        (select count(*)::int from directory_entries where verified) as directory,
        (select count(*)::int from subjects where active) as subjects,
        (select count(*)::int from networks) as networks
    `);
    res.json({ ok: true, stats: r.rows[0] });
  } catch (err) { next(err); }
});

const REF_PREFIX = { demand: 'BAE-D', supply: 'BAE-S', linkage: 'BAE-L' };

// ---------- purchase order tracking ----------
app.post('/api/purchase-orders', requireSupplier, rateLimit, async (req, res, next) => {
  try {
    const b = req.body || {};
    const supplierId = req.supplier.id;
    const productId = Number(b.product_id) || null;
    const quantity = Number(b.quantity) || 0;
    const unitPrice = Number(b.unit_price) || 0;
    if (!productId || quantity <= 0) return res.status(400).json({ ok: false, error: 'product_id and positive quantity required' });
    const total = quantity * unitPrice;
    const r = await db.query(
      `insert into purchase_orders (supplier_id, product_id, quantity, unit_price, total, status, notes)
       values ($1,$2,$3,$4,$5,'pending',$6) returning *`,
      [supplierId, productId, quantity, unitPrice, total, b.notes || null]
    );
    res.json({ ok: true, po: r.rows[0] });
  } catch (err) { next(err); }
});

app.get('/api/purchase-orders', requireSupplier, async (req, res, next) => {
  try {
    const r = await db.query(
      `select po.*, sp.title as product_title from purchase_orders po
       join supplier_products sp on sp.id = po.product_id
       where po.supplier_id = $1 order by po.ordered_at desc`,
      [req.supplier.id]
    );
    res.json({ ok: true, orders: r.rows });
  } catch (err) { next(err); }
});

app.get('/api/inventory-summary', requireSupplier, async (req, res, next) => {
  try {
    const r = await db.query('select * from inventory_summary where supplier_id = $1 order by stock_status, product_title', [req.supplier.id]);
    res.json({ ok: true, summary: r.rows });
  } catch (err) { next(err); }
});

app.post('/api/low-stock-alerts', requireSupplier, rateLimit, async (req, res, next) => {
  try {
    const b = req.body || {};
    const supplierId = req.supplier.id;
    const productId = Number(b.product_id) || null;
    const threshold = Number(b.threshold) || 10;
    if (!productId || threshold < 0) return res.status(400).json({ ok: false, error: 'product_id and threshold required' });
    // Upsert: update if exists, insert if not
    const r = await db.query(
      `insert into low_stock_alerts (supplier_id, product_id, threshold, active)
       values ($1,$2,$3,true)
       on conflict (supplier_id, product_id)
       do update set threshold = excluded.threshold, active = true
       returning *`,
      [supplierId, productId, threshold]
    );
    res.json({ ok: true, alert: r.rows[0] });
  } catch (err) { next(err); }
});

app.get('/api/low-stock-alerts', requireSupplier, async (req, res, next) => {
  try {
    const r = await db.query(
      `select la.*, sp.title as product_title from low_stock_alerts la
       join supplier_products sp on sp.id = la.product_id
       where la.supplier_id = $1 and la.active = true`,
      [req.supplier.id]
    );
    res.json({ ok: true, alerts: r.rows });
  } catch (err) { next(err); }
});


app.post('/api/submissions', rateLimit, async (req, res, next) => {
  try {
    const body = req.body || {};
    const kind = clean(body.kind, 20);
    if (!kind || !REF_PREFIX[kind]) return res.status(400).json({ ok: false, error: 'kind must be demand, supply or linkage' });

    const respondent = body.respondent || {};
    const name = clean(respondent.name, 120);
    const phone = clean(respondent.phone, 40);
    if (!name) return res.status(400).json({ ok: false, error: 'name is required' });
    if (!phoneOk(phone)) return res.status(400).json({ ok: false, error: 'a phone number with 9 to 15 digits is required' });

    const credit = body.credit || {};
    const answers = jsonObject(body.answers);
    const payload = jsonObject(body.payload);

    const inserted = await db.query(
      `insert into submissions
         (kind, event, name, phone, email, district, org, role, category, payload, answers,
          credit_amount, guarantor_name, guarantor_phone, guarantor_rel, consent, source)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14,$15,$16,$17)
       returning id`,
      [
        kind,
        clean(body.event, 40) || 'bae-2026',
        name,
        phone,
        clean(respondent.email, 160),
        clean(respondent.district, 80),
        clean(respondent.org, 160),
        clean(respondent.role, 80),
        clean(respondent.category, 80),
        JSON.stringify(payload),
        JSON.stringify(answers),
        num(credit.amount),
        clean(credit.guarantorName, 120),
        clean(credit.guarantorPhone, 40),
        clean(credit.relation, 60),
        bool(body.consent),
        clean(body.source, 40) || 'web'
      ]
    );

    const id = inserted.rows[0].id;
    const counted = await db.query('select count(*)::int as n from submissions where kind = $1 and id <= $2', [kind, id]);
    const ref = `${REF_PREFIX[kind]}-${String(Number(counted.rows[0].n) || 1).padStart(4, '0')}`;
    await db.query('update submissions set ref = $1 where id = $2', [ref, id]);

    if (kind === 'demand') {
      await db.query(
        `insert into visitors (name, phone, district, role, org)
         values ($1,$2,$3,$4,$5)
         on conflict (phone) do update set
           last_seen = now(),
           visits = visitors.visits + 1,
           name = coalesce(excluded.name, visitors.name),
           district = coalesce(excluded.district, visitors.district),
           role = coalesce(excluded.role, visitors.role),
           org = coalesce(excluded.org, visitors.org)`,
        [name, phone, clean(respondent.district, 80), clean(respondent.role, 80), clean(respondent.org, 160)]
      );
    }

    if (kind === 'supply') {
      await db.query(
        `insert into suppliers (business, contact, phone, district, category, offer, capacity, price_band, listing_optin, credit_terms, status)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'new')`,
        [
          clean(respondent.org, 160) || name,
          name,
          phone,
          clean(respondent.district, 80),
          clean(respondent.category, 80),
          clean(payload.offer, 1200),
          clean(answers.capacity, 200),
          clean(answers.price_band, 120),
          bool(payload.listingOptin),
          clean(payload.creditTerms, 200)
        ]
      );
    }

    if (kind === 'linkage' && bool(answers.listed) === true) {
      await db.query(
        `insert into directory_entries (name, sector, description, phone, email, district, exhibitor, verified)
         values ($1,$2,$3,$4,$5,$6,true,false)`,
        [
          clean(respondent.org, 160) || name,
          clean(respondent.category, 80),
          clean(payload.deal || answers.deal, 800),
          phone,
          clean(respondent.email, 160),
          clean(respondent.district, 80)
        ]
      );
    }

    res.status(201).json({ ok: true, ref, id });
  } catch (err) { next(err); }
});

app.post('/api/contact', rateLimit, async (req, res, next) => {
  try {
    const b = req.body || {};
    const name = clean(b.name, 120);
    const phone = clean(b.phone, 40);
    const email = clean(b.email, 160);
    const message = clean(b.message, 2000);
    if (!name || (!phoneOk(phone) && !email)) return res.status(400).json({ ok: false, error: 'name and a phone number or email are required' });
    if (!message) return res.status(400).json({ ok: false, error: 'message is required' });
    await db.query(
      'insert into contacts (name, phone, email, org, message) values ($1,$2,$3,$4,$5)',
      [name, phone, email, clean(b.org, 160), message]
    );
    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
});

// ---------- supplier & participant auth ----------

const SUPPLIER_COOKIE = 'bsl_supplier';

function hashPwd(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

function signSupplier(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function verifySupplier(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  const a = Buffer.from(mac || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    return payload;
  } catch (err) { return null; }
}

function readSupplierCookie(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out[SUPPLIER_COOKIE];
}

function requireSupplier(req, res, next) {
  const payload = verifySupplier(readSupplierCookie(req));
  if (!payload) {
    if (req.path.startsWith('/api/')) return res.status(401).json({ ok: false, error: 'supplier login required' });
    return res.redirect('/supplier/login');
  }
  req.supplier = payload;
  return next();
}

// POST /api/auth/register — idempotent by phone; also accepts email.
// Default password is the phone number itself so lay users can log in immediately.
// If the role is 'supplier', auto-creates / updates a directory_entries row.
app.post('/api/auth/register', rateLimit, async (req, res, next) => {
  try {
    const b = req.body || {};
    const phone    = clean(b.phone, 40);
    const email    = clean(b.email, 160);
    const name     = clean(b.name, 120);
    const role     = b.role && ['supplier','member','customer','employee'].includes(b.role) ? b.role : 'customer';
    const district = clean(b.district, 80);
    const org      = clean(b.org, 160);
    const sector   = clean(b.sector, 80);

    // Password is optional — if omitted the phone number is the initial password.
    const rawPassword    = String(b.password || '');
    const usePhone       = !rawPassword;                // true → phone is the password
    const effectivePass  = usePhone ? phone : rawPassword;
    if (!usePhone && effectivePass.length < 6) {
      return res.status(400).json({ ok: false, error: 'password must be at least 6 characters' });
    }

    if (!phoneOk(phone)) return res.status(400).json({ ok: false, error: 'a valid phone number (9–15 digits) is required' });
    if (!name) return res.status(400).json({ ok: false, error: 'full name is required' });

    // Idempotent: upsert by phone
    const existing = await db.query('select id, role from participants where phone = $1', [phone]);
    let participantId, isNew;
    if (existing.rows.length) {
      await db.query(
        `update participants set
           name              = coalesce($2, name),
           email             = coalesce(nullif($3,''), email),
           role              = $4,
           district          = coalesce(nullif($5,''), district),
           org               = coalesce(nullif($6,''), org),
           password_hash     = $7,
           password_is_phone = $8
         where phone = $1`,
        [phone, name, email || null, role, district || null, org || null,
         hashPwd(effectivePass), usePhone]
      );
      participantId = existing.rows[0].id;
      isNew = false;
    } else {
      const ins = await db.query(
        `insert into participants
           (phone, email, name, role, district, org, password_hash, password_is_phone)
         values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
        [phone, email || null, name, role, district || null, org || null,
         hashPwd(effectivePass), usePhone]
      );
      participantId = ins.rows[0].id;
      isNew = true;
    }

    // For suppliers: auto-populate the business directory (yellow pages)
    if (role === 'supplier' && org) {
      const dirExisting = await db.query(
        'select id from directory_entries where phone = $1 limit 1', [phone]
      );
      if (!dirExisting.rows.length) {
        await db.query(
          `insert into directory_entries (name, sector, phone, email, district, verified)
           values ($1,$2,$3,$4,$5,false)`,
          [org, sector || null, phone, email || null, district || null]
        );
      } else {
        await db.query(
          `update directory_entries set
             name = coalesce(nullif($2,''), name),
             sector = coalesce(nullif($3,''), sector),
             email = coalesce(nullif($4,''), email),
             district = coalesce(nullif($5,''), district)
           where phone = $1`,
          [phone, org, sector || null, email || null, district || null]
        );
      }
    }

    return res.status(isNew ? 201 : 200).json({
      ok: true,
      id: participantId,
      phone,
      role,
      created: isNew,
      password_is_phone: usePhone,
      message: isNew
        ? (usePhone
            ? 'Account created. Your phone number is your initial password — change it any time from your portal.'
            : 'Account created. You can now sign in.')
        : 'Account updated.'
    });
  } catch (err) { next(err); }
});

// POST /api/auth/login — accepts phone OR email as login_id; sets session cookie.
// Phone-as-password: users whose password_is_phone = true can log in by entering
// their own phone number as the password, until they change it.
app.post('/api/auth/login', rateLimit, async (req, res, next) => {
  try {
    const b = req.body || {};
    // Accept login_id (email or phone) sent by the client login forms, or explicit phone/email
    const loginId  = clean(b.login_id || b.phone || b.email, 160);
    const password = String(b.password || '');
    if (!loginId) {
      return res.status(400).json({ ok: false, error: 'phone number or email is required' });
    }
    // If no password supplied, attempt phone-as-password (password = loginId)
    const effectivePassword = password || loginId;

    const isEmail = loginId.includes('@');
    const col = isEmail ? 'email' : 'phone';
    const p = await db.query(
      `select id, name, phone, email, password_hash, password_is_phone, role, org from participants where ${col} = $1`,
      [loginId]
    );
    let row = p.rows[0] || null;

    // Fallback: legacy supplier rows created via supply submissions
    if (!row) {
      const s = await db.query(
        `select id, business as name, phone, password_hash, false as password_is_phone, 'supplier' as role, business as org from suppliers where phone = $1`,
        [loginId]
      );
      row = s.rows[0] || null;
    }

    if (!row) {
      return res.status(401).json({ ok: false, error: 'no account found for that phone number' });
    }

    // Check password: always compare hashed. Phone-as-password: hash(phone) matches stored hash.
    const hashMatch = row.password_hash && row.password_hash === hashPwd(effectivePassword);
    if (!hashMatch) {
      return res.status(401).json({ ok: false, error: 'wrong password' });
    }

    const payload = {
      id:    row.id,
      phone: row.phone || loginId,
      name:  row.name || '',
      role:  row.role || 'customer',
      exp:   Date.now() + SESSION_HOURS * 3600 * 1000
    };
    res.cookie(SUPPLIER_COOKIE, signSupplier(payload), {
      httpOnly: true, sameSite: 'none', secure: true, maxAge: SESSION_HOURS * 3600 * 1000
    });
    return res.json({
      ok:               true,
      id:               row.id,
      phone:            row.phone || loginId,
      name:             row.name,
      role:             payload.role,
      password_is_phone: row.password_is_phone || false,
      hint:             row.password_is_phone
        ? 'You are using your phone number as your password. Visit your portal to change it.'
        : null
    });
  } catch (err) { next(err); }
});

// POST /api/auth/logout
app.post('/api/auth/logout', async (req, res) => {
  res.clearCookie(SUPPLIER_COOKIE, { httpOnly: true, sameSite: 'none', secure: true });
  return res.json({ ok: true });
});

// POST /api/auth/change-password
// Lets any logged-in user replace their phone-as-password with a real one,
// or change an existing password. Requires current_password OR phone-as-password acceptance.
app.post('/api/auth/change-password', requireSupplier, rateLimit, async (req, res, next) => {
  try {
    const b              = req.body || {};
    const newPassword    = String(b.new_password || b.password || '');
    const currentGuess   = String(b.current_password || req.supplier.phone || '');
    if (newPassword.length < 6) {
      return res.status(400).json({ ok: false, error: 'new password must be at least 6 characters' });
    }
    const r = await db.query(
      'select password_hash, password_is_phone, phone from participants where id = $1',
      [req.supplier.id]
    );
    if (!r.rows.length) return res.status(404).json({ ok: false, error: 'user not found' });
    const { password_hash, password_is_phone, phone } = r.rows[0];

    // Verify current password — accept either the stored hash or phone-as-password
    const currentOk = (password_hash === hashPwd(currentGuess)) ||
                      (password_is_phone && hashPwd(phone) === password_hash);
    if (!currentOk) {
      return res.status(401).json({ ok: false, error: 'current password is incorrect' });
    }

    await db.query(
      `update participants set password_hash = $1, password_is_phone = false where id = $2`,
      [hashPwd(newPassword), req.supplier.id]
    );
    return res.json({ ok: true, message: 'Password updated successfully.' });
  } catch (err) { next(err); }
});

// GET /api/auth/me
app.get('/api/auth/me', async (req, res) => {
  const payload = verifySupplier(readSupplierCookie(req));
  if (!payload) return res.status(401).json({ ok: false, error: 'not logged in' });
  return res.json({ ok: true, ...payload });
});

// GET /api/supplier/profile — logged-in supplier's editable stall details
app.get('/api/supplier/profile', requireSupplier, async (req, res, next) => {
  try {
    const r = await db.query(
      'select id, business, contact, phone, district, category, offer, capacity, price_band from suppliers where phone = $1 limit 1',
      [req.supplier.phone]
    );
    if (!r.rows.length) {
      return res.json({ ok: true, supplier: null, message: 'no supplier row yet — add a product to create one' });
    }
    return res.json({ ok: true, supplier: r.rows[0] });
  } catch (err) { next(err); }
});

// PATCH /api/supplier/profile — the exhibitor can rename their company/stall.
// Updates the suppliers row and keeps the public directory entry in sync.
app.patch('/api/supplier/profile', requireSupplier, rateLimit, async (req, res, next) => {
  try {
    const b = req.body || {};
    const business = clean(b.business, 160);
    const contact  = clean(b.contact, 120);
    const district = clean(b.district, 80);
    const category = clean(b.category, 80);
    if (!business && !contact && !district && !category) {
      return res.status(400).json({ ok: false, error: 'nothing to update' });
    }
    const upd = await db.query(
      `update suppliers set
         business = coalesce($2, business),
         contact  = coalesce($3, contact),
         district = coalesce($4, district),
         category = coalesce($5, category)
       where phone = $1
       returning id, business, contact, district, category`,
      [req.supplier.phone, business, contact, district, category]
    );
    let supplier;
    if (upd.rows.length) {
      supplier = upd.rows[0];
    } else {
      // No suppliers row yet for this phone — create one so the stall exists.
      const ins = await db.query(
        `insert into suppliers (business, contact, phone, district, category, listing_optin, credit_terms, status)
         values ($1,$2,$3,$4,$5,true,'','new')
         returning id, business, contact, district, category`,
        [business || req.supplier.name || req.supplier.phone,
         contact || req.supplier.name || req.supplier.phone,
         req.supplier.phone, district, category]
      );
      supplier = ins.rows[0];
    }
    // Keep the public yellow-pages entry aligned with the stall name
    if (business || district) {
      await db.query(
        `update directory_entries set
           name     = coalesce($2, name),
           district = coalesce(nullif($3,''), district)
         where phone = $1`,
        [req.supplier.phone, business, district || '']
      );
    }
    // And the login identity's org stays in step with the stall name
    if (business) {
      await db.query('update participants set org = $2 where phone = $1', [req.supplier.phone, business]);
    }
    return res.json({ ok: true, supplier });
  } catch (err) { next(err); }
});

// GET /api/stall-directory — public: live stall names keyed by the supplier's
// participant id (the id the marketplace already keys products on), so pages
// show the exhibitor's current company/stall name, not a frozen snapshot
app.get('/api/stall-directory', async (req, res, next) => {
  try {
    const r = await db.query(`
      select p.id,
             coalesce(s.business, p.org, p.name)  as business,
             coalesce(s.contact, p.name)          as contact,
             coalesce(s.category, p.org)          as category,
             coalesce(s.district, p.district)     as district,
             (select count(*)::int from supplier_products sp
              where sp.supplier_id = p.id and sp.available) as listings
      from participants p
      left join suppliers s on s.phone = p.phone
      where s.id is not null
         or exists (select 1 from supplier_products sp
                    where sp.supplier_id = p.id and sp.available)
      order by p.id
    `);
    return res.json({ ok: true, stalls: r.rows });
  } catch (err) { next(err); }
});

// GET /api/exhibitors — public: all registered exhibitors/stores with product count.
// Active = has at least one available product. Pending = registered but no products yet.
app.get('/api/exhibitors', async (req, res, next) => {
  try {
    const r = await db.query(`
      select p.id,
             coalesce(s.business, p.org, p.name)  as business,
             coalesce(s.contact, p.name)          as contact,
             coalesce(s.category, p.org)          as category,
             coalesce(s.district, p.district)     as district,
             (select count(*)::int from supplier_products sp
              where sp.supplier_id = p.id and sp.available) as listings
      from participants p
      left join suppliers s on s.phone = p.phone
      where s.id is not null
      order by p.id
    `);
    return res.json({ ok: true, exhibitors: r.rows });
  } catch (err) { next(err); }
});

// POST /api/supplier/product — logged-in supplier adds a product/service (becomes a supply lead)
app.post('/api/supplier/product', requireSupplier, rateLimit, async (req, res, next) => {
  try {
    const b = req.body || {};
    const name = clean(b.name, 160);
    const category = clean(b.category, 80);
    const offer = clean(b.offer || b.description, 1200);
    const capacity = clean(b.capacity, 200);
    const price_band = clean(b.price_band, 120);
    const district = clean(b.district, 80);
    const phone = clean(b.phone || req.supplier.phone, 40);
    if (!name || !offer) return res.status(400).json({ ok: false, error: 'product/service name and offer are required' });

    await db.query(
      `insert into suppliers (business, contact, phone, district, category, offer, capacity, price_band, listing_optin, credit_terms, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,true,'', 'new')
       on conflict (phone) do update set
         business = coalesce(excluded.business, suppliers.business),
         contact = coalesce(excluded.contact, suppliers.contact),
         district = coalesce(excluded.district, suppliers.district),
         category = coalesce(excluded.category, suppliers.category),
         offer = coalesce(excluded.offer, suppliers.offer),
         capacity = coalesce(excluded.capacity, suppliers.capacity),
         price_band = coalesce(excluded.price_band, suppliers.price_band)`,
      [name, name, phone, district, category, offer, capacity, price_band]
    );

    const refRow = await db.query("select count(*)::int as n from submissions where kind = 'supply'");
    const ref = 'BAE-S-' + String(Number(refRow.rows[0].n) + 1).padStart(4, '0');
    await db.query(
      `insert into submissions (ref, kind, event, name, phone, email, district, org, role, category, payload, answers, consent, status, source, created_at)
       values ($1,'supply','bae-2026',$2,$3,$4,$5,$6,'supplier',$7,$8,$9,true,'new','supplier-portal',now())`,
      [ref, name, phone, clean(b.email, 160), district, name, category,
       JSON.stringify({ offer, capacity, price_band, creditTerms: b.creditTerms || '' }),
       JSON.stringify({ category, capacity, price_band })
    ]);
    await db.query(
      `insert into visitors (name, phone, district, role, org)
       values ($1,$2,$3,'supplier',$4)
       on conflict (phone) do update set last_seen = now(), visits = visitors.visits + 1`,
      [name, phone, district, name]
    );
    return res.status(201).json({ ok: true, ref });
  } catch (err) { next(err); }
});

// ---------- static sites (local dev — in production Render serves these separately) ----------

const path = require('path');
app.use('/baf', express.static(path.join(__dirname, '..', 'sites', 'baf')));
app.use('/bae', express.static(path.join(__dirname, '..', 'sites', 'bae')));
app.use('/mutindo', express.static(path.join(__dirname, '..', 'sites', 'mutindo')));
app.use('/shared', express.static(path.join(__dirname, '..', 'sites', 'shared')));
app.get('/', (req, res) => res.redirect('/baf/index.html'));

// ---------- admin ----------

app.get('/admin/login', (req, res) => {
  if (currentSession(req)) return res.redirect('/admin');
  res.type('html').send(ui.loginPage(''));
});

app.post('/admin/login', (req, res) => {
  const password = (req.body && req.body.password) || '';
  const expected = ADMIN_PASSWORD;
  const a = crypto.createHash('sha256').update(password).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  const ok = expected.length > 0 && crypto.timingSafeEqual(a, b);
  if (!ok) return res.status(401).type('html').send(ui.loginPage('Wrong password.'));
  const token = sign({ u: 'admin', exp: Date.now() + SESSION_HOURS * 3600 * 1000 });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    maxAge: SESSION_HOURS * 3600 * 1000
  });
  return res.redirect('/admin');
});

app.post('/admin/logout', (req, res) => {
  res.clearCookie(COOKIE);
  res.redirect('/admin/login');
});

app.get('/', (req, res) => res.redirect('/admin'));

app.use('/admin', requireAdmin);

app.get('/admin', async (req, res, next) => {
  try {
    const counts = await db.query(`
      select
        (select count(*)::int from visitors) as visitors,
        (select count(*)::int from submissions where kind = 'demand') as demand,
        (select count(*)::int from submissions where kind = 'supply') as supply,
        (select count(*)::int from submissions where kind = 'linkage') as linkage,
        (select count(*)::int from suppliers) as suppliers,
        (select count(*)::int from directory_entries) as directory,
        (select count(*)::int from subjects where active) as subjects,
        (select count(*)::int from members) as members
    `);
    const recent = await db.query('select id, ref, kind, name, phone, district, status, created_at from submissions order by id desc limit 12');
    const note = ADMIN_PASSWORD ? '' : 'ADMIN_PASSWORD is not set on this service. Sign-in is disabled until it is.';
    res.type('html').send(ui.dashboard({ counts: counts.rows[0], recent: recent.rows, registerNote: note }));
  } catch (err) { next(err); }
});

app.get('/admin/submissions', async (req, res, next) => {
  try {
    const kind = ['demand', 'supply', 'linkage'].includes(req.query.kind) ? req.query.kind : 'demand';
    const q = clean(req.query.q, 80);
    const status = clean(req.query.status, 20);
    const params = [kind];
    const where = ['kind = $1'];
    if (q) {
      params.push(`%${q}%`);
      where.push(`(name ilike $${params.length} or phone ilike $${params.length} or district ilike $${params.length} or ref ilike $${params.length} or org ilike $${params.length})`);
    }
    if (status) { params.push(status); where.push(`status = $${params.length}`); }
    const rows = await db.query(
      `select id, ref, name, phone, org, category, district, status, created_at
         from submissions where ${where.join(' and ')} order by id desc limit 500`,
      params
    );
    res.type('html').send(ui.submissionsPage({ kind, rows: rows.rows, q, status }));
  } catch (err) { next(err); }
});

app.get('/admin/submissions/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).send('bad id');
    const r = await db.query('select * from submissions where id = $1', [id]);
    if (!r.rows.length) return res.status(404).send('not found');
    const row = r.rows[0];
    const qs = await db.query('select field, prompt from questions where kind = $1', [row.kind]);
    res.type('html').send(ui.detailPage({ row, answers: row.answers, questions: qs.rows }));
  } catch (err) { next(err); }
});

app.post('/admin/submissions/:id/status', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const status = clean(req.body.status, 20);
    if (!Number.isInteger(id) || !['new', 'contacted', 'matched', 'closed', 'dropped'].includes(status)) {
      return res.status(400).send('bad status');
    }
    await db.query('update submissions set status = $1 where id = $2', [status, id]);
    return res.redirect(`/admin/submissions/${id}`);
  } catch (err) { next(err); }
});

app.get('/admin/visitors', async (req, res, next) => {
  try {
    const r = await db.query('select * from visitors order by last_seen desc limit 500');
    res.type('html').send(ui.visitorsPage({ rows: r.rows }));
  } catch (err) { next(err); }
});

app.get('/admin/suppliers', async (req, res, next) => {
  try {
    const r = await db.query('select * from suppliers order by id desc limit 500');
    res.type('html').send(ui.suppliersPage({ rows: r.rows }));
  } catch (err) { next(err); }
});

app.get('/admin/contacts', async (req, res, next) => {
  try {
    const r = await db.query('select * from contacts order by id desc limit 500');
    res.type('html').send(ui.contactsPage({ rows: r.rows }));
  } catch (err) { next(err); }
});

app.get('/admin/directory', async (req, res, next) => {
  try {
    const rows = await db.query('select * from directory_entries order by verified asc, name asc limit 500');
    const sectors = await db.query("select distinct sector from directory_entries where sector is not null order by sector");
    res.type('html').send(ui.directoryPage({ rows: rows.rows, sectors: sectors.rows.map((r) => r.sector) }));
  } catch (err) { next(err); }
});

app.post('/admin/directory', async (req, res, next) => {
  try {
    const b = req.body || {};
    const name = clean(b.name, 160);
    if (!name) return res.status(400).send('name is required');
    await db.query(
      `insert into directory_entries (name, sector, description, phone, email, district, website, exhibitor, verified)
       values ($1,$2,$3,$4,$5,$6,$7,$8,false)`,
      [name, clean(b.sector, 80), clean(b.description, 800), clean(b.phone, 40), clean(b.email, 160), clean(b.district, 80), clean(b.website, 200), bool(b.exhibitor)]
    );
    return res.redirect('/admin/directory');
  } catch (err) { next(err); }
});

app.post('/admin/directory/:id/verify', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).send('bad id');
    await db.query('update directory_entries set verified = $1 where id = $2', [bool(req.body.verified), id]);
    return res.redirect('/admin/directory');
  } catch (err) { next(err); }
});

app.get('/admin/questions', async (req, res, next) => {
  try {
    const r = await db.query('select * from questions order by kind, position');
    const groups = { demand: [], supply: [], linkage: [] };
    r.rows.forEach((q) => { if (groups[q.kind]) groups[q.kind].push(q); });
    res.type('html').send(ui.questionsPage({ groups }));
  } catch (err) { next(err); }
});

app.post('/admin/questions', async (req, res, next) => {
  try {
    const b = req.body || {};
    const kind = ['demand', 'supply', 'linkage'].includes(b.kind) ? b.kind : null;
    const field = clean(b.field, 60);
    const prompt = clean(b.prompt, 300);
    if (!kind || !field || !prompt) return res.status(400).send('kind, field and prompt are required');
    const max = await db.query('select coalesce(max(position), 0) + 1 as next from questions where kind = $1', [kind]);
    await db.query(
      'insert into questions (kind, position, field, prompt, type, options, required) values ($1,$2,$3,$4,$5,$6::jsonb,true)',
      [kind, max.rows[0].next, field, prompt, clean(b.type, 20) || 'text', b.options ? JSON.stringify(String(b.options).split('|').map((s) => s.trim()).filter(Boolean)) : null]
    );
    return res.redirect('/admin/questions');
  } catch (err) { next(err); }
});

app.post('/admin/questions/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const b = req.body || {};
    if (!Number.isInteger(id)) return res.status(400).send('bad id');
    const options = b.options ? String(b.options).split('|').map((s) => s.trim()).filter(Boolean) : null;
    await db.query(
      'update questions set prompt = $1, type = $2, options = $3::jsonb, required = $4, active = $5 where id = $6',
      [clean(b.prompt, 300), clean(b.type, 20) || 'text', options ? JSON.stringify(options) : null, bool(b.required), bool(b.active), id]
    );
    return res.redirect('/admin/questions');
  } catch (err) { next(err); }
});

app.get('/admin/subjects', async (req, res, next) => {
  try {
    const subjects = await db.query('select * from subjects order by code');
    const topics = await db.query(`
      select et.*, s.title as subject_title, s.code as subject_code
      from education_topics et join subjects s on s.id = et.subject_id
      order by s.code, et.sort_order`);
    const notes = await db.query(`
      select en.*, et.code as topic_code, et.title as topic_title
      from education_notes en join education_topics et on et.id = en.topic_id
      order by et.code, en.locale`);
    res.type('html').send(ui.subjectsPage({ subjects: subjects.rows, topics: topics.rows, notes: notes.rows }));
  } catch (err) { next(err); }
});

app.post('/admin/subjects', async (req, res, next) => {
  try {
    const b = req.body || {};
    const code = clean(b.code, 10);
    const title = clean(b.title, 160);
    if (!code || !title) return res.status(400).send('code and title are required');
    const outline = String(b.outline || '').split('\n').map((s) => s.trim()).filter(Boolean);
    await db.query(
      'insert into subjects (code, title, summary, outline, level) values ($1,$2,$3,$4::jsonb,$5) on conflict (code) do nothing',
      [code, title, clean(b.summary, 400), JSON.stringify(outline), clean(b.level, 30) || 'foundation']
    );
    return res.redirect('/admin/subjects');
  } catch (err) { next(err); }
});

app.post('/admin/subjects/:id/toggle', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).send('bad id');
    await db.query('update subjects set active = $1 where id = $2', [bool(req.body.active), id]);
    return res.redirect('/admin/subjects');
  } catch (err) { next(err); }
});

// Add/edit education topic
app.post('/admin/topics', async (req, res, next) => {
  try {
    const b = req.body || {};
    const subject_id = Number(b.subject_id);
    const code = clean(b.code, 20);
    const title = clean(b.title, 160);
    const summary = clean(b.summary, 400);
    const level = clean(b.level, 30) || 'foundation';
    const sort_order = Number(b.sort_order) || 0;
    if (!Number.isInteger(subject_id) || !code || !title) return res.status(400).send('subject, code and title required');
    await db.query(
      `insert into education_topics (subject_id, code, title, summary, level, sort_order)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (subject_id, code) do update set title=excluded.title, summary=excluded.summary, level=excluded.level, sort_order=excluded.sort_order`,
      [subject_id, code, title, summary, level, sort_order]
    );
    return res.redirect('/admin/subjects');
  } catch (err) { next(err); }
});

// Add education note
app.post('/admin/notes', async (req, res, next) => {
  try {
    const b = req.body || {};
    const topic_code = clean(b.topic_code, 40);
    const title = clean(b.title, 160);
    const content = clean(b.content, 10000);
    const locale = clean(b.locale || 'en', 10);
    const format = clean(b.format || 'text', 20);
    const price_ugx = Number(b.price_ugx) || 5000;
    const presentation = bool(b.presentation);
    if (!topic_code || !title || !content) return res.status(400).send('topic, title and content required');
    const t = await db.query('select id from education_topics where code = $1', [topic_code]);
    if (!t.rows.length) return res.status(400).send('topic code not found');
    await db.query(
      `insert into education_notes (topic_id, title, content, locale, format, price_ugx, presentation)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [t.rows[0].id, title, content, locale, format, price_ugx, presentation]
    );
    return res.redirect('/admin/subjects');
  } catch (err) { next(err); }
});

// Toggle note active/inactive
app.post('/admin/notes/:id/toggle', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).send('bad id');
    await db.query('update education_notes set active = $1 where id = $2', [bool(req.body.active), id]);
    return res.redirect('/admin/subjects');
  } catch (err) { next(err); }
});

app.get('/admin/governance', async (req, res, next) => {
  try {
    const layers = await db.query('select * from governance_layers order by sort');
    const units = await db.query('select * from governance_units order by id desc limit 500');
    res.type('html').send(ui.governancePage({ layers: layers.rows, units: units.rows }));
  } catch (err) { next(err); }
});

app.post('/admin/units', async (req, res, next) => {
  try {
    const b = req.body || {};
    const name = clean(b.name, 160);
    const layer = clean(b.layer_code, 40);
    if (!name || !layer) return res.status(400).send('layer and name are required');
    const parent = Number(b.parent_id);
    await db.query(
      'insert into governance_units (layer_code, name, parent_id, clan, notes) values ($1,$2,$3,$4,$5)',
      [layer, name, Number.isInteger(parent) && parent > 0 ? parent : null, clean(b.clan, 120), clean(b.notes, 500)]
    );
    return res.redirect('/admin/governance');
  } catch (err) { next(err); }
});

app.get('/admin/networks', async (req, res, next) => {
  try {
    const networks = await db.query('select * from networks order by kind, name');
    const members = await db.query('select * from members order by joined_at desc');
    res.type('html').send(ui.networksPage({ networks: networks.rows, members: members.rows }));
  } catch (err) { next(err); }
});

app.post('/admin/networks/:id/members', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const b = req.body || {};
    if (!Number.isInteger(id) || !clean(b.org, 160)) return res.status(400).send('organisation is required');
    await db.query(
      'insert into members (network_id, org, contact, phone, role, status) values ($1,$2,$3,$4,$5,$6)',
      [id, clean(b.org, 160), clean(b.contact, 120), clean(b.phone, 40), clean(b.role, 80), clean(b.status, 20) || 'pending']
    );
    return res.redirect('/admin/networks');
  } catch (err) { next(err); }
});

// ---------- participants (users) ----------

// Auth guard for the users list — only admins / employees
function requireAdminOrEmployee (req, res, next) {
  const payload = verifySupplier(readSupplierCookie(req));
  if (!payload) return res.status(401).json({ ok: false, error: 'sign in required' });
  if (!['admin','employee'].includes(payload.role)) return res.status(403).json({ ok: false, error: 'forbidden' });
  req.operator = payload;
  return next();
}

app.get('/api/users', requireAdminOrEmployee, async (req, res, next) => {
  try {
    const role = clean(req.query.role, 20);
    const params = [];
    let sql = 'select id, phone, email, name, role, district, org, created_at from participants';
    if (role && ['supplier','member','customer','employee'].includes(role)) {
      params.push(role);
      sql += ' where role = $1';
    }
    sql += ' order by id desc limit 500';
    const r = await db.query(sql, params);
    return res.json({ ok: true, users: r.rows });
  } catch (err) { next(err); }
});

// POST /api/users — admin creates a participant directly (e.g. quick counter registration)
app.post('/api/users', requireAdminOrEmployee, rateLimit, async (req, res, next) => {
  try {
    const b = req.body || {};
    const phone    = clean(b.phone, 40);
    const name     = clean(b.name, 120);
    const role     = b.role && ['supplier','member','customer','employee'].includes(b.role) ? b.role : 'customer';
    const district = clean(b.district, 80);
    const org      = clean(b.org, 160);
    const email    = clean(b.email, 160);
    // Default password = last 6 digits of phone (or the phone itself if shorter)
    const rawPwd      = String(b.password || '');
    const usePhone    = !rawPwd;
    const effectivePwd = usePhone ? phone : rawPwd;

    if (!phoneOk(phone)) return res.status(400).json({ ok: false, error: 'valid phone required' });
    if (!name) return res.status(400).json({ ok: false, error: 'name required' });

    const r = await db.query(
      `insert into participants
         (phone, email, name, role, district, org, password_hash, password_is_phone)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (phone) do update set
         name              = excluded.name,
         email             = coalesce(excluded.email, participants.email),
         role              = excluded.role,
         district          = coalesce(excluded.district, participants.district),
         org               = coalesce(excluded.org, participants.org)
       returning id, phone, name, role, created_at`,
      [phone, email || null, name, role, district || null, org || null,
       hashPwd(effectivePwd), usePhone]
    );
    return res.status(201).json({ ok: true, user: r.rows[0], password_is_phone: usePhone });
  } catch (err) { next(err); }
});

// ---------- supplier products ----------

app.get('/api/suppliers/products', async (req, res, next) => {
  try {
    const supplierId = req.query.supplier_id;
    let sql = 'select * from supplier_products';
    const params = [];
    if (supplierId) {
      sql += ' where supplier_id = $1';
      params.push(supplierId);
    }
    sql += ' order by created_at desc limit 500';
    const r = await db.query(sql, params);
    return res.json({ ok: true, products: r.rows });
  } catch (err) { next(err); }
});

// GET /api/products/:id — public single product detail with its media
app.get('/api/products/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ ok: false, error: 'bad id' });
    const r = await db.query('select * from supplier_products where id = $1', [id]);
    if (!r.rows.length) return res.status(404).json({ ok: false, error: 'product not found' });
    const product = r.rows[0];
    // Attach public media (images, audio, video)
    const m = await db.query(
      `select id, media_type, title, description, filename, mime_type, size_bytes,
              storage_url, product_id, created_at
       from supplier_media
       where product_id = $1 and status = 'active'
       order by created_at asc`,
      [id]
    );
    product.media = m.rows || [];
    return res.json({ ok: true, product });
  } catch (err) { next(err); }
});

// GET /api/products/:id/media — public media for one product
app.get('/api/products/:id/media', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ ok: false, error: 'bad id' });
    const m = await db.query(
      `select id, media_type, title, description, filename, mime_type, size_bytes,
              storage_url, product_id, created_at
       from supplier_media
       where product_id = $1 and status = 'active'
       order by created_at asc`,
      [id]
    );
    return res.json({ ok: true, media: m.rows || [] });
  } catch (err) { next(err); }
});

// GET /api/stall/:supplierId/media — public: all media for a stall (for the marketplace thumbnails)
app.get('/api/stall/:supplierId/media', async (req, res, next) => {
  try {
    const sid = Number(req.params.supplierId);
    if (!Number.isInteger(sid) || sid < 1) return res.status(400).json({ ok: false, error: 'bad id' });
    const m = await db.query(
      `select id, media_type, title, storage_url, product_id
       from supplier_media
       where supplier_id = $1 and status = 'active' and media_type = 'image'
       order by created_at asc`,
      [sid]
    );
    return res.json({ ok: true, media: m.rows || [] });
  } catch (err) { next(err); }
});

app.post('/api/suppliers/products', requireSupplier, rateLimit, async (req, res, next) => {
  try {
    const b = req.body || {};
    const title = clean(b.title || b.name, 160);
    const category = clean(b.category, 80);
    const unit = clean(b.unit, 40);
    const price = Number(b.price || b.price_ugx) || 0;
    const quantity_stock = Number(b.quantity_stock || b.stock_qty) || 0;
    const description = clean(b.description, 800);
    const location = clean(b.location, 160);
    const district = clean(b.district, 80);
    if (!title) return res.status(400).json({ ok: false, error: 'product title is required' });
    const r = await db.query(
      `insert into supplier_products (supplier_id, title, category, unit, price, quantity_stock, description, location, district)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
      [req.supplier.id, title, category, unit, price, quantity_stock, description, location, district]
    );
    return res.status(201).json({ ok: true, product: r.rows[0] });
  } catch (err) { next(err); }
});

app.patch('/api/suppliers/products/:id', requireSupplier, rateLimit, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ ok: false, error: 'bad id' });
    const b = req.body || {};
    const sets = [];
    const params = [];
    let idx = 1;
    const fields = { title: b.title, category: b.category, unit: b.unit, price: b.price, quantity_stock: b.quantity_stock, description: b.description, location: b.location, district: b.district };
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined) continue;
      if (k === 'price' || k === 'quantity_stock') params.push(Number(v) || 0);
      else params.push(clean(String(v), k === 'description' ? 800 : 160));
      sets.push(`${k} = $${idx}`);
      idx += 1;
    }
    if (!sets.length) return res.status(400).json({ ok: false, error: 'nothing to update' });
    params.push(id, req.supplier.id);
    const r = await db.query(
      `update supplier_products set ${sets.join(', ')}, updated_at = now() where id = $${idx} and supplier_id = $${idx + 1} returning *`,
      params
    );
    if (!r.rows.length) return res.status(404).json({ ok: false, error: 'product not found' });
    return res.json({ ok: true, product: r.rows[0] });
  } catch (err) { next(err); }
});

app.delete('/api/suppliers/products/:id', requireSupplier, rateLimit, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ ok: false, error: 'bad id' });
    const r = await db.query('delete from supplier_products where id = $1 and supplier_id = $2 returning *', [id, req.supplier.id]);
    if (!r.rows.length) return res.status(404).json({ ok: false, error: 'product not found' });
    return res.json({ ok: true });
  } catch (err) { next(err); }
});

// ---------- supplier media (images / audio / video / documents) ----------
//
// Suppliers, members, and other lay users can upload product images, audio
// descriptions, video demonstrations, or any blob.  The phone-as-password
// flow means they can land here immediately after registration with no
// password setup friction.
//
// Storage is local on disk (uploads/ dir) in local/dev mode; in production
// swap MEDIA_BASE_URL + MEDIA_STORAGE_PATH or integrate with an object store.

(function mediaRoutes() {
  const multer = require('multer');
  const path   = require('path');
  const fs     = require('fs');

  const UPLOADS_DIR = process.env.MEDIA_STORAGE_PATH ||
    path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  const MEDIA_BASE_URL = process.env.MEDIA_BASE_URL || '/media';

  // Multer storage: organise by supplier id
  const storage = multer.diskStorage({
    destination(req, file, cb) {
      const dir = path.join(UPLOADS_DIR, String(req.supplier.id));
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(req, file, cb) {
      const ext  = path.extname(file.originalname) || '';
      const base = path.basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 60);
      const ts   = Date.now();
      cb(null, `${base}_${ts}${ext}`);
    }
  });

  const ALLOWED_MIME = /^(image|audio|video|application\/pdf|application\/octet-stream)/;
  const MAX_FILE_MB  = Number(process.env.MEDIA_MAX_MB || 50);

  const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_MB * 1024 * 1024 },
    fileFilter(req, file, cb) {
      if (!ALLOWED_MIME.test(file.mimetype)) {
        return cb(new Error('File type not allowed. Accepted: images, audio, video, PDF.'));
      }
      cb(null, true);
    }
  });

  function mediaType(mime) {
    if (/^image/.test(mime))                return 'image';
    if (/^audio/.test(mime))                return 'audio';
    if (/^video/.test(mime))                return 'video';
    if (/^application\/pdf/.test(mime))     return 'document';
    return 'blob';
  }

  // GET /api/media — list my media (or by product)
  app.get('/api/media', requireSupplier, async (req, res, next) => {
    try {
      const productId = req.query.product_id ? Number(req.query.product_id) : null;
      let sql    = 'select * from supplier_media where supplier_id = $1 and status = \'active\'';
      const args = [req.supplier.id];
      if (productId) { sql += ' and product_id = $2'; args.push(productId); }
      sql += ' order by created_at desc limit 200';
      const r = await db.query(sql, args);
      return res.json({ ok: true, media: r.rows });
    } catch (err) { next(err); }
  });

  // POST /api/media — upload one file
  app.post('/api/media', requireSupplier, rateLimit, upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ ok: false, error: 'no file received' });
      const b         = req.body || {};
      const suppId    = req.supplier.id;
      const relPath   = path.relative(UPLOADS_DIR, req.file.path).replace(/\\/g, '/');
      const publicUrl = `${MEDIA_BASE_URL}/${relPath}`;
      const mtype     = mediaType(req.file.mimetype);
      const productId = b.product_id ? Number(b.product_id) : null;

      const r = await db.query(
        `insert into supplier_media
           (supplier_id, media_type, title, description, filename, mime_type,
            size_bytes, storage_path, storage_url, product_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
        [suppId, mtype, clean(b.title, 160), clean(b.description, 500),
         req.file.originalname, req.file.mimetype, req.file.size,
         relPath, publicUrl, productId || null]
      );
      return res.status(201).json({ ok: true, media: r.rows[0] });
    } catch (err) { next(err); }
  });

  // DELETE /api/media/:id — remove a file (marks as deleted + removes from disk)
  app.delete('/api/media/:id', requireSupplier, rateLimit, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ ok: false, error: 'bad id' });
      const r = await db.query(
        'select storage_path from supplier_media where id = $1 and supplier_id = $2',
        [id, req.supplier.id]
      );
      if (!r.rows.length) return res.status(404).json({ ok: false, error: 'media not found' });

      // Soft-delete in db
      await db.query(
        "update supplier_media set status = 'deleted', updated_at = now() where id = $1",
        [id]
      );
      // Remove file from disk (best-effort)
      try {
        const diskPath = path.join(UPLOADS_DIR, r.rows[0].storage_path);
        if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
      } catch (_) { /* ignore */ }

      return res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // Serve uploads as static files at /media/*
  app.use(MEDIA_BASE_URL, express.static(UPLOADS_DIR, {
    // Never cache in dev
    setHeaders(res) {
      if (process.env.NODE_ENV !== 'production') {
        res.setHeader('Cache-Control', 'no-store');
      }
    }
  }));
})();

// ---------- education topics & notes ----------

app.get('/api/education/topics', async (req, res, next) => {
  try {
    const r = await db.query(`select et.id, et.code, et.title, et.summary, et.level, et.sort_order,
        et.subject_id, s.code as subject_code, s.title as subject_title
      from education_topics et join subjects s on s.id = et.subject_id order by s.code, et.sort_order`);
    return res.json({ ok: true, topics: r.rows });
  } catch (err) { next(err); }
});

app.get('/api/education/notes', async (req, res, next) => {
  try {
    const topicId = Number(req.query.topic_id) || null;
    const locale = clean(req.query.locale, 20) || 'en';
    const params = [locale];
    let sql = `select en.id, en.topic_id, et.code as topic_code, et.title as topic_title,
                en.title, en.content, en.format, en.price_ugx, en.locale, en.presentation, en.active
      from education_notes en
      join education_topics et on et.id = en.topic_id
      where en.locale = $1 and en.active`;
    if (topicId) { params.push(topicId); sql += ` and en.topic_id = $${params.length}`; }
    sql += ` order by et.sort_order, en.id`;
    const r = await db.query(sql, params);
    return res.json({ ok: true, notes: r.rows });
  } catch (err) { next(err); }
});

app.post('/api/education/notes', requireAdminOrEmployee, async (req, res, next) => {
  try {
    const b = req.body || {};
    const topic_code = clean(b.topic_code, 40);
    const title = clean(b.title, 160);
    const content = clean(b.content, 5000);
    const locale = clean(b.locale || 'en', 10);
    const format = clean(b.format || 'text', 20);
    const price_ugx = Number(b.price_ugx) || 5000;
    if (!topic_code || !title || !content) return res.status(400).json({ ok: false, error: 'topic_code, title and content are required' });
    const t = await db.query('select id from education_topics where code = $1 limit 1', [topic_code]);
    if (!t.rows.length) return res.status(400).json({ ok: false, error: 'topic code not found' });
    const r = await db.query(
      `insert into education_notes (topic_id, title, content, locale, format, price_ugx)
       values ($1,$2,$3,$4,$5,$6) returning *`,
      [t.rows[0].id, title, content, locale, format, price_ugx]
    );
    return res.status(201).json({ ok: true, note: r.rows[0] });
  } catch (err) { next(err); }
});

// ---------- presentations ----------

app.post('/api/education/presentations', requireAdminOrEmployee, async (req, res, next) => {
  try {
    const b = req.body || {};
    const note_id = Number(b.note_id);
    const title = clean(b.title, 160);
    const slides = Array.isArray(b.slides) ? b.slides : [];
    const locale = clean(b.locale || 'lug', 10);
    const price_ugx = Number(b.price_ugx) || 5000;
    if (!Number.isInteger(note_id) || !title) return res.status(400).json({ ok: false, error: 'note_id and title are required' });
    const n = await db.query('select id from education_notes where id = $1', [note_id]);
    if (!n.rows.length) return res.status(404).json({ ok: false, error: 'note not found' });
    const r = await db.query(
      `insert into education_presentations (note_id, title, slides, locale, price_ugx)
       values ($1,$2,$3::jsonb,$4,$5) returning *`,
      [note_id, title, JSON.stringify(slides), locale, price_ugx]
    );
    return res.status(201).json({ ok: true, presentation: r.rows[0] });
  } catch (err) { next(err); }
});

app.get('/api/education/presentations', async (req, res, next) => {
  try {
    const topicId = Number(req.query.topic_id) || null;
    const locale = clean(req.query.locale, 20) || 'lug';
    const params = [locale];
    let sql = `select ep.id, ep.note_id, ep.title, ep.slides, ep.locale, ep.price_ugx, ep.active,
                en.topic_id, et.code as topic_code, et.title as topic_title
      from education_presentations ep
      join education_notes en on en.id = ep.note_id
      join education_topics et on et.id = en.topic_id
      where ep.locale = $1 and ep.active`;
    if (topicId) { params.push(topicId); sql += ` and en.topic_id = $${params.length}`; }
    sql += ` order by et.sort_order, ep.id`;
    const r = await db.query(sql, params);
    return res.json({ ok: true, presentations: r.rows });
  } catch (err) { next(err); }
});

// ---------- shares ----------

app.post('/api/education/shares', requireSupplier, rateLimit, async (req, res, next) => {
  try {
    const b = req.body || {};
    const noteId = Number(b.note_id);
    const amount_ugx = Number(b.amount_ugx) || 5000;
    const participantId = req.supplier.id;
    if (!Number.isInteger(noteId)) return res.status(400).json({ ok: false, error: 'note_id is required' });
    const n = await db.query('select id, price_ugx from education_notes where id = $1 and active', [noteId]);
    if (!n.rows.length) return res.status(404).json({ ok: false, error: 'note not found' });
    // Idempotent: one share record per user per note
    const existing = await db.query(
      'select id from education_shares where note_id = $1 and participant_id = $2',
      [noteId, participantId]
    );
    if (existing.rows.length) {
      return res.json({ ok: true, already_shared: true });
    }
    await db.query(
      `insert into education_shares (note_id, participant_id, amount_ugx) values ($1,$2,$3)`,
      [noteId, participantId, amount_ugx]
    );
    return res.status(201).json({ ok: true });
  } catch (err) { next(err); }
});

// ---------- demand stock ----------

app.get('/api/visitor-requests/stock', async (req, res, next) => {
  try {
    const productId = Number(req.query.product_id) || null;
    const supplierId = Number(req.query.supplier_id) || null;
    let sql = `
      select ds.*, sp.title as product_title, sp.category, sp.district,
             sub.name as demand_name, sub.phone as demand_phone, sub.ref as demand_ref
      from visitor_requests_stock ds
      left join supplier_products sp on sp.id = ds.product_id
      left join submissions sub on sub.id = ds.submission_id
    `;
    const params = [];
    const conditions = [];
    if (productId) {
      conditions.push('ds.product_id = ' + (params.length + 1) + '');
      params.push(productId);
    }
    if (supplierId) {
      conditions.push('sp.supplier_id = ' + (params.length + 1) + '');
      params.push(supplierId);
    }
    if (conditions.length) sql += ' where ' + conditions.join(' and ');
    sql += ' order by ds.created_at desc limit 500';
    const r = await db.query(sql, params);
    return res.json({ ok: true, stock: r.rows });
  } catch (err) { next(err); }
}); // — link a supplier product to a visitor request submission
app.post('/api/visitor-requests/stock', requireSupplier, rateLimit, async (req, res, next) => {
  try {
    const b = req.body || {};
    const product_id = Number(b.product_id) || null;
    const submission_id = Number(b.submission_id) || null;
    const quantity = Number(b.quantity) || 0;
    if (!product_id && !submission_id) return res.status(400).json({ ok: false, error: 'product_id or submission_id required' });
    const r = await db.query(
      `insert into visitor_requests_stock (product_id, submission_id, quantity, status) values ($1,$2,$3,'pending') returning *`,
      [product_id, submission_id, quantity]
    );
    return res.status(201).json({ ok: true, entry: r.rows[0] });
  } catch (err) { next(err); }
});

// ---------- SACCO members ----------

app.get('/api/sacco/members', requireAdminOrEmployee, async (req, res, next) => {
  try {
    const r = await db.query(`
      select sm.*, p.name, p.phone, p.email, p.district
      from sacco_members sm
      join participants p on p.id = sm.user_id
      order by sm.joined_at desc limit 500`);
    return res.json({ ok: true, members: r.rows });
  } catch (err) { next(err); }
});

// Quick SACCO membership processing — creates participant + member in one call
app.post('/api/sacco/quick-register', rateLimit, async (req, res, next) => {
  try {
    const b = req.body || {};
    const phone = clean(b.phone, 40);
    const name = clean(b.name, 120);
    const district = clean(b.district, 80);
    const shares = Number(b.shares) || 0;
    const savings = Number(b.savings) || 0;
    const password = String(b.password || (phone ? phone.slice(-6) : ''));

    if (!phoneOk(phone)) return res.status(400).json({ ok: false, error: 'valid phone required' });
    if (!name) return res.status(400).json({ ok: false, error: 'name required' });
    if (password.length < 6) return res.status(400).json({ ok: false, error: 'password must be at least 6 characters' });

    // Idempotent participant upsert
    let participantId;
    const existing = await db.query('select id from participants where phone = $1', [phone]);
    if (existing.rows.length) {
      participantId = existing.rows[0].id;
      await db.query(
        `update participants set name = $2, role = 'member', district = coalesce(nullif($3,''), district) where id = $1`,
        [participantId, name, district || null]
      );
    } else {
      const ins = await db.query(
        `insert into participants (phone, name, role, district, password_hash)
         values ($1,$2,'member',$3,$4) returning id`,
        [phone, name, district || null, hashPwd(password)]
      );
      participantId = ins.rows[0].id;
    }

    // Idempotent SACCO member
    const memExisting = await db.query('select id, member_no from sacco_members where user_id = $1', [participantId]);
    if (memExisting.rows.length) {
      return res.json({ ok: true, member_no: memExisting.rows[0].member_no, created: false });
    }

    // Generate member number: AMS-YYYY-NNNN
    const count = await db.query("select count(*)::int as n from sacco_members");
    const member_no = 'AMS-' + new Date().getFullYear() + '-' + String(Number(count.rows[0].n) + 1).padStart(4, '0');

    const m = await db.query(
      `insert into sacco_members (user_id, member_no, shares, savings)
       values ($1,$2,$3,$4) returning member_no, joined_at`,
      [participantId, member_no, shares, savings]
    );

    if (shares > 0) {
      await db.query(
        `insert into sacco_transactions (member_id, type, amount, balance_after, narr, created_at)
         select sm.id, 'share_purchase', $2, $2, 'Opening shares', now()
         from sacco_members sm where sm.user_id = $1`,
        [participantId, shares]
      );
    }
    if (savings > 0) {
      await db.query(
        `insert into sacco_transactions (member_id, type, amount, balance_after, narr, created_at)
         select sm.id, 'deposit', $2, $2, 'Opening deposit', now()
         from sacco_members sm where sm.user_id = $1`,
        [participantId, savings]
      );
    }

    return res.status(201).json({ ok: true, member_no: m.rows[0].member_no, joined_at: m.rows[0].joined_at, created: true });
  } catch (err) { next(err); }
});

app.post('/api/sacco/members', requireAdminOrEmployee, rateLimit, async (req, res, next) => {
  try {
    const b = req.body || {};
    const user_id = Number(b.user_id);
    const shares = Number(b.shares) || 0;
    const savings = Number(b.savings) || 0;
    const status = clean(b.status, 20) || 'active';
    if (!Number.isInteger(user_id)) return res.status(400).json({ ok: false, error: 'user_id is required' });
    if (!['active','suspended','closed'].includes(status)) return res.status(400).json({ ok: false, error: 'invalid status' });
    const memExisting = await db.query('select id, member_no from sacco_members where user_id = $1', [user_id]);
    if (memExisting.rows.length) {
      return res.status(409).json({ ok: false, error: 'member already registered', member_no: memExisting.rows[0].member_no });
    }
    const count = await db.query("select count(*)::int as n from sacco_members");
    const member_no = 'AMS-' + new Date().getFullYear() + '-' + String(Number(count.rows[0].n) + 1).padStart(4, '0');
    const r = await db.query(
      `insert into sacco_members (user_id, member_no, shares, savings, status)
       values ($1,$2,$3,$4,$5) returning *`,
      [user_id, member_no, shares, savings, status]
    );
    return res.status(201).json({ ok: true, member: r.rows[0] });
  } catch (err) { next(err); }
});

// ---------- SACCO guarantors ----------

app.get('/api/sacco/guarantors', requireSupplier, async (req, res, next) => {
  try {
    const guarantorId = req.query.guarantor_id;
    let sql = `
      select sg.*, sm.member_no, p.name as member_name, p.phone as member_phone,
             g.name as guarantor_name, g.phone as guarantor_phone
      from sacco_guarantors sg
      join sacco_members sm on sm.id = sg.member_id
      join participants p on p.id = sm.user_id
      join participants g on g.id = sg.guarantor_id
    `;
    const params = [];
    if (guarantorId) {
      sql += ' where sg.guarantor_id = $' + (params.length + 1);
      params.push(guarantorId);
    }
    sql += ' order by sg.created_at desc limit 500';
    const r = await db.query(sql, params);
    return res.json({ ok: true, guarantors: r.rows });
  } catch (err) { next(err); }
});

// ---------- SACCO transactions ----------

app.get('/api/sacco/transactions', requireAdminOrEmployee, async (req, res, next) => {
  try {
    const member_id = Number(req.query.member_id) || null;
    let sql = 'select * from sacco_transactions';
    const params = [];
    if (member_id) { params.push(member_id); sql += ` where member_id = $${params.length}`; }
    sql += ' order by created_at desc limit 500';
    const r = await db.query(sql, params);
    return res.json({ ok: true, transactions: r.rows });
  } catch (err) { next(err); }
});

app.post('/api/sacco/transactions', requireAdminOrEmployee, rateLimit, async (req, res, next) => {
  try {
    const b = req.body || {};
    const member_id = Number(b.member_id);
    const type = b.type;
    const amount = Number(b.amount) || 0;
    const reference = clean(b.reference, 100);
    const narr = clean(b.narr, 300);
    const created_by = Number(b.created_by) || null;
    if (!Number.isInteger(member_id) || !['deposit','withdrawal','payout','credit','repayment','share_purchase'].includes(type)) {
      return res.status(400).json({ ok: false, error: 'valid member and type required' });
    }
    if (!amount || amount <= 0) return res.status(400).json({ ok: false, error: 'amount must be positive' });
    const m = await db.query('select shares, savings from sacco_members where id = $1', [member_id]);
    if (!m.rows.length) return res.status(404).json({ ok: false, error: 'member not found' });
    const cur = Number(m.rows[0].shares) + Number(m.rows[0].savings);
    let balance_after = cur;
    if (type === 'deposit' || type === 'share_purchase' || type === 'credit') balance_after = cur + amount;
    if (type === 'withdrawal' || type === 'payout' || type === 'repayment') balance_after = Math.max(0, cur - amount);
    await db.query(
      `update sacco_members set shares = $1, savings = $2 where id = $3`,
      [type === 'share_purchase' ? balance_after : Number(m.rows[0].shares), type === 'deposit' ? balance_after : Number(m.rows[0].savings), member_id]
    );
    const r = await db.query(
      `insert into sacco_transactions (member_id, type, amount, balance_after, reference, narr, created_by)
       values ($1,$2,$3,$4,$5,$6,$7) returning *`,
      [member_id, type, amount, balance_after, reference, narr, created_by]
    );
    return res.status(201).json({ ok: true, tx: r.rows[0] });
  } catch (err) { next(err); }
});

// ---------- Farm-Aid roles ----------

app.get('/api/farm-aid/roles', async (req, res, next) => {
  try {
    const r = await db.query('select * from farm_aid_roles order by role_code, location_level, location_name');
    return res.json({ ok: true, roles: r.rows });
  } catch (err) { next(err); }
});

// ---------- Farm-Aid reports ----------

app.get('/api/farm-aid/reports', async (req, res, next) => {
  try {
    const r = await db.query('select * from farm_aid_reports order by submitted_at desc limit 500');
    return res.json({ ok: true, reports: r.rows });
  } catch (err) { next(err); }
});

app.post('/api/farm-aid/reports', requireSupplier, rateLimit, async (req, res, next) => {
  try {
    const b = req.body || {};
    const reporter_id = Number(b.reporter_id);
    const report_type = clean(b.report_type, 80);
    const compartment = b.compartment && ['busolya','butaka'].includes(b.compartment) ? b.compartment : 'busolya';
    const ssaza = clean(b.ssaza, 80);
    const ssiga = clean(b.ssiga, 80);
    const mutuba = clean(b.mutuba, 80);
    const parish = clean(b.parish, 80);
    const village = clean(b.village, 80);
    const clan_name = clean(b.clan_name, 80);
    const content = clean(b.content, 4000);
    if (!Number.isInteger(reporter_id) || !report_type || !content) {
      return res.status(400).json({ ok: false, error: 'reporter_id, report_type and content are required' });
    }
    if (!['land_register','transaction','inventory','payment','dispute','verification','quality'].includes(report_type)) {
      return res.status(400).json({ ok: false, error: 'invalid report_type' });
    }
    await db.query(
      `insert into farm_aid_reports (reporter_id, report_type, compartment, ssaza, ssiga, mutuba, parish, village, clan_name, content)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [reporter_id, report_type, compartment, ssaza, ssiga, mutuba, parish, village, clan_name, JSON.stringify({ content })]
    );
    return res.status(201).json({ ok: true });
  } catch (err) { next(err); }
});

// ---------- server-side SACCO admin ----------

app.get('/admin/sacco', async (req, res, next) => {
  try {
    const members = await db.query(`
      select sm.*, p.name, p.phone, p.email, p.district
      from sacco_members sm join participants p on p.id = sm.user_id
      order by sm.joined_at desc limit 500`);
    const transactions = await db.query(`
      select st.*, sm.member_no, p.name
      from sacco_transactions st
      join sacco_members sm on sm.id = st.member_id
      join participants p on p.id = sm.user_id
      order by st.created_at desc limit 300`);
    const creditors = await db.query('select * from sacco_creditors order by created_at desc limit 200');
    const guarantors = await db.query('select * from sacco_guarantors order by created_at desc limit 200');
    res.type('html').send(ui.saccoPage({
      members: members.rows,
      transactions: transactions.rows,
      creditors: creditors.rows,
      guarantors: guarantors.rows
    }));
  } catch (err) { next(err); }
});

app.post('/admin/sacco/register', async (req, res, next) => {
  try {
    const b = req.body || {};
    const phone = clean(b.phone, 40);
    const name  = clean(b.name, 120);
    const district = clean(b.district, 80);
    const shares = Number(b.shares) || 0;
    const savings = Number(b.savings) || 0;
    const password = String(b.password || '').trim() || (phone ? phone.slice(-6) : 'changeme');
    if (!phoneOk(phone) || !name) return res.status(400).send('name and phone required');

    let participantId;
    const existing = await db.query('select id from participants where phone = $1', [phone]);
    if (existing.rows.length) {
      participantId = existing.rows[0].id;
      await db.query(`update participants set name=$2, role='member', district=coalesce(nullif($3,''),district) where id=$1`,
        [participantId, name, district || null]);
    } else {
      const ins = await db.query(
        `insert into participants (phone, name, role, district, password_hash) values ($1,$2,'member',$3,$4) returning id`,
        [phone, name, district || null, hashPwd(password)]
      );
      participantId = ins.rows[0].id;
    }
    const memExisting = await db.query('select id, member_no from sacco_members where user_id = $1', [participantId]);
    if (memExisting.rows.length) return res.redirect('/admin/sacco?msg=already_member:' + encodeURIComponent(memExisting.rows[0].member_no));

    const count = await db.query("select count(*)::int as n from sacco_members");
    const member_no = 'AMS-' + new Date().getFullYear() + '-' + String(Number(count.rows[0].n) + 1).padStart(4, '0');
    await db.query(`insert into sacco_members (user_id, member_no, shares, savings) values ($1,$2,$3,$4)`,
      [participantId, member_no, shares, savings]);

    if (shares > 0) await db.query(
      `insert into sacco_transactions (member_id, type, amount, balance_after, narr)
       select sm.id, 'share_purchase', $2, $2, 'Opening shares'
       from sacco_members sm where sm.user_id = $1`,
      [participantId, shares]);
    if (savings > 0) await db.query(
      `insert into sacco_transactions (member_id, type, amount, balance_after, narr)
       select sm.id, 'deposit', $2, $2, 'Opening deposit'
       from sacco_members sm where sm.user_id = $1`,
      [participantId, savings]);

    return res.redirect('/admin/sacco');
  } catch (err) { next(err); }
});

app.post('/admin/sacco/transaction', async (req, res, next) => {
  try {
    const b = req.body || {};
    const member_no = clean(b.member_no, 40);
    const type = b.type;
    const amount = Number(b.amount) || 0;
    const reference = clean(b.reference, 100);
    const narr = clean(b.narr, 300);
    if (!member_no || !type || amount <= 0) return res.status(400).send('member no., type and positive amount required');
    if (!['deposit','withdrawal','payout','credit','repayment','share_purchase'].includes(type)) return res.status(400).send('invalid type');

    const m = await db.query('select id, shares, savings from sacco_members where member_no = $1', [member_no]);
    if (!m.rows.length) return res.status(400).send('member not found: ' + member_no);
    const mem = m.rows[0];
    const cur = Number(mem.shares) + Number(mem.savings);
    let balance_after = cur;
    if (['deposit','credit','share_purchase'].includes(type)) balance_after = cur + amount;
    if (['withdrawal','payout','repayment'].includes(type)) balance_after = Math.max(0, cur - amount);

    if (type === 'share_purchase') {
      await db.query('update sacco_members set shares = shares + $1 where id = $2', [amount, mem.id]);
    } else if (type === 'deposit' || type === 'credit') {
      await db.query('update sacco_members set savings = savings + $1 where id = $2', [amount, mem.id]);
    } else {
      await db.query('update sacco_members set savings = greatest(0, savings - $1) where id = $2', [amount, mem.id]);
    }
    await db.query(
      `insert into sacco_transactions (member_id, type, amount, balance_after, reference, narr)
       values ($1,$2,$3,$4,$5,$6)`,
      [mem.id, type, amount, balance_after, reference, narr]
    );
    return res.redirect('/admin/sacco');
  } catch (err) { next(err); }
});

// ---------- server-side Farm Aid admin ----------

app.get('/admin/farmaid', async (req, res, next) => {
  try {
    const roles = await db.query(`
      select far.*, p.name, p.phone
      from farm_aid_roles far
      join participants p on p.id = far.user_id
      order by far.role_code, far.location_level, far.location_name`);
    const reports = await db.query(
      'select * from farm_aid_reports order by submitted_at desc limit 500');
    res.type('html').send(ui.farmAidPage({ roles: roles.rows, reports: reports.rows }));
  } catch (err) { next(err); }
});

app.post('/admin/farmaid/status', async (req, res, next) => {
  try {
    const id = Number(req.body.report_id);
    const status = clean(req.body.status, 20);
    if (!Number.isInteger(id) || !['pending','reviewed','cleared','disputed'].includes(status)) {
      return res.status(400).send('valid report id and status required');
    }
    await db.query('update farm_aid_reports set status = $1 where id = $2', [status, id]);
    return res.redirect('/admin/farmaid');
  } catch (err) { next(err); }
});

function csvRoute(path, filename, sql, columns) {
  app.get(path, async (req, res, next) => {
    try {
      const params = [];
      let query = sql;
      if (req.query.kind && ['demand', 'supply', 'linkage'].includes(req.query.kind)) {
        params.push(req.query.kind);
        query = `${sql} where kind = $1`;
      }
      const r = await db.query(`${query} limit 20000`, params);
      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(toCsv(r.rows, columns));
    } catch (err) { next(err); }
  });
}

csvRoute('/admin/export/submissions.csv', 'submissions.csv', 'select * from submissions', [
  { key: 'ref', label: 'ref' },
  { key: 'kind', label: 'kind' },
  { key: 'name', label: 'name' },
  { key: 'phone', label: 'phone' },
  { key: 'email', label: 'email' },
  { key: 'district', label: 'district' },
  { key: 'org', label: 'organisation' },
  { key: 'role', label: 'role' },
  { key: 'category', label: 'category' },
  { key: 'status', label: 'status' },
  { key: 'credit_amount', label: 'credit_amount' },
  { key: 'guarantor_name', label: 'guarantor' },
  { key: 'guarantor_phone', label: 'guarantor_phone' },
  { key: 'answers', label: 'answers', get: (r) => JSON.stringify(r.answers) },
  { key: 'payload', label: 'payload', get: (r) => JSON.stringify(r.payload) },
  { key: 'created_at', label: 'created_at' }
]);

csvRoute('/admin/export/visitors.csv', 'visitors.csv', 'select * from visitors', [
  { key: 'name', label: 'name' },
  { key: 'phone', label: 'phone' },
  { key: 'district', label: 'district' },
  { key: 'role', label: 'role' },
  { key: 'org', label: 'organisation' },
  { key: 'visits', label: 'visits' },
  { key: 'first_seen', label: 'first_seen' },
  { key: 'last_seen', label: 'last_seen' }
]);

csvRoute('/admin/export/suppliers.csv', 'suppliers.csv', 'select * from suppliers', [
  { key: 'business', label: 'business' },
  { key: 'contact', label: 'contact' },
  { key: 'phone', label: 'phone' },
  { key: 'district', label: 'district' },
  { key: 'category', label: 'category' },
  { key: 'offer', label: 'offer' },
  { key: 'capacity', label: 'capacity' },
  { key: 'price_band', label: 'price_band' },
  { key: 'listing_optin', label: 'listed' },
  { key: 'status', label: 'status' },
  { key: 'created_at', label: 'created_at' }
]);

csvRoute('/admin/export/directory.csv', 'directory.csv', 'select * from directory_entries', [
  { key: 'name', label: 'name' },
  { key: 'sector', label: 'sector' },
  { key: 'description', label: 'description' },
  { key: 'phone', label: 'phone' },
  { key: 'email', label: 'email' },
  { key: 'district', label: 'district' },
  { key: 'website', label: 'website' },
  { key: 'exhibitor', label: 'exhibitor' },
  { key: 'verified', label: 'verified' }
]);

app.get('/admin/export/backup.json', async (req, res, next) => {
  try {
    const tables = ['submissions', 'visitors', 'suppliers', 'directory_entries', 'questions', 'subjects', 'education_sessions', 'governance_layers', 'governance_units', 'networks', 'members', 'contacts', 'settings'];
    const out = { exported_at: new Date().toISOString(), tables: {} };
    for (const t of tables) {
      const r = await db.query(`select * from ${t}`);
      out.tables[t] = r.rows;
    }
    res.set('Content-Type', 'application/json; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="busolya-backup.json"');
    res.send(JSON.stringify(out, null, 2));
  } catch (err) { next(err); }
});

// ---------- errors ----------

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ ok: false, error: 'not found' });
  return res.status(404).type('html').send(ui.layout({ title: 'Not found', body: '<h1>Not found</h1><p><a href="/admin">Back to the desk</a></p>' }));
});

app.use((err, req, res, next) => {
  console.error(err);
  if (req.path.startsWith('/api/')) return res.status(500).json({ ok: false, error: 'server error' });
  return res.status(500).type('html').send(ui.layout({ title: 'Error', body: '<h1>Something failed</h1><p class="sub">The error was logged on the server.</p><p><a href="/admin">Back to the desk</a></p>' }));
});

// ---------- boot ----------

async function start() {
  let ready = false;
  for (let attempt = 1; attempt <= 10 && !ready; attempt += 1) {
    try {
      await db.migrate();
      await db.seedIfEmpty();
      ready = true;
    } catch (err) {
      console.error(`database not ready (attempt ${attempt}):`, err.message);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
  if (!ready) {
    console.error('starting anyway: the API will report 503 until the database is reachable');
  }
  if (!ADMIN_PASSWORD) {
    console.warn('ADMIN_PASSWORD is not set: /admin sign-in is disabled.');
  }
  app.listen(PORT, () => {
    console.log(`busolya api listening on ${PORT}`);
  });
}

if (process.env.NO_BOOT !== '1') start();

module.exports = app;




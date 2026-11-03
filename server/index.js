'use strict';

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

app.use('/api', (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
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
    res.json({ ok: true, db: 'up', time: now });
  } catch (err) {
    res.status(503).json({ ok: false, db: 'down', error: err.message });
  }
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
    const r = await db.query('select * from subjects order by code');
    res.type('html').send(ui.subjectsPage({ subjects: r.rows }));
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

// ---------- exports ----------

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

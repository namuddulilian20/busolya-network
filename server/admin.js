// Server-rendered admin UI. No build step, no client framework, no CDN.

function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return esc(value);
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

const STYLE = `
:root{--ink:#2b2420;--bark:#4a3427;--cream:#f7f1e6;--paper:#fffdf8;--leaf:#2f6b3c;--leafdark:#24512e;--seal:#9a3b2c;--line:#e2d6c2}
*{box-sizing:border-box}
body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--cream);color:var(--ink);font-size:15px;line-height:1.45}
a{color:var(--leaf);text-decoration:none}
a:hover{text-decoration:underline}
header.top{background:var(--bark);color:#fff;padding:0}
header.top .wrap{max-width:1200px;margin:0 auto;padding:12px 20px;display:flex;gap:18px;align-items:center;flex-wrap:wrap}
header.top .brand{font-weight:700;letter-spacing:.02em}
header.top nav{display:flex;gap:12px;flex-wrap:wrap;font-size:13px}
header.top nav a{color:#f2e7d6}
header.top nav a.on{color:#fff;border-bottom:2px solid #fff}
header.top .spacer{flex:1}
header.top .who{font-size:12px;color:#e3d3bf}
header.top form button{background:none;border:1px solid #8d7360;color:#f2e7d6;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:12px}
main{max-width:1200px;margin:0 auto;padding:22px 20px 60px}
h1{font-size:24px;margin:0 0 4px}
h2{font-size:18px;margin:26px 0 10px}
h3{font-size:15px;margin:18px 0 8px}
.sub{color:#6c5b4d;margin:0 0 16px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:12px;margin:16px 0}
.card{background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:14px}
.card .n{font-size:26px;font-weight:700;color:var(--bark)}
.card .l{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#7a6857}
table{width:100%;border-collapse:collapse;background:var(--paper);border:1px solid var(--line);border-radius:10px;overflow:hidden;font-size:13.5px}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #efe6d8;vertical-align:top}
th{background:#f2e9da;font-size:11.5px;text-transform:uppercase;letter-spacing:.07em;color:#6c5b4d}
tr:last-child td{border-bottom:none}
td.wrap{max-width:340px;white-space:pre-wrap}
.pill{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11.5px;background:#eadfcd;color:#5a4736}
.pill.new{background:#f6e0d8;color:var(--seal)}
.pill.ok{background:#dcecdd;color:var(--leafdark)}
form.inline{display:inline}
input,select,textarea{font:inherit;padding:7px 9px;border:1px solid #d8c9b3;border-radius:7px;background:#fff;color:var(--ink)}
textarea{min-height:70px}
button.btn{background:var(--leaf);color:#fff;border:none;border-radius:7px;padding:8px 14px;font-weight:600;cursor:pointer}
button.btn.small{padding:4px 9px;font-size:12px}
button.btn.dark{background:var(--bark)}
button.btn.warn{background:var(--seal)}
.row{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin:12px 0}
.panel{background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:16px;margin:16px 0}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
label{display:block;font-size:12px;font-weight:600;color:#6c5b4d;margin-bottom:4px}
label input,label select,label textarea{display:block;width:100%;margin-top:3px}
.muted{color:#7a6857;font-size:12.5px}
.login{max-width:380px;margin:10vh auto;background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:26px}
.login h1{font-size:20px}
.err{background:#f8e3dd;border-left:4px solid var(--seal);padding:9px 12px;border-radius:6px;margin:12px 0;font-size:13.5px}
.note{background:#f4eddd;border-left:4px solid #b08a4a;padding:10px 12px;border-radius:6px;margin:12px 0;font-size:13.5px}
dl{display:grid;grid-template-columns:190px 1fr;gap:6px 14px;margin:0}
dt{color:#7a6857;font-size:12.5px}
dd{margin:0}
@media(max-width:760px){.grid2{grid-template-columns:1fr}dl{grid-template-columns:1fr}td.wrap{max-width:220px}}
`;

const NAV = [
  ['/admin', 'Overview'],
  ['/admin/submissions?kind=demand', 'Demand log'],
  ['/admin/submissions?kind=supply', 'Supply log'],
  ['/admin/submissions?kind=linkage', 'Linkages'],
  ['/admin/visitors', 'Visitors'],
  ['/admin/users', 'Users & roles'],
  ['/admin/suppliers', 'Suppliers'],
  ['/admin/directory', 'Directory'],
  ['/admin/questions', 'Questionnaires'],
  ['/admin/subjects', 'Education'],
  ['/admin/governance', 'Governance'],
  ['/admin/networks', 'Networks'],
  ['/admin/contacts', 'Messages'],
  ['/admin/sacco', 'SACCO'],
  ['/admin/farmaid', 'Farm Aid']
];

function layout({ title, body, active = '' }) {
  const links = NAV.map(([href, label]) => {
    const key = href.split('?')[0];
    const on = active === key || (active === '/admin/submissions' && href.includes(active)) ? ' class="on"' : '';
    return `<a href="${href}"${on}>${esc(label)}</a>`;
  }).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)} · Busolya admin</title>
<style>${STYLE}</style>
</head>
<body>
<header class="top"><div class="wrap">
  <span class="brand">Busolya network · admin</span>
  <nav>${links}</nav>
  <span class="spacer"></span>
  <span class="who" id="who"></span>
  <form method="post" action="/admin/logout"><button type="submit">Sign out</button></form>
</div></header>
<main>${body}</main>
<script>
  (function () {
    var m = document.cookie.match(/(?:^|; )bsl_admin_name=([^;]*)/);
    if (m) document.getElementById('who').textContent = decodeURIComponent(m[1]);
  })();
</script>
</body>
</html>`;
}

function loginPage(error) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Sign in · Busolya admin</title>
<style>${STYLE}</style>
</head>
<body>
<div class="login">
  <h1>Busolya network admin</h1>
  <p class="sub">Demand, supply, linkages and the directory.</p>
  ${error ? `<div class="err">${esc(error)}</div>` : ''}
  <form method="post" action="/admin/login">
    <label>Phone or email <span class="muted">(administrator account)</span><input type="text" name="phone" autocomplete="username" placeholder="+256…"></label>
    <label>Password<input type="password" name="password" required autocomplete="current-password"></label>
    <div class="row"><button class="btn" type="submit">Sign in</button></div>
  </form>
  <p class="muted">Use your own administrator/staff account. If no per-user account exists yet, leave the phone blank and enter the shared <code>ADMIN_PASSWORD</code>.</p>
</div>
</body>
</html>`;
}

function table(headers, rows) {
  const head = headers.map((h) => `<th>${esc(h)}</th>`).join('');
  const body = rows.length
    ? rows.map((cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${headers.length}" class="muted">Nothing yet.</td></tr>`;
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function dashboard({ counts, recent, registerNote }) {
  const cards = [
    ['Visitors', counts.visitors],
    ['Demand leads', counts.demand],
    ['Supply offers', counts.supply],
    ['Linkage requests', counts.linkage],
    ['Suppliers', counts.suppliers],
    ['Directory entries', counts.directory],
    ['Education subjects', counts.subjects],
    ['Network members', counts.members]
  ]
    .map(([label, n]) => `<div class="card"><div class="n">${Number(n) || 0}</div><div class="l">${esc(label)}</div></div>`)
    .join('');

  const rows = recent.map((r) => [
    `<a href="/admin/submissions/${r.id}">${esc(r.ref || r.id)}</a>`,
    esc(r.kind),
    esc(r.name),
    esc(r.phone),
    esc(r.district),
    `<span class="pill ${r.status === 'new' ? 'new' : 'ok'}">${esc(r.status)}</span>`,
    `<span class="muted">${fmtDate(r.created_at)}</span>`
  ]);

  return layout({
    title: 'Overview',
    active: '/admin',
    body: `
      <h1>Overview</h1>
      <p class="sub">Everything captured at the desk, the expo and the website lands here.</p>
      ${registerNote ? `<div class="note">${esc(registerNote)}</div>` : ''}
      <div class="cards">${cards}</div>
      <h2>Latest captures</h2>
      ${table(['Ref', 'Kind', 'Name', 'Phone', 'District', 'Status', 'Created'], rows)}
      <h2>Exports</h2>
      <div class="row">
        <a class="btn small" style="color:#fff" href="/admin/export/submissions.csv">All submissions</a>
        <a class="btn small" style="color:#fff" href="/admin/export/visitors.csv">Visitors</a>
        <a class="btn small" style="color:#fff" href="/admin/export/suppliers.csv">Suppliers</a>
        <a class="btn small" style="color:#fff" href="/admin/export/directory.csv">Directory</a>
        <a class="btn small dark" style="color:#fff" href="/admin/export/backup.json">Full backup (JSON)</a>
      </div>`
  });
}

function submissionsPage({ kind, rows, q, status }) {
  const titles = { demand: 'Demand log', supply: 'Supply log', linkage: 'Business linkages' };
  const body = rows.map((r) => [
    `<a href="/admin/submissions/${r.id}">${esc(r.ref || r.id)}</a>`,
    esc(r.name),
    esc(r.phone),
    esc(r.org),
    esc(r.category),
    esc(r.district),
    `<span class="pill ${r.status === 'new' ? 'new' : 'ok'}">${esc(r.status)}</span>`,
    `<span class="muted">${fmtDate(r.created_at)}</span>`
  ]);
  return layout({
    title: titles[kind],
    active: '/admin/submissions',
    body: `
      <h1>${esc(titles[kind])}</h1>
      <p class="sub">${rows.length} record${rows.length === 1 ? '' : 's'}${q || status ? ' matching the filter' : ''}.</p>
      <form class="row" method="get" action="/admin/submissions">
        <input type="hidden" name="kind" value="${esc(kind)}">
        <label>Search<input name="q" value="${esc(q || '')}" placeholder="name, phone, district, ref"></label>
        <label>Status<select name="status">
          <option value="">Any</option>
          ${['new', 'contacted', 'matched', 'closed', 'dropped'].map((s) => `<option value="${s}"${status === s ? ' selected' : ''}>${s}</option>`).join('')}
        </select></label>
        <button class="btn" type="submit">Filter</button>
        <a class="btn small" style="color:#fff" href="/admin/export/submissions.csv?kind=${esc(kind)}">Export CSV</a>
      </form>
      ${table(['Ref', 'Name', 'Phone', 'Organisation', 'Category', 'District', 'Status', 'Created'], body)}`
  });
}

function detailPage({ row, answers, questions }) {
  const ask = new Map((questions || []).map((q) => [q.field, q.prompt]));
  const answerRows = Object.keys(answers || {}).map(
    (k) => `<dt>${esc(ask.get(k) || k)}</dt><dd>${esc(answers[k])}</dd>`
  );
  const payload = row.payload || {};
  const payloadRows = Object.keys(payload).map((k) => `<dt>${esc(k)}</dt><dd>${esc(payload[k])}</dd>`);
  return layout({
    title: row.ref || 'Submission',
    active: '/admin/submissions',
    body: `
      <h1>${esc(row.ref || 'Submission')}</h1>
      <p class="sub">${esc(row.kind)} · ${fmtDate(row.created_at)} · ${esc(row.source)}</p>
      <div class="panel">
        <dl>
          <dt>Name</dt><dd>${esc(row.name)}</dd>
          <dt>Phone</dt><dd>${esc(row.phone)}</dd>
          <dt>Email</dt><dd>${esc(row.email)}</dd>
          <dt>District</dt><dd>${esc(row.district)}</dd>
          <dt>Organisation</dt><dd>${esc(row.org)}</dd>
          <dt>Role</dt><dd>${esc(row.role)}</dd>
          <dt>Category</dt><dd>${esc(row.category)}</dd>
          <dt>Consent to contact</dt><dd>${row.consent ? 'yes' : 'no'}</dd>
          <dt>Status</dt><dd>${esc(row.status)}</dd>
          ${row.credit_amount ? `<dt>Credit sought</dt><dd>${esc(row.credit_amount)}</dd>` : ''}
          ${row.guarantor_name ? `<dt>Guarantor</dt><dd>${esc(row.guarantor_name)} (${esc(row.guarantor_rel || 'relation not given')}) ${esc(row.guarantor_phone)}</dd>` : ''}
        </dl>
      </div>
      ${answerRows.length ? `<h2>Questionnaire answers</h2><div class="panel"><dl>${answerRows.join('')}</dl></div>` : ''}
      ${payloadRows.length ? `<h2>Form fields</h2><div class="panel"><dl>${payloadRows.join('')}</dl></div>` : ''}
      <h2>Work this lead</h2>
      <form class="row" method="post" action="/admin/submissions/${row.id}/status">
        <label>Status<select name="status">
          ${['new', 'contacted', 'matched', 'closed', 'dropped'].map((s) => `<option value="${s}"${row.status === s ? ' selected' : ''}>${s}</option>`).join('')}
        </select></label>
        <button class="btn" type="submit">Save status</button>
      </form>`
  });
}

function directoryPage({ rows, sectors }) {
  const body = rows.map((r) => [
    esc(r.name),
    esc(r.sector),
    `<span class="wrap">${esc(r.description)}</span>`,
    esc(r.phone),
    esc(r.district),
    r.verified ? '<span class="pill ok">verified</span>' : '<span class="pill new">unverified</span>',
    r.exhibitor ? 'exhibitor' : '',
    r.verified
      ? `<form class="inline" method="post" action="/admin/directory/${r.id}/verify"><input type="hidden" name="verified" value="0"><button class="btn small warn" type="submit">Unverify</button></form>`
      : `<form class="inline" method="post" action="/admin/directory/${r.id}/verify"><input type="hidden" name="verified" value="1"><button class="btn small" type="submit">Verify</button></form>`
  ]);
  return layout({
    title: 'Directory',
    active: '/admin/directory',
    body: `
      <h1>Yellow-pages directory</h1>
      <p class="sub">Only verified entries should be printed. The public API exposes the verified list to the websites.</p>
      <form class="panel grid2" method="post" action="/admin/directory">
        <label>Business or organisation<input name="name" required></label>
        <label>Sector<input name="sector" list="sectors" required>
          <datalist id="sectors">${(sectors || []).map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
        </label>
        <label>Phone<input name="phone"></label>
        <label>District<input name="district"></label>
        <label>Email<input name="email" type="email"></label>
        <label>Website<input name="website"></label>
        <label style="grid-column:1/-1">What they offer<textarea name="description"></textarea></label>
        <label style="grid-column:1/-1"><span><input type="checkbox" name="exhibitor" value="1" style="width:auto;display:inline"> Exhibited at the expo</span></label>
        <div style="grid-column:1/-1"><button class="btn" type="submit">Add entry</button></div>
      </form>
      ${table(['Name', 'Sector', 'Description', 'Phone', 'District', 'State', 'Expo', ''], body)}`
  });
}

function questionsPage({ groups }) {
  const sections = Object.keys(groups)
    .map((kind) => {
      const rows = groups[kind].map((q) => [
        String(q.position),
        `<form class="inline" method="post" action="/admin/questions/${q.id}">
           <input name="prompt" value="${esc(q.prompt)}" style="min-width:280px">
           <select name="type">${['text', 'textarea', 'select', 'number', 'yesno']
             .map((t) => `<option${t === q.type ? ' selected' : ''}>${t}</option>`)
             .join('')}</select>
           <input name="options" value="${esc((q.options || []).join(' | '))}" placeholder="options, pipe separated" style="min-width:160px">
           <label style="display:inline"><input type="checkbox" name="required" value="1"${q.required ? ' checked' : ''} style="width:auto;display:inline"> required</label>
           <label style="display:inline"><input type="checkbox" name="active" value="1"${q.active ? ' checked' : ''} style="width:auto;display:inline"> active</label>
           <button class="btn small" type="submit">Save</button>
         </form>`,
        `<span class="muted">${esc(q.field)}</span>`
      ]);
      return `<h2>${esc(kind)} questionnaire</h2>
        ${table(['#', 'Question', 'Field'], rows)}
        <form class="row" method="post" action="/admin/questions">
          <input type="hidden" name="kind" value="${esc(kind)}">
          <label>New question<input name="prompt" required></label>
          <label>Field key<input name="field" required placeholder="snake_case"></label>
          <label>Type<select name="type">${['text', 'textarea', 'select', 'number', 'yesno'].map((t) => `<option>${t}</option>`).join('')}</select></label>
          <label>Options<input name="options" placeholder="pipe separated"></label>
          <button class="btn" type="submit">Add</button>
        </form>`;
    })
    .join('');
  return layout({
    title: 'Questionnaires',
    active: '/admin/questions',
    body: `
      <h1>Questionnaires</h1>
      <p class="sub">Each audience gets its own 5-7 question set. Answers are stored with the lead; the public forms load these live.</p>
      <div class="note">Keep each set between five and seven questions. If a question is retired, uncheck active instead of deleting it: past answers keep their meaning.</div>
      ${sections}`
  });
}

function subjectsPage({ subjects, topics = [], notes = [] }) {
  const subjectRows = subjects.map((s) => [
    esc(s.code),
    esc(s.title),
    `<span class="wrap">${esc(s.summary)}</span>`,
    esc(s.level),
    `<form class="inline" method="post" action="/admin/subjects/${s.id}/toggle"><input type="hidden" name="active" value="${s.active ? 0 : 1}"><button class="btn small ${s.active ? 'warn' : ''}" type="submit">${s.active ? 'Retire' : 'Restore'}</button></form>`
  ]);

  const topicRows = topics.map((t) => [
    esc(t.subject_code + ' — ' + t.subject_title),
    esc(t.code),
    esc(t.title),
    esc(t.level),
    esc(String(t.sort_order)),
    esc(t.summary || '')
  ]);

  const noteRows = notes.map((n) => [
    esc(n.topic_code),
    esc(n.title),
    `<span class="pill">${esc(n.locale)}</span>`,
    `<span class="pill">${esc(n.format)}</span>`,
    esc(String(n.price_ugx)),
    n.presentation ? '<span class="pill ok">pres</span>' : '',
    n.active ? '<span class="pill ok">live</span>' : '<span class="pill new">off</span>',
    `<form class="inline" method="post" action="/admin/notes/${n.id}/toggle"><input type="hidden" name="active" value="${n.active ? 0 : 1}"><button class="btn small ${n.active ? 'warn' : ''}" type="submit">${n.active ? 'Hide' : 'Show'}</button></form>`
  ]);

  return layout({
    title: 'Education',
    active: '/admin/subjects',
    body: `
      <h1>Education platform</h1>
      <p class="sub">Subjects → topics → notes (English) → presentations (Luganda). Admin adds, paid-up users share for UGX 5,000.</p>

      <h2>Subjects</h2>
      ${table(['Code', 'Subject', 'Summary', 'Level', ''], subjectRows)}
      <form class="panel grid2" method="post" action="/admin/subjects">
        <label>Code<input name="code" required placeholder="10"></label>
        <label>Title<input name="title" required></label>
        <label>Level<select name="level"><option>foundation</option><option>practical</option><option>advanced</option></select></label>
        <label>Summary<input name="summary"></label>
        <label style="grid-column:1/-1">Outline (one item per line)<textarea name="outline"></textarea></label>
        <div style="grid-column:1/-1"><button class="btn" type="submit">Add subject</button></div>
      </form>

      <h2>Topics</h2>
      ${table(['Subject', 'Code', 'Title', 'Level', 'Order', 'Summary'], topicRows)}
      <form class="panel grid2" method="post" action="/admin/topics">
        <label>Subject<select name="subject_id">${subjects.map((s) => `<option value="${s.id}">${esc(s.code + ' — ' + s.title)}</option>`).join('')}</select></label>
        <label>Topic code (e.g. fa-09)<input name="code" required></label>
        <label>Title<input name="title" required></label>
        <label>Level<select name="level"><option>foundation</option><option>practical</option><option>advanced</option></select></label>
        <label>Sort order<input name="sort_order" type="number" value="0"></label>
        <label>Summary<input name="summary"></label>
        <div style="grid-column:1/-1"><button class="btn" type="submit">Add / update topic</button></div>
      </form>

      <h2>Notes &amp; presentations</h2>
      <p class="muted">Notes stay in English; presentations are in Luganda. UGX 5,000 per share/print to paid-up users.</p>
      ${table(['Topic', 'Title', 'Locale', 'Format', 'Price (UGX)', 'Pres?', 'State', ''], noteRows)}
      <form class="panel grid2" method="post" action="/admin/notes">
        <label>Topic code<input name="topic_code" required list="topic-codes">
          <datalist id="topic-codes">${topics.map((t) => `<option value="${esc(t.code)}">${esc(t.code + ' — ' + t.title)}</option>`).join('')}</datalist>
        </label>
        <label>Locale<select name="locale"><option value="en">English</option><option value="lug">Luganda</option></select></label>
        <label>Title<input name="title" required></label>
        <label>Format<select name="format"><option>text</option><option>markdown</option><option>html</option><option>luganda</option></select></label>
        <label>Price (UGX)<input name="price_ugx" type="number" value="5000"></label>
        <label style="display:flex;align-items:center;gap:8px">
          <input type="checkbox" name="presentation" value="1"> This note is a presentation (Luganda localized)
        </label>
        <label style="grid-column:1/-1">Content (English notes / Luganda text for presentations)
          <textarea name="content" required style="min-height:140px"></textarea>
        </label>
        <div style="grid-column:1/-1"><button class="btn" type="submit">Add note / presentation</button></div>
      </form>`
  });
}

function governancePage({ layers, units }) {
  const rows = layers.map((l) => [
    esc(l.name),
    esc(l.kind),
    esc(l.parent_code || ''),
    `<span class="wrap">${esc(l.description)}</span>`
  ]);
  const unitRows = units.map((u) => [
    esc(u.name),
    esc(u.layer_code),
    esc(u.clan || ''),
    u.verified ? '<span class="pill ok">verified</span>' : '<span class="pill new">unverified</span>',
    `<span class="muted">${fmtDate(u.created_at)}</span>`
  ]);
  return layout({
    title: 'Governance',
    active: '/admin/governance',
    body: `
      <h1>Clan and administrative layers</h1>
      <p class="sub">The structure is fixed; the register is not. Only verified units may be published.</p>
      <h2>Layers</h2>
      ${table(['Layer', 'Type', 'Sits under', 'What it does'], rows)}
      <h2>Units on the register</h2>
      <div class="note">This register starts empty on purpose. Add a unit only after the clan or the sub-county confirms it, then mark it verified.</div>
      ${table(['Unit', 'Layer', 'Clan', 'State', 'Added'], unitRows)}
      <form class="panel grid2" method="post" action="/admin/units">
        <label>Layer<select name="layer_code">${layers.map((l) => `<option value="${esc(l.code)}">${esc(l.name)}</option>`).join('')}</select></label>
        <label>Name<input name="name" required></label>
        <label>Clan<input name="clan"></label>
        <label>Sits under (unit id)<input name="parent_id" inputmode="numeric"></label>
        <label style="grid-column:1/-1">Notes<textarea name="notes"></textarea></label>
        <div style="grid-column:1/-1"><button class="btn" type="submit">Add unit</button></div>
      </form>`
  });
}

function networksPage({ networks, members }) {
  const cards = networks.map((n) => `
    <div class="panel">
      <h2 style="margin-top:0">${esc(n.name)} <span class="pill">${esc(n.kind)}</span></h2>
      <p class="sub">${esc(n.description)}</p>
      <h3>Operating model</h3>
      <p>${esc(n.model)}</p>
      <h3>Members (${members.filter((m) => m.network_id === n.id).length})</h3>
      ${table(['Organisation', 'Contact', 'Phone', 'Role', 'Status'], members.filter((m) => m.network_id === n.id).map((m) => [esc(m.org), esc(m.contact), esc(m.phone), esc(m.role), `<span class="pill ${m.status === 'active' ? 'ok' : 'new'}">${esc(m.status)}</span>`]))}
      <form class="row" method="post" action="/admin/networks/${n.id}/members">
        <label>Organisation<input name="org" required></label>
        <label>Contact<input name="contact"></label>
        <label>Phone<input name="phone"></label>
        <label>Role<input name="role" placeholder="supplier, buyer, transporter"></label>
        <label>Status<select name="status"><option>pending</option><option>active</option></select></label>
        <button class="btn" type="submit">Add member</button>
      </form>
    </div>`).join('');
  return layout({
    title: 'Networks',
    active: '/admin/networks',
    body: `
      <h1>Business and trade networks</h1>
      <p class="sub">The two operating models, and who has joined.</p>
      ${cards}`
  });
}

function visitorsPage({ rows }) {
  return layout({
    title: 'Visitors',
    active: '/admin/visitors',
    body: `
      <h1>Visitors</h1>
      <p class="sub">Built from the demand log and the desk check-in: one row per phone number.</p>
      ${table(['Name', 'Phone', 'District', 'Role', 'Organisation', 'Visits', 'First seen', 'Last seen'], rows.map((r) => [
        esc(r.name), esc(r.phone), esc(r.district), esc(r.role), esc(r.org), String(r.visits), fmtDate(r.first_seen), fmtDate(r.last_seen)
      ]))}`
  });
}

function suppliersPage({ rows }) {
  return layout({
    title: 'Suppliers',
    active: '/admin/suppliers',
    body: `
      <h1>Suppliers and service providers</h1>
      <p class="sub">Every supply-log entry creates or updates a supplier row.</p>
      ${table(['Business', 'Contact', 'Phone', 'Category', 'District', 'Capacity', 'Listed', 'Status', 'Created'], rows.map((r) => [
        esc(r.business), esc(r.contact), esc(r.phone), esc(r.category), esc(r.district), esc(r.capacity),
        r.listing_optin ? 'yes' : 'no', `<span class="pill ${r.status === 'new' ? 'new' : 'ok'}">${esc(r.status)}</span>`, fmtDate(r.created_at)
      ]))}`
  });
}

function contactsPage({ rows }) {
  return layout({
    title: 'Messages',
    active: '/admin/contacts',
    body: `
      <h1>Messages</h1>
      <p class="sub">Contact-form messages from the three websites.</p>
      ${table(['Name', 'Phone', 'Email', 'Organisation', 'Message', 'Received'], rows.map((r) => [
        esc(r.name), esc(r.phone), esc(r.email), esc(r.org), `<span class="wrap">${esc(r.message)}</span>`, fmtDate(r.created_at)
      ]))}`
  });
}

const ROLE_OPTIONS = ['supplier', 'member', 'customer', 'employee', 'admin'];

function usersPage({ rows, role = '', q = '' }) {
  const body = rows.map((u) => [
    `<a href="/admin/users/${u.id}">${esc(u.name || '(no name)')}</a>${u.is_superuser ? ' <span title="Superuser">👑</span>' : ''}`,
    esc(u.phone),
    esc(u.email),
    `<span class="pill">${esc(u.role)}</span>`,
    esc(u.district || u.org || ''),
    u.is_active === false
      ? '<span class="pill new">suspended</span>'
      : '<span class="pill ok">active</span>',
    `<span class="muted">${fmtDate(u.created_at)}</span>`
  ]);

  return layout({
    title: 'Users & roles',
    active: '/admin/users',
    body: `
      <h1>Users &amp; roles</h1>
      <p class="sub">Everyone with an account: members, suppliers, customers, staff and administrators.</p>
      <form method="get" action="/admin/users" class="row">
        <label>Role
          <select name="role">
            <option value="">All roles</option>
            ${ROLE_OPTIONS.map((r) => `<option value="${r}"${role === r ? ' selected' : ''}>${r}</option>`).join('')}
          </select>
        </label>
        <label>Search
          <input type="search" name="q" value="${esc(q)}" placeholder="name, phone, email or org">
        </label>
        <button class="btn small" type="submit">Filter</button>
        <a class="btn small dark" style="color:#fff" href="/admin/users/new">New user</a>
      </form>
      ${table(['Name', 'Phone', 'Email', 'Role', 'District / org', 'Status', 'Created'], body)}
      <p class="muted">👑 marks the superuser account. Public accounts sign in with phone verification; administrators and staff sign in with their password.</p>`
  });
}

function userNewPage({ error = '' }) {
  return layout({
    title: 'New user',
    active: '/admin/users',
    body: `
      <h1>New user</h1>
      <p class="sub"><a href="/admin/users">← Back to users</a></p>
      ${error ? `<div class="err">${esc(error)}</div>` : ''}
      <div class="panel">
        <form method="post" action="/admin/users">
          <div class="grid2">
            <label>Full name *<input type="text" name="name" required></label>
            <label>Phone number *<input type="tel" name="phone" required placeholder="+256…"></label>
            <label>Email<input type="email" name="email"></label>
            <label>Role
              <select name="role">
                ${ROLE_OPTIONS.map((r) => `<option value="${r}"${r === 'customer' ? ' selected' : ''}>${r}</option>`).join('')}
              </select>
            </label>
            <label>District<input type="text" name="district"></label>
            <label>Organisation<input type="text" name="org"></label>
          </div>
          <label>Password <span class="muted">(required for administrator / staff roles; leave blank for public accounts)</span>
            <input type="password" name="password" autocomplete="new-password">
          </label>
          <div class="row"><button class="btn" type="submit">Create user</button></div>
        </form>
      </div>`
  });
}

function userEditPage({ row, canManage = false, message = '' }) {
  const roleForm = canManage && !row.is_superuser ? `
    <div class="panel">
      <h2>Role</h2>
      <form method="post" action="/admin/users/${row.id}/role" class="row">
        <label>Role
          <select name="role">
            ${ROLE_OPTIONS.map((r) => `<option value="${r}"${row.role === r ? ' selected' : ''}>${r}</option>`).join('')}
          </select>
        </label>
        <button class="btn small" type="submit">Save role</button>
      </form>
      <p class="muted">Administrators and staff need a password before they can hold that role.</p>
    </div>` : '';

  const passwordForm = canManage ? `
    <div class="panel">
      <h2>Reset password</h2>
      <form method="post" action="/admin/users/${row.id}/password" class="row">
        <label>New password<input type="password" name="password" minlength="6" autocomplete="new-password" required></label>
        <button class="btn small warn" type="submit">Set password</button>
      </form>
      <p class="muted">${row.has_password ? 'This account already has a password.' : 'No password set — this account signs in with phone verification.'}</p>
    </div>` : '';

  const statusForm = canManage && !row.is_superuser ? `
    <div class="panel">
      <h2>Access</h2>
      <form method="post" action="/admin/users/${row.id}/status" class="row">
        <input type="hidden" name="active" value="${row.is_active === false ? 'true' : 'false'}">
        <button class="btn small ${row.is_active === false ? '' : 'warn'}" type="submit">
          ${row.is_active === false ? 'Reactivate account' : 'Suspend account'}
        </button>
      </form>
      <p class="muted">Suspension blocks sign-in but keeps the record and its history.</p>
    </div>` : '';

  return layout({
    title: row.name || 'User',
    active: '/admin/users',
    body: `
      <h1>${esc(row.name || '(no name)')} ${row.is_superuser ? '<span title="Superuser">👑</span>' : ''}</h1>
      <p class="sub"><a href="/admin/users">← Back to users</a></p>
      ${message ? `<div class="note">${esc(message)}</div>` : ''}
      ${!canManage ? '<div class="note">Your account can view users but not change roles, passwords or access.</div>' : ''}
      <div class="panel">
        <dl>
          <dt>Phone</dt><dd>${esc(row.phone)}</dd>
          <dt>Role</dt><dd><span class="pill">${esc(row.role)}</span></dd>
          <dt>Status</dt><dd>${row.is_active === false ? '<span class="pill new">suspended</span>' : '<span class="pill ok">active</span>'}</dd>
          <dt>Superuser</dt><dd>${row.is_superuser ? 'Yes — protected account' : 'No'}</dd>
          <dt>Created</dt><dd>${fmtDate(row.created_at)}</dd>
        </dl>
      </div>
      <div class="panel">
        <h2>Profile</h2>
        <form method="post" action="/admin/users/${row.id}">
          <div class="grid2">
            <label>Full name *<input type="text" name="name" value="${esc(row.name)}" required></label>
            <label>Email<input type="email" name="email" value="${esc(row.email)}"></label>
            <label>District<input type="text" name="district" value="${esc(row.district)}"></label>
            <label>Organisation<input type="text" name="org" value="${esc(row.org)}"></label>
          </div>
          <div class="row"><button class="btn" type="submit">Save profile</button></div>
        </form>
      </div>
      ${roleForm}
      ${passwordForm}
      ${statusForm}`
  });
}

module.exports = {
  esc,
  fmtDate,
  layout,
  loginPage,
  dashboard,
  submissionsPage,
  detailPage,
  directoryPage,
  questionsPage,
  subjectsPage,
  governancePage,
  networksPage,
  visitorsPage,
  suppliersPage,
  usersPage,
  userNewPage,
  userEditPage,
  contactsPage,
  saccoPage,
  farmAidPage
};

function saccoPage({ members, transactions, creditors, guarantors }) {
  const totalShares  = members.reduce((a, m) => a + Number(m.shares || 0), 0);
  const totalSavings = members.reduce((a, m) => a + Number(m.savings || 0), 0);
  const active       = members.filter((m) => m.status === 'active').length;

  const memberRows = members.map((m) => [
    esc(m.member_no),
    esc(m.name),
    esc(m.phone),
    esc(m.district || ''),
    Number(m.shares).toLocaleString(),
    Number(m.savings).toLocaleString(),
    `<span class="pill ${m.status === 'active' ? 'ok' : 'new'}">${esc(m.status)}</span>`,
    fmtDate(m.joined_at)
  ]);

  const txRows = transactions.slice(0, 200).map((t) => [
    esc(t.member_no || ''),
    esc(t.type),
    Number(t.amount).toLocaleString(),
    Number(t.balance_after).toLocaleString(),
    esc(t.narr || ''),
    esc(t.reference || ''),
    fmtDate(t.created_at)
  ]);

  return layout({
    title: 'SACCO',
    active: '/admin/sacco',
    body: `
      <h1>Abataka Mutindo SACCO</h1>
      <p class="sub">Deposits, withdrawals, payouts, credits, repayments and share purchases.</p>
      <div class="cards">
        <div class="card"><div class="n">${active}</div><div class="l">Active members</div></div>
        <div class="card"><div class="n">${members.length}</div><div class="l">Total members</div></div>
        <div class="card"><div class="n">${totalShares.toLocaleString()}</div><div class="l">Total shares (UGX)</div></div>
        <div class="card"><div class="n">${totalSavings.toLocaleString()}</div><div class="l">Total savings (UGX)</div></div>
      </div>

      <h2>Member registry</h2>
      ${table(['Member no.', 'Name', 'Phone', 'District', 'Shares', 'Savings', 'Status', 'Joined'], memberRows)}

      <h2>Quick membership registration</h2>
      <form class="panel grid2" method="post" action="/admin/sacco/register">
        <label>Full name<input name="name" required></label>
        <label>Phone<input name="phone" required type="tel"></label>
        <label>District<input name="district"></label>
        <label>Opening shares (UGX)<input name="shares" type="number" value="0" min="0"></label>
        <label>Opening savings (UGX)<input name="savings" type="number" value="0" min="0"></label>
        <label>Temporary password (default: last 6 of phone)<input name="password" placeholder="auto"></label>
        <div style="grid-column:1/-1"><button class="btn" type="submit">Register member</button></div>
      </form>

      <h2>Post a transaction</h2>
      <form class="panel grid2" method="post" action="/admin/sacco/transaction">
        <label>Member no.<input name="member_no" required list="member-nos">
          <datalist id="member-nos">${members.map((m) => `<option value="${esc(m.member_no)}">${esc(m.name)}</option>`).join('')}</datalist>
        </label>
        <label>Type<select name="type">
          <option value="deposit">Deposit</option>
          <option value="withdrawal">Withdrawal</option>
          <option value="payout">Payout</option>
          <option value="credit">Credit (loan out)</option>
          <option value="repayment">Repayment</option>
          <option value="share_purchase">Share purchase</option>
        </select></label>
        <label>Amount (UGX)<input name="amount" type="number" min="1" required></label>
        <label>Reference / receipt no.<input name="reference"></label>
        <label style="grid-column:1/-1">Narration<input name="narr"></label>
        <div style="grid-column:1/-1"><button class="btn" type="submit">Post transaction</button></div>
      </form>

      <h2>Recent transactions</h2>
      ${table(['Member', 'Type', 'Amount', 'Balance after', 'Narration', 'Reference', 'Date'], txRows)}`
  });
}

function farmAidPage({ roles, reports }) {
  const byRole = {};
  roles.forEach((r) => {
    if (!byRole[r.role_code]) byRole[r.role_code] = [];
    byRole[r.role_code].push(r);
  });

  const roleBlocks = ['clerk','verifier','aggregator','courier','registrar','commissioner','committee'].map((code) => {
    const list = byRole[code] || [];
    const rows = list.map((r) => [
      esc(r.name || r.user_id),
      esc(r.phone || ''),
      esc(r.compartment),
      esc(r.location_level),
      esc(r.location_name),
      esc(r.district || ''),
      r.active ? '<span class="pill ok">active</span>' : '<span class="pill new">inactive</span>'
    ]);
    return `<h3 style="text-transform:capitalize">${code}</h3>
      ${table(['Name', 'Phone', 'Compartment', 'Level', 'Location', 'District', 'State'], rows)}`;
  }).join('');

  const reportRows = reports.slice(0, 300).map((r) => {
    const loc = [r.ssaza, r.ssiga, r.mutuba, r.parish, r.village].filter(Boolean).join(' / ');
    const content = r.content && r.content.content ? r.content.content : JSON.stringify(r.content || '');
    return [
      esc(r.report_type.replace(/_/g, ' ')),
      esc(r.compartment),
      `<span class="muted">${esc(r.clan_name || '')}</span>`,
      esc(loc),
      `<span class="wrap">${esc(content)}</span>`,
      `<span class="pill ${r.status === 'cleared' ? 'ok' : r.status === 'disputed' ? 'warn' : 'new'}">${esc(r.status)}</span>`,
      fmtDate(r.submitted_at)
    ];
  });

  return layout({
    title: 'Farm Aid',
    active: '/admin/farmaid',
    body: `
      <h1>Farm Aid — field staff and reports</h1>
      <p class="sub">
        Two compartments: <strong>Busolya</strong> (lineage / clan) and <strong>Butaka</strong> (residents).
        Clerks and couriers cover Lunyiriri/village. Verifiers, aggregators at Mutuba/parish.
        Registrars at Ssiga/Ssaza. Commissioners at Mutuba/Ssaza. Committee receives registrar &amp; commissioner reports.
      </p>
      <div class="cards">
        <div class="card"><div class="n">${roles.length}</div><div class="l">Role assignments</div></div>
        <div class="card"><div class="n">${reports.length}</div><div class="l">Reports filed</div></div>
        <div class="card"><div class="n">${reports.filter((r) => r.status === 'pending').length}</div><div class="l">Pending review</div></div>
        <div class="card"><div class="n">${reports.filter((r) => r.status === 'disputed').length}</div><div class="l">Disputed</div></div>
      </div>

      <h2>Field staff by role</h2>
      ${roleBlocks}

      <h2>Reports</h2>
      ${table(['Type', 'Compartment', 'Clan', 'Location (Ssaza/Ssiga/Mutuba/Parish/Village)', 'Content', 'Status', 'Date'], reportRows)}

      <h2>Update report status</h2>
      <form class="panel grid2" method="post" action="/admin/farmaid/status">
        <label>Report ID<input name="report_id" type="number" required></label>
        <label>New status<select name="status">
          <option value="reviewed">Reviewed</option>
          <option value="cleared">Cleared</option>
          <option value="disputed">Disputed</option>
          <option value="pending">Pending</option>
        </select></label>
        <div style="grid-column:1/-1"><button class="btn" type="submit">Update</button></div>
      </form>`
  });
}

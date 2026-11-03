# Busolya network — websites and backend

One repo, no build step for the sites, one small Node service for the data.

| Part | Folder | Render service | URL |
|---|---|---|---|
| Busolya Agro Farmers Ltd | `sites/baf` | `busolya-agro-farmers` | https://busolya-agro-farmers.onrender.com |
| Bataka Agro Expo | `sites/bae` | `bataka-agro-expo` | https://bataka-agro-expo.onrender.com |
| Abataka Mutindo SACCO (hub) | `sites/mutindo` | `abataka-mutindo-sacco` | https://abataka-mutindo-sacco.onrender.com |
| API + admin | `server` | `busolya-api` | https://busolya-api.onrender.com |
| Postgres | — | `busolya-db` | internal only |

The sites are plain HTML, Tailwind (Play CDN) and vanilla JS. The backend is Express + Postgres, server-rendered admin, no front-end framework.

## Local preview

```powershell
python -m http.server 8765 --directory sites
```

http://localhost:8765/baf/, `/bae/`, `/mutindo/`. `assets/network.js` detects localhost and uses relative links between the three sites.

Backend locally (needs a Postgres URL in `DATABASE_URL`):

```powershell
cd server
npm install
$env:DATABASE_URL="postgres://..."
$env:ADMIN_PASSWORD="choose-one"
npm start
```

## What the backend holds

- **Demand log** — every visitor or buyer lead: what they need, volume, timing, payment route, consent, credit and guarantor details, free-text note.
- **Supply log** — every supplier or service-provider registration: capacity, price band, delivery range, terms, standards.
- **Suppliers register** — built automatically from supply-log entries.
- **Linkages** — exhibitor partnership requests: who they want to meet, the deal, volume, timeline.
- **Visitors** — one row per phone number, built from the demand log, with visit count.
- **Directory** — the yellow-pages register; entries stay hidden from the public API until verified.
- **Questionnaires** — 7 questions per audience (demand, supply, linkage), editable in the admin; the public page loads them live.
- **Education** — the nine expo subjects with outlines, plus room to add a tenth.
- **Governance** — the fixed clan and administrative layers (Olulyo → Ssiga → Mutuba → Enju; Ssaza → Gombolola → Muluka → Kya) and a register of units that starts empty on purpose.
- **Networks** — Busolya Biz Network and Bataka Trade Network with their operating models and member lists.
- **Messages** — contact-form messages from the three sites.

Each submission gets a reference (`BAE-D-0001`, `BAE-S-0001`, `BAE-L-0001`).

## Admin

`https://busolya-api.onrender.com/admin`

Sign in with `ADMIN_PASSWORD`, which Render generates on the service. Read it in Render → `busolya-api` → Environment. Change it there and the service restarts with the new password.

The admin has: overview counters, the three logs with search and status, visitor and supplier registers, directory verification, questionnaire editing, education subjects, governance layers and units, network members, messages, CSV exports and a full JSON backup (`/admin/export/backup.json`).

## API

Public, read-mostly, CORS open:

| Route | Purpose |
|---|---|
| `GET /api/health` | service and database status |
| `GET /api/questions/:kind` | active questionnaire for `demand`, `supply` or `linkage` |
| `POST /api/submissions` | one lead: `{ kind, respondent, answers, payload, credit, consent }` |
| `POST /api/contact` | website contact form |
| `GET /api/directory` | verified directory entries with `q` and `sector` filters |
| `GET /api/subjects` | active education subjects |
| `GET /api/networks` | networks with active member counts |
| `GET /api/governance` | layers and verified units |
| `GET /api/stats` | public counters |

The expo desk keeps writing to the browser first and posts to the API second, so a dead network never loses an entry.

## Deploy

`render.yaml` defines all five resources. Render reads it on every push to `main`; a blueprint sync creates anything new (the database and API were added after the first deploy). Free Postgres expires 30 days after creation — Render emails before then; export `backup.json` first, then recreate the database and redeploy.

Custom domains are added per service in Render → Settings → Custom Domains.

## Still to confirm

- Expo venue and gate times; official phone, email and office address for each organisation.
- The clan and governance register is empty until the clans and sub-counties confirm names.
- Blog is a pre-launch edition.

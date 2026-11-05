# Busolya Network — websites and backend

One repo, no build step for the sites, one Node/Postgres service for all data.

| Part | Folder | Render service | URL |
|---|---|---|---|
| Busolya Agro Farmers Ltd | `sites/baf` | `busolya-agro-farmers` | https://busolya-agro-farmers.onrender.com |
| Bataka Agro Expo | `sites/bae` | `bataka-agro-expo` | https://bataka-agro-expo.onrender.com |
| Abataka Mutindo SACCO | `sites/mutindo` | `abataka-mutindo-sacco` | https://abataka-mutindo-sacco.onrender.com |
| API + admin backend | `server` | `busolya-api` | https://busolya-api.onrender.com |
| PostgreSQL database | — | `busolya-db` | internal only |

Plain HTML + Tailwind (Play CDN) + vanilla JS on the front end. Express + PostgreSQL on the back end. No build step anywhere.

---

## Quick start (local)

```powershell
cd server
npm install
# create server/.env with your local credentials (see .env.example)
npm start
```

The server serves all three sites at:

- `http://localhost:10000/baf/`
- `http://localhost:10000/bae/`
- `http://localhost:10000/mutindo/`
- `http://localhost:10000/admin` (server-rendered backend)

`server/.env` template:

```
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/busolya
SESSION_SECRET=any-long-random-string
TEE_ENCRYPTION_KEY=another-long-random-string
ADMIN_PASSWORD=choose-one
NODE_ENV=development
PORT=10000
```

On first boot the server runs `schema.sql` (idempotent) and seeds all reference data automatically.

Local mode (`DATABASE_URL` unset or pointing at localhost) stores records in
`server/data/Data/*.jsonl`, encrypted with AES-256-GCM. `TEE_ENCRYPTION_KEY`
(falling back to `SESSION_SECRET`) derives that key: **keep it stable**. If it
changes, existing lines fail the integrity check, and the server refuses to
reseed those collections rather than overwrite data it cannot read. Recover by
restoring the previous key; only delete `server/data/Data` when the local data
is disposable.

---

## Architecture

### Two networks

| Network | Kind | What it does |
|---|---|---|
| **Busolya Biz Network** | Business | Membership, listing, matched demand. Verified once, listed in the yellow-pages directory, receives visitor request leads matching sector and district. Revenue: annual membership + directory placement + per-deal facilitation fee. |
| **Bataka Trade Network** | Trade | Aggregation and off-take. Farmers deliver to a collection point at a published grade and price; the network bulks, transports and contracts to buyers. Revenue: fixed handling fee per kilogram. |

### Two Farm Aid compartments

| Compartment | Meaning |
|---|---|
| **Busolya** | Lineage / clan establishment — tracks ownership and land agreements through the clan register. |
| **Butaka** | Residents establishment — tracks occupancy, labourers and produce through the village register. |

### BAF field staff roles

Each role has a minimum geographic coverage requirement:

| Role | Minimum coverage | Responsibilities |
|---|---|---|
| Clerk | One per Lunyiriri / village | Registers land owners and labourers; records at least one transaction per location. |
| Verifier | One per Mutuba / parish | Vets ownership documents; validates transactions and payments. |
| Aggregator | One per Mutuba / parish | Takes stock and inventory of all items received and produced. |
| Courier | One per Lunyiriri / village | Vets quality; transports items from one point to another. |
| Registrar | One per Ssiga / Ssaza | Clears payments; settles disputes. |
| Commissioner | One per Mutuba / Ssaza | Oversees stock and inventory across the network. |
| Committee | Selected by the Abobusolya | Receives registrar and commissioner reports; structured by clan location per Ssaza. |

---

## Bataka Agro Expo 2026 — full programme

**Venue:** Buganda, Uganda
**Dates:** Wednesday 4 November – Monday 8 November 2026
**Sessions per day:** Kumakya (08:00–11:00), Tuntu (11:00–13:00), Kawungezi (afternoon)

### Day 1 — Wednesday 4 November 2026

#### Kumakya (08:00–11:00)
**Enkoko — entandika yaazo**
*Poultry — starting from scratch*
What you must know and what you must avoid. The foundational session on poultry rearing: breed selection, housing, feed sourcing, vaccination schedules, common diseases and the records a poultry farmer must keep from day one.

#### Tuntu (11:00–13:00)
**Ennunda n'endlisa y'ente ereeta amagoba**
*Cattle husbandry and feeding that returns a profit*
How to select a breed for your land and market, how to calculate feed costs against milk or beef prices, how to read a cattle record and when to cull.

#### Kawungezi (afternoon)
**Ennima n'enkozesa ya muwogo avaamu emmere y'ebisolo**
*Cassava farming and how cassava by-products become animal feed*
Cassava as a dual-purpose crop: food and feed. Planting material selection, mosaic disease management, harvesting to safe moisture, and turning cassava peels into cost-effective feed rations.

---

### Day 2 — Thursday 5 November 2026

#### Kumakya (08:00–11:00)
**Okulundira ebyenyanja mu bidiba**
*Fish farming in ponds*
Pond construction and lining, stocking rates, feeding regimes, water quality management, harvesting logistics and the economics of a small-scale fish farm.

#### Tuntu (11:00–13:00)
**Obutale n'omutindo**
*Quality and value*
**Presenter: Robert Mawanda**

Two themes:
1. Five core qualities every serious business must build — the foundations that apply to every sector at this expo.
2. The price of your product or service is set by its perceived value; how to communicate that value to a buyer.

#### Kawungezi (afternoon)
**Okugereka emiwendo gyo olwo okukola amagoba — Okuzuula engeri esingayo obulungi ey'okubunyisa eky'amaguzi kyo**
*Pricing your product to make a profit — finding the best way to sell what you produce*
**Presenter: PSFU (Private Sector Foundation Uganda) — Marketing unit**
From cost-of-production to shelf price. How to find buyers, negotiate terms, and keep a customer after the first order.

---

### Day 3 — Friday 6 November 2026

#### Kumakya (08:00–11:00)
**Ennunda y'ebyebyanjanja etunisa amagoba**
*Profitable horticulture production*
**Presenters: Dr Emma Naluyima / Mugisha Bright**
High-value vegetable and fruit production: variety selection, soil preparation, irrigation, integrated pest management, post-harvest handling and market linkage.

#### Tuntu (11:00–13:00)
**Okutandika abibukiriro obutono 100 — omuvubuka bwayinza okutandika n'essente entono**
*Starting 100 seedlings in a nursery — how a young person can start with very little money*
**Presenter: Fahad Kayondo — Telesat**
A practical nursery business model. Species selection for the local market, germination techniques, tray management, pricing, and how to scale from 100 to 10,000 seedlings without taking on debt.

#### Kawungezi (afternoon)
**Enkozesa ya ssente okuzifunamu amagoba n'okuzikuuma**
*Using money to make more money and how to keep it*
**Presenter: Newton Buteraba**
Personal financial management for farmers and small business owners: separating the farm account from the household, building a savings habit, understanding interest, and preparing a simple business case for a credit facility.

---

### Day 4 — Saturday 7 November 2026

#### Kumakya (08:00–11:00)
**Obulunzi bw'ente — endabirira n'endlisa**
*Cattle management — care and feeding*
**Presenter: Dr Herbert Mukiibi — Makerere University**

Also covers:
- Managing insects and pests using Black Soldier Fly (BSF) and other biological methods.
- Producing animal feed from organic waste.
- Reducing input costs through on-farm waste conversion.

#### Tuntu (11:00–13:00)
**Obwegassi (cooperatives) — enkola esitula omuntu wawansi**
*Cooperatives — the structure that lifts the person at the bottom*
**Presenter: Ssentumbwe Daniel**

Followed by:
**Obutale okuva mu bwegassi**
*Quality from cooperatives*
**Presenter: Mufabaazi Godfrey**

How a cooperative sets and enforces a grade standard, captures the premium that individual members cannot, and negotiates with buyers from a position of collective volume.

#### Kawungezi (afternoon)
**Okwegema obukosefu obuva mu nkyukakyuka y'embeera y'obudde**
*Adapting to the effects of climate change*
**Presenter: Makerere University team**

Three practical responses:
1. Intercropping and using biochar as a soil conditioner.
2. Growing hay that matures in 7 days (fast-cycle fodder production).
3. Soil moisture management under unpredictable rainfall.

---

### Day 5 — Sunday 8 November 2026

#### Kumakya (08:00–11:00)
**Ennima y'ebitooke n'olusuku eneluwangaaza n'ofunamu amagoba**
*Profitable banana and mixed garden production*
**Presenters: Arthur Musoke / Peter Semuwera (farmer)**
Mat management, banana weevil and wilt control, kitchen garden integration, organic nutrient cycling, and how to price a mixed-garden harvest.

#### Tuntu (11:00–13:00)
**Ennima ey'okulukitira ng'okozesa obuuma n'enkola eya ssente entonotono**
*Micro-irrigated farming using appropriate technology and small capital*
**Presenter: Gorreth Semmando — Prime Power**
Low-cost drip and gravity-fed irrigation systems, solar pump options, row spacing for irrigated beds, and the economics of a quarter-acre irrigated plot.

#### Kawungezi (afternoon)
**Ennima ewangaaza wamu n'endabirira y'emmwanyi ssekabalila** and **Okulima emiti egyettunzi nga bizinaasi**
*Profitable arabica coffee production and management* | *Growing trees as a business*
**Presenters: Bulamu Coffee / Acram Mawejje**

Coffee: stumping schedules, shade management, drying, and how to qualify for Bulamu's collection programme.
Trees: species selection for timber, fruit and charcoal; intercropping with food crops; the 7–10 year exit calculation.

---

### Day 6 — Monday 9 November 2026

#### Kumakya (08:00–11:00)
**Endabirira y'enkoko okuva ku lunaku olumu okutuuka ku katale — endlisa y'enkoko ekekkereza ate n'ofuna amagoba**
*Poultry management from day one to market — feed efficiency and profitable returns*
**Presenter: Dr Vincent Kizito**
The economics of a 500-bird cycle: day-old chick sourcing, feed conversion ratios, disease protocols, processing options and calculating break-even vs profit.

#### Tuntu (11:00–13:00)
**Okukazesa ttalanta n'okwesitula n'ogituula omulimu**
*Discovering your talent, building yourself and creating work*
**Presenter: Abby Mukiibi — CBS | Simon Ssenkaayi**
Career and entrepreneurship session — identifying a marketable skill, building a personal brand, and turning an informal activity into a registered income source.

#### Kawungezi (afternoon)
**Okukozesa amasannyalaze g'obusa bw'ebisolo n'okukkekkereza ate nga bwalimisa ekigimusa eky'obutonde bw'ensi**
*Using biogas from animal waste, reducing costs and restoring soil health*
**Presenter: Florence Kintu — Biogas Solutions Uganda Ltd**
Biogas digester sizing for a smallholder, slurry management, replacing LPG and firewood, and how digester effluent rebuilds soil organic matter faster than raw manure.

---

## Education subjects and topics

Nine subjects are taught at the expo and continue through the outreach programme. Farm Aid (Subject 01) is the anchor.

| # | Subject | Level | Summary |
|---|---|---|---|
| 01 | Farm Aid: managing a farm | Foundation | Selecting and preparing a manager; husbandry, planning, labour and supervision. |
| 02 | Farm accountancy | Foundation | Daily input and labour book, stock book, season summary, reading the numbers back to the SACCO. |
| 03 | Abasolya, Bataka and clan layers | Foundation | Ekika to enju; councils; the Katikkiro at each layer; what allegiance carries. |
| 04 | Land, tenure and dues | Foundation | Mailo, kibanja, busuulu; what belongs in a written agreement; where a dispute goes first. |
| 05 | Credit, savings and guarantors | Foundation | How a SACCO reads a member; what a guarantor signs; recovery without breaking the clan. |
| 06 | Agronomy clinic | Practical | Cassava, banana, coffee, maize — planting material, spacing, pests, season decisions. |
| 07 | Livestock and poultry | Practical | Feeds, housing, vaccination calendar, breeding records and culling. |
| 08 | Post-harvest and standards | Practical | Drying, storage, grading, packaging, certification costs and returns. |
| 09 | Digital and market access | Practical | Being listed in the directory, answering a demand lead, WhatsApp selling, keeping a buyer. |

### Farm Aid topics (Subject 01 — 8 topics with English notes and Luganda presentations)

| Code | Topic | Level |
|---|---|---|
| fa-01 | Land registration and ownership | Foundation |
| fa-02 | Clerk duties and land records | Practical |
| fa-03 | Verifier duties and ownership vetting | Practical |
| fa-04 | Aggregator duties and stock inventory | Practical |
| fa-05 | Courier duties and quality transport | Practical |
| fa-06 | Registrar duties and payment clearing | Practical |
| fa-07 | Commissioner for stock and inventory | Practical |
| fa-08 | Committee and clan reports | Foundation |

Notes are in English. Presentations are in Luganda. Sharing or printing a note costs UGX 5,000 per paid-up user.

---

## What the backend holds

| Table | What it stores |
|---|---|
| `submissions` | Every demand, supply and linkage lead (ref BAE-D-XXXX / BAE-S-XXXX / BAE-L-XXXX) |
| `visitors` | One row per phone number, deduped, with visit count |
| `suppliers` | Every supplier registration; also created from supply submissions |
| `supplier_products` | Products and services added by suppliers via the portal |
| `visitor_requests_stock` | Links between supplier products and visitor request submissions |
| `directory_entries` | Yellow-pages register; hidden until verified by admin |
| `supplier_directory_link` | Links a registered supplier user to their directory entry |
| `questions` | Configurable questionnaires per audience (demand / supply / linkage) |
| `subjects` | Nine education subjects with outlines |
| `education_topics` | Topics under each subject |
| `education_notes` | Full notes per topic (English), with price (UGX 5,000 per share) |
| `education_presentations` | Luganda presentations per topic (slides JSON) |
| `education_shares` | Log of paid note shares per user (idempotent — one per user per note) |
| `education_sessions` | Scheduled teaching sessions attached to subjects |
| `governance_layers` | Fixed clan and admin layers (Olulyo → Ssiga → Mutuba → Enju; Ssaza → Gombolola → Muluka → Kya) |
| `governance_units` | Register of actual units; starts empty; verified before publishing |
| `networks` | Busolya Biz Network and Bataka Trade Network with operating models |
| `members` | Network member organisations |
| `contacts` | Contact-form messages from all three sites |
| `participants` | All registered users (supplier / member / employee / customer / admin) — the live auth table |
| `user_sessions` | Token-based sessions (reserved for future use) |
| `sacco_members` | SACCO member registry with member numbers (AMS-YYYY-NNNN), shares, savings |
| `sacco_transactions` | Full transaction log: deposit, withdrawal, payout, credit, repayment, share purchase |
| `sacco_creditors` | External creditor records per member |
| `sacco_guarantors` | Guarantor cross-references between SACCO members |
| `farm_aid_roles` | BAF field staff role assignments with compartment, level and location |
| `farm_aid_reports` | Field reports by type (land register, transaction, inventory, payment, dispute, verification, quality) |
| `settings` | Key-value store for system settings and register notes |

---

## Portals and access

| URL | Who uses it | Auth |
|---|---|---|
| `/baf/`, `/bae/`, `/mutindo/` | Any visitor — browse freely | None for browsing |
| `*/login.html` | Members, customers, employees | Phone or email + password |
| `*/supplier-login.html` | Suppliers | Phone or email + password |
| `*/supplier-portal.html` | Suppliers — manage listings | Supplier role required |
| `*/admin.html` | BAF employees and admin | Employee / admin role required |
| `/admin` | Server-rendered admin backend | ADMIN_PASSWORD |

---

## API reference

All public endpoints are CORS-open. Auth-protected endpoints require the `bsl_supplier` cookie (set on login).

### Public (no auth)

| Route | Purpose |
|---|---|
| `GET /api/health` | Service and database status |
| `GET /api/questions/:kind` | Active questionnaire: `demand`, `supply`, `linkage` |
| `POST /api/submissions` | Submit a lead: `{ kind, respondent, answers, payload, credit, consent }` |
| `POST /api/contact` | Contact form message |
| `GET /api/directory` | Verified directory entries — filters: `q`, `sector` |
| `GET /api/subjects` | Active education subjects |
| `GET /api/education/topics` | All education topics with subject titles |
| `GET /api/education/notes` | Notes — filters: `topic_id`, `locale` (en / lug) |
| `GET /api/education/presentations` | Presentations — filters: `topic_id`, `locale` |
| `GET /api/networks` | Networks with active member counts |
| `GET /api/governance` | Layers and verified governance units |
| `GET /api/stats` | Public counters |
| `GET /api/suppliers/products` | All available supplier product listings |
| `GET /api/farm-aid/roles` | Farm Aid role assignments |
| `POST /api/auth/register` | Register a user (idempotent by phone; supplier auto-adds to directory) |
| `POST /api/auth/login` | Login with `{ login_id, password }` — login_id is phone or email |
| `POST /api/auth/logout` | Clear session cookie |
| `GET /api/auth/me` | Current session info |
| `POST /api/sacco/quick-register` | Quick SACCO membership (creates participant + member in one call) |

### Auth-protected (requires login)

| Route | Role | Purpose |
|---|---|---|
| `GET /api/users` | admin / employee | List participants with optional `role` filter |
| `POST /api/users` | admin / employee | Create a participant (quick counter registration) |
| `POST /api/suppliers/products` | supplier | Add a product / service listing |
| `PATCH /api/suppliers/products/:id` | supplier | Update own listing |
| `DELETE /api/suppliers/products/:id` | supplier | Remove own listing |
| `POST /api/education/notes` | admin / employee | Add a note |
| `POST /api/education/presentations` | admin / employee | Add a presentation |
| `POST /api/education/shares` | any signed-in user | Share / print a note (UGX 5,000, idempotent) |
| `POST /api/visitor-requests/stock` | admin / employee | Link a product to a visitor request submission |
| `GET /api/sacco/members` | admin / employee | SACCO member list |
| `POST /api/sacco/members` | admin / employee | Add a member manually |
| `GET /api/sacco/transactions` | admin / employee | Transaction log |
| `POST /api/sacco/transactions` | admin / employee | Post a transaction |
| `GET /api/farm-aid/reports` | any signed-in user | Field reports |
| `POST /api/farm-aid/reports` | any signed-in user | Submit a field report |

### Server-rendered admin (ADMIN_PASSWORD)

| Route | Purpose |
|---|---|
| `GET /admin` | Overview dashboard with counts and recent captures |
| `GET /admin/submissions` | Demand / supply / linkage logs with search and status filter |
| `GET /admin/visitors` | Visitor register |
| `GET /admin/suppliers` | Supplier register |
| `GET /admin/directory` | Directory management and verification |
| `GET /admin/questions` | Questionnaire editor |
| `GET /admin/subjects` | Education subjects, topics, notes and presentations |
| `GET /admin/governance` | Clan layers and unit register |
| `GET /admin/networks` | Networks and member management |
| `GET /admin/contacts` | Contact-form messages |
| `GET /admin/sacco` | SACCO member registry, transactions, quick registration |
| `GET /admin/farmaid` | Farm Aid roles and field reports with status management |
| `GET /admin/export/submissions.csv` | CSV export |
| `GET /admin/export/visitors.csv` | CSV export |
| `GET /admin/export/suppliers.csv` | CSV export |
| `GET /admin/export/directory.csv` | CSV export |
| `GET /admin/export/backup.json` | Full JSON backup of all tables |

---

## Distributables — social and print media

These are the items to be produced for distribution at the expo and through social media channels before and during the event.

### Print distributables

| Item | Content | Format | Audience |
|---|---|---|---|
| **Expo programme card** | Six-day schedule with session titles (Luganda), presenters and times | A5 double-sided, 1,000 copies | Gate, information desk, exhibitor stands |
| **Visitor request form** | Objective form: visitor name, phone, district, what they need, quantity, timing, payment route, credit needed (yes/no) | A4 single-sided, carbon-copy pad of 200 | Information desk and exhibitor marshals |
| **Supply log form** | Exhibitor registration: business name, contact, district, category, what they supply, capacity, price band, listing opt-in | A4 single-sided | Exhibitor registration desk |
| **QR card** | QR code linking to `bae/visit.html` (visitor requests), `bae/questions.html` (supply form) | Business card size, 2,000 copies | Gate, information desk, all exhibitor stands |
| **Business directory insert** | Current verified listings from the Busolya Biz Network directory | A5 booklet, 500 copies | Information desk, SACCO desk |
| **Farm Aid one-pager** | What Farm Aid is, how to offer land, how to become a manager, the 17× recoupment model, contact | A4 single-sided, 500 copies | All stands, gate |
| **SACCO membership card** | Member number, name, join date, space for savings record stamps | Credit card size | SACCO desk on registration |
| **Education subject cards** | One card per subject (9 cards): title in Luganda, summary, what the session covers | A6 card, 500 sets | Teaching area, gate |

### Social media distributables

| Item | Content | Platform | Timing |
|---|---|---|---|
| **Daily session announcement** | Session title (Luganda + English), presenter name, time and day | WhatsApp broadcast, Facebook | Morning of each expo day |
| **Presenter profile posts** | Photo, name, institution, one-line bio, what they will teach | Facebook, Instagram | One per day, day before each presenter's session |
| **QR code graphic** | QR to visitor requests form with short caption: *"Log your order at the expo"* | WhatsApp broadcast, Facebook | Daily during expo |
| **Visitor request call-to-action** | *"What did you come to buy? Fill in the form and a supplier will call you."* | WhatsApp, SMS broadcast | Day 1 morning, Day 3 morning |
| **Supplier registration call-to-action** | *"Register your business now. Be found. Be matched."* with link to `baf/supplier-login.html` | WhatsApp, Facebook | One week before expo, Day 1 |
| **Farm Aid call-to-action** | *"Do you have dormant land? We put it to work."* with link to `baf/programs.html#farmaid` | WhatsApp, Facebook | Day 3, Day 5 |
| **SACCO membership call-to-action** | *"Join at the expo desk or register online in 2 minutes."* with link to `mutindo/index.html#membership` | WhatsApp broadcast | Day 2, Day 4 |
| **Session recap posts** | Key takeaway from each session (3–5 bullet points in Luganda) | WhatsApp broadcast, Facebook | Evening of each expo day |
| **Directory listing promotion** | *"Is your business listed?"* with screenshot of live directory | Facebook | Two weeks before expo |
| **Post-expo thank you** | Attendance numbers, leads captured, suppliers registered, next steps | All platforms | Day after expo closes |

---

## Deployment

`render.yaml` defines all five resources. Push to the connected branch and Render redeploys services whose files changed. The database only exists on Render's internal network — the API service connects using the internal hostname.

**Environment variables (set in Render dashboard, not in the repo):**

| Variable | Source |
|---|---|
| `DATABASE_URL` | Auto-set by Render from the database |
| `SESSION_SECRET` | Auto-generated by Render (`generateValue: true`) |
| `ADMIN_PASSWORD` | Auto-generated by Render — read it in Render → `busolya-api` → Environment |
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `20` |

Free Postgres expires 90 days after creation. Export `/admin/export/backup.json` before then, recreate the database and redeploy.

### Checking what is deployed

Render does not show the live commit on the public site, so check it two ways.

**In the dashboard:** open the service, and read the deploy row at the top of the
page (status plus short commit), or open the **Deploys** tab, which lists every
deploy with its commit message and time. The site being reachable says nothing
about which build it is running.

**From the command line:** `scripts/deploy-status.js` compares each service's
live deploy with `origin/main` and prints `OK`, `BEHIND`, `MISSING`, or the
status of a build still running:

```powershell
$env:RENDER_API_KEY = 'rnd_...'     # Render -> Account Settings -> API Keys
node scripts/deploy-status.js
```

The key is read from the environment only; nothing is written to disk. Exit code
is `0` when all four services are on the branch tip and `1` otherwise, so the
same script can gate a release check. A service that is connected, healthy and
serving traffic can still be several commits behind — that is the `BEHIND` row.

Custom domains: Render → Settings → Custom Domains (per service).

### Troubleshooting: "site can't be reached" on `*.onrender.com`

A local network whose DNS blocks or fails to forward `onrender.com` returns
`NXDOMAIN` for every service name, which looks exactly like a deployment outage.
Check before redeploying:

```powershell
nslookup busolya-api.onrender.com 1.1.1.1     # should return 216.24.57.16
curl.exe -sS https://busolya-api.onrender.com/api/health
```

If public DNS resolves but the default resolver does not, the client or its
router is returning NXDOMAIN — set the device or router DNS to `1.1.1.1` and
`8.8.8.8`. The first request after idle can take 20–50 s on Render's free plan
while the service cold-starts.

---

## Still to confirm

- Expo venue address, gate times and stand fees.
- Official phone, email and office address for each organisation.
- Clan and governance register — spellings, totems and heads must be confirmed with clan elders before the print edition.
- SACCO membership requirements, share value, dividend rate and interest rate.
- Farm Aid agreement template and the exact recoupment / share formula.
- Presenter confirmations and bios for the social media posts.

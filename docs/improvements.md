# Busolya Network — Improvement Audit

Generated from a full read of `server/`, `sites/baf/`, `sites/bae/`, `sites/mutindo/`, and `sites/shared/`.
FEAT-004 applied bouncy-button transforms, glassmorphism gradients, skeleton shimmers on `product.html`, and responsive media/grid rules.
Items below are **not** addressed by FEAT-004 and remain open.

---

## 1. Visual / UX

### 1.1 Animation depth

- **Bounce spring is global and indiscriminate** — every `button`, `a[class*="rounded"]` and `input[type="submit"]` on each page gets `scale(1.05)` on hover, including table-cell action buttons and small filter pills. This makes destructive actions (e.g. "Remove listing", "Hide this comment") feel playful when they should feel deliberate.
  - File: `sites/baf/supplier-portal.html` ~L60–L70, same block duplicated verbatim in every portal and admin page (~10 files).
- **No `reduce-motion` media query guard.** The spring transform and `shimmer` keyframe animation on `product.html` will play even for users who prefer reduced motion (WCAG 2.3 Animated content).
  - Files: `sites/bae/product.html` ~L40 (`.skeleton` / `@keyframes shimmer`), FEAT-004 block in every HTML file.
- **No entrance animations** on data cards, stat rows, or tab panels. A subtle `opacity 0→1 + translateY` on mount would add the depth the user asked for without relying only on hover transforms.

### 1.2 Typography scale

- Body text sits at the browser default `text-sm` (14 px) or `text-xs` for secondary copy throughout all portals. On a tablet or desktop this feels cramped.
- No fluid `clamp()` scale for body copy — only heading sizes (`h1`, `h2`) are clamped in the FEAT-004 block. Secondary copy (`p.text-sm`, `.text-xs`, table cells) is fixed-size.
- `font-display` (Georgia/Times) is used only for headings. Sub-headings inside cards and in the `admin.js` server-rendered UI use `system-ui` but receive no size differentiation, making hierarchy hard to scan.
- Missing letter-spacing on large metric/stat numbers (e.g. "UGX 1,234,567" in the SACCO portal) — these benefit from `tracking-tight` to read as a number rather than characters.

### 1.3 Iconography consistency

- Emoji are used as icons in `stall.html` (🆓, 📍, 📞, 🎟), `product.html` (🌱 placeholder, 🎵, 🎬, 📄), and `farm-aid-portal.html`, but no other pages use icons at all. The result is inconsistent density.
- No SVG icon set has been adopted. The `assets/mark.svg` logo is used as favicon only. Buttons like "+ Photo", "Remove", "Submit report", and "Sign out" have no accompanying icon — adding even a single character ruins consistency.
- The `admin.js` server-rendered admin uses plain text labels for status pills (`new`, `contacted`, `matched`) without colour-coded icons. On monochrome printouts these are invisible.

### 1.4 Colour accessibility / contrast ratios

- `text-ink/45` (`color: rgba(42,26,16,0.45)`) used widely on stat-card labels. Against `bg-paper (#fffdf8)` the luminance ratio is approximately 3.5:1 — below the WCAG AA threshold of 4.5:1 for normal text.
  - Files: all portal pages — e.g. `sites/bae/exhibitor-portal.html` ~L128, `sites/mutindo/member-portal.html` ~L64.
- `text-ink/40` on secondary metadata in product cards (`sites/bae/stall.html` ~L195, `product.html` ~L350) is approximately 3:1 — fails both AA and AAA.
- `text-ink/50` on placeholder/empty-state text fails AA at 3.5:1.
- The `--leaf: #2f7d32` on white (`#ffffff`) passes AA (5.8:1) ✓, but `--gold: #c68a2e` on white is approximately 2.9:1 — fails for text (used on stall price headers and `<span class="text-gold">`).
  - File: `sites/bae/stall.html` ~L79 (stat price badge).
- The server-rendered `admin.js` style block uses hardcoded `color:#7a6857` on `var(--cream)` (#f7f1e6); ratio ≈ 3.2:1 — fails AA.
  - File: `server/admin.js` ~L31 (`.card .l`, `.muted`, `dt`).

### 1.5 Loading skeletons

- Skeletons are implemented only on `sites/bae/product.html` (FEAT-004). Every other page that loads data (portals, public stall, exhibitors list, admin dashboards) shows a blank container or a raw "Loading…" text string while data fetches. Recommended pages to add skeleton states:
  - `sites/baf/supplier-portal.html` — `#productList` empty render (~L207)
  - `sites/bae/exhibitor-portal.html` — `#productList` (~L207)
  - `sites/mutindo/member-portal.html` — `#txList` (~L160), stat row (~L64)
  - `sites/bae/stall.html` — `#productList` (~L89)
  - All three admin portals — tab panels render blank on load

### 1.6 Empty states

- `#noProducts`, `#noMedia`, `#noDemand`, `#noTx`, `#noGuar`, `#faNoReports`, and similar elements are plain text strings without illustration, icon, or a direct CTA. For first-time users these are dead ends.
  - Recommended: add an illustrative icon (or simple SVG pattern), a one-sentence explanation, and a button that takes the user to the relevant action (e.g. "Add your first listing" pointing to `data-tab="add"`).
- The server-rendered admin (`admin.js`) returns `<td colspan="N" class="muted">Nothing yet.</td>` for all empty tables — no action affordance.
  - File: `server/admin.js` ~L113 (`table()` function).

---

## 2. Logical Flow per Role

### 2.1 BAF supplier (sites/baf/supplier-portal.html)

- **Auth guard redirects to `supplier-login.html`** but the role check only blocks `role === 'customer'`. Any `member` or `employee` landing here will see the full portal including product management — the check should be `role !== 'supplier'` unless employees are intentionally allowed. (~L390)
- **Tab `purchases` and `inventory` and `alerts` exist in HTML** but are not wired in the tab list — their `<button>` elements are absent. The tabs cannot be reached unless the URL fragment is manually typed. A user who successfully adds a product cannot discover purchase orders or inventory summary.
  - File: `sites/baf/supplier-portal.html` ~L161 (tabs `div`).
- **Stat `#statDemand`** reads "Visitor request leads" and is populated from the demand leads list, but the counter is never set in the JS — `loadProducts()` sets `statListings` and `statMedia` but `statDemand` is only updated if `loadVisitorRequests()` is called; that function is only called on tab activation, so the stat shows "—" on page load.
  - File: `sites/baf/supplier-portal.html` ~L472.
- **`#statDir` (Directory) stat** is never populated. There is no call to fetch the directory entry count.
- **Moderation tab**: filter buttons (`spModVisible`, `spModHidden`, `spModAll`) exist in HTML but no JS is wired to them — clicking them does nothing.
  - File: `sites/baf/supplier-portal.html` ~L273–L279.
- **No confirmation or success redirect after sign-out** — logout calls `BusolyaAuth.logout()` which redirects to `index.html`. For a supplier this drops them on the BAF marketing homepage; a better UX would redirect to `supplier-login.html` with a "You have been signed out" notice.
- **Missing feedback on network error** — `loadProducts()` has a `.catch` that only logs to console. The user sees a frozen "—" stat and empty list with no error message. Same pattern in `loadVisitorRequests()`, `loadMedia()`.

### 2.2 BAE exhibitor (sites/bae/exhibitor-portal.html)

- **Category select** on the "Add listing" form uses a hardcoded `<select>` list (`Mining & Minerals`, `Organic Produce`, etc.) while the BAF version uses a free-text `<input>`. Inconsistency means BAF products and BAE products cannot be cross-filtered by category unless values happen to match.
  - File: `sites/bae/exhibitor-portal.html` ~L88.
- **`#productPills` element** is referenced in `renderProducts()` but the element does not exist in the HTML (there is no `<div id="productPills">`). The category-pill filter code silently fails.
  - File: `sites/bae/exhibitor-portal.html` ~L284.
- **`data-tab="moderation"` tab** is present and the JS handles `loadModeration()` when activated, but `loadModeration` is never defined in the script — calling it throws `ReferenceError`.
  - File: `sites/bae/exhibitor-portal.html` ~L230 (tab click handler).
- **"View my stall" button** constructs a URL with `?biz=<name>&ex=<name>` but `stall.html` resolves the exhibitor name from those query parameters; if the user has an unsaved display name the stall shows the wrong name until a hard refresh.
- **Demand tab label** says "Demand for my products" — the loaded data is ALL demand submissions, not filtered by the exhibitor's products. The API call at `loadDemand()` hits `/api/submissions?kind=demand` without a `supplier_id` filter.

### 2.3 BAE stall & product (public — sites/bae/stall.html, product.html)

- **`stall.html` product image** loads each product's primary media by calling `/api/products/<id>/media` individually inside the `products.forEach` loop — one HTTP request per product card. With 20 products this means 20+1 serial fetches on page load (N+1 pattern).
  - File: `sites/bae/stall.html` ~L260.
- **`product.html` "More from stall"** also calls `/api/products/<id>/media` for each product in `loadMoreFromStall()` — another N+1 loop.
  - File: `sites/bae/product.html` ~L455.
- **Emoji reaction handler** in `stall.html` references a variable `b` inside a `btn` click handler; `b` is undefined in that scope — it is an unreferenced variable from the outer `stallModBtn` handler. The reaction POST will always throw `ReferenceError: b is not defined`.
  - File: `sites/bae/stall.html` ~L356 (emoji handler closure).
- **`scrollProducts()`** is called by the navigation arrows in `stall.html` (~L97) but the function is not defined anywhere in the file — clicking the arrows throws `ReferenceError`.
- **Stall name in breadcrumb** is taken from the query string `?biz=` parameter without sanitisation. A crafted URL can inject arbitrary text into the DOM via `document.getElementById('stallName').textContent` — this is safe from XSS (textContent, not innerHTML) but confusing/spoofable.
- **Product request form on stall.html** has no `novalidate` attribute and relies on the browser native required-field validation for name and phone, but the `d-phone` field has no `type="tel"` pattern — "abc" passes validation.

### 2.4 SACCO member (sites/mutindo/member-portal.html)

- **Balance calculation** is `shares + savings`, performed client-side from the session cookie data (`me.shares + me.savings`). The server is not queried for a live balance; if an admin posts a transaction between sessions the stat row shows stale data until the user logs out and back in.
  - File: `sites/mutindo/member-portal.html` ~L165.
- **Deposit/withdraw forms submit without** a confirmation step or a balance-check for withdrawals. A member can submit a withdrawal for any amount regardless of their actual savings balance — the server accepts it silently.
  - File: `sites/mutindo/member-portal.html` ~L194, ~L212.
- **Transaction history** loads all transactions for the authenticated member from `/api/sacco/transactions`, but the list is rendered in flat `div`s with no pagination. A member with many transactions gets one infinite list.
- **Guarantors tab** filters the full guarantee list client-side: it calls `/api/sacco/guarantors` (returns ALL guarantors) and then filters by `me.id`. This leaks other members' guarantee data to the client.
  - File: `sites/mutindo/member-portal.html` ~L230.
- **`loadMember()` does not fetch from the server** — it reads the session storage user object. If the member's status changes to "suspended" they are never informed until re-login.
- **Tab class toggle** uses `classList.remove('tab-on')` / `classList.add('tab-off')` but on initial render the active tab button already has class `tab-on` set as an HTML attribute without `tab-off` being set. Toggling may produce both classes simultaneously on other tabs.
  - File: `sites/mutindo/member-portal.html` ~L145.

### 2.5 SACCO guarantor (sites/mutindo/guarantor-portal.html)

- **No auth role check** — the page only checks `BusolyaAuth.isAuthenticated()`. A `supplier` or `customer` account that lands here will see an empty guarantor list instead of an appropriate "access denied" message.
  - File: `sites/mutindo/guarantor-portal.html` ~L98.
- **`?guarantor_id=<id>` filter** is appended to the API call, but the server endpoint `/api/sacco/guarantors` does not document or enforce this filter as an authenticated guard — a logged-in user could change the query parameter and view another member's guarantees.
- **Share buttons** expose the user's internal `me.id` in the share URL (e.g. `?guarantor=42`). This may not be intended as a public-facing identifier.
- **Stats row** (`statActive`, `statReleased`, `statTotal`, `statMembers`) is only populated after the async load resolves. If the fetch is slow the stat cards show "—" indefinitely with no loading indicator.

### 2.6 SACCO Farm-Aid portal (sites/mutindo/farm-aid-portal.html)

- **`<body>` tag appears twice** — there is a `<body class="bg-sand ...">` tag at line ~L87 that opens after a `</main></body>` sequence from the preceding partial. The HTML structure is broken: `<main>`, `<div id="header-placeholder">`, and a second `<body>` appear in the wrong order.
  - File: `sites/mutindo/farm-aid-portal.html` ~L83–L90.
- **Header / nav missing** — `<div id="header-placeholder">` is in the wrong `<body>`. The components.js injection will try to inject into the first placeholder it finds, which is inside a broken DOM tree.
- **`faReportForm` `content` field is a free text `<textarea>`** but the database schema stores `content` as `jsonb` (`farm_aid_reports.content jsonb`). The server will receive a plain string and wrap it in a JSON object — or may fail with a cast error depending on the db driver path. There is no UI indication that structured data (key/value pairs) is expected.
  - File: `server/schema.sql` ~L380 (`content jsonb`).
- **Role stats** (`statRole`, `statCompartment`, `statLocation`) are populated only if the user has a `farm_aid_roles` entry. There is no message for users who have no role assigned — the stats just stay "—".
- **No mechanism to request a Farm-Aid role** from the portal; the user must contact an admin out-of-band.

### 2.7 BAF admin (sites/baf/admin.html)

- **`sUsers` counter is overwritten** — `loadStats()` sets `sUsers` to the user list length, then immediately overwrites it with the SACCO member count in the second `.then()`. The final displayed value is always the SACCO count, not the actual user count.
  - File: `sites/baf/admin.html` ~L300–L310.
- **SACCO tab in BAF admin** displays SACCO data (members, shares, savings) and allows SACCO registrations. But Mutindo SACCO is a separate entity from BAF — an admin of BAF should not routinely manage SACCO members. There is no per-site scope guard on the API; any BAF admin can post SACCO transactions for any member.
- **`tab-farmaid` Farm Aid section** shows "BAF field roles" but calls `/api/farm-aid/roles` and `/api/farm-aid/reports` without a site filter — it shows all Farm-Aid data network-wide, not just BAF-scoped.
- **`tab-products`** loads all supplier listings via `/api/suppliers/products` (no pagination, no site filter). In production with hundreds of listings this will render a very long table with no way to search or paginate.
- **Education tab** renders subjects/topics/notes as a read-only flat list. There is no add/edit/retire control in the site admin (these are only in the server admin at `/admin/subjects`).
- **`tab-content` (Site faucets)** form is built by `loadFaucets()` which calls `/api/faucets` and dynamically generates label/input pairs. If the API returns an error the form is empty with no error message.
- **No confirmation before destructive user actions** (role change, etc.).

### 2.8 BAE admin (sites/bae/admin.html)

- **Identical `sUsers` overwrite bug** as BAF admin (~L300).
- **"BAF field roles"** heading appears in the Farm Aid tab — this is copied from BAF and mislabelled; BAE admin should say "BAE field roles" or the tab should be reconsidered for relevance to an expo admin.
  - File: `sites/bae/admin.html` ~L222.
- **Visitors, suppliers, contacts, directory, questions, subjects, governance, networks tabs** all present but load without pagination — potentially unbounded table rows. `limit 500` is applied at the API level but not communicated to the UI.
- **Comment moderation tab** is present; however there are no API calls wired to populate `#modList`. The `loadModeration()` function is expected but must be verified in the script continuation.
- **BAE admin tabs** are far more numerous (15 tabs) than BAF or Mutindo (7 tabs each). The tab strip wraps across multiple lines on any screen narrower than 1100 px — no grouping or dropdown is provided.

### 2.9 SACCO / Mutindo admin (sites/mutindo/admin.html)

- **Same `sUsers` overwrite bug** as BAF/BAE.
- **SACCO tab** "Share" column in the member table is present (`<th>Share</th>`) but the column content is never populated in `saccoTableBody` rendering — the cell will be empty.
  - File: `sites/mutindo/admin.html` ~L197.
- **`tab-products` is labelled "Supplier listings"** — Mutindo is a SACCO, not a supplier marketplace. The tab content (supplier product list) is incongruous for the SACCO admin context.
- **Farm Aid tab** again says "BAF field roles" — copy-paste error.
  - File: `sites/mutindo/admin.html` ~L222.
- **No transaction management form** in the admin — a SACCO admin cannot post deposits, withdrawals, or credits from this dashboard. They must use the server-rendered `/admin/sacco` panel instead.

### 2.10 Server admin (server/admin.js)

- **SACCO tab** shows the Quick registration form and Posts transaction form but they are not actually complete in the truncated module export; `saccoPage` and `farmAidPage` are referenced in `module.exports` but defined after the export — JavaScript hoisting does not apply to `function` expressions assigned to variables; if they are arrow functions or `const`, the module will throw `ReferenceError: saccoPage is not defined` at load time.
  - File: `server/admin.js` ~L460 (`module.exports` references `saccoPage`, `farmAidPage` before they are defined).
- **No link from server admin to site admins** — the "Busolya network · admin" header has no links back to `bataka-agro-expo.onrender.com/admin.html` or the other sites.
- **Submission detail page** allows changing a submission status but provides no notes/memo field — no record of why a lead was closed or dropped.
- **Export links** (`/admin/export/submissions.csv` etc.) are always visible regardless of whether data exists — exporting an empty table produces a CSV with only a header row, with no user warning.

---

## 3. Code Quality

### 3.1 Duplication / Inconsistency

- **FEAT-004 CSS block** is copy-pasted verbatim into every HTML portal file (10+ files). Any future change (e.g. adjusting the spring easing) must be applied manually in each file.
  - Files: `sites/baf/supplier-portal.html`, `sites/baf/admin.html`, `sites/bae/exhibitor-portal.html`, `sites/bae/admin.html`, `sites/bae/stall.html`, `sites/bae/product.html`, `sites/mutindo/member-portal.html`, `sites/mutindo/guarantor-portal.html`, `sites/mutindo/farm-aid-portal.html`, `sites/mutindo/admin.html`.
  - Fix: move to `sites/shared/busolya-polish.css` and load via `<link>` in each page.
- **Admin page JS** is also largely identical across `sites/baf/admin.html`, `sites/bae/admin.html`, and `sites/mutindo/admin.html` — `loadStats()`, `loadUsers()`, `loadSacco()`, `loadFarmAid()`, `loadEducation()`, `loadProducts()`, and the full moderation block differ only in per-site strings. Estimated duplication: ~500 lines × 3 files.
- **`esc()` helper** is redefined inline in at least 8 HTML files (supplier portals, admin pages, stall, product) — the shared `components.js` does not export it globally. Should be assigned to `window.BusolyaEsc` once in `components.js`.
- **API base URL** is repeated in every script block:
  ```js
  var API = (location.hostname === 'localhost' || ...) ? '' : 'https://busolya-api.onrender.com';
  ```
  This string appears in at least 15 files. If the API hostname changes, every file must be updated. `components.js` should expose `window.BusolyaAPI`.
- **`signSupplier` / `verifySupplier`** in `server/index.js` (~L295–L325) are byte-for-byte duplicates of `sign` / `verify` defined just above (~L65–L85) with different variable names. One pair should be removed.
  - File: `server/index.js` ~L65 and ~L295.

### 3.2 Security gaps

- **SHA-256 for passwords**: `hashPwd()` uses `crypto.createHash('sha256')` — a fast, non-iterated hash. This is vulnerable to offline brute-force attacks; the standard is `bcrypt`, `argon2`, or at minimum `scrypt` with a salt.
  - File: `server/index.js` ~L263.
- **Phone-as-password ("last 5 digits") is guessable** with ≤99,999 attempts. There is no lockout after failed `/api/auth/login` attempts — the `rateLimit` middleware allows 60 requests per hour per IP, which is enough to try all 100,000 combinations from 2 IPs over 2 hours.
  - File: `server/index.js` rateLimit middleware ~L130.
- **Admin bootstrap vulnerability**: the first `POST /api/auth/register` with `role: admin` is accepted without any session if no admin exists yet. On a fresh deployment, any internet user who reaches the server in the first seconds can claim the admin role.
  - File: `server/index.js` ~L370.
- **CORS_ORIGINS hard-codes the three `.onrender.com` subdomains.** If the site moves to a custom domain the CORS whitelist must be updated; there is no environment-variable override for the allowed-origins list.
  - File: `server/index.js` ~L106.
- **`jsonObject()` depth guard** rejects nested objects but still passes flat objects with up to 40 keys and 1200-character values — a payload submission can send 40 × 1200 = 48,000 characters of arbitrary text per field, stored verbatim in the JSONB `payload` and `answers` columns.
  - File: `server/index.js` ~L45.
- **`/api/sacco/guarantors`** (inferred from member portal) returns the full guarantor table to any authenticated user. The client filters by `me.id` client-side — the unfiltered data is exposed in the response.
  - Related file: `sites/mutindo/member-portal.html` ~L230.
- **No CSRF protection.** The `POST /api/auth/login`, `/api/submissions`, `/api/contact`, and SACCO transaction endpoints accept form-encoded or JSON bodies from any site that can read the session cookie. A `SameSite=None` cookie (used here for cross-origin SSO) is not CSRF-safe on its own.
  - File: `server/index.js` — all `POST` handlers; cookie flags ~L430.
- **Superuser phone number hard-coded** in production code:
  ```js
  if (target.rows[0].phone === '+256780698353') {
  ```
  This phone number is now committed to the repository and visible to anyone with read access.
  - File: `server/index.js` ~L490 and ~L510.

### 3.3 Performance issues

- **N+1 media fetch on stall.html** — each product card triggers a separate `GET /api/products/<id>/media` call. With 20 products that is 21 HTTP requests on initial load.
  - File: `sites/bae/stall.html` ~L260.
- **N+1 media fetch in "More from stall" on product.html** — same pattern.
  - File: `sites/bae/product.html` ~L455.
- **Tailwind CDN in every page** — all portal and admin pages load the full Tailwind CSS CDN script (`https://cdn.tailwindcss.com`) which downloads ~300 kB of JS, generates CSS at runtime, and is explicitly [not recommended for production](https://tailwindcss.com/docs/installation/play-cdn) by Tailwind. This makes every page's First Contentful Paint dependent on an external CDN request.
  - Files: all HTML files in `sites/baf/`, `sites/bae/`, `sites/mutindo/`.
- **`server/index.js` rate-limit map** uses an unbounded in-memory `Map`. The `hits.clear()` guard (`if (hits.size > 5000) hits.clear()`) clears the entire map at once, resetting all limits for all IPs. Under sustained load from >5,000 unique IPs the map clears cyclically, effectively disabling rate limiting.
  - File: `server/index.js` ~L135.
- **No `ETag` or `Cache-Control` on static files** — the server does not serve the site files; Render's static site service does. But API responses set `Cache-Control: no-store` globally (even for read-only public endpoints like `/api/directory`, `/api/exhibitors`, `/api/stats`) preventing any CDN or browser caching of stable data.
  - File: `server/index.js` ~L115.
- **`admin.js` `STYLE` constant** is a long inline CSS string (~1,400 chars) injected into every server-rendered HTML response. There is no caching; every admin page hit regenerates the same string.
  - File: `server/admin.js` ~L5–L62.

### 3.4 Unhandled promise rejections / error gaps

- **All client-side `fetch()` calls in portal and admin pages** use `.catch(function(err){ console.error(...) })` — errors are silently swallowed. No user-visible error state is set when a network request fails.
  - Files: `sites/baf/supplier-portal.html` ~L440, `sites/baf/admin.html` ~L300, same pattern in BAE and Mutindo files.
- **`loadMember()` in member-portal.html** reads `me.member_no`, `me.shares`, etc. from session storage. If these properties are absent (e.g. account was created before SACCO membership was linked), the stats silently show "—" or `0` with no indication to the user.
  - File: `sites/mutindo/member-portal.html` ~L155.
- **`admin.js` `saccoPage` / `farmAidPage`** referenced in `module.exports` but not yet visible in the read portion of the file — if these are defined after the export block the module will fail to load. The server would crash on startup with a `ReferenceError`.
  - File: `server/admin.js` ~L460.
- **`server/index.js` JSONL adapter error path** — `adapter.js` `selectJsonl()` returns `{ rows: [], rowCount: 0 }` for unknown collection names instead of throwing, so a mistyped table name silently returns empty data rather than raising an error. Callers cannot distinguish "no rows" from "table not found".
  - File: `server/data/adapter.js` ~L25.
- **`server/data/adapter.js` `applyWhere()`** uses a naive regex to parse SQL `WHERE` clauses. Complex conditions (subqueries, `OR`, `NOT IN`, `IS NULL`, `>`, `<`) silently pass all rows through the `return true` fallback. This could return incorrect data to callers that assume the where clause was applied.
  - File: `server/data/adapter.js` ~L120.

---

## 4. Dashboard Well-formedness per Dashboard

### 4.1 BAF supplier-portal.html

**Working:**
- Stat cards (Listings, With media, Visitor request leads, Directory)
- My listings tab — renders product cards with price, stock, share buttons
- Add listing form — validates title, POSTs to API, switches to products tab on success
- Photos & media tab — upload form with progress bar, gallery grid
- Directory entry tab — shows supplier's yellow-pages entry
- Visitor requests tab — loads demand submissions
- Moderation tab structure — HTML present

**Structurally missing:**
- `tab-purchases`, `tab-inventory`, `tab-alerts` tabs have full HTML panels and API wiring but no tab `<button>` triggers in the tab strip — unreachable by users
- `#statDemand` not updated on load (only on tab activation)
- `#statDir` never populated
- Moderation filter buttons not wired to JS

**Regression risk:**
- Any change to the FEAT-004 block in this file must be replicated to 9 other files
- The `loadProducts()` catch block swallows errors; a broken API silently leaves the portal blank

### 4.2 BAE exhibitor-portal.html

**Working:**
- Auth guard with role check
- Stat cards (Listings, With media, Demand leads, Directory)
- My listings with category pills (partial — pill container not in HTML)
- Add listing with category dropdown
- Photos & media upload with progress bar
- Stall name & directory tab (profile edit form)
- Demand tab structure

**Structurally missing:**
- `#productPills` element missing from HTML — category filter fails silently
- `loadModeration()` function never defined — clicking Moderation tab throws ReferenceError
- No "View my stall" deep link back to stall.html with the exhibitor's actual supplier ID in a way that persists after a name change

**Regression risk:**
- Demand tab loads ALL demand, not exhibitor-specific demand — shows competitor data
- BAE-specific category list and BAF free-text input are incompatible for cross-site matching

### 4.3 BAE stall.html (public exhibitor stall)

**Working:**
- Dynamic stall name and exhibitor name from query parameters
- Product grid with placeholder emoji
- Product image lazy-load from `/api/products/<id>/media`
- Demand submission form (name, phone, item, qty, budget, when, credit)
- Stall booking info section (prices, contact)
- Review/comment thread with moderation controls
- Share buttons (WhatsApp, Telegram, Facebook)

**Structurally missing:**
- `scrollProducts()` function not defined — navigation arrows throw ReferenceError
- Emoji reaction handler uses undefined variable `b` — reactions throw ReferenceError
- No fallback when product images all 404 (only the 🌱 emoji placeholder)
- Products are NOT filtered by `stallId` server-side — all products are fetched then filtered client-side (N+1 + data over-fetch)
- Demand form phone field accepts non-numeric input

**Regression risk:**
- N+1 media fetches will cause slow loads and potential 429 rate-limit responses under load
- Review thread `loadStallComments()` calls only one emoji endpoint (hardcoded to `commentIds[0]`) regardless of comment count — emoji counts for all but the first comment are wrong

### 4.4 BAE product.html (public product detail)

**Working:**
- Skeleton loading state (FEAT-004)
- Image gallery with thumbnail strip, audio/video player
- Product details table, price block, stock indicator
- "More from this stall" section
- Product-level review/comment form
- Demand/enquiry form with name, phone, district, qty, message
- Share buttons including clipboard copy
- Breadcrumb navigation

**Structurally missing:**
- No 404 handling beyond a static "Product not found" div — the actual HTTP error code is not returned by the API for a missing product
- "More from stall" N+1 media fetches for each additional product thumbnail
- No "Back to stall" shortcut that preserves scroll position

**Regression risk:**
- `loadMoreFromStall()` uses `stallBiz` from the query string which may differ from the actual business name in the database after a profile update
- `absMedia()` is defined both inline in the script and in `BusolyaMedia.absMedia` — two code paths for URL resolution

### 4.5 SACCO mutindo member-portal.html

**Working:**
- Auth guard (role === 'member')
- Stat cards populated from session user object
- Account details tab with name, phone, district, status, joined date
- Transaction history fetch and render
- Deposit form with success/error feedback
- Withdrawal/payout form with type selector
- Guarantors tab renders guarantee records

**Structurally missing:**
- Balance is `shares + savings` client-side — not a true ledger balance
- Withdrawal form has no balance check — negative balance possible
- Transaction list has no pagination
- No credit/loan request workflow
- No way to update personal details (name, district) from the portal

**Regression risk:**
- Guarantors list leaks all guarantors to client; filtering is client-side only
- `loadMember()` never refreshes from server — stale data risk post-transaction

### 4.6 SACCO mutindo guarantor-portal.html

**Working:**
- Stat cards (active guarantees, total guaranteed, members guaranteed, released)
- Guarantee list with per-record status badge
- Share portal link via WhatsApp/Telegram/Facebook

**Structurally missing:**
- No role/membership check beyond basic authentication
- No pagination for guarantors with large portfolios
- No ability to accept or decline a guarantee request from this portal — read-only view only
- No link back to the member portal

**Regression risk:**
- `?guarantor_id=` filter in the URL is not server-enforced; swapping the ID exposes another member's data

### 4.7 SACCO mutindo farm-aid-portal.html

**Working:**
- Field report submission form (type, compartment, location fields, content)
- Recent reports list filtered by `me.id`
- Reports count stat card

**Structurally missing:**
- **Broken HTML structure** — second `<body>` tag mid-file; header placeholder in wrong tree
- Nav/header will not render correctly (component injection targets first `#header-placeholder`)
- Footer placeholder is in the wrong `<body>`
- Stats cards for role/compartment/location only show if a `farm_aid_roles` entry exists
- No empty state or action when user has no assigned Farm-Aid role
- `faReportForm` is outside both `<main>` elements (between the two `<body>` tags)

**Regression risk:**
- `content` sent as plain string but schema expects `jsonb` — may cause server-side 500 on PostgreSQL path
- The broken `<body>` structure may cause `components.js` to inject the header in the wrong location, making the page render in a completely unexpected order

### 4.8 BAF admin.html

**Working:**
- Admin gate with password auth
- Stats row (Users, Suppliers, Demand, SACCO members, FA reports, Directory)
- Users tab with role filter and quick-register form
- SACCO tab with member table, quick SACCO registration
- Farm Aid tab with roles table and report submission form
- Education tab (subjects, topics, notes — read-only list)
- Supplier listings tab (all products — read-only)
- Site content faucets tab
- Moderation tab

**Structurally missing:**
- `sUsers` is overwritten by SACCO count (bug)
- Transactions tab for SACCO — admin can register but cannot post transactions from this dashboard
- No search/filter on any data table
- No pagination on any table
- No direct link to server admin from the dashboard header (only from the top-level sign-in area)
- Education tab is read-only — admin cannot add subjects/topics from this panel

**Regression risk:**
- Any admin with BAF credentials can also read/write SACCO data and Farm Aid reports (no site-scope isolation in the API)

### 4.9 BAE admin.html

**Working:** Same as BAF admin plus:
- Visitors tab, Suppliers tab, Messages/Contacts tab, Directory tab, Questions tab, Subjects tab, Governance tab, Networks tab — all visible and wired

**Structurally missing:**
- `sUsers` overwrite bug (same as BAF)
- 15-tab strip wraps on screens < 1100 px — tab navigation becomes a two-row strip with no grouping
- "BAF field roles" mislabel in Farm Aid tab
- Moderation tab JS wiring unverified (function may be missing)
- No ability to verify/unverify a directory entry from this admin (only available in server admin)

**Regression risk:**
- Having the most tabs of any admin, any future tab addition will worsen the overflow problem

### 4.10 Mutindo admin.html

**Working:** Same as BAF admin (Users, SACCO, Farm Aid, Education, Supplier listings, Site content, Moderation)

**Structurally missing:**
- `sUsers` overwrite bug (same)
- SACCO "Share" column header present but content not populated
- No SACCO transaction management (post deposit/withdrawal/credit) — must use server admin
- "BAF field roles" mislabel
- "Supplier listings" tab is not contextually relevant to a SACCO admin dashboard

**Regression risk:**
- SACCO-specific features (creditors management, guarantor linking, loan approval) are entirely absent from this client-side admin — the SACCO admin must use the server-rendered `/admin/sacco` for all financial operations

### 4.11 server/admin.js

**Working:**
- Full server-rendered HTML with consistent navigation
- Overview dashboard with stat cards and latest submissions
- Demand/supply/linkage submission logs with search, status filter, CSV export
- Visitor registry
- Supplier list
- Yellow-pages directory with verify/unverify buttons
- Questionnaire editor (add/edit/retire questions)
- Education management (subjects, topics, notes/presentations)
- Governance layers and units register
- Business and trade network members
- Messages/contacts inbox
- SACCO page (members, transactions, creditors, guarantors)
- Farm Aid page (referenced in `module.exports`)

**Structurally missing / risk:**
- `saccoPage` and `farmAidPage` are exported before they appear in the file — potential `ReferenceError` at module load if they are not hoisted (depends on whether they use `function` declaration or `const`/`let`)
- No pagination on any table — `/admin/visitors`, `/admin/suppliers`, `/admin/contacts` query the full table (no `LIMIT` at the admin route level beyond the view itself)
- No inline editing of directory entries — only verify/unverify actions
- No bulk action on submissions (e.g. bulk status update for expo follow-up)
- The login page accepts a single shared `ADMIN_PASSWORD` — no per-user audit trail for server admin actions
- `fmtDate()` uses `new Date(value).toISOString().slice(0,16)` — renders times in UTC, not Uganda time (EAT, UTC+3)

---

## 5. Responsiveness Gaps

### 5.1 Items not addressed by FEAT-004

FEAT-004 added:
- `max-width: 100%; height: auto` on `img` and `video`
- `grid-cols-2 → 1fr` and `grid-cols-3 → 1fr 1fr` at 640 px breakpoint
- `clamp()` for `h1` and `h2`
- Horizontal scroll on `table` at 768 px

The following are **not** covered:

### 5.2 Navigation / header

- **Hamburger menu** is injected by `components.js` and shows on `md:hidden`. The expanded menu renders links as a flex-column list but the Account and Network sections are inside a `div.md:hidden` that is appended inside `hdr-nav` — on mobile both the main nav links and the Account/Network sections render inside the same open menu. This works but there is no visual divider or section heading between "nav links" and "Account" in the expanded state.
  - File: `sites/shared/components.js` ~L180 (mobile menu block).
- **`hdr-cta` (CTA button)** is `hidden md:inline-block` — it never appears on mobile. A "Join the network" or "Register interest" CTA is important for conversion on small screens and should be present in the mobile menu.
  - File: `sites/shared/components.js` ~L205.
- **Tab strips on admin and portal pages** are `flex flex-wrap` — they wrap gracefully, but on a 375 px phone most tabs drop to 2–3 lines. A horizontally-scrollable single-line strip (`overflow-x: auto; white-space: nowrap`) would be better for long tab lists (especially BAE admin with 15 tabs).
  - Files: all portal/admin pages — e.g. `sites/bae/admin.html` ~L165.

### 5.3 Stat rows

- **5-column stat row** in `member-portal.html` (`grid-cols-2 md:grid-cols-5`): at 640 px this collapses to 2 columns, leaving the 5th stat on a row of its own. At 375 px the stat number text (`text-2xl`) may overflow the card.
  - File: `sites/mutindo/member-portal.html` ~L65.
- **6-column stat row** in admin pages (`grid-cols-2 md:grid-cols-4 lg:grid-cols-6`): at 640 px this renders as 2-column grid, which is fine; however the "SACCO members" and "FA reports" labels (`text-xs uppercase tracking-[.12em]`) may clip at 320 px widths.
  - Files: `sites/baf/admin.html` ~L93, `sites/bae/admin.html` ~L93, `sites/mutindo/admin.html` ~L93.

### 5.4 Forms

- **Quick-register form** in admin pages uses `md:grid-cols-3` — on mobile this stacks to 1 column, which is correct. However the action buttons at the bottom use `flex gap-2` inside a `md:col-span-3` cell; on narrow screens the "Save" and "Cancel" buttons are close together with the same visual weight. "Cancel" should use a secondary/destructive style so a fat-finger press does not accidentally cancel a registration.
  - Files: `sites/baf/admin.html` ~L138, same in BAE and Mutindo admin.
- **Deposit and withdrawal forms** (`member-portal.html`) use a fixed `max-w-md` container which is fine on desktop but on a 375 px phone the `px-5` padding leaves very little input width.
- **Farm Aid report form** (`farm-aid-portal.html`) uses `sm:grid-cols-2` with 9 fields. On screens < 640 px all fields stack to 1 column — the Ssaza, Ssiga, Mutuba, Parish grid becomes a long sequential list with no visual grouping by geographic level.

### 5.5 Product cards / media grid

- **`stall.html` product grid** (`grid gap-4 sm:grid-cols-2 lg:grid-cols-3`) lacks `overflow-hidden` on the grid container. A product title that wraps to 3+ lines can push the card height out of alignment with adjacent cards in the same row. Use `grid-auto-rows: 1fr` or `items-start` consistently.
- **Media gallery grid** (`grid grid-cols-2 sm:grid-cols-3`) in exhibitor portals: images are rendered with `BusolyaMedia.thumb()` which outputs `<img class="bsl-media-card">`. The `bsl-media-card` CSS class is defined in the components but not scoped to a container with a fixed aspect-ratio — images of varying aspect ratios create uneven grid cells.
  - File: `sites/shared/components.js` (BusolyaMedia.thumb returns `<img class="bsl-media-card">`); no aspect-ratio constraint visible in the FEAT-004 block.
- **`product.html` main image** uses `style="aspect-ratio:4/3"` — this is good. The thumbnail strip is `flex overflow-x-auto` with `w-16 h-16` cells, which works, but there is no `min-width` on the strip container so it can collapse to 0 width on very narrow viewports.

### 5.6 Tables

- FEAT-004 wraps `table` in `overflow-x: auto; white-space: nowrap` at 768 px. However tables inside `overflow-x-auto` containers (e.g. `<div class="overflow-x-auto rounded-xl ...">`) in admin pages already have the outer wrapper — the FEAT-004 rule then adds a second scroll context on the `table` element itself, which can cause nested scroll jank on iOS Safari.
  - Files: all admin pages that wrap their tables in `overflow-x-auto` divs.
- **`admin.js` server-rendered tables** do not have the FEAT-004 override (it is client-side CSS); the server-rendered admin is fully bare at mobile widths. The `@media(max-width:760px)` rule in `STYLE` only switches `dl` and `.grid2` to 1 column — the main data tables have no overflow wrapper.
  - File: `server/admin.js` ~L62 (`@media(max-width:760px)` block).

### 5.7 Fixed widths and overflow risks

- **`admin.js` `td.wrap`** is `max-width: 340px` on desktop, `max-width: 220px` on mobile. Long strings (submission messages, Farm Aid report content) will truncate with CSS `white-space: pre-wrap` but will not break properly in narrow cells — on < 380 px screens the cell itself may still overflow its column.
  - File: `server/admin.js` ~L37 (`td.wrap`).
- **`min-w-[640px]`** is applied to all admin-page tables. At widths < 640 px the outer `overflow-x-auto` container scrolls horizontally but the inner table overflows the rounded-xl border of the wrapper div, producing a visual glitch where the table border clips the scroll area.
  - Files: `sites/baf/admin.html`, `sites/bae/admin.html`, `sites/mutindo/admin.html` — all data tables.
- **`stall.html` booking price grid** uses `grid sm:grid-cols-2 lg:grid-cols-4` — at exactly 640–768 px this renders as 2 columns, which is correct. Below 640 px it stacks to 1 column but the price cards have `text-center` with a `text-2xl font-bold text-seal` heading (the stall size, e.g. "100 Seater") — on < 320 px phones this wraps mid-word.
- **`guarantor-portal.html` guarantee list cards** use `flex flex-wrap items-start justify-between gap-3`. On narrow screens the right-side amount block may sit directly below the name block rather than beside it — acceptable, but the UGX amount block has no minimum width so it can reflow to a single digit per line.

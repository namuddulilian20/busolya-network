# Busolya Biz Network — facilitation system blueprint

Companion to the three live sites (`sites/baf`, `sites/bae`, `sites/mutindo`) and the API (`server`).
This document specifies the operational model, the data entities and the phasing plan.

---

## 1. The two networks

### Busolya Biz Network (business)
Membership, listing and matched demand. A member is verified once, listed in the yellow-pages directory, and receives demand leads that match their sector and district. Revenue: annual membership + directory placement + a per-closed-deal facilitation fee agreed in writing.

### Bataka Trade Network (trade)
Aggregation and off-take. Farmers deliver to a named collection point at a published grade and price; the network bulks, transports and contracts to buyers. Every consignment gets a receipt with weight, grade and moisture. Revenue: fixed handling fee per kilogram.

---

## 2. Entities

| Entity | Key fields | Created by |
|---|---|---|
| **Participant** | id, phone (unique), email, name, role (supplier / member / employee / customer / admin), district, org, password_hash | Self-registration or admin quick-register |
| **Supplier** | id, business, contact, phone, district, category, capacity, price band, delivery range, credit terms, listing opt-in | Marshal / self-registration via supply log |
| **Supplier product** | id, supplier_id, title, category, price, unit, stock, description, district | Supplier via portal |
| **Demand submission** | id, ref (BAE-D-XXXX), respondent, phone, district, category, answers, payload, credit, consent | Visitor QR / desk form / marshal |
| **Supply submission** | id, ref (BAE-S-XXXX), same structure | Exhibitor or marshal |
| **Linkage** | id, ref (BAE-L-XXXX), who they want to meet, deal, volume, timeline, listed (→ directory) | Exhibitor |
| **Demand stock** | product_id, submission_id, quantity, status | Admin matching |
| **Directory entry** | name, sector, description, phone, email, district, website, verified | Submission / admin / supplier self-registration |
| **SACCO member** | user_id, member_no (AMS-YYYY-NNNN), shares, savings, status | Counter / self-registration |
| **SACCO transaction** | member_id, type, amount, balance_after, narr | SACCO officer |
| **SACCO creditor** | member_id, creditor_name/phone, amount, status | SACCO officer |
| **SACCO guarantor** | member_id, guarantor_id, amount, relationship | SACCO officer |
| **Farm Aid role** | user_id, role_code, compartment (busolya/butaka), location_level, location_name | Admin |
| **Farm Aid report** | reporter_id, report_type, compartment, ssaza/ssiga/mutuba/parish/village/clan, content | BAF field staff |
| **Education note** | topic_id, title, content (English), locale, format, price_ugx (5,000) | Admin |
| **Education presentation** | note_id, title, slides (JSON), locale (Luganda) | Admin |
| **Education share** | note_id, participant_id, amount_ugx | Signed-in user |

---

## 3. Roles

### Site access roles (participants table)

| Role | What they can do |
|---|---|
| **customer** | Browse freely, submit demand forms, view directory |
| **member** | All customer access plus sign in to see member content |
| **supplier** | All member access plus manage product listings via the supplier portal |
| **employee** | All supplier access plus access the client-side admin dashboard and auth-protected API endpoints |
| **admin** | All employee access plus the server-rendered admin backend |

### Farm Aid field roles (farm_aid_roles table)

| Role code | Minimum location | Duties |
|---|---|---|
| `clerk` | Lunyiriri / village | Register land owners and labourers; record transactions |
| `verifier` | Mutuba / parish | Vet ownership documents; validate transactions and payments |
| `aggregator` | Mutuba / parish | Stock and inventory of items received and produced |
| `courier` | Lunyiriri / village | Vet quality; transport items between points |
| `registrar` | Ssiga / Ssaza | Clear payments; settle disputes |
| `commissioner` | Mutuba / Ssaza | Oversee stock and inventory across the network |
| `committee` | Selected by Abobusolya | Receive registrar and commissioner reports |

Every record carries `created_at`. Records are not hard-deleted.

---

## 4. Capture routes

| Route | Source tag | How it works |
|---|---|---|
| QR form (`/bae/visit.html`) | `qr` | Visitor scans, fills on own phone |
| Printed objective form | `desk` | Information desk staff enter it |
| Exhibitor marshal | `marshal` | Marshal logs at the stand |
| Supplier self-registration | `supplier-portal` | Supplier logs in and adds listing; auto-creates supply submission |

Deduplicate rule: same phone + same category within 24 hours → merge, keep the fuller record (server-side upsert on visitors table).

---

## 5. The Bataka Agro Expo 2026 — detailed programme

**Dates:** 4–9 November 2026 (Wednesday – Monday)
**Session times:** Kumakya 08:00–11:00 · Tuntu 11:00–13:00 · Kawungezi (afternoon)

### Day 1 — Wednesday 4 November

| Session | Title (Luganda) | English | Presenter |
|---|---|---|---|
| Kumakya | Enkoko — entandika yaazo | Poultry — starting from scratch | TBC |
| Tuntu | Ennunda n'endlisa y'ente ereeta amagoba | Cattle husbandry and feeding for profit | TBC |
| Kawungezi | Ennima n'enkozesa ya muwogo avaamu emmere y'ebisolo | Cassava farming and cassava by-products as animal feed | TBC |

### Day 2 — Thursday 5 November

| Session | Title (Luganda) | English | Presenter |
|---|---|---|---|
| Kumakya | Okulundira ebyenyanja mu bidiba | Fish farming in ponds | TBC |
| Tuntu | Obutale n'omutindo | Quality and value (5 business qualities + pricing for value) | Robert Mawanda |
| Kawungezi | Okugereka emiwendo gyo olwo okukola amagoba | Pricing for profit; finding the best way to sell | PSFU Marketing unit |

### Day 3 — Friday 6 November

| Session | Title (Luganda) | English | Presenter |
|---|---|---|---|
| Kumakya | Ennunda y'ebyebyanjanja etunisa amagoba | Profitable horticulture | Dr Emma Naluyima / Mugisha Bright |
| Tuntu | Okutandika abibukiriro obutono 100 | Starting a nursery with very little capital | Fahad Kayondo — Telesat |
| Kawungezi | Enkozesa ya ssente okuzifunamu amagoba n'okuzikuuma | Personal financial management for farmers | Newton Buteraba |

### Day 4 — Saturday 7 November

| Session | Title (Luganda) | English | Presenter |
|---|---|---|---|
| Kumakya | Obulunzi bw'ente — endabirira n'endlisa (+ BSF feeds) | Cattle management, care and feeding; Black Soldier Fly feed | Dr Herbert Mukiibi — MUK |
| Tuntu | Obwegassi — enkola esitula omuntu wawansi + Obutale okuva mu bwegassi | Cooperatives: the structure that lifts the bottom; quality standards from cooperatives | Ssentumbwe Daniel / Mufabaazi Godfrey |
| Kawungezi | Okwegema obukosefu obuva mu nkyukakyuka y'embeera y'obudde | Climate change adaptation: biochar, 7-day hay, soil moisture | MUK team |

### Day 5 — Sunday 8 November

| Session | Title (Luganda) | English | Presenter |
|---|---|---|---|
| Kumakya | Ennima y'ebitooke n'olusuku eneluwangaaza | Profitable banana and mixed garden production | Arthur Musoke / Peter Semuwera (farmer) |
| Tuntu | Ennima ey'okulukitira ng'okozesa obuuma n'ssente entonotono | Micro-irrigated farming with appropriate technology | Gorreth Semmando — Prime Power |
| Kawungezi | Emmwanyi ssekabalila + Emiti egy'ettunzi | Arabica coffee management; growing trees as a business | Bulamu Coffee / Acram Mawejje |

### Day 6 — Monday 9 November

| Session | Title (Luganda) | English | Presenter |
|---|---|---|---|
| Kumakya | Endabirira y'enkoko okuva ku lunaku olumu okutuuka ku katale | Poultry from day one to market: feed efficiency and profit | Dr Vincent Kizito |
| Tuntu | Okukazesa ttalanta n'okwesitula n'ogituula omulimu | Talent, self-development and creating your own work | Abby Mukiibi — CBS / Simon Ssenkaayi |
| Kawungezi | Okukozesa amasannyalaze g'obusa bw'ebisolo | Biogas from animal waste: cost saving and soil restoration | Florence Kintu — Biogas Solutions Uganda Ltd |

---

## 6. Dashboards that sell the next expo

- Leads per exhibitor and leads converted to orders (the number an exhibitor renews on).
- Credit exposure by guarantor and by category (the number a lender prices on).
- Demand categories with no matching supplier (the gap list for recruitment).
- Directory listings by verification status and renewal date (the recurring revenue line).
- Farm Aid intake: land offered, managers trained, farms active, recoupment progress.
- SACCO totals: members, shares, savings, active credit facilities.

---

## 7. Distributables

### Print

| Item | Qty | Where |
|---|---|---|
| Expo programme card (A5, double-sided, Luganda sessions + English summary) | 1,000 | Gate, information desk, stands |
| Demand log objective form (A4, carbon-copy pad of 200) | 5 pads | Information desk, marshal stations |
| Supply log / exhibitor registration form (A4) | 200 | Exhibitor registration desk |
| QR card linking to demand form + supply form (business card size) | 2,000 | Gate, desk, all stands |
| Business directory insert (A5 booklet, current verified listings) | 500 | Information desk, SACCO desk |
| Farm Aid one-pager (A4, what it is, how to offer land, 17× model) | 500 | All stands, gate |
| SACCO membership card (credit card size, member number + stamps) | per registration | SACCO desk |
| Education subject cards (A6, one per subject, Luganda title + summary) | 500 sets | Teaching area, gate |

### Digital / social media

| Item | Platform | Timing |
|---|---|---|
| Daily session announcement graphic (title, presenter, time) | WhatsApp broadcast, Facebook | Morning of each expo day |
| Presenter profile post (photo, bio, what they teach) | Facebook, Instagram | Day before each presenter |
| QR code graphic with caption: *"Log your order at the expo"* | WhatsApp, Facebook | Daily during expo |
| Demand log call-to-action: *"What did you come to buy? Fill in the form."* | WhatsApp, SMS | Day 1 morning, Day 3 morning |
| Supplier registration CTA with link to supplier portal | WhatsApp, Facebook | One week before expo, Day 1 |
| Farm Aid CTA: *"Do you have dormant land? We put it to work."* | WhatsApp, Facebook | Day 3, Day 5 |
| SACCO membership CTA with link to mutindo registration form | WhatsApp broadcast | Day 2, Day 4 |
| Session recap (3–5 key points in Luganda, per session) | WhatsApp broadcast, Facebook | Evening of each expo day |
| Directory listing promotion: *"Is your business listed?"* | Facebook | Two weeks before expo |
| Post-expo thank-you (attendance, leads captured, suppliers registered) | All platforms | Day after expo closes |

---

## 8. Open items

- Expo venue address, gate times and stand fees.
- Official phone, email and physical address for Busolya Agro Farmers Ltd, Bataka Agro Expo and Abataka Mutindo SACCO.
- Verified clan register — spellings, totems and heads must be confirmed with clan elders before the print edition.
- SACCO membership requirements, share value, dividend rate and interest rate.
- Farm Aid agreement template and the exact recoupment / share formula.
- Presenter confirmations and bios for social media.
- Presenter for Day 1 Kumakya, Tuntu, Kawungezi (TBC in programme document).

# Busolya Biz Network — facilitation system blueprint

Companion to the two live sites (`sites/baf`, `sites/bae`) and the hub (`sites/mutindo`).
The sites capture and publish. This document specifies the backend they hand off to.

## 1. Entities

| Entity | Key fields | Created by |
|---|---|---|
| Supplier | id, business, contact, phone, district, category, capacity, price band, delivery radius, credit terms, verified (y/n), listing tier | Marshal / self-registration |
| Demand (lead) | id, visitor, phone, district, role, category, qty, budget, timing, source, consent | Visitor (QR / form) or marshal |
| Order | id, demand_id, supplier_id, qty, agreed price, deposit, status, fulfilled_at | Registrar |
| CreditFacility | id, demand_id or order_id, amount, creditor, guarantor_id, relationship, terms, status | Credit officer |
| Guarantor | id, name, phone, relationship, exposure (computed) | Credit officer |
| Member | id, person, clan layer (optional), supplier_id or demand history, savings record | SACCO |
| Listing | supplier_id, tier, print edition, online status, paid_until | Registrar |
| Event | id, name, edition, dates, venue, stands, attendance | Admin |

Relations: `Demand 1—0..1 Order`, `Order 1—0..1 CreditFacility`, `CreditFacility *—1 Guarantor`,
`Supplier 1—* Listing`, `Supplier 1—* Order`.

## 2. Roles

- **Registrar** — suppliers log, listings, order entry, print data.
- **Marshal** — demand capture only, scoped to their stand or desk; sees only their own entries.
- **Credit officer** — credit and guarantor records; no pricing changes.
- **Analyst / admin** — dashboards, exports, user management; no deletion of financial records.
- **Public** — capture forms only.

Every record carries `created_at`, `created_by`, `updated_at`. Nothing is hard-deleted; use `voided_at`.

## 3. Capture routes → one table

1. QR form (`bae/visit.html`) → `Demand` with `source=qr`.
2. Printed objective form at the info desk → entered by registrar, `source=desk`.
3. Marshal at the stand → `Demand` with `source=marshal` and `stand_id`.

Dedupe rule: same phone + same category within 24 h → merge, keep the fuller record.

## 4. Dashboards that sell the next expo

- Leads per exhibitor, and leads converted to orders (the number an exhibitor renews on).
- Credit exposure by guarantor and by category (the number a lender prices on).
- Demand categories with no matching supplier (the gap list for recruitment).
- Directory listings by tier and renewal date (the recurring revenue line).
- Farm Aid intake: land offered, managers trained, farms active, recoupment progress.

## 5. Phasing

1. **Now** — static sites live; forms save locally and export CSV; desk forms printable.
2. **Phase 1** — shared backend + auth; `Demand`/`Supplier` tables; CSV import of existing entries; registrar + marshal roles.
3. **Phase 2** — orders, credit/guarantor records, directory listing billing.
4. **Phase 3** — SACCO member records and a read-only credit view for the credit officer.
5. **Phase 4** — Farm Aid tracking: agreements, share statements, recoupment to the 17× floor.

## 6. Open items needing the client

- Venue, gate times and stand fees for the expo.
- Official phone, email and office address for Busolya Agro Farmers Ltd, Bataka Agro Expo and Abataka Mutindo SACCO.
- Verified clan register (spellings, totems, heads) before the print edition.
- SACCO membership requirements, share value, and rates.
- Farm Aid agreement template and the exact recoupment/share formula.

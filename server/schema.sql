-- Busolya network schema. Idempotent: safe to run on every boot.

create table if not exists submissions (
  id              bigserial primary key,
  ref             text unique,
  kind            text not null check (kind in ('demand','supply','linkage')),
  event           text not null default 'bae-2026',
  name            text,
  phone           text,
  email           text,
  district        text,
  org             text,
  role            text,
  category        text,
  payload         jsonb not null default '{}'::jsonb,
  answers         jsonb not null default '{}'::jsonb,
  credit_amount   numeric(14,2),
  guarantor_name  text,
  guarantor_phone text,
  guarantor_rel   text,
  consent         boolean not null default false,
  status          text not null default 'new',
  source          text not null default 'web',
  created_at      timestamptz not null default now()
);

create index if not exists submissions_kind_idx on submissions (kind, created_at desc);
create index if not exists submissions_phone_idx on submissions (phone);

create table if not exists visitors (
  id         bigserial primary key,
  name       text,
  phone      text unique,
  district   text,
  role       text,
  org        text,
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  visits     integer not null default 1
);

create table if not exists suppliers (
  id             bigserial primary key,
  business       text not null,
  contact        text,
  phone          text,
  district       text,
  category       text,
  offer          text,
  capacity       text,
  price_band     text,
  delivery_range text,
  listing_optin  boolean not null default false,
  credit_terms   text,
  status         text not null default 'new',
  created_at     timestamptz not null default now()
);

create table if not exists directory_entries (
  id          bigserial primary key,
  name        text not null,
  sector      text,
  description text,
  phone       text,
  email       text,
  district    text,
  website     text,
  exhibitor   boolean not null default false,
  verified    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists questions (
  id       bigserial primary key,
  kind     text not null check (kind in ('demand','supply','linkage')),
  position integer not null default 1,
  field    text not null,
  prompt   text not null,
  type     text not null default 'text' check (type in ('text','textarea','select','number','yesno')),
  options  jsonb,
  required boolean not null default true,
  active   boolean not null default true,
  unique (kind, field)
);

create table if not exists subjects (
  id      bigserial primary key,
  code    text unique not null,
  title   text not null,
  summary text,
  outline jsonb,
  level   text not null default 'foundation',
  active  boolean not null default true
);

create table if not exists education_sessions (
  id         bigserial primary key,
  subject_id bigint references subjects (id) on delete cascade,
  title      text,
  starts_at  timestamptz,
  venue      text,
  trainer    text,
  capacity   integer,
  notes      text
);

create table if not exists governance_layers (
  code        text primary key,
  name        text not null,
  kind        text not null check (kind in ('clan','admin')),
  parent_code text references governance_layers (code),
  description text,
  sort        integer not null default 0
);

create table if not exists governance_units (
  id         bigserial primary key,
  layer_code text not null references governance_layers (code),
  name       text not null,
  parent_id  bigint references governance_units (id) on delete set null,
  clan       text,
  notes      text,
  verified   boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists networks (
  id          bigserial primary key,
  kind        text not null check (kind in ('business','trade')),
  name        text not null unique,
  model       text,
  description text,
  status      text not null default 'active',
  created_at  timestamptz not null default now()
);

create table if not exists members (
  id         bigserial primary key,
  network_id bigint not null references networks (id) on delete cascade,
  org        text not null,
  contact    text,
  phone      text,
  role       text,
  status     text not null default 'pending',
  joined_at  timestamptz not null default now()
);

create table if not exists contacts (
  id         bigserial primary key,
  name       text,
  phone      text,
  email      text,
  org        text,
  message    text,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------- supplier & participant authentication (idempotent) ----------
-- Add auth columns to suppliers if they don't exist yet.
ALTER TABLE suppliers ADD COLUMN password_hash text;
ALTER TABLE suppliers ADD COLUMN email text;

create table if not exists participants (
  id            bigserial primary key,
  phone         text unique not null,
  email         text unique,
  name          text,
  role          text not null default 'customer'
                check (role in ('supplier','member','customer','employee','admin')),
  district      text,
  org           text,
  password_hash text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists participants_phone_idx on participants (phone);
create index if not exists participants_role_idx  on participants (role);

-- Add email, updated_at columns to existing installations (idempotent).
-- The email index is created inside the guard so it only runs after the
-- column exists — prevents "column does not exist" on a legacy database.
ALTER TABLE participants ADD COLUMN email text unique;
ALTER TABLE participants ADD COLUMN updated_at timestamptz not null default now();
CREATE UNIQUE INDEX participants_email_idx ON participants (email);
create table if not exists users (
  id          bigserial primary key,
  phone       text unique not null,
  email       text unique,
  name        text not null,
  role        text not null default 'customer'
              check (role in ('supplier','member','employee','customer','admin')),
  district    text,
  clan        text,
  village     text,
  password_hash text not null,
  is_active   boolean not null default true,
  email_verified boolean not null default false,
  phone_verified boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists users_phone_idx on users (phone);
create index if not exists users_email_idx on users (email);
create index if not exists users_role_idx on users (role);

-- Legacy databases may have been created before the 'admin' role was added,
-- leaving a CHECK constraint that rejects it. Rebuild any role CHECK on
-- participants and users so the full role set is always allowed.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname, conrelid::regclass AS tbl
      FROM pg_constraint
     WHERE conrelid IN ('participants'::regclass, 'users'::regclass)
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
  END LOOP;
  ALTER TABLE participants ADD CONSTRAINT participants_role_check
    CHECK (role IN ('supplier','member','customer','employee','admin'));
  ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('supplier','member','employee','customer','admin'));
END $$;

create table if not exists user_sessions (
  id         bigserial primary key,
  user_id    bigint not null references users (id) on delete cascade,
  token      text unique not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists user_sessions_token_idx on user_sessions (token);
create index if not exists user_sessions_user_idx on user_sessions (user_id);

-- ---------- supplier products & services ----------
create table if not exists supplier_products (
  id             bigserial primary key,
  supplier_id    bigint not null references participants (id) on delete cascade,
  title          text not null,
  description    text,
  category       text,
  price          numeric(14,2),
  unit           text,
  quantity_stock numeric(14,2) default 0,
  min_order      numeric(14,2) default 1,
  available      boolean not null default true,
  location       text,
  district       text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists supplier_products_supplier_idx on supplier_products (supplier_id);
create index if not exists supplier_products_category_idx on supplier_products (category);
create index if not exists supplier_products_available_idx on supplier_products (available);

-- ---------- purchase order tracking ----------
create table if not exists purchase_orders (
  id              bigserial primary key,
  supplier_id     bigint not null references participants (id) on delete cascade,
  product_id      bigint references supplier_products (id) on delete set null,
  quantity        numeric(14,2) not null default 0,
  unit_price      numeric(14,2) not null default 0,
  total           numeric(14,2) not null default 0,
  status          text not null default 'pending' check (status in ('pending','confirmed','shipped','delivered','cancelled')),
  ordered_at      timestamptz not null default now(),
  delivered_at    timestamptz,
  notes           text
);
create index if not exists purchase_orders_supplier_idx on purchase_orders (supplier_id);
create index if not exists purchase_orders_product_idx on purchase_orders (product_id);
create index if not exists purchase_orders_status_idx on purchase_orders (status);

-- ---------- low-stock alerts config ----------
create table if not exists low_stock_alerts (
  id              bigserial primary key,
  supplier_id     bigint not null references participants (id) on delete cascade,
  product_id      bigint references supplier_products (id) on delete set null,
  threshold       numeric(14,2) not null default 10,
  active          boolean not null default true
);
create index if not exists low_stock_alerts_supplier_idx on low_stock_alerts (supplier_id);
create index if not exists low_stock_alerts_product_idx on low_stock_alerts (product_id);

-- ---------- inventory summaries view ----------
create or replace view inventory_summary as
select
  sp.id as product_id,
  sp.title as product_title,
  sp.category,
  sp.supplier_id,
  p.name as supplier_name,
  sp.quantity_stock as current_stock,
  coalesce(po.ordered_qty,0) as on_order,
  (sp.quantity_stock - coalesce(po.ordered_qty,0)) as available_stock,
  case when (sp.quantity_stock - coalesce(po.ordered_qty,0)) < 5 then 'low' else 'ok' end as stock_status
from supplier_products sp
join participants p on p.id = sp.supplier_id
left join (
  select product_id, sum(quantity) as ordered_qty from purchase_orders where status in ('pending','confirmed','shipped') group by product_id
) po on po.product_id = sp.id;

-- ---------- demand log stock linkage ----------
-- ---------- visitor request / demand stock linkage ----------
-- Code references visitor_requests_stock; this is the canonical name.
create table if not exists visitor_requests_stock (
  id             bigserial primary key,
  product_id     bigint references supplier_products (id) on delete set null,
  submission_id  bigint references submissions (id) on delete set null,
  quantity       numeric(14,2) not null default 0,
  status         text not null default 'pending'
                 check (status in ('pending','fulfilled','cancelled')),
  created_at     timestamptz not null default now()
);
create index if not exists visitor_requests_stock_product_idx on visitor_requests_stock (product_id);
create index if not exists visitor_requests_stock_status_idx  on visitor_requests_stock (status);

-- ---------- education topics & notes ----------
create table if not exists education_topics (
  id          bigserial primary key,
  subject_id  bigint not null references subjects (id) on delete cascade,
  code        text not null,
  title       text not null,
  summary     text,
  level       text not null default 'foundation',
  sort_order  integer not null default 0,
  active      boolean not null default true,
  unique (subject_id, code)
);
create index if not exists education_topics_subject_idx on education_topics (subject_id);

create table if not exists education_notes (
  id           bigserial primary key,
  topic_id     bigint not null references education_topics (id) on delete cascade,
  title        text not null,
  content      text not null,
  locale       text not null default 'en',
  presentation boolean not null default false,
  format       text not null default 'text'
               check (format in ('text','markdown','html','luganda')),
  price_ugx    numeric(14,2) not null default 5000,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists education_notes_topic_idx on education_notes (topic_id);
create index if not exists education_notes_locale_idx on education_notes (locale);

create table if not exists education_presentations (
  id           bigserial primary key,
  note_id      bigint not null references education_notes (id) on delete cascade,
  title        text not null,
  slides       jsonb not null default '[]'::jsonb,
  locale       text not null default 'lug',
  price_ugx    numeric(14,2) not null default 5000,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists education_presentations_note_idx on education_presentations (note_id);

create table if not exists education_shares (
  id           bigserial primary key,
  note_id      bigint not null references education_notes (id) on delete cascade,
  participant_id bigint references participants (id) on delete set null,
  amount_ugx   numeric(14,2) not null default 5000,
  shared_at    timestamptz not null default now()
);
create index if not exists education_shares_participant_idx on education_shares (participant_id);
create index if not exists education_shares_note_idx on education_shares (note_id);

-- ---------- SACCO transactions ----------
create table if not exists sacco_members (
  id          bigserial primary key,
  user_id     bigint not null references participants (id) on delete cascade,
  member_no   text unique not null,
  shares      numeric(14,2) not null default 0,
  savings     numeric(14,2) not null default 0,
  status      text not null default 'active'
              check (status in ('active','suspended','closed')),
  joined_at   timestamptz not null default now()
);
create index if not exists sacco_members_user_idx on sacco_members (user_id);
create index if not exists sacco_members_no_idx on sacco_members (member_no);

create table if not exists sacco_transactions (
  id           bigserial primary key,
  member_id    bigint not null references sacco_members (id) on delete cascade,
  type         text not null check (type in ('deposit','withdrawal','payout','credit','repayment','share_purchase')),
  amount       numeric(14,2) not null,
  balance_after numeric(14,2) not null,
  reference    text,
  narr         text,
  created_by   bigint references participants (id),
  created_at   timestamptz not null default now()
);
create index if not exists sacco_transactions_member_idx on sacco_transactions (member_id);
create index if not exists sacco_transactions_type_idx on sacco_transactions (type);

create table if not exists sacco_creditors (
  id           bigserial primary key,
  member_id    bigint not null references sacco_members (id) on delete cascade,
  creditor_name text not null,
  creditor_phone text,
  amount       numeric(14,2) not null,
  status       text not null default 'outstanding'
               check (status in ('outstanding','paid','defaulted')),
  created_at   timestamptz not null default now()
);
create index if not exists sacco_creditors_member_idx on sacco_creditors (member_id);

create table if not exists sacco_guarantors (
  id           bigserial primary key,
  member_id    bigint not null references sacco_members (id) on delete cascade,
  guarantor_id bigint not null references sacco_members (id),
  amount       numeric(14,2) not null,
  relationship text,
  status       text not null default 'active'
               check (status in ('active','released')),
  created_at   timestamptz not null default now()
);
create index if not exists sacco_guarantors_member_idx on sacco_guarantors (member_id);

-- ---------- Farm-Aid governance roles ----------
create table if not exists farm_aid_roles (
  id          bigserial primary key,
  user_id     bigint not null references participants (id) on delete cascade,
  role_code   text not null
              check (role_code in ('clerk','verifier','aggregator','courier','registrar','commissioner','committee')),
  compartment text not null check (compartment in ('busolya','butaka')),
  location_level text not null check (location_level in ('lunyiriri','village','mutuba','parish','ssiga','ssaza')),
  location_name text not null,
  district    text,
  active      boolean not null default true,
  appointed_at timestamptz not null default now()
);
create index if not exists farm_aid_roles_user_idx on farm_aid_roles (user_id);
create index if not exists farm_aid_roles_role_idx on farm_aid_roles (role_code);
create index if not exists farm_aid_roles_location_idx on farm_aid_roles (location_level, location_name);

create table if not exists farm_aid_reports (
  id          bigserial primary key,
  reporter_id bigint not null references participants (id) on delete cascade,
  report_type text not null check (report_type in ('land_register','transaction','inventory','payment','dispute','verification','quality')),
  compartment text not null check (compartment in ('busolya','butaka')),
  ssaza       text,
  ssiga       text,
  mutuba      text,
  parish      text,
  village     text,
  clan_name   text,
  content     jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  status      text not null default 'pending'
              check (status in ('pending','reviewed','cleared','disputed'))
);
create index if not exists farm_aid_reports_reporter_idx on farm_aid_reports (reporter_id);
create index if not exists farm_aid_reports_location_idx on farm_aid_reports (ssaza, ssiga, mutuba, parish, village);
create index if not exists farm_aid_reports_status_idx on farm_aid_reports (status);

-- ---------- supplier directory link ----------
create table if not exists supplier_directory_link (
  id              bigserial primary key,
  supplier_id     bigint not null references participants (id) on delete cascade,
  directory_entry_id bigint references directory_entries (id) on delete set null,
  linked_at       timestamptz not null default now()
);
create index if not exists supplier_directory_link_supplier_idx on supplier_directory_link (supplier_id);

-- ---------- participants: phone-as-password + phone_verified columns ----------
ALTER TABLE participants ADD COLUMN password_is_phone boolean not null default true;
ALTER TABLE participants ADD COLUMN phone_verified boolean not null default false;

-- ---------- supplier_media: blobs/images/audio/video per supplier ----------
create table if not exists supplier_media (
  id              bigserial primary key,
  supplier_id     bigint not null references participants (id) on delete cascade,
  media_type      text not null check (media_type in ('image','audio','video','document','blob')),
  title           text,
  description     text,
  filename        text not null,
  mime_type       text,
  size_bytes      bigint,
  storage_path    text not null,   -- relative path under uploads/ dir (local) or object key (cloud)
  storage_url     text,            -- public URL once available
  product_id      bigint references supplier_products (id) on delete set null,
  status          text not null default 'active' check (status in ('active','deleted','pending')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists supplier_media_supplier_idx on supplier_media (supplier_id);
create index if not exists supplier_media_product_idx  on supplier_media (product_id);
create index if not exists supplier_media_type_idx     on supplier_media (media_type);

-- ---------- product & service exchange thread (comments, owner-moderated) ----------
create table if not exists product_comments (
  id           bigserial primary key,
  product_id   bigint references supplier_products (id) on delete cascade,
  supplier_id  bigint not null references participants (id) on delete cascade,
  user_id      bigint references participants (id) on delete set null,
  author_name  text not null,
  author_phone text not null,
  title        text,
  body         text not null,
  verdict      text not null default 'positive' check (verdict in ('positive','suggestion','complaint','question')),
  status       text not null default 'visible' check (status in ('visible','hidden')),
  hidden_by    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists product_comments_product_idx  on product_comments (product_id);
create index if not exists product_comments_supplier_idx on product_comments (supplier_id);
create index if not exists product_comments_status_idx   on product_comments (status);

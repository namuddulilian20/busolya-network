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
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'suppliers' AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE suppliers ADD COLUMN password_hash text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'suppliers' AND column_name = 'email'
  ) THEN
    ALTER TABLE suppliers ADD COLUMN email text;
  END IF;
END $$;

create table if not exists participants (
  id          bigserial primary key,
  phone       text unique not null,
  name        text,
  role        text not null default 'customer'
              check (role in ('supplier','member','customer','employee')),
  district    text,
  org         text,
  password_hash text,
  created_at  timestamptz not null default now()
);
create index if not exists participants_phone_idx on participants (phone);

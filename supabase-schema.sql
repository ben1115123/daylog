-- Run this in Supabase Dashboard → SQL Editor
-- (Re-running is safe — all statements use IF NOT EXISTS / OR REPLACE)

-- ── Grant anon access (required for PostgREST / anon key) ──
grant usage on schema public to anon, authenticated;

create table if not exists recurring_expenses (
  id           uuid primary key default gen_random_uuid(),
  description  text not null,
  amount       numeric not null,
  category     text not null,
  day_of_month integer not null,
  active       boolean default true,
  created_at   timestamptz default now()
);

create table if not exists expenses (
  id          uuid primary key default gen_random_uuid(),
  description text,
  amount      numeric,
  category    text,
  date        text,
  notes       text,
  created_at  timestamptz default now()
);
alter table expenses add column if not exists notes text;

create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  title       text,
  date        text,
  time        text,
  category    text,
  notes       text,
  recurring   text,
  created_at  timestamptz default now()
);
alter table events add column if not exists end_date date;
alter table events add column if not exists reminder_minutes integer;
alter table events add column if not exists apple_uid text;
-- Last Apple Calendar sync failure for this event; null once it syncs cleanly.
alter table events add column if not exists apple_sync_error text;

create table if not exists income (
  id          uuid primary key default gen_random_uuid(),
  description text not null,
  amount      numeric not null,
  category    text not null,
  date        date not null,
  notes       text,
  created_at  timestamptz default now()
);
alter table income add column if not exists notes text;

create table if not exists recurring_income (
  id           uuid primary key default gen_random_uuid(),
  description  text not null,
  amount       numeric not null,
  category     text not null,
  day_of_month integer not null,
  active       boolean default true,
  created_at   timestamptz default now()
);

-- app_state: small key/value store for app-wide flags (onboarding, seed flags)
-- shared across all dev ports/origins, unlike localStorage
create table if not exists app_state (
  key   text primary key,
  value text
);

-- ── Table-level grants ──────────────────────────────────
grant all on expenses           to anon, authenticated;
grant all on events             to anon, authenticated;
grant all on recurring_expenses to anon, authenticated;
grant all on income             to anon, authenticated;
grant all on recurring_income   to anon, authenticated;
grant all on app_state           to anon, authenticated;

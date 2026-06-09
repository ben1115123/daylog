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
  created_at  timestamptz default now()
);

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

create table if not exists income (
  id          uuid primary key default gen_random_uuid(),
  description text not null,
  amount      numeric not null,
  category    text not null,
  date        date not null,
  created_at  timestamptz default now()
);

create table if not exists recurring_income (
  id           uuid primary key default gen_random_uuid(),
  description  text not null,
  amount       numeric not null,
  category     text not null,
  day_of_month integer not null,
  active       boolean default true,
  created_at   timestamptz default now()
);

-- ── Table-level grants ──────────────────────────────────
grant all on expenses           to anon, authenticated;
grant all on events             to anon, authenticated;
grant all on recurring_expenses to anon, authenticated;
grant all on income             to anon, authenticated;
grant all on recurring_income   to anon, authenticated;

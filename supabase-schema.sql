-- Run this in Supabase Dashboard → SQL Editor

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

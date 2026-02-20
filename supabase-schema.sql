-- Basic Supabase schema for Void Website Bot
-- Run this in Supabase SQL editor for your project.

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  game text,
  region text,
  description text,
  logo_url text,
  created_at timestamp with time zone default now()
);

create table if not exists pros (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete set null,
  name text not null,
  role text,
  game text,
  bio text,
  image_url text,
  twitter text,
  twitch text,
  youtube text,
  instagram text,
  stats jsonb,        -- e.g. [{ "label": "HS%", "value": "30%" }]
  achievements text[], -- array of strings
  created_at timestamp with time zone default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2) not null default 0,
  currency text not null default 'USD',
  category text,
  description text,
  product_url text,
  image_url text,
  created_at timestamp with time zone default now()
);

create table if not exists news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  url text,
  image_url text,
  published_at timestamp with time zone default now()
);

create table if not exists videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  platform text, -- e.g. 'YouTube', 'Twitch'
  url text,
  thumbnail_url text,
  published_at timestamp with time zone default now()
);

create table if not exists placements (
  id uuid primary key default gen_random_uuid(),
  game text,
  tournament text not null,
  team_name text,
  position text,
  prize text,
  event_date date,
  created_at timestamp with time zone default now()
);


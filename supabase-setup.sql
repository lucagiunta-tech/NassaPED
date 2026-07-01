-- Run this ONCE in your Supabase SQL editor
-- https://supabase.com/dashboard/project/eusxreazwqmwtsdbhhjr/sql

-- 1. Create users table
create table if not exists nassa_users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  role text not null default 'member', -- 'admin' or 'member'
  created_at timestamptz default now()
);

-- 2. Disable RLS (table is only accessed server-side via service key)
alter table nassa_users disable row level security;

-- 3. Insert initial users (hashed passwords — never plain text)
insert into nassa_users (username, password_hash, role) values
  ('luca',    '$2b$12$4HQJufudVGL3TCPxgGjzFeJGLp1dYjcCsaDJYQZBX0lqs9/dQqqVW', 'admin'),
  ('alberto', '$2b$12$5POQjgM9COcmz4Ce4jaAcutil8mg4lq8ESo0/.MwNPvAlko4P6f.a', 'member'),
  ('nassa',   '$2b$12$Aeog9zRQ/I2/FRf0BchkQu6ZsICiGmtAGp72Ort1jeKXwYjslLNTe', 'admin')
on conflict (username) do nothing;

-- 4. Planning home hub (nassa_planning)
create table if not exists nassa_planning (
  user_id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
alter table nassa_planning disable row level security;


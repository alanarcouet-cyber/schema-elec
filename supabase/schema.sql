-- Run this in the Supabase SQL editor after creating your project

create table if not exists schemas (
  id          uuid        primary key default gen_random_uuid(),
  title       text        not null default 'Nouveau schéma',
  owner_id    uuid        references auth.users(id) on delete cascade,
  data        jsonb       not null default '{"elements":[],"cables":[]}',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table schemas enable row level security;

create policy "owner full access"
  on schemas for all
  using  (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Enable Realtime for co-editing
alter publication supabase_realtime add table schemas;


-- ── Shared symbol library ──────────────────────────────────────────────────
-- All authenticated users can read; authenticated users can write.
-- Requires a Supabase Storage bucket named "symbols" (set to public).

create table if not exists symbol_library (
  id           text        primary key,
  name         text        not null,
  png_url      text        not null,
  display_width  integer   default 80,
  display_height integer   default 80,
  type         text        default 'BT',       -- BT | HTA | POSTE
  label_prefix     text     default '',
  default_rotation integer  default 0,   -- 0 | 90 | 180 | 270
  bornes           jsonb    default '[]',
  sort_order   integer     default 0,
  created_by   uuid        references auth.users(id) on delete set null,
  created_at   timestamptz default now()
);

-- Migrations : ajouter les colonnes si la table existe déjà
alter table symbol_library add column if not exists label_prefix     text    default '';
alter table symbol_library add column if not exists default_rotation integer default 0;

alter table symbol_library enable row level security;

create policy "public read symbols"
  on symbol_library for select
  using (true);

create policy "auth insert symbols"
  on symbol_library for insert
  with check (auth.uid() is not null);

create policy "auth update symbols"
  on symbol_library for update
  using (auth.uid() is not null);

create policy "auth delete symbols"
  on symbol_library for delete
  using (auth.uid() is not null);

-- Storage bucket (run in SQL editor or create via Supabase dashboard):
-- insert into storage.buckets (id, name, public) values ('symbols', 'symbols', true)
-- on conflict do nothing;
--
-- create policy "public read bucket" on storage.objects for select using (bucket_id = 'symbols');
-- create policy "auth upload bucket" on storage.objects for insert with check (bucket_id = 'symbols' and auth.uid() is not null);
-- create policy "auth delete bucket" on storage.objects for delete using (bucket_id = 'symbols' and auth.uid() is not null);

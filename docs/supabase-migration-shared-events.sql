-- Migration V31 : table agenda partagé Benoit <-> Anissa
-- À exécuter dans le SQL editor du dashboard Supabase (une seule fois).

create table if not exists public.shared_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  category text not null default 'perso', -- 'perso' | 'pro' | 'famille' | 'medical' | 'autre'
  location text,
  created_by text, -- 'benoit' | 'anissa' (libre, pour affichage)
  owner_id uuid,   -- auth.users(id) du créateur
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index pour les requêtes par plage de dates
create index if not exists shared_events_start_at_idx on public.shared_events (start_at);

-- RLS : les deux comptes (Benoit + Anissa) authentifiés peuvent tout lire/écrire
alter table public.shared_events enable row level security;

drop policy if exists shared_events_read on public.shared_events;
create policy shared_events_read
  on public.shared_events for select
  using (auth.role() = 'authenticated');

drop policy if exists shared_events_insert on public.shared_events;
create policy shared_events_insert
  on public.shared_events for insert
  with check (auth.role() = 'authenticated');

drop policy if exists shared_events_update on public.shared_events;
create policy shared_events_update
  on public.shared_events for update
  using (auth.role() = 'authenticated');

drop policy if exists shared_events_delete on public.shared_events;
create policy shared_events_delete
  on public.shared_events for delete
  using (auth.role() = 'authenticated');

-- Trigger auto updated_at
create or replace function public.set_shared_events_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists shared_events_updated_at on public.shared_events;
create trigger shared_events_updated_at
  before update on public.shared_events
  for each row execute function public.set_shared_events_updated_at();

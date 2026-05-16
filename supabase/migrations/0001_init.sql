-- Kelo cloud schema. Run in Supabase Dashboard → SQL Editor.
-- Safe to re-run: uses `if not exists` and `create or replace`.

-- =========================================================
-- Extensions
-- =========================================================
create extension if not exists "pgcrypto";

-- =========================================================
-- Tables
-- =========================================================

-- categories: keep text PK so legacy ids like 'inbox' migrate cleanly
create table if not exists public.categories (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text,
  color text,
  pinned boolean not null default false,
  sort double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id text,
  text text not null default '',
  notes text,
  completed boolean not null default false,
  completed_at timestamptz,
  priority text not null default 'none',
  status text not null default 'todo',
  due_date timestamptz,
  recurrence text,
  tags text[] not null default '{}',
  links text[] not null default '{}',
  is_urgent boolean not null default false,
  focus_time int not null default 0,
  pomodoro_count int not null default 0,
  sort double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_user_sort_idx on public.tasks (user_id, sort);
create index if not exists tasks_user_completed_idx on public.tasks (user_id, completed);
create index if not exists tasks_user_due_idx on public.tasks (user_id, due_date);
create index if not exists tasks_user_category_idx on public.tasks (user_id, category_id);

create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  content text,              -- long text without limits (TOAST handles big bodies)
  meta jsonb not null default '{}'::jsonb,
  media_path text,           -- path in storage bucket `media`
  completed boolean,         -- for checklist-style text blocks
  sort double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists blocks_task_sort_idx on public.blocks (task_id, sort);
create index if not exists blocks_user_idx on public.blocks (user_id);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  payload jsonb not null default '{}'::jsonb,
  sort double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid,
  snapshot jsonb not null,
  completed_at timestamptz not null default now()
);
create index if not exists history_user_completed_idx on public.history (user_id, completed_at desc);

create table if not exists public.pomodoro_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid,
  kind text,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_sec int
);
create index if not exists pomodoro_user_started_idx on public.pomodoro_sessions (user_id, started_at desc);

create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- =========================================================
-- updated_at trigger
-- =========================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['categories','tasks','blocks','templates','settings']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- =========================================================
-- RLS
-- =========================================================
alter table public.categories         enable row level security;
alter table public.tasks              enable row level security;
alter table public.blocks             enable row level security;
alter table public.templates          enable row level security;
alter table public.history            enable row level security;
alter table public.pomodoro_sessions  enable row level security;
alter table public.settings           enable row level security;

do $$
declare
  t text;
  policy_sql text;
begin
  foreach t in array array['categories','tasks','blocks','templates','history','pomodoro_sessions','settings']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    policy_sql := format(
      'create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_own', t
    );
    execute policy_sql;
  end loop;
end $$;

-- =========================================================
-- RPC: duplicate task (server-side, atomic)
-- =========================================================
create or replace function public.duplicate_task(src uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare new_id uuid := gen_random_uuid();
begin
  insert into tasks (id, user_id, category_id, text, notes, priority, status,
                     due_date, recurrence, tags, links, is_urgent, sort)
  select new_id, user_id, category_id, text || ' (copy)', notes, priority, 'todo',
         due_date, recurrence, tags, links, is_urgent, sort + 0.0001
  from tasks where id = src and user_id = auth.uid();

  if not found then raise exception 'task not found or forbidden'; end if;

  insert into blocks (task_id, user_id, type, content, meta, media_path,
                      completed, sort)
  select new_id, user_id, type, content, meta, media_path,
         case when type = 'text' then false else completed end, sort
  from blocks where task_id = src and user_id = auth.uid();

  return new_id;
end $$;

grant execute on function public.duplicate_task(uuid) to authenticated;

-- =========================================================
-- Storage bucket: media (private)
-- =========================================================
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

-- Storage RLS: path must start with user's uuid folder
drop policy if exists "media_select_own" on storage.objects;
drop policy if exists "media_insert_own" on storage.objects;
drop policy if exists "media_update_own" on storage.objects;
drop policy if exists "media_delete_own" on storage.objects;

create policy "media_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "media_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "media_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "media_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

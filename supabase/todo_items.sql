create extension if not exists pgcrypto;

create table if not exists public.todo_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null check (char_length(trim(text)) > 0 and char_length(text) <= 240),
  link_url text check (link_url is null or char_length(link_url) <= 500),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.todo_items
  add column if not exists link_url text;

alter table public.todo_items
  add column if not exists completed_at timestamptz;

create index if not exists todo_items_user_id_created_at_idx
  on public.todo_items (user_id, created_at desc);

alter table public.todo_items enable row level security;

drop policy if exists "todo_items_select_own" on public.todo_items;
create policy "todo_items_select_own"
on public.todo_items
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "todo_items_insert_own" on public.todo_items;
create policy "todo_items_insert_own"
on public.todo_items
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "todo_items_delete_own" on public.todo_items;
create policy "todo_items_delete_own"
on public.todo_items
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "todo_items_update_own" on public.todo_items;
create policy "todo_items_update_own"
on public.todo_items
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

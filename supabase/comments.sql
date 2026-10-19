create table if not exists public.comments (
  id bigint generated always as identity primary key,
  content text not null check (char_length(trim(content)) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.comments enable row level security;

revoke all on public.comments from anon, authenticated;
grant select, insert on public.comments to anon, authenticated;

drop policy if exists "Comments are visible to everyone" on public.comments;
create policy "Comments are visible to everyone"
  on public.comments
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Visitors can post comments" on public.comments;
create policy "Visitors can post comments"
  on public.comments
  for insert
  to anon, authenticated
  with check (char_length(trim(content)) between 1 and 500);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'comments'
  ) then
    execute 'alter publication supabase_realtime add table public.comments';
  end if;
end
$$;

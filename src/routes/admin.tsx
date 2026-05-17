create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid,
  reported_user_id uuid,
  message_type text,
  message_id text,
  reason text,
  message_content text,
  status text default 'open',
  created_at timestamptz default now()
);

alter table public.message_reports
add column if not exists reporter_id uuid,
add column if not exists reported_user_id uuid,
add column if not exists message_type text,
add column if not exists message_id text,
add column if not exists reason text,
add column if not exists message_content text,
add column if not exists status text default 'open',
add column if not exists created_at timestamptz default now();

alter table public.message_reports disable row level security;

grant all on table public.message_reports to anon;
grant all on table public.message_reports to authenticated;
grant all on table public.message_reports to service_role;

notify pgrst, 'reload schema';

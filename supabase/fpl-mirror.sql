-- Our copy of the FPL data the pages use (lib/fpl-mirror.ts), kept current by /api/fpl-sync,
-- which cron-jobs.org calls every minute. Run once in the Supabase dashboard (SQL Editor).
-- Re-running is safe.
create table if not exists public.fpl_mirror (
  key text primary key,
  data jsonb not null,
  fetched_at timestamptz not null default now()
);

-- Anyone may read it (pages use the public key); only the server's service key can write.
alter table public.fpl_mirror enable row level security;
drop policy if exists "Public read" on public.fpl_mirror;
create policy "Public read" on public.fpl_mirror for select to anon, authenticated using (true);

-- Supabase stopped granting API access to new tables automatically on 30 October 2026.
grant select on public.fpl_mirror to anon, authenticated;
grant select, insert, update, delete on public.fpl_mirror to service_role;

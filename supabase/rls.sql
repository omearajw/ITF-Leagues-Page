-- Row level security for every table. Run once in the Supabase dashboard (SQL Editor, paste, Run)
-- AFTER the site's admin and editor saves use the service key (they do from commit "Save admin and
-- editor changes through the service key"), or those saves would start failing.
--
-- The public (anon) key, which is built into the site, can then only READ the tables the site
-- shows. Nothing can be inserted, changed or deleted with it. Writes come only from the site's
-- server using the service role key, which bypasses RLS: the ingest job, admin, editor and the
-- feedback form.

alter table public.champions_league_config   enable row level security;
alter table public.champions_league_entrants enable row level security;
alter table public.eliminator_config         enable row level security;
alter table public.eliminator_status         enable row level security;
alter table public.gameweeks                 enable row level security;
alter table public.h2h_fixtures              enable row level security;
alter table public.historical_awards         enable row level security;
alter table public.manager_gw_scores         enable row level security;
alter table public.managers                  enable row level security;
alter table public.onion_baggers_config      enable row level security;
alter table public.onion_baggers_entrants    enable row level security;
alter table public.page_content              enable row level security;
alter table public.season_managers           enable row level security;
alter table public.seasons                   enable row level security;
alter table public.tournament_fixtures       enable row level security;
-- feedback already has RLS with no policies (server only), from supabase/feedback.sql.
alter table public.feedback                  enable row level security;

-- Read-only access for everyone to the tables the public site shows. (No policy is added for
-- feedback, so it stays server only.) Re-running is safe: each policy is dropped first.
do $$
declare t text;
begin
  foreach t in array array[
    'champions_league_config', 'champions_league_entrants', 'eliminator_config', 'eliminator_status',
    'gameweeks', 'h2h_fixtures', 'historical_awards', 'manager_gw_scores', 'managers',
    'onion_baggers_config', 'onion_baggers_entrants', 'page_content', 'season_managers', 'seasons',
    'tournament_fixtures'
  ] loop
    execute format('drop policy if exists "Public read" on public.%I', t);
    execute format('create policy "Public read" on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

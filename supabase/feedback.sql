-- Feedback sent from the site's feedback form (footer and phone menu).
-- Run once in the Supabase dashboard: SQL Editor, paste this, Run.
create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  manager_name text check (char_length(manager_name) <= 120),
  email text check (char_length(email) <= 200),
  kind text not null check (kind in ('bug', 'feedback_good', 'feedback_bad', 'idea_site', 'idea_game')),
  rating smallint check (rating between 1 and 5),
  details text not null check (char_length(details) between 1 and 4000),
  page text check (char_length(page) <= 300),
  read_at timestamptz
);

-- Row level security on, with no policies: the public keys can neither read nor write this table.
-- Only the site's server (using the service role key) saves and lists feedback.
alter table public.feedback enable row level security;

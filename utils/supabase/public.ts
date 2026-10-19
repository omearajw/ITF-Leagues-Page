import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Read-only client for the public site's data, with no visitor session. Cached code ('use cache')
// cannot read cookies, which the session client in ./server does, so every cached read uses this.
// Row level security lets the public key read the tables the site shows (supabase/rls.sql).
let client: SupabaseClient | null = null;

export function createPublicClient() {
  client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

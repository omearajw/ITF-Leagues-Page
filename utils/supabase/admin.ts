import { createClient } from '@supabase/supabase-js';

// Server-only client using the service role key, which bypasses row level security. Only import
// it from server components and server actions, never from client code.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

import { createAdminClient } from '@/utils/supabase/admin';
import type { FeedbackKind } from '@/lib/feedback';

export type FeedbackRow = {
  id: number; created_at: string; manager_name: string | null; email: string | null;
  kind: FeedbackKind; rating: number | null; details: string; page: string | null; read_at: string | null;
};

// Both return empty (rather than throwing) until supabase/feedback.sql has been run.
export async function getUnreadFeedbackCount(): Promise<number> {
  const { count, error } = await createAdminClient().from('feedback').select('id', { count: 'exact', head: true }).is('read_at', null);
  return error ? 0 : count ?? 0;
}

export async function getFeedback(): Promise<{ rows: FeedbackRow[]; missing: boolean }> {
  const { data, error } = await createAdminClient().from('feedback').select('*').order('created_at', { ascending: false }).limit(200);
  return error ? { rows: [], missing: true } : { rows: (data || []) as FeedbackRow[], missing: false };
}

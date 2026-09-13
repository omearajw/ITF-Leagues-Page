import { cache } from 'react';
import { createClient } from '@/utils/supabase/server';

// The ingest records when it last ran. Stored as a reserved page_content row because the
// schema has no timestamp column yet; swap the read/write here if one is added.
export const SYNC_ROW = { id: 'sync-status', gw_number: 0, title: 'Last ingest' };

export const getLastSyncedAt = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from('page_content').select('content').eq('id', SYNC_ROW.id).eq('gw_number', SYNC_ROW.gw_number).maybeSingle();
  return data?.content || null;
});

export function describeAgo(iso: string | null, now = Date.now()): string | null {
  if (!iso) return null;
  const mins = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

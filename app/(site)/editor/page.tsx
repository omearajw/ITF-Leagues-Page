import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import EditorBoard, { type EditorItem } from '@/components/EditorBoard';
import { Suspense } from 'react';
import { EditorSkeleton } from '@/components/Skeletons';
import GameweekBadge from '@/components/GameweekBadge';
import { getGameweekStatus } from '@/lib/gameweek-status';

export default async function EditorPage({ searchParams }: { searchParams: Promise<{ gw?: string }> }) {
  const { gw } = await searchParams;
  const requestedGw = gw ? parseInt(gw, 10) : NaN;

  return (
    <div className="max-w-5xl mx-auto py-8">
      <header className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-bold text-ink">Content Editor</h1>
        <p className="text-dim">Update weekly write-ups and snippets displayed across the ITF Hub.</p>
      </header>

      <Suspense fallback={<EditorSkeleton />}>
        <EditorContent requestedGw={Number.isFinite(requestedGw) ? requestedGw : null} />
      </Suspense>
    </div>
  );
}

async function EditorContent({ requestedGw }: { requestedGw: number | null }) {
  const supabase = await createClient();

  // 1. Write-ups default to the last synced (completed) gameweek; earlier weeks stay editable.
  const gw = await getGameweekStatus();
  const latestGw = Math.max(1, gw.syncedThroughGw);
  const currentGw = requestedGw && requestedGw >= 1 && requestedGw <= latestGw ? requestedGw : latestGw;
  const editableWeeks = Array.from({ length: latestGw }, (_, i) => latestGw - i);

  // 2. Define the pages/leagues managed by the CMS
  const managedPages = [
    { id: 'premier-league', title: 'Premier League' },
    { id: 'championship', title: 'Championship' },
    { id: 'league-one', title: 'League One' },
    { id: 'champions-league', title: 'Champions League' },
    { id: 'onion-baggers-cup', title: 'Onion Baggers Cup' },
    { id: 'eliminator', title: 'Eliminator' },
    { id: 'team-of-the-week', title: 'Team of the Week' },
  ];

  // 3. Published write-ups for the week, and any drafts. Drafts are only readable with the service
  // key (page_content_drafts has no public access); this page is staff-only (proxy.ts).
  const [{ data: published }, { data: drafts }] = await Promise.all([
    supabase.from('page_content').select('id, content, updated_at').eq('gw_number', currentGw),
    createAdminClient().from('page_content_drafts').select('id, content, updated_at').eq('gw_number', currentGw),
  ]);
  const items: EditorItem[] = managedPages.map(page => {
    const live = published?.find(p => p.id === page.id);
    const draft = drafts?.find(d => d.id === page.id);
    return {
      id: page.id, title: page.title,
      published: live?.content ?? null, publishedAt: live?.updated_at ?? null,
      draft: draft?.content ?? null, draftAt: draft?.updated_at ?? null,
    };
  });

  return (
    <div>
      <div className="mb-6 bg-brand-2/10 border border-brand-2/30 p-4 rounded-xl flex flex-wrap gap-3 justify-between items-center">
        <form method="get" className="flex items-center gap-2 font-bold text-brand-2">
          <label htmlFor="gw-select">Editing write-ups for</label>
          <select id="gw-select" name="gw" defaultValue={currentGw} className="border border-brand-2/30 rounded px-2 py-1 bg-surface text-sm">
            {editableWeeks.map(week => <option key={week} value={week}>Gameweek {week}{week === latestGw ? ' (latest)' : ''}</option>)}
          </select>
          <button type="submit" className="text-xs bg-brand text-white px-2.5 py-1.5 rounded hover:bg-brand/90 whitespace-nowrap">Go</button>
        </form>
        <GameweekBadge provisional={!!gw.liveGw}>
          {gw.liveGw ? `GW${gw.liveGw} in progress · latest completed GW${latestGw}` : `Latest completed GW${latestGw}`}
        </GameweekBadge>
        <p className="w-full text-xs text-brand-2/70">
          Pages always show the most recent published write-up, so a week never goes blank: the current text stays until a newer week is published.
        </p>
      </div>

      {/* Keyed by week, so switching weeks starts the board afresh. */}
      <EditorBoard key={currentGw} gw={currentGw} items={items} />
    </div>
  );
}
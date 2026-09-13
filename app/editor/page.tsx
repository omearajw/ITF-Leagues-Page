import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import SaveToast from '@/components/SaveToast';
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { EditorSkeleton } from '@/components/Skeletons';
import GameweekBadge from '@/components/GameweekBadge';
import { getGameweekStatus } from '@/lib/gameweek-status';

export default async function EditorPage({ searchParams }: { searchParams: Promise<{ saved?: string; gw?: string }> }) {
  const { saved, gw } = await searchParams;
  const requestedGw = gw ? parseInt(gw, 10) : NaN;

  return (
    <div className="max-w-5xl mx-auto py-8">
      {saved && <SaveToast message={`Write-up saved (${saved})`} />}
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
  ];

  // 3. Fetch existing content for the current gameweek
  const { data: existingContent } = await supabase
    .from('page_content')
    .select('*')
    .eq('gw_number', currentGw);

  const contentMap: Record<string, any> = {};
  existingContent?.forEach((item) => {
    contentMap[item.id] = item;
  });

  // 4. Server Action to Upsert Weekly Content
  async function updateSnippet(formData: FormData) {
    'use server';
    
    const id = formData.get('id') as string;
    const title = formData.get('title') as string;
    const content = formData.get('content') as string;
    const gwNumber = parseInt(formData.get('gw_number') as string);
    
    const supabaseClient = await createClient();
    
    const { error: upsertError } = await supabaseClient
      .from('page_content')
      .upsert({ 
        id, 
        gw_number: gwNumber,
        title,
        content, 
        updated_at: new Date().toISOString() 
      }, { onConflict: 'id,gw_number' });

    if (upsertError) {
      console.error('Failed to update:', upsertError);
    }

    revalidatePath('/editor');
    revalidatePath('/');
    redirect(`/editor?gw=${gwNumber}&saved=${encodeURIComponent(title)}`);
  }

  return (
    <div>
      <div className="mb-6 bg-brand-2/10 border border-brand-2/30 p-4 rounded-xl flex flex-wrap gap-3 justify-between items-center">
        <form method="get" className="flex items-center gap-2 font-bold text-brand-2">
          <label htmlFor="gw-select">Editing write-ups for</label>
          <select id="gw-select" name="gw" defaultValue={currentGw} className="border border-brand-2/30 rounded px-2 py-1 bg-surface text-sm">
            {editableWeeks.map(week => <option key={week} value={week}>Gameweek {week}{week === latestGw ? ' (latest)' : ''}</option>)}
          </select>
          <button type="submit" className="text-xs bg-brand text-white px-2.5 py-1.5 rounded hover:bg-brand/90">Go</button>
        </form>
        <GameweekBadge provisional={!!gw.liveGw}>
          {gw.liveGw ? `GW${gw.liveGw} in progress · latest completed GW${latestGw}` : `Latest completed GW${latestGw}`}
        </GameweekBadge>
        <p className="w-full text-xs text-brand-2/70">
          Pages always show the most recent saved write-up, so a week never goes blank: the current text stays until a newer week is saved.
          Line breaks are kept.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {managedPages.map((page) => {
          const entry = contentMap[page.id];

          return (
            <div key={page.id} className="bg-surface p-6 rounded-xl border shadow-sm flex flex-col">
              <h2 className="text-lg font-bold text-ink mb-1">{page.title}</h2>
              <p className="text-xs text-faint mb-4">
                {entry ? `Last updated: ${new Date(entry.updated_at).toLocaleDateString()}` : 'No write-up for this week yet'}
              </p>
              
              <form action={updateSnippet} className="flex flex-col flex-grow">
                <input type="hidden" name="id" value={page.id} />
                <input type="hidden" name="title" value={page.title} />
                <input type="hidden" name="gw_number" value={currentGw} />
                
                <textarea 
                  name="content"
                  defaultValue={entry?.content || ''}
                  className="w-full h-32 p-3 border rounded-lg bg-surface-2 focus:ring-2 focus:ring-brand-2 focus:outline-none resize-none text-sm mb-4"
                  placeholder={`Write the summary for Gameweek ${currentGw}...`}
                  required
                />
                
                <button 
                  type="submit"
                  className="mt-auto bg-panel text-white py-2 px-4 rounded-lg font-medium hover:bg-surface-2 transition"
                >
                  Save GW{currentGw} Write-Up
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
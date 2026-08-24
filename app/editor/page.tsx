import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function EditorPage() {

  return (
    <div className="max-w-5xl mx-auto py-8">
      <header className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-bold text-slate-900">Content Editor</h1>
        <p className="text-slate-500">Update weekly write-ups and snippets displayed across the ITF Hub.</p>
      </header>

      <Suspense fallback={<div className="p-10 text-center text-slate-500 font-bold animate-pulse">Loading Editor...</div>}>
        <EditorContent />
      </Suspense>
    </div>
  );
}

async function EditorContent() {
  const supabase = await createClient();
  const SEASON_ID = '2026-27';

  // 1. Get the current active Gameweek
  const { data: latestGwData } = await supabase
    .from('gameweeks')
    .select('gw_number')
    .eq('season_id', SEASON_ID)
    .eq('is_finished', true) // <-- ADD THIS LINE
    .order('gw_number', { ascending: false })
    .limit(1)
    .single();

  const currentGw = latestGwData ? latestGwData.gw_number : 1;

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
  }

  return (
    <div>
      <div className="mb-6 bg-blue-50 border border-blue-200 p-4 rounded-xl flex justify-between items-center">
        <span className="font-bold text-blue-900">Editing Write-ups for Gameweek {currentGw}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {managedPages.map((page) => {
          const entry = contentMap[page.id];

          return (
            <div key={page.id} className="bg-white p-6 rounded-xl border shadow-sm flex flex-col">
              <h2 className="text-lg font-bold text-slate-800 mb-1">{page.title}</h2>
              <p className="text-xs text-slate-400 mb-4">
                {entry ? `Last updated: ${new Date(entry.updated_at).toLocaleDateString()}` : 'No write-up for this week yet'}
              </p>
              
              <form action={updateSnippet} className="flex flex-col flex-grow">
                <input type="hidden" name="id" value={page.id} />
                <input type="hidden" name="title" value={page.title} />
                <input type="hidden" name="gw_number" value={currentGw} />
                
                <textarea 
                  name="content"
                  defaultValue={entry?.content || ''}
                  className="w-full h-32 p-3 border rounded-lg bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none text-sm mb-4"
                  placeholder={`Write the summary for Gameweek ${currentGw}...`}
                  required
                />
                
                <button 
                  type="submit"
                  className="mt-auto bg-slate-900 text-white py-2 px-4 rounded-lg font-medium hover:bg-slate-800 transition"
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
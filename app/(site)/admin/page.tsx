import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import TeamName from '@/components/TeamName';
import { revalidatePath } from 'next/cache';
import SaveToast from '@/components/SaveToast';
import { Suspense } from 'react';
import { AdminSkeleton } from '@/components/Skeletons';
import GameweekBadge from '@/components/GameweekBadge';
import { getGameweekStatus } from '@/lib/gameweek-status';

// 1. FAST-LOADING SHELL
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const savedMessage = saved === 'timelines' ? 'Timelines saved' : saved === 'entrants' ? 'Champions League entrants saved' : null;

  return (
    <div className="max-w-5xl mx-auto py-8">
      {savedMessage && <SaveToast message={savedMessage} />}
      <header className="mb-8 border-b pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-ink">Tournament Administration</h1>
          <p className="text-dim">Configure start dates and manual entrants for the custom cups.</p>
        </div>
        <div className="text-sm font-bold text-dim bg-surface-3 px-3 py-1 rounded-full">
          Live Production
        </div>
      </header>

      <Suspense fallback={<AdminSkeleton />}>
        <AdminContent />
      </Suspense>
    </div>
  );
}

// 2. ASYNCHRONOUS DATA COMPONENT
async function AdminContent() {
  const supabase = await createClient();
  const SEASON_ID = '2026-27';

  const gw = await getGameweekStatus();
  const currentGw = gw.syncedThroughGw;
  // Lock against the live week too: once the ingest writes a GW, its start settings must not move.
  const lockGw = gw.displayGw;

  const { data: clConfig } = await supabase.from('champions_league_config').select('*').eq('season_id', SEASON_ID).single();
  const { data: obConfig } = await supabase.from('onion_baggers_config').select('*').eq('season_id', SEASON_ID).single();
  const { data: elConfig } = await supabase.from('eliminator_config').select('*').eq('season_id', SEASON_ID).single();
  const { data: allManagers } = await supabase.from('season_managers').select('manager_fpl_id, team_name').eq('season_id', SEASON_ID).order('team_name');
  const { data: clEntrants } = await supabase.from('champions_league_entrants').select('manager_fpl_id').eq('season_id', SEASON_ID);
  const currentEntrantIds = clEntrants?.map((e: any) => e.manager_fpl_id) || [];

  // LOCK LOGIC: If the current gameweek is greater than or equal to the start week, it locks.
  const isObQualifiersLocked = lockGw >= (obConfig?.qualifiers_start_gw || 99);
  const isObKnockoutLocked = lockGw >= (obConfig?.knockout_start_gw || 99);
  const isClStage1Locked = lockGw >= (clConfig?.stage_1_start_gw || 99);
  const isClStage2Locked = lockGw >= (clConfig?.stage_2_start_gw || 99);
  const isClFinalLocked = lockGw >= (clConfig?.final_start_gw || 99);
  const isEliminatorLocked = lockGw >= (elConfig?.start_gw || 99);

  // SERVER ACTIONS
  async function updateTimelines(formData: FormData) {
    'use server';
    const supabaseClient = await createClient();
    
    // We conditionally update to prevent bad data from being submitted if a user bypasses HTML disabled state
    const clUpdates: any = {};
    if (formData.get('cl_stage_1')) clUpdates.stage_1_start_gw = parseInt(formData.get('cl_stage_1') as string);
    if (formData.get('cl_stage_2')) clUpdates.stage_2_start_gw = parseInt(formData.get('cl_stage_2') as string);
    if (formData.get('cl_final')) clUpdates.final_start_gw = parseInt(formData.get('cl_final') as string);
    if (Object.keys(clUpdates).length > 0) await supabaseClient.from('champions_league_config').update(clUpdates).eq('season_id', SEASON_ID);

    const obUpdates: any = {};
    if (formData.get('ob_qualifiers')) obUpdates.qualifiers_start_gw = parseInt(formData.get('ob_qualifiers') as string);
    if (formData.get('ob_knockout')) obUpdates.knockout_start_gw = parseInt(formData.get('ob_knockout') as string);
    if (Object.keys(obUpdates).length > 0) await supabaseClient.from('onion_baggers_config').update(obUpdates).eq('season_id', SEASON_ID);

    if (formData.get('el_start')) {
      await supabaseClient.from('eliminator_config').update({
        start_gw: parseInt(formData.get('el_start') as string)
      }).eq('season_id', SEASON_ID);
    }
    
    revalidatePath('/admin');
    redirect('/admin?saved=timelines');
  }

  async function updateCLEntrants(formData: FormData) {
    'use server';
    const supabaseClient = await createClient();
    const selectedIds = formData.getAll('entrants').map(id => parseInt(id as string));
    await supabaseClient.from('champions_league_entrants').delete().eq('season_id', SEASON_ID);
    if (selectedIds.length > 0) {
      const inserts = selectedIds.map(id => ({ season_id: SEASON_ID, manager_fpl_id: id }));
      await supabaseClient.from('champions_league_entrants').insert(inserts);
    }
    revalidatePath('/admin');
    redirect('/admin?saved=entrants');
  }

  return (
    <>
      {/* SIMULATOR REMOVED */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* TIMELINES COLUMN */}
        <div className="bg-surface p-6 rounded-xl border shadow-sm">
          <div className="flex justify-between items-center mb-6 border-b pb-2">
            <h2 className="text-xl font-bold text-ink">Tournament Timelines</h2>
            <GameweekBadge provisional={!!gw.liveGw}>
              {gw.liveGw ? `GW${gw.liveGw} in progress · locks use GW${gw.liveGw}` : `Synced through GW${currentGw}`}
            </GameweekBadge>
          </div>
          <form action={updateTimelines} className="space-y-6">
            
            <div className="bg-surface-2 p-4 rounded-lg border">
              <h3 className="font-bold text-ink-2 mb-3">Onion Baggers Cup</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-dim mb-1 flex items-center gap-1">
                    Qualifiers Start {isObQualifiersLocked && <span>🔒</span>}
                  </label>
                  <input type="number" name="ob_qualifiers" defaultValue={obConfig?.qualifiers_start_gw} disabled={isObQualifiersLocked} className="w-full p-2 border rounded disabled:bg-surface-3 disabled:text-faint disabled:cursor-not-allowed" min="1" max="38" />
                </div>
                <div>
                  <label className="text-xs text-dim mb-1 flex items-center gap-1">
                    Knockouts Start {isObKnockoutLocked && <span>🔒</span>}
                  </label>
                  <input type="number" name="ob_knockout" defaultValue={obConfig?.knockout_start_gw} disabled={isObKnockoutLocked} className="w-full p-2 border rounded disabled:bg-surface-3 disabled:text-faint disabled:cursor-not-allowed" min="1" max="38" />
                </div>
              </div>
            </div>

            <div className="bg-surface-2 p-4 rounded-lg border">
              <h3 className="font-bold text-ink-2 mb-3">Champions League</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-dim mb-1 flex items-center gap-1">
                    Stage 1 {isClStage1Locked && <span>🔒</span>}
                  </label>
                  <input type="number" name="cl_stage_1" defaultValue={clConfig?.stage_1_start_gw} disabled={isClStage1Locked} className="w-full p-2 border rounded disabled:bg-surface-3 disabled:text-faint disabled:cursor-not-allowed" min="1" max="38" />
                </div>
                <div>
                  <label className="text-xs text-dim mb-1 flex items-center gap-1">
                    Stage 2 {isClStage2Locked && <span>🔒</span>}
                  </label>
                  <input type="number" name="cl_stage_2" defaultValue={clConfig?.stage_2_start_gw} disabled={isClStage2Locked} className="w-full p-2 border rounded disabled:bg-surface-3 disabled:text-faint disabled:cursor-not-allowed" min="1" max="38" />
                </div>
                <div>
                  <label className="text-xs text-dim mb-1 flex items-center gap-1">
                    Final {isClFinalLocked && <span>🔒</span>}
                  </label>
                  <input type="number" name="cl_final" defaultValue={clConfig?.final_start_gw} disabled={isClFinalLocked} className="w-full p-2 border rounded disabled:bg-surface-3 disabled:text-faint disabled:cursor-not-allowed" min="1" max="38" />
                </div>
              </div>
            </div>

            <div className="bg-surface-2 p-4 rounded-lg border">
              <h3 className="font-bold text-ink-2 mb-3">The Eliminator</h3>
              <div>
                <label className="text-xs text-dim mb-1 flex items-center gap-1">
                  Start Gameweek {isEliminatorLocked && <span>🔒</span>}
                </label>
                <input type="number" name="el_start" defaultValue={elConfig?.start_gw} disabled={isEliminatorLocked} className="w-full p-2 border rounded disabled:bg-surface-3 disabled:text-faint disabled:cursor-not-allowed" min="1" max="38" />
              </div>
            </div>

            <button type="submit" className="w-full bg-brand text-white py-3 rounded-lg font-bold hover:bg-brand/90 transition whitespace-nowrap">
              Save Active Timelines
            </button>
          </form>
        </div>

        {/* ENTRANTS COLUMN */}
        <div className="bg-surface p-6 rounded-xl border shadow-sm h-fit">
          <h2 className="text-xl font-bold text-ink mb-6 border-b pb-2">Champions League Entrants</h2>
          <p className="text-sm text-dim mb-4">Select the managers who have qualified.</p>
          <form action={updateCLEntrants}>
            <div className="max-h-[400px] overflow-y-auto border rounded-lg p-2 bg-surface-2 mb-4">
              {allManagers?.map((mgr: any) => (
                <label key={mgr.manager_fpl_id} className="flex items-center p-2 hover:bg-surface-3 rounded cursor-pointer transition">
                  <input 
                    type="checkbox" 
                    name="entrants" 
                    value={mgr.manager_fpl_id} 
                    defaultChecked={currentEntrantIds.includes(mgr.manager_fpl_id)}
                    className="w-4 h-4 text-brand-2 rounded mr-3"
                  />
                  <TeamName name={mgr.team_name} managerId={mgr.manager_fpl_id} inline className="text-sm font-medium text-ink-2" />
                </label>
              ))}
            </div>
            <button type="submit" className="w-full bg-panel text-white py-3 rounded-lg font-bold hover:bg-surface-2 transition whitespace-nowrap">
              Save Entrants
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
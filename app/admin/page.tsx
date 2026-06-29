import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { simulateNextGameweek, resetSeason } from './simulator';

export default async function AdminPage() {
  const supabase = await createClient();
  const SEASON_ID = '2026-27';

// Fetch Current Gameweek Status
  const { data: latestGwData } = await supabase
    .from('gameweeks')
    .select('gw_number')
    .eq('season_id', SEASON_ID)
    .eq('is_finished', true) // <-- ADD THIS LINE HERE
    .order('gw_number', { ascending: false })
    .limit(1)
    .single();
  
  const currentGw = latestGwData ? latestGwData.gw_number : 0;

  // --- CONFIG FETCHING & ACTIONS ---
  // (Your existing configuration logic remains untouched)
  const { data: clConfig } = await supabase.from('champions_league_config').select('*').eq('season_id', SEASON_ID).single();
  const { data: obConfig } = await supabase.from('onion_baggers_config').select('*').eq('season_id', SEASON_ID).single();
  const { data: elConfig } = await supabase.from('eliminator_config').select('*').eq('season_id', SEASON_ID).single();
  const { data: allManagers } = await supabase.from('season_managers').select('manager_fpl_id, team_name').eq('season_id', SEASON_ID).order('team_name');
  const { data: clEntrants } = await supabase.from('champions_league_entrants').select('manager_fpl_id').eq('season_id', SEASON_ID);
  const currentEntrantIds = clEntrants?.map(e => e.manager_fpl_id) || [];

  async function updateTimelines(formData: FormData) {
    'use server';
    const supabase = await createClient();
    await supabase.from('champions_league_config').update({
      stage_1_start_gw: parseInt(formData.get('cl_stage_1') as string),
      stage_2_start_gw: parseInt(formData.get('cl_stage_2') as string),
      final_start_gw: parseInt(formData.get('cl_final') as string)
    }).eq('season_id', SEASON_ID);
    await supabase.from('onion_baggers_config').update({
      qualifiers_start_gw: parseInt(formData.get('ob_qualifiers') as string),
      knockout_start_gw: parseInt(formData.get('ob_knockout') as string)
    }).eq('season_id', SEASON_ID);
    await supabase.from('eliminator_config').update({
      start_gw: parseInt(formData.get('el_start') as string)
    }).eq('season_id', SEASON_ID);
    revalidatePath('/admin');
  }

  async function updateCLEntrants(formData: FormData) {
    'use server';
    const supabase = await createClient();
    const selectedIds = formData.getAll('entrants').map(id => parseInt(id as string));
    await supabase.from('champions_league_entrants').delete().eq('season_id', SEASON_ID);
    if (selectedIds.length > 0) {
      const inserts = selectedIds.map(id => ({ season_id: SEASON_ID, manager_fpl_id: id }));
      await supabase.from('champions_league_entrants').insert(inserts);
    }
    revalidatePath('/admin');
  }

  // --- UI RENDER ---

  return (
    <div className="max-w-5xl mx-auto py-8">
      <header className="mb-8 border-b pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Tournament Administration</h1>
          <p className="text-slate-500">Configure start dates and manual entrants for the custom cups.</p>
        </div>
        
        {/* NEW SIMULATOR CONTROL PANEL */}
        <div className="bg-slate-900 text-white p-4 rounded-lg shadow flex flex-col items-end">
          <div className="text-sm font-bold text-blue-400 mb-2">DEVELOPER SIMULATOR</div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-lg mr-2">Current GW: {currentGw}</span>
            <form action={simulateNextGameweek}>
              <button type="submit" className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded font-bold text-sm transition">
                +1 Gameweek
              </button>
            </form>
            <form action={resetSeason}>
              <button type="submit" className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded font-bold text-sm transition">
                Reset
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* LEFT COLUMN: TIMELINES */}
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 mb-6 border-b pb-2">Tournament Timelines</h2>
          
          <form action={updateTimelines} className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-lg border">
              <h3 className="font-bold text-slate-700 mb-3">Onion Baggers Cup</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Qualifiers Start (GW)</label>
                  <input type="number" name="ob_qualifiers" defaultValue={obConfig?.qualifiers_start_gw} className="w-full p-2 border rounded" min="1" max="38" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Knockouts Start (GW)</label>
                  <input type="number" name="ob_knockout" defaultValue={obConfig?.knockout_start_gw} className="w-full p-2 border rounded" min="1" max="38" />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border">
              <h3 className="font-bold text-slate-700 mb-3">Champions League</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Stage 1 (GW)</label>
                  <input type="number" name="cl_stage_1" defaultValue={clConfig?.stage_1_start_gw} className="w-full p-2 border rounded" min="1" max="38" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Stage 2 (GW)</label>
                  <input type="number" name="cl_stage_2" defaultValue={clConfig?.stage_2_start_gw} className="w-full p-2 border rounded" min="1" max="38" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Final (GW)</label>
                  <input type="number" name="cl_final" defaultValue={clConfig?.final_start_gw} className="w-full p-2 border rounded" min="1" max="38" />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border">
              <h3 className="font-bold text-slate-700 mb-3">The Eliminator</h3>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Start Gameweek</label>
                <input type="number" name="el_start" defaultValue={elConfig?.start_gw} className="w-full p-2 border rounded" min="1" max="38" />
              </div>
            </div>

            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition">
              Save All Timelines
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: ENTRANTS */}
        <div className="bg-white p-6 rounded-xl border shadow-sm h-fit">
          <h2 className="text-xl font-bold text-slate-800 mb-6 border-b pb-2">Champions League Entrants</h2>
          <p className="text-sm text-slate-500 mb-4">Select the managers who have qualified.</p>
          
          <form action={updateCLEntrants}>
            <div className="max-h-[400px] overflow-y-auto border rounded-lg p-2 bg-slate-50 mb-4">
              {allManagers?.map((mgr) => (
                <label key={mgr.manager_fpl_id} className="flex items-center p-2 hover:bg-slate-200 rounded cursor-pointer transition">
                  <input 
                    type="checkbox" 
                    name="entrants" 
                    value={mgr.manager_fpl_id} 
                    defaultChecked={currentEntrantIds.includes(mgr.manager_fpl_id)}
                    className="w-4 h-4 text-blue-600 rounded mr-3"
                  />
                  <span className="text-sm font-medium text-slate-700">{mgr.team_name}</span>
                </label>
              ))}
            </div>
            
            <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800 transition">
              Save Entrants
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
    realtime: { transport: ws }
  }
);

const SEASON_ID = '2026-27';

// Your actual official FPL H2H League IDs
const DIVISIONS = [
  { name: 'Premier League', fplId: '839233' }, 
  { name: 'Championship', fplId: '839090' },
  { name: 'League One', fplId: '1054394' }
];

async function runIngestion() {
  console.log('🚀 Starting Unified ITF League Ingestion...');

  try {
    // 0. ENSURE THE SEASON EXISTS IN THE DATABASE FIRST
    console.log(`📅 Verifying season ${SEASON_ID} exists...`);
    const { error: seasonError } = await supabase.from('seasons').upsert({
      id: SEASON_ID,
      is_current: true
    });
    if (seasonError) throw new Error(`Season DB Error: ${seasonError.message}`);

    // 1. Get Current Gameweek Status
    const bootstrapRes = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');
    const bootstrapData = await bootstrapRes.json();
    const currentGw = bootstrapData.events.find(event => event.is_current || event.is_next === false);
    
    if (!currentGw) throw new Error('Could not determine active Gameweek.');
    const gwNum = currentGw.id;
    console.log(`📍 Processing Gameweek ${gwNum} (Data Checked: ${currentGw.data_checked})`);

    // Ensure the gameweek entry exists in our DB
    const { error: gwError } = await supabase.from('gameweeks').upsert({ 
      season_id: SEASON_ID, 
      gw_number: gwNum, 
      is_finished: currentGw.finished, 
      data_checked: currentGw.data_checked 
    });
    if (gwError) throw new Error(`Gameweek DB Error: ${gwError.message}`);

    let allDiscoveredManagers = [];

    // 2. Discover managers and their current divisions
    for (const division of DIVISIONS) {
      console.log(`📥 Discovering managers in ${division.name}...`);
      const res = await fetch(`https://fantasy.premierleague.com/api/leagues-h2h/${division.fplId}/standings/`);
      
      if (!res.ok) continue;

      const data = await res.json();
      const entrants = data.standings.results;

      for (const entrant of entrants) {
        allDiscoveredManagers.push({
          fpl_id: entrant.entry,
          real_name: entrant.player_name,
          team_name: entrant.entry_name, 
          division: division.name
        });
      }
    }

    console.log(`Total managers discovered across all divisions: ${allDiscoveredManagers.length}`);

    // 3. Process each manager
    const scoresToInsert = [];

    for (const manager of allDiscoveredManagers) {
      // Sync global identity
      const { error: mgrError } = await supabase.from('managers').upsert({ 
        fpl_id: manager.fpl_id, 
        real_name: manager.real_name 
      });
      if (mgrError) throw new Error(`Manager DB Error (${manager.real_name}): ${mgrError.message}`);

      // Sync seasonal dynamic profile
      const { error: smError } = await supabase.from('season_managers').upsert({
        season_id: SEASON_ID,
        manager_fpl_id: manager.fpl_id,
        team_name: manager.team_name,
        division: manager.division
      });
      if (smError) throw new Error(`Season Manager DB Error (${manager.team_name}): ${smError.message}`);

      console.log(`   Fetching live performance for: ${manager.team_name}...`);
      const historyRes = await fetch(`https://fantasy.premierleague.com/api/entry/${manager.fpl_id}/history/`);
      
      if (!historyRes.ok) continue;

      const historyData = await historyRes.json();
      
      const gwStats = historyData.current.find(h => h.event === gwNum);

      if (gwStats) {
        scoresToInsert.push({
          season_id: SEASON_ID,
          gw_number: gwNum,
          manager_fpl_id: manager.fpl_id,
          points: gwStats.points,
          bench_points: gwStats.points_on_bench,
          transfers_cost: gwStats.event_transfers_cost,
          classic_total_points: gwStats.total_points
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 4. Save Scores
    if (scoresToInsert.length === 0) {
      console.log(`\n⚠️ No scores found to insert. The season likely hasn't started yet.`);
    } else {
      console.log(`\n💾 Saving ${scoresToInsert.length} performance matrices to the database...`);
      const { error: scoresError } = await supabase
        .from('manager_gw_scores')
        .upsert(scoresToInsert, { onConflict: 'season_id,gw_number,manager_fpl_id' });

      if (scoresError) throw new Error(`Scores DB Error: ${scoresError.message}`);
      console.log(`✅ GW${gwNum} scores saved successfully!`);
    }

    console.log(`✅ Ingestion pipeline completed! Managers are synced.`);

  } catch (error) {
    console.error('\n❌ Ingestion engine stopped:', error.message, '\n');
  }
}

runIngestion();
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
    const { error: seasonError } = await supabase.from('seasons').upsert({ id: SEASON_ID, is_current: true });
    if (seasonError) throw new Error(`Season DB Error: ${seasonError.message}`);

    // 1. Get Current Gameweek Status
    const bootstrapRes = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');
    const bootstrapData = await bootstrapRes.json();
    const currentGw = bootstrapData.events.find(event => event.is_current || event.is_next === false);
    
    if (!currentGw) throw new Error('Could not determine active Gameweek.');
    const gwNum = currentGw.id;
    console.log(`📍 Processing Gameweek ${gwNum} (Data Checked: ${currentGw.data_checked})`);

    const { error: gwError } = await supabase.from('gameweeks').upsert({ 
      season_id: SEASON_ID, gw_number: gwNum, is_finished: currentGw.finished, data_checked: currentGw.data_checked 
    });
    if (gwError) throw new Error(`Gameweek DB Error: ${gwError.message}`);

    let allDiscoveredManagers = [];
    const h2hToInsert = []; // NEW: Array to hold our H2H match data

    // 2. Discover managers and fetch H2H Matches
    for (const division of DIVISIONS) {
      console.log(`📥 Discovering managers in ${division.name}...`);
      
      // Fetch Standings
      const res = await fetch(`https://fantasy.premierleague.com/api/leagues-h2h/${division.fplId}/standings/`);
      if (res.ok) {
        const data = await res.json();
        for (const entrant of data.standings.results) {
          allDiscoveredManagers.push({
            fpl_id: entrant.entry, real_name: entrant.player_name, team_name: entrant.entry_name, division: division.name
          });
        }
      }

      // NEW: Fetch H2H Matches for this Gameweek
      console.log(`   Fetching H2H match results for ${division.name}...`);
      const matchRes = await fetch(`https://fantasy.premierleague.com/api/leagues-h2h-matches/league/${division.fplId}/?event=${gwNum}`);
      
      if (matchRes.ok) {
        const matchData = await matchRes.json();
        
        for (const match of matchData.results) {
          // Skip if it's a bye-week (no opponent)
          if (!match.entry_1_entry || !match.entry_2_entry) continue;

          // Calculate who won
          let res1 = 'D', res2 = 'D';
          if (match.entry_1_points > match.entry_2_points) { res1 = 'W'; res2 = 'L'; }
          else if (match.entry_1_points < match.entry_2_points) { res1 = 'L'; res2 = 'W'; }

          // Push Entry 1's perspective
          h2hToInsert.push({
            season_id: SEASON_ID, gw_number: gwNum,
            manager_fpl_id: match.entry_1_entry, opponent_fpl_id: match.entry_2_entry,
            manager_score: match.entry_1_points, opponent_score: match.entry_2_points, result: res1
          });

          // Push Entry 2's perspective
          h2hToInsert.push({
            season_id: SEASON_ID, gw_number: gwNum,
            manager_fpl_id: match.entry_2_entry, opponent_fpl_id: match.entry_1_entry,
            manager_score: match.entry_2_points, opponent_score: match.entry_1_points, result: res2
          });
        }
      }
    }

    console.log(`Total managers discovered: ${allDiscoveredManagers.length}`);

    // 3. Process each manager's raw points (ITF Open / Cup Data)
    const scoresToInsert = [];
    for (const manager of allDiscoveredManagers) {
      await supabase.from('managers').upsert({ fpl_id: manager.fpl_id, real_name: manager.real_name });
      await supabase.from('season_managers').upsert({ season_id: SEASON_ID, manager_fpl_id: manager.fpl_id, team_name: manager.team_name, division: manager.division });

      console.log(`   Fetching live performance for: ${manager.team_name}...`);
      const historyRes = await fetch(`https://fantasy.premierleague.com/api/entry/${manager.fpl_id}/history/`);
      if (!historyRes.ok) continue;

      const historyData = await historyRes.json();
      const gwStats = historyData.current.find(h => h.event === gwNum);

      if (gwStats) {
        scoresToInsert.push({
          season_id: SEASON_ID, gw_number: gwNum, manager_fpl_id: manager.fpl_id,
          points: gwStats.points, bench_points: gwStats.points_on_bench,
          transfers_cost: gwStats.event_transfers_cost, classic_total_points: gwStats.total_points
        });
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 4. Save Scores and H2H Matches
    if (scoresToInsert.length > 0) {
      console.log(`\n💾 Saving ${scoresToInsert.length} raw performance matrices...`);
      await supabase.from('manager_gw_scores').upsert(scoresToInsert, { onConflict: 'season_id,gw_number,manager_fpl_id' });
    }

    if (h2hToInsert.length > 0) {
      console.log(`💾 Saving ${h2hToInsert.length} H2H match records...`);
      await supabase.from('h2h_fixtures').upsert(h2hToInsert, { onConflict: 'season_id,gw_number,manager_fpl_id' });
    }

    console.log(`✅ Ingestion pipeline completed!`);

  } catch (error) {
    console.error('\n❌ Ingestion engine stopped:', error.message, '\n');
  }
}

runIngestion();
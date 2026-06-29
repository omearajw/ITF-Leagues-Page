'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

const SEASON_ID = '2026-27';

// Helper: Calculates standings dynamically, ignoring future unplayed matches
async function getStageStandings(supabase: any, stage: string, entrants: number[]) {
  const { data: fixtures } = await supabase.from('tournament_fixtures')
    .select('*').eq('season_id', SEASON_ID).eq('tournament_type', 'CHAMPIONS_LEAGUE').eq('stage', stage);

  const stats: Record<number, { pts: number, totalScore: number }> = {};
  entrants.forEach(e => stats[e] = { pts: 0, totalScore: 0 });

  fixtures?.forEach((f: any) => {
    // Break early if the fixture hasn't been played yet!
    if (f.manager_1_score === null) return;

    if (stats[f.manager_1_id]) {
      stats[f.manager_1_id].totalScore += f.manager_1_score || 0;
      if (f.winner_id === f.manager_1_id) stats[f.manager_1_id].pts += 3;
      else if (!f.winner_id && f.manager_2_id) stats[f.manager_1_id].pts += 1;
    }
    if (f.manager_2_id && stats[f.manager_2_id]) {
      stats[f.manager_2_id].totalScore += f.manager_2_score || 0;
      if (f.winner_id === f.manager_2_id) stats[f.manager_2_id].pts += 3;
      else if (!f.winner_id && f.manager_1_id) stats[f.manager_2_id].pts += 1;
    }
  });

  return entrants.map(id => ({ id, ...stats[id] }))
    .sort((a, b) => b.pts !== a.pts ? b.pts - a.pts : b.totalScore - a.totalScore);
}

export async function simulateNextGameweek() {
  const supabase = await createClient();

  const { data: latestGw } = await supabase
    .from('gameweeks')
    .select('gw_number')
    .eq('season_id', SEASON_ID)
    .eq('is_finished', true) // <-- ADD THIS LINE
    .order('gw_number', { ascending: false })
    .limit(1)
    .single();
  const nextGw = latestGw ? latestGw.gw_number + 1 : 1;
  if (nextGw > 38) return { error: "Season is already at Gameweek 38." };

  await supabase.from('gameweeks').upsert({ season_id: SEASON_ID, gw_number: nextGw, is_finished: true, data_checked: true });

  const { data: managers } = await supabase.from('season_managers').select('*').eq('season_id', SEASON_ID);
  if (!managers) return { error: "No managers found." };

  const scoresToInsert = [];
  const managerPointsMap: Record<number, number> = {};

  for (const mgr of managers) {
    const { data: prevScore } = await supabase.from('manager_gw_scores').select('classic_total_points').eq('manager_fpl_id', mgr.manager_fpl_id).eq('gw_number', nextGw - 1).single();
    const prevTotal = prevScore ? prevScore.classic_total_points : 0;
    const pts = Math.floor(Math.random() * 70) + 30; 
    
    managerPointsMap[mgr.manager_fpl_id] = pts;

    scoresToInsert.push({
      season_id: SEASON_ID, gw_number: nextGw, manager_fpl_id: mgr.manager_fpl_id, points: pts,
      bench_points: Math.floor(Math.random() * 15), transfers_cost: Math.random() > 0.8 ? 4 : 0, classic_total_points: prevTotal + pts
    });
  }

  await supabase.from('manager_gw_scores').insert(scoresToInsert);

  // H2H Divisions
  const h2hToInsert = [];
  const divisions = ['Premier League', 'Championship', 'League One'];

  for (const div of divisions) {
    const divMgrs = managers.filter(m => m.division === div);
    const shuffled = divMgrs.sort(() => 0.5 - Math.random());
    for (let i = 0; i < shuffled.length; i += 2) {
      if (i + 1 >= shuffled.length) break;
      const mgr1 = shuffled[i], mgr2 = shuffled[i + 1];
      const score1 = managerPointsMap[mgr1.manager_fpl_id], score2 = managerPointsMap[mgr2.manager_fpl_id];
      let res1 = 'D', res2 = 'D';
      if (score1 > score2) { res1 = 'W'; res2 = 'L'; } else if (score1 < score2) { res1 = 'L'; res2 = 'W'; }

      h2hToInsert.push({ season_id: SEASON_ID, gw_number: nextGw, manager_fpl_id: mgr1.manager_fpl_id, opponent_fpl_id: mgr2.manager_fpl_id, manager_score: score1, opponent_score: score2, result: res1 });
      h2hToInsert.push({ season_id: SEASON_ID, gw_number: nextGw, manager_fpl_id: mgr2.manager_fpl_id, opponent_fpl_id: mgr1.manager_fpl_id, manager_score: score2, opponent_score: score1, result: res2 });
    }
  }
  await supabase.from('h2h_fixtures').insert(h2hToInsert);

  // THE ELIMINATOR
  const { data: elConfig } = await supabase.from('eliminator_config').select('start_gw').eq('season_id', SEASON_ID).single();
  if (elConfig && nextGw >= elConfig.start_gw) {
    const { data: aliveManagers } = await supabase.from('eliminator_status').select('manager_fpl_id').eq('season_id', SEASON_ID).eq('is_eliminated', false);
    if (aliveManagers && aliveManagers.length > 1) {
      let lowestScore = 999;
      let managerToEliminate = null;
      for (const alive of aliveManagers) {
        const score = managerPointsMap[alive.manager_fpl_id];
        if (score < lowestScore) { lowestScore = score; managerToEliminate = alive.manager_fpl_id; }
      }
      if (managerToEliminate) await supabase.from('eliminator_status').update({ is_eliminated: true, eliminated_gw: nextGw }).eq('season_id', SEASON_ID).eq('manager_fpl_id', managerToEliminate);
    }
  }

  // =========================================
  // CHAMPIONS LEAGUE ENGINE (Schedule & Result)
  // =========================================
  const { data: clConfig } = await supabase.from('champions_league_config').select('*').eq('season_id', SEASON_ID).single();
  const { data: clEntrantsData } = await supabase.from('champions_league_entrants').select('manager_fpl_id').eq('season_id', SEASON_ID);
  const clEntrants = clEntrantsData?.map(e => e.manager_fpl_id) || [];

  if (clConfig && clEntrants.length > 0) {
    let stageToSchedule = null;
    let activeManagers: number[] = [];
    let startGw = 0;
    let maxRounds = 0;

    // A. SCHEDULING PHASE: Generate all blank fixtures exactly on the start date
    if (nextGw === clConfig.stage_1_start_gw) {
      stageToSchedule = 'Stage 1';
      activeManagers = [...clEntrants];
      startGw = clConfig.stage_1_start_gw;
      const p = activeManagers.length % 2 === 0 ? activeManagers.length : activeManagers.length + 1;
      maxRounds = 2 * (p - 1);
    } 
    else if (nextGw === clConfig.stage_2_start_gw) {
      stageToSchedule = 'Stage 2';
      const stage1Standings = await getStageStandings(supabase, 'Stage 1', clEntrants);
      activeManagers = stage1Standings.slice(0, -1).map(s => s.id); // Drop the eliminated team
      startGw = clConfig.stage_2_start_gw;
      const p = activeManagers.length % 2 === 0 ? activeManagers.length : activeManagers.length + 1;
      maxRounds = 3 * (p - 1);
    } 
    else if (nextGw === clConfig.final_start_gw) {
      stageToSchedule = 'Final';
      const stage1Standings = await getStageStandings(supabase, 'Stage 1', clEntrants);
      const stage2Entrants = stage1Standings.slice(0, -1).map(s => s.id);
      const stage2Standings = await getStageStandings(supabase, 'Stage 2', stage2Entrants);
      activeManagers = stage2Standings.slice(0, 2).map(s => s.id); // Top 2 to final
      startGw = clConfig.final_start_gw;
      maxRounds = 1;
    }

    if (stageToSchedule && activeManagers.length > 0) {
      const clFixtures = [];
      const futureGws = []; // <--- THE FIX: Array to hold placeholder gameweeks
      
      let players = [...activeManagers];
      if (players.length % 2 !== 0) players.push(-1); // Bye week padding

      const numPlayers = players.length;
      const numUniqueRounds = numPlayers - 1;

      // Ensure future Gameweeks exist in DB to prevent Foreign Key errors
      for (let roundIndex = 0; roundIndex < maxRounds; roundIndex++) {
        futureGws.push({ 
          season_id: SEASON_ID, 
          gw_number: startGw + roundIndex,
          is_finished: false // <-- ADD THIS LINE
        });
      }
      // ignoreDuplicates ensures we don't overwrite any gameweeks that actually have finished=true
      await supabase.from('gameweeks').upsert(futureGws, { onConflict: 'season_id,gw_number', ignoreDuplicates: true });

      // Loop through every future round for this stage and schedule it
      for (let roundIndex = 0; roundIndex < maxRounds; roundIndex++) {
        const actualRound = roundIndex % numUniqueRounds;
        const fixed = players[0];
        const rotatable = players.slice(1);
        for (let r = 0; r < actualRound; r++) rotatable.unshift(rotatable.pop() as number);
        const currentWeekPlayers = [fixed, ...rotatable];
        const matchGw = startGw + roundIndex;

        for (let i = 0; i < numPlayers / 2; i++) {
          const mgr1 = currentWeekPlayers[i];
          const mgr2 = currentWeekPlayers[numPlayers - 1 - i];
          if (mgr1 === -1 || mgr2 === -1) continue;

          clFixtures.push({
            season_id: SEASON_ID, gw_number: matchGw, tournament_type: 'CHAMPIONS_LEAGUE', stage: stageToSchedule,
            manager_1_id: mgr1, manager_2_id: mgr2,
            manager_1_score: null, manager_2_score: null, winner_id: null // Blank scores
          });
        }
      }
      
      // Insert the massive batch of future fixtures
      const { error: fixtureError } = await supabase.from('tournament_fixtures').insert(clFixtures);
      if (fixtureError) console.error("Fixture error:", fixtureError);
    }

    // B. RESULTING PHASE: Update any scheduled blank fixtures for the CURRENT week
    const { data: fixturesToResult } = await supabase
      .from('tournament_fixtures')
      .select('*')
      .eq('season_id', SEASON_ID)
      .eq('tournament_type', 'CHAMPIONS_LEAGUE')
      .eq('gw_number', nextGw);

    if (fixturesToResult && fixturesToResult.length > 0) {
      for (const fix of fixturesToResult) {
        const score1 = managerPointsMap[fix.manager_1_id] || 0;
        const score2 = managerPointsMap[fix.manager_2_id] || 0;
        let winner = null;
        if (score1 > score2) winner = fix.manager_1_id;
        else if (score2 > score1) winner = fix.manager_2_id;

        await supabase
          .from('tournament_fixtures')
          .update({ manager_1_score: score1, manager_2_score: score2, winner_id: winner })
          .eq('id', fix.id);
      }
    }
  }

  // =========================================
  // ONION BAGGERS CUP ENGINE
  // =========================================
  const { data: obConfig } = await supabase.from('onion_baggers_config').select('*').eq('season_id', SEASON_ID).single();
  
  if (obConfig) {
    // PHASE 1: QUALIFIERS
    if (nextGw >= obConfig.qualifiers_start_gw && nextGw < obConfig.knockout_start_gw) {
      const { data: currentEntrants } = await supabase.from('onion_baggers_entrants').select('*').eq('season_id', SEASON_ID);
      const qualifiedCount = currentEntrants?.length || 0;
      
      if (qualifiedCount < 16) {
        const qualifiedIds = currentEntrants?.map(e => e.manager_fpl_id) || [];
        const remainingSlots = 16 - qualifiedCount;
        const weeksLeft = obConfig.knockout_start_gw - nextGw;
        
        const toQualifyCount = Math.ceil(remainingSlots / weeksLeft);
        
        const availableScores = Object.entries(managerPointsMap)
          .filter(([id, _]) => !qualifiedIds.includes(parseInt(id)))
          .sort((a, b) => b[1] - a[1]); // Highest score gets first available seed
          
        const winners = availableScores.slice(0, toQualifyCount);
        
        const inserts = winners.map((w, idx) => ({
          season_id: SEASON_ID, manager_fpl_id: parseInt(w[0]),
          seed: qualifiedCount + idx + 1, qualified_in_gw: nextGw
        }));
        
        await supabase.from('onion_baggers_entrants').insert(inserts);
      }
    }

    // PHASE 2A: INITIALIZE BRACKET
    if (nextGw === obConfig.knockout_start_gw) {
      const { data: entrants } = await supabase.from('onion_baggers_entrants').select('*').eq('season_id', SEASON_ID);
      if (entrants && entrants.length === 16) {
        const seedMap: Record<number, number> = {};
        entrants.forEach(e => seedMap[e.seed] = e.manager_fpl_id);
        
        // Mathematically perfect 16-team bracket matchups
        const r16Matchups = [[1, 16], [8, 9], [4, 13], [5, 12], [2, 15], [7, 10], [3, 14], [6, 11]];
        const r16Fixtures = r16Matchups.map((m, idx) => ({
          season_id: SEASON_ID, gw_number: nextGw, tournament_type: 'ONION_BAGGERS_CUP', stage: 'Round of 16',
          manager_1_id: seedMap[m[0]], manager_2_id: seedMap[m[1]],
          manager_1_score: null, manager_2_score: null, winner_id: null,
          match_order: idx // <--- Locks the bracket progression in place
        }));
        await supabase.from('tournament_fixtures').insert(r16Fixtures);
      }
    }

    // PHASE 2B: PLAY KNOCKOUTS & PROGRESS WINNERS
    if (nextGw >= obConfig.knockout_start_gw) {
      // Must sort by match_order so winner of Match 1 plays winner of Match 2
      const { data: activeFixtures } = await supabase.from('tournament_fixtures')
        .select('*').eq('season_id', SEASON_ID).eq('tournament_type', 'ONION_BAGGERS_CUP').eq('gw_number', nextGw)
        .order('match_order', { ascending: true });

      if (activeFixtures && activeFixtures.length > 0) {
        const resolvedFixtures = [];
        for (const fix of activeFixtures) {
          const score1 = managerPointsMap[fix.manager_1_id] || 0;
          const score2 = managerPointsMap[fix.manager_2_id] || 0;
          
          // Tiebreaker: Higher Seed (Manager 1) goes through if points are drawn
          const winner = score1 >= score2 ? fix.manager_1_id : fix.manager_2_id;
          
          await supabase.from('tournament_fixtures').update({ manager_1_score: score1, manager_2_score: score2, winner_id: winner }).eq('id', fix.id);
          resolvedFixtures.push({ ...fix, winner_id: winner });
        }

        const currentStage = activeFixtures[0].stage;
        let nextStage = null;
        if (currentStage === 'Round of 16') nextStage = 'Quarter-Final';
        else if (currentStage === 'Quarter-Final') nextStage = 'Semi-Final';
        else if (currentStage === 'Semi-Final') nextStage = 'Final';

        if (nextStage) {
          const nextRoundFixtures = [];
          for (let i = 0; i < resolvedFixtures.length; i += 2) {
            nextRoundFixtures.push({
              season_id: SEASON_ID, gw_number: nextGw + 1, tournament_type: 'ONION_BAGGERS_CUP', stage: nextStage,
              manager_1_id: resolvedFixtures[i].winner_id, manager_2_id: resolvedFixtures[i+1].winner_id,
              manager_1_score: null, manager_2_score: null, winner_id: null,
              match_order: i / 2 // <--- Calculate the new match_order to maintain the bracket
            });
          }
          await supabase.from('gameweeks').upsert([{ season_id: SEASON_ID, gw_number: nextGw + 1, is_finished: false }], { onConflict: 'season_id,gw_number', ignoreDuplicates: true });
          await supabase.from('tournament_fixtures').insert(nextRoundFixtures);
        }
      }
    }
  }
  revalidatePath('/', 'layout');
}

export async function resetSeason() {
  const supabase = await createClient();
  await supabase.from('tournament_fixtures').delete().eq('season_id', SEASON_ID);
  await supabase.from('h2h_fixtures').delete().eq('season_id', SEASON_ID);
  await supabase.from('manager_gw_scores').delete().eq('season_id', SEASON_ID);
  await supabase.from('gameweeks').delete().eq('season_id', SEASON_ID);
  await supabase.from('eliminator_status').update({ is_eliminated: false, eliminated_gw: null }).eq('season_id', SEASON_ID);
  await supabase.from('onion_baggers_entrants').delete().eq('season_id', SEASON_ID);
  revalidatePath('/', 'layout');
}
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SEASON_ID = '2026-27';
const DIVISIONS = [
  { name: 'Premier League', fplId: '839233' }, 
  { name: 'Championship', fplId: '839090' },
  { name: 'League One', fplId: '1054394' }
];

// Helper: Champions League Stage Standings
async function getStageStandings(stage: string, entrants: number[]) {
  const { data: fixtures } = await supabase
    .from('tournament_fixtures')
    .select('*')
    .eq('season_id', SEASON_ID)
    .eq('tournament_type', 'CHAMPIONS_LEAGUE')
    .eq('stage', stage);

  const stats: Record<number, { pts: number, totalScore: number }> = {};
  entrants.forEach(e => stats[e] = { pts: 0, totalScore: 0 });

  fixtures?.forEach((f: any) => {
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

export async function GET(request: Request) {
  // 1. Verify Vercel Cron Authorization
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('🚀 Starting Unified Live ITF Ingestion...');
    await supabase.from('seasons').upsert({ id: SEASON_ID, is_current: true });

    // 2. Fetch Active Gameweek Status
    const bootstrapRes = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');
    const bootstrapData = await bootstrapRes.json();
    const currentGwData = bootstrapData.events.find((event: any) => event.is_current || event.is_next === false);
    
    if (!currentGwData) throw new Error('Could not determine active Gameweek.');
    const nextGw = currentGwData.id;
    const isGwFinished = currentGwData.finished;

    await supabase.from('gameweeks').upsert({ 
      season_id: SEASON_ID, gw_number: nextGw, is_finished: isGwFinished, data_checked: currentGwData.data_checked 
    });

    // 3. Process Live FPL Data & Build Points Maps
    let allDiscoveredManagers: any[] = [];
    const h2hToInsert: any[] = [];
    const scoresToInsert: any[] = [];
    const managerPointsMap: Record<number, number> = {};

    for (const division of DIVISIONS) {
      // Fetch H2H Standings
      const res = await fetch(`https://fantasy.premierleague.com/api/leagues-h2h/${division.fplId}/standings/`);
      if (res.ok) {
        const data = await res.json();
        for (const entrant of data.standings.results) {
          allDiscoveredManagers.push({
            fpl_id: Number(entrant.entry),
            real_name: entrant.player_name,
            team_name: entrant.entry_name,
            division: division.name
          });
        }
      }

      // Fetch H2H Fixtures for Current Gameweek
      const matchRes = await fetch(`https://fantasy.premierleague.com/api/leagues-h2h-matches/league/${division.fplId}/?event=${nextGw}`);
      if (matchRes.ok) {
        const matchData = await matchRes.json();
        for (const match of matchData.results) {
          if (!match.entry_1_entry || !match.entry_2_entry) continue;
          
          let res1 = 'D', res2 = 'D';
          if (match.entry_1_points > match.entry_2_points) { res1 = 'W'; res2 = 'L'; }
          else if (match.entry_1_points < match.entry_2_points) { res1 = 'L'; res2 = 'W'; }

          const m1 = Number(match.entry_1_entry);
          const m2 = Number(match.entry_2_entry);

          h2hToInsert.push({ season_id: SEASON_ID, gw_number: nextGw, manager_fpl_id: m1, opponent_fpl_id: m2, manager_score: match.entry_1_points, opponent_score: match.entry_2_points, result: res1 });
          h2hToInsert.push({ season_id: SEASON_ID, gw_number: nextGw, manager_fpl_id: m2, opponent_fpl_id: m1, manager_score: match.entry_2_points, opponent_score: match.entry_1_points, result: res2 });
        }
      }
    }

    // Fetch Individual Points Histories
    for (const manager of allDiscoveredManagers) {
      await supabase.from('managers').upsert({ fpl_id: manager.fpl_id, real_name: manager.real_name });
      await supabase.from('season_managers').upsert({ season_id: SEASON_ID, manager_fpl_id: manager.fpl_id, team_name: manager.team_name, division: manager.division });

      const historyRes = await fetch(`https://fantasy.premierleague.com/api/entry/${manager.fpl_id}/history/`);
      if (!historyRes.ok) continue;

      const historyData = await historyRes.json();
      const gwStats = historyData.current.find((h: any) => h.event === nextGw);

      if (gwStats) {
        managerPointsMap[manager.fpl_id] = gwStats.points;
        scoresToInsert.push({
          season_id: SEASON_ID, gw_number: nextGw, manager_fpl_id: manager.fpl_id,
          points: gwStats.points, bench_points: gwStats.points_on_bench,
          transfers_cost: gwStats.event_transfers_cost, classic_total_points: gwStats.total_points
        });
      }
    }

    if (scoresToInsert.length > 0) await supabase.from('manager_gw_scores').upsert(scoresToInsert, { onConflict: 'season_id,gw_number,manager_fpl_id' });
    if (h2hToInsert.length > 0) await supabase.from('h2h_fixtures').upsert(h2hToInsert, { onConflict: 'season_id,gw_number,manager_fpl_id' });

    // =========================================
    // 4. CUSTOM LEAGUES & CUPS ENGINE
    // =========================================

    // A. THE ELIMINATOR
    const { data: elConfig } = await supabase.from('eliminator_config').select('start_gw').eq('season_id', SEASON_ID).single();
    if (elConfig && nextGw >= elConfig.start_gw && isGwFinished) {
      const { data: aliveManagers } = await supabase.from('eliminator_status').select('manager_fpl_id').eq('season_id', SEASON_ID).eq('is_eliminated', false);
      if (aliveManagers && aliveManagers.length > 1) {
        let lowestScore = 999;
        let managerToEliminate = null;
        for (const alive of aliveManagers) {
          const score = managerPointsMap[alive.manager_fpl_id] ?? 999;
          if (score < lowestScore) { lowestScore = score; managerToEliminate = alive.manager_fpl_id; }
        }
        if (managerToEliminate) {
          await supabase.from('eliminator_status').update({ is_eliminated: true, eliminated_gw: nextGw }).eq('season_id', SEASON_ID).eq('manager_fpl_id', managerToEliminate);
        }
      }
    }

    // B. CHAMPIONS LEAGUE ENGINE
    const { data: clConfig } = await supabase.from('champions_league_config').select('*').eq('season_id', SEASON_ID).single();
    const { data: clEntrantsData } = await supabase.from('champions_league_entrants').select('manager_fpl_id').eq('season_id', SEASON_ID);
    const clEntrants = clEntrantsData?.map(e => Number(e.manager_fpl_id)) || [];

    if (clConfig && clEntrants.length > 0) {
      // 1. Resulting Phase (Updates live during the week)
      const { data: fixturesToResult } = await supabase.from('tournament_fixtures').select('*').eq('season_id', SEASON_ID).eq('tournament_type', 'CHAMPIONS_LEAGUE').eq('gw_number', nextGw);
      if (fixturesToResult && fixturesToResult.length > 0) {
        for (const fix of fixturesToResult) {
          const score1 = managerPointsMap[fix.manager_1_id] ?? 0;
          const score2 = managerPointsMap[fix.manager_2_id] ?? 0;
          let winner = null;
          if (score1 > score2) winner = fix.manager_1_id; else if (score2 > score1) winner = fix.manager_2_id;
          await supabase.from('tournament_fixtures').update({ manager_1_score: score1, manager_2_score: score2, winner_id: winner }).eq('id', fix.id);
        }
      }

      // 2. Scheduling Phase (Exact round-robin logic from simulator.ts)
      let stageToSchedule = null, activeManagers: number[] = [], startGw = 0, maxRounds = 0;
      if (nextGw === clConfig.stage_1_start_gw) {
        stageToSchedule = 'Stage 1'; activeManagers = [...clEntrants]; startGw = clConfig.stage_1_start_gw;
        const p = activeManagers.length % 2 === 0 ? activeManagers.length : activeManagers.length + 1;
        maxRounds = 2 * (p - 1);
      } else if (nextGw === clConfig.stage_2_start_gw && isGwFinished) {
        stageToSchedule = 'Stage 2'; 
        const stage1Standings = await getStageStandings('Stage 1', clEntrants);
        activeManagers = stage1Standings.slice(0, -1).map(s => s.id); startGw = clConfig.stage_2_start_gw;
        const p = activeManagers.length % 2 === 0 ? activeManagers.length : activeManagers.length + 1;
        maxRounds = 3 * (p - 1);
      } else if (nextGw === clConfig.final_start_gw && isGwFinished) {
        stageToSchedule = 'Final';
        const stage1Standings = await getStageStandings('Stage 1', clEntrants);
        const s2Standings = await getStageStandings('Stage 2', stage1Standings.slice(0, -1).map(s => s.id));
        activeManagers = s2Standings.slice(0, 2).map(s => s.id); startGw = clConfig.final_start_gw; maxRounds = 1;
      }

      if (stageToSchedule && activeManagers.length > 0) {
        const clFixtures = [], futureGws = [];
        let players = [...activeManagers]; 
        if (players.length % 2 !== 0) players.push(-1);

        const numPlayers = players.length;
        const numUniqueRounds = numPlayers - 1;

        for (let roundIndex = 0; roundIndex < maxRounds; roundIndex++) {
          futureGws.push({ season_id: SEASON_ID, gw_number: startGw + roundIndex, is_finished: false });
        }
        await supabase.from('gameweeks').upsert(futureGws, { onConflict: 'season_id,gw_number', ignoreDuplicates: true });

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
              manager_1_score: null, manager_2_score: null, winner_id: null
            });
          }
        }
        await supabase.from('tournament_fixtures').insert(clFixtures);
      }
    }

    // C. ONION BAGGERS CUP ENGINE
    const { data: obConfig } = await supabase.from('onion_baggers_config').select('*').eq('season_id', SEASON_ID).single();
    if (obConfig) {
      // PHASE 1: QUALIFIERS
      if (nextGw >= obConfig.qualifiers_start_gw && nextGw < obConfig.knockout_start_gw && isGwFinished) {
        const { data: currentEntrants } = await supabase.from('onion_baggers_entrants').select('*').eq('season_id', SEASON_ID);
        const qualifiedCount = currentEntrants?.length || 0;

        if (qualifiedCount < 16) {
          const qualifiedIds = currentEntrants?.map(e => Number(e.manager_fpl_id)) || [];
          
          const { data: historicalScores } = await supabase
            .from('manager_gw_scores')
            .select('manager_fpl_id, gw_number, points')
            .eq('season_id', SEASON_ID)
            .lt('gw_number', nextGw);

          const sortedContenders = allDiscoveredManagers
            .filter(m => !qualifiedIds.includes(m.fpl_id))
            .sort((a, b) => {
              const scoreA = managerPointsMap[a.fpl_id] ?? 0;
              const scoreB = managerPointsMap[b.fpl_id] ?? 0;
              if (scoreB !== scoreA) return scoreB - scoreA;

              for (let lookbackGw = nextGw - 1; lookbackGw >= 1; lookbackGw--) {
                const histA = historicalScores?.find(s => Number(s.manager_fpl_id) === a.fpl_id && s.gw_number === lookbackGw)?.points || 0;
                const histB = historicalScores?.find(s => Number(s.manager_fpl_id) === b.fpl_id && s.gw_number === lookbackGw)?.points || 0;
                if (histB !== histA) return histB - histA;
              }

              return a.fpl_id - b.fpl_id;
            });

          const winners = sortedContenders.slice(0, 2);
          const inserts = winners.map((w, idx) => ({
            season_id: SEASON_ID, manager_fpl_id: w.fpl_id,
            seed: qualifiedCount + idx + 1, qualified_in_gw: nextGw
          }));

          if (inserts.length > 0) {
            await supabase.from('onion_baggers_entrants').insert(inserts);
          }
        }
      }

      // PHASE 2A: INITIALIZE BRACKET
      if (nextGw === obConfig.knockout_start_gw && isGwFinished) {
        const { data: entrants } = await supabase.from('onion_baggers_entrants').select('*').eq('season_id', SEASON_ID);
        if (entrants && entrants.length === 16) {
          const seedMap: Record<number, number> = {};
          entrants.forEach(e => seedMap[e.seed] = Number(e.manager_fpl_id));
          
          const r16Matchups = [[1, 16], [8, 9], [4, 13], [5, 12], [2, 15], [7, 10], [3, 14], [6, 11]];
          const r16Fixtures = r16Matchups.map((m, idx) => ({
            season_id: SEASON_ID, gw_number: nextGw, tournament_type: 'ONION_BAGGERS_CUP', stage: 'Round of 16',
            manager_1_id: seedMap[m[0]], manager_2_id: seedMap[m[1]],
            manager_1_score: null, manager_2_score: null, winner_id: null,
            match_order: idx
          }));
          await supabase.from('tournament_fixtures').insert(r16Fixtures);
        }
      }

      // PHASE 2B: PLAY KNOCKOUTS & PROGRESS WINNERS
      if (nextGw >= obConfig.knockout_start_gw) {
        const { data: activeFixtures } = await supabase
          .from('tournament_fixtures')
          .select('*')
          .eq('season_id', SEASON_ID)
          .eq('tournament_type', 'ONION_BAGGERS_CUP')
          .eq('gw_number', nextGw)
          .order('match_order', { ascending: true });

        if (activeFixtures && activeFixtures.length > 0) {
          const resolvedFixtures = [];
          for (const fix of activeFixtures) {
            const score1 = managerPointsMap[fix.manager_1_id] ?? 0;
            const score2 = managerPointsMap[fix.manager_2_id] ?? 0;
            const winner = score1 >= score2 ? fix.manager_1_id : fix.manager_2_id;

            await supabase.from('tournament_fixtures').update({ manager_1_score: score1, manager_2_score: score2, winner_id: winner }).eq('id', fix.id);
            resolvedFixtures.push({ ...fix, winner_id: winner });
          }

          if (isGwFinished) {
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
                  match_order: i / 2
                });
              }
              await supabase.from('gameweeks').upsert([{ season_id: SEASON_ID, gw_number: nextGw + 1, is_finished: false }], { onConflict: 'season_id,gw_number', ignoreDuplicates: true });
              await supabase.from('tournament_fixtures').insert(nextRoundFixtures);
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true, message: `Processed live GW ${nextGw} successfully.` });

  } catch (error: any) {
    console.error('Ingestion Engine error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
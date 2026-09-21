import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

import { DIVISIONS } from '@/lib/divisions';
import { loadTieFacts, resolveEliminatorTie } from '@/lib/eliminator-tiebreak';

const SEASON_ID = '2026-27';

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

// Helper: The Eliminator. Runs from DB state after the gameweek loop rather than
// per-iteration, so a missed cron run or a late seed still applies every outstanding
// elimination (one per finished gameweek from start_gw onwards).
async function runEliminator() {
  const { data: elConfig } = await supabase.from('eliminator_config').select('start_gw').eq('season_id', SEASON_ID).single();
  if (!elConfig) return;

  // Every manager in the league takes part; register anyone not yet in the table.
  const { data: seasonManagers } = await supabase.from('season_managers').select('manager_fpl_id').eq('season_id', SEASON_ID);
  const { data: existing } = await supabase.from('eliminator_status').select('manager_fpl_id').eq('season_id', SEASON_ID);
  const existingIds = new Set((existing || []).map(e => Number(e.manager_fpl_id)));
  const toSeed = (seasonManagers || [])
    .filter(m => !existingIds.has(Number(m.manager_fpl_id)))
    .map(m => ({ season_id: SEASON_ID, manager_fpl_id: m.manager_fpl_id, is_eliminated: false, eliminated_gw: null }));
  if (toSeed.length > 0) {
    const { error } = await supabase.from('eliminator_status').insert(toSeed);
    if (error) console.error('Eliminator seed failed:', error.message);
    else console.log(`🪓 Eliminator: registered ${toSeed.length} managers`);
  }

  const { data: finishedGws } = await supabase
    .from('gameweeks')
    .select('gw_number')
    .eq('season_id', SEASON_ID)
    .eq('is_finished', true)
    .gte('gw_number', elConfig.start_gw)
    .order('gw_number', { ascending: true });
  if (!finishedGws || finishedGws.length === 0) return;

  const { data: statuses } = await supabase.from('eliminator_status').select('manager_fpl_id, is_eliminated, eliminated_gw').eq('season_id', SEASON_ID);
  const alive = new Set((statuses || []).filter(s => !s.is_eliminated).map(s => Number(s.manager_fpl_id)));
  const processedGws = new Set((statuses || []).filter(s => s.eliminated_gw !== null).map(s => Number(s.eliminated_gw)));

  for (const { gw_number } of finishedGws) {
    if (processedGws.has(gw_number) || alive.size <= 1) continue;

    const { data: scores } = await supabase.from('manager_gw_scores').select('manager_fpl_id, points').eq('season_id', SEASON_ID).eq('gw_number', gw_number);
    const survivors = (scores || []).map(s => ({ id: Number(s.manager_fpl_id), points: s.points })).filter(s => alive.has(s.id));
    // No scores ingested for this week yet; leave it for the next run.
    if (survivors.length === 0) continue;
    const lowestScore = Math.min(...survivors.map(s => s.points));
    const tied = survivors.filter(s => s.points === lowestScore).map(s => s.id);

    // Tied lowest scores go to the league's tie-break (lib/eliminator-tiebreak.ts)
    let managerToEliminate = tied[0];
    let rule = 'lowest score';
    if (tied.length > 1) {
      const facts = await loadTieFacts(tied, gw_number);
      const result = resolveEliminatorTie(facts);
      managerToEliminate = result.loser; rule = result.rule;
      console.log(`⚖️ Eliminator: GW${gw_number} tie on ${lowestScore} between ${tied.join(', ')} → ${managerToEliminate} out (${rule})`, JSON.stringify(facts));
    }

    await supabase.from('eliminator_status').update({ is_eliminated: true, eliminated_gw: gw_number }).eq('season_id', SEASON_ID).eq('manager_fpl_id', managerToEliminate);
    alive.delete(managerToEliminate);
    processedGws.add(gw_number);
    console.log(`💀 Eliminator: GW${gw_number} eliminated ${managerToEliminate} (${lowestScore} pts, ${rule})`);
  }
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

    // 2. Fetch Active Gameweek Status from FPL
    const bootstrapRes = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');
    const bootstrapData = await bootstrapRes.json();
    
    // Find the actual current gameweek. (Fallback to the next one if between seasons)
    const currentGwData = bootstrapData.events.find((event: any) => event.is_current === true) 
                       || bootstrapData.events.find((event: any) => event.is_next === true);
    
    if (!currentGwData) throw new Error('Could not determine active Gameweek.');
    const activeApiGw = currentGwData.id;

    // Determine the last finished GW in our database
    const { data: dbGwData } = await supabase
      .from('gameweeks')
      .select('gw_number')
      .eq('season_id', SEASON_ID)
      .eq('is_finished', true)
      .order('gw_number', { ascending: false })
      .limit(1)
      .single();

    const lastFinishedGw = dbGwData ? dbGwData.gw_number : 0;
    const startGw = lastFinishedGw + 1;

    console.log(`📊 DB Last Finished: GW${lastFinishedGw} | API Current: GW${activeApiGw}`);

    // Loop through missing gameweeks to catch up
    for (let currentProcessingGw = startGw; currentProcessingGw <= activeApiGw; currentProcessingGw++) {
      console.log(`⏳ Processing GW${currentProcessingGw}...`);
      
      // If we are processing a past week, it is definitely finished. Otherwise, check live status.
      const isGwFinished = currentProcessingGw < activeApiGw ? true : (currentGwData.finished && currentGwData.data_checked);

      await supabase.from('gameweeks').upsert({ 
        season_id: SEASON_ID, gw_number: currentProcessingGw, is_finished: isGwFinished, data_checked: currentGwData.data_checked 
      });

      // 3. Process Live FPL Data & Build Points Maps
      let allDiscoveredManagers: any[] = [];
      const h2hMatches: { m1: number, m2: number, p1: number, p2: number }[] = [];
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

        // Fetch H2H Fixtures for Current Processing Gameweek
        const matchRes = await fetch(`https://fantasy.premierleague.com/api/leagues-h2h-matches/league/${division.fplId}/?event=${currentProcessingGw}`);
        if (matchRes.ok) {
          const matchData = await matchRes.json();
          for (const match of matchData.results) {
            if (!match.entry_1_entry || !match.entry_2_entry) continue;
            h2hMatches.push({ m1: Number(match.entry_1_entry), m2: Number(match.entry_2_entry), p1: match.entry_1_points, p2: match.entry_2_points });
          }
        }
      }

      // Fetch Individual Points. `points` is stored NET of transfer hits: the score FPL uses
      // for H2H fixture results, and the one every ITF competition is decided on. FPL's
      // history endpoint reports gross points with the hit separate, and only updates once the
      // week is processed; for the in-progress week the net score is this week's overall total
      // minus last week's stored total (overall totals are always net).
      const { data: prevTotalRows } = currentProcessingGw > 1
        ? await supabase.from('manager_gw_scores').select('manager_fpl_id, classic_total_points').eq('season_id', SEASON_ID).eq('gw_number', currentProcessingGw - 1)
        : { data: [] as any[] };
      const prevTotals: Record<number, number> = {};
      (prevTotalRows || []).forEach((r: any) => { prevTotals[Number(r.manager_fpl_id)] = r.classic_total_points; });

      for (const manager of allDiscoveredManagers) {
        await supabase.from('managers').upsert({ fpl_id: manager.fpl_id, real_name: manager.real_name });
        await supabase.from('season_managers').upsert({ season_id: SEASON_ID, manager_fpl_id: manager.fpl_id, team_name: manager.team_name, division: manager.division });

        let gwStats: { net: number, points_on_bench: number, event_transfers_cost: number, total_points: number } | null = null;

        if (!isGwFinished) {
          const entryRes = await fetch(`https://fantasy.premierleague.com/api/entry/${manager.fpl_id}/`);
          if (entryRes.ok) {
            const entry = await entryRes.json();
            if (entry.current_event === currentProcessingGw) {
              let prevTotal = prevTotals[manager.fpl_id];
              if (prevTotal === undefined) {
                prevTotal = 0;
                if (currentProcessingGw > 1) {
                  const historyRes = await fetch(`https://fantasy.premierleague.com/api/entry/${manager.fpl_id}/history/`);
                  if (historyRes.ok) {
                    const historyData = await historyRes.json();
                    prevTotal = historyData.current.find((h: any) => h.event === currentProcessingGw - 1)?.total_points ?? 0;
                  }
                }
              }
              const overall = entry.summary_overall_points ?? prevTotal;
              gwStats = { net: overall - prevTotal, points_on_bench: 0, event_transfers_cost: 0, total_points: overall };
            }
          }
        }

        if (!gwStats) {
          const historyRes = await fetch(`https://fantasy.premierleague.com/api/entry/${manager.fpl_id}/history/`);
          if (!historyRes.ok) continue;
          const historyData = await historyRes.json();
          const h = historyData.current.find((x: any) => x.event === currentProcessingGw);
          if (h) gwStats = { net: h.points - (h.event_transfers_cost || 0), points_on_bench: h.points_on_bench, event_transfers_cost: h.event_transfers_cost, total_points: h.total_points };
        }

        if (gwStats) {
          managerPointsMap[manager.fpl_id] = gwStats.net;
          scoresToInsert.push({
            season_id: SEASON_ID, gw_number: currentProcessingGw, manager_fpl_id: manager.fpl_id,
            points: gwStats.net, bench_points: gwStats.points_on_bench,
            transfers_cost: gwStats.event_transfers_cost, classic_total_points: gwStats.total_points
          });
        }
      }

      // Before the first kickoff every live total is 0, which would record a phantom 0-0 draw
      // for every H2H tie. Write nothing for the live week until some points exist.
      const hasLiveData = isGwFinished || Object.values(managerPointsMap).some(p => p > 0);

      for (const match of h2hMatches) {
        // FPL's H2H match points stay 0-0 until the week is processed; use our live totals meanwhile.
        const p1 = isGwFinished ? match.p1 : (managerPointsMap[match.m1] ?? 0);
        const p2 = isGwFinished ? match.p2 : (managerPointsMap[match.m2] ?? 0);
        let res1 = 'D', res2 = 'D';
        if (p1 > p2) { res1 = 'W'; res2 = 'L'; }
        else if (p1 < p2) { res1 = 'L'; res2 = 'W'; }

        h2hToInsert.push({ season_id: SEASON_ID, gw_number: currentProcessingGw, manager_fpl_id: match.m1, opponent_fpl_id: match.m2, manager_score: p1, opponent_score: p2, result: res1 });
        h2hToInsert.push({ season_id: SEASON_ID, gw_number: currentProcessingGw, manager_fpl_id: match.m2, opponent_fpl_id: match.m1, manager_score: p2, opponent_score: p1, result: res2 });
      }

      if (hasLiveData && scoresToInsert.length > 0) await supabase.from('manager_gw_scores').upsert(scoresToInsert, { onConflict: 'season_id,gw_number,manager_fpl_id' });
      if (hasLiveData && h2hToInsert.length > 0) await supabase.from('h2h_fixtures').upsert(h2hToInsert, { onConflict: 'season_id,gw_number,manager_fpl_id' });

      // =========================================
      // 4. CUSTOM LEAGUES & CUPS ENGINE
      // =========================================

      // A. THE ELIMINATOR runs once after the gameweek loop (see runEliminator)

      // B. CHAMPIONS LEAGUE ENGINE
      const { data: clConfig } = await supabase.from('champions_league_config').select('*').eq('season_id', SEASON_ID).single();
      const { data: clEntrantsData } = await supabase.from('champions_league_entrants').select('manager_fpl_id').eq('season_id', SEASON_ID);
      const clEntrants = clEntrantsData?.map(e => Number(e.manager_fpl_id)) || [];

      if (clConfig && clEntrants.length > 0) {
        const { data: fixturesToResult } = await supabase.from('tournament_fixtures').select('*').eq('season_id', SEASON_ID).eq('tournament_type', 'CHAMPIONS_LEAGUE').eq('gw_number', currentProcessingGw);
        if (fixturesToResult && fixturesToResult.length > 0) {
          for (const fix of fixturesToResult) {
            const score1 = managerPointsMap[fix.manager_1_id] ?? 0;
            const score2 = managerPointsMap[fix.manager_2_id] ?? 0;
            let winner = null;
            if (score1 > score2) winner = fix.manager_1_id; else if (score2 > score1) winner = fix.manager_2_id;
            await supabase.from('tournament_fixtures').update({ manager_1_score: score1, manager_2_score: score2, winner_id: winner }).eq('id', fix.id);
          }
        }

        let stageToSchedule = null, activeManagers: number[] = [], schedStartGw = 0, maxRounds = 0;
        if (currentProcessingGw === clConfig.stage_1_start_gw) {
          stageToSchedule = 'Stage 1'; activeManagers = [...clEntrants]; schedStartGw = clConfig.stage_1_start_gw;
          const p = activeManagers.length % 2 === 0 ? activeManagers.length : activeManagers.length + 1;
          maxRounds = 2 * (p - 1);
        } else if (currentProcessingGw === clConfig.stage_2_start_gw && isGwFinished) {
          stageToSchedule = 'Stage 2'; 
          const stage1Standings = await getStageStandings('Stage 1', clEntrants);
          activeManagers = stage1Standings.slice(0, -1).map(s => s.id); schedStartGw = clConfig.stage_2_start_gw;
          const p = activeManagers.length % 2 === 0 ? activeManagers.length : activeManagers.length + 1;
          maxRounds = 3 * (p - 1);
        } else if (currentProcessingGw === clConfig.final_start_gw && isGwFinished) {
          stageToSchedule = 'Final';
          const stage1Standings = await getStageStandings('Stage 1', clEntrants);
          const s2Standings = await getStageStandings('Stage 2', stage1Standings.slice(0, -1).map(s => s.id));
          activeManagers = s2Standings.slice(0, 2).map(s => s.id); schedStartGw = clConfig.final_start_gw; maxRounds = 1;
        }

        if (stageToSchedule && activeManagers.length > 0) {
          const clFixtures = [], futureGws = [];
          let players = [...activeManagers]; 
          if (players.length % 2 !== 0) players.push(-1);

          const numPlayers = players.length;
          const numUniqueRounds = numPlayers - 1;

          for (let roundIndex = 0; roundIndex < maxRounds; roundIndex++) {
            futureGws.push({ season_id: SEASON_ID, gw_number: schedStartGw + roundIndex, is_finished: false });
          }
          await supabase.from('gameweeks').upsert(futureGws, { onConflict: 'season_id,gw_number', ignoreDuplicates: true });

          for (let roundIndex = 0; roundIndex < maxRounds; roundIndex++) {
            const actualRound = roundIndex % numUniqueRounds;
            const fixed = players[0];
            const rotatable = players.slice(1);
            for (let r = 0; r < actualRound; r++) rotatable.unshift(rotatable.pop() as number);
            const currentWeekPlayers = [fixed, ...rotatable];
            const matchGw = schedStartGw + roundIndex;

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
        if (currentProcessingGw >= obConfig.qualifiers_start_gw && currentProcessingGw < obConfig.knockout_start_gw && isGwFinished) {
          const { data: currentEntrants } = await supabase.from('onion_baggers_entrants').select('*').eq('season_id', SEASON_ID);
          const qualifiedCount = currentEntrants?.length || 0;

          if (qualifiedCount < 16) {
            const qualifiedIds = currentEntrants?.map(e => Number(e.manager_fpl_id)) || [];
            
            const { data: historicalScores } = await supabase
              .from('manager_gw_scores')
              .select('manager_fpl_id, gw_number, points')
              .eq('season_id', SEASON_ID)
              .lt('gw_number', currentProcessingGw);

            const sortedContenders = allDiscoveredManagers
              .filter(m => !qualifiedIds.includes(m.fpl_id))
              .sort((a, b) => {
                const scoreA = managerPointsMap[a.fpl_id] ?? 0;
                const scoreB = managerPointsMap[b.fpl_id] ?? 0;
                if (scoreB !== scoreA) return scoreB - scoreA;

                for (let lookbackGw = currentProcessingGw - 1; lookbackGw >= 1; lookbackGw--) {
                  const histA = historicalScores?.find(s => Number(s.manager_fpl_id) === a.fpl_id && s.gw_number === lookbackGw)?.points || 0;
                  const histB = historicalScores?.find(s => Number(s.manager_fpl_id) === b.fpl_id && s.gw_number === lookbackGw)?.points || 0;
                  if (histB !== histA) return histB - histA;
                }

                return a.fpl_id - b.fpl_id;
              });

            const winners = sortedContenders.slice(0, 2);
            const inserts = winners.map((w, idx) => ({
              season_id: SEASON_ID, manager_fpl_id: w.fpl_id,
              seed: qualifiedCount + idx + 1, qualified_in_gw: currentProcessingGw
            }));

            if (inserts.length > 0) {
              await supabase.from('onion_baggers_entrants').insert(inserts);
            }
          }
        }

        if (currentProcessingGw === obConfig.knockout_start_gw && isGwFinished) {
          const { data: entrants } = await supabase.from('onion_baggers_entrants').select('*').eq('season_id', SEASON_ID);
          if (entrants && entrants.length === 16) {
            const seedMap: Record<number, number> = {};
            entrants.forEach(e => seedMap[e.seed] = Number(e.manager_fpl_id));
            
            const r16Matchups = [[1, 16], [8, 9], [4, 13], [5, 12], [2, 15], [7, 10], [3, 14], [6, 11]];
            const r16Fixtures = r16Matchups.map((m, idx) => ({
              season_id: SEASON_ID, gw_number: currentProcessingGw, tournament_type: 'ONION_BAGGERS_CUP', stage: 'Round of 16',
              manager_1_id: seedMap[m[0]], manager_2_id: seedMap[m[1]],
              manager_1_score: null, manager_2_score: null, winner_id: null,
              match_order: idx
            }));
            await supabase.from('tournament_fixtures').insert(r16Fixtures);
          }
        }

        if (currentProcessingGw >= obConfig.knockout_start_gw) {
          const { data: activeFixtures } = await supabase
            .from('tournament_fixtures')
            .select('*')
            .eq('season_id', SEASON_ID)
            .eq('tournament_type', 'ONION_BAGGERS_CUP')
            .eq('gw_number', currentProcessingGw)
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
                    season_id: SEASON_ID, gw_number: currentProcessingGw + 1, tournament_type: 'ONION_BAGGERS_CUP', stage: nextStage,
                    manager_1_id: resolvedFixtures[i].winner_id, manager_2_id: resolvedFixtures[i+1].winner_id,
                    manager_1_score: null, manager_2_score: null, winner_id: null,
                    match_order: i / 2
                  });
                }
                await supabase.from('gameweeks').upsert([{ season_id: SEASON_ID, gw_number: currentProcessingGw + 1, is_finished: false }], { onConflict: 'season_id,gw_number', ignoreDuplicates: true });
                await supabase.from('tournament_fixtures').insert(nextRoundFixtures);
              }
            }
          }
        }
      }
    } // End of Gameweek Loop

    await runEliminator();

    // Lets the site show "updated n min ago". Stored as a reserved page_content row (see lib/sync-status.ts).
    await supabase.from('page_content').upsert({ id: 'sync-status', gw_number: 0, title: 'Last ingest', content: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'id,gw_number' });

    return NextResponse.json({ success: true, message: `Caught up to GW ${activeApiGw} successfully.` });

  } catch (error: any) {
    console.error('Ingestion Engine error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
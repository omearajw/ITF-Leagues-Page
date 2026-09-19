import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import TeamName from '@/components/TeamName';
import PageHeader from '@/components/PageHeader';
import GameweekBadge from '@/components/GameweekBadge';
import Planner, { type PlanPlayer, type PlanSlot, type PlanStakes } from '@/components/Planner';
import { DivisionSkeleton } from '@/components/Skeletons';
import { getGameweekStatus, getFplEvents, SEASON_ID, formatUk } from '@/lib/gameweek-status';
import { getPlayers, getManagerPicks, getFixtureRuns } from '@/lib/fpl-manager';
import { getLeagueOwnership, getNextOpponent } from '@/lib/planner-data';
import { buildMotm } from '@/lib/motm';
import { DIVISIONS } from '@/lib/divisions';

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const managerId = parseInt(id, 10);
  if (!Number.isFinite(managerId)) notFound();

  const supabase = await createClient();
  const { data: seasonRow } = await supabase.from('season_managers').select('manager_fpl_id, team_name, division, managers!inner (real_name)').eq('season_id', SEASON_ID).eq('manager_fpl_id', managerId).maybeSingle();
  if (!seasonRow) notFound();

  return (
    <div className="max-w-7xl mx-auto py-2 sm:py-8 font-sans">
      <Suspense fallback={<DivisionSkeleton />}>
        <PlanContent managerId={managerId} manager={seasonRow} />
      </Suspense>
    </div>
  );
}

async function PlanContent({ managerId, manager }: { managerId: number; manager: any }) {
  const supabase = await createClient();
  const [gw, events] = await Promise.all([getGameweekStatus(), getFplEvents()]);

  // Plan for the next deadline; the base squad is the latest one FPL exposes
  const latestGw = Math.max(1, gw.liveGw ?? gw.syncedThroughGw);
  const planGw = Math.min(38, latestGw + 1);
  const latestIsFinal = latestGw <= gw.syncedThroughGw || !!events?.find(e => e.id === latestGw)?.finished;
  const division = DIVISIONS.find(d => d.name === manager.division);

  const [players, picks, fixtures, league, opponentId] = await Promise.all([
    getPlayers(),
    getManagerPicks(managerId, latestGw, latestIsFinal),
    getFixtureRuns(planGw, 3),
    getLeagueOwnership(latestGw, latestIsFinal),
    division ? getNextOpponent(managerId, division.fplId, planGw) : Promise.resolve(null),
  ]);

  const [opponentPicks, { data: opponentRow }, { data: elimRows }, { data: lastWeekScores }, { data: managerRows }, { data: allScores }, { data: obConfig }] = await Promise.all([
    opponentId ? getManagerPicks(opponentId, latestGw, latestIsFinal) : Promise.resolve(null),
    opponentId ? supabase.from('season_managers').select('team_name').eq('season_id', SEASON_ID).eq('manager_fpl_id', opponentId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('eliminator_status').select('manager_fpl_id, is_eliminated, eliminated_gw, season_managers!inner (team_name)').eq('season_id', SEASON_ID),
    supabase.from('manager_gw_scores').select('manager_fpl_id, points').eq('season_id', SEASON_ID).eq('gw_number', gw.syncedThroughGw),
    supabase.from('season_managers').select('manager_fpl_id, team_name, division, managers!inner (real_name)').eq('season_id', SEASON_ID),
    supabase.from('manager_gw_scores').select('manager_fpl_id, gw_number, points').eq('season_id', SEASON_ID).lte('gw_number', gw.syncedThroughGw),
    supabase.from('onion_baggers_config').select('*').eq('season_id', SEASON_ID).maybeSingle(),
  ]);

  if (!players || !picks) {
    return (
      <>
        <PageHeader title={<TeamName name={manager.team_name} inline />} badge={<GameweekBadge provisional={false}>Planner</GameweekBadge>} />
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded-xl p-6 text-sm">FPL data is not available right now, so the planner cannot load this squad. Try again in a minute.</div>
      </>
    );
  }

  const planPlayers: PlanPlayer[] = Object.values(players).map(p => ({
    id: p.id, code: p.code, name: p.name, team: p.team, teamId: p.teamId, teamCode: p.teamCode, position: p.position, price: p.price, priceChange: p.priceChange,
    form: p.form, totalPoints: p.totalPoints, ownership: p.ownership, status: p.status, news: p.news, chance: p.chance,
  }));
  const toSlots = (list: { element: number; position: number; is_captain: boolean; is_vice_captain: boolean }[]): PlanSlot[] =>
    list.map(p => ({ element: p.element, position: p.position, isCaptain: p.is_captain, isVice: p.is_vice_captain }));

  // Stakes
  const names: Record<number, string> = Object.fromEntries((managerRows || []).map((m: any) => [Number(m.manager_fpl_id), m.team_name]));
  const myElim = (elimRows || []).find((e: any) => Number(e.manager_fpl_id) === managerId) as any;
  const aliveIds = new Set((elimRows || []).filter((e: any) => !e.is_eliminated).map((e: any) => Number(e.manager_fpl_id)));
  const lastWeek = (lastWeekScores || []).map((s: any) => ({ id: Number(s.manager_fpl_id), points: s.points }));
  const lowestAlive = lastWeek.filter(s => aliveIds.has(s.id) && s.id !== managerId).sort((a, b) => a.points - b.points)[0] || null;
  const eliminator: PlanStakes['eliminator'] = myElim ? {
    alive: !myElim.is_eliminated, eliminatedGw: myElim.eliminated_gw, week: gw.syncedThroughGw,
    myPoints: lastWeek.find(s => s.id === managerId)?.points ?? null,
    lowestAlive: lowestAlive ? { name: names[lowestAlive.id] || 'a survivor', points: lowestAlive.points } : null,
    aliveCount: aliveIds.size,
  } : null;

  let motm: PlanStakes['motm'] = null;
  if (events) {
    const months = buildMotm({
      events, syncedThroughGw: gw.syncedThroughGw,
      managers: (managerRows || []).map((m: any) => ({ id: Number(m.manager_fpl_id), teamName: m.team_name, realName: m.managers.real_name, division: m.division })),
      scores: (allScores || []).map((s: any) => ({ manager_fpl_id: Number(s.manager_fpl_id), gw_number: s.gw_number, points: s.points })),
      divisions: DIVISIONS.map(d => d.name),
    });
    const current = months[0];
    const div = current?.divisions.find(d => d.division === manager.division);
    const idx = div ? div.standings.findIndex(s => s.id === managerId) : -1;
    if (current && div && idx >= 0) {
      motm = { month: current.label, position: idx + 1, points: div.standings[idx].points, leader: div.standings[0] ? { name: div.standings[0].teamName, points: div.standings[0].points } : null, complete: current.complete };
    }
  }
  const obCup = obConfig
    ? (planGw < obConfig.qualifiers_start_gw ? `Qualifying starts GW${obConfig.qualifiers_start_gw}; the two highest scorers each week qualify.` : planGw < obConfig.knockout_start_gw ? 'Qualifying is live: the two highest net scores this week who have not already qualified go through.' : 'Knockout rounds are running.')
    : null;

  const deadlineIso = events?.find(e => e.id === planGw)?.deadline_time || null;

  return (
    <>
      <PageHeader
        title={<TeamName name={manager.team_name} inline className="min-w-0" />}
        titleExtra={<span className="text-xs sm:text-sm px-3 py-1 rounded-full font-bold tracking-widest uppercase bg-brand text-white">Planner</span>}
        badge={<GameweekBadge provisional={false}>GW{planGw} · deadline {formatUk(deadlineIso)}</GameweekBadge>}
        actions={<Link href={`/manager/${managerId}`} className="text-xs sm:text-sm bg-surface-3 text-ink px-3 py-1.5 rounded-full font-semibold hover:bg-surface-2">&larr; Team page</Link>}
      >
        <p className="text-sm text-dim">Plan GW{planGw} against your real opponent. Changes save in this browser until you apply them on FPL.</p>
      </PageHeader>

      <Planner
        managerId={managerId}
        teamName={manager.team_name}
        planGw={planGw}
        deadline={deadlineIso ? formatUk(deadlineIso) : null}
        baseSquad={toSlots(picks.picks)}
        bank={picks.entry_history.bank / 10}
        players={planPlayers}
        fixtures={fixtures || {}}
        ownership={league.ownership}
        leagueSize={league.managers}
        opponent={opponentId && opponentPicks ? { id: opponentId, name: (opponentRow as any)?.team_name || 'Opponent', squad: toSlots(opponentPicks.picks) } : null}
        stakes={{ eliminator, motm, obCup }}
      />
    </>
  );
}

import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cacheLife, cacheTag } from 'next/cache';
import { createPublicClient } from '@/utils/supabase/public';
import { SITE_DATA_TAG } from '@/lib/site-cache';
import TeamName, { getTeamNameDisplayText } from '@/components/TeamName';
import PageHeader from '@/components/PageHeader';
import { GameweekChip } from '@/components/GameweekBadge';
import PitchView, { type PitchPlayer, type PitchOpponent } from '@/components/PitchView';
import { ManagerSkeleton, Bone } from '@/components/Skeletons';
import { getGameweekStatus, getFplEvents, SEASON_ID, formatUk, formatUkTime } from '@/lib/gameweek-status';
import { fplAsOf } from '@/lib/fpl-mirror';
import { breakdownFrom } from '@/lib/score-breakdown';
import { uniqueTies } from '@/lib/tournament-fixtures';
import { getWeekProjection, dueFor, liveWeekScore } from '@/lib/projection';
import { getPlayers, getManagerPicks, getLivePoints, getManagerTransfers, getManagerEntry, getGwFixtureStatus, fplKeys, type ManagerPicks, type LiveStats, type Player, type TeamGwFixture } from '@/lib/fpl-manager';
import { projectAutoSubs, type FixtureState, type AutoSubProjection } from '@/lib/autosubs';
import { getLiveWeekPicks } from '@/lib/projection';
import { getMyTeamId } from '@/lib/my-team';
import { DIVISIONS } from '@/lib/divisions';
import TeamBadge from '@/components/TeamBadge';
import SectionHeading from '@/components/SectionHeading';
import { getLeagueBadges } from '@/lib/badges';

// Three steps, each showing as soon as it can: the page frame straight away, the team's name once
// it is looked up, then the week's data. Anything awaited up here, outside a Suspense, would hold
// the whole page on the root loading screen instead.
export default function ManagerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ gw?: string }> }) {
  return (
    <div className="max-w-5xl mx-auto py-2 sm:py-8 font-sans">
      <Suspense fallback={<><ManagerHeader /><ManagerSkeleton /></>}>
        <ManagerLoader params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ManagerLoader({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ gw?: string }> }) {
  const { id } = await params;
  const { gw } = await searchParams;
  const managerId = parseInt(id, 10);
  if (!Number.isFinite(managerId)) notFound();
  const requestedGw = gw ? parseInt(gw, 10) : NaN;

  const [seasonRow, myTeamId] = await Promise.all([getSeasonManager(managerId), getMyTeamId()]);
  if (!seasonRow) notFound();

  return (
    <Suspense fallback={<><ManagerHeader team={seasonRow.team_name} manager={(seasonRow as any).managers.real_name} division={seasonRow.division} /><ManagerSkeleton /></>}>
      <ManagerContent managerId={managerId} manager={seasonRow} requestedGw={Number.isFinite(requestedGw) ? requestedGw : null} myTeamId={myTeamId} />
    </Suspense>
  );
}

// The loading header: the real name, manager and division once known, placeholders before.
function ManagerHeader({ team, manager, division }: { team?: string; manager?: string; division?: string }) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 sm:gap-x-8 gap-y-5 mb-6">
      <PageHeader pending className="min-w-0" title={team ? <TeamName name={team} inline wrap showStars starSize={14} /> : <Bone className="h-10 sm:h-14 w-72 max-w-full" />}>
        {manager ? (
          <p className="-mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-dim">
            <span className="font-semibold text-ink-2">{manager}</span>
            <span className="whitespace-nowrap"><span aria-hidden="true" className="mr-2">·</span>{division}</span>
          </p>
        ) : <Bone className="-mt-1 h-4 w-48" />}
      </PageHeader>
      <Bone className="col-start-2 row-start-1 sm:row-span-2 mt-[17px] sm:mt-0 w-20 h-20 sm:w-36 sm:h-36 lg:w-44 lg:h-44" />
      <div className="col-span-full sm:col-span-1"><Bone className="h-8 w-36" /></div>
    </header>
  );
}

async function getSeasonManager(managerId: number) {
  'use cache: remote';
  cacheTag(SITE_DATA_TAG);
  cacheLife('league');
  const { data } = await createPublicClient()
    .from('season_managers')
    .select('manager_fpl_id, team_name, division, managers!inner (real_name)')
    .eq('season_id', SEASON_ID)
    .eq('manager_fpl_id', managerId)
    .maybeSingle();
  return data;
}

// Cached per team, week and visitor's own team (which only changes the buttons). A live week is
// kept for a minute, as its points come straight from FPL; a finished week until the next ingest.
async function ManagerContent({ managerId, manager, requestedGw, myTeamId }: { managerId: number; manager: any; requestedGw: number | null; myTeamId: number | null }) {
  'use cache: remote';
  cacheTag(SITE_DATA_TAG);
  const supabase = createPublicClient();
  const [gw, events] = await Promise.all([getGameweekStatus(), getFplEvents()]);

  // Picks exist for any gameweek whose deadline has passed
  const latestGw = Math.max(1, gw.liveGw ?? gw.syncedThroughGw);
  const selectedGw = requestedGw && requestedGw >= 1 && requestedGw <= latestGw ? requestedGw : latestGw;
  const isLiveWeek = selectedGw === gw.liveGw;
  const isFinal = selectedGw <= gw.syncedThroughGw || !!events?.find(e => e.id === selectedGw)?.finished;

  const [players, picks, live, transfers, entry, { data: scoreRow }, { data: h2h }, { data: elim }, { data: recent }, fixtureStatus, badges] = await Promise.all([
    getPlayers(),
    isLiveWeek ? getLiveWeekPicks(managerId, selectedGw) : getManagerPicks(managerId, selectedGw, isFinal),
    getLivePoints(selectedGw, isFinal),
    getManagerTransfers(managerId),
    getManagerEntry(managerId),
    supabase.from('manager_gw_scores').select('points, transfers_cost, classic_total_points').eq('season_id', SEASON_ID).eq('manager_fpl_id', managerId).eq('gw_number', selectedGw).maybeSingle(),
    supabase.from('h2h_fixtures').select('opponent_fpl_id, manager_score, opponent_score, result').eq('season_id', SEASON_ID).eq('manager_fpl_id', managerId).eq('gw_number', selectedGw).maybeSingle(),
    supabase.from('eliminator_status').select('is_eliminated, eliminated_gw').eq('season_id', SEASON_ID).eq('manager_fpl_id', managerId).maybeSingle(),
    supabase.from('h2h_fixtures').select('gw_number, result').eq('season_id', SEASON_ID).eq('manager_fpl_id', managerId).lte('gw_number', gw.syncedThroughGw).order('gw_number', { ascending: false }).limit(5),
    getGwFixtureStatus(selectedGw, isFinal),
    getLeagueBadges(),
  ]);
  if (!gw.fplAvailable || !players || !picks) cacheLife('brief');
  else if (isLiveWeek) cacheLife('clock');
  else cacheLife('league');
  const isUnprocessed = !isFinal;

  const opponentId = h2h ? Number((h2h as any).opponent_fpl_id) : null;
  const [opponentRow, opponentPicks] = opponentId
    ? await Promise.all([
        supabase.from('season_managers').select('team_name').eq('season_id', SEASON_ID).eq('manager_fpl_id', opponentId).maybeSingle().then(r => r.data),
        isLiveWeek ? getLiveWeekPicks(opponentId, selectedGw) : getManagerPicks(opponentId, selectedGw, isFinal),
      ])
    : [null, null];
  const opponentName = opponentRow ? getTeamNameDisplayText(opponentRow.team_name) : null;

  const division = DIVISIONS.find(d => d.name === manager.division);
  const cost = picks?.entry_history.event_transfers_cost ?? scoreRow?.transfers_cost ?? 0;
  const fixtureStateFor = (pl: Player | undefined): FixtureState => {
    const list: TeamGwFixture[] = pl ? (fixtureStatus?.[pl.teamId] || []) : [];
    if (!fixtureStatus) return 'finished';
    if (list.length === 0) return 'none';
    if (list.some(f => f.started && !f.finished)) return 'playing';
    if (list.some(f => !f.started)) return 'pending';
    return 'finished';
  };

  // Turn FPL picks into pitch players, projecting auto-subs while the week is unprocessed.
  const decorate = (set: ManagerPicks, liveStats: LiveStats | null) => {
    const base = set.picks.map(p => {
      const pl = players?.[p.element];
      return {
        element: p.element, name: pl?.name || `#${p.element}`, team: pl?.team || '', teamCode: pl?.teamCode || 0, code: pl?.code || 0,
        position: pl?.position || 'MID' as const, slot: p.position,
        points: liveStats ? (liveStats[p.element]?.total_points ?? 0) : null,
        minutes: liveStats ? (liveStats[p.element]?.minutes ?? 0) : 0,
        multiplier: p.multiplier, isCaptain: p.is_captain, isVice: p.is_vice_captain,
        subbedIn: set.automatic_subs.some(a => a.element_in === p.element), subbedOut: set.automatic_subs.some(a => a.element_out === p.element),
        fixtureState: isUnprocessed ? fixtureStateFor(pl) : 'finished' as FixtureState,
      };
    });
    const projection = isUnprocessed && liveStats && set.automatic_subs.length === 0
      ? projectAutoSubs(base.map(b => ({ element: b.element, position: b.slot, role: b.position, minutes: b.minutes, points: b.points ?? 0, fixtureState: b.fixtureState, isCaptain: b.isCaptain, isVice: b.isVice })), set.active_chip)
      : null;
    const toPitch = (b: typeof base[number]): PitchPlayer => ({
      element: b.element, name: b.name, team: b.team, teamCode: b.teamCode, code: b.code, position: b.position,
      points: b.points, multiplier: b.multiplier, isCaptain: b.isCaptain, isVice: b.isVice,
      subbedIn: b.subbedIn, subbedOut: b.subbedOut,
      fixtureState: isUnprocessed ? b.fixtureState : undefined, minutes: b.minutes,
      projectedOut: !!projection?.out.includes(b.element), projectedIn: !!projection?.in.includes(b.element),
      projectedUnreplaced: !!projection?.unreplaced.includes(b.element),
      projectedCaptain: !!projection?.captainToVice && b.isVice,
      benchBoost: !!projection?.benchBoost,
      breakdown: breakdownFrom(liveStats?.[b.element]?.explain),
    });
    return {
      starters: base.filter(b => b.slot <= 11).map(toPitch),
      bench: base.filter(b => b.slot > 11).sort((a, b) => a.slot - b.slot).map(toPitch),
      projection,
    };
  };

  const mine = picks ? decorate(picks, live) : null;
  const starters = mine?.starters || [];
  const bench = mine?.bench || [];
  const benchDue = (mine?.projection?.benchDue || 0) + (mine?.projection?.captainExtra || 0);
  const benchBoostOn = !!mine?.projection?.benchBoost;
  const theirs = opponentPicks ? decorate(opponentPicks, live) : null;

  // In the live week every figure is worked out from the same live points the pitch shows, for
  // both teams. FPL's own summary (entry_history) stays at 0 until the week is processed, and the
  // stored scores only move with the ingest every 15 minutes, so either would disagree with the
  // pitch and with the opponent's page.
  const liveFigures = (set: ManagerPicks | null, projection: AutoSubProjection | null | undefined) => {
    if (!isLiveWeek || !live || !set) return null;
    const pts = (element: number) => live[element]?.total_points ?? 0;
    const gross = set.picks.reduce((sum, p) => sum + pts(p.element) * p.multiplier, 0);
    const hits = set.entry_history.event_transfers_cost || 0;
    const benchPoints = set.picks.filter(p => p.position > 11).reduce((sum, p) => sum + pts(p.element), 0);
    const due = (projection?.benchDue || 0) + (projection?.captainExtra || 0);
    return { gross, net: gross - hits, bench: benchPoints, score: gross - hits + due };
  };
  const mineLive = liveFigures(picks, mine?.projection);
  const theirsLive = liveFigures(opponentPicks, theirs?.projection);
  const gross = mineLive?.gross ?? picks?.entry_history.points ?? null;
  const net = mineLive?.net ?? scoreRow?.points ?? (gross !== null ? gross - cost : null);
  const benchPoints = mineLive?.bench ?? picks?.entry_history.points_on_bench ?? 0;
  // When FPL has stopped answering, the live points are the last copy we have; say how old.
  const liveAsOf = isLiveWeek && live ? fplAsOf(fplKeys.live(selectedGw, false)) : null;
  const pointsNote = liveAsOf && Date.now() - liveAsOf > 4 * 60_000 ? `FPL not responding · points as of ${formatUkTime(new Date(liveAsOf).toISOString())}` : undefined;
  // Season points as the Open counts them: the stored total with this week's stored score swapped
  // for the live one. FPL's own running total (entry) is refreshed less often and can disagree.
  const seasonPoints = mineLive && scoreRow ? scoreRow.classic_total_points - scoreRow.points + mineLive.score : entry?.summary_overall_points;

  const pitchOpponent: PitchOpponent | null = theirs && opponentName ? {
    name: opponentName, week: selectedGw, starters: theirs.starters, bench: theirs.bench, benchPoints: theirsLive?.bench ?? opponentPicks!.entry_history.points_on_bench,
  } : null;
  const weekTransfers = (transfers || []).filter(t => t.event === selectedGw);
  // Net effect of the week's business: what the new players scored, less what the sold ones
  // scored and the hit. Raw player points, so bench and captaincy are not taken into account.
  const pointsOf = (element: number) => live?.[element]?.total_points ?? 0;
  const pointsIn = weekTransfers.reduce((sum, t) => sum + pointsOf(t.element_in), 0);
  const pointsOut = weekTransfers.reduce((sum, t) => sum + pointsOf(t.element_out), 0);
  const transferNet = pointsIn - pointsOut - cost;
  const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
  // Newest first so the current week is visible without scrolling on a phone
  const weeks = Array.from({ length: latestGw }, (_, i) => latestGw - i);
  const chipLabel: Record<string, string> = { wildcard: 'Wildcard', freehit: 'Free Hit', bboost: 'Bench Boost', '3xc': 'Triple Captain', manager: 'Assistant Manager' };
  // The result only stands once the week is synced; until then it is read from the live scores.
  const tie = h2h as { manager_score: number; opponent_score: number; result: string | null } | null;
  const tieSettled = selectedGw <= gw.syncedThroughGw;
  const matchScore = mineLive && theirsLive ? [mineLive.score, theirsLive.score] : tie ? [Number(tie.manager_score), Number(tie.opponent_score)] : null;
  const tieMargin = matchScore ? matchScore[0] - matchScore[1] : 0;
  // This week's cup ties (Champions League, Onion Baggers Cup), shown as tiles under the league
  // match. A live week's scores come from the same live figures as everything else.
  const { data: cupRows } = await supabase.from('tournament_fixtures').select('*')
    .eq('season_id', SEASON_ID).eq('gw_number', selectedGw).or(`manager_1_id.eq.${managerId},manager_2_id.eq.${managerId}`);
  const cupTies = uniqueTies(cupRows as any[]);
  const [{ data: cupNames }, projection, { data: weekScores }] = await Promise.all([
    supabase.from('season_managers').select('manager_fpl_id, team_name').eq('season_id', SEASON_ID),
    isLiveWeek ? getWeekProjection() : Promise.resolve(null),
    supabase.from('manager_gw_scores').select('manager_fpl_id, points').eq('season_id', SEASON_ID).eq('gw_number', selectedGw),
  ]);
  const outcome = (mine: number, theirs: number, settled: boolean) => settled
    ? (mine > theirs ? 'Beat' : mine < theirs ? 'Lost to' : 'Drew with')
    : (mine > theirs ? 'Beating' : mine < theirs ? 'Losing to' : 'Drawing with');
  const cupFixtures: { competition: string; score: [number, number] | null; opponentId: number | null; opponentName: string; outcome: string | null }[] = [];
  for (const t of cupTies) {
    const mineFirst = t.manager_1_id === managerId;
    const themId = (mineFirst ? t.manager_2_id : t.manager_1_id) as number;
    const storedMine = mineFirst ? t.manager_1_score : t.manager_2_score;
    const storedTheirs = mineFirst ? t.manager_2_score : t.manager_1_score;
    const played = storedMine !== null && storedTheirs !== null;
    const mine = played ? (isLiveWeek && mineLive ? mineLive.score : storedMine) : null;
    const theirs = played ? (isLiveWeek && projection ? liveWeekScore(dueFor(projection, selectedGw, themId), storedTheirs) : storedTheirs) : null;
    const name = (cupNames || []).find((n: any) => Number(n.manager_fpl_id) === themId)?.team_name;
    cupFixtures.push({
      competition: (t as any).tournament_type === 'ONION_BAGGERS_CUP' ? 'Onion Baggers Cup' : 'Champions League',
      score: mine !== null && theirs !== null ? [mine, theirs] : null,
      opponentId: themId, opponentName: name ? getTeamNameDisplayText(name) : 'opponent',
      outcome: mine !== null && theirs !== null ? outcome(mine, theirs, selectedGw <= gw.syncedThroughGw) : null,
    });
  }

  // The Team of the Week race: how this team stands against the week's top score. A live week uses
  // the shared live copy for every team (as the rest of the site does), a finished week the
  // stored scores.
  const teamName = (id: number) => getTeamNameDisplayText((cupNames || []).find((n: any) => Number(n.manager_fpl_id) === id)?.team_name || 'another team');
  const weekTable = (weekScores || []).map((r: any) => {
    const id = Number(r.manager_fpl_id);
    return { id, points: isLiveWeek && projection ? liveWeekScore(dueFor(projection, selectedGw, id), r.points) : r.points };
  }).sort((a, b) => b.points - a.points);
  const myWeek = weekTable.find(r => r.id === managerId);
  const top = weekTable[0];
  const others = weekTable.filter(r => r.id !== managerId);
  const totwTile: TileProps = !myWeek || !top || top.points === 0
    ? { label: 'Team of the week', value: '–', sub: 'no scores yet' }
    : myWeek.points >= top.points
      ? {
          label: 'Team of the week', value: isLiveWeek ? 'Top' : 'Won',
          sub: others[0] && others[0].points === myWeek.points ? `shared with ${teamName(others[0].id)}` : others[0] ? `${myWeek.points - others[0].points} clear of ${teamName(others[0].id)}` : '',
          filled: !isLiveWeek,
        }
      : { label: 'Team of the week', value: `−${top.points - myWeek.points}`, sub: `behind ${teamName(top.id)} (${top.points})${isLiveWeek ? ' · as it stands' : ''}` };

  // Headline score includes projected auto-subs; FPL's own live figure excludes them until the week is processed.
  const scoreTiles: TileProps[] = picks ? [
    { label: 'Score', value: benchDue > 0 && net !== null ? net + benchDue : (net ?? '–'), sub: benchBoostOn ? 'bench boost: all 15 count' : benchDue > 0 && net !== null ? `includes +${benchDue} due from the bench · ${net} before subs` : isLiveWeek ? 'live · net of hits' : 'net of hits' },
    { label: 'Team points', value: gross ?? '–', sub: 'before hits' },
    { label: 'Transfers', value: `${picks.entry_history.event_transfers}${cost ? ` (−${cost})` : ''}`, sub: cost ? 'points deducted' : 'no hit' },
    { label: 'On bench', value: benchPoints, sub: 'points' },
    { label: 'Chip', value: picks.active_chip ? (chipLabel[picks.active_chip] || picks.active_chip) : 'None', sub: picks.active_chip ? 'played' : '', filled: !!picks.active_chip },
    totwTile,
  ] : [];

  const tieOutcome = !tie ? null
    : tieSettled ? (tie.result === 'W' ? 'Beat' : tie.result === 'L' ? 'Lost to' : 'Drew with')
    : tieMargin > 0 ? 'Beating' : tieMargin < 0 ? 'Losing to' : 'Drawing with';
  const badgeSrc = badges[managerId];
  const isMine = myTeamId === managerId;

  const button = 'whitespace-nowrap text-sm font-semibold px-3 py-1.5 rounded-sm transition';

  return (
    <>
      {/* Three bands: who the team is (with what you can do), their season, then the week being viewed. */}
      {/* The badge sits large on the right, as the league owner asked; phones keep it beside the name. */}
      <header className={`grid items-start gap-x-4 sm:gap-x-8 gap-y-5 mb-6 ${badgeSrc ? 'grid-cols-[minmax(0,1fr)_auto]' : 'grid-cols-1'}`}>
        <PageHeader
          className="min-w-0"
          title={<TeamName name={manager.team_name} inline wrap showStars starSize={14} />}
        >
          <p className="-mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-dim">
            <span className="font-semibold text-ink-2">{manager.managers.real_name}</span>
            {/* Each separator travels with the item after it, so a wrapped line never ends on a dot. */}
            <span className="whitespace-nowrap">
              <span aria-hidden="true" className="mr-2">·</span>
              {division ? <Link href={`/divisions/${division.slug}`} className="hover:text-ink hover:underline">{manager.division}</Link> : manager.division}
            </span>
            {isMine && <span className="ml-1 label text-win-2 border border-win-2/40 rounded-sm px-1.5 py-0.5">Your team</span>}
          </p>
        </PageHeader>
        {/* Phones line it up with the top of the name, below the accent rule (5px + 12px). */}
        {badgeSrc && <TeamBadge src={badgeSrc} size={176} className="col-start-2 row-start-1 sm:row-span-2 mt-[17px] sm:mt-0 w-20 h-20 sm:w-36 sm:h-36 lg:w-44 lg:h-44" />}
        <div className="col-span-full sm:col-span-1 flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* The planner is for your own team. With no team chosen yet, the button asks which is yours first. */}
          {isMine ? (
            <Link href={`/manager/${managerId}/plan`} className={`${button} bg-brand text-white hover:bg-brand/85`}>Plan next week &rarr;</Link>
          ) : !myTeamId && (
            <Link href="/my-team?next=plan" className={`${button} bg-brand text-white hover:bg-brand/85`}>Plan next week &rarr;</Link>
          )}
          {/* The FPL links open the visitor's own FPL account, so they only make sense on their own team. */}
          {isMine ? (
            <span className="flex items-center gap-3 text-sm">
              <span className="text-dim">On FPL:</span>
              <a href="https://fantasy.premierleague.com/my-team" target="_blank" rel="noopener noreferrer" className="whitespace-nowrap text-brand-2 font-semibold hover:underline">Pick team &rarr;</a>
              <a href="https://fantasy.premierleague.com/transfers" target="_blank" rel="noopener noreferrer" className="whitespace-nowrap text-brand-2 font-semibold hover:underline">Transfers &rarr;</a>
            </span>
          ) : (
            <a href={`/api/my-team?id=${managerId}&next=${encodeURIComponent(`/manager/${managerId}`)}`} className={`${button} border border-line text-ink-2 hover:text-ink hover:border-faint`}>Set as my team</a>
          )}
        </div>
      </header>

      {(entry || elim || (recent && recent.length > 0)) && (
        <dl className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-10 gap-y-4 border-y border-line py-4 mb-8">
          {entry && (
            <div>
              <dt className="label">Overall rank</dt>
              <dd className="mt-1 text-lg font-semibold text-ink tabular">{entry.summary_overall_rank?.toLocaleString('en-GB') ?? '–'}</dd>
            </div>
          )}
          {seasonPoints !== undefined && (
            <div>
              <dt className="label">Season points</dt>
              <dd className="mt-1 text-lg font-semibold text-ink tabular">{seasonPoints}</dd>
            </div>
          )}
          {recent && recent.length > 0 && (
            <div>
              <dt className="label">League form</dt>
              <dd className="mt-1.5 flex items-center gap-1">
                {[...recent].reverse().map((r: any) => (
                  <span key={r.gw_number} className={`w-6 h-6 rounded-sm text-xs font-bold flex items-center justify-center ${r.result === 'W' ? 'bg-win text-white' : r.result === 'L' ? 'bg-loss text-white' : 'bg-surface-3 text-ink'}`} title={`GW${r.gw_number}`}>{r.result}</span>
                ))}
              </dd>
            </div>
          )}
          {elim && (
            <div>
              <dt className="label">Eliminator</dt>
              <dd className={`mt-1 text-lg font-semibold ${elim.is_eliminated ? 'text-loss-2' : 'text-win-2'}`}>{elim.is_eliminated ? `Out in GW${elim.eliminated_gw}` : 'Still in'}</dd>
            </div>
          )}
        </dl>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mb-6">
        <GameweekChip gw={gw} week={selectedGw} live={isLiveWeek} />
        <nav aria-label="Gameweek" className="flex gap-1.5 overflow-x-auto no-scrollbar min-w-0 max-w-full">
          {weeks.map(week => (
            <Link
              key={week}
              href={`/manager/${managerId}?gw=${week}`}
              aria-current={week === selectedGw ? 'page' : undefined}
              className={`shrink-0 px-3 py-1.5 rounded-sm text-xs font-bold border ${week === selectedGw ? 'bg-brand text-white border-brand' : 'border-line text-dim hover:text-ink'}`}
            >
              GW{week}{week === gw.liveGw ? ' ·' : ''}
            </Link>
          ))}
        </nav>
      </div>

      {!picks ? (
        <p className="text-live-2 border-y border-live/30 py-4 text-sm">
          Team data for GW{selectedGw} is not available from FPL right now. Line-ups appear once the gameweek deadline has passed.
        </p>
      ) : (
        <>
          {/* The week at a glance: the team's figures on the left, its fixtures on the right (the
              league match, then any cup ties), stacking on phones. */}
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] border-t-2 border-ink/80 mb-10 -mx-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 content-start">
              {scoreTiles.map(t => <StatTile key={t.label} {...t} />)}
            </div>
            <div className="lg:border-l lg:border-line lg:pl-3">
              <StatTile label={manager.division || 'League match'} value={tie && matchScore ? `${matchScore[0]} - ${matchScore[1]}` : '–'}
                sub={tie ? <>{tieOutcome} {opponentId ? <Link href={`/manager/${opponentId}`} className="hover:text-ink hover:underline">{opponentName}</Link> : opponentName}</> : 'no match recorded'} />
              {cupFixtures.length > 0 && (
                <div className="flex flex-wrap">
                  {cupFixtures.map(f => (
                    <StatTile key={f.competition} className="basis-1/2 flex-1" labelClassName="text-brand-2" label={f.competition}
                      value={f.score ? `${f.score[0]} - ${f.score[1]}` : 'v'}
                      sub={<>{f.outcome ? `${f.outcome} ` : ''}{f.opponentId ? <Link href={`/manager/${f.opponentId}`} className="hover:text-ink hover:underline">{f.opponentName}</Link> : f.opponentName}</>} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {players ? (
            <PitchView starters={starters} bench={bench} benchPoints={benchPoints} live={isLiveWeek} pointsUnavailable={live === null} note={pointsNote} opponent={pitchOpponent} />
          ) : (
            <section className="mb-10">
              <SectionHeading>Line-up</SectionHeading>
              <div className="text-live-2 border-y border-live/30 py-4 text-sm">FPL isn&apos;t responding right now, so the line-up can&apos;t be shown. Try again in a minute.</div>
            </section>
          )}

          <section className="mb-10">
            <SectionHeading className="mb-1">Transfers · GW{selectedGw}</SectionHeading>
            <div className="divide-y divide-line">
              {weekTransfers.length === 0 && <div className="py-3 text-sm text-faint italic">No transfers this week.</div>}
              {weekTransfers.map((t, i) => {
                const delta = pointsOf(t.element_in) - pointsOf(t.element_out);
                return (
                  <div key={i} className="py-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="text-loss-2 font-semibold">{players?.[t.element_out]?.name || t.element_out}</span>
                    <span className="text-dim">£{(t.element_out_cost / 10).toFixed(1)}{live && ` · ${pointsOf(t.element_out)} pts`}</span>
                    <span className="text-faint whitespace-nowrap">→</span>
                    <span className="text-win-2 font-semibold">{players?.[t.element_in]?.name || t.element_in}</span>
                    <span className="text-dim">£{(t.element_in_cost / 10).toFixed(1)}{live && ` · ${pointsOf(t.element_in)} pts`}</span>
                    {live && <span className={`ml-auto font-display text-xl leading-none ${delta > 0 ? 'text-win-2' : delta < 0 ? 'text-loss-2' : 'text-dim'}`}>{signed(delta)}</span>}
                  </div>
                );
              })}
              {cost > 0 && <div className="py-3 text-sm text-live-2">−{cost} points for {picks.entry_history.event_transfers} transfer{picks.entry_history.event_transfers === 1 ? '' : 's'}.</div>}
              {live && weekTransfers.length > 0 && (
                <div className="py-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-semibold text-ink">Transfer business{isLiveWeek ? ' so far' : ''}</span>
                  <span className="text-sm text-dim">{pointsIn} in − {pointsOut} out{cost ? ` − ${cost} hit` : ''}</span>
                  <span className={`ml-auto font-display text-3xl leading-none ${transferNet > 0 ? 'text-win-2' : transferNet < 0 ? 'text-loss-2' : 'text-dim'}`}>{signed(transferNet)}</span>
                  <span className="basis-full text-xs text-dim">Players&apos; own points for the week, before bench and captaincy.</span>
                </div>
              )}
            </div>
          </section>

          {transfers && transfers.length > 0 && (
            <details className="border-y border-line">
              <summary className="py-3 cursor-pointer font-display text-xl leading-none tracking-[0.02em] text-ink">Season transfer history · {transfers.length}</summary>
              <div className="divide-y divide-line border-t border-line">
                {[...transfers].sort((a, b) => b.event - a.event || b.time.localeCompare(a.time)).map((t, i) => (
                  <div key={i} className="py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="w-12 font-display text-base leading-none text-faint">GW{t.event}</span>
                    <span className="text-loss-2">{players?.[t.element_out]?.name || t.element_out}</span>
                    <span className="text-faint whitespace-nowrap">→</span>
                    <span className="text-win-2">{players?.[t.element_in]?.name || t.element_in}</span>
                    <span className="ml-auto text-xs text-dim">{formatUk(t.time, false)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </>
  );
}

type TileProps = { label: string; value: React.ReactNode; sub?: React.ReactNode; filled?: boolean; className?: string; labelClassName?: string };

// One figure in the week's scoreboard: a label, a big value and a line under it. `filled` marks a
// played chip.
function StatTile({ label, value, sub, filled = false, className = '', labelClassName = '' }: TileProps) {
  return (
    <div className={`py-3 px-3 min-w-0 break-words border-b border-line ${filled ? 'bg-brand text-white' : ''} ${className}`}>
      <div className={`label ${filled ? 'text-white/85' : labelClassName}`}>{label}</div>
      <div className={`font-display text-3xl leading-none mt-1.5 ${filled ? 'text-white' : 'text-ink'}`}>{value}</div>
      {sub && <div className={`text-xs mt-1 ${filled ? 'text-white/85' : 'text-dim'}`}>{sub}</div>}
    </div>
  );
}

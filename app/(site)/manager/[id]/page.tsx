import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import TeamName, { getTeamNameDisplayText } from '@/components/TeamName';
import PageHeader from '@/components/PageHeader';
import { GameweekChip } from '@/components/GameweekBadge';
import PitchView, { type PitchPlayer, type PitchOpponent } from '@/components/PitchView';
import { DivisionSkeleton } from '@/components/Skeletons';
import { getGameweekStatus, getFplEvents, SEASON_ID, formatUk } from '@/lib/gameweek-status';
import { getPlayers, getManagerPicks, getLivePoints, getManagerTransfers, getManagerEntry, getGwFixtureStatus, type ManagerPicks, type LiveStats, type Player, type TeamGwFixture } from '@/lib/fpl-manager';
import { projectAutoSubs, type FixtureState } from '@/lib/autosubs';
import { getMyTeamId } from '@/lib/my-team';
import { DIVISIONS } from '@/lib/divisions';
import TeamBadge from '@/components/TeamBadge';
import SectionHeading from '@/components/SectionHeading';
import { getLeagueBadges } from '@/lib/badges';

export default async function ManagerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ gw?: string }> }) {
  const { id } = await params;
  const { gw } = await searchParams;
  const managerId = parseInt(id, 10);
  if (!Number.isFinite(managerId)) notFound();
  const requestedGw = gw ? parseInt(gw, 10) : NaN;

  const supabase = await createClient();
  const { data: seasonRow } = await supabase
    .from('season_managers')
    .select('manager_fpl_id, team_name, division, managers!inner (real_name)')
    .eq('season_id', SEASON_ID)
    .eq('manager_fpl_id', managerId)
    .maybeSingle();
  if (!seasonRow) notFound();

  return (
    <div className="max-w-5xl mx-auto py-2 sm:py-8 font-sans">
      <Suspense fallback={<DivisionSkeleton />}>
        <ManagerContent managerId={managerId} manager={seasonRow} requestedGw={Number.isFinite(requestedGw) ? requestedGw : null} />
      </Suspense>
    </div>
  );
}

async function ManagerContent({ managerId, manager, requestedGw }: { managerId: number; manager: any; requestedGw: number | null }) {
  const supabase = await createClient();
  const [gw, events] = await Promise.all([getGameweekStatus(), getFplEvents()]);

  // Picks exist for any gameweek whose deadline has passed
  const latestGw = Math.max(1, gw.liveGw ?? gw.syncedThroughGw);
  const selectedGw = requestedGw && requestedGw >= 1 && requestedGw <= latestGw ? requestedGw : latestGw;
  const isLiveWeek = selectedGw === gw.liveGw;
  const isFinal = selectedGw <= gw.syncedThroughGw || !!events?.find(e => e.id === selectedGw)?.finished;

  const [players, picks, live, transfers, entry, { data: scoreRow }, { data: h2h }, { data: elim }, { data: recent }, fixtureStatus, myTeamId, badges] = await Promise.all([
    getPlayers(),
    getManagerPicks(managerId, selectedGw, isFinal),
    getLivePoints(selectedGw, isFinal),
    getManagerTransfers(managerId),
    getManagerEntry(managerId),
    supabase.from('manager_gw_scores').select('points, transfers_cost, classic_total_points').eq('season_id', SEASON_ID).eq('manager_fpl_id', managerId).eq('gw_number', selectedGw).maybeSingle(),
    supabase.from('h2h_fixtures').select('opponent_fpl_id, manager_score, opponent_score, result').eq('season_id', SEASON_ID).eq('manager_fpl_id', managerId).eq('gw_number', selectedGw).maybeSingle(),
    supabase.from('eliminator_status').select('is_eliminated, eliminated_gw').eq('season_id', SEASON_ID).eq('manager_fpl_id', managerId).maybeSingle(),
    supabase.from('h2h_fixtures').select('gw_number, result').eq('season_id', SEASON_ID).eq('manager_fpl_id', managerId).lte('gw_number', gw.syncedThroughGw).order('gw_number', { ascending: false }).limit(5),
    getGwFixtureStatus(selectedGw, isFinal),
    getMyTeamId(),
    getLeagueBadges(),
  ]);
  const isUnprocessed = !isFinal;

  const opponentId = h2h ? Number((h2h as any).opponent_fpl_id) : null;
  const [opponentRow, opponentPicks] = opponentId
    ? await Promise.all([
        supabase.from('season_managers').select('team_name').eq('season_id', SEASON_ID).eq('manager_fpl_id', opponentId).maybeSingle().then(r => r.data),
        getManagerPicks(opponentId, selectedGw, isFinal),
      ])
    : [null, null];
  const opponentName = opponentRow ? getTeamNameDisplayText(opponentRow.team_name) : null;

  const division = DIVISIONS.find(d => d.name === manager.division);
  const gross = picks?.entry_history.points ?? null;
  const cost = picks?.entry_history.event_transfers_cost ?? scoreRow?.transfers_cost ?? 0;
  const net = scoreRow?.points ?? (gross !== null ? gross - cost : null);
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
      projectedUndecided: !!projection?.undecided.includes(b.element),
      projectedCaptain: !!projection?.captainToVice && b.isVice,
      benchBoost: !!projection?.benchBoost,
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
  const undecidedSubs = mine?.projection?.undecided.length || 0;
  const benchBoostOn = !!mine?.projection?.benchBoost;
  const theirs = opponentPicks ? decorate(opponentPicks, live) : null;
  const pitchOpponent: PitchOpponent | null = theirs && opponentName ? {
    name: opponentName, week: selectedGw, starters: theirs.starters, bench: theirs.bench, benchPoints: opponentPicks!.entry_history.points_on_bench,
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
  const tieMargin = tie ? Number(tie.manager_score) - Number(tie.opponent_score) : 0;
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
          {entry && (
            <div>
              <dt className="label">Season points</dt>
              <dd className="mt-1 text-lg font-semibold text-ink tabular">{entry.summary_overall_points}</dd>
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
          {/* The week at a glance, as one scoreboard row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border-t-2 border-ink/80 mb-10 -mx-3">
            {[
              // Headline score includes projected auto-subs; FPL's own live figure excludes them until the week is processed.
              { label: 'Score', value: benchDue > 0 && net !== null ? net + benchDue : (net ?? '–'), sub: benchBoostOn ? 'bench boost: all 15 count' : benchDue > 0 && net !== null ? `includes +${benchDue} due from the bench · ${net} before subs${undecidedSubs ? ` · ${undecidedSubs} more sub to settle` : ''}` : undecidedSubs ? `${undecidedSubs} sub still to settle` : isLiveWeek ? 'live · net of hits' : 'net of hits' },
              { label: 'Team points', value: gross ?? '–', sub: 'before hits' },
              { label: 'Transfers', value: `${picks.entry_history.event_transfers}${cost ? ` (−${cost})` : ''}`, sub: cost ? 'points deducted' : 'no hit' },
              { label: 'On bench', value: picks.entry_history.points_on_bench, sub: 'points' },
              { label: 'Chip', value: picks.active_chip ? (chipLabel[picks.active_chip] || picks.active_chip) : 'None', sub: picks.active_chip ? 'played' : '', played: !!picks.active_chip },
              { label: 'League match', value: tie ? `${tie.manager_score} - ${tie.opponent_score}` : '–', sub: tie ? `${tieOutcome} ${opponentName || 'opponent'}` : 'no match recorded' },
            ].map(tile => {
              const filled = 'played' in tile && tile.played;
              return (
                <div key={tile.label} className={`py-3 px-3 min-w-0 break-words border-b border-line ${filled ? 'bg-brand text-white' : ''}`}>
                  <div className={`label ${filled ? 'text-white/85' : ''}`}>{tile.label}</div>
                  <div className={`font-display text-3xl leading-none mt-1.5 ${filled ? 'text-white' : 'text-ink'}`}>{tile.value}</div>
                  {tile.sub && <div className={`text-xs mt-1 ${filled ? 'text-white/85' : 'text-dim'}`}>{tile.sub}</div>}
                </div>
              );
            })}
          </div>

          <PitchView starters={starters} bench={bench} benchPoints={picks.entry_history.points_on_bench} live={isLiveWeek} pointsUnavailable={live === null} opponent={pitchOpponent} />

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

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
import { getPlayers, getManagerPicks, getLivePoints, getManagerTransfers, getManagerEntry } from '@/lib/fpl-manager';
import { DIVISIONS } from '@/lib/divisions';

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

  const [players, picks, live, transfers, entry, { data: scoreRow }, { data: h2h }, { data: elim }, { data: recent }] = await Promise.all([
    getPlayers(),
    getManagerPicks(managerId, selectedGw, isFinal),
    getLivePoints(selectedGw, isFinal),
    getManagerTransfers(managerId),
    getManagerEntry(managerId),
    supabase.from('manager_gw_scores').select('points, transfers_cost, classic_total_points').eq('season_id', SEASON_ID).eq('manager_fpl_id', managerId).eq('gw_number', selectedGw).maybeSingle(),
    supabase.from('h2h_fixtures').select('opponent_fpl_id, manager_score, opponent_score, result').eq('season_id', SEASON_ID).eq('manager_fpl_id', managerId).eq('gw_number', selectedGw).maybeSingle(),
    supabase.from('eliminator_status').select('is_eliminated, eliminated_gw').eq('season_id', SEASON_ID).eq('manager_fpl_id', managerId).maybeSingle(),
    supabase.from('h2h_fixtures').select('gw_number, result').eq('season_id', SEASON_ID).eq('manager_fpl_id', managerId).lte('gw_number', gw.syncedThroughGw).order('gw_number', { ascending: false }).limit(5),
  ]);

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
  const subsIn = new Set((picks?.automatic_subs || []).map(s => s.element_in));
  const subsOut = new Set((picks?.automatic_subs || []).map(s => s.element_out));
  const toPitch = (p: { element: number; multiplier: number; is_captain: boolean; is_vice_captain: boolean }): PitchPlayer => {
    const pl = players?.[p.element];
    return {
      element: p.element, name: pl?.name || `#${p.element}`, team: pl?.team || '', teamCode: pl?.teamCode || 0, code: pl?.code || 0, position: pl?.position || 'MID',
      points: live ? (live[p.element]?.total_points ?? 0) : null, multiplier: p.multiplier, isCaptain: p.is_captain, isVice: p.is_vice_captain,
      subbedIn: subsIn.has(p.element), subbedOut: subsOut.has(p.element),
    };
  };
  const starters = (picks?.picks || []).filter(p => p.position <= 11).map(toPitch);
  const bench = (picks?.picks || []).filter(p => p.position > 11).sort((a, b) => a.position - b.position).map(toPitch);
  const pitchOpponent: PitchOpponent | null = opponentPicks && opponentName ? {
    name: opponentName,
    starters: opponentPicks.picks.filter(p => p.position <= 11).map(p => ({ ...toPitch(p), subbedIn: false, subbedOut: false })),
    bench: opponentPicks.picks.filter(p => p.position > 11).sort((a, b) => a.position - b.position).map(p => ({ ...toPitch(p), subbedIn: false, subbedOut: false })),
    benchPoints: opponentPicks.entry_history.points_on_bench,
  } : null;
  const weekTransfers = (transfers || []).filter(t => t.event === selectedGw);
  // Newest first so the current week is visible without scrolling on a phone
  const weeks = Array.from({ length: latestGw }, (_, i) => latestGw - i);
  const chipLabel: Record<string, string> = { wildcard: 'Wildcard', freehit: 'Free Hit', bboost: 'Bench Boost', '3xc': 'Triple Captain', manager: 'Assistant Manager' };

  return (
    <>
      <PageHeader
        title={<TeamName name={manager.team_name} inline className="min-w-0" />}
        titleExtra={division && (
          <Link href={`/divisions/${division.slug}`} className="text-xs sm:text-sm px-3 py-1 rounded-full font-bold tracking-widest uppercase bg-surface-3 text-dim hover:text-ink">
            {manager.division}
          </Link>
        )}
        badge={<GameweekChip gw={gw} week={selectedGw} live={isLiveWeek} />}
        actions={(
          // FPL's own pages always open the logged-in user's team, so these read "your team" rather than this manager's.
          <span className="flex items-center gap-2">
            <Link href={`/manager/${managerId}/plan`} className="text-xs sm:text-sm bg-brand text-white px-3 py-1.5 rounded-full font-semibold hover:bg-brand/90 transition">Plan next week &rarr;</Link>
            <a href="https://fantasy.premierleague.com/my-team" target="_blank" rel="noopener noreferrer" className="text-xs sm:text-sm bg-brand-2/15 text-brand-2 px-3 py-1.5 rounded-full font-semibold hover:bg-brand-2/25 transition">Pick your team on FPL &rarr;</a>
            <a href="https://fantasy.premierleague.com/transfers" target="_blank" rel="noopener noreferrer" className="text-xs sm:text-sm bg-brand-2/15 text-brand-2 px-3 py-1.5 rounded-full font-semibold hover:bg-brand-2/25 transition">Transfers &rarr;</a>
          </span>
        )}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-dim">
          <span className="font-semibold text-ink-2">{manager.managers.real_name}</span>
          {entry && <span>Overall rank {entry.summary_overall_rank?.toLocaleString('en-GB') ?? '–'}</span>}
          {entry && <span>Total {entry.summary_overall_points}</span>}
          {elim && <span className={elim.is_eliminated ? 'text-red-400' : 'text-green-400'}>{elim.is_eliminated ? `Eliminated GW${elim.eliminated_gw}` : 'Still in the Eliminator'}</span>}
          {recent && recent.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="text-faint">Form</span>
              {[...recent].reverse().map((r: any) => (
                <span key={r.gw_number} className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center text-white ${r.result === 'W' ? 'bg-green-500' : r.result === 'L' ? 'bg-red-500' : 'bg-faint'}`} title={`GW${r.gw_number}`}>{r.result}</span>
              ))}
            </span>
          )}
        </div>
      </PageHeader>

      {/* Week selector */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-6">
        {weeks.map(week => (
          <Link
            key={week}
            href={`/manager/${managerId}?gw=${week}`}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border ${week === selectedGw ? 'bg-brand text-white border-brand' : 'bg-surface border-line text-dim hover:text-ink'}`}
          >
            GW{week}{week === gw.liveGw ? ' ·' : ''}
          </Link>
        ))}
      </div>

      {!picks ? (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded-xl p-6 text-sm">
          Team data for GW{selectedGw} is not available from FPL right now. Line-ups appear once the gameweek deadline has passed.
        </div>
      ) : (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            {[
              { label: 'Score', value: net ?? '–', sub: isLiveWeek ? 'live · net of hits' : 'net of hits' },
              { label: 'Team points', value: gross ?? '–', sub: 'before hits' },
              { label: 'Transfers', value: `${picks.entry_history.event_transfers}${cost ? ` (−${cost})` : ''}`, sub: cost ? 'points deducted' : 'no hit' },
              { label: 'On bench', value: picks.entry_history.points_on_bench, sub: 'points' },
              { label: 'Chip', value: picks.active_chip ? (chipLabel[picks.active_chip] || picks.active_chip) : 'None', sub: picks.active_chip ? 'played' : '' },
              { label: 'H2H tie', value: h2h ? `${(h2h as any).manager_score} - ${(h2h as any).opponent_score}` : '–', sub: h2h ? `${(h2h as any).result === 'W' ? 'Won' : (h2h as any).result === 'L' ? 'Lost' : 'Drew'} v ${opponentName || 'opponent'}` : 'no tie recorded' },
            ].map(tile => (
              <div key={tile.label} className="bg-surface border border-line rounded-xl p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-faint">{tile.label}</div>
                <div className="text-xl font-black text-ink leading-tight">{tile.value}</div>
                {tile.sub && <div className="text-[11px] text-dim">{tile.sub}</div>}
              </div>
            ))}
          </div>

          <PitchView starters={starters} bench={bench} benchPoints={picks.entry_history.points_on_bench} live={isLiveWeek} pointsUnavailable={live === null} opponent={pitchOpponent} />

          {/* Transfers this week */}
          <section className="mb-8">
            <h2 className="text-lg font-bold text-ink mb-3">Transfers · GW{selectedGw}</h2>
            <div className="bg-surface border border-line rounded-xl divide-y divide-line">
              {weekTransfers.length === 0 && <div className="p-4 text-sm text-faint italic">No transfers this week.</div>}
              {weekTransfers.map((t, i) => (
                <div key={i} className="p-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="text-red-400 font-semibold">{players?.[t.element_out]?.name || t.element_out}</span>
                  <span className="text-faint text-xs">£{(t.element_out_cost / 10).toFixed(1)}</span>
                  <span className="text-faint">→</span>
                  <span className="text-green-400 font-semibold">{players?.[t.element_in]?.name || t.element_in}</span>
                  <span className="text-faint text-xs">£{(t.element_in_cost / 10).toFixed(1)}</span>
                </div>
              ))}
              {cost > 0 && <div className="p-3 text-xs text-amber-300">−{cost} points for {picks.entry_history.event_transfers} transfer{picks.entry_history.event_transfers === 1 ? '' : 's'}.</div>}
            </div>
          </section>

          {/* Season transfers */}
          {transfers && transfers.length > 0 && (
            <details className="bg-surface border border-line rounded-xl">
              <summary className="p-4 cursor-pointer text-sm font-bold text-ink">Season transfer history · {transfers.length}</summary>
              <div className="divide-y divide-line">
                {[...transfers].sort((a, b) => b.event - a.event || b.time.localeCompare(a.time)).map((t, i) => (
                  <div key={i} className="px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="w-10 text-xs font-bold text-faint">GW{t.event}</span>
                    <span className="text-red-400">{players?.[t.element_out]?.name || t.element_out}</span>
                    <span className="text-faint">→</span>
                    <span className="text-green-400">{players?.[t.element_in]?.name || t.element_in}</span>
                    <span className="ml-auto text-[11px] text-faint">{formatUk(t.time, false)}</span>
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

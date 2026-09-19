import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import TeamName, { getTeamNameDisplayText } from '@/components/TeamName';
import PageHeader from '@/components/PageHeader';
import { GameweekChip, LiveChip } from '@/components/GameweekBadge';
import { DivisionSkeleton } from '@/components/Skeletons';
import { getGameweekStatus, getFplEvents, SEASON_ID, formatUk } from '@/lib/gameweek-status';
import { getPlayers, getManagerPicks, getLivePoints, getManagerTransfers, getManagerEntry, type Player } from '@/lib/fpl-manager';
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

const POSITION_ORDER: Player['position'][] = ['GKP', 'DEF', 'MID', 'FWD'];

function PlayerCard({ player, points, pick, subbedIn, subbedOut, live }: { player: Player | undefined; points: number | null; pick: { multiplier: number; is_captain: boolean; is_vice_captain: boolean }; subbedIn: boolean; subbedOut: boolean; live: boolean }) {
  if (!player) return <div className="bg-surface-2 border border-line rounded-lg p-2 text-xs text-faint">Unknown player</div>;
  const scored = points === null ? null : points * (pick.multiplier || 1);
  return (
    <div className={`relative bg-surface border rounded-lg px-2 py-2 text-center min-w-0 ${subbedOut ? 'border-red-500/40 opacity-60' : subbedIn ? 'border-green-500/40' : 'border-line'}`}>
      {(pick.is_captain || pick.is_vice_captain) && (
        <span className={`absolute -top-2 -right-1.5 text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center ${pick.is_captain ? 'bg-brand text-white' : 'bg-surface-3 text-ink'}`}>
          {pick.is_captain ? 'C' : 'V'}
        </span>
      )}
      <div className="text-sm font-bold text-ink truncate">{player.name}</div>
      <div className="text-[10px] uppercase tracking-wider text-faint">{player.team} · {player.position}</div>
      <div className={`mt-1 text-lg font-black ${live ? 'text-amber-300' : 'text-ink'}`}>{scored === null ? '–' : scored}</div>
      {pick.multiplier > 1 && <div className="text-[10px] text-dim">×{pick.multiplier}</div>}
      {subbedIn && <div className="text-[10px] font-bold uppercase tracking-wider text-green-400">Auto sub in</div>}
      {subbedOut && <div className="text-[10px] font-bold uppercase tracking-wider text-red-400">Auto sub out</div>}
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

  const opponentRow = h2h ? (await supabase.from('season_managers').select('team_name').eq('season_id', SEASON_ID).eq('manager_fpl_id', (h2h as any).opponent_fpl_id).maybeSingle()).data : null;
  const opponentName = opponentRow ? getTeamNameDisplayText(opponentRow.team_name) : null;

  const division = DIVISIONS.find(d => d.name === manager.division);
  const gross = picks?.entry_history.points ?? null;
  const cost = picks?.entry_history.event_transfers_cost ?? scoreRow?.transfers_cost ?? 0;
  const net = scoreRow?.points ?? (gross !== null ? gross - cost : null);
  const subsIn = new Set((picks?.automatic_subs || []).map(s => s.element_in));
  const subsOut = new Set((picks?.automatic_subs || []).map(s => s.element_out));
  const starters = (picks?.picks || []).filter(p => p.position <= 11);
  const bench = (picks?.picks || []).filter(p => p.position > 11).sort((a, b) => a.position - b.position);
  const weekTransfers = (transfers || []).filter(t => t.event === selectedGw);
  const pointsFor = (element: number) => (live ? (live[element]?.total_points ?? 0) : null);
  const weeks = Array.from({ length: latestGw }, (_, i) => i + 1);
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

          {/* Pitch */}
          <section className="mb-8">
            <h2 className="text-lg font-bold text-ink mb-3 flex items-center gap-2">
              Line-up {isLiveWeek && <LiveChip />}
              {live === null && <span className="text-xs font-normal text-faint">player points unavailable</span>}
            </h2>
            <div className="rounded-2xl border border-green-500/20 bg-gradient-to-b from-green-500/10 to-green-500/5 p-3 sm:p-6 space-y-4">
              {POSITION_ORDER.map(position => {
                const row = starters.filter(p => players?.[p.element]?.position === position);
                if (row.length === 0) return null;
                return (
                  <div key={position} className="flex justify-center gap-2 sm:gap-4 flex-wrap">
                    {row.map(p => (
                      <div key={p.element} className="w-[30%] sm:w-32">
                        <PlayerCard player={players?.[p.element]} points={pointsFor(p.element)} pick={p} subbedIn={subsIn.has(p.element)} subbedOut={subsOut.has(p.element)} live={isLiveWeek} />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            <div className="mt-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-faint mb-2">Bench · {picks.entry_history.points_on_bench} pts</div>
              <div className="grid grid-cols-4 gap-2 sm:gap-4 sm:max-w-xl">
                {bench.map(p => (
                  <PlayerCard key={p.element} player={players?.[p.element]} points={pointsFor(p.element)} pick={{ ...p, multiplier: 1 }} subbedIn={subsIn.has(p.element)} subbedOut={subsOut.has(p.element)} live={isLiveWeek} />
                ))}
              </div>
            </div>
          </section>

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

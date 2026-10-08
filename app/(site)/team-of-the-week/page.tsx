import { Suspense } from 'react';
import { createClient } from '@/utils/supabase/server';
import PageHeader from '@/components/PageHeader';
import RichText from '@/components/RichText';
import { GameweekChip } from '@/components/GameweekBadge';
import GameweekSelector from '@/components/GameweekSelector';
import TeamOfTheWeekCard from '@/components/TeamOfTheWeekCard';
import { DivisionSkeleton } from '@/components/Skeletons';
import { getGameweekStatus } from '@/lib/gameweek-status';
import { getTeamOfTheWeek, getFinalLineup } from '@/lib/team-of-the-week';
import PitchView from '@/components/PitchView';
import { getTeamNameDisplayText } from '@/components/TeamName';

export default async function TeamOfTheWeekPage({ searchParams }: { searchParams: Promise<{ gw?: string }> }) {
  const { gw } = await searchParams;
  const requested = gw ? parseInt(gw, 10) : NaN;

  return (
    <div className="max-w-5xl mx-auto py-2 sm:py-8 font-sans">
      <Suspense fallback={<DivisionSkeleton />}>
        <TotwContent requestedGw={Number.isFinite(requested) ? requested : null} />
      </Suspense>
    </div>
  );
}

async function TotwContent({ requestedGw }: { requestedGw: number | null }) {
  const supabase = await createClient();
  const gw = await getGameweekStatus();
  const latestGw = Math.max(1, gw.syncedThroughGw);
  const selectedGw = requestedGw && requestedGw >= 1 && requestedGw <= latestGw ? requestedGw : latestGw;
  const isLatest = selectedGw === latestGw;

  const [totw, { data: contentData }] = await Promise.all([
    getTeamOfTheWeek(selectedGw),
    supabase.from('page_content').select('content').eq('id', 'team-of-the-week').eq('gw_number', selectedGw).maybeSingle(),
  ]);
  const many = (totw?.winners.length ?? 0) > 1;
  const lineups = totw ? await Promise.all(totw.winners.map(w => getFinalLineup(w.id, totw.gw))) : [];

  return (
    <>
      <PageHeader
        title={`Team${many ? 's' : ''} of the Week`}
        badge={<GameweekChip gw={gw} week={isLatest ? undefined : selectedGw} live={isLatest ? undefined : false} />}
      >
        {latestGw > 1 && (
          <div className="mb-4">
            <GameweekSelector basePath="/team-of-the-week" latestGw={latestGw} selected={selectedGw} liveGw={gw.liveGw} />
          </div>
        )}
        <p className="text-sm text-dim">The highest score of GW{selectedGw}, across all three leagues.</p>
      </PageHeader>

      {!totw ? (
        <div className="bg-surface border border-line rounded-xl p-6 sm:p-12 text-center text-dim">
          No scores recorded for GW{selectedGw} yet.
        </div>
      ) : (
        <>
          <section className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-surface to-surface shadow-lg mb-6">
            <div className="absolute -top-12 -right-8 text-[10rem] leading-none opacity-10 select-none" aria-hidden="true">🏆</div>
            <div className="relative p-5 sm:p-8">
              <div className={many ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : ''}>
                {totw.winners.map(team => <TeamOfTheWeekCard key={team.id} team={team} gw={totw.gw} />)}
              </div>
              {many && (
                <p className="mt-5 text-sm font-semibold text-amber-300">
                  Shared by {totw.winners.length} teams, all on {totw.winners[0].points}.
                </p>
              )}
            </div>
          </section>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Winning score', value: totw.winners[0].points },
              { label: 'Clear of the rest', value: totw.nextBest === null ? '–' : `+${totw.winners[0].points - totw.nextBest}` },
              { label: 'League average', value: totw.average },
              { label: 'Left on the bench', value: totw.winners.map(w => w.benchPoints).join(' / ') },
            ].map(tile => (
              <div key={tile.label} className="bg-surface border border-line rounded-xl p-3 min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-widest text-faint">{tile.label}</div>
                <div className="text-xl font-black text-ink">{tile.value}</div>
              </div>
            ))}
          </div>

          {totw.winners.map((team, i) => {
            const lineup = lineups[i];
            if (!lineup) return null;
            return (
              <PitchView
                key={team.id}
                title={many ? `${getTeamNameDisplayText(team.teamName)} line-up` : 'Line-up'}
                starters={lineup.starters}
                bench={lineup.bench}
                benchPoints={lineup.benchPoints}
                live={false}
                pointsUnavailable={lineup.pointsUnavailable}
              />
            );
          })}

          {contentData?.content ? (
            <div className="bg-surface border-l-4 border-amber-400 p-4 sm:p-6 rounded-r-xl shadow-sm text-ink-2 leading-relaxed">
              <RichText content={contentData.content} />
            </div>
          ) : (
            <p className="text-sm text-faint italic">No GW{selectedGw} write-up yet.</p>
          )}
        </>
      )}
    </>
  );
}

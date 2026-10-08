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
  const facts = totw && (
    <>
      {totw.nextBest !== null && <span><b className="text-ink tabular">+{totw.winners[0].points - totw.nextBest}</b> clear of the rest</span>}
      <span>League average <b className="text-ink tabular">{totw.average}</b></span>
      <span>Left on the bench <b className="text-ink tabular">{totw.winners.map(w => w.benchPoints).join(' / ')}</b></span>
    </>
  );

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
        <p className="text-dim">The highest score of GW{selectedGw}, across all three leagues.</p>
      </PageHeader>

      {!totw ? (
        <p className="py-10 text-center text-dim">No scores recorded for GW{selectedGw} yet.</p>
      ) : (
        <>
          <section className="border-y border-line py-5 mb-10">
            <div className={many ? 'grid grid-cols-1 lg:grid-cols-2 gap-6 col-rules' : ''}>
              {totw.winners.map(team => <TeamOfTheWeekCard key={team.id} team={team} gw={totw.gw} facts={many ? undefined : facts} />)}
            </div>
            {many && (
              <div className="mt-4 pt-3 border-t border-line flex flex-wrap gap-x-6 gap-y-1 text-sm text-dim">
                <span className="font-semibold text-ink-2">Shared by {totw.winners.length} teams, all on {totw.winners[0].points}.</span>
                {facts}
              </div>
            )}
          </section>

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
            <article className="max-w-[34rem] border-t border-line pt-5 text-[15px] leading-relaxed text-ink-2">
              <RichText content={contentData.content} />
            </article>
          ) : (
            <p className="text-sm text-faint italic">No GW{selectedGw} write-up yet.</p>
          )}
        </>
      )}
    </>
  );
}

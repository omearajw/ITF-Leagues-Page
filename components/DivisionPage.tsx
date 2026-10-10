import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { Suspense } from 'react';
import TeamName from '@/components/TeamName';
import { DivisionSkeleton } from '@/components/Skeletons';
import { GameweekChip } from '@/components/GameweekBadge';
import PageHeader from '@/components/PageHeader';
import RichText from '@/components/RichText';
import DivisionFixtures from '@/components/DivisionFixtures';
import { FeedbackPrompt } from '@/components/Feedback';
import { DIVISIONS } from '@/lib/divisions';
import MovementArrow from '@/components/MovementArrow';
import { positionDeltas } from '@/lib/movement';
import { compareStanding } from '@/lib/standings';
import { getGameweekStatus } from '@/lib/gameweek-status';
import GameweekSelector from '@/components/GameweekSelector';

type Division = (typeof DIVISIONS)[number];

// The three division pages are identical apart from the division, so each route renders this.
export default async function DivisionPage({ slug, searchParams }: { slug: Division['slug']; searchParams: Promise<{ gw?: string }> }) {
  const division = DIVISIONS.find(d => d.slug === slug)!;
  const { gw } = await searchParams;
  const requested = gw ? parseInt(gw, 10) : NaN;

  return (
    <div className="max-w-7xl mx-auto py-2 sm:py-8 font-sans">
      <Suspense fallback={<DivisionSkeleton />}>
        <DivisionContent division={division} requestedGw={Number.isFinite(requested) ? requested : null} />
      </Suspense>
    </div>
  );
}

async function DivisionContent({ division, requestedGw }: { division: Division; requestedGw: number | null }) {
  const supabase = await createClient();
  const SEASON_ID = '2026-27';
  const gw = await getGameweekStatus();
  // Any confirmed week can be viewed; the latest is the default and keeps live totals.
  const latestGw = Math.max(1, gw.syncedThroughGw);
  const selectedGw = requestedGw && requestedGw >= 1 && requestedGw <= latestGw ? requestedGw : latestGw;
  const isLatest = selectedGw === latestGw;
  
  const DIVISION_NAME = division.name;
  const CMS_SLUG = division.slug;

  // A week shows only its own write-up; an older one would be misleading.
  const { data: contentData } = await supabase
    .from('page_content')
    .select('content')
    .eq('id', CMS_SLUG)
    .eq('gw_number', selectedGw)
    .maybeSingle();

  const { data: managers, error } = await supabase
    .from('season_managers')
    .select(`
      manager_fpl_id,
      team_name,
      managers!inner (real_name),
      manager_gw_scores (gw_number, points, classic_total_points),
      h2h_fixtures (gw_number, result)
    `)
    .eq('season_id', SEASON_ID)
    .eq('division', DIVISION_NAME);

  if (error) {
    return <div className="p-10 text-loss-2">Error loading division: {error.message}</div>;
  }

  // Results count only confirmed gameweeks; the season total stays live unless a limit is given.
  const buildTable = (resultsThroughGw: number, totalsThroughGw: number | null) => {
    const rows = managers?.map((mgr: any) => {
      let w = 0, d = 0, l = 0;

      mgr.h2h_fixtures?.forEach((fix: any) => {
        if (fix.gw_number > resultsThroughGw) return;
        if (fix.result === 'W') w++;
        else if (fix.result === 'D') d++;
        else if (fix.result === 'L') l++;
      });

      const totalPoints = mgr.manager_gw_scores?.reduce((max: number, gw: any) =>
        (totalsThroughGw === null || gw.gw_number <= totalsThroughGw) && gw.classic_total_points > max ? gw.classic_total_points : max, 0) || 0;
      // That week's net score, for the shared tie-break: the latest counted week's row.
      const counted = (mgr.manager_gw_scores || []).filter((gw: any) => totalsThroughGw === null || gw.gw_number <= totalsThroughGw);
      const weekPoints = counted.reduce((best: any, gw: any) => (!best || gw.gw_number > best.gw_number ? gw : best), null)?.points ?? 0;

      const matchPoints = (w * 3) + (d * 1);
      const matchesPlayed = w + d + l;

      return {
        id: mgr.manager_fpl_id,
        teamName: mgr.team_name,
        managerName: mgr.managers.real_name,
        played: matchesPlayed,
        won: w,
        drawn: d,
        lost: l,
        matchPoints,
        totalPoints,
        weekPoints
      };
    }) || [];

    rows.sort((a, b) => compareStanding(
      { pts: a.matchPoints, total: a.totalPoints, week: a.weekPoints, name: a.teamName },
      { pts: b.matchPoints, total: b.totalPoints, week: b.weekPoints, name: b.teamName },
    ));
    return rows;
  };

  const tableData = buildTable(selectedGw, isLatest ? null : selectedGw);
  const teamNames: Record<number, string> = Object.fromEntries((managers || []).map((m: any) => [Number(m.manager_fpl_id), m.team_name]));
  const movement = selectedGw > 1
    ? positionDeltas(tableData.map(t => t.id), buildTable(selectedGw - 1, selectedGw - 1).map(t => t.id))
    : {};

  return (
    <>
      <PageHeader
        title={DIVISION_NAME}
        rules
        badge={(
          <GameweekChip gw={gw} week={isLatest ? undefined : selectedGw} live={isLatest ? undefined : false} />
        )}
        actions={(
          <Link href="/form" className="text-sm font-semibold text-brand-2 hover:underline whitespace-nowrap">
            Form guide &rarr;
          </Link>
        )}
      >
        {latestGw > 1 && (
          <GameweekSelector basePath={`/divisions/${division.slug}`} latestGw={latestGw} selected={selectedGw} liveGw={gw.liveGw} />
        )}
      </PageHeader>

      {/* The week's write-up leads on the left with the table beside it on wide screens, like a story
          and its standings box; stacked (write-up first) below that. */}
      <div className={contentData?.content ? 'grid grid-cols-1 xl:grid-cols-[25rem_minmax(0,1fr)] items-start gap-x-8 gap-y-10' : ''}>
        {contentData?.content && (
          <article className="max-w-[34rem] border-t border-line pt-5 xl:border-t-0 xl:pt-0 xl:border-r xl:pr-8 text-[15px] leading-relaxed text-ink-2">
            <RichText content={contentData.content} />
            <FeedbackPrompt>Thoughts on this week&apos;s write-up?</FeedbackPrompt>
          </article>
        )}

        <div className="min-w-0">
          {isLatest && gw.liveGw && (
            <p className="text-sm text-dim mb-3">Total updates live. W/D/L, Pts and positions update once GW{gw.liveGw} is confirmed.</p>
          )}
          {!isLatest && (
            <p className="text-sm text-dim mb-3">The table as it stood after GW{selectedGw}. Arrows compare with GW{selectedGw - 1}.</p>
          )}

          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b-2 border-ink/80">
                <th className="label font-semibold py-2 pr-1 w-9">Pos</th>
                <th className="w-10 pr-2"><span className="sr-only">Movement</span></th>
                <th className="label font-semibold py-2 pr-3">Team</th>
                <th className="label font-semibold py-2 px-2 text-center w-12 hidden md:table-cell">Pld</th>
                <th className="label font-semibold py-2 px-2 text-center w-12 hidden md:table-cell">W</th>
                <th className="label font-semibold py-2 px-2 text-center w-12 hidden md:table-cell">D</th>
                <th className="label font-semibold py-2 px-2 text-center w-12 hidden md:table-cell">L</th>
                <th className="label font-semibold py-2 px-2 text-right w-20 hidden md:table-cell">Total</th>
                <th className="label font-semibold py-2 px-3 text-right w-16 text-ink key-col">Pts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {tableData.map((team, index) => (
                <tr key={team.id} className="hover:bg-surface">
                  <td className="py-3 pr-1 font-display text-2xl leading-none text-faint">{index + 1}</td>
                  <td className="py-3 pr-2 whitespace-nowrap"><MovementArrow delta={movement[team.id]} /></td>
                  <td className="py-3 pr-3 min-w-0">
                    <TeamName name={team.teamName} managerId={team.id} inline className="font-semibold text-ink min-w-0" />
                    <div className="text-dim">
                      {team.managerName}
                      <span className="md:hidden tabular"> · {team.won}W {team.drawn}D {team.lost}L · {team.totalPoints}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center text-dim hidden md:table-cell">{team.played}</td>
                  <td className="py-3 px-2 text-center font-semibold text-win-2 hidden md:table-cell">{team.won}</td>
                  <td className="py-3 px-2 text-center font-semibold text-dim hidden md:table-cell">{team.drawn}</td>
                  <td className="py-3 px-2 text-center font-semibold text-loss-2 hidden md:table-cell">{team.lost}</td>
                  <td className="py-3 px-2 text-right text-dim hidden md:table-cell">{team.totalPoints}</td>
                  <td className="py-3 px-3 text-right font-display text-3xl leading-none text-ink key-col">{team.matchPoints}</td>
                </tr>
              ))}
              {tableData.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-dim">No teams found in this division.</td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="md:hidden mt-2 text-xs text-dim">W/D/L, then the season&apos;s total FPL points. Pts are 3 for a win, 1 for a draw.</p>
        </div>
      </div>

      <DivisionFixtures leagueId={division.fplId} gw={gw} teamNames={teamNames} week={isLatest ? undefined : selectedGw} />
    </>
  );
}

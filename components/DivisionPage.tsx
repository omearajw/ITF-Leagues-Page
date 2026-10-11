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
import { getWeekProjection, dueFor } from '@/lib/projection';
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
  // The table holds at the last finished week, totals and positions included. A live week can be
  // opened on purpose to see the table as it stands, but it is never the default.
  const latestGw = Math.max(1, gw.syncedThroughGw);
  const liveGw = gw.liveGw && gw.liveGw > latestGw ? gw.liveGw : null;
  const maxGw = liveGw ?? latestGw;
  const selectedGw = requestedGw && requestedGw >= 1 && requestedGw <= maxGw ? requestedGw : latestGw;
  const isLatest = selectedGw === latestGw;
  const isLive = selectedGw === liveGw;
  
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
      h2h_fixtures (gw_number, result, opponent_fpl_id)
    `)
    .eq('season_id', SEASON_ID)
    .eq('division', DIVISION_NAME);

  if (error) {
    return <div className="p-10 text-loss-2">Error loading division: {error.message}</div>;
  }

  // As it stands in the live week: live scores plus subs due from the bench, the same figures the
  // fixtures list below shows. Null until a manager has a live score.
  const projection = isLive ? await getWeekProjection() : null;
  const dueNow = (id: number) => (projection && liveGw ? dueFor(projection, liveGw, id)?.due || 0 : 0);
  const liveScore: Record<number, number | null> = Object.fromEntries((managers || []).map((m: any) => {
    const row = ((m.manager_gw_scores || []) as { gw_number: number; points: number }[]).find(s => s.gw_number === liveGw);
    return [Number(m.manager_fpl_id), row ? row.points + dueNow(Number(m.manager_fpl_id)) : null];
  }));

  // Everything counts up to `throughGw`. A finished week uses the stored results and totals; the
  // live week works its results out from the live scores.
  const buildTable = (throughGw: number) => {
    const asItStands = throughGw === liveGw;
    const rows = managers?.map((mgr: any) => {
      const id = Number(mgr.manager_fpl_id);
      let w = 0, d = 0, l = 0;

      mgr.h2h_fixtures?.forEach((fix: any) => {
        if (fix.gw_number > throughGw) return;
        let result = fix.result;
        if (asItStands && fix.gw_number === liveGw) {
          const mine = liveScore[id], theirs = liveScore[Number(fix.opponent_fpl_id)];
          if (typeof mine !== 'number' || typeof theirs !== 'number') return;
          result = mine > theirs ? 'W' : mine < theirs ? 'L' : 'D';
        }
        if (result === 'W') w++;
        else if (result === 'D') d++;
        else if (result === 'L') l++;
      });

      // The season total and week score from the latest counted week's row.
      const latestRow = (mgr.manager_gw_scores || [])
        .filter((row: any) => row.gw_number <= throughGw)
        .reduce((best: any, row: any) => (!best || row.gw_number > best.gw_number ? row : best), null);
      const live = asItStands && latestRow?.gw_number === liveGw;
      const totalPoints = (latestRow?.classic_total_points ?? 0) + (live ? dueNow(id) : 0);
      const weekPoints = live ? liveScore[id] ?? 0 : latestRow?.points ?? 0;

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

  const tableData = buildTable(selectedGw);
  const teamNames: Record<number, string> = Object.fromEntries((managers || []).map((m: any) => [Number(m.manager_fpl_id), m.team_name]));
  const movement = selectedGw > 1
    ? positionDeltas(tableData.map(t => t.id), buildTable(selectedGw - 1).map(t => t.id))
    : {};

  return (
    <>
      <PageHeader
        title={DIVISION_NAME}
        rules
        badge={(
          <GameweekChip gw={gw} week={selectedGw} live={isLive} />
        )}
        actions={(
          <Link href="/form" className="text-sm font-semibold text-brand-2 hover:underline whitespace-nowrap">
            Form guide &rarr;
          </Link>
        )}
      >
        {maxGw > 1 && (
          <GameweekSelector basePath={`/divisions/${division.slug}`} latestGw={maxGw} defaultGw={latestGw} selected={selectedGw} liveGw={liveGw} />
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
          {isLatest && liveGw && (
            <p className="text-sm text-dim mb-3">
              Standings after GW{latestGw}. GW{liveGw} is under way:{' '}
              <Link href={`/divisions/${division.slug}?gw=${liveGw}`} className="font-semibold text-brand-2 hover:underline whitespace-nowrap">see the table as it stands &rarr;</Link>
            </p>
          )}
          {isLive && (
            <p className="text-sm text-live-2 mb-3">As it stands in GW{liveGw}: live scores, including subs due from the bench, as if the week ended now. Nothing here is final until FPL confirms the week.</p>
          )}
          {!isLatest && !isLive && (
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

      <DivisionFixtures leagueId={division.fplId} gw={gw} teamNames={teamNames} week={isLatest || isLive ? undefined : selectedGw} />
    </>
  );
}

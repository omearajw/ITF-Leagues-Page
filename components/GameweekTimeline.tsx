import { getGameweekStatus, describePhase, formatUk, formatUkShort, stageOf, stageProgress, STAGE_ORDER, STAGE_LABEL, type GameweekStage } from '@/lib/gameweek-status';
import { ACTIVE_DOT, STAGE_PILL } from '@/components/GameweekStrip';
import { getLastSyncedAt, describeAgo } from '@/lib/sync-status';

// Segment widths weight emphasis, not duration: Live is where people look most.
const SEGMENT_WIDTHS = [28, 47, 25];

const SHORT_LABEL: Record<GameweekStage, string> = {
  upcoming: 'Upcoming',
  live: 'Live',
  awaiting: 'Results',
  final: 'Final',
};

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-faint">{label}</div>
      <div className="font-bold text-ink">{value}</div>
      {sub && <div className="text-xs text-dim">{sub}</div>}
    </div>
  );
}

export function StageCheckpoints({ stage, progress }: { stage: GameweekStage; progress: number }) {
  const idx = STAGE_ORDER.indexOf(stage);
  const segments = STAGE_ORDER.slice(0, 3);

  return (
    <div className="pt-2">
      <div className="flex items-center">
        {segments.map((seg, i) => {
          const state = i < idx ? 'done' : i === idx ? 'active' : 'todo';
          const dot = state === 'todo' ? 'bg-surface-3' : 'bg-ink';
          return (
            <div key={seg} className="flex items-center" style={{ width: `${SEGMENT_WIDTHS[i]}%` }}>
              <span className={`w-3 h-3 rounded-full shrink-0 ring-4 ring-surface ${dot}`} />
              <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden mx-1">
                {state === 'done' && <div className="h-full w-full bg-panel" />}
                {state === 'active' && <div className={`h-full ${ACTIVE_DOT[stage]}`} style={{ width: `${Math.round(progress * 100)}%` }} />}
              </div>
            </div>
          );
        })}
        <span className={`w-3 h-3 rounded-full shrink-0 ring-4 ring-surface ${idx === 3 ? 'bg-green-500' : 'bg-surface-3'}`} />
      </div>

      <div className="flex mt-2 text-xs">
        {segments.map((seg, i) => {
          const state = i < idx ? 'done' : i === idx ? 'active' : 'todo';
          const label = state === 'active' ? 'font-bold text-ink' : state === 'done' ? 'text-dim' : 'text-faint';
          return (
            <div key={seg} className={`${label} truncate pr-2`} style={{ width: `${SEGMENT_WIDTHS[i]}%` }}>
              <span className="sm:hidden">{SHORT_LABEL[seg]}</span>
              <span className="hidden sm:inline">{STAGE_LABEL[seg]}</span>
            </div>
          );
        })}
        <div className={`shrink-0 -ml-8 w-8 text-right ${idx === 3 ? 'font-bold text-green-400' : 'text-faint'}`}>{STAGE_LABEL.final}</div>
      </div>
    </div>
  );
}

function matchesLabel(first: string | null, last: string | null): string {
  if (!first) return '—';
  if (!last || last === first) return formatUkShort(first);
  return `${formatUkShort(first)} → ${formatUkShort(last)}`;
}

export default async function GameweekTimeline() {
  const [gw, lastSynced] = await Promise.all([getGameweekStatus(), getLastSyncedAt()]);
  const stage = stageOf(gw.phase);
  const now = Date.now();
  const ago = describeAgo(lastSynced, now);

  const resultsValue = gw.phase === 'synced' ? 'Confirmed'
    : gw.phase === 'confirmed' ? 'Confirmed'
    : gw.timeline.confirmed ? `~${formatUk(gw.timeline.confirmed, false)}` : '—';
  const resultsSub = gw.phase === 'synced' ? 'Tournaments updated'
    : gw.phase === 'confirmed' ? 'Tournaments updating'
    : 'Estimated';

  return (
    <div className="bg-surface border rounded-xl shadow-sm p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold text-ink">{gw.activeGwName}</h2>
        {stage && (
          <span className={`text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${STAGE_PILL[stage]}`}>
            {STAGE_LABEL[stage]}
          </span>
        )}
        <span className="text-sm text-dim sm:ml-auto">{describePhase(gw)}{ago ? ` · updated ${ago}` : ''}</span>
      </div>

      {!gw.fplAvailable || !stage ? (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded-lg p-4 text-sm mt-4">
          Live FPL status is unavailable right now. Results are final through GW{gw.syncedThroughGw}
          {gw.liveGw ? `, and GW${gw.liveGw} scores on the site are provisional.` : '.'}
        </div>
      ) : (
        <>
          <div className="mt-5 mb-6">
            <StageCheckpoints stage={stage} progress={stageProgress(gw, now)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Fact label="Deadline" value={formatUk(gw.deadline)} sub={gw.phase === 'upcoming' ? 'Upcoming' : 'Passed'} />
            <Fact
              label="Matches"
              value={matchesLabel(gw.firstKickoff, gw.lastKickoff)}
              sub={gw.fixturesUnscheduled > 0 ? `${gw.fixturesTotal} scheduled · ${gw.fixturesUnscheduled} postponed` : `${gw.fixturesTotal} matches`}
            />
            <Fact label="Results final" value={resultsValue} sub={resultsSub} />
            <Fact
              label="Next deadline"
              value={gw.nextGw ? `GW${gw.nextGw.id}` : 'Season complete'}
              sub={gw.nextGw ? formatUk(gw.nextGw.deadline) : undefined}
            />
          </div>
        </>
      )}
    </div>
  );
}

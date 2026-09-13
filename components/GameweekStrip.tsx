import { getGameweekStatus, describePhase, stageOf, STAGE_ORDER, STAGE_LABEL, type GameweekStage } from '@/lib/gameweek-status';

export const ACTIVE_DOT: Record<GameweekStage, string> = {
  upcoming: 'bg-dim',
  live: 'bg-amber-400 animate-pulse',
  awaiting: 'bg-brand',
  final: 'bg-green-500',
};

export const STAGE_PILL: Record<GameweekStage, string> = {
  upcoming: 'bg-surface-3 text-dim',
  live: 'bg-amber-500/15 text-amber-300',
  awaiting: 'bg-brand-2/15 text-brand-2',
  final: 'bg-green-500/15 text-green-300',
};

export function StageDots({ stage }: { stage: GameweekStage }) {
  const idx = STAGE_ORDER.indexOf(stage);
  return (
    <ol className="flex items-center">
      {STAGE_ORDER.map((step, i) => {
        const state = i < idx ? 'done' : i === idx ? 'active' : 'todo';
        const dot = state === 'done' ? 'bg-ink' : state === 'active' ? ACTIVE_DOT[stage] : 'bg-surface-3';
        const label = state === 'active' ? 'font-bold text-ink' : state === 'done' ? 'text-dim' : 'text-faint';
        return (
          <li key={step} className="flex items-center">
            {i > 0 && <span className={`h-px w-3 mx-1.5 ${i <= idx ? 'bg-ink' : 'bg-surface-3'}`} />}
            <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
            <span className={`ml-1.5 text-xs ${label} ${state !== 'active' ? 'hidden sm:inline' : ''}`}>{STAGE_LABEL[step]}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default async function GameweekStrip() {
  const gw = await getGameweekStatus();
  const stage = stageOf(gw.phase);
  return (
    <div className="bg-surface border-b border-line">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-10 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="font-black text-ink">GW{gw.activeGw}</span>
        {stage && <StageDots stage={stage} />}
        <span className="text-dim sm:ml-auto">{describePhase(gw)}</span>
      </div>
    </div>
  );
}

import { getGameweekStatus, describePhase, stageOf, STAGE_ORDER, STAGE_LABEL, type GameweekStage } from '@/lib/gameweek-status';

export const ACTIVE_DOT: Record<GameweekStage, string> = {
  upcoming: 'bg-slate-500',
  live: 'bg-amber-400 animate-pulse',
  awaiting: 'bg-blue-500',
  final: 'bg-green-500',
};

export const STAGE_PILL: Record<GameweekStage, string> = {
  upcoming: 'bg-slate-200 text-slate-600',
  live: 'bg-amber-100 text-amber-800',
  awaiting: 'bg-blue-100 text-blue-800',
  final: 'bg-green-100 text-green-800',
};

export function StageDots({ stage }: { stage: GameweekStage }) {
  const idx = STAGE_ORDER.indexOf(stage);
  return (
    <ol className="flex items-center">
      {STAGE_ORDER.map((step, i) => {
        const state = i < idx ? 'done' : i === idx ? 'active' : 'todo';
        const dot = state === 'done' ? 'bg-slate-900' : state === 'active' ? ACTIVE_DOT[stage] : 'bg-slate-300';
        const label = state === 'active' ? 'font-bold text-slate-900' : state === 'done' ? 'text-slate-500' : 'text-slate-400';
        return (
          <li key={step} className="flex items-center">
            {i > 0 && <span className={`h-px w-3 mx-1.5 ${i <= idx ? 'bg-slate-900' : 'bg-slate-300'}`} />}
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
    <div className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-10 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="font-black text-slate-900">GW{gw.activeGw}</span>
        {stage && <StageDots stage={stage} />}
        <span className="text-slate-500 sm:ml-auto">{describePhase(gw)}</span>
      </div>
    </div>
  );
}

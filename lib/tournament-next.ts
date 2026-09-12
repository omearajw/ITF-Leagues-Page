import type { GameweekStatus } from '@/lib/gameweek-status';

// The gameweek whose FPL confirmation the tournaments are waiting on next.
function pendingGw(gw: GameweekStatus) {
  return gw.liveGw ?? gw.syncedThroughGw + 1;
}

export function eliminatorNextLine(gw: GameweekStatus, startGw: number, opts: { aliveCount?: number; awaitingElimination?: boolean } = {}) {
  const n = gw.syncedThroughGw;
  if (n + 1 < startGw) return `First cut: after GW${startGw} is confirmed`;
  if (opts.aliveCount !== undefined && opts.aliveCount <= 1) return 'Winner decided';
  if (opts.awaitingElimination) return `GW${n} cut pending · applied on the next sync`;
  return `Next cut: after GW${Math.max(pendingGw(gw), startGw)} is confirmed`;
}

export function onionBaggersNextLine(gw: GameweekStatus, cfg: { qStart: number; kStart: number }, opts: { qualifiedCount?: number; currentStage?: string | null } = {}) {
  const n = gw.syncedThroughGw;
  const ref = pendingGw(gw);
  if (n + 1 < cfg.qStart) return `Qualifiers start GW${cfg.qStart}`;
  if (ref < cfg.kStart) {
    const remaining = 16 - (opts.qualifiedCount ?? 0);
    if (remaining <= 0) return `All 16 qualified · knockouts start GW${cfg.kStart}`;
    const spots = opts.qualifiedCount !== undefined ? ` · ${remaining} spots left` : '';
    return `${Math.min(2, remaining)} more qualify after GW${ref} is confirmed${spots}`;
  }
  if (ref === cfg.kStart) return `Round of 16 is decided when GW${cfg.kStart} is confirmed`;
  if (opts.currentStage === 'Final' && n >= ref) return 'Champion crowned';
  return `${opts.currentStage ?? 'Round'} advances after GW${ref} is confirmed`;
}

export function championsLeagueNextLine(gw: GameweekStatus, cfg: { s1Start: number; s2Start: number; finalStart: number; s1MaxRounds: number; s2MaxRounds: number }) {
  const n = gw.syncedThroughGw;
  const ref = pendingGw(gw);
  if (n + 1 < cfg.s1Start) return `Stage 1 starts GW${cfg.s1Start}`;
  if (ref < cfg.s1Start + cfg.s1MaxRounds) return `Stage 1 runs to GW${cfg.s1Start + cfg.s1MaxRounds - 1} · Stage 2 starts GW${cfg.s2Start}`;
  if (ref < cfg.s2Start) return `Stage 2 starts GW${cfg.s2Start}`;
  if (ref < cfg.s2Start + cfg.s2MaxRounds) return `Stage 2 runs to GW${cfg.s2Start + cfg.s2MaxRounds - 1} · Final GW${cfg.finalStart}`;
  if (ref < cfg.finalStart) return `Final in GW${cfg.finalStart}`;
  if (n < cfg.finalStart) return `Champion decided after GW${cfg.finalStart} is confirmed`;
  return 'Champion crowned';
}

import React from 'react';
import type { GameweekStatus } from '@/lib/gameweek-status';

// `short` is an optional compact wording shown below the sm breakpoint. A status line rather
// than a pill: small capitals in the body face, with an amber dot while the numbers are still moving.
export default function GameweekBadge({ provisional, children, short, className = '' }: { provisional: boolean; children: React.ReactNode; short?: React.ReactNode; className?: string }) {
  const label = short ? (
    <>
      <span className="sm:hidden">{short}</span>
      <span className="hidden sm:inline">{children}</span>
    </>
  ) : children;

  return (
    <span className={`inline-flex items-center gap-2 max-w-full whitespace-nowrap text-xs sm:text-sm font-semibold uppercase tracking-[0.08em] ${provisional ? 'text-live-2' : 'text-dim'} ${className}`}>
      {provisional && <span className="w-2 h-2 rounded-full bg-live animate-pulse shrink-0" aria-hidden="true" />}
      <span className="min-w-0">{label}</span>
    </span>
  );
}

export function LiveChip({ label = 'Live' }: { label?: string }) {
  return (
    <span className="bg-brand text-white text-xs px-2 py-0.5 rounded-sm font-bold uppercase tracking-wider animate-pulse">
      {label}
    </span>
  );
}

// The one badge every page uses: which week the numbers cover and whether they are final.
// Pages add a sentence of detail below the table where it matters.
export function GameweekChip({ gw, startGw, week, live }: { gw: GameweekStatus; startGw?: number; week?: number; live?: boolean }) {
  // Before a tournament starts the page's schedule and its pending card both give the
  // week, so the chip says status only.
  if (startGw && gw.syncedThroughGw + 1 < startGw && !(gw.liveGw && gw.liveGw >= startGw)) {
    return <GameweekBadge provisional={false}>Pending</GameweekBadge>;
  }
  const isLive = live ?? !!gw.liveGw;
  const shown = week ?? (isLive ? (gw.liveGw as number) : gw.syncedThroughGw);
  return <GameweekBadge provisional={isLive}>{isLive ? `GW${shown} · Live` : `GW${shown} Complete`}</GameweekBadge>;
}

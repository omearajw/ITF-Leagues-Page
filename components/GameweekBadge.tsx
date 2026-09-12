import React from 'react';

// `short` is an optional compact wording shown below the sm breakpoint.
export default function GameweekBadge({ provisional, children, short, className = '' }: { provisional: boolean; children: React.ReactNode; short?: React.ReactNode; className?: string }) {
  const label = short ? (
    <>
      <span className="sm:hidden">{short}</span>
      <span className="hidden sm:inline">{children}</span>
    </>
  ) : children;

  if (provisional) {
    return (
      <span className={`inline-flex items-center gap-2 max-w-full text-xs sm:text-sm font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded ${className}`}>
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
        <span className="min-w-0">{label}</span>
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center max-w-full text-xs sm:text-sm font-bold text-slate-500 bg-slate-200 px-3 py-1 rounded ${className}`}>
      <span className="min-w-0">{label}</span>
    </span>
  );
}

export function LiveChip({ label = 'Live' }: { label?: string }) {
  return (
    <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">
      {label}
    </span>
  );
}

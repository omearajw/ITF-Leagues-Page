import React from 'react';

export default function GameweekBadge({ provisional, children, className = '' }: { provisional: boolean; children: React.ReactNode; className?: string }) {
  if (provisional) {
    return (
      <span className={`inline-flex items-center gap-2 text-sm font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded ${className}`}>
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
        {children}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center text-sm font-bold text-slate-500 bg-slate-200 px-3 py-1 rounded ${className}`}>
      {children}
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

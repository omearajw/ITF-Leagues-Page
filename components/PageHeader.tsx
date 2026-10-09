import React from 'react';
import { ArrowUpRight } from 'lucide-react';

export const RULEBOOK_URL = 'https://itf1718.wordpress.com/itf-rulebook/';

// Shared page header, set like the hub masthead: an accent rule over the headline face. The title,
// any extra words and the status share one baseline, and wrap onto separate lines on phones
// instead of squeezing a single row. `rules` adds a quiet link to the rulebook, which stands in for
// a description of the competition.
export default function PageHeader({
  title, titleExtra, badge, actions, rules = false, children, className = 'mb-8 sm:mb-10',
}: {
  title: React.ReactNode;
  titleExtra?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  rules?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={className}>
      <span aria-hidden="true" className="block h-[5px] w-12 bg-brand mb-3" />
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-3 mb-5">
        <h1 className="font-display text-[2.6rem] sm:text-6xl leading-display tracking-[0.01em] text-ink flex flex-wrap items-baseline gap-x-3 gap-y-2 min-w-0">
          <span className="min-w-0">{title}</span>
          {titleExtra}
        </h1>
        {badge && <div className="flex">{badge}</div>}
        {(actions || rules) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 w-full sm:w-auto sm:ml-auto">
            {actions}
            {rules && (
              <a href={RULEBOOK_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-dim hover:text-ink whitespace-nowrap">
                Rules <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            )}
          </div>
        )}
      </div>
      {children}
    </header>
  );
}

import React from 'react';

// Shared page header, set like the hub masthead: an accent rule over the headline face. Title and
// badge wrap onto separate lines on phones instead of squeezing a single row.
export default function PageHeader({
  title, titleExtra, badge, actions, children, className = 'mb-8 sm:mb-10',
}: {
  title: React.ReactNode;
  titleExtra?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={className}>
      <span aria-hidden="true" className="block h-[5px] w-12 bg-brand mb-3" />
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 mb-5">
        <h1 className="font-display text-[2.6rem] sm:text-6xl leading-display tracking-[0.01em] text-ink flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
          <span className="min-w-0">{title}</span>
          {titleExtra}
        </h1>
        {(badge || actions) && (
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:ml-auto sm:pb-1">
            {badge}
            {actions}
          </div>
        )}
      </div>
      {children}
    </header>
  );
}

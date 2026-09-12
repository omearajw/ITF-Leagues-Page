import React from 'react';

// Shared page header: title and badge wrap onto separate lines on phones instead of
// squeezing each other in a single justify-between row.
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 mb-4">
        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
          <span>{title}</span>
          {titleExtra}
        </h1>
        {(badge || actions) && (
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:ml-auto">
            {badge}
            {actions}
          </div>
        )}
      </div>
      {children}
    </header>
  );
}

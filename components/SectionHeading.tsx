import React from 'react';

// A section head in the masthead's voice: a short red rule over condensed capitals, with a
// hairline under the row. `aside` holds the section's link or status on the right. `pending` is for
// loading placeholders: the rule stays undrawn until the finished heading replaces it.
export default function SectionHeading({ children, aside, as: Tag = 'h2', pending = false, className = 'mb-4' }: {
  children: React.ReactNode;
  aside?: React.ReactNode;
  pending?: boolean;
  as?: 'h2' | 'h3';
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-line pb-2 ${className}`}>
      <Tag className={`font-display text-[1.65rem] sm:text-[1.9rem] leading-none tracking-[0.01em] text-ink before:block before:h-[3px] before:w-8 before:bg-brand before:mb-2 ${pending ? 'section-rule-pending' : 'section-rule'}`}>
        {children}
      </Tag>
      {aside && <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm pb-0.5">{aside}</div>}
    </div>
  );
}

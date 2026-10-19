import React from 'react';
import SectionHeading from '@/components/SectionHeading';
import { DIVISIONS } from '@/lib/divisions';

// Loading placeholders. A page renders its fixed parts (title, headings, links) for real while
// its data loads, and these stand in only for the parts that wait on data, shaped like what
// arrives so nothing jumps when it lands. Colour, speed and rounding live in Bone.

export function Bone({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`bg-surface-3/60 animate-pulse rounded-sm ${className}`} />;
}

// Stands in for a status badge such as "GW6 Complete", beside a page title.
export function BadgeSkeleton() {
  return <Bone className="h-4 w-28 self-center" />;
}

// The row of gameweek buttons under a title.
export function SelectorSkeleton() {
  return (
    <div className="flex gap-1.5" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => <Bone key={i} className="h-8 w-12" />)}
    </div>
  );
}

// Lines of body text, the last one short.
export function TextSkeleton({ lines = 4, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2.5 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => <Bone key={i} className={`h-3.5 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />)}
    </div>
  );
}

// A list of two-line rows (team over manager) with a figure on the right, as in the survivor,
// standings and leader lists.
export function RowsSkeleton({ rows = 8, figure = true, className = '' }: { rows?: number; figure?: boolean; className?: string }) {
  return (
    <div className={`divide-y divide-line ${className}`} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 py-3">
          <div className="space-y-2 min-w-0 flex-1">
            <Bone className={`h-4 ${i % 3 === 0 ? 'w-40' : i % 3 === 1 ? 'w-32' : 'w-36'} max-w-full`} />
            <Bone className="h-3 w-24" />
          </div>
          {figure && <Bone className="h-8 w-12 shrink-0" />}
        </div>
      ))}
    </div>
  );
}

// A standings table: heavy header rule, then position, name block and figures per row.
export function TableSkeleton({ rows = 10, figures = 1 }: { rows?: number; figures?: number }) {
  return (
    <div aria-hidden="true">
      <div className="border-b-2 border-ink/80 py-2.5"><Bone className="h-3 w-24" /></div>
      <div className="divide-y divide-line">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <Bone className="h-6 w-6 shrink-0" />
            <div className="space-y-2 min-w-0 flex-1">
              <Bone className={`h-4 ${i % 3 === 0 ? 'w-40' : i % 3 === 1 ? 'w-32' : 'w-36'} max-w-full`} />
              <Bone className="h-3 w-24" />
            </div>
            {Array.from({ length: figures }, (_, j) => <Bone key={j} className={`shrink-0 ${j === figures - 1 ? 'h-8 w-12' : 'h-4 w-8 hidden md:block'}`} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

// A fixtures list: names either side of a score box.
function FixturesSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-2 py-3">
          <div className="flex-1 flex justify-end"><Bone className="h-4 w-28" /></div>
          <Bone className="h-7 w-[5.5rem] mx-1" />
          <div className="flex-1"><Bone className="h-4 w-28" /></div>
        </div>
      ))}
    </div>
  );
}

// ---- Page bodies: the parts below each page's real header ----

export function DivisionSkeleton() {
  return (
    <>
      {/* The same columns as a week with a write-up, which is nearly every week. */}
      <div className="grid grid-cols-1 xl:grid-cols-[25rem_minmax(0,1fr)] items-start gap-x-8 gap-y-10">
        <div className="max-w-[34rem] border-t border-line pt-5 xl:border-t-0 xl:pt-0 xl:border-r xl:pr-8">
          <Bone className="h-7 w-64 max-w-full mb-3" />
          <TextSkeleton lines={9} />
          <TextSkeleton lines={5} className="mt-5" />
        </div>
        <div className="min-w-0">
          <Bone className="h-3.5 w-80 max-w-full mb-3" />
          <TableSkeleton rows={10} figures={3} />
        </div>
      </div>
      <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-y-10 col-rules">
        {[0, 1].map(i => (
          <div key={i}>
            <div className="border-b border-line pb-2 mb-2"><Bone className="h-7 w-44" /></div>
            <FixturesSkeleton />
          </div>
        ))}
      </section>
    </>
  );
}

export function ITFOpenSkeleton() {
  return <TableSkeleton rows={12} figures={2} />;
}

export function FormGridSkeleton() {
  return (
    <div className="space-y-12">
      {DIVISIONS.map(d => (
        <section key={d.name}>
          <SectionHeading pending className="mb-1">{d.name}</SectionHeading>
          <div className="divide-y divide-line" aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <Bone className="h-5 w-5 shrink-0" />
                <Bone className="h-4 w-36" />
                <div className="ml-auto flex gap-1">{Array.from({ length: 5 }, (_, j) => <Bone key={j} className="h-7 w-7" />)}</div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function MotmSkeleton() {
  return (
    <div className="space-y-12">
      {[0, 1].map(m => (
        <section key={m}>
          <div className="border-b border-line pb-2 mb-4"><Bone className="h-8 w-56" /></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-y-8 col-rules">
            {DIVISIONS.map(d => (
              <div key={d.name} className="col-head">
                <Bone className="h-5 w-32 mb-2" />
                <RowsSkeleton rows={1} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function TotwSkeleton() {
  return (
    <>
      <section className="border-y border-line py-5 mb-10 flex items-end justify-between gap-6">
        <div className="space-y-3 flex-1 min-w-0">
          <Bone className="h-12 sm:h-14 w-64 max-w-full" />
          <Bone className="h-3.5 w-40 max-w-full" />
          {[0, 1, 2, 3].map(i => <Bone key={i} className="h-3.5 w-48 max-w-full" />)}
        </div>
        <Bone className="h-24 w-24 shrink-0" />
      </section>
      <TextSkeleton lines={4} className="max-w-[34rem] mb-10" />
      <Bone className="h-[28rem] w-full" />
    </>
  );
}

export function EliminatorSkeleton() {
  return (
    <>
      <TextSkeleton lines={3} className="max-w-[34rem] mb-12" />
      <div className="border-b border-line pb-2 mb-4"><Bone className="h-8 w-56" /></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-12">
        {[0, 1, 2].map(c => <RowsSkeleton key={c} rows={5} className={c > 0 ? 'hidden sm:block' : ''} />)}
      </div>
    </>
  );
}

export function ChampionsLeagueSkeleton() {
  return (
    <>
      <div className="flex gap-6 mb-10" aria-hidden="true">{[0, 1, 2].map(i => <Bone key={i} className="h-6 w-28" />)}</div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 xl:gap-0">
        <div className="xl:col-span-2 xl:pr-8">
          <div className="border-b border-line pb-2 mb-4"><Bone className="h-8 w-64" /></div>
          <RowsSkeleton rows={5} figure={false} />
        </div>
        <div className="xl:pl-8">
          <div className="border-b border-line pb-2 mb-4"><Bone className="h-8 w-48" /></div>
          <FixturesSkeleton rows={4} />
        </div>
      </div>
    </>
  );
}

export function OnionBaggersSkeleton() {
  return (
    <>
      <div className="flex gap-6 mb-10" aria-hidden="true">{[0, 1].map(i => <Bone key={i} className="h-6 w-36" />)}</div>
      <div className="border-b border-line pb-2 mb-4"><Bone className="h-8 w-56" /></div>
      <TextSkeleton lines={2} className="max-w-[34rem]" />
    </>
  );
}

// Team page and planner: the header (team name) renders for real; this is everything below it.
export function ManagerSkeleton() {
  return (
    <>
      <div className="flex flex-wrap gap-x-10 gap-y-4 border-y border-line py-4 mb-8" aria-hidden="true">
        {[0, 1, 2, 3].map(i => <div key={i} className="space-y-2"><Bone className="h-3 w-20" /><Bone className="h-5 w-16" /></div>)}
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2"><Bone className="h-4 w-24" /><SelectorSkeleton /></div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border-t-2 border-ink/80 mb-10" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="py-4 px-3 border-b border-line space-y-2"><Bone className="h-3 w-16" /><Bone className="h-8 w-12" /><Bone className="h-3 w-20" /></div>)}
      </div>
      <SectionHeading pending>Line-up</SectionHeading>
      <Bone className="h-[30rem] w-full" />
    </>
  );
}

export function PlannerSkeleton() {
  return (
    <>
      <div className="border-y border-line py-3 mb-5 flex gap-6" aria-hidden="true">{[0, 1, 2].map(i => <Bone key={i} className="h-5 w-28" />)}</div>
      <Bone className="h-[30rem] w-full" />
    </>
  );
}

// Hub: the real section headings, with each section's content as a placeholder.
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-12">
      <section>
        <SectionHeading pending>Team of the Week</SectionHeading>
        <div className="panel flex items-end justify-between gap-6" aria-hidden="true">
          <div className="space-y-3 flex-1 min-w-0"><Bone className="h-12 w-60 max-w-full" /><Bone className="h-3.5 w-36 max-w-full" /><Bone className="h-3.5 w-72 max-w-full" /></div>
          <Bone className="h-24 w-24 shrink-0" />
        </div>
      </section>
      <section>
        <SectionHeading pending>League</SectionHeading>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-y-10 col-rules">
          {DIVISIONS.map(d => (
            <div key={d.name} className="col-head">
              <Bone className="h-8 w-56 max-w-full mb-2" />
              <Bone className="h-3.5 w-32 mb-3" />
              <TextSkeleton lines={3} className="mb-6" />
              <RowsSkeleton rows={10} />
            </div>
          ))}
        </div>
      </section>
      <section>
        <SectionHeading pending>Tournaments</SectionHeading>
        <div className="grid grid-cols-1 md:grid-cols-3 items-start gap-4">
          {[0, 1, 2].map(i => <div key={i} className="panel space-y-3"><Bone className="h-8 w-48" /><Bone className="h-3.5 w-24" /><TextSkeleton lines={2} /></div>)}
        </div>
      </section>
      <section>
        <SectionHeading pending>Manager of the Month</SectionHeading>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-y-8 col-rules">
          {DIVISIONS.map(d => <div key={d.name} className="col-head"><Bone className="h-5 w-32 mb-2" /><RowsSkeleton rows={1} /></div>)}
        </div>
      </section>
      <section className="mb-12">
        <SectionHeading pending>The Open <span className="text-dim">· Top 10</span></SectionHeading>
        <TableSkeleton rows={10} figures={2} />
      </section>
    </div>
  );
}

// ---- Layout and staff pages ----

export function GameweekStripSkeleton() {
  return (
    <div className="bg-surface border-b border-line">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-10 py-2 flex items-center">
        <Bone className="h-4 w-72 max-w-full" />
      </div>
    </div>
  );
}

export function AdminSkeleton() {
  return (
    <div className="space-y-8" aria-hidden="true">
      <Bone className="h-24 w-full" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-surface p-6 rounded-xl border space-y-5">
          <Bone className="h-8 w-56" />
          <Bone className="h-28 w-full" />
          <Bone className="h-32 w-full" />
          <Bone className="h-24 w-full" />
          <Bone className="h-11 w-full" />
        </div>
        <div className="bg-surface p-6 rounded-xl border space-y-4">
          <Bone className="h-8 w-64" />
          <Bone className="h-5 w-72" />
          <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <Bone key={i} className="h-10 w-full" />)}</div>
          <Bone className="h-11 w-full" />
        </div>
      </div>
    </div>
  );
}

export function EditorSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <Bone className="h-16 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {Array.from({ length: 4 }, (_, i) => <Bone key={i} className="h-72 w-full" />)}
      </div>
    </div>
  );
}

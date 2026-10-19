import PageHeader from '@/components/PageHeader';
import SectionHeading from '@/components/SectionHeading';
import { RowsSkeleton } from '@/components/Skeletons';
import { DIVISIONS } from '@/lib/divisions';

// The page may redirect straight to a saved team, which it has to decide before rendering
// anything, so the route shows this while it does.
export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto py-2 sm:py-8 font-sans">
      <PageHeader pending title="Which team is yours?">
        <p className="text-dim max-w-[34rem]">Pick your team once on this device and the site will take you straight to it: your page, your planner, your match-up. You can still look at everyone else&apos;s.</p>
      </PageHeader>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-10">
        {DIVISIONS.map(division => (
          <div key={division.name}>
            <SectionHeading as="h2" pending className="mb-0">{division.name}</SectionHeading>
            <RowsSkeleton rows={10} figure={false} />
          </div>
        ))}
      </div>
    </div>
  );
}

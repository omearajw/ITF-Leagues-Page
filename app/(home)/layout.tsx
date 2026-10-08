import { Suspense } from 'react';
import GameweekTimeline from '@/components/GameweekTimeline';
import { GameweekStripSkeleton } from '@/components/Skeletons';

// The dashboard's strip opens out into the full gameweek timeline.
export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<GameweekStripSkeleton />}>
        <GameweekTimeline />
      </Suspense>
      <main className="flex-grow max-w-7xl mx-auto w-full p-4 sm:p-7 lg:p-8 overflow-x-clip">
        {children}
      </main>
    </>
  );
}

import { Suspense } from 'react';
import GameweekStrip from '@/components/GameweekStrip';
import { GameweekStripSkeleton } from '@/components/Skeletons';

// Every page except the dashboard: the gameweek strip sits under the navbar.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<GameweekStripSkeleton />}>
        <GameweekStrip />
      </Suspense>
      <main className="flex-grow max-w-7xl mx-auto w-full p-4 sm:p-7 lg:p-8 overflow-x-clip">
        {children}
      </main>
    </>
  );
}

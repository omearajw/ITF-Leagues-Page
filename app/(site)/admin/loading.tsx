import { AdminSkeleton } from '@/components/Skeletons';

// The page checks its query string before its own Suspense, so the route shows this meanwhile.
export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto py-8">
      <header className="mb-8 border-b pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-ink">Tournament Administration</h1>
          <p className="text-dim">Configure start dates and manual entrants for the custom cups.</p>
        </div>
        <div className="text-sm font-bold text-dim bg-surface-3 px-3 py-1 rounded-full">
          Live Production
        </div>
      </header>
      <AdminSkeleton />
    </div>
  );
}

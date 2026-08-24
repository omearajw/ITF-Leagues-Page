import React from 'react';

// ==========================================
// THE MASTER SHAPE (Global Styling)
// ==========================================
// If you want to change the color, speed, or rounding of your skeletons,
// you ONLY change this one component.
function SkeletonBox({ className }: { className?: string }) {
  return (
    <div className={`bg-slate-200 animate-pulse rounded-xl ${className || ''}`} />
  );
}

// ==========================================
// PAGE-SPECIFIC LAYOUTS
// ==========================================

// 1. Eliminator Skeleton
export function EliminatorSkeleton({ phase = 'active' }: { phase?: 'pre' | 'active' }) {
  return (
    <div className="space-y-12">
      <div>
        <div className="flex items-center justify-between mb-4 gap-4">
          <SkeletonBox className="h-10 w-72" />
          <SkeletonBox className="h-8 w-36 rounded-md" />
        </div>
        <SkeletonBox className="h-24 w-full rounded-r-xl border-l-4 border-slate-300" />
      </div>

      {phase === 'pre' ? (
        <section className="bg-white border border-slate-200 rounded-xl p-12 shadow-sm">
          <div className="flex flex-col items-center">
            <SkeletonBox className="h-10 w-72 mb-4" />
            <SkeletonBox className="h-6 w-[28rem] max-w-full" />
          </div>
        </section>
      ) : (
        <>
          <div>
            <div className="flex items-center gap-3 mb-6">
              <SkeletonBox className="h-3 w-3 rounded-full" />
              <SkeletonBox className="h-8 w-72 rounded-md" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <SkeletonBox className="h-20 w-full" />
              <SkeletonBox className="h-20 w-full" />
              <SkeletonBox className="h-20 w-full" />
              <SkeletonBox className="h-20 w-full" />
              <SkeletonBox className="h-20 w-full" />
              <SkeletonBox className="h-20 w-full" />
            </div>
          </div>

          <div>
            <SkeletonBox className="h-8 w-56 mb-6 rounded-md" />
            <div className="bg-slate-900 rounded-xl p-4">
              <SkeletonBox className="h-56 w-full bg-slate-700" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// 2. Onion Baggers Skeleton
export function OnionBaggersSkeleton({ phase = 'qualifying' }: { phase?: 'pre' | 'qualifying' | 'knockouts' }) {
  return (
    <div className="space-y-10">
      <div className="flex justify-between items-end mb-2 gap-4">
        <SkeletonBox className="h-10 w-80" />
        <SkeletonBox className="h-8 w-36 rounded-md" />
      </div>
      <div className="flex gap-4 mb-4">
        <SkeletonBox className="h-8 w-52 rounded-md" />
        <SkeletonBox className="h-8 w-44 rounded-md" />
      </div>
      <SkeletonBox className="h-24 w-full rounded-r-xl border-l-4 border-slate-300" />

      {phase === 'pre' && (
        <section className="bg-white border border-slate-200 rounded-xl p-12 shadow-sm">
          <div className="flex flex-col items-center">
            <SkeletonBox className="h-10 w-72 mb-4" />
            <SkeletonBox className="h-6 w-[30rem] max-w-full" />
          </div>
        </section>
      )}

      {phase === 'qualifying' && (
        <section>
          <div className="flex items-center gap-3 mb-6">
            <SkeletonBox className="h-8 w-64 rounded-md" />
            <SkeletonBox className="h-3 w-3 rounded-full" />
          </div>
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <SkeletonBox className="h-[520px] w-full rounded-none" />
          </div>
        </section>
      )}

      {phase === 'knockouts' && (
        <section>
          <SkeletonBox className="h-8 w-56 mb-6 rounded-md" />
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <SkeletonBox className="h-[420px] w-full" />
          </div>
        </section>
      )}
    </div>
  );
}

// 3. Division Skeleton (Premier, Championship, League One)
export function DivisionSkeleton() {
  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-center justify-between mb-4 gap-4">
          <SkeletonBox className="h-10 w-64" />
          <SkeletonBox className="h-8 w-40 rounded-full" />
        </div>
        <SkeletonBox className="h-24 w-full rounded-r-xl border-l-4 border-slate-300" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <div className="p-4 bg-slate-900">
            <SkeletonBox className="h-6 w-full bg-slate-700" />
          </div>
          <div className="space-y-2 p-4">
            <SkeletonBox className="h-12 w-full" />
            <SkeletonBox className="h-12 w-full" />
            <SkeletonBox className="h-12 w-full" />
            <SkeletonBox className="h-12 w-full" />
            <SkeletonBox className="h-12 w-full" />
            <SkeletonBox className="h-12 w-full" />
            <SkeletonBox className="h-12 w-full" />
            <SkeletonBox className="h-12 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

// 4. Dashboard Skeleton (Home)
export function DashboardSkeleton() {
  return (
    <div className="space-y-10">
      <section>
        <SkeletonBox className="h-8 w-72 mb-4 rounded-md" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SkeletonBox className="h-64 w-full" />
          <SkeletonBox className="h-64 w-full" />
          <SkeletonBox className="h-64 w-full" />
        </div>
      </section>

      <section>
        <SkeletonBox className="h-8 w-64 mb-4 rounded-md" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SkeletonBox className="h-56 w-full" />
          <SkeletonBox className="h-56 w-full" />
          <SkeletonBox className="h-56 w-full" />
        </div>
      </section>

      <section>
        <div className="flex justify-between items-end mb-4 gap-4">
          <SkeletonBox className="h-8 w-60" />
          <SkeletonBox className="h-6 w-36 rounded-md" />
        </div>
        <SkeletonBox className="h-80 w-full" />
      </section>
    </div>
  );
}

// 5. Admin Skeleton
export function AdminSkeleton() {
  return (
    <div className="space-y-8">
      <SkeletonBox className="h-24 w-full bg-slate-300" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl border shadow-sm space-y-5">
          <SkeletonBox className="h-8 w-56 rounded-md" />
          <SkeletonBox className="h-28 w-full" />
          <SkeletonBox className="h-32 w-full" />
          <SkeletonBox className="h-24 w-full" />
          <SkeletonBox className="h-11 w-full rounded-lg" />
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
          <SkeletonBox className="h-8 w-64 rounded-md" />
          <SkeletonBox className="h-5 w-72 rounded-md" />
          <div className="space-y-2">
            <SkeletonBox className="h-10 w-full" />
            <SkeletonBox className="h-10 w-full" />
            <SkeletonBox className="h-10 w-full" />
            <SkeletonBox className="h-10 w-full" />
            <SkeletonBox className="h-10 w-full" />
            <SkeletonBox className="h-10 w-full" />
          </div>
          <SkeletonBox className="h-11 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// 6. Editor Skeleton
export function EditorSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonBox className="h-16 w-full rounded-xl border border-slate-200" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <SkeletonBox className="h-72 w-full" />
        <SkeletonBox className="h-72 w-full" />
        <SkeletonBox className="h-72 w-full" />
        <SkeletonBox className="h-72 w-full" />
      </div>
    </div>
  );
}

// 7. Form Grid Skeleton
export function FormGridSkeleton() {
  return (
    <div className="space-y-12">
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <SkeletonBox className="h-12 w-full rounded-none" />
        <SkeletonBox className="h-80 w-full rounded-none" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <SkeletonBox className="h-12 w-full rounded-none" />
        <SkeletonBox className="h-80 w-full rounded-none" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <SkeletonBox className="h-12 w-full rounded-none" />
        <SkeletonBox className="h-80 w-full rounded-none" />
      </div>
    </div>
  );
}

// 8. ITF Open Skeleton
export function ITFOpenSkeleton() {
  return (
    <div className="overflow-x-auto">
      <SkeletonBox className="h-[520px] w-full" />
    </div>
  );
}

// 9. Champions League Skeleton
export function ChampionsLeagueSkeleton() {
  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-end justify-between mb-3 gap-4">
          <SkeletonBox className="h-10 w-72" />
          <SkeletonBox className="h-8 w-36 rounded-md" />
        </div>
        <div className="flex gap-3">
          <SkeletonBox className="h-8 w-28 rounded-md" />
          <SkeletonBox className="h-8 w-28 rounded-md" />
          <SkeletonBox className="h-8 w-24 rounded-md" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        <div className="xl:col-span-2 space-y-8">
          <SkeletonBox className="h-48 w-full" />
          <SkeletonBox className="h-72 w-full" />
          <SkeletonBox className="h-72 w-full" />
        </div>
        <div className="xl:col-span-1">
          <SkeletonBox className="h-[620px] w-full" />
        </div>
      </div>
    </div>
  );
}
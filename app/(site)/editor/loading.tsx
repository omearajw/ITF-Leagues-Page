import { EditorSkeleton } from '@/components/Skeletons';

// The page checks its query string before its own Suspense, so the route shows this meanwhile.
export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto py-8">
      <header className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-bold text-ink">Content Editor</h1>
        <p className="text-dim">Update weekly write-ups and snippets displayed across the ITF Hub.</p>
      </header>
      <EditorSkeleton />
    </div>
  );
}

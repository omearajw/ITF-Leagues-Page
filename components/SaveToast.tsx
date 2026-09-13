'use client';

import { useEffect, useState } from 'react';

// Shown after a server action redirects back with ?saved=...; clears itself and the query param.
export default function SaveToast({ message }: { message: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('saved')) {
      url.searchParams.delete('saved');
      window.history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
    }
    const timer = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;
  return (
    <div role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2">
      <span aria-hidden="true">✓</span> {message}
    </div>
  );
}

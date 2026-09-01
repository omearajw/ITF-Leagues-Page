"use client";
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export default function Snippet({ preview, full, link }: { preview?: string, full?: string, link: string }) {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setOverflow(el.scrollHeight > el.clientHeight || (full || '').length > (preview || '').length);
  }, [preview, full]);

  return (
    <div>
      <p ref={ref} className="italic mb-4 text-xs text-slate-500 line-clamp-3">
        "{preview || full || 'No snippet.'}"{overflow && (
          <Link href={link} className="text-blue-500 font-semibold hover:underline ml-1">Read more</Link>
        )}
      </p>
    </div>
  );
}

"use client";
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export default function Snippet({ preview, full, link }: { preview?: string, full?: string, link: string }) {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflow(el.scrollHeight > el.clientHeight || (full || '').length > (preview || '').length);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [preview, full]);

  return (
    <div className="mb-4">
      <p ref={ref} className="italic text-xs text-slate-500 line-clamp-3">
        "{preview || full || 'No snippet.'}"
      </p>
      {overflow && (
        <Link href={link} className="inline-block mt-1 py-1 text-xs text-blue-500 font-semibold hover:underline">Read more</Link>
      )}
    </div>
  );
}

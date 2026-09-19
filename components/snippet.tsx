"use client";
import Link from 'next/link';

export default function Snippet({ preview, full, link }: { preview?: string, full?: string, link: string }) {
  const text = preview || full;
  if (!text) return null;
  return (
    <div className="mb-4">
      <p className="text-xs text-dim line-clamp-3 whitespace-pre-line">{text}</p>
      <Link href={link} className="inline-block mt-1 py-1 text-xs text-brand-2 font-semibold hover:underline whitespace-nowrap">Read more &rarr;</Link>
    </div>
  );
}

import Link from 'next/link';

// Fixed height whether or not a write-up exists, so the widgets below it line up
// across the dashboard grid. Three lines of text-xs is 3rem.
export default function Snippet({ preview, full, link, placeholder = 'No write-up yet.' }: { preview?: string, full?: string, link: string, placeholder?: string }) {
  const text = preview || full;
  return (
    <div className="mb-4">
      <p className={`text-xs line-clamp-3 min-h-[3rem] whitespace-pre-line ${text ? 'text-dim' : 'text-faint italic'}`}>
        {text || placeholder}
      </p>
      {text ? (
        <Link href={link} className="inline-block mt-1 py-1 text-xs text-brand-2 font-semibold hover:underline whitespace-nowrap">Read more &rarr;</Link>
      ) : (
        <span className="inline-block mt-1 py-1 text-xs invisible select-none" aria-hidden="true">Read more</span>
      )}
    </div>
  );
}

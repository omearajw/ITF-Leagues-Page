import Link from 'next/link';

// Fixed height whether or not a write-up exists, so the widgets below it line up
// across the dashboard grid. Three lines of text-sm at 1.45 line height is 3.8rem.
export default function Snippet({ preview, full, link, placeholder = 'No write-up yet.' }: { preview?: string, full?: string, link: string, placeholder?: string }) {
  const text = preview || full;
  return (
    <div className="mb-4">
      <p className={`text-sm leading-[1.45] line-clamp-3 min-h-[3.8rem] whitespace-pre-line ${text ? 'text-ink-2' : 'text-faint italic'}`}>
        {text || placeholder}
      </p>
      {text ? (
        <Link href={link} className="inline-block mt-1 py-1 text-sm text-brand-2 font-semibold hover:underline whitespace-nowrap">Read more &rarr;</Link>
      ) : (
        <span className="inline-block mt-1 py-1 text-sm invisible select-none" aria-hidden="true">Read more</span>
      )}
    </div>
  );
}

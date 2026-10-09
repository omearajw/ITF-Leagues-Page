import Link from 'next/link';

// Cuts a teaser at the last whole word that fits and marks the cut with an ellipsis, so a snippet
// never stops part-way through a word.
export function excerpt(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(' ');
  return cut.slice(0, lastSpace > 0 ? lastSpace : max).replace(/[\s,;:.!?–—-]+$/, '') + '…';
}

// Fixed height whether or not a write-up exists, so the widgets below it line up
// across the dashboard grid. Three lines of text-sm at 1.45 line height is 3.8rem; about 150
// characters fill them in a hub column.
export default function Snippet({ text, link, placeholder = 'To follow…', max = 150 }: { text?: string, link: string, placeholder?: string, max?: number }) {
  return (
    <div className="mb-4">
      <p className={`text-sm leading-[1.45] line-clamp-3 min-h-[3.8rem] whitespace-pre-line ${text ? 'text-ink-2' : 'text-faint italic'}`}>
        {text ? excerpt(text, max) : placeholder}
      </p>
      <div className="mt-1 text-right">
        {text ? (
          <Link href={link} className="inline-block py-1 text-sm text-brand-2 font-semibold hover:underline whitespace-nowrap">Read more &rarr;</Link>
        ) : (
          <span className="inline-block py-1 text-sm invisible select-none" aria-hidden="true">Read more</span>
        )}
      </div>
    </div>
  );
}

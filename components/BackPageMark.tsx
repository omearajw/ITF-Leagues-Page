import { MARK_VIEWBOX, MARK_WIDTH, MARK_HEIGHT, MARK_RULE, MARK_SHADOW, MARK_GLYPHS } from '@/lib/back-page-mark';

// One path for all the letters at rest; separate paths would each anti-alias where they meet.
const UNION = MARK_GLYPHS.map(g => g.d).join('');

const PATH = '[transform-box:fill-box] [transform-origin:center]';

// "THE BACK PAGE" lockup as outlines (see lib/back-page-mark.ts). Sized in em so the banner sets
// its height; the intro scales this same element up. `split` adds a path per letter so the intro
// can animate them; the intro hides those and shows the single path once they settle. `id` keeps
// the shadow filter unique when two copies are on the page.
export default function BackPageMark({ id, className = '', split = false }: { id: string; className?: string; split?: boolean }) {
  const filter = `back-page-shadow-${id}`;
  return (
    <svg
      viewBox={MARK_VIEWBOX}
      className={`block h-full w-auto overflow-visible select-none ${className}`}
      style={{ aspectRatio: `${MARK_WIDTH} / ${MARK_HEIGHT}` }}
      role="img"
      aria-label="The Back Page"
    >
      <defs>
        <filter id={filter} x="-10%" y="-10%" width="125%" height="125%">
          <feDropShadow dx={MARK_SHADOW.dx} dy={MARK_SHADOW.dy} stdDeviation={MARK_SHADOW.blur} floodColor="#000" floodOpacity={MARK_SHADOW.opacity} />
        </filter>
      </defs>
      <g data-mark filter={`url(#${filter})`}>
        <rect data-mark-rule className={PATH} {...MARK_RULE} style={{ fill: 'rgb(var(--color-brand))' }} />
        <g fill="#fff">
          {split && MARK_GLYPHS.map((glyph, i) => <path key={glyph.key} data-glyph={i} data-line={glyph.line} className={PATH} d={glyph.d} />)}
          <path data-mark-union d={UNION} />
        </g>
      </g>
    </svg>
  );
}

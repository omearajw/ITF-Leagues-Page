import { MARK_VIEWBOX, MARK_WIDTH, MARK_HEIGHT, MARK_SHADOW, MARK_GLYPHS, MARK_SPINE } from '@/lib/back-page-mark';

// Bottom to top. Each shadow is a whole layer beneath every letter, so a shadow never crosses
// a neighbouring letter, and the intro can move each letter's three copies independently.
const LAYERS = [
  { layer: 'dark', fill: '#2a1a0e', offset: MARK_SHADOW.dark },
  { layer: 'red', fill: 'rgb(var(--color-brand))', offset: MARK_SHADOW.red },
  { layer: 'cream', fill: '#fdf6ee', offset: null },
] as const;

const PATH = '[transform-box:fill-box] [transform-origin:center]';

// "the back page" lockup as outlines (see lib/back-page-mark.ts). Sized in em so the banner's
// responsive font size sets it; the intro scales this same element up.
export default function BackPageMark({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox={MARK_VIEWBOX}
      className={`block overflow-visible select-none text-[4rem] sm:text-[4.25rem] lg:text-[6.5rem] ${className}`}
      style={{ width: `${MARK_WIDTH / 100}em`, height: `${MARK_HEIGHT / 100}em` }}
      role="img"
      aria-label="the back page"
    >
      {LAYERS.map(({ layer, fill, offset }) => (
        <g key={layer} data-layer={layer} transform={offset ? `translate(${offset[0]} ${offset[1]})` : undefined} style={{ fill }}>
          <path data-glyph="spine" className={PATH} d={MARK_SPINE} />
          {MARK_GLYPHS.map((glyph, i) => <path key={glyph.key} data-glyph={i} data-line={glyph.line} className={PATH} d={glyph.d} />)}
        </g>
      ))}
    </svg>
  );
}

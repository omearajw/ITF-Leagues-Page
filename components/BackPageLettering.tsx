// "the back page" set like the supplied artwork: stacked, lines overlapping so each sits
// over the one above, with a hard offset shadow. The thin red layer is the brand accent.
export default function BackPageLettering({ className = '', animate = false }: { className?: string; animate?: boolean }) {
  return (
    <div
      className={`font-display lowercase leading-[0.74] tracking-[-0.03em] text-[#fdf6ee] select-none ${className}`}
      style={{ textShadow: '-0.03em 0.03em 0 rgb(var(--color-brand)), -0.07em 0.07em 0 #2a1a0e' }}
    >
      {['the', 'back', 'page'].map((word, i) => (
        <span key={word} className={`block ${i === 0 ? 'pl-[0.06em]' : ''} ${animate ? 'intro-word' : ''}`}>{word}</span>
      ))}
    </div>
  );
}

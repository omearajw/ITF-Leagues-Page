'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// A list that scrolls inside a box of fixed height, with a fade over its foot while there is more
// below, so it reads as scrollable rather than cut off. The fade goes once the end is reached.
// `boxClassName` sets when the box is height-limited and scrolls (e.g. only at xl); where it is
// not, the list is full length and the fade never shows.
export default function ScrollFade({ children, className = '', boxClassName = '' }: { children: React.ReactNode; className?: string; boxClassName?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  const check = useCallback(() => {
    const el = box.current;
    if (el) setMore(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [check]);

  return (
    <div className={`relative ${className}`}>
      <div ref={box} onScroll={check} className={boxClassName}>{children}</div>
      <div aria-hidden="true" className={`pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-bg to-transparent transition-opacity duration-200 ${more ? 'opacity-100' : 'opacity-0'}`} />
    </div>
  );
}

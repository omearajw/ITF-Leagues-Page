'use client';

import { useEffect, useRef } from 'react';

// The hub banner compresses against the navbar as you scroll down, to half its height, then
// scrolls away with the page. It never grows back while you stay on the page.
//
// The outer box holds the banner's space in the page; the inner one is sticky inside it, so while
// it shrinks its top stays under the navbar and its bottom stays on the content below.
export default function ShrinkingBanner({ className = '', children }: { className?: string; children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outer = outerRef.current, inner = innerRef.current;
    if (!outer || !inner) return;
    // The scroll is corrected by hand when the banner gives up its space (below); the browser's
    // own scroll anchoring would correct it a second time.
    const root = document.documentElement;
    const anchoring = root.style.overflowAnchor;
    root.style.overflowAnchor = 'none';

    let full = outer.offsetHeight, space = full, height = full, frame = 0;
    const update = () => {
      frame = 0;
      const nav = document.querySelector('nav');
      const navBottom = nav ? Math.max(0, nav.getBoundingClientRect().bottom) : 0;
      inner.style.top = `${navBottom}px`;
      // How far the banner's space has passed under the navbar.
      const under = navBottom - outer.getBoundingClientRect().top;
      const target = Math.max(Math.round(full / 2), Math.min(space, space - under));
      if (target < height) {
        height = target;
        inner.style.height = `${height}px`;
      }
      // Scrolling back up past where it shrank to would open a gap under the banner, so fold that
      // space away and move the page up by the same amount; nothing on screen shifts.
      if (space > height && under < space - height) {
        const delta = space - height;
        space = height;
        outer.style.height = `${space}px`;
        window.scrollBy(0, -delta);
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    // Until it has shrunk, follow the CSS height for the screen size.
    const resize = () => {
      if (height === full) {
        outer.style.height = '';
        inner.style.height = '';
        full = space = height = outer.offsetHeight;
      }
      schedule();
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', resize);
    update();
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frame);
      root.style.overflowAnchor = anchoring;
    };
  }, []);

  return (
    <div ref={outerRef} className={className}>
      <div ref={innerRef} className="sticky h-full">{children}</div>
    </div>
  );
}

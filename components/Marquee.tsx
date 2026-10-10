'use client';

import { useEffect, useRef, useState } from 'react';

// Time-based marquee. A CSS keyframe loop can freeze in Safari once the tab has been
// hidden; deriving the offset from elapsed time keeps it seamless and self-correcting.
export default function Marquee({ children, speed = 60 }: { children: React.ReactNode; speed?: number }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  // With Reduce Motion on, the strip holds still but can be swiped or scrolled sideways, so the
  // part past the edge of the screen isn't simply cut off.
  const [still, setStill] = useState(false);

  useEffect(() => {
    const track = trackRef.current;
    const group = groupRef.current;
    if (!track || !group) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStill(true);
      return;
    }

    let width = group.getBoundingClientRect().width;
    const measure = () => { width = group.getBoundingClientRect().width; };
    // Older iPads have no ResizeObserver; window resizes are close enough there.
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (observer) observer.observe(group);
    else window.addEventListener('resize', measure);

    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      if (width > 0) {
        const offset = (((now - start) / 1000) * speed) % width;
        track.style.transform = `translate3d(${-offset}px, 0, 0)`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [speed]);

  if (still) {
    return (
      <div className="overflow-x-auto no-scrollbar">
        <div className="flex w-max py-3 text-sm font-semibold">
          <div className="marquee-group">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={trackRef} className="flex w-max py-3 text-sm font-semibold" role="presentation">
      <div ref={groupRef} className="marquee-group" role="presentation">{children}</div>
      <div className="marquee-group" aria-hidden="true">{children}</div>
    </div>
  );
}

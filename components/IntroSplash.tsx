'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import BackPageMark from '@/components/BackPageMark';
import { buildStage, CHOREOGRAPHY } from '@/components/intro-concepts';
import { INTRO_DAY_KEY, introToday, REPLAY_INTRO_EVENT, DEFAULT_INTRO, introConceptFrom, type IntroConcept } from '@/lib/intro';

const SCROLL_KEYS = new Set([' ', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End']);
const EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';
const GRAIN = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`;

// Full-screen intro on the hub. One of the performances in intro-concepts.ts plays over the goal
// photo, then the photo and lettering fly into the banner (found by its data-intro-* attributes)
// so the animation ends as the page itself. Plays on the first hub visit of the day, whenever
// ?intro=<name> is in the address, or from the banner's replay button.
export default function IntroSplash() {
  const [run, setRun] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'perform' | 'landing' | 'done'>('idle');
  const [concept, setConcept] = useState<IntroConcept>(DEFAULT_INTRO);
  const overlayRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const landing = useRef(false);

  const finish = useCallback(() => {
    document.documentElement.dataset.intro = 'done';
    setPhase('done');
  }, []);

  // Measured at take-off rather than up front, so late layout changes on the page are allowed for.
  const land = useCallback((duration: number) => {
    if (landing.current) return;
    landing.current = true;
    const overlay = overlayRef.current, frame = frameRef.current, text = textRef.current;
    const photo = document.querySelector<HTMLImageElement>('img[data-intro-photo]');
    const lettering = document.querySelector<HTMLElement>('[data-intro-lettering]');
    if (!overlay || !frame || !text || !photo || !lettering) { finish(); return; }
    overlay.getAnimations({ subtree: true }).forEach(a => a.finish());
    setPhase('landing');

    const from = frame.getBoundingClientRect();
    const to = photo.getBoundingClientRect();
    const box = photo.parentElement ? getComputedStyle(photo.parentElement) : null;
    const radius = box ? Math.max(0, parseFloat(box.borderTopLeftRadius) - parseFloat(box.borderTopWidth)) : 0;
    // The intro mark is the banner's mark scaled up about its left edge, so it lands by scaling
    // back to 1 and ends identical to the banner's.
    const css = getComputedStyle(text).transform;
    const scale = new DOMMatrixReadOnly(css === 'none' ? undefined : css);
    const scaled = text.getBoundingClientRect();
    const height = scaled.height / scale.a;
    const textTo = lettering.getBoundingClientRect();
    const img = frame.querySelector('img');
    const timing = { duration, easing: EASE, fill: 'forwards' as const };

    frame.animate([
      { top: `${from.top}px`, left: `${from.left}px`, width: `${from.width}px`, height: `${from.height}px`, borderRadius: '0px' },
      { top: `${to.top}px`, left: `${to.left}px`, width: `${to.width}px`, height: `${to.height}px`, borderRadius: `${radius}px` },
    ], timing);
    img?.animate([{ objectPosition: getComputedStyle(img).objectPosition }, { objectPosition: getComputedStyle(photo).objectPosition }], timing);
    text.animate([
      { transform: scale.toString() },
      { transform: `translate(${textTo.left - scaled.left}px, ${textTo.top - (scaled.top + (scaled.height - height) / 2)}px)` },
    ], timing).finished.then(finish, finish);
  }, [finish]);

  useEffect(() => {
    const d = document.documentElement;
    const chosen = introConceptFrom(location.search);
    let play = d.dataset.intro === 'play';
    if (!d.dataset.intro) {
      try {
        if (chosen || (localStorage.getItem(INTRO_DAY_KEY) !== introToday() && !matchMedia('(prefers-reduced-motion: reduce)').matches)) {
          localStorage.setItem(INTRO_DAY_KEY, introToday());
          d.dataset.intro = 'play';
          play = true;
        }
      } catch {}
    }
    setConcept(chosen ?? DEFAULT_INTRO);
    setPhase(play ? 'perform' : 'done');

    const replay = () => {
      if (d.dataset.intro === 'play') return;
      landing.current = false;
      window.scrollTo(0, 0);
      d.dataset.intro = 'play';
      setConcept(introConceptFrom(location.search) ?? DEFAULT_INTRO);
      setRun(r => r + 1);
      setPhase('perform');
    };
    window.addEventListener(REPLAY_INTRO_EVENT, replay);
    return () => window.removeEventListener(REPLAY_INTRO_EVENT, replay);
  }, []);

  // The overlay stays hidden (see globals.css) until the performance's animations exist, so
  // their first frames are what appears. Take off a beat after it ends.
  useEffect(() => {
    if (phase !== 'perform') return;
    const root = overlayRef.current;
    const stage = root && buildStage(root);
    if (!root || !stage) { finish(); return; }
    const animations = CHOREOGRAPHY[concept](stage);
    root.dataset.ready = '1';
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    Promise.all(animations.map(a => a.finished)).catch(() => {}).then(() => { if (live) timer = setTimeout(() => land(900), 280); });
    return () => {
      live = false;
      clearTimeout(timer);
      // Landing finishes these and needs their end states; anything else (a remount) starts over.
      if (!landing.current) animations.forEach(a => a.cancel());
    };
  }, [phase, run, concept, land, finish]);

  // The landing spot is measured once, so the page must not scroll underneath.
  useEffect(() => {
    if (phase !== 'perform' && phase !== 'landing') return;
    const block = (e: Event) => e.preventDefault();
    const onKey = (e: KeyboardEvent) => { if (SCROLL_KEYS.has(e.key)) e.preventDefault(); land(450); };
    window.addEventListener('wheel', block, { passive: false });
    window.addEventListener('touchmove', block, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('wheel', block);
      window.removeEventListener('touchmove', block);
      window.removeEventListener('keydown', onKey);
    };
  }, [phase, land]);

  if (phase === 'done') return null;
  return (
    <div
      key={run}
      ref={overlayRef}
      className={`intro-splash fixed inset-0 z-[100] cursor-pointer ${phase === 'idle' ? '' : 'is-driven'}`}
      onClick={() => land(450)}
      aria-hidden="true"
    >
      <div ref={frameRef} data-intro-frame className="fixed inset-0 overflow-hidden bg-panel-2">
        {/* Not priority: a lazy image inside the hidden overlay is never fetched, so visitors who
            don't get the intro don't download the full-screen photo. */}
        <div data-intro-photo-layer className="intro-photo absolute inset-0">
          <Image src="/brand/the-back-page-blank.jpg" alt="" fill sizes="100vw" className="object-cover object-[65%_50%]" />
        </div>
      </div>
      <div data-intro-stage className="fixed inset-0 flex items-center px-[8vw] pointer-events-none">
        <div ref={textRef} className="origin-left scale-[1.65] sm:scale-[2.6] lg:scale-[2.15]">
          <BackPageMark />
        </div>
      </div>
      <div data-intro-grain className="fixed inset-0 pointer-events-none opacity-0 mix-blend-overlay" style={{ backgroundImage: GRAIN }} />
      <div data-intro-flash className="fixed inset-0 pointer-events-none opacity-0 bg-[#fdf6ee]" />
      {phase !== 'landing' && <span className="absolute bottom-5 right-5 text-xs font-semibold text-white/70">Tap to skip</span>}
    </div>
  );
}

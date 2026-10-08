'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import BackPageMark from '@/components/BackPageMark';
import { buildStage, CHOREOGRAPHY } from '@/components/intro-concepts';
import { INTRO_DAY_KEY, introToday, REPLAY_INTRO_EVENT, DEFAULT_INTRO, introConceptFrom, type IntroConcept } from '@/lib/intro';

const SCROLL_KEYS = new Set([' ', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End']);
const EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';
// Drawn at full screen size and shrunk on landing, never the banner's size enlarged: browsers
// rasterise an animated element at its own size, so enlarging a small one blurs the lettering.
function fitLettering(text: HTMLElement | null) {
  const target = document.querySelector<HTMLElement>('[data-intro-lettering]');
  if (!text || !target) return;
  const { width, height } = target.getBoundingClientRect();
  const k = Math.min(window.innerHeight * 0.62 / height, window.innerWidth * 0.84 / width);
  text.style.height = `${height * k}px`;
}

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
    if (!text.style.height) fitLettering(text);
    // A skip while the photos are still loading arrives before the overlay is revealed.
    overlay.dataset.ready = '1';
    overlay.dataset.settled = '1';
    setPhase('landing');

    const from = frame.getBoundingClientRect();
    const to = photo.getBoundingClientRect();
    const box = photo.parentElement ? getComputedStyle(photo.parentElement) : null;
    const radius = box ? Math.max(0, parseFloat(box.borderTopLeftRadius) - parseFloat(box.borderTopWidth)) : 0;
    // The intro mark is the banner's mark at a larger size; it lands by shrinking onto it.
    const textFrom = text.getBoundingClientRect();
    const textTo = lettering.getBoundingClientRect();
    const target = getComputedStyle(photo).objectPosition;
    const timing = { duration, easing: EASE, fill: 'forwards' as const };

    frame.animate([
      { top: `${from.top}px`, left: `${from.left}px`, width: `${from.width}px`, height: `${from.height}px`, borderRadius: '0px' },
      { top: `${to.top}px`, left: `${to.left}px`, width: `${to.width}px`, height: `${to.height}px`, borderRadius: `${radius}px` },
    ], timing);
    frame.querySelectorAll('img').forEach(img => img.animate([{ objectPosition: getComputedStyle(img).objectPosition }, { objectPosition: target }], timing));
    text.animate([
      { transform: 'none' },
      { transform: `translate(${textTo.left - textFrom.left}px, ${textTo.top - textFrom.top}px) scale(${textTo.height / textFrom.height})` },
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
  // Both photos are decoded first (for up to 2.5s) so the lights never come up on an empty frame.
  useEffect(() => {
    if (phase !== 'perform') return;
    const root = overlayRef.current;
    const stage = root && buildStage(root);
    if (!root || !stage) { finish(); return; }
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let animations: Animation[] = [];
    const photos = Array.from(root.querySelectorAll('img'), img => img.decode().catch(() => {}));
    Promise.race([Promise.all(photos), new Promise(r => setTimeout(r, 2500))]).then(() => {
      if (!live || landing.current) return;
      fitLettering(textRef.current);
      animations = CHOREOGRAPHY[concept](stage);
      root.dataset.ready = '1';
      return Promise.all(animations.map(a => a.finished)).catch(() => {}).then(() => {
        if (!live) return;
        // Letters at rest: swap them for the seamless single shape the banner uses.
        root.dataset.settled = '1';
        timer = setTimeout(() => land(900), 280);
      });
    });
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
        {/* The same shot with the floodlights off and on, aligned pixel for pixel, so the lights
            come on by fading the lit one in. Full resolution and not through the image optimiser:
            cropped to fill a tall screen the photo is shown well beyond its width, so any smaller
            copy turns blocky. Lazy images inside the hidden overlay are never fetched, so
            visitors who don't get the intro don't download them. */}
        <div data-intro-photo-layer className="intro-photo absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/intro-night.jpg" alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover object-[65%_50%]" />
          <div data-intro-lit className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/intro-lit.jpg" alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover object-[65%_50%]" />
          </div>
        </div>
      </div>
      <div data-intro-stage className="fixed inset-0 flex items-center px-[8vw] pointer-events-none">
        <div ref={textRef} className="origin-top-left">
          <BackPageMark id="intro" split />
        </div>
      </div>
      <div data-intro-grain className="fixed inset-0 pointer-events-none opacity-0 mix-blend-overlay" style={{ backgroundImage: GRAIN }} />
      <div data-intro-flash className="fixed inset-0 pointer-events-none opacity-0 bg-[#fdf6ee]" />
      {phase !== 'landing' && <span className="absolute bottom-5 right-5 text-xs font-semibold text-white/70">Tap to skip</span>}
    </div>
  );
}

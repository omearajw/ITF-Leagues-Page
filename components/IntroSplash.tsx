'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import BackPageLettering from '@/components/BackPageLettering';

// First page of a browser session only; lib/intro.ts decides before first paint. The CSS
// animation fades it out on its own, so the timers here only remove it from the page
// afterwards. A tap or key skips straight to the site.
export default function IntroSplash() {
  const [state, setState] = useState<'show' | 'leaving' | 'gone'>('show');

  useEffect(() => {
    if (document.documentElement.dataset.intro === 'skip') { setState('gone'); return; }
    const done = setTimeout(() => setState('gone'), 2700);
    const skip = () => { setState('leaving'); setTimeout(() => setState('gone'), 350); };
    window.addEventListener('keydown', skip, { once: true });
    return () => { clearTimeout(done); window.removeEventListener('keydown', skip); };
  }, []);

  if (state === 'gone') return null;
  return (
    <div
      className={`intro-splash fixed inset-0 z-[100] bg-panel-2 overflow-hidden cursor-pointer ${state === 'leaving' ? 'is-leaving' : ''}`}
      onClick={() => { setState('leaving'); setTimeout(() => setState('gone'), 350); }}
      aria-hidden="true"
    >
      <div className="intro-photo absolute inset-0">
        <Image src="/brand/the-back-page-blank.jpg" alt="" fill priority sizes="100vw" className="object-cover object-[65%_50%]" />
      </div>
      <div className="absolute inset-0 flex items-center px-[8vw]">
        <BackPageLettering animate className="text-[22vw] sm:text-[15vw] lg:text-[11rem]" />
      </div>
      <span className="absolute bottom-5 right-5 text-xs font-semibold text-white/70">Tap to skip</span>
    </div>
  );
}

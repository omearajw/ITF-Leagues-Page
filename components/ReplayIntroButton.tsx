'use client';

import { REPLAY_INTRO_EVENT } from '@/lib/intro';

// Deliberately faint: an easter egg in the banner's corner rather than a control.
export default function ReplayIntroButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(REPLAY_INTRO_EVENT))}
      aria-label="Replay the intro"
      title="Replay the intro"
      className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full text-white/25 hover:text-white/90 hover:bg-black/30 focus-visible:text-white focus-visible:bg-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 transition"
    >
      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
        <path d="M13.5 2.5v3h-3" />
      </svg>
    </button>
  );
}

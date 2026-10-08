export const REPLAY_INTRO_EVENT = 'itf:replay-intro';

// Visitors get the intro on their first hub visit of each calendar day (their own timezone).
// The day it last played is kept in localStorage, so it holds across tabs and restarts.
export const INTRO_DAY_KEY = 'itf_intro_day';
export const introToday = () => new Date().toDateString();

// Three versions of the intro are built so one can be chosen; ?intro=<name> on the hub plays
// that one every time. Without it, visitors get the default.
export const INTRO_CONCEPTS = ['floodlights', 'kickoff', 'press'] as const;
export type IntroConcept = (typeof INTRO_CONCEPTS)[number];
export const DEFAULT_INTRO: IntroConcept = 'floodlights';

export function introConceptFrom(search: string): IntroConcept | null {
  const value = new URLSearchParams(search).get('intro');
  return INTRO_CONCEPTS.find(c => c === value) ?? null;
}

// Runs in <head> before first paint, and only on the hub, because the intro lands on the hub's
// banner (see components/IntroSplash.tsx). Deciding here rather than after hydration means a
// visitor who has already had today's intro never sees the overlay flash. Arriving at the hub
// by client navigation skips this, and the component makes the same decision itself.
export const INTRO_HEAD_SCRIPT = `try{if(location.pathname==='/'){var d=document.documentElement,t=new Date().toDateString(),f=/[?&]intro=(${INTRO_CONCEPTS.join('|')})(&|$)/.test(location.search);if(!f&&(localStorage.getItem('${INTRO_DAY_KEY}')===t||matchMedia('(prefers-reduced-motion: reduce)').matches)){d.dataset.intro='skip'}else{localStorage.setItem('${INTRO_DAY_KEY}',t);d.dataset.intro='play'}}}catch(e){}`;

export const INTRO_SEEN_KEY = 'itf_intro_seen';

// Runs in <head> before first paint (see components/IntroSplash.tsx). Marking the session
// here, rather than after hydration, means a returning visitor never sees the overlay flash,
// and a page that fails to hydrate still only shows the intro once.
export const INTRO_HEAD_SCRIPT = `try{var d=document.documentElement;if(sessionStorage.getItem('${INTRO_SEEN_KEY}')==='1'||matchMedia('(prefers-reduced-motion: reduce)').matches){d.dataset.intro='skip'}else{sessionStorage.setItem('${INTRO_SEEN_KEY}','1')}}catch(e){document.documentElement.dataset.intro='skip'}`;

// Themes visitors can switch to with ?theme=<name> on any address; the choice is kept in
// localStorage. 'new' is the :root values in app/globals.css. 'classic' (the pre-restyle look) is
// still defined there but switched off: add it back to this list to offer it again.
export const THEMES = ['new'] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = 'new';
export const THEME_KEY = 'itf_theme';

// Runs in <head> before first paint, so a page never flashes in the other theme first. A stored
// choice that's no longer offered (e.g. 'classic') is cleared, so that device falls back to the default.
export const THEME_HEAD_SCRIPT = `(function(){var d=document.documentElement,t='${DEFAULT_THEME}',ok=/^(${THEMES.join('|')})$/;try{var m=/[?&]theme=([a-z]+)/.exec(location.search);if(m&&ok.test(m[1]))localStorage.setItem('${THEME_KEY}',m[1]);var s=localStorage.getItem('${THEME_KEY}');if(s&&ok.test(s))t=s;else if(s)localStorage.removeItem('${THEME_KEY}')}catch(e){}if(t!=='new')d.dataset.theme=t})();`;

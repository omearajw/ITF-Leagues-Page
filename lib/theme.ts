// Two themes, both defined in app/globals.css: 'new' (the :root values) and 'classic'. Visitors
// get DEFAULT_THEME unless they have chosen: ?theme=classic or ?theme=new on any address switches
// that device, and the choice is kept in localStorage.
export const THEMES = ['new', 'classic'] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = 'new';
export const THEME_KEY = 'itf_theme';

// Runs in <head> before first paint, so a page never flashes in the other theme first.
export const THEME_HEAD_SCRIPT = `(function(){var d=document.documentElement,t='${DEFAULT_THEME}',ok=/^(${THEMES.join('|')})$/;try{var m=/[?&]theme=([a-z]+)/.exec(location.search);if(m&&ok.test(m[1]))localStorage.setItem('${THEME_KEY}',m[1]);var s=localStorage.getItem('${THEME_KEY}');if(s&&ok.test(s))t=s}catch(e){}if(t!=='new')d.dataset.theme=t})();`;

import { Anton, Libre_Franklin, Open_Sans } from 'next/font/google';

// Display: the condensed capitals of the hub's "THE BACK PAGE" masthead, for page titles,
// section heads and big figures.
export const displayFont = Anton({ subsets: ['latin'], weight: '400', variable: '--font-display', display: 'swap' });

// Text: a Franklin Gothic revival, the newspaper sans that sits under condensed headlines.
export const textFont = Libre_Franklin({ subsets: ['latin'], variable: '--font-text', display: 'swap' });

// "itf fantasy football" wordmark, rebuilt from the old site's header image.
export const wordmarkFont = Open_Sans({ subsets: ['latin'], weight: ['600'], variable: '--font-wordmark', display: 'swap' });

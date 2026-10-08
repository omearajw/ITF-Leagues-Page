import { Archivo_Black, Open_Sans } from 'next/font/google';

// "itf fantasy football" wordmark, rebuilt from the old site's header image.
export const wordmarkFont = Open_Sans({ subsets: ['latin'], weight: ['600'], variable: '--font-wordmark', display: 'swap' });

// "the back page" lettering on the hub banner and the intro.
export const displayFont = Archivo_Black({ subsets: ['latin'], weight: '400', variable: '--font-display', display: 'swap' });

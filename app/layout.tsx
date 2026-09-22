import './globals.css';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { Suspense } from 'react';
import MobileNav from '@/components/mobile-nav';
import TickerServer from '@/components/TickerServer';
import { TickerSwitch } from '@/components/Ticker';

export const metadata = {
  title: 'ITF League Hub',
  description: 'Custom Fantasy Premier League Dashboard',
};

const navLink = 'whitespace-nowrap text-[13px] xl:text-sm text-ink-2 hover:text-white transition py-2 px-1.5 xl:px-2 rounded-md';
const navGroup = 'text-brand-2 font-bold tracking-widest text-[10px] uppercase hidden xl:block';

// Reference pages that still live on the old ITF site until they are rebuilt here (log items 7 and 8).
const FOOTER_LINKS = [
  { label: 'Rulebook', href: 'https://itf1718.wordpress.com/itf-rulebook/' },
  { label: 'Trophy Cabinets', href: 'https://itf1718.wordpress.com/honours/' },
  { label: 'Club History', href: 'http://wp.me/P8LnIt-6e' },
];

// 1. We extract the Navbar into its own async component
async function Navbar() {
  const cookieStore = await cookies();
  const role = cookieStore.get('itf_role')?.value;
  
  const isAdmin = role === process.env.ADMIN_SECRET_TOKEN;
  const isEditor = role === process.env.EDITOR_SECRET_TOKEN;

  return (
    <nav className="bg-panel text-white shadow-md">
      {/* TOP TIER: Logo and Tools */}
      <div className="border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="font-extrabold text-xl tracking-tight hover:opacity-80 transition">
                ITF<span className="text-brand-2">LEAGUE</span>
              </Link>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden md:flex items-center gap-1 text-xs font-medium uppercase tracking-wider">
                <Link href="/my-team" className="whitespace-nowrap text-dim hover:text-white transition px-2 py-2 rounded-md">My team</Link>
                <Link href="/plan" className="whitespace-nowrap bg-brand/15 text-brand hover:bg-brand/25 transition px-2.5 py-1.5 rounded-md font-bold">Plan</Link>
              </div>
              <TickerSwitch />
              {/* CONDITIONAL RENDERING FOR STAFF LINKS */}
              <div className="hidden md:flex space-x-6 text-xs font-medium uppercase tracking-wider">
                {(isAdmin || isEditor) && (
                  <Link href="/editor" className="text-faint hover:text-white transition px-2 py-2 rounded-md">Editor</Link>
                )}
                {isAdmin && (
                  <Link href="/admin" className="text-faint hover:text-white transition px-2 py-2 rounded-md">Admin</Link>
                )}
              </div>
              <div className="md:hidden">
                <MobileNav isAdmin={isAdmin} isEditor={isEditor} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM TIER: Grouped Navigation (desktop only; phones use the hamburger above) */}
      <div className="hidden md:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center py-3">
          <div className="flex-1 min-w-0">
            {/* Desktop nav groups: never wrap; spacing tightens at narrower widths and the
                group labels only appear when there is room, so the row stays on one line. */}
            <div className="hidden md:flex flex-nowrap items-center overflow-x-auto no-scrollbar">
              <Link href="/" className="whitespace-nowrap text-[13px] xl:text-sm font-black text-brand hover:text-brand/80 transition py-2 px-1.5 xl:px-2 rounded-md mr-3 xl:mr-5 border-r border-line pr-3 xl:pr-5">ITF Hub</Link>

              {/* GROUP 1: LEAGUE */}
              <div className="flex items-center shrink-0 space-x-1 xl:space-x-2 mr-3 xl:mr-5 border-r border-line pr-3 xl:pr-5">
                <span className={navGroup}>League</span>
                <Link href="/divisions/premier-league" className={navLink}>Premier</Link>
                <Link href="/divisions/championship" className={navLink}>Championship</Link>
                <Link href="/divisions/league-one" className={navLink}>League One</Link>
              </div>

              {/* GROUP 2: TOURNAMENTS */}
              <div className="flex items-center shrink-0 space-x-1 xl:space-x-2 mr-3 xl:mr-5 border-r border-line pr-3 xl:pr-5">
                <span className={navGroup}>Tournaments</span>
                <Link href="/tournaments/eliminator" className={navLink}>Eliminator</Link>
                <Link href="/tournaments/onion-baggers-cup" className={navLink}>OB Cup</Link>
                <Link href="/tournaments/champions-league" className={navLink}>Champions League</Link>
              </div>

              {/* GROUP 3: PERFORMANCE */}
              <div className="flex items-center shrink-0 space-x-1 xl:space-x-2">
                <span className={navGroup}>Performance</span>
                <Link href="/itf-open" className={navLink}>The Open</Link>
                <Link href="/motm" className={navLink}>MotM</Link>
                <Link href="/form" className={navLink}>Form</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

// 2. The main layout is no longer 'async' and doesn't directly call cookies
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="bg-bg text-ink font-sans min-h-screen flex flex-col">
        
        {/* 3. Wrap the dynamic Navbar in a Suspense boundary */}
        <Suspense fallback={<div className="h-14 md:h-[104px] bg-panel w-full animate-pulse" />}>
          <Navbar />
        </Suspense>

        {/* Route groups supply the page body: (site) adds the gameweek strip, (home) has the timeline card instead */}
        {children}

        {/* Bottom ticker (desktop) */}
        <Suspense fallback={null}>
          <TickerServer />
        </Suspense>

        {/* GLOBAL FOOTER */}
        <footer className="bg-panel text-dim text-center py-8 text-sm mt-auto relative z-30">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-3">
            {FOOTER_LINKS.map(link => (
              <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="text-faint hover:text-white transition">
                {link.label}
              </a>
            ))}
          </div>
          © 2026 ITF League. Data sourced from official FPL API.
        </footer>
        {/* Clears the fixed ticker (48px tall) so it never covers the end of the page */}
        <div className="hidden md:block h-12 bg-panel" aria-hidden="true" />
      </body>
    </html>
  );
}
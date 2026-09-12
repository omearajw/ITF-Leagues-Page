import './globals.css';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { Suspense } from 'react';
import MobileNav from '@/components/mobile-nav';
import GameweekStrip from '@/components/GameweekStrip';
import { GameweekStripSkeleton } from '@/components/Skeletons';

export const metadata = {
  title: 'ITF League Hub',
  description: 'Custom Fantasy Premier League Dashboard',
};

const navLink = 'whitespace-nowrap text-[13px] xl:text-sm text-slate-300 hover:text-white transition py-2 px-1.5 xl:px-2 rounded-md';

// 1. We extract the Navbar into its own async component
async function Navbar() {
  const cookieStore = await cookies();
  const role = cookieStore.get('itf_role')?.value;
  
  const isAdmin = role === process.env.ADMIN_SECRET_TOKEN;
  const isEditor = role === process.env.EDITOR_SECRET_TOKEN;

  return (
    <nav className="bg-slate-900 text-white shadow-md">
      {/* TOP TIER: Logo and Tools */}
      <div className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="font-extrabold text-xl tracking-tight hover:opacity-80 transition">
                ITF<span className="text-blue-400">LEAGUE</span>
              </Link>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              {/* CONDITIONAL RENDERING FOR STAFF LINKS */}
              <div className="hidden md:flex space-x-6 text-xs font-medium uppercase tracking-wider">
                {(isAdmin || isEditor) && (
                  <Link href="/editor" className="text-slate-400 hover:text-white transition px-2 py-2 rounded-md">Editor</Link>
                )}
                {isAdmin && (
                  <Link href="/admin" className="text-slate-400 hover:text-white transition px-2 py-2 rounded-md">Admin</Link>
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
              {/* GROUP 1: DIVISIONS */}
              <div className="flex items-center shrink-0 space-x-1 xl:space-x-2 mr-3 xl:mr-5 border-r border-slate-700 pr-3 xl:pr-5">
                <span className="text-slate-500 font-bold tracking-widest text-[10px] uppercase hidden 2xl:block">Divisions</span>
                <Link href="/divisions/premier-league" className={navLink}>Premier League</Link>
                <Link href="/divisions/championship" className={navLink}>Championship</Link>
                <Link href="/divisions/league-one" className={navLink}>League One</Link>
              </div>

              {/* GROUP 2: TOURNAMENTS */}
              <div className="flex items-center shrink-0 space-x-1 xl:space-x-2 mr-3 xl:mr-5 border-r border-slate-700 pr-3 xl:pr-5">
                <span className="text-slate-500 font-bold tracking-widest text-[10px] uppercase hidden 2xl:block">Cups</span>
                <Link href="/tournaments/onion-baggers-cup" className={navLink}>Onion Baggers</Link>
                <Link href="/tournaments/champions-league" className={navLink}>Champions League</Link>
                <Link href="/tournaments/eliminator" className={navLink}>Eliminator</Link>
              </div>

              {/* GROUP 3: EVERYTHING ELSE */}
              <div className="flex items-center shrink-0 space-x-1 xl:space-x-2">
                <span className="text-slate-500 font-bold tracking-widest text-[10px] uppercase hidden 2xl:block">Hub</span>
                <Link href="/" className={navLink}>Dashboard</Link>
                <Link href="/itf-open" className={navLink}>ITF Open</Link>
                <Link href="/form" className={navLink}>Form Grid</Link>
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
      <body className="bg-slate-50 text-slate-900 font-sans min-h-screen flex flex-col">
        
        {/* 3. Wrap the dynamic Navbar in a Suspense boundary */}
        <Suspense fallback={<div className="h-14 md:h-[104px] bg-slate-900 w-full animate-pulse" />}>
          <Navbar />
        </Suspense>

        <Suspense fallback={<GameweekStripSkeleton />}>
          <GameweekStrip />
        </Suspense>

        {/* PAGE CONTENT GOES HERE */}
        <main className="flex-grow max-w-7xl mx-auto w-full p-4 sm:p-7 lg:p-8">
          {children}
        </main>

        {/* GLOBAL FOOTER */}
        <footer className="bg-slate-900 text-slate-500 text-center py-8 text-sm mt-auto pb-10 relative z-30">
          © 2026 ITF League. Data sourced from official FPL API.
        </footer>
      </body>
    </html>
  );
}
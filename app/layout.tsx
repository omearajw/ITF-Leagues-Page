import './globals.css';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { Suspense } from 'react';
import MobileNav from '@/components/mobile-nav';
import { Analytics } from '@vercel/analytics/next';
import TickerServer from '@/components/TickerServer';
import { INTRO_HEAD_SCRIPT } from '@/lib/intro';
import { THEME_HEAD_SCRIPT } from '@/lib/theme';
import { FeedbackDialog, FeedbackTrigger } from '@/components/Feedback';
import { getUnreadFeedbackCount } from '@/lib/feedback-data';
import Image from 'next/image';
import { wordmarkFont, displayFont, textFont } from '@/lib/fonts';

export const metadata = {
  title: 'ITF Fantasy Football',
  description: 'For all your latest ITF flapdoodle and guff.',
};

const navLink = 'whitespace-nowrap text-[13px] xl:text-sm font-medium text-ink-2 hover:text-white transition py-2 px-1.5 xl:px-2 rounded-sm';
const navGroup = 'text-xs font-semibold uppercase tracking-[0.08em] text-faint hidden xl:block pl-1.5 xl:pl-2';

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
  const unreadFeedback = isAdmin ? await getUnreadFeedbackCount() : 0;

  return (
    <nav className="bg-panel text-white border-b border-line sticky top-0 z-50">
      {/* TOP TIER: Logo and Tools */}
      <div className="border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" aria-label="ITF Fantasy Football home" className="flex items-center gap-2.5 hover:opacity-80 transition">
                <Image src="/brand/itf-logo.png" alt="" width={40} height={40} priority className="h-10 w-10" />
                <span className="font-wordmark font-semibold lowercase text-brand text-[15px] leading-[0.78] tracking-[-0.01em]" aria-hidden="true">
                  <span className="block pl-[0.4em]">itf</span>
                  <span className="block">fantasy</span>
                  <span className="block pl-[0.2em]">football</span>
                </span>
              </Link>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden lg:flex items-center gap-2 text-sm font-semibold">
                <Link href="/my-team" className="whitespace-nowrap border border-line text-ink-2 hover:text-white hover:border-faint transition px-3 py-1.5 rounded-sm">My team</Link>
                <Link href="/plan" className="whitespace-nowrap border border-brand bg-brand text-white hover:bg-brand/85 transition px-3 py-1.5 rounded-sm">Plan next week</Link>
              </div>
              {/* CONDITIONAL RENDERING FOR STAFF LINKS */}
              {(isAdmin || isEditor) && (
                <div className="hidden lg:flex space-x-4 text-xs font-semibold uppercase tracking-[0.08em] -mr-2">
                  <Link href="/editor" className="text-faint hover:text-white transition px-2 py-2 rounded-sm">Editor</Link>
                  {isAdmin && (
                    <Link href="/admin" className="inline-flex items-center gap-1.5 text-faint hover:text-white transition px-2 py-2 rounded-sm">
                      Admin
                      {unreadFeedback > 0 && <span className="rounded-sm bg-brand px-1.5 py-0.5 text-[11px] leading-none text-white">{unreadFeedback}<span className="sr-only"> new feedback</span></span>}
                    </Link>
                  )}
                </div>
              )}
              <div className="lg:hidden">
                <MobileNav isAdmin={isAdmin} isEditor={isEditor} feedbackCount={unreadFeedback} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM TIER: Grouped Navigation (desktop only; phones use the hamburger above) */}
      <div className="hidden lg:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center py-3">
          <div className="flex-1 min-w-0">
            {/* Desktop nav groups: never wrap; spacing tightens at narrower widths and the
                group labels only appear when there is room, so the row stays on one line. */}
            <div className="hidden lg:flex flex-nowrap items-center -ml-1.5 xl:-ml-2">
              {/* GROUP 1: LEAGUE */}
              <div className="flex items-center shrink-0 space-x-1 xl:space-x-1.5 mr-3 xl:mr-4 border-r border-line pr-3 xl:pr-4">
                <span className={navGroup}>League</span>
                <Link href="/divisions/premier-league" className={navLink}>Premier</Link>
                <Link href="/divisions/championship" className={navLink}>Championship</Link>
                <Link href="/divisions/league-one" className={navLink}>League One</Link>
              </div>

              {/* GROUP 2: TOURNAMENTS */}
              <div className="flex items-center shrink-0 space-x-1 xl:space-x-1.5 mr-3 xl:mr-4 border-r border-line pr-3 xl:pr-4">
                <span className={navGroup}>Tournaments</span>
                <Link href="/tournaments/eliminator" className={navLink}>Eliminator</Link>
                <Link href="/tournaments/onion-baggers-cup" className={navLink}>OB Cup</Link>
                <Link href="/tournaments/champions-league" className={navLink}>Champions League</Link>
              </div>

              {/* GROUP 3: PERFORMANCE */}
              <div className="flex items-center shrink-0 space-x-1 xl:space-x-1.5">
                <span className={navGroup}>Performance</span>
                <Link href="/itf-open" className={navLink}>The Open</Link>
                <Link href="/motm" className={navLink}>MotM</Link>
                <Link href="/team-of-the-week" className={navLink}>TOTW</Link>
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
    // The theme and intro head scripts set data-theme and data-intro on <html> before React hydrates.
    <html lang="en" className={`${wordmarkFont.variable} ${displayFont.variable} ${textFont.variable}`} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script dangerouslySetInnerHTML={{ __html: THEME_HEAD_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: INTRO_HEAD_SCRIPT }} />
      </head>
      <body className="bg-bg text-ink font-sans min-h-screen flex flex-col">

        {/* 3. Wrap the dynamic Navbar in a Suspense boundary */}
        <Suspense fallback={<div className="h-14 lg:h-[104px] bg-panel w-full animate-pulse" />}>
          <Navbar />
        </Suspense>

        {/* Route groups supply the page body: (site) adds the gameweek strip, (home) has the timeline card instead */}
        {children}

        {/* Bottom ticker (desktop) */}
        <Suspense fallback={null}>
          <TickerServer />
        </Suspense>

        {/* GLOBAL FOOTER */}
        <footer className="bg-panel text-faint text-center py-8 text-sm mt-auto relative z-30 border-t border-line">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-3">
            {FOOTER_LINKS.map(link => (
              <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="font-semibold text-dim hover:text-white transition">
                {link.label}
              </a>
            ))}
            <FeedbackTrigger className="font-semibold text-dim hover:text-white transition" />
          </div>
          © 2026 ITF League. Data sourced from official FPL API.
        </footer>
        {/* Clears the fixed ticker (48px tall) so it never covers the end of the page */}
        <div className="hidden md:block h-12 bg-panel" aria-hidden="true" />
        <FeedbackDialog />
        <Analytics />
      </body>
    </html>
  );
}
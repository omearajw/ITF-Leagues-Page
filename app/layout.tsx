import './globals.css';
import Link from 'next/link';
import { cookies } from 'next/headers'; // <-- ADDED THIS

export const metadata = {
  title: 'ITF League Hub',
  description: 'Custom Fantasy Premier League Dashboard',
};

// <-- ADDED 'async' HERE so we can await the cookies
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  
  // <-- ADDED THIS BLOCK to grab the role silently
  const cookieStore = await cookies();
  const role = cookieStore.get('itf_role')?.value;
  
  const isAdmin = role === process.env.ADMIN_SECRET_TOKEN;
  const isEditor = role === process.env.EDITOR_SECRET_TOKEN;

  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 font-sans min-h-screen flex flex-col">
        
        {/* GLOBAL NAVIGATION BAR */}
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
                
                {/* CONDITIONAL RENDERING FOR STAFF LINKS */}
                <div className="flex space-x-6 text-xs font-medium uppercase tracking-wider">
                  {/* Shows for BOTH Admin and Editor */}
                  {(isAdmin || isEditor) && (
                    <Link href="/editor" className="text-slate-400 hover:text-white transition">Editor</Link>
                  )}
                  
                  {/* Shows for Admin ONLY */}
                  {isAdmin && (
                    <Link href="/admin" className="text-slate-400 hover:text-white transition">Admin</Link>
                  )}
                </div>

              </div>
            </div>
          </div>

          {/* BOTTOM TIER: Grouped Navigation */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center py-3 overflow-x-auto no-scrollbar">
              
              {/* GROUP 1: DIVISIONS (First) */}
              <div className="flex items-center space-x-4 mr-6 border-r border-slate-700 pr-6">
                <span className="text-slate-500 font-bold tracking-widest text-[10px] uppercase hidden md:block">Divisions</span>
                <Link href="/divisions/premier-league" className="text-sm text-slate-300 hover:text-white transition">Premier League</Link>
                <Link href="/divisions/championship" className="text-sm text-slate-300 hover:text-white transition">Championship</Link>
                <Link href="/divisions/league-one" className="text-sm text-slate-300 hover:text-white transition">League One</Link>
              </div>

              {/* GROUP 2: TOURNAMENTS (Second) */}
              <div className="flex items-center space-x-4 mr-6 border-r border-slate-700 pr-6">
                <span className="text-slate-500 font-bold tracking-widest text-[10px] uppercase hidden md:block">Cups</span>
                <Link href="/tournaments/eliminator" className="text-sm text-slate-300 hover:text-white transition">Eliminator</Link>
                <Link href="/tournaments/champions-league" className="text-sm text-slate-300 hover:text-white transition">Champions League</Link>
                <Link href="/tournaments/onion-baggers-cup" className="text-sm text-slate-300 hover:text-white transition">Onion Baggers</Link>
              </div>

              {/* GROUP 3: EVERYTHING ELSE (Third) */}
              <div className="flex items-center space-x-4">
                <span className="text-slate-500 font-bold tracking-widest text-[10px] uppercase hidden md:block">Hub</span>
                <Link href="/" className="text-sm text-slate-300 hover:text-white transition">Dashboard</Link>
                <Link href="/itf-open" className="text-sm text-slate-300 hover:text-white transition">ITF Open</Link>
                <Link href="/form" className="text-sm text-slate-300 hover:text-white transition">Form Grid</Link>
              </div>

            </div>
          </div>
        </nav>

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
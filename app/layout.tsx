import './globals.css'; // Make sure this matches your CSS file name
import Link from 'next/link';

export const metadata = {
  title: 'ITF League Hub',
  description: 'Custom Fantasy Premier League Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 font-sans min-h-screen flex flex-col">
        
        {/* GLOBAL NAVIGATION BAR */}
        <nav className="bg-slate-900 text-white shadow-md">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex justify-between items-center h-16">
              
              {/* Logo / Brand */}
              <div className="flex-shrink-0 flex items-center">
                <Link href="/" className="font-bold text-xl tracking-tight">
                  ITF<span className="text-blue-400">LEAGUE</span>
                </Link>
              </div>

              {/* Main Nav Links */}
              <div className="hidden md:flex space-x-6">
                <Link href="/" className="hover:text-blue-400 transition-colors">Dashboard</Link>
                <Link href="/itf-open" className="hover:text-blue-400 transition-colors">ITF Open</Link>
                <Link href="/form" className="hover:text-blue-400 transition-colors">Form Grid</Link>
                
                {/* Simple Dropdown representation (can make interactive later) */}
                <div className="group relative">
                  <span className="hover:text-blue-400 cursor-pointer transition-colors">Divisions ▾</span>
                  <div className="absolute hidden group-hover:block bg-white text-gray-800 mt-2 p-2 rounded shadow-lg z-50 w-40">
                    <Link href="/divisions/premier-league" className="block px-2 py-1 hover:bg-gray-100 rounded">Premier League</Link>
                    <Link href="/divisions/championship" className="block px-2 py-1 hover:bg-gray-100 rounded">Championship</Link>
                    <Link href="/divisions/league-one" className="block px-2 py-1 hover:bg-gray-100 rounded">League One</Link>
                  </div>
                </div>

                <div className="group relative">
                  <span className="hover:text-blue-400 cursor-pointer transition-colors">Tournaments ▾</span>
                  <div className="absolute hidden group-hover:block bg-white text-gray-800 mt-2 p-2 rounded shadow-lg z-50 w-48">
                    <Link href="/tournaments/eliminator" className="block px-2 py-1 hover:bg-gray-100 rounded">Eliminator</Link>
                    <Link href="/tournaments/champions-league" className="block px-2 py-1 hover:bg-gray-100 rounded">Champions League</Link>
                    <Link href="/tournaments/onion-baggers-cup" className="block px-2 py-1 hover:bg-gray-100 rounded">Onion Baggers Cup</Link>
                  </div>
                </div>
              </div>

              {/* Admin / Editor Tools */}
              <div className="flex space-x-4 text-sm">
                <Link href="/editor" className="text-gray-400 hover:text-white">Editor</Link>
                <Link href="/admin" className="text-gray-400 hover:text-white">Admin</Link>
              </div>

            </div>
          </div>
        </nav>

        {/* PAGE CONTENT GOES HERE */}
        <main className="flex-grow max-w-6xl mx-auto w-full p-4 sm:p-6 lg:p-8">
          {children}
        </main>

        {/* GLOBAL FOOTER */}
        <footer className="bg-slate-900 text-slate-500 text-center py-6 text-sm mt-auto">
          © 2026 ITF League. Data sourced from official FPL API.
        </footer>
      </body>
    </html>
  );
}
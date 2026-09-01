"use client";
import Link from 'next/link';
import { useState } from 'react';

export default function MobileNav({ isAdmin, isEditor }: { isAdmin?: boolean, isEditor?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden relative">
      <button
        aria-expanded={open}
        aria-label="Toggle navigation"
        onClick={() => setOpen(!open)}
        className="p-2 rounded-md text-slate-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 z-60 relative"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          {open ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} className="fixed inset-0 bg-black/30 z-40" />
          <div className="fixed inset-x-0 top-14 z-50 px-4">
            <div className="bg-slate-800 text-slate-200 rounded-lg p-3 space-y-2 max-w-lg mx-auto">
              <Link href="/" onClick={() => setOpen(false)} className="block py-2 px-3 rounded hover:bg-slate-700">Dashboard</Link>
              <Link href="/divisions/premier-league" onClick={() => setOpen(false)} className="block py-2 px-3 rounded hover:bg-slate-700">Premier League</Link>
              <Link href="/divisions/championship" onClick={() => setOpen(false)} className="block py-2 px-3 rounded hover:bg-slate-700">Championship</Link>
              <Link href="/divisions/league-one" onClick={() => setOpen(false)} className="block py-2 px-3 rounded hover:bg-slate-700">League One</Link>
              <Link href="/tournaments/onion-baggers-cup" onClick={() => setOpen(false)} className="block py-2 px-3 rounded hover:bg-slate-700">Onion Baggers</Link>
              <Link href="/tournaments/champions-league" onClick={() => setOpen(false)} className="block py-2 px-3 rounded hover:bg-slate-700">Champions League</Link>
              <Link href="/tournaments/eliminator" onClick={() => setOpen(false)} className="block py-2 px-3 rounded hover:bg-slate-700">Eliminator</Link>
              <Link href="/itf-open" onClick={() => setOpen(false)} className="block py-2 px-3 rounded hover:bg-slate-700">ITF Open</Link>
              <Link href="/form" onClick={() => setOpen(false)} className="block py-2 px-3 rounded hover:bg-slate-700">Form Grid</Link>
              {isEditor && <Link href="/editor" onClick={() => setOpen(false)} className="block py-2 px-3 rounded hover:bg-slate-700">Editor</Link>}
              {isAdmin && <Link href="/admin" onClick={() => setOpen(false)} className="block py-2 px-3 rounded hover:bg-slate-700">Admin</Link>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

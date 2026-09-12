"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/divisions/premier-league', label: 'Premier League' },
  { href: '/divisions/championship', label: 'Championship' },
  { href: '/divisions/league-one', label: 'League One' },
  { href: '/tournaments/onion-baggers-cup', label: 'Onion Baggers' },
  { href: '/tournaments/champions-league', label: 'Champions League' },
  { href: '/tournaments/eliminator', label: 'Eliminator' },
  { href: '/itf-open', label: 'ITF Open' },
  { href: '/form', label: 'Form Grid' },
];

export default function MobileNav({ isAdmin, isEditor }: { isAdmin?: boolean, isEditor?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const links = [
    ...LINKS,
    ...(isEditor || isAdmin ? [{ href: '/editor', label: 'Editor' }] : []),
    ...(isAdmin ? [{ href: '/admin', label: 'Admin' }] : []),
  ];

  return (
    <div className="relative">
      <button
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label="Toggle navigation"
        onClick={() => setOpen(!open)}
        className="relative z-50 p-2.5 -mr-2 rounded-md text-slate-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
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
          <div onClick={() => setOpen(false)} className="fixed inset-0 bg-black/40 z-40" />
          <div id="mobile-nav-panel" className="fixed inset-x-0 top-14 z-50 px-3 pb-3">
            <nav className="bg-slate-800 text-slate-200 rounded-xl p-2 max-h-[calc(100dvh-5rem)] overflow-y-auto shadow-xl">
              {links.map(link => {
                const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={`block py-3 px-4 rounded-lg text-base ${active ? 'bg-slate-700 text-white font-semibold' : 'hover:bg-slate-700'}`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </>
      )}
    </div>
  );
}

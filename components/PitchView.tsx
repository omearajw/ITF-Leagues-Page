'use client';

import { useEffect, useState } from 'react';
import { LiveChip } from '@/components/GameweekBadge';

export type PitchPlayer = {
  element: number;
  name: string;
  team: string;
  teamCode: number;
  code: number;
  position: 'GKP' | 'DEF' | 'MID' | 'FWD';
  points: number | null;
  multiplier: number;
  isCaptain: boolean;
  isVice: boolean;
  subbedIn: boolean;
  subbedOut: boolean;
};

type View = 'photo' | 'shirt' | 'plain';
const VIEWS: { key: View; label: string }[] = [{ key: 'photo', label: 'Photos' }, { key: 'shirt', label: 'Shirts' }, { key: 'plain', label: 'Plain' }];
const STORAGE_KEY = 'itf-pitch-view';
const POSITION_ORDER: PitchPlayer['position'][] = ['GKP', 'DEF', 'MID', 'FWD'];

// FPL's public artwork: club shirts (goalkeepers have their own kit), player headshots,
// and the silhouette FPL shows for players without a photo.
const shirtUrl = (p: PitchPlayer) => `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${p.teamCode}${p.position === 'GKP' ? '_1' : ''}-110.png`;
const photoUrl = (p: PitchPlayer) => `https://resources.premierleague.com/premierleague/photos/players/110x140/p${p.code}.png`;
const MISSING_PHOTO = 'https://resources.premierleague.com/premierleague/photos/players/110x140/Photo-Missing.png';

function Visual({ player, view }: { player: PitchPlayer; view: View }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    setSrc(view === 'photo' ? photoUrl(player) : view === 'shirt' ? shirtUrl(player) : null);
  }, [view, player]);

  const onError = () => {
    if (view === 'photo' && src !== MISSING_PHOTO) setSrc(MISSING_PHOTO);
    else setSrc(null);
  };

  // Fixed frame so rows keep the same height whichever view is chosen.
  return (
    <div className="mx-auto w-16 h-14 flex items-end justify-center">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" onError={onError} className={`max-h-14 w-auto object-contain object-bottom ${view === 'shirt' ? 'drop-shadow-[0_2px_2px_rgba(0,0,0,0.4)]' : 'drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)]'}`} />
      ) : (
        <div className="w-12 h-12 mb-1 rounded-full bg-[#0f2a1a]/80 border border-white/20 flex items-center justify-center text-[11px] font-black text-white">
          {player.team}
        </div>
      )}
    </div>
  );
}

function PlayerCard({ player, view, live, onGrass }: { player: PitchPlayer; view: View; live: boolean; onGrass: boolean }) {
  const scored = player.points === null ? null : player.points * (player.multiplier || 1);
  return (
    <div className={`relative w-full flex flex-col items-center ${player.subbedOut ? 'opacity-50' : ''}`} title={player.subbedIn ? 'Auto-subbed in' : player.subbedOut ? 'Auto-subbed out' : undefined}>
      {(player.isCaptain || player.isVice) && (
        <span className={`absolute top-0 right-0 sm:right-2 z-10 text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center ring-2 ring-black/30 ${player.isCaptain ? 'bg-brand text-white' : 'bg-white text-slate-900'}`}>
          {player.isCaptain ? 'C' : 'V'}
        </span>
      )}
      {(player.subbedIn || player.subbedOut) && (
        <span className={`absolute top-0 left-0 sm:left-2 z-10 text-[9px] font-black rounded-full px-1.5 h-5 flex items-center text-white ring-2 ring-black/30 ${player.subbedIn ? 'bg-green-500' : 'bg-red-500'}`}>
          {player.subbedIn ? 'IN' : 'OUT'}
        </span>
      )}
      <Visual player={player} view={view} />
      <div className="mt-1 w-full max-w-[7.5rem] rounded-md overflow-hidden shadow-md text-center">
        <div className={`px-1.5 py-1 text-[11px] sm:text-xs font-bold truncate ${onGrass ? 'bg-[#0b1f14] text-white' : 'bg-surface-3 text-ink'}`}>{player.name}</div>
        <div className={`px-1.5 py-0.5 text-xs font-black ${live ? 'bg-amber-300 text-slate-900' : 'bg-white text-slate-900'}`}>
          {scored === null ? '–' : scored}
          {player.multiplier > 1 && <span className="ml-1 text-[10px] font-bold text-slate-500 align-middle">×{player.multiplier}</span>}
        </div>
      </div>
    </div>
  );
}

// Pitch markings drawn with borders rather than a stretched SVG, so every line stays the
// same thickness whatever shape the pitch ends up.
function PitchMarkings() {
  const line = 'border-white/35';
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      <div className={`absolute inset-2 border-2 ${line} rounded-sm`} />
      <div className={`absolute left-2 right-2 top-1/2 border-t-2 ${line}`} />
      <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 sm:w-36 sm:h-36 rounded-full border-2 ${line}`} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/35" />

      {/* Top penalty area, goal box and D */}
      <div className={`absolute top-2 left-1/2 -translate-x-1/2 w-[58%] h-16 sm:h-24 border-2 border-t-0 ${line}`}>
        <div className={`absolute -bottom-5 sm:-bottom-7 left-1/2 -translate-x-1/2 w-14 h-5 sm:w-20 sm:h-7 rounded-b-full border-2 border-t-0 ${line}`} />
        <div className="absolute -bottom-3 sm:-bottom-5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white/35" />
      </div>
      <div className={`absolute top-2 left-1/2 -translate-x-1/2 w-[28%] h-6 sm:h-9 border-2 border-t-0 ${line}`} />

      {/* Bottom penalty area, goal box and D */}
      <div className={`absolute bottom-2 left-1/2 -translate-x-1/2 w-[58%] h-16 sm:h-24 border-2 border-b-0 ${line}`}>
        <div className={`absolute -top-5 sm:-top-7 left-1/2 -translate-x-1/2 w-14 h-5 sm:w-20 sm:h-7 rounded-t-full border-2 border-b-0 ${line}`} />
        <div className="absolute -top-3 sm:-top-5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white/35" />
      </div>
      <div className={`absolute bottom-2 left-1/2 -translate-x-1/2 w-[28%] h-6 sm:h-9 border-2 border-b-0 ${line}`} />
    </div>
  );
}

export default function PitchView({ starters, bench, benchPoints, live, pointsUnavailable }: { starters: PitchPlayer[]; bench: PitchPlayer[]; benchPoints: number; live: boolean; pointsUnavailable: boolean }) {
  const [view, setView] = useState<View>('photo');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as View | null;
      if (saved && VIEWS.some(v => v.key === saved)) setView(saved);
    } catch {}
  }, []);

  const choose = (next: View) => {
    setView(next);
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch {}
  };

  return (
    <section className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-bold text-ink flex items-center gap-2">
          Line-up {live && <LiveChip />}
          {pointsUnavailable && <span className="text-xs font-normal text-faint">player points unavailable</span>}
        </h2>
        <div className="flex rounded-lg border border-line overflow-hidden text-xs font-bold" role="group" aria-label="Player display">
          {VIEWS.map(v => (
            <button key={v.key} type="button" onClick={() => choose(v.key)} aria-pressed={view === v.key} className={`px-3 py-1.5 ${view === v.key ? 'bg-brand text-white' : 'bg-surface text-dim hover:text-ink'}`}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden shadow-lg border border-black/30">
        <div
          className="relative px-2 sm:px-6 pt-8 pb-6 space-y-5 sm:space-y-7"
          style={{ backgroundImage: 'repeating-linear-gradient(180deg, #2f8a4b 0px, #2f8a4b 48px, #2a7f44 48px, #2a7f44 96px)' }}
        >
          <PitchMarkings />
          <div className="relative space-y-5 sm:space-y-7">
            {POSITION_ORDER.map(position => {
              const row = starters.filter(p => p.position === position);
              if (row.length === 0) return null;
              return (
                <div key={position} className="flex justify-center items-start gap-1 sm:gap-3">
                  {row.map(p => (
                    <div key={p.element} className="w-[19%] sm:w-28 flex">
                      <PlayerCard player={p} view={view} live={live} onGrass />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-surface-2 border-t border-line px-2 sm:px-6 pt-4 pb-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-faint mb-3 text-center">Bench · {benchPoints} pts</div>
          <div className="flex justify-center items-start gap-1 sm:gap-3">
            {bench.map(p => (
              <div key={p.element} className="w-[19%] sm:w-28 flex">
                <PlayerCard player={{ ...p, multiplier: 1 }} view={view} live={live} onGrass={false} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

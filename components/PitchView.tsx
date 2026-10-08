'use client';

import { useEffect, useState } from 'react';
import { LiveChip } from '@/components/GameweekBadge';
import SectionHeading from '@/components/SectionHeading';

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
  // Live-week detail: has their match happened yet, and is an auto-sub projected?
  fixtureState?: 'none' | 'pending' | 'playing' | 'finished';
  minutes?: number;
  projectedOut?: boolean;
  projectedIn?: boolean;
  projectedUndecided?: boolean;
  projectedCaptain?: boolean;
  benchBoost?: boolean;
};

const POSITION_ORDER: PitchPlayer['position'][] = ['GKP', 'DEF', 'MID', 'FWD'];

// FPL's club shirts; goalkeepers have their own kit.
type VisualPlayer = Pick<PitchPlayer, 'element' | 'team' | 'teamCode' | 'code' | 'position'>;
export const shirtUrl = (p: Pick<VisualPlayer, 'teamCode' | 'position'>) => `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${p.teamCode}${p.position === 'GKP' ? '_1' : ''}-110.png`;

export function Visual({ player }: { player: VisualPlayer }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [player]);

  // Fixed frame so rows keep the same height even when a shirt is missing.
  return (
    <div className="mx-auto w-16 h-14 flex items-end justify-center">
      {failed ? (
        <div className="w-12 h-12 mb-1 rounded-full bg-plate/80 border border-white/20 flex items-center justify-center text-[11px] font-black text-white">
          {player.team}
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shirtUrl(player)} alt="" loading="lazy" onError={() => setFailed(true)} className="max-h-14 w-auto object-contain object-bottom drop-shadow-[0_2px_2px_rgba(0,0,0,0.4)]" />
      )}
    </div>
  );
}

// "Yet to play" marker: a drawn clock rather than an emoji, so it matches on every device.
function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 4.5V8l2.25 1.5" />
    </svg>
  );
}

function PlayerCard({ player, live, onGrass }: { player: PitchPlayer; live: boolean; onGrass: boolean }) {
  const yetToPlay = player.fixtureState === 'pending' || player.fixtureState === 'none';
  const playing = player.fixtureState === 'playing';
  const scored = player.points === null || yetToPlay ? null : player.points * (player.multiplier || 1);
  const faded = player.subbedOut || player.projectedOut || player.projectedUndecided;
  // Fills deep enough for white letters to pass contrast.
  const leftTag = player.projectedOut ? { text: '✕', cls: 'bg-loss text-white', title: 'Did not play: due to be auto-subbed out' }
    : player.projectedUndecided ? { text: '✕ ?', cls: 'bg-loss text-white', title: 'Did not play: which substitute comes on depends on matches still to be played' }
    : player.projectedIn ? { text: 'DUE ON', cls: 'bg-win text-white', title: 'Due to come on as an auto-sub' }
    : player.subbedIn ? { text: 'IN', cls: 'bg-win text-white', title: 'Auto-subbed in' }
    : player.subbedOut ? { text: 'OUT', cls: 'bg-loss text-white', title: 'Auto-subbed out' }
    : yetToPlay ? { text: <ClockIcon />, cls: 'bg-white/90 text-on-light', title: player.fixtureState === 'none' ? 'No fixture this week' : 'Yet to play' }
    : null;
  return (
    <div className={`relative w-full flex flex-col items-center ${faded ? 'opacity-50' : ''}`} title={leftTag?.title}>
      {(player.isCaptain || player.isVice || player.projectedCaptain) && (
        <span className={`absolute top-0 right-0 sm:right-2 z-10 text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center ring-2 ring-black/30 ${player.isCaptain || player.projectedCaptain ? 'bg-brand text-white' : 'bg-white text-on-light'}`} title={player.projectedCaptain ? 'Takes the armband: captain did not play' : undefined}>
          {player.isCaptain || player.projectedCaptain ? 'C' : 'V'}
        </span>
      )}
      {leftTag && (
        <span className={`absolute top-0 left-0 sm:left-2 z-10 text-[11px] font-black rounded-full px-1.5 h-5 flex items-center ring-2 ring-black/30 ${leftTag.cls}`}>{leftTag.text}</span>
      )}
      <Visual player={player} />
      <div className="mt-1 w-full max-w-[7.5rem] rounded-sm overflow-hidden text-center">
        <div className={`px-1.5 py-1 text-[11px] sm:text-xs font-bold truncate ${onGrass ? 'bg-plate text-white' : 'bg-surface-3 text-ink'}`}>{player.name}</div>
        <div className={`px-1.5 py-0.5 text-xs font-black ${live && playing ? 'bg-live-2 text-on-light' : yetToPlay ? 'bg-white/70 text-on-light/60' : 'bg-white text-on-light'}`}>
          {scored === null ? '–' : scored}
          {player.multiplier > 1 && scored !== null && <span className="ml-1 font-normal text-on-light/60">({player.points})</span>}
        </div>
      </div>
    </div>
  );
}

// Pitch markings drawn with borders rather than a stretched SVG, so every line stays the
// same thickness whatever shape the pitch ends up.
export function PitchMarkings() {
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

// Colours come from the theme (app/globals.css): a warm floodlight wash from the stands over mown stripes.
export const PITCH_STRIPES = 'radial-gradient(120% 70% at 50% 0%, rgb(255 244 222 / var(--pitch-light)), rgb(255 244 222 / 0) 70%), repeating-linear-gradient(180deg, rgb(var(--color-pitch)) 0px, rgb(var(--color-pitch)) 48px, rgb(var(--color-pitch-2)) 48px, rgb(var(--color-pitch-2)) 96px)';

// Generic pitch layout: four rows of starters on the grass, bench strip underneath.
export function PitchBoard<T>({ starters, bench, positionOf, renderPlayer, benchLabel, className = '' }: {
  starters: T[]; bench: T[]; positionOf: (p: T) => PitchPlayer['position']; renderPlayer: (p: T, onBench: boolean) => React.ReactNode; benchLabel: React.ReactNode; className?: string;
}) {
  return (
    <div className={`rounded-sm overflow-hidden border border-line ${className}`}>
      <div className="relative px-2 sm:px-6 pt-8 pb-6" style={{ backgroundImage: PITCH_STRIPES }}>
        <PitchMarkings />
        <div className="relative space-y-5 sm:space-y-7">
          {POSITION_ORDER.map(position => {
            const row = starters.filter(p => positionOf(p) === position);
            if (row.length === 0) return null;
            return (
              <div key={position} className="flex justify-center items-start gap-1 sm:gap-3">
                {row.map((p, i) => <div key={i} className="w-[19%] sm:w-28 flex">{renderPlayer(p, false)}</div>)}
              </div>
            );
          })}
        </div>
      </div>
      <div className="bg-surface-2 border-t border-line px-2 sm:px-6 pt-4 pb-4">
        <div className="label mb-3 text-center">{benchLabel}</div>
        <div className="flex justify-center items-start gap-1 sm:gap-3">
          {bench.map((p, i) => <div key={i} className="w-[19%] sm:w-28 flex">{renderPlayer(p, true)}</div>)}
        </div>
      </div>
    </div>
  );
}

// 3D flip between two boards of the same shape.
export function FlipPitch({ front, back, flipped }: { front: React.ReactNode; back: React.ReactNode; flipped: boolean }) {
  return (
    <div className="overflow-x-clip" style={{ perspective: '2000px' }}>
      <div className="relative transition-transform duration-700" style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
        {/* Absolutely positioned badges ignore the face's backface-visibility, so the hidden face is also made invisible once the turn completes. */}
        <div className={`flip-face transition-[visibility] duration-0 ${flipped ? 'invisible delay-300' : 'visible delay-0'}`} aria-hidden={flipped}>{front}</div>
        <div className={`flip-face absolute inset-0 transition-[visibility] duration-0 ${flipped ? 'visible delay-0' : 'invisible delay-300'}`} style={{ transform: 'rotateY(180deg)' }} aria-hidden={!flipped}>{back}</div>
      </div>
    </div>
  );
}

export function FlipButton({ flipped, onToggle, label }: { flipped: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" onClick={onToggle} aria-pressed={flipped} className={`text-sm font-semibold px-3 py-1.5 rounded-sm border transition whitespace-nowrap truncate max-w-[78vw] sm:max-w-sm ${flipped ? 'bg-live/15 border-live/40 text-live-2' : 'border-line text-ink-2 hover:text-ink hover:border-faint'}`}>
      {flipped ? '↺ Flip back' : `⇄ ${label}`}
    </button>
  );
}

export type PitchOpponent = { name: string; week: number; starters: PitchPlayer[]; bench: PitchPlayer[]; benchPoints: number };

export default function PitchView({ starters, bench, benchPoints, live, pointsUnavailable, opponent, title = 'Line-up' }: { starters: PitchPlayer[]; bench: PitchPlayer[]; benchPoints: number; live: boolean; pointsUnavailable: boolean; opponent?: PitchOpponent | null; title?: React.ReactNode }) {
  const [flipped, setFlipped] = useState(false);
  const mineIds = new Set([...starters, ...bench].map(p => p.element));
  const theirIds = new Set(opponent ? [...opponent.starters, ...opponent.bench].map(p => p.element) : []);

  const board = (list: PitchPlayer[], benchList: PitchPlayer[], label: string, sharedWith: Set<number>) => (
    <PitchBoard
      starters={list}
      bench={benchList}
      positionOf={p => p.position}
      benchLabel={label}
      renderPlayer={(p, onBench) => (
        <div className={`w-full ${sharedWith.has(p.element) ? 'opacity-90' : ''}`}>
          <PlayerCard player={onBench ? { ...p, multiplier: 1 } : p} live={live} onGrass={!onBench} />
          {opponent && sharedWith.has(p.element) && <div className="mx-auto mt-1 w-fit rounded-sm bg-black/55 px-1.5 text-[11px] font-bold uppercase tracking-wider text-white">both own</div>}
        </div>
      )}
    />
  );

  const boost = starters[0]?.benchBoost;
  const front = board(starters, bench, boost ? `Bench · ${benchPoints} pts · Bench Boost, all count` : `Bench · ${benchPoints} pts`, theirIds);
  const back = opponent ? board(opponent.starters, opponent.bench, `${opponent.name} bench · ${opponent.benchPoints} pts`, mineIds) : null;

  return (
    <section className="mb-10">
      <SectionHeading aside={opponent ? <FlipButton flipped={flipped} onToggle={() => setFlipped(f => !f)} label={`View GW${opponent.week} opponent (${opponent.name})`} /> : undefined}>
        {flipped && opponent ? <>{opponent.name}<span className="text-dim"> · GW{opponent.week} opponent</span></> : title}
        {live && <span className="ml-3 align-middle font-sans"><LiveChip /></span>}
        {pointsUnavailable && <span className="ml-3 align-middle font-sans normal-case text-sm text-dim">player points unavailable</span>}
      </SectionHeading>
      {back ? <FlipPitch front={front} back={back} flipped={flipped} /> : front}
    </section>
  );
}

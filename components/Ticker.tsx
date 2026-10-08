'use client';

import { useEffect, useState } from 'react';
import Marquee from '@/components/Marquee';
import type { TickerLive, TickerMotm } from '@/lib/ticker-data';

type Mode = 'motm' | 'live';
const STORAGE_KEY = 'itf-ticker-mode';
const EVENT = 'itf-ticker-mode';

// Mode lives in localStorage and is broadcast within the tab so the switch in the
// navbar and the bar at the bottom stay in step.
function useTickerMode(): [Mode, (m: Mode) => void] {
  const [mode, setMode] = useState<Mode>('motm');
  useEffect(() => {
    const read = () => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved === 'motm' || saved === 'live') setMode(saved);
      } catch {}
    };
    read();
    window.addEventListener(EVENT, read);
    window.addEventListener('storage', read);
    return () => { window.removeEventListener(EVENT, read); window.removeEventListener('storage', read); };
  }, []);
  const choose = (m: Mode) => {
    setMode(m);
    try { window.localStorage.setItem(STORAGE_KEY, m); } catch {}
    window.dispatchEvent(new Event(EVENT));
  };
  return [mode, choose];
}

export function TickerSwitch() {
  const [mode, choose] = useTickerMode();
  return (
    <div className="hidden md:flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em]" role="group" aria-label="Ticker">
      <span className="text-faint">Ticker</span>
      <div className="flex rounded-sm overflow-hidden border border-line">
        {([['motm', 'MotM'], ['live', 'Live']] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => choose(key)} aria-pressed={mode === key} className={`px-2 py-1 transition ${mode === key ? 'bg-brand text-white' : 'bg-panel-2 text-dim hover:text-ink'}`}>{label}</button>
        ))}
      </div>
    </div>
  );
}

const DIVISION_LABEL: Record<string, string> = { 'Premier League': 'PREMIER LEAGUE', Championship: 'CHAMPIONSHIP', 'League One': 'LEAGUE ONE' };

function Dot() { return <span>•</span>; }

// The league and the pipes between its entries carry the brand colour; the managers,
// fixtures and scores stay white so they are what you read.
function DivisionLine({ label, items, empty }: { label: string; items: string[]; empty: string }) {
  return (
    <span>
      <span className="text-brand-2 font-bold">{label}:</span>{' '}
      {items.length === 0 ? empty : items.map((item, i) => (
        <span key={i}>
          {i > 0 && <span className="text-brand-2 font-bold">{'\u00a0|\u00a0'}</span>}
          {item}
        </span>
      ))}
    </span>
  );
}

function MotmContent({ motm }: { motm: TickerMotm }) {
  if (!motm) return <><span className="font-display tracking-[0.04em] text-ink">MANAGER OF THE MONTH</span><Dot /><span>Awaiting the first confirmed gameweek</span><Dot /></>;
  return (
    <>
      <span className="font-display tracking-[0.04em] text-ink">MANAGER OF THE MONTH · {motm.label.toUpperCase()}{motm.complete ? '' : ' SO FAR'}</span>
      <Dot />
      {motm.divisions.map(d => (
        <span key={d.name} className="flex items-center gap-12">
          <DivisionLine label={DIVISION_LABEL[d.name] || d.name.toUpperCase()} items={d.podium} empty="Awaiting Data" />
          <Dot />
        </span>
      ))}
    </>
  );
}

function LiveContent({ live }: { live: TickerLive }) {
  return (
    <>
      <span className={`font-display tracking-[0.04em] ${live.isLive ? 'text-live-2' : 'text-ink'}`}>GW{live.gw} {live.isLive ? 'LIVE' : 'RESULTS'}</span>
      <Dot />
      {live.divisions.map(d => (
        <span key={d.name} className="flex items-center gap-12">
          <DivisionLine
            label={DIVISION_LABEL[d.name] || d.name.toUpperCase()}
            items={d.ties.map(t => `${t.home} ${t.homeScore ?? '–'}-${t.awayScore ?? '–'} ${t.away}`)}
            empty="No fixtures"
          />
          <Dot />
        </span>
      ))}
    </>
  );
}

export function TickerBar({ motm, live }: { motm: TickerMotm; live: TickerLive }) {
  const [mode] = useTickerMode();
  return (
    <div className="hidden md:block fixed bottom-0 left-0 w-full bg-panel text-white overflow-hidden border-t-[3px] border-brand z-40">
      <Marquee key={mode} speed={mode === 'live' ? 70 : 60}>
        {mode === 'live' ? <LiveContent live={live} /> : <MotmContent motm={motm} />}
      </Marquee>
    </div>
  );
}

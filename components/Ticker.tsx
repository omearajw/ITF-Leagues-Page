'use client';

import { useEffect, useState } from 'react';
import Marquee from '@/components/Marquee';
import type { TickerLive, TickerMotm } from '@/lib/ticker-data';

type Mode = 'motm' | 'live';
const STORAGE_KEY = 'itf-ticker-mode';
const EVENT = 'itf-ticker-mode';

// Mode lives in localStorage, broadcast within the tab and across tabs, so every open page
// shows the same feed.
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

// Sits at the left end of the bar it controls, so it's clear what it switches.
function TickerSwitch({ mode, choose }: { mode: Mode; choose: (m: Mode) => void }) {
  return (
    <div className="shrink-0 flex items-center px-3 bg-panel-2 border-r border-line" role="group" aria-label="Ticker shows">
      <div className="flex rounded-sm overflow-hidden border border-line text-xs font-semibold uppercase tracking-[0.08em]">
        {([['motm', 'MotM'], ['live', 'Live']] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => choose(key)} aria-pressed={mode === key} className={`px-2.5 py-1 transition ${mode === key ? 'bg-brand text-white' : 'bg-panel text-dim hover:text-ink'}`}>{label}</button>
        ))}
      </div>
    </div>
  );
}

const DIVISION_LABEL: Record<string, string> = { 'Premier League': 'PREMIER LEAGUE', Championship: 'CHAMPIONSHIP', 'League One': 'LEAGUE ONE' };

function Dot() { return <span>•</span>; }

// Once per loop, a plain reminder of where feedback goes (the ticker itself isn't clickable).
function FeedbackReminder() {
  return <><span className="text-dim">Spotted a bug or got an idea for the site? Use Feedback in the top bar.</span><Dot /></>;
}

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
      <FeedbackReminder />
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
      <FeedbackReminder />
    </>
  );
}

export function TickerBar({ motm, live }: { motm: TickerMotm; live: TickerLive }) {
  const [mode, choose] = useTickerMode();
  return (
    <div className="hidden md:flex fixed bottom-0 left-0 w-full bg-panel text-white border-t-[3px] border-brand z-40">
      <TickerSwitch mode={mode} choose={choose} />
      <div className="flex-1 min-w-0 overflow-hidden">
        <Marquee key={mode} speed={mode === 'live' ? 70 : 60}>
          {mode === 'live' ? <LiveContent live={live} /> : <MotmContent motm={motm} />}
        </Marquee>
      </div>
    </div>
  );
}

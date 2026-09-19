'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Visual, ViewSwitch, usePitchViewPreference, PitchBoard, FlipPitch, FlipButton } from '@/components/PitchView';

export type PlanPlayer = {
  id: number; code: number; name: string; team: string; teamId: number; teamCode: number; position: 'GKP' | 'DEF' | 'MID' | 'FWD';
  price: number; priceChange: number; form: number; totalPoints: number; ownership: number;
  status: string; news: string; chance: number | null;
};
export type PlanFixture = { gw: number; opponent: string; home: boolean; difficulty: number };
export type PlanSlot = { element: number; position: number; isCaptain: boolean; isVice: boolean };
export type PlanStakes = {
  eliminator: { alive: boolean; eliminatedGw: number | null; myPoints: number | null; lowestAlive: { name: string; points: number } | null; aliveCount: number; week: number } | null;
  motm: { month: string; position: number; points: number; leader: { name: string; points: number } | null; complete: boolean } | null;
  obCup: string | null;
};
export type PlannerProps = {
  managerId: number;
  teamName: string;
  planGw: number;
  deadline: string | null;
  baseSquad: PlanSlot[];
  bank: number;
  players: PlanPlayer[];
  fixtures: Record<number, PlanFixture[]>;
  ownership: Record<number, { owners: number; starters: number; captains: number }>;
  leagueSize: number;
  opponent: { id: number; name: string; squad: PlanSlot[] } | null;
  stakes: PlanStakes;
};

const DIFF_CLASS: Record<number, string> = { 1: 'bg-green-600 text-white', 2: 'bg-green-500/70 text-white', 3: 'bg-surface-3 text-ink', 4: 'bg-red-500/70 text-white', 5: 'bg-red-700 text-white' };
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;

function FixtureChips({ fixtures, size = 'sm' }: { fixtures: PlanFixture[] | undefined; size?: 'sm' | 'md' }) {
  if (!fixtures || fixtures.length === 0) return <span className="text-[10px] text-faint">No fixtures</span>;
  return (
    <span className="flex gap-1">
      {fixtures.slice(0, 3).map((f, i) => (
        <span key={i} className={`${size === 'md' ? 'text-xs px-2 py-0.5' : 'text-[9px] px-1'} font-bold rounded ${DIFF_CLASS[f.difficulty] || DIFF_CLASS[3]}`} title={`GW${f.gw} ${f.home ? 'vs' : 'at'} ${f.opponent} · difficulty ${f.difficulty}`}>
          {f.opponent}{f.home ? '' : ' (A)'}
        </span>
      ))}
    </span>
  );
}

function statusText(p: PlanPlayer) {
  if (p.status === 'a') return null;
  if (p.status === 'i') return 'Injured';
  if (p.status === 's') return 'Suspended';
  if (p.status === 'u') return 'Unavailable';
  return p.chance !== null ? `${p.chance}% chance of playing` : 'Doubt';
}

export default function Planner(props: PlannerProps) {
  const { managerId, planGw, players, fixtures, ownership, leagueSize, opponent, stakes } = props;
  const byId = useMemo(() => Object.fromEntries(players.map(p => [p.id, p])) as Record<number, PlanPlayer>, [players]);
  const storageKey = `itf-plan-${managerId}-${planGw}`;
  const [view, setView] = usePitchViewPreference();

  const baseIds = props.baseSquad.map(s => s.element);
  const baseCaptain = props.baseSquad.find(s => s.isCaptain)?.element ?? null;
  const baseVice = props.baseSquad.find(s => s.isVice)?.element ?? null;
  const [squad, setSquad] = useState<PlanSlot[]>(props.baseSquad);
  const [freeTransfers, setFreeTransfers] = useState(1);
  const [selected, setSelected] = useState<number | null>(null); // slot index shown in the sheet
  const [swapping, setSwapping] = useState<number | null>(null); // slot index being replaced
  const [tab, setTab] = useState<'matchup' | 'stakes' | 'apply'>('matchup');
  const [flipped, setFlipped] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.squad) && saved.squad.length === props.baseSquad.length) setSquad(saved.squad);
        if (typeof saved.freeTransfers === 'number') setFreeTransfers(saved.freeTransfers);
      }
    } catch {}
    setLoaded(true);
  }, [storageKey, props.baseSquad.length]);

  useEffect(() => {
    if (!loaded) return;
    try { window.localStorage.setItem(storageKey, JSON.stringify({ squad, freeTransfers })); } catch {}
  }, [squad, freeTransfers, loaded, storageKey]);

  // ---- derived plan facts ----
  const squadIds = squad.map(s => s.element);
  const transfersOut = baseIds.filter(id => !squadIds.includes(id));
  const transfersIn = squadIds.filter(id => !baseIds.includes(id));
  const spent = transfersIn.reduce((s, id) => s + (byId[id]?.price || 0), 0);
  const raised = transfersOut.reduce((s, id) => s + (byId[id]?.price || 0), 0);
  const bank = +(props.bank + raised - spent).toFixed(1);
  const hit = Math.max(0, transfersIn.length - freeTransfers) * 4;
  const clubCounts: Record<number, number> = {};
  squadIds.forEach(id => { const t = byId[id]?.teamId; if (t) clubCounts[t] = (clubCounts[t] || 0) + 1; });
  const overClub = Object.entries(clubCounts).filter(([, n]) => n > 3).map(([t]) => players.find(p => p.teamId === Number(t))?.team);
  const captain = squad.find(s => s.isCaptain)?.element ?? null;
  const vice = squad.find(s => s.isVice)?.element ?? null;
  const starters = squad.filter(s => s.position <= 11);
  const changed = transfersIn.length > 0 || captain !== baseCaptain || vice !== baseVice;

  const oppStarters = new Set((opponent?.squad || []).filter(s => s.position <= 11).map(s => s.element));
  const oppAll = new Set((opponent?.squad || []).map(s => s.element));
  const oppCaptain = opponent?.squad.find(s => s.isCaptain)?.element ?? null;
  const myStarterIds = new Set(starters.map(s => s.element));
  const shared = starters.filter(s => oppStarters.has(s.element)).map(s => s.element);
  const mine = starters.filter(s => !oppStarters.has(s.element)).map(s => s.element);
  const theirs = (opponent?.squad || []).filter(s => s.position <= 11 && !myStarterIds.has(s.element)).map(s => s.element);

  const ownPct = (id: number) => leagueSize ? Math.round(((ownership[id]?.owners || 0) / leagueSize) * 100) : 0;
  const capCount = (id: number) => ownership[id]?.captains || 0;

  // ---- actions ----
  const replace = (slotIndex: number, newId: number) => {
    setSquad(prev => prev.map((s, i) => (i === slotIndex ? { ...s, element: newId, isCaptain: false, isVice: false } : s)));
    setSwapping(null); setSelected(null);
  };
  const setArmband = (element: number, which: 'C' | 'V') => {
    setSquad(prev => prev.map(s => ({
      ...s,
      isCaptain: which === 'C' ? s.element === element : (s.isCaptain && s.element !== element),
      isVice: which === 'V' ? s.element === element : (s.isVice && s.element !== element),
    })));
  };
  const reset = () => { setSquad(props.baseSquad); setFreeTransfers(1); setSelected(null); };

  const tile = (s: PlanSlot, index: number) => {
    const p = byId[s.element];
    if (!p) return null;
    const onBench = s.position > 11;
    const isNew = !baseIds.includes(p.id);
    const differential = !!opponent && !onBench && !oppStarters.has(p.id);
    const flag = statusText(p);
    return (
      <button key={index} type="button" onClick={() => setSelected(index)} className="relative w-full flex flex-col items-center group focus:outline-none" aria-label={`${p.name}, ${p.team}, £${p.price.toFixed(1)}m`}>
        {s.isCaptain && <span className="absolute top-0 right-0 sm:right-2 z-10 text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center ring-2 ring-black/30 bg-brand text-white">C</span>}
        {s.isVice && <span className="absolute top-0 right-0 sm:right-2 z-10 text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center ring-2 ring-black/30 bg-white text-slate-900">V</span>}
        {isNew && <span className="absolute top-0 left-0 sm:left-2 z-10 text-[9px] font-black rounded-full px-1.5 h-5 flex items-center text-white ring-2 ring-black/30 bg-green-500">IN</span>}
        {flag && !isNew && <span className={`absolute top-0 left-0 sm:left-2 z-10 w-2.5 h-2.5 rounded-full ring-2 ring-black/30 ${p.status === 'd' ? 'bg-amber-400' : 'bg-red-500'}`} title={flag} />}
        <Visual player={{ element: p.id, team: p.team, teamCode: p.teamCode, code: p.code, position: p.position }} view={view} />
        <div className={`mt-1 w-full max-w-[7.5rem] rounded-md overflow-hidden shadow-md text-center transition group-hover:ring-2 group-hover:ring-white/60 ${differential ? 'ring-1 ring-brand-2/70' : ''}`}>
          <div className={`px-1.5 py-1 text-[11px] sm:text-xs font-bold truncate ${onBench ? 'bg-surface-3 text-ink' : 'bg-[#0b1f14] text-white'}`}>{p.name}</div>
          <div className="px-1.5 py-0.5 text-[11px] font-bold bg-white text-slate-900">£{p.price.toFixed(1)}m</div>
        </div>
      </button>
    );
  };

  const oppTile = (slot: PlanSlot, onBench: boolean) => {
    const p = byId[slot.element];
    if (!p) return null;
    const both = squadIds.includes(p.id);
    return (
      <div className="relative w-full flex flex-col items-center" aria-label={`${p.name}, ${p.team}`}>
        {slot.isCaptain && <span className="absolute top-0 right-0 sm:right-2 z-10 text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center ring-2 ring-black/30 bg-amber-400 text-slate-900">C</span>}
        <Visual player={{ element: p.id, team: p.team, teamCode: p.teamCode, code: p.code, position: p.position }} view={view} />
        <div className={`mt-1 w-full max-w-[7.5rem] rounded-md overflow-hidden shadow-md text-center ${!both && !onBench ? 'ring-1 ring-amber-400/70' : ''}`}>
          <div className={`px-1.5 py-1 text-[11px] sm:text-xs font-bold truncate ${onBench ? 'bg-surface-3 text-ink' : 'bg-[#0b1f14] text-white'}`}>{p.name}</div>
          <div className={`px-1.5 py-0.5 text-[10px] font-bold ${both ? 'bg-surface-3 text-dim' : 'bg-white text-slate-900'}`}>{both ? 'both own' : `£${p.price.toFixed(1)}m`}</div>
        </div>
      </div>
    );
  };

  const selectedSlot = selected !== null ? squad[selected] : null;
  const selectedPlayer = selectedSlot ? byId[selectedSlot.element] : null;
  const swapSlot = swapping !== null ? squad[swapping] : null;
  const swapPlayer = swapSlot ? byId[swapSlot.element] : null;

  return (
    <div className="space-y-5">
      {/* Plan bar */}
      <div className="bg-surface border border-line rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <div><span className="text-[10px] font-bold uppercase tracking-widest text-faint mr-2">Bank</span><span className={`font-black ${bank < 0 ? 'text-red-400' : 'text-ink'}`}>£{bank.toFixed(1)}m</span></div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-faint">Free transfers</span>
          <button type="button" onClick={() => setFreeTransfers(f => Math.max(0, f - 1))} className="w-6 h-6 rounded bg-surface-3 text-ink font-bold leading-none">−</button>
          <span className="w-4 text-center font-black text-ink">{freeTransfers}</span>
          <button type="button" onClick={() => setFreeTransfers(f => Math.min(5, f + 1))} className="w-6 h-6 rounded bg-surface-3 text-ink font-bold leading-none">+</button>
        </div>
        <div><span className="text-[10px] font-bold uppercase tracking-widest text-faint mr-2">Transfers</span><span className="font-black text-ink">{transfersIn.length}</span>{hit > 0 && <span className="ml-1 font-bold text-red-400">−{hit} pts</span>}</div>
        <div className="ml-auto flex items-center gap-2">
          {changed && <button type="button" onClick={reset} className="text-xs px-3 py-1.5 rounded-lg border border-line text-dim hover:text-ink">Reset</button>}
          <ViewSwitch view={view} onChange={setView} />
        </div>
        {(bank < 0 || overClub.length > 0) && (
          <div className="w-full text-xs text-red-400 font-semibold">
            {bank < 0 && <span>Over budget by £{Math.abs(bank).toFixed(1)}m. </span>}
            {overClub.length > 0 && <span>More than three players from {overClub.join(', ')}.</span>}
          </div>
        )}
      </div>

      {/* Pitch */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-bold text-ink">{flipped && opponent ? <>{opponent.name} <span className="text-faint font-normal">(your GW{planGw} opponent)</span></> : 'Your squad'}</div>
        {opponent && <FlipButton flipped={flipped} onToggle={() => setFlipped(f => !f)} label={`${opponent.name} (GW${planGw} opponent)`} />}
      </div>
      {(() => {
        const indexed = squad.map((s, i) => ({ s, i }));
        const front = (
          <PitchBoard
            starters={indexed.filter(x => x.s.position <= 11)}
            bench={indexed.filter(x => x.s.position > 11).sort((a, b) => a.s.position - b.s.position)}
            positionOf={x => byId[x.s.element]?.position || 'MID'}
            benchLabel="Bench"
            renderPlayer={x => tile(x.s, x.i)}
          />
        );
        const back = opponent ? (
          <PitchBoard
            starters={opponent.squad.filter(x => x.position <= 11)}
            bench={opponent.squad.filter(x => x.position > 11).sort((a, b) => a.position - b.position)}
            positionOf={x => byId[x.element]?.position || 'MID'}
            benchLabel={`${opponent.name} bench`}
            renderPlayer={(x, onBench) => oppTile(x, onBench)}
          />
        ) : null;
        return back ? <FlipPitch front={front} back={back} flipped={flipped} /> : front;
      })()}
      <p className="text-[11px] text-faint -mt-2">Tap a player for fixtures, league ownership and to swap or captain them. Blue outline = only you have them; on the flipped side, amber = only your opponent does. Budget uses current prices; FPL only shows selling prices when logged in.</p>

      {/* Tabs */}
      <div>
        <div className="flex gap-1 border-b border-line mb-4">
          {([['matchup', opponent ? `GW${planGw} match-up v ${opponent.name}` : 'Match-up'], ['stakes', 'What it means'], ['apply', changed ? `Apply (${transfersIn.length + (captain !== baseCaptain ? 1 : 0)})` : 'Apply on FPL']] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setTab(key)} className={`px-3 sm:px-4 py-2 text-sm font-bold border-b-2 -mb-px truncate max-w-[45%] ${tab === key ? 'border-brand text-ink' : 'border-transparent text-dim hover:text-ink'}`}>{label}</button>
          ))}
        </div>

        {tab === 'matchup' && (
          <div className="bg-surface border border-line rounded-xl p-3 sm:p-5">
            {!opponent ? (
              <div className="text-sm text-dim">No H2H fixture found for GW{planGw} yet.</div>
            ) : (
              <>
                <MatchupLanes mine={mine} shared={shared} theirs={theirs} byId={byId} view={view} captain={captain} oppCaptain={oppCaptain} opponentName={opponent.name} />
                <div className="mt-4 pt-3 border-t border-line text-sm text-dim flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>Captains: you <span className="text-ink-2 font-semibold">{captain ? byId[captain]?.name : '—'}</span>, them <span className="text-ink-2 font-semibold">{oppCaptain ? byId[oppCaptain]?.name : '—'}</span>{captain && captain === oppCaptain && <span className="text-amber-300"> · same captain, it cancels out</span>}</span>
                  <Link href={`/manager/${opponent.id}`} className="text-brand-2 hover:underline text-xs sm:ml-auto">See {opponent.name}&apos;s team &rarr;</Link>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'stakes' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {stakes.eliminator && (
              <div className={`rounded-xl p-4 border ${stakes.eliminator.alive ? 'bg-surface border-line' : 'bg-surface-2 border-line opacity-70'}`}>
                <div className="text-[10px] font-bold uppercase tracking-widest text-faint mb-1">Eliminator</div>
                {stakes.eliminator.alive ? (
                  <>
                    <div className="text-2xl font-black text-ink">{stakes.eliminator.myPoints !== null && stakes.eliminator.lowestAlive ? `+${stakes.eliminator.myPoints - stakes.eliminator.lowestAlive.points}` : '–'}</div>
                    <div className="text-xs text-dim">clear of the lowest survivor last week{stakes.eliminator.lowestAlive ? ` (${stakes.eliminator.lowestAlive.name}, ${stakes.eliminator.lowestAlive.points})` : ''}. {stakes.eliminator.aliveCount} alive; the lowest net score in GW{planGw} goes.</div>
                  </>
                ) : (
                  <div className="text-sm text-dim">Out since GW{stakes.eliminator.eliminatedGw}.</div>
                )}
              </div>
            )}
            {stakes.motm && (
              <div className="rounded-xl p-4 border bg-surface border-line">
                <div className="text-[10px] font-bold uppercase tracking-widest text-faint mb-1">Manager of the Month · {stakes.motm.month}</div>
                <div className="text-2xl font-black text-ink">{ordinal(stakes.motm.position)}</div>
                <div className="text-xs text-dim">on {stakes.motm.points}{stakes.motm.leader && stakes.motm.position !== 1 ? `, ${stakes.motm.leader.points - stakes.motm.points} behind ${stakes.motm.leader.name}` : stakes.motm.position === 1 ? ', leading' : ''}.{stakes.motm.complete ? ' Awarded.' : ''}</div>
              </div>
            )}
            {stakes.obCup && (
              <div className="rounded-xl p-4 border bg-surface border-line">
                <div className="text-[10px] font-bold uppercase tracking-widest text-faint mb-1">OB Cup</div>
                <div className="text-sm text-dim">{stakes.obCup}</div>
              </div>
            )}
          </div>
        )}

        {tab === 'apply' && (
          <div className="bg-surface border border-line rounded-xl p-4 sm:p-5">
            {!changed ? (
              <div className="text-sm text-dim">No changes planned yet. Tap a player on the pitch to start.</div>
            ) : (
              <ol className="space-y-2 text-sm">
                {transfersOut.map((out, i) => (
                  <li key={out} className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-surface-3 text-[10px] font-black flex items-center justify-center text-ink">{i + 1}</span><span className="text-red-400 font-semibold">{byId[out]?.name}</span><span className="text-faint">→</span><span className="text-green-400 font-semibold">{byId[transfersIn[i]]?.name}</span><span className="text-faint text-xs">£{byId[transfersIn[i]]?.price.toFixed(1)}m</span></li>
                ))}
                {captain !== baseCaptain && captain && <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-brand text-[10px] font-black flex items-center justify-center text-white">C</span>Captain {byId[captain]?.name}</li>}
                {vice !== baseVice && vice && <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-white text-[10px] font-black flex items-center justify-center text-slate-900">V</span>Vice-captain {byId[vice]?.name}</li>}
                {hit > 0 && <li className="text-amber-300 text-xs pl-7">Costs a {hit}-point hit.</li>}
              </ol>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <a href="https://fantasy.premierleague.com/transfers" target="_blank" rel="noopener noreferrer" className="text-xs bg-brand text-white px-3 py-2 rounded-lg font-bold">Make transfers on FPL &rarr;</a>
              <a href="https://fantasy.premierleague.com/my-team" target="_blank" rel="noopener noreferrer" className="text-xs bg-surface-3 text-ink px-3 py-2 rounded-lg font-bold">Pick team on FPL &rarr;</a>
              {props.deadline && <span className="text-[11px] text-faint sm:ml-auto">Deadline {props.deadline}</span>}
            </div>
          </div>
        )}
      </div>

      {/* Player sheet */}
      {selectedSlot && selectedPlayer && swapping === null && (
        <Sheet onClose={() => setSelected(null)}>
          <div className="flex items-start gap-4">
            <Visual player={{ element: selectedPlayer.id, team: selectedPlayer.team, teamCode: selectedPlayer.teamCode, code: selectedPlayer.code, position: selectedPlayer.position }} view={view === 'plain' ? 'shirt' : view} />
            <div className="min-w-0 flex-1">
              <div className="text-lg font-black text-ink leading-tight">{selectedPlayer.name}</div>
              <div className="text-xs text-dim">{selectedPlayer.team} · {selectedPlayer.position} · £{selectedPlayer.price.toFixed(1)}m{selectedPlayer.priceChange ? <span className={selectedPlayer.priceChange > 0 ? ' text-green-400' : ' text-red-400'}> {selectedPlayer.priceChange > 0 ? '▲' : '▼'} {Math.abs(selectedPlayer.priceChange).toFixed(1)}</span> : ''}</div>
              {statusText(selectedPlayer) && <div className={`mt-1 text-xs font-semibold ${selectedPlayer.status === 'd' ? 'text-amber-300' : 'text-red-400'}`}>{statusText(selectedPlayer)}{selectedPlayer.news ? ` · ${selectedPlayer.news}` : ''}</div>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
            <div className="bg-surface-2 rounded-lg p-2"><div className="text-lg font-black text-ink">{selectedPlayer.form}</div><div className="text-[10px] text-dim">form</div></div>
            <div className="bg-surface-2 rounded-lg p-2"><div className="text-lg font-black text-ink">{selectedPlayer.totalPoints}</div><div className="text-[10px] text-dim">points</div></div>
            <div className="bg-surface-2 rounded-lg p-2"><div className="text-lg font-black text-brand-2">{ownPct(selectedPlayer.id)}%</div><div className="text-[10px] text-dim">of the ITF{capCount(selectedPlayer.id) ? ` · ${capCount(selectedPlayer.id)} captain` : ''}</div></div>
          </div>
          <div className="mt-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-faint mb-1">Next fixtures</div>
            <FixtureChips fixtures={fixtures[selectedPlayer.teamId]} size="md" />
          </div>
          {opponent && (
            <div className="mt-3 text-xs text-dim">
              {oppStarters.has(selectedPlayer.id) ? `${opponent.name} also starts ${selectedPlayer.name}, so this one cancels out.` : oppAll.has(selectedPlayer.id) ? `${opponent.name} has ${selectedPlayer.name} on the bench.` : `${opponent.name} does not own ${selectedPlayer.name}: a differential for you.`}
              {oppCaptain === selectedPlayer.id && <span className="text-amber-300"> Their captain.</span>}
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-5">
            {selectedSlot.position <= 11 && (
              <>
                <button type="button" onClick={() => setArmband(selectedPlayer.id, 'C')} className={`px-3 py-2 rounded-lg text-sm font-bold ${selectedSlot.isCaptain ? 'bg-brand text-white' : 'bg-surface-3 text-ink'}`}>{selectedSlot.isCaptain ? 'Captain ✓' : 'Make captain'}</button>
                <button type="button" onClick={() => setArmband(selectedPlayer.id, 'V')} className={`px-3 py-2 rounded-lg text-sm font-bold ${selectedSlot.isVice ? 'bg-white text-slate-900' : 'bg-surface-3 text-ink'}`}>{selectedSlot.isVice ? 'Vice ✓' : 'Make vice'}</button>
              </>
            )}
            <button type="button" onClick={() => setSwapping(selected)} className="px-3 py-2 rounded-lg text-sm font-bold bg-brand-2/15 text-brand-2 ml-auto">Swap out &rarr;</button>
          </div>
        </Sheet>
      )}

      {swapSlot && swapPlayer && (
        <ReplaceDrawer
          outgoing={swapPlayer}
          budget={+(bank + swapPlayer.price).toFixed(1)}
          players={players}
          squadIds={squadIds}
          clubCounts={clubCounts}
          fixtures={fixtures}
          ownPct={ownPct}
          oppIds={oppAll}
          view={view}
          onPick={id => replace(swapping as number, id)}
          onClose={() => setSwapping(null)}
        />
      )}
    </div>
  );
}

const LANE_ORDER: Record<PlanPlayer['position'], number> = { GKP: 0, DEF: 1, MID: 2, FWD: 3 };

// Small round headshot (or shirt / initials) for compact lists.
function Avatar({ player, view }: { player: PlanPlayer; view: 'photo' | 'shirt' | 'plain' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [view, player.id]);
  const src = view === 'photo' ? `https://resources.premierleague.com/premierleague/photos/players/110x140/p${player.code}.png` : view === 'shirt' ? `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${player.teamCode}${player.position === 'GKP' ? '_1' : ''}-66.png` : null;
  if (!src || failed) {
    return <span className="w-8 h-8 shrink-0 rounded-full bg-surface-3 border border-line flex items-center justify-center text-[9px] font-black text-ink-2">{player.team}</span>;
  }
  return (
    <span className={`w-8 h-8 shrink-0 rounded-full overflow-hidden flex items-end justify-center ${view === 'photo' ? 'bg-surface-3' : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className={view === 'photo' ? 'w-full h-full object-cover object-top' : 'h-7 w-auto'} />
    </span>
  );
}

// Three lanes: only yours, shared, only theirs. Shared players cancel out in the tie,
// so the outer lanes are where the match-up is decided.
function MatchupLanes({ mine, shared, theirs, byId, view, captain, oppCaptain, opponentName }: {
  mine: number[]; shared: number[]; theirs: number[]; byId: Record<number, PlanPlayer>; view: 'photo' | 'shirt' | 'plain'; captain: number | null; oppCaptain: number | null; opponentName: string;
}) {
  const sorted = (ids: number[]) => [...ids].sort((a, b) => LANE_ORDER[byId[a]?.position || 'MID'] - LANE_ORDER[byId[b]?.position || 'MID']);
  const lanes = [
    { key: 'mine', label: 'Only you', ids: sorted(mine), cls: 'bg-brand-2/10 border-brand-2/30', head: 'text-brand-2' },
    { key: 'shared', label: 'Both', ids: sorted(shared), cls: 'bg-surface-2 border-line', head: 'text-dim' },
    { key: 'theirs', label: `Only ${opponentName}`, ids: sorted(theirs), cls: 'bg-amber-500/10 border-amber-500/30', head: 'text-amber-300' },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {lanes.map(lane => (
        <div key={lane.key} className={`rounded-xl border p-2 sm:p-3 min-w-0 ${lane.cls}`}>
          <div className={`text-center mb-3 ${lane.head}`}>
            <div className="text-2xl font-black leading-none">{lane.ids.length}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest truncate" title={lane.label}>{lane.label}</div>
          </div>
          <ul className="space-y-1.5">
            {lane.ids.map(id => {
              const p = byId[id]; if (!p) return null;
              const capCls = id === captain && id === oppCaptain ? 'bg-white text-slate-900' : id === captain ? 'bg-brand text-white' : id === oppCaptain ? 'bg-amber-400 text-slate-900' : null;
              return (
                <li key={id} className="flex items-center gap-2 min-w-0">
                  <Avatar player={p} view={view} />
                  <span className="min-w-0 flex-1 text-xs sm:text-sm font-semibold text-ink truncate">{p.name}</span>
                  {capCls && <span className={`shrink-0 text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center ${capCls}`} title="Captain">C</span>}
                </li>
              );
            })}
            {lane.ids.length === 0 && <li className="text-center text-[11px] text-faint py-2">Nobody</li>}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full sm:max-w-md max-h-[88dvh] overflow-y-auto bg-surface border border-line rounded-t-2xl sm:rounded-2xl shadow-2xl p-5">
        <button type="button" onClick={onClose} className="absolute top-3 right-4 text-dim hover:text-ink text-xl leading-none" aria-label="Close">×</button>
        {children}
      </div>
    </div>
  );
}

function ReplaceDrawer({ outgoing, budget, players, squadIds, clubCounts, fixtures, ownPct, oppIds, view, onPick, onClose }: {
  outgoing: PlanPlayer; budget: number; players: PlanPlayer[]; squadIds: number[]; clubCounts: Record<number, number>;
  fixtures: Record<number, PlanFixture[]>; ownPct: (id: number) => number; oppIds: Set<number>; view: 'photo' | 'shirt' | 'plain';
  onPick: (id: number) => void; onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'form' | 'points' | 'itf' | 'fixtures' | 'price'>('form');
  const [affordableOnly, setAffordableOnly] = useState(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const runScore = (teamId: number) => (fixtures[teamId] || []).slice(0, 3).reduce((s, f) => s + f.difficulty, 0) || 99;
  const list = players
    .filter(p => p.position === outgoing.position && !squadIds.includes(p.id))
    .filter(p => !affordableOnly || p.price <= budget)
    .filter(p => !query || p.name.toLowerCase().includes(query.toLowerCase()) || p.team.toLowerCase() === query.toLowerCase())
    .sort((a, b) => sort === 'form' ? b.form - a.form : sort === 'points' ? b.totalPoints - a.totalPoints : sort === 'itf' ? ownPct(a.id) - ownPct(b.id) || b.form - a.form : sort === 'price' ? b.price - a.price : runScore(a.teamId) - runScore(b.teamId))
    .slice(0, 50);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full sm:max-w-2xl max-h-[88dvh] bg-surface border border-line rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col">
        <div className="p-4 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-widest text-faint">Replace</div>
              <div className="font-bold text-ink truncate">{outgoing.name} <span className="text-dim font-normal">· {outgoing.position} · up to £{budget.toFixed(1)}m</span></div>
            </div>
            <button type="button" onClick={onClose} className="text-dim hover:text-ink text-xl leading-none px-1" aria-label="Close">×</button>
          </div>
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or club" className="mt-3 w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm text-ink" />
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            {([['form', 'Form'], ['fixtures', 'Fixtures'], ['points', 'Points'], ['itf', 'ITF differential'], ['price', 'Price']] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setSort(k)} className={`px-2.5 py-1 rounded-full ${sort === k ? 'bg-brand text-white' : 'bg-surface-2 text-dim'}`}>{label}</button>
            ))}
            <label className="ml-auto flex items-center gap-1 text-dim"><input type="checkbox" checked={affordableOnly} onChange={e => setAffordableOnly(e.target.checked)} /> Affordable</label>
          </div>
        </div>
        <div className="overflow-y-auto divide-y divide-line">
          {list.length === 0 && <div className="p-6 text-center text-sm text-faint">No players match.</div>}
          {list.map(p => {
            const clubFull = (clubCounts[p.teamId] || 0) >= 3 && p.teamId !== outgoing.teamId;
            const flag = statusText(p);
            return (
              <button key={p.id} type="button" disabled={clubFull} onClick={() => onPick(p.id)} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed">
                <div className="w-12 shrink-0"><Visual player={{ element: p.id, team: p.team, teamCode: p.teamCode, code: p.code, position: p.position }} view={view === 'plain' ? 'shirt' : view} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-ink">{p.name}</span>
                    <span className="text-xs text-faint">{p.team}</span>
                    {flag && <span className={`text-[10px] font-bold ${p.status === 'd' ? 'text-amber-300' : 'text-red-400'}`}>{flag}</span>}
                    {oppIds.has(p.id) && <span className="text-[10px] font-bold text-amber-300">Opponent owns</span>}
                    {clubFull && <span className="text-[10px] font-bold text-faint">3 from club</span>}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-dim">
                    <FixtureChips fixtures={fixtures[p.teamId]} />
                    <span>Form {p.form}</span>
                    <span className="text-brand-2">ITF {ownPct(p.id)}%</span>
                  </div>
                </div>
                <div className={`shrink-0 font-black ${p.price > budget ? 'text-red-400' : 'text-ink'}`}>£{p.price.toFixed(1)}m</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

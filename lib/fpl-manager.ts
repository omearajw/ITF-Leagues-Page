import { cache } from 'react';

// Public FPL endpoints for a manager's team. A confirmed gameweek never changes, so
// those responses are memoised for a day; the in-progress week refreshes every minute.
const FPL_API = 'https://fantasy.premierleague.com/api';
const LIVE_TTL = 60_000;
const FINAL_TTL = 24 * 60 * 60_000;
const memos = new Map<string, { at: number; value: unknown }>();

async function memoized<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T | null> {
  const hit = memos.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value as T;
  try {
    const value = await load();
    memos.set(key, { at: Date.now(), value });
    return value;
  } catch (err) {
    console.error(`FPL ${key} failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function fplJson<T>(path: string): Promise<T> {
  const res = await fetch(`${FPL_API}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`${path} responded ${res.status}`);
  return res.json();
}

export type Player = { id: number; code: number; name: string; team: string; teamName: string; teamCode: number; position: 'GKP' | 'DEF' | 'MID' | 'FWD'; price: number };

export const getPlayers = cache(async (): Promise<Record<number, Player> | null> =>
  memoized('players', 10 * 60_000, async () => {
    const boot = await fplJson<any>('/bootstrap-static/');
    const teams: Record<number, { short: string; name: string; code: number }> = {};
    boot.teams.forEach((t: any) => { teams[t.id] = { short: t.short_name, name: t.name, code: t.code }; });
    const positions: Record<number, Player['position']> = {};
    boot.element_types.forEach((p: any) => { positions[p.id] = p.singular_name_short; });
    const players: Record<number, Player> = {};
    boot.elements.forEach((e: any) => {
      players[e.id] = { id: e.id, code: e.code, name: e.web_name, team: teams[e.team]?.short || '', teamName: teams[e.team]?.name || '', teamCode: teams[e.team]?.code || 0, position: positions[e.element_type], price: e.now_cost / 10 };
    });
    return players;
  })
);

export type Pick = { element: number; position: number; multiplier: number; is_captain: boolean; is_vice_captain: boolean };
export type ManagerPicks = {
  active_chip: string | null;
  automatic_subs: { element_in: number; element_out: number }[];
  entry_history: { points: number; total_points: number; rank: number | null; event_transfers: number; event_transfers_cost: number; points_on_bench: number; bank: number; value: number };
  picks: Pick[];
};

export function getManagerPicks(managerId: number, gw: number, isFinal: boolean) {
  return memoized<ManagerPicks>(`picks:${managerId}:${gw}`, isFinal ? FINAL_TTL : LIVE_TTL, () => fplJson(`/entry/${managerId}/event/${gw}/picks/`));
}

export type LiveStats = Record<number, { total_points: number; minutes: number; bonus: number }>;

export function getLivePoints(gw: number, isFinal: boolean) {
  return memoized<LiveStats>(`live:${gw}`, isFinal ? FINAL_TTL : LIVE_TTL, async () => {
    const data = await fplJson<any>(`/event/${gw}/live/`);
    const out: LiveStats = {};
    data.elements.forEach((e: any) => { out[e.id] = { total_points: e.stats.total_points, minutes: e.stats.minutes, bonus: e.stats.bonus }; });
    return out;
  });
}

export type Transfer = { event: number; element_in: number; element_out: number; element_in_cost: number; element_out_cost: number; time: string };

export function getManagerTransfers(managerId: number) {
  return memoized<Transfer[]>(`transfers:${managerId}`, 5 * 60_000, () => fplJson(`/entry/${managerId}/transfers/`));
}

export type ManagerEntry = { name: string; player_first_name: string; player_last_name: string; summary_overall_rank: number | null; summary_overall_points: number; started_event: number };

export function getManagerEntry(managerId: number) {
  return memoized<ManagerEntry>(`entry:${managerId}`, 5 * 60_000, () => fplJson(`/entry/${managerId}/`));
}

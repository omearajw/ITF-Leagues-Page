import { cache } from 'react';
import { fplGet } from '@/lib/fpl-fetch';
import { mirrored } from '@/lib/fpl-mirror';
import type { FplExplain } from '@/lib/score-breakdown';

// Public FPL data for players and managers' teams. Each getter reads our copy in the FPL mirror
// (lib/fpl-mirror.ts, kept current by /api/fpl-sync) and only asks FPL itself when the copy is out
// of date. The loaders do the asking; the sync job calls the same loaders, so it stores exactly
// what the pages read. A confirmed week is kept under its own ":final" key, as it never changes.
const fplJson = fplGet;
const finalKey = (key: string, isFinal: boolean) => (isFinal ? `${key}:final` : key);

export const fplKeys = {
  players: () => 'players',
  picks: (managerId: number, gw: number, isFinal: boolean) => finalKey(`picks:${managerId}:${gw}`, isFinal),
  // v2 copies carry each player's score breakdown; older copies without it are ignored.
  live: (gw: number, isFinal: boolean) => finalKey(`live:${gw}:v2`, isFinal),
  transfers: (managerId: number) => `transfers:${managerId}`,
  entry: (managerId: number) => `entry:${managerId}`,
  fixtureRuns: (fromGw: number, count: number) => `fixtures:${fromGw}:${count}`,
  gwFixtures: (gw: number, isFinal: boolean) => finalKey(`gwfix:${gw}`, isFinal),
};

export type Player = {
  id: number; code: number; name: string;
  team: string; teamName: string; teamId: number; teamCode: number;
  position: 'GKP' | 'DEF' | 'MID' | 'FWD';
  price: number; priceChange: number;
  form: number; totalPoints: number; ownership: number;
  status: string; news: string; chance: number | null;
};

async function loadPlayers(): Promise<Record<number, Player>> {
  const boot = await fplJson<any>('/bootstrap-static/');
  const teams: Record<number, { short: string; name: string; code: number }> = {};
  boot.teams.forEach((t: any) => { teams[t.id] = { short: t.short_name, name: t.name, code: t.code }; });
  const positions: Record<number, Player['position']> = {};
  boot.element_types.forEach((p: any) => { positions[p.id] = p.singular_name_short; });
  const players: Record<number, Player> = {};
  boot.elements.forEach((e: any) => {
    players[e.id] = {
      id: e.id, code: e.code, name: e.web_name,
      team: teams[e.team]?.short || '', teamName: teams[e.team]?.name || '', teamId: e.team, teamCode: teams[e.team]?.code || 0,
      position: positions[e.element_type],
      price: e.now_cost / 10, priceChange: (e.cost_change_event || 0) / 10,
      form: parseFloat(e.form) || 0, totalPoints: e.total_points || 0, ownership: parseFloat(e.selected_by_percent) || 0,
      status: e.status, news: e.news || '', chance: e.chance_of_playing_next_round,
    };
  });
  return players;
}

export const getPlayers = cache((): Promise<Record<number, Player> | null> => mirrored(fplKeys.players(), loadPlayers));

export type Pick = { element: number; position: number; multiplier: number; is_captain: boolean; is_vice_captain: boolean };
export type ManagerPicks = {
  active_chip: string | null;
  automatic_subs: { element_in: number; element_out: number }[];
  entry_history: { points: number; total_points: number; rank: number | null; event_transfers: number; event_transfers_cost: number; points_on_bench: number; bank: number; value: number };
  picks: Pick[];
};

const loadPicks = (managerId: number, gw: number) => fplJson<ManagerPicks>(`/entry/${managerId}/event/${gw}/picks/`);

export function getManagerPicks(managerId: number, gw: number, isFinal: boolean) {
  return mirrored<ManagerPicks>(fplKeys.picks(managerId, gw, isFinal), () => loadPicks(managerId, gw));
}

export type LiveStats = Record<number, { total_points: number; minutes: number; bonus: number; explain?: FplExplain }>;

async function loadLive(gw: number): Promise<LiveStats> {
  const data = await fplJson<any>(`/event/${gw}/live/`);
  const out: LiveStats = {};
  data.elements.forEach((e: any) => {
    out[e.id] = {
      total_points: e.stats.total_points, minutes: e.stats.minutes, bonus: e.stats.bonus,
      explain: (e.explain || []).map((m: any) => ({ fixture: m.fixture, stats: (m.stats || []).map((s: any) => ({ identifier: s.identifier, value: s.value, points: s.points })) })),
    };
  });
  return out;
}

export function getLivePoints(gw: number, isFinal: boolean) {
  return mirrored<LiveStats>(fplKeys.live(gw, isFinal), () => loadLive(gw));
}

export type Transfer = { event: number; element_in: number; element_out: number; element_in_cost: number; element_out_cost: number; time: string };

const loadTransfers = (managerId: number) => fplJson<Transfer[]>(`/entry/${managerId}/transfers/`);

export function getManagerTransfers(managerId: number) {
  return mirrored<Transfer[]>(fplKeys.transfers(managerId), () => loadTransfers(managerId));
}

export type ManagerEntry = { name: string; player_first_name: string; player_last_name: string; summary_overall_rank: number | null; summary_overall_points: number; started_event: number; club_badge_src: string | null };

const loadEntry = (managerId: number) => fplJson<ManagerEntry>(`/entry/${managerId}/`);

export function getManagerEntry(managerId: number) {
  return mirrored<ManagerEntry>(fplKeys.entry(managerId), () => loadEntry(managerId));
}

export type TeamFixture = { gw: number; opponent: string; home: boolean; difficulty: number };

// Each club's next few fixtures with FPL's difficulty rating, keyed by team id.
async function loadFixtureRuns(fromGw: number, count: number): Promise<Record<number, TeamFixture[]>> {
  const boot = await fplJson<any>('/bootstrap-static/');
  const short: Record<number, string> = {};
  boot.teams.forEach((t: any) => { short[t.id] = t.short_name; });
  const runs: Record<number, TeamFixture[]> = {};
  boot.teams.forEach((t: any) => { runs[t.id] = []; });
  for (let gw = fromGw; gw < fromGw + count && gw <= 38; gw++) {
    const fixtures = await fplJson<any[]>(`/fixtures/?event=${gw}`);
    for (const f of fixtures) {
      runs[f.team_h]?.push({ gw, opponent: short[f.team_a], home: true, difficulty: f.team_h_difficulty });
      runs[f.team_a]?.push({ gw, opponent: short[f.team_h], home: false, difficulty: f.team_a_difficulty });
    }
  }
  return runs;
}

export function getFixtureRuns(fromGw: number, count: number) {
  return mirrored<Record<number, TeamFixture[]>>(fplKeys.fixtureRuns(fromGw, count), () => loadFixtureRuns(fromGw, count));
}

export type TeamGwFixture = { started: boolean; finished: boolean; kickoff: string | null };

// Each club's fixtures in one gameweek with their live state, keyed by team id.
async function loadGwFixtures(gw: number): Promise<Record<number, TeamGwFixture[]>> {
  const fixtures = await fplJson<any[]>(`/fixtures/?event=${gw}`);
  const out: Record<number, TeamGwFixture[]> = {};
  for (const f of fixtures) {
    const entry = { started: !!f.started, finished: !!(f.finished || f.finished_provisional), kickoff: f.kickoff_time };
    (out[f.team_h] ||= []).push(entry);
    (out[f.team_a] ||= []).push(entry);
  }
  return out;
}

export function getGwFixtureStatus(gw: number, isFinal: boolean) {
  return mirrored<Record<number, TeamGwFixture[]>>(fplKeys.gwFixtures(gw, isFinal), () => loadGwFixtures(gw));
}

// The sync job (/api/fpl-sync) runs these to keep the mirror current.
export const fplLoaders = { loadPlayers, loadPicks, loadLive, loadTransfers, loadEntry, loadFixtureRuns, loadGwFixtures };

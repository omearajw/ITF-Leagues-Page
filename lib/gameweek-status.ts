import { cache } from 'react';
import { createClient } from '@/utils/supabase/server';

export const SEASON_ID = '2026-27';

export type GameweekPhase = 'upcoming' | 'live' | 'final_whistle' | 'confirmed' | 'synced' | 'unknown';

export const PHASE_ORDER: GameweekPhase[] = ['upcoming', 'live', 'final_whistle', 'confirmed', 'synced'];

export const PHASE_LABEL: Record<GameweekPhase, string> = {
  upcoming: 'Upcoming',
  live: 'Live',
  final_whistle: 'Final whistle',
  confirmed: 'Confirmed',
  synced: 'Synced',
  unknown: 'Unknown',
};

// What users see: the internal phases collapse to four checkpoints. The gap between
// FPL confirming and our sync is an implementation detail, so it is folded into Final.
export type GameweekStage = 'upcoming' | 'live' | 'awaiting' | 'final';

export const STAGE_ORDER: GameweekStage[] = ['upcoming', 'live', 'awaiting', 'final'];

export const STAGE_LABEL: Record<GameweekStage, string> = {
  upcoming: 'Upcoming',
  live: 'Live',
  awaiting: 'Awaiting results',
  final: 'Final',
};

export function stageOf(phase: GameweekPhase): GameweekStage | null {
  switch (phase) {
    case 'upcoming': return 'upcoming';
    case 'live': return 'live';
    case 'final_whistle':
    case 'confirmed': return 'awaiting';
    case 'synced': return 'final';
    default: return null;
  }
}

export type GameweekStatus = {
  phase: GameweekPhase;
  fplAvailable: boolean;
  activeGw: number;
  activeGwName: string;
  syncedThroughGw: number;
  liveGw: number | null;
  displayGw: number;
  deadline: string | null;
  firstKickoff: string | null;
  lastKickoff: string | null;
  fixturesTotal: number;
  fixturesUnscheduled: number;
  fixturesStarted: number;
  fixturesFinished: number;
  fplFinished: boolean;
  fplDataChecked: boolean;
  nextGw: { id: number; name: string; deadline: string } | null;
  timeline: GameweekTimelineAnchors;
};

// Estimated boundaries of one gameweek cycle. FPL publishes deadlines and kickoffs;
// the final whistle, confirmation and sync times are estimates from typical timings.
export type GameweekTimelineAnchors = {
  upcomingStart: string | null;
  deadline: string | null;
  finalWhistle: string | null;
  confirmed: string | null;
  synced: string | null;
};

const HOUR = 3_600_000;
const MATCH_LENGTH_MS = 2 * HOUR;
const CONFIRMATION_LAG_MS = 18 * HOUR;
const SYNC_LAG_MS = 0.5 * HOUR;

function estimateCycle(deadline: string, lastKickoff: string | null) {
  const whistle = lastKickoff ? Date.parse(lastKickoff) + MATCH_LENGTH_MS : Date.parse(deadline) + 3 * 24 * HOUR;
  const confirmed = whistle + CONFIRMATION_LAG_MS;
  const synced = confirmed + SYNC_LAG_MS;
  return { whistle, confirmed, synced };
}

type FplEvent = {
  id: number;
  name: string;
  deadline_time: string;
  is_previous: boolean;
  is_current: boolean;
  is_next: boolean;
  finished: boolean;
  data_checked: boolean;
};

type FplFixture = {
  kickoff_time: string | null;
  started: boolean;
  finished: boolean;
  finished_provisional: boolean;
};

type FplSnapshot = {
  events: FplEvent[];
  fixtures: Record<number, FplFixture[]>;
};

const FPL_API = 'https://fantasy.premierleague.com/api';
const SNAPSHOT_TTL_MS = 60_000;

// Module-level memo rather than Next's fetch cache: it survives warm invocations,
// needs no cacheComponents-specific directives, and a failed fetch is never stored.
let snapshotMemo: { at: number; value: FplSnapshot } | null = null;

async function fplFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${FPL_API}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`FPL ${path} responded ${res.status}`);
  return res.json();
}

async function fetchFplSnapshot(): Promise<FplSnapshot | null> {
  if (snapshotMemo && Date.now() - snapshotMemo.at < SNAPSHOT_TTL_MS) return snapshotMemo.value;
  try {
    const bootstrap = await fplFetch<{ events: any[] }>('/bootstrap-static/');
    const events: FplEvent[] = bootstrap.events.map((e: any) => ({
      id: e.id, name: e.name, deadline_time: e.deadline_time,
      is_previous: e.is_previous, is_current: e.is_current, is_next: e.is_next, finished: e.finished, data_checked: e.data_checked,
    }));

    const wanted = events.filter(e => e.is_previous || e.is_current || e.is_next).map(e => e.id);
    if (wanted.length === 0) {
      const lastFinished = [...events].reverse().find(e => e.finished);
      if (lastFinished) wanted.push(lastFinished.id);
    }

    const fixtureLists = await Promise.all(wanted.map(id => fplFetch<any[]>(`/fixtures/?event=${id}`)));
    const fixtures: Record<number, FplFixture[]> = {};
    wanted.forEach((id, i) => {
      fixtures[id] = fixtureLists[i].map((f: any) => ({
        kickoff_time: f.kickoff_time, started: !!f.started, finished: !!f.finished, finished_provisional: !!f.finished_provisional,
      }));
    });

    const value = { events, fixtures };
    snapshotMemo = { at: Date.now(), value };
    return value;
  } catch (err) {
    console.error('FPL status fetch failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

export type FplEventLite = { id: number; name: string; deadline_time: string; finished: boolean };

// The season's gameweek list with deadlines, or null when FPL is unreachable.
export const getFplEvents = cache(async (): Promise<FplEventLite[] | null> => {
  const snapshot = await fetchFplSnapshot();
  return snapshot ? snapshot.events.map(e => ({ id: e.id, name: e.name, deadline_time: e.deadline_time, finished: e.finished })) : null;
});

export const getGameweekStatus = cache(async (): Promise<GameweekStatus> => {
  const supabase = await createClient();
  const [snapshot, { data: gwRows }] = await Promise.all([
    fetchFplSnapshot(),
    supabase.from('gameweeks').select('gw_number, is_finished').eq('season_id', SEASON_ID),
  ]);

  const syncedSet = new Set((gwRows || []).filter(r => r.is_finished).map(r => Number(r.gw_number)));
  const syncedThroughGw = syncedSet.size > 0 ? Math.max(...syncedSet) : 0;

  if (!snapshot) {
    // Any score rows beyond the synced week were written live by the ingest.
    const { data: liveRow } = await supabase
      .from('manager_gw_scores')
      .select('gw_number')
      .eq('season_id', SEASON_ID)
      .gt('gw_number', syncedThroughGw)
      .order('gw_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    const liveGw = liveRow ? Number(liveRow.gw_number) : null;
    const activeGw = liveGw ?? syncedThroughGw;
    return {
      phase: 'unknown', fplAvailable: false, activeGw, activeGwName: `Gameweek ${activeGw}`,
      syncedThroughGw, liveGw, displayGw: activeGw,
      deadline: null, firstKickoff: null, lastKickoff: null,
      fixturesTotal: 0, fixturesUnscheduled: 0, fixturesStarted: 0, fixturesFinished: 0,
      fplFinished: false, fplDataChecked: false, nextGw: null,
      timeline: { upcomingStart: null, deadline: null, finalWhistle: null, confirmed: null, synced: null },
    };
  }

  const now = Date.now();
  const { events } = snapshot;
  const current = events.find(e => e.is_current) || null;
  const next = events.find(e => e.is_next) || null;
  const lastFinished = [...events].reverse().find(e => e.finished) || null;

  // Stay on the current week until the ingest has synced it, then look ahead.
  const focus = current && !syncedSet.has(current.id) ? current : (next ?? current ?? lastFinished);

  const fixtures = focus ? snapshot.fixtures[focus.id] || [] : [];
  const playable = fixtures.filter(f => f.kickoff_time);
  const fixturesStarted = playable.filter(f => f.started).length;
  const fixturesFinished = playable.filter(f => f.finished || f.finished_provisional).length;
  const kickoffs = playable.map(f => f.kickoff_time as string).sort();

  let phase: GameweekPhase = 'unknown';
  if (focus) {
    if (syncedSet.has(focus.id)) phase = 'synced';
    else if (now < Date.parse(focus.deadline_time)) phase = 'upcoming';
    else if (focus.data_checked) phase = 'confirmed';
    else if (focus.finished || (playable.length > 0 && fixturesFinished === playable.length)) phase = 'final_whistle';
    else phase = 'live';
  }

  const liveGw = current && !syncedSet.has(current.id) && now >= Date.parse(current.deadline_time) ? current.id : null;
  const after = focus ? events.find(e => e.id === focus.id + 1) || null : null;

  let timeline: GameweekTimelineAnchors = { upcomingStart: null, deadline: null, finalWhistle: null, confirmed: null, synced: null };
  if (focus) {
    const cycle = estimateCycle(focus.deadline_time, kickoffs[kickoffs.length - 1] ?? null);
    const previous = events.find(e => e.id === focus.id - 1) || null;
    let upcomingStart = Date.parse(focus.deadline_time) - 7 * 24 * HOUR;
    if (previous) {
      const prevKickoffs = (snapshot.fixtures[previous.id] || []).map(f => f.kickoff_time).filter((k): k is string => !!k).sort();
      upcomingStart = estimateCycle(previous.deadline_time, prevKickoffs[prevKickoffs.length - 1] ?? null).synced;
    }
    const iso = (ms: number) => new Date(ms).toISOString();
    timeline = {
      upcomingStart: iso(upcomingStart),
      deadline: focus.deadline_time,
      finalWhistle: iso(cycle.whistle),
      confirmed: iso(cycle.confirmed),
      synced: iso(cycle.synced),
    };
  }

  return {
    phase,
    fplAvailable: true,
    activeGw: focus?.id ?? syncedThroughGw,
    activeGwName: focus?.name ?? `Gameweek ${syncedThroughGw}`,
    syncedThroughGw,
    liveGw,
    displayGw: liveGw ?? syncedThroughGw,
    deadline: focus?.deadline_time ?? null,
    firstKickoff: kickoffs[0] ?? null,
    lastKickoff: kickoffs[kickoffs.length - 1] ?? null,
    fixturesTotal: playable.length,
    fixturesUnscheduled: fixtures.length - playable.length,
    fixturesStarted,
    fixturesFinished,
    fplFinished: focus?.finished ?? false,
    fplDataChecked: focus?.data_checked ?? false,
    nextGw: after ? { id: after.id, name: after.name, deadline: after.deadline_time } : null,
    timeline,
  };
});

export function formatUk(iso: string | null | undefined, withTime = true): string {
  if (!iso) return '—';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short',
    ...(withTime ? { hour: '2-digit' as const, minute: '2-digit' as const, hourCycle: 'h23' as const } : {}),
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  // en-GB abbreviates September as "Sept"; trim every month to three letters.
  const date = `${get('weekday')} ${get('day')} ${get('month').slice(0, 3)}`;
  return withTime ? `${date}, ${get('hour')}:${get('minute')}` : date;
}

// "Sat 15:00" — for ranges where the full date would be repeated.
export function formatUkShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  return `${get('weekday')} ${get('hour')}:${get('minute')}`;
}

export const SYNC_CADENCE = 'updates every 15 min';

export function describePhase(gw: GameweekStatus): string {
  switch (gw.phase) {
    case 'upcoming': {
      const prefix = gw.syncedThroughGw > 0 && gw.syncedThroughGw < gw.activeGw ? `GW${gw.syncedThroughGw} final · ` : '';
      return `${prefix}Deadline ${formatUk(gw.deadline)}`;
    }
    case 'live': {
      if (gw.fixturesStarted === 0) return `Deadline passed · first kickoff ${formatUk(gw.firstKickoff)}`;
      const inPlay = gw.fixturesStarted - gw.fixturesFinished;
      return `${gw.fixturesFinished} of ${gw.fixturesTotal} played`
        + (inPlay > 0 ? ` · ${inPlay} in play` : '')
        + (gw.fixturesUnscheduled > 0 ? ` · ${gw.fixturesUnscheduled} postponed` : '')
        + ` · ${SYNC_CADENCE}`;
    }
    case 'final_whistle':
      return 'All matches played · waiting for FPL to confirm points';
    case 'confirmed':
      return 'Results confirmed · updating tournaments';
    case 'synced':
      return gw.nextGw ? `Results final · GW${gw.nextGw.id} deadline ${formatUk(gw.nextGw.deadline)}` : 'Results final · season complete';
    default:
      return `Final through GW${gw.syncedThroughGw}`
        + (gw.liveGw ? ` · GW${gw.liveGw} scores are provisional` : '')
        + ' · live FPL status unavailable';
  }
}

// 0..1 progress through the active stage: time-based for Upcoming and Awaiting,
// matches played for Live. Final is complete by definition.
export function stageProgress(gw: GameweekStatus, now: number): number {
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  const between = (start: string | null, end: string | null) => {
    if (!start || !end) return 0;
    const a = Date.parse(start), b = Date.parse(end);
    return b > a ? clamp((now - a) / (b - a)) : 0;
  };
  switch (gw.phase) {
    case 'upcoming': return between(gw.timeline.upcomingStart, gw.timeline.deadline);
    case 'live': return gw.fixturesTotal > 0 ? clamp(gw.fixturesFinished / gw.fixturesTotal) : 0;
    case 'final_whistle': return Math.min(0.85, between(gw.timeline.finalWhistle, gw.timeline.confirmed));
    case 'confirmed': return 0.9;
    case 'synced': return 1;
    default: return 0;
  }
}

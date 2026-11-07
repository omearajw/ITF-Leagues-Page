import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DIVISIONS } from '@/lib/divisions';
import { SEASON_ID, SNAPSHOT_KEY, loadFplSnapshot } from '@/lib/gameweek-status';
import { fplKeys, fplLoaders, type LiveStats, type ManagerPicks, type Transfer } from '@/lib/fpl-manager';
import { h2hKey, loadDivisionFixtures } from '@/lib/h2h-fixtures';
import { MIRROR_TABLE } from '@/lib/fpl-mirror';
import { BADGES_KEY, loadLeagueBadges } from '@/lib/badges';

export const maxDuration = 60;

// Keeps the FPL mirror (lib/fpl-mirror.ts) current. cron-jobs.org calls it every minute with the
// same secret as the ingest. Pages read the mirror instead of FPL, so this is the one place the
// site asks FPL for page data: about ten requests a minute once the history is filled in.
//
// Every run refreshes the gameweek list, this week's fixtures and the live points. On top of
// that it spends a budget of FPL requests on whatever is most overdue, most important first, so
// a fresh mirror fills in over an hour or so and then only tops up.
const BUDGET = 15;
const MIN = 60_000;
const ONCE = Number.POSITIVE_INFINITY;

type Task = { key: string; every: number; priority: number; load: () => Promise<unknown> };

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const started = Date.now();
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const failed: string[] = [];
  const writes = new Map<string, unknown>();

  const { data: held } = await db.from(MIRROR_TABLE).select('key, fetched_at');
  const age = new Map((held || []).map(r => [r.key as string, started - Date.parse(r.fetched_at)]));
  const due = (key: string, every: number) => !age.has(key) || (every !== ONCE && age.get(key)! >= every);

  // The gameweek list says which week is current; if FPL refuses it, the last copy will do.
  let snapshot: Awaited<ReturnType<typeof loadFplSnapshot>> | null = null;
  try {
    snapshot = await loadFplSnapshot();
    writes.set(SNAPSHOT_KEY, snapshot);
  } catch (err) {
    failed.push(`${SNAPSHOT_KEY}: ${err instanceof Error ? err.message : err}`);
    const { data } = await db.from(MIRROR_TABLE).select('data').eq('key', SNAPSHOT_KEY).maybeSingle();
    snapshot = (data?.data as typeof snapshot) ?? null;
  }
  if (!snapshot) return NextResponse.json({ ok: false, failed, note: 'No gameweek list from FPL or the mirror yet' });

  const current = snapshot.events.find(e => e.is_current)?.id ?? null;
  const confirmed = snapshot.events.filter(e => e.finished && e.data_checked).map(e => e.id).sort((a, b) => b - a);
  const liveWeek = current !== null && !confirmed.includes(current) ? current : null;

  const { data: members } = await db.from('season_managers').select('manager_fpl_id').eq('season_id', SEASON_ID);
  const ids = (members || []).map(m => Number(m.manager_fpl_id));

  const tasks: Task[] = [];
  const add = (key: string, every: number, priority: number, load: () => Promise<unknown>) => tasks.push({ key, every, priority, load });
  add(fplKeys.players(), 5 * MIN, 0, fplLoaders.loadPlayers);
  if (current !== null) add(fplKeys.gwFixtures(current, false), 0, 0, () => fplLoaders.loadGwFixtures(current));
  if (liveWeek !== null) {
    for (const id of ids) add(fplKeys.picks(id, liveWeek, false), 6 * 60 * MIN, 1, () => fplLoaders.loadPicks(id, liveWeek));
  }
  for (const id of ids) {
    add(fplKeys.entry(id), 15 * MIN, 2, () => fplLoaders.loadEntry(id));
    add(fplKeys.transfers(id), 15 * MIN, 2, () => fplLoaders.loadTransfers(id));
  }
  if (current !== null) {
    for (const gw of [current, current + 1].filter(g => g <= 38)) {
      for (const d of DIVISIONS) add(h2hKey(d.fplId, gw), 30 * MIN, 2, () => loadDivisionFixtures(d.fplId, gw));
    }
    if (current + 1 <= 38) add(fplKeys.fixtureRuns(current + 1, 5), 2 * 60 * MIN, 3, () => fplLoaders.loadFixtureRuns(current + 1, 5));
  }
  add(BADGES_KEY, 6 * 60 * MIN, 3, loadLeagueBadges);
  // Confirmed weeks never change, so each is stored once, newest first.
  for (const gw of confirmed) {
    add(fplKeys.gwFixtures(gw, true), ONCE, 4, () => fplLoaders.loadGwFixtures(gw));
    for (const id of ids) add(fplKeys.picks(id, gw, true), ONCE, 4, () => fplLoaders.loadPicks(id, gw));
    for (const d of DIVISIONS) add(h2hKey(d.fplId, gw), 24 * 60 * MIN, 5, () => loadDivisionFixtures(d.fplId, gw));
  }

  // Most important first; within a level, missing before oldest.
  const chosen = tasks
    .filter(t => due(t.key, t.every))
    .sort((a, b) => a.priority - b.priority || (age.get(b.key) ?? Infinity) - (age.get(a.key) ?? Infinity))
    .filter((t, i) => t.priority === 0 || i < BUDGET);
  await Promise.all(chosen.map(async t => {
    try { writes.set(t.key, await t.load()); }
    catch (err) { failed.push(`${t.key}: ${err instanceof Error ? err.message : err}`); }
  }));

  // Live points every run for the week in play, and once for each confirmed week.
  const liveWeeks: { gw: number; final: boolean }[] = [];
  if (liveWeek !== null) liveWeeks.push({ gw: liveWeek, final: false });
  const missingFinal = confirmed.find(gw => due(fplKeys.live(gw, true), ONCE));
  if (missingFinal !== undefined) liveWeeks.push({ gw: missingFinal, final: true });
  for (const { gw, final } of liveWeeks) {
    try {
      const live = await fplLoaders.loadLive(gw);
      writes.set(fplKeys.live(gw, final), await leagueOnly(db, live, gw, final, ids, writes));
    } catch (err) {
      failed.push(`${fplKeys.live(gw, final)}: ${err instanceof Error ? err.message : err}`);
    }
  }

  const now = new Date().toISOString();
  const rows = [...writes].map(([key, data]) => ({ key, data, fetched_at: now }));
  if (rows.length) {
    const { error } = await db.from(MIRROR_TABLE).upsert(rows, { onConflict: 'key' });
    if (error) failed.push(`saving: ${error.message}`);
  }
  if (failed.length) console.error('FPL sync failures:', failed.join(' | '));

  // Always 200 for an authorised call: cron-jobs.org switches off jobs that keep failing, and a
  // spell of FPL refusals should not do that. The failures are in the reply and the logs.
  return NextResponse.json({
    ok: failed.length === 0, current, liveWeek, saved: rows.length, failed,
    due: tasks.filter(t => due(t.key, t.every)).length - chosen.length, ms: Date.now() - started,
  });
}

// Live points are kept only for players someone in the league picked that week, plus the week's
// transfers in and out, which is all the site shows; a few kilobytes instead of the whole game.
// If any team's picks are not stored yet the full list is kept, so nothing is ever missing.
async function leagueOnly(db: any, live: LiveStats, gw: number, final: boolean, ids: number[], fresh: Map<string, unknown>): Promise<LiveStats> {
  const pickKeys = ids.map(id => fplKeys.picks(id, gw, final));
  const transferKeys = ids.map(id => fplKeys.transfers(id));
  const { data } = await db.from(MIRROR_TABLE).select('key, data').in('key', [...pickKeys, ...transferKeys]);
  const stored = new Map<string, unknown>((data || []).map((r: any) => [r.key, r.data]));
  const read = (key: string) => (fresh.get(key) ?? stored.get(key)) as unknown;

  const keep = new Set<number>();
  for (const key of pickKeys) {
    const picks = read(key) as ManagerPicks | undefined;
    if (!picks) return live;
    picks.picks.forEach(p => keep.add(p.element));
  }
  for (const key of transferKeys) {
    ((read(key) as Transfer[] | undefined) || []).filter(t => t.event === gw).forEach(t => { keep.add(t.element_in); keep.add(t.element_out); });
  }
  return Object.fromEntries([...keep].filter(el => live[el]).map(el => [el, live[el]]));
}

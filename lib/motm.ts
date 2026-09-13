import type { FplEventLite } from '@/lib/gameweek-status';

// Which calendar month a gameweek belongs to. 'deadline' uses the FPL deadline date;
// 'kickoff' would need fixture dates. Change MONTH_BASIS once the league settles the rule.
export const MONTH_BASIS: 'deadline' = 'deadline';

export type MotmManager = { id: number; teamName: string; realName: string; division: string };
export type MotmScore = { manager_fpl_id: number; gw_number: number; points: number };

export type MotmDivisionResult = {
  division: string;
  leaders: (MotmManager & { points: number })[];
  standings: (MotmManager & { points: number })[];
};

export type MotmMonth = {
  key: string;
  label: string;
  gameweeks: number[];
  complete: boolean;
  divisions: MotmDivisionResult[];
};

const monthFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', month: 'long', year: 'numeric' });
const keyFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit' });

export function monthOfGameweek(event: FplEventLite): { key: string; label: string } {
  const date = new Date(event.deadline_time);
  const parts = keyFormatter.formatToParts(date);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  return { key: `${year}-${month}`, label: monthFormatter.format(date) };
}

export function buildMotm(opts: {
  events: FplEventLite[];
  syncedThroughGw: number;
  managers: MotmManager[];
  scores: MotmScore[];
  divisions: string[];
}): MotmMonth[] {
  const { events, syncedThroughGw, managers, scores, divisions } = opts;

  const months = new Map<string, { label: string; gameweeks: number[] }>();
  for (const event of events) {
    const { key, label } = monthOfGameweek(event);
    if (!months.has(key)) months.set(key, { label, gameweeks: [] });
    months.get(key)!.gameweeks.push(event.id);
  }

  const pointsByManagerGw = new Map<string, number>();
  for (const s of scores) pointsByManagerGw.set(`${s.manager_fpl_id}:${s.gw_number}`, s.points);

  const result: MotmMonth[] = [];
  for (const [key, { label, gameweeks }] of months) {
    const startedGws = gameweeks.filter(g => g <= syncedThroughGw);
    if (startedGws.length === 0) continue;
    const complete = gameweeks.every(g => g <= syncedThroughGw);

    const divisionResults: MotmDivisionResult[] = divisions.map(division => {
      const standings = managers
        .filter(m => m.division === division)
        .map(m => ({ ...m, points: startedGws.reduce((sum, g) => sum + (pointsByManagerGw.get(`${m.id}:${g}`) ?? 0), 0) }))
        .sort((a, b) => b.points - a.points || a.teamName.localeCompare(b.teamName));
      const top = standings[0]?.points ?? 0;
      // Rulebook: tied managers share the award.
      const leaders = standings.filter(m => m.points === top && top > 0);
      return { division, leaders, standings };
    });

    result.push({ key, label, gameweeks, complete, divisions: divisionResults });
  }

  return result.sort((a, b) => b.key.localeCompare(a.key));
}

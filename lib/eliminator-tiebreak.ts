// Eliminator tie-break: when survivors share the lowest net score, the league's own
// order decides who goes. Each step narrows the tied set and stops once one is left.
//   1. Played a chip that week: you lose
//   2. Fewer points on the bench loses
//   3. Rarer captain (global FPL ownership) loses
//   4. Fewer goals scored by the counting eleven loses
//   5. Fewer clean sheets loses
//   6. More transfers over the season loses
//   7. Lower season total loses
// If still tied, the lower FPL entry id goes, so the result is always deterministic.

export type TieFacts = {
  id: number;
  chip: string | null;
  benchPoints: number;
  captainOwnership: number; // global selected_by_percent of the player who carried the armband
  goals: number;
  cleanSheets: number;
  transfersSeason: number;
  seasonTotal: number;
};

export type TieResult = { loser: number; rule: string; considered: number[] };

type Step = { rule: string; apply: (set: TieFacts[]) => TieFacts[] };

const lowest = (key: keyof TieFacts) => (set: TieFacts[]) => { const min = Math.min(...set.map(f => f[key] as number)); return set.filter(f => f[key] === min); };
const highest = (key: keyof TieFacts) => (set: TieFacts[]) => { const max = Math.max(...set.map(f => f[key] as number)); return set.filter(f => f[key] === max); };

const STEPS: Step[] = [
  { rule: 'played a chip', apply: set => (set.some(f => f.chip) && set.some(f => !f.chip) ? set.filter(f => f.chip) : set) },
  { rule: 'fewer bench points', apply: lowest('benchPoints') },
  { rule: 'rarer captain', apply: lowest('captainOwnership') },
  { rule: 'fewer goals scored', apply: lowest('goals') },
  { rule: 'fewer clean sheets', apply: lowest('cleanSheets') },
  { rule: 'more transfers this season', apply: highest('transfersSeason') },
  { rule: 'lower season total', apply: lowest('seasonTotal') },
];

export function resolveEliminatorTie(facts: TieFacts[]): TieResult {
  const considered = facts.map(f => f.id);
  if (facts.length === 1) return { loser: facts[0].id, rule: 'lowest score', considered };
  let set = facts;
  for (const step of STEPS) {
    const next = step.apply(set);
    if (next.length === 1) return { loser: next[0].id, rule: step.rule, considered };
    if (next.length > 1) set = next;
  }
  const loser = [...set].sort((a, b) => a.id - b.id)[0].id;
  return { loser, rule: 'lower entry id (still level after every rule)', considered };
}

const FPL = 'https://fantasy.premierleague.com/api';
async function fplJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${FPL}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    return res.ok ? res.json() : null;
  } catch { return null; }
}

// Gathers the facts for a finished gameweek. Picks are final by then, so positions 1-11
// are the eleven that counted, including any automatic substitutions.
export async function loadTieFacts(ids: number[], gw: number): Promise<TieFacts[]> {
  const [boot, live] = await Promise.all([fplJson<any>('/bootstrap-static/'), fplJson<any>(`/event/${gw}/live/`)]);
  const ownership: Record<number, number> = {};
  (boot?.elements || []).forEach((e: any) => { ownership[e.id] = parseFloat(e.selected_by_percent) || 0; });
  const stats: Record<number, any> = {};
  (live?.elements || []).forEach((e: any) => { stats[e.id] = e.stats; });

  return Promise.all(ids.map(async id => {
    const [picks, history] = await Promise.all([fplJson<any>(`/entry/${id}/event/${gw}/picks/`), fplJson<any>(`/entry/${id}/history/`)]);
    const xi = (picks?.picks || []).filter((p: any) => p.position <= 11);
    const armband = (picks?.picks || []).find((p: any) => p.multiplier > 1) || (picks?.picks || []).find((p: any) => p.is_captain);
    const weeks = (history?.current || []).filter((h: any) => h.event <= gw);
    return {
      id,
      chip: picks?.active_chip || null,
      benchPoints: picks?.entry_history?.points_on_bench ?? 0,
      captainOwnership: armband ? (ownership[armband.element] ?? 0) : 0,
      goals: xi.reduce((s: number, p: any) => s + (stats[p.element]?.goals_scored || 0), 0),
      cleanSheets: xi.reduce((s: number, p: any) => s + (stats[p.element]?.clean_sheets || 0), 0),
      transfersSeason: weeks.reduce((s: number, h: any) => s + (h.event_transfers || 0), 0),
      seasonTotal: weeks.find((h: any) => h.event === gw)?.total_points ?? 0,
    };
  }));
}

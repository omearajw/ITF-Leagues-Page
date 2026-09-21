export type FixtureState = 'none' | 'pending' | 'playing' | 'finished';

export type SubCandidate = {
  element: number;
  position: number; // 1-11 starters, 12-15 bench in order
  role: 'GKP' | 'DEF' | 'MID' | 'FWD';
  minutes: number;
  points: number;
  fixtureState: FixtureState;
  isCaptain: boolean;
  isVice: boolean;
};

export type AutoSubProjection = {
  out: number[];          // starters certain to be replaced
  in: number[];           // bench players certain to come on, paired with `out`
  undecided: number[];    // starters who will be replaced, but by whom depends on matches still to play
  benchDue: number;       // points the certain incoming players bring
  captainToVice: boolean; // captain finished on zero minutes, vice carries the armband
  captainExtra: number;   // extra points from the vice's doubled score
  benchBoost: boolean;    // chip in play: everyone counts, no substitutions
};

const MIN_BY_ROLE = { GKP: 1, DEF: 3, MID: 2, FWD: 1 } as const;

// FPL processes automatic substitutions after the last match, working through the
// bench in order: each substitute replaces the first starter who did not play that they
// can legally replace (keeper for keeper; at least 3 DEF, 2 MID, 1 FWD). This projects
// that early for a week in progress and only counts a substitution as certain when no bench
// player ahead in the order who could legally take the slot still has a match to play.
export function projectAutoSubs(picks: SubCandidate[], activeChip: string | null = null): AutoSubProjection {
  const benchBoost = activeChip === 'bboost';
  const starters = picks.filter(p => p.position <= 11).sort((a, b) => a.position - b.position);
  const bench = picks.filter(p => p.position > 11).sort((a, b) => a.position - b.position);
  const done = (p: SubCandidate) => p.fixtureState === 'finished' || p.fixtureState === 'none';
  const wontPlay = (p: SubCandidate) => p.minutes === 0 && done(p);
  const settled = (p: SubCandidate) => p.minutes > 0 || done(p); // their part in the week is known

  const captain = starters.find(p => p.isCaptain);
  const vice = starters.find(p => p.isVice);
  const captainToVice = !benchBoost && !!captain && wontPlay(captain) && !!vice && !wontPlay(vice);
  const captainExtra = captainToVice && vice ? vice.points : 0;

  if (benchBoost) return { out: [], in: [], undecided: [], benchDue: 0, captainToVice, captainExtra, benchBoost };

  const xi = new Map(starters.map(p => [p.element, p.role]));
  const replaced = new Set<number>();
  const out: number[] = [];
  const inn: number[] = [];
  let benchDue = 0;
  const unresolved: SubCandidate[] = []; // bench players ahead in the order whose match is still to come

  const legal = (outEl: number, sub: SubCandidate) => {
    const after = new Map(xi);
    after.delete(outEl); after.set(sub.element, sub.role);
    return (Object.keys(MIN_BY_ROLE) as (keyof typeof MIN_BY_ROLE)[]).every(role => [...after.values()].filter(r => r === role).length >= MIN_BY_ROLE[role]);
  };

  for (const sub of bench) {
    if (!settled(sub)) { unresolved.push(sub); continue; }
    if (sub.minutes === 0) continue; // finished without playing: cannot come on
    const target = starters.find(st => !replaced.has(st.element) && wontPlay(st) && (st.role === 'GKP') === (sub.role === 'GKP') && legal(st.element, sub));
    if (!target) continue;
    // An earlier bench player who has not played yet takes precedence if they could legally fill this slot.
    const contested = unresolved.some(u => (u.role === 'GKP') === (target.role === 'GKP') && legal(target.element, u));
    if (contested) continue;
    replaced.add(target.element); out.push(target.element); inn.push(sub.element); benchDue += sub.points;
    xi.delete(target.element); xi.set(sub.element, sub.role);
  }

  const undecided = starters.filter(st => wontPlay(st) && !replaced.has(st.element)).map(st => st.element);
  return { out, in: inn, undecided, benchDue, captainToVice, captainExtra, benchBoost };
}

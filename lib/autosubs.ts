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
  out: number[];
  in: number[];
  benchDue: number;      // points the incoming bench players bring
  captainToVice: boolean; // captain finished on zero minutes, vice carries the armband
  captainExtra: number;   // extra points from the vice's doubled score
};

const MIN_BY_ROLE = { GKP: 1, DEF: 3, MID: 2, FWD: 1 } as const;

// FPL applies automatic substitutions after the last match. This projects them
// early for the week in progress: a starter who finished on zero minutes (or had
// no fixture) is replaced by the first bench player who has played, keeper for
// keeper, provided the formation stays legal.
export function projectAutoSubs(picks: SubCandidate[]): AutoSubProjection {
  const starters = picks.filter(p => p.position <= 11);
  const bench = picks.filter(p => p.position > 11).sort((a, b) => a.position - b.position);
  const wontPlay = (p: SubCandidate) => p.minutes === 0 && (p.fixtureState === 'finished' || p.fixtureState === 'none');

  const xi = new Map(starters.map(p => [p.element, p.role]));
  const used = new Set<number>();
  const out: number[] = [];
  const inn: number[] = [];
  let benchDue = 0;

  const countRole = (role: SubCandidate['role']) => [...xi.values()].filter(r => r === role).length;

  for (const starter of starters) {
    if (!wontPlay(starter)) continue;
    for (const sub of bench) {
      if (used.has(sub.element) || sub.minutes === 0) continue;
      if (starter.role === 'GKP' ? sub.role !== 'GKP' : sub.role === 'GKP') continue;
      // formation after the swap must keep the minimums
      const after = new Map(xi);
      after.delete(starter.element); after.set(sub.element, sub.role);
      const ok = (Object.keys(MIN_BY_ROLE) as (keyof typeof MIN_BY_ROLE)[]).every(role => [...after.values()].filter(r => r === role).length >= MIN_BY_ROLE[role]);
      if (!ok) continue;
      used.add(sub.element); out.push(starter.element); inn.push(sub.element); benchDue += sub.points;
      xi.delete(starter.element); xi.set(sub.element, sub.role);
      break;
    }
  }
  void countRole;

  const captain = starters.find(p => p.isCaptain);
  const vice = starters.find(p => p.isVice);
  const captainToVice = !!captain && wontPlay(captain) && !!vice && !wontPlay(vice);
  const captainExtra = captainToVice && vice ? vice.points : 0;

  return { out, in: inn, benchDue, captainToVice, captainExtra };
}

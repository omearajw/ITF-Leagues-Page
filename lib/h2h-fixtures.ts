export type H2HFixture = {
  gw: number;
  m1: number;
  m2: number;
  name1: string;
  name2: string;
  p1: number;
  p2: number;
};

const FPL_API = 'https://fantasy.premierleague.com/api';
const TTL_MS = 60_000;
const memo = new Map<string, { at: number; value: H2HFixture[] }>();

// FPL's H2H matches feed lists every tie for a gameweek, including future ones,
// so the site can show next week's fixtures without storing them.
export async function getDivisionFixtures(leagueId: string, gw: number): Promise<H2HFixture[] | null> {
  const key = `${leagueId}:${gw}`;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  try {
    const res = await fetch(`${FPL_API}/leagues-h2h-matches/league/${leagueId}/?event=${gw}`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`FPL H2H matches ${res.status}`);
    const data = await res.json();
    const value: H2HFixture[] = (data.results || [])
      .filter((m: any) => m.entry_1_entry && m.entry_2_entry)
      .map((m: any) => ({
        gw, m1: Number(m.entry_1_entry), m2: Number(m.entry_2_entry),
        name1: m.entry_1_name, name2: m.entry_2_name,
        p1: m.entry_1_points ?? 0, p2: m.entry_2_points ?? 0,
      }));
    memo.set(key, { at: Date.now(), value });
    return value;
  } catch (err) {
    console.error('H2H fixtures fetch failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

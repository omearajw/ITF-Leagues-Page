import { fplGet } from '@/lib/fpl-fetch';
import { mirrored } from '@/lib/fpl-mirror';

export type H2HFixture = {
  gw: number;
  m1: number;
  m2: number;
  name1: string;
  name2: string;
  p1: number;
  p2: number;
};

export const h2hKey = (leagueId: string, gw: number) => `h2h:${leagueId}:${gw}`;

// FPL's H2H matches feed lists every tie for a gameweek, including future ones, so the site can
// show next week's fixtures without storing them. The sync job (/api/fpl-sync) runs this loader.
export async function loadDivisionFixtures(leagueId: string, gw: number): Promise<H2HFixture[]> {
  const data = await fplGet<any>(`/leagues-h2h-matches/league/${leagueId}/?event=${gw}`);
  return (data.results || [])
    .filter((m: any) => m.entry_1_entry && m.entry_2_entry)
    .map((m: any) => ({
      gw, m1: Number(m.entry_1_entry), m2: Number(m.entry_2_entry),
      name1: m.entry_1_name, name2: m.entry_2_name,
      p1: m.entry_1_points ?? 0, p2: m.entry_2_points ?? 0,
    }));
}

export function getDivisionFixtures(leagueId: string, gw: number): Promise<H2HFixture[] | null> {
  return mirrored(h2hKey(leagueId, gw), () => loadDivisionFixtures(leagueId, gw));
}

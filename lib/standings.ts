// One ranking rule for every table, so tied teams never sit in a different order on different
// pages (and so their movement arrows agree). League tables rank on Pts first; every table then
// falls back to the season total, that week's net score, and finally the team name.
export type Standing = { pts?: number; total: number; week?: number | null; name: string };

export function compareStanding(a: Standing, b: Standing): number {
  return (b.pts ?? 0) - (a.pts ?? 0)
    || b.total - a.total
    || (b.week ?? 0) - (a.week ?? 0)
    || a.name.localeCompare(b.name);
}

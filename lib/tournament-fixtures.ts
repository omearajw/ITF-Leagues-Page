// Until 31 October 2026 the ingest re-created the Champions League Stage 1 schedule on every run
// while its first week was live, so tournament_fixtures could hold many copies of each tie. Anything
// that counts or lists ties reads them through this, which keeps one copy of each, so copies can
// never inflate a table. Ids are random (UUIDs), so no copy is "first": a copy holding a score is
// kept over one without, since a copy made after the week's last update has none yet.
type Tie = { stage: string; gw_number: number; manager_1_id: number; manager_2_id: number | null; manager_1_score: number | null };

export function uniqueTies<T extends Tie>(fixtures: T[] | null | undefined): T[] {
  const kept = new Map<string, T>();
  for (const f of fixtures || []) {
    const key = `${f.stage}|${f.gw_number}|${f.manager_1_id}|${f.manager_2_id}`;
    const current = kept.get(key);
    if (!current || (current.manager_1_score === null && f.manager_1_score !== null)) kept.set(key, f);
  }
  return [...kept.values()];
}

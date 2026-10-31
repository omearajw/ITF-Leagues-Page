// Until 31 October 2026 the ingest re-created the Champions League Stage 1 schedule on every run
// while its first week was live, so tournament_fixtures holds many copies of each tie. Anything
// that counts or lists ties reads them through this, which keeps the first copy (lowest id) of
// each and drops the rest, so the copies cannot inflate a table whether or not they are deleted.
type Tie = { id: number; stage: string; gw_number: number; manager_1_id: number; manager_2_id: number | null };

export function uniqueTies<T extends Tie>(fixtures: T[] | null | undefined): T[] {
  const seen = new Set<string>();
  return [...(fixtures || [])]
    .sort((a, b) => a.id - b.id)
    .filter(f => {
      const key = `${f.stage}|${f.gw_number}|${f.manager_1_id}|${f.manager_2_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

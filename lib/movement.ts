// Places moved between two orderings: positive = climbed, negative = dropped,
// null = not present in the previous ordering (new entrant or no prior data).
export function positionDeltas(currentIds: number[], previousIds: number[]): Record<number, number | null> {
  const prevPos: Record<number, number> = {};
  previousIds.forEach((id, i) => { prevPos[id] = i; });
  const deltas: Record<number, number | null> = {};
  currentIds.forEach((id, i) => {
    deltas[id] = prevPos[id] === undefined ? null : prevPos[id] - i;
  });
  return deltas;
}

// How a player's points were made up, from the `explain` list in FPL's live feed: for each match,
// each thing that scored (minutes, goals, a clean sheet, cards...) with its count and points.

export type FplExplain = { fixture: number; stats: { identifier: string; value: number; points: number }[] }[];
export type BreakdownRow = { label: string; value: number; points: number };

const LABELS: Record<string, string> = {
  minutes: 'Minutes played',
  goals_scored: 'Goals scored',
  assists: 'Assists',
  clean_sheets: 'Clean sheet',
  goals_conceded: 'Goals conceded',
  own_goals: 'Own goals',
  penalties_saved: 'Penalties saved',
  penalties_missed: 'Penalties missed',
  yellow_cards: 'Yellow card',
  red_cards: 'Red card',
  saves: 'Saves',
  bonus: 'Bonus',
  defensive_contribution: 'Defensive contribution',
};

const label = (identifier: string) => LABELS[identifier] ?? identifier.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

// One list of rows per match (two in a double gameweek), in FPL's order.
export function breakdownFrom(explain: FplExplain | undefined): BreakdownRow[][] | undefined {
  if (!explain?.length) return undefined;
  return explain.map(match => match.stats.map(s => ({ label: label(s.identifier), value: s.value, points: s.points })));
}

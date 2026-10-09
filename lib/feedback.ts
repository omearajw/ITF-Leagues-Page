// What a piece of feedback is about. The keys are stored in the feedback table's `kind` column
// (see supabase/feedback.sql), so change both together.
export const FEEDBACK_KINDS = [
  { key: 'bug', label: 'Bug' },
  { key: 'feedback_good', label: 'Feedback: good' },
  { key: 'feedback_bad', label: 'Feedback: bad' },
  { key: 'idea_site', label: 'Idea for the site' },
  { key: 'idea_game', label: 'Idea for the game' },
] as const;

export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]['key'];
// `values` hands the submitted fields back with an error, because React empties a form after its action runs.
export type FeedbackState = { ok?: boolean; error?: string; values?: Record<string, string> };

export const OPEN_FEEDBACK_EVENT = 'itf:open-feedback';

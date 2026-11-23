// Pages written in the editor that are not tied to a gameweek. Like the ingest's sync-status row,
// each is a reserved page_content row under gameweek 0, so it is written once and kept up to date
// rather than starting blank every week.
export const WHATS_CHANGED = { id: 'whats-changed', gw_number: 0, title: "What's changed" };

export const SITE_PAGES = [WHATS_CHANGED];

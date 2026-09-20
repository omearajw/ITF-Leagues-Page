import { cookies } from 'next/headers';

// A convenience cookie remembering which of the 30 teams is the visitor's own.
export const MY_TEAM_COOKIE = 'itf_my_team';

export async function getMyTeamId(): Promise<number | null> {
  const store = await cookies();
  const raw = store.get(MY_TEAM_COOKIE)?.value;
  const id = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(id) ? id : null;
}

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { SEASON_ID } from '@/lib/gameweek-status';
import { MY_TEAM_COOKIE } from '@/lib/my-team';

// Sets (or clears) the "my team" cookie and sends the visitor on. Only league
// managers are accepted; `next` must be a local path.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = parseInt(url.searchParams.get('id') || '', 10);
  const next = url.searchParams.get('next') || '';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : null;

  if (url.searchParams.get('clear') === '1') {
    const res = NextResponse.redirect(new URL(safeNext || '/my-team?change=1', url.origin));
    res.cookies.set(MY_TEAM_COOKIE, '', { path: '/', maxAge: 0 });
    return res;
  }

  if (!Number.isFinite(id)) return NextResponse.redirect(new URL('/my-team', url.origin));
  const supabase = await createClient();
  const { data } = await supabase.from('season_managers').select('manager_fpl_id').eq('season_id', SEASON_ID).eq('manager_fpl_id', id).maybeSingle();
  if (!data) return NextResponse.redirect(new URL('/my-team', url.origin));

  const res = NextResponse.redirect(new URL(safeNext || `/manager/${id}`, url.origin));
  res.cookies.set(MY_TEAM_COOKIE, String(id), { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  return res;
}

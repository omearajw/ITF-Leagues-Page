import { NextResponse } from 'next/server';
import { getMyTeamId } from '@/lib/my-team';

// The planner is for your own team: go there if we know it, otherwise ask.
export async function GET(request: Request) {
  const myTeamId = await getMyTeamId();
  const origin = new URL(request.url).origin;
  return NextResponse.redirect(new URL(myTeamId ? `/manager/${myTeamId}/plan` : '/my-team?next=plan', origin), 307);
}

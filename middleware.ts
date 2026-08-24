import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 1. Grab the secure cookie token
  const role = request.cookies.get('itf_role')?.value;
  const path = request.nextUrl.pathname;

  // 2. Read your secure environment variables
  const isAdmin = role === process.env.ADMIN_SECRET_TOKEN;
  const isEditor = role === process.env.EDITOR_SECRET_TOKEN;

  // 3. Protect the Admin route
  if (path.startsWith('/admin') && !isAdmin) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 4. Protect the Editor route (Admins OR Editors can access)
  if (path.startsWith('/editor') && !isAdmin && !isEditor) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 5. If they have the right token, let them through
  return NextResponse.next();
}

// 6. Tell Next.js to ONLY run this bouncer on these specific routes
export const config = {
  matcher: ['/admin/:path*', '/editor/:path*'],
};
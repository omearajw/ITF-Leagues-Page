import { updateSession } from "@/lib/supabase/proxy";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // 1. Grab the current path and the secure cookie token
  const path = request.nextUrl.pathname;
  const role = request.cookies.get('itf_role')?.value;

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

  // 5. If they are authorized (or on a public page), continue with normal Supabase operations
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
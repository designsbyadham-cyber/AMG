import { NextResponse, type NextRequest } from 'next/server'

/**
 * Optimistic auth routing.
 *
 * Next 16 renamed Middleware to Proxy; the behaviour is the same. Two
 * rules from the Next docs shape this file:
 *
 *   "Proxy is not intended for slow data fetching ... it should not be
 *    used as a full session management or authorization solution."
 *   "Since Proxy runs on every route, including prefetched routes, it's
 *    important to only read the session from the cookie (optimistic
 *    checks), and avoid database checks to prevent performance issues."
 *
 * The previous version called `supabase.auth.getUser()` here, which is a
 * network round trip to Supabase's auth server on *every* matched
 * request — including link prefetches. When Supabase was slow to answer,
 * the proxy had nothing to fall back on and hung until Vercel's 25s edge
 * ceiling, which surfaces as MIDDLEWARE_INVOCATION_TIMEOUT (504). This
 * version makes zero network calls, so it cannot time out.
 *
 * Dropping the verified check here is safe because it was never the
 * security boundary:
 *   - Postgres RLS (`is_account_member`) gates every row.
 *   - Every API route calls `supabase.auth.getUser()` itself.
 *   - `AuthProvider` redirects signed-out users on the client.
 * A forged or stale cookie gets someone an app shell that immediately
 * bounces them and shows no data — the accepted trade of the optimistic
 * pattern.
 */

const AUTH_PAGES = new Set(['/login', '/signup', '/forgot-password'])

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/inbox',
  '/contacts',
  '/call-log',
  '/pipelines',
  '/broadcasts',
  '/automations',
  '/flows',
  '/settings',
]

/**
 * Supabase stores the session in `sb-<project-ref>-auth-token`, split
 * into `.0` / `.1` chunks when it outgrows the 4KB cookie limit.
 */
const SUPABASE_AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  const hasSession = request.cookies
    .getAll()
    .some((cookie) => SUPABASE_AUTH_COOKIE.test(cookie.name) && cookie.value)

  // Signed in and sitting on an auth page — send them onward. A forwarded
  // invite link wins over the dashboard so the invitee can accept in one
  // click instead of being silently dropped on /dashboard.
  if (hasSession && AUTH_PAGES.has(pathname)) {
    const url = request.nextUrl.clone()
    const inviteToken = searchParams.get('invite')
    if (inviteToken && pathname !== '/forgot-password') {
      url.pathname = `/join/${encodeURIComponent(inviteToken)}`
    } else {
      url.pathname = '/dashboard'
    }
    url.search = ''
    return NextResponse.redirect(url)
  }

  // No session cookie at all — don't bother rendering the app shell.
  if (!hasSession && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

/**
 * Matched paths are listed explicitly rather than "everything except
 * static assets". API routes are deliberately excluded: each one
 * authenticates itself, and the webhook + cron endpoints must stay
 * reachable without a user session.
 */
export const config = {
  matcher: [
    '/login',
    '/signup',
    '/forgot-password',
    '/dashboard/:path*',
    '/inbox/:path*',
    '/contacts/:path*',
    '/call-log/:path*',
    '/pipelines/:path*',
    '/broadcasts/:path*',
    '/automations/:path*',
    '/flows/:path*',
    '/settings/:path*',
  ],
}

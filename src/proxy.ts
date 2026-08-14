import { NextResponse, type NextRequest } from 'next/server'
import { readSessionCookie } from '@/lib/auth/session-cookie'

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
 * An earlier version called `supabase.auth.getUser()` here — a network
 * round trip to Supabase on every matched request, including link
 * prefetches — which hung to Vercel's 25s edge ceiling whenever Supabase
 * was slow and surfaced as MIDDLEWARE_INVOCATION_TIMEOUT (504). Nothing
 * in this file touches the network.
 *
 * Dropping the verified check is safe because it was never the security
 * boundary: Postgres RLS gates every row, every API route calls
 * `getUser()` itself, and `AuthProvider` redirects signed-out users.
 *
 * ## Avoiding the redirect loop
 *
 * The two redirects below must never be able to disagree with the
 * client, or the app ping-pongs between /login and /dashboard and renders
 * nothing. So they use *different* thresholds:
 *
 *   - Away from an auth page: only when the access token is currently
 *     valid, i.e. we are confident the user is signed in.
 *   - Onto the login page: only when no readable session exists at all.
 *
 * That leaves "cookie present but access token expired" as a deliberate
 * no-redirect zone. Those users reach the app, the browser client
 * refreshes the token, and nobody is bounced hourly when their access
 * token ages out. If the refresh also fails, the client redirects to
 * /login — and because the access token is expired, this file leaves them
 * there instead of sending them back.
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

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  const session = readSessionCookie(request.cookies.getAll())

  // Confidently signed in and sitting on an auth page — send them onward.
  // A forwarded invite link wins over the dashboard so the invitee can
  // accept in one click instead of being dropped on /dashboard.
  if (session.accessTokenValid && AUTH_PAGES.has(pathname)) {
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

  // No readable session — don't bother shipping the app shell. A cookie
  // that exists but won't parse counts as no session, so a corrupted
  // cookie can't strand someone on a blank page.
  if (!session.parsed && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
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

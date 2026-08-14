/**
 * Reads the Supabase session straight out of the request cookies — no
 * network call — so the proxy can make routing decisions without a round
 * trip to Supabase's auth server.
 *
 * Supabase stores the session in `sb-<project-ref>-auth-token`. The value
 * is JSON (optionally `base64-` prefixed) and is split into `.0` / `.1`
 * chunks when it outgrows the 4KB cookie limit.
 *
 * The distinction between `parsed` and `accessTokenValid` is load-bearing:
 * an access token expires roughly hourly while the refresh token keeps the
 * user signed in for far longer. Treating an expired access token as
 * "signed out" would bounce people to the login page every hour, so the
 * proxy lets them through and leaves the refresh to the browser client.
 */

export interface CookieLike {
  name: string;
  value: string;
}

export interface SessionCookieState {
  /** At least one auth-token cookie chunk was present. */
  present: boolean;
  /** The chunks decoded into a session object with a token. */
  parsed: boolean;
  /** The access token's `exp` is still in the future. */
  accessTokenValid: boolean;
}

const AUTH_COOKIE = /^sb-.+-auth-token(?:\.(\d+))?$/;

function decodeBase64(input: string): string | null {
  try {
    // Supabase emits standard base64; normalise the URL-safe variant and
    // restore padding so `atob` accepts either.
    const normalised = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalised.padEnd(
      normalised.length + ((4 - (normalised.length % 4)) % 4),
      '=',
    );
    return atob(padded);
  } catch {
    return null;
  }
}

/** Pull `exp` (seconds since epoch) out of a JWT without verifying it. */
function readJwtExp(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  const json = decodeBase64(payload);
  if (!json) return null;
  try {
    const claims = JSON.parse(json) as { exp?: unknown };
    return typeof claims.exp === 'number' ? claims.exp : null;
  } catch {
    return null;
  }
}

export function readSessionCookie(
  cookies: CookieLike[],
  now: number = Date.now(),
): SessionCookieState {
  const chunks = cookies
    .map((c) => ({ cookie: c, match: AUTH_COOKIE.exec(c.name) }))
    .filter((entry) => entry.match !== null)
    // Chunked cookies must be reassembled in index order; unchunked
    // cookies have no index and sort first.
    .sort(
      (a, b) =>
        Number(a.match![1] ?? -1) - Number(b.match![1] ?? -1),
    );

  if (chunks.length === 0 || chunks.every((entry) => !entry.cookie.value)) {
    return { present: false, parsed: false, accessTokenValid: false };
  }

  let raw = chunks.map((entry) => entry.cookie.value).join('');
  if (raw.startsWith('base64-')) {
    const decoded = decodeBase64(raw.slice('base64-'.length));
    if (decoded === null) {
      return { present: true, parsed: false, accessTokenValid: false };
    }
    raw = decoded;
  }

  let session: { access_token?: unknown; expires_at?: unknown };
  try {
    session = JSON.parse(raw) as typeof session;
  } catch {
    return { present: true, parsed: false, accessTokenValid: false };
  }

  const accessToken =
    typeof session.access_token === 'string' ? session.access_token : null;
  if (!accessToken) {
    return { present: true, parsed: false, accessTokenValid: false };
  }

  // `expires_at` is the cheap path; fall back to the token's own claim.
  const expiresAt =
    typeof session.expires_at === 'number'
      ? session.expires_at
      : readJwtExp(accessToken);

  return {
    present: true,
    parsed: true,
    accessTokenValid: expiresAt !== null && expiresAt * 1000 > now,
  };
}

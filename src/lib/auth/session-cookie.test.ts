import { describe, expect, it } from 'vitest';
import { readSessionCookie, type CookieLike } from './session-cookie';

const NOW = 1_800_000_000_000; // fixed clock so `exp` maths is deterministic
const FUTURE = Math.floor(NOW / 1000) + 3600;
const PAST = Math.floor(NOW / 1000) - 3600;

const COOKIE_NAME = 'sb-hqugxgsqwpjdoydmvjwu-auth-token';

/** Minimal unsigned JWT — only the payload is ever read. */
function jwt(exp: number): string {
  const body = Buffer.from(JSON.stringify({ exp })).toString('base64');
  return `header.${body}.signature`;
}

function sessionCookie(
  session: Record<string, unknown>,
  { base64 = true }: { base64?: boolean } = {},
): string {
  const json = JSON.stringify(session);
  return base64 ? `base64-${Buffer.from(json).toString('base64')}` : json;
}

function read(cookies: CookieLike[]) {
  return readSessionCookie(cookies, NOW);
}

describe('readSessionCookie', () => {
  it('reports no session when there are no cookies', () => {
    expect(read([])).toEqual({
      present: false,
      parsed: false,
      accessTokenValid: false,
    });
  });

  it('ignores unrelated cookies', () => {
    expect(read([{ name: 'theme', value: 'violet' }]).present).toBe(false);
  });

  it('treats an unparseable cookie as present but unusable', () => {
    // The bug that blanked the app: a garbage cookie previously counted as
    // "signed in", so /login bounced to /dashboard and back forever.
    expect(read([{ name: COOKIE_NAME, value: 'garbage' }])).toEqual({
      present: true,
      parsed: false,
      accessTokenValid: false,
    });
  });

  it('reads a valid base64-encoded session', () => {
    const value = sessionCookie({ access_token: jwt(FUTURE), expires_at: FUTURE });
    expect(read([{ name: COOKIE_NAME, value }])).toEqual({
      present: true,
      parsed: true,
      accessTokenValid: true,
    });
  });

  it('reads a plain JSON session', () => {
    const value = sessionCookie(
      { access_token: jwt(FUTURE), expires_at: FUTURE },
      { base64: false },
    );
    expect(read([{ name: COOKIE_NAME, value }]).accessTokenValid).toBe(true);
  });

  it('parses an expired session but marks the access token invalid', () => {
    // Still `parsed`, so the proxy lets them through to refresh rather
    // than bouncing everyone to /login once an hour.
    const value = sessionCookie({ access_token: jwt(PAST), expires_at: PAST });
    expect(read([{ name: COOKIE_NAME, value }])).toEqual({
      present: true,
      parsed: true,
      accessTokenValid: false,
    });
  });

  it('falls back to the JWT exp when expires_at is absent', () => {
    const value = sessionCookie({ access_token: jwt(FUTURE) });
    expect(read([{ name: COOKIE_NAME, value }]).accessTokenValid).toBe(true);
  });

  it('reassembles chunked cookies in index order', () => {
    const value = sessionCookie({ access_token: jwt(FUTURE), expires_at: FUTURE });
    const split = Math.floor(value.length / 2);
    // Deliberately supplied out of order — the reader must sort by index.
    const cookies: CookieLike[] = [
      { name: `${COOKIE_NAME}.1`, value: value.slice(split) },
      { name: `${COOKIE_NAME}.0`, value: value.slice(0, split) },
    ];
    expect(read(cookies).accessTokenValid).toBe(true);
  });

  it('rejects a session with no access token', () => {
    const value = sessionCookie({ expires_at: FUTURE });
    expect(read([{ name: COOKIE_NAME, value }]).parsed).toBe(false);
  });

  it('treats an empty cookie value as no session', () => {
    expect(read([{ name: COOKIE_NAME, value: '' }]).present).toBe(false);
  });
});
